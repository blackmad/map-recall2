// Draped geometry on a height function: ribbons along polylines, junction
// discs, subdivided polygons, a relief grid, kerbs and walls (pure, no three).
//
// Every vertex takes z = height(x, y) + lift, so street bands, the route
// ribbon and the question-street highlight follow ramps and bridge humps
// exactly as the land does. UVs are world metres (tiled textures stay put).

import type { HeightFn, Vec2 } from './surface.js';

export interface MeshArrays { positions: number[]; uvs: number[]; indices: number[]; colors?: number[] }
export const emptyMesh = (colors = false): MeshArrays => ({ positions: [], uvs: [], indices: [], ...(colors ? { colors: [] } : {}) });

export function vertex(m: MeshArrays, x: number, y: number, z: number, colour?: [number, number, number]): number {
  m.positions.push(x, y, z);
  m.uvs.push(x, y);
  if (m.colors) m.colors.push(...(colour ?? [1, 1, 1]));
  return m.positions.length / 3 - 1;
}

export const triangleCount = (m: MeshArrays) => m.indices.length / 3;

/** Polyline length and cumulative stations. */
export function stations(pts: readonly Vec2[]): number[] {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return s;
}

/** Point at station `t` along a polyline (clamped). */
export function pointAt(pts: readonly Vec2[], st: readonly number[], t: number): Vec2 {
  if (t <= 0) return pts[0];
  if (t >= st[st.length - 1]) return pts[pts.length - 1];
  let i = 1;
  while (st[i] < t) i++;
  const u = (t - st[i - 1]) / ((st[i] - st[i - 1]) || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
}

/** The parts of a polyline outside the given station intervals (sorted, merged here). */
export function cutIntervals(pts: readonly Vec2[], cuts: [number, number][]): Vec2[][] {
  const st = stations(pts), total = st[st.length - 1];
  const merged: [number, number][] = [];
  for (const c of [...cuts].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1]); else merged.push([c[0], c[1]]);
  }
  const keep: [number, number][] = [];
  let at = 0;
  for (const [a, b] of merged) { if (a > at) keep.push([at, Math.min(a, total)]); at = Math.max(at, b); }
  if (at < total) keep.push([at, total]);
  return keep.filter(([a, b]) => b - a > 0.05).map(([a, b]) => {
    const out: Vec2[] = [pointAt(pts, st, a)];
    for (let i = 0; i < pts.length; i++) if (st[i] > a && st[i] < b) out.push(pts[i]);
    out.push(pointAt(pts, st, b));
    return out;
  });
}

