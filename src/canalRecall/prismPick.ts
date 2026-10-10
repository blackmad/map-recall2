// Click picking for the merged building chunks, without their geometry.
//
// A chunk's vertex buffers are released on the CPU once uploaded (they are
// most of the facade renderer's memory). Picking used to rebuild every chunk
// the click ray crossed — the full facade layout — just to raycast it and
// throw it away: 1.9–2.3 s per click on desktop at chase pitch, because a
// pitched ray crosses many chunks' bounding spheres (measured 2026-10-10).
// When the rebuild did not reproduce the installed vertex ranges exactly the
// chunk was skipped, so whole chunks could not be clicked at all.
//
// Instead each chunk keeps a small index of its buildings as extruded
// footprints (base to roof top, metres from the mesh origin), built once on
// the first click, and the ray is tested against those prisms analytically.
// Walls are exact; a pitched roof is over-covered by its bounding prism,
// which only makes the sky just above an eave clickable as that building.

export type LngLat = readonly [number, number];
export type Origin = { lng: number; lat: number };

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

export interface PrismEntry {
  id: string;
  /** Polygons → rings → flattened [x0, y0, x1, y1, …], metres from the origin. */
  polygons: Float64Array[][];
  minX: number; minY: number; maxX: number; maxY: number;
  zMin: number; zMax: number;
}

type GeoJsonGeometry = { type?: string; coordinates?: unknown } | null | undefined;

function polygonsOf(geometry: GeoJsonGeometry): LngLat[][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates as LngLat[][]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as LngLat[][][];
  return [];
}

/** Top of what the mesh draws for these properties: the roof's top, not the eaves. */
export function prismTopM(p: Record<string, unknown>): number {
  const height = Number(p.height);
  return Number.isFinite(height) && height > 0 ? height : 5;
}

/** One prism per feature with a footprint; others are left out. */
export function buildPrismIndex(
  features: readonly { geometry?: unknown; properties?: Record<string, unknown> | null }[],
  origin: Origin,
): PrismEntry[] {
  const kx = mPerDegLng(origin.lat);
  const out: PrismEntry[] = [];
  for (const feature of features) {
    const p = feature.properties || {};
    const source = polygonsOf(feature.geometry as GeoJsonGeometry);
    if (!source.length || p.id == null) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polygons = source.map(polygon => polygon.map(ring => {
      const flat = new Float64Array(ring.length * 2);
      ring.forEach(([lng, lat], i) => {
        const x = (lng - origin.lng) * kx, y = (lat - origin.lat) * M_PER_DEG_LAT;
        flat[i * 2] = x; flat[i * 2 + 1] = y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
      return flat;
    }));
    if (!Number.isFinite(minX)) continue;
    const zMin = Number(p.minHeight) || 0;
    out.push({ id: String(p.id), polygons, minX, minY, maxX, maxY, zMin, zMax: Math.max(zMin + 0.5, prismTopM(p)) });
  }
  return out;
}

function insidePolygon(rings: Float64Array[], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[i * 2], yi = ring[i * 2 + 1], xj = ring[j * 2], yj = ring[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * Nearest positive ray parameter at which `origin + t·dir` enters the prism,
 * or null. `lift` raises the whole prism (own-ground relief).
 */
export function rayPrism(
  o: readonly [number, number, number], d: readonly [number, number, number], e: PrismEntry, lift = 0,
): number | null {
  const zMin = e.zMin + lift, zMax = e.zMax + lift;
  // Slab test against the bounding box first: almost every building fails it.
  let t0 = 0, t1 = Infinity;
  const lo = [e.minX, e.minY, zMin], hi = [e.maxX, e.maxY, zMax];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(d[axis]) < 1e-12) {
      if (o[axis] < lo[axis] || o[axis] > hi[axis]) return null;
      continue;
    }
    let a = (lo[axis] - o[axis]) / d[axis], b = (hi[axis] - o[axis]) / d[axis];
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return null;
  }
  let best = Infinity;
  // Walls: the ray's plan crossing with each edge, within the height range.
  for (const rings of e.polygons) for (const ring of rings) {
    const n = ring.length / 2;
    if (n < 2) continue;
    // GeoJSON closes its rings; an open ring still gets its closing edge.
    const closed = ring[0] === ring[(n - 1) * 2] && ring[1] === ring[(n - 1) * 2 + 1];
    const edges = closed ? n - 1 : n;
    for (let i = 0; i < edges; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2], ay = ring[i * 2 + 1];
      const ex = ring[j * 2] - ax, ey = ring[j * 2 + 1] - ay;
      const denom = d[0] * ey - d[1] * ex;
      if (Math.abs(denom) < 1e-12) continue;
      const wx = ax - o[0], wy = ay - o[1];
      const t = (wx * ey - wy * ex) / denom;
      if (!(t > 0) || t >= best) continue;
      const s = (wx * d[1] - wy * d[0]) / denom;
      if (s < 0 || s > 1) continue;
      const z = o[2] + t * d[2];
      if (z < zMin || z > zMax) continue;
      best = t;
    }
  }
  // Roof and underside caps.
  if (Math.abs(d[2]) > 1e-12) for (const z of [zMax, zMin]) {
    const t = (z - o[2]) / d[2];
    if (!(t > 0) || t >= best) continue;
    const x = o[0] + t * d[0], y = o[1] + t * d[1];
    if (e.polygons.some(rings => insidePolygon(rings, x, y))) best = t;
  }
  return Number.isFinite(best) ? best : null;
}

/** Nearest prism the ray enters, skipping ids `skip` rejects. */
export function pickPrism(
  index: readonly PrismEntry[], o: readonly [number, number, number], d: readonly [number, number, number],
  liftOf: (id: string) => number = () => 0, skip: (id: string) => boolean = () => false,
): { entry: PrismEntry; t: number } | null {
  let best: { entry: PrismEntry; t: number } | null = null;
  for (const entry of index) {
    const t = rayPrism(o, d, entry, liftOf(entry.id));
    if (t == null || (best && t >= best.t) || skip(entry.id)) continue;
    best = { entry, t };
  }
  return best;
}
