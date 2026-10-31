/**
 * Hirschgebouw, Leidseplein / Kleine-Gartmanplantsoen (BAG 0363100012165488; Rijksmonument 518447): the 1911-13
 * department store of the firm Hirsch by A. Jacot. Every part below comes from the RCE register description (CC0,
 * quoted in scripts/landmarks/hirschgebouw-brief.md) or from the rectified Gemeente Amsterdam panoramas (CC BY 4.0)
 * listed in scripts/landmarks/hirschgebouw-inventory.json; nothing is described from memory.
 *
 *  - Register: a parterre, three storeys and an attic storey ("atelierverdieping") under a curved slate mansard; grey
 *    Arzweiler sandstone; a one-bay round corner with a high domed tower, the copper dome on a high drum, a lantern
 *    with a ball finial; a rusticated arcade storey; colossal fluted Ionic half-columns over three storeys between the
 *    bays and pilasters beside the corner bay and at the outer ends; stone balustrades on the first floor, wrought-iron
 *    balconies on the second and third, three coupled windows per bay; a balustrade on the attic.
 *  - Panoramas (rectified at 25-50 px/m, see the inventory): eight bays on the Leidseplein front, seven on the
 *    Kleine-Gartmanplantsoen front (two of them on a 1.03 m risalit, the BAG facet of 12.4 m), six along the
 *    Hirschpassage (the first seen, the rest behind the passage, inferred from the 3DBAG half-column notches); storey
 *    lines measured on w16-322 / nw-mid2 / w02-52; the drum, its HIRSCH & Cie lettering, the dome and lantern on
 *    dome-n (TMX7316010203-001660_pano_0000_000556, 2020-04-21).
 *  - The rear (low wings on the Hirschpassage, light court, party walls) is the 3DBAG LoD2.2 shell (CC BY 4.0).
 *
 * Frame: x east, z south, y up from the 3DBAG ground (0.55 m NAP), origin = the BAG ring vertex average
 * (scripts/landmarks/hirschgebouw-prepare.ts writes hirschgebouw-footprints.json).
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {planarPolygon} from './worship-shell';
import {setSink, slab, ledgeStrip, archSlab, archBand, put, type Frame} from './nearbar-kit';
import plan from './hirschgebouw-footprints.json';

type V = [number, number];
type C = string;
type Face = {P: V; d: V; n: V};

/** Storey lines (m above ground), read on the rectified crops w16-322, nw-mid2 (50 px/m) and w02-52. */
export const H = {
  plinth: 0.4, arcadeTop: 5.3, balPlinth: 5.5, balTop: 5.85, balRail: 6.7, balRailTop: 6.88,
  s1: [7.0, 9.0], bal2: 9.45, s2: [10.45, 12.9], bal3: 13.45, s3: [14.4, 16.8],
  shaft: [6.88, 16.55], capital: [16.55, 17.4], architrave: [17.4, 18.2], frieze: [18.2, 19.3], cornice: [19.3, 20.6],
  attic: [20.6, 22.4], atticWin: [21.1, 22.15], atticCornice: [22.4, 22.7], topBal: [22.7, 23.5], pedestalTop: 23.75,
  wallTop: 23.45, cornerTop: 23.8, cornerBal: [23.8, 24.6], flat: 27.44,
} as const;
/** Bay rhythm from the BAG facets: 4.28 m bays between 1.57 m half-column piers (pitch 5.84-5.85 m). */
const BAY = 4.28, COL = 1.57, COL_R = 0.58;
/** The curved mansard (register: "gebogen mansardekap met leien"): (offset from the bay line, height) pairs, measured
 * on nw-full3 / ne-full3 (eaves behind the attic balustrade at 23.45 m, flat top at the 3DBAG 27.44 m, 2.2-2.7 m in). */
const MANSARD: V[] = [[-0.2, H.wallTop], [-0.4, 24.75], [-0.8, 25.95], [-1.4, 26.85], [-2.4, H.flat]];

let b: BuildingTools;
const faces = plan.faces as Record<'nw' | 'ne' | 'se', Face>;
const at = (f: Face, t: number, v: number): V => [f.P[0] + f.d[0] * t + f.n[0] * v, f.P[1] + f.d[1] * t + f.n[1] * v];
/** nearbar-kit frame for a facade line: its tangent is the viewer's right, so t is mapped through `s`. */
function frameOf(f: Face, off = 0): {fr: Frame; s: number} {
  const tangent: V = [f.n[1], -f.n[0]], s = Math.sign(tangent[0] * f.d[0] + tangent[1] * f.d[1]);
  return {fr: {origin: at(f, 0, off), tangent, n: f.n}, s};
}
const geom = (pos: number[]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
/** Vertical prism over a plan polygon (x, z). */
function prismXZ(ring: V[], y0: number, y1: number, c: C) {
  const shape = new T.Shape(ring.map(p => new T.Vector2(p[0], -p[1])));
  const g = new T.ExtrudeGeometry(shape, {depth: y1 - y0, bevelEnabled: false}).rotateX(-Math.PI / 2).translate(0, y0, 0);
  b.add(g.toNonIndexed(), c as never);
}

/** A fluted half-column shaft: half-disc of radius r with `flutes` scallops, extruded upward, its flat back on the wall. */
function flutedShaft(r: number, h: number, flutes = 7): T.BufferGeometry {
  const s = new T.Shape(), depth = r * 0.09;
  s.moveTo(-r, 0);
  for (let k = 0; k < flutes; k++) {
    const a0 = Math.PI - k * Math.PI / flutes, a1 = Math.PI - (k + 1) * Math.PI / flutes, am = (a0 + a1) / 2;
    s.lineTo(r * Math.cos(a0 - 0.08), r * Math.sin(a0 - 0.08));
    s.lineTo((r - depth) * Math.cos(am), (r - depth) * Math.sin(am));
    s.lineTo(r * Math.cos(a1 + 0.08), r * Math.sin(a1 + 0.08));
  }
  s.lineTo(r, 0); s.lineTo(-r, 0);
  // Shape (x, y) -> local (x, z out of the wall); extruded along y.
  return new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false}).rotateX(-Math.PI / 2).scale(1, 1, -1).toNonIndexed();
}
function fixWinding(g: T.BufferGeometry) {
  // scale(1,1,-1) mirrors the extrusion; flip every triangle back.
  const p = g.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) for (const k of [0, 1, 2]) { const t = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, t); }
  g.computeVertexNormals(); return g;
}

