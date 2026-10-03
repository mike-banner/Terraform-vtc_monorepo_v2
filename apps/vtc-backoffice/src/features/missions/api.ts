import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import { bookingKeys } from "@/features/bookings/keys";

export type ActiveMission = { id: string; dropoff_address: string; pickup_time: string; mission_note: string | null };

/** Seule voie de changement de mission_status côté navigateur (RPC gardée, bornes vérifiées serveur). */
export const terrainTransition = (p: { bookingId: string; action: string; correctedAt?: string }) =>
  rpc<string | null>("terrain_transition", {
    p_booking_id: p.bookingId,
    p_action: p.action,
    p_corrected_at: p.correctedAt,
  });

/** Course en cours du chauffeur connecté (fiche drivers liée à l'utilisateur) ; null sinon. */
export function useActiveMission(userId: string | undefined, tenantId: string | null | undefined) {
  return useQuery({
    queryKey: [...bookingKeys.all, "active-mission", userId],
    enabled: !!userId && !!tenantId,
    queryFn: async (): Promise<ActiveMission | null> => {
      const { data: driver } = await supabase.from("drivers").select("id").eq("user_id", userId!).eq("tenant_id", tenantId!).limit(1).maybeSingle();
      if (!driver) return null;
      const { data } = await supabase
        .from("bookings")
        .select("id, dropoff_address, pickup_time, mission_note")
        .eq("driver_id", driver.id)
        .eq("mission_status", "in_progress")
        .order("pickup_time", { ascending: true })
        .limit(1);
      return data?.[0] ?? null;
    },
  });
}
