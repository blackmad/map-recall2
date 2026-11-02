import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import type {Frame} from './nearbar-kit';
import {Acc, ccw, fin, strip, tube, wallQuad, type C} from './tier-kit';
import {edgeNormal, type PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import source from './the-edge-footprints.json';

/**
 * The Edge, Gustav Mahlerlaan 2970, Zuidas (BAG pand 0363100012239633, bouwjaar 2013; PLP Architecture for OVG,
 * Deloitte and AKD offices). Native east/south metres from the BAG vertex average (the-edge-footprints.json,
 * modern-prepare.mjs), y above local ground.
 *
 * The BAG ring is wider than the building above ground: its east strip (x 48..62) and the north apron (z < foot line,
 * x > 30) are the basement under the service road and the A10 verge. The above-ground outline comes from the 3DBAG LoD2.2
 * walls (west wall x -37.7, south wall z 45.4, east wall x 48) and the PDOK orthophoto roof (relief displacement measured
 * against the 3DBAG south wall: +3.3 m in z, 0 in x).
 *
 *  - Three office wings round a glass-roofed atrium (orthophoto): the west wing (a parallelogram on the diagonal NW and
 *    SW fronts, 55.5 m, one storey higher: the step in the roof line on the south front, Commons Zuidas_20210512_154826,
 *    and the 3DBAG 54-59 m planes), the south-east L of the south wing and the east wing (52.5 m, 3DBAG 49-52 m).
 *  - The north side is the atrium's glass wall: one warped glass face from the top edge (z -1.7, 52.5 m) down to a foot
 *    line on bearing 348 that runs from the west wing's tip (no lean) to the east front (15.6 m of lean; east panorama
 *    TMX7316060226-000009_pano_0000_002105, 3DBAG plane 679, orthophoto). It folds along the diagonal from the top-west to
 *    the foot-east, as Commons TheEdge_03-2024.jpg shows: a vertical triangle on the foot line and a leaning triangle.
 *    The name ("schuin afloopt naar de A10", nl.wikipedia) is this face.
 *  - Under it a two-storey low block (6.2 m, 3DBAG plane 678) fills the stepped BAG front to the A10 verge (w08-w17).
 *  - Fronts: the south and south-west faces carry tilted dark solar/louvre panels beside every window (w02, w06, w07,
 *    Commons 155013/155017); the east front has narrow windows between white piers (w01, Commons 160238); the north-west
 *    front ribbon windows (w05). White spandrel bands at every floor; a double-height ground storey on round columns,
 *    recessed under the overhang on the south, south-west and north-west (w06, w07); the east plinth is flush (w01).
 *  - The four-storey glass bay cantilevered from the south front (Commons 154826, panoramio 2014; the BAG/3DBAG wedge
 *    x -11.4..-1.5 to 48.2 m), the Deloitte letters on the north-west top storey (Commons TheEdge_03-2024), the AKD
 *    logo on the east top storey and the window-cleaning gantry on the east roof (Commons 160238).
 */
const src = source as unknown as {nativeRing: number[][]};

const SOFFIT = 8.0, STOREY = 3.6, LEVELS = 11;
const H_LOW = 52.5, H_HIGH = 55.5, LOW_BLOCK = 6.2;
const BAND = 0.95, BAND_D = 0.16, RECESS = 2.8;
const A: PlanPoint = [-25.5, -1.7], B: PlanPoint = [-37.7, 10.1], Cc: PlanPoint = [-22.0, 45.4];
const D: PlanPoint = [48.0, 45.4], E: PlanPoint = [48.0, -1.7];
const STEP_X = 3.0, INNER_Z = 31.3, EAST_X = 32.9;
/** Foot of the atrium glass at the low-block roof: z on the line from the west wing's tip to (48, -17.3). */
const FOOT_E = -17.3;
const footZ = (x: number) => A[1] + (FOOT_E - A[1]) * (x - A[0]) / (E[0] - A[0]);
/** The cantilevered glass bay on the south front (BAG wedge). */
const BAY = {w0: [-11.4, 45.4] as PlanPoint, w1: [-10.6, 48.1] as PlanPoint, w2: [-1.5, 45.4] as PlanPoint, y0: 33.2, y1: 48.2};

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add3 = (a: V3, b: V3, s = 1): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/** A triangle turned to face `out`. */
function triOut(acc: Acc, c: C, p: V3, q: V3, r: V3, out: V3) {
  if (dot(cross(sub(q, p), sub(r, p)), out) >= 0) acc.tri(c, p, q, r); else acc.tri(c, p, r, q);
}
/** A closed bar from 1 cm behind a face (normal n) to `d` proud of it along p->q, `w` wide in the face. */
function bar3(acc: Acc, c: C, p: V3, q: V3, n: V3, w: number, d: number) {
  const s = norm(cross(n, sub(q, p))), mid = add3(add3(p, sub(q, p), 0.5), n, (d - 0.01) / 2);
  obox(acc, c, mid, sub(q, p).map(v => v / 2) as V3, s.map(v => v * w / 2) as V3, n.map(v => v * (d + 0.01) / 2) as V3);
}
/** A box given its centre and three half-axes (no back face when `open` is set: it stands against a wall). */
function obox(acc: Acc, c: C, o: V3, ax: V3, ay: V3, az: V3, open = false) {
  const P = (i: number, j: number, k: number) => add3(add3(add3(o, ax, i), ay, j), az, k);
  const face = (n: V3, a: V3, b: V3, cc: V3, d: V3) => { triOut(acc, c, a, b, cc, n); triOut(acc, c, a, cc, d, n); };
  face(norm(az), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1));
  if (!open) face(norm(az).map(v => -v) as V3, P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1));
  face(norm(ax), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1));
  face(norm(ax).map(v => -v) as V3, P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1));
  face(norm(ay), P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1));
  face(norm(ay).map(v => -v) as V3, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1));
}
function roofPoly(b: BuildingTools, ring: PlanPoint[], y: number, c: C) {
  b.add(upwardRoofPlane(new T.Shape(ring.map(([x, z]) => new T.Vector2(x, z))), y), c);
}
function soffitQuad(acc: Acc, c: C, ring: PlanPoint[], y: number) {
  for (let i = 1; i + 1 < ring.length; i++) triOut(acc, c, [ring[0][0], y, ring[0][1]], [ring[i][0], y, ring[i][1]], [ring[i + 1][0], y, ring[i + 1][1]], [0, -1, 0]);
}
/** Offset line intersection: the corner between edges (p->q) and (q->r), each moved by its own distance along its normal. */
function offsetCorner(p: PlanPoint, q: PlanPoint, r: PlanPoint, d0: number, d1: number): PlanPoint {
  const n0 = edgeNormal(p, q), n1 = edgeNormal(q, r);
  const a0: PlanPoint = [p[0] + n0[0] * d0, p[1] + n0[1] * d0], u0 = [q[0] - p[0], q[1] - p[1]];
  const a1: PlanPoint = [q[0] + n1[0] * d1, q[1] + n1[1] * d1], u1 = [r[0] - q[0], r[1] - q[1]];
  const det = u0[0] * -u1[1] - u0[1] * -u1[0];
  const t = ((a1[0] - a0[0]) * -u1[1] - (a1[1] - a0[1]) * -u1[0]) / det;
  return [a0[0] + u0[0] * t, a0[1] + u0[1] * t];
}

