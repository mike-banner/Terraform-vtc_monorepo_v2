import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { generateInvoiceEmail } from "../_shared/email-templates/invoice.ts";
import { sendEmailLog } from "../_shared/send-email-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ponytail: facture générée en PDF local (sans Stripe Invoicing) — le compte
// Stripe connecté de démo a un réglage d'auto-encaissement qui casse le flux
// paid_out_of_band. Avant la vraie prod : élucider ce réglage côté Stripe
// dashboard (Settings > Invoicing du compte connecté) et restaurer le flux
// Stripe (création facture + invoiceItems + finalize + pay), qui reste le
// seul moyen d'avoir une facture réellement encaissable/comptable côté Stripe.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response("Missing booking_id", { status: 400 });
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select(
        "id, current_tenant_id, customer_id, " +
        "pickup_address, dropoff_address, pickup_time, booking_type, " +
        "total_amount, subtotal_amount, vat_amount, " +
        "status, mission_status, payment_mode, " +
        "passenger_count, luggage_count, invoice_number"
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

    // Facture déjà générée — on renvoie l'existante
    if (booking.invoice_number?.startsWith("FAC-")) {
      const { data: existing, error: urlErr } = await supabase.storage
        .from("invoices")
        .createSignedUrl(`${booking.current_tenant_id}/factures/${booking_id}.pdf`, 60 * 60 * 24 * 30);
      if (urlErr || !existing?.signedUrl) {
        console.error("SIGNED URL ERROR (idempotent path)", urlErr);
        return new Response("PDF introuvable, veuillez régénérer la facture", { status: 404 });
      }
      return new Response(
        JSON.stringify({ success: true, invoice_number: booking.invoice_number, invoice_url: existing.signedUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: tenant }, { data: customer }] = await Promise.all([
      supabase.from("tenants").select(
        "name, email, phone, siret, vat_number, vat_rate, is_vat_exempt, " +
        "legal_form, rcs_number, capital_social"
      ).eq("id", booking.current_tenant_id).single(),
      supabase.from("customers").select(
        "first_name, last_name, email, phone, company_name, vat_number, " +
        "billing_address, city, postal_code, country"
      ).eq("id", booking.customer_id).maybeSingle(),
    ]);

    if (!tenant) {
      return new Response("Tenant not found", { status: 404 });
    }

    // Numéro séquentiel (art. L441-3 : sans rupture ni réutilisation)
    const now = new Date();
    const { data: invoiceNumber, error: seqErr } = await supabase.rpc(
      "next_invoice_number",
      { t_id: booking.current_tenant_id, y: now.getFullYear() }
    );
    if (seqErr || !invoiceNumber) {
      console.error("SEQUENCE ERROR", seqErr);
      return new Response("Failed to generate invoice number", { status: 500 });
    }

    // --- PDF ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);
    const green = rgb(0.09, 0.4, 0.2);
    const blue = rgb(0.1, 0.3, 0.6);

    let y = height - 60;

    // En-tête
    page.drawText(tenant.name ?? "", { x: 50, y, size: 18, font: fontBold, color: blue });
    page.drawText("FACTURE", { x: width - 170, y, size: 22, font: fontBold, color: blue });
    y -= 22;

    for (const line of [
      tenant.email,
      tenant.phone,
      tenant.siret ? `SIRET : ${tenant.siret}` : null,
      tenant.vat_number ? `TVA : ${tenant.vat_number}` : null,
      tenant.rcs_number ? `RCS : ${tenant.rcs_number}` : null,
    ].filter(Boolean) as string[]) {
      page.drawText(line, { x: 50, y, size: 9, font, color: gray });
      y -= 13;
    }

    page.drawText(`N° ${invoiceNumber}`, { x: width - 200, y: height - 82, size: 11, font: fontBold, color: black });
    page.drawText(`Date : ${now.toLocaleDateString("fr-FR")}`, { x: width - 200, y: height - 97, size: 10, font, color: black });

    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: gray });
    y -= 20;

    // Mention paiement reçu
    const paymentLabel = booking.payment_mode === "cash" ? "Espèces" : "Paiement en ligne";
    page.drawText(`Paiement reçu — ${paymentLabel}`, { x: 50, y, size: 10, font: fontBold, color: green });
    y -= 25;

    // Bloc client
    page.drawText("CLIENT", { x: 50, y, size: 10, font: fontBold, color: gray });
    y -= 16;

    const customerName = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "—";
    page.drawText(customerName, { x: 50, y, size: 11, font: fontBold, color: black });
    y -= 14;

    for (const line of [
      customer?.company_name,
      customer?.email,
      customer?.phone,
      customer?.billing_address
        ? [customer.billing_address, customer.postal_code, customer.city, customer.country].filter(Boolean).join(", ")
        : null,
      customer?.vat_number ? `TVA client : ${customer.vat_number}` : null,
    ].filter(Boolean) as string[]) {
      page.drawText(line, { x: 50, y, size: 10, font, color: black });
      y -= 13;
    }

    // Tableau prestation
    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: gray });
    y -= 25;

    page.drawText("DÉTAILS DE LA PRESTATION", { x: 50, y, size: 10, font: fontBold, color: gray });
    y -= 20;

    const col = [50, 280, 375, 465];
    for (const [i, label] of ["Description", "Qté", "P.U. HT", "Total HT"].entries()) {
      page.drawText(label, { x: col[i], y, size: 10, font: fontBold, color: black });
    }
    y -= 6;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.3, color: gray });
    y -= 16;

    const pickupDate = booking.pickup_time
      ? new Date(booking.pickup_time).toLocaleString("fr-FR")
      : "—";
    const subtotal = Number(booking.subtotal_amount ?? booking.total_amount ?? 0);

    page.drawText(`Course VTC — ${pickupDate}`, { x: col[0], y, size: 10, font: fontBold, color: black });
    page.drawText("1", { x: col[1], y, size: 10, font, color: black });
    page.drawText(`${subtotal.toFixed(2)} €`, { x: col[2], y, size: 10, font, color: black });
    page.drawText(`${subtotal.toFixed(2)} €`, { x: col[3], y, size: 10, font, color: black });
    y -= 14;

    for (const detail of [
      `Départ : ${booking.pickup_address ?? "—"}`,
      `Arrivée : ${booking.dropoff_address ?? "—"}`,
      booking.passenger_count ? `${booking.passenger_count} passager(s)` : null,
      booking.luggage_count ? `${booking.luggage_count} bagage(s)` : null,
    ].filter(Boolean) as string[]) {
      page.drawText(detail, { x: col[0] + 10, y, size: 9, font, color: gray });
      y -= 12;
    }

    // Totaux
    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.3, color: gray });
    y -= 20;

    const total = Number(booking.total_amount ?? 0);
    const vat = Number(booking.vat_amount ?? 0);
    // ponytail: null → non exonéré (prudent fiscalement, WR-02)
    const isExempt = tenant.is_vat_exempt === true;
    const vatRate = Number(tenant.vat_rate ?? 0);
    const labelX = width - 200;
    const valueX = width - 55;

    const drawTotal = (label: string, value: string, bold = false, color = black) => {
      page.drawText(label, { x: labelX, y, size: bold ? 12 : 10, font: bold ? fontBold : font, color });
      page.drawText(value, { x: valueX - value.length * (bold ? 7 : 5.5), y, size: bold ? 12 : 10, font: bold ? fontBold : font, color });
      y -= bold ? 20 : 16;
    };

    drawTotal("Sous-total HT :", `${subtotal.toFixed(2)} €`);
    if (!isExempt && vatRate > 0) {
      drawTotal(`TVA (${vatRate}%) :`, `${vat.toFixed(2)} €`);
    }
    drawTotal("TOTAL TTC :", `${total.toFixed(2)} €`, true, blue);

    // Pied de page légal
    const footerY = 60;
    page.drawLine({ start: { x: 50, y: footerY + 20 }, end: { x: width - 50, y: footerY + 20 }, thickness: 0.3, color: gray });
    let fy = footerY + 10;
    for (const line of [
      isExempt ? "TVA non applicable, art. 293 B du CGI." : `TVA au taux de ${vatRate}%.`,
      tenant.legal_form ? `Forme juridique : ${tenant.legal_form}` : null,
      tenant.capital_social ? `Capital social : ${Number(tenant.capital_social).toFixed(2)} €` : null,
    ].filter(Boolean) as string[]) {
      page.drawText(line, { x: 50, y: fy, size: 8, font, color: gray });
      fy -= 11;
    }

    const pdfBytes = await pdfDoc.save();

    // Upload Storage
    const storagePath = `${booking.current_tenant_id}/factures/${booking_id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("invoices")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.error("UPLOAD ERROR", uploadErr);
      return new Response(`Upload failed: ${uploadErr.message}`, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from("invoices")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30); // 30 jours

    const invoiceUrl = signedData?.signedUrl ?? "";

    await supabase.from("bookings").update({
      invoice_url: invoiceUrl || null,
      invoice_number: invoiceNumber,
      invoice_created_at: now.toISOString(),
    }).eq("id", booking_id);

    // --- Email ---
    const customerEmail = customer?.email;
    if (customerEmail && invoiceUrl) {
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
          first_name: customer?.first_name,
          last_name: customer?.last_name,
          email: customer?.email,
          company_name: customer?.company_name,
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
        recipientEmail: customerEmail,
        subject: `Votre facture ${invoiceNumber} — ${tenant.name ?? ""}`,
        html,
      }).catch((err) => console.error("SEND EMAIL ERROR", err));
    }

    return new Response(
      JSON.stringify({ success: true, invoice_number: invoiceNumber, invoice_url: invoiceUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("GENERATE INVOICE ERROR", err);
    return new Response("Internal server error", { status: 500 });
  }
});
