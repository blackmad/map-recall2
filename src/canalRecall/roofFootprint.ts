// Footprint measurements for the roof planner: pure, frame-agnostic, metres.
//
//  - `inscribedRects`: the largest axis-aligned rectangle inside a footprint (in
//    the frame of its minimum-area box), and a second one beside it. An L, T or
//    a canal house with a narrower rear extension then gets a real roof on its
//    main body (and its wing) instead of a flat lid.
//  - `findChamfer`: a short diagonal edge cutting a box corner: the cut-off
//    corner of a 19th-century street-corner block, where a turret goes.
//  - `parapetRingOk`: whether an inset ring for a parapet stays well formed.
// Tolerances are measured, not assumed (see scripts/check-roof-shapes.ts).

import type { Rect } from './roofMesh.js';

type Vec2 = [number, number];

/** Vertices of a ring without the closing duplicate, and with near-duplicates (< 5 cm) removed. */
export function openRing(points: readonly Vec2[]): Vec2[] {
  const pts: Vec2[] = [];
  for (const p of points) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.05) pts.push([p[0], p[1]]);
  while (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) <= 0.05) pts.pop();
  return pts;
}

export function signedArea(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return a / 2;
}

/** Merge sorted values closer than `gap` (keeps the first of each cluster). */
const breaksOf = (values: number[], gap: number): number[] => {
  const s = [...values].sort((a, b) => a - b), out: number[] = [];
  for (const x of s) if (!out.length || x - out[out.length - 1] > gap) out.push(x);
  if (out.length && s[s.length - 1] > out[out.length - 1]) out[out.length - 1] = Math.max(out[out.length - 1], s[s.length - 1]);
  return out;
};

/** Where the line a = const crosses the ring, sorted along b. */
function crossings(loc: Vec2[], a: number): number[] {
  const out: number[] = [];
  for (let i = 0, j = loc.length - 1; i < loc.length; j = i++) {
    const [a0, b0] = loc[j], [a1, b1] = loc[i];
    if ((a0 <= a && a1 > a) || (a1 <= a && a0 > a)) out.push(b0 + ((a - a0) / (a1 - a0)) * (b1 - b0));
  }
  return out.sort((x, y) => x - y);
}

type Slab = { a0: number; a1: number; lo: number; hi: number } | null;
type Found = { area: number; a0: number; a1: number; lo: number; hi: number; i: number; j: number };

function slabsOf(loc: Vec2[], gap: number): { slabs: Slab[] } {
  const br = breaksOf(loc.map(p => p[0]), gap), slabs: Slab[] = [];
  for (let k = 0; k < br.length - 1; k++) {
    const a0 = br[k], a1 = br[k + 1], w = a1 - a0, d = Math.min(0.15, w * 0.25);
    let lo = -Infinity, hi = Infinity, ok = true;
    for (const a of [a0 + d, (a0 + a1) / 2, a1 - d]) {
      const c = crossings(loc, a);
      if (c.length !== 2) { ok = false; break; }
      lo = Math.max(lo, c[0]); hi = Math.min(hi, c[1]);
    }
    slabs.push(ok && hi > lo ? { a0, a1, lo, hi } : null);
  }
  return { slabs };
}

/** Largest rectangle over a run of slab intervals (optionally clipped per slab). */
function bestOver(slabs: Slab[], range: [number, number], interval: (s: NonNullable<Slab>, k: number) => [number, number] | null, minW: number, minL: number): Found | null {
  let best: Found | null = null;
  for (let i = range[0]; i <= range[1]; i++) {
    let lo = -Infinity, hi = Infinity;
    for (let j = i; j <= range[1]; j++) {
      const s = slabs[j];
      const iv = s && interval(s, j);
      if (!s || !iv) break;
      lo = Math.max(lo, iv[0]); hi = Math.min(hi, iv[1]);
      if (hi - lo < Math.min(minW, minL)) break;
      const along = s.a1 - slabs[i]!.a0, across = hi - lo;
      if (Math.min(along, across) < minW || Math.max(along, across) < minL) continue;
      const area = along * across;
      if (!best || area > best.area + 1e-9) best = { area, a0: slabs[i]!.a0, a1: s.a1, lo, hi, i, j };
    }
  }
  return best;
}

/** A rectangle from local (a, b) bounds in `frame` (a along frame.u when `alongU`). */
function rectFrom(frame: Rect, alongU: boolean, a0: number, a1: number, b0: number, b1: number): Rect {
  const { cx, cy, ux, uy } = frame;
  const [u0, u1, v0, v1] = alongU ? [a0, a1, b0, b1] : [b0, b1, -a1, -a0];
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, lu = u1 - u0, lv = v1 - v0;
  const x = cx + uc * ux - vc * uy, y = cy + uc * uy + vc * ux;
  return lu >= lv ? { cx: x, cy: y, ux, uy, len: lu, wid: lv, coverage: 1, maxDev: 0 } : { cx: x, cy: y, ux: -uy, uy: ux, len: lv, wid: lu, coverage: 1, maxDev: 0 };
}

export type Inscribed = { main: Rect; second: Rect | null; mainShare: number };

/**
 * The largest axis-aligned rectangle inside the footprint and a second one
 * that does not overlap it. `frame` is the footprint's minimum-area box. Vertex
 * positions closer than `gap` along an axis are treated as one break (slightly
 * skewed party walls), so the result may poke out by at most about `gap` times
 * the edge slope there.
 */
