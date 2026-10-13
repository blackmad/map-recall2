import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * Low-poly figure kit for the memorials: a posed human from tapered limbs, a head, shoulders and hips at measured
 * proportions (fractions of standing height, after the usual 7.5-head canon, checked against the memorial photographs:
 * Night Watch bronzes about 1.8 m, De Dokwerker 2.6 m). At most 300 triangles per figure (`MAX_FIGURE_TRIS`, `triCount`).
 *
 * Local frame of a figure: y up, +z the way it faces, +x its left. Joint angles in radians:
 *   arm  {pitch: raise forward, roll: abduct outward, bend: elbow flexion (forearm swings forward)}
 *   leg  {pitch: thigh forward, roll: abduct outward, bend: knee flexion (shin swings back)}
 * The pelvis height is solved so the lowest foot stands on y = 0 unless `pelvisY` is given (seated figures).
 * `placeFigure` returns the joint positions in the model frame so a builder can hang props (staff, lyre, mask) on them.
 */
type Colour = Parameters<BuildingTools['add']>[1];
export const MAX_FIGURE_TRIS = 300;

export interface Limb {pitch: number; roll?: number; bend?: number}
export type Hat = 'none' | 'beret' | 'widebrim' | 'morion' | 'cap' | 'tophat';
export interface Pose {
  /** Standing height in metres (the figure kit's reference, head top to sole when standing straight). */
  height?: number;
  /** Pelvis height above the placement origin; omitted: the lowest foot rests on the origin. */
  pelvisY?: number;
  /** Torso lean forward (positive = bends forward), sideways bend (roll) and twist (yaw about the spine); head pitch positive = nods down. */
  lean?: number; bendSide?: number; twist?: number;
  /** Whole-body yaw about y. */
  turn?: number;
  legs: {l: Limb; r: Limb};
  arms: {l: Limb; r: Limb};
  head?: {yaw?: number; pitch?: number; roll?: number};
  hat?: Hat;
  /** Coat skirt below the waist, length in metres (0 or undefined: none) and flare radius factor. */
  skirt?: {len: number; flare?: number};
  /** Sleeve/limb thickness factor (default 1). */
  stout?: number;
  /** Trunk width factor (default 1): a loose work shirt or heavy coat. */
  chest?: number;
}

/** Fractions of standing height. */
const P = {
  thigh: 0.245, shin: 0.246, foot: 0.04 /* ankle height */, footLen: 0.15, footW: 0.055,
  hipHalf: 0.09, trunk: 0.30, shoulderHalf: 0.115,
  upperArm: 0.186, foreArm: 0.146, hand: 0.075,
  neck: 0.0, head: 0.13,
  rThigh: [0.052, 0.036], rShin: [0.036, 0.027], rUpper: [0.036, 0.029], rFore: [0.029, 0.022],
};

const M = (m: T.Matrix4, ...ms: T.Matrix4[]) => ms.reduce((a, b) => a.clone().multiply(b), m);
const rx = (a: number) => new T.Matrix4().makeRotationX(a);
const ry = (a: number) => new T.Matrix4().makeRotationY(a);
const rz = (a: number) => new T.Matrix4().makeRotationZ(a);
const tr = (x: number, y: number, z: number) => new T.Matrix4().makeTranslation(x, y, z);

export interface Part {g: T.BufferGeometry; colour: Colour}
export interface Joints {
  pelvis: T.Vector3; neck: T.Vector3; head: T.Vector3; handL: T.Vector3; handR: T.Vector3; elbowL: T.Vector3; elbowR: T.Vector3;
  footL: T.Vector3; footR: T.Vector3; kneeL: T.Vector3; kneeR: T.Vector3;
  /** Frame of each hand (model frame) for oriented props. */
  frameHandL: T.Matrix4; frameHandR: T.Matrix4; frameHead: T.Matrix4;
}

/** Remove a hidden cap (three.js cylinder groups: 0 side, 1 top, 2 bottom) to save triangles. */
function dropCap(g: T.CylinderGeometry, group: 1 | 2): T.BufferGeometry {
  const idx = Array.from(g.index!.array), keep: number[] = [];
  g.groups.forEach((gr, i) => { if (i !== group) keep.push(...idx.slice(gr.start, gr.start + gr.count)); });
  g.setIndex(keep); g.clearGroups();
  return g;
}

