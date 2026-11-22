import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, letters, ledgeStrip, poly, put, ringFrame, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {stripedAwningOn} from './striped-awning-kit';
import source from './hans-en-grietje-spiegelgracht-footprints.json';

/**
 * CAFE HANS EN GRIETJE, Spiegelgracht 27 at the corner of the Lijnbaansgracht / Tweede Weteringdwarsstraat (BAG pand
 * 0363100012169479, BAG year 1856; rijksmonument, municipal register 5504 without description text). A two-storey brick
 * corner house under a hipped red pantile roof with white dormers, a white timber cornice, and the cafe's dress: red and
 * white striped markiezen over every window, CAFE HANS en GRIETJE in cream capitals on the south front, RESTAURANT on a
 * rail over the cornice, the cut-out chef with his menu board at the corner, the Heineken disc, the shopfront with white
 * fluted pilasters and the corner door no. 27 on the Spiegelgracht.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). 3DBAG puts the eaves of the north part of the
 * Spiegelgracht front (ring edge 1, 1.1 m proud of the rest) at 6.9 m by running the roof plane on down; every photo shows
 * the cornice level all round (8.45 m, the 3DBAG eaves of the other fronts), so the shell is lifted to it (roof mass from
 * the front photo, not the 3DBAG plane).
 *
 * Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0), heights above the 3DBAG ground (0.76 m NAP):
 *  - south front (ring edge 4, w01-191, 7.7 m, t from the acute west corner): TMX7316010203-002952_pano_0003_000196
 *    (2023, sunlit, rectified at 50 px/m: windows, lettering, dormer, tints), recording_2025-07-14_05-25-22_00550 and _00548
 *    (2025, the drapes, the chef, the lettering close up), TMX7316010203-003002_pano_0007_000280 (2023, RESTAURANT, domes);
 *  - Spiegelgracht front south part (ring edge 3, w02-300, 7.2 m, t from the jog to the corner):
 *    TMX7316010203-000355_pano_0000_000220 (2017) and recording_2025-07-14_05-25-22_00429 / _00428 (2025, the stoop,
 *    the shopfront, door 27, the Heineken disc);
 *  - Spiegelgracht front north part (ring edge 1, w03-300, 5.8 m, t from the north party wall):
 *    TMX7316010203-001974_pano_0000_001138 (2021) and recording_2025-07-14_05-25-22_00431 (2025, the basement print shop).
 * Per item in hans-en-grietje-spiegelgracht-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

/** Eaves (3DBAG, edges 3 and 4) and the white cornice over it. */
const EAVE = 8.45, CORN0 = 8.2, CORN1 = 8.7;
const AWN: [string, string] = ['red', 'concrete'];

const edge = (i: number) => ringFrame(src.facadeRing, i);

/** The shell with every eaves point below EAVE lifted to it (ring edge 1's 6.9 m eaves; see the header). */
function liftedShell(): Src {
  const lift = (p: number[]) => (p[1] > 0.5 && p[1] < EAVE ? [p[0], EAVE, p[2]] : p);
  return {...src, surfaces: src.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(lift))}))};
}

export function buildHansEnGrietjeSpiegelgracht(_w: number, _d: number, b: BuildingTools) {
  addShell(b, liftedShell() as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);
  south(b);
  spiegelSouth(b);
  spiegelNorth(b);
  setSink(sink0);
}

/** Window: white frame, glass, dark glazing bars (cols x rows panes), white sill; fronts 8 cm apart. */
function win(b: BuildingTools, f: Frame, c: number, y0: number, y1: number, w: number, cols: number, rows: number, box = false) {
  const h = y1 - y0;
  slab(b, f, c, y0 - 0.05, w + 0.16, h + 0.12, 0.06, 'white');
  slab(b, f, c, y0, w, h, 0.14, 'glass');
  for (let k = 1; k < cols; k++) ledgeStrip(b, f, c - w / 2 + (w * k) / cols, y0, 0.04, h, 0.22, 'dark');
  for (let k = 1; k < rows; k++) slab(b, f, c, y0 + (h * k) / rows, w, 0.04, 0.22, 'dark');
  slab(b, f, c, y0 - 0.14, w + 0.3, 0.1, 0.3, 'white');
  if (box) {
    // the flower boxes on the sill (2025 views): dark trough, red and white flowers as a strip
    slab(b, f, c, y0 - 0.04, w - 0.05, 0.2, 0.46, 'dark');
    slab(b, f, c, y0 + 0.16, w - 0.15, 0.1, 0.36, 'red', 0.04);
  }
}

