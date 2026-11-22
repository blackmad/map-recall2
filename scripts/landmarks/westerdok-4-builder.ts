import type {BuildingTools} from './cultural-builders';
import {slab} from './nearbar-kit';
import {strut, type Col, type FR} from './modern-front-kit';
import {at, boxBand, buildHandBlock, grid, longBand, type Front, type Src, type Win} from './hand-block-kit';
import source from './westerdok-4-footprints.json';

/**
 * WESTERDOK 4-318 (Westerdokseiland; BAG pand 0363100012184746, 2007): one pand holding a multi-architect housing block of
 * dark brick towers and low wings round a court, with a bridge tower over the middle (lane hand-blocks-c-20261122,
 * block-sized triage rank 12; held in lane hand-blocks-a-20261121 at 59k triangles). Massing: the 3DBAG LoD2.2 shell
 * (westerdok-4-footprints.json), rebuilt wall by wall by hand-block-kit.ts. The 35-39 m roofs of the shell are the bridge
 * tower and the deep slabs behind the street fronts, not storeys over them: seen from the panorama poses they stand under
 * the photographed roofline (the rectified crop draws a farther wall lower), so the shell is kept. Fronts read off the
 * rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed per wall in westerdok-4-inventory.json; `s` metres from each
 * crop's left end:
 *  - Westerdok (w01-275, 2025, 22.4 px/m): a punched-window brick tower, a low wing, a tower of white concrete window
 *    frames, a low wing of white-framed pairs, then the long front of small punched windows with white sills carrying the
 *    signature staggered lattice of deep cantilevered balconies (timber soffits, glass rails, dark brick end boxes) and a
 *    ground of recesses, a garage and light grey garage doors;
 *  - the north side (w02-5, 2025): two towers with three and five window columns over a low two-storey wing, shop windows;
 *  - the south side (w05-166 2020, w06-166 2019): a tower of brick-clad balcony stacks over a two-storey void, and a tower
 *    of narrow and wide windows over a café with a long black awning.
 * The short ends and the court take the inferred grid.
 */
const src = source as unknown as Src;

const BRICK: Col = 'greyBrick', WHITE: Col = 'stone', DARK: Col = 'dark', TIMBER: Col = 'ochre', BOX: Col = 'slate', DOORS: Col = 'concrete';
const ROWS6 = (y0: number, p: number, h: number): [number, number][] => Array.from({length: 6}, (_, k) => [y0 + k * p, y0 + k * p + h]);

// ---- Westerdok (w01-275) -------------------------------------------------------------------------------------------
const W_TOWER = ROWS6(5.4, 2.9, 1.9), W_FRAMES = ROWS6(5.6, 2.95, 1.8), W_PUNCH = ROWS6(5.2, 2.93, 1.6);
const whiteFrame = (s0: number, s1: number, y: [number, number], cols = 2): Win => ({s: (s0 + s1) / 2, w: s1 - s0, y, o: {depth: 0.35, frame: WHITE, edge: 0.24, cols}});
const punch: number[] = [];
for (let s = 59.6; s < 111.4; s += 1.8) punch.push(+s.toFixed(2));
/** The balcony lattice: odd rows (deck at 8.2, 13.8, 19.3 m) and even rows (11.0, 16.6 m) on alternate columns. */
const BALCONIES: [number, number][] = [8.2, 13.8, 19.3].flatMap(h => [74.7, 81.5, 88.4].map(s => [s, h] as [number, number]))
  .concat([11.0, 16.6].flatMap(h => [78.0, 84.7, 91.4].map(s => [s, h] as [number, number])));
