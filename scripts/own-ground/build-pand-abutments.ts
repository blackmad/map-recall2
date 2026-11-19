// Small buildings on a bridge's abutment (pandAbutments.ts; lane fb-bridges-20261119, feedback c361c8, the Kinkerbrug
// bridge-keeper's house). Audit: scans the BAG footprints in building-tiles/14 for pands the rule takes and writes them
// to a staging file for review against photos. Nothing reads the output yet (--publish is for after that review).
//
//   node --import tsx scripts/own-ground/build-pand-abutments.ts [--out=artifacts/pand-abutments.json] [--publish]
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { GroundStore, toLocal, waterTest, WATER_Z } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeRoadLine } from '../../src/canalRecall/ownGround/roadCells.ts';
import { WET_CLEAR_M } from '../../src/canalRecall/ownGround/wetGround.ts';
import { isPandAbutment, ringArea, PAND_ABUTMENT_MAX_M2, PAND_ABUTMENTS_FILE, type PandAbutmentsExtract } from '../../src/canalRecall/ownGround/pandAbutments.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const out = process.argv.includes('--publish') ? join(ROOT, PAND_ABUTMENTS_FILE) : (flag('out') ?? 'artifacts/pand-abutments.json');
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();

// Candidates: small footprints from every tile, by ground cell.
const byCell = new Map<string, { id: string; g: [number, number][]; ring: [number, number][] }[]>();
let scanned = 0;
const tiles = join(ROOT, 'building-tiles/14');
for (const x of readdirSync(tiles)) for (const f of readdirSync(join(tiles, x))) {
  if (!f.endsWith('.geojson.gz')) continue;
  const fc = JSON.parse(gunzipSync(readFileSync(join(tiles, x, f))).toString()) as { features: { properties: { id?: string }; geometry: { type: string; coordinates: number[][][] } }[] };
  for (const feat of fc.features) {
    if (feat.geometry?.type !== 'Polygon') continue;
    scanned++;
    const g = feat.geometry.coordinates[0] as [number, number][], ring = g.map(([lng, lat]) => toLocal(lng, lat)) as [number, number][];
    if (ringArea(ring) > PAND_ABUTMENT_MAX_M2) continue;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length, k = store.cellAt(cx, cy);
    if (!store.covers(k)) continue;
    (byCell.get(k) ?? byCell.set(k, []).get(k)!).push({ id: String(feat.properties.id ?? '').replace(/^NL\.IMBAG\.Pand\./, ''), g, ring });
  }
}
const found = new Map<string, { id: string; ring: [number, number][] }>();
let wetCandidates = 0;
for (const [k, list] of byCell) {
  const around = GroundStore.neighbours(k);
  const water = (await Promise.all(around.map(a => store.waterCell(a)))).flatMap(w => w?.polygons ?? []);
  if (!water.length) continue;
  const wet = waterTest(water);
  const onWater = list.filter(p => p.ring.some(([x, y]) => wet(x, y)) || wet(p.ring.reduce((s, q) => s + q[0], 0) / p.ring.length, p.ring.reduce((s, q) => s + q[1], 0) / p.ring.length));
  if (!onWater.length) continue;
  wetCandidates += onWater.length;
  const decks = (await Promise.all(around.map(a => store.roadCell(a)))).flatMap(r => r?.surfaces.filter(q => q.h >= 1 && q.r.length).map(q => decodeRoadLine(q.r[0])) ?? []);
  if (!decks.length) continue;
  const rect = store.cellRect(k);
  await store.ensureRelief([rect[0] - 20, rect[1] - 20, rect[2] + 20, rect[3] + 20]);
  for (const p of onWater) if (!found.has(p.id) && isPandAbutment(p.ring, wet, (x, y) => store.surface.ground(x, y), WATER_Z, decks, WET_CLEAR_M)) found.set(p.id, { id: p.id, ring: p.g.map(([lng, lat]) => [+lng.toFixed(7), +lat.toFixed(7)] as [number, number]) });
}
const extract: PandAbutmentsExtract = { version: 1, generated: new Date().toISOString().slice(0, 10), pands: [...found.values()].sort((a, b) => (a.id < b.id ? -1 : 1)) };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(extract));
console.log(`scanned ${scanned} footprints; ${wetCandidates} small ones touching water; ${extract.pands.length} on an abutment -> ${out}`);
console.log(extract.pands.map(p => `${p.id} ${p.ring[0].join(',')}`).join('\n'));
