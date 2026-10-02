// A triangle sink for roof geometry, in a building's own rectangle frame.
//
// Everything a roof builder emits is written in local (u, v, z): u along the
// rectangle's long axis, v across it, z up from the eaves. The sink turns that
// into the mesh frame, orients each triangle by an outward hint, and can give a
// roof face texture coordinates on its own (tile courses parallel to the eaves).

import type { Rect, RoofDims, RoofPart, RoofTri } from './roofMesh.js';

export type V3 = [number, number, number];
export type V2 = [number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class RoofSink {
  readonly out: RoofTri[] = [];
  constructor(readonly rect: Rect, readonly h0: number, readonly dims: RoofDims) {}

  world(p: V3): V3 {
    const { cx, cy, ux, uy } = this.rect;
    return [cx + p[0] * ux - p[1] * uy, cy + p[0] * uy + p[1] * ux, this.h0 + p[2]];
  }
  dir(p: V3): V3 {
    const { ux, uy } = this.rect;
    return [p[0] * ux - p[1] * uy, p[0] * uy + p[1] * ux, p[2]];
  }

  /** One triangle from local points, wound so its normal agrees with `hint` (local). Degenerate ones are dropped. */
  tri(a: V3, b: V3, c: V3, ua: V2, ub: V2, uc: V2, part: RoofPart, hint: V3, hex?: string): void {
    let n = cross(sub(b, a), sub(c, a));
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-7) return;
    let B = b, C = c, UB = ub, UC = uc;
    if (dot(n, hint) < 0) { B = c; C = b; UB = uc; UC = ub; n = [-n[0], -n[1], -n[2]]; }
    const w = this.dir([n[0] / l, n[1] / l, n[2] / l]);
    const t: RoofTri = { p: [this.world(a), this.world(B), this.world(C)], uv: [ua, UB, UC], part, n: w };
    if (hex) t.hex = hex;
    this.out.push(t);
  }
  quad(a: V3, b: V3, c: V3, d: V3, ua: V2, ub: V2, uc: V2, ud: V2, part: RoofPart, hint: V3, hex?: string): void {
    this.tri(a, b, c, ua, ub, uc, part, hint, hex); this.tri(a, c, d, ua, uc, ud, part, hint, hex);
  }

  /** Texture coordinates for a roof face: courses run level, one cell per `cellM` up the slope. */
  slopeUv(p: V3, n: V3): V2 {
    const h = Math.hypot(n[0], n[1]), cell = this.dims.cellM;
    if (h < 0.05) return [p[0] / cell, p[1] / cell];
    const ax = -n[1] / h, ay = n[0] / h;
    return [(p[0] * ax + p[1] * ay) / cell, (p[2] / h) / cell];
  }
  /** A roof face triangle (tiles, slates) with automatic coordinates. */
  slopeTri(a: V3, b: V3, c: V3, hint: V3, part: RoofPart = 'slope', hex?: string): void {
    let n = cross(sub(b, a), sub(c, a));
    if (dot(n, hint) < 0) n = [-n[0], -n[1], -n[2]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    this.tri(a, b, c, this.slopeUv(a, n), this.slopeUv(b, n), this.slopeUv(c, n), part, hint, hex);
  }
  /** A convex planar polygon as a fan of slope triangles. */
  slopePoly(pts: V3[], hint: V3, part: RoofPart = 'slope', hex?: string): void {
    for (let i = 1; i < pts.length - 1; i++) this.slopeTri(pts[0], pts[i], pts[i + 1], hint, part, hex);
  }
  /** A wall-coloured face (plain layer): coordinates in bays along `along` and storeys up. */
  wallUv(along: number, z: number): V2 { return [along / this.dims.bayM, z / this.dims.storeyM]; }
  /** A flat-colour polygon fan (trim, decal): no texture. */
  flatPoly(pts: V3[], part: RoofPart, hint: V3, hex?: string): void {
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], [0, 0], [0, 0], [0, 0], part, hint, hex);
  }
  /** An axis-aligned box in local coordinates, all six faces unless `open` names some (e.g. 'bottom'). */
  box(u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, part: RoofPart, hex?: string, open: ReadonlyArray<'bottom' | 'top' | 'u0' | 'u1' | 'v0' | 'v1'> = []): void {
    const P = (u: number, v: number, z: number): V3 => [u, v, z];
    const f = (name: 'bottom' | 'top' | 'u0' | 'u1' | 'v0' | 'v1', a: V3, b: V3, c: V3, d: V3, hint: V3) => {
      if (!open.includes(name)) this.quad(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1], part, hint, hex);
    };
    f('bottom', P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0), [0, 0, -1]);
    f('top', P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1), [0, 0, 1]);
    f('u0', P(u0, v0, z0), P(u0, v1, z0), P(u0, v1, z1), P(u0, v0, z1), [-1, 0, 0]);
    f('u1', P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1), [1, 0, 0]);
    f('v0', P(u0, v0, z0), P(u1, v0, z0), P(u1, v0, z1), P(u0, v0, z1), [0, -1, 0]);
    f('v1', P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1), [0, 1, 0]);
  }
}