type Skin = 'panels' | 'piers' | 'ribbon';
/** Floor levels of an office face up to `top`: the spandrel bands sit on them. */
function levels(top: number) {
  const ys: number[] = [];
  for (let k = 0; k < LEVELS; k++) ys.push(SOFFIT + k * STOREY);
  if (top > H_LOW) ys.push(SOFFIT + LEVELS * STOREY, SOFFIT + (LEVELS + 1) * STOREY);
  else ys.push(SOFFIT + LEVELS * STOREY);
  return ys;
}
/**
 * One office front: glass wall from y0 to the roof, white spandrel bands on every floor, a crown band, and the skin:
 *  - panels: a tilted dark solar/louvre panel in the left half of every 1.8 m bay (canted 14 deg about its vertical axis,
 *    5 to 26 cm off the glass), white frame fins at the bay edges;
 *  - piers: 0.8 m white piers every 1.8 m (the east front's narrow windows);
 *  - ribbon: thin aluminium mullions every 1.8 m.
 * `skip(t, y)` leaves a bay out (behind the cantilevered glass bay).
 */
function officeFront(acc: Acc, a: PlanPoint, c: PlanPoint, y0: number, top: number, skin: Skin, o: {t0?: number; t1?: number; bandFrom?: number; skip?: (t: number, y: number) => boolean} = {}) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? L;
  wallQuad(acc, 'glass', a, c, y0, top);
  const ys = levels(top).filter(y => y >= (o.bandFrom ?? y0) - 0.01 && y < top - 1.5);
  // a band never hangs below its wall's bottom edge (its open back edge would show): the lowest starts 6 cm up
  for (const y of ys) strip(acc, 'white', a, c, t0 + 0.02, t1 - 0.02, Math.max(y - 0.05, y0 + 0.06), y + BAND, BAND_D);
  strip(acc, 'white', a, c, t0 + 0.02, t1 - 0.02, top - 0.7, top, BAND_D, 0);   // crown, its top meeting the roof at the wall
  const n = Math.max(1, Math.round((t1 - t0) / 1.8)), p = (t1 - t0) / n;
  const yTop = top - 0.7;
  // piers: the end piers sit flush with the corners, so every window between them is the same width (no narrow end slot)
  if (skin === 'piers') { const q = (t1 - t0 - 0.9) / n; for (let i = 0; i <= n; i++) fin(acc, 'white', a, c, t0 + 0.45 + i * q, 0.8, y0, yTop, 0.1); return; }
  for (let i = 0; i <= n; i++) fin(acc, skin === 'panels' ? 'white' : 'frame', a, c, Math.min(t1 - 0.06, Math.max(t0 + 0.06, t0 + i * p)), 0.1, y0, yTop, 0.1);
  if (skin !== 'panels') return;
  const u = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], nn = edgeNormal(a, c), ang = 14 * Math.PI / 180;
  const along: V3 = [u[0], 0, u[1]], outN: V3 = [nn[0], 0, nn[1]];
  const ax = add3([along[0] * Math.cos(ang), 0, along[2] * Math.cos(ang)], outN, Math.sin(ang)), az = add3([outN[0] * Math.cos(ang), 0, outN[2] * Math.cos(ang)], along, -Math.sin(ang));
  const floorYs = levels(top).filter(y => y >= y0 - 0.01 && y + STOREY <= top + 0.01);
  for (let i = 0; i < n; i++) for (const y of floorYs) {
    const tc = t0 + (i + 0.27) * p, yc = y + BAND + 1.25;
    if (o.skip?.(tc, yc)) continue;
    const w = 0.42, h = 1.18, th = 0.03;
    // panel centre: its wall-side edge 5 cm off the glass, the far edge swung out by the cant
    const ctr: V3 = [a[0] + u[0] * tc + nn[0] * (0.05 + w * Math.sin(ang) + th), yc, a[1] + u[1] * tc + nn[1] * (0.05 + w * Math.sin(ang) + th)];
    obox(acc, 'bronze', ctr, ax.map(v => v * w) as V3, [0, h, 0], az.map(v => v * th) as V3);
  }
}

