import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBrand } from "../_shared/email-templates/brand.ts";
import { bookingConfirmationEmail } from "../_shared/email-templates/site/booking-confirmation.ts";
import { paymentWithoutBookingEmail } from "../_shared/email-templates/native/payment-without-booking.ts";
import { paymentReceivedCustomerEmail } from "../_shared/email-templates/native/payment-received-customer.ts";
import { sendEmailLog } from "../_shared/send-email-log.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
}) as any;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendMail(to: string, subject: string, html: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) console.error("ALERT EMAIL FAILED", to, res.status);
}

// Paiement encaissé mais course non créée : prévient le chauffeur (avec les infos du client
// pour rembourser ou recréer la course) et le client. Appelée une seule fois par événement.
async function alertBookingFailed(session: any, tenantId: string | null, reason: string) {
  if (!tenantId) return;
  const m = session.metadata ?? {};
  const { data: tenant } = await supabase.from("tenants").select("name, email, logo_url, primary_color, phone").eq("id", tenantId).maybeSingle();
  const { data: cust } = m.customer_id
    ? await supabase.from("customers").select("first_name, last_name, email, phone").eq("id", m.customer_id).maybeSingle()
    : { data: null };

  let to = tenant?.email as string | null | undefined;
  if (!to) {
    // Repli : l'email de connexion du propriétaire du tenant.
    const { data: owner } = await supabase.from("profiles").select("id").eq("tenant_id", tenantId).eq("tenant_role", "owner").limit(1).maybeSingle();
    if (owner) to = (await supabase.auth.admin.getUserById(owner.id)).data.user?.email;
  }

  const customerEmail = cust?.email ?? session.customer_details?.email;
  const amount = (session.amount_total ?? 0) / 100;
  const testMode = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_") ? "/test" : "";
  const name = [cust?.first_name, cust?.last_name].filter(Boolean).join(" ") || session.customer_details?.name || "Client";

  if (to) {
    await sendMail(to, "Action requise : paiement reçu, course non créée", paymentWithoutBookingEmail({
      amount,
      customerName: name,
      customerEmail,
      customerPhone: cust?.phone ?? session.customer_details?.phone,
      pickupAddress: m.pickup_address,
      dropoffAddress: m.dropoff_address,
      pickupTime: m.pickup_time,
      stripeUrl: `https://dashboard.stripe.com${testMode}/payments/${session.payment_intent}`,
      reason,
    }));
  } else {
    console.error("ALERT: aucun email chauffeur pour le tenant", tenantId);
  }

  if (customerEmail) {
    await sendMail(customerEmail, `Votre paiement a bien été reçu${tenant?.name ? ` | ${tenant.name}` : ""}`,
      paymentReceivedCustomerEmail({ brand: getBrand(tenant), firstName: cust?.first_name, amount }));
  }
}

