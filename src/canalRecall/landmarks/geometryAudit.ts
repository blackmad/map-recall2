/**
 * Landmark geometry audit: three mechanical checks that catch what reviewers kept finding by eye.
 *
 *  1. Detached openings (`auditOpenings`): window/door frames, panes, sills, shutters and trim that do not touch the
 *     wall they belong to: floating in front of it, buried behind its surface, or hanging past a wall end / corner
 *     (Oude Lutherse Kerk, 2026-10-10: tracery windows past the gable's edge, axis-aligned side windows half inside a
 *     skewed wall).
 *  2. Window rhythm (`auditRhythm`): per facade elevation, openings in one storey row should share size, sill and head;
 *     columns should align across storeys; a gap where the row's spacing predicts a window is a missing opening.
 *     Irregular facades exist, so these are review warnings, never failures.
 *  3. Coplanar z-fighting (`auditZFight`): same-facing coplanar triangles from different parts overlapping by more than a
 *     sliver (H'ART front roof, Rijksmuseum entrance canopy). Same measure as the block-face `zFightArea` (abutment
 *     shrink, convex clip; a test pins the two together) but returning the overlap polygon so hidden overlaps
 *     (inside another solid) can be told from visible ones, plus a near-coplanar band (1-3 cm apart) that z-fights at street distance on a 24-bit depth buffer.
 *
 * Input is a material soup (one material per triangle) in the GLB's native frame: x east, y up, z south, metres.
 * Pure geometry, no I/O: `scripts/audit-glb-quality.ts` loads GLBs, ranks models and gates against a baseline.
 */
import {clusterWalls, type WallSegment} from './wallPlanes';
import {measureFacade, type FacadeInventory, type MaterialSoup, type Opening} from './facadeCompare';
import {pointTriangleDistSq, rayTriangle, type TriSoup} from './glbQuality';

type V3 = [number, number, number];

export interface GeometryAuditThresholds {
  /** Vertex weld (m) when splitting the model into parts. */
  weld: number;
  /** An opening part closer than this (m) to the wall/host geometry touches it. */
  touchTol: number;
  /** Floating gap (m) beyond which a detached opening is a hard problem (visible shadow line / halo). */
  floatFail: number;
  /** Fraction of an opening's face projected outside its wall's silhouette that counts as overhanging. */
  overhangWarn: number;
  overhangFail: number;
  /** Fraction of an opening's face hidden behind the solid wall surface (not a hole) that counts as buried. */
  buriedWarn: number;
  /** Opening parts larger than this (bbox diagonal, m) are treated as host geometry (walls, roofs). */
  maxOpeningDiag: number;
  /** Coplanar plane tolerance (m) and abutment shrink (m) for z-fighting. */
  zPlaneTol: number;
  zAbut: number;
  /** Near-coplanar band (m): parallel same-facing faces this close z-fight at distance on a 24-bit depth buffer. */
  zNearTol: number;
  /** Total coplanar overlap area (m^2) that warns / fails. */
  zWarnArea: number;
  zFailArea: number;
}

export const GEOMETRY_THRESHOLDS: GeometryAuditThresholds = {
  weld: 0.001, touchTol: 0.03, floatFail: 0.1, overhangWarn: 0.12, overhangFail: 0.35, buriedWarn: 0.3,
  maxOpeningDiag: 14, zPlaneTol: 0.01, zAbut: 0.005, zNearTol: 0.03, zWarnArea: 0.25, zFailArea: 2,
};

/** Materials that make up openings and their trim. Kits glaze in `glass`/`dark`, frame in `frame`/`white`. */
export const OPENING_MATERIAL = /^(glass|frame|door|louvre|blind|white|dark|greyframe|shutter|sash|pane|window)/i;

export interface OpeningIssue {
  kind: 'floating' | 'overhang' | 'buried';
  severity: 'fail' | 'warn';
  /** Materials in the assembly. */
  materials: string[];
  min: V3; max: V3; centre: V3;
  /** Closest distance (m) from the assembly to any non-opening geometry. */
  gap: number;
  /** Fraction of the face samples outside the wall silhouette / hidden behind the wall surface. */
  outside: number;
  buried: number;
  wallBearing?: number;
  triangles: number[];
}

export interface ZFightPatch {
  area: number;
  /** Coplanar (≤ zPlaneTol) or near-coplanar (≤ zNearTol). */
  near: boolean;
  orientation: 'roof' | 'wall' | 'underside';
  normal: V3;
  materials: [string, string];
  centre: V3;
  min: V3; max: V3;
  y: number;
  trisA: number[]; trisB: number[];
  /** Area-weighted random overlap centroids used for the visibility test (`area` holds the reservoir key). */
  samples: {p: V3; area: number}[];
  /** Every sampled overlap point lies inside another closed part: never rendered, so not counted. */
  hidden: boolean;
  /** Overlap before the visibility weighting (`area` is the visible share). */
  rawArea?: number;
}

export interface RhythmFacade {
  name: string;
  bearing: number;
  fromSpec: boolean;
  openings: number;
  rows: {y: number; count: number; medianW: number; medianH: number; odd: number}[];
  mismatched: Opening[];
  missing: {t: number; y0: number; y1: number}[];
  misaligned: number;
  specRows?: number[];
}

export interface GeometryFinding { kind: string; severity: 'fail' | 'warn'; message: string }

export interface GeometryAuditReport {
  openings: {assemblies: number; issues: OpeningIssue[]};
  zfight: {area: number; nearArea: number; hiddenArea: number; patches: ZFightPatch[]};
  rhythm: RhythmFacade[];
  /** Per-kind counts used by the baseline gate. */
  counts: Record<string, number>;
  findings: GeometryFinding[];
  score: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Shared helpers

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function triVerts(s: MaterialSoup, t: number): [V3, V3, V3] {
  const P = s.positions, I = s.indices;
  const v = (k: number): V3 => [P[I[t * 3 + k] * 3], P[I[t * 3 + k] * 3 + 1], P[I[t * 3 + k] * 3 + 2]];
  return [v(0), v(1), v(2)];
}

function triNormal(a: V3, b: V3, c: V3): {n: V3; area: number} {
  const n = cross(sub(b, a), sub(c, a)), l = Math.hypot(n[0], n[1], n[2]);
  return {n: l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 0], area: l / 2};
}

