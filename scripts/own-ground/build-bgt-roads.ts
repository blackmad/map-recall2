// Build the roads-v1 extract (roads data lane, 2026-10-16): the BGT `wegdeel` road
// partition per own-ground 1 km cell, from the cache fetch-bgt-roads.ts fills.
//
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts [--cells a,b]
//   npx tsx scripts/own-ground/build-bgt-roads.ts [--cells a,b] [--tol 0.1] [--budget-kb 350] [--out dir]
//   # review artifacts/own-ground/staging/roads-v1/report.json, then publish the reviewed cells:
//   cp artifacts/own-ground/staging/roads-v1/cells/<key>.json.gz public/data/extracts/amsterdam/roads-v1/cells/
//   (and write a cells.json listing only the published cells)
//
// Per cell (src/canalRecall/ownGround/roadCells.ts has the schema):
//   surfaces   every current (`status` bestaand, no `eind_registratie`) wegdeel of a kept
//              functie (fetch-bgt.ts KEEP_FUNCTIE) at relatieve_hoogteligging ≥ 0 whose
//              interior point lies in the cell; class by bgtWidth.ts `classOf`, mesh by
//              roadCells.ts `roadMesh`; a rijbaan section is red when roadCells `fietsstraatSection` says the
//              OSM fietsstraat (cyclestreet / bicycle_road) runs along it, measured per polygon: no other
//              carriageway runs further along it and no tram track does (the busway stays grey);
//              rings simplified (0.1 m) topology-preserving (topoSimplify.ts: an edge two polygons share is
//              simplified once, so both keep identical vertices) and delta-encoded as parks-v1 does
//   kerbs      shared edges between a road-level and a pavement-level polygon at equal
//              height (exact vertex hash on the raw lng/lat, which the API gives to 1e-7°),
//              chained into runs; a run belongs to the cell its midpoint is in
//   coverWays  OSM ways (own-ground-osm-v1) whose 2 m stations lie ≥ 80 % inside polygons
//              of a compatible class (`ownClasses`, the parking fallback for service ways,
//              anything for crossings); bridge ways are tried against h ≥ 1 first
// Budget: ≤ 350 KB gz per cell; a cell over it is re-encoded at 0.15 m and listed.
//
// Source: BGT wegdeel, Kadaster via PDOK OGC API, CC0 1.0; OSM © OpenStreetMap contributors (ODbL).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { cellBounds, elevationIndex } from './game-cells.ts';
import { KEEP_FUNCTIE } from './fetch-bgt.ts';
import { BGT_ROADS_CACHE, readRawRoadsCell, type RawWegdeel } from './fetch-bgt-roads.ts';
import { cellKey, lngLatToLocal, type BridgeExtract } from '../../src/canalRecall/elevation/elevationData.ts';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { crossSection, isFietsstraat, type OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';
import { classOf, fallbackClasses, ownClasses, type SurfaceClass } from '../../src/canalRecall/ownGround/bgtWidth.ts';
import { distToLine, encodeLine, inRings, interiorPoint, polygonArea } from '../../src/canalRecall/ownGround/parks.ts';
import { TopoSimplifier, vertexKey } from '../../src/canalRecall/ownGround/topoSimplify.ts';
import { ROADS_ATTRIBUTION, ROAD_CELL_BUDGET_GZ, fietsstraatSection, kerbBetween, roadCellProblems, roadMesh, type RoadCell, type RoadClass, type RoadSurface, type RoadsManifest } from '../../src/canalRecall/ownGround/roadCells.ts';

type Vec2 = [number, number];
type LngLat = [number, number];
type Box = [number, number, number, number];

const argOf = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const OSM = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const OUT = argOf('--out') ?? 'artifacts/own-ground/staging/roads-v1';
const COVER_SHARE = 0.8;
const STATION_M = 2;
/** Polygons this far outside a cell take part in its cover tests (OSM cell files hold ways ~250 m past the cell). */
const NEIGHBOUR_REACH_M = 400;
/** An h ≥ 1 polygon this close to a measured or registered bridge footprint is "over a deck". */
const DECK_REACH_M = 5;

const TOL = Number(argOf('--tol') ?? 0.1);
const TOL_LEVER = 0.15;
const BUDGET = Number(argOf('--budget-kb') ?? ROAD_CELL_BUDGET_GZ / 1024) * 1024;
const onlyCells = argOf('--cells')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;

// ------------------------------------------------------------------ geometry

const bboxOf = (rings: readonly Vec2[][]): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};
const boxesMeet = (a: Box, b: Box, pad = 0) => !(a[2] < b[0] - pad || a[0] > b[2] + pad || a[3] < b[1] - pad || a[1] > b[3] + pad);

