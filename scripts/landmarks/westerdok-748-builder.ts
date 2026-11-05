import * as T from 'three';
import polygonClipping, {type MultiPolygon, type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab, type Frame} from './nearbar-kit';
import {border, flushCutFaces, geomOf, hole, type CutFace} from './cut-face';
import {exposedRuns, inPiece, inRing, type Piece, type Pt, type Run} from '../../src/canalRecall/landmarks/terraceBands';
import source from './westerdok-748-footprints.json';

/**
 * Westerdok 748 courtyard block, Westerdokseiland (BAG pand 0363100012186003, bouwjaar 2008; 232 verblijfsobjecten, 191 of
 * them homes, on the Westerdok, Westerdoksdijk, Coffijboomstraat and Leliendaalstraat; BAG via api.data.amsterdam.nl, CC0).
 * Native frame of scripts/landmarks/westerdok-748-footprints.json (westerdok-748-prepare.ts): x east, z south, y up from the
 * street (3DBAG ground 1.33 m NAP), origin = vertex average of the BAG ring in RD.
 *
 * Massing: one prism per 3DBAG LoD2.2 roof piece (CC BY 4.0), walls emitted only where exposed (terraceBands.exposedRuns)
 * with the openings cut through them (cut-face.ts), so every window has a real reveal. The block reads, from the Gemeente
 * Amsterdam panoramas (CC BY 4.0) listed in westerdok-748-inventory.json, as several buildings round three courtyards:
 *  - west (Westerdok, w01): three seven-storey red-brick blocks (23 m) joined by three-storey links (10.8 m); the middle block
 *    stands over a two-storey passage into the middle courtyard; ground-floor porches in two bays; deep-set punched windows;
 *  - south (Leliendaalstraat, w02): a three-storey brick street wall with the eleven-storey tower (35.4 m) rising flush from
 *    it, the same deep-set windows; at the east end glass-fronted balconies stacked on the corner block;
 *  - north (w03): Juliet-balcony French windows in white frames with grey railings, the tower's storey ledges, overhanging
 *    concrete eaves on the 23 m blocks, a first-floor gallery deck on slender columns, a concrete canopy over the low gap and
 *    the car-park exit under it;
 *  - east (Westerdokskade, w04-w10): three wedge blocks (23 m) with shop fronts, two with an eight-axis punched grid (w05,
 *    w06), one with storey-pair framed glazed bays (w04), the north wedge in the Juliet manner (w07); between them three
 *    recessed 29 m towers over gated courtyard portals, clad in grey brick with storey bands (w08), timber (w09) and dark
 *    slate with vertical fins (w10).
 * CORRECTION to 3DBAG: the 35.4 m roof piece 55 also covers the low Leliendaalstraat wing west of the tower; the panoramas
 * (w02 and its 2019 second view) and the BAG floor numbers (verblijfsobjecten there reach floor 2) show three storeys, and the
 * 13.5 m roof pavilions sit in that piece's holes as they do on every other 10.8 m wing, so the wing is drawn at 10.8 m.
 * INFERRED (no photograph): the courtyard faces (same deep-set grid as the street faces), the roof pavilions' openings.
 */
type Col = Parameters<BuildingTools['add']>[1];
type Zone = 'blockA' | 'towerA' | 'low' | 'pav' | 'blockB' | 'towerB' | 'wedge' | 'bays' | 'grey' | 'timber' | 'slate' | 'plant';
type Src = {rings: Record<string, Pt[][]>; roofs: Record<string, number[][][][]>};
const SRC = source as unknown as Src;
const ROOFS = SRC.roofs.main;
const OUTER = SRC.rings.main[0];

// ---- pieces ------------------------------------------------------------------------------------------------------------------
const ZONES: Record<Zone, number[]> = {
  blockA: [24, 69],
  towerA: [23],
  // 3DBAG pieces 18, 25, 26, 30, 33 and 45 (slopes of 4.5-25 m over a few m2, standing in the courtyards) are wall surfaces
  // the reconstruction took for roof; they are left out
  low: [12, 70, 49, 63, 14, 40],
  pav: [31, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 19, 28, 32, 34, 35, 39, 42, 46, 47, 56, 57, 67, 68],
  blockB: [37, 54, 22, 48, 27, 38, 44, 53],
  towerB: [55],
  wedge: [64, 58],
  bays: [62],
  grey: [29],
  timber: [60],
  slate: [52],
  plant: [0, 6, 15, 16, 17, 20, 21, 36, 41, 43, 50, 51, 59, 61, 65, 66],
};
const LOW_TOP = 10.8;
/** The west blocks 37 and 54 (23.1 m); their small 3DBAG edge pieces (19.7-25.7 m, 4-8 m2) are drawn at the same roof. */
const BLOCK_B_TOP = 23.1;
/** Courtyard portals under the recessed east towers and the west passage under the middle block (photographed soffits). */
const PORTAL = 5.0, PASSAGE_TOP = 7.0, PORCH_TOP = 6.1;
/**
 * The courtyard portals under the recessed east towers: from the tower's 10 m street edge (outer ring) to the courtyard edge
 * opposite (BAG rings 1-3), the strips the panoramas w08-w10 show open under a dark soffit. Same corridors as the spec's
 * throughPassages.
 */
