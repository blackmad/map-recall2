/**
 * Rose gardens: find the planting beds inside a mapped rose garden and fill
 * them with deterministic, instanced low-poly rose bushes.
 *
 * OSM rarely maps the individual beds. The Vondelpark Rosarium (a147997044)
 * is one `leisure=garden` polygon whose hexagonal beds exist only as the gaps
 * between ~85 short paved footways. So a bed is derived, not assumed: the
 * garden is rasterised on a fine grid, every cell within a path's rendered
 * half-width (plus a bush radius) or inside another mapped surface is cleared,
 * and the remaining connected components are the beds. A mapped
 * `landuse=flowerbed` tagged for roses is a bed by itself.
 *
 * Pure data → data; the browser adapter lives in inventory-trees-source.js.
 */

export type LngLat = [number, number];
export type Ring = LngLat[];
export type Polygon = Ring[];

export type Tags = Record<string, string | undefined>;

/** Mapped tags that mark a whole garden (or bed) as planted with roses. */
export function isRoseGarden(tags: Tags): boolean {
  const text = (k: string) => (tags[k] || '').toLowerCase();
  const garden = tags.leisure === 'garden' || tags.landuse === 'flowerbed';
  if (!garden) return false;
  if (['rose_garden', 'rosarium', 'roses'].includes(text('garden:type'))) return true;
  if (['rose_garden', 'rosarium', 'roses'].includes(text('garden_type'))) return true;
  if (/\b(rosarium|rozentuin|rozenhof|rose garden|roses garden)\b/.test(text('name'))) return true;
  if (/\b(rosarium|rozentuin|rose garden|roses garden)\b/.test(text('description'))) return true;
  for (const k of ['flowers', 'plant', 'species', 'genus', 'taxon']) {
    if (/(^|;|\s)(rosa|roses?|rozen)(\s|;|$)/.test(text(k))) return true;
  }
  return false;
}

export interface RoseObstacles {
  /** Path centrelines with their rendered half-width in metres. */
  lines: {coordinates: LngLat[]; halfWidth: number}[];
  /** Mapped surfaces that are not beds (paved areas, lawns, water, buildings). */
  polygons: Polygon[];
  /** Point furniture and tree trunks, each with a clear radius in metres. */
  points: {coordinates: LngLat; radius: number}[];
}

export interface RoseGardenInput {
  id: string;
  name: string;
  polygons: Polygon[];
  obstacles: RoseObstacles;
}

export interface RosePlanOptions {
  /** Raster cell in metres. */
  cell?: number;
  /** Bush-centre clearance from a path casing and the garden boundary (m). */
  margin?: number;
  /** Components smaller than this (m²) are slivers, not beds. */
  minBedArea?: number;
  maxBushes?: number;
  /** A garden with at least this many clear areas is a bed pattern. */
  patternMinBeds?: number;
}

export interface RoseBed {
  id: string;
  /** Index into ROSE_PALETTE. */
  colour: number;
  /** Centre-to-centre bush spacing (m). */
  spacing: number;
  area: number;
  centroid: LngLat;
  bushes: number;
}

export interface RoseGardenPlan {
  id: string;
  name: string;
  origin: LngLat;
  beds: RoseBed[];
  /** Flat [east dm, north dm, bed index, size %] per bush, relative to origin. */
  bushes: number[];
}

/** Bloom colours: deep red, red, rose pink, pale pink, white, yellow, apricot. */
export const ROSE_PALETTE = ['#9e1b2f', '#c8283c', '#e0577f', '#f2a6bd', '#f4eee6', '#f1cf4f', '#f09a6b'];
/** Weighted toward reds and pinks, as in the Vondelpark beds. */
const PALETTE_WEIGHTS = [3, 4, 4, 2, 2, 2, 1];

export function hash01(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function pickWeighted(u: number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let t = u * total;
  for (let i = 0; i < weights.length; i++) { t -= weights[i]; if (t < 0) return i; }
  return weights.length - 1;
}

function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const inPolygon = (x: number, y: number, poly: number[][][]) =>
  inRing(x, y, poly[0]) && !poly.slice(1).some(h => inRing(x, y, h));

function segmentDistance(px: number, py: number, a: number[], b: number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len)) : 0;
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

function ringEdgeDistance(px: number, py: number, ring: number[][]): number {
  let d = Infinity;
  for (let i = 0; i < ring.length - 1; i++) d = Math.min(d, segmentDistance(px, py, ring[i], ring[i + 1]));
  return d;
}

