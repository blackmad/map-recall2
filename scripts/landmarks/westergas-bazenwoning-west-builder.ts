import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {cutFrontWalls, pathLedge, TriSink, type XZ} from './venue-kit';
import source from './westergas-bazenwoning-west-footprints.json' with {type: 'json'};

/**
 * The western foremen's house of the Westergasfabriek, Gosschalklaan 8 (BAG pand 0363100012161595, 1885, Rijksmonument
 * 337633): a red-brick house in the gasworks' Dutch Renaissance revival dress. A gabled centre block (ridge 8.9 m, N-S)
 * with a canted three-sided bay on its south end, between two low wings under zinc mono-pitch roofs. Read from rectified
 * Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m):
 *  - white plastered bands every ~0.9 m round the whole house, broken by the windows;
 *  - the north gable: a four-light window with a segmental head, white springer and key blocks, a cross window in the
 *    gable with a white surround, white bands across the gable and stepped (corbelled) rakes up to a small apex pier;
 *  - the south wings: tall segmental-headed windows, the front door with its fanlight up three steps, and a cornice of
 *    white blocks under the zinc roof edge; the bay: an arched window in each face under a projecting cornice;
 *  - the south gable over the bay: white bands and stepped rakes.
 * The 3DBAG LoD2.2 shell (CC BY 4.0) keeps every roof and the gable triangles; walls below the eaves are drawn. South
 * faces: the panorama heights are scaled to the 3DBAG eaves (5.15 m; the crops read 5.9 m from the street, which lies
 * lower than the house's floor).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const len = (a: XZ, b: XZ) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ch = (i: number, j: number): Chord => ({a: R[i], b: R[j]});
const BAND_Y = [1.0, 1.9, 2.8, 3.7];

type Win = {s: number; w: number; y: number; h: number; rise?: number; cols?: number; bars?: number[]; door?: boolean; keys?: boolean};
type Face = {name: string; c: Chord; top: number; wins: Win[]; tol?: number; bands?: number[]};
const SY = 5.15 / 5.9;   // south faces: photo heights to the 3DBAG eaves
const sw = (w: Win): Win => ({...w, y: w.y * SY, h: w.h * SY, rise: w.rise && w.rise * SY, bars: w.bars?.map(b => b * SY)});

const FACES: Face[] = [
  {name: 'north gable', c: ch(3, 4), top: 4.95, wins: [{s: 2.5, w: 2.5, y: 1.1, h: 2.85, rise: 0.25, cols: 4, bars: [1.9], keys: true}]},
  {name: 'gable block east return', c: ch(2, 3), top: 4.95, wins: []},
  {name: 'gable block west return', c: ch(4, 5), top: 4.95, wins: []},
  {name: 'north-west wing', c: ch(5, 6), top: 4.5, wins: [{s: 0.5, w: 0.6, y: 2.2, h: 0.65}, {s: 2.6, w: 1.4, y: 1.6, h: 1.7, rise: 0.15, cols: 2}]},
  {name: 'north-east wing', c: ch(0, 2), top: 4.55, wins: [{s: 1.95, w: 1.3, y: 1.2, h: 1.65, rise: 0.15, cols: 2}]},
  {name: 'west', c: ch(6, 10), top: 5.05, wins: [{s: 3.4, w: 1.3, y: 1.15, h: 2.3, rise: 0.15, cols: 2, bars: [1.6]}]},
  {name: 'east', c: ch(19, 0), top: 5.05, wins: [{s: 3.4, w: 1.3, y: 1.15, h: 2.3, rise: 0.15, cols: 2, bars: [1.6]}]},
  {name: 'south-west wing', c: ch(10, 11), top: 5.05, wins: [sw({s: 2.35, w: 2.3, y: 1.15, h: 2.95, rise: 0.3, cols: 3, bars: [2.0], keys: true}), sw({s: 5.35, w: 0.85, y: 0.45, h: 3.6, rise: 0.25, door: true, keys: true})]},
  {name: 'south-east wing', c: ch(18, 19), top: 5.0, wins: [sw({s: 1.85, w: 2.4, y: 1.1, h: 2.9, rise: 0.3, cols: 4, bars: [2.0], keys: true})]},
  {name: 'bay west', c: ch(13, 14), top: 4.8, tol: 0.3, wins: [sw({s: 0.77, w: 0.8, y: 1.1, h: 2.8, rise: 0.2, bars: [2.0]})]},
  {name: 'bay front', c: ch(14, 15), top: 4.8, tol: 0.3, wins: [sw({s: 1.11, w: 1.6, y: 1.1, h: 2.8, rise: 0.2, cols: 3, bars: [2.0]})]},
  {name: 'bay east', c: ch(15, 16), top: 4.8, tol: 0.3, wins: [sw({s: 0.72, w: 0.75, y: 1.1, h: 2.8, rise: 0.2, bars: [2.0]})]},
];
const BAY: XZ[] = [R[12], R[13], R[14], R[15], R[16], R[17]];

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

function shell(c: Ctx) {
  let surfaces = SRC.surfaces;
  for (const f of FACES) surfaces = cutFrontWalls(surfaces, [f.c.a, f.c.b], f.c, [[-1, len(f.c.a, f.c.b) + 1, f.top]], f.tol ?? 0.5);
  // wing roofs are zinc (the concrete slot), the centre block's roof slate
  const isZinc = (s: Surface) => s.type === 'RoofSurface' && Math.max(...s.rings[0].map(p => p[1])) < 6.3;
  addShell(c.b, {surfaces: surfaces.filter(s => !isZinc(s)), nativeRing: R}, {wall: 'brick', roof: 'slate'});
  addShell(c.b, {surfaces: surfaces.filter(isZinc), nativeRing: R}, {wall: 'brick', roof: 'concrete'});
}

/** A wall below its eaves: brick with the white bands, framed openings, white key and springer blocks. */
function face(c: Ctx, f: Face) {
  const {K, b} = c;
  const L = len(f.c.a, f.c.b), fr = frameAt(f.c, 0, 0);
  const sec: Sec = K.sec(f.c, 0, L, -0.3, f.top, 'brick', 0);
  for (const w of f.wins) {
    K.opening(sec, w.s, w.y, w.w, w.h, {frame: 'white', back: w.door ? 'dark' : 'glass', depth: w.door ? 0.3 : 0.14, edge: 0.07, cols: w.cols ?? 1, bars: w.bars, rise: w.rise});
    if (w.keys) for (const [ds, ww] of [[-w.w / 2 - 0.05, 0.3], [0, 0.32], [w.w / 2 + 0.05, 0.3]] as const) slab(b, fr, w.s + ds, w.y + w.h + 0.05, ww, 0.32, 0.05, 'white');
  }
  // white bands, broken where a window (and its 6 cm reveal margin) crosses them
  const ys = f.bands ?? BAND_Y.map(y => (f.name.startsWith('south') || f.name.startsWith('bay') ? y * SY : y));
  for (const y of [...ys, f.top - 0.12]) {
    let s0 = 0.02;
    const cuts = f.wins.filter(w => y + 0.12 > w.y - 0.06 && y < w.y + w.h + (w.keys ? 0.45 : 0.06)).map(w => [w.s - w.w / 2 - (w.keys ? 0.25 : 0.06), w.s + w.w / 2 + (w.keys ? 0.25 : 0.06)]).sort((p, q) => p[0] - q[0]);
    for (const [a, z] of [...cuts, [L - 0.02, L]]) {
      if (a - s0 > 0.1) slab(b, fr, (s0 + a) / 2, y, a - s0, 0.12, 0.04, 'white');
      s0 = Math.max(s0, z);
    }
  }
}

