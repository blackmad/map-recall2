// roads-v1 fixture cells from the archived BGT wegdeel tiles (roads runtime lane, 2026-10-16).
//
//   npx tsx scripts/own-ground/fixture-bgt-roads.ts [--cells -3_-1,-2_-1,...] [--out public/data/extracts/amsterdam/roads-v1]
//
// The real extract is built by scripts/own-ground/build-bgt-roads.ts (roads data lane) from a
// re-fetch with `lokaal_id` and `fysiek_voorkomen`. Until it lands, this writes cells of the same
// schema (src/canalRecall/ownGround/roadCells.ts) from the 2026-10-13 archive
// (map-recall2-source-data/datasets/own-ground-20261013/bgt-wegdeel/tiles/<cell>_<q>.json.gz,
// {f: functie, h, r} per feature), so the runtime, tests and frames run on real geometry:
//
//   - dedupe across the padded quarter tiles by geometry (no lokaal_id);
//   - owner cell by the polygon's interior point; h < 0 dropped;
//   - class by bgtWidth classOf; mesh: the archive has no fysiek_voorkomen, so a carriageway takes the
//     surface the nearest OSM carriageway draws today (asphalt / klinker / cycle for a fietsstraat, priors
//     included), parking is klinker, inritten and footways paving, cycle paths red;
//   - kerbs: shared low/high edges at equal h (roadSurfaces kerbEdges); coverWays: OSM ways of the cell whose
//     2 m stations lie ≥ 80 % inside polygons of a compatible class (bgtWidth ownClasses);
//   - rings simplified to 0.1 m and delta-encoded as parks-v1.
//
// Output is not committed: the data lane publishes the real roads-v1 into the same path.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { classOf, fallbackClasses, ownClasses, type SurfaceClass } from '../../src/canalRecall/ownGround/bgtWidth.ts';
import { crossSection, type OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';
import { encodeLine, inRings, interiorPoint } from '../../src/canalRecall/ownGround/parks.ts';
import { coveredShare, kerbEdges, simplifyRing, COVER_SHARE } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { ROAD_CELL_VERSION, ROADS_ATTRIBUTION, ROADS_MANIFEST_VERSION, roadCellProblems, type RoadCell, type RoadClass, type RoadMesh, type RoadsManifest } from '../../src/canalRecall/ownGround/roadCells.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const ROOT = 'public/data/extracts/amsterdam';
const TILES = '/Users/blackmad/Code/map-recall2-source-data/datasets/own-ground-20261013/bgt-wegdeel/tiles';
export const PILOT_CELLS = ['-3_-1', '-2_-1', '-3_0', '-2_0', '-1_-1', '-1_0', '-2_1'];
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const cells = arg('--cells')?.split(',') ?? PILOT_CELLS;
const OUT = arg('--out') ?? `${ROOT}/roads-v1`;

interface Poly { f: string; c: RoadClass; h: number; rings: Vec2[][]; box: [number, number, number, number] }

const readExtract = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const store = new GroundStore(readExtract);
await store.init();

const tileCache = new Map<string, Poly[]>();
function tile(key: string, q: number): Poly[] {
  const file = `${TILES}/${key}_${q}.json.gz`;
  let polys = tileCache.get(file);
  if (!polys) {
    polys = [];
    if (existsSync(file)) for (const f of JSON.parse(gunzipSync(readFileSync(file)).toString()) as { f: string; h: number; r: [number, number][][] }[]) {
      const cls = classOf(f.f);
      if (cls === 'other' || f.h < 0) continue;
      // The archive repeats vertices dozens of times (a 1 cm rounding of curve densification): drop consecutive duplicates at load, or 36 tiles do not fit in memory.
      const rings = f.r.map(r => { const out: Vec2[] = []; for (const [lng, lat] of r) { const q = toLocal(lng, lat); if (!out.length || Math.hypot(q[0] - out[out.length - 1][0], q[1] - out[out.length - 1][1]) > 0.005) out.push(q); } return out; });
      if (rings[0].length < 4) continue;
      const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
      polys.push({ f: f.f, c: cls as RoadClass, h: f.h, rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
    tileCache.set(file, polys);
  }
  return polys;
}
/** Geometry key for the dedupe across padded tiles: functie, h, vertex count and the ring's first three vertices (1 cm). */
const geoKey = (p: Poly) => `${p.f}|${p.h}|${p.rings[0].length}|${p.rings[0].slice(0, 3).map(q => `${Math.round(q[0] * 100)},${Math.round(q[1] * 100)}`).join(';')}`;

/** Nearest OSM carriageway's drawn surface within `reach` metres of a point (a 25 m grid over the 3×3 ways). */
function carriagewayMeshes(extracts: OsmGroundExtract[]) {
  const G = 25, grid = new Map<string, { a: Vec2; b: Vec2; mesh: RoadMesh }[]>();
  for (const e of extracts) for (const w of e.ways) {
    const s = crossSection(w.tags, w.bw);
    if (!s || s.bands[0].kind !== 'carriageway') continue;
    const mesh = s.bands[0].surface as RoadMesh, pts = w.g.map(([lng, lat]) => toLocal(lng, lat));
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) { const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ a, b, mesh }); }
    }
  }
  return (p: Vec2, reach = 12): RoadMesh | null => {
    let best: RoadMesh | null = null, bd = reach;
    const gx = Math.floor(p[0] / G), gy = Math.floor(p[1] / G);
    for (let i = gx - 1; i <= gx + 1; i++) for (let j = gy - 1; j <= gy + 1; j++) for (const s of grid.get(`${i}:${j}`) ?? []) {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l2));
      const d = Math.hypot(s.a[0] + dx * t - p[0], s.a[1] + dy * t - p[1]);
      if (d < bd) { bd = d; best = s.mesh; }
    }
    return best;
  };
}

