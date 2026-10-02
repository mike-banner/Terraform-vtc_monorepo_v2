import { defineMiddleware } from "astro:middleware";
import { supabase } from "./core/supabase";
import { resolveTenant } from "./core/tenant";
import { configDuSite } from "./core/site-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La table `tenants` n'est plus lisible par `anon` : RPC `get_public_tenant` (colonnes publiques).
async function tenantParId(hostname: string, id: string) {
  try {
    const { data, error } = await supabase.rpc("get_public_tenant", { p_host: hostname, p_id: id }).maybeSingle();
    if (error) console.error("[Middleware] Error resolving tenant by ID:", error);
    return data ?? null;
  } catch (e) {
    console.error("[Middleware] Error resolving tenant by ID:", e);
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const host = url.host; // ex: "exemple.invalid" ou "localhost:4321"
  const hostname = url.hostname; // ex: "exemple.invalid" ou "localhost"

  if (!context.locals.tenant) {
    let resolvedTenant = null;
    const site = configDuSite(host);

    // 1. Par domaine (host)
    try {
      resolvedTenant = await resolveTenant(host);
      // Sans le port si non trouvé (ex: localhost)
      if (!resolvedTenant && host !== hostname) {
        resolvedTenant = await resolveTenant(hostname);
      }
    } catch (e) {
      console.error("[Middleware] Error resolving tenant by domain:", e);
    }

    // 2. Par le tenantId de la configuration du site (D-30)
    if (!resolvedTenant && UUID.test(site.tenantId)) {
      resolvedTenant = await tenantParId(hostname, site.tenantId);
    }

    // 3. Développement local seulement : pile Supabase locale, l'identifiant du tenant de test diffère de celui
    //    de la configuration ; jamais compilé dans un build.
    if (import.meta.env.DEV) {
      const devId = import.meta.env.PUBLIC_TENANT_ID;
      if (!resolvedTenant && devId) resolvedTenant = await tenantParId(hostname, devId);
    }

    // 4. Repli neutre : nom de la configuration du site, sinon rien (évite un 500)
    if (!resolvedTenant) {
      console.warn(`[Middleware] No tenant found for host ${host}. Using neutral fallback.`);
      resolvedTenant = { id: "", name: site.nom, primary_domain: host, logo_url: null };
    }

    context.locals.tenant = resolvedTenant;
  }

  return next();
});
