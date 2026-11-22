import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, poly, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {archFillOutline} from './street-front-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import {sillConsoleOutline} from '../../src/canalRecall/landmarks/sillConsole';
import {barRailing} from '../../src/canalRecall/landmarks/barRailing';
import source from './hotel-notting-hill-footprints.json';

/**
 * HOTEL NOTTING HILL, Westeinde 26 (BAG pand 0363100012178268, BAG 1977; wikidata Q111410221). Built in 1977 as a bank
 * on the corner plot of A.L. van Gendt's row Westeinde 2-26 (c. 1870, gemeentelijk monument 200110). Register: "Bankgebouw
 * nr. 26 ... is een geheel nieuw opgetrokken gebouw met een betonconstructie, wel is de gevel aangepast aan de
 * architectuur van de aangrenzende panden": a concrete frame dressed as a neo-classical brick block. Now Hotel Notting
 * Hill; the ground storey of the Westeinde front is the hotel lounge.
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0), rectified at 50 px/m by landmark-brief.ts, per item in
 * hotel-notting-hill-inventory.json:
 *  - south front (ring edge 5, w03-165): TMX7316010203-002545_pano_0000_000344 (2022, square and sunlit; every height
 *    below is measured on it above the pavement) and recording_2025-07-14_07-34-51_01042 (2025);
 *  - Westeinde front (ring edge 8, w01-75 and w05-76): recording_2025-07-14_07-34-51_01035 (2025), the 2018 view
 *    TMX7316010203-001048_pano_0000_000730, TMX7316060226-000020_pano_0000_000365 (2016) and the 2022 leaf-off view;
 *  - the entrance bay in the corner (ring edge 6, w07-75): recording_2025-07-14_07-34-51_01037 (2025);
 *  - the low annexe (ring edge 3, w06-164): TMX7316010203-002975_pano_0007_000115 (2023).
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts) lowered by 1.3 m. 3DBAG puts the mansard's
 * foot at 17.1 m over its ground (0.19 m NAP); the square 2022 view puts the top of the cornice 15.8 m over the
 * pavement, with the basement lights 0.7 m over it, so the pavement stands about 1.3 m over the 3DBAG ground and the
 * whole shell is set down by that much (the photo, not the 3DBAG datum). The fisheye panoramas make the corner look
 * curved; the rectified crops and the BAG ring show square corners with stone quoins.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const edge = (i: number) => ringFrame(src.facadeRing, i);

/** Pavement over the 3DBAG ground (see above). */
const DROP = 1.3;
/** Storeys above the pavement, measured on w03-165 (2022): [sill, springing of the segmental head]. */
const G: [number, number] = [2.24, 4.52];
const F1: [number, number] = [6.56, 9.1];
const F2: [number, number] = [10.8, 12.52];
const BASEMENT: [number, number] = [0.62, 1.12];
const PLINTH = 1.4, BAND0 = 5.6, BAND1 = 5.8;
const CORNICE0 = 13.7, EAVES = 15.75;
const WIN = 1.32, RISE = 0.12;
/**
 * Layer depths (m out of the facade-ring line; the 3DBAG wall stands 0-0.07 m behind it): every layer that overlaps
 * another in elevation sits at least 3 cm in front of or behind it, so no two faces fight. Skins: plinth 0.14, grey
 * brick and cladding 0.1, pilasters 0.2, string course 0.25; window parts relative to the face they stand on.
 */
const D = {frame: 0.06, glass: 0.1, bar: 0.14, jamb: 0.18, arch: 0.06, key: 0.13, sill: 0.2, console: 0.12};
const SKIN = 0.1, PLINTH_D = 0.14;
/** Transom heights: the lower two storeys have a fanlight, the second storey none. */
const TRANSOM: Record<string, number | undefined> = {G: 3.95, F1: 8.5};

