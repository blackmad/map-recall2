import type {BuildingTools} from './cultural-builders';
import {slab} from './nearbar-kit';
import {balcony, type Col, type FR, type OpenOpts} from './modern-front-kit';
import {buildHandBlock, door, grid, ribbon, type Front, type Src, type Win} from './hand-block-kit';
import source from './westerdoksdijk-215-footprints.json';

/**
 * WESTERDOKSDIJK 215-421 (+3 streets; BAG pand 0363100012186086, 2008): the multi-architect Westerdok courtyard block
 * (lane hand-blocks-a-20261121, routed to hand by docs/reports/block-sized-triage-20261121.md, rank 8). Massing: the 3DBAG
 * LoD2.2 shell (westerdoksdijk-215-footprints.json), rebuilt wall by wall by hand-block-kit.ts. Fronts are measured off the
 * rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed per wall in westerdoksdijk-215-inventory.json; `s` is metres
 * along the 3DBAG wall line from the crop's left end (photo positions re-anchored on the 3DBAG wall breaks where the crop's
 * scale drifts), heights over the street:
 *  - Westerdoksdijk (w01-275, 2024 crop, 2018 second view): a red-brown brick block with stacked full-width balconies, a
 *    low red-brown brick piece, the dark stepped-cantilever terrace block (two gallery storeys over a glazed plinth, then
 *    staggered deep terrace slabs with dark balustrades to the roof), the glazed lobby, the grey-brown brick loggia grid
 *    (two bays per storey, each a big window beside a railed loggia, the pair alternating storey by storey), a low brick
 *    frame of wide openings and a second balcony block;
 *  - the north street (w02-5, 2024 + 2020): a three-storey grey-brown brick plinth of ground-floor front doors and two
 *    storeys of perforated brick lattice screens alternating with loggias, a grey-brown tower with staggered punched windows
 *    on its left and a dark brown tower with vertical slit windows on its right, a passage through the plinth;
 *  - the south street (w03-185, 2022): a grey brick block of tall narrow windows under a pale top, the low grey brick row
 *    with picture windows over a row of slit windows and a passage, the pale buff 12-storey tower, a pale brick corner;
 *  - the east quay (w04-104, 2022): red-brown brick with red-framed window pairs, a buff brick front of big windows either
 *    side of a loggia stack, a red-brown corner with white-framed windows.
 * The three short east walls (w05-96, w06-86, w07-91) get a scatter of mixed windows over a ground floor of narrow tall
 * windows (their crops show that rhythm); courtyard and set-back walls take the inferred grid.
 * Local helpers worth lifting into hand-block-kit.ts: `terrace` (closed cantilever slab + solid balustrade, any length)
 * and `latticeRows` (perforated brick screen modules alternating with loggias).
 */
const src = source as unknown as Src;

const EBRICK: Col = 'brick', REDB: Col = 'ochre', DARK: Col = 'dark', CONC: Col = 'concrete', RED: Col = 'red', SAND: Col = 'sandstone';
const GREYB: Col = 'greyBrick', SLIT: Col = 'blue', SBRICK: Col = 'bronze', PALE: Col = 'gold', RFRAME: Col = 'copper', BROWN: Col = 'pink';
const INSIDE: Col = 'green', LIGHT: Col = 'stone', GLASS: Col = 'glass';

/** Deep railed loggia: dark (or light) back wall, a rail bar 1 m over the floor. */
const LOGGIA = (back: Col = INSIDE): OpenOpts => ({depth: 1.3, back, frame: 'frame', edge: 0, bars: [1.0]});
/** Perforated brick lattice: a shallow dark field crossed by brick bars (bars 6 cm wide, 5 cm deep). */
const LATTICE: OpenOpts = {depth: 0.08, back: DARK, frame: GREYB, cols: 3, rows: 3, edge: 0.08};
/** Frameless glazed hole: the many minor windows (towers, slits, short walls) stay under the 40k triangle budget. */
const PLAIN: OpenOpts = {edge: 0, depth: 0.2};

/** Closed cantilever terrace: slab box, a solid balustrade along the front and both ends (all boxes, no open edges). */
function terrace(b: BuildingTools, F: FR, s0: number, s1: number, y: number, d: number, rail: Col = INSIDE, rh = 1.1) {
  const w = s1 - s0, m = (s0 + s1) / 2;
  slab(b, F.f, m, y - 0.4, w, 0.4, d, CONC);
  slab(b, F.f, m, y, w, rh, 0.06, rail, d - 0.06);
  for (const t of [s0 + 0.03, s1 - 0.03]) slab(b, F.f, t, y, 0.06, rh, d - 0.06, rail);
}

