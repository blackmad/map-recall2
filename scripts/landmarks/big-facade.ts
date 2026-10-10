import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab, roofHeightAt, type Frame} from './nearbar-kit';
import {topOf, type RawWall} from './big-kit';
import {addShell, planarPolygon, type ShellSource} from './worship-shell';

/**
 * Cheap flat facade primitives for very large buildings (thousands of windows): a window is two coplanar-offset quads
 * (frame, glass) = 4 triangles, so a 100 m tower face stays inside the triangle budget. Frames follow big-kit rawWall:
 * t along the viewer's right, y up, out of the wall.
 */
export function quad(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, colour: string, out: number) {
  put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, colour);
}
/** Lowest wall y at tangent position t (NaN outside the wall); walls cut by a sloping neighbour roof have a slanted base. */
export function bottomOf(w: RawWall, t: number): number {
  let best = Infinity;
  const p = w.poly;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], q = p[(i + 1) % p.length];
    if ((a[0] - t) * (q[0] - t) > 0) continue;
    if (Math.abs(a[0] - q[0]) < 1e-6) { best = Math.min(best, a[1], q[1]); continue; }
    best = Math.min(best, a[1] + (q[1] - a[1]) * (t - a[0]) / (q[0] - a[0]));
  }
  return Number.isFinite(best) ? best : NaN;
}

type Placed = {nx: number; nz: number; d: number; u0: number; u1: number; y0: number; y1: number};
let SURFACES: {type: string; rings: number[][][]}[] = [];
let PLACED: Placed[] = [];
/** Call once at the start of a builder: sets the shell surfaces used to reject buried openings and clears the overlap registry. */
export function beginFacade(src: {surfaces: {type: string; rings: number[][][]}[]}) { SURFACES = src.surfaces; PLACED = []; DEV.clear(); }
function insidePoly(w: RawWall, t: number, y: number): boolean {
  const top = topOf(w, t), bot = bottomOf(w, t);
  return Number.isFinite(top) && Number.isFinite(bot) && y >= bot - 1e-6 && y <= top + 1e-6;
}
/**
 * Whether an opening rectangle (t0..t1, y0..y1 on `wall`, `margin` m of frame included) may be drawn: it must lie wholly inside the wall polygon,
 * must not be buried in a taller volume standing in front of the wall, and must not overlap an opening already placed on the same plane.
 * Registers the rectangle when accepted.
 */
