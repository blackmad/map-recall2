import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {placeFigure, rod, localFrame, POSES, type Pose, type Joints} from './figure-kit';

/**
 * The Night Watch bronzes on the Rembrandtplein (Mikhail Dronov and Alexander Taratynov, 2006-2012): 22 figures after Rembrandt's
 * painting, each on its own steel plate, loosely facing the Rembrandt statue's front. Positions are read from the Commons photographs
 * (Txllxt, CC BY-SA 4.0; Hippolyte, CC BY-SA 3.0): captain and lieutenant stepping out in the middle rank, the ensign with the flag
 * behind them on the left, the two girls and the boy between, the drummer at the right edge, loaders and firers on the left.
 * `u` runs across the group (the viewer's right = the statue's left, local +x), `v` is the distance in front of the pedestal die.
 * Figures are 1.8-1.9 m; the girls and the boy are 1.1 m.
 */
type Colour = Parameters<BuildingTools['add']>[1];

type Kind =
  | 'captain' | 'lieutenant' | 'ensign' | 'girl' | 'boy' | 'drummer' | 'loader' | 'firer' | 'shield' | 'pike' | 'halberd'
  | 'carry' | 'aim' | 'sword' | 'grounded' | 'hips' | 'pointer' | 'folded' | 'stoop';
interface Fig {n: string; kind: Kind; u: number; v: number; yaw: number; h?: number}

/** The plan, 22 figures: rank by rank, painting left to right in each rank. */
export const NIGHT_WATCH: Fig[] = [
  {n: 'Captain Frans Banninck Cocq', kind: 'captain', u: -0.6, v: 6.7, yaw: 8},
  {n: 'Lieutenant Willem van Ruytenburch', kind: 'lieutenant', u: 1.0, v: 7.0, yaw: -14},
  {n: 'Ensign Jan Visscher Cornelisz with the flag', kind: 'ensign', u: -2.6, v: 5.2, yaw: 0},
  {n: 'Girl in yellow with the chicken', kind: 'girl', u: -1.4, v: 5.9, yaw: 0, h: 1.1},
  {n: 'Second girl', kind: 'girl', u: 1.9, v: 5.4, yaw: -8, h: 1.05},
  {n: 'Boy with the powder horn', kind: 'boy', u: -1.9, v: 8.0, yaw: 25, h: 1.15},
  {n: 'Drummer', kind: 'drummer', u: 4.0, v: 6.0, yaw: -65},
  {n: 'Musketeer loading', kind: 'loader', u: -3.9, v: 6.6, yaw: 35},
  {n: 'Musketeer firing', kind: 'firer', u: -3.4, v: 4.6, yaw: 25},
  {n: 'Shield bearer', kind: 'shield', u: -2.5, v: 4.2, yaw: 10},
  {n: 'Pikeman', kind: 'pike', u: 0.2, v: 4.4, yaw: 0},
  {n: 'Halberdier', kind: 'halberd', u: 1.7, v: 4.0, yaw: -5},
  {n: 'Musketeer marching', kind: 'carry', u: 2.9, v: 6.4, yaw: -30},
  {n: 'Musketeer aiming', kind: 'aim', u: 3.3, v: 4.7, yaw: -40},
  {n: 'Sergeant with raised sword', kind: 'sword', u: 0.1, v: 5.6, yaw: 0},
  {n: 'Arquebusier', kind: 'grounded', u: -4.3, v: 5.2, yaw: 30},
  {n: 'Pikeman, rear', kind: 'pike', u: -1.2, v: 3.4, yaw: 0},
  {n: 'Man with hand on hip', kind: 'hips', u: 0.9, v: 3.3, yaw: 0},
  {n: 'Man in a cap', kind: 'hips', u: 2.4, v: 3.1, yaw: -10},
  {n: 'Man pointing', kind: 'pointer', u: -3.0, v: 3.3, yaw: 15},
  {n: 'Man with folded arms', kind: 'folded', u: 3.9, v: 3.5, yaw: -45},
  {n: 'Stooping musketeer', kind: 'stoop', u: 2.3, v: 7.8, yaw: -25},
];

