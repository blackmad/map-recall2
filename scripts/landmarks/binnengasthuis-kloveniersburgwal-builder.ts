import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, poly, slab, type Frame} from './nearbar-kit';
import {flushCutFaces, hole, type CutFace} from './cut-face';
import {neckGable} from './neck-gable';
import {roofPrism} from './roof-prism-kit';
import {capRoofsUnderFronts, frontCoords, type FrontZone, type Ring3} from '../../src/canalRecall/landmarks/frontZones';
import {roundedBandOutline} from '../../src/canalRecall/landmarks/roundedBand';
import source from './binnengasthuis-kloveniersburgwal-footprints.json';

/**
 * The Oudemanhuispoort block north of the book-market passage, BAG pand 0363100012171179 (bouwjaar 1757; addresses
 * Oudemanhuispoort 2-4 and Oudezijds Achterburgwal 217, BAG verblijfsobjecten, CC0). The lane brief called it the
 * "Binnengasthuis, Kloveniersburgwal 72 range"; the BAG and the panoramas say otherwise: it is the north and west wings of
 * the Oude Mannen- en Vrouwengasthuis carré (University of Amsterdam since 1880, nl.wikipedia "Oudemanhuispoort", CC BY-SA)
 * between the Kloveniersburgwal, Rusland, the Oudezijds Achterburgwal and the covered passage, with its closed courtyard.
 * The GASTHUIS APOTHEEK portal in the old recipe stands on the next building south of the passage's east gate, not here.
 *
 * Native frame of binnengasthuis-kloveniersburgwal-footprints.json (x east, z south, y up from the 0.56 m NAP street).
 * Rear and courtyard massing: one closed prism under every 3DBAG LoD2.2 roof piece (CC BY 4.0), capped under the measured
 * fronts (frontZones.ts). Street fronts: walls 0.3 m outside the front chords with cut openings, measured on rectified
 * strips of Gemeente Amsterdam panoramas (CC BY 4.0; artifacts/landmark-refs/binnengasthuis-kloveniersburgwal/strip-*.jpg):
 *  - Kloveniersburgwal (south to north): Marnette's 1927 wing "de schaats" (chimney stack, two white glazed bands under a
 *    triple ledge, slate slope, the rounded skate band and glass-block oriel at its foot); a brick pier; the 1950s-60s beige
 *    office front (nine axes, recessed top storey); a four-storey brick front under a tiled roof with two dormers; three
 *    neck-gabled canal houses (rijksmonument 72 is the first: "natuurstenen onderdelen op de halsgevel").
 *  - Rusland: the 1960s-70s brick rear of the lecture halls (Leupen and In 't Hoen renovation): small deep windows, doors
 *    with louvred transoms, concrete roof-light boxes, the stone-clad hall panel and the louvred plant front.
 *  - Oudezijds Achterburgwal: the dark-brick four-storey front with its corner to Rusland, zinc roof edge and stone tablet;
 *    a two-bay house under a wide wooden cornice with consoles and a hipped roof; a pale painted house by the west gate.
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];
type Chord = {a: P2; b: P2};
// 'gold' (accent slot) is tinted as white paint in the catalogue: the painted cornices, consoles, gable rims and plinths.
// 'white' stays for window bands and frames only, which is what the opening audit reads it as.

const OFF = 0.3;   // street walls stand this far outside the front chord (every BAG vertex is within +0.09 m of it)
const KBW: Chord = {a: [35.421, 23.046], b: [67.371, -29.206]};    // 61.25 m, faces ESE
const RUS: Chord = {a: [67.371, -29.206], b: [-30.808, -57.257]};  // 102.11 m, faces N; s from the Kloveniersburgwal corner
const OZA: Chord = {a: [-30.808, -57.257], b: [-44.486, -33.167]}; // 27.70 m, faces WNW; s from the Rusland corner
const OZA2: Chord = {a: [-43.108, -0.74], b: [-44.621, 6.049]};    // 6.96 m, the painted house by the west gate

function frameAt(ch: Chord, s: number, off = OFF): Frame & {len: number} {
  const L = Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]), tx = (ch.b[0] - ch.a[0]) / L, tz = (ch.b[1] - ch.a[1]) / L;
  return {origin: [ch.a[0] + tx * s - tz * off, ch.a[1] + tz * s + tx * off], tangent: [tx, tz], n: [-tz, tx], len: L};
}

// ---- cut faces ---------------------------------------------------------------------------------------------------------
type Sec = {F: CutFace; s0: number; s1: number; ch: Chord};
let FACES: CutFace[] = [];
function sec(ch: Chord, s0: number, s1: number, y0: number, y1: number, c: Col, off = OFF): Sec {
  const fr = frameAt(ch, s0, off), F: CutFace = {f: {origin: fr.origin, tangent: fr.tangent, n: fr.n}, len: s1 - s0, y0, y1, c, holes: []};
  FACES.push(F); return {F, s0, s1, ch};
}
type OpenOpts = {depth?: number; cols?: number; rows?: number; frame?: Col; back?: Col; edge?: number; bars?: number[]};
/** Opening centred at global s; the frame ring and glazing bars stand 9 cm off the back, inside the reveal. */
function opening(b: BuildingTools, S: Sec, s: number, y: number, w: number, h: number, o: OpenOpts = {}) {
  const t = s - S.s0, depth = o.depth ?? 0.16, frame = o.frame ?? 'frame', back = o.back ?? 'glass', fw = o.edge ?? 0.07, d = Math.min(0.09, depth - 0.03), out = -depth;
  if (!hole(S.F, t - w / 2, t + w / 2, y, y + h, depth, back)) throw Error(`opening refused at s=${s.toFixed(2)} y=${y} on ${S.s0}-${S.s1}`);
  const f = S.F.f;
  if (fw > 0) {
    const fb = Math.max(fw, 0.1);
    ledgeStrip(b, f, t, y, w, fb, d, frame, out);
    ledgeStrip(b, f, t, y + h - fw, w, fw, d, frame, out);
    for (const sd of [-1, 1]) ledgeStrip(b, f, t + sd * (w - fw) / 2, y + fb, fw, h - fw - fb, d, frame, out);
  }
  const cols = o.cols ?? 1, rows = o.rows ?? 1;
  for (let k = 1; k < cols; k++) ledgeStrip(b, f, t - w / 2 + w * k / cols, y + fw, 0.05, h - 2 * fw, d, frame, out);
  for (let k = 1; k < rows; k++) ledgeStrip(b, f, t, y + h * k / rows - 0.025, w - 2 * fw, 0.05, d, frame, out);
  for (const yb of o.bars ?? []) ledgeStrip(b, f, t, y + yb - 0.04, w - 2 * fw, 0.08, d, frame, out);
}
/** Coping or cornice over a wall top, reaching back over the gap to the massing; its underside lies on the wall's top edge
 *  (an edge buried inside the box is an open boundary to the hole audit, one on its underside is covered). */
