// src/lib/guards.ts

export type TenantRole = "owner" | "manager" | "driver";

/**
 * Vérifie si le profil appartient à un tenant
 */
export function isTenant(profile: any) {
  return !!profile?.tenant_id;
}

/**
 * Politique d'accès par route, appliquée dans `middleware.ts` pour `/app/*` et
 * `/api/tenant/*`. Un seul endroit décide. Périmètre restant : les pages de
 * l'application React et les deux exports (jusqu'à la phase 17).
 *
 * Deny-by-default : un chemin absent de cette table est refusé. Une nouvelle page
 * ou route doit s'y déclarer — `scripts/check-route-policy.mjs` le vérifie en CI,
 * pour qu'un oubli soit un échec de build et non une faille silencieuse.
 *
 * Depuis la Phase 13, les droits par rôle sont portés par la RLS
 * (migration 20260929100100_tenant_role_policies.sql, testée par
 * supabase/lint/rls_role_checks.sql). Pour les pages et les accès directs
 * Supabase (vehicles, pricing, chauffeurs, profil), cette table ne sert plus
 * qu'à la navigation. Depuis la Phase 14, les écritures des routes /api/tenant/*
 * et /api/missions/* passent par des RPC gardées par rôle (current_tenant_role()) :
 * cette table ne sert plus qu'à la navigation et au refus précoce.
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
  "/api/tenant/export-csv": ["owner", "manager"],
  "/api/tenant/export-fec": ["owner", "manager"],
};

/**
 * Rôles autorisés sur un chemin, ou `undefined` si le chemin n'est pas couvert
 * (l'appelant doit alors refuser — voir deny-by-default ci-dessus).
 */
export function allowedRolesFor(pathname: string): TenantRole[] | undefined {
  // Normalise le slash final.
  const path = pathname.replace(/\/+$/, "") || "/";
  return ROUTE_POLICY[path];
}

/** `true` si le chemin relève de la politique tenant (pages app + API tenant). */
export function isTenantScopedPath(pathname: string): boolean {
  return pathname.startsWith("/app") || pathname.startsWith("/api/tenant");
}
