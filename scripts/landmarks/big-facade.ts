import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, type Frame} from './nearbar-kit';
import {topOf, type RawWall} from './big-kit';

/**
 * Cheap flat facade primitives for very large buildings (thousands of windows): a window is two coplanar-offset quads
 * (frame, glass) = 4 triangles, so a 100 m tower face stays inside the triangle budget. Frames follow big-kit rawWall:
 * t along the viewer's right, y up, out of the wall.
 */
export function quad(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, colour: string, out: number) {
  put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, colour);
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
      if (!(y + g.h <= (Number.isFinite(top) ? top : wall.top) - 0.25) || y < wall.base + 0.2) continue;
      quad(b, wall.f, t, y - ring, g.w + 2 * ring, g.h + 2 * ring, frame, 0.03);
      quad(b, wall.f, t, y, g.w, g.h, glass, 0.06);
    }
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
