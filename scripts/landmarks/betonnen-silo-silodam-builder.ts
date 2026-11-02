import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Betonnen silo (concrete grain silo), Silodam, BAG pand 0363100012237143 (BAG bouwjaar 1952, 8 storeys in BAG; Silodam
 * 1E/1F and 2-82). Built in 1952 beside the Stenen Silo when that became too small (nl.wikipedia Silodam / Stenen Silo);
 * inhabited since 1999 after the conversion whose restoration architect for both silos was André van Stigt; 84 social and
 * 11 free-sector homes and 1,600 m2 of business space. BAG: 95 woonfunctie, 3 industrie and 3 kantoor units. No monument
 * record and no article of its own; the architect of 1952 is not confirmed by any source used here.
 *
 * Read from Alf van Beem's "Silodam, Betonnen graansilo foto 1-6" (Wikimedia Commons, public domain, 2017) and the city
 * panoramas of the brief (Gemeente Amsterdam, CC BY 4.0):
 * - a pale concrete slab of nine window storeys over a 5.6 m glazed ground storey, the slab edge a white fascia; on both
 *   long fronts eleven columns of tall narrow windows with glass balustrades (French balconies), about a third closed by
 *   grey roller blinds; flat vertical panel strips between the columns on the west (street) front; a cornice band;
 * - the south end (foto 1): two columns of windows in the top six storeys and the external spiral fire stair in a round
 *   steel cage up the middle, a straight flight from the first floor down to the quay;
 * - on the roof a set-back glazed roof storey under a shallow gabled zinc-and-glass roof (3DBAG eaves 32.7, ridge 35.2 m),
 *   maroon railings at the slab edge;
 * - at the north end the head tower (to 46.4 m; 3DBAG): two concrete blocks with a perforated-metal eave canopy and a
 *   railing, west/east faces of two bays of large gridded windows over four storeys (foto 3, 4, 6), south faces of buff
 *   textured panels with round porthole windows (foto 1, 4), and between them the white rendered core rising to 48.6 m
 *   with flues on top and louvres;
 * - on the west the ground storey steps out 1.5 m under cantilevered canopies (3DBAG roofs 5.6 m), and a low white
 *   louvred service block at the north-west corner.
 *
 * Plan (betonnen-silo-silodam-footprints.json, 3DBAG LoD2.2) in the axis frame of the Graansilo builder: u along bearing
 * 345.25 (north positive) and v along 75.25 (east positive), from this pand's anchor. Slab u -33.1..13.0, v -7.66..12.4.
 */
type V2 = [number, number];
type C = 'red' | 'stone' | 'ochre' | 'white' | 'glass' | 'frame' | 'dark' | 'slate' | 'bronze' | 'slate' | 'concrete';
let b: BuildingTools;

const AX: V2 = [Math.sin(345.25 * Math.PI / 180), -Math.cos(345.25 * Math.PI / 180)];
const CR: V2 = [Math.sin(75.25 * Math.PI / 180), -Math.cos(75.25 * Math.PI / 180)];
const N = (u: number, v: number): V2 => [u * AX[0] + v * CR[0], u * AX[1] + v * CR[1]];
const P3 = (u: number, v: number, y: number) => { const p = N(u, v); return new T.Vector3(p[0], y, p[1]); };
const rectUV = (u0: number, u1: number, v0: number, v1: number): V2[] => [N(u0, v0), N(u1, v0), N(u1, v1), N(u0, v1)];
const along = (f: Frame, p: V2) => (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];
const nu = (f: Frame) => f.n[0] * AX[0] + f.n[1] * AX[1], nv = (f: Frame) => f.n[0] * CR[0] + f.n[1] * CR[1];

