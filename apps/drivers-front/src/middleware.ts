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
    if (!resolvedTenant && tenantId) {
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .single();
        if (data) {
          resolvedTenant = data;
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
        primary_domain: "localhost:4321",
        theme: "luxury",
        platform_fee_rate: 0.1,
        created_at: new Date().toISOString(),
      };
    }

    context.locals.tenant = resolvedTenant;
  }

  return next();
});