/** A tapered limb hanging from the origin down -y: radius r0 at the joint, r1 at the far end. */
function seg(length: number, r0: number, r1: number, radial = 5): T.BufferGeometry {
  const g = new T.CylinderGeometry(r0, r1, length, radial, 1);
  g.translate(0, -length / 2, 0);
  return dropCap(g, 1);
}

/** Build a figure in its own frame (pelvis solved to the ground). */
export function buildFigure(pose: Pose, colour: Colour, accent: Colour = colour): {parts: Part[]; joints: Joints; pelvisY: number} {
  const H = pose.height ?? 1.75, stout = pose.stout ?? 1;
  const partsOf = (pelvisY: number) => {
    const parts: Part[] = [];
    const add = (g: T.BufferGeometry, m: T.Matrix4, c: Colour = colour) => { g.applyMatrix4(m); parts.push({g, colour: c}); };
    const root = M(ry(pose.turn ?? 0), tr(0, pelvisY, 0));
    const feet: {y: number; p: T.Vector3}[] = [];
    const out: Partial<Joints> = {};
    const p = (m: T.Matrix4) => new T.Vector3().setFromMatrixPosition(m);
    // legs: hip -> knee -> ankle -> foot
    for (const side of [1, -1] as const) {
      const leg = side > 0 ? pose.legs.l : pose.legs.r;
      const hip = M(root, tr(side * P.hipHalf * H, 0, 0), rz(side * (leg.roll ?? 0)), rx(-leg.pitch));
      add(seg(P.thigh * H, P.rThigh[0] * H * stout, P.rThigh[1] * H * stout), hip);
      const knee = M(hip, tr(0, -P.thigh * H, 0), rx(leg.bend ?? 0));
      add(seg(P.shin * H, P.rShin[0] * H * stout, P.rShin[1] * H * stout), knee);
      const ankle = M(knee, tr(0, -P.shin * H, 0));
      // The foot stays flat to the ground-facing torso frame (yaw only), whatever the leg does.
      const footM = M(root, tr(0, 0, 0)).clone();
      footM.setPosition(p(ankle));
      const foot = M(footM, tr(0, -P.foot * H * 0.5, P.footLen * H * 0.3));
      add(new T.BoxGeometry(P.footW * H, P.foot * H, P.footLen * H), foot);
      feet.push({y: p(ankle).y - P.foot * H, p: p(ankle)});
      if (side > 0) { out.kneeL = p(knee); out.footL = p(ankle); } else { out.kneeR = p(knee); out.footR = p(ankle); }
    }
    // pelvis and trunk
    const spine = M(root, rx(pose.lean ?? 0), rz(pose.bendSide ?? 0), ry(pose.twist ?? 0));
    const pelvisR = P.hipHalf * H * 1.12 * (pose.chest ?? 1);
    const pg = dropCap(new T.CylinderGeometry(pelvisR * 0.95, pelvisR, 0.1 * H, 6), 1); pg.scale(1, 1, 0.62);
    add(pg, M(root, tr(0, 0.02 * H, 0)), accent === colour ? colour : accent);
    if (pose.skirt && pose.skirt.len > 0) {
      const sk = new T.CylinderGeometry(pelvisR * 1.05, pelvisR * (pose.skirt.flare ?? 1.35), pose.skirt.len, 6, 1, true); sk.scale(1, 1, 0.8);
      add(sk, M(spine, tr(0, 0.02 * H - pose.skirt.len / 2, 0)));
    }
    const chestW = P.shoulderHalf * H * 1.05 * (pose.chest ?? 1);
    const tg = new T.CylinderGeometry(chestW, pelvisR * 0.92, P.trunk * H, 6); tg.scale(1, 1, 0.58);
    add(tg, M(spine, tr(0, P.trunk * H / 2 + 0.01 * H, 0)));
    const neckM = M(spine, tr(0, P.trunk * H + 0.01 * H, 0));
    // arms
    for (const side of [1, -1] as const) {
      const arm = side > 0 ? pose.arms.l : pose.arms.r;
      const shoulder = M(neckM, tr(side * P.shoulderHalf * H, -0.02 * H, 0), rz(side * (arm.roll ?? 0)), rx(-arm.pitch));
      add(seg(P.upperArm * H, P.rUpper[0] * H * stout, P.rUpper[1] * H * stout), shoulder);
      const elbow = M(shoulder, tr(0, -P.upperArm * H, 0), rx(-(arm.bend ?? 0)));
      add(seg(P.foreArm * H, P.rFore[0] * H * stout, P.rFore[1] * H * stout), elbow);
      const wrist = M(elbow, tr(0, -P.foreArm * H, 0));
      add(seg(P.hand * H, P.rFore[1] * H * 1.15, P.rFore[1] * H * 0.7), wrist, colour);
      const hand = M(wrist, tr(0, -P.hand * H * 0.6, 0));
      if (side > 0) { out.elbowL = p(elbow); out.handL = p(hand); out.frameHandL = hand; } else { out.elbowR = p(elbow); out.handR = p(hand); out.frameHandR = hand; }
    }
    // head
    const head = M(neckM, tr(0, P.neck * H, 0), ry(pose.head?.yaw ?? 0), rx(pose.head?.pitch ?? 0), rz(pose.head?.roll ?? 0));
    const hg = new T.SphereGeometry(P.head * H * 0.42, 6, 3); hg.scale(0.85, 1.2, 1.0);
    add(hg, M(head, tr(0, P.head * H * 0.5, 0)));
    const hatTop = P.head * H;
    const hat = pose.hat ?? 'none';
    if (hat === 'beret') { const g = new T.CylinderGeometry(P.head * H * 0.62, P.head * H * 0.5, P.head * H * 0.22, 7); g.scale(1, 1, 1); add(g, M(head, tr(0.01 * H, hatTop * 0.93, 0)), accent); }
    else if (hat === 'widebrim') {
      add(new T.CylinderGeometry(P.head * H * 1.05, P.head * H * 1.05, 0.008 * H, 6), M(head, tr(0, hatTop * 0.72, 0)), accent);
      add(dropCap(new T.CylinderGeometry(P.head * H * 0.42, P.head * H * 0.5, P.head * H * 0.4, 5), 2), M(head, tr(0, hatTop * 0.92, 0)), accent);
    } else if (hat === 'morion') {
      add(new T.CylinderGeometry(P.head * H * 0.5, P.head * H * 0.5, P.head * H * 0.35, 6), M(head, tr(0, hatTop * 0.82, 0)), accent);
      add(new T.BoxGeometry(P.head * H * 0.15, P.head * H * 0.12, P.head * H * 1.15), M(head, tr(0, hatTop * 1.0, 0)), accent);
    } else if (hat === 'cap') {
      add(new T.CylinderGeometry(P.head * H * 0.5, P.head * H * 0.55, P.head * H * 0.2, 6), M(head, tr(0, hatTop * 0.9, 0)), accent);
      add(new T.BoxGeometry(P.head * H * 0.7, 0.01 * H, P.head * H * 0.45), M(head, tr(0, hatTop * 0.78, P.head * H * 0.5)), accent);
    } else if (hat === 'tophat') {
      add(new T.CylinderGeometry(P.head * H * 0.7, P.head * H * 0.7, 0.008 * H, 6), M(head, tr(0, hatTop * 0.78, 0)), accent);
      add(dropCap(new T.CylinderGeometry(P.head * H * 0.45, P.head * H * 0.5, P.head * H * 0.7, 6), 2), M(head, tr(0, hatTop * 1.1, 0)), accent);
    }
    out.pelvis = p(root); out.neck = p(neckM); out.head = p(M(head, tr(0, P.head * H * 0.5, 0))); out.frameHead = head;
    return {parts, joints: out as Joints, lowest: Math.min(...feet.map(f => f.y))};
  };
  let pelvisY = pose.pelvisY;
  if (pelvisY === undefined) pelvisY = -partsOf(0).lowest;
  const r = partsOf(pelvisY);
  return {parts: r.parts, joints: r.joints, pelvisY};
}

