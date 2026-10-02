// src/pages/api/tenant/booking-actions.ts
// Proxy vers les RPC mark_booking_no_show / update_booking_details : garde de rôle, états autorisés
// et recalcul du prix vivent en base. L'annulation passe par l'Edge Function cancel-booking
// (RPC cancel_booking avec le JWT de l'appelant, puis remboursement Stripe).
import type { APIRoute } from "astro";
import { rpcErrorStatus } from "@/lib/rpc-error";

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ request, locals }) => {
  const { user, profile } = locals;
  if (!user || !profile?.tenant_id) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const { action, booking_id } = body;
  if (!booking_id || !action) return json({ error: "Paramètres manquants" }, 400);

  if (action === "no_show") {
    const { data, error } = await locals.supabase.rpc("mark_booking_no_show", {
      p_booking_id: booking_id,
      p_reason: body.reason ?? "",
    });
    if (error) return json({ error: error.message }, rpcErrorStatus(error.code));
    return json({ success: true, new_status: data }, 200);
  }

  if (action === "update") {
    const { data, error } = await locals.supabase.rpc("update_booking_details", {
      p_booking_id: booking_id,
      p_pickup_time: body.pickup_time,
      p_pickup_address: body.pickup_address,
      p_dropoff_address: body.dropoff_address ?? undefined,
      p_distance_km: body.distance_km ?? undefined,
      p_duration_hours: body.duration_hours ?? undefined,
      p_manual_total: body.manual_total ?? undefined,
    });
    if (error) return json({ error: error.message }, rpcErrorStatus(error.code));
    return json({ success: true, new_total: data }, 200);
  }

  return json({ error: "Action inconnue" }, 400);
};
