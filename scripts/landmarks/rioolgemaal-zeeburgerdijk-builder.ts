import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, letters, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './rioolgemaal-zeeburgerdijk-footprints.json';

/**
 * FORMER HOOFDRIOLERINGSGEMAAL, Zeeburgerdijk 50-52, Indische Buurt (BAG pand 0363100012108874, BAG 1911; gemeentelijk
 * monument 200647). Register: the main sewage pumping station and the house with offices beside it, 1912, by an unnamed
 * architect of the Dienst der Publieke Werken; the pump hall is one tall storey under a saddle roof parallel to the street,
 * the house two storeys under a flattened hipped roof, joined by a one-storey link with a flat roof. Today the hall is the
 * bar-restaurant Pompstation.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (hall eaves 8.9 m, ridge 13.7-14.0 m; link 4.3-4.7 m; house eaves 8.05 m,
 * hipped to 11.6 m with the west risalit gable to 10.9 m). Fronts read from rectified Gemeente Amsterdam panoramas (CC BY
 * 4.0), t in metres along each facade-ring edge from the viewer's left (ringFrame), y up from the 3DBAG ground:
 *  - Zeeburgerdijk (edge 1, w01-359): TMX7316010203-002535_pano_0000_000075 (2022) and recording_2024-10-16_12-04-41_00547
 *    (2024, overcast, the sharpest), rectified at 50 px/m both ways, ground at y 620 px (the hall eaves at 172 px give the
 *    3DBAG 8.93 m). The hall is t 0-23.4 (seven bays at a 3.2 m pitch), the link 23.4-31.4, the house 31.4-40.1;
 *  - the hall's east gable (edge 0, w04-90, 2025): its geometric window and stone band over the kiosk in front;
 *  - the house's west front (edge 2, w03-270, 2023, 50 px/m): two window pairs either side of the gabled risalit;
 *  - the hall's south side (edge 11, w02-180 2025) shows the heads of the same geometric windows over the hedge: the
 *    seven bays are drawn as on the street (inferred below the hedge line).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;
type Wall = {f: Frame; len: number};
const wall = (i: number): Wall => ringFrame(ring, i);

/** Hall bay centres along the street front (w01-359: 122 ... 1077 px at 50 px/m) and the pilasters between and at the ends. */
const BAYS = [2.44, 5.6, 8.8, 12.0, 15.16, 18.36, 21.54];
const PILASTERS = [0.75, 4.0, 7.2, 10.4, 13.58, 16.76, 19.95, 23.15];
const HALL_EAVES = 8.93, PLINTH = 0.7;

export function buildRioolgemaalZeeburgerdijk(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: 'brick', roof: 'slate', roofFor: s => (isFlat(s) ? 'dark' : 'slate')});
  const sink0 = getSink();
  setSink(0.12, true);
  const north = wall(1);
  // the plinth stops at the link's doors; the house's is lower (its windows start at 0.45 m)
  for (const [a, c] of [[0.1, 24.5], [27.4, 29.4], [30.5, 31.4]]) plinth(north, a, c);
  slab(B, north.f, 35.75, 0, 8.6, 0.32, 0.06, 'greyBrick');
  hallFront(north, BAYS, PILASTERS);
  linkFront(north);
  houseFront(north);
  // the south side of the hall (edge 11, t from its west end): the same bays, mirrored about the hall's x
  const south = wall(11);
  const xOff = 22.6 + (-0.3); // north t -> x = 22.6 - t; south t -> x = -0.3 + t
  const mirror = (t: number) => xOff - t;
  plinth(south, 0.1, south.len - 0.1);
  hallFront(south, BAYS.map(mirror).filter(t => t > 0.8 && t < south.len - 0.8).sort((a, c) => a - c), PILASTERS.map(mirror).filter(t => t > 0.2 && t < south.len - 0.2).sort((a, c) => a - c));
  eastGable(wall(0));
  houseWest(wall(2));
  houseSouth(wall(3));
  setSink(sink0);
}

function isFlat(s: Surface) {
  const ys = s.rings[0].map(p => p[1]);
  return Math.max(...ys) - Math.min(...ys) < 0.6;
}

// ---- kit -------------------------------------------------------------------------------------------------------------

