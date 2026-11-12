// Ground v2: one clipped partition per cell, draped by a constrained Delaunay triangulation (lane G2a #372).
// Design: docs/handoffs/ground-v2-design-20261110.md, "The bake (G2a)". Productionises scripts/spikes/ground-v2-partition.ts.
//
//   1. features (game-frame metres) → integer mm in the global game frame (so a seam crossing is the same integer in
//      both neighbours), cleaned and clipped to the cell rect by polygon-clipping;
//   2. the arrangement: walk the groups by precedence, piece = (∪ group ∩ rect) − taken; the rest group takes rect − taken;
//   3. the pieces snap to the file's u16 grid (GRID_Q steps across the rect: both neighbours share the seam's grid);
//   4. noding (a vertex within NODE_TOL_U of an edge's interior splits it), the global seam grid, edge densification
//      against the relief, LOD 1's arc simplification (each shared arc once, so both sides keep matching);
//   5. Steiner points from a relief quadtree rooted on the global 1,024 m grid, kept off the constraints;
//   6. constrainautor + delaunator, then refinement rounds at triangle centroids whose relief error exceeds the class's
//      tolerance (road classes tight, flat land classes looser: judgement ruling 3's 7.5 cm mitigation);
//   7. each triangle classified by its centroid (even-odd per group over the pieces' edges), water dropped;
//   8. levels: a vertex shared by triangles of different levels (carriageway / sidewalk) is duplicated per level and the
//      edges between them become vertical step strips, never a lift.
//
// Pure and deterministic: integer coordinates, sorted inputs, no Math.random. Node-only (the bake), the runtime bundle
// never imports it.

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';
import type { GroundLayer } from './groundCell.js';
import type { GroundSource } from './sourceTrace.js';
import type { Rect } from './groundStore.js';
import { GRID_Q, octEncode, unitX, unitY } from './groundV2Format.js';

export type Vec2 = [number, number];

/** A partition class: one GroundLayer at one level. Groups are walked in array order (precedence, highest first). */
export interface PartitionGroup {
  name: string;
  /** Design precedence rank (0 water … 11 land); groups of one rank are ordered by layer. */
  rank: number;
  /** The material; null: a hole (water), no triangles drawn. */
  layer: GroundLayer | null;
  /** Index into SurfaceBakeInput.levelZ (0 carriageway level, 1 sidewalk level). */
  level: number;
  /** Flat land class (park, open ground, OSM fill, courtyard, land): the looser Steiner tolerance applies. */
  flat: boolean;
  source: GroundSource;
}

/** One source polygon (outer ring first, then holes), game-frame metres. */
export interface PartitionFeature { group: number; id: string; rings: Vec2[][] }

export interface SurfaceBakeInput {
  key: string;
  rect: Rect;
  groups: readonly PartitionGroup[];
  features: readonly PartitionFeature[];
  /** The group that takes rect − everything (land). */
  restGroup: number;
  /** Relief, scene z metres, game frame. */
  height: (x: number, y: number) => number;
  /** Lift over the relief per level, metres. */
  levelZ: readonly number[];
}

export interface SurfaceBakeOptions {
  /** Relief tolerance on road classes (carriageway, cycle, footway, parking, kerb), metres. */
  tolRoadM: number;
  /** Relief tolerance on flat land classes, metres. */
  tolFlatM: number;
  /** Quadtree: smallest and largest square, metres. */
  minSquareM: number; maxSquareM: number;
  /** Edge densification floor, metres. */
  edgeMinM: number;
  /** Global seam grid: a vertex every this many metres along each cell side. */
  seamGridM: number;
  /** Centroid refinement rounds. */
  refineRounds: number;
  /** Douglas–Peucker on every arc between junctions (0: none), metres. LOD 1: 0.5. */
  simplifyM: number;
  /** Draw level steps (duplicated vertices + strips); false: every triangle at level 0. */
  steps: boolean;
  /** Steiner points are kept this far off any constraint, metres. */
  steinerClearM: number;
  /** Constraint edges longer than this are split (metres). */
  maxEdgeM: number;
  /** Rounds after the relief rounds that only split slivers. */
  sliverRounds: number;
  /**
   * Relief refinement samples each triangle on a barycentric lattice this fine (metres; 0: the centroid only) and
   * inserts its worst point. The audit samples the drawn surface every 0.5 m: 84 % of the first bake's float over 5 cm
   * lay inside triangles of 16 m² and more whose centroid was within tolerance (-4_-3, 2026-11-12).
   */
  refineLatticeM: number;
}

/** The audit's sliver: aspect (longest edge / height, l² / 2A) over SLIVER_ASPECT with area over SLIVER_M2. */
export const SLIVER_ASPECT = 20, SLIVER_M2 = 0.05;

export const LOD0_OPTIONS: SurfaceBakeOptions = { tolRoadM: 0.05, tolFlatM: 0.05, minSquareM: 2, maxSquareM: 32, edgeMinM: 1, seamGridM: 2, refineRounds: 3, simplifyM: 0, steps: true, steinerClearM: 0.3, maxEdgeM: 64, sliverRounds: 6, refineLatticeM: 0 };
export const LOD1_OPTIONS: SurfaceBakeOptions = { tolRoadM: 0.15, tolFlatM: 0.15, minSquareM: 4, maxSquareM: 64, edgeMinM: 2, seamGridM: 8, refineRounds: 1, simplifyM: 0.5, steps: false, steinerClearM: 0.6, maxEdgeM: 32, sliverRounds: 2, refineLatticeM: 0 };

/** A vertex this close to an edge's interior (u16 units, ~7.6 mm) splits it. */
export const NODE_TOL_U = 0.5;

export interface BakedSurface {
  key: string; rect: Rect;
  /** Per vertex (after level duplication). */
  u: Uint16Array; v: Uint16Array; zMm: Int32Array; oct: Int8Array; level: Uint8Array;
  /** Surface triangles (3 per) and their group. */
  tris: Uint32Array; triGroup: Uint16Array;
  /** Step strips (3 per triangle) and their layer. */
  steps: Uint32Array; stepLayer: GroundLayer[];
  stats: SurfaceBakeStats;
}

export interface SurfaceBakeStats {
  ms: Record<string, number>;
  pieces: number; partitionVertices: number; /** Seam vertices moved to a canonical stop. */ seamSnapped: number; /** Seam-edge triangles given the sources' class at the edge (seamClassifier). */ seamReclassed: number; edges: number; nodeSplits: number; crossSplits: number; seamGridPoints: number; densified: number; simplifiedAway: number;
  steiner: number; steinerDropped: number; refineAdded: number; /** Sliver splits made, and slivers left in the last round looked at. */ sliverSplits: number; slivers: number; points: number;
  triangles: number; stepTriangles: number; vertices: number;
  failedEdges: { a: [number, number]; b: [number, number] }[];
  /** Triangles no piece claims after the neighbour fill (a crack in the partition), the ones filled, and the ones two pieces claim. */
  unclassified: number; filled: number; ambiguous: number; unclassifiedM2: number;
  /** Area per group: the clipped pieces' and the triangles' (m²). */
  pieceM2: number[]; triM2: number[];
  rectM2: number; closureM2: number;
  /** Centroid relief error over non-water triangles, mm (final mesh). */
  errP50: number; errP99: number; errP999: number; errMax: number; over5cmM2: number;
  /** Where the largest unresolved errors are (game frame, metres), for G3 / a human. */
  worst: { x: number; y: number; errMm: number }[];
  clipErrors: string[];
}

