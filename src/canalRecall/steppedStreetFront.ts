/**
 * Stepped street fronts (2026-11-21, belt review: Herengracht 62 drew 3.43 m of its 5.33 m front, 6 drew 2.75 m of 4.5 m).
 *
 * BAG often draws one street front as near-collinear pieces joined by small jogs: a stoop or cellar-entrance block in the
 * footprint (Herengracht 62 and 60 each carry a 1.75 m x 1.17 m block where their stoops meet), or a sub-metre plot seam
 * (Herengracht 6, 0.18 m). The mesher splits wall runs at every turn of 25 deg or more (threeBuildingMesh wallRuns), and
 * only a run with a wall of at least 2.4 m facing the street is a street run (doorWalls): the longest piece took the
 * facade, its dressing and its bay grid; a stub beside it drew as a side wall, full height, standing proud of or behind
 * the front (a blank tower or a hole beside the neighbour).
 *
 * Here such a front is absorbed into one straight front on its main line (the longest piece's): the chain's vertices are
 * replaced by the main line's meets with the walls either side, so the whole footprint (walls, lid, roof plan) sees one
 * front the width of the street span. Only a chain with a stub (a piece under STEP_STUB_M, which cannot carry a facade of
 * its own) changes: a pand of several old plots, each piece a whole front, keeps its pieces (bentFrontFacets.ts
 * mergeSteppedRuns lost that blind on Rozengracht); a front over STEP_WIDE_FRONT_M keeps steps deeper than
 * STEP_WIDE_DEPTH_M (risalits). The stoop the block stood for is the stoop kit's to draw.
 *
 * Pure: metres, rings counter-clockwise (the solid on the left of travel, outward normal on the right). A footprint with
 * no such front is returned unchanged (the same array), so every other building is byte-identical.
 */

import { SegmentGrid, streetDistance } from './streetFronts.js';

export type XY = readonly [number, number];

/** A jog deeper than this (the offset of a piece from the main line) is a real setback or risalit, not a step. */
export const STEP_DEPTH_MAX_M = 1.5;
/** Pieces of one front are parallel to the main piece within this. */
export const STEP_TURN_MAX_DEG = 20;
/** A jog edge longer than this is a wall of its own. */
export const STEP_JOG_MAX_M = 2;
/** At most this many consecutive jog edges between two pieces (a step, or a step with a cant). */
export const STEP_JOGS_MAX = 2;
/** A piece under this carries no facade of its own (threeBuildingMesh doorWalls: a street wall is at least 2.4 m). */
export const STEP_STUB_M = 2.4;
/** The main piece is at least this long (a front, not a cant). */
export const STEP_MAIN_MIN_M = 2;
/**
 * A front wider than this (a double canal house and more: a warehouse, a school, a bank) is absorbed only when its
 * steps are shallower than STEP_WIDE_DEPTH_M (plot seams, pilaster strips): a deeper step there is a risalit or a wing.
 */
export const STEP_WIDE_FRONT_M = 12;
export const STEP_WIDE_DEPTH_M = 0.6;

/** Whether a stepped front is absorbed: it has a stub, and a wide front only shallow steps. */
export const absorbable = (s: Pick<SteppedFront, 'stub' | 'lengthM' | 'depthM'>) => s.stub && (s.lengthM <= STEP_WIDE_FRONT_M || s.depthM <= STEP_WIDE_DEPTH_M);

export interface SteppedFront {
  /** First and last ring edge of the chain (edge i runs pts[i] -> pts[i + 1], wrapping). */
  first: number;
  last: number;
  /** The longest piece: its line is the front line. */
  main: number;
  /** The pieces (along the front) and the jogs between them, edge indices in ring order. */
  pieces: number[];
  jogs: number[];
  /** Main piece length; the chain's extent along the main line; the largest offset of a piece from it (m). */
  mainM: number;
  lengthM: number;
  depthM: number;
  /** Whether a piece under STEP_STUB_M is in the chain (only then is it absorbed). */
  stub: boolean;
}

type Edge = { x0: number; y0: number; x1: number; y1: number; len: number; ux: number; uy: number };

function edgesOf(pts: readonly XY[]): Edge[] {
  const n = pts.length;
  return pts.map((a, i) => {
    const b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], len, ux: len > 0 ? dx / len : 0, uy: len > 0 ? dy / len : 0 };
  });
}

