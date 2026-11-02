import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';

/**
 * Zone walls for hand-built landmark facades (politie lane #206): wall frames on BAG ring edges, a per-material triangle
 * batcher, and `emitZone`, which cuts a rectangle of a wall (face material plus openings with their own reveal and back
 * materials) into holedWall quads. Shared by the two police-station builders; geometry-identical to the code it was
 * lifted from in politie-nieuwezijds-voorburgwal-builder.ts.
 */
export type C = Parameters<BuildingTools['add']>[1];
export type P = PlanPoint;
export type Frame = {o: P; t: P; n: P};
export const ringArea = (r: P[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Frame of a wall whose outward normal is n: t runs viewer-left to viewer-right seen from outside, (t, y, o) right-handed. */
export function frameFor(a: P, c: P, n: P): {f: Frame; len: number} {
  const t: P = [n[1], -n[0]], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const fwd = (c[0] - a[0]) * t[0] + (c[1] - a[1]) * t[1] > 0;
  return {f: {o: fwd ? a : c, t, n}, len};
}
export function ringOut(ring: P[], i: number): P {
  const a = ring[i], c = ring[(i + 1) % ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), s = ringArea(ring) > 0 ? 1 : -1;
  return [s * (c[1] - a[1]) / L, -s * (c[0] - a[0]) / L];
}
export const at = (f: Frame, t: number, o = 0): P => [f.o[0] + f.t[0] * t + f.n[0] * o, f.o[1] + f.t[1] * t + f.n[1] * o];
export const shift = (f: Frame, t: number): Frame => ({...f, o: at(f, t)});
export const yaw = (n: P) => Math.atan2(n[0], n[1]);

/** Frame of BAG ring edge i (t from the viewer's left seen from outside). */
export const bagFrame = (RING: P[], i: number) => frameFor(RING[i], RING[(i + 1) % RING.length], ringOut(RING, i));
/** An opening: holedWall cut plus its back (pane) and reveal materials. */
export type Cut = HoledOpening & {back: C; reveal?: C};
/** A rectangle of one wall in its own t (viewer-left origin), with its face material and the openings cut through it. */
export type Zone = {t0: number; t1: number; y0: number; y1: number; face: C; cuts: Cut[]};
/**
 * `pad`: keep openings this far inside a run edge that has no wall beyond it in the same plane (a roof below or above, the
 * run's ends at a corner), so every pane has wall round it (the opening-outside audit judges a pane against its wall's
 * silhouette; a ribbon cut flush to a roof line reads as glass standing past the wall).
 */
export type Pad = {b: number; t: number; ends: number};
export class ZoneMesh {
  constructor(private readonly b: BuildingTools) {}
  private tris = new Map<C, number[]>();
  private push(c: C, ...v: number[]) { let a = this.tris.get(c); if (!a) this.tris.set(c, a = []); a.push(...v); }
  quad(f: Frame, q: WallQuad, c: C) {
    const w = q.pts.map(([t, y, o]) => { const p = at(f, t, o); return [p[0], y, p[1]]; });
    this.push(c, ...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
  }
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: C) {
    this.quad(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], normal: [0, 0, 1]}, c);
  }
  /** Proud bar: front face plus the four sides, back at o = 0. */
  bar(f: Frame, t0: number, t1: number, y0: number, y1: number, d: number, c: C, back = 0) {
    this.rect(f, t0, t1, y0, y1, d, c);
    this.quad(f, {pts: [[t0, y1, back], [t0, y1, d], [t1, y1, d], [t1, y1, back]], normal: [0, 1, 0]}, c);
    this.quad(f, {pts: [[t0, y0, back], [t1, y0, back], [t1, y0, d], [t0, y0, d]], normal: [0, -1, 0]}, c);
    this.quad(f, {pts: [[t0, y0, back], [t0, y0, d], [t0, y1, d], [t0, y1, back]], normal: [-1, 0, 0]}, c);
    this.quad(f, {pts: [[t1, y0, back], [t1, y1, back], [t1, y1, d], [t1, y0, d]], normal: [1, 0, 0]}, c);
  }
  /** Horizontal polygon at height y facing up or down. */
  flat(ring: P[], y: number, c: C, up: boolean) {
    const g = new T.ShapeGeometry(new T.Shape(ring.map(p => new T.Vector2(p[0], p[1]))));
    const pos = g.getAttribute('position'), idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
      const v = ids.map(k => [pos.getX(k), y, pos.getY(k)]);
      const nY = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
      if ((nY > 0) === up) this.push(c, ...v[0], ...v[1], ...v[2]); else this.push(c, ...v[0], ...v[2], ...v[1]);
    }
  }
  flush() {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      this.b.add(g, c);
    }
    this.tris.clear();
  }
  /** Holed wall for the part of zone z inside t in [ra, rb], y in [ya, yb] (t in the zone's frame f). */
  emitZone(f: Frame, z: Zone, ra: number, rb: number, ya: number, yb: number, pad: Pad = {b: 0, t: 0, ends: 0}) {
    const t0 = Math.max(z.t0, ra), t1 = Math.min(z.t1, rb), y0 = Math.max(z.y0, ya), y1 = Math.min(z.y1, yb);
    if (t1 - t0 < 0.02 || y1 - y0 < 0.02) return;
    const lo = y0 <= ya + 1e-3 ? y0 + pad.b : y0, hi = y1 >= yb - 1e-3 ? y1 - pad.t : y1;
    const L = t1 - t0, left = t0 <= ra + 1e-3 ? pad.ends : 0, right = t1 >= rb - 1e-3 ? pad.ends : 0;
    const g = shift(f, t0), cuts = z.cuts.map(c => ({...c, t0: Math.max(c.t0 - t0, Math.min(left, c.t1 - t0 - 0.05)), t1: Math.min(c.t1 - t0, Math.max(L - right, c.t0 - t0 + 0.05)), y0: Math.max(c.y0, Math.min(lo, c.y1 - 0.05)), y1: Math.min(c.y1, Math.max(hi, c.y0 + 0.05))}))
      .filter(c => c.t1 > 1e-3 && c.t0 < L - 1e-3 && c.y1 > y0 + 1e-3 && c.y0 < y1 - 1e-3 && c.t1 - c.t0 > 0.04 && c.y1 - c.y0 > 0.04);
    const hw = holedWall(t1 - t0, y0, y1, cuts);
    for (const q of hw.face) this.quad(g, q, z.face);
    hw.reveals.forEach((qs, k) => qs.forEach(q => this.quad(g, q, cuts[k].reveal ?? z.face)));
    hw.backs.forEach((q, k) => this.quad(g, q, cuts[k].back));
  }
}
/** The BAG ring edge a plan segment lies on (within 0.25 m), with the segment's t range on that edge. */
export function onBagEdge(RING: P[], a: P, c: P): {i: number; ta: number; tb: number} | null {
  for (let i = 0; i < RING.length; i++) {
    const {f, len} = bagFrame(RING, i);
    const loc = (p: P) => [(p[0] - f.o[0]) * f.t[0] + (p[1] - f.o[1]) * f.t[1], (p[0] - f.o[0]) * f.n[0] + (p[1] - f.o[1]) * f.n[1]];
    const [ta, oa] = loc(a), [tb, ob] = loc(c);
    if (Math.abs(oa) < 0.25 && Math.abs(ob) < 0.25 && Math.min(ta, tb) > -0.3 && Math.max(ta, tb) < len + 0.3 && Math.abs(tb - ta) > 0.01) return {i, ta: Math.min(ta, tb), tb: Math.max(ta, tb)};
  }
  return null;
}
export const inside = (p: P, r: P[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };

