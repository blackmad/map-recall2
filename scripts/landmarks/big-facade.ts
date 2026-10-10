import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab, type Frame} from './nearbar-kit';
import {topOf, type RawWall} from './big-kit';

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
      quad(b, wall.f, t, y - ring, g.w + 2 * ring, g.h + 2 * ring, frame, 0.02);
      quad(b, wall.f, t, y, g.w, g.h, glass, 0.04);
    }
  }
}
/**
 * A continuous ribbon window (one frame, one glass field, thin mullions every `mullion` m) from t0 to t1, sill y, height h.
 * Skipped when the wall is lower than the ribbon anywhere along it.
 */
export function ribbon(b: BuildingTools, wall: RawWall, t0: number, t1: number, y: number, h: number, o: {mullion?: number; frame?: string; glass?: string; ring?: number} = {}) {
  const top = Math.min(topOf(wall, t0 + 0.05), topOf(wall, t1 - 0.05), topOf(wall, (t0 + t1) / 2));
  const bot = Math.max(bottomOf(wall, t0 + 0.05), bottomOf(wall, t1 - 0.05), bottomOf(wall, (t0 + t1) / 2));
  if (!Number.isFinite(top) || !Number.isFinite(bot) || y + h > top - 0.25 || y < bot + 0.2 || t1 - t0 < 0.5) return;
  const ring = o.ring ?? 0.1, c = (t0 + t1) / 2, w = t1 - t0;
  // Closed thin boxes (not open quads): long ribbons would otherwise read as open shell holes in the GLB audit.
  slab(b, wall.f, c, y - ring, w + 2 * ring, h + 2 * ring, 0.025, o.frame ?? 'frame');
  slab(b, wall.f, c, y, w, h, 0.045, o.glass ?? 'glass');
  const m = o.mullion ?? 0;
  if (m > 0) {
    const n = Math.max(1, Math.round(w / m));
    for (let k = 1; k < n; k++) quad(b, wall.f, t0 + (w * k) / n, y, 0.07, h, o.frame ?? 'frame', 0.045);
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
