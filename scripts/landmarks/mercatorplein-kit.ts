/**
 * Hand geometry shared by the two Mercatorplein tower builders (Berlage 1925-27; the north tower rebuilt 1995-98): brick
 * blocks with cut windows, the gatehouse over an underpass with its chamfered head in a stepped render frame, three-sided
 * erkers with stone caps, the steep tiled gate roof with its glazed eaves strip, balconies in the tower angles, clock
 * dials, and the iron hoist beams with double scrolls on the parapets. The measures are in the two builders
 * (rectified panorama crops on a metre grid, 3DBAG LoD2.2 heights, Commons photos; docs/mercatorplein-20261014.md).
 *
 * Coordinates: the square's axes. `u` runs along bearing 74 deg (the square's long side), `n` along 344 deg (towards the
 * square's north side), `h` up from the 3DBAG ground; origin = the pand's BAG footprint vertex average (the large tier's
 * origin), so hand parts and the 3DBAG/kit parts share one frame. Landmark local axes: x east, y up, z south.
 *
 * Every part is a closed solid, or a wall face whose openings are lined by reveals and backed by glass, written into a
 * MeshBuilder slot named after the landmark palette colour it takes.
 */
import * as T from 'three';
import {MeshBuilder, type V3} from '../../src/canalRecall/blockBuilding/mesh.ts';
import type {Panel} from '../../src/canalRecall/blockBuilding/panels.ts';
import type {CompiledLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';

export type Slot = 'brick' | 'concrete' | 'greyBrick' | 'frame' | 'white' | 'glass' | 'dark' | 'slate' | 'stone' | 'red';
export type UV = [number, number];

const D2R = Math.PI / 180;
const SU = Math.sin(74 * D2R), CU = Math.cos(74 * D2R), SN = Math.sin(344 * D2R), CN = Math.cos(344 * D2R);
/** (u, n, h) in the square's axes -> landmark local (x east, y up, z south). */
export const P = (u: number, n: number, h: number): V3 => [u * SU + n * SN, h, -(u * CU + n * CN)];
/** a direction (du, dn, dh) -> local vector */
const dir = (du: number, dn: number, dh = 0): V3 => [du * SU + dn * SN, dh, -(du * CU + dn * CN)];
/** local (x, z) -> (u, n) */
export const toUN = (x: number, z: number): UV => [x * SU - z * CU, x * SN - z * CN];
const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];

/**
 * A vertical face seen from outside: `o` = its origin in (u, n), `r` = unit (u, n) vector to the viewer's right,
 * `out` = outward normal. Points on it are (s along r, h up, d out).
 */
export interface Face { o: UV; r: UV; out: UV }
/** The face on the plane n = `n` facing `side` (-1: towards -n, +1: towards +n), and s(u) on it. */
export function nFace(n: number, side: 1 | -1): {f: Face; s: (u: number) => number} {
  return side < 0 ? {f: {o: [0, n], r: [1, 0], out: [0, -1]}, s: u => u} : {f: {o: [0, n], r: [-1, 0], out: [0, 1]}, s: u => -u};
}
/** The face on the plane u = `u` facing `side`, and s(n) on it. */
export function uFace(u: number, side: 1 | -1): {f: Face; s: (n: number) => number} {
  return side > 0 ? {f: {o: [u, 0], r: [0, 1], out: [1, 0]}, s: n => n} : {f: {o: [u, 0], r: [0, -1], out: [-1, 0]}, s: n => -n};
}
export const F = (f: Face, s: number, h: number, d = 0): V3 => P(f.o[0] + f.r[0] * s + f.out[0] * d, f.o[1] + f.r[1] * s + f.out[1] * d, h);
const fOut = (f: Face): V3 => dir(f.out[0], f.out[1]);
const fR = (f: Face): V3 => dir(f.r[0], f.r[1]);