/** Welded vertex id per vertex (rounded position at `weld` metres). */
function weldIds(s: MaterialSoup, weld: number): {vid: Int32Array; ids: number} {
  const P = s.positions;
  // Nested maps keep the key collision-free without string building.
  const key = new Map<number, Map<number, number>>();
  const vid = new Int32Array(P.length / 3);
  let ids = 0;
  for (let v = 0; v < vid.length; v++) {
    const kx = Math.round(P[v * 3] / weld), ky = Math.round(P[v * 3 + 1] / weld), kz = Math.round(P[v * 3 + 2] / weld);
    const k1 = kx * 1e7 + ky;
    let m = key.get(k1); if (!m) { m = new Map(); key.set(k1, m); }
    let id = m.get(kz);
    if (id === undefined) { id = ids++; m.set(kz, id); }
    vid[v] = id;
  }
  return {vid, ids};
}

/** Connected parts: triangles sharing a welded vertex. Returns a part id per triangle. */
export function partsOf(s: MaterialSoup, weld = 0.001): Int32Array {
  const nTri = s.indices.length / 3;
  const {vid, ids} = weldIds(s, weld);
  const parent = new Int32Array(ids).map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < nTri; t++) {
    const a = find(vid[s.indices[t * 3]]), b = find(vid[s.indices[t * 3 + 1]]), c = find(vid[s.indices[t * 3 + 2]]);
    parent[a] = c; parent[find(b)] = c;
  }
  const out = new Int32Array(nTri);
  for (let t = 0; t < nTri; t++) out[t] = find(vid[s.indices[t * 3]]);
  return out;
}

/** Parts whose welded edges all pair up (closed solids): only these can hide a surface inside them. */
export function closedParts(s: MaterialSoup, part: Int32Array, weld = 0.001): Set<number> {
  const {vid, ids} = weldIds(s, weld);
  const edges = new Map<number, Map<number, number>>();
  const bad = new Set<number>(), seen = new Set<number>();
  const nTri = s.indices.length / 3;
  for (let t = 0; t < nTri; t++) {
    seen.add(part[t]);
    for (let k = 0; k < 3; k++) {
      const a = vid[s.indices[t * 3 + k]], b = vid[s.indices[t * 3 + (k + 1) % 3]];
      if (a === b) continue;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      let m = edges.get(lo); if (!m) { m = new Map(); edges.set(lo, m); }
      m.set(hi, (m.get(hi) ?? 0) + 1);
    }
  }
  // Edge counts are per part implicitly (welded vertices belong to one part).
  const vPart = new Int32Array(ids);
  for (let t = 0; t < nTri; t++) for (let k = 0; k < 3; k++) vPart[vid[s.indices[t * 3 + k]]] = part[t];
  for (const [lo, m] of edges) for (const c of m.values()) if (c % 2) bad.add(vPart[lo]);
  return new Set([...seen].filter(p => !bad.has(p)));
}

/** Uniform grid over triangle AABBs for proximity queries (numeric cell keys; |coordinate| < 500 m). */
class TriGrid {
  private cells = new Map<number, number[]>();
  readonly box: Float64Array;
  private static key = (x: number, y: number, z: number) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  constructor(private s: MaterialSoup, tris: number[], private cell = 1) {
    this.box = new Float64Array((s.indices.length / 3) * 6);
    for (const t of tris) {
      const [a, b, c] = triVerts(s, t);
      for (let k = 0; k < 3; k++) { this.box[t * 6 + k] = Math.min(a[k], b[k], c[k]); this.box[t * 6 + 3 + k] = Math.max(a[k], b[k], c[k]); }
      const lo = [0, 1, 2].map(k => Math.floor(this.box[t * 6 + k] / cell)), hi = [0, 1, 2].map(k => Math.floor(this.box[t * 6 + 3 + k] / cell));
      if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 20000) continue; // pathological sliver
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
        const k = TriGrid.key(x, y, z); const l = this.cells.get(k); if (l) l.push(t); else this.cells.set(k, [t]);
      }
    }
  }
  /** Triangles whose AABB intersects [min, max]. */
  near(min: V3, max: V3): number[] {
    const out = new Set<number>(), c = this.cell, B = this.box;
    for (let x = Math.floor(min[0] / c); x <= Math.floor(max[0] / c); x++) for (let y = Math.floor(min[1] / c); y <= Math.floor(max[1] / c); y++) for (let z = Math.floor(min[2] / c); z <= Math.floor(max[2] / c); z++) {
      for (const t of this.cells.get(TriGrid.key(x, y, z)) ?? []) {
        if (out.has(t)) continue;
        if (B[t * 6] > max[0] || B[t * 6 + 3] < min[0] || B[t * 6 + 1] > max[1] || B[t * 6 + 4] < min[1] || B[t * 6 + 2] > max[2] || B[t * 6 + 5] < min[2]) continue;
        out.add(t);
      }
    }
    return [...out];
  }
}

function bboxOf(s: MaterialSoup, tris: number[]): {min: V3; max: V3} {
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const v of triVerts(s, t)) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
  return {min, max};
}

const centreOf = (b: {min: V3; max: V3}): V3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];

/** Points spread over a triangle at roughly `step` spacing (always includes the centroid). */
function samplesOn(a: V3, b: V3, c: V3, step: number): V3[] {
  const l = Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, a)), Math.hypot(...sub(c, b)));
  const n = Math.min(24, Math.max(1, Math.ceil(l / step)));
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) {
    const u = (i + 1 / 3) / (n + 1), v = (j + 1 / 3) / (n + 1);
    if (u + v > 1) continue;
    out.push([a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]), a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]), a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2])]);
  }
  return out;
}

