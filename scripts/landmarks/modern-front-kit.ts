/**
 * Shared wall-frame helpers for the round-5 west landmark lane (#236): post-war and 1980s blocks whose fronts read by
 * cut openings, recessed loggia zones, cantilevered balconies and flat parapets. Lifted from kinkerstraat-32-builder.ts
 * (same conventions, so its review carries over) and generalised to any plan frame:
 *   plan (u, v): u along the principal front from the viewer's left corner, v into the block; A(u, v) -> native (x, z);
 *   a face fr(p, q) runs from p to q with p on the viewer's left seen from outside (polygons counter-clockwise in u, v);
 *   wall-local (t, y, o): t along the face, y up from the street, o out of the wall.
 * Openings are cut with holedWall.ts; balconies come from roundedBalcony.ts.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {roundedBalcony, type BalconyOpts} from '../../src/canalRecall/landmarks/roundedBalcony';

export type P2 = [number, number];
export type Col = Parameters<BuildingTools['add']>[1];
export type FR = {f: Frame; len: number};

export function geom(pos: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
export const P = (f: Frame, q: [number, number, number]) => [f.origin[0] + f.tangent[0] * q[0] + f.n[0] * q[2], q[1], f.origin[1] + f.tangent[1] * q[0] + f.n[1] * q[2]];
/** Polygons in wall-local (t, y, o), fanned into triangles (convex polygons only). */
export function addPolys(b: BuildingTools, f: Frame, ps: {pts: [number, number, number][]}[], c: Col) {
  const pos: number[] = [];
  for (const p of ps) { const v = p.pts.map(q => P(f, q)); for (let i = 1; i + 1 < v.length; i++) pos.push(...v[0], ...v[i], ...v[i + 1]); }
  if (pos.length) b.add(geom(pos), c);
}
/** Sub-frame of F starting at t0 and pushed `o` out of (or, negative, into) the wall. */
export const sub = (F: FR, t0: number, len: number, o = 0): FR => ({f: {origin: [F.f.origin[0] + F.f.tangent[0] * t0 + F.f.n[0] * o, F.f.origin[1] + F.f.tangent[1] * t0 + F.f.n[1] * o], tangent: F.f.tangent, n: F.f.n}, len});

export function planFrame(O: P2, U: P2, V: P2) {
  const A = (u: number, v: number): P2 => [O[0] + u * U[0] + v * V[0], O[1] + u * U[1] + v * V[1]];
  /** Face from p to q (u, v), seen from outside with p on the viewer's left. */
  const fr = (p: P2, q: P2): FR => {
    const a = A(p[0], p[1]), c = A(q[0], q[1]), len = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len;
    return {f: {origin: a, tangent: [tx, tz], n: [-tz, tx]}, len};
  };
  const capUp = (b: BuildingTools, uv: P2[], y: number, c: Col) => b.add(upwardRoofPlane(new T.Shape(uv.map(p => { const a = A(p[0], p[1]); return new T.Vector2(a[0], a[1]); })), y), c);
  /** Downward-facing cap (a soffit under a cantilever) over the (u, v) polygon at height y. */
  const capDown = (b: BuildingTools, uv: P2[], y: number, c: Col) => {
    const g = upwardRoofPlane(new T.Shape(uv.map(p => { const a = A(p[0], p[1]); return new T.Vector2(a[0], a[1]); })), y), idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) { const j = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, j); }
    g.computeVertexNormals(); b.add(g, c);
  };
  /** Closed volume on a counter-clockwise (u, v) ring: plain walls y0..y1 on every edge not in `skip`, an upward cap at y1. */
  const prism = (b: BuildingTools, ring: P2[], y0: number, y1: number, c: Col, roof: Col, skip: number[] = []) => {
    ring.forEach((p, i) => { if (!skip.includes(i)) wall(b, fr(p, ring[(i + 1) % ring.length]), y0, y1, c); });
    capUp(b, ring, y1, roof);
  };
  return {A, fr, capUp, capDown, prism};
}

export function wall(b: BuildingTools, F: FR, y0: number, y1: number, c: Col, t0 = 0, t1 = F.len) {
  addPolys(b, F.f, [{pts: [[t0, y0, 0], [t1, y0, 0], [t1, y1, 0], [t0, y1, 0]]}], c);
}

