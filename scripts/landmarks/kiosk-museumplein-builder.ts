import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-museumplein-footprints.json';

/**
 * Kiosk Rembrandt Van Gogh, Museumplein (Paulus Potterstraat 3A; BAG pand 0363100012151388, 2000; OSM node 6657813385
 * "Kiosk:Rembrandt Van Gogh" 0.9 m from its centre). Kit variant `glass`: a dark slate box whose long north-north-west
 * side is six tall poster panels behind glass (one reads "KIOSK REMBRANDT MUSEUMPLEIN AMSTERDAM"), the service end
 * (west-south-west) with a pale door panel under a small awning, a solid door end (east-north-east), two
 * air-conditioning units on the flat roof.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-museumplein-inventory.json:
 * recording_2025-09-29_08-09-56_01192 (north-north-west, 11 m: poster face), _01190 (west-north-west, 14 m: service
 * end), _01195 (north-east, 20 m: door end); artifacts/kiosks/museumplein/zoom.jpg. Height from 3DBAG (eaves 3.0 m,
 * top 3.16 m); poster band about 0.35-2.4 m scaled on that height. Posters are drawn as flat panels in their
 * measured median tints (the kit has no images).
 */
export const MUSEUMPLEIN: KioskSpec = {
  variant: 'glass', width: 5.9, depth: 2.6, wallHeight: 2.94, plinth: 0.08, post: 0.14, mullion: 0.05, frameDepth: 0.1,
  baseRail: 0.27, headRail: 0.55,
  faces: {
    front: {panels: [
      {kind: 'solid', width: 40},
      {kind: 'glass', width: 82, role: 'bloomA'}, {kind: 'glass', width: 82, role: 'bloomB'}, {kind: 'glass', width: 82, role: 'bloomC'},
      {kind: 'glass', width: 82, role: 'bloomD'}, {kind: 'glass', width: 82, role: 'foliage'}, {kind: 'glass', width: 82, role: 'screen'},
      {kind: 'solid', width: 45},
    ]},
    right: {panels: [{kind: 'solid', width: 1.3}, {kind: 'solid', width: 1, role: 'counter'}]},
    back: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
    left: {panels: [{kind: 'door', width: 0.9}, {kind: 'solid', width: 1.5}]},
  },
  roof: {kind: 'flat', thickness: 0.1, overhang: 0.03},
  roofBoxes: [
    {along: -1.4, across: 0.3, width: 0.95, depth: 0.7, height: 0.28, role: 'trim'},
    {along: 1.3, across: 0.3, width: 0.95, depth: 0.7, height: 0.28, role: 'trim'},
  ],
  awnings: [{face: 'right', along: 0.5, width: 1.0, top: 2.55, depth: 0.45, drop: 0.12, valance: 0.06}],
};

export function buildKioskMuseumplein(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, MUSEUMPLEIN, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'slate', solid: 'slate', door: 'slate', glass: 'glass', plinth: 'slate', roof: 'slate', fascia: 'slate', trim: 'concrete',
    counter: 'copper', awning: 'stone', corner: 'slate',
    bloomA: 'red', bloomB: 'bronze', bloomC: 'sandstone', bloomD: 'stone', foliage: 'ochre', screen: 'blue',
  });
}
