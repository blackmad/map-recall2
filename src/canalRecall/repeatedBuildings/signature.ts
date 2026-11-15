/**
 * Footprint signatures for finding building designs that repeat exactly across the city (lane repeated-buildings,
 * 2026-11-15). A design built many times (a standard school, a portiekflat block, a transformer house, a row of
 * identical villas) leaves the same BAG footprint shape, the same 3DBAG height and roof form and a near build year on
 * every copy. This module turns one footprint (metric ring, e.g. RD New) into a pose-free signature and measures the
 * distance between two signatures:
 *
 *   - the footprint is moved to its area centroid and turned so the long axis of its minimum rotated rectangle is +x;
 *   - the shape distance is the symmetric Hausdorff distance between the two boundaries, minimised over the four
 *     poses the long-axis frame leaves open (identity, 180°, mirror across x, mirror across y; a square-ish footprint
 *     also tries the 90° turns), so mirrored copies of one design match and record `mirrored`;
 *   - `complexity` says how much a match is worth: a plain rectangle matches thousands of unrelated houses, an
 *     L, T or stepped footprint with notches does not.
 *
 * Pure functions, metres in, metres out. No I/O.
 */

export type P = [number, number];

export interface Signature {
  /** Area (m²), perimeter (m), and the minimum rotated rectangle's long and short sides (m). */
  area: number;
  perimeter: number;
  L: number;
  W: number;
  /** Ring vertices after collinear simplification (closing vertex not repeated). */
  vertices: number;
  /** area / (L × W): 1 for a rectangle. */
  rectangularity: number;
  /** Boundary points (every ~0.25 m) in the canonical frame: centroid at the origin, long axis on +x. */
  boundary: P[];
  /** Canonical-frame vertices (for drawing, and for the convex/reflex count). */
  canon: P[];
  /** Reflex (inward) corners: notches, L and T arms. */
  reflex: number;
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const cross = (a: P, b: P) => a[0] * b[1] - a[1] * b[0];

/** Open ring (drops a repeated closing vertex and consecutive duplicates). */
export function openRing(ring: readonly P[]): P[] {
  const out: P[] = [];
  for (const p of ring) if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 1e-6) out.push([p[0], p[1]]);
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-6) out.pop();
  return out;
}

export function signedArea(ring: readonly P[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) s += cross(ring[i], ring[(i + 1) % ring.length]);
  return s / 2;
}

/** Drops vertices whose distance to the chord of their neighbours is under `tol` metres (BAG digitising noise). */
export function simplifyCollinear(ring: readonly P[], tol = 0.15): P[] {
  let pts = openRing(ring);
  for (let changed = true; changed && pts.length > 3;) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const ac = sub(c, a), len = Math.hypot(ac[0], ac[1]);
      const d = len < 1e-9 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs(cross(ac, sub(b, a))) / len;
      if (d < tol) { pts.splice(i, 1); changed = true; i--; }
    }
  }
  return pts;
}

function convexHull(points: readonly P[]): P[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const half = (list: P[]) => {
    const h: P[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(sub(h[h.length - 1], h[h.length - 2]), sub(p, h[h.length - 2])) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Long-axis angle (radians) and side lengths of the minimum rotated rectangle. */
export function mrr(ring: readonly P[]): {angle: number; L: number; W: number} {
  const hull = convexHull(ring);
  let best = {area: Infinity, angle: 0, L: 0, W: 0};
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of hull) { const x = q[0] * c + q[1] * s, y = -q[0] * s + q[1] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const area = (x1 - x0) * (y1 - y0);
    if (area < best.area - 1e-9) best = x1 - x0 >= y1 - y0 ? {area, angle: ang, L: x1 - x0, W: y1 - y0} : {area, angle: ang + Math.PI / 2, L: y1 - y0, W: x1 - x0};
  }
  return {angle: best.angle, L: best.L, W: best.W};
}

function centroid(ring: readonly P[]): P {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], k = cross(p, q);
    a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k;
  }
  return Math.abs(a) < 1e-9 ? ring[0] : [cx / (3 * a), cy / (3 * a)];
}

