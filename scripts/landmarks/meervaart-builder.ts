import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit} from './street-front-kit';
import {centroidXZ, clipRingByY, cutFrontWalls, lettering, pathLettering, type XZ} from './venue-kit';
import source from './meervaart-footprints.json' with {type: 'json'};

/**
 * De Meervaart, Meer en Vaart 300, Osdorp (BAG pand 0363100012085435, 1999): theatre and congress centre. Read from
 * rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 25 px/m) on the 3DBAG LoD2.2 massing:
 *  - a dark-brick base, 7.7-8.6 m, round the whole block: upper rows of white-framed windows on the east, narrow
 *    windows over a run of shopfronts on the west (Meer en Vaart), cream-framed windows and library glazing on the
 *    north, and a blind south front with a tall white-framed door and three black downpipes;
 *  - the halls above it clad in horizontal aluminium (walls and the curved/sloped roofs);
 *  - the fly tower: dark brick to ~19.3 m under an aluminium crown band, with the lowercase white "meervaart" across
 *    its faceted south front (the signature; set with pathLettering, square to each facet);
 *  - "meervaart:" in raised grey letters with an orange colon on the north hall's aluminium;
 *  - the pale-panelled box at the north-east corner with its big dark-framed window over a glazed ground floor.
 * Tower heights are scaled from the crop (the tower stands ~6 m behind the base plane, so it reads ~10 % small).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const ch = (i: number, j: number): Chord => ({a: R[i], b: R[j]});
const len = (c: Chord) => Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]);

const BASE_SPLIT = 8.8;        // brick below, aluminium above (outside the tower and the box)
const TOWER_SPLIT = 19.3;      // the fly tower's aluminium crown band starts here
/** The fly tower's lower south front (3DBAG walls 8.6-17.8 m), west to east: the lettering's path. */
const TOWER_FRONT: XZ[] = [[11.1, 52.3], [17.8, 50.1], [23.8, 50.6], [30.5, 47.9]];
/** The north hall's aluminium wall (3DBAG 7.7-15.7 m), east to west. */
const HALL_N: Chord = {a: [17.6, -37.0], b: [-6.0, -29.2]};

type Win = {s: number; w: number; y: number; h: number; frame?: string; back?: string; cols?: number; bars?: number[]; depth?: number};
type Face = {c: Chord; top: number; wall: string; wins: Win[]};
const rep = (s0: number, pitch: number, n: number, o: Omit<Win, 's'>): Win[] => Array.from({length: n}, (_, k) => ({...o, s: s0 + k * pitch}));
const FACES: Face[] = [
  // east (71 -> 1; 3DBAG's wall runs straight past vertex 0), crop face-east (71 -> 0, same stations): upper white-framed windows, low slot windows, two service doors
  {c: ch(71, 1), top: 7.6, wall: 'brick', wins: [
    ...[1.3, 6.5, 10.2, 13.9, 17.5, 21.0, 24.8, 28.3, 31.9, 35.3].map(s => ({s, w: 1.85, y: 4.5, h: 1.7, frame: 'white', bars: [1.15]})),
    ...[[10.6, 5.8], [17.0, 3.0], [20.6, 2.6], [24.6, 2.3]].map(([s, w]) => ({s, w, y: 2.4, h: 0.4, frame: 'white'})),
    {s: 3.85, w: 0.9, y: 0, h: 2.2, frame: 'frame', back: 'dark', depth: 0.2}, {s: 18.9, w: 0.9, y: 0, h: 2.2, frame: 'frame', back: 'dark', depth: 0.2},
  ]},
  // west (59 -> 60) on Meer en Vaart, crop face-west: narrow upper windows over six shopfronts
  {c: ch(59, 60), top: 7.6, wall: 'brick', wins: [
    {s: 1.25, w: 0.8, y: 4.8, h: 1.7, frame: 'white'},
    ...rep(5.35, 3.56, 11, {w: 1.25, y: 4.8, h: 1.7, frame: 'white', bars: [1.2]}),
    ...[[4.1, 6.2], [11.2, 6.2], [18.3, 6.2], [25.7, 6.2], [32.7, 6.0], [39.35, 5.5]].map(([s, w]) => ({s, w, y: 0.4, h: 2.6, frame: 'white', cols: 3, bars: [2.05]})),
  ]},
  // south (66 -> 67), crop face-south: blind brick, one tall white-framed glazed door
  {c: ch(66, 67), top: 8.45, wall: 'brick', wins: [{s: 7.15, w: 1.7, y: 0, h: 6.3, frame: 'white', bars: [2.3, 3.6, 4.9], depth: 0.2}]},
  // north (21 -> 25, crop face-north starts at 22 = s 3.8): cream-framed windows, library glazing, the foyer glazing
  {c: ch(21, 25), top: 7.6, wall: 'brick', wins: [
    ...[4.9, 8.5, 11.9, 15.3, 18.9].map(s => ({s, w: 1.3, y: 4.8, h: 1.7, frame: 'sandstone', cols: 2})),
    {s: 4.6, w: 1.6, y: 0.3, h: 2.4, frame: 'white'},
    {s: 18.8, w: 5.6, y: 0.3, h: 2.6, frame: 'white', cols: 4},
    {s: 37.8, w: 6.0, y: 0.3, h: 2.8, frame: 'white', cols: 4},
  ]},
  // the panelled box (18 -> 19), crop face-box: big dark-framed window over the glazed ground floor
  {c: ch(18, 19), top: 13.5, wall: 'stone', wins: [
    {s: 7.3, w: 11.0, y: 3.8, h: 6.2, frame: 'frame', cols: 4, depth: 0.25},
    {s: 7.4, w: 13.6, y: 0.2, h: 3.0, frame: 'frame', cols: 6},
  ]},
];

