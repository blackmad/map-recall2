import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, getSink, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {balustradeRun} from './venue-kit';
import {barRailing, type XZ} from '../../src/canalRecall/landmarks/barRailing';
import {stripedAwningOn} from './striped-awning-kit';
import source from './broekmans-koningsplein-footprints.json';

/**
 * WINKELHUIS BROEKMANS, Koningsplein 16-20 / Herengracht 439 (BAG pand 0363100012253807, rijksmonument 202025; A. Jacot
 * with W. Oldewelt, 1904). Register: a shop and office building with a high ground storey, two equal storeys, a lower
 * fourth layer under a projecting waterlijst, and an attic zone of balustrade with postamenten over the piers; two axes on
 * the Herengracht, a rounded ("bollende") corner over one axis, then the Koningsplein axes; sandstone-clad piers and
 * lintels, painted; a wrought-iron railing in the first-storey borstwering; the fourth-layer windows in three parts, the
 * middle widest; a continuous pier between the two parts, whose details differ slightly.
 *
 * Massing: the 3DBAG LoD2.2 shell (broekmans-koningsplein-footprints.json, bag-shell-prepare.ts), roof 18.2-18.6 m over
 * the 3DBAG ground (1.56 m NAP). Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0) rectified at 50 px/m, heights
 * from the Koningsplein crop of TMX7316010203-002361_pano_0007_000213 (2021; its balustrade top matches the 3DBAG roof), the corner from
 * TMX7316010203-002860_pano_0000_000020 (2022) and the Herengracht from TMX7316010203-002860_pano_0000_000025 (2022):
 *  - Herengracht (ring edge 0, 7.25 m, t from the party wall): two axes, tripartite windows;
 *  - the rounded corner (ring edges 2-5): a pier and one curved axis over three facets;
 *  - ring edge 7 (3.2 m, 0.2 m behind the Koningsplein line): one axis;
 *  - Koningsplein (ring edge 9, 16.75 m, t from the corner): part 1 (two axes, three lights, open balustrade over the
 *    attic) and part 2 (two axes, four lights, a cresting of small round-topped merlons), split by the wide pier at 7.6-8.4.
 * The shop awnings (white, ARKET) use the stripedAwning kit with one colour.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;

/** Heights above the 3DBAG ground (w01-153d2021, 50 px/m). */
const PUI = 4.15, BEAM = 5.45, LEDGE = 5.7, PARAPET = 6.65;
const S1: [number, number] = [6.65, 9.05], S1T = 8.25;
const S2: [number, number] = [10.08, 13.05];
const MZ: [number, number] = [14.7, 16.4], MZT = 16.05;
const WL0 = 16.9, WL1 = 17.35, ATT = 18.25, POST_TOP = 19.0;

type Part = 1 | 2;
type Opening = {a: number; c: number; kind: 'shop' | 'entrance' | 'curved'; awning?: boolean};
type Axis = {a: number; c: number; lights: number[]; part: Part};
type Face = {e: number; piers: [number, number][]; puiPiers: [number, number][]; pui: Opening[]; axes: Axis[]; posts: [number, number][]; attic: {a: number; c: number; kind: 'balustrade' | 'cresting'}[]};

/**
 * Ring edge i as a wall frame. Edge 0 (Herengracht) is the plane of edge 2 drawn back to the party wall: the 3DBAG ring
 * steps 0.19 m out 0.7 m before the round (edges 1-2), but the 2022 Herengracht view shows one plane with two equal axes
 * up to the corner pier, which stands on the first facet of the round. Edge 2's plane meets that facet at the ring.
 */
function edge(i: number): {f: Frame; len: number} {
  if (i !== 0) return ringFrame(src.facadeRing, i);
  const {f} = ringFrame(src.facadeRing, 2), p = src.facadeRing[0], q = src.facadeRing[3];
  const u0 = (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];
  const u1 = (q[0] - f.origin[0]) * f.tangent[0] + (q[1] - f.origin[1]) * f.tangent[1];
  return {f: {origin: [f.origin[0] + f.tangent[0] * u0, f.origin[1] + f.tangent[1] * u0], tangent: f.tangent, n: f.n}, len: u1 - u0};
}
/** Tripartite (part 1): narrow, wide, narrow; part 2: four lights. */
const L3 = [0.24, 0.52, 0.24], L4 = [0.23, 0.29, 0.27, 0.21];

