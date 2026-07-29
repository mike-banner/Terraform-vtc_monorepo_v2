import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export async function sendEmailLog(params: {
  bookingId: string;
  emailType: "devis" | "invoice";
  recipientEmail: string;
  html: string;
  subject: string;
}): Promise<{ status: string; resend_id?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ to: params.recipientEmail, subject: params.subject, html: params.html }),
  });

  const data = await res.json().catch(() => ({}));
  const status = res.ok ? "sent" : "failed";
  const resendId = data?.id ?? null;

  await supabase.from("email_logs").insert({
    booking_id: params.bookingId,
    email_type: params.emailType,
    recipient_email: params.recipientEmail,
    status,
    resend_id: resendId,
  });

  return { status, resend_id: resendId };
}