// ------------------------------------------------------------------ helpers

const now = () => performance.now();
const closeRing = (r: Ring): Ring => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r);
const ringArea2 = (r: readonly (readonly number[])[]): number => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a; };

/** Integer mm, consecutive duplicates removed, closed; null when fewer than 3 distinct points or no area. */
function ringMm(r: readonly Vec2[]): Ring | null {
  const out: Ring = [];
  for (const p of r) { const x = Math.round(p[0] * 1000), y = Math.round(p[1] * 1000); const l = out[out.length - 1]; if (!l || l[0] !== x || l[1] !== y) out.push([x, y]); }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  if (out.length < 3 || ringArea2(out) === 0) return null;
  return closeRing(out);
}

/**
 * A vertex wherever a ring crosses one of the rect's four lines, computed from the segment alone (endpoints in a
 * canonical order, rounded to the mm): both neighbours insert the same integer, so the clip to the rect finds the seam
 * crossing as an input vertex instead of computing it on its own float path (seam determinism, design Risk 5).
 */
export function splitAtLines(r: Ring, rectMm: Rect, stops?: Set<number>[]): Ring {
  const out: Ring = [];
  for (let i = 0; i + 1 < r.length; i++) {
    const p = r[i], q = r[i + 1];
    out.push(p);
    const flip = p[0] > q[0] || (p[0] === q[0] && p[1] > q[1]);
    const [a, b] = flip ? [q, p] : [p, q];
    const cuts: [number, number, number][] = [];
    for (const X of [rectMm[0], rectMm[2]]) if ((a[0] - X) * (b[0] - X) < 0) { const t = (X - a[0]) / (b[0] - a[0]); cuts.push([t, X, Math.round(a[1] + t * (b[1] - a[1]))]); }
    for (const Y of [rectMm[1], rectMm[3]]) if ((a[1] - Y) * (b[1] - Y) < 0) { const t = (Y - a[1]) / (b[1] - a[1]); cuts.push([t, Math.round(a[0] + t * (b[0] - a[0])), Y]); }
    if (!cuts.length) continue;
    cuts.sort((m, n) => m[0] - n[0]);
    if (flip) cuts.reverse();
    for (const [, x, y] of cuts) {
      const l = out[out.length - 1]; if (l[0] !== x || l[1] !== y) out.push([x, y]);
      // The canonical seam stops per side (west, east, south, north): along-side coordinate in mm.
      if (stops) { if (x === rectMm[0]) stops[0].add(y); if (x === rectMm[2]) stops[1].add(y); if (y === rectMm[1]) stops[2].add(x); if (y === rectMm[3]) stops[3].add(x); }
    }
  }
  out.push(r[r.length - 1]);
  return out;
}

/** Union of polygons, robust: one call, else one at a time skipping those polygon-clipping rejects. */
function safeUnion(polys: Polygon[], errors: string[], label: string): MultiPolygon {
  if (!polys.length) return [];
  try { return polygonClipping.union(polys[0], ...polys.slice(1)); } catch (e) {
    let acc: MultiPolygon = [];
    for (let i = 0; i < polys.length; i++) {
      try { acc = acc.length ? polygonClipping.union(acc, polys[i]) : polygonClipping.union(polys[i]); } catch (e2) { errors.push(`${label}[${i}]: ${String(e2).slice(0, 80)}`); }
    }
    return acc;
  }
}

const snapMp = (m: MultiPolygon, q: number): MultiPolygon => m.map(p => p.map(r => r.map(([x, y]) => [Math.round(x / q) * q, Math.round(y / q) * q] as [number, number])));

/**
 * mine − taken, robust: polygon-clipping 0.15 can fail to close an output ring on near-degenerate input ("Unable to
 * complete output ring"). Then polygon by polygon, and a failing polygon retried on a 5 mm grid; one that still fails
 * is left to the rest group (logged, its area becomes land).
 */
function safeDifference(mine: MultiPolygon, taken: MultiPolygon, errors: string[], label: string): MultiPolygon {
  try { return polygonClipping.difference(mine, taken); } catch { /* snapped, then polygon by polygon */ }
  const snap = snapMp;
  try { const r = polygonClipping.difference(snap(mine, 5), taken); errors.push(`${label} − taken: snapped 5 mm`); return r; } catch { /* polygon by polygon */ }
  const out: MultiPolygon = [];
  for (let i = 0; i < mine.length; i++) {
    try { out.push(...polygonClipping.difference([mine[i]], taken)); continue; } catch { /* retry snapped */ }
    try { out.push(...polygonClipping.difference(snap([mine[i]], 5), taken)); errors.push(`${label}[${i}] − taken: snapped 5 mm`); } catch (e) { errors.push(`${label}[${i}] − taken: ${String(e).slice(0, 80)}`); }
  }
  return out;
}

// ------------------------------------------------------------------ the arrangement

export interface Arrangement { pieces: { group: number; poly: MultiPolygon }[]; errors: string[]; rectMm: Rect; /** Canonical seam stops per side (mm along it): where an input ring crosses or touches the side. */ stops: Set<number>[]; /** ms per group: union, difference, taken. */ timing: Record<string, [number, number, number]> }

/** Steps 1–2: precedence clip in integer mm. */
export function arrange(input: Pick<SurfaceBakeInput, 'rect' | 'groups' | 'features' | 'restGroup'>): Arrangement {
  const rectMm = input.rect.map(v => Math.round(v * 1000)) as Rect;
  const rectRing: Ring = [[rectMm[0], rectMm[1]], [rectMm[2], rectMm[1]], [rectMm[2], rectMm[3]], [rectMm[0], rectMm[3]], [rectMm[0], rectMm[1]]];
  const errors: string[] = [];
  const stops: Set<number>[] = [new Set(), new Set(), new Set(), new Set()];
  // An input vertex exactly on a side is a stop too.
  for (const f of input.features) for (const r of f.rings) for (const [x, y] of r) { const X = Math.round(x * 1000), Y = Math.round(y * 1000); if (X === rectMm[0]) stops[0].add(Y); if (X === rectMm[2]) stops[1].add(Y); if (Y === rectMm[1]) stops[2].add(X); if (Y === rectMm[3]) stops[3].add(X); }
  const byGroup = new Map<number, { id: string; poly: Polygon }[]>();
  const pad = 1000;
  for (const f of input.features) {
    if (!f.rings.length) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of f.rings[0]) { const X = x * 1000, Y = y * 1000; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
    if (x1 < rectMm[0] - pad || x0 > rectMm[2] + pad || y1 < rectMm[1] - pad || y0 > rectMm[3] + pad) continue;
    const outer = ringMm(f.rings[0]);
    if (!outer) continue;
    const poly: Polygon = [splitAtLines(outer, rectMm, stops)];
    for (const h of f.rings.slice(1)) { const r = ringMm(h); if (r) poly.push(splitAtLines(r, rectMm, stops)); }
    const l = byGroup.get(f.group); if (l) l.push({ id: f.id, poly }); else byGroup.set(f.group, [{ id: f.id, poly }]);
  }
  const pieces: Arrangement['pieces'] = [];
  let taken: MultiPolygon = [];
  const timing: Arrangement['timing'] = {};
  for (let g = 0; g < input.groups.length; g++) {
    let mine: MultiPolygon; const tg = now();
    if (g === input.restGroup) mine = [[rectRing]];
    else {
      const fs = byGroup.get(g);
      if (!fs?.length) continue;
      // Stable order: by id, so the union's input (and its float path) never depends on load order.
      fs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const u = safeUnion(fs.map(f => f.poly), errors, input.groups[g].name);
      if (!u.length) continue;
      try { mine = polygonClipping.intersection(u, [rectRing]); } catch (e) { errors.push(`${input.groups[g].name} ∩ rect: ${String(e).slice(0, 80)}`); continue; }
    }
    if (!mine.length) continue;
    let piece: MultiPolygon = mine;
    const tu = now();
    if (taken.length) piece = safeDifference(mine, taken, errors, input.groups[g].name);
    const td = now();
    if (piece.length) pieces.push({ group: g, poly: piece });
    if (!taken.length) taken = mine;
    else try { taken = polygonClipping.union(taken, mine); } catch {
      // The snapped retry first (one call), then polygon by polygon.
      try { taken = polygonClipping.union(taken, piece.length ? piece : mine); errors.push(`taken ∪ ${input.groups[g].name}: by its piece`); } catch {
      try { taken = polygonClipping.union(taken, snapMp(mine, 5)); errors.push(`taken ∪ ${input.groups[g].name}: snapped 5 mm`); } catch {
      for (let i = 0; i < mine.length; i++) {
        try { taken = polygonClipping.union(taken, [mine[i]]); } catch (e) { errors.push(`taken ∪ ${input.groups[g].name}[${i}]: ${String(e).slice(0, 80)}`); }
      }
    } } }
    timing[input.groups[g].name] = [Math.round(tu - tg), Math.round(td - tu), Math.round(now() - td)];
  }
  return { pieces, errors, rectMm, timing, stops };
}

