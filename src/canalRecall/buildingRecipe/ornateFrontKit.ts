/**
 * Ornate-front kit: low-triangle components for photographed historic fronts that the block kit's facade systems do not
 * say (Centraal Station lane, 2026-10-16): walls with real window holes, stone reveals, recessed glazing with stone
 * mullions and transoms, segmental / round / pointed heads, stone surrounds in the wall plane, proud bands and quoin
 * blocks, gable faces with copings, dials, cresting, pinnacles, pyramid and extruded (mansard, gabled) roofs.
 *
 * Everything writes triangles into a `TriSink` keyed by colour name, so a builder emits one geometry per colour (a
 * 300 m front is a few thousand primitives, not a few thousand meshes). Pure functions over plain arrays; `three` is
 * used only for its polygon triangulation (`ShapeUtils`). Nothing here is used by another model, so their output is
 * byte-identical with or without this module.
 *
 * Frames. A `WallFrame` is a vertical wall plane: `o` = [x, z] of the wall face at t = 0, `u` = unit [x, z] along the
 * wall. The outward normal is n = (-u.z, u.x) (u = +x gives n = +z). A point is (t along, y up, d out of the face).
 * Faces are wound counter-clockwise seen from where they face, so face normals point out of the model.
 */
import * as T from 'three';

export type V3 = [number, number, number];
export type P2 = [number, number];

export class TriSink {
  readonly tris = new Map<string, number[]>();
  tri(c: string, a: V3, b: V3, d: V3) {
    let arr = this.tris.get(c);
    if (!arr) { arr = []; this.tris.set(c, arr); }
    arr.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
  }
  /** Quad a-b-c-d, counter-clockwise seen from its front. */
  quad(c: string, a: V3, b: V3, d: V3, e: V3) { this.tri(c, a, b, d); this.tri(c, a, d, e); }
  count(): number { let n = 0; for (const v of this.tris.values()) n += v.length / 9; return n; }
}

export interface WallFrame { o: P2; u: P2 }
export const frame = (o: P2, u: P2): WallFrame => { const l = Math.hypot(u[0], u[1]); return {o, u: [u[0] / l, u[1] / l]}; };
export const normalOf = (f: WallFrame): P2 => [-f.u[1], f.u[0]];
export function at(f: WallFrame, t: number, y: number, d = 0): V3 {
  const n = normalOf(f);
  return [f.o[0] + f.u[0] * t + n[0] * d, y, f.o[1] + f.u[1] * t + n[1] * d];
}

const signedArea = (r: P2[]) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;
const ccw = (r: P2[]) => signedArea(r) < 0 ? [...r].reverse() : r;
const cw = (r: P2[]) => signedArea(r) > 0 ? [...r].reverse() : r;

/** A planar polygon (t, y) with holes on the wall, `d` out of the face, facing out. */
export function panel(s: TriSink, c: string, f: WallFrame, outline: P2[], holes: P2[][] = [], d = 0) {
  const outer = ccw(outline), hs = holes.map(cw);
  const tris = T.ShapeUtils.triangulateShape(outer.map(p => new T.Vector2(p[0], p[1])), hs.map(h => h.map(p => new T.Vector2(p[0], p[1]))));
  const all = [...outer, ...hs.flat()];
  for (const [a, b, e] of tris) {
    const A = all[a], B = all[b], E = all[e];
    // ShapeUtils returns triangles in the outline's winding (counter-clockwise in t, y): front-facing for the frame.
    const area = (B[0] - A[0]) * (E[1] - A[1]) - (E[0] - A[0]) * (B[1] - A[1]);
    if (Math.abs(area) < 1e-9) continue;
    if (area > 0) s.tri(c, at(f, A[0], A[1], d), at(f, B[0], B[1], d), at(f, E[0], E[1], d));
    else s.tri(c, at(f, A[0], A[1], d), at(f, E[0], E[1], d), at(f, B[0], B[1], d));
  }
}

export const rect = (t0: number, t1: number, y0: number, y1: number): P2[] => [[t0, y0], [t1, y0], [t1, y1], [t0, y1]];

export type HeadKind = 'flat' | 'segment' | 'round' | 'pointed';
export interface Opening { t: number; y: number; w: number; h: number; head?: HeadKind; rise?: number; segs?: number }

