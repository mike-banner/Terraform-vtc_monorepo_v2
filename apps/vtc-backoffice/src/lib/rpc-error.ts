// Statut HTTP d'une erreur de RPC (SQLSTATE PostgREST). Proxys Astro de la Phase 14,
// disparaissent avec la SPA (Phase 17).
export function rpcErrorStatus(code: string | undefined): number {
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "22023" || code === "22P02" || code === "22007" || code === "P0001") return 400;
  return 500;
}
