import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Frame} from './nearbar-kit';
import {Acc, edgeBox, fin, flatLetters, roof, soffit, strip, tube, wallQuad, type C} from './tier-kit';
import {edgeNormal, type PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';

/**
 * Gerrit Rietveld Academie, the Rietveld building, Fred. Roeskestraat 96 (BAG pand 0363100012077325, bouwjaar 1967;
 * G. Rietveld with J. van Dillen and J. van Tricht, designed 1957-1959, opened 1967; gemeentelijk monument 200479).
 * Native east/south metres from the BAG ring vertex average (gerrit-rietveld-academie-footprints.json, PDOK BAG WFS),
 * y above the 3DBAG ground 0.692 m NAP.
 *
 * The building is drawn in its own frame: u along the long axis (bearing 86.9, the BAG edges), v towards bearing 356.9
 * (the canal side). N(u, v) turns it into native metres.
 *
 * Evidence (scripts/landmarks/gerrit-rietveld-academie-inventory.json; register text of monument 200479):
 *  - The register: a 2.10 m module ("raster van 36 x 29 modulen van 210 x 210"), prefab concrete frames every 2.10 m,
 *    steel curtain walls held 40 cm off them, set straight against the deck plate with no gutter or edge trim; the
 *    lowered corridor ceilings show on the facade at the height of the transom lights; a white glazed-brick wall round
 *    the west head that stands proud of the curtain wall; the black glazed-brick wall shielding the entrance stair and
 *    landing (bordes) one metre up; the canopy and stair held apart from the facade; an iron fire stair on the west head;
 *    a one-storey hook-shaped workshop wing on the east with shed (saw-tooth) roofs; the lift tower and a set-back in the
 *    roof on the canal side.
 *  - The BAG ring: the curtain-wall block is 75.2 x 20.9 m, 36 x 10 modules of 2.09 m; the white wall is the 0.35 m
 *    step on the south, west and north of the west head (16.8, 21.7 and 12.6 m: 8, 10 and 6 modules).
 *  - Panorama TMX7316010203-001151_pano_0001_002208 (2019-04-30, north wall rectified at 38.1 px/m): 30 square modules
 *    on the 62.9 m segment; bottom to top a recessed dark sokkel with basement windows (1.8 m), a 1.05 m opaque sill band,
 *    then four clear 2.1 m vision bands alternating with three frosted 2.1 m bands (each split by the floor transom),
 *    and a short frosted band under the deck plate. 3DBAG roof 18.2 m.
 *  - Panorama ..._002201 (w11): the white wall on the north end, 6.9 m high, glazing above.
 *  - Commons pic1-pic4 (Alf van Beem, 2016, CC0): south front, white wall with GERRIT RIETVELD ACADEMIE in dark red
 *    capitals, the stair, black wall, canopy, the steel fire stair at the west end. Rietveldacademie.jpg (bMA 2007): the
 *    canal front, the basement band between piers, the main-stair bay without frosted bands.
 *  - PDOK orthophoto 2025 (CC BY 4.0): pale roof membrane, lift tower, roof set-back, a plant deck with six round white
 *    fans, the wing's ten north-light sheds and the transverse block's two groups of six darker sheds (2.1 m pitch).
 */

const TH = 3.0964714924943215 * Math.PI / 180, CS = Math.cos(TH), SN = Math.sin(TH);
type UV = [number, number];
/** Building frame (u east-ish, v north-ish) to native [x east, z south]. */
const N = ([u, v]: UV): PlanPoint => [u * CS - v * SN, -(u * SN + v * CS)];
const DIR = {N: [0, 1] as UV, S: [0, -1] as UV, E: [1, 0] as UV, W: [-1, 0] as UV};
type Side = keyof typeof DIR;
/** A plan edge in native metres, ordered so tier-kit's edgeNormal points to `out`. */
function edge(p: UV, q: UV, out: Side): [PlanPoint, PlanPoint] {
  const a = N(p), b = N(q), n = edgeNormal(a, b), o = N(DIR[out]);
  return n[0] * o[0] + n[1] * o[1] > 0 ? [a, b] : [b, a];
}
const len = (a: PlanPoint, b: PlanPoint) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const sub = (a: PlanPoint, b: PlanPoint, t0: number, t1: number): [PlanPoint, PlanPoint] => {
  const L = len(a, b), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return [[a[0] + u[0] * t0, a[1] + u[1] * t0], [a[0] + u[0] * t1, a[1] + u[1] * t1]];
};

// ---- the section, measured on the north wall (metres above the 3DBAG ground) ------------------------------------------
const SOK = 1.8, ROOF = 18.2, MOD = 2.09, RECESS = 0.6, WHITE = 7.05, PROUD = 0.35;
/** Frosted bands use the `pink` palette name (stucco slot, measured light grey-green): they read as opaque spandrels in the
 * photos, and the shared city look would dress a glass slot like the clear bands and lose the banding. */
type Row = {y0: number; y1: number; c: C; mid?: number};
const ROWS: Row[] = [
  {y0: SOK, y1: 2.85, c: 'pink'},
  {y0: 2.85, y1: 4.95, c: 'glass'}, {y0: 4.95, y1: 7.05, c: 'pink', mid: 6.0},
  {y0: 7.05, y1: 9.15, c: 'glass'}, {y0: 9.15, y1: 11.25, c: 'pink', mid: 10.2},
  {y0: 11.25, y1: 13.35, c: 'glass'}, {y0: 13.35, y1: 15.45, c: 'pink', mid: 14.4},
  {y0: 15.45, y1: 17.55, c: 'glass'}, {y0: 17.55, y1: ROOF, c: 'pink'},
];
/** The curtain-wall line of the main block and the white wall's outer line (building frame). */
const CW = {w: -38.6, e: 36.57, s: 5.6, n: 26.53};
const WW = {w: -38.97, s: 5.25, n: 26.88, eS: -22.19, eN: -26.36};
/** Rear roof set-back (3DBAG plane at 16.1 m; orthophoto notch) and the main-stair bay on the canal front. */
const MODU = (CW.e - CW.w) / 36, MODV = (CW.n - CW.s) / 10;
const uLine = (k: number) => CW.w + k * MODU;
/** Snapped to the module lines: 3DBAG u -15.8..-4.0, orthophoto notch -17..-3.5; modules 11-17. */
const SETBACK = {u0: uLine(11), u1: uLine(17), v0: 24.4, y: 16.1};
/** The main stair is straight opposite the entrance (register); the canal front shows it as a bay without frosted bands. */
const STAIR_BAY = {u0: uLine(10), u1: uLine(13)};
/** Wing (corridor strip and classrooms) and the transverse block, BAG ring. */
const WING = {w: 19.78, step: 23.7, e: 36.57, n: CW.s, s: -19.55, hCor: 3.6, h: 4.68};
const TRANS = {w: 2.95, e: 36.57, n: -19.55, s: -34.5, h: 4.68};

/**
 * One curtain wall: frosted and clear bands between y0 and y1 (clipped), 2.09 m mullions, a transom at every band edge
 * and at the floor inside each frosted band. `clear` ranges (metres along the edge) take clear glass in every band (the
 * stair bay, the entrance doors in the sill band when `clearFrom` is set).
 */
/** Positions along a->b (metres from a) of the global module lines that cross it (u lines on N/S faces, v lines on E/W). */
function modLines(a: PlanPoint, b: PlanPoint, axis: 'u' | 'v'): number[] {
  const L = len(a, b), t: number[] = [], ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  for (let k = -2; k <= 40; k++) {
    const g = axis === 'u' ? CW.w + k * MODU : CW.s + k * MODV;
    const p = N(axis === 'u' ? [g, 0] : [0, g]);
    // project the line's point onto the edge direction (lines are perpendicular to the edge)
    const q = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz;
    const along = q;
    if (along > -0.05 && along < L + 0.05) t.push(Math.min(L, Math.max(0, along)));
  }
  return t;
}
function curtain(acc: Acc, a: PlanPoint, b: PlanPoint, y0: number, y1: number, o: {clear?: [number, number][]; clearBelow?: number; modules?: number; lines?: number[]} = {}) {
  const L = len(a, b);
  const isClear = (t: number) => (o.clear ?? []).some(([c0, c1]) => t > c0 && t < c1);
  const cuts = [0, L, ...(o.clear ?? []).flat()].filter(t => t >= 0 && t <= L).sort((p, q) => p - q);
  for (const r of ROWS) {
    const ya = Math.max(r.y0, y0), yb = Math.min(r.y1, y1);
    if (yb - ya < 0.01) continue;
    for (let i = 0; i + 1 < cuts.length; i++) {
      if (cuts[i + 1] - cuts[i] < 0.01) continue;
      const clear = isClear((cuts[i] + cuts[i + 1]) / 2) && (o.clearBelow === undefined || r.y1 <= o.clearBelow + 0.01);
      const [p, q] = sub(a, b, cuts[i], cuts[i + 1]);
      wallQuad(acc, clear ? 'glass' : r.c, p, q, ya, yb);
    }
  }
  // transoms: band edges and floors (depth 6 cm); the lowest and the top one stop on the wall plane (soffit/roof meet)
  const ys = new Set<number>();
  for (const r of ROWS) { ys.add(r.y0); ys.add(r.y1); if (r.mid) ys.add(r.mid); }
  for (const y of [...ys].sort((p, q) => p - q)) {
    if (y < y0 - 0.01 || y > y1 + 0.01) continue;
    const lo = Math.max(y0, y - 0.045), hi = Math.min(y1, y + 0.045);
    strip(acc, 'frame', a, b, 0.06, L - 0.06, lo, hi, 0.06, y <= y0 + 0.05 || y >= y1 - 0.05 ? 0 : -0.02);
  }
  // mullions on the 2.09 m module (depth 10 cm: they stand proud of the transoms, no coplanar crossings)
  const n = o.modules ?? Math.max(1, Math.round(L / MOD));
  const lines = o.lines ?? Array.from({length: n + 1}, (_, i) => i * L / n);
  for (const t of [...new Set([0, L, ...lines].map(x => Math.round(x * 100) / 100))]) fin(acc, 'frame', a, b, Math.min(L - 0.045, Math.max(0.045, t)), 0.09, y0, y1, 0.1);
}

/** The recessed sokkel under a curtain wall: back wall 0.6 m in, a basement window between every pair of piers. */
function sokkel(acc: Acc, a: PlanPoint, b: PlanPoint, lines: number[], skip: [number, number][] = []) {
  const L = len(a, b), n = edgeNormal(a, b);
  const ia: PlanPoint = [a[0] - n[0] * RECESS, a[1] - n[1] * RECESS], ib: PlanPoint = [b[0] - n[0] * RECESS, b[1] - n[1] * RECESS];
  wallQuad(acc, 'stone', ia, ib, 0, SOK);
  const ts = [...new Set([0, L, ...lines].map(x => Math.round(x * 100) / 100))].sort((p, q) => p - q);
  for (const t of ts) fin(acc, 'concrete', ia, ib, Math.min(L - 0.16, Math.max(0.16, t)), 0.3, 0, SOK, RECESS - 0.005);
  for (let i = 0; i + 1 < ts.length; i++) {
    const t0 = ts[i] + 0.4, t1 = ts[i + 1] - 0.4;
    if (t1 - t0 < 0.5) continue;
    if (skip.some(([s0, s1]) => t1 > s0 && t0 < s1)) continue;
    strip(acc, 'glass', ia, ib, t0, t1, 0.55, 1.45, 0.06);
  }
}

/** Workshop-wing wall: steel and glass on the module, a grey sill panel and fascia (courtyard face, Commons GRA_bijgebouw). */
function wingWall(acc: Acc, a: PlanPoint, b: PlanPoint, top: number) {
  const L = len(a, b), sill = 0.9, fas = top - 0.85;
  wallQuad(acc, 'stone', a, b, 0, sill);
  wallQuad(acc, 'glass', a, b, sill, fas);
  wallQuad(acc, 'stone', a, b, fas, top);
  strip(acc, 'frame', a, b, 0.06, L - 0.06, sill - 0.04, sill + 0.04, 0.06);
  strip(acc, 'frame', a, b, 0.06, L - 0.06, fas - 0.04, fas + 0.04, 0.06);
  const k = Math.max(1, Math.round(L / MOD)), p = L / k;
  for (let i = 0; i <= k; i++) fin(acc, 'frame', a, b, Math.min(L - 0.045, Math.max(0.045, i * p)), 0.09, sill, fas, 0.1);
}

type V3 = [number, number, number];
const P3 = (uv: UV, y: number): V3 => { const p = N(uv); return [p[0], y, p[1]]; };
function triOut(acc: Acc, c: C, p: V3, q: V3, r: V3, out: V3) {
  const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * out[0] + cy * out[1] + cz * out[2] >= 0) acc.tri(c, p, q, r); else acc.tri(c, p, r, q);
}
const outV = (uv: UV, y: number): V3 => { const p = N(uv); return [p[0], y, p[1]]; };

