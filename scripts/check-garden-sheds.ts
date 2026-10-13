/**
 * City-wide garden shed audit (src/canalRecall/gardenSheds.ts): classifies every building tile feature the way the
 * chunk builder does (same function, the streets that can carry a front door from the full OSM ground extract),
 * and reports sheds per district, their size and height, and how many houses on Willem de Zwijgerlaan have one
 * behind them (the user's question, 2026-10-13).
 *
 * Usage: tsx scripts/check-garden-sheds.ts [--json=out.json]
 * Fails if the numbers leave their pinned bands (the classifier is a rule; a change should be deliberate).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SegmentGrid, streetSegments } from '../src/canalRecall/streetFronts.ts';
import { ORIGIN } from '../src/canalRecall/threeBuildingFeatures.ts';
import { eavesOf, isGardenShed, isShedSized, ringAreaM2, shedHeightM } from '../src/canalRecall/gardenSheds.ts';

const BASE = 'public/data/extracts/amsterdam';
const jsonGz = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString());
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const toLocal = (lng: number, lat: number): [number, number] => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * KY];

// Streets a front door can be on, from the full OSM ground extract (every way, with its highway tag).
const paths: Array<{ highway?: string; points: Array<[number, number]> }> = [];
for (const file of readdirSync(`${BASE}/own-ground-osm-v1/cells`)) {
  for (const way of jsonGz(`${BASE}/own-ground-osm-v1/cells/${file}`).ways ?? []) paths.push({ highway: way.tags?.highway, points: way.g });
}
const streets = new SegmentGrid(streetSegments(paths, ORIGIN), 25);

// Districts: the nine suburbs (admin level 9). Geometry rings are [lat, lng].
type District = { name: string; polygons: number[][][][] };
const boundaries = JSON.parse(readFileSync(`${BASE}/boundaries.json`, 'utf8')) as any[];
const districts: District[] = boundaries.filter(b => b.adminLevel === 9).map(b => ({ name: b.name, polygons: b.geometry }));
const municipality: District = { name: 'Amsterdam', polygons: boundaries.find(b => b.adminLevel === 8).geometry };
const inRing = (lat: number, lng: number, ring: number[][]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][0] > lat) !== (ring[j][0] > lat) && lng < ((ring[j][1] - ring[i][1]) * (lat - ring[i][0])) / (ring[j][0] - ring[i][0]) + ring[i][1]) c = !c; return c; };
const within = (d: District, lng: number, lat: number) => d.polygons.some(poly => inRing(lat, lng, poly[0]));
const districtOf = (lng: number, lat: number) => districts.find(d => within(d, lng, lat))?.name ?? (within(municipality, lng, lat) ? 'Amsterdam, between the districts' : 'neighbouring municipalities');

// Willem de Zwijgerlaan's centreline, metres.
const wdz: Array<[number, number]> = [];
for (const s of JSON.parse(readFileSync(`${BASE}/streets-routing.json`, 'utf8')) as any[]) if (s.name === 'Willem de Zwijgerlaan') for (const path of s.paths ?? [s.path]) for (const [lat, lng] of path) wdz.push(toLocal(lng, lat));
const nearWdz = (p: [number, number], r: number) => wdz.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) <= r);

type Pand = { id: string; c: [number, number]; lng: number; lat: number; areaM2: number; heightM: number; ring: number[][] };
const byDistrict = new Map<string, { pands: number; sheds: number; small: number; areas: number[]; heights: number[] }>();
let pands = 0, sized = 0, sheds = 0, streetSmall = 0, missingHeight = 0;
const wdzSheds: Pand[] = [], wdzHouses: Pand[] = [];
const allSheds: Pand[] = [];
for (const x of readdirSync(`${BASE}/building-tiles/14`)) for (const file of readdirSync(`${BASE}/building-tiles/14/${x}`)) {
  const features = jsonGz(`${BASE}/building-tiles/14/${x}/${file}`).features as Array<{ properties: Record<string, unknown>; geometry: any }>;
  for (const f of features) {
    pands++;
    const ring: number[][] | undefined = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates?.[0]?.[0];
    if (!ring || ring.length < 4) continue;
    const areaM2 = ringAreaM2(ring), eaves = eavesOf(f.properties);
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length, lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const d = districtOf(lng, lat);
    const row = byDistrict.get(d) ?? { pands: 0, sheds: 0, small: 0, areas: [], heights: [] };
    row.pands++; byDistrict.set(d, row);
    if (typeof f.properties.height !== 'number') missingHeight++;
    const small = isShedSized({ areaM2, eavesM: eaves });
    if (small) { sized++; row.small++; }
    const shed = isGardenShed(f, streets, ORIGIN);
    if (small && !shed && !f.properties.allotmentHouse) streetSmall++;
    const pand: Pand = { id: String(f.properties.id), c: toLocal(lng, lat), lng, lat, areaM2, heightM: shedHeightM(f.properties), ring };
    if (shed) { sheds++; row.sheds++; row.areas.push(areaM2); row.heights.push(pand.heightM); allSheds.push(pand); if (nearWdz(pand.c, 90)) wdzSheds.push(pand); }
    else if (areaM2 >= 30 && areaM2 <= 400 && Number(f.properties.height) >= 6 && nearWdz(pand.c, 22)) wdzHouses.push(pand);
  }
}

const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (n: number, d: number) => `${(100 * n / Math.max(1, d)).toFixed(1)}%`;
const lines: string[] = [];
lines.push(`pands ${pands}  shed-sized ${sized}  garden sheds ${sheds} (${pct(sheds, pands)} of pands)  small but street-facing, kept as buildings ${streetSmall}  missing height ${missingHeight}`);
lines.push('per district (sheds / pands, median area m2, median height m):');
for (const [name, r] of [...byDistrict].sort((a, b) => b[1].sheds - a[1].sheds)) lines.push(`  ${name.padEnd(26)} ${String(r.sheds).padStart(6)} / ${String(r.pands).padStart(6)}  ${pct(r.sheds, r.pands).padStart(6)}  ${median(r.areas).toFixed(1).padStart(5)} m2  ${median(r.heights).toFixed(2)} m`);
// Houses on Willem de Zwijgerlaan with a shed behind them: nearest-house assignment within 40 m.
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const owner = new Map<string, number>();
const reach = (h: Pand, s: Pand) => Math.min(...s.ring.map(([lng, lat]) => Math.min(...h.ring.map(([hl, ha]) => dist(toLocal(lng, lat), toLocal(hl, ha))))));
for (const s of wdzSheds) {
  let best = -1, bestD = 40;
  wdzHouses.forEach((h, i) => { if (dist(h.c, s.c) > 80) return; const d = reach(h, s); if (d < bestD) { bestD = d; best = i; } });
  if (best >= 0) owner.set(s.id, best);
}
const withShed = new Set(owner.values()).size;
const within25 = wdzHouses.filter(h => wdzSheds.some(s => dist(h.c, s.c) <= 60 && reach(h, s) <= 25)).length;
lines.push(`Willem de Zwijgerlaan: ${wdzHouses.length} houses within 22 m of the street (30-400 m2, 6 m+), ${wdzSheds.length} sheds within 90 m (median ${median(wdzSheds.map(s => s.areaM2)).toFixed(1)} m2, ${median(wdzSheds.map(s => s.heightM)).toFixed(2)} m tall)`);
lines.push(`  houses with a shed as their nearest neighbour within 40 m: ${withShed} (${pct(withShed, wdzHouses.length)}); with any shed within 25 m: ${within25} (${pct(within25, wdzHouses.length)}); sheds per house ${(wdzSheds.length / Math.max(1, wdzHouses.length)).toFixed(2)}`);
console.log(lines.join('\n'));
const out = process.argv.find(a => a.startsWith('--json='))?.split('=')[1];
if (out) writeFileSync(out, JSON.stringify({ pands, sized, sheds, streetSmall, districts: Object.fromEntries(byDistrict), wdz: { houses: wdzHouses.length, sheds: wdzSheds.length, withShed, within25 } }, null, 1));

// Pinned bands: the rule's output on today's extract (2026-10-13).
const assertBand = (label: string, v: number, lo: number, hi: number) => { if (!(v >= lo && v <= hi)) { console.error(`FAIL ${label}: ${v} outside ${lo}..${hi}`); process.exitCode = 1; } };
assertBand('garden sheds', sheds, 60_000, 130_000);
assertBand('median shed height m', median(allSheds.map(s => s.heightM)), 2.0, 3.0);
assertBand('median shed area m2', median(allSheds.map(s => s.areaM2)), 4, 20);
if (!existsSync(`${BASE}/boundaries.json`)) process.exitCode = 1;
