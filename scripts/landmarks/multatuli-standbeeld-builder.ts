import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Multatuli-standbeeld on the Torensluis (Hans Bayens, 1987): a bronze bust of Eduard Douwes Dekker ("Multatuli") that stops at the chest, left arm a
 * stump, hair swept back and up in a soft mass, moustache, a bow tie at the collar, set on a block of polished red granite lettered Multatuli.
 * Original low-poly bust from the Commons photographs (FaceMePLS, CC BY 2.0; Paul van Galen / RCE, CC BY-SA 4.0) and Gemeente Amsterdam panorama
 * recording_2025-06-16_03-46-32_01395 (CC BY 4.0). Local frame: +z is the front (the lettered face), +x the bust's left. FACING is a visual estimate.
 */
const FACING = 350;

export function buildMultatuliStandbeeld(_w: number, _d: number, b: BuildingTools) {
  const {put, box, ball, limb, lettering} = memorialFrame(b, FACING);
  // ---- block: 2.0 x 1.2 plan, 1.05 m high, a thin plinth slab under it
  box(0, 0, 0, 2.2, 0.08, 1.4, 'concrete');
  const BH = 1.05, top = 0.08 + BH;
  box(0, 0.08, 0, 2.0, BH, 1.2, 'sandstone');
  lettering('MULTATULI', 0.24, 1.6, 0, 0.08 + BH * 0.5, 0.6, 'front', 'white', 0.025);
  // ---- bust: 1.9 m of chest, shoulders and head rooted in the block; the torso tapers to a keel
  { const g = new T.CylinderGeometry(0.5, 0.26, 1.15, 10); g.scale(1, 1, 0.62); put(g, 0.02, top + 0.55, -0.02, 'bronze'); }       // chest
  ball(0.0, top + 1.1, 0, 0.58, 0.2, 0.36, 'bronze');                                                                               // shoulders
  ball(-0.04, top + 0.8, 0.2, 0.3, 0.38, 0.14, 'bronze');                                                                           // pectoral mass, coat
  box(0.0, top + 0.55, 0.31, 0.06, 0.55, 0.04, 'bronze');                                                                           // coat opening
  limb([0.5, top + 1.12, 0], [0.74, top + 0.66, 0.02], 0.15, 0.1, 'bronze');                                                       // left arm stump, torn off below the shoulder
  limb([-0.5, top + 1.12, 0], [-0.62, top + 0.78, -0.02], 0.14, 0.09, 'bronze');                                                    // right arm: a short stump
  box(0.0, top + 1.11, 0.3, 0.3, 0.05, 0.1, 'bronze');                                                                              // collar band
  ball(0.0, top + 1.08, 0.36, 0.05, 0.04, 0.03, 'bronze', 6);                                                                       // bow tie knot
  ball(-0.1, top + 1.09, 0.36, 0.07, 0.04, 0.02, 'bronze', 6); ball(0.1, top + 1.09, 0.36, 0.07, 0.04, 0.02, 'bronze', 6);        // bow wings
  limb([0, top + 1.2, 0], [0, top + 1.4, 0.04], 0.14, 0.12, 'bronze');                                                              // neck
  // head: long face with a high forehead, heavy brow, nose, drooping moustache, hair swept back in a soft mass
  ball(0.0, top + 1.62, 0.04, 0.17, 0.24, 0.19, 'bronze', 12);
  box(0.0, top + 1.7, 0.2, 0.28, 0.05, 0.05, 'bronze');                                                                             // brow ridge
  box(0.0, top + 1.5, 0.22, 0.045, 0.14, 0.07, 'bronze');                                                                           // nose
  box(0.0, top + 1.46, 0.215, 0.2, 0.04, 0.05, 'bronze');                                                                           // moustache
  ball(0.0, top + 1.42, 0.17, 0.07, 0.08, 0.06, 'bronze', 6);                                                                       // chin
  ball(-0.02, top + 1.83, -0.03, 0.23, 0.085, 0.22, 'bronze', 10);                                                                   // hair: a broad soft mass, 7 cm over the crown
  ball(-0.05, top + 1.8, -0.16, 0.17, 0.08, 0.13, 'bronze', 8);                                                                      // swept back over the nape
  ball(0.17, top + 1.62, 0.0, 0.03, 0.06, 0.04, 'bronze', 5); ball(-0.17, top + 1.62, 0.0, 0.03, 0.06, 0.04, 'bronze', 5);        // ears
}
