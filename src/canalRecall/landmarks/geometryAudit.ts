/**
 * Landmark geometry audit: three mechanical checks that catch what reviewers kept finding by eye.
 *
 *  1. Detached openings (`auditOpenings`): window/door frames, panes, sills, shutters and trim that do not touch the
 *     wall they belong to: floating in front of it, buried behind its surface, or hanging past a wall end / corner
 *     (Oude Lutherse Kerk, 2026-10-10: tracery windows past the gable's edge, axis-aligned side windows half inside a
 *     skewed wall).
 *  2. Window rhythm (`auditRhythm`): per facade elevation, openings in one storey row should share size, sill and head;
 *     columns should align across storeys; a gap where the row's spacing predicts a window is a missing opening.
 *     On a facade counted from a photo (`<id>-elevations.json`) the rhythm is a FAIL when more than 15% of the openings are
 *     off-size/off-level or any window is predicted missing (`rhythmVerdict`, RHYTHM_FAIL); inferred facades (dominant wall
 *     bearings, no photo spec) stay warnings, since irregular facades exist and nobody has checked them against a photo.
 *     Gated through the baseline: a model may not add failing facades or off-size/missing windows on photo-spec facades.
 *  3. Coplanar z-fighting (`auditZFight`): same-facing coplanar triangles from different parts overlapping by more than a
 *     sliver (H'ART front roof, Rijksmuseum entrance canopy). Same measure as the block-face `zFightArea` (abutment
 *     shrink, convex clip; a test pins the two together) but returning the overlap polygon so hidden overlaps
 *     (inside another solid) can be told from visible ones, plus a near-coplanar band (2-8 cm apart) that z-fights from the air on a 24-bit depth buffer
 *     (Centraal Station's roof strips, 2026-10-13). Coplanar means the smaller face's corners lie within 2 cm of
 *     the larger face's plane.
 *
 * Input is a material soup (one material per triangle) in the GLB's native frame: x east, y up, z south, metres.
 * Pure geometry, no I/O: `scripts/audit-glb-quality.ts` loads GLBs, ranks models and gates against a baseline.
 */
import {clusterWalls, type WallSegment} from './wallPlanes';
import {measureFacade, type FacadeInventory, type MaterialSoup, type Opening} from './facadeCompare';
import {closestPointOnTriangle, pointTriangleDistSq, rayTriangle, type TriSoup} from './glbQuality';

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
  /** A balcony (slab touching the wall, trim attached to it) may project this far (m) in front of the wall without counting as overhang. */
  balconyMax: number;
  /** Fraction of an opening's face hidden behind the solid wall surface (not a hole) that counts as buried. */
  buriedWarn: number;
  /** Opening parts larger than this (bbox diagonal, m) are treated as host geometry (walls, roofs). */
  maxOpeningDiag: number;
  /** A glass/frame assembly whose outward-facing area is at least this (m2) is a glazed facade (curtain wall, glazed atrium, skewed glass tower), not a window: it IS the wall, so overhang/buried against some other wall plane do not apply. */
  glazedSkinArea: number;
  /** Coplanar plane tolerance (m) and abutment shrink (m) for z-fighting. */
  zPlaneTol: number;
  zAbut: number;
  /** Near-coplanar band (m): parallel same-facing faces this close z-fight at distance on a 24-bit depth buffer (the map camera, near 1 m, resolves about 6 cm at 1 km). */
  zNearTol: number;
  /** Two faces may be coplanar when their normals agree within this many degrees (the corner offsets decide; see auditZFight). */
  zAngleTol: number;
  /** Overlap patches (per part pair and facing) smaller than this (m^2) are dropped as slivers. */
  zMinPatch: number;
  /** A new export (no baseline entry) fails above this much visible coplanar + near-coplanar overlap (m^2). */
  zNewExportFail: number;
  /** Inside the near band, faces closer than this (m) still bleed through in renders with the game's projection (zfight-validate.ts
   *  --calibrate, 2026-10-13: 2 cm bleeds 9-17% from a driving camera at 900-1800 m, 3 cm and more never). Counted with the
   *  coplanar area by the gate as `zfight-tight-m2`. */
  zTightTol: number;
  /** Total coplanar overlap area (m^2) that warns / fails. */
  zWarnArea: number;
  zFailArea: number;
}

export const GEOMETRY_THRESHOLDS: GeometryAuditThresholds = {
  weld: 0.001, touchTol: 0.03, floatFail: 0.1, overhangWarn: 0.12, overhangFail: 0.35, balconyMax: 2, buriedWarn: 0.3,
  maxOpeningDiag: 14, glazedSkinArea: 24, zPlaneTol: 0.02, zAbut: 0.005, zNearTol: 0.08, zAngleTol: 2.5, zMinPatch: 0.05, zNewExportFail: 0.5, zTightTol: 0.03, zWarnArea: 0.25, zFailArea: 2,
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
  /** Outward (x, z) unit normal of the wall the assembly was judged against. */
  wallNormal?: [number, number];
  /** Floating: vector from the assembly's closest vertex to the closest host point (its length is `gap`); absent when an edge pierces the host. */
  towardHost?: V3;
  /** Buried: distance (m) along `wallNormal` to clear the nearest surface covering the face (median over the covered samples). */
  clearance?: number;
  triangles: number[];
}

export interface ZFightPatch {
  area: number;
  /** Coplanar (≤ zPlaneTol) or near-coplanar (≤ zNearTol). */
  near: boolean;
  /** Near-coplanar but under zTightTol apart: measured to bleed through from a distance. */
  tight: boolean;
  /** At least 90% of the overlap pairs one material with itself: both faces draw the same colour, so the tie cannot show (reported as
   *  `sameArea`, not counted in `area` / `tightArea`). */
  sameMaterial: boolean;
  /** Area-weighted mean separation (m) of the two faces. */
  gap: number;
  /** Overlapping triangle pairs in the patch. */
  pairs: number;
  orientation: 'roof' | 'wall' | 'underside';
  normal: V3;
  materials: [string, string];
  centre: V3;
  min: V3; max: V3;
  y: number;
  trisA: number[]; trisB: number[];
  /** Area-weighted random overlap centroids used for the visibility test (`area` holds the reservoir key): `p` on the front face,
   *  `q` on the rear face (probed from behind when both materials are double-sided). */
  samples: {p: V3; q: V3; area: number}[];
  /** Both materials double-sided: the pair is drawn, and can fight, seen from behind too. */
  doubleSided: boolean;
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
  specRows?: (number | null)[];
}

export interface GeometryFinding { kind: string; severity: 'fail' | 'warn'; message: string }