function lowered(): Src {
  const lift = (p: number[]) => (p[1] > 0.5 ? [p[0], p[1] - DROP, p[2]] : p);
  return {...src, surfaces: src.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(lift))}))};
}
/** Steep roof facets are the slate mansard, the flat ones bitumen (palette `concrete`, tagged bitumen). */
function roofColour(s: Surface): string {
  const r = s.rings[0];
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length];
    nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
  }
  return Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1) > 0.97 ? 'concrete' : 'slate';
}

export function buildHotelNottingHill(_w: number, _d: number, b: BuildingTools) {
  addShell(b, lowered() as never, {wall: 'brick', roof: 'slate', roofFor: s => roofColour(s)});
  const sink0 = getSink();
  setSink(0.12, true);
  southFront(b);
  westeindeFront(b);
  entranceBay(b);
  southReturn(b);
  annexe(b);
  setSink(sink0);
}

/** Glazing bar: no sink, shallower than wide. */
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number, colour = 'frame') {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, 0.03, colour, out);
  setSink(s0, true);
}

/**
 * A segment-headed window: brick reveal jambs, white frame and glass with its head following the segment, the mullion and
 * the fanlight transom, the rowlock brick arch over it with a stone keystone, and the stone sill on its scalloped console
 * (kit sillConsole). `y` = [sill, springing]; the head rises RISE over the springing.
 */
function win(b: BuildingTools, f: Frame, t: number, [y0, y1]: [number, number], o: {w?: number; transom?: number; reveal?: string; sill?: boolean; out?: number} = {}) {
  const w = o.w ?? WIN, out = o.out ?? 0.03, h = y1 - y0, reveal = o.reveal ?? 'brick';
  // reveal jambs proud of the frame: the frame and glass read set back behind them
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.08), y0, 0.12, h + RISE * 0.5, D.jamb, reveal, out);
  poly(b, f, t, y0, segHead(w + 0.04, h, RISE), D.frame, 'frame', out);
  poly(b, f, t, y0 + 0.06, segHead(w - 0.12, h - 0.06, RISE * 0.8), 0.02, 'glass', out + D.glass - 0.02);
  bar(b, f, t, y0 + 0.06, 0.07, h + RISE * 0.6, out + D.bar - 0.03);
  if (o.transom) bar(b, f, t, o.transom, w - 0.12, 0.07, out + D.bar - 0.03);
  // rowlock arch and keystone
  segBand(b, f, t, y1 + 0.24, w + 0.34, RISE + 0.02, 0.24, D.arch, 'red', out);
  slab(b, f, t, y1 + RISE - 0.04, 0.24, 0.34, D.key, 'stone', out);
  if (o.sill !== false) {
    slab(b, f, t, y0 - 0.1, w + 0.3, 0.1, D.sill, 'stone', out);
    poly(b, f, t, y0 - 0.1, sillConsoleOutline({width: w * 0.82, depth: 0.2}), D.console, 'stone', out);
  }
}

/** A segment-headed opening's outline in (t, y) about its bottom centre: jambs `h` high, the head rising `rise` over them. */
function segHead(w: number, h: number, rise: number): [number, number][] {
  return [[-w / 2, 0], [w / 2, 0], ...archFillOutline(w, rise, 6).map(([x, y]) => [x, y + h] as [number, number])];
}

/** Stone quoin pilaster from y0 to the frieze, its capital block breaking forward under the cornice. */
function pilaster(b: BuildingTools, f: Frame, t0: number, t1: number, y0 = 0, len = Infinity) {
  // a corner quoin runs past the corner by its own depth, so it wraps the corner instead of ending on the side wall's plane
  // (0.26 m: 8 cm clear of the corner bays' 0.18 m cladding)
  if (t0 <= 0) t0 = -0.26;
  if (t1 >= len - 1e-6) t1 = len + 0.26;
  // 5 cm wider each side than the 3DBAG pilaster bump it covers, so their side faces do not share planes
  t0 -= 0.05; t1 += 0.05;
  const c = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, c, y0, w, CORNICE0 - y0, 0.2, 'stone');
  slab(b, f, c, CORNICE0 - 0.25, w + 0.16, 0.85, 0.3, 'stone');
}

