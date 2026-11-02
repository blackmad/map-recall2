import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-dumplings-nassauplein-footprints.json';

/**
 * Dumplings, Nassauplein 60 (BAG pand 0363100012243758, 2016): the Chinese dumpling kiosk on the Nassauplein by the
 * Westerpark bridge. The same 2016 city kiosk as Dr. Falafel (5.0 x 3.06 m BAG roof outline, white-framed glazing,
 * dark slab with a metal edge band, planted roof). Kit variant `glass`.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-dumplings-nassauplein-inventory.json:
 *  - front (bearing 135, to the square), recording_2024-09-09_11-28-19_00254 (artifacts/kiosks/dumplings/front-crop.png):
 *    five white-framed bays, a glazed double door left of centre, menus on the glass, two red windscreen leaves (solid lower
 *    0.9 m, framed clear upper part, 1.9 m tall) standing in front of the side bays; a stainless flue on the grass roof.
 *  - 2025 (recording_2025-06-17_10-48-55_00795): a grey retractable awning over the left two thirds of the front.
 *  - north-east end (45), 2025_09_29_05_45_16_00793: two glazed bays with menu posters.
 *  - back (315, canal side), TMX7316010203-001951_pano_0000_000468 (2021): pale closed panels between grey posts.
 */
export const DUMPLINGS: KioskSpec = {
  variant: 'glass', width: 4.45, depth: 2.5, wallHeight: 2.75, plinth: 0.06, post: 0.12, mullion: 0.1, frameDepth: 0.1,
  baseRail: 0.14, headRail: 0.2, cornerRole: 'corner',
  faces: {
    front: {panels: [{kind: 'glass', width: 175}, {kind: 'glass', width: 130}, {kind: 'door', width: 115}, {kind: 'glass', width: 110}, {kind: 'glass', width: 155}]},
    right: {panels: [{kind: 'glass', width: 1}, {kind: 'glass', width: 1}]},
    back: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
    left: {panels: [{kind: 'solid', width: 1}]},
  },
  roof: {kind: 'flat', thickness: 0.36, overhang: 0.28, band: {bottom: 0.1, height: 0.13}, green: {inset: 0.2, height: 0.1, tufts: 14}, flue: {along: 0.88, across: 0.3, height: 0.45, radius: 0.1}},
  screens: [
    {face: 'front', along: -1.17, width: 1.87, height: 1.9, solidHeight: 0.9, out: 0.45, angleDeg: 4},
    {face: 'front', along: 1.31, width: 1.82, height: 1.9, solidHeight: 0.9, out: 0.45, angleDeg: -4},
  ],
  awnings: [{face: 'front', along: -0.7, width: 3.0, top: 2.62, depth: 1.2, drop: 0.35, valance: 0.12}],
};

export function buildKioskDumplingsNassauplein(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, DUMPLINGS, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'copper', glass: 'glass', solid: 'concrete', door: 'copper', plinth: 'dark', fascia: 'slate', roof: 'slate',
    corner: 'dark', trim: 'frame', green: 'green', foliage: 'green', pole: 'frame', screen: 'red', awning: 'stone', awningStripe: 'stone',
  });
}
