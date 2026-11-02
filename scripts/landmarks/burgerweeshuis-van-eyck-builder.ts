import * as T from 'three';
import polygonClipping, {type MultiPolygon, type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, type Frame} from './nearbar-kit';
import {exposedRuns, inRing, type Piece, type Pt, type Run} from '../../src/canalRecall/landmarks/terraceBands';
import source from './burgerweeshuis-van-eyck-footprints.json';

/**
 * Burgerweeshuis, IJsbaanpad 1-5 / Amstelveenseweg 400-404 (Aldo van Eyck, 1958-1960; rijksmonument 532189; nl.wikipedia
 * "Burgerweeshuis (Amsterdam, IJsbaanpad)"). One BAG pand, 0363100012080770 (bouwjaar 1960), an outer ring and two patios
 * (scripts/landmarks/burgerweeshuis-van-eyck-prepare.ts). Native east/south metres from the outer ring's vertex average, y above
 * the 3DBAG ground (0.7 m NAP).
 *
 * The building is one 3.36 m module repeated (nl.wikipedia: 328 small units of 3.36 x 3.36 m, 8 large ones): the BAG corners
 * sit on a 3.36 m lattice turned 7.71 deg (fitted to the ring: phase 0.63 m along U, -0.03 m along V). Read from the register
 * text (monument 532189), the PDOK orthophoto and the Gemeente Amsterdam panoramas in burgerweeshuis-van-eyck-inventory.json:
 *  - every module carries a low square concrete dome (a cloister vault: the orthophoto shows the diagonal creases), some with a
 *    round roof light on top; eight large domes three modules square with a ring of round lights over the living rooms
 *    (counted on the orthophoto: four on two-storey pavilions in the north-west arm, 3DBAG eaves 5.8 m, apex 8.1 m; four on
 *    single-storey ones in the south-east arm, 3DBAG apex 5.2-5.9 m);
 *  - one storey of dark brown brick (one narrow steel window per module) or glass between round concrete columns on a concrete
 *    plinth, under the high concrete lintel with one long slot per module and a gutter on top (3DBAG roof 3.6 m);
 *  - the upper storeys of the four pavilions and of the long staff block on the north (3DBAG flat roof 6.06 m) in concrete
 *    panels, the same lintel at their top; the low semicircular hall on the south (3DBAG 2.4 m); the brick boiler chimney
 *    north of the staff block (orthophoto).
 * Every module dome is one instanced geometry; the large dome another.
 * INFERRED: which modules of the unphotographed (patio, garden) walls are glazed: patio faces and the faces of the eight living
 * rooms glazed, other walls brick with one window per module; the gateway under the staff block is not modelled (no photograph).
 */
type Ring3 = number[][];
const src = source as unknown as {rings: Record<string, number[][][]>; roofs: Record<string, Ring3[][]>};
type B = BuildingTools & {mark?: (n: string) => void};

// ---- the 3.36 m module lattice
const M = 3.36, TH = 7.7134 * Math.PI / 180, PU = 0.631, PV = -0.026;
const U: Pt = [Math.cos(TH), Math.sin(TH)], V: Pt = [-Math.sin(TH), Math.cos(TH)];
const dot = (a: Pt, c: Pt) => a[0] * c[0] + a[1] * c[1];
/** World point of lattice coordinates (i, j) in module units: i along U, j along V. */
const at = (i: number, j: number): Pt => { const u = PU + i * M, v = PV + j * M; return [U[0] * u + V[0] * v, U[1] * u + V[1] * v]; };
const cellOf = (p: Pt): [number, number] => [(dot(p, U) - PU) / M, (dot(p, V) - PV) / M];
const square = (i0: number, j0: number, i1: number, j1: number): Pt[] => [at(i0, j0), at(i1, j0), at(i1, j1), at(i0, j1)];

// ---- heights (m above the 0.7 m NAP ground)
const LINTEL = 2.55, ROOF = 3.6, CURB = 0.1;
const DOME_RISE = 0.85;
const PAV_ROOF = 5.8, PAV_RISE = 2.0;
const STAFF_ROOF = 6.06, STAFF_BOX = 6.58;
const HALL_ROOF = 2.4;

