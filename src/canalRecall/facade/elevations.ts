import type { ProjectedPoint } from './sources.ts';

export interface SourceVertexRange {
  /** Original BAG vertex indices retained by this merged wall, in wall order. */
  vertexIndices: number[];
  /** Original BAG edge start indices retained by this merged wall. */
  edgeIndices: number[];
}

export interface Elevation {
  /** Stable for a pand and metric wall endpoints; independent of ring start/direction. */
  elevationId: string;
  /** Compatibility/order index within the canonical counter-clockwise ring. */
  index: number;
  start: ProjectedPoint;
  end: ProjectedPoint;
  midpoint: ProjectedPoint;
  /** Unit normal pointing away from the building interior. */
  normal: ProjectedPoint;
  lengthM: number;
  /** Compass bearing the elevation faces, degrees clockwise from north. */
  facingDeg: number;
  sourceVertexRange: SourceVertexRange;
}

interface IndexedPoint extends ProjectedPoint { sourceIndex: number; }

const distance = (a: ProjectedPoint, b: ProjectedPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const quantiseMillimetres = (value: number) => Math.round(value * 1000);

/** Signed area; positive when the ring runs counter-clockwise. */
export const signedRingArea = (ring: readonly ProjectedPoint[]) => {
  let twiceArea = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    twiceArea += ring[previous].x * ring[index].y - ring[index].x * ring[previous].y;
  }
  return twiceArea / 2;
};

export const ringIsCounterClockwise = (ring: readonly ProjectedPoint[]) => signedRingArea(ring) > 0;
const rotate = <T>(items: readonly T[], start: number): T[] => [...items.slice(start), ...items.slice(0, start)];

/**
 * Canonicalise a BAG outer ring without inventing geometry.
 *
 * Adjacent/closing duplicates are removed, orientation becomes CCW, and the
 * lexicographically smallest millimetre coordinate starts the ring. Original
 * vertex indices survive so later review can trace a wall back to the survey.
 */
export function normaliseFootprintRing(footprint: readonly ProjectedPoint[], duplicateToleranceM = 0.001): IndexedPoint[] {
  const ring: IndexedPoint[] = [];
  footprint.forEach((point, sourceIndex) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const previous = ring.at(-1);
    if (!previous || distance(previous, point) > duplicateToleranceM) ring.push({ ...point, sourceIndex });
  });
  if (ring.length > 1 && distance(ring[0], ring.at(-1)!) <= duplicateToleranceM) ring.pop();
  if (ring.length < 3 || Math.abs(signedRingArea(ring)) < 1e-6) return [];
  const oriented = ringIsCounterClockwise(ring) ? ring : [...ring].reverse();
  let canonicalStart = 0;
  for (let index = 1; index < oriented.length; index++) {
    const candidate = [quantiseMillimetres(oriented[index].x), quantiseMillimetres(oriented[index].y), oriented[index].sourceIndex];
    const current = [quantiseMillimetres(oriented[canonicalStart].x), quantiseMillimetres(oriented[canonicalStart].y), oriented[canonicalStart].sourceIndex];
    if (candidate[0] < current[0] || (candidate[0] === current[0] && (candidate[1] < current[1] || (candidate[1] === current[1] && candidate[2] < current[2])))) canonicalStart = index;
  }
  return rotate(oriented, canonicalStart);
}

const bearing = (a: ProjectedPoint, b: ProjectedPoint) => Math.atan2(b.y - a.y, b.x - a.x);
const angleDifference = (left: number, right: number) => {
  let difference = Math.abs(left - right) % (Math.PI * 2);
  if (difference > Math.PI) difference = Math.PI * 2 - difference;
  return difference;
};

const stableHash = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

export interface BuildElevationOptions {
  pandId?: string;
  /** Merge only survey-collinear edges; broad façade-shape simplification is forbidden. */
  collinearToleranceDeg?: number;
  minLengthM?: number;
}

export function buildElevations(
  footprint: readonly ProjectedPoint[],
  { pandId = 'unkeyed', collinearToleranceDeg = 0.75, minLengthM = 0 }: BuildElevationOptions = {},
): Elevation[] {
  const ring = normaliseFootprintRing(footprint);
  if (ring.length < 3) return [];
  const tolerance = collinearToleranceDeg * Math.PI / 180;
  const edgeBearing = (index: number) => bearing(ring[index], ring[(index + 1) % ring.length]);
  const runs: number[][] = [];
  for (let index = 0; index < ring.length; index++) {
    const last = runs.at(-1);
    if (last && angleDifference(edgeBearing(last.at(-1)!), edgeBearing(index)) <= tolerance) last.push(index);
    else runs.push([index]);
  }
  if (runs.length > 1 && angleDifference(edgeBearing(runs.at(-1)!.at(-1)!), edgeBearing(runs[0][0])) <= tolerance) {
    runs[0] = [...runs.pop()!, ...runs[0]];
  }

  const elevations: Elevation[] = [];
  for (const run of runs) {
    const start = ring[run[0]];
    const end = ring[(run.at(-1)! + 1) % ring.length];
    const lengthM = distance(start, end);
    if (lengthM < Math.max(minLengthM, 1e-6)) continue;
    const dx = (end.x - start.x) / lengthM;
    const dy = (end.y - start.y) / lengthM;
    const normal = { x: dy, y: -dx };
    const endpointKey = `${quantiseMillimetres(start.x)},${quantiseMillimetres(start.y)}:${quantiseMillimetres(end.x)},${quantiseMillimetres(end.y)}`;
    elevations.push({
      elevationId: `${pandId}:e:${stableHash(endpointKey)}`,
      index: elevations.length,
      start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y },
      midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      normal, lengthM,
      facingDeg: ((Math.atan2(normal.x, normal.y) * 180 / Math.PI) + 360) % 360,
      sourceVertexRange: { vertexIndices: [...run.map(index => ring[index].sourceIndex), end.sourceIndex], edgeIndices: run.map(index => ring[index].sourceIndex) },
    });
  }
  return elevations;
}

export const inFrontOf = (elevation: Elevation, point: ProjectedPoint) =>
  (point.x - elevation.midpoint.x) * elevation.normal.x + (point.y - elevation.midpoint.y) * elevation.normal.y > 0;

export const standoffM = (elevation: Elevation, point: ProjectedPoint) =>
  (point.x - elevation.midpoint.x) * elevation.normal.x + (point.y - elevation.midpoint.y) * elevation.normal.y;

/** 0° is square-on; 90° is grazing the wall. */
export function obliquityDeg(elevation: Elevation, camera: ProjectedPoint): number {
  const dx = camera.x - elevation.midpoint.x;
  const dy = camera.y - elevation.midpoint.y;
  const separation = Math.hypot(dx, dy);
  if (separation < 1e-6) return 90;
  const cosine = (dx * elevation.normal.x + dy * elevation.normal.y) / separation;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

const cross = (origin: ProjectedPoint, a: ProjectedPoint, b: ProjectedPoint) =>
  (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

/** Strict crossing; shared endpoints do not count as occlusion. */
export function segmentsCross(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