/** Ionic half-column on its pedestal: pedestal through the first-floor balustrade, base, fluted shaft, volute capital. */
function halfColumn(fr: Frame, t: number, lite = false) {
  slab(b, fr, t, H.balPlinth, COL - 0.1, H.balRailTop - H.balPlinth, 0.62, 'stone');
  slab(b, fr, t, H.shaft[0], COL_R * 2 + 0.2, 0.28, COL_R + 0.12, 'stone');
  put(b, fr, lite ? new T.CylinderGeometry(COL_R, COL_R, H.shaft[1] - H.shaft[0] - 0.28, 8, 1, true, -Math.PI / 2, Math.PI).translate(0, (H.shaft[1] - H.shaft[0] - 0.28) / 2, 0)
    : fixWinding(flutedShaft(COL_R, H.shaft[1] - H.shaft[0] - 0.28)), t, H.shaft[0] + 0.28, 0, 'sandstone');
  // echinus + abacus, the two volutes at the sides
  slab(b, fr, t, H.capital[0], COL_R * 2 + 0.1, 0.4, COL_R + 0.1, 'stone');
  slab(b, fr, t, H.capital[0] + 0.4, COL_R * 2 + 0.55, 0.45, COL_R + 0.3, 'stone');
  if (!lite) for (const sd of [-1, 1]) put(b, fr, new T.CylinderGeometry(0.2, 0.2, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.25), t + sd * (COL_R + 0.12), H.capital[0] + 0.32, 0.05, 'stone');
}
/** Flat colossal pilaster (beside the corner bay, at the outer ends). */
function pilaster(fr: Frame, t: number, w: number, d = 0.5) {
  slab(b, fr, t, H.balPlinth, w, H.capital[0] - H.balPlinth, d, 'sandstone');
  slab(b, fr, t, H.capital[0], w + 0.2, 0.85, d + 0.15, 'stone');
}
/** Coupled windows of one bay: narrow - wide - narrow between broad stone stiles (register: per drie gekoppelde vensters). */
function tripleWindow(fr: Frame, tc: number, bw: number, y0: number, y1: number, lite = false) {
  const k = bw / BAY, nw = 0.72 * k, ww = 1.2 * k, st = 0.38 * k, h = y1 - y0;
  const xs = [-(ww / 2 + st + nw / 2), 0, ww / 2 + st + nw / 2], ws = [nw, ww, nw];
  slab(b, fr, tc, y0 - 0.14, 3.55 * k + 0.3, 0.14, 0.24, 'stone');           // sill
  slab(b, fr, tc, y1, 3.55 * k + 0.1, 0.22, 0.12, 'stone');                   // head band
  for (let i = 0; i < 3; i++) {
    const x = tc + xs[i];
    slab(b, fr, x, y0, ws[i], h, 0.04, 'glass');
    if (!lite) {
      slab(b, fr, x, y0 + h * 0.64, ws[i], 0.08, 0.1, 'frame');             // transom (upper lights)
      slab(b, fr, x, y0, 0.1, h, 0.1, 'frame');                              // central bar
    }
  }
  for (const sd of [-1, 1]) slab(b, fr, tc + sd * (ww / 2 + st / 2), y0, st, h, 0.18, 'sandstone'); // stiles
}
/** Wrought-iron balcony on a stone slab (register: smeedijzeren balustraden, 2nd and 3rd floor; #26292b on the rails). */
function ironBalcony(fr: Frame, tc: number, w: number, y: number, bars = 8) {
  slab(b, fr, tc, y, w + 0.2, 0.14, 0.55, 'stone');
  const yb = y + 0.14, out = 0.42;
  slab(b, fr, tc, yb, w, 0.06, 0.1, 'bronze', out - 0.02);
  slab(b, fr, tc, yb + 0.82, w, 0.06, 0.1, 'bronze', out - 0.02);
  slab(b, fr, tc, yb + 0.42, w, 0.04, 0.1, 'bronze', out - 0.02);
  for (let i = 0; i <= bars; i++) bar(fr, tc - w / 2 + w * i / bars, yb + 0.06, 0.035, 0.76, 0.035, out + 0.005);
  for (const sd of [-1, 1]) slab(b, fr, tc + sd * (w / 2 - 0.02), yb + 0.82, 0.04, 0.06, out, 'bronze');
}
/** A thin iron bar: front and side faces only (its back and ends are never seen), 6 triangles. */
function bar(fr: Frame, t: number, y: number, w: number, h: number, d: number, out: number) {
  const g = new T.BoxGeometry(w, h, d).translate(0, h / 2, d / 2), idx = g.getIndex()!.array as ArrayLike<number>, keep: number[] = [];
  for (const face of [0, 1, 4]) for (let i = 0; i < 6; i++) keep.push(idx[face * 6 + i]);
  g.setIndex(keep); put(b, fr, g, t, y, out, 'bronze');
}
/** Stone balustrade with candelabra balusters (first floor and attic). */
function balustrade(fr: Frame, tc: number, w: number, y0: number, y1: number, lite = false) {
  slab(b, fr, tc, y0, w, 0.2, 0.42, 'stone');
  slab(b, fr, tc, y1 - 0.18, w, 0.18, 0.42, 'stone');
  if (lite) { slab(b, fr, tc, y0 + 0.2, w - 0.1, y1 - y0 - 0.38, 0.2, 'sandstone'); return; }
  const n = Math.max(2, Math.round(w / 0.46));
  for (let i = 0; i < n; i++) put(b, fr, new T.CylinderGeometry(0.06, 0.09, y1 - y0 - 0.38, 3, 1, true).translate(0, (y1 - y0 - 0.38) / 2, 0.21), tc - w / 2 + w * (i + 0.5) / n, y0 + 0.2, 0, 'stone');
}
/** Round-arched arcade opening with its moulded archivolt and keystone; rusticated piers are drawn by the members. */
function arcadeArch(fr: Frame, tc: number, w: number, h: number) {
  archSlab(b, fr, tc, 0, w, h, 0.07, 'glass', 0, 6);
  archBand(b, fr, tc, 0, w + 0.6, h + 0.3, 0.3, 0.14, 'stone', 0, 6);
  slab(b, fr, tc, h - 0.15, 0.5, 0.6, 0.22, 'stone');
}
/** Horizontal rustication courses on a ground-storey pier. */
function rustication(fr: Frame, tc: number, w: number) {
  for (let y = 0.55; y < H.arcadeTop - 0.3; y += 0.56) ledgeStrip(b, fr, tc, y, w, 0.46, 0.06, 'stone');
}