export function area(p: UV[]): number { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
const ccw = (p: UV[]) => (area(p) > 0 ? p : [...p].reverse());
const cw = (p: UV[]) => (area(p) < 0 ? p : [...p].reverse());
export const rect = (s0: number, s1: number, h0: number, h1: number): UV[] => [[Math.min(s0, s1), h0], [Math.max(s0, s1), h0], [Math.max(s0, s1), h1], [Math.min(s0, s1), h1]];

/** A window (or door) in a face, in face s, with its glazing pattern (bars at fractions of the width / height). */
export interface Win { s0: number; s1: number; h0: number; h1: number; mull?: number[]; rows?: number[]; door?: boolean }

export class Hand {
  m = new MeshBuilder();
  part() { return this.m.newPart(); }
  get triangles() { return this.m.triangles; }

  /** Closed box in a face's frame: s0..s1 along it, h0..h1, d0..d1 out of it. */
  boxF(slot: Slot, f: Face, s0: number, s1: number, h0: number, h1: number, d0: number, d1: number, part = this.part()) {
    const q = (s: number, h: number, d: number) => F(f, s, h, d), o = fOut(f), r = fR(f);
    this.m.quad(slot, q(s0, h0, d1), q(s1, h0, d1), q(s1, h1, d1), q(s0, h1, d1), part, o);
    this.m.quad(slot, q(s0, h0, d0), q(s1, h0, d0), q(s1, h1, d0), q(s0, h1, d0), part, neg(o));
    this.m.quad(slot, q(s0, h1, d0), q(s1, h1, d0), q(s1, h1, d1), q(s0, h1, d1), part, UP);
    this.m.quad(slot, q(s0, h0, d0), q(s1, h0, d0), q(s1, h0, d1), q(s0, h0, d1), part, DOWN);
    this.m.quad(slot, q(s0, h0, d0), q(s0, h1, d0), q(s0, h1, d1), q(s0, h0, d1), part, neg(r));
    this.m.quad(slot, q(s1, h0, d0), q(s1, h1, d0), q(s1, h1, d1), q(s1, h0, d1), part, r);
    return part;
  }

  /** Closed prism over a simple plan polygon in (u, n) from h0 to h1. */
  prism(slot: Slot, plan: UV[], h0: number, h1: number, part = this.part(), sideSlot?: Slot) {
    const c = ccw(plan);
    for (const t of T.ShapeUtils.triangulateShape(c.map(p => new T.Vector2(p[0], p[1])), [])) {
      const [a, b, d] = t.map(i => c[i]);
      this.m.tri(slot, P(a[0], a[1], h1), P(b[0], b[1], h1), P(d[0], d[1], h1), part, UP);
      this.m.tri(slot, P(a[0], a[1], h0), P(b[0], b[1], h0), P(d[0], d[1], h0), part, DOWN);
    }
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length], du = b[0] - a[0], dn = b[1] - a[1];
      this.m.quad(sideSlot ?? slot, P(a[0], a[1], h0), P(b[0], b[1], h0), P(b[0], b[1], h1), P(a[0], a[1], h1), part, dir(dn, -du));
    }
    return part;
  }

  /** A wall face: an outline polygon in (s, h) with holes, lying on the face plane, facing out. */
  wall(slot: Slot, f: Face, outline: UV[], holes: UV[][] = [], part = this.part()) {
    const o = ccw(outline), hs = holes.map(cw), all = [...o, ...hs.flat()];
    for (const t of T.ShapeUtils.triangulateShape(o.map(p => new T.Vector2(p[0], p[1])), hs.map(h => h.map(p => new T.Vector2(p[0], p[1]))))) {
      const [a, b, c] = t.map(i => all[i]);
      this.m.tri(slot, F(f, a[0], a[1]), F(f, b[0], b[1]), F(f, c[0], c[1]), part, fOut(f));
    }
    return part;
  }

  /** A plate standing d0..d1 out of a face: an outline in (s, h) with holes; front, back and every edge closed. */
  plate(slot: Slot, f: Face, outline: UV[], holes: UV[][], d0: number, d1: number, part = this.part()) {
    const o = ccw(outline), hs = holes.map(cw), all = [...o, ...hs.flat()], out = fOut(f), r = fR(f);
    for (const t of T.ShapeUtils.triangulateShape(o.map(p => new T.Vector2(p[0], p[1])), hs.map(h => h.map(p => new T.Vector2(p[0], p[1]))))) {
      const [a, b, c] = t.map(i => all[i]);
      this.m.tri(slot, F(f, a[0], a[1], d1), F(f, b[0], b[1], d1), F(f, c[0], c[1], d1), part, out);
      this.m.tri(slot, F(f, a[0], a[1], d0), F(f, b[0], b[1], d0), F(f, c[0], c[1], d0), part, neg(out));
    }
    // edge walls face right of the edge: outward for the CCW outline, into the hole for CW holes
    for (const ring of [o, ...hs]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], ds = b[0] - a[0], dh = b[1] - a[1];
      this.m.quad(slot, F(f, a[0], a[1], d0), F(f, b[0], b[1], d0), F(f, b[0], b[1], d1), F(f, a[0], a[1], d1), part, [r[0] * dh, -ds, r[2] * dh]);
    }
    return part;
  }

  /** Reveals of an opening outline (s, h) cut `depth` into the face, each facing into the opening. */
  reveal(f: Face, outline: UV[], depth: number, slot: Slot, part = this.part()) {
    const o = ccw(outline), r = fR(f);
    for (let i = 0; i < o.length; i++) {
      const a = o[i], b = o[(i + 1) % o.length], ds = b[0] - a[0], dh = b[1] - a[1];
      this.m.quad(slot, F(f, a[0], a[1], 0), F(f, b[0], b[1], 0), F(f, b[0], b[1], -depth), F(f, a[0], a[1], -depth), part, [r[0] * -dh, ds, r[2] * -dh]);
    }
    return part;
  }

  /**
   * A window (or door) cut into a face: reveals `depth` deep, a frame ring and glass (a dark panel for doors) at the back,
   * glazing bars as closed boxes 3.5 cm proud of the glass. Returns the hole for the face's wall.
   */
  window(f: Face, w: Win, opts: {fw?: number; depth?: number; wallSlot?: Slot} = {}): UV[] {
    const {s0, s1, h0, h1} = w, fw = opts.fw ?? 0.07, dp = opts.depth ?? 0.15, hole = rect(s0, s1, h0, h1);
    const part = this.reveal(f, hole, dp, opts.wallSlot ?? 'brick');
    const fr: Slot = w.door ? 'dark' : 'frame', g: Slot = w.door ? 'dark' : 'glass', d = -dp, o = fOut(f);
    const q = (a: number, b: number, c: number, e: number, slot: Slot) => this.m.quad(slot, F(f, a, c, d), F(f, b, c, d), F(f, b, e, d), F(f, a, e, d), part, o);
    q(s0, s1, h0, h0 + fw, fr); q(s0, s1, h1 - fw, h1, fr); q(s0, s0 + fw, h0 + fw, h1 - fw, fr); q(s1 - fw, s1, h0 + fw, h1 - fw, fr);
    q(s0 + fw, s1 - fw, h0 + fw, h1 - fw, g);
    const bw = Math.max(0.05, fw * 0.8), bars = this.part();
    for (const k of w.mull ?? []) { const s = s0 + (s1 - s0) * k; this.boxF('frame', f, s - bw / 2, s + bw / 2, h0 + fw, h1 - fw, d, d + 0.035, bars); }
    for (const k of w.rows ?? []) { const h = h0 + (h1 - h0) * k; this.boxF('frame', f, s0 + fw, s1 - fw, h - bw / 2, h + bw / 2, d, d + 0.035, bars); }
    return hole;
  }

  /** A face outline (s, h) with these windows cut in. */
  facade(slot: Slot, f: Face, outline: UV[], wins: Win[], depth = 0.15, fw?: number) {
    const holes = wins.map(w => this.window(f, w, {depth, wallSlot: slot, fw}));
    return this.wall(slot, f, outline, holes);
  }

  /** A closed slab of thickness t under the quad a-b-c-d (roof slopes), its top facing up. */
  slab(slot: Slot, q: V3[], t: number, part = this.part()) {
    const [a, b, c, d] = q, down = (p: V3): V3 => [p[0], p[1] - t, p[2]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nrm: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (nrm[1] < 0) nrm = neg(nrm);
    this.m.quad(slot, a, b, c, d, part, nrm);
    this.m.quad(slot, down(a), down(b), down(c), down(d), part, neg(nrm));
    const cen = [(a[0] + c[0]) / 2, (a[2] + c[2]) / 2];
    for (const [p, r] of [[a, b], [b, c], [c, d], [d, a]] as [V3, V3][]) this.m.quad(slot, p, r, down(r), down(p), part, [(p[0] + r[0]) / 2 - cen[0], 0, (p[2] + r[2]) / 2 - cen[1]]);
    return part;
  }
}

