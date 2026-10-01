// src/pages/api/missions/terrain-transition.ts
import type { APIRoute } from "astro";
import { rpcErrorStatus } from "@/lib/rpc-error";

// Proxy mince (D-01 Phase 14) : garde de rôle, H-15, idempotence et encaissement dans la RPC terrain_transition.
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.profile) return new Response("Unauthorized", { status: 401 });
  const { booking_id, action, corrected_at } = await request.json().catch(() => ({}));
  if (!booking_id || !action) return json({ error: "Invalid payload" }, 400);
  // Date corrigée invalide ignorée, comme avant.
  const corrected = corrected_at && !Number.isNaN(Date.parse(corrected_at)) ? new Date(corrected_at).toISOString() : undefined;
  const { data, error } = await locals.supabase.rpc("terrain_transition", {
    p_booking_id: booking_id,
    p_action: action,
    p_corrected_at: corrected,
  });
  if (error) {
    if (error.message === "Too early") return json({ error: "Too early", available_at: error.details }, 400);
    return json({ error: error.message }, rpcErrorStatus(error.code));
  }
  return json({ success: true, mission_note: data }, 200);
};

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