/** Twice the signed area (positive: counter-clockwise). */
export function ringArea2(pts: readonly XY[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return a;
}

/**
 * The stepped fronts of a counter-clockwise ring: chains of pieces parallel to a main piece (within STEP_TURN_MAX_DEG,
 * within STEP_DEPTH_MAX_M of its line) joined by short jogs, whose main piece `faces` a street. Chains do not overlap;
 * the longest main pieces are taken first.
 */
export function steppedFronts(pts: readonly XY[], faces: (edge: number) => boolean): SteppedFront[] {
  const n = pts.length;
  if (n < 5) return [];
  const es = edgesOf(pts), cosTurn = Math.cos(STEP_TURN_MAX_DEG * Math.PI / 180), used = new Set<number>(), out: SteppedFront[] = [];
  const order = es.map((_, i) => i).filter(i => es[i].len >= STEP_MAIN_MIN_M).sort((a, b) => es[b].len - es[a].len || a - b);
  for (const m of order) {
    if (used.has(m)) continue;
    const M = es[m], nx = M.uy, ny = -M.ux;
    const off = (x: number, y: number) => (x - M.x0) * nx + (y - M.y0) * ny;
    const along = (e: Edge) => e.len > 1e-6 && e.ux * M.ux + e.uy * M.uy >= cosTurn
      && Math.abs(off(e.x0, e.y0)) <= STEP_DEPTH_MAX_M && Math.abs(off(e.x1, e.y1)) <= STEP_DEPTH_MAX_M;
    const jog = (e: Edge) => e.len <= STEP_JOG_MAX_M && e.ux * M.ux + e.uy * M.uy < cosTurn
      && Math.abs(off(e.x0, e.y0)) <= STEP_DEPTH_MAX_M && Math.abs(off(e.x1, e.y1)) <= STEP_DEPTH_MAX_M;
    // Walk one way from the main piece, committing jogs only when a piece follows them.
    const walk = (step: 1 | -1) => {
      const pieces: number[] = [], jogs: number[] = [];
      let pending: number[] = [];
      for (let k = 1; k < n - 2; k++) {
        const j = ((m + step * k) % n + n) % n;
        if (used.has(j)) break;
        const e = es[j];
        if (along(e)) { pieces.push(j); jogs.push(...pending); pending = []; continue; }
        if (jog(e) && pending.length < STEP_JOGS_MAX) { pending.push(j); continue; }
        break;
      }
      return { pieces, jogs };
    };
    const fwd = walk(1), back = walk(-1);
    const chain = new Set([m, ...fwd.pieces, ...fwd.jogs, ...back.pieces, ...back.jogs]);
    // The chain must leave at least two walls of the ring (the sides), and turn somewhere (a jog).
    if (chain.size > n - 2 || !(fwd.jogs.length + back.jogs.length)) continue;
    if (!faces(m)) continue;
    const pieces = [m, ...fwd.pieces, ...back.pieces], jogs = [...fwd.jogs, ...back.jogs];
    const ringOrder = (a: number) => ((a - m) % n + n) % n;
    const lo = back.pieces.length ? back.pieces[back.pieces.length - 1] : m, hi = fwd.pieces.length ? fwd.pieces[fwd.pieces.length - 1] : m;
    // Chain edges in ring order: from `lo` to `hi`.
    const sorted = (xs: number[]) => [...xs].sort((a, b) => ((ringOrder(a) + n / 2) % n) - ((ringOrder(b) + n / 2) % n));
    const ts = pieces.flatMap(i => [es[i].x0, es[i].x1].map((x, k) => (x - M.x0) * M.ux + ((k ? es[i].y1 : es[i].y0) - M.y0) * M.uy));
    const depth = Math.max(...pieces.map(i => Math.max(Math.abs(off(es[i].x0, es[i].y0)), Math.abs(off(es[i].x1, es[i].y1)))));
    for (const i of chain) used.add(i);
    out.push({ first: lo, last: hi, main: m, pieces: sorted(pieces), jogs: sorted(jogs), mainM: M.len, lengthM: Math.max(...ts) - Math.min(...ts), depthM: depth, stub: pieces.some(i => es[i].len < STEP_STUB_M) });
  }
  return out;
}

function meet(px: number, py: number, ux: number, uy: number, e: Edge): XY | null {
  // Line p + t u against the line through e.
  const cross = ux * e.uy - uy * e.ux;
  if (Math.abs(cross) < 0.2) return null;
  const t = ((e.x0 - px) * e.uy - (e.y0 - py) * e.ux) / cross;
  return [px + ux * t, py + uy * t];
}

function segmentsCross(a: XY, b: XY, c: XY, d: XY): boolean {
  const o = (p: XY, q: XY, r: XY) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Whether a ring's edges cross (non-adjacent edges only). */
export function selfCrossing(pts: readonly XY[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
  }
  return false;
}

/**
 * The ring with the chain replaced by one edge on the main piece's line, from its meet with the wall before the chain
 * to its meet with the wall after it (a wall nearly parallel to the front: the chain's end projected on the line).
 * Null when the result would not be a clean ring (crossing edges, a moved corner further than the step allows).
 */
export function absorbSteppedFront(pts: readonly XY[], s: SteppedFront): XY[] | null {
  const n = pts.length, es = edgesOf(pts), M = es[s.main];
  const project = (p: XY): XY => { const t = (p[0] - M.x0) * M.ux + (p[1] - M.y0) * M.uy; return [M.x0 + M.ux * t, M.y0 + M.uy * t]; };
  const reach = STEP_DEPTH_MAX_M / Math.sin(STEP_TURN_MAX_DEG * Math.PI / 180) + 0.5;
  /** The main line's meet with wall `e`, as a point and its distance along e from e's start (m). */
  const meetOn = (e: Edge) => { const q = meet(M.x0, M.y0, M.ux, M.uy, e); return q ? { q, s: (q[0] - e.x0) * e.ux + (q[1] - e.y0) * e.uy } : null; };
  // A wall either side that the main line meets beyond its far end is the step's own side (a block at the corner whose
  // flank is the first wall after the chain): it goes with the chain, and the line meets the wall beyond it.
  let first = s.first, last = s.last;
  for (let k = 0; k < STEP_JOGS_MAX; k++) {
    const e = es[(first - 1 + n) % n], m = meetOn(e);
    if (!m || m.s > 0.05 || e.len > STEP_JOG_MAX_M) break;
    first = (first - 1 + n) % n;
  }
  for (let k = 0; k < STEP_JOGS_MAX; k++) {
    const e = es[(last + 1) % n], m = meetOn(e);
    if (!m || m.s < e.len - 0.05 || e.len > STEP_JOG_MAX_M) break;
    last = (last + 1) % n;
  }
  const span = ((last - first) % n + n) % n + 1;
  if (span > n - 2) return null;
  const at = (e: Edge, p: XY) => { const m = meetOn(e); return m && Math.hypot(m.q[0] - p[0], m.q[1] - p[1]) <= reach ? m.q : project(p); };
  const P = at(es[(first - 1 + n) % n], pts[first]), Q = at(es[(last + 1) % n], pts[(last + 1) % n]);
  const out: XY[] = [Q];
  for (let k = (last + 2) % n; k !== first; k = (k + 1) % n) out.push(pts[k]);
  out.push(P);
  if (out.length < 3 || Math.hypot(Q[0] - P[0], Q[1] - P[1]) < STEP_MAIN_MIN_M) return null;
  const a0 = ringArea2(pts), a1 = ringArea2(out);
  if (!(a1 > 0) || Math.abs(a1 - a0) / 2 > s.lengthM * STEP_DEPTH_MAX_M + 0.5 || selfCrossing(out)) return null;
  return out;
}

/**
 * Every absorbable stepped front absorbed (absorbable), one at a time, each found again on the ring the earlier ones
 * left; a chain whose absorbed ring would not be clean is left as it is. Unchanged: the same array.
 */
export function absorbSteppedFronts(pts: readonly XY[], faces: (edge: Edge0) => boolean): readonly XY[] {
  let ring = pts;
  for (let guard = 0; guard < 8; guard++) {
    const es = edgesOf(ring);
    let next: XY[] | null = null;
    for (const s of steppedFronts(ring, i => faces(edge0(es[i]))).filter(absorbable)) if ((next = absorbSteppedFront(ring, s))) break;
    if (!next) break;
    ring = next;
  }
  return ring;
}

/** An edge as the street test sees it: ends, length and outward normal (right of travel on a counter-clockwise ring). */
export type Edge0 = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number };
export function edge0(e: { x0: number; y0: number; x1: number; y1: number; len: number; ux: number; uy: number }): Edge0 {
  return { x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, len: e.len, nx: e.uy, ny: -e.ux };
}

// ---------------------------------------------------------------------------------------------------------------
// Features (lng/lat): the chunk builder's entry (threeBuildingFeatures buildFeatureChunk)
// ---------------------------------------------------------------------------------------------------------------

type Geometry = { type?: string; coordinates?: unknown };
type FeatureLike = { geometry: unknown; properties: Record<string, unknown> };
const M_PER_DEG_LAT = 110_540;
const kxAt = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/**
 * Stepped street fronts on: default; `?frontSteps=0` (page or chunk worker URL) or FRONT_STEPS=0 (node) turns it off.
 */
let stepsNow: boolean | undefined;
export function frontStepsOn(): boolean {
  if (stepsNow !== undefined) return stepsNow;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('frontSteps');
    stepsNow = q !== null ? q !== '0' : g.process?.env?.FRONT_STEPS !== '0';
  } catch { stepsNow = true; }
  return stepsNow;
}
/** Tests and harnesses: forget the cached flag. */
export const resetFrontSteps = () => { stepsNow = undefined; };

