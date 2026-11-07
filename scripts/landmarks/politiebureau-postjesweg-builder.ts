import type {BuildingTools} from './cultural-builders';
import {letters, poly} from './nearbar-kit';
import {band, face, flushFaces, ledgeStrip, opening, planFrame, resetFaces, slab, wall, type Face, type FR, type P2} from './modern-front-kit';

/**
 * Politiebureau Postjesweg, Postjesweg 179: BAG pand 0363100012092810, bouwjaar 2004, one verblijfsobject (kantoorfunctie;
 * BAG, CC0). The police station of the Postjesweg/Hoofdweg: POLITIE lettering and police vans on the 2025 north panorama.
 * Architect not named by the BAG, nl.wikipedia or a monument record (none); unconfirmed.
 *
 * Plan frame (politiebureau-postjesweg-footprints.json, native x east, z south, y up from the -0.85 m NAP street): u along
 * the north front from its east end (BAG vertex (9.171, -6.899)) westwards, v into the block (south). One 22.5 x 24.5 m
 * red-brick box under a flat parapet at 12.0 m (3DBAG roof 11.4 m above the street, the crops' parapet edges 11.9-12.3 m),
 * a louvred plant box on the roof (3DBAG roof parts to 13.8 m).
 *
 * Fronts measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of politiebureau-postjesweg-brief.md,
 * 50 px/m: w04-359 north (2025-10-01), w03-179 south (2016-08-10), w02-269 west (2022-12-07, its ground hidden by the
 * Avondverkoop kiosk and a site fence). The east wall w01-89 is seen only above and beside the beige neighbour in front of
 * it (2025, 45 deg oblique): its top ribbon and the north end are from that crop, the rest is INFERRED.
 */
const O: P2 = [9.171, -6.899], U: P2 = [-0.999957, 0.009247], V: P2 = [0.009247, 0.999957];
const {fr, capUp, prism} = planFrame(O, U, V);
const L = 22.5, D = 24.5, TOP = 12.0;
const R1: [number, number] = [4.5, 6.5];

/** Tall storey-1 window: 0.84 x 2.0, grey frame, a top light. */
const tall = (b: BuildingTools, F: Face, t: number, y0 = R1[0], h = R1[1] - R1[0], w = 0.84) => opening(b, F, t, y0, w, h, {depth: 0.15, bars: [h - 0.5], sill: 'concrete'});
/** Horizontal strip window of `n` lights. */
const strip = (b: BuildingTools, F: Face, t0: number, t1: number, y0: number, y1: number, n: number, bars: number[] = []) =>
  opening(b, F, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, {depth: 0.15, cols: n, bars, sill: 'concrete'});
/** Ventilation grille in the south plinth: a shallow recess with four vertical ribs. */
function grille(b: BuildingTools, F: Face, t: number) {
  F.holes.push({t0: t - 0.35, t1: t + 0.35, y0: 0.6, y1: 2.85, depth: 0.12, back: 'bronze'});
  for (let k = 0; k < 4; k++) ledgeStrip(b, F.f, t - 0.24 + k * 0.16, 0.6, 0.05, 2.25, 0.06, 'brick', -0.12);
}
/** Cantilevered glass box (oriel) on face S from t0 to t1, y0..y1, `proj` out: grey grid of `cols` x `rows` panes, a red cap. */
function oriel(b: BuildingTools, S: FR, t0: number, t1: number, y0: number, y1: number, proj: number, cols: number, rows: number, ends: [boolean, boolean]) {
  const w = t1 - t0, tm = (t0 + t1) / 2;
  slab(b, S.f, tm, y0, w, y1 - y0, proj, 'glass');
  slab(b, S.f, tm, y0 - 0.2, w + 0.04, 0.2, proj + 0.04, 'frame');
  slab(b, S.f, tm, y1, w + 0.08, 0.16, proj + 0.08, 'red');
  for (let k = 0; k <= cols; k++) ledgeStrip(b, S.f, t0 + 0.04 + (w - 0.08) * k / cols, y0, 0.08, y1 - y0, 0.05, 'frame', proj);
  for (let k = 1; k < rows; k++) ledgeStrip(b, S.f, tm, y0 + (y1 - y0) * k / rows - 0.03, w, 0.06, 0.05, 'frame', proj);
  // end panes: the box's sides are glass too, with one upright
  for (const [e, t] of [[ends[0], t0], [ends[1], t1]] as [boolean, number][]) if (e) slab(b, S.f, t, y0, 0.08, y1 - y0, 0.06, 'frame', proj / 2 - 0.03);
}
/** Wall lamp. */
const lamp = (b: BuildingTools, F: FR, t: number, y: number) => slab(b, F.f, t, y, 0.45, 0.12, 0.35, 'frame');

