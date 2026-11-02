import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archOpeningWall, archOutline, type ArchOpening, type Tri} from '../../src/canalRecall/landmarks/archOpeningWall';

/**
 * Hofkerk (Parochiekerk van de Heilige Martelaren van Gorcum), Linnaeushof, Watergraafsmeer. BAG pand 0363100012123068
 * (bouwjaar 1929, in gebruik; one pand holding the church, its west tower, the clock block and the pastorie). Built
 * 1927-1929 to the design of A.J. Kropholler (who took over from Paul J. de Jongh, d. 1924) as part of the Linnaeushof
 * complex; consecrated 1929; Rijksmonument (municipal register 512944); still the Roman Catholic parish church
 * (nl.wikipedia "Hofkerk (Amsterdam)", CC BY-SA 4.0).
 *
 * Read from the city panoramas of the brief (Gemeente Amsterdam, CC BY 4.0; scripts/landmarks/hofkerk-brief.md) and
 * Wikimedia Commons photographs (CC BY-SA, staging/landmarks/hofkerk/sources.md):
 * - the closed west front of large red brick: a square west tower (flat parapet with white coping, a narrow tiled
 *   pyramid and cross; twin round-headed belfry openings with a white colonnette on the west and north faces, a slit
 *   on the others; Mendes da Costa's pelican medallion in stone mid-height), the nave gable with stone kneelers and an
 *   apex finial, three pointed portals with stepped brick archivolts, white sculpted impost blocks, mosaic tympana and
 *   timber doors, two small round-headed lights between them, and the clock block with its dark dial (w01);
 * - the north side (w05, Commons RCE 20368611, 130330): five buttressed bays, each a triple of round-headed clerestory
 *   lights under the nave's white eaves band, a lean-to, four small round-headed aisle lights, a second lean-to and a
 *   low wall with one small square window; stepped buttresses with sloped white stone caps; the porch bay by the tower
 *   with its big round-arched gate;
 * - the crossing tower, walls to 21 m under a white coping and a tiled pyramid with a cross; an oculus and graded
 *   round-headed lancets in its north and south faces above the transept roofs (Commons 011205 noordzijde, w08);
 * - transepts as wide as the crossing tower with gables to north and south (oculus, stone kneelers and apex block),
 *   five round-headed lights in the long west wall, low hipped annexes before the gables (w06, w12);
 * - a three-sided east apse with stepped buttresses at the angles and a white coping, flanked by two small polygonal
 *   chapels under pointed tiled roofs (w09, w15, w16); a tall chimney beside the crossing (w08, Commons);
 * - the pastorie, turned 45 degrees at the south-west: three storeys of white-framed sash windows under white-blocked
 *   lintels, a white cornice, a hipped tiled roof with two chimneys, a two-storey strip on the north-west with an
 *   arched porch and a Madonna relief tile (w03, w04, w07).
 *
 * Plan: scripts/landmarks/hofkerk-footprints.json (BAG ring, 3DBAG LoD2.2) in native east/south metres. The model is
 * authored square to the church (u along the nave towards the apse, v to the south) and turned 1.2 degrees clockwise
 * onto the ring by the catalogue (surveyed.northOffsetDegrees).
 */
type V2 = [number, number];
type C = 'brick' | 'stone' | 'slate' | 'white' | 'glass' | 'dark' | 'gold' | 'blue' | 'bronze';
let b: BuildingTools;

// Authored square to the church (u east along the nave, v south); the catalogue turns it 1.2 degrees clockwise onto the BAG ring.
const TH = 0, CS = 1, SN = 0;
/** Local (u east along the nave, v south) to native (x east, z south). */
const N = (u: number, v: number): V2 => [u * CS - v * SN, u * SN + v * CS];
const P3 = (u: number, y: number, v: number) => { const p = N(u, v); return new T.Vector3(p[0], y, p[1]); };

/* ------------------------------------------------------------------ measured heights and plan (local u, v) */
const TOWER = {u0: -34.55, u1: -24.8, v0: -18.54, v1: -8.8, top: 25.9, pyr: 2.75, apex: 32.0};
const NAVE = {u0: -34.55, u1: 0.6, vN: -8.8, vS: 3.96, eave: 12.9, ridge: 19.9};
const NAVE_VC = (NAVE.vN + NAVE.vS) / 2;
const CROSS = {u0: 0.6, u1: 14.3, v0: -11.7, v1: 6.4, top: 21.0, skirt: 22.8, inset: 2.4, apex: 29.2};
const TRANS = {u0: 0.6, u1: 13.05, eave: 6.3, ridge: 13.9, vN: -20.94, vS: 16.6};
const BAYS = [-20.87, -16.57, -12.27, -7.97, -3.67, 0.61];   // buttress lines of the five aisle bays (w05, Commons RCE 20368611)
const AISLE_N = {outer: -13.5, mid: -12.0, outerTop: 2.95, low: 4.05, midTop: 5.8, high: 7.45};
const AISLE_S = {wall: 8.0, top: 5.6, high: 7.45};
const CLOCK = {u0: -34.55, u1: -29.1, v0: NAVE.vS, v1: 8.93, top: 14.4, apex: 16.4};

/* ------------------------------------------------------------------ mesh helpers */
type Frame = {o: V2; t: V2; n: V2};
/** Wall frame from local a to local b; t runs a -> b, which must be the viewer's left to right seen from outside. */
function frame(a: V2, c: V2): Frame & {len: number} {
  const p = N(a[0], a[1]), q = N(c[0], c[1]), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const t: V2 = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  return {o: p, t, n: [-t[1], t[0]], len};
}
const W3 = (f: Frame, t: number, y: number, o: number): [number, number, number] => [f.o[0] + f.t[0] * t + f.n[0] * o, y, f.o[1] + f.t[1] * t + f.n[1] * o];

class Mesh {
  private tris = new Map<C, number[]>();
  push(c: C, ...v: number[]) { const a = this.tris.get(c) ?? []; a.push(...v); this.tris.set(c, a); }
  tri(f: Frame, t: Tri, c: C) { for (const p of t.pts) this.push(c, ...W3(f, p[0], p[1], p[2])); }
  /** Convex polygon in a wall frame at offset o, facing out. */
  poly(f: Frame, pts: V2[], o: number, c: C) {
    for (let i = 1; i + 1 < pts.length; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) this.push(c, ...W3(f, p[0], p[1], o));
  }
  /** World triangle, wound towards `up` (a direction it should face). */
  wtri(p: T.Vector3, q: T.Vector3, r: T.Vector3, c: C, up: T.Vector3) {
    const n = new T.Vector3().subVectors(q, p).cross(new T.Vector3().subVectors(r, p));
    if (n.lengthSq() < 1e-10) return;
    if (n.dot(up) >= 0) this.push(c, p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z); else this.push(c, p.x, p.y, p.z, r.x, r.y, r.z, q.x, q.y, q.z);
  }
  flush() {
    for (const [c, pos] of this.tris) {
      if (!pos.length) continue;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c as never);
    }
    this.tris.clear();
  }
}
let m: Mesh;
const UP = new T.Vector3(0, 1, 0);
/** Roof sheet thickness (vertical): a wall under an overhanging roof stops on the sheet's underside. */
const RT = 0.15;

