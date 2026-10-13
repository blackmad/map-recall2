import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Frame} from './nearbar-kit';

/**
 * Plan-curved, stepped glass-and-plate bands for the Booking.com south front. The BAG ring is a straight chord (wall 72) turning north
 * at a sharp corner (wall 14); the real front is a rounded, bowed outline whose floor plates each have their own plan outline.
 * A `Path` is the ring polyline with the corner rounded inside the ring; every band is an inward offset curve of it d_k(s).
 */
export type PathPt = {x: number; z: number; ox: number; oz: number; s: number};
export type Path = {pts: PathPt[]; length: number};
export type Offset = (s: number) => number;

/** Ring chord A->B then B->C, rounded at B by a quadratic Bezier of leg `rc`; samples ~`step` m apart, outward normal per sample. */
export function roundedPath(a: [number, number], b: [number, number], c: [number, number], rc: number, step = 0.75): Path {
  const unit = (p: [number, number], q: [number, number]): [number, number] => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
  const d1 = unit(a, b), d2 = unit(b, c);
  const p1: [number, number] = [b[0] - d1[0] * rc, b[1] - d1[1] * rc], p2: [number, number] = [b[0] + d2[0] * rc, b[1] + d2[1] * rc];
  const raw: [number, number][] = [];
  const n1 = Math.max(1, Math.round(Math.hypot(p1[0] - a[0], p1[1] - a[1]) / step));
  for (let i = 0; i < n1; i++) raw.push([a[0] + (p1[0] - a[0]) * i / n1, a[1] + (p1[1] - a[1]) * i / n1]);
  const nb = 14;
  for (let i = 0; i < nb; i++) { const t = i / nb; raw.push([(1 - t) ** 2 * p1[0] + 2 * t * (1 - t) * b[0] + t * t * p2[0], (1 - t) ** 2 * p1[1] + 2 * t * (1 - t) * b[1] + t * t * p2[1]]); }
  const n2 = Math.max(1, Math.round(Math.hypot(c[0] - p2[0], c[1] - p2[1]) / step));
  for (let i = 0; i <= n2; i++) raw.push([p2[0] + (c[0] - p2[0]) * i / n2, p2[1] + (c[1] - p2[1]) * i / n2]);
  const pts: PathPt[] = [];
  let s = 0;
  raw.forEach((p, i) => {
    if (i) s += Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]);
    const q = raw[Math.min(raw.length - 1, i + 1)], r = raw[Math.max(0, i - 1)];
    const l = Math.hypot(q[0] - r[0], q[1] - r[1]), dx = (q[0] - r[0]) / l, dz = (q[1] - r[1]) / l;
    pts.push({x: p[0], z: p[1], ox: -dz, oz: dx, s}); // outward = (-dz, dx), as in the wall frames (tangent = [n1, -n0])
  });
  return {pts, length: s};
}

const at = (path: Path, s: number): PathPt => {
  const p = path.pts;
  if (s <= 0) return p[0];
  if (s >= path.length) return p[p.length - 1];
  let lo = 0, hi = p.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].s <= s) lo = m; else hi = m; }
  const k = (s - p[lo].s) / (p[hi].s - p[lo].s || 1);
  const ox = p[lo].ox + (p[hi].ox - p[lo].ox) * k, oz = p[lo].oz + (p[hi].oz - p[lo].oz) * k, l = Math.hypot(ox, oz);
  return {x: p[lo].x + (p[hi].x - p[lo].x) * k, z: p[lo].z + (p[hi].z - p[lo].z) * k, ox: ox / l, oz: oz / l, s};
};

/** World XZ of the offset curve d(s) behind the ring at arc position s. */
export const offsetPt = (path: Path, s: number, d: number): [number, number] => { const p = at(path, s); return [p.x - p.ox * d, p.z - p.oz * d]; };
/** Local frame (origin on the offset curve, tangent along it, n outward) for lettering. */
export function frameAt(path: Path, s: number, d: number): Frame {
  const p = at(path, s), o = offsetPt(path, s, d);
  return {origin: o, tangent: [p.oz, -p.ox], n: [p.ox, p.oz]};
}

/** Closed prism over a plan polygon (x,z), y0..y1, flat-shaded, wound outward. */
export function prismXZ(b: BuildingTools, poly: [number, number][], y0: number, y1: number, colour: string) {
  const n = poly.length;
  if (n < 3 || y1 - y0 < 1e-3) return;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area > 0;
  const pos: number[] = [];
  const tri = (a: number[], bb: number[], c: number[], want: [number, number, number]) => {
    const u = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    if (nx * want[0] + ny * want[1] + nz * want[2] >= 0) pos.push(...a, ...bb, ...c); else pos.push(...a, ...c, ...bb);
  };
  const contour = poly.map(p => new T.Vector2(p[0], p[1]));
  const tris = T.ShapeUtils.triangulateShape(contour, []);
  for (const [i, j, k] of tris) {
    tri([poly[i][0], y1, poly[i][1]], [poly[j][0], y1, poly[j][1]], [poly[k][0], y1, poly[k][1]], [0, 1, 0]);
    tri([poly[i][0], y0, poly[i][1]], [poly[j][0], y0, poly[j][1]], [poly[k][0], y0, poly[k][1]], [0, -1, 0]);
  }
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1];
    if (Math.hypot(dx, dz) < 1e-6) continue;
    const out: [number, number, number] = ccw ? [dz, 0, -dx] : [-dz, 0, dx];
    tri([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], out);
    tri([p[0], y0, p[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], out);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  g.computeVertexNormals();
  b.add(g, colour as never);
}