const FACES: Face[] = [
  // Herengracht (7.92 m with edge 2): party-wall pier, two equal axes (TMX7316010203-002860_pano_0000_000025)
  {e: 0, piers: [[0, 0.8], [4.1, 4.5]], puiPiers: [[0, 0.8], [4.1, 4.6], [7.6, 7.92]], pui: [{a: 0.8, c: 4.1, kind: 'shop', awning: true}, {a: 4.6, c: 7.6, kind: 'shop', awning: true}],
    axes: [{a: 0.8, c: 4.1, lights: L3, part: 1}, {a: 4.5, c: 7.8, lights: L3, part: 1}], posts: [[0, 0.8], [4.1, 4.5]], attic: [{a: 0.8, c: 4.1, kind: 'balustrade'}, {a: 4.5, c: 7.92, kind: 'balustrade'}]},
  // the curved axis, one facet at a time, between the corner pier on the first facet and the pier closing the last
  // (TMX7316010203-002860_pano_0000_000020, 2022)
  ...[3, 4, 5].map((e): Face => {
    const len = edge(e).len, a = e === 3 ? 0.4 : 0, c = e === 5 ? len - 0.3 : len;
    const pier: [number, number][] = e === 3 ? [[0, a]] : e === 5 ? [[c, len]] : [];
    return {e, piers: pier, puiPiers: pier, pui: [{a, c, kind: 'curved'}], axes: [{a, c, lights: [1], part: 1}], posts: pier, attic: [{a, c, kind: 'balustrade'}]};
  }),
  // edge 7: one axis between piers
  {e: 7, piers: [[0, 0.4], [2.95, 3.2]], puiPiers: [[0, 0.4], [2.95, 3.2]], pui: [{a: 0.4, c: 2.95, kind: 'shop', awning: true}], axes: [{a: 0.4, c: 2.95, lights: L3, part: 1}], posts: [[0, 0.4]], attic: [{a: 0.4, c: 3.2, kind: 'balustrade'}]},
  // Koningsplein: part 1 (two axes), the wide pier between the parts, part 2 (two axes)
  {e: 9, piers: [[0, 0.45], [3.8, 4.2], [7.55, 8.4], [11.75, 12.2], [15.45, 16.75]], puiPiers: [[0, 0.8], [3.7, 4.5], [7.4, 8.4], [11.6, 12.3], [15.4, 16.75]],
    pui: [{a: 0.8, c: 3.7, kind: 'shop', awning: true}, {a: 4.5, c: 7.4, kind: 'entrance'}, {a: 8.4, c: 11.6, kind: 'shop', awning: true}, {a: 12.3, c: 15.4, kind: 'shop', awning: true}],
    axes: [{a: 0.45, c: 3.8, lights: L3, part: 1}, {a: 4.2, c: 7.55, lights: L3, part: 1}, {a: 8.4, c: 11.75, lights: L4, part: 2}, {a: 12.2, c: 15.45, lights: L4, part: 2}],
    posts: [[3.8, 4.2], [7.55, 8.4], [15.45, 16.75]], attic: [{a: 0, c: 3.8, kind: 'balustrade'}, {a: 4.2, c: 7.55, kind: 'balustrade'}, {a: 8.4, c: 15.45, kind: 'cresting'}]},
];
/** The exposed front in order, Herengracht party wall to the Koningsplein party wall (edge 0 read on over edges 1-2; jogs 6 and 8 stepped). */
const PATH = [0, 3, 4, 5, 7, 9];
const IDENT: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, 1]};
/** Herengracht and the round: ring edges 0-5 (with the 0.19 m jog 1). */
const ROUND = [0, 1, 2, 3, 4, 5];

/** Distance from plan point p to ring edge i's segment. */
function distToEdge(i: number, x: number, z: number) {
  const R = src.facadeRing, a = R[i], c = R[(i + 1) % R.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz;
  const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
  return Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u);
}
/**
 * Shell surfaces this builder replaces. On the Herengracht and round the corner the 3DBAG shell stops at about 15 m and
 * steps back 0.8 m to the roof (a setback the panoramas do not show: the fourth layer and the attic stand in the front's
 * plane, TMX7316010203-002860_pano_0000_000020/25), and above the pui it cuts the round off straight. Its walls on ring
 * edges 0-5 and the setback roof strip are dropped; the fill (`band(..., [0, 3, 4, 5], ..., -1.0)`) stands there instead, from
 * the ground to the attic, on the ring.
 */
