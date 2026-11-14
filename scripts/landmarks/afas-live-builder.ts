import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, GL, leanSlab, setSink, slab} from './nearbar-kit';
import {makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {cutFrontWalls, type XZ} from './venue-kit';
import {profiledRibs, type RibOpening} from '../../src/canalRecall/landmarks/profiledCladding';
import source from './afas-live-footprints.json' with {type: 'json'};

/**
 * AFAS Live, Johan Cruijff Boulevard 590 (BAG pand 0363100012123240, BAG year 2001): the concert hall opened on
 * 15 March 2001 as the Heineken Music Hall and named AFAS Live since 2017 (nl.wikipedia.org/wiki/AFAS_Live).
 *
 * Drawn from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 12 px/m):
 * - the boulevard front (ring 11 -> 3, 77 m, s from the east end): TMX7316010203-002866_pano_0001_000072 (2022-12-16)
 *   and TMX7315120208-000110_pano_0000_005252 (2016-07-12). A silver panel of horizontal ribs over a glazed ground
 *   floor, the giant dotted AFAS live lettering across it, three round poster discs low in the middle, and a glass
 *   curtain block at the west end. Crop foot = pavement, y = (312 - py) / 12.
 * - the service front (ring 9 -> 10, 62 m, s from the west end): TMX7316010203-001251_pano_0000_000929 (2019-06-26).
 *   Silver vertical-ribbed cladding over a grey block plinth, a long row of small windows (a second row on the west
 *   part), two loading doors, a blue side door and a louvre. y = (305 - py) * 0.08 (wall top to the 3DBAG 11.2 m).
 * - the east atrium (ring 10 -> 11): TMX7316010203 crops of 2019-2021; a low glass wall, simplified to glazed bays.
 * The west side is the dark ribbed black box (TMX7316010203-001614_pano_0000_000333, 2020-01-31): the 3DBAG shell in
 * dark grey, ribs skipped (its walls bow away from the footprint chords). Roofs keep the 3DBAG LoD2.2 shell (CC BY 4.0).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const len = (a: XZ, b: XZ) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const N: Chord = {a: R[11], b: R[3]};
const LN = len(R[11], R[3]);
const S: Chord = {a: R[9], b: R[10]};
const LS = len(R[9], R[10]);
const E: Chord = {a: R[10], b: R[11]};
const TOP = 20.1;                 // boulevard panel top (3DBAG wall tops 20.0-20.1 over s 0-56; the crop keeps it flat)
const LOW = 16.5;                 // 3DBAG wall top over the west part of the boulevard front (s 56.3-77.1)
const STRIP = 16.0;               // the shell wall is kept from here up to the lower roof edge (s 56.3-77.1), closing it
const PANEL_END = 66.4;           // the silver panel ends and the glass curtain block starts (crop x 797)
const GROUND = 3.4;               // glazed ground floor under the panel (crop py 272-310)
const STOP = 11.2;                // service front wall top (3DBAG)
const ys = (py: number) => Math.round((305 - py) * 0.08 * 100) / 100;

type Ctx = {K: FrontKit; b: BuildingTools};

/** Outward compass bearing of a shell wall (x east, z south), oriented away from the footprint centroid. */
function wallBearing(s: Surface): number {
  const p = s.rings[0];
  let nx = 0, nz = 0, mx = 0, mz = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
    mx += a[0] / p.length; mz += a[2] / p.length;
  }
  const cx = R.reduce((t, q) => t + q[0], 0) / R.length, cz = R.reduce((t, q) => t + q[1], 0) / R.length;
  if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
  return (Math.atan2(nx, -nz) * 180 / Math.PI + 360) % 360;
}