type Cut = ArchOpening & {back: C; reveal?: C};
/** Wall from local a to b, y0..y1, with arched/flat openings (archOpeningWall, flat heads arch 0). Faces flush before trims. */
function wall(a: V2, c: V2, y0: number, y1: number, col: C, cuts: Cut[] = []): Frame & {len: number} {
  const f = frame(a, c);
  const w = archOpeningWall(f.len, y0, y1, cuts);
  for (const t of w.face) m.tri(f, t, col);
  w.reveals.forEach((ts, k) => ts.forEach(t => m.tri(f, t, cuts[k].reveal ?? col)));
  w.backs.forEach((ts, k) => ts.forEach(t => m.tri(f, t, cuts[k].back)));
  m.flush();
  return f;
}
/** Gable (or any convex polygon) on a wall frame above its rectangle, extruded `th` into the building so it has a top. */
function gable(f: Frame, pts: V2[], th: number, col: C) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(s, {depth: th, bevelEnabled: false});
  g.translate(0, 0, -th);
  placeOnFrame(g, f, 0, 0, 0);
  b.add(g, col as never);
}
/** Put a geometry authored in wall-local (x along t, y up, z out) onto the frame at (t, y, out). */
function placeOnFrame(g: T.BufferGeometry, f: Frame, t: number, y: number, out: number) {
  const M = new T.Matrix4().makeBasis(new T.Vector3(f.t[0], 0, f.t[1]), new T.Vector3(0, 1, 0), new T.Vector3(f.n[0], 0, f.n[1]));
  M.setPosition(f.o[0] + f.t[0] * t + f.n[0] * out, y, f.o[1] + f.t[1] * t + f.n[1] * out);
  g.applyMatrix4(M);
}
/** Box on a wall frame: centred at t, bottom y, from `out - sink` to `out + d` off the wall. */
function slab(f: Frame, t: number, y: number, w: number, h: number, d: number, col: C, out = 0, sink = 0.1) {
  const g = new T.BoxGeometry(w, h, d + sink).translate(0, h / 2, (d + sink) / 2 - sink);
  placeOnFrame(g, f, t, y, out);
  b.add(g, col as never);
}
/** Shape (wall-local x, y) extruded out of the wall by d (its back `sink` behind the plane). */
function relief(f: Frame, t: number, y: number, shape: T.Shape, d: number, col: C, out = 0, sink = 0.05, seg = 8) {
  const g = new T.ExtrudeGeometry(shape, {depth: d + sink, bevelEnabled: false, curveSegments: seg}).translate(0, 0, -sink);
  placeOnFrame(g, f, t, y, out);
  b.add(g, col as never);
}
/** Arch-outline band (archivolt order) around an opening: the ring between the opening's outline and one `w` wider. */
function archRing(f: Frame, o: ArchOpening, w: number, d: number, col: C, out = 0) {
  const outer = archOutline({...o, t0: o.t0 - w, t1: o.t1 + w, y1: o.y1 + w * (o.arch && o.arch > 0.5 ? 1.1 : 1), segments: o.segments});
  const inner = archOutline(o);
  // outer outline up the right jamb, over the head and down the left, then the inner one back: an open band standing on the sill
  const band = [outer[1], ...outer.slice(2), outer[0], inner[0], ...inner.slice(2).reverse(), inner[1]];
  relief(f, 0, 0, new T.Shape(band.map(p => new T.Vector2(p[0], p[1]))), d, col, out, 0.05);
}
/** Vertical box in local plan u0..u1 x v0..v1 from y0 to y1. */
function block(u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, col: C) {
  const c = P3((u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2);
  const g = new T.BoxGeometry(u1 - u0, y1 - y0, v1 - v0);
  g.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(CS, 0, SN), new T.Vector3(0, 1, 0), new T.Vector3(-SN, 0, CS)).setPosition(c));
  b.add(g, col as never);
}
/** Plank across u0..u1 whose centre line runs (v0, y0) -> (v1, y1), th thick (sloped caps and lean-to slabs). */
function plankU(u0: number, u1: number, v0: number, y0: number, v1: number, y1: number, th: number, col: C) {
  const x = new T.Vector3(CS, 0, SN), dv = new T.Vector3(-SN, 0, CS).multiplyScalar(v1 - v0).add(new T.Vector3(0, y1 - y0, 0));
  const L = dv.length(), z = dv.clone().normalize(), y = new T.Vector3().crossVectors(z, x).normalize();
  const g = new T.BoxGeometry(u1 - u0, th, L).applyMatrix4(new T.Matrix4().makeBasis(x, y, z).setPosition(P3((u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2)));
  b.add(g, col as never);
}
/** Same, across v0..v1, centre line (u0, y0) -> (u1, y1). */
function plankV(v0: number, v1: number, u0: number, y0: number, u1: number, y1: number, th: number, col: C) {
  const x = new T.Vector3(-SN, 0, CS), du = new T.Vector3(CS, 0, SN).multiplyScalar(u1 - u0).add(new T.Vector3(0, y1 - y0, 0));
  const L = du.length(), z = du.clone().normalize(), y = new T.Vector3().crossVectors(x, z).normalize();
  const g = new T.BoxGeometry(v1 - v0, th, L).applyMatrix4(new T.Matrix4().makeBasis(x, y, z).setPosition(P3((u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2)));
  b.add(g, col as never);
}
/** Roof over a convex local outline rising to a ridge segment (a point for a pyramid): each edge meets its closest ridge points. */
function ridgeRoof(outline: V2[], eave: number, ra: V2, rb: V2, ridgeY: number, col: C, skip: number[] = [], th = 0) {
  const close = (p: V2): V2 => {
    const dx = rb[0] - ra[0], dy = rb[1] - ra[1], L2 = dx * dx + dy * dy;
    const k = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p[0] - ra[0]) * dx + (p[1] - ra[1]) * dy) / L2));
    return [ra[0] + dx * k, ra[1] + dy * k];
  };
  const tris: T.Vector3[][] = [];
  for (let i = 0; i < outline.length; i++) {
    if (skip.includes(i)) continue;
    const p = outline[i], q = outline[(i + 1) % outline.length], rp = close(p), rq = close(q);
    const A = P3(p[0], eave, p[1]), B = P3(q[0], eave, q[1]), Cq = P3(rq[0], ridgeY, rq[1]), Cp = P3(rp[0], ridgeY, rp[1]);
    tris.push([A, B, Cq]);
    if (Math.hypot(rp[0] - rq[0], rp[1] - rq[1]) > 1e-6) tris.push([A, Cq, Cp]);
  }
  sheet(tris, col, th);
}
/**
 * Emit an upward-facing roof surface; with th > 0 as a closed sheet th thick (vertically): the underside and a strip along
 * every free edge, so an overhanging eave is a solid slab and not an open boundary.
 */
function sheet(tris: T.Vector3[][], col: C, th: number) {
  const up: T.Vector3[][] = [];
  for (const [p, q, r] of tris) {
    const n = new T.Vector3().subVectors(q, p).cross(new T.Vector3().subVectors(r, p));
    if (n.lengthSq() < 1e-10) continue;
    up.push(n.y >= 0 ? [p, q, r] : [p, r, q]);
  }
  for (const [p, q, r] of up) m.wtri(p, q, r, col, UP);
  if (th > 0) {
    const D = new T.Vector3(0, -th, 0), DOWN = new T.Vector3(0, -1, 0);
    for (const [p, q, r] of up) m.wtri(p.clone().add(D), q.clone().add(D), r.clone().add(D), col, DOWN);
    const key = (v: T.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    const count = new Map<string, number>();
    for (const t of up) for (let k = 0; k < 3; k++) { const a = key(t[k]), c = key(t[(k + 1) % 3]), e = a < c ? `${a}|${c}` : `${c}|${a}`; count.set(e, (count.get(e) ?? 0) + 1); }
    for (const t of up) for (let k = 0; k < 3; k++) {
      const a = t[k], c = t[(k + 1) % 3], ka = key(a), kc = key(c);
      if (count.get(ka < kc ? `${ka}|${kc}` : `${kc}|${ka}`) !== 1) continue;
      // outward: the edge direction crossed with the face normal (the face lies to the left of a->c seen from above)
      const out = new T.Vector3().subVectors(c, a).cross(UP);
      const a2 = a.clone().add(D), c2 = c.clone().add(D);
      m.wtri(a, c, c2, col, out); m.wtri(a, c2, a2, col, out);
    }
  }
  m.flush();
}
/** Planar roof quad from four local points with heights, facing up. */
function roofQuad(pts: [number, number, number][], col: C, th = 0) {
  const P = pts.map(([u, y, v]) => P3(u, y, v));
  sheet([[P[0], P[1], P[2]], [P[0], P[2], P[3]]], col, th);
}
/**
 * Hipped roof over a rectangle given by its four corners (in order): the ridge runs along the longer side, inset by half the
 * short side so every slope has the same pitch; the sheet overhangs the walls by `ov` and its underside meets the wall tops.
 */
function hipRect(c: V2[], wallTop: number, ov: number, ridgeY: number, col: C, th = RT) {
  const d1: V2 = [c[1][0] - c[0][0], c[1][1] - c[0][1]], d2: V2 = [c[3][0] - c[0][0], c[3][1] - c[0][1]];
  const L1 = Math.hypot(...d1), L2 = Math.hypot(...d2), e1: V2 = [d1[0] / L1, d1[1] / L1], e2: V2 = [d2[0] / L2, d2[1] / L2];
  const ctr: V2 = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2], half = Math.min(L1, L2) / 2;
  const el = L1 >= L2 ? e1 : e2, r = Math.max(L1, L2) / 2 - half;
  const grown = c.map(p => {
    const s1 = Math.sign((p[0] - ctr[0]) * e1[0] + (p[1] - ctr[1]) * e1[1]), s2 = Math.sign((p[0] - ctr[0]) * e2[0] + (p[1] - ctr[1]) * e2[1]);
    return [p[0] + (s1 * e1[0] + s2 * e2[0]) * ov, p[1] + (s1 * e1[1] + s2 * e2[1]) * ov] as V2;
  });
  const s = (ridgeY - wallTop - th) / half;
  ridgeRoof(grown, wallTop + th - ov * s, [ctr[0] - el[0] * r, ctr[1] - el[1] * r], [ctr[0] + el[0] * r, ctr[1] + el[1] * r], ridgeY, col, [], th);
  return s;
}
/** Expand a rectangle outline (u0,u1,v0,v1) by e. */
const rectO = (u0: number, u1: number, v0: number, v1: number, e = 0): V2[] => [[u0 - e, v0 - e], [u1 + e, v0 - e], [u1 + e, v1 + e], [u0 - e, v1 + e]];
/** Stone coping along the top of a wall frame (t0..t1 at height y), 12 cm proud, 15 cm into the wall. */
function coping(f: Frame, t0: number, t1: number, y: number, col: C = 'stone', h = 0.3, d = 0.12) {
  slab(f, (t0 + t1) / 2, y - h + 0.08, t1 - t0, h, d, col, 0, 0.15);
}
/** Order local a, c so the wall faces away from ctr. */
function orient(a: V2, c: V2, ctr: V2): [V2, V2] {
  const du = c[0] - a[0], dv = c[1] - a[1], mu = (a[0] + c[0]) / 2 - ctr[0], mv = (a[1] + c[1]) / 2 - ctr[1];
  return -dv * mu + du * mv > 0 ? [a, c] : [c, a];
}
/** Copings round a rectangle's four walls (N, W, S, E frames from boxWalls order or explicit): long sides cover the corners. */
function copeRect(fN: Frame | null, fW: Frame | null, fS: Frame | null, fE: Frame | null, lu: number, lv: number, y: number, col: C = 'stone') {
  for (const f of [fN, fS]) if (f) coping(f, -0.12, lu + 0.12, y, col);
  for (const f of [fW, fE]) if (f) coping(f, 0.16, lv - 0.16, y, col);
}
/** Oculus: stone disc with a glass disc on it and a stone cross of tracery bars in front. */
function oculus(f: Frame, t: number, y: number, r: number) {
  relief(f, t, y, new T.Shape().absarc(0, 0, r, 0, Math.PI * 2, false) as T.Shape, 0.1, 'stone', 0, 0.05, 16);
  relief(f, t, y, new T.Shape().absarc(0, 0, r * 0.78, 0, Math.PI * 2, false) as T.Shape, 0.05, 'glass', 0.1, 0.02, 16);
  slab(f, t, y - r * 0.78, 0.09, r * 1.56, 0.06, 'stone', 0.15, 0.02);
  slab(f, t, y - 0.045, r * 1.56, 0.09, 0.06, 'stone', 0.15, 0.02);
}
/** Round-headed window cuts in a row: centres ts, width w, sill y0, apex y1. */
const lights = (ts: number[], w: number, y0: number, y1: number, back: C = 'glass', depth = 0.3, arch = 0.5, segments = 5): Cut[] =>
  ts.map(t => ({t0: t - w / 2, t1: t + w / 2, y0, y1, depth, back, arch, segments}));
