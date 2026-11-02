import * as T from 'three';
import polygonClipping, {type MultiPolygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {frameFromBearing} from './modern-kit';
import {Acc, ccw, inside, edgeBox, fin, flatLetters, roof, soffit, strip, wallQuad, type C} from './tier-kit';
import {cleanPlan, edgeNormal, ringArea, type PlanPoint, type PlanPolygon} from '../../src/canalRecall/landmarks/roofTiers';
import source from './volkshotel-footprints.json';

/**
 * Volkshotel, Wibautstraat 150 (1965, built as the Volkskrant offices; a hotel since 2014). BAG pand 0363100012149232.
 * Native east/south metres from the BAG vertex average (volkshotel-footprints.json, modern-prepare.mjs), y above ground.
 *
 * The 3DBAG planes (AHN4) give the heights: a 52 x 15 m slab on the Wibautstraat to 27.6 m, a set-back top storey to
 * 32.2 m that stops short of both ends, plant on the roof to 34-36 m, a stair core on the back to 32 m and a four-storey
 * rear wing to 14.4 m filling the rest of the BAG outline. The slab is authored as a clean rectangle on the BAG corners
 * (the 3DBAG plane outlines are ragged), the wing is the BAG outline minus slab and core.
 *
 * Signature (inventory): the horizontal bands, eight light concrete spandrels proud of seven ribbon windows with dark
 * mullions (w03, w05, w07); the oversailing roof slab over the glazed top storey with the free-standing HOTEL letters
 * (w03 aimed view); the ground colonnade and the two red entrance canopies (w03, 2021 and 2024 captures).
 */
const src = source as unknown as {nativeRing: number[][]};

// ---- slab frame: s along the Wibautstraat front from its north end (N_E) to its south end (S_E), d inward (west) ----------------------------------
const N_E: PlanPoint = [10.4, -24.4], S_E: PlanPoint = [28.0, 24.3], N_W: PlanPoint = [-3.9, -19.1];
const LEN = Math.hypot(S_E[0] - N_E[0], S_E[1] - N_E[1]), DEP = Math.hypot(N_W[0] - N_E[0], N_W[1] - N_E[1]);
const U: PlanPoint = [(S_E[0] - N_E[0]) / LEN, (S_E[1] - N_E[1]) / LEN], W: PlanPoint = [(N_W[0] - N_E[0]) / DEP, (N_W[1] - N_E[1]) / DEP];
const at = (s: number, d: number): PlanPoint => [N_E[0] + U[0] * s + W[0] * d, N_E[1] + U[1] * s + W[1] * d];
const box = (s0: number, s1: number, d0: number, d1: number): PlanPoint[] => ccw([at(s0, d0), at(s1, d0), at(s1, d1), at(s0, d1)]);
/** Bearing of the Wibautstraat front (its outward normal), measured on the BAG corners: 70 deg. */
const FRONT_BEARING = Math.atan2(-W[0], W[1]) * 180 / Math.PI;

const GROUND = 4.3, SLAB_TOP = 27.6, BANDS = 8, BAND_H = 1.5;
const TOP0 = 27.6, TOP1 = 31.0, ROOF1 = 32.2;
/** Stair core on the back of the slab (3DBAG 27.6-32.2 tier, x -8..1, z -12..-4). */
const CORE: PlanPoint[] = ccw([[-8.3, -9.2], [-1.25, -12.0], [0.8, -6.5], [-6.4, -3.8]]);
const WING_TOP = 14.4;

/** Ribbon facade on one outward plan edge: glass wall, `n` proud concrete bands from `y0` to `y1`, dark mullions. */
function ribbon(acc: Acc, a: PlanPoint, c: PlanPoint, y0: number, y1: number, n: number, pitch: number) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  wallQuad(acc, 'glass', a, c, y0, y1);
  if (L < 0.5) return;
  const step = n > 1 ? (y1 - y0 - BAND_H) / (n - 1) : 0;
  for (let k = 0; k < n; k++) strip(acc, 'concrete', a, c, 0, L, y0 + k * step, y0 + k * step + BAND_H, 0.3, 0);
  if (L < pitch * 0.9) return;
  const m = Math.max(1, Math.round(L / pitch)), p = L / m;
  for (let i = 1; i < m; i++) fin(acc, 'frame', a, c, i * p, 0.16, y0, y1, 0.12);
}
const edges = (r: PlanPoint[]) => r.map((p, i) => [p, r[(i + 1) % r.length]] as [PlanPoint, PlanPoint]);
const toMulti = (rings: PlanPoint[][]): MultiPolygon => rings.map(r => [[...r, r[0]]]) as MultiPolygon;

