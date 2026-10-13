import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {onWall, type Wall} from './worship-walls';
import {openTopPrism} from './house-geometry';

type Colour = Parameters<BuildingTools['add']>[1];
export type P2 = [number, number];

/** Convex planar polygon fan, wound so the face looks along `outward` (x,y,z hint). */
export function facePoly(b: BuildingTools, pts: number[][], colour: Colour | string, outward: number[], role?: 'roof') {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3));
  const A = new T.Vector3(...pts[0]), idx: number[] = [];
  const hint = new T.Vector3(...outward);
  for (let i = 1; i < pts.length - 1; i++) {
    const B = new T.Vector3(...pts[i]), C = new T.Vector3(...pts[i + 1]);
    const n = B.clone().sub(A).cross(C.clone().sub(A));
    if (n.dot(hint) >= 0) idx.push(0, i, i + 1); else idx.push(0, i + 1, i);
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  if (role) g.userData.role = role;
  b.add(g, colour as never);
}

/** A wall along ring/world segment p->q whose outward normal is `out`; height h (rectangular outline). */
export function wallBetween(p: P2, q: P2, h: number, out: P2, base = 0): Wall {
  const l = Math.hypot(out[0], out[1]), n: P2 = [out[0] / l, out[1] / l];
  const tangent: P2 = [n[1], -n[0]];
  let a = p, c = q;
  if ((c[0] - a[0]) * tangent[0] + (c[1] - a[1]) * tangent[1] < 0) [a, c] = [c, a];
  const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
  return {n, origin: a, tangent, length, base, poly: [[0, base], [length, base], [length, base + h], [0, base + h]], index: -1};
}

/** Ring edge i as a wall (outward auto-oriented by ring winding). */
export function edgeWall(ring: number[][], i: number, h: number): Wall {
  const r = ring.slice(0, ring.length - 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? -1 : undefined);
  let area = 0;
  r.forEach((p, k) => { const q = r[(k + 1) % r.length]; area += p[0] * q[1] - q[0] * p[1]; });
  const sgn = area > 0 ? 1 : -1;
  const p = r[i], q = r[(i + 1) % r.length], dx = q[0] - p[0], dz = q[1] - p[1];
  return wallBetween([p[0], p[1]], [q[0], q[1]], h, [dz * sgn, -dx * sgn]);
}

/** Position along a wall to world (x,z). */
export const wallPoint = (w: Wall, t: number, out = 0): P2 => [w.origin[0] + w.tangent[0] * t + w.n[0] * out, w.origin[1] + w.tangent[1] * t + w.n[1] * out];

/** Quadrilateral block: a runs along the ridges (0..1), c across the gables (0..1). Corners are (x,z). */
export type Quad = {p00: P2; p10: P2; p01: P2; p11: P2};
export const at = (f: Quad, a: number, c: number): P2 => [
  (1 - a) * (1 - c) * f.p00[0] + a * (1 - c) * f.p10[0] + (1 - a) * c * f.p01[0] + a * c * f.p11[0],
  (1 - a) * (1 - c) * f.p00[1] + a * (1 - c) * f.p10[1] + (1 - a) * c * f.p01[1] + a * c * f.p11[1],
];

/**
 * A hall under N parallel steep gables (ridges run a: 0->1). Walls are closed up to `eave`; each gable has two roof planes
 * and triangular gable ends at a=0 and a=1.
 */
