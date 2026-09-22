/**
 * Does an A0 strip wall actually lie on a 3DBAG LoD2.2 `WallSurface`?
 *
 * The strip cutter records the wall's RD endpoints in its manifest (task A0).
 * Those endpoints were originally taken from a 3DBAG `WallSurface`, so the check
 * is a guard, not a search: if the generator is right the wall is coplanar with
 * the surface (well under a centimetre) and exactly parallel. A stale manifest,
 * a re-cut against a republished 3DBAG, or a footprint edge that was never a
 * surface all show up here as a mismatch, and a mismatched wall must not be
 * reconciled against geometry it does not belong to.
 *
 * The geometry is planar and metric (RD New, EPSG:28992), so the whole test is
 * a line and a plane in plan: the perpendicular offset from the A0 wall line to
 * the 3DBAG plane, the angle between their directions, and how much of the A0
 * wall the surface's along-extent covers. Heights are carried only as a band
 * overlap, because A0's `topNap` deliberately reaches above the 3DBAG wall top
 * to leave sky headroom and so cannot be contained by the surface.
 */
import type { FacadeWallPlane } from '../building/facadePointCloud.ts';
import type { ProjectedPoint } from './sources.ts';

/** Largest perpendicular distance from the A0 wall line to the surface, metres. */
export const WALL_OFFSET_TOLERANCE_M = 0.5;
/** Largest angle between the A0 wall direction and the surface direction, degrees. */
export const WALL_ANGLE_TOLERANCE_DEG = 5;

/**
 * One A0 wall, in the frame the manifest records: RD metres for the endpoints,
 * NAP metres for the vertical band. `leftEdge` names which endpoint is the
 * rectified strip's left edge; it does not change the geometry, but it is
 * carried so the wall's orientation is not reconstructed from rounded sizes.
 */
export type A0WallFrame = {
  pandId: string;
  start: ProjectedPoint;
  end: ProjectedPoint;
  bottomNap?: number | null;
  topNap?: number | null;
  leftEdge?: 'start' | 'end' | null;
};

export type WallSurfaceRelation = 'match' | 'no-surface' | 'offset' | 'angle' | 'no-overlap';

export type WallSurfaceMatch = {
  relation: WallSurfaceRelation;
  /** True exactly when the wall must be dropped from the reconciliation input. */
  excluded: boolean;
  surfaceId: string | null;
  /** Absolute perpendicular distance from the A0 wall line to the surface plane, metres. */
  offsetM: number | null;
  /** Positive when the A0 line sits on the outward-normal side of the plane. */
  signedOffsetM: number | null;
  /** Angle between the A0 wall direction and the surface direction, degrees. */
  angleDeg: number | null;
  /** Length of the along-overlap between the A0 wall and the surface extent, metres. */
  overlapM: number | null;
  /** `overlapM` divided by the A0 wall length. */
  overlapFraction: number | null;
  /** Overlap of the A0 NAP band with the surface's z range, metres; null when no band is given. */
  verticalOverlapM: number | null;
};

export type WallSurfaceMatchOptions = {
  offsetToleranceM?: number;
  angleToleranceDeg?: number;
};

const DEGREES = 180 / Math.PI;

const dot2 = (a: ProjectedPoint, b: ProjectedPoint) => a.x * b.x + a.y * b.y;
const sub2 = (a: ProjectedPoint, b: ProjectedPoint): ProjectedPoint => ({ x: a.x - b.x, y: a.y - b.y });
const normalize2 = (a: ProjectedPoint): ProjectedPoint | null => {
  const length = Math.hypot(a.x, a.y);
  return length < 1e-9 ? null : { x: a.x / length, y: a.y / length };
};

type Candidate = {
  surface: FacadeWallPlane;
  relation: WallSurfaceRelation;
  offsetM: number;
  signedOffsetM: number;
  angleDeg: number;
  overlapM: number;
  overlapFraction: number;
  verticalOverlapM: number | null;
};

