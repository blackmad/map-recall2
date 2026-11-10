// Build the open-ground-v1 extract (lane open-ground-look 2026-11-10): the BGT open ground that no other extract
// draws, per own-ground 1 km cell, so lawns, rough lots, reeds and bare land stop drawing as the paving-grey land.
// Classification: src/canalRecall/ownGround/groundSurface.ts. Report: docs/reports/open-ground-look-20261110.md.
//
//   npx tsx scripts/own-ground/fetch-bgt-open-ground.ts                   # the raw BGT (cached, artifacts/own-ground/raw)
//   npx tsx scripts/own-ground/build-open-ground.ts [--cells k1,k2] [--no-cir] [--concurrency 4]
//       classify + cut free of the OSM area fills; stages cells, census.json and report.json in STAGING
//   npx tsx scripts/own-ground/build-open-ground.ts --publish             # after review: STAGING → public/.../open-ground-v1
//
// Sources (open data):
//   BGT begroeidterreindeel, onbegroeidterreindeel (Kadaster / gemeente Amsterdam, CC0 1.0), PDOK OGC API
//   PDOK Luchtfoto CIR (Beeldmateriaal Nederland, CC BY 4.0) at 0.5 m: the vegetated share of each `erf` (yard),
//     which BGT leaves untyped (courtyards.ts pixelVegetated / vegetatedShare, as add-bgt-courtyards.ts)
//   OSM areas (ODbL), the published own-ground-osm-v1 cells: what they already paint is cut out
// What is left out (drawn by another extract): polygons courtyards-v1 holds (by BGT id), the paved onbegroeid that
// roads-v1 draws as squares (and the larger paved yards, which keep the land's paving grey: they are paved), every
// polygon off the ground level (relatieve_hoogteligging ≠ 0).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import polygonClipping from 'polygon-clipping';
import { cellBounds, elevationIndex } from './game-cells.ts';
import { cellKey, lngLatToLocal } from '../../src/canalRecall/elevation/elevationData.ts';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { encodeLine, inRings, interiorPoint, polygonArea } from '../../src/canalRecall/ownGround/parks.ts';
import type { OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';
import { pixelVegetated, vegetatedShare, type CourtyardsCell } from '../../src/canalRecall/ownGround/courtyards.ts';
import { ANCILLARY_SQUARE_MAX_M2, decodeRoadCell, roadCellDir, type RoadCell, type RoadsManifest } from '../../src/canalRecall/ownGround/roadCells.ts';
import { groundSurface, needsAerial, OPEN_GROUND_COVERS, OPEN_GROUND_TOTAL_BUDGET_GZ, type GroundSurfaceClass, type OpenGroundCell, type OpenGroundCover, type OpenGroundManifest } from '../../src/canalRecall/ownGround/groundSurface.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';
import { readOpenGroundRaw, OPEN_GROUND_COLLECTIONS, type OpenGroundCollection } from './fetch-bgt-open-ground.ts';
import type { RawWegdeel } from './fetch-bgt-roads.ts';

type LngLat = [number, number];
const ROOT = 'public/data/extracts/amsterdam';
const OSM = join(ROOT, 'own-ground-osm-v1');
const COURTYARDS = join(ROOT, 'courtyards-v1');
const ROADS = join(ROOT, 'roads-v1');
const PUBLISHED = join(ROOT, 'open-ground-v1');
const STAGING = 'artifacts/own-ground/staging/open-ground-v1';
const CIR_CACHE = 'artifacts/own-ground/raw/cir-open-ground';
const WMS = 'https://service.pdok.nl/hwh/luchtfotocir/wms/v1_0';
const IMAGERY_LAYER = '2025_ortho25IR';
const IMAGE_M_PER_PX = 0.5;
/** Douglas–Peucker tolerance for the published rings, metres (courtyards-v1's). */
const SIMPLIFY_M = 0.15;
/** Parts smaller than this (m²) are not drawn: slivers along an OSM fill's edge. */
export const MIN_PART_M2 = 2;
const BUURTEN = '/Users/blackmad/Code/map-recall2-source-data/datasets/gebieden-buurten-20261016/buurten.geojson.gz';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const useCir = !process.argv.includes('--no-cir');
const index = elevationIndex();
const osmManifest = JSON.parse(readFileSync(join(OSM, 'cells.json'), 'utf8')) as { cells: string[] };
const roadsDir = join(ROADS, roadCellDir(JSON.parse(readFileSync(join(ROADS, 'cells.json'), 'utf8')) as RoadsManifest));
/** The cell (elevation-v1 key, as GroundStore.cellAt) of a game-frame point. */
const cellOfLocal = (p: Vec2) => { const [lng, lat] = fromLocal(p[0], p[1]), [x, y] = lngLatToLocal(index, lng, lat); return cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM)); };
const gz = <T>(f: string): T | null => existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) as T : null;
const bboxOf = (r: readonly Vec2[]): [number, number, number, number] => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };

