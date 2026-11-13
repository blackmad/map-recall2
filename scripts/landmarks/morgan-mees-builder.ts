import type {BuildingTools} from './cultural-builders';
import {geomOf} from './cut-face';
import {awning, ledgeStrip, letters, poly, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {archRingOutline, frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import source from './morgan-mees-footprints.json' with {type: 'json'};

/**
 * Morgan & Mees, Tweede Hugo de Grootstraat 2 at the Nassaukade (BAG pand 0363100012236197, bouwjaar 1883; Gemeentelijk
 * monument 223038, "Tweede Hugo de Grootstraat 2-18"). Built for the Protestantsch Weduwen- en Weezenfonds as widows'
 * housing combined at no. 2 with a bewaarschool (infant school), first stone laid 23 August 1880 (register text); a
 * kindergarten and day nursery ("Prinses Irene") until about 1985 (register). The MORGAN & MEES name is read from the
 * panoramas. Architect unknown (register).
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, morgan-mees-crops.ts at 60 px/m, panorama ids in
 * morgan-mees-inventory.json) and Wikimedia Commons photos (Alf van Beem 2017, public domain; Ceescamel 2019,
 * CC BY-SA 4.0); the register text names the plan (school block deepened to the rear, a wing to the right with the
 * playground). Heights are scaled to the 3DBAG LoD2.2 roofs (CC BY 4.0): wing roof 3.6 m, hips 11.2-13.8 m.
 *  - Street front (10.5 m): red-brown brick, two storeys under a white frieze and cornice. The middle bay is white
 *    plaster from the plinth to the cornice: a round-arched ground-floor window with a radial fanlight between fluted
 *    pilasters with capitals and garlands, and over it a two-light window under an entablature with a pediment. The
 *    outer bays: a door with a white surround and transom, a window with a white surround and an arched transom,
 *    first-floor windows under white hoods with drop ears and dark awnings. Rusticated white lisene at the west end,
 *    hardstone plinth with the two first-stone plaques (register), a brick dormer with three lights and a pediment.
 *  - East face (11.6 m, over the garden and the wing): MORGAN & MEES in dark capitals on the white frieze, four
 *    first-floor axes with white hoods and awnings, a steel balcony along the whole face (on struts over the garden),
 *    a hipped roof of dark tiles with a white-cheeked dormer, two roof windows and a chimney.
 *  - The one-storey wing (3.6 m roof terrace) and the garden wall on the Nassaukade building line: brick, round-arched
 *    window and door with white hoods and impost bands, a white cornice, a dark plinth; in the garden wall a wide
 *    segmental gateway with an iron gate under a white segmental pediment with scrolled ends. The garden itself (not
 *    a BAG pand) is closed to the street by a tall hedge and roofed by a dark terrace pavilion.
 *
 * Native frame of morgan-mees-footprints.json (x east, z south, y up from the 0.63 m NAP pavement). Local axes: e east
 * (normal of the school block's east face) and d north (into the block from the street), origin at the school block's
 * street corner (BAG ring vertex 1). The street front and the west party wall are ring edges 0-1 and 13-0; the east face
 * is ring edge 1-2 continued to the rear block (11.6 m, measured); the Nassaukade line is ring 3-12 (e = 8.27).
 */
/** `ochre` is the white plaster and trim (stucco slot; `white` would be judged as window trim), `copper` the black steel. */
type C = 'brick' | 'ochre' | 'white' | 'stone' | 'concrete' | 'slate' | 'glass' | 'frame' | 'dark' | 'bronze' | 'copper' | 'blue' | 'green' | 'sandstone';
type XZ = [number, number];
const RING = (source as unknown as {nativeRing: XZ[]}).nativeRing;

// ---- local frame -------------------------------------------------------------------------------------------------------
const O = RING[1];
const U: XZ = (() => { const a = RING[1], b = RING[2], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })(); // north, into the block
const E: XZ = [-U[1], U[0]];                                                                                                                 // east, out of the east face
const W = (e: number, d: number): XZ => [O[0] + E[0] * e + U[0] * d, O[1] + E[1] * e + U[1] * d];
const loc = (p: XZ): XZ => [(p[0] - O[0]) * E[0] + (p[1] - O[1]) * E[1], (p[0] - O[0]) * U[0] + (p[1] - O[1]) * U[1]];

const WEST = loc(RING[0])[0];                 // -10.48: west party wall
const DEPTH = 11.6;                           // school block depth along the east face (crop face-eastMain, cornice return)
const BACK = loc(RING[13])[1];                // 15.98: north party wall (Nassaukade 119)
const WING_S = loc(RING[2])[1];               // 7.42: the wing's garden wall
const NK = (loc(RING[3])[0] + loc(RING[12])[0]) / 2;  // 8.27: Nassaukade building line

// chords; outward normal n = (-tz, tx) (street-front-kit convention)
const ST: Chord = {a: W(WEST, 0), b: W(0, 0)};            // street front, s from the west party wall
const EM: Chord = {a: W(0, 0), b: W(0, DEPTH)};           // school block east face, s from the street corner
const ER: Chord = {a: W(0, DEPTH), b: W(0, BACK)};        // rear block east face over the wing
const NM: Chord = {a: W(0, DEPTH), b: W(WEST, DEPTH)};    // school block north face over the rear block
const NQ: Chord = {a: W(NK, 0), b: W(NK, BACK)};          // Nassaukade line: garden wall then wing, s from the street corner
const GA: Chord = {a: W(0, WING_S), b: W(NK, WING_S)};    // wing's south wall, facing the garden

// ---- measured heights (m above the pavement) ---------------------------------------------------------------------------
const BASE = -0.3;
const WALL_TOP = 10.95;      // frieze top under the cornice
const CORN = 0.45;           // cornice height
const EAVE = WALL_TOP + CORN; // 11.4: the hips start on the cornice
const TOP = 13.6;            // flat top of the hipped roof (3DBAG 13.4-14.3)
const INSET = 3.2;           // hip run
const FRIEZE: [number, number] = [10.05, WALL_TOP];
const REAR_TOP = 7.35;       // rear block flat roof (3DBAG 7.2-7.4)
const WING_FLOOR = 3.6;      // wing roof terrace (3DBAG 3.5-3.7)
const WING_TOP = 4.1;        // wing parapet under its coping (3DBAG 4.3-4.4 with the coping)
const GW_TOP = 3.95;         // garden wall under its coping
const BAL = 5.6;             // balcony floor
const DORMER_S: [number, number] = [4.4, 7.4];  // street dormer cheeks (chord s from the west party wall), MID -/+ 1.5
const DORMER_TOP = 12.55;    // street dormer wall top under its coping
const DORMER_OFF = 0.12;     // street dormer front set back behind the cornice line

// ---- triangle sink -----------------------------------------------------------------------------------------------------
class Mesh {
  tris = new Map<C, number[]>();
  tri(c: C, a: number[], b: number[], d: number[], want: number[]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-10) return;
    const arr = this.tris.get(c) ?? [];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) arr.push(...a, ...b, ...d); else arr.push(...a, ...d, ...b);
    this.tris.set(c, arr);
  }
  quad(c: C, a: number[], b: number[], d: number[], e: number[], want: number[]) { this.tri(c, a, b, d, want); this.tri(c, a, d, e, want); }
  flush(b: BuildingTools) {
    for (const [c, pos] of this.tris) if (pos.length) b.add(geomOf(pos), c);
    this.tris.clear();
  }
}
let M: Mesh;
/** 3D point at local (e, d) and height y. */
const P = (e: number, d: number, y: number) => { const q = W(e, d); return [q[0], y, q[1]]; };
const vE = [E[0], 0, E[1]], vU = [U[0], 0, U[1]], vW = [-E[0], 0, -E[1]], vS = [-U[0], 0, -U[1]], UP = [0, 1, 0], DOWN = [0, -1, 0];
/** Vertical quad from (e0, d0) to (e1, d1), heights y0..y1, facing `want`. */
const wallQuad = (c: C, e0: number, d0: number, e1: number, d1: number, y0: number, y1: number, want: number[]) =>
  M.quad(c, P(e0, d0, y0), P(e1, d1, y0), P(e1, d1, y1), P(e0, d0, y1), want);
