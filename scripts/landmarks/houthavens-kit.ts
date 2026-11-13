import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ringFrame, type Frame} from './nearbar-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {pointedDormer, type PointedDormerOptions} from '../../src/canalRecall/landmarks/pointedDormer';

/**
 * Shared drawing helpers of the Houthavens landmark lane (de-bonte-zwaan, hotel-boat-and-co; 2026-11-13). Everything
 * is authored in a wall frame (nearbar-kit Frame: t along the wall from the viewer's left, y up, o out of the wall)
 * and collected per colour, so each model hands BuildingTools one geometry per material.
 */
export type V2 = [number, number];
export type Cut = HoledOpening & {back: string; reveal?: string};

export class Mesh {
  private tris = new Map<string, number[]>();
  constructor(private b: BuildingTools) {}
  private push(c: string, ...pts: number[][]) { const a = this.tris.get(c) ?? []; for (const p of pts) a.push(p[0], p[1], p[2]); this.tris.set(c, a); }
  world(f: Frame, t: number, y: number, o: number): number[] {
    return [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
  }
  /** A planar quad in wall coordinates, counter-clockwise seen from outside. */
  quad(f: Frame, q: WallQuad | {pts: number[][]}, c: string) {
    const w = q.pts.map(([t, y, o]) => this.world(f, t, y, o));
    this.push(c, w[0], w[1], w[2], w[0], w[2], w[3]);
  }
  /** Front-facing rectangle at offset o, t0..t1 along, y0..y1 up. */
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: string) {
    this.quad(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]]}, c);
  }
  /** Box in wall coordinates: t0..t1, y0..y1, o0..o1 (o1 > o0); all six faces outward. `skip` drops faces: 'back','bottom','top'. */
  box(f: Frame, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, c: string, skip: string[] = []) {
    const P = (t: number, y: number, o: number) => [t, y, o];
    const faces: [string, number[][]][] = [
      ['front', [P(t0, y0, o1), P(t1, y0, o1), P(t1, y1, o1), P(t0, y1, o1)]],
      ['back', [P(t1, y0, o0), P(t0, y0, o0), P(t0, y1, o0), P(t1, y1, o0)]],
      ['left', [P(t0, y0, o0), P(t0, y0, o1), P(t0, y1, o1), P(t0, y1, o0)]],
      ['right', [P(t1, y0, o1), P(t1, y0, o0), P(t1, y1, o0), P(t1, y1, o1)]],
      ['top', [P(t0, y1, o1), P(t1, y1, o1), P(t1, y1, o0), P(t0, y1, o0)]],
      ['bottom', [P(t0, y0, o0), P(t1, y0, o0), P(t1, y0, o1), P(t0, y0, o1)]],
    ];
    for (const [k, pts] of faces) if (!skip.includes(k)) this.quad(f, {pts}, c);
  }
  /** World triangle wound to face up (`up` true) or down. */
  triFacing(c: string, a: number[], b: number[], d: number[], up = true) {
    const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    if ((ny > 0) === up) this.push(c, a, b, d); else this.push(c, a, d, b);
  }
  /** Raw world triangles. */
  tri(c: string, a: number[], b: number[], d: number[]) { this.push(c, a, b, d); }
  /** Horizontal polygon (native x, z) at height y, facing up (or down). */
  flat(poly: V2[], y: number, c: string, down = false) {
    const g = new T.ShapeGeometry(new T.Shape(poly.map(p => new T.Vector2(p[0], p[1]))));
    const pos = g.getAttribute('position'), idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const v = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)].map(k => [pos.getX(k), y, pos.getY(k)]);
      // ShapeGeometry winds counter-clockwise in (x, y); with z = y and Y up that faces down, so swap for up.
      if (down) this.push(c, v[0], v[1], v[2]); else this.push(c, v[0], v[2], v[1]);
    }
    g.dispose();
  }
  /** Planar polygon in a wall frame at offset o, facing +o. pts as (t, y). */
  facePoly(f: Frame, pts: V2[], o: number, c: string) {
    const g = new T.ShapeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))));
    const pos = g.getAttribute('position'), idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const v = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)].map(k => this.world(f, pos.getX(k), pos.getY(k), o));
      // ShapeGeometry reverses clockwise input; triangles come out counter-clockwise in (t, y), i.e. facing +o.
      this.push(c, v[0], v[1], v[2]);
    }
    g.dispose();
  }
  flush() {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      this.b.add(g, c as never);
    }
    this.tris.clear();
  }
}