const W: Front = {
  tag: 'w01-275', a: [-42.92, -58.82], b: [-52, 53.16], n: [-0.9967, -0.0808],
  segs: [
    {s: [0, 14.9], bands: [[99, BRICK]], wins: [...grid([2.0, 5.6, 9.2, 13.0], 2.4, W_TOWER, {cols: 2}), ...grid([2.0, 5.6, 9.2, 13.0], 1.8, [[0.9, 4.2]], {frame: WHITE, edge: 0.1})]},
    {s: [14.9, 28.9], bands: [[99, BRICK]], wins: [...grid([16.5, 20.1, 23.7, 27.3], 2.4, W_TOWER.slice(0, 2), {cols: 2}), {s: 19.8, w: 9.2, y: [0.12, 3.4], o: {depth: 0.5, back: DARK, edge: 0}}]},
    {s: [28.9, 43.5], bands: [[99, BRICK]], wins: [...W_FRAMES.flatMap(y => [whiteFrame(29.5, 35.7, y), whiteFrame(36.9, 43.1, y)]), whiteFrame(29.5, 35.7, [0.4, 4.3], 3), whiteFrame(36.9, 43.1, [0.4, 4.3], 3)]},
    {s: [43.5, 58.06], bands: [[99, BRICK]], wins: [...W_FRAMES.slice(0, 2).flatMap(y => [whiteFrame(44.2, 50.3, y), whiteFrame(51.4, 57.4, y)]), whiteFrame(44.2, 54.1, [0.4, 4.3], 4), whiteFrame(54.8, 57.6, [0.4, 4.3], 1)]},
    {s: [58.06, 112.35], bands: [[99, BRICK]], wins: [
      {s: 70.0, w: 8.9, y: [0.12, 3.9], o: {depth: 0.9, cols: 4, edge: 0.08}},
      {s: 82.45, w: 8.1, y: [0.12, 3.6], o: {depth: 0.9, back: DARK, edge: 0}},
      ...[95.9, 100.1, 104.3, 108.5].map(s => ({s, w: 4.0, y: [0.6, 3.9] as [number, number], o: {depth: 0.15, back: DOORS, edge: 0.06, frame: WHITE}})),
      ...grid([59.6, 61.4, 88.4, 90.2, 92.0], 1.0, [[0.8, 3.6]], {sill: WHITE}),
      ...grid([63.8], 2.6, W_PUNCH, {cols: 2, sill: WHITE}),
      ...grid(punch.filter(s => Math.abs(s - 63.8) > 1.7), 1.0, W_PUNCH, {sill: WHITE}),
    ]},
  ],
  extra: (b, F) => {
    // the deep cantilevered balconies: timber deck 6.4 m out, glass side rails, a dark brick-clad box at the outer end
    for (const [s, h] of BALCONIES) {
      slab(b, F.f, s, h - 0.35, 2.7, 0.35, 6.4, TIMBER, 0);
      slab(b, F.f, s, h, 2.9, 1.25, 1.3, BOX, 5.15);
      for (const d of [-1, 1]) slab(b, F.f, s + d * 1.32, h, 0.05, 1.0, 5.1, 'glass', 0.05);
    }
    // white column in the recessed ground
    strut(b, at(F, 75.1, -0.3, 0), at(F, 75.1, -0.3, 3.9), 0.25, WHITE, 6);
  },
};

// ---- north side (w02-5) --------------------------------------------------------------------------------------------
const N_ROWS = ROWS6(5.4, 2.84, 1.5), lowN = Array.from({length: 11}, (_, k) => +(16.1 + 3.55 * k).toFixed(2));
const N: Front = {
  tag: 'w02-5', a: [36.08, -52.41], b: [-42.92, -58.82], n: [0.0808, -0.9967],
  segs: [
    {s: [0, 13.17], bands: [[99, BRICK]], wins: [...grid([5.95, 9.2, 11.6], 1.6, N_ROWS, {cols: 2}), ...grid([6.6, 9.5], 1.9, [[0.12, 3.3]], {depth: 0.3, back: DARK, edge: 0})]},
    {s: [13.17, 56.68], bands: [[99, BRICK]], wins: [
      ...grid(lowN, 2.3, N_ROWS.slice(0, 2), {cols: 2}),
      ...grid(lowN.filter(s => s > 19), 2.2, [[0.7, 3.8]], {frame: WHITE, edge: 0.08, cols: 2}),
      ...grid([15.0, 16.9], 1.2, [[0.12, 3.0]], {depth: 0.3, back: DARK, edge: 0}),
    ]},
    {s: [56.68, 79.26], bands: [[99, BRICK]], wins: [...grid([58.4, 61.9, 65.5, 68.9, 72.1], 2.3, N_ROWS, {cols: 2}), ...grid([58.4, 61.9, 65.5, 68.9, 72.1, 75.4], 2.2, [[0.7, 3.8]], {frame: WHITE, edge: 0.08, cols: 2})]},
  ],
};

