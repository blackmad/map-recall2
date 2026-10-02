// Measured fronts for landmarks known by their elevation. Dimensions are read off
// rectified Gemeente Amsterdam street panoramas (public/data/landmark-facades/*.jpg),
// which are drawing references only: no pixels are used. x runs along the wall from
// its start, z up from the pavement, both in metres.
import { arch, type Front, type FrontBox } from './landmarkFronts.js';

const span = (xs: number[], half: number) => xs.flatMap(x => [x - half, x + half]);

// Bijenkorf, Damrak: five window bays between stone pilasters, a deep main cornice,
// an attic storey and the arched pediment over its centre.
const BIJ = { stone: '#b39a88', pier: '#cbb6a3', cornice: '#c2ab98', glass: '#4b5561', iron: '#56625c', bronze: '#5a3a30' };
const BIJ_BAYS = [3.1, 8.1, 13.2, 18.1, 22.9];
const BIJ_SHOPS: [number, number][] = [[1.1, 4.9], [6.25, 10], [11.4, 15], [16.4, 20], [21.3, 24.9]];
export const BIJENKORF: Front = {
  name: 'Bijenkorf',
  ids: ['w751235773', 'w751235775', 'w751235776', 'w751128373'],
  start: [4.893856597014285, 52.37348990232792], end: [4.893608397018061, 52.37330680232445],
  depthM: 0.4, hex: BIJ.stone, bodyTopM: 23.6,
  outline: [[0, 23.6], [4.75, 23.6], [4.75, 29.3], ...arch(5.4, 21.1, 29.3, 3.2, 10), [21.25, 29.3], [21.25, 23.6], [26.45, 23.6]],
  boxes: [
    // The attic storey and pediment stand on the body as a block 8 m deep.
    { x0: 4.75, x1: 21.25, z0: 23.2, z1: 29.3, out0: -8.4, out1: 0, hex: BIJ.stone },
    // Ground floor: shopfronts between stone piers, a fascia above.
    ...BIJ_SHOPS.flatMap(([x0, x1]): FrontBox[] => [
      { x0: x0 - 0.15, x1: x1 + 0.15, z0: 0.9, z1: 5.05, out0: -0.05, out1: 0.03, hex: BIJ.bronze },
      { x0, x1, z0: 1.05, z1: 4.9, out0: -0.05, out1: 0.06, hex: BIJ.glass },
    ]),
    { x0: 0, x1: 26.45, z0: 5.7, z1: 6.8, out1: 0.45, hex: BIJ.cornice },
    // Stone pilasters through the three main storeys.
    ...[0.55, 5.4, 10.6, 15.8, 20.9, 25.9].map(x => ({ x0: x - 0.55, x1: x + 0.55, z0: 6.8, z1: 18.6, out1: 0.3, hex: BIJ.pier })),
    // Main cornice: frieze, corona, and the deep overhang over the centre.
    { x0: 0, x1: 26.45, z0: 18.6, z1: 19.6, out1: 0.4, hex: BIJ.cornice },
    { x0: 0, x1: 26.45, z0: 19.6, z1: 20.7, out1: 0.9, hex: BIJ.cornice },
    { x0: 3, x1: 23.3, z0: 20.7, z1: 22, out1: 1.5, hex: BIJ.pier },
    // Attic: piers between three bays, balustrades on the low wings.
    ...[5.3, 10.9, 15.6, 20.7].map(x => ({ x0: x - 0.55, x1: x + 0.55, z0: 22, z1: 26.3, out1: 0.35, hex: BIJ.pier })),
    { x0: 0.2, x1: 4.75, z0: 22, z1: 23.3, out1: 0.25, hex: BIJ.pier },
    { x0: 21.25, x1: 26.2, z0: 22, z1: 23.3, out1: 0.25, hex: BIJ.pier },
    // Upper cornice under the pediment, flaring out.
    { x0: 4.1, x1: 22.3, z0: 26.3, z1: 27.6, out1: 0.6, hex: BIJ.cornice },
    { x0: 3.25, x1: 23.1, z0: 27.6, z1: 29.3, out1: 1.1, hex: BIJ.pier },
    { x0: 11.6, x1: 14.8, z0: 26.3, z1: 28.6, out1: 0.75, hex: BIJ.pier },
    // Balconies on the centre bay.
    { x0: 11.4, x1: 15, z0: 6.5, z1: 7.3, out1: 0.9, hex: BIJ.iron },
    { x0: 11.6, x1: 14.8, z0: 10.2, z1: 10.8, out1: 0.8, hex: BIJ.iron },
    { x0: 11.6, x1: 14.8, z0: 14.1, z1: 14.6, out1: 0.8, hex: BIJ.iron },
  ],
  windows: [
    { xs: span(BIJ_BAYS, 0.68), rows: [[7.4, 9.6], [10.9, 13.2], [14.7, 16.3]], w: 1.05, hex: BIJ.glass },
    { xs: span([8.1, 13.2, 18.1], 0.6), rows: [[22.6, 24]], w: 0.95, hex: BIJ.glass },
  ],
};

