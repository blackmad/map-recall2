import type {BuildingTools} from './cultural-builders';
import * as T from 'three';
import {awning, poly, ringSlab, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {lettering, strutBetween, TriSink, type XZ} from './venue-kit';
import source from './q-factory-footprints.json' with {type: 'json'};

/**
 * Q-Factory, Atlantisplein 1 (BAG pand 0363100012158881, 2009): the music centre on the former Amstel brewery site, a
 * five-level block round three sides of the Atlantisplein courtyard. Read from rectified Gemeente Amsterdam panoramas
 * (CC BY 4.0, venue-face-crops.ts at 25 px/m and the landmark-brief crops):
 *  - every face is dark brown ribbed metal cladding in storey bands (joints at 3.8, 7.4, 11.0 and 14.7 m, top 18 m)
 *    with an irregular scatter of white panel strips, each holding a window in its upper part (measured per storey on
 *    the courtyard, IJ-side north and east faces; a seeded scatter of the same density on the short wing faces);
 *  - the courtyard (south) face: the yellow Q logo with the factory in its counter over the entrance, a glazed first
 *    floor band, a white fascia with pictograms, Q-FACTORY in yellow on a dark panel, the entrance, the cafe awning;
 *  - the north face: blind hall walls up to 7.4 m with stage doors and posters;
 *  - the west face: the Conservatorium pop department's entrance under a deep recess (4.6 m, from 7.4 m up) with a
 *    perforated metal canopy hung on three ties, murals beside the glazing.
 * Roof: one flat slab at the 3DBAG LoD2.2 height (18.0 m, CC BY 4.0), cut back over the west recess.
 */
type Shell = {nativeRing: XZ[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const len = (a: XZ, b: XZ) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ch = (i: number, j: number): Chord => ({a: R[i], b: R[j]});
const N = ch(1, 2), W = ch(3, 4), WS = ch(4, 5), WE = ch(5, 6), S = ch(6, 7), EW = ch(7, 8), ES = ch(8, 9), E = ch(9, 1);
const BANDS = [3.8, 7.4, 11.0, 14.7], TOP = 18.0, ROOF = 18.0;
const LEVELS: [number, number][] = [[-0.3, 3.8], [3.8, 7.4], [7.4, 11.0], [11.0, 14.7], [14.7, TOP]];
/** West recess: s 11.5-30 along W, from 7.4 m up, 4.6 m deep. */
const REC0 = 11.5, REC1 = 30.0, REC_D = 4.6;

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};
type Unit = [number, number];   // centre s, width

// ---- shell: one flat roof over the ring, cut back over the west recess ---------------------------------------------------
// The photos show one flat roofline at 18 m on every face; 3DBAG splits it into plant boxes (18.7-19.6 m) and a sunken
// terrace (16.4 m) behind the east face's top storey, which the cladding screens from the street. The terrace and the
// plant boxes are not drawn.
function shell(c: Ctx) {
  const P = (s: number, o: number): XZ => frameAt(W, s, o).origin;
  const outline: XZ[] = [R[0], R[1], R[2], R[3], P(REC0, 0), P(REC0, -REC_D), P(REC1, -REC_D), P(REC1, 0), R[4], R[5], R[6], R[7], R[8], R[9]];
  for (const [i, j, k] of T.ShapeUtils.triangulateShape(outline.map(p => new T.Vector2(p[0], p[1])), [])) {
    c.M.tri('slate', [outline[i][0], ROOF, outline[i][1]], [outline[j][0], ROOF, outline[j][1]], [outline[k][0], ROOF, outline[k][1]], [0, 1, 0]);
  }
  // the recess floor at 7.4 m
  const Q = (s: number, o: number, y: number) => { const q = P(s, o); return [q[0], y, q[1]]; };
  c.M.quad('slate', Q(REC0, 0, BANDS[1]), Q(REC1, 0, BANDS[1]), Q(REC1, -REC_D, BANDS[1]), Q(REC0, -REC_D, BANDS[1]), [0, 1, 0]);
  // the 2-m jog at the north-west corner (ring 2 -> 3)
  c.K.sec(ch(2, 3), 0, len(R[2], R[3]), -0.3, TOP, 'brick', 0);
}

// ---- cladding bands with white window strips --------------------------------------------------------------------------
/** Deterministic scatter of window strips at the measured density (about one per 3.6 m per storey, one in five double). */
function scatter(L: number, seed: number): Unit[] {
  let x = seed * 7919 % 2147483647 || 1;
  const rnd = () => (x = x * 48271 % 2147483647) / 2147483647;
  const out: Unit[] = [];
  for (let s = 1.2 + rnd() * 2; s < L - 1.0; s += 2.6 + rnd() * 2.6) {
    const w = rnd() < 0.2 ? 2.3 : 1.15;
    if (s + w / 2 < L - 0.6) out.push([s + w / 2, w]);
    s += w;
  }
  return out;
}
/** One storey band of a face: the cladding section, its white strips with windows, the joint ledge at its foot. */
function band(c: Ctx, chord: Chord, s0: number, s1: number, level: number, units: Unit[], winLow = false): Sec {
  const {K, b} = c;
  const [y0, y1] = LEVELS[level];
  const sec = K.sec(chord, s0, s1, y0, y1, 'brick', 0);
  const f = frameAt(chord, 0, 0), hw = Math.min(1.35, y1 - y0 - 0.9);
  for (const [s, w] of units) {
    if (s - w / 2 < s0 + 0.15 || s + w / 2 > s1 - 0.15) continue;
    const wy = winLow ? y0 + 0.35 : y1 - 0.3 - hw;
    K.opening(sec, s, wy, w - 0.14, hw, {frame: 'white', back: 'glass', depth: 0.1, edge: 0.06, cols: w > 1.8 ? 2 : 1});
    // the white panel strip round it, flush with the cladding ribs
    const lo = Math.max(y0, 0) + 0.1, hi = level === 4 ? TOP - 0.27 : y1 - 0.1;   // under the cap on the top storey
    // (5 cm clear of the reveal's sill and head planes; the frame ring inside the reveal is white too)
    if (wy - 0.05 - lo > 0.05) slab(b, f, s, lo, w, wy - 0.05 - lo, 0.06, 'white');
    if (hi - (wy + hw + 0.05) > 0.05) slab(b, f, s, wy + hw + 0.05, w, hi - (wy + hw + 0.05), 0.06, 'white');
  }
  if (level > 0) slab(b, f, (s0 + s1) / 2, y0 - 0.05, s1 - s0, 0.1, 0.06, 'frame');   // the joint between bands
  return sec;
}
function coping(c: Ctx, chord: Chord, s0: number, s1: number) {
  slab(c.b, frameAt(chord, 0, 0), (s0 + s1) / 2, TOP - 0.25, s1 - s0, 0.37, 0.08, 'concrete');   // aluminium cap
}
/** A plain storey stack (levels 1-4) with measured units per level, or the seeded scatter when a level has none. */
function stack(c: Ctx, chord: Chord, s0: number, s1: number, units: (Unit[] | null)[], seed: number, from = 1) {
  for (let lv = from; lv <= 4; lv++) band(c, chord, s0, s1, lv, units[lv] ?? scatter(s1 - s0, seed * 10 + lv).map(([s, w]) => [s + s0, w] as Unit));
  coping(c, chord, s0, s1);
}

// ---- the courtyard (south) face, ring 6 -> 7 ---------------------------------------------------------------------------
function south(c: Ctx) {
  const {K, b} = c;
  const L = len(R[6], R[7]), f = frameAt(S, 0, 0);
  const m = (px: number) => px / 48.6;   // brief crop w04-161 (39 m across 1896 px)
  // storeys measured from the crop: [left px, right px] per white strip
  const meas = (xs: [number, number][]): Unit[] => xs.map(([a, z]) => [(m(a) + m(z)) / 2, m(z) - m(a)]);
  const l4 = meas([[5, 65], [248, 305], [548, 605], [728, 785], [1083, 1140], [1498, 1555], [1795, 1850]]);
  const l3 = meas([[65, 125], [248, 365], [608, 665], [785, 842], [1022, 1080], [1262, 1320], [1555, 1612], [1735, 1790]]);
  const l2 = meas([[5, 65], [305, 365], [548, 605], [728, 785], [1083, 1140], [1203, 1260], [1498, 1555], [1675, 1735]]);
  for (const [lv, u] of [[2, l2], [3, l3], [4, l4]] as const) band(c, S, 0, L, lv, u);
  coping(c, S, 0, L);
  // first floor: dark cladding either side of a glazed band (8.9-33.2 m), mullions ~2.4 m
  const l1 = band(c, S, 0, L, 1, []);
  K.opening(l1, (8.9 + 33.2) / 2, 4.7, 33.2 - 8.9, 2.65, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0, cols: 10});
  slab(b, f, 33.55, 4.7, 0.5, 2.6, 0.06, 'white');
  // white fascia with pictograms over the entrance block (12.4 m to the end), 3.8-4.6 m
  slab(b, f, (12.4 + L) / 2, 3.8, L - 12.4, 0.8, 0.12, 'concrete');
  for (let k = 0; k < 7; k++) slab(b, f, 19.4 + k * 0.62, 4.0, 0.42, 0.42, 0.04, 'dark', 0.12);
  // the yellow Q logo (18.6-22.3 m, 7.5-11.0 m) with the factory in the Q's counter
  const qc = 20.45, qy = 9.25;
  slab(b, f, qc, 7.5, 3.7, 3.45, 0.06, 'ochre');
  ringSlab(b, f, qc, qy, 1.0, 1.4, 0.04, 'dark', 0.06);
  poly(b, f, 0, 0, [[qc + 0.55, qy - 1.15], [qc + 0.95, qy - 1.15], [qc + 1.45, qy - 1.65], [qc + 1.05, qy - 1.65]], 0.04, 'dark', 0.06);
  poly(b, f, qc, qy, [[-0.62, -0.55], [0.62, -0.55], [0.62, 0.05], [0.31, -0.2], [0.31, 0.05], [0, -0.2], [0, 0.05], [-0.31, -0.2], [-0.31, 0.6], [-0.62, 0.6]], 0.04, 'dark', 0.06);
  // ground floor: the cafe glazing under its awning, Q-FACTORY panel, the entrance, glazing, the poster wall
  const g = K.sec(S, 0, L, -0.3, 3.8, 'brick', 0);
  K.opening(g, 6.2, 0, 11.6, 3.3, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: 5});
  awning(b, f, 6.2, 3.1, 12.4, 1.2, 2.6, 'dark');
  slab(b, f, 12.8, 0, 0.6, 3.8, 0.06, 'white');
  lettering(b, f, 'Q-FACTORY', 15.9, 2.2, 0.115, 0.04, 'ochre');
  K.opening(g, 21.15, 0, 3.8, 3.3, {frame: 'white', back: 'glass', depth: 0.2, edge: 0.1, cols: 2, bars: [2.5]});
  K.opening(g, 25.8, 0, 5.0, 3.3, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: 2});
  const posters: [number, 'red' | 'ochre' | 'blue'][] = [[30.4, 'ochre'], [31.6, 'blue'], [32.9, 'ochre']];
  for (const [s, col] of posters) slab(b, f, s, 1.4, 0.7, 1.0, 0.06, col);
  K.opening(g, 36.0, 0, 1.0, 2.4, {frame: 'white', back: 'dark', depth: 0.12, edge: 0.06});
}