/** Flat faces with cut openings (holedWall.ts), flushed together at the end of a build. */
export type Hole = HoledOpening & {back: Col | null};
export type Face = FR & {y0: number; y1: number; c: Col; holes: Hole[]};
let FACES: Face[] = [];
export const resetFaces = () => { FACES = []; };
export function face(F: FR, y0: number, y1: number, c: Col): Face { const x: Face = {...F, y0, y1, c, holes: []}; FACES.push(x); return x; }
export function flushFaces(b: BuildingTools) {
  // largest first, so a window reveal never seeds the audit's wall plane (westerdok-748)
  for (const F of [...FACES].sort((p, q) => q.len * (q.y1 - q.y0) - p.len * (p.y1 - p.y0))) {
    const hw = holedWall(F.len, F.y0, F.y1, F.holes);
    const tris = (qs: WallQuad[]) => qs.flatMap(q => { const v = q.pts.map(p => P(F.f, p)); return [...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]]; });
    b.add(geom([...tris(hw.face), ...tris(hw.reveals.flat())]), F.c);
    const byBack = new Map<Col, WallQuad[]>();
    F.holes.forEach((h, i) => { if (h.back) byBack.set(h.back, [...(byBack.get(h.back) ?? []), hw.backs[i]]); });
    for (const [c, qs] of byBack) b.add(geom(tris(qs)), c);
  }
  FACES = [];
}

export type OpenOpts = {depth?: number; cols?: number; rows?: number; frame?: Col; back?: Col | null; edge?: number; bars?: number[]; sill?: Col | false; colsAt?: number[]};
/** Opening cut into a face; its frame and glazing bars stand 9 cm off the back, inside the reveal (bottom rail 10 cm). */
export function opening(b: BuildingTools, F: Face, t: number, y: number, w: number, h: number, o: OpenOpts = {}) {
  const depth = o.depth ?? 0.2, frame = o.frame ?? 'frame', back = o.back === undefined ? 'glass' : o.back, fw = o.edge ?? 0.06, d = Math.min(0.09, depth - 0.03), out = -depth;
  F.holes.push({t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back});
  if (fw > 0 && back) {
    const fb = Math.max(fw, 0.1);
    ledgeStrip(b, F.f, t, y, w, fb, d, frame, out);
    ledgeStrip(b, F.f, t, y + h - fw, w, fw, d, frame, out);
    for (const s of [-1, 1]) ledgeStrip(b, F.f, t + s * (w - fw) / 2, y + fb, fw, h - fw - fb, d, frame, out);
  }
  const cols = o.cols ?? 1, rows = o.rows ?? 1;
  for (const at of o.colsAt ?? Array.from({length: cols - 1}, (_, k) => w * (k + 1) / cols)) ledgeStrip(b, F.f, t - w / 2 + at, y + fw, 0.06, h - 2 * fw, d, frame, out);
  for (let k = 1; k < rows; k++) ledgeStrip(b, F.f, t, y + h * k / rows - 0.03, w - 2 * fw, 0.06, d, frame, out);
  for (const yb of o.bars ?? []) ledgeStrip(b, F.f, t, y + yb - 0.03, w - 2 * fw, 0.06, d, frame, out);
  if (o.sill) slab(b, F.f, t, y - 0.07, w + 0.1, 0.07, 0.1, o.sill);
}

/** Band from t0..t1, a closed box `proj` out from the wall plane between y0 and y1; end caps where asked. */
export function band(b: BuildingTools, F: FR, t0: number, t1: number, y0: number, y1: number, proj: number, c: Col, ends: [boolean, boolean] = [true, true]) {
  const quads: {pts: [number, number, number][]}[] = [
    {pts: [[t0, y0, proj], [t1, y0, proj], [t1, y1, proj], [t0, y1, proj]]},
    {pts: [[t0, y1, proj], [t1, y1, proj], [t1, y1, 0], [t0, y1, 0]]},
    {pts: [[t0, y0, 0], [t1, y0, 0], [t1, y0, proj], [t0, y0, proj]]},
  ];
  if (ends[0]) quads.push({pts: [[t0, y0, 0], [t0, y0, proj], [t0, y1, proj], [t0, y1, 0]]});
  if (ends[1]) quads.push({pts: [[t1, y0, proj], [t1, y0, 0], [t1, y1, 0], [t1, y1, proj]]});
  addPolys(b, F.f, quads, c);
}