function coping(b: BuildingTools, S: Sec, y: number, h: number, proud: number, c: Col, s0 = S.s0, s1 = S.s1) {
  slab(b, frameAt(S.ch, 0), (s0 + s1) / 2, y, s1 - s0 + 0.02, h, OFF + 0.5 + proud, c, -(OFF + 0.5));
}
/** Closed solid along a front: section polygon in (o, y) (o out of the chord), extruded from s0 to s1. */
function along(b: BuildingTools, ch: Chord, s0: number, s1: number, sect: P2[], c: Col) {
  const fr = frameAt(ch, 0, 0), shape = new T.Shape(sect.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(shape, {depth: s1 - s0, bevelEnabled: false, curveSegments: 4});
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const o = p.getX(i), y = p.getY(i), s = s1 - p.getZ(i);
    p.setXYZ(i, fr.origin[0] + fr.tangent[0] * s + fr.n[0] * o, y, fr.origin[1] + fr.tangent[1] * s + fr.n[1] * o);
  }
  g.computeVertexNormals(); b.add(g, c);
}
/**
 * End return closing the gap between a street wall and the massing behind it: one quad in the plane s, from the wall
 * plane back to o = inner, facing -t (sign -1, at a front's start) or +t (sign 1, at its end). A quad, not a solid: a
 * solid's front face would lie in the street wall's plane (coplanar overlap). At a footprint corner pass inner = 0 so it
 * stops short of the perpendicular massing wall.
 */
