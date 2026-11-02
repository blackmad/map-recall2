import * as T from 'three';
import polygonClipping, {type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {letters, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {runFrame} from './plan-prism';
import {exposedRuns, inRing, signedArea, type Piece, type Pt, type Run} from '../../src/canalRecall/landmarks/terraceBands';
import source from './byzantium-footprints.json';

/**
 * Byzantium, Stadhouderskade / Tesselschadestraat at the Vondelpark gate (OMA, Rem Koolhaas with Kees Christiaanse and Ron
 * Steiner, 1985-1991; nl.wikipedia "Byzantium (gebouw)"). Four BAG pands of 1991 (scripts/landmarks/byzantium-prepare.ts):
 * the main block 0363100012135250, the office tower 0363100012236811, the low block on the Tesselschadestraat
 * 0363100012073194 and the shop gallery with the drum 0363100012233595. Native east/south metres from the main pand's vertex
 * average, y above the street (0.30 m NAP).
 *
 * Massing: one closed prism per 3DBAG LoD2.2 roof piece (CC BY 4.0) of the four pands, the slab's top storey cut back 2 m from
 * the Stadhouderskade front (the parapet at 22.5 m is the 3DBAG piece beside it). Read on the Commons photographs
 * ByzantiumStadhouderskade-1a.jpg (Milliped 2015, CC BY-SA 4.0; crop scale 0.039 m/px), Amsterdam - Byzantium (29670468754)
 * and (30214768781) (Fred Romero 2016, CC BY 2.0) and the Gemeente Amsterdam panoramas listed in byzantium-inventory.json:
 *  - the Stadhouderskade front is one straight line 56 m long: from the park end 29.4 m of blue-grey tiled slab with six
 *    storeys of large white-framed windows each paired with a small square one, the pairs alternately narrow (rows A) and wide
 *    (rows B) so the rows stagger; a set-back top storey behind a railing; then a two-bay strip of the tower grid; then the
 *    tower, a dark frame grid of five bays and twelve storeys over a shop storey, its flank over the slab blank cream panels;
 *  - the gold-edged shop gallery in front of the slab, its roof rising from 4.2 to 6.1 m towards the park (3DBAG), the
 *    arcade with round columns at its park end, BYZANTIUM in spaced chrome capitals on the entrance canopy by the tower;
 *  - the round gold penthouse cantilevered from the slab's park-end corner over the street: saucer underside, gold band,
 *    glazed storey, gold roof fascia, a slender column and a diagonal strut (centre and radius from the 3DBAG drum roof
 *    pieces at 26.0 m and the orthophoto circle);
 *  - on the Tesselschadestraat the low brick shop block behind a black portal frame, the slab above in pale bands with dark
 *    window ribbons; the west end grey with square windows; the courtyard and park faces white with balcony bands.
 * INFERRED: the window ribbons and balconies of the courtyard faces (seen only from the park through trees), the tower's
 * south-west face, the fire-escape landings' count.
 */
type Ring3 = number[][];
type Src = {
  rings: Record<string, number[][][]>;
  roofs: Record<string, Ring3[][]>;
  neighbours: {id: string; height: number; ring: number[][]}[];
};
const src = source as unknown as Src;
type B = BuildingTools & {mark?: (n: string) => void};

const open = (r: Ring3) => (r.length > 1 && r[0].every((v, i) => v === r.at(-1)![i]) ? r.slice(0, -1) : r);
const plan = (r: Ring3): Pt[] => open(r).map(p => [p[0], p[2]] as Pt);
const topOf = (r: Ring3) => Math.max(...r.map(p => p[1]));

// ---- the Stadhouderskade front: one straight line from the slab's park-end corner to the tower's north corner
const P0: Pt = [60.7, 3.8], P1: Pt = [38.5, -47.4];
const FL = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
const FRONT: Frame = {origin: P0, tangent: [(P1[0] - P0[0]) / FL, (P1[1] - P0[1]) / FL], n: [-(P1[1] - P0[1]) / FL, (P1[0] - P0[0]) / FL]};
const fT = (p: Pt) => (p[0] - P0[0]) * FRONT.tangent[0] + (p[1] - P0[1]) * FRONT.tangent[1];
const fO = (p: Pt) => (p[0] - P0[0]) * FRONT.n[0] + (p[1] - P0[1]) * FRONT.n[1];
const fP = (t: number, o: number): Pt => [P0[0] + FRONT.tangent[0] * t + FRONT.n[0] * o, P0[1] + FRONT.tangent[1] * t + FRONT.n[1] * o];
const shift = (f: Frame, o: number, t = 0): Frame => ({...f, origin: [f.origin[0] + f.n[0] * o + f.tangent[0] * t, f.origin[1] + f.n[1] * o + f.tangent[1] * t]});
/** Slab end of the tiled front, start and end of the tower front (metres along FRONT from the park end). */
const SLAB_END = 29.4, TOWER_T0 = 35.9, TOWER_T1 = FL;
const PARAPET = 22.5, SETBACK_TOP = 25.4, SETBACK = 2.0;
/** Tower: shop storey to 5.0 m, then twelve storeys of 2.825 m to the 38.9 m roof (3DBAG). */
const TOWER = {y0: 5.0, pitch: 2.825, rows: 12, top: 38.9};
const NW: Pt = [-0.397, -0.918];

// ---- roof pieces by zone (indices into the 3DBAG RoofSurface lists of byzantium-footprints.json)
const SLAB_MAIN = [7, 34, 35, 4, 1, 19, 17, 28];
const WINGS = [11, 38, 42, 2, 18, 20, 21];
const TOWERISH_MAIN = [0, 3];
const CREAM_MAIN = [26];
const DRUM_MAIN = 30, M29 = 29, LAWN = 5;

/** The 25.4 m slab piece split: the 2 m strip behind the front (parapet height) and the set-back top storey. */
function splitM29(): {strip: Pt[][]; rest: Pt[][]} {
  const r = plan(src.roofs.main[M29][0]);
  const band: Polygon = [[fP(-5, -SETBACK), fP(TOWER_T0 + 5, -SETBACK), fP(TOWER_T0 + 5, 5), fP(-5, 5), fP(-5, -SETBACK)]];
  const poly: Polygon = [[...r, r[0]]];
  const strip = polygonClipping.intersection(poly, band).map(p => p[0].slice(0, -1) as Pt[]);
  const rest = polygonClipping.difference(poly, band).map(p => p[0].slice(0, -1) as Pt[]);
  return {strip, rest};
}
const flatRing = (r: Pt[], y: number): Ring3[] => [r.map(p => [p[0], y, p[1]])];

/** Least-squares plane y = a x + c z + d through a roof ring (the gallery roof slopes 4.2 to 6.1 m). */
function planeOf(r: Ring3) {
  const n = r.length, sx = r.reduce((s, p) => s + p[0], 0) / n, sz = r.reduce((s, p) => s + p[2], 0) / n, sy = r.reduce((s, p) => s + p[1], 0) / n;
  let xx = 0, xz = 0, zz = 0, xy = 0, zy = 0;
  for (const p of r) { const x = p[0] - sx, z = p[2] - sz, y = p[1] - sy; xx += x * x; xz += x * z; zz += z * z; xy += x * y; zy += z * y; }
  const det = xx * zz - xz * xz, a = (xy * zz - zy * xz) / det, c = (zy * xx - xy * xz) / det;
  return (x: number, z: number) => sy + a * (x - sx) + c * (z - sz);
}

/** Closed prism over a plan polygon from y0 to a top that follows topAt per vertex (walls, roof up, soffit down). */
function slopedSlab(b: B, ring: Pt[], y0: (x: number, z: number) => number, y1: (x: number, z: number) => number, wall: string, roof: string, soffit: string) {
  const s = Math.sign(ring.reduce((a, p, i) => { const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
  const tri = (into: number[], A: number[], C: number[], D: number[], want: number[]) => {
    const u = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], v = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (nn[0] * want[0] + nn[1] * want[1] + nn[2] * want[2] >= 0) into.push(...A, ...C, ...D); else into.push(...A, ...D, ...C);
  };
  const walls: number[] = [], top: number[] = [], bot: number[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length], out = [s * (q[1] - p[1]), 0, -s * (q[0] - p[0])];
    const A = [p[0], y0(p[0], p[1]), p[1]], Bq = [q[0], y0(q[0], q[1]), q[1]], C = [q[0], y1(q[0], q[1]), q[1]], D = [p[0], y1(p[0], p[1]), p[1]];
    tri(walls, A, Bq, C, out); tri(walls, A, C, D, out);
  });
  const at = (k: number, f: (x: number, z: number) => number) => [ring[k][0], f(ring[k][0], ring[k][1]), ring[k][1]];
  for (const [i, j, k] of T.ShapeUtils.triangulateShape(ring.map(p => new T.Vector2(p[0], p[1])), [])) {
    tri(top, at(i, y1), at(j, y1), at(k, y1), [0, 1, 0]);
    tri(bot, at(i, y0), at(j, y0), at(k, y0), [0, -1, 0]);
  }
  b.add(geom(walls), wall as never);
  const g = geom(top); g.userData.role = 'roof'; b.add(g, roof as never);
  b.add(geom(bot), soffit as never);
}
function geom(pos: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------------------------- massing
function massing(b: B) {
  const {strip, rest} = splitM29();
  for (const r of strip) roofPrism(b, flatRing(r, PARAPET), 'concrete', 'slate');
  for (const r of rest) roofPrism(b, flatRing(r, SETBACK_TOP), 'concrete', 'slate');
  src.roofs.main.forEach((poly, i) => {
    if (i === M29) return;
    if (i === DRUM_MAIN) { roofPrism(b, flatRing(plan(poly[0]), PARAPET), 'concrete', 'slate'); return; }
    const top = topOf(poly[0]);
    if (top < 0.6) return;
    if (SLAB_MAIN.includes(i)) roofPrism(b, poly, 'concrete', 'slate');
    else if (WINGS.includes(i)) roofPrism(b, poly, 'pink', 'slate');
    else if (TOWERISH_MAIN.includes(i)) roofPrism(b, poly, 'stone', 'slate');
    else if (CREAM_MAIN.includes(i)) roofPrism(b, poly, 'stone', 'slate');
    else roofPrism(b, poly, 'bronze', i === LAWN ? 'green' : 'concrete');
  });
  src.roofs.tower.forEach((poly, i) => {
    const top = topOf(poly[0]);
    roofPrism(b, poly, top > 39.5 ? 'concrete' : top > 20 ? 'stone' : 'bronze', 'slate');
  });
  roofPrism(b, src.roofs.tess[0], 'brick', 'slate');
  b.mark?.('massing');
}

/** Every massing piece as a terraceBands Piece (the drum pieces excluded: the drum floats). */
function pieces(): {pieces: Piece[]; zone: string[]} {
  const out: Piece[] = [], zone: string[] = [];
  const {strip, rest} = splitM29();
  for (const r of strip) { out.push({ring: r, base: 0, top: PARAPET}); zone.push('slab'); }
  for (const r of rest) { out.push({ring: r, base: 0, top: SETBACK_TOP}); zone.push('slab'); }
  src.roofs.main.forEach((poly, i) => {
    if (i === M29) return;
    if (i === DRUM_MAIN) { out.push({ring: plan(poly[0]), base: 0, top: PARAPET}); zone.push('slab'); return; }
    const top = topOf(poly[0]);
    if (top < 0.6) return;
    out.push({ring: plan(poly[0]), base: 0, top});
    zone.push(SLAB_MAIN.includes(i) ? 'slab' : WINGS.includes(i) ? 'wing' : TOWERISH_MAIN.includes(i) ? 'tower' : CREAM_MAIN.includes(i) ? 'cream' : 'low');
  });
  src.roofs.tower.forEach(poly => { const top = topOf(poly[0]); out.push({ring: plan(poly[0]), base: 0, top}); zone.push(top > 39.5 ? 'plant' : top > 20 && top < 30 ? 'cream' : 'tower'); });
  out.push({ring: plan(src.roofs.tess[0][0]), base: 0, top: topOf(src.roofs.tess[0][0])}); zone.push('tess');
  out.push({ring: plan(src.roofs.park[1][0]), base: 0, top: topOf(src.roofs.park[1][0])}); zone.push('gallery');
  return {pieces: out, zone};
}
/** Is a run still exposed at height y (start, middle, end, 0.3 m outside)? Glass must not run down behind a lower roof. */
function clearAt(P: Piece[], r: Run, y: number) {
  for (const u of [0.15, 0.5, 0.85]) {
    const x = r.a[0] + (r.b[0] - r.a[0]) * u + r.n[0] * 0.3, z = r.a[1] + (r.b[1] - r.a[1]) * u + r.n[1] * 0.3;
    if (P.some((p, i) => i !== r.piece && p.top > y && inRing(p.ring, x, z)) || blocked(x, z, y)) return false;
  }
  return true;
}
const blocked = (x: number, z: number, y: number) => src.neighbours.some(nb => y < nb.height && inRing(nb.ring as Pt[], x, z));
const dot = (a: Pt, c: Pt) => a[0] * c[0] + a[1] * c[1];
const onFront = (r: Run) => Math.abs(fO(r.a)) < 0.6 && Math.abs(fO(r.b)) < 0.6 && dot(r.n, FRONT.n) > 0.95;
const onSetback = (r: Run) => Math.abs(fO(r.a) + SETBACK) < 0.3 && Math.abs(fO(r.b) + SETBACK) < 0.3 && dot(r.n, FRONT.n) > 0.95;
const onEndWall = (r: Run) => Math.abs(fT(r.a)) < 0.6 && Math.abs(fT(r.b)) < 0.6 && dot(r.n, FRONT.tangent) < -0.95;

// ---------------------------------------------------------------------------------------------------------- facade parts
/** White-framed window (frame bars 0.1 m, `mull` mullions), glass behind, on frame f centred at t. */
function framedWindow(b: B, f: Frame, t: number, yc: number, w: number, h: number, mull: number, out = 0) {
  const y0 = yc - h / 2;
  slab(b, f, t, y0 + 0.05, w - 0.1, h - 0.1, 0.06, 'glass', out);
  slab(b, f, t, y0, w, 0.1, 0.13, 'frame', out);
  slab(b, f, t, y0 + h - 0.1, w, 0.1, 0.13, 'frame', out);
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - 0.05), y0 + 0.1, 0.1, h - 0.2, 0.13, 'frame', out);
  for (let k = 1; k <= mull; k++) slab(b, f, t - w / 2 + w * k / (mull + 1), y0 + 0.1, 0.07, h - 0.2, 0.11, 'frame', out);
}

/** Rows of the tiled front (centres, bottom to top) and their type: A narrow pairs, B wide pairs (Commons crop, 0.039 m/px). */
const FRONT_ROWS: [number, 'A' | 'B'][] = [[6.98, 'B'], [10.07, 'A'], [13.2, 'B'], [16.0, 'A'], [18.97, 'B'], [21.7, 'A']];
const PAIRS = {
  A: {big: [5.8, 12.8, 19.3, 25.3], bigW: 2.1, bigH: 1.37, small: [8.3, 15.1, 21.5, 27.25], smallW: 0.6},
  B: {big: [6.0, 13.05, 19.5, 25.5], bigW: 2.5, bigH: 1.45, small: [9.3, 16.1, 22.2, 28.1], smallW: 0.75},
};
function slabFront(b: B) {
  const CLAD = 0.12;
  // blue-grey tile cladding over the slab front above the gallery roof, and the setback storey's front
  slab(b, FRONT, (SLAB_END - 0.12) / 2, 4.0, SLAB_END + 0.12, PARAPET - 4.0 + 0.2, CLAD, 'greyBrick');
  for (const [yc, kind] of FRONT_ROWS) {
    const p = PAIRS[kind];
    for (const t of p.big) framedWindow(b, FRONT, t, yc, p.bigW, p.bigH, 2, CLAD);
    for (const t of p.small) framedWindow(b, FRONT, t, yc, p.smallW, p.smallW, 0, CLAD);
  }
  // set-back top storey: wide window pairs, a dark railing on the parapet
  const SB = shift(FRONT, -SETBACK);
  for (const [t0, t1] of [[10.8, 12.2], [13.9, 15.3], [18.0, 21.4], [24.1, 27.0], [29.8, 35.4]]) framedWindow(b, SB, (t0 + t1) / 2, 23.85, t1 - t0, 1.5, Math.max(1, Math.round((t1 - t0) / 1.2) - 1));
  railing(b, shift(FRONT, -0.35), 0.2, TOWER_T0 - 0.2, PARAPET);
  // the two-bay strip of the tower grid between the slab and the tower, up to the parapet
  towerGrid(b, FRONT, SLAB_END, TOWER_T0, 2, 6, false);
}

/** Dark railing: posts every 1.5 m, a top and a mid rail, standing on y from t0 to t1 of frame f. */
function railing(b: B, f: Frame, t0: number, t1: number, y: number, h = 1.05) {
  const n = Math.max(1, Math.round((t1 - t0) / 1.5));
  for (let k = 0; k <= n; k++) slab(b, f, t0 + (t1 - t0) * k / n, y, 0.06, h, 0.06, 'bronze');
  for (const r of [h - 0.06, h * 0.5]) slab(b, f, (t0 + t1) / 2, y + r, t1 - t0, 0.06, 0.06, 'bronze');
}

/**
 * Tower grid on frame f from t0 to t1: `bays` equal bays, storeys of TOWER.pitch from TOWER.y0; dark frame piers and floor
 * beams 0.32 m proud of the wall, each cell a white spandrel band over the floor beam and glass above it; `plinth` glazes the
 * shop storey below y0 between the piers. Rows below `fromRow` are left out (covered by a lower roof).
 */
function towerGrid(b: B, f: Frame, t0: number, t1: number, bays: number, rows: number, plinth: boolean, fromRow = 0) {
  const bw = (t1 - t0) / bays, P = TOWER.pitch, PIER = 0.5, BEAM = 0.42, D = 0.32;
  const yBot = plinth ? 0 : TOWER.y0 + fromRow * P, yTop = TOWER.y0 + rows * P;
  for (let k = 0; k <= bays; k++) slab(b, f, t0 + k * bw + (k === 0 ? PIER / 2 + 0.25 : k === bays ? -PIER / 2 - 0.25 : 0), yBot, PIER, yTop - yBot, D, 'bronze');
  for (let r = fromRow; r < rows; r++) slab(b, f, (t0 + t1) / 2, TOWER.y0 + r * P, t1 - t0 - 0.9, BEAM, D - 0.1, 'bronze');
  slab(b, f, (t0 + t1) / 2, yTop, t1 - t0 - 0.06, BEAM, D + 0.04, 'bronze');
  for (let r = fromRow; r < rows; r++) {
    const y = TOWER.y0 + r * P + BEAM;
    for (let k = 0; k < bays; k++) {
      const tc = t0 + (k + 0.5) * bw, w = bw - PIER + 0.1;
      slab(b, f, tc, y, w, 0.55, 0.12, 'white');
      slab(b, f, tc, y + 0.55, w, P - BEAM - 0.6, 0.06, 'glass');
    }
  }
  if (plinth) for (let k = 0; k < bays; k++) slab(b, f, t0 + (k + 0.5) * bw, 0.25, bw - PIER + 0.1, TOWER.y0 - 0.5, 0.06, 'glass');
}

function tower(b: B) {
  // the tower's own 3DBAG roof piece (38.9 m): [0] SE corner by the slab, [1] east, [5]->[6] Tesselschadestraat side,
  // [6]->[7] and [8]->[9] south-west faces over the low block, [10]->[0] over the 25.3 m piece by the slab
  const ring = plan(src.roofs.tower[4][0]);
  // front (Stadhouderskade): five bays from the slab strip to the north corner, the cream pier on its south edge
  towerGrid(b, FRONT, TOWER_T0 + 0.9, TOWER_T1, 5, TOWER.rows, true);
  slab(b, FRONT, TOWER_T0 + 0.45, 0, 0.9, TOWER.top + 0.3, 0.5, 'stone');
  const nw = ringFrame(ring, 5), sw1 = ringFrame(ring, 6), sw2 = ringFrame(ring, 8), sw3 = ringFrame(ring, 10);
  towerGrid(b, nw.f, 0, nw.len, 4, TOWER.rows, true);
  towerGrid(b, sw1.f, 0, sw1.len, 2, TOWER.rows, false, 1);
  towerGrid(b, sw2.f, 0, sw2.len, 2, TOWER.rows, false, 1);
  towerGrid(b, sw3.f, 0, sw3.len, 2, TOWER.rows, false, 8);
  // the south-east flank over the slab is the cream wall of the massing (tower walls and the 3DBAG slivers in 'stone')
  b.mark?.('tower');
}

/** Shop gallery (pand 0363100012233595): glazed shops under a gold-edged roof that rises to the park, arcade at the park end. */
function gallery(b: B) {
  const roof = src.roofs.park[1][0], topAt = planeOf(roof);
  const ring = plan(roof);
  // park-end arcade: the 4 m strip along the gallery's south edge is open under the canopy
  const S0: Pt = [60.7, 3.8], S1: Pt = [75.0, -1.4], sl = Math.hypot(S1[0] - S0[0], S1[1] - S0[1]);
  const st: Pt = [(S1[0] - S0[0]) / sl, (S1[1] - S0[1]) / sl], sn: Pt = [st[1], -st[0]]; // sn points north (into the gallery)
  const sP = (u: number, v: number): Pt => [S0[0] + st[0] * u + sn[0] * v, S0[1] + st[1] * u + sn[1] * v];
  const ARC = 1.5;
  const keep: Polygon = [[sP(-10, ARC), sP(30, ARC), sP(30, 60), sP(-10, 60), sP(-10, ARC)]];
  const arc: Polygon = [[sP(-10, -5), sP(30, -5), sP(30, ARC), sP(-10, ARC), sP(-10, -5)]];
  const poly: Polygon = [[...ring, ring[0]]];
  const shops = polygonClipping.intersection(poly, keep).map(p => p[0].slice(0, -1) as Pt[]);
  const canopy = polygonClipping.intersection(poly, arc).map(p => p[0].slice(0, -1) as Pt[]);
  for (const r of shops) slopedSlab(b, r, () => 0, topAt, 'glass', 'slate', 'dark');
  for (const r of canopy) slopedSlab(b, r, (x, z) => topAt(x, z) - 1.0, topAt, 'gold', 'slate', 'gold');
  // the slab end wall's canopy over the walk to the park, continuing the arcade (w04-157)
  // the canopy over the walk along the slab's park end (3 m, orthophoto) widens under the drum to the drum's circle: the curved
  // gold edge and the round columns of panoramas TMX7316010203-001156_pano_0000_001503/_001505; the slab and the shops cut it
  const yEnd = topAt(...fP(0, 0) as [number, number]);
  const circle: Pt[] = [...Array(36)].map((_, k) => [DRUM.c[0] + Math.cos(k / 36 * Math.PI * 2) * DRUM.r, DRUM.c[1] + Math.sin(k / 36 * Math.PI * 2) * DRUM.r] as Pt);
  const strip: Pt[] = [fP(0.5, 0.5), fP(0.5, -12.4), fP(-3.0, -12.4), fP(-3.0, 0.5)];
  const mainRing = src.rings.main[0] as Pt[];
  const cut = polygonClipping.difference(polygonClipping.union([[...circle, circle[0]]], [[...strip, strip[0]]]), [[...mainRing, mainRing[0]]], poly);
  for (const pg of cut) slopedSlab(b, pg[0].slice(0, -1) as Pt[], () => yEnd - 1.0, () => yEnd, 'gold', 'slate', 'gold');
  const inside = (p: Pt) => inRing(mainRing, p[0], p[1]) || inRing(ring, p[0], p[1]);
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * Math.PI * 2, p: Pt = [DRUM.c[0] + Math.cos(a) * (DRUM.r - 0.5), DRUM.c[1] + Math.sin(a) * (DRUM.r - 0.5)];
    if (!inside(p) && fO(p) < 4.5) column(b, p, yEnd - 1.0);
  }
  // round columns: on the arcade edge and under the end-wall canopy
  for (const u of [3.5, 7.5, 11.5]) column(b, sP(u, 0.5), topAt(...sP(u, 0.5) as [number, number]) - 1.0);
  for (const o of [-4.5, -8.0, -11.9]) column(b, fP(-2.6, o), yEnd - 1.0);
  // gold fascia along the street edge above the shop glazing (sloping with the roof), mullions and the clerestory transom
  const E0: Pt = [54.5, -27.0], E1: Pt = [75.0, -1.4];
  const el = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
  const ef: Frame = {origin: E0, tangent: [(E1[0] - E0[0]) / el, (E1[1] - E0[1]) / el], n: [(E1[1] - E0[1]) / el, -(E1[0] - E0[0]) / el]};
  const yAt = (t: number) => topAt(E0[0] + ef.tangent[0] * t, E0[1] + ef.tangent[1] * t);
  const SEG = 8;
  for (let k = 0; k < SEG; k++) {
    const ta = el * k / SEG, tb = el * (k + 1) / SEG, ya = yAt(ta), yb = yAt(tb);
    if (ta > el - ARC - 0.5) break;
    slab(b, ef, (ta + tb) / 2, Math.min(ya, yb) - 1.0, tb - ta + 0.02, Math.abs(ya - yb) + 1.05, 0.14, 'gold');
  }
  const shopEnd = el - ARC - 0.5;
  for (let t = 1.0; t < shopEnd; t += 2.7) slab(b, ef, t, 0, 0.12, yAt(t) - 1.05, 0.12, 'dark');
  slab(b, ef, shopEnd / 2, 3.1, shopEnd, 0.35, 0.1, 'dark');
  // entrance canopy by the tower with the BYZANTIUM lettering (30214768781.jpg)
  const C0 = SLAB_END + 1.9, C1 = TOWER_T0 + 1.0, DEPTH = 3.4;
  slopedSlab(b, [fP(C0, 0), fP(C1, 0), fP(C1, DEPTH), fP(C0, DEPTH)], () => 3.75, () => 4.55, 'gold', 'slate', 'gold');
  for (const t of [C0 + 0.4, C1 - 0.4]) { const q = fP(t, DEPTH - 0.4); b.add(new T.BoxGeometry(0.35, 3.75, 0.35).rotateY(Math.atan2(FRONT.n[0], FRONT.n[1])).translate(q[0], 3.75 / 2, q[1]), 'concrete' as never); }
  const lf = shift(FRONT, DEPTH);
  const word = 'BYZANTIUM', step = (C1 - C0 - 1.2) / (word.length - 1);
  [...word].forEach((ch, k) => letters(b, lf, ch, C0 + 0.6 + k * step, 3.78, 0, 0.085, 0.07, 'frame', 0.095));
  b.mark?.('gallery');
}
function column(b: B, p: Pt, top: number) {
  b.add(new T.CylinderGeometry(0.26, 0.26, top, 12).translate(p[0], top / 2, p[1]), 'concrete' as never);
}