// ---- south side (w05-166, w06-166) ---------------------------------------------------------------------------------
const S_ROWS: [number, number][] = [[8.1, 10.0], [11.0, 12.9], [13.9, 15.8], [16.8, 18.7], [19.8, 21.7]];
const STACKS: [number, number, number[]][] = [[2.0, 7.0, [10.6, 13.5, 16.4, 19.4]], [10.5, 14.6, [10.6, 13.5, 16.4, 19.4]], [19.2, 22.9, [7.7, 10.6, 13.5, 16.4, 19.4]], [28.6, 33.6, [7.7, 10.6, 13.5, 16.4, 19.4]]];
const S1: Front = {
  tag: 'w05-166', a: [0.5, 39.8], b: [38.26, 30.21], n: [0.2461, 0.9692],
  segs: [{s: [0, 38.96], bands: [[99, BRICK]], wins: [
    {s: 9.1, w: 12.8, y: [0.12, 9.2], o: {depth: 3.0, back: DARK, edge: 0}},
    ...grid([0.66, 2.5, 8.3, 10.0, 16.1, 17.8, 23.3, 25.1, 27.3, 33.0, 34.8], 1.05, S_ROWS, {bars: [0.3]}),
    ...grid([16.1, 17.8, 23.3, 25.1, 27.3, 33.0, 34.8], 1.05, [[5.2, 7.1]], {bars: [0.3]}),
    ...grid([17.0, 20.75, 24.3], 2.6, [[0.5, 7.0]], {rows: 2, edge: 0.08, frame: 'frame'}),
    ...grid([30.15, 33.95], 2.7, [[2.4, 7.0]], {rows: 2, edge: 0.08, frame: 'frame'}),
  ]}],
  extra: (b, F) => {
    // brick-clad balcony boxes: a dark soffit slab and a solid parapet, 1.8 m out
    for (const [s0, s1, ys] of STACKS) for (const y of ys) {
      slab(b, F.f, (s0 + s1) / 2, y, s1 - s0, 0.22, 1.8, DARK, 0);
      boxBand(b, F, s0, s1, y + 0.22, y + 1.3, 1.8, BRICK);
    }
    for (const s of [9.1, 10.3]) strut(b, at(F, s, -1.0, 0), at(F, s, -1.0, 9.2), 0.2, WHITE, 6);
  },
};
const S2_WIN: [number, number][] = [[2.0, 1.15], [4.2, 1.15], [7.8, 3.1], [11.3, 1.15], [13.4, 1.15], [17.1, 3.1], [20.6, 1.15], [22.7, 1.15]];
const S2_ROWS = ROWS6(5.0, 2.66, 1.8);
const S2: Front = {
  tag: 'w06-166', a: [-52, 53.16], b: [-15, 43.74], n: [0.2467, 0.9691],
  segs: [
    {s: [0, 24.58], bands: [[3.75, BRICK], [4.05, WHITE], [99, BRICK]], wins: [...S2_WIN.flatMap(([s, w]) => S2_ROWS.map(y => ({s, w, y, o: {bars: [0.32], ...(w > 2 ? {cols: 3} : {})}}))), ...grid([4.5, 9.9, 15.3, 20.7], 4.6, [[0.4, 2.8]], {cols: 3, edge: 0.06, frame: DARK})]},
    {s: [24.58, 31.21], bands: [[3.75, BRICK], [4.05, WHITE], [99, BRICK]], wins: [...grid([25.6, 27.2, 28.8, 30.4], 1.0, S2_ROWS.slice(0, 2), {bars: [0.32]}), ...grid([26.3, 29.6], 2.8, [[0.4, 2.8]], {cols: 2, edge: 0.06, frame: DARK})]},
    {s: [31.21, 38.17], bands: [[3.75, BRICK], [4.05, WHITE], [99, BRICK]], wins: [...grid([32.8, 34.4], 1.0, S2_ROWS, {bars: [0.32]}), ...grid([34.0], 4.6, [[0.4, 2.8]], {cols: 3, edge: 0.06, frame: DARK})]},
  ],
  extra: (b, F: FR) => {
    // the café's long black awning
    longBand(b, F, 0.3, 35.8, 2.95, 3.55, 1.8, DARK);
  },
};

export function buildWesterdok4(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [W, N, S1, S2], wall: BRICK, roof: 'slate', ledge: 'concrete', setbackAbove: 11.5, storey: 2.9, firstSill: 5.4, gridWin: 1.2, defaults: {edge: 0}, gridDefaults: {edge: 0}});
}
