/**
 * No building may stand on a car road. Every building-tile feature that stands
 * on the ground (minHeight < RIDE_UNDER_M) with >= MAX_ROAD_M of car-road
 * centreline more than DECK_ROAD_INSET_M inside its outline is a failure,
 * unless reviewed in scripts/data/buildings-over-roads.json (a portal over a
 * tunnel mouth, a building over a covered street).
 *
 * The 2026-10-30 reports (metro halls on Weesperstraat/Wibautstraat, garages
 * under de Pijp and Museumplein) were all this shape.
 *
 *   node --import tsx scripts/check-buildings-over-roads.ts           # check
 *   node --import tsx scripts/check-buildings-over-roads.ts --list    # print every hit with its tags-free summary
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { centrelineInsideM } from '../src/canalRecall/undergroundBuildings';
import { DECK_ROAD_INSET_M } from '../src/canalRecall/bagGaps';

const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const MAX_ROAD_M = 20;
/** A part raised this far (building:min_level 1, a Kerkstraat bridge house) is ridden under, not into. */
const RIDE_UNDER_M = 2.5;
const list = process.argv.includes('--list');
type LngLat = [number, number];
const CAR = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const streets = JSON.parse(fs.readFileSync(path.join(ROOT, 'streets-routing.json'), 'utf8')) as { name?: string; highway?: string; path: [number, number][]; paths?: [number, number][][] }[];
const CELL = 0.002, grid = new Map<string, { seg: [LngLat, LngLat]; name: string }[]>();
for (const street of streets) {
  if (!CAR.has(street.highway ?? '')) continue;
  for (const line of street.paths ?? [street.path]) for (let i = 1; i < line.length; i++) {
    const a: LngLat = [line[i - 1][1], line[i - 1][0]], b: LngLat = [line[i][1], line[i][0]];
    for (let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x++)
      for (let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y++) {
        const key = `${x},${y}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push({ seg: [a, b], name: street.name ?? '' });
      }
  }
}
const reviewed = JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'buildings-over-roads.json'), 'utf8')) as Record<string, string>;
const hits: { id: string; roadM: number; height: unknown; streets: string[]; tile: string }[] = [];
const zoomDir = path.join(ROOT, 'bag-tiles', '14');
for (const x of fs.readdirSync(zoomDir).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(zoomDir, x)).filter(n => n.endsWith('.geojson.gz'))) {
  const { features } = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(zoomDir, x, file))).toString('utf8')) as { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] };
  for (const f of features) {
    if (Number(f.properties.minHeight ?? 0) >= RIDE_UNDER_M) continue;
    const polygons = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as LngLat[][][];
    let w = Infinity, so = Infinity, e = -Infinity, n = -Infinity;
    for (const p of polygons) for (const [lng, lat] of p[0]) { w = Math.min(w, lng); e = Math.max(e, lng); so = Math.min(so, lat); n = Math.max(n, lat); }
    const near = new Set<{ seg: [LngLat, LngLat]; name: string }>();
    for (let gx = Math.floor(w / CELL); gx <= Math.floor(e / CELL); gx++)
      for (let gy = Math.floor(so / CELL); gy <= Math.floor(n / CELL); gy++)
        for (const s of grid.get(`${gx},${gy}`) ?? []) {
          const [[ax, ay], [bx, by]] = s.seg;
          if (Math.max(ax, bx) >= w && Math.min(ax, bx) <= e && Math.max(ay, by) >= so && Math.min(ay, by) <= n) near.add(s);
        }
    if (!near.size) continue;
    const byName = new Map<string, number>();
    for (const s of near) { const m = centrelineInsideM(polygons, [s.seg], DECK_ROAD_INSET_M); if (m > 0) byName.set(s.name, (byName.get(s.name) ?? 0) + m); }
    const roadM = [...byName.values()].reduce((a, b) => a + b, 0);
    if (roadM >= MAX_ROAD_M) hits.push({ id: String(f.properties.id), roadM: Math.round(roadM), height: f.properties.height, streets: [...byName.keys()], tile: `${x}/${file.replace('.geojson.gz', '')}` });
  }
}
hits.sort((a, b) => b.roadM - a.roadM);
const unreviewed = hits.filter(h => !(h.id in reviewed));
const stale = Object.keys(reviewed).filter(id => !hits.some(h => h.id === id));
if (list) for (const h of hits) console.log(`${h.id in reviewed ? 'ok ' : 'NEW'} ${h.roadM} m  h=${h.height}  ${h.id}  ${h.streets.join(', ')}  ${h.tile}`);
console.log(`buildings over roads: ${hits.length} on >= ${MAX_ROAD_M} m of car road, ${hits.length - unreviewed.length} reviewed, ${unreviewed.length} new, ${stale.length} stale reviews`);
if (unreviewed.length) {
  for (const h of unreviewed.slice(0, 20)) console.error(`  NEW ${h.id} ${h.roadM} m over ${h.streets.join(', ')} (${h.tile})`);
  process.exit(1);
}
