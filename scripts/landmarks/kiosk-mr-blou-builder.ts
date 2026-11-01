import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-mr-blou-footprints.json';

/**
 * Mr Blou I Love You, Elandsgracht 150: the vegan falafel and salad kiosk on the wide pavement at the Elandsgracht /
 * Marnixstraat corner. No BAG pand or standplaats: the footprint is OSM building way w1311060949 (4.70 x 2.19 m),
 * which sits on the OSM shop node 9039944077. Kit variant `herring` (a boxed kiosk with a serving front), no flap.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-mr-blou-inventory.json:
 *  - front (bearing 336), recording_2025-07-03_10-31-52_00262 (artifacts/kiosks/mr-blou/front-crop.png), in deep tree
 *    shade: three cream fascia boards 2.27-2.81 m (left "BREAKFAST LUNCH DINNER COFFEE" with a blue eye logo, centre
 *    "MR BLOU I LOVE YOU" in black over "VEGAN" in green, right "SALAD BAR TAKE AWAY CATERING SANDWICH"), a band of
 *    menu chalkboards 1.8-2.2 m, the open serving front with a glass vitrine on a 0.95 m counter, and a yellow
 *    vertical-boarded counter base.
 *  - sides/back: grey panels with vent louvres in the upper band (TMX7316010203-002637_pano_0000_000002, 2022, and
 *    recording_2025-07-03_10-31-52_00264, 2025).
 */
export const MR_BLOU: KioskSpec = {
  variant: 'herring', width: 4.6, depth: 2.1, wallHeight: 2.85, plinth: 0, post: 0.1, mullion: 0.06, frameDepth: 0.08,
  baseRail: 0.06, headRail: 0.06,
  faces: {
    front: {panels: [{kind: 'hatch', width: 1}]},
    right: {panels: [{kind: 'louvre', width: 1, louvreFrom: 1.9}]},
    left: {panels: [{kind: 'louvre', width: 1, louvreFrom: 1.9}]},
    back: {panels: [{kind: 'louvre', width: 1, louvreFrom: 1.9}, {kind: 'louvre', width: 1, louvreFrom: 1.9}]},
  },
  hatch: {face: 'front', sill: 0.95, head: 1.8, counterDepth: 0.12, cover: 'none', vitrine: {height: 0.5, depth: 0.45}, aboveRole: 'void'},
  roof: {kind: 'flat', thickness: 0.09, overhang: 0.06},
  signs: [
    {face: 'front', along: -1.72, bottom: 2.27, width: 1.0, height: 0.54, proud: 0.07},
    {face: 'front', along: 0.04, bottom: 2.27, width: 2.4, height: 0.54, proud: 0.07, lettering: [
      {text: 'MR BLOU I LOVE YOU', height: 0.19, bottom: 2.55, maxWidth: 2.15},
      {text: 'VEGAN', height: 0.12, bottom: 2.34, role: 'foliage'},
    ]},
    {face: 'front', along: 1.74, bottom: 2.27, width: 0.95, height: 0.54, proud: 0.07},
  ],
};

export function buildKioskMrBlou(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, MR_BLOU, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'copper', solid: 'concrete', board: 'ochre', void: 'dark', counter: 'copper', glass: 'glass', sign: 'stone',
    lettering: 'gold', foliage: 'green', fascia: 'slate', roof: 'slate',
  });
}
