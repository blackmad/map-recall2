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
import { barQuad, PANE_OUT_M, paneRects, SHEET_PITCH, type PanelCtx } from './compose.ts';
import { fitsPanel, insidePoly, rectPoly } from './panels.ts';
import { add, scale, type V3 } from './mesh.ts';
import type { Slot } from './spec.ts';

/**
 * `chamfered`: a flat head with straight 45-ish degree shoulders cut off both upper corners (Berlage's Mercatorplein
 * arcades and gateways, "afgeschuinde bovenzijde"): the shoulders rise `rise` x width and run in `chamfer` x width.
 */
export type ArchKind = 'round' | 'segmental' | 'pointed' | 'chamfered';
export const ARCH_KINDS: readonly ArchKind[] = ['round', 'segmental', 'pointed', 'chamfered'];
export type UV = [number, number];

/** Arch band on the wall face around the head: `t` wide (m), projecting `out` (m); `out: 0` = a flush band (one face 1.2 cm off the wall, as cladding). */
export interface ArchBand {
  slot: Slot; t: number; out?: number;
  /** stone blocks at the springing points, beside the band */
  imposts?: Slot | null;
  /** a keystone over the apex */
  keystone?: Slot | null;
  /** false: draw only the blocks, not the ring (a brick head whose ring is the wall's own brick; opt-in) */
  ring?: boolean;
}
export interface ArchParams {
  kind: ArchKind;
  /** head segments (default by width: 4 under 1.25 m, 6 to 1.75 m, then 8, 10; clamped 4..16; pointed rounds up to even) */
  segments?: number;
  /** segmental arch rise as a fraction of the opening width (default 0.18) */
  rise?: number;
  /** glazing bar across the springing line (a fanlight over the leaves) */
  springBar?: boolean;
  band?: ArchBand;
  /** chamfered head: horizontal run of each shoulder as a fraction of the opening width (default 0.18) */
  chamfer?: number;
  /** reveal depth (m) when cut, instead of the wall's recess: an arcade walk or a gateway with the glazing set far back (opt-in) */
  depth?: number;
  /** slot of the reveal faces (soffit and jambs) instead of the host wall's: a rendered arcade ceiling (opt-in) */
  revealSlot?: Slot;
}

const segs = (a: ArchParams, w: number) => { const n = Math.max(4, Math.min(16, Math.round(a.segments ?? 2 * Math.max(2, Math.min(5, Math.round(w * 2)))))); return a.kind === 'pointed' && n % 2 ? n + 1 : n; };

/** Natural rise of the head for an opening `w` wide. */
export function naturalRise(w: number, a: ArchParams): number {
  if (a.kind === 'chamfered') return w * (a.rise ?? 0.18);
  return a.kind === 'round' ? w / 2 : a.kind === 'pointed' ? w * Math.sqrt(3) / 2 : w * (a.rise ?? 0.18);
}

/** Rise actually used: the natural rise, squashed (an elliptical head) where it would take more than 75 % of the height. */
export function archRise(w: number, h: number, a: ArchParams): number {
  return Math.min(naturalRise(w, a), 0.75 * h);
}