function replaced(s: Surface) {
  const r = s.rings[0], ys = r.map(p => p[1]);
  if (s.type === 'WallSurface') return r.every(p => ROUND.some(i => distToEdge(i, p[0], p[2]) < 0.25));
  return s.type === 'RoofSurface' && Math.min(...ys) > 14 && Math.max(...ys) < 17 && r.every(p => ROUND.some(i => distToEdge(i, p[0], p[2]) < 1.0));
}

/**
 * The storeys over the balcony on the Koningsplein: the 3DBAG upper wall is one plane (the shell wall from 6.33 m to the
 * roof whose ends are UP), 0.24 m behind ring edge 7 and 0.44-0.65 m behind edge 9 (the ground storey projects under the
 * balcony). The storeys stand 5 cm before that plane; on edges 0-5 they stand on the ring, on the fill.
 */
const UP: [XZ, XZ] = (() => {
  const w = src.surfaces.find(s => s.type === 'WallSurface' && Math.min(...s.rings[0].map(p => p[1])) > 6 && s.rings[0].some(p => Math.hypot(p[0] - 19.2, p[2] + 6.0) < 0.2) && s.rings[0].some(p => Math.hypot(p[0] - 0.4, p[2] - 4.0) < 0.2));
  if (!w) throw Error('broekmans: the 3DBAG upper Koningsplein wall is missing');
  const xs = w.rings[0];
  const a = xs.reduce((m, p) => (p[0] < m[0] ? p : m)), c = xs.reduce((m, p) => (p[0] > m[0] ? p : m));
  return [[a[0], a[2]], [c[0], c[2]]];
})();
function upEdge(i: number): {f: Frame; len: number} {
  if (i !== 7 && i !== 9) return edge(i);
  const {f, len} = edge(i), [A, B] = UP, L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  let t: XZ = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  if (t[0] * f.tangent[0] + t[1] * f.tangent[1] < 0) t = [-t[0], -t[1]];
  let n: XZ = [-t[1], t[0]];
  if (n[0] * f.n[0] + n[1] * f.n[1] < 0) n = [-n[0], -n[1]];
  const u = (f.origin[0] - A[0]) * t[0] + (f.origin[1] - A[1]) * t[1];
  return {f: {origin: [A[0] + t[0] * u + n[0] * 0.05, A[1] + t[1] * u + n[1] * 0.05], tangent: t, n}, len};
}

export function buildBroekmansKoningsplein(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'stone', roof: 'slate', skip: s => replaced(s)});
  const sink0 = getSink();
  setSink(0.1, true);
  // the Herengracht and corner front in the ring's plane, a metre deep, ground to attic
  band(b, 0, ATT, 0, [0, 3, 4, 5], false, -1.0);
  // horizontal members round the whole front, mitred at the corner facets
  band(b, PUI, BEAM - PUI, 0.16);
  band(b, BEAM, LEDGE - BEAM, 0.5);
  band(b, LEDGE, PARAPET - LEDGE, 0.1);
  band(b, S1[1], 9.95 - S1[1], 0.08, PATH, true);
  band(b, 9.95, S2[0] - 9.95, 0.15, PATH, true);
  band(b, S2[1], 0.25, 0.2, PATH, true);
  band(b, S2[1] + 0.25, 14.5 - S2[1] - 0.25, 0.08, PATH, true);
  band(b, 14.5, MZ[0] - 14.5, 0.15, PATH, true);
  band(b, MZ[1], WL0 - MZ[1], 0.08, PATH, true);
  band(b, WL0, 0.2, 0.3, PATH, true);
  band(b, WL0 + 0.2, WL1 - WL0 - 0.2, 0.6, PATH, true);
  band(b, WL1, ATT - WL1, 0.08, PATH, true);
  // the wrought-iron railing on the balcony ledge, one run round the corner
  const rail = barRailing(offsetPath(0.4), {height: PARAPET - LEDGE, barPitch: 0.11, topRail: [0.06, 0.05]});
  put(b, IDENT, geo(rail.positions, rail.indices), 0, LEDGE, 0, 'dark');
  for (const face of FACES) {
    const {f} = edge(face.e), {f: u} = upEdge(face.e);
    for (const [a, c] of face.puiPiers) puiPier(b, f, a, c);
    // shallow sink: on edge 7 a deeper back would sit nearer the upper wall plane 0.24 m behind than the pui wall
    setSink(0.03);
    for (const o of face.pui) opening(b, f, o, edge(face.e).len);
    setSink(0.1, true);
    for (const [a, c] of face.piers) slab(b, u, (a + c) / 2, LEDGE - 0.05, c - a, WL0 + 0.05 - LEDGE + 0.05, 0.14, 'stone');
    for (const ax of face.axes) {
      windowAt(b, u, ax, S1[0], S1[1], S1T);
      windowAt(b, u, ax, S2[0], S2[1], ax.part === 1 ? 12.45 : 12.1);
    }
  }
  // the mezzanine sunk 6 cm, unstaggered: a deeper back reads as a buried assembly behind the fill
  setSink(0.06);
  for (const face of FACES) for (const ax of face.axes) mezzanine(b, upEdge(face.e).f, ax);
  // attic shallow-sunk: its backs stay before the roof behind the parapet
  setSink(0.05);
  for (const face of FACES) {
    const {f} = upEdge(face.e);
    // attic: postamenten over the piers, the balustrade (part 1) and the merlon cresting (part 2)
    for (const [a, c] of face.posts) {
      slab(b, f, (a + c) / 2, WL1 - 0.05, c - a, POST_TOP - WL1 + 0.05, 0.2, 'stone');
      slab(b, f, (a + c) / 2, POST_TOP - 0.06, c - a + 0.08, 0.12, 0.26, 'stone');
    }
    for (const r of face.attic) {
      const a = r.a + 0.02, c = r.c - 0.02;
      if (r.kind === 'balustrade') balustradeRun(b, f, a, c, ATT, {h: 0.5, d: 0.14, pitch: 0.22, c: 'stone', out: 0.04});
      else {
        slab(b, f, (a + c) / 2, ATT, c - a, 0.2, 0.12, 'stone');
        const n = Math.round((c - a) / 0.645);
        for (let i = 0; i < n; i++) archSlab(b, f, a + (c - a) * (i + 0.5) / n, ATT + 0.2, 0.22, 0.32, 0.1, 'stone', 0.01, 4);
      }
    }
  }
  setSink(sink0);
}