export interface GeometryAuditReport {
  openings: {assemblies: number; issues: OpeningIssue[]};
  zfight: ZFightResult;
  rhythm: RhythmFacade[];
  /** Share of visible surface area with `materialSlot` + `tint` (see `materialSlotCoverage`). */
  materialSlots: MaterialSlotCoverage;
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
  /** Triangles whose box spans too many cells to bin (a big diagonal wall or roof): kept aside and tested by box on every query. */
  private big: number[] = [];
  readonly box: Float64Array;
  private static key = (x: number, y: number, z: number) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  constructor(private s: MaterialSoup, tris: number[], private cell = 1) {
    this.box = new Float64Array((s.indices.length / 3) * 6);
    for (const t of tris) {
      const [a, b, c] = triVerts(s, t);
      for (let k = 0; k < 3; k++) { this.box[t * 6 + k] = Math.min(a[k], b[k], c[k]); this.box[t * 6 + 3 + k] = Math.max(a[k], b[k], c[k]); }
      const lo = [0, 1, 2].map(k => Math.floor(this.box[t * 6 + k] / cell)), hi = [0, 1, 2].map(k => Math.floor(this.box[t * 6 + 3 + k] / cell));
      // A large diagonal wall spans a huge box. It must stay queryable, or its windows read as floating in front of nothing.
      if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 20000) { this.big.push(t); continue; }
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
    for (const t of this.big) {
      if (B[t * 6] > max[0] || B[t * 6 + 3] < min[0] || B[t * 6 + 1] > max[1] || B[t * 6 + 4] < min[1] || B[t * 6 + 2] > max[2] || B[t * 6 + 5] < min[2]) continue;
      out.add(t);
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

/**
 * Opening-material assemblies that are not wall openings (precision sweep 2026-10-13, qa/detached-openings-sweep:
 * 22 of 30 sampled fail-grade issues were these). Returns the class, or undefined for a plausible window/door.
 *  - 'not-vertical': under 40% of its face area is vertical (tilted less than ~9 degrees), or it is a thin plate at least
 *    0.5 m deep both ways: roof glazing, skylight ribs, sawtooth lights, glass canopies, slabs and floor plates modelled in
 *    frame/glass. The check is about openings in walls.
 *  - 'post': a slender vertical bar (both plan dimensions <= 25 cm, at least 3x as tall), a square-ish column
 *    (<= 0.8 m, plan aspect >= 0.6, at least 2x as tall) or a horizontal rail/beam (section <= 20 cm, >= 2 m long):
 *    balusters, railing posts, fence pickets, pilotis, handrails. No window is that shape.
 * Plan dimensions are measured along the assembly's facing axis and across it, so a window on a 45-degree wall is not
 * mistaken for a square column.
 */
export function nonOpeningShape(s: MaterialSoup, tris: number[], axis: [number, number]): 'not-vertical' | 'post' | undefined {
  let vert = 0, total = 0;
  let a0 = Infinity, a1 = -Infinity, t0 = Infinity, t1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const t of tris) {
    const [a, b, c] = triVerts(s, t), {n, area} = triNormal(a, b, c);
    total += area;
    if (Math.abs(n[1]) < 0.15) vert += area;
    for (const v of [a, b, c]) {
      const along = v[0] * axis[0] + v[2] * axis[1], across = -v[0] * axis[1] + v[2] * axis[0];
      a0 = Math.min(a0, along); a1 = Math.max(a1, along); t0 = Math.min(t0, across); t1 = Math.max(t1, across); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]);
    }
  }
  const dy = y1 - y0, hi = Math.max(a1 - a0, t1 - t0), lo = Math.min(a1 - a0, t1 - t0);
  if (hi <= 0.25 && dy >= 3 * hi) return 'post';
  if (hi <= 0.8 && lo >= 0.6 * hi && dy >= 2 * hi) return 'post';
  // A handrail or beam: at most 20 cm in section and at least 2 m long (a loose sill is shorter and stays judged).
  if (dy <= 0.2 && lo <= 0.2 && hi >= 2) return 'post';
  if (total > 0 && vert < 0.4 * total) return 'not-vertical';
  // A thin plate at least 0.5 m deep both ways (a roof-edge fascia plate, a canopy): a sill is shallower.
  if (dy <= 0.2 && lo >= 0.5) return 'not-vertical';
  return undefined;
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
  const hostTri = new Uint8Array(nTri);
  for (const t of host) hostTri[t] = 1;
  const hostSoup = asTriSoup(s, host);
  // Walls: vertical host planes at least 1 m tall and wide (rails, cornices and copings are not walls).
  const walls = clusterWalls(hostSoup, {outwardOnly: false, minArea: 1.5, splitGap: 0.6}).filter(w => w.vMax - w.vMin >= 1 && w.uMax - w.uMin >= 1);
  // Host triangles that belong to a wall plane; trim touching only other host surfaces (a cartouche, a pediment, a roof) is applied ornament.
  const wallTris = new Set<number>();
  for (const w of walls) for (const i of w.tris) wallTris.add(host[i]);
  const rasters = new Map<WallSegment, WallRaster>();
  const raster = (w: WallSegment) => { let r = rasters.get(w); if (!r) { r = rasterWall(s, w, host); rasters.set(w, r); } return r; };

