import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {poly, setSink, slab, type Frame} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {border} from './cut-face';
import {cutFrontWalls, TriSink, type Col, type XZ} from './venue-kit';
import source from './splendor-footprints.json' with {type: 'json'};

/**
 * Splendor, Nieuwe Uilenburgerstraat 116 (BAG pand 0363100012171998, bouwjaar 1937): the former municipal bathhouse
 * on Uilenburg, a music venue since 2013. One BAG pand holds the whole low range along the street, so the model keeps
 * the 3DBAG LoD2.2 shell (CC BY 4.0) for the roofs, the boiler-house chimney (17 m) and the canal and courtyard sides,
 * and draws the street front's storeys below the 3DBAG roofs.
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m over the 48.7 m street
 * chord, ring vertex 14 at the canal corner to 31): TMX7316010203-002031_pano_0001_000413 (2021-03-08, bare trees) and
 * TMX7316010203-001665_pano_0000_000369 (2020) for the two-storey east house; positions held to the 3DBAG walls
 * (2021 crop +0.6 m). Amsterdam School brick on a plinth of black glazed brick, cream eaves boards, red pantiles,
 * green window frames:
 *  - canal-corner house (s 0-8.1): front gable (3DBAG), a green timber bay of four lights over the white-framed door,
 *    two upper windows in green frames;
 *  - bath wing (8.1-20.6): eight small square windows on the plinth top, cream eaves board at 4.2 m;
 *  - gate block (20.6-31.3): all black glazed brick, a round-arched gate with an iron grille under a Star of David,
 *    a side door, a four-light window, cream eaves boards at 2.6 m under pantiles;
 *  - east house (31.3-48.7): a one-storey link with a three-light window, then two storeys with a dark header band,
 *    an oval cartouche, a white cornice at 7.0 m and three dormers in the pantile roof.
 *
 * Native frame of splendor-footprints.json (x east, z south, y up from the pavement).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const ST: Chord = {a: R[14], b: R[31]};
const ST_LEN = Math.hypot(R[31][0] - R[14][0], R[31][1] - R[14][1]);
const stF = frameAt(ST, 0, 0);

const A = [0, 8.13] as const, B = [8.13, 20.6] as const, C = [20.6, 31.28] as const, D1 = [31.28, 36.73] as const, D2 = [36.73, ST_LEN] as const;
const GATE = [22.8, 27.6] as const;
const TOP = {a: 6.45, b: 4.1, cLow: 2.6, gate: 3.6, d1: 3.45, d2: 7.0};
const PLINTH = 2.3, PLINTH_D = 1.45;

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};
const ff = (c: Ctx, S: Sec, proud = 0): Frame => c.K.faceFrame(S, proud);
const P3 = (s: number, y: number, o: number) => [stF.origin[0] + stF.tangent[0] * s + stF.n[0] * o, y, stF.origin[1] + stF.tangent[1] * s + stF.n[1] * o];

function shell(c: Ctx) {
  // the drawn fronts replace the 3DBAG walls below the 3DBAG eaves; nothing of the front walls is kept but the gable
  const path = [R[14], R[16], R[17], R[23], R[29], R[31]];
  const cut = cutFrontWalls(SRC.surfaces, path, ST, [[A[0] - 1, A[1], TOP.a], [B[0], D2[1] + 1, 9.0]]);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'red'});
}
/** Pantile skirt from an eaves board (o out, y0) up and back to the 3DBAG eaves line (y1 at the wall plane). */
function skirt(c: Ctx, s0: number, s1: number, y0: number, y1: number, out = 0.32) {
  const up = [stF.n[0], 1.2, stF.n[1]];
  c.M.quad('red', P3(s0, y0, out), P3(s1, y0, out), P3(s1, y1, -0.02), P3(s0, y1, -0.02), up);
  for (const s of [s0, s1]) c.M.tri('red', P3(s, y0, out), P3(s, y1, -0.02), P3(s, y0, -0.02), [s === s0 ? -stF.tangent[0] : stF.tangent[0], 0, s === s0 ? -stF.tangent[1] : stF.tangent[1]]);
}
const board = (c: Ctx, S: Sec, s0: number, s1: number, y: number, h = 0.2, d = 0.3) => slab(c.b, ff(c, S), (s0 + s1) / 2, y, s1 - s0, h, d, 'sandstone');
const plinth = (c: Ctx, S: Sec, s0: number, s1: number, h: number) => slab(c.b, ff(c, S), (s0 + s1) / 2, -0.3, s1 - s0, h + 0.3, 0.06, 'concrete');
function win(c: Ctx, S: Sec, s: number, y0: number, y1: number, w: number, cols = 1, frame: Col = 'green') {
  c.K.opening(S, s, y0, w, y1 - y0, {frame, back: 'glass', depth: 0.14, edge: 0.07, cols, barW: 0.06});
}

