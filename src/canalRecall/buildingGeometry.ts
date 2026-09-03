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
  if (ring.length === 0) return [0, 0];
  // Shoelace is unstable in raw lng/lat: Amsterdam rings sit near (5, 52) with
  // area ~1e-8, so 3×area in the denominator loses the centre. Translate to
  // the first vertex first — otherwise a regular 11 m turret gets a centroid
  // 5 m off-centre and a pyramidal fan that looks like a shard.
  const [x0, y0] = ring[0];
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] - x0;
    const yi = ring[i][1] - y0;
    const xj = ring[j][0] - x0;
    const yj = ring[j][1] - y0;
    const cross = xj * yi - xi * yj;
    twiceArea += cross;
    x += (xj + xi) * cross;
    y += (yj + yi) * cross;
  }
  if (Math.abs(twiceArea) < 1e-18) {
    return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  }
  return [x0 + x / (3 * twiceArea), y0 + y / (3 * twiceArea)];
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

/** One polygon: outer ring first, then zero or more hole rings. */
export type PolygonRings = Ring[];

export type FootprintGeometry =
  | { type: 'Polygon'; coordinates: PolygonRings }
  | { type: 'MultiPolygon'; coordinates: PolygonRings[] };

/**
 * Split GeoJSON into polygons without flattening holes into extra outers.
 *
 * `coordinates.flat()` on a MultiPolygon is correct for outers-only footprints,
 * but on a Polygon with inner rings it turns courtyards into solid slabs — the
 * Droogbak H-cutout (`r3606840`) became five positive extrusions.
 */
export function polygonsOf(geometry: FootprintGeometry): PolygonRings[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Outer ring of each polygon — what the ladder/grid use for containment. */
export function outerRingsOf(polygons: readonly PolygonRings[]): Ring[] {
  return polygons.map(polygon => polygon[0]).filter(ring => ring && ring.length > 0);
}

export function geometryHasHoles(polygons: readonly PolygonRings[]): boolean {
  return polygons.some(polygon => polygon.length > 1);
}

export function asGeometry(polygons: PolygonRings[]): FootprintGeometry {
  if (polygons.length === 1) return { type: 'Polygon', coordinates: polygons[0] };
  return { type: 'MultiPolygon', coordinates: polygons };
}
