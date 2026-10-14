import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {POSES} from './figure-kit';
import {headOnFigure} from './bust-kit';
import {dressFigure, lump} from './clothing-kit';

/**
 * Mahatma Gandhi on the Churchill-laan median (the garden between the carriageways at about 52.3470 N, 4.8932 E): a bronze Gandhi striding
 * forward in a dhoti and a shawl draped over the left shoulder, bald with round glasses, a long staff in the right hand (the viewer's left
 * from the front) and a book under the left arm, standing on a thin irregular bronze slab on a square pale limestone block with a dark plate
 * MAHATMA GANDHI / 1869 - 1948. The block stands in two circles of paving: an inner stone-edged cobble disc, the outer cobble circle edged
 * with a stone kerb, a ring of three wooden benches on stone legs behind it and a clipped hedge round the rear.
 * Source photos: Wikimedia Commons "Gandhi (Amsterdam) (1)-(5)" (Ceescamel, CC BY-SA 4.0), "Statue of Gandhi, Amsterdam" (Antony Antony,
 * CC BY 2.0), "Gandhi churchilllaan" (Evanherk, CC BY-SA 3.0); the 2018-2022 panoramas see the statue small from both carriageways.
 * Local frame: +z is the way Gandhi walks and faces, +x his left. FACING 90 (east) is an estimate (+-30) from the 2020 and 2022 panoramas:
 * from the northern carriageway the figure leans towards the viewer's left, which is east when looking south; the Commons photos stand
 * in the avenue axis, so the facing is along the carriageways.
 * Sizes are scaled off the 1.75 m figure standard and the 0.45 m wide plate: block 1.1 m square and 0.85 m high, figure 1.74 m, outer circle
 * radius 3.4 m. The plate wording is read from the photos, the dates are Gandhi's.
 */
const FACING = 90;

export function buildGandhiChurchillLaan(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {put, box, limb, ball, lettering, figure} = fr;
  const disc = (r0: number, r1: number, y0: number, h: number, colour: 'stone' | 'greyBrick' | 'green', seg = 40) => {
    const sh = new T.Shape(); sh.absarc(0, 0, r1, 0, Math.PI * 2, false);
    if (r0 > 0) { const hole = new T.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); sh.holes.push(hole); }
    const g = new T.ExtrudeGeometry(sh, {depth: h, bevelEnabled: false, curveSegments: seg});
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    put(g, 0, 0, 0, colour);
  };
  // ---- paving: cobbles inside a stone kerb, a raised inner disc with its own kerb
  disc(0, 3.4, 0, 0.1, 'greyBrick'); disc(3.1, 3.4, 0.1, 0.18, 'stone');
  disc(0, 2.1, 0.1, 0.3, 'greyBrick'); disc(1.85, 2.1, 0.4, 0.14, 'stone');
  const TOP = 0.4;
  // ---- three benches on stone legs in an arc behind (the -z side), seats of wood
  for (const a of [-42, 0, 42]) {
    const r = 2.9, t = (180 + a) * Math.PI / 180, x = r * Math.sin(t), z = r * Math.cos(t);
    for (const s of [-0.62, 0.62]) { const g = new T.BoxGeometry(0.16, 0.4, 0.4); g.translate(s, 0.2, 0); g.rotateY(t); put(g, x, 0.1, z, 'stone'); }
    const seat = new T.BoxGeometry(1.7, 0.07, 0.46); seat.translate(0, 0.44, 0); seat.rotateY(t); put(seat, x, 0.1, z, 'ochre');
  }
  // ---- hedge: a clipped arc round the rear, 0.7 m thick and 0.9 m high
  {
    const a0 = (180 - 130) * Math.PI / 180, a1 = (180 + 130) * Math.PI / 180, sh = new T.Shape(), n = 30, R0 = 3.85, R1 = 4.5;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const x = R1 * Math.sin(a), z = R1 * Math.cos(a); if (i === 0) sh.moveTo(x, -z); else sh.lineTo(x, -z); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(R0 * Math.sin(a), -R0 * Math.cos(a)); }
    const g = new T.ExtrudeGeometry(sh, {depth: 0.9, bevelEnabled: false}); g.rotateX(-Math.PI / 2); put(g, 0, 0, 0, 'green');
  }
  // ---- block and plate
  box(0, TOP, 0, 1.1, 0.85, 1.1, 'stone');
  box(0, TOP + 0.4, 0.555, 0.5, 0.2, 0.015, 'dark');
  lettering('MAHATMA GANDHI', 0.04, 0.4, 0, TOP + 0.44, 0.563, 'front', 'frame', 0.006);
  lettering('1869 - 1948', 0.03, 0.3, 0, TOP + 0.36, 0.563, 'front', 'frame', 0.006);
  const Y = TOP + 0.85;
  // irregular bronze slab under the feet
  for (const [x, z, rx, rz] of [[0, 0.02, 0.5, 0.42], [-0.16, 0.2, 0.28, 0.22], [0.2, -0.22, 0.26, 0.2]]) ball(x, Y + 0.012, z, rx, 0.025, rz, 'bronze', 9);
  // ---- Gandhi: striding, bent a little forward
  const pose = POSES.striding(0.42);
  pose.height = 1.82; pose.lean = 0.1; pose.stout = 1.0;
  pose.legs = {l: {pitch: 0.42, bend: 0.12}, r: {pitch: -0.34, bend: 0.5}};
  pose.arms = {l: {pitch: 0.25, roll: 0.0, bend: 1.35}, r: {pitch: 0.55, roll: 0.12, bend: 0.35}};
  pose.head = {pitch: 0.12};
  const g = figure(pose, 0, Y + 0.02, -0.05, 'bronze');
  dressFigure(fr, g, {height: 1.82, colour: 'bronze', sleeve: 0.82, trouser: 0.8, jacket: 0.3, chest: 0.9});
  headOnFigure(fr, g, {sex: 'm', hair: 'bald', glasses: true, colour: 'bronze', scale: 1.1});
  // shawl: a thick drape from the left shoulder across the chest to the right hip, and a fall hanging behind the left arm
  const P = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const nk = g.joints.neck, pv = g.joints.pelvis;
  lump(fr, P(nk.x + 0.2, nk.y - 0.04, nk.z), P(pv.x - 0.12, pv.y - 0.05, pv.z + 0.02), 0.13, 0.16, 'bronze', {zs: 0.55, seg: 9});
  lump(fr, P(nk.x + 0.2, nk.y - 0.06, nk.z - 0.01), P(nk.x + 0.26, pv.y - 0.28, nk.z - 0.02), 0.1, 0.17, 'bronze', {zs: 0.5, seg: 8});
  ball(nk.x - 0.2, nk.y - 0.1, nk.z, 0.08, 0.06, 0.07, 'bronze', 6);
  // the book under the left arm and the staff in the right hand
  const hl = g.joints.handL, hr = g.joints.handR;
  box(hl.x - 0.04, hl.y - 0.12, hl.z + 0.02, 0.07, 0.24, 0.17, 'dark', 0);
  limb([hr.x, Y + 0.02, hr.z], [hr.x, Y + 1.95, hr.z], 0.019, 0.017, 'bronze', 5);
}
