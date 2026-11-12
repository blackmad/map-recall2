// Build the BGT plaza extract (lane bgt-plazas-20261110): public paved squares and forecourts the bike may ride across,
// under the rule in src/canalRecall/routing/bgtPlazas.ts.
//
//   npx tsx scripts/routing/build-bgt-plazas.ts            # build into staging, print the coverage report
//   npx tsx scripts/routing/build-bgt-plazas.ts --publish  # also copy the staged extract to the published path
//
// Inputs (open data only):
//   BGT wegdeel per cell        $BGT_WEGDEEL_DIR (default map-recall2-source-data/datasets/bgt-roads-20261016/cells)
//   BGT onbegroeidterreindeel   artifacts/own-ground/raw/bgt-roads/onbegroeidterreindeel/ (fetch-bgt-roads.ts --collection)
//   BGT scheiding               artifacts/own-ground/raw/bgt-roads/scheiding/ (fetch-bgt-barriers.ts)
//   routing extract             roads-v2/streets-routing.bin.gz (scripts/lib/routingFeatures.ts)
// Output: public/data/extracts/amsterdam/staging/bgt-plazas-v1/{bgt-plazas-v1.json,report.json}; --publish copies the
// extract to public/data/extracts/amsterdam/bgt-plazas-v1.json.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import polygonClipping, { type Polygon } from 'polygon-clipping';
import {
  BGT_PLAZA_CORRIDOR_SLACK_METRES, BGT_PLAZA_CUT_METRES, BGT_PLAZA_MIN_AREA_M2, BGT_PLAZA_REACH_METRES,
  BGT_PLAZA_MIN_OPENED_M2, BGT_PLAZA_MIN_WIDTH_METRES, BGT_VOETPAD_CANDIDATE_DEPTH_METRES, PLAZA_CUTTING_SCHEIDING, isPlazaReachSurface,
  isRideablePlazaSurface, erfExceptionFeedback, erfExceptionFor,
  type BgtPlazaCollection, type BgtPlazaExtract, type BgtPlazaFeature,
} from '../../src/canalRecall/routing/bgtPlazas.ts';
import { isMotorOnlyHighway } from '../../src/canalRecall/routing/bikeAccess.ts';
import { PLAZA_EDGE_INSET_METRES, isRideablePlaza, type PlazaFeature } from '../../src/canalRecall/routing/pedestrianAreas.ts';
import { PAVED_LINKS } from '../../src/canalRecall/routing/pavedLinks.ts';
import { loadRoutingFeatures } from '../lib/routingFeatures.ts';
import {
  Raster, boxOf, boxesTouch, components, insidePolygon, distanceFrom, fillPolygon, markSegment, polygonArea, segmentPolygonDistance,
  simplifyRing, toLonLat, toMetres, traceLabel, type Box,
} from './bgtPlazaGeometry.ts';

const SOURCE_DATA = process.env.MAP_RECALL_SOURCE_DATA || '/Users/blackmad/Code/map-recall2-source-data';
const WEGDEEL_DIR = process.env.BGT_WEGDEEL_DIR || `${SOURCE_DATA}/datasets/bgt-roads-20261016/cells`;
const ONBEGROEID_DIR = process.env.BGT_ONBEGROEID_DIR || 'artifacts/own-ground/raw/bgt-roads/onbegroeidterreindeel';
const SCHEIDING_DIR = process.env.BGT_SCHEIDING_DIR || 'artifacts/own-ground/raw/bgt-roads/scheiding';
const ERF_EXCEPTIONS_FILE = 'scripts/routing/bgt-erf-exceptions.json';
const STAGING = `public/data/extracts/amsterdam/staging/bgt-plazas-v1${process.argv.includes('--exceptions-only') ? '-exceptions' : ''}`;
const PUBLISHED = 'public/data/extracts/amsterdam/bgt-plazas-v1.json';

/** Playable half-widths in px at 3 px/m (public/canal-drive/js/constants.js ROAD_WIDTHS). */
const ROAD_HALF_WIDTH_PX: Record<string, number> = {
  primary: 30, primary_link: 24, secondary: 26, secondary_link: 22, tertiary: 21, tertiary_link: 18, residential: 18,
  unclassified: 17, living_street: 16, service: 13, busway: 18, cycleway: 9, pedestrian: 14, footway: 7, path: 8,
};
const DEFAULT_HALF_WIDTH_PX = 32;