const PORTAL_CORRIDORS: Record<'grey' | 'timber' | 'slate', Pt[]> = {
  grey: [[12.632, -32.974], [11.803, -22.897], [0.334, -23.783], [1.167, -33.903]],
  slate: [[20.656, 0.187], [19.859, 10.168], [8.541, 9.259], [9.338, -0.728]],
  timber: [[28.962, 33.378], [28.102, 43.378], [16.655, 42.462], [17.516, 32.453]],
};
/** A corridor quad [street a, street b, inner c, inner d] run out `m` metres past both ends along its axis. */
function runOut(q: Pt[], m: number, side = 0): Pt[] {
  const [a, b, c, d] = q, u: Pt = [(c[0] + d[0] - a[0] - b[0]) / 2, (c[1] + d[1] - a[1] - b[1]) / 2], L = Math.hypot(...u), e: Pt = [u[0] / L, u[1] / L];
  const lb = Math.hypot(b[0] - a[0], b[1] - a[1]), l: Pt = [(b[0] - a[0]) / lb, (b[1] - a[1]) / lb];
  const mv = (p: Pt, s: number, k: number): Pt => [p[0] + e[0] * s + l[0] * k, p[1] + e[1] * s + l[1] * k];
  return [mv(a, -m, -side), mv(b, -m, side), mv(c, m, side), mv(d, m, -side)];
}
/** The west passage: between the outer ring's edge 24-25 and the middle courtyard's west edge, run out 1 m at both ends. */
const PASSAGE: Pt[] = runOut([[-39.056, -4.642], [-39.946, 5.355], [-28.577, 6.27], [-27.687, -3.723]], 1);
/** The tower part of 3DBAG piece 55: east of the south courtyard's east edges (BAG ring 3, vertices 7-9) run on to the street. */
const TOWER_CLIP: Polygon = [[[-12.769, 30], [-12.769, 37.374], [-13.419, 45.436], [-13.87, 50.777], [-14.74, 62], [50, 62], [50, 30], [-12.769, 30]]];

/**
 * 3DBAG piece outlines step in 10 cm saw-teeth along straight walls (pixel edges of the reconstruction); every tooth would be a
 * wall of its own with a crack at its corner. Douglas-Peucker on the closed ring (0.3 m) straightens them before the pieces are
 * clipped against each other, so neighbouring pieces still share their boundaries.
 */
