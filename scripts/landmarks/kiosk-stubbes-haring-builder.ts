import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-stubbes-haring-footprints.json';

/**
 * Stubbe's Haring, on the Haarlemmersluis (Singel bridge 14): BAG standplaats 0363030011957763 (Singel 8 M, 6.0 x 3.0 m,
 * registered 2016), which carries OSM node 5203239222 "Stubbe's Haring" at its centroid. Kit variant `herring`, drawn
 * shut as every panorama shows it (03:46 captures): a white box of closed shutter panels (a white roller shutter on the
 * south-east end) under a low grey zinc hip roof, a white "STUBBE HARING" board on the ridge with a blue leaping fish at
 * each end.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-stubbes-haring-inventory.json:
 * recording_2025-06-16_03-46-32_01055 (east, 21 m) and _01048 (north-west, 11 m), artifacts/kiosks/stubbes/zoom.jpg.
 */
export const STUBBES: KioskSpec = {
  variant: 'herring', width: 5.7, depth: 2.75, wallHeight: 2.6, plinth: 0.1, post: 0.08, mullion: 0.05, frameDepth: 0.08,
  baseRail: 0.06, headRail: 0.08,
  faces: {
    front: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
    back: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
    right: {panels: [{kind: 'louvre', width: 1, louvreFrom: 0}]},
    left: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
  },
  roof: {kind: 'hip', rise: 0.32, overhang: 0.12, eaveThickness: 0.08, ridge: 'width'},
  signs: [{face: 'front', along: 0.8, bottom: 2.98, width: 1.9, height: 0.45, proud: 0.06, mount: 'ridge',
    lettering: {text: 'STUBBE HARING', height: 0.17, bottom: 3.12, maxWidth: 1.7, flat: true},
    finials: {role: 'awning', width: 0.3, height: 0.55, leanDeg: 25}}],
};

export function buildKioskStubbesHaring(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, STUBBES, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'stone', solid: 'stone', plinth: 'bronze', roof: 'slate', fascia: 'slate', sign: 'stone', lettering: 'gold', awning: 'blue',
  });
}
