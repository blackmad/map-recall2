/**
 * Droogbak 1A (BAG pand 0363100012171155, 1884; former head office of the Hollandsche IJzeren Spoorweg-Maatschappij,
 * Rijksmonument 518416). Every part below comes from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed in
 * scripts/landmarks/droogbak-inventory.json and scripts/landmarks/droogbak-brief.md; nothing is described from memory.
 *
 *  - A near-square block (four ~50 m fronts) round an open courtyard: BAG outline and the 3DBAG courtyard walls
 *    (scripts/landmarks/droogbak-prepare.ts, 3DBAG CC BY 4.0, BAG CC0).
 *  - Grey rusticated granite basement (0-2.3 m) with barred windows and red basement doors; above it three storeys of
 *    red brick banded with cream natural-stone courses: round-arched bel-etage windows, first-floor windows under
 *    radiating (sunburst) voussoirs or segmental pediments, second-floor windows under hoods with a V keystone; a cream
 *    frieze and a deep bracketed (modillion) cornice at 17.4-19.3 m (w03-36, w04-36, w05-222, w08-126, w01-222).
 *  - Corner pavilions: an attic turret over each corner with paired round-arched lights, cornice, cap and finial
 *    (w08-126 centred on the 10 m pavilion face, w03-36/w04-36 over the oriel 4 m from the corner); the two corner
 *    oriels of the Droogbak (NE) front on carved consoles; paired-window corner bays on the SW front (w01-222).
 *  - Centres: the entrance risalit of the SE front (w12-126: granite stair, round-arched portal with the red double door,
 *    pedimented flanking windows, relief panels, four arched second-floor windows, an attic with a medallion and urns);
 *    the taller two-stage turret over the NE centre (3DBAG peak 29.9 m, w16-36, w17-36 weathervane) between its tall
 *    granite pedestals; the SW centre turret with ironwork either side (w05-222).
 *  - Roof: a slate mansard from the cornice to a flat top at 22.8 m (3DBAG eaves 17-19 m, top 22.4-23.3 m), with
 *    finials on pedestals over the wing bay axes (w03-36).
 *
 * Frame: x east, z south, y up from the 3DBAG ground (1.36 m NAP), origin = the BAG ring vertex average.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {archBand, archSlab, ledgeStrip, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import src from './droogbak-footprints.json';

type V = [number, number];
type C = string;
let b: BuildingTools;

/** Storey lines measured on w03-36 (47.7 px/m) and w04-36, metres above the pavement. */
export const Y = {
  granite: 2.3, belt: [2.3, 2.6], gf: [3.3, 6.1], s1: [7.0, 7.45], f1: [7.9, 10.7], s2: [12.55, 12.95], f2: [13.4, 15.3],
  frieze: [16.4, 17.35], brackets: [17.35, 18.4], corona: [18.4, 19.3], top: 22.8,
} as const;

/* ------------------------------------------------------------------ plan */
const ring = src.nativeRing as V[];
/** The NE centre's pedestal jogs (BAG edges 10-16) stop at the plinth; above it the front runs straight (edges 9 and 17 are collinear). */
const UPPER_SKIP = new Set([10, 11, 12, 13, 14, 15, 16, 17]);
const upperIdx = ring.map((_, i) => i).filter(i => !UPPER_SKIP.has(i));
const upper = upperIdx.map(i => ring[i]);
const signedArea = (r: V[]) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const shapeOf = (r: V[]) => new T.Shape(r.map(p => new T.Vector2(p[0], p[1])));
const sub = (a: V, c: V): V => [a[0] - c[0], a[1] - c[1]];
const unit = (v: V): V => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
const addv = (a: V, ...vs: [V, number][]): V => vs.reduce<V>((p, [v, k]) => [p[0] + v[0] * k, p[1] + v[1] * k], a);

