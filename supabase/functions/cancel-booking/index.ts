import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

serve(async (req) => {
  try {
    const { booking_id, reason } = await req.json();

    if (!booking_id || !reason) {
      return new Response("Missing params", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1️⃣ Load booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .limit(1)
      .maybeSingle();

    if (!booking) {
      return new Response("Booking not found", { status: 404 });
    }

    // 2️⃣ Load cancellation policy
    const { data: policy } = await supabase
      .from("cancellation_policies")
      .select("*")
      .eq("id", booking.cancellation_policy_id)
      .limit(1)
      .maybeSingle();

    if (!policy) {
      return new Response("Policy not found", { status: 400 });
    }

    const now = new Date();
    const pickup = new Date(booking.pickup_time);
    const deltaHours = (pickup.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundRate = 0;

    if (reason === "driver_fault") {
      refundRate = policy.driver_fault_refund_rate;
    } else if (reason === "no_show") {
      refundRate = policy.no_show_refund_rate;
    } else if (deltaHours >= policy.hours_before_full_refund) {
      refundRate = 1;
    } else if (deltaHours >= policy.hours_before_partial_refund) {
      refundRate = policy.partial_refund_rate;
    }

    const refundAmount = booking.total_amount * refundRate;

    // 3️⃣ Cas sans remboursement
    if (refundAmount <= 0) {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "cancelled_no_refund",
          cancellation_reason: reason,
          cancelled_at: now.toISOString(),
        })
        .eq("id", booking_id)
        .eq("status", "paid");

      if (error) {
        return new Response("Cancellation failed", { status: 400 });
      }

      return new Response(JSON.stringify({ refund: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4️⃣ 🔒 Verrou transactionnel via RPC
    const { data: lockData, error: lockError } = await supabase.rpc(
      "initiate_refund",
      {
        p_booking_id: booking_id,
        p_reason: reason,
      },
    );

    if (lockError || !lockData || !lockData[0]?.refund_allowed) {
      return new Response("Refund not allowed", { status: 400 });
    }

    const paymentIntentId = lockData[0].payment_intent_id;

    // 5️⃣ Appel Stripe sécurisé
    try {
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
      });

      return new Response(
        JSON.stringify({ success: true, refund: refundAmount }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      await supabase
        .from("bookings")
        .update({ status: "refund_failed" })
        .eq("id", booking_id);

      console.error("Stripe refund error:", err);
      return new Response("Stripe refund failed", { status: 500 });
    }
  } catch (err) {
    console.error("Handler error:", err);
    return new Response(String(err), { status: 500 });
  }
});
