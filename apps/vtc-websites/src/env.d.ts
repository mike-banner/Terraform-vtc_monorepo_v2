/// <reference types="astro/client" />

// Champs publics uniquement — exposés par la RPC `get_public_tenant`.
// La table `tenants` n'est plus lisible avec la clé publique (cf. migration
// security_hardening) : n'ajoutez rien ici sans ajouter la colonne à la RPC.
interface Tenant {
  id: string;
  name: string;
  primary_domain: string;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
}

declare namespace App {
  interface Locals {
    tenant: Tenant;
  }
}

declare module "virtual:vtc-sites" {
  export const siteMap: Record<string, string>;
  export const defaultSite: string;
  export const configs: Record<string, Partial<import("./core/site-config").ConfigSite>>;
  export const landings: Record<string, () => Promise<{ default: any }>>;
}
