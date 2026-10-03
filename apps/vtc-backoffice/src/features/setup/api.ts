import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import { useRules } from "@/features/pricing/api";
import { useVehicles } from "@/features/vehicles/api";
import { isSetupComplete, type SetupData } from "./prerequisites";
import type { LegalPayload } from "./schema";

export const setupKey = (tenantId: string) => ["tenant", tenantId, "setup"] as const;

/** Enregistre l'identité légale seule (le véhicule et le tarif passent par leurs formulaires) ; la RPC valide et refuse un second appel. */
export const completeTenantSetup = (legal: LegalPayload) =>
  rpc<void>("complete_tenant_setup", { p_legal: legal, p_vehicle: {}, p_pricing: {} });

export function useCompleteTenantSetup(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeTenantSetup,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["tenant", tenantId] }), qc.invalidateQueries({ queryKey: ["drivers", tenantId] }), qc.invalidateQueries({ queryKey: ["setup-driver", tenantId] })]),
  });
}

/** Tenant + fiche chauffeur de l'utilisateur ; véhicules et règles réutilisent le cache des pages véhicules et tarifs. */
export function useSetupData(tenantId: string | null, userId: string | null) {
  const tenant = useQuery({
    queryKey: setupKey(tenantId ?? ""),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("setup_completed, address_line, postal_code, city, stripe_account_id, legal_form, vat_number, is_vat_exempt")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const driver = useQuery({
    queryKey: ["setup-driver", tenantId, userId],
    enabled: !!tenantId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("id").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const vehicles = useVehicles(tenantId);
  const rules = useRules(tenantId ?? "");
  const loading = tenant.isLoading || driver.isLoading || vehicles.isLoading || rules.isLoading;
  const data: SetupData | null =
    tenant.data && vehicles.data && rules.data && driver.data !== undefined
      ? { tenant: tenant.data, vehicles: vehicles.data, rules: rules.data, hasDriverProfile: driver.data }
      : null;
  return { data, loading, tenant: tenant.data ?? null, complete: data ? isSetupComplete(data) : null };
}
