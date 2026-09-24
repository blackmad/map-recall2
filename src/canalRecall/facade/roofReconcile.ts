/**
 * Reconciling a measured roofline into 3DBAG LoD2.2 geometry (task G1).
 *
 * 3DBAG has no gables: `wallTop == roofTop` on effectively every canal-belt
 * building, so a measured roofline profile (from the point cloud, or later a
 * photo method) routinely sits well above the 3DBAG section at the facade.
 * This module compares the two per along-column, classifies the disagreement,
 * and for the "3DBAG is too low" case builds an *additive* gable screen: a
 * thin (0.30 m) shell whose front face sits exactly on the facade plane, whose
 * top follows the fitted gable outline (or the raw profile with no fit), and
 * whose bottom closes onto the 3DBAG section with no gap.
 *
 * v1 is additive-only (plan §7 principle 1): 3DBAG surfaces are read, never
 * cut or moved. Where the profile says 3DBAG is *too high* at the facade
 * (`below`), this abstains and records a conflict rather than guessing at a
 * cut.
 *
 * Frame (plan §3, shared with R1's gold and G2's fit): `along` is metres from
 * `plane.start` towards `plane.end` on the horizontal line through them;
 * `up` is absolute NAP metres; profiles are sampled every `sampleM` (default
 * 0.10 m), with `null` for a missing column.
 */

import type { GableFitMethod, GableFitResult, GableTemplateFit } from './gableFit.ts';
import type { GableType } from './gable.ts';
import { simplifyPolyline } from './pointCloudGeometry.ts';

// --- geometry primitives ------------------------------------------------------

export type Point3 = readonly [number, number, number];
export type Point2 = { x: number; y: number };

const sub3 = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length3 = (a: Point3) => Math.hypot(a[0], a[1], a[2]);

const sub2 = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, y: a.y - b.y });
const dot2 = (a: Point2, b: Point2) => a.x * b.x + a.y * b.y;
const normalize2 = (a: Point2): Point2 => {
  const len = Math.hypot(a.x, a.y);
  return len < 1e-9 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
};

// --- input types ---------------------------------------------------------------

export interface ElevationPlane {
  start: Point2;
  end: Point2;
}

export interface ProfileSample {
  along: number;
  up: number | null;
}

/** One 3DBAG LoD2.2 surface (wall, roof, or any other semantic surface) in RD/NAP. */
export interface BuildingPartSurface {
  id: string;
  vertices: Point3[];
}

/**
 * A G2 result, already decided between `fitGableTemplate` (trusted type) and
 * `fitGable`'s polyline fallback (unknown/ambiguous type) — that decision is
 * the caller's, per `gableFit.ts`'s author note. Either result shape works:
 * both carry a closed (along, up) `outline`.
 */
export interface FittedGable {
  type: GableType;
  method: GableFitMethod;
  /** Closed (along, up) outline, for display/area purposes only. */
  outline: Array<readonly [number, number]>;
  /**
   * The open roofline trace (left base to right base), without the synthetic
   * closing corners a display outline needs. This is what the gable screen's
   * top follows — using the closed `outline` instead would cut the screen
   * back down to its own floor at the ends, which is wrong whenever the
   * measured/fitted shape doesn't itself return to eave height within the
   * elevation's own width (see `gableFit.ts`'s `trace` field).
   */
  trace: Array<readonly [number, number]>;
}

export function fittedGableFrom(fit: GableFitResult): FittedGable {
  return { type: fit.type, method: fit.method, outline: fit.outline, trace: fit.trace };
}

export function fittedGableFromTemplate(fit: GableTemplateFit): FittedGable {
  return { type: fit.type, method: 'template', outline: fit.outline, trace: fit.trace };
}

