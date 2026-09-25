// src/lib/guards.ts

export type TenantRole = "owner" | "manager" | "driver";

/**
 * Vérifie si le profil est un administrateur plateforme
 */
const PLATFORM_ROLES = ["super_admin", "platform_staff"];

export function isPlatform(profile: any) {
  return PLATFORM_ROLES.includes(profile?.platform_role);
}
/**
 * Vérifie si le profil appartient à un tenant
 */
export function isTenant(profile: any) {
  return !!profile?.tenant_id;
}

/**
 * Vérifie les permissions au sein d'un tenant
 */
export function requireTenantRole(profile: any, allowed: TenantRole[]) {
  if (!profile?.tenant_role || !allowed.includes(profile.tenant_role)) {
    throw new Error("Access denied: Insufficient permissions");
  }
}

/**
 * Utilitaire booléen pour l'UI
 */
export function hasTenantRole(profile: any, allowed: TenantRole[]): boolean {
  return !!(profile?.tenant_role && allowed.includes(profile.tenant_role));
}

/**
 * Politique d'accès par route, appliquée dans `middleware.ts` pour `/app/*` et
 * `/api/tenant/*`. Un seul endroit décide : poser le guard page par page laissait
 * les routes API à découvert (un `driver` pouvait appeler `api/tenant/update-settings`
 * alors que `app/settings.astro` lui était interdit).
 *
 * Deny-by-default : un chemin absent de cette table est refusé. Une nouvelle page
 * ou route doit s'y déclarer — `scripts/check-route-policy.mjs` le vérifie en CI,
 * pour qu'un oubli soit un échec de build et non une faille silencieuse.
 */
const ALL_TENANT_ROLES: TenantRole[] = ["owner", "manager", "driver"];

export const ROUTE_POLICY: Record<string, TenantRole[]> = {
  // --- Pages ---
  "/app/dashboard": ALL_TENANT_ROLES,
  "/app/bookings": ALL_TENANT_ROLES,
  "/app/profile": ALL_TENANT_ROLES,
  "/app/vehicles": ["owner", "manager"],
  "/app/pricing": ["owner", "manager"],
  "/app/ledger": ["owner", "manager"],
  "/app/settings": ["owner"],
  "/app/setup": ["owner"],

  // --- Routes API ---
  // Lecture/écriture des courses : le chauffeur en a besoin en exploitation.
  // Le périmètre des données reste filtré par `.eq("driver_id", …)` dans bookings.ts
  // et search-bookings.ts — cette table contrôle l'accès, pas le périmètre.
  "/api/tenant/bookings": ALL_TENANT_ROLES,
  "/api/tenant/search-bookings": ALL_TENANT_ROLES,
  "/api/tenant/booking-actions": ALL_TENANT_ROLES,
  "/api/tenant/update-booking-status": ALL_TENANT_ROLES,
  "/api/tenant/create-booking": ["owner", "manager"],
  "/api/tenant/export-csv": ["owner", "manager"],
  "/api/tenant/update-settings": ["owner"],
  "/api/tenant/update-logo": ["owner"],
};

/**
 * Rôles autorisés sur un chemin, ou `undefined` si le chemin n'est pas couvert
 * (l'appelant doit alors refuser — voir deny-by-default ci-dessus).
 */
export function allowedRolesFor(pathname: string): TenantRole[] | undefined {
  // Normalise le slash final et l'extension .astro éventuelle du routage Astro.
  const path = pathname.replace(/\/+$/, "") || "/";
  return ROUTE_POLICY[path];
}

/** `true` si le chemin relève de la politique tenant (pages app + API tenant). */
export function isTenantScopedPath(pathname: string): boolean {
  return pathname.startsWith("/app") || pathname.startsWith("/api/tenant");
}
