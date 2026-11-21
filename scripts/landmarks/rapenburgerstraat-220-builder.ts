import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab} from './nearbar-kit';
import {balcony, type Col} from './modern-front-kit';
import {boxBand, buildHandBlock, door, grid, longBand, panelEdges, ribbon, rows, shop, type Front, type Src} from './hand-block-kit';
import source from './rapenburgerstraat-220-footprints.json';

/**
 * RAPENBURGERSTRAAT 220-326 (+ Valkenburgerstraat; BAG pand 0363100012165616, 1998): a courtyard housing block whose long
 * walls are rows of fronts in different hands (lane hand-blocks-a-20261121, routed to hand by
 * docs/reports/block-sized-triage-20261121.md, rank 11). Massing: the 3DBAG LoD2.2 shell (rapenburgerstraat-220-footprints.json,
 * bag-shell-prepare.ts), rebuilt wall by wall by hand-block-kit.ts. Fronts are measured off the rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0) listed per wall in rapenburgerstraat-220-inventory.json; `s` is metres from the crop's left end,
 * heights over the panorama's street line:
 *  - Rapenburgerstraat (w04-147, 2023 crop at 44.5 px/m): red-brown brick with two proud render panels, mauve and grey, each
 *    holding two tall gridded windows over a raised ground floor, a white rendered corner with a stack of mesh balconies, a
 *    row of small windows over the panels and a deep eaves slab;
 *  - its SW end (w05-146, 2024, 50 px/m): the second white rendered corner with its balcony stack, then four bays of punched
 *    brick windows under the eaves slab;
 *  - Valkenburgerstraat (w01-329, 2022, 35.9 px/m): a salmon brick front with loggias and a glazed bay stack, the grey-brown
 *    brick middle with two proud brick panels and a glazed stair slot over shops, a red-brown front with a balcony stack and a
 *    dark grey brick front with two ribbon storeys, shops along the whole ground floor.
 * The NE and SW courtyard walls (w02-57, w03-238) have no panorama: inferred brick window grid.
 */
const src = source as unknown as Src;

const BRICK: Col = 'brick', MAUVE: Col = 'pink', GREYPANEL: Col = 'concrete', RENDER: Col = 'stone', SALMON: Col = 'red';
const GREYBROWN: Col = 'greyBrick', REDBROWN: Col = 'ochre', DARKBRICK: Col = 'blue', LEDGE: Col = 'sandstone', DARK: Col = 'dark', METAL: Col = 'bronze';

const SE_ROWS: [number, number][] = [[4.7, 6.0], [7.2, 8.5], [9.7, 11.0], [12.3, 13.5]];
const TOP: [number, number][] = [[12.85, 13.6]];
const tall = (s: number, w: number, y: [number, number]) => ({s, w, y, o: {cols: 2, rows: 4, depth: 0.45}});

const SE: Front = {
  tag: 'w04-147', a: [-5, 21.72], b: [30.34, -1.19], n: [0.544, 0.8391],
  segs: [
    {s: [0, 3.7], bands: [[99, BRICK]], wins: [...grid([0.62, 2.9], 1.15, SE_ROWS), {s: 1.6, w: 2.8, y: [0.7, 3.1], o: {depth: 0.9, back: DARK, edge: 0}}]},
    {s: [3.7, 15.0], bands: [[3.6, BRICK], [12.7, MAUVE], [99, BRICK]], wins: [
      tall(7.2, 3.4, [4.9, 11.5]), tall(11.45, 3.5, [4.9, 11.5]),
      ...grid([6.1, 8.5, 11.3, 13.75], 1.7, TOP),
      {s: 7.95, w: 3.3, y: [1.4, 3.45], o: {cols: 3}}, {s: 11.9, w: 3.2, y: [1.4, 3.45], o: {cols: 3}},
    ]},
    {s: [15.0, 17.8], bands: [[99, BRICK]], wins: [...rows(16.45, 1.6, [[4.7, 6.0], [7.2, 8.5], [9.7, 11.0], [12.3, 13.5]]), door(16.3, 1.1, DARK, 2.7)]},
    {s: [17.8, 28.1], bands: [[3.6, BRICK], [12.6, GREYPANEL], [99, BRICK]], wins: [
      tall(21.1, 3.4, [4.7, 11.3]), tall(24.9, 3.3, [4.7, 11.3]),
      ...grid([19.25, 21.65, 24.1, 26.35], 1.75, TOP),
      {s: 21.1, w: 3.4, y: [1.4, 3.45], o: {cols: 3}}, {s: 24.6, w: 3.2, y: [1.4, 3.45], o: {cols: 3}},
    ]},
    {s: [28.1, 30.2], bands: [[99, BRICK]], wins: [...rows(29.1, 1.5, SE_ROWS.slice(0, 3)), {s: 29.0, w: 1.5, y: [1.5, 3.3]}]},
    {s: [30.2, 42.2], bands: [[3.6, BRICK], [12.4, RENDER], [99, BRICK]], wins: [
      ...grid([32.4], 1.0, [[4.7, 5.7], [7.2, 8.2], [9.7, 10.7]]), ...grid([40.1], 1.4, [[4.7, 5.7], [7.2, 8.2], [9.7, 10.7]]),
      ...rows(36.8, 5.0, [[3.9, 6.2], [6.8, 9.1], [9.7, 11.9]], {cols: 3, depth: 0.3}),
      ...grid([31.7, 34.1], 1.75, TOP),
      door(32.4, 2.0, DARK, 2.9), {s: 36.7, w: 2.9, y: [1.5, 3.4], o: {cols: 2}},
    ]},
  ],
  extra: (b, F) => {
    panelEdges(b, F, 3.7, 15.0, 3.6, 12.7, MAUVE);
    panelEdges(b, F, 17.8, 28.1, 3.6, 12.6, GREYPANEL);
    // French rails across the tall panel windows
    for (const [s, w] of [[7.2, 3.4], [11.45, 3.5], [21.1, 3.4], [24.9, 3.3]]) for (const y of [5.9, 8.6, 11.2]) ledgeStrip(b, F.f, s, y, w, 0.05, 0.04, METAL, 0.12);
    for (const y of [6.6, 9.4]) balcony(b, F, 33.8, 6.1, 1.3, y, {rail: METAL, slab: LEDGE, sides: true});
    // the deep eaves slab over the brick and panels, top 5 cm over the 3DBAG roof line
    longBand(b, F, -0.2, 36.6, 14.55, 14.95, 0.9, LEDGE);
  },
};