// ---- lettering: the Deloitte word mark (lower case, bold) and the AKD logo -------------------------------------------
/** 5 x 7 bold lower-case glyphs (rows top to bottom); capitals 7 rows, x-height 5. */
const LOWER: Record<string, string[]> = {
  D: ['11110', '11011', '11011', '11011', '11011', '11011', '11110'],
  e: ['00000', '00000', '01110', '11011', '11111', '11000', '01111'],
  l: ['11000', '11000', '11000', '11000', '11000', '11000', '11000'],
  o: ['00000', '00000', '01110', '11011', '11011', '11011', '01110'],
  i: ['11000', '00000', '11000', '11000', '11000', '11000', '11000'],
  t: ['01100', '01100', '11110', '01100', '01100', '01100', '00110'],
  a: ['00000', '00000', '01110', '00011', '01111', '11011', '01111'],
  k: ['11000', '11000', '11011', '11110', '11100', '11110', '11011'],
  d: ['00011', '00011', '01111', '11011', '11011', '11011', '01111'],
};
const WIDTH: Record<string, number> = {D: 5, e: 5, l: 2, o: 5, i: 2, t: 5, a: 5, k: 5, d: 5};
function word(acc: Acc, f: Frame, text: string, t: number, y: number, out: number, px: number, c: C) {
  const total = [...text].reduce((s, ch) => s + (WIDTH[ch] ?? 5) + 1, -1) * px;
  let u = t - total / 2;
  const P = (tt: number, yy: number): V3 => [f.origin[0] + f.tangent[0] * tt + f.n[0] * out, yy, f.origin[1] + f.tangent[1] * tt + f.n[1] * out];
  const nrm: V3 = [f.n[0], 0, f.n[1]];
  for (const ch of text) {
    const rows = LOWER[ch] ?? [], w = WIDTH[ch] ?? 5;
    rows.forEach((row, j) => {
      let k = 0;
      while (k < w) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < w && row[e] === '1') e++;
        const y0 = y + (6 - j) * px, t0 = u + k * px, t1 = u + e * px;
        // a glyph run is a block from the wall plane to `out` proud (mounted letters touch their wall)
        const mid = P((t0 + t1) / 2, y0 + px / 2);
        const ctr: V3 = [mid[0] - nrm[0] * out / 2, mid[1], mid[2] - nrm[2] * out / 2];
        obox(acc, c, [ctr[0] - nrm[0] * 0.01, ctr[1], ctr[2] - nrm[2] * 0.01], [f.tangent[0] * (t1 - t0) / 2, 0, f.tangent[1] * (t1 - t0) / 2], [0, px / 2, 0], [nrm[0] * (out / 2 + 0.01), 0, nrm[2] * (out / 2 + 0.01)]);
        k = e;
      }
    });
    u += (w + 1) * px;
  }
  return u;
}
/** A lettering frame: origin a, tangent towards c (the viewer's right), outward normal n. */
const viewerFrame = (a: PlanPoint, c: PlanPoint, n: PlanPoint): Frame => { const L = Math.hypot(c[0] - a[0], c[1] - a[1]); return {origin: a, tangent: [(c[0] - a[0]) / L, (c[1] - a[1]) / L], n}; };