function asTriSoup(s: MaterialSoup, tris: number[]): TriSoup {
  const idx = new Uint32Array(tris.length * 3);
  tris.forEach((t, i) => { idx[i * 3] = s.indices[t * 3]; idx[i * 3 + 1] = s.indices[t * 3 + 1]; idx[i * 3 + 2] = s.indices[t * 3 + 2]; });
  return {positions: s.positions instanceof Float32Array ? s.positions : new Float32Array(s.positions), indices: idx};
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Detached openings

interface WallRaster { seg: WallSegment; cell: number; u0: number; v0: number; nu: number; nv: number; occ: Uint8Array; colLo: Float64Array; colHi: Float64Array; tris: Set<number> }

function rasterWall(s: MaterialSoup, seg: WallSegment, hostTris: number[], cell = 0.1): WallRaster {
  const u0 = seg.uMin - cell, v0 = seg.vMin - cell, nu = Math.ceil((seg.uMax - seg.uMin) / cell) + 3, nv = Math.ceil((seg.vMax - seg.vMin) / cell) + 3;
  const occ = new Uint8Array(nu * nv);
  for (const ti of seg.tris) {
    const t = hostTris[ti];
    const p = triVerts(s, t).map(v => [(v[0] * seg.t[0] + v[2] * seg.t[1] - u0) / cell, (v[1] - v0) / cell]);
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(nu - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(nv - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      const w0 = ((p[1][0] - sx) * (p[2][1] - sy) - (p[2][0] - sx) * (p[1][1] - sy)) / area;
      const w1 = ((p[2][0] - sx) * (p[0][1] - sy) - (p[0][0] - sx) * (p[2][1] - sy)) / area;
      if (w0 >= -1e-6 && w1 >= -1e-6 && 1 - w0 - w1 >= -1e-6) occ[y * nu + x] = 1;
    }
  }
  const colLo = new Float64Array(nu).fill(Infinity), colHi = new Float64Array(nu).fill(-Infinity);
  for (let x = 0; x < nu; x++) for (let y = 0; y < nv; y++) if (occ[y * nu + x]) { colLo[x] = Math.min(colLo[x], v0 + y * cell); colHi[x] = Math.max(colHi[x], v0 + (y + 1) * cell); }
  return {seg, cell, u0, v0, nu, nv, occ, colLo, colHi, tris: new Set(seg.tris.map(i => hostTris[i]))};
}

/** Is (u, v) inside the wall's silhouette (holes ignored), within `tol` metres? */
function inSilhouette(w: WallRaster, u: number, v: number, tol: number): boolean {
  const r = Math.ceil(tol / w.cell), x = Math.floor((u - w.u0) / w.cell);
  for (let dx = -r; dx <= r; dx++) {
    const xx = x + dx;
    if (xx < 0 || xx >= w.nu) continue;
    if (v >= w.colLo[xx] - tol && v <= w.colHi[xx] + tol) return true;
  }
  return false;
}

/** Is the wall surface solid at (u, v) (not a cut hole)? */
function solidAt(w: WallRaster, u: number, v: number): boolean {
  const x = Math.floor((u - w.u0) / w.cell), y = Math.floor((v - w.v0) / w.cell);
  return x >= 0 && y >= 0 && x < w.nu && y < w.nv && !!w.occ[y * w.nu + x];
}

export function auditOpenings(s: MaterialSoup, th: GeometryAuditThresholds = GEOMETRY_THRESHOLDS, part = partsOf(s, th.weld)): {assemblies: number; issues: OpeningIssue[]} {
  const nTri = s.indices.length / 3;
  const isOpeningMat = s.materials.map(m => OPENING_MATERIAL.test(m.name));
  // Parts by id.
  const parts = new Map<number, number[]>();
  for (let t = 0; t < nTri; t++) { const l = parts.get(part[t]); if (l) l.push(t); else parts.set(part[t], [t]); }
  const openingParts: {tris: number[]; min: V3; max: V3}[] = [];
  const host: number[] = [];
  for (const tris of parts.values()) {
    const allOpening = tris.every(t => isOpeningMat[s.triMaterial[t]]);
    const bb = bboxOf(s, tris);
    const diag = Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]);
    if (allOpening && diag <= th.maxOpeningDiag) openingParts.push({tris, ...bb}); else host.push(...tris);
  }
  if (!openingParts.length || !host.length) return {assemblies: 0, issues: []};

  // Assemblies: opening parts whose boxes touch (pane in frame, sill under frame, tracery bars in an arch).
  const pp = openingParts.map((_, i) => i);
  const findA = (a: number): number => { while (pp[a] !== a) { pp[a] = pp[pp[a]]; a = pp[a]; } return a; };
  const tol = th.touchTol;
  const order = openingParts.map((p, i) => i).sort((a, b) => openingParts[a].min[0] - openingParts[b].min[0]);
  for (let ii = 0; ii < order.length; ii++) {
    const A = openingParts[order[ii]];
    for (let jj = ii + 1; jj < order.length; jj++) {
      const B = openingParts[order[jj]];
      if (B.min[0] > A.max[0] + tol) break;
      if (B.min[1] > A.max[1] + tol || A.min[1] > B.max[1] + tol || B.min[2] > A.max[2] + tol || A.min[2] > B.max[2] + tol) continue;
      pp[findA(order[ii])] = findA(order[jj]);
    }
  }
  const groups = new Map<number, number[]>();
  openingParts.forEach((p, i) => { const r = findA(i); const l = groups.get(r); if (l) l.push(...p.tris); else groups.set(r, [...p.tris]); });

  // Gap is measured to everything else in the model (walls and other trim), so a pane 3 cm proud of its tracery reads as 3 cm.
  const grid = new TriGrid(s, Array.from({length: nTri}, (_, i) => i), 1);
  const hostSoup = asTriSoup(s, host);
  // Walls: vertical host planes at least 1 m tall and wide (rails, cornices and copings are not walls).
  const walls = clusterWalls(hostSoup, {outwardOnly: false, minArea: 1.5, splitGap: 0.6}).filter(w => w.vMax - w.vMin >= 1 && w.uMax - w.uMin >= 1);
  const rasters = new Map<WallSegment, WallRaster>();
  const raster = (w: WallSegment) => { let r = rasters.get(w); if (!r) { r = rasterWall(s, w, host); rasters.set(w, r); } return r; };

  const issues: OpeningIssue[] = [];
  for (const tris of groups.values()) {
    const bb = bboxOf(s, tris), c = centreOf(bb);
    // Gap to host geometry: vertex-to-triangle distance, zero when an assembly edge pierces a host triangle.
    const near = grid.near([bb.min[0] - 0.6, bb.min[1] - 0.6, bb.min[2] - 0.6], [bb.max[0] + 0.6, bb.max[1] + 0.6, bb.max[2] + 0.6]);
    const own = new Set(tris);
    const blocked = (o: V3, d: V3, skip: Set<number>, L = 1.5): boolean => {
      const e: V3 = [o[0] + d[0] * L, o[1] + d[1] * L, o[2] + d[2] * L];
      for (const t of grid.near([Math.min(o[0], e[0]), Math.min(o[1], e[1]), Math.min(o[2], e[2])], [Math.max(o[0], e[0]), Math.max(o[1], e[1]), Math.max(o[2], e[2])])) {
        if (skip.has(t)) continue;
        const [a, b, c] = triVerts(s, t);
        if (rayTriangle(o, d, a, b, c, L) >= 0) return true;
      }
      return false;
    };
    const nearTris = near.filter(t => !own.has(t)).map(t => triVerts(s, t));
    let gapSq = Infinity;
    const verts: V3[] = [];
    for (const t of tris) verts.push(...triVerts(s, t));
    vloop: for (const v of verts) for (const h of nearTris) { const d = pointTriangleDistSq(v, h[0], h[1], h[2]); if (d < gapSq) { gapSq = d; if (gapSq <= tol * tol) break vloop; } }
    if (gapSq > tol * tol) {
      outer: for (const t of tris) {
        const [a, b, cc] = triVerts(s, t);
        for (const [p, q] of [[a, b], [b, cc], [cc, a]] as [V3, V3][]) {
          const d = sub(q, p), L = Math.hypot(d[0], d[1], d[2]);
          if (!(L > 0)) continue;
          const dir: V3 = [d[0] / L, d[1] / L, d[2] / L];
          for (const h of nearTris) if (rayTriangle(p, dir, h[0], h[1], h[2], L) >= 0) { gapSq = 0; break outer; }
        }
      }
    }
    const hostGap = Number.isFinite(gapSq) ? Math.sqrt(gapSq) : 99;
    // Standing on the ground without touching the building: a freestanding railing or gate, not an opening.
    if (bb.min[1] <= 0.02 && hostGap > tol) continue;
    // Nothing at all within 0.6 m: free-standing glazing (a curtain-wall panel, a glass canopy), not a window that
    // came off its wall. Real detached windows stand centimetres to decimetres off.
    if (hostGap > 0.6) continue;
    const gap = hostGap;
    // Facing axis: principal direction of the area-weighted horizontal normals (sign-free, so a box's front and back agree).
    let mxx = 0, mxz = 0, mzz = 0;
    for (const t of tris) {
      const [a, b, cc] = triVerts(s, t), {n, area} = triNormal(a, b, cc);
      if (Math.abs(n[1]) > 0.7) continue;
      mxx += area * n[0] * n[0]; mxz += area * n[0] * n[2]; mzz += area * n[2] * n[2];
    }
    const ang = 0.5 * Math.atan2(2 * mxz, mxx - mzz), axis: [number, number] = [Math.cos(ang), Math.sin(ang)];
    const axisStrength = (mxx + mzz) > 0 ? Math.hypot(mxx - mzz, 2 * mxz) / (mxx + mzz) : 0;

    // Walls this assembly belongs to: vertical host planes within 0.8 m of it whose extent overlaps it. The plane
    // facing the nearest one wins the orientation; every parallel plane in that band counts as wall behind the opening
    // (a window on a pilaster, a buttress or a recessed bay is still on a wall).
    const cands: {w: WallSegment; sd: number}[] = [];
    for (const w of walls) {
      if (axisStrength > 0.3 && Math.abs(w.n[0] * axis[0] + w.n[1] * axis[1]) < 0.94) continue;
      const sds = [[bb.min[0], bb.min[2]], [bb.max[0], bb.min[2]], [bb.min[0], bb.max[2]], [bb.max[0], bb.max[2]]].map(([x, z]) => w.n[0] * x + w.n[1] * z - w.d);
      const lo = Math.min(...sds), hi = Math.max(...sds);
      if (hi < -0.8 || lo > 0.8) continue;
      const us = [[bb.min[0], bb.min[2]], [bb.max[0], bb.min[2]], [bb.min[0], bb.max[2]], [bb.max[0], bb.max[2]]].map(([x, z]) => x * w.t[0] + z * w.t[1]);
      if (Math.max(...us) < w.uMin - 0.3 || Math.min(...us) > w.uMax + 0.3 || bb.max[1] < w.vMin - 0.3 || bb.min[1] > w.vMax + 0.3) continue;
      // Prefer a plane the opening stands on or in front of; a plane it lies wholly behind is usually the inner face of a
      // thin shell (a drum, a tower wall) and only wins when nothing better exists.
      cands.push({w, sd: Math.max(0, lo, -hi) + (hi < 0.02 ? 5 : 0)});
    }
    cands.sort((p, q) => p.sd - q.sd);
    // A grounded part only belongs to a wall it stands against (railings and gates stand off it).
    const best = cands[0] && (bb.min[1] > 0.02 || cands[0].sd <= 0.25) ? cands[0].w : undefined;
    const group = best ? cands.filter(c => c.w.n[0] * best.n[0] + c.w.n[1] * best.n[1] > 0.985).map(c => c.w) : [];
    let outside = 0, buried = 0;
    if (best) {
      // Sample the assembly faces turned towards the wall's outside (the visible face of a window).
      let nS = 0, nOut = 0, nBur = 0;
      for (const t of tris) {
        const [a, b, cc] = triVerts(s, t), {n, area} = triNormal(a, b, cc);
        if (area < 1e-5 || n[0] * best.n[0] + n[2] * best.n[1] < 0.7) continue;
        for (const p of samplesOn(a, b, cc, 0.15)) {
          nS++;
          let inside = false, behind = false;
          for (const w of group) {
            const u = p[0] * w.t[0] + p[2] * w.t[1], sd = w.n[0] * p[0] + w.n[1] * p[2] - w.d;
            if (sd > 0.8 || sd < -0.8) continue;
            const r = raster(w);
            if (inSilhouette(r, u, p[1], 0.12)) inside = true;
            if (sd < -0.01 && solidAt(r, u, p[1])) behind = true;
          }
          // Behind the plane and covered by geometry within 1.5 m on the viewer's side: the face never shows.
          if (!inside) nOut++;
          else if (behind && blocked(p, [best.n[0], 0, best.n[1]], own)) nBur++;
        }
      }
      if (nS >= 4) { outside = nOut / nS; buried = nBur / nS; }
    }
    const mats = [...new Set(tris.map(t => s.materials[s.triMaterial[t]].name))].sort();
    const base = {materials: mats, min: bb.min, max: bb.max, centre: c, gap, outside: +outside.toFixed(2), buried: +buried.toFixed(2), wallBearing: best?.bearingDeg, triangles: tris};
    // A part sunk wholly inside the wall is buried, not floating, even though no wall surface touches it.
    if (buried > 0.5) issues.push({...base, kind: 'buried', severity: 'warn'});
    else if (gap > tol) issues.push({...base, kind: 'floating', severity: gap > th.floatFail ? 'fail' : 'warn'});
    else if (outside > th.overhangWarn) issues.push({...base, kind: 'overhang', severity: outside > th.overhangFail ? 'fail' : 'warn'});
    else if (buried > th.buriedWarn) issues.push({...base, kind: 'buried', severity: 'warn'});
  }
  return {assemblies: groups.size, issues: issues.sort((a, b) => issueWeight(b) - issueWeight(a))};
}