// ---- the north (IJ-side street) face, ring 1 -> 2 -----------------------------------------------------------------------
function north(c: Ctx) {
  const {K, b} = c;
  const L = len(R[1], R[2]), f = frameAt(N, 0, 0);
  const u = (xs: (number | [number, number])[]): Unit[] => xs.map(x => (Array.isArray(x) ? [(x[0] + x[1]) / 2, x[1] - x[0]] : [x, 1.15]) as Unit);
  const l4 = u([4.2, 6.3, 8.6, [11.3, 13.5], 16.6, 18.9, 25.4, 27.6, 29.7, 32.0, 34.3, 36.5, 38.7, 41.0, 43.0]);
  const l3 = u([4.0, 7.2, 8.6, 10.8, 13.2, [16.0, 18.2], [20.4, 22.6], 25.4, 27.6, 29.8, 32.0, [33.4, 35.6], [38.0, 40.2], 43.0, 45.2, [46.6, 48.8], 50.5, 52.6, 54.6, 57.0]);
  const l2 = u([21.2, 26.4, 30.9, 36.4, 40.8, 45.2, 49.4, 53.6]);
  band(c, N, 0, L, 2, l2, true); band(c, N, 0, L, 3, l3); band(c, N, 0, L, 4, l4);
  coping(c, N, 0, L);
  band(c, N, 0, L, 1, []);   // blind hall walls
  const g = band(c, N, 0, L, 0, []);
  for (const s of [27.6, 34.0, 40.8, 48.4, 54.6]) K.opening(g, s, 0, 1.0, 2.5, {frame: 'white', back: 'dark', depth: 0.12, edge: 0.06});
  const cols = ['ochre', 'blue', 'red', 'white'] as const;
  [23.4, 25.4, 29.7, 32.0, 36.4, 38.6, 42.6, 44.6, 46.4, 50.6, 52.6, 56.6].forEach((s, i) => slab(b, f, s, 1.3, 0.65, 0.95, 0.06, cols[i % 4]));
}

