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

// ---------------------------------------------------------------------------
// Grid index (2026-10-14, desktop perf third pass)
//
// The label overlay picks every few frames to test whether a label is hidden,
// and a pitched or aerial ray crosses many chunks' bounding spheres, so
// `pickPrism` ran the slab test of every building in each of those chunks
// (0.07–0.10 ms per frame in the 300 m aerial hold). The grid buckets each
// prism's plan box (plus a margin) into square cells; a pick walks only the
// cells the ray crosses while it is within the chunk's height range, then
// runs the same tests as `pickPrism` on those candidates in index order, so
// the hit (entry and t, ties to the earlier entry) is exactly `pickPrism`'s.
// ---------------------------------------------------------------------------

export interface PrismGrid {
  readonly entries: readonly PrismEntry[];
  readonly cell: number;
  readonly x0: number; readonly y0: number;
  readonly nx: number; readonly ny: number;
  /** Cell c holds `items[start[c] .. start[c + 1])` (entry indices, ascending). */
  readonly start: Uint32Array;
  readonly items: Uint32Array;
  /** Height range of every prism before any lift. */
  readonly zLo: number; readonly zHi: number;
  /** Plan margin each prism is bucketed with (metres): covers rounding in the walk. */
  readonly margin: number;
  stamp: Uint32Array;
  mark: number;
  scratch: number[];
}

/** Bucket `entries` into square cells of `cellM` metres (cells overlapping each plan box grown by `marginM`). */
export function buildPrismGrid(entries: readonly PrismEntry[], cellM = 32, marginM = 0.5): PrismGrid {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, zLo = Infinity, zHi = -Infinity;
  for (const e of entries) {
    if (e.minX < minX) minX = e.minX;
    if (e.minY < minY) minY = e.minY;
    if (e.maxX > maxX) maxX = e.maxX;
    if (e.maxY > maxY) maxY = e.maxY;
    if (e.zMin < zLo) zLo = e.zMin;
    if (e.zMax > zHi) zHi = e.zMax;
  }
  if (!entries.length) minX = minY = maxX = maxY = zLo = zHi = 0;
  const x0 = minX - marginM, y0 = minY - marginM;
  const nx = Math.max(1, Math.ceil((maxX + marginM - x0) / cellM)), ny = Math.max(1, Math.ceil((maxY + marginM - y0) / cellM));
  const cellRange = (e: PrismEntry) => [
    Math.max(0, Math.floor((e.minX - marginM - x0) / cellM)), Math.min(nx - 1, Math.floor((e.maxX + marginM - x0) / cellM)),
    Math.max(0, Math.floor((e.minY - marginM - y0) / cellM)), Math.min(ny - 1, Math.floor((e.maxY + marginM - y0) / cellM)),
  ];
  const start = new Uint32Array(nx * ny + 1);
  for (const e of entries) {
    const [ax, bx, ay, by] = cellRange(e);
    for (let cy = ay; cy <= by; cy++) for (let cx = ax; cx <= bx; cx++) start[cy * nx + cx + 1]++;
  }
  for (let c = 1; c <= nx * ny; c++) start[c] += start[c - 1];
  const fill = start.slice(0, nx * ny);
  const items = new Uint32Array(start[nx * ny]);
  entries.forEach((e, i) => {
    const [ax, bx, ay, by] = cellRange(e);
    for (let cy = ay; cy <= by; cy++) for (let cx = ax; cx <= bx; cx++) items[fill[cy * nx + cx]++] = i;
  });
  return { entries, cell: cellM, x0, y0, nx, ny, start, items, zLo, zHi, margin: marginM, stamp: new Uint32Array(entries.length), mark: 0, scratch: [] };
}

