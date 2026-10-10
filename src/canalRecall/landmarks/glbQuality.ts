/**
 * Mechanical GLB quality analysis for landmark / building models.
 *
 * Pure geometry (no I/O): feed it a world-space triangle soup and it reports
 * shell holes, see-through wall gaps, detached (floating) parts, inverted roofs,
 * degenerate triangles, below-ground / far-outside geometry, and triangle budget.
 * `scripts/audit-glb-quality.ts` wraps it with GLB loading, ranking and reports.
 *
 * Coordinates are glTF native: Y up, metres.
 */

import {clusterWalls, bearingDelta, type WallSegment} from './wallPlanes';

export interface TriSoup {
  /** xyz triples, world space. */
  positions: Float32Array;
  /** Per-triangle: 1 when its material is single-sided (backface culled); omitted = all single-sided. */
  doubleSided?: Uint8Array;
  /** 3 vertex indices per triangle. */
  indices: Uint32Array;
}

export interface Thresholds {
  /** Vertex weld tolerance (metres) when finding connected components / edges. */
  weld: number;
  /** Components closer than this are "attached". */
  detachGap: number;
  /** Component is a decal/plane (intentionally open) when its thinnest bbox side is below this. */
  flatThickness: number;
  /** Boundary loops on thick components shorter than this perimeter are ignored (T-junction noise). */
  minHoleLoopPerimeter: number;
  /** Wall ray spacing along the footprint ring (metres). */
  rayStep: number;
  /** Heights of wall rays (street height). */
  rayHeights: number[];
  /** Fail when more than this many see-through wall rays pass. */
  maxSeeThroughRays: number;
  /** y below which a vertex is "below ground". */
  belowGround: number;
  /** XZ distance beyond the main body hull that counts as far outside. */
  farOutside: number;
  /** Detached cluster is a FAIL only when its gap exceeds this (smaller gaps read as render seams). */
  failGap: number;
  /** ...and its area (m^2) is at least this (facade-scale; smaller floating bits such as recessed windows only warn). */
  failArea: number;
  /** Largest allowed shell-hole loop perimeter (metres). */
  maxHoleLoopPerimeter: number;
  /** Inverted-roof area (m^2) that fails. */
  maxInvertedRoofArea: number;
  /** Models whose bounding-box diagonal exceeds this are multi-building sites (e.g. stations): hull-based checks are skipped. */
  siteDiagonal: number;
  /** Triangle cap. */
  triangleCap: number;
  /** Blank-wall check: only outward walls with at least this much planar area (m^2) are examined. */
  blankWallMinArea: number;
  /** How far (m) in front of or behind the wall plane glazing / recess / overlay geometry still counts as an opening. */
  blankWallReach: number;
  /**
   * A wall is "blank" when openings (holes cut in the wall, plus non-wall geometry within `blankWallReach` of
   * the plane and inside its extent) cover less than this fraction of the wall area. Real facades carry 10-35 %;
   * 2 % is roughly one window on a 50 m2 wall.
   */
  blankWallMinOpeningFraction: number;
  /** Blank walls are only a FAIL above this area (m^2): ~a 20 x 30 m face. The GLB cannot tell party walls from blank ones (Het Pakhuis's two side walls are 497 m2 of genuine party wall), so anything smaller only warns. */
  blankWallFailArea: number;
  /** Compass bearings (deg, clockwise from north, -Z = north) of walls known to be party / blind walls; matches within 15 deg are exempt. */
  blankWallExemptBearings: number[];
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  weld: 1e-3,
  detachGap: 0.05,
  flatThickness: 0.04,
  minHoleLoopPerimeter: 0.3,
  rayStep: 2,
  rayHeights: [1.5],
  maxSeeThroughRays: 3,
  belowGround: -0.05,
  farOutside: 1.5,
  failGap: 0.08,
  failArea: 12,
  maxHoleLoopPerimeter: 30,
  maxInvertedRoofArea: 4,
  siteDiagonal: 150,
  triangleCap: 60_000,
  blankWallMinArea: 25,
  blankWallReach: 0.5,
  blankWallMinOpeningFraction: 0.02,
  blankWallFailArea: 600,
  blankWallExemptBearings: [],
};

export interface DetachedPart {
  triangles: number;
  area: number;
  /** Min distance to any other part of the model (Infinity if beyond the search radius). */
  gap: number;
  minY: number;
  maxY: number;
  centre: [number, number, number];
  hovering: boolean;
  /** In front of the nearest surface (long ray escapes) rather than recessed in a cavity. */
  exposed: boolean;
}

export interface BlankWall {
  /** Compass bearing the wall faces (deg clockwise from north; -Z is north). */
  bearingDeg: number;
  /** Planar wall area, m^2. */
  area: number;
  widthM: number;
  heightM: number;
  /** Opening area (holes + near-plane geometry) as a fraction of the wall area. */
  openingFraction: number;
  centre: [number, number, number];
}

export interface Finding {
  kind: string;
  severity: 'fail' | 'warn';
  message: string;
}

export interface QualityReport {
  triangles: number;
  bounds: {min: [number, number, number]; max: [number, number, number]};
  components: number;
  clusters: number;
  holes: {loops: number; largestLoopPerimeter: number; boundaryEdges: number; undersideLoops: number; details: {perimeter: number; min: V3; max: V3; facesAbove: boolean}[]; flatComponents: number; points: [number, number, number][]};
  seeThrough: {rays: number; tested: number; points: [number, number, number][]};
  detached: {count: number; parts: DetachedPart[]};
  invertedRoof: {triangles: number; area: number; points: [number, number, number][]};
  /** Large outward walls with no openings (see `findBlankWalls`); empty for site models. */
  blankWalls: BlankWall[];
  degenerate: number;
  nonFinite: number;
  belowGround: {vertices: number; minY: number};
  farOutside: {vertices: number; maxDistance: number};
  findings: Finding[];
  /** Higher = worse. */
  score: number;
  pass: boolean;
}

type V3 = [number, number, number];

