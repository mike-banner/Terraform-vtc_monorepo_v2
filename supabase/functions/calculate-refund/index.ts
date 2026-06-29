import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { booking_id, cancelled_at, reason } = await req.json();

  if (!booking_id || !cancelled_at || !reason) {
    return new Response("Missing params", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1️⃣ Load booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .maybeSingle();

  if (bookingError || !booking) {
    return new Response("Booking not found", { status: 404 });
  }

  // 🔒 Only calculable if paid or refund_failed
  if (!["paid", "refund_failed"].includes(booking.status)) {
    return new Response("Refund not allowed for this status", { status: 400 });
  }

  if (!booking.cancellation_policy_id) {
    return new Response("Missing cancellation policy", { status: 400 });
  }

  // 2️⃣ Load policy
  const { data: policy, error: policyError } = await supabase
    .from("cancellation_policies")
    .select("*")
    .eq("id", booking.cancellation_policy_id)
    .maybeSingle();

  if (policyError || !policy) {
    return new Response("Policy not found", { status: 400 });
  }

  const pickupTime = new Date(booking.pickup_time);
  const cancelTime = new Date(cancelled_at);

  if (isNaN(cancelTime.getTime())) {
    return new Response("Invalid cancellation date", { status: 400 });
  }

  const deltaHours =
    (pickupTime.getTime() - cancelTime.getTime()) / (1000 * 60 * 60);

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

  // Clamp sécurité
  if (refundRate < 0) refundRate = 0;
  if (refundRate > 1) refundRate = 1;

  const refundAmount = Number(booking.total_amount) * refundRate;

  return new Response(
    JSON.stringify({
      refund_rate: refundRate,
      refund_amount: refundAmount,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
