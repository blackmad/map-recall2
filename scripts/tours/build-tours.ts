// Build public/data/extracts/amsterdam/tours.json from the hand-curated
// scripts/tours/amsterdam-tours.json, resolving every stop to a coordinate in
// the cached extracts. Prints how each stop resolved and whether the output
// changed. Run: npm run build:tours (then npm run test:tours).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readSource, resolveTours } from './resolveTours.ts';

const OUT = path.resolve('public/data/extracts/amsterdam/tours.json');
const source = readSource();
const { tours, resolutions } = resolveTours(source);

for (const [i, tour] of tours.entries()) {
  console.log(`${tour.id} (${tour.stops.length} stops${tour.volatile ? `, volatile, checked ${tour.checkedAt}` : ''})`);
  for (const r of resolutions[i]) console.log(`  ${r.stop.name.padEnd(34)} ${r.via.padEnd(11)} ${r.detail}`);
}

const output = JSON.stringify({
  version: source.version,
  city: source.city,
  source: 'scripts/tours/amsterdam-tours.json via scripts/tours/build-tours.ts; coordinates © OpenStreetMap contributors (ODbL)',
  tours,
}, null, 2) + '\n';
const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
if (before === output) {
  console.log(`\n${path.relative(process.cwd(), OUT)} unchanged.`);
} else {
  writeFileSync(OUT, output);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)} (${tours.length} tours, ${tours.reduce((n, t) => n + t.stops.length, 0)} stops${before ? ', changed' : ', new'}).`);
}