export interface RoofReconcileInput {
  buildingId: string;
  /** 3DBAG LoD2.2 surfaces for this building part, RD/NAP (CityJSON transform already applied). */
  surfaces: BuildingPartSurface[];
  plane: ElevationPlane;
  /** §3-frame profile, sampled every `sampleM` from `along = 0` to `along = width`. */
  profile: ProfileSample[];
  sampleM?: number;
  /** Relation tolerance, metres. Default 0.30 (plan §7). */
  toleranceM?: number;
  /** Gable screen thickness, metres. Default 0.30 (plan §7). */
  screenThicknessM?: number;
  /**
   * Depth behind the facade plane `S(along)` is read from, for the relation
   * classes and the gable screen's bottom. Default `FACADE_TOP_DEPTH_M`
   * (0.15 m — the facade's own top edge). Widening this conflates "3DBAG has
   * no gable" with "this roof happens to be pitched" — see `computeSection`.
   */
  sectionDepthM?: number;
  /** Depth for the diagnostic-only slab section returned as `sectionSlab`. Default `SLAB_DEPTH_M` (1 m, plan §7's original definition). */
  diagnosticSectionDepthM?: number;
  /** Optional G2 fit. When absent, `rises` spans use the raw profile as the screen top. */
  gable?: FittedGable | null;
}

// --- output types ----------------------------------------------------------------

export type Relation = 'agree' | 'rises' | 'below' | 'unknown';

export interface RelationSpan {
  fromAlong: number;
  toAlong: number;
  relation: Relation;
}

export interface Conflict {
  fromAlong: number;
  toAlong: number;
  kind: 'below' | 'invalid-screen';
  /** For `below`, the largest amount (m) 3DBAG sits above the profile in the span. Unused (0) otherwise. */
  detailM: number;
  note: string;
}

export interface Surface {
  id: string;
  spanAlong: [number, number];
  /** Flat list of (x, y, z) vertices, RD/NAP. */
  vertices: Point3[];
  /** Triangles as indices into `vertices`, CCW seen from the outward side. */
  triangles: [number, number, number][];
  /** Per-triangle unit normal, parallel to `triangles`. */
  normals: Point3[];
}

export interface Provenance {
  buildingId: string;
  toleranceM: number;
  screenThicknessM: number;
  sectionDepthM: number;
  gable: { type: GableType; method: GableFitMethod } | null;
}

export interface RoofReconcileResult {
  /** S(along) at `sectionDepthM` (default: facade-top, 0.15 m) — the basis for relationSpans and the screen bottom. */
  section: ProfileSample[];
  /** S(along) at `diagnosticSectionDepthM` (default: the 1 m slab) — diagnostic only, not used for classification. */
  sectionSlab: ProfileSample[];
  relationSpans: RelationSpan[];
  patch: Surface[] | null;
  conflicts: Conflict[];
  provenance: Provenance;
}

// --- frame derivation --------------------------------------------------------

/**
 * The inward horizontal unit normal of the facade plane: the direction from
 * the plane towards the building's own mass, taken from the 3DBAG footprint
 * (the centroid of every vertex of every given surface), not assumed from the
 * winding order of the two plane endpoints. Used both to read `S(along)` from
 * 1 m behind the plane and to extrude the gable screen inward.
 */
export function deriveInwardNormal(surfaces: readonly BuildingPartSurface[], plane: ElevationPlane, tangent: Point2): Point2 {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const surface of surfaces) {
    for (const vertex of surface.vertices) {
      sx += vertex[0];
      sy += vertex[1];
      n += 1;
    }
  }
  const mid: Point2 = { x: (plane.start.x + plane.end.x) / 2, y: (plane.start.y + plane.end.y) / 2 };
  const candidate: Point2 = { x: -tangent.y, y: tangent.x };
  if (n === 0) return candidate;
  const centroid: Point2 = { x: sx / n, y: sy / n };
  const toCentroid = sub2(centroid, mid);
  return dot2(candidate, toCentroid) >= 0 ? candidate : { x: -candidate.x, y: -candidate.y };
}

// --- S(along): the highest 3DBAG surface point within 1 m behind the plane ---

/** Diagnostic-only "slab" depth (plan §7's original 1 m) — a pitched roof lifts this by its own rise. */
export const SLAB_DEPTH_M = 1;
/**
 * Default depth for the relation classes: the 3DBAG facade's own top edge
 * (wall top, plus whatever roof sliver sits immediately behind it), not the
 * full roof slab. A wider slab conflates "3DBAG has no gable" with "this
 * roof happens to be pitched," which isn't what `rises`/`agree`/`below`
 * should be asking.
 */