/** Frieze, bed moulding, corona and gutter cyma from CORNICE0 to EAVES; `ext` = [left, right]: > 0 runs a layer past that end round a convex corner, < 0 stops it short of a concave one. */
function cornice(b: BuildingTools, f: Frame, len: number, ext: [number, number] = [0, 0]) {
  // each layer runs past a convex corner by its own depth, so the two fronts' layers meet without overlapping
  const seg = (y: number, h: number, d: number) => {
    const a = ext[0] > 0 ? -d : ext[0] < 0 ? d : 0, c = len + (ext[1] > 0 ? d : ext[1] < 0 ? -d : 0);
    slab(b, f, (a + c) / 2, y, c - a, h, d, 'stone');
  };
  seg(CORNICE0 + 0.6, 0.25, 0.36);
  seg(CORNICE0 + 0.85, 0.75, 0.7);
  seg(CORNICE0 + 1.6, EAVES - CORNICE0 - 1.6, 0.6);
  slab(b, f, len / 2, CORNICE0, len, 0.6, 0.08, 'stone');
}

/**
 * A layer along a whole edge, `d` deep; `wrap` runs it past both ends by its own depth (the two main fronts, whose
 * corners are convex). The corner bays (edges 6, 7) use other depths, so an end face never shares a plane with a front.
 */
function run(b: BuildingTools, f: Frame, len: number, y: number, h: number, d: number, colour: string, wrap = false) {
  const e = wrap ? d : 0;
  slab(b, f, len / 2, y, len + 2 * e, h, d, colour);
}
/** Stone string course over the ground storey (0.25 m on the main fronts, 0.2 m on the corner bays). */
const band = (b: BuildingTools, f: Frame, len: number, wrap = true) => run(b, f, len, BAND0, BAND1 - BAND0, wrap ? 0.25 : 0.2, 'stone', wrap);
/** Skin depth on the corner bays (edges 6, 7): clear of the main fronts' skins and plinth that wrap their corners. */
const CORNER_SKIN = 0.18;

/** Black wall sconce. */
const sconce = (b: BuildingTools, f: Frame, t: number, y: number) => { slab(b, f, t, y, 0.12, 0.28, 0.18, 'bronze'); slab(b, f, t, y + 0.28, 0.16, 0.05, 0.22, 'bronze'); };
/** Square lantern on the ground storey: dark box with a light glass face. */
const lantern = (b: BuildingTools, f: Frame, t: number, y: number, out = 0) => { slab(b, f, t, y, 0.26, 0.42, 0.2, 'bronze', out); slab(b, f, t, y + 0.08, 0.18, 0.26, 0.04, 'white', out + 0.2); };

/**
 * First-storey French window in a moulded stone surround with a hood, and its wrought-iron balconette on a stone slab
 * (w03-165 2022 end bays; w01-75 axis 5): the window drops to 5.95 m, the rail stands 1.0 m on the slab.
 */
function balconyWindow(b: BuildingTools, f: Frame, t: number) {
  const w = WIN, y0 = 5.95, y1 = F1[1];
  win(b, f, t, [y0, y1], {transom: TRANSOM.F1, sill: false});
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.25), y0, 0.18, y1 - y0 + 0.4, 0.12, 'stone');
  slab(b, f, t, y1 + 0.32, w + 0.68, 0.2, 0.2, 'stone');
  slab(b, f, t, y1 + 0.52, w + 0.86, 0.14, 0.3, 'stone');
  // the balconette: stone slab, then the box-plan bar railing (kit barRailing)
  slab(b, f, t, y0 - 0.14, w + 0.5, 0.14, 0.46, 'stone');
  const half = w / 2 + 0.2;
  railing(b, f, t, y0, [[-half, 0.02], [-half, 0.4], [half, 0.4], [half, 0.02]], 0.95);
}