/** Opening outline, counter-clockwise from the bottom left: sill at y, springing at y + h - rise, crown at y + h. */
export function openingOutline(o: Opening): P2[] {
  const head = o.head ?? 'flat', l = o.t - o.w / 2, r = o.t + o.w / 2, top = o.y + o.h;
  if (head === 'flat') return [[l, o.y], [r, o.y], [r, top], [l, top]];
  const segs = o.segs ?? (head === 'round' ? 6 : head === 'pointed' ? 3 : 4);
  const pts: P2[] = [[l, o.y], [r, o.y]];
  if (head === 'round') {
    const rad = o.w / 2, spring = top - rad;
    for (let i = 0; i <= segs; i++) { const a = Math.PI * i / segs; pts.push([o.t + rad * Math.cos(a), spring + rad * Math.sin(a)]); }
  } else if (head === 'segment') {
    const rise = Math.min(o.rise ?? o.w * 0.18, o.w / 2), half = o.w / 2;
    const R = (half * half + rise * rise) / (2 * rise), cy = top - R, a0 = Math.asin(half / R);
    // right springing to left springing over the crown
    for (let i = 0; i <= segs; i++) { const a = a0 - 2 * a0 * i / segs; pts.push([o.t + R * Math.sin(a), cy + R * Math.cos(a)]); }
  } else {
    const rise = o.rise ?? o.w * 0.75, spring = top - rise;
    for (let i = 0; i <= segs; i++) { const k = i / segs; pts.push([r - (o.w / 2) * k, spring + rise * Math.sin(k * Math.PI / 2)]); }
    for (let i = segs - 1; i >= 0; i--) { const k = i / segs; pts.push([l + (o.w / 2) * k, spring + rise * Math.sin(k * Math.PI / 2)]); }
  }
  // drop exact duplicates (the arc's first point repeats the right jamb top when rise = h)
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
}

/** The same opening grown by `m` on every side (stone surround outline). */
export function grown(o: Opening, m: number, sill = m): Opening {
  return {...o, w: o.w + 2 * m, y: o.y - sill, h: o.h + m + sill, rise: o.rise === undefined ? undefined : o.rise + m * 0.5};
}

export interface OpeningOptions {
  /** glazing depth behind the wall face */ depth?: number;
  /** stone mullions across (count of vertical bars) and transom heights as fractions of the opening height */
  mullions?: number; transoms?: number[];
  /** a glazing-bar grid (leaded lights) drawn as thin bars in the frame colour: panes across and up */
  panes?: [number, number];
  glass?: string; reveal?: string; mullion?: string; bar?: string;
  /** bar widths */ mullionW?: number;
}

/**
 * Reveals (the hole's sides, facing in), the recessed glass and the stone cross: mullions and transoms as front faces
 * 13 cm proud of the glass (glazing bars 6.5 cm), so a 2-3 light cross window reads at gallery size for 2 triangles a bar;
 * a GLB quantises a 400 m model to about 2.6 cm steps, so closer offsets read as z-fighting.
 */