/** Mitre offset of a simple ring; d > 0 outward. Only steps and projections (no notch narrower than 2d) are offset. */
function offsetRing(r: V[], d: number): V[] {
  const s = Math.sign(signedArea(r)), n = (e: V): V => [s * e[1], -s * e[0]];
  return r.map((p, i) => {
    const a = r[(i - 1 + r.length) % r.length], c = r[(i + 1) % r.length];
    const e1 = unit(sub(p, a)), e2 = unit(sub(c, p)), n1 = n(e1), n2 = n(e2);
    const p1 = addv(p, [n1, d]), p2 = addv(p, [n2, d]), cr = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.abs(cr) < 1e-6) return p1;
    const t = ((p2[0] - p1[0]) * e2[1] - (p2[1] - p1[1]) * e2[0]) / cr;
    return [p1[0] + e1[0] * t, p1[1] + e1[1] * t];
  });
}
/** Horizontal slab with caps between y0 and y1 (shape in native x/z). */
function flatSolid(shape: T.Shape, y0: number, y1: number, c: C) {
  const g = new T.ExtrudeGeometry(shape, {depth: y1 - y0, bevelEnabled: false, curveSegments: 1});
  g.rotateX(Math.PI / 2); g.translate(0, y1, 0); g.computeVertexNormals(); b.add(g, c as never);
}
function flipFaces(g: T.BufferGeometry) {
  const flat = g.index ? g.toNonIndexed() : g, p = flat.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) for (const k of [0, 1, 2]) { const t = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, t); }
  flat.computeVertexNormals(); return flat;
}
/** Two triangles a-b-c-d, wound to face up. */
function quadUp(a: number[], q: number[], c: number[], d: number[], col: C) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([...a, ...q, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals();
  b.add(g.getAttribute('normal').getY(0) < 0 ? flipFaces(g) : g, col as never);
}

/* ------------------------------------------------------------------ wall kit (t along the frame, y up, out from the wall) */
const sl = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: C, out = 0) => slab(b, f, t, y, w, h, d, c, out);
const STRIPE_OUT = 0.06;
/** Ledge strips are front + top only: split them into <= 12 m pieces 2 cm apart so no open outline exceeds the audit's 30 m. */
function strip(f: Frame, t0: number, t1: number, y: number, h: number, d: number, c: C, out = 0) {
  const n = Math.max(1, Math.ceil((t1 - t0) / 12)), pw = (t1 - t0) / n;
  for (let i = 0; i < n; i++) ledgeStrip(b, f, t0 + pw * (i + 0.5), y, pw - 0.02, h, d, c, out);
}

