import type {BuildingTools} from './cultural-builders';
import type {KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './kiosk-dr-falafel-footprints.json';

/**
 * Dr. Falafel, Nassaukade 900 (BAG pand 0363100012243757, 2016): the glass falafel kiosk on the Nassaukade corner at the
 * Kinkerstraat bridge, beside the tram stop. Kit variant `glass` (src/canalRecall/kiosks/kioskKit.ts).
 *
 * Footprint: the BAG outline (5.04 x 3.06 m, kiosk-dr-falafel-footprints.json) is the roof slab seen from above; the
 * glazed walls stand 0.27 m inside it, as the west panorama shows the slab overhanging both ends.
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-dr-falafel-inventory.json:
 *  - west (front, bearing 286), recording_2025-06-30_05-16-46_00533 rectified at 50 px/m: four equal glazed panels
 *    about 1.07 m wide in a white frame, frame 2.63 m tall, slab underside 2.77 m and top 3.1 m; "Dr. / Falafel" in
 *    white on the north panel, bottom 1.7 m, "Falafel" 0.15 m tall.
 *  - south (196), recording_2025-07-31_10-53-44_00800: a glazed panel with the same lettering, a grey solid panel and a
 *    black steel bar gate at the east end, all under the slab.
 *  - north (16), recording_2025-06-30_05-16-46_00537: grey solid panel (east) and a glazed door (west) with lettering.
 *  - east (106, canal side), TMX7316010203-001979_pano_0001_000187 (2021): two pale grey solid panels.
 *  - south-west, recording_2025-07-31_10-53-44_00797 (artifacts/kiosks/dr-falafel2/roof-crop.png): black corner posts on the
 *    white frame, a light metal band on the slab edge and a planted roof with tall grass tufts showing over the edge.
 */
export const DR_FALAFEL: KioskSpec = {
  variant: 'glass', width: 4.5, depth: 2.5, wallHeight: 2.77, plinth: 0.06, post: 0.12, mullion: 0.1, frameDepth: 0.1,
  baseRail: 0.14, headRail: 0.2,
  faces: {
    front: {panels: [
      {kind: 'glass', width: 1, lettering: [{text: 'DR.', height: 0.1, bottom: 1.93, along: -0.25}, {text: 'FALAFEL', height: 0.15, bottom: 1.72, along: -0.07, maxWidth: 0.62}]},
      {kind: 'glass', width: 1}, {kind: 'glass', width: 1}, {kind: 'glass', width: 1},
    ]},
    right: {panels: [
      {kind: 'glass', width: 1, lettering: [{text: 'DR.', height: 0.1, bottom: 2.22, along: -0.2}, {text: 'FALAFEL', height: 0.15, bottom: 2.01, maxWidth: 0.62}]},
      {kind: 'solid', width: 0.95}, {kind: 'grille', width: 0.45},
    ]},
    back: {panels: [{kind: 'solid', width: 1}, {kind: 'solid', width: 1}]},
    left: {panels: [
      {kind: 'solid', width: 1},
      {kind: 'door', width: 0.9, lettering: [{text: 'DR.', height: 0.1, bottom: 2.22, along: -0.2}, {text: 'FALAFEL', height: 0.15, bottom: 2.01, maxWidth: 0.62}]},
    ]},
  },
  roof: {kind: 'flat', thickness: 0.33, overhang: 0.27, band: {bottom: 0.1, height: 0.12}, green: {inset: 0.2, height: 0.1, tufts: 14}},
  cornerRole: 'corner',
};

export function buildKioskDrFalafel(_w: number, _d: number, b: BuildingTools) {
  addKiosk(b, DR_FALAFEL, {centre: footprints.rect.centre as [number, number], frontBearing: footprints.rect.frontBearing}, {
    frame: 'copper', glass: 'glass', solid: 'concrete', door: 'copper', plinth: 'dark', fascia: 'slate', roof: 'slate',
    lettering: 'gold', strut: 'dark', void: 'dark', corner: 'dark', trim: 'frame', green: 'green', foliage: 'green',
  });
}
