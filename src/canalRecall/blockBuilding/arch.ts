/**
 * Arched openings for the block kit (opt-in `WinParams.arch`): a polygonal head (round, segmental or pointed) on a
 * rectangular opening, cut into the host wall with reveals along every outline edge, closed at the back by a frame
 * ring and glass (or a door leaf), and optionally framed on the wall face by a brick or stone arch band with imposts
 * and a keystone.
 *
 * Geometry is in the panel's (u, v) frame. The outline is convex and counter-clockwise (u right, v up, seen from
 * outside): bottom-left, bottom-right, right springing point, the head, left springing point. The head is exact at
 * the springing points and the apex, so reveals, the wall hole and the back plane share vertices.
 */
import * as T from 'three';
import type { PanelCtx } from './compose.ts';
import { fitsPanel, rectPoly } from './panels.ts';
import { add, scale, type V3 } from './mesh.ts';
import type { Slot } from './spec.ts';

export type ArchKind = 'round' | 'segmental' | 'pointed';
export const ARCH_KINDS: readonly ArchKind[] = ['round', 'segmental', 'pointed'];
export type UV = [number, number];

/** Arch band on the wall face around the head: `t` wide (m), projecting `out` (m). */
export interface ArchBand {
  slot: Slot; t: number; out?: number;
  /** stone blocks at the springing points, beside the band */
  imposts?: Slot | null;
  /** a keystone over the apex */
  keystone?: Slot | null;
}
export interface ArchParams {
  kind: ArchKind;
  /** head segments (default 10; clamped 4..16; pointed rounds up to even) */
  segments?: number;
  /** segmental arch rise as a fraction of the opening width (default 0.18) */
  rise?: number;
  /** glazing bar across the springing line (a fanlight over the leaves) */
  springBar?: boolean;
  band?: ArchBand;
}

const segs = (a: ArchParams) => { const n = Math.max(4, Math.min(16, Math.round(a.segments ?? 10))); return a.kind === 'pointed' && n % 2 ? n + 1 : n; };

/** Natural rise of the head for an opening `w` wide. */
export function naturalRise(w: number, a: ArchParams): number {
  return a.kind === 'round' ? w / 2 : a.kind === 'pointed' ? w * Math.sqrt(3) / 2 : w * (a.rise ?? 0.18);
}

/** Rise actually used: the natural rise, squashed (an elliptical head) where it would take more than 75 % of the height. */
export function archRise(w: number, h: number, a: ArchParams): number {
  return Math.min(naturalRise(w, a), 0.75 * h);
}

/** Head points from the right springing point to the left one (both included), apex v = v1. */
export function archHead(u0: number, u1: number, v0: number, v1: number, a: ArchParams): UV[] {
  const w = u1 - u0, uc = (u0 + u1) / 2, nat = naturalRise(w, a), rise = archRise(w, v1 - v0, a), s = v1 - rise, sy = rise / nat, n = segs(a);
  const pts: UV[] = [];
  if (a.kind === 'round') {
    const R = w / 2;
    for (let i = 0; i <= n; i++) { const th = Math.PI * i / n; pts.push([uc + R * Math.cos(th), s + R * Math.sin(th) * sy]); }
  } else if (a.kind === 'segmental') {
    const r = nat, R = (w * w / 4 + r * r) / (2 * r), al = Math.asin(Math.min(1, w / 2 / R)), base = R * Math.cos(al);
    for (let i = 0; i <= n; i++) { const th = Math.PI / 2 - al + 2 * al * i / n; pts.push([uc + R * Math.cos(th), s + (R * Math.sin(th) - base) * sy]); }
  } else {
    // equilateral pointed arch: two arcs of radius w struck from the opposite springing points
    const h = n / 2;
    for (let i = 0; i <= h; i++) { const th = Math.PI / 3 * i / h; pts.push([u0 + w * Math.cos(th), s + w * Math.sin(th) * sy]); }
    for (let i = 1; i <= h; i++) { const th = Math.PI - Math.PI / 3 + Math.PI / 3 * i / h; pts.push([u1 + w * Math.cos(th), s + w * Math.sin(th) * sy]); }
  }
  // exact springing points and apex (shared with reveals and the wall hole)
  pts[0] = [u1, s]; pts[pts.length - 1] = [u0, s];
  if (n % 2 === 0) pts[n / 2] = [uc, v1];
  return pts;
}

/** Closed CCW outline: bottom-left, bottom-right, then the head from right to left. */
export function archOutline(u0: number, u1: number, v0: number, v1: number, a: ArchParams): UV[] {
  return [[u0, v0], [u1, v0], ...archHead(u0, u1, v0, v1, a)];
}

export function polyArea(p: UV[]): number {
  let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2;
}

