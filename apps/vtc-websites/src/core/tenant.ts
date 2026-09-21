import { supabase } from "./supabase";

export async function resolveTenant(host: string) {
  // En dev, on peut forcer un domaine ou utiliser l'ID du .env via le middleware.
  // Passe par la RPC `get_public_tenant` (SECURITY DEFINER) : la table `tenants`
  // n'est plus lisible par `anon` (cf. migration security_hardening).
  const { data, error } = await supabase
    .rpc("get_public_tenant", { p_host: host })
    .maybeSingle();

  if (error || !data) {
    console.error("Tenant not found for host:", host);
    return null;
  }

  return data;
}