/**
 * North-light sheds on a flat roof: `count` teeth of `pitch` along v from v0, between u0 and u1. Each tooth: an opaque
 * slope rising northwards over two thirds of the pitch, a glazed face falling to the next tooth, gable triangles at both
 * ends (orthophoto: light slopes and dark glazed faces in 2.1 m stripes).
 */
function sheds(acc: Acc, u0: number, u1: number, v0: number, count: number, pitch: number, y: number, rise: number, slope: C) {
  for (let k = 0; k < count; k++) {
    const vs = v0 + k * pitch, vh = vs + pitch * 0.67, ve = vs + pitch, yt = y + rise;
    const up: V3 = outV([0, 0], 1);
    const sOut = (dir: UV): V3 => { const d = N(dir); return [d[0], 0.6, d[1]]; };
    triOut(acc, slope, P3([u0, vs], y), P3([u1, vs], y), P3([u1, vh], yt), sOut(DIR.S));
    triOut(acc, slope, P3([u0, vs], y), P3([u1, vh], yt), P3([u0, vh], yt), sOut(DIR.S));
    triOut(acc, 'glass', P3([u0, vh], yt), P3([u1, vh], yt), P3([u1, ve], y), sOut(DIR.N));
    triOut(acc, 'glass', P3([u0, vh], yt), P3([u1, ve], y), P3([u0, ve], y), sOut(DIR.N));
    void up;
    for (const [u, side] of [[u0, DIR.W], [u1, DIR.E]] as [number, UV][]) {
      const d = N(side);
      triOut(acc, 'stone', P3([u, vs], y), P3([u, vh], yt), P3([u, ve], y), [d[0], 0, d[1]]);
    }
  }
}