function simplify(r: Pt[], tol = 0.3): Pt[] {
  const pts = openR(r);
  if (pts.length <= 4) return pts;
  // anchor on the two vertices farthest apart, simplify both halves
  let i0 = 0, i1 = 0, best = -1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > best) { best = d; i0 = i; i1 = j; } }
  const dp = (a: Pt[]): Pt[] => {
    if (a.length < 3) return a;
    const p = a[0], q = a.at(-1)!, L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1e-9;
    let k = -1, dm = -1;
    for (let i = 1; i < a.length - 1; i++) { const d = Math.abs((a[i][0] - p[0]) * (q[1] - p[1]) - (a[i][1] - p[1]) * (q[0] - p[0])) / L; if (d > dm) { dm = d; k = i; } }
    return dm > tol ? [...dp(a.slice(0, k + 1)).slice(0, -1), ...dp(a.slice(k))] : [p, q];
  };
  const h1 = pts.slice(i0, i1 + 1), h2 = [...pts.slice(i1), ...pts.slice(0, i0 + 1)];
  const out = [...dp(h1).slice(0, -1), ...dp(h2).slice(0, -1)];
  return out.length >= 3 ? out : pts;
}
const ring2 = (i: number): Pt[][] => ROOFS[i].map(r => simplify(r.map(v => [v[0], v[2]] as Pt)).map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100] as Pt));
const roofTop = (i: number) => { const ys = ROOFS[i][0].map(v => v[1]); const lo = Math.min(...ys), hi = Math.max(...ys); return hi - lo > 1.5 ? lo : hi; };
const closed = (r: Pt[]): Pt[] => [...r, r[0]];
const asPoly = (rings: Pt[][]): Polygon => rings.map(closed);
const openR = (r: Pt[]): Pt[] => (r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
function despike(r: Pt[]): Pt[] {
  const ring = r.slice();
  for (let changed = true; changed && ring.length > 3;) {
    changed = false;
    for (let i = 0; i < ring.length && ring.length > 3; i++) {
      const p = ring[(i + ring.length - 1) % ring.length], v = ring[i], n = ring[(i + 1) % ring.length];
      const a: Pt = [p[0] - v[0], p[1] - v[1]], c: Pt = [n[0] - v[0], n[1] - v[1]], la = Math.hypot(...a), lc = Math.hypot(...c);
      if (la < 1e-3 || lc < 1e-3 || (a[0] * c[0] + a[1] * c[1]) / (la * lc) > Math.cos(25 * Math.PI / 180)) { ring.splice(i, 1); changed = true; i--; }
    }
  }
  return ring;
}
type ZPiece = Piece & {zone: Zone};
const area = (r: Pt[]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

export function pieces(): ZPiece[] {
  const out: ZPiece[] = [];
  let taken: MultiPolygon = [];
  const pass: Polygon = [closed(PASSAGE)];
  const push = (mp: MultiPolygon, zone: Zone, base: number, top: number) => {
    for (const poly of mp) {
      const ring = despike(openR(poly[0] as Pt[]));
      if (ring.length < 3 || area(ring) < 0.3) continue;
      out.push({ring, holes: poly.slice(1).map(r => despike(openR(r as Pt[]))).filter(h => h.length >= 3 && area(h) > 0.05), base, top, zone});
    }
  };
  const add = (mp: MultiPolygon, zone: Zone, top: number) => {
    const own = taken.length ? polygonClipping.difference(mp, taken) : mp;
    taken = taken.length ? polygonClipping.union(taken, mp) : mp;
    if (!own.length) return;
    const portal = zone === 'grey' || zone === 'timber' || zone === 'slate';
    if (portal) {
      const gate: Polygon = [closed(runOut(PORTAL_CORRIDORS[zone as 'grey' | 'timber' | 'slate'], 1, 0.6))];
      push(polygonClipping.difference(own, gate), zone, 0, top);
      push(polygonClipping.intersection(own, gate), zone, PORTAL, top);
      return;
    }
    const under = polygonClipping.intersection(own, pass), rest = polygonClipping.difference(own, pass);
    push(rest, zone, 0, top);
    if (under.length && top > PASSAGE_TOP + 0.5) push(under, zone, PASSAGE_TOP, top);
  };
  // Roof plant and pavilions stand in holes of a lower piece (3DBAG cuts them out of its roof): the host keeps its full plan up
  // to its own roof (the hole dropped) and the small piece stands on that roof, so the host's walls run unbroken under it.
  const centroid = (i: number): Pt => { const r = ring2(i)[0]; return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; };
  const small = new Set([...ZONES.plant, ...ZONES.pav]);
  const hosts = (Object.entries(ZONES) as [Zone, number[]][]).flatMap(([z, ids]) => ids.filter(i => !small.has(i)).map(i => ({z, i})));
  const topOf = (z: Zone, i: number, at?: Pt) => i === 55 ? (at && inRing(TOWER_CLIP[0].slice(0, -1) as Pt[], at[0], at[1]) ? roofTop(55) : LOW_TOP) : z === 'low' ? LOW_TOP : z === 'blockB' ? BLOCK_B_TOP : roofTop(i);
  const stand = new Map<number, number>(), drop = new Map<number, Set<number>>();
  for (const i of small) {
    const c = centroid(i);
    const h = hosts.filter(({i: j}) => inRing(ring2(j)[0], c[0], c[1])).sort((a, b) => area(ring2(a.i)[0]) - area(ring2(b.i)[0]))[0];
    if (!h) continue;
    const ht = topOf(h.z, h.i, c);
    if (roofTop(i) <= ht + 0.3) continue;
    stand.set(i, ht);
    const holes = ring2(h.i).slice(1);
    holes.forEach((r, k) => { if (inRing(r, c[0], c[1])) { if (!drop.has(h.i)) drop.set(h.i, new Set()); drop.get(h.i)!.add(k + 1); } });
  }
  const polyOf = (i: number): Polygon => asPoly(ring2(i).filter((_, k) => !drop.get(i)?.has(k)));
  // big pieces first so the slivers only fill what the big ones leave
  const order = hosts.sort((a, c) => area(ring2(c.i)[0]) - area(ring2(a.i)[0]));
  for (const {z, i} of order) {
    const poly = polyOf(i);
    if (i === 55) {
      add(polygonClipping.intersection(poly, TOWER_CLIP), 'towerB', roofTop(55));
      add(polygonClipping.difference(poly, TOWER_CLIP), 'low', LOW_TOP);
      continue;
    }
    add([poly], z, topOf(z, i));
  }
  for (const z of ['plant', 'pav'] as Zone[]) for (const i of ZONES[z]) {
    const base = stand.get(i);
    if (base === undefined) add([polyOf(i)], z, roofTop(i)); else push([asPoly(ring2(i).slice(0, 1))], z, base, roofTop(i));
  }
  return out;
}

// ---- faces -------------------------------------------------------------------------------------------------------------------
type Ctx = {f: Frame; len: number; y0: number; y1: number; zone: Zone; top: number; mid: Pt; bearing: number; inside: boolean; piece: number};
let FACES: CutFace[] = [];
function mk(c: Ctx, y0: number, y1: number, col: Col): CutFace | null {
  const a = Math.max(c.y0, y0), z = Math.min(c.y1, y1);
  if (z - a < 0.02) return null;
  const F: CutFace = {f: c.f, len: c.len, y0: a, y1: z, c: col, holes: []}; FACES.push(F); return F;
}
function runCtx(r: Run, y0: number, y1: number, p: ZPiece): Ctx {
  let a = r.a, b = r.b;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let t: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  if (-t[1] * r.n[0] + t[0] * r.n[1] < 0) { [a, b] = [b, a]; t = [-t[0], -t[1]]; }
  const bearing = ((Math.atan2(r.n[0], -r.n[1]) * 180 / Math.PI) + 360) % 360;
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], probe: Pt = [mid[0] + r.n[0] * 0.4, mid[1] + r.n[1] * 0.4];
  // a wall facing into the west passage or a courtyard portal: plain brick
  const inside = y0 < PASSAGE_TOP - 0.1 && (inRing(PASSAGE, probe[0], probe[1]) || PORTALS().some(q => inRing(q, probe[0], probe[1])))
    // a crack between two 3DBAG pieces that do not quite meet (another piece within 0.6 m in front): plain wall
    || (() => { const ym = (y0 + y1) / 2, q: Pt = [mid[0] + r.n[0] * 0.6, mid[1] + r.n[1] * 0.6]; return PIECES.some((o, i) => i !== r.piece && o.base <= ym && o.top >= ym && inPiece(o, q[0], q[1])); })();
  return {f: {origin: a, tangent: t, n: r.n}, len, y0, y1, zone: p.zone, top: p.top, mid, bearing, inside, piece: r.piece};
}
let PORTAL_RINGS: Pt[][] = [];
let PIECES: ZPiece[] = [];
const PORTALS = () => PORTAL_RINGS;
const near = (c: Ctx, deg: number, tol = 12) => Math.abs(((c.bearing - deg + 540) % 360) - 180) < tol;
/** Is the face on the outer ring edge from vertex i to i+1 (within 0.8 m)? */
function onOuter(c: Ctx, i: number) {
  const p = OUTER[i], q = OUTER[(i + 1) % OUTER.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const u: Pt = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], d = (x: Pt) => Math.abs((x[0] - p[0]) * u[1] - (x[1] - p[1]) * u[0]);
  const s = (x: Pt) => (x[0] - p[0]) * u[0] + (x[1] - p[1]) * u[1];
  return d(c.mid) < 0.8 && s(c.mid) > 0 && s(c.mid) < L;
}
function band(b: BuildingTools, c: Ctx, y: number, h: number, d: number, col: Col, out = 0) {
  if (y < c.y0 - 0.01 || y + h > c.y1 + 0.01 || c.len < 1) return;
  (c.len > 6 ? slab : ledgeStrip)(b, c.f, c.len / 2, y, c.len - 0.02, h, d, col, out);
}
/** Column centres: as many windows of width w at pitch P as fit with `edge` of plain wall at each end, centred. */
function cols(len: number, P: number, w: number, edge: number): number[] {
  const n = Math.max(0, Math.floor((len - 2 * edge + (P - w)) / P + 1e-6));
  return [...Array(n)].map((_, k) => len / 2 + (k - (n - 1) / 2) * P);
}
/** Deep-set window: the hole, a dark frame inside the reveal and one off-centre mullion (w05/w06). */
function deepWindow(b: BuildingTools, F: CutFace, f: Frame, t: number, y0: number, w: number, h: number, depth = 0.25, mull = true) {
  if (!hole(F, t - w / 2, t + w / 2, y0, y0 + h, depth, 'glass')) return false;
  if (mull) ledgeStrip(b, f, t + w * 0.1, y0 + 0.03, 0.07, h - 0.06, depth - 0.06, 'dark', -depth);
  return true;
}

// ---- deep-set grid (west blocks, south wing and tower, links, courtyards: w01, w02) ------------------------------------------
const B = {P: 3.4, w: 1.55, h: 2.0, sill0: 4.8, pitch: 3.1, edge: 1.0};
function gridB(b: BuildingTools, c: Ctx, F: CutFace, ground = true) {
  const ts = cols(c.len, B.P, B.w, B.edge);
  if (ground) for (const t of ts) deepWindow(b, F, c.f, t, 0.25, B.w - 0.1, 3.45, 0.25, false);
  for (let s = B.sill0; s + B.h <= c.top - 0.7; s += B.pitch) for (const t of ts) deepWindow(b, F, c.f, t, s, B.w, B.h);
}
function blockBFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, c.top, 'brick');
  band(b, c, c.top - 0.12, 0.12, 0.08, 'concrete');
  if (!F || c.inside || c.len < 2.4) return;
  // ground porches in two bays of the west front (w01): 6 m high, 3 m deep
  if (onOuter(c, 22) || onOuter(c, 0)) hole(F, 0.15, c.len - 0.15, 0, PORCH_TOP, 3.0, 'red');
  gridB(b, c, F);
}
function lowFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, c.top, 'brick');
  band(b, c, c.top - 0.12, 0.12, 0.08, 'concrete');
  if (!F || c.inside || c.len < 2.4) return;
  if (onOuter(c, 22)) hole(F, 0.15, Math.min(c.len - 0.15, 10.0), 0, PORCH_TOP, 3.0, 'red');
  // the car-park exit under the north canopy (w03), 4.7 m wide
  if (near(c, 5) && c.piece >= 0 && c.mid[0] > -12 && c.mid[0] < 0 && c.mid[1] < -45) hole(F, c.len / 2 - 2.35, c.len / 2 + 2.35, 0, 2.9, 1.5, 'dark');
  gridB(b, c, F);
}