/** Indices of the prisms in the cells the ray crosses (t > 0, within the lifted height range), ascending. */
export function prismCandidates(grid: PrismGrid, o: readonly [number, number, number], d: readonly [number, number, number], liftMin = 0, liftMax = 0): number[] {
  const out = grid.scratch;
  out.length = 0;
  if (!grid.entries.length) return out;
  // The span of t where the ray is inside the grid's box (heights lifted by liftMin..liftMax).
  let t0 = 0, t1 = Infinity;
  const lo0 = grid.x0, lo1 = grid.y0, lo2 = grid.zLo + Math.min(0, liftMin);
  const hi0 = grid.x0 + grid.nx * grid.cell, hi1 = grid.y0 + grid.ny * grid.cell, hi2 = grid.zHi + Math.max(0, liftMax);
  for (let axis = 0; axis < 3; axis++) {
    const lo = axis === 0 ? lo0 : axis === 1 ? lo1 : lo2, hi = axis === 0 ? hi0 : axis === 1 ? hi1 : hi2;
    if (Math.abs(d[axis]) < 1e-12) {
      if (o[axis] < lo || o[axis] > hi) return out;
      continue;
    }
    let a = (lo - o[axis]) / d[axis], b = (hi - o[axis]) / d[axis];
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
  }
  if (t0 > t1) return out;
  // Grow the span by the margin along the plan (rounding at its ends).
  const plan = Math.hypot(d[0], d[1]);
  if (plan > 1e-12) { const pad = grid.margin / plan; t0 = Math.max(0, t0 - pad); t1 += pad; }
  // Walk the cells (Amanatides–Woo) from t0 to t1.
  const { cell, nx, ny, x0, y0, start, items, stamp } = grid;
  grid.mark = (grid.mark + 1) >>> 0;
  if (grid.mark === 0) { stamp.fill(0); grid.mark = 1; }
  const mark = grid.mark;
  let cx = Math.min(nx - 1, Math.max(0, Math.floor((o[0] + d[0] * t0 - x0) / cell)));
  let cy = Math.min(ny - 1, Math.max(0, Math.floor((o[1] + d[1] * t0 - y0) / cell)));
  const flatX = Math.abs(d[0]) < 1e-12, flatY = Math.abs(d[1]) < 1e-12;
  const stepX = d[0] > 0 ? 1 : -1, stepY = d[1] > 0 ? 1 : -1;
  let tMaxX = flatX ? Infinity : ((cx + (d[0] > 0 ? 1 : 0)) * cell + x0 - o[0]) / d[0];
  let tMaxY = flatY ? Infinity : ((cy + (d[1] > 0 ? 1 : 0)) * cell + y0 - o[1]) / d[1];
  const dX = flatX ? Infinity : cell / Math.abs(d[0]), dY = flatY ? Infinity : cell / Math.abs(d[1]);
  for (let guard = nx + ny + 2; guard > 0; guard--) {
    const c = cy * nx + cx;
    for (let k = start[c], end = start[c + 1]; k < end; k++) {
      const i = items[k];
      if (stamp[i] !== mark) { stamp[i] = mark; out.push(i); }
    }
    if (Math.min(tMaxX, tMaxY) > t1) break;
    if (tMaxX < tMaxY) { cx += stepX; tMaxX += dX; if (cx < 0 || cx >= nx) break; }
    else { cy += stepY; tMaxY += dY; if (cy < 0 || cy >= ny) break; }
  }
  if (out.length > 1) out.sort((a, b) => a - b);
  return out;
}

/**
 * `pickPrism` through the grid: the same hit (entry and t; ties to the earlier entry). `liftMin`/`liftMax`
 * bound every lift `liftOf` returns (own ground); a prism lifted outside them could be missed.
 */
export function pickPrismGrid(
  grid: PrismGrid, o: readonly [number, number, number], d: readonly [number, number, number],
  liftOf: (id: string) => number = () => 0, skip: (id: string) => boolean = () => false, liftMin = 0, liftMax = 0,
): { entry: PrismEntry; t: number } | null {
  let best: { entry: PrismEntry; t: number } | null = null;
  for (const i of prismCandidates(grid, o, d, liftMin, liftMax)) {
    const entry = grid.entries[i];
    const t = rayPrism(o, d, entry, liftOf(entry.id));
    if (t == null || (best && t >= best.t) || skip(entry.id)) continue;
    best = { entry, t };
  }
  return best;
}