/** Glazing bar: a box 4 cm deep standing on the pane's front face (`out`), so it joins the pane's assembly. */
function bar(f: Frame, t: number, y: number, w: number, h: number, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(B, f, t, y, w, h, 0.04, 'frame', out);
  setSink(s0, true);
}
/** A white timber window: frame, glass and a pane grid (cols x rows, optional transom row near the top). */
function win(w: Wall, t: number, y0: number, y1: number, width: number, o: {cols?: number; rows?: number; transom?: number; weights?: number[]; out?: number} = {}) {
  const out = o.out ?? 0, h = y1 - y0, cols = o.cols ?? 2, rows = o.rows ?? 2;
  slab(B, w.f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.08, 'frame', out);
  slab(B, w.f, t, y0 + 0.05, width - 0.1, h - 0.1, 0.04, 'glass', out + 0.08);
  const grid = paneGrid({width: width - 0.1, height: h - 0.1, cols, rows, bar: 0.05, frame: 0, ...(o.transom ? {transomRows: [o.transom], transom: 0.08} : {}), ...(o.weights ? {rowWeights: o.weights} : {})});
  for (const m of grid) bar(w.f, t + m.x, y0 + 0.05 + m.y, m.w, m.h, out + 0.12);
}
/** A rotated bar (glazing diagonal) from (t0, y0) to (t1, y1) in front of the pane. */
function diag(f: Frame, t0: number, y0: number, t1: number, y1: number, out: number) {
  const L = Math.hypot(t1 - t0, y1 - y0);
  const g = new T.BoxGeometry(L, 0.05, 0.04).rotateZ(Math.atan2(y1 - y0, t1 - t0)).translate(0, 0, out + 0.02);
  put(B, f, g, (t0 + t1) / 2, (y0 + y1) / 2, 0, 'frame');
}
/**
 * The hall's upper window (w01-359, w04-90): a square-ish light in a white frame whose glazing bars draw a diamond inside a
 * three-by-three grid, the diamond's points on the middle of each side (the "geometric" glazing of the Publieke Werken hall).
 */
function geometricWindow(w: Wall, t: number, y0: number, width: number, h: number, out = 0) {
  slab(B, w.f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.08, 'frame', out);
  slab(B, w.f, t, y0 + 0.05, width - 0.1, h - 0.1, 0.04, 'glass', out + 0.08);
  const o = out + 0.12, W = width - 0.1, H = h - 0.1, yb = y0 + 0.05;
  for (const k of [1, 2]) {
    bar(w.f, t - W / 2 + W * k / 3, yb, 0.05, H, o);
    bar(w.f, t, yb + H * k / 3 - 0.025, W, 0.05, o);
  }
  const cx = t, cy = yb + H / 2, rx = W / 2 - 0.12, ry = H / 2 - 0.12;
  diag(w.f, cx - rx, cy, cx, cy + ry, o); diag(w.f, cx, cy + ry, cx + rx, cy, o);
  diag(w.f, cx + rx, cy, cx, cy - ry, o); diag(w.f, cx, cy - ry, cx - rx, cy, o);
}
/** The dark glazed-brick plinth (w01-359: 585-620 px, 0.7 m). */
function plinth(w: Wall, t0: number, t1: number) {
  slab(B, w.f, (t0 + t1) / 2, 0, t1 - t0, PLINTH, 0.06, 'greyBrick');
}

// ---- fronts ----------------------------------------------------------------------------------------------------------

/**
 * One hall front: brick pilasters 0.45 m wide between the bays, capped by stone blocks under the eaves; per bay the lower
 * window of three tall lights between brick mullions (1.96-4.96 m) on a stone sill, the stone lintel with its two ears, and
 * over it the geometric window (5.5-7.3 m); a brick corbel course under the eaves.
 */
function hallFront(w: Wall, bays: number[], pilasters: number[]) {
  for (const t of pilasters) {
    slab(B, w.f, t, PLINTH, 0.45, 7.6 - PLINTH, 0.12, 'brick');
    slab(B, w.f, t, 7.55, 0.55, 0.5, 0.2, 'stone');
  }
  for (const t of bays) {
    // lower: three lights 0.43 m wide between brick mullions 0.2 m, each with a transom 0.5 m under its head
    for (const dt of [-0.63, 0, 0.63]) win(w, t + dt, 1.96, 4.96, 0.43, {cols: 1, rows: 2, transom: 1, weights: [5, 1]});
    slab(B, w.f, t, 1.82, 1.95, 0.14, 0.14, 'stone');
    // lintel band with ears (w01-359: 345-370 px, 2.4 m wide, the ears 0.3 m down at both ends)
    slab(B, w.f, t, 4.98, 2.4, 0.5, 0.1, 'stone');
    for (const s of [-1, 1]) slab(B, w.f, t + s * 1.05, 4.62, 0.3, 0.36, 0.1, 'stone');
    geometricWindow(w, t, 5.5, 1.66, 1.8);
    slab(B, w.f, t, 5.4, 1.9, 0.1, 0.12, 'stone');
  }
  const t0 = Math.min(...pilasters) - 0.3, t1 = Math.max(...pilasters) + 0.3;
  slab(B, w.f, (t0 + t1) / 2, HALL_EAVES - 0.45, t1 - t0, 0.25, 0.16, 'red');
  slab(B, w.f, (t0 + t1) / 2, HALL_EAVES - 0.2, t1 - t0 + 0.2, 0.2, 0.32, 'red');
}

