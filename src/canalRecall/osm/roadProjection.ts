/**
 * Turning OSM ways into the world the game drives on.
 *
 * `osm-loader.js` does two separate jobs. One is talking to Overpass and to a
 * tile server — HTTP, mirrors, failover, `Image` objects — and that stays in
 * the browser adapter, where it can only be tested by actually going to the
 * network. The other is arithmetic: an equirectangular projection about a
 * chosen centre, Douglas-Peucker simplification, recentring the network on a
 * fixed world origin, snapping a lat/lng onto the nearest carriageway, and
 * choosing where a route starts. All of that is a pure function of its inputs,
 * and all of it decides something the player experiences, so it belongs here.
 *
 * One thing worth stating plainly, because two of these functions look like
 * they should share code and must not: the world is *centred twice*. Ways are
 * first projected about the geographic centre, then the whole network is
 * translated so its bounding-box centre lands on `WORLD_ORIGIN`. Anything
 * projected later — a POI, a home address, a tile — has to be given that same
 * offset or it lands hundreds of metres from the road it belongs to.
 */

import { hasSeparatedCycleTrack } from '../routing/cycleTrack.ts';

/** A point in world (pixel) space. */
export interface WorldPoint { x: number; y: number }

/** A point on the globe, in the order OSM writes them. */
export interface LatLng { lat: number; lon: number }

/** One OSM way as the Overpass adapter hands it over. */
export interface OsmWay {
  nodes: LatLng[];
  highway: string;
  tags: Record<string, string | undefined>;
}

/** A carriageway in world space. */
export interface RoadSegment {
  points: WorldPoint[];
  width: number;
  type: string;
  oneway: boolean;
  name: string;
  /** True when OSM tags a physically separated cycle track on this way. */
  separatedCycleTrack?: boolean;
}

/** World units per metre. One unit is 1/3 m. */
export const PIXELS_PER_METER = 3;

/** Metres per degree of latitude. Constant enough at this scale that the
 *  ellipsoid correction would be far below the width of a bike lane. */
export const METRES_PER_DEGREE_LAT = 111320;

/**
 * Where the network's bounding-box centre is placed.
 *
 * These are not arbitrary: `findStartFinish` measures "near the city centre"
 * as distance from this point, so moving it moves every route's start.
 */
export const WORLD_ORIGIN: WorldPoint = { x: 1300, y: 1000 };

/** Metres per degree of longitude at a given latitude — the only part of the
 *  projection that depends on where you are. */
export function metresPerDegreeLng(latitude: number): number {
  return METRES_PER_DEGREE_LAT * Math.cos(latitude * Math.PI / 180);
}

/**
 * One lat/lng to world space, about `centre`, before the network is recentred.
 *
 * `y` is negated because latitude increases northward and world `y` increases
 * downward, which is the single most common way to get a map mirrored.
 */
export function projectToWorld(point: LatLng, centre: LatLng): WorldPoint {
  return {
    x: (point.lon - centre.lon) * metresPerDegreeLng(centre.lat) * PIXELS_PER_METER,
    y: -(point.lat - centre.lat) * METRES_PER_DEGREE_LAT * PIXELS_PER_METER,
  };
}

