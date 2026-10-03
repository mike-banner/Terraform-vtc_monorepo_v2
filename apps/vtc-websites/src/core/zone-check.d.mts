export type StatutExtremite = "ok" | "hors_zone" | "inconnu" | "libre";
export type ZoneCodes = { name?: string; postal_codes?: string[] | null } | null | undefined;
export type RouteZones = { is_bidirectional?: boolean | null; pickup_zone?: ZoneCodes; dropoff_zone?: ZoneCodes };
export function statutExtremite(codePostal: string | null, codesZone: string[] | null | undefined): StatutExtremite;
export function zonesDuSens(route: RouteZones, direction?: string): { depart: ZoneCodes; arrivee: ZoneCodes };
export function codePostalAdresse(adresse: string, opts?: { fetchFn?: typeof fetch; timeoutMs?: number }): Promise<string | null>;