function endCap(b: BuildingTools, ch: Chord, s: number, y0: number, y1: number, c: Col, sign: -1 | 1, inner = -0.6, outer = OFF) {
  const fr = frameAt(ch, s, 0), P = (o: number, y: number) => [fr.origin[0] + fr.n[0] * o, y, fr.origin[1] + fr.n[1] * o];
  const q = [P(outer, y0), P(inner, y0), P(inner, y1), P(outer, y1)];
  const nrm = [fr.tangent[0] * sign, 0, fr.tangent[1] * sign];
  const u = q[1].map((v, i) => v - q[0][i]), w = q[2].map((v, i) => v - q[0][i]);
  const flip = (u[1] * w[2] - u[2] * w[1]) * nrm[0] + (u[0] * w[1] - u[1] * w[0]) * nrm[2] < 0;
  const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(order.flatMap(i => q[i]), 3));
  g.computeVertexNormals(); b.add(g, c);
}
/** Glass pane 5 cm proud of a solid backing (oriel courses, roof-light boxes, the skate band). */
const pane = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number) => slab(b, f, t, y, w, h, 0.05, 'glass', out);

// ---- massing: 3DBAG roof pieces, capped under the measured fronts ------------------------------------------------------------
const ZONES: FrontZone[] = [
  {chord: KBW, s0: 5.7, s1: 17.0, depth: 2.0, cap: 14.65},  // starts inside the chimney stack   // schaats: slate slope from the 14.7 m eaves
  {chord: KBW, s0: 19.7, s1: 35.2, depth: 1.0, cap: 15.75},  // beige front: recessed top storey 1 m back
  {chord: KBW, s0: 35.2, s1: 45.6, depth: 4.0, cap: 14.45},  // brick front: tiled roof from the 14.5 m cornice
];
function massing(b: BuildingTools) {
  const outer = source.roofs.filter(r => r.length === 1).map(r => r[0] as Ring3);
  const holed = source.roofs.filter(r => r.length > 1);
  const nearOza = (r: Ring3) => { const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[2] / r.length], [0, 0]); const {s, o} = frontCoords(OZA, c[0], c[1]); return s > -12 && s < 30 && o > -16; };
  const flat = (r: Ring3) => Math.max(...r.map(p => p[1])) - Math.min(...r.map(p => p[1])) < 0.3;
  for (const r of capRoofsUnderFronts(outer, ZONES)) roofPrism(b, [r], nearOza(r) ? 'greyBrick' : 'brick', flat(r) ? 'concrete' : 'slate');
  for (const r of holed) roofPrism(b, r as number[][][], 'brick', 'concrete');
}