// ---- builder --------------------------------------------------------------------------------------------------------
export function buildTheEdge(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  void src;
  const westWing = ccw([A, B, Cc, [STEP_X, 45.4], [STEP_X, INNER_Z]]);
  const eastWing = ccw([[STEP_X, INNER_Z], [STEP_X, 45.4], D, E, [EAST_X, -1.7], [EAST_X, INNER_Z]]);
  const atrium = ccw([A, [EAST_X, -1.7], [EAST_X, INNER_Z], [STEP_X, INNER_Z]]);

  // ---- ground storey: recessed glazing on columns (S, SW, NW), flush glazed plinth on the east ----
  // The outer chain runs E -> D -> C -> B -> A (clockwise on the map, the winding edgeNormal turns outward).
  const chain = [E, D, Cc, B, A];
  const dIn = [0, -RECESS, -RECESS, -RECESS];   // per edge: E-D, D-C, C-B, B-A
  const inner: PlanPoint[] = [E];
  for (let i = 1; i < chain.length - 1; i++) inner.push(offsetCorner(chain[i - 1], chain[i], chain[i + 1], dIn[i - 1], dIn[i]));
  { const n = edgeNormal(B, A); inner.push([A[0] + n[0] * dIn[3], A[1] + n[1] * dIn[3]]); }
  for (let i = 1; i < 4; i++) {
    const a = chain[i], c = chain[i + 1], ia = inner[i], ic = inner[i + 1];
    wallQuad(acc, 'glass', ia, ic, 0, SOFFIT);
    strip(acc, 'frame', ia, ic, 0.05, Math.hypot(ic[0] - ia[0], ic[1] - ia[1]) - 0.05, 4.2, 4.45, 0.1);
    soffitQuad(acc, 'concrete', [a, c, ic, ia], SOFFIT);
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), k = Math.max(1, Math.round(L / 7.2)), p = L / k, u = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], nn = edgeNormal(a, c);
    for (let j = 0; j <= k; j++) {
      const t = Math.min(L - 0.6, Math.max(0.6, j * p)), q: PlanPoint = [a[0] + u[0] * t - nn[0] * 0.6, a[1] + u[1] * t - nn[1] * 0.6];
      b.add(tube(q, 0, q, SOFFIT + 0.02, 0.36, 10), 'concrete');
    }
  }
  // the NW tip: the recess closed against the low block
  wallQuad(acc, 'glass', A, inner[4], 0, SOFFIT);
  // east plinth, flush
  officePlinth(acc, E, D);
  // main entrance on the south front (w06/w07): the white wall panel and the steps in the recess
  {
    const zr = 45.4 - RECESS;
    strip(acc, 'white', [-12, zr], [-17, zr], 0, 5, 0.02, 7.4, 0.25);
    // w06: the steps run only in front of the entrance (glass corner to the column past the white panel)
    for (let k = 0; k < 3; k++) strip(acc, 'concrete', [-8, zr], [-20, zr], 0, 12, 0, 0.17 * (3 - k), 0.35 * (k + 1), -0.02);
  }

  // ---- office fronts above the soffit (each edge listed so its normal points out) ----
  const inBay = (t: number, y: number) => t > 4.3 && t < 14.6 && y > BAY.y0 - 0.5 && y < BAY.y1 + 0.5;
  officeFront(acc, B, A, SOFFIT, H_HIGH, 'ribbon');
  officeFront(acc, Cc, B, SOFFIT, H_HIGH, 'panels');
  officeFront(acc, [STEP_X, 45.4], Cc, SOFFIT, H_HIGH, 'panels', {skip: inBay});
  officeFront(acc, D, [STEP_X, 45.4], SOFFIT, H_LOW, 'panels');
  officeFront(acc, E, D, SOFFIT, H_LOW, 'piers');
  // the high west wing's faces above the low roofs (inner diagonal over the atrium; its east end over the south wing)
  officeFront(acc, [STEP_X, INNER_Z], [STEP_X, 45.4], H_LOW, H_HIGH, 'ribbon');
  officeFront(acc, A, [STEP_X, INNER_Z], H_LOW, H_HIGH, 'ribbon');

  // ---- roofs: solar fields behind white crowns, the atrium's glass roof with its diamond grid ----
  roofPoly(b, westWing, H_HIGH, 'slate');
  roofPoly(b, eastWing, H_LOW + 0.005, 'slate');
  roofPoly(b, atrium, H_LOW, 'canopyGlass');
  diamondGrid(acc, atrium, H_LOW + 0.12, 4.5);
  // roof plant bar on the east wing (orthophoto) and the window-cleaning gantry (Commons 160238)
  b.add(new T.BoxGeometry(14, 1.6, 3.2).translate(40.5, H_LOW + 0.8, 19), 'concrete');
  b.add(new T.BoxGeometry(2.4, 2.2, 3.2).translate(42, H_LOW + 1.1, 30), 'concrete');
  b.add(new T.BoxGeometry(6.4, 0.6, 0.6).translate(44.6, H_LOW + 2.45, 30), 'concrete');   // boom, to the roof edge

  // ---- the atrium's north glass face (signature) ----
  incline(acc);
  // the east end of the atrium under the lean: glass with the white floor bands cut by the slope
  {
    const a: PlanPoint = [E[0], FOOT_E], c: PlanPoint = [E[0], -1.7], L = c[1] - a[1];
    const slopeT = (y: number) => L * (y - LOW_BLOCK) / (H_LOW - LOW_BLOCK);   // t (from the foot) where the slope edge is at y
    const n: V3 = [1, 0, 0];
    triOut(acc, 'glass', [E[0], LOW_BLOCK, FOOT_E], [E[0], LOW_BLOCK, -1.7], [E[0], H_LOW, -1.7], n);
    for (const y of levels(H_LOW)) if (y < H_LOW - 1.5) strip(acc, 'white', a, c, slopeT(y + BAND) + 0.3, L - 0.02, y - 0.05, y + BAND, BAND_D);
    for (let t = 1.8; t < L - 0.5; t += 1.8) {
      const yb = LOW_BLOCK + (H_LOW - LOW_BLOCK) * t / L;
      if (yb > SOFFIT) fin(acc, 'frame', a, c, t, 0.1, SOFFIT, yb - 0.6, 0.1);
    }
    // plinth under it
    wallQuad(acc, 'glass', a, c, 0, LOW_BLOCK);
    strip(acc, 'white', a, c, 0.02, L - 0.02, LOW_BLOCK - 0.6, LOW_BLOCK, BAND_D);
  }
  // ---- the low block along the A10 (w08-w17): two storeys of ribbon windows between white bands ----
  lowBlock(b, acc);

  // ---- the cantilevered glass bay on the south front ----
  glassBay(acc);

  // ---- lettering ----
  // Deloitte on the north-west top storey, next to the atrium glass (Commons TheEdge_03-2024): white, green full stop
  {
    const f = viewerFrame(A, B, edgeNormal(B, A)), px = 0.24, y = 52.4;
    const end = word(acc, f, 'Deloitte', 8.9, y, BAND_D + 0.06, px, 'white');
    const g: V3 = [f.origin[0] + f.tangent[0] * (end + 0.4) + f.n[0] * (BAND_D + 0.06), y + 0.33, f.origin[1] + f.tangent[1] * (end + 0.4) + f.n[1] * (BAND_D + 0.06)];
    obox(acc, 'green', [g[0] - f.n[0] * (BAND_D + 0.06) / 2, g[1], g[2] - f.n[1] * (BAND_D + 0.06) / 2], [f.tangent[0] * 0.3, 0, f.tangent[1] * 0.3], [0, 0.3, 0], [f.n[0] * (BAND_D + 0.06) / 2, 0, f.n[1] * (BAND_D + 0.06) / 2]);
  }
  // AKD on the east top storey at the north end (Commons 160238): blue emblem and lower-case letters
  {
    const f = viewerFrame(D, E, edgeNormal(E, D)), px = 0.24, t = 41.5, y = 48.9;
    const o = BAND_D + 0.06;
    const c: V3 = [f.origin[0] + f.tangent[0] * (t - 2.6) + f.n[0] * o, y + 0.85, f.origin[1] + f.tangent[1] * (t - 2.6) + f.n[1] * o];
    // the emblem: a disc on a short drum back to the wall
    const disc = new T.CylinderGeometry(0.85, 0.85, o, 12).rotateX(Math.PI / 2).translate(0, 0, -o / 2).rotateY(Math.atan2(f.n[0], f.n[1])).translate(c[0], c[1], c[2]);
    b.add(disc, 'blue');
    word(acc, f, 'akd', t + 0.5, y, o, px, 'blue');
  }
  acc.flush();
}

