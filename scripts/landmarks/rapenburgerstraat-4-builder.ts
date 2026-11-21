import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab} from './nearbar-kit';
import {balcony, type Col} from './modern-front-kit';
import {boxBand, buildHandBlock, door, grid, longBand, panelEdges, ribbon, rows, shop, type Front, type Src} from './hand-block-kit';
import source from './rapenburgerstraat-4-footprints.json';

/**
 * RAPENBURGERSTRAAT 4-94 (+ Valkenburgerstraat; BAG pand 0363100012170563, 1997): a courtyard housing block whose long walls
 * are rows of fronts in different hands, the twin of Rapenburgerstraat 220-326 and Valkenburgerstraat 69-165 (lane
 * hand-blocks-a-20261121, block-sized triage rank 9). Massing: the 3DBAG LoD2.2 shell (rapenburgerstraat-4-footprints.json),
 * rebuilt wall by wall by hand-block-kit.ts. Fronts measured off the rectified Gemeente Amsterdam panoramas (CC BY 4.0)
 * listed per wall in rapenburgerstraat-4-inventory.json; `s` metres from the crop's left end, heights over its street line:
 *  - Valkenburgerstraat (w01-329, 2021 crop at 35.7 px/m): a salmon brick front with paired three-light windows on pale
 *    string courses, a white glazed bay stack, a red-brown brick strip, the grey-brown brick middle with two proud brick panels
 *    either side of a glazed stair slot, a red-brown front with a second bay stack and a balcony stack, and a dark grey brick
 *    front with ribbon storeys over grey spandrel panels; shops along the ground;
 *  - Rapenburgerstraat (w07, w05, w06, w04, w09; 2019-2025 crops at 50 px/m): a white rendered corner with a balcony stack,
 *    five bays of punched brick windows, a mauve-grey and a pale blue-grey rendered panel each with two tall gridded windows,
 *    a pink-grey rendered strip and a red brick end with balconies; flats and entrances on the ground.
 * The NE wall (w02-57), the SW ends and the courtyard have the inferred brick window grid.
 */
const src = source as unknown as Src;

const BRICK: Col = 'brick', SALMON: Col = 'red', GREYBROWN: Col = 'greyBrick', REDBROWN: Col = 'ochre', DARKBRICK: Col = 'blue';
const MAUVE: Col = 'pink', BLUEGREY: Col = 'concrete', RENDER: Col = 'stone', PINKGREY: Col = 'gold', ENDBRICK: Col = 'green';
const LEDGE: Col = 'sandstone', DARK: Col = 'dark', METAL: Col = 'bronze', SPANDREL: Col = 'copper';

const tall = (s: number, w: number, y: [number, number], r = 4) => ({s, w, y, o: {cols: 2, rows: r, depth: 0.45}});

