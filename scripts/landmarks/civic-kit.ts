import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
export type Col = Parameters<BuildingTools['add']>[1];

/** Local metres: x east, z south, anchored at the footprint file's `anchor`. */
export const v2 = (p: number[]) => new T.Vector2(p[0], p[1]);
export function ringPoints(ring: number[][]): T.Vector2[] {
  const pts = ring.map(v2);
  if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  return pts;
}
export function inside(pts: T.Vector2[], p: T.Vector2): boolean {
  let yes = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}
export interface Edge { p: T.Vector2; q: T.Vector2; u: T.Vector2; out: T.Vector2; len: number; angle: number; mid: T.Vector2 }
/** Edge frames with a guaranteed outward normal (tested against the ring). */
export function edgesOf(pts: T.Vector2[]): Edge[] {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length], d = q.clone().sub(p), len = d.length(), u = d.clone().divideScalar(len || 1);
    let out = new T.Vector2(-u.y, u.x);
    const mid = p.clone().lerp(q, .5);
    if (inside(pts, mid.clone().addScaledVector(out, .05))) out = out.negate();
    return { p, q, u, out, len, angle: Math.atan2(out.x, out.y), mid };
  });
}
/** Place a box on an edge. t = distance from p along the edge to the box centre, off = distance outward. */
export function edgeBox(b: BuildingTools, e: Edge, t: number, y: number, w: number, h: number, d: number, off: number, c: Col) {
  const pt = e.p.clone().addScaledVector(e.u, t).addScaledVector(e.out, off);
  b.box(pt.x, y, pt.y, w, h, d, c, e.angle);
}
/** Triangle fan from points (>=3), wound so the normal faces up when `up` is set. */
export function surface(b: BuildingTools, points: T.Vector3[], c: Col, up = false) {
  const verts: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    let v = [points[0], points[i], points[i + 1]];
    const n = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
    if (up && n.y < 0) v = [v[0], v[2], v[1]];
    for (const p of v) verts.push(p.x, p.y, p.z);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  b.add(g, c);
}
export const p3 = (p: T.Vector2, y: number) => new T.Vector3(p.x, y, p.y);
/** Wall prism with no top cap (the roof owns the top). */
export function walls(b: BuildingTools, pts: T.Vector2[], bottom: number, top: number, c: Col) {
  b.add(openTopPrism(new T.Shape(pts), bottom, top), c);
}
export function flatRoof(b: BuildingTools, pts: T.Vector2[], y: number, c: Col) {
  b.add(upwardRoofPlane(new T.Shape(pts), y), c);
}
/** Expand a convex quad outward by `oh` metres per edge. */
export function growQuad(q: T.Vector2[], oh: number): T.Vector2[] {
  const es = edgesOf(q);
  return es.map((e, i) => {
    const prev = es[(i + es.length - 1) % es.length];
    // corner i is shared by prev (ending at p) and e (starting at p)
    return e.p.clone().addScaledVector(e.out, oh).addScaledVector(prev.out, oh);
  });
}
/**
 * Hipped roof over a quad (4 corners). Ridge runs along the long axis.
 * `ridgeHalf` overrides the equal-pitch ridge half-length (0 gives a pyramid).
 */
