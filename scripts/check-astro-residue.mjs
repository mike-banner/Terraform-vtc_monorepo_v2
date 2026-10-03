#!/usr/bin/env node
// Garde contre le retour d'Astro métier dans le backoffice (phase 16, D-15).
// Usage : node scripts/check-astro-residue.mjs [--self-test]
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import assert from "node:assert/strict";

export const ALLOWED = ["pages/app/[...path].astro", "pages/[...path].astro", "layouts/AppDocument.astro"];
export const ALLOWED_API = ["pages/api/tenant/export-csv.ts", "pages/api/tenant/export-fec.ts"];

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

export function check(src) {
  const errors = [];
  if (existsSync(join(src, "scripts"))) errors.push("src/scripts ne doit pas exister");
  for (const file of walk(src)) {
    const rel = relative(src, file).split("\\").join("/");
    if (rel.endsWith(".astro")) {
      if (!ALLOWED.includes(rel)) errors.push(`.astro hors liste : src/${rel}`);
      else if (/<script/.test(readFileSync(file, "utf8"))) errors.push(`<script dans src/${rel}`);
    }
    if (rel.startsWith("pages/api/") && !rel.endsWith(".gitkeep") && !ALLOWED_API.includes(rel)) {
      errors.push(`route API hors liste : src/${rel}`);
    }
  }
  return errors;
}

function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), "astro-residue-"));
  const put = (rel, body = "") => {
    mkdirSync(dirname(join(tmp, rel)), { recursive: true });
    writeFileSync(join(tmp, rel), body);
  };
  try {
    for (const a of [...ALLOWED, ...ALLOWED_API]) put(a);
    assert.deepEqual(check(tmp), []);
    put("components/Foo.astro");
    assert.equal(check(tmp).length, 1);
    rmSync(join(tmp, "components"), { recursive: true });
    put("scripts/x.ts");
    assert.equal(check(tmp).length, 1);
    rmSync(join(tmp, "scripts"), { recursive: true });
    put("pages/api/tenant/autre.ts");
    assert.equal(check(tmp).length, 1);
    rmSync(join(tmp, "pages/api/tenant/autre.ts"));
    put("layouts/AppDocument.astro", "<script>1</script>");
    assert.equal(check(tmp).length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log("check-astro-residue : auto-test ok");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const errors = check("apps/vtc-backoffice/src");
  if (errors.length) {
    console.error("check-astro-residue :\n  " + errors.join("\n  "));
    process.exit(1);
  }
  console.log(`check-astro-residue : ${ALLOWED.length} fichiers Astro autorisés, aucun reste`);
}
