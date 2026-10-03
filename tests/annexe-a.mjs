/* global console, process */
// Couverture de l'Annexe A (16-RESEARCH.md) : chaque ligne A1 à A14 doit avoir au moins un test nommé « A<n> ».
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

const files = [
  ...readdirSync('tests').filter((f) => /^backoffice-bookings.*\.spec\.ts$/.test(f)).map((f) => join('tests', f)),
  ...walk('apps/vtc-backoffice/src/features/bookings').filter((f) => /\.test\.tsx?$/.test(f)),
];
const title = /\b(?:test|it)\(\s*["'`]A(\d+) /g;
const count = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, 0]));
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(title)) if (m[1] in count) count[m[1]]++;

const missing = Object.keys(count).filter((n) => count[n] === 0).map((n) => `A${n}`);
if (missing.length) {
  console.error(`Annexe A : lignes sans test nommé : ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Annexe A : 14/14 lignes couvertes');