/** The round penthouse cantilevered from the slab's park-end corner. */
const DRUM = {c: fP(1.3, 3.0), r: 5.2, saucer: 19.8, band: 21.4, glass: 22.8, fascia: 25.2, top: 26.0};
function drum(b: B) {
  const {c, r} = DRUM, SEG = 40;
  const lathe = new T.LatheGeometry([new T.Vector2(0.01, DRUM.saucer), new T.Vector2(r * 0.56, DRUM.saucer), new T.Vector2(r, DRUM.band)], SEG);
  b.add(lathe.translate(c[0], 0, c[1]), 'gold' as never);
  b.add(new T.CylinderGeometry(r, r, DRUM.glass - DRUM.band, SEG).translate(c[0], (DRUM.band + DRUM.glass) / 2, c[1]), 'gold' as never);
  b.add(new T.CylinderGeometry(r - 0.35, r - 0.35, DRUM.fascia - DRUM.glass + 0.2, SEG).translate(c[0], (DRUM.glass + DRUM.fascia) / 2, c[1]), 'glass' as never);
  b.add(new T.CylinderGeometry(r + 0.1, r + 0.1, DRUM.top - DRUM.fascia, SEG).translate(c[0], (DRUM.fascia + DRUM.top) / 2, c[1]), 'gold' as never);
  const roof = new T.CylinderGeometry(r - 0.4, r - 0.4, 0.12, SEG).translate(c[0], DRUM.top + 0.04, c[1]);
  roof.userData.role = 'roof';
  b.add(roof, 'slate' as never);
  // mullions of the glazed storey and the railing behind the glass line
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    b.add(new T.BoxGeometry(0.1, DRUM.fascia - DRUM.glass, 0.14).rotateY(-a).translate(c[0] + Math.cos(a) * (r - 0.22), (DRUM.glass + DRUM.fascia) / 2, c[1] + Math.sin(a) * (r - 0.22)), 'gold' as never);
  }
  b.add(new T.TorusGeometry(r - 0.12, 0.04, 4, SEG).rotateX(Math.PI / 2).translate(c[0], DRUM.glass + 1.0, c[1]), 'bronze' as never);
  // supports: a slender column to the pavement through the gallery roof and a diagonal strut back to the slab front
  const col = fP(3.6, 3.0), colTop = DRUM.saucer + 0.05;
  b.add(new T.CylinderGeometry(0.22, 0.22, colTop, 10).translate(col[0], colTop / 2, col[1]), 'bronze' as never);
  const s0 = new T.Vector3(...[fP(-1.2, 1.5)].map(p => [p[0], 20.3, p[1]])[0] as [number, number, number]);
  const s1 = new T.Vector3(...[fP(0.05, -2.5)].map(p => [p[0], 14.5, p[1]])[0] as [number, number, number]);
  const len = s0.distanceTo(s1), mid = s0.clone().add(s1).multiplyScalar(0.5);
  const strut = new T.CylinderGeometry(0.16, 0.16, len, 8);
  strut.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), s1.clone().sub(s0).normalize()));
  b.add(strut.translate(mid.x, mid.y, mid.z), 'bronze' as never);
  b.mark?.('drum');
}