/** Resample a polyline so no segment exceeds `step` (keeps original vertices). */
export function densify(pts: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Left normals per vertex with mitred joins (limited, so a hairpin does not
 * shoot a spike). Returns [nx, ny, miterScale] per vertex.
 */
export function vertexNormals(pts: readonly Vec2[], miterLimit = 2.5): [number, number, number][] {
  const n = pts.length, out: [number, number, number][] = [];
  const segN = (i: number): Vec2 => {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? segN(i - 1) : null, b = i < n - 1 ? segN(i) : null;
    if (!a || !b) { const s = (a ?? b)!; out.push([s[0], s[1], 1]); continue; }
    let mx = a[0] + b[0], my = a[1] + b[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) { out.push([b[0], b[1], 1]); continue; }
    mx /= ml; my /= ml;
    const cos = mx * b[0] + my * b[1];
    out.push([mx, my, Math.min(miterLimit, 1 / Math.max(cos, 1e-3))]);
  }
  return out;
}

export interface RibbonOptions {
  /** Max segment length along the ribbon before draping, metres. */
  step?: number;
  /** Extra vertices across (for wide bands on cambered/sloped ground). */
  across?: number;
  colour?: [number, number, number];
}

/**
 * A band `width` wide whose centre is offset `offset` metres to the left of the
 * polyline, draped at height + lift. CCW from above.
 */
export function ribbon(m: MeshArrays, pts: readonly Vec2[], offset: number, width: number, height: HeightFn, lift: number, opts: RibbonOptions = {}): void {
  if (pts.length < 2 || width <= 0) return;
  const dense = densify(pts, opts.step ?? 3);
  const normals = vertexNormals(dense);
  const across = Math.max(1, opts.across ?? (width > 7 ? 2 : 1));
  let prev: number[] | null = null;
  for (let i = 0; i < dense.length; i++) {
    const [nx, ny, k] = normals[i], row: number[] = [];
    for (let c = 0; c <= across; c++) {
      const o = (offset + width / 2 - (width * c) / across) * k; // left edge first
      const x = dense[i][0] + nx * o, y = dense[i][1] + ny * o;
      row.push(vertex(m, x, y, height(x, y) + lift, opts.colour));
    }
    if (prev) for (let c = 0; c < across; c++) {
      // prev = start, row = end; left→right across. CCW seen from above.
      const a = prev[c], b = prev[c + 1], cc = row[c + 1], d = row[c];
      m.indices.push(b, cc, d, b, d, a);
    }
    prev = row;
  }
}

/**
 * A vertical face along the offset edge of a band (kerb faces, deck fascias):
 * from height + top down to height + bottom, facing `facing` (+1 left, −1 right of travel).
 */
export function edgeWall(m: MeshArrays, pts: readonly Vec2[], offset: number, height: HeightFn, top: number, bottom: number, facing: 1 | -1, opts: RibbonOptions = {}): void {
  if (pts.length < 2) return;
  const dense = densify(pts, opts.step ?? 3);
  const normals = vertexNormals(dense);
  let prev: [number, number] | null = null;
  for (let i = 0; i < dense.length; i++) {
    const [nx, ny, k] = normals[i];
    const x = dense[i][0] + nx * offset * k, y = dense[i][1] + ny * offset * k, h = height(x, y);
    const t = vertex(m, x, y, h + top, opts.colour), b = vertex(m, x, y, h + bottom, opts.colour);
    if (prev) {
      if (facing === 1) m.indices.push(prev[0], b, prev[1], prev[0], t, b);
      else m.indices.push(prev[0], prev[1], b, prev[0], b, t);
    }
    prev = [t, b];
  }
}

/** A vertical end cap across a band at a polyline end (raised sidewalks cut at a junction). */
export function endCap(m: MeshArrays, p: Vec2, dir: Vec2, offset: number, width: number, height: HeightFn, top: number, bottom: number, facingForward: boolean, colour?: [number, number, number]): void {
  const nx = -dir[1], ny = dir[0];
  const l = offset + width / 2, r = offset - width / 2;
  const L: Vec2 = [p[0] + nx * l, p[1] + ny * l], R: Vec2 = [p[0] + nx * r, p[1] + ny * r];
  const hl = height(L[0], L[1]), hr = height(R[0], R[1]);
  const lt = vertex(m, L[0], L[1], hl + top, colour), lb = vertex(m, L[0], L[1], hl + bottom, colour);
  const rt = vertex(m, R[0], R[1], hr + top, colour), rb = vertex(m, R[0], R[1], hr + bottom, colour);
  if (facingForward) m.indices.push(lt, rb, lb, lt, rt, rb); else m.indices.push(lt, lb, rb, lt, rb, rt);
}

/** A draped disc (junction fill), `sides` around. */
export function disc(m: MeshArrays, c: Vec2, r: number, height: HeightFn, lift: number, sides = 12, colour?: [number, number, number]): void {
  const centre = vertex(m, c[0], c[1], height(c[0], c[1]) + lift, colour);
  const first = m.positions.length / 3;
  for (let s = 0; s < sides; s++) {
    const t = (s / sides) * Math.PI * 2, x = c[0] + Math.cos(t) * r, y = c[1] + Math.sin(t) * r;
    vertex(m, x, y, height(x, y) + lift, colour);
  }
  for (let s = 0; s < sides; s++) m.indices.push(centre, first + s, first + ((s + 1) % sides));
}

/**
 * Triangles (flat 2D coords + index triples, e.g. from earcut) subdivided so no
 * edge exceeds `maxEdge`, then draped. Each triangle is split uniformly into n²;
 * neighbours with a different n meet at T-junctions a few millimetres apart,
 * which the relief beneath hides.
 */
export function drapeTriangles(m: MeshArrays, coords: ArrayLike<number>, tris: ArrayLike<number>, height: HeightFn, lift: number, maxEdge = 4, colour?: [number, number, number]): void {
  for (let t = 0; t < tris.length; t += 3) {
    const ax = coords[tris[t] * 2], ay = coords[tris[t] * 2 + 1], bx = coords[tris[t + 1] * 2], by = coords[tris[t + 1] * 2 + 1], cx = coords[tris[t + 2] * 2], cy = coords[tris[t + 2] * 2 + 1];
    const longest = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy));
    const n = Math.max(1, Math.min(64, Math.ceil(longest / maxEdge)));
    // Make it CCW from above.
    const ccw = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0;
    const idx: number[][] = [];
    for (let i = 0; i <= n; i++) {
      idx.push([]);
      for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        const x = ax * w + bx * u + cx * v, y = ay * w + by * u + cy * v;
        idx[i].push(vertex(m, x, y, height(x, y) + lift, colour));
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      const a = idx[i][j], b = idx[i + 1][j], c = idx[i][j + 1];
      if (ccw) m.indices.push(a, b, c); else m.indices.push(a, c, b);
      if (j < n - i - 1) {
        const d = idx[i + 1][j + 1];
        if (ccw) m.indices.push(b, d, c); else m.indices.push(b, c, d);
      }
    }
  }
}

/**
 * The relief as a regular grid over [x0,x1]×[y0,y1]; quads for which `keep`
 * says false (e.g. deep inside a canal) are skipped.
 */
export function reliefGrid(x0: number, y0: number, x1: number, y1: number, step: number, height: HeightFn, keep: (x: number, y: number) => boolean = () => true): MeshArrays {
  const m = emptyMesh();
  const nx = Math.ceil((x1 - x0) / step), ny = Math.ceil((y1 - y0) / step);
  const index = new Int32Array((nx + 1) * (ny + 1)).fill(-1);
  const at = (i: number, j: number) => {
    const k = j * (nx + 1) + i;
    if (index[k] < 0) { const x = x0 + i * step, y = y0 + j * step; index[k] = vertex(m, x, y, height(x, y)); }
    return index[k];
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!keep(x0 + (i + 0.5) * step, y0 + (j + 0.5) * step)) continue;
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    m.indices.push(a, b, c, a, c, d);
  }
  return m;
}

/** Concatenate meshes. */
export function merge(meshes: readonly MeshArrays[]): MeshArrays {
  const out = emptyMesh(meshes.some(m => m.colors));
  for (const m of meshes) {
    // Element-wise: spreading a few hundred thousand numbers into push() overflows the stack.
    const base = out.positions.length / 3;
    for (const v of m.positions) out.positions.push(v);
    for (const v of m.uvs) out.uvs.push(v);
    if (out.colors) { if (m.colors) for (const v of m.colors) out.colors.push(v); else for (let k = 0; k < m.positions.length; k++) out.colors.push(1); }
    for (const i of m.indices) out.indices.push(i + base);
  }
  return out;
}
