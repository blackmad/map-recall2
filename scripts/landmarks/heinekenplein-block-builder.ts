import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {awning, letters, ledgeStrip, poly, slab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';

/**
 * The Heinekenplein block: Stadhouderskade 79 (offices) and Marie Heinekenplein 25 (the Dirk supermarket), BAG pand
 * 0363100012130580, bouwjaar 1995, 9 bouwlagen (BAG, CC0). It stands on the site of the old Heineken brewery (nl.wikipedia
 * "Marie Heinekenplein": the brewery's southern buildings were demolished in 1988 and the first pile was driven on
 * 27 April 1993). The architect is not named by nl.wikipedia, the BAG or the monument registers (no monument record).
 * Native frame of scripts/landmarks/heinekenplein-block-footprints.json (x east, z south, y up from the 0.33 m NAP street).
 *
 * The plan is square to one pair of axes (every BAG edge within 0.05 m): e east, n north along the Eerste Van der
 * Helststraat front, origin its south-east BAG vertex (9.264, 60.462); E = (0.9945, 0.1051), N = (0.1051, -0.9945)
 * (bearing 6). Volumes from the BAG ring and the 3DBAG LoD2.2 roof parts (CC BY 4.0), heights above the street:
 *  - the red-brick bar on the street, e -15..0, n 0..99.3, roof 15.3 m, four storeys; the passage recess n 41.4..48.4 is
 *    1.9 m deep; the gateway into the brewery yard runs under the bar at n 70..76;
 *  - behind it the Dirk / car-park deck, e -40.2..-15, n 0..66.9, roofs 13.0 and 11.6 m (party walls to the south and west);
 *  - a one-storey roof pavilion e -15..-6.5, n 73.5..90.8 at 18.8 m, the low court roof e -31.2..-15, n 76.9..90.8 at 4.5 m;
 *  - the office block (Stadhouderskade 79) e -24.8..-1.73, n 90.8..106.56, ten storeys to 32.3 m, its plant room
 *    e -11..-5, n 91..99 to 35.1 m; in front of it on the Stadhouderskade the beige seven-storey front e -24.8..-8.36,
 *    n 106.56..108.07, to 23.0 m.
 * Openings measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of the brief: w02-96 (50 px/m, the bar's
 * south half), w01-96 (45.8 px/m, its north half), w09-96 (the passage recess), w04-6 (the beige front) and the aimed views
 * in heinekenplein-block-inventory.json. INFERRED: the office block's south and west faces, the court and deck faces.
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];

const O: P2 = [9.264, 60.462], E: P2 = [0.9944593, 0.1051224], N: P2 = [0.1051224, -0.9944593];
const A = (e: number, n: number): P2 => [O[0] + e * E[0] + n * N[0], O[1] + e * E[1] + n * N[1]];

// ---- plan and levels (e, n metres; y above the street) ---------------------------------------------------------------
const BAR = {e0: -15, top: 15.3, n1: 99.34};
const RECESS = {n0: 41.43, n1: 48.39, e: -1.9};
const DECK = {e0: -40.17, eMid: -23, n1: 66.9, top: 13.0, topEast: 11.6};
const PAV = {e0: -15, e1: -6.5, n0: 73.5, n1: 90.8, top: 18.8};
const COURT = {e0: -31.17, n0: 76.9, n1: 90.8, top: 4.5};
const BOX = {e0: -24.8, e1: -1.73, n0: 90.8, n1: 106.56, top: 32.3};
const PLANT = {e0: -11, e1: -5, n0: 91, n1: 99, top: 35.1};
const FRONT = {e0: -24.8, e1: -8.36, n1: 108.07, top: 23.0};
/** Office floors: a 4.3 m ground storey, then 3.1 m (ten storeys to 32.2 m; the beige front's top at 23.0 m is floor 8). */
const FLOORS = [0, 4.3, 7.4, 10.5, 13.6, 16.7, 19.8, 22.9, 26.0, 29.1];
/** The bar (w02-96): ground 0-4.4, square windows on storeys 2-3 (sills 5.2 and 8.7, 1.08 x 1.2), ribbons on storey 4. */
const BAR_SILLS = [5.2, 8.7], BAR_WIN = {w: 1.08, h: 1.2}, RIBBON = {y: 11.9, h: 1.3};

// ---- primitive helpers -------------------------------------------------------------------------------------------------
function geom(pos: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function lineFrame(p: P2, q: P2): {f: Frame; len: number} {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
  return {f: {origin: p, tangent: [tx, tz], n: [-tz, tx]}, len};
}
/** Faces seen from outside, t running to the viewer's right. */
const fE = (e: number, n0: number, n1: number) => lineFrame(A(e, n0), A(e, n1));   // east-facing, t from the south
const fN = (e0: number, e1: number, n: number) => lineFrame(A(e1, n), A(e0, n));   // north-facing, t from the east
const fW = (e: number, n0: number, n1: number) => lineFrame(A(e, n1), A(e, n0));   // west-facing, t from the north
const fS = (e0: number, e1: number, n: number) => lineFrame(A(e0, n), A(e1, n));   // south-facing, t from the west
function wall(b: BuildingTools, face: {f: Frame; len: number}, y0: number, y1: number, c: Col) {
  const {f, len} = face, p = f.origin, q: P2 = [p[0] + f.tangent[0] * len, p[1] + f.tangent[1] * len];
  b.add(geom([p[0], y0, p[1], q[0], y0, q[1], p[0], y1, p[1], q[0], y0, q[1], q[0], y1, q[1], p[0], y1, p[1]]), c);
}
const shapeOf = (pts: P2[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
const capUp = (b: BuildingTools, en: P2[], y: number, c: Col) => b.add(upwardRoofPlane(shapeOf(en.map(p => A(p[0], p[1]))), y), c);
const rect = (e0: number, e1: number, n0: number, n1: number): P2[] => [[e0, n0], [e1, n0], [e1, n1], [e0, n1]];

/** Flat faces with cut openings (holedWall.ts); `void` holes are parts of a face's rectangle that are not wall. */
type Hole = HoledOpening & {back: Col | null};
type Face = {f: Frame; len: number; y0: number; y1: number; c: Col; holes: Hole[]};
let FACES: Face[] = [];
function face(fr: {f: Frame; len: number}, y0: number, y1: number, c: Col): Face {
  const F: Face = {...fr, y0, y1, c, holes: []}; FACES.push(F); return F;
}
const voidHole = (F: Face, t0: number, t1: number, y0: number, y1: number) => F.holes.push({t0, t1, y0, y1, depth: 0, back: null});
function flushFaces(b: BuildingTools) {
  for (const F of FACES) {
    const hw = holedWall(F.len, F.y0, F.y1, F.holes);
    const P = (q: [number, number, number]) => [F.f.origin[0] + F.f.tangent[0] * q[0] + F.f.n[0] * q[2], q[1], F.f.origin[1] + F.f.tangent[1] * q[0] + F.f.n[1] * q[2]];
    const tris = (qs: WallQuad[]) => qs.flatMap(q => { const v = q.pts.map(P); return [...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]]; });
    b.add(geom([...tris(hw.face), ...tris(hw.reveals.flat())]), F.c);
    const byBack = new Map<Col, WallQuad[]>();
    F.holes.forEach((h, i) => { if (h.back) byBack.set(h.back, [...(byBack.get(h.back) ?? []), hw.backs[i]]); });
    for (const [c, qs] of byBack) b.add(geom(tris(qs)), c);
  }
  FACES = [];
}
/**
 * Opening cut into a face, its back `depth` in: glazing bars (cols x rows lights) and a thin frame round the glass stand
 * 9 cm off the back, inside the reveal, so nothing lies on the wall plane.
 */
function opening(b: BuildingTools, F: Face, t: number, y: number, w: number, h: number, o: {depth?: number; cols?: number; rows?: number; frame?: Col; back?: Col; edge?: number; bars?: number[]} = {}) {
  const depth = o.depth ?? 0.18, frame = o.frame ?? 'frame', back = o.back ?? 'glass', fw = o.edge ?? 0.06, d = Math.min(0.09, depth - 0.03), out = -depth;
  F.holes.push({t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back});
  if (fw > 0) {
    ledgeStrip(b, F.f, t, y, w, fw, d, frame, out);
    ledgeStrip(b, F.f, t, y + h - fw, w, fw, d, frame, out);
    for (const s of [-1, 1]) ledgeStrip(b, F.f, t + s * (w - fw) / 2, y + fw, fw, h - 2 * fw, d, frame, out);
  }
  const cols = o.cols ?? 1, rows = o.rows ?? 1;
  for (let k = 1; k < cols; k++) ledgeStrip(b, F.f, t - w / 2 + w * k / cols, y + fw, 0.06, h - 2 * fw, d, frame, out);
  for (let k = 1; k < rows; k++) ledgeStrip(b, F.f, t, y + h * k / rows - 0.03, w - 2 * fw, 0.06, d, frame, out);
  for (const yb of o.bars ?? []) ledgeStrip(b, F.f, t, y + yb - 0.03, w - 2 * fw, 0.06, d, frame, out);
}
/** Square stone block standing 6 cm proud (the anchor plates of the bar's parapet and the beige front). */
const block = (b: BuildingTools, f: Frame, t: number, y: number, s = 0.24) => slab(b, f, t, y, s, s, 0.06, 'concrete');

// ---- the red-brick bar on the Eerste Van der Helststraat -----------------------------------------------------------------
/** Top-storey ribbon of `w` metres from t0, its lights about 1 m wide (w01/w02: six lights per 6.3 m panel). */
function ribbon(b: BuildingTools, F: Face, t0: number, t1: number, y = RIBBON.y, h = RIBBON.h) {
  const w = t1 - t0;
  opening(b, F, (t0 + t1) / 2, y, w, h, {cols: Math.max(1, Math.round(w / 1.05))});
}
const squareWin = (b: BuildingTools, F: Face, t: number, sill: number) => opening(b, F, t, sill, BAR_WIN.w, BAR_WIN.h, {depth: 0.2});
/** Shop front: glass from 0.15 to 2.8 m, mullions on a ~1.5 m pitch, a transom at 2.3 m, the thin steel canopy above. */
function shopfront(b: BuildingTools, F: Face, t0: number, t1: number, canopy = true) {
  const w = t1 - t0;
  opening(b, F, (t0 + t1) / 2, 0.15, w, 2.65, {depth: 0.25, cols: Math.max(1, Math.round(w / 1.55)), bars: [2.15]});
  if (canopy) slab(b, F.f, (t0 + t1) / 2, 2.9, w + 0.3, 0.12, 0.55, 'bronze');
}
function bar(b: BuildingTools) {
  // shell -------------------------------------------------------------------------------------------------------------
  const south = face(fE(0, 0, RECESS.n0), 0, BAR.top, 'brick');          // w02-96, 41.4 m
  const north = face(fE(0, RECESS.n1, BAR.n1), 0, BAR.top, 'brick');     // w01-96, 50.95 m
  const recess = face(fE(RECESS.e, RECESS.n0, RECESS.n1), 0, BAR.top, 'brick'); // w09-96
  wall(b, fN(RECESS.e, 0, RECESS.n0), 0, BAR.top, 'brick');
  wall(b, fS(RECESS.e, 0, RECESS.n1), 0, BAR.top, 'brick');
  wall(b, fN(BOX.e1, 0, BAR.n1), 0, BAR.top, 'brick');                   // the bar's end return at the office corner
  wall(b, fS(BAR.e0, 0, 0), 0, BAR.top, 'brick');                         // party wall to Quellijnstraat (neighbours 15.2 m)
  wall(b, fW(BAR.e0, 0, DECK.n1), DECK.topEast, BAR.top, 'brick');        // over the deck
  const neck = face(fW(BAR.e0, DECK.n1, COURT.n0), 0, BAR.top, 'brick');  // the gateway yard side (inferred)
  wall(b, fW(BAR.e0, COURT.n0, BOX.n0), COURT.top, BAR.top, 'brick');
  capUp(b, [[BAR.e0, 0], [0, 0], [0, RECESS.n0], [RECESS.e, RECESS.n0], [RECESS.e, RECESS.n1], [0, RECESS.n1], [0, BAR.n1], [BOX.e1, BAR.n1],
    [BOX.e1, BOX.n0], [PAV.e1, BOX.n0], [PAV.e1, PAV.n0], [BAR.e0, PAV.n0]], BAR.top, 'slate');
  // coping: a thin grey metal edge on the street fronts
  for (const F of [south, north, recess]) slab(b, F.f, F.len / 2, BAR.top - 0.18, F.len, 0.26, 0.08, 'concrete');

  // south half (w02-96, t = n): 20 square windows per storey on a 1.76 m pitch, six ribbons on storey 4 ---------------
  for (const sill of BAR_SILLS) for (let k = 1; k <= 20; k++) squareWin(b, south, 1.76 * k, sill);
  for (const [t0, t1] of [[0.25, 2.1], [2.9, 8.9], [9.7, 15.9], [16.7, 23.0], [23.8, 30.3], [31.1, 35.9]]) ribbon(b, south, t0, t1);
  for (let t = 4.8; t < 38; t += 3.52) block(b, south.f, t, 14.0);
  // ground: Dirk corner shop under its red awning, the goods entrance, three Dirk windows, the entrance bay
  shopfront(b, south, 0.3, 2.3, false);
  awning(b, south.f, 1.3, 2.75, 2.4, 0.7, 1.1, 'red');
  opening(b, south, 6.15, 0.12, 6.1, 3.2, {depth: 0.6, back: 'dark', cols: 2, frame: 'dark'});   // goods entrance, roller doors
  for (const [t0, t1] of [[9.8, 16.0], [16.7, 23.1], [23.9, 30.1]]) shopfront(b, south, t0, t1);
  opening(b, south, 33.5, 0.12, 4.8, 2.7, {depth: 0.6, back: 'glass', cols: 3, frame: 'dark'});  // shop entrance
  slab(b, south.f, 33.5, 2.9, 5.1, 0.12, 0.55, 'bronze');
  // the Dirk drum sign on a bracket at the passage corner (w02-96 right edge)
  dirkDrum(b, south.f, 40.2, 4.0);

  // north half (w01-96, t = n - 48.19 on the crop; this face starts at 48.39) ----------------------------------------
  const tN = (t: number) => t - (RECESS.n1 - 48.19);
  const AX = [40, 115, 190, 265, 340, 415, 490, 565, 640, 715, 790, 860, 935, 1005, 1075, 1145, 1215, 1285, 1355, 1425, 1495, 1565, 1635, 1705, 1770, 1840].map(px => px * 0.0256);
  const GATE = [21.6, 27.9];
  for (const t of AX) {
    squareWin(b, north, tN(t), BAR_SILLS[1]);
    if (t > GATE[0] - 0.3 && t < GATE[1] + 0.3) continue;            // storey 2 over the gateway is one ribbon
    squareWin(b, north, tN(t), BAR_SILLS[0]);
  }
  ribbon(b, north, tN(GATE[0]), tN(GATE[1]), BAR_SILLS[0], 1.3);
  for (const [p0, p1] of [[20, 220], [250, 370], [400, 665], [695, 810], [840, 1095], [1125, 1375], [1405, 1650], [1685, 1860]]) ribbon(b, north, tN(p0 * 0.0256), tN(p1 * 0.0256));
  for (let t = 4.2; t < 50; t += 3.68) block(b, north.f, tN(t), 14.0);
  // ground: shop, door, car-park entrance under its blue canopy and sign box, door, the white "4" totem, the gateway with
  // HEINEKEN over it, three steel-framed windows
  shopfront(b, north, tN(0.4), tN(5.5), false);
  opening(b, north, tN(8.25), 0.12, 1.9, 2.5, {depth: 0.25, back: 'dark', frame: 'dark'});
  opening(b, north, tN(13.3), 0.12, 7.2, 3.0, {depth: 2.0, back: 'dark', frame: 'dark', edge: 0});
  slab(b, north.f, tN(13.3), 3.15, 7.6, 0.4, 0.8, 'blue');
  slab(b, north.f, tN(11.3), 3.65, 3.9, 1.45, 0.4, 'blue');   // sign box, under the storey-2 sills
  letters(b, north.f, 'P', tN(10.3), 3.95, 0.4, 0.14, 0.03, 'white');
  opening(b, north, tN(19.1), 0.12, 2.0, 2.6, {depth: 0.25, back: 'dark', frame: 'dark', cols: 4});
  slab(b, north.f, tN(20.8), 0, 0.85, 2.9, 0.4, 'white');
  opening(b, north, tN((GATE[0] + GATE[1]) / 2), 0.12, GATE[1] - GATE[0] - 0.4, 3.95, {depth: 3.0, back: 'dark', frame: 'dark', edge: 0});
  heinekenSign(b, north.f, tN((GATE[0] + GATE[1]) / 2));
  for (const [t0, t1] of [[28.9, 35.1], [36.1, 42.0], [43.1, 47.0]]) opening(b, north, tN((t0 + t1) / 2), 0.35, t1 - t0, 2.75, {depth: 0.25, cols: 4, rows: 3, frame: 'frame', edge: 0.08});

  // the passage recess (w09-96): rendered bands with a ribbon per storey, glazed entrance under a canopy -----------------
  const rl = recess.len;
  for (const y of [5.2, 8.7, 11.9]) opening(b, recess, rl / 2, y, rl - 0.8, 1.3, {cols: 6});
  for (const [y0, y1] of [[4.2, 5.2], [6.5, 8.7], [10.0, 11.9], [13.2, 13.7]]) slab(b, recess.f, rl / 2, y0, rl - 0.8, y1 - y0, 0.08, 'white');
  opening(b, recess, rl / 2, 0.12, rl - 0.8, 3.38, {depth: 0.2, cols: 5, bars: [2.6], frame: 'dark'});
  slab(b, recess.f, rl / 2, 3.6, rl, 0.25, 1.4, 'bronze');

  // the gateway yard face (inferred): plain brick with a service door
  opening(b, neck, neck.len / 2, 0.12, 3.5, 3.5, {depth: 0.3, back: 'dark', frame: 'dark'});
}
/** HEINEKEN over the gateway (w01-96): green letters with the red star on a dark fascia, 4.2-5.1 m (fascia, canopies and brackets are
 * metalwork in the non-opening `bronze` slot, so they never read as glazing). */
function heinekenSign(b: BuildingTools, f: Frame, t: number) {
  slab(b, f, t, 4.15, 6.3, 0.95, 0.08, 'bronze');
  const px = 0.1;
  letters(b, f, 'Heineken', t + 0.35, 4.22, 0.08, px, 0.05, 'green', 0.1);
  const r0 = 0.32, r1 = 0.13, pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r1 : r0; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  poly(b, f, t - 2.55, 4.62, pts, 0.05, 'red', 0.08);
}
/** The Dirk drum: a red cylinder with a white band, 1.4 m across and 3 m tall, on two arms 1.1 m off the wall. */
function dirkDrum(b: BuildingTools, f: Frame, t: number, y: number) {
  const c = [f.origin[0] + f.tangent[0] * t + f.n[0] * 1.15, f.origin[1] + f.tangent[1] * t + f.n[1] * 1.15];
  b.add(new T.CylinderGeometry(0.7, 0.7, 3.0, 14), 'red', c[0], y + 1.5, c[1]);
  b.add(new T.CylinderGeometry(0.78, 0.78, 0.7, 14), 'concrete', c[0], y + 1.6, c[1]);
  for (const yy of [y + 0.4, y + 2.5]) slab(b, f, t, yy, 0.12, 0.12, 0.5, 'bronze');
}

// ---- the deck, the court and the roof pavilion ---------------------------------------------------------------------------
function backParts(b: BuildingTools) {
  wall(b, fW(DECK.e0, 0, DECK.n1), 0, DECK.top, 'brick');                  // party wall to the plein flats
  wall(b, fS(DECK.e0, DECK.eMid, 0), 0, DECK.top, 'brick');                // party walls to Quellijnstraat
  wall(b, fS(DECK.eMid, BAR.e0, 0), 0, DECK.topEast, 'brick');
  const yard = face(fN(DECK.e0, BAR.e0, DECK.n1), 0, DECK.top, 'brick');  // w03-6, to the brewery yard (inferred)
  voidHole(yard, 0, BAR.e0 - DECK.eMid, DECK.topEast, DECK.top);   // the lower east strip of the deck
  for (let t = 2.5; t < yard.len - 1.5; t += 3.5) opening(b, yard, t, 7.6, 1.08, 1.2, {depth: 0.2});
  wall(b, fE(DECK.eMid, 0, DECK.n1), DECK.topEast, DECK.top, 'brick');
  capUp(b, rect(DECK.e0, DECK.eMid, 0, DECK.n1), DECK.top, 'slate');
  capUp(b, rect(DECK.eMid, BAR.e0, 0, DECK.n1), DECK.topEast, 'slate');
  // the low court roof against the brewery
  wall(b, fW(COURT.e0, COURT.n0, COURT.n1), 0, COURT.top, 'brick');
  wall(b, fS(COURT.e0, BAR.e0, COURT.n0), 0, COURT.top, 'brick');
  wall(b, fN(COURT.e0, BOX.e0, COURT.n1), 0, COURT.top, 'brick');
  capUp(b, rect(COURT.e0, BAR.e0, COURT.n0, COURT.n1), COURT.top, 'slate');
  // the roof pavilion: grey brick with a window band (w01-96 top right)
  const pe = face(fE(PAV.e1, PAV.n0, PAV.n1), BAR.top, PAV.top, 'greyBrick');
  wall(b, fS(PAV.e0, PAV.e1, PAV.n0), BAR.top, PAV.top, 'greyBrick');
  wall(b, fW(PAV.e0, PAV.n0, PAV.n1), BAR.top, PAV.top, 'greyBrick');
  opening(b, pe, pe.len / 2, BAR.top + 0.9, pe.len - 1.2, 1.6, {cols: 12, frame: 'white'});
  capUp(b, rect(PAV.e0, PAV.e1, PAV.n0, PAV.n1), PAV.top, 'slate');
}

// ---- the office block on the Stadhouderskade -----------------------------------------------------------------------------
/** Four-light office window (2 x 2), 2.4 x 2.0 m, light frames, sill 0.6 m over the floor. */
const officeWin = (b: BuildingTools, F: Face, t: number, floor: number, w = 2.4) => opening(b, F, t, floor + 0.6, w, 2.0, {depth: 0.18, cols: 2, rows: 2, frame: 'white'});
function office(b: BuildingTools) {
  const {e0, e1, n0, n1, top} = BOX;
  // tower corner faces (w07-96 east, w08-5 north): full height, two windows per storey, deep glazed bays on two storeys
  const towerE = face(fE(e1, BAR.n1, n1), 0, top, 'greyBrick');
  const towerN = face(fN(FRONT.e1, e1, n1), 0, top, 'greyBrick');
  for (const F of [towerE, towerN]) {
    const L = F.len, ts = [L * 0.25, L * 0.75], w = Math.min(2.6, L / 2 - 0.6);
    for (const t of ts) {
      opening(b, F, t, 0.15, w + 0.2, 3.6, {depth: 0.6, cols: 2, bars: [2.6], frame: 'dark'});
      opening(b, F, t, FLOORS[1] + 0.5, w + 0.2, 2.2, {depth: 0.5, cols: 2, frame: 'dark'});
      for (const fl of FLOORS.slice(2)) officeWin(b, F, t, fl, w);
    }
    slab(b, F.f, L / 2, 3.85, L, 0.3, 0.5, 'greyBrick');   // the lintel over the deep ground bays
  }
  // revolving door in the north bay
  b.add(new T.CylinderGeometry(1.0, 1.0, 2.4, 12), 'glass', ...((): [number, number, number] => {
    const t = towerN.len * 0.25, p = towerN.f.origin, tg = towerN.f.tangent, nn = towerN.f.n;
    return [p[0] + tg[0] * t - nn[0] * 0.4, 1.35, p[1] + tg[1] * t - nn[1] * 0.4];
  })());
  letters(b, towerN.f, '79', towerN.len / 2, 1.6, 0.0, 0.07, 0.06, 'white');
  // over the bar: the east face from 15.3 m (w01-96 top right; ne views)
  const eastUp = face(fE(e1, n0, BAR.n1), BAR.top, top, 'greyBrick');
  for (const t of [eastUp.len * 0.25, eastUp.len * 0.75]) for (const fl of FLOORS) if (fl + 0.6 > BAR.top + 0.4) officeWin(b, eastUp, t, fl);
  // north face above the beige front (w04-6 aimed, nn views): four windows per storey on three storeys
  const northUp = face(fN(e0, FRONT.e1, n1), FRONT.top, top, 'greyBrick');
  for (let k = 0; k < 4; k++) for (const fl of FLOORS.slice(7)) officeWin(b, northUp, northUp.len * (k + 0.5) / 4, fl);
  // south face (INFERRED: given the north face's window), over the court, the pavilion and the bar
  const southF = face(fS(e0, e1, n0), COURT.top, top, 'greyBrick');
  voidHole(southF, BAR.e0 - e0, PAV.e1 - e0, COURT.top, PAV.top);
  voidHole(southF, PAV.e1 - e0, southF.len, COURT.top, BAR.top);
  for (let k = 0; k < 6; k++) {
    const t = (k + 0.5) * southF.len / 6, e = e0 + t, floorTop = e < BAR.e0 ? COURT.top : e < PAV.e1 ? PAV.top : BAR.top;
    for (const fl of FLOORS) if (fl + 0.6 > floorTop + 0.4 && Math.abs(e - BAR.e0) > 1.4 && Math.abs(e - PAV.e1) > 1.4) officeWin(b, southF, t, fl);
  }
  // west face: party wall to the brewery (0363100012166152, 24.7 m) with two window storeys above it (INFERRED)
  const westF = face(fW(e0, n0, FRONT.n1), 0, top, 'greyBrick'), lip = FRONT.n1 - n1;
  voidHole(westF, 0, lip, FRONT.top, top);   // the beige front's west end stops at 23.0 m
  for (let k = 0; k < 4; k++) for (const fl of FLOORS.slice(8)) officeWin(b, westF, lip + (westF.len - lip) * (k + 0.5) / 4, fl);
  // roof, parapet coping, plant room
  capUp(b, [[e0, n0], [e1, n0], [e1, n1], [e0, n1]], top, 'slate');
  for (const F of [towerE, towerN, northUp, eastUp]) slab(b, F.f, F.len / 2, top - 0.2, F.len, 0.28, 0.08, 'concrete');
  const {e0: p0, e1: p1, n0: q0, n1: q1} = PLANT;
  for (const fr of [fE(p1, q0, q1), fN(p0, p1, q1), fW(p0, q0, q1), fS(p0, p1, q0)]) wall(b, fr, top, PLANT.top, 'greyBrick');
  capUp(b, rect(p0, p1, q0, q1), PLANT.top, 'slate');
}

// ---- the beige seven-storey front on the Stadhouderskade (w04-6) ---------------------------------------------------------
function beigeFront(b: BuildingTools) {
  const {e0, e1, n1, top} = FRONT;
  const F = face(fN(e0, e1, n1), 0, top, 'stone');
  wall(b, fE(e1, BOX.n1, n1), 0, top, 'stone');
  capUp(b, rect(e0, e1, BOX.n1, n1), top, 'slate');
  slab(b, F.f, F.len / 2, top - 0.22, F.len, 0.3, 0.08, 'concrete');
  // eight square windows per storey on six storeys (crop columns 2.2..14.34 m from the east end, 1.2 m square, dark frames)
  const COLS = [2.2, 3.94, 5.66, 7.4, 9.14, 10.86, 12.6, 14.34].map(t => t * F.len / 16.4);
  for (const fl of FLOORS.slice(1, 7)) for (const t of COLS) opening(b, F, t, fl + 0.9, 1.2, 1.2, {depth: 0.2, rows: 1});
  // the anchor plates between the storeys, at every other column gap
  for (const fl of FLOORS.slice(1, 7)) for (let k = 0; k < 8; k += 2) block(b, F.f, (COLS[k] + COLS[k + 1]) / 2, fl + 0.3, 0.22);
  // four large stone-framed ground windows
  for (const t of [2.6, 6.5, 10.0, 13.5].map(t => t * F.len / 16.4)) {
    opening(b, F, t, 0.7, 2.3, 2.6, {depth: 0.2, cols: 2, frame: 'frame'});
    for (const [dt, y, w, h] of [[0, 0.52, 2.66, 0.18], [0, 3.3, 2.66, 0.18], [-1.24, 0.7, 0.18, 2.6], [1.24, 0.7, 0.18, 2.6]] as const)
      slab(b, F.f, t + dt, y, w, h, 0.08, 'concrete');
  }
}

export function buildHeinekenpleinBlock(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  FACES = [];
  bar(b); b.mark?.('bar');
  backParts(b); b.mark?.('back');
  office(b); b.mark?.('office');
  beigeFront(b); b.mark?.('front');
  flushFaces(b); b.mark?.('faces');
}
