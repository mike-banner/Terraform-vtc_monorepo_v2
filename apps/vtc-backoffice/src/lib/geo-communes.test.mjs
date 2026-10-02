// Lancé à la main : node --test apps/vtc-backoffice/src/lib/geo-communes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyserCodes, analyserCommunes, choisirCodesCommune } from "./geo-communes.mjs";

const paris = [
  ...Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, "0")}`),
  "75116",
];
const communes = [
  { nom: "Saint-Denis-de-Pile", codesPostaux: ["33910"] },
  { nom: "Paris", codesPostaux: paris },
  { nom: "Saint-Denis", codesPostaux: ["93200"] },
];

test("Paris : les 21 codes, casse ignorée", () => {
  assert.equal(choisirCodesCommune("Paris", communes).length, 21);
  assert.deepEqual(choisirCodesCommune("paris", communes), choisirCodesCommune("PARIS", communes));
});

test("nom exact seulement", () => {
  assert.deepEqual(choisirCodesCommune("Saint-Denis", communes), ["93200"]);
  assert.deepEqual(choisirCodesCommune("Saint Denis", communes), ["93200"]);
  assert.deepEqual(choisirCodesCommune("Aéroport Saint-Exupéry", communes), []);
  assert.deepEqual(choisirCodesCommune("Paris", []), []);
});

test("analyserCodes", () => {
  assert.deepEqual(analyserCodes("75001, 75002;75003 75001"), ["75001", "75002", "75003"]);
  assert.deepEqual(analyserCodes(""), []);
  assert.throws(() => analyserCodes("7500"), /Code postal invalide/);
  const cinquanteEtUn = Array.from({ length: 51 }, (_, i) => String(10000 + i)).join(",");
  assert.throws(() => analyserCodes(cinquanteEtUn), /Code postal invalide/);
});

test("homonymes et communes proches : le département est montré, jamais de choix silencieux", () => {
  const evry = { nom: "Évry", codesPostaux: ["89140"], departement: { nom: "Yonne", code: "89" } };
  const courcouronnes = { nom: "Évry-Courcouronnes", codesPostaux: ["91000", "91080"], departement: { nom: "Essonne", code: "91" } };
  const r = analyserCommunes("Evry", [evry, courcouronnes]);
  assert.deepEqual(r.codes, ["89140"]);
  assert.equal(r.commune, "Évry (Yonne, 89)");
  assert.deepEqual(r.proches, ["Évry-Courcouronnes (Essonne, 91)"]);
  const homonymes = analyserCommunes("Évry", [evry, { ...evry, codesPostaux: ["38000"], departement: { nom: "Isère", code: "38" } }]);
  assert.deepEqual(homonymes.codes, []);
  assert.equal(homonymes.homonymes.length, 2);
});