/** Chamfered opening outline (CCW in (s, h)): jambs to `spring`, straight shoulders `chamfer` in, flat head at `head`. */
export function chamferedOutline(s0: number, s1: number, h0: number, spring: number, head: number, chamfer: number): UV[] {
  return [[s0, h0], [s1, h0], [s1, spring], [s1 - chamfer, head], [s0 + chamfer, head], [s0, spring]];
}

// ---- parts ---------------------------------------------------------------------------------------------------------

/** A closed square bar from a to b in the face plane (s, h), centred `d` out, `t` thick. */
function bar(H: Hand, f: Face, a: UV, b: UV, d: number, t: number, slot: Slot, part: number) {
  const ds = b[0] - a[0], dh = b[1] - a[1], l = Math.hypot(ds, dh) || 1, ns = -dh / l * t / 2, nh = ds / l * t / 2;
  const c = (p: UV, sg: number, dd: number) => F(f, p[0] + ns * sg, p[1] + nh * sg, d + dd);
  const A = [c(a, -1, -t / 2), c(b, -1, -t / 2), c(b, 1, -t / 2), c(a, 1, -t / 2)], B = [c(a, -1, t / 2), c(b, -1, t / 2), c(b, 1, t / 2), c(a, 1, t / 2)];
  const o = fOut(f), r = fR(f), side = (sg: number): V3 => [r[0] * ns * sg, nh * sg, r[2] * ns * sg], along = (sg: number): V3 => [r[0] * ds * sg, dh * sg, r[2] * ds * sg];
  H.m.quad(slot, B[0], B[1], B[2], B[3], part, o); H.m.quad(slot, A[0], A[1], A[2], A[3], part, neg(o));
  H.m.quad(slot, A[0], A[1], B[1], B[0], part, side(-1)); H.m.quad(slot, A[3], A[2], B[2], B[3], part, side(1));
  H.m.quad(slot, A[0], A[3], B[3], B[0], part, along(-1)); H.m.quad(slot, A[1], A[2], B[2], B[1], part, along(1));
}

