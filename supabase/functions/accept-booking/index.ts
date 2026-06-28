import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();

    const { booking_id, driver_id } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. update booking

    const { data, error } = await supabase
      .from("bookings")
      .update({
        driver_id,
        status: "accepted",
        mission_status: "not_started",
      })
      .eq("id", booking_id)
      .eq("status", "paid")
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
      });
    }

    // 2. TODO send email later

    console.log("BOOKING ACCEPTED", data.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