// ---- Juliet-balcony fronts (north blocks and tower, the north wedge: w03, w07, w01 north block) ------------------------------
const A = {P: 2.7, w: 1.3, h: 2.05, sill0: 6.4, pitch: 3.07, edge: 0.9};
const TOWER_SILLS = [6.6, 10.1, 13.55, 17.0, 20.45, 23.9, 27.35, 30.8];
function juliet(b: BuildingTools, F: CutFace, f: Frame, t: number, s: number, w: number, h: number) {
  // white French-door pair: the centre stile and the transom stand on the glass at the back of the reveal
  if (!hole(F, t - w / 2, t + w / 2, s, s + h, 0.18, 'glass')) return;
  ledgeStrip(b, f, t, s + 0.02, 0.09, h - 0.04, 0.16, 'white', -0.18);
  ledgeStrip(b, f, t, s + 1.0, w - 0.02, 0.09, 0.16, 'white', -0.18);
  // grey railing panel across the lower part, 10 cm deep, standing on the wall
  ledgeStrip(b, f, t, s + 0.05, w + 0.1, 0.9, 0.1, 'frame');
}
function blockAFace(b: BuildingTools, c: Ctx, tower: boolean) {
  const F = mk(c, 0, c.top, 'brick');
  if (!tower) band(b, c, c.top - 0.75, 0.75, 0.6, 'concrete');
  else band(b, c, c.top - 0.3, 0.3, 0.2, 'concrete');
  if (!F || c.inside || c.len < 2.2) return;
  const ts = cols(c.len, A.P, A.w, A.edge);
  // the north wedge's Westerdokskade front (w07): a shop storey of paired glazed fronts, no mezzanine
  if (!tower && near(c, 76, 8) && c.len > 12) {
    shops(b, c, F, ts);
    // the north gallery deck returns along this front's north 11.6 m (w07): slab, railing and its south end panel
    const t0 = c.len - 11.6, DY = 5.2, DD = 2.0;
    slab(b, c.f, (t0 + c.len) / 2, DY, c.len - t0, 0.35, DD, 'concrete');
    slab(b, c.f, (t0 + c.len) / 2, DY + 0.35, c.len - t0, 1.0, 0.1, 'frame', DD - 0.1);
    slab(b, c.f, t0 + 0.05, DY + 0.35, 0.1, 1.0, DD - 0.1, 'frame');
  }
  // ground storey 0-5.5: doors and shop windows, a pale stone ledge, the mezzanine French windows with railings (w03)
  else if (c.y0 < 0.5) for (const t of ts) {
    deepWindow(b, F, c.f, t, 0.2, A.w + 0.2, 2.4, 0.2, false);
    ledgeStrip(b, c.f, t, 2.75, A.w + 0.5, 0.3, 0.12, 'concrete');
    juliet(b, F, c.f, t, 3.25, A.w, 1.8);
  }
  const sills = tower ? TOWER_SILLS : [...Array(8)].map((_, k) => A.sill0 + A.pitch * k);
  for (const s of sills) {
    if (s + A.h > c.top - 0.8) break;
    for (const t of ts) juliet(b, F, c.f, t, s, A.w, A.h);
    if (tower && s > 7) band(b, c, s - 0.45, 0.18, 0.3, 'concrete');
  }
}

