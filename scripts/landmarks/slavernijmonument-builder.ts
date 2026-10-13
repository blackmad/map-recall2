import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {placeFigure, rod, POSES, type Pose, type Joints} from './figure-kit';

/**
 * Nationaal monument Slavernijverleden (Oosterpark; Erwin de Vries, unveiled 1 July 2002). A low dark concrete platform carrying three bronze
 * groups: a huge leaning figure bent like a banana whose long head sweeps back west as a beak, a tall figure with raised arms before a square
 * post, and a chain of thirteen striding figures roped together and leaning east into the pull. Original low-poly interpretation from the CC0
 * Commons photographs by RoMaVo and Ceescamel (2025), the CC BY-SA photograph by Arthena and the Gemeente Amsterdam panoramas (CC BY 4.0).
 * The giant's spine is read off RoMaVo photograph 1 (platform 11 m = 960 px, so 88 px per metre; points in metres from the platform centre
 * and above its top); the walkers are kit figures (figure-kit.ts) of 1.95 m with their arms reaching forward and the ropes between them.
 * Local frame: x east, z south, y up; the platform's long axis runs along x, the chain of walkers at the west end.
 */
type Colour = Parameters<BuildingTools['add']>[1];

export function buildSlavernijmonument(_w: number, _d: number, b: BuildingTools) {
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: Colour) => b.box(x, y, z, w, h, d, c);
  const limb = (a: number[], c: number[], r0: number, r1: number, colour: Colour, seg = 7) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), seg);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(.5);
    b.add(g, colour, m.x, m.y, m.z);
  };
  const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: Colour) => { const g = new T.SphereGeometry(1, 8, 6); g.scale(rx, ry, rz); b.add(g, colour, x, y, z); };

  // Circular paved apron and the grey platform (11 x 4.5 m, 0.75 m high), long side east-west.
  b.add(new T.CylinderGeometry(6.2, 6.2, .12, 28), 'concrete', 0, .06, 0);
  box(0, .12, 0, 11, .75, 4.5, 'greyBrick');
  const top = .87;

  // The great leaning figure: a banana-shaped body rising from the east end, bending over at the hips and sweeping its head back west into a
  // long beak with a short lower jaw (RoMaVo 1: spine points below, x in metres east of the platform centre, h above the platform).
  const zz = 1.0, X = 0.92;
  const spine: [number, number, number][] = [[1.5, 0, .38], [3.4, 1.8, .52], [5.0, 3.4, .56], [5.8, 4.7, .5], [5.4, 5.8, .4], [4.4, 6.25, .3]];
  const pt = (s: [number, number, number]) => [s[0] * X, top + s[1], zz + (s[1] > 4 ? -0.15 : 0)];
  for (let k = 0; k + 1 < spine.length; k++) limb(pt(spine[k]), pt(spine[k + 1]), spine[k][2], spine[k + 1][2], 'bronze', 8);
  for (const k of [1, 2, 3, 4]) { const q = pt(spine[k]); ball(q[0], q[1], q[2], spine[k][2], spine[k][2], spine[k][2], 'bronze'); } // round the joints
  ball(4.3 * X, top + 6.3, zz - 0.15, 0.36, 0.34, 0.34, 'bronze');
  limb(pt([4.2, 6.3, 0]), [-0.3 * X, top + 7.2, zz - 0.2], 0.28, 0.05, 'bronze', 8); // the beak
  limb([4.1 * X, top + 5.75, zz - 0.1], [2.8 * X, top + 6.0, zz - 0.2], 0.12, 0.04, 'bronze', 6); // the lower jaw
  limb([5.5 * X, top + 4.9, zz + 0.2], [5.9 * X, top + 3.6, zz + 0.45], 0.1, 0.07, 'bronze', 6); // an arm hanging on the far side

  // The second group at the centre: a square post and, before it, the tall figure with both arms flung up, one long arm sweeping up and west.
  box(-1.6, top, -.3, .5, 2.5, .5, 'bronze');
  const tall = placeFigure(b, {
    height: 3.1, stout: 0.85, lean: 0.12, legs: {l: {pitch: 0.35, bend: 0.2}, r: {pitch: -0.25, bend: 0.3}},
    arms: {l: {pitch: 2.5, roll: 0.5, bend: 0.15}, r: {pitch: 2.4, roll: 0.15, bend: 0.2}}, head: {yaw: 0.2, pitch: -0.25},
  }, {x: -0.5, y: top, z: -.2, yaw: Math.PI / 2}, 'bronze');
  // the long arm to the west and the hair streaming from the head in flat tufts (RoMaVo 1, px 650-950)
  limb([tall.handL.x, tall.handL.y, tall.handL.z], [-2.9, top + 4.6, tall.handL.z - 0.1], 0.1, 0.06, 'bronze', 6);
  for (let k = 0; k < 4; k++) { const tuft = new T.BoxGeometry(0.9 - k * 0.1, 0.05, 0.3); tuft.translate(tall.head.x - 0.55, tall.head.y + 0.2 - k * 0.14, tall.head.z); b.add(tuft, 'bronze', 0, 0, 0); }

  // The chain of walkers, west end: thirteen thin figures in two loose ranks, leaning east into the pull, arms reaching forward, a rope between them.
  const walkers: [number, number, number][] = [
    [-5.0, -0.2, 0], [-4.6, 0.9, 0.1], [-4.4, -1.5, -0.05], [-4.0, 0.2, 0.05], [-3.9, 1.3, 0.12], [-3.6, -0.9, 0], [-3.3, 0.55, -0.08],
    [-3.0, -1.7, 0.1], [-2.8, 1.5, 0], [-2.7, -0.2, 0.06], [-2.4, 0.9, -0.05], [-2.2, -1.2, 0.1], [-1.95, 0.2, 0],
  ];
  const joints: Joints[] = [];
  walkers.forEach(([x, z, yawJitter], k) => {
    const stride = 0.5 + (k % 3) * 0.06;
    const pose: Pose = {
      ...POSES.striding(stride), height: 1.95 + (k % 4) * 0.03, stout: 0.78, lean: 0.34,
      legs: {l: {pitch: stride, bend: 0.15}, r: {pitch: -stride * 0.9, bend: 0.4}},
      arms: {l: {pitch: 1.15, roll: 0.05, bend: 0.25}, r: {pitch: 0.7 + (k % 2) * 0.3, bend: 0.5}}, head: {pitch: -0.15},
    };
    joints.push(placeFigure(b, pose, {x, y: top, z, yaw: Math.PI / 2 + yawJitter}, 'bronze'));
  });
  // ropes: waist to the next walker's reaching hand, and a long loop along the file
  for (let k = 0; k + 1 < joints.length; k++) {
    const a = joints[k].pelvis.clone().add(new T.Vector3(0, 0.25, 0)), c = joints[k + 1].handL;
    b.add(rod(a, c, 0.025, 4), 'bronze');
  }
}
