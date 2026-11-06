import * as T from 'three';
import {Acc, ccw, type C} from './tier-kit';
import {edgeNormal, type PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {holedWall, type HoledOpening} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Plan-ring facade helpers for bespoke landmarks (oost-zuid lane, 2026-11-07; first written inside the Boekhuis builder):
 * a wall on a ring edge seen from outside with its openings cut by holedWall, recessed backs and coloured reveals,
 * mullion grids inside an opening, curtain walls, proud bars, and arbitrary planar outlines on a face (an arched or
 * profiled gable end) triangulated in the face's own (t, y) plane. Rings are [x, z] native metres; edges() winds them
 * counter-clockwise so every face points out of the building.
 */
export type V3 = [number, number, number];
export type Op = HoledOpening & {back?: C | null; rev?: C};
/** A wall face on the ring edge a->b, seen from outside: t from the viewer's left end (b) to the right end (a), o outwards. */
export type Face = {L: number; P: (t: number, y: number, o: number) => V3};
export function face(a: PlanPoint, b: PlanPoint): Face {
  const L = Math.hypot(a[0] - b[0], a[1] - b[1]), u = [(a[0] - b[0]) / L, (a[1] - b[1]) / L], n = edgeNormal(a, b);
  return {L, P: (t, y, o) => [b[0] + u[0] * t + n[0] * o, y, b[1] + u[1] * t + n[1] * o]};
}
export function quad(acc: Acc, c: C, p: V3, q: V3, r: V3, s: V3) { acc.tri(c, p, q, r); acc.tri(c, p, r, s); }
export function rect(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o = 0) {
  quad(acc, c, f.P(t0, y0, o), f.P(t1, y0, o), f.P(t1, y1, o), f.P(t0, y1, o));
}
/** A bar standing out of the face from o0 to o1: front, top, bottom, both ends (and its back when `back`, for a bar that rises clear of its wall). */
export function bar(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, back = false) {
  rect(acc, c, f, t0, t1, y0, y1, o1);
  if (back) quad(acc, c, f.P(t1, y0, o0), f.P(t0, y0, o0), f.P(t0, y1, o0), f.P(t1, y1, o0));
  quad(acc, c, f.P(t0, y1, o1), f.P(t1, y1, o1), f.P(t1, y1, o0), f.P(t0, y1, o0));
  quad(acc, c, f.P(t0, y0, o0), f.P(t1, y0, o0), f.P(t1, y0, o1), f.P(t0, y0, o1));
  quad(acc, c, f.P(t0, y0, o0), f.P(t0, y0, o1), f.P(t0, y1, o1), f.P(t0, y1, o0));
  quad(acc, c, f.P(t1, y0, o1), f.P(t1, y0, o0), f.P(t1, y1, o0), f.P(t1, y1, o1));
}
/** The wall from y0 to y1 with its openings cut: face, reveals, recessed backs (none where back is null: a through hole). */
export function wall(acc: Acc, f: Face, y0: number, y1: number, c: C, ops: Op[]) {
  const ok = ops.filter(o => o.t1 > o.t0 + 0.05 && o.y1 > o.y0 + 0.05);
  const w = holedWall(f.L, y0, y1, ok);
  const em = (cc: C, q: {pts: V3[]}) => { const [a, b, d, e] = q.pts.map(([t, y, o]) => f.P(t, y, o)); quad(acc, cc, a, b, d, e); };
  for (const q of w.face) em(c, q);
  w.reveals.forEach((rs, i) => rs.forEach(q => em(ok[i].rev ?? c, q)));
  w.backs.forEach((q, i) => { const bk = ok[i].back; if (bk !== null) em(bk ?? 'glass', q); });
}
/** Mullions (vertical) and transoms inside a recessed opening, `gap` m in front of its back. */
export function glazing(acc: Acc, f: Face, o: Op, c: C, cols: number, rows: number, gap = 0.09) {
  const oo = -o.depth + gap;
  for (let i = 1; i < cols; i++) { const t = o.t0 + (o.t1 - o.t0) * i / cols; rect(acc, c, f, t - 0.045, t + 0.045, o.y0, o.y1, oo); }
  for (let j = 1; j < rows; j++) { const y = o.y0 + (o.y1 - o.y0) * j / rows; rect(acc, c, f, o.t0, o.t1, y - 0.045, y + 0.045, oo + 0.01); }
}
/** A curtain wall: one recessed opening per mullion bay over the whole face, storey transoms across each bay. */
export function curtain(acc: Acc, f: Face, y0: number, y1: number, frame: C, pitch: number, storey: number, glass: C = 'glass') {
  const n = Math.max(1, Math.round(f.L / pitch)), m = 0.06, ops: Op[] = [];
  for (let i = 0; i < n; i++) ops.push({t0: f.L * i / n + m, t1: f.L * (i + 1) / n - m, y0: y0 + 0.15, y1: y1 - 0.15, depth: 0.17, back: glass, rev: frame});
  wall(acc, f, y0, y1, frame, ops);
  const k = Math.max(1, Math.round((y1 - y0) / storey));
  for (const o of ops) for (let j = 1; j < k; j++) { const y = y0 + (y1 - y0) * j / k; rect(acc, frame, f, o.t0, o.t1, y - 0.06, y + 0.06, -0.06); }
}
/** Edges of a ring as faces (the ring wound counter-clockwise first), with their outward normals. */
export function edges(r: PlanPoint[]) {
  const c = ccw(r);
  return c.map((a, i) => { const b = c[(i + 1) % c.length]; return {a, b, f: face(a, b), n: edgeNormal(a, b)}; });
}
export const shape = (r: PlanPoint[]) => [[ccw(r)]];
/** A plan point `o` metres out of the face at t. */
export const pl = (f: Face, t: number, o: number): PlanPoint => { const p = f.P(t, 0, o); return [p[0], p[2]]; };
/**
 * A planar outline on a face, `o` metres out, as triangles facing outwards: `outline` is [t, y] counter-clockwise as
 * seen from outside (holes clockwise). For arched or profiled ends that no rectangle can describe.
 */
export function outline(acc: Acc, c: C, f: Face, ring: [number, number][], o = 0, holes: [number, number][][] = []) {
  const s = new T.Shape(ring.map(([t, y]) => new T.Vector2(t, y)));
  for (const h of holes) s.holes.push(new T.Path(h.map(([t, y]) => new T.Vector2(t, y))));
  const g = new T.ShapeGeometry(s), p = g.getAttribute('position'), ix = g.index!;
  for (let i = 0; i < ix.count; i += 3) {
    const v = [0, 1, 2].map(k => f.P(p.getX(ix.getX(i + k)), p.getY(ix.getX(i + k)), o));
    acc.tri(c, v[0], v[1], v[2]);
  }
  g.dispose();
}
