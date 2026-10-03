import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";
import { refundOnce } from "../_shared/stripe-refund.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  try {
    const { booking_id, case: cancelCase, rate, note, retry } = await req.json();
    if (!booking_id) return json({ error: "booking_id requis" }, 400);

    // L'autorisation est faite par la RPC, avec le JWT de l'appelant.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    }) as any;

    const { data, error } = retry === true
      ? await userClient.rpc("retry_refund", { p_booking_id: booking_id })
      : await userClient.rpc("cancel_booking", {
        p_booking_id: booking_id,
        p_case: cancelCase,
        p_rate: rate ?? null,
        p_note: note ?? "",
      });

    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
      return json({ error: error.message }, status);
    }

    const res = data as {
      status: string;
      refund_amount: number | string | null;
      payment_intent_id: string | null;
      attempt: number;
    };

    let refundStatus: "succeeded" | "pending" | "failed" | null = null;

    if (res.status === "cancelled_pending_refund") {
      try {
        const refund = await refundOnce(stripe, {
          paymentIntentId: res.payment_intent_id!,
          // montant déjà arrondi en SQL : conversion en centimes seulement
          amountCents: Math.round(Number(res.refund_amount) * 100),
          metadata: { booking_id },
          idempotencyKey: `cancel-${booking_id}-${res.attempt}`,
        });

        if (refund.status === "succeeded") {
          const { error: recErr } = await svc.rpc("record_booking_refund", {
            p_booking_id: booking_id,
            p_stripe_refund_id: refund.id,
            p_amount: refund.amount / 100,
          });
          if (recErr) throw new Error(recErr.message);
          refundStatus = "succeeded";
        } else if (refund.status === "failed" || refund.status === "canceled") {
          await svc.rpc("mark_refund_failed", { p_booking_id: booking_id, p_message: refund.failure_reason ?? refund.status });
          refundStatus = "failed";
        } else {
          refundStatus = "pending"; // le webhook refund.updated finira
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("cancel-booking: remboursement en échec:", message);
        await svc.rpc("mark_refund_failed", { p_booking_id: booking_id, p_message: message });
        refundStatus = "failed";
      }
    }

    return json({ status: res.status, refund_amount: res.refund_amount, refund_status: refundStatus });
  } catch (e) {
    console.error("cancel-booking:", e instanceof Error ? e.message : String(e));
    return json({ error: "Erreur interne" }, 500);
  }
});