// Beurs van Berlage, the Beursplein hall wall: three brick storeys under a stone
// band, a row of small stepped gables, and a basement of half-sunk windows.
const BEURS = { brick: '#9a5240', stone: '#d4c8b2', glass: '#45474a' };
const BEURS_COLS = Array.from({ length: 13 }, (_, i) => 1.3 + i * 3.47);
const BEURS_GABLES = [2.7, 10.2, 17.5, 24.7, 31.7, 38.7];
export const BEURS_BEURSPLEIN: Front = {
  name: 'Beurs van Berlage',
  // The game tiles split the Beursplein hall into 642 and 645; the raw extract has it as 641.
  ids: ['w749918642', 'w749918645', 'w749918641'],
  start: [4.895897096981563, 52.37509780235795], end: [4.895497396988156, 52.37477130235189],
  depthM: 0.3, hex: BEURS.brick,
  outline: [[0, 15.4], ...BEURS_GABLES.flatMap(c => [[c - 2.1, 15.4], [c - 0.5, 17.2], [c + 0.5, 17.2], [c + 2.1, 15.4]] as [number, number][]), [45.4, 15.4]],
  boxes: [
    { x0: 0, x1: 45.4, z0: 14.6, z1: 15.5, out1: 0.3, hex: BEURS.stone },
    { x0: 0, x1: 45.4, z0: 2.9, z1: 3.2, out1: 0.15, hex: BEURS.stone },
    ...BEURS_GABLES.map(c => ({ x0: c - 2.25, x1: c + 2.25, z0: 15.4, z1: 15.7, out1: 0.25, hex: BEURS.stone })),
  ],
  windows: [
    { xs: BEURS_COLS, rows: [[11, 13], [7.7, 9.7], [4.2, 5.8]], w: 1.9, hex: BEURS.glass, frameHex: BEURS.stone },
    { xs: BEURS_COLS, rows: [[0.8, 1.8]], w: 1.5, hex: BEURS.glass, frameHex: BEURS.stone },
    { xs: BEURS_GABLES, rows: [[15.9, 16.7]], w: 0.5, hex: BEURS.glass, frameHex: BEURS.stone },
  ],
};