class DSU {
  parent: Int32Array;
  constructor(n: number) {
    this.parent = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }
  find(a: number): number {
    while (this.parent[a] !== a) {
      this.parent[a] = this.parent[this.parent[a]];
      a = this.parent[a];
    }
    return a;
  }
  union(a: number, b: number): void {
    a = this.find(a);
    b = this.find(b);
    if (a !== b) this.parent[a] = b;
  }
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Squared distance from point p to triangle abc (Ericson, Real-Time Collision Detection). */
export function pointTriangleDistSq(p: V3, a: V3, b: V3, c: V3): number {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  const q = (r: V3) => { const d = sub(p, r); return dot(d, d); };
  if (d1 <= 0 && d2 <= 0) return q(a);
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return q(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return q([a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]);
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return q(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return q([a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return q([b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]);
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  return q([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

/** Closest point on triangle abc to p (Ericson). */
export function closestPointOnTriangle(p: V3, a: V3, b: V3, c: V3): V3 {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  const cp = sub(p, c);
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}

/** Möller–Trumbore ray vs triangle (double-sided); returns t in [0,tMax] or -1. */
export function rayTriangle(o: V3, d: V3, a: V3, b: V3, c: V3, tMax: number): number {
  const e1 = sub(b, a), e2 = sub(c, a);
  const h = cross(d, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const s = sub(o, a);
  const u = dot(s, h) * inv;
  if (u < 0 || u > 1) return -1;
  const qv = cross(s, e1);
  const v = dot(d, qv) * inv;
  if (v < 0 || u + v > 1) return -1;
  const t = dot(e2, qv) * inv;
  return t >= 0 && t <= tMax ? t : -1;
}

/** Uniform grid over (expanded) triangle bounding boxes. */
class TriGrid {
  cells = new Map<number, number[]>();
  constructor(soup: TriSoup, private cell: number, expand: number, filter?: (t: number) => boolean) {
    const n = soup.indices.length / 3;
    const p = soup.positions;
    for (let t = 0; t < n; t++) {
      if (filter && !filter(t)) continue;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const i = soup.indices[t * 3 + k] * 3;
        x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
        z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
      }
      const ix0 = Math.floor((x0 - expand) / cell), ix1 = Math.floor((x1 + expand) / cell);
      const iy0 = Math.floor((y0 - expand) / cell), iy1 = Math.floor((y1 + expand) / cell);
      const iz0 = Math.floor((z0 - expand) / cell), iz1 = Math.floor((z1 + expand) / cell);
      if ((ix1 - ix0 + 1) * (iy1 - iy0 + 1) * (iz1 - iz0 + 1) > 40000) continue; // giant ground plane: skip
      for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) for (let iz = iz0; iz <= iz1; iz++) {
        const key = this.key(ix, iy, iz);
        let list = this.cells.get(key);
        if (!list) this.cells.set(key, (list = []));
        list.push(t);
      }
    }
  }
  key(ix: number, iy: number, iz: number): number {
    return ((ix + 4096) * 8192 + (iy + 4096)) * 8192 + (iz + 4096);
  }
  at(x: number, y: number, z: number): number[] | undefined {
    return this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell), Math.floor(z / this.cell)));
  }
}

function vert(s: TriSoup, i: number): V3 {
  return [s.positions[i * 3], s.positions[i * 3 + 1], s.positions[i * 3 + 2]];
}
function tri(s: TriSoup, t: number): [V3, V3, V3] {
  return [vert(s, s.indices[t * 3]), vert(s, s.indices[t * 3 + 1]), vert(s, s.indices[t * 3 + 2])];
}

/** Convex hull (XZ) via monotone chain; CCW ring of [x,z] (x right, z up in this 2D frame). */
export function hullXZ(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const crs = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && crs(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && crs(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

function distToHull(pt: [number, number], hull: [number, number][]): number {
  let inside = true, best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const ex = b[0] - a[0], ez = b[1] - a[1];
    if (ex * (pt[1] - a[1]) - ez * (pt[0] - a[0]) < 0) inside = false;
    const l2 = ex * ex + ez * ez || 1e-12;
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * ex + (pt[1] - a[1]) * ez) / l2));
    best = Math.min(best, Math.hypot(pt[0] - a[0] - ex * t, pt[1] - a[1] - ez * t));
  }
  return inside ? 0 : best;
}


/**
 * Blank-wall detection. Clusters near-vertical outward triangles into planar walls (`clusterWalls`), rasterises each
 * wall at 25 cm in wall-local (u, v) and counts openings as
 *   - enclosed empty cells (windows/doors cut through the wall), plus
 *   - the area of any other non-horizontal triangle whose centroid lies within `blankWallReach` in front of or
 *     behind the plane and at least 0.3 m inside the wall's extent (recessed or protruding glazing, frames, doors,
 *     overlay quads).
 * Walls whose opening fraction is below `blankWallMinOpeningFraction` are reported; exempt bearings are skipped.
 * Only wall area visible from outside counts: a sample point on the wall is visible when a horizontal ray along the
 * outward normal leaves the model without meeting any other surface more than `blankWallReach` in front of the wall.
 * Fully enclosed internal partitions (overlapping building parts) are therefore never reported.
 */
export function findBlankWalls(soup: TriSoup, th: Thresholds = DEFAULT_THRESHOLDS, walls: WallSegment[] = clusterWalls(soup, {minArea: th.blankWallMinArea})): BlankWall[] {
  const P = soup.positions, I = soup.indices, nTri = I.length / 3;
  const out: BlankWall[] = [];
  const CELL = 0.25;
  const candidates = walls.filter(w => w.area >= th.blankWallMinArea && !th.blankWallExemptBearings.some(b => bearingDelta(b, w.bearingDeg) <= 15));
  if (!candidates.length) return out;
  // Per-triangle centroid, area and horizontality for evidence lookup.
  const cen = new Float32Array(nTri * 3), area = new Float32Array(nTri), horiz = new Uint8Array(nTri);
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    cen[t * 3] = (P[a] + P[b] + P[c]) / 3; cen[t * 3 + 1] = (P[a + 1] + P[b + 1] + P[c + 1]) / 3; cen[t * 3 + 2] = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    area[t] = len / 2;
    horiz[t] = len > 1e-9 && Math.abs(ny / len) > 0.85 ? 1 : 0;
  }
  // 2D (x, z) triangle grid for horizontal visibility rays.
  const GRID = 2;
  const grid = new Map<number, number[]>();
  const gk = (ix: number, iz: number) => (ix + 32768) * 65536 + (iz + 32768);
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (let t = 0; t < nTri; t++) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) { const i = I[t * 3 + k] * 3; x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
    bx0 = Math.min(bx0, x0); bx1 = Math.max(bx1, x1); bz0 = Math.min(bz0, z0); bz1 = Math.max(bz1, z1);
    for (let ix = Math.floor(x0 / GRID); ix <= Math.floor(x1 / GRID); ix++) for (let iz = Math.floor(z0 / GRID); iz <= Math.floor(z1 / GRID); iz++) {
      const key = gk(ix, iz); const l = grid.get(key); if (l) l.push(t); else grid.set(key, [t]);
    }
  }
  const diag = Math.hypot(bx1 - bx0, bz1 - bz0) + 2;
  /** True when something other than `own` blocks the outward horizontal ray beyond the wall's own front zone. */
  const occluded = (ox: number, oy: number, oz: number, dx: number, dz: number, own: Set<number>): boolean => {
    const seen = new Set<number>();
    for (let s = 0; s <= diag; s += GRID * 0.5) {
      const l = grid.get(gk(Math.floor((ox + dx * s) / GRID), Math.floor((oz + dz * s) / GRID)));
      if (!l) continue;
      for (const t of l) {
        if (seen.has(t) || own.has(t)) continue;
        seen.add(t);
        const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
        // Moller-Trumbore with direction (dx, 0, dz).
        const px = -dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-9) continue;
        const inv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2];
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (tt > th.blankWallReach + 0.02) return true;
      }
    }
    return false;
  };
  for (const w of candidates) {
    const own = new Set(w.tris);
    const W = w.uMax - w.uMin, H = w.vMax - w.vMin;
    const cell = Math.max(CELL, Math.sqrt((W * H) / 150_000));
    const nu = Math.max(1, Math.ceil(W / cell)), nv = Math.max(1, Math.ceil(H / cell));
    const filled = new Uint8Array(nu * nv);
    let visibleFraction = 1;
    for (const t of w.tris) {
      const pts: [number, number][] = [0, 1, 2].map(k => { const i = I[t * 3 + k] * 3; return [P[i] * w.t[0] + P[i + 2] * w.t[1] - w.uMin, P[i + 1] - w.vMin] as [number, number]; });
      const [A, B, C] = pts;
      const u0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]) / cell)), u1 = Math.min(nu - 1, Math.floor(Math.max(A[0], B[0], C[0]) / cell));
      const v0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]) / cell)), v1 = Math.min(nv - 1, Math.floor(Math.max(A[1], B[1], C[1]) / cell));
      const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(den) < 1e-12) continue;
      for (let iu = u0; iu <= u1; iu++) for (let iv = v0; iv <= v1; iv++) {
        const px = (iu + 0.5) * cell, py = (iv + 0.5) * cell;
        const l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den;
        const l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den;
        const eps = -0.02;
        if (l1 >= eps && l2 >= eps && 1 - l1 - l2 >= eps) filled[iv * nu + iu] = 1;
      }
    }
    // Visible fraction: sample filled cells at about 1 m and keep only walls with enough area seen from outside.
    {
      // About 2 m samples, and never more than ~120 rays per wall, so install-time audits stay fast.
      const stride = Math.max(1, Math.round(2 / cell), Math.ceil(Math.sqrt((nu * nv) / 120)));
      let samples = 0, seenN = 0;
      for (let iu = 0; iu < nu; iu += stride) for (let iv = 0; iv < nv; iv += stride) {
        if (!filled[iv * nu + iu]) continue;
        samples++;
        const u = w.uMin + (iu + 0.5) * cell, y = w.vMin + (iv + 0.5) * cell;
        if (!occluded(w.n[0] * w.d + w.t[0] * u, y, w.n[1] * w.d + w.t[1] * u, w.n[0], w.n[1], own)) seenN++;
      }
      visibleFraction = samples ? seenN / samples : 1;
      if (visibleFraction * w.area < th.blankWallMinArea) continue;
    }
    // Enclosed empty cells: flood the outside from the grid border; whatever empty is unreached is a hole in the wall.
    const reach = new Uint8Array(nu * nv);
    const stack: number[] = [];
    const push = (iu: number, iv: number) => { const k = iv * nu + iu; if (!filled[k] && !reach[k]) { reach[k] = 1; stack.push(k); } };
    for (let iu = 0; iu < nu; iu++) { push(iu, 0); push(iu, nv - 1); }
    for (let iv = 0; iv < nv; iv++) { push(0, iv); push(nu - 1, iv); }
    while (stack.length) {
      const k = stack.pop()!, iu = k % nu, iv = (k - iu) / nu;
      if (iu > 0) push(iu - 1, iv);
      if (iu < nu - 1) push(iu + 1, iv);
      if (iv > 0) push(iu, iv - 1);
      if (iv < nv - 1) push(iu, iv + 1);
    }
    let holeCells = 0;
    for (let k = 0; k < filled.length; k++) if (!filled[k] && !reach[k]) holeCells++;
    let opening = holeCells * cell * cell;
    const margin = 0.3;
    for (let t = 0; t < nTri; t++) {
      if (own.has(t) || horiz[t]) continue;
      const x = cen[t * 3], y = cen[t * 3 + 1], z = cen[t * 3 + 2];
      const s = x * w.n[0] + z * w.n[1] - w.d;
      if (Math.abs(s) > th.blankWallReach) continue;
      const u = x * w.t[0] + z * w.t[1];
      if (u < w.uMin + margin || u > w.uMax - margin || y < w.vMin + margin || y > w.vMax - margin) continue;
      opening += area[t];
    }
    const openingFraction = Math.min(1, opening / w.area);
    if (openingFraction < th.blankWallMinOpeningFraction) {
      out.push({bearingDeg: w.bearingDeg, area: w.area * visibleFraction, widthM: W, heightM: H, openingFraction, centre: w.centre});
    }
  }
  return out.sort((a, b) => b.area - a.area);
}