/** The flush glazed plinth of the east front: glass to the soffit, a mezzanine transom and mullions every 3.6 m. */
function officePlinth(acc: Acc, a: PlanPoint, c: PlanPoint) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  wallQuad(acc, 'glass', a, c, 0, SOFFIT);
  strip(acc, 'frame', a, c, 0.05, L - 0.05, 4.2, 4.45, 0.1);
  for (let t = 3.6; t < L - 1; t += 3.6) fin(acc, 'frame', a, c, t, 0.12, 0, SOFFIT - 0.06, 0.1);
}

/** Diamond grid of frame bars over a convex roof polygon (the orthophoto shows the atrium roof's diagonal grid). */
function diamondGrid(acc: Acc, ring: PlanPoint[], y: number, pitch: number) {
  const clip = (p: PlanPoint, d: PlanPoint): [number, number] | null => {
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], n = edgeNormal(a, c);
      const num = (a[0] - p[0]) * n[0] + (a[1] - p[1]) * n[1], den = d[0] * n[0] + d[1] * n[1];
      if (Math.abs(den) < 1e-9) { if (num < 0) return null; continue; }
      const t = num / den;
      if (den > 0) hi = Math.min(hi, t); else lo = Math.max(lo, t);
    }
    return lo < hi ? [lo, hi] : null;
  };
  const up: V3 = [0, 1, 0];
  for (const d of [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]] as PlanPoint[]) {
    const n: PlanPoint = [-d[1], d[0]];
    for (let s = -120; s <= 120; s += pitch) {
      const p: PlanPoint = [n[0] * s, n[1] * s], r = clip(p, d);
      if (!r || r[1] - r[0] < 1.5) continue;
      const a: V3 = [p[0] + d[0] * (r[0] + 0.3), y, p[1] + d[1] * (r[0] + 0.3)], c: V3 = [p[0] + d[0] * (r[1] - 0.3), y, p[1] + d[1] * (r[1] - 0.3)];
      const sx: V3 = [n[0] * 0.08, 0, n[1] * 0.08];
      triOut(acc, 'frame', add3(a, sx, -1), add3(a, sx), add3(c, sx), up);
      triOut(acc, 'frame', add3(a, sx, -1), add3(c, sx), add3(c, sx, -1), up);
    }
  }
}