const measureCandidate = (
  frame: A0WallFrame,
  surface: FacadeWallPlane,
  offsetToleranceM: number,
  angleToleranceDeg: number,
): Candidate | null => {
  const length = Math.hypot(frame.end.x - frame.start.x, frame.end.y - frame.start.y);
  if (length < 1e-6 || surface.vertices.length < 3) return null;
  const tangent: ProjectedPoint = { x: (frame.end.x - frame.start.x) / length, y: (frame.end.y - frame.start.y) / length };
  const planNormal = normalize2({ x: surface.normal[0], y: surface.normal[1] });
  if (!planNormal) return null;

  const anchor = surface.vertices[0];
  const signedOffsetM = dot2({ x: frame.start.x - anchor[0], y: frame.start.y - anchor[1] }, planNormal);
  const offsetM = Math.abs(signedOffsetM);

  // The surface's in-plane horizontal direction is the plane normal rotated 90°.
  // Direction sign is arbitrary, so the angle is taken through the absolute dot.
  const surfaceDirection: ProjectedPoint = { x: -planNormal.y, y: planNormal.x };
  const cosine = Math.min(1, Math.abs(dot2(tangent, surfaceDirection)));
  const angleDeg = Math.acos(cosine) * DEGREES;

  const alongOf = (vertex: readonly number[]) => dot2(sub2({ x: vertex[0], y: vertex[1] }, frame.start), tangent);
  let surfaceMinAlong = Infinity;
  let surfaceMaxAlong = -Infinity;
  for (const vertex of surface.vertices) {
    const along = alongOf(vertex);
    surfaceMinAlong = Math.min(surfaceMinAlong, along);
    surfaceMaxAlong = Math.max(surfaceMaxAlong, along);
  }
  const overlapM = Math.max(0, Math.min(length, surfaceMaxAlong) - Math.max(0, surfaceMinAlong));
  const overlapFraction = overlapM / length;

  let verticalOverlapM: number | null = null;
  if (frame.bottomNap != null && frame.topNap != null) {
    const zs = surface.vertices.map((vertex) => vertex[2]);
    const surfaceMinZ = Math.min(...zs);
    const surfaceMaxZ = Math.max(...zs);
    verticalOverlapM = Math.max(0, Math.min(frame.topNap, surfaceMaxZ) - Math.max(frame.bottomNap, surfaceMinZ));
  }

  let relation: WallSurfaceRelation;
  if (offsetM > offsetToleranceM) relation = 'offset';
  else if (angleDeg > angleToleranceDeg) relation = 'angle';
  else if (overlapM <= 1e-6) relation = 'no-overlap';
  else if (verticalOverlapM != null && verticalOverlapM <= 1e-6) relation = 'no-overlap';
  else relation = 'match';

  return { surface, relation, offsetM, signedOffsetM, angleDeg, overlapM, overlapFraction, verticalOverlapM };
};

/**
 * Best relation of an A0 wall to the surfaces of one pand.
 *
 * A match wins; otherwise the surface that was closest to being one is reported
 * — most along-overlap first, then least offset — so the exclusion carries a
 * reason instead of a bare boolean. When the pand has no usable wall surfaces at
 * all the relation is `no-surface`.
 */
export function matchWallSurface(
  frame: A0WallFrame,
  surfaces: readonly FacadeWallPlane[],
  options: WallSurfaceMatchOptions = {},
): WallSurfaceMatch {
  const offsetToleranceM = options.offsetToleranceM ?? WALL_OFFSET_TOLERANCE_M;
  const angleToleranceDeg = options.angleToleranceDeg ?? WALL_ANGLE_TOLERANCE_DEG;

  const candidates = surfaces
    .map((surface) => measureCandidate(frame, surface, offsetToleranceM, angleToleranceDeg))
    .filter((candidate): candidate is Candidate => candidate !== null);

  if (candidates.length === 0) {
    return {
      relation: 'no-surface',
      excluded: true,
      surfaceId: null,
      offsetM: null,
      signedOffsetM: null,
      angleDeg: null,
      overlapM: null,
      overlapFraction: null,
      verticalOverlapM: null,
    };
  }

  const rank = (candidate: Candidate) => (candidate.relation === 'match' ? 0 : 1);
  candidates.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.overlapFraction - a.overlapFraction ||
      a.offsetM - b.offsetM ||
      a.angleDeg - b.angleDeg,
  );
  const best = candidates[0];
  return {
    relation: best.relation,
    excluded: best.relation !== 'match',
    surfaceId: best.surface.surfaceId,
    offsetM: best.offsetM,
    signedOffsetM: best.signedOffsetM,
    angleDeg: best.angleDeg,
    overlapM: best.overlapM,
    overlapFraction: best.overlapFraction,
    verticalOverlapM: best.verticalOverlapM,
  };
}