/** Horizontal quad over the local box e0..e1 x d0..d1 at y, facing up (or down). */
const flat = (c: C, e0: number, e1: number, d0: number, d1: number, y: number, want = UP) =>
  M.quad(c, P(e0, d0, y), P(e1, d0, y), P(e1, d1, y), P(e0, d1, y), want);
/** Closed box in local axes. */
function box(c: C, e0: number, e1: number, d0: number, d1: number, y0: number, y1: number) {
  flat(c, e0, e1, d0, d1, y1); flat(c, e0, e1, d0, d1, y0, DOWN);
  wallQuad(c, e0, d0, e1, d0, y0, y1, vS); wallQuad(c, e0, d1, e1, d1, y0, y1, vU);
  wallQuad(c, e0, d0, e0, d1, y0, y1, vW); wallQuad(c, e1, d0, e1, d1, y0, y1, vE);
}

type Ctx = {K: FrontKit; b: BuildingTools};
const ff = (c: Ctx, S: Sec, proud = 0) => c.K.faceFrame(S, proud);
const band = (c: Ctx, S: Sec, s0: number, s1: number, y: number, h: number, d: number, col: C = 'ochre') => ledgeStrip(c.b, ff(c, S), (s0 + s1) / 2, y, s1 - s0, h, d, col);
/** Frame whose tangent runs out of the chord's face (o) at chord position s, normal along the chord (+s). */
const outFrame = (ch: Chord, s: number): Frame => { const f = frameAt(ch, s, 0); return {origin: f.origin, tangent: f.n, n: [-f.tangent[0], -f.tangent[1]]}; };

