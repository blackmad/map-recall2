// Pure geometry for the BGT plaza build (build-bgt-plazas.ts): a local metric frame, the reach buffer, fence strips,
// and segment-to-polygon distance. polygon-clipping does the boolean work. Tested in check-bgt-plazas.ts.
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';

/** Local equirectangular metres around Amsterdam; sub-percent scale error over the city, well inside a 3 m reach. */
export const FRAME_LAT0 = 52.37;
export const FRAME_LON0 = 4.9;
const KY = 111_320;
const KX = 111_320 * Math.cos(FRAME_LAT0 * Math.PI / 180);

export const toMetres = (lon: number, lat: number): [number, number] => [(lon - FRAME_LON0) * KX, (lat - FRAME_LAT0) * KY];
export const toLonLat = (x: number, y: number): [number, number] => [x / KX + FRAME_LON0, y / KY + FRAME_LAT0];

export interface Box { minX: number; minY: number; maxX: number; maxY: number }

export function boxOf(rings: readonly Ring[]): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export const boxesTouch = (a: Box, b: Box, slack = 0): boolean =>
  a.minX - slack <= b.maxX && b.minX - slack <= a.maxX && a.minY - slack <= b.maxY && b.minY - slack <= a.maxY;

export function ringArea(ring: Ring): number {
  let twice = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) twice += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(twice) / 2;
}

export const polygonArea = (polygon: Polygon): number => polygon.reduce((total, ring, i) => total + (i === 0 ? 1 : -1) * ringArea(ring), 0);
export const multiArea = (multi: MultiPolygon): number => multi.reduce((t, p) => t + polygonArea(p), 0);

/**
 * The polygon grown by about `distance` metres: its union with copies shifted along 16 compass directions. That is the
 * Minkowski sum with the 16 points of a circle, which leaves at most `distance · (1 − cos 11.25°)` ≈ 2 % uncovered at
 * convex corners and nothing along straight edges wider than the shift; enough for a reach whose job is to overlap
 * the corridor beside a plaza.
 */
export function grow(multi: MultiPolygon, distance: number): MultiPolygon {
  if (!multi.length) return [];
  const shifted: MultiPolygon[] = [];
  for (let k = 0; k < 16; k++) {
    const dx = Math.cos(k * Math.PI / 8) * distance, dy = Math.sin(k * Math.PI / 8) * distance;
    shifted.push(multi.map(p => p.map(r => r.map(([x, y]) => [x + dx, y + dy] as [number, number]))));
  }
  return polygonClipping.union(multi, ...shifted);
}

/** A line as quads `width` wide, each segment lengthened by half the width at both ends so joints close. */
export function strips(line: ReadonlyArray<[number, number]>, width: number): Polygon[] {
  const half = width / 2;
  const out: Polygon[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy * half, ny = ux * half;
    const sx = ax - ux * half, sy = ay - uy * half, ex = bx + ux * half, ey = by + uy * half;
    out.push([[[sx + nx, sy + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [sx - nx, sy - ny], [sx + nx, sy + ny]]]);
  }
  return out;
}

function insideRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export const insidePolygon = (polygon: Polygon, x: number, y: number): boolean =>
  insideRing(polygon[0], x, y) && !polygon.slice(1).some(h => insideRing(h, x, y));

function segSegDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = cross(cx, cy, dx, dy, ax, ay), d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy), d4 = cross(ax, ay, bx, by, dx, dy);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
  const pt = (px: number, py: number, sx: number, sy: number, ex: number, ey: number) => {
    const vx = ex - sx, vy = ey - sy, l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - sx) * vx + (py - sy) * vy) / l2)) : 0;
    return Math.hypot(px - (sx + t * vx), py - (sy + t * vy));
  };
  return Math.min(pt(ax, ay, cx, cy, dx, dy), pt(bx, by, cx, cy, dx, dy), pt(cx, cy, ax, ay, bx, by), pt(dx, dy, ax, ay, bx, by));
}