export function analyseSoup(soup: TriSoup, overrides: Partial<Thresholds> = {}): QualityReport {
  const th = {...DEFAULT_THRESHOLDS, ...overrides};
  const nTri = soup.indices.length / 3;
  const nVert = soup.positions.length / 3;
  const findings: Finding[] = [];

  // --- finite / bounds ---
  let nonFinite = 0;
  const bmin: V3 = [Infinity, Infinity, Infinity], bmax: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nVert; i++) {
    const x = soup.positions[i * 3], y = soup.positions[i * 3 + 1], z = soup.positions[i * 3 + 2];
    if (!Number.isFinite(x + y + z)) { nonFinite++; continue; }
    bmin[0] = Math.min(bmin[0], x); bmax[0] = Math.max(bmax[0], x);
    bmin[1] = Math.min(bmin[1], y); bmax[1] = Math.max(bmax[1], y);
    bmin[2] = Math.min(bmin[2], z); bmax[2] = Math.max(bmax[2], z);
  }
  if (nTri === 0 || nonFinite > 0) {
    const r = emptyReport(nTri, bmin, bmax, nonFinite);
    r.findings.push({kind: nonFinite ? 'non-finite' : 'empty', severity: 'fail', message: nonFinite ? `${nonFinite} non-finite vertices` : 'no triangles'});
    r.score = 1000;
    return r;
  }

  const site = Math.hypot(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]) > th.siteDiagonal;

  // --- weld vertices ---
  const q = 1 / th.weld;
  const weldMap = new Map<string, number>();
  const canon = new Int32Array(nVert);
  for (let i = 0; i < nVert; i++) {
    const k = `${Math.round(soup.positions[i * 3] * q)},${Math.round(soup.positions[i * 3 + 1] * q)},${Math.round(soup.positions[i * 3 + 2] * q)}`;
    let id = weldMap.get(k);
    if (id === undefined) { id = weldMap.size; weldMap.set(k, id); }
    canon[i] = id;
  }

  // --- degenerate triangles + welded components ---
  let degenerate = 0;
  const dsu = new DSU(weldMap.size);
  const triOk = new Uint8Array(nTri);
  const triArea = new Float64Array(nTri);
  const triNormal: V3[] = new Array(nTri);
  for (let t = 0; t < nTri; t++) {
    const [a, b, c] = tri(soup, t);
    const n = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(n[0], n[1], n[2]);
    triArea[t] = len / 2;
    const ia = canon[soup.indices[t * 3]], ib = canon[soup.indices[t * 3 + 1]], ic = canon[soup.indices[t * 3 + 2]];
    if (len < 1e-8 || ia === ib || ib === ic || ia === ic) { degenerate++; continue; }
    triOk[t] = 1;
    triNormal[t] = [n[0] / len, n[1] / len, n[2] / len];
    dsu.union(ia, ib); dsu.union(ib, ic);
  }
  const compOfTri = new Int32Array(nTri).fill(-1);
  const compIndex = new Map<number, number>();
  for (let t = 0; t < nTri; t++) {
    if (!triOk[t]) continue;
    const root = dsu.find(canon[soup.indices[t * 3]]);
    let ci = compIndex.get(root);
    if (ci === undefined) { ci = compIndex.size; compIndex.set(root, ci); }
    compOfTri[t] = ci;
  }
  const nComp = compIndex.size;
  const compMin: V3[] = [], compMax: V3[] = [];
  const compTris = new Int32Array(nComp), compArea = new Float64Array(nComp);
  for (let c = 0; c < nComp; c++) { compMin.push([Infinity, Infinity, Infinity]); compMax.push([-Infinity, -Infinity, -Infinity]); }
  for (let t = 0; t < nTri; t++) {
    const c = compOfTri[t];
    if (c < 0) continue;
    compTris[c]++; compArea[c] += triArea[t];
    for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) {
      const v = soup.positions[soup.indices[t * 3 + k] * 3 + a];
      if (v < compMin[c][a]) compMin[c][a] = v;
      if (v > compMax[c][a]) compMax[c][a] = v;
    }
  }
  const thin = (c: number) => Math.min(compMax[c][0] - compMin[c][0], compMax[c][1] - compMin[c][1], compMax[c][2] - compMin[c][2]);
  const isFlat = (c: number) => thin(c) < th.flatThickness;

  // --- holes: boundary edges on thick components ---
  const edgeCount = new Map<string, {n: number; a: number; b: number; comp: number}>();
  for (let t = 0; t < nTri; t++) {
    if (!triOk[t]) continue;
    for (let k = 0; k < 3; k++) {
      const a = canon[soup.indices[t * 3 + k]], b = canon[soup.indices[t * 3 + (k + 1) % 3]];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const e = edgeCount.get(key);
      if (e) e.n++; else edgeCount.set(key, {n: 1, a: Math.min(a, b), b: Math.max(a, b), comp: compOfTri[t]});
    }
  }
  const canonPos = new Map<number, V3>();
  for (let i = 0; i < nVert; i++) if (!canonPos.has(canon[i])) canonPos.set(canon[i], vert(soup, i));
  const rawBoundary = [...edgeCount.values()].filter(e => e.n === 1 && !isFlat(e.comp));
  // Boundary edges whose surroundings are covered by other geometry (undersides resting on lower boxes,
  // ground contact) are not visible holes: drop edges lying within 3 cm of a non-adjacent surface.
  const cover = new TriGrid(soup, 0.5, 0.03);
  const triOfEdge = new Map<string, number>();
  for (let t = 0; t < nTri; t++) {
    if (!triOk[t]) continue;
    for (let k = 0; k < 3; k++) {
      const a = canon[soup.indices[t * 3 + k]], b = canon[soup.indices[t * 3 + (k + 1) % 3]];
      triOfEdge.set(a < b ? `${a}_${b}` : `${b}_${a}`, t);
    }
  }
  const edgeCovered = (e: {a: number; b: number}): boolean => {
    const pa = canonPos.get(e.a)!, pb = canonPos.get(e.b)!;
    const own = triOfEdge.get(`${e.a}_${e.b}`);
    let covered = 0;
    for (const u of [0.25, 0.5, 0.75]) {
      const p: V3 = [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u, pa[2] + (pb[2] - pa[2]) * u];
      if (p[1] < 0.03) { covered++; continue; }
      let hit = false;
      for (const x of cover.at(p[0], p[1], p[2]) ?? []) {
        if (x === own) continue;
        const [ta, tb, tc] = tri(soup, x);
        if (pointTriangleDistSq(p, ta, tb, tc) <= 0.03 * 0.03) { hit = true; break; }
      }
      if (hit) covered++;
    }
    return covered >= 2;
  };
  const bEdges = rawBoundary.filter(e => !edgeCovered(e));
  // Link boundary edges into loops only through manifold boundary vertices (degree 2).
  const bDeg = new Map<number, number[]>();
  bEdges.forEach((e, i) => { for (const v of [e.a, e.b]) { const l = bDeg.get(v); if (l) l.push(i); else bDeg.set(v, [i]); } });
  const edp = new DSU(bEdges.length);
  for (const l of bDeg.values()) if (l.length === 2) edp.union(l[0], l[1]);
  const loopPerim = new Map<number, number>();
  const loopPoint = new Map<number, V3>();
  const loopMinY = new Map<number, number>(), loopMaxY = new Map<number, number>(), loopSide = new Map<number, number>();
  const loopBox = new Map<number, {min: V3; max: V3}>();
  bEdges.forEach((e, i) => {
    const pa = canonPos.get(e.a)!, pb = canonPos.get(e.b)!;
    const r = edp.find(i);
    loopPerim.set(r, (loopPerim.get(r) ?? 0) + Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]));
    if (!loopPoint.has(r)) loopPoint.set(r, [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2]);
    const lb = loopBox.get(r) ?? {min: [Infinity, Infinity, Infinity] as V3, max: [-Infinity, -Infinity, -Infinity] as V3};
    for (let ax = 0; ax < 3; ax++) { lb.min[ax] = Math.min(lb.min[ax], pa[ax], pb[ax]); lb.max[ax] = Math.max(lb.max[ax], pa[ax], pb[ax]); }
    loopBox.set(r, lb);
    loopMinY.set(r, Math.min(loopMinY.get(r) ?? Infinity, pa[1], pb[1]));
    loopMaxY.set(r, Math.max(loopMaxY.get(r) ?? -Infinity, pa[1], pb[1]));
    // Which side of the loop plane do the adjoining faces lie on? (+ = faces above => the missing face is the underside)
    const own = triOfEdge.get(`${e.a}_${e.b}`);
    if (own !== undefined) {
      const [ta, tb, tc] = tri(soup, own);
      loopSide.set(r, (loopSide.get(r) ?? 0) + (ta[1] + tb[1] + tc[1]) / 3 - (pa[1] + pb[1]) / 2);
    }
  });
  // Horizontal loops whose faces rise above them are open undersides (soffits, bottomless boxes on a roof):
  // invisible from the street and from above, so they are not shell holes.
  let undersideLoops = 0;
  for (const r of [...loopPerim.keys()]) {
    if (loopMaxY.get(r)! - loopMinY.get(r)! < 0.1 && (loopSide.get(r) ?? 0) > 0) { loopPerim.delete(r); undersideLoops++; }
  }
  const holeLoops = [...loopPerim.entries()].filter(([, p]) => p >= th.minHoleLoopPerimeter).sort((a, b) => b[1] - a[1]);
  let flatComponents = 0;
  for (let c = 0; c < nComp; c++) if (isFlat(c)) flatComponents++;
  const holes = {
    loops: holeLoops.length,
    largestLoopPerimeter: holeLoops[0]?.[1] ?? 0,
    boundaryEdges: bEdges.length,
    undersideLoops,
    flatComponents,
    points: holeLoops.slice(0, 20).map(([r]) => loopPoint.get(r)!),
    details: holeLoops.slice(0, 10).map(([r, perimeter]) => ({perimeter, min: loopBox.get(r)!.min, max: loopBox.get(r)!.max, facesAbove: (loopSide.get(r) ?? 0) > 0})),
  };

  // --- proximity clustering of components (touching boxes form one body) ---
  const grid = new TriGrid(soup, 0.5, th.detachGap);
  const cdsu = new DSU(nComp);
  const tol2 = th.detachGap * th.detachGap;
  const samples = (t: number): V3[] => {
    const [a, b, c] = tri(soup, t);
    const out: V3[] = [a, b, c, [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]];
    for (const [p, r] of [[a, b], [b, c], [c, a]] as [V3, V3][]) {
      const len = Math.hypot(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
      const n = Math.min(60, Math.floor(len / 0.1));
      for (let i = 1; i <= n; i++) { const u = i / (n + 1); out.push([p[0] + (r[0] - p[0]) * u, p[1] + (r[1] - p[1]) * u, p[2] + (r[2] - p[2]) * u]); }
    }
    return out;
  };
  for (let t = 0; t < nTri; t++) {
    const ca = compOfTri[t];
    if (ca < 0) continue;
    for (const p of samples(t)) {
      const list = grid.at(p[0], p[1], p[2]);
      if (!list) continue;
      for (const u of list) {
        const cb = compOfTri[u];
        if (cb < 0 || cb === ca || cdsu.find(ca) === cdsu.find(cb)) continue;
        const [a, b, c] = tri(soup, u);
        if (pointTriangleDistSq(p, a, b, c) <= tol2) cdsu.union(ca, cb);
      }
    }
  }
  const clusterOf = new Int32Array(nComp);
  const clusterIds = new Map<number, number>();
  for (let c = 0; c < nComp; c++) {
    const r = cdsu.find(c);
    let id = clusterIds.get(r);
    if (id === undefined) { id = clusterIds.size; clusterIds.set(r, id); }
    clusterOf[c] = id;
  }
  const nClusters = clusterIds.size;
  const cTris = new Int32Array(nClusters), cArea = new Float64Array(nClusters);
  const cMin: V3[] = [], cMax: V3[] = [];
  for (let i = 0; i < nClusters; i++) { cMin.push([Infinity, Infinity, Infinity]); cMax.push([-Infinity, -Infinity, -Infinity]); }
  for (let c = 0; c < nComp; c++) {
    const k = clusterOf[c];
    cTris[k] += compTris[c]; cArea[k] += compArea[c];
    for (let a = 0; a < 3; a++) { cMin[k][a] = Math.min(cMin[k][a], compMin[c][a]); cMax[k][a] = Math.max(cMax[k][a], compMax[c][a]); }
  }
  let main = 0;
  for (let k = 1; k < nClusters; k++) if (cArea[k] > cArea[main]) main = k;
  const inMain = (t: number) => compOfTri[t] >= 0 && clusterOf[compOfTri[t]] === main;

  // --- detached: distance of every other cluster to the main body ---
  const SEARCH = 3;
  const mainGrid = new TriGrid(soup, 1, 0, t => compOfTri[t] >= 0);
  const rayGridAll = new TriGrid(soup, 1, 0);
  const trisOfCluster: number[][] = Array.from({length: nClusters}, () => []);
  for (let t = 0; t < nTri; t++) if (compOfTri[t] >= 0) trisOfCluster[clusterOf[compOfTri[t]]].push(t);
  /** Nearest approach of cluster k to any other cluster, plus whether that nearest face is exposed:
   *  the part sits on the side of the nearest surface from which a long ray escapes, i.e. it is in front of
   *  the wall (floating facade / hovering roof) rather than recessed into a cavity (window glass behind a wall). */
  const nearestOther = (k: number): {gap: number; exposed: boolean} => {
    let best = Infinity, bestTri = -1;
    let bestP: V3 = [0, 0, 0];
    const list = trisOfCluster[k];
    const stride = Math.max(1, Math.floor(list.length / 300));
    for (let li = 0; li < list.length; li += stride) {
      const [a0, b0, c0] = tri(soup, list[li]);
      const pts: V3[] = [a0, b0, c0, [(a0[0] + b0[0] + c0[0]) / 3, (a0[1] + b0[1] + c0[1]) / 3, (a0[2] + b0[2] + c0[2]) / 3]];
      for (const p of pts) {
        const seen = new Set<number>();
        for (let dx = -SEARCH; dx <= SEARCH; dx++) for (let dy = -SEARCH; dy <= SEARCH; dy++) for (let dz = -SEARCH; dz <= SEARCH; dz++) {
          const cell = mainGrid.at(p[0] + dx, p[1] + dy, p[2] + dz);
          if (!cell) continue;
          for (const u of cell) {
            if (seen.has(u) || clusterOf[compOfTri[u]] === k) continue;
            seen.add(u);
            const [a, b, c] = tri(soup, u);
            const d = pointTriangleDistSq(p, a, b, c);
            if (d < best) { best = d; bestTri = u; bestP = p; }
          }
        }
      }
    }
    if (bestTri < 0) return {gap: Infinity, exposed: true};
    const [a, b, c] = tri(soup, bestTri);
    const q = closestPointOnTriangle(bestP, a, b, c);
    const n = triNormal[bestTri] ?? [0, 1, 0];
    const dv = sub(bestP, q);
    const side = dot(dv, n);
    if (Math.abs(side) < 0.5 * Math.sqrt(best)) return {gap: Math.sqrt(best), exposed: false}; // beside, not in front
    const dir: V3 = side > 0 ? n : [-n[0], -n[1], -n[2]];
    const o: V3 = [q[0] + dir[0] * 0.002, q[1] + dir[1] * 0.002, q[2] + dir[2] * 0.002];
    // Long ray from the surface towards the part; own cluster is transparent to it.
    const seen = new Set<number>();
    let blocked = false;
    for (let s = 0; s <= 60 && !blocked; s += 1) {
      for (const u of rayGridAll.at(o[0] + dir[0] * s, o[1] + dir[1] * s, o[2] + dir[2] * s) ?? []) {
        if (seen.has(u) || u === bestTri || (compOfTri[u] >= 0 && clusterOf[compOfTri[u]] === k)) continue;
        seen.add(u);
        const [ta, tb, tc] = tri(soup, u);
        if (rayTriangle(o, dir, ta, tb, tc, 60) >= 0) { blocked = true; break; }
      }
    }
    return {gap: Math.sqrt(best), exposed: !blocked};
  };
  const parts: DetachedPart[] = [];
  for (let k = 0; k < nClusters; k++) {
    if (k === main) continue;
    const near = nearestOther(k);
    parts.push({
      triangles: cTris[k], area: cArea[k], gap: near.gap, exposed: near.exposed,
      minY: cMin[k][1], maxY: cMax[k][1],
      centre: [(cMin[k][0] + cMax[k][0]) / 2, (cMin[k][1] + cMax[k][1]) / 2, (cMin[k][2] + cMax[k][2]) / 2],
      hovering: cMin[k][1] > 0.3,
    });
  }
  parts.sort((a, b) => b.area - a.area);

  // --- main-body hull, below ground, far outside ---
  const mainPts: [number, number][] = [];
  for (let t = 0; t < nTri; t++) if (inMain(t)) for (let k = 0; k < 3; k++) { const i = soup.indices[t * 3 + k] * 3; mainPts.push([soup.positions[i], soup.positions[i + 2]]); }
  const hull = hullXZ(mainPts);
  let below = 0, minY = Infinity, farN = 0, farMax = 0;
  for (let i = 0; i < nVert; i++) {
    const y = soup.positions[i * 3 + 1];
    minY = Math.min(minY, y);
    if (y < th.belowGround) below++;
  }
  for (let t = 0; t < nTri; t++) {
    if (compOfTri[t] < 0 || inMain(t)) continue;
    for (let k = 0; k < 3; k++) {
      const i = soup.indices[t * 3 + k] * 3;
      const d = distToHull([soup.positions[i], soup.positions[i + 2]], hull);
      if (d > th.farOutside && !site) farN++;
      if (d > farMax) farMax = d;
    }
  }

  // --- ray helpers over all triangles ---
  const rayGrid = new TriGrid(soup, 1, 0);
  const castUp = (o: V3, skip: number): boolean => {
    const seen = new Set<number>();
    for (let y = o[1]; y <= bmax[1] + 1; y += 1) {
      const list = rayGrid.at(o[0], y, o[2]);
      if (!list) continue;
      for (const u of list) {
        if (u === skip || seen.has(u)) continue;
        seen.add(u);
        const [a, b, c] = tri(soup, u);
        if (rayTriangle([o[0], o[1] + 0.02, o[2]], [0, 1, 0], a, b, c, 1e4) >= 0) return true;
      }
    }
    return false;
  };
  /** Height of the lowest surface directly above `o` (Infinity when none). */
  const lowestAbove = (o: V3): number => {
    const seen = new Set<number>();
    let best = Infinity;
    for (let y = o[1]; y <= bmax[1] + 1 && best === Infinity; y += 1) {
      const list = rayGrid.at(o[0], y, o[2]);
      if (!list) continue;
      for (const u of list) {
        if (seen.has(u)) continue;
        seen.add(u);
        const [a, b, c] = tri(soup, u);
        const t = rayTriangle([o[0], o[1] + 0.02, o[2]], [0, 1, 0], a, b, c, 1e4);
        if (t >= 0) best = Math.min(best, o[1] + 0.02 + t);
      }
    }
    return best;
  };
  const firstHit = (o: V3, d: V3, tMax: number): number => {
    let best = -1;
    const seen = new Set<number>();
    for (let s = 0; s <= tMax + 0.5; s += 0.5) {
      const m = Math.min(s, tMax);
      const list = rayGrid.at(o[0] + d[0] * m, o[1] + d[1] * m, o[2] + d[2] * m);
      if (!list) continue;
      for (const u of list) {
        if (seen.has(u)) continue;
        seen.add(u);
        const [a, b, c] = tri(soup, u);
        const t = rayTriangle(o, d, a, b, c, tMax);
        if (t >= 0 && (best < 0 || t < best)) best = t;
      }
    }
    return best;
  };

  // --- inverted roofs: downward triangle, above street level, with open sky above ---
  let invTris = 0, invArea = 0, invDoubleArea = 0;
  const invPoints: V3[] = [];
  for (let t = 0; t < nTri; t++) {
    if (!triOk[t] || triNormal[t][1] > -0.5 || triArea[t] < 0.05) continue;
    const [a, b, c] = tri(soup, t);
    const cen: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (cen[1] < 1.5) continue;
    if (!castUp(cen, t)) {
      invTris++;
      if (soup.doubleSided && soup.doubleSided[t]) { invDoubleArea += triArea[t]; if (invPoints.length < 20) invPoints.push(cen); continue; }
      invArea += triArea[t];
      if (invPoints.length < 20) invPoints.push(cen);
    }
  }

  // --- see-through wall gaps ---
  // Footprint-based: rasterise the main body's XZ projection (walls as lines, roofs and floors as areas) at 25 cm,
  // take its boundary (outer edge and courtyards) with outward normals, and at each ~2 m sample aim a street-height
  // ray from 3 m outside the edge to 1 m inside it. A ray counts as see-through only when the point 1 m inside is
  // roofed (a wall had to be crossed) and the ray hits nothing. A ray that misses is still closed when it runs under
  // a LOW soffit (a porch or canopy at most max(6 m, ray + 4 m) above ground) and meets a wall within 4 m of the edge.
  // Main roofs and upper storeys never qualify, so deep gaps under a tall roof stay gaps.
  const seeThrough = {rays: 0, tested: 0, points: [] as V3[]};
  if (mainPts.length >= 3 && !site) {
    const CELL = 0.25;
    let gx0 = Infinity, gx1 = -Infinity, gz0 = Infinity, gz1 = -Infinity;
    for (const [x, z] of mainPts) { gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gz0 = Math.min(gz0, z); gz1 = Math.max(gz1, z); }
    gx0 -= 1; gz0 -= 1;
    const cw = Math.ceil((gx1 - gx0 + 2) / CELL), ch = Math.ceil((gz1 - gz0 + 2) / CELL);
    if (cw * ch <= 16_000_000) {
      const occ = new Uint8Array(cw * ch);
      const mark = (x: number, z: number) => { const ix = Math.floor((x - gx0) / CELL), iz = Math.floor((z - gz0) / CELL); if (ix >= 0 && iz >= 0 && ix < cw && iz < ch) occ[iz * cw + ix] = 1; };
      for (let t = 0; t < nTri; t++) {
        if (!inMain(t)) continue;
        const [A, B, C] = [0, 1, 2].map(k => { const i = soup.indices[t * 3 + k] * 3; return [soup.positions[i], soup.positions[i + 2]] as [number, number]; });
        const edges: [[number, number], [number, number]][] = [[A, B], [B, C], [C, A]];
        for (const [p0, p1] of edges) {
          const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(1, Math.ceil(L / (CELL / 2)));
          for (let k = 0; k <= n; k++) mark(p0[0] + (p1[0] - p0[0]) * k / n, p0[1] + (p1[1] - p0[1]) * k / n);
        }
        const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
        if (Math.abs(den) < 1e-9) continue;
        const ix0 = Math.max(0, Math.floor((Math.min(A[0], B[0], C[0]) - gx0) / CELL)), ix1 = Math.min(cw - 1, Math.floor((Math.max(A[0], B[0], C[0]) - gx0) / CELL));
        const iz0 = Math.max(0, Math.floor((Math.min(A[1], B[1], C[1]) - gz0) / CELL)), iz1 = Math.min(ch - 1, Math.floor((Math.max(A[1], B[1], C[1]) - gz0) / CELL));
        for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
          const px = gx0 + (ix + 0.5) * CELL, pz = gz0 + (iz + 0.5) * CELL;
          const l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (pz - C[1])) / den, l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (pz - C[1])) / den;
          if (l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) occ[iz * cw + ix] = 1;
        }
      }
      const at = (ix: number, iz: number) => (ix < 0 || iz < 0 || ix >= cw || iz >= ch ? 0 : occ[iz * cw + ix]);
      const kept = new Map<string, [number, number][]>();
      const SP = th.rayStep;
      const R = 3;
      for (let iz = 0; iz < ch; iz++) for (let ix = 0; ix < cw; ix++) {
        if (!occ[iz * cw + ix] || (at(ix - 1, iz) && at(ix + 1, iz) && at(ix, iz - 1) && at(ix, iz + 1))) continue;
        let nx = 0, nz = 0;
        for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (!at(ix + dx, iz + dz)) { nx += dx; nz += dz; }
        const nl = Math.hypot(nx, nz);
        if (nl < 1e-6) continue;
        nx /= nl; nz /= nl;
        const ex = gx0 + (ix + 0.5) * CELL + nx * CELL / 2, ez = gz0 + (iz + 0.5) * CELL + nz * CELL / 2;
        const key = `${Math.floor(ex / SP)},${Math.floor(ez / SP)}`;
        let near = false;
        for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++) for (const q of kept.get(`${Math.floor(ex / SP) + a},${Math.floor(ez / SP) + b}`) ?? []) if (Math.hypot(q[0] - ex, q[1] - ez) < SP) { near = true; break; }
        if (near) continue;
        const list = kept.get(key); if (list) list.push([ex, ez]); else kept.set(key, [[ex, ez]]);
        // Aim inward (against the outward normal).
        const dx = -nx, dz = -nz;
        for (const h of th.rayHeights) {
          const target: V3 = [ex + dx, h, ez + dz];
          if (target[1] > bmax[1] || !castUp(target, -1)) continue;
          seeThrough.tested++;
          const o: V3 = [ex - dx * 3, h, ez - dz * 3];
          let hit = firstHit(o, [dx, 0, dz], 4 - 0.01);
          if (hit < 0) {
            const ext = firstHit(o, [dx, 0, dz], 7 - 0.01);
            if (ext > 0) {
              const cap = Math.max(minY + 6, h + 4);
              for (let s = 3; s < ext - 0.2; s += 0.5) if (lowestAbove([o[0] + dx * s, h, o[2] + dz * s]) <= cap) { hit = ext; break; }
            }
          }
          if (hit < 0) {
            seeThrough.rays++;
            if (seeThrough.points.length < 40) seeThrough.points.push(target);
          }
        }
      }
    }
  }

  // --- findings ---
  if (site) findings.push({kind: 'site-model', severity: 'warn', message: `bounding diagonal > ${th.siteDiagonal} m: multi-building site, see-through and far-outside checks skipped`});
  const triangles = nTri - degenerate;
  if (degenerate > Math.max(5, nTri * 0.02)) findings.push({kind: 'degenerate', severity: 'fail', message: `${degenerate} degenerate triangles`});
  else if (degenerate) findings.push({kind: 'degenerate', severity: 'warn', message: `${degenerate} degenerate triangles`});
  if (holes.largestLoopPerimeter > th.maxHoleLoopPerimeter) findings.push({kind: 'holes', severity: 'fail', message: `${holes.loops} open boundary loops, largest perimeter ${holes.largestLoopPerimeter.toFixed(1)} m`});
  else if (holes.loops) findings.push({kind: 'holes', severity: 'warn', message: `${holes.loops} small open boundary loops (largest ${holes.largestLoopPerimeter.toFixed(2)} m)`});
  if (seeThrough.rays > th.maxSeeThroughRays) findings.push({kind: 'see-through', severity: 'fail', message: `${seeThrough.rays}/${seeThrough.tested} street-height rays pass straight into the footprint`});
  else if (seeThrough.rays) findings.push({kind: 'see-through', severity: 'warn', message: `${seeThrough.rays}/${seeThrough.tested} street-height rays pass into the footprint`});
  // Grounded separate masses (steps, plinths, annexes resting on the ground) are not "floating".
  const relevant = parts.filter(p => p.gap > th.detachGap && (p.gap <= 2 || p.hovering));
  const bad = relevant.filter(p => p.gap > th.failGap && p.area >= th.failArea && p.minY > 0.05);
  const minor = relevant.filter(p => !bad.includes(p));
  if (bad.length) findings.push({kind: 'detached', severity: 'fail', message: `${bad.length} detached part(s): ${bad.slice(0, 3).map(p => `${p.area.toFixed(1)} m2 gap ${p.gap.toFixed(2)} m${p.hovering ? ' hovering' : ''}`).join('; ')}`});
  if (minor.length) findings.push({kind: 'detached-minor', severity: 'warn', message: `${minor.length} small/near detached part(s), worst ${minor[0].area.toFixed(1)} m2 gap ${minor[0].gap.toFixed(2)} m`});
  if (invArea > th.maxInvertedRoofArea) findings.push({kind: 'inverted-roof', severity: 'fail', message: `${invTris} downward-facing roof triangles, ${invArea.toFixed(1)} m2 with open sky above`});
  else if (invTris) findings.push({kind: 'inverted-roof', severity: 'warn', message: `${invTris} downward-facing roof triangles (${(invArea + invDoubleArea).toFixed(1)} m2; ${invDoubleArea.toFixed(1)} m2 on double-sided materials renders but shades inverted)`});
  if (below) findings.push({kind: 'below-ground', severity: minY < -0.5 ? 'fail' : 'warn', message: `${below} vertices below ground, lowest y ${minY.toFixed(2)}`});
  if (farN) findings.push({kind: 'far-outside', severity: 'fail', message: `${farN} vertices more than ${th.farOutside} m outside the main body (max ${farMax.toFixed(1)} m)`});
  if (triangles > th.triangleCap) findings.push({kind: 'triangle-cap', severity: 'fail', message: `${triangles} triangles exceeds cap ${th.triangleCap}`});

  const blankWalls = site ? [] : findBlankWalls(soup, th);
  for (const w of blankWalls) {
    findings.push({
      kind: 'blank-wall', severity: w.area >= th.blankWallFailArea ? 'fail' : 'warn',
      message: `blank wall facing ${w.bearingDeg.toFixed(0)} deg (${compass(w.bearingDeg)}): ${w.area.toFixed(0)} m2 (${w.widthM.toFixed(1)} x ${w.heightM.toFixed(1)} m), openings ${(w.openingFraction * 100).toFixed(1)}% - no windows, doors or recesses (pass blankWallExemptBearings for genuine party walls)`,
    });
  }

  const score =
    blankWalls.reduce((s, w) => s + (w.area >= th.blankWallFailArea ? 10 : 0) + Math.min(w.area, 300) / 30, 0) +
    bad.reduce((s, p) => s + 20 + Math.min(p.area, 100) / 2, 0) +
    (holes.largestLoopPerimeter > th.maxHoleLoopPerimeter ? 10 + Math.min(holes.loops, 50) + Math.min(holes.largestLoopPerimeter, 60) / 3 : 0) +
    (seeThrough.rays > th.maxSeeThroughRays ? 10 + seeThrough.rays : seeThrough.rays) +
    (invArea > th.maxInvertedRoofArea ? 10 + Math.min(invArea, 200) / 10 : 0) +
    (farN ? 10 : 0) + (below ? Math.min(10, -minY * 5) : 0) +
    (triangles > th.triangleCap ? 10 + (triangles - th.triangleCap) / 5000 : 0) + Math.min(degenerate, 100) / 20;

  return {
    triangles, bounds: {min: bmin, max: bmax}, components: nComp, clusters: nClusters, holes, seeThrough,
    detached: {count: bad.length, parts: parts.slice(0, 20)},
    invertedRoof: {triangles: invTris, area: invArea, points: invPoints}, blankWalls,
    degenerate, nonFinite, belowGround: {vertices: below, minY: Number.isFinite(minY) ? minY : 0},
    farOutside: {vertices: farN, maxDistance: farMax}, findings, score,
    pass: !findings.some(f => f.severity === 'fail'),
  };
}

function emptyReport(nTri: number, bmin: V3, bmax: V3, nonFinite: number): QualityReport {
  return {
    triangles: nTri, bounds: {min: bmin, max: bmax}, components: 0, clusters: 0,
    holes: {loops: 0, largestLoopPerimeter: 0, boundaryEdges: 0, undersideLoops: 0, details: [], flatComponents: 0, points: []},
    seeThrough: {rays: 0, tested: 0, points: []}, detached: {count: 0, parts: []},
    invertedRoof: {triangles: 0, area: 0, points: []}, blankWalls: [], degenerate: 0, nonFinite,
    belowGround: {vertices: 0, minY: 0}, farOutside: {vertices: 0, maxDistance: 0}, findings: [], score: 0, pass: false,
  };
}

function compass(bearing: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
}