export const FACADE_TOP_DEPTH_M = 0.15;
const DEPTH_EPS = 0.02;

/** Fan-triangulate a (near-)convex polygon from its first vertex. Adequate for LoD2.2 wall/roof polygons. */
function fanTriangulate(vertices: readonly Point3[]): Array<[Point3, Point3, Point3]> {
  const triangles: Array<[Point3, Point3, Point3]> = [];
  for (let i = 1; i + 1 < vertices.length; i += 1) triangles.push([vertices[0], vertices[i], vertices[i + 1]]);
  return triangles;
}

type PlaneFrameSample = { along: number; depth: number; up: number };

const toPlaneFrame = (p: Point3, start: Point2, tangent: Point2, inward: Point2): PlaneFrameSample => {
  const dx = p[0] - start.x;
  const dy = p[1] - start.y;
  return { along: dx * tangent.x + dy * tangent.y, depth: dx * inward.x + dy * inward.y, up: p[2] };
};

/**
 * `S(along)`: highest point of any given surface within `[0, width]` along
 * and `[0, depthM]` m depth behind the plane, binned to the same 0.10 m
 * columns as the profile. Triangles are sampled at a barycentric grid fine
 * enough to not skip a column — flat CityJSON polygons make this exact up to
 * sampling resolution, and the resolution is bounded so a handful of
 * building-sized polygons stays fast.
 *
 * `depthM` matters: on a pitched roof that starts right at the eave, a full
 * 1 m slab picks up the roof surface climbing away from the facade, lifting
 * `S` by up to ~1 m even where 3DBAG has no gable at all. `FACADE_TOP_DEPTH_M`
 * (0.15 m) instead reads only the 3DBAG facade's own top edge — the wall's
 * top plus whatever roof sliver sits immediately behind it — which is what
 * "does 3DBAG already show this gable" should be asking.
 */
export function computeSection(
  surfaces: readonly BuildingPartSurface[],
  plane: ElevationPlane,
  tangent: Point2,
  inward: Point2,
  alongs: readonly number[],
  sampleM: number,
  depthM: number = FACADE_TOP_DEPTH_M,
): (number | null)[] {
  const n = alongs.length;
  const maxUp: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return maxUp;
  const width = alongs[n - 1];
  const alongMin = alongs[0] - sampleM / 2;
  const alongMax = width + sampleM / 2;

  for (const surface of surfaces) {
    if (surface.vertices.length < 3) continue;
    for (const tri of fanTriangulate(surface.vertices)) {
      const proj = tri.map((p) => toPlaneFrame(p, plane.start, tangent, inward));
      const trAlongMin = Math.min(...proj.map((p) => p.along));
      const trAlongMax = Math.max(...proj.map((p) => p.along));
      const trDepthMin = Math.min(...proj.map((p) => p.depth));
      const trDepthMax = Math.max(...proj.map((p) => p.depth));
      if (trAlongMax < alongMin || trAlongMin > alongMax) continue;
      if (trDepthMax < -DEPTH_EPS || trDepthMin > depthM + DEPTH_EPS) continue;

      // Resolution is driven by the triangle's own extent in (along, depth) —
      // the axes columns are actually binned on — not its raw 3D edge length:
      // a shallow, wide roof triangle has a long 3D diagonal but only needs
      // enough steps to not skip an along column, while capping 3D edge
      // length underestimates the along resolution needed for a triangle
      // that runs mostly in depth.
      const steps = Math.max(1, Math.min(400, Math.ceil(Math.max(trAlongMax - trAlongMin, trDepthMax - trDepthMin) / (sampleM / 2))));
      for (let i = 0; i <= steps; i += 1) {
        for (let j = 0; j <= steps - i; j += 1) {
          const u = i / steps;
          const v = j / steps;
          const w = 1 - u - v;
          const along = u * proj[0].along + v * proj[1].along + w * proj[2].along;
          const depth = u * proj[0].depth + v * proj[1].depth + w * proj[2].depth;
          if (depth < -DEPTH_EPS || depth > depthM + DEPTH_EPS) continue;
          if (along < alongMin || along > alongMax) continue;
          const up = u * proj[0].up + v * proj[1].up + w * proj[2].up;
          const col = Math.round((along - alongs[0]) / sampleM);
          if (col < 0 || col >= n) continue;
          if (maxUp[col] == null || up > (maxUp[col] as number)) maxUp[col] = up;
        }
      }
    }
  }
  return maxUp;
}