  const issues: OpeningIssue[] = [];
  for (const tris of groups.values()) {
    const bb = bboxOf(s, tris), c = centreOf(bb);
    // Gap to host geometry: vertex-to-triangle distance, zero when an assembly edge pierces a host triangle.
    const near = grid.near([bb.min[0] - 0.6, bb.min[1] - 0.6, bb.min[2] - 0.6], [bb.max[0] + 0.6, bb.max[1] + 0.6, bb.max[2] + 0.6]);
    const own = new Set(tris);
    /** Distance to the first surface covering the ray within L metres (skipping `skip`), or -1. */
    const blockedAt = (o: V3, d: V3, skip: Set<number>, L = 1.5): number => {
      const e: V3 = [o[0] + d[0] * L, o[1] + d[1] * L, o[2] + d[2] * L];
      let first = -1;
      for (const t of grid.near([Math.min(o[0], e[0]), Math.min(o[1], e[1]), Math.min(o[2], e[2])], [Math.max(o[0], e[0]), Math.max(o[1], e[1]), Math.max(o[2], e[2])])) {
        if (skip.has(t)) continue;
        const [a, b, c] = triVerts(s, t);
        const r = rayTriangle(o, d, a, b, c, L);
        if (r >= 0 && (first < 0 || r < first)) first = r; // nearest cover; a second layer behind it is cleared by the next snap pass
      }
      return first;
    };
    const nearTris = near.filter(t => !own.has(t)).map(t => triVerts(s, t));
    /** First host surface along a horizontal ray is the back of a wall (we are inside the building's shell)? */
    const enclosed = (o: V3, d: V3, L = 40): boolean => {
      const st: V3 = [o[0] + d[0] * 0.02, o[1], o[2] + d[2] * 0.02], e: V3 = [st[0] + d[0] * L, st[1], st[2] + d[2] * L];
      let tBest = Infinity, nBest: V3 | undefined;
      for (const t of grid.near([Math.min(st[0], e[0]), st[1], Math.min(st[2], e[2])], [Math.max(st[0], e[0]), st[1], Math.max(st[2], e[2])])) {
        if (!hostTri[t]) continue;
        const [a, b, c] = triVerts(s, t), hit = rayTriangle(st, d, a, b, c, L);
        if (hit >= 0 && hit < tBest) { tBest = hit; nBest = triNormal(a, b, c).n; }
      }
      return !!nBest && nBest[0] * d[0] + nBest[1] * d[1] + nBest[2] * d[2] > 0.2;
    };
    /** Host geometry along a horizontal ray within L metres? */
    const hostWithin = (o: V3, d: V3, L: number): boolean => {
      const e: V3 = [o[0] + d[0] * L, o[1], o[2] + d[2] * L];
      for (const t of grid.near([Math.min(o[0], e[0]), o[1], Math.min(o[2], e[2])], [Math.max(o[0], e[0]), o[1], Math.max(o[2], e[2])])) {
        if (!hostTri[t]) continue;
        const [a, b, c] = triVerts(s, t);
        if (rayTriangle(o, d, a, b, c, L) >= 0) return true;
      }
      return false;
    };
    let gapSq = Infinity, bestV: V3 | undefined, bestH: [V3, V3, V3] | undefined;
    const verts: V3[] = [];
    for (const t of tris) verts.push(...triVerts(s, t));
    vloop: for (const v of verts) for (const h of nearTris) { const d = pointTriangleDistSq(v, h[0], h[1], h[2]); if (d < gapSq) { gapSq = d; bestV = v; bestH = h; if (gapSq <= tol * tol) break vloop; } }
    const towardHost: V3 | undefined = bestV && bestH && gapSq > tol * tol ? sub(closestPointOnTriangle(bestV, bestH[0], bestH[1], bestH[2]), bestV) : undefined;
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
    // Railing posts, balusters, pickets, columns, roof glazing and slabs in opening materials are not wall openings.
    if (nonOpeningShape(s, tris, axis)) continue;

    // Walls this assembly belongs to: vertical host planes within 0.8 m of it whose extent overlaps it. The plane
    // facing the nearest one wins the orientation; every parallel plane in that band counts as wall behind the opening
    // (a window on a pilaster, a buttress or a recessed bay is still on a wall).
    // `any`: every wall plane in reach regardless of orientation (a balcony's rail returns can outweigh its front in the
    // facing-axis estimate, so the balcony rule must not depend on it); `cands`: those within 0.8 m and facing along the assembly's axis.
    const any: {w: WallSegment; sd: number; close: boolean; axisOk: boolean}[] = [];
    for (const w of walls) {
      const axisOk = !(axisStrength > 0.3 && Math.abs(w.n[0] * axis[0] + w.n[1] * axis[1]) < 0.94);
      const sds = [[bb.min[0], bb.min[2]], [bb.max[0], bb.min[2]], [bb.min[0], bb.max[2]], [bb.max[0], bb.max[2]]].map(([x, z]) => w.n[0] * x + w.n[1] * z - w.d);
      const lo = Math.min(...sds), hi = Math.max(...sds);
      // `close` = within 0.8 m (the plain window case); the wider band to `balconyMax` is only used for balconies.
      if (hi < -0.8 || lo > 2 * th.balconyMax) continue;
      const us = [[bb.min[0], bb.min[2]], [bb.max[0], bb.min[2]], [bb.min[0], bb.max[2]], [bb.max[0], bb.max[2]]].map(([x, z]) => x * w.t[0] + z * w.t[1]);
      if (Math.max(...us) < w.uMin - 0.3 || Math.min(...us) > w.uMax + 0.3 || bb.max[1] < w.vMin - 0.3 || bb.min[1] > w.vMax + 0.3) continue;
      // Prefer a plane the opening stands on or in front of; a plane it lies wholly behind is usually the inner face of a
      // thin shell (a drum, a tower wall) and only wins when nothing better exists.
      any.push({w, sd: Math.max(0, lo, -hi) + (hi < 0.02 ? 5 : 0), close: lo <= 0.8, axisOk});
    }
    // Planes within 2 cm of each other are a tie: the larger one is the wall (the back face of a pier or band beside a window
    // is not the wall the window is on; sweep 2026-10-13, Rode Hoed).
    any.sort((p, q) => (Math.abs(p.sd - q.sd) > 0.02 ? p.sd - q.sd : q.w.area - p.w.area));
    const cands = any.filter(x => x.close && x.axisOk);

    // Sample the assembly faces turned towards the wall's outside (the visible face of a window) against `group`:
    // the fraction outside the walls' silhouette and the fraction hidden behind solid wall. `reach` is how far in front
    // of a plane (m) a sample still counts as on it.
    const sample = (best: WallSegment, group: WallSegment[], reach: number, facets: WallSegment[] = []): {outside: number; buried: number; clearance?: number} => {
      let nS = 0, nOut = 0, nBur = 0;
      const covers: number[] = [];
      const inward: V3 = [-best.n[0], 0, -best.n[1]], tan: V3 = [best.t[0], 0, best.t[1]];
      let uLo = Infinity, uHi = -Infinity;
      for (const v of verts) { const u = v[0] * best.t[0] + v[2] * best.t[1]; uLo = Math.min(uLo, u); uHi = Math.max(uHi, u); }
      for (const t of tris) {
        const [a, b, cc] = triVerts(s, t), {n, area} = triNormal(a, b, cc);
        if (area < 1e-5 || n[0] * best.n[0] + n[2] * best.n[1] < 0.7) continue;
        for (const p of samplesOn(a, b, cc, 0.15)) {
          nS++;
          let inside = false, behind = false;
          for (const w of group) {
            const u = p[0] * w.t[0] + p[2] * w.t[1], sd = w.n[0] * p[0] + w.n[1] * p[2] - w.d;
            if (sd > reach || sd < -0.8) continue;
            const r = raster(w);
            if (inSilhouette(r, u, p[1], 0.12)) inside = true;
            if (sd < -0.01 && solidAt(r, u, p[1])) behind = true;
          }
          // Curved walls (drums, apses) are many narrow facets: a window spanning two facets is on the wall, not past it.
          for (const w of facets) {
            if (inside) break;
            const sd = w.n[0] * p[0] + w.n[1] * p[2] - w.d;
            if (sd <= reach && sd >= -0.3 && inSilhouette(raster(w), p[0] * w.t[0] + p[2] * w.t[1], p[1], 0.12)) inside = true;
          }
          // Off the wall but enclosed: looking across the opening's plane (either way: the facing estimate can pick a shell's
          // inner face), the first host surface is the inside of the building's own shell. The glazing is the envelope (a
          // curtain wall between fins, a glazed corner), not hanging in the air.
          if (!inside && (enclosed(p, inward) || enclosed(p, [-inward[0], 0, -inward[2]]))) inside = true;
          // Infill: host geometry on both lateral sides within the opening's own extent (glazing spanning between two
          // masses, fins or piers). A window hanging past a wall end has open air on its free side.
          if (!inside) {
            const u = p[0] * best.t[0] + p[2] * best.t[1];
            if (hostWithin(p, tan, uHi - u + 0.3) && hostWithin(p, [-tan[0], 0, -tan[2]], u - uLo + 0.3)) inside = true;
          }
          // Behind the plane and covered by geometry within 1.5 m on the viewer's side: the face never shows.
          if (!inside) nOut++;
          else if (behind) { const r = blockedAt(p, [best.n[0], 0, best.n[1]], own); if (r >= 0) { nBur++; covers.push(r); } }
        }
      }
      covers.sort((x, y) => x - y);
      return nS >= 4 ? {outside: nOut / nS, buried: nBur / nS, clearance: covers.length ? covers[Math.floor(covers.length / 2)] : undefined} : {outside: 0, buried: 0};
    };

    // A grounded part only belongs to a wall it stands against (railings and gates stand off it).
    const best = cands[0] && (bb.min[1] > 0.02 || cands[0].sd <= 0.25) ? cands[0].w : undefined;
    // Facets of a curved wall (a drum or an apse, 11-20 degrees between facets) continue the wall: a window wider than its facet is still on it.
    const group = best ? cands.filter(c => c.w.n[0] * best.n[0] + c.w.n[1] * best.n[1] > 0.94).map(c => c.w) : [];
    let outside = 0, buried = 0, clearance: number | undefined;
    // Facets of a curved wall for the silhouette test: planes in reach turned less than ~37 degrees from the best one.
    const facets = best ? any.filter(c => c.close && c.w.n[0] * best.n[0] + c.w.n[1] * best.n[1] > 0.8).map(c => c.w) : [];
    if (best) ({outside, buried, clearance} = sample(best, group, 0.8, facets));

    // Balcony: trim sitting on a small distinct horizontal slab (within 8 cm of it: rail bars stand a little proud) that sticks out from the wall past 0.8 m.
    // Only consulted where the plain rule has nothing to say or says overhang (a rail face standing in front of the wall
    // can otherwise read as the wall). The slab must touch the wall plane (else the whole balcony floats off it), its
    // projection perpendicular to the wall is capped at `balconyMax`, and the trim must still lie laterally inside the
    // wall's silhouette: a "balcony" 3 m deep, a floating slab, or trim hanging past the wall's side edge all stay overhangs.
    if ((!best || outside > th.overhangWarn) && any.length && (bb.min[1] > 0.02 || any[0].sd <= 0.25)) {
      // Reference walls: the parallel planes the assembly stands in front of, furthest first (the balcony's own rail/fascia
      // face is not the wall; a stepped facade has several planes and the slab must reach one of them).
      const refs = any.map(x => ({w: x.w, d: x.w.n[0] * c[0] + x.w.n[1] * c[2] - x.w.d})).filter(x => x.d >= -0.05).sort((p, q) => q.d - p.d).map(x => x.w);
      const touched = new Set<number>();
      if (refs.length) {
        for (const t of near) {
          if (own.has(t)) continue;
          const tv = triVerts(s, t);
          if (verts.some(v => pointTriangleDistSq(v, tv[0], tv[1], tv[2]) <= 0.08 * 0.08)) touched.add(part[t]);
        }
      }
      let verdict: 'none' | 'ok' | 'bad' = 'none', okRef: WallSegment | undefined;
      for (const ref of refs) {
        if (!touched.size) break;
        let proj = 0, uLo = Infinity, uHi = -Infinity;
        for (const v of verts) { proj = Math.max(proj, ref.n[0] * v[0] + ref.n[1] * v[2] - ref.d); const u = v[0] * ref.t[0] + v[2] * ref.t[1]; uLo = Math.min(uLo, u); uHi = Math.max(uHi, u); }
        // Trim parallel to the wall and at least 0.8 m long (a fascia, a glazed screen), not a post or a fixture that happens to stand near a slab.
        if (proj <= 0.8 || uHi - uLo < 0.8) continue;
        let slabFound = false, slabReaches = false;
        for (const pid of touched) {
          let minSd = Infinity, maxSd = -Infinity, slabArea = 0, y0 = Infinity, y1 = -Infinity, u0 = Infinity, u1 = -Infinity;
          for (const t of parts.get(pid) ?? []) {
            const [a, b, cc] = triVerts(s, t);
            for (const v of [a, b, cc]) {
              const sd = ref.n[0] * v[0] + ref.n[1] * v[2] - ref.d, u = v[0] * ref.t[0] + v[2] * ref.t[1];
              minSd = Math.min(minSd, sd); maxSd = Math.max(maxSd, sd); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); u0 = Math.min(u0, u); u1 = Math.max(u1, u);
            }
            const {n, area} = triNormal(a, b, cc);
            if (n[1] > 0.9 && a[1] >= bb.min[1] - 0.12 && a[1] <= bb.max[1] + 0.15) slabArea += area; // an upward face at the trim's level
          }
          // The trim sits at the slab's outer edge (a fascia, a front screen), not on top of it near the wall.
          // A balcony is a small distinct part: a slab (>= 0.3 m2 of upward face at the trim's level), at most a storey of rail above it,
          // a few metres wide, within 0.6 m of the wall plane (a slab further off is a bay or a porch, not this rule's business).
          if (slabArea >= 0.3 && maxSd >= 0.8 && minSd <= 0.6 && Math.abs(proj - maxSd) <= 0.15 && y1 - y0 <= 1.8 && u1 - u0 <= 8 && maxSd - minSd <= 2 * th.balconyMax + 0.5) { slabFound = true; if (minSd <= tol) slabReaches = true; }
        }
        if (!slabFound) continue;
        if (slabReaches && proj <= th.balconyMax) { verdict = 'ok'; okRef = ref; break; }
        verdict = 'bad';
      }
      if (verdict === 'bad' && !best) { outside = 1; buried = 0; }
      else if (okRef) { const r = sample(okRef, [okRef], th.balconyMax + 0.1); if (!best || r.outside < outside) ({outside, buried, clearance} = r); } // judged laterally; never worsens a plain verdict
    }