/** Quarter-round markies (kit dome profile) over a first-storey window. */
function dome(b: BuildingTools, f: Frame, c: number, w: number, yHead: number) {
  stripedAwningOn(b, f, {head: [[c - w / 2, 0.3], [c + w / 2, 0.3]], yHead, drop: 0.7, proj: 0.6, stripe: 0.16, valance: 0.08, scallop: 0.04, cheeks: true, dome: 5, colours: AWN});
}

/** Straight valance with tied-back drapes down both sides (2025: the cafe's ground windows). */
function valance(b: BuildingTools, f: Frame, c: number, w: number, yHead: number, dropTo: number) {
  stripedAwningOn(b, f, {head: [[c - w / 2, 0.3], [c + w / 2, 0.3]], yHead, drop: 0.12, proj: 0.2, stripe: 0.14, valance: 0.22, scallop: 0.05, cheeks: true, colours: AWN});
  // the drapes hang clear of the glazing bars, unsunk (their backs 8 cm in front of the bars)
  const sink = getSink();
  setSink(0);
  for (const side of [-1, 1]) {
    const t0 = c + side * (w / 2 - 0.15);
    // three bunched stripes per drape, standing clear of the glazing bars
    for (const [k, col] of [[-1, 'red'], [0, 'concrete'], [1, 'red']] as const) slab(b, f, t0 + k * 0.09, dropTo, 0.09, yHead - 0.2 - dropTo, 0.08, col, 0.3);
  }
  setSink(sink, true);
}

/** White box dormer with a pediment, its front `back` metres behind the wall plane. */
function dormer(b: BuildingTools, f: Frame, c: number, w: number, top: number, back: number, hoist = false) {
  const front = -back, deep = 2.2;
  slab(b, f, c, EAVE - 0.3, w, top - EAVE + 0.3, deep, 'concrete', front - deep);
  // pediment over the front, carried back as the dormer's little gable roof
  poly(b, f, c, top, [[-w / 2 - 0.08, 0], [w / 2 + 0.08, 0], [0, 0.42]], deep + 0.08, 'concrete', front - deep);
  // the window: two lights, glass in front, bars on top, 8 cm apart
  const wy = EAVE + 0.55, wh = top - wy - 0.3;
  slab(b, f, c, wy, w - 0.5, wh, 0.08, 'glass', front);
  ledgeStrip(b, f, c, wy, 0.06, wh, 0.16, 'white', front);
  slab(b, f, c, wy + wh * 0.55, w - 0.5, 0.05, 0.16, 'white', front);
  if (hoist) {
    // the hoist beam and its stays over the pediment (TMX7316010203-002952: a thin dark triangle above the dormer)
    slab(b, f, c, top + 0.4, 0.06, 0.06, 0.7, 'bronze', front);
    bar(b, f, c - 0.45, top + 0.05, c, top + 0.75, front + 0.4, 'bronze');
    bar(b, f, c + 0.45, top + 0.05, c, top + 0.75, front + 0.4, 'bronze');
  }
}

/** Thin bar from (t0, y0) to (t1, y1) in the wall plane at `out`. */
function bar(b: BuildingTools, f: Frame, t0: number, y0: number, t1: number, y1: number, out: number, colour: string, r = 0.03) {
  const L = Math.hypot(t1 - t0, y1 - y0);
  const g = new T.BoxGeometry(L, r, r).rotateZ(Math.atan2(y1 - y0, t1 - t0));
  put(b, f, g, (t0 + t1) / 2, (y0 + y1) / 2, out + r / 2, colour);
}

/** White cornice: fascia and corona. */
function cornice(b: BuildingTools, f: Frame, t0: number, t1: number) {
  slab(b, f, (t0 + t1) / 2, CORN0, t1 - t0, 0.3, 0.16, 'concrete');
  slab(b, f, (t0 + t1) / 2, CORN0 + 0.3, t1 - t0 + 0.2, CORN1 - CORN0 - 0.3, 0.36, 'concrete');
}

/** South front (edge 4): three ground windows, two first-storey windows, the lettering, RESTAURANT, the chef, the dormer. */
function south(b: BuildingTools) {
  const {f, len} = edge(4);
  for (const c of [1.12, 3.22, 5.37]) {
    win(b, f, c, 1.8, 4.2, 1.45, 3, 5, true);
    valance(b, f, c, 1.62, 4.45, 2.9);
  }
  for (const c of [1.35, 5.5]) {
    win(b, f, c, 5.9, 7.6, 1.3, 2, 3);
    dome(b, f, c, 1.5, 7.75);
  }
  // CAFE HANS en GRIETJE, cream capitals 0.31 m (5x7 glyphs at 4.5 cm), 4 cm proud
  letters(b, f, 'CAFE HANS en GRIETJE', 3.37, 4.78, 0, 0.045, 0.06, 'gold');
  cornice(b, f, 0, len);
  // RESTAURANT on its rail above the cornice by the corner, two stays back to the roof
  slab(b, f, 1.85, CORN1 + 0.02, 3.4, 0.05, 0.05, 'bronze', 0.2);
  for (const t of [0.4, 3.3]) slab(b, f, t, CORN1, 0.04, 0.5, 0.04, 'bronze', 0.12);
  letters(b, f, 'RESTAURANT', 1.85, CORN1 + 0.08, 0.26, 0.055, 0.05, 'gold');
  dormer(b, f, 5.6, 1.8, 10.75, 0.15, true);
  chef(b, f);
}