/** Head points from the right springing point to the left one (both included), apex v = v1. */
export function archHead(u0: number, u1: number, v0: number, v1: number, a: ArchParams): UV[] {
  if (a.kind === 'chamfered') {
    // right springing point, the two shoulder tops on the flat head, left springing point (no apex vertex)
    const w = u1 - u0, c = Math.min(0.45, a.chamfer ?? 0.18) * w, s = v1 - archRise(w, v1 - v0, a);
    return [[u1, s], [u1 - c, v1], [u0 + c, v1], [u0, s]];
  }
  const w = u1 - u0, uc = (u0 + u1) / 2, nat = naturalRise(w, a), rise = archRise(w, v1 - v0, a), s = v1 - rise, sy = rise / nat, n = segs(a, w);
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

/** Bands and their blocks keep this clear of the wall outline (3DBAG members have slanted and notched edges). */
const FIT_MARGIN = 0.04;
/** The rectangle (grown by FIT_MARGIN) lies on the panel and, in recess mode, on the walls actually emitted (dissolved members). */
function fits(c: PanelCtx, a0: number, a1: number, b0: number, b1: number): boolean {
  if (!fitsPanel(c.p, rectPoly(a0, a1, b0, b1), -FIT_MARGIN)) return false;
  const m = c.p.members;
  if (!c.recess || !m) return true;
  const e = FIT_MARGIN, us = [a0 - e, (a0 + a1) / 2, a1 + e], vs = [b0 - e, (b0 + b1) / 2, b1 + e];
  // one member: neighbouring 3DBAG faces of a panel can sit a few cm off each other's plane
  return m.some(k => us.every(u => vs.every(v => insidePoly([u, v], k.poly))));
}
const UP: V3 = [0, 1, 0];

/** Flush band: the ring and its imposts/keystone as single faces 1.2-1.5 cm off the wall (cheap; open edges lie on the wall). */
function drawFlushBand(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, head: UV[], outer: UV[], band: ArchBand, M: (u: number, v: number, d: number) => V3, part: number): boolean {
  const n = c.p.n, P = (q: UV, d: number) => M(q[0], q[1], d);
  for (let i = 0; i + 1 < head.length; i++) c.mesh.quad(band.slot, P(head[i], 0.012), P(head[i + 1], 0.012), P(outer[i + 1], 0.012), P(outer[i], 0.012), part, n);
  const s = head[0][1], t = band.t, quads: [number, number, number, number, Slot][] = [];
  if (band.imposts) { const ih = Math.min(0.24, (s - v0) * 0.5), iw = t + 0.08; if (ih > 0.05) quads.push([u0 - iw, u0, s - ih, s, band.imposts], [u1, u1 + iw, s - ih, s, band.imposts]); }
  if (band.keystone) { const uc = (u0 + u1) / 2, kw = Math.max(0.18, t * 0.9), top = Math.max(...outer.map(q => q[1])); quads.push([uc - kw / 2, uc + kw / 2, v1, top + 0.06, band.keystone]); }
  // Blocks are double-sided (front and back share every edge): a dissolved 3DBAG face is not exactly planar, and a
  // single-sided block beside the opening can stand more than the open-edge gate's 2 cm off the real wall.
  for (const [a0, a1, b0, b1, slot] of quads) {
    if (!fits(c, a0, a1, b0, b1)) continue;
    const q = [M(a0, b0, 0.015), M(a1, b0, 0.015), M(a1, b1, 0.015), M(a0, b1, 0.015)], bp = c.part();
    c.mesh.quad(slot, q[0], q[1], q[2], q[3], bp, n);
    c.mesh.quad(slot, q[0], q[1], q[2], q[3], bp, scale(n, -1));
  }
  return true;
}
/** 3D facing for the inward (left) normal of the outline edge a->b. */
const inward = (c: PanelCtx, a: UV, b: UV): V3 => { const dx = b[0] - a[0], dy = b[1] - a[1]; return add(scale(c.p.r, -dy), scale(UP, dx)); };

function triPoly(c: PanelCtx, slot: Slot, outer: UV[], holes: UV[][], Q: (u: number, v: number) => V3, part: number) {
  const all = [...outer, ...holes.flat()];
  const faces = T.ShapeUtils.triangulateShape(outer.map(q => new T.Vector2(q[0], q[1])), holes.map(h => h.map(q => new T.Vector2(q[0], q[1]))));
  for (const f of faces) c.mesh.tri(slot, Q(...all[f[0]]), Q(...all[f[1]]), Q(...all[f[2]]), part, c.p.n);
}

export interface ArchedWin {
  frame: Slot; glass: Slot; frameW: number; mullAt: number[]; rowsAt: number[]; arch: ArchParams;
  /** glazing bar depth off the glass (layered kit only: closed boxes; otherwise bars are quads `c.barOut` in front) */
  barD?: number;
  /** recess mode: pane-split glazing (`WinParams.paneSplit`): a frame sheet in the outline, the panes clipped to it in front */
  paneSplit?: boolean;
}

/** A convex CCW polygon clipped to the rectangle [a, b] x [lo, hi] (Sutherland-Hodgman); empty when they do not overlap. */
export function clipConvexRect(poly: UV[], a: number, b: number, lo: number, hi: number): UV[] {
  let out = poly;
  const planes: [(q: UV) => number, (p: UV, q: UV) => UV][] = [
    [q => q[0] - a, (p, q) => { const t = (a - p[0]) / (q[0] - p[0]); return [a, p[1] + (q[1] - p[1]) * t]; }],
    [q => b - q[0], (p, q) => { const t = (b - p[0]) / (q[0] - p[0]); return [b, p[1] + (q[1] - p[1]) * t]; }],
    [q => q[1] - lo, (p, q) => { const t = (lo - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, lo]; }],
    [q => hi - q[1], (p, q) => { const t = (hi - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, hi]; }],
  ];
  for (const [side, cut] of planes) {
    const next: UV[] = [];
    for (let i = 0; i < out.length; i++) {
      const p = out[i], q = out[(i + 1) % out.length], sp = side(p), sq = side(q);
      if (sp >= 0) next.push(p);
      if ((sp >= 0) !== (sq >= 0)) next.push(cut(p, q));
    }
    out = next;
    if (out.length < 3) return [];
  }
  return Math.abs(polyArea(out)) > 1e-6 ? out : [];
}

/**
 * Arched opening in the large tier: cut into one member wall `c.recess` deep with a reveal quad per outline edge, a
 * frame ring and glass in one plane at the back, glazing bars 1.5 cm in front of it (mullions stop under the head),
 * and the arch band on the wall face. Where the opening cannot be cut, the frame and glass are laid 1.5 cm proud.
 * Returns the depth of the glass plane and, when cut, the offset of the cut wall from the panel plane (for sills).
 */
export function drawArchedOpening(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, w: ArchedWin): { back: number; shift: V3 | null } {
  const outline = archOutline(u0, u1, v0, v1, w.arch), n = c.p.n;
  const onWall = c.cutOutline(u0, u1, v0, v1, outline);
  const part = c.part();
  let Q: (u: number, v: number, d: number) => V3, back: number;
  if (onWall) {
    c.stats.recessed++;
    const R = w.arch.depth ?? c.recess, front = outline.map(q => onWall(q[0], q[1])), rear = front.map(q => add(q, scale(n, -R)));
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      c.mesh.quad(w.arch.revealSlot ?? c.wallSlot, front[i], front[j], rear[j], rear[i], part, inward(c, outline[i], outline[j]));
    }
    Q = (u, v, d) => add(onWall(u, v), scale(n, -R + d));
    back = -R;
  } else {
    c.stats.proud++;
    Q = (u, v, d) => c.P(u, v, d + 0.015);
    back = 0.015;
  }
  // frameW 0: no frame ring, the glass (or door leaf) fills the opening
  const fw = Math.max(0, Math.min(w.frameW, (u1 - u0) / 4, (v1 - v0) / 4)), inner = fw > 0 ? insetConvex(outline, fw) : outline;
  if (w.paneSplit) {
    // a frame sheet filling the outline, the panes in front of it (clipped to the inset outline): ring and bars are the sheet between them
    triPoly(c, w.frame, outline, [], (u, v) => Q(u, v, 0), part);
    const s = v1 - archRise(u1 - u0, v1 - v0, w.arch), bw = fw > 0 ? fw : 0.06;
    // the fanlight is its own pane row: a bar across the springing line (always, in pane-split heads)
    const rows = [...w.rowsAt.filter(f => v0 + (v1 - v0) * f < s - fw - bw), ...(w.arch.kind !== 'chamfered' && s - v0 > 2 * fw + bw ? [(s - v0) / (v1 - v0)] : [])];
    for (const [a, b, lo, hi] of paneRects(u0, u1, v0, v1, fw, bw, w.mullAt, rows)) {
      const pane = clipConvexRect(inner, a, b, lo, hi);
      for (let i = 1; i + 1 < pane.length; i++) c.mesh.tri(w.glass, Q(...pane[0], PANE_OUT_M), Q(...pane[i], PANE_OUT_M), Q(...pane[i + 1], PANE_OUT_M), part, c.p.n);
    }
    if (w.arch.band) drawArchBand(c, u0, u1, v0, v1, w.arch, w.arch.band, onWall ? (u, v, d) => add(onWall(u, v), scale(n, d)) : undefined);
    const mid = (u0 + u1) / 2, at = onWall?.(mid, v0), P0 = c.P(mid, v0, 0);
    return { back, shift: at ? [at[0] - P0[0], at[1] - P0[1], at[2] - P0[2]] : null };
  }
  if (fw > 0) triPoly(c, w.frame, outline, [inner], (u, v) => Q(u, v, 0), part);
  triPoly(c, w.glass, inner, [], (u, v) => Q(u, v, -c.glassBack), part);
  const bw = fw > 0 ? fw : 0.06;
  const s = v1 - archRise(u1 - u0, v1 - v0, w.arch);
  const rows = [...w.rowsAt.map(f => v0 + (v1 - v0) * f).filter(v => v < s - fw), ...(w.arch.springBar ? [s] : [])];
  if (w.mullAt.length || rows.length) {
    // layered kit: closed bar boxes from the glass out to `barD` (the legacy quad 1.5 cm in front of the glass z-fights it)
    const bars = c.part(), fw = bw, g = c.layered
      ? (a: number, b: number, lo: number, hi: number) => barQuad(c, w.frame, Q, a, b, lo, hi, 0, w.barD ?? SHEET_PITCH, bars)
      : (a: number, b: number, lo: number, hi: number) => c.mesh.quad(w.frame, Q(a, lo, c.barOut), Q(b, lo, c.barOut), Q(b, hi, c.barOut), Q(a, hi, c.barOut), bars, n);
    for (const f of w.mullAt) {
      const u = u0 + (u1 - u0) * f, top = Math.min(topAt(inner, u - fw / 2), topAt(inner, u + fw / 2));
      if (top > v0 + fw + 0.1) g(u - fw / 2, u + fw / 2, v0 + fw, top);
    }
    for (const v of rows) { const sp = spanAt(inner, v); if (sp && sp[1] - sp[0] > 0.1) g(sp[0], sp[1], v - fw / 2, v + fw / 2); }
  }
  if (w.arch.band) drawArchBand(c, u0, u1, v0, v1, w.arch, w.arch.band, onWall ? (u, v, d) => add(onWall(u, v), scale(n, d)) : undefined);
  const mid = (u0 + u1) / 2, at = onWall?.(mid, v0), P0 = c.P(mid, v0, 0);
  return { back, shift: at ? [at[0] - P0[0], at[1] - P0[1], at[2] - P0[2]] : null };
}

