import test from "node:test";
import assert from "node:assert/strict";
import { lireSites } from "./sites.config.mjs";

test("site par défaut seul", () => {
  assert.deepEqual(lireSites({ PUBLIC_SITE: "site-a" }), { defaultSite: "site-a", siteMap: {}, codes: ["site-a"] });
});

test("deux sites", () => {
  const r = lireSites({ PUBLIC_SITE: "site-a", SITE_MAP: "a.invalid=site-a, b.invalid=site-b" });
  assert.equal(Object.keys(r.siteMap).length, 2);
  assert.deepEqual(r.codes, ["site-a", "site-b"]);
});

test("domaine avec port", () => {
  assert.equal(lireSites({ PUBLIC_SITE: "site-a", SITE_MAP: "localhost:4321=site-a" }).siteMap["localhost:4321"], "site-a");
});

test("PUBLIC_SITE obligatoire", () => {
  assert.throws(() => lireSites({}), /PUBLIC_SITE/);
  assert.throws(() => lireSites({ SITE_MAP: "a.invalid=site-a" }), /PUBLIC_SITE/);
  assert.throws(() => lireSites({ PUBLIC_SITE: "../x" }), /PUBLIC_SITE/);
});

test("entrées invalides sans divulguer le domaine", () => {
  for (const m of ["secret.invalid", "secret.invalid=Site A", "secret.invalid=a=b"]) {
    assert.throws(
      () => lireSites({ PUBLIC_SITE: "site-a", SITE_MAP: m }),
      (e) => /SITE_MAP : entrée n°1 invalide/.test(e.message) && !e.message.includes("secret"),
    );
  }
});

test("un domaine par site (D-29 b)", () => {
  assert.throws(
    () => lireSites({ PUBLIC_SITE: "site-a", SITE_MAP: "a.invalid=site-a,a.invalid=site-b" }),
    (e) => /entrée n°2 : domaine en double/.test(e.message) && !e.message.includes("a.invalid"),
  );
  assert.throws(
    () => lireSites({ PUBLIC_SITE: "site-a", SITE_MAP: "a.invalid=site-a,b.invalid=site-a" }),
    (e) => /entrée n°2 : site déjà associé à un domaine \(un domaine par site\)/.test(e.message) && !e.message.includes("b.invalid"),
  );
});
