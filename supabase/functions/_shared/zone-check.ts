// Contrôle de zone (D-32, D-33). Copie navigateur : apps/vtc-websites/src/core/zone-check.mjs
// (garder identiques ; mêmes cas de test). Ne lève jamais : le serveur signale, il ne refuse pas.
export type StatutExtremite = "ok" | "hors_zone" | "inconnu" | "libre";
export type AlerteAdresse = "hors_zone_depart" | "hors_zone_arrivee" | "hors_zone" | "a_verifier";
export type ZoneCodes = { name?: string; postal_codes?: string[] | null } | null | undefined;
export type RouteZones = { is_bidirectional?: boolean | null; pickup_zone?: ZoneCodes; dropoff_zone?: ZoneCodes };

export const ALERTES_ADRESSE: readonly AlerteAdresse[] = ["hors_zone_depart", "hors_zone_arrivee", "hors_zone", "a_verifier"];

// codesZone vide ou absent => "libre" (zone jamais contrôlée) ; code inconnu => "inconnu".
export function statutExtremite(codePostal: string | null, codesZone: string[] | null | undefined): StatutExtremite {
  if (!codesZone || codesZone.length === 0) return "libre";
  const code = codePostal?.trim();
  if (!code) return "inconnu";
  return codesZone.includes(code) ? "ok" : "hors_zone";
}

export function alerteAdresse(depart: StatutExtremite, arrivee: StatutExtremite): AlerteAdresse | null {
  if (depart === "hors_zone" && arrivee === "hors_zone") return "hors_zone";
  if (depart === "hors_zone") return "hors_zone_depart";
  if (arrivee === "hors_zone") return "hors_zone_arrivee";
  return depart === "inconnu" || arrivee === "inconnu" ? "a_verifier" : null;
}

// Le retour n'inverse que si le trajet est bidirectionnel.
export function zonesDuSens(route: RouteZones, direction?: string): { depart: ZoneCodes; arrivee: ZoneCodes } {
  const retour = direction === "reverse" && !!route.is_bidirectional;
  return retour
    ? { depart: route.dropoff_zone, arrivee: route.pickup_zone }
    : { depart: route.pickup_zone, arrivee: route.dropoff_zone };
}

// Adresse trop courte => null sans appel réseau. Erreur, délai, HTTP non 2xx, score < 0.5 => null.
export async function codePostalAdresse(
  adresse: string,
  opts: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<string | null> {
  const q = (adresse ?? "").trim().slice(0, 200);
  if (q.length < 3) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 3000);
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
