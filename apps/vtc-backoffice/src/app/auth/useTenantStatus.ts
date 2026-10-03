import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/** Lecture du tenant (statut, nom, installation) ; refetch au premier plan par défaut. */
export function useTenant(tenantId: string | null) {
  return useQuery({
    queryKey: ["tenant", tenantId, "status"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("name, status, setup_completed").eq("id", tenantId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Tenant suspendu : déconnexion immédiate (le middleware ne le voit qu'au prochain chargement complet). */
export function useTenantStatus(tenantId: string | null) {
  const q = useTenant(tenantId);
  const suspended = q.data?.status === "suspended";
  useEffect(() => {
    if (!suspended) return;
    void supabase.auth.signOut().finally(() => window.location.assign("/login?reason=suspended"));
  }, [suspended]);
  return q;
}
