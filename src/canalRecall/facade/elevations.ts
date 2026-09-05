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
  /**
   * The runs this elevation was assembled from, when a jog split one wall.
   *
   * Kept so a measurement can be traced back to the survey vertices it came
   * from, rather than to a merged abstraction that exists nowhere in BAG.
   */
  mergedFrom?: number[];
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
  {
    toleranceDeg = 15, minLengthM = 2,
    // A canal frontage steps in and out; these say how much of a step is still
    // one wall. Measured against the pilot: 8° admits survey noise and not a
    // corner, 1.2 m admits a bay or a porch and not a building's depth, and 4 m
    // admits a party-wall step and not a courtyard.
    facingToleranceDeg = 8, offsetToleranceM = 1.2, gapToleranceM = 4,
  }: {
    toleranceDeg?: number; minLengthM?: number;
    facingToleranceDeg?: number; offsetToleranceM?: number; gapToleranceM?: number;
  } = {},
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
  return mergeCoplanar(elevations, { facingToleranceDeg, offsetToleranceM, gapToleranceM });
}

/**
 * Rejoin stretches of one wall that a jog in the footprint pulled apart.
 *
 * The run-grouping above walks the ring and breaks whenever consecutive edges
 * turn by more than the tolerance. That is right for a corner and wrong for a
 * canal frontage, which routinely steps in and out by a few tens of centimetres
 * — a bay, a porch, a surveyor's vertex, a party wall thicker on one side. The
 * step is a real edge running perpendicular to the front, so it breaks the run,
 * and one façade arrives as two or three.
 *
 * Measured before this existed: 176 of 2,180 panden with a measured wall had
 * their frontage split this way, and the piece the pipeline picked was a median
 * **2.31× smaller than the real frontage**, missing a median 10.1 m of wall.
 * Herengracht 58 came back as 7.98 m and 13.94 m, both facing 28.5°, both in the
 * same plane; the measurement ran on the 7.98 m half.
 *
 * So a second pass joins elevations that are the same wall by all three tests
 * that matter, and only those: they face the same way, they lie in the same
 * plane, and they are adjacent along it. Facing alone would merge a front with
 * a coplanar wing across a courtyard; dropping the offset test would merge a
 * front with a back, which are parallel and twenty metres apart.
 */
function mergeCoplanar(
  elevations: Elevation[],
  { facingToleranceDeg, offsetToleranceM, gapToleranceM }:
    { facingToleranceDeg: number; offsetToleranceM: number; gapToleranceM: number },
): Elevation[] {
  if (elevations.length < 2) return elevations;

  const facingGap = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
  /** Where a point falls along, and how far it lies off, an elevation's line. */
  const project = (elevation: Elevation, point: ProjectedPoint) => {
    const dx = (elevation.end.x - elevation.start.x) / elevation.lengthM;
    const dy = (elevation.end.y - elevation.start.y) / elevation.lengthM;
    const ox = point.x - elevation.start.x, oy = point.y - elevation.start.y;
    return { along: ox * dx + oy * dy, off: ox * elevation.normal.x + oy * elevation.normal.y };
  };

  const parent = elevations.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < elevations.length; i++) {
    for (let j = i + 1; j < elevations.length; j++) {
      const a = elevations[i], b = elevations[j];
      if (facingGap(a.facingDeg, b.facingDeg) > facingToleranceDeg) continue;
      const ends = [project(a, b.start), project(a, b.end)];
      // Same plane: both ends of b sit within tolerance of a's line.
      if (ends.some(e => Math.abs(e.off) > offsetToleranceM)) continue;
      // Adjacent along it: the spans touch, overlap, or leave only a small gap.
      const bLo = Math.min(ends[0].along, ends[1].along), bHi = Math.max(ends[0].along, ends[1].along);
      const gap = Math.max(bLo - a.lengthM, 0 - bHi, 0);
      if (gap > gapToleranceM) continue;
      parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < elevations.length; i++) {
    const root = find(i);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(i);
  }

  const merged: Elevation[] = [];
  for (const members of groups.values()) {
    if (members.length === 1) { merged.push({ ...elevations[members[0]] }); continue; }
    // The longest member sets the line; the others are steps off it.
    const spine = members.map(i => elevations[i]).sort((a, b) => b.lengthM - a.lengthM)[0];
    let lo = Infinity, hi = -Infinity;
    for (const i of members) for (const point of [elevations[i].start, elevations[i].end]) {
      const { along } = project(spine, point);
      lo = Math.min(lo, along); hi = Math.max(hi, along);
    }
    const dx = (spine.end.x - spine.start.x) / spine.lengthM;
    const dy = (spine.end.y - spine.start.y) / spine.lengthM;
    const start = { x: spine.start.x + dx * lo, y: spine.start.y + dy * lo };
    const end = { x: spine.start.x + dx * hi, y: spine.start.y + dy * hi };
    merged.push({
      index: 0,
      mergedFrom: members.slice().sort((a, b) => a - b),
      start, end,
      midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      normal: spine.normal,
      lengthM: hi - lo,
      facingDeg: spine.facingDeg,
    });
  }
  merged.sort((a, b) => b.lengthM - a.lengthM);
  return merged.map((elevation, index) => ({ ...elevation, index }));
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
