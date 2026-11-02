import * as T from 'three';
import polygonClipping, {type MultiPolygon, type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {letters, ledgeStrip, put, slab, type Frame} from './nearbar-kit';
import {border, flushCutFaces, geomOf, hole, type CutFace} from './cut-face';
import {exposedRuns, inRing, type Piece, type Pt, type Run} from '../../src/canalRecall/landmarks/terraceBands';
import source from './apollo-hotel-footprints.json';

/**
 * Apollo Hotel, Apollolaan 2 at the meeting of the Noorder and Zuider Amstelkanaal (BAG pand 0363100012148632, one pand,
 * logiesfunctie, BAG bouwjaar 1928). en.wikipedia "Apollo Hotel Amsterdam": the 1934 Apollo Pavilion café-restaurant by
 * Albert Boeken (part of Rijksmonument 527829 with the Apollohal), enlarged in 1962 into a hotel by Alexander Bodon, extended
 * in 1969 and 1974 by his associate J.H. Ploeger, a 1985 leisure centre by Cees Dam. Native frame of
 * scripts/landmarks/apollo-hotel-footprints.json (x east, z south, y up from the quay at 0.4 m NAP; origin = vertex average
 * of the BAG ring in RD).
 *
 * Massing: one prism per 3DBAG LoD2.2 roof piece (CC BY 4.0), grouped into the parts the panoramas show; walls are emitted
 * only where they are exposed (terraceBands.exposedRuns, the Apollohal counted as a neighbour), with openings cut through
 * them (cut-face.ts):
 *  - two buff-brick room slabs (NW and SE, 23.5 m): a red-brick base, six storeys of shallow glazed bays (the ring's
 *    saw-tooth: 2.3 m fronts and 0.5 m glazed cheeks) between plain brick piers, cream floor bands, a glazed top storey under
 *    a white fascia; the NW street end with the slit stair window, the HARBOUR CLUB and LIVING ROOM boards, APOLLO HOTEL and
 *    the red A;
 *  - the dark ribbed lift tower (27 m) with the red A, and the beige stair tower (24.8 m) in front of it;
 *  - the three-storey glass link and the curved canal wing (11.1 m): cream window bands with dark spandrels under a brown
 *    brick parapet, the glazed lounge in its ground storey, brown-brick end blocks with white bands;
 *  - the white Boeken pavilion on the water: portholes and windows below, a cantilevered gallery on raking struts, the glazed
 *    upper room and the thin overhanging roof; the brown-brick block behind it and the glazed restaurant strip;
 *  - the low lobby and conference wings on the Apollohal side (no panorama: brick with a glass band, inferred).
 * Heights are 3DBAG roofs less the 0.4 m NAP quay; the pavilion is drawn at its photographed 10.1 m.
 */
type Col = Parameters<BuildingTools['add']>[1];
type Zone = 'slab' | 'pent' | 'plant' | 'tower' | 'stair' | 'link' | 'curve' | 'pav' | 'brick' | 'rest' | 'low';
type Src = {rings: Pt[][]; roofs: number[][][][]; neighbours: {id: string; height: number; ring: Pt[]}[]};
const SRC = source as unknown as Src;

// ---- vertical schedule (m above the quay) -----------------------------------------------------------------------------------
const SB = 0.9, FH = 3.05, NF = 6, PENT = SB + FH * NF, SLAB_TOP = 23.5;
const TOWER_TOP = 27.0, STAIR_TOP = 24.8;
const LINK_TOP = 10.7, LINK_FLOORS = [0, 3.2, 6.0, 8.8];
const CURVE_TOP = 11.1, CURVE_PARAPET = 10.4, CURVE_FLOORS = [0, 3.0, 5.7, 8.4];
const PAV_TOP = 10.1, PAV = {winY0: 1.8, winY1: 4.1, gallery: 4.3, galleryD: 1.2, upY0: 4.75, upY1: 8.75, transom: 6.9};
const BRICK_TOP = 13.3, REST_TOP = 5.9;

// ---- pieces ------------------------------------------------------------------------------------------------------------------
const roofRing = (i: number): Pt[][] => SRC.roofs[i].map(r => r.map(v => [v[0], v[2]] as Pt));
const roofTop = (i: number) => Math.max(...SRC.roofs[i][0].map(v => v[1]));
const closed = (r: Pt[]): Pt[] => [...r, r[0]];
const asPoly = (rings: Pt[][]): Polygon => rings.map(closed);
const openR = (r: Pt[]): Pt[] => (r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
/** Half-plane w.p > c (or < c) as a big quad, for splitting the tower piece. */
function halfPlane(w: Pt, c: number, above: boolean): Polygon {
  const u: Pt = [-w[1], w[0]], s = above ? 1 : -1, p0: Pt = [w[0] * c, w[1] * c], R = 200;
  const q = (a: number, b: number): Pt => [p0[0] + u[0] * a + w[0] * b * s, p0[1] + u[1] * a + w[1] * b * s];
  return [[q(-R, 0), q(R, 0), q(R, R), q(-R, R), q(-R, 0)]];
}
type ZPiece = Piece & {zone: Zone};
/**
 * Drops spike vertices (the ring folds back on itself at under 25 deg): 3DBAG pieces carry thin arms a decimetre wide along a
 * neighbouring piece's edge, which would stand a wall a few centimetres in front of that piece's wall.
 */
function despike(r: Pt[]): Pt[] {
  let ring = r.slice();
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
export function pieces(): ZPiece[] {
  const groups: [Zone, number[], number][] = [
    ['link', [4], LINK_TOP], ['slab', [28, 34, 33, 7], PENT], ['plant', [16], 26.0], ['plant', [27], 25.6], ['low', [29, 2], 5.5], ['curve', [36], CURVE_TOP], ['pav', [19, 12], PAV_TOP], ['brick', [32], BRICK_TOP], ['rest', [26], REST_TOP],
  ];
  const used = new Set([...groups.flatMap(g => g[1]), 1, 13]);
  const out: ZPiece[] = [];
  // 3DBAG pieces overlap by a few decimetres in places (the slab and the glass link): each ground piece keeps only what the
  // pieces before it have not taken, so no two walls coincide
  let taken: MultiPolygon = [];
  const addMp = (mp: MultiPolygon, zone: Zone, base: number, top: number): MultiPolygon => {
    if (base === 0) {
      const own = taken.length ? polygonClipping.difference(mp, taken) : mp;
      taken = taken.length ? polygonClipping.union(taken, mp) : mp;
      mp = own;
    }
    for (const poly of mp) {
      const ring = despike(openR(poly[0] as Pt[]));
      if (Math.abs(ring.reduce((a, p, i) => { const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 < 0.3) continue;
      out.push({ring, holes: poly.slice(1).map(r => openR(r as Pt[])), base, top, zone});
    }
    return mp;
  };
  for (const [zone, ids, top] of groups) {
    const mp = polygonClipping.union(...ids.map(i => asPoly(roofRing(i))) as [Polygon, ...Polygon[]]);
    const own = addMp(mp, zone, 0, top);
    if (zone !== 'slab') continue;
    addMp(own, 'pent', PENT, SLAB_TOP);
    // the lift tower piece: the beige stair tower on its north-east (canal) side, the dark tower behind
    const W: Pt = [0.763, -0.647], tower = asPoly(roofRing(1));
    addMp(polygonClipping.intersection(tower, halfPlane(W, 9.9, true)), 'stair', 0, STAIR_TOP);
    addMp(polygonClipping.intersection(tower, halfPlane(W, 9.9, false)), 'tower', 0, TOWER_TOP);
  }
  SRC.roofs.forEach((_, i) => { if (!used.has(i)) addMp([asPoly(roofRing(i))], 'low', 0, Math.round(roofTop(i) * 10) / 10); });
  return out;
}

// ---- faces -------------------------------------------------------------------------------------------------------------------
type Ctx = {f: Frame; len: number; y0: number; y1: number; zone: Zone; top: number; mid: Pt; bearing: number; party: boolean};
let FACES: CutFace[] = [];
function mk(c: Ctx, y0: number, y1: number, col: Col): CutFace | null {
  const a = Math.max(c.y0, y0), z = Math.min(c.y1, y1);
  if (z - a < 0.02) return null;
  const F: CutFace = {f: c.f, len: c.len, y0: a, y1: z, c: col, holes: []}; FACES.push(F); return F;
}
/** Run to frame: tangent to the viewer's right, so (t, up, n) is right-handed. */
function runCtx(r: Run, y0: number, y1: number, p: ZPiece): Ctx {
  let a = r.a, b = r.b;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let t: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  if (-t[1] * r.n[0] + t[0] * r.n[1] < 0) { [a, b] = [b, a]; t = [-t[0], -t[1]]; }
  const bearing = ((Math.atan2(r.n[0], -r.n[1]) * 180 / Math.PI) + 360) % 360;
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], probe: Pt = [mid[0] + r.n[0] * 0.25, mid[1] + r.n[1] * 0.25];
  // against the Apollohal, or into the 2.5 x 4 m light well (the BAG ring's first hole): no openings
  const party = SRC.neighbours.some(n => y0 < n.height && inRing(n.ring, probe[0], probe[1])) || inRing(SRC.rings[1], probe[0], probe[1]);
  return {f: {origin: a, tangent: t, n: r.n}, len, y0, y1, zone: p.zone, top: p.top, mid, bearing, party};
}
const tAt = (c: Ctx, y: number) => y >= c.y0 - 1e-6 && y <= c.y1 + 1e-6;
function band(b: BuildingTools, c: Ctx, y: number, h: number, d: number, col: Col) {
  if (y < c.y0 - 0.01 || y + h > c.y1 + 0.01 || c.len < 1) return;
  (c.len > 6 ? slab : ledgeStrip)(b, c.f, c.len / 2, y, c.len, h, d, col);
}
/** Glazing bars inside a cut opening: from its back (o = -depth) to 2 cm behind the wall plane. */
function bars(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, depth: number, every: number, col: Col) {
  const n = Math.round((t1 - t0) / every);
  for (let k = 1; k < n; k++) (y1 - y0 > 8 ? slab : ledgeStrip)(b, f, t0 + (t1 - t0) * k / n, y0, 0.06, y1 - y0, depth - 0.02, col, -depth);
}

// ---- facade rules per part ---------------------------------------------------------------------------------------------------
const sill = (k: number) => SB + FH * k + 0.15;
function slabFace(b: BuildingTools, c: Ctx) {
  mk(c, 0, SB, 'red');
  const wall = mk(c, SB, PENT, 'brick');
  const kind = c.len >= 1.95 && c.len <= 2.7 ? 'bay' : c.len < 0.9 ? 'cheek' : c.len < 1.95 ? 'pier' : 'end';
  for (let k = 0; k <= NF; k++) band(b, c, SB + FH * k - 0.07, 0.14, 0.09, 'stone');
  if (kind === 'bay') {
    if (wall) for (let k = 0; k < NF; k++) {
      const s = sill(k), t0 = 0.12, t1 = c.len - 0.12;
      if (!hole(wall, t0, t1, s, s + 0.55, 0.05, 'white')) continue;
      if (!hole(wall, t0, t1, s + 0.62, s + 2.6, 0.12, 'glass')) continue;
      border(b, c.f, c.len / 2, s, t1 - t0, 2.6, 0.06, 0.09, 'frame');
      ledgeStrip(b, c.f, c.len / 2, s + 0.55, t1 - t0, 0.07, 0.09, 'frame');
      bars(b, c.f, t0, t1, s + 0.62, s + 2.6, 0.12, (t1 - t0) / 2, 'frame');
    }
  } else if (kind === 'end' && wall) {
    const street = c.bearing > 290 && c.bearing < 345 && c.len > 10;
    const ts = street ? 7.85 : c.len / 2;
    for (let k = 0; k < NF; k++) { const s = sill(k); if (hole(wall, ts - 0.27, ts + 0.27, s + 0.1, s + 2.6, 0.12, 'glass')) border(b, c.f, ts, s + 0.1, 0.54, 2.5, 0.05, 0.09, 'frame'); }
    if (street) streetSigns(b, c);
  }
}
/** The NW end on the street (w07-321, rectified 50 px/m): the two boards, APOLLO HOTEL and the red A. */
function streetSigns(b: BuildingTools, c: Ctx) {
  const yb = SB + FH * 3;
  slab(b, c.f, 3.7, yb + 0.3, 7.2, 2.3, 0.08, 'bronze');
  letters(b, c.f, 'HARBOUR CLUB', 3.9, yb + 1.15, 0.08, 0.05, 0.03, 'gold');
  slab(b, c.f, 10.3, yb + 0.3, 3.3, 2.3, 0.08, 'blue');
  letters(b, c.f, 'APOLLO HOTEL', 3.8, yb - 2.05, 0.0, 0.08, 0.05, 'gold');
  letters(b, c.f, 'A', 10.25, yb - 2.75, 0.0, 0.3, 0.12, 'pink', 0.24);
}
/** Top storey: glazed over the bays and piers of the long faces under a cream fascia and parapet; the end walls run up in brick with the stair slit. */
function pentFace(b: BuildingTools, c: Ctx) {
  const end = c.len > 2.7, F = mk(c, PENT, SLAB_TOP, end ? 'brick' : 'stone'), g1 = SLAB_TOP - 1.25;
  if (!F) return;
  if (end) {
    const street = c.bearing > 290 && c.bearing < 345 && c.len > 10, ts = street ? 7.85 : c.len / 2;
    if (hole(F, ts - 0.27, ts + 0.27, PENT + 0.25, g1, 0.12, 'glass')) border(b, c.f, ts, PENT + 0.25, 0.54, g1 - PENT - 0.25, 0.05, 0.09, 'frame');
  } else if (hole(F, 0.05, c.len - 0.05, PENT + 0.25, g1, 0.12, 'glass')) bars(b, c.f, 0.05, c.len - 0.05, PENT + 0.25, g1, 0.12, 1.3, 'frame');
  band(b, c, SLAB_TOP - 0.35, 0.35, 0.12, 'stone');
}
function towerFace(b: BuildingTools, c: Ctx) {
  mk(c, 0, c.y1, 'copper');
  const n = Math.max(1, Math.round(c.len / 0.75));
  for (let k = 0; k <= n; k++) slab(b, c.f, Math.min(c.len - 0.07, Math.max(0.07, c.len * k / n)), c.y0, 0.12, c.y1 - c.y0, 0.12, 'copper');
  if (c.bearing > 40 && c.bearing < 160 && c.len > 2 && tAt(c, 24.3)) letters(b, c.f, 'A', c.len / 2, 24.3, 0.12, 0.3, 0.15, 'pink', 0.3);
}
function stairFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, c.y1, 'sandstone');
  for (let k = 0; k <= NF; k++) { band(b, c, SB + FH * k - 0.07, 0.14, 0.09, 'stone'); band(b, c, SB + FH * k + 0.3, 0.1, 0.09, 'stone'); }
  if (F && c.len > 1.5) for (let k = 0; k < NF; k++) { const y = SB + FH * k + 1.3; if (hole(F, c.len / 2 - 0.45, c.len / 2 + 0.45, y, y + 0.5, 0.1, 'glass')) border(b, c.f, c.len / 2, y, 0.9, 0.5, 0.05, 0.09, 'frame'); }
  band(b, c, STAIR_TOP - 0.3, 0.3, 0.08, 'stone');
}
function linkFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, LINK_TOP, 'stone');
  if (!F) return;
  LINK_FLOORS.forEach((y, i) => {
    const y1 = (LINK_FLOORS[i + 1] ?? LINK_TOP - 0.5) - 0.2;
    if (hole(F, 0.08, c.len - 0.08, y + 0.15, y1, 0.14, 'glass')) bars(b, c.f, 0.08, c.len - 0.08, y + 0.15, y1, 0.14, 1.3, 'frame');
  });
}
function curveFace(b: BuildingTools, c: Ctx) {
  if (c.len > 6.5) return brickBlock(b, c, CURVE_TOP, CURVE_FLOORS);
  const F = mk(c, 0, CURVE_PARAPET, 'stone');
  mk(c, CURVE_PARAPET, CURVE_TOP, 'greyBrick');
  if (!F) return;
  const lounge = c.mid[1] > 30;
  for (const fy of CURVE_FLOORS) {
    if (fy === 0 && lounge) {
      if (hole(F, 0.05, c.len - 0.05, 0.3, 2.6, 0.3, 'glass')) bars(b, c.f, 0.05, c.len - 0.05, 0.3, 2.6, 0.3, 1.2, 'frame');
      if (tAt(c, 2.62) && tAt(c, 2.92)) ledgeStrip(b, c.f, c.len / 2, 2.62, c.len, 0.3, 0.1, 'copper');
      continue;
    }
    const y0 = fy === 0 ? 0.6 : fy + 0.25;
    hole(F, 0.07, c.len - 0.07, y0, fy + 0.95, 0.05, 'slate');
    if (hole(F, 0.07, c.len - 0.07, fy + 1.02, fy + 2.5, 0.12, 'glass')) bars(b, c.f, 0.07, c.len - 0.07, fy + 1.02, fy + 2.5, 0.12, c.len / 2, 'stone');
  }
}
/** Brown-brick end block: white floor bands, the stair window strip in the middle, a glass door at the foot. */
function brickBlock(b: BuildingTools, c: Ctx, top: number, floors: number[]) {
  const F = mk(c, 0, top, 'greyBrick');
  for (const fy of floors.slice(1)) band(b, c, fy - 0.1, 0.2, 0.09, 'stone');
  band(b, c, top - 0.3, 0.3, 0.09, 'stone');
  if (!F || c.len < 2.5) return;
  floors.forEach((fy, i) => {
    const y1 = (floors[i + 1] ?? top - 0.3) - 0.3, y0 = fy === 0 ? 0.0 + 0.05 : fy + 0.25;
    if (hole(F, c.len / 2 - 0.5, c.len / 2 + 0.5, y0, y1, 0.12, fy === 0 ? 'dark' : 'glass')) border(b, c.f, c.len / 2, y0, 1.0, y1 - y0, 0.05, 0.09, 'frame');
  });
}
/** The Boeken pavilion: struts, gallery, upper glass room, overhanging roof (w01-141, rectified 50 px/m). */
function pavFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, PAV_TOP, 'stone');
  if (!F || c.len < 1.5 || c.y0 > 0.01 || c.y1 < PAV_TOP - 0.01) return;
  const front = c.len > 20 && c.bearing > 120 && c.bearing < 160;
  // the canal front: five bays from 2.1 to 18.2 m, then the solid stretch with the two portholes (w01-141 at 50 px/m)
  const [b0, b1] = front ? [2.1, 18.2] : [0.2, c.len - 0.2];
  const nb = Math.max(1, Math.round((b1 - b0) / 3.25)), bw = (b1 - b0) / nb;
  for (let i = 0; i < nb; i++) {
    const t0 = b0 + bw * i + 0.2, t1 = b0 + bw * (i + 1) - 0.2;
    if (hole(F, t0, t1, PAV.winY0, PAV.winY1, 0.12, 'glass')) bars(b, c.f, t0, t1, PAV.winY0, PAV.winY1, 0.12, 1.6, 'frame');
  }
  if (front) for (const t of [20.0, 23.3]) porthole(b, c.f, t, 2.95, 0.78);
  // raking struts at the piers, the gallery deck and its rail
  for (let i = front ? 0 : 1; i < nb + (front ? 1 : 0); i++) strut(b, c.f, b0 + bw * i);
  if (front) for (const t of [21.65, 25.0]) strut(b, c.f, t);
  slab(b, c.f, c.len / 2, PAV.gallery, c.len, 0.3, PAV.galleryD, 'stone');
  slab(b, c.f, c.len / 2, PAV.gallery + 1.05, c.len, 0.06, 0.06, 'stone', PAV.galleryD - 0.08);
  for (let t = 0.1; t < c.len; t += 1.5) slab(b, c.f, t, PAV.gallery + 0.3, 0.05, 0.75, 0.05, 'stone', PAV.galleryD - 0.08);
  if (hole(F, 0.1, c.len - 0.1, PAV.upY0, PAV.upY1, 0.12, 'glass')) {
    bars(b, c.f, 0.1, c.len - 0.1, PAV.upY0, PAV.upY1, 0.12, 1.65, 'frame');
    ledgeStrip(b, c.f, c.len / 2, PAV.transom, c.len - 0.2, 0.07, 0.1, 'frame', -0.12);
  }
  slab(b, c.f, c.len / 2, PAV_TOP - 0.25, c.len, 0.25, PAV.galleryD, 'stone');
}
function strut(b: BuildingTools, f: Frame, t: number) {
  const o0 = 0.05, o1 = PAV.galleryD - 0.1, y0 = PAV.winY0 - 0.1, y1 = PAV.gallery, L = Math.hypot(o1 - o0, y1 - y0);
  const g = new T.BoxGeometry(0.1, L, 0.1).rotateX(Math.atan2(o1 - o0, y1 - y0)).translate(0, (y0 + y1) / 2, (o0 + o1) / 2);
  put(b, f, g, t, 0, 0, 'stone');
}
function porthole(b: BuildingTools, f: Frame, t: number, y: number, r: number) {
  // the pane is a dark disc (copper slot), not glass: an applied porthole is not a cut opening for the window audits
  put(b, f, new T.CylinderGeometry(r, r, 0.1, 20).rotateX(Math.PI / 2).translate(0, y, 0.05), t, 0, 0, 'copper');
  put(b, f, new T.TorusGeometry(r, 0.07, 4, 20).translate(0, y, 0.1), t, 0, 0, 'stone');
}
function restFace(b: BuildingTools, c: Ctx) {
  const F = mk(c, 0, REST_TOP, 'stone');
  if (!F || c.len < 1.5 || c.y0 > 0.01 || c.y1 < REST_TOP - 0.01) return;
  const nb = Math.max(1, Math.round(c.len / 2.6)), bw = c.len / nb;
  for (let i = 0; i < nb; i++) hole(F, bw * i + 0.1, bw * (i + 1) - 0.1, 0.9, 4.4, 0.14, 'glass');
  slab(b, c.f, c.len / 2, REST_TOP + 0.95, c.len, 0.06, 0.06, 'stone', -0.1);
  for (let t = 0.1; t < c.len; t += 1.5) slab(b, c.f, t, REST_TOP, 0.05, 0.95, 0.05, 'stone', -0.1);
}
function lowFace(b: BuildingTools, c: Ctx) {
  if (c.top >= 7.5) return brickBlock(b, c, c.top, c.top > 10 ? [0, 3.4, 6.6] : [0, 3.4]);
  const F = mk(c, 0, c.top, 'greyBrick');
  band(b, c, c.top - 0.35, 0.35, 0.09, 'stone');
  if (F && c.len > 1.5 && c.top > 3.4) hole(F, 0.15, c.len - 0.15, 0.8, Math.min(c.top - 0.6, 3.0), 0.14, 'glass');
}
function plantFace(_b: BuildingTools, c: Ctx) { mk(c, c.y0, c.y1, 'concrete'); }