/** The eight large domes (lattice cell ranges, 3 x 3 modules; orthophoto and 3DBAG pyramids). */
const PAVILIONS = [
  {name: 'A', i: -19, j: -13, two: true}, {name: 'B', i: -14, j: -9, two: true},
  {name: 'C', i: -9, j: -5, two: true}, {name: 'D', i: -4, j: -1, two: true},
  {name: 'E', i: 8, j: -3, two: false}, {name: 'F', i: 4, j: 2, two: false},
  {name: 'G', i: 0, j: 7, two: false}, {name: 'H', i: -4, j: 12, two: false},
];
/** Glazed spans a panorama shows (wall line in lattice units, along-range in modules): w04-8 and w11-98. */
const GLAZED_BY_PHOTO: {axis: 'u' | 'v'; line: number; from: number; to: number}[] = [
  {axis: 'v', line: -17, from: -13, to: -7},
  {axis: 'u', line: 16, from: -7, to: -5},
];

/** Blank brick modules a panorama shows (no window): the west end module of the w04-8 entrance glazing. */
const BLANK_BY_PHOTO: typeof GLAZED_BY_PHOTO = [{axis: 'v', line: -17, from: -13, to: -12}];
const listed = (l: typeof GLAZED_BY_PHOTO, axis: 'u' | 'v', line: number, mid: number) => l.some(g => g.axis === (axis === 'u' ? 'v' : 'u') && Math.abs(g.line - line) < 0.3 && mid >= g.from && mid <= g.to);

const open = (r: number[][]) => (r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const toPoly = (rings: Pt[][]): Polygon => rings.map(r => [...r, r[0]].map(p => [p[0], p[1]] as [number, number]));
const fromMulti = (mp: MultiPolygon): Pt[][][] => mp.map(poly => poly.map(r => open(r) as Pt[]));

/** The BAG ring has 4-5 cm jogs where survey points meet (e.g. 118775.748 / 118775.793 RD); after snapping, merge vertices closer than 12 cm. */
function dejog(r: Pt[]): Pt[] {
  const out = [...r];
  for (let k = 0; k < out.length && out.length > 3;) {
    const a = out[k], c = out[(k + 1) % out.length];
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.12) { out[k] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; out.splice((k + 1) % out.length, 1); } else k++;
  }
  return out;
}
/** Snap a vertex onto a lattice line it lies within 12 cm of (the BAG corners scatter a few cm about the 3.36 m lattice). */
function snap(p: Pt): Pt {
  let [i, j] = cellOf(p);
  if (Math.abs(i - Math.round(i)) * M < 0.12) i = Math.round(i);
  if (Math.abs(j - Math.round(j)) * M < 0.12) j = Math.round(j);
  return at(i, j);
}
const BAG: Pt[][] = src.rings.main.map(r => dejog((open(r) as Pt[]).map(snap)));
// the hall's 3DBAG chord runs 5 cm short of the lattice line v = 6 that the module walls stand on: snap it there
const HALL: Pt[] = (open(src.roofs.main[6][0].map(p => [p[0], p[2]])) as Pt[]).map(p => { const [i, j] = cellOf(p); return j > 5.5 ? at(i, 6) : p; });
// The staff block: 3DBAG roof piece m29 spans lattice u -5..14.09, v -11.07..-9.01; cut on the lattice, the BAG clips its ends.
const STAFF: Pt[] = square(-5, -11, 14.2, -9);
const STAFF_TOP_BOX: Pt[] = open(src.roofs.main[5][0].map(p => [p[0], p[2]])) as Pt[];
const PAV_SQ = PAVILIONS.map(p => square(p.i, p.j, p.i + 3, p.j + 3));

// ---- plan pieces
const bagPoly = toPoly(BAG);
const hall = fromMulti(polygonClipping.intersection(bagPoly, toPoly([HALL])));
const body = fromMulti(polygonClipping.difference(bagPoly, toPoly([HALL])));
const staff = fromMulti(polygonClipping.intersection(bagPoly, toPoly([STAFF])));
const pavUpper = PAVILIONS.flatMap((p, k) => (p.two ? fromMulti(polygonClipping.intersection(bagPoly, toPoly([PAV_SQ[k]]))) : []));
const flatRoof = fromMulti(polygonClipping.difference(toPoly(body[0]), ...body.slice(1).map(toPoly), toPoly([STAFF]), ...PAVILIONS.flatMap((p, k) => (p.two ? [toPoly([PAV_SQ[k]])] : []))));