function glassRect(f: Frame, t: number, y0: number, y1: number, w: number, out = 0) {
  sl(f, t, y0, w, y1 - y0, 0.18, 'glass', out);
  sl(f, t, y0, 0.07, y1 - y0, 0.23, 'frame', out);                                   // centre post
  sl(f, t, y0 + (y1 - y0) * 0.7, w, 0.07, 0.23, 'frame', out);                       // transom
}
/** Round-arched bel-etage window: cream arched surround and keystone, glass 6 cm proud of it, post and transom, sill. */
function archWin(f: Frame, t: number, y0: number, y1: number, w: number, out = 0, post = true) {
  const h = y1 - y0;
  archSlab(b, f, t, y0 - 0.08, w + 0.36, h + 0.26, 0.12, 'stone', out, 4);
  archSlab(b, f, t, y0, w, h, 0.18, 'glass', out, 4);
  if (post) sl(f, t, y0, 0.07, h - w / 2, 0.23, 'frame', out);
  sl(f, t, y0 + (h - w / 2) * 0.72, w, 0.07, 0.23, 'frame', out);
  sl(f, t, y1 + 0.02, 0.3, 0.42, 0.26, 'stone', out);                               // keystone
  sl(f, t, y0 - 0.14, w + 0.4, 0.14, 0.26, 'stone', out);                           // sill
}
/** Small arched light (turrets): glass with a cream sill, no ring. */
function lightArch(f: Frame, t: number, y0: number, y1: number, w: number, out = 0) {
  archSlab(b, f, t, y0, w, y1 - y0, 0.1, 'glass', out, 3);
  sl(f, t, y0 - 0.12, w + 0.3, 0.12, 0.18, 'stone', out);
}
/** First-floor window: cream surround (jambs and lintel) and three radiating voussoirs over it (w03-36, w05-222). */
function sunburstWin(f: Frame, t: number, w: number) {
  const [y0, y1] = Y.f1;
  sl(f, t, y0 - 0.08, w + 0.36, y1 - y0 + 0.28, 0.12, 'stone');
  glassRect(f, t, y0, y1, w);
  sl(f, t, y0 - 0.16, w + 0.5, 0.16, 0.26, 'stone');
  const cy = y1 + 0.2 - 0.35, R = 0.78;
  for (const k of [-1, 0, 1]) {
    const a = k * 0.62, g = new T.BoxGeometry(0.24, 0.62, 0.16).translate(0, 0, 0.08).rotateZ(-a).translate(Math.sin(a) * R, Math.cos(a) * R, 0);
    put(b, f, g, t, cy, 0, 'stone');
  }
}
/** First-floor window under a segmental pediment on a frieze (corner pavilions, w08-126). */
function segmentWin(f: Frame, t: number, w: number) {
  const [y0, y1] = Y.f1;
  sl(f, t, y0 - 0.08, w + 0.4, y1 - y0 + 0.46, 0.12, 'stone');
  glassRect(f, t, y0, y1, w);
  sl(f, t, y0 - 0.16, w + 0.5, 0.16, 0.26, 'stone');
  segBand(b, f, t, y1 + 0.38, w + 0.8, 0.42, 0.16, 0.26, 'stone');
}
/** Second-floor window: cream surround, hood and V keystone (w03-36). */
function hoodWin(f: Frame, t: number, w: number) {
  const [y0, y1] = Y.f2;
  sl(f, t, y0 - 0.08, w + 0.32, y1 - y0 + 0.12, 0.12, 'stone');
  glassRect(f, t, y0, y1, w);
  sl(f, t, y0 - 0.14, w + 0.4, 0.14, 0.26, 'stone');
  sl(f, t, y1, w + 0.44, 0.16, 0.26, 'stone');
  put(b, f, new T.ConeGeometry(0.3, 0.45, 3).rotateZ(Math.PI).translate(0, 0.22, 0.12), t, y1 + 0.16, 0, 'stone');   // V keystone
}
function basement(f: Frame, t: number, w: number, door: boolean) {
  if (door) { sl(f, t, 0.05, 1.05, 2.05, 0.22, 'red'); sl(f, t, 2.1, 1.25, 0.14, 0.24, 'stone'); return; }
  sl(f, t, 0.6, w, 1.25, 0.21, 'dark');
  sl(f, t, 0.6, 0.05, 1.25, 0.27, 'frame');
}
type Bay = {t: number; pair?: boolean; head?: 'sunburst' | 'segment'; door?: boolean; noBase?: boolean; gfSingle?: boolean};
/** One window axis over all storeys; `pair` puts two lights 1.5 m apart; `gfSingle` keeps one arched light and one basement window under a pair (SW corner bays, w01-222/w02-222). */
function bay(f: Frame, o: Bay) {
  const ts = o.pair ? [o.t - 0.78, o.t + 0.78] : [o.t], w = o.pair ? 1.1 : 1.38;
  if (o.gfSingle) {
    if (!o.noBase) basement(f, o.t, 1.15, !!o.door);
    archWin(f, o.t, Y.gf[0], Y.gf[1], 1.38);
  }
  for (const t of ts) {
    if (o.gfSingle) { if (o.head === 'segment') segmentWin(f, t, w); else sunburstWin(f, t, w); hoodWin(f, t, w - 0.05); continue; }
    if (!o.noBase) basement(f, t, o.pair ? 0.95 : 1.15, !!o.door && t === ts[0]);
    archWin(f, t, Y.gf[0], Y.gf[1], w);
    if (o.head === 'segment') segmentWin(f, t, w); else sunburstWin(f, t, w);
    hoodWin(f, t, w - 0.05);
  }
}