const SW: Front = {
  tag: 'w05-146', a: [-24.04, 34.06], b: [-5.28, 21.29], n: [0.5624, 0.8269],
  segs: [
    {s: [0, 11.1], bands: [[3.3, BRICK], [99, RENDER]], wins: [
      ...grid([1.95], 0.9, [[4.4, 5.4], [7.2, 8.1], [9.8, 10.8], [12.5, 13.5]]), ...grid([9.4], 1.0, [[4.4, 5.4], [7.2, 8.1], [9.8, 10.8], [12.5, 13.5]]),
      ...rows(5.2, 4.6, [[4.4, 6.4], [7.3, 9.3], [10.3, 12.3], [13.1, 14.1]], {cols: 3, depth: 0.3}),
      {s: 4.2, w: 3.2, y: [1.6, 3.1], o: {cols: 2, depth: 0.6}}, door(9.5, 2.4, DARK, 2.4), {s: 7.0, w: 0.8, y: [2.3, 3.1]},
    ]},
    {s: [11.1, 22.8], bands: [[99, BRICK]], wins: [...grid([13.35, 15.95, 18.55, 21.15], 1.9, [[1.0, 3.0], [4.2, 5.7], [6.8, 8.3], [9.5, 10.9], [12.1, 13.6]])]},
  ],
  extra: (b, F) => {
    for (const y of [6.6, 9.6, 12.5]) balcony(b, F, 2.4, 5.6, 1.3, y, {rail: METAL, slab: LEDGE, sides: true});
    longBand(b, F, 11.1, 22.9, 14.55, 14.95, 0.9, LEDGE);
  },
};

const SWEND: Front = {
  tag: 'w06-237', a: [-30.37, 24.32], b: [-24.04, 34.06], n: [-0.8383, 0.5452],
  segs: [{s: [0, 11.6], bands: [[3.3, BRICK], [99, RENDER]], wins: [...grid([2.6, 8.9], 1.0, [[4.4, 5.4], [7.2, 8.1], [9.8, 10.8], [12.5, 13.5]])]}],
};