export function opening(s: TriSink, f: WallFrame, o: Opening, opt: OpeningOptions = {}) {
  const depth = opt.depth ?? 0.22, outline = openingOutline(o), glass = opt.glass ?? 'glass', reveal = opt.reveal ?? 'stone';
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    // side quad between the face (d = 0) and the glass (d = -depth), facing into the opening
    s.quad(reveal, at(f, a[0], a[1], 0), at(f, b[0], b[1], 0), at(f, b[0], b[1], -depth), at(f, a[0], a[1], -depth));
  }
  panel(s, glass, f, outline, [], -depth);
  const bar = opt.mullion ?? reveal, mw = opt.mullionW ?? 0.14, top = o.y + o.h, spring = o.head && o.head !== 'flat' ? top - (o.head === 'round' ? o.w / 2 : (o.rise ?? o.w * (o.head === 'pointed' ? 0.75 : 0.18))) : top;
  const dBar = -depth + 0.13;
  const n = opt.mullions ?? 0;
  for (let k = 1; k <= n; k++) {
    const t = o.t - o.w / 2 + o.w * k / (n + 1);
    s.quad(bar, at(f, t - mw / 2, o.y, dBar), at(f, t + mw / 2, o.y, dBar), at(f, t + mw / 2, spring + (o.head === 'round' || o.head === 'pointed' ? (o.h - (spring - o.y)) * 0.6 : 0), dBar), at(f, t - mw / 2, spring + (o.head === 'round' || o.head === 'pointed' ? (o.h - (spring - o.y)) * 0.6 : 0), dBar));
  }
  for (const fr of opt.transoms ?? []) {
    const y = o.y + (spring - o.y) * fr;
    s.quad(bar, at(f, o.t - o.w / 2, y - mw / 2, dBar), at(f, o.t + o.w / 2, y - mw / 2, dBar), at(f, o.t + o.w / 2, y + mw / 2, dBar), at(f, o.t - o.w / 2, y + mw / 2, dBar));
  }
  if (opt.panes) {
    const [nx, ny] = opt.panes, bw = 0.035, dPane = -depth + 0.065, c = opt.bar ?? 'frame';
    // a glazing bar that a mullion or transom already covers is not drawn (it would be buried behind the stone bar)
    const barT = Array.from({length: n}, (_, k) => o.t - o.w / 2 + o.w * (k + 1) / (n + 1)), barY = (opt.transoms ?? []).map(fr => o.y + (spring - o.y) * fr);
    for (let k = 1; k < ny; k++) { const y = o.y + (spring - o.y) * k / ny; if (barY.some(v => Math.abs(v - y) < mw / 2 + bw)) continue; s.quad(c, at(f, o.t - o.w / 2, y - bw, dPane), at(f, o.t + o.w / 2, y - bw, dPane), at(f, o.t + o.w / 2, y + bw, dPane), at(f, o.t - o.w / 2, y + bw, dPane)); }
    for (let k = 1; k < nx; k++) { const t = o.t - o.w / 2 + o.w * k / nx; if (barT.some(v => Math.abs(v - t) < mw / 2 + bw)) continue; s.quad(c, at(f, t - bw, o.y, dPane), at(f, t + bw, o.y, dPane), at(f, t + bw, spring, dPane), at(f, t - bw, spring, dPane)); }
  }
}

/**
 * Box on the wall from d0 to d1 out of the face: front, top, bottom and (optionally) the two ends; the back lies on the
 * wall and is not drawn. 6 or 10 triangles.
 */
export function slab(s: TriSink, c: string, f: WallFrame, t0: number, t1: number, y0: number, y1: number, d0: number, d1: number, ends = true) {
  const A = (t: number, y: number, d: number) => at(f, t, y, d);
  s.quad(c, A(t0, y0, d1), A(t1, y0, d1), A(t1, y1, d1), A(t0, y1, d1));
  s.quad(c, A(t0, y1, d1), A(t1, y1, d1), A(t1, y1, d0), A(t0, y1, d0));
  s.quad(c, A(t0, y0, d0), A(t1, y0, d0), A(t1, y0, d1), A(t0, y0, d1));
  if (ends) {
    s.quad(c, A(t0, y0, d0), A(t0, y0, d1), A(t0, y1, d1), A(t0, y1, d0));
    s.quad(c, A(t1, y0, d1), A(t1, y0, d0), A(t1, y1, d0), A(t1, y1, d1));
  }
}

