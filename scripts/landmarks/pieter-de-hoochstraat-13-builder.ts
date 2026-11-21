import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, roofHeightAt, slab, type Frame} from './nearbar-kit';
import {addPolys, face, flushFaces, geom, opening, resetFaces, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './pieter-de-hoochstraat-13-footprints.json';

/**
 * PIETER DE HOOCHSTRAAT 13-25 (+ Hobbemakade and the south corner; BAG pand 0363100012121704, 2000): a perimeter block of
 * flats over a hotel lobby and shops, under a glass-and-steel roof storey that overhangs every street front
 * (hand-blocks-b-20261121, routed to hand by docs/reports/block-sized-triage-20261121.md: three fronts the kit cannot say).
 * Massing: the 3DBAG LoD2.2 shell (pieter-de-hoochstraat-13-footprints.json, bag-shell-prepare.ts); the east half's roof is
 * at 22.6 m, the west half's at 25.3 m. Every rectangular street wall reaching the roof storey on the east, south and west,
 * and the west's garden-level storey, is rebuilt as a holed face; the shell draws the rest.
 * Fronts, read off the rectified Gemeente Amsterdam panoramas (CC BY 4.0) in pieter-de-hoochstraat-13-inventory.json:
 *  - east, Hobbemakade (w01-88 2020, w02-88 2024): brown-purple brick, four storeys of small punched windows in groups of
 *    two to four between red-framed glazed bay stacks (single and double). The BAG ring's 0.33 m proud strips are the
 *    bays; two more bays hang over the hotel lobby, whose glazing runs two storeys at the south end. The other ground
 *    floor is dark-green framed glazing between grey piers;
 *  - south (w03-179, w05-181): the same brick, punched windows, ground glazing (its bays are not placed: inferred);
 *  - west, Pieter de Hoochstraat behind front gardens (w06..w19-269): orange-red brick, white glazed bay stacks of five
 *    storeys over the six 4 m proud strips of the garden-level storey, which carries a green balcony band;
 *  - all round: a dark recess over the brick, then the green steel-and-glass roof storey cantilevered 1.6 m, a steep
 *    glazed face and a glazed slope landing on the wall top (two runs, one per roof height).
 * The north side is a party wall (no panorama, partyWallBearings in the spec): shell colours.
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// palette names; materialOverrides in the spec give the measured colours
const BRICK: Col = 'brick', GARDEN: Col = 'ochre', RED: Col = 'red', WHITEBAY: Col = 'stone', PIER: Col = 'concrete';
const DARK: Col = 'dark', RECESS: Col = 'greyBrick', METAL: Col = 'green', ROOFGLASS: Col = 'canopyGlass';

type P2 = [number, number];
type Side = 'E' | 'S' | 'W';
const BRICK_TOP = 15.9, BAY_TOP = 15.6, BRICK_TOP_W = 17.3;

// ---- the shell's walls (valkenburgerstraat-69 machinery) -------------------------------------------------------------
type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; rect: boolean};
function wallInfo(s: Surface, i: number): WallInfo | null {
  const r = s.rings[0], ys = r.map(p => p[1]), yt = Math.max(...ys), yb = Math.min(...ys);
  let nx = 0, nz = 0;
  for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
  const nl = Math.hypot(nx, nz);
  if (nl < 1e-6) return null;
  let n: P2 = [nx / nl, nz / nl];
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  const front = roofHeightAt(src.surfaces, cx + n[0] * 0.5, cz + n[1] * 0.5) ?? -1, back = roofHeightAt(src.surfaces, cx - n[0] * 0.5, cz - n[1] * 0.5) ?? -1;
  if (front > back) n = [-n[0], -n[1]];
  const tangent: P2 = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts), t1 = Math.max(...ts), len = t1 - t0;
  const off = cx * n[0] + cz * n[1];
  const f: Frame = {origin: [tangent[0] * t0 + n[0] * off, tangent[1] * t0 + n[1] * off], tangent, n};
  let area = 0;
  for (let k = 0; k < r.length; k++) { const c = (k + 1) % r.length; area += ts[k] * r[c][1] - ts[c] * r[k][1]; }
  const rect = r.every((_, k) => Math.abs(ts[k] - t0) < 0.05 || Math.abs(ts[k] - t1) < 0.05)
    && Math.abs(area / 2) > 0.985 * len * (yt - yb) && r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08);
  return {i, f, len, yb, yt, cx, cz, rect};
}
const frOf = (w: WallInfo): FR => ({f: w.f, len: w.len});
/** Faces of one wall piece split into colour bands; returns the face covering y. */
function bandFaces(w: WallInfo, cuts: [number, Col][]): (y: number) => Face {
  const F = frOf(w), faces: Face[] = [];
  let y = w.yb;
  for (const [top, c] of cuts) {
    const y1 = Math.min(top, w.yt);
    if (y1 - y > 0.02) faces.push(face(F, y, y1, c));
    y = Math.max(y, y1);
    if (y >= w.yt - 1e-6) break;
  }
  if (w.yt - y > 0.02) faces.push(face(F, y, w.yt, cuts[cuts.length - 1][1]));
  return yy => faces.find(f => yy >= f.y0 - 1e-6 && yy < f.y1 - 1e-6) ?? faces[faces.length - 1];
}
/** An opening at t (centre) cut into whichever band face holds its sill, when it fits. */
function cut(b: BuildingTools, faceAt: (y: number) => Face, t: number, w: number, y: [number, number], o: OpenOpts = {}) {
  const F = faceAt(y[0] + 0.01);
  if (y[0] < F.y0 - 1e-6 || y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < y[1] + 0.05 && y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, y[0], w, y[1] - y[0], {depth: 0.18, frame: 'frame', sill: false, ...o});
}

// ---- storeys ---------------------------------------------------------------------------------------------------------
// east and south (w01-88 at 35 px/m): ground 0-3.2, four storeys of punched windows, brick to 15.9
const ROWS_E: [number, number][] = [[4.25, 5.85], [7.2, 8.85], [10.15, 11.8], [13.05, 14.65]];
const BAY_E: [number, number][] = [[3.45, 5.95], [6.4, 8.9], [9.35, 11.85], [12.3, 14.8]];
// west garden side, the 3DBAG's higher half (w10/w11-269): a garden-level storey to ~4.1 m projecting under the green
// balcony band, then five storeys of 2.6 m in the set-back upper wall, brick to 17.3
const FLOORS_W = [4.1, 6.7, 9.3, 11.9, 14.5];
const ROWS_W: [number, number][] = FLOORS_W.map(f => [f + 0.8, f + 2.25]);
const BAY_W: [number, number][] = FLOORS_W.map(f => [f + 0.2, f + 2.4]);

const sash: OpenOpts = {depth: 0.12, frame: 'frame', bars: [1.0], edge: 0.07};
const punched = (frame: Col): OpenOpts => ({depth: 0.2, frame, edge: 0.06});

function bayUnits(b: BuildingTools, faceAt: (y: number) => Face, L: number, rows: [number, number][]) {
  for (const y of rows) {
    if (L > 3) { const w = (L - 0.75) / 2; cut(b, faceAt, 0.3 + w / 2, w, y, sash); cut(b, faceAt, L - 0.3 - w / 2, w, y, sash); }
    else cut(b, faceAt, L / 2, L - 0.45, y, sash);
  }
}
/** A glazed bay stack standing 0.33 m proud of a wall piece: closed box, holed front. */
function hangingBay(b: BuildingTools, F: FR, t0: number, t1: number, y0: number, y1: number, c: Col, rows: [number, number][]) {
  const p = 0.33, L = t1 - t0;
  addPolys(b, F.f, [
    {pts: [[t0, y0, 0], [t0, y0, p], [t0, y1, p], [t0, y1, 0]]},
    {pts: [[t1, y0, p], [t1, y0, 0], [t1, y1, 0], [t1, y1, p]]},
    {pts: [[t0, y1, p], [t1, y1, p], [t1, y1, 0], [t0, y1, 0]]},
    {pts: [[t0, y0, 0], [t1, y0, 0], [t1, y0, p], [t0, y0, p]]},
  ], c);
  const fc = face(sub(F, t0, L, p), y0, y1, c);
  bayUnits(b, () => fc, L, rows);
}

// ---- layouts per side, in a side parameter (E: metres along the BAG line from the south corner; S: x; W: z) ----------
type Bay = {p: [number, number]; y: [number, number]; c: Col; rows: [number, number][]};
type Layout = {bays: Bay[]; groups: [number, number, number][]};
const E_A: P2 = [24.254, 28.738], E_B: P2 = [21.414, -42.83];
const E_LEN = Math.hypot(E_B[0] - E_A[0], E_B[1] - E_A[1]), E_U: P2 = [(E_B[0] - E_A[0]) / E_LEN, (E_B[1] - E_A[1]) / E_LEN];
const LOBBY = 18.3;
// east: bays from the BAG ring's 0.33 m proud strips (w01-88: trio, double, trio, single, quad, single, trio, double, trio,
// single, pair from the south end of w01), plus two bays hanging over the hotel lobby (w02-88)
const E_LAYOUT: Layout = {
  bays: [[2.9, 5.1, 6.3], [10.3, 14.4, 6.3], [18.4, 20.1], [26.2, 27.9], [32.7, 36.3], [41.1, 42.9], [49.0, 50.7], [55.5, 59.1], [63.9, 65.7]]
    .map(([a, c, y0 = 3.2]) => ({p: [a, c] as [number, number], y: [y0, BAY_TOP] as [number, number], c: RED, rows: BAY_E.filter(r => r[0] > y0)})),
  groups: [[0, 2.9, 2], [5.1, 10.3, 3], [14.4, 18.4, 3], [20.1, 26.2, 4], [27.9, 32.7, 3], [36.3, 41.1, 3], [42.9, 49.0, 4], [50.7, 55.5, 3], [59.1, 63.9, 3], [65.7, 69.3, 2]],
};
// west: white bay stacks over the six 4 m proud strips of the garden-level storey (w06/w10/w11/w14-269)
const W_BAYS: [number, number][] = [[-38.1, -34.1], [-26.1, -22.1], [-14.1, -10.1], [-2.1, 1.9], [10.0, 14.0], [22.0, 26.0]];
const W_LAYOUT: Layout = {
  bays: W_BAYS.map(p => ({p, y: [4.3, BRICK_TOP_W - 0.2] as [number, number], c: WHITEBAY, rows: BAY_W})),
  groups: [-40.7, ...W_BAYS.flat(), 28.8].reduce<[number, number, number][]>((g, _, k, a) => (k % 2 === 0 && k + 1 < a.length ? [...g, [a[k], a[k + 1], Math.max(1, Math.round((a[k + 1] - a[k]) / 1.9))]] : g), []),
};
const S_GROUPS: [number, number, number][] = [[-20.8, -11.3, 5], [-10.0, 22.9, 17]];

/** Side parameter of a world point. */
const param = (side: Side, x: number, z: number) => (side === 'E' ? (x - E_A[0]) * E_U[0] + (z - E_A[1]) * E_U[1] : side === 'S' ? x : z);
/** Wall-piece t for a side parameter p. */
function tOf(w: WallInfo, side: Side) {
  const p0 = param(side, w.f.origin[0], w.f.origin[1]), p1 = param(side, w.f.origin[0] + w.f.tangent[0] * w.len, w.f.origin[1] + w.f.tangent[1] * w.len);
  return {p0, p1, t: (p: number) => (p - p0) / (p1 - p0) * w.len, lo: Math.min(p0, p1), hi: Math.max(p0, p1)};
}
/** The part of [a, c] (side parameter) on this piece, as a t range, when at least `min` long. */
function clip(T: ReturnType<typeof tOf>, a: number, c: number, L: number, min = 0.6): [number, number] | null {
  const t0 = Math.max(0.08, Math.min(T.t(a), T.t(c))), t1 = Math.min(L - 0.08, Math.max(T.t(a), T.t(c)));
  return t1 - t0 >= min ? [t0, t1] : null;
}

/** Higher west half of the block (3DBAG roof at 25.3 m west of x = -11.35). */
const highHalf = (w: WallInfo, side: Side) => side === 'W' || (side === 'S' && w.cx < -11.35);

function streetPiece(b: BuildingTools, w: WallInfo, side: Side, after: (() => void)[]) {
  const L = w.len, T = tOf(w, side), high = highHalf(w, side);
  if (side === 'E') {
    const lobby = T.lo < LOBBY - 1;
    // the bay this piece is (a proud strip), if any
    const own = E_LAYOUT.bays.find(B => L < 4.8 && Math.min(T.hi, B.p[1]) - Math.max(T.lo, B.p[0]) > 0.8 * L);
    const faceAt = own ? bandFaces(w, [[3.2, PIER], [BAY_TOP, RED], [99, RECESS]])
      : bandFaces(w, [[lobby ? 6.3 : 3.2, PIER], [BRICK_TOP, BRICK], [99, RECESS]]);
    if (own) { bayUnits(b, faceAt, L, own.rows); return; }
    if (lobby) for (const [a, c] of [[0.3, 5.0], [5.3, 12.2], [12.5, 18.0]]) {
      const r = clip(T, a, c, L);
      if (r) cut(b, faceAt, (r[0] + r[1]) / 2, r[1] - r[0], [0.15, 6.05], {depth: 0.3, frame: DARK, cols: Math.max(1, Math.round((r[1] - r[0]) / 1.3)), bars: [3.3], edge: 0.08});
    }
    for (const [a, c, n] of E_LAYOUT.groups) {
      for (let k = 0; k < n; k++) {
        const p = a + (k + 0.5) * (c - a) / n, t = T.t(p);
        for (const y of p < LOBBY ? ROWS_E.slice(1) : ROWS_E) cut(b, faceAt, t, 0.9, y, punched(RED));
      }
      // ground: dark-green framed glazing between grey piers, one window per group (w01-88)
      const r = a >= LOBBY - 0.1 ? clip(T, a + 0.3, c - 0.3, L) : null;
      if (r) cut(b, faceAt, (r[0] + r[1]) / 2, r[1] - r[0], [0.7, 3.0], {depth: 0.25, frame: DARK, cols: Math.max(1, Math.round((r[1] - r[0]) / 1.25)), edge: 0.06});
    }
    for (const B of E_LAYOUT.bays) {
      const r = clip(T, B.p[0], B.p[1], L, 1.2);
      if (r) after.push(() => hangingBay(b, frOf(w), r[0], r[1], B.y[0], B.y[1], B.c, B.rows));
    }
    return;
  }
  if (side === 'W') {
    const faceAt = bandFaces(w, [[BRICK_TOP_W, GARDEN], [99, RECESS]]);
    const rows = w.yb < 0.5 ? [[0.9, 2.5] as [number, number], ...ROWS_W] : ROWS_W;
    for (const [a, c, n] of W_LAYOUT.groups) for (let k = 0; k < n; k++) for (const y of rows) cut(b, faceAt, T.t(a + (k + 0.5) * (c - a) / n), 0.9, y, punched(RED));
    for (const B of W_LAYOUT.bays) {
      const r = clip(T, B.p[0], B.p[1], L, 1.2);
      if (r) after.push(() => hangingBay(b, frOf(w), r[0], r[1], Math.max(B.y[0], w.yb + 0.1), B.y[1], B.c, B.rows.filter(y => y[0] > w.yb + 0.15)));
    }
    return;
  }
  // south (w03-179, w05-181): the east half like the east front over a glass-block plinth; the west half like the garden side
  const faceAt = bandFaces(w, high ? [[BRICK_TOP_W, GARDEN], [99, RECESS]] : [[3.2, PIER], [BRICK_TOP, BRICK], [99, RECESS]]);
  const rows = high ? ROWS_W : ROWS_E;
  for (const [a, c, n] of S_GROUPS) for (let k = 0; k < n; k++) for (const y of rows) cut(b, faceAt, T.t(a + (k + 0.5) * (c - a) / n), 0.9, y, punched(RED));
  if (!high) { const r = clip(T, T.lo + 0.4, T.hi - 0.4, L); if (r) cut(b, faceAt, (r[0] + r[1]) / 2, r[1] - r[0], [Math.max(0.7, w.yb + 0.3), 3.0], {depth: 0.25, frame: DARK, cols: Math.max(1, Math.round((r[1] - r[0]) / 1.25)), edge: 0.06}); }
}

/** The garden-level storey on the west (0-4.3 m, ahead of the upper wall): brick, a row of windows, the green balcony band. */
function gardenStorey(b: BuildingTools, w: WallInfo) {
  const faceAt = bandFaces(w, [[99, GARDEN]]), n = Math.max(1, Math.round(w.len / 1.9));
  for (let k = 0; k < n; k++) cut(b, faceAt, (k + 0.5) * w.len / n, Math.min(1.2, w.len / n - 0.5), [0.9, 2.5], punched(RED));
  slab(b, w.f, w.len / 2, w.yt, w.len, 1.0, 0.06, METAL, -0.06);
}

// ---- the overhanging glass roof storey: two runs (the east half at 22.6 m, the higher west half at 25.3 m), each a closed
// tube lofted along an offset polyline -----------------------------------------------------------------------------------
type Run = {pts: P2[]; prof: [number, number][]};
// (outward offset from the run line, height): soffit, fascia, steep glass, glazed slope landing just past the wall line
// over the 3DBAG wall top, a lid 8 cm over the flat roof, and an inner face closing the tube
const prof = (soffit: number, steepTop: number, eave: number, back: number): [number, number][] =>
  [[back, soffit], [1.6, soffit], [1.6, soffit + 0.6], [1.3, steepTop], [0.15, eave + 0.08], [back, eave + 0.08], [back, soffit]];
const RUN_E: Run = {pts: [[21.45, -40.4], [24.3, 28.5], [-11.35, 29.55]], prof: prof(17.3, 20.5, 22.6, -1.0)};
const RUN_W: Run = {pts: [[-11.35, 28.9], [-21.0, 28.9], [-22.25, -40.5]], prof: prof(18.6, 23.2, 25.4, -1.0)};
function attic(b: BuildingTools, run: Run) {
  const C: P2 = [0, -6], A = run.pts, n = A.length, N: P2[] = [], PROFILE = run.prof;
  for (let i = 0; i + 1 < n; i++) {
    const a = A[i], c = A[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    let v: P2 = [(c[1] - a[1]) / L, -(c[0] - a[0]) / L];
    if (v[0] * ((a[0] + c[0]) / 2 - C[0]) + v[1] * ((a[1] + c[1]) / 2 - C[1]) < 0) v = [-v[0], -v[1]];
    N.push(v);
  }
  const off = (i: number, d: number): P2 => {
    const p = A[i];
    if (i === 0) return [p[0] + N[0][0] * d, p[1] + N[0][1] * d];
    if (i === n - 1) return [p[0] + N[n - 2][0] * d, p[1] + N[n - 2][1] * d];
    const a = N[i - 1], c = N[i], s = 1 + a[0] * c[0] + a[1] * c[1];
    return [p[0] + (a[0] + c[0]) / s * d, p[1] + (a[1] + c[1]) / s * d];
  };
  const pos = new Map<Col, number[]>();
  /** Convex polygon facing `want` (winding flipped when its normal points the other way). */
  const poly = (q: number[][], want: number[], c: Col) => {
    const u = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], v = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const qq = nn[0] * want[0] + nn[1] * want[1] + nn[2] * want[2] < 0 ? [...q].reverse() : q, arr = pos.get(c) ?? [];
    for (let k = 1; k + 1 < qq.length; k++) arr.push(...qq[0], ...qq[k], ...qq[k + 1]);
    pos.set(c, arr);
  };
  const P3 = (p: P2, y: number) => [p[0], y, p[1]];
  const colours: Col[] = [RECESS, METAL, ROOFGLASS, ROOFGLASS, 'slate', RECESS];
  for (let i = 0; i + 1 < n; i++) {
    const nv = N[i];
    for (let k = 0; k + 1 < PROFILE.length; k++) {
      const [d0, y0] = PROFILE[k], [d1, y1] = PROFILE[k + 1];
      const want = k === 0 ? [0, -1, 0] : k === 3 ? [nv[0] * 0.5, 1, nv[1] * 0.5] : k === 4 ? [0, 1, 0] : k === 5 ? [-nv[0], 0, -nv[1]] : [nv[0], 0.1, nv[1]];
      poly([P3(off(i, d0), y0), P3(off(i + 1, d0), y0), P3(off(i + 1, d1), y1), P3(off(i, d1), y1)], want, colours[k]);
    }
    // glazing bars every ~1.8 m on the steep face and the slope, 7 cm proud (the audit counts parallel faces under 3 cm
    // apart as coplanar)
    const a = A[i], c = A[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), m = Math.max(1, Math.round(L / 1.8));
    const tx = (c[0] - a[0]) / L * 0.04, tz = (c[1] - a[1]) / L * 0.04;
    for (let j = 1; j < m; j++) {
      const f = j / m, at = (d: number): P2 => { const p = off(i, d), q = off(i + 1, d); return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; };
      for (const k0 of [2, 3]) {
        const [d0, y0] = PROFILE[k0], [d1, y1] = PROFILE[k0 + 1], lift = k0 === 3 ? 0.07 : 0;
        const p = at(d0 + 0.07), q = at(d1 + (k0 === 2 ? 0.07 : 0));
        poly([[p[0] - tx, y0 + lift, p[1] - tz], [p[0] + tx, y0 + lift, p[1] + tz], [q[0] + tx, y1 + lift, q[1] + tz], [q[0] - tx, y1 + lift, q[1] - tz]],
          k0 === 3 ? [nv[0] * 0.5, 1, nv[1] * 0.5] : [nv[0], 0.1, nv[1]], METAL);
      }
    }
  }
  // end caps
  for (const [i, j] of [[0, 1], [n - 1, n - 2]]) {
    const t = [A[i][0] - A[j][0], 0, A[i][1] - A[j][1]];
    poly(PROFILE.slice(0, -1).map(([d, y]) => P3(off(i, d), y)), t, ROOFGLASS);
  }
  for (const [c, p] of pos) b.add(geom(p), c);
}

const sideOf = (w: WallInfo): Side | null => (w.f.n[0] > 0.9 ? 'E' : w.f.n[0] < -0.9 ? 'W' : w.f.n[1] > 0.9 ? 'S' : null);

export function buildPieterDeHoochstraat13(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  // street walls on E, S and W (the north is a party wall): full-height pieces up to the roof storey, and the west
  // garden-level storey
  const street = infos.filter((w): w is WallInfo => !!w && w.rect && w.yb < 4.5 && w.yt > 18 && !!sideOf(w));
  const garden = infos.filter((w): w is WallInfo => !!w && w.rect && w.yb < 0.5 && w.yt > 3 && w.yt < 5.5 && w.len > 0.8 && sideOf(w) === 'W');
  const rebuilt = new Set([...street, ...garden].map(w => w.i));
  addShell(b, src as never, {
    wall: BRICK, roof: 'slate', skip: (_s, i) => rebuilt.has(i),
    wallFor: (_s, i) => { const w = infos[i]; return w && (sideOf(w) === 'W' || w.cx < -11.35) ? GARDEN : BRICK; },
  });
  resetFaces();
  const after: (() => void)[] = [];
  for (const w0 of street) {
    const side = sideOf(w0)!, w = w0;
    if (w.len < 0.8) {
      // the 0.33 m returns of the east bay strips
      bandFaces(w, side === 'E' ? [[3.2, PIER], [BAY_TOP, RED], [99, RECESS]] : [[99, side === 'W' || highHalf(w, side) ? GARDEN : BRICK]]);
      continue;
    }
    streetPiece(b, w, side, after);
  }
  for (const w of garden) gardenStorey(b, w);
  for (const f of after) f();
  flushFaces(b);
  attic(b, RUN_E);
  attic(b, RUN_W);
}
