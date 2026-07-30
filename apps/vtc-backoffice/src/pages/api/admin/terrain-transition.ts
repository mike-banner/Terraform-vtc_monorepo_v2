// /home/mike/projects/vtc/vtc_mvp/src/pages/api/admin/terrain-transition.ts
import type { APIRoute } from "astro";
import { requirePlatformAdmin } from "../../../lib/guards/platform";
import { createAdminClient } from "../../../lib/supabase/server";

type TerrainAction = "en_route" | "on_board" | "completed";

const TERRAIN_TAGS: Record<TerrainAction, string> = {
  en_route: "en_route_at",
  on_board: "on_board_at",
  completed: "completed_at",
};

const isTerminalStatus = (status: string | null | undefined): boolean => {
  return (
    status === "completed" ||
    status === "cancelled" ||
    status === "cancelled_pending_refund" ||
    status === "cancelled_refunded" ||
    status === "cancelled_no_refund" ||
    status === "refund_failed" ||
    status === "no_show"
  );
};

const toIsoUtc = (d: Date): string => d.toISOString();

const jsonResponse = (payload: unknown, status: number): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { profile } = locals as any;
    try {
      await requirePlatformAdmin(profile);
    } catch {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await request.json()) as {
      booking_id?: string;
      action?: TerrainAction;
    };

    const bookingId = body.booking_id;
    const action = body.action;

    if (!bookingId || !action || !(action in TERRAIN_TAGS)) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const supabaseAdmin = createAdminClient();

    const { data: booking, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select("id, status, pickup_time, mission_note")
      .eq("id", bookingId)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return jsonResponse({ error: fetchError.message }, 500);
    }
    if (!booking) {
      return jsonResponse({ error: "Booking not found" }, 404);
    }

    if (isTerminalStatus(booking.status)) {
      return jsonResponse({ error: "Booking not mutable" }, 409);
    }

    // ⛔ Verrouillage H-15 pour l'action "en_route"
    if (action === "en_route") {
      const pickupTimeMs = new Date(booking.pickup_time).getTime();
      const availableAtMs = pickupTimeMs - 15 * 60 * 1000;
      const nowMs = Date.now();
      if (Number.isFinite(pickupTimeMs) && nowMs < availableAtMs) {
        return jsonResponse(
          { error: "Too early", available_at: new Date(availableAtMs).toISOString() },
          400,
        );
      }
    }

    const nowIso = toIsoUtc(new Date());
    const marker = `[terrain] ${TERRAIN_TAGS[action]}=${nowIso}`;

    const currentNotes = (booking.mission_note ?? "").toString();
    const alreadyMarked = currentNotes.includes(`[terrain] ${TERRAIN_TAGS[action]}=`);
    const nextNotes = alreadyMarked ? currentNotes : `${currentNotes}${currentNotes ? "\n" : ""}${marker}`;

    const updatePayload: Record<string, unknown> = {
      mission_note: nextNotes,
    };

    if (action === "completed") {
      updatePayload.status = "completed";
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId)
      .select("id, status, notes")
      .limit(1)
      .maybeSingle();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ success: true, booking: updated }, 200);
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
};