/** A street test over metres from `origin`: whether a wall (outward normal on its right) sees a street before a building. */
export type FacesStreet = (owner: number, e: Edge0) => boolean;

/**
 * The street test the mesher uses for door walls (streetFronts.ts streetDistance against the streets and every
 * building's walls), over these features' outer rings in metres from `origin`.
 */
export function featureStreetTest(features: readonly FeatureLike[], streets: Float32Array, origin: { lng: number; lat: number }): FacesStreet {
  // Built on the first question: most chunks have no stepped front to ask about.
  let grids: { streetGrid: SegmentGrid; wallGrid: SegmentGrid } | null = null;
  return (owner, e) => {
    if (!grids) {
      const kx = kxAt(origin.lat), segs: number[] = [], owners: number[] = [];
      features.forEach((f, i) => {
        for (const ring of outerRings(f.geometry as Geometry)) for (let k = 0; k + 1 < ring.length; k++) {
          segs.push((ring[k][0] - origin.lng) * kx, (ring[k][1] - origin.lat) * M_PER_DEG_LAT, (ring[k + 1][0] - origin.lng) * kx, (ring[k + 1][1] - origin.lat) * M_PER_DEG_LAT);
          owners.push(i);
        }
      });
      grids = { streetGrid: new SegmentGrid(streets), wallGrid: new SegmentGrid(segs, 25, owners) };
    }
    return streetDistance(e, grids.streetGrid, grids.wallGrid, owner) < Infinity;
  };
}

