import test from "node:test";
import assert from "node:assert/strict";
import { codePostalAdresse, statutExtremite, zonesDuSens } from "./zone-check.mjs";

const rep = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const feat = (postcode, score) => ({ features: [{ properties: { postcode, score } }] });

test("statutExtremite : cas de base", () => {
  assert.equal(statutExtremite("75008", ["75001", "75008"]), "ok");
  assert.equal(statutExtremite("69003", ["75001"]), "hors_zone");
  assert.equal(statutExtremite(null, ["75001"]), "inconnu");
});

test("statutExtremite : zone sans code = libre", () => {
  assert.equal(statutExtremite("69003", []), "libre");
  assert.equal(statutExtremite("69003", null), "libre");
  assert.equal(statutExtremite(null, []), "libre");
});

test("statutExtremite : espaces ignorés", () => {
  assert.equal(statutExtremite(" 75008 ", ["75008"]), "ok");
});

const route = (bi) => ({
  is_bidirectional: bi,
  pickup_zone: { name: "P", postal_codes: ["75001"] },
  dropoff_zone: { name: "D", postal_codes: ["69001"] },
});

test("zonesDuSens : aller", () => {
  assert.equal(zonesDuSens(route(true)).depart.name, "P");
  assert.equal(zonesDuSens(route(true), "forward").depart.name, "P");
});

test("zonesDuSens : retour inverse seulement si bidirectionnel", () => {
  assert.equal(zonesDuSens(route(true), "reverse").depart.name, "D");
  assert.equal(zonesDuSens(route(false), "reverse").depart.name, "P");
});

test("zonesDuSens : zone null = libre", () => {
  const z = zonesDuSens({ is_bidirectional: false, pickup_zone: null, dropoff_zone: undefined });
  assert.equal(statutExtremite("75001", z.depart?.postal_codes), "libre");
  assert.equal(statutExtremite("75001", z.arrivee?.postal_codes), "libre");
});

test("codePostalAdresse : résultat net", async () => {
  assert.equal(await codePostalAdresse("1 rue X Paris", { fetchFn: () => rep(feat("75004", 0.97)) }), "75004");
});

test("codePostalAdresse : flou, vide, HTTP 500, rejet = null", async () => {
  const f = (fn) => codePostalAdresse("1 rue X Paris", { fetchFn: fn });
  assert.equal(await f(() => rep(feat("75004", 0.3))), null);
  assert.equal(await f(() => rep({ features: [] })), null);
  assert.equal(await f(() => rep({}, 500)), null);
  assert.equal(await f(() => Promise.reject(new Error("réseau"))), null);
});

test("codePostalAdresse : délai", async () => {
  const jamais = (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort"))));
  const t = Date.now();
  assert.equal(await codePostalAdresse("1 rue X Paris", { fetchFn: jamais, timeoutMs: 50 }), null);
  assert.ok(Date.now() - t < 500);
});

test("codePostalAdresse : adresse vide ou courte, aucun appel", async () => {
  const appels = [];
  const fetchFn = (u) => (appels.push(u), rep(feat("75004", 0.97)));
  for (const a of ["", "   ", "ab"]) assert.equal(await codePostalAdresse(a, { fetchFn }), null);
  assert.equal(appels.length, 0);
});

test("codePostalAdresse : URL et troncature à 200", async () => {
  const appels = [];
  await codePostalAdresse("é".repeat(300), { fetchFn: (u) => (appels.push(u), rep(feat("75004", 0.97))) });
  const u = new URL(appels[0]);
  assert.equal(u.origin + u.pathname, "https://api-adresse.data.gouv.fr/search/");
  assert.equal(u.searchParams.get("limit"), "1");
  assert.equal(u.searchParams.get("q"), "é".repeat(200));
});