// ---- east wedges: shop storey and the eight-axis grid (w05, w06) ------------------------------------------------------------
const W = {P: 2.75, w: 1.6, h: 2.2, sill0: 6.7, pitch: 3.23, edge: 1.2, shop: 5.0};
function shops(b: BuildingTools, c: Ctx, F: CutFace, ts: number[]) {
  for (let k = 0; k < ts.length; k += 2) {
    const t0 = ts[k] - W.w / 2 - 0.15, t1 = (ts[k + 1] ?? ts[k]) + W.w / 2 + 0.15;
    if (hole(F, t0, t1, 0.15, W.shop - 0.55, 0.2, 'glass')) {
      ledgeStrip(b, c.f, (t0 + t1) / 2, W.shop - 1.6, t1 - t0 - 0.04, 0.08, 0.14, 'dark', -0.2);
      for (let t = t0 + 1.1; t < t1 - 0.5; t += 1.1) ledgeStrip(b, c.f, t, 0.17, 0.07, W.shop - 0.74, 0.14, 'dark', -0.2);
    }
    hole(F, t0, t1, W.shop - 0.5, W.shop - 0.1, 0.1, 'slate');
  }
}
function wedgeFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, c.top, 'brick');
  band(b, c, c.top - 0.12, 0.12, 0.08, 'concrete');
  if (!F || c.inside || c.len < 2.4) return;
  const street = near(c, 76, 8) && c.len > 15;
  // the south wedge's west flank over the low Leliendaalstraat wing: one long low window per storey (w02, 2019 second view)
  if (c.y0 > LOW_TOP - 0.2 && near(c, 274, 10) && c.zone === 'wedge') {
    for (let s = W.sill0 + W.pitch * 2 + 0.4; s + 1.3 <= c.top - 0.7; s += W.pitch) deepWindow(b, F, c.f, c.len / 2, s, Math.min(4.5, c.len - 2), 1.3, 0.2, false);
    return;
  }
  const ts = cols(c.len, W.P, W.w, W.edge);
  if (street) shops(b, c, F, ts);
  else for (const t of ts) deepWindow(b, F, c.f, t, 0.25, W.w - 0.1, 3.6, 0.25, false);
  for (let s = W.sill0; s + W.h <= c.top - 0.7; s += W.pitch) for (const t of ts) deepWindow(b, F, c.f, t, s, W.w, W.h);
  // the south corner block on the Leliendaalstraat: glass-fronted balconies stacked over its east half (w02)
  if (near(c, 185) && c.piece >= 0 && c.mid[0] > 22 && c.len > 8) {
    for (let s = W.sill0 - 0.6; s + 1 <= c.top - 3.5; s += W.pitch) {
      slab(b, c.f, c.len * 0.6, s, c.len * 0.6, 0.22, 1.6, 'concrete');
      slab(b, c.f, c.len * 0.6, s + 0.22, c.len * 0.6, 1.0, 0.06, 'copper', 1.5);
    }
  }
}