/** Gable dress over a 3DBAG gable triangle: white bands clipped to the rakes, corbelled steps along both rakes, apex pier. */
function gable(c: Ctx, chord: Chord, apexS: number, half: number, eave: number, apex: number, win?: {s: number; w: number; y: number; h: number}) {
  const {b} = c;
  const f = frameAt(chord, 0, 0);
  const widthAt = (y: number) => 2 * half * (apex - y) / (apex - eave);
  for (const y of [5.0, 5.9, 6.75, 7.6]) {
    const w = widthAt(y + 0.12) - 0.5;
    if (w < 0.3) continue;
    const [a, z] = [apexS - w / 2, apexS + w / 2];
    if (win && y + 0.12 > win.y - 0.1 && y < win.y + win.h + 0.1) {
      for (const [p, q] of [[a, win.s - win.w / 2 - 0.15], [win.s + win.w / 2 + 0.15, z]]) if (q - p > 0.1) slab(b, f, (p + q) / 2, y, q - p, 0.12, 0.04, 'white');
    } else slab(b, f, apexS, y, w, 0.12, 0.04, 'white');
  }
  // corbelled steps: a brick course stepping in every 0.3 m just inside each rake
  const n = Math.floor((apex - eave - 0.4) / 0.3);
  for (let k = 0; k < n; k++) {
    const y = eave + 0.05 + k * 0.3, w = widthAt(y + 0.3);
    for (const sd of [-1, 1]) slab(b, f, apexS + sd * (w / 2 - 0.2), y, 0.32, 0.22, 0.06, 'brick');
  }
  if (win) {
    // the gable window, set proud of the 3DBAG gable: white surround, glass, a cross of glazing bars
    slab(b, f, win.s, win.y - 0.12, win.w + 0.24, win.h + 0.24, 0.05, 'white');
    slab(b, f, win.s, win.y, win.w, win.h, 0.1, 'glass');
    slab(b, f, win.s, win.y, 0.06, win.h, 0.14, 'white');
    slab(b, f, win.s, win.y + win.h * 0.62, win.w, 0.06, 0.14, 'white');
    for (const ds of [-0.45, 0, 0.45]) slab(b, f, win.s + ds * win.w, win.y + win.h + 0.2, 0.22, 0.25, 0.06, 'white');
  }
}