/* ------------------------------------------------------------------ whole-front courses */
function plinthAndCourses(f: Frame, len: number) {
  const L = len + 0.12;                                                              // past the corner, covers the mitre gap
  sl(f, len / 2 + 0.06, 0, L, Y.granite, 0.15, 'sandstone');
  sl(f, len / 2 + 0.06, Y.belt[0], L, Y.belt[1] - Y.belt[0], 0.22, 'stone');
  // banded brick: cream courses over red brick (GF heavier, upper storeys finer)
  for (let y = 2.85; y < Y.s1[0] - 0.1; y += 0.55) strip(f, 0, len, y, 0.2, STRIPE_OUT, 'stone');
  for (let y = 7.75; y < Y.s2[0] - 0.1; y += 0.6) strip(f, 0, len, y, 0.12, STRIPE_OUT, 'stone');
  for (let y = 13.3; y < Y.frieze[0] - 0.1; y += 0.6) strip(f, 0, len, y, 0.12, STRIPE_OUT, 'stone');
  sl(f, len / 2 + 0.06, Y.s1[0], L, Y.s1[1] - Y.s1[0], 0.2, 'stone');
  sl(f, len / 2 + 0.06, Y.s2[0], L, Y.s2[1] - Y.s2[0], 0.2, 'stone');
  sl(f, len / 2 + 0.06, Y.frieze[0], L, Y.frieze[1] - Y.frieze[0], 0.1, 'stone');
  if (len > 1.5) for (let t = 0.5; t < len - 0.3; t += 1.05) sl(f, t, Y.brackets[0] + 0.1, 0.18, Y.brackets[1] - Y.brackets[0] - 0.1, 0.78, 'stone');
}
/** Corona: one mitred ring slab 0.95 m out at 18.4-19.3 m, its soffit 0.12 m under it. */
function cornice() {
  const outer = offsetRing(upper, 0.95), inner = offsetRing(upper, -0.35);
  const s = shapeOf(outer); s.holes.push(new T.Path(inner.map(p => new T.Vector2(p[0], p[1]))));
  flatSolid(s, Y.corona[0], Y.corona[1], 'stone');
  const s2 = shapeOf(offsetRing(upper, 0.82)); s2.holes.push(new T.Path(inner.map(p => new T.Vector2(p[0], p[1]))));
  flatSolid(s2, Y.brackets[1] - 0.12, Y.corona[0] - 0.001, 'stone');
}

