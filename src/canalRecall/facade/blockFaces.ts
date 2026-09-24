/**
 * Blockfaces: the maximal chain of collinear, touching, public-facing walls on
 * one side of one street segment.
 *
 * An *elevation* is a single building's outer wall. A *frontage wall* is that
 * elevation once it has been tied to the street it faces. A *blockface* is what
 * a person standing in the street actually perceives: one continuous wall-line
 * running down one side of the road, crossing party wall after party wall,
 * until a gap, a bend, or a corner interrupts it.
 *
 * Three facts are deliberately separated here, because conflating them is how
 * a pipeline ends up claiming a building faces a canal it never touched:
 *
 *   1. Which street and which side of it a wall faces   (`assignWallToStreetSide`)
 *   2. Which walls chain into a continuous frontage     (`chainBlockFaces`)
 *   3. Where a chain must yield at a crossing corner    (`splitBlockFaceAtIntersections`)
 *
 * The input road geometry is `RoadSegment[]` in the game's world space, where
 * `PIXELS_PER_METER` is 3. Every returned measurement is in metres, converted
 * at the boundary so callers never have to remember the constant.
 *
 * Known limits, stated rather than hidden:
 *
 *   - Segment geometry is polyline, not one OSM way. A `segmentIndex` is an
 *     index into the caller's array, and two halves of the same street may be
 *     separate segments; they will not chain across the gap between them
 *     unless a single segment carries both.
 *   - `cornerBuildingIds` is derived from the elevation ids that were chained.
 *     An `Elevation` carries no `buildingId`; the building id is recovered from
 *     the `${buildingId}:e:${hash}` prefix `buildElevations` writes. An
 *     elevation built without a `pandId` cannot contribute a corner.
 *   - A corner building is recognised by *two public walls on two streets*, not
 *     by a mapped corner node. A building whose only two elevations face the
 *     same street is a bend, not a corner.
 */

import { inFrontOf, obliquityDeg, segmentsCross, standoffM, type Elevation } from './elevations.ts';
import type { ProjectedPoint } from './sources.ts';
import { closestPointOnSegment, PIXELS_PER_METER, type RoadSegment } from '../osm/roadProjection.ts';

/** Which street, which side of it, and roughly where along it a wall sits. */
export interface StreetSideRef {
  streetName: string | null;
  segmentIndex: number;
  side: 'left' | 'right';
  /** Metres along the segment to the wall's start, unclamped. */
  alongM: number;
}

/** An elevation once it has been tied to a street side. */
export interface FrontageWall {
  elevation: Elevation;
  street: StreetSideRef | null;
  alongMinM: number;
  alongMaxM: number;
  /** Wall endpoints quantised to the millimetre, for exact collinearity tests. */
  lineKey: string;
}

export interface BlockFace {
  id: string;
  streetName: string | null;
  side: 'left' | 'right';
  walls: FrontageWall[];
  lengthM: number;
  /** Along-axis positions, in metres, where two chained walls meet. */
  partyWallBreaksM: number[];
  /** Building ids whose walls appear in more than one emitted blockface. */
  cornerBuildingIds: string[];
}

const DEG = Math.PI / 180;
const nodes = (segment: RoadSegment): ProjectedPoint[] =>
  Array.isArray(segment.points) ? segment.points : [];

const cross2d = (a: ProjectedPoint, b: ProjectedPoint) => a.x * b.y - a.y * b.x;
const dot2d = (a: ProjectedPoint, b: ProjectedPoint) => a.x * b.x + a.y * b.y;

/** The world-space direction of a segment's span. Zero length returns (0, 0). */
const segmentDirection = (segment: RoadSegment): ProjectedPoint => {
  const points = nodes(segment);
  if (points.length < 2) return { x: 0, y: 0 };
  const dx = points.at(-1)!.x - points[0].x;
  const dy = points.at(-1)!.y - points[0].y;
  const length = Math.hypot(dx, dy);
  return length < 1e-9 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
};

/** Distance in metres along the segment to `point`'s nearest carriageway point. */
const alongMeters = (segment: RoadSegment, point: ProjectedPoint): number => {
  const points = nodes(segment);
  if (points.length === 0) return 0;
  let best = Infinity;
  let along = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const candidate = closestPointOnSegment(point, points[index], points[index + 1]);
    if (candidate.distance < best) {
      best = candidate.distance;
      along = Math.hypot(candidate.x - points[0].x, candidate.y - points[0].y) / PIXELS_PER_METER;
    }
  }
  return along;
};