    // Guard rail: a balustrade or glazed screen standing on a wall's top edge (a podium roof terrace, a parapet) is not an opening
    // that came off its wall. It must be low (a storey of rail at most), rest on the wall top (its foot within 15 cm below to
    // 10 cm above the top along its whole length) and lie laterally within the wall's extent; a window floating above a wall stays a defect.
    if (best && gap <= tol && outside > th.overhangWarn && bb.max[1] - bb.min[1] <= 1.8) {
      const r = raster(best);
      let u0 = Infinity, u1 = -Infinity;
      for (const v of verts) { const u = v[0] * best.t[0] + v[2] * best.t[1]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
      const x0 = Math.floor((u0 - r.u0) / r.cell), x1 = Math.floor((u1 - r.u0) / r.cell);
      // A thin post (a balustrade or railing stanchion: <= 15 cm across, <= 1.2 m tall) may stand at the very end of the wall top and on a parapet
      // cap up to 35 cm lower than the silhouette's top cell (rails and copings add a few centimetres of unsilhouetted height).
      const post = Math.max(bb.max[0] - bb.min[0], bb.max[2] - bb.min[2]) <= 0.15 && bb.max[1] - bb.min[1] <= 1.2;
      const lowTol = post ? 0.35 : 0.15, end = post ? 3 : 0;
      let resting = x0 >= 0 - end && x1 < r.nu + end;
      for (let x = Math.max(0, x0); resting && x <= Math.min(r.nu - 1, x1); x++) {
        let hi = r.colHi[x];
        // Within `end` cells of the silhouette's lateral edge the nearest finite column stands in.
        for (let k = 1; !Number.isFinite(hi) && k <= end; k++) hi = Number.isFinite(r.colHi[x + k]) ? r.colHi[x + k] : Number.isFinite(r.colHi[x - k]) ? r.colHi[x - k] : hi;
        resting = Number.isFinite(hi) && bb.min[1] >= hi - lowTol && bb.min[1] <= hi + 0.1;
      }
      if (resting) { outside = 0; buried = 0; clearance = undefined; }
    }

    // Glazed facade: large and made of glazing, so it is the wall itself (a curtain wall, a skewed glass tower face): it cannot overhang or
    // sink behind "the" wall because no other wall is its host. It must still touch the building (floating stays checked above).
    if (outside > 0 || buried > 0) {
      let skin = 0;
      for (const t of tris) { const [a, b, cc] = triVerts(s, t), {n, area} = triNormal(a, b, cc); if (Math.abs(n[1]) < 0.7) skin += area; }
      const glazed = tris.some(t => /^(glass|window|pane|sash)/i.test(s.materials[s.triMaterial[t]].name));
      // Closed glass boxes carry both faces of every pane, so the outward area is about half the summed area.
      if (glazed && skin / 2 >= th.glazedSkinArea) { outside = 0; buried = 0; clearance = undefined; }
    }

    // Small trim whose only contact is with non-wall surfaces (a curved cartouche, a pediment, a roof slope) is ornament applied to that
    // surface, not a window hanging past its wall's end: the wall silhouette does not describe where it may stand.
    if (outside > th.overhangWarn && hostGap <= tol && Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]) <= 2.5) {
      let touchesWall = false, touchesHost = false;
      probe: for (const v of verts) for (const t of near) {
        if (own.has(t)) continue;
        const [a, b, cc] = triVerts(s, t);
        if (pointTriangleDistSq(v, a, b, cc) > tol * tol) continue;
        touchesHost = true;
        if (wallTris.has(t)) { touchesWall = true; break probe; }
      }
      if (touchesHost && !touchesWall) outside = 0;
    }

    const mats = [...new Set(tris.map(t => s.materials[s.triMaterial[t]].name))].sort();
    const base = {materials: mats, min: bb.min, max: bb.max, centre: c, gap, outside: +outside.toFixed(2), buried: +buried.toFixed(2), wallBearing: best?.bearingDeg, wallNormal: best?.n, towardHost, clearance, triangles: tris};
    // A part sunk wholly inside the wall is buried, not floating, even though no wall surface touches it.
    if (buried > 0.5) issues.push({...base, kind: 'buried', severity: 'warn'});
    // Floating with no wall plane in reach (only roofs, slabs or other trim nearby) is reported but not failed: it is not a
    // window that came off its wall (sweep 2026-10-13: hidden skylight ribs under a glass ridge).
    else if (gap > tol) issues.push({...base, kind: 'floating', severity: gap > th.floatFail && best ? 'fail' : 'warn'});
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