/** Convex CCW polygon shrunk by `d` (mitred: every edge moves inward by d, so a frame ring has a constant width). */
export function insetConvex(p: UV[], d: number): UV[] {
  const n = p.length, lines = p.map((a, i) => {
    const b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    return { a: [a[0] + nx * d, a[1] + ny * d] as UV, dx, dy };
  });
  return p.map((q, i) => {
    const L1 = lines[(i + n - 1) % n], L2 = lines[i], den = L1.dx * L2.dy - L1.dy * L2.dx;
    if (Math.abs(den) < 1e-12) return L2.a;
    const t = ((L2.a[0] - L1.a[0]) * L2.dy - (L2.a[1] - L1.a[1]) * L2.dx) / den;
    return [L1.a[0] + L1.dx * t, L1.a[1] + L1.dy * t] as UV;
  });
}

/** v of the outline's top edge at u (the head, or the opening top for a flat stretch); -Infinity outside. */
export function topAt(outline: UV[], u: number): number {
  let best = -Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if (b[0] >= a[0]) continue; // the top edges run right to left in a CCW outline
    if (u > a[0] + 1e-9 || u < b[0] - 1e-9) continue;
    const t = (u - a[0]) / (b[0] - a[0] || 1);
    best = Math.max(best, a[1] + (b[1] - a[1]) * t);
  }
  return best;
}

/** u extent of the outline at height v (the left and right edges), or null when v is outside. */
export function spanAt(outline: UV[], v: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if ((a[1] - v) * (b[1] - v) > 0 || a[1] === b[1]) continue;
    const u = a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]);
    lo = Math.min(lo, u); hi = Math.max(hi, u);
  }
  return lo < hi ? [lo, hi] : null;
}

const UP: V3 = [0, 1, 0];
/** 3D facing for the inward (left) normal of the outline edge a->b. */
const inward = (c: PanelCtx, a: UV, b: UV): V3 => { const dx = b[0] - a[0], dy = b[1] - a[1]; return add(scale(c.p.r, -dy), scale(UP, dx)); };

function triPoly(c: PanelCtx, slot: Slot, outer: UV[], holes: UV[][], Q: (u: number, v: number) => V3, part: number) {
  const all = [...outer, ...holes.flat()];
  const faces = T.ShapeUtils.triangulateShape(outer.map(q => new T.Vector2(q[0], q[1])), holes.map(h => h.map(q => new T.Vector2(q[0], q[1]))));
  for (const f of faces) c.mesh.tri(slot, Q(...all[f[0]]), Q(...all[f[1]]), Q(...all[f[2]]), part, c.p.n);
}

export interface ArchedWin {
  frame: Slot; glass: Slot; frameW: number; mullAt: number[]; rowsAt: number[]; arch: ArchParams;
}

/**
 * Arched opening in the large tier: cut into one member wall `c.recess` deep with a reveal quad per outline edge, a
 * frame ring and glass in one plane at the back, glazing bars 1.5 cm in front of it (mullions stop under the head),
 * and the arch band on the wall face. Where the opening cannot be cut, the frame and glass are laid 1.5 cm proud.
 * Returns the depth of the glass plane.
 */
export function drawArchedOpening(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, w: ArchedWin): number {
  const outline = archOutline(u0, u1, v0, v1, w.arch), n = c.p.n;
  const onWall = c.cutOutline(u0, u1, v0, v1, outline);
  const part = c.part();
  let Q: (u: number, v: number, d: number) => V3, back: number;
  if (onWall) {
    c.stats.recessed++;
    const R = c.recess, front = outline.map(q => onWall(q[0], q[1])), rear = front.map(q => add(q, scale(n, -R)));
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      c.mesh.quad(c.wallSlot, front[i], front[j], rear[j], rear[i], part, inward(c, outline[i], outline[j]));
    }
    Q = (u, v, d) => add(onWall(u, v), scale(n, -R + d));
    back = -R;
  } else {
    c.stats.proud++;
    Q = (u, v, d) => c.P(u, v, d + 0.015);
    back = 0.015;
  }
  const fw = Math.min(w.frameW, (u1 - u0) / 4, (v1 - v0) / 4), inner = insetConvex(outline, fw);
  triPoly(c, w.frame, outline, [inner], (u, v) => Q(u, v, 0), part);
  triPoly(c, w.glass, inner, [], (u, v) => Q(u, v, 0), part);
  const s = v1 - archRise(u1 - u0, v1 - v0, w.arch);
  const rows = [...w.rowsAt.map(f => v0 + (v1 - v0) * f).filter(v => v < s - fw), ...(w.arch.springBar ? [s] : [])];
  if (w.mullAt.length || rows.length) {
    const bars = c.part(), g = (a: number, b: number, lo: number, hi: number) => c.mesh.quad(w.frame, Q(a, lo, 0.015), Q(b, lo, 0.015), Q(b, hi, 0.015), Q(a, hi, 0.015), bars, n);
    for (const f of w.mullAt) {
      const u = u0 + (u1 - u0) * f, top = Math.min(topAt(inner, u - fw / 2), topAt(inner, u + fw / 2));
      if (top > v0 + fw + 0.1) g(u - fw / 2, u + fw / 2, v0 + fw, top);
    }
    for (const v of rows) { const sp = spanAt(inner, v); if (sp && sp[1] - sp[0] > 0.1) g(sp[0], sp[1], v - fw / 2, v + fw / 2); }
  }
  if (w.arch.band) drawArchBand(c, u0, u1, v0, v1, w.arch, w.arch.band);
  return back;
}