// ---- the framed-bay wedge (w04): storey-pair glazed bays in grey frames, French windows between -----------------------------
/** Rows bottom-up (sill, head) and the openings per row in metres from the viewer's left of the 23.8 m photo wall (w04-75). */
const BAY_ROWS: [number, number][] = [[6.2, 8.9], [9.5, 12.3], [12.8, 15.5], [16.2, 18.9], [19.6, 22.4]];
const BAY_FRAMES: {t0: number; t1: number; r0: number; r1: number}[] = [
  {t0: 0.7, t1: 5.6, r0: 0, r1: 1}, {t0: 0.7, t1: 5.6, r0: 3, r1: 4}, {t0: 18.0, t1: 22.9, r0: 0, r1: 1}, {t0: 18.0, t1: 22.9, r0: 3, r1: 4},
  {t0: 6.4, t1: 11.4, r0: 2, r1: 3}, {t0: 12.2, t1: 17.2, r0: 2, r1: 3},
];
const BAY_WINDOWS: [number, number, number][] = [
  // [row, t0, t1]
  [4, 6.6, 8.8], [4, 10.2, 11.4], [4, 12.2, 13.3], [4, 14.1, 15.2], [4, 15.9, 17.1],
  [2, 0.9, 1.9], [2, 2.8, 3.8], [2, 4.6, 5.6], [2, 17.9, 19.0], [2, 20.4, 22.7],
  [1, 6.6, 8.8], [1, 10.2, 11.4], [1, 12.2, 13.3], [1, 14.1, 15.2], [1, 15.9, 17.1],
  [0, 6.6, 8.8], [0, 10.2, 11.4], [0, 12.2, 13.3], [0, 14.1, 15.2], [0, 15.9, 17.1],
];
const BAY_SHOPS: [number, number][] = [[0.9, 5.0], [6.6, 10.7], [12.2, 16.4], [18.0, 19.0], [19.8, 20.8], [21.7, 22.7]];
function baysFace(b: BuildingTools, c: Ctx) {
  if (!(near(c, 76, 8) && c.len > 15)) return wedgeFace(b, c);
  const F = mk(c, 0, c.top, 'brick');
  band(b, c, c.top - 0.12, 0.12, 0.08, 'concrete');
  if (!F) return;
  const k = c.len / 23.8, tt = (t: number) => t * k;
  for (const [t0, t1] of BAY_SHOPS) if (hole(F, tt(t0), tt(t1), 0.2, 4.5, 0.2, 'glass')) ledgeStrip(b, c.f, tt((t0 + t1) / 2), 3.3, tt(t1 - t0) - 0.04, 0.08, 0.14, 'dark', -0.2);
  for (const fr of BAY_FRAMES) {
    const y0 = BAY_ROWS[fr.r0][0] - 0.25, y1 = BAY_ROWS[fr.r1][1] + 0.1, t0 = tt(fr.t0), t1 = tt(fr.t1);
    if (!hole(F, t0, t1, y0, y1, 0.15, 'glass')) continue;
    border(b, c.f, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.12, 0.2, 'slate');
    // dark spandrel band at the storey line and three mullions
    const mid = (BAY_ROWS[fr.r0][1] + BAY_ROWS[fr.r1][0]) / 2;
    ledgeStrip(b, c.f, (t0 + t1) / 2, mid - 0.3, t1 - t0 - 0.04, 0.6, 0.1, 'slate', -0.15);
    for (let m = 1; m < 4; m++) ledgeStrip(b, c.f, t0 + (t1 - t0) * m / 4, y0 + 0.03, 0.07, y1 - y0 - 0.06, 0.1, 'slate', -0.15);
  }
  for (const [r, a, z] of BAY_WINDOWS) {
    const [s, h] = BAY_ROWS[r], t0 = tt(a), t1 = tt(z);
    if (!hole(F, t0, t1, s, h, 0.15, 'glass')) continue;
    border(b, c.f, (t0 + t1) / 2, s, t1 - t0, h - s, 0.05, 0.08, 'dark');
    ledgeStrip(b, c.f, (t0 + t1) / 2, s + 0.05, t1 - t0 + 0.06, 0.9, 0.1, 'dark');
  }
}