// ---- Kloveniersburgwal -------------------------------------------------------------------------------------------------
function kloveniersburgwal(b: BuildingTools) {
  const fK = frameAt(KBW, 0);
  // south bay against the passage gate and the 1927 chimney stack (strip-kbw s 0-5.8)
  const s0 = sec(KBW, 0, 3.0, 0, 17.6, 'brick');
  coping(b, s0, 17.6, 0.2, 0.12, 'gold');
  endCap(b, KBW, 0, 0, 17.6, 'brick', -1, 0);
  slab(b, fK, 4.4, 0, 2.8, 23.4, 1.7, 'brick', -1.6);                 // stack, 10 cm proud of the fronts
  slab(b, fK, 4.4, 23.3, 3.0, 0.25, 1.9, 'concrete', -1.7);

  // de schaats (s 5.8-17.0): brick to the 14.7 m eaves, two white glazed bands, triple ledge, slate slope behind
  const sch = sec(KBW, 5.8, 17.0, 0, 6.8, 'brick');
  const jamb = sec(KBW, 5.8, 6.2, 6.8, 14.6, 'brick');   // tops at 14.6: the slate slope's foot covers the edge
  const band = sec(KBW, 6.2, 17.0, 6.8, 14.6, 'white');
  void sch; void jamb;
  const AX = [7.35, 9.5, 11.62, 13.75, 15.91];
  for (const s of AX) {
    opening(b, band, s, 12.15, 1.85, 2.1, {cols: 8, rows: 4, depth: 0.14});
    opening(b, band, s, 7.05, 1.85, 3.5, {cols: 5, rows: 6, bars: [0.95], depth: 0.14});
  }
  for (const [y, d] of [[10.85, 0.32], [11.25, 0.24], [11.65, 0.16]] as const) slab(b, fK, 11.9, y, 11.4, 0.18, d + OFF, 'white', -OFF);
  slab(b, fK, 6.0, 5.4, 0.4, 9.0, 0.18, 'white');                      // the band's left jamb runs down to 5.4 m
  along(b, KBW, 5.8, 17.0, [[OFF + 0.05, 14.55], [-2.0, 17.6], [-2.0, 14.4], [OFF + 0.05, 14.4]], 'slate');
  // the skate band at the foot (s 2.3-16.1, 1.9-3.9 m): white surround with its toe rounded down to the pavement line,
  // seven lights; the rounded glass-block oriel over the toe (s 2.3-5.6, 3.9-5.6 m)
  poly(b, fK, 2.3, 1.9, roundedBandOutline(13.8, 2.0, {bottomLeft: 1.6}, 10), 0.4, 'white', -0.1);
  poly(b, fK, 2.45, 2.12, roundedBandOutline(1.7, 1.55, {bottomLeft: 1.35}, 10), 0.05, 'glass', 0.3);
  for (const [a, c] of [[4.4, 6.0], [6.6, 8.4], [8.8, 10.5], [10.8, 12.0], [12.5, 13.9], [14.2, 15.95]]) pane(b, fK, (a + c) / 2, 2.15, c - a, 1.5, 0.3);
  slab(b, fK, 3.95, 3.9, 3.3, 1.7, 0.75, 'white', -0.1);
  for (let k = 0; k < 7; k++) pane(b, fK, 3.95, 4.02 + k * 0.22, 3.0, 0.14, 0.65);

  // brick pier and stair strip (s 17.0-19.7)
  const pier = sec(KBW, 17.0, 18.2, 0, 19.1, 'brick'); coping(b, pier, 19.1, 0.15, 0.08, 'concrete');
  const strip = sec(KBW, 18.2, 19.7, 0, 16.9, 'brick'); coping(b, strip, 16.9, 0.15, 0.06, 'concrete');
  opening(b, strip, 18.95, 0.05, 1.0, 2.4, {back: 'dark', frame: 'bronze'});

  // beige front (s 19.7-35.2): brick ground storey, beige storeys with brown frames, fascia, recessed top storey
  const BX = [20.6, 22.3, 24.0, 25.7, 27.4, 29.05, 30.75, 32.45, 34.1];
  const bGround = sec(KBW, 19.7, 35.2, 0, 4.3, 'brick'), beige = sec(KBW, 19.7, 35.2, 4.3, 15.8, 'concrete');
  for (const s of BX) {
    opening(b, bGround, s, 1.5, 1.2, 1.8, {frame: 'bronze', cols: 2});
    opening(b, beige, s, 4.6, 1.2, 3.0, {frame: 'bronze', bars: [2.2], cols: 2});
    opening(b, beige, s, 8.6, 1.2, 2.3, {frame: 'bronze', cols: 2});
    opening(b, beige, s, 12.1, 1.2, 2.2, {frame: 'bronze', cols: 2});
  }
  coping(b, beige, 15.8, 0.12, 0.1, 'concrete');
  const top = sec(KBW, 19.7, 35.2, 15.8, 18.5, 'concrete', -0.8);
  opening(b, top, 27.45, 16.0, 14.6, 1.35, {frame: 'bronze', cols: 9});
  slab(b, frameAt(KBW, 0, -0.8), 27.45, 18.5, 15.5, 0.15, 1.2, 'concrete', -1.0);
  // returns of the recessed top storey and of the beige front's top over the lower brick front (quads, off the step walls
  // that frontZones.ts leaves at the zone ends: those stand from o = -1 back)
  endCap(b, KBW, 19.7, 15.8, 18.5, 'concrete', -1, -1.0, -0.8);
  endCap(b, KBW, 35.2, 15.8, 18.5, 'concrete', 1, -1.0, -0.8);
  endCap(b, KBW, 35.2, 14.3, 15.8, 'concrete', 1, 0, OFF);

  // brick front (s 35.2-45.6): four storeys, white cornice, tiled roof with two dormers
  const KX = [36.3, 37.9, 39.5, 41.1, 42.75, 44.4];
  const kb = sec(KBW, 35.2, 45.6, 0, 14.3, 'brick');
  for (const s of KX) {
    opening(b, kb, s, 12.0, 1.05, 1.3, {cols: 2});
    opening(b, kb, s, 9.1, 1.05, 1.9, {cols: 2});
    opening(b, kb, s, 5.6, 1.05, 2.3, {cols: 2, bars: [1.7]});
  }
  for (const s of [36.3, 37.9, 39.5, 44.4]) opening(b, kb, s, 1.3, 1.05, 2.1, {cols: 2, bars: [1.35]});   // strip-kbw: sills 1.3 m
  opening(b, kb, 42.75, 0.6, 1.2, 3.0, {back: 'dark', frame: 'frame'});   // door on the fifth axis
  slab(b, fK, 42.75, 0, 2.4, 0.6, 1.3, 'stone');
  coping(b, kb, 14.3, 0.4, 0.35, 'gold');
  along(b, KBW, 35.25, 45.55, [[OFF + 0.4, 14.6], [-4.0, 18.1], [-4.0, 14.4], [OFF + 0.4, 14.4]], 'slate');
  for (const s of [37.6, 42.4]) {
    // dormer front 0.8 m behind the wall plane, where the slope is at its sill (15.5 m): nothing of the roof in front
    slab(b, fK, s, 15.55, 1.3, 1.45, 1.5, 'slate', -2.5);
    const dm = sec(KBW, s - 0.65, s + 0.65, 15.55, 17.0, 'slate', OFF - 0.8);
    opening(b, dm, s, 15.85, 0.85, 0.8, {depth: 0.08, edge: 0.05});
  }

  // three neck-gabled canal houses (s 45.6-61.25), brown-grey brick, white sandstone gables
  const houses = [
    {s0: 45.6, s1: 52.0, wall: 15.2, ax: [46.8, 48.7, 50.6], w: 1.2, door: 50.6, rows: [[2.6, 2.2], [5.9, 2.8], [9.9, 1.6], [12.5, 1.7]],
      gable: {axis: 48.7, neckHalf: 1.5, clawTopY: 16.9, corniceY: 18.3, corniceHalf: 1.75, apexY: 19.3}, neckWin: [15.4, 1.2]},
    {s0: 52.0, s1: 57.0, wall: 12.0, ax: [52.85, 54.4, 55.9], w: 1.0, door: null, rows: [[2.5, 2.6], [6.3, 2.3], [9.9, 1.5]],
      gable: {axis: 54.35, neckHalf: 1.2, clawTopY: 13.4, corniceY: 14.7, corniceHalf: 1.4, apexY: 15.4}, neckWin: [12.1, 1.1]},
    {s0: 57.0, s1: 61.25, wall: 12.0, ax: [57.65, 59.1, 60.5], w: 0.95, door: 57.65, rows: [[2.5, 2.6], [6.3, 2.3], [9.9, 1.5]],
      gable: {axis: 59.1, neckHalf: 1.0, clawTopY: 13.4, corniceY: 14.7, corniceHalf: 1.2, apexY: 15.4}, neckWin: [12.1, 1.1]},
  ];
  for (const h of houses) {
    const S = sec(KBW, h.s0, h.s1, 0, h.wall, 'ochre');
    for (const [y, hh] of h.rows) for (const s of h.ax) {
      if (y < 3 && s === h.door) continue;
      opening(b, S, s, y, h.w, hh, {cols: 2, rows: hh > 2 ? 3 : 2});
    }
    if (h.door !== null) {
      opening(b, S, h.door, 1.0, h.w, h.rows[0][0] + h.rows[0][1] - 1.0, {back: 'dark', bars: [h.rows[0][0] + h.rows[0][1] - 1.6]});
      slab(b, fK, h.door, 0, h.w + 1.4, 1.0, 1.4, 'stone');    // stoop: five steps up to the raised ground floor
    }
    const g = h.gable;
    neckGable(b, frameAt(KBW, 0), {x0: h.s0 + 0.05, x1: h.s1 - 0.05, axis: g.axis, neckHalf: g.neckHalf, shoulderY: h.wall, clawTopY: g.clawTopY,
      corniceY: g.corniceY, corniceH: 0.28, corniceHalf: g.corniceHalf, apexY: g.apexY, thick: 0.45, crown: 'segment', footScroll: false}, {wall: 'ochre', trim: 'gold', neck: 'ochre'});
    slab(b, frameAt(KBW, 0), g.axis, h.neckWin[0], 1.05, h.neckWin[1], 0.06, 'dark');
    slab(b, frameAt(KBW, 0), (h.s0 + h.s1) / 2, h.wall - 0.25, h.s1 - h.s0 - 0.1, 0.25, 0.14, 'gold');
  }
  slab(b, fK, 52.95, 10.0, 1.9, 8.4, 1.6, 'brick', -3.6);              // stack behind the second house
  // Rusland corner post closes the two street walls
  endCap(b, KBW, 61.25, 0, 12.0, 'ochre', 1, 0);
  b.box(KBW.b[0], 0, KBW.b[1], 0.9, 12.0, 0.9, 'ochre');
}