/** Plan beds and bushes for one rose garden. Deterministic for a given input. */
export function planRoseGarden(input: RoseGardenInput, options: RosePlanOptions = {}): RoseGardenPlan {
  const cell = options.cell ?? 0.25, margin = options.margin ?? 0.45;
  const minBedArea = options.minBedArea ?? 2.5, maxBushes = options.maxBushes ?? 6000;
  const all = input.polygons.flat(2);
  // Origin: the garden's bounding-box centre (decimetre offsets stay small).
  const lng0 = (Math.min(...all.map(p => p[0])) + Math.max(...all.map(p => p[0]))) / 2;
  const lat0 = (Math.min(...all.map(p => p[1])) + Math.max(...all.map(p => p[1]))) / 2;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const local = (p: LngLat) => [(p[0] - lng0) * kx, (p[1] - lat0) * ky];
  const toLngLat = (x: number, y: number): LngLat => [lng0 + x / kx, lat0 + y / ky];
  const garden = input.polygons.map(poly => poly.map(r => r.map(local)));
  const pts = garden.flat(2);
  const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]));
  const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
  const nx = Math.ceil((maxX - minX) / cell), ny = Math.ceil((maxY - minY) / cell);
  const lines = input.obstacles.lines.map(l => ({c: l.coordinates.map(local), r: l.halfWidth + margin}))
    .map(l => ({...l, box: [Math.min(...l.c.map(p => p[0])) - l.r, Math.min(...l.c.map(p => p[1])) - l.r,
      Math.max(...l.c.map(p => p[0])) + l.r, Math.max(...l.c.map(p => p[1])) + l.r]}));
  const blockers = input.obstacles.polygons.map(poly => poly.map(r => r.map(local)));
  const points = input.obstacles.points.map(p => ({c: local(p.coordinates), r: p.radius + margin}));
  const free = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = minX + (i + .5) * cell, y = minY + (j + .5) * cell;
    const host = garden.find(poly => inPolygon(x, y, poly));
    if (!host || host.some(r => ringEdgeDistance(x, y, r) < margin)) continue;
    if (blockers.some(poly => inPolygon(x, y, poly) || poly.some(r => ringEdgeDistance(x, y, r) < margin))) continue;
    if (points.some(p => Math.hypot(x - p.c[0], y - p.c[1]) < p.r)) continue;
    let blocked = false;
    for (const l of lines) {
      if (x < l.box[0] || x > l.box[2] || y < l.box[1] || y > l.box[3]) continue;
      for (let k = 0; k < l.c.length - 1 && !blocked; k++) if (segmentDistance(x, y, l.c[k], l.c[k + 1]) < l.r) blocked = true;
      if (blocked) break;
    }
    if (!blocked) free[j * nx + i] = 1;
  }
  // Connected components (4-neighbour) are the beds.
  const label = new Int32Array(nx * ny).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < free.length; start++) {
    if (!free[start] || label[start] >= 0) continue;
    const id = components.length, cells = [start];
    label[start] = id;
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q], i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj, n = b * nx + a;
        if (a >= 0 && a < nx && b >= 0 && b < ny && free[n] && label[n] < 0) { label[n] = id; cells.push(n); }
      }
    }
    components.push(cells);
  }
  const beds: RoseBed[] = [], bushes: number[] = [];
  const cellX = (c: number) => minX + ((c % nx) + .5) * cell, cellY = (c: number) => minY + (Math.floor(c / nx) + .5) * cell;
  const measured = components.map(cells => {
    const cx = cells.reduce((s, c) => s + cellX(c), 0) / cells.length, cy = cells.reduce((s, c) => s + cellY(c), 0) / cells.length;
    let edges = 0;
    for (const c of cells) {
      const i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || a >= nx || b < 0 || b >= ny || label[b * nx + a] !== label[c]) edges++;
      }
    }
    const area = cells.length * cell * cell, perimeter = edges * cell * Math.PI / 4; // staircase → true length
    return {cells, cx, cy, area, compactness: 4 * Math.PI * area / (perimeter * perimeter)};
  }).filter(c => c.area >= minBedArea);
  // A garden laid out as a pattern of repeated beds (the Rosarium hexes): the
  // pattern defines a bed. Leftovers between the pattern and the garden
  // boundary — slivers, strips along a path, one large odd remnant — are
  // verge, not beds. A garden with only a few clear areas keeps them all.
  const sorted = measured.map(c => c.area).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const patterned = measured.length >= (options.patternMinBeds ?? 6);
  const kept = measured.filter(c => !patterned
    || (c.area >= median * .45 && c.area <= median * 2 && c.compactness >= .45))
    // Stable order: west→east, south→north by centroid decimetre.
    .sort((a, b) => Math.round(a.cy * 10) - Math.round(b.cy * 10) || a.cx - b.cx);
  for (const comp of kept) {
    const centroid = toLngLat(comp.cx, comp.cy);
    const bedId = `${input.id}:${centroid[0].toFixed(6)},${centroid[1].toFixed(6)}`;
    const colour = pickWeighted(hash01(`${bedId}:colour`), PALETTE_WEIGHTS);
    // Beds read as a continuous planting: neighbouring shrubs (radius ~0.5 m) overlap.
    const spacing = 0.72 + hash01(`${bedId}:density`) * 0.22;
    const bedIndex = beds.length;
    // Dart throwing over the bed's own cells in hashed order: blue-noise spacing,
    // every bush centre on a free cell, so none sits on a path or bed edge.
    const order = comp.cells.map(c => ({c, r: hash01(`${bedId}:${c}`)})).sort((a, b) => a.r - b.r);
    const accepted: number[][] = [];
    const bucket = new Map<string, number[][]>();
    const key = (x: number, y: number) => `${Math.floor(x / spacing)},${Math.floor(y / spacing)}`;
    for (const {c} of order) {
      const x = cellX(c) + (hash01(`${bedId}:${c}:x`) - .5) * cell * .8;
      const y = cellY(c) + (hash01(`${bedId}:${c}:y`) - .5) * cell * .8;
      const gx = Math.floor(x / spacing), gy = Math.floor(y / spacing);
      let near = false;
      for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++)
        near = (bucket.get(`${gx + a},${gy + b}`) || []).some(p => Math.hypot(p[0] - x, p[1] - y) < spacing);
      if (near) continue;
      const p = [x, y];
      accepted.push(p);
      const k = key(x, y);
      if (!bucket.has(k)) bucket.set(k, []);
      bucket.get(k)!.push(p);
    }
    for (const [i, p] of accepted.entries()) {
      if (bushes.length / 4 >= maxBushes) break;
      const size = Math.round(85 + hash01(`${bedId}:${i}:size`) * 30);
      // Store relative to the garden origin in decimetres.
      bushes.push(Math.round(p[0] * 10), Math.round(p[1] * 10), bedIndex, size);
    }
    beds.push({id: bedId, colour, spacing: Number(spacing.toFixed(2)), area: Number(comp.area.toFixed(1)),
      centroid: [Number(centroid[0].toFixed(7)), Number(centroid[1].toFixed(7))], bushes: accepted.length});
  }
  return {id: input.id, name: input.name, origin: [Number(lng0.toFixed(7)), Number(lat0.toFixed(7))], beds, bushes};
}

