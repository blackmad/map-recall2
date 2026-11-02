import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {letters, ledgeStrip, poly, slab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Politiebureau Oost / Watergraafsmeer, Linnaeusstraat 111 (BAG pand 0363100012131469, bouwjaar 2003, one kantoorfunctie
 * VBO of 4070 m2; BAG, CC0). The base of the police neighbourhood team (Staatscourant stcrt-2015-31737). The architect is
 * not named by the BAG, the monument registers (no record) or nl.wikipedia; unconfirmed.
 * Native frame of scripts/landmarks/politie-oost-watergraafsmeer-footprints.json (x east, z south, y up from 0.40 m NAP).
 *
 * A plain five-storey brick block, flat roof at 19.65 m (3DBAG LoD2.2, CC BY 4.0) with two roof boxes (22.15 and 20.17 m).
 * The BAG ring is four straight walls (its many vertices are collinear): west on the Linnaeusstraat 34.2 m, south 23.4 m,
 * east 34.2 m, north 24.2 m. Every face is one grid of punched windows on a ~1.9 m pitch with a narrow glazed bay at both
 * corners, but the grid's lower storeys change along the plan (measured on the rectified Gemeente Amsterdam panorama crops
 * of the brief, CC BY 4.0: w02-250 49.8 px/m, w05-249 50.8, w04-161 44.9, w03-341 48.6, w01-71 49.9):
 *  - south type (the Linnaeusstraat south half, the whole south face, the east face's south end): tall ground windows
 *    0.15-4.3, short windows 5.6-7.3, then 8.6-11.0, 12.2-14.6, 15.8-18.2;
 *  - middle type: low ground openings 0.15-2.5, tall windows 3.8-7.3 (transom 5.6), then the upper three;
 *  - north type (the north end of both long faces and the whole north face): low ground openings, short windows 3.8-5.6,
 *    tall windows 6.85-10.9 (transom 8.9), then the upper two.
 * The lower windows are dark glass in brown timber frames; the upper ones light (blinds) in pale aluminium frames.
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];

// BAG corners (native x, z) and the four faces seen from outside, t running to the viewer's right.
const NW: P2 = [-12.753, -20.36], SW: P2 = [-0.77, 11.683], SE: P2 = [21.334, 3.98], NE: P2 = [10.093, -28.339];
const TOP = 19.65, COPING = 0.12;