export function inscribedRects(ring: readonly Vec2[], frame: Rect, opts: { minW?: number; minL?: number; gap?: number; minSecondM2?: number } = {}): Inscribed | null {
  const minW = opts.minW ?? 3.6, minL = opts.minL ?? 4.5, gap = opts.gap ?? 0.35, minSecond = opts.minSecondM2 ?? 20;
  const pts = openRing(ring);
  if (pts.length < 4) return null;
  const area = Math.abs(signedArea(pts));
  if (area <= 0) return null;
  const { cx, cy, ux, uy } = frame;
  const locU: Vec2[] = pts.map(([x, y]) => [(x - cx) * ux + (y - cy) * uy, -(x - cx) * uy + (y - cy) * ux]);
  // Slabs along u (a = u, b = v) and along v (a = -v, b = u: the same right-handed turn as rectFrom).
  const locV: Vec2[] = locU.map(([u, v]) => [-v, u]);
  let pick: { alongU: boolean; slabs: Slab[]; f: Found } | null = null;
  for (const [alongU, loc] of [[true, locU], [false, locV]] as const) {
    const { slabs } = slabsOf(loc, gap);
    if (!slabs.length) continue;
    const f = bestOver(slabs, [0, slabs.length - 1], s => [s.lo, s.hi], minW, minL);
    if (f && (!pick || f.area > pick.f.area + 1e-9)) pick = { alongU, slabs, f };
  }
  if (!pick) return null;
  const { alongU, slabs, f } = pick;
  const main = rectFrom(frame, alongU, f.a0, f.a1, f.lo, f.hi);
  // A second, non-overlapping rectangle: beyond either end of the main one, or beside it within its run.
  const cands: Array<Found | null> = [
    f.i > 0 ? bestOver(slabs, [0, f.i - 1], s => [s.lo, s.hi], minW, minL) : null,
    f.j < slabs.length - 1 ? bestOver(slabs, [f.j + 1, slabs.length - 1], s => [s.lo, s.hi], minW, minL) : null,
    bestOver(slabs, [f.i, f.j], s => (s.lo < f.lo - 1e-6 ? [s.lo, f.lo] : null), minW, minL),
    bestOver(slabs, [f.i, f.j], s => (s.hi > f.hi + 1e-6 ? [f.hi, s.hi] : null), minW, minL),
  ];
  let second: Found | null = null;
  for (const c of cands) if (c && c.area >= minSecond && (!second || c.area > second.area)) second = c;
  return { main, second: second ? rectFrom(frame, alongU, second.a0, second.a1, second.lo, second.hi) : null, mainShare: f.area / area };
}

export type Chamfer = { x: number; y: number; len: number; /** Unit vector from the box centre towards the cut corner. */ dx: number; dy: number };

/**
 * A cut-off corner: an edge 1.2–6.5 m long at 30–60° to the box axes whose two
 * ends sit (within 0.6 m) on two different sides of the box.
 */
export function findChamfer(ring: readonly Vec2[], rect: Rect): Chamfer | null {
  const pts = openRing(ring), { cx, cy, ux, uy, len, wid } = rect;
  const loc = (p: Vec2): Vec2 => [(p[0] - cx) * ux + (p[1] - cy) * uy, -(p[0] - cx) * uy + (p[1] - cy) * ux];
  const side = ([u, v]: Vec2): string | null => (Math.abs(Math.abs(u) - len / 2) < 0.6 ? `u${Math.sign(u)}` : Math.abs(Math.abs(v) - wid / 2) < 0.6 ? `v${Math.sign(v)}` : null);
  let best: Chamfer | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l < 1.2 || l > 6.5) continue;
    const c = Math.abs(((q[0] - p[0]) * ux + (q[1] - p[1]) * uy) / l);
    if (c < 0.5 || c > 0.866) continue;
    const a = loc(p), b = loc(q), sa = side(a), sb = side(b);
    if (!sa || !sb || sa[0] === sb[0]) continue;
    const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2;
    const du = Math.sign(mu), dv = Math.sign(mv), dl = Math.hypot(du, dv) || 1;
    const x = cx + mu * ux - mv * uy, y = cy + mu * uy + mv * ux;
    const dx = (du * ux - dv * uy) / dl, dy = (du * uy + dv * ux) / dl;
    if (!best || l > best.len) best = { x, y, len: l, dx, dy };
  }
  return best;
}

/**
 * The ring inset by `t` (mitred), or null when the inset folds over itself:
 * an edge reversing direction or a mitre longer than 4·t at a spike.
 */
export function insetRing(ring: readonly Vec2[], t: number): Vec2[] | null {
  const pts = openRing(ring);
  if (pts.length < 3) return null;
  const ccw = signedArea(pts) > 0, n = pts.length, out: Vec2[] = [];
  const normalIn = (a: Vec2, b: Vec2): Vec2 => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return ccw ? [-dy / l, dx / l] : [dy / l, -dx / l]; };
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
    const n0 = normalIn(prev, cur), n1 = normalIn(cur, next);
    const mx = n0[0] + n1[0], my = n0[1] + n1[1], ml = Math.hypot(mx, my);
    if (ml < 1e-6) return null;
    const cosHalf = (mx * n0[0] + my * n0[1]) / ml;
    if (cosHalf < 0.25) return null;
    const k = t / cosHalf;
    out.push([cur[0] + (mx / ml) * k, cur[1] + (my / ml) * k]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], a2 = out[i], b2 = out[(i + 1) % n];
    if ((b[0] - a[0]) * (b2[0] - a2[0]) + (b[1] - a[1]) * (b2[1] - a2[1]) <= 0) return null;
  }
  return out;
}
export const parapetRingOk = (ring: readonly Vec2[], t: number, maxVertices = 40): boolean => {
  const pts = openRing(ring);
  return pts.length >= 3 && pts.length <= maxVertices && insetRing(pts, t) !== null;
};
