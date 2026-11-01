import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-haringhandel-jonk-footprints.json';

/**
 * Haringhandel Jonk, Spui 7a (BAG pand 0363100012247454, 2018; OSM node 9860683033 "Haringhandel Jonk" sits 0.6 m from
 * its centre): the brief's "Spui herring stand", named from the OSM node and the JONK / Volendammer Haringhandel logo on
 * its shutters. Kit variant `herring`, drawn shut as the 05:16 panoramas show it: a dark green box of full-height roller
 * shutters under a thick dark flat roof slab.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-haringhandel-jonk-inventory.json:
 * recording_2025-06-30_05-16-46_00991 (north-west, 6 m), _00992 (north, 5 m), _00994 (north-east, 13 m);
 * artifacts/kiosks/jonk/contact.jpg. Heights from 3DBAG (eaves 3.0 m, top 3.12 m): shutters to 2.72 m, slab 0.36 m.
 * The BAG outline (3.99 x 3.45 m) is the slab seen from above; the shutter walls stand 0.12 m inside it.
 * The grey metal box 7 m south-east (Spui 7, BAG 0363100012175732, florist 't Lievertje) is a separate building.
 */
export const JONK: KioskSpec = {
  variant: 'herring', width: 3.75, depth: 3.21, wallHeight: 2.72, plinth: 0, post: 0.1, mullion: 0.06, frameDepth: 0.08,
  baseRail: 0.06, headRail: 0.12,
  faces: {
    front: {panels: [{kind: 'louvre', width: 1, louvreFrom: 0, lettering: [
      {text: 'JONK', height: 0.32, bottom: 1.5, flat: true},
      {text: 'VOLENDAMMER', height: 0.1, bottom: 1.3, flat: true},
      {text: 'HARINGHANDEL', height: 0.1, bottom: 1.14, flat: true},
    ]}]},
    left: {panels: [{kind: 'louvre', width: 1, louvreFrom: 0, lettering: [
      {text: 'JONK', height: 0.28, bottom: 1.5, flat: true},
      {text: 'VOLENDAMMER', height: 0.09, bottom: 1.32, flat: true},
      {text: 'HARINGHANDEL', height: 0.09, bottom: 1.18, flat: true},
    ]}]},
    right: {panels: [{kind: 'louvre', width: 1, louvreFrom: 0, lettering: [
      {text: 'JONK', height: 0.28, bottom: 1.5, flat: true},
      {text: 'VOLENDAMMER', height: 0.09, bottom: 1.32, flat: true},
      {text: 'HARINGHANDEL', height: 0.09, bottom: 1.18, flat: true},
    ]}]},
    back: {panels: [{kind: 'louvre', width: 1, louvreFrom: 0}]},
  },
  roof: {kind: 'flat', thickness: 0.36, overhang: 0.12, upstand: {inset: 0.25, height: 0.04}},
  cornerRole: 'corner',
};

export function buildKioskHaringhandelJonk(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, JONK, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'slate', solid: 'slate', plinth: 'bronze', roof: 'bronze', fascia: 'bronze', lettering: 'gold', corner: 'bronze', trim: 'bronze',
  });
}