// ---- Valkenburgerstraat (w01-329, 2022-06-24) ----------------------------------------------------------------------
const NW_ROWS: [number, number][] = [[5.1, 6.4], [7.6, 8.9], [10.1, 11.4], [12.7, 14.0], [15.3, 16.6]];
const NW: Front = {
  tag: 'w01-329', a: [0.89, -46.64], b: [-54.5, -12.9], n: [-0.5202, -0.854],
  segs: [
    {s: [0, 4.2], bands: [[3.7, DARK], [99, LEDGE]], wins: [shop(2.1, 3.6, [0.4, 3.4]), ...rows(2.4, 3.0, [[4.6, 6.4], [7.2, 9.0], [9.8, 11.6], [12.4, 14.2]], {cols: 2, depth: 0.5})]},
    {s: [4.2, 19.0], bands: [[3.75, DARK], [99, SALMON]], wins: [
      shop(6.6, 3.8, [0.4, 3.5]), shop(12.6, 4.6, [0.4, 3.5]), shop(17.2, 2.6, [0.4, 3.5]),
      ...rows(7.75, 2.9, [[4.6, 6.4], [7.2, 9.0], [9.8, 11.6], [12.4, 13.9]], {cols: 2, depth: 0.9}),
      ...rows(17.7, 1.5, [[5.1, 6.4], [7.6, 8.9], [10.1, 11.4]]),
    ]},
    {s: [19.0, 38.5], bands: [[3.75, DARK], [99, GREYBROWN]], wins: [
      shop(25.1, 5.6, [0.4, 3.5]), shop(34.9, 5.6, [0.4, 3.5]), door(29.65, 1.1, DARK, 3.2),
      ...grid([25.1, 34.25], 3.6, [[7.2, 9.0], [10.4, 11.9], [13.1, 14.6]], {cols: 3}),
      ...ribbon(22.3, 27.9, [4.0, 5.9], 1.9), ...ribbon(32.0, 37.7, [4.6, 6.3], 1.9), ...ribbon(22.3, 27.9, [15.9, 16.6], 1.9),
      ...rows(29.65, 1.2, [[6.4, 10.6]], {bars: [1.4, 2.8]}), ...rows(29.65, 1.2, [[12.7, 15.2]], {bars: [1.25]}), ...rows(29.65, 1.2, [[15.9, 17.0]]),
      ...grid([20.5, 37.85], 0.75, [[5.1, 6.4], [7.6, 8.9], [13.0, 14.2], [15.6, 16.9]]),
    ]},
    {s: [38.5, 50.5], bands: [[3.75, DARK], [99, REDBROWN]], wins: [
      shop(48.4, 4.2, [0.4, 3.5]), {s: 44.5, w: 1.4, y: [0.4, 3.4], o: {depth: 0.2, back: METAL}},
      ...rows(44.5, 1.4, NW_ROWS), ...rows(41.8, 1.8, [[4.3, 8.9]], {rows: 2}), ...rows(41.8, 1.8, [[10.1, 11.4], [12.7, 14.0], [15.3, 16.6]]),
      ...rows(47.5, 1.3, [[5.4, 6.9], [8.0, 9.5], [10.6, 12.1], [13.2, 14.7]], {depth: 0.3}),
    ]},
    {s: [50.5, 64.9], bands: [[3.9, DARK], [99, DARKBRICK]], wins: [
      shop(53.0, 4.2, [0.4, 3.6]), shop(57.5, 4.2, [0.4, 3.6]), shop(62.0, 4.2, [0.4, 3.6]),
      ...ribbon(53.1, 62.5, [5.1, 6.3], 1.6), ...ribbon(53.1, 62.5, [7.6, 8.8], 1.6),
      ...grid([51.0, 53.3, 56.2, 59.0, 61.8], 1.5, [[10.1, 11.4], [12.7, 14.0], [15.3, 16.6], [17.9, 19.0]]),
    ]},
  ],
  extra: (b, F) => {
    // the salmon front's glazed bay stack, 0.6 m proud, one pane per storey
    boxBand(b, F, 12.1, 16.2, 4.3, 12.0, 0.6, 'frame');
    for (const [y0, y1] of [[4.5, 6.4], [7.1, 9.0], [9.7, 11.8]]) slab(b, F.f, 14.15, y0, 3.7, y1 - y0, 0.1, 'glass', 0.6);
    // the grey-brown front's two proud brick panels
    panelEdges(b, F, 21.3, 28.5, 6.1, 16.0, GREYBROWN);
    panelEdges(b, F, 30.7, 37.5, 6.1, 16.0, GREYBROWN);
    // balcony stacks: the gallery at the corner and the red-brown front's
    for (const y of [4.4, 6.9, 9.5, 12.1]) balcony(b, F, 0.2, 3.8, 1.2, y, {rail: METAL, slab: LEDGE, sides: true});
    for (const y of [4.7, 7.2, 9.8, 12.4]) balcony(b, F, 46.2, 2.6, 1.2, y, {rail: METAL, slab: LEDGE, sides: true});
    // shop fascias and the canopy over the grey-brown shops
    longBand(b, F, 0.1, 19.0, 3.5, 3.75, 0.1, DARK);
    boxBand(b, F, 22.0, 28.2, 3.5, 3.7, 1.0, DARK);
    longBand(b, F, 50.5, 64.8, 3.6, 3.9, 0.1, DARK);
  },
};

export function buildRapenburgerstraat220(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [SE, SW, SWEND, NW], wall: BRICK, roof: 'slate', ledge: LEDGE, setbackAbove: 13, setbackColour: GREYBROWN, storey: 2.55, firstSill: 4.7, gridWin: 1.6});
}