// ---- Valkenburgerstraat (w01-329, 2021-03-08) ----------------------------------------------------------------------
const A_ROWS: [number, number][] = [[5.15, 6.55], [7.95, 9.35], [10.6, 12.1], [13.4, 14.8], [16.2, 17.6]];
const R_ROWS: [number, number][] = [[5.15, 6.55], [7.9, 9.3], [10.6, 12.0], [13.3, 14.7], [16.1, 17.5]];
const NW: Front = {
  tag: 'w01-329', a: [15.95, -44.17], b: [-39.37, -10.53], n: [-0.5195, -0.8544],
  segs: [
    {s: [0, 10.6], bands: [[3.8, DARK], [99, SALMON]], wins: [shop(2.65, 5.0, [0.8, 3.6]), shop(8.5, 4.2, [0.8, 3.6]), ...grid([3.8, 7.55], 3.3, A_ROWS, {cols: 3})]},
    {s: [10.6, 17.7], bands: [[3.8, DARK], [99, REDBROWN]], wins: [shop(14.7, 4.8, [0.8, 3.6]), ...rows(16.35, 1.6, R_ROWS)]},
    {s: [17.7, 39.7], bands: [[3.8, DARK], [99, GREYBROWN]], wins: [
      shop(23.9, 5.8, [0.8, 3.5]), shop(34.4, 6.6, [0.8, 3.6]), door(28.7, 1.15, DARK, 3.6), {s: 19.25, w: 0.9, y: [0.8, 3.5], o: {back: DARK}},
      ...grid([23.95, 33.55], 3.7, [[7.4, 9.35], [10.6, 12.2], [13.4, 15.0]], {cols: 3}),
      ...ribbon(21.2, 26.8, [3.95, 5.6], 1.9), ...ribbon(31.2, 37.7, [4.7, 6.0], 1.9),
      ...ribbon(21.2, 26.9, [16.3, 17.2], 1.9), ...ribbon(31.1, 37.8, [15.9, 17.2], 1.9),
      ...rows(28.7, 1.2, [[6.5, 10.8]], {bars: [1.4, 2.8]}), ...rows(28.7, 1.2, [[13.1, 15.8]], {bars: [1.35]}), ...rows(28.7, 1.2, [[16.4, 17.5]]),
      ...grid([19.25, 37.4], 0.85, [[5.1, 6.4], [7.7, 9.0], [10.4, 11.7], [13.1, 14.4], [15.9, 17.2]]),
    ]},
    {s: [39.7, 52.0], bands: [[3.8, DARK], [99, REDBROWN]], wins: [
      door(40.7, 1.5, DARK, 3.8), {s: 44.35, w: 1.5, y: [0.8, 3.6]}, shop(49.0, 4.8, [0.8, 3.6]),
      ...rows(44.35, 1.5, R_ROWS), ...rows(50.7, 1.4, R_ROWS),
      ...rows(47.5, 2.6, [[4.4, 6.6], [6.9, 9.3], [9.6, 11.8], [12.1, 14.5], [15.0, 17.0]], {cols: 2, depth: 0.3}),
    ]},
    {s: [52.0, 64.7], bands: [[3.9, DARK], [99, DARKBRICK]], wins: [
      shop(56.7, 6.6, [0.9, 3.7]), door(61.9, 1.3, DARK, 3.7),
      ...[[53.4, 57.4], [58.0, 63.2]].flatMap(([s0, s1]) => [[15.3, 16.8], [12.9, 14.1], [10.2, 11.6]].flatMap(y => ribbon(s0, s1, y as [number, number], 1.4))),
      ...ribbon(53.4, 63.2, [7.7, 9.1], 1.6), ...ribbon(53.4, 63.2, [5.0, 6.5], 1.6),
    ]},
  ],
  extra: (b, F) => {
    // pale string courses under the salmon front's window rows
    for (const [y] of A_ROWS) ledgeStrip(b, F.f, 5.3, y - 0.12, 9.8, 0.12, 0.06, LEDGE);
    // the two white glazed bay stacks, 0.6 m proud, a pane per storey, a rail on top
    for (const [s0, s1, y0, y1] of [[10.6, 14.7, 4.45, 15.1], [39.8, 42.4, 4.3, 14.7]]) {
      boxBand(b, F, s0, s1, y0, y1, 0.6, 'frame');
      const n = Math.round((y1 - y0) / 2.65), h = (y1 - y0) / n;
      for (let k = 0; k < n; k++) slab(b, F.f, (s0 + s1) / 2, y0 + 0.3 + k * h, s1 - s0 - 0.3, h - 0.6, 0.1, 'glass', 0.6);
      balcony(b, F, s0, s1 - s0, 0.6, y1 + 0.05, {rail: METAL, slab: LEDGE, sides: true});
    }
    // the grey-brown front's two proud brick panels and the canopy over its left shop
    panelEdges(b, F, 20.1, 27.5, 6.1, 16.4, GREYBROWN);
    panelEdges(b, F, 29.8, 37.0, 6.1, 16.4, GREYBROWN);
    boxBand(b, F, 20.4, 29.7, 3.6, 3.8, 1.0, DARK);
    for (const y of [4.3, 6.8, 9.5, 12.0, 14.7]) balcony(b, F, 46.1, 2.8, 1.2, y, {rail: METAL, slab: LEDGE, sides: true});
    // the dark front's grey spandrel panels under its two lower ribbon storeys
    for (const y of [3.95, 6.55]) slab(b, F.f, 58.3, y, 9.8, 1.0, 0.05, SPANDREL);
    longBand(b, F, 0.1, 17.6, 3.6, 3.85, 0.1, DARK);
    longBand(b, F, 39.7, 64.6, 3.7, 3.95, 0.1, DARK);
  },
};