/** A box in the building frame: u0..u1, v0..v1, y0..y1 (BoxGeometry turned onto the building axis). */
function ubox(b: BuildingTools, c: C, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number) {
  const g = new T.BoxGeometry(u1 - u0, y1 - y0, v1 - v0);
  g.rotateY(TH);
  const m = N([(u0 + u1) / 2, (v0 + v1) / 2]);
  g.translate(m[0], (y0 + y1) / 2, m[1]);
  b.add(g, c);
}
const ring = (pts: UV[]) => pts.map(N);

export function buildGerritRietveldAcademie(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);

  // ---- main block: canal (north) front -------------------------------------------------------------------------------
  {
    const [a, c] = edge([WW.eN, CW.n], [CW.e, CW.n], 'N');   // east of the white wall
    const L = len(a, c), lines = modLines(a, c, 'u');
    const tOf = (u: number) => len(a, N([u, CW.n]));
    const span = (u0: number, u1: number): [number, number] => { const p = tOf(u0), q = tOf(u1); return [Math.min(p, q), Math.max(p, q)]; };
    const sb = span(SETBACK.u0, SETBACK.u1), st = span(STAIR_BAY.u0, STAIR_BAY.u1);
    // three runs: either side of the set-back to the roof, the set-back's stretch up to its terrace
    for (const [t0, t1, top] of [[0, sb[0], ROOF], [sb[0], sb[1], SETBACK.y], [sb[1], L, ROOF]] as [number, number, number][]) {
      const [p, q] = sub(a, c, t0, t1);
      curtain(acc, p, q, SOK, top, {clear: [[st[0] - t0, st[1] - t0]], lines: lines.map(t => t - t0).filter(t => t > -0.01 && t < t1 - t0 + 0.01)});
    }
    sokkel(acc, a, c, lines);
  }
  // the white wall's stretch of the north front: curtain above the wall only
  { const [a, c] = edge([CW.w, CW.n], [WW.eN, CW.n], 'N'); curtain(acc, a, c, WHITE, ROOF, {lines: modLines(a, c, 'u')}); }

  // ---- east head ----
  { const [a, c] = edge([CW.e, CW.s], [CW.e, CW.n], 'E'), lines = modLines(a, c, 'v'); curtain(acc, a, c, SOK, ROOF, {lines}); sokkel(acc, a, c, lines); }
  // ---- west head: curtain above the white wall ----
  { const [a, c] = edge([CW.w, CW.s], [CW.w, CW.n], 'W'); curtain(acc, a, c, WHITE, ROOF, {lines: modLines(a, c, 'v')}); }

  // ---- south front (entrance side) ----
  const ENTR = {u0: uLine(10), u1: uLine(13)};   // three modules of doors in the sill band, behind the canopy
  {
    const [a, c] = edge([WW.eS, CW.s], [WING.w, CW.s], 'S');
    const tOf = (u: number) => len(a, N([u, CW.s]));
    const e0 = Math.min(tOf(ENTR.u0), tOf(ENTR.u1)), e1 = Math.max(tOf(ENTR.u0), tOf(ENTR.u1));
    const lines = modLines(a, c, 'u');
    curtain(acc, a, c, SOK, ROOF, {clear: [[e0, e1]], clearBelow: 2.85, lines});
    // no basement windows behind the landing, steps and black wall (u -23 to -4.2; pic3 shows only the wall there)
    const k0 = tOf(-23), k1 = tOf(-4.2);
    sokkel(acc, a, c, lines, [[Math.min(k0, k1), Math.max(k0, k1)]]);
  }
  { const [a, c] = edge([CW.w, CW.s], [WW.eS, CW.s], 'S'); curtain(acc, a, c, WHITE, ROOF, {lines: modLines(a, c, 'u')}); }
  { const [a, c] = edge([WING.w, CW.s], [WING.step, CW.s], 'S'); curtain(acc, a, c, WING.hCor, ROOF, {lines: modLines(a, c, 'u')}); }
  { const [a, c] = edge([WING.step, CW.s], [CW.e, CW.s], 'S'); curtain(acc, a, c, WING.h, ROOF, {lines: modLines(a, c, 'u')}); }

  // sokkel ends: the white wall's end caps carried back to the recess, the wing's corridor wall closing the south recess,
  // the east recess closed where the wing's east wall carries on
  { const [a, c] = edge([WW.eS, WW.s], [WW.eS, CW.s + RECESS], 'E'); wallQuad(acc, 'white', a, c, 0, SOK); }
  { const [a, c] = edge([WW.eS, WW.s], [WW.eS, CW.s], 'E'); wallQuad(acc, 'white', a, c, SOK, WHITE); }
  { const [a, c] = edge([WW.eN, CW.n - RECESS], [WW.eN, WW.n], 'E'); wallQuad(acc, 'white', a, c, 0, SOK); }
  { const [a, c] = edge([WW.eN, CW.n], [WW.eN, WW.n], 'E'); wallQuad(acc, 'white', a, c, SOK, WHITE); }
  { const [a, c] = edge([WING.w, CW.s], [WING.w, CW.s + RECESS], 'W'); wallQuad(acc, 'stone', a, c, 0, SOK); }
  { const [a, c] = edge([CW.e - RECESS, CW.s], [CW.e, CW.s], 'N'); wallQuad(acc, 'stone', a, c, 0, SOK); }
  // soffits over the recess (three rectangles, not overlapping at the north-east corner)
  soffit(b, [[ring([[WW.eN, CW.n - RECESS], [CW.e, CW.n - RECESS], [CW.e, CW.n], [WW.eN, CW.n]])]], SOK, 'concrete');
  soffit(b, [[ring([[CW.e - RECESS, CW.s], [CW.e, CW.s], [CW.e, CW.n - RECESS], [CW.e - RECESS, CW.n - RECESS]])]], SOK, 'concrete');
  soffit(b, [[ring([[WW.eS, CW.s], [WING.w, CW.s], [WING.w, CW.s + RECESS], [WW.eS, CW.s + RECESS]])]], SOK, 'concrete');

  // ---- the white glazed-brick wall round the west head (0.35 m proud, 7.05 m) ----
  for (const [p, q, s] of [[[WW.eS, WW.s], [WW.w, WW.s], 'S'], [[WW.w, WW.s], [WW.w, WW.n], 'W'], [[WW.w, WW.n], [WW.eN, WW.n], 'N']] as [UV, UV, Side][]) {
    const [a, c] = edge(p, q, s);
    wallQuad(acc, 'white', a, c, 0, WHITE);
  }
  // its cap, between the outer face and the curtain line
  roof(b, [[ring([[WW.eS, WW.s], [WW.eS, CW.s], [CW.w, CW.s], [CW.w, CW.n], [WW.eN, CW.n], [WW.eN, WW.n], [WW.w, WW.n], [WW.w, WW.s]])]], WHITE, 'white');
  // GERRIT RIETVELD ACADEMIE, dark-red capitals on the south face, ending 0.7 m short of the wall's east end (Commons pic2)
  {
    const o = N([WW.w, WW.s]), e = N([WW.eS, WW.s]), L = len(o, e), nn = N(DIR.S);
    const f: Frame = {origin: o, tangent: [(e[0] - o[0]) / L, (e[1] - o[1]) / L], n: nn};
    flatLetters(acc, f, 'GERRIT RIETVELD ACADEMIE', L - 0.7 - (24 * 6 - 1) * 0.046 / 2, 3.95, 0.06, 0.046, 'green');
  }

  // ---- roofs ----
  roof(b, [[ring([[CW.w, CW.s], [CW.e, CW.s], [CW.e, CW.n], [SETBACK.u1, CW.n], [SETBACK.u1, SETBACK.v0], [SETBACK.u0, SETBACK.v0], [SETBACK.u0, CW.n], [CW.w, CW.n]])]], ROOF, 'slate');
  // the set-back: terrace at 16.1 m, its back and side walls glazed on the module
  roof(b, [[ring([[SETBACK.u0, SETBACK.v0], [SETBACK.u1, SETBACK.v0], [SETBACK.u1, CW.n], [SETBACK.u0, CW.n]])]], SETBACK.y, 'bronze');
  { const [a, c] = edge([SETBACK.u0, SETBACK.v0], [SETBACK.u1, SETBACK.v0], 'N'); curtain(acc, a, c, SETBACK.y, ROOF); }
  { const [a, c] = edge([SETBACK.u0, SETBACK.v0], [SETBACK.u0, CW.n], 'E'); curtain(acc, a, c, SETBACK.y, ROOF, {modules: 1}); }
  { const [a, c] = edge([SETBACK.u1, SETBACK.v0], [SETBACK.u1, CW.n], 'W'); curtain(acc, a, c, SETBACK.y, ROOF, {modules: 1}); }
  // lift and stair tower (3DBAG 20.3 m and its 21.1 m head), plant decks (19.7, 20.2 m); sunk 0.3 m into the roof
  ubox(b, 'concrete', -7.6, -2.7, 17.9, SETBACK.v0 - 0.12, ROOF - 0.3, 20.33);   // just behind the set-back's glazed back wall
  ubox(b, 'concrete', -4.7, -2.8, 20.0, 23.4, 20.0, 21.06);
  ubox(b, 'frame', 10.8, 23.5, 15.0, 17.2, ROOF - 0.3, 19.7);
  ubox(b, 'frame', 24.8, 31.2, 14.3, 17.7, ROOF - 0.3, 20.2);
  // six round white fans on the low plant deck (orthophoto)
  for (let i = 0; i < 6; i++) {
    const p = N([11.9 + i * 2.1, 16.1]);
    const g = new T.CylinderGeometry(0.85, 0.85, 0.5, 14, 1, false);
    g.translate(p[0], 19.7 - 0.2 + 0.25, p[1]);
    b.add(g, 'white');
  }

  // ---- entrance: bordes, steps, canopy held off the facade on slim posts, black glazed-brick wall ----
  ubox(b, 'concrete', -21.85, -6.5, 1.55, CW.s, -0.3, SOK);
  for (let k = 0; k < 8; k++) {
    const h = SOK * (k + 1) / 9;   // eight risers down to the plaza, treads 0.32 m
    ubox(b, 'concrete', -21.85, -15.4, 1.55 - (8 - k) * 0.32, 1.55 - (7 - k) * 0.32, -0.3, h);
  }
  ubox(b, 'concrete', -19.0, -6.5, 1.2, CW.s - 0.3, 5.0, 5.3);   // just under the white wall's top in pic3
  for (const u of [-18.6, -12.75, -6.9]) b.add(tube(N([u, 1.45]), SOK, N([u, 1.45]), 5.0, 0.06, 8), 'bronze');
  ubox(b, 'greyBrick', -15.2, -6.5, 1.25, 1.55, -0.3, 2.75);
  ubox(b, 'greyBrick', -6.8, -6.5, -6.0, 1.25, -0.3, 2.75);
  // stair railing on the plaza side of the steps
  for (const v of [1.4, -1.0]) b.add(tube(N([-21.7, v]), v > 0 ? SOK + 1.0 : 1.0, N([-21.7, v]), 0, 0.03, 6), 'bronze');
  b.add(tube(N([-21.7, 1.4]), SOK + 1.0, N([-21.7, -1.0]), 1.0, 0.03, 6), 'bronze');

  // ---- the iron fire stair on the west head (Commons pic1, pic3; register) ----
  {
    const uo = WW.w - 1.4, ui = WW.w - 0.12, um = (uo + ui) / 2, v0 = 10.0, v1 = 14.4;
    const levels = [0, 6.0, 10.2, 14.4, ROOF];
    for (let i = 1; i < levels.length; i++) {
      const y = levels[i], ym = (levels[i - 1] + y) / 2;
      ubox(b, 'bronze', uo, ui, v1, v1 + 1.3, y - 0.12, y);            // floor landing at the door
      ubox(b, 'bronze', uo, ui, v0 - 1.3, v0, ym - 0.12, ym);          // half landing
      // two flights as inclined stringer slabs
      b.add(tube(N([(uo + um) / 2, v1]), levels[i - 1], N([(uo + um) / 2, v0]), ym, 0.3, 4), 'bronze');
      b.add(tube(N([(um + ui) / 2, v0]), ym, N([(um + ui) / 2, v1]), y, 0.3, 4), 'bronze');
    }
    for (const [u, v] of [[uo, v0 - 1.3], [uo, v1 + 1.3]] as UV[]) b.add(tube(N([u + 0.05, v]), 0, N([u + 0.05, v]), ROOF + 1.1, 0.06, 6), 'bronze');
    // outer railing rail along the stair
    b.add(tube(N([uo + 0.05, v0 - 1.3]), ROOF + 1.0, N([uo + 0.05, v1 + 1.3]), ROOF + 1.0, 0.03, 6), 'bronze');
  }

  // ---- workshop wing: corridor strip (3.6 m) and classrooms (4.68 m) with north-light sheds ----
  { const [a, c] = edge([WING.w, WING.s], [WING.w, WING.n], 'W'); wingWall(acc, a, c, WING.hCor); }
  { const [a, c] = edge([WING.step, WING.s], [WING.step, WING.n], 'W'); wallQuad(acc, 'stone', a, c, WING.hCor, WING.h); }
  { const [a, c] = edge([WING.w, TRANS.n], [WING.step, TRANS.n], 'N'); wallQuad(acc, 'stone', a, c, WING.hCor, TRANS.h); }
  { const [a, c] = edge([TRANS.w, TRANS.n], [WING.w, TRANS.n], 'N'); wingWall(acc, a, c, TRANS.h); }
  { const [a, c] = edge([TRANS.w, TRANS.s], [TRANS.w, TRANS.n], 'W'); wingWall(acc, a, c, TRANS.h); }
  { const [a, c] = edge([TRANS.w, TRANS.s], [TRANS.e, TRANS.s], 'S'); wingWall(acc, a, c, TRANS.h); }
  { const [a, c] = edge([TRANS.e, TRANS.s], [TRANS.e, CW.s], 'E'); wingWall(acc, a, c, TRANS.h); }
  roof(b, [[ring([[WING.w, WING.s], [WING.step, WING.s], [WING.step, WING.n], [WING.w, WING.n]])]], WING.hCor, 'bronze');
  roof(b, [[ring([[TRANS.w, TRANS.s], [TRANS.e, TRANS.s], [TRANS.e, CW.s], [WING.step, CW.s], [WING.step, TRANS.n], [TRANS.w, TRANS.n]])]], TRANS.h, 'bronze');
  sheds(acc, 26.2, 35.8, -18.5, 10, 2.1, WING.h, 1.47, 'copper');
  sheds(acc, 6.2, 17.5, -33.0, 6, 2.1, TRANS.h, 1.47, 'bronze');
  sheds(acc, 21.0, 35.0, -33.0, 6, 2.1, TRANS.h, 1.47, 'bronze');

  acc.flush();
}