const DEV = new Map<number, number>();
export function claimOpening(wall: RawWall, t0: number, t1: number, y0: number, y1: number, margin = 0.1): boolean {
  if (SURFACES.length) {
    let dev = DEV.get(wall.index);
    if (dev === undefined) { dev = planeDeviation({surfaces: SURFACES}, wall); DEV.set(wall.index, dev); }
    if (dev > 0.06) return false; // not a plane: LoD2.2 faces that are tilted or twisted would leave openings floating or buried
  }
  const a = t0 - margin, c = t1 + margin, lo = y0 - margin, hi = y1 + margin;
  for (const t of [a, (a + c) / 2, c]) for (const y of [lo, (lo + hi) / 2, hi]) if (!insidePoly(wall, t, y)) return false;
  const f = wall.f, mid = (t0 + t1) / 2;
  const px = f.origin[0] + f.tangent[0] * mid, pz = f.origin[1] + f.tangent[1] * mid;
  if (SURFACES.length) {
    for (const k of [0.25, 0.8]) {
      const h = roofHeightAt(SURFACES as never, px + f.n[0] * k, pz + f.n[1] * k);
      if (h !== null && h > y0 + 0.3) return false; // buried: a higher volume stands directly in front
    }
  }
  const d = px * f.n[0] + pz * f.n[1], u = px * f.tangent[0] + pz * f.tangent[1], hw = (t1 - t0) / 2 + margin;
  const rect = {nx: f.n[0], nz: f.n[1], d, u0: u - hw, u1: u + hw, y0: lo, y1: hi};
  for (const o of PLACED) {
    if (o.nx * rect.nx + o.nz * rect.nz < 0.98 || Math.abs(o.d - rect.d) > 0.3) continue;
    if (o.u1 > rect.u0 + 0.02 && o.u0 < rect.u1 - 0.02 && o.y1 > rect.y0 + 0.02 && o.y0 < rect.y1 - 0.02) return false;
  }
  PLACED.push(rect);
  return true;
}
export type Grid = {
  /** First column centre and pitch along t; count of columns. */
  t0: number; pitch: number; n: number;
  /** Window width/height (m), sills listed explicitly. */
  w: number; h: number; sills: number[];
  frame?: string; glass?: string; ring?: number;
};
export function windowGrid(b: BuildingTools, wall: RawWall, g: Grid) {
  const frame = g.frame ?? 'frame', glass = g.glass ?? 'glass', ring = g.ring ?? 0.1;
  for (let c = 0; c < g.n; c++) {
    const t = g.t0 + c * g.pitch, top = topOf(wall, t);
    for (const y of g.sills) {
      const bot = bottomOf(wall, t);
      if (!(y + g.h <= (Number.isFinite(top) ? top : wall.top) - 0.25) || y < (Number.isFinite(bot) ? bot : wall.base) + 0.2) continue;
      if (!claimOpening(wall, t - g.w / 2, t + g.w / 2, y, y + g.h, ring)) continue;
      quad(b, wall.f, t, y - ring, g.w + 2 * ring, g.h + 2 * ring, frame, 0.02);
      quad(b, wall.f, t, y, g.w, g.h, glass, 0.04);
    }
  }
}
/**
 * A continuous ribbon window (one frame, one glass field, thin mullions every `mullion` m) from t0 to t1, sill y, height h.
 * Skipped when the wall is lower than the ribbon anywhere along it.
 */
export function ribbon(b: BuildingTools, wall: RawWall, t0: number, t1: number, y: number, h: number, o: {mullion?: number; frame?: string; glass?: string; ring?: number; louvres?: [number, number][]} = {}) {
  const top = Math.min(topOf(wall, t0 + 0.05), topOf(wall, t1 - 0.05), topOf(wall, (t0 + t1) / 2));
  const bot = Math.max(bottomOf(wall, t0 + 0.05), bottomOf(wall, t1 - 0.05), bottomOf(wall, (t0 + t1) / 2));
  if (!Number.isFinite(top) || !Number.isFinite(bot) || y + h > top - 0.25 || y < bot + 0.2 || t1 - t0 < 0.5) return;
  const ring = o.ring ?? 0.1, c = (t0 + t1) / 2, w = t1 - t0;
  if (!claimOpening(wall, t0, t1, y, y + h, ring)) return;
  // Panes of at most 2.3 m with a 0.25 m mullion gap: an open quad with more than 30 m of perimeter reads as a shell hole in the GLB audit,
  // and one long ribbon's axis-aligned box on a diagonal wall would merge neighbouring ribbons into a single assembly.
  void c;
  const n = Math.max(1, Math.ceil((w + 0.25) / 2.55)), pane = (w - 0.25 * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const pc = t0 + pane / 2 + k * (pane + 0.25);
    quad(b, wall.f, pc, y - ring, pane + ring, h + 2 * ring, o.frame ?? 'frame', 0.02);
    quad(b, wall.f, pc, y, pane, h, o.glass ?? 'glass', 0.04);
    for (const [ly, lh] of o.louvres ?? []) quad(b, wall.f, pc, ly, pane, lh, 'dark', 0.06);
  }
}
/** Sills counted down from the wall top: first sill `drop` under the top, then every `pitch` while >= `min`. */
export function sillsFromTop(top: number, drop: number, pitch: number, min: number): number[] {
  const out: number[] = [];
  for (let y = top - drop; y >= min - 1e-6; y -= pitch) out.push(+y.toFixed(2));
  return out;
}
/** Columns centred on a wall of length `len`, leaving `margin` at each end. */
export function centredColumns(len: number, pitch: number, margin: number) {
  // returns {n, t0, pitch}
  const n = Math.max(0, Math.floor((len - 2 * margin) / pitch) + 1);
  return {n, pitch, t0: (len - (n - 1) * pitch) / 2};
}