function sampleStations(g: Vec2[], step = STATION_M): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 1; i < g.length; i++) {
    const a = g[i - 1], b = g[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  if (g.length) out.push(g[g.length - 1]);
  return out;
}

class Grid<T extends { bbox: Box }> {
  private readonly cells = new Map<string, T[]>();
  constructor(private readonly size = 50) {}
  add(item: T): void {
    const [x0, y0, x1, y1] = item.bbox, s = this.size;
    for (let i = Math.floor(x0 / s); i <= Math.floor(x1 / s); i++) for (let j = Math.floor(y0 / s); j <= Math.floor(y1 / s); j++) {
      const k = `${i}:${j}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(item);
    }
  }
  at(x: number, y: number): T[] { return this.cells.get(`${Math.floor(x / this.size)}:${Math.floor(y / this.size)}`) ?? []; }
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// ------------------------------------------------------------------ polygons

interface Poly {
  id: string;
  cls: RoadClass;
  h: number;
  fv: string | null;
  /** Local metres, closed rings as the API gave them. */
  rings: Vec2[][];
  /** Exact vertex keys of the raw lng/lat rings (1e-7°, topoSimplify vertexKey): the kerb edge hash and the topology. */
  keys: number[][];
  bbox: Box;
  at: Vec2;
  owner: string;
}

interface Dropped { status: number; ended: number; functie: Record<string, number>; below: number; degenerate: number }

const index = elevationIndex();
const ownerOf = (p: Vec2): string => {
  const [lng, lat] = fromLocal(p[0], p[1]);
  const [x, y] = lngLatToLocal(index, lng, lat);
  return cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM));
};
/** A cell's bounds in the game frame (both frames are linear in lng/lat, so it is a rectangle). */
const cellBox = (key: string): Box => {
  const [x0, y0, x1, y1] = cellBounds(index, key);
  const a = toLocal(x0, y0), b = toLocal(x1, y1);
  return [a[0], a[1], b[0], b[1]];
};

const rawCache = new Map<string, { polys: Poly[]; dropped: Dropped; fetched: string } | null>();
function loadRaw(key: string): { polys: Poly[]; dropped: Dropped; fetched: string } | null {
  if (rawCache.has(key)) return rawCache.get(key)!;
  const cell = readRawRoadsCell(key);
  let out: { polys: Poly[]; dropped: Dropped; fetched: string } | null = null;
  if (cell) {
    const dropped: Dropped = { status: 0, ended: 0, functie: {}, below: 0, degenerate: 0 };
    const polys: Poly[] = [];
    for (const f of cell.features as RawWegdeel[]) {
      if (f.status && f.status !== 'bestaand') { dropped.status++; continue; }
      if (f.eind && f.eind < cell.fetched) { dropped.ended++; continue; }
      if (!KEEP_FUNCTIE.test(f.functie)) { dropped.functie[f.functie] = (dropped.functie[f.functie] ?? 0) + 1; continue; }
      const cls = classOf(f.functie);
      if (cls === 'other') { dropped.functie[f.functie] = (dropped.functie[f.functie] ?? 0) + 1; continue; }
      if (f.h < 0) { dropped.below++; continue; }
      f.g.forEach((poly, part) => {
        const rings = poly.map(r => r.map(([x, y]) => toLocal(x, y)));
        if (rings[0].length < 4) { dropped.degenerate++; return; }
        const at = interiorPoint(rings);
        if (!at) { dropped.degenerate++; return; }
        polys.push({ id: f.g.length > 1 ? `${f.id}#${part}` : f.id, cls, h: f.h, fv: f.fv, rings, keys: poly.map(r => r.map(([x, y]) => vertexKey(x, y))), bbox: bboxOf(rings), at, owner: ownerOf(at) });
      });
    }
    out = { polys, dropped, fetched: cell.fetched };
  }
  if (rawCache.size > 30) rawCache.delete(rawCache.keys().next().value!);
  rawCache.set(key, out);
  return out;
}