const extent = (i: {min: V3; max: V3}) => Math.hypot(i.max[0] - i.min[0], i.max[1] - i.min[1], i.max[2] - i.min[2]);
function issueWeight(i: OpeningIssue): number {
  const size = extent(i);
  return (i.severity === 'fail' ? 10 : 1) * size * (i.kind === 'floating' ? Math.min(1, i.gap) * 4 : i.kind === 'overhang' ? i.outside * 3 : i.buried);
}

/** Shrink a triangle toward its incentre by `abut` metres (zFightArea's abutment tolerance); null when it vanishes. */
function shrinkTri(p: V3[], abut: number): V3[] | null {
  if (!abut) return p;
  const d = (u: V3, v: V3) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  const la = d(p[1], p[2]), lb = d(p[0], p[2]), lc = d(p[0], p[1]), per = la + lb + lc;
  const area = triNormal(p[0], p[1], p[2]).area, r = (2 * area) / per;
  if (r <= abut) return null;
  const c = [0, 1, 2].map(k => (la * p[0][k] + lb * p[1][k] + lc * p[2][k]) / per), f = (r - abut) / r;
  return p.map(v => v.map((x, j) => c[j] + f * (x - c[j])) as V3);
}

/** Sutherland-Hodgman clip of convex polygon a by convex polygon b (2D). */
function clipConvex(a: number[][], b: number[][]): number[][] {
  let out = a;
  for (let i = 0; i < b.length && out.length; i++) {
    const p = b[i], q = b[(i + 1) % b.length], side = (v: number[]) => (q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]);
    const orient = Math.sign(side(b[(i + 2) % b.length])) || 1, input = out; out = [];
    for (let k = 0; k < input.length; k++) {
      const c = input[k], d = input[(k + 1) % input.length], sc = side(c) * orient, sd = side(d) * orient;
      if (sc >= 0) out.push(c);
      if ((sc >= 0) !== (sd >= 0)) { const t = sc / (sc - sd); out.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]); }
    }
  }
  return out;
}