const piece = (rings: Pt[][], base: number, top: number): Piece => ({ring: rings[0], holes: rings.slice(1), base, top});
const inAny = (polys: Pt[][][], p: Pt) => polys.some(r => inRing(r[0], p[0], p[1]) && !r.slice(1).some(h => inRing(h, p[0], p[1])));

// ------------------------------------------------------------------------------------------------------------- geometry
function geom(pos: number[], role?: string) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  if (role) g.userData.role = role;
  return g;
}
/** Closed-sided prism over a plan polygon with holes: walls from y0 to y1 facing out, a top face; `bottom` adds the underside. */
function prism(b: B, rings: Pt[][], y0: number, y1: number, wall: string | null, roof: string | null, bottom: string | null = null) {
  const walls: number[] = [], top: number[] = [], bot: number[] = [];
  const area = (r: Pt[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  rings.forEach((r, ri) => {
    const ccw = area(r) > 0, outward = ri === 0 ? ccw : !ccw; // x-z plane: walk so the solid is on the left
    for (let k = 0; k < r.length; k++) {
      let p = r[k], q = r[(k + 1) % r.length];
      if (!outward) [p, q] = [q, p];
      // with x east, z south and y up, a counter-clockwise (in x-z) walk has the outside on the right: wall faces (q-p) x up
      walls.push(p[0], y0, p[1], p[0], y1, p[1], q[0], y1, q[1], p[0], y0, p[1], q[0], y1, q[1], q[0], y0, q[1]);
    }
  });
  const outer = rings[0], holes = rings.slice(1);
  const pts = [...outer, ...holes.flat()];
  const tris = T.ShapeUtils.triangulateShape(outer.map(p => new T.Vector2(p[0], p[1])), holes.map(h => h.map(p => new T.Vector2(p[0], p[1]))));
  for (const [i, j, k] of tris) {
    const A = pts[i], C = pts[j], D = pts[k];
    const up = (C[0] - A[0]) * (D[1] - A[1]) - (C[1] - A[1]) * (D[0] - A[0]) < 0; // +y normal when the x-z turn is clockwise
    if (up) top.push(A[0], y1, A[1], C[0], y1, C[1], D[0], y1, D[1]); else top.push(A[0], y1, A[1], D[0], y1, D[1], C[0], y1, C[1]);
    if (up) bot.push(A[0], y0, A[1], D[0], y0, D[1], C[0], y0, C[1]); else bot.push(A[0], y0, A[1], C[0], y0, C[1], D[0], y0, D[1]);
  }
  fixWinding(walls, rings, y0, y1);
  if (wall) b.add(geom(walls), wall as never);
  if (roof) b.add(geom(top, 'roof'), roof as never);
  if (bottom) b.add(geom(bot), bottom as never);
}
/** Flip any wall triangle whose normal points into the solid (probe 5 cm along the normal at mid-height). */
function fixWinding(pos: number[], rings: Pt[][], _y0: number, _y1: number) {
  const inside = (x: number, z: number) => inRing(rings[0], x, z) && !rings.slice(1).some(h => inRing(h, x, z));
  for (let t = 0; t < pos.length; t += 9) {
    const a = [pos[t], pos[t + 1], pos[t + 2]], c = [pos[t + 3], pos[t + 4], pos[t + 5]], d = [pos[t + 6], pos[t + 7], pos[t + 8]];
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(n[0], n[2]) || 1, mx = (a[0] + c[0] + d[0]) / 3, mz = (a[2] + c[2] + d[2]) / 3;
    if (inside(mx + n[0] / L * 0.05, mz + n[2] / L * 0.05)) for (let k = 0; k < 3; k++) { const s = pos[t + 3 + k]; pos[t + 3 + k] = pos[t + 6 + k]; pos[t + 6 + k] = s; }
  }
}

const vaultHeight = (s: number, r: number, round = true) => (round ? r * Math.sqrt(1 - s * s) : r * (1 - s * s));
/**
 * Square cloister vault: half-width h, rise r; rings at s = 1, 0.8, 0.45 of the half-width at r sqrt(1 - s^2) (`round`, the
 * module domes: full humps on the panoramas) or r (1 - s^2), an apex point, and a bottom face 3 cm under the base so the
 * shell is closed. Built once and cloned.
 */
function vault(h: number, r: number, round: boolean): T.BufferGeometry {
  const S = [1, 0.8, 0.45];
  const ring = (s: number, y: number) => [[-s * h, y, -s * h], [s * h, y, -s * h], [s * h, y, s * h], [-s * h, y, s * h]];
  const rings = [ring(1, -0.03), ...S.map(s => ring(s, vaultHeight(s, r, round)))];
  const pos: number[] = [];
  for (let k = 0; k + 1 < rings.length; k++) for (let e = 0; e < 4; e++) {
    const a = rings[k][e], c = rings[k][(e + 1) % 4], d = rings[k + 1][(e + 1) % 4], f = rings[k + 1][e];
    pos.push(...a, ...d, ...c, ...a, ...f, ...d);
  }
  const top = rings.at(-1)!, apex = [0, r, 0];
  for (let e = 0; e < 4; e++) pos.push(...top[e], ...apex, ...top[(e + 1) % 4]);
  const b0 = rings[0];
  pos.push(...b0[0], ...b0[1], ...b0[2], ...b0[0], ...b0[2], ...b0[3]);
  const g = geom(pos, 'roof');
  orientOut(g);
  return g;
}
/** Make every face of a star-shaped closed shell face away from its centroid. */
function orientOut(g: T.BufferGeometry) {
  const p = g.getAttribute('position').array as Float32Array;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < p.length; i += 3) { cx += p[i]; cy += p[i + 1]; cz += p[i + 2]; }
  const n = p.length / 3; cx /= n; cy /= n; cz /= n;
  for (let t = 0; t < p.length; t += 9) {
    const u = [p[t + 3] - p[t], p[t + 4] - p[t + 1], p[t + 5] - p[t + 2]], v = [p[t + 6] - p[t], p[t + 7] - p[t + 1], p[t + 8] - p[t + 2]];
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [(p[t] + p[t + 3] + p[t + 6]) / 3 - cx, (p[t + 1] + p[t + 4] + p[t + 7]) / 3 - cy, (p[t + 2] + p[t + 5] + p[t + 8]) / 3 - cz];
    if (nn[0] * m[0] + nn[1] * m[1] + nn[2] * m[2] < 0) for (let k = 0; k < 3; k++) { const s = p[t + 3 + k]; p[t + 3 + k] = p[t + 6 + k]; p[t + 6 + k] = s; }
  }
  g.getAttribute('position').needsUpdate = true;
  g.computeVertexNormals();
}

const SMALL = vault(M / 2 - 0.12, DOME_RISE, true);
/** The large domes are low and wide on the panoramas (w15-188): a parabolic profile. */
const LARGE = vault(1.5 * M - 0.15, PAV_RISE, false);
const SKY = new T.CylinderGeometry(0.28, 0.32, 0.22, 6);
const LIGHT = new T.CylinderGeometry(0.2, 0.2, 0.3, 6);

function placeAt(b: B, g: T.BufferGeometry, p: Pt, y: number, mat: string) {
  b.add(g.clone().rotateY(-TH).translate(p[0], y, p[1]), mat as never);
}

// -------------------------------------------------------------------------------------------------------------- massing
function massing(b: B) {
  for (const r of body) prism(b, r, 0, ROOF, 'brick', null);
  for (const r of flatRoof) prism(b, r, ROOF, ROOF, null, 'slate');
  for (const r of hall) prism(b, r, 0, HALL_ROOF, 'brick', 'slate');
  for (const r of staff) prism(b, r, ROOF, STAFF_ROOF, 'sandstone', 'blue');
  prism(b, [STAFF_TOP_BOX], STAFF_ROOF, STAFF_BOX, 'stone', 'slate');
  for (const r of pavUpper) prism(b, r, ROOF, PAV_ROOF, 'sandstone', 'slate');
  b.mark?.('massing');
}

// ------------------------------------------------------------------------------------------------------------- facades
const frameOfRun = (r: Run): {f: Frame; len: number} => {
  const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
  return {f: {origin: r.a, tangent: [(r.b[0] - r.a[0]) / len, (r.b[1] - r.a[1]) / len], n: r.n}, len};
};
/** Solid at plan point p below height y (the massing pieces of either storey). */
const solidAt = (p: Pt, y: number) => (inAny(body, p) && y < ROOF) || inAny(hall, p) && y < HALL_ROOF || (inAny(staff, p) && y < STAFF_ROOF) || (inAny(pavUpper, p) && y < PAV_ROOF);
/**
 * A band of depth d along the whole run (lintel, gutter). At a concave corner it stops d short (the other wing's band runs
 * through); at a convex corner the run along U runs on by d to close the corner, the run along V stops at the corner.
 */
function band(b: B, r: Run, f: Frame, len: number, y: number, h: number, d: number, mat: string) {
  const t: Pt = f.tangent, alongU = Math.abs(dot(t, U)) > 0.995, alongV = Math.abs(dot(t, V)) > 0.995;
  const adj = (end: 0 | 1) => {
    if (!alongU && !alongV) return 0;
    const s = end ? 1 : -1, e: Pt = end ? r.b : r.a;
    const q: Pt = [e[0] + t[0] * s * 0.15 + r.n[0] * 0.15, e[1] + t[1] * s * 0.15 + r.n[1] * 0.15];
    if (solidAt(q, y + h / 2)) return -d;
    const beyond: Pt = [e[0] + t[0] * s * 0.15 - r.n[0] * 0.15, e[1] + t[1] * s * 0.15 - r.n[1] * 0.15];
    return !solidAt(beyond, y + h / 2) && alongU ? d : 0;
  };
  const a0 = adj(0), a1 = adj(1);
  slab(b, f, (len + a1 - a0) / 2, y, len + a0 + a1, h, d, mat);
}
/** Bay boundaries (metres along the run) at the lattice lines the run crosses, plus its ends; null when the run is off-lattice. */
function bays(r: Run, len: number): {cuts: number[]; axis: 'u' | 'v'; line: number; along: (t: number) => number} | null {
  const t: Pt = [(r.b[0] - r.a[0]) / len, (r.b[1] - r.a[1]) / len];
  const du = dot(t, U), dv = dot(t, V);
  const axis = Math.abs(du) > 0.995 ? 'u' : Math.abs(dv) > 0.995 ? 'v' : null;
  if (!axis) return null;
  const A = axis === 'u' ? U : V, k = axis === 'u' ? du : dv, base = axis === 'u' ? PU : PV;
  const a0 = (dot(r.a, A) - base) / M, a1 = a0 + k * len / M;
  const cuts = [0];
  for (let g = Math.ceil(Math.min(a0, a1) + 0.15); g <= Math.max(a0, a1) - 0.15; g++) cuts.push(Math.abs((g - a0) * M / k));
  cuts.push(len);
  cuts.sort((x, y) => x - y);
  const [ci, cj] = cellOf(r.a);
  const line = Math.round(axis === 'u' ? cj : ci);
  return {cuts, axis, line, along: (tt: number) => a0 + k * tt / M};
}

function glazedBay(r: Run, axis: 'u' | 'v', line: number, mid: number, probe: Pt): boolean {
  // patio faces: the probe point outside the wall lies in one of the BAG holes
  if (BAG.slice(1).some(h => inRing(h, probe[0], probe[1]))) return true;
  if (listed(GLAZED_BY_PHOTO, axis, line, mid)) return true;
  // living rooms: the module behind the wall belongs to a large-dome square; their north faces stay brick (w03-8)
  if (dot(r.n, V) < -0.7) return false;
  const inner: Pt = [probe[0] - r.n[0] * 0.8, probe[1] - r.n[1] * 0.8];
  const [ci, cj] = cellOf(inner);
  return PAVILIONS.some(p => ci > p.i && ci < p.i + 3 && cj > p.j && cj < p.j + 3);
}

/** Ground storey of every exposed wall: brick or glass bays, the lintel with its slots, the gutter. */
function groundStorey(b: B) {
  const pieces = [...body.map(r => piece(r, 0, ROOF)), ...hall.map(r => piece(r, 0, HALL_ROOF))];
  for (const r of exposedRuns(pieces, 1.4, {minLen: 0.8})) {
    const {f, len} = frameOfRun(r);
    const isHall = inAny(hall, [(r.a[0] + r.b[0]) / 2 - r.n[0] * 0.3, (r.a[1] + r.b[1]) / 2 - r.n[1] * 0.3]);
    const top = isHall ? HALL_ROOF : ROOF;
    const lintel0 = isHall ? HALL_ROOF - 0.75 : LINTEL, gutter0 = top - 0.15;
    // lintel and gutter run the whole length
    band(b, r, f, len, lintel0, gutter0 - lintel0, 0.1, 'concrete');
    band(b, r, f, len, gutter0, 0.15 + CURB, 0.24, 'stone');
    const bz = bays(r, len);
    if (!bz) continue;
    const cols = new Set<number>();
    for (let k = 0; k + 1 < bz.cuts.length; k++) {
      const t0 = bz.cuts[k], t1 = bz.cuts[k + 1], w = t1 - t0, tc = (t0 + t1) / 2;
      if (w < 0.9) continue;
      // the lintel slot of this module (not on a stub facing another wall within 3.2 m across a one-module notch: the audit
      // reads a lone slot there against the wall opposite)
      const across: Pt = [f.origin[0] + f.tangent[0] * tc + r.n[0] * 3.2, f.origin[1] + f.tangent[1] * tc + r.n[1] * 3.2];
      if (len > 4 || !solidAt(across, 3)) slab(b, f, tc, lintel0 + 0.33, Math.min(2.1, w - 1.1), 0.24, 0.06, 'glass', 0.1);
      if (isHall) continue;
      const mid = bz.along(tc);
      const probe: Pt = [f.origin[0] + f.tangent[0] * tc + r.n[0] * 0.4, f.origin[1] + f.tangent[1] * tc + r.n[1] * 0.4];
      // a wall stub under two modules long keeps brick: a full-height pane there would be most of its face
      if (len >= 6 && glazedBay(r, bz.axis, bz.line, mid, probe)) {
        slab(b, f, tc, 0, w - 0.2, 0.3, 0.08, 'concrete');
        slab(b, f, tc, 0.3, w - 0.36, LINTEL - 0.3, 0.06, 'glass');
        slab(b, f, tc, 0.3, 0.07, LINTEL - 0.3, 0.12, 'bronze');
        slab(b, f, tc, 1.25, w - 0.36, 0.07, 0.17, 'bronze');
        cols.add(+t0.toFixed(3)); cols.add(+t1.toFixed(3));
      } else if (w > 2.4 && !listed(BLANK_BY_PHOTO, bz.axis, bz.line, mid)) {
        slab(b, f, tc, 0.84, 1.0, 1.56, 0.06, 'glass');
      }
    }
    for (const tt of cols) column(b, f, tt);
  }
  b.mark?.('ground');
}
/** Round concrete column standing in the wall plane at t, half proud, on the plinth up to the lintel. */
function column(b: B, f: Frame, t: number) {
  const c: Pt = [f.origin[0] + f.tangent[0] * t + f.n[0] * 0.09, f.origin[1] + f.tangent[1] * t + f.n[1] * 0.09];
  b.add(new T.CylinderGeometry(0.17, 0.17, LINTEL - 0.3, 6).translate(c[0], 0.3 + (LINTEL - 0.3) / 2, c[1]), 'concrete' as never);
}

/** Upper storeys of the four pavilions and the staff block: concrete panels, the lintel with slots, the gutter, small windows. */
function upperStoreys(b: B) {
  const pieces = [...pavUpper.map(r => piece(r, ROOF, PAV_ROOF)), ...staff.map(r => piece(r, ROOF, STAFF_ROOF))];
  for (const r of exposedRuns(pieces, 4.4, {minLen: 0.8})) {
    const {f, len} = frameOfRun(r);
    const isStaff = inAny(staff, [(r.a[0] + r.b[0]) / 2 - r.n[0] * 0.3, (r.a[1] + r.b[1]) / 2 - r.n[1] * 0.3]);
    const top = isStaff ? STAFF_ROOF : PAV_ROOF, lintel0 = top - 0.85, gutter0 = top - 0.15;
    band(b, r, f, len, lintel0, gutter0 - lintel0, 0.1, 'concrete');
    band(b, r, f, len, gutter0, 0.15 + CURB, 0.24, 'stone');
    const bz = bays(r, len);
    if (!bz) continue;
    for (let k = 0; k + 1 < bz.cuts.length; k++) {
      const t0 = bz.cuts[k], t1 = bz.cuts[k + 1], w = t1 - t0, tc = (t0 + t1) / 2;
      if (w < 0.9) continue;
      slab(b, f, tc, lintel0 + 0.3, Math.min(2.1, w - 1.1), 0.24, 0.06, 'glass', 0.1);
      const centreBay = k === Math.floor((bz.cuts.length - 1) / 2);
      if (w > 2.4 && (isStaff ? k % 2 === 1 : centreBay)) {
        slab(b, f, tc, ROOF + 0.55, 1.0, 1.0, 0.06, 'glass');
        slab(b, f, tc, ROOF + 0.49, 1.1, 0.06, 0.12, 'concrete');
      }
    }
  }
  b.mark?.('upper');
}

// ---------------------------------------------------------------------------------------------------------------- domes
const hash = (i: number, j: number) => ((i * 73856093) ^ (j * 19349663)) >>> 0;
function domes(b: B) {
  let small = 0;
  for (let i = -22; i <= 20; i++) for (let j = -20; j <= 20; j++) {
    const c = at(i + 0.5, j + 0.5);
    if (PAVILIONS.some(p => i >= p.i && i < p.i + 3 && j >= p.j && j < p.j + 3)) continue;
    const corners = [at(i + 0.1, j + 0.1), at(i + 0.9, j + 0.1), at(i + 0.9, j + 0.9), at(i + 0.1, j + 0.9)];
    if (![c, ...corners].every(p => inAny(flatRoof, p))) continue;
    placeAt(b, SMALL, c, ROOF, 'pink');
    small++;
    if (hash(i, j) % 3 === 0) placeAt(b, SKY, c, ROOF + DOME_RISE - 0.04, 'canopyGlass');
  }
  for (const p of PAVILIONS) {
    const c = at(p.i + 1.5, p.j + 1.5), y = p.two ? PAV_ROOF : ROOF;
    placeAt(b, LARGE, c, y, 'pink');
    // the ring of round lights at 0.45 of the half-width
    const h = 1.5 * M - 0.15, rr = 0.45 * h;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const s = Math.max(Math.abs(x), Math.abs(z)) / h;
      const lp: Pt = [c[0] + x * U[0] + z * V[0], c[1] + x * U[1] + z * V[1]];
      placeAt(b, LIGHT, lp, y + vaultHeight(s, PAV_RISE, false) + 0.04, 'canopyGlass');
    }
  }
  b.mark?.(`domes ${small}`);
}

// -------------------------------------------------------------------------------------------------------------- chimney
/** Brick boiler chimney north of the staff block (orthophoto: 1.8 x 3.0 m top at RD 118851.5, 483790.3; height from w29-8). */
function chimney(b: B) {
  const c: Pt = [33.6, -35.4];
  const g = new T.BoxGeometry(1.8, 11.5, 3.0).translate(0, 11.5 / 2, 0).rotateY(-TH).translate(c[0], 0, c[1]);
  b.add(g, 'brick' as never);
  b.add(new T.BoxGeometry(2.0, 0.25, 3.2).translate(0, 11.5 + 0.12, 0).rotateY(-TH).translate(c[0], 0, c[1]), 'concrete' as never);
}

export function buildBurgerweeshuisVanEyck(_w: number, _d: number, b: B) {
  massing(b);
  setSink(0.05);
  groundStorey(b);
  upperStoreys(b);
  setSink(0);
  domes(b);
  chimney(b);
}
