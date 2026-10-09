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
  // Walk the hull of the main body. At each ring sample aim a street-height ray inward; only count it
  // when the point 1 m inside is roofed (so a wall had to be crossed) and the ray hits nothing before it.
  const seeThrough = {rays: 0, tested: 0, points: [] as V3[]};
  if (hull.length >= 3 && !site) {
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const ex = b[0] - a[0], ez = b[1] - a[1];
      const len = Math.hypot(ex, ez);
      if (len < 1e-6) continue;
      const nIn: [number, number] = [-ez / len, ex / len]; // CCW hull: left of edge is interior
      const n = Math.max(1, Math.floor(len / th.rayStep));
      for (let s = 0; s < n; s++) {
        const u = (s + 0.5) / n;
        const px = a[0] + ex * u, pz = a[1] + ez * u;
        for (const h of th.rayHeights) {
          const target: V3 = [px + nIn[0], h, pz + nIn[1]];
          if (target[1] > bmax[1] || !castUp(target, -1)) continue;
          seeThrough.tested++;
          const hit = firstHit([px - nIn[0] * 3, h, pz - nIn[1] * 3], [nIn[0], 0, nIn[1]], 4 - 0.01);
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

  const score =
    bad.reduce((s, p) => s + 20 + Math.min(p.area, 100) / 2, 0) +
    (holes.largestLoopPerimeter > th.maxHoleLoopPerimeter ? 10 + Math.min(holes.loops, 50) + Math.min(holes.largestLoopPerimeter, 60) / 3 : 0) +
    (seeThrough.rays > th.maxSeeThroughRays ? 10 + seeThrough.rays : seeThrough.rays) +
    (invArea > th.maxInvertedRoofArea ? 10 + Math.min(invArea, 200) / 10 : 0) +
    (farN ? 10 : 0) + (below ? Math.min(10, -minY * 5) : 0) +
    (triangles > th.triangleCap ? 10 + (triangles - th.triangleCap) / 5000 : 0) + Math.min(degenerate, 100) / 20;

  return {
    triangles, bounds: {min: bmin, max: bmax}, components: nComp, clusters: nClusters, holes, seeThrough,
    detached: {count: bad.length, parts: parts.slice(0, 20)},
    invertedRoof: {triangles: invTris, area: invArea, points: invPoints},
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
    invertedRoof: {triangles: 0, area: 0, points: []}, degenerate: 0, nonFinite,
    belowGround: {vertices: 0, minY: 0}, farOutside: {vertices: 0, maxDistance: 0}, findings: [], score: 0, pass: false,
  };
}