// ---- the recessed east towers over the courtyard portals (w08 grey, w09 timber, w10 slate) ----------------------------------
const TW = {sill0: 6.7, pitch: 3.0, h: 1.8};
function towerFace(b: BuildingTools, c: Ctx, col: Col, kind: 'grey' | 'timber' | 'slate') {
  const F = mk(c, 0, c.top, col);
  band(b, c, c.top - 0.15, 0.15, 0.08, 'concrete');
  if (!F || c.inside || c.len < 2.4) return;
  const ts = kind === 'slate' ? cols(c.len, 2.4, 1.3, 0.7) : cols(c.len, 3.1, 2.0, 0.9);
  for (let s = TW.sill0; s + TW.h <= c.top - 0.8; s += TW.pitch) {
    for (const t of ts) {
      const w = kind === 'slate' ? 1.3 : 2.0;
      if (hole(F, t - w / 2, t + w / 2, s, s + TW.h, 0.15, 'glass')) ledgeStrip(b, c.f, t, s + 0.03, 0.07, TW.h - 0.06, 0.1, 'dark', -0.15);
    }
    if (kind !== 'slate') band(b, c, s - 0.55, 0.3, kind === 'grey' ? 0.12 : 0.08, kind === 'grey' ? 'greyBrick' : 'ochre', 0);
  }
  if (kind === 'slate') for (let k = 0; k + 1 < ts.length; k++) {
    const t = (ts[k] + ts[k + 1]) / 2;
    slab(b, c.f, t, TW.sill0 - 0.3, 0.12, c.top - 1.0 - TW.sill0, 0.25, 'bronze');
  }
}

// ---- roof pavilions and plant -----------------------------------------------------------------------------------------------
function pavFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, c.y0, c.y1, 'ochre');
  if (F && !c.inside && c.len > 2.5 && c.y0 >= LOW_TOP - 0.1) hole(F, c.len / 2 - 0.8, c.len / 2 + 0.8, c.y0 + 0.3, c.y1 - 0.4, 0.1, 'glass');
}
function plantFace(_b: BuildingTools, c: Ctx) { mk(c, c.y0, c.y1, 'brick'); }

const RULES: Record<Zone, (b: BuildingTools, c: Ctx) => void> = {
  blockA: (b, c) => blockAFace(b, c, false), towerA: (b, c) => blockAFace(b, c, true), low: lowFace, pav: pavFace,
  blockB: blockBFace, towerB: blockBFace, wedge: wedgeFace, bays: baysFace,
  grey: (b, c) => towerFace(b, c, 'greyBrick', 'grey'), timber: (b, c) => towerFace(b, c, 'ochre', 'timber'), slate: (b, c) => towerFace(b, c, 'blue', 'slate'),
  plant: plantFace,
};
// the north-wedge east front (w07) is Juliet-balcony work like the north blocks: zone blockA already covers piece 69