/* ------------------------------------------------------------------ measured heights and plan */
const U_S = -33.1, U_N = 13.0, V_W = -7.66, V_E = 12.4;      // slab
const GROUND = 5.6;                                           // glazed ground storey; slab edge (3DBAG canopies 5.6)
const STOREYS = 9, STOREY = 2.41;                             // window storeys 5.6..27.3 (foto 2/6, panorama w01 at 32.6 px/m)
const CORNICE: [number, number] = [27.3, 28.85];              // cornice band; slab roof 28.7 (3DBAG 28.6-28.8)
const ROOF = 28.7;
const PH = {u0: -32.6, u1: 1.0, v0: -5.7, v1: 10.2, top: 32.9, ridgeV: 2.3, ridge: 35.15, eaveW: -6.5, eaveE: 11.0};
const TOWER = {u0: 1.2, u1: 13.0, top: 46.4};                 // head tower (3DBAG 46.4)
const BLOCK_W: [number, number] = [-4.2, 0.6], BLOCK_E: [number, number] = [4.4, 9.7];
const CORE = {v0: 0.6, v1: 4.4, u1: 14.5, top: 48.6};         // white core (3DBAG 48.4-48.7; flues to 49.6)
const COLS = [...Array(11)].map((_, k) => 9.35 - 4.15 * k);  // window columns of the long fronts (u)
const storeyBase = (i: number) => GROUND + i * STOREY;
/** Roller blinds closed (grey) on about a third of the long-front windows; fixed pattern, not random per build. */
const blind = (k: number, i: number, side: number) => ((k * 7 + i * 3 + side * 5) % 10) < 3;

/* ------------------------------------------------------------------ mesh helpers */
class Mesh {
  private tris = new Map<C, number[]>();
  quad(f: Frame, q: WallQuad, c: C) {
    const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o]);
    const a = this.tris.get(c) ?? [];
    a.push(...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
    this.tris.set(c, a);
  }
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: C) {
    this.quad(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], normal: [0, 0, 1]}, c);
  }
  tri(p: T.Vector3, q: T.Vector3, r: T.Vector3, c: C, dir: T.Vector3) {
    const n = new T.Vector3().subVectors(q, p).cross(new T.Vector3().subVectors(r, p));
    const a = this.tris.get(c) ?? [];
    if (n.dot(dir) >= 0) a.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z); else a.push(p.x, p.y, p.z, r.x, r.y, r.z, q.x, q.y, q.z);
    this.tris.set(c, a);
  }
  flush() {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c as never);
    }
    this.tris.clear();
  }
}
let m: Mesh;
type Cut = HoledOpening & {back: C; reveal?: C};
/** Holed wall on ring edge i between ta..tb; wall faces are flushed before any trim (see the Graansilo builder's note on quantised normals). */
function wall(ring: V2[], i: number, y0: number, y1: number, c: C, cuts: Cut[] = [], ta?: number, tb?: number): Frame {
  const {f, len} = ringFrame(ring, i), a = ta ?? 0, z = tb ?? len;
  const g: Frame = {...f, origin: [f.origin[0] + f.tangent[0] * a, f.origin[1] + f.tangent[1] * a]};
  const hw = holedWall(z - a, y0, y1, cuts);
  for (const q of hw.face) m.quad(g, q, c);
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(g, q, cuts[k].reveal ?? c)));
  hw.backs.forEach((q, k) => m.quad(g, q, cuts[k].back));
  m.flush();
  return g;
}
function roof(ring: V2[], h: number, c: C) {
  b.add(upwardRoofPlane(new T.Shape(ring.map(p => new T.Vector2(p[0], p[1]))), h), c as never);
}
/** Box spanning u0..u1 whose centre line runs from (v0, y0) to (v1, y1) in the cross section, `th` thick. */
function plank(u0: number, u1: number, v0: number, y0: number, v1: number, y1: number, th: number, c: C) {
  const x = new T.Vector3(AX[0], 0, AX[1]), s = new T.Vector3(CR[0] * (v1 - v0), y1 - y0, CR[1] * (v1 - v0)), L = s.length();
  const z = s.clone().normalize(), y = new T.Vector3().crossVectors(z, x).normalize();
  const ctr = P3((u0 + u1) / 2, (v0 + v1) / 2, (y0 + y1) / 2);
  const g = new T.BoxGeometry(u1 - u0, th, L).applyMatrix4(new T.Matrix4().makeBasis(x, y, z).setPosition(ctr));
  b.add(g, c as never);
}
/** Vertical box in plan u0..u1 x v0..v1 from y0 to y1. */
function block(u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, c: C) {
  const ctr = P3((u0 + u1) / 2, (v0 + v1) / 2, (y0 + y1) / 2);
  const g = new T.BoxGeometry(u1 - u0, y1 - y0, v1 - v0).applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(AX[0], 0, AX[1]), new T.Vector3(0, 1, 0), new T.Vector3(CR[0], 0, CR[1])).setPosition(ctr));
  b.add(g, c as never);
}
/** Find the edge of `ring` whose outward normal points along (du, dv). */
function edge(ring: V2[], du: number, dv: number): number {
  for (let i = 0; i < ring.length; i++) { const {f} = ringFrame(ring, i); if (nu(f) * du + nv(f) * dv > 0.99) return i; }
  throw Error('no edge');
}
/** Railing on a slab edge: posts every ~2 m and a top rail, from p to q (uv) at height y. */
function railing(p: V2, q: V2, y: number, c: C, h = 1.05) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 2.0));
  const a = N(p[0], p[1]), z = N(q[0], q[1]), ang = -Math.atan2(z[1] - a[1], z[0] - a[0]);
  b.add(new T.BoxGeometry(L, 0.06, 0.06).rotateY(ang).translate((a[0] + z[0]) / 2, y + h, (a[1] + z[1]) / 2), c as never);
  b.add(new T.BoxGeometry(L, 0.04, 0.04).rotateY(ang).translate((a[0] + z[0]) / 2, y + h * 0.45, (a[1] + z[1]) / 2), c as never);
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = a[0] + (z[0] - a[0]) * t, w = a[1] + (z[1] - a[1]) * t;
    b.add(new T.BoxGeometry(0.05, h, 0.05).rotateY(ang).translate(x, y + h / 2, w), c as never);
  }
}