// Royal Palace, the Dam front: a seven-bay risalit under a pediment, between wings of five
// bays; two main storeys each with a mezzanine row, a rusticated ground floor with the
// seven small entrance arches. Sandstone, weathered grey-brown. OSM maps the risalit as its
// own part (w748659170) standing 5 m forward of the wings, so it is a slab of its own there;
// the rectified photo shows it ~18% too wide (it is nearer the camera than the wall plane),
// so its features are mapped from the photo's 21.8-51.6 m onto OSM's 22-47.2 m.
const PAL = { stone: '#a39a8b', pier: '#b3aa9a', cornice: '#bdb4a3', glass: '#3e4248', frame: '#d6d1c4', dark: '#2c2a28' };
const PAL_WING = [3.6, 8.2, 11.6, 15, 18.4, 52, 55.4, 58.6, 62, 66];
const PAL_OUT = 5;
const rx = (x: number) => 22 + ((x - 21.8) * 25.2) / 29.8;
const PAL_CENTRE = [24.8, 28.8, 32.8, 36.6, 40.6, 44.6, 48.4].map(rx);
export const ROYAL_PALACE_DAM: Front = {
  name: 'Royal Palace',
  ids: ['w748659172', 'w748659181'],
  // The photo's skyline is the wings' slate roofs (the kit's) and the pediment, cut by the crop.
  roofline: 'front-only',
  start: [4.891730097030566, 52.37283230231148], end: [4.891761497019604, 52.37344440232049],
  depthM: 0.4, hex: PAL.stone,
  outline: [[0, 26.9], [68.1, 26.9]],
  slabs: [{ outline: [[22, 30.7], [34.6, 36.2], [47.2, 30.7]], out0: 0, out1: PAL_OUT + 0.3, hex: PAL.stone }],
  boxes: [
    // Risalit: pilasters and its own cornices, on its front face.
    ...[21.8, 26, 30.2, 34.2, 38.2, 42.2, 46.4, 50.6].map(x => ({ x0: rx(x) - 0.15, x1: rx(x) + 0.65, z0: 5.1, z1: 29.5, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.6, hex: PAL.pier })),
    { x0: 21.6, x1: 47.6, z0: 16.6, z1: 18.1, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.9, hex: PAL.cornice },
    { x0: 21.6, x1: 47.6, z0: 29.4, z1: 30.8, out0: PAL_OUT + 0.3, out1: PAL_OUT + 1.1, hex: PAL.cornice },
    { x0: 22, x1: 47.2, z0: 0, z1: 5.1, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.5, hex: PAL.pier },
    // The seven entrance arches (dark openings) in the risalit's ground floor.
    ...PAL_CENTRE.map(x => ({ x0: x - 0.7, x1: x + 0.7, z0: 0, z1: 3.6, out0: PAL_OUT + 0.5, out1: PAL_OUT + 0.55, hex: PAL.dark })),
    // Wings: rusticated ground floor, cornices.
    { x0: 0, x1: 22, z0: 0, z1: 5.1, out1: 0.3, hex: PAL.pier }, { x0: 47.2, x1: 68.1, z0: 0, z1: 5.1, out1: 0.3, hex: PAL.pier },
    { x0: 0, x1: 22, z0: 15.1, z1: 15.7, out1: 0.5, hex: PAL.cornice }, { x0: 47.2, x1: 68.1, z0: 15.1, z1: 15.7, out1: 0.5, hex: PAL.cornice },
    { x0: 0, x1: 22, z0: 25.7, z1: 26.9, out1: 0.9, hex: PAL.cornice }, { x0: 47.2, x1: 68.1, z0: 25.7, z1: 26.9, out1: 0.9, hex: PAL.cornice },
  ],
  windows: [
    { xs: PAL_WING, rows: [[1.7, 3.9], [5.9, 9.9], [12.1, 13.7], [16.1, 20], [21.1, 23.1]], w: 1.5, hex: PAL.glass, frameHex: PAL.frame },
  ],
};
// The risalit's windows sit on its own face, 5 m forward: drawn as boxes there.
ROYAL_PALACE_DAM.boxes.push(...PAL_CENTRE.flatMap(x => ([[5.9, 9.9], [12.1, 13.7], [18.7, 22.3], [24.3, 26.1]] as [number, number][]).flatMap(([z0, z1]): FrontBox[] => [
  { x0: x - 0.75, x1: x + 0.75, z0: z0 - 0.12, z1: z1 + 0.12, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.34, hex: PAL.frame },
  { x0: x - 0.63, x1: x + 0.63, z0, z1, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.37, hex: PAL.glass },
])));