export interface ZFightResult {
  /** Visible coplanar overlap (m^2): same-facing faces at most zPlaneTol apart, different materials (see `sameArea`). */
  area: number;
  /** Visible near-coplanar overlap (m^2): same-facing faces zPlaneTol..zNearTol apart. */
  nearArea: number;
  /** The part of `nearArea` under zTightTol apart (bleeds through at distance), different materials only. */
  tightArea: number;
  /** Coplanar + tight overlap of a material with itself (cannot show; reported, not gated). */
  sameArea: number;
  /** Overlap never drawn (inside another solid, under a cap). */
  hiddenArea: number;
  /** Overlapping triangle pairs behind `area` / `nearArea` (visible patches only). */
  pairs: number;
  nearPairs: number;
  patches: ZFightPatch[];
  /** Patches dropped as never drawn (or too small once weighted), largest raw overlap first: evidence for the visibility test. */
  hidden: ZFightPatch[];
}

/**
 * Coplanar overlap (lane zfight-audit 2026-10-13). Every pair of same-facing triangles whose normals agree within `zAngleTol`
 * and whose smaller triangle's corners all lie within `zNearTol` of the larger one's plane is clipped in 2-D; the mean corner
 * offset (under `zPlaneTol`: coplanar, else near-coplanar) is the gap. The corner test, not the angle, is what makes two faces
 * coplanar: 2.5 degrees only admits the noisy normals of narrow strips in quantised GLBs. Pairs from different parts or
 * materials always count; pairs of one part and one material count too (adjacent triangles share an edge, so the abutment
 * shrink leaves them no overlap; what remains is a doubled face). Overlap is summed per part pair and facing into patches;
 * patches under `zMinPatch` m^2 are dropped, and each surviving patch is weighted by its visible share.
 *
 * Candidates come from a spatial hash: quantised normal (bins as wide as the angle tolerance), 2 m cell, and the signed
 * distance from that cell's centre to the plane (0.1 m bins). Measuring the offset at the cell rather than at the origin keeps
 * two planes 2 degrees apart and 300 m from the origin in neighbouring bins (their origin offsets differ by metres).
 */
