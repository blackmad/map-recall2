/**
 * Bridges are named things; crossings are places.
 *
 * OSM groups every span that carries a given name into one feature, so
 * "IJburglaan" arrives as 66 short ways scattered along several kilometres of
 * road, and "Amsteldijk" carries a dozen unrelated little culverts. Asking
 * "which bridge is this?" once per *name* means the second, tenth and
 * fortieth crossing teach nothing, while the first one may have been a
 * two-metre slab over a ditch.
 *
 * This module resolves a bridge feature into the physical crossings it is made
 * of — spans clustered by proximity — and works out which waterway each
 * crossing passes over. The clustering runs offline in
 * `scripts/build-bridge-crossings.ts`; the game only looks crossings up.
 */

export type LatLon = [number, number];

const METERS_PER_DEGREE_LAT = 111_320;

/** Spans closer than this belong to the same physical crossing. */
export const CROSSING_LINK_METERS = 70;

/** How far a waterway centreline may sit from a span and still be what it crosses. */
export const CROSSING_WATER_METERS = 30;

export interface BridgeSource {
  id: string;
  name: string;
  paths?: LatLon[][];
  path?: LatLon[];
}

export interface WaterSource {
  name: string;
  type?: string;
  paths?: LatLon[][];
  path?: LatLon[];
}

export interface BridgeCrossing {
  /** Grid-free ordinal, assigned south-to-north so it is stable across rebuilds. */
  index: number;
  center: LatLon;
  /** The waterway the crossing passes over, when one could be identified. */
  waterway: string | null;
  /** Its extract type, so a name learned from a bridge and from a boat share one key. */
  waterwayType: string | null;
  /**
   * Other waterways near this crossing, for the multiple-choice question. Street
   * mode has no water geometry loaded at all, so the alternatives cannot be
   * gathered at runtime the way street and bridge distractors are.
   */
  waterDistractors: string[];
  /** How many mapped spans make up this crossing (deck, cycleway, footway…). */
  spans: number;
}

interface Point { x: number; y: number }

export function pathsOf(feature: { paths?: LatLon[][]; path?: LatLon[] }): LatLon[][] {
  const paths = feature.paths || (feature.path ? [feature.path] : []);
  return paths.filter((path) => Array.isArray(path) && path.length >= 2);
}

/** Local metric projection about a reference latitude. Flat-earth is fine at city scale. */
function projector(refLat: number) {
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos(refLat * Math.PI / 180);
  return ([lat, lon]: LatLon): Point => ({ x: lon * metersPerDegreeLon, y: lat * METERS_PER_DEGREE_LAT });
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function polylineDistance(left: Point[], right: Point[]): number {
  let best = Infinity;
  for (const point of left) {
    for (let i = 1; i < right.length; i++) best = Math.min(best, distanceToSegment(point, right[i - 1], right[i]));
  }
  for (const point of right) {
    for (let i = 1; i < left.length; i++) best = Math.min(best, distanceToSegment(point, left[i - 1], left[i]));
  }
  return best;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a), d2 = side(c, d, b), d3 = side(a, b, c), d4 = side(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function polylinesCross(left: Point[], right: Point[]): boolean {
  for (let i = 1; i < left.length; i++) {
    for (let j = 1; j < right.length; j++) {
      if (segmentsCross(left[i - 1], left[i], right[j - 1], right[j])) return true;
    }
  }
  return false;
}

/**
 * Group spans into physical crossings by single-link clustering: two spans join
 * when their geometries come within `linkMeters`. A dual-carriageway bridge
 * with a separate cycle deck is one crossing; two bridges of the same name half
 * a kilometre apart are two.
 */
export function clusterSpans(spans: Point[][], linkMeters: number = CROSSING_LINK_METERS): number[][] {
  const parent = spans.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
    return index;
  };
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      if (find(i) === find(j)) continue;
      if (polylineDistance(spans[i], spans[j]) <= linkMeters) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let index = 0; index < spans.length; index++) {
    const root = find(index);
    const group = groups.get(root);
    if (group) group.push(index); else groups.set(root, [index]);
  }
  return [...groups.values()];
}

export interface CrossingOptions {
  linkMeters?: number;
  waterMeters?: number;
  /** How far to look for plausible wrong answers to "which water is this?". */
  distractorMeters?: number;
  distractorCount?: number;
}