// ------------------------------------------------------------------ the bake

/**
 * The precedence class at a point from the sources alone (first group in order whose feature holds the point, even-odd
 * per feature; else the rest group): what both neighbours agree on along their shared side. Features are prefiltered
 * to those within 1 m of a side line. Coordinates in metres, compared in integer mm as the arrangement does.
 */
export function seamClassifier(input: SurfaceBakeInput): (x: number, y: number) => number {
  const [x0, y0, x1, y1] = input.rect.map(v => Math.round(v * 1000));
  const near: { g: number; rings: number[][][] }[] = [];
  for (const f of input.features) {
    if (!f.rings.length || f.group === input.restGroup) continue;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of f.rings[0]) { const X = Math.round(x * 1000), Y = Math.round(y * 1000); if (X < a) a = X; if (X > c) c = X; if (Y < b) b = Y; if (Y > d) d = Y; }
    if (c < x0 - 1000 || a > x1 + 1000 || d < y0 - 1000 || b > y1 + 1000) continue;
    const touches = (lo: number, hi: number, line: number) => lo <= line + 1000 && hi >= line - 1000;
    if (!(touches(a, c, x0) || touches(a, c, x1) || touches(b, d, y0) || touches(b, d, y1))) continue;
    near.push({ g: f.group, rings: f.rings.map(r => r.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)])) });
  }
  near.sort((p, q) => p.g - q.g);
  return (x: number, y: number) => {
    const X = x * 1000, Y = y * 1000;
    for (const { g, rings } of near) {
      let inside = false;
      for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > Y) !== (yj > Y) && X < xj + (Y - yj) * (xi - xj) / (yi - yj)) inside = !inside;
      }
      if (inside) return g;
    }
    return input.restGroup;
  };
}

