import { supabase } from "@/lib/supabase/client";
import { analyserCommunes, type AnalyseCommunes } from "@/lib/geo-communes.mjs";

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
