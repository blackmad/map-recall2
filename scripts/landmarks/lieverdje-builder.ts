import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {POSES, type Pose} from './figure-kit';

/**
 * Het Lieverdje on the Spui (Carel Kneulman, 1960): the bronze street urchin, cap on one side, grinning, hands on his hips, shirt sleeves rolled, shorts and
 * wrinkled knee socks, on a square column of rough-faceted granite with a small bronze plaque; the Provo icon.
 * Original low-poly figure from the Commons photographs (Joost Evers / Anefo CC0, Marcel Antonisse / Anefo CC0, FaceMePLS CC BY 2.0) and the Gemeente
 * Amsterdam panorama recording_2025-06-16_04-42-37_01351 (CC BY 4.0). Local frame: +z front, +x the boy's left. FACING is a visual estimate.
 */
const FACING = 330;

export function buildLieverdje(_w: number, _d: number, b: BuildingTools) {
  const {box, ball, limb, figure} = memorialFrame(b, FACING);
  // ---- column: base slab, rough-hewn shaft (two courses with a step) and a bronze top plate
  box(0, 0, 0, 1.0, 0.1, 1.0, 'concrete');
  box(0, 0.1, 0, 0.82, 0.55, 0.82, 'concrete');
  box(0, 0.65, 0, 0.78, 0.5, 0.78, 'greyBrick');
  box(0, 1.15, 0, 0.9, 0.08, 0.9, 'concrete');
  box(0, 0.92, 0.39 + 0.015, 0.34, 0.14, 0.03, 'bronze');          // plaque on the front face
  const base = 1.23;
  box(0, base, 0.03, 0.62, 0.05, 0.55, 'bronze');                  // bronze foot plate
  // ---- boy, 1.42 m: weight even, feet apart, hands on hips, head cocked
  const pose: Pose = {
    ...POSES.standing(), height: 1.42, stout: 0.85, chest: 0.95, hat: 'cap', head: {yaw: 0.2, pitch: -0.05, roll: 0.1},
    legs: {l: {pitch: 0.02, roll: 0.07}, r: {pitch: -0.03, roll: 0.07}},
    arms: {l: {pitch: -0.95, roll: 0.55, bend: 2.0}, r: {pitch: -0.95, roll: 0.55, bend: 2.0}},
  };
  const {joints: j} = figure(pose, 0, base + 0.05, 0, 'bronze', 'bronze');
  // shorts: heavier thighs to the knee, socks bunched at the shin, rolled cuffs at the elbow
  for (const [hip, knee] of [[0.08, j.kneeL], [-0.08, j.kneeR]] as [number, T.Vector3][]) limb([hip, j.pelvis.y, 0], [knee.x, knee.y + 0.18, knee.z], 0.082, 0.075, 'bronze', 6);
  for (const k of [j.kneeL, j.kneeR]) ball(k.x, k.y - 0.2, k.z, 0.05, 0.035, 0.05, 'bronze', 6);
  for (const e of [j.elbowL, j.elbowR]) ball(e.x, e.y, e.z, 0.052, 0.04, 0.052, 'bronze', 6);
  ball(j.pelvis.x, j.pelvis.y + 0.1, j.pelvis.z, 0.15, 0.04, 0.1, 'bronze', 6);              // waistband
}