export function hipRoof(b: BuildingTools, quad: T.Vector2[], eaveY: number, ridgeY: number, c: Col, opts: {overhang?: number; ridgeHalf?: number; sag?: number} = {}) {
  const oh = opts.overhang ?? 0;
  const base = oh ? growQuad(quad, oh) : quad;
  const ey = eaveY - (opts.sag ?? 0);
  const c0 = quad.reduce((s, p) => s.add(p), new T.Vector2()).divideScalar(4);
  const a = quad[1].clone().sub(quad[0]), bb = quad[2].clone().sub(quad[1]);
  const longA = a.length() >= bb.length(), L = longA ? a : bb, S = longA ? bb : a;
  const half = opts.ridgeHalf ?? Math.max(0, (L.length() - S.length()) / 2);
  const r1 = c0.clone().addScaledVector(L.clone().normalize(), half), r0 = c0.clone().addScaledVector(L.clone().normalize(), -half);
  const R = (p: T.Vector2) => p3(p, ridgeY);
  const E = (p: T.Vector2) => p3(p, ey);
  // Which ridge end is nearer to each corner decides the face split.
  const near = (p: T.Vector2) => (p.distanceTo(r0) <= p.distanceTo(r1) ? r0 : r1);
  const n = base.length;
  for (let i = 0; i < n; i++) {
    const p = base[i], q = base[(i + 1) % n];
    const rp = near(p), rq = near(q);
    if (rp === rq) surface(b, [E(p), E(q), R(rp)], c, true);
    else surface(b, [E(p), E(q), R(rq), R(rp)], c, true);
  }
}
/** Gable roof over a quad: ridge along the long axis, gable triangles on the short ends. */
export function gableRoofQuad(b: BuildingTools, quad: T.Vector2[], eaveY: number, ridgeY: number, c: Col, gableC: Col, oh = 0) {
  const a = quad[1].clone().sub(quad[0]), bb = quad[2].clone().sub(quad[1]);
  const longA = a.length() >= bb.length();
  // corners: if ridge along a, short edges are quad[1]-quad[2] and quad[3]-quad[0]
  const [s0, s1, t0, t1] = longA ? [quad[1], quad[2], quad[3], quad[0]] : [quad[0], quad[1], quad[2], quad[3]];
  const m0 = s0.clone().lerp(s1, .5), m1 = t0.clone().lerp(t1, .5);
  const ext = oh ? growQuad(quad, oh) : quad;
  const [e0, e1, f0, f1] = longA ? [ext[1], ext[2], ext[3], ext[0]] : [ext[0], ext[1], ext[2], ext[3]];
  void e0; void e1; void f0; void f1;
  surface(b, [p3(s0, eaveY), p3(m0, ridgeY), p3(m1, ridgeY), p3(t1, eaveY)], c, true);
  surface(b, [p3(s1, eaveY), p3(t0, eaveY), p3(m1, ridgeY), p3(m0, ridgeY)], c, true);
  surface(b, [p3(s0, eaveY), p3(s1, eaveY), p3(m0, ridgeY)], gableC);
  surface(b, [p3(t0, eaveY), p3(t1, eaveY), p3(m1, ridgeY)], gableC);
}
/** Framed window on an edge: white surround, dark frame, glass, optional mullion/transom. */
export function edgeWindow(b: BuildingTools, e: Edge, t: number, y: number, w: number, h: number, opts: {frame?: Col; surround?: Col; mullions?: number; transom?: boolean; sill?: boolean} = {}) {
  const fr = opts.frame ?? 'white', sr = opts.surround ?? 'white';
  edgeBox(b, e, t, y - .06, w + .16, h + .12, .08, .04, sr);
  edgeBox(b, e, t, y, w, h, .06, .09, 'glass');
  const m = opts.mullions ?? 1;
  for (let i = 1; i < m + 1 && m > 1; i++) edgeBox(b, e, t - w / 2 + (w * i) / m, y, .05, h, .07, .11, fr);
  if (m === 1) edgeBox(b, e, t, y, .05, h, .07, .11, fr);
  if (opts.transom !== false) edgeBox(b, e, t, y + h * .62, w, .05, .07, .11, fr);
  if (opts.sill !== false) edgeBox(b, e, t, y - .1, w + .3, .07, .2, .1, 'stone');
}
/** Door with surround. */
export function edgeDoor(b: BuildingTools, e: Edge, t: number, y: number, w: number, h: number, c: Col = 'dark', surround: Col = 'white') {
  edgeBox(b, e, t, y, w + .24, h + .12, .08, .04, surround);
  edgeBox(b, e, t, y, w, h, .1, .08, c);
}
export function bar(b: BuildingTools, a: T.Vector3, c: T.Vector3, r: number, col: Col) {
  const d = c.clone().sub(a), g = new T.CylinderGeometry(r, r, d.length(), 6);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
  const mid = a.clone().add(c).multiplyScalar(.5);
  b.add(g, col, mid.x, mid.y, mid.z);
}

export interface LodSurface { type: string; rings: number[][][] }
/**
 * 3DBAG LoD2.2 surfaces already converted to local metres (x east, y up above
 * maaiveld, z south). The conversion mirrors handedness, so the stored winding
 * is inverted: emit triangles against the Newell normal to face outward.
 */
export function lodSurfaces(b: BuildingTools, surfaces: LodSurface[], types: string[], c: Col) {
  const pos: number[] = [];
  for (const s of surfaces) {
    if (!types.includes(s.type)) continue;
    const outer = s.rings[0].map(p => new T.Vector3(p[0], p[1], p[2]));
    const n = new T.Vector3();
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], q = outer[(i + 1) % outer.length];
      n.x += (a.y - q.y) * (a.z + q.z); n.y += (a.z - q.z) * (a.x + q.x); n.z += (a.x - q.x) * (a.y + q.y);
    }
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    const ref = Math.abs(n.y) < .9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
    const u = ref.clone().cross(n).normalize(), v = n.clone().cross(u);
    const flat = (p: T.Vector3) => new T.Vector2(p.dot(u), p.dot(v));
    const contour = outer.map(flat);
    const holes = s.rings.slice(1).map(r => r.map(p => flat(new T.Vector3(p[0], p[1], p[2]))));
    const all = [...outer, ...s.rings.slice(1).flatMap(r => r.map(p => new T.Vector3(p[0], p[1], p[2])))];
    const tris = T.ShapeUtils.triangulateShape(contour, holes);
    for (const [i, j, k] of tris) {
      let tri = [all[i], all[j], all[k]];
      const g = tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));
      if (g.dot(n) < 0) tri = [tri[0], tri[2], tri[1]]; // calibrated: outward = +Newell of the mirrored ring
      for (const p of tri) pos.push(p.x, p.y, p.z);
    }
  }
  if (!pos.length) return;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, c);
}