/**
 * The atrium's north face: a vertical glass triangle on the foot line (west tip, foot-east, top-west) and a leaning
 * triangle (top-west, foot-east, top-east), glazing bars along the floors and mullions from the foot to the top edge.
 */
function incline(acc: Acc) {
  const TW: V3 = [A[0], H_LOW, A[1]], FW: V3 = [A[0], LOW_BLOCK, A[1]], FE: V3 = [E[0], LOW_BLOCK, FOOT_E], TE: V3 = [E[0], H_LOW, -1.7];
  const nV = norm(cross(sub(FE, FW), [0, 1, 0]));
  const n1: V3 = nV[2] < 0 ? nV : [-nV[0], -nV[1], -nV[2]];        // vertical triangle, facing north
  let n2 = norm(cross(sub(FE, TW), sub(TE, TW)));
  if (n2[2] > 0) n2 = [-n2[0], -n2[1], -n2[2]];                     // leaning triangle, facing north and up
  triOut(acc, 'canopyGlass', TW, FW, FE, n1);
  triOut(acc, 'canopyGlass', TW, FE, TE, n2);
  // the fold and the rims
  bar3(acc, 'frame', TW, FE, norm(add3(n1, n2)), 0.3, 0.14);
  bar3(acc, 'frame', FE, TE, n2, 0.4, 0.16);
  bar3(acc, 'frame', FW, FE, n1, 0.35, 0.14);
  bar3(acc, 'frame', TW, TE, n2, 0.4, 0.16);
  // the fold line at height y: x from the west tip
  const span = E[0] - A[0];
  const foldAtY = (y: number): V3 => { const s = (H_LOW - y) / (H_LOW - LOW_BLOCK); return [A[0] + span * s, y, footZ(A[0] + span * s)]; };
  // transoms on every floor
  for (let y = SOFFIT; y < H_LOW - 1; y += STOREY) {
    const t = (y - LOW_BLOCK) / (H_LOW - LOW_BLOCK);
    const p0: V3 = [A[0] + 0.3, y, A[1] + 0.02], f = foldAtY(y), p2: V3 = [E[0] - 0.3, y, FOOT_E + (-1.7 - FOOT_E) * t];
    bar3(acc, 'frame', p0, f, n1, 0.12, 0.1);
    bar3(acc, 'frame', f, p2, n2, 0.12, 0.1);
  }
  // mullions every 3.0 m along the foot
  for (let x = A[0] + 3; x < E[0] - 1; x += 3.0) {
    const s = (x - A[0]) / span, yf = H_LOW - (H_LOW - LOW_BLOCK) * s;
    const foot: V3 = [x, LOW_BLOCK, footZ(x)], fold: V3 = [x, yf, footZ(x)], top: V3 = [x, H_LOW, -1.7];
    if (yf - LOW_BLOCK > 0.5) bar3(acc, 'frame', foot, fold, n1, 0.1, 0.1);
    // west of x -5 the leaning part is a sliver over the vertical one (under 4 m deep): the transoms carry it alone
    if (x > -5) bar3(acc, 'frame', fold, top, n2, 0.1, 0.1);
  }
}

