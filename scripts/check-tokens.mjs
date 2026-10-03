#!/usr/bin/env node
// Contrôle statique des îlots React du backoffice (phase 16) : tokens, DOM impératif, règles PWA.
// Usage : node scripts/check-tokens.mjs [--self-test]
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = "apps/vtc-backoffice/src";
const dirs = ["app", "features", "ui"];
const COULEURS =
  "slate|zinc|gray|neutral|stone|white|black|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink";

const rules = [
  {
    id: "couleur-brute",
    re: new RegExp(
      `\\b(text|bg|border|ring|from|to|fill|stroke|divide|outline)-(${COULEURS})(-\\d{2,3})?\\b|#[0-9a-fA-F]{3,8}\\b|rgba?\\(`,
    ),
    bad: ["bg-emerald-500", "text-white", "#fff", "color: #1E293B", "rgba(0,0,0,.5)", "border-slate-700"],
    ok: ["bg-success-soft", "text-muted-foreground", "border-border", "ring-ring"],
  },
  {
    id: "dom-imperatif",
    re: /getElementById|querySelector|innerHTML|(?<![.\w])(alert|confirm|prompt)\((?!\w+\??:)|location\.reload/,
    bad: ["document.getElementById('x')", "el.innerHTML = a", "alert('x')", "if (confirm('?'))", "location.reload()"],
    ok: ["confirm(o: ConfirmOpts): Promise<boolean>;", "await dialog.confirm({})", "useDialog().alert({})"],
  },
  { id: "xss", re: /dangerouslySetInnerHTML/, bad: ["<div dangerouslySetInnerHTML={x} />"], ok: ["<div>{x}</div>"] },
  {
    id: "hauteur-100vh",
    re: /100vh|\bh-screen\b|min-h-screen/,
    bad: ["h-[100vh]", "h-screen", "min-h-screen"],
    ok: ["h-dvh", "min-h-dvh"],
  },
  {
    id: "stockage-local",
    re: /localStorage|sessionStorage/,
    bad: ["localStorage.getItem('a')", "sessionStorage.x"],
    ok: ["const storage = 1"],
  },
  {
    id: "pwa-hors-phase",
    re: /navigator\.serviceWorker|new Notification|Notification\.requestPermission|PushManager/,
    bad: ["navigator.serviceWorker.register('/sw.js')", "new Notification('a')", "Notification.requestPermission()", "PushManager"],
    ok: ["const notification = 1"],
  },
  { id: "texte-trop-petit", re: /text-\[(9|10|11)px\]/, bad: ["text-[10px]", "text-[11px]"], ok: ["text-xs", "text-[12px]", "text-[13px]"] },
  {
    id: "import-astro",
    re: /from\s+["'][^"']*\.astro["']|from\s+["']astro[:"']/,
    bad: ['import A from "./A.astro"', "import { x } from 'astro:env'"],
    ok: ['import { x } from "react"'],
  },
  {
    id: "lien-course-en-dur",
    re: /["'`]\/app\/bookings\?booking=/,
    bad: ['href="/app/bookings?booking=1"', "`/app/bookings?booking=${id}`"],
    ok: ["bookingLink(id)"],
    skip: (f) => f.replace(/\\/g, "/").endsWith("src/app/links.ts"),
  },
];

if (process.argv.includes("--self-test")) {
  for (const r of rules) {
    for (const s of r.bad) assert.ok(r.re.test(s), `${r.id} devrait rejeter : ${s}`);
    for (const s of r.ok) assert.ok(!r.re.test(s), `${r.id} devrait accepter : ${s}`);
  }
  console.log("check-tokens self-test OK");
  process.exit(0);
}

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
  }
};
for (const d of dirs) if (existsSync(join(base, d))) walk(join(base, d));

let errors = 0;
for (const f of files) {
  readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const r of rules) {
        if (r.skip?.(f)) continue;
        if (r.re.test(line)) {
          console.error(`${f}:${i + 1}:${r.id}`);
          errors++;
        }
      }
    });
}
if (errors) process.exit(1);
console.log(`check-tokens : ${files.length} fichiers, aucun écart.`);
