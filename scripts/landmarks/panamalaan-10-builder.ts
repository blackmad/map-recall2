import type {BuildingTools} from './cultural-builders';
import {slab} from './nearbar-kit';
import type {Col, FR} from './modern-front-kit';
import {buildHandBlock, grid, longBand, type Front, type Src, type Win} from './hand-block-kit';
import source from './panamalaan-10-footprints.json';

/**
 * PANAMALAAN 10-186 (Oostelijk Havengebied; BAG pand 0363100012141142, 2001): a 120 m slab of housing over a glazed
 * ground storey of offices and shops, four fronts in four materials (lane hand-blocks-d-20261123). Massing: the 3DBAG
 * LoD2.2 shell (panamalaan-10-footprints.json; one 19.2 m slab with small roof structures), rebuilt wall by wall by
 * hand-block-kit.ts. Fronts read off the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed per wall in
 * panamalaan-10-inventory.json, `s` metres from each crop's left end; storeys every 2.85 m from 4.7 m:
 *  - Panamalaan (w01-270, 2018 and 2025, 26.9 px/m, mostly behind trees): a glazed ground storey in red-brown timber
 *    frames with timber door panels, a brick band, dark slate-grey panel cladding on the three lower housing storeys,
 *    dark brick above, pairs of a wide three-light and a narrow window; at the south end a brick front whose relief
 *    lettering (the poem) runs over the first housing storey;
 *  - the south end (w03-135, 2019): bands of dark timber boarding between continuous ribbons of four-light windows, a
 *    grey panel strip at the stair, the ground storey glazed full height;
 *  - the north end (w04-0, 2020): dark purple-brown brick with punched windows in red-brown frames, two wide ribbon
 *    windows on alternate storeys, a garage door and shop glass on the ground;
 *  - the east return (w05-89, 2020/2022): the same brick, deep-set windows staggered storey to storey, a door and a passage.
 * The courtyard side (w02-90) has no panorama and takes the inferred grid.
 */
const src = source as unknown as Src;

const BRICK: Col = 'brick', PANEL: Col = 'slate', TIMBER: Col = 'ochre', FRAME: Col = 'frame', DOOR: Col = 'bronze', RELIEF: Col = 'greyBrick', GREY: Col = 'concrete';
const FLOORS = Array.from({length: 5}, (_, k) => 4.7 + 2.85 * k);
const ROW = (k: number, sill = 0.45, h = 1.85): [number, number] => [FLOORS[k] + sill, FLOORS[k] + sill + h];
const ALL = FLOORS.map((_, k) => ROW(k));

// ---- Panamalaan (w01-270) ----------------------------------------------------------------------------------------
/** Ground storey: 3.9 m bays of timber-framed glass with a transom, every fourth a timber door/letterbox panel. */
function groundBays(s0: number, s1: number): Win[] {
  const n = Math.round((s1 - s0) / 3.9), p = (s1 - s0) / n;
  return Array.from({length: n}, (_, k) => {
    const s = s0 + p * (k + 0.5);
    return k % 4 === 2 ? {s, w: p - 0.2, y: [0.5, 3.8] as [number, number], o: {depth: 0.15, back: DOOR, frame: FRAME, edge: 0.08, cols: 2}}
      : {s, w: p - 0.2, y: [0.5, 3.8] as [number, number], o: {depth: 0.15, frame: FRAME, edge: 0.08, cols: 2, bars: [2.55]}};
  });
}
/** Upper storeys: a wide three-light and a narrow window per 5.9 m bay. */
function upperBays(s0: number, s1: number, rows: [number, number][]): Win[] {
  const out: Win[] = [];
  for (let s = s0; s + 5.0 < s1; s += 5.9) out.push(...grid([s + 2.0], 3.4, rows, {cols: 3, frame: FRAME, edge: 0.07, depth: 0.2}), ...grid([s + 4.75], 1.2, rows, {frame: FRAME, edge: 0.07, depth: 0.2}));
  return out;
}
const W01: Front = {
  tag: 'w01-270', a: [-14.14, -43.67], b: [-13.25, 76.28], n: [-1, 0.0074],
  segs: [
    {s: [0, 80], bands: [[0.45, BRICK], [3.9, FRAME], [4.7, BRICK], [FLOORS[3] - 0.1, PANEL], [99, BRICK]], wins: [...groundBays(0, 80), ...upperBays(0.4, 80, ALL)]},
    {s: [80, 120], bands: [[0.45, BRICK], [3.9, FRAME], [99, BRICK]], wins: [...groundBays(80, 120), ...upperBays(80.4, 120, ALL)]},
  ],
  extra: (b, F) => {
    longBand(b, F, 0, F.len, 3.9, 4.1, 0.12, GREY);
    poem(b, F);
  },
};
/**
 * The relief poem (w01 2025, s 109.7-118.1, 7.4-8.1 m): raised lettering in the brick over the first housing storey's
 * windows. No cached panorama reads the words (leaves in 2018 and 2025), so it is drawn as one line of illegible raised
 * word blocks at the measured place and size: the line and its rhythm, not the text.
 */
