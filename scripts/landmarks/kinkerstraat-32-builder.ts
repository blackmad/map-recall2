import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {mansardDormers, type MansardDormer, type MansardPoly} from '../../src/canalRecall/landmarks/mansardDormers';

/**
 * Kinkerstraat 32-54 / Da Costakade 157-165 / Da Costastraat 66-70: BAG pand 0363100012137280, bouwjaar 1999, 66
 * verblijfsobjecten (woon-, winkel-, bijeenkomst- and industriefunctie; BAG, CC0). One pand fills the north side of the
 * Kinkerstraat between the Da Costakade (west) and the Da Costastraat (east). The architect is not named by nl.wikipedia,
 * the BAG or the monument registers (no monument record); unconfirmed.
 *
 * Native frame of scripts/landmarks/kinkerstraat-32-footprints.json (x east, z south, y up from the 0.80 m NAP street).
 * Builder axes: u along the Kinkerstraat front from the Da Costakade corner (east-north-east), v into the block
 * (north-north-west); origin the BAG vertex (-20.806, 24.783); the front runs u -1.36..58.2, the Da Costakade side
 * u = -1.36, v 0..33.1, the Da Costastraat side u = 58.2, v 0..25.1. Volumes (3DBAG LoD2.2 roof parts, CC BY 4.0):
 *  - west corner block in light grey-beige brick (WB) u -1.36..13.8, v 0..15, cornice 18.75, a zinc top storey set back
 *    1.2 m to 21.4 with its stair core reaching v 25.1, a lift head to 25.2;
 *  - the red-brick Kinkerstraat bar (KB) u 13.8..50.6: glazed shop ground and glazed mezzanine loggias in a grey steel
 *    frame of ten bays, three brick storeys of punched windows in five groups of four, a grey cornice at 15.0-15.75 and a
 *    zinc mansard to 18.75 with five dormers;
 *  - east corner block in the same beige brick (EB) u 50.6..58.2, v 0..14.6, cornice 18.75, no set-back;
 *  - red-brick side wings on the Da Costakade (WR, v 15..33.1) and the Da Costastraat (ER, v 15.3..25.1), four storeys,
 *    cornice and mansard with two and one dormers; a glazed joint between EB and ER on the Da Costastraat;
 *  - the courtyard: the supermarket hall's roof deck at 5.0 m between the wings.
 * Openings measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of scripts/landmarks/kinkerstraat-32-brief.md:
 * w01-157 (2021 and 2025), w02-247 (2019), w03-67 (2022) and its 2021 second view. The courtyard faces, the stair core and
 * the 8 m north-east face (w04) carry no photograph and are INFERRED from the street storeys.
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];

const O: P2 = [-20.806, 24.783], U: P2 = [0.9233282, -0.3840118], V: P2 = [-0.3840118, -0.9233282];
const A = (u: number, v: number): P2 => [O[0] + u * U[0] + v * V[0], O[1] + u * U[1] + v * V[1]];

// ---- plan (u, v) and levels (y above the street) -----------------------------------------------------------------------
const W0 = -1.36, KB0 = 13.8, KB1 = 50.6, E1 = 58.2;
const WB_N = 15.0, KB_N = 15.25, EB_N = 14.6, ER_S = 15.3, ER_N = 25.1, WR_N = 33.1, CORE = {u0: 8.1, u1: 14.5};
const RECESS_U = 57.2;
/** Storeys: shop ground to 4.85 (red bar) / 4.9 (wings); window sills (1.5 m tall windows); the beige top row. */
const SILLS = [5.4, 8.05, 10.65, 13.3], WIN_H = 1.5, TOP_SILL = 16.05, TOP_H = 1.3;
const RED_CORNICE: [number, number] = [15.0, 15.75], BEIGE_CORNICE: [number, number] = [18.0, 18.75];
const ROOF = 18.75, SETBACK = {top: 21.4, d: 1.2}, LIFT = {u0: 2.6, u1: 8.0, v0: 11.5, v1: 15.0, top: 25.2}, DECK = 5.0;
/** Mansard: foot on the red cornice's top at the wall plane; 1.0 m deep; dormer tops 18.45. */
const MANSARD = {yFoot: RED_CORNICE[1], oFoot: 0, yTop: ROOF, depth: 1.0};
const DORMER_TOP = 18.45, MANS_IN = MANSARD.depth - MANSARD.oFoot; // the flat roof starts this far behind a mansard front
/** Mezzanine loggias and shop bays of the red bar: ten bays of 3.68 m between 0.24 m steel posts. */
const BAYS = 10, BAY = (KB1 - KB0) / BAYS, POST = 0.22, SHOP_TOP = 4.3, MEZZ = {panel: [4.95, 5.95], glass: [6.05, 7.3], top: 7.45};

