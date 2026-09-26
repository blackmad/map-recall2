/**
 * True eave (wall-top) NAP height for a canonical wall, measured from a 3DBAG
 * owner's LoD2.2 wall surfaces in local metres.
 *
 * The pipeline otherwise uses the BAG `height` attribute, which is the ridge.
 * Using that for a projected vertical lifts the facade above its own roofline.
 * Here the canonical wall (two RD endpoints) is matched against the owner's
 * coplanar `type:'wall'` surfaces, whose local `up` axis is NAP minus a datum
 * offset, and the highest matched vertex becomes the wall top.
 *
 * Owner scene frame (see scripts/da-costa-block/neighbourhood-core.ts):
 *   owner.geometry.frame.originRD      local origin in RD metres
 *   owner.geometry.frame.heightDatum   e.g. 'legacy-block-NAP-minus-0.65m'
 *   owner.geometry.building.surfaces[] { type, rings: [east, up, south][] }
 *   local -> RD:  rd.x = origin.x + local.x, rd.y = origin.y - local.z
 *   local up:     NAP  = local.y + datumOffsetNAP
 */

/** Fallback scene datum when `heightDatum` is absent or unrecognised. */
export const DEFAULT_DATUM_OFFSET_NAP = 0.65;
const DEFAULT_PLANE_TOLERANCE_M = 0.8;
const DEFAULT_MINIMUM_COVERAGE = 0.8;
const MIN_WALL_VERTICES = 3;
const MIN_WALL_LENGTH_M = 1e-6;

export interface WallTopResult {
  /** Best eave NAP height: matched wall top, or `groundNAP + height` fallback. */
  topNAP: number;
  /** Indices into `owner.geometry.building.surfaces` that contributed. */
  surfaceIndices: number[];
  /** Fraction of the query wall length covered by matched surfaces. */
  coverageFraction: number;
  matched: boolean;
  source: '3dbag-wall-surface' | 'ground-plus-height-fallback';
}

export interface WallTopOptions {
  /** Maximum horizontal distance of a surface vertex from the wall line. */
  planeToleranceM?: number;
  /** Minimum along-wall fraction a single surface must cover to match. */
  minimumCoverage?: number;
}

export interface RdWall {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * The scene datum offset is derivable from the published `heightDatum` string
 * so a `'NAP'` or non-legacy owner is not silently shifted by 0.65 m. Unknown
 * or malformed datums keep the established legacy offset.
 */
function datumOffsetNAP(heightDatum: unknown): number {
  if (typeof heightDatum === 'string') {
    const legacy = /NAP-minus-([0-9]+(?:\.[0-9]+)?)m/i.exec(heightDatum);
    if (legacy) {
      const value = Number(legacy[1]);
      if (Number.isFinite(value)) return value;
    }
    if (/^NAP$/i.test(heightDatum.trim())) return 0;
  }
  return DEFAULT_DATUM_OFFSET_NAP;
}

const finitePoint = (point: unknown): point is number[] =>
  Array.isArray(point) && point.length >= 3
  && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Number.isFinite(point[2]);

/** Union length of possibly overlapping along-wall intervals, clamped to the wall. */
function unionLength(intervals: number[][]): number {
  intervals.sort((left, right) => left[0] - right[0]);
  let length = 0;
  let end = -Infinity;
  for (const [low, high] of intervals) {
    length += Math.max(0, high - Math.max(low, end));
    end = Math.max(end, high);
  }
  return length;
}

export function wallTopNAP(owner: any, wall: RdWall, options: WallTopOptions = {}): WallTopResult {
  const planeToleranceM = options.planeToleranceM ?? DEFAULT_PLANE_TOLERANCE_M;
  const minimumCoverage = options.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE;
  const offsetNAP = datumOffsetNAP(owner?.geometry?.frame?.heightDatum);

  const fallback = (): WallTopResult => {
    const groundNAP = Number(owner?.geometry?.building?.groundNAP);
    const height = Number(owner?.geometry?.building?.height);
    const topNAP = (Number.isFinite(groundNAP) ? groundNAP : 0) + (Number.isFinite(height) ? height : 0);
    return { topNAP, surfaceIndices: [], coverageFraction: 0, matched: false, source: 'ground-plus-height-fallback' };
  };

  const frame = owner?.geometry?.frame?.originRD;
  if (!frame || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)
    || !wall?.start || !wall?.end) return fallback();
  if (!Number.isFinite(wall.start.x) || !Number.isFinite(wall.start.y)
    || !Number.isFinite(wall.end.x) || !Number.isFinite(wall.end.y)) return fallback();

  // Query wall in the owner's local (east, south) plane.
  const ax = wall.start.x - frame.x;
  const az = frame.y - wall.start.y;
  const bx = wall.end.x - frame.x;
  const bz = frame.y - wall.end.y;
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < MIN_WALL_LENGTH_M) return fallback();
  const ux = dx / length;
  const uz = dz / length;

  const surfaces: any[] = Array.isArray(owner?.geometry?.building?.surfaces)
    ? owner.geometry.building.surfaces : [];
  const matchedIntervals: number[][] = [];
  const surfaceIndices: number[] = [];
  const topsNAP: number[] = [];

  for (let index = 0; index < surfaces.length; index++) {
    const surface = surfaces[index];
    if (!surface || surface.type !== 'wall') continue;
    const rings: unknown[] = Array.isArray(surface.rings) ? surface.rings : [];
    // Flattening tolerates outer ring plus any published holes, and an open
    // ring (first vertex != last) needs no special case because only vertex
    // distance and the along-wall span are read, not edge adjacency.
    const vertices = rings.flat().filter(finitePoint);
    if (vertices.length < MIN_WALL_VERTICES) continue;

    let maxDistance = 0;
    let lowest = Infinity;
    let highest = -Infinity;
    for (const point of vertices) {
      const along = (point[0] - ax) * ux + (point[2] - az) * uz;
      const distance = Math.abs((point[0] - ax) * uz - (point[2] - az) * ux);
      if (distance > maxDistance) maxDistance = distance;
      if (along < lowest) lowest = along;
      if (along > highest) highest = along;
    }
    if (maxDistance > planeToleranceM) continue;

    const clippedLow = Math.max(0, lowest);
    const clippedHigh = Math.min(length, highest);
    if (clippedHigh - clippedLow <= 0) continue;
    if ((clippedHigh - clippedLow) / length < minimumCoverage) continue;

    matchedIntervals.push([clippedLow, clippedHigh]);
    surfaceIndices.push(index);
    let topNAP = -Infinity;
    for (const point of vertices) {
      const candidate = point[1] + offsetNAP;
      if (candidate > topNAP) topNAP = candidate;
    }
    topsNAP.push(topNAP);
  }

  if (!surfaceIndices.length) return fallback();

  const coverageFraction = Math.min(1, unionLength(matchedIntervals) / length);
  return { topNAP: Math.max(...topsNAP), surfaceIndices, coverageFraction, matched: true, source: '3dbag-wall-surface' };
}