function geom(pos: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function lineFrame(p: P2, q: P2): {f: Frame; len: number} {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
  return {f: {origin: p, tangent: [tx, tz], n: [-tz, tx]}, len};
}
function wall(b: BuildingTools, face: {f: Frame; len: number}, y0: number, y1: number, c: Col) {
  const {f, len} = face, p = f.origin, q: P2 = [p[0] + f.tangent[0] * len, p[1] + f.tangent[1] * len];
  b.add(geom([p[0], y0, p[1], q[0], y0, q[1], p[0], y1, p[1], q[0], y0, q[1], q[0], y1, q[1], p[0], y1, p[1]]), c);
}
const shapeOf = (pts: P2[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));

type Hole = HoledOpening & {back: Col | null};
type Face = {f: Frame; len: number; y0: number; y1: number; c: Col; holes: Hole[]};
let FACES: Face[] = [];
function face(fr: {f: Frame; len: number}, y0: number, y1: number, c: Col): Face {
  const F: Face = {...fr, y0, y1, c, holes: []}; FACES.push(F); return F;
}
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
/** Opening cut into a face, its back `depth` in; the frame strips and bars stand 9 cm off the glass inside the reveal. */
function opening(b: BuildingTools, F: Face, t: number, y: number, w: number, h: number, o: {depth?: number; frame?: Col; back?: Col; edge?: number; bars?: number[]; cols?: number} = {}) {
  const depth = o.depth ?? 0.18, frame = o.frame ?? 'frame', back = o.back ?? 'dark', fw = o.edge ?? 0.06, d = Math.min(0.09, depth - 0.03), out = -depth;
  F.holes.push({t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back});
  if (fw > 0) {
    // The bottom rail is at least 10 cm tall: its top face then stands clear of the sill below it (z-fight-near at 6 cm).
    const fb = Math.max(fw, 0.1);
    ledgeStrip(b, F.f, t, y, w, fb, d, frame, out);
    ledgeStrip(b, F.f, t, y + h - fw, w, fw, d, frame, out);
    for (const s of [-1, 1]) ledgeStrip(b, F.f, t + s * (w - fw) / 2, y + fb, fw, h - fw - fb, d, frame, out);
  }
  for (let k = 1; k < (o.cols ?? 1); k++) ledgeStrip(b, F.f, t - w / 2 + w * k / o.cols!, y + fw, 0.06, h - 2 * fw, d, frame, out);
  for (const yb of o.bars ?? []) ledgeStrip(b, F.f, t, y + yb - 0.03, w - 2 * fw, 0.06, d, frame, out);
}

// ---- the window grid ---------------------------------------------------------------------------------------------------
const UPPER = {w: 1.18, frame: 'white' as Col, back: 'glass' as Col};
const LOWER = {w: 1.1, frame: 'frame' as Col, back: 'dark' as Col};
/** Light upper windows (blinds behind pale aluminium frames) at sill y, head y + h. */
const upper = (b: BuildingTools, F: Face, t: number, y: number, h: number, w = UPPER.w) => opening(b, F, t, y, w, h, {frame: UPPER.frame, back: UPPER.back});
const lower = (b: BuildingTools, F: Face, t: number, y: number, h: number, bars: number[] = [], w = LOWER.w) => opening(b, F, t, y, w, h, {bars});
type Kind = 'S' | 'M' | 'N';
/** Storeys above the ground for one column of the grid. */
function stack(b: BuildingTools, F: Face, t: number, k: Kind, w = 0) {
  const ww = w || undefined;
  if (k === 'S') { lower(b, F, t, 5.6, 1.7, [], ww); upper(b, F, t, 8.6, 2.4, ww); }
  if (k === 'M') { lower(b, F, t, 3.8, 3.5, [1.8], ww); upper(b, F, t, 8.6, 2.4, ww); }
  if (k === 'N') { lower(b, F, t, 3.8, 1.8, [], ww); lower(b, F, t, 6.85, 4.05, [2.05], ww); }
  upper(b, F, t, 12.2, 2.4, ww); upper(b, F, t, 15.8, 2.4, ww);
}
/** Ground openings: tall timber windows, low light windows (blinds), doors and louvres. */
type Ground = 'tall' | 'low' | 'door' | 'louvre' | 'blank' | 'porch';
function ground(b: BuildingTools, F: Face, t: number, g: Ground) {
  if (g === 'tall') lower(b, F, t, 0.15, 4.15, [1.6]);
  if (g === 'low' || g === 'louvre') upper(b, F, t, 0.15, 2.35, 1.1);
  if (g === 'door') opening(b, F, t, 0.15, 1.0, 2.4, {back: 'dark', frame: 'dark', edge: 0});
  if (g === 'porch') opening(b, F, t, 0.15, 1.3, 4.15, {depth: 1.2, back: 'dark', frame: 'stone', edge: 0.1});
}
/** The narrow glazed bays at the corners: glass on the levels of that end's column type, 0.2 m of brick at the corner. */
function cornerBay(b: BuildingTools, F: Face, t: number, k: Kind, withGround: boolean, w = 1.0) {
  if (withGround) upper(b, F, t, 0.15, 2.35, w);
  stack(b, F, t, k, w);
}
const cols = (first: number, pitch: number, n: number) => Array.from({length: n}, (_, i) => first + i * pitch);

/** The blue police lozenge with POLITIE in silver (w05-249, w04-161): 1.1 m wide, 1.0 m tall, centre y. */
function shield(b: BuildingTools, f: Frame, t: number, y: number) {
  poly(b, f, t, y - 0.5, [[0, 0], [0.55, 0.5], [0, 1.0], [-0.55, 0.5]], 0.08, 'blue', 0.0);
  letters(b, f, 'POLITIE', t, y - 0.07, 0.08, 0.018, 0.02, 'gold');
}

export function buildPolitieOostWatergraafsmeer(_w: number, _d: number, b: BuildingTools) {
  const W = face(lineFrame(NW, SW), 0, TOP, 'brick');   // Linnaeusstraat, t from the north
  const S = face(lineFrame(SW, SE), 0, TOP, 'brick');   // t from the west
  const E = face(lineFrame(SE, NE), 0, TOP, 'brick');   // t from the south
  const N = face(lineFrame(NE, NW), 0, TOP, 'brick');   // t from the east

  // Linnaeusstraat (w02-250, w05-249): 16 columns; 1-5 north type, 6-10 middle, 11-16 south; the entrance in 15-16.
  cols(2.4, 1.925, 16).forEach((t, i) => {
    const k: Kind = i < 5 ? 'N' : i < 10 ? 'M' : 'S';
    stack(b, W, t, k);
    ground(b, W, t, i < 10 ? 'low' : i < 14 ? 'tall' : 'porch');
  });
  cornerBay(b, W, 0.75, 'N', true);
  cornerBay(b, W, W.len - 0.75, 'S', false);

  // South face (w04-161): 11 columns, all south type; the porch under column 1, seven tall windows, the garage door.
  cols(2.94, 1.87, 11).forEach((t, i) => {
    stack(b, S, t, 'S');
    if (i >= 1 && i <= 7) ground(b, S, t, 'tall');
  });
  ground(b, S, 2.94, 'porch');
  opening(b, S, 19.8, 0.15, 4.4, 4.15, {depth: 0.35, back: 'dark', frame: 'stone', edge: 0.18, bars: [2.9]}); // garage
  cornerBay(b, S, 0.85, 'S', false);
  // The south-east corner's glass shows only 0.45 m on this face (w04-161), 0.67 m past column 11: drawn on the east face only.

  // East face (w01-71): 17 columns; 1-6 south type over blank brick, 7-13 middle (doors under 7-12), 14-17 north type.
  cols(2.5, 1.84, 17).forEach((t, i) => {
    stack(b, E, t, i < 6 ? 'S' : i < 13 ? 'M' : 'N');
    if (i >= 6 && i <= 11) ground(b, E, t, 'door');
  });
  cornerBay(b, E, 0.75, 'S', false);
  cornerBay(b, E, E.len - 0.75, 'N', false);   // blank brick at the north-east corner's ground (w01-71)

  // North face (w03-341): 12 columns of the north type; a door under column 5, louvres under 10-12, POLITIE up at the west end.
  cols(1.85, 1.88, 12).forEach((t, i) => {
    stack(b, N, t, 'N');
    if (i === 4) ground(b, N, t, 'door');
    if (i >= 9) ground(b, N, t, 'louvre');
  });
  cornerBay(b, N, 0.6, 'N', false);
  // The north-west corner's glass shows only 0.45 m on this face (w03-341), 0.8 m past column 12: drawn on the Linnaeusstraat face only.

  flushFaces(b);


  // Coping: a thin pale metal edge round the roof.
  for (const F of [W, S, E, N]) slab(b, F.f, F.len / 2, TOP - COPING, F.len + 0.2, COPING, 0.1, 'concrete');
  b.add(upwardRoofPlane(shapeOf([NW, SW, SE, NE]), TOP), 'slate');
  // Roof boxes (3DBAG roof parts; not seen from the street).
  roofBox(b, [[7.393, -14.125], [4.243, -12.828], [4.462, -12.401], [4.151, -12.207], [5.368, -10.943], [8.043, -12.187]], 22.15);
  roofBox(b, [[4.212, -9.257], [3.472, -12.51], [1.696, -11.779], [1.154, -11.352], [1.873, -9.1]], 20.17);

  // Signs: the lozenge over the Linnaeusstraat entrance and on the south face; POLITIE lettering on the north face.
  shield(b, W.f, 28.4, 5.0);
  shield(b, S.f, 5.75, 5.0);
  const tL = 21.9, px = 0.08;
  letters(b, N.f, 'P LITIE', tL, 15.1, 0, px, 0.07, 'blue', 0.1);
  poly(b, N.f, tL - 2 * 6 * px + 2.5 * px - 3 * 6 * px + 3 * px, 15.0, [[-0.22, 0.25], [0.22, 0.25], [0.24, 0.6], [0, 0.95], [-0.24, 0.6]], 0.07, 'gold');

  // The flagpole bracketed to the Linnaeusstraat front at its south end, rising 5 m over the roof (w02-250, w05-249).
  const tp = 30.15, op = 0.3, pf = W.f;
  const px0 = pf.origin[0] + pf.tangent[0] * tp + pf.n[0] * op, pz0 = pf.origin[1] + pf.tangent[1] * tp + pf.n[1] * op;
  b.add(new T.CylinderGeometry(0.045, 0.06, 10.2, 8).translate(px0, 14.8 + 5.1, pz0), 'concrete');
  for (const y of [15.2, 18.9]) slab(b, pf, tp, y, 0.08, 0.08, op, 'concrete');
}

function roofBox(b: BuildingTools, ring: P2[], top: number) {
  for (let i = 0; i < ring.length; i++) {
    // ring order from the 3DBAG part; draw both windings' outward side by testing the signed area
    const p = ring[i], q = ring[(i + 1) % ring.length];
    wall(b, area(ring) > 0 ? lineFrame(q, p) : lineFrame(p, q), TOP, top, 'greyBrick');
  }
  b.add(upwardRoofPlane(shapeOf(ring), top), 'slate');
}
function area(r: P2[]) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; }