// ---- the east face, ring 9 -> 1 ------------------------------------------------------------------------------------------
function east(c: Ctx) {
  const {K} = c;
  const L = len(R[9], R[1]);
  const u = (xs: (number | [number, number])[]): Unit[] => xs.map(x => (Array.isArray(x) ? [(x[0] + x[1]) / 2, x[1] - x[0]] : [x, 1.15]) as Unit);
  stack(c, E, 0, L, [null,
    u([7.8, [12.6, 15.0], 18.9, 25.4, 28.8, 34.2, [36.8, 39.2], 43.5, 46.8]),
    u([8.2, 11.9, 14.4, 17.8, 20.4, 24.2, 29.2, 35.4, 39.2, 43.0, 46.6]),
    u([3.0, 6.5, 10.0, 15.0, 19.5, 23.0, 26.5, 30.6, 34.0, 37.8, 44.0]),
    // top storey: blind where the screen wall fronts the roof terrace (3DBAG 16.4-17.8 m within 0.4 m of the face)
    scatter(L, 94).filter(([s]) => s < 18 || s > 42)], 9);
  const g = band(c, E, 0, L, 0, []);
  K.opening(g, 6.6, 0, 12.4, 3.4, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: 5});
  K.opening(g, 19.0, 0, 1.2, 2.6, {frame: 'frame', back: 'dark', depth: 0.12, edge: 0.06, rows: 6});
  K.opening(g, 40.0, 0, 6.0, 3.3, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: 3});
}