/** Horizontal band from t0 to t1 broken by openings: one slab per pier between the openings it crosses. */
export function band(s: TriSink, c: string, f: WallFrame, t0: number, t1: number, y0: number, y1: number, d: number, cuts: Opening[] = []) {
  const spans: P2[] = [];
  for (const o of cuts) {
    const top = o.y + o.h;
    if (top <= y0 || o.y >= y1) continue;
    spans.push([o.t - o.w / 2, o.t + o.w / 2]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let t = t0;
  for (const [a, b] of spans) { if (a > t + 0.02) slab(s, c, f, t, Math.min(a, t1), y0, y1, 0, d); t = Math.max(t, b); }
  if (t1 > t + 0.02) slab(s, c, f, t, t1, y0, y1, 0, d);
}

/** Quoins: alternating long/short stone blocks up a corner or pier edge at t (block faces centred on t). */
export function quoins(s: TriSink, c: string, f: WallFrame, t: number, y0: number, y1: number, course: number, long: number, short: number, d: number, side: 1 | -1 | 0 = 0) {
  let k = 0;
  for (let y = y0; y + course * 0.5 < y1; y += course * 2, k++) {
    const w = k % 2 ? short : long, a = side === 0 ? t - w / 2 : side > 0 ? t : t - w, b = side === 0 ? t + w / 2 : side > 0 ? t + w : t;
    slab(s, c, f, a, b, y, Math.min(y + course, y1), 0, d, false);
  }
}

/** Disc facing out at (t, y), `d` out of the face; `ring` > 0 draws an annulus from r - ring to r instead. */
export function disc(s: TriSink, c: string, f: WallFrame, t: number, y: number, r: number, d: number, segs = 16, ring = 0) {
  for (let i = 0; i < segs; i++) {
    const a0 = 2 * Math.PI * i / segs, a1 = 2 * Math.PI * (i + 1) / segs;
    const P = (a: number, rr: number) => at(f, t + rr * Math.cos(a), y + rr * Math.sin(a), d);
    if (ring > 0) s.quad(c, P(a0, r - ring), P(a0, r), P(a1, r), P(a1, r - ring));
    else s.tri(c, at(f, t, y, d), P(a0, r), P(a1, r));
  }
}

/** A short drum: disc front at d1 plus its rim down to d0 (a medallion or dial standing proud). */
export function drum(s: TriSink, c: string, f: WallFrame, t: number, y: number, r: number, d0: number, d1: number, segs = 16) {
  disc(s, c, f, t, y, r, d1, segs);
  for (let i = 0; i < segs; i++) {
    const a0 = 2 * Math.PI * i / segs, a1 = 2 * Math.PI * (i + 1) / segs;
    s.quad(c, at(f, t + r * Math.cos(a0), y + r * Math.sin(a0), d0), at(f, t + r * Math.cos(a1), y + r * Math.sin(a1), d0), at(f, t + r * Math.cos(a1), y + r * Math.sin(a1), d1), at(f, t + r * Math.cos(a0), y + r * Math.sin(a0), d1));
  }
}

/** A straight bar on the wall face from a to b (t, y), `w` wide, as a front face at d (copings, hands, tracery). */
export function strip(s: TriSink, c: string, f: WallFrame, a: P2, b: P2, w: number, d: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
  s.quad(c, at(f, a[0] - nx, a[1] - ny, d), at(f, b[0] - nx, b[1] - ny, d), at(f, b[0] + nx, b[1] + ny, d), at(f, a[0] + nx, a[1] + ny, d));
}

/**
 * A solid bar from a to b: the strip's front at d1 plus its four sides back to d0, so an iron anchor, a clock hand or a
 * shield's fess stands on the surface behind it instead of floating a plate in front of it (10 triangles).
 */
export function rib(s: TriSink, c: string, f: WallFrame, a: P2, b: P2, w: number, d0: number, d1: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
  plaque(s, c, f, [[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]], d0, d1);
}

/** A raised plaque: the outline's front at d1 with its sides back to d0 (shields, cartouches, oculus lights). */
export function plaque(s: TriSink, c: string, f: WallFrame, outline: P2[], d0: number, d1: number) {
  panel(s, c, f, outline, [], d1);
  const ccw = outline.reduce((v, p, i) => v + p[0] * outline[(i + 1) % outline.length][1] - outline[(i + 1) % outline.length][0] * p[1], 0) > 0;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], q = outline[(i + 1) % outline.length], [a, b] = ccw ? [p, q] : [q, p];
    s.quad(c, at(f, a[0], a[1], d0), at(f, b[0], b[1], d0), at(f, b[0], b[1], d1), at(f, a[0], a[1], d1));
  }
}

/**
 * Coping along a gable edge a -> b: a slanted slab `w` wide and d0..d1 deep (front, top and underside), on the side of
 * the line to the left of a -> b. `back` adds the face at d0 for a coping that stands clear of the wall behind it.
 */
export function coping(s: TriSink, c: string, f: WallFrame, a: P2, b: P2, w: number, d0: number, d1: number, back = false) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
  const A = (p: P2, k: number, d: number) => at(f, p[0] + nx * k, p[1] + ny * k, d);
  s.quad(c, A(a, 0, d1), A(b, 0, d1), A(b, 1, d1), A(a, 1, d1));
  s.quad(c, A(a, 1, d1), A(b, 1, d1), A(b, 1, d0), A(a, 1, d0));
  s.quad(c, A(a, 0, d0), A(b, 0, d0), A(b, 0, d1), A(a, 0, d1));
  if (back) s.quad(c, A(a, 1, d0), A(b, 1, d0), A(b, 0, d0), A(a, 0, d0));
}