const minY = (s: Surface) => Math.min(...s.rings[0].map(p => p[1]));
const maxY = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
const isTower = (s: Surface) => centroidXZ(s)[1] > 30 && maxY(s) > 17.5;
const isBox = (s: Surface) => { const [x, z] = centroidXZ(s); return x > 17 && z < -20 && minY(s) < 0.5 && maxY(s) > 12; };

/** Walls split into dark brick (base, tower shaft), aluminium (halls, tower crown) and the box's pale panels. */
function splitWalls(surfaces: Surface[]) {
  const brick: Surface[] = [], alu: Surface[] = [], stone: Surface[] = [], roofs: Surface[] = [];
  for (const s of surfaces) {
    if (s.type !== 'WallSurface') { roofs.push(s); continue; }
    if (isBox(s)) { stone.push(s); continue; }
    const h = isTower(s) ? TOWER_SPLIT : minY(s) > 7 ? -1 : BASE_SPLIT;
    const lo = clipRingByY(s.rings[0], h, -1), hi = clipRingByY(s.rings[0], h, 1);
    if (lo.length) brick.push({...s, rings: [lo]});
    if (hi.length) alu.push({...s, rings: [hi]});
  }
  return {brick, alu, stone, roofs};
}

export function buildMeervaart(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    let surfaces = SRC.surfaces;
    for (const f of FACES) surfaces = cutFrontWalls(surfaces, [f.c.a, f.c.b], f.c, [[-1, len(f.c) + 1, f.top]], 0.5);
    const {brick, alu, stone, roofs} = splitWalls(surfaces);
    addShell(b, {surfaces: brick, nativeRing: R}, {wall: 'brick', roof: 'slate'});
    addShell(b, {surfaces: alu, nativeRing: R}, {wall: 'concrete', roof: 'slate'});
    addShell(b, {surfaces: stone, nativeRing: R}, {wall: 'stone', roof: 'slate'});
    addShell(b, {surfaces: roofs, nativeRing: R}, {wall: 'brick', roof: 'slate', roofFor: s => (maxY(s) > 9 ? 'concrete' : 'slate')});
    for (const f of FACES) face(K, b, f);
    signs(b);
    K.flush();
  } finally {
    setSink(0);
  }
}

function face(K: FrontKit, b: BuildingTools, f: Face) {
  const L = len(f.c), sec = K.sec(f.c, 0, L, -0.3, f.top, f.wall as never, 0);
  for (const w of f.wins) K.opening(sec, w.s, w.y, w.w, w.h, {frame: (w.frame ?? 'white') as never, back: (w.back ?? 'glass') as never, depth: w.depth ?? 0.16, edge: 0.07, cols: w.cols ?? 1, bars: w.bars ?? []});
  if (f === FACES[2]) {
    // three black downpipes down the blind south front
    const fr = frameAt(f.c, 0, 0);
    for (const s of [2.25, 16.9, 30.8]) slab(b, fr, s, 0, 0.14, f.top - 0.15, 0.1, 'frame');
  }
}

function signs(b: BuildingTools) {
  // the fly tower's name: white lowercase, x-height 1.25 m, baseline ~15.7 m. The pitch (1.505 m) is set so both facet
  // vertices (arc 7.05 and 13.07 m) fall in the gaps after the first and fifth letters: no glyph straddles a bend.
  pathLettering(b, TOWER_FRONT, 'meervaart', 10.81, 15.7, 0.25, 0.12, 'white', 0, 0.005);
  // the north hall: raised grey "meervaart" and an orange colon, near its east end
  const fr = frameAt(HALL_N, 0, 0), px = 0.12;
  const w = lettering(b, fr, 'meervaart', 4.2, 11.3, px, 0.08, 'greyBrick');
  const tc = 4.2 + w / 2 + 2.5 * px;
  for (const y of [11.3, 11.3 + 3 * px]) slab(b, fr, tc, y, 2 * px, 2 * px, 0.08, 'red');
}
