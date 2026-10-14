import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {bust} from './bust-kit';

/**
 * Bust of Simon Carmiggelt (Kees Verkade, unveiled 25 October 1988; OSM node 440673918, in the Weteringplantsoen by the playground, not on the
 * Kloveniersburgwal as the brief assumed): a rough-hewn bronze bust of the Parool columnist ("Kronkel") in a jacket, shirt open at the throat, thick-rimmed
 * glasses and a swept head of hair, on a square speckled-granite pillar. Source photos: Wikimedia Commons "Borstbeeld Simon Carmiggelt (Kronkel) onthuld in
 * Amsterdam" Bestanddeelnr 934-3460..3464 (Rob Croes / Anefo, 1988-10-25, CC0): the bust in profile on the pillar, crowd and tram blocks behind it. The
 * 2020 panoramas show only a blurred pillar in the lawn, so the front is not verified: FACING 150 (towards the footpath and the bench, south-east) is an
 * estimate (+-45). Pillar 0.5 x 0.5 x 1.05 m and bust height 0.85 m are scaled off the unveiling crowd (chest-high pillar): estimates.
 * Local frame: +z the way the bust looks.
 */
const FACING = 150;

export function buildCarmiggeltBorstbeeld(_w: number, _d: number, b: BuildingTools) {
  const f = memorialFrame(b, FACING);
  f.box(0, 0, 0, 0.5, 1.05, 0.5, 'concrete');                          // granite pillar
  f.box(0, 1.05, 0, 0.58, 0.05, 0.58, 'concrete');                     // projecting cap
  f.box(0, 0.5, 0.25 + 0.005, 0.3, 0.2, 0.014, 'greyBrick');           // small plaque on the front
  bust(f, {x: 0, y: 1.1, z: 0, scale: 1.25, sex: 'm', hair: 'short', glasses: true, collar: true, colour: 'bronze'});
}
