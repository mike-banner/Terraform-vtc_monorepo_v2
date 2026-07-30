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
