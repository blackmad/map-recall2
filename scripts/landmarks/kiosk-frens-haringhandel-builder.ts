import type {BuildingTools} from './cultural-builders';
import type {KioskLettering, KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-frens-haringhandel-footprints.json';

/**
 * Frens Haringhandel, Koningsplein (BAG pand 0363100012176251, 1983): the herring kiosk on the Koningsplein at the head of
 * the Leidsestraat, by the Bloemenmarkt. Kit variant `herring`, drawn shut as every panorama shows it (03:28-09:26):
 * navy frame and base, timber corner post, panels of wood below and glass above behind diamond-lattice roll grilles,
 * the serving front (bearing 231) behind a white square-grid grille over a white roller shutter, a navy fascia with
 * "FRENS HARINGHANDEL AMSTERDAM" in cream on every side, a grey plant box and a steel duct on the roof, on a low
 * concrete platform.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-frens-haringhandel-inventory.json:
 * recording_2025-06-16_06-42-40_00636 (south, artifacts/kiosks/frens/b183-crop.png): heights from the 2.79 m BAG/3DBAG top
 * at 170 px/m on the SE end: navy base 0.24 m, wood to 1.41 m, glass to 2.41 m, fascia 2.47-2.79 m.
 */
const NAME = (maxWidth: number): KioskLettering => ({text: 'FRENS HARINGHANDEL AMSTERDAM', height: 0.15, bottom: 2.5, maxWidth, flat: true});
const diamond = {kind: 'shuttered', width: 1, sill: 1.41} as const;
export const FRENS: KioskSpec = {
  variant: 'herring', width: 4.2, depth: 3.35, wallHeight: 2.73, plinth: 0.24, post: 0.1, mullion: 0.08, frameDepth: 0.08,
  baseRail: 0.05, headRail: 0.32, cornerRole: 'corner',
  faces: {
    front: {panels: [{kind: 'shuttered', width: 1, sill: 0.9, lattice: 'square', lowerRole: 'counter'}, {kind: 'shuttered', width: 1, sill: 0.9, lattice: 'square', lowerRole: 'counter'}]},
    right: {panels: [diamond, diamond]},
    back: {panels: [diamond, diamond, diamond]},
    left: {panels: [diamond, diamond]},
  },
  roof: {kind: 'flat', thickness: 0.06, overhang: 0.1},
  platform: {margin: 0.35, height: 0.08},
  signs: [
    {face: 'front', along: 0, bottom: 2.43, width: 4.0, height: 0.3, proud: 0.06, lettering: NAME(3.6)},
    {face: 'back', along: 0, bottom: 2.43, width: 4.0, height: 0.3, proud: 0.06, lettering: NAME(3.6)},
    {face: 'right', along: 0, bottom: 2.43, width: 3.15, height: 0.3, proud: 0.06, lettering: NAME(2.8)},
    {face: 'left', along: 0, bottom: 2.43, width: 3.15, height: 0.3, proud: 0.06, lettering: NAME(2.8)},
  ],
  roofBoxes: [
    {along: -0.4, across: -0.9, width: 1.5, depth: 0.6, height: 0.35},
    {along: 1.1, across: -0.9, width: 0.9, depth: 0.36, height: 0.36, role: 'pole'},
  ],
};

export function buildKioskFrensHaringhandel(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, FRENS, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'blue', plinth: 'blue', sign: 'blue', fascia: 'blue', roof: 'blue', corner: 'ochre', board: 'bronze', glass: 'glass',
    screen: 'stone', counter: 'copper', lettering: 'gold', deck: 'concrete', trim: 'greyBrick', pole: 'sandstone',
  });
}