function poem(b: BuildingTools, F: FR) {
  const words = [0.55, 1.1, 0.35, 0.8, 1.25, 0.45, 0.9, 0.6, 1.05, 0.4];
  let s = 109.7;
  for (const w of words) {
    if (s + w > 118.1) break;
    slab(b, F.f, s + w / 2, 7.5, w, 0.42, 0.05, RELIEF, 0);
    s += w + 0.28;
  }
}

// ---- south end (w03-135) -----------------------------------------------------------------------------------------
const W03: Front = {
  tag: 'w03-135', a: [-13.25, 76.28], b: [2.99, 59.81], n: [0.7121, 0.702],
  segs: [{s: [0, 23.14], bands: [[0.45, TIMBER], [3.9, FRAME], [99, TIMBER]], wins: [
    ...[0.35, 4.15, 7.95, 11.75, 15.55, 19.35].map(s => ({s: s + 1.85, w: 3.6, y: [0.5, 3.85] as [number, number], o: {depth: 0.15, frame: FRAME, edge: 0.08, cols: 2, bars: [2.4]}})),
    ...grid([2.05, 5.3, 8.7, 13.4, 16.75, 20.6], 3.15, FLOORS.map(f => [f + 0.4, f + 2.4] as [number, number]), {cols: 4, frame: FRAME, edge: 0.07, depth: 0.15, bars: [1.55]}),
  ]}],
  extra: (b, F) => {
    // the grey panel strip at the stair (s 10.7-11.6) and a timber board course over each window ribbon
    slab(b, F.f, 11.15, 4.7, 0.9, 14.2, 0.14, GREY, 0);
    for (const f of FLOORS) longBand(b, F, 0, F.len, f + 2.45, f + 2.6, 0.06, TIMBER);
  },
};

// ---- north end (w04-0) -------------------------------------------------------------------------------------------
const P1: Win['o'] = {frame: FRAME, edge: 0.07, depth: 0.2};
const W04: Front = {
  tag: 'w04-0', a: [2.68, -43.79], b: [-14.14, -43.67], n: [-0.007, -1],
  segs: [{s: [0, 16.82], bands: [[99, BRICK]], wins: [
    {s: 3.25, w: 4.5, y: [0.6, 2.7], o: {depth: 0.2, back: 'dark', edge: 0}},
    {s: 11.3, w: 9.8, y: [0.6, 4.4], o: {depth: 0.15, frame: FRAME, edge: 0.08, cols: 4, bars: [2.6]}},
    // storey 1, 3 and 5: punched windows
    ...grid([2.35], 0.9, [ROW(0, 0.4, 2.1), ROW(4, 0.4, 2.1)], P1),
    ...grid([4.6], 1.75, [ROW(0, 0.4, 2.1)], {...P1, cols: 2}), ...grid([5.0], 0.9, [ROW(2, 0.4, 2.1), ROW(4, 0.4, 2.1)], P1),
    ...grid([7.7], 1.0, [ROW(0, 0.4, 2.1)], P1), ...grid([7.25], 1.7, [ROW(2, 0.4, 2.1), ROW(4, 0.4, 2.1)], {...P1, cols: 2}),
    ...grid([9.95], 1.7, [ROW(0, 0.4, 2.1)], {...P1, cols: 2}), ...grid([10.35], 0.9, [ROW(2, 0.4, 2.1), ROW(4, 0.4, 2.1)], P1),
    ...grid([1.9], 1.6, [ROW(2, 0.4, 2.1)], {...P1, cols: 2}),
    // storeys 2 and 4: a narrow window, a pair, and the wide ribbon from s 6.4
    ...grid([2.35], 0.9, [ROW(1, 0.45, 2.0), ROW(3, 0.45, 2.0)], P1), ...grid([4.55], 1.75, [ROW(1, 0.45, 2.0), ROW(3, 0.45, 2.0)], {...P1, cols: 2}),
    ...grid([11.1], 9.4, [ROW(1, 0.45, 2.0), ROW(3, 0.45, 2.0)], {...P1, cols: 4}),
  ]}],
};

// ---- east return (w05-89) ----------------------------------------------------------------------------------------
const W05: Front = {
  tag: 'w05-89', a: [2.72, -27.54], b: [2.55, -43.56], n: [0.9999, -0.0108],
  segs: [{s: [0, 16.02], bands: [[99, BRICK]], wins: [
    {s: 7.2, w: 1.2, y: [0.1, 2.6], o: {depth: 0.35, back: 'dark', edge: 0}},
    {s: 14.7, w: 1.9, y: [0.1, 4.2], o: {depth: 1.2, back: 'dark', edge: 0}},
    ...grid([1.5, 4.6, 10.3], 1.35, [[0.8, 3.6]], {...P1, depth: 0.35, bars: [2.3]}),
    ...FLOORS.flatMap((_, k) => grid(k % 2 ? [3.0, 9.0, 12.8] : [1.5, 6.4, 11.4], k % 2 ? 1.0 : 1.4, [ROW(k, 0.35, 2.0)], {...P1, depth: 0.35, ...(k % 2 ? {} : {cols: 2})})),
  ]}],
};

export function buildPanamalaan10(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [W01, W03, W04, W05], wall: BRICK, roof: 'slate', ledge: GREY, setbackAbove: 17, storey: 2.85, firstSill: 5.15, gridWin: 1.4, defaults: {edge: 0}, gridDefaults: {edge: 0.06}});
}