function meshOf(p: Poly, nearest: (q: Vec2) => RoadMesh | null, ip: Vec2): RoadMesh {
  if (p.c === 'cycle') return 'cycle';
  if (p.c === 'foot' || p.c === 'pedestrian' || p.c === 'driveway') return 'paving';
  if (p.c === 'parking') return 'klinker';
  return nearest(ip) ?? 'asphalt';
}

/** Bucketed point-in-polygon over the 3×3 polygon set. */
function pointIndex(polys: readonly Poly[]) {
  const G = 25, grid = new Map<string, number[]>();
  polys.forEach((p, k) => { for (let gx = Math.floor(p.box[0] / G); gx <= Math.floor(p.box[2] / G); gx++) for (let gy = Math.floor(p.box[1] / G); gy <= Math.floor(p.box[3] / G); gy++) { const key = `${gx}:${gy}`; (grid.get(key) ?? grid.set(key, []).get(key)!).push(k); } });
  return (x: number, y: number): Poly[] => {
    const out: Poly[] = [];
    for (const k of grid.get(`${Math.floor(x / G)}:${Math.floor(y / G)}`) ?? []) { const p = polys[k]; if (x >= p.box[0] && x <= p.box[2] && y >= p.box[1] && y <= p.box[3] && inRings(p.rings, x, y)) out.push(p); }
    return out;
  };
}