/* ------------------------------------------------------------------ the slab */
/** Window cuts of one long-front column per storey (French balcony: glass balustrade rail in the opening). */
function longFront(ring: V2[], dv: number, west: boolean) {
  const i = edge(ring, 0, dv), {f, len} = ringFrame(ring, i);
  const cuts: Cut[] = [], tOf = (u: number) => along(f, N(u, dv > 0 ? V_E : V_W));
  COLS.forEach((u, k) => {
    const t = tOf(u);
    for (let s = 0; s < STOREYS; s++) {
      const y = storeyBase(s);
      cuts.push({t0: t - 0.85, t1: t + 0.85, y0: y + 0.2, y1: y + 2.12, depth: 0.22, back: blind(k, s, west ? 1 : 0) ? 'frame' : 'glass', reveal: 'concrete'});
    }
  });
  const g = wall(ring, i, GROUND, CORNICE[0], 'concrete', cuts);
  COLS.forEach((u, k) => {
    const t = tOf(u);
    for (let s = 0; s < STOREYS; s++) {
      const y = storeyBase(s);
      if (blind(k, s, west ? 1 : 0)) continue;
      m.rect(g, t - 0.85, t + 0.85, y + 1.02, y + 1.08, -0.1, 'frame');          // balustrade rail
      m.rect(g, t - 0.03, t + 0.03, y + 0.2, y + 2.12, -0.16, 'frame');          // mullion
    }
  });
  m.flush();
  // west front: flat vertical panel strips between the columns (foto 2, 6)
  if (west) for (let k = 0; k + 1 < COLS.length; k++) slab(b, g, tOf((COLS[k] + COLS[k + 1]) / 2), GROUND, 0.9, CORNICE[0] - GROUND, 0.06, 'concrete');
  void len;
}