/** Frame of ring edge i (outward normal), optionally restricted to t in [ta, tb] (origin moved to ta). */
export function edgeFrame(ring: V2[], i: number, ta = 0): {f: Frame; len: number} {
  const {f, len} = ringFrame(ring, i);
  return {f: {...f, origin: [f.origin[0] + f.tangent[0] * ta, f.origin[1] + f.tangent[1] * ta]}, len};
}

/** Wall on frame f from t = 0..len, y0..y1 with cut openings (backs and reveals coloured per cut). */
export function holed(m: Mesh, f: Frame, len: number, y0: number, y1: number, c: string, cuts: Cut[] = []) {
  const hw = holedWall(len, y0, y1, cuts);
  for (const q of hw.face) m.quad(f, q, c);
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(f, q, cuts[k].reveal ?? c)));
  hw.backs.forEach((q, k) => m.quad(f, q, cuts[k].back));
}

/** Pointed-arch dormer (src/canalRecall/landmarks/pointedDormer.ts) drawn on frame f. */
export function lancetDormer(m: Mesh, f: Frame, o: PointedDormerOptions, cols: {frame: string; roof: string; glass: string; mullion?: string}, mullions = 0) {
  const d = pointedDormer(o);
  for (const q of d.frame) m.quad(f, q, cols.frame);
  for (const q of d.reveal) m.quad(f, q, cols.frame);
  for (const q of d.roof) m.quad(f, q, cols.roof);
  m.facePoly(f, d.window.map(p => [p[0], p[1]] as V2), d.window[0][2], cols.glass);
  const wo = d.window[0][2] + 0.03, r = o.width / 2 - (o.frame ?? 0.18);
  for (let k = 1; k <= mullions; k++) {
    const t = o.t - r + (2 * r * k) / (mullions + 1);
    m.box(f, t - 0.035, t + 0.035, o.y0 + (o.frame ?? 0.18), o.ySpring + (o.yApex - o.ySpring) * 0.55, wo - 0.03, wo + 0.02, cols.mullion ?? cols.frame, ['back']);
  }
}

/** Inset a closed polygon: each edge moved `d[i]` inwards (left-hand side for a counter-clockwise ring in x/z-south is irrelevant: uses ringFrame's outward normal). */
export function inset(poly: V2[], d: number | number[]): V2[] {
  const n = poly.length, off = (i: number) => (Array.isArray(d) ? d[i] : d);
  const lines = poly.map((a, i) => {
    const c = poly[(i + 1) % n], {f} = ringFrame(poly, i);
    return {p: [a[0] - f.n[0] * off(i), a[1] - f.n[1] * off(i)] as V2, d: [c[0] - a[0], c[1] - a[1]] as V2};
  });
  return poly.map((_, i) => {
    const l1 = lines[(i + n - 1) % n], l2 = lines[i];
    const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
    if (Math.abs(den) < 0.01 * Math.hypot(...l1.d) * Math.hypot(...l2.d)) return l2.p;
    const s = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
    return [l1.p[0] + l1.d[0] * s, l1.p[1] + l1.d[1] * s] as V2;
  });
}

/** Sloped band between a ring at y0 and its inset ring at y1 (mansard, hipped eaves): one quad per edge, facing out and up. */
export function loft(m: Mesh, lower: V2[], upper: V2[], y0: number, y1: number, c: string, skip: number[] = []) {
  const n = lower.length;
  // orientation: outward = away from the polygon; decide winding per edge from ringFrame
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    const j = (i + 1) % n, {f} = ringFrame(lower, i);
    const a = [lower[i][0], y0, lower[i][1]], b = [lower[j][0], y0, lower[j][1]], cc = [upper[j][0], y1, upper[j][1]], d = [upper[i][0], y1, upper[i][1]];
    // normal of (a,b,cc): check against outward f.n; flip if needed
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
    const nx = 0 * vz - uz * vy, nz = ux * vy - 0 * vx;
    if (nx * f.n[0] + nz * f.n[1] >= 0) { m.tri(c, a, b, cc); m.tri(c, a, cc, d); }
    else { m.tri(c, a, cc, b); m.tri(c, a, d, cc); }
  }
}

/** Raised letters seen from both sides: the stroke solids plus their mirror, so the backs read from behind (a roof sign). */
export function twoSidedLetters(g: T.BufferGeometry): T.BufferGeometry {
  const pos = g.getAttribute('position'), out: number[] = [];
  for (let i = 0; i < pos.count; i++) out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  for (let i = 0; i < pos.count; i += 3) for (const k of [0, 2, 1]) out.push(pos.getX(i + k), pos.getY(i + k), -pos.getZ(i + k));
  const r = new T.BufferGeometry();
  r.setAttribute('position', new T.Float32BufferAttribute(out, 3));
  r.computeVertexNormals();
  g.dispose();
  return r;
}