/**
 * Overlap of two same-facing coplanar triangles after the abutment shrink: area (m^2, true 3D area) and the overlap
 * centroid on A's plane. Same measure as blockFace `zFightArea` for one pair.
 */
export function coplanarOverlap(pa: V3[], pb: V3[], n: V3, abut: number): {area: number; centroid: V3} | null {
  const a = shrinkTri(pa, abut), b = shrinkTri(pb, abut);
  if (!a || !b) return null;
  const ax = Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2]) ? [1, 2] : Math.abs(n[1]) > Math.abs(n[2]) ? [0, 2] : [0, 1];
  const drop = 3 - ax[0] - ax[1];
  const poly = clipConvex(a.map(v => [v[ax[0]], v[ax[1]]]), b.map(v => [v[ax[0]], v[ax[1]]]));
  if (poly.length < 3) return null;
  let s2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], c = p[0] * q[1] - q[0] * p[1];
    s2 += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
  }
  if (Math.abs(s2) < 1e-12) return null;
  const scale = 1 / Math.max(Math.abs(n[drop]), 1e-6);
  const centroid: V3 = [0, 0, 0];
  centroid[ax[0]] = cx / (3 * s2); centroid[ax[1]] = cy / (3 * s2);
  // Recover the dropped coordinate from A's plane.
  const dA = n[0] * pa[0][0] + n[1] * pa[0][1] + n[2] * pa[0][2];
  centroid[drop] = (dA - n[ax[0]] * centroid[ax[0]] - n[ax[1]] * centroid[ax[1]]) / (Math.abs(n[drop]) > 1e-6 ? n[drop] : 1);
  return {area: (Math.abs(s2) / 2) * scale, centroid};
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Coplanar z-fighting

