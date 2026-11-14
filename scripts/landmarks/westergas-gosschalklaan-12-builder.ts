import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit} from './street-front-kit';
import {cutFrontWalls, pathLedge, TriSink, type XZ} from './venue-kit';
import source from './westergas-gosschalklaan-12-footprints.json' with {type: 'json'};

/**
 * Gosschalklaan 12, Westergasfabriek (BAG pand 0363100012166024, 1885, Isaac Gosschalk, Rijksmonument 512963, built as a
 * dwelling; now a cafe with a terrace on its east side): a single-storey dark-brown brick block, 7 x 14 m, under a
 * red-tiled hipped roof (3DBAG ridge 8.6 m). Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0,
 * venue-face-crops.ts at 50 px/m; heights scaled to the 3DBAG eaves, 5.45 m, from the crops' 5.9 m):
 *  - white bands at 1.75 and 3.35 m round the house, a white band and a frieze of white blocks under the eaves, and a
 *    white eaves board on a 40 cm overhang;
 *  - south front: two white-framed windows under one wide white lintel;
 *  - east (terrace) side: a glazed door pair and a single door; north end: one wide window.
 * The hipped roof keeps the 3DBAG LoD2.2 shell (CC BY 4.0).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const len = (a: XZ, b: XZ) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ch = (i: number, j: number): Chord => ({a: R[i], b: R[j]});
const K_Y = 5.45 / 5.9;   // crop heights to the 3DBAG eaves
const TOP = 5.35;
type Win = {s: number; w: number; y: number; h: number; door?: boolean; cols?: number};
type Face = {c: Chord; wins: Win[]};
const y = (v: number) => v * K_Y;
const FACES: Face[] = [
  {c: ch(5, 6), wins: [{s: 2.45, w: 0.9, y: y(2.4), h: y(1.7)}, {s: 4.4, w: 0.9, y: y(2.4), h: y(1.7)}]},
  {c: ch(6, 0), wins: [{s: 2.0, w: 2.2, y: 0, h: y(3.4), door: true, cols: 2}, {s: 6.8, w: 1.2, y: y(1.0), h: y(2.2)}, {s: 11.65, w: 0.95, y: 0, h: y(3.2), door: true}]},
  {c: ch(1, 2), wins: [{s: 3.4, w: 2.8, y: y(1.6), h: y(1.8), cols: 3}]},
  {c: ch(3, 5), wins: [{s: 6.9, w: 1.2, y: y(1.0), h: y(2.2)}]},
];

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

export function buildWestergasGosschalklaan12(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    let surfaces = SRC.surfaces;
    for (const f of FACES) surfaces = cutFrontWalls(surfaces, [f.c.a, f.c.b], f.c, [[-1, len(f.c.a, f.c.b) + 1, TOP]], 0.5);
    addShell(b, {surfaces, nativeRing: R}, {wall: 'brick', roof: 'red'});
    for (const f of FACES) face(c, f);
    // the white eaves board on its overhang, round the whole house
    // (from the middle of the north end round to just short of it, so the two ends meet on a straight run)
    const mid = (u: number): XZ => [R[1][0] + (R[3][0] - R[1][0]) * u, R[1][1] + (R[3][1] - R[1][1]) * u];
    pathLedge(M, [mid(0.5), R[3], R[4], R[5], R[6], R[7], R[1], mid(0.497)], TOP - 0.05, 0.16, 0, 0.4, 'white');
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}

function face(c: Ctx, f: Face) {
  const {K, b} = c;
  const L = len(f.c.a, f.c.b), fr = frameAt(f.c, 0, 0);
  const sec = K.sec(f.c, 0, L, -0.3, TOP, 'brick', 0);
  for (const w of f.wins) K.opening(sec, w.s, w.y, w.w, w.h, {frame: 'white', back: w.door ? 'dark' : 'glass', depth: w.door ? 0.25 : 0.14, edge: 0.07, cols: w.cols ?? 1, bars: w.door ? [] : [w.h * 0.62]});
  // bands, broken by openings
  for (const by of [y(1.9), y(3.64), y(4.92)]) {
    let s0 = 0.02;
    const cuts = f.wins.filter(w => by + 0.12 > w.y - 0.06 && by < w.y + w.h + 0.06).map(w => [w.s - w.w / 2 - 0.06, w.s + w.w / 2 + 0.06]).sort((p, q) => p[0] - q[0]);
    for (const [a, z] of [...cuts, [L - 0.02, L]]) { if (a - s0 > 0.1) slab(b, fr, (s0 + a) / 2, by, a - s0, 0.12, 0.04, 'white'); s0 = Math.max(s0, z); }
  }
  // one wide white lintel over the south windows
  if (f === FACES[0]) slab(b, fr, 3.42, y(4.35), 3.6, 0.2, 0.05, 'white');
  // the frieze: white blocks every ~0.5 m between the top band and the eaves board, plain 4 cm sink (no stagger)
  setSink(0.04);
  const n = Math.floor((L - 0.6) / 0.5);
  for (let k = 0; k <= n; k++) slab(b, fr, 0.3 + k * (L - 0.6) / n, y(4.92) + 0.2, 0.15, 0.28, 0.06, 'white');
  setSink(0.04, true);
}