function southFront(ring: V2[]) {
  const i = edge(ring, -1, 0), {f} = ringFrame(ring, i), tOf = (v: number) => along(f, N(U_S, v));
  const cuts: Cut[] = [];
  for (const v of [-1.2, 6.25]) for (let s = 3; s < STOREYS; s++) {
    const y = storeyBase(s), t = tOf(v);
    cuts.push({t0: t - 0.85, t1: t + 0.85, y0: y + 0.75, y1: y + 1.95, depth: 0.22, back: 'glass', reveal: 'concrete'});
  }
  const g = wall(ring, i, GROUND, CORNICE[0], 'concrete', cuts);
  for (const v of [-1.2, 6.25]) for (let s = 3; s < STOREYS; s++) m.rect(g, tOf(v) - 0.03, tOf(v) + 0.03, storeyBase(s) + 0.75, storeyBase(s) + 1.95, -0.16, 'frame');
  m.flush();
}

/** Glazed ground storey on one face: windows in white frames between white piers. */
function groundFace(ring: V2[], i: number, ta: number, tb: number, pitch: number) {
  const n = Math.max(1, Math.round((tb - ta) / pitch)), p = (tb - ta) / n, cuts: Cut[] = [];
  for (let k = 0; k < n; k++) cuts.push({t0: k * p + 0.35, t1: (k + 1) * p - 0.35, y0: 0.35, y1: 4.55, depth: 0.15, back: 'glass', reveal: 'white'});
  const g = wall(ring, i, 0, GROUND, 'white', cuts, ta, tb);
  for (let k = 0; k < n; k++) {
    const c = (k + 0.5) * p;
    m.rect(g, c - 0.03, c + 0.03, 0.35, 4.55, -0.1, 'white');
    m.rect(g, k * p + 0.35, (k + 1) * p - 0.35, 2.95, 3.03, -0.1, 'white');
  }
  m.flush();
}