/** The two-storey block between the stepped BAG front on the A10 verge and the foot of the atrium glass. */
function lowBlock(b: BuildingTools, acc: Acc) {
  const ring = src.nativeRing as PlanPoint[];
  // BAG vertices from (-18.93, -5.33) along the stepped north front to (30.345, -25.454)
  const i0 = ring.findIndex(p => Math.abs(p[0] + 18.933) < 0.01), i1 = ring.findIndex(p => Math.abs(p[0] - 30.345) < 0.01);
  const front = ring.slice(Math.min(i0, i1), Math.max(i0, i1) + 1);
  const ordered = front[0][0] < front[front.length - 1][0] ? front : [...front].reverse();
  const poly = ccw([[A[0], A[1]], ...ordered, [30.5, ordered[ordered.length - 1][1]], [30.5, footZ(30.5)]] as PlanPoint[]);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const n = edgeNormal(a, c), mid: PlanPoint = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    wallQuad(acc, 'glass', a, c, 0, LOW_BLOCK);
    // edges on the foot line (south side) are inside the atrium: plain wall that closes the roof's edge, no trim
    if (Math.abs(mid[1] - footZ(mid[0])) < 0.05 && n[1] > 0) continue;
    if (L < 1.5) continue;   // the 1.2 m jogs of the sawtooth stay plain glass: one trim assembly per 5 m step
    for (const [y0, y1] of [[0, 0.5], [2.75, 3.45], [LOW_BLOCK - 0.7, LOW_BLOCK]]) strip(acc, 'white', a, c, 0.06, L - 0.06, y0, y1, BAND_D, y1 === LOW_BLOCK ? 0 : -0.02);
    for (let t = 1.8; t < L - 0.4; t += 1.8) fin(acc, 'frame', a, c, t, 0.08, 0.5, LOW_BLOCK - 0.7, 0.1);
  }
  roofPoly(b, poly, LOW_BLOCK, 'slate');
  // the east plinth under the lean (x 30.5..48 on the foot line)
  const a: PlanPoint = [E[0], FOOT_E], c: PlanPoint = [30.5, footZ(30.5)], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  wallQuad(acc, 'glass', a, c, 0, LOW_BLOCK);
  strip(acc, 'white', a, c, 0.02, L - 0.02, LOW_BLOCK - 0.6, LOW_BLOCK, BAND_D);
  for (let t = 3.6; t < L - 1; t += 3.6) fin(acc, 'frame', a, c, t, 0.1, 0, LOW_BLOCK - 0.6, 0.1);
}