/**
 * Hoist beam (hijsbalk) with its iron: a dark beam stub out of the wall under the parapet top, an iron post rising
 * through it, and two curled scrolls (ram's horns) turning outwards from the post top, in the face plane.
 */
export function hoistBeam(H: Hand, f: Face, s: number, top: number) {
  const part = H.boxF('dark', f, s - 0.09, s + 0.09, top - 0.62, top - 0.42, 0, 0.6);
  H.boxF('dark', f, s - 0.03, s + 0.03, top - 0.42, top + 0.7, 0.47, 0.53, part);
  for (const side of [-1, 1]) {
    const cs = s + side * 0.16, ch = top + 0.52, pts: UV[] = [[s, top + 0.7]];
    for (let k = 0; k <= 9; k++) { const th = Math.PI - (k / 9) * Math.PI * 1.6, r = 0.16 * (1 - 0.55 * k / 9); pts.push([cs + side * Math.cos(th) * r, ch + Math.sin(th) * r]); }
    for (let k = 0; k + 1 < pts.length; k++) bar(H, f, pts[k], pts[k + 1], 0.5, 0.035, 'dark', part);
  }
}

/** Clock dial: a white disc 6 cm proud, twelve dark hour bars and two hands, centred at (s, h) on the face. */
export function clockDial(H: Hand, f: Face, s: number, h: number, radius: number) {
  const n = 24, part = H.part(), o = fOut(f), r = fR(f), d0 = 0, d1 = 0.06;
  for (let i = 0; i < n; i++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, p: UV = [s + Math.cos(a0) * radius, h + Math.sin(a0) * radius], q: UV = [s + Math.cos(a1) * radius, h + Math.sin(a1) * radius];
    H.m.tri('white', F(f, s, h, d1), F(f, p[0], p[1], d1), F(f, q[0], q[1], d1), part, o);
    H.m.tri('white', F(f, s, h, d0), F(f, p[0], p[1], d0), F(f, q[0], q[1], d0), part, neg(o));
    const am = (a0 + a1) / 2;
    H.m.quad('white', F(f, p[0], p[1], d0), F(f, q[0], q[1], d0), F(f, q[0], q[1], d1), F(f, p[0], p[1], d1), part, [r[0] * Math.cos(am), Math.sin(am), r[2] * Math.cos(am)]);
  }
  const marks = H.part();
  for (let k = 0; k < 12; k++) {
    const a = 2 * Math.PI * k / 12, r0 = radius * (k % 3 === 0 ? 0.62 : 0.72), r1 = radius * 0.9;
    bar(H, f, [s + Math.cos(a) * r0, h + Math.sin(a) * r0], [s + Math.cos(a) * r1, h + Math.sin(a) * r1], d1 + 0.04, radius * (k % 3 === 0 ? 0.1 : 0.06), 'dark', marks);
  }
  bar(H, f, [s, h], [s + Math.cos(150 * D2R) * radius * 0.5, h + Math.sin(150 * D2R) * radius * 0.5], d1 + 0.04, radius * 0.08, 'dark', marks);
  bar(H, f, [s, h], [s + Math.cos(40 * D2R) * radius * 0.78, h + Math.sin(40 * D2R) * radius * 0.78], d1 + 0.1, radius * 0.06, 'dark', marks);
}

/**
 * A three-sided erker on face f: base s0..s1 on the wall, front face `front` wide and `depth` out, a brick body from h0 to
 * h1 with one window per face per storey (frames, glass, transoms), a stone slab cap on top.
 */