/* ------------------------------------------------------------------ build */
export function buildBetonnenSiloSilodam(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh();
  setSink(0.15, true);
  const S = rectUV(U_S, U_N, V_W, V_E);

  // upper slab: long fronts, south end, north face beside the core
  longFront(S, 1, false);
  longFront(S, -1, true);
  southFront(S);
  const iN = edge(S, 1, 0), fN = ringFrame(S, iN).f, tv = (v: number) => along(fN, N(U_N, v));
  const nA = [tv(V_W), tv(CORE.v0)].sort((a, c) => a - c), nB = [tv(CORE.v1), tv(V_E)].sort((a, c) => a - c);
  wall(S, iN, GROUND, CORNICE[0], 'concrete', [], nA[0], nA[1]);
  wall(S, iN, GROUND, CORNICE[0], 'concrete', [], nB[0], nB[1]);

  // ground storey: glazed on the east, south and the west between the projections; the white service block at the NW
  const iE = edge(S, 0, 1), iW = edge(S, 0, -1), iS = edge(S, -1, 0);
  groundFace(S, iE, 0, ringFrame(S, iE).len, 4.15);
  groundFace(S, iS, 0, ringFrame(S, iS).len, 4.0);
  const fW = ringFrame(S, iW).f, tw = (u: number) => along(fW, N(u, V_W));
  const wSpans: [number, number][] = [[U_S, -26.62], [-20.86, -1.91]];
  for (const [u0, u1] of wSpans) { const [a, c] = [tw(u0), tw(u1)].sort((x, y) => x - y); groundFace(S, iW, a, c, 4.0); }
  { const [a, c] = [tw(9.97), tw(U_N)].sort((x, y) => x - y); wall(S, iW, 0, GROUND, 'white', [], a, c); }
  wall(S, iN, 0, GROUND, 'white', [], nA[0], nA[1]);
  wall(S, iN, 0, GROUND, 'white', [], nB[0], nB[1]);
  // west projections under cantilevered canopies (3DBAG roofs 5.6 m at v -9.15)
  for (const [u0, u1] of [[-26.62, -20.86], [-1.91, 9.97]] as [number, number][]) {
    const R = rectUV(u0, u1, -9.15, V_W);
    const iF = edge(R, 0, -1), lenF = ringFrame(R, iF).len;
    groundFace(R, iF, 0, lenF, 3.0);
    for (const du of [-1, 1]) wall(R, edge(R, du, 0), 0, 5.3, 'white');
    roof(R, 5.3, 'bronze');
    // canopy: a white cantilevered slab 0.6 m past the glass front
    block(u0 - 0.3, u1 + 0.3, -9.75, -7.5, 5.22, 5.68, 'white');
  }
  // service block (w04/w05): white panels with louvres
  {
    const R = rectUV(9.97, U_N, -9.1, V_W);
    const iF = edge(R, 0, -1);
    const g = wall(R, iF, 0, 5.3, 'white', [0.4, 1.4].map(t => ({t0: t, t1: t + 0.7, y0: 0.6, y1: 2.6, depth: 0.08, back: 'dark' as C})));
    void g;
    for (const du of [-1, 1]) wall(R, edge(R, du, 0), 0, 5.3, 'white');
    roof(R, 5.3, 'bronze');
  }
  // the slab edge over the ground storey: white fascia all round
  for (const [du, dv] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const i = edge(S, du, dv), {f, len} = ringFrame(S, i), ew = dv !== 0;   // N/S bands sit inside the E/W ones at the corners
    slab(b, f, len / 2, ew ? GROUND - 0.3 : GROUND - 0.25, ew ? len + 0.6 : len, ew ? 0.3 : 0.2, ew ? 0.3 : 0.25, 'white');
  }
  // core north bump (the white core runs down to the quay on the north side)
  {
    const R = rectUV(U_N, CORE.u1, CORE.v0, CORE.v1);
    wall(R, edge(R, 1, 0), 0, CORE.top, 'white', [0, 1, 2, 3, 4, 5, 6].map(k => ({t0: 1.3, t1: 2.5, y0: 7 + k * 5.5, y1: 8.2 + k * 5.5, depth: 0.1, back: 'dark' as C})));
    for (const dv of [-1, 1]) wall(R, edge(R, 0, dv), 0, CORE.top, 'white');
  }

  // cornice band and roof
  for (const [du, dv] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const i = edge(S, du, dv), {f, len} = ringFrame(S, i), ew = dv !== 0;
    slab(b, f, len / 2, ew ? CORNICE[0] : CORNICE[0] + 0.05, ew ? len + 0.3 : len, CORNICE[1] - CORNICE[0] - (ew ? 0 : 0.1), ew ? 0.15 : 0.12, 'concrete');
  }
  roof(S, ROOF, 'bronze');
  // maroon railings at the slab edge (west, east, south)
  railing([U_S + 0.2, V_W + 0.2], [TOWER.u0, V_W + 0.2], CORNICE[1], 'red');
  railing([U_S + 0.2, V_E - 0.2], [11.6, V_E - 0.2], CORNICE[1], 'red');
  railing([U_S + 0.2, V_W + 0.2], [U_S + 0.2, V_E - 0.2], CORNICE[1], 'red');

  penthouse();
  tower();
  spiralStair();
  glassShaft();
}