// --- relation classification --------------------------------------------------

function classifyRelations(profile: readonly (number | null)[], section: readonly (number | null)[], toleranceM: number): Relation[] {
  return profile.map((p, i) => {
    const s = section[i];
    if (p == null || s == null) return 'unknown';
    const diff = p - s;
    if (Math.abs(diff) <= toleranceM) return 'agree';
    return diff > 0 ? 'rises' : 'below';
  });
}

function mergeSpans(alongs: readonly number[], relations: readonly Relation[]): RelationSpan[] {
  const spans: RelationSpan[] = [];
  let i = 0;
  while (i < relations.length) {
    let j = i;
    while (j + 1 < relations.length && relations[j + 1] === relations[i]) j += 1;
    spans.push({ fromAlong: alongs[i], toAlong: alongs[j], relation: relations[i] });
    i = j + 1;
  }
  return spans;
}

// --- interpolation helpers -----------------------------------------------------

/** Linear interpolation over a (mostly) contiguous grid; nulls extend from the nearest non-null neighbour. */
function interpGrid(alongs: readonly number[], values: readonly (number | null)[], along: number): number {
  const n = alongs.length;
  if (n === 0) return 0;
  if (along <= alongs[0]) return firstNonNull(values) ?? 0;
  if (along >= alongs[n - 1]) return lastNonNull(values) ?? 0;
  let i = 0;
  while (i + 1 < n && alongs[i + 1] < along) i += 1;
  const a0 = alongs[i];
  const a1 = alongs[Math.min(i + 1, n - 1)];
  const v0 = nearestNonNull(values, i);
  const v1 = nearestNonNull(values, Math.min(i + 1, n - 1));
  if (a1 === a0) return v0;
  const t = (along - a0) / (a1 - a0);
  return v0 + t * (v1 - v0);
}
const firstNonNull = (values: readonly (number | null)[]) => values.find((v): v is number => v != null) ?? null;
const lastNonNull = (values: readonly (number | null)[]) => [...values].reverse().find((v): v is number => v != null) ?? null;
function nearestNonNull(values: readonly (number | null)[], index: number): number {
  if (values[index] != null) return values[index] as number;
  for (let d = 1; d < values.length; d += 1) {
    if (index - d >= 0 && values[index - d] != null) return values[index - d] as number;
    if (index + d < values.length && values[index + d] != null) return values[index + d] as number;
  }
  return 0;
}

function interpCurve(curve: readonly (readonly [number, number])[], along: number): number {
  if (curve.length === 0) return 0;
  if (curve.length === 1) return curve[0][1];
  if (along <= curve[0][0]) return curve[0][1];
  if (along >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  for (let i = 1; i < curve.length; i += 1) {
    const [a0, u0] = curve[i - 1];
    const [a1, u1] = curve[i];
    if (along <= a1) {
      const t = a1 === a0 ? 0 : (along - a0) / (a1 - a0);
      return u0 + t * (u1 - u0);
    }
  }
  return curve[curve.length - 1][1];
}

// --- gable screen construction -------------------------------------------------

const MAX_TRIANGLES_PER_GABLE = 80;
/** front strip + back strip + top cap = 3 * 2*(k-1) triangles, plus 2 side caps (2 triangles each). */
const MAX_COLUMNS = Math.floor((MAX_TRIANGLES_PER_GABLE - 4) / 6) + 1;
const PEAK_ABOVE_RIDGE_MAX_M = 6;
const MIN_TRIANGLE_AREA_M2 = 1e-6;

function clipCurveToSpan(curve: readonly (readonly [number, number])[], fromAlong: number, toAlong: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  points.push([fromAlong, interpCurve(curve, fromAlong)]);
  for (const [along, up] of curve) {
    if (along > fromAlong + 1e-9 && along < toAlong - 1e-9) points.push([along, up]);
  }
  points.push([toAlong, interpCurve(curve, toAlong)]);
  // De-duplicate near-identical alongs (can happen at span boundaries).
  const deduped: Array<[number, number]> = [];
  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(point[0] - last[0]) < 1e-6) continue;
    deduped.push(point);
  }
  return deduped;
}