/** Centres of n lights of width w with gap g, centred on c. */
const row = (c: number, n: number, w: number, g: number) => [...Array(n)].map((_, k) => c + (k - (n - 1) / 2) * (w + g));
/** White-framed sash window cuts (flat heads). */
const sash = (ts: number[], w: number, y0: number, y1: number): Cut[] => ts.map(t => ({t0: t - w / 2, t1: t + w / 2, y0, y1, depth: 0.14, back: 'glass', reveal: 'white', arch: 0}));
/** Glazing bars of sash windows (mullion + transom) set inside the reveal, 5 cm in front of the glass. */
function sashBars(f: Frame, ts: number[], w: number, y0: number, y1: number) {
  for (const t of ts) {
    slab(f, t, y0, 0.06, y1 - y0, 0.04, 'white', -0.09, 0);
    slab(f, t, y0 + (y1 - y0) * 0.62, w, 0.06, 0.04, 'white', -0.09, 0);
  }
}
/** White stone blocks at the ends of a lintel run (soldier course with white blocks, w03/w07). */
function lintelBlocks(f: Frame, ts: number[], w: number, y: number) {
  const a = Math.min(...ts) - w / 2 - 0.12, z = Math.max(...ts) + w / 2 + 0.12;
  for (const t of [a, ...ts.slice(1).map((x, k) => (x + ts[k]) / 2), z]) slab(f, t, y + 0.1, 0.22, 0.22, 0.06, 'stone');
}

/* ------------------------------------------------------------------ build */
export function buildHofkerk(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh();
  westFront();
  tower();
  nave();
  northAisle();
  southSide();
  crossing();
  transept(-1);
  transept(1);
  apse();
  chapels();
  clockBlock();
  pastorie();
}

/* ------------------------------------------------------------------ west front (w01) */
function westFront() {
  const u = NAVE.u0;      // t = v - TOWER.v0
  const T0 = (v: number) => v - TOWER.v0;
  // three pointed portals (centre 2.4 m wide, apex 6.6 m; sides 1.3 m, apex 4.5 m) and two small round-headed lights
  const pc = T0(NAVE_VC), ps = 5.5;
  const centre: Cut = {t0: pc - 1.2, t1: pc + 1.2, y0: 0.25, y1: 6.6, depth: 0.85, back: 'dark', arch: 0.95, segments: 6, reveal: 'brick'};
  const side = [pc - ps, pc + ps].map(t => ({t0: t - 0.65, t1: t + 0.65, y0: 0.2, y1: 4.5, depth: 0.7, back: 'dark' as C, arch: 0.95, segments: 5, reveal: 'brick' as C}));
  const lancets = lights([pc - 3.1, pc + 3.8], 0.45, 2.0, 3.9, 'glass', 0.25, 0.5, 4);
  const cuts: Cut[] = [centre, ...side, ...lancets];
  const f = wall([u, TOWER.v0], [u, CLOCK.v1], 0, NAVE.eave, 'brick', cuts);
  // archivolt orders (stepped brick rings), white impost blocks, tympanum panels with mosaics, steps
  for (const [o, rings] of [[centre, 3], [side[0], 2], [side[1], 2]] as [Cut, number][]) {
    for (let k = 0; k < rings; k++) archRing(f, {...o, y0: o.y0 + 0.06, t0: o.t0 - k * 0.22, t1: o.t1 + k * 0.22, y1: o.y1 + k * 0.24}, 0.22, 0.06 + 0.06 * (rings - k), 'brick');
    const wide = o === centre, iy = wide ? 2.95 : 2.7, ih = wide ? 0.8 : 0.5, iw = wide ? 1.0 : 0.6;
    for (const s of [-1, 1]) slab(f, (o.t0 + o.t1) / 2 + s * ((o.t1 - o.t0) / 2 + rings * 0.22 + iw / 2 - 0.15), iy, iw, ih, 0.32, 'stone');
    const doorTop = wide ? 3.3 : 2.75;
    // tympanum: brick panel inside the recess above the timber door, with the mosaic roundel
    const tym = archOutline({...o, y0: doorTop}).map(p => new T.Vector2(p[0], p[1]));
    relief(f, 0, 0, new T.Shape(tym), 0.04, 'brick', -o.depth + 0.08, 0.02, 6);
    const r = wide ? 0.42 : 0.24, cy = doorTop + (o.y1 - doorTop) * 0.45;
    relief(f, (o.t0 + o.t1) / 2, cy, new T.Shape().absarc(0, 0, r, 0, Math.PI * 2, false) as T.Shape, 0.04, 'gold', -o.depth + 0.13, 0.02, 16);
    slab(f, (o.t0 + o.t1) / 2, doorTop - 0.18, o.t1 - o.t0, 0.18, 0.12, 'stone', -o.depth + 0.06, 0.02);   // door lintel
    // steps
    slab(f, (o.t0 + o.t1) / 2, 0, o.t1 - o.t0 + (wide ? 2.4 : 1.4), o.y0 - 0.1, wide ? 0.9 : 0.6, 'stone', 0, 0);
    slab(f, (o.t0 + o.t1) / 2, o.y0 - 0.1, o.t1 - o.t0 + (wide ? 1.8 : 1.0), 0.1, wide ? 0.45 : 0.3, 'stone', 0, 0);
  }
  // nave gable above the eaves: kneelers at the shoulders, a finial block at the apex (w01, Commons RCE 20420493)
  const a = T0(NAVE.vN), z = T0(NAVE.vS), apexY = NAVE.ridge + 0.45;
  gable(f, [[a, NAVE.eave], [z, NAVE.eave], [z, NAVE.eave + 0.3], [(a + z) / 2, apexY], [a, NAVE.eave + 0.3]], 0.6, 'brick');
  for (const t of [a + 0.75, z - 0.75]) slab(f, t, NAVE.eave - 0.25, 1.6, 0.42, 0.22, 'stone');
  slab(f, (a + z) / 2, apexY - 0.4, 1.1, 1.0, 0.5, 'stone', -0.3);
  slab(f, (a + z) / 2, apexY + 0.6, 0.35, 1.3, 0.35, 'stone', -0.25);
  slab(f, (a + z) / 2, apexY + 1.15, 0.95, 0.3, 0.35, 'stone', -0.25);
  // Mendes da Costa's pelican medallion on the tower (stone roundel in a brick ring, w01 / Commons 011205 Pelikaan)
  const mt = T0((TOWER.v0 + TOWER.v1) / 2);
  relief(f, mt, 8.3, new T.Shape().absarc(0, 0, 1.0, 0, Math.PI * 2, false) as T.Shape, 0.1, 'stone', 0, 0.05, 20);
  const ring = new T.Shape().absarc(0, 0, 1.15, 0, Math.PI * 2, false) as T.Shape;
  ring.holes.push(new T.Path().absarc(0, 0, 1.0, 0, Math.PI * 2, true));
  relief(f, mt, 8.3, ring, 0.06, 'brick', 0, 0.05, 20);
  // the pelican: body, neck and the two wing lobes in higher relief
  relief(f, mt, 8.3, new T.Shape().absellipse(0, -0.05, 0.22, 0.55, 0, Math.PI * 2, false, 0) as T.Shape, 0.21, 'stone', 0, 0.05, 10);
  for (const s of [-1, 1]) relief(f, mt + s * 0.45, 8.3, new T.Shape().absellipse(0, 0.05, 0.28, 0.55, 0, Math.PI * 2, false, s * 0.5) as T.Shape, 0.15, 'stone', 0, 0.05, 10);
}