/** The four-storey glass bay cantilevered from the south front: a wedge in plan, glazed on its two outer faces. */
function glassBay(acc: Acc) {
  const ring = ccw([BAY.w0, BAY.w1, BAY.w2]);
  for (let i = 0; i < 3; i++) {
    const a = ring[i], c = ring[(i + 1) % 3], mid: PlanPoint = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    if (Math.abs(mid[1] - 45.4) < 0.01) continue;   // the back edge on the facade
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    wallQuad(acc, 'glass', a, c, BAY.y0, BAY.y1);
    for (let y = BAY.y0; y <= BAY.y1 + 0.01; y += (BAY.y1 - BAY.y0) / 8) strip(acc, 'frame', a, c, 0.02, L - 0.02, Math.max(BAY.y0, y - 0.07), Math.min(BAY.y1, y + 0.07), 0.08, 0);
    const k = Math.max(1, Math.round(L / 1.9));
    for (let j = 0; j <= k; j++) fin(acc, 'frame', a, c, Math.min(L - 0.05, Math.max(0.05, j * L / k)), 0.1, BAY.y0, BAY.y1, 0.08);
  }
  soffitQuad(acc, 'white', ring, BAY.y0);
  for (let i = 1; i + 1 < ring.length; i++) triOut(acc, 'white', [ring[0][0], BAY.y1, ring[0][1]], [ring[i][0], BAY.y1, ring[i][1]], [ring[i + 1][0], BAY.y1, ring[i + 1][1]], [0, 1, 0]);
}
