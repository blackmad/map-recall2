import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-ramons-coffee-footprints.json';

/**
 * Ramon's Coffee Kiosk, Silodam 460 (BAG pand 0363100012246428, 2019; OSM node 9047305243, POI local-food-2588, 0.7 m
 * from the pand's centre). Kit variant `glass`: a pale grey-blue cabin, the north (Silodam path) side glazed with a glass
 * door and a pier, the south side to the IJ-side road a dark navy board wall lettered "RAMON'S COFFEE KIOSK" in a framed
 * panel with "OPEN 7AM" and "COFFEE TEA JUICES" beside it, the east end a dark menu board and a window; a deep
 * corrugated grey-blue fascia, and a rooftop garden of grasses with two stove pipes.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-ramons-coffee-inventory.json:
 * recording_2024-09-17_13-37-56_00020 (east-north-east, 22 m: glazed side, door, menu board, roof garden) and _00153
 * (south, 22 m: lettered dark side). Door 2.1 m scaled to wall 2.75 m, fascia 0.45 m; 3DBAG's 4.96 m top is the grasses
 * and pipes on the roof.
 */
export const RAMONS: KioskSpec = {
  variant: 'glass', width: 5.0, depth: 2.85, wallHeight: 2.75, plinth: 0.05, post: 0.1, mullion: 0.06, frameDepth: 0.08,
  baseRail: 0.12, headRail: 0.14,
  faces: {
    front: {panels: [{kind: 'glass', width: 1.25}, {kind: 'solid', width: 0.3}, {kind: 'door', width: 0.95}, {kind: 'glass', width: 1.1}, {kind: 'glass', width: 1.1}]},
    back: {panels: [
      {kind: 'solid', width: 1.7, role: 'screen', lettering: [
        {text: 'OPEN 7AM', height: 0.12, bottom: 2.25, maxWidth: 1.3, role: 'lettering', flat: true},
        {text: 'COFFEE', height: 0.09, bottom: 1.6, maxWidth: 1.2, role: 'lettering', flat: true},
        {text: 'TEA', height: 0.09, bottom: 1.42, maxWidth: 1.2, role: 'lettering', flat: true},
        {text: 'JUICES', height: 0.09, bottom: 1.24, maxWidth: 1.2, role: 'lettering', flat: true},
      ]},
      {kind: 'solid', width: 3.1, role: 'screen'},
    ]},
    left: {panels: [{kind: 'solid', width: 0.9, role: 'screen'}, {kind: 'glass', width: 1.1}, {kind: 'solid', width: 0.6}]},
    right: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1.3}]},
  },
  roof: {kind: 'flat', thickness: 0.45, overhang: 0.07},
  roofBoxes: [
    {along: 0, across: 0, width: 4.4, depth: 2.3, height: 0.3, role: 'foliage'},
    {along: 0.3, across: 0.1, width: 3.0, depth: 1.5, height: 0.35, role: 'green'},
    {along: -2.0, across: 0.9, width: 0.12, depth: 0.12, height: 0.9, role: 'trim'},
    {along: 1.9, across: 0.9, width: 0.12, depth: 0.12, height: 0.8, role: 'trim'},
  ],
  signs: [
    {face: 'back', along: 0.75, bottom: 1.05, width: 2.2, height: 0.8, proud: 0.05, lettering: [
      {text: "RAMON'S", height: 0.22, bottom: 1.48, maxWidth: 1.9, flat: true},
      {text: 'COFFEE KIOSK', height: 0.15, bottom: 1.2, maxWidth: 1.9, flat: true},
    ]},
  ],
};

export function buildKioskRamonsCoffee(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, RAMONS, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'white', solid: 'stone', door: 'white', glass: 'glass', plinth: 'concrete', roof: 'blue', fascia: 'blue', trim: 'dark',
    screen: 'greyBrick', sign: 'bronze', lettering: 'gold', foliage: 'ochre', green: 'green', corner: 'white',
  });
}