export function auditZFight(s: MaterialSoup, th: GeometryAuditThresholds = GEOMETRY_THRESHOLDS, part = partsOf(s, th.weld)): ZFightResult {
  const nTri = s.indices.length / 3;
  interface T { i: number; p: V3[]; n: V3; d: number; area: number; min: V3; max: V3 }
  const tris: T[] = [];
  const C = 2, N_BIN = Math.max(0.02, 2 * Math.sin((th.zAngleTol * Math.PI) / 180)), D_BIN = Math.max(0.1, th.zNearTol * 1.25), HALF_DIAG = (C * Math.sqrt(3)) / 2;
  const cosTol = Math.cos((th.zAngleTol * Math.PI) / 180);
  const nKey = (a: number, b: number, c: number) => ((a + 64) * 128 + (b + 64)) * 128 + (c + 64);
  const cellKey = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  // normal bin -> (offset bin, cell) -> triangle indices
  const bins = new Map<number, Map<number, number[]>>();
  const inner = (db: number, ck: number) => (db + 512) * 1073741824 + ck;
  /** (cell key, offset bin) for every 2 m cell the triangle's plane passes near. */
  const cellsOf = (t: T): [number, number][] => {
    const out: [number, number][] = [];
    for (let x = Math.floor(t.min[0] / C); x <= Math.floor(t.max[0] / C); x++) for (let y = Math.floor(t.min[1] / C); y <= Math.floor(t.max[1] / C); y++) for (let z = Math.floor(t.min[2] / C); z <= Math.floor(t.max[2] / C); z++) {
      const dist = t.n[0] * (x + 0.5) * C + t.n[1] * (y + 0.5) * C + t.n[2] * (z + 0.5) * C - t.d;
      if (Math.abs(dist) > HALF_DIAG + th.zNearTol) continue; // the plane misses this cell
      out.push([cellKey(x, y, z), Math.round(dist / D_BIN)]);
    }
    return out;
  };
  const tCells: [number, number][][] = [];
  for (let t = 0; t < nTri; t++) {
    const p = triVerts(s, t), {n, area} = triNormal(p[0], p[1], p[2]);
    if (area < 1e-4) continue;
    const d = n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2];
    const min: V3 = [0, 1, 2].map(k => Math.min(p[0][k], p[1][k], p[2][k])) as V3, max: V3 = [0, 1, 2].map(k => Math.max(p[0][k], p[1][k], p[2][k])) as V3;
    const idx = tris.length, T0: T = {i: t, p, n, d, area, min, max};
    tris.push(T0);
    const nk = nKey(Math.round(n[0] / N_BIN), Math.round(n[1] / N_BIN), Math.round(n[2] / N_BIN));
    let m = bins.get(nk); if (!m) { m = new Map(); bins.set(nk, m); }
    const cells = cellsOf(T0);
    tCells.push(cells);
    for (const [ck, db] of cells) { const k = inner(db, ck), l = m.get(k); if (l) l.push(idx); else m.set(k, [idx]); }
  }
  const patches = new Map<string, ZFightPatch>();
  // Overlap per material pair inside each patch: one welded roof can carry slate and glass cells, so the patch is labelled with
  // the pair that covers the most area, not the first one met.
  const matArea = new Map<ZFightPatch, Map<string, number>>();
  const stamp = new Int32Array(tris.length).fill(-1);
  let rng = 0x5eed;
  for (let a = 0; a < tris.length; a++) {
    const A = tris[a], qa = [Math.round(A.n[0] / N_BIN), Math.round(A.n[1] / N_BIN), Math.round(A.n[2] / N_BIN)];
    const maps: Map<number, number[]>[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const m = bins.get(nKey(qa[0] + i, qa[1] + j, qa[2] + k)); if (m) maps.push(m); }
    for (const m of maps) for (const [ck, db] of tCells[a]) for (let dd = -1; dd <= 1; dd++) for (const b of m.get(inner(db + dd, ck)) ?? []) {
      if (b <= a || stamp[b] === a) continue;
      stamp[b] = a;
      const B = tris[b];
      if (A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2] < cosTol) continue;
      if (B.min[0] > A.max[0] + th.zNearTol || A.min[0] > B.max[0] + th.zNearTol || B.min[1] > A.max[1] + th.zNearTol || A.min[1] > B.max[1] + th.zNearTol || B.min[2] > A.max[2] + th.zNearTol || A.min[2] > B.max[2] + th.zNearTol) continue;
      // The larger triangle carries the plane; the smaller one's corners are measured against it. A narrow strip's own normal
      // is noisy in a quantised GLB (3 mm of position error over a 20 cm strip tilts it 1.5 degrees), and extrapolating that
      // plane across a big roof cell would turn the error into centimetres. All corners must lie within the band; the mean
      // (signed) offset says which face is in front.
      const R = A.area >= B.area ? A : B, Q = R === A ? B : A;
      let offMax = 0, sd = 0;
      for (const q of Q.p) { const o = R.n[0] * q[0] + R.n[1] * q[1] + R.n[2] * q[2] - R.d; offMax = Math.max(offMax, Math.abs(o)); sd += o / 3; }
      if (offMax > th.zNearTol) continue;
      const ov = coplanarOverlap(R.p, Q.p, R.n, th.zAbut);
      if (!ov || ov.area < 1e-4) continue;
      const near = Math.abs(sd) > th.zPlaneTol, tight = near && Math.abs(sd) < th.zTightTol, o = ov.area;
      const pa = part[A.i], pb = part[B.i], k = `${Math.min(pa, pb)}|${Math.max(pa, pb)}|${near ? (tight ? 1 : 2) : 0}|${Math.round(R.n[0] * 20)},${Math.round(R.n[1] * 20)},${Math.round(R.n[2] * 20)}`;
      let P = patches.get(k);
      if (!P) {
        const ma = s.materials[s.triMaterial[A.i]].name, mb = s.materials[s.triMaterial[B.i]].name;
        P = {area: 0, near, tight, orientation: R.n[1] > 0.5 ? 'roof' : R.n[1] < -0.5 ? 'underside' : 'wall', normal: R.n, materials: [ma, mb].sort() as [string, string],
          centre: [0, 0, 0], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], y: 0, gap: 0, pairs: 0, trisA: [], trisB: [], samples: [], hidden: false, sameMaterial: false,
          doubleSided: !!(s.materials[s.triMaterial[A.i]].doubleSided && s.materials[s.triMaterial[B.i]].doubleSided)};
        patches.set(k, P);
      }
      // The overlap centroid lies on R's plane; the visibility probe starts from whichever face is in front, or a strip
      // floating 2 cm over a roof would hide the roof under it and read as never drawn.
      const c = ov.centroid, cq: V3 = [c[0] + R.n[0] * sd, c[1] + R.n[1] * sd, c[2] + R.n[2] * sd];
      const g = sd > 0 ? cq : c, rear = sd > 0 ? c : cq;
      // Area-weighted reservoir (A-Res, deterministic LCG): the kept samples estimate the visible share of the patch.
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const key = Math.pow((rng + 1) / 4294967297, 1 / o);
      if (P.samples.length < 64 || key > P.samples[P.samples.length - 1].area) { P.samples.push({p: g, q: rear, area: key}); P.samples.sort((x, y) => y.area - x.area); P.samples.length = Math.min(64, P.samples.length); }
      for (let k2 = 0; k2 < 3; k2++) { P.centre[k2] = (P.centre[k2] * P.area + ov.centroid[k2] * o) / (P.area + o); P.min[k2] = Math.min(P.min[k2], A.min[k2], B.min[k2]); P.max[k2] = Math.max(P.max[k2], A.max[k2], B.max[k2]); }
      P.gap = (P.gap * P.area + Math.abs(sd) * o) / (P.area + o);
      P.area += o;
      P.pairs++;
      { const mk = [s.materials[s.triMaterial[A.i]].name, s.materials[s.triMaterial[B.i]].name].sort().join('\u0000'); let m = matArea.get(P); if (!m) { m = new Map(); matArea.set(P, m); } m.set(mk, (m.get(mk) ?? 0) + o); }
      // trisA: the lower part id's side, trisB: the other part's (the two fighting surfaces, for evidence renders).
      const [ta, tb] = pa <= pb ? [A.i, B.i] : [B.i, A.i];
      if (P.trisA.length < 400 && !P.trisA.includes(ta)) P.trisA.push(ta);
      if (P.trisB.length < 400 && !P.trisB.includes(tb)) P.trisB.push(tb);
    }
  }
  for (const [P, m] of matArea) {
    const ranked = [...m.entries()].sort((x, y) => y[1] - x[1]), total = ranked.reduce((t, e) => t + e[1], 0);
    P.materials = ranked[0][0].split('\u0000') as [string, string];
    P.sameMaterial = ranked.filter(([k]) => { const [a, b] = k.split('\u0000'); return a === b; }).reduce((t, e) => t + e[1], 0) >= 0.9 * total;
  }
  const list = [...patches.values()].filter(p => p.area >= th.zMinPatch).map(p => ({...p, area: +p.area.toFixed(3), gap: +p.gap.toFixed(3), y: +p.centre[1].toFixed(2)}));
  // Visibility: an overlap piece is seen when at least one of seven rays (along the surface normal and six at 55
  // degrees around it), started 2 cm off the front face, leaves the model without hitting anything or the ground. A drum
  // cap under its dome, a band end buried in a pilaster or a slab inside a wall mass never reaches the screen. When both
  // materials are double-sided the rear face is probed the other way too: Centraal's shed roof cells face down and are
  // seen from the air through their back sides.
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
      if (seenFrom(sm.p, P.normal) || (P.doubleSided && seenFrom(sm.q, [-P.normal[0], -P.normal[1], -P.normal[2]]))) seenArea++;
    }
    const f = sampled > 0 ? seenArea / sampled : 1;
    P.rawArea = P.area;
    P.area = +(P.area * f).toFixed(3);
    P.hidden = f === 0;
  }
  // Underside overlaps on the ground plane are never seen.
  const seen = list.filter(p => !p.hidden && p.area >= th.zMinPatch && !(p.orientation === 'underside' && p.max[1] <= 0.05));
  seen.sort((a, b) => b.area - a.area);
  const sum = (l: ZFightPatch[]) => +l.reduce((t, p) => t + p.area, 0).toFixed(2);
  return {area: sum(seen.filter(p => !p.near && !p.sameMaterial)), nearArea: sum(seen.filter(p => p.near)), tightArea: sum(seen.filter(p => p.tight && !p.sameMaterial)),
    sameArea: sum(seen.filter(p => (!p.near || p.tight) && p.sameMaterial)), hiddenArea: +list.reduce((t, p) => t + (p.rawArea ?? p.area) - p.area, 0).toFixed(2),
    pairs: seen.filter(p => !p.near).reduce((t, p) => t + p.pairs, 0), nearPairs: seen.filter(p => p.near).reduce((t, p) => t + p.pairs, 0), patches: seen,
    hidden: list.filter(p => !seen.includes(p)).sort((a, b) => (b.rawArea ?? 0) - (a.rawArea ?? 0))};
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Window rhythm