/* ------------------------------------------------------------------ assemblies */
/** Hipped cap w x d (d along the turned axis), apex ridge length d - w for d > w; rotated by `angle` like BuildingTools.box. */
function hipCap(c: V, y: number, w: number, d: number, h: number, angle: number, col: C) {
  const r = Math.max(0, (d - w) / 2), p = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [0, h, -r], [0, h, r]];
  const tri = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0, 0, 1, 2, 0, 2, 3];
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(tri.flatMap(i => p[i]), 3)); g.computeVertexNormals();
  // make every sloped face point away from the centre, the base face down
  const flat = g.getAttribute('position') as T.BufferAttribute, out: number[] = [];
  for (let i = 0; i < flat.count; i += 3) {
    const A = new T.Vector3().fromBufferAttribute(flat, i), B = new T.Vector3().fromBufferAttribute(flat, i + 1), Cc = new T.Vector3().fromBufferAttribute(flat, i + 2);
    const nrm = B.clone().sub(A).cross(Cc.clone().sub(A)), mid = A.clone().add(B).add(Cc).divideScalar(3);
    const want = mid.y < 1e-6 && Math.abs(nrm.y) > 1e-9 ? new T.Vector3(0, -1, 0) : new T.Vector3(mid.x, mid.y - h / 3, mid.z);
    if (nrm.dot(want) < 0) out.push(A.x, A.y, A.z, Cc.x, Cc.y, Cc.z, B.x, B.y, B.z); else out.push(A.x, A.y, A.z, B.x, B.y, B.z, Cc.x, Cc.y, Cc.z);
  }
  const res = new T.BufferGeometry(); res.setAttribute('position', new T.Float32BufferAttribute(out, 3)); res.computeVertexNormals();
  b.add(res, col as never, c[0], y, c[1], angle);
}
/** Mansard surface height at a plan point: rises from the cornice at 0.5 m inside the quad to the top at 3.2 m inside. */
const QUAD = [ring[7], ring[20], ring[29], ring[34]];
function roofAt(p: V) {
  const inside = Math.min(...QUAD.map((a, i) => { const q = QUAD[(i + 1) % 4], e = unit(sub(q, a)); return Math.abs((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]); }));
  return Y.corona[1] + Math.max(0, Math.min(1, (inside - 0.5) / 2.7)) * (Y.top - Y.corona[1]);
}
/** Attic turret on the roof: brick body, cream quoins, paired arched lights on every face, cornice, hipped cap, finial. */
function turret(c: V, u: V, w: number, y0: number, y1: number, opts: {stage2?: boolean; vane?: boolean} = {}) {
  const n: V = [-u[1], u[0]];
  const faces: Frame[] = [u, n, [-u[0], -u[1]] as V, [-n[0], -n[1]] as V].map(nn => ({origin: c, n: nn, tangent: [nn[1], -nn[0]] as V}));
  const angle = Math.atan2(u[0], u[1]);
  b.box(c[0], y0, c[1], w, y1 - y0, w, 'brick', angle);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const q = addv(c, [n, sx * (w / 2 - 0.12)], [u, sz * (w / 2 - 0.12)]); b.box(q[0], y0, q[1], 0.36, y1 - y0, 0.36, 'stone', angle); }   // quoins
  for (const f of faces) {
    for (let y = y0 + 0.5; y < y1 - 0.3; y += 0.55) ledgeStrip(b, f, 0, y, w - 0.32, 0.12, 0.06, 'stone', w / 2);
    const yw = y0 + 1.0, ts = [-0.5, 0.5].map(k => k * w * 0.42);
    // only lights that clear the mansard: a turret's inner faces stand in the roof slope
    if (ts.every(t => roofAt(addv(f.origin, [f.n, w / 2 + 0.3], [f.tangent, t])) < yw - 0.15))
      for (const t of ts) lightArch(f, t, yw, yw + Math.min(2.0, (y1 - y0) - 1.6), Math.min(0.75, w * 0.24), w / 2);
  }
  b.box(c[0], y1, c[1], w + 0.5, 0.45, w + 0.5, 'stone', angle);
  let top = y1 + 0.45;
  if (opts.stage2) {
    const w2 = w * 0.72, y2 = top + 2.4;
    b.box(c[0], top, c[1], w2, y2 - top, w2, 'brick', angle);
    for (const f of faces) lightArch(f, 0, top + 0.5, top + 1.9, 0.7, w2 / 2);
    b.box(c[0], y2, c[1], w2 + 0.4, 0.35, w2 + 0.4, 'stone', angle);
    top = y2 + 0.35;
    hipCap(c, top, w2 + 0.3, w2 + 0.3, 1.2, angle, 'slate');
    top += 1.2;
  } else {
    hipCap(c, top, w + 0.4, w + 0.4, 1.0, angle, 'slate');
    top += 1.0;
  }
  // finial: ball on a post
  b.box(c[0], top - 0.05, c[1], 0.14, 0.7, 0.14, 'frame', angle);
  b.add(new T.SphereGeometry(0.16, 8, 5), 'stone', c[0], top + 0.75, c[1]);
  if (opts.vane) { b.box(c[0], top + 0.9, c[1], 0.05, 1.0, 0.05, 'frame', angle); b.box(c[0] + u[1] * 0.3, top + 1.55, c[1] - u[0] * 0.3, 0.7, 0.32, 0.03, 'frame', angle + Math.PI / 2); }
}
/** Finial on a pedestal at the cornice edge over a bay axis (w03-36). */
function finial(f: Frame, t: number) {
  sl(f, t, Y.corona[1], 0.55, 0.7, 0.55, 'stone', -0.1);
  put(b, f, new T.ConeGeometry(0.2, 0.8, 6).translate(0, 0.4, 0.17), t, Y.corona[1] + 0.7, 0, 'slate');
}
/** Oriel on two consoles: stone bay with paired first-floor lights, then a pilastered second-floor loggia with paired arched lights. */
function oriel(f: Frame, t: number) {
  const w = 4.2, d = 0.9;
  basement(f, t, 1.15, false);                                                          // under the oriel (w03-36)
  archWin(f, t, Y.gf[0], Y.gf[1], 1.38);
  for (const s of [-1, 1]) {
    put(b, f, consoleGeom(0.5, 1.5, d), t + s * 1.55, Y.s1[1] - 1.5, 0, 'stone');
  }
  sl(f, t, Y.s1[1], w, Y.s2[1] - Y.s1[1], d, 'stone');
  for (const u of [-0.75, 0.75]) glassRect(f, t + u, Y.f1[0], Y.f1[1], 1.15, d);
  sl(f, t, Y.f1[1] + 0.25, w - 0.6, 0.55, 0.08, 'stone', d);                            // carved frieze field
  sl(f, t, Y.s2[1], w + 0.3, 0.2, d + 0.12, 'stone');                                   // oriel roof / loggia floor
  for (const u of [-1.65, 0, 1.65]) sl(f, t + u, Y.s2[1] + 0.2, 0.4, Y.frieze[0] - Y.s2[1] - 0.2, 0.25, 'stone');
  for (const u of [-0.8, 0.8]) archWin(f, t + u, Y.f2[0], Y.f2[1] + 0.4, 1.05);
}
function consoleGeom(w: number, h: number, d: number) {
  const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(0, h); s.lineTo(d, h); s.quadraticCurveTo(d * 0.25, h * 0.55, 0.12, 0); s.lineTo(0, 0);
  const g = new T.ExtrudeGeometry(s, {depth: w, bevelEnabled: false, curveSegments: 4});
  g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0); return g;                         // x across, y up, z out
}

