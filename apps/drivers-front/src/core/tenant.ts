import { supabase } from "./supabase";

export async function resolveTenant(host: string) {
  // En dev, on peut forcer un domaine ou utiliser l'ID du .env via le middleware
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("primary_domain", host)
    .single();

  if (error || !data) {
    console.error("Tenant not found for host:", host);
    return null;
  }

  return data;
}
