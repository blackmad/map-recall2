import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab} from './nearbar-kit';
import {strut, type Col} from './modern-front-kit';
import {at, boxBand, buildHandBlock, door, grid, ribbon, rows, type Front, type Seg, type Src, type Win} from './hand-block-kit';
import source from './sumatrakade-1101-footprints.json';

/**
 * SUMATRAKADE 1101-1247 (Java-eiland; BAG pand 0363100012077391, 1998): a quay slab built as four fronts in different hands
 * (lane hand-blocks-a-20261121, block-sized triage rank 17). Massing: the 3DBAG LoD2.2 shell (sumatrakade-1101-footprints.json),
 * rebuilt wall by wall by hand-block-kit.ts. Fronts measured off the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed
 * per wall in sumatrakade-1101-inventory.json; `s` metres from the crop's left end, heights over the building's foot (the
 * quay crop's street line is 1.9 m lower):
 *  - Sumatrakade (w01-16, 2021 crop at 32.9 px/m): dark grey brick with scattered deep-set windows and two white window
 *    boxes; a dark brick frame with white four-light ribbon windows over a two-storey columned void; the middle, where two
 *    dark brick towers stand between stacks of glazing and rainbow-coloured spandrel bands (pink, green, purple, yellow,
 *    blue, orange, teal) over the void and the entrance; a second white-ribbon frame; red brick with scattered vertical
 *    windows and slots, a glazed bay stack and loggias;
 *  - the south side (w02-196, 2022, 44.8 px/m): three dark brick frames of deep railed loggias alternating with two more
 *    rainbow spandrel stacks, over the columned void and a glazed entrance.
 * Short and courtyard walls have the inferred window grid.
 */
const src = source as unknown as Src;

const GREYB: Col = 'greyBrick', BRICK: Col = 'brick', DARK: Col = 'dark', LEDGE: Col = 'concrete', METAL: Col = 'bronze', COLUMN: Col = 'stone';
const PINK: Col = 'pink', GREEN: Col = 'green', PURPLE: Col = 'sandstone', YELLOW: Col = 'gold', BLUE: Col = 'blue', ORANGE: Col = 'ochre', TEAL: Col = 'copper', RED: Col = 'red';

/** The colour stacks: seven spandrel bands (bottom to top) over the void, a glazed strip between each pair. */
const BANDS: [number, number][] = [[5.25, 6.6], [8.0, 9.45], [10.85, 12.3], [13.65, 15.1], [16.5, 18.0], [19.45, 20.95], [22.4, 23.6]];
const STRIPS: [number, number][] = [[6.7, 7.9], [9.55, 10.75], [12.4, 13.55], [15.2, 16.4], [18.1, 19.3], [21.05, 22.3]];
function colourStack(s0: number, s1: number, cols: (Col | null)[], voidAt: number | null): Seg {
  const bands: [number, Col][] = [];
  BANDS.forEach(([y0, y1], k) => { bands.push([y0, GREYB]); bands.push([y1, cols[k] ?? GREYB]); });
  bands.push([99, GREYB]);
  const wins: Win[] = STRIPS.flatMap(y => ribbon(s0 + 0.2, s1 - 0.2, y, 1.4, {depth: 0.15}));
  if (voidAt !== null) wins.push({s: voidAt, w: s1 - s0 - 0.3, y: [0.06, 5.15], o: {depth: 3.0, back: DARK, edge: 0}});
  return {s: [s0, s1], bands, wins};
}
const RIBBONS: [number, number][] = [[6.7, 8.2], [9.6, 11.2], [12.4, 14.1], [15.3, 16.9], [18.2, 19.8], [21.15, 22.7]];
const frameFront = (s0: number, s1: number, r0: number, r1: number): Seg => ({s: [s0, s1], bands: [[99, GREYB]], wins: [
  ...RIBBONS.flatMap(y => ribbon(r0, r1, y, 0.95)), {s: (r0 + r1) / 2, w: r1 - r0 + 0.2, y: [0.06, 5.2], o: {depth: 3.0, back: DARK, edge: 0}},
]});
const TOWER: [number, number][] = [[7.2, 8.3], [10.1, 11.2], [12.9, 14.1], [16.0, 17.3], [19.0, 20.3], [21.9, 23.0]];

/** Scattered windows: a column every `pitch` metres, each storey picking wide / narrow slot / none by a fixed pattern. */
function scatter(s0: number, s1: number, sills: number[], h: number, pitch: number, kinds: number[], o?: Win['o']): Win[] {
  const out: Win[] = [], n = Math.floor((s1 - s0) / pitch);
  for (let c = 0; c < n; c++) sills.forEach((y, r) => {
    const k = kinds[(c * 3 + r * 5 + c * r) % kinds.length], s = s0 + (c + 0.5) * (s1 - s0) / n;
    if (k > 0) out.push({s, w: k, y: [y, y + (r === 0 ? Math.min(h, 1.5) : h)], o});
  });
  return out;
}
const A_SILLS = [0.64, 3.5, 6.55, 9.6, 12.5, 15.3, 18.4, 21.4], E_SILLS = [0.96, 3.5, 6.4, 9.3, 12.1, 14.9, 17.7, 20.6];