/** Proud arched opening for the original block-kit path (no recess): frame outline at 2 cm, glass at 3.5 cm. */
export function drawArchedProud(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, w: ArchedWin) {
  const outline = archOutline(u0, u1, v0, v1, w.arch), fw = Math.min(w.frameW, (u1 - u0) / 4, (v1 - v0) / 4);
  triPoly(c, w.frame, outline, [], (u, v) => c.P(u, v, 0.02), c.part());
  triPoly(c, w.glass, insetConvex(outline, fw), [], (u, v) => c.P(u, v, 0.035), c.part());
  if (w.arch.band) drawArchBand(c, u0, u1, v0, v1, w.arch, w.arch.band);
}

/**
 * Arch band: a ring `t` wide around the head on the wall face, projecting `out`, closed (front, both edges, end caps,
 * and a back face when `c.closedBoxes`), plus impost blocks at the springing points and a keystone. Skipped where
 * the band would leave the wall.
 */
export function drawArchBand(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, a: ArchParams, band: ArchBand): boolean {
  const head = archHead(u0, u1, v0, v1, a), t = band.t, out = band.out ?? 0.03, n = c.p.n;
  // outward offset of each head vertex: mitred normals; the springing points move straight out sideways
  const normalOf = (i: number): UV => { const p = head[Math.max(0, i - 1)], q = head[Math.min(head.length - 1, i + 1)], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  const outer: UV[] = head.map((p, i) => {
    if (i === 0) return [p[0] + t, p[1]];
    if (i === head.length - 1) return [p[0] - t, p[1]];
    const nn = normalOf(i); return [p[0] + nn[0] * t, p[1] + nn[1] * t];
  });
  const ring: UV[] = [...head, ...[...outer].reverse()];
  const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]);
  if (!fitsPanel(c.p, rectPoly(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)))) return false;
  const part = c.part(), P = (q: UV, d: number) => c.P(q[0], q[1], d);
  for (let i = 0; i + 1 < head.length; i++) {
    c.mesh.quad(band.slot, P(head[i], out), P(head[i + 1], out), P(outer[i + 1], out), P(outer[i], out), part, n);
    if (c.closedBoxes) c.mesh.quad(band.slot, P(head[i], 0), P(head[i + 1], 0), P(outer[i + 1], 0), P(outer[i], 0), part, scale(n, -1));
    // soffit over the opening (faces into it) and the outer edge (faces away)
    c.mesh.quad(band.slot, P(head[i], 0), P(head[i + 1], 0), P(head[i + 1], out), P(head[i], out), part, inward(c, head[i], head[i + 1]));
    c.mesh.quad(band.slot, P(outer[i], 0), P(outer[i + 1], 0), P(outer[i + 1], out), P(outer[i], out), part, scale(inward(c, outer[i], outer[i + 1]), -1));
  }
  const last = head.length - 1, DOWN: V3 = [0, -1, 0];
  c.mesh.quad(band.slot, P(head[0], 0), P(outer[0], 0), P(outer[0], out), P(head[0], out), part, DOWN);
  c.mesh.quad(band.slot, P(head[last], 0), P(outer[last], 0), P(outer[last], out), P(head[last], out), part, DOWN);
  const s = head[0][1], blocks: [number, number, number, number, Slot][] = [];
  if (band.imposts) {
    const ih = Math.min(0.24, (s - v0) * 0.5), iw = t + 0.08;
    if (ih > 0.05) blocks.push([u0 - iw, u0, s - ih, s, band.imposts], [u1, u1 + iw, s - ih, s, band.imposts]);
  }
  if (band.keystone) {
    const uc = (u0 + u1) / 2, kw = Math.max(0.18, t * 0.9), top = Math.max(...outer.map(q => q[1]));
    blocks.push([uc - kw / 2, uc + kw / 2, v1, top + 0.06, band.keystone]);
  }
  for (const [a0, a1, b0, b1, slot] of blocks) if (fitsPanel(c.p, rectPoly(a0, a1, b0, b1))) c.box(slot, a0, a1, b0, b1, 0, out + 0.03, c.part());
  return true;
}
