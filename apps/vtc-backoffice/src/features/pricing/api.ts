import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import { analyserCommunes, type AnalyseCommunes } from "@/lib/geo-communes.mjs";
import type { Database } from "@vtc/database";
import type { CancellationPolicyValues, RuleValues } from "./schema";

// --- ZONES ---
export const getZones = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return data;
};

export const createZone = async (
  tenantId: string,
  name: string,
  postalCodes: string[] = [],
) => {
  const { data, error } = await supabase
    .from("zones")
    .insert([{ tenant_id: tenantId, name, postal_codes: postalCodes }])
    .select()
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateZonePostalCodes = async (id: string, codes: string[]) => {
  const { data, error } = await supabase
    .from("zones")
    .update({ postal_codes: codes })
    .eq("id", id)
    .select();
  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new Error("Modification refusée : vous n'avez pas le droit de modifier cette zone.");
  }
  return data[0];
};

// Aide à la saisie : null = service indisponible, [] = aucune commune au nom exact.
export const proposerCodesPostaux = async (
  nomZone: string,
): Promise<AnalyseCommunes | null> => {
  try {
    const url =
      "https://geo.api.gouv.fr/communes?nom=" +
      encodeURIComponent(nomZone) +
      "&fields=nom,codesPostaux,departement,population&boost=population&limit=8";
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return analyserCommunes(nomZone, await res.json());
  } catch {
    return null;
  }
};

// --- FIXED ROUTES ---
export const getFixedRoutes = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("fixed_routes")
    .select(
      "*, pickup_zone:pickup_zone_id(name), dropoff_zone:dropoff_zone_id(name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const createFixedRoute = async (route: {
  tenant_id: string;
  pickup_zone_id: string;
  dropoff_zone_id: string;
  vehicle_category: string;
  price: number;
  is_bidirectional?: boolean;
}) => {
  const { data, error } = await supabase
    .from("fixed_routes")
    .insert([route])
    .select()
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateFixedRoute = async (
  id: string,
  route: Partial<{
    pickup_zone_id: string;
    dropoff_zone_id: string;
    vehicle_category: string;
    price: number;
    is_bidirectional: boolean;
  }>,
) => {
  const { data, error } = await supabase
    .from("fixed_routes")
    .update(route)
    .eq("id", id)
    .select()
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteFixedRoute = async (id: string) => {
  const { error } = await supabase.from("fixed_routes").delete().eq("id", id);
  if (error) throw error;
};

// --- RÈGLES STANDARD ---
export type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
export type CancellationPolicy = Database["public"]["Tables"]["cancellation_policies"]["Row"];

export const pricingKeys = {
  rules: (tenantId: string) => ["pricing", "rules", tenantId] as const,
  policy: (tenantId: string) => ["pricing", "policy", tenantId] as const,
};

export async function listRules(tenantId: string): Promise<PricingRule[]> {
  const { data, error } = await supabase.from("pricing_rules").select("*").eq("tenant_id", tenantId).order("service_category", { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveRule(tenantId: string, id: string | undefined, v: RuleValues): Promise<void> {
  const payload = { ...v, tenant_id: tenantId, service_category: v.service_category.toUpperCase() };
  const { error } = id ? await supabase.from("pricing_rules").update(payload).eq("id", id) : await supabase.from("pricing_rules").insert(payload);
  if (error) throw error;
}

export async function getActivePolicy(tenantId: string): Promise<CancellationPolicy | null> {
  const { data, error } = await supabase.from("cancellation_policies").select("*").eq("tenant_id", tenantId).eq("active", true).maybeSingle();
  if (error) throw error;
  return data;
}

/** Owner seulement (garde dans la RPC). Les pourcentages saisis deviennent des taux 0-1 : simple changement d'unité, aucun montant calculé. */
export async function updateCancellationPolicy(v: CancellationPolicyValues): Promise<void> {
  await rpc("update_cancellation_policy", {
    p_full_hours: v.full_hours,
    p_partial_hours: v.partial_hours,
    p_partial_rate: v.partial_rate / 100,
    p_no_show_rate: v.no_show_rate / 100,
    p_driver_fault_rate: v.driver_fault_rate / 100,
  });
}

export const useRules = (tenantId: string) => useQuery({ queryKey: pricingKeys.rules(tenantId), queryFn: () => listRules(tenantId) });
export const usePolicy = (tenantId: string) => useQuery({ queryKey: pricingKeys.policy(tenantId), queryFn: () => getActivePolicy(tenantId) });

export function useSaveRule(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id?: string; values: RuleValues }) => saveRule(tenantId, a.id, a.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.rules(tenantId) }),
  });
}

export function useUpdatePolicy(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: updateCancellationPolicy, onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.policy(tenantId) }) });
}
