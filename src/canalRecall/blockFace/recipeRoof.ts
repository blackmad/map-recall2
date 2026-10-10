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
};

export interface RecipeRoofReport {
  pandId: string;
  form: 'attic' | 'flat';
  eavesM: number;
  /** Top of the generated main roof, and the 3DBAG main-body cap (p95) and absolute max it was bounded by. */
  ridgeM: number; capM: number; surveyMaxM: number;
  atticM: number; mainDepthM: number; plotDepthM: number;
  /** Flat rear-wing surfaces (from 3DBAG's partition): plan area and height. */
  wings: {areaM2: number; heightM: number}[];
  surfacesBefore: number; surfacesAfter: number;
  notes: string[];
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
 * Union coplanar pieces across shared edges into simple polygons (each merge keeps the union simple), then drop
 * collinear vertices that are not footprint corners (`corner`). Pieces cut from one footprint triangulation share
 * their interior edges exactly; merging removes them, so a plane is a few polygons rather than dozens of clipped
 * triangles (fewer roof triangles, and no chord slivers left beside the outline). Returns each polygon with the pieces
 * it was made of (the fallback when its own triangulation fails).
 */
export function mergeCoplanar(pieces: number[][][], corner: (p: number[]) => boolean, tol = 1e-7): {ring: number[][]; parts: number[][][]}[] {
  const same = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
  let out = pieces.filter(r => r.length >= 3 && Math.abs(planArea(r)) > 1e-12).map(r => { const ring = planArea(r) < 0 ? [...r].reverse() : r; return {ring, parts: [ring]}; });
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const A = out[i].ring, B = out[j].ring;
      for (let a = 0; a < A.length; a++) {
        const p = A[a], q = A[(a + 1) % A.length];
        const b = B.findIndex((v, k) => same(v, q) && same(B[(k + 1) % B.length], p));
        if (b < 0) continue;
        const ra = [...A.slice((a + 1) % A.length), ...A.slice(0, (a + 1) % A.length)]; // q ... p
        const rb = [...B.slice((b + 1) % B.length), ...B.slice(0, (b + 1) % B.length)]; // p ... q
        const ring = [...ra, ...rb.slice(1, -1)];
        if (!simple(ring)) continue;
        out[i] = {ring, parts: [...out[i].parts, ...out[j].parts]};
        out.splice(j, 1);
        merged = true;
        break outer;
      }
    }
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

/** The main-body profile h(d): (a flat gutter `setbackM` deep,) steep up, flat top, steep down; knots [d, h]. */
export function atticProfile(eavesM: number, ridgeM: number, mainDepthM: number, pitchDeg: number, setbackM = 0): [number, number][] {
  if (ridgeM - eavesM < 0.05) return [[0, eavesM], [mainDepthM, eavesM]];
  const run = (ridgeM - eavesM) / Math.tan(pitchDeg * Math.PI / 180);
  return [[0, eavesM], ...(setbackM > 0 ? [[setbackM, eavesM] as [number, number]] : []), [setbackM + run, ridgeM], [mainDepthM - run, ridgeM], [mainDepthM, eavesM]];
}

/**
 * Replace a pand's 3DBAG roof with the recipe roof. `facts` are the pand's facts as the face compile fits them (front
 * snaps, shared ground, measured eaves, roofCleanup applied).
 */
export function recipeRoofFacts(facts: BuildingFacts, input: RecipeRoofInput, opts: Partial<typeof RECIPE_ROOF> = {}): {facts: BuildingFacts; report: RecipeRoofReport} {
  const o = {...RECIPE_ROOF, ...opts}, ground = facts.heights.groundNAP, notes: string[] = [];
  const front = facts.fronts.find(f => f.street === input.street) ?? facts.fronts[0];
  const e0 = front.endpointsRD[0], nl = Math.hypot(front.outwardNormalRD[0], front.outwardNormalRD[1]);
  const inward = [-front.outwardNormalRD[0] / nl, -front.outwardNormalRD[1] / nl];
  const depth = (p: number[]) => dot([p[0] - e0[0], p[1] - e0[1]], inward);
  const E = input.eavesM;

  // 3DBAG samples over the footprint, binned by depth.
  const polys = facts.surveyFootprintPolygonsRD;
  const inside = (p: number[]) => polys.some(poly => pointInRing(p, poly[0]) && !poly.slice(1).some(h => pointInRing(p, h)));
  const all = polys.flatMap(p => p.flat()), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const samples: {d: number; h: number}[] = [];
  for (let x = Math.min(...xs) + o.sampleM / 2; x < Math.max(...xs); x += o.sampleM) for (let y = Math.min(...ys) + o.sampleM / 2; y < Math.max(...ys); y += o.sampleM) {
    if (!inside([x, y])) continue;
    const h = roofHeightAt(facts.roofsRD, [x, y], ground);
    if (h !== null) samples.push({d: depth([x, y]), h});
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
  const profile = atticProfile(E, ridge, mainDepth, o.frontPitchDeg, setback);
  // A cut within 2 cm of a footprint corner passes through it: a sub-mm miss leaves slivers that invert when snapped.
  const cornerDepths = polys.flatMap(poly => poly.flat()).map(depth);
  for (const k of profile) { const near = cornerDepths.find(d => Math.abs(d - k[0]) < 0.02); if (near !== undefined && k[0] > 0) k[0] = near; }
  // Knots within 2 cm of each other (a pitch whose faces meet with no flat top) become one: a corner snap moving only
  // one of them would order them backwards and the bands between would overlap (marnix-124-138 at 30 degrees).
  for (let i = 1; i < profile.length; i++) if (profile[i][0] - profile[i - 1][0] < 0.02) profile[i][0] = profile[i - 1][0];
  const knots = profile.map(p => p[0]);
  const heightIn = (k: number, d: number) => { const [d0, h0] = profile[k], [d1, h1] = profile[k + 1]; return d1 - d0 < 1e-9 ? h0 : h0 + (h1 - h0) * (d - d0) / (d1 - d0); };

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
  const corners = polys.flatMap(poly => poly.flat());
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
  for (const tri of footTris) {
    // An outline that wanders a few mm either side of the frontage line is not cut there: the cut would leave a
    // metres-long mm-wide sliver along the front that the snaps turn into overlaps (marnix-124-138 at 30 degrees).
    const lead = Math.min(...tri.map(depth)) > -0.02;
    if (!lead) push(clipBand(tri, depth, -Infinity, Math.min(0, wingCut)), () => E, 'front');
    for (let k = 0; k + 1 < knots.length; k++) {
      const lo = k === 0 && lead ? -Infinity : knots[k], hi = k + 2 === knots.length ? wingCut : knots[k + 1];
      if (hi - lo < 1e-9) continue;
      push(clipBand(tri, depth, lo, hi), p => heightIn(k, Math.max(knots[k], Math.min(depth(p), knots[k + 1]))), `main-${k}`);
    }
  }
  // Rear wings: the footprint behind mainDepth, split along the lines where 3DBAG steps between flat levels (each
  // 3DBAG surface flattened to its median, never above the eaves); each piece takes the level 3DBAG has at its centre.
  // Splitting the footprint (not clipping 3DBAG's own rings) keeps the partition exact: LoD2.2 rings differ from the
  // survey ground by fractions of a millimetre, enough to break the library's area check once clipped.
  const wings: RecipeRoofReport['wings'] = [];
  if (wingCut < Infinity) {
    const levelOf = (sf: BuildingFacts['roofsRD'][number]) => Math.max(o.wingMinM, Math.min(E, quantile((sf.ringsRD?.[0] ?? sf.vertices).map(v => v[2] - ground), 0.5)));
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
    const fallback = quantile(samples.filter(x => x.d > wingCut).map(x => Math.max(o.wingMinM, Math.min(E, x.h))), 0.5);
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
  const out: BuildingFacts = {...facts, roofsRD, roofSource: {kind: 'recipe', surveyRoofMaxM: surveyMaxM, capM: r3(capM)}};
  return {facts: out, report: {pandId: facts.pandId, form: ridge - E < 0.05 ? 'flat' : 'attic', eavesM: r3(E), ridgeM: ridge, capM: r3(capM), surveyMaxM: r3(surveyMaxM), atticM: r3(attic), mainDepthM: r3(mainDepth), plotDepthM: r3(plotDepth), wings, surfacesBefore: facts.roofsRD.length, surfacesAfter: roofsRD.length, notes}};
}