/* ------------------------------------------------------------------ west tower */
function tower() {
  const {u0, u1, v0, v1, top} = TOWER, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  const twin = (len: number): Cut[] => lights([len / 2 - 0.85, len / 2 + 0.85], 1.4, 20.7, 24.4, 'glass', 0.5, 0.5, 6);
  const slit = (len: number): Cut[] => lights([len / 2], 0.6, 21.0, 24.2, 'glass', 0.4, 0.5, 4);
  // west face above the front wall (the front wall carries the tower's lower west face)
  const fw = wall([u0, v0], [u0, v1], NAVE.eave, top, 'brick', twin(v1 - v0));
  // north face: twin belfry, a small round-headed light mid-height and a pair of round-headed lights low down (Commons 13/14)
  const lenN = u1 - u0;
  const fn = wall([u1, v0], [u0, v0], 0, top, 'brick', [...twin(lenN), ...lights([lenN / 2], 0.5, 13.0, 14.3), ...lights(row(lenN / 2, 2, 0.7, 0.35), 0.7, 2.4, 4.4)]);
  // east face: slit high up (Commons 13/14); south face above the nave eaves: slit
  const fe = wall([u1, v1], [u1, v0], 0, top, 'brick', slit(v1 - v0));
  const fs = wall([u0, v1], [u1, v1], NAVE.eave - 0.3, top, 'brick', slit(lenN));
  // white colonnettes between the twin openings and white sill bands (w01 thumb, Commons 8603)
  for (const [f, len] of [[fw, v1 - v0], [fn, lenN]] as [Frame, number][]) {
    slab(f, len / 2, 20.67, 0.22, 2.95, 0.1, 'stone', 0, 0.02);
    slab(f, len / 2, 20.45, 4.1, 0.22, 0.16, 'stone');
  }
  copeRect(fn, fw, fs, fe, lenN, v1 - v0, top + 0.1);
  // roof: flat leads behind the parapet, the narrow tiled pyramid, the cross (3DBAG 25.7-26.1 m, pyramid to 32.0 m)
  roofQuad([[u0, top, v0], [u1, top, v0], [u1, top, v1], [u0, top, v1]], 'slate');
  block(uc - TOWER.pyr - 0.1, uc + TOWER.pyr + 0.1, vc - TOWER.pyr - 0.1, vc + TOWER.pyr + 0.1, top, top + 0.3, 'brick');
  ridgeRoof(rectO(uc - TOWER.pyr, uc + TOWER.pyr, vc - TOWER.pyr, vc + TOWER.pyr, 0.15), top + 0.25, [uc, vc], [uc, vc], TOWER.apex, 'slate');
  cross(uc, vc, TOWER.apex - 0.1, 1.9, 'bronze');
}
function cross(u: number, v: number, y: number, h: number, col: C) {
  block(u - 0.07, u + 0.07, v - 0.07, v + 0.07, y, y + h, col);
  block(u - 0.07, u + 0.07, v - 0.42, v + 0.42, y + h * 0.62, y + h * 0.62 + 0.14, col);
}

/* ------------------------------------------------------------------ nave: clerestories, eaves band, roof */
function nave() {
  const {u0, u1, vN, vS, eave, ridge} = NAVE;
  // north clerestory (porch bay and five bays): a triple of round-headed lights per bay
  const bayCentres = [(TOWER.u1 + BAYS[0]) / 2, ...BAYS.slice(0, -1).map((x, k) => (x + BAYS[k + 1]) / 2)];
  const fN = frame([u1, vN], [TOWER.u1, vN]), tN = (x: number) => u1 - x;
  wall([u1, vN], [TOWER.u1, vN], AISLE_N.high - 0.25, eave, 'brick', bayCentres.flatMap(c => lights(row(tN(c), 3, 0.7, 0.32), 0.7, 8.6, 11.7)));
  // south clerestory from the link block east (mirrored bays)
  const sStart = -25.97, sCentres = [(sStart + BAYS[0]) / 2, ...bayCentres.slice(1)];
  wall([sStart, vS], [u1, vS], AISLE_S.high - 0.25, eave, 'brick', sCentres.flatMap(c => lights(row(c - sStart, 3, 0.7, 0.32), 0.7, 8.6, 11.7)));
  wall([CLOCK.u1, vS], [sStart, vS], 8.0, eave, 'brick');
  // white eaves bands (gutters) along both clerestories
  // roof: two tiled slopes from the eaves (0.4 m overhang) to the ridge, ending inside the west gable; its underside meets the wall tops
  const sl = (ridge - eave) / (NAVE_VC - vN), ov = 0.4, uw = u0 + 0.35, ye = eave + RT - ov * sl, yr = ridge + RT;
  roofQuad([[uw, ye, vN - ov], [u1, ye, vN - ov], [u1, yr, NAVE_VC], [uw, yr, NAVE_VC]], 'slate', RT);
  roofQuad([[uw, yr, NAVE_VC], [u1, yr, NAVE_VC], [u1, ye, vS + ov], [uw, ye, vS + ov]], 'slate', RT);
  // white eaves bands under the overhang
  const band = eave - 0.25 * sl - 0.03 - 0.3;
  slab(fN, tN((TOWER.u1 + u1) / 2), band, u1 - TOWER.u1, 0.3, 0.25, 'white');
  const fS = frame([CLOCK.u1, vS], [u1, vS]);
  slab(fS, (u1 - CLOCK.u1) / 2, band, u1 - CLOCK.u1, 0.3, 0.25, 'white');
  // the tall chimney beside the crossing on the south slope (w08, Commons RCE 20368611)
  block(-1.9, -0.7, 4.3, 5.5, 7.0, 23.6, 'brick');
  block(-2.05, -0.55, 4.15, 5.65, 23.6, 23.9, 'stone');
}