export function buildVolkshotel(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  const slab = box(0, LEN, 0, DEP);
  const bag = ccw(src.nativeRing.map(p => [p[0], p[1]] as PlanPoint).slice(0, -1));
  // the BAG west face of the slab's north half bulges 0.5 m past the line of its corners: no wing there, cut it.
  // Slivers where the BAG outline and the slab rectangle differ by centimetres are dropped (mean width under 1.5 m)
  const wing = cleanPlan(polygonClipping.difference(toMulti([bag]), toMulti([slab, CORE, box(LEN / 2, LEN, DEP - 0.1, DEP + 1)])), 6, 0)
    .filter(p => { const r = p[0], per = r.reduce((s, q, i) => s + Math.hypot(r[(i + 1) % r.length][0] - q[0], r[(i + 1) % r.length][1] - q[1]), 0); return 2 * Math.abs(ringArea(r)) / per > 1.5; });
  const groundIn = box(0.6, LEN - 0.6, 0.6, DEP);   // ground storey glazing 0.6 m behind the columns (w08)

  // ---- slab: glazed ground storey behind columns, bands and ribbons to 27.6 m ----
  for (const [a, c] of edges(slab)) ribbon(acc, a, c, GROUND, SLAB_TOP, BANDS, 3.5);
  const inWing = (p: PlanPoint) => wing.some(poly => inside(p, poly[0]));
  for (const [a0, c0] of edges(groundIn)) {
    // the back edge runs partly inside the wing: glaze it piecewise, about 3.1 m a pane, only where it is outside
    const L0 = Math.hypot(c0[0] - a0[0], c0[1] - a0[1]), m = Math.max(1, Math.round(L0 / 3.1)), n = edgeNormal(a0, c0);
    const P = (t: number): PlanPoint => [a0[0] + (c0[0] - a0[0]) * t, a0[1] + (c0[1] - a0[1]) * t];
    for (let i = 0; i < m; i++) {
      const a = P(i / m), c = P((i + 1) / m);
      if (inWing([(a[0] + c[0]) / 2 + n[0] * 0.5, (a[1] + c[1]) / 2 + n[1] * 0.5])) continue;
      wallQuad(acc, 'glass', a, c, 0, GROUND);
    }
  }
  soffit(b, cleanPlan(polygonClipping.difference(toMulti([slab]), toMulti([groundIn])), 0.1, 0), GROUND, 'concrete');
  // columns on the slab line, about 7 m apart (w03: four bays in the 35 m crop) on the front and at the corners of the ends (w03, w05, w07)
  const front: [PlanPoint, PlanPoint] = [at(0, 0), at(LEN, 0)];
  const nCol = Math.round(LEN / 7.1);
  for (let i = 0; i <= nCol; i++) {
    const t = Math.min(LEN - 0.35, Math.max(0.35, i * LEN / nCol));
    edgeBox(b, 'concrete', front[0], front[1], t - 0.3, t + 0.3, 0, GROUND, -0.6, 0);
  }
  // ground mullions half way between the columns (none inside a column)
  const gf: [PlanPoint, PlanPoint] = [at(0.6, 0.6), at(LEN - 0.6, 0.6)];
  for (let i = 0; i < nCol; i++) fin(acc, 'frame', gf[0], gf[1], (i + 0.5) * LEN / nCol - 0.6, 0.12, 0, GROUND, 0.1);
  for (const d of [DEP / 2]) for (const [s, sgn] of [[0, 1], [LEN, -1]] as [number, number][]) {
    const p = at(s + sgn * 0.3, d), q = at(s + sgn * 0.3, d + 0.6);
    edgeBox(b, 'concrete', p, q, -0.3, 0.3, 0, GROUND, -0.3, 0.3);
  }
  // red entrance canopies: a long flat one near the south end, a shorter one over the hotel door 24-28 m from the north end with its sign (w03 2021/2024)
  const canopy = (s0: number, s1: number, depth: number) => {
    const g = new T.BoxGeometry(s1 - s0, 0.3, depth);
    g.rotateY(-Math.atan2(U[1], U[0]));
    const m = at((s0 + s1) / 2, 0);
    g.translate(m[0] - W[0] * (depth / 2 - 0.6), GROUND - 0.6, m[1] - W[1] * (depth / 2 - 0.6));
    b.add(g, 'red');
  };
  canopy(45, 51, 2.2);
  canopy(24, 28.5, 2.6);
  const sf = frameFromBearing(at(26.25, -1.95), FRONT_BEARING);
  b.add(new T.BoxGeometry(2.2, 0.32, 0.08).rotateY(Math.atan2(sf.n[0], sf.n[1])).translate(sf.origin[0] + sf.n[0] * 0.05, GROUND - 0.6, sf.origin[1] + sf.n[1] * 0.05), 'dark');

  // ---- set-back glazed top storey under an oversailing roof slab (w03 aimed view, 3DBAG 27.6-32.2 tier) ----
  const top = box(5, LEN - 5, 1.2, DEP - 1.2);
  roof(b, cleanPlan(polygonClipping.difference(toMulti([slab]), toMulti([top, CORE])), 0.1, 0), SLAB_TOP, 'slate');
  for (const [a, c] of edges(top)) {
    wallQuad(acc, 'glass', a, c, TOP0, TOP1);
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), m = Math.max(1, Math.round(L / 1.8));
    for (let i = 1; i < m; i++) fin(acc, 'frame', a, c, i * L / m, 0.12, TOP0, TOP1, 0.1);
  }
  const lid = box(3.2, LEN - 3.2, -0.6, DEP - 0.2);
  for (const [a, c] of edges(lid)) wallQuad(acc, 'white', a, c, TOP1, ROOF1);
  soffit(b, cleanPlan(polygonClipping.difference(toMulti([lid]), toMulti([top])), 0.1, 0), TOP1, 'dark');
  const plant = box(15, 37, 3.5, DEP - 3.5);
  roof(b, cleanPlan(polygonClipping.difference(toMulti([lid]), toMulti([plant])), 0.1, 0), ROOF1, 'slate');
  for (const [a, c] of edges(plant)) wallQuad(acc, 'concrete', a, c, ROOF1, 34.4);
  roof(b, [[plant]], 34.4, 'slate');
  // HOTEL letters standing on the roof edge at the north end of the front (w03 aimed view): VOLKSHOTEL on a dark rail
  // On the front edge of the roof slab, so the letters stand on its top: a dark rail with the pixel letters on its street face.
  const lf = frameFromBearing(at(11, -0.6), FRONT_BEARING), rot = Math.atan2(lf.n[0], lf.n[1]);
  b.add(new T.BoxGeometry(12.4, 0.25, 0.25).rotateY(rot).translate(lf.origin[0] - lf.n[0] * 0.125, ROOF1 + 0.125, lf.origin[1] - lf.n[1] * 0.125), 'dark');
  flatLetters(acc, lf, 'VOLKSHOTEL', 0, ROOF1 + 0.25, 0.005, 0.2, 'dark');

  // ---- stair core on the back, blank concrete to 32.2 m ----
  for (const [a, c] of edges(CORE)) wallQuad(acc, 'concrete', a, c, 0, ROOF1);
  roof(b, [[CORE]], ROOF1, 'slate');

  // ---- rear wing: the BAG outline minus slab and core, bands and ribbons over a glazed ground storey (w09) ----
  for (const poly of wing) {
    for (const ring of poly) for (const [a, c] of edges(ring)) {
      // edges buried in the slab or core face are inside the building
      const n = edgeNormal(a, c), m: PlanPoint = [(a[0] + c[0]) / 2 + n[0] * 0.3, (a[1] + c[1]) / 2 + n[1] * 0.3];
      const buried = polygonClipping.intersection(toMulti([slab, CORE]), [[[m[0] - 0.01, m[1] - 0.01], [m[0] + 0.01, m[1] - 0.01], [m[0] + 0.01, m[1] + 0.01], [m[0] - 0.01, m[1] + 0.01], [m[0] - 0.01, m[1] - 0.01]]]).length > 0;
      if (buried) continue;
      wallQuad(acc, 'glass', a, c, 0, GROUND);
      ribbon(acc, a, c, GROUND, WING_TOP, 4, 3.5);
    }
  }
  roof(b, wing, WING_TOP, 'slate');
  acc.flush();
}