// ---- Rusland -----------------------------------------------------------------------------------------------------------
function rusland(b: BuildingTools) {
  const fR = frameAt(RUS, 0);
  // the corner house's side wall (s 0-7.2): white plinth, white cornice, two window axes
  const r0 = sec(RUS, 0, 7.2, 0, 10.75, 'ochre');
  endCap(b, RUS, 0, 0, 10.75, 'ochre', -1, 0);
  for (const [y, h] of [[3.6, 2.0], [6.3, 1.6], [8.8, 1.1]]) opening(b, r0, 2.0, y, 0.9, h, {cols: 2, rows: 2});
  for (const [y, h] of [[3.9, 0.9], [6.6, 0.8], [8.9, 0.7]]) opening(b, r0, 5.9, y, 0.6, h, {rows: 2});
  opening(b, r0, 4.6, 0.05, 0.9, 2.1, {back: 'dark'});
  slab(b, fR, 2.3, 0, 4.6, 2.0, 0.06, 'gold');
  slab(b, fR, 6.1, 0, 2.2, 2.0, 0.06, 'gold');
  coping(b, r0, 10.75, 0.3, 0.3, 'gold');
  // low brick bay with ventilation slits (s 7.2-11.5)
  const r1 = sec(RUS, 7.2, 11.5, 0, 8.6, 'red');
  for (const y of [2.3, 5.0, 7.0]) for (const s of [9.4, 9.9, 10.4]) opening(b, r1, s, y, 0.25, 0.16, {back: 'dark', edge: 0, depth: 0.12});
  coping(b, r1, 8.6, 0.15, 0.06, 'concrete');
  // main brick rear (s 11.5-56.0): three storeys to the 9.4 m eaves
  const r2 = sec(RUS, 11.5, 56.0, 0, 9.4, 'red');
  for (const s of [15.15, 16.6, 21.85, 26.2, 34.5, 39.3, 44.05, 48.7, 53.3]) opening(b, r2, s, 7.2, 1.2, 1.4, {frame: 'bronze', depth: 0.16});
  for (const s of [15.15, 16.6, 21.85, 26.2, 34.5, 53.3]) opening(b, r2, s, 3.9, 1.2, 1.5, {frame: 'bronze', depth: 0.16});
  for (const [s, w] of [[15.65, 3.0], [21.9, 1.2], [26.2, 1.2], [39.4, 2.2], [48.25, 2.3]]) opening(b, r2, s, 0.05, w, 2.6, {back: 'dark', frame: 'bronze', bars: [2.2], cols: w > 2 ? 2 : 1});
  for (const [s, w] of [[34.5, 1.0], [44.0, 1.4], [45.8, 1.4], [51.15, 1.5], [53.3, 1.6]]) opening(b, r2, s, 0.5, w, 2.3, {frame: 'bronze', depth: 0.16});
  opening(b, r2, 54.85, 0.6, 0.7, 1.4, {back: 'bronze', frame: 'bronze', rows: 6});
  coping(b, r2, 9.4, 0.15, 0.06, 'concrete');
  // concrete roof-light boxes on the eaves line, flush with the front
  for (const [a, c] of [[14.3, 15.85], [15.85, 17.4], [29.3, 31.4], [45.0, 47.4], [72.0, 74.5]]) {
    const y = c < 60 ? 9.55 : 10.15;                                     // standing on the coping
    slab(b, fR, (a + c) / 2, y, c - a - 0.02, 1.9, 1.3, 'concrete', -1.4);
    const box = sec(RUS, a + 0.01, c - 0.01, y, y + 1.9, 'concrete', OFF + 0.1);
    opening(b, box, (a + c) / 2, y + 0.35, c - a - 0.5, 1.2, {depth: 0.08, edge: 0.05});
  }
  // stone-clad hall panel (s 56.0-67.2), steel cover strips
  const r3 = sec(RUS, 56.0, 67.2, 0, 13.0, 'stone');
  void r3;
  for (const s of [56.15, 59.8, 63.2, 67.05]) slab(b, fR, s, 0.3, 0.16, 12.6, 0.07, 'bronze');
  for (let y = 1.25; y < 12.6; y += 1.2) ledgeStrip(b, fR, 61.6, y, 11.0, 0.04, 0.05, 'concrete');
  coping(b, r3, 13.0, 0.15, 0.06, 'concrete');
  // brick (s 67.2-87.4) with the climbing plant, three storeys
  const r4 = sec(RUS, 67.2, 87.4, 0, 10.0, 'red');
  for (const s of [69.3, 76.75]) opening(b, r4, s, 7.3, 1.6, 1.4, {frame: 'bronze', depth: 0.16});
  for (const s of [69.3, 76.75, 80.95, 84.8]) opening(b, r4, s, 3.9, 1.7, 1.5, {frame: 'bronze', depth: 0.16});
  opening(b, r4, 69.3, 0.6, 1.7, 1.8, {frame: 'bronze', depth: 0.16});
  opening(b, r4, 76.75, 0.05, 1.4, 2.6, {back: 'dark', frame: 'bronze', bars: [2.1]});
  coping(b, r4, 10.0, 0.15, 0.06, 'concrete');
  const fin = sec(RUS, 87.4, 88.0, 0, 12.0, 'red'); coping(b, fin, 12.0, 0.12, 0.05, 'concrete');
  // louvred plant front (s 88.0-96.0): black base, louvre band, concrete band, top ribbon window, dark coping
  const r5 = sec(RUS, 88.0, 96.0, 0, 7.5, 'concrete');
  opening(b, r5, 92.0, 5.9, 7.6, 1.45, {frame: 'bronze', cols: 6});
  slab(b, fR, 92.0, 0, 8.0, 2.2, 0.08, 'bronze');
  slab(b, fR, 92.0, 2.2, 8.0, 1.2, 0.1, 'bronze');
  for (let y = 2.3; y < 3.3; y += 0.13) ledgeStrip(b, fR, 92.0, y, 7.9, 0.05, 0.16, 'concrete');
  coping(b, r5, 7.5, 0.3, 0.1, 'bronze');
  // the Oudezijds Achterburgwal block's return (s 96.0-102.1)
  const r6 = sec(RUS, 96.0, 102.11, 0, 15.6, 'greyBrick');
  for (const [y, h] of [[2.0, 2.5], [5.6, 2.5], [9.4, 2.4], [13.0, 2.2]]) { opening(b, r6, 97.4, y, 1.6, h, {cols: 2, rows: 2}); opening(b, r6, 100.4, y, 1.6, h, {cols: 2, rows: 2}); }
  coping(b, r6, 15.6, 0.15, 0.05, 'concrete');
  endCap(b, RUS, 102.11, 0, 15.6, 'greyBrick', 1, 0);
  b.box(RUS.b[0], 0, RUS.b[1], 0.9, 15.6, 0.9, 'greyBrick');
}