/** Line of ring edge i (or its upper front) offset `o` out, as [start, end] in the left-to-right reading of the front. */
function line(i: number, o: number, upper: boolean): [XZ, XZ] {
  const {f, len} = upper ? upEdge(i) : edge(i);
  const a: XZ = [f.origin[0] + f.n[0] * o, f.origin[1] + f.n[1] * o];
  return [a, [a[0] + f.tangent[0] * len, a[1] + f.tangent[1] * len]];
}

/** The front polyline over `edges` offset `o` out of the wall: corners mitred, parallel jogs stepped. */
function offsetPath(o: number, edges = PATH, upper = false): XZ[] {
  const ls = edges.map(i => line(i, o, upper)), pts: XZ[] = [ls[0][0]];
  for (let k = 0; k + 1 < ls.length; k++) {
    const [p, q] = ls[k], [r, s] = ls[k + 1];
    const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [s[0] - r[0], s[1] - r[1]];
    const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
    const cross = (d1[0] * d2[1] - d1[1] * d2[0]) / (l1 * l2);
    if (Math.abs(cross) < 0.15) { pts.push(q); if (Math.hypot(r[0] - q[0], r[1] - q[1]) > 0.05) pts.push(r); continue; }
    const u = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / (d1[0] * d2[1] - d1[1] * d2[0]);
    pts.push([p[0] + d1[0] * u, p[1] + d1[1] * u]);
  }
  pts.push(ls[ls.length - 1][1]);
  return pts;
}

/** Horizontal member along the front: from `back` (inside the wall) to `d` out, y to y + h. */
function band(b: BuildingTools, y: number, h: number, d: number, edges = PATH, upper = false, back = -0.12) {
  const outer = offsetPath(d, edges, upper), inner = offsetPath(back, edges, upper).reverse();
  const g = new T.ExtrudeGeometry(new T.Shape([...outer, ...inner].map(([x, z]) => new T.Vector2(x, -z))), {depth: h, bevelEnabled: false});
  g.rotateX(-Math.PI / 2);
  put(b, IDENT, g, 0, y, 0, 'stone');
}