/** Distance from segment a–b to the polygon (0 when the segment touches or enters it). */
export function segmentPolygonDistance(a: readonly [number, number], b: readonly [number, number], polygon: Polygon): number {
  if (insidePolygon(polygon, a[0], a[1]) || insidePolygon(polygon, b[0], b[1])) return 0;
  let best = Infinity;
  for (const ring of polygon) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const d = segSegDistance(a[0], a[1], b[0], b[1], ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
      if (d < best) best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

/** Douglas–Peucker on a closed ring; keeps at least four points. */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 5) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1; keep[ring.length - 1] = 1;
  // Split at the vertex farthest from the first so the closed ring has two open halves.
  let far = 0, farD = -1;
  for (let i = 1; i < ring.length - 1; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > farD) { farD = d; far = i; } }
  keep[far] = 1;
  const stack: Array<[number, number]> = [[0, far], [far, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [sx, sy] = ring[s], [ex, ey] = ring[e];
    const vx = ex - sx, vy = ey - sy, len = Math.hypot(vx, vy) || 1;
    let idx = -1, dmax = tolerance;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((ring[i][0] - sx) * vy - (ring[i][1] - sy) * vx) / len;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (idx >= 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

// ---- raster pipeline --------------------------------------------------------------------------------------------
// polygon-clipping's sweep line fails on a few percent of BGT clusters (near-coincident vertices; 24 of the first
// 500), and a failed fence cut must drop the plaza. The build therefore works on a per-cluster raster: fill, grow,
// cut and label on cells, then trace the cells back to rings. Exact to half a cell, which the runtime's 1.5 m inset
// swamps.

export class Raster {
  readonly width: number;
  readonly height: number;
  constructor(readonly minX: number, readonly minY: number, maxX: number, maxY: number, readonly cell: number) {
    this.width = Math.max(1, Math.ceil((maxX - minX) / cell));
    this.height = Math.max(1, Math.ceil((maxY - minY) / cell));
  }
  /** Centre of cell (i, j) in metres. */
  cx(i: number): number { return this.minX + (i + 0.5) * this.cell; }
  cy(j: number): number { return this.minY + (j + 0.5) * this.cell; }
  get size(): number { return this.width * this.height; }
}

/** Even-odd scanline fill of a polygon (outer + holes) at cell centres: calls `set(index)` for every cell inside. */
export function fillPolygon(r: Raster, polygon: Polygon, set: (index: number) => void): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of polygon[0]) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const j0 = Math.max(0, Math.floor((minY - r.minY) / r.cell - 0.5)), j1 = Math.min(r.height - 1, Math.ceil((maxY - r.minY) / r.cell - 0.5));
  const xs: number[] = [];
  for (let j = j0; j <= j1; j++) {
    const y = r.cy(j);
    xs.length = 0;
    for (const ring of polygon) {
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const [ax, ay] = ring[a], [bx, by] = ring[b];
        if ((ay > y) !== (by > y)) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - r.minX) / r.cell - 0.5)), i1 = Math.min(r.width - 1, Math.floor((xs[k + 1] - r.minX) / r.cell - 0.5));
      for (let i = i0; i <= i1; i++) set(j * r.width + i);
    }
  }
}

/** Every cell whose centre lies within `radius` of segment a–b. */
export function markSegment(r: Raster, a: readonly [number, number], b: readonly [number, number], radius: number, set: (index: number) => void): void {
  const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - radius - r.minX) / r.cell)), i1 = Math.min(r.width - 1, Math.ceil((Math.max(a[0], b[0]) + radius - r.minX) / r.cell));
  const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - radius - r.minY) / r.cell)), j1 = Math.min(r.height - 1, Math.ceil((Math.max(a[1], b[1]) + radius - r.minY) / r.cell));
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy, r2 = radius * radius;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = r.cx(i), py = r.cy(j);
    const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / l2)) : 0;
    const dx = px - (a[0] + t * vx), dy = py - (a[1] + t * vy);
    if (dx * dx + dy * dy <= r2) set(j * r.width + i);
  }
}

/** Chamfer (1, √2) distance in metres from the cells where `seed` is set; Infinity where none reaches. */
export function distanceFrom(r: Raster, seed: Uint8Array): Float32Array {
  const { width: w, height: h } = r;
  const d = new Float32Array(r.size).fill(Infinity);
  for (let k = 0; k < d.length; k++) if (seed[k]) d[k] = 0;
  const s = r.cell, sd = r.cell * Math.SQRT2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    let v = d[k];
    if (i > 0 && d[k - 1] + s < v) v = d[k - 1] + s;
    if (j > 0) {
      if (d[k - w] + s < v) v = d[k - w] + s;
      if (i > 0 && d[k - w - 1] + sd < v) v = d[k - w - 1] + sd;
      if (i + 1 < w && d[k - w + 1] + sd < v) v = d[k - w + 1] + sd;
    }
    d[k] = v;
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i;
    let v = d[k];
    if (i + 1 < w && d[k + 1] + s < v) v = d[k + 1] + s;
    if (j + 1 < h) {
      if (d[k + w] + s < v) v = d[k + w] + s;
      if (i + 1 < w && d[k + w + 1] + sd < v) v = d[k + w + 1] + sd;
      if (i > 0 && d[k + w - 1] + sd < v) v = d[k + w - 1] + sd;
    }
    d[k] = v;
  }
  return d;
}

/** 4-connected components of the set cells: labels (0 = unset) and the count. */
export function components(r: Raster, mask: Uint8Array): { labels: Int32Array; count: number } {
  const labels = new Int32Array(r.size);
  let count = 0;
  const stack: number[] = [];
  for (let k = 0; k < mask.length; k++) {
    if (!mask[k] || labels[k]) continue;
    labels[k] = ++count;
    stack.push(k);
    while (stack.length) {
      const c = stack.pop()!;
      const i = c % r.width, j = (c - i) / r.width;
      const visit = (n: number) => { if (mask[n] && !labels[n]) { labels[n] = count; stack.push(n); } };
      if (i > 0) visit(c - 1);
      if (i + 1 < r.width) visit(c + 1);
      if (j > 0) visit(c - r.width);
      if (j + 1 < r.height) visit(c + r.width);
    }
  }
  return { labels, count };
}