/** Ironwork cresting on a line: a strip of spikes (t from t0 to t1 at height y), drawn double-sided by the GLB material. */
export function cresting(s: TriSink, c: string, f: WallFrame, t0: number, t1: number, y: number, h: number, pitch: number, d = 0) {
  const n = Math.max(1, Math.round((t1 - t0) / pitch)), step = (t1 - t0) / n, base = h * 0.35;
  s.quad(c, at(f, t0, y, d), at(f, t1, y, d), at(f, t1, y + base, d), at(f, t0, y + base, d));
  for (let i = 0; i < n; i++) {
    const a = t0 + i * step;
    s.tri(c, at(f, a + step * 0.2, y + base, d), at(f, a + step * 0.8, y + base, d), at(f, a + step * 0.5, y + h, d));
  }
}

// ---- world-axis solids (x along, z across, y up) ---------------------------------------------------------------------

/** Closed axis-aligned box (12 triangles). */
export function box(s: TriSink, c: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const v = (x: number, y: number, z: number): V3 => [x, y, z];
  s.quad(c, v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1));
  s.quad(c, v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0));
  s.quad(c, v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1));
  s.quad(c, v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0));
  s.quad(c, v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0));
  s.quad(c, v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1));
}

/**
 * A closed 2D profile in (z, y), counter-clockwise seen from +x, extruded from x0 to x1 with both end caps: a mansard,
 * a gabled roof or a hipped ridge cut square. `caps` false leaves the ends open (they abut a wall).
 */
export function prismX(s: TriSink, c: string, profile: P2[], x0: number, x1: number, caps: [boolean, boolean] = [true, true]) {
  // Clockwise in a (z right, y up) plot is counter-clockwise seen from +x (z points left there): side faces then face out.
  const pr = signedArea(profile) > 0 ? [...profile].reverse() : profile;
  for (let i = 0; i < pr.length; i++) {
    const a = pr[i], b = pr[(i + 1) % pr.length];
    s.quad(c, [x0, a[1], a[0]], [x0, b[1], b[0]], [x1, b[1], b[0]], [x1, a[1], a[0]]);
  }
  const tris = T.ShapeUtils.triangulateShape(pr.map(p => new T.Vector2(p[0], p[1])), []);
  for (const [a, b, e] of tris) {
    const A = pr[a], B = pr[b], E = pr[e];
    if (caps[1]) triFacing(s, c, [x1, A[1], A[0]], [x1, B[1], B[0]], [x1, E[1], E[0]], [1, 0, 0]);
    if (caps[0]) triFacing(s, c, [x0, A[1], A[0]], [x0, B[1], B[0]], [x0, E[1], E[0]], [-1, 0, 0]);
  }
}

/** The same as `prismX` for a profile in (x, y) extruded along z from z0 to z1 (a gable roof running back from a front). */
export function prismZ(s: TriSink, c: string, profile: P2[], z0: number, z1: number, caps: [boolean, boolean] = [true, true]) {
  // counter-clockwise in an (x right, y up) plot is counter-clockwise seen from +z
  const pr = signedArea(profile) < 0 ? [...profile].reverse() : profile;
  for (let i = 0; i < pr.length; i++) {
    const a = pr[i], b = pr[(i + 1) % pr.length];
    s.quad(c, [a[0], a[1], z1], [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1]);
  }
  const tris = T.ShapeUtils.triangulateShape(pr.map(p => new T.Vector2(p[0], p[1])), []);
  for (const [a, b, e] of tris) {
    const A = pr[a], B = pr[b], E = pr[e];
    if (caps[1]) triFacing(s, c, [A[0], A[1], z1], [B[0], B[1], z1], [E[0], E[1], z1], [0, 0, 1]);
    if (caps[0]) triFacing(s, c, [A[0], A[1], z0], [B[0], B[1], z0], [E[0], E[1], z0], [0, 0, -1]);
  }
}

/**
 * Gabled roof along x (eaves y0 at z front zf and back zb, ridge y1 at zr) with each end either a gable cut square
 * ('gable', closed by a triangle cap), open ('open', it abuts a wall) or hipped back by `hip` metres ('hip').
 */
