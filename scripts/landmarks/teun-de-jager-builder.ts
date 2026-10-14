import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import * as T from 'three';
import {lump} from './clothing-kit';

/**
 * Teun de Jager (Jan Bronner, 1958; Vondelpark rose garden, OSM node 5653694042): a slim standing bronze man in a long coat and brimmed hat, his
 * left forearm raised with a can or jug, on a pale stone block with a dark bronze cap slab. Read from Gemeente Amsterdam panoramas
 * TMX7316010203-000259_pano_0003_000360 (2017, clear), -001892_pano_0000_003003 (2020), -000781_pano_0000_001141/1142 (2018); the public publisher blurs
 * other frames. FACING 250 (towards the camera of 001141, where the face is frontal) is an estimate of +-25 degrees; the figure height (1.75 m) and the
 * block size (0.55 x 1.1 m) are visual estimates from the plinth proportions. The face and coat folds are not legible at this distance and are simplified.
 * Second pass from the close Commons photographs 2019 Teun de Jager (02) front and (05) back (Ceescamel, CC BY-SA 4.0,
 * https://commons.wikimedia.org/wiki/File:2019_Teun_de_Jager_(02).jpg and (05)): a straight, narrow, square-shouldered coat to mid-thigh (not a flared
 * one), narrow trousers, boots together; the figure's RIGHT arm hangs from the shoulder and the forearm is raised vertically beside the shoulder
 * holding a flat bundle upright (no jug, no hat: short swept hair), the left arm hangs straight with a closed fist; a rough bronze crate stands on the cap slab
 * at his left foot.
 */
const FACING = 250;

export function buildTeunDeJager(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {box, ball} = fr, P = (x: number, y: number, z: number) => new T.Vector3(x, base + y, z);
  const base = 1.2, C = 'bronze' as const;
  box(0, 0, 0, 0.55, 1.1, 0.55, 'stone');                               // pale stone block
  box(0, 1.1, 0, 0.68, 0.1, 0.68, C);                                   // bronze cap slab
  // Cheap, upright and narrow (a 1.5x triangle budget on the 680 of the first pass): straight coat to mid-thigh, narrow trousers, boots together
  lump(fr, P(0, 0.6, 0), P(0, 1.4, 0), 0.19, 0.215, C, {zs: 0.6, seg: 12, flat: true});
  ball(0, base + 1.4, 0, 0.27, 0.05, 0.125, C, 8);                      // squared shoulders
  for (const sx of [-1, 1]) {
    lump(fr, P(sx * 0.085, 0.64, 0), P(sx * 0.08, 0.1, 0.01), 0.078, 0.056, C, {seg: 7, flat: true});   // trouser legs
    box(sx * 0.085, base, 0.06, 0.115, 0.09, 0.28, C);                  // boots
  }
  lump(fr, P(0, 1.4, 0.005), P(0, 1.52, 0.01), 0.052, 0.05, C, {seg: 7, flat: true});   // neck
  ball(0, base + 1.63, 0.012, 0.095, 0.12, 0.105, C, 9);                // head
  box(0, base + 1.66, 0.105, 0.15, 0.022, 0.04, C);                     // brow
  box(0, base + 1.6, 0.115, 0.03, 0.06, 0.04, C);                       // nose
  ball(0, base + 1.7, -0.012, 0.102, 0.09, 0.115, C, 8);                // short swept hair
  // left arm (his left, +x) hangs straight with a closed fist
  lump(fr, P(0.23, 1.38, 0), P(0.245, 1.1, 0.02), 0.058, 0.05, C, {seg: 7, flat: true});
  lump(fr, P(0.245, 1.1, 0.02), P(0.25, 0.86, 0.05), 0.05, 0.04, C, {seg: 7, flat: true});
  box(0.25, base + 0.76, 0.05, 0.075, 0.1, 0.09, C);
  // right arm: upper arm down and forward, forearm raised vertically beside the shoulder, holding a flat bundle upright
  const sh = P(-0.23, 1.38, 0), el = P(-0.23, 1.15, 0.2), hand = P(-0.23, 1.5, 0.1);
  lump(fr, sh, el, 0.058, 0.05, C, {seg: 7, flat: true});
  lump(fr, el, hand, 0.05, 0.042, C, {seg: 7, flat: true});
  box(hand.x - 0.045, hand.y - 0.27, hand.z, 0.07, 0.4, 0.19, C);
  // rough bronze crate on the slab at his left foot
  box(0.2, base, 0.03, 0.17, 0.12, 0.3, C);
  box(0.21, base + 0.12, 0.0, 0.13, 0.07, 0.2, C);
}