export function gabledHall(b: BuildingTools, f: Quad, o: {eave: number; ridge: number; gables?: number; wall: string; roof: string; y0?: number; endGables?: boolean[]; solidWalls?: boolean}) {
  const n = o.gables ?? 1, y0 = o.y0 ?? 0;
  const pt = (a: number, c: number, y: number) => { const q = at(f, a, c); return [q[0], y, q[1]]; };
  const sh = new T.Shape([new T.Vector2(...at(f, 0, 0)), new T.Vector2(...at(f, 1, 0)), new T.Vector2(...at(f, 1, 1)), new T.Vector2(...at(f, 0, 1))]);
  if (o.solidWalls !== false) b.add(openTopPrism(sh, y0, o.eave), o.wall as never);
  const outAcross = (c: number): number[] => { const q0 = at(f, 0.5, c - 0.01), q1 = at(f, 0.5, c + 0.01); const d = [q1[0] - q0[0], q1[1] - q0[1]], l = Math.hypot(d[0], d[1]); return [d[0] / l, d[1] / l]; };
  const rise = o.ridge - o.eave;
  for (let k = 0; k < n; k++) {
    const c0 = k / n, c1 = (k + 1) / n, cm = (c0 + c1) / 2;
    const dv = outAcross(cm), hw = Math.hypot(...[0, 1].map(i => at(f, 0.5, c1)[i] - at(f, 0.5, c0)[i])) / 2, s = Math.hypot(hw, rise);
    facePoly(b, [pt(0, c0, o.eave), pt(1, c0, o.eave), pt(1, cm, o.ridge), pt(0, cm, o.ridge)], o.roof, [-dv[0] * rise / s, hw / s, -dv[1] * rise / s], 'roof');
    facePoly(b, [pt(0, c1, o.eave), pt(0, cm, o.ridge), pt(1, cm, o.ridge), pt(1, c1, o.eave)], o.roof, [dv[0] * rise / s, hw / s, dv[1] * rise / s], 'roof');
    const ua = [at(f, 1, cm)[0] - at(f, 0, cm)[0], at(f, 1, cm)[1] - at(f, 0, cm)[1]], ul = Math.hypot(ua[0], ua[1]);
    if (o.endGables?.[0] !== false) facePoly(b, [pt(0, c0, o.eave), pt(0, cm, o.ridge), pt(0, c1, o.eave)], o.wall, [-ua[0] / ul, 0, -ua[1] / ul]);
    if (o.endGables?.[1] !== false) facePoly(b, [pt(1, c0, o.eave), pt(1, c1, o.eave), pt(1, cm, o.ridge)], o.wall, [ua[0] / ul, 0, ua[1] / ul]);
  }
}

/** Flat or shed roof cap over a polygon (uses upward triangulation). */
export function shedRoof(b: BuildingTools, quad: P2[], yLow: number[], colour: string) {
  facePoly(b, quad.map((p, i) => [p[0], yLow[i], p[1]]), colour, [0, 1, 0], 'roof');
}

/** Pointed or round-arched window with a stone surround, flush on a wall. depth is the surround thickness. */
export function archWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number, o: {pointed?: boolean; trim?: string; glass?: string; mullions?: number; round?: boolean} = {}) {
  const trim = o.trim ?? 'stone', glass = o.glass ?? 'glass';
  const rise = o.pointed ? wd * 0.75 : wd / 2, r0 = h - rise;
  const outline = (dx: number, top: number, bottom: number, grow: number) => {
    const s = new T.Shape(), hw = dx / 2 + grow;
    s.moveTo(-hw, bottom);
    s.lineTo(hw, bottom);
    s.lineTo(hw, r0 + bottom * 0);
    if (o.pointed) { s.quadraticCurveTo(hw, r0 + rise * 0.7 + grow, 0, top + grow); s.quadraticCurveTo(-hw, r0 + rise * 0.7 + grow, -hw, r0); } else { s.absarc(0, r0, hw, 0, Math.PI, false); }
    s.lineTo(-hw, bottom);
    return s;
  };
  const place = (g: T.BufferGeometry, colour: string, out: number, tag?: string) => {
    g.rotateY(Math.atan2(w.n[0], w.n[1]));
    const p = wallPoint(w, t, out);
    g.translate(p[0], w.base + y, p[1]);
    if (tag) g.userData.tag = tag;
    b.add(g, colour as never);
  };
  place(new T.ExtrudeGeometry(outline(wd, h, 0, 0.22), {depth: 0.1, bevelEnabled: false}), trim, 0);
  place(new T.ExtrudeGeometry(outline(wd, h, 0, 0), {depth: 0.08, bevelEnabled: false}), glass, 0.1, 'pane');
  const m = o.mullions ?? (wd > 1.4 ? 2 : 1);
  for (let k = 1; k <= m; k++) onWall(b, w, t - wd / 2 + wd * k / (m + 1), y, 0.07, r0, 0.1, 'frame', 0.1);
  for (const yy of [0.35, 0.65]) onWall(b, w, t, y + r0 * yy, wd - 0.1, 0.06, 0.1, 'frame', 0.1);
}

/** Round (oculus) window flush on a wall. */
export function oculus(b: BuildingTools, w: Wall, t: number, y: number, r: number, trim = 'stone') {
  const place = (g: T.BufferGeometry, colour: string, out: number, tag?: string) => {
    g.rotateX(Math.PI / 2);
    g.rotateY(Math.atan2(w.n[0], w.n[1]));
    const p = wallPoint(w, t, out);
    g.translate(p[0] + w.n[0] * 0.05, w.base + y, p[1] + w.n[1] * 0.05);
    if (tag) g.userData.tag = tag;
    b.add(g, colour as never);
  };
  place(new T.CylinderGeometry(r + 0.18, r + 0.18, 0.1, 14), trim, 0);
  place(new T.CylinderGeometry(r, r, 0.12, 14), 'glass', 0.03, 'pane');
}
