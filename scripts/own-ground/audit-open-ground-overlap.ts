// How much of the open-ground cover that reads as bare ground (sand, bare earth) lies where the city is now built or
// paved (lane R2-D 2026-11-13, feedback 762c6e04 and b1e259b9 at the Houthavens).
//
//   node --import tsx scripts/own-ground/audit-open-ground-overlap.ts [--dir=public/data/extracts/amsterdam/open-ground-v1]
//        [--covers=sand,bare] [--step=2] [--cells=-2_2,-1_1] [--json=artifacts/own-ground/open-ground-overlap.json]
//
// For every open-ground polygon of the chosen covers, a --step m grid inside it is tested against
//   buildings  the BAG footprints the game draws (bag-tiles z14, ids and rings as the building bundles)
//   paving     every roads-v1 surface at ground level (h 0): carriageway, footway, cycle path, square, parking
// and the m² per cover and per class are summed (the grid cell's area, the polygon's holes honoured). BGT is one planar
// partition, so a polygon from the same survey never overlaps its neighbours; what overlaps here is a stale polygon
// (BGT `zand` of a building site that is built since) or a footprint newer than the survey.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeLine, inRings } from '../../src/canalRecall/ownGround/parks.ts';
import { decodeRoadCell, roadCellDir, type RoadCell, type RoadsManifest } from '../../src/canalRecall/ownGround/roadCells.ts';
import type { OpenGroundCell } from '../../src/canalRecall/ownGround/groundSurface.ts';

type Vec2 = [number, number];
const ROOT = 'public/data/extracts/amsterdam';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DIR = arg('dir', join(ROOT, 'open-ground-v1')), COVERS = arg('covers', 'sand,bare').split(','), STEP = Number(arg('step', '2'));
const ONLY = arg('cells', '') ? new Set(arg('cells', '').split(',')) : null;
const gz = <T>(f: string): T | null => existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) as T : null;

/** Spatial hash of polygons (outer ring + holes), 16 m buckets, point-in-polygon by even-odd. */
class PolyIndex {
  private readonly b = new Map<string, number[]>();
  private readonly polys: Vec2[][][] = [];
  constructor(private readonly size = 16) {}
  add(rings: Vec2[][]): void {
    const id = this.polys.push(rings) - 1;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of rings[0]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    for (let i = Math.floor(x0 / this.size); i <= Math.floor(x1 / this.size); i++) for (let j = Math.floor(y0 / this.size); j <= Math.floor(y1 / this.size); j++) {
      const k = `${i},${j}`; (this.b.get(k) ?? this.b.set(k, []).get(k)!).push(id);
    }
  }
  has(x: number, y: number): boolean {
    for (const id of this.b.get(`${Math.floor(x / this.size)},${Math.floor(y / this.size)}`) ?? []) if (inRings(this.polys[id], x, y)) return true;
    return false;
  }
}

const buildings = new PolyIndex();
const tiles = (JSON.parse(readFileSync(join(ROOT, 'bag-tiles/index-z14.json'), 'utf8')) as { tileList: string[] }).tileList;
let nb = 0;
for (const t of tiles) {
  const fc = gz<{ features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }>(join(ROOT, 'bag-tiles', `${t}.geojson.gz`));
  for (const f of fc?.features ?? []) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const p of polys) { buildings.add(p.map(r => r.map(([x, y]) => toLocal(x, y) as Vec2))); nb++; }
  }
}
console.log(`buildings: ${nb} footprints from ${tiles.length} tiles`);

const roadsDir = join(ROOT, 'roads-v1', roadCellDir(JSON.parse(readFileSync(join(ROOT, 'roads-v1/cells.json'), 'utf8')) as RoadsManifest));
const paving = new PolyIndex();
let np = 0;
for (const f of readdirSync(roadsDir)) {
  const c = gz<RoadCell>(join(roadsDir, f));
  if (c) for (const s of decodeRoadCell(c).surfaces) if (s.h === 0) { paving.add(s.rings); np++; }
}
console.log(`paving: ${np} ground-level road surfaces`);

interface Row { cover: string; m2: number; onBuilding: number; onPaving: number; polygons: number; polygonsMostlyBuilt: number }
const rows = new Map<string, Row>();
const worst: { id: string; cell: string; cover: string; m2: number; building: number; paving: number }[] = [];
for (const f of readdirSync(join(DIR, 'cells'))) {
  const key = f.replace('.json.gz', '');
  if (ONLY && !ONLY.has(key)) continue;
  const cell = gz<OpenGroundCell>(join(DIR, 'cells', f));
  for (const a of cell?.areas ?? []) {
    if (!COVERS.includes(a.k)) continue;
    const rings = a.r.map(decodeLine) as Vec2[][];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of rings[0]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    let n = 0, nbld = 0, npav = 0;
    for (let x = Math.ceil(x0 / STEP) * STEP + STEP / 2; x < x1; x += STEP) for (let y = Math.ceil(y0 / STEP) * STEP + STEP / 2; y < y1; y += STEP) {
      if (!inRings(rings, x, y)) continue;
      n++;
      if (buildings.has(x, y)) nbld++; else if (paving.has(x, y)) npav++;
    }
    const cellM2 = STEP * STEP, r = rows.get(a.k) ?? rows.set(a.k, { cover: a.k, m2: 0, onBuilding: 0, onPaving: 0, polygons: 0, polygonsMostlyBuilt: 0 }).get(a.k)!;
    r.m2 += n * cellM2; r.onBuilding += nbld * cellM2; r.onPaving += npav * cellM2; r.polygons++;
    if (n && (nbld + npav) / n > 0.5) r.polygonsMostlyBuilt++;
    if ((nbld + npav) * cellM2 > 400) worst.push({ id: a.id, cell: key, cover: a.k, m2: n * cellM2, building: nbld * cellM2, paving: npav * cellM2 });
  }
}
const out = { dir: DIR, step: STEP, rows: [...rows.values()].map(r => ({ ...r, onBuildingPct: +(100 * r.onBuilding / (r.m2 || 1)).toFixed(1), onPavingPct: +(100 * r.onPaving / (r.m2 || 1)).toFixed(1) })), worst: worst.sort((a, b) => b.building + b.paving - a.building - a.paving).slice(0, 25) };
console.log(JSON.stringify(out, null, 1));
const json = arg('json', '');
if (json) { mkdirSync(dirname(json), { recursive: true }); writeFileSync(json, JSON.stringify(out, null, 1)); }
