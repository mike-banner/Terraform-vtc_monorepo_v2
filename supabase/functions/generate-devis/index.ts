import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { generateDevisEmail } from "../_shared/email-templates/devis.ts";
import { sendEmailLog } from "../_shared/send-email-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: booking } = await supabase.from("bookings").select(
      "id, current_tenant_id, customer_id, pickup_address, dropoff_address, pickup_time, " +
      "total_amount, subtotal_amount, vat_amount, payment_mode, booking_type, " +
      "passenger_count, luggage_count, invoice_number"
    ).eq("id", booking_id).single();

    if (!booking) {
      return new Response("Booking not found", { status: 404 });
    }

    // Devis déjà généré — on renvoie l'existant
    if (booking.invoice_number?.startsWith("DEV-")) {
      const { data: existing, error: urlErr } = await supabase.storage
        .from("invoices")
        .createSignedUrl(`${booking.current_tenant_id}/devis/${booking_id}.pdf`, 60 * 60 * 24 * 7); // 7 jours (WR-03)
      if (urlErr || !existing?.signedUrl) {
        console.error("SIGNED URL ERROR (idempotent path)", urlErr);
        return new Response("PDF introuvable, veuillez régénérer le devis", { status: 404 });
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

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const invoiceNumber = `DEV-${dateStr}-${booking_id.slice(0, 6).toUpperCase()}`;

    // --- PDF ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);
    const blue = rgb(0.1, 0.3, 0.6);

    let y = height - 60;

    // En-tête
    page.drawText(tenant.name ?? "", { x: 50, y, size: 18, font: fontBold, color: blue });
    page.drawText("DEVIS", { x: width - 150, y, size: 22, font: fontBold, color: blue });
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
    page.drawText("Valable 30 jours", { x: width - 200, y: height - 112, size: 9, font, color: gray });

    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: gray });
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
      "Ce document est un devis sans valeur fiscale. Il ne constitue pas une facture.",
      isExempt ? "TVA non applicable, art. 293 B du CGI." : `TVA au taux de ${vatRate}%.`,
      tenant.legal_form ? `Forme juridique : ${tenant.legal_form}` : null,
      tenant.capital_social ? `Capital social : ${Number(tenant.capital_social).toFixed(2)} €` : null,
    ].filter(Boolean) as string[]) {
      page.drawText(line, { x: 50, y: fy, size: 8, font, color: gray });
      fy -= 11;
    }

    const pdfBytes = await pdfDoc.save();

    // Upload Storage
    const storagePath = `${booking.current_tenant_id}/devis/${booking_id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("invoices")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.error("UPLOAD ERROR", uploadErr);
      return new Response(`Upload failed: ${uploadErr.message}`, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from("invoices")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 jours (WR-03)

    const pdfUrl = signedData?.signedUrl ?? "";

    await supabase.from("bookings").update({
      invoice_url: pdfUrl || null,
      invoice_number: invoiceNumber,
      invoice_created_at: now.toISOString(),
    }).eq("id", booking_id);

    // --- Email ---
    const customerEmail = customer?.email;
    if (customerEmail && pdfUrl) {
      const html = generateDevisEmail({
        invoiceNumber,
        pdfUrl,
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
          passenger_count: booking.passenger_count,
          luggage_count: booking.luggage_count,
        },
      });

      await sendEmailLog({
        bookingId: booking_id,
        emailType: "devis",
        recipientEmail: customerEmail,
        subject: `Votre devis ${invoiceNumber} — ${tenant.name ?? ""}`,
        html,
      }).catch((err) => console.error("SEND EMAIL ERROR", err));
    }

    return new Response(
      JSON.stringify({ success: true, invoice_number: invoiceNumber, invoice_url: pdfUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("GENERATE DEVIS ERROR", err);
    return new Response("Internal server error", { status: 500 });
  }
});
