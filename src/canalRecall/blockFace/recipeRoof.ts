/**
 * Recipe roofs for block faces: the roof mass is generated from the house design and the plot depth instead of
 * extruding 3DBAG LoD2.2 roof parts. 3DBAG keeps two jobs only: the footprint (survey rings, unchanged) and an upper
 * bound / sanity check (ridge cap, where the main body ends, flat rear wings).
 *
 * Why: LoD2.2 reconstructs whatever the point cloud saw over the whole plot. On a street face that is ridges, stair
 * housings and rear volumes standing up to ~5 m over the eaves, which the street strip never shows. The user compared
 * bilder-081118-155417 with its strip ("we need to discard a fair bit of the 3dbag roof geometry"): the photo shows a
 * short steep tiled face over the eaves (a mansard attic) behind the gables and cornices, and sky above it.
 *
 * Form, along the depth `d` behind the pand's street frontage (heights above the pand's ground):
 *   - main body, 0 <= d <= mainDepth: a steep face (frontPitchDeg) from the front eaves up one attic storey (the top
 *     storey height, clamped), a flat top, and the same steep face down to the rear eaves at mainDepth. The top is
 *     capped by the 3DBAG main-body roof (95th percentile of samples) and never below the eaves. A main body that 3DBAG
 *     shows flat (p95 less than flatRiseM over the eaves) stays flat at the eaves.
 *   - rear wings, d > mainDepth: 3DBAG's own plan partition there, each surface made flat at its median height and
 *     never above the eaves ("flat-roof detection for deep rear wings"). mainDepth is where the 3DBAG roof across the
 *     plot first drops wingDropM below the eaves, snapped to a footprint corner nearby.
 * Gable/cornice crowns are facade walls standing in front of this roof (fit.ts), so the profile does not depend on the
 * crown type.
 *
 * Front forms (2026-10-16, `RecipeRoofInput.forms`, blockFace/compile.ts `frontRoofSpecs`): when the street front has
 * a measured crown, each front band takes the form the front implies instead of the 3DBAG-bounded attic:
 *   - `saddle` under a gable: two planes meeting at a ridge over the band's centre, running the main depth, the ridge
 *     and side pitch chosen by `saddleUnderProfile` so the roof stays 3 cm under every vertex of the crown outline
 *     (the user, 2026-10-16: the lopsided step gables were LoD2.2 planes showing above the symmetric crown);
 *   - `flat` behind a parapet or a measured cornice with nothing on it;
 *   - `attic` behind a dormered cornice (the same steep face as the recipe form, capped by a photo top or a row ridge
 *     instead of the 3DBAG p95 when a hint says so).
 * Rear wings then sit no higher than the lowest saddle eaves. 3DBAG is an upper bound only ("don't give so much
 * credence to 3DBAG roofs").
 *
 * The output is planar convex pieces written into `roofsRD` exactly as 3DBAG surfaces would be, so fit/surveyRecipe and
 * the library compile them unchanged (closures on footprint edges, step walls at wing steps). `roofSource` marks the
 * facts so the fit skips roofCleanup and the face gates treat 3DBAG as an upper bound.
 */
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {pointInRing, roofHeightAt} from '../buildingRecipe/facts.ts';

export const RECIPE_ROOF = {
  /** Steep attic face over the front and rear eaves (Bilderdijkstraat strip: tiles show ~1.5 m over the eaves from the street). */
  frontPitchDeg: 70,
  /** The attic storey: the top storey height, clamped. */
  atticMinM: 2.4, atticMaxM: 3.2,
  /** 3DBAG main body flat when its p95 is less than this over the eaves. */
  flatRiseM: 1.0,
  /** Main body ends where the 3DBAG max across the plot drops this far below the eaves (a rear wing is a storey lower). */
  wingDropM: 2.5,
  /** Rear wings never lower than this (m). */
  wingMinM: 2.5,
  /** mainDepth snaps to a footprint corner this close (no sliver bands along a rear wall). */
  snapM: 0.6,
  /** Sampling grid and depth bins (m). */
  sampleM: 0.35, binM: 0.5,
  /** Depth is measured square to the frontage chord when the front's normal leans off it by more than this along the front (m). */
  chordDriftM: 0.01,
};

export type FrontRoofForm = 'saddle' | 'flat' | 'attic';

/** The roof form one front band takes (blockFace/compile.ts `frontRoofSpecs`). Heights in metres above the pand ground. */
export interface FrontRoofSpec {
  form: FrontRoofForm;
  /** Saddle: the ridge height and side pitch (from `saddleUnderProfile`). Attic: the face pitch (default `frontPitchDeg`). */
  ridgeM?: number;
  pitchDeg?: number;
  /** Saddle: the roof height at the band's outer edges (reported; rear wings stay under it). */
  sideEavesM?: number;
  /** Attic: a cap on the attic top (a photo top row, a row ridge). `surveyCap: false` drops the 3DBAG p95 cap (a photo hint). */
  capM?: number;
  surveyCap?: boolean;
  /** The crown line this band stays under (saddle: the crown outline top); reported as the pand's `crownTopM`. */
  lineM?: number;
  note?: string;
  /**
   * Attic only (`RoofIntent.rise` x the top storey height): the measured rise of the main roof over the front eaves (m). Replaces the attic
   * storey (`atticMinM..atticMaxM`) and the 3DBAG p95 cap; the 3DBAG max stays the bound. Absent = byte-identical.
   */
  riseM?: number;
  /** Attic only (`RoofIntent.rearPitchDeg`): the rear face's own pitch (a long saddle's shallower back slope). */
  rearPitchDeg?: number;
  /**
   * Attic only (`RoofIntent.crossGables`): pointed crowns on part of the front that are the ends of cross roofs. Each
   * gives the crown's two feet and apex on the facade line (RD xy) and their heights (m above the pand ground); the roof
   * behind the crown takes the crown's rakes (3 cm under them) back until they meet the attic face, so the gable is the
   * end wall of a roof instead of a sheet standing in front of it (Zaanhof, 1919).
   */
  crossGables?: CrossGable[];
}

/** One cross-roof gable (see `FrontRoofSpec.crossGables`): feet `leftRD`/`rightRD` and `apexRD` on the facade line. */
export interface CrossGable { leftRD: number[]; apexRD: number[]; rightRD: number[]; leftM: number; apexM: number; rightM: number }
/** Cross roofs stay this far under the crown's rakes (the saddle's margin under a crown outline). */
export const CROSS_GABLE_MARGIN_M = 0.03;
/** Cross roofs start this far behind the frontage, behind the crown wall (fit.ts crown depth 0.18 m, bargeboards on it). */
export const CROSS_GABLE_BEHIND_M = 0.25;

export interface RecipeRoofReport {
  pandId: string;
  form: 'attic' | 'flat' | 'saddle' | 'mixed';
  eavesM: number;
  /** Top of the generated main roof, and the 3DBAG main-body cap (p95) and absolute max it was bounded by. */
  ridgeM: number; capM: number; surveyMaxM: number;
  atticM: number; mainDepthM: number; plotDepthM: number;
  /** Flat rear-wing surfaces (from 3DBAG's partition): plan area and height. */
  wings: {areaM2: number; heightM: number}[];
  surfacesBefore: number; surfacesAfter: number;
  notes: string[];
  /** Front forms only: per front band, and the crown line the roof stays under. */
  bands?: {id: string; form: FrontRoofForm; eavesM: number; ridgeM: number; pitchDeg?: number; sideEavesM?: number}[];
  crownTopM?: number;
}