/** Largest distance (m) of the wall polygon's vertices from the plane its frame defines; walls that are not planar enough get no windows. */
export function planeDeviation(src: {surfaces: {rings: number[][][]}[]}, wall: RawWall): number {
  let worst = 0;
  for (const p of src.surfaces[wall.index].rings[0]) {
    const d = (p[0] - wall.f.origin[0]) * wall.f.n[0] + (p[2] - wall.f.origin[1]) * wall.f.n[1];
    worst = Math.max(worst, Math.abs(d));
  }
  return worst;
}

/**
 * Shell with large faces tessellated. The GLB geometry audit's proximity grid ignores any triangle whose bounding box spans more than
 * 20,000 one-metre cells (a 60 m diagonal wall of a big building), so openings on such a wall read as "floating" although they sit on it.
 * Splitting a large planar face into a uniform triangle lattice changes no surface, only how it is cut.
 */
const bigFace = (s: {rings: number[][][]}) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of s.rings[0]) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return (Math.floor(hi[0]) - Math.floor(lo[0]) + 1) * (Math.floor(hi[1]) - Math.floor(lo[1]) + 1) * (Math.floor(hi[2]) - Math.floor(lo[2]) + 1);
};
export function tessellate(g: T.BufferGeometry, k: number): T.BufferGeometry {
  const pos = g.getAttribute('position'), idx = g.getIndex()!;
  const out: number[] = [], ind: number[] = [];
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    A.fromBufferAttribute(pos, idx.getX(t)); B.fromBufferAttribute(pos, idx.getX(t + 1)); C.fromBufferAttribute(pos, idx.getX(t + 2));
    const at = new Map<string, number>();
    const vert = (i: number, j: number) => {
      const key = `${i},${j}`; let v = at.get(key);
      if (v === undefined) {
        v = out.length / 3; at.set(key, v);
        out.push(A.x + (B.x - A.x) * i / k + (C.x - A.x) * j / k, A.y + (B.y - A.y) * i / k + (C.y - A.y) * j / k, A.z + (B.z - A.z) * i / k + (C.z - A.z) * j / k);
      }
      return v;
    };
    for (let i = 0; i < k; i++) for (let j = 0; j < k - i; j++) {
      ind.push(vert(i, j), vert(i + 1, j), vert(i, j + 1));
      if (i + j < k - 1) ind.push(vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1));
    }
  }
  const r = new T.BufferGeometry();
  r.setAttribute('position', new T.Float32BufferAttribute(out, 3));
  r.setIndex(ind);
  r.computeVertexNormals();
  return r;
}
export function addShellTess(b: BuildingTools, src: ShellSource, colours: {wall: string; roof: string}, maxCells = 12000) {
  const big = (s: {type: string; rings: number[][][]}) => s.type !== 'GroundSurface' && bigFace(s) > maxCells;
  addShell(b, src, {...colours, skip: s => big(s)});
  src.surfaces.forEach(s => {
    if (!big(s)) return;
    const g0 = planarPolygon(s.rings);
    if (!g0) return;
    const k = Math.max(2, Math.ceil(Math.cbrt(bigFace(s) / maxCells * 8)));
    const g = tessellate(g0, k);
    if (s.type === 'RoofSurface') {
      g.userData.role = 'roof';
      const pos = g.getAttribute('position'), idx = g.getIndex()!;
      const a = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
      for (let q = 0; q < idx.count; q += 3) {
        a.fromBufferAttribute(pos, idx.getX(q)); c.fromBufferAttribute(pos, idx.getX(q + 1)); d.fromBufferAttribute(pos, idx.getX(q + 2));
        if (c.sub(a).cross(d.sub(a)).y < 0) { const t = idx.getX(q + 1); idx.setX(q + 1, idx.getX(q + 2)); idx.setX(q + 2, t); }
      }
      g.computeVertexNormals();
    }
    b.add(g, (s.type === 'RoofSurface' ? colours.roof : colours.wall) as never);
  });
}