interface Source {
  id: string;
  collection: BgtPlazaCollection;
  functie: string;
  fv: string | null;
  polygons: Polygon[];
  box: Box;
  area: number;
  /** A reviewed erf exception (bgtPlazas.ts ERF_EXCEPTIONS): the polygon is the reviewed area, so the 8 m opening skips it. */
  exception?: string;
}

const classKey = (s: Pick<Source, 'collection' | 'functie' | 'fv'>) => s.collection === 'wegdeel' ? `wegdeel/${s.functie}/${s.fv}` : `onbegroeid/${s.fv}`;

/** The deepest point of a polygon (its largest inscribed disc's radius), on a 0.5 m raster. */
function maxDepth(polygons: Polygon[]): number {
  const box = boxOf(polygons.flat());
  if (Math.min(box.maxX - box.minX, box.maxY - box.minY) < 2 * BGT_VOETPAD_CANDIDATE_DEPTH_METRES) return 0;
  const r = new Raster(box.minX - 1, box.minY - 1, box.maxX + 1, box.maxY + 1, 0.5);
  if (r.size > 4_000_000) return Infinity;
  const inside = new Uint8Array(r.size);
  for (const polygon of polygons) fillPolygon(r, polygon, k => { inside[k] = 1; });
  const outside = inside.map(v => 1 - v);
  const depth = distanceFrom(r, outside);
  let best = 0;
  for (let k = 0; k < r.size; k++) if (inside[k] && depth[k] > best) best = depth[k];
  return best;
}

function readCells<T>(dir: string): Array<{ key: string; features: T[] }> {
  if (!existsSync(dir)) throw new Error(`${dir} is missing; see the header for how to fetch it`);
  return readdirSync(dir).filter(f => f.endsWith('.json.gz')).map(f => JSON.parse(gunzipSync(readFileSync(`${dir}/${f}`)).toString()));
}

function loadSources(): { plaza: Source[]; reach: Source[]; census: Map<string, { count: number; area: number }> } {
  const plaza: Source[] = [], reach: Source[] = [];
  const census = new Map<string, { count: number; area: number }>();
  const seen = new Set<string>();
  const take = (collection: BgtPlazaCollection, f: { id: string; functie: string; fv: string | null; h: number; status: string | null; eind: string | null; g: [number, number][][][] }) => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    const attrs = { collection, functie: collection === 'wegdeel' ? f.functie : '', fv: f.fv, h: f.h, status: f.status, eind: f.eind };
    const polygons: Polygon[] = f.g.map(poly => poly.map(ring => ring.map(([lon, lat]) => toMetres(lon, lat))));
    // A sidewalk-width voetpad is reach, not plaza (BGT_VOETPAD_CANDIDATE_DEPTH_METRES).
    const isPlaza = isRideablePlazaSurface(attrs) && (attrs.functie !== 'voetpad' || maxDepth(polygons) >= BGT_VOETPAD_CANDIDATE_DEPTH_METRES);
    const isReach = !isPlaza && isPlazaReachSurface(attrs);
    const area = polygons.reduce((t, p) => t + polygonArea(p), 0);
    if (f.h === 0 && !f.eind) {
      const key = classKey(attrs);
      const c = census.get(key) ?? { count: 0, area: 0 };
      c.count++; c.area += area;
      census.set(key, c);
    }
    if (!isPlaza && !isReach) return;
    const source: Source = { id: f.id, collection, functie: attrs.functie, fv: f.fv, polygons, box: boxOf(polygons.flat()), area };
    (isPlaza ? plaza : reach).push(source);
  };
  for (const cell of readCells<any>(WEGDEEL_DIR)) for (const f of cell.features) take('wegdeel', f);
  for (const cell of readCells<any>(ONBEGROEID_DIR)) for (const f of cell.features) take('onbegroeidterreindeel', { ...f, functie: '' });
  // Reviewed erf exceptions: the only erf that joins, each as a plaza source (fetch-bgt-erf-exceptions.ts).
  for (const f of JSON.parse(readFileSync(ERF_EXCEPTIONS_FILE, 'utf8')).features as Array<{ id: string; fv: string; h: number; status: string | null; eind: string | null; g: [number, number][][][] }>) {
    const feedback = erfExceptionFeedback(f.id);
    if (!feedback) throw new Error(`${f.id} is in ${ERF_EXCEPTIONS_FILE} but not in ERF_EXCEPTIONS`);
    if (f.fv !== 'erf' || f.h !== 0 || f.eind || (f.status && f.status !== 'bestaand')) throw new Error(`${f.id}: not a current ground-level erf polygon`);
    let polygons: Polygon[] = f.g.map(poly => poly.map(ring => ring.map(([lon, lat]) => toMetres(lon, lat))));
    const exclude = erfExceptionFor(f.id)?.exclude;
    if (exclude) {
      const [x0, y0] = toMetres(exclude[1], exclude[0]), [x1, y1] = toMetres(exclude[3], exclude[2]);
      polygons = polygonClipping.difference(polygons, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]) as Polygon[];
    }
    plaza.push({ id: f.id, collection: 'onbegroeidterreindeel', functie: '', fv: 'erf', polygons, box: boxOf(polygons.flat()), area: polygons.reduce((t, p) => t + polygonArea(p), 0), exception: feedback });
  }
  return { plaza, reach, census };
}