/** Open bar railing along a plan path in wall-local (t offset, out), standing on y. */
function railing(b: BuildingTools, f: Frame, t: number, y: number, path: [number, number][], height: number) {
  const m = barRailing(path, {height, barPitch: 0.14, barSize: 0.025, topRail: [0.05, 0.04]});
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(m.positions, 3));
  g.setIndex(m.indices);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  put(b, f, flat, t, y, 0, 'bronze');
}

/**
 * A white mansard dormer (palette `ochre`, painted white: the `white` name is an opening material in the audits): a box standing behind the cornice and running into the 3DBAG slope, its glazed front with a
 * mullion, under a segmental hood (w03-165: about 1.4 m wide, the front 1.0 m over the gutter).
 */
function dormer(b: BuildingTools, f: Frame, t: number, w = 1.4, h = 1.55) {
  const y = EAVES - 0.15, o = -0.45, depth = 2.2;
  slab(b, f, t, y, w, h, depth, 'ochre', o - depth);
  slab(b, f, t, y + 0.42, w - 0.36, h - 0.52, 0.05, 'glass', o);
  bar(b, f, t, y + 0.42, 0.06, h - 0.52, o + 0.09, 'white');
  poly(b, f, t, y + h, archFillOutline(w + 0.12, 0.26, 6), depth + 0.12, 'ochre', o - depth);
  slab(b, f, t, y + h - 0.02, w + 0.16, 0.1, depth + 0.12, 'ochre', o - depth);
}

/** Ground-storey lights over a grey-brick storey on a stone plinth (the south front and its basement lights). */
function basementLight(b: BuildingTools, f: Frame, t: number) {
  // on the plinth's face
  poly(b, f, t, BASEMENT[0], segHead(WIN + 0.04, BASEMENT[1] - BASEMENT[0], 0.08), D.frame, 'frame', PLINTH_D);
  slab(b, f, t, BASEMENT[0] + 0.05, WIN - 0.1, BASEMENT[1] - BASEMENT[0] - 0.05, 0.02, 'glass', PLINTH_D + D.glass - 0.02);
}

/**
 * South front (ring edge 5, 16.6 m, w03-165 2022). Quoins at both corners and two pilasters set off a 2.1 m end bay at
 * each end from four middle bays (ring bumps at t 0-0.53, 2.6-3.1, 13.5-14.0, 16.1-16.6). Light stone plinth with a
 * basement light under every axis; the ground storey in grey-mauve brick to the stone string course at 5.6-5.8 m; two
 * brick storeys; the cornice; one dormer per axis. The end bays' first-storey windows are French windows with stone
 * surrounds and balconettes.
 */
function southFront(b: BuildingTools) {
  const {f, len} = edge(5);
  const ends = [1.57, 15.05], mid = 8.3, middle = [mid - 4.17, mid - 1.49, mid + 1.49, mid + 4.17];
  const piers: [number, number][] = [[0, 0.53], [2.6, 3.11], [13.5, 14.0], [16.1, len]];
  run(b, f, len, 0, PLINTH, PLINTH_D, 'stone', true);
  run(b, f, len, PLINTH, BAND0 - PLINTH, SKIN, 'greyBrick', true);
  band(b, f, len);
  for (const [a, c] of piers) pilaster(b, f, a, c, PLINTH, len);
  for (const t of [...ends, ...middle]) {
    basementLight(b, f, t);
    win(b, f, t, G, {transom: TRANSOM.G, reveal: 'greyBrick', out: SKIN});
    win(b, f, t, F2);
    dormer(b, f, t);
  }
  for (const t of middle) win(b, f, t, F1, {transom: TRANSOM.F1});
  for (const t of ends) balconyWindow(b, f, t);
  for (let k = 0; k < 3; k++) {
    const t = (middle[k] + middle[k + 1]) / 2;
    sconce(b, f, t, 7.75);
    sconce(b, f, t, 11.5);
  }
  for (const t of [(middle[1] + middle[2]) / 2, (middle[2] + middle[3]) / 2]) lantern(b, f, t, 3.1);
  cornice(b, f, len, [0.62, 0.62]);
}