// Concertgebouw, the Van Baerlestraat front: a white portico of tall columns under a
// lettered entablature and a deep glass canopy, between brick-and-stone wings with
// corner pavilions. OSM maps the portico as its own part (w754269610), 4.3 m forward over
// 17.5-34.6 m; the photo, nearer to it than to the wall, shows it at 17.6-41.6 m.
const CG = { stone: '#e6dfcd', loggia: '#8f877a', brick: '#a85a45', glass: '#3f4650', gold: '#c9a54a', iron: '#3c3f42', slate: '#4d535c' };
const CG_OUT = 4.3;
const cx = (x: number) => 17.5 + ((x - 17.6) * 17.1) / 24;
export const CONCERTGEBOUW: Front = {
  name: 'Concertgebouw',
  ids: ['w754269603', 'w754269608', 'w754269609', 'w754269610'],
  // The portico is drawn at its OSM width, narrower than the photo shows it: only check the model is never taller.
  roofline: 'front-only',
  start: [4.8796525973590095, 52.35617990203481], end: [4.879354197352111, 52.356617502039974],
  depthM: 0.4, hex: CG.stone,
  // Corner pavilions rise above the wings with small pediments; the wings are lower between.
  outline: [[0, 17.1], [5.4, 17.1], [5.8, 19.2], [8.6, 21], [11.4, 19.2], [11.8, 17.1], [42.2, 17.1], [42.6, 19.6], [45.6, 22.2], [48.6, 19.6], [49, 17.1], [52.5, 17.1]],
  slabs: [{ outline: [[17.5, 26.5], [34.6, 26.5]], out0: 0, out1: CG_OUT, hex: CG.stone }],
  boxes: [
    // Brick panels on the wings between stone bands.
    ...[[1, 16.8], [35.4, 51.6]].flatMap(([x0, x1]) => [
      { x0, x1, z0: 7.5, z1: 13.4, out0: -0.05, out1: 0.04, hex: CG.brick },
      { x0, x1, z0: 1.2, z1: 5.6, out0: -0.05, out1: 0.04, hex: CG.brick },
    ]),
    { x0: 0, x1: 17.5, z0: 14.7, z1: 17.1, out1: 0.7, hex: CG.stone }, { x0: 34.6, x1: 52.5, z0: 14.7, z1: 17.1, out1: 0.7, hex: CG.stone },
    // Pavilion lanterns: small slate caps on the corner pavilions.
    { x0: 7.4, x1: 9.8, z0: 20, z1: 22.6, out0: -3, out1: -0.4, hex: CG.slate }, { x0: 44.2, x1: 47, z0: 21.4, z1: 24.6, out0: -3, out1: -0.4, hex: CG.slate },
    // The portico face: a shaded loggia, columns in front of it, entablature with gilt lettering, canopy.
    { x0: cx(18), x1: cx(41.2), z0: 9.5, z1: 21.2, out0: CG_OUT - 0.05, out1: CG_OUT + 0.02, hex: CG.loggia },
    ...[18.6, 21.6, 24.6, 27.6, 30.6, 33.6, 36.6, 39.6].map(x => ({ x0: cx(x) - 0.35, x1: cx(x) + 0.35, z0: 9.5, z1: 21.2, out0: CG_OUT, out1: CG_OUT + 0.9, hex: CG.stone })),
    { x0: 17.5, x1: 34.6, z0: 21.2, z1: 26.5, out0: CG_OUT, out1: CG_OUT + 1, hex: CG.stone },
    { x0: cx(22), x1: cx(37.2), z0: 22.2, z1: 23.1, out0: CG_OUT + 1, out1: CG_OUT + 1.06, hex: CG.gold },
    { x0: 16.9, x1: 35.2, z0: 6.9, z1: 7.6, out0: CG_OUT, out1: CG_OUT + 2.6, hex: CG.iron },
    ...[24.4, 28, 31.6, 35.2].map(x => ({ x0: cx(x) - 0.95, x1: cx(x) + 0.95, z0: 0, z1: 5.3, out0: CG_OUT - 0.05, out1: CG_OUT + 0.05, hex: CG.glass })),
  ],
  windows: [
    { xs: [2.6, 8.6, 14.2, 38, 45.6, 50.6], rows: [[8.9, 12.6], [1.7, 4.9]], w: 1.3, hex: CG.glass, frameHex: CG.stone },
  ],
};