/** White entablature hood over a first-floor window: lintel with drop ears and a cornice. */
function hood(c: Ctx, S: Sec, s: number, w: number, y: number) {
  const f = ff(c, S);
  slab(c.b, f, s, y, w, 0.34, 0.1, 'ochre');
  for (const sg of [-1, 1]) slab(c.b, f, s + sg * (w / 2 - 0.08), y - 0.36, 0.16, 0.36, 0.08, 'ochre');
  slab(c.b, f, s, y + 0.34, w + 0.16, 0.1, 0.17, 'ochre');
}
/** White surround (jambs, lintel and a cornice) round a ground-floor opening of outer width w, y0..y1. */
function surround(c: Ctx, S: Sec, s: number, w: number, y0: number, y1: number, jamb = 0.28) {
  const f = ff(c, S);
  for (const sg of [-1, 1]) slab(c.b, f, s + sg * (w / 2 - jamb / 2), y0, jamb, y1 - y0, 0.08, 'ochre');
  slab(c.b, f, s, y1, w, 0.22, 0.09, 'ochre');
  slab(c.b, f, s, y1 + 0.22, w + 0.14, 0.1, 0.15, 'ochre');
}
/** Fluted pilaster with pedestal and capital (simplified: three proud blocks and two flute strips). */
function pilaster(c: Ctx, S: Sec, s: number, y0: number, y1: number, w = 0.48, garland = true) {
  const f = ff(c, S);
  slab(c.b, f, s, y0, w + 0.08, 0.55, 0.16, 'ochre');
  slab(c.b, f, s, y0 + 0.55, w, y1 - y0 - 0.95, 0.12, 'ochre');
  for (const dx of [-0.11, 0.11]) ledgeStrip(c.b, f, s + dx, y0 + 0.7, 0.05, y1 - y0 - 1.25, 0.05, 'ochre', 0.12);
  slab(c.b, f, s, y1 - 0.4, w + 0.14, 0.4, 0.18, 'ochre');
  if (garland) slab(c.b, f, s, y0 + 0.62, w - 0.12, 0.3, 0.17, 'ochre');
}