/** The cut-out chef with his black menu board at the corner end of the south front, the menu case under it (2025). */
function chef(b: BuildingTools, f: Frame) {
  slab(b, f, 0.45, 1.15, 0.7, 1.15, 0.06, 'concrete', 0.02);
  slab(b, f, 0.45, 1.25, 0.56, 0.95, 0.06, 'frame', 0.1);
  // brackets
  for (const y of [2.8, 3.8]) slab(b, f, 0.45, y, 0.06, 0.06, 0.25, 'dark');
  // body (white jacket), red-brown apron and neckerchief, head, toque
  slab(b, f, 0.42, 2.45, 0.62, 1.5, 0.03, 'concrete', 0.25);
  slab(b, f, 0.42, 2.45, 0.5, 0.75, 0.03, 'red', 0.33);
  slab(b, f, 0.42, 3.82, 0.32, 0.1, 0.03, 'red', 0.33);
  disc(b, f, 0.42, 4.12, 0.17, 0.03, 'pink', 0.25);
  slab(b, f, 0.42, 4.25, 0.36, 0.28, 0.03, 'concrete', 0.33);
  // the black board he holds, four lines of pale lettering as bars
  slab(b, f, 0.72, 2.5, 0.5, 1.2, 0.03, 'dark', 0.41);
  for (let k = 0; k < 4; k++) slab(b, f, 0.72, 2.68 + k * 0.26, 0.34, 0.05, 0.02, 'concrete', 0.49);
}

/** Spiegelgracht front, south part (edge 3): the stoop door, menu case, shopfront, door 27, Heineken disc, first storey. */
function spiegelSouth(b: BuildingTools) {
  const {f, len} = edge(3);
  // stoop: stone landing and steps down towards the corner, iron railing
  const LAND = 0.85;
  slab(b, f, 1.15, 0, 1.9, LAND, 1.3, 'stone');
  for (let k = 0; k < 4; k++) slab(b, f, 2.25 + k * 0.3, 0, 0.3, LAND - (k + 1) * 0.17, 1.15, 'stone');
  bar(b, f, 0.25, LAND + 0.9, 2.1, LAND + 0.9, 1.22, 'dark');
  bar(b, f, 2.1, LAND + 0.9, 3.4, 0.95, 1.08, 'dark');
  for (const [t, y] of [[0.25, LAND], [2.1, LAND], [3.4, 0.1]] as const) slab(b, f, t, y, 0.04, 0.9, 0.04, 'dark', 1.1);
  // stoop door: white frame, inset dark green panelled leaf, fanlight
  doorway(b, f, 1.2, LAND, 0.95, 2.3);
  slab(b, f, 1.2, LAND + 2.4, 0.95, 0.12, 0.14, 'glass', 0.02);
  stripedAwningOn(b, f, {head: [[0.4, 0.3], [2.0, 0.3]], yHead: 3.75, drop: 0.45, proj: 0.75, stripe: 0.16, valance: 0.14, scallop: 0.05, cheeks: true, colours: AWN});
  // menu case
  slab(b, f, 2.2, 1.6, 0.55, 0.85, 0.12, 'dark');
  slab(b, f, 2.2, 1.68, 0.43, 0.65, 0.2, 'frame');
  // shopfront: fluted white pilasters, two windows of 4x5 panes, entablature, flower boxes
  for (const t of [2.71, 4.47, 6.3]) pilaster(b, f, t, 0.24, 0.3, 4.0);
  for (const [c, w] of [[3.59, 1.52], [5.385, 1.59]] as const) win(b, f, c, 1.15, 4.0, w, 4, 5, true);
  slab(b, f, 4.5, 4.0, 3.95, 0.45, 0.24, 'concrete');
  slab(b, f, 4.5, 4.45, 4.1, 0.16, 0.34, 'concrete');
  valance(b, f, 4.5, 3.6, 4.0, 2.6);
  // door 27 at the corner: white fluted surround, inset leaf glazed 3x4 above a panel, grilled transom, two steps
  pilaster(b, f, 7.0, 0.2, 0.3, 4.0);
  doorway(b, f, 6.66, 0.34, 0.44, 2.3, 0);
  slab(b, f, 6.68, 1.45, 0.36, 1.0, 0.14, 'glass', -0.06);
  for (const k of [1, 2]) ledgeStrip(b, f, 6.68 - 0.18 + 0.12 * k, 1.45, 0.03, 1.0, 0.22, 'dark', -0.06);
  for (const k of [1, 2, 3]) slab(b, f, 6.68, 1.45 + 0.25 * k, 0.36, 0.03, 0.22, 'dark', -0.06);
  slab(b, f, 6.66, 2.76, 0.44, 0.74, 0.14, 'dark', -0.1);
  for (let k = 0; k < 6; k++) ledgeStrip(b, f, 6.46 + k * 0.08, 2.84, 0.025, 0.6, 0.22, 'dark', -0.1);
  for (const k of [0, 1]) slab(b, f, 6.68, 0, 0.75, 0.17 * (2 - k), 0.25 + 0.25 * (1 - k), 'stone');
  // Heineken disc on its bracket just past the corner
  slab(b, f, len + 0.12, 3.68, 0.5, 0.05, 0.05, 'dark', 0.22);
  disc(b, f, len + 0.4, 3.4, 0.33, 0.05, 'green', 0.2);
  ringSlab(b, f, len + 0.4, 3.4, 0.25, 0.31, 0.04, 'concrete', 0.29);
  // first storey: narrow and wide sashes with their markiezen
  win(b, f, 2.16, 5.65, 7.5, 0.8, 2, 3);
  dome(b, f, 2.16, 1.0, 7.65);
  win(b, f, 5.27, 5.65, 7.5, 1.34, 3, 4);
  dome(b, f, 5.27, 1.55, 7.65);
  cornice(b, f, -0.1, len);
  dormer(b, f, 3.2, 1.8, 10.6, 0.15);
}