// ---- the west face with the Conservatorium recess, ring 3 -> 4 -----------------------------------------------------------
function west(c: Ctx) {
  const {K, b, M} = c;
  const L = len(R[3], R[4]), f = frameAt(W, 0, 0);
  stack(c, W, 0, REC0, [null, null, [[9.0, 1.2]], [[1.0, 1.2], [5.7, 1.2], [9.2, 1.2]], [[1.0, 1.2], [5.7, 1.2], [9.0, 1.2]]], 31);
  stack(c, W, REC1, L, [null, null, null, null, null], 32);
  band(c, W, REC0, REC1, 1, []);   // blind band under the canopy
  const g = band(c, W, 0, L, 0, []);
  for (const s of [2.0, 4.6, 7.0]) K.opening(g, s, 1.2, 0.9, 1.3, {frame: 'white', back: 'glass', depth: 0.1, edge: 0.06});
  K.opening(g, 24.0, 0, 11.0, 3.4, {frame: 'frame', back: 'glass', depth: 0.14, edge: 0.07, cols: 5, bars: [2.6]});
  K.opening(g, 40.6, 0, 9.8, 3.4, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: 5});
  // murals either side of the entrance
  slab(b, f, 15.9, 0.3, 4.6, 3.2, 0.06, 'red');
  slab(b, f, 33.0, 0.3, 4.6, 3.2, 0.06, 'pink');
  lettering(b, f, 'Conservatorium van Amsterdam', 24.0, 2.75, 0.045, 0.02, 'white', 0.02);
  // the recess: glazed back wall 4.6 m in, cladding returns either side
  const back: Chord = {a: frameAt(W, REC0, -REC_D).origin, b: frameAt(W, REC1, -REC_D).origin};
  const bl = REC1 - REC0;
  const bs = K.sec(back, 0, bl, BANDS[1], TOP, 'brick', 0);
  for (let k = 0; k < 3; k++) K.opening(bs, bl / 2, BANDS[1] + 0.4 + k * 3.6, bl - 1.0, 2.8, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: 8});
  for (const [s, sign] of [[REC0, 1], [REC1, -1]] as const) {
    const a = frameAt(W, s, -REC_D).origin, z = frameAt(W, s, 0).origin;
    const side: Chord = sign > 0 ? {a: z, b: a} : {a, b: z};   // each return faces into the recess
    const ss = K.sec(side, 0, REC_D, BANDS[1], TOP, 'brick', 0);
    K.opening(ss, REC_D / 2, 12.0, 1.1, 1.35, {frame: 'white', back: 'glass', depth: 0.1, edge: 0.06});
    for (const y of [BANDS[2], BANDS[3]]) slab(b, frameAt(side, 0, 0), REC_D / 2, y - 0.05, REC_D, 0.1, 0.06, 'frame');
  }
  // the perforated metal canopy (7.6-8.2 m) from the recess back to 1 m out, hung on three ties
  const cf = frameAt(W, 0, 0);
  slab(b, cf, (REC0 + REC1) / 2, 7.6, bl - 0.2, 0.6, REC_D + 1.0 - 0.05, 'frame', -REC_D + 0.05);
  const P = (s: number, o: number, y: number): [number, number, number] => { const q = frameAt(W, s, o).origin; return [q[0], y, q[1]]; };
  for (const s of [16.5, 20.8, 25.0]) strutBetween(b, P(s, 0.6, 8.2), P(s, -REC_D + 0.2, 14.4), 0.06, 'dark');
  void M;
}

// ---- the courtyard wings and their ends -------------------------------------------------------------------------------------
function wings(c: Ctx) {
  const {K} = c;
  for (const [chord, seed] of [[WS, 41], [WE, 42], [EW, 43], [ES, 44]] as const) {
    const L = len(chord.a, chord.b);
    stack(c, chord, 0, L, [null, null, null, null, null], seed);
    const g = band(c, chord, 0, L, 0, []);
    K.opening(g, L / 2, 0, L - 1.4, 3.3, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.07, cols: Math.max(1, Math.round((L - 1.4) / 2.4))});
  }
}

export function buildQFactory(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    south(c);
    north(c);
    east(c);
    west(c);
    wings(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