// ---- Westerdoksdijk (w01-275) ---------------------------------------------------------------------------------------
const BAL_FLOORS = [3.2, 5.95, 8.7, 11.45, 14.2, 16.95, 19.7];
const balconyBlock = (s0: number, s1: number, punched: number[]): Win[] => [
  ...BAL_FLOORS.flatMap(f => ribbon(s0, s1, [f + 0.2, f + 2.2], 1.4, PLAIN)),
  ...grid(punched, 1.3, BAL_FLOORS.map(f => [f + 0.6, f + 2.2] as [number, number])),
  ...grid([...Array.from({length: Math.floor((s1 - s0) / 2.5)}, (_, k) => s0 + 1.25 + 2.5 * k), ...punched], 1.5, [[0.4, 2.7]]),
];
const balconyStack = (b: BuildingTools, F: FR, s0: number, s1: number) => {
  const n = Math.ceil((s1 - s0) / 6.5), w = (s1 - s0) / n;
  for (const y of BAL_FLOORS) for (let k = 0; k < n; k++) balcony(b, F, s0 + k * w + 0.05, w - 0.1, 1.4, y, {slab: CONC, parapet: SBRICK, slabT: 0.25, railH: 1.0, sides: true});
};
const TER_FLOORS = [3.9, 6.9, 9.9, 12.9, 15.9, 18.9];
// the loggia grid: per storey, the left and right bay each a big window beside a loggia, 'WL' or 'LW'
const E_ROWS: [[number, number], string, string][] = [
  [[18.7, 20.8], 'WL', 'WL'], [[15.9, 18.0], 'WL', 'LW'], [[13.0, 15.2], 'LW', 'WL'],
  [[10.1, 12.3], 'WL', 'LW'], [[7.3, 9.4], 'LW', 'LW'], [[4.5, 6.6], 'WL', 'WL'],
];
const eBay = (s0: number, s1: number, y: [number, number], kind: string): Win[] => {
  const split = kind === 'WL' ? s0 + (s1 - s0) * 0.56 : s0 + (s1 - s0) * 0.43, g = 0.08;
  const win = (a: number, c: number): Win => ({s: (a + c) / 2, w: c - a, y, o: {cols: 2, depth: 0.2}});
  const log = (a: number, c: number): Win => ({s: (a + c) / 2, w: c - a, y: [y[0] - 0.15, y[1]], o: LOGGIA()});
  return kind === 'WL' ? [win(s0, split - g), log(split + g, s1)] : [log(s0, split - g), win(split + g, s1)];
};