const lineKeyFor = (start: ProjectedPoint, end: ProjectedPoint) => {
  const point = (value: ProjectedPoint) =>
    `${Math.round(value.x * 1000)},${Math.round(value.y * 1000)}`;
  return `${point(start)}:${point(end)}`;
};

/** A carriageway point midway along the segment, for the "in front" test. */
const middleSample = (segment: RoadSegment): ProjectedPoint | null => {
  const points = nodes(segment);
  if (points.length < 2) return null;
  return points[Math.floor((points.length - 1) / 2)];
};

/** The closest carriageway point on `segment` to a wall midpoint, in world space. */
const closestToWall = (segment: RoadSegment, elevation: Elevation) => {
  const points = nodes(segment);
  let best: (ProjectedPoint & { distance: number }) | null = null;
  for (let index = 0; index < points.length - 1; index++) {
    const candidate = closestPointOnSegment(elevation.midpoint, points[index], points[index + 1]);
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
};

export interface AssignWallOptions {
  /** Reject a candidate road once the wall is farther than this, in metres. */
  maxStandoffM?: number;
  /** Reject a candidate road once the wall greets it more obliquely than this. */
  maxObliquityDeg?: number;
}

/**
 * Tie one building wall to the street side it faces, or return null.
 *
 * A segment qualifies only when the wall is genuinely public to it:
 *
 *   - the carriageway lies in front of the wall's outward normal, judged from
 *     both a midpoint sample and the closest carriageway point to the wall;
 *   - the wall stands off that closest point by no more than `maxStandoffM`;
 *   - the wall greets it no more obliquely than `maxObliquityDeg` (0° square-on).
 *
 * Obliquity is measured to the closest carriageway point rather than to a
 * sampled node. Sampling an endpoint beside a long wall would report a grazing
 * angle for a street the wall squarely fronts, which is exactly the false
 * negative this module exists to avoid.
 *
 * `side` is the sign of the 2D cross product of the segment tangent with the
 * wall's outward normal: positive = left, negative = right. That convention is
 * self-consistent even where the cross product is near zero, which happens when
 * a wall runs almost parallel to the road it is being tested against — the
 * pair is still accepted or rejected on standoff and obliquity, so the label is
 * stable rather than meaningful at that margin.
 *
 * The nearest qualifying segment wins; ties break on segment index.
 */
export function assignWallToStreetSide(
  elevation: Elevation,
  segments: readonly RoadSegment[],
  { maxStandoffM = 25, maxObliquityDeg = 60 }: AssignWallOptions = {},
): StreetSideRef | null {
  let best: { segmentIndex: number; distance: number; side: 'left' | 'right' } | null = null;

  segments.forEach((segment, segmentIndex) => {
    const middle = middleSample(segment);
    const closest = closestToWall(segment, elevation);
    if (!middle || !closest) return;

    if (!inFrontOf(elevation, middle)) return;
    if (!inFrontOf(elevation, closest)) return;
    if (!Number.isFinite(standoffM(elevation, middle)) || !Number.isFinite(standoffM(elevation, closest))) return;

    const standoff = standoffM(elevation, { x: closest.x, y: closest.y });
    if (standoff < 0 || standoff > maxStandoffM) return;
    if (obliquityDeg(elevation, { x: closest.x, y: closest.y }) > maxObliquityDeg) return;

    const tangent = segmentDirection(segment);
    if (tangent.x === 0 && tangent.y === 0) return;
    const side: 'left' | 'right' = cross2d(tangent, elevation.normal) >= 0 ? 'left' : 'right';

    const candidate = { segmentIndex, distance: standoff, side };
    if (!best || candidate.distance < best.distance) best = candidate;
  });

  if (!best) return null;
  const anchor: { segmentIndex: number; distance: number; side: 'left' | 'right' } = best;
  const segment = segments[anchor.segmentIndex];
  return {
    streetName: segment.name || null,
    segmentIndex: anchor.segmentIndex,
    side: anchor.side,
    alongM: alongMeters(segment, elevation.start),
  };
}

export interface FrontageWallOptions extends AssignWallOptions {}

/** `assignWallToStreetSide` plus the along-axis span, in metres. */
export function frontageWall(
  elevation: Elevation,
  segments: readonly RoadSegment[],
  options: FrontageWallOptions = {},
): FrontageWall | null {
  const street = assignWallToStreetSide(elevation, segments, options);
  if (!street) return null;
  const segment = segments[street.segmentIndex];
  const a = alongMeters(segment, elevation.start);
  const b = alongMeters(segment, elevation.end);
  return {
    elevation,
    street,
    alongMinM: Math.min(a, b),
    alongMaxM: Math.max(a, b),
    lineKey: lineKeyFor(elevation.start, elevation.end),
  };
}

export interface ChainOptions {
  /** Maximum bearing difference, in degrees, for two walls to stay collinear. */
  bearingToleranceDeg?: number;
  /** Maximum perpendicular offset, in metres, between the two wall lines. */
  lineOffsetToleranceM?: number;
  /** Maximum along-axis gap, in metres, across which walls still touch. */
  gapToleranceM?: number;
}

/** Bearing of the line through `wall`'s longest axis, in degrees, wrapped to ±90. */
const lineBearingDeg = (wall: FrontageWall): number => {
  const dx = wall.elevation.end.x - wall.elevation.start.x;
  const dy = wall.elevation.end.y - wall.elevation.start.y;
  let bearing = Math.atan2(dy, dx) / DEG;
  bearing %= 180;
  if (bearing < -90) bearing += 180;
  if (bearing > 90) bearing -= 180;
  return bearing;
};

const bearingDifference = (left: number, right: number) => {
  const difference = Math.abs(left - right) % 180;
  return difference > 90 ? 180 - difference : difference;
};

/** Distance in metres from `point` to the infinite line through `wall`. */
const perpendicularOffsetM = (wall: FrontageWall, point: ProjectedPoint): number => {
  const { start, end } = wall.elevation;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return Math.hypot(point.x - start.x, point.y - start.y) / PIXELS_PER_METER;
  return Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / length / PIXELS_PER_METER;
};

/**
 * Two walls are contiguous when they are collinear, on the same line, and meet.
 *
 * Sorting is by `alongMinM`, so a `right` wall normally starts at or after
 * `left` ends. A gap larger than `gapToleranceM` breaks the chain; a small
 * negative gap is an overlap and still joins, because two footprints sharing a
 * party wall frequently overlap by a centimetre of projection noise.
 */
const contiguous = (left: FrontageWall, right: FrontageWall, options: Required<ChainOptions>) => {
  if (bearingDifference(lineBearingDeg(left), lineBearingDeg(right)) > options.bearingToleranceDeg) return false;
  if (perpendicularOffsetM(left, right.elevation.start) > options.lineOffsetToleranceM) return false;
  if (perpendicularOffsetM(right, left.elevation.end) > options.lineOffsetToleranceM) return false;
  return right.alongMinM - left.alongMaxM <= options.gapToleranceM;
};

/** The physical length of a chained span, in metres, from its along-axis extent. */
const chainLengthM = (walls: readonly FrontageWall[]): number => {
  if (!walls.length) return 0;
  return Math.max(0, walls.at(-1)!.alongMaxM - walls[0].alongMinM);
};

/** The along-axis positions, in metres, where consecutive walls meet. */
const partyBreaks = (walls: readonly FrontageWall[]): number[] => {
  const breaks: number[] = [];
  for (let index = 1; index < walls.length; index++) {
    breaks.push((walls[index - 1].alongMaxM + walls[index].alongMinM) / 2);
  }
  return breaks;
};

/** The stable, rebuild-independent identity of a chain's ordered elevations. */
export const blockFaceId = (wallIds: readonly string[]): string => {
  let hash = 2166136261;
  const input = wallIds.join('|');
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `bf:${(hash >>> 0).toString(36).padStart(7, '0')}`;
};

interface Chain {
  streetName: string | null;
  side: 'left' | 'right';
  walls: FrontageWall[];
}

const chainBucket = (
  walls: FrontageWall[],
  streetName: string | null,
  side: 'left' | 'right',
  options: Required<ChainOptions>,
): Chain[] => {
  const ordered = [...walls].sort((left, right) =>
    left.alongMinM - right.alongMinM
    || left.alongMaxM - right.alongMaxM
    || left.elevation.elevationId.localeCompare(right.elevation.elevationId));
  const chains: Chain[] = [];
  let current: FrontageWall[] = [];
  for (const wall of ordered) {
    const last = current.at(-1);
    if (!last || contiguous(last, wall, options)) {
      current.push(wall);
      continue;
    }
    chains.push({ streetName, side, walls: current });
    current = [wall];
  }
  if (current.length) chains.push({ streetName, side, walls: current });
  return chains;
};

/**
 * Chain frontage walls into maximal contiguous blockfaces.
 *
 * Walls are bucketed by `(streetName, side)`, ordered by their start along the
 * street, then joined while each neighbour is collinear, on the same line, and
 * touches within `gapToleranceM`. A chain breaks on a bend, a real gap, or the
 * far side of a corner. A `null`-street wall still chains, among null-street
 * neighbours on the same side.
 *
 * `partyWallBreaksM` records each junction along the chain. `cornerBuildingIds`
 * is global: it lists buildings whose walls appear in more than one emitted
 * face, which is the signature of a building straddling a corner.
 */
export function chainBlockFaces(
  frontageWalls: readonly FrontageWall[],
  { bearingToleranceDeg = 2, lineOffsetToleranceM = 1.2, gapToleranceM = 0.5 }: ChainOptions = {},
): BlockFace[] {
  const options: Required<ChainOptions> = { bearingToleranceDeg, lineOffsetToleranceM, gapToleranceM };

  const buckets = new Map<string, FrontageWall[]>();
  for (const wall of frontageWalls) {
    if (!wall.street) continue;
    const key = `${wall.street.streetName ?? ''}\u0000${wall.street.side}\u0000${wall.street.segmentIndex}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(wall);
    buckets.set(key, bucket);
  }

  const tagged: Chain[] = [];
  for (const [key, walls] of buckets) {
    const [streetName, side] = key.split('\u0000');
    tagged.push(...chainBucket(walls, streetName || null, side as 'left' | 'right', options));
  }

  const buildingCounts = new Map<string, number>();
  const elementCounts = new Map<string, number>();
  const buildingFor = (wall: FrontageWall) => wall.elevation.elevationId.split(':')[0];
  for (const face of tagged) {
    for (const wall of face.walls) {
      const building = buildingFor(wall);
      buildingCounts.set(building, (buildingCounts.get(building) ?? 0) + 1);
      elementCounts.set(wall.elevation.elevationId, (elementCounts.get(wall.elevation.elevationId) ?? 0) + 1);
    }
  }

  return tagged.map(face => {
    const walls = face.walls;
    const corners = new Set<string>();
    for (const wall of walls) {
      const building = buildingFor(wall);
      const sharedWithAnotherFace = (elementCounts.get(wall.elevation.elevationId) ?? 0) > 1;
      const straddlesFaces = (buildingCounts.get(building) ?? 0) > 1;
      if (sharedWithAnotherFace || straddlesFaces) corners.add(building);
    }
    return {
      id: blockFaceId(walls.map(wall => wall.elevation.elevationId)),
      streetName: face.streetName,
      side: face.side,
      walls,
      lengthM: chainLengthM(walls),
      partyWallBreaksM: partyBreaks(walls),
      cornerBuildingIds: [...corners].sort(),
    };
  });
}

export interface SplitOptions {
  /** The largest distance, in metres, at which a crossing still counts. */
  crossingToleranceM?: number;
}

/** Closest distance in metres from a world-space point to any node of `segment`. */
const distanceToSegmentM = (segment: RoadSegment, point: ProjectedPoint): number => {
  const points = nodes(segment);
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index++) {
    best = Math.min(best, closestPointOnSegment(point, points[index], points[index + 1]).distance / PIXELS_PER_METER);
  }
  return best;
};

/**
 * The along-face position, in metres, of the point where two lines cross.
 *
 * `segmentsCross` says only *that* a crossing happened, not where, and a chain
 * can cross one street while running beside another. So the intersection is
 * solved for explicitly, and its position is compared against each wall's own
 * along-span. Returns null when the segments are parallel.
 */
const segmentIntersection = (
  a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint,
): ProjectedPoint | null => {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = cross2d(r, s);
  if (Math.abs(denominator) < 1e-9) return null;
  const t = cross2d({ x: c.x - a.x, y: c.y - a.y }, s) / denominator;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
};

/**
 * Split a blockface where another named street crosses or meets it.
 *
 * The corner wall belongs to the crossing street, so the chain is cut at the
 * crossing and the wall after it starts a new face. For every crossing named
 * street the intersection point with the face baseline is solved for and
 * converted to an along-face position; the chain is then split after whichever
 * wall's along-span contains that position. A crossing that lands in the gap
 * between two walls is applied to the wall it lands after.
 *
 * A named street also counts as meeting the face when one of its nodes lies
 * within `crossingToleranceM` of a wall midpoint — the T-junction case, where
 * the side street ends *on* our street rather than crossing it.
 *
 * The split face's id is derived from its own wall list, so rebuilding is still
 * deterministic. An unsplit face at the start or end of the chain is rare here
 * because a crossing is expected mid-block; when no crossing is found, the
 * original face is returned unchanged.
 */
export function splitBlockFaceAtIntersections(
  blockFace: BlockFace,
  segments: readonly RoadSegment[],
  { crossingToleranceM = 4 }: SplitOptions = {},
): BlockFace[] {
  if (blockFace.walls.length < 2) return [blockFace];

  const baselineStart = blockFace.walls[0].elevation.start;
  const baselineEnd = blockFace.walls.at(-1)!.elevation.end;
  const baselineLength = Math.hypot(baselineEnd.x - baselineStart.x, baselineEnd.y - baselineStart.y);
  const baselineDirection = baselineLength < 1e-9
    ? null
    : { x: (baselineEnd.x - baselineStart.x) / baselineLength, y: (baselineEnd.y - baselineStart.y) / baselineLength };
  if (!baselineDirection) return [blockFace];
  const alongOf = (point: ProjectedPoint) =>
    ((point.x - baselineStart.x) * baselineDirection.x + (point.y - baselineStart.y) * baselineDirection.y) / PIXELS_PER_METER;

  const candidates = segments.filter(segment => segment.name && segment.name !== blockFace.streetName);
  const crossingAlong: number[] = [];
  for (const segment of candidates) {
    const points = nodes(segment);
    for (let index = 0; index < points.length - 1; index++) {
      const intersection = segmentIntersection(baselineStart, baselineEnd, points[index], points[index + 1]);
      if (!intersection) continue;
      if (!segmentsCross(baselineStart, baselineEnd, points[index], points[index + 1])) continue;
      crossingAlong.push(alongOf(intersection));
    }
    for (const node of points) {
      if (distanceToSegmentM(segment, node) <= crossingToleranceM) crossingAlong.push(alongOf(node));
    }
  }
  if (!crossingAlong.length) return [blockFace];

  // Which wall each crossing lands after: the last wall starting at or before it.
  const splitAfter = new Set<number>();
  for (const along of crossingAlong) {
    let landing = -1;
    for (let index = 0; index < blockFace.walls.length; index++) {
      if (blockFace.walls[index].alongMinM <= along) landing = index;
    }
    if (landing >= 0 && landing < blockFace.walls.length - 1) splitAfter.add(landing);
  }
  if (!splitAfter.size) return [blockFace];

  const groups: FrontageWall[][] = [[blockFace.walls[0]]];
  for (let index = 1; index < blockFace.walls.length; index++) {
    if (splitAfter.has(index - 1)) groups.push([blockFace.walls[index]]);
    else groups.at(-1)!.push(blockFace.walls[index]);
  }
  if (groups.length < 2) return [blockFace];

  return groups.map(walls => {
    const ids = new Set(walls.map(wall => wall.elevation.elevationId));
    return {
      ...blockFace,
      id: blockFaceId(walls.map(wall => wall.elevation.elevationId)),
      walls,
      lengthM: chainLengthM(walls),
      partyWallBreaksM: partyBreaks(walls),
      cornerBuildingIds: blockFace.cornerBuildingIds.filter(building => ids.has(building)),
    };
  });
}