function north(b: BuildingTools) {
  const S = fr([0, 0], [L, 0]);
  const F = face(S, 0, TOP, 'brick');
  // storey 1: eleven tall windows, a gap for the sign over the third
  for (const t of [2.36, 4.02, 5.68, 9.15, 10.82, 12.48, 14.16, 15.82, 17.5, 19.2, 20.86]) tall(b, F, t);
  // storey 2: two low wide windows over the sign; the glass oriel to the west corner
  for (const t of [7.75, 10.25]) strip(b, F, t - 0.85, t + 0.85, 8.66, 9.5, 2);
  oriel(b, S, 13.9, L, 8.1, 10.6, 0.6, 6, 3, [true, false]);
  // the east corner: a grey cantilevered balcony box and a pergola of grey slats above it
  slab(b, S.f, 2.45, 7.1, 4.3, 1.6, 0.7, 'concrete');
  for (let k = 0; k < 6; k++) slab(b, S.f, 2.3, 8.95 + k * 0.42, 4.0, 0.08, 0.6, 'frame', 0.05);
  slab(b, S.f, 4.3, 7.1 + 1.6, 0.12, 2.9, 0.12, 'frame', 0.55);
  // POLITIE in police blue with the badge, between storeys 1 and 2 at t 6.3-9.8
  letters(b, S.f, 'POLITIE', 8.03, 7.26, 0.05, 0.084, 0.05, 'blue', 0.069);
  poly(b, S.f, 7.05, 6.95, [[0, 0], [0.3, 0.55], [0, 1.3], [-0.3, 0.55]], 0.06, 'blue', 0.12);
  // ground: the glazed corner entrance, the window under the sign, the garage doors
  opening(b, F, 3.45, 0.05, 2.3, 2.55, {depth: 0.3, cols: 2, bars: [2.1]});
  strip(b, F, 6.0, 10.1, 1.3, 2.5, 3);
  for (const [a, c] of [[11.6, 16.3], [16.5, 18.0], [18.6, 21.5]]) opening(b, F, (a + c) / 2, 0.0, c - a, 2.85, {depth: 0.2, back: 'slate', rows: 5, frame: 'slate', edge: 0.08});
  for (const t of [5.4, 11.6, 17.6]) lamp(b, S, t, 7.4);
  band(b, S, -0.05, L + 0.05, TOP - 0.15, TOP, 0.06, 'stone');
}
function south(b: BuildingTools) {
  const S = fr([L, D], [0, D]);
  const F = face(S, 0, TOP, 'brick');
  strip(b, F, 0.24, 21.1, 8.54, 10.56, 8, [0.6, 1.4]);
  strip(b, F, 0.0, 5.35, 6.2, 7.04, 4);
  for (const t of [10.15, 11.65, 13.15, 14.65, 16.15, 19.15, 20.65]) tall(b, F, t, 4.9, 2.14, 0.86);
  opening(b, F, 0.45, 1.7, 0.7, 1.16, {depth: 0.15, sill: 'concrete'});
  strip(b, F, 17.7, 21.6, 1.7, 2.85, 3);
  for (let k = 0; k < 9; k++) grille(b, F, 3.45 + k * 1.51);
  for (const t of [6.5, 15.5]) lamp(b, S, t, 7.6);
  band(b, S, -0.05, L + 0.05, TOP - 0.15, TOP, 0.06, 'stone');
}
function west(b: BuildingTools) {
  const S = fr([L, 0], [L, D]);
  const F = face(S, 0, TOP, 'brick');
  // top storey: a small projecting window box at the north end, four tall louvred windows, the glass corner box to the south
  oriel(b, S, 1.4, 3.2, 8.7, 10.4, 0.5, 2, 1, [true, true]);
  for (const t of [14.0, 15.6, 17.15, 18.7]) opening(b, F, t, 8.54, 0.86, 2.12, {depth: 0.15, back: 'slate', rows: 6, frame: 'slate', edge: 0.05});
  oriel(b, S, 19.4, D, 7.5, 12.0 - 0.16, 0.5, 2, 4, [true, false]);
  strip(b, F, 7.1, 12.3, 6.2, 7.0, 4);
  strip(b, F, 16.2, 19.2, 6.2, 7.0, 2);
  // ground (above the kiosk and fence): five small windows
  for (const t of [12.35, 14.95, 17.55, 20.1, 22.65]) opening(b, F, t, 1.5, 0.7, 1.16, {depth: 0.15, sill: 'concrete'});
  band(b, S, -0.05, D + 0.05, TOP - 0.15, TOP, 0.06, 'stone');
}
function east(b: BuildingTools) {
  // w01-89 sees the top ribbon (t 12.8-15.7 from the south) and the north end over the beige neighbour; the rest INFERRED
  const S = fr([0, D], [0, 0]);
  const F = face(S, 0, TOP, 'brick');
  strip(b, F, 12.8, 15.7, 8.6, 10.5, 2, [0.9]);
  strip(b, F, 21.7, 23.0, 8.6, 9.6, 1);
  for (const t of [22.0, 23.3]) tall(b, F, t);
  for (const t of [3.0, 6.0, 9.0, 18.0]) tall(b, F, t);
  opening(b, F, 23.2, 0.05, 2.2, 2.55, {depth: 0.3, cols: 2, bars: [2.1]});
  band(b, S, -0.05, D + 0.05, TOP - 0.15, TOP, 0.06, 'stone');
}

export function buildPolitiebureauPostjesweg(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  resetFaces();
  north(b); south(b); west(b); east(b);
  capUp(b, [[0, 0], [L, 0], [L, D], [0, D]], TOP, 'copper');
  // louvred plant box on the roof (3DBAG parts u 6.3-11.3, v 6.0-12.9, to 13.8 m)
  prism(b, [[6.3, 6.0], [11.3, 6.0], [11.3, 12.9], [6.3, 12.9]], TOP, 13.8, 'slate', 'copper');
  flushFaces(b);
  void wall;
}