type Member = {kind: 'col' | 'pil'; t0: number; t1: number; off: number};
type Bay = {t0: number; t1: number; off: number};
/** One street front: wall per bay and per member, the bay openings, the order, the entablature, attic and balustrade. */
function front(f: Face, members: Member[], bays: Bay[], lite: boolean) {
  for (const bay of bays) {
    const {fr, s} = frameOf(f, bay.off), w = bay.t1 - bay.t0, tc = s * (bay.t0 + bay.t1) / 2;
    slab(b, fr, tc, 0, w, H.wallTop, 1.0 + bay.off, 'sandstone', -1.0 - bay.off);
    slab(b, fr, tc, 0, w + 0.02, H.plinth, 0.17, 'stone');
    arcadeArch(fr, tc, Math.min(3.3, w - 0.95), 5.0);
    balustrade(fr, tc, w, H.balPlinth, H.balRailTop, lite);
    tripleWindow(fr, tc, w, H.s1[0], H.s1[1], lite);
    tripleWindow(fr, tc, w, H.s2[0], H.s2[1], lite);
    tripleWindow(fr, tc, w, H.s3[0], H.s3[1], lite);
    ironBalcony(fr, tc, 3.55 * w / BAY + 0.15, H.bal2, lite ? 4 : 7);
    ironBalcony(fr, tc, 3.55 * w / BAY + 0.15, H.bal3, lite ? 4 : 7);
    // attic storey: three small coupled windows per bay
    for (const [x, ww] of [[-1.18, 0.6], [0, 0.9], [1.18, 0.6]] as V[]) {
      slab(b, fr, tc + x * w / BAY, H.atticWin[0], ww, H.atticWin[1] - H.atticWin[0], 0.04, 'glass');
      if (!lite) slab(b, fr, tc + x * w / BAY, H.atticWin[0], 0.09, H.atticWin[1] - H.atticWin[0], 0.1, 'frame');
    }
    balustrade(fr, tc, w, H.topBal[0], H.topBal[1], lite);
  }
  for (const m of members) {
    const {fr, s} = frameOf(f, m.off), w = m.t1 - m.t0, tc = s * (m.t0 + m.t1) / 2;
    slab(b, fr, tc, 0, w, H.wallTop, 1.0 + m.off, 'sandstone', -1.0 - m.off);
    slab(b, fr, tc, 0, w + 0.02, H.plinth, 0.12, 'stone');
    rustication(fr, tc, w);
    slab(b, fr, tc, H.arcadeTop - 0.3, w + 0.1, 0.5, 0.25, 'stone');               // impost band over the pier
    if (m.kind === 'col') halfColumn(fr, tc, lite); else pilaster(fr, tc, w - 0.2, 0.5);
    slab(b, fr, tc, H.attic[0], Math.min(w, 1.0), H.attic[1] - H.attic[0], 0.16, 'stone');   // attic pilaster strip
    slab(b, fr, tc, H.topBal[0], Math.min(w, 1.0) - 0.1, H.pedestalTop - H.topBal[0], 0.46, 'stone'); // balustrade pedestal
  }
}
/** Entablature, attic cornice and the arcade string course along a run of a front at offset `off`. */
function bands(f: Face, t0: number, t1: number, off: number) {
  const {fr, s} = frameOf(f, off), w = t1 - t0, tc = s * (t0 + t1) / 2;
  slab(b, fr, tc, H.arcadeTop, w, H.balPlinth - H.arcadeTop, 0.32, 'stone');
  slab(b, fr, tc, H.architrave[0], w, H.architrave[1] - H.architrave[0], 0.24, 'stone');
  slab(b, fr, tc, H.frieze[0], w, H.frieze[1] - H.frieze[0], 0.14, 'sandstone');
  slab(b, fr, tc, H.cornice[0], w, 0.4, 0.42, 'stone');
  slab(b, fr, tc, H.cornice[0] + 0.4, w, 0.4, 0.7, 'stone');
  slab(b, fr, tc, H.cornice[0] + 0.8, w, H.cornice[1] - H.cornice[0] - 0.8, 0.95, 'stone');
  slab(b, fr, tc, H.atticCornice[0], w, H.atticCornice[1] - H.atticCornice[0], 0.3, 'stone');
}
/** Dentil course under the cornice (register: tand- en eierlijst), front faces only. */
function dentils(f: Face, t0: number, t1: number, off: number) {
  const {fr, s} = frameOf(f, off);
  for (let t = t0 + 0.2; t < t1 - 0.1; t += 0.42) ledgeStrip(b, fr, s * t, H.cornice[0] - 0.22, 0.2, 0.22, 0.3, 'stone');
}