// Tuschinski, the Reguliersbreestraat front: two Art Deco towers with stepped crowns
// flanking a tall arched recess and its rounded oriel, over a canopied entrance.
const TU = { stone: '#8a8188', dark: '#5f5961', gold: '#b08a4a', teal: '#4f6f73', glass: '#3b3f46', door: '#7a2c2a' };
export const TUSCHINSKI: Front = {
  name: 'Tuschinski',
  ids: ['NL.IMBAG.Pand.0363100012168188'],
  // The fused reference stops below the tower crowns and ghosts their edges.
  roofline: 'unmeasured',
  start: [4.894810997136038, 52.366501002229796], end: [4.894616997135511, 52.36655500222995],
  depthM: 0.4, hex: TU.stone,
  outline: [[0, 20], [0.6, 23], [4.2, 23], [4.2, 21], [10.2, 21], [10.2, 23], [13.9, 23], [14.5, 20]],
  boxes: [
    // Towers stand forward, crowned with stepped merlons.
    { x0: 0.6, x1: 4.2, z0: 0, z1: 23, out1: 0.6, hex: TU.stone }, { x0: 10.2, x1: 13.9, z0: 0, z1: 23, out1: 0.6, hex: TU.stone },
    ...[0.8, 2, 3.2, 10.4, 11.6, 12.8].map(x => ({ x0: x, x1: x + 0.8, z0: 23, z1: 24.2, out1: 0.6, hex: TU.stone })),
    // Stepped crowns, each stage narrower, capped in copper green.
    ...[[0.6, 4.2], [10.2, 13.9]].flatMap(([x0, x1]) => [
      { x0: x0 + 0.4, x1: x1 - 0.4, z0: 24.2, z1: 25.6, out0: -2.5, out1: 0.3, hex: TU.stone },
      { x0: x0 + 0.8, x1: x1 - 0.8, z0: 25.6, z1: 26.8, out0: -2, out1: 0, hex: TU.gold },
      { x0: x0 + 1.2, x1: x1 - 1.2, z0: 26.8, z1: 28.4, out0: -1.6, out1: -0.3, hex: TU.teal },
    ]),
    // The ornamented band under the parapet and the recessed arch with its oriel.
    { x0: 4.2, x1: 10.2, z0: 16.2, z1: 19.6, out1: 0.3, hex: TU.teal },
    { x0: 4.2, x1: 10.2, z0: 19.6, z1: 21, out1: 0.4, hex: TU.gold },
    { x0: 5.4, x1: 9.4, z0: 5.4, z1: 15, out0: -0.3, out1: -0.29, hex: TU.dark },
    { x0: 6.2, x1: 8.6, z0: 7.4, z1: 14.2, out0: -0.3, out1: 0.5, hex: TU.stone },
    { x0: 4.6, x1: 9.8, z0: 4.2, z1: 5.2, out1: 1.6, hex: TU.gold },
    { x0: 5.2, x1: 9.4, z0: 0, z1: 4.2, out0: -0.05, out1: 0.05, hex: TU.door },
  ],
  windows: [
    { xs: [2.4, 12], rows: [[3, 6], [8, 11], [13, 16], [18, 21]], w: 0.6, hex: TU.glass, frameHex: TU.gold },
    { xs: [6.8, 8], rows: [[8.2, 10.4], [11, 13.4]], w: 0.9, hex: TU.glass, frameHex: TU.gold },
  ],
};

export const FRONTS: Record<string, Front> = { bijenkorf: BIJENKORF, beurs: BEURS_BEURSPLEIN, 'royal-palace': ROYAL_PALACE_DAM, concertgebouw: CONCERTGEBOUW, tuschinski: TUSCHINSKI };

export const FRONT_LIST: readonly Front[] = Object.values(FRONTS);

/** Footprint parts that carry a front: routed to the landmark-kit mesh, which draws the front with them. */
export const FRONT_PART_IDS: ReadonlySet<string> = new Set(FRONT_LIST.flatMap(f => f.ids));
const FRONT_OF = new Map(FRONT_LIST.flatMap(f => f.ids.map(id => [id, f] as const)));

type GeoFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/**
 * A front's carrying parts stop at the front's body height and take its wall colour, so the
 * plain prism behind a pediment or gable row neither hides it nor clashes with it.
 */
export function decorateFront<T extends GeoFeature>(feature: T): T {
  const front = FRONT_OF.get(String(feature.properties.id ?? ''));
  if (!front || feature.properties.frontCarrier) return feature;
  const height = Number(feature.properties.height);
  const capped = front.bodyTopM != null && Number.isFinite(height) ? Math.min(height, front.bodyTopM) : height;
  return { ...feature, properties: { ...feature.properties, frontCarrier: front.name, height: capped, sideColour: front.hex, colour: front.hex } };
}