// ---- massing -------------------------------------------------------------------------------------------------------------
function hipRoof() {
  const e0 = WEST, e1 = 0, d0 = 0, d1 = DEPTH, te = e1 - INSET, td0 = d0 + INSET, td1 = d1 - INSET;
  // south hip, open under the street dormer (its cheeks and coping close the hole) so the slope does not run through
  // the dormer's lights: hole e = h0..h1 between the cheeks, d = DORMER_OFF..dh where the slope meets the dormer coping
  const k = (TOP - EAVE) / INSET, hy = (d: number) => EAVE + d * k, wS = [vS[0], 1, vS[2]];
  const h0 = WEST + DORMER_S[0], h1 = WEST + DORMER_S[1], dh = (DORMER_TOP - EAVE) / k, hp = (e: number, d: number) => P(e, d, hy(d));
  M.quad('slate', hp(e0, d0), hp(h0, d0), hp(h0, td0), hp(e0, td0), wS);
  M.quad('slate', hp(h0, d0), hp(h1, d0), hp(h1, DORMER_OFF), hp(h0, DORMER_OFF), wS);
  M.tri('slate', hp(h1, d0), hp(e1, d0), hp(h1, -h1), wS);
  M.quad('slate', hp(h0, dh), hp(h1, dh), hp(h1, -h1), hp(te, td0), wS);
  M.tri('slate', hp(h0, dh), hp(te, td0), hp(h0, td0), wS);
  M.quad('slate', P(e1, d0, EAVE), P(e1, d1, EAVE), P(te, td1, TOP), P(te, td0, TOP), [vE[0], 1, vE[2]]);
  M.quad('slate', P(e1, d1, EAVE), P(e0, d1, EAVE), P(e0, td1, TOP), P(te, td1, TOP), [vU[0], 1, vU[2]]);
  flat('slate', e0, te, td0, td1, TOP);
  M.quad('brick', P(e0, d0, EAVE), P(e0, td0, TOP), P(e0, td1, TOP), P(e0, d1, EAVE), vW);
  flat('slate', e0, e1, d0, d1, EAVE - 0.02, DOWN);
}
function partyWalls() {
  // west party wall (pand 0363100012236600) and north party wall (Nassaukade 119): closed, plain
  wallQuad('brick', WEST, 0, WEST, DEPTH, BASE, EAVE, vW);
  wallQuad('brick', WEST, DEPTH, WEST, BACK, BASE, REAR_TOP, vW);
  wallQuad('brick', WEST, BACK, 0, BACK, BASE, REAR_TOP, vU);
  wallQuad('brick', 0, BACK, NK, BACK, BASE, WING_TOP + 0.25, vU);
  flat('concrete', WEST + 0.02, -0.02, DEPTH + 0.3, BACK - 0.02, REAR_TOP);            // rear block roof inside its coping
  flat('concrete', 0.02, NK - 0.3, WING_S + 0.3, BACK - 0.02, WING_FLOOR);             // wing roof terrace inside the parapet
}

