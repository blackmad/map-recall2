// Is a building between the camera and a point on the ground?
//
// User 2026-10-25 (chase view over the Oudezijds Voorburgwal at the Oude
// Doelenstraat): "need to hide road labels behind buildings". Street names are
// painted on the HUD canvas (road-network.js `drawLabels`), above every map
// layer, so the names of the alleys behind the canal-side rows (Stoofsteeg,
// Barndesteeg, Koestraat…) printed across the roofs that hide those alleys.
//
// The buildings are drawn by three different renderers (three.js city,
// recipe tiles, signature landmarks) whose ray pickers cost ~0.7 ms each
// (labelOverlay.ts measured 25-35 ms for 40 picks), and reading the depth
// buffer back stalls the GPU. The camera clearance already answers the same
// question against the resident 3DBAG footprints (vector-map.js
// `_cameraSightlineBlocker`), so this does it that way, made cheap: the
// footprints are prepared once into local metres and bucketed on a grid, and
// a sightline visits only the cells under it and the walls it crosses.
//
// Pure apart from `performance.now()` for the time-sliced build; no DOM, no map.

export interface FootprintFeature {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

export interface SightPoint {
  lng: number;
  lat: number;
  /** Metres above the ground. */
  altM: number;
}

/** Grid cell edge, metres. A canal-belt house is 6-10 m wide, a block 40-80 m. */
export const SIGHTLINE_CELL_M = 40;
/** A wall must stand this far above the sightline to hide the point (roof noise, eaves overhangs). */
export const SIGHTLINE_CLEARANCE_M = 0.75;
/** Wall crossings this close to the anchor do not count: a kerb-side facade does not hide its own street. */
export const ANCHOR_SLACK_M = 2;

const M_PER_DEG_LAT = 111320;
/** Fixed local origin (the Dam); equirectangular metres are fine at city scale. */
const ORIGIN_LNG = 4.8936, ORIGIN_LAT = 52.3731;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos(ORIGIN_LAT * Math.PI / 180);

export function toLocal(lng: number, lat: number): [number, number] {
  return [(lng - ORIGIN_LNG) * M_PER_DEG_LNG, (lat - ORIGIN_LAT) * M_PER_DEG_LAT];
}

/** One footprint in local metres: outer rings as flat x,y pairs, a box and a top height. */
interface Prepared {
  rings: Float64Array[];
  minX: number; minY: number; maxX: number; maxY: number;
  topM: number;
  stamp: number;
}

/**
 * The height a sightline must clear over this building. 3DBAG `height` is the
 * roof's top; a pitched roof is that high only along its ridge, so the wall
 * line it is crossed at sits between eaves and ridge.
 */
export function occluderTopM(properties: Record<string, unknown> | null | undefined): number {
  const p = properties || {};
  const height = Number(p.height), eaves = Number(p.roofEavesHeightM);
  const pitched = typeof p.roofShape === 'string' && p.roofShape !== 'flat';
  if (Number.isFinite(height) && Number.isFinite(eaves) && pitched && eaves < height) return (height + eaves) / 2;
  if (Number.isFinite(height)) return height;
  if (Number.isFinite(eaves)) return eaves;
  return 0;
}

function prepare(feature: FootprintFeature): Prepared | null {
  const g = feature.geometry;
  const polygons = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? (g.coordinates as unknown[]) : [];
  const topM = occluderTopM(feature.properties);
  if (!(topM > 1)) return null;
  const rings: Float64Array[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const polygon of polygons as unknown[][]) {
    const outer = Array.isArray(polygon) ? polygon[0] as number[][] : null;
    if (!Array.isArray(outer) || outer.length < 3) continue;
    const flat = new Float64Array(outer.length * 2);
    for (let i = 0; i < outer.length; i++) {
      const [x, y] = toLocal(outer[i][0], outer[i][1]);
      flat[i * 2] = x; flat[i * 2 + 1] = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    rings.push(flat);
  }
  return rings.length ? { rings, minX, minY, maxX, maxY, topM, stamp: 0 } : null;
}

const cellKey = (ix: number, iy: number) => (ix + 32768) * 65536 + (iy + 32768);

function pointInRing(x: number, y: number, ring: Float64Array): boolean {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2], yi = ring[i * 2 + 1], xj = ring[j * 2], yj = ring[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface SightlineStats { features: number; cells: number; buildMs: number; tests: number; blocked: number; testMs: number }

/**
 * A grid of resident footprints. `refresh(features)` adopts a new resident
 * list (time-sliced: the previous grid answers until the new one is complete);
 * `blocked(camera, anchor)` tests one sightline.
 */
export class SightlineIndex {
  private readonly prepared = new WeakMap<object, Prepared | null>();
  private grid = new Map<number, Prepared[]>();
  private source: readonly FootprintFeature[] | null = null;
  private pending: { list: readonly FootprintFeature[]; next: number; grid: Map<number, Prepared[]>; ms: number } | null = null;
  private stamp = 1;
  stats: SightlineStats = { features: 0, cells: 0, buildMs: 0, tests: 0, blocked: 0, testMs: 0 };

  constructor(private readonly cellM = SIGHTLINE_CELL_M) {}

  /** Whether any footprints are indexed. */
  get ready(): boolean { return this.grid.size > 0; }

  /** Adopt `features` (by identity). Spends at most `budgetMs` per call; returns true when the grid is current. */
  refresh(features: readonly FootprintFeature[] | null | undefined, budgetMs = 2): boolean {
    if (!features) return this.source === null;
    if (features === this.source && !this.pending) return true;
    if (!this.pending || this.pending.list !== features) this.pending = { list: features, next: 0, grid: new Map(), ms: 0 };
    const job = this.pending, start = performance.now(), deadline = start + budgetMs, cell = this.cellM;
    while (job.next < job.list.length) {
      const feature = job.list[job.next++];
      let p = this.prepared.get(feature as object);
      if (p === undefined) { p = prepare(feature); this.prepared.set(feature as object, p); }
      if (p) {
        const x0 = Math.floor(p.minX / cell), x1 = Math.floor(p.maxX / cell);
        const y0 = Math.floor(p.minY / cell), y1 = Math.floor(p.maxY / cell);
        for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
          const key = cellKey(ix, iy);
          const bucket = job.grid.get(key);
          if (bucket) bucket.push(p); else job.grid.set(key, [p]);
        }
      }
      if ((job.next & 255) === 0 && performance.now() > deadline) break;
    }
    job.ms += performance.now() - start;
    if (job.next < job.list.length) return false;
    this.grid = job.grid;
    this.source = features;
    this.pending = null;
    this.stats.features = features.length;
    this.stats.cells = job.grid.size;
    this.stats.buildMs = Math.round(job.ms * 10) / 10;
    return true;
  }

  /**
   * True when a building's walls stand above the straight line from the
   * camera to the anchor. Buildings whose footprint holds the camera (its
   * back-face-culled walls are invisible) or the anchor are skipped.
   */
  blocked(camera: SightPoint, anchor: SightPoint): boolean {
    const t0 = performance.now();
    const result = this.test(camera, anchor);
    this.stats.tests++;
    if (result) this.stats.blocked++;
    this.stats.testMs += performance.now() - t0;
    return result;
  }

  /** Zero the per-frame counters. */
  resetCounters(): void { this.stats.tests = 0; this.stats.blocked = 0; this.stats.testMs = 0; }

  private test(camera: SightPoint, anchor: SightPoint): boolean {
    if (!this.grid.size) return false;
    const [ax, ay] = toLocal(camera.lng, camera.lat), [bx, by] = toLocal(anchor.lng, anchor.lat);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len < ANCHOR_SLACK_M * 2) return false;
    const tMax = 1 - ANCHOR_SLACK_M / len;
    const stamp = ++this.stamp, cell = this.cellM;
    // Walk the cells under the segment (Amanatides-Woo).
    let ix = Math.floor(ax / cell), iy = Math.floor(ay / cell);
    const ex = Math.floor(bx / cell), ey = Math.floor(by / cell);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const tdx = sx ? cell / Math.abs(dx) : Infinity, tdy = sy ? cell / Math.abs(dy) : Infinity;
    let tx = sx ? ((sx > 0 ? (ix + 1) * cell : ix * cell) - ax) / dx : Infinity;
    let ty = sy ? ((sy > 0 ? (iy + 1) * cell : iy * cell) - ay) / dy : Infinity;
    const visit = (cx: number, cy: number): boolean => {
      const bucket = this.grid.get(cellKey(cx, cy));
      if (bucket) for (const p of bucket) {
        if (p.stamp === stamp) continue;
        p.stamp = stamp;
        if (this.wallAbove(p, ax, ay, dx, dy, bx, by, tMax, camera.altM, anchor.altM)) return true;
      }
      return false;
    };
    for (let guard = 0; guard < 4096; guard++) {
      if (visit(ix, iy)) return true;
      if (ix === ex && iy === ey) break;
      if (Math.min(tx, ty) > 1) return visit(ex, ey);
      if (tx < ty) { ix += sx; tx += tdx; } else { iy += sy; ty += tdy; }
    }
    return false;
  }

  private wallAbove(p: Prepared, ax: number, ay: number, dx: number, dy: number, bx: number, by: number, tMax: number, camAlt: number, anchorAlt: number): boolean {
    // Box reject against the segment's box.
    if (p.maxX < Math.min(ax, bx) || p.minX > Math.max(ax, bx) || p.maxY < Math.min(ay, by) || p.minY > Math.max(ay, by)) return false;
    // Cheapest rejection: the sightline is above this roof everywhere along it.
    if (p.topM < Math.min(camAlt, anchorAlt) + SIGHTLINE_CLEARANCE_M) return false;
    for (const ring of p.rings) {
      if (pointInRing(ax, ay, ring) || pointInRing(bx, by, ring)) return false;
    }
    for (const ring of p.rings) {
      const n = ring.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const cx = ring[j * 2], cy = ring[j * 2 + 1];
        const ex = ring[i * 2] - cx, ey = ring[i * 2 + 1] - cy;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((cx - ax) * ey - (cy - ay) * ex) / den;
        if (t <= 0 || t > tMax) continue;
        const u = ((cx - ax) * dy - (cy - ay) * dx) / den;
        if (u < 0 || u > 1) continue;
        const rayAlt = camAlt + (anchorAlt - camAlt) * t;
        if (p.topM > rayAlt + SIGHTLINE_CLEARANCE_M) return true;
      }
    }
    return false;
  }
}
