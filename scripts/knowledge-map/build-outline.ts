// Build the knowledge map's slim outline (#297): boundaries.json + water.json
// (about 1 MB) -> one packed file the map loads on first open. Writes to a
// staging path and prints a coverage report; the integrator publishes it to
// public/data/extracts/amsterdam/knowledge-map-outline.json after review.
//
//   node --import tsx scripts/knowledge-map/build-outline.ts [--out <path>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { BUURT_KIND_RANKS, geometryFromExtract } from '../../src/canalRecall/knowledgeMap.ts';
import { geometryFromOutline, outlineFromGeometry } from '../../src/canalRecall/knowledgeMapOutline.ts';

const root = resolve(import.meta.dirname, '../..');
const extract = resolve(root, 'public/data/extracts/amsterdam');
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? resolve(process.argv[outArg + 1]) : resolve(extract, 'staging/knowledge-map-outline.json');

const boundaries = JSON.parse(readFileSync(resolve(extract, 'boundaries.json'), 'utf8'));
const water = JSON.parse(readFileSync(resolve(extract, 'water.json'), 'utf8'));
const full = geometryFromExtract(boundaries, water);
const outline = outlineFromGeometry(full);
const text = JSON.stringify(outline);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);

const back = geometryFromOutline(outline, BUURT_KIND_RANKS);
const pts = (rings: unknown[][]): number => rings.reduce<number>((sum, ring) => sum + ring.length, 0);
console.log(`wrote ${out}`);
console.log(`sources: boundaries.json ${statBytes('boundaries.json')} B, water.json ${statBytes('water.json')} B`);
console.log(`outline: ${text.length} B raw, ${gzipSync(text).length} B gzip`);
console.log(`buurts: ${full.buurts.length} -> ${back.buurts.length}; water lines ${full.water.length} -> ${back.water.length}`);
console.log(`points: buurts ${full.buurts.reduce((s, b) => s + pts(b.rings), 0)} -> ${back.buurts.reduce((s, b) => s + pts(b.rings), 0)}; water ${pts(full.water)} -> ${pts(back.water)}`);
let worst = 0;
full.buurts.forEach((buurt, index) => {
  const twin = back.buurts[index];
  if (!twin || twin.name !== buurt.name) { console.log(`MISSING ${buurt.name}`); return; }
  const drift = Math.max(
    Math.abs(buurt.bbox.minLat - twin.bbox.minLat), Math.abs(buurt.bbox.maxLat - twin.bbox.maxLat),
    Math.abs(buurt.bbox.minLng - twin.bbox.minLng), Math.abs(buurt.bbox.maxLng - twin.bbox.maxLng));
  if (drift * 111320 > 20) console.log(`drift ${(drift * 111320).toFixed(0)} m: ${buurt.name} (${buurt.kind})`);
  worst = Math.max(worst, drift);
});
console.log(`worst bbox drift: ${(worst * 111320).toFixed(1)} m`);

function statBytes(name: string): number {
  return readFileSync(resolve(extract, name)).length;
}