export type BalconyDraw = BalconyOpts & {slabT?: number; railH?: number; slab?: Col; rail?: Col; o0?: number; parapet?: Col};
/**
 * Cantilevered balcony on face F: slab from t0 (viewer's left) w wide, d deep, top at y, standing out from o0 (0 = wall
 * plane); a bar railing of thin ribbons (top and bottom rail, bars; default colour `pink`, which a model tints white: rails are
 * not openings, and `white` is an opening material to the geometry audit) or, with `parapet`, a solid rounded parapet.
 */
export function balcony(b: BuildingTools, F: FR, t0: number, w: number, d: number, y: number, o: BalconyDraw = {}) {
  const bal = roundedBalcony(w, d, o), th = o.slabT ?? 0.2, rh = o.railH ?? 1.0, o0 = o.o0 ?? 0, sc = o.slab ?? 'concrete', rc = o.rail ?? 'pink';
  const at = (p: [number, number], yy: number): [number, number, number] => [t0 + p[0], yy, o0 + p[1]];
  const ol = bal.outline, top: {pts: [number, number, number][]}[] = [{pts: ol.map(p => at(p, y))}], bot = [{pts: ol.slice().reverse().map(p => at(p, y - th))}];
  const sides = ol.map((p, i) => { const q = ol[(i + 1) % ol.length]; return {pts: [at(p, y - th), at(q, y - th), at(q, y), at(p, y)]}; })
    // the edge against the wall stays open (it is buried in the wall or the loggia's back)
    .filter((_, i) => !(Math.abs(ol[i][1]) < 1e-9 && Math.abs(ol[(i + 1) % ol.length][1]) < 1e-9));
  addPolys(b, F.f, [...top, ...bot, ...sides], sc);
  const run = bal.runs[0].pts, ribbon = (y0: number, y1: number, inset = 0.04) => run.slice(1).map((q, i) => {
    const p = run[i], s = (r: [number, number]): [number, number] => [r[0], Math.max(0, r[1] - inset)];
    return {pts: [at(s(p), y0), at(s(q), y0), at(s(q), y1), at(s(p), y1)]};
  });
  if (o.parapet) {
    addPolys(b, F.f, ribbon(y, y + rh, 0), o.parapet);
    addPolys(b, F.f, ribbon(y, y + rh, 0.2).map(q => ({pts: q.pts.slice().reverse()})), o.parapet);
    return;
  }
  const rails = [...ribbon(y + rh - 0.06, y + rh), ...ribbon(y + 0.08, y + 0.14)];
  const bars = bal.bars.map(({at: p, tangent: tg}) => {
    const q: [number, number] = [p[0], Math.max(0, p[1] - 0.04)], a: [number, number] = [q[0] - tg[0] * 0.02, q[1] - tg[1] * 0.02], c: [number, number] = [q[0] + tg[0] * 0.02, q[1] + tg[1] * 0.02];
    return {pts: [at(a, y), at(c, y), at(c, y + rh), at(a, y + rh)]};
  });
  addPolys(b, F.f, [...rails, ...bars], rc);
}

/**
 * Round column (or slanted strut) between two native points a and c (x, y, z): an n-sided closed tube of radius r. For the
 * round pilotis of post-war colonnades and the raked V-columns under cantilevers; 2n + 2(n - 2) triangles.
 */
export function strut(b: BuildingTools, a: [number, number, number], c: [number, number, number], r: number, col: Col, n = 8) {
  const A3 = new T.Vector3(...a), C3 = new T.Vector3(...c), dir = C3.clone().sub(A3), len = dir.length();
  if (!(len > 1e-6) || !(r > 0)) throw new Error('strut: zero length or radius');
  const g = new T.CylinderGeometry(r, r, len, n, 1, false);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
  b.add(g, col);
}

/** Downpipe from y0 to y1, 12 cm square, 6 cm off the wall. */
export const pipe = (b: BuildingTools, F: FR, t: number, y0: number, y1: number, c: Col = 'frame') => slab(b, F.f, t, y0, 0.12, y1 - y0, 0.12, c, 0.06);
export {ledgeStrip, slab};