function capColumns(points: readonly (readonly [number, number])[], maxColumns: number): Array<[number, number]> {
  if (points.length <= maxColumns) return points.map((p) => [p[0], p[1]]);
  let tolerance = 0.05;
  let simplified = simplifyPolyline(points, tolerance);
  while (simplified.length > maxColumns && tolerance < 5) {
    tolerance *= 1.6;
    simplified = simplifyPolyline(points, tolerance);
  }
  if (simplified.length <= maxColumns) return simplified.map((p) => [p[0], p[1]]);
  // Fallback: uniform downsample, always keeping the endpoints.
  const step = (points.length - 1) / (maxColumns - 1);
  const picked: Array<[number, number]> = [];
  for (let i = 0; i < maxColumns; i += 1) {
    const index = Math.round(i * step);
    picked.push([points[index][0], points[index][1]]);
  }
  return picked;
}

const scale3 = (a: Point2, s: number): Point3 => [a.x * s, a.y * s, 0];
const addPoint = (base: Point2, ...offsets: Point3[]): Point3 => {
  let x = base.x;
  let y = base.y;
  let z = 0;
  for (const o of offsets) {
    x += o[0];
    y += o[1];
    z += o[2];
  }
  return [x, y, z];
};

/** Reorder a triangle's vertices so its cross-product normal points roughly towards `target`. */
function ensureWinding(tri: [Point3, Point3, Point3], target: Point3): { tri: [Point3, Point3, Point3]; normal: Point3 } {
  const normal = cross3(sub3(tri[1], tri[0]), sub3(tri[2], tri[0]));
  const len = length3(normal);
  if (len < 1e-12) return { tri, normal: [0, 0, 0] };
  const unit: Point3 = [normal[0] / len, normal[1] / len, normal[2] / len];
  if (dot3(unit, target) >= 0) return { tri, normal: unit };
  return { tri: [tri[0], tri[2], tri[1]], normal: [-unit[0], -unit[1], -unit[2]] };
}

function triangleArea(tri: readonly [Point3, Point3, Point3]): number {
  return length3(cross3(sub3(tri[1], tri[0]), sub3(tri[2], tri[0]))) / 2;
}

interface ScreenBuildInput {
  buildingId: string;
  span: RelationSpan;
  alongs: readonly number[];
  section: readonly (number | null)[];
  gable: FittedGable | null;
  fallbackProfile: readonly (number | null)[];
  plane: ElevationPlane;
  tangent: Point2;
  inward: Point2;
  thicknessM: number;
  ridgeUp: number;
}