export function triCount(parts: Part[]): number {
  return parts.reduce((n, {g}) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
}

export interface Placement {
  /** Model-frame position of the origin point under the figure (ground, plinth or seat top). */
  x: number; y: number; z: number;
  /** Heading: the figure faces this bearing in radians about y (0: +z; positive turns toward +x). */
  yaw?: number;
}

/** Build a figure, place it in the model frame through `b.add`, return its joints in the model frame. */
export function placeFigure(b: BuildingTools, pose: Pose, at: Placement, colour: Colour, accent: Colour = colour): Joints & {tris: number} {
  const {parts, joints} = buildFigure(pose, colour, accent);
  const tris = triCount(parts);
  if (tris > MAX_FIGURE_TRIS) throw new Error(`figure has ${tris} triangles (> ${MAX_FIGURE_TRIS})`);
  const place = M(tr(at.x, at.y, at.z), ry(at.yaw ?? 0));
  for (const {g, colour: c} of parts) { g.applyMatrix4(place); b.add(g, c, 0, 0, 0); }
  const conv = <K extends keyof Joints>(k: K) => {
    const v = joints[k];
    return v instanceof T.Vector3 ? v.clone().applyMatrix4(place) : M(place, v as T.Matrix4);
  };
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(joints) as (keyof Joints)[]) out[k] = conv(k);
  return {...(out as unknown as Joints), tris};
}