// ---- street front ----------------------------------------------------------------------------------------------------------
const MID = 5.9;   // symmetry axis of the street front (chord s from the west party wall)
function streetFront(c: Ctx) {
  const {K, b} = c;
  const SW = K.sec(ST, 0, 4.15, BASE, WALL_TOP, 'brick', 0);
  const SM = K.sec(ST, 4.15, 7.65, BASE, WALL_TOP, 'ochre', 0);
  const SE = K.sec(ST, 7.65, 10.48, BASE, WALL_TOP, 'brick', 0);
  // ground floor: door with transom (west), round-arched window with fanlight (middle), window with arched transom (east)
  K.opening(SW, 2.9, 0.6, 0.86, 2.65, {back: 'dark', frame: 'frame', depth: 0.18, edge: 0.06});
  K.opening(SW, 2.9, 3.33, 0.86, 0.75, {cols: 3, frame: 'frame', depth: 0.18, edge: 0.06});
  surround(c, SW, 2.9, 1.66, 0.85, 4.1);                                                   // jambs stand on the plinth
  K.opening(SM, MID, 1.43, 2.1, 3.02, {cols: 2, frame: 'frame', depth: 0.2, rise: 1.05, edge: 0.08});
  K.archHead(SM, MID, 1.43 + 3.02 - 1.05, 2.1, 1.05, 0.2, 0.1, 'ochre');
  slab(b, ff(c, SM), MID, 4.42, 0.3, 0.32, 0.16, 'ochre');                                  // keystone
  {
    // radial fanlight: hub ring and spokes inside the arch, standing in the reveal
    const f = ff(c, SM), out = -0.15, spring = 1.43 + 3.02 - 1.05;
    ringSlab(b, f, MID, spring + 0.32, 0.17, 0.24, 0.05, 'frame', out, 14);
    for (let k = 1; k < 8; k++) {
      const a = Math.PI * k / 8, ca = Math.cos(a), sa = Math.sin(a), r0 = 0.25, r1 = 1.0, hw = 0.022;
      poly(b, f, MID, spring, [[ca * r0 + sa * hw, sa * r0 - ca * hw], [ca * r1 + sa * hw, sa * r1 - ca * hw], [ca * r1 - sa * hw, sa * r1 + ca * hw], [ca * r0 - sa * hw, sa * r0 + ca * hw]], 0.05, 'frame', out);
    }
  }
  for (const s of [4.4, 7.4]) pilaster(c, SM, s, 0.85, 4.75);
  slab(b, ff(c, SM), MID, 4.75, 3.5, 0.4, 0.1, 'ochre');                                     // entablature over the pilasters
  K.opening(SE, 8.95, 1.43, 1.25, 2.67, {cols: 2, frame: 'frame', depth: 0.18, bars: [2.0], edge: 0.07});
  ledgeStrip(b, ff(c, SE, -0.18), 8.95, 1.43 + 2.0, 1.1, 0.05, 0.06, 'frame');
  {
    const f = ff(c, SE, -0.16);
    poly(b, f, 8.95, 1.43 + 2.04, archRingOutline(1.1, 0.42, 0.05, 8), 0.05, 'frame');     // arched transom bar
  }
  surround(c, SE, 8.95, 1.95, 1.38, 4.1);
  // plinth (hardstone) and sill band, steps, first-stone plaques (register: two gevelstenen in the plinth)
  for (const [s0, s1] of [[0.06, 2.42], [3.38, 10.48]] as const) slab(b, ff(c, SW), (s0 + s1) / 2, BASE, s1 - s0, 0.85 - BASE, 0.07, 'stone');
  for (const [S, s0, s1] of [[SW, 0.06, 2.0], [SE, 7.65, 7.95], [SE, 9.95, 10.48]] as const) band(c, S, s0, s1, 1.33, 0.1, 0.08);
  slab(b, ff(c, SW), 2.9, BASE, 1.2, 0.2 - BASE, 0.62, 'stone');
  slab(b, ff(c, SW), 2.9, 0.2, 1.1, 0.33, 0.32, 'stone');                                   // top step 7 cm under the door sill
  for (const s of [5.35, 6.45]) slab(b, ff(c, SM, 0.07), s, 0.18, 0.72, 0.5, 0.05, 'sandstone');
  // storey bands
  band(c, SW, 0.06, 4.15, 5.06, 0.14, 0.08); band(c, SE, 7.65, 10.48, 5.06, 0.14, 0.08);
  band(c, SW, 0.06, 4.15, 5.62, 0.25, 0.13); band(c, SM, 4.15, 7.65, 5.15, 0.72, 0.16); band(c, SE, 7.65, 10.48, 5.62, 0.25, 0.13);
  band(c, SW, 0.06, 4.15, 6.04, 0.1, 0.08); band(c, SE, 7.65, 10.48, 6.04, 0.1, 0.08);   // tops 6 cm under the sill reveals
  // first floor: outer windows under hoods and awnings; the middle two-light window between pilasters under a pediment
  for (const [S, s] of [[SW, 2.8], [SE, 9.0]] as const) {
    K.opening(S, s, 6.2, 1.25, 2.55, {frame: 'frame', depth: 0.16, edge: 0.06});
    hood(c, S, s, 1.9, 8.98);
    awning(b, ff(c, S), s, 7.95, 1.45, 0.92, 0.72, 'bronze');
  }
  K.opening(SM, MID, 6.2, 2.2, 2.62, {cols: 2, frame: 'frame', depth: 0.18, bars: [1.95], edge: 0.07, barW: 0.09});
  slab(b, ff(c, SM), MID, 5.88, 2.3, 0.26, 0.06, 'ochre');                                     // panel under the sill
  for (const s of [4.5, 7.3]) {
    slab(b, ff(c, SM), s, 6.0, 0.32, 2.85, 0.1, 'ochre');
    slab(b, ff(c, SM), s, 8.85, 0.42, 0.27, 0.16, 'ochre');
  }
  slab(b, ff(c, SM), MID, 9.12, 3.55, 0.28, 0.14, 'ochre');                                    // entablature
  poly(b, ff(c, SM), MID, 9.4, [[-1.85, 0], [1.85, 0], [0, 0.6]], 0.2, 'ochre');               // pediment
  slab(b, ff(c, SM, 0.2), MID, 9.5, 0.8, 0.22, 0.04, 'ochre');                                  // tympanum relief (simplified)
  // rusticated lisene at the west end (blokverband: long and short blocks)
  for (let k = 0, y = 0.9; y < FRIEZE[0] - 0.3; k++, y += 0.34) slab(b, ff(c, SW), k % 2 ? 1.22 : 1.28, y, k % 2 ? 0.42 : 0.56, 0.28, 0.08, 'ochre');
  // frieze and cornice
  box('ochre', WEST + 0.06, 0.06, -0.06, 0, FRIEZE[0], FRIEZE[1]);
  K.coping(SW, WALL_TOP, CORN, 0.55, 'ochre', 0.06, 10.48 + 0.55);
  streetDormer(c);
}
/** Brick dormer, one window of three lights on thin posts, with a white pediment, just behind the cornice over the middle bay. */
function streetDormer(c: Ctx) {
  const {K, b} = c, off = -DORMER_OFF, back = 2.6, [s0, s1] = DORMER_S, top = DORMER_TOP;
  const S = K.sec(ST, s0, s1, EAVE, top, 'brick', off);
  K.opening(S, MID, 11.72, 2.3, 0.7, {cols: 3, frame: 'white', depth: 0.1, edge: 0.06, barW: 0.1});   // three lights on thin posts (crop w01-202)
  K.endCap(ST, s0, EAVE, top, 'brick', -1, -back, off);
  K.endCap(ST, s1, EAVE, top, 'brick', 1, -back, off);
  K.coping(S, top, 0.12, 0.1, 'ochre', s0 - 0.08, s1 + 0.08, back - 0.35);
  const f = frameAt(ST, 0, off);
  poly(b, f, MID, top + 0.12, [[-1.55, 0], [1.55, 0], [0, 0.55]], back - 0.35, 'slate', -(back - 0.35));
  for (const sg of [-1, 1]) poly(b, f, MID, top + 0.12, [[sg * 1.6, -0.02], [sg * 1.48, -0.02], [0, 0.56], [0, 0.66]].map(([x, y]) => [x, y] as [number, number]), 0.16, 'ochre', -0.06);
}