export function hipRoofX(s: TriSink, c: string, x0: number, x1: number, zf: number, zb: number, y0: number, y1: number, zr: number, ends: ['gable' | 'open' | 'hip', 'gable' | 'open' | 'hip'], hip = 0) {
  const r0 = ends[0] === 'hip' ? x0 + hip : x0, r1 = ends[1] === 'hip' ? x1 - hip : x1;
  s.quad(c, [x0, y0, zf], [x1, y0, zf], [r1, y1, zr], [r0, y1, zr]);
  s.quad(c, [x1, y0, zb], [x0, y0, zb], [r0, y1, zr], [r1, y1, zr]);
  if (ends[0] !== 'open') triFacing(s, c, [x0, y0, zf], [x0, y0, zb], [r0, y1, zr], [-1, ends[0] === 'hip' ? 1 : 0, 0]);
  if (ends[1] !== 'open') triFacing(s, c, [x1, y0, zf], [x1, y0, zb], [r1, y1, zr], [1, ends[1] === 'hip' ? 1 : 0, 0]);
}

/** Only the sides of an opening (from the face to `depth` behind it), for a hole filled by something else. */
export function reveal(s: TriSink, c: string, f: WallFrame, outline: P2[], depth: number) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    s.quad(c, at(f, a[0], a[1], 0), at(f, b[0], b[1], 0), at(f, b[0], b[1], -depth), at(f, a[0], a[1], -depth));
  }
}

/** Triangle wound so its normal points along `dir`. */
export function triFacing(s: TriSink, c: string, a: V3, b: V3, e: V3, dir: V3) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [e[0] - a[0], e[1] - a[1], e[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
  if (Math.abs(dot) < 1e-12 && Math.hypot(n[0], n[1], n[2]) < 1e-12) return;
  if (dot >= 0) s.tri(c, a, b, e); else s.tri(c, a, e, b);
}

/** Frustum / pyramid on an axis-aligned rectangle: base (x0..x1, z0..z1) at y0 to a top rectangle shrunk by `inset` at y1. */
export function frustum(s: TriSink, c: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, inset: number | [number, number], base = false) {
  const [ix, iz] = typeof inset === 'number' ? [inset, inset] : inset;
  const b: V3[] = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
  const t: V3[] = [[x0 + ix, y1, z1 - iz], [x1 - ix, y1, z1 - iz], [x1 - ix, y1, z0 + iz], [x0 + ix, y1, z0 + iz]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (Math.hypot(t[i][0] - t[j][0], t[i][2] - t[j][2]) < 1e-6) s.tri(c, b[i], b[j], t[i]);
    else s.quad(c, b[i], b[j], t[j], t[i]);
  }
  if (Math.abs(x1 - x0 - 2 * ix) > 1e-6 && Math.abs(z1 - z0 - 2 * iz) > 1e-6) s.quad(c, t[0], t[1], t[2], t[3]);
  if (base) s.quad(c, b[3], b[2], b[1], b[0]);
}

/** n-sided prism or cone (r1 = 0) standing at (x, z) from y0 to y1, rotated so a face looks along +z. */
export function spire(s: TriSink, c: string, x: number, z: number, y0: number, y1: number, r0: number, r1: number, sides = 8, base = false) {
  const P = (i: number, r: number, y: number): V3 => { const a = (i + 0.5) / sides * Math.PI * 2; return [x + r * Math.sin(a), y, z + r * Math.cos(a)]; };
  for (let i = 0; i < sides; i++) {
    if (r1 <= 1e-6) s.tri(c, P(i, r0, y0), P(i + 1, r0, y0), [x, y1, z]);
    else s.quad(c, P(i, r0, y0), P(i + 1, r0, y0), P(i + 1, r1, y1), P(i, r1, y1));
  }
  if (r1 > 1e-6) for (let i = 1; i + 1 < sides; i++) s.tri(c, P(0, r1, y1), P(i, r1, y1), P(i + 1, r1, y1));
  if (base) for (let i = 1; i + 1 < sides; i++) s.tri(c, P(0, r0, y0), P(i + 1, r0, y0), P(i, r0, y0));
}

/** Triangles of a sink as a flat position array per colour, in insertion order (deterministic). */
export function sinkArrays(s: TriSink): [string, Float32Array][] {
  return [...s.tris.entries()].map(([c, v]) => [c, Float32Array.from(v)]);
}