export interface ErkerSpec { s0: number; s1: number; front: number; depth: number; h0: number; h1: number; storeys: {h0: number; h1: number; rows?: number[]}[]; cap: {t: number; over: number}; lightsFront?: number }
export function erker(H: Hand, f: Face, e: ErkerSpec) {
  const mid = (e.s0 + e.s1) / 2, half = e.front / 2, lf = e.lightsFront ?? 1;
  const pts: UV[] = [[e.s0, 0], [mid - half, e.depth], [mid + half, e.depth], [e.s1, 0]];
  const un = (p: UV): UV => [f.o[0] + f.r[0] * p[0] + f.out[0] * p[1], f.o[1] + f.r[1] * p[0] + f.out[1] * p[1]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = un(pts[i]), b = un(pts[i + 1]), du = b[0] - a[0], dn = b[1] - a[1], len = Math.hypot(du, dn);
    const g: Face = {o: a, r: [du / len, dn / len], out: [dn / len, -du / len]};
    if (g.out[0] * f.out[0] + g.out[1] * f.out[1] < 0) g.out = [-g.out[0], -g.out[1]];
    const m = Math.min(0.12, len * 0.1), mull = i === 1 && lf > 1 ? Array.from({length: lf - 1}, (_, k) => (k + 1) / lf) : [];
    // the erkers' white frames are what reads at a distance: 10 cm frame rings
    H.facade('brick', g, rect(0, len, e.h0, e.h1), e.storeys.map(st => ({s0: m, s1: len - m, h0: st.h0, h1: st.h1, rows: st.rows, mull})), 0.08, 0.1);
  }
  const plan = pts.map(un);
  H.prism('brick', plan, e.h0 - 0.12, e.h0);
  const grow = (p: UV): UV => [p[0] + Math.sign(p[0] - mid) * e.cap.over * (p[1] > 0 ? 0.5 : 1), p[1] > 0 ? p[1] + e.cap.over : 0];
  H.prism('stone', pts.map(grow).map(un), e.h1, e.h1 + e.cap.t);
}

type Side = 'S' | 'N' | 'W' | 'E';
/** Faces of a block side: S is n = n0 facing -n, N is n = n1 facing +n, W is u = u0 facing -u, E is u = u1 facing +u. */
export function sideFace(side: Side, b: {u0: number; u1: number; n0: number; n1: number}) {
  return side === 'S' ? nFace(b.n0, -1) : side === 'N' ? nFace(b.n1, 1) : side === 'W' ? uFace(b.u0, -1) : uFace(b.u1, 1);
}
export interface BlockWin { a: number; b: number; h0: number; h1: number; mull?: number[]; rows?: number[]; door?: boolean }
/** A flat-roofed brick block: walls with windows on the listed sides, a flat roof and a coping. */
export interface BlockSpec {
  u0: number; u1: number; n0: number; n1: number; h0: number; h1: number;
  /** windows per side, a..b in u (S/N) or n (W/E), h absolute */
  wins?: Partial<Record<Side, BlockWin[]>>;
  /** sides drawn (default all four) */
  sides?: Side[];
  /** draw a side only from this height up (below it a neighbour hides it) */
  from?: Partial<Record<Side, number>>;
  roof?: boolean; coping?: boolean; slot?: Slot;
}
export function block(H: Hand, b: BlockSpec) {
  const slot = b.slot ?? 'brick';
  for (const side of b.sides ?? ['S', 'N', 'W', 'E']) {
    const {f, s} = sideFace(side, b);
    const [a, z] = side === 'S' || side === 'N' ? [s(b.u0), s(b.u1)] : [s(b.n0), s(b.n1)];
    const h0 = Math.max(b.h0, b.from?.[side] ?? b.h0);
    const wins: Win[] = (b.wins?.[side] ?? []).map(w => { const [p, q] = [s(w.a), s(w.b)].sort((x, y) => x - y); return {s0: p, s1: q, h0: w.h0, h1: w.h1, mull: w.mull, rows: w.rows, door: w.door}; });
    H.facade(slot, f, rect(a, z, h0, b.h1), wins);
  }
  if (b.roof !== false) H.prism('slate', [[b.u0, b.n0], [b.u1, b.n0], [b.u1, b.n1], [b.u0, b.n1]], b.h1 - 0.02, b.h1);
  if (b.coping) {
    const t = 0.2, o = 0.05;
    for (const [u0, u1, n0, n1] of [[b.u0 - o, b.u1 + o, b.n0 - o, b.n0 + t], [b.u0 - o, b.u1 + o, b.n1 - t, b.n1 + o], [b.u0 - o, b.u0 + t, b.n0 + t, b.n1 - t], [b.u1 - t, b.u1 + o, b.n0 + t, b.n1 - t]])
      H.prism('stone', [[u0, n0], [u1, n0], [u1, n1], [u0, n1]], b.h1, b.h1 + 0.18);
  }
}