/* ------------------------------------------------------------------ north aisle (w05, Commons RCE 20368611, 130330) */
function northAisle() {
  const A = AISLE_N, uE = BAYS[BAYS.length - 1], uW = BAYS[0];
  const bays = BAYS.slice(0, -1).map((x, k) => [x, BAYS[k + 1]] as V2);
  // outer wall with one small square window per bay; white band at its top
  const fo = wall([uE, A.outer], [uW, A.outer], 0, A.outerTop, 'brick', bays.map(([p, q]) => ({t0: uE - (p + q) / 2 - 0.25, t1: uE - (p + q) / 2 + 0.25, y0: 1.35, y1: 1.95, depth: 0.2, back: 'glass' as C, arch: 0})));
  const s1 = (A.low - A.outerTop) / (A.mid - A.outer), s2 = (A.high - A.midTop) / (NAVE.vN - A.mid), LT = 0.12;
  slab(fo, (uE - uW) / 2, A.outerTop - 0.3, uE - uW, 0.2, 0.08, 'stone');
  for (const [p, q] of bays) slab(fo, uE - (p + q) / 2, 1.97, 0.75, 0.16, 0.07, 'stone');
  const fwe = wall([uW, A.outer], [uW, A.mid], 0, A.outerTop, 'brick');
  gable(fwe, [[0, A.outerTop], [A.mid - A.outer, A.outerTop], [A.mid - A.outer, A.low + LT / 2], [0, A.outerTop + LT / 2]], 0.3, 'brick');
  // lower lean-to, the aisle wall with four small round-headed lights per bay, upper lean-to
  roofQuad([[uW, A.outerTop + LT - 0.3 * s1, A.outer - 0.3], [uE, A.outerTop + LT - 0.3 * s1, A.outer - 0.3], [uE, A.low + LT, A.mid], [uW, A.low + LT, A.mid]], 'slate', LT);
  const fm = wall([uE, A.mid], [uW, A.mid], A.low - 0.2, A.midTop, 'brick', bays.flatMap(([p, q]) => lights(row(uE - (p + q) / 2, 4, 0.5, 0.26), 0.5, 4.25, 5.55, 'glass', 0.22, 0.5, 4)));
  for (const [p, q] of bays) for (const t of row(uE - (p + q) / 2, 4, 0.5, 0.26).slice(0, 3)) slab(fm, t + 0.38, 5.05, 0.24, 0.2, 0.08, 'stone');
  slab(fm, (uE - uW) / 2, A.midTop - 0.29, uE - uW, 0.2, 0.1, 'white');
  roofQuad([[TOWER.u1, A.midTop + LT - 0.3 * s2, A.mid - 0.3], [uE, A.midTop + LT - 0.3 * s2, A.mid - 0.3], [uE, A.high + LT, NAVE.vN], [TOWER.u1, A.high + LT, NAVE.vN]], 'slate', LT);
  // porch bay by the tower: the big round-arched gate (dark iron grille) and a triple of lights above (w05, Commons RCE 20368611)
  const vp = -12.47, fp = wall([uW, vp], [TOWER.u1, vp], 0, A.midTop, 'brick', [
    {t0: (uW - TOWER.u1) / 2 - 1.3, t1: (uW - TOWER.u1) / 2 + 1.3, y0: 0.08, y1: 2.95, depth: 0.45, back: 'glass', arch: 0.5, segments: 8},
    ...lights(row((uW - TOWER.u1) / 2, 3, 0.55, 0.25), 0.55, 3.75, 5.45, 'glass', 0.22, 0.5, 4)]);
  archRing(fp, {t0: (uW - TOWER.u1) / 2 - 1.3, t1: (uW - TOWER.u1) / 2 + 1.3, y0: 0.08, y1: 2.95, depth: 0.45, arch: 0.5, segments: 8}, 0.22, 0.08, 'brick');
  wall([uW, A.mid], [uW, vp], A.low - 0.2, A.midTop, 'brick');
  // the low lean-to strip along the tower's east face (3DBAG 2.3-3.5 m)
  wall([TOWER.u1, -17.96], [-23.5, -17.96], 0, 2.6, 'brick');
  wall([-23.5, -17.96], [-23.5, vp], 0, 2.4, 'brick');
  const s3 = 1.0 / 1.3;
  roofQuad([[TOWER.u1, 2.4 + LT + 1.3 * s3, -18.1], [-23.35, 2.4 + LT - 0.15 * s3, -18.1], [-23.35, 2.4 + LT - 0.15 * s3, vp], [TOWER.u1, 2.4 + LT + 1.3 * s3, vp]], 'slate', LT);
  // stepped buttresses with sloped white stone caps at every bay line
  for (const u of BAYS.slice(0, -1)) buttress(u, -1);
}
/** Stepped buttress at u on the north (s = -1) or south (s = 1) side; `low` false drops the outer pier (south annexes). */
function buttress(u: number, s: number, low = true) {
  const v = (d: number) => (s < 0 ? NAVE.vN : NAVE.vS) + s * d, w = 0.42;
  const vb = (d0: number, d1: number): V2 => (s < 0 ? [v(d1), v(d0)] : [v(d0), v(d1)]);
  if (low) {
    block(u - w, u + w, ...vb(3.0, 5.6), 0, 3.3, 'brick');
    plankU(u - w - 0.05, u + w + 0.05, v(5.66), 3.28, v(3.0), 4.7, 0.16, 'stone');
  }
  block(u - w + 0.03, u + w - 0.03, ...vb(-0.1, 3.4), 0, 6.5, 'brick');
  plankU(u - w - 0.05, u + w + 0.05, v(3.46), 6.48, v(1.9), 7.85, 0.16, 'stone');
  block(u - w + 0.06, u + w - 0.06, ...vb(-0.1, 2.0), 6.5, 11.7, 'brick');
  plankU(u - w - 0.05, u + w + 0.05, v(2.06), 11.68, v(0.3), 12.75, 0.16, 'stone');
}

/* ------------------------------------------------------------------ south side: aisle, annexes, hall and the sacristy house */
function southSide() {
  const S = AISLE_S, uW = -25.97, uE = BAYS[BAYS.length - 1];
  // aisle wall with small round-headed lights where the annex roofs leave it free (west of the hall)
  const westBays: V2[] = [[uW, BAYS[0]], [BAYS[0], BAYS[1]], [BAYS[1], BAYS[2]], [BAYS[2], BAYS[3]]];
  wall([uW, S.wall], [uE, S.wall], 3.2, S.top, 'brick', westBays.flatMap(([p, q]) => lights(row((p + q) / 2 - uW, 4, 0.5, 0.26), 0.5, 4.55, 5.4, 'glass', 0.2, 0.5, 4)));
  const s4 = (S.high - S.top) / (S.wall - NAVE.vS), LT = 0.12;
  roofQuad([[uW, S.high + LT, NAVE.vS], [uE, S.high + LT, NAVE.vS], [uE, S.top + LT - 0.3 * s4, S.wall + 0.3], [uW, S.top + LT - 0.3 * s4, S.wall + 0.3]], 'slate', LT);
  for (const u of BAYS.slice(0, -1)) buttress(u, 1, false);
  // flat-roofed annexes between the aisle, the pastorie and the hall (3DBAG 3.3-4.4 m)
  annex(uW, -20.5, S.wall, 11.0, 4.35);
  annex(-20.5, -16.0, S.wall, 11.0, 3.3);
  annex(-16.0, -10.5, S.wall, 18.5, 3.9);
  // the hall: hipped roof, eaves 3.4, ridge 8.2 (3DBAG 470/541/467/540)
  const H = {u0: -10.5, u1: -5.88, v0: S.wall, v1: 16.6};
  boxWalls(H.u0, H.u1, H.v0, H.v1, 3.4, [[2, lights(row(2.3, 3, 0.7, 0.4), 0.7, 1.0, 2.8)]], 0, [0, 1, 3]);
  hipRect(rectO(H.u0, H.u1, H.v0, H.v1), 3.4, 0.3, 8.2, 'slate');
  // the low flat link to the south transept (3DBAG 530, 3.8-4.1 m)
  annex(-5.88, 0.6, S.wall, 13.0, 4.0);
  // sacristy house: two storeys with white sash windows (w08, w10), hipped roof
  const K = {u0: -5.88, u1: 0.6, v0: 13.0, v1: 22.42, eave: 6.8};
  const fw = wall([K.u0, K.v0], [K.u0, K.v1], 0, K.eave, 'brick', [...sash([3.9, 5.1], 0.9, 3.9, 5.5), ...sash([4.0, 5.2, 6.4], 0.9, 0.5, 2.3)]);
  sashBars(fw, [3.9, 5.1], 0.9, 3.9, 5.5); sashBars(fw, [4.0, 5.2, 6.4], 0.9, 0.5, 2.3);
  lintelBlocks(fw, [3.9, 5.1], 0.9, 5.5); lintelBlocks(fw, [4.0, 5.2, 6.4], 0.9, 2.3);
  const fs = wall([K.u0, K.v1], [K.u1, K.v1], 0, K.eave, 'brick', [...sash([1.6, 4.8], 0.9, 3.9, 5.5), ...sash([1.6], 1.4, 0.08, 2.4)]);
  sashBars(fs, [1.6, 4.8], 0.9, 3.9, 5.5);
  wall([K.u1, K.v1], [K.u1, 20.55], 0, K.eave, 'brick');
  wall([K.u1, 20.55], [K.u1, TRANS.vS], 3.5, K.eave, 'brick');
  wall([K.u1, K.v0], [K.u0, K.v0], 3.8, K.eave, 'brick');
  const sK = hipRect(rectO(K.u0, K.u1, K.v0, K.v1), K.eave, 0.3, 9.6, 'slate');
  for (const f of [fw, fs]) slab(f, frameLen(f, K) / 2, K.eave - 0.2 * sK - 0.33, frameLen(f, K), 0.3, 0.2, 'white');
}
const frameLen = (f: Frame, r: {u0: number; u1: number; v0: number; v1: number}) => (Math.abs(f.n[0]) > 0.7 ? r.v1 - r.v0 : r.u1 - r.u0);
/** Four plain walls of a local rectangle, optional cuts per side index (0 N, 1 W, 2 S, 3 E). */
function boxWalls(u0: number, u1: number, v0: number, v1: number, h: number, cuts: [number, Cut[]][] = [], y0 = 0, skip: number[] = []): (Frame | null)[] {
  const sides: [V2, V2][] = [[[u1, v0], [u0, v0]], [[u0, v0], [u0, v1]], [[u0, v1], [u1, v1]], [[u1, v1], [u1, v0]]];
  return sides.map(([a, c], k) => (skip.includes(k) ? null : wall(a, c, y0, h, 'brick', cuts.find(([i]) => i === k)?.[1] ?? [])));
}
/** Flat-roofed annex against the south aisle (no north wall: the aisle wall is there). */
function annex(u0: number, u1: number, v0: number, v1: number, h: number) {
  const fs = boxWalls(u0, u1, v0, v1, h, [], 0, [0]);
  roofQuad([[u0, h, v0], [u1, h, v0], [u1, h, v1], [u0, h, v1]], 'bronze');
  copeRect(null, fs[1], fs[2], fs[3], u1 - u0, v1 - v0, h);
}