const W01: Front = {
  tag: 'w01-275', a: [-27.74, -55.47], b: [-36.89, 58.19], n: [-0.9968, -0.0803],
  segs: [
    {s: [0, 19.0], bands: [[99, REDB]], wins: balconyBlock(0.5, 12.6, [14.3, 16.9])},
    {s: [19.0, 31.6], bands: [[99, REDB]], wins: [
      ...grid([20.3, 23.0, 25.7, 30.5], 1.8, [[4.5, 6.8], [7.4, 9.7]], {cols: 2}),
      door(20.3, 1.2, DARK, 2.6), ...grid([23.0, 25.7], 1.8, [[0.5, 2.9]]), door(30.5, 1.4, DARK, 2.8),
    ]},
    // the terrace block's core: glazed plinth, a glazed storey behind every terrace
    {s: [31.6, 51.5], bands: [[99, DARK]], wins: [
      ...ribbon(32.8, 51.2, [0.2, 3.3], 1.7, {frame: DARK, depth: 0.3}),
      ...TER_FLOORS.flatMap(f => ribbon(32.8, 51.2, [f + 0.15, f + 2.55], 1.5, PLAIN)),
    ]},
    // the glazed lobby under the two gallery storeys
    {s: [51.5, 64.3], bands: [[99, DARK]], wins: [
      ...ribbon(51.8, 64.0, [0.2, 3.3], 1.2, {frame: 'frame', depth: 0.3}),
      ...[3.9, 6.9].flatMap(f => ribbon(51.8, 64.0, [f + 0.15, f + 2.55], 1.5, PLAIN)),
    ]},
    {s: [64.3, 81.5], bands: [[99, EBRICK]], wins: [
      ...E_ROWS.flatMap(([y, l, r]) => [...eBay(64.8, 72.6, y, l), ...eBay(73.2, 81.0, y, r)]),
      ...[[64.8, 68.1], [68.3, 72.6], [73.2, 76.2], [76.4, 81.0]].map(([a, c]) => ({s: (a + c) / 2, w: c - a, y: [0.4, 3.5] as [number, number], o: {cols: 2, depth: 0.25}})),
    ]},
    {s: [81.5, 94.4], bands: [[99, EBRICK]], wins: grid([84.6, 90.6], 5.6, [[0.4, 3.5], [4.5, 6.6], [7.3, 9.4]], {cols: 4, depth: 0.35})},
    {s: [94.4, 114.1], bands: [[99, REDB]], wins: balconyBlock(95.0, 113.2, [])},
  ],
  extra: (b, F) => {
    balconyStack(b, F, 0.4, 12.7);
    balconyStack(b, F, 95.0, 113.3);
    // the stepped cantilevers: two gallery storeys over the plinth, then staggered deep terraces up to the roof terrace
    for (const y of [3.9, 6.9]) terrace(b, F, 31.7, 64.2, y, 1.8);
    terrace(b, F, 28.0, 54.0, 9.9, 3.0);
    terrace(b, F, 29.7, 40.0, 12.9, 4.5); terrace(b, F, 40.0, 54.0, 12.9, 2.8);
    terrace(b, F, 27.7, 38.0, 15.9, 2.6); terrace(b, F, 38.0, 51.3, 15.9, 5.0);
    terrace(b, F, 30.8, 42.0, 18.9, 4.0); terrace(b, F, 42.0, 50.4, 18.9, 2.5);
    terrace(b, F, 34.7, 45.0, 21.9, 3.0);
  },
};

// ---- the north street (w02-5) ---------------------------------------------------------------------------------------
/** The plinth's two upper storeys: modules of a brick lattice screen and an open loggia, the upper row offset by one. */
const latticeRows = (s0: number, s1: number): Win[] => {
  const out: Win[] = [], P = 2.4;
  for (const [y, phase] of [[[4.3, 6.8], 0], [[7.3, 9.9], 1]] as [[number, number], number][]) {
    for (let k = 0, s = s0 + 1.2; s < s1 - 1.0; k++, s += P) {
      const lattice = (k + phase) % 2 === 0;
      out.push(lattice ? {s, w: 2.2, y, o: LATTICE} : {s, w: 2.0, y, o: LOGGIA(LIGHT)});
    }
  }
  return out;
};
const plinthDoors = (s0: number, s1: number): Win[] =>
  Array.from({length: Math.floor((s1 - s0) / 1.45)}, (_, k) => s0 + 0.7 + 1.45 * k).map((s, k): Win =>
    k % 2 === 0 ? {s, w: 0.95, y: [0.1, 2.9], o: {depth: 0.2, back: LIGHT, frame: 'frame'}} : {s, w: 0.9, y: [0.4, 2.9], o: PLAIN});