function cornerHouse(c: Ctx) {
  const {K, b} = c;
  const S = K.sec(ST, A[0], A[1], -0.3, TOP.a, 'brick', 0);
  plinth(c, S, A[0] + 0.04, 3.7, PLINTH);
  plinth(c, S, 5.5, A[1] - 0.04, PLINTH);
  // white-framed door under the green bay
  K.opening(S, 4.6, 0, 1.5, 2.3, {frame: 'sandstone', back: 'dark', depth: 0.25, edge: 0.12, bars: [1.9]});
  const f = ff(c, S);
  slab(b, f, 5.25, 2.4, 4.7, 1.35, 0.25, 'green');                         // timber bay
  for (const t of [3.55, 4.75, 5.95, 7.05]) {
    slab(b, f, t, 2.68, 0.6, 0.74, 0.06, 'glass', 0.25);
    border(b, frameAt(ST, 0, 0.25), t, 2.68, 0.6, 0.74, 0.07, 0.1, 'sandstone');
  }
  slab(b, f, 5.25, 3.75, 4.9, 0.12, 0.33, 'sandstone');
  win(c, S, 3.1, 5.0, 6.1, 2.2, 3);
  win(c, S, 6.5, 5.0, 6.1, 1.6, 2);
  board(c, S, 5.5, A[1] - 0.04, TOP.a - 0.2, 0.22, 0.32);
}

function bathWing(c: Ctx) {
  const {K} = c;
  const S = K.sec(ST, B[0], B[1], -0.3, TOP.b, 'brick', 0);
  plinth(c, S, B[0] + 0.04, B[1] - 0.04, PLINTH - 0.04);
  for (let k = 0; k < 8; k++) win(c, S, 8.75 + k * 1.53, PLINTH + 0.02, PLINTH + 0.92, 0.9, 2);
  board(c, S, B[0] + 0.04, B[1] - 0.04, TOP.b - 0.02, 0.2, 0.32);
}

function gateBlock(c: Ctx) {
  const {K, b} = c;
  const L1 = K.sec(ST, C[0], GATE[0], -0.3, TOP.cLow, 'concrete', 0);
  const G = K.sec(ST, GATE[0], GATE[1], -0.3, TOP.gate, 'concrete', 0);
  const L2 = K.sec(ST, GATE[1], C[1], -0.3, TOP.cLow, 'concrete', 0);
  K.opening(L1, 21.95, 0, 1.4, 2.25, {frame: 'frame', back: 'frame', depth: 0.2, edge: 0.06, cols: 2});
  // the gate: round arch, iron grille, a header ring of glazed brick
  K.opening(G, 25.2, 0, 2.6, 3.05, {frame: 'frame', back: 'glass', depth: 0.7, edge: 0.05, cols: 9, barW: 0.03, bars: [1.0], rise: 1.3});
  K.archHead(G, 25.2, 3.05 - 1.3, 2.6, 1.3, 0.24, 0.08, 'concrete');
  win(c, L2, 29.75, 0.85, 2.3, 2.3, 4, 'white');
  board(c, L1, C[0] + 0.04, GATE[0] - 0.04, TOP.cLow - 0.2, 0.22, 0.32);
  board(c, L2, GATE[1] + 0.04, C[1] - 0.04, TOP.cLow - 0.2, 0.22, 0.32);
  skirt(c, C[0] + 0.04, GATE[0], TOP.cLow + 0.02, 4.25);
  skirt(c, GATE[1], C[1] - 0.04, TOP.cLow + 0.02, 4.25);
  skirt(c, GATE[0], GATE[1], TOP.gate + 0.02, 4.3, 0.2);
  // Star of David over the gate: two triangles on the roof skirt
  const fs = ff(c, G);
  const tri = (up: number): [number, number][] => [[-0.24, up * 0.14], [0.24, up * 0.14], [0, -up * 0.28]].map(([x, y]) => [x, y]) as [number, number][];
  poly(b, fs, 25.2, 3.88, tri(1), 0.05, 'gold', 0.18);
  poly(b, fs, 25.2, 3.88, tri(-1), 0.09, 'gold', 0.18);
}