/** Sweep a (offset, height) profile along a plan polyline of one facade line family; mitred joins. */
function sweep(path: V[], normals: V[], profile: V[], c: C) {
  const m: V[] = path.map((_, i) => {
    const a = normals[Math.max(0, i - 1)], n = normals[Math.min(normals.length - 1, i)], k = 1 + a[0] * n[0] + a[1] * n[1];
    return [(a[0] + n[0]) / k, (a[1] + n[1]) / k];
  });
  const P = (i: number, j: number) => [path[i][0] + m[i][0] * profile[j][0], profile[j][1], path[i][1] + m[i][1] * profile[j][0]];
  const pos: number[] = [];
  for (let i = 0; i + 1 < path.length; i++) for (let j = 0; j + 1 < profile.length; j++) {
    const a = P(i, j), q = P(i + 1, j), r = P(i + 1, j + 1), s = P(i, j + 1);
    pos.push(...a, ...q, ...r, ...a, ...r, ...s);
  }
  const g = geom(pos);
  // orient outward-up: the first triangle's normal must point out of the building (along the segment normal) or up
  const n0 = new T.Vector3().fromBufferAttribute(g.getAttribute('normal'), 0);
  if (n0.x * normals[0][0] + n0.z * normals[0][1] + n0.y * 0.2 < 0) flip(g);
  b.add(g, c as never);
  return m;
}
function flip(g: T.BufferGeometry) {
  const p = g.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) for (const k of [0, 1, 2]) { const t = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, t); }
  g.computeVertexNormals();
}
/** Mansard end cap: the profile closed down to the eaves height, in the plane through `p` across normal `m`. */
function cap(p: V, m: V, profile: V[], facing: V, c: C) {
  const pts = profile.map(([v, y]) => [p[0] + m[0] * v, y, p[1] + m[1] * v]);
  pts.push([p[0] + m[0] * profile.at(-1)![0], profile[0][1], p[1] + m[1] * profile.at(-1)![0]]);
  const g = planarPolygon([pts]);
  if (!g) return;
  const n = new T.Vector3().fromBufferAttribute(g.getAttribute('normal'), 0);
  if (n.x * facing[0] + n.z * facing[1] < 0) { const ng = g.toNonIndexed(); flip(ng); b.add(ng, c as never); } else b.add(g, c as never);
}
/** Zinc rolls of the mansard over the bay pilasters (light ribs on nw-full3 / ne-full3). */
function rib(f: Face, t: number) {
  const {fr, s} = frameOf(f, 0);
  for (let j = 0; j + 1 < MANSARD.length; j++) {
    const [v0, y0] = MANSARD[j], [v1, y1] = MANSARD[j + 1], len = Math.hypot(v1 - v0, y1 - y0), ang = Math.atan2(v0 - v1, y1 - y0);
    const g = new T.BoxGeometry(0.12, len, 0.12).translate(0, len / 2, 0).rotateX(-ang);
    put(b, fr, g, s * t, y0, v0 + 0.1, 'stone');
  }
}

function line(a: Face, va: number, c: Face, vc: number): V {
  // intersection of the offset lines a (offset va) and c (offset vc)
  const A = at(a, 0, va), Cc = at(c, 0, vc), den = a.d[0] * c.d[1] - a.d[1] * c.d[0];
  const t = ((Cc[0] - A[0]) * c.d[1] - (Cc[1] - A[1]) * c.d[0]) / den;
  return [A[0] + a.d[0] * t, A[1] + a.d[1] * t];
}