function shell(c: Ctx) {
  let cut = cutFrontWalls(SRC.surfaces, [R[11], R[0], R[1], R[2], R[3]], N, [[-0.6, 56.3, TOP], [56.3, LN + 0.6, STRIP]]);
  cut = cutFrontWalls(cut, [R[9], R[10]], S, [[-0.6, LS + 0.6, STOP]]);
  cut = cutFrontWalls(cut, [R[10], R[11]], E, [[-0.6, 39.5, -1], [39.5, 81.5, 7.5], [81.5, len(R[10], R[11]) + 0.6, -1]]);
  // the black box: walls facing west-south-west are dark grey (slate slot), the rest silver; flat roofs mid grey (sandstone slot)
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'concrete', roof: 'sandstone', wallFor: s => {
    const h = wallBearing(s);
    return h > 200 && h < 300 ? 'slate' : 'concrete';
  }});
}

/** The boulevard front: glazed ground floor, ribbed silver panel with the dotted lettering and poster discs, glass block. */
function boulevard(c: Ctx) {
  const {K, b} = c;
  const G: Sec = K.sec(N, 0, PANEL_END, 0, GROUND, 'concrete', 0);
  K.sec(N, 0, 56.3, GROUND + 0.02, TOP, 'concrete', 0);
  K.sec(N, 56.3, PANEL_END, GROUND + 0.02, STRIP, 'concrete', 0);
  const f = K.faceFrame(G, 0);
  // ground floor: glazed bays between the doors, dark mullions
  const bays = 6, bw = PANEL_END / bays;
  for (let k = 0; k < bays; k++) K.opening(G, (k + 0.5) * bw, 0.2, bw - 0.5, 3.0, {frame: 'dark', back: 'glass', depth: 0.25, edge: 0.08, cols: 4, bars: [2.3]});
  slab(b, f, PANEL_END / 2, GROUND - 0.12, PANEL_END - 0.04, 0.2, 0.5, 'slate');      // canopy edge over the glazing
  // the panel behind the lower 3DBAG roof: a closed parapet box over s 56.3 - 66.4
  slab(b, f, (56.3 + PANEL_END) / 2, LOW, PANEL_END - 56.3, TOP - LOW, 0.4, 'concrete', -0.4);
  // horizontal ribs every 0.85 m (crop rib lines)
  for (let y = GROUND + 0.6; y < TOP - 0.3; y += 0.85) slab(b, f, PANEL_END / 2, y, PANEL_END - 0.2, 0.07, 0.07, 'concrete');
  dottedLetters(b, f, 'AFAS LIVE', 33.3, 5.2, 1.17, 1.96);
  // three round poster discs (crop x 348, 428, 506 at py 222, radius 27 px)
  ([[29.0, 'dark'], [35.7, 'red'], [42.2, 'red']] as const).forEach(([s, col]) => disc(b, f, s, 7.5, 2.2, 0.16, col));
  // the coping
  slab(b, f, PANEL_END / 2, TOP - 0.02, PANEL_END, 0.18, 0.5, 'concrete', -0.4);
  // glass curtain block at the west end: full-height glazing in a dark grid, its top closed back to the shell
  const C: Sec = K.sec(N, PANEL_END + 0.02, LN, 0, STRIP, 'slate', 0);
  const cw = (LN - PANEL_END) / 4;
  for (let k = 0; k < 4; k++) K.opening(C, PANEL_END + (k + 0.5) * cw, 0.2, cw - 0.12, STRIP - 0.5, {frame: 'dark', back: 'glass', depth: 0.2, edge: 0.05, rows: 6});
  slab(b, f, (PANEL_END + LN) / 2, LOW, LN - PANEL_END, TOP - LOW, 0.3, 'slate', -0.3);
}

/** The giant lettering as a field of square dots, 3 x 4 dots per glyph cell (the facade's perforation pattern). */
function dottedLetters(b: BuildingTools, f: ReturnType<FrontKit['faceFrame']>, text: string, t: number, y: number, px: number, pxY: number) {
  const total = ([...text].length * 6 - 1) * px;
  let u = t - total / 2;
  const dot = 0.32, nx = 3, ny = 4;
  for (const ch of text) {
    const rows = GL[ch];
    if (rows) for (let j = 0; j < rows.length; j++) for (let k = 0; k < 5; k++) {
      if (rows[j][k] !== '1') continue;
      for (let a = 0; a < nx; a++) for (let e = 0; e < ny; e++) {
        leanSlab(b, f, u + (k + (a + 0.5) / nx) * px, y + (6 - j + (e + 0.5) / ny) * pxY - dot / 2, dot, dot, 0.04, 'greyBrick');
      }
    }
    u += 6 * px;
  }
}