// ---- primitive helpers -------------------------------------------------------------------------------------------------
function geom(pos: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
type FR = {f: Frame; len: number};
/** Face from p to q (u, v), seen from outside with p on the viewer's left (polygons are counter-clockwise in u, v). */
function fr(p: P2, q: P2): FR {
  const a = A(p[0], p[1]), c = A(q[0], q[1]), len = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len;
  return {f: {origin: a, tangent: [tx, tz], n: [-tz, tx]}, len};
}
const P = (f: Frame, q: [number, number, number]) => [f.origin[0] + f.tangent[0] * q[0] + f.n[0] * q[2], q[1], f.origin[1] + f.tangent[1] * q[0] + f.n[1] * q[2]];
/** Polygons in wall-local (t, y, o), fanned into triangles. */
function addPolys(b: BuildingTools, f: Frame, ps: {pts: [number, number, number][]}[], c: Col) {
  const pos: number[] = [];
  for (const p of ps) { const v = p.pts.map(q => P(f, q)); for (let i = 1; i + 1 < v.length; i++) pos.push(...v[0], ...v[i], ...v[i + 1]); }
  if (pos.length) b.add(geom(pos), c);
}
function wall(b: BuildingTools, F: FR, y0: number, y1: number, c: Col, t0 = 0, t1 = F.len) {
  addPolys(b, F.f, [{pts: [[t0, y0, 0], [t1, y0, 0], [t1, y1, 0], [t0, y1, 0]]}], c);
}
const capUp = (b: BuildingTools, uv: P2[], y: number, c: Col) => b.add(upwardRoofPlane(new T.Shape(uv.map(p => { const a = A(p[0], p[1]); return new T.Vector2(a[0], a[1]); })), y), c);
const rect = (u0: number, u1: number, v0: number, v1: number): P2[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

/** Flat faces with cut openings (holedWall.ts). */
type Hole = HoledOpening & {back: Col | null};
type Face = FR & {y0: number; y1: number; c: Col; holes: Hole[]};
let FACES: Face[] = [];
function face(F: FR, y0: number, y1: number, c: Col): Face { const x: Face = {...F, y0, y1, c, holes: []}; FACES.push(x); return x; }
function flushFaces(b: BuildingTools) {
  for (const F of FACES) {
    const hw = holedWall(F.len, F.y0, F.y1, F.holes);
    const tris = (qs: WallQuad[]) => qs.flatMap(q => { const v = q.pts.map(p => P(F.f, p)); return [...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]]; });
    b.add(geom([...tris(hw.face), ...tris(hw.reveals.flat())]), F.c);
    const byBack = new Map<Col, WallQuad[]>();
    F.holes.forEach((h, i) => { if (h.back) byBack.set(h.back, [...(byBack.get(h.back) ?? []), hw.backs[i]]); });
    for (const [c, qs] of byBack) b.add(geom(tris(qs)), c);
  }
  FACES = [];
}
type OpenOpts = {depth?: number; cols?: number; rows?: number; frame?: Col; back?: Col; edge?: number; bars?: number[]; sill?: boolean};
/** Opening cut into a face; its frame and glazing bars stand 9 cm off the back, inside the reveal (bottom rail 10 cm). */
function opening(b: BuildingTools, F: Face, t: number, y: number, w: number, h: number, o: OpenOpts = {}) {
  const depth = o.depth ?? 0.2, frame = o.frame ?? 'frame', back = o.back ?? 'glass', fw = o.edge ?? 0.06, d = Math.min(0.09, depth - 0.03), out = -depth;
  F.holes.push({t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back});
  if (fw > 0) {
    const fb = Math.max(fw, 0.1);
    ledgeStrip(b, F.f, t, y, w, fb, d, frame, out);
    ledgeStrip(b, F.f, t, y + h - fw, w, fw, d, frame, out);
    for (const s of [-1, 1]) ledgeStrip(b, F.f, t + s * (w - fw) / 2, y + fb, fw, h - fw - fb, d, frame, out);
  }
  const cols = o.cols ?? 1, rows = o.rows ?? 1;
  for (let k = 1; k < cols; k++) ledgeStrip(b, F.f, t - w / 2 + w * k / cols, y + fw, 0.06, h - 2 * fw, d, frame, out);
  for (let k = 1; k < rows; k++) ledgeStrip(b, F.f, t, y + h * k / rows - 0.03, w - 2 * fw, 0.06, d, frame, out);
  for (const yb of o.bars ?? []) ledgeStrip(b, F.f, t, y + yb - 0.03, w - 2 * fw, 0.06, d, frame, out);
  if (o.sill) slab(b, F.f, t, y - 0.07, w + 0.1, 0.07, 0.1, 'concrete');
}
/** Punched window of the brick and beige storeys: 0.95 x 1.5, deep reveal, grey frame with one upright, grey sill. */
const win = (b: BuildingTools, F: Face, t: number, sill: number, w = 0.95, h = WIN_H) => opening(b, F, t, sill, w, h, {depth: 0.22, cols: w > 1.1 ? 2 : 1, sill: true});
/** Horizontal ribbon of `n` lights between t0 and t1. */
const ribbon = (b: BuildingTools, F: Face, t0: number, t1: number, sill: number, h: number, lightW = 0.95) =>
  opening(b, F, (t0 + t1) / 2, sill, t1 - t0, h, {depth: 0.22, cols: Math.max(1, Math.round((t1 - t0) / lightW)), sill: true});

/** Cornice band from t0..t1, a closed box `proj` out from the wall plane above the wall's top; end caps where asked. */
function cornice(b: BuildingTools, F: FR, t0: number, t1: number, y0: number, y1: number, proj: number, c: Col, ends: [boolean, boolean] = [true, true]) {
  const ob = 0, quads: {pts: [number, number, number][]}[] = [
    {pts: [[t1, y0, ob], [t0, y0, ob], [t0, y1, ob], [t1, y1, ob]]},
    {pts: [[t0, y0, proj], [t1, y0, proj], [t1, y1, proj], [t0, y1, proj]]},
    {pts: [[t0, y1, proj], [t1, y1, proj], [t1, y1, ob], [t0, y1, ob]]},
    {pts: [[t0, y0, ob], [t1, y0, ob], [t1, y0, proj], [t0, y0, proj]]},
  ];
  if (ends[0]) quads.push({pts: [[t0, y0, 0], [t0, y0, proj], [t0, y1, proj], [t0, y1, 0]]});
  if (ends[1]) quads.push({pts: [[t1, y0, proj], [t1, y0, 0], [t1, y1, 0], [t1, y1, proj]]});
  addPolys(b, F.f, quads, c);
}
/** Mansard run on a red face from t0..t1 with box dormers; returns nothing (dormer fronts are holed faces). */
function mansard(b: BuildingTools, F: FR, t0: number, t1: number, dormers: [number, number][], lights = 2) {
  const len = t1 - t0, ds: MansardDormer[] = dormers.map(([a, c]) => ({t0: a - t0, t1: c - t0, top: DORMER_TOP}));
  const run = mansardDormers(len, {...MANSARD, dormers: ds, capOverhang: 0.12, capThickness: 0.14});
  const sub: Frame = {origin: [F.f.origin[0] + F.f.tangent[0] * t0, F.f.origin[1] + F.f.tangent[1] * t0], tangent: F.f.tangent, n: F.f.n};
  addPolys(b, sub, run.slope as MansardPoly[], 'slate');
  addPolys(b, sub, run.cheeks, 'slate');
  addPolys(b, sub, run.caps, 'concrete');
  for (const d of run.fronts) {
    // the dormer front, its plane at o = d.o: a holed face of its own
    const fo: Frame = {origin: [sub.origin[0] + sub.tangent[0] * d.t0 + sub.n[0] * d.o, sub.origin[1] + sub.tangent[1] * d.t0 + sub.n[1] * d.o], tangent: sub.tangent, n: sub.n};
    const Fd = face({f: fo, len: d.t1 - d.t0}, d.y0, d.y1, 'slate');
    const w = d.t1 - d.t0 - 0.7;
    opening(b, Fd, (d.t1 - d.t0) / 2, 16.15, w, 1.6, {depth: 0.15, cols: lights, frame: 'frame'});
  }
}
/** Small cast plant holder under a window (the red bar's signature rows of flower holders). */
const pot = (b: BuildingTools, F: FR, t: number, sill: number) => slab(b, F.f, t, sill - 0.42, 0.3, 0.22, 0.2, 'bronze');
/** Grey downpipe from the cornice to the street. */
const pipe = (b: BuildingTools, F: FR, t: number, y1: number) => slab(b, F.f, t, 0, 0.12, y1, 0.12, 'bronze', 0.06);

// ---- the red Kinkerstraat bar (w01-157, crop x = u + 0.8) ----------------------------------------------------------------
/** Window axes: five groups of four on a 1.72 m pitch (w01-157, both captures). */
const KB_GROUPS = [14.9, 22.6, 30.0, 37.4, 44.85];
const KB_AXES = KB_GROUPS.flatMap(u => [0, 1, 2, 3].map(k => u + 1.72 * k));
const KB_DORMERS: [number, number][] = [[16.5, 20.5], [22.5, 26.2], [31.6, 35.2], [37.1, 40.8], [46.1, 49.9]];
function redBar(b: BuildingTools) {
  const S = fr([KB0, 0], [KB1, 0]), t = (u: number) => u - KB0;
  // ground and mezzanine: a grey steel frame of ten bays
  const low = face(S, 0, MEZZ.top, 'bronze');
  for (let k = 0; k < BAYS; k++) {
    const a = k * BAY + POST / 2, c = (k + 1) * BAY - POST / 2, m = (a + c) / 2, w = c - a;
    const vomar = k >= 2;
    opening(b, low, m, 0.1, w, SHOP_TOP - 0.1, {depth: 0.3, cols: 2, bars: vomar ? [] : [3.3], frame: vomar ? 'red' : 'frame', edge: 0.04});
    if (vomar) ledgeStrip(b, S.f, m, 3.15, w, SHOP_TOP - 3.2, 0.12, 'red', -0.3 + 0.13);   // the red fascia inside the shop opening
    opening(b, low, m, MEZZ.panel[0], w, MEZZ.panel[1] - MEZZ.panel[0], {depth: 0.12, back: 'green', edge: 0, cols: 2});
    opening(b, low, m, MEZZ.glass[0], w, MEZZ.glass[1] - MEZZ.glass[0], {depth: 0.15, cols: 2, edge: 0.04});
  }
  // the three brick storeys, a pot under every window
  const up = face(S, MEZZ.top, RED_CORNICE[0], 'brick');
  for (const u of KB_AXES) for (const s of SILLS.slice(1)) { win(b, up, t(u), s); pot(b, S, t(u), s); }
  for (const u of [21.3, 43.7]) pipe(b, S, t(u), RED_CORNICE[0]);
  cornice(b, S, 0, S.len, RED_CORNICE[0], RED_CORNICE[1], 0.45, 'concrete');
  mansard(b, S, 0, S.len, KB_DORMERS.map(([a, c]) => [t(a), t(c)]));
  // courtyard face over the deck (INFERRED: the street storeys' axes, with a fifth row in the top storey)
  const N = face(fr([48.1, KB_N], [CORE.u1, KB_N]), DECK, ROOF, 'brick'), tn = (u: number) => 48.1 - u;
  for (const u of KB_AXES) if (u > CORE.u1 + 0.8 && u < 47.5) for (const s of [5.6, ...SILLS.slice(1), TOP_SILL]) win(b, N, tn(u), s, 0.95, s === TOP_SILL ? TOP_H : WIN_H);
  // the beige blocks' end walls where the mansard leaves them exposed
  wall(b, fr([KB0, 0], [KB0, MANS_IN]), RED_CORNICE[0], ROOF, 'greyBrick');
  wall(b, fr([KB1, MANS_IN], [KB1, 0]), RED_CORNICE[0], ROOF, 'greyBrick');
  capUp(b, rect(KB0, KB1, MANS_IN, KB_N), ROOF, 'copper');
}

// ---- the beige corner blocks -------------------------------------------------------------------------------------------
function westBlock(b: BuildingTools) {
  // Kinkerstraat front (w01-157 2021 crop x = u + 0.8): eight axes, a wide glazed ground bay at the corner
  const S = fr([W0, 0], [KB0, 0]), t = (u: number) => u - W0;
  const s = face(S, 0, BEIGE_CORNICE[0], 'greyBrick');
  const AX: [number, number][] = [[-0.4, 0.78], [1.18, 0.95], [2.9, 0.95], [4.78, 1.15], [6.92, 1.15], [8.82, 0.95], [10.58, 0.95], [12.28, 0.95]];
  for (const [u, w] of AX) for (const sl of SILLS) win(b, s, t(u), sl, w);
  for (const [u0, u1] of [[0.7, 5.5], [6.3, 11.1]]) ribbon(b, s, t(u0), t(u1), TOP_SILL, TOP_H);
  for (const [u, w] of [[-0.4, 0.78], [12.3, 1.0]]) win(b, s, t(u), TOP_SILL, w, TOP_H);
  opening(b, s, t(0.93), 0.4, 3.3, 4.2, {depth: 0.25, cols: 3, bars: [3.3]});
  for (const [u0, u1] of [[4.2, 5.4], [6.25, 7.55], [8.3, 9.3], [10.0, 11.0], [11.7, 12.7]]) opening(b, s, t((u0 + u1) / 2), 0.4, u1 - u0, 4.2, {depth: 0.25, bars: [3.3]});
  cornice(b, S, -0.35, S.len, BEIGE_CORNICE[0], BEIGE_CORNICE[1], 0.35, 'concrete');
  // Da Costakade side (w02-247, t = crop x - 18.1): five axes, a door and a wide ground window at the corner
  const Wf = fr([W0, WB_N], [W0, 0]);
  const w = face(Wf, 0, BEIGE_CORNICE[0], 'greyBrick');
  for (const tt of [1.7, 3.4, 5.1, 6.8, 11.1]) { for (const sl of SILLS) win(b, w, tt, sl); win(b, w, tt, TOP_SILL, 0.95, TOP_H); }
  for (const tt of [1.7, 3.4, 5.1, 6.8]) opening(b, w, tt, 0.8, 0.95, 3.2, {depth: 0.25, bars: [2.6]});
  opening(b, w, 9.3, 0.05, 0.95, 3.5, {depth: 0.25, back: 'dark', bars: [2.6]});
  opening(b, w, 12.45, 0.4, 1.9, 4.2, {depth: 0.25, cols: 2, bars: [3.3]});
  cornice(b, Wf, 0, Wf.len, BEIGE_CORNICE[0], BEIGE_CORNICE[1], 0.35, 'concrete', [true, false]);
  // the zinc top storey set back 1.2 m (w01/w02 top edges: a few lights seen; the rest INFERRED)
  const sx = W0 + SETBACK.d, sv = SETBACK.d;
  const ss = face(fr([sx, sv], [KB0, sv]), ROOF, SETBACK.top, 'slate');
  for (let u = sx + 1.2; u < KB0 - 1; u += 2.6) opening(b, ss, u - sx, ROOF + 0.6, 1.8, 1.5, {depth: 0.15, cols: 2});
  const sw = face(fr([sx, WB_N], [sx, sv]), ROOF, SETBACK.top, 'slate');
  for (let tt = 1.5; tt < sw.len - 1; tt += 2.6) opening(b, sw, tt, ROOF + 0.6, 1.8, 1.5, {depth: 0.15, cols: 2});
  capUp(b, [[W0, 0], [KB0, 0], [KB0, sv], [sx, sv], [sx, WB_N], [W0, WB_N]], ROOF, 'copper');
  wall(b, fr([KB0, sv], [KB0, KB_N]), ROOF, SETBACK.top, 'slate');
  wall(b, fr([KB0, KB_N], [CORE.u1, KB_N]), ROOF, SETBACK.top, 'slate');
  // stair core on the courtyard (INFERRED): full height on the deck, a slot window per landing
  const ce = face(fr([CORE.u1, KB_N], [CORE.u1, ER_N]), DECK, SETBACK.top, 'greyBrick');
  for (const sl of [6.2, 8.8, 11.4, 14.0, 16.6]) opening(b, ce, ce.len / 2, sl, 1.2, 1.2, {depth: 0.2});
  wall(b, fr([CORE.u1, ER_N], [13.2, ER_N]), 0, SETBACK.top, 'greyBrick');
  wall(b, fr([13.2, ER_N], [CORE.u0, ER_N]), ROOF, SETBACK.top, 'greyBrick');
  wall(b, fr([CORE.u0, ER_N], [CORE.u0, WB_N]), ROOF, SETBACK.top, 'greyBrick');
  wall(b, fr([CORE.u0, WB_N], [sx, WB_N]), ROOF, SETBACK.top, 'slate');
  capUp(b, [[sx, sv], [KB0, sv], [KB0, KB_N], [CORE.u1, KB_N], [CORE.u1, ER_N], [CORE.u0, ER_N], [CORE.u0, WB_N], [sx, WB_N]], SETBACK.top, 'copper');
  // lift head
  const {u0, u1, v0, v1, top} = LIFT;
  for (const [p, q] of [[[u0, v0], [u1, v0]], [[u1, v0], [u1, v1]], [[u1, v1], [u0, v1]], [[u0, v1], [u0, v0]]] as [P2, P2][]) wall(b, fr(p, q), SETBACK.top, top, 'slate');
  capUp(b, rect(u0, u1, v0, v1), top, 'copper');
  // where the Da Costakade mansard leaves the block's north wall exposed
  wall(b, fr([W0 + MANS_IN, WB_N], [W0, WB_N]), RED_CORNICE[0], ROOF, 'greyBrick');
}
function eastBlock(b: BuildingTools) {
  // Kinkerstraat front (w01-157): four axes, two wide top windows, the supermarket's red-framed ground glazing
  const S = fr([KB1, 0], [E1, 0]), t = (u: number) => u - KB1;
  const s = face(S, 0, BEIGE_CORNICE[0], 'greyBrick');
  for (const u of [52.2, 53.9, 55.6, 57.2]) for (const sl of SILLS) win(b, s, t(u), sl);
  for (const [u0, u1] of [[51.1, 54.0], [54.4, 57.2]]) ribbon(b, s, t(u0), t(u1), TOP_SILL, TOP_H, 1.4);
  opening(b, s, S.len / 2, 0.1, S.len - 0.6, SHOP_TOP - 0.1, {depth: 0.3, cols: 3, frame: 'red'});
  ledgeStrip(b, S.f, S.len / 2, 3.15, S.len - 0.6, SHOP_TOP - 3.2, 0.12, 'red', -0.3 + 0.13);
  cornice(b, S, 0, S.len + 0.35, BEIGE_CORNICE[0], BEIGE_CORNICE[1], 0.35, 'concrete', [true, true]);
  // Da Costastraat side (w03-67, both captures; t = v): five axes, a single and a ribbon on top, the red Vomar doors
  const Ef = fr([E1, 0], [E1, EB_N]);
  const e = face(Ef, 0, BEIGE_CORNICE[0], 'greyBrick');
  for (const [tt, w] of [[3.2, 1.15], [7.7, 0.95], [9.4, 0.95], [11.1, 0.95], [12.75, 0.95]]) for (const sl of SILLS) win(b, e, tt, sl, w);
  win(b, e, 3.2, TOP_SILL, 1.15, TOP_H);
  ribbon(b, e, 6.9, 13.2, TOP_SILL, TOP_H);
  opening(b, e, 2.4, 0.1, 3.9, 3.6, {depth: 0.25, cols: 3, frame: 'red'});
  for (const tt of [7.7, 9.4, 11.1, 12.75]) opening(b, e, tt, 0.6, 0.95, 3.9, {depth: 0.25, bars: [3.0]});
  cornice(b, Ef, 0, Ef.len, BEIGE_CORNICE[0], BEIGE_CORNICE[1], 0.35, 'concrete', [false, true]);
  // the glazed joint between the beige block and the red wing (w03-67: a dark slot with a gate at the street)
  wall(b, fr([E1, EB_N], [RECESS_U, EB_N]), 0, ROOF, 'greyBrick');
  wall(b, fr([RECESS_U, EB_N], [RECESS_U, ER_S]), 0, ROOF, 'bronze');
  capUp(b, [[KB1, 0], [E1, 0], [E1, EB_N], [KB1, EB_N]], ROOF, 'copper');
}

// ---- the red side wings ------------------------------------------------------------------------------------------------
function westWing(b: BuildingTools) {
  // Da Costakade (w02-247, t = crop x): nine axes, the last a recessed loggia; the entrance; two dormers
  const Wf = fr([W0, WR_N], [W0, WB_N]);
  const w = face(Wf, 0, RED_CORNICE[0], 'brick');
  for (const tt of [1.0, 2.6, 4.6, 6.4, 9.2, 10.9, 12.6, 14.4]) for (const sl of SILLS) win(b, w, tt, sl);
  for (const sl of SILLS) opening(b, w, 17.0, sl, 1.12, WIN_H, {depth: 0.9});
  for (const tt of [1.0, 2.6, 6.3]) opening(b, w, tt, 0.3, 0.8, 3.7, {depth: 0.25, bars: [2.9]});
  opening(b, w, 9.2, 0.1, 0.8, 3.9, {depth: 0.12, back: 'bronze', edge: 0});
  opening(b, w, 12.75, 0.05, 4.7, 4.15, {depth: 0.6, back: 'dark', frame: 'bronze', cols: 3, bars: [2.6]});
  opening(b, w, 17.2, 0.4, 1.2, 3.7, {depth: 0.25, bars: [2.9]});
  pipe(b, Wf, 18.0, RED_CORNICE[0]);
  cornice(b, Wf, 0, Wf.len, RED_CORNICE[0], RED_CORNICE[1], 0.45, 'concrete', [false, true]);
  mansard(b, Wf, 0, Wf.len, [[3.5, 7.0], [11.6, 15.8]]);
  // north party wall (BAG 0363100012067309, 1999, 22.2 m) and the 8 m north-east face (w04, INFERRED)
  wall(b, fr([13.2, WR_N], [W0, WR_N]), 0, ROOF, 'brick');
  const ne = face(fr([13.2, ER_N], [13.2, WR_N]), 0, ROOF, 'brick');
  for (const tt of [2.0, 4.0, 6.0]) for (const sl of SILLS) win(b, ne, tt, sl);
  capUp(b, [[W0 + MANS_IN, WB_N], [CORE.u0, WB_N], [CORE.u0, ER_N], [13.2, ER_N], [13.2, WR_N], [W0 + MANS_IN, WR_N]], ROOF, 'copper');
}
function eastWing(b: BuildingTools) {
  // Da Costastraat (w03-67 both captures, t = v - 15.3): four axes, wide three-light windows on the top storey, a dormer
  const Ef = fr([E1, ER_S], [E1, ER_N]);
  const e = face(Ef, 0, RED_CORNICE[0], 'brick');
  for (const tt of [2.7, 4.35, 5.95, 7.6]) for (const sl of SILLS.slice(0, 3)) win(b, e, tt, sl);
  for (const [a, c] of [[2.1, 4.65], [5.3, 7.95]]) ribbon(b, e, a, c, SILLS[3], WIN_H);
  opening(b, e, 2.6, 0.1, 0.9, 2.3, {depth: 0.12, back: 'bronze', edge: 0});
  opening(b, e, 6.0, 0.1, 3.0, 4.3, {depth: 0.15, back: 'bronze', edge: 0});
  cornice(b, Ef, 0, Ef.len, RED_CORNICE[0], RED_CORNICE[1], 0.45, 'concrete', [true, false]);
  mansard(b, Ef, 0, Ef.len, [[2.05, 5.15]]);
  wall(b, fr([RECESS_U, ER_S], [E1, ER_S]), 0, ROOF, 'brick');
  wall(b, fr([E1, ER_N], [39.9, ER_N]), 0, ROOF, 'brick');
  // courtyard faces over the deck (INFERRED)
  for (const [p, q] of [[[39.9, ER_N], [39.6, 20.7]], [[39.6, 20.7], [48.8, 17.6]], [[48.8, 17.6], [48.1, KB_N]]] as [P2, P2][]) {
    const F = face(fr(p, q), DECK, ROOF, 'brick');
    for (let tt = 1.2; tt < F.len - 0.8; tt += 1.9) for (const sl of [5.6, ...SILLS.slice(1), TOP_SILL]) win(b, F, tt, sl, 0.95, sl === TOP_SILL ? TOP_H : WIN_H);
  }
  capUp(b, [[48.1, KB_N], [KB1, KB_N], [KB1, EB_N], [RECESS_U, EB_N], [RECESS_U, ER_N], [39.9, ER_N], [39.6, 20.7], [48.8, 17.6]], ROOF, 'copper');
}
function deck(b: BuildingTools) {
  wall(b, fr([39.9, ER_N], [CORE.u1, ER_N]), 0, DECK, 'brick');
  capUp(b, [[CORE.u1, KB_N], [48.1, KB_N], [48.8, 17.6], [39.6, 20.7], [39.9, ER_N], [CORE.u1, ER_N]], DECK, 'copper');
}

export function buildKinkerstraat32(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  FACES = [];
  redBar(b); b.mark?.('bar');
  westBlock(b); b.mark?.('west');
  eastBlock(b); b.mark?.('east');
  westWing(b); b.mark?.('westWing');
  eastWing(b); b.mark?.('eastWing');
  deck(b); b.mark?.('deck');
  flushFaces(b); b.mark?.('faces');
}
