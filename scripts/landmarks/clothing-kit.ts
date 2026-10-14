import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {memorialFrame} from './memorial-frame';

type Colour = Parameters<BuildingTools['add']>[1];
type Frame = ReturnType<typeof memorialFrame>;
type Fig = ReturnType<Frame['figure']>;
const V = (v: T.Vector3) => v.clone();

/** A tapered elliptical solid from a to b (local frame): radius r0 at a, r1 at b, depth squeezed by `zs`; round caps by `cap` spheres. */
export function lump(f: Frame, a: T.Vector3, b: T.Vector3, r0: number, r1: number, colour: Colour, o: {zs?: number; seg?: number; cap?: boolean; flat?: boolean} = {}) {
  const v = b.clone().sub(a), len = v.length();
  if (len < 1e-4) return;
  const g = new T.CylinderGeometry(r1, r0, len, o.seg ?? 8, 1, !(o.cap || o.flat));
  g.scale(1, 1, o.zs ?? 1);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  f.put(g, m.x, m.y, m.z, colour);
  if (o.cap) for (const [p, r] of [[a, r0], [b, r1]] as [T.Vector3, number][]) f.ball(p.x, p.y, p.z, r, r, r * (o.zs ?? 1), colour, 6);
}

export interface DressOptions {
  /** Standing height the figure was posed with and its `turn` from the monument front. */
  height: number; turn?: number;
  colour: Colour;
  /** Sleeve and trouser radius factors (default 1). */
  sleeve?: number; trouser?: number; chest?: number;
  /** Jacket skirt to this many metres below the pelvis (0: none). */
  jacket?: number;
  /** Squared padded shoulders (a tailored jacket). */
  padded?: boolean;
}

/**
 * Clothe a kit figure: a rounded jacket body from hips to shoulders, a shoulder yoke and deltoids, sleeves that follow the elbow
 * bend down to the cuffs, trouser legs that follow the knee bend down to the shoe, so the bronze reads as a person in a coat
 * (shoulders, hips, bent arms and legs) rather than as the kit's thin hexagonal limbs. Closed overlapping solids.
 */
export function dressFigure(f: Frame, fig: Fig, o: DressOptions) {
  const j = fig.joints, H = o.height, t = o.turn ?? 0, c = o.colour;
  const left = new T.Vector3(Math.cos(t), 0, -Math.sin(t));
  const sl = o.sleeve ?? 1, tr = o.trouser ?? 1, ch = o.chest ?? 1;
  const shoulderHalf = 0.115 * H * (o.padded ? 1.22 : 1.08) * ch;
  const shoulders = [1, -1].map(s => V(j.neck).addScaledVector(left, s * shoulderHalf).add(new T.Vector3(0, -0.035 * H, 0)));
  // jacket body: hips to chest, flattened
  const hip = V(j.pelvis).add(new T.Vector3(0, 0.02 * H, 0));
  const chest = V(j.neck).add(new T.Vector3(0, -0.07 * H, 0));
  lump(f, hip, chest, 0.105 * H * ch, 0.125 * H * ch, c, {zs: 0.62, seg: 10});
  if ((o.jacket ?? 0) > 0) lump(f, hip, V(hip).add(new T.Vector3(0, -(o.jacket ?? 0), 0)), 0.108 * H * ch, 0.118 * H * ch, c, {zs: 0.64, seg: 10});
  // yoke across the shoulders and the neck base
  const yoke = V(j.neck).add(new T.Vector3(0, -0.04 * H, 0));
  f.ball(yoke.x, yoke.y, yoke.z, shoulderHalf * 1.28, 0.05 * H, 0.075 * H * ch, c, 10);
  // arms: deltoid, sleeve to the elbow, sleeve to the cuff
  const arms: [T.Vector3, T.Vector3, T.Vector3][] = [[shoulders[0], j.elbowL, j.handL], [shoulders[1], j.elbowR, j.handR]];
  for (const [s, e, h] of arms) {
    f.ball(s.x, s.y, s.z, 0.05 * H * sl, 0.055 * H * sl, 0.05 * H * sl, c, 7);
    lump(f, s, e, 0.043 * H * sl, 0.037 * H * sl, c, {seg: 7});
    f.ball(e.x, e.y, e.z, 0.036 * H * sl, 0.036 * H * sl, 0.036 * H * sl, c, 6);
    const w = V(e).lerp(h, 0.85);
    lump(f, e, w, 0.036 * H * sl, 0.03 * H * sl, c, {seg: 7});
  }
  // legs: thigh to knee to ankle, and a shoe
  const hipHalf = 0.09 * H;
  const legs: [T.Vector3, T.Vector3, T.Vector3][] = [[V(j.pelvis).addScaledVector(left, hipHalf), j.kneeL, j.footL], [V(j.pelvis).addScaledVector(left, -hipHalf), j.kneeR, j.footR]];
  for (const [h, k, a] of legs) {
    f.ball(h.x, h.y, h.z, 0.062 * H * tr, 0.06 * H * tr, 0.06 * H * tr, c, 7);
    lump(f, h, k, 0.062 * H * tr, 0.046 * H * tr, c, {seg: 8});
    f.ball(k.x, k.y, k.z, 0.046 * H * tr, 0.046 * H * tr, 0.046 * H * tr, c, 6);
    lump(f, k, a, 0.046 * H * tr, 0.036 * H * tr, c, {seg: 8});
  }
}