// ---- Rapenburgerstraat (w07, w05, w06, w04, w09: bearing 147-153) --------------------------------------------------
const SMALL: [number, number][] = [[5.2, 6.4], [8.2, 9.5], [11.3, 12.6]];
const W07: Front = {
  tag: 'w07-153', a: [-12.4, 31.09], b: [-2.3, 25.99], n: [0.4505, 0.8928],
  segs: [{s: [0, 11.3], bands: [[3.7, BRICK], [99, RENDER]], wins: [
    ...grid([1.9, 10.05], 1.1, SMALL), ...rows(6.2, 4.6, [[4.3, 6.6], [7.4, 9.7], [10.6, 12.1]], {cols: 3, depth: 0.3}),
    {s: 3.6, w: 4.4, y: [1.8, 3.5], o: {cols: 3}}, door(8.6, 1.8, DARK, 2.8),
  ]}],
  extra: (b, F) => { for (const y of [7.1, 10.4]) balcony(b, F, 3.4, 5.6, 1.3, y, {rail: METAL, slab: LEDGE, sides: true}); },
};
const SE_ROWS: [number, number][] = [[1.3, 3.5], [4.6, 6.1], [7.2, 8.7], [10.0, 11.5], [12.6, 14.0]];
const W05: Front = {
  tag: 'w05-149', a: [-2.56, 25.57], b: [10.04, 18], n: [0.5145, 0.8575],
  segs: [{s: [0, 14.7], bands: [[99, BRICK]], wins: [door(12.4, 1.4, DARK, 2.9), ...grid([2.3, 4.85, 7.45, 10.05], 1.9, SE_ROWS), ...rows(12.8, 1.8, SE_ROWS.slice(1))]}],
  extra: (b, F) => boxBand(b, F, 11.7, 14.6, 2.95, 3.1, 1.2, LEDGE),
};
const W06: Front = {
  tag: 'w06-149', a: [9.76, 17.57], b: [21.82, 10.36], n: [0.5132, 0.8583],
  segs: [
    {s: [0, 10.8], bands: [[3.6, BRICK], [13.5, MAUVE], [99, BRICK]], wins: [tall(3.25, 3.5, [5.0, 11.9]), tall(7.55, 3.4, [5.0, 11.9]), {s: 3.35, w: 3.5, y: [1.3, 3.4], o: {cols: 3}}, {s: 7.45, w: 3.3, y: [1.3, 3.4], o: {cols: 3}}]},
    {s: [10.8, 14.1], bands: [[99, BRICK]], wins: [...rows(12.15, 1.7, [[4.6, 5.9], [7.1, 8.4], [9.6, 10.9], [12.2, 13.5]]), door(11.9, 1.8, DARK, 2.7)]},
  ],
  extra: (b, F) => panelEdges(b, F, 0.05, 10.75, 3.6, 13.5, MAUVE),
};
const W04: Front = {
  tag: 'w04-149', a: [21.57, 9.92], b: [35.93, 1.22], n: [0.5185, 0.8551],
  segs: [
    {s: [0, 11.0], bands: [[3.7, BRICK], [13.5, BLUEGREY], [99, BRICK]], wins: [tall(3.1, 3.6, [5.0, 12.1], 3), tall(7.2, 3.4, [5.0, 12.1], 3), {s: 3.1, w: 3.5, y: [1.3, 3.4], o: {cols: 3}}, {s: 7.2, w: 3.3, y: [1.3, 3.4], o: {cols: 3}}]},
    {s: [11.0, 13.5], bands: [[99, BRICK]], wins: [...rows(12.2, 1.6, [[4.9, 6.2], [7.6, 8.9], [10.3, 11.6], [13.0, 14.3]]), {s: 12.2, w: 1.6, y: [1.3, 3.4]}]},
    {s: [13.5, 16.8], bands: [[3.5, BRICK], [99, PINKGREY]], wins: [...rows(15.3, 1.1, [[5.5, 6.6], [8.2, 9.3], [10.9, 12.0]]), door(15.3, 1.4, DARK, 2.6)]},
  ],
  extra: (b, F) => {
    panelEdges(b, F, 0.05, 11.0, 3.7, 13.5, BLUEGREY);
    for (const s of [2.5, 6.6]) for (const y of [5.0, 7.4, 9.8]) slab(b, F.f, s, y, 1.0, 0.8, 0.04, METAL, 0.05);
  },
};
const W09: Front = {
  tag: 'w09-147', a: [35.65, 0.78], b: [42.4, -3.58], n: [0.5423, 0.8402],
  segs: [{s: [0, 8.0], bands: [[99, ENDBRICK]], wins: [...rows(2.4, 3.6, [[4.4, 6.6], [7.5, 9.7], [10.6, 12.8]], {cols: 2, depth: 0.3}), ...rows(6.15, 1.1, [[5.2, 6.4], [8.1, 9.3], [11.0, 12.2]]), {s: 2.4, w: 2.4, y: [1.3, 3.2], o: {cols: 2}}]}],
  extra: (b, F) => { for (const y of [7.5, 10.6]) balcony(b, F, 0.2, 4.8, 1.3, y, {rail: METAL, slab: LEDGE, sides: true}); },
};

export function buildRapenburgerstraat4(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [NW, W07, W05, W06, W04, W09], wall: BRICK, roof: 'slate', ledge: LEDGE, setbackAbove: 13, setbackColour: GREYBROWN, storey: 2.6, firstSill: 4.6, gridWin: 1.6});
}
