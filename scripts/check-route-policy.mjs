#!/usr/bin/env node
// Vérifie que chaque page /app/* et chaque route /api/tenant/* du backoffice est
// déclarée dans ROUTE_POLICY (apps/vtc-backoffice/src/lib/guards.ts).
// Le middleware refuse tout chemin non déclaré : sans ce check, ajouter une page
// sans l'y inscrire donne un 403 découvert en production plutôt qu'en CI.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = "apps/vtc-backoffice/src";
const guards = readFileSync(join(root, "lib/guards.ts"), "utf8");
const declared = new Set(
  [...guards.matchAll(/^\s*"(\/(?:app|api\/tenant)\/[a-z0-9-]+)":/gim)].map((m) => m[1]),
);

const routesFrom = (dir, prefix, exts) =>
  readdirSync(join(root, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && exts.some((x) => e.name.endsWith(x)))
    .map((e) => `${prefix}/${e.name.replace(/\.(astro|ts)$/, "")}`);

const expected = [
  ...routesFrom("pages/app", "/app", [".astro"]),
  ...routesFrom("pages/api/tenant", "/api/tenant", [".ts"]),
];

const missing = expected.filter((r) => !declared.has(r));
const stale = [...declared].filter((r) => !expected.includes(r));

if (missing.length || stale.length) {
  if (missing.length) console.error("ROUTE_POLICY — chemins non déclarés :\n  " + missing.join("\n  "));
  if (stale.length) console.error("ROUTE_POLICY — entrées orphelines (route supprimée) :\n  " + stale.join("\n  "));
  process.exit(1);
}
console.log(`ROUTE_POLICY : ${expected.length} chemins déclarés, aucun écart.`);
