import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInvoiceEmail } from "../_shared/email-templates/native/invoice.ts";
import { sendEmailLog } from "../_shared/send-email-log.ts";
import { checkInvoiceable } from "../_shared/invoiceable.ts";
import { formatParisDate, legalLines } from "../_shared/invoice-mentions.ts";
import { buildDocumentPdf } from "../_shared/invoice-pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Facture maison, émise à la demande sur une course terminée (D-01). Le numéro FAC- est attribué par la RPC
// assign_invoice_number, avec le JWT de l'appelant (owner/manager du tenant) et dans la même transaction que son
// enregistrement : aucun trou de séquence. Le client service ne sert qu'à Storage et à l'e-mail, après autorisation.
// Périmètre : voir checkInvoiceable (transferts à prix kilométrique non validé refusés).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return json({ error: "booking_id requis" }, 400);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Lecture sous RLS : une course d'un autre tenant reste introuvable.
    const { data: pre } = await userClient.from("bookings")
      .select("invoice_number, pricing_mode, booking_type, distance_km")
      .eq("id", booking_id).maybeSingle();
    if (!pre) return json({ error: "Course introuvable" }, 404);

    const alreadyGenerated = pre.invoice_number?.startsWith("FAC-") === true;
    if (!alreadyGenerated) {
      const verdict = checkInvoiceable({
        pricing_mode: pre.pricing_mode,
        booking_type: pre.booking_type,
        distance_km: pre.distance_km,
      });
      if (!verdict.invoiceable) return json({ error: "price_not_validated", message: verdict.reason }, 409);
    }

    const { data: assigned, error: rpcErr } = await userClient.rpc("assign_invoice_number", { p_booking_id: booking_id });
    if (rpcErr || !assigned?.[0]) {
      const status = rpcErr?.code === "42501" ? 403 : rpcErr?.code === "P0002" ? 404 : 400;
      return json({ error: rpcErr?.message ?? "Numéro non attribué" }, status);
    }
    const { invoice_number: invoiceNumber, invoice_created_at: issuedAt } = assigned[0];

    const { data: booking } = await svc.from("bookings").select(
      "id, current_tenant_id, customer_id, pickup_address, dropoff_address, pickup_time, total_amount, subtotal_amount, vat_amount, payment_mode, passenger_count, luggage_count",
    ).eq("id", booking_id).single();
    if (!booking) return json({ error: "Course introuvable" }, 404);

    const [{ data: tenant }, { data: customer }, { data: payment }] = await Promise.all([
      svc.from("tenants").select(
        "name, logo_url, email, phone, siret, siren, vat_number, vat_rate, is_vat_exempt, legal_form, rcs_number, capital_social, address_line, postal_code, city",
      ).eq("id", booking.current_tenant_id).single(),
      svc.from("customers").select(
        "first_name, last_name, email, phone, type, company_name, vat_number, billing_address, city, postal_code, country",
      ).eq("id", booking.customer_id).maybeSingle(),
      svc.from("financial_movements").select("created_at").eq("booking_id", booking_id)
        .eq("movement_type", "payment").order("created_at").limit(1).maybeSingle(),
    ]);
    if (!tenant) return json({ error: "Tenant introuvable" }, 404);

    const serviceDate = booking.pickup_time ?? issuedAt;
    const pdfBytes = await buildDocumentPdf({
      kind: "invoice",
      logoUrl: tenant.logo_url,
      lines: legalLines(tenant, customer ?? {}, {
        kind: "invoice",
        number: invoiceNumber,
        issuedAt,
        serviceDate,
        paidAt: payment?.created_at ?? null,
        paymentMethod: booking.payment_mode === "cash" ? "cash" : "card",
      }),
      item: {
        description: `Course VTC - ${formatParisDate(serviceDate, true)}`,
        details: [
          `Départ : ${booking.pickup_address ?? "-"}`,
          `Arrivée : ${booking.dropoff_address ?? "-"}`,
          ...(booking.passenger_count ? [`${booking.passenger_count} passager(s)`] : []),
          ...(booking.luggage_count ? [`${booking.luggage_count} bagage(s)`] : []),
        ],
      },
      totals: {
        ht: Number(booking.subtotal_amount ?? booking.total_amount ?? 0),
        vat: Number(booking.vat_amount ?? 0),
        ttc: Number(booking.total_amount ?? 0),
        exempt: tenant.is_vat_exempt === true, // null = non exonéré (prudent, WR-02)
        vatRate: Number(tenant.vat_rate ?? 0),
      },
    });

    // upsert : régénérer le même document n'a aucun effet sur la numérotation.
    const storagePath = `${booking.current_tenant_id}/factures/${booking_id}.pdf`;
    const { error: uploadErr } = await svc.storage.from("invoices")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      console.error("UPLOAD ERROR", uploadErr);
      return json({ error: `Envoi du PDF impossible : ${uploadErr.message}` }, 500);
    }
    const { data: signed } = await svc.storage.from("invoices").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    const invoiceUrl = signed?.signedUrl ?? "";

    if (!alreadyGenerated && customer?.email && invoiceUrl) {
      const html = generateInvoiceEmail({
        invoiceNumber,
        invoiceUrl,
        tenant: {
          name: tenant.name ?? "",
          email: tenant.email,
          phone: tenant.phone,
          siret: tenant.siret,
          vat_number: tenant.vat_number,
          is_vat_exempt: tenant.is_vat_exempt,
          vat_rate: tenant.vat_rate,
          legal_form: tenant.legal_form,
          capital_social: tenant.capital_social,
        },
        customer: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          company_name: customer.company_name,
        },
        booking: {
          pickup_address: booking.pickup_address,
          dropoff_address: booking.dropoff_address,
          pickup_time: booking.pickup_time,
          subtotal_amount: booking.subtotal_amount,
          vat_amount: booking.vat_amount,
          total_amount: booking.total_amount,
          payment_mode: booking.payment_mode,
        },
      });
      await sendEmailLog({
        bookingId: booking_id,
        emailType: "invoice",
        recipientEmail: customer.email,
        subject: `Votre facture ${invoiceNumber} - ${tenant.name ?? ""}`,
        html,
      }).catch((err) => console.error("SEND EMAIL ERROR", err));
    }

    return json({ success: true, invoice_number: invoiceNumber, invoice_url: invoiceUrl, already_generated: alreadyGenerated });
  } catch (err) {
    console.error("GENERATE INVOICE ERROR", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
