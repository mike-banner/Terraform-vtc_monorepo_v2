import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@vtc/database";
import type { DriverValues } from "./schema";

export type Driver = Database["public"]["Tables"]["drivers"]["Row"];

export const driverKeys = { all: (tenantId: string) => ["drivers", tenantId] as const };

export async function listDrivers(tenantId: string): Promise<Driver[]> {
  const { data, error } = await supabase.from("drivers").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDriver(tenantId: string, v: DriverValues): Promise<void> {
  const { error } = await supabase.from("drivers").insert({ ...v, tenant_id: tenantId });
  if (error) throw error;
}

export async function updateDriver(id: string, v: Partial<DriverValues>): Promise<void> {
  const { error } = await supabase.from("drivers").update(v).eq("id", id);
  if (error) throw error;
}

export async function deleteDriver(id: string): Promise<void> {
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw error;
}

/** Crée la fiche du titulaire à partir de son inscription (onboarding), s'il n'en a pas encore. */
export async function initializePrimaryDriver(tenantId: string, userId: string): Promise<void> {
  const { count, error: ce } = await supabase.from("drivers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (ce) throw ce;
  if (count && count > 0) throw new Error("Un chauffeur existe déjà.");
  const { data: o, error: oe } = await supabase
    .from("onboarding")
    .select("first_name, last_name, phone, vtc_license_number")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (oe) throw oe;
  if (!o) throw new Error("Données d'inscription introuvables. Complétez votre profil.");
  const { error } = await supabase
    .from("drivers")
    .insert({ tenant_id: tenantId, first_name: o.first_name, last_name: o.last_name, phone: o.phone, license_number: o.vtc_license_number, user_id: userId });
  if (error) throw error;
}

export const useDrivers = (tenantId: string | null | undefined) =>
  useQuery({ queryKey: driverKeys.all(tenantId ?? ""), enabled: !!tenantId, queryFn: () => listDrivers(tenantId!) });

/** Fiche du chauffeur connecté ; repli sur la première fiche non liée du tenant (inscriptions anciennes). */
export const useOwnDriver = (tenantId: string | null | undefined, userId: string | undefined) =>
  useQuery({
    queryKey: [...driverKeys.all(tenantId ?? ""), "own", userId],
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<Driver | null> => {
      const own = await supabase.from("drivers").select("*").eq("user_id", userId!).maybeSingle();
      if (own.error) throw own.error;
      if (own.data) return own.data;
      const fb = await supabase.from("drivers").select("*").eq("tenant_id", tenantId!).is("user_id", null).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (fb.error) throw fb.error;
      return fb.data;
    },
  });

export function useDriverMutation<A>(tenantId: string, fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: driverKeys.all(tenantId) }) });
}