export function buildHirschgebouw(_w: number, _d: number, tools: BuildingTools) {
  b = tools; setSink(0);
  const {nw, ne, se} = faces;

  // ---------------------------------------------------------------- the three fronts
  const nwMembers: Member[] = [...Array(7).keys()].map(k => ({kind: 'col' as const, t0: 4.28 + 5.84 * k, t1: 5.85 + 5.84 * k, off: 0}));
  nwMembers.push({kind: 'pil', t0: 45.31, t1: 47.12, off: 0});
  const nwBays: Bay[] = [{t0: 0, t1: 4.28, off: 0}, ...[...Array(7).keys()].map(k => ({t0: 5.85 + 5.84 * k, t1: 4.28 + 5.84 * (k + 1), off: 0}))];
  nwBays[7].t1 = 45.31;
  front(nw, nwMembers, nwBays, false);
  bands(nw, 0, 47.12, 0); dentils(nw, 0, 47.12, 0);

  // Kleine-Gartmanplantsoen: bays 3-4 on the 12.86 m risalit 1.03 m proud (BAG facet t 10.14-23.0).
  const R = 1.03;
  const neMembers: Member[] = [
    {kind: 'col', t0: 4.28, t1: 5.87, off: 0},
    {kind: 'col', t0: 10.14, t1: 11.6, off: R}, {kind: 'col', t0: 15.85, t1: 17.3, off: R}, {kind: 'col', t0: 21.55, t1: 23.0, off: R},
    {kind: 'col', t0: 27.6, t1: 29.2, off: 0}, {kind: 'col', t0: 33.5, t1: 35.1, off: 0},
  ];
  const neBays: Bay[] = [{t0: 0, t1: 4.28, off: 0}, {t0: 5.87, t1: 10.14, off: 0}, {t0: 11.6, t1: 15.85, off: R}, {t0: 17.3, t1: 21.55, off: R},
    {t0: 23.0, t1: 27.6, off: 0}, {t0: 29.2, t1: 33.5, off: 0}, {t0: 35.1, t1: 39.3, off: 0}];
  front(ne, neMembers, neBays, false);
  bands(ne, 0, 10.14, 0); bands(ne, 10.14, 23.0, R); bands(ne, 23.0, 40.8, 0);
  dentils(ne, 0, 10.14, 0); dentils(ne, 10.14, 23.0, R); dentils(ne, 23.0, 40.8, 0);

  // Hirschpassage: six bays, the first photographed (w19-142), the rest inferred from the 3DBAG notches: lite detail.
  const seMembers: Member[] = [4.28, 10.06, 15.98, 21.84, 27.67].map(t0 => ({kind: 'col' as const, t0, t1: t0 + 1.57, off: 0}));
  seMembers.push({kind: 'pil', t0: 33.53, t1: 35.45, off: 0});
  const seBays: Bay[] = [[-0.45, 4.28], [5.85, 10.06], [11.63, 15.98], [17.55, 21.84], [23.41, 27.67], [29.24, 33.53]].map(([t0, t1]) => ({t0, t1, off: 0}));
  front(se, seMembers, seBays.slice(0, 1), false);
  front(se, [], seBays.slice(1), true);
  bands(se, -0.45, 35.45, 0);

  // East corner pier: one prism (NE pilaster t 39.3-41.3 and SE pilaster s -1.95-0, fronts 0.5 m proud).
  {
    const X = line(ne, 0.5, se, 0.5), A = at(ne, 39.3, 0.5), Bp = at(se, 0, 0.5), Cp = at(se, 0, -1.0), D = at(ne, 39.3, -1.0), I = line(ne, -1.0, se, -1.0);
    prismXZ([A, X, Bp, Cp, I, D], 0, H.wallTop, 'sandstone');
    prismXZ([at(ne, 39.25, 0.62), line(ne, 0.62, se, 0.62), at(se, 0.05, 0.62), at(se, 0.05, 0.4), line(ne, 0.4, se, 0.4), at(ne, 39.25, 0.4)], H.capital[0], H.capital[0] + 0.85, 'stone');
    for (const [f, t, w] of [[ne, 40.3, 2.0], [se, -0.98, 1.95]] as [Face, number, number][]) { const {fr, s} = frameOf(f, 0.5); rustication(fr, s * t, w); }
  }
  // West end: the pilaster's top and the party wall cap stand on the 3DBAG shell behind.

  // ---------------------------------------------------------------- mansards and the flat roof
  const inner = MANSARD.at(-1)![0];
  {
    // NW: from the west end to the corner pilaster
    const path: V[] = [at(nw, 47.12, 0), at(nw, 0, 0)], nn: V[] = [nw.n];
    const m = sweep(path, nn, MANSARD, 'slate');
    cap(path[0], m[0], MANSARD, nw.d, 'slate'); cap(path[1], m[1], MANSARD, [-nw.d[0], -nw.d[1]], 'slate');
    for (let k = 0; k < 7; k++) rib(nw, 5.07 + 5.84 * k);
  }
  {
    // NE -> east corner -> SE, ending where the high roof stops (SE t 32.66)
    const E = line(ne, 0, se, 0), path: V[] = [at(ne, 0, 0), E, at(se, 32.66, 0)], nn: V[] = [ne.n, se.n];
    const m = sweep(path, nn, MANSARD, 'slate');
    cap(path[0], m[0], MANSARD, [-ne.d[0], -ne.d[1]], 'slate'); cap(path[2], m[2], MANSARD, se.d, 'slate');
    for (const t of [5.07, 10.87, 16.6, 22.3, 28.4, 34.3]) rib(ne, t);
    for (const t of [5.07, 10.85, 16.77, 22.63, 28.46]) rib(se, t);
  }
  // SE beyond the high roof: a flat lead behind the parapet down to the 3DBAG roofs.
  {
    const ring: V[] = [at(se, 32.66, -1.0), at(se, 35.45, -1.0), at(se, 35.45, inner), at(se, 32.66, inner)];
    const g = planarPolygon([ring.map(p => [p[0], H.wallTop, p[1]])]);
    if (g) { upward(g); b.add(g, 'slate' as never); }
  }
  // Flat roof: the 3DBAG 27.44 m surface (with the light court hole), its street edge replaced by the mansard tops.
  {
    const flat = plan.flatRoof, outer = flat.outer.map(p => [p[0], p[2]] as V);
    const nearest = (q: V) => outer.reduce((bi, p, i) => Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(outer[bi][0] - q[0], outer[bi][1] - q[1]) ? i : bi, 0);
    const iW = nearest([-37.6, 7.2]), iS = nearest([2.8, 31.2]);
    const keep: V[] = []; for (let i = (iW + 1) % outer.length; i !== iS; i = (i + 1) % outer.length) keep.push(outer[i]);
    const street: V[] = [at(se, 32.66, inner), line(ne, inner, se, inner), at(ne, 0, inner), at(nw, 0, inner), at(nw, 47.12, inner)];
    const ring = [...street, ...keep].map(p => [p[0], H.flat, p[1]]);
    const holes = flat.holes.map(h => h.map(p => [p[0], H.flat, p[2]]));
    const g = planarPolygon([ring, ...holes]);
    if (g) { upward(g); b.add(g, 'slate' as never); }
  }

  // ---------------------------------------------------------------- the round corner bay
  const Cc = plan.arc.c as V, Rf = 7.87;
  const a0 = Math.atan2(ne.n[1], ne.n[0]), a1 = Math.atan2(nw.n[1], nw.n[0]);
  let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  const dirAt = (u: number): V => { const a = a0 + da * u; return [Math.cos(a), Math.sin(a)]; };
  const arcFrame = (u: number, r = Rf): Frame => { const n = dirAt(u); return {origin: [Cc[0] + n[0] * r, Cc[1] + n[1] * r], tangent: [n[1], -n[0]], n}; };
  const NF = 12, du = 1 / NF, chord = 2 * Rf * Math.sin(Math.abs(da) * du / 2);
  for (let k = 0; k < NF; k++) {
    const fr = arcFrame((k + 0.5) * du), pil = k < 2 || k >= NF - 2;
    slab(b, fr, 0, 0, chord + 0.03, H.cornerTop, 1.0, 'sandstone', -1.0);
    slab(b, fr, 0, 0, chord + 0.03, H.plinth, 0.17, 'stone');
    slab(b, fr, 0, H.arcadeTop, chord + 0.03, H.balPlinth - H.arcadeTop, 0.32, 'stone');
    if (pil) { pilaster(fr, 0, chord + 0.03, 0.4); rustication(fr, 0, chord); }
    else balustrade(fr, 0, chord, H.balPlinth, H.balRailTop);
    slab(b, fr, 0, H.architrave[0], chord + 0.05, H.architrave[1] - H.architrave[0], 0.24, 'stone');
    slab(b, fr, 0, H.frieze[0], chord + 0.05, H.frieze[1] - H.frieze[0], 0.14, 'sandstone');
    slab(b, fr, 0, H.cornice[0], chord + 0.08, 0.4, 0.42, 'stone');
    slab(b, fr, 0, H.cornice[0] + 0.4, chord + 0.12, 0.4, 0.7, 'stone');
    slab(b, fr, 0, H.cornice[0] + 0.8, chord + 0.16, H.cornice[1] - H.cornice[0] - 0.8, 0.95, 'stone');
    slab(b, fr, 0, H.atticCornice[0] + 0.5, chord + 0.03, 0.3, 0.3, 'stone');
    if (pil) slab(b, fr, 0, H.cornerBal[0], chord - 0.1, H.cornerBal[1] - H.cornerBal[0] + 0.2, 0.42, 'stone');
    else balustrade(fr, 0, chord, H.cornerBal[0], H.cornerBal[1]);
  }
  // the corner arcade: one wide arch (dome-n: 4.7 m, crown 5.2 m), glazed in facet strips so the glass follows the curve
  {
    const W = 4 * chord, Hh = 5.2, r = W / 2;
    for (let k = 4; k < 8; k++) {
      const fr = arcFrame((k + 0.5) * du), x0 = (k - 6) * chord, x1 = x0 + chord;
      const xc = (x0 + x1) / 2, yTop = (x: number) => Math.abs(x) >= r ? Hh - r : Hh - r + Math.sqrt(r * r - x * x);
      const pts: V[] = [[x0 - xc, 0], [x1 - xc, 0]];
      for (let i = 0; i <= 4; i++) { const x = x1 - (x1 - x0) * i / 4; pts.push([x - xc, yTop(x)]); }
      const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
      put(b, fr, new T.ExtrudeGeometry(s, {depth: 0.08, bevelEnabled: false}), 0, 0, -0.01, 'glass');
    }
    slab(b, arcFrame(0.5), 0, Hh - 0.15, 0.55, 0.65, 0.22, 'stone');
  }
  // three coupled windows per storey on the curve, iron balconies on storeys 2 and 3, three attic windows
  {
    const span = Rf * Math.abs(da);
    const wins: V[] = [[-1.37, 0.72], [0, 1.2], [1.37, 0.72]];
    for (const [x, w] of wins) {
      const fr = arcFrame(0.5 + x / span);
      for (const [y0, y1] of [H.s1, H.s2, H.s3]) {
        slab(b, fr, 0, y0, w, y1 - y0, 0.1, 'glass', -0.03);
        slab(b, fr, 0, y0 + (y1 - y0) * 0.64, w, 0.07, 0.18, 'frame', -0.02);
        slab(b, fr, 0, y0 - 0.14, w + 0.4, 0.14, 0.24, 'stone');
        slab(b, fr, 0, y1, w + 0.3, 0.22, 0.12, 'stone');
      }
      for (const y of [H.bal2, H.bal3]) ironBalcony(fr, 0, w + 0.45, y, 4);
      slab(b, fr, 0, 21.6, w * 0.75, 0.85, 0.1, 'glass', -0.03);
    }
  }
  // Corner roof behind the parapet, the drop to the flat roof, and the drum standing on it.
  {
    const ring: V[] = [at(nw, 0, inner), at(ne, 0, inner)];
    for (let i = 0; i <= 12; i++) { const n = dirAt(i / 12); ring.push([Cc[0] + n[0] * (Rf - 1.05), Cc[1] + n[1] * (Rf - 1.05)]); }
    const g = planarPolygon([ring.map(p => [p[0], H.cornerTop, p[1]])]);
    if (g) { upward(g); b.add(g, 'slate' as never); }
    // the step from the corner roof up to the flat roof (behind the drum)
    const p = at(nw, 0, inner), q = at(ne, 0, inner), len = Math.hypot(q[0] - p[0], q[1] - p[1]), tg: V = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const nOut: V = [tg[1], -tg[0]], sgn = Math.sign(nOut[0] * (Cc[0] + dirAt(0.5)[0] - p[0]) + nOut[1] * (Cc[1] + dirAt(0.5)[1] - p[1])) || 1;
    const fr: Frame = {origin: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], tangent: [nOut[1] * sgn, -nOut[0] * sgn], n: [nOut[0] * sgn, nOut[1] * sgn]};
    slab(b, fr, 0, H.cornerTop, len, H.flat - H.cornerTop, 0.2, 'sandstone', -0.2);
  }
  drum(Cc, dirAt(0.5));
  buildHirschgebouwShell(tools);
}