/**
 * One tall segment-headed opening in the stone-clad ground storey (w01-75 2025): dark frame, clear glass, a dark band at
 * 1.5-2.0 m and frosted green glass below it (the lounge); `door` keeps clear glass to the floor.
 */
function shopOpening(b: BuildingTools, f: Frame, t: number, w: number, door = false) {
  const y0 = 0.1, y1 = 4.75, rise = 0.15;
  poly(b, f, t, y0, segHead(w, y1 - y0, rise), D.frame, 'dark', SKIN);
  poly(b, f, t, 2.0, segHead(w - 0.16, y1 - 2.0, rise * 0.8), 0.02, 'glass', SKIN + D.glass - 0.02);
  slab(b, f, t, 0.18, w - 0.16, 1.32, 0.02, 'green', SKIN + D.glass - 0.02);
  if (door) {
    bar(b, f, t, 0.18, 0.1, 3.0, SKIN + D.bar - 0.03, 'dark');
    bar(b, f, t, 3.05, w - 0.16, 0.1, SKIN + D.bar - 0.03, 'dark');
  }
}

/**
 * Westeinde front (ring edge 8, 22 m: the 16.5 m main front w01-75 and the 5 m north bays w05-76). Quoins at both ends
 * and pilasters at t 8.0-8.5 and 16.0-16.5 (ring bumps); three window axes either side of the middle pilaster,
 * symmetric in each half, and two more in the north bays. The ground storey is grey stone cladding with a tall
 * segment-headed opening under every axis, the fifth the glazed door; the fifth axis carries the balconette and the
 * larger dormer.
 */
function westeindeFront(b: BuildingTools) {
  const {f, len} = edge(8);
  const axes = [1.68, 4.26, 6.84, 9.67, 12.25, 14.83, 17.6, 20.4];
  const piers: [number, number][] = [[0, 0.52], [8.0, 8.5], [16.0, 16.5], [21.5, len]];
  run(b, f, len, 0, BAND0, SKIN, 'sandstone', true);
  band(b, f, len);
  for (const [a, c] of piers) pilaster(b, f, a, c, 0, len);
  axes.forEach((t, k) => {
    shopOpening(b, f, t, k === 0 ? 1.6 : 1.85, k === 4);
    win(b, f, t, F2);
    if (k === 4) balconyWindow(b, f, t);
    else win(b, f, t, F1, {transom: TRANSOM.F1});
    if (k === 4) dormer(b, f, t, 1.8, 1.8);
    else dormer(b, f, t);
  });
  for (const t of [5.55, 10.96, 13.54, 19.0]) { sconce(b, f, t, 7.75); sconce(b, f, t, 11.5); }
  for (const t of [5.55, 10.96, 13.54]) lantern(b, f, t, 3.1);
  cornice(b, f, len, [0.62, 0.62]);
}

/**
 * The entrance bay in the south-east corner (ring edge 6, 4.1 m, set 3 m back from the Westeinde front; w07-75 2025):
 * one window per upper storey, the stone-clad ground storey with the glazed doors at the top of four granite steps, the
 * glass canopy on dark brackets, and the low dark stone block lettered HOTEL NOTTING HILL at the foot of the steps.
 */
