import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {POSES, type Pose} from './figure-kit';
import {headOnFigure} from './bust-kit';

/**
 * Standbeeld Anne Frank, Merwedeplein (Jet Schepp, 2005, on the Amsterdam-Zuid square where the Franks lived; Mari Andriessen's 1977 Anne Frank
 * is the Westermarkt statue): a slender girl of about
 * 1.5 m in a belted coat and pleated skirt, bobbed hair, a bag in the lowered right hand and another tucked under the left arm, on a bronze foot plate on a
 * tall block of polished red granite lettered ANNE FRANK / 1929 - 1945.
 * Original low-poly figure from the Commons photographs (Christian Michelides CC BY-SA 4.0, Franklin Heijnen CC BY-SA 2.0, Maaike98 CC BY-SA 3.0) and
 * Gemeente Amsterdam panorama recording_2025-07-15_08-32-06_02007 (CC BY 4.0). Local frame: +z front, +x her left. FACING is a visual estimate.
 */
const FACING = 200;

export function buildAnneFrankMerwedeplein(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {box, ball, limb, lettering, put, figure} = fr;
  // ---- granite block, 0.7 square, 1.3 m, on a low footing
  box(0, 0, 0, 1.0, 0.06, 1.0, 'concrete');
  box(0, 0.06, 0, 0.74, 1.3, 0.74, 'sandstone');
  box(0, 1.36, 0, 0.8, 0.05, 0.8, 'sandstone');
  lettering('ANNE FRANK', 0.1, 0.56, 0, 0.82, 0.37, 'front', 'white', 0.02);
  lettering('1929 - 1945', 0.1, 0.5, 0, 0.62, 0.37, 'front', 'white', 0.02);
  const base = 1.41;
  box(0, base - 0.01, 0, 0.55, 0.06, 0.42, 'bronze');                // foot plate, sunk 1 cm into the cap so its underside is inside the stone (its coplanar underside z-fought the cap top: feedback 2026-10-23)
  // ---- girl, 1.5 m: weight on the left leg
  const pose: Pose = {
    ...POSES.standing(), height: 1.5, stout: 0.9, chest: 1.0, skirt: {len: 0.4, flare: 1.3}, head: {yaw: -0.15, pitch: -0.03},
    legs: {l: {pitch: 0.02, roll: 0.03}, r: {pitch: -0.02, roll: 0.04}},
    arms: {l: {pitch: 0.55, roll: 0.1, bend: 1.5}, r: {pitch: 0.0, roll: 0.14, bend: 0.12}},
  };
  const {joints: j, raw} = figure(pose, 0, base + 0.05, 0, 'bronze', 'bronze');
  // coat body to the knee over the trunk, collar and lapel seam, the bobbed hair
  { const g = new T.CylinderGeometry(0.155, 0.215, 0.5, 10); g.scale(1, 1, 0.66); put(g, 0, j.pelvis.y + 0.135, 0.0, 'bronze'); }
  box(0, j.neck.y - 0.22, 0.12, 0.05, 0.2, 0.02, 'bronze');
  // three tones within the bronze: coat (bronze), face and neck (ochre, a worn lighter patina), collar (slate), hair (dark)
  const fig = {joints: j, raw: raw} as unknown as Parameters<typeof headOnFigure>[1];
  ball(j.neck.x, j.neck.y - 0.005, j.neck.z, 0.15, 0.04, 0.105, 'slate', 10);                       // flat collar over the coat
  headOnFigure(fr, fig, {sex: 'f', hair: 'short', colour: 'ochre', hairColour: 'dark', neck: 'ochre', neckR: 0.042, scale: 0.88});
  const h = j.head;
  // the bob: a full dark mass behind the head and curling under at ear height, leaving the face and the neck open at the front
  ball(h.x, h.y + 0.02, h.z - 0.045, 0.125, 0.14, 0.12, 'dark', 10);
  for (const sx of [-1, 1]) ball(h.x + sx * 0.095, h.y - 0.075, h.z - 0.02, 0.05, 0.075, 0.095, 'dark', 7);
  ball(h.x, h.y - 0.07, h.z - 0.085, 0.115, 0.08, 0.06, 'dark', 8);
  // bag in the lowered right hand (viewer's left in front view): a soft case hanging by the knee
  const r = j.handR;
  limb([r.x, r.y, r.z], [r.x, r.y - 0.08, r.z], 0.012, 0.012, 'bronze', 4);
  { const g = new T.BoxGeometry(0.1, 0.27, 0.3); put(g, r.x - 0.03, r.y - 0.22, r.z + 0.02, 'bronze'); }
  // bag under the left arm, held at the ribs
  const e = j.handL;
  { const g = new T.BoxGeometry(0.1, 0.3, 0.2); g.rotateX(0.2); put(g, e.x + 0.05, e.y - 0.02, e.z - 0.02, 'bronze'); }
}
