import { defineMiddleware } from "astro:middleware";
import { supabase } from "./core/supabase";
import { resolveTenant } from "./core/tenant";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const host = url.host; // ex: "elite-lyon.fr" ou "localhost:4321"
  const hostname = url.hostname; // ex: "elite-lyon.fr" ou "localhost"
  const tenantId = import.meta.env.PUBLIC_TENANT_ID;

  console.log(`[Middleware] Resolving Tenant for host: ${host} (hostname: ${hostname}), env tenantId: ${tenantId}`);

  if (!context.locals.tenant) {
    let resolvedTenant = null;

    // 1. Résolution dynamique par domaine (host)
    try {
      resolvedTenant = await resolveTenant(host);
      
      // Fallback sans le port si non trouvé (ex: localhost)
      if (!resolvedTenant && host !== hostname) {
        resolvedTenant = await resolveTenant(hostname);
      }
    } catch (e) {
      console.error("[Middleware] Error resolving tenant by domain:", e);
    }

    // 2. Résolution fallback par ID du .env
    //    La table `tenants` n'est plus lisible par `anon` : on passe par la RPC
    //    `get_public_tenant` qui n'expose que les colonnes publiques.
    if (!resolvedTenant && tenantId) {
      try {
        const { data, error } = await supabase
          .rpc("get_public_tenant", { p_host: hostname, p_id: tenantId })
          .maybeSingle();
        if (data) {
          resolvedTenant = data;
        } else if (error) {
          console.error("[Middleware] Error resolving tenant by env ID:", error);
        }
      } catch (e) {
        console.error("[Middleware] Error resolving tenant by env ID:", e);
      }
    }

    // 3. Fallback ultime pour éviter les erreurs de rendu (crash 500)
    if (!resolvedTenant) {
      console.warn(`[Middleware] No tenant found for host ${host} or ID ${tenantId}. Using default fallback.`);
      resolvedTenant = {
        id: tenantId || "default-id",
        name: "Elite Lyon",
        primary_domain: host,
        logo_url: null,
      };
    }

    context.locals.tenant = resolvedTenant;
  }

  return next();
});
