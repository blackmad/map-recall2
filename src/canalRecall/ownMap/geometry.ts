// Small pure geometry helpers for the own map.
import type { Vec2 } from './frame';

/** Douglas–Peucker, iterative. Keeps the endpoints. */
export function simplify(points: readonly Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2 || tolerance <= 0) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let worst = -1, worstD = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

export function ringArea(ring: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return s / 2;
}

export function pointInRing(x: number, y: number, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point in polygon with holes (ring 0 outer). */
export function pointInPolygon(x: number, y: number, polygon: readonly (readonly Vec2[])[]): boolean {
  if (!polygon.length || !pointInRing(x, y, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (pointInRing(x, y, polygon[i])) return false;
  return true;
}

export function lineLength(points: readonly Vec2[]): number {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return s;
}

export type Box = [number, number, number, number];
export function boxOf(points: Iterable<Vec2>): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

/**
 * A point-in-water test over many polygons via a uniform grid of polygon
 * indices. Replaces `vector-map.js isWater` (queryRenderedFeatures on the
 * basemap's fill layers) with the extract's own polygons: deterministic, works
 * offscreen, and does not depend on what is drawn this frame.
 */
export class PolygonGrid {
  private cells = new Map<string, number[]>();
  private boxes: Box[];
  constructor(private polygons: readonly (readonly (readonly Vec2[])[])[], private cell = 250) {
    this.boxes = polygons.map(p => boxOf(p[0] ?? []));
    this.boxes.forEach((b, i) => {
      for (let cx = Math.floor(b[0] / cell); cx <= Math.floor(b[2] / cell); cx++)
        for (let cy = Math.floor(b[1] / cell); cy <= Math.floor(b[3] / cell); cy++) {
          const k = `${cx},${cy}`; const list = this.cells.get(k); if (list) list.push(i); else this.cells.set(k, [i]);
        }
    });
  }
  contains(x: number, y: number): boolean {
    const list = this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`);
    if (!list) return false;
    for (const i of list) {
      const b = this.boxes[i];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (pointInPolygon(x, y, this.polygons[i])) return true;
    }
    return false;
  }
}