const TOWER_SILLS = Array.from({length: 8}, (_, k) => 11.3 + 2.95 * k);
const SLITS = (ss: number[], ys: [number, number][]) => grid(ss, 0.5, ys, {...PLAIN, depth: 0.25});
const W02: Front = {
  tag: 'w02-5', a: [59.63, -48.3], b: [-27.74, -55.47], n: [0.0817, -0.9967],
  segs: [
    {s: [0, 10.5], bands: [[99, GREYB]], wins: [
      ...grid([1.5, 4.0, 6.5, 9.0], 1.4, Array.from({length: 6}, (_, k) => [4.0 + 2.95 * k, 5.6 + 2.95 * k] as [number, number]), PLAIN),
      ...grid([1.5, 4.0, 6.5, 9.0], 1.4, [[0.4, 2.8]]),
    ]},
    {s: [10.5, 33.6], bands: [[99, GREYB]], wins: [
      ...TOWER_SILLS.flatMap((y, k) => grid(k % 2 ? [12.9, 15.5, 17.0, 20.8, 23.7, 25.1, 27.0, 31.0] : [11.8, 13.2, 16.4, 19.9, 21.3, 24.6, 28.2, 29.6, 32.6], 1.1, [[y, y + 1.6]], {cols: 2})),
      ...latticeRows(10.6, 33.6), ...plinthDoors(10.6, 33.6),
    ]},
    {s: [33.6, 60.6], bands: [[99, GREYB]], wins: [...latticeRows(33.6, 60.6), ...plinthDoors(33.7, 60.6)]},
    {s: [60.6, 68.0], bands: [[10.5, GREYB], [99, SLIT]], wins: [
      {s: 62.0, w: 3.0, y: [0.05, 3.4], o: {depth: 2.5, back: DARK, edge: 0}},
      ...latticeRows(63.6, 68.0), ...plinthDoors(64.0, 68.0),
      ...SLITS([63.0, 65.0, 67.0], [[10.9, 33.5]]),
    ]},
    {s: [68.0, 87.8], bands: [[99, SLIT]], wins: [
      ...SLITS([69.0, 71.0, 73.0, 75.0, 77.0, 79.0], [[0.4, 9.6], [10.9, 33.5]]), ...SLITS([81.6, 83.6, 85.6], [[0.4, 9.6], [10.9, 22.0]]),
    ]},
  ],
  // a slim brick pier over the tower's west corner (3DBAG T-junction at x -0.79, z -52.64, 0-34.4 m): its open seam was a
  // 34 m boundary loop in the audit
  extra: b => slab(b, {origin: [-0.79, -52.64], tangent: [-0.9967, -0.0817], n: [0.0817, -0.9967]}, 0, 0, 0.3, 34.36, 0.1, SLIT),
};

// ---- the south street (w03-185) -------------------------------------------------------------------------------------
const W03_NARROW: [number, number][] = [[4.2, 6.4], [7.2, 9.4], [10.1, 12.3], [13.1, 15.3]];
const lowRow = (big: number[], bigW: number, slits: number[]): Win[] => [
  ...grid(big, bigW, [[3.9, 5.8]], {cols: 3}), ...grid(slits, 0.5, [[6.6, 8.6]], PLAIN),
];
const TOWER_ROWS: [number, number][] = [[3.8, 5.9], [6.6, 8.6], ...Array.from({length: 9}, (_, k) => [9.2 + 2.71 * k, 11.2 + 2.71 * k] as [number, number])];
const W03_COLS = Array.from({length: 12}, (_, k) => 1.2 + 1.45 * k);
const W03: Front = {
  tag: 'w03-185', a: [-36.89, 58.19], b: [43.13, 64.63], n: [-0.0803, 0.9968],
  segs: [
    {s: [0, 17.8], bands: [[16.2, SBRICK], [99, PALE]], wins: [...grid(W03_COLS, 0.5, [...W03_NARROW, [0.4, 3.2]], PLAIN), ...grid(W03_COLS, 0.6, [[16.8, 18.2], [19.6, 21.0]], PLAIN)]},
    {s: [17.8, 21.7], bands: [[99, SBRICK]], wins: []},
    {s: [21.7, 36.3], bands: [[99, SBRICK]], wins: [
      {s: 31.55, w: 3.6, y: [0.05, 3.0], o: {depth: 2.0, back: DARK, edge: 0}},
      ...lowRow([23.4, 27.2, 30.95, 34.7], 2.4, [22.1, 23.3, 24.5, 25.9, 27.1, 28.2, 29.7, 30.9, 31.9, 33.5, 34.6, 35.6]),
      ...grid([22.2, 23.3, 24.5, 25.9, 27.1], 0.5, [[0.3, 2.9]], PLAIN), door(28.3, 1.0, DARK, 2.6), door(34.7, 1.0, DARK, 2.6),
    ]},
    {s: [36.3, 54.5], bands: [[99, PALE]], wins: [
      door(38.0, 2.0, GLASS, 3.0), door(47.3, 2.8, GLASS, 3.0),
      ...grid([38.0], 3.0, TOWER_ROWS, {cols: 3}), ...grid([47.3], 2.8, TOWER_ROWS, {cols: 3}),
      ...grid([40.97, 42.2, 43.5, 44.7, 49.8, 51.1, 52.3, 53.6], 0.65, [[0.4, 3.0], ...TOWER_ROWS]),
    ]},
    {s: [54.5, 67.7], bands: [[99, SBRICK]], wins: [
      ...lowRow([56.05, 60.5, 65.2], 2.6, [55.2, 56.5, 57.9, 59.2, 60.6, 61.9, 63.3, 64.6, 66.0]),
      ...grid([55.2, 56.5, 57.9, 59.2, 60.6, 61.9, 63.3, 64.6, 66.0], 0.45, [[0.4, 2.9]], PLAIN),
    ]},
    {s: [67.7, 80.3], bands: [[99, PALE]], wins: [
      door(72.3, 2.4, DARK, 3.0),
      ...grid([69.2, 71.4, 73.6, 75.8, 78.0], 0.7, Array.from({length: 7}, (_, k) => [3.8 + 2.75 * k, 5.7 + 2.75 * k] as [number, number])),
      ...grid([69.2, 75.8, 78.0], 0.7, [[0.4, 2.9]]),
    ]},
  ],
};

