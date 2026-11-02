import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {GL, type Frame} from './nearbar-kit';
import {edgeNormal, type PlanPoint, type PlanPolygon} from '../../src/canalRecall/landmarks/roofTiers';

/**
 * Plan-edge facade kit for tiered modern blocks (WTC Amsterdam lane, 2026-11-02; reused by the Volkshotel): one
 * triangle buffer per colour, outward wall quads on plan-ring edges, proud strips (bands, transoms), fins (mullions,
 * piers), closed edge boxes, flat roofs with holes, tubes and single-quad pixel lettering. Plan rings are [x, z] native
 * metres wound counter-clockwise (outer) as roofTiers winds them, so edgeNormal points out of the building.
 */
export type C = Parameters<BuildingTools['add']>[1];

export function inside(p: PlanPoint, r: PlanPoint[]) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}
export class Acc {
  private pos = new Map<C, number[]>();
  constructor(private b: BuildingTools) {}
  tri(c: C, a: number[], b: number[], d: number[]) { let p = this.pos.get(c); if (!p) this.pos.set(c, p = []); p.push(...a, ...b, ...d); }
  /**
   * Quad a-b-d-e listed counter-clockwise as seen from BEHIND the face (the order a plan ring gives: walking a
   * counter-clockwise (x, z) ring runs to the viewer's left), so the triangles are wound the other way round.
   */
  quad(c: C, a: number[], b: number[], d: number[], e: number[]) { this.tri(c, a, d, b); this.tri(c, a, e, d); }
  flush() {
    for (const [c, p] of this.pos) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      g.computeVertexNormals();
      this.b.add(g, c);
    }
    this.pos.clear();
  }
}
/** Outward vertical quad on the plan edge a->b (outward normal n), from y0 to y1, `out` metres proud. */
export function wallQuad(acc: Acc, c: C, a: PlanPoint, b: PlanPoint, y0: number, y1: number, out = 0) {
  const n = edgeNormal(a, b), A = [a[0] + n[0] * out, a[1] + n[1] * out], B = [b[0] + n[0] * out, b[1] + n[1] * out];
  acc.quad(c, [A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]]);
}
/**
 * A strip proud of a wall edge: front face plus top and bottom (6 tris), its back on the wall plane. `t0`/`t1` trim the
 * strip along the edge (metres from a); `back` is where its top and bottom stop (0 = on the wall plane, where a
 * roof or soffit meets the wall at the strip's edge).
 */
export function strip(acc: Acc, c: C, a: PlanPoint, b: PlanPoint, t0: number, t1: number, y0: number, y1: number, d: number, back = -0.02) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), u = [dx / L, dz / L], n = edgeNormal(a, b);
  const P = (t: number, o: number) => [a[0] + u[0] * t + n[0] * o, a[1] + u[1] * t + n[1] * o];
  const [p0, p1, q0, q1] = [P(t0, d), P(t1, d), P(t0, back), P(t1, back)];
  acc.quad(c, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]);   // front
  acc.quad(c, [q0[0], y1, q0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [q1[0], y1, q1[1]]);   // top
  acc.quad(c, [q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [p1[0], y0, p1[1]], [p0[0], y0, p0[1]]);   // bottom
}
/** A closed box along a plan edge: from `back` to `front` metres out (negative = inside), t0..t1 along the edge. */
export function edgeBox(b: BuildingTools, c: C, a: PlanPoint, e: PlanPoint, t0: number, t1: number, y0: number, y1: number, back: number, front: number) {
  const dx = e[0] - a[0], dz = e[1] - a[1], L = Math.hypot(dx, dz), u = [dx / L, dz / L], n = edgeNormal(a, e);
  const g = new T.BoxGeometry(t1 - t0, y1 - y0, front - back);
  g.rotateY(-Math.atan2(u[1], u[0]));
  const tm = (t0 + t1) / 2, om = (back + front) / 2;
  g.translate(a[0] + u[0] * tm + n[0] * om, (y0 + y1) / 2, a[1] + u[1] * tm + n[1] * om);
  b.add(g, c);
}
/** A vertical fin proud of a wall edge at t: front and both sides (6 tris). */
export function fin(acc: Acc, c: C, a: PlanPoint, b: PlanPoint, t: number, w: number, y0: number, y1: number, d: number) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), u = [dx / L, dz / L], n = edgeNormal(a, b);
  const P = (tt: number, o: number) => [a[0] + u[0] * tt + n[0] * o, a[1] + u[1] * tt + n[1] * o];
  const [l0, r0, l1, r1] = [P(t - w / 2, -0.005), P(t + w / 2, -0.005), P(t - w / 2, d), P(t + w / 2, d)];
  acc.quad(c, [l1[0], y0, l1[1]], [r1[0], y0, r1[1]], [r1[0], y1, r1[1]], [l1[0], y1, l1[1]]);
  acc.quad(c, [r1[0], y0, r1[1]], [r0[0], y0, r0[1]], [r0[0], y1, r0[1]], [r1[0], y1, r1[1]]);
  acc.quad(c, [l0[0], y0, l0[1]], [l1[0], y0, l1[1]], [l1[0], y1, l1[1]], [l0[0], y1, l0[1]]);
}
export function roof(b: BuildingTools, polys: PlanPolygon[], y: number, c: C) {
  for (const [outer, ...holes] of polys) {
    const s = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
    for (const h of holes) s.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
    b.add(upwardRoofPlane(s, y), c);
  }
}
/** A round (or square, sides = 4) tube between two points. */
export function tube(a: PlanPoint, ya: number, c: PlanPoint, yc: number, r: number, sides = 4) {
  const A = new T.Vector3(a[0], ya, a[1]), B = new T.Vector3(c[0], yc, c[1]), d = B.clone().sub(A);
  const g = new T.CylinderGeometry(r, r, d.length(), sides, 1, true);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
  const m = A.add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}
/** Pixel lettering as single front quads `out` m proud of the frame plane (2 triangles per glyph run, not 12). */
export function flatLetters(acc: Acc, f: Frame, text: string, t: number, y: number, out: number, px: number, c: C) {
  const total = ([...text].length * 6 - 1) * px; let u = t - total / 2;
  const P = (tt: number, yy: number) => [f.origin[0] + f.tangent[0] * tt + f.n[0] * out, yy, f.origin[1] + f.tangent[1] * tt + f.n[1] * out];
  for (const ch of text) {
    const rows = GL[ch] ?? [];
    rows.forEach((row, j) => {
      let k = 0;
      while (k < 5) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < 5 && row[e] === '1') e++;
        const y0 = y + (6 - j) * px, t0 = u + k * px, t1 = u + e * px;
        acc.quad(c, P(t0, y0), P(t0, y0 + px), P(t1, y0 + px), P(t1, y0));   // frame tangent runs to the viewer's right
        k = e;
      }
    });
    u += 6 * px;
  }
}
/** A downward-facing horizontal plane (soffit, underside of an overhang) over plan polygons at height y. */
export function soffit(b: BuildingTools, polys: PlanPolygon[], y: number, c: C) {
  for (const [outer, ...holes] of polys) {
    const s = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
    for (const h of holes) s.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
    const g = upwardRoofPlane(s, y), ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) { const j = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, j); }
    g.computeVertexNormals();
    b.add(g, c);
  }
}
/** Counter-clockwise copy of a plan ring (positive shoelace in x, z), the winding edgeNormal expects of an outer ring. */
export function ccw(r: PlanPoint[]): PlanPoint[] {
  const a = r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  return a > 0 ? r : [...r].reverse();
}