/** Parameters s0..s1 cut so the chords of the offset curve d(s) are equal in length (about `pitch` m): a tight corner gets more of them. */
export function chordS(path: Path, s0: number, s1: number, d: Offset, pitch: number): number[] {
  const m = Math.max(2, Math.ceil((s1 - s0) / 0.1)), acc: number[] = [0], ss: number[] = [s0];
  let prev = offsetPt(path, s0, d(s0));
  for (let i = 1; i <= m; i++) { const s = s0 + (s1 - s0) * i / m, q = offsetPt(path, s, d(s)); acc.push(acc[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1])); ss.push(s); prev = q; }
  const n = Math.max(1, Math.round(acc[m] / pitch)), out: number[] = [s0];
  let k = 0;
  for (let c = 1; c < n; c++) { const target = acc[m] * c / n; while (acc[k + 1] < target) k++; out.push(ss[k] + (ss[k + 1] - ss[k]) * (target - acc[k]) / (acc[k + 1] - acc[k] || 1)); }
  out.push(s1);
  return out;
}

/** Band between two offset curves over [s0, s1]: front d_f(s), back d_b(s); y0..y1. `step` is a spacing in s, or an explicit list of s values. */
export function band(b: BuildingTools, path: Path, s0: number, s1: number, df: Offset, db: Offset, y0: number, y1: number, colour: string, step: number | number[] = 1.5) {
  const nn = Array.isArray(step) ? 0 : Math.max(1, Math.ceil((s1 - s0) / step));
  const list = Array.isArray(step) ? step : Array.from({length: nn + 1}, (_, i) => s0 + (s1 - s0) * i / nn);
  const front: [number, number][] = [], back: [number, number][] = [];
  for (const s of list) { front.push(offsetPt(path, s, df(s))); back.push(offsetPt(path, s, db(s))); }
  prismXZ(b, [...front, ...back.reverse()], y0, y1, colour);
}

/** Thin sheet (glass) `th` thick centred on curve d(s). */
export const sheet = (b: BuildingTools, path: Path, s0: number, s1: number, d: Offset, y0: number, y1: number, colour: string, th = 0.12, step: number | number[] = 1.5) =>
  band(b, path, s0, s1, d, s2 => d(s2) + th, y0, y1, colour, step);

/**
 * Vertical posts on a faceted sheet: one post stands flat on the middle of each chord of the s list (as `band` cuts it). A single chord
 * (`ss` = [s0, s1]) gets `n` posts evenly spaced along it instead (straight walls). `w` along the glass, `dp` proud of the glass face
 * (resting on it: a post straddling the face is ambiguous to the opening audit).
 */
export function posts(b: BuildingTools, path: Path, ss: number[], d: Offset, y0: number, y1: number, w: number, dp: number, colour: string, n = 0) {
  const P = (i: number) => offsetPt(path, ss[i], d(ss[i]));
  for (let i = 0; i + 1 < ss.length; i++) {
    const a = P(i), c = P(i + 1);
    const tx0 = c[0] - a[0], tz0 = c[1] - a[1], l = Math.hypot(tx0, tz0), tx = tx0 / l, tz = tz0 / l, ox = -tz, oz = tx;
    const place = (f: number) => {
      const cx = a[0] + tx0 * f, cz = a[1] + tz0 * f;
      const q = (u: number, v: number): [number, number] => [cx + tx * u + ox * v, cz + tz * u + oz * v];
      prismXZ(b, [q(-w / 2, 0), q(w / 2, 0), q(w / 2, dp), q(-w / 2, dp)], y0, y1, colour);
    };
    if (n > 0) for (let k = 0; k <= n; k++) place(k / n); else place(0.5);
  }
}

/** Straight wall as a Path (frame tangent/normal), sampled every `step` m, so flat curtain walls use the same sheet/post primitives. */
export function straightPath(f: Frame, len: number, step = 3): Path {
  const n = Math.max(1, Math.ceil(len / step)), pts: PathPt[] = [];
  for (let i = 0; i <= n; i++) { const s = len * i / n; pts.push({x: f.origin[0] + f.tangent[0] * s, z: f.origin[1] + f.tangent[1] * s, ox: f.n[0], oz: f.n[1], s}); }
  return {pts, length: len};
}