/**
 * Photo-spec facades fail the rhythm check above these limits. 15%: a facade with one deliberately different opening per
 * ~7 (a door in a row of windows, an entrance arch among cafe arches) still passes, while the American Hotel's canal side
 * before 2026-10-11 (42 of 69 off-size) or its Leidseplein front (22 of 55) fail. Any predicted-missing window fails: it is
 * a gap exactly where the row's own spacing says a window stands, which is what reviewers keep finding by eye.
 */
export const RHYTHM_FAIL = {oddFraction: 0.15, missing: 1};

/** Fail/warn verdict for one measured facade: only photo-spec facades can fail. */
export function rhythmVerdict(f: Pick<RhythmFacade, 'fromSpec' | 'openings' | 'mismatched' | 'missing'>): {fail: boolean; oddFraction: number} {
  const oddFraction = f.openings ? f.mismatched.length / f.openings : 0;
  return {fail: f.fromSpec && (oddFraction > RHYTHM_FAIL.oddFraction || f.missing.length >= RHYTHM_FAIL.missing), oddFraction};
}

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

/**
 * `staggered`: the photo shows a deliberately staggered pattern (a diamond lattice of small windows, Opstandingskerk east
 * gable). Rows then chain together through the half-pitch offsets, so level, missing-column and column-alignment checks do
 * not apply; sizes still must match each other.
 */
export function analyseRhythm(openings: Opening[], opts: {staggered?: boolean} = {}): Pick<RhythmFacade, 'rows' | 'mismatched' | 'missing' | 'misaligned'> {
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
      const bad = (dw > 0.3 && dw > 0.25 * mw) || (dh > 0.4 && dh > 0.25 * mh) || (!opts.staggered && (Math.abs(o.y0 - ms) > 0.35 || Math.abs(o.y1 - mt) > 0.35));
      if (bad) { odd++; mismatched.push(o); }
    }
    // Missing: a gap that is a whole multiple of the regular spacing, between two regular windows of the same size.
    const cs = r.map(o => (o.t0 + o.t1) / 2);
    rowCentres.push(cs);
    if (r.length >= 3 && !opts.staggered) {
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
    if (opts.staggered || a.length < 3 || a.length !== b.length) continue;
    const sp = median(a.slice(1).map((c, k) => c - a[k]));
    b.forEach((c, k) => { const d = Math.abs(c - a[k]); if (d > 0.25 && d < sp * 0.5) misaligned++; });
  }
  return {rows: rowOut, mismatched, missing, misaligned};
}

