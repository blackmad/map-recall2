import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import type {Surface} from './worship-shell';
import {getSink, ledgeStrip, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {face, flushFaces, opening, resetFaces, strut, type FR} from './modern-front-kit';
import source from './commandementsgebouw-footprints.json';

/**
 * COMMANDEMENTSGEBOUW, Kattenburgerstraat 5, Marineterrein (BAG pand 0363100012164987; gemeentelijk monument 230003, no
 * register text). A two-storey post-war office slab: exposed-aggregate concrete panels with two ribbons of white-framed
 * windows between dark grey posts, brick end walls and corner piers, a glazed stair tower and a covered walkway on the
 * north-west side, a flat roof with a light metal coping.
 *
 * Massing: one flat roof at the 3DBAG roof height (8.13 m over the 3DBAG ground) on the facade ring; every wall is drawn by this
 * builder on the facade ring. Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), t along each face from
 * the viewer's left (ringFrame), y up from the 3DBAG ground:
 *  - south-east (edges 8 + 0, one straight line, 42.6 m; w02-145, TMX7316010203-000248_pano_0000_000101, 2017, 48 px/m,
 *    ground at 465 px): plinth panel 0-1.08 m, lower ribbon 1.08-3.06, spandrel 3.06-4.94, upper ribbon 4.94-6.92, fascia
 *    to the coping; 22 windows per ribbon at 1.88 m; panel joints every 3.96 m; the entrance t 31.2-35.2 (brick cheeks,
 *    a glazed door pair, a flat canopy at 2.5 m, a clerestory over it);
 *  - north-west (edge 2, 42.8 m; w01-325, TMX7315120208-000054_pano_0002_000334, 2016, 50 px/m): four bays t 1.2-8.4, the
 *    glazed stair tower t 8.6-12.0 to 6.9 m, a closed panel t 12.0-15.8 with a strip window at the head of each ribbon,
 *    then 14 bays t 16-41 (one louvre in the upper ribbon), the lower ribbon's last bays under the covered walkway (beam at
 *    3.2 m, two posts) and two louvre bays at the right end;
 *  - north-east (edge 1, 13.6 m; w03-56 2016 and its 2017 view, 48 px/m): plain brick, a glazed door at t 10.8-11.9, two
 *    downpipes, the coping;
 *  - south-west (edges 3-7): plain brick with one small high window (w04-235, 2016); the bicycle shed in front is not on
 *    the pand.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

const TOP = 8.13, CAP = TOP - 0.12, PLINTH = 1.08, LOW1 = 3.06, UP0 = 4.94, UP1 = 6.92, PIER = 0.6;
type P2 = [number, number];
let B: BuildingTools;

const frameOf = (a: P2, c: P2): FR => {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const t: P2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  return {f: {origin: a, tangent: t, n: [-t[1], t[0]]} as Frame, len};
};

export function buildCommandementsgebouw(_w: number, _d: number, b: BuildingTools) {
  B = b;
  resetFaces();
  // the flat roof on the facade ring itself (the 3DBAG roof ring stands up to 0.23 m off it, which left the wall tops open)
  b.add(upwardRoofPlane(new T.Shape(ring.map(p => new T.Vector2(p[0], p[1]))), TOP), 'dark');
  const sink0 = getSink();
  setSink(0.08, true);
  // the south-east front: edges 8 and 0 lie on one line; read from the south-west end (ring[8]) to the north-east (ring[1])
  const e2 = ringFrame(ring, 2);
  const se0 = ringFrame(ring, 8), flip = Math.hypot(se0.f.origin[0] - ring[8][0], se0.f.origin[1] - ring[8][1]) > 0.01;
  const SE = flip ? frameOf(ring[1] as P2, ring[8] as P2) : frameOf(ring[8] as P2, ring[1] as P2);
  southEast(SE);
  northWest(e2);
  northEast(ringFrame(ring, 1));
  for (const i of [3, 4, 5, 6, 7]) brickEnd(ringFrame(ring, i), i === 3);
  // the coping: a light metal band flush on the top 12 cm of every wall (a proud slab z-fought or pierced the roof)
  for (let i = 1; i < 8; i++) face(ringFrame(ring, i), CAP, TOP, 'pink');
  face(SE, CAP, TOP, 'pink');
  flushFaces(b);
  setSink(sink0);
}

/** Concrete panel bands and the two window ribbons over [t0, t1]; `skip(t, upper)` leaves a bay out, `louvre` closes one. */
function ribbons(F: FR, t0: number, t1: number, n: number, o: {skip?: (t: number, upper: boolean) => boolean; louvre?: (t: number, upper: boolean) => boolean; upper?: boolean; lower?: boolean} = {}) {
  const pitch = (t1 - t0) / n;
  const bands: [number, number, boolean][] = [];
  if (o.lower !== false) bands.push([PLINTH, LOW1, false]);
  if (o.upper !== false) bands.push([UP0, UP1, true]);
  for (const [y0, y1, upper] of bands) {
    const R = face(sub(F, t0, t1 - t0), y0, y1, 'greyBrick');
    for (let k = 0; k < n; k++) {
      const t = pitch * (k + 0.5);
      if (o.skip?.(t0 + t, upper)) continue;
      if (o.louvre?.(t0 + t, upper)) { louvre(F, t0 + t, y0 + 0.1, pitch - 0.34, y1 - y0 - 0.2); continue; }
      opening(B, R, t, y0 + 0.08, pitch - 0.34, y1 - y0 - 0.16, {depth: 0.12, frame: 'frame', edge: 0.08, cols: 2, bars: [(y1 - y0 - 0.16) * 0.74], sill: false});
    }
  }
}
function louvre(F: FR, t: number, y: number, w: number, h: number) {
  slab(B, F.f, t, y, w, h, 0.04, 'greyBrick', 0);
  for (let yy = y + 0.12; yy < y + h - 0.05; yy += 0.14) ledgeStrip(B, F.f, t, yy, w - 0.1, 0.04, 0.04, 'dark', 0.03);
}
/** Concrete panel face between y0 and y1 over [t0, t1], with a vertical joint every `joint` metres. */
function panel(F: FR, t0: number, t1: number, y0: number, y1: number, joint = 3.96) {
  face(sub(F, t0, t1 - t0), y0, y1, 'concrete');
  for (let t = t0 + joint; t < t1 - 0.3; t += joint) ledgeStrip(B, F.f, t, y0 + 0.02, 0.03, y1 - y0 - 0.04, 0.02, 'dark', 0);
}
const sub = (F: FR, t0: number, len: number): FR => ({f: {origin: [F.f.origin[0] + F.f.tangent[0] * t0, F.f.origin[1] + F.f.tangent[1] * t0], tangent: F.f.tangent, n: F.f.n}, len});
function bands(F: FR, t0: number, t1: number) {
  panel(F, t0, t1, 0, PLINTH);
  panel(F, t0, t1, LOW1, UP0);
  panel(F, t0, t1, UP1, CAP);
}
function piers(F: FR) {
  face(sub(F, 0, PIER), 0, CAP, 'brick');
  face(sub(F, F.len - PIER, PIER), 0, CAP, 'brick');
}

function southEast(F: FR) {
  piers(F);
  const t0 = PIER, t1 = F.len - PIER;
  const E0 = 31.2, E1 = 35.2;
  // the plinth and the lower ribbon stop at the entrance: 16 bays left of it, four narrower ones right
  panel(F, t0, E0, 0, PLINTH);
  panel(F, E1, t1, 0, PLINTH);
  panel(F, t0, t1, LOW1, UP0);
  panel(F, t0, t1, UP1, CAP);
  ribbons(F, t0, t1, 22, {lower: false});
  ribbons(F, t0, E0, 16, {upper: false});
  ribbons(F, E1, t1, 4, {upper: false});
  // the entrance: brick cheeks round a glazed door pair, a flat canopy at 2.5 m and a clerestory strip over it
  const ent = face(sub(F, E0, E1 - E0), 0, LOW1, 'brick');
  const mid = (E1 - E0) / 2;
  opening(B, ent, mid, 0.05, 2.6, 2.4, {depth: 0.3, frame: 'greyBrick', edge: 0.08, cols: 2, back: 'glass', sill: false});
  opening(B, ent, mid, 2.74, 2.6, 0.26, {depth: 0.1, frame: 'frame', edge: 0.05, cols: 3, sill: false});
  slab(B, F.f, E0 + mid, 2.48, E1 - E0 + 0.4, 0.22, 1.4, 'concrete', 0);
}

function northWest(F: FR) {
  piers(F);
  const S0 = 8.6, S1 = 12.0, P0 = 12.0, P1 = 15.8, R0 = 16.0, R1 = F.len - PIER, WALK = 32.1;
  bands(F, PIER, S0);
  ribbons(F, PIER, S0, 4);
  // the glazed stair tower: one curtain of glass to 6.9 m in two columns, transoms every 1.15 m, a fascia over it
  slab(B, F.f, (S0 + S1) / 2, 0, S1 - S0, UP1, 0.08, 'glass', -0.15);
  for (const t of [S0 + 0.05, (S0 + S1) / 2, S1 - 0.05]) ledgeStrip(B, F.f, t, 0, 0.08, UP1, 0.06, 'greyBrick', -0.08);
  for (let y = 1.15; y < UP1; y += 1.15) ledgeStrip(B, F.f, (S0 + S1) / 2, y, S1 - S0, 0.06, 0.06, 'greyBrick', -0.08);
  face(sub(F, S0, S1 - S0), UP1, CAP, 'concrete');
  // the closed panel with a strip window at the head of each ribbon
  face(sub(F, P0, P1 - P0), 0, CAP, 'concrete');
  for (const y of [LOW1 - 0.42, UP1 - 0.42]) {
    slab(B, F.f, (P0 + P1) / 2, y, P1 - P0 - 0.5, 0.36, 0.05, 'glass', 0);
    for (let t = P0 + 0.25; t <= P1 - 0.24; t += (P1 - P0 - 0.5) / 3) ledgeStrip(B, F.f, t, y, 0.06, 0.36, 0.06, 'frame', 0);
  }
  face(sub(F, P1, R0 - P1), 0, CAP, 'concrete');
  bands(F, R0, R1);
  const pitch = (R1 - R0) / 14;
  ribbons(F, R0, R1, 14, {
    louvre: (t, upper) => (upper && Math.abs(t - (R0 + pitch * 6.5)) < 0.1) || (!upper && t > R1 - 2 * pitch),
  });
  // the covered walkway along the lower ribbon from t 32.1 (beam 3.2-3.5 m, 2.4 m deep) on two round posts
  slab(B, F.f, (WALK + F.len) / 2 + 0.2, 3.2, F.len - WALK + 0.4, 0.3, 2.4, 'greyBrick', 0);
  for (const t of [WALK + 0.2, WALK + 3.1]) strut(B, at(F, t, 0, 2.2), at(F, t, 3.2, 2.2), 0.16, 'greyBrick', 8);
}

function northEast(F: FR) {
  const W = face(F, 0, CAP, 'brick');
  // the glazed door at t 10.8-11.9 (w03-56 2017 view), counted from the left end
  opening(B, W, 11.35, 0.05, 1.0, 2.25, {depth: 0.15, frame: 'greyBrick', edge: 0.08, back: 'glass', bars: [1.15], sill: false});
  for (const t of [0.35, F.len - 0.35]) downpipe(F, t);
}
function brickEnd(F: FR, window: boolean) {
  const W = face(F, 0, CAP, 'brick');
  if (window) opening(B, W, F.len * 0.55, 5.4, 0.7, 0.9, {depth: 0.12, frame: 'frame', edge: 0.07, sill: false});
}
function downpipe(F: FR, t: number) {
  ledgeStrip(B, F.f, t, 0, 0.1, TOP - 0.2, 0.1, 'dark', 0);
}
function at(F: FR, t: number, y: number, o: number): [number, number, number] {
  return [F.f.origin[0] + F.f.tangent[0] * t + F.f.n[0] * o, y, F.f.origin[1] + F.f.tangent[1] * t + F.f.n[1] * o];
}