// ---- Oudezijds Achterburgwal -------------------------------------------------------------------------------------------
function achterburgwal(b: BuildingTools) {
  const fO = frameAt(OZA, 0);
  // dark-brick front (s 0-20.4): seven window axes and the tablet axis, zinc roof edge, stone plinth and sills
  const o1 = sec(OZA, 0, 20.4, 0, 15.5, 'greyBrick');
  endCap(b, OZA, 0, 0, 15.5, 'greyBrick', -1, 0);
  const AX = [1.21, 3.4, 5.63, 10.04, 12.29, 14.49, 16.71, 18.9];
  for (const s of AX) {
    opening(b, o1, s, 13.0, 1.8, 2.2, {cols: 2, rows: 2});
    opening(b, o1, s, 9.4, 1.8, 2.4, {cols: 2, rows: 2});
    const tall = s > 12 && s < 17;
    opening(b, o1, s, 5.6, 1.8, tall ? 3.2 : 2.5, {cols: 2, rows: 2});
    if (tall) slab(b, fO, s, 5.75, 1.7, 0.55, 0.12, 'bronze');            // balconette rail
    opening(b, o1, s, 2.0, 1.8, 2.5, {cols: 2, rows: 2, bars: [1.9]});
    slab(b, fO, s, 1.8, 2.1, 0.2, 0.1, 'stone');
  }
  // stone tablet on the blank axis (s 7.85, 4.25-5.75 m), cross-shaped
  poly(b, fO, 7.85, 4.25, [[-0.45, 0], [0.45, 0], [0.45, 0.45], [0.9, 0.45], [0.9, 1.05], [0.45, 1.05], [0.45, 1.5], [-0.45, 1.5], [-0.45, 1.05], [-0.9, 1.05], [-0.9, 0.45], [-0.45, 0.45]], 0.08, 'stone');
  slab(b, fO, 10.2, 0, 20.4, 0.5, 0.06, 'stone');
  coping(b, o1, 15.5, 1.3, 0.35, 'copper');
  // two-bay house (s 20.4-27.7): wide wooden cornice on four consoles, hipped roof behind
  const o2 = sec(OZA, 20.4, 27.7, 0, 11.5, 'greyBrick');
  for (const s of [22.8, 25.6]) {
    opening(b, o2, s, 7.55, 1.6, 3.2, {cols: 2, rows: 3});
    opening(b, o2, s, 3.0, 1.6, 3.4, {cols: 2, rows: 3});
    opening(b, o2, s, 0.4, 1.4, 0.7, {cols: 2, back: 'dark'});
  }
  coping(b, o2, 11.5, 1.6, 0.4, 'gold', 20.4, 27.7);
  for (const s of [20.8, 23.0, 25.2, 27.3]) slab(b, fO, s, 11.1, 0.3, 0.9, 0.55, 'gold');
  along(b, OZA, 20.45, 27.65, [[OFF + 0.2, 13.15], [-2.6, 14.85], [-2.6, 13.1], [OFF + 0.2, 13.1]], 'slate');
  endCap(b, OZA, 27.7, 0, 11.5, 'greyBrick', 1, 0);
  // the painted house by the west gate (OZA2 s 0-6.96)
  const fP = frameAt(OZA2, 0);
  const p = sec(OZA2, 0, 6.96, 0, 13.9, 'pink');
  for (const s of [1.9, 4.7]) {
    opening(b, p, s, 9.9, 1.6, 2.4, {cols: 2, rows: 2, frame: 'bronze'});
    opening(b, p, s, 4.75, 1.6, 3.25, {cols: 2, rows: 3, frame: 'bronze'});
    opening(b, p, s, 0.5, 1.6, 2.5, {cols: 2, frame: 'bronze', bars: [2.0]});
  }
  coping(b, p, 13.9, 0.45, 0.3, 'gold');
  slab(b, fP, 3.48, 3.4, 6.9, 0.2, 0.12, 'gold');
  endCap(b, OZA2, 0, 0, 13.9, 'pink', -1, 0);
  endCap(b, OZA2, 6.96, 0, 13.9, 'pink', 1, 0);
}

export function buildBinnengasthuisKloveniersburgwal(_w: number, _d: number, b: BuildingTools) {
  FACES = [];
  massing(b);
  kloveniersburgwal(b);
  rusland(b);
  achterburgwal(b);
  flushCutFaces(b, FACES);
  FACES = [];
}