export interface RecipeRoofInput {
  /** Fitted front eaves of the street front (m above the pand ground), and its storey heights. */
  eavesM: number;
  storeyHeightsM: number[];
  /** The street the house fronts (its first front). */
  street: string;
  /** The attic face starts this far behind the frontage: dormers (fit.ts, 0.35 m setback) stand in front of it. */
  faceSetbackM?: number;
  /** Upper bound on the attic top (m above this pand's ground): the face's cornice group shares one attic line. */
  ridgeCapM?: number;
  /**
   * All fronts on the street when a pand has several (two houses in one pand, tower bays, split gables): each keeps
   * its own fitted eaves at the frontage, the attic rises from it to the shared top, and the split points stay roof
   * vertices so each front wall meets the roof edge (bilder-233580-162444 158-162: a 34 m open loop otherwise).
   * A front whose eaves reach the attic top (a tower bay: a front-plane wall to its measured top, no tower body)
   * takes the roof of the front beside it. A front with `dormers` is never a tower bay: it is a house front whose
   * dormers stand on its own roof (Oudezijds Achterburgwal 55, wallen-oza-41-57 177943 b, 4.2 m over the bell gable
   * beside it: as a tower bay its dormer hovered over the neighbour's attic).
   */
  fronts?: {id: string; eavesM: number; endpointsRD: number[][];
    /** `stepBody`: a raised front with a full-depth body: never a tower bay, its band keeps its own eaves. */
    body?: boolean; dormers?: boolean}[];
  /**
   * Front forms per front id (see `FrontRoofSpec`); absent = the 3DBAG-bounded attic/flat rule for every band,
   * byte-identical. A single-front pand keys its form by `frontId` (or the one entry).
   */
  forms?: Record<string, FrontRoofSpec>;
  frontId?: string;
}

export interface SaddleFit { ridgeM: number; pitchDeg: number; sideEavesM: number; centreM: number }

/**
 * The saddle roof under a crown outline: ridge over the front's centre (`w / 2`), the smallest side pitch (within
 * `minPitchDeg..maxPitchDeg`) that keeps the roof `marginM` under every vertex of the outline, risers included (a
 * vertical step has two vertices at one x; the lower one binds). When even the steepest pitch cannot hold the ridge
 * at the outline top, the ridge drops to what fits. Returns null when the roof's side eaves would sit more than
 * `maxDropM` under the eaves `eavesM` (a small crown on a wide front: the caller falls back to an attic face).
 * `profile` is the crown outline in facade metres (x from the left edge, y above the pand ground), as fit.ts writes it.
 */
export function saddleUnderProfile(profile: [number, number][], widthM: number, eavesM: number, opts: {pitchDeg?: number; marginM?: number; minPitchDeg?: number; maxPitchDeg?: number; maxDropM?: number} = {}): SaddleFit | null {
  const m = opts.marginM ?? 0.03, c = widthM / 2, minTan = Math.tan((opts.minPitchDeg ?? 30) * Math.PI / 180), maxTan = Math.tan((opts.maxPitchDeg ?? 65) * Math.PI / 180);
  if (!(widthM > 0) || profile.length < 2) return null;
  // The outline height at the centre: the highest segment there (a riser at the centre takes its upper end).
  let top = -Infinity;
  for (let i = 1; i < profile.length; i++) {
    const [x0, y0] = profile[i - 1], [x1, y1] = profile[i];
    if (c < Math.min(x0, x1) - 1e-9 || c > Math.max(x0, x1) + 1e-9) continue;
    top = Math.max(top, Math.abs(x1 - x0) < 1e-9 ? Math.max(y0, y1) : y0 + (y1 - y0) * (c - x0) / (x1 - x0));
  }
  if (!Number.isFinite(top)) return null;
  const ridge0 = top - m;
  // Each vertex bounds the ridge for a given pitch: ridge <= y - m + tan * |x - c|.
  const bound = (tan: number) => Math.min(ridge0, ...profile.map(([x, y]) => y - m + tan * Math.abs(x - c)));
  let tan: number;
  if (opts.pitchDeg !== undefined) tan = Math.tan(opts.pitchDeg * Math.PI / 180);
  else {
    // The pitch that keeps the ridge at the top: the steepest demand of any vertex off the centre.
    const need = Math.max(0, ...profile.filter(([x]) => Math.abs(x - c) > 1e-6).map(([x, y]) => (ridge0 - (y - m)) / Math.abs(x - c)));
    tan = Math.min(maxTan, Math.max(minTan, need));
  }
  const ridgeM = bound(tan), sideEavesM = ridgeM - tan * c;
  if (sideEavesM < eavesM - (opts.maxDropM ?? 1)) return null;
  return {ridgeM: r3(ridgeM), pitchDeg: Math.round(Math.atan(tan) * 180 / Math.PI * 10) / 10, sideEavesM: r3(sideEavesM), centreM: c};
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
const quantile = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] : NaN; };
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Signed plan area, about the first vertex (raw RD products lose ~1e-4 m2 to cancellation). */
const planArea = (r: number[][]) => { const o = r[0]; return r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + (p[0] - o[0]) * (q[1] - o[1]) - (q[0] - o[0]) * (p[1] - o[1]); }, 0) / 2; };

/** Clip a convex polygon (plan) to lo <= t(p) <= hi for a linear t. */
export function clipBand(poly: number[][], t: (p: number[]) => number, lo: number, hi: number): number[][] {
  const cut = (pts: number[][], keep: (v: number) => boolean, at: number) => {
    const out: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ta = t(a), tb = t(b), ka = keep(ta), kb = keep(tb);
      if (ka) out.push(a);
      if (ka !== kb) { const k = (at - ta) / (tb - ta); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out;
  };
  let p = poly;
  if (Number.isFinite(lo)) p = cut(p, v => v >= lo, lo);
  if (p.length && Number.isFinite(hi)) p = cut(p, v => v <= hi, hi);
  return p;
}

/** Triangles of a polygon with holes (plan, RD). */
function triangles(rings: number[][][]): number[][][] {
  // Triangulate about a local origin: earcut on raw RD (~5e5 m) loses enough precision to overlap slivers by mm2.
  const pts = rings.flat(), o = pts[0], v = (r: number[][]) => r.map(p => new T.Vector2(p[0] - o[0], p[1] - o[1]));
  return T.ShapeUtils.triangulateShape(v(rings[0]), rings.slice(1).map(v)).map(t => t.map(i => pts[i]));
}

/** Proper crossing of segments ab and cd (shared endpoints do not count). */
function crosses(a: number[], b: number[], c: number[], d: number[]): boolean {
  const o = (p: number[], q: number[], r: number[]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12));
}
function simple(ring: number[][]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]) < 1e-9) return false;
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    if (crosses(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return false;
  }
  return true;
}
/**
 * `simple(ring)` for a ring joined from two simple rings along a shared edge: `ring[0..na-1]` is the first ring's chain
 * (q ... p), the rest the second ring's inner vertices (p ... q without the ends). Pairs inside one chain were pairs of
 * a simple ring (or are adjacent here too), so only pairs across the two chains can fail: the same answer as `simple`
 * in O(na * nb) instead of O((na + nb)^2).
 */
function simpleUnion(ring: number[][], na: number): boolean {
  const n = ring.length;
  for (let i = 0; i < na; i++) for (let j = na; j < n; j++) if (Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]) < 1e-9) return false;
  // Edges i -> i + 1: 0 .. na - 2 lie in the first chain, na - 1 .. n - 1 (closing edge included) in the second.
  for (let i = 0; i <= na - 2; i++) for (let j = na - 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    if (crosses(ring[i], ring[i + 1], ring[j], ring[(j + 1) % n])) return false;
  }
  return true;
}