/* ------------------------------------------------------------------ roof storey */
function penthouse() {
  const R = rectUV(PH.u0, PH.u1, PH.v0, PH.v1);
  // long walls: aluminium panels with a glazed band per 2.4 m bay
  for (const dv of [-1, 1]) {
    const i = edge(R, 0, dv), len = ringFrame(R, i).len, n = Math.round(len / 2.4), p = len / n;
    const cuts: Cut[] = [...Array(n)].map((_, k) => ({t0: k * p + 0.2, t1: (k + 1) * p - 0.2, y0: ROOF + 0.3, y1: PH.top - 0.4, depth: 0.12, back: 'glass' as C, reveal: 'frame' as C}));
    const g = wall(R, i, ROOF, PH.top, 'slate', cuts);
    for (let k = 0; k < n; k++) m.rect(g, (k + 0.5) * p - 0.03, (k + 0.5) * p + 0.03, ROOF + 0.3, PH.top - 0.4, -0.08, 'frame');
    m.flush();
  }
  // gable ends: glazed (foto 1, 2), a frame grid
  for (const du of [-1, 1]) {
    const i = edge(R, du, 0), len = ringFrame(R, i).len, n = 6, p = len / n;
    const cuts: Cut[] = [...Array(n)].map((_, k) => ({t0: k * p + 0.12, t1: (k + 1) * p - 0.12, y0: ROOF + 0.3, y1: PH.top - 0.15, depth: 0.1, back: 'glass' as C, reveal: 'frame' as C}));
    wall(R, i, ROOF, PH.top, 'slate', cuts);
    const u = du < 0 ? PH.u0 : PH.u1, dir = new T.Vector3(AX[0] * du, 0, AX[1] * du);
    const yAt = (v: number) => PH.top + (PH.ridge - PH.top) * (v < PH.ridgeV ? (v - PH.v0) / (PH.ridgeV - PH.v0) : (PH.v1 - v) / (PH.v1 - PH.ridgeV));
    // gable triangle: a copper ring round a triangular glazed light set 10 cm back (the glass sits in a hole, not on the face)
    const O = [P3(u, PH.v0, PH.top), P3(u, PH.v1, PH.top), P3(u, PH.ridgeV, yAt(PH.ridgeV))];
    const I = [P3(u, PH.v0 + 3.0, PH.top + 0.25), P3(u, PH.v1 - 3.0, PH.top + 0.25), P3(u, PH.ridgeV, PH.ridge - 0.75)];
    const back = (p: T.Vector3) => p.clone().addScaledVector(dir, -0.1);
    for (let k = 0; k < 3; k++) {
      const k1 = (k + 1) % 3;
      m.tri(O[k], O[k1], I[k1], 'slate', dir); m.tri(O[k], I[k1], I[k], 'slate', dir);
      const rd = new T.Vector3().subVectors(new T.Vector3().addVectors(I[k], I[k1]).multiplyScalar(0.5), new T.Vector3().addVectors(I[0], I[1]).add(I[2]).multiplyScalar(1 / 3));
      m.tri(I[k], I[k1], back(I[k1]), 'slate', rd.negate()); m.tri(I[k], back(I[k1]), back(I[k]), 'slate', rd);
    }
    m.flush();
    m.tri(back(I[0]), back(I[1]), back(I[2]), 'glass', dir);
    m.flush();
  }
  // shallow gabled zinc-and-glass roof with eaves over the terraces
  const yW = PH.top - (PH.ridge - PH.top) * (PH.v0 - PH.eaveW) / (PH.ridgeV - PH.v0), yE = PH.top - (PH.ridge - PH.top) * (PH.eaveE - PH.v1) / (PH.v1 - PH.ridgeV);
  plank(PH.u0 - 0.4, PH.u1, PH.eaveW, yW + 0.08, PH.ridgeV, PH.ridge + 0.08, 0.16, 'slate');
  plank(PH.u0 - 0.4, PH.u1, PH.ridgeV, PH.ridge + 0.08, PH.eaveE, yE + 0.08, 0.16, 'slate');
  // roof glazing strips either side of the ridge (foto 1: the glazed upper roof)
  for (const [v0, v1] of [[PH.ridgeV - 3.2, PH.ridgeV - 0.4], [PH.ridgeV + 0.4, PH.ridgeV + 3.2]]) {
    const yy = (v: number) => (v < PH.ridgeV ? yW + (PH.ridge - yW) * (v - PH.eaveW) / (PH.ridgeV - PH.eaveW) : PH.ridge + (yE - PH.ridge) * (v - PH.ridgeV) / (PH.eaveE - PH.ridgeV)) + 0.2;
    plank(PH.u0 + 0.6, PH.u1 - 0.6, v0, yy(v0), v1, yy(v1), 0.04, 'glass');
  }
}

