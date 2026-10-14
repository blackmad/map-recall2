import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {POSES} from './figure-kit';
import {headOnFigure} from './bust-kit';

/**
 * Theo Thijssen monument (Hans Bayens, 1960; Lindengracht at the Brouwersgracht, OSM node 250624675): a dark basalt block carrying a bronze school desk
 * (a slab top on four thin iron legs with a low shelf frame) with the schoolboy sitting behind it, head bowed over his writing, legs crossed under the desk,
 * and the master Theo Thijssen (author and schoolteacher, 1879-1943) in a rough-cast jacket and tie perched on the desk end, his left foot on the block,
 * the right leg stretched out to the front corner, leaning towards the boy. The block is cut with THEO THIJSSEN, 1879 - 1943, SCHRIJVER EN SCHOOLMEESTER.
 * Source photos: Wikimedia Commons "Lindengracht, Theo Thijssen beeld foto 1/2" (Alf van Beem, public domain) and "2023 Theo Thijssen door Bayens, Asd (1-5)"
 * (Ceescamel, CC0). Dimensions are scaled off the lettering and the 1.75 m figure standard: block 1.6 x 1.2 m, 1.1 m high; desk 1.15 m wide, 0.72 m top.
 * Local frame: +z is the front with the inscription (the way the master looks out), +x the master's left (the viewer's right in front of the block).
 * FACING 0 (north, towards the Brouwersgracht) is an estimate (+-40): the Commons photos stand looking down the Lindengracht with the street receding behind
 * the block, and the 2022 panorama from the south sees the plain back. The face and jacket folds are simplified to a rough-cast bronze mass.
 */
const FACING = 0;

export function buildTheoThijssenStandbeeld(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {box, limb, lettering, figure} = fr;
  // ---- block (dark basalt) with the carved lettering in lighter stone-grey
  const H = 1.1, BW = 1.6, BD = 1.2;
  box(0, 0, 0, BW, H, BD, 'greyBrick');
  const zf = BD / 2 - 0.003;
  lettering('THEO', 0.13, 0.6, 0, 0.8, zf, 'front', 'concrete', 0.014);
  lettering('THIJSSEN', 0.13, 1.1, 0, 0.62, zf, 'front', 'concrete', 0.014);
  lettering('1879 - 1943', 0.08, 0.8, 0, 0.44, zf, 'front', 'concrete', 0.012);
  lettering('SCHRIJVER EN SCHOOLMEESTER', 0.05, 1.3, 0, 0.27, zf, 'front', 'concrete', 0.01);
  // ---- desk: top slab, shelf frame and four rods, centred slightly left of the block centre (viewer's left)
  const dx = -0.18, dz = -0.05;
  box(dx, H + 0.69, dz, 1.15, 0.07, 0.55, 'bronze');                                // top slab
  box(dx, H + 0.64, dz, 1.1, 0.05, 0.05, 'bronze');                                 // front apron
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) limb([dx + sx * 0.54, H, dz + sz * 0.24], [dx + sx * 0.54, H + 0.7, dz + sz * 0.24], 0.016, 0.016, 'bronze', 5);
  box(dx, H + 0.005, dz, 1.1, 0.03, 0.5, 'bronze');                                 // base frame sheet
  // ---- the boy: seated behind the desk, bowed over the writing, head turned to the master
  const boy = POSES.seated(0.4);
  boy.height = 1.25; boy.stout = 1.1; boy.lean = 0.62;
  boy.legs = {l: {pitch: 1.1, roll: -0.35, bend: 1.15}, r: {pitch: 1.0, roll: 0.35, bend: 1.0}};
  boy.arms = {l: {pitch: 1.35, roll: 0.15, bend: 0.5}, r: {pitch: 1.55, roll: -0.2, bend: 0.35}};
  boy.head = {pitch: 0.45, yaw: -0.35};
  const boyFig = figure(boy, dx - 0.15, H + 0.0, dz + 0.5, 'bronze', 'bronze', Math.PI);          // sits on the front side, back to the viewer, legs under the desk
  headOnFigure(fr, boyFig, {sex: 'm', hair: 'short', colour: 'bronze', scale: 0.8});
  // ---- the master: semi-seated on the desk's right end, leaning to the boy; stout jacket, tie, tousled hair
  const man = POSES.standing();
  man.height = 1.75; man.stout = 1.2; man.chest = 1.2; man.pelvisY = 0.82; man.lean = 0.28; man.skirt = {len: 0.22, flare: 1.1};
  man.legs = {l: {pitch: 0.2, roll: 0.02, bend: 0.1}, r: {pitch: 0.75, roll: -0.25, bend: 0.15}};
  man.arms = {l: {pitch: 0.55, roll: 0.05, bend: 1.2}, r: {pitch: 0.7, roll: 0.15, bend: 1.3}};
  man.head = {pitch: 0.4, yaw: -0.5};
  const m = figure(man, 0.38, H + 0.0, 0.1, 'bronze');
  headOnFigure(fr, m, {sex: 'm', hair: 'wild', moustache: true, colour: 'bronze', scale: 1.1});
}