// ---- east face: the lettered front over the garden and the wing ---------------------------------------------------------
const AXES: [number, number, boolean][] = [[1.4, 1.1, true], [4.85, 1.1, false], [7.85, 2.2, false], [10.75, 1.2, true]]; // s, width, door
function eastFace(c: Ctx) {
  const {K, b} = c;
  const S = K.sec(EM, 0, DEPTH, BASE, WALL_TOP, 'brick', 0);
  // ground floor over the garden (inferred: hidden behind the hedge and the pavilion), as the street's east window
  for (const s of [2.1, 5.3]) {
    K.opening(S, s, 1.43, 1.2, 2.6, {cols: 2, frame: 'frame', depth: 0.18, bars: [2.0], edge: 0.07});
    surround(c, S, s, 1.9, 1.38, 4.03);
  }
  slab(b, ff(c, S), 3.7, BASE, 7.4, 0.85 - BASE, 0.07, 'stone');
  band(c, S, 0.07, 7.4, 5.06, 0.14, 0.08);
  for (const [s, w, door] of AXES) {
    K.opening(S, s, door ? BAL + 0.04 : 6.25, w, door ? 8.6 - BAL - 0.04 : 2.35, {cols: w > 2 ? 2 : 1, frame: 'frame', depth: 0.16, edge: 0.06});
    hood(c, S, s, Math.min(w + 0.55, 2 * (DEPTH - 0.13 - s)), 8.98);                         // the last hood stops short of the north wall
    awning(b, ff(c, S), s, 8.02, w + 0.25, 0.86, 0.72, 'bronze');
  }
  box('ochre', 0, 0.06, 0, DEPTH + 0.06, FRIEZE[0], FRIEZE[1]);
  // MORGAN & MEES: 0.40 m capitals, 6.05 m long, centred 6.07 m from the street corner (crop face-eastMain-3)
  lettering(b, ff(c, S, 0.06), 'MORGAN & MEES', 6.07, 10.26, 0.40, 0.30, 0.48);
  K.coping(S, WALL_TOP, CORN, 0.55, 'ochre', 0.85, DEPTH - 0.85);
  balcony(c);
  eastDormer(c);
}
/** Text in the kit's 5x7 capitals at a measured glyph width and advance (the sign is letter-spaced). */
function lettering(b: BuildingTools, f: Frame, text: string, centre: number, y: number, h: number, glyphW: number, advance: number) {
  const chars = [...text], total = advance * (chars.length - 1) + glyphW;
  chars.forEach((ch, i) => { if (ch !== ' ') letters(b, f, ch, centre - total / 2 + glyphW / 2 + i * advance, y, 0, glyphW / 5, 0.05, 'blue', h / 7); });
}
/** Steel balcony along the east face at the first floor: floor plate, railing, end returns and struts over the garden. */
function balcony(c: Ctx) {
  const {b} = c, f = frameAt(EM, 0, 0), s0 = 0.12, s1 = DEPTH - 0.1, D = 1.25, L = s1 - s0, mid = (s0 + s1) / 2;
  slab(b, f, mid, BAL - 0.28, L, 0.28, D, 'copper');
  slab(b, f, mid, BAL + 0.92, L, 0.05, 0.05, 'copper', D - 0.05);
  ledgeStrip(b, f, mid, BAL + 0.12, L, 0.04, 0.04, 'copper', D - 0.05);
  for (let s = s0 + 0.06; s < s1; s += 0.13) ledgeStrip(b, f, s, BAL + 0.03, 0.02, 0.9, 0.02, 'copper', D - 0.04);
  for (const s of [s0 + 0.03, s1 - 0.03]) {
    const g = outFrame(EM, s);
    slab(b, g, D / 2, BAL + 0.92, D, 0.05, 0.05, 'copper', -0.025);
    for (let o = 0.15; o < D - 0.05; o += 0.15) slab(b, g, o, BAL, 0.02, 0.92, 0.02, 'copper', -0.01);
  }
  for (const s of [0.7, 2.6, 4.5, 6.4]) {
    const g = outFrame(EM, s);
    poly(b, g, 0, 0, [[0, 3.95], [0.09, 3.95], [D - 0.05, BAL - 0.3], [D - 0.18, BAL - 0.28]], 0.07, 'copper', -0.035);
  }
}
/** White-cheeked dormer of two lights on the east hip, centred over the lettering. */
function eastDormer(c: Ctx) {
  const {K} = c, off = -0.12, back = 2.6, s0 = 5.2, s1 = 6.95, top = 12.95;
  const S = K.sec(EM, s0, s1, EAVE, top, 'ochre', off);
  K.opening(S, 6.07, 11.75, 1.1, 1.05, {cols: 2, frame: 'frame', depth: 0.1, edge: 0.06});
  K.endCap(EM, s0, EAVE, top, 'ochre', -1, -back, off);
  K.endCap(EM, s1, EAVE, top, 'ochre', 1, -back, off);
  K.coping(S, top, 0.13, 0.1, 'ochre', s0 - 0.08, s1 + 0.08, back - 0.35);
}
/** Roof windows on the east hip and the chimney at the north-east. */
function roofParts() {
  const k = (TOP - EAVE) / INSET;
  for (const d of [3.1, 9.1]) {
    const e0 = -1.15, e1 = -0.55, lift = 0.06;
    M.quad('glass', P(e1, d - 0.32, EAVE + (0 - e1) * k + lift), P(e1, d + 0.32, EAVE + (0 - e1) * k + lift), P(e0, d + 0.32, EAVE + (0 - e0) * k + lift), P(e0, d - 0.32, EAVE + (0 - e0) * k + lift), [vE[0] * k, 1, vE[2] * k]);
  }
  box('brick', -1.45, -0.9, 10.55, 11.15, EAVE - 0.5, 14.15);
  box('slate', -1.4, -0.95, 10.6, 11.1, 14.15, 14.4);
}