interface Barrier { type: string; line: [number, number][]; box: Box }

function loadBarriers(): Barrier[] {
  const out: Barrier[] = [];
  const seen = new Set<string>();
  for (const cell of readCells<any>(SCHEIDING_DIR)) for (const f of cell.features) {
    if (seen.has(f.id) || f.h !== 0 || !PLAZA_CUTTING_SCHEIDING.has(f.type)) continue;
    seen.add(f.id);
    for (const l of f.lines as [number, number][][]) {
      const line = l.map(([lon, lat]) => toMetres(lon, lat));
      out.push({ type: f.type, line, box: boxOf([line]) });
    }
  }
  return out;
}

interface Corridor { a: [number, number]; b: [number, number]; half: number; box: Box }

async function loadCorridors(): Promise<Corridor[]> {
  const features = await loadRoutingFeatures<{ highway?: string; type?: string; path?: [number, number][]; paths?: [number, number][][] }>();
  const out: Corridor[] = [];
  for (const f of features) {
    if (isMotorOnlyHighway(f.highway)) continue;
    const highway = f.highway || (f.type === 'avenue' ? 'secondary' : 'residential');
    const half = (ROAD_HALF_WIDTH_PX[highway] ?? DEFAULT_HALF_WIDTH_PX) / 3;
    for (const p of f.paths ?? (f.path ? [f.path] : [])) {
      if (!p || p.length < 2) continue;
      if (p.length > 3 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1]) continue; // osm-loader drops closed rings
      for (let i = 0; i + 1 < p.length; i++) {
        const a = toMetres(p[i][1], p[i][0]), b = toMetres(p[i + 1][1], p[i + 1][0]);
        out.push({ a, b, half, box: boxOf([[a, b]]) });
      }
    }
  }
  return out;
}

/** A uniform grid over boxes, for candidate lookup. */
class Grid<T extends { box: Box }> {
  private cells = new Map<string, T[]>();
  constructor(items: readonly T[], private size = 100) {
    for (const item of items) this.each(item.box, key => { const list = this.cells.get(key); if (list) list.push(item); else this.cells.set(key, [item]); });
  }
  private each(box: Box, fn: (key: string) => void) {
    for (let gx = Math.floor(box.minX / this.size); gx <= Math.floor(box.maxX / this.size); gx++) {
      for (let gy = Math.floor(box.minY / this.size); gy <= Math.floor(box.maxY / this.size); gy++) fn(`${gx},${gy}`);
    }
  }
  near(box: Box, slack = 0): T[] {
    const out = new Set<T>();
    const grown = { minX: box.minX - slack, minY: box.minY - slack, maxX: box.maxX + slack, maxY: box.maxY + slack };
    this.each(grown, key => { for (const item of this.cells.get(key) ?? []) if (boxesTouch(item.box, grown)) out.add(item); });
    return [...out];
  }
}

/**
 * Union-find clusters of plaza sources that touch: BGT is a topological partition, so neighbours share edges, though
 * not always vertices (a T-junction). Edges are sampled every 0.25 m into 0.5 m hash cells; two polygons with samples
 * in one cell are neighbours (or lie within half a metre, which only makes a cluster larger, never wrong).
 */