// ---- the east quay (w04-104) ----------------------------------------------------------------------------------------
const R6: [number, number][] = [[3.4, 5.6], [6.3, 8.6], [9.3, 11.6], [12.2, 14.5], [15.1, 17.4], [18.0, 20.3]];
const pairRows = [R6[0], R6[2], R6[3], R6[5]], singleRows = [R6[1], R6[4]];
const W04: Front = {
  tag: 'w04-104', a: [43.13, 64.63], b: [58.6, 1.87], n: [0.9709, 0.2394],
  segs: [
    {s: [0, 35.8], bands: [[99, RED]], wins: [
      {s: 33.75, w: 3.4, y: [0.3, 5.6], o: {cols: 2, rows: 2, depth: 0.3}},
      ...Array.from({length: 8}, (_, k) => [
        ...grid([1.27 + 4.47 * k], 1.4, pairRows, {frame: RFRAME, bars: [1.0]}),
        ...grid([3.22 + 4.47 * k], 1.9, pairRows),
      ]).flat(),
      ...Array.from({length: 16}, (_, j) => grid([1.25 + 2.24 * j], 1.4, singleRows, {frame: j % 2 ? RFRAME : 'frame'})).flat(),
      ...grid(Array.from({length: 15}, (_, j) => 1.25 + 2.24 * j), 0.6, [[1.2, 2.6]], PLAIN),
    ]},
    {s: [35.8, 54.9], bands: [[99, SAND]], wins: [
      ...grid([39.25], 5.2, [[0.4, 2.7], ...R6], {cols: 3}),
      ...grid([52.2], 4.6, [[0.4, 2.7], ...R6], {cols: 3}),
      ...grid([43.85, 47.05], 2.4, R6.slice(2), LOGGIA(LIGHT)),
      ...grid([43.85, 47.05], 2.4, [[0.4, 2.7], ...R6.slice(0, 2)], {cols: 2}),
    ]},
    {s: [54.9, 64.64], bands: [[99, RED]], wins: [
      door(56.9, 1.8, GLASS, 3.0),
      ...grid([56.9, 63.3], 1.6, R6, {cols: 2, depth: 0.3}), ...grid([59.0, 61.2], 1.2, R6, {depth: 0.3}),
      ...grid([59.0, 61.2, 63.3], 1.2, [[0.6, 2.8]]),
    ]},
  ],
};

// ---- the three short east walls: a scatter of wide and narrow windows over narrow tall ground-floor windows ------------
const SCATTER: [number, number][] = [[2.2, 2], [0.8, 1], [1.4, 1], [2.2, 2], [0.8, 1], [1.6, 2]];
function scatter(len: number): Win[] {
  const out: Win[] = [];
  for (let k = 0; k < 7; k++) {
    const y: [number, number] = [3.6 + 2.75 * k, 5.4 + 2.75 * k];
    for (let i = 0, s = 0.8; ; i++) {
      const [w, cols] = SCATTER[(i + k * 2) % SCATTER.length];
      if (s + w > len - 0.6) break;
      out.push({s: s + w / 2, w, y, o: cols > 1 ? {cols} : PLAIN});
      s += w + 1.0 + ((i + k) % 3) * 0.3;
    }
  }
  for (let s = 0.9; s < len - 0.6; s += 1.25) out.push({s, w: 0.7, y: [0.3, 2.9], o: PLAIN});
  return out;
}
const short = (tag: string, a: [number, number], b: [number, number], n: [number, number], c: Col): Front => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {tag, a, b, n, segs: [{s: [0, len], bands: [[99, c]], wins: scatter(len)}]};
};
const W05 = short('w05-96', [58.6, 1.87], [60.64, -17.48], [0.9945, 0.1048], RED);
const W07 = short('w07-91', [60.64, -17.48], [60.86, -29.49], [0.9998, 0.0181], BROWN);
const W06 = short('w06-86', [60.86, -29.49], [59.63, -48.3], [0.9979, -0.0654], GREYB);