/* ------------------------------------------------------------------ fronts */
const FRONT: Record<number, Bay[]> = {
  // SE (126), the entrance front. Edge 0 is the entrance risalit (entrance()).
  34: [{t: 2.4, head: 'segment'}, {t: 5.0, head: 'segment'}, {t: 7.6, head: 'segment'}],
  36: [{t: 2.5}, {t: 6.5}],
  38: [{t: 2.08, pair: true}],
  2: [{t: 2.08, pair: true}],
  4: [{t: 2.5}, {t: 6.5}],
  6: [{t: 2.4, head: 'segment'}, {t: 5.0, head: 'segment'}, {t: 7.6, head: 'segment'}],
  // NE (36), the Droogbak front: the oriels are added separately at 4 m from each corner.
  7: [{t: 8.4}, {t: 12.2, door: true}, {t: 15.9}],
  9: [{t: 2.42, pair: true}, {t: 7.0}, {t: 11.63, pair: true}],
  19: [{t: 2.35}, {t: 6.05}, {t: 9.8, door: true}],
  // NW (306): behind the viaduct; its middle is hidden by the glass annex (w06-306), the rhythm there is inferred.
  20: [{t: 2.3, head: 'segment'}, {t: 4.8, head: 'segment'}, {t: 7.3, head: 'segment'}],
  22: [{t: 2.4}, {t: 6.3}],
  24: [{t: 2.8}, {t: 6.8}, {t: 10.8}],
  26: [{t: 2.4}, {t: 6.3}],
  28: [{t: 2.3, head: 'segment'}, {t: 4.8, head: 'segment'}, {t: 7.3, head: 'segment'}],
  // SW (222): paired corner bays 4.3 m from each corner (w01-222), the centre with pairs either side of a single (w05-222).
  29: [{t: 4.3, pair: true, gfSingle: true}, {t: 8.7}, {t: 12.5, door: true}, {t: 16.3}],
  31: [{t: 2.6, pair: true}, {t: 7.03}, {t: 11.46, pair: true}],
  33: [{t: 2.2, door: true}, {t: 6.0, door: true}, {t: 9.8, door: true}, {t: 14.24, pair: true, gfSingle: true}],
};
/** Wing bay axes that carry a finial on the cornice. */
const FINIALS: Record<number, number[]> = {7: [8.4, 12.2, 15.9], 19: [2.35, 6.05, 9.8], 29: [8.7, 12.5, 16.3], 33: [2.2, 6.0, 9.8], 36: [2.5, 6.5], 4: [2.5, 6.5], 22: [2.4, 6.3], 26: [2.4, 6.3]};

