import { supabase } from "./supabase";

export async function getPricing(tenantId: string) {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (error) {
    console.error("Error fetching pricing rules:", error);
    return [];
  }

  return data;
}