/**
 * Union coplanar pieces across shared edges into simple polygons (each merge keeps the union simple), then drop
 * collinear vertices that are not footprint corners (`corner`). Pieces cut from one footprint triangulation share
 * their interior edges exactly; merging removes them, so a plane is a few polygons rather than dozens of clipped
 * triangles (fewer roof triangles, and no chord slivers left beside the outline). Returns each polygon with the pieces
 * it was made of (the fallback when its own triangulation fails).
 */
export function mergeCoplanar(pieces: number[][][], corner: (p: number[]) => boolean, tol = 1e-7): {ring: number[][]; parts: number[][][]}[] {
  const same = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
  type Entry = {ring: number[][]; parts: number[][][]};
  const out: Entry[] = pieces.filter(r => r.length >= 3 && Math.abs(planArea(r)) > 1e-12).map(r => { const ring = planArea(r) < 0 ? [...r].reverse() : r; return {ring, parts: [ring]}; });
  // The merge order is "the first mergeable pair (i, j) in lexicographic order, then start over" (the order fixes the
  // result). Starting over literally is O(n^3) and ran for hours on a 2,600 m2 block footprint (Jan Evertsenstraat
  // 121-125); the same pairs are found in the same order without it:
  //  - a pair that failed cannot merge until one of its two polygons changes (a merge makes a new entry object), so
  //    failures are remembered per object pair;
  //  - after a merge at (i, j) every pair before it except (i', i) for i' < i is a known failure, so the next merge is
  //    the first (i', i) that merges (and so on back), else the scan resumes at (i, i + 1);
  //  - the union of two simple polygons along a shared edge can only fail where the two parts meet (`simpleUnion`).
  const failed = new WeakMap<Entry, WeakSet<Entry>>(), isSimple = new WeakMap<Entry, boolean>();
  const known = (e: Entry) => { let s = isSimple.get(e); if (s === undefined) isSimple.set(e, s = simple(e.ring)); return s; };
  const tryPair = (i: number, j: number): boolean => {
    const E = out[i], F = out[j];
    if (failed.get(E)?.has(F)) return false;
    const A = E.ring, B = F.ring, both = known(E) && known(F);
    for (let a = 0; a < A.length; a++) {
      const p = A[a], q = A[(a + 1) % A.length];
      const b = B.findIndex((v, k) => same(v, q) && same(B[(k + 1) % B.length], p));
      if (b < 0) continue;
      const ra = [...A.slice((a + 1) % A.length), ...A.slice(0, (a + 1) % A.length)]; // q ... p
      const rb = [...B.slice((b + 1) % B.length), ...B.slice(0, (b + 1) % B.length)]; // p ... q
      const ring = [...ra, ...rb.slice(1, -1)];
      if (!(both ? simpleUnion(ring, ra.length) : simple(ring))) continue;
      const merged: Entry = {ring, parts: [...E.parts, ...F.parts]};
      isSimple.set(merged, true);
      out[i] = merged;
      out.splice(j, 1);
      return true;
    }
    let f = failed.get(E);
    if (!f) failed.set(E, f = new WeakSet());
    f.add(F);
    return false;
  };
  for (let i = 0, j = 1; i < out.length;) {
    if (j >= out.length) { i++; j = i + 1; continue; }
    if (!tryPair(i, j)) { j++; continue; }
    for (let back = true; back;) { back = false; for (let k = 0; k < i; k++) if (tryPair(k, i)) { i = k; back = true; break; } }
    j = i + 1;
  }
  return out.map(({ring, parts}) => {
    let r = ring;
    for (let changed = true; changed && r.length > 3;) {
      changed = false;
      for (let i = 0; i < r.length; i++) {
        const a = r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        const dot = (b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1]);
        if (!corner(b) && dot > 0 && dot < len * len && Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / len < 1e-7) { r = r.filter((_, k) => k !== i); changed = true; break; }
      }
    }
    return {ring: r, parts};
  });
}

/**
 * Triangles of a footprint without slivers. Earcut on an outline with near-collinear corners (a frontage chain bending
 * by millimetres) makes cm-wide sliver triangles along it, and every cut crossing a sliver leaves sub-millimetre pieces
 * that the survey conversion snaps inside out (bilder-081118 087959: +0.0013 m2, over the library's area tolerance).
 * Instead: drop corners within `tolM` of the chord of their neighbours, triangulate the simpler outline, then fan each
 * triangle with a simplified outline edge out to the dropped corners again. Every outline corner stays a vertex; the
 * partition is exact. Falls back to plain earcut for holes or when a fan triangle would flip.
 */
export function footprintTriangles(rings: number[][][], tolM = 0.05): number[][][] {
  if (rings.length !== 1) return triangles(rings);
  const ring = rings[0], keep = ring.map(() => true);
  const dist = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (l * l); return t <= 0 || t >= 1 ? Infinity : Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l; };
  for (let changed = true; changed;) {
    changed = false;
    const idx = ring.map((_, i) => i).filter(i => keep[i]);
    if (idx.length <= 3) break;
    for (let k = 0; k < idx.length && idx.filter(i => keep[i]).length > 3; k++) {
      const live = idx.filter(i => keep[i]), j = live.indexOf(idx[k]);
      if (j < 0) continue;
      const a = live[(j + live.length - 1) % live.length], b = live[(j + 1) % live.length];
      // Every corner dropped between a and b must stay within tolM of the new chord.
      const between: number[] = [];
      for (let i = (a + 1) % ring.length; i !== b; i = (i + 1) % ring.length) between.push(i);
      if (between.every(i => dist(ring[i], ring[a], ring[b]) < tolM)) { keep[idx[k]] = false; changed = true; }
    }
  }
  const live = ring.map((_, i) => i).filter(i => keep[i]);
  if (live.length === ring.length) return triangles(rings);
  const simple = triangles([live.map(i => ring[i])]);
  const key = (p: number[]) => `${p[0]},${p[1]}`, at = new Map(ring.map((p, i) => [key(p), i]));
  const out: number[][][] = [];
  const split = (t: number[][]): boolean => {
    for (let e = 0; e < 3; e++) {
      const p = t[e], q = t[(e + 1) % 3], x = t[(e + 2) % 3], ip = at.get(key(p))!, iq = at.get(key(q))!;
      // Dropped corners strictly between p and q along the outline (either direction).
      const walk = (from: number, to: number) => { const r: number[] = []; for (let i = (from + 1) % ring.length; i !== to; i = (i + 1) % ring.length) { if (keep[i]) return null; r.push(i); } return r; };
      const fwd = walk(ip, iq), bwd = fwd ? null : walk(iq, ip);
      const mid = fwd ?? (bwd ? [...bwd].reverse() : null);
      if (!mid?.length) continue;
      const chain = [p, ...mid.map(i => ring[i]), q];
      const fan = chain.slice(1).map((v, k) => [chain[k], v, x]);
      if (fan.some(f => Math.sign(planArea(f)) !== Math.sign(planArea(t)) || Math.abs(planArea(f)) < 1e-12)) return false;
      for (const f of fan) if (!split(f)) return false;
      return true;
    }
    out.push(t);
    return true;
  };
  for (const t of simple) if (!split(t)) return triangles(rings);
  return out;
}

/**
 * The main-body profile h(d): (a flat gutter `setbackM` deep,) steep up, flat top, steep down; knots [d, h]. The rear
 * face takes `rearPitchDeg` when given (absent: the front pitch, byte-identical).
 */
export function atticProfile(eavesM: number, ridgeM: number, mainDepthM: number, pitchDeg: number, setbackM = 0, rearPitchDeg?: number): [number, number][] {
  if (ridgeM - eavesM < 0.05) return [[0, eavesM], [mainDepthM, eavesM]];
  const run = (ridgeM - eavesM) / Math.tan(pitchDeg * Math.PI / 180), rearRun = rearPitchDeg === undefined ? run : (ridgeM - eavesM) / Math.tan(rearPitchDeg * Math.PI / 180);
  return [[0, eavesM], ...(setbackM > 0 ? [[setbackM, eavesM] as [number, number]] : []), [setbackM + run, ridgeM], [mainDepthM - rearRun, ridgeM], [mainDepthM, eavesM]];
}