function cluster(sources: Source[]): Source[][] {
  const parent = sources.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const owner = new Map<number, number>();
  const key = (x: number, y: number) => Math.round(x * 2) * 1_000_003 + Math.round(y * 2);
  sources.forEach((s, i) => {
    for (const polygon of s.polygons) for (const ring of polygon) for (let n = 0; n + 1 < ring.length; n++) {
      const [ax, ay] = ring[n], [bx, by] = ring[n + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25));
      for (let t = 0; t <= steps; t++) {
        const k = key(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps);
        const j = owner.get(k);
        if (j === undefined) owner.set(k, i);
        else if (j !== i) { const ra = find(i), rb = find(j); if (ra !== rb) parent[ra] = rb; }
      }
    }
  });
  const groups = new Map<number, Source[]>();
  sources.forEach((s, i) => { const r = find(i); const g = groups.get(r); if (g) g.push(s); else groups.set(r, [s]); });
  return [...groups.values()];
}

const round7 = (v: number) => Math.round(v * 1e7) / 1e7;
/** 1e-6° ≈ 0.11 m north–south, 0.07 m east–west: below the 0.35 m simplification. */
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Raster cell, metres; larger clusters step up so no raster passes ~16 M cells. */
const CELL_METRES = 0.25;
const MAX_CELLS = 16_000_000;

export interface PieceReport {
  id: string; name: string; centre: [number, number]; plazaArea: number; area: number; connected: boolean;
  classes: Record<string, number>; nearestCorridor: number;
  /** m² of the piece the bike can reach only through it: ≥ the inset inside, beyond every corridor's guard reach, outside every square. */
  opened: number;
  exception?: string;
  inCentrum: boolean;
}

/** The squares.json rings and paved links the game already rides (pedestrianAreas.ts), as metric polygons. */
function loadSquares(): Array<{ polygon: Polygon; box: Box }> {
  const squares = JSON.parse(readFileSync('public/data/extracts/amsterdam/squares.json', 'utf8')) as PlazaFeature[];
  const out: Array<{ polygon: Polygon; box: Box }> = [];
  for (const f of [...squares, ...PAVED_LINKS]) for (const path of f.paths ?? (f.path ? [f.path] : [])) {
    if (!isRideablePlaza(f, path)) continue;
    const ring = path.map(([lat, lon]) => toMetres(lon, lat));
    out.push({ polygon: [ring], box: boxOf([ring]) });
  }
  return out;
}