/** SE entrance risalit (edge 0, w12-126): stair, portal, pedimented windows, relief panels, arched 2F lights, attic. */
function entrance(f: Frame, len: number) {
  const tc = len / 2;
  for (let k = 0; k < 6; k++) sl(f, tc, k * 0.4, 7.4, 0.4, 2.4 - k * 0.38, 'sandstone', 0.15);
  // portal
  sl(f, tc, 2.4, 2.0, 2.8, 0.14, 'red');                                             // red double door
  archSlab(b, f, tc, 5.28, 2.0, 1.12, 0.12, 'glass', 0, 8);                          // glazed arched fanlight with the lamp (w12-126)
  archBand(b, f, tc, 2.4, 2.7, 4.35, 0.32, 0.24, 'stone', 0, 8);
  sl(f, tc, 5.2, 1.6, 0.08, 0.2, 'stone');
  for (const s of [-1, 1]) sl(f, tc + s * 1.75, 2.4, 0.5, Y.s1[0] - 2.4, 0.32, 'stone');
  for (const s of [-1, 1]) {
    const t = tc + s * 2.75;
    sl(f, t, 3.52, 1.55, 2.56, 0.12, 'stone');
    glassRect(f, t, 3.6, 6.0, 1.15);
    sl(f, t, 6.0, 1.8, 0.2, 0.22, 'stone');
    const g = new T.Shape(); g.moveTo(-0.95, 0); g.lineTo(0.95, 0); g.lineTo(0, 0.55); g.lineTo(-0.95, 0);
    put(b, f, new T.ExtrudeGeometry(g, {depth: 0.26, bevelEnabled: false}), t, 6.2, 0, 'stone');
  }
  for (const t of [0.35, len - 0.35]) sl(f, t, Y.belt[1], 0.6, Y.frieze[0] - Y.belt[1], 0.24, 'stone');        // risalit pilasters
  for (const t of [tc - 1.7, tc + 1.7]) sl(f, t, Y.s1[1], 0.45, Y.s2[0] - Y.s1[1], 0.22, 'stone');
  // first floor: side lights and the central triple, relief panels over them
  for (const [t, w] of [[tc - 2.75, 1.2], [tc, 2.4], [tc + 2.75, 1.2]] as const) {
    sl(f, t, Y.f1[0] - 0.08, w + 0.36, Y.f1[1] - Y.f1[0] + 0.3, 0.12, 'stone');
    glassRect(f, t, Y.f1[0], Y.f1[1], w);
    if (w > 2) for (const u of [-0.4, 0.4]) sl(f, t + u * w, Y.f1[0], 0.07, Y.f1[1] - Y.f1[0], 0.23, 'frame');
    sl(f, t, Y.f1[1] + 0.25, w + 0.5, 0.95, 0.16, 'stone');
    sl(f, t, Y.f1[1] + 0.4, w + 0.1, 0.65, 0.24, 'stone');
  }
  // second floor: four round-arched lights, the centre pair close
  for (const t of [tc - 2.65, tc - 0.65, tc + 0.65, tc + 2.65]) archWin(f, t, Y.f2[0], Y.f2[1] + 0.35, 1.0, 0, false);   // narrow lights: transom only
  // attic over the cornice
  const aw = 6.8, ah = 5.6, ad = 5.0;
  const c = addv(f.origin, [f.tangent, tc], [f.n, -ad / 2 + 0.2]);
  b.box(c[0], Y.corona[1], c[1], aw, ah - 1.1, ad, 'brick', Math.atan2(f.n[0], f.n[1]));
  const fa: Frame = {origin: addv(f.origin, [f.n, 0.2]), n: f.n, tangent: f.tangent};
  for (let y = Y.corona[1] + 0.4; y < Y.corona[1] + ah - 1.3; y += 0.55) ledgeStrip(b, fa, tc, y, aw, 0.14, 0.06, 'stone');
  for (const s of [-1, 1]) sl(fa, tc + s * (aw / 2 - 0.2), Y.corona[1], 0.5, ah - 1.1, 0.2, 'stone');
  for (const s of [-1, 1]) archWin(fa, tc + s * 2.0, Y.corona[1] + 0.9, Y.corona[1] + 3.2, 0.85);
  // medallion: ring, field and boss
  put(b, fa, new T.CylinderGeometry(0.95, 0.95, 0.16, 16).rotateX(Math.PI / 2).translate(0, 0, 0.08), tc, Y.corona[1] + 2.4, 0, 'stone');
  put(b, fa, new T.CylinderGeometry(0.65, 0.65, 0.12, 16).rotateX(Math.PI / 2).translate(0, 0, 0.22), tc, Y.corona[1] + 2.4, 0, 'sandstone');
  put(b, fa, new T.SphereGeometry(0.35, 10, 6).scale(1, 1, 0.5).translate(0, 0, 0.3), tc, Y.corona[1] + 2.4, 0, 'stone');
  // attic cornice, low pediment, urns
  const yc = Y.corona[1] + ah - 1.1;
  b.box(c[0], yc, c[1], aw + 0.5, 0.4, ad + 0.4, 'stone', Math.atan2(f.n[0], f.n[1]));
  const g = new T.Shape(); g.moveTo(-aw / 2, 0); g.lineTo(aw / 2, 0); g.lineTo(0, 0.7); g.lineTo(-aw / 2, 0);
  put(b, fa, new T.ExtrudeGeometry(g, {depth: 0.35, bevelEnabled: false}), tc, yc + 0.4, -0.1, 'stone');
  hipCap(c, yc + 0.4, aw, ad, 0.9, Math.atan2(f.n[0], f.n[1]), 'slate');
  for (const s of [-1, 1]) { sl(fa, tc + s * (aw / 2 - 0.2), yc + 0.4, 0.45, 0.55, 0.45, 'stone'); put(b, fa, new T.SphereGeometry(0.24, 8, 5).translate(0, 0.24, 0.22), tc + s * (aw / 2 - 0.2), yc + 0.95, 0, 'stone'); }
  // cresting along the attic ridge
  for (let k = -3; k <= 3; k++) b.box(c[0] + f.tangent[0] * k * 0.9, yc + 1.2, c[1] + f.tangent[1] * k * 0.9, 0.05, 0.55, 0.05, 'frame');
}