/** Distance from `point` to the segment `a`–`b`, and the closest point on it. */
export function closestPointOnSegment(
  point: WorldPoint, a: WorldPoint, b: WorldPoint,
): WorldPoint & { distance: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) {
    return { x: a.x, y: a.y, distance: Math.hypot(point.x - a.x, point.y - a.y) };
  }
  const t = Math.max(0, Math.min(1,
    ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  const x = a.x + abx * t;
  const y = a.y + aby * t;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
}

/**
 * Douglas-Peucker, iterative rather than recursive.
 *
 * The original recursed and gave up at `depth > 50`, returning the unsimplified
 * remainder without saying so. Measured on the shipped extract that cap never
 * fires — this simplifier and the recursive one agree exactly on all 6,542
 * Amsterdam paths, the longest of them 1,665 points, which
 * `check-road-projection.ts` asserts on every run. So this is a latent hazard
 * removed, not a bug fixed: an explicit stack has no depth limit to exceed and
 * no stack frame to overflow, whatever a future extract contains.
 */
export function simplifyPath(points: WorldPoint[], tolerance: number): WorldPoint[] {
  if (points.length <= 2) return points.slice();

  // Which points survive. Endpoints always do.
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let furthest = 0;
    let furthestIndex = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = closestPointOnSegment(points[i], points[first], points[last]).distance;
      if (distance > furthest) { furthest = distance; furthestIndex = i; }
    }
    if (furthestIndex !== -1 && furthest > tolerance) {
      keep[furthestIndex] = true;
      stack.push([first, furthestIndex], [furthestIndex, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

/** The bounding box of every point in every segment. */
export function segmentBounds(segments: Array<{ points: WorldPoint[] }>): {
  minX: number; minY: number; maxX: number; maxY: number;
} | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let seen = false;
  for (const segment of segments) {
    for (const point of segment.points) {
      seen = true;
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return seen ? { minX, minY, maxX, maxY } : null;
}

/**
 * The translation that puts the network's bounding-box centre on the world
 * origin. Returned rather than applied, because every later projection — POIs,
 * a home address, basemap tiles — has to be given the same one.
 */
export function centringOffset(segments: Array<{ points: WorldPoint[] }>): WorldPoint {
  const bounds = segmentBounds(segments);
  if (!bounds) return { x: 0, y: 0 };
  return {
    x: WORLD_ORIGIN.x - (bounds.minX + bounds.maxX) / 2,
    y: WORLD_ORIGIN.y - (bounds.minY + bounds.maxY) / 2,
  };
}

export interface BuildSegmentsOptions {
  /** Douglas-Peucker tolerance, in degrees; scaled to world units here so the
   *  caller states it in the units the constant is written in. */
  simplificationToleranceDegrees: number;
  /** Half-width per `highway` value, and what an unlisted one gets. */
  roadWidths: Record<string, number | undefined>;
  defaultRoadWidth: number;
}

/**
 * Every way projected, simplified, widened and recentred — the whole pure half
 * of loading a road network.
 *
 * The offset comes back with the segments because the caller has to keep it:
 * it is the only thing that relates a later lat/lng to this world.
 */
export function buildRoadSegments(
  ways: OsmWay[],
  centre: LatLng,
  options: BuildSegmentsOptions,
): { segments: RoadSegment[]; offset: WorldPoint } {
  const tolerance = options.simplificationToleranceDegrees
    * METRES_PER_DEGREE_LAT * PIXELS_PER_METER;

  const segments: RoadSegment[] = [];
  for (const way of ways) {
    const points = way.nodes.map(node => projectToWorld(node, centre));
    if (points.length < 2) continue;
    const simplified = simplifyPath(points, tolerance);
    if (simplified.length < 2) continue;
    segments.push({
      points: simplified,
      width: options.roadWidths[way.highway] ?? options.defaultRoadWidth,
      type: way.highway,
      oneway: way.tags.oneway === 'yes',
      name: way.tags.name || '',
      separatedCycleTrack: hasSeparatedCycleTrack(way.tags),
    });
  }

  const offset = centringOffset(segments);
  for (const segment of segments) {
    for (const point of segment.points) {
      point.x += offset.x;
      point.y += offset.y;
    }
  }
  return { segments, offset };
}

/**
 * A lat/lng snapped onto the nearest carriageway, or null when nothing is near
 * enough.
 *
 * `maxSnapDistance` may be `false` to mean "no limit". That is not a style
 * choice: comparing a distance against `false` coerces it to 0 and rejects
 * every point not exactly on a segment, which is how a home address once
 * silently failed to launch.
 */
export function snapToRoad(
  point: LatLng,
  centre: LatLng,
  offset: WorldPoint,
  segments: Array<{ points: WorldPoint[] }>,
  maxSnapDistance: number | false,
): (WorldPoint & { snapDistance: number }) | null {
  const projected = projectToWorld(point, centre);
  const target = { x: projected.x + offset.x, y: projected.y + offset.y };

  let best: (WorldPoint & { distance: number }) | null = null;
  for (const segment of segments) {
    for (let i = 0; i < segment.points.length - 1; i++) {
      const candidate = closestPointOnSegment(target, segment.points[i], segment.points[i + 1]);
      if (!best || candidate.distance < best.distance) best = candidate;
    }
  }
  if (!best) return null;
  if (Number.isFinite(maxSnapDistance) && best.distance > (maxSnapDistance as number)) return null;
  return { x: best.x, y: best.y, snapDistance: best.distance };
}

/** How many endpoints the far-end search looks at before it starts sampling. */
export const ENDPOINT_SAMPLE_LIMIT = 200;

/**
 * Where a route starts and the far point it aims at.
 *
 * Start is the endpoint nearest `WORLD_ORIGIN` — the chosen city centre — so a
 * route begins where the player asked to be, not at whatever corner of the
 * extract happens to be extreme. The finish is only an orientation aid, so a
 * large network samples its endpoints rather than checking every one.
 */
export function findStartFinish(segments: Array<{ points: WorldPoint[] }>): {
  start: WorldPoint; finish: WorldPoint; distance: number;
} | null {
  const endpoints: WorldPoint[] = [];
  for (const segment of segments) {
    if (!segment.points.length) continue;
    endpoints.push(segment.points[0]);
    endpoints.push(segment.points[segment.points.length - 1]);
  }
  if (!endpoints.length) return null;

  let start = endpoints[0];
  let nearest = Infinity;
  for (const point of endpoints) {
    const d = (point.x - WORLD_ORIGIN.x) ** 2 + (point.y - WORLD_ORIGIN.y) ** 2;
    if (d < nearest) { nearest = d; start = point; }
  }

  const sampled = endpoints.length > ENDPOINT_SAMPLE_LIMIT
    ? endpoints.filter((_, i) => i % Math.ceil(endpoints.length / ENDPOINT_SAMPLE_LIMIT) === 0)
    : endpoints;

  let finish = start;
  let furthest = 0;
  for (const point of sampled) {
    const d = (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
    if (d > furthest) { furthest = d; finish = point; }
  }
  return { start, finish, distance: Math.sqrt(furthest) };
}

/** Great-circle distance in metres. */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const earthRadius = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// --- Slippy tiles ----------------------------------------------------------
// Standard Web Mercator tile numbering, kept here so the basemap and the road
// network agree about where a tile belongs in the world.

export function lngToTileX(lng: number, zoom: number): number {
  return (lng + 180) / 360 * 2 ** zoom;
}

export function latToTileY(lat: number, zoom: number): number {
  const radians = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * 2 ** zoom;
}

export function tileXToLng(x: number, zoom: number): number {
  return x / 2 ** zoom * 360 - 180;
}

export function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - 2 * Math.PI * y / 2 ** zoom;
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