/**
 * The outline of the cells labelled `label`, as rings in metres: cell-edge loops with the interior on the left, so
 * outer rings run counter-clockwise and holes clockwise. At a pinch (two cells touching only at a corner) the walk
 * turns right, which keeps 4-connected pieces apart. Returns polygons (outer first, then its holes).
 */
export function traceLabel(r: Raster, labels: Int32Array, label: number): Polygon[] {
  const w = r.width, h = r.height;
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && labels[j * w + i] === label;
  // Directed boundary edges keyed by their start vertex (vi, vj); vertex (vi, vj) is the corner at minX + vi·cell.
  const next = new Map<number, number[]>();
  const vkey = (vi: number, vj: number) => vj * (w + 1) + vi;
  const add = (a: number, b: number) => { const l = next.get(a); if (l) l.push(b); else next.set(a, [b]); };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!inside(i, j)) continue;
    if (!inside(i, j - 1)) add(vkey(i, j), vkey(i + 1, j));          // bottom edge, left to right
    if (!inside(i + 1, j)) add(vkey(i + 1, j), vkey(i + 1, j + 1));  // right edge, upwards
    if (!inside(i, j + 1)) add(vkey(i + 1, j + 1), vkey(i, j + 1));  // top edge, right to left
    if (!inside(i - 1, j)) add(vkey(i, j + 1), vkey(i, j));          // left edge, downwards
  }
  const xy = (k: number): [number, number] => { const vi = k % (w + 1), vj = (k - vi) / (w + 1); return [r.minX + vi * r.cell, r.minY + vj * r.cell]; };
  const rings: Ring[] = [];
  for (const [start, outs] of next) {
    while (outs.length) {
      const ring: Array<[number, number]> = [xy(start)];
      let prev = start, cur = outs.pop()!;
      while (cur !== start || ring.length < 2) {
        ring.push(xy(cur));
        const options = next.get(cur);
        if (!options || !options.length) break;
        let pick = 0;
        if (options.length > 1) {
          // Turn right first: the candidate with the smallest left-turn angle from the incoming direction.
          const [px, py] = xy(prev), [cx0, cy0] = xy(cur);
          const din = Math.atan2(cy0 - py, cx0 - px);
          let best = Infinity;
          options.forEach((o, n) => {
            const [ox, oy] = xy(o);
            let turn = Math.atan2(oy - cy0, ox - cx0) - din;
            while (turn <= -Math.PI) turn += 2 * Math.PI;
            while (turn > Math.PI) turn -= 2 * Math.PI;
            if (turn < best) { best = turn; pick = n; }
          });
        }
        prev = cur;
        cur = options.splice(pick, 1)[0];
        if (cur === start) break;
      }
      ring.push(xy(start));
      // Drop collinear vertices of the staircase.
      const clean: Array<[number, number]> = [ring[0]];
      for (let n = 1; n + 1 < ring.length; n++) {
        const [ax, ay] = clean[clean.length - 1], [bx, by] = ring[n], [cx1, cy1] = ring[n + 1];
        if (Math.abs((bx - ax) * (cy1 - ay) - (by - ay) * (cx1 - ax)) > 1e-9) clean.push(ring[n]);
      }
      clean.push(clean[0]);
      if (clean.length >= 4) rings.push(clean);
    }
  }
  const signed = (ring: Ring) => { let t = 0; for (let n = 0; n + 1 < ring.length; n++) t += ring[n][0] * ring[n + 1][1] - ring[n + 1][0] * ring[n][1]; return t / 2; };
  const outers = rings.filter(ring => signed(ring) > 0).map(ring => [ring] as Polygon);
  for (const hole of rings.filter(ring => signed(ring) < 0)) {
    // A hole belongs to the smallest outer that contains its first vertex's neighbourhood (test a point just inside).
    const [hx, hy] = hole[0];
    const probe: [number, number] = [hx + r.cell * 0.01, hy + r.cell * 0.01];
    const owners = outers.filter(p => {
      let inside2 = false;
      const ring = p[0];
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        if ((ring[a][1] > probe[1]) !== (ring[b][1] > probe[1]) && probe[0] < (ring[b][0] - ring[a][0]) * (probe[1] - ring[a][1]) / (ring[b][1] - ring[a][1]) + ring[a][0]) inside2 = !inside2;
      }
      return inside2;
    });
    owners.sort((p, q) => ringArea(p[0]) - ringArea(q[0]));
    if (owners.length) owners[0].push(hole);
  }
  return outers;
}