export function auditZFight(s: MaterialSoup, th: GeometryAuditThresholds = GEOMETRY_THRESHOLDS, part = partsOf(s, th.weld)): {area: number; nearArea: number; hiddenArea: number; patches: ZFightPatch[]} {
  const nTri = s.indices.length / 3;
  interface T { i: number; p: V3[]; n: V3; d: number; area: number; min: V3; max: V3 }
  const tris: T[] = [];
  // Candidate pairs: same plane bin (azimuth, elevation, offset) and same 2 m spatial cell; a pair met in several cells
  // is tested once (stamp).
  const bins = new Map<number, Map<number, number[]>>();
  const D_BIN = 0.05, A_BIN = 2, C = 2;
  const AZN = 360 / A_BIN;
  const keyOf = (n: V3, d: number) => {
    const az = Math.round(((Math.atan2(n[0], n[2]) * 180) / Math.PI + 360) % 360 / A_BIN) % AZN, el = Math.round((Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180) / Math.PI / A_BIN);
    return [Math.abs(el * A_BIN) >= 88 ? 0 : az, el, Math.round(d / D_BIN)];
  };
  const planeKey = (az: number, el: number, db: number) => ((az * 128 + el + 64) * 1e6) + db + 5e5;
  const cellKey = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  const cellsOf = (t: T) => {
    const out: number[] = [];
    for (let x = Math.floor(t.min[0] / C); x <= Math.floor(t.max[0] / C); x++) for (let y = Math.floor(t.min[1] / C); y <= Math.floor(t.max[1] / C); y++) for (let z = Math.floor(t.min[2] / C); z <= Math.floor(t.max[2] / C); z++) out.push(cellKey(x, y, z));
    return out;
  };
  for (let t = 0; t < nTri; t++) {
    const p = triVerts(s, t), {n, area} = triNormal(p[0], p[1], p[2]);
    if (area < 1e-4) continue;
    const d = n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2];
    const min: V3 = [0, 1, 2].map(k => Math.min(p[0][k], p[1][k], p[2][k])) as V3, max: V3 = [0, 1, 2].map(k => Math.max(p[0][k], p[1][k], p[2][k])) as V3;
    const idx = tris.length;
    const T0: T = {i: t, p, n, d, area, min, max};
    tris.push(T0);
    const [az, el, db] = keyOf(n, d), pk = planeKey(az, el, db);
    let m = bins.get(pk); if (!m) { m = new Map(); bins.set(pk, m); }
    for (const ck of cellsOf(T0)) { const l = m.get(ck); if (l) l.push(idx); else m.set(ck, [idx]); }
  }
  // Pair -> accumulated overlap, keyed by the two parts.
  const patches = new Map<string, ZFightPatch>();
  const stamp = new Int32Array(tris.length).fill(-1);
  let rng = 0x5eed;
  for (let a = 0; a < tris.length; a++) {
    const A = tris[a], [az, el, db] = keyOf(A.n, A.d);
    const cells = cellsOf(A);
    for (let dz = -1; dz <= 1; dz++) for (let de = -1; de <= 1; de++) for (let dd = -1; dd <= 1; dd++) {
      const e = el + de, z = Math.abs(e * A_BIN) >= 88 ? 0 : (((az + dz) % AZN) + AZN) % AZN;
      if (Math.abs(e * A_BIN) >= 88 && dz) continue;
      const m = bins.get(planeKey(z, e, db + dd));
      if (!m) continue;
      for (const ck of cells) for (const b of m.get(ck) ?? []) {
        if (b <= a || stamp[b] === a) continue;
        stamp[b] = a;
        const B = tris[b];
        if (part[A.i] === part[B.i] && s.triMaterial[A.i] === s.triMaterial[B.i]) continue;
        if (A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2] < 0.999) continue;
        const off = Math.abs(A.n[0] * B.p[0][0] + A.n[1] * B.p[0][1] + A.n[2] * B.p[0][2] - A.d);
        if (off > th.zNearTol) continue;
        if (B.min[0] > A.max[0] || A.min[0] > B.max[0] || B.min[1] > A.max[1] || A.min[1] > B.max[1] || B.min[2] > A.max[2] || A.min[2] > B.max[2]) continue;
        const near = off > th.zPlaneTol;
        const ov = coplanarOverlap(A.p, B.p, A.n, th.zAbut);
        if (!ov || ov.area < 1e-4) continue;
        const o = ov.area;
        const pa = part[A.i], pb = part[B.i], k = `${Math.min(pa, pb)}|${Math.max(pa, pb)}|${near ? 1 : 0}|${Math.round(A.n[0] * 20)},${Math.round(A.n[1] * 20)},${Math.round(A.n[2] * 20)}`;
        let P = patches.get(k);
        if (!P) {
          const ma = s.materials[s.triMaterial[A.i]].name, mb = s.materials[s.triMaterial[B.i]].name;
          P = {area: 0, near, orientation: A.n[1] > 0.5 ? 'roof' : A.n[1] < -0.5 ? 'underside' : 'wall', normal: A.n, materials: [ma, mb].sort() as [string, string],
            centre: [0, 0, 0], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], y: 0, trisA: [], trisB: [], samples: [], hidden: false};
          patches.set(k, P);
        }
        const g = ov.centroid;
        // Area-weighted reservoir (A-Res, deterministic LCG): the kept samples estimate the visible share of the patch.
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        const key = Math.pow((rng + 1) / 4294967297, 1 / o);
        if (P.samples.length < 64 || key > P.samples[P.samples.length - 1].area) { P.samples.push({p: g, area: key}); P.samples.sort((x, y) => y.area - x.area); P.samples.length = Math.min(64, P.samples.length); }
        for (let k2 = 0; k2 < 3; k2++) { P.centre[k2] = (P.centre[k2] * P.area + g[k2] * o) / (P.area + o); P.min[k2] = Math.min(P.min[k2], A.min[k2], B.min[k2]); P.max[k2] = Math.max(P.max[k2], A.max[k2], B.max[k2]); }
        P.area += o;
        if (P.trisA.length < 400 && !P.trisA.includes(A.i)) P.trisA.push(A.i);
        if (P.trisB.length < 400 && !P.trisB.includes(B.i)) P.trisB.push(B.i);
      }
    }
  }
  const list = [...patches.values()].filter(p => p.area >= 0.02).map(p => ({...p, area: +p.area.toFixed(3), y: +p.centre[1].toFixed(2)}));
  // Visibility: an overlap piece is seen when at least one of seven rays (along the surface normal and six at 55
  // degrees around it), started 2 cm off the surface, leaves the model without hitting anything or the ground. A drum
  // cap under its dome, a band end buried in a pilaster or a slab inside a wall mass never reaches the screen.
  const grid = new TriGrid(s, Array.from({length: nTri}, (_, i) => i), 2);
  const bmin: V3 = [Infinity, Infinity, Infinity], bmax: V3 = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], t.min[k]); bmax[k] = Math.max(bmax[k], t.max[k]); }
  const escapes = (o: V3, d: V3): boolean => {
    let tExit = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) continue;
      tExit = Math.min(tExit, Math.max((bmin[k] - 0.1 - o[k]) / d[k], (bmax[k] + 0.1 - o[k]) / d[k]));
    }
    if (d[1] < -1e-6) tExit = Math.min(tExit, (0 - o[1]) / d[1]); // reaching the ground counts as blocked below
    const tested = new Set<number>();
    for (let t = 0; t < tExit; t += 1) {
      const t1 = Math.min(tExit, t + 1);
      const lo: V3 = [0, 1, 2].map(k => Math.min(o[k] + d[k] * t, o[k] + d[k] * t1) - 0.01) as V3, hi: V3 = [0, 1, 2].map(k => Math.max(o[k] + d[k] * t, o[k] + d[k] * t1) + 0.01) as V3;
      for (const tri of grid.near(lo, hi)) {
        if (tested.has(tri)) continue;
        tested.add(tri);
        const [a, b, c] = triVerts(s, tri);
        if (rayTriangle(o, d, a, b, c, tExit) >= 0) return false;
      }
    }
    return d[1] >= -1e-6;
  };
  const seenFrom = (p: V3, n: V3): boolean => {
    const o: V3 = [p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02];
    // Orthonormal frame around n.
    const u0: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = cross(n, u0), ul = Math.hypot(...u), U: V3 = [u[0] / ul, u[1] / ul, u[2] / ul], W = cross(n, U);
    const dirs: V3[] = [n];
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3, c = Math.cos(55 * Math.PI / 180), sn = Math.sin(55 * Math.PI / 180);
      dirs.push([n[0] * c + (U[0] * Math.cos(a) + W[0] * Math.sin(a)) * sn, n[1] * c + (U[1] * Math.cos(a) + W[1] * Math.sin(a)) * sn, n[2] * c + (U[2] * Math.cos(a) + W[2] * Math.sin(a)) * sn]);
    }
    return dirs.some(d => escapes(o, d));
  };
  for (const P of list) {
    // Visible share of the patch, weighted by the sampled overlap pieces (a drum cap under its dome is hidden except
    // for the gutter ring that shows past the dome's foot).
    let seenArea = 0, sampled = 0;
    for (const sm of P.samples) {
      sampled++;
      if (seenFrom(sm.p, P.normal)) seenArea++;
    }
    const f = sampled > 0 ? seenArea / sampled : 1;
    P.rawArea = P.area;
    P.area = +(P.area * f).toFixed(3);
    P.hidden = f === 0;
  }
  // Underside overlaps on the ground plane are never seen.
  const seen = list.filter(p => !p.hidden && p.area >= 0.02 && !(p.orientation === 'underside' && p.max[1] <= 0.05));
  seen.sort((a, b) => b.area - a.area);
  return {area: +seen.filter(p => !p.near).reduce((t, p) => t + p.area, 0).toFixed(2), nearArea: +seen.filter(p => p.near).reduce((t, p) => t + p.area, 0).toFixed(2), hiddenArea: +list.reduce((t, p) => t + (p.rawArea ?? p.area) - p.area, 0).toFixed(2), patches: seen};
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Window rhythm

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Facades to inspect when there is no photo inventory: the dominant outward wall bearings (≥ minArea m^2). */
export function dominantFacades(s: MaterialSoup, minArea = 60): FacadeInventory[] {
  const walls = clusterWalls(asTriSoup(s, Array.from({length: s.indices.length / 3}, (_, i) => i)), {minArea: 4});
  const byBearing: {bearing: number; area: number}[] = [];
  for (const w of walls) {
    const hit = byBearing.find(b => Math.min(Math.abs(b.bearing - w.bearingDeg), 360 - Math.abs(b.bearing - w.bearingDeg)) <= 12);
    if (hit) { hit.bearing = (hit.bearing * hit.area + w.bearingDeg * w.area) / (hit.area + w.area); hit.area += w.area; }
    else byBearing.push({bearing: w.bearingDeg, area: w.area});
  }
  return byBearing.filter(b => b.area >= minArea).sort((a, b) => b.area - a.area).slice(0, 4)
    .map(b => ({name: `wall facing ${Math.round(b.bearing)}`, bearing: Math.round(b.bearing), depthBand: 4}));
}