function outerRings(g: Geometry): number[][][] {
  if (g?.type === 'Polygon') return [(g.coordinates as number[][][])[0] ?? []];
  if (g?.type === 'MultiPolygon') return (g.coordinates as number[][][][]).map(p => p[0] ?? []);
  return [];
}

/** One outer ring (GeoJSON, closed or open) with its stepped street fronts absorbed; the same array when unchanged. */
export function absorbRingSteps(ring: number[][], origin: { lng: number; lat: number }, faces: (e: Edge0) => boolean): number[][] {
  const kx = kxAt(origin.lat);
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring.slice();
  if (open.length < 5) return ring;
  let pts: XY[] = open.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT] as const);
  const src = new Map<XY, number[]>(pts.map((p, i) => [p, open[i]]));
  if (ringArea2(pts) < 0) pts = [...pts].reverse();
  const next = absorbSteppedFronts(pts, faces);
  if (next === pts) return ring;
  const out = next.map(p => src.get(p) ?? [origin.lng + p[0] / kx, origin.lat + p[1] / M_PER_DEG_LAT]);
  return closed ? [...out, out[0]] : out;
}

/**
 * The features with their stepped street fronts absorbed (outer rings; holes kept). A feature with none is the same
 * object; `skip` keeps a feature as it is (a surveyed envelope bound to the footprint's fingerprint).
 */
export function absorbFeatureSteps<F extends FeatureLike>(features: readonly F[], faces: FacesStreet, origin: { lng: number; lat: number }, skip: (f: F) => boolean = () => false): F[] {
  return features.map((f, i) => {
    if (skip(f)) return f;
    const g = f.geometry as Geometry;
    if (g?.type === 'Polygon') {
      const rings = g.coordinates as number[][][], outer = rings[0];
      if (!outer) return f;
      const r = absorbRingSteps(outer, origin, e => faces(i, e));
      return r === outer ? f : { ...f, geometry: { ...g, coordinates: [r, ...rings.slice(1)] } };
    }
    if (g?.type === 'MultiPolygon') {
      const polys = g.coordinates as number[][][][];
      let changed = false;
      const out = polys.map(p => { const r = p[0] ? absorbRingSteps(p[0], origin, e => faces(i, e)) : p[0]; if (r !== p[0]) changed = true; return r === p[0] ? p : [r, ...p.slice(1)]; });
      return changed ? { ...f, geometry: { ...g, coordinates: out } } : f;
    }
    return f;
  });
}

/**
 * The chunk builder's features and context with their stepped street fronts absorbed (frontStepsOn); the same arrays when
 * nothing changes, and as given without streets (no street side to tell).
 */
export function withFrontSteps<F extends FeatureLike>(features: readonly F[], context: readonly F[], streets: Float32Array | undefined, origin: { lng: number; lat: number }, skip: (f: F) => boolean = () => false): { features: readonly F[]; context: readonly F[] } {
  if (!streets?.length || !frontStepsOn()) return { features, context };
  const all = [...features, ...context], faces = featureStreetTest(all, streets, origin);
  const done = absorbFeatureSteps(all, faces, origin, skip);
  if (done.every((f, i) => f === all[i])) return { features, context };
  return { features: done.slice(0, features.length), context: done.slice(features.length) };
}