const poseOf = (kind: Kind): {pose: Pose; props: (j: Joints, fwd: T.Vector3, b: BuildingTools, c: Colour) => void} => {
  const none = () => {};
  const stand = POSES.standing();
  const pike = (tilt = 0.06, len = 3.2, below = 1.15) => (j: Joints, _f: T.Vector3, b: BuildingTools, c: Colour) => {
    const d = new T.Vector3(tilt, 1, tilt).normalize();
    b.add(rod(j.handR.clone().addScaledVector(d, -below), j.handR.clone().addScaledVector(d, len - below), 0.022, 4), c);
  };
  switch (kind) {
    case 'captain': return {pose: {...POSES.striding(0.45), hat: 'widebrim', skirt: {len: 0.3, flare: 1.4}, lean: 0.05, arms: {l: {pitch: 1.35, roll: 0.3, bend: 0.2}, r: {pitch: 0.35, bend: 1.0}}},
      props: (j, _f, b, c) => b.add(rod(j.handR.clone().add(new T.Vector3(0, -1.05, 0)), j.handR.clone().add(new T.Vector3(0, 0.25, 0)), 0.02, 4), c)};
    case 'lieutenant': return {pose: {...POSES.striding(0.5), legs: {l: {pitch: -0.4, bend: 0.5}, r: {pitch: 0.5, bend: 0.1}}, hat: 'widebrim', skirt: {len: 0.3, flare: 1.4}, arms: {l: {pitch: 0.4, bend: 1.1}, r: {pitch: 1.2, bend: 0.7}}}, props: pike(0.28, 2.6, 0.9)};
    case 'ensign': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.28}, legs: {l: {pitch: 0.2, bend: 0.1}, r: {pitch: -0.05}}, arms: {l: {pitch: 0.7, bend: 1.0}, r: {pitch: 0.55, bend: 1.15}}},
      props: (j, _f, b, c) => {
        const m = j.handL.clone().add(j.handR).multiplyScalar(0.5), base = m.clone().setY(0), top = m.clone().setY(3.5);
        b.add(rod(base, top, 0.025, 4), c);
        // the flag: a slab hanging from the pole top, streaming to the west
        const flag = new T.BoxGeometry(0.03, 1.3, 1.2); flag.translate(m.x, 3.5 - 0.7, m.z - 0.6);
        b.add(flag, c);
      }};
    case 'girl': return {pose: {...stand, skirt: {len: 0.55, flare: 1.9}, legs: {l: {pitch: 0}, r: {pitch: 0}}, arms: {l: {pitch: 0.5, bend: 1.1}, r: {pitch: 0.4, bend: 1.0}}}, props: none};
    case 'boy': return {pose: {...POSES.striding(0.55), hat: 'morion', skirt: {len: 0.2}, arms: {l: {pitch: -0.5, bend: 0.4}, r: {pitch: 0.9, bend: 0.5}}}, props: none};
    case 'drummer': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, lean: 0.08, arms: {l: {pitch: 0.95, bend: 1.0, roll: -0.15}, r: {pitch: 0.85, bend: 1.0, roll: -0.15}}},
      props: (j, f, b, c) => {
        const g = new T.CylinderGeometry(0.3, 0.3, 0.42, 8); g.rotateZ(Math.PI / 2 * 0); g.rotateX(0.35);
        g.translate(j.pelvis.x + f.x * 0.38, j.pelvis.y + 0.1, j.pelvis.z + f.z * 0.38);
        b.add(g, c);
      }};
    case 'loader': return {pose: {...POSES.striding(0.3), hat: 'widebrim', skirt: {len: 0.3}, lean: 0.4, legs: {l: {pitch: 0.55, bend: 0.35}, r: {pitch: -0.25, bend: 0.3}}, arms: {l: {pitch: 0.9, bend: 0.6}, r: {pitch: 0.7, bend: 1.0}}},
      props: (j, _f, b, c) => { const d = j.handL.clone().sub(j.handR).normalize(); b.add(rod(j.handR.clone().addScaledVector(d, -0.45), j.handL.clone().addScaledVector(d, 0.9), 0.025, 4), c); }};
    case 'firer': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, lean: -0.1, legs: {l: {pitch: 0.3}, r: {pitch: -0.2}}, arms: {l: {pitch: 1.35, bend: 1.1}, r: {pitch: 1.0, bend: 1.6}}},
      props: (j, _f, b, c) => { const d = j.handL.clone().sub(j.handR).normalize(); b.add(rod(j.handR.clone().addScaledVector(d, -0.45), j.handL.clone().addScaledVector(d, 0.85), 0.025, 4), c); }};
    case 'shield': return {pose: {...stand, hat: 'morion', skirt: {len: 0.28}, arms: {l: {pitch: 0.8, bend: 1.2}, r: {pitch: 0.4, bend: 1.0}}},
      props: (j, f, b, c) => {
        const g = new T.CylinderGeometry(0.46, 0.46, 0.05, 8); g.rotateX(Math.PI / 2); g.rotateY(Math.atan2(f.x, f.z));
        g.translate(j.handL.x + f.x * 0.15, j.handL.y + 0.1, j.handL.z + f.z * 0.15);
        b.add(g, c);
      }};
    case 'pike': return {pose: {...stand, hat: 'morion', skirt: {len: 0.28}, arms: {l: {pitch: 0.2, roll: 0.5, bend: 1.4}, r: {pitch: 0.55, bend: 1.0}}}, props: pike()};
    case 'halberd': return {pose: {...stand, hat: 'morion', skirt: {len: 0.28}, arms: {l: {pitch: 0.2, roll: 0.5, bend: 1.4}, r: {pitch: 0.55, bend: 1.0}}},
      props: (j, f, b, c) => {
        pike(0.04, 2.8, 1.0)(j, f, b, c);
        const blade = new T.BoxGeometry(0.03, 0.3, 0.28); blade.translate(j.handR.x, 1.9 + 0.2, j.handR.z + 0.14);
        b.add(blade, c);
      }};
    case 'carry': return {pose: {...POSES.striding(0.5), hat: 'widebrim', skirt: {len: 0.3}, arms: {l: {pitch: 0.5, bend: 1.5}, r: {pitch: -0.4, bend: 0.5}}},
      props: (j, _f, b, c) => b.add(rod(j.handL.clone().add(new T.Vector3(-0.1, -0.5, -0.5)), j.handL.clone().add(new T.Vector3(0.1, 0.55, 0.9)), 0.025, 4), c)};
    case 'aim': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, lean: 0.12, legs: {l: {pitch: 0.4, bend: 0.2}, r: {pitch: -0.2, bend: 0.2}}, arms: {l: {pitch: 1.1, bend: 0.5}, r: {pitch: 0.6, bend: 1.3}}},
      props: (j, _f, b, c) => { const d = j.handL.clone().sub(j.handR).normalize(); b.add(rod(j.handR.clone().addScaledVector(d, -0.5), j.handL.clone().addScaledVector(d, 0.9), 0.025, 4), c); }};
    case 'sword': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, legs: {l: {pitch: 0.3}, r: {pitch: -0.1}}, arms: {l: {pitch: 0.3, bend: 1.3}, r: {pitch: 2.5, bend: 0.3}}},
      props: (j, _f, b, c) => b.add(rod(j.handR.clone().add(new T.Vector3(0, -0.1, 0)), j.handR.clone().add(new T.Vector3(0.05, 0.95, 0.1)), 0.016, 4), c)};
    case 'grounded': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, arms: {l: {pitch: 0.4, bend: 1.0}, r: {pitch: 0.5, bend: 0.9}}}, props: (j, _f, b, c) => b.add(rod(j.handR.clone().setY(0), j.handR.clone().setY(1.55), 0.025, 4), c)};
    case 'hips': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, arms: {l: {pitch: 0.1, roll: 0.7, bend: 1.9}, r: {pitch: 0.1, roll: 0.15, bend: 0.4}}}, props: none};
    case 'pointer': return {pose: {...stand, hat: 'morion', skirt: {len: 0.3}, legs: {l: {pitch: 0.3, bend: 0.1}, r: {pitch: -0.1}}, arms: {l: {pitch: 1.45, roll: 0.35, bend: 0.1}, r: {pitch: 0.2, bend: 1.2}}}, props: none};
    case 'folded': return {pose: {...stand, hat: 'widebrim', skirt: {len: 0.3}, arms: {l: {pitch: 0.55, roll: -0.25, bend: 2.0}, r: {pitch: 0.55, roll: -0.25, bend: 2.0}}}, props: none};
    case 'stoop': return {pose: {...POSES.striding(0.4), hat: 'widebrim', skirt: {len: 0.3}, lean: 0.5, arms: {l: {pitch: 0.9, bend: 0.5}, r: {pitch: 0.6, bend: 0.9}}}, props: none};
  }
};