/** Gatehouse over an underpass (each Mercatorplein tower stands at the end of one). */
export interface GateSpec {
  u0: number; u1: number; nFront: number; nRear: number;
  /** the front faces +n (1) or -n (-1) */
  side: 1 | -1;
  eavesFront: number; eavesRear: number; ridge: number; ridgeFront: number; ridgeRear: number;
  portal: {u0: number; u1: number; spring: number; head: number; chamfer: number};
  /** stepped render frame round the portal: reach beyond the jambs, shoulder height, crown inset from the jambs and height; clamped to uMin..uMax */
  frame: {reach: number; shoulder: number; inset: number; crown: number; uMin: number; uMax: number};
  plinth: number; band: [number, number];
  erker: {u0: number; u1: number; front: number; depth: number; h0: number; h1: number; win: [number, number]; capT: number};
  windows: {u0: number; u1: number; h0: number; h1: number}[];
  doors: {u0: number; u1: number; h1: number}[];
  dormer?: {u0: number; u1: number; h0: number; h1: number; nFace: number};
  ends: ('W' | 'E')[];
}
export function gatehouse(H: Hand, g: GateSpec) {
  const p = g.portal;
  for (const [n, side, eaves] of [[g.nFront, g.side, g.eavesFront], [g.nRear, -g.side as 1 | -1, g.eavesRear]] as [number, 1 | -1, number][]) {
    const {f, s} = nFace(n, side), sr = (a: number, b: number) => [s(a), s(b)].sort((x, y) => x - y);
    const [a, z] = sr(g.u0, g.u1), [p0, p1] = sr(p.u0, p.u1);
    const outline: UV[] = [[a, 0], [p0, 0], [p0, p.spring], [p0 + p.chamfer, p.head], [p1 - p.chamfer, p.head], [p1, p.spring], [p1, 0], [z, 0], [z, eaves], [a, eaves]];
    const wins: Win[] = [...g.windows.map(w => { const [s0, s1] = sr(w.u0, w.u1); return {s0, s1, h0: w.h0, h1: w.h1, mull: [0.5], rows: [0.5]}; }),
      ...g.doors.map(d => { const [s0, s1] = sr(d.u0, d.u1); return {s0, s1, h0: 0.06, h1: d.h1, door: true}; })];
    H.wall('brick', f, outline, wins.map(w => H.window(f, w)));
    // stepped render frame round the portal (8 cm proud), a dark course on its crown
    const [m0, m1] = sr(g.frame.uMin, g.frame.uMax), f0 = Math.max(m0, p0 - g.frame.reach), f1 = Math.min(m1, p1 + g.frame.reach);
    H.plate('concrete', f, [[f0, 0], [p0, 0], [p0, p.spring], [p0 + p.chamfer, p.head], [p1 - p.chamfer, p.head], [p1, p.spring], [p1, 0], [f1, 0], [f1, g.frame.shoulder], [p1 - g.frame.inset, g.frame.shoulder], [p1 - g.frame.inset, g.frame.crown], [p0 + g.frame.inset, g.frame.crown], [p0 + g.frame.inset, g.frame.shoulder], [f0, g.frame.shoulder]], [], 0, 0.08);
    H.boxF('dark', f, p0 + g.frame.inset, p1 - g.frame.inset, g.frame.crown, g.frame.crown + 0.12, 0, 0.1);
    // plinth (doors cut through it) and render band either side of the frame
    for (const [b0, b1] of [[a, f0], [f1, z]]) {
      if (b1 - b0 < 0.05) continue;
      plinthWithDoors(H, f, b0, b1, g.plinth, wins.filter(w => w.door && w.s0 >= b0 && w.s1 <= b1));
      H.plate('concrete', f, rect(b0, b1, g.band[0], g.band[1]), [], 0, BAND_OUT);
    }
    const e = g.erker, [e0, e1] = sr(e.u0, e.u1);
    erker(H, f, {s0: e0, s1: e1, front: e.front, depth: e.depth, h0: e.h0, h1: e.h1, storeys: [{h0: e.win[0], h1: e.win[1], rows: [0.5]}], cap: {t: e.capT, over: 0.12}, lightsFront: 3});
    H.boxF('white', f, a - 0.25, z + 0.25, eaves - 0.25, eaves, 0, 0.14);
  }
  // the underpass: jambs, shoulders and soffit from the front plane to the rear, facing into the passage
  const q = chamferedOutline(p.u0, p.u1, 0, p.spring, p.head, p.chamfer), part = H.part();
  for (let i = 1; i <= 5; i++) {
    const a = q[i], b = q[(i + 1) % 6], du = b[0] - a[0], dh = b[1] - a[1];
    H.m.quad(Math.abs(du) < 1e-9 ? 'greyBrick' : 'concrete', P(a[0], g.nFront, a[1]), P(b[0], g.nFront, b[1]), P(b[0], g.nRear, b[1]), P(a[0], g.nRear, a[1]), part, dir(-dh, 0, du));
  }
  // end walls up to the roof line
  const lo = g.nFront < g.nRear, ln = Math.min(g.nFront, g.nRear), hn = Math.max(g.nFront, g.nRear);
  const eLo = lo ? g.eavesFront : g.eavesRear, eHi = lo ? g.eavesRear : g.eavesFront, rLo = lo ? g.ridgeFront : g.ridgeRear, rHi = lo ? g.ridgeRear : g.ridgeFront;
  for (const end of g.ends) {
    const {f, s} = end === 'W' ? uFace(g.u0, -1) : uFace(g.u1, 1);
    H.wall('brick', f, [[s(ln), 0], [s(hn), 0], [s(hn), eHi], [s(rHi), g.ridge], [s(rLo), g.ridge], [s(ln), eLo]]);
  }
  // roof: two slopes and the flat top as slabs overhanging the walls; a glazed strip along both eaves
  const U0 = g.u0 - 0.15, U1 = g.u1 + 0.15, over = 0.3;
  const slope = (n0: number, e0: number, n1: number, e1: number) => {
    const k = (e1 - e0) / Math.abs(n1 - n0), dn = Math.sign(n1 - n0), nE = n0 - dn * over, hE = e0 - k * over;
    H.slab('slate', [P(U0, nE, hE + 0.18), P(U1, nE, hE + 0.18), P(U1, n1, e1 + 0.18), P(U0, n1, e1 + 0.18)], 0.18);
    // the glazed strip stands 20 cm (vertically) over the tiles, 10 cm thick, clear of the audit's z-fight band
    const run = Math.abs(n1 - nE), t0 = 0.45 / run, t1 = 1.25 / run, at = (t: number): [number, number] => [nE + (n1 - nE) * t, hE + (e1 - hE) * t + 0.18 + 0.2];
    const [na, ha] = at(t0), [nb, hb] = at(t1);
    H.slab('glass', [P(U0 + 0.5, na, ha), P(U1 - 0.5, na, ha), P(U1 - 0.5, nb, hb), P(U0 + 0.5, nb, hb)], 0.1);
  };
  slope(g.nFront, g.eavesFront, g.ridgeFront, g.ridge);
  slope(g.nRear, g.eavesRear, g.ridgeRear, g.ridge);
  H.slab('slate', [P(U0, g.ridgeFront, g.ridge + 0.18), P(U1, g.ridgeFront, g.ridge + 0.18), P(U1, g.ridgeRear, g.ridge + 0.18), P(U0, g.ridgeRear, g.ridge + 0.18)], 0.18);
  if (g.dormer) {
    // a low dormer on the front slope: front face with three lights at n = nFace, cheeks and a flat lid back to the ridge
    const d = g.dormer, {f, s} = nFace(d.nFace, g.side), [a, z] = [s(d.u0), s(d.u1)].sort((x, y) => x - y), w = (z - a) / 3;
    H.facade('brick', f, rect(a, z, d.h0, d.h1), [0, 1, 2].map(k => ({s0: a + w * k + 0.08, s1: a + w * (k + 1) - 0.08, h0: d.h0 + 0.15, h1: d.h1 - 0.12})), 0.08);
    for (const [end, uu] of [['W', d.u0], ['E', d.u1]] as const) { const {f: ff, s: ss} = uFace(uu, end === 'W' ? -1 : 1); H.wall('brick', ff, rect(ss(d.nFace), ss(g.ridgeFront), d.h0, d.h1)); }
    H.prism('slate', [[d.u0 - 0.1, d.nFace + g.side * 0.1], [d.u1 + 0.1, d.nFace + g.side * 0.1], [d.u1 + 0.1, g.ridgeFront], [d.u0 - 0.1, g.ridgeFront]], d.h1, d.h1 + 0.12);
  }
}