/** Nearby waterway names, nearest first, excluding the right answer. */
function nearbyWaterNames(
  lines: Array<{ name: string; type: string; points: Point[] }>,
  center: Point,
  exclude: string | null,
  radius: number,
  count: number,
): string[] {
  const best = new Map<string, number>();
  for (const line of lines) {
    if (!line.name || line.name === exclude) continue;
    let distance = Infinity;
    for (let i = 1; i < line.points.length; i++) {
      distance = Math.min(distance, distanceToSegment(center, line.points[i - 1], line.points[i]));
    }
    if (distance > radius) continue;
    const previous = best.get(line.name);
    if (previous === undefined || distance < previous) best.set(line.name, distance);
  }
  return [...best.entries()].sort((a, b) => a[1] - b[1]).slice(0, count).map(([name]) => name);
}

/**
 * Resolve one bridge feature into its crossings, naming the waterway under each.
 *
 * A span that actually intersects a waterway centreline wins outright; only if
 * nothing intersects does the nearest centreline within `waterMeters` count,
 * which covers the many decks whose mapped geometry stops on the quay rather
 * than reaching across the water.
 */
export function findBridgeCrossings(
  bridge: BridgeSource,
  waters: WaterSource[],
  {
    linkMeters = CROSSING_LINK_METERS, waterMeters = CROSSING_WATER_METERS,
    distractorMeters = 2_000, distractorCount = 4,
  }: CrossingOptions = {},
): BridgeCrossing[] {
  const rawSpans = pathsOf(bridge);
  if (rawSpans.length === 0) return [];
  const refLat = rawSpans[0][0][0];
  const project = projector(refLat);
  const spans = rawSpans.map((path) => path.map(project));

  const waterLines = waters.flatMap((water) => pathsOf(water).map((path) => ({
    name: water.name,
    type: water.type || 'canal',
    points: path.map(project),
  })));

  const crossings = clusterSpans(spans, linkMeters).map((members) => {
    const points = members.flatMap((index) => spans[index]);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));

    let crossed: { name: string; type: string } | null = null;
    let nearest: { name: string; type: string } | null = null;
    let nearestDistance = waterMeters;
    for (const line of waterLines) {
      if (crossed) break;
      let outside = true;
      for (const point of line.points) {
        if (point.x >= minX - waterMeters && point.x <= maxX + waterMeters
          && point.y >= minY - waterMeters && point.y <= maxY + waterMeters) { outside = false; break; }
      }
      if (outside) continue;
      for (const index of members) {
        if (polylinesCross(spans[index], line.points)) { crossed = line; break; }
        const gap = polylineDistance(spans[index], line.points);
        if (gap < nearestDistance) { nearestDistance = gap; nearest = line; }
      }
    }

    const centerLat = points.reduce((sum, point) => sum + point.y, 0) / points.length / METERS_PER_DEGREE_LAT;
    const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos(refLat * Math.PI / 180);
    const centerLon = points.reduce((sum, point) => sum + point.x, 0) / points.length / metersPerDegreeLon;
    const water = crossed || nearest;
    const centroid = { x: centerLon * metersPerDegreeLon, y: centerLat * METERS_PER_DEGREE_LAT };
    return {
      center: [Number(centerLat.toFixed(6)), Number(centerLon.toFixed(6))] as LatLon,
      waterway: water ? water.name : null,
      waterwayType: water ? water.type : null,
      waterDistractors: water
        ? nearbyWaterNames(waterLines, centroid, water.name, distractorMeters, distractorCount)
        : [],
      spans: members.length,
    };
  });

  // Ordinals are assigned by position, not by path order, so a re-simplified
  // extract that reorders ways keeps the same crossing numbering.
  return crossings
    .sort((a, b) => (a.center[0] - b.center[0]) || (a.center[1] - b.center[1]))
    .map((crossing, index) => ({ index, ...crossing }));
}

/** The published shape of `bridge-crossings.json`. */
export interface BridgeCrossingIndex {
  version: 1;
  generatedAt: string;
  bridges: Record<string, BridgeCrossing[]>;
}

/**
 * Pick the crossing a traversal happened at, in whatever planar coordinates the
 * caller is working in. Crossings of one bridge are at least `linkMeters` apart
 * by construction, so nearest-centre is unambiguous.
 */
export function nearestCrossing<T extends { x: number; y: number }>(
  crossings: T[],
  x: number,
  y: number,
  maxDistance = Infinity,
): T | null {
  let best: T | null = null;
  let bestDistance = maxDistance;
  for (const crossing of crossings) {
    const distance = Math.hypot(crossing.x - x, crossing.y - y);
    if (distance <= bestDistance) { bestDistance = distance; best = crossing; }
  }
  return best;
}