/** Common poses. Arms are sketched at rest, the builders override what the memorial shows. */
export const POSES = {
  standing: (): Pose => ({legs: {l: {pitch: 0}, r: {pitch: 0}}, arms: {l: {pitch: 0, roll: 0.08}, r: {pitch: 0, roll: 0.08}}}),
  /** Seated on a surface at the pelvis height `pelvisY` (m above the origin), thighs horizontal. */
  seated: (pelvisY: number): Pose => ({pelvisY, legs: {l: {pitch: 1.5, bend: 1.5}, r: {pitch: 1.5, bend: 1.5}}, arms: {l: {pitch: 0.4, bend: 1.2}, r: {pitch: 0.4, bend: 1.2}}}),
  /** Striding: left leg forward, right leg back, opposite arms swinging. */
  striding: (stride = 0.55): Pose => ({
    legs: {l: {pitch: stride, bend: 0.1}, r: {pitch: -stride * 0.8, bend: 0.5}},
    arms: {l: {pitch: -stride * 0.7, bend: 0.3, roll: 0.08}, r: {pitch: stride * 0.7, bend: 0.4, roll: 0.08}},
  }),
  /** Both arms raised overhead. */
  armsRaised: (): Pose => ({legs: {l: {pitch: 0.05}, r: {pitch: 0.05}}, arms: {l: {pitch: 2.9, roll: 0.15, bend: 0.1}, r: {pitch: 2.9, roll: 0.15, bend: 0.1}}}),
};

// ---- plinth inscriptions ---------------------------------------------------------------------------------------------

import {GLYPHS} from '../../src/canalRecall/buildingRecipe/signage';

/**
 * Raised stroke-font lettering as closed solids (one box per stroke segment, `depth` thick, facing +z, centred on the origin of
 * the plate plane): the kit's single-stroke capitals from `signage.ts`, so a plinth inscription is real geometry, not a decal.
 */
export function letterBoxes(text: string, heightM: number, maxWidthM: number, depth: number): T.BufferGeometry[] {
  const chars = [...text.toUpperCase()].filter(c => c in GLYPHS);
  const GAP = 1.6;
  let units = 0;
  for (const c of chars) units += GLYPHS[c].w + GAP;
  units -= GAP;
  const unit = Math.min(heightM / 6, maxWidthM / Math.max(units, 1)), stroke = 0.85 * unit, x0 = -(units * unit) / 2, out: T.BufferGeometry[] = [];
  let cursor = 0;
  for (const c of chars) {
    const g = GLYPHS[c];
    for (const s of g.s) for (let i = 0; i + 1 < s.length; i++) {
      const ax = x0 + (cursor + s[i][0]) * unit, ay = -3 * unit + s[i][1] * unit, bx = x0 + (cursor + s[i + 1][0]) * unit, by = -3 * unit + s[i + 1][1] * unit;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-6) continue;
      const box = new T.BoxGeometry(len + stroke * 0.6, stroke, depth);
      box.rotateZ(Math.atan2(by - ay, bx - ax));
      box.translate((ax + bx) / 2, (ay + by) / 2, depth / 2);
      out.push(box);
    }
    cursor += g.w + GAP;
  }
  return out;
}

/** A builder's local frame rotated by `yaw` about y (x right of the front, z in front): local point to model point. */
export function localFrame(yaw: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {yaw, pt: (x: number, y: number, z: number) => new T.Vector3(x * c + z * s, y, -x * s + z * c)};
}

/** A thin rod from a to b (model or local frame), radial segments `seg`. */
export function rod(a: T.Vector3, c: T.Vector3, r: number, seg = 4): T.BufferGeometry {
  const v = c.clone().sub(a), g = new T.CylinderGeometry(r, r, v.length(), seg, 1);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
  const m = a.clone().add(c).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}