function geo(positions: number[], indices: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Ground-storey pier with its block capital under the beam. */
function puiPier(b: BuildingTools, f: Frame, a: number, c: number) {
  slab(b, f, (a + c) / 2, 0, c - a, PUI + 0.05, 0.2, 'stone');
  slab(b, f, (a + c) / 2, 3.65, c - a + 0.06, PUI + 0.04 - 3.65, 0.25, 'stone');
}

/** A pui opening: dark frame, glass with a transom at 3.1 m; the entrance with timber doors; a white awning over the shop windows. */
function opening(b: BuildingTools, f: Frame, o: Opening, len: number) {
  const {a, c} = o, w = c - a, m = (a + c) / 2;
  // the frame as bars (plinth and jambs, 1 cm apart; the head is the beam), running 5 cm under the piers but not past the end of its wall
  const inset = o.kind === 'curved' ? -0.04 : 0.05, fa = Math.max(0, a - inset), fc = Math.min(len, c + inset);
  slab(b, f, (fa + fc) / 2, 0, fc - fa, 0.35, 0.05, 'dark');
  for (const t of [a + 0.035, c - 0.035]) slab(b, f, t, 0.36, 0.07, PUI + 0.03 - 0.36, 0.05, 'dark');
  slab(b, f, m, 0.35, w - 0.14, PUI + 0.03 - 0.35, 0.03, 'glass', 0.05);
  slab(b, f, m, 3.05, w - 0.1, 0.18, 0.05, 'dark', 0.08);
  if (o.kind === 'entrance') {
    // the door head under the transom: the upper lights read apart from the doors (2021 crop)
    slab(b, f, m, 2.87, w - 0.1, 0.18, 0.05, 'dark', 0.08);
    // the timber double doors (2021 crop): kick rail, stiles and head rail before the glass
    slab(b, f, m, 0.02, 1.64, 0.45, 0.06, 'ochre', 0.08);
    slab(b, f, m, 2.75, 1.64, 0.12, 0.06, 'ochre', 0.08);
    for (const s of [-0.77, 0, 0.77]) slab(b, f, m + s, 0.47, 0.1, 2.26, 0.06, 'ochre', 0.08);
  }
  if (o.awning) stripedAwningOn(b, f, {head: [[a + 0.06, 0.1], [c - 0.06, 0.1]], yHead: 3.3, drop: 0.4, proj: 0.75, stripe: 0.5, valance: 0.18, colours: ['white', 'white']});
}

/** A storey window: glass, a frame round it, mullions between the lights and a transom. */
function windowAt(b: BuildingTools, f: Frame, ax: Axis, y0: number, y1: number, ty: number) {
  const a = ax.a + 0.02, c = ax.c - 0.02, w = c - a, m = (a + c) / 2;
  // under the piers by 3 cm; on the round's facets inside the jambs, so neighbouring facets' panes stay apart
  slab(b, f, m, y0 - 0.05, ax.lights.length === 1 ? w - 0.12 : w + 0.06, y1 - y0 + 0.1, 0.04, 'glass');
  slab(b, f, m, y0, w, 0.08, 0.1, 'frame');
  slab(b, f, m, y1 - 0.08, w, 0.08, 0.1, 'frame');
  for (const t of [a + 0.04, c - 0.04]) slab(b, f, t, y0 + 0.08, 0.08, y1 - y0 - 0.16, 0.1, 'frame');
  slab(b, f, m, ty, w - 0.16, 0.07, 0.1, 'frame');
  let t = a;
  for (const l of ax.lights.slice(0, -1)) { t += l * w; slab(b, f, t, y0 + 0.08, 0.08, y1 - y0 - 0.16, 0.1, 'frame'); }
}

/** The fourth layer: three lights per axis between small stone posts, the middle widest and divided by a mullion. */
function mezzanine(b: BuildingTools, f: Frame, ax: Axis) {
  const a = ax.a + 0.02, c = ax.c - 0.02, w = c - a, m = (a + c) / 2;
  const [y0, y1] = MZ;
  // under the piers by 3 cm; on the round's facets inside the jambs, so neighbouring facets' panes stay apart
  slab(b, f, m, y0 - 0.05, ax.lights.length === 1 ? w - 0.12 : w + 0.06, y1 - y0 + 0.1, 0.04, 'glass');
  slab(b, f, m, y0, w, 0.08, 0.1, 'frame');
  slab(b, f, m, MZT, w, 0.07, 0.1, 'frame');
  const lights = ax.lights.length === 1 ? [1] : [0.22, 0.56, 0.22];
  let t = a;
  for (const l of lights.slice(0, -1)) { t += l * w; slab(b, f, t, y0, 0.28, y1 - y0 + 0.02, 0.1, 'stone'); }
  // the wide middle light has a mullion (2021 crop)
  if (lights.length === 3) slab(b, f, m, y0 + 0.08, 0.07, MZT - y0 - 0.08, 0.1, 'frame');
}