function buildGableScreen(input: ScreenBuildInput): { surface: Surface | null; reason: string | null } {
  const { span, alongs, section, gable, fallbackProfile, plane, tangent, inward, thicknessM, ridgeUp, buildingId } = input;

  const rawCurve: Array<[number, number]> = gable
    ? gable.trace.map((p) => [p[0], p[1]] as [number, number])
    : alongs.map((a, i) => [a, fallbackProfile[i]] as [number, number]).filter((p): p is [number, number] => p[1] != null);
  if (rawCurve.length < 2) return { surface: null, reason: 'no top curve available over the span' };

  const clipped = clipCurveToSpan(rawCurve, span.fromAlong, span.toAlong);
  const columns = capColumns(clipped, MAX_COLUMNS);
  if (columns.length < 2) return { surface: null, reason: 'fewer than two columns after simplification' };

  const columnAlongs = columns.map((c) => c[0]);
  const topUps = columns.map((c) => c[1]);
  const bottomUps = columnAlongs.map((a) => interpGrid(alongs, section, a));
  const clampedTop = topUps.map((up, i) => Math.max(up, bottomUps[i]));

  const peak = Math.max(...clampedTop);
  if (peak > ridgeUp + PEAK_ABOVE_RIDGE_MAX_M) {
    return { surface: null, reason: `peak ${peak.toFixed(2)} m exceeds the 3DBAG ridge (${ridgeUp.toFixed(2)} m) + ${PEAK_ABOVE_RIDGE_MAX_M} m` };
  }

  const toXYZ = (along: number, depth: number, up: number): Point3 =>
    addPoint(plane.start, scale3(tangent, along), scale3(inward, depth), [0, 0, up]);

  const k = columnAlongs.length;
  const frontBottom = columnAlongs.map((a, i) => toXYZ(a, 0, bottomUps[i]));
  const frontTop = columnAlongs.map((a, i) => toXYZ(a, 0, clampedTop[i]));
  const backBottom = columnAlongs.map((a, i) => toXYZ(a, thicknessM, bottomUps[i]));
  const backTop = columnAlongs.map((a, i) => toXYZ(a, thicknessM, clampedTop[i]));

  const outwardTarget: Point3 = [-inward.x, -inward.y, 0];
  const inwardTarget: Point3 = [inward.x, inward.y, 0];
  const upOutwardTarget: Point3 = [-inward.x, -inward.y, 1];

  const vertices: Point3[] = [];
  const triangles: [number, number, number][] = [];
  const normals: Point3[] = [];
  const pushTri = (a: Point3, b: Point3, c: Point3, target: Point3) => {
    const { tri, normal } = ensureWinding([a, b, c], target);
    if (triangleArea(tri) < MIN_TRIANGLE_AREA_M2) return;
    const base = vertices.length;
    vertices.push(tri[0], tri[1], tri[2]);
    triangles.push([base, base + 1, base + 2]);
    normals.push(normal);
  };

  for (let i = 0; i + 1 < k; i += 1) {
    // Front face (coplanar with the facade plane).
    pushTri(frontBottom[i], frontTop[i], frontBottom[i + 1], outwardTarget);
    pushTri(frontTop[i], frontTop[i + 1], frontBottom[i + 1], outwardTarget);
    // Back face, offset thicknessM inward.
    pushTri(backBottom[i], backBottom[i + 1], backTop[i], inwardTarget);
    pushTri(backTop[i], backBottom[i + 1], backTop[i + 1], inwardTarget);
    // Top cap, connecting the front and back top edges.
    pushTri(frontTop[i], backTop[i], frontTop[i + 1], upOutwardTarget);
    pushTri(backTop[i], backTop[i + 1], frontTop[i + 1], upOutwardTarget);
  }
  // Side caps, closing the two ends of the screen (skipped where degenerate).
  const leftTarget: Point3 = [-tangent.x, -tangent.y, 0];
  const rightTarget: Point3 = [tangent.x, tangent.y, 0];
  pushTri(frontBottom[0], backBottom[0], frontTop[0], leftTarget);
  pushTri(backBottom[0], backTop[0], frontTop[0], leftTarget);
  pushTri(frontBottom[k - 1], frontTop[k - 1], backBottom[k - 1], rightTarget);
  pushTri(backBottom[k - 1], frontTop[k - 1], backTop[k - 1], rightTarget);

  if (triangles.length === 0) return { surface: null, reason: 'every triangle degenerated to zero area' };
  if (triangles.length > MAX_TRIANGLES_PER_GABLE) {
    return { surface: null, reason: `${triangles.length} triangles exceeds the ${MAX_TRIANGLES_PER_GABLE}-triangle budget` };
  }

  // Coplanarity: every front vertex must have zero depth offset from the plane.
  const maxFrontDepth = Math.max(
    ...frontBottom.map((p) => Math.abs(dot2({ x: p[0] - plane.start.x, y: p[1] - plane.start.y }, inward))),
    ...frontTop.map((p) => Math.abs(dot2({ x: p[0] - plane.start.x, y: p[1] - plane.start.y }, inward))),
  );
  if (maxFrontDepth > 0.01) return { surface: null, reason: `front face is ${maxFrontDepth.toFixed(3)} m off the facade plane` };

  return {
    surface: {
      id: `${buildingId}:gable:${span.fromAlong.toFixed(2)}-${span.toAlong.toFixed(2)}`,
      spanAlong: [span.fromAlong, span.toAlong],
      vertices,
      triangles,
      normals,
    },
    reason: null,
  };
}