/**
 * Earcut can cut a zero-area ear off three collinear outline points a-b-c (a footprint corner b on the eaves line) and
 * cover a-c with one triangle: the ear is dropped as a sliver below, and the open edge b-c of its neighbour sliver is a
 * T-junction along the eaves that the GLB audit reads as an open loop (wallen-oza-41-57 177915, Oudezijds Achterburgwal
 * 43: 1.45 m at the party corner). The triangle on a-c is split at b instead. Only for an a-c of `minM` or more; shorter
 * T-junctions, and any off the `where` line, stay (byte-identical elsewhere).
 */
export function splitAtDroppedSlivers(tris: number[][][], where: (p: number[]) => boolean = () => true, minM = 0.5, dropM2 = 1e-5): number[][][] {
  const out = tris.map(t => [...t]);
  for (const t of tris) {
    if (Math.abs(planArea(t)) >= dropM2) continue;
    const len = (k: number) => Math.hypot(t[(k + 1) % 3][0] - t[k][0], t[(k + 1) % 3][1] - t[k][1]);
    const k = [0, 1, 2].reduce((m, i) => len(i) > len(m) ? i : m, 0), a = t[k], c = t[(k + 1) % 3], b = t[(k + 2) % 3];
    if (len(k) < minM || !t.every(where)) continue;
    const l2 = len(k) ** 2, u = ((b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1])) / l2;
    if (u <= 1e-6 || u >= 1 - 1e-6) continue;
    const same = (p: number[], q: number[]) => p === q || (Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9);
    const j = out.findIndex(o => o !== t && Math.abs(planArea(o)) >= dropM2 && o.some(p => same(p, a)) && o.some(p => same(p, c)));
    if (j < 0) continue;
    const o = out[j];
    out.splice(j, 1, o.map(p => same(p, c) ? b : p), o.map(p => same(p, a) ? b : p));
  }
  return out;
}

/**
 * Replace a pand's 3DBAG roof with the recipe roof. `facts` are the pand's facts as the face compile fits them (front
 * snaps, shared ground, measured eaves, roofCleanup applied).
 */