export function auditRhythm(s: MaterialSoup, facades: FacadeInventory[], fromSpec: boolean): RhythmFacade[] {
  const out: RhythmFacade[] = [];
  for (const f of facades) {
    const m = measureFacade(s, f, 0.1);
    const r = analyseRhythm(m.openings, {staggered: f.staggered});
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
  const real = zfight.patches.filter(p => !p.near && !p.sameMaterial), near = zfight.patches.filter(p => p.near);
  if (zfight.area >= th.zWarnArea) {
    const top = real[0];
    findings.push({kind: 'zfight', severity: zfight.area >= th.zFailArea ? 'fail' : 'warn', message: `${zfight.area.toFixed(1)} m2 coplanar overlap in ${real.length} patches (${zfight.pairs} triangle pairs); worst ${top.area.toFixed(1)} m2 ${top.orientation} ${top.materials.join('/')} at (${top.centre.map(v => v.toFixed(1)).join(', ')})`});
  }
  const tight = zfight.patches.filter(p => p.tight && !p.sameMaterial);
  if (zfight.tightArea >= th.zWarnArea) findings.push({kind: 'zfight-tight', severity: zfight.tightArea >= th.zFailArea ? 'fail' : 'warn', message: `${zfight.tightArea.toFixed(1)} m2 of same-facing faces ${th.zPlaneTol * 100}-${th.zTightTol * 100} cm apart in ${tight.length} patches (bleeds through at distance); worst ${tight[0].area.toFixed(1)} m2 ${tight[0].orientation} ${tight[0].materials.join('/')} ${Math.round(tight[0].gap * 1000)} mm apart at (${tight[0].centre.map(v => v.toFixed(1)).join(', ')})`});
  if (zfight.nearArea >= th.zFailArea) findings.push({kind: 'zfight-near', severity: 'warn', message: `${zfight.nearArea.toFixed(1)} m2 of same-facing faces ${th.zPlaneTol * 100}-${th.zNearTol * 100} cm apart (${near.length} patches, ${zfight.nearPairs} triangle pairs; may z-fight at long range); worst ${near[0].area.toFixed(1)} m2 ${near[0].orientation} ${near[0].materials.join('/')} ${Math.round(near[0].gap * 100)} cm apart at (${near[0].centre.map(v => v.toFixed(1)).join(', ')})`});
  for (const f of rhythm) {
    const odd = f.mismatched.length, miss = f.missing.length;
    if (odd + miss + f.misaligned === 0) continue;
    const v = rhythmVerdict(f);
    findings.push({kind: 'window-rhythm', severity: v.fail ? 'fail' : 'warn', message: `${f.name}: ${f.openings} openings in ${f.rows.length} rows; ${odd} off-size/off-level (${Math.round(v.oddFraction * 100)}%), ${miss} predicted missing, ${f.misaligned} off-axis${f.fromSpec ? ` (photo-spec facade; fails above ${RHYTHM_FAIL.oddFraction * 100}% off-size or any missing)` : ' (inferred facade)'}`});
  }
  const slots = materialSlotCoverage(s);
  if (slots.ratio < 1) {
    findings.push({kind: 'material-slot-coverage', severity: 'warn', message: `${(slots.ratio * 100).toFixed(1)}% of ${slots.area} m2 visible surface carries materialSlot+tint; untagged: ${slots.untagged.slice(0, 4).map(u => `${u.material} ${u.area} m2`).join(', ')}`});
  }
  const counts: Record<string, number> = {
    // Share of visible surface WITHOUT a materialSlot+tint, in tenths of a percent (0 = fully tagged). Gated only for new exports and recorded models.
    'material-slot-untagged-permille': Math.round((1 - slots.ratio) * 1000),
    'opening-floating': byKind('floating').length, 'opening-floating-fail': byKind('floating').filter(i => i.severity === 'fail').length,
    'opening-overhang': byKind('overhang').length, 'opening-overhang-fail': byKind('overhang').filter(i => i.severity === 'fail').length,
    'opening-buried': byKind('buried').length,
    'zfight-m2': Math.round(zfight.area * 10) / 10,
    'zfight-near-m2': Math.round(zfight.nearArea * 10) / 10,
    'zfight-tight-m2': Math.round(zfight.tightArea * 10) / 10,
    // Reported only: a material overlapping itself draws the same colour whichever face wins.
    'zfight-same-m2': Math.round(zfight.sameArea * 10) / 10,
    'window-mismatch': rhythm.reduce((t, f) => t + f.mismatched.length, 0),
    'window-missing': rhythm.reduce((t, f) => t + f.missing.length, 0),
    'window-misaligned': rhythm.reduce((t, f) => t + f.misaligned, 0),
    // Gated: photo-spec facades only.
    'window-rhythm-fail': rhythm.filter(f => rhythmVerdict(f).fail).length,
    'window-mismatch-spec': rhythm.filter(f => f.fromSpec).reduce((t, f) => t + f.mismatched.length, 0),
    'window-missing-spec': rhythm.filter(f => f.fromSpec).reduce((t, f) => t + f.missing.length, 0),
  };
  const score = openings.issues.reduce((t, i) => t + issueWeight(i), 0) + Math.min(zfight.area, 100) * 2 + Math.min(zfight.tightArea, 100) * 1 + Math.min(zfight.nearArea, 100) * 0.3 + counts['window-mismatch'] * 0.5 + counts['window-missing'] + counts['window-misaligned'] * 0.3;
  return {openings, zfight, rhythm, materialSlots: slots, counts, findings, score: +score.toFixed(1)};
}

export interface MaterialSlotCoverage {
  /** Visible surface area (m2): everything except downward faces and the ground plate. */
  area: number;
  /** Area (m2) whose material carries both `materialSlot` and `tint`. */
  tagged: number;
  /** tagged / area, 0..1 (1 for an empty model). */
  ratio: number;
  /** Untagged materials by visible area, largest first. */
  untagged: {material: string; area: number}[];
}

/**
 * Share of visible surface area whose material carries `materialSlot` + `tint` extras: the contract that lets the shared city look (atlas
 * brick, glass gradient, roof cells) dress a model instead of the flat paint it was exported with. Downward faces and triangles lying on the
 * ground plate are not visible and do not count.
 */
export function materialSlotCoverage(s: MaterialSoup): MaterialSlotCoverage {
  const byMat = new Map<number, number>();
  const nTri = s.indices.length / 3;
  for (let t = 0; t < nTri; t++) {
    const [a, b, c] = triVerts(s, t), {n, area} = triNormal(a, b, c);
    if (!(area > 0) || n[1] < -0.9 || (a[1] <= 0.02 && b[1] <= 0.02 && c[1] <= 0.02)) continue;
    byMat.set(s.triMaterial[t], (byMat.get(s.triMaterial[t]) ?? 0) + area);
  }
  let area = 0, tagged = 0;
  const untagged: {material: string; area: number}[] = [];
  for (const [m, a] of byMat) {
    area += a;
    const mat = s.materials[m];
    if (mat?.slot && mat.tint) tagged += a; else untagged.push({material: mat?.name ?? 'unnamed', area: +a.toFixed(1)});
  }
  untagged.sort((p, q) => q.area - p.area);
  return {area: +area.toFixed(1), tagged: +tagged.toFixed(1), ratio: area > 0 ? tagged / area : 1, untagged};
}

/**
 * Gate: which counts grew beyond the recorded baseline (plus slack)? Empty = no new regression.
 * Coplanar overlap since lane zfight-audit 2026-10-13: a new export (no baseline entry) fails above
 * GEOMETRY_THRESHOLDS.zNewExportFail m2 of `zfight-m2` (under 2 cm apart) plus `zfight-tight-m2` (2-3 cm, still bleeds through
 * at distance); the 3-8 cm rest of `zfight-near-m2` is reported, not failed, since renders with the game's projection never
 * showed it bleed. A recorded model may not grow `zfight-m2` or `zfight-tight-m2` past its entry (plus slack). `zfight-near-m2` is never
 * gated: the fix for a 2-3 cm overlay is to lift it to ~5 cm, which moves its area into the near band.
 */
export function regressions(counts: Record<string, number>, baseline: Record<string, number> | undefined): string[] {
  const slack: Record<string, number> = {'zfight-m2': 0.3, 'zfight-tight-m2': 0.3, 'window-mismatch': 1, 'window-missing': 1, 'window-misaligned': 1};
  const hard = new Set(['opening-floating-fail', 'opening-overhang-fail', 'zfight-m2', 'zfight-tight-m2', 'window-rhythm-fail', 'window-mismatch-spec', 'window-missing-spec',
    // Since the 2026-10-13 cleanup pass every detached or sunk window counts, not only the 10 cm fails; a recorded model may not add any.
    'opening-floating', 'opening-buried', 'opening-overhang']);
  // Recorded-only: a model without the key in its entry predates the gate (legacy, reported as a warning); a model with NO entry is a new
  // export and must be 100% tagged.
  const recordedOnly = new Set(['material-slot-untagged-permille', 'opening-floating', 'opening-buried', 'opening-overhang', 'zfight-tight-m2']);
  const out: string[] = [];
  if (!baseline) {
    const z = (counts['zfight-m2'] ?? 0) + (counts['zfight-tight-m2'] ?? 0);
    if (z > GEOMETRY_THRESHOLDS.zNewExportFail) out.push(`coplanar overlap ${+z.toFixed(1)} m2 (under 2 cm ${counts['zfight-m2'] ?? 0} + 2-3 cm ${counts['zfight-tight-m2'] ?? 0}) > ${GEOMETRY_THRESHOLDS.zNewExportFail} m2 allowed for a new export`);
  }
  for (const [k, v] of Object.entries(counts)) {
    const gated = hard.has(k) || k === 'material-slot-untagged-permille';
    if (!gated) continue; // warn-level counts are reported, not gated
    if (!baseline && k.startsWith('zfight-')) continue; // new export: the combined gate above
    if (recordedOnly.has(k) && baseline && baseline[k] === undefined) continue;
    const b = baseline?.[k] ?? 0;
    if (v > b + (slack[k] ?? 0)) out.push(`${k} ${v} > baseline ${b}`);
  }
  return out;
}