// ---- rear block and north face ---------------------------------------------------------------------------------------------
function rear(c: Ctx) {
  const {K} = c;
  const S = K.sec(ER, 0, BACK - DEPTH, WING_FLOOR - 0.05, REAR_TOP, 'brick', 0);
  K.opening(S, 2.25, 4.9, 1.3, 1.7, {cols: 2, frame: 'white', depth: 0.14, edge: 0.07});
  slab(c.b, ff(c, S), 2.25, 4.74, 1.5, 0.12, 0.08, 'ochre');                                 // sill 4 cm under the reveal
  K.coping(S, REAR_TOP, 0.22, 0.12, 'ochre', 0, BACK - DEPTH - 0.02);
  const N = K.sec(NM, 0, -WEST, REAR_TOP - 0.05, WALL_TOP, 'brick', 0);
  K.coping(N, WALL_TOP, CORN, 0.55, 'ochre', -0.55, -WEST - 0.06);
}

// ---- the wing and the garden wall on the Nassaukade --------------------------------------------------------------------------
function nassaukade(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(NQ, 0, WING_S, BASE, GW_TOP, 'brick', 0);
  const A = K.sec(NQ, WING_S, BACK, BASE, WING_FLOOR, 'brick', 0);
  // garden wall: arched window, the wide segmental gateway (iron gate), pediment over it
  K.opening(G, 2.35, 0.75, 0.8, 1.95, {cols: 2, frame: 'frame', depth: 0.2, rise: 0.4, edge: 0.05});
  K.opening(G, 6.07, 0.0, 2.45, 2.95, {cols: 12, frame: 'dark', depth: 0.25, rise: 0.6, bars: [1.0, 2.15], edge: 0.06, barW: 0.035});
  {
    const f = ff(c, G);
    const W2 = 1.18, pts: [number, number][] = [[-W2, 0], [W2, 0], [W2, 0.16], [W2 - 0.16, 0.22]];
    for (let k = 0; k <= 10; k++) { const x = (W2 - 0.3) * (1 - 2 * k / 10); pts.push([x, 0.3 + 0.3 * Math.sqrt(Math.max(0, 1 - (x / (W2 - 0.2)) ** 2))]); }
    pts.push([-(W2 - 0.16), 0.22], [-W2, 0.16]);
    poly(b, f, 6.03, GW_TOP + 0.25, pts, 0.45, 'ochre', -0.3);
    slab(b, f, 6.03, GW_TOP + 0.83, 0.62, 0.1, 0.2, 'ochre', -0.05);
  }
  // wing: arched window and arched door
  K.opening(A, 9.78, 0.65, 0.78, 2.05, {cols: 2, frame: 'frame', depth: 0.2, rise: 0.39, edge: 0.05});
  K.opening(A, 13.7, 0.1, 0.92, 2.65, {back: 'dark', frame: 'frame', depth: 0.2, rise: 0.46, edge: 0.05});
  for (const [S, s, w] of [[G, 2.35, 0.8], [A, 9.78, 0.78], [A, 13.7, 0.92]] as const) {
    slab(b, ff(c, S), s, 3.0, w + 0.55, 0.24, 0.08, 'ochre');                                  // white hood
    band(c, S, s - w / 2 - 1.0, s - w / 2 - 0.06, 2.18, 0.1, 0.06);                           // impost bands
    band(c, S, s + w / 2 + 0.06, s + w / 2 + 1.0, 2.18, 0.1, 0.06);
  }
  band(c, G, 6.07 - 1.225 - 0.85, 6.07 - 1.225 - 0.06, 2.18, 0.1, 0.06);
  band(c, G, 6.07 + 1.225 + 0.06, WING_S - 0.06, 2.18, 0.1, 0.06);
  // dark plinth, broken at the gate and the door
  for (const [S, s0, s1] of [[G, 0.05, 4.8], [A, WING_S, 13.2], [A, 14.2, BACK - 0.06]] as const) slab(b, ff(c, S), (s0 + s1) / 2, BASE, s1 - s0, 0.25 - BASE, 0.05, 'concrete');
  // garden wall: back face, street end, coping
  const tw = 0.45;
  wallQuad('brick', NK - tw, 0, NK - tw, WING_S, BASE, GW_TOP, vW);
  K.endCap(NQ, 0, BASE, GW_TOP, 'brick', -1, -tw, 0);
  K.coping(G, GW_TOP, 0.25, 0.15, 'ochre', -0.15, WING_S, tw);
  // wing parapet, white frieze and coping round the terrace
  K.along(NQ, WING_S, BACK - 0.06, [[0, WING_FLOOR], [0, WING_TOP], [-0.3, WING_TOP], [-0.3, WING_FLOOR]], 'brick');
  slab(b, ff(c, A), (WING_S + BACK - 0.06) / 2, 3.82, BACK - WING_S - 0.06, WING_TOP - 3.82, 0.06, 'ochre');
  K.coping(A, WING_TOP, 0.25, 0.2, 'ochre', WING_S - 0.2, BACK - 0.06);
  // wing's south wall over the garden (hidden behind the pavilion: plain, inferred)
  const GS = K.sec(GA, 0, NK, BASE, WING_FLOOR, 'brick', 0);
  K.along(GA, 0, NK, [[0, WING_FLOOR], [0, WING_TOP], [-0.3, WING_TOP], [-0.3, WING_FLOOR]], 'brick');
  K.coping(GS, WING_TOP, 0.25, 0.12, 'ochre', 0, NK - 0.85);
  K.opening(GS, 3.6, 0.1, 1.8, 2.5, {cols: 2, frame: 'frame', depth: 0.16, edge: 0.07});
}
/** Garden: tall hedge on the street line and the dark terrace pavilion inside (present 2022-2025). */
function garden() {
  box('green', 0.08, NK - 0.5, 0.05, 0.8, 0, 2.8);
  box('copper', 0.05, NK - 0.5, 1.3, WING_S - 0.05, 3.42, 3.72);
  box('glass', 0.3, NK - 0.7, 1.32, 1.4, 0.0, 3.42);
  for (const e of [0.25, NK - 0.65]) box('copper', e - 0.05, e + 0.05, 1.28, 1.45, 0, 3.42);
}

export function buildMorganMees(_w: number, _d: number, b: BuildingTools) {
  M = new Mesh();
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b};
    hipRoof();
    partyWalls();
    roofParts();
    streetFront(c);
    eastFace(c);
    rear(c);
    nassaukade(c);
    garden();
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