// --- top-level reconcile ---------------------------------------------------------

export function reconcile(input: RoofReconcileInput): RoofReconcileResult {
  const sampleM = input.sampleM ?? 0.1;
  const toleranceM = input.toleranceM ?? 0.3;
  const thicknessM = input.screenThicknessM ?? 0.3;
  const sectionDepthM = input.sectionDepthM ?? FACADE_TOP_DEPTH_M;
  const diagnosticSectionDepthM = input.diagnosticSectionDepthM ?? SLAB_DEPTH_M;
  const plane = input.plane;

  const tangent = normalize2(sub2(plane.end, plane.start));
  const inward = deriveInwardNormal(input.surfaces, plane, tangent);

  const alongs = input.profile.map((s) => s.along);
  const profileUp = input.profile.map((s) => s.up);
  const section = computeSection(input.surfaces, plane, tangent, inward, alongs, sampleM, sectionDepthM);
  const sectionSlab =
    diagnosticSectionDepthM === sectionDepthM
      ? section
      : computeSection(input.surfaces, plane, tangent, inward, alongs, sampleM, diagnosticSectionDepthM);

  const relations = classifyRelations(profileUp, section, toleranceM);
  const relationSpans = mergeSpans(alongs, relations);

  const ridgeUp = section.reduce<number>((max, v) => (v != null && v > max ? v : max), -Infinity);
  const finiteRidgeUp = Number.isFinite(ridgeUp) ? ridgeUp : 0;

  const conflicts: Conflict[] = [];
  const patchSurfaces: Surface[] = [];

  for (const span of relationSpans) {
    if (span.relation === 'below') {
      let deficit = 0;
      for (let i = 0; i < alongs.length; i += 1) {
        if (alongs[i] < span.fromAlong - 1e-9 || alongs[i] > span.toAlong + 1e-9) continue;
        const p = profileUp[i];
        const s = section[i];
        if (p == null || s == null) continue;
        deficit = Math.max(deficit, s - p);
      }
      conflicts.push({
        fromAlong: span.fromAlong,
        toAlong: span.toAlong,
        kind: 'below',
        detailM: deficit,
        note: '3DBAG is higher than the measured profile at the facade — abstaining (v1 is additive-only)',
      });
      continue;
    }
    if (span.relation !== 'rises') continue;

    const built = buildGableScreen({
      buildingId: input.buildingId,
      span,
      alongs,
      section,
      gable: input.gable ?? null,
      fallbackProfile: profileUp,
      plane,
      tangent,
      inward,
      thicknessM,
      ridgeUp: finiteRidgeUp,
    });
    if (built.surface) {
      patchSurfaces.push(built.surface);
    } else {
      conflicts.push({
        fromAlong: span.fromAlong,
        toAlong: span.toAlong,
        kind: 'invalid-screen',
        detailM: 0,
        note: built.reason ?? 'screen construction failed',
      });
    }
  }

  return {
    section: alongs.map((along, i) => ({ along, up: section[i] })),
    sectionSlab: alongs.map((along, i) => ({ along, up: sectionSlab[i] })),
    relationSpans,
    patch: patchSurfaces.length ? patchSurfaces : null,
    conflicts,
    provenance: {
      buildingId: input.buildingId,
      toleranceM,
      screenThicknessM: thicknessM,
      sectionDepthM,
      gable: input.gable ? { type: input.gable.type, method: input.gable.method } : null,
    },
  };
}