// ------------------------------------------------------------------ Centrum (stadsdeel A) for the census

const centrum: { rings: Vec2[][]; b: [number, number, number, number] }[] = (() => {
  const g = existsSync(BUURTEN) ? JSON.parse(gunzipSync(readFileSync(BUURTEN)).toString()) as { features: { properties: { code: string }; geometry: { type: string; coordinates: any } }[] } : { features: [] };
  return g.features.filter(f => f.properties.code.startsWith('A')).flatMap(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as LngLat[][][])
    .map(poly => { const rings = poly.map(r => r.map(([x, y]) => toLocal(x, y) as Vec2)); return { rings, b: bboxOf(rings[0]) }; });
})();
const inCentrum = (p: Vec2) => centrum.some(c => p[0] >= c.b[0] && p[0] <= c.b[2] && p[1] >= c.b[1] && p[1] <= c.b[3] && inRings(c.rings, p[0], p[1]));

// ------------------------------------------------------------------ CIR aerial (erf only)

const merc = (lng: number, lat: number): Vec2 => [lng * 20037508.342789244 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];
interface Tile { x0: number; y0: number; x1: number; y1: number; w: number; h: number; px: Buffer }
async function cirTile(key: string, q: number, ll: number[]): Promise<Tile | null> {
  const [a, b] = [merc(ll[0], ll[1]), merc(ll[2], ll[3])];
  const scale = 1 / Math.cos(((ll[1] + ll[3]) / 2) * Math.PI / 180);
  const w = Math.round((b[0] - a[0]) / (IMAGE_M_PER_PX * scale)), h = Math.round((b[1] - a[1]) / (IMAGE_M_PER_PX * scale));
  const file = join(CIR_CACHE, key, `${q}.jpg`);
  if (!existsSync(file)) {
    const url = `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${IMAGERY_LAYER}&STYLES=&CRS=EPSG:3857&BBOX=${[a[0], a[1], b[0], b[1]].map(v => v.toFixed(2)).join(',')}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } }).catch(() => null);
      const buf = res?.ok && (res.headers.get('content-type') ?? '').startsWith('image/') ? await res.arrayBuffer().then(x => Buffer.from(x)).catch(() => null) : null;
      if (buf) { mkdirSync(join(CIR_CACHE, key), { recursive: true }); writeFileSync(file, buf); break; }
      if (attempt > 5) { console.error(`CIR ${res?.status} ${key}/${q}`); return null; }
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  const { data, info } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], w: info.width, h: info.height, px: data };
}
function pixelCounts(rings: LngLat[][], tiles: Tile[]) {
  const counts = { veg: 0, bare: 0, shadow: 0 };
  const m = rings.map(r => r.map(([lng, lat]) => merc(lng, lat)));
  const [x0, y0, x1, y1] = bboxOf(m[0]);
  for (const t of tiles) {
    if (x1 < t.x0 || x0 > t.x1 || y1 < t.y0 || y0 > t.y1) continue;
    const sx = (t.x1 - t.x0) / t.w, sy = (t.y1 - t.y0) / t.h;
    const i0 = Math.max(0, Math.floor((x0 - t.x0) / sx)), i1 = Math.min(t.w - 1, Math.ceil((x1 - t.x0) / sx));
    const j0 = Math.max(0, Math.floor((t.y1 - y1) / sy)), j1 = Math.min(t.h - 1, Math.ceil((t.y1 - y0) / sy));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = t.x0 + (i + 0.5) * sx, y = t.y1 - (j + 0.5) * sy;
      if (!inRings(m, x, y)) continue;
      const o = (j * t.w + i) * 3, v = pixelVegetated(t.px[o], t.px[o + 1], t.px[o + 2]);
      if (v === null) counts.shadow++; else if (v) counts.veg++; else counts.bare++;
    }
  }
  return counts;
}

// ------------------------------------------------------------------ geometry

function simplify(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    let best = -1, at = -1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / l; if (d > best) { best = d; at = k; } }
    if (best > tol) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}
/** An open ring (closing vertex dropped) simplified in two halves, so its ends stay put. */
function simplifyRing(r: Vec2[]): Vec2[] {
  const open = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
  if (open.length < 6) return open;
  const closed = [...open, open[0]], mid = closed.length >> 1;
  return [...simplify(closed.slice(0, mid + 1), SIMPLIFY_M).slice(0, -1), ...simplify(closed.slice(mid), SIMPLIFY_M).slice(0, -1)];
}

/**
 * The polygons open ground is cut free of, 3×3 neighbourhood (local frame), bucketed on a 50 m grid: OSM area rings,
 * and the roads-v1 surfaces above the ground (h ≥ 1: a bridge, viaduct or ramp polygon over the ground-level BGT
 * partition, whose approaches the game draws at ground height: the Nauernaseweg way deck, bridge-gaps pin).
 */
class RingIndex {
  private readonly grid = new Map<number, number[]>();
  readonly rings: { r: Vec2[][]; b: [number, number, number, number] }[] = [];
  add(r: Vec2[], holes: Vec2[][] = []) {
    const b = bboxOf(r), k = this.rings.push({ r: [r, ...holes], b }) - 1;
    for (let i = Math.floor(b[0] / 50); i <= Math.floor(b[2] / 50); i++) for (let j = Math.floor(b[1] / 50); j <= Math.floor(b[3] / 50); j++) {
      const g = i * 100000 + j, l = this.grid.get(g); if (l) l.push(k); else this.grid.set(g, [k]);
    }
  }
  near(b: readonly number[]): { r: Vec2[][]; b: [number, number, number, number] }[] {
    const out = new Set<number>();
    for (let i = Math.floor(b[0] / 50); i <= Math.floor(b[2] / 50); i++) for (let j = Math.floor(b[1] / 50); j <= Math.floor(b[3] / 50); j++) for (const k of this.grid.get(i * 100000 + j) ?? []) out.add(k);
    return [...out].map(k => this.rings[k]).filter(o => o.b[0] < b[2] && o.b[2] > b[0] && o.b[1] < b[3] && o.b[3] > b[1]);
  }
}

/** `rings` minus every OSM ring and raised road surface it overlaps, as polygons (rings outer first). Falls back to all-or-nothing on a clipping failure. */
function cutFree(rings: Vec2[][], osm: RingIndex): { parts: Vec2[][][]; cut: boolean; failed: boolean } {
  const near = osm.near(bboxOf(rings[0]));
  if (!near.length) return { parts: [rings], cut: false, failed: false };
  try {
    const res = polygonClipping.difference(rings as any, ...near.map(n => n.r as any));
    return { parts: res as unknown as Vec2[][][], cut: true, failed: false };
  } catch {
    const at = interiorPoint(rings);
    const under = !!at && near.some(n => inRings(n.r, at[0], at[1]));
    return { parts: under ? [] : [rings], cut: true, failed: true };
  }
}

// ------------------------------------------------------------------ per cell

/** Census bucket: BGT class and fysiek_voorkomen. */
type Bucket = string;
interface CellReport {
  key: string; candidates: number; drawn: number; parts: number; cutByOsm: number; clipFailures: number; erf: number; erfGrass: number; erfUnknown: number;
  /** m² of BGT open ground left to the land (no extract drew it), before this extract and after it, per bucket. */
  greyBefore: Record<Bucket, number>; greyAfter: Record<Bucket, number>;
  greyBeforeCentrum: Record<Bucket, number>; greyAfterCentrum: Record<Bucket, number>;
  m2: Partial<Record<OpenGroundCover, number>>; bytes: number; ms: number;
}

const add = (o: Record<string, number>, k: string, v: number) => { o[k] = (o[k] ?? 0) + v; };

async function cell(key: string): Promise<CellReport> {
  const t0 = Date.now();
  const rep: CellReport = { key, candidates: 0, drawn: 0, parts: 0, cutByOsm: 0, clipFailures: 0, erf: 0, erfGrass: 0, erfUnknown: 0, greyBefore: {}, greyAfter: {}, greyBeforeCentrum: {}, greyAfterCentrum: {}, m2: {}, bytes: 0, ms: 0 };
  const [cx, cy] = key.split('_').map(Number);
  const osm = new RingIndex(), courtyardIds = new Set<string>();
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const k = `${cx + i}_${cy + j}`;
    for (const a of gz<OsmGroundExtract>(join(OSM, 'cells', `${k}.json.gz`))?.areas ?? []) for (const r of a.rings) if (r.length >= 4) osm.add(r.map(([x, y]) => toLocal(x, y) as Vec2));
    for (const a of gz<CourtyardsCell>(join(COURTYARDS, 'cells', `${k}.json.gz`))?.areas ?? []) courtyardIds.add(a.id);
    const roads = gz<RoadCell>(join(roadsDir, `${k}.json.gz`));
    if (roads) for (const s of decodeRoadCell(roads).surfaces) if (s.h >= 1 && s.rings[0].length >= 3) osm.add(s.rings[0], s.rings.slice(1).filter(r => r.length >= 3));
  }
  type Pick = { f: RawWegdeel; c: OpenGroundCollection; ll: LngLat[][]; local: Vec2[][]; at: Vec2; area: number; n: number };
  const picks: Pick[] = [];
  const seen = new Set<string>();
  for (const c of OPEN_GROUND_COLLECTIONS) for (const f of readOpenGroundRaw(key, c)?.features ?? []) {
    if (f.h !== 0 || (f.status && f.status !== 'bestaand') || f.eind) continue;
    f.g.forEach((poly, n) => {
      const id = `${f.id}${n ? `.${n}` : ''}`;
      if (seen.has(id)) return; seen.add(id);
      const local = poly.map(r => r.map(([x, y]) => toLocal(x, y) as Vec2));
      const at = interiorPoint(local);
      if (!at || cellOfLocal(at) !== key) return;
      picks.push({ f, c, ll: poly, local, at, area: polygonArea(local), n });
    });
  }
  // The aerial, only where a yard needs it (quadrants of the cell).
  const tiles: Tile[] = [];
  if (useCir && picks.some(p => needsAerial(p.c, p.f.fv))) {
    const [lo, la, hi, ha] = cellBounds(index, key), mx = (lo + hi) / 2, my = (la + ha) / 2;
    const quads = [[lo, la, mx, my], [mx, la, hi, my], [lo, my, mx, ha], [mx, my, hi, ha]], pad = 30 / 68000, padY = 30 / 111300;
    for (let q = 0; q < 4; q++) {
      const [a, b, c, d] = quads[q];
      if (!picks.some(p => needsAerial(p.c, p.f.fv) && p.ll[0].some(([x, y]) => x >= a - pad && x <= c + pad && y >= b - padY && y <= d + padY))) continue;
      const t = await cirTile(key, q, [a - pad, b - padY, c + pad, d + padY]);
      if (t) tiles.push(t);
    }
  }
  const areas: OpenGroundCell['areas'] = [];
  for (const p of picks) {
    if (courtyardIds.has(p.f.id) || courtyardIds.has(`${p.f.id}.${p.n}`)) continue;
    const props = { functie: p.f.functie, fysiek_voorkomen: p.f.fv, plus_fysiek_voorkomen: p.f.pfv };
    const erf = p.f.fv === 'erf';
    let share: number | null = null;
    if (needsAerial(p.c, p.f.fv)) share = tiles.length ? vegetatedShare(pixelCounts(p.ll, tiles)) : null;
    if (erf) { rep.erf++; if (share === null) rep.erfUnknown++; }
    const v = groundSurface(p.c, props, share);
    if (erf && v.cls === 'grass') rep.erfGrass++;
    // roads-v1 draws the paved and half-paved onbegroeid up to ANCILLARY_SQUARE_MAX_M2 as squares (build-bgt-roads.ts).
    const fv = (p.f.fv ?? '').toLowerCase();
    if (p.c === 'onbegroeidterreindeel' && /^(gesloten verharding|open verharding|half verhard)$/.test(fv) && p.area <= ANCILLARY_SQUARE_MAX_M2) continue;
    const bucket = `${v.cls}: ${p.c === 'begroeidterreindeel' ? 'begroeid' : 'onbegroeid'} ${fv || '?'}`;
    rep.candidates++;
    const free = cutFree(p.local, osm);
    if (free.cut) rep.cutByOsm++;
    if (free.failed) rep.clipFailures++;
    let freeM2 = 0;
    const kept: Vec2[][][] = [];
    for (const part of free.parts) {
      const rings = part.map(simplifyRing).filter(r => r.length >= 3);
      if (!rings.length || rings[0].length < 3) continue;
      const a = polygonArea(rings);
      freeM2 += a;
      if (a >= MIN_PART_M2) kept.push(rings);
    }
    const centre = inCentrum(p.at);
    add(rep.greyBefore, bucket, freeM2); if (centre) add(rep.greyBeforeCentrum, bucket, freeM2);
    if (!v.cover || !kept.length) { add(rep.greyAfter, bucket, freeM2); if (centre) add(rep.greyAfterCentrum, bucket, freeM2); continue; }
    rep.drawn++;
    kept.forEach((rings, i) => {
      // A ring that encodes to under three distinct points (decimetre rounding of a sliver) is dropped; an outer one drops the part.
      const enc = rings.map(encodeLine).filter(e => e.length >= 6);
      if (enc.length !== rings.length && encodeLine(rings[0]).length < 6) return;
      areas.push({ id: `${p.f.id}${p.n ? `.${p.n}` : ''}${kept.length > 1 ? `#${i}` : ''}`, k: v.cover!, r: enc });
      rep.m2[v.cover!] = (rep.m2[v.cover!] ?? 0) + polygonArea(rings);
      rep.parts++;
    });
    const left = freeM2 - kept.reduce((s, r) => s + polygonArea(r), 0);
    add(rep.greyAfter, bucket, left); if (centre) add(rep.greyAfterCentrum, bucket, left);
  }
  areas.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (areas.length) {
    const out: OpenGroundCell = { version: 1, key, areas };
    mkdirSync(join(STAGING, 'cells'), { recursive: true });
    const bytes = gzipSync(JSON.stringify(out), { level: 9 });
    writeFileSync(join(STAGING, 'cells', `${key}.json.gz`), bytes);
    rep.bytes = bytes.length;
  }
  for (const o of [rep.greyBefore, rep.greyAfter, rep.greyBeforeCentrum, rep.greyAfterCentrum, rep.m2 as Record<string, number>]) for (const k of Object.keys(o)) o[k] = Math.round(o[k]);
  rep.ms = Date.now() - t0;
  return rep;
}

// ------------------------------------------------------------------ main

async function main(): Promise<void> {
  if (process.argv.includes('--publish')) {
    const report = JSON.parse(readFileSync(join(STAGING, 'report.json'), 'utf8')) as { provenance: Record<string, unknown>; cells: CellReport[]; totals: { extractKB: number } };
    if (report.totals.extractKB * 1024 > OPEN_GROUND_TOTAL_BUDGET_GZ) throw new Error(`extract ${report.totals.extractKB} KB over the budget`);
    rmSync(PUBLISHED, { recursive: true, force: true });
    mkdirSync(join(PUBLISHED, 'cells'), { recursive: true });
    const cells = report.cells.filter(r => r.bytes > 0).map(r => r.key).sort();
    for (const k of cells) copyFileSync(join(STAGING, 'cells', `${k}.json.gz`), join(PUBLISHED, 'cells', `${k}.json.gz`));
    const out: OpenGroundManifest = { version: 1, cells, provenance: report.provenance };
    writeFileSync(join(PUBLISHED, 'cells.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(`published ${cells.length} cells to ${PUBLISHED}`);
    return;
  }
  const only = arg('--cells')?.split(',');
  const keys = only ?? osmManifest.cells;
  if (!only) rmSync(STAGING, { recursive: true, force: true });
  const todo = [...keys], reports: CellReport[] = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Number(arg('--concurrency') ?? 4) }, async () => {
    for (let k = todo.shift(); k; k = todo.shift()) {
      const r = await cell(k);
      reports.push(r);
      const drawn = Object.values(r.m2).reduce((s, v) => s + v!, 0);
      console.log(`${k.padEnd(7)} ${String(r.candidates).padStart(6)} candidates, ${String(r.parts).padStart(5)} parts, ${(drawn / 1e4).toFixed(2)} ha, erf ${r.erfGrass}/${r.erf} grass (${r.erfUnknown} unknown), ${(r.bytes / 1024).toFixed(0)} KB, ${r.ms} ms [${reports.length}/${keys.length}, ${Math.round((Date.now() - t0) / 1000)} s]`);
    }
  }));
  reports.sort((a, b) => a.key.localeCompare(b.key));
  const sum = (f: (r: CellReport) => number) => reports.reduce((s, r) => s + f(r), 0);
  const merge = (f: (r: CellReport) => Record<string, number>) => { const o: Record<string, number> = {}; for (const r of reports) for (const [k, v] of Object.entries(f(r))) add(o, k, v); return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
  const byClass = (o: Record<string, number>) => { const c: Partial<Record<GroundSurfaceClass | 'grass (erf)', number>> = {}; for (const [k, v] of Object.entries(o)) { const cls = k.split(':')[0] as GroundSurfaceClass; c[cls] = (c[cls] ?? 0) + v; } return c; };
  const census = {
    what: 'm² of BGT open ground (begroeid + onbegroeid terreindeel at ground level, not courtyards-v1, not a roads-v1 square, cut free of the OSM area fills and the raised (h ≥ 1) roads-v1 surfaces) that draws as the land layer (paving grey), before and after open-ground-v1. Verges (ondersteunendwegdeel) are drawn by roads-v1 and not counted.',
    city: { before: merge(r => r.greyBefore), after: merge(r => r.greyAfter), beforeByClass: byClass(merge(r => r.greyBefore)), afterByClass: byClass(merge(r => r.greyAfter)) },
    centrum: { before: merge(r => r.greyBeforeCentrum), after: merge(r => r.greyAfterCentrum), beforeByClass: byClass(merge(r => r.greyBeforeCentrum)), afterByClass: byClass(merge(r => r.greyAfterCentrum)) },
  };
  const m2: Partial<Record<OpenGroundCover, number>> = {};
  for (const r of reports) for (const k of OPEN_GROUND_COVERS) if (r.m2[k]) m2[k] = (m2[k] ?? 0) + r.m2[k]!;
  const provenance = {
    added: '2026-11-10', script: 'scripts/own-ground/build-open-ground.ts', classifier: 'src/canalRecall/ownGround/groundSurface.ts', doc: 'docs/reports/open-ground-look-20261110.md',
    bgt: { source: 'BGT via PDOK OGC API https://api.pdok.nl/lv/bgt/ogc/v1', licence: 'CC0 1.0', datetime: '2026-11-10T00:00:00Z', collections: [...OPEN_GROUND_COLLECTIONS] },
    imagery: useCir ? { source: `PDOK Luchtfoto CIR WMS ${WMS}`, layer: IMAGERY_LAYER, metresPerPixel: IMAGE_M_PER_PX, licence: 'CC BY 4.0 (Beeldmateriaal Nederland)', use: 'vegetated share of BGT erf (yard) polygons' } : null,
    osm: '© OpenStreetMap contributors (ODbL): the area fills the extract is cut free of', roads: 'roads-v1 surfaces with h ≥ 1 (bridge, viaduct, ramp) are cut out as well',
  };
  const totals = { cells: reports.length, cellsWithAreas: reports.filter(r => r.bytes).length, candidates: sum(r => r.candidates), drawn: sum(r => r.drawn), parts: sum(r => r.parts), cutByOsm: sum(r => r.cutByOsm), clipFailures: sum(r => r.clipFailures), erf: sum(r => r.erf), erfGrass: sum(r => r.erfGrass), erfUnknown: sum(r => r.erfUnknown), m2, extractKB: Math.round(sum(r => r.bytes) / 1024), maxCellKB: Math.round(Math.max(0, ...reports.map(r => r.bytes)) / 1024) };
  mkdirSync(STAGING, { recursive: true });
  writeFileSync(join(STAGING, 'report.json'), JSON.stringify({ provenance, totals, cells: reports }, null, 1));
  writeFileSync(join(STAGING, 'census.json'), JSON.stringify(census, null, 1));
  console.log(JSON.stringify(totals));
  console.log(JSON.stringify({ cityBefore: census.city.beforeByClass, cityAfter: census.city.afterByClass, centrumBefore: census.centrum.beforeByClass, centrumAfter: census.centrum.afterByClass }));
}

void main();