const N: Front = {
  tag: 'w01-16', a: [20.63, -4.21], b: [-42.31, -22.53], n: [0.2794, -0.9602],
  segs: [
    {s: [0, 11.4], bands: [[99, GREYB]], wins: [door(7.9, 1.0, DARK, 2.3), ...scatter(0.3, 11.1, A_SILLS, 1.8, 1.55, [0.9, 0.5, 1.1, 0, 0.8, 0.45, 1.0], {depth: 0.35, frame: DARK})]},
    frameFront(11.4, 17.6, 12.45, 16.25),
    colourStack(17.6, 21.8, [TEAL, ORANGE, BLUE, YELLOW, PURPLE, GREEN, PINK], 19.7),
    {s: [21.8, 24.1], bands: [[99, GREYB]], wins: [...rows(22.95, 1.0, TOWER), door(23.3, 1.4, DARK, 2.6)]},
    colourStack(24.1, 25.5, [null, YELLOW, BLUE, ORANGE, PURPLE, RED, PINK], null),
    {s: [25.5, 27.8], bands: [[99, GREYB]], wins: [...rows(26.6, 1.0, TOWER), {s: 25.4, w: 2.0, y: [0.06, 2.6], o: {depth: 0.3, cols: 2}}]},
    colourStack(27.8, 32.0, [PINK, YELLOW, PURPLE, ORANGE, BLUE, RED, TEAL], 29.9),
    frameFront(32.0, 38.3, 33.3, 36.9),
    {s: [38.3, 65.6], bands: [[99, BRICK]], wins: [
      ...rows(44.45, 1.5, [[9.3, 11.0], [3.5, 5.3]], {depth: 1.0, back: DARK, edge: 0}),
      // the 3.5 m 3DBAG strip at s 55.7-59.4 turns off the front and its openings read past its silhouette (openings
      // gate), so it stays blank brick
      ...scatter(38.6, 64.4, E_SILLS, 1.8, 1.72, [1.0, 0.35, 1.0, 0.8, 0.35, 0, 1.0, 0.35], {depth: 0.2}).filter(w => w.s < 55.4 || w.s > 59.7),
    ]},
  ],
  extra: (b, F) => {
    // two white window boxes on the dark grey front
    for (const [s, y] of [[7.85, 20.8], [9.95, 15.5]]) { boxBand(b, F, s - 0.85, s + 0.85, y, y + 2.1, 0.4, 'frame'); slab(b, F.f, s, y + 0.2, 1.4, 1.7, 0.1, 'glass', 0.4); }
    // the red front's glazed bay stack (two parts)
    for (const [y0, y1] of [[6.4, 11.3], [1.1, 5.4]]) {
      boxBand(b, F, 46.3, 49.0, y0, y1, 0.5, 'frame');
      for (let k = 0, n = Math.round((y1 - y0) / 2.4); k < n; k++) slab(b, F.f, 47.65, y0 + 0.2 + k * (y1 - y0) / n, 2.4, (y1 - y0) / n - 0.4, 0.1, 'glass', 0.5);
    }
    // entrance canopy and the white columns of the voids
    boxBand(b, F, 22.5, 26.1, 4.05, 4.25, 1.2, LEDGE);
    for (const s of [18.15, 28.2, 31.6]) strut(b, at(F, s, 0.4, 0), at(F, s, 0.4, 5.15), 0.22, COLUMN, 8);
  },
};

const LOGGIAS: [number, number][] = [[6.5, 8.3], [9.4, 11.2], [12.3, 14.1], [15.2, 16.9], [18.0, 19.8], [21.1, 22.8]];
const loggiaFrame = (s0: number, s1: number, l0: number, l1: number, ground: Win): Seg => ({s: [s0, s1], bands: [[99, GREYB]], wins: [
  ...rows((l0 + l1) / 2, l1 - l0, LOGGIAS, {depth: 1.4, cols: 2}), ground,
]});
const S: Front = {
  tag: 'w02-196', a: [-27.79, -3.07], b: [6.19, 6.82], n: [-0.2796, 0.9601],
  segs: [
    {s: [0, 6.9], bands: [[99, BRICK]], wins: [...rows(5.25, 2.6, [[3.6, 5.4], ...LOGGIAS], {depth: 1.0}), ...grid([2.65], 0.8, [[1.0, 2.6], [3.6, 5.3], [6.5, 8.2], [9.4, 11.1], [12.3, 14.0], [15.2, 16.9], [18.0, 19.7], [21.1, 22.7]])]},
    loggiaFrame(6.9, 13.5, 8.3, 12.1, {s: 10.2, w: 3.8, y: [0.06, 5.2], o: {depth: 4.0, back: BRICK, edge: 0}}),
    colourStack(13.5, 17.9, [PINK, YELLOW, PURPLE, ORANGE, BLUE, RED, TEAL], 15.7),
    loggiaFrame(17.9, 24.1, 19.1, 22.9, {s: 21.05, w: 3.7, y: [0.06, 5.0], o: {depth: 0.3, cols: 3, rows: 4}}),
    colourStack(24.1, 28.3, [TEAL, ORANGE, BLUE, YELLOW, PURPLE, GREEN, PINK], 26.2),
    loggiaFrame(28.3, 35.4, 29.9, 33.6, {s: 31.75, w: 3.7, y: [0.06, 5.2], o: {depth: 4.0, back: BRICK, edge: 0}}),
  ],
  extra: (b, F) => {
    // loggia rails
    for (const [s0, s1] of [[8.3, 12.1], [19.1, 22.9], [29.9, 33.6]]) for (const [y] of LOGGIAS) ledgeStrip(b, F.f, (s0 + s1) / 2, y + 1.0, s1 - s0 - 0.1, 0.05, 0.04, METAL, -0.6);
    for (const s of [14.0, 17.4, 24.6, 27.8]) strut(b, at(F, s, 0.4, 0), at(F, s, 0.4, 5.15), 0.2, COLUMN, 8);
  },
};

export function buildSumatrakade1101(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [N, S], wall: GREYB, roof: 'slate', ledge: LEDGE, setbackAbove: 13, storey: 2.85, firstSill: 3.6, gridWin: 1.2});
}