/** The bay's cornice: a white ledge round its three faces with a row of white blocks under it. */
function bayCornice(c: Ctx) {
  pathLedge(c.M, BAY, 4.8, 0.3, 0, 0.32, 'white');
  const {b} = c;
  for (let i = 0; i + 1 < BAY.length; i++) {
    const L = len(BAY[i], BAY[i + 1]);
    if (L < 0.6) continue;
    const f = frameAt({a: BAY[i], b: BAY[i + 1]}, 0, 0), n = Math.floor(L / 0.4);
    setSink(0.04);
    for (let k = 0; k < n; k++) slab(b, f, (k + 0.5) * L / n, 4.6, 0.14, 0.2, 0.12, 'white');
    setSink(0.04, true);
  }
}

/** South wings: a white block cornice under the zinc roof edge. */
function wingCornice(c: Ctx, chord: Chord, top: number) {
  const {b} = c;
  const L = len(chord.a, chord.b), f = frameAt(chord, 0, 0), n = Math.floor((L - 0.8) / 0.5);
  // blocks sink a plain 4 cm (the staggered sink would bury most of a 10 cm block)
  setSink(0.04);
  for (let k = 0; k <= n; k++) slab(b, f, 0.4 + k * (L - 0.8) / n, top - 0.38, 0.16, 0.2, 0.1, 'white');
  setSink(0.04, true);
}

export function buildWestergasBazenwoningWest(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    for (const f of FACES) face(c, f);
    // north gable: apex over the ridge (3DBAG, 8.9 m), the rakes from 4.95 m at the corners
    gable(c, ch(3, 4), 2.5, 2.5, 4.95, 8.9, {s: 2.45, w: 1.35, y: 5.15, h: 1.7});
    // south gable over the bay (ring 12 -> 17)
    gable(c, ch(12, 17), 2.3, 2.5, 5.0, 8.9);
    bayCornice(c);
    wingCornice(c, ch(10, 11), 5.05);
    wingCornice(c, ch(18, 19), 5.0);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
