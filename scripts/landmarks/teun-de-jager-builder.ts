import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Teun de Jager (Jan Bronner, 1958; Vondelpark rose garden, OSM node 5653694042): a slim standing bronze man in a long coat and brimmed hat, his
 * left forearm raised with a can or jug, on a pale stone block with a dark bronze cap slab. Read from Gemeente Amsterdam panoramas
 * TMX7316010203-000259_pano_0003_000360 (2017, clear), -001892_pano_0000_003003 (2020), -000781_pano_0000_001141/1142 (2018); the public publisher blurs
 * other frames. FACING 250 (towards the camera of 001141, where the face is frontal) is an estimate of +-25 degrees; the figure height (1.75 m) and the
 * block size (0.55 x 1.1 m) are visual estimates from the plinth proportions. The face and coat folds are not legible at this distance and are simplified.
 */
const FACING = 250;

export function buildTeunDeJager(_w: number, _d: number, b: BuildingTools) {
  const {box, ball, limb, put} = memorialFrame(b, FACING);
  box(0, 0, 0, 0.55, 1.1, 0.55, 'stone');                               // pale stone block
  box(0, 1.1, 0, 0.68, 0.1, 0.68, 'bronze');                            // bronze cap slab
  const base = 1.2;
  box(-0.1, base, 0.1, 0.13, 0.07, 0.28, 'bronze');                     // boots
  box(0.1, base, 0.1, 0.13, 0.07, 0.28, 'bronze');
  limb([0, base + 0.05, 0], [0, base + 1.3, 0], 0.22, 0.17, 'bronze', 10);   // long coat, flaring at the hem
  ball(0, base + 1.3, 0, 0.23, 0.09, 0.14, 'bronze', 10);               // shoulders
  limb([0, base + 1.34, 0.01], [0, base + 1.42, 0.02], 0.07, 0.07, 'bronze', 8);   // neck
  ball(0, base + 1.52, 0.02, 0.1, 0.12, 0.11, 'bronze', 10);            // head
  limb([0, base + 1.6, 0.02], [0, base + 1.63, 0.02], 0.2, 0.2, 'bronze', 12);     // hat brim
  limb([0, base + 1.63, 0.02], [0, base + 1.73, 0.02], 0.12, 0.11, 'bronze', 10);  // hat crown
  // right arm hangs at the side; left arm bent, forearm raised with a jug
  limb([-0.22, base + 1.28, 0], [-0.24, base + 0.58, 0.05], 0.065, 0.05, 'bronze', 7);
  ball(-0.24, base + 0.54, 0.06, 0.05, 0.06, 0.04, 'bronze', 7);
  limb([0.22, base + 1.28, 0], [0.28, base + 0.92, 0.1], 0.065, 0.055, 'bronze', 7);
  limb([0.28, base + 0.92, 0.1], [0.2, base + 1.15, 0.28], 0.055, 0.05, 'bronze', 7);
  limb([0.2, base + 1.1, 0.34], [0.2, base + 1.26, 0.34], 0.075, 0.07, 'bronze', 9);   // the jug
  ball(0.2, base + 1.1, 0.3, 0.05, 0.05, 0.05, 'bronze', 7);                           // hand
  void put;
}
