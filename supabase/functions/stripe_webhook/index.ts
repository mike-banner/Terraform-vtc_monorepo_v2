import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
}) as any;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await req.arrayBuffer();
  const body = new TextDecoder().decode(rawBody);

  let event: any;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    console.log("SIGNATURE ERROR", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const obj: any = event.data.object;

  const sessionId =
    obj?.id && obj?.object === "checkout.session"
      ? obj.id
      : (obj?.checkout_session ?? null);

  const paymentIntent = obj?.payment_intent ?? obj?.id ?? null;

  const tenantId = obj?.metadata?.tenant_id ?? null;

  const amount = obj?.amount_total
    ? obj.amount_total / 100
    : obj?.amount_received
      ? obj.amount_received / 100
      : null;

  // --------------------------
  // STATUS
  // --------------------------

  let status = "received";

  if (event.type === "checkout.session.completed") {
    status = "session_completed";
  }

  if (event.type === "payment_intent.succeeded") {
    status = "paid";
  }

  if (event.type === "payment_intent.payment_failed") {
    status = "failed";
  }

  // --------------------------
  // UPSERT stripe_events
  // --------------------------

  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("stripe_events").insert({
      stripe_event_id: event.id,
      session_id: sessionId,
      payment_intent_id: paymentIntent,
      event_type: event.type,
      status,
      tenant_id: tenantId,
      amount,
      metadata: event,
    });
  } else {
    await supabase
      .from("stripe_events")
      .update({
        status,
        metadata: event,
      })
      .eq("stripe_event_id", event.id);
  }

  // --------------------------
  // CREATE BOOKING V1
  // --------------------------
  if (event.type === "checkout.session.completed") {
    const session = obj as any;

    if (session?.metadata) {
      const m = session.metadata;

      // 1. Valider tenant_id existe en DB
      if (!tenantId) {
        console.error("CRITICAL: tenant_id is missing in session metadata");
        return new Response("Error: tenant_id missing", { status: 400 });
      }

      const { data: tenantExists, error: tenantChkError } = await supabase
        .from("tenants")
        .select("id, vat_rate, is_vat_exempt")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantChkError || !tenantExists) {
        console.error("CRITICAL: Tenant does not exist in database:", tenantId);
        return new Response("Error: Tenant not found", { status: 400 });
      }

      // 2. Valider pricing contre la grille tarifaire du tenant (F-06)
      const vehicleId = m.vehicle_id;
      if (!vehicleId) {
        console.error("CRITICAL: vehicle_id missing in session metadata");
        return new Response("Error: vehicle_id missing", { status: 400 });
      }

      const { data: vehicle, error: vehicleErr } = await supabase
        .from("vehicles")
        .select("category, tenant_id")
        .eq("id", vehicleId)
        .maybeSingle();

      if (vehicleErr || !vehicle) {
        console.error("CRITICAL: Vehicle not found:", vehicleId);
        return new Response("Error: Vehicle not found", { status: 400 });
      }

      if (vehicle.tenant_id !== tenantId) {
        console.error("CRITICAL: Vehicle tenant mismatch:", vehicle.tenant_id, "vs", tenantId);
        return new Response("Error: Vehicle tenant mismatch", { status: 400 });
      }

      let calculatedPrice = 0;
      const fixedRouteId = m.fixed_route_id;

      if (fixedRouteId) {
        const { data: route, error: rErr } = await supabase
          .from("fixed_routes")
          .select("price, tenant_id, active")
          .eq("id", fixedRouteId)
          .maybeSingle();

        if (rErr || !route) {
          console.error("CRITICAL: Fixed route not found:", fixedRouteId);
          return new Response("Error: Fixed route not found", { status: 400 });
        }
        if (!route.active) {
          console.error("CRITICAL: Fixed route is inactive:", fixedRouteId);
          return new Response("Error: Fixed route inactive", { status: 400 });
        }
        if (route.tenant_id !== tenantId) {
          console.error("CRITICAL: Fixed route tenant mismatch");
          return new Response("Error: Fixed route tenant mismatch", { status: 400 });
        }
        calculatedPrice = Number(route.price);
      } else {
        const { data: allPricingRules, error: prErr } = await supabase
          .from("pricing_rules")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("active", true);

        if (prErr || !allPricingRules || allPricingRules.length === 0) {
          console.error("CRITICAL: No pricing rules found for tenant");
          return new Response("Error: Pricing rules not found", { status: 400 });
        }

        const cat = (vehicle.category ?? "").toLowerCase().trim();
        const rule = allPricingRules.find((r: any) => (r.service_category ?? "").toLowerCase().trim() === cat) || allPricingRules[0];

        const base = Number(rule.base_price) || 0;
        const minFare = Number(rule.minimum_fare) || 0;
        const type = m.booking_type;

        if (type === "hourly") {
          const durationHours = Number(m.duration_hours || 1);
          calculatedPrice = base + (Number(rule.price_per_hour) || 0) * durationHours;
        } else {
          const distanceKm = Number(m.distance_km || 0);
          calculatedPrice = base + (Number(rule.price_per_km) || 0) * distanceKm;
        }

        calculatedPrice = Math.max(calculatedPrice, minFare);
      }

      const amountPaidCents = session.amount_total;
      const calculatedCents = Math.round(calculatedPrice * 100);

      if (Math.abs(amountPaidCents - calculatedCents) > 1) {
        console.error(`CRITICAL: Price mismatch! Stripe paid = ${amountPaidCents} cents, Calculated = ${calculatedCents} cents`);
        return new Response("Error: Price mismatch detected", { status: 400 });
      }

      const total = Number(calculatedPrice);

      // Recalcul TVA serveur depuis la config du tenant
      let subtotal = total;
      let vat = 0;
      const vatRate  = Number(tenantExists.vat_rate ?? 0);
      const isExempt = tenantExists.is_vat_exempt !== false;
      if (!isExempt && vatRate > 0 && total > 0) {
        subtotal = Math.round((total / (1 + vatRate / 100)) * 100) / 100;
        vat      = Math.round((total - subtotal) * 100) / 100;
      }

      console.log("INSERTING BOOKING FOR CUSTOMER", m.customer_id);

      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          original_tenant_id: tenantId,
          current_tenant_id: tenantId,

          pickup_address: String(m.pickup_address ?? "").trim().substring(0, 500),
          dropoff_address: String(m.dropoff_address ?? "").trim().substring(0, 500),

          pickup_time: m.pickup_time,

          total_amount: total,
          subtotal_amount: subtotal,
          vat_amount: vat,

          mission_status: "to_validate",
          status: "paid",
          payment_mode: "stripe",
          booking_source: "customer", // OBLIGATOIRE
          pricing_mode: "direct",     // OBLIGATOIRE

          customer_id: m.customer_id,

          stripe_payment_intent_id: session.payment_intent,

          passenger_count: Number(m.passenger_count ?? 1),
          luggage_count: Number(m.luggage_count ?? 0),

          booking_type: m.booking_type,

          vehicle_id: m.vehicle_id ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error("CRITICAL: BOOKING INSERTION FAILED", error);
        // On retourne une 500 pour que Stripe retente le webhook plus tard
        return new Response(`Error: ${error.message}`, { status: 500 });
      }

      if (booking) {
        console.log("BOOKING CREATED SUCCESS", booking.id);
        await supabase
          .from("stripe_events")
          .update({
            status: "booking_created",
            booking_id: booking.id,
          })
          .eq("stripe_event_id", event.id);
      }
    }
  }

  return new Response("OK");
});