const osmCache = new Map<string, OsmGroundExtract | null>();
function loadOsm(key: string): OsmGroundExtract | null {
  if (osmCache.has(key)) return osmCache.get(key)!;
  const file = `${OSM}/cells/${key}.json.gz`;
  const out = existsSync(file) ? JSON.parse(gunzipSync(readFileSync(file)).toString()) as OsmGroundExtract : null;
  if (osmCache.size > 16) osmCache.delete(osmCache.keys().next().value!);
  osmCache.set(key, out);
  return out;
}

const neighbours = (key: string): string[] => {
  const [cx, cy] = key.split('_').map(Number), out: string[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(cellKey(cx + dx, cy + dy));
  return out;
};

// ------------------------------------------------------------------ decks (for the h ≥ 1 report)

interface Deck { id: string; ring: Vec2[]; bbox: Box; measured: boolean }
function loadDecks(): Grid<Deck> {
  const b = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/bridges.json', 'utf8')) as BridgeExtract;
  const grid = new Grid<Deck>(100);
  const ringOf = (flat: number[]): Vec2[] => {
    const out: Vec2[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) { const [lng, lat] = [index.origin[0] + flat[i] / 10 / index.metresPerDegree[0], index.origin[1] + flat[i + 1] / 10 / index.metresPerDegree[1]]; out.push(toLocal(lng, lat)); }
    return out;
  };
  for (const m of b.measured) { const ring = ringOf(m.outline); if (ring.length >= 3) grid.add({ id: m.id, ring, bbox: bboxOf([ring]), measured: true }); }
  for (const f of b.fallback) { const ring = ringOf(f.ring); if (ring.length >= 3) grid.add({ id: f.id, ring, bbox: bboxOf([ring]), measured: false }); }
  return grid;
}

// ------------------------------------------------------------------ kerbs

/** Kerb runs (vertex keys; positions in `at`) among `polys`, kept where the edge midpoint lies in `box`. */
function kerbRuns(polys: readonly Poly[], box: Box): { runs: number[][]; at: Map<number, Vec2>; edges: number; shared: number } {
  const edges = new Map<string, Poly[]>();
  const at = new Map<number, Vec2>();
  for (const p of polys) p.keys.forEach((ring, ri) => {
    const loc = p.rings[ri];
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i], b = ring[i + 1];
      if (a === b) continue;
      if (!at.has(a)) at.set(a, loc[i]);
      if (!at.has(b)) at.set(b, loc[i + 1]);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const list = edges.get(k);
      if (list) { if (!list.includes(p)) list.push(p); } else edges.set(k, [p]);
    }
  });
  let shared = 0;
  const kerb = new Set<string>();
  const adj = new Map<number, number[]>();
  for (const [k, ps] of edges) {
    if (ps.length < 2) continue;
    shared++;
    if (ps.length !== 2 || !kerbBetween({ c: ps[0].cls, h: ps[0].h }, { c: ps[1].cls, h: ps[1].h })) continue;
    const [a, b] = k.split('|').map(Number), pa = at.get(a)!, pb = at.get(b)!;
    const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
    if (mx < box[0] || mx >= box[2] || my < box[1] || my >= box[3]) continue;
    kerb.add(k);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  // Chain edges into runs: start at vertices that are not simple pass-throughs, then any leftover cycles.
  const used = new Set<string>();
  const runs: number[][] = [];
  const ekey = (a: number, b: number) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const walk = (start: number, next: number): void => {
    const run = [start];
    let prev = start, cur = next;
    used.add(ekey(prev, cur));
    for (;;) {
      run.push(cur);
      const ns = adj.get(cur)!;
      if (ns.length !== 2) break;
      const n = ns[0] === prev ? ns[1] : ns[0];
      const e = ekey(cur, n);
      if (used.has(e)) break;
      used.add(e); prev = cur; cur = n;
    }
    runs.push(run);
  };
  for (const [v, ns] of adj) if (ns.length !== 2) for (const n of ns) if (!used.has(ekey(v, n))) walk(v, n);
  for (const [v, ns] of adj) for (const n of ns) if (!used.has(ekey(v, n))) walk(v, n);
  return { runs, at, edges: edges.size, shared };
}