/** Proud arched opening for the original block-kit path (no recess): frame outline at 2 cm, glass at 3.5 cm. */
export function drawArchedProud(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, w: ArchedWin) {
  const outline = archOutline(u0, u1, v0, v1, w.arch), fw = Math.max(0, Math.min(w.frameW, (u1 - u0) / 4, (v1 - v0) / 4));
  if (fw > 0) triPoly(c, w.frame, outline, [], (u, v) => c.P(u, v, 0.02), c.part());
  triPoly(c, w.glass, fw > 0 ? insetConvex(outline, fw) : outline, [], (u, v) => c.P(u, v, 0.035), c.part());
  if (w.arch.band) drawArchBand(c, u0, u1, v0, v1, w.arch, w.arch.band);
}

/**
 * Arch band: a ring `t` wide around the head on the wall face, projecting `out` (front, both edges, end caps), plus
 * impost blocks at the springing points and a keystone. With `onWall` (the opening was cut) every part stands on the
 * cut wall's own plane, so its back edges are seams on the wall; otherwise it stands on the panel plane and is closed
 * at the back when `c.closedBoxes`. Skipped where the band would leave the wall.
 */
export function drawArchBand(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, a: ArchParams, band: ArchBand, onWall?: (u: number, v: number, d: number) => V3): boolean {
  const head = archHead(u0, u1, v0, v1, a), t = band.t, band0 = band.out ?? 0.03, n = c.p.n;
  // outward offset of each head vertex: mitred normals; the springing points move straight out sideways
  const normalOf = (i: number): UV => { const p = head[Math.max(0, i - 1)], q = head[Math.min(head.length - 1, i + 1)], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  const outer: UV[] = head.map((p, i) => {
    if (i === 0) return [p[0] + t, p[1]];
    if (i === head.length - 1) return [p[0] - t, p[1]];
    const nn = normalOf(i); return [p[0] + nn[0] * t, p[1] + nn[1] * t];
  });
  const ring: UV[] = [...head, ...[...outer].reverse()];
  const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]);
  if (!fits(c, Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys))) return false;
  // Layered kit: a flush band (1.2 cm, coplanar with the wall to the audit) or a thin stone/voussoir ring (3-4 cm, the
  // audit's tight band: Amsterdams Lyceum's gateway arches, 2.7 m2) becomes a ring 4.5 cm proud, its blocks 4.5 cm prouder
  // again; on a cut wall their back edges are seams on that wall, elsewhere they are closed at the back too.
  const out = c.layered && band0 < SHEET_PITCH ? SHEET_PITCH : band0;
  const M = onWall ?? ((u: number, v: number, d: number) => c.P(u, v, d)), back = !onWall && (c.layered || c.closedBoxes);
  const part = c.part(), P = (q: UV, d: number) => M(q[0], q[1], d);
  if (out <= 0) return drawFlushBand(c, u0, u1, v0, v1, head, outer, band, M, part);
  if (band.ring !== false) for (let i = 0; i + 1 < head.length; i++) {
    c.mesh.quad(band.slot, P(head[i], out), P(head[i + 1], out), P(outer[i + 1], out), P(outer[i], out), part, n);
    if (back) c.mesh.quad(band.slot, P(head[i], 0), P(head[i + 1], 0), P(outer[i + 1], 0), P(outer[i], 0), part, scale(n, -1));
    // soffit over the opening (faces into it) and the outer edge (faces away)
    c.mesh.quad(band.slot, P(head[i], 0), P(head[i + 1], 0), P(head[i + 1], out), P(head[i], out), part, inward(c, head[i], head[i + 1]));
    c.mesh.quad(band.slot, P(outer[i], 0), P(outer[i + 1], 0), P(outer[i + 1], out), P(outer[i], out), part, scale(inward(c, outer[i], outer[i + 1]), -1));
  }
  const last = head.length - 1, DOWN: V3 = [0, -1, 0];
  if (band.ring !== false) {
    c.mesh.quad(band.slot, P(head[0], 0), P(outer[0], 0), P(outer[0], out), P(head[0], out), part, DOWN);
    c.mesh.quad(band.slot, P(head[last], 0), P(outer[last], 0), P(outer[last], out), P(head[last], out), part, DOWN);
  }
  const s = head[0][1], blocks: [number, number, number, number, Slot][] = [];

  if (band.imposts) {
    const ih = Math.min(0.24, (s - v0) * 0.5), iw = t + 0.08;
    if (ih > 0.05) blocks.push([u0 - iw, u0, s - ih, s, band.imposts], [u1, u1 + iw, s - ih, s, band.imposts]);
  }
  if (band.keystone) {
    const uc = (u0 + u1) / 2, kw = Math.max(0.18, t * 0.9), top = Math.max(...outer.map(q => q[1]));
    blocks.push([uc - kw / 2, uc + kw / 2, v1, top + 0.06, band.keystone]);
  }
  for (const [a0, a1, b0, b1, slot] of blocks) {
    if (!fits(c, a0, a1, b0, b1)) continue;
    if (!onWall && !c.layered) { c.box(slot, a0, a1, b0, b1, 0, out + 0.03, c.part()); continue; }
    // five faces on the cut wall's plane (the back is the wall; off a cut wall the layered kit closes it). Layered blocks
    // stand a full sheet layer prouder than the band (3 cm sits on the audit's tight-band edge where the keystone covers the ring).
    const bp = c.part(), d1 = out + (c.layered ? SHEET_PITCH : 0.03), Q = (u: number, v: number, d: number) => M(u, v, d), r = c.p.r;
    if (!onWall) c.mesh.quad(slot, Q(a0, b0, 0), Q(a0, b1, 0), Q(a1, b1, 0), Q(a1, b0, 0), bp, scale(n, -1));
    c.mesh.quad(slot, Q(a0, b0, d1), Q(a1, b0, d1), Q(a1, b1, d1), Q(a0, b1, d1), bp, n);
    c.mesh.quad(slot, Q(a0, b1, 0), Q(a1, b1, 0), Q(a1, b1, d1), Q(a0, b1, d1), bp, UP);
    c.mesh.quad(slot, Q(a0, b0, 0), Q(a1, b0, 0), Q(a1, b0, d1), Q(a0, b0, d1), bp, DOWN);
    c.mesh.quad(slot, Q(a0, b0, 0), Q(a0, b1, 0), Q(a0, b1, d1), Q(a0, b0, d1), bp, scale(r, -1));
    c.mesh.quad(slot, Q(a1, b0, 0), Q(a1, b1, 0), Q(a1, b1, d1), Q(a1, b0, d1), bp, r);
  }
  return true;
}
