// src/pages/api/tenant/booking-actions.ts
// Actions exclusives chauffeur pré-mission : annulation (avec motif) + modification horaires/adresses.
// La Edge Function cancel-booking gère le remboursement Stripe côté admin/plateforme.
import type { APIRoute } from "astro";
import { calculatePrice, findPricingRule } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";

type Action = "cancel" | "update";

const PRE_MISSION_STATES = ["to_validate", "not_started"];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { action, booking_id } = body as { action: Action; booking_id: string };
    const { user, profile } = locals as any;

    if (!user || !profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    if (!booking_id || !action) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400 });
    }

    const supabase = createAdminClient(locals);

    // Fetch + vérification tenant
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, status, mission_status, mission_note, booking_type, vehicle_id, distance_km, duration_hours, total_amount, subtotal_amount")
      .eq("id", booking_id)
      .eq("current_tenant_id", profile.tenant_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404 });
    }

    if (!PRE_MISSION_STATES.includes(booking.mission_status ?? "")) {
      return new Response(
        JSON.stringify({ error: "Action impossible : mission déjà démarrée ou terminée" }),
        { status: 400 },
      );
    }

    // ── ACTION : ANNULATION CHAUFFEUR ─────────────────────────────────────────
    if (action === "cancel") {
      const { reason } = body as { reason?: string };

      if (!reason?.trim()) {
        return new Response(
          JSON.stringify({ error: "Motif d'annulation requis (convention VTC)" }),
          { status: 400 },
        );
      }

      // Financier : payée → remboursement en attente (traité par l'admin via cancel-booking Edge Fn)
      const newStatus = booking.status === "paid" ? "cancelled_pending_refund" : "cancelled_no_refund";

      const reasonMarker = `[annulation] initiateur=chauffeur | motif=${reason.trim()}`;
      const existingNote = (booking.mission_note ?? "").toString();
      const newNote = existingNote ? `${existingNote}\n${reasonMarker}` : reasonMarker;

      const { error } = await supabase
        .from("bookings")
        .update({
          status: newStatus,
          cancelled_at: new Date().toISOString(),
          cancellation_initiator: "driver",
          mission_note: newNote,
        })
        .eq("id", booking_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, new_status: newStatus }), { status: 200 });
    }

    // ── ACTION : MODIFICATION ─────────────────────────────────────────────────
    if (action === "update") {
      const { pickup_time, pickup_address, dropoff_address, distance_km, duration_hours } =
        body as {
          pickup_time?: string;
          pickup_address?: string;
          dropoff_address?: string;
          distance_km?: number;
          duration_hours?: number;
        };

      if (!pickup_time || !pickup_address) {
        return new Response(
          JSON.stringify({ error: "Date/heure et adresse de départ requis" }),
          { status: 400 },
        );
      }

      // Recalcul tarifaire côté serveur
      let newTotal = Number(booking.total_amount);
      let newSubtotal = Number(booking.subtotal_amount);

      if (booking.vehicle_id) {
        const [{ data: vehicle }, { data: pricingRules }] = await Promise.all([
          supabase.from("vehicles").select("category").eq("id", booking.vehicle_id).maybeSingle(),
          supabase.from("pricing_rules").select("*").eq("tenant_id", profile.tenant_id).eq("active", true),
        ]);

        const rule = vehicle?.category ? findPricingRule(pricingRules ?? [], vehicle.category) : null;

        if (rule) {
          const effectiveKm = distance_km !== undefined ? Number(distance_km) : Number(booking.distance_km ?? 0);
          const effectiveHours = duration_hours !== undefined ? Number(duration_hours) : Number(booking.duration_hours ?? 1);

          const calculated = calculatePrice({
            bookingType: booking.booking_type === "hourly" ? "hourly" : "transfer",
            distanceKm: effectiveKm,
            durationHours: effectiveHours,
            rule,
          });

          if (calculated > 0) {
            newTotal = calculated;
            newSubtotal = calculated;
          }
        }
      }

      const updatePayload: Record<string, unknown> = {
        pickup_time,
        pickup_address,
        total_amount: newTotal,
        subtotal_amount: newSubtotal,
      };

      if (dropoff_address !== undefined) updatePayload.dropoff_address = dropoff_address;
      if (distance_km !== undefined) updatePayload.distance_km = Number(distance_km);
      if (duration_hours !== undefined) updatePayload.duration_hours = Number(duration_hours);

      const { error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", booking_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, new_total: newTotal }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400 });
  } catch (err: any) {
    console.error("[booking-actions]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Erreur serveur" }), { status: 500 });
  }
};
