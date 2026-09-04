/**
 * Splitting a footprint into elevations.
 *
 * The build prompt is specific that reconstruction fidelity follows evidence
 * *per elevation, not per building*. A canal house's front may be photographed
 * from the quay a hundred times while its rear and its party-wall returns are
 * never seen at all, and a pipeline that records one observation tier per
 * building either throws away the front or invents the back.
 *
 * So a footprint becomes a small set of elevations, each with its own outward
 * normal, and everything downstream — visibility, rectification, measurement,
 * fidelity tier — is keyed to one of those.
 */
import type { ProjectedPoint } from './sources.ts';

export interface Elevation {
  /** Index within its own building, stable for a given footprint. */
  index: number;
  start: ProjectedPoint;
  end: ProjectedPoint;
  midpoint: ProjectedPoint;
  /** Unit normal pointing away from the building interior. */
  normal: ProjectedPoint;
  lengthM: number;
  /** Compass bearing the elevation faces, degrees clockwise from north. */
  facingDeg: number;
}

const cross = (o: ProjectedPoint, a: ProjectedPoint, b: ProjectedPoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Signed area; positive when the ring runs counter-clockwise. */
export const ringIsCounterClockwise = (ring: ProjectedPoint[]) => {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) total += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return total > 0;
};

/**
 * Merge consecutive edges into elevations.
 *
 * BAG footprints carry small jogs — a bay window, a doorway recess, a surveyor's
 * vertex — that are not separate elevations and would each get their own
 * observation record if taken literally. Consecutive edges within
 * `toleranceDeg` of one another are one wall.
 *
 * `minLengthM` then drops what is left of a party-wall return or a chamfer.
 * 2 m is deliberately below the narrowest canal-house plot measured in the
 * pilot (3.4 m at the 5th percentile) so a real façade is never dropped.
 */
export function buildElevations(
  footprint: ProjectedPoint[],
  { toleranceDeg = 15, minLengthM = 2 }: { toleranceDeg?: number; minLengthM?: number } = {},
): Elevation[] {
  // Normalise: drop a repeated closing vertex and any zero-length edge.
  const ring: ProjectedPoint[] = [];
  for (const point of footprint) {
    const previous = ring[ring.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-6) ring.push(point);
  }
  if (ring.length > 1 && Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y) < 1e-6) ring.pop();
  if (ring.length < 3) return [];

  const counterClockwise = ringIsCounterClockwise(ring);
  const bearingOf = (a: ProjectedPoint, b: ProjectedPoint) => Math.atan2(b.y - a.y, b.x - a.x);
  const angleBetween = (a: number, b: number) => {
    let difference = Math.abs(a - b) % (Math.PI * 2);
    if (difference > Math.PI) difference = Math.PI * 2 - difference;
    return difference;
  };

  // Group edge indices into runs of near-parallel edges.
  const tolerance = (toleranceDeg * Math.PI) / 180;
  const runs: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const bearing = bearingOf(a, b);
    const last = runs[runs.length - 1];
    if (last && angleBetween(bearingOf(ring[last[0]], ring[(last[0] + 1) % ring.length]), bearing) <= tolerance) last.push(i);
    else runs.push([i]);
  }
  // The ring wraps, so the last run may continue into the first.
  if (runs.length > 1) {
    const first = runs[0], last = runs[runs.length - 1];
    const firstBearing = bearingOf(ring[first[0]], ring[(first[0] + 1) % ring.length]);
    const lastBearing = bearingOf(ring[last[0]], ring[(last[0] + 1) % ring.length]);
    if (angleBetween(firstBearing, lastBearing) <= tolerance) {
      runs[0] = [...last, ...first];
      runs.pop();
    }
  }

  const elevations: Elevation[] = [];
  for (const run of runs) {
    const start = ring[run[0]];
    const end = ring[(run[run.length - 1] + 1) % ring.length];
    const lengthM = Math.hypot(end.x - start.x, end.y - start.y);
    if (lengthM < minLengthM) continue;

    const dx = (end.x - start.x) / lengthM, dy = (end.y - start.y) / lengthM;
    // For a counter-clockwise ring the interior is to the left of travel, so
    // the outward normal is to the right, and vice versa.
    const normal = counterClockwise ? { x: dy, y: -dx } : { x: -dy, y: dx };
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

    elevations.push({
      index: elevations.length,
      start, end, midpoint, normal, lengthM,
      facingDeg: (((Math.atan2(normal.x, normal.y) * 180) / Math.PI) + 360) % 360,
    });
  }
  return elevations;
}

/** True when `point` lies on the outward side of an elevation's plane. */
export const inFrontOf = (elevation: Elevation, point: ProjectedPoint) =>
  (point.x - elevation.midpoint.x) * elevation.normal.x + (point.y - elevation.midpoint.y) * elevation.normal.y > 0;

/** Perpendicular distance from a point to an elevation's plane, in metres. */
export const standoffM = (elevation: Elevation, point: ProjectedPoint) =>
  (point.x - elevation.midpoint.x) * elevation.normal.x + (point.y - elevation.midpoint.y) * elevation.normal.y;

/**
 * How far off square a view of this elevation is, in degrees.
 *
 * 0° is dead frontal. This is the number that decides whether an image can be
 * rectified into a usable orthographic elevation: past about 65° the façade is
 * so foreshortened that a window's width cannot be measured from it.
 */
export function obliquityDeg(elevation: Elevation, camera: ProjectedPoint): number {
  const dx = camera.x - elevation.midpoint.x, dy = camera.y - elevation.midpoint.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return 90;
  const cosine = (dx * elevation.normal.x + dy * elevation.normal.y) / distance;
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

/**
 * Segment intersection, used to ask whether anything stands between a camera
 * and a façade. Endpoint touches do not count as blocking: an elevation shares
 * its endpoints with its own neighbours.
 */
export function segmentsCross(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
