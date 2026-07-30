// src/pages/api/tenant/update-booking-status.ts
import type { APIRoute } from "astro";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * API pour mettre à jour le statut d'une course
 * Sécurisé par tenant_id pour éviter les modifications croisées
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { booking_id, new_status } = await request.json();
    const { user, profile } = locals as any;

    if (!user || !profile) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = createAdminClient(locals);

    // Mise à jour sécurisée : on vérifie que la course appartient bien au tenant du profil
    const { error } = await supabase
      .from("bookings")
      .update({ status: new_status })
      .eq("id", booking_id)
      .eq("current_tenant_id", profile.tenant_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