/** Points along the closed ring every `step` metres (vertices included). */
export function densify(ring: readonly P[], step = 0.25): P[] {
  const out: P[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

export function signature(ringMetres: readonly P[]): Signature | null {
  let ring = simplifyCollinear(ringMetres);
  if (ring.length < 3) return null;
  if (signedArea(ring) < 0) ring = ring.reverse();
  const area = signedArea(ring);
  if (!(area > 0.5)) return null;
  const c = centroid(ring), {angle, L, W} = mrr(ring), cs = Math.cos(-angle), sn = Math.sin(-angle);
  const canon = ring.map(p => { const x = p[0] - c[0], y = p[1] - c[1]; return [x * cs - y * sn, x * sn + y * cs] as P; });
  let perimeter = 0, reflex = 0;
  for (let i = 0; i < canon.length; i++) {
    const a = canon[(i - 1 + canon.length) % canon.length], b = canon[i], d = canon[(i + 1) % canon.length];
    perimeter += Math.hypot(d[0] - b[0], d[1] - b[1]);
    if (cross(sub(b, a), sub(d, b)) < -1e-6) reflex++;
  }
  return {area, perimeter, L, W, vertices: canon.length, rectangularity: area / Math.max(1e-9, L * W), boundary: densify(canon, Math.max(0.25, perimeter / 320)), canon, reflex};
}

/** Directed Hausdorff: the farthest any point of `a` lies from the nearest point of `b`. */
function directed(a: readonly P[], b: readonly P[], stopAbove = Infinity): number {
  let worst = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < best) { best = d; if (best <= worst * worst) break; } }
    const r = Math.sqrt(best);
    if (r > worst) { worst = r; if (worst > stopAbove) return worst; }
  }
  return worst;
}

const POSES: {name: string; f: (p: P) => P; mirrored: boolean}[] = [
  {name: 'id', f: p => p, mirrored: false},
  {name: 'rot180', f: p => [-p[0], -p[1]], mirrored: false},
  {name: 'mirrorX', f: p => [p[0], -p[1]], mirrored: true},
  {name: 'mirrorY', f: p => [-p[0], p[1]], mirrored: true},
];
const SQUARE_POSES: typeof POSES = [
  {name: 'rot90', f: p => [-p[1], p[0]], mirrored: false},
  {name: 'rot270', f: p => [p[1], -p[0]], mirrored: false},
  {name: 'diag', f: p => [p[1], p[0]], mirrored: true},
  {name: 'antidiag', f: p => [-p[1], -p[0]], mirrored: true},
];

/**
 * Shape distance (m): the symmetric Hausdorff distance between the two canonical boundaries, minimised over the poses
 * the long-axis frame leaves open. `stopAbove` lets a caller give up early on clearly different shapes.
 */
export function shapeDistance(a: Signature, b: Signature, stopAbove = Infinity): {d: number; pose: string; mirrored: boolean} {
  const poses = Math.abs(a.L - a.W) < 1.0 || Math.abs(b.L - b.W) < 1.0 ? [...POSES, ...SQUARE_POSES] : POSES;
  let best = {d: Infinity, pose: 'id', mirrored: false};
  for (const pose of poses) {
    const bb = b.boundary.map(pose.f), lim = Math.min(stopAbove, best.d);
    const d1 = directed(a.boundary, bb, lim);
    if (d1 >= best.d || d1 > stopAbove) continue;
    const d = Math.max(d1, directed(bb, a.boundary, Math.min(lim, best.d)));
    if (d < best.d) best = {d, pose: pose.name, mirrored: pose.mirrored};
  }
  return best;
}

/**
 * How much an exact footprint match says about a shared design, 0..1. A rectangle (4 vertices, no reflex corner) says
 * little on its own; every notch or arm adds evidence; a footprint that fills its rectangle completely is plain.
 */
export function complexity(s: Pick<Signature, 'vertices' | 'reflex' | 'rectangularity'>): number {
  const notches = Math.min(1, s.reflex / 4), fill = Math.min(1, (1 - s.rectangularity) / 0.25), verts = Math.min(1, Math.max(0, s.vertices - 4) / 10);
  return Math.round(Math.min(1, 0.5 * notches + 0.25 * fill + 0.25 * verts) * 100) / 100;
}

/** Tolerances a pair of copies must meet (shape in metres, sides, area share, height, year). */
export interface MatchTolerance { shapeM: number; sideM: number; areaShare: number; heightM: number; years: number }
export const DEFAULT_TOLERANCE: MatchTolerance = {shapeM: 0.9, sideM: 0.8, areaShare: 0.07, heightM: 1.3, years: 3};

/** Shape tolerance grows with size: 0.9 m for a house, ~2 % of the long side for a 60 m slab. */
export const shapeTolerance = (L: number, t: MatchTolerance = DEFAULT_TOLERANCE) => Math.max(t.shapeM, 0.02 * L);
