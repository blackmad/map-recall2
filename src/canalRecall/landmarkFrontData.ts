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

export const FRONTS: Record<string, Front> = { bijenkorf: BIJENKORF, beurs: BEURS_BEURSPLEIN };