/** Plates stand clear of the wall they lie on by more than the audit's 3 cm z-fight band. */
export const PLINTH_OUT = 0.05, BAND_OUT = 0.06;
/** Dark brick plinth plate (5 cm proud) from b0 to b1 up to `top`, with the doors cut through it. */
export function plinthWithDoors(H: Hand, f: Face, b0: number, b1: number, top: number, doors: Win[]) {
  const outline: UV[] = [[b0, 0]];
  for (const d of [...doors].sort((x, y) => x.s0 - y.s0)) outline.push([d.s0, 0], [d.s0, Math.min(d.h1, top - 0.08)], [d.s1, Math.min(d.h1, top - 0.08)], [d.s1, 0]);
  outline.push([b1, 0], [b1, top], [b0, top]);
  H.plate('greyBrick', f, outline, [], 0, PLINTH_OUT);
}

/** Quarter-round balcony in a re-entrant angle: centre (u, n), the quarter towards (su, sn); white slab and a solid brick parapet. */
export function cornerBalcony(H: Hand, u: number, n: number, su: 1 | -1, sn: 1 | -1, r: number, h: number) {
  const arc = (rad: number): UV[] => Array.from({length: 7}, (_, k) => { const a = (k / 6) * Math.PI / 2; return [u + su * Math.cos(a) * rad, n + sn * Math.sin(a) * rad]; });
  H.prism('white', [[u, n], ...arc(r)], h - 0.16, h);
  H.prism('brick', [...arc(r), ...arc(r - 0.12).reverse()], h, h + 1.0);
}

/**
 * A window laid on a kit wall the builder cannot cut (the kit owns that wall): a cream frame ring 9 cm proud, the glass
 * 3-5 cm proud inside it, glazing bars and a stone sill, all closed boxes.
 */
