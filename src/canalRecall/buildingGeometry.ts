/**
 * Shared footprint geometry for the building ladder and composition filter.
 *
 * Kept free of ownership decisions so ladder and composition can import it
 * without a cycle.
 */

/** A closed ring of `[lng, lat]`. */
export type Ring = [number, number][];
export type Bbox = [number, number, number, number];

export const ringBbox = (ring: Ring): Bbox => {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of ring) {
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return [west, south, east, north];
};

export const bboxesOverlap = (a: Bbox, b: Bbox): boolean =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Area-weighted centroid of a ring, falling back to the mean for degenerate rings. */
export function ringCentroid(ring: Ring): [number, number] {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    twiceArea += cross;
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  }
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

/** Ray casting. Points exactly on an edge are not worth special-casing here. */
export function pointInRing([lng, lat]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
