/**
 * Neutralise les métacaractères de filtre PostgREST avant interpolation dans `.or()` / `.ilike()`.
 * Regex reprise telle quelle de pages/api/tenant/search-bookings.ts ; moins de 2 caractères : null.
 */
export function sanitizeSearch(raw: string): string | null {
  const q = raw.trim().slice(0, 100).replace(/[,()%*\\]/g, " ").trim();
  return q.length < 2 ? null : q;
}

/** Condition `.or()` : clients trouvés (nom, prénom, téléphone) ou référence = invoice_number. `q` doit venir de sanitizeSearch. */
export function buildSearchFilter(q: string, customerIds: string[]): string {
  const ref = `invoice_number.ilike.%${q}%`;
  return customerIds.length ? `customer_id.in.(${customerIds.join(",")}),${ref}` : ref;
}
