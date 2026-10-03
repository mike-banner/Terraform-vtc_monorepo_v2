export type Claims = { tenant_id: string | null; tenant_role: string | null; platform_role: string | null };

/** Décode le payload d'un JWT (base64url) sans vérifier la signature : lecture d'affichage seulement, l'autorité reste RLS + middleware. */
export function decodeClaims(token: string): Claims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const c = JSON.parse(new TextDecoder().decode(bytes));
    if (!c || typeof c !== "object") return null;
    return { tenant_id: c.tenant_id ?? null, tenant_role: c.tenant_role ?? null, platform_role: c.platform_role ?? null };
  } catch {
    return null;
  }
}
