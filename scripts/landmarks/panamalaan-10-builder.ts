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

const STRIP: Col = 'stone', BRICK: Col = 'brick', PANEL: Col = 'slate', TIMBER: Col = 'ochre', FRAME: Col = 'frame', DOOR: Col = 'bronze', RELIEF: Col = 'greyBrick', GREY: Col = 'concrete';
const FLOORS = Array.from({length: 5}, (_, k) => 4.7 + 2.85 * k);
/**
 * Frames (lane hand-blocks-e-20261123): the photos show heavy red-brown timber frames, ~12 cm outer frame and ~9 cm
 * mullions and transoms (w03 2019 and w05 2020 crops at 50 px/m), where round d drew 7 cm frames and 6 cm bars.
 */
const HEAVY = {frame: FRAME, edge: 0.12, bar: 0.09} as const;
const ROW = (k: number, sill = 0.45, h = 1.85): [number, number] => [FLOORS[k] + sill, FLOORS[k] + sill + h];
const ALL = FLOORS.map((_, k) => ROW(k));

// ---- Panamalaan (w01-270) ----------------------------------------------------------------------------------------
/** Ground storey: 3.9 m bays of timber-framed glass with a transom, every fourth a timber door/letterbox panel. */
function groundBays(s0: number, s1: number): Win[] {
  const n = Math.round((s1 - s0) / 3.9), p = (s1 - s0) / n;
  return Array.from({length: n}, (_, k) => {
    const s = s0 + p * (k + 0.5);
    return k % 4 === 2 ? {s, w: p - 0.2, y: [0.5, 3.8] as [number, number], o: {depth: 0.15, back: DOOR, ...HEAVY, cols: 2}}
      : {s, w: p - 0.2, y: [0.5, 3.8] as [number, number], o: {depth: 0.15, ...HEAVY, cols: 2, bars: [2.55]}};
  });
}
/**
 * Upper storeys (2025 crop w01-270.alt, 26.9 px/m, s 43-98 clear of the trees): an 11.0 m rhythm of a wide five-light
 * window (4.6 m) and two narrow two-light windows (1.85 m), centres at W, W + 4.13 and W + 6.88 m, W = -0.7 + 11k; each
 * 2.15 m tall with a transom 0.55 m over the sill.
 */
function upperBays(s0: number, s1: number, rows: [number, number][]): Win[] {
  const out: Win[] = [], o = {depth: 0.14, ...HEAVY, bars: [0.55]};
  for (let c = -0.7; c < s1 + 4; c += 11.0) {
    for (const [d, w, cols] of [[0, 4.6, 5], [4.13, 1.85, 2], [6.88, 1.85, 2]] as const) {
      const m = c + d;
      if (m - w / 2 >= s0 && m + w / 2 <= s1) out.push(...grid([m], w, rows, {...o, cols}));
    }
  }
  return out;
}
const UP = FLOORS.map((_, k) => ROW(k, 0.35, 2.15));
/** The slate-grey panel cladding covers housing storeys 1-4 from the north end to s 98 (2025 crop); the top storey, the
 * band over the ground storey and the south end (s 98-120) are brick. */
const PANEL_END = 98;
const W01: Front = {
  tag: 'w01-270', a: [-14.14, -43.67], b: [-13.25, 76.28], n: [-1, 0.0074],
  segs: [
    {s: [0, PANEL_END], bands: [[0.45, BRICK], [3.9, FRAME], [4.7, BRICK], [FLOORS[4] - 0.1, PANEL], [99, BRICK]], wins: [...groundBays(0, PANEL_END), ...upperBays(0.4, PANEL_END, UP)]},
    {s: [PANEL_END, 120], bands: [[0.45, BRICK], [3.9, FRAME], [99, BRICK]], wins: [...groundBays(PANEL_END, 120), ...upperBays(PANEL_END + 0.4, 120, UP)]},
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
    slab(b, F.f, s + w / 2, 7.28, w, 0.42, 0.05, RELIEF, 0);
    s += w + 0.28;
  }
}

// ---- south end (w03-135) -----------------------------------------------------------------------------------------
/**
 * Round e: the ribbons run unbroken along each storey, cut only by the grey panel strip at the stair (s 10.7-11.56):
 * left ribbon s 0.6-10.7 (11 lights), right ribbon s 11.56-22.7 (12 lights), each 1.95 m tall from 0.1 m over the storey
 * line with a transom 0.5 m over the sill (2019 crop, 50 px/m). Between them a 0.9 m course of timber boarding stands
 * proud of the glazing line, so its lower edge throws the shadow line the photo shows over every ribbon.
 */
const RIB = (k: number): [number, number] => [FLOORS[k] + 0.1, FLOORS[k] + 2.05];
const W03: Front = {
  tag: 'w03-135', a: [-13.25, 76.28], b: [2.99, 59.81], n: [0.7121, 0.702],
  segs: [{s: [0, 23.14], bands: [[0.45, TIMBER], [3.9, FRAME], [99, TIMBER]], wins: [
    ...[0.35, 4.15, 7.95, 11.75, 15.55, 19.35].map(s => ({s: s + 1.85, w: 3.6, y: [0.5, 3.85] as [number, number], o: {depth: 0.15, ...HEAVY, cols: 2, bars: [2.4]}})),
    ...FLOORS.flatMap((_, k) => [
      {s: 5.65, w: 10.1, y: RIB(k), o: {depth: 0.15, ...HEAVY, cols: 11, bars: [0.5]}},
      {s: 17.13, w: 11.14, y: RIB(k), o: {depth: 0.15, ...HEAVY, cols: 12, bars: [0.5]}},
    ]),
  ]}],
  extra: (b, F) => {
    // the grey panel strip at the stair (s 10.7-11.56) and the proud timber course between the ribbons
    slab(b, F.f, 11.13, 4.7, 0.86, 14.2, 0.2, STRIP, 0);
    for (const f of FLOORS) {
      // the top course stops under the coping (19.0 m)
      const top = Math.min(f + 2.95, 18.9);
      longBand(b, F, 0.4, 10.7, f + 2.05, top, 0.1, TIMBER);
      longBand(b, F, 11.56, F.len, f + 2.05, top, 0.1, TIMBER);
    }
  },
};

// ---- north end (w04-0) -------------------------------------------------------------------------------------------
// the frames sit near the wall face (w04 2021 crop: a ~10 cm reveal), so they read against the brick
const P1: Win['o'] = {...HEAVY, depth: 0.13};
const W04: Front = {
  tag: 'w04-0', a: [2.68, -43.79], b: [-14.14, -43.67], n: [-0.007, -1],
  segs: [{s: [0, 16.82], bands: [[99, BRICK]], wins: [
    {s: 3.25, w: 4.5, y: [0.6, 2.7], o: {depth: 0.2, back: 'dark', edge: 0}},
    {s: 11.3, w: 9.8, y: [0.6, 4.4], o: {depth: 0.15, ...HEAVY, cols: 4, bars: [2.6]}},
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