export interface RoseBushInstance {
  lng: number;
  lat: number;
  /** Bush radius in metres. */
  radius: number;
  height: number;
  rotation: number;
  /** The bed's bloom colour; the shrub's foliage faces stay green in the shader. */
  bloom: string;
}

/** Expand one stored plan into per-bush render instances inside a lng/lat box. */
export function roseBushInstances(plan: RoseGardenPlan,
  bounds: {west: number; east: number; south: number; north: number}): RoseBushInstance[] {
  const [lng0, lat0] = plan.origin;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const out: RoseBushInstance[] = [];
  for (let i = 0; i < plan.bushes.length; i += 4) {
    const lng = lng0 + plan.bushes[i] / 10 / kx, lat = lat0 + plan.bushes[i + 1] / 10 / ky;
    if (lng < bounds.west || lng > bounds.east || lat < bounds.south || lat > bounds.north) continue;
    const bed = plan.beds[plan.bushes[i + 2]], s = plan.bushes[i + 3] / 100, seed = `${bed.id}:${i}`;
    out.push({lng, lat, radius: 0.5 * s, height: 0.5 * s + hash01(`${seed}:h`) * 0.15,
      rotation: hash01(`${seed}:r`) * Math.PI * 2, bloom: ROSE_PALETTE[bed.colour]});
  }
  return out;
}

/**
 * Per-vertex colour for a non-indexed low-poly shrub (three's IcosahedronGeometry,
 * z up): red = bloom mask (1 → the instance's bloom colour, 0 → foliage), green =
 * foliage shade. About half the upper faces flower, so one 20-triangle instance
 * reads as a rose bush in bloom with no separate flower geometry or draw call.
 */
export function roseBushVertexColours(positions: ArrayLike<number>): Float32Array {
  const out = new Float32Array(positions.length);
  for (let f = 0; f < positions.length / 9; f++) {
    let cz = 0;
    for (let v = 0; v < 3; v++) cz += positions[f * 9 + v * 3 + 2] / 3;
    const u = hash01(`rose-face:${f}`);
    const bloom = cz > 0.15 ? (u < 0.5 ? 1 : 0) : cz > -0.2 ? (u < 0.15 ? 1 : 0) : 0;
    const shade = 0.8 + hash01(`rose-shade:${f}`) * 0.4;
    for (let v = 0; v < 3; v++) { out[f * 9 + v * 3] = bloom; out[f * 9 + v * 3 + 1] = shade; out[f * 9 + v * 3 + 2] = 0; }
  }
  return out;
}
