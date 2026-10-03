import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALERTES_ADRESSE, alerteAdresse, codePostalAdresse, statutExtremite, zonesDuSens } from "./zone-check.ts";

const rep = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const feat = (postcode: string, score: number) => ({ features: [{ properties: { postcode, score } }] });
const compte = () => {
  const appels: string[] = [];
  return { appels, fn: ((u: string) => (appels.push(u), rep(feat("75004", 0.97)))) as unknown as typeof fetch };
};

Deno.test("statutExtremite : cas de base", () => {
  assertEquals(statutExtremite("75008", ["75001", "75008"]), "ok");
  assertEquals(statutExtremite("69003", ["75001"]), "hors_zone");
  assertEquals(statutExtremite(null, ["75001"]), "inconnu");
});

Deno.test("statutExtremite : zone sans code = libre", () => {
  assertEquals(statutExtremite("69003", []), "libre");
  assertEquals(statutExtremite("69003", null), "libre");
  assertEquals(statutExtremite(null, []), "libre");
});

Deno.test("statutExtremite : espaces ignorés", () => {
  assertEquals(statutExtremite(" 75008 ", ["75008"]), "ok");
});

Deno.test("alerteAdresse : hors zone", () => {
  assertEquals(alerteAdresse("hors_zone", "hors_zone"), "hors_zone");
  assertEquals(alerteAdresse("hors_zone", "ok"), "hors_zone_depart");
  assertEquals(alerteAdresse("ok", "hors_zone"), "hors_zone_arrivee");
  assertEquals(alerteAdresse("hors_zone", "inconnu"), "hors_zone_depart");
});

Deno.test("alerteAdresse : inconnu ou rien", () => {
  assertEquals(alerteAdresse("inconnu", "ok"), "a_verifier");
  assertEquals(alerteAdresse("libre", "inconnu"), "a_verifier");
  assertEquals(alerteAdresse("ok", "libre"), null);
  assertEquals(alerteAdresse("libre", "libre"), null);
});

const route = (bi: boolean) => ({
  is_bidirectional: bi,
  pickup_zone: { name: "P", postal_codes: ["75001"] },
  dropoff_zone: { name: "D", postal_codes: ["69001"] },
});

Deno.test("zonesDuSens : aller", () => {
  assertEquals(zonesDuSens(route(true)).depart?.name, "P");
  assertEquals(zonesDuSens(route(true), "forward").depart?.name, "P");
});

Deno.test("zonesDuSens : retour inverse seulement si bidirectionnel", () => {
  assertEquals(zonesDuSens(route(true), "reverse").depart?.name, "D");
  assertEquals(zonesDuSens(route(false), "reverse").depart?.name, "P");
});

Deno.test("zonesDuSens : zone null = libre", () => {
  const z = zonesDuSens({ is_bidirectional: false, pickup_zone: null, dropoff_zone: undefined });
  assertEquals(statutExtremite("75001", z.depart?.postal_codes), "libre");
  assertEquals(statutExtremite("75001", z.arrivee?.postal_codes), "libre");
});

Deno.test("codePostalAdresse : résultat net", async () => {
  assertEquals(await codePostalAdresse("1 rue X Paris", { fetchFn: (() => rep(feat("75004", 0.97))) as typeof fetch }), "75004");
});

Deno.test("codePostalAdresse : flou, vide, HTTP 500, rejet = null", async () => {
  const f = (fn: () => Promise<Response>) => codePostalAdresse("1 rue X Paris", { fetchFn: fn as typeof fetch });
  assertEquals(await f(() => rep(feat("75004", 0.3))), null);
  assertEquals(await f(() => rep({ features: [] })), null);
  assertEquals(await f(() => rep({}, 500)), null);
  assertEquals(await f(() => Promise.reject(new Error("réseau"))), null);
});

Deno.test("codePostalAdresse : délai", async () => {
  const jamais = ((_u: string, init: RequestInit) =>
    new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new Error("abort"))))) as unknown as typeof fetch;
  const t = Date.now();
  assertEquals(await codePostalAdresse("1 rue X Paris", { fetchFn: jamais, timeoutMs: 50 }), null);
  assertEquals(Date.now() - t < 500, true);
});

Deno.test("codePostalAdresse : adresse vide ou courte, aucun appel", async () => {
  const c = compte();
  for (const a of ["", "   ", "ab"]) assertEquals(await codePostalAdresse(a, { fetchFn: c.fn }), null);
  assertEquals(c.appels.length, 0);
});

Deno.test("codePostalAdresse : URL et troncature à 200", async () => {
  const c = compte();
  await codePostalAdresse("é".repeat(300), { fetchFn: c.fn });
  const u = new URL(c.appels[0]);
  assertEquals(u.origin + u.pathname, "https://api-adresse.data.gouv.fr/search/");
  assertEquals(u.searchParams.get("limit"), "1");
  assertEquals(u.searchParams.get("q"), "é".repeat(200));
});

Deno.test("ALERTES_ADRESSE : les 4 valeurs du CHECK SQL", () => {
  assertEquals([...ALERTES_ADRESSE], ["hors_zone_depart", "hors_zone_arrivee", "hors_zone", "a_verifier"]);
});