export function proudWindow(H: Hand, f: Face, w: Win) {
  const {s0, s1, h0, h1} = w, fw = 0.1, part = H.part();
  H.boxF('glass', f, s0 + fw, s1 - fw, h0 + fw, h1 - fw, 0.03, 0.05, part);
  H.boxF('frame', f, s0, s1, h0, h0 + fw, 0, 0.09, part); H.boxF('frame', f, s0, s1, h1 - fw, h1, 0, 0.09, part);
  H.boxF('frame', f, s0, s0 + fw, h0 + fw, h1 - fw, 0, 0.09, part); H.boxF('frame', f, s1 - fw, s1, h0 + fw, h1 - fw, 0, 0.09, part);
  for (const k of w.mull ?? []) { const s = s0 + (s1 - s0) * k; H.boxF('frame', f, s - 0.03, s + 0.03, h0 + fw, h1 - fw, 0.05, 0.085, part); }
  for (const k of w.rows ?? []) { const h = h0 + (h1 - h0) * k; H.boxF('frame', f, s0 + fw, s1 - fw, h - 0.03, h + 0.03, 0.05, 0.085, part); }
  H.boxF('stone', f, s0 - 0.05, s1 + 0.05, h0 - 0.08, h0, 0, 0.12, part);
}

// ---- assembly ------------------------------------------------------------------------------------------------------

/** A kit wall panel as a Face (its u is the face's s, v the height). */
export function panelFace(p: Panel): Face { return {o: toUN(p.o[0], p.o[2]), r: toUN(p.r[0], p.r[2]), out: toUN(p.n[0], p.n[2])}; }

/** Block-kit slot (recipe material slot) -> Mercatorplein palette name: the arcade's render band is concrete, its piers dark brick. */
const KIT_PALETTE: Record<string, string> = {brick: 'brick', stucco: 'white', stone: 'concrete', glass: 'glass', frame: 'frame', door: 'greyBrick', accent: 'red', slate: 'slate', roofTile: 'slate', bitumen: 'slate'};

export interface Assembled { kitTriangles: number; droppedTriangles: number; handTriangles: number }
/**
 * Emit the compiled kit building without the triangles whose centroid lies in the hand-built region (`drop(u, n, h)`)
 * or below the ground, then the hand mesh, each slot as one geometry in its palette colour.
 */
export function assemble(built: CompiledLargeBuilding, H: Hand, drop: (u: number, n: number, h: number) => boolean, add: (g: T.BufferGeometry, colour: string) => void): Assembled {
  let kitTriangles = 0, droppedTriangles = 0;
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const name = KIT_PALETTE[o.userData.materialSlot as string];
    if (!name) throw Error(`mercatorplein: no palette colour for materialSlot ${o.userData.materialSlot}`);
    const src = o.geometry as T.BufferGeometry, g = src.index ? src.toNonIndexed() : src, a = g.getAttribute('position'), keep: number[] = [];
    for (let i = 0; i < a.count; i += 3) {
      const cx = (a.getX(i) + a.getX(i + 1) + a.getX(i + 2)) / 3, cy = (a.getY(i) + a.getY(i + 1) + a.getY(i + 2)) / 3, cz = (a.getZ(i) + a.getZ(i + 1) + a.getZ(i + 2)) / 3;
      const [u, n] = toUN(cx, cz);
      if (Math.max(a.getY(i), a.getY(i + 1), a.getY(i + 2)) <= 0.01 || drop(u, n, cy)) { droppedTriangles++; continue; }
      for (let k = 0; k < 3; k++) keep.push(a.getX(i + k), Math.max(0, a.getY(i + k)), a.getZ(i + k));
    }
    kitTriangles += keep.length / 9;
    if (!keep.length) return;
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals();
    add(out, name);
  });
  for (const [slot, s] of H.m.slots) {
    if (!s.positions.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(s.positions, 3)); g.computeVertexNormals();
    add(g, slot);
  }
  return {kitTriangles, droppedTriangles, handTriangles: H.triangles};
}

/** Rectangular balcony in an angle: a white slab and a solid brick parapet along its open edges. */
export function boxBalcony(H: Hand, u0: number, u1: number, n0: number, n1: number, h: number, open: {u?: 0 | 1; n?: 0 | 1}) {
  H.prism('white', [[u0, n0], [u1, n0], [u1, n1], [u0, n1]], h - 0.16, h);
  const t = 0.12;
  if (open.n !== undefined) { const a = open.n ? n1 - t : n0, b = open.n ? n1 : n0 + t; H.prism('brick', [[u0, a], [u1, a], [u1, b], [u0, b]], h, h + 1.0); }
  if (open.u !== undefined) { const a = open.u ? u1 - t : u0, b = open.u ? u1 : u0 + t, nn0 = n0 + (open.n === 0 ? t : 0), nn1 = n1 - (open.n === 1 ? t : 0); H.prism('brick', [[a, nn0], [b, nn0], [b, nn1], [a, nn1]], h, h + 1.0); }
}
