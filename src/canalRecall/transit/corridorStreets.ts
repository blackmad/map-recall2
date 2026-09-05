/**
 * Read-only nearest-street lookup for transit corridor teaching.
 *
 * Streets are never added to the driveable RoadNetwork — the tram stays locked
 * to the GTFS shape. This index only answers "which street is under the rails?"
 * for secondary quizzes and encyclopedia cards.
 */

export interface CorridorStreetFeature {
  name: string;
  /** Lat/lng polylines from the curated streets extract. */
  paths: Array<Array<[number, number]>>;
  distractors?: string[];
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface CorridorStreetSeg {
  name: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface CorridorStreetIndex {
  segments: CorridorStreetSeg[];
  /** Display names for distractor pools. */
  names: string[];
  distractorsByName: Map<string, string[]>;
}

export type ProjectLatLng = (lat: number, lng: number) => WorldPoint | null;

function pointToSegDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Build a flat segment list in world space from curated street paths. */
export function buildCorridorStreetIndex(
  streets: readonly CorridorStreetFeature[],
  project: ProjectLatLng,
): CorridorStreetIndex {
  const segments: CorridorStreetSeg[] = [];
  const names: string[] = [];
  const distractorsByName = new Map<string, string[]>();
  const seen = new Set<string>();

  for (const street of streets) {
    if (!street.name) continue;
    if (!seen.has(street.name)) {
      seen.add(street.name);
      names.push(street.name);
      if (street.distractors && street.distractors.length) {
        distractorsByName.set(street.name, street.distractors);
      }
    }
    for (const path of street.paths) {
      if (!path || path.length < 2) continue;
      let prev: WorldPoint | null = null;
      for (const [lat, lng] of path) {
        const point = project(lat, lng);
        if (!point) {
          prev = null;
          continue;
        }
        if (prev) {
          segments.push({
            name: street.name,
            ax: prev.x,
            ay: prev.y,
            bx: point.x,
            by: point.y,
          });
        }
        prev = point;
      }
    }
  }

  return { segments, names, distractorsByName };
}

export interface NearestCorridorStreet {
  name: string;
  dist: number;
}

/** Nearest curated street centreline within `maxDist` world pixels, or null. */
export function nearestCorridorStreet(
  index: CorridorStreetIndex | null | undefined,
  x: number,
  y: number,
  maxDist: number,
): NearestCorridorStreet | null {
  if (!index || !index.segments.length) return null;
  let best: NearestCorridorStreet | null = null;
  for (const seg of index.segments) {
    const dist = pointToSegDist(x, y, seg.ax, seg.ay, seg.bx, seg.by);
    if (dist > maxDist) continue;
    if (!best || dist < best.dist) best = { name: seg.name, dist };
  }
  return best;
}

/** Minimum distance from a point to a polyline path (world px). */
export function distanceToPath(
  path: readonly WorldPoint[],
  x: number,
  y: number,
): number {
  if (!path.length) return Infinity;
  if (path.length === 1) return Math.hypot(path[0].x - x, path[0].y - y);
  let best = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    best = Math.min(best, pointToSegDist(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}