/* ------------------------------------------------------------------ crossing tower */
function crossing() {
  const {u0, u1, v0, v1, top, skirt, inset, apex} = CROSS, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  // north and south faces: an oculus over six graded round-headed lancets above the transept roofs
  const lancetSet = (len: number): Cut[] => {
    const ts = row(len / 2, 6, 0.75, 0.35), heads = [17.3, 18.1, 18.8, 18.8, 18.1, 17.3], sills = [12.4, 13.3, 14.4, 14.4, 13.3, 12.4];
    return ts.map((t, k) => ({t0: t - 0.375, t1: t + 0.375, y0: sills[k], y1: heads[k], depth: 0.35, back: 'glass' as C, arch: 0.5, segments: 5}));
  };
  const len = u1 - u0;
  const fn = wall([u1, v0], [u0, v0], TRANS.eave - 0.4, top, 'brick', lancetSet(len));
  const fs = wall([u0, v1], [u1, v1], TRANS.eave - 0.4, top, 'brick', lancetSet(len));
  for (const f of [fn, fs]) oculus(f, len / 2, 19.95, 0.7);
  const fw = wall([u0, v0], [u0, v1], 5.0, top, 'brick');
  const fe = wall([u1, v1], [u1, v0], 5.0, top, 'brick');
  copeRect(fn, fw, fs, fe, len, v1 - v0, top + 0.1);
  // roof: a low skirt behind the coping, then the tiled pyramid and the cross (3DBAG 20.3-22.8 and 29.1-29.3 m)
  const inner = rectO(u0 + inset, u1 - inset, v0 + inset, v1 - inset);
  const outer = rectO(u0, u1, v0, v1);
  for (let i = 0; i < 4; i++) {
    const a = outer[i], c = outer[(i + 1) % 4], ai = inner[i], ci = inner[(i + 1) % 4];
    roofQuad([[a[0], top, a[1]], [c[0], top, c[1]], [ci[0], skirt, ci[1]], [ai[0], skirt, ai[1]]], 'slate');
  }
  ridgeRoof(inner, skirt, [uc, vc - 0.6], [uc, vc + 0.6], apex, 'slate');
  cross(uc, vc, apex - 0.1, 1.9, 'stone');
}

/* ------------------------------------------------------------------ transepts (s = -1 north, 1 south) */
function transept(s: number) {
  const {u0, u1, eave, ridge} = TRANS, uc = (u0 + u1) / 2;
  const vg = s < 0 ? TRANS.vN : TRANS.vS, vt = s < 0 ? CROSS.v0 : CROSS.v1;
  // gable wall: oculus with a stone ring; kneelers; apex block (w12, Commons 011205 noordzijde)
  const fg = s < 0 ? wall([u1, vg], [u0, vg], 0, eave, 'brick') : wall([u0, vg], [u1, vg], 0, eave, 'brick');
  const len = u1 - u0;
  gable(fg, [[0, eave], [len, eave], [len, eave + 0.3], [len / 2, ridge + 0.45], [0, eave + 0.3]], 0.55, 'brick');
  for (const t of [0.5, len - 0.5]) slab(fg, t, eave - 0.3, 1.2, 0.5, 0.22, 'stone');
  slab(fg, len / 2, ridge - 0.2, 0.9, 0.85, 0.3, 'stone', -0.2);
  // stone copings along both rakes of the gable (w12, Commons 011205 noordzijde)
  const [ra0, ra1] = s < 0 ? [vg - 0.08, vg + 0.5] : [vg - 0.5, vg + 0.08];
  plankV(ra0, ra1, u0 - 0.05, eave + 0.36, uc, ridge + 0.51, 0.16, 'stone');
  plankV(ra0, ra1, uc, ridge + 0.51, u1 + 0.05, eave + 0.36, 0.16, 'stone');
  oculus(fg, len / 2, 9.9, 0.8);
  // long walls: five round-headed lights under the eaves (w06); the east wall mirrors the west (inferred)
  const vA = s < 0 ? vg : vt, vB = s < 0 ? vt : vg, l = Math.abs(vB - vA);
  const five = (from: number) => lights(row(from, 5, 0.8, 0.36), 0.8, 3.2, 5.6, 'glass', 0.3, 0.5, 5);
  // only the north transept's west wall is photographed (w06, five lights); the east walls get four (inferred) clear of the
  // chapels, the south transept's west wall is hidden by the sacristy house and the link
  const four = (from: number) => lights(row(from, 4, 0.8, 0.36), 0.8, 3.2, 5.6, 'glass', 0.3, 0.5, 5);
  const fw = wall([u0, vA], [u0, vB], 0, eave, 'brick', s < 0 ? five(3.4) : []);
  const fe = wall([u1, vB], [u1, vA], 0, eave, 'brick', four(s < 0 ? l - 2.9 : 2.9));
  // roof: its underside meets the wall tops; white eaves bands under the overhang
  const ov = 0.35, sl = (ridge - eave) / (uc - u0), ve = s < 0 ? vg + 0.3 : vg - 0.3, ye = eave + RT - ov * sl, yr = ridge + RT;
  // bands only where the wall is free (aisle lean-tos, chapels, the sacristy roof and the link stand against the rest)
  const bands: [Frame, number, number][] = s < 0 ? [[fw, 0, -13.8 - vg], [fe, CROSS.v0 - -15.35 + 0.4, l]] : [[fw, 8.6 - vt, 12.7 - vt], [fe, 0, vg - 10.96 - 0.4]];
  for (const [f, ta, tb] of bands) slab(f, (ta + tb) / 2, eave - 0.22 * sl - 0.33, tb - ta - 0.02, 0.3, 0.22, 'white');
  roofQuad([[u0 - ov, ye, vt], [uc, yr, vt], [uc, yr, ve], [u0 - ov, ye, ve]], 'slate', RT);
  roofQuad([[uc, yr, vt], [u1 + ov, ye, vt], [u1 + ov, ye, ve], [uc, yr, ve]], 'slate', RT);
  // the low hipped annex before the gable with paired round-headed lights and a round-headed door (w12, w06, w11)
  const va = s < 0 ? -24.89 : 20.57, ua = 8.07, ch = 1.77;
  const outline: V2[] = s < 0
    ? [[u0, va], [ua - ch, va], [ua, va + ch], [ua, vg], [u0, vg]]
    : [[u0, vg], [ua, vg], [ua, va - ch], [ua - ch, va], [u0, va]];
  // hip pitch: ridge ends as far from the side walls as the ridge is from the front, underside on the wall tops
  const ha = 3.7, aR = 6.6, aov = 0.25, aTh = 0.1, dF = Math.abs(va - vg) / 2, aE = (ha + aTh - aR * aov / (dF + aov)) / (1 - aov / (dF + aov)), aS = (aR - aE) / (dF + aov);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], c = outline[(i + 1) % outline.length];
    const along = (a[0] === c[0] && a[0] === u0) || (a[1] === c[1] && a[1] === vg);
    if (along && !(a[0] === u0 && c[0] === u0)) continue;              // the edge against the transept gable
    const [p, q] = [c, a];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), front = Math.abs(p[1] - va) < 1e-6 && Math.abs(q[1] - va) < 1e-6;
    const isWest = p[0] === u0 && q[0] === u0;
    const cuts: Cut[] = front ? [...lights(row(L * 0.3, 2, 0.55, 0.3), 0.55, 1.4, 2.9, 'glass', 0.25, 0.5, 4), ...lights(row(L * 0.75, 2, 0.55, 0.3), 0.55, 1.4, 2.9, 'glass', 0.25, 0.5, 4)]
      : isWest && s < 0 ? [{t0: L / 2 - 0.7, t1: L / 2 + 0.7, y0: 0.08, y1: 2.7, depth: 0.35, back: 'dark', arch: 0.5, segments: 6}] : [];
    const f = wall(p, q, 0, ha, 'brick', cuts);
    slab(f, L / 2, ha - 0.2 * aS - 0.28, L, 0.25, 0.2, 'white');
    if (isWest && s < 0) archRing(f, cuts[0], 0.2, 0.08, 'stone');
  }
  const cu = (u0 + ua) / 2, cv = (va + vg) / 2;
  const rh = (ua - u0) / 2 - dF;
  ridgeRoof(outline.map(([u, v]) => [u + Math.sign(u - cu) * aov, v + Math.sign(v - cv) * aov] as V2), aE, [cu - rh, cv], [cu + rh, cv], aR, 'slate', [], aTh);
}