const PLAIN: Record<Zone, Col> = {slab: 'brick', pent: 'stone', plant: 'concrete', tower: 'copper', stair: 'sandstone', link: 'stone', curve: 'stone', pav: 'stone', brick: 'greyBrick', rest: 'stone', low: 'greyBrick'};
const RULES: Record<Zone, (b: BuildingTools, c: Ctx) => void> = {
  slab: slabFace, pent: pentFace, plant: plantFace, tower: towerFace, stair: stairFace, link: linkFace,
  curve: curveFace, pav: pavFace, brick: (b, c) => brickBlock(b, c, BRICK_TOP, [0, 4.6, 8.0, 10.6]), rest: restFace, low: lowFace,
};

// ---- roofs -------------------------------------------------------------------------------------------------------------------
function cap(b: BuildingTools, p: Piece, y: number, col: Col) {
  const shape = new T.Shape(p.ring.map(([x, z]) => new T.Vector2(x, z)));
  for (const h of p.holes ?? []) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
  const sg = new T.ShapeGeometry(shape).toNonIndexed(), q = sg.getAttribute('position'), out: number[] = [];
  for (let i = 0; i < q.count; i += 3) {
    const v = [0, 1, 2].map(j => [q.getX(i + j), y, q.getY(i + j)]);
    const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
    out.push(...v[0], ...(ny > 0 ? [...v[1], ...v[2]] : [...v[2], ...v[1]]));
  }
  b.add(geomOf(out), col);
}

export function buildApolloHotel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  FACES = [];
  const P = pieces();
  const levels = [...new Set(P.flatMap(p => [p.base, p.top]))].sort((a, c) => a - c);
  // merge the same exposed run across consecutive height intervals into one face
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
  for (const {r, y0, y1} of done) {
    const c = runCtx(r, y0, y1, P[r.piece]);
    // against the Apollohal (party wall) and on slivers: plain wall in the part's colour
    if (c.party || c.len < 0.3) mk(c, y0, y1, PLAIN[c.zone]); else RULES[c.zone](b, c);
  }
  b.mark?.('facades');
  for (const p of P) if (p.zone !== 'slab') cap(b, p, p.top, p.zone === 'plant' ? 'concrete' : p.zone === 'tower' ? 'copper' : 'concrete');
  b.mark?.('roofs');
  flushCutFaces(b, FACES);
  FACES = [];
  b.mark?.('walls');
}