/** `ownClasses` plus the inrit polygons a pavement-level way (sidewalk, path, steps, pedestrian street) runs across. */
function coverClasses(hw: string, tags: Record<string, string>): ReadonlySet<SurfaceClass> {
  const own = new Set(ownClasses(hw, tags));
  if (own.has('foot') || own.has('pedestrian')) own.add('driveway');
  return own;
}

// ------------------------------------------------------------------ main

interface HwRow { ways: number; covered: number; onDeck: number; uncoveredStations: Record<string, number> }

function main(): void {
  const manifest = JSON.parse(readFileSync(`${OSM}/cells.json`, 'utf8')) as { cells: string[] };
  const gameCells = new Set(manifest.cells);
  const keys = (onlyCells ?? manifest.cells).filter(k => gameCells.has(k) && existsSync(`${BGT_ROADS_CACHE}/${k}.json.gz`)).sort();
  const skipped = (onlyCells ?? manifest.cells).filter(k => !keys.includes(k));
  console.log(`${keys.length} cells to build${skipped.length ? `, ${skipped.length} without a raw cache: ${skipped.slice(0, 10).join(' ')}${skipped.length > 10 ? ' …' : ''}` : ''}`);
  const decks = loadDecks();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/cells`, { recursive: true });

  const byClass: Record<string, number> = {}, byH: Record<string, number> = {}, byMesh: Record<string, number> = {}, byClassH: Record<string, number> = {};
  const dropped: Dropped = { status: 0, ended: 0, functie: {}, below: 0, degenerate: 0 };
  const gzPerCell: Record<string, number> = {};
  const hwRows = new Map<string, HwRow>();
  const seenWays = new Set<number>();
  const lever: { key: string; at01: number; at015: number }[] = [];
  const neighboursMissing = new Set<string>();
  const highNoDeck: { key: string; id: string; cls: RoadClass; h: number; areaM2: number; lngLat: LngLat }[] = [];
  const fietsstraatWays = new Map<number, string>();
  let polygons = 0, rawVertices = 0, simplifiedVertices = 0, encodedVertices = 0, kerbRunsN = 0, kerbM = 0, kerbEdges = 0, sharedEdges = 0;
  const emptyCells: string[] = [];
  let graphPolys = 0, greyRails = 0, greyOther = 0;
  let fietsstraatPolys = 0, highOverDeck = 0, highNoDeckArea = 0, areaM2 = 0, coverTotal = 0, crossings = 0, fetched = '';
  const t0 = Date.now();

  keys.forEach((key, ci) => {
    const own = loadRaw(key)!;
    fetched = fetched || own.fetched;
    for (const k of Object.keys(dropped) as (keyof Dropped)[]) if (k === 'functie') for (const [f, n] of Object.entries(own.dropped.functie)) dropped.functie[f] = (dropped.functie[f] ?? 0) + n; else dropped[k] += own.dropped[k];
    const box = cellBox(key);
    const owned = own.polys.filter(p => p.owner === key);

    // 3×3 polygons near the cell for cover tests, deduplicated by id.
    const near = new Map<string, Poly>();
    for (const n of neighbours(key)) {
      const r = loadRaw(n);
      if (!r) { if (gameCells.has(n)) neighboursMissing.add(n); continue; }
      for (const p of r.polys) if (boxesMeet(p.bbox, box, NEIGHBOUR_REACH_M) && !near.has(p.id)) near.set(p.id, p);
    }
    const grid = new Grid<Poly>(50);
    for (const p of near.values()) grid.add(p);
    const polysAt = (x: number, y: number): Poly[] => grid.at(x, y).filter(p => x >= p.bbox[0] && x <= p.bbox[2] && y >= p.bbox[1] && y <= p.bbox[3] && inRings(p.rings, x, y));

    // Topology: the union edge graph of every polygon that can touch one this cell writes (its own, and the raw
    // cell's pad polygons for the kerbs), from the cells their extent reaches (the 3×3, more for a long polygon).
    const written = [...owned, ...own.polys];
    const ext = bboxOf(written.map(p => [[p.bbox[0], p.bbox[1]], [p.bbox[2], p.bbox[3]]] as Vec2[]));
    const [ex0, ey0] = ownerOf([ext[0] - 1, ext[1] - 1]).split('_').map(Number), [ex1, ey1] = ownerOf([ext[2] + 1, ext[3] + 1]).split('_').map(Number);
    const topo = new TopoSimplifier(), inGraph = new Set<string>();
    if (written.length) for (let cx = Math.min(ex0, ex1); cx <= Math.max(ex0, ex1); cx++) for (let cy = Math.min(ey0, ey1); cy <= Math.max(ey0, ey1); cy++) {
      const r = loadRaw(cellKey(cx, cy));
      if (!r) continue;
      for (const p of r.polys) if (!inGraph.has(p.id) && boxesMeet(p.bbox, ext)) { inGraph.add(p.id); for (const k of p.keys) topo.addRing(k); }
    }
    graphPolys += inGraph.size;

    // OSM: fietsstraat sections and cover tests.
    const osm = loadOsm(key);
    const red = new Set<Poly>();
    const along = new Map<Poly, { fiets: number; other: number; rails: number }>();
    const cover: number[] = [];
    if (osm) {
      for (const w of osm.ways) {
        const section = crossSection(w.tags, w.bw);
        if (!section) continue;
        const line = w.g.map(([lng, lat]) => toLocal(lng, lat));
        const stations = sampleStations(line);
        const hw = w.tags.highway;
        // Metres of each carriageway along every rijbaan polygon it crosses (roadCells fietsstraatSection).
        const carriageWay = ownClasses(hw, w.tags).has('carriage') && hw !== 'pedestrian';
        const fietsstraat = isFietsstraat(w.tags) && carriageWay;
        const tram = (w.tags.embedded_rails ?? '').split(';').includes('tram');
        if (carriageWay || tram) {
          const total = line.reduce((s, p, i) => i ? s + Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) : 0, 0);
          const step = total / Math.max(1, stations.length - 1);
          for (const st of stations) for (const p of polysAt(st[0], st[1])) {
            if (p.cls !== 'carriage') continue;
            const m = along.get(p) ?? along.set(p, { fiets: 0, other: 0, rails: 0 }).get(p)!;
            if (fietsstraat) m.fiets += step; else if (carriageWay) m.other += step;
            if (tram) m.rails += step;
          }
        }
        const crossing = w.tags.footway === 'crossing' || w.tags.cycleway === 'crossing';
        const classes: ReadonlySet<SurfaceClass> | null = crossing ? null : coverClasses(hw, w.tags);
        const fallback = crossing ? null : fallbackClasses(hw);
        const bridge = !!w.tags.bridge && w.tags.bridge !== 'no';
        const share = (ok: (p: Poly) => boolean) => stations.filter(s => polysAt(s[0], s[1]).some(ok)).length / Math.max(1, stations.length);
        const test = (cs: ReadonlySet<SurfaceClass> | null, minH: number) => share(p => p.h >= minH && (!cs || cs.has(p.cls)));
        let onDeck = false, covered = false;
        if (bridge && test(classes, 1) >= COVER_SHARE) { onDeck = true; covered = true; }
        else if (test(classes, 0) >= COVER_SHARE) covered = true;
        else if (fallback && test(fallback, 0) >= COVER_SHARE) covered = true;
        if (covered) cover.push(w.id);
        if (crossing) crossings++;
        if (!seenWays.has(w.id)) {
          seenWays.add(w.id);
          const row = hwRows.get(hw) ?? hwRows.set(hw, { ways: 0, covered: 0, onDeck: 0, uncoveredStations: {} }).get(hw)!;
          row.ways++; if (covered) row.covered++; if (onDeck) row.onDeck++;
          // What an uncovered way's stations stand on, for the report (none = outside every wegdeel: a square, a yard, a park path).
          if (!covered) for (const st of stations) {
            const hit = polysAt(st[0], st[1]);
            const label = hit.length ? [...new Set(hit.map(p => p.cls))].sort().join('+') : 'none';
            row.uncoveredStations[label] = (row.uncoveredStations[label] ?? 0) + 1;
          }
          if (fietsstraat) fietsstraatWays.set(w.id, w.tags.name ?? '?');
        }
      }
    }
    for (const [p, m] of along) {
      if (m.fiets < 1) continue;
      if (fietsstraatSection(m)) red.add(p);
      else if (p.owner === key) { if (m.rails >= 12) greyRails++; else greyOther++; }
    }
    cover.sort((a, b) => a - b);
    coverTotal += cover.length;

    // Surfaces at a tolerance; the whole cell is re-encoded at the lever tolerance when over budget.
    const encodeAll = (tol: number): { cell: RoadCell; simplified: number; encoded: number; kerbRuns: number; kerbM: number } => {
      const memo = new Map<string, ({ keys: number[]; pts: Vec2[] } | null)[]>();
      const simplifiedOf = (p: Poly) => memo.get(p.id) ?? memo.set(p.id, p.keys.map((k, i) => topo.simplifyRing(k, p.rings[i], tol))).get(p.id)!;
      const surfaces: RoadSurface[] = [];
      let simplified = 0, encoded = 0;
      for (const p of owned) {
        const rings: number[][] = [];
        const sp = simplifiedOf(p);
        for (let i = 0; i < p.rings.length; i++) {
          const s = sp[i]?.pts;
          if (!s) { if (i === 0) break; else continue; }
          const e = encodeLine(s);
          if (e.length < 6) { if (i === 0) break; else continue; }
          simplified += s.length; encoded += e.length / 2;
          rings.push(e);
        }
        if (!rings.length) continue;
        surfaces.push({ k: roadMesh(p.cls, p.fv, red.has(p)), c: p.cls, h: p.h, r: rings });
      }
      const kr = kerbRuns(own.polys, box);
      // A kerb keeps the vertices its polygons kept (the shared chain is simplified once), and its own ends.
      const kept = new Set<number>();
      for (const p of own.polys) for (const r of simplifiedOf(p)) if (r) for (const k of r.keys) kept.add(k);
      const kerbs: number[][] = [];
      let metres = 0;
      for (const run of kr.runs) {
        const s = run.filter((k, i) => i === 0 || i === run.length - 1 || kept.has(k)).map(k => kr.at.get(k)!);
        const e = encodeLine(s);
        if (e.length < 4) continue;
        for (let i = 1; i < s.length; i++) metres += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        kerbs.push(e);
      }
      kerbEdgesCell = kr.edges; sharedEdgesCell = kr.shared;
      return { cell: { version: 1, key, surfaces, kerbs, coverWays: cover }, simplified, encoded, kerbRuns: kerbs.length, kerbM: metres };
    };
    let kerbEdgesCell = 0, sharedEdgesCell = 0;
    let built = encodeAll(TOL);
    let gz = gzipSync(Buffer.from(JSON.stringify(built.cell)), { level: 9 });
    if (gz.length > BUDGET && TOL < TOL_LEVER) {
      const at01 = gz.length;
      built = encodeAll(TOL_LEVER);
      gz = gzipSync(Buffer.from(JSON.stringify(built.cell)), { level: 9 });
      lever.push({ key, at01, at015: gz.length });
    }
    const problems = roadCellProblems(built.cell);
    if (problems.length) throw new Error(`${key}: invalid cell: ${problems.join('; ')}`);
    // A cell with no wegdeel at all (8_-1, open water) is not published: the runtime keeps the bands there.
    if (!built.cell.surfaces.length) { emptyCells.push(key); return; }
    writeFileSync(`${OUT}/cells/${key}.json.gz`, gz);
    gzPerCell[key] = gz.length;

    // Tallies.
    for (const p of owned) {
      let raw = 0; for (const r of p.rings) raw += r.length - 1;
      rawVertices += raw;
    }
    simplifiedVertices += built.simplified; encodedVertices += built.encoded;
    kerbRunsN += built.kerbRuns; kerbM += built.kerbM; kerbEdges += kerbEdgesCell; sharedEdges += sharedEdgesCell;
    for (const s of built.cell.surfaces) {
      polygons++;
      byClass[s.c] = (byClass[s.c] ?? 0) + 1; byH[s.h] = (byH[s.h] ?? 0) + 1; byMesh[s.k] = (byMesh[s.k] ?? 0) + 1;
      byClassH[`${s.c}/${s.h}`] = (byClassH[`${s.c}/${s.h}`] ?? 0) + 1;
      if (s.k === 'cycle' && s.c === 'carriage') fietsstraatPolys++;
    }
    for (const p of owned) {
      const a = polygonArea(p.rings); areaM2 += a;
      if (p.h < 1) continue;
      const over = decks.at(p.at[0], p.at[1]).concat(...[[-DECK_REACH_M, 0], [DECK_REACH_M, 0], [0, -DECK_REACH_M], [0, DECK_REACH_M]].map(([dx, dy]) => decks.at(p.at[0] + dx, p.at[1] + dy)))
        .some(d => boxesMeet(d.bbox, p.bbox, DECK_REACH_M) && (inRings([d.ring], p.at[0], p.at[1]) || distToLine(d.ring, p.at[0], p.at[1], true) <= DECK_REACH_M || p.rings[0].some(v => inRings([d.ring], v[0], v[1]))));
      if (over) highOverDeck++;
      else { highNoDeckArea += a; if (highNoDeck.length < 400) highNoDeck.push({ key, id: p.id, cls: p.cls, h: p.h, areaM2: Math.round(a), lngLat: fromLocal(p.at[0], p.at[1]).map(v => Math.round(v * 1e6) / 1e6) as LngLat }); }
    }
    if ((ci + 1) % 10 === 0 || ci === keys.length - 1) console.log(`${ci + 1}/${keys.length} ${key}: ${built.cell.surfaces.length} polygons, ${built.cell.kerbs.length} kerb runs, ${cover.length} covered ways, ${Math.round(gz.length / 1024)} KB, ${Math.round((Date.now() - t0) / 1000)} s`);
  });

  const sizes = Object.values(gzPerCell);
  const total = sizes.reduce((s, v) => s + v, 0);
  const coverByHighway: Record<string, { ways: number; covered: number; share: number; onDeck: number; uncoveredStations: Record<string, number> }> = {};
  for (const [hw, r] of [...hwRows].sort((a, b) => b[1].ways - a[1].ways)) {
    const us = Object.fromEntries(Object.entries(r.uncoveredStations).sort((a, b) => b[1] - a[1]).slice(0, 6));
    coverByHighway[hw] = { ways: r.ways, covered: r.covered, share: +(r.covered / Math.max(1, r.ways)).toFixed(3), onDeck: r.onDeck, uncoveredStations: us };
  }
  const fietsstraatNames = [...new Set(fietsstraatWays.values())].sort();
  const allWays = [...hwRows.values()].reduce((s, r) => s + r.ways, 0), allCovered = [...hwRows.values()].reduce((s, r) => s + r.covered, 0);
  const report = {
    built: new Date().toISOString(),
    source: 'BGT wegdeel, Kadaster via PDOK OGC API (CC0 1.0); OSM own-ground-osm-v1 (ODbL)',
    tolerance: { defaultM: TOL, leverM: TOL_LEVER, budgetBytes: BUDGET, cellsOverBudgetAtDefault: lever },
    cells: { built: keys.length - emptyCells.length, emptyNotPublished: emptyCells, skippedNoCache: skipped.length, neighboursMissing: [...neighboursMissing].sort() },
    gzBytes: { total, totalMB: +(total / 1048576).toFixed(2), max: Math.max(0, ...sizes), median: Math.round(median(sizes)), perCell: gzPerCell },
    polygons: { count: polygons, areaHa: +(areaM2 / 1e4).toFixed(1), byClass, byH, byClassH, byMesh, fietsstraatOverrides: fietsstraatPolys },
    dropped,
    vertices: { raw: rawVertices, simplified: simplifiedVertices, encodedDistinct: encodedVertices, keptShare: +(simplifiedVertices / Math.max(1, rawVertices)).toFixed(3), bytesPerPolygon: polygons ? Math.round(total / polygons) : 0 },
    kerbs: { runs: kerbRunsN, km: +(kerbM / 1000).toFixed(1), ringEdges: kerbEdges, sharedEdges },
    fietsstraat: { ways: fietsstraatWays.size, polygonsTurnedRed: fietsstraatPolys, keptGreyTramTrack: greyRails, keptGreyOtherCarriageway: greyOther, names: fietsstraatNames },
    topology: { method: 'shared chains simplified once (topoSimplify.ts)', graphPolygonsPerCellMean: Math.round(graphPolys / Math.max(1, keys.length)) },
    coverWays: { total: coverTotal, uniqueWays: allWays, uniqueCovered: allCovered, share: +(allCovered / Math.max(1, allWays)).toFixed(3), crossingsSeen: crossings, byHighway: coverByHighway },
    highOverDeck: { overDeck: highOverDeck, noDeck: highNoDeck.length, noDeckAreaM2: Math.round(highNoDeckArea), samples: highNoDeck.slice(0, 60) },
  };
  const published = keys.filter(k => !emptyCells.includes(k));
  const out: RoadsManifest = { version: 1, cells: published, fetched: fetched || new Date().toISOString().slice(0, 10) + 'T00:00:00Z', attribution: ROADS_ATTRIBUTION, report: { built: report.built, cells: published.length, gzBytes: { total, max: report.gzBytes.max, median: report.gzBytes.median }, polygons, kerbRuns: kerbRunsN, coverWays: coverTotal } };
  writeFileSync(`${OUT}/cells.json`, JSON.stringify(out));
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  const { perCell, ...gzSummary } = report.gzBytes;
  void perCell;
  console.log(JSON.stringify({ ...report, gzBytes: gzSummary, highOverDeck: { ...report.highOverDeck, samples: report.highOverDeck.samples.slice(0, 5) } }, null, 1));
}

main();