/** The service front: grey block plinth, ribbed silver cladding, window rows, loading doors. */
function service(c: Ctx) {
  const {K, b} = c;
  const PL: Sec = K.sec(S, 0, LS, 0, ys(272), 'greyBrick', 0);
  const UP: Sec = K.sec(S, 0, LS, ys(272) + 0.02, STOP, 'concrete', 0);
  const f = K.faceFrame(PL, 0);
  const holes: RibOpening[] = [];
  const hole = (Sx: Sec, s: number, y: number, w: number, h: number, o: Parameters<FrontKit['opening']>[4]) => {
    K.opening(Sx, s, y, w, h, o);
    if (y + h > ys(272)) holes.push({t0: s - w / 2, t1: s + w / 2, y0: Math.max(y, ys(272)), y1: y + h});
  };
  const win = {frame: 'dark' as const, back: 'glass' as const, depth: 0.16, edge: 0.06, bars: [0.9]};
  for (let s = 2.1; s < 57.6; s += 1.29) hole(UP, s, ys(210), 0.75, ys(187) - ys(210), win);      // upper row (crop x 25-690)
  for (let s = 2.1; s < 21.8; s += 1.29) hole(UP, s, ys(250), 0.75, ys(230) - ys(250), win);      // lower row on the west part
  // loading doors (crop x 295-380, 480-628) reach into the cladding; the louvre and the blue door stay in the plinth
  const doorUp = {frame: 'dark' as const, back: 'concrete' as const, depth: 0.2, edge: 0.08};
  for (const [s0, s1] of [[24.6, 31.7], [40.0, 52.3]]) {
    const m = (s0 + s1) / 2, w = s1 - s0;
    K.opening(PL, m, 0.05, w, ys(272) - 0.1, {...doorUp, cols: Math.round(w / 3)});
    hole(UP, m, ys(272) + 0.1, w, ys(252) - ys(272) - 0.1, doorUp);
  }
  K.opening(PL, 10.3, 0.05, 1.8, 2.3, {frame: 'dark', back: 'blue', depth: 0.18, edge: 0.07});
  K.opening(PL, 3.55, 0.25, 6.2, 2.0, {frame: 'dark', back: 'dark', depth: 0.12, edge: 0.06, rows: 6});
  for (const r of profiledRibs({length: LS, y0: ys(272) + 0.1, y1: STOP - 0.25, pitch: 0.6, rib: 0.12, openings: holes, endMargin: 0.3})) {
    leanSlab(b, f, (r.t0 + r.t1) / 2, r.y0, r.t1 - r.t0, r.y1 - r.y0, 0.06, 'concrete');
  }
  slab(b, f, LS / 2, STOP - 0.02, LS, 0.2, 0.4, 'concrete', -0.3);                // coping
}

/** The east atrium: a low glass wall in glazed bays (crop face-e), simplified. */
function atrium(c: Ctx) {
  const {K} = c;
  const A: Sec = K.sec(E, 39.46, 81.5, 0, 7.46, 'slate', 0);
  const n = 6, w = (81.5 - 39.46) / n;
  for (let k = 0; k < n; k++) K.opening(A, 39.46 + (k + 0.5) * w, 0.15, w - 0.14, 7.0, {frame: 'dark', back: 'glass', depth: 0.12, edge: 0.05, cols: 3, rows: 3});
}

export function buildAfasLive(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b};
    shell(c);
    boulevard(c);
    service(c);
    atrium(c);
    K.flush();
  } finally {
    setSink(0);
  }
}
