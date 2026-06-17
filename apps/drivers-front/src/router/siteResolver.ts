/**
 * RÉSOLUTION DU SITE (Site-Driven Architecture)
 * En Prod : On mappe le domaine (host) vers le dossier du site
 * En Dev : On utilise la variable PUBLIC_SITE du .env (ou elite-lyon par défaut)
 */
export function resolveSite(host: string): string {
  const map: Record<string, string> = {
    "elite-lyon.fr": "elite-lyon",
    "paris-executive.fr": "paris-executive",
    "airport-driver.com": "airport-driver",
    "localhost:4321": "elite-lyon",
    "localhost:4325": "elite-lyon",
    "localhost:5173": "elite-lyon",
    "127.0.0.1:4321": "elite-lyon",
  };

  if (import.meta.env.DEV) {
    return import.meta.env.PUBLIC_SITE || "elite-lyon";
  }

  return map[host] || "elite-lyon"; // elite-lyon comme fallback par défaut en construction
}