export function analyseRhythm(openings: Opening[]): Pick<RhythmFacade, 'rows' | 'mismatched' | 'missing' | 'misaligned'> {
  // Rows: cluster by vertical centre (half the median opening height, ≥ 0.9 m), as facadeCompare does.
  const medH = median(openings.map(o => o.y1 - o.y0)) || 1;
  const sorted = [...openings].sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const rows: Opening[][] = [];
  for (const o of sorted) {
    const r = rows[rows.length - 1], c = (o.y0 + o.y1) / 2;
    if (r && c - (r[r.length - 1].y0 + r[r.length - 1].y1) / 2 <= Math.max(0.9, medH * 0.5)) r.push(o); else rows.push([o]);
  }
  const mismatched: Opening[] = [], missing: {t: number; y0: number; y1: number}[] = [];
  const rowOut: RhythmFacade['rows'] = [];
  const rowCentres: number[][] = [];
  for (const r of rows) {
    r.sort((a, b) => a.t0 - b.t0);
    const mw = median(r.map(o => o.t1 - o.t0)), mh = median(r.map(o => o.y1 - o.y0)), ms = median(r.map(o => o.y0)), mt = median(r.map(o => o.y1));
    let odd = 0;
    if (r.length >= 3) for (const o of r) {
      const dw = Math.abs(o.t1 - o.t0 - mw), dh = Math.abs(o.y1 - o.y0 - mh);
      const bad = (dw > 0.3 && dw > 0.25 * mw) || (dh > 0.4 && dh > 0.25 * mh) || Math.abs(o.y0 - ms) > 0.35 || Math.abs(o.y1 - mt) > 0.35;
      if (bad) { odd++; mismatched.push(o); }
    }
    // Missing: a gap that is a whole multiple of the regular spacing, between two regular windows of the same size.
    const cs = r.map(o => (o.t0 + o.t1) / 2);
    rowCentres.push(cs);
    if (r.length >= 3) {
      const gaps = cs.slice(1).map((c, i) => c - cs[i]);
      const sp = median(gaps);
      gaps.forEach((g, i) => {
        const k = Math.round(g / sp);
        if (sp > 0.8 && k >= 2 && k <= 3 && Math.abs(g - k * sp) < 0.2 * sp) for (let j = 1; j < k; j++) missing.push({t: +(cs[i] + j * sp).toFixed(2), y0: +ms.toFixed(2), y1: +mt.toFixed(2)});
      });
    }
    rowOut.push({y: +((ms + mt) / 2).toFixed(1), count: r.length, medianW: +mw.toFixed(2), medianH: +mh.toFixed(2), odd});
  }
  // Column alignment: openings in a row with the same count as the row below should sit over its axes.
  let misaligned = 0;
  for (let i = 1; i < rowCentres.length; i++) {
    const a = rowCentres[i - 1], b = rowCentres[i];
    if (a.length < 3 || a.length !== b.length) continue;
    const sp = median(a.slice(1).map((c, k) => c - a[k]));
    b.forEach((c, k) => { const d = Math.abs(c - a[k]); if (d > 0.25 && d < sp * 0.5) misaligned++; });
  }
  return {rows: rowOut, mismatched, missing, misaligned};
}