/* ------------------------------------------------------------------ apse (w09, w15, w16) */
function apse() {
  const top = 14.4, out: V2[] = [[CROSS.u1, -8.37], [18.77, -8.37], [22.05, -5.13], [22.05, 0.74], [18.74, 4.06], [CROSS.u1, 4.06]];
  // walls (outline runs clockwise seen from above in local u/v: north, NE, east, SE, south), tall lancets on the diagonals
  const ctr: V2 = [16, -2.15];
  for (let i = 0; i < out.length - 1; i++) {
    const [a, c] = orient(out[i], out[i + 1], ctr);
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const diag = i === 1 || i === 3;
    const f = wall(a, c, 0, top, 'brick', diag ? lights(row(L / 2, 2, 0.6, 0.6), 0.6, 8.6, 12.4, 'glass', 0.3, 0.5, 4) : []);
    coping(f, 0.15, L - 0.15, top + 0.1, 'stone', 0.35, 0.15);
  }
  // hipped roof behind the coping, its ridge from the crossing tower to the east end (3DBAG 10-15 m; w09 hip apex)
  ridgeRoof(out, top - 0.25, [CROSS.u1, -2.15], [18.6, -2.15], 17.2, 'slate', [out.length - 1]);
  // stepped buttresses at the angles
  for (const [u, v, a] of [[18.77, -8.37, -67.5], [22.05, -5.13, -22.5], [22.05, 0.74, 22.5], [18.74, 4.06, 67.5]] as [number, number, number][]) {
    const r = a * Math.PI / 180, du = Math.cos(r), dv = Math.sin(r);
    for (const [d0, d1, y1] of [[0, 1.6, 4.2], [0, 1.0, 9.0]] as [number, number, number][]) {
      const g = new T.BoxGeometry(y1 > 5 ? 0.7 : 0.8, y1, d1 - d0 + 0.3).translate(0, y1 / 2, (d0 + d1) / 2 - 0.15);
      const dir = N(du, dv), uu = N(u, v);
      g.rotateY(Math.atan2(dir[0], dir[1])).translate(uu[0], 0, uu[1]);
      b.add(g, 'brick' as never);
      const cap = new T.BoxGeometry(0.9, 0.16, Math.hypot(d1 - d0, 0.9)).rotateX(Math.atan2(0.9, d1 - d0)).translate(0, y1 + 0.4, (d0 + d1) / 2);
      cap.rotateY(Math.atan2(dir[0], dir[1])).translate(uu[0], 0, uu[1]);
      b.add(cap, 'stone' as never);
    }
  }
}

/* ------------------------------------------------------------------ the two polygonal chapels beside the apse */
function chapels() {
  for (const s of [-1, 1]) {
    // outline from the BAG ring (vertices 4-9 and 46-51); `exposed` lists the edges that are outside walls
    const pts: V2[] = s < 0
      ? [[13.05, -15.35], [15.96, -15.35], [17.47, -13.85], [17.58, -11.56], [15.96, -9.97], [15.96, -8.37], [13.05, -8.37]]
      : [[13.02, 10.96], [16.0, 10.96], [17.53, 9.43], [17.56, 7.18], [15.98, 5.61], [15.97, 4.06], [13.02, 4.06]];
    const exposed = [0, 1, 2, 3, 4], eave = 5.7, c: V2 = [15.4, s < 0 ? -12.4 : 7.9];
    for (const i of exposed) {
      const [a, q] = orient(pts[i], pts[i + 1], c);
      const L = Math.hypot(q[0] - a[0], q[1] - a[1]);
      const f = wall(a, q, 0, eave, 'brick', L > 1.8 && i > 0 ? lights([L / 2], 0.5, 3.0, 4.6, 'glass', 0.25, 0.5, 4) : []);
      slab(f, L / 2, eave - 0.31, L - 0.04, 0.28, 0.2, 'stone');          // light stone band round the polygon (a white trim ring would read as one assembly)
    }
    ridgeRoof(pts, eave, c, c, 8.4, 'slate');
  }
}

/* ------------------------------------------------------------------ clock block (w01, w14) and the link to the pastorie */
function clockBlock() {
  const {u0, u1, v0, v1, top, apex} = CLOCK;
  const fw = wall([u0, CLOCK.v0], [u0, v1], NAVE.eave, top, 'brick');
  const fs = wall([u0, v1], [u1, v1], 0, top, 'brick', [...lights(row(3.8, 2, 0.45, 0.25), 0.45, 8.0, 9.4, 'glass', 0.22, 0.5, 4), ...lights(row(3.8, 2, 0.45, 0.25), 0.45, 2.0, 3.4, 'glass', 0.22, 0.5, 4)]);
  const fe = wall([u1, v1], [u1, v0], 8.0, top, 'brick');
  const fn = wall([u1, v0], [u0, v0], NAVE.eave - 0.3, top, 'brick');
  copeRect(fn, fw, fs, fe, u1 - u0, v1 - v0, top + 0.1, 'stone');
  ridgeRoof(rectO(u0, u1, v0, v1), top + 0.18, [(u0 + u1) / 2, (v0 + v1) / 2], [(u0 + u1) / 2, (v0 + v1) / 2], apex, 'slate');
  // the clock: dark dial in a white ring, twelve white marks, white hands showing a little after three (w01)
  const yc = 12.45, fwFull = frame([u0, TOWER.v0], [u0, v1]), t0 = (v0 + v1) / 2 - TOWER.v0;
  const cring = new T.Shape().absarc(0, 0, 0.82, 0, Math.PI * 2, false) as T.Shape;
  cring.holes.push(new T.Path().absarc(0, 0, 0.74, 0, Math.PI * 2, true));
  relief(fwFull, t0, yc, cring, 0.1, 'white', 0, 0.05, 20);
  relief(fwFull, t0, yc, new T.Shape().absarc(0, 0, 0.74, 0, Math.PI * 2, false) as T.Shape, 0.04, 'blue', 0.02, 0.02, 20);
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, g = new T.BoxGeometry(0.06, 0.16, 0.08).translate(0, 0.6, 0).rotateZ(a).translate(0, 0, 0.04);
    placeOnFrame(g, fwFull, t0, yc, 0.06);
    b.add(g, 'white' as never);
  }
  for (const [len, a] of [[0.42, -Math.PI / 2 - 0.15], [0.62, 0]] as [number, number][]) {
    const g = new T.BoxGeometry(0.06, len, 0.08).translate(0, len / 2, 0).rotateZ(a).translate(0, 0, 0.04);
    placeOnFrame(g, fwFull, t0, yc, 0.06 + (len > 0.5 ? 0.06 : 0));
    b.add(g, 'white' as never);
  }
  // link block between the clock block, the aisle and the pastorie (3DBAG 8.3 m)
  const L = {u0: u1, u1: -25.97, v0: CLOCK.v0, v1: 8.2};
  const lf = wall([L.u0, L.v1], [L.u1, L.v1], 0, 8.3, 'brick', sash([1.55], 0.9, 4.6, 6.0));
  sashBars(lf, [1.55], 0.9, 4.6, 6.0);
  wall([L.u1, L.v1], [L.u1, AISLE_S.wall], 0, 8.3, 'brick');
  coping(lf, 0, L.u1 - L.u0, 8.3, 'stone');
  roofQuad([[L.u0, 8.3, L.v0], [L.u1, 8.3, L.v0], [L.u1, 8.3, L.v1], [L.u0, 8.3, L.v1]], 'bronze');
}

