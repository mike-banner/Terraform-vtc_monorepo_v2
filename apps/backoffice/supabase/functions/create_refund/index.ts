import Stripe from "https://esm.sh/stripe@12.18.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-02-25.clover",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const { booking_id } = await req.json();

  if (!booking_id) {
    return new Response("Missing booking_id", { status: 400 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .single();

  if (!booking || booking.status !== "paid") {
    return new Response("Invalid booking state", { status: 400 });
  }

  const refund = await stripe.refunds.create({
    payment_intent: booking.stripe_payment_intent_id,
  });

  return new Response(JSON.stringify({ refund_id: refund.id }), {
    status: 200,
  });
});