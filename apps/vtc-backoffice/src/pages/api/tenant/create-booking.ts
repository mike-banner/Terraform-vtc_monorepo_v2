// src/pages/api/tenant/create-booking.ts
// Proxy vers la RPC create_manual_booking (Phase 14) : client, prix, TVA et course
// sont calculés et insérés côté base, dans une transaction, avec la session de l'utilisateur.
import type { APIRoute } from "astro";
import { rpcErrorStatus } from "@/lib/rpc-error";

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ request, locals }) => {
  const { user, profile } = locals;
  if (!user || !profile) return json({ error: "Unauthorized" }, 401);

  const {
    pickup, dropoff, distance_km, pickup_time, client_name, client_email, payment_mode,
    manual_total, booking_type, duration_hours, passenger_count, luggage_count, vehicle_id,
  } = await request.json().catch(() => ({}));

  const { data, error } = await locals.supabase
    .rpc("create_manual_booking", {
      p_pickup: pickup,
      p_dropoff: dropoff ?? undefined,
      p_pickup_time: pickup_time,
      p_client_name: client_name ?? "",
      p_client_email: client_email ?? "",
      p_payment_mode: payment_mode || "cash",
      p_manual_total: manual_total ? Number(manual_total) : undefined,
      p_booking_type: booking_type || "transfer",
      p_distance_km: distance_km ? Number(distance_km) : undefined,
      p_duration_hours: duration_hours ? Number(duration_hours) : undefined,
      p_passenger_count: Number(passenger_count || 1),
      p_luggage_count: Number(luggage_count || 0),
      p_vehicle_id: vehicle_id || undefined,
    })
    .single();

  if (error) return json({ error: error.message }, rpcErrorStatus(error.code));
  const row = data as { booking_id: string; total_price: number };
  return json({ success: true, booking_id: row.booking_id, total_price: row.total_price }, 200);
};