function upward(g: T.BufferGeometry) {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  if (!idx) return;
  const A = new T.Vector3(), B = new T.Vector3(), C3 = new T.Vector3();
  for (let k = 0; k < idx.count; k += 3) {
    A.fromBufferAttribute(pos, idx.getX(k)); B.fromBufferAttribute(pos, idx.getX(k + 1)); C3.fromBufferAttribute(pos, idx.getX(k + 2));
    if (B.sub(A).cross(C3.sub(A)).y < 0) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
  }
  g.computeVertexNormals();
}

/** The corner tower: drum with windows and the HIRSCH & Cie letters, ring cornices, balustraded gallery, upper drum,
 * the copper dome and the lantern with its ball finial (dome-n at 40 px/m; 3DBAG top 38.57 m). */
function drum(c: V, front: V) {
  const cyl = (r: number, y0: number, y1: number, col: C, seg = 28, open = true) =>
    b.add(new T.CylinderGeometry(r, r, y1 - y0, seg, 1, open), col as never, c[0], (y0 + y1) / 2, c[1]);
  const Rl = 4.75, Ru = 4.05;
  cyl(Rl, 22.0, 28.0, 'sandstone');
  b.add(new T.CylinderGeometry(5.0, 5.0, 0.4, 24), 'stone' as never, c[0], 28.0, c[1]);              // ring cornice 27.8-28.2
  cyl(Ru, 28.2, 31.6, 'sandstone');
  b.add(new T.CylinderGeometry(4.55, 4.55, 0.12, 20), 'stone' as never, c[0], 28.86, c[1]);           // gallery rail
  for (let i = 0; i < 22; i++) { const a = (i + 0.5) * Math.PI * 2 / 22; b.add(new T.CylinderGeometry(0.06, 0.08, 0.6, 4, 1, true), 'stone' as never, c[0] + 4.45 * Math.cos(a), 28.5, c[1] + 4.45 * Math.sin(a)); }
  b.add(new T.CylinderGeometry(4.35, 4.35, 0.6, 24), 'stone' as never, c[0], 31.3, c[1]);             // upper cornice 31.0-31.6
  // dome: a slightly raised quarter-ellipse (3.95 m out, 3.85 m up), copper
  const prof: T.Vector2[] = []; for (let i = 0; i <= 7; i++) { const a = i / 7 * Math.PI / 2; prof.push(new T.Vector2(Math.max(0.001, 3.95 * Math.cos(a)), 3.85 * Math.sin(a))); }
  prof[7].x = 0.9;
  b.add(new T.LatheGeometry(prof, 28), 'copper' as never, c[0], 31.6, c[1]);
  b.add(new T.CylinderGeometry(0.95, 0.95, 0.35, 12), 'stone' as never, c[0], 35.62, c[1]);          // collar
  cyl(0.62, 35.8, 37.0, 'sandstone', 8, false);
  const lp: T.Vector2[] = [new T.Vector2(0.8, 0), new T.Vector2(0.62, 0.25), new T.Vector2(0.3, 0.45), new T.Vector2(0.001, 0.52)];
  b.add(new T.LatheGeometry(lp, 8), 'copper' as never, c[0], 37.0, c[1]);
  b.add(new T.SphereGeometry(0.32, 8, 6), 'copper' as never, c[0], 37.85, c[1]);                    // bolvormige bekroning
  const ang0 = Math.atan2(front[1], front[0]);
  const fr = (a: number, r: number): Frame => { const n: V = [Math.cos(a), Math.sin(a)]; return {origin: [c[0] + n[0] * r, c[1] + n[1] * r], tangent: [n[1], -n[0]], n}; };
  for (let k = 0; k < 4; k++) slab(b, fr(ang0 + k * Math.PI / 2, 0.6), 0, 36.0, 0.36, 0.75, 0.06, 'glass');   // lantern openings
  // drum windows: three on the front of each drum stage, pilaster strips between
  for (const [r, y0, y1] of [[Rl, 25.2, 26.5], [Ru, 29.4, 30.8]] as [number, number, number][]) {
    for (const [x, w] of [[-1.25, 0.7], [0, 1.0], [1.25, 0.7]]) {
      const f = fr(ang0 + x / r, r);
      slab(b, f, 0, y0, w, y1 - y0, 0.1, 'glass', -0.04);
      slab(b, f, 0, y0 + (y1 - y0) * 0.6, w, 0.06, 0.18, 'frame', -0.04);
      slab(b, f, 0, y0 - 0.12, w + 0.3, 0.12, 0.2, 'stone');
    }
    // pilaster strips between and beside the three windows, then evenly round the back
    const strips = [-1.88, -0.63, 0.63, 1.88].map(x => ang0 + x / r);
    for (let a = 1.88 / r + 0.6; a < Math.PI * 2 - 1.88 / r - 0.3; a += 0.6) strips.push(ang0 + a);
    for (const a of strips) slab(b, fr(a, r), 0, y0 - 0.6, 0.45, y1 - y0 + 1.1, 0.1, 'stone', -0.02);
  }
  // HIRSCH & Cie in raised letters on the lower drum (26.5-27.6 m), centred on the corner; "ie" set small and high.
  const glyphs: [string, number][] = [...'HIRSCH & C'].map(ch => [ch, 0.85] as [string, number]);
  glyphs.push(['I', 0.45], ['E', 0.45]);
  const built = glyphs.map(([ch, h]) => ch === ' ' ? {ch, h, g: null, w: 0.35} : (() => { const L = raisedLettering({text: ch, heightM: h, maxWidthM: 2, depthM: 0.06}); return {ch, h, g: L.geometry, w: L.widthM}; })());
  const gap = 0.14, total = built.reduce((s, x) => s + x.w + gap, -gap);
  let u = -total / 2;
  for (const x of built) {
    const mid = u + x.w / 2, a = ang0 - mid / (Rl + 0.02);   // text runs left to right as seen from outside
    if (x.g) {
      const y = x.h < 0.6 ? 27.62 - x.h : 26.68;
      const f = fr(a, Rl - 0.01);
      x.g.translate(0, x.h / 2, 0);
      put(b, f, x.g, 0, y, 0, 'stone');
    }
    u += x.w + gap;
  }
  // the carved scroll consoles flanking the drum base over the corner pilasters (dome-n, 23.8-25.6 m)
  for (const sd of [-1, 1]) {
    const a = ang0 + sd * 0.95, f = fr(a, Rl);
    slab(b, f, 0, H.cornerTop, 0.9, 1.5, 0.9, 'stone', -0.1);
    put(b, f, new T.CylinderGeometry(0.42, 0.42, 0.9, 10).rotateZ(Math.PI / 2), 0, H.cornerTop + 1.45, 0.45, 'stone');
  }
}

/** Rear shell: the 3DBAG walls and roofs the builder does not draw by hand (low wings brick, the rest stone). */
export function buildHirschgebouwShell(tools: BuildingTools) {
  b = tools;
  for (const w of plan.walls) {
    const g = planarPolygon([w.ring]);
    if (g) b.add(g, (w.top < 20.5 ? 'brick' : 'sandstone') as never);
  }
  for (const r of plan.roofs) {
    const g = planarPolygon(r.rings);
    if (g) { upward(g); b.add(g, 'slate' as never); }
  }
}
