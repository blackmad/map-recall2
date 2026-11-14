// Whether a landmark can be seen from the street the rider is on.
//
// A landmark's street point (`x`/`y`) is its centre snapped to the nearest
// network way, which for a deep plot can be the wrong street: the Krijtberg
// snaps to the Herengracht, 26 m from its footprint with houses in between, so
// the card opened with only its spires showing while its entrance is on the
// Singel (user 2026-11-13, "I can't see enough of this church in view for it
// to make sense to be showing the card right now"). The test here is the
// building's own footprint: the rider (or the path ahead) must pass within
// FRONTAGE_M of it. Measured on the 160 landmarks that carry an outline:
// the nearest routable street is within 5 m of 85, 10 m of 122, 15 m of 145
// and 20 m of 148; the Krijtberg is 4 m from the Singel and 26 m from the
// Herengracht, the Westerkerk 4 m from the Prinsengracht.

import type { WorldPoint } from './worldTypes';

/** Metres: how close the street must pass to the building's outline for the
 *  front to be on it. A quay and a pavement, not a block. */
export const FRONTAGE_M = 15;
/** Metres between samples along a path when finding where it first reaches the frontage. */
const PATH_STEP_M = 1.5;

export interface FrontageLandmark {
  x: number;
  y: number;
  ownX?: number;
  ownY?: number;
  /** World-px outlines: closed rings for buildings, open lines otherwise. */
  footprint?: readonly (readonly WorldPoint[])[];
}

function segmentDistance(p: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
}

function insideRing(p: WorldPoint, ring: readonly WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Px from `point` to the outline (0 inside a closed ring); Infinity with none. */
export function distanceToFootprint(point: WorldPoint, footprint: FrontageLandmark['footprint']): number {
  if (!footprint?.length) return Infinity;
  let best = Infinity;
  for (const ring of footprint) {
    if (ring.length < 2) continue;
    const closed = ring.length > 3 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y;
    if (closed && insideRing(point, ring)) return 0;
    for (let i = 0; i < ring.length - 1; i++) best = Math.min(best, segmentDistance(point, ring[i], ring[i + 1]));
  }
  return best;
}

/** Whether `point` is on the building's own street: within FRONTAGE_M of its outline.
 *  A landmark with no outline (a point-only house) is never ruled out here. */
export function facesStreet(point: WorldPoint, landmark: FrontageLandmark, pxPerMetre: number): boolean {
  return !landmark.footprint?.length || distanceToFootprint(point, landmark.footprint) <= FRONTAGE_M * pxPerMetre;
}

/** How far along `path` the rider first stands on the building's frontage, or null. */
export function frontageAlong(path: readonly WorldPoint[], landmark: FrontageLandmark, pxPerMetre: number): number | null {
  const limit = FRONTAGE_M * pxPerMetre, step = PATH_STEP_M * pxPerMetre;
  let travelled = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(length / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (distanceToFootprint({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, landmark.footprint) <= limit) return travelled + length * t;
    }
    travelled += length;
  }
  return null;
}

/** Outline rings in world px from a landmark's lng/lat GeoJSON (polygon outer rings and lines). */
export function footprintFromGeoJson(
  features: ReadonlyArray<{ geometry?: { type: string; coordinates: unknown } }> | undefined,
  toWorld: (lngLat: [number, number]) => WorldPoint,
): WorldPoint[][] {
  const rings: WorldPoint[][] = [];
  for (const feature of features || []) {
    const g = feature.geometry;
    if (!g) continue;
    const line = g.type === 'Polygon' ? (g.coordinates as [number, number][][])[0]
      : g.type === 'LineString' ? g.coordinates as [number, number][] : null;
    if (line && line.length > 1) rings.push(line.map(toWorld));
  }
  return rings;
}
