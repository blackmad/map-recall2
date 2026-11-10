// Shopfront census (lane storefront-gate 2026-11-10): how many pands are drawn with a shop ground floor, by where the
// shop came from and by what BAG says the pand is used for. City-wide and Centrum.
//
//   npx tsx scripts/shopfront-census.ts --stage=/tmp/sg-after [--stage=/tmp/sg-before ...] [--json=out.json]
//
// A stage is a directory written by `build-shopfronts.ts --out-dir=...` (shopfronts.json + shopfront-sources.json).
// BAG uses: .cache/industrial/bag-uses.json (scripts/industrial/fetch-bag-uses.ts). Stadsdeel: buurten from the source data.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { useClassOf, USE_CLASSES, type BagUsesTable } from '../src/canalRecall/shopGate.ts';
import { LARGE_TIER_OVERRIDES } from '../src/canalRecall/largeBuildingTier.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const BUURTEN = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const stages = process.argv.filter(a => a.startsWith('--stage=')).map(a => a.slice(8));
const jsonOut = process.argv.find(a => a.startsWith('--json='))?.slice(7);

type Ring = number[][];
const rings = (g: any): Ring[] => !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: Ring[]) => p[0]) : [];
const inRing = (p: number[], r: Ring) => { let inside = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const buurten: { box: number[]; rings: Ring[]; code: string }[] = [];
for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BUURTEN, 'datasets/gebieden-buurten-20261016/buurten.geojson.gz'))).toString()).features) {
  const rs = rings(f.geometry), xs = rs.flat().map(p => p[0]), ys = rs.flat().map(p => p[1]);
  buurten.push({ box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], rings: rs, code: String(f.properties.code ?? '') });
}
const stadsdeelAt = (p: number[]) => buurten.find(b => p[0] >= b.box[0] && p[0] <= b.box[2] && p[1] >= b.box[1] && p[1] <= b.box[3] && b.rings.some(r => inRing(p, r)))?.code[0] ?? '?';
const STADSDELEN: Record<string, string> = { A: 'Centrum', B: 'Westpoort', E: 'West', F: 'Nieuw-West', K: 'Zuid', M: 'Oost', N: 'Noord', T: 'Zuidoost', S: 'Weesp' };

const bag = (JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/industrial/bag-uses.json'), 'utf8')) as { pands: BagUsesTable }).pands;
const industrial = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'industrial-buildings.json'), 'utf8')).ids as Record<string, string>;
const modelled = new Set<string>();
for (const list of Object.values<string[]>(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'landmark-buildings.json'), 'utf8')).buildings ?? {})) for (const id of list) modelled.add(String(id));
for (const id of Object.keys(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'kit-pands.json'), 'utf8')).ids ?? {})) modelled.add(id);

// Every ground building in the tiles: id, centroid, and a flag for pands with no verblijfsobject in the table's complement.
const where = new Map<string, { stadsdeel: string; at: number[] }>();
const tilesDir = path.join(EXTRACT, 'building-tiles/14');
for (const x of fs.readdirSync(tilesDir)) for (const y of fs.readdirSync(path.join(tilesDir, x))) {
  for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tilesDir, x, y))).toString()).features ?? []) {
    const id = String(f.properties?.id ?? ''), r = rings(f.geometry)[0];
    if (!id || !r || where.has(id) || Number(f.properties.minHeight) > 2) continue;
    const at = [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
    where.set(id, { stadsdeel: STADSDELEN[stadsdeelAt(at)] ?? 'outside', at });
  }
}
const bagKey = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const tunedShop = Object.entries(LARGE_TIER_OVERRIDES).filter(([, o]) => o.groundShop).map(([id]) => id);

const report: Record<string, unknown> = {};
for (const stage of stages) {
  const extract = JSON.parse(fs.readFileSync(path.join(stage, 'shopfronts.json'), 'utf8'));
  const { sources } = JSON.parse(fs.readFileSync(path.join(stage, 'shopfront-sources.json'), 'utf8')) as { sources: Record<string, string> };
  const table: Record<string, Record<string, Record<string, number>>> = { 'city-wide': {}, Centrum: {} };
  const bump = (scope: string, source: string, use: string) => { const t = (table[scope][source] ??= {}); t[use] = (t[use] ?? 0) + 1; };
  const drawn = new Set(Object.keys(extract.buildings));
  for (const id of tunedShop) drawn.add(id);
  for (const id of drawn) {
    const w = where.get(id);
    const source = tunedShop.includes(id) && !(id in extract.buildings) ? 'large-tier groundShop (photo-tuned)' : modelled.has(id) ? `${sources[id] ?? 'poi'} (landmark/kit pand)` : sources[id] ?? 'poi';
    const uses = bag[bagKey(id)];
    // Absent from the table = housing only, or no verblijfsobject: told apart by nothing in the register we hold, so one class.
    const use = useClassOf(uses);
    bump('city-wide', source, use);
    if (w?.stadsdeel === 'Centrum') bump('Centrum', source, use);
  }
  report[stage] = table;
  console.log(`\n== ${stage}: ${drawn.size} pands drawn with a shop ground floor`);
  for (const scope of Object.keys(table)) {
    console.log(`\n${scope}`);
    console.log(['source', ...USE_CLASSES, 'total'].join(' | '));
    for (const [source, row] of Object.entries(table[scope]).sort()) console.log([source, ...USE_CLASSES.map(u => row[u] ?? 0), Object.values(row).reduce((s, v) => s + v, 0)].join(' | '));
    const total = Object.values(table[scope]).flatMap(r => Object.values(r)).reduce((s, v) => s + v, 0);
    const industrialShops = [...drawn].filter(id => industrial[id] && (scope === 'city-wide' || where.get(id)?.stadsdeel === 'Centrum')).length;
    console.log(`total ${total}; of which on a pand the industrial kit classes (shed/tank/silo/office): ${industrialShops}`);
  }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