const report: Record<string, unknown> = {};
const written: string[] = [];
mkdirSync(`${OUT}/cells`, { recursive: true });
let totalGz = 0;
for (const key of cells) {
  const t0 = Date.now();
  const [x0, y0, x1, y1] = store.cellRect(key);
  const seen = new Set<string>(), all: Poly[] = [];
  for (const k of GroundStore.neighbours(key)) for (let q = 0; q < 4; q++) for (const p of tile(k, q)) { const g = geoKey(p); if (!seen.has(g)) { seen.add(g); all.push(p); } }
  const extracts = (await Promise.all(GroundStore.neighbours(key).map(k => store.osmCell(k)))).filter((e): e is OsmGroundExtract => !!e);
  const nearest = carriagewayMeshes(extracts);
  const own: { p: Poly; k: RoadMesh }[] = [];
  const byClass: Record<string, number> = {}, byH: Record<string, number> = {}, byMesh: Record<string, number> = {};
  for (const p of all) {
    const ip = interiorPoint(p.rings);
    if (!ip || ip[0] < x0 || ip[0] >= x1 || ip[1] < y0 || ip[1] >= y1) continue;
    const k = meshOf(p, nearest, ip);
    own.push({ p, k });
    byClass[p.c] = (byClass[p.c] ?? 0) + 1; byH[p.h] = (byH[p.h] ?? 0) + 1; byMesh[k] = (byMesh[k] ?? 0) + 1;
  }
  // Kerbs over the whole 3×3 set (runs crossing the seam are found), kept by the run's midpoint.
  const kerbs = kerbEdges(all.map(p => ({ c: p.c, h: p.h, rings: p.rings }))).filter(run => { const m = run[Math.floor(run.length / 2)]; return m[0] >= x0 && m[0] < x1 && m[1] >= y0 && m[1] < y1; });
  // Cover: the cell's own OSM ways over compatible polygons.
  const at = pointIndex(all), osm = await store.osmCell(key);
  const coverWays: number[] = [], coverBy: Record<string, { n: number; covered: number }> = {};
  for (const w of osm?.ways ?? []) {
    const s = crossSection(w.tags, w.bw);
    if (!s) continue;
    const hw = w.tags.highway, bridge = !!w.tags.bridge && w.tags.bridge !== 'no';
    const classes = new Set<SurfaceClass>([...ownClasses(hw, w.tags), ...(fallbackClasses(hw) ?? [])]);
    const line = w.g.map(([lng, lat]) => toLocal(lng, lat));
    const share = coveredShare(line, (x, y) => at(x, y).some(p => classes.has(p.c) && (bridge ? p.h >= 1 : p.h === 0)));
    const row = (coverBy[hw] ??= { n: 0, covered: 0 });
    row.n++;
    if (share >= COVER_SHARE) { row.covered++; coverWays.push(w.id); }
  }
  const cell: RoadCell = {
    version: ROAD_CELL_VERSION, key,
    surfaces: own.map(({ p, k }) => ({ k, c: p.c, h: p.h, r: p.rings.map(r => encodeLine(simplifyRing(r, 0.1))).filter(e => e.length >= 6) })).filter(s => s.r.length && s.r[0].length >= 6),
    kerbs: kerbs.map(run => encodeLine(run)).filter(e => e.length >= 4),
    coverWays: coverWays.sort((a, b) => a - b),
  };
  const problems = roadCellProblems(cell);
  if (problems.length) throw new Error(`${key}: ${problems.join('; ')}`);
  const gz = gzipSync(JSON.stringify(cell));
  writeFileSync(`${OUT}/cells/${key}.json.gz`, gz);
  written.push(key);
  totalGz += gz.length;
  const kerbM = kerbs.reduce((s, run) => s + run.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - run[i][0], q[1] - run[i][1]), 0), 0);
  report[key] = { polygons: cell.surfaces.length, byClass, byH, byMesh, kerbs: cell.kerbs.length, kerbM: Math.round(kerbM), coverWays: coverWays.length, coverBy, gzKB: +(gz.length / 1024).toFixed(1), ms: Date.now() - t0 };
  console.log(key, JSON.stringify(report[key]));
}
const manifest: RoadsManifest = { version: ROADS_MANIFEST_VERSION, cells: written.sort(), fetched: '2026-10-13T00:00:00Z', attribution: ROADS_ATTRIBUTION, report: { fixture: 'archived wegdeel tiles (no fysiek_voorkomen: carriageway mesh from the nearest OSM way), scripts/own-ground/fixture-bgt-roads.ts', totalGzKB: +(totalGz / 1024).toFixed(1), cells: report } };
writeFileSync(`${OUT}/cells.json`, JSON.stringify(manifest));
console.log(JSON.stringify({ cells: written.length, totalGzKB: +(totalGz / 1024).toFixed(1), out: OUT }));