// Course créée : confirmation au client, aux couleurs du chauffeur. Un échec d'envoi ne bloque jamais le webhook.
async function sendBookingConfirmation(session: any, tenantId: string, booking: any) {
  const m = session.metadata ?? {};
  const { data: tenant } = await supabase.from("tenants").select("name, email, logo_url, primary_color, phone").eq("id", tenantId).maybeSingle();
  const { data: cust } = m.customer_id
    ? await supabase.from("customers").select("first_name, email").eq("id", m.customer_id).maybeSingle()
    : { data: null };
  const to = cust?.email ?? session.customer_details?.email;
  if (!to) return;
  // Journalisé dans email_logs ; sendEmailLog ne lève pas sur un refus du service d'envoi.
  await sendEmailLog({ bookingId: booking.id, emailType: "booking_confirmation", recipientEmail: to,
    subject: `Votre réservation est confirmée${tenant?.name ? ` | ${tenant.name}` : ""}`, html: bookingConfirmationEmail({
    brand: getBrand(tenant),
    firstName: cust?.first_name,
    reference: String(booking.id).slice(0, 8).toUpperCase(),
    pickupAddress: booking.pickup_address,
    dropoffAddress: booking.dropoff_address,
    pickupTime: booking.pickup_time,
    total: Number(booking.total_amount),
  }) });
}

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
    console.error("stripe_webhook: signature invalide", err instanceof Error ? err.message : err);
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
    .select("id, status")
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
        // booking_created / booking_failed ne sont jamais réécrits par un rejeu
        ...(["booking_created", "booking_failed"].includes(existing.status) ? {} : { status }),
        metadata: event,
      })
      .eq("stripe_event_id", event.id);
  }

  // --------------------------
  // REMBOURSEMENTS (refund.updated / refund.failed)
  // --------------------------
  if (event.type === "refund.updated" || event.type === "refund.failed") {
    const r = obj;
    const bookingId = r?.metadata?.booking_id;
    // Le grand livre d'un avoir est écrit par l'avoir lui-même (plan 04).
    if (bookingId && !r.metadata?.credit_note_id) {
      let rpcErr = null;
      if (r.status === "succeeded") {
        ({ error: rpcErr } = await supabase.rpc("record_booking_refund", {
          p_booking_id: bookingId,
          p_stripe_refund_id: r.id,
          p_amount: r.amount / 100,
        }));
      } else if (r.status === "failed" || r.status === "canceled") {
        ({ error: rpcErr } = await supabase.rpc("mark_refund_failed", {
          p_booking_id: bookingId,
          p_message: r.failure_reason ?? r.status,
        }));
      }
      if (rpcErr) {
        console.error("stripe_webhook: refund RPC:", rpcErr.message);
        return new Response("Error: refund RPC", { status: 500 }); // Stripe rejoue, RPC idempotentes
      }
    }
    return new Response("OK");
  }

  // --------------------------
  // CREATE BOOKING V1
  // --------------------------
  if (event.type === "checkout.session.completed") {
    const session = obj as any;

    const failBooking = async (reason: string, httpStatus: number) => {
      await supabase
        .from("stripe_events")
        .update({ status: "booking_failed", error: reason })
        .eq("stripe_event_id", event.id);
      // Une seule alerte : Stripe rejoue l'événement pendant plusieurs jours.
      if (existing?.status !== "booking_failed") {
        await alertBookingFailed(session, tenantId, reason).catch((e) => console.error("ALERT ERROR", e));
      }
      return new Response(`Error: ${reason}`, { status: httpStatus });
    };

    if (session?.metadata) {
      const m = session.metadata;

      // 1. Valider tenant_id existe en DB
      if (!tenantId) {
        console.error("CRITICAL: tenant_id is missing in session metadata");
        return await failBooking("tenant_id missing", 400);
      }

      const { data: tenantExists, error: tenantChkError } = await supabase
        .from("tenants")
        .select("id, vat_rate, is_vat_exempt")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantChkError || !tenantExists) {
        console.error("CRITICAL: Tenant does not exist in database:", tenantId);
        return await failBooking("Tenant not found", 400);
      }

      // 2. Valider pricing contre la grille tarifaire du tenant (F-06)
      const vehicleId = m.vehicle_id;
      if (!vehicleId) {
        console.error("CRITICAL: vehicle_id missing in session metadata");
        return await failBooking("vehicle_id missing", 400);
      }

      const { data: vehicle, error: vehicleErr } = await supabase
        .from("vehicles")
        .select("category, tenant_id")
        .eq("id", vehicleId)
        .maybeSingle();

      if (vehicleErr || !vehicle) {
        console.error("CRITICAL: Vehicle not found:", vehicleId);
        return await failBooking("Vehicle not found", 400);
      }

      if (vehicle.tenant_id !== tenantId) {
        console.error("CRITICAL: Vehicle tenant mismatch:", vehicle.tenant_id, "vs", tenantId);
        return await failBooking("Vehicle tenant mismatch", 400);
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
          return await failBooking("Fixed route not found", 400);
        }
        if (!route.active) {
          console.error("CRITICAL: Fixed route is inactive:", fixedRouteId);
          return await failBooking("Fixed route inactive", 400);
        }
        if (route.tenant_id !== tenantId) {
          console.error("CRITICAL: Fixed route tenant mismatch");
          return await failBooking("Fixed route tenant mismatch", 400);
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
          return await failBooking("Pricing rules not found", 400);
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
        return await failBooking("Price mismatch detected", 400);
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
          instructions: String(m.instructions ?? "").trim().slice(0, 500) || null,

          booking_type: m.booking_type,

          vehicle_id: m.vehicle_id ?? null,
        })
        .select()
        .single();

      if (error?.code === "23505") {
        // Événement rejoué ou livré en double : la course existe déjà pour ce paiement.
        const { data: already } = await supabase
          .from("bookings")
          .select("id")
          .eq("stripe_payment_intent_id", session.payment_intent)
          .maybeSingle();
        await supabase
          .from("stripe_events")
          .update({ status: "booking_created", booking_id: already?.id ?? null })
          .eq("stripe_event_id", event.id);
        return new Response("OK (course déjà créée)");
      }

      if (error) {
        console.error("CRITICAL: BOOKING INSERTION FAILED", error);
        // 500 : Stripe retente plus tard (sans risque de doublon grâce à l'index unique)
        return await failBooking(error.message, 500);
      }

      if (booking) {
        await supabase
          .from("stripe_events")
          .update({
            status: "booking_created",
            booking_id: booking.id,
          })
          .eq("stripe_event_id", event.id);
        await sendBookingConfirmation(session, tenantId, booking).catch((e) => console.error("CONFIRMATION EMAIL ERROR", e));
      }
    }
  }

  return new Response("OK");
});