function eastHouse(c: Ctx) {
  const {K, b} = c;
  const L = K.sec(ST, D1[0], D1[1], -0.3, TOP.d1, 'brick', 0);
  plinth(c, L, D1[0] + 0.04, D1[1] - 0.04, PLINTH_D);
  win(c, L, 33.8, 1.6, 2.9, 2.2, 3, 'white');
  board(c, L, D1[0] + 0.04, D1[1] - 0.04, TOP.d1 - 0.2, 0.22, 0.32);
  skirt(c, D1[0] + 0.04, D1[1] - 0.04, TOP.d1 + 0.02, 4.55);
  const H = K.sec(ST, D2[0], D2[1], -0.3, TOP.d2, 'brick', 0);
  plinth(c, H, D2[0] + 0.04, 39.75, PLINTH_D - 0.15);
  plinth(c, H, 40.85, D2[1] - 0.04, PLINTH_D - 0.15);
  const f = ff(c, H);
  slab(b, f, (D2[0] + D2[1]) / 2, 3.05, D2[1] - D2[0] - 0.08, 0.18, 0.05, 'concrete');        // dark header band
  for (const [s, w, cols] of [[37.8, 1.2, 2], [42.6, 1.2, 2], [44.8, 0.9, 1], [45.9, 0.9, 1], [47.1, 0.9, 1]] as const) win(c, H, s, 1.4, 2.6, w, cols, 'white');
  K.opening(H, 40.3, 0, 1.0, 2.1, {frame: 'white', back: 'dark', depth: 0.25, edge: 0.08});
  for (const [s, w, cols] of [[37.8, 1.2, 2], [42.4, 1.1, 2], [46.1, 2.4, 3]] as const) win(c, H, s, 4.1, 5.9, w, cols, 'white');
  // oval cartouche between the first-floor windows
  slab(b, f, 40.3, 4.55, 0.55, 0.85, 0.08, 'stone');
  slab(b, f, 40.3, 4.7, 0.35, 0.55, 0.12, 'brick');
  slab(b, f, (D2[0] + D2[1]) / 2, TOP.d2 - 0.12, D2[1] - D2[0] - 0.08, 0.3, 0.38, 'sandstone');  // cornice
  skirt(c, D2[0] + 0.04, D2[1] - 0.04, TOP.d2 + 0.18, 8.56, 0.3);
  // three dormers in the pantile roof
  for (const [s, w] of [[37.8, 1.6], [42.6, 1.6], [47.2, 2.0]] as const) {
    const df = frameAt(ST, 0, 0);
    slab(b, df, s, 7.2, w, 1.75, 1.6, 'brick', -1.4);
    slab(b, df, s, 7.55, w - 0.5, 1.0, 0.04, 'glass', 0.2);
    border(b, frameAt(ST, 0, 0.2), s, 7.55, w - 0.5, 1.0, 0.1, 0.1, 'white');
    slab(b, df, s, 8.95, w + 0.2, 0.15, 1.9, 'red', -1.5);
  }
}

export function buildSplendor(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    cornerHouse(c);
    bathWing(c);
    gateBlock(c);
    eastHouse(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