/* ------------------------------------------------------------------ head tower */
function tower() {
  const y0 = ROOF, top = TOWER.top;
  const rows: [number, number][] = [[33.3, 35.6], [35.8, 38.1], [39.6, 41.9], [42.1, 44.4]];   // foto 3/4: two pairs of storeys
  for (const [v0, v1, side] of [[...BLOCK_W, -1], [...BLOCK_E, 1]] as [number, number, number][]) {
    const R = rectUV(TOWER.u0, TOWER.u1, v0, v1);
    // outer long face: two bays of large gridded windows
    const iO = edge(R, 0, side), len = ringFrame(R, iO).len, bays: [number, number][] = [[1.0, len / 2 - 0.5], [len / 2 + 0.5, len - 1.0]];
    const cuts: Cut[] = bays.flatMap(([t0, t1]) => rows.map(([a, c]) => ({t0, t1, y0: a, y1: c, depth: 0.2, back: 'glass' as C, reveal: 'frame' as C})));
    const g = wall(R, iO, y0, top, 'stone', cuts);
    for (const [t0, t1] of bays) for (const [a, c] of rows) {
      for (let k = 1; k < 4; k++) { const t = t0 + (t1 - t0) * k / 4; m.rect(g, t - 0.035, t + 0.035, a, c, -0.14, 'slate'); }
      m.rect(g, t0, t1, (a + c) / 2 - 0.035, (a + c) / 2 + 0.035, -0.14, 'frame');
    }
    m.flush();
    // south face: buff textured panels with round porthole windows (foto 1, 4: two columns, four rows high up, two lower)
    const iS = edge(R, -1, 0), lenS = ringFrame(R, iS).len, fS = wall(R, iS, y0, top, 'stone');
    const cols = [lenS * 0.33, lenS * 0.67];
    for (const t of cols) for (const y of [36.0, 39.2, 40.4, 41.6, 42.8]) {
      slab(b, fS, t, y, 1.0, 1.0, 0.05, 'ochre');
      put(b, fS, new T.CylinderGeometry(0.27, 0.27, 0.04, 10).rotateX(Math.PI / 2).translate(0, 0.5, 0.02), t, y, 0.05, 'dark');
      put(b, fS, new T.CylinderGeometry(0.2, 0.2, 0.04, 10).rotateX(Math.PI / 2).translate(0, 0.5, 0.02), t, y, 0.11, 'glass');
    }
    // north face: plain concrete (no photo of it)
    wall(R, edge(R, 1, 0), y0, top, 'stone');
    roof(R, top, 'bronze');
    // perforated-metal eave canopy and railing round the block top (foto 3, 4)
    const e = 0.75;
    for (const [du, dv] of [[0, side], [-1, 0], [1, 0]]) {
      const uu = du < 0 ? TOWER.u0 : TOWER.u1, vv = side < 0 ? v0 : v1;
      if (du !== 0) plank(uu + (du < 0 ? -e : 0), uu + (du < 0 ? 0 : e), v0 - (side < 0 ? e : 0), top - 0.15, v1 + (side > 0 ? e : 0), top - 0.15, 0.12, 'slate');
      else plank(TOWER.u0 - e, TOWER.u1 + e, vv, top - 0.15, vv + side * e, top - 0.35, 0.12, 'slate');
    }
    const vo = side < 0 ? v0 + 0.15 : v1 - 0.15, vi = side < 0 ? v1 - 0.1 : v0 + 0.1;
    railing([TOWER.u0 + 0.15, vo], [TOWER.u1 - 0.15, vo], top, 'slate');
    railing([TOWER.u0 + 0.15, vo], [TOWER.u0 + 0.15, vi], top, 'slate');
  }
  // the white core between the blocks, rising above them with flues and louvres
  const R = rectUV(TOWER.u0, U_N, CORE.v0, CORE.v1);
  wall(R, edge(R, -1, 0), y0, CORE.top, 'white', [0, 1, 2].map(k => ({t0: 1.4, t1: 2.4, y0: 37 + k * 3.6, y1: 38.4 + k * 3.6, depth: 0.1, back: 'dark' as C})));
  for (const dv of [-1, 1]) wall(R, edge(R, 0, dv), top, CORE.top, 'white');
  roof(rectUV(TOWER.u0, CORE.u1, CORE.v0, CORE.v1), CORE.top, 'bronze');
  for (const [u, v] of [[1.8, 1.4], [1.8, 2.5], [2.6, 3.5]]) { const p = N(u, v); b.add(new T.CylinderGeometry(0.18, 0.18, 1.0, 8).translate(p[0], CORE.top + 0.5, p[1]), 'slate'); }
  // stainless flue drum at the west block's SW corner (foto 3, 4)
  { const p = N(TOWER.u0 + 0.4, BLOCK_W[0] - 0.4); b.add(new T.CylinderGeometry(0.08, 0.08, 1.6, 6).translate(p[0], TOWER.top + 0.8, p[1]), 'slate'); b.add(new T.CylinderGeometry(0.3, 0.3, 0.8, 8).translate(p[0], TOWER.top + 1.9, p[1]), 'slate'); }
}