// ---- roofs, soffits ------------------------------------------------------------------------------------------------------------
function flat(p: Piece, y: number, up: boolean): T.BufferGeometry {
  const shape = new T.Shape(p.ring.map(([x, z]) => new T.Vector2(x, z)));
  for (const h of p.holes ?? []) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
  const sg = new T.ShapeGeometry(shape).toNonIndexed(), q = sg.getAttribute('position'), out: number[] = [];
  for (let i = 0; i < q.count; i += 3) {
    const v = [0, 1, 2].map(j => [q.getX(i + j), y, q.getY(i + j)]);
    const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
    out.push(...v[0], ...((ny > 0) === up ? [...v[1], ...v[2]] : [...v[2], ...v[1]]));
  }
  return geomOf(out);
}

// ---- north gallery deck, canopy and columns (w03) ----------------------------------------------------------------------------
function northFront(b: BuildingTools) {
  // frame along the north outer edge, viewer's left at vertex 17 (x 10.75), outward normal north
  const p = OUTER[17], q = OUTER[20], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const f: Frame = {origin: p, tangent: [(q[0] - p[0]) / L, (q[1] - p[1]) / L], n: [(q[1] - p[1]) / L, -(q[0] - p[0]) / L]};
  if (f.n[1] > 0) { f.n = [-f.n[0], -f.n[1]]; }
  const DECK0 = 0.4, DECK1 = 37.7, DY = 5.2, DD = 2.0;
  slab(b, f, (DECK0 + DECK1) / 2, DY, DECK1 - DECK0, 0.35, DD, 'concrete');
  slab(b, f, (DECK0 + DECK1) / 2, DY + 0.35, DECK1 - DECK0, 1.0, 0.1, 'frame', DD - 0.1);
  for (const s of [-1, 1]) slab(b, f, s < 0 ? DECK0 + 0.05 : DECK1 - 0.05, DY + 0.35, 0.1, 1.0, DD - 0.1, 'frame');
  for (let t = DECK0 + 3.0; t < DECK1 - 1; t += 6.6) {
    const x = p[0] + f.tangent[0] * t + f.n[0] * (DD - 0.35), z = p[1] + f.tangent[1] * t + f.n[1] * (DD - 0.35);
    b.add(new T.CylinderGeometry(0.14, 0.14, DY, 8).translate(x, DY / 2, z), 'slate' as Col);
  }
  // the concrete canopy over the low gap and under the tower, 1.6 m out at the third storey
  slab(b, f, 25.0, 8.4, 24.4, 0.9, 1.6, 'concrete');
}

export function buildWesterdok748(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  FACES = [];
  const P = pieces();
  PORTAL_RINGS = P.filter(p => p.base === PORTAL).map(p => p.ring);
  PIECES = P;
  const levels = [...new Set(P.flatMap(p => [p.base, p.top]))].sort((a, c) => a - c);
  const open = new Map<string, {r: Run; y0: number; y1: number}>(), done: {r: Run; y0: number; y1: number}[] = [];
  const key = (r: Run) => `${r.piece}|${r.a.map(v => v.toFixed(2))}|${r.b.map(v => v.toFixed(2))}`;
  for (let i = 0; i + 1 < levels.length; i++) {
    const [y0, y1] = [levels[i], levels[i + 1]], runs = exposedRuns(P, (y0 + y1) / 2, {probe: 0.1, step: 0.2, minLen: 0.1});
    const seen = new Set<string>();
    for (const r of runs) {
      const k = key(r), o = open.get(k); seen.add(k);
      if (o && Math.abs(o.y1 - y0) < 1e-6) o.y1 = y1; else { if (o) done.push(o); open.set(k, {r, y0, y1}); }
    }
    for (const [k, o] of open) if (!seen.has(k)) { done.push(o); open.delete(k); }
  }
  done.push(...open.values());
  // largest walls first: the audit's wall clustering seeds each plane from the first triangle it meets, and a window reveal seeded
  // first can capture a long wall whose plane offset it happens to share (the block A flank over the low wing, 3 cm apart)
  done.sort((p, q) => Math.hypot(q.r.b[0] - q.r.a[0], q.r.b[1] - q.r.a[1]) * (q.y1 - q.y0) - Math.hypot(p.r.b[0] - p.r.a[0], p.r.b[1] - p.r.a[1]) * (p.y1 - p.y0));
  for (const {r, y0, y1} of done) {
    const c = runCtx(r, y0, y1, P[r.piece]);
    if (c.len < 0.3) mk(c, y0, y1, 'brick'); else RULES[c.zone](b, c);
  }
  b.mark?.('facades');
  for (const p of P) {
    const roof = flat(p, p.top, true); roof.userData.role = 'roof';
    b.add(roof, (p.zone === 'pav' ? 'ochre' : 'slate') as Col);
    if (p.base > 0 && p.zone !== 'plant' && p.zone !== 'pav') b.add(flat(p, p.base, false), (p.base === PORTAL ? 'dark' : 'concrete') as Col);
  }
  b.mark?.('roofs');
  northFront(b);
  flushCutFaces(b, FACES);
  FACES = [];
  b.mark?.('walls');
}