/**
 * A door set in its reveal: the painted leaf 4 cm proud of the brick, a white surround (jambs and head) standing 14 cm
 * proud round it, so the leaf reads 10 cm inset (2025 close views: the stoop door, door 27, the basement door).
 */
function doorway(b: BuildingTools, f: Frame, c: number, y0: number, w: number, h: number, jamb = 0.11) {
  slab(b, f, c, y0, w, h, 0.14, 'dark', -0.1);
  // jamb 0 = the pilasters either side are the surround (door 27)
  if (jamb > 0) for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 + jamb / 2), y0, jamb, h + 0.12, 0.14, 'concrete');
  slab(b, f, c, y0 + h, w + 2 * jamb, 0.12, 0.14, 'concrete');
}

/** A white fluted pilaster: shaft with three flute ribs, capital block. */
function pilaster(b: BuildingTools, f: Frame, c: number, w: number, d: number, top: number) {
  slab(b, f, c, 0.3, w, top - 0.3, d, 'concrete');
  for (const s of [-0.07, 0, 0.07]) ledgeStrip(b, f, c + s, 0.9, 0.025, top - 1.3, 0.04, 'concrete', d);
  slab(b, f, c, top - 0.25, w + 0.08, 0.25, d + 0.08, 'concrete');
  slab(b, f, c, 0, w + 0.06, 0.3, d + 0.06, 'stone');
}

/** Spiegelgracht front, north part (edge 1): the basement print shop, raised ground storey, first storey, dormer. */
function spiegelNorth(b: BuildingTools) {
  const {f, len} = edge(1);
  // basement shop: openings with white frames, the white fascia box, green-and-white striped awning
  for (const [c, w, y0] of [[1.3, 2.0, 0.25], [4.0, 0.7, 0.6], [5.0, 0.7, 0.6]] as const) win(b, f, c, y0, 2.4, w, c === 1.3 ? 5 : 2, c === 1.3 ? 4 : 3);
  doorway(b, f, 2.95, 0, 0.66, 2.4);
  slab(b, f, len / 2 - 0.05, 2.55, len - 0.2, 0.5, 0.42, 'concrete');
  stripedAwningOn(b, f, {head: [[0.15, 0.42], [len - 0.25, 0.42]], yHead: 3.35, drop: 0.28, proj: 0.55, stripe: 0.18, valance: 0.14, cheeks: true, colours: ['green', 'concrete']});
  for (const c of [2.15, 4.51]) {
    win(b, f, c, 3.5, 5.0, 1.45, 2, 3);
    valance(b, f, c, 1.62, 5.2, 3.9);
    win(b, f, c, 6.0, 7.9, 1.45, 2, 3);
    dome(b, f, c, 1.6, 8.05);
  }
  cornice(b, f, 0, len + 0.1);
  dormer(b, f, 3.5, 1.7, 10.4, 0.15);
  // the jog (edge 2) carries the cornice round
  const j = edge(2);
  cornice(b, j.f, 0, j.len);
}
