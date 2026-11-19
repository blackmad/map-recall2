// Shop props kit (lane shop-goods-20261116; David 2026-11-16: "we need a way to do some real 3d modelling inside/outside
// of these stores in a generic way"). Low-poly props as flat-colour triangles in a local frame, x along the wall (right),
// y out of the wall towards the street, z up, origin on the ground at the prop's anchor. retailFront.ts places them
// (Builder.put) into the sign layer, so a prop costs triangles and nothing else: no texture, no draw call, no GLB load.
// Pure (no DOM): runs in the mesh worker and in Node tests.

import { shopPassOn } from './flags.js';

export type V3 = [number, number, number];
/** One triangle of a prop, wound counter-clockwise seen from `n`. */
/** `lit`: its own light (a mirror's lamp, a lit sign): drawn unshaded and never pulled toward the glass's dark. */
export type PropTri = { p: [V3, V3, V3]; n: V3; hex: string; lit?: boolean };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Lane retail-pass: a seed key, the old one (its varying part last) unless `?shopPass=1`, which takes the new one (the
 *  varying part mid-key: a last-character change moves FNV-1a's hash01 by about 1/256, so neighbours barely differed).
 *  Flag off, every template front stays byte-identical (groundFloor template-golden.json). */
export const K = (old: string, now: string): string => (shopPassOn() ? now : old);

/** Stable 0..1 hash of a string (FNV-1a), the same as retailFront.ts's. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/** A hex a step darker (k < 1) or lighter (k > 1). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)))).map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Collects triangles; every face is wound to face its stated normal. */
export class Mesh {
  readonly tris: PropTri[] = [];
  tri(a: V3, b: V3, c: V3, hex: string, n?: V3, lit?: boolean): void {
    const fn = unit(cross(sub(b, a), sub(c, a)));
    const nn = n ? unit(n) : fn;
    const t: PropTri = dot(fn, nn) < 0 ? { p: [a, c, b], n: nn, hex } : { p: [a, b, c], n: nn, hex };
    if (lit) t.lit = true;
    this.tris.push(t);
  }
  quad(a: V3, b: V3, c: V3, d: V3, hex: string, n?: V3, lit?: boolean): void { this.tri(a, b, c, hex, n, lit); this.tri(a, c, d, hex, n, lit); }
  /** A box's faces: front (+y), top, the two ends (+-x); `back` and `bottom` only when asked. 8 tris by default. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, hex: string, o: { ends?: boolean; top?: boolean; back?: boolean } = {}): void {
    const { ends = true, top = true, back = false } = o;
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], hex, [0, 1, 0]);
    if (top) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(hex, 1.08), [0, 0, 1]);
    if (ends) {
      this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], shade(hex, 0.86), [-1, 0, 0]);
      this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], shade(hex, 0.86), [1, 0, 0]);
    }
    if (back) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], hex, [0, -1, 0]);
  }
  /** A flat strip of width `w` from `a` to `b` lying in the plane whose normal is `n` (a tube seen from its side). */
  strip(a: V3, b: V3, w: number, hex: string, n: V3): void {
    const side = unit(cross(n, sub(b, a))), h = w / 2;
    const off = (p: V3, s: number): V3 => [p[0] + side[0] * h * s, p[1] + side[1] * h * s, p[2] + side[2] * h * s];
    this.quad(off(a, -1), off(b, -1), off(b, 1), off(a, 1), hex, n);
  }
  /** A ring (tyre) of `sides` strips round (cx, cz) in the x-z plane at y, facing +y: 2 x sides tris. */
  ring(cx: number, cz: number, y: number, r: number, w: number, sides: number, hex: string): void {
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      const P = (a: number, rr: number): V3 => [cx + rr * Math.cos(a), y, cz + rr * Math.sin(a)];
      this.quad(P(a0, r - w / 2), P(a1, r - w / 2), P(a1, r + w / 2), P(a0, r + w / 2), hex, [0, 1, 0]);
    }
  }
  /** A four-sided bump (a low pyramid) over the rectangle at height z, apex `h` up: 4 tris, each face its own light. */
  bump(x0: number, x1: number, y0: number, y1: number, z: number, h: number, hex: string, hex2 = hex): void {
    const c: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, z + h];
    const A: V3 = [x0, y0, z], B: V3 = [x1, y0, z], C: V3 = [x1, y1, z], D: V3 = [x0, y1, z];
    this.tri(A, B, c, shade(hex, 0.82), [0, -1, 1]); this.tri(B, C, c, hex2, [1, 0, 1]);
    this.tri(C, D, c, hex, [0, 1, 1]); this.tri(D, A, c, shade(hex2, 0.9), [-1, 0, 1]);
  }
}

/** Where a prop goes: its anchor at (x, y, z) in the slot's frame, turned `yaw` (radians, about z) and scaled `k`;
 *  `mirror` flips it end for end (a bike facing the other way) keeping its faces towards the street. */
export type Pose = { x: number; y: number; z: number; yaw?: number; k?: number; tilt?: number; mirror?: boolean };

/** The prop's triangles moved to `pose` (tilt about x first: a crate's top towards the street; then yaw; then k). */
export function posed(tris: readonly PropTri[], pose: Pose): PropTri[] {
  const k = pose.k ?? 1, cy = Math.cos(pose.yaw ?? 0), sy = Math.sin(pose.yaw ?? 0), ct = Math.cos(pose.tilt ?? 0), st = Math.sin(pose.tilt ?? 0);
  const mx = pose.mirror ? -1 : 1;
  const rot = (v: V3): V3 => { v = [v[0] * mx, v[1], v[2]]; const y1 = v[1] * ct - v[2] * st, z1 = v[1] * st + v[2] * ct; return [v[0] * cy - y1 * sy, v[0] * sy + y1 * cy, z1]; };
  const at = (v: V3): V3 => { const r = rot(v); return [pose.x + r[0] * k, pose.y + r[1] * k, pose.z + r[2] * k]; };
  return tris.map(t => (t.lit ? { p: [at(t.p[0]), at(t.p[1]), at(t.p[2])], n: unit(rot(t.n)), hex: t.hex, lit: true } : { p: [at(t.p[0]), at(t.p[1]), at(t.p[2])], n: unit(rot(t.n)), hex: t.hex }));
}
