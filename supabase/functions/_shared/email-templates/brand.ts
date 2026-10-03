import { tokens } from "../email-tokens.ts";

// Marque d'un chauffeur dans les emails : logo, couleur d'accent, nom, contact.
// Tout vient des colonnes de `tenants` ; sans valeur valide, on retombe sur le style neutre.
export interface Brand {
  name: string;
  logoUrl: string | null;
  accent: string;
  email: string | null;
  phone: string | null;
}

export interface TenantBrandRow {
  name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  email?: string | null;
  phone?: string | null;
}

// Couleur validée (#rrggbb) : elle finit dans un attribut style, jamais de texte libre.
const HEX = /^#[0-9a-f]{6}$/i;

export const NEUTRAL_BRAND: Brand = {
  name: "",
  logoUrl: null,
  accent: tokens.colors.accent,
  email: null,
  phone: null,
};

export function getBrand(t: TenantBrandRow | null | undefined): Brand {
  if (!t) return NEUTRAL_BRAND;
  return {
    name: t.name ?? "",
    logoUrl: t.logo_url && /^https:\/\//i.test(t.logo_url) ? t.logo_url : null,
    accent: t.primary_color && HEX.test(t.primary_color) ? t.primary_color : tokens.colors.accent,
    email: t.email ?? null,
    phone: t.phone ?? null,
  };
}
