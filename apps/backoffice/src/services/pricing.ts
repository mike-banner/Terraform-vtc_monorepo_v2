import { supabase } from "@/lib/supabase/client";

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

export const createZone = async (tenantId: string, name: string) => {
  const { data, error } = await supabase
    .from("zones")
    .insert([{ tenant_id: tenantId, name }])
    .select()
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
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
