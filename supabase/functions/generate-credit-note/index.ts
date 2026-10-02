import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";
import { getBrand } from "../_shared/email-templates/brand.ts";
import { creditNoteEmail } from "../_shared/email-templates/native/credit-note.ts";
import { sendEmailLog } from "../_shared/send-email-log.ts";
import { refundOnce } from "../_shared/stripe-refund.ts";
import { legalLines } from "../_shared/invoice-mentions.ts";
import { buildDocumentPdf } from "../_shared/invoice-pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Avoir AV- total ou partiel sur une facture. issue_credit_note (JWT de l'appelant, owner/manager) attribue le numéro,
// enregistre l'avoir et écrit le mouvement refund au grand livre dans une seule transaction.
// Course payée par carte : remboursement Stripe du même montant, sans second mouvement au grand livre.
// Rappel avec { credit_note_id } : régénère le PDF et relance un remboursement échoué (refundOnce ne double jamais).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  try {
    const { booking_id, amount, reason, credit_note_id } = await req.json();

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let noteId: string = credit_note_id;
    let firstIssue = false;
    if (!noteId) {
      if (!booking_id) return json({ error: "booking_id ou credit_note_id requis" }, 400);
      const { data, error } = await userClient.rpc("issue_credit_note", {
        p_booking_id: booking_id,
        p_amount_ttc: amount,
        p_reason: reason,
      });
      if (error || !data?.[0]) {
        const status = error?.code === "42501" ? 403 : error?.code === "P0002" ? 404 : 400;
        return json({ error: error?.message ?? "Avoir non émis" }, status);
      }
      noteId = data[0].credit_note_id;
      firstIssue = true;
    }

    // RLS owner/manager = autorisation de lecture.
    const { data: note } = await userClient.from("credit_notes").select("*").eq("id", noteId).maybeSingle();
    if (!note) return json({ error: "Avoir introuvable" }, 404);

    const { data: booking } = await svc.from("bookings")
      .select("id, current_tenant_id, customer_id, stripe_payment_intent_id, pickup_time")
      .eq("id", note.booking_id).single();
    if (!booking) return json({ error: "Course introuvable" }, 404);
    const [{ data: tenant }, { data: customer }] = await Promise.all([
      svc.from("tenants").select(
        "name, logo_url, primary_color, email, phone, siret, siren, vat_number, vat_rate, is_vat_exempt, legal_form, rcs_number, capital_social, address_line, postal_code, city",
      ).eq("id", note.tenant_id).single(),
      svc.from("customers").select(
        "first_name, last_name, email, phone, type, company_name, vat_number, billing_address, city, postal_code, country",
      ).eq("id", booking.customer_id).maybeSingle(),
    ]);
    if (!tenant) return json({ error: "Tenant introuvable" }, 404);

    const pdfBytes = await buildDocumentPdf({
      kind: "credit_note",
      logoUrl: tenant.logo_url,
      lines: legalLines(tenant, customer ?? {}, {
        kind: "credit_note",
        number: note.number,
        issuedAt: note.issued_at,
        serviceDate: booking.pickup_time ?? note.issued_at,
        originalInvoiceNumber: note.invoice_number,
      }),
      item: { description: `Avoir sur la facture ${note.invoice_number}`, details: [`Motif : ${note.reason}`] },
      totals: {
        ht: Number(note.amount_ht),
        vat: Number(note.vat_amount),
        ttc: Number(note.amount_ttc),
        exempt: tenant.is_vat_exempt === true,
        vatRate: Number(tenant.vat_rate ?? 0),
      },
    });

    const storagePath = `${note.tenant_id}/avoirs/${note.id}.pdf`;
    const { error: uploadErr } = await svc.storage.from("invoices")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      console.error("UPLOAD ERROR", uploadErr);
      return json({ error: `Avoir émis (${note.number}) ; PDF à régénérer : ${uploadErr.message}` }, 500);
    }
    const { data: signed } = await svc.storage.from("invoices").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    const url = signed?.signedUrl ?? "";

    // ponytail: pas d'état de remboursement stocké pour un avoir, la liste Stripe fait foi (refundOnce la relit).
    let refundStatus: "succeeded" | "pending" | "failed" | null = null;
    let message: string | undefined;
    if (booking.stripe_payment_intent_id) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
          apiVersion: "2024-06-20",
          httpClient: Stripe.createFetchHttpClient(),
        }) as any;
        const refund = await refundOnce(stripe, {
          paymentIntentId: booking.stripe_payment_intent_id,
          amountCents: Math.round(Number(note.amount_ttc) * 100), // montant déjà arrondi en SQL
          metadata: { booking_id: booking.id, credit_note_id: note.id },
          idempotencyKey: `credit-note-${note.id}`,
        });
        refundStatus = refund.status === "succeeded" ? "succeeded"
          : refund.status === "failed" || refund.status === "canceled" ? "failed" : "pending";
      } catch (e) {
        console.error("generate-credit-note: remboursement en échec:", e instanceof Error ? e.message : String(e));
        refundStatus = "failed";
      }
      if (refundStatus === "failed") message = "Avoir émis ; remboursement Stripe à relancer";
    }

    if (firstIssue && customer?.email && url) {
      await sendEmailLog({
        bookingId: booking.id,
        emailType: "credit_note",
        recipientEmail: customer.email,
        subject: `Votre avoir ${note.number}${tenant.name ? ` | ${tenant.name}` : ""}`,
        html: creditNoteEmail({
          brand: getBrand(tenant),
          firstName: customer.first_name,
          number: note.number,
          invoiceNumber: note.invoice_number,
          amount: Number(note.amount_ttc),
          url,
        }),
      }).catch((err) => console.error("SEND EMAIL ERROR", err));
    }

    return json({ success: true, number: note.number, url, refund_status: refundStatus, ...(message ? { message } : {}) });
  } catch (err) {
    console.error("GENERATE CREDIT NOTE ERROR", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