// ---- courtyard and unphotographed walls: a plain storey grid of frameless windows ---------------------------------------
// The kit's inferred grid frames every window (about 20 triangles each); on this block's ~150 courtyard walls that alone was
// 27k triangles and broke the cap. Every wall away from the street lines is claimed here by a Front (listed with both
// normals, so whichever the kit infers matches) carrying frameless windows at one per 5.4 m (half the kit rhythm, for the
// 40k-triangle budget). The buff tower's narrow
// west return (x = 0, z 46.7-52.5) stays blank: its windows fell outside the wall silhouette in the openings gate.
// Byte/triangle budget (check-manual-landmarks: under 500 KB and 40,000 triangles, no allowance for new models): every
// window frame is four closed boxes (~48 triangles), so the block's defaults are frameless (mullions and bars stay) and only
// the judged Westerdoksdijk front keeps its framed windows.
const framed = (F: Front): Front => ({...F, segs: F.segs.map(sg => ({...sg, wins: sg.wins.map(w => ({...w, o: {edge: 0.06, ...w.o}}))}))});
// the east quay's red-framed windows keep their frames too: the red frame is that front's read
const redFramed = (F: Front): Front => ({...F, segs: F.segs.map(sg => ({...sg, wins: sg.wins.map(w => w.o?.frame === RFRAME ? {...w, o: {edge: 0.06, ...w.o}} : w)}))});
const STREETS = [framed(W01), W02, W03, redFramed(W04), W05, W06, W07];
const onStreet = (c: [number, number]) => STREETS.some(F => {
  const L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]), u = [(F.b[0] - F.a[0]) / L, (F.b[1] - F.a[1]) / L];
  const s = (c[0] - F.a[0]) * u[0] + (c[1] - F.a[1]) * u[1], d = (c[0] - F.a[0]) * F.n[0] + (c[1] - F.a[1]) * F.n[1];
  return s > -0.5 && s < L + 0.5 && Math.abs(d) < 1.2;
});
const GRID_ROWS: [number, number][] = [[0.6, 2.8], ...Array.from({length: 12}, (_, k) => [3.8 + 2.85 * k, 5.3 + 2.85 * k] as [number, number])];
function courtFronts(): Front[] {
  const out: Front[] = [];
  for (const sf of src.surfaces) {
    if (sf.type !== 'WallSurface') continue;
    const r = sf.rings[0], ys = r.map(p => p[1]);
    if (Math.max(...ys) - Math.min(...ys) < 2.5) continue;
    let nx = 0, nz = 0;
    for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    const nl = Math.hypot(nx, nz);
    if (nl < 1e-6) continue;
    const c: [number, number] = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];
    if (onStreet(c)) continue;
    for (const sg of [1, -1]) {
      const n: [number, number] = [sg * nx / nl, sg * nz / nl], u = [n[1], -n[0]], ts = r.map(p => p[0] * u[0] + p[2] * u[1]);
      const t0 = Math.min(...ts), t1 = Math.max(...ts), L = t1 - t0, off = c[0] * n[0] + c[1] * n[1];
      if (L < 2.2) continue;
      const a: [number, number] = [u[0] * t0 + n[0] * off, u[1] * t0 + n[1] * off], b: [number, number] = [u[0] * t1 + n[0] * off, u[1] * t1 + n[1] * off];
      const blank = Math.abs(c[0]) < 0.6 && c[1] > 46 && c[1] < 53;
      const m = Math.max(1, Math.floor(L / 5.4)), pitch = L / m;
      const wins = blank ? [] : grid(Array.from({length: m}, (_, k) => (k + 0.5) * pitch), Math.min(1.3, pitch - 0.6), GRID_ROWS, PLAIN);
      out.push({tag: 'court', a, b, n, segs: [{s: [0, L], bands: [[99, blank ? PALE : GREYB]], wins}]});
    }
  }
  return out;
}

export function buildWesterdoksdijk215(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [...STREETS, ...courtFronts()], wall: GREYB, roof: 'slate', ledge: CONC, setbackAbove: 13, setbackColour: GREYB, storey: 2.85, firstSill: 3.8, gridWin: 1.3, defaults: {edge: 0}});
}