function entranceBay(b: BuildingTools) {
  const {f, len} = edge(6);
  const t = len / 2;
  run(b, f, len, 0, BAND0, CORNER_SKIN, 'sandstone');
  band(b, f, len, false);
  win(b, f, t, F1, {transom: TRANSOM.F1});
  win(b, f, t, F2);
  sconce(b, f, t - 1.25, 7.75);
  sconce(b, f, t + 1.25, 7.75);
  // doors: a dark frame round two glazed leaves and side lights, from the top step (0.7 m) to 3.2 m
  slab(b, f, t, 0.7, 2.6, 2.6, D.frame, 'dark', CORNER_SKIN);
  slab(b, f, t, 0.78, 2.44, 2.34, 0.02, 'glass', CORNER_SKIN + D.glass - 0.02);
  for (const s of [-0.62, 0, 0.62]) bar(b, f, t + s, 0.78, 0.08, 2.34, CORNER_SKIN + D.bar - 0.03, 'dark');
  // four granite steps, 0.175 m risers, spreading onto the pavement
  for (let k = 0; k < 4; k++) slab(b, f, t, k * 0.175, 3.6 - k * 0.2, 0.175, 1.75 - k * 0.35, 'stone', CORNER_SKIN);
  // the canopy: a thin glass sheet in a dark edge frame, 2.1 m deep, on three raking brackets
  const cy = 4.5;
  // the frame stands 7 cm over the glass and 9 cm under it, so no face lies within 3 cm of the sheet's
  slab(b, f, t, cy, 3.7, 0.05, 2.1, 'glass', CORNER_SKIN);
  slab(b, f, t, cy - 0.09, 3.8, 0.21, 0.08, 'bronze', CORNER_SKIN + 2.1);
  for (const s of [-1, 1]) slab(b, f, t + s * 1.88, cy - 0.09, 0.06, 0.21, 2.14, 'bronze', CORNER_SKIN);
  for (const s of [-1.6, 0, 1.6]) {
    const g = new T.BoxGeometry(0.06, 0.06, 2.3).translate(0, 0, 1.15);
    g.rotateX(-Math.atan2(0.75, 2.1));
    put(b, f, g, t + s, cy - 0.02, CORNER_SKIN, 'bronze');
  }
  lantern(b, f, t - 1.5, 2.2, CORNER_SKIN);
  lantern(b, f, t + 1.5, 2.2, CORNER_SKIN);
  // the sign block at the foot of the steps (left, toward the south front), its lettering band light
  slab(b, f, 0.85, 0, 1.6, 0.95, 0.55, 'dark', 1.9);
  slab(b, f, 0.85, 0.42, 1.4, 0.32, 0.05, 'white', 2.45);
  cornice(b, f, len);
}

/** The 3.1 m south-facing return of the Westeinde front beside the entrance bay (ring edge 7): cladding, band, cornice (inferred, not in a crop). */
function southReturn(b: BuildingTools) {
  const {f, len} = edge(7);
  // the 3DBAG wall carries the corner quoin 7 cm proud at the east end: the corner-bay depth clears it
  run(b, f, len, 0, BAND0, CORNER_SKIN, 'sandstone');
  band(b, f, len, false);
  // the Westeinde front's cornice runs round the convex corner at the east end; the west end stops short of the entrance bay's
  cornice(b, f, len, [-1, 0]);
}

/**
 * The low annexe set back west of the south front (ring edge 3, 4.2 m, w06-164 2023): brick over a stone plinth with a
 * blind segment-headed door recess, a stone cornice at 6.1-7.1 m and the green-grey mansard over it (the shell is
 * flat-topped at 9.5 m here, so the mansard is drawn as a slate skin on the upper wall).
 */
function annexe(b: BuildingTools) {
  const {f, len} = edge(3);
  slab(b, f, len / 2, 0, len, 0.6, SKIN, 'stone');
  poly(b, f, 2.0, 0.6, segHead(1.3, 2.3, 0.2), 0.05, 'red');
  segBand(b, f, 2.0, 3.12, 1.6, 0.22, 0.22, 0.09, 'red');
  slab(b, f, len / 2, 6.1, len, 0.5, SKIN, 'stone');
  slab(b, f, len / 2, 6.6, len, 0.5, 0.4, 'stone');
  slab(b, f, len / 2, 7.1, len, 9.45 - 7.1, 0.08, 'slate');
}