export function auditRhythm(s: MaterialSoup, facades: FacadeInventory[], fromSpec: boolean): RhythmFacade[] {
  const out: RhythmFacade[] = [];
  for (const f of facades) {
    const m = measureFacade(s, f, 0.1);
    const r = analyseRhythm(m.openings);
    out.push({name: f.name, bearing: f.bearing, fromSpec, openings: m.openings.length, ...r, specRows: f.rows});
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------

export function geometryAudit(s: MaterialSoup, opts: {facades?: FacadeInventory[]; th?: Partial<GeometryAuditThresholds>; skipRhythm?: boolean} = {}): GeometryAuditReport {
  const th = {...GEOMETRY_THRESHOLDS, ...opts.th};
  const part = partsOf(s, th.weld);
  const T = Date.now();
  const openings = auditOpenings(s, th, part);
  const T1 = Date.now();
  const zfight = auditZFight(s, th, part);
  if (process.env.GEO_TIMING) console.log(`openings ${T1 - T} ms, zfight ${Date.now() - T1} ms`);
  const fromSpec = !!opts.facades?.length;
  const rhythm = opts.skipRhythm ? [] : auditRhythm(s, fromSpec ? opts.facades! : dominantFacades(s), fromSpec);

  const findings: GeometryFinding[] = [];
  const byKind = (k: OpeningIssue['kind']) => openings.issues.filter(i => i.kind === k);
  const fmt = (i: OpeningIssue) => `${i.materials.join('+')} at (${i.centre.map(v => v.toFixed(1)).join(', ')})`;
  for (const k of ['floating', 'overhang', 'buried'] as const) {
    const l = byKind(k);
    if (!l.length) continue;
    const fail = l.filter(i => i.severity === 'fail').length;
    const what = k === 'floating' ? `not touching any wall (worst gap ${Math.max(...l.map(i => i.gap)).toFixed(2)} m)` : k === 'overhang' ? `sticking out past the wall's edge (worst ${Math.round(100 * Math.max(...l.map(i => i.outside)))}% of the face off the wall)` : `sunk behind the solid wall surface (worst ${Math.round(100 * Math.max(...l.map(i => i.buried)))}% hidden)`;
    findings.push({kind: `opening-${k}`, severity: fail ? 'fail' : 'warn', message: `${l.length} opening/trim assemblies ${what}; e.g. ${fmt(l[0])}`});
  }
  const real = zfight.patches.filter(p => !p.near), near = zfight.patches.filter(p => p.near);
  if (zfight.area >= th.zWarnArea) {
    const top = real[0];
    findings.push({kind: 'zfight', severity: zfight.area >= th.zFailArea ? 'fail' : 'warn', message: `${zfight.area.toFixed(1)} m2 coplanar overlap in ${real.length} patches; worst ${top.area.toFixed(1)} m2 ${top.orientation} ${top.materials.join('/')} at y ${top.y}`});
  }
  if (zfight.nearArea >= th.zFailArea) findings.push({kind: 'zfight-near', severity: 'warn', message: `${zfight.nearArea.toFixed(1)} m2 of same-facing faces 1-3 cm apart (${near.length} patches; z-fights at distance)`});
  for (const f of rhythm) {
    const odd = f.mismatched.length, miss = f.missing.length;
    if (odd + miss + f.misaligned === 0) continue;
    findings.push({kind: 'window-rhythm', severity: 'warn', message: `${f.name}: ${f.openings} openings in ${f.rows.length} rows; ${odd} off-size/off-level, ${miss} predicted missing, ${f.misaligned} off-axis${f.fromSpec ? ' (photo-spec facade)' : ' (inferred facade)'}`});
  }
  const counts: Record<string, number> = {
    'opening-floating': byKind('floating').length, 'opening-floating-fail': byKind('floating').filter(i => i.severity === 'fail').length,
    'opening-overhang': byKind('overhang').length, 'opening-overhang-fail': byKind('overhang').filter(i => i.severity === 'fail').length,
    'opening-buried': byKind('buried').length,
    'zfight-m2': Math.round(zfight.area * 10) / 10,
    'zfight-near-m2': Math.round(zfight.nearArea * 10) / 10,
    'window-mismatch': rhythm.reduce((t, f) => t + f.mismatched.length, 0),
    'window-missing': rhythm.reduce((t, f) => t + f.missing.length, 0),
    'window-misaligned': rhythm.reduce((t, f) => t + f.misaligned, 0),
  };
  const score = openings.issues.reduce((t, i) => t + issueWeight(i), 0) + Math.min(zfight.area, 100) * 2 + Math.min(zfight.nearArea, 100) * 0.3 + counts['window-mismatch'] * 0.5 + counts['window-missing'] + counts['window-misaligned'] * 0.3;
  return {openings, zfight, rhythm, counts, findings, score: +score.toFixed(1)};
}

/** Gate: which counts grew beyond the recorded baseline (plus slack)? Empty = no new regression. */
export function regressions(counts: Record<string, number>, baseline: Record<string, number> | undefined): string[] {
  const slack: Record<string, number> = {'zfight-m2': 0.3, 'zfight-near-m2': 1, 'window-mismatch': 1, 'window-missing': 1, 'window-misaligned': 1};
  const hard = new Set(['opening-floating-fail', 'opening-overhang-fail', 'zfight-m2']);
  const out: string[] = [];
  for (const [k, v] of Object.entries(counts)) {
    if (!hard.has(k)) continue; // warn-level counts are reported, not gated
    const b = baseline?.[k] ?? 0;
    if (v > b + (slack[k] ?? 0)) out.push(`${k} ${v} > baseline ${b}`);
  }
  return out;
}