function loadCentrum(): Polygon {
  const boundaries = JSON.parse(readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8')) as Array<{ name: string; geometry: [number, number][][][] }>;
  return boundaries.find(b => b.name === 'Centrum')!.geometry[0].map(ring => ring.map(([lat, lon]) => toMetres(lon, lat)));
}

/** The guard's reach past a corridor's half-width: constrainCarToRoad's 4 px edge tolerance at 3 px/m. */
const GUARD_EDGE_METRES = 4 / 3;

async function main() {
  const t0 = Date.now();
  const publish = process.argv.includes('--publish');
  const { plaza, reach, census } = loadSources();
  const barriers = loadBarriers();
  const corridors = await loadCorridors();
  console.log(`sources: ${plaza.length} plaza polygons, ${reach.length} reach polygons, ${barriers.length} barrier lines, ${corridors.length} corridor segments (${Math.round((Date.now() - t0) / 1000)} s)`);
  const squareGrid = new Grid(loadSquares(), 100);
  const centrum = loadCentrum();
  const reachGrid = new Grid(reach, 100), barrierGrid = new Grid(barriers, 100), corridorGrid = new Grid(corridors, 100);
  // --bbox lat0,lon0,lat1,lon1 limits the build to clusters inside (a review run; never --publish with it).
  const bboxArg = process.argv.includes('--bbox') ? process.argv[process.argv.indexOf('--bbox') + 1].split(',').map(Number) : null;
  if (bboxArg && publish) throw new Error('--bbox and --publish do not mix');
  const only = bboxArg ? (() => { const [x0, y0] = toMetres(bboxArg[1], bboxArg[0]), [x1, y1] = toMetres(bboxArg[3], bboxArg[2]); return { minX: x0, minY: y0, maxX: x1, maxY: y1 }; })() : null;
  // --exceptions-only builds just the reviewed erf exceptions and merges them into the published extract (replacing
  // earlier exception features), so adding one needs seconds, not the 13-minute full build.
  const exceptionsOnly = process.argv.includes('--exceptions-only');
  const groups = cluster(exceptionsOnly ? plaza.filter(s => s.exception) : only ? plaza.filter(s => boxesTouch(s.box, only)) : plaza).sort((a, b) => b.length - a.length);
  console.log(`clusters: ${groups.length}; largest ${groups.slice(0, 5).map(g => g.length).join(', ')} polygons`);
  if (process.argv.includes('--clusters-only')) return;
  const pieces: Array<{ polygons: Polygon[]; report: PieceReport }> = [];
  let cutCells = 0, clusterIndex = 0, smallClusters = 0;
  const margin = BGT_PLAZA_REACH_METRES + 1;
  for (const group of groups) {
    clusterIndex++;
    if (clusterIndex % 2000 === 0) console.log(`  ${clusterIndex}/${groups.length} clusters, ${pieces.length} pieces (${Math.round((Date.now() - t0) / 1000)} s)`);
    // A cluster whose plaza polygons sum below the floor cannot yield a piece above it.
    if (group.reduce((t, src) => t + src.area, 0) < BGT_PLAZA_MIN_AREA_M2) { smallClusters++; continue; }
    const box = group.reduce((acc, src) => ({ minX: Math.min(acc.minX, src.box.minX), minY: Math.min(acc.minY, src.box.minY), maxX: Math.max(acc.maxX, src.box.maxX), maxY: Math.max(acc.maxY, src.box.maxY) }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    let cell = CELL_METRES;
    while (((box.maxX - box.minX + 2 * margin) / cell) * ((box.maxY - box.minY + 2 * margin) / cell) > MAX_CELLS) cell *= 2;
    const r = new Raster(box.minX - margin, box.minY - margin, box.maxX + margin, box.maxY + margin, cell);
    // 1. Plaza cells, labelled with their source (index + 1).
    const source = new Int32Array(r.size);
    group.forEach((src, n) => { for (const polygon of src.polygons) fillPolygon(r, polygon, k => { source[k] = n + 1; }); });
    // Opening: keep only paving at least BGT_PLAZA_MIN_WIDTH_METRES across; what it trims stays road for the reach.
    const half = BGT_PLAZA_MIN_WIDTH_METRES / 2;
    const notPaved = new Uint8Array(r.size);
    for (let k = 0; k < r.size; k++) if (!source[k]) notPaved[k] = 1;
    const depthIn = distanceFrom(r, notPaved);
    const core = new Uint8Array(r.size);
    for (let k = 0; k < r.size; k++) if (source[k] && depthIn[k] >= half) core[k] = 1;
    const fromCore = distanceFrom(r, core);
    const trimmed = new Uint8Array(r.size);
    for (let k = 0; k < r.size; k++) {
      if (!source[k] || group[source[k] - 1].exception) continue;
      if (fromCore[k] <= half + cell / 2) continue;
      source[k] = 0;
      trimmed[k] = 1;
    }
    const seed = new Uint8Array(r.size);
    for (let k = 0; k < r.size; k++) if (source[k]) seed[k] = 1;
    // 2. Reach into adjoining paved road surface.
    const mask = seed.slice();
    const near = reachGrid.near(box, margin);
    {
      const road = trimmed;
      for (const src of near) for (const polygon of src.polygons) fillPolygon(r, polygon, k => { road[k] = 1; });
      const dist = distanceFrom(r, seed);
      for (let k = 0; k < r.size; k++) if (road[k] && dist[k] <= BGT_PLAZA_REACH_METRES) mask[k] = 1;
    }
    // 3. Cut by walls and fences.
    for (const b of barrierGrid.near(box, margin)) {
      for (let n = 0; n + 1 < b.line.length; n++) markSegment(r, b.line[n], b.line[n + 1], BGT_PLAZA_CUT_METRES / 2, k => { if (mask[k]) { mask[k] = 0; cutCells++; } });
    }
    // 4. Pieces, their plaza area and classes, and whether a corridor reaches into them.
    const { labels, count } = components(r, mask);
    if (!count) continue;
    const plazaCells = new Float64Array(count + 1);
    const classCells: Array<Map<number, number>> = Array.from({ length: count + 1 }, () => new Map());
    const cellArea = cell * cell;
    for (let k = 0; k < r.size; k++) {
      const l = labels[k];
      if (!l || !source[k]) continue;
      plazaCells[l] += cellArea;
      const m = classCells[l];
      m.set(source[k] - 1, (m.get(source[k] - 1) ?? 0) + cellArea);
    }
    const corridorReach = new Uint8Array(count + 1);
    const nearestCorridor = new Float64Array(count + 1).fill(Infinity);
    const needed = BGT_PLAZA_CORRIDOR_SLACK_METRES - PLAZA_EDGE_INSET_METRES; // ≤ 0: the corridor edge must enter the piece
    for (const c of corridorGrid.near(box, margin + 20)) {
      // Cells within half + needed of the centreline are where the corridor's edge has entered by −needed.
      markSegment(r, c.a, c.b, Math.max(0, c.half + needed), k => { const l = labels[k]; if (l) corridorReach[l] = 1; });
    }
    // Opened ground: cells ≥ the inset inside a piece that no corridor's guard and no square already allows.
    const outside = new Uint8Array(r.size);
    for (let k = 0; k < r.size; k++) if (!labels[k]) outside[k] = 1;
    const depth = distanceFrom(r, outside);
    const covered = new Uint8Array(r.size);
    for (const c of corridorGrid.near(box, margin + 20)) markSegment(r, c.a, c.b, c.half + GUARD_EDGE_METRES, k => { covered[k] = 1; });
    for (const sq of squareGrid.near(box, margin)) fillPolygon(r, sq.polygon, k => { covered[k] = 1; });
    const opened = new Float64Array(count + 1);
    for (let k = 0; k < r.size; k++) if (labels[k] && !covered[k] && depth[k] >= PLAZA_EDGE_INSET_METRES) opened[labels[k]] += cellArea;
    for (let l = 1; l <= count; l++) {
      if (plazaCells[l] < BGT_PLAZA_MIN_AREA_M2) continue;
      const polygons = traceLabel(r, labels, l);
      if (!polygons.length) continue;
      const classes: Record<string, number> = {};
      const ids: string[] = [];
      for (const [n, area] of classCells[l]) { const key = classKey(group[n]); classes[key] = (classes[key] ?? 0) + area; ids.push(group[n].id); }
      ids.sort();
      const exception = [...classCells[l].keys()].map(n => group[n].exception).find(Boolean);
      const pbox = boxOf(polygons.map(p => p[0]));
      if (!corridorReach[l]) {
        for (const c of corridorGrid.near(pbox, 30)) {
          const d = polygons.reduce((m, p) => Math.min(m, segmentPolygonDistance(c.a, c.b, p)), Infinity) - c.half;
          if (d < nearestCorridor[l]) nearestCorridor[l] = d;
        }
      } else nearestCorridor[l] = needed;
      const dominant = Object.entries(classes).sort((p, q) => q[1] - p[1])[0][0];
      const name = dominant.startsWith('wegdeel/') ? `BGT ${dominant.split('/')[1]}` : 'BGT verharding';
      const [clon, clat] = toLonLat((pbox.minX + pbox.maxX) / 2, (pbox.minY + pbox.maxY) / 2);
      pieces.push({
        polygons,
        report: {
          id: `bgt:${ids[0]}`, name, centre: [round7(clat), round7(clon)], plazaArea: Math.round(plazaCells[l]),
          area: Math.round(polygons.reduce((t, p) => t + polygonArea(p), 0)), connected: corridorReach[l] === 1,
          classes: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, Math.round(v)])),
          nearestCorridor: Math.round(nearestCorridor[l] * 10) / 10,
          opened: Math.round(opened[l]),
          exception,
          inCentrum: insidePolygon(centrum, ...toMetres(clon, clat)),
        },
      });
    }
  }
  // Pieces share ids when a cut splits a cluster: make them unique.
  const idCount = new Map<string, number>();
  for (const p of pieces) { const n = idCount.get(p.report.id) ?? 0; idCount.set(p.report.id, n + 1); if (n) p.report.id += `#${n}`; }
  const toFeature = ({ polygons, report }: { polygons: Polygon[]; report: PieceReport }): BgtPlazaFeature => ({
    id: report.id, name: report.name, source: 'bgt' as const,
    polygons: polygons.map(polygon => polygon.map(ring => simplifyRing(ring, 0.35).map(([x, y]) => { const [lon, lat] = toLonLat(x, y); return [round6(lat), round6(lon)] as [number, number]; }))),
    plazaArea: report.plazaArea, classes: report.classes, ...(report.exception ? { exception: report.exception } : {}),
  });
  const shipped = (p: PieceReport) => p.connected && p.opened >= BGT_PLAZA_MIN_OPENED_M2;
  let features = pieces.filter(p => shipped(p.report)).map(toFeature);
  if (exceptionsOnly) {
    const base = JSON.parse(readFileSync(PUBLISHED, 'utf8')) as BgtPlazaExtract;
    features = [...base.features.filter(f => !f.exception), ...features];
    for (const e of pieces) console.log(`exception ${e.report.exception}: ${e.report.id} plaza ${e.report.plazaArea} m², opened ${e.report.opened} m², connected ${e.report.connected}`);
  }
  const extract: BgtPlazaExtract = {
    version: 1,
    source: 'BGT wegdeel 2026-10-16 + onbegroeidterreindeel/scheiding 2026-11-10 (Kadaster, CC0 1.0, PDOK OGC API); routing roads-v2',
    rule: 'src/canalRecall/routing/bgtPlazas.ts RIDEABLE_PLAZA_CLASSES + ERF_EXCEPTIONS',
    features,
  };
  mkdirSync(STAGING, { recursive: true });
  const json = JSON.stringify(extract);
  writeFileSync(`${STAGING}/bgt-plazas-v1.json`, json);
  // Every piece above the area floor, connected or not, for the coverage sheets (staging only).
  writeFileSync(`${STAGING}/pieces-all.json`, JSON.stringify(pieces.map(p => ({ ...toFeature(p), connected: shipped(p.report) }))));
  const sum = (list: PieceReport[], f: (p: PieceReport) => number) => list.reduce((t, p) => t + f(p), 0);
  const all = pieces.map(p => p.report), connected = all.filter(p => p.connected);
  const report = {
    generated: new Date().toISOString(),
    census: Object.fromEntries([...census.entries()].sort((p, q) => q[1].area - p[1].area).map(([k, v]) => [k, { count: v.count, area: Math.round(v.area) }])),
    plazaSources: plaza.length,
    clusters: groups.length,
    clustersBelowFloor: smallClusters,
    piecesAboveMinArea: all.length,
    cellsCutByBarriers: cutCells,
    connectedPieces: connected.length,
    connectedPlazaArea: Math.round(sum(connected, p => p.plazaArea)),
    connectedArea: Math.round(sum(connected, p => p.area)),
    connectedOpened: Math.round(sum(connected, p => p.opened)),
    shippedPieces: features.length,
    shippedPlazaArea: Math.round(sum(all.filter(shipped), p => p.plazaArea)),
    shippedOpened: Math.round(sum(all.filter(shipped), p => p.opened)),
    centrum: {
      shippedPieces: all.filter(p => p.inCentrum && shipped(p)).length,
      shippedOpened: Math.round(sum(all.filter(p => p.inCentrum && shipped(p)), p => p.opened)),
      pieces: all.filter(p => p.inCentrum).length,
      connectedPieces: connected.filter(p => p.inCentrum).length,
      connectedPlazaArea: Math.round(sum(connected.filter(p => p.inCentrum), p => p.plazaArea)),
      connectedOpened: Math.round(sum(connected.filter(p => p.inCentrum), p => p.opened)),
    },
    unconnectedPieces: all.length - connected.length,
    unconnectedPlazaArea: Math.round(sum(all.filter(p => !p.connected), p => p.plazaArea)),
    bytes: json.length,
    seconds: Math.round((Date.now() - t0) / 1000),
    pieces: all,
  };
  writeFileSync(`${STAGING}/report.json`, JSON.stringify(report, null, 1));
  console.log(`clusters ${groups.length} (${smallClusters} below the floor), pieces ≥ ${BGT_PLAZA_MIN_AREA_M2} m² ${all.length}, connected ${connected.length} (${report.connectedPlazaArea} m² plaza, ${report.connectedArea} m² with reach), unconnected ${report.unconnectedPieces} (${report.unconnectedPlazaArea} m²), ${(json.length / 1e6).toFixed(2)} MB, ${report.seconds} s`);
  if (publish) { copyFileSync(`${STAGING}/bgt-plazas-v1.json`, PUBLISHED); console.log(`published ${PUBLISHED}`); }
}

main().catch(e => { console.error(e); process.exit(1); });