/* ------------------------------------------------------------------ build */
export function buildDroogbak(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  setSink(0.25, true);
  // walls, courtyard, deck, mansard
  b.add(openTopPrism(shapeOf(upper), 0, Y.corona[0] + 0.01), 'brick');
  const yard = src.courtyard as V[];
  b.add(flipFaces(openTopPrism(shapeOf(yard), 0, Y.top)), 'brick');
  const deck = shapeOf(upper); deck.holes.push(new T.Path(yard.map(p => new T.Vector2(p[0], p[1]))));
  b.add(upwardRoofPlane(deck, Y.corona[1] - 0.2), 'slate');
  const Q = QUAD, base = offsetRing(Q, -0.5), topQ = offsetRing(Q, -3.2);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quadUp([base[i][0], Y.corona[1], base[i][1]], [base[j][0], Y.corona[1], base[j][1]], [topQ[j][0], Y.top, topQ[j][1]], [topQ[i][0], Y.top, topQ[i][1]], 'slate'); }
  const lid = shapeOf(topQ); lid.holes.push(new T.Path(yard.map(p => new T.Vector2(p[0], p[1]))));
  b.add(upwardRoofPlane(lid, Y.top), 'slate');
  // NE centre pedestals (BAG edges 11 and 15, 0.88 m proud) with cream pilasters above
  const ne = ringFrame(upper, upperIdx.indexOf(9));
  for (const t of [5.53, 8.5]) { sl(ne.f, t, 0, 1.38, Y.belt[1], 0.88, 'sandstone'); sl(ne.f, t, Y.belt[1], 1.0, Y.s1[0] - Y.belt[1], 0.5, 'stone'); }
  // fronts
  upper.forEach((_, k) => {
    const i = upperIdx[k], {f, len} = ringFrame(upper, k);
    if (len < 0.2) return;
    plinthAndCourses(f, len);
    if (i === 0) entrance(f, len);
    for (const o of FRONT[i] ?? []) bay(f, o);
    for (const t of FINIALS[i] ?? []) finial(f, t);
    if (i === 7) oriel(f, 4.0);
    if (i === 19) oriel(f, len - 4.0);
  });
  cornice();
  // corner turrets: centred on the 10 m SE/NW pavilion faces (5 m from the corner, w08-126), 2 m behind those faces; seen
  // from the NE/SW fronts (w03-36, w04-36, w01-222, cameras 8-12 m out) a turret that far back projects 4 m in from the corner
  const corners: [number, number, number, boolean][] = [[7, 6, 8, true], [20, 21, 19, false], [29, 28, 30, false], [34, 35, 33, false]];
  for (const [ci, a, q, vane] of corners) {
    const C = ring[ci], ua = unit(sub(ring[a], C)), ub = unit(sub(ring[q], C));
    turret(addv(C, [ua, 5.0], [ub, 2.0]), ua, 3.4, Y.corona[1] - 0.6, 23.6, {vane});
  }
  // NE centre: the taller two-stage turret (3DBAG 29.9 m); SW centre turret with railings (w05-222)
  const neMid = addv(ne.f.origin, [ne.f.tangent, ne.len / 2], [ne.f.n, -2.2]);
  turret(neMid, ne.f.n, 3.8, Y.corona[1] - 0.6, 24.6, {stage2: true});
  const sw = ringFrame(upper, upperIdx.indexOf(31)), swMid = addv(sw.f.origin, [sw.f.tangent, sw.len / 2], [sw.f.n, -2.4]);
  turret(swMid, sw.f.n, 4.0, Y.corona[1] - 0.6, 23.8);
  for (const s of [-1, 1]) {
    const fr: Frame = {origin: addv(sw.f.origin, [sw.f.n, -0.6]), n: sw.f.n, tangent: sw.f.tangent};
    const t0 = sw.len / 2 + s * 2.4, t1 = sw.len / 2 + s * 5.4;
    sl(fr, (t0 + t1) / 2, Y.corona[1] + 0.85, Math.abs(t1 - t0), 0.06, 0.06, 'bronze');
    for (let t = Math.min(t0, t1); t <= Math.max(t0, t1) + 0.01; t += 0.75) sl(fr, t, Y.corona[1], 0.05, 0.9, 0.05, 'bronze');
  }
  setSink(0);
}
