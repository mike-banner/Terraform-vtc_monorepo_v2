import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Client plateforme — on utilisera stripeAccount pour opérer sur le compte connecté du tenant
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
}) as any;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response("Missing booking_id", { status: 400 });
    }

    // --- 1. Booking ---
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select(
        "id, current_tenant_id, customer_id, " +
        "pickup_address, dropoff_address, pickup_time, booking_type, " +
        "total_amount, subtotal_amount, vat_amount, " +
        "status, mission_status, payment_mode, " +
        "stripe_payment_intent_id, invoice_number"
      )
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) {
      return new Response("Booking not found", { status: 404 });
    }

    // Guard : seulement pour les courses terminées/payées
    const isEligible =
      booking.status === "paid" ||
      booking.mission_status === "completed";

    if (!isEligible) {
      return new Response(
        `Booking not eligible (status=${booking.status}, mission_status=${booking.mission_status})`,
        { status: 400 }
      );
    }

    // Idempotence : facture officielle déjà générée (invoice_number commence par FAC-)
    if (booking.invoice_number?.startsWith("FAC-")) {
      return new Response(
        JSON.stringify({ success: true, invoice_number: booking.invoice_number, already_generated: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- 2. Tenant ---
    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select(
        "id, name, email, siret, vat_number, vat_rate, is_vat_exempt, " +
        "legal_form, rcs_number, capital_social, stripe_account_id"
      )
      .eq("id", booking.current_tenant_id)
      .single();

    if (tErr || !tenant) {
      return new Response("Tenant not found", { status: 404 });
    }

    if (!tenant.stripe_account_id) {
      return new Response("Tenant has no Stripe connected account", { status: 400 });
    }

    // Options Stripe pour opérer sur le compte connecté du tenant
    const connectedOpts = { stripeAccount: tenant.stripe_account_id };

    // --- 3. Customer Stripe (scoped au compte connecté) ---
    const { data: customer } = await supabase
      .from("customers")
      .select("id, email, first_name, last_name, company_name, vat_number, stripe_customer_id")
      .eq("id", booking.customer_id)
      .maybeSingle();

    let stripeCustomerId: string | null = customer?.stripe_customer_id ?? null;

    if (!stripeCustomerId && customer) {
      const sc = await stripe.customers.create(
        {
          email: customer.email,
          name: customer.company_name ||
            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
          metadata: {
            customer_id: customer.id,
            tenant_id: booking.current_tenant_id,
          },
        },
        connectedOpts
      );
      stripeCustomerId = sc.id;

      await supabase
        .from("customers")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", customer.id);
    }

    if (!stripeCustomerId) {
      return new Response("Cannot resolve Stripe customer", { status: 400 });
    }

    // --- 4. Ligne de facturation ---
    const totalCents = Math.round(Number(booking.total_amount ?? 0) * 100);
    const subtotalCents = Math.round(Number(booking.subtotal_amount ?? booking.total_amount ?? 0) * 100);
    const vatCents = Math.round(Number(booking.vat_amount ?? 0) * 100);
    const isExempt = tenant.is_vat_exempt !== false;
    const vatRate = Number(tenant.vat_rate ?? 0);

    const pickupDate = booking.pickup_time
      ? new Date(booking.pickup_time).toLocaleString("fr-FR")
      : "—";

    const description = [
      `Course VTC — ${pickupDate}`,
      `Départ : ${booking.pickup_address ?? "—"}`,
      `Arrivée : ${booking.dropoff_address ?? "—"}`,
    ].join(" | ");

    // Ligne HT
    await stripe.invoiceItems.create(
      {
        customer: stripeCustomerId,
        amount: isExempt ? totalCents : subtotalCents,
        currency: "eur",
        description,
      },
      connectedOpts
    );

    // Ligne TVA si applicable
    if (!isExempt && vatRate > 0 && vatCents > 0) {
      await stripe.invoiceItems.create(
        {
          customer: stripeCustomerId,
          amount: vatCents,
          currency: "eur",
          description: `TVA ${vatRate}%`,
        },
        connectedOpts
      );
    }

    // --- 5. Création facture ---
    const vatMention = isExempt
      ? "TVA non applicable, art. 293 B du CGI."
      : `TVA au taux de ${vatRate}%.`;

    const footerParts = [
      vatMention,
      tenant.siret ? `SIRET : ${tenant.siret}` : null,
      tenant.vat_number ? `N° TVA : ${tenant.vat_number}` : null,
      tenant.rcs_number ? `RCS : ${tenant.rcs_number}` : null,
      tenant.legal_form ? `Forme juridique : ${tenant.legal_form}` : null,
      tenant.capital_social
        ? `Capital social : ${Number(tenant.capital_social).toFixed(2)} €`
        : null,
    ].filter(Boolean).join(" — ");

    const invoice = await stripe.invoices.create(
      {
        customer: stripeCustomerId,
        auto_advance: false,
        collection_method: "send_invoice",
        days_until_due: 0,
        footer: footerParts,
        metadata: {
          booking_id,
          tenant_id: booking.current_tenant_id,
          payment_mode: booking.payment_mode,
        },
      },
      connectedOpts
    );

    // --- 6. Finalisation ---
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id, connectedOpts);

    // paid_out_of_band = true dans tous les cas :
    // - Cas A (Stripe Checkout) : paiement déjà capturé via PaymentIntent, pas via cette facture
    // - Cas B (cash) : paiement encaissé manuellement
    const paid = await stripe.invoices.pay(
      finalized.id,
      { paid_out_of_band: true },
      connectedOpts
    );

    // --- 7. Mise à jour booking ---
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const invoiceNumber = `FAC-${dateStr}-${booking_id.slice(0, 6).toUpperCase()}`;

    await supabase
      .from("bookings")
      .update({
        invoice_url: paid.hosted_invoice_url ?? paid.invoice_pdf ?? null,
        invoice_number: invoiceNumber,
        invoice_created_at: now.toISOString(),
      })
      .eq("id", booking_id);

    console.log("INVOICE GENERATED", invoiceNumber, "stripe_id:", paid.id);

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        invoice_url: paid.hosted_invoice_url,
        stripe_invoice_id: paid.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("GENERATE INVOICE ERROR", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});