/** Place all 22 figures on steel plates in the memorial's local frame (x right of the statue's front, z in front). */
/** Height of the paved apron under the group (it joins the terrace face so the group is one body with the monument). */
const APRON = 0.06;

export function buildNightWatch(b: BuildingTools, frame: ReturnType<typeof localFrame>, vOffset: number, colour: Colour, plate: Colour): {figures: number; tris: number} {
  let tris = 0;
  const apron = new T.BoxGeometry(11.6, APRON, 6.9);
  apron.rotateY(frame.yaw);
  const ac = frame.pt(0, APRON / 2, 3.2 + 6.9 / 2);
  apron.translate(ac.x, ac.y, ac.z);
  b.add(apron, 'concrete');
  for (const f of NIGHT_WATCH) {
    const {pose, props} = poseOf(f.kind), yaw = f.yaw * Math.PI / 180;
    const at = frame.pt(f.u, APRON + 0.04, f.v + vOffset), plateG = new T.BoxGeometry(1.0, 0.04, 0.9);
    plateG.rotateY(frame.yaw + yaw); plateG.translate(at.x, APRON + 0.02, at.z);
    b.add(plateG, plate);
    const joints = placeFigure(b, {...pose, height: f.h ?? 1.85}, {x: at.x, y: at.y, z: at.z, yaw: frame.yaw + yaw}, colour);
    tris += joints.tris;
    const fwd = new T.Vector3(Math.sin(frame.yaw + yaw), 0, Math.cos(frame.yaw + yaw));
    props(joints, fwd, b, colour);
  }
  return {figures: NIGHT_WATCH.length, tris};
}
