import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {letters, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './wilhelminatoren-footprints.json';

/**
 * WILHELMINATOREN (Wilhelmina Gasthuisterrein, BAG pand 0363100012072252, 2001; the tower is OSM part w145629045 of that
 * pand): a brick apartment tower with a glazed steel escape stair on its north-east corner. The 3DBAG serves no shell for
 * the pand, so the massing is the OSM part's ring extruded to 41.6 m (wilhelminatoren-footprints.json,
 * bag-extrude-prepare.ts), the height read off the rectified front.
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0):
 *  - w01-67T, the ENE front (ring edge 3, 19 m), TMX7316010203-002550_pano_0000_003503 (2022), 50 px/m, 0.2 deg oblique.
 *    It has eleven window rows at a 3.13 m pitch (heads at 8.9-40.3 m, 1.3 m tall, white two-light frames) in four
 *    columns, t 1.0-2.8, 3.9-5.8, 6.9-9.2 and 10.4-12.2. Dark purple-brick panels fill some gaps between them, per row as
 *    photographed. The lowest three rows have glazed loggias on the left. The 6 m ground floor holds a glazed shop, the
 *    WILHELMINA TOREN canopy over the entrance, and the glazed steel stair at t 15.8-19.
 *  - w03-338T, the north face (edge 4), TMX7316010203-002060_pano_0000_003801 (2021): three window columns, the stair at
 *    its east end and a tall ground-floor window.
 *  - w01-67T.thumb: the front is convex. Here the shell ring gets eight chords bulging 0.9 m out over t 0-15.6.
 * The back faces (behind trees in w02-246T, 2025) get the same rows in three or four columns.
 */
export function buildWilhelminatoren(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]};
  const ring = src.facadeRing;
  const TOP = 41.6;
  // ---------- ENE front (edge 3): convex, a polygon bulge of SEG chords out to 1.2 m over t 0-15.6 ----------
  const {f, len: L3} = ringFrame(ring, 3);
  const BULGE_T = 15.6, SAG = 0.9, SEG = 8;
  const sag = (t: number) => Math.max(0, SAG * (1 - ((2 * t) / BULGE_T - 1) ** 2));
  const P = (t: number): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * sag(t), f.origin[1] + f.tangent[1] * t + f.n[1] * sag(t)];
  const TS = Array.from({length: SEG + 1}, (_, i) => (i * BULGE_T) / SEG);
  // the shell ring with the bulge points inserted on edge 3 (ringFrame's origin is ring[3] or ring[4])
  const fromStart = Math.hypot(f.origin[0] - ring[3][0], f.origin[1] - ring[3][1]) < 1e-6;
  if (!fromStart) throw new Error('wilhelminatoren: edge 3 frame no longer starts at ring[3]; the stair notch assumes it does');
  const ins = TS.slice(1).map(P);
  // the escape stair stands in a notch cut out of the NE corner (ring[4]), flush with both faces: w01-67T shows it at
  // t 15.8-19 inside the east face, w03-338T at the east end of the north face, the 2021 WG-plein frame open steel behind glass
  const SX0 = 15.8, ND = 3.0;
  const at = (t: number, o: number): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
  const notch = [at(SX0, 0), at(SX0, -ND), at(L3, -ND)];
  const shellRing = [...ring.slice(0, 4), ...ins, ...notch].map(([x, z]) => [+x.toFixed(3), +z.toFixed(3)]);
  const K = ring[4];
  const inNotch = (p: [number, number]) => Math.hypot(p[0] - K[0], p[1] - K[1]) < ND + 0.6;
  const shellSurfaces = [
    {type: 'GroundSurface', rings: [shellRing.map(([x, z]) => [x, 0, z])]},
    ...shellRing.map((p, i) => { const q = shellRing[(i + 1) % shellRing.length]; return {type: 'WallSurface', rings: [[[p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], TOP, q[1]], [p[0], TOP, p[1]]]]}; }),
    {type: 'RoofSurface', rings: [shellRing.map(([x, z]) => [x, TOP, z]).reverse()]},
  ];
  addShell(b, {...src, nativeRing: shellRing, facadeRing: shellRing, surfaces: shellSurfaces} as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.05, true);
  const rowTop = (k: number) => 8.9 + 3.13 * k; // window heads (w01-67T: y px 1580 ... 10 at 50 px/m from the crop base)
  const ROWS = 11, WH = 1.3;

  /** A white two-light window: frame 0.08, glass behind, a white mullion off-centre (w01-67T: the opening light). */
  const win = (f: Frame, t: number, top: number, w: number, out: number) => {
    slab(b, f, t, top - WH, w, WH, 0.06, 'white', out);
    slab(b, f, t, top - WH + 0.08, w - 0.16, WH - 0.16, 0.1, 'glass', out);
    slab(b, f, t - w * 0.18, top - WH + 0.08, 0.06, WH - 0.16, 0.13, 'white', out);
    slab(b, f, t, top - WH - 0.05, w + 0.04, 0.05, 0.1, 'white', out); // sill
  };
  const panel = (f: Frame, t0: number, t1: number, top: number, out: number) => slab(b, f, (t0 + t1) / 2, top - WH, t1 - t0, WH, 0.05, 'greyBrick', out);

  /** The chord frame of bulge segment j (origin at P(TS[j]), outward normal), and its chord length. */
  const seg = (j: number): {fr: Frame; len: number} => {
    const p = P(TS[j]), q = P(TS[j + 1]), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const tangent: [number, number] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    let n: [number, number] = [-tangent[1], tangent[0]];
    if (n[0] * f.n[0] + n[1] * f.n[1] < 0) n = [-n[0], -n[1]];
    return {fr: {origin: p, tangent, n}, len};
  };
  /** A front element over t a..z (front-frame t), split at the chord joints; pieces stop short of a joint. */
  const fslab = (t: number, y: number, w: number, h: number, d: number, colour: string) => {
    const a = t - w / 2, z = t + w / 2;
    for (let j = 0; j < SEG; j++) {
      const lo = Math.max(a, TS[j]), hi = Math.min(z, TS[j + 1]);
      if (hi - lo < 0.02) continue;
      const {fr, len} = seg(j), k = len / (TS[j + 1] - TS[j]);
      const ins = 0.03 + Math.max(0, d - 0.05) * 2; // deeper layers stop further short, so no two layers' ends share a plane
      const u0 = (lo - TS[j]) * k + (lo > TS[j] + 1e-6 || j === 0 ? 0 : ins), u1 = (hi - TS[j]) * k - (hi < TS[j + 1] - 1e-6 || j === SEG - 1 ? 0 : ins);
      if (u1 - u0 > 0.01) slab(b, fr, (u0 + u1) / 2, y, u1 - u0, h, d, colour, 0);
    }
    if (z > BULGE_T + 0.02) { const lo = Math.max(a, BULGE_T + 0.03 + Math.max(0, d - 0.05) * 2); slab(b, f, (lo + z) / 2, y, z - lo, h, d, colour, 0); }
  };
  const winF = (t: number, top: number, w: number) => {
    fslab(t, top - WH, w, WH, 0.06, 'white');
    fslab(t, top - WH + 0.08, w - 0.16, WH - 0.16, 0.1, 'glass');
    // the off-centre mullion, moved off a chord joint so its sides never meet a glass end
    let m = t - w * 0.18;
    for (const c of TS) if (Math.abs(m - c) < 0.3) m = c + (m < c ? -0.3 : 0.3);
    fslab(m, top - WH + 0.08, 0.06, WH - 0.16, 0.13, 'white');
    fslab(t, top - WH - 0.05, w + 0.04, 0.05, 0.1, 'white');
  };
  const COLS: [number, number][] = [[1.0, 2.8], [3.9, 5.8], [6.9, 9.2], [10.4, 12.2]];
  const GAPS: [number, number][] = [[2.8, 3.9], [5.8, 6.9], [9.2, 10.4]];
  // dark panels per row, bottom row first, as photographed (w01-67T): 0 = AB, 1 = BC, 2 = CD
  const DARK = [[2], [], [2], [0, 1], [0, 2], [1], [1], [0, 2], [0], [1], [0, 2]];
  for (let k = 0; k < ROWS; k++) {
    const top = rowTop(k);
    COLS.forEach(([a, z], c) => { if (k <= 2 && c <= 1) return; winF((a + z) / 2, top, z - a); });
    for (const g of DARK[k]) { if (k <= 2 && g === 0) continue; const [a, z] = GAPS[g]; fslab((a + z) / 2, top - WH, z - a - 0.06, WH, 0.04, 'greyBrick'); }
  }
  // glazed loggias, lowest three rows, t 0.2-5.8: dark glazing, the concrete floor edge and a slim rail on the bulge
  for (let k = 0; k <= 2; k++) {
    const y0 = rowTop(k) + 0.2 - 2.7;
    fslab(3.0, y0 + 0.12, 5.6, 2.58, 0.06, 'glass');
    fslab(3.0, y0, 5.6, 0.12, 0.1, 'concrete');
    fslab(3.0, y0 + 0.95, 5.6, 0.05, 0.14, 'bronze');
  }
  // ground floor: the glazed shop (t 0.2-5.8, 0.6-5.4 m), the entrance glazing under the canopy, the WILHELMINA TOREN canopy
  fslab(3.0, 0.6, 5.6, 4.8, 0.06, 'white');
  fslab(3.0, 0.7, 5.4, 4.6, 0.1, 'glass');
  for (const t of [1.9, 4.1]) fslab(t, 0.7, 0.07, 4.6, 0.17, 'white');
  fslab(3.0, 2.6, 5.4, 0.07, 0.17, 'white');
  fslab(9.6, 0.3, 5.4, 4.7, 0.06, 'white');
  fslab(9.6, 0.4, 5.2, 4.5, 0.1, 'glass');
  fslab(14.0, 0, 3.1, 3.1, 0.05, 'greyBrick');
  // the canopy: one straight slab on the edge frame, its front 1.3 m before the bulge (its back runs into the wall)
  const CANOPY_FRONT = sag(6.8) + 1.3;
  slab(b, f, 11.25, 3.15, 8.9, 0.32, CANOPY_FRONT, 'white', 0);
  letters(b, f, 'WILHELMINA TOREN', 10.2, 3.2, CANOPY_FRONT, 0.035, 0.02, 'dark');
  // coping over the bulge chords
  for (let j = 0; j < SEG; j++) { const {fr, len} = seg(j); slab(b, fr, len / 2, TOP - 0.2, len, 0.35, 0.08, 'concrete', 0); }

  // ---------- the open steel escape stair: in the NE notch and standing out of it, t 15.8-19.6, out -3.0 to +1.3 ----------
  // (w01-67T: t 15.8-19 on the east face, 1.3 m proud; the 2021 WG-plein frame: an open steel tower 0.6 m past the north
  // face, glazed only at the top). A scissor stair: landings every half storey (1.565 m) alternately at the outer and the
  // inner end, eight treads per flight in the two halves of the width, blue-grey posts at the free corners, mullions every
  // 0.8 m and a transom per storey on the open faces, a glazed lantern over the top storey and 0.9 m above the roof.
  const SX1 = 19.6, SO1 = 1.3;
  const STOP = TOP + 0.9, T0 = SX0 + 0.05, T1 = SX1 - 0.05, TM = (SX0 + SX1) / 2, Y0 = 4.2, HALF = 1.565;
  slab(b, f, TM, 0, SX1 - SX0 - 0.1, Y0 - 0.1, ND + SO1 - 0.1, 'greyBrick', -ND + 0.05);
  for (const [t, o] of [[SX0 + 0.1, SO1 - 0.1], [SX1 - 0.1, SO1 - 0.1], [SX1 - 0.1, -ND + 0.12]]) slab(b, f, t, Y0 - 0.1, 0.16, STOP - Y0 - 0.2, 0.16, 'bronze', o - 0.08);
  slab(b, f, TM, STOP - 0.3, SX1 - SX0, 0.3, ND + SO1, 'bronze', -ND);
  const LO = SO1 - 0.85, LI = -ND + 0.05, NT = 8, GO = (LO - (LI + 0.8)) / NT, RISE = HALF / (NT + 1);
  const nL = Math.floor((TOP - Y0) / HALF);
  for (let k = 0; k <= nL; k++) {
    const y = Y0 + HALF * k, outer = k % 2 === 0;
    slab(b, f, TM, y - 0.1, T1 - T0, 0.1, 0.8, 'frame', outer ? LO : LI); // the landing, full width, 0.8 m deep
    if (k === nL) break;
    const [ta, tb] = outer ? [T0 + 0.06, TM - 0.04] : [TM + 0.04, T1 - 0.06];
    for (let i = 0; i < NT; i++) {
      const o = outer ? LO - GO * (i + 1) : LI + 0.8 + GO * i;
      slab(b, f, (ta + tb) / 2, y + RISE * (i + 1) - 0.05, tb - ta, 0.05, GO - 0.03, 'frame', o + 0.015);
    }
  }
  // the open faces: mullions every 0.8 m and a transom per storey, on the east plane (out SO1) and the north plane (t SX1)
  for (let t = SX0 + 0.55; t < SX1 - 0.3; t += 0.8) slab(b, f, t, Y0, 0.06, STOP - Y0 - 0.3, 0.07, 'bronze', SO1 - 0.035);
  for (let o = SO1 - 0.55; o > -ND + 0.3; o -= 0.8) slab(b, f, SX1 - 0.035, Y0, 0.07, STOP - Y0 - 0.3, 0.06, 'bronze', o - 0.03);
  for (let y = Y0 + 3.13; y < STOP - 0.5; y += 3.13) {
    slab(b, f, TM, y, SX1 - SX0 - 0.6, 0.08, 0.05, 'bronze', SO1 - 0.025);
    slab(b, f, SX1 - 0.025, y, 0.05, 0.08, ND + SO1 - 0.6, 'bronze', -ND + 0.3);
  }
  // the glazed lantern: the top storey and the 0.9 m over the roof, pale panes on the open faces and over the notch walls
  const LY = TOP - 3.0, LH = STOP - 0.3 - LY;
  slab(b, f, TM, LY, SX1 - SX0 - 0.6, LH, 0.02, 'canopyGlass', SO1 - 0.12);
  slab(b, f, SX1 - 0.13, LY, 0.02, LH, ND + SO1 - 0.6, 'canopyGlass', -ND + 0.3);
  slab(b, f, SX0 + 0.12, TOP + 0.05, 0.02, STOP - 0.35 - TOP - 0.05, ND - 0.6, 'canopyGlass', -ND + 0.3);
  slab(b, f, TM, TOP + 0.05, SX1 - SX0 - 0.6, STOP - 0.35 - TOP - 0.05, 0.02, 'canopyGlass', -ND + 0.1);

  // ---------- north face (edge 4): the stair at its east end, three window columns ----------
  {
    const {f: fn, len: ln} = ringFrame(ring, 4);
    const cols: [number, number][] = [[5.2, 6.4], [7.4, 9.6], [10.5, 12.3]].map(([a, z]) => [a * ln / 15.25, z * ln / 15.25] as [number, number]);
    const dark = [[1], [0, 1], [], [0], [1], [0, 1], [0], [1], [0, 1], [], [1]];
    for (let k = 0; k < ROWS; k++) {
      const top = rowTop(k);
      const pt = (t: number): [number, number] => [fn.origin[0] + fn.tangent[0] * t, fn.origin[1] + fn.tangent[1] * t];
      for (const [a, z] of cols) if (!inNotch(pt(a)) && !inNotch(pt(z))) win(fn, (a + z) / 2, top, z - a, 0);
      for (const g of dark[k]) { const a = cols[g][1], z = cols[g + 1][0]; if (!inNotch(pt(a)) && !inNotch(pt(z))) panel(fn, a, z, top, 0); }
    }
    // the coping and the tall ground-floor window on the part of the north wall outside the notch
    const kT = (K[0] - fn.origin[0]) * fn.tangent[0] + (K[1] - fn.origin[1]) * fn.tangent[1];
    const [c0, c1] = kT > ln / 2 ? [0, ln - ND] : [ND, ln];
    slab(b, fn, (c0 + c1) / 2, TOP - 0.2, c1 - c0 - 0.05, 0.35, 0.08, 'concrete');
    const gw = cols.find(([a, z]) => (a + z) / 2 > c0 + 0.8 && (a + z) / 2 < c1 - 0.8) ?? cols[0];
    slab(b, fn, (gw[0] + gw[1]) / 2, 0.6, gw[1] - gw[0] + 0.6, 4.6, 0.08, 'white');
    slab(b, fn, (gw[0] + gw[1]) / 2, 0.7, gw[1] - gw[0] + 0.4, 4.4, 0.12, 'glass');
  }
  // ---------- the other faces (edges 0-2, behind trees in w02-246T): the same rows ----------
  for (const e of [0, 1, 2]) {
    const {f: fe, len: le} = ringFrame(ring, e);
    const n = le < 6 ? 1 : le < 13 ? 3 : 4, pitch = le / n;
    for (let k = 0; k < ROWS; k++) for (let i = 0; i < n; i++) {
      const tc = pitch * (i + 0.5), w = Math.min(2.0, pitch - 0.9);
      win(fe, tc, rowTop(k), w, 0);
      if (i < n - 1 && (k + i) % 3 === 0) panel(fe, tc + w / 2, tc + pitch - w / 2, rowTop(k), 0);
    }
    slab(b, fe, le / 2, TOP - 0.2, le, 0.35, 0.08, 'concrete');
  }
  setSink(sink0);
}
