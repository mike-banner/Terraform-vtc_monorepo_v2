import type { APIRoute } from "astro";
import { supabase } from "../../core/supabase";

// Notation publique (D-09/D-10 Phase 14) : clé anon, toute la validation est dans la RPC submit_rating.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const bookingId = body?.bookingId;
  const rating = Number.parseInt(body?.rating, 10);
  if (!bookingId || !rating) return json({ error: "Données manquantes" }, 400);
  const comment = typeof body.comment === "string" ? body.comment : null;
  const { error } = await supabase.rpc("submit_rating", { p_booking_id: bookingId, p_rating: rating, p_comment: comment });
  if (error) {
    const status = error.code === "P0002" || error.code === "22P02" ? 404 : error.code === "22023" ? 400 : 500;
    return json({ error: status === 404 ? "Réservation non trouvée" : error.message }, status);
  }
  return json({ success: true }, 200);
};

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