/** Slab end wall at the park end (w04-157): tile cladding, shop glass under the canopy, fire-escape landings. */
function endWall(b: B) {
  const ef: Frame = {origin: fP(0, -12.3), tangent: [FRONT.n[0], FRONT.n[1]], n: [-FRONT.tangent[0], -FRONT.tangent[1]]};
  slab(b, ef, 6.12, 4.0, 12.24, PARAPET - 4.0 + 0.2, 0.12, 'greyBrick');
  slab(b, ef, 6.15, 0.3, 11.6, 3.2, 0.06, 'glass');
  for (const y of [8.9, 11.8, 14.7, 17.6]) {
    slab(b, ef, 2.6, y, 2.6, 0.15, 1.3, 'concrete', 0.12);
    railing(b, shift(ef, 1.3), 1.4, 3.8, y + 0.15, 1.0);
  }
  for (let k = 0; k < 3; k++) framedWindow(b, ef, 6.8, 9.95 + k * 2.9, 0.7, 0.7, 0, 0.12);
}

/** Tesselschadestraat: the low brick block behind a black portal frame. */
function tess(b: B) {
  const ring = plan(src.roofs.tess[0][0]);
  const front = ringFrame(ring, 0), west = ringFrame(ring, 3);
  for (const {f, len} of [front, west]) {
    slab(b, f, len / 2, 0.25, len - 0.6, 2.6, 0.06, 'glass');
    for (let t = 2.2; t < len - 1; t += 3.2) slab(b, f, t, 0.25, 0.12, 2.6, 0.12, 'dark');
    for (let t = 1.6; t < len - 1; t += 2.4) framedWindow(b, f, t, 4.1, 1.1, 1.3, 0);
  }
  const POST = 0.5, OUT = 0.6, n = Math.round(front.len / 8);
  for (let k = 0; k <= n; k++) slab(b, front.f, 0.3 + (front.len - 0.6) * k / n, 0, POST, 5.5, POST, 'blue', OUT);
  slab(b, front.f, front.len / 2, 5.5, front.len, 0.9, POST, 'blue', OUT);
  b.mark?.('tess');
}

