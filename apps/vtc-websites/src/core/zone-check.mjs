// Copie navigateur de supabase/functions/_shared/zone-check.ts (garder identiques ; mêmes cas de test).
// Le navigateur est une aide : le serveur ne refuse jamais, il signale (D-33).

/** @param {string | null} codePostal @param {string[] | null | undefined} codesZone */
export function statutExtremite(codePostal, codesZone) {
  if (!codesZone || codesZone.length === 0) return "libre";
  const code = codePostal?.trim();
  if (!code) return "inconnu";
  return codesZone.includes(code) ? "ok" : "hors_zone";
}

/** Le retour n'inverse que si le trajet est bidirectionnel. @param {import("./zone-check.d.mts").RouteZones} route @param {string} [direction] */
export function zonesDuSens(route, direction) {
  const retour = direction === "reverse" && !!route.is_bidirectional;
  return retour
    ? { depart: route.dropoff_zone, arrivee: route.pickup_zone }
    : { depart: route.pickup_zone, arrivee: route.dropoff_zone };
}

/** @param {string} adresse @param {{ fetchFn?: typeof fetch, timeoutMs?: number }} [opts] @returns {Promise<string | null>} */
export async function codePostalAdresse(adresse, opts = {}) {
  const q = (adresse ?? "").trim().slice(0, 200);
  if (q.length < 3) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await (opts.fetchFn ?? fetch)(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const p = (await res.json())?.features?.[0]?.properties;
    return p && Number(p.score) >= 0.5 && p.postcode ? String(p.postcode) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