export function recipeRoofFacts(facts: BuildingFacts, input: RecipeRoofInput, opts: Partial<typeof RECIPE_ROOF> = {}, squareToChord?: boolean): {facts: BuildingFacts; report: RecipeRoofReport} {
  const o = {...RECIPE_ROOF, ...opts}, ground = facts.heights.groundNAP, notes: string[] = [];
  const front = facts.fronts.find(f => f.street === input.street) ?? facts.fronts[0];
  const e0 = front.endpointsRD[0], nl = Math.hypot(front.outwardNormalRD[0], front.outwardNormalRD[1]);
  // A front roof's depth is measured square to the frontage chord (the line the elevation and its crown outline stand on)
  // when the front's outward normal leans off it so far that a rising attic face climbs along the facade line: the
  // normal comes from the BAG facade edge, the chord ends at the survey footprint's corners (De Clercqstraat 22, 153066:
  // 4 degrees, the attic climbed 1.4 m over the parapet; Nassaukade 162089 and six neighbours 5-20 cm). Only a front
  // roof whose chord end stands deeper than the attic setback + `chordDriftM`, and only when a band rises as an attic;
  // every other roof keeps the normal (byte-identical).
  const e1 = front.endpointsRD[1], cl = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
  const nIn = [-front.outwardNormalRD[0] / nl, -front.outwardNormalRD[1] / nl];
  const lean = dot([e1[0] - e0[0], e1[1] - e0[1]], nIn);
  if (squareToChord === undefined && input.forms && cl > 1e-6 && lean > (input.faceSetbackM ?? 0) + o.chordDriftM) {
    const asIs = recipeRoofFacts(facts, input, opts, false);
    if (!asIs.report.bands?.some(b => b.form === 'attic' && b.ridgeM - b.eavesM >= 0.05)) return asIs;
    const sq = recipeRoofFacts(facts, input, opts, true);
    sq.report.notes.push(`attic square to the frontage chord (the front normal leans ${r3(lean)} m deep along ${r3(cl)} m)`);
    return sq;
  }
  const chordIn = [-(e1[1] - e0[1]) / cl, (e1[0] - e0[0]) / cl], sgn = dot(chordIn, nIn) < 0 ? -1 : 1;
  const inward = squareToChord ? [sgn * chordIn[0], sgn * chordIn[1]] : nIn;
  const depth = (p: number[]) => dot([p[0] - e0[0], p[1] - e0[1]], inward);
  const E = input.eavesM;

  // 3DBAG samples over the footprint, binned by depth.
  const polys = facts.surveyFootprintPolygonsRD;
  const inside = (p: number[]) => polys.some(poly => pointInRing(p, poly[0]) && !poly.slice(1).some(h => pointInRing(p, h)));
  const all = polys.flatMap(p => p.flat()), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const samples: {d: number; h: number; p: number[]}[] = [];
  for (let x = Math.min(...xs) + o.sampleM / 2; x < Math.max(...xs); x += o.sampleM) for (let y = Math.min(...ys) + o.sampleM / 2; y < Math.max(...ys); y += o.sampleM) {
    if (!inside([x, y])) continue;
    const h = roofHeightAt(facts.roofsRD, [x, y], ground);
    if (h !== null) samples.push({d: depth([x, y]), h, p: [x, y]});
  }
  const depths = all.map(depth), plotDepth = Math.max(...depths);
  const bins = new Map<number, number[]>();
  for (const s of samples) { const k = Math.max(0, Math.floor(s.d / o.binM)); bins.set(k, [...(bins.get(k) ?? []), s.h]); }
  // Main body: from the front while the plot still stands within wingDropM of the eaves (one low/empty bin tolerated).
  let lastMain = -1, misses = 0;
  for (let k = 0; k < Math.ceil(plotDepth / o.binM); k++) {
    const v = bins.get(k);
    if (v && Math.max(...v) >= E - o.wingDropM) { lastMain = k; misses = 0; } else if (++misses > 1) break;
  }
  let mainDepth = lastMain < 0 ? plotDepth : Math.min(plotDepth, (lastMain + 1) * o.binM);
  // Snap to the nearest footprint corner depth (rear walls), else to the plot depth when within a metre of it.
  const corner = depths.filter(d => d > 1).reduce((b, d) => Math.abs(d - mainDepth) < Math.abs(b - mainDepth) ? d : b, Infinity);
  if (Math.abs(corner - mainDepth) <= o.snapM) mainDepth = corner;
  if (plotDepth - mainDepth < 1.0) mainDepth = plotDepth;
  const mainH = samples.filter(s => s.d <= mainDepth).map(s => s.h);
  const capM = mainH.length ? quantile(mainH, 0.95) : E, surveyMaxM = (facts.heights as {surveyRoofMaxM?: number}).surveyRoofMaxM ?? facts.heights.roofMaxM;
  const attic = Math.max(o.atticMinM, Math.min(o.atticMaxM, input.storeyHeightsM.at(-1) ?? 3));
  const t = Math.tan(o.frontPitchDeg * Math.PI / 180), flat = capM - E < o.flatRiseM;
  const setback = input.faceSetbackM ?? 0, ridge = r3(flat ? E : Math.max(E, Math.min(E + attic, capM, E + t * (mainDepth - setback) / 2, input.ridgeCapM ?? Infinity)));
  if (!flat && input.ridgeCapM !== undefined && input.ridgeCapM < Math.min(E + attic, capM)) notes.push(`attic line of its cornice group (${r3(input.ridgeCapM)} m)`);
  if (flat) notes.push(`3DBAG main body flat (p95 ${r3(capM)} m vs eaves ${r3(E)} m): flat at the eaves`);
  else if (capM < E + attic) notes.push(`attic capped by 3DBAG p95 ${r3(capM)} m`);
  const cornerDepths = polys.flatMap(poly => poly.flat()).map(depth);
  const makeProfile = (eaves: number, ridgeB = ridge, pitchB = o.frontPitchDeg, rearB?: number) => {
    const profile = atticProfile(eaves, Math.max(eaves, ridgeB), mainDepth, pitchB, setback, rearB);
    // A cut within 2 cm of a footprint corner passes through it: a sub-mm miss leaves slivers that invert when snapped.
    for (const k of profile) { const near = cornerDepths.find(d => Math.abs(d - k[0]) < 0.02); if (near !== undefined && k[0] > 0) k[0] = near; }
    // Knots within 2 cm of each other (a pitch whose faces meet with no flat top) become one: a corner snap moving only
    // one of them would order them backwards and the bands between would overlap (marnix-124-138 at 30 degrees).
    for (let i = 1; i < profile.length; i++) if (profile[i][0] - profile[i - 1][0] < 0.02) profile[i][0] = profile[i - 1][0];
    return profile;
  };
  // Fronts along the street (see RecipeRoofInput.fronts): bands between the split points, each with its own eaves.
  const along = (p: number[]) => dot([p[0] - e0[0], p[1] - e0[1]], [inward[1], -inward[0]]);
  const fronts = (input.fronts ?? []).map(f => ({...f, lo: Math.min(...f.endpointsRD.map(along)), hi: Math.max(...f.endpointsRD.map(along))})).sort((a, b) => a.lo - b.lo);
  // A tower bay: eaves a storey-ish over the lowest front (> 1 m) or at the attic top. Its roof band would sit flush on
  // the bay's own wall cap and z-fight (bilder-233580-162444 tower bays: 0.5 m2), so it takes its neighbour's roof.
  const lowest = Math.min(E, ...(input.fronts ?? []).map(f => f.eavesM));
  const tower = (e: number) => e > lowest + 1.0 || (e >= ridge - 0.05 && ridge - E >= 0.05);
  const e0a = along(front.endpointsRD[0]), e1a = along(front.endpointsRD[1]);
  // `fLo..fHi`: the band's own front along the street (a saddle spans it; beyond it the roof is flat at the saddle's side eaves).
  const bands: {lo: number; hi: number; eaves: number; id?: string; centre: number; fLo: number; fHi: number}[] = fronts.length < 2 ? [{lo: -Infinity, hi: Infinity, eaves: E, id: input.frontId, centre: (e0a + e1a) / 2, fLo: Math.min(e0a, e1a), fHi: Math.max(e0a, e1a)}] : fronts.map((f, i) => ({
    lo: i === 0 ? -Infinity : (fronts[i - 1].hi + f.lo) / 2, hi: i === fronts.length - 1 ? Infinity : (f.hi + fronts[i + 1].lo) / 2, eaves: f.eavesM, id: f.id, centre: (f.lo + f.hi) / 2, fLo: f.lo, fHi: f.hi}));
  if (fronts.length >= 2) {
    // A dormered front whose eaves the neighbour's roof never reaches is a house front, not a tower bay (see `fronts`).
    const ownRoof = (i: number) => !!fronts[i].dormers && ridge < bands[i].eaves;
    const plain = bands.map((b, i) => tower(b.eaves) && !fronts[i].body && !ownRoof(i) ? -1 : i);
    // Its attic is bounded by its own share of 3DBAG: the pand's p95 pools the low front's roof and would turn the band
    // flat under its dormer.
    for (const [i, b] of bands.entries()) if (tower(b.eaves) && ownRoof(i)) {
      const own = samples.filter(sm => sm.d <= mainDepth && along(sm.p) >= fronts[i].lo && along(sm.p) <= fronts[i].hi).map(sm => sm.h);
      if (own.length) { (b as {ownCapM?: number}).ownCapM = quantile(own, 0.95); notes.push(`front ${fronts[i].id}: dormered front over its neighbour, attic bounded by its own 3DBAG p95 ${r3(quantile(own, 0.95))} m`); }
    }
    for (const [i, b] of bands.entries()) if (plain[i] < 0) {
      const j = plain.filter(k => k >= 0).sort((a, c) => Math.abs(a - i) - Math.abs(c - i) || a - c)[0];
      b.eaves = j === undefined ? E : bands[j].eaves;
      notes.push(`front ${fronts[i].id}: tower bay (eaves ${r3(fronts[i].eavesM)} m), roof of its neighbour`);
    }
    if (bands.some(b => Math.abs(b.eaves - E) > 0.02)) notes.push(`per-front eaves ${bands.map(b => r3(b.eaves)).join('/')} m`);
  }
  // Front forms per band (absent: the 3DBAG-bounded rule above for every band).
  const specOf = (b: {id?: string}): FrontRoofSpec | undefined => {
    if (!input.forms) return undefined;
    if (b.id !== undefined && input.forms[b.id]) return input.forms[b.id];
    return bands.length === 1 ? Object.values(input.forms)[0] : undefined;
  };
  const shaped = bands.map(b => {
    const spec = specOf(b);
    if (!spec) return {...b, form: (ridge - b.eaves < 0.05 ? 'flat' : 'attic') as FrontRoofForm, ridge: Math.max(b.eaves, ridge), pitch: o.frontPitchDeg, tan: t, spec};
    if (spec.form === 'flat') return {...b, form: 'flat' as FrontRoofForm, ridge: b.eaves, pitch: o.frontPitchDeg, tan: t, spec};
    if (spec.form === 'saddle') { const pitch = spec.pitchDeg ?? o.frontPitchDeg; return {...b, form: 'saddle' as FrontRoofForm, ridge: r3(spec.ridgeM ?? b.eaves), pitch, tan: Math.tan(pitch * Math.PI / 180), spec}; }
    // Attic: the recipe's steep face, capped by the hint's top (a photo row, a row ridge) and, unless the hint says otherwise, by the 3DBAG p95.
    const bandCapM = (b as {ownCapM?: number}).ownCapM ?? capM;
    const pitch = spec.pitchDeg ?? o.frontPitchDeg, tb = Math.tan(pitch * Math.PI / 180);
    if (spec.riseM !== undefined) {
      // A measured rise (RoofIntent.riseM): no attic-storey clamp and no p95 cap, the 3DBAG max and the group line still bound it;
      // the two faces may meet at a ridge (each at its own pitch) but never cross.
      const tr = Math.tan((spec.rearPitchDeg ?? pitch) * Math.PI / 180), meet = (mainDepth - setback) / (1 / tb + 1 / tr);
      const rb = r3(Math.max(b.eaves, Math.min(b.eaves + spec.riseM, spec.capM ?? Infinity, surveyMaxM, input.ridgeCapM ?? Infinity, b.eaves + meet)));
      return {...b, form: (rb - b.eaves < 0.05 ? 'flat' : 'attic') as FrontRoofForm, ridge: rb, pitch, tan: tb, spec};
    }
    const cap = Math.min(spec.capM ?? Infinity, spec.surveyCap === false ? surveyMaxM : bandCapM, input.ridgeCapM ?? Infinity);
    const flatB = spec.surveyCap !== false && bandCapM - b.eaves < o.flatRiseM;
    const rb = r3(flatB ? b.eaves : Math.max(b.eaves, Math.min(b.eaves + attic, cap, b.eaves + tb * (mainDepth - setback) / 2)));
    return {...b, form: (rb - b.eaves < 0.05 ? 'flat' : 'attic') as FrontRoofForm, ridge: rb, pitch, tan: tb, spec};
  });
  if (input.forms) for (let k = notes.length - 1; k >= 0; k--) if (/^(attic capped by 3DBAG|3DBAG main body flat|attic line of its cornice group)/.test(notes[k])) notes.splice(k, 1);
  for (const b of shaped) if (b.spec?.note) notes.push(`front ${b.id ?? ''}: ${b.spec.note}`);
  for (const b of shaped) for (const g of b.form === 'attic' ? b.spec?.crossGables ?? [] : []) if (g.apexM - CROSS_GABLE_MARGIN_M > b.ridge + 1e-6) notes.push(`front ${b.id ?? ''}: cross gable apex ${r3(g.apexM)} m over the ridge ${r3(b.ridge)} m: no cross roof`);
  // Rear wings never rise over the lowest saddle eaves: a wing standing above a gable roof's sides would show beside the crown.
  const wingCapE = Math.min(E, ...shaped.filter(b => b.form === 'saddle').map(b => b.spec?.sideEavesM ?? (b.ridge - b.tan * Math.max(b.centre - (Number.isFinite(b.lo) ? b.lo : along(front.endpointsRD[0])), (Number.isFinite(b.hi) ? b.hi : along(front.endpointsRD[1])) - b.centre))));

  const roofsRD: BuildingFacts['roofsRD'] = [];
  // Coplanar pieces are merged, triangulated here, and each triangle written as its own planar surface: surveyRecipe
  // re-triangulates each ring with earcut, which on a sliver ring (near-collinear outline corners, mm duplicates)
  // returns overlapping or missing triangles and breaks the library's area check (utrechtse-48-76 178874: +0.0025 m2).
  let droppedM2 = 0;
  const outline = polys.flatMap(poly => poly.flatMap(r => r.map((p, i) => [p, r[(i + 1) % r.length]] as [number[], number[]])));
  const onOutline = (p: number[]) => {
    let best = p, dist = 5e-4;
    for (const [a, b] of outline) {
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      if (l2 < 1e-12) continue;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)), q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d > 1e-7 && d < dist) { dist = d; best = q; }
    }
    return best;
  };
  const emit = (ring: number[][], h: (p: number[]) => number, parts: number[][][] = [ring]): void => {
    // Earcut about a local origin (a snapped corner can make a piece slightly non-convex, where a fan would overlap);
    // when earcut loses area on a degenerate ring, the fan is used instead.
    const whole = Math.abs(planArea(ring)), sum = (ts: number[][][]) => ts.reduce((a, t) => a + Math.abs(planArea(t)), 0);
    const fan = Array.from({length: Math.max(0, ring.length - 2)}, (_, i) => [ring[0], ring[i + 1], ring[i + 2]]);
    let tris = triangles([ring]);
    if (Math.abs(sum(tris) - whole) > 1e-7) {
      if (parts.length > 1) { for (const part of parts) emit(part, h); return; }
      tris = fan;
    }
    // Only on a front roof's eaves line (the facade wall top): elsewhere the recipe keeps its triangulation.
    if (input.forms) tris = splitAtDroppedSlivers(tris, p => Math.abs(depth(p)) <= 0.05);
    for (const tri of tris) {
      const area = Math.abs(planArea(tri));
      // Under 0.1 dm2 the survey conversion omits a triangle anyway, but caps the omissions at 1 cm2 per house; dropped
      // here they only count against the library's 10 cm2 area tolerance (reported in notes).
      if (area < 1e-5) { droppedM2 += area; continue; }
      const v = tri.map(p => [p[0], p[1], ground + h(p)]);
      const zs = v.map(q => q[2]), ds = tri.map(depth), dz = Math.max(...zs) - Math.min(...zs), dd = Math.max(...ds) - Math.min(...ds);
      roofsRD.push({surfaceId: `recipe-${roofsRD.length}`, vertices: v, ringsRD: [v], slopeDeg: dz < 1e-3 ? 0 : Math.round(Math.atan2(dz, dd) * 180 / Math.PI), areaM2: area});
    }
  };
  // Footprint corners: a clip point within a millimetre of one IS that corner, and a corner on a piece edge becomes a
  // vertex of it. Otherwise an edge along the outline ends 0.1 mm past a near-collinear corner, no single outline edge
  // contains it, and the library skips its closure wall (an open side, bilder-081118 at Bilderdijkstraat 136).
  // Split points between fronts stay vertices (the front walls end there): footprint vertices when they are, else
  // points on the outline (projected within 2 cm).
  const corners = polys.flatMap(poly => poly.flat());
  if (fronts.length >= 2) for (const f of fronts) for (const q of f.endpointsRD) {
    if (corners.some(c => Math.hypot(c[0] - q[0], c[1] - q[1]) < 1e-3)) continue;
    let best: number[] | null = null, dist = 0.02;
    for (const poly of polys) for (const r of poly) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      if (l2 < 1e-12) continue;
      const u = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)), c = [a[0] + u * dx, a[1] + u * dy], d = Math.hypot(c[0] - q[0], c[1] - q[1]);
      if (d < dist) { dist = d; best = c; }
    }
    if (best) corners.push(best as typeof corners[number]);
  }
  const footEdges = polys.flatMap(poly => poly.flatMap(r => r.map((p, i) => [p, r[(i + 1) % r.length]] as [number[], number[]])));
  const snapRing = (ring: number[][]) => {
    const snapped = ring.map(p => corners.find(c => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1e-3) ?? p);
    const out: number[][] = [];
    for (let i = 0; i < snapped.length; i++) {
      const a = snapped[i], b = snapped[(i + 1) % snapped.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      out.push(a);
      if (l2 < 1e-12) continue;
      const on = corners.map(c => ({c, t: ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / l2}))
        .filter(({c, t}) => t > 1e-9 && t < 1 - 1e-9 && Math.abs((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / Math.sqrt(l2) < 1e-5 && Math.hypot(c[0] - a[0], c[1] - a[1]) > 1e-6 && Math.hypot(c[0] - b[0], c[1] - b[1]) > 1e-6)
        .sort((u, v) => u.t - v.t);
      for (const {c} of on) if (!out.some(q => q === c)) out.push(c);
    }
    return out.filter((p, i) => Math.hypot(p[0] - out[(i + 1) % out.length][0], p[1] - out[(i + 1) % out.length][1]) > 1e-9);
  };
  // Pieces are collected per plane and merged before they become surfaces (mergeCoplanar).
  const planes = new Map<string, {h: (p: number[]) => number; pieces: number[][][]}>();
  const push = (raw: number[][], h: (p: number[]) => number, key: string) => {
    if (raw.length < 3) return;
    // surveyRecipe moves a point within 0.5 mm of the outline onto it; doing it here, before pieces merge and shed
    // collinear vertices, keeps neighbours consistent (a T-junction moved on one side only overlaps by mm2).
    const r = snapRing(raw).map(onOutline), sign = Math.sign(planArea(raw));
    // A sliver the corner snap turned inside out is dropped (its area would count twice).
    if (Math.sign(planArea(r)) !== sign) { droppedM2 += Math.abs(planArea(r)); return; }
    if (!planes.has(key)) planes.set(key, {h, pieces: []});
    planes.get(key)!.pieces.push(r);
  };

  const footTris = polys.flatMap(poly => footprintTriangles(poly));
  // Main body: footprint triangles cut at the profile knots; a footprint corner in front of the frontage stays at the eaves.
  const wingCut = mainDepth < plotDepth ? mainDepth : Infinity;
  for (const [bi, band] of shaped.entries()) {
    const profile = makeProfile(band.eaves, band.ridge, band.pitch, band.form === 'attic' ? band.spec?.rearPitchDeg : undefined), knots = profile.map(p => p[0]), Eb = band.eaves;
    const heightIn = (k: number, d: number) => { const [d0, h0] = profile[k], [d1, h1] = profile[k + 1]; return d1 - d0 < 1e-9 ? h0 : h0 + (h1 - h0) * (d - d0) / (d1 - d0); };
    // A band boundary passes through its split point exactly (snapped to the outline above).
    const cut = (v: number) => { const c = corners.find(q => Math.abs(along(q) - v) < 0.02 && Math.abs(depth(q)) < 0.05); return c ? along(c) : v; };
    const [alo, ahi] = [Number.isFinite(band.lo) ? cut(band.lo) : -Infinity, Number.isFinite(band.hi) ? cut(band.hi) : Infinity];
    const tag = band.spec ? `${r3(Eb)}-${bi}` : `${r3(Eb)}`;
    for (const whole of footTris) {
      const tri = bands.length > 1 ? clipBand(whole, along, alo, ahi) : whole;
      if (tri.length < 3) continue;
      if (band.form === 'saddle') {
        // Two planes meeting over the band's centre, over the whole main body (a corner in front of the frontage included);
        // footprint beyond the band's own front (a pand wrapping behind its neighbour, Kinkerstraat 64-66) is flat at the
        // saddle's side eaves, where the planes would otherwise run on downhill.
        const c = cut(band.centre), R = band.ridge, tn = band.tan, main = clipBand(tri, depth, -Infinity, wingCut);
        if (main.length < 3) continue;
        const lo = cut(band.fLo), hi = cut(band.fHi), side = r3(R - tn * Math.max(c - lo, hi - c));
        push(clipBand(main, along, -Infinity, lo), () => side, `saddle-${tag}-skirt`);
        push(clipBand(main, along, lo, c), p => R - tn * (c - along(p)), `saddle-${tag}-L`);
        push(clipBand(main, along, c, hi), p => R - tn * (along(p) - c), `saddle-${tag}-R`);
        push(clipBand(main, along, hi, Infinity), () => side, `saddle-${tag}-skirt`);
        continue;
      }
      // An outline that wanders a few mm either side of the frontage line is not cut there: the cut would leave a
      // metres-long mm-wide sliver along the front that the snaps turn into overlaps (marnix-124-138 at 30 degrees).
      const lead = Math.min(...tri.map(depth)) > -0.02;
      const crossG = band.form === 'attic' ? band.spec?.crossGables : undefined;
      /**
       * Cross roofs (`FrontRoofSpec.crossGables`): within each half of a crown the roof is the higher of the crown's rake
       * and the attic height `hk`; the piece is split along the valley where they meet (both planar: one straight cut).
       * It is snapped first (as `push` snaps a whole piece): a corner snap after the split would move the shared point
       * on one side of the valley only and the pieces would no longer tile the footprint.
       */
      const pushCross = (piece: number[][], hk: (p: number[]) => number, key: string) => {
        let rest = [piece.length >= 3 ? snapRing(piece).map(onOutline) : piece];
        for (const [gi, g] of crossG!.entries()) for (const [side, foot, footM] of [['L', g.leftRD, g.leftM], ['R', g.rightRD, g.rightM]] as const) {
          // A crown standing over the ridge would carry its cross roof past the ridge line: left as it is (reported below).
          if (g.apexM - CROSS_GABLE_MARGIN_M > band.ridge + 1e-6) continue;
          const xf = along(foot), xa = along(g.apexRD), lo2 = Math.min(xf, xa), hi2 = Math.max(xf, xa);
          if (hi2 - lo2 < 0.05) continue;
          const rake = (p: number[]) => footM + (g.apexM - footM) * (along(p) - xf) / (xa - xf) - CROSS_GABLE_MARGIN_M;
          const next: number[][][] = [];
          for (const q of rest) {
            const inSpan = clipBand(q, along, lo2, hi2);
            next.push(clipBand(q, along, -Infinity, lo2), clipBand(q, along, hi2, Infinity), clipBand(inSpan, p => rake(p) - hk(p), -Infinity, 0));
            // Behind the crown wall only: a roof edge on the facade line would raise a masonry closure into the crown's plane.
            const above = clipBand(inSpan, p => rake(p) - hk(p), 0, Infinity), over = clipBand(above, depth, CROSS_GABLE_BEHIND_M, Infinity);
            next.push(clipBand(above, depth, -Infinity, CROSS_GABLE_BEHIND_M));
            if (over.length >= 3 && Math.abs(planArea(over)) > 1e-6) push(over, rake, `cross-${tag}-${gi}-${side}`);
          }
          rest = next.filter(q => q.length >= 3 && Math.abs(planArea(q)) > 1e-6);
        }
        for (const q of rest) push(q, hk, key);
      };
      if (!lead) push(clipBand(tri, depth, -Infinity, Math.min(0, wingCut)), () => Eb, `front-${tag}`);
      for (let k = 0; k + 1 < knots.length; k++) {
        const lo = k === 0 && lead ? -Infinity : knots[k], hi = k + 2 === knots.length ? wingCut : knots[k + 1];
        if (hi - lo < 1e-9) continue;
        const hk = (p: number[]) => heightIn(k, Math.max(knots[k], Math.min(depth(p), knots[k + 1])));
        // Cross roofs run back from the front only: on the rear face the rake would stand over the falling attic again.
        const piece = clipBand(tri, depth, lo, hi);
        // The flat gutter in front of a cross-gabled attic is one plane with the outline strip in front of the frontage:
        // one key, so they merge instead of meeting in millimetre slivers along the eaves.
        const gutter = k === 0 && Math.abs(profile[1][1] - profile[0][1]) < 1e-9;
        if (crossG?.length && profile[k + 1][1] >= profile[k][1] - 1e-9) pushCross(piece, hk, gutter ? `front-${tag}` : `main-${tag}-${k}`);
        else push(piece, p => heightIn(k, Math.max(knots[k], Math.min(depth(p), knots[k + 1]))), `main-${tag}-${k}`);
      }
    }
    void bi;
  }
  // Rear wings: the footprint behind mainDepth, split along the lines where 3DBAG steps between flat levels (each
  // 3DBAG surface flattened to its median, never above the eaves); each piece takes the level 3DBAG has at its centre.
  // Splitting the footprint (not clipping 3DBAG's own rings) keeps the partition exact: LoD2.2 rings differ from the
  // survey ground by fractions of a millimetre, enough to break the library's area check once clipped.
  const wings: RecipeRoofReport['wings'] = [];
  if (wingCut < Infinity) {
    const levelOf = (sf: BuildingFacts['roofsRD'][number]) => Math.max(o.wingMinM, Math.min(wingCapE, quantile((sf.ringsRD?.[0] ?? sf.vertices).map(v => v[2] - ground), 0.5)));
    const levels = facts.roofsRD.map(levelOf);
    const levelAt = (p: number[]): number | null => {
      let best: number | null = null, top = -Infinity;
      facts.roofsRD.forEach((sf, k) => {
        const [outer, ...holes] = sf.ringsRD?.length ? sf.ringsRD : [sf.vertices];
        if (!pointInRing(p, outer) || holes.some(h => pointInRing(p, h))) return;
        const z = roofHeightAt([sf], p, ground) ?? -Infinity;
        if (z > top) { top = z; best = levels[k]; }
      });
      return best;
    };
    // LoD2.2 rings sit a few centimetres inside the survey ground in places: a piece there takes the nearest surface.
    const levelNear = (p: number[]): number | null => {
      let best: number | null = null, dist = 0.5;
      facts.roofsRD.forEach((sf, k) => {
        const ring = sf.ringsRD?.[0] ?? sf.vertices;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)), d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
          if (d < dist) { dist = d; best = levels[k]; }
        }
      });
      return best;
    };
    // Step lines: 3DBAG edges behind the cut with different levels on either side (both sides on the footprint).
    const lines: {n: number[]; c: number}[] = [];
    for (const sf of facts.roofsRD) for (const ring of sf.ringsRD?.length ? sf.ringsRD : [sf.vertices]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.3) continue;
      // The part of the edge behind the cut (an edge running from the main body into the wing counts there).
      const da = depth(a), db = depth(b);
      if (Math.max(da, db) <= wingCut + 0.05) continue;
      const k0 = da >= wingCut ? 0 : (wingCut - da) / (db - da), k1 = db >= wingCut ? 1 : (wingCut - da) / (db - da);
      if ((k1 - k0) * len < 0.3) continue;
      const n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      const differs = [0.25, 0.5, 0.75].some(k => {
        const kk = k0 + (k1 - k0) * k, m = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk];
        const p1 = [m[0] + n[0] * 0.15, m[1] + n[1] * 0.15], p2 = [m[0] - n[0] * 0.15, m[1] - n[1] * 0.15];
        if (!inside(p1) || !inside(p2)) return false;
        const l1 = levelAt(p1), l2 = levelAt(p2);
        return l1 !== null && l2 !== null && Math.abs(l1 - l2) >= 0.3;
      });
      if (!differs) continue;
      const c = dot(n, a);
      // A LoD2.2 edge running along the survey outline (a few cm inside it) is the outline itself: splitting there
      // only leaves a zero-width sliver whose closure wall the chunk then loses.
      if (footEdges.some(([p, q]) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return l > 0.3 && Math.abs((q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1]) / l < 0.035 && Math.abs(dot(n, p) - c) < 0.1 && Math.abs(dot(n, q) - c) < 0.1; })) continue;
      // Through a footprint corner within 2 cm (see the knot snap above).
      const via = corners.find(q => Math.abs(dot(n, q) - c) < 0.02 && depth(q) > wingCut - 0.05), cc = via ? dot(n, via) : c;
      if (!lines.some(l => Math.abs(dot(l.n, n)) > 0.9998 && Math.abs(l.c * Math.sign(dot(l.n, n)) - cc) < 0.05)) lines.push({n, c: cc});
    }
    const fallback = quantile(samples.filter(x => x.d > wingCut).map(x => Math.max(o.wingMinM, Math.min(wingCapE, x.h))), 0.5);
    const byLevel = new Map<number, number>(), wingPieces: {ring: number[][]; level: number; width: number}[] = [];
    for (const tri of footTris) {
      let pieces = [clipBand(tri, depth, wingCut, Infinity)].filter(q => q.length >= 3);
      for (const l of lines) pieces = pieces.flatMap(q => [clipBand(q, p => dot(l.n, p) - l.c, -Infinity, 0), clipBand(q, p => dot(l.n, p) - l.c, 0, Infinity)]).filter(q => q.length >= 3 && Math.abs(planArea(q)) > 1e-9);
      for (const q of pieces) {
        const c = [q.reduce((a, p) => a + p[0], 0) / q.length, q.reduce((a, p) => a + p[1], 0) / q.length];
        const longest = Math.max(...q.map((p, i) => Math.hypot(q[(i + 1) % q.length][0] - p[0], q[(i + 1) % q.length][1] - p[1])));
        wingPieces.push({ring: q, level: r3(levelAt(c) ?? levelNear(c) ?? (Number.isFinite(fallback) ? fallback : E)), width: 2 * Math.abs(planArea(q)) / longest});
      }
    }
    // Slivers (near-collinear outline vertices make cm-wide footprint triangles) take the level of the wider piece they
    // share their longest edge with: sampled on their own they fall outside LoD2.2 and could open a gap in the outline.
    const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
    for (const sl of wingPieces.filter(x => x.width < 0.05)) {
      const r = sl.ring;
      let best: {level: number; len: number} | null = null;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (const o of wingPieces) if (o !== sl && o.width >= 0.05 && o.ring.some((p, k) => near(p, b) && near(o.ring[(k + 1) % o.ring.length], a)) && (!best || len > best.len)) best = {level: o.level, len};
      }
      if (best) sl.level = best.level;
    }
    for (const w of wingPieces) {
      push(w.ring, () => w.level, `wing-${w.level}`);
      byLevel.set(w.level, (byLevel.get(w.level) ?? 0) + Math.abs(planArea(w.ring)));
    }
    for (const [heightM, areaM2] of [...byLevel].sort((a, b) => b[1] - a[1])) wings.push({areaM2: r3(areaM2), heightM});
    if (lines.length) notes.push(`${lines.length} rear step line(s) from 3DBAG`);
  }
  const isCorner = (p: number[]) => corners.some(c => c === p || (Math.abs(c[0] - p[0]) < 1e-9 && Math.abs(c[1] - p[1]) < 1e-9));
  for (const {h, pieces} of planes.values()) for (const m of mergeCoplanar(pieces, isCorner)) emit(m.ring, h, m.parts);
  if (droppedM2 > 1e-4) notes.push(`${droppedM2.toExponential(1)} m2 of sub-0.1-dm2 slivers dropped`);
  if (!input.forms) {
    const out: BuildingFacts = {...facts, roofsRD, roofSource: {kind: 'recipe', surveyRoofMaxM: surveyMaxM, capM: r3(capM)}};
    return {facts: out, report: {pandId: facts.pandId, form: ridge - E < 0.05 ? 'flat' : 'attic', eavesM: r3(E), ridgeM: ridge, capM: r3(capM), surveyMaxM: r3(surveyMaxM), atticM: r3(attic), mainDepthM: r3(mainDepth), plotDepthM: r3(plotDepth), wings, surfacesBefore: facts.roofsRD.length, surfacesAfter: roofsRD.length, notes}};
  }
  // Front forms: the crown line is the highest line any band may reach (the gate `height-vs-3dbag` bounds the model by it).
  const lineOf = (b: typeof shaped[number]) => b.spec?.lineM ?? b.ridge;
  const crownTopM = r3(Math.max(...shaped.map(lineOf))), ridgeTop = r3(Math.max(...shaped.map(b => b.ridge)));
  const forms = Object.fromEntries(shaped.map(b => [b.id ?? input.frontId ?? 'front0', b.form]));
  const formSet = new Set(shaped.map(b => b.form)), form = formSet.size === 1 ? shaped[0].form : 'mixed';
  const out: BuildingFacts = {...facts, roofsRD, roofSource: {kind: 'front', surveyRoofMaxM: surveyMaxM, capM: r3(capM), crownTopM, forms}};
  return {facts: out, report: {pandId: facts.pandId, form, eavesM: r3(E), ridgeM: ridgeTop, capM: r3(capM), surveyMaxM: r3(surveyMaxM), atticM: r3(attic), mainDepthM: r3(mainDepth), plotDepthM: r3(plotDepth), wings, surfacesBefore: facts.roofsRD.length, surfacesAfter: roofsRD.length, notes,
    bands: shaped.map(b => ({id: b.id ?? input.frontId ?? 'front0', form: b.form, eavesM: r3(b.eaves), ridgeM: b.ridge, ...(b.form !== 'flat' ? {pitchDeg: b.pitch} : {}), ...(b.form === 'saddle' ? {sideEavesM: r3(b.spec?.sideEavesM ?? (b.ridge - b.tan * c0(b)))} : {})})), crownTopM}};
  function c0(b: typeof shaped[number]) { return Math.max(b.centre - (Number.isFinite(b.lo) ? b.lo : along(front.endpointsRD[0])), (Number.isFinite(b.hi) ? b.hi : along(front.endpointsRD[1])) - b.centre); }
}