/* ------------------------------------------------------------------ pastorie (w03, w04, w07) */
function pastorie() {
  // the 45-degree block: A (west), B (south), C (east), D (north) in local u/v from the BAG ring (vertices 31, 32, 33)
  const A: V2 = [-30.65, 16.25], B: V2 = [-17.24, 29.69], Cc: V2 = [-8.99, 21.41];
  const D: V2 = [A[0] + Cc[0] - B[0], A[1] + Cc[1] - B[1]];
  const eAB: V2 = [(B[0] - A[0]) / Math.hypot(B[0] - A[0], B[1] - A[1]), (B[1] - A[1]) / Math.hypot(B[0] - A[0], B[1] - A[1])];
  const strip = 2.7, A2: V2 = [A[0] + eAB[0] * strip, A[1] + eAB[1] * strip], D2: V2 = [D[0] + eAB[0] * strip, D[1] + eAB[1] * strip];
  const EAVE = 10.6, LOW = 7.6, RIDGE = 16.8;
  // SW face (w03): t from A; heights from the rectified crop scaled to the 3DBAG eaves
  const top = [4.34, 10.5, 13.14], mid = [6.1, 7.36, 10.5, 11.76], gnd = [4.4, 7.2, 8.5, 12.5, 13.76, 15.0];
  const fsw = wall(A, B, 0, LOW, 'brick', [...sash(gnd, 0.9, 0.3, 2.1), ...sash(mid, 0.95, 4.2, 6.2), ...sash([1.56], 0.8, 4.3, 5.5)]);
  const fsw2 = wall(A2, B, LOW, EAVE, 'brick', sash(top.map(t => t - strip), 0.9, 7.8, 9.1));
  sashBars(fsw, gnd, 0.9, 0.3, 2.1); sashBars(fsw, mid, 0.95, 4.2, 6.2); sashBars(fsw, [1.56], 0.8, 4.3, 5.5);
  sashBars(fsw2, top.map(t => t - strip), 0.9, 7.8, 9.1);
  for (const g of [[4.4], [7.2, 8.5], [12.5, 13.76, 15.0]]) lintelBlocks(fsw, g, 0.9, 2.1);
  for (const g of [[6.1, 7.36], [10.5, 11.76]]) lintelBlocks(fsw, g, 0.95, 6.2);
  for (const t of top) lintelBlocks(fsw2, [t - strip], 0.9, 9.1);
  // SE face (w04): t from B
  const fse = wall(B, Cc, 0, EAVE, 'brick', [
    ...sash([3.4, 8.5], 0.9, 7.8, 9.1), ...sash([0.75, 10.5], 0.9, 4.2, 6.2), ...sash([2.5], 1.9, 4.2, 6.2),
    {t0: 1.4, t1: 2.6, y0: 0.08, y1: 2.9, depth: 0.3, back: 'dark', arch: 0.5, segments: 6}, ...sash([6.0, 9.0], 0.9, 0.3, 2.1)]);
  sashBars(fse, [3.4, 8.5], 0.9, 7.8, 9.1); sashBars(fse, [0.75, 10.5], 0.9, 4.2, 6.2); sashBars(fse, [2.05, 2.95], 0.95, 4.2, 6.2); sashBars(fse, [6.0, 9.0], 0.9, 0.3, 2.1);
  for (const t of [3.4, 8.5]) lintelBlocks(fse, [t], 0.9, 9.1);
  lintelBlocks(fse, [0.75], 0.9, 6.2); lintelBlocks(fse, [2.5], 1.9, 6.2); lintelBlocks(fse, [10.5], 0.9, 6.2);
  slab(fse, 2.5, 4.05, 2.2, 0.12, 0.6, 'bronze');                                 // the small iron balcony
  // NE face (courtyard; inferred: the same storey rhythm, three windows per storey)
  const fne = wall(Cc, D2, 0, EAVE, 'brick', [...sash([4, 8, 12], 0.9, 7.8, 9.1), ...sash([4, 8, 12], 0.95, 4.6, 6.2)]);
  sashBars(fne, [4, 8, 12], 0.9, 7.8, 9.1); sashBars(fne, [4, 8, 12], 0.95, 4.6, 6.2);
  // NW face: the two-storey strip (w07, t from D) with the arched porch, paired windows and the Madonna relief tile; above it the main body's top storey with a small oculus
  const s0 = Math.hypot(A[0] - D[0], A[1] - D[1]) - 7.4;     // where the face leaves the clock-block link (ring vertex 30)
  const fnw = wall(D, A, 0, LOW, 'brick', [
    {t0: s0 + 0.2, t1: s0 + 1.6, y0: 0.08, y1: 3.9, depth: 0.9, back: 'dark', arch: 0.5, segments: 7},
    ...sash([s0 + 3.9, s0 + 5.16], 0.95, 1.2, 2.5), ...sash([s0 + 3.9, s0 + 5.16], 0.95, 5.2, 6.6), ...sash([s0 + 0.85], 0.75, 5.4, 6.5)]);
  sashBars(fnw, [s0 + 3.9, s0 + 5.16], 0.95, 1.2, 2.5); sashBars(fnw, [s0 + 3.9, s0 + 5.16], 0.95, 5.2, 6.6);
  lintelBlocks(fnw, [s0 + 3.9, s0 + 5.16], 0.95, 2.5); lintelBlocks(fnw, [s0 + 3.9, s0 + 5.16], 0.95, 6.6);
  slab(fnw, s0 + 4.53, 3.6, 0.8, 0.85, 0.07, 'stone');                            // Madonna relief tile (w07)
  slab(fnw, s0 + 4.53, 3.75, 0.5, 0.55, 0.05, 'blue', 0.07, 0);
  slab(fnw, s0 + 0.9, 0.08, 0.12, 2.6, 0.02, 'dark', -0.84, 0);
  const fnw2 = wall(D2, A2, LOW, EAVE, 'brick');
  const tO = Math.hypot(A2[0] - D2[0], A2[1] - D2[1]) - 7.4 + 2.25;
  oculus(fnw2, tO, 9.6, 0.32);
  const s5 = 0.5, LT = 0.12;
  gable(fsw, [[0, LOW], [strip, LOW], [strip, LOW + LT / 2 + strip * s5], [0, LOW + LT / 2]], 0.3, 'brick');
  // white cornices
  const sP = hipRect([A2, B, Cc, D2], EAVE, 0.3, RIDGE, 'slate');
  for (const [f, L, y] of [[fsw2, Math.hypot(B[0] - A2[0], B[1] - A2[1]), EAVE], [fse, Math.hypot(Cc[0] - B[0], Cc[1] - B[1]), EAVE], [fne, Math.hypot(D2[0] - Cc[0], D2[1] - Cc[1]), EAVE], [fnw2, Math.hypot(A2[0] - D2[0], A2[1] - D2[1]), EAVE]] as [Frame, number, number][]) {
    slab(f, L / 2, y - 0.2 * sP - 0.33, L, 0.3, 0.2, 'white');
  }
  slab(fnw, (Math.hypot(A[0] - D[0], A[1] - D[1]) + s0) / 2, LOW - 0.25 * s5 - 0.33, 7.6, 0.3, 0.25, 'white');
  slab(fsw, strip / 2, LOW - 0.33, strip, 0.3, 0.25, 'white');
  // the strip's lean-to roof against the main body, and the main hipped roof with its two chimneys (w03, w04, w07)
  const roofPt = (p: V2, y: number, out: V2 = [0, 0]): [number, number, number] => [p[0] + out[0], y, p[1] + out[1]];
  const nNW: V2 = [-eAB[0] * 0.3, -eAB[1] * 0.3];
  roofQuad([roofPt(A, LOW + LT - 0.3 * s5, nNW), roofPt(A2, LOW + LT + strip * s5), roofPt(D2, LOW + LT + strip * s5), roofPt(D, LOW + LT - 0.3 * s5, nNW)], 'slate', LT);
  const cx = (A2[0] + Cc[0]) / 2, cy = (A2[1] + Cc[1]) / 2, half = (Math.hypot(B[0] - A2[0], B[1] - A2[1]) - Math.hypot(Cc[0] - B[0], Cc[1] - B[1])) / 2;
  for (const t of [10.4, 13.0]) {
    const along = t - strip - Math.hypot(B[0] - A2[0], B[1] - A2[1]) / 2, p: V2 = [cx + eAB[0] * along, cy + eAB[1] * along];
    chimney(p, RIDGE - 1.2, 18.4);
  }
}
function chimney(p: V2, y0: number, y1: number) {
  const g = new T.BoxGeometry(0.9, y1 - y0, 0.9).translate(0, (y1 + y0) / 2, 0).rotateY(Math.PI / 4 - TH);
  const q = N(p[0], p[1]); g.translate(q[0], 0, q[1]); b.add(g, 'brick' as never);
  const cap = new T.BoxGeometry(1.35, 0.14, 1.35).translate(0, y1 + 0.07, 0).rotateY(Math.PI / 4 - TH);
  cap.translate(q[0], 0, q[1]); b.add(cap, 'stone' as never);
}