/** Steps 3–8 (and 1–2 through `arrange`). */
export function bakeSurface(input: SurfaceBakeInput, opt: SurfaceBakeOptions): BakedSurface {
  const ms: Record<string, number> = {};
  let t = now();
  const lap = (name: string) => { const n = now(); ms[name] = Math.round(n - t); t = n; };
  const { rect } = input, Q = GRID_Q;
  const arr = arrange(input);
  lap('arrange');
  const [X0, Y0, X1, Y1] = arr.rectMm, W = X1 - X0, H = Y1 - Y0;
  // Only a point exactly on a side lands on it: one a few mm inside stays one step in, so it never becomes a seam
  // vertex the neighbour does not have.
  const uOf = (xmm: number) => (xmm <= X0 ? 0 : xmm >= X1 ? Q : Math.max(1, Math.min(Q - 1, Math.round((xmm - X0) * Q / W))));
  const vOf = (ymm: number) => (ymm <= Y0 ? 0 : ymm >= Y1 ? Q : Math.max(1, Math.min(Q - 1, Math.round((ymm - Y0) * Q / H))));
  const mPerU = (rect[2] - rect[0]) / Q, mPerV = (rect[3] - rect[1]) / Q, uPerM = 1 / mPerU;
  const gx = (u: number) => unitX(rect, u), gy = (v: number) => unitY(rect, v);

  // Seam vertices come only from canonical stops (input crossings of the side, computed from the segment alone) and the
  // global seam grid: a vertex the clip put on a side anywhere else (its own float path, design Risk 5) moves to the
  // nearest of them, so both neighbours hold the same seam whatever polygon-clipping did inside each.
  const gridMm = opt.seamGridM * 1000;
  const sideStops = arr.stops.map((st, side) => { const lo = side < 2 ? Y0 : X0, hi = side < 2 ? Y1 : X1; const v = [...st, lo, hi]; for (let g = Math.ceil(lo / gridMm) * gridMm; g < hi; g += gridMm) v.push(g); return Float64Array.from(new Set(v)).sort(); });
  const nearestStop = (side: number, a: number): number => { const v = sideStops[side]; let lo = 0, hi = v.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (v[m] <= a) lo = m; else hi = m; } return Math.abs(v[lo] - a) <= Math.abs(v[hi] - a) ? v[lo] : v[hi]; };
  let seamSnapped = 0;
  const seamSnap = (x: number, y: number): [number, number] => {
    let s = -1; if (x <= X0) s = 0; else if (x >= X1) s = 1; else if (y <= Y0) s = 2; else if (y >= Y1) s = 3;
    if (s < 0) return [x, y];
    if (s < 2) { const ny = (y <= Y0 || y >= Y1) ? y : nearestStop(s, y); if (ny !== y) seamSnapped++; return [x, ny]; }
    const nx = nearestStop(s, x); if (nx !== x) seamSnapped++; return [nx, y];
  };
  // ---- 3. pieces on the u16 grid; points and edges.
  const P: number[] = []; // flat u, v
  const id = new Map<number, number>();
  const at = (u: number, v: number): number => { const k = u * 65536 + v; let i = id.get(k); if (i === undefined) { i = P.length / 2; id.set(k, i); P.push(u, v); } return i; };
  const pieceRings: { group: number; ring: number[] }[] = []; // vertex ids, open ring
  const pieceM2 = new Array(input.groups.length).fill(0);
  for (const { group, poly } of arr.pieces) for (const p of poly) {
    let a = Math.abs(ringArea2(p[0])) / 2; for (const h of p.slice(1)) a -= Math.abs(ringArea2(h)) / 2;
    pieceM2[group] += a / 1e6;
    for (const r of p) {
      const ids: number[] = [];
      for (const q of r) { const [x, y] = seamSnap(q[0], q[1]); const i = at(uOf(x), vOf(y)); if (ids[ids.length - 1] !== i) ids.push(i); }
      while (ids.length > 1 && ids[0] === ids[ids.length - 1]) ids.pop();
      if (ids.length < 3) continue;
      pieceRings.push({ group, ring: ids });
    }
  }
  const partitionVertices = P.length / 2;
  let E: [number, number][] = [];
  { const seen = new Set<number>(); for (const { ring } of pieceRings) for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (a === b) continue; const k = a < b ? a * 4194304 + b : b * 4194304 + a; if (!seen.has(k)) { seen.add(k); E.push([a, b]); } } }
  const edges0 = E.length;
  // Seam grid: global multiples of seamGridM along each side (both neighbours compute the same integers).
  let seamGridPoints = 0;
  { const g = opt.seamGridM * 1000;
    for (let y = Math.ceil(Y0 / g) * g; y < Y1; y += g) if (y > Y0) { at(0, vOf(y)); at(Q, vOf(y)); seamGridPoints += 2; }
    for (let x = Math.ceil(X0 / g) * g; x < X1; x += g) if (x > X0) { at(uOf(x), 0); at(uOf(x), Q); seamGridPoints += 2; }
    // Every canonical stop is a seam vertex in both neighbours, whether or not this cell's clip put a corner there.
    sideStops.forEach((v, side) => { for (const a of v) { if (side < 2) { if (a > Y0 && a < Y1) at(side === 0 ? 0 : Q, vOf(a)); } else if (a > X0 && a < X1) at(uOf(a), side === 2 ? 0 : Q); } }); }
  const onSide = (i: number): number => { const u = P[2 * i], v = P[2 * i + 1]; return (u === 0 ? 1 : 0) | (u === Q ? 2 : 0) | (v === 0 ? 4 : 0) | (v === Q ? 8 : 0); };

  // ---- 4. noding: split an edge at every vertex within NODE_TOL_U of its interior.
  const B = 64;
  const bucket = (u: number, v: number) => Math.floor(u / B) * 2048 + Math.floor(v / B);
  const noded = (): number => {
    const grid = new Map<number, number[]>();
    for (let i = 0; i < P.length / 2; i++) { const k = bucket(P[2 * i], P[2 * i + 1]); const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]); }
    let splits = 0; const out: [number, number][] = [];
    for (const [a0, b0] of E) {
      const ax = P[2 * a0], ay = P[2 * a0 + 1], bx = P[2 * b0], by = P[2 * b0 + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const on: [number, number][] = [];
      for (let cx = Math.floor((Math.min(ax, bx) - 1) / B); cx <= Math.floor((Math.max(ax, bx) + 1) / B); cx++) for (let cy = Math.floor((Math.min(ay, by) - 1) / B); cy <= Math.floor((Math.max(ay, by) + 1) / B); cy++)
        for (const i of grid.get(cx * 2048 + cy) ?? []) {
          if (i === a0 || i === b0) continue;
          const px = P[2 * i], py = P[2 * i + 1], tt = ((px - ax) * dx + (py - ay) * dy) / L2;
          if (tt <= 0 || tt >= 1) continue;
          const ex = ax + tt * dx - px, ey = ay + tt * dy - py;
          if (ex * ex + ey * ey <= NODE_TOL_U * NODE_TOL_U) on.push([tt, i]);
        }
      if (!on.length) { out.push([a0, b0]); continue; }
      on.sort((p, q) => p[0] - q[0] || p[1] - q[1]); splits += on.length;
      let prev = a0; for (const [, i] of on) { if (i !== prev) out.push([prev, i]); prev = i; } if (prev !== b0) out.push([prev, b0]);
    }
    const seen = new Set<number>(); E = [];
    for (const [a, b] of out) { if (a === b) continue; const k = a < b ? a * 4194304 + b : b * 4194304 + a; if (!seen.has(k)) { seen.add(k); E.push([a, b]); } }
    return splits;
  };
  // Crossings: rounding to the grid can make two edges cross in their interiors (a constraint pair the CDT must
  // refuse). Split both at the crossing's grid point, a few passes (snap rounding converges fast at this scale).
  let crossSplits = 0;
  const crossings = (): number => {
    const grid = new Map<number, number[]>();
    E.forEach(([a, b], ei) => {
      for (let cx = Math.floor(Math.min(P[2 * a], P[2 * b]) / B); cx <= Math.floor(Math.max(P[2 * a], P[2 * b]) / B); cx++) for (let cy = Math.floor(Math.min(P[2 * a + 1], P[2 * b + 1]) / B); cy <= Math.floor(Math.max(P[2 * a + 1], P[2 * b + 1]) / B); cy++) { const k = cx * 2048 + cy; const l = grid.get(k); if (l) l.push(ei); else grid.set(k, [ei]); }
    });
    const cuts = new Map<number, [number, number][]>(); const tested = new Set<number>(); let n = 0;
    const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    for (const l of grid.values()) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const e1 = Math.min(l[i], l[j]), e2 = Math.max(l[i], l[j]), pk = e1 * 4194304 + e2;
      if (tested.has(pk)) continue; tested.add(pk);
      const [a, b] = E[e1], [c, d] = E[e2];
      if (a === c || a === d || b === c || b === d) continue;
      const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * b], by = P[2 * b + 1], cx = P[2 * c], cy = P[2 * c + 1], dx = P[2 * d], dy = P[2 * d + 1];
      const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy), o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
      if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 || o1 === o2 || o3 === o4) continue;
      const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx), t1 = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den, t2 = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
      // Clamped off the sides: a crossing a few mm inside must not round onto a side, where it would be a seam vertex
      // only this cell holds (the seams take only canonical stops and the global grid; first priority bake, -2_0 | -1_0).
      const m = at(Math.min(Q - 1, Math.max(1, Math.round(ax + t1 * (bx - ax)))), Math.min(Q - 1, Math.max(1, Math.round(ay + t1 * (by - ay)))));
      if (m !== a && m !== b) (cuts.get(e1) ?? cuts.set(e1, []).get(e1)!).push([t1, m]);
      if (m !== c && m !== d) (cuts.get(e2) ?? cuts.set(e2, []).get(e2)!).push([t2, m]);
      n++;
    }
    if (!n) return 0;
    const out: [number, number][] = [];
    E.forEach(([a, b], ei) => { const cs = cuts.get(ei); if (!cs) { out.push([a, b]); return; } cs.sort((p, q) => p[0] - q[0] || p[1] - q[1]); let prev = a; for (const [, m] of cs) { if (m !== prev) out.push([prev, m]); prev = m; } if (prev !== b) out.push([prev, b]); });
    const seen = new Set<number>(); E = [];
    for (const [a, b] of out) { if (a === b) continue; const k = a < b ? a * 4194304 + b : b * 4194304 + a; if (!seen.has(k)) { seen.add(k); E.push([a, b]); } }
    return n;
  };
  const nodeAll = (): number => { let s = noded(); for (let pass = 0; pass < 6; pass++) { const c = crossings(); crossSplits += c; if (!c) break; s += noded(); } return s; };
  const nodeSplits = nodeAll();
  lap('node');

  // Relief at a grid point (cached): exactly what the decoder's position samples.
  const zc = new Map<number, number>();
  const hAt = (u: number, v: number): number => { const k = u * 65536 + v; let z = zc.get(k); if (z === undefined) { z = input.height(gx(u), gy(v)); if (z !== z) z = 0; zc.set(k, z); } return z; };

  // ---- LOD 1: simplify every arc between junctions once (both sides of a shared arc keep matching).
  let simplifiedAway = 0;
  if (opt.simplifyM > 0) {
    const adj = new Map<number, number[]>();
    for (const [a, b] of E) { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); }
    const fixed = (i: number) => (adj.get(i)?.length ?? 0) !== 2 || onSide(i) !== 0;
    const done = new Set<number>(); const out: [number, number][] = [];
    const ekey = (a: number, b: number) => (a < b ? a * 4194304 + b : b * 4194304 + a);
    const tolU = opt.simplifyM * uPerM;
    const dp = (pts: number[]): number[] => {
      const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
      const stack: [number, number][] = [[0, pts.length - 1]];
      while (stack.length) {
        const [s, e] = stack.pop()!; const ax = P[2 * pts[s]], ay = P[2 * pts[s] + 1], bx = P[2 * pts[e]], by = P[2 * pts[e] + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
        let best = -1, bi = -1;
        for (let k = s + 1; k < e; k++) { const d = Math.abs((P[2 * pts[k]] - ax) * dy - (P[2 * pts[k] + 1] - ay) * dx) / L; if (d > best) { best = d; bi = k; } }
        if (best > tolU) { keep[bi] = 1; stack.push([s, bi], [bi, e]); }
      }
      return pts.filter((_, k) => keep[k]);
    };
    const walk = (start: number, next: number) => {
      const chain = [start]; let prev = start, cur = next;
      done.add(ekey(start, next));
      while (!fixed(cur) && cur !== start) { chain.push(cur); const ns = adj.get(cur)!; const nx = ns[0] === prev ? ns[1] : ns[0]; done.add(ekey(cur, nx)); prev = cur; cur = nx; }
      chain.push(cur);
      // A closed loop of degree-2 vertices: keep it as a quadrilateral at least (start is fixed by convention).
      const kept = chain.length > 3 ? dp(chain) : chain;
      if (kept.length < chain.length && chain[0] === chain[chain.length - 1] && kept.length < 4) { for (let k = 0; k + 1 < chain.length; k++) out.push([chain[k], chain[k + 1]]); return; }
      simplifiedAway += chain.length - kept.length;
      for (let k = 0; k + 1 < kept.length; k++) if (kept[k] !== kept[k + 1]) out.push([kept[k], kept[k + 1]]);
    };
    const starts = [...adj.keys()].sort((a, b) => a - b);
    for (const s of starts) if (fixed(s)) for (const n of adj.get(s)!) if (!done.has(ekey(s, n))) walk(s, n);
    for (const s of starts) for (const n of adj.get(s)!) if (!done.has(ekey(s, n))) walk(s, n); // loops with no fixed vertex
    E = out;
  }

  // ---- densify: split an edge at its midpoint while the relief there departs from the chord (never along a side).
  let densified = 0;
  { const out: [number, number][] = []; const tolMm = Math.min(opt.tolRoadM, opt.tolFlatM); const minU = opt.edgeMinM * uPerM, maxU = opt.maxEdgeM * uPerM;
    const rec = (a: number, b: number, depth: number) => {
      const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * b], by = P[2 * b + 1], L = Math.hypot(bx - ax, by - ay);
      if (L > 2 * minU && depth < 14) {
        const mx = Math.round((ax + bx) / 2), my = Math.round((ay + by) / 2);
        const e = Math.abs(hAt(mx, my) - (hAt(ax, ay) + hAt(bx, by)) / 2);
        if (e > tolMm || L > maxU) { const m = at(mx, my); densified++; rec(a, m, depth + 1); rec(m, b, depth + 1); return; }
      }
      out.push([a, b]);
    };
    for (const [a, b] of E) { if ((onSide(a) & onSide(b)) !== 0) out.push([a, b]); else rec(a, b, 0); }
    E = out; }
  // The seam grid points split the side edges (and nothing else lies within tolerance of a side).
  const nodeSplits2 = nodeAll();
  lap('densify');

  // ---- edge index for clearance tests.
  const EB = 128;
  const egrid = new Map<number, number[]>();
  const indexEdges = () => {
    egrid.clear();
    E.forEach(([a, b], ei) => {
      const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * b], by = P[2 * b + 1], pad = opt.steinerClearM * uPerM + 1;
      for (let cx = Math.floor((Math.min(ax, bx) - pad) / EB); cx <= Math.floor((Math.max(ax, bx) + pad) / EB); cx++) for (let cy = Math.floor((Math.min(ay, by) - pad) / EB); cy <= Math.floor((Math.max(ay, by) + pad) / EB); cy++) { const k = cx * 2048 + cy; const l = egrid.get(k); if (l) l.push(ei); else egrid.set(k, [ei]); }
    });
  };
  indexEdges();
  const nearEdge = (x: number, y: number, clearU: number): boolean => {
    for (const ei of egrid.get(Math.floor(x / EB) * 2048 + Math.floor(y / EB)) ?? []) {
      const [a, b] = E[ei], ax = P[2 * a], ay = P[2 * a + 1], dx = P[2 * b] - ax, dy = P[2 * b + 1] - ay, L2 = dx * dx + dy * dy || 1;
      const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), ex = ax + tt * dx - x, ey = ay + tt * dy - y;
      if (ex * ex + ey * ey < clearU * clearU) return true;
    }
    return false;
  };

  // ---- point classifier: even-odd per group over the pieces' edges, in horizontal strips.
  const STRIP = 64;
  const strips = new Map<number, number[]>(); // flat: x0, y0, x1, y1, group
  for (const { group, ring } of pieceRings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ay = P[2 * a + 1], by = P[2 * b + 1];
    if (ay === by) continue;
    for (let k = Math.floor(Math.min(ay, by) / STRIP); k <= Math.floor(Math.max(ay, by) / STRIP); k++) { const l = strips.get(k); const rec = [P[2 * a], ay, P[2 * b], by, group]; if (l) l.push(...rec); else strips.set(k, rec); }
  }
  const G = input.groups.length, par = new Uint8Array(G);
  /** The group owning (x, y) in units; -1 none, -2 - g: more than one (g the first). */
  const classAt = (x: number, y: number): number => {
    par.fill(0);
    const l = strips.get(Math.floor(y / STRIP));
    if (l) for (let i = 0; i < l.length; i += 5) { const y0 = l[i + 1], y1 = l[i + 3]; if ((y0 > y) !== (y1 > y) && x < l[i] + (y - y0) * (l[i + 2] - l[i]) / (y1 - y0)) par[l[i + 4]] ^= 1; }
    let found = -1, n = 0;
    for (let g = 0; g < G; g++) if (par[g]) { if (found < 0) found = g; n++; }
    return n > 1 ? -2 - found : found;
  };
  const tolOf = (g: number) => (g >= 0 && input.groups[g].flat ? opt.tolFlatM : opt.tolRoadM);
  lap('index');

  // ---- 5. Steiner points: a relief quadtree rooted on the global 1,024 m grid.
  let steiner = 0, steinerDropped = 0;
  { const clearU = opt.steinerClearM * uPerM;
    const [rx0, ry0, rx1, ry1] = rect;
    const add = (x: number, y: number) => {
      if (x <= rx0 || x >= rx1 || y <= ry0 || y >= ry1) return;
      const u = uOf(Math.round(x * 1000)), v = vOf(Math.round(y * 1000));
      if (u <= 0 || u >= Q || v <= 0 || v >= Q || id.has(u * 65536 + v)) return;
      if (nearEdge(u, v, clearU)) { steinerDropped++; return; }
      at(u, v); steiner++;
    };
    const g = (x: number, y: number) => { const z = input.height(x, y); return z === z ? z : 0; };
    const rec = (x: number, y: number, s: number) => {
      if (x >= rx1 || y >= ry1 || x + s <= rx0 || y + s <= ry0) return;
      if (s > opt.maxSquareM) { const h = s / 2; rec(x, y, h); rec(x + h, y, h); rec(x, y + h, h); rec(x + h, y + h, h); return; }
      const leaf = () => { add(x, y); add(x + s, y); add(x, y + s); add(x + s, y + s); };
      if (s <= opt.minSquareM) { leaf(); return; }
      // The square's tolerance: the road tolerance when any of its corners or centre lies on a road class.
      let tol = opt.tolFlatM;
      if (opt.tolRoadM < opt.tolFlatM) for (const [px, py] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s], [x + s / 2, y + s / 2]]) {
        const c = classAt((Math.max(rx0, Math.min(rx1, px)) - rx0) * uPerM, (Math.max(ry0, Math.min(ry1, py)) - ry0) / mPerV);
        const gi = c < -1 ? -2 - c : c;
        if (gi >= 0 && !input.groups[gi].flat) { tol = opt.tolRoadM; break; }
      }
      const z00 = g(x, y), z10 = g(x + s, y), z01 = g(x, y + s), z11 = g(x + s, y + s);
      const n = Math.max(2, Math.round(s / opt.minSquareM)); let worst = 0;
      for (let i = 0; i <= n && worst <= tol; i++) for (let j = 0; j <= n; j++) {
        const a = i / n, b = j / n, z = g(x + a * s, y + b * s), bl = (1 - a) * (1 - b) * z00 + a * (1 - b) * z10 + (1 - a) * b * z01 + a * b * z11;
        const e = Math.abs(z - bl); if (e > worst) worst = e; if (worst > tol) break;
      }
      if (worst > tol) { const h = s / 2; rec(x, y, h); rec(x + h, y, h); rec(x, y + h, h); rec(x + h, y + h, h); } else leaf();
    };
    const R = 1024;
    for (let x = Math.floor(rx0 / R) * R; x < rx1; x += R) for (let y = Math.floor(ry0 / R) * R; y < ry1; y += R) rec(x, y, R);
  }
  lap('steiner');

  // ---- 6. CDT and refinement.
  const failed = new Set<number>();
  let del!: Delaunator<Float64Array>, con!: Constrainautor, triGroup!: Int32Array;
  let refineAdded = 0;
  const cdt = () => {
    const coords = Float64Array.from(P);
    del = new Delaunator(coords);
    con = new Constrainautor(del);
    failed.clear();
    E.forEach(([a, b], ei) => { try { con.constrainOne(a, b); } catch { failed.add(ei); } });
    const T = del.triangles.length / 3; triGroup = new Int32Array(T);
    for (let k = 0; k < T; k++) { const a = del.triangles[3 * k], b = del.triangles[3 * k + 1], c = del.triangles[3 * k + 2]; triGroup[k] = classAt((P[2 * a] + P[2 * b] + P[2 * c]) / 3, (P[2 * a + 1] + P[2 * b + 1] + P[2 * c + 1]) / 3); }
    // A triangle no piece claims lies in a ring that collapsed on the grid (a sliver under 15 mm): it takes a classified
    // neighbour's group, so the partition has no crack. Counted (`filled`).
    filled = 0; filledM2 = 0;
    for (let pass = 0; pass < 16; pass++) {
      let left = 0;
      for (let k = 0; k < T; k++) {
        if (triGroup[k] !== -1) continue;
        let best = -1;
        for (let j = 0; j < 3; j++) { const o = del.halfedges[3 * k + j]; if (o < 0) continue; const g = triGroup[Math.floor(o / 3)]; if (g !== -1) { best = g; break; } }
        if (best === -1) { left++; continue; }
        triGroup[k] = best; filled++;
      }
      if (!left) break;
    }
  };
  let filled = 0, filledM2 = 0;
  const groupOf = (k: number) => { const c = triGroup[k]; return c < -1 ? -2 - c : c; };
  const isHole = (g: number) => g >= 0 && input.groups[g].layer === null;
  // Slivers (aspect > SLIVER_ASPECT, area > SLIVER_M2: the audit's definition, with a margin): the longest edge is split
  // at its midpoint, a constraint edge by splitting the constraint (never a seam edge: the seams come from the grid).
  const sliverArea = SLIVER_M2 * 0.8 / (mPerU * mPerV);
  let sliverSplits = 0, slivers = 0;
  for (let round = 0; ; round++) {
    cdt();
    if (round >= opt.refineRounds + opt.sliverRounds) break;
    const relief = round < opt.refineRounds;
    const adds: number[] = [];
    const T3 = del.triangles;
    const ekey = (a: number, b: number) => (a < b ? a * 4194304 + b : b * 4194304 + a);
    const eIndex = new Map<number, number>(); E.forEach(([a, b], ei) => eIndex.set(ekey(a, b), ei));
    const split = new Set<number>(); slivers = 0;
    for (let k = 0; k < T3.length / 3; k++) {
      const g = groupOf(k); if (g < 0 || isHole(g)) continue;
      const a = T3[3 * k], b = T3[3 * k + 1], c = T3[3 * k + 2];
      if (opt.sliverRounds > 0) { // sliver?
        const ab = (P[2 * b] - P[2 * a]) ** 2 + (P[2 * b + 1] - P[2 * a + 1]) ** 2, bc = (P[2 * c] - P[2 * b]) ** 2 + (P[2 * c + 1] - P[2 * b + 1]) ** 2, ca = (P[2 * a] - P[2 * c]) ** 2 + (P[2 * a + 1] - P[2 * c + 1]) ** 2;
        const area2 = Math.abs((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * c] - P[2 * a]) * (P[2 * b + 1] - P[2 * a + 1]));
        const L2 = Math.max(ab, bc, ca);
        if (area2 / 2 > sliverArea && L2 / area2 > SLIVER_ASPECT * 0.85) {
          slivers++;
          const [p, q] = L2 === ab ? [a, b] : L2 === bc ? [b, c] : [c, a];
          const k2 = ekey(p, q);
          if (!split.has(k2) && (onSide(p) & onSide(q)) === 0) {
            split.add(k2);
            const mx = Math.round((P[2 * p] + P[2 * q]) / 2), my = Math.round((P[2 * p + 1] + P[2 * q + 1]) / 2);
            if (!id.has(mx * 65536 + my)) {
              const ei = eIndex.get(k2);
              if (ei !== undefined) { const m = at(mx, my); E[ei] = [p, m]; E.push([m, q]); sliverSplits++; }
              else if (!nearEdge(mx, my, 0.02 * uPerM)) { adds.push(mx, my); sliverSplits++; }
              else {
                // The midpoint encroaches on a constraint (a sliver along a boundary, h of a few cm): split the
                // sliver's own longest constraint edge instead (Ruppert), never a seam edge.
                let best = -1, bestL = 0, bp = 0, bq = 0;
                for (const [x1, x2] of [[a, b], [b, c], [c, a]]) {
                  const e2 = eIndex.get(ekey(x1, x2)); if (e2 === undefined || (onSide(x1) & onSide(x2)) !== 0 || split.has(ekey(x1, x2))) continue;
                  const l2 = (P[2 * x2] - P[2 * x1]) ** 2 + (P[2 * x2 + 1] - P[2 * x1 + 1]) ** 2; if (l2 > bestL) { best = e2; bestL = l2; bp = x1; bq = x2; }
                }
                if (best >= 0 && bestL > 4) {
                  const nx = Math.round((P[2 * bp] + P[2 * bq]) / 2), ny = Math.round((P[2 * bp + 1] + P[2 * bq + 1]) / 2);
                  if (!id.has(nx * 65536 + ny)) { split.add(ekey(bp, bq)); const m = at(nx, ny); const [e0, e1] = E[best]; E[best] = [e0, m]; E.push([m, e1]); sliverSplits++; }
                }
              }
            }
          }
        }
      }
      if (!relief) continue;
      const za = hAt(P[2 * a], P[2 * a + 1]), zb = hAt(P[2 * b], P[2 * b + 1]), zc = hAt(P[2 * c], P[2 * c + 1]);
      let cu = (P[2 * a] + P[2 * b] + P[2 * c]) / 3, cv = (P[2 * a + 1] + P[2 * b + 1] + P[2 * c + 1]) / 3;
      let e = Math.abs(input.height(gx(cu), gy(cv)) - (za + zb + zc) / 3);
      if (opt.refineLatticeM > 0) {
        // The worst point of a barycentric lattice (interior points only: the vertices are exact, an edge point is
        // shared with the neighbour, which samples it too).
        const L = Math.max(Math.hypot(P[2 * b] - P[2 * a], P[2 * b + 1] - P[2 * a + 1]), Math.hypot(P[2 * c] - P[2 * b], P[2 * c + 1] - P[2 * b + 1]), Math.hypot(P[2 * a] - P[2 * c], P[2 * a + 1] - P[2 * c + 1])) * mPerU;
        const n = Math.min(16, Math.ceil(L / opt.refineLatticeM));
        for (let i = 1; i < n; i++) for (let j = 1; i + j < n; j++) {
          const wa = i / n, wb = j / n, wc = 1 - wa - wb;
          const pu = wa * P[2 * a] + wb * P[2 * b] + wc * P[2 * c], pv = wa * P[2 * a + 1] + wb * P[2 * b + 1] + wc * P[2 * c + 1];
          const ei = Math.abs(input.height(gx(pu), gy(pv)) - (wa * za + wb * zb + wc * zc));
          if (ei > e) { e = ei; cu = pu; cv = pv; }
        }
      }
      const ru = Math.round(cu), rv = Math.round(cv);
      if (!(e > tolOf(g))) continue;
      if (ru <= 0 || ru >= Q || rv <= 0 || rv >= Q || id.has(ru * 65536 + rv) || nearEdge(ru, rv, 0.1 * uPerM)) continue;
      adds.push(ru, rv);
    }
    if (!adds.length && !split.size) break;
    for (let i = 0; i < adds.length; i += 2) at(adds[i], adds[i + 1]);
    if (relief) refineAdded += adds.length / 2;
    if (split.size) indexEdges();
  }
  lap('cdt');

  // ---- 7. classify, drop holes, measure.
  const T3 = del.triangles, T = T3.length / 3;
  // A triangle on a seam edge takes the class the sources give at the edge's midpoint (seamClassifier): a feature
  // ending a few mm or cm past the seam leaves a one-quantum sliver whose triangles can classify as the class (or the
  // water hole) beside it in one neighbour only, so the two cells disagreed on the seam's vertices and levels.
  const seamGroupAt = seamClassifier(input);
  let seamReclassed = 0;
  for (let k = 0; k < T; k++) for (let j = 0; j < 3; j++) {
    const a = T3[3 * k + j], b = T3[3 * k + (j + 1) % 3];
    if ((onSide(a) & onSide(b)) === 0) continue;
    const sg = seamGroupAt(gx((P[2 * a] + P[2 * b]) / 2), gy((P[2 * a + 1] + P[2 * b + 1]) / 2));
    const cur = triGroup[k] < -1 ? -2 - triGroup[k] : triGroup[k];
    if (sg >= 0 && cur !== sg) { triGroup[k] = sg; seamReclassed++; }
    break;
  }
  let unclassified = 0, ambiguous = 0, unclassifiedM2 = 0;
  const triM2 = new Array(G).fill(0);
  const keep: number[] = [];
  const errs: number[] = []; let over5 = 0; const worst: { x: number; y: number; errMm: number }[] = [];
  const area = (a: number, b: number, c: number) => Math.abs((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * c] - P[2 * a]) * (P[2 * b + 1] - P[2 * a + 1])) / 2 * mPerU * mPerV;
  for (let k = 0; k < T; k++) {
    const a = T3[3 * k], b = T3[3 * k + 1], c = T3[3 * k + 2];
    const ar = area(a, b, c), cl = triGroup[k];
    if (cl === -1) { unclassified++; unclassifiedM2 += ar; continue; }
    if (cl < -1) ambiguous++;
    const g = groupOf(k);
    triM2[g] += ar;
    if (isHole(g)) continue;
    keep.push(k);
    const cu = (P[2 * a] + P[2 * b] + P[2 * c]) / 3, cv = (P[2 * a + 1] + P[2 * b + 1] + P[2 * c + 1]) / 3;
    const e = Math.abs(input.height(gx(cu), gy(cv)) - (hAt(P[2 * a], P[2 * a + 1]) + hAt(P[2 * b], P[2 * b + 1]) + hAt(P[2 * c], P[2 * c + 1])) / 3);
    if (e === e) { errs.push(e * 1000); if (e > 0.05) { over5 += ar; if (e > 0.5) worst.push({ x: gx(cu), y: gy(cv), errMm: Math.round(e * 1000) }); } }
  }
  errs.sort((p, q) => p - q);
  const pct = (f: number) => (errs.length ? Math.round(errs[Math.min(errs.length - 1, Math.floor(errs.length * f))]) : 0);
  worst.sort((p, q) => q.errMm - p.errMm);

  // ---- 8. levels, steps, heights, normals.
  const nV0 = P.length / 2;
  const levelOfTri = (k: number) => (opt.steps ? input.groups[groupOf(k)].level : 0);
  // Copies: vertex × level → new id, in order of first use by the kept triangles (deterministic).
  const copy = new Map<number, number>(); const outU: number[] = [], outV: number[] = [], outL: number[] = [];
  // A seam vertex keeps only the levels of the seam edges beside it (the class along the side is the same in both
  // neighbours); a triangle touching it at a corner from another level takes the nearest of those, so both cells hold
  // the same copies there.
  // The seam edge's level is read from the sources at the edge's midpoint (seamGroupAt), not from the triangle beside
  // it: a feature ending a few cm past the seam leaves a one-quantum sliver in the neighbour whose triangles can classify
  // as the class under it, which put the two cells' seam vertices on different levels (110 mm apart; 34 of 76 pairs
  // of the first priority bake). The midpoint lies on no input boundary (every crossing of a side is a stop).
  const seamLevels = new Map<number, number>(); // vertex → bitmask of levels
  // Triangle k's seam edge j (vertices j, j + 1) → its canonical level: the triangle puts those two vertices there.
  const seamEdgeLevel = new Map<number, number>();
  if (opt.steps) for (const k of keep) for (let j = 0; j < 3; j++) {
    const a = T3[3 * k + j], b = T3[3 * k + (j + 1) % 3];
    if ((onSide(a) & onSide(b)) === 0) continue;
    const sg = seamGroupAt(gx((P[2 * a] + P[2 * b]) / 2), gy((P[2 * a + 1] + P[2 * b + 1]) / 2));
    const L = sg >= 0 && !isHole(sg) ? input.groups[sg].level : levelOfTri(k);
    seamEdgeLevel.set(3 * k + j, L);
    const bit = 1 << L;
    seamLevels.set(a, (seamLevels.get(a) ?? 0) | bit); seamLevels.set(b, (seamLevels.get(b) ?? 0) | bit);
  }
  const vid = (i: number, lev0: number) => {
    let lev = lev0;
    const m = seamLevels.get(i);
    if (m !== undefined && !(m & (1 << lev))) { let best = -1; for (let l = 0; l < 8; l++) if (m & (1 << l) && (best < 0 || Math.abs(l - lev0) < Math.abs(best - lev0))) best = l; lev = best; }
    const k = i * 8 + lev; let n = copy.get(k); if (n === undefined) { n = outU.length; copy.set(k, n); outU.push(P[2 * i]); outV.push(P[2 * i + 1]); outL.push(lev); } return n; };
  const tris = new Uint32Array(keep.length * 3), triG = new Uint16Array(keep.length);
  const keptAt = new Int32Array(T).fill(-1);
  keep.forEach((k, n) => {
    keptAt[k] = n; const lev = levelOfTri(k);
    for (let j = 0; j < 3; j++) {
      // A vertex of a seam edge sits at that edge's level (the edge leaving it first, then the one arriving).
      const L = seamEdgeLevel.get(3 * k + j) ?? seamEdgeLevel.get(3 * k + (j + 2) % 3) ?? lev;
      tris[3 * n + j] = vid(T3[3 * k + j], L);
    }
    triG[n] = groupOf(k);
  });
  // Strips: for each interior edge whose two kept triangles sit at different levels, a quad from the low copies up to the high.
  const stepIdx: number[] = []; const stepLayer: GroundLayer[] = [];
  if (opt.steps) {
    const he = del.halfedges;
    for (let e = 0; e < he.length; e++) {
      const o = he[e]; if (o < 0 || o < e) continue;
      const k1 = Math.floor(e / 3), k2 = Math.floor(o / 3); if (keptAt[k1] < 0 || keptAt[k2] < 0) continue;
      const l1 = levelOfTri(k1), l2 = levelOfTri(k2); if (l1 === l2) continue;
      // Halfedge e runs a → b with triangle k1 on its left (delaunator triangles are counter-clockwise).
      const a = T3[e], b = T3[e % 3 === 2 ? e - 2 : e + 1];
      const [hiK, loK, hiL, loL] = l1 > l2 ? [k1, k2, l1, l2] : [k2, k1, l2, l1];
      const a0 = vid(a, loL), b0 = vid(b, loL), a1 = vid(a, hiL), b1 = vid(b, hiL);
      if (a0 === a1 && b0 === b1) continue;
      // Face the low side: k2 (right of a→b) low → the face's front looks right of a→b.
      const hiLayer = input.groups[groupOf(hiK)].layer!, loLayer = input.groups[groupOf(loK)].layer!;
      const layer: GroundLayer = hiLayer === 'kerb' || loLayer === 'kerb' ? 'kerb' : hiLayer;
      // The face looks at the low side: its normal points from the edge toward the low triangle's centroid.
      const lc = [0, 1, 2].map(j => T3[3 * loK + j]);
      const dx = (P[2 * lc[0]] + P[2 * lc[1]] + P[2 * lc[2]]) / 3 - (P[2 * a] + P[2 * b]) / 2, dy = (P[2 * lc[0] + 1] + P[2 * lc[1] + 1] + P[2 * lc[2] + 1]) / 3 - (P[2 * a + 1] + P[2 * b + 1]) / 2;
      const ex = P[2 * b] - P[2 * a], ey = P[2 * b + 1] - P[2 * a + 1];
      // For the quad a0 → b0 → b1 (up), the face normal's xy is (ey, −ex) × sign: (b − a) × up.
      const front = ey * dx - ex * dy > 0;
      const tri = (p: number, q: number, r: number) => { if (p === q || q === r || r === p) return; if (front) stepIdx.push(p, q, r); else stepIdx.push(p, r, q); stepLayer.push(layer); };
      tri(a0, b0, b1); tri(a0, b1, a1);
    }
  }
  const V = outU.length, zMm = new Int32Array(V), oct = new Int8Array(2 * V);
  const D = 1; // metres: the gradient's central difference
  for (let i = 0; i < V; i++) {
    const x = gx(outU[i]), y = gy(outV[i]);
    zMm[i] = Math.round((hAt(outU[i], outV[i]) + input.levelZ[outL[i]]) * 1000);
    let dzx = (input.height(x + D, y) - input.height(x - D, y)) / (2 * D), dzy = (input.height(x, y + D) - input.height(x, y - D)) / (2 * D);
    if (dzx !== dzx) dzx = 0; if (dzy !== dzy) dzy = 0;
    const l = Math.hypot(dzx, dzy, 1); const [p, q] = octEncode(-dzx / l, -dzy / l, 1 / l); oct[2 * i] = p; oct[2 * i + 1] = q;
  }
  lap('levels');
  const rectM2 = (rect[2] - rect[0]) * (rect[3] - rect[1]);
  const failedEdges = [...failed].sort((p, q) => p - q).map(ei => ({ a: [gx(P[2 * E[ei][0]]), gy(P[2 * E[ei][0] + 1])] as [number, number], b: [gx(P[2 * E[ei][1]]), gy(P[2 * E[ei][1] + 1])] as [number, number] }));
  return {
    key: input.key, rect,
    u: Uint16Array.from(outU), v: Uint16Array.from(outV), zMm, oct, level: Uint8Array.from(outL),
    tris, triGroup: triG, steps: Uint32Array.from(stepIdx), stepLayer,
    stats: {
      ms, pieces: arr.pieces.length, partitionVertices, seamSnapped, seamReclassed, edges: E.length, nodeSplits: nodeSplits + nodeSplits2, crossSplits, seamGridPoints, densified, simplifiedAway,
      steiner, steinerDropped, refineAdded, sliverSplits, slivers, points: nV0, triangles: keep.length, stepTriangles: stepIdx.length / 3, vertices: V,
      failedEdges, unclassified, filled, ambiguous, unclassifiedM2: +unclassifiedM2.toFixed(2),
      pieceM2: pieceM2.map(a => +a.toFixed(2)), triM2: triM2.map(a => +a.toFixed(2)), rectM2: +rectM2.toFixed(2),
      closureM2: +(triM2.reduce((s, a) => s + a, 0) + unclassifiedM2 - rectM2).toFixed(2),
      errP50: pct(0.5), errP99: pct(0.99), errP999: pct(0.999), errMax: pct(1), over5cmM2: Math.round(over5), worst: worst.slice(0, 20),
      clipErrors: arr.errors,
    },
  };
}