/** The one-storey link (t 23.4-31.4): the Pompstation entrance under its green sign, a small window and the house door. */
function linkFront(w: Wall) {
  // stone fascia band at 3.3 m with blocks on the pilasters (w01-359: 455-475 px)
  slab(B, w.f, 27.4, 3.25, 8.0, 0.2, 0.12, 'stone');
  for (const t of [23.7, 27.7, 29.2, 30.8]) slab(B, w.f, t, 3.1, 0.4, 0.45, 0.16, 'stone');
  // double timber doors (1230-1300 px) and the glazed side door (1330-1365 px), a glazed transom over both
  slab(B, w.f, 25.3, 0.1, 1.4, 2.3, 0.08, 'red');
  bar(w.f, 25.3, 0.1, 0.05, 2.3, 0.08);
  win(w, 26.95, 0.1, 2.4, 0.7, {cols: 1, rows: 2});
  win(w, 26.0, 2.45, 2.85, 3.0, {cols: 4, rows: 1});
  // the sign (1195-1375 px, 405-470 px): dark green board with white letters
  slab(B, w.f, 25.7, 3.0, 3.6, 1.3, 0.1, 'green', 0.12);
  letters(B, w.f, 'POMPSTATION', 25.7, 3.25, 0.22, 0.05, 0.04, 'frame', 0.07);
  letters(B, w.f, 'BAR RESTAURANT TERRAS', 25.7, 3.85, 0.22, 0.022, 0.03, 'frame', 0.03);
  // the small four-light window (1405-1450 px) and the black house door with its transom (1475-1520 px)
  win(w, 28.55, 2.0, 2.95, 0.9, {cols: 2, rows: 2});
  slab(B, w.f, 29.95, 0.1, 0.9, 2.3, 0.08, 'dark');
  win(w, 29.95, 2.45, 2.95, 0.9, {cols: 2, rows: 1});
}

/** The house's street front (t 31.4-40.1): two pairs of tall windows on both storeys, sills, the white eaves cornice. */
function houseFront(w: Wall) {
  const pairs = [[32.1, 33.6], [36.75, 38.1]];
  for (const pr of pairs) for (const t of pr) {
    win(w, t, 0.45, 3.0, 1.0, {cols: 2, rows: 2, transom: 1});
    win(w, t, 4.1, 6.6, 1.0, {cols: 2, rows: 2, transom: 1});
    slab(B, w.f, t, 0.35, 1.15, 0.1, 0.12, 'stone');
    slab(B, w.f, t, 4.0, 1.15, 0.1, 0.12, 'stone');
  }
  // stone corbel blocks at the pair ends over the ground floor (1565, 1715, 1800, 1945 px)
  for (const t of [31.3, 34.3, 36.0, 38.9]) slab(B, w.f, t, 3.15, 0.35, 0.4, 0.14, 'stone');
  slab(B, w.f, 35.75, 7.0, 8.6, 0.5, 0.35, 'concrete');
  slab(B, w.f, 35.75, 6.85, 8.5, 0.15, 0.18, 'concrete');
  // the white dormer on the hipped roof (1690-1760 px), its front 0.9 m behind the wall
  slab(B, w.f, 34.5, 8.5, 1.5, 1.4, 2.2, 'concrete', -3.0);
  slab(B, w.f, 34.5, 9.85, 1.8, 0.12, 2.4, 'concrete', -3.1);
  win(w, 34.5, 8.7, 9.7, 0.9, {cols: 2, rows: 1, out: -0.8});
}

/** The hall's east gable (edge 0, w04-90): the geometric window high in the gable over a stone band, corner blocks. */
function eastGable(w: Wall) {
  geometricWindow(w, w.len / 2, 6.0, 1.66, 1.6);
  slab(B, w.f, w.len / 2, 5.88, 1.9, 0.1, 0.12, 'stone');
  slab(B, w.f, w.len / 2, 5.3, w.len - 0.2, 0.2, 0.1, 'stone');
  for (const t of [0.35, w.len - 0.35]) slab(B, w.f, t, HALL_EAVES - 0.4, 0.6, 0.5, 0.25, 'stone');
}

/** The house's west front (edge 2, w03-270, viewer's left = north): two pairs either side of the gabled risalit. */
function houseWest(w: Wall) {
  for (const t of [1.65, 3.05, 7.8, 9.25]) {
    win(w, t, 4.1, 6.6, 0.95, {cols: 2, rows: 2, transom: 1});
    win(w, t, 0.45, 3.0, 0.95, {cols: 2, rows: 2, transom: 1});
  }
  win(w, 5.45, 4.6, 6.6, 0.7, {cols: 2, rows: 2});
  win(w, 5.45, 0.45, 3.0, 0.7, {cols: 2, rows: 2});
  win(w, 5.45, 8.4, 9.5, 0.65, {cols: 2, rows: 2});
  for (const [a, c] of [[0.2, 3.9], [7.0, 10.9]]) slab(B, w.f, (a + c) / 2, 7.55, c - a, 0.5, 0.35, 'concrete');
}

/** The house's south side (edge 3, w05-180 2025: the upper pair over the garden wall; the ground floor hidden). */
function houseSouth(w: Wall) {
  for (const t of [3.2, 5.3]) win(w, t, 4.1, 6.6, 1.0, {cols: 2, rows: 2, transom: 1});
  slab(B, w.f, w.len / 2, 7.55, w.len - 0.3, 0.5, 0.35, 'concrete');
}