// ------------------------------------------------------------------------------------------- run-driven storeys (all faces)
/** Storey levels of the slab's back and Tesselschadestraat faces (2.83 m from the first floor at 6.0 m). */
const SLAB_LEVELS = [6.0, 8.83, 11.66, 14.49, 17.32, 20.15, 22.98];
const WING_LEVELS = [0.3, 3.9, 7.5];
function storeys(b: B) {
  const {pieces: P, zone} = pieces();
  for (const [levels, kinds] of [[SLAB_LEVELS, ['slab']], [WING_LEVELS, ['wing']]] as [number[], string[]][]) {
    for (const lv of levels) {
      const y = lv + 1.5;
      for (const r of exposedRuns(P, y, {blocked, minLen: 2.5})) {
        if (!kinds.includes(zone[r.piece])) continue;
        if (onFront(r) || onSetback(r) || onEndWall(r)) continue;
        const top = P[r.piece].top;
        if (Math.abs(signedArea(P[r.piece].ring)) < 30) continue;
        if (!clearAt(P, r, lv + 0.6)) continue;
        if (lv + 2.6 > top - 0.25) continue;
        const {f, len} = runFrame(r);
        if (len < 2.5) continue;
        const nwFacing = dot(r.n, NW) > 0.85;
        if (nwFacing && zone[r.piece] === 'wing') squareWindows(b, f, len, lv);
        else if (nwFacing) ribbon(b, f, len, lv);
        else balcony(b, f, len, lv, zone[r.piece] === 'wing' && lv < 1);
      }
    }
  }
  b.mark?.('storeys');
}
/** Tesselschadestraat ribbon: two-pane glass runs between 0.45 m piers, dark frame bars above and below. */
function ribbon(b: B, f: Frame, len: number, lv: number) {
  const m = 0.4, seg = 2.6, gap = 0.45, n = Math.max(1, Math.floor((len - 2 * m + gap) / (seg + gap)));
  const used = n * seg + (n - 1) * gap, t0 = (len - used) / 2;
  for (let k = 0; k < n; k++) {
    const tc = t0 + k * (seg + gap) + seg / 2;
    slab(b, f, tc, lv + 0.9, seg, 1.45, 0.06, 'glass');
    slab(b, f, tc, lv + 0.9 + 0.65, 0.07, 0.8, 0.1, 'dark');
  }
  slab(b, f, len / 2, lv + 0.78, used + 0.1, 0.12, 0.1, 'dark');
  slab(b, f, len / 2, lv + 2.35, used + 0.1, 0.12, 0.1, 'dark');
}
/** West end on the Tesselschadestraat (w06/w07): grey cladding, square windows. */
function squareWindows(b: B, f: Frame, len: number, lv: number) {
  slab(b, f, len / 2, lv, len - 0.1, 3.6, 0.12, 'greyBrick');
  const n = Math.max(1, Math.floor((len - 0.8) / 2.6));
  for (let k = 0; k < n; k++) framedWindow(b, f, (len - (n - 1) * 2.6) / 2 + k * 2.6, lv + 1.8, 1.3, 1.3, 0, 0.12);
}
/** Courtyard and park faces: a window ribbon behind a white balcony slab with a dark rail (none on the garden storey). */
function balcony(b: B, f: Frame, len: number, lv: number, garden: boolean) {
  slab(b, f, len / 2, lv + 0.6, len - 0.6, 1.9, 0.06, 'glass');
  if (garden) return;
  if (len > 3.2) slab(b, f, len / 2, lv, len - 2.6, 0.22, 1.2, 'pink');
  if (len > 3.2) { slab(b, f, len / 2, lv + 1.0, len - 2.7, 0.07, 0.07, 'bronze', 1.1); for (const t of [1.35, len - 1.35]) slab(b, f, t, lv + 0.22, 0.07, 0.85, 0.07, 'bronze', 1.1); }
}

export function buildByzantium(_w: number, _d: number, b: B) {
  massing(b);
  setSink(0.05);
  slabFront(b);
  tower(b);
  endWall(b);
  tess(b);
  storeys(b);
  setSink(0);
  gallery(b);
  drum(b);
}