/* ------------------------------------------------------------------ external spiral fire stair (south end, foto 1) */
function spiralStair() {
  const cu = U_S - 1.55, cv = 2.4, r = 1.3, c = N(cu, cv), y0 = GROUND, y1 = ROOF + 0.1;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, p = N(cu + r * Math.cos(a), cv + r * Math.sin(a));
    b.add(new T.BoxGeometry(0.06, y1 - y0, 0.06).translate(p[0], (y0 + y1) / 2, p[1]), 'slate');
  }
  b.add(new T.CylinderGeometry(0.1, 0.1, y1 - y0, 6).translate(c[0], (y0 + y1) / 2, c[1]), 'slate');
  for (let s = 0; s <= STOREYS; s++) {
    const y = s < STOREYS ? storeyBase(s) : y1 - 0.06;
    b.add(new T.CylinderGeometry(r, r, 0.06, 12).translate(c[0], y, c[1]), 'slate');                         // landing
    b.add(new T.CylinderGeometry(r, r, 0.08, 12, 1, true).translate(c[0], y + 1.05, c[1]), 'slate');         // guard ring
    block(U_S - 0.35, U_S + 0.05, cv - 0.5, cv + 0.5, y - 0.06, y, 'slate');                                  // bridge to the door
  }
  // the straight flight from the first landing down to the quay (west)
  plank(cu - 0.55, cu + 0.55, cv - 1.0, GROUND, cv - 7.0, 0.15, 0.12, 'slate');
  plank(cu - 0.6, cu - 0.55, cv - 1.0, GROUND + 1.0, cv - 7.0, 1.15, 0.05, 'slate');   // hand rail
}

/* ------------------------------------------------------------------ glazed shaft between the silos (foto 6) */
/**
 * The glazed lift/stair shaft in the gap between the two silos, its west face about level with the Stenen Silo's end bay
 * (v -6.4) and set back from the concrete front, rising almost to the tower top (foto 6: top at ~44 m). It stands just
 * north of this pand's BAG outline; it is drawn here because no other model or pand draws it.
 */
function glassShaft() {
  const R = rectUV(U_N, 16.6, -6.4, -2.6), top = 44.0;
  for (const [du, dv] of [[0, -1], [1, 0], [0, 1]]) {
    const i = edge(R, du, dv), {f, len} = ringFrame(R, i), n = Math.max(1, Math.round(len / 1.3)), p = len / n;
    const rows = Math.round(top / 3.0), h = top / rows;
    const cuts: Cut[] = [];
    for (let k = 0; k < n; k++) for (let r = 0; r < rows; r++) cuts.push({t0: k * p + 0.05, t1: (k + 1) * p - 0.05, y0: r * h + 0.05, y1: (r + 1) * h - 0.05, depth: 0.05, back: 'glass'});
    wall(R, i, 0, top, 'frame', cuts);
    void f;
  }
  roof(R, top, 'bronze');
}

export const BETONNEN_SILO_EDGE = {U_S, U_N, V_W, V_E};
