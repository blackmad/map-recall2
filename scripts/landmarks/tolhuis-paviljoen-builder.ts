import * as T from 'three';
import polygonClipping, {type MultiPolygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {Acc, ccw, edgeBox, fin, roof, soffit, strip, tube, wallQuad, type C} from './tier-kit';
import {cleanPlan, edgeNormal, type PlanPoint, type PlanPolygon} from '../../src/canalRecall/landmarks/roofTiers';
import {hexOpeningWall, type HexOpening, type Tri} from '../../src/canalRecall/landmarks/hexOpeningWall';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Paviljoen Tolhuistuin, IJpromenade 2 (BAG pand 0363100012119827, bouwjaar 1979; built c. 1975 as the Shell staff
 * canteen to Arthur Staal's design, gemeentelijk monument 200957 since 2022; nl.wikipedia "IJpromenade 2").
 * Native east/south metres from the BAG vertex average (tolhuis-paviljoen-footprints.json, modern-prepare.mjs), y above
 * ground.
 *
 * Plan: the BAG ring is a structuralist grid turned to 53.5 deg: 7.2 m modules and 15.9 m squares, every one under its
 * own grey pyramid roof (PDOK orthophoto 2025, artifacts/landmark-briefs/tolhuis-paviljoen/ortho-uv-crop.png; the
 * "22 kleine piramides" of the register text), round a raised flat-roofed hall. The tiles below are read off the BAG
 * corners (u along 53.5 deg, v along 143.5 deg) and the orthophoto's roof hips.
 * Heights: 3DBAG LoD2.2 (AHN5) above its maaiveld: roof edges 7.7-7.9 m, small pyramid tops 9.1-9.3 m, large ones
 * 10.9-11.1 m, the hall's flat roof 10.5 m; all taken 1.3 m down to the AHN ground (see EAVE). Upper floor lifted on
 * struts to 2.9 m over a recessed glazed ground floor on the canal row and both end squares (w02, w03, w05, w30). The
 * recess is 1.15 m: the photos suggest about 1.5 m on the canal row, but the audit's see-through rule closes a cantilever
 * under a 5.7 m soffit only within 1.6 m of the fascia edge (reported, not loosened). A dark
 * exposed-aggregate parapet band, glazing between white piers and a deep white fascia (w03, w16), stretched-hexagon
 * windows in the canal row's parapet (w02, w14, w21, w26), brick ground floor with diamond windows and a vent-hole beam
 * on the rest (w14, w16).
 */
const B = 53.495 * Math.PI / 180;
const U: PlanPoint = [Math.sin(B), -Math.cos(B)], V: PlanPoint = [Math.cos(B), Math.sin(B)];
const P = (u: number, v: number): PlanPoint => [u * U[0] + v * V[0], u * U[1] + v * V[1]];

/** Ground: the game's AHN relief reads 1.1-1.4 m NAP all round the pavilion (ground-height-v1); 3DBAG's b3_h_maaiveld
 * (-0.11 m NAP) sits 1.3 m lower, so every 3DBAG height is taken 1.3 m down: roof edge 7.7 m NAP -> 6.5 m, hall roof 9.2 m.
 * Storey split in the wall plane of the rectified w02 crop (50 px/m): ground storey 2.9 m, parapet 2.2 m, clerestory
 * 0.6 m, fascia 0.8 m, which sums to the 6.5 m roof edge. */
const EAVE = 6.5, FASCIA0 = 5.7, LIFT = 2.9, HALL_TOP = 9.2, PITCH = 0.39, FASCIA_OUT = 0.45;
const HEX_BAND_TOP = 5.1, GLASS_BAND_TOP = 3.9;
type Upper = 'hex' | 'glass';
type Tile = {u0: number; u1: number; v0: number; v1: number; upper: Upper; lifted?: number; flat?: boolean};
/** Module tiles [u0, u1, v0, v1]; `lifted` = ground floor recess under the cantilever (m). */
const TILES: Tile[] = [
  // canal row: three modules with hexagon windows on V struts (w02, six hexagons across 23 m)
  {u0: -24.16, u1: -16.49, v0: -29.62, v1: -22.5, upper: 'hex', lifted: 1.15},
  {u0: -16.49, u1: -8.82, v0: -29.62, v1: -22.5, upper: 'hex', lifted: 1.15},
  {u0: -8.82, u1: -1.14, v0: -29.62, v1: -22.5, upper: 'hex', lifted: 1.15},
  {u0: -31.4, u1: -24.16, v0: -22.5, v1: -15.3, upper: 'hex', lifted: 1.15},
  {u0: -24.16, u1: -17.1, v0: -22.5, v1: -15.3, upper: 'hex'},
  {u0: -1.14, u1: 5.95, v0: -22.5, v1: -15.3, upper: 'hex', lifted: 1.15},
  // south-west end square on a V strut (w03, w05) and the north-east end square on posts (w16, w30)
  {u0: -53, u1: -37.15, v0: -22.47, v1: -6.6, upper: 'glass', lifted: 1.15},
  {u0: 18.85, u1: 34.74, v0: -0.96, v1: 14.9, upper: 'glass', lifted: 1.15},
  // large inner squares
  {u0: -17.1, u1: -1.14, v0: -22.5, v1: -6.6, upper: 'glass'},
  {u0: -31.4, u1: -17.1, v0: -15.3, v1: -0.95, upper: 'glass'},
  {u0: -31.4, u1: -17.1, v0: -0.95, v1: 14.9, upper: 'glass'},
  {u0: -17.1, u1: -1.14, v0: 7.76, v1: 22.13, upper: 'glass'},
  // 7.2 m modules
  {u0: -37.15, u1: -31.4, v0: -15.3, v1: -6.6, upper: 'glass'},
  {u0: -38.6, u1: -31.4, v0: -6.6, v1: 0.58, upper: 'glass'},
  {u0: -38.6, u1: -31.4, v0: 0.58, v1: 7.76, upper: 'glass'},
  {u0: -1.14, u1: 5.95, v0: -15.3, v1: -6.6, upper: 'glass'},
  {u0: 5.95, u1: 13.15, v0: -15.3, v1: -6.6, upper: 'glass'},
  {u0: 13.15, u1: 20.38, v0: -8.1, v1: -0.95, upper: 'glass'},
  {u0: 13.15, u1: 18.85, v0: -0.95, v1: 7.76, upper: 'glass'},
  {u0: -1.14, u1: 5.95, v0: 7.76, v1: 14.92, upper: 'glass'},
  {u0: 5.95, u1: 13.15, v0: 7.76, v1: 14.92, upper: 'glass'},
  {u0: -1.14, u1: 5.95, v0: 14.92, v1: 22.13, upper: 'glass'},
  // raised hall with a flat roof (3DBAG 10.48 m over its maaiveld = 9.2 m over the AHN ground; solar panels on the orthophoto)
  {u0: -17.1, u1: 13.15, v0: -6.6, v1: 7.76, upper: 'glass', flat: true},
];
/** Tile rectangle in (u, v) plan coordinates (counter-clockwise), optionally inset per side [u0, u1, v0, v1]. */
/** Ground-floor wall under the cantilever's ends, flush with the parapet: brick with a diamond window at both ends of the
 * canal row (w02: the glazed recess runs only between them) [u0, u1, v0, v1]. */
const GROUND_SOLID: [number, number, number, number][] = [[-24.16, -21.3, -29.62, -27.5], [-4.0, -1.14, -29.62, -27.5]];
const rectUV = (t: Tile, inset = [0, 0, 0, 0]): PlanPoint[] =>
  [[t.u0 + inset[0], t.v0 + inset[2]], [t.u1 - inset[1], t.v0 + inset[2]], [t.u1 - inset[1], t.v1 - inset[3]], [t.u0 + inset[0], t.v1 - inset[3]]];
const rectOf = (t: Tile, inset = [0, 0, 0, 0]): PlanPoint[] => ccw(rectUV(t, inset).map(([u, v]) => P(u, v)));
/** Boolean ops run in the axis-aligned (u, v) frame (exact for the grid; polygon-clipping recursed without end on the
 * turned rectangles' near-collinear edges), then map to native metres. The (u, v) -> (x, z) map keeps orientation. */
const toNative = (polys: PlanPolygon[]): PlanPolygon[] => polys.map(poly => poly.map(r => r.map(([u, v]) => P(u, v))));
const toMulti = (rings: PlanPoint[][]): MultiPolygon => rings.map(r => [[...r, r[0]]]) as MultiPolygon;
const edges = (r: PlanPoint[]) => r.map((p, i) => [p, r[(i + 1) % r.length]] as [PlanPoint, PlanPoint]);
const len = (a: PlanPoint, b: PlanPoint) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a: PlanPoint, b: PlanPoint, t: number): PlanPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const inTile = (p: PlanPoint, t: Tile) => {
  const u = p[0] * U[0] + p[1] * U[1], v = p[0] * V[0] + p[1] * V[1];
  return u > t.u0 && u < t.u1 && v > t.v0 && v < t.v1;
};
const inAny = (p: PlanPoint) => TILES.some(t => inTile(p, t));
/** Compass bearing of an outward plan normal. */
const bearingOf = (n: PlanPoint) => (Math.atan2(n[0], -n[1]) * 180 / Math.PI + 360) % 360;

/** Exterior runs of a tile's edges: [a, b] pieces of the rectangle edges with no other tile outside them. */
function exteriorRuns(t: Tile): [PlanPoint, PlanPoint][] {
  const out: [PlanPoint, PlanPoint][] = [];
  for (const [a, b] of edges(rectOf(t))) {
    const L = len(a, b), n = edgeNormal(a, b);
    // cut the edge at every other tile's corner projected on it, keep pieces whose outside is open
    const cuts = new Set([0, L]);
    for (const o of TILES) for (const c of rectOf(o)) {
      const s = ((c[0] - a[0]) * (b[0] - a[0]) + (c[1] - a[1]) * (b[1] - a[1])) / L;
      if (s > 0.05 && s < L - 0.05) cuts.add(s);
    }
    const ss = [...cuts].sort((x, y) => x - y);
    let run: [number, number] | null = null;
    const flush = () => { if (run && run[1] - run[0] > 0.3) out.push([lerp(a, b, run[0] / L), lerp(a, b, run[1] / L)]); run = null; };
    for (let i = 0; i + 1 < ss.length; i++) {
      const m = lerp(a, b, (ss[i] + ss[i + 1]) / 2 / L), probe: PlanPoint = [m[0] + n[0] * 0.3, m[1] + n[1] * 0.3];
      if (inAny(probe)) { flush(); continue; }
      if (run) run[1] = ss[i + 1]; else run = [ss[i], ss[i + 1]];
    }
    flush();
  }
  return out;
}

/** Wall-local (t, y, o) triangles onto the plan edge a->b: t runs from b towards a (viewer's left to right from outside). */
function putTris(acc: Acc, c: C, a: PlanPoint, b: PlanPoint, tris: Tri[], out = 0) {
  const L = len(a, b), tx = (a[0] - b[0]) / L, tz = (a[1] - b[1]) / L, n = edgeNormal(a, b);
  const W = (p: [number, number, number]) => [b[0] + tx * p[0] + n[0] * (p[2] + out), p[1], b[1] + tz * p[0] + n[1] * (p[2] + out)];
  for (const t of tris) acc.tri(c, W(t.pts[0]), W(t.pts[1]), W(t.pts[2]));
}

/** A holedWall quad (counter-clockwise from its normal) as two triangles. */
const splitQuad = (q: WallQuad): Tri[] => [{pts: [q.pts[0], q.pts[1], q.pts[2]], normal: q.normal}, {pts: [q.pts[0], q.pts[2], q.pts[3]], normal: q.normal}];

/** Hip roof over a rectangle tile: a pyramid on a square, a short ridge on an oblong; slope PITCH (rise per run). */
function hipRoof(acc: Acc, t: Tile) {
  const du = t.u1 - t.u0, dv = t.v1 - t.v0, h = Math.min(du, dv) / 2, top = EAVE + PITCH * h;
  const c = [(t.u0 + t.u1) / 2, (t.v0 + t.v1) / 2];
  const r0: [number, number] = du >= dv ? [c[0] - (du / 2 - h), c[1]] : [c[0], c[1] - (dv / 2 - h)];
  const r1: [number, number] = du >= dv ? [c[0] + (du / 2 - h), c[1]] : [c[0], c[1] + (dv / 2 - h)];
  const W = (u: number, v: number, y: number) => { const p = P(u, v); return [p[0], y, p[1]]; };
  const k = [W(t.u0, t.v0, EAVE), W(t.u1, t.v0, EAVE), W(t.u1, t.v1, EAVE), W(t.u0, t.v1, EAVE)];
  const R0 = W(r0[0], r0[1], top), R1 = W(r1[0], r1[1], top);
  const up = (a: number[], b: number[], d: number[]) => {
    const n = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);   // y of (b-a) x (d-a)
    if (n > 0) acc.tri('slate', a, b, d); else acc.tri('slate', a, d, b);
  };
  if (du >= dv) {   // ridge along u: sides v0 and v1 are trapezoids, ends u0 and u1 triangles
    up(k[0], k[1], R1); up(k[0], R1, R0); up(k[2], k[3], R0); up(k[2], R0, R1); up(k[3], k[0], R0); up(k[1], k[2], R1);
  } else {
    up(k[1], k[2], R1); up(k[1], R1, R0); up(k[3], k[0], R0); up(k[3], R0, R1); up(k[0], k[1], R0); up(k[2], k[3], R1);
  }
}

/** Outset a counter-clockwise rectilinear ring by d (each edge moved out along its normal, corners re-intersected). */
function outset(r: PlanPoint[], d: number): PlanPoint[] {
  const lines = edges(r).map(([a, b]) => { const n = edgeNormal(a, b); return [[a[0] + n[0] * d, a[1] + n[1] * d], [b[0] - a[0], b[1] - a[1]]] as [PlanPoint, PlanPoint]; });
  return lines.map((l, i) => {
    const [p, dp] = lines[(i + lines.length - 1) % lines.length], [q, dq] = l;
    const den = dp[0] * dq[1] - dp[1] * dq[0];
    if (Math.abs(den) < 1e-9) return q;
    const s = ((q[0] - p[0]) * dq[1] - (q[1] - p[1]) * dq[0]) / den;
    return [p[0] + dp[0] * s, p[1] + dp[1] * s] as PlanPoint;
  });
}

export function buildTolhuisPaviljoen(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  const blocks = TILES.filter(t => !t.flat);
  const hall = TILES.find(t => t.flat)!;

  // ---- plan unions: upper storey (the BAG ring) and the ground floor (upper minus the cantilever recesses) ----
  const unionUV = (rs: PlanPoint[][]) => cleanPlan(polygonClipping.union(...(rs.map(r => [[...r, r[0]]]) as never[])) as MultiPolygon, 1, 0);
  const upperUV = unionUV(TILES.map(t => rectUV(t))), upper = toNative(upperUV);
  // ground floor: every tile, minus a recess strip behind each exterior run of a lifted tile (only along that run, so a
  // neighbour that continues the wall keeps its full depth)
  const toUV = (p: PlanPoint): PlanPoint => [p[0] * U[0] + p[1] * U[1], p[0] * V[0] + p[1] * V[1]];
  const groundRects = TILES.map(t => {
    const r = rectUV(t);
    if (!t.lifted) return [r];
    const cuts = exteriorRuns(t).map(([a, c]) => {
      const [ua, va] = toUV(a), [uc, vc] = toUV(c), n = edgeNormal(a, c), [nu, nv] = toUV(n), d = t.lifted!;
      const pts: PlanPoint[] = [[ua, va], [uc, vc], [uc - nu * d, vc - nv * d], [ua - nu * d, va - nv * d]];
      const us = pts.map(q => q[0]), vs = pts.map(q => q[1]);
      return [[Math.min(...us), Math.min(...vs)], [Math.max(...us), Math.min(...vs)], [Math.max(...us), Math.max(...vs)], [Math.min(...us), Math.max(...vs)]] as PlanPoint[];
    });
    return cleanPlan(polygonClipping.difference(toMulti([r]), ...cuts.map(c => toMulti([c]))), 0.5, 0).map(poly => poly[0]);
  }).flat().concat(GROUND_SOLID.map(([u0, u1, v0, v1]) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as PlanPoint[]));
  const groundUV = unionUV(groundRects), ground = toNative(groundUV);
  const onUpperEdge = (p: PlanPoint) => upper.some(poly => poly.some(r => edges(r).some(([a, c]) => {
    const L = len(a, c), s = ((p[0] - a[0]) * (c[0] - a[0]) + (p[1] - a[1]) * (c[1] - a[1])) / L;
    if (s < -0.01 || s > L + 0.01) return false;
    const q = lerp(a, c, s / L);
    return len(p, q) < 0.05;
  })));

  // ---- ground floor: brick with diamond windows on the building line, glazing in the recesses under the cantilevers ----
  for (const poly of ground) for (const ring of poly) for (const [a, c] of edges(ring)) {
    const L = len(a, c);
    if (L < 0.05) continue;
    if (onUpperEdge(lerp(a, c, 0.5))) {
      wallQuad(acc, 'brick', a, c, 0, LIFT);
      // diamond windows about 3.6 m apart, centred 1.9 m up (w14, w02 right end): white square turned 45 deg with glass inside
      const m = Math.floor(L / 3.6);
      for (let i = 0; i < m; i++) diamond(acc, a, c, (i + 0.5) * L / m, 1.9);
    } else {
      // recessed ground floor: white-framed glazing, one pane per ~1.8 m bay cut through a white frame wall (w02, w03, w30)
      const m = Math.max(1, Math.round(L / 1.8)), p = L / m, ops: HoledOpening[] = [];
      if (L > 0.6) for (let i = 0; i < m; i++) ops.push({t0: i * p + 0.08, t1: (i + 1) * p - 0.08, y0: 0.15, y1: LIFT - 0.4, depth: 0.15});
      const hw = holedWall(L, 0, LIFT, ops);
      putTris(acc, 'white', a, c, hw.face.flatMap(splitQuad));
      putTris(acc, 'white', a, c, hw.reveals.flat().flatMap(splitQuad));
      putTris(acc, 'glass', a, c, hw.backs.flatMap(splitQuad));
    }
  }
  // soffits under the cantilevered modules
  soffit(b, toNative(cleanPlan(polygonClipping.difference(toMulti(upperUV.map(p => p[0])), ...groundUV.map(p => toMulti([p[0]]))), 0.2, 0)), LIFT, 'stone');

  // ---- upper storey per module, on its exterior runs ----
  for (const t of TILES) for (const [a, c] of exteriorRuns(t)) {
    const L = len(a, c), n = edgeNormal(a, c), bearing = bearingOf(n);
    if (t.flat) continue;
    if (t.upper === 'hex') {
      // dark exposed-aggregate parapet 2.9-5.1 m with stretched hexagons (2.45 x 0.96 m, 3.85 m apart, tops 0.24 m under the band top; w02)
      const nHex = Math.max(1, Math.round(L / 3.85)), pitch = L / nHex, hw = Math.min(2.45, pitch - 0.9);
      const ops: HexOpening[] = [];
      for (let i = 0; i < nHex; i++) { const tc = (i + 0.5) * pitch; ops.push({t0: tc - hw / 2, t1: tc + hw / 2, y0: HEX_BAND_TOP - 1.2, y1: HEX_BAND_TOP - 0.24, tip: 0.42, depth: 0.25}); }
      const hw2 = hexOpeningWall(L, LIFT, HEX_BAND_TOP, ops);
      putTris(acc, 'stone', a, c, hw2.face);
      for (const r of hw2.reveals) putTris(acc, 'stone', a, c, r);
      for (const k of hw2.backs) putTris(acc, 'glass', a, c, k);
      // the floor-edge beam under the hexagons, a little proud and running the module's length (w02)
      strip(acc, 'stone', a, c, 0, L, LIFT, LIFT + 0.75, 0.12, 0);
      // clerestory over the parapet: glazing with white mullions and white sill (w02)
      wallQuad(acc, 'glass', a, c, HEX_BAND_TOP, FASCIA0);
      const m = Math.max(1, Math.round(L / 1.9));
      for (let i = 1; i < m; i++) fin(acc, 'white', a, c, i * L / m, 0.12, HEX_BAND_TOP, FASCIA0, 0.08);
      strip(acc, 'white', a, c, 0, L, HEX_BAND_TOP, HEX_BAND_TOP + 0.1, 0.08, 0);
    } else {
      // dark parapet band 2.9-3.9 m, glazing to the fascia between white piers about 4 m apart, a white transom (w03, w16)
      wallQuad(acc, 'stone', a, c, LIFT, GLASS_BAND_TOP);
      wallQuad(acc, 'glass', a, c, GLASS_BAND_TOP, FASCIA0);
      const m = Math.max(1, Math.round(L / 4));
      for (let i = 0; i <= m; i++) fin(acc, 'white', a, c, Math.min(L - 0.25, Math.max(0.25, i * L / m)), 0.45, GLASS_BAND_TOP, FASCIA0, 0.1);
      strip(acc, 'white', a, c, 0, L, 5.1, 5.22, 0.1, 0);
      // grey sun louvres under the fascia on the sunny sides (w03, w16, w30; none on the canal faces)
      if (Math.abs(((bearing - 324 + 540) % 360) - 180) > 30) edgeBox(b, 'frame', a, c, 0.1, L - 0.1, 5.42, 5.5, 0.02, 1.0);
      if (!t.lifted) {
        // white vent beam with round holes under the parapet on the brick modules (w14, w16)
        strip(acc, 'white', a, c, 0, L, LIFT - 0.35, LIFT, 0.12, 0);
        const k = Math.floor(L / 0.7);
        for (let i = 0; i < k; i++) { const tc = (i + 0.5) * L / k; edgeBox(b, 'dark', a, c, tc - 0.09, tc + 0.09, LIFT - 0.265, LIFT - 0.085, 0.04, 0.18); }
      }
    }
  }
  // Struts under the lifted modules. Canal row (w02, w26): single light concrete posts leaning out from the foot of the
  // recessed glazing to the parapet, about 5.2 m apart. South-west end square (w03): one V of two legs from a single foot
  // under the middle of its garden face. North-east end square (w30): square posts at its outer corners.
  const posts = new Set<string>();
  const post = (f: PlanPoint, top: PlanPoint) => b.add(tube(f, 0.3, top, LIFT + 0.02, 0.3, 4), 'concrete');
  for (const t of TILES) if (t.lifted) for (const [a, c] of exteriorRuns(t)) {
    const L = len(a, c), n = edgeNormal(a, c), bearing = bearingOf(n);
    const at = (tt: number, o: number): PlanPoint => { const p = lerp(a, c, tt / L); return [p[0] + n[0] * o, p[1] + n[1] * o]; };
    if (t.upper === 'hex') {
      const k = Math.max(2, Math.round(L / 5.2));
      for (let i = 0; i < k; i++) { const tc = (i + 0.5) * L / k; post(at(tc, -(t.lifted - 0.35)), at(tc, -0.45)); }
    } else if (t.u0 < -40 && Math.abs(bearing - 234) < 20) {
      const tc = L / 2;
      for (const s of [-1, 1]) post(at(tc, -(t.lifted - 0.35)), at(tc + s * 2.2, -0.45));
    } else if (t.u0 > 15) {
      for (const tc of [0.45, L - 0.45]) {   // one post per corner (runs meeting at a corner would put two in one place)
        const p = at(tc, -0.45), key = `${p[0].toFixed(0)},${p[1].toFixed(0)}`;
        if (posts.has(key)) continue;
        posts.add(key);
        edgeBox(b, 'concrete', a, c, tc - 0.25, tc + 0.25, 0, LIFT, -0.7, -0.2);
      }
    }
  }

  // ---- fascia: deep white band 5.7-6.5 m standing 0.45 m out round the whole roof edge (w02, w03) ----
  for (const poly of upper) {
    const ring = poly[0], out = outset(ring, FASCIA_OUT);
    for (const [a, c] of edges(out)) wallQuad(acc, 'white', a, c, FASCIA0, EAVE);
    // top and underside as one trapezoid per edge (outset vertex i belongs to ring vertex i)
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length, r0 = ring[i], r1 = ring[j], o0 = out[i], o1 = out[j];
      for (const [y, up] of [[EAVE, true], [FASCIA0, false]] as [number, boolean][]) {
        const A = [r0[0], y, r0[1]], Bp = [r1[0], y, r1[1]], Cp = [o1[0], y, o1[1]], D = [o0[0], y, o0[1]];
        facing(acc, 'white', A, Bp, Cp, up); facing(acc, 'white', A, Cp, D, up);
      }
    }
  }

  // ---- pyramid roofs ----
  for (const t of blocks) hipRoof(acc, t);

  // ---- the raised hall: grey cladding (w30) from the eaves to its flat roof, white coping, solar panels (orthophoto) ----
  const hr = rectOf(hall);
  for (const [a, c] of edges(hr)) {
    wallQuad(acc, 'greyBrick', a, c, EAVE, HALL_TOP - 0.45);
    strip(acc, 'white', a, c, -0.15, len(a, c) + 0.15, HALL_TOP - 0.45, HALL_TOP, 0.15, 0);
  }
  roof(b, [[hr]], HALL_TOP, 'concrete');
  for (const [u0, u1] of [[-15.6, -1.9], [-0.4, 11.6]]) for (const [v0, v1] of [[-5.2, -0.6], [1.0, 6.2]]) {
    const g = new T.BoxGeometry(u1 - u0, 0.2, v1 - v0), m = P((u0 + u1) / 2, (v0 + v1) / 2);
    g.rotateY(-Math.atan2(U[1], U[0]));
    g.translate(m[0], HALL_TOP + 0.04, m[1]);
    b.add(g, 'blue');
  }
  // round flue on the inner canal module (w14, w26, w29)
  { const p = P(-20.6, -18.9), g = new T.CylinderGeometry(0.35, 0.35, 1.6, 8); g.translate(p[0], EAVE + PITCH * 3.5 + 0.2, p[1]); b.add(g, 'dark'); }

  // ---- red steel entrance stair in the north-east notch (w30) ----
  {
    const s0 = P(17.9, 13.6), s1 = P(17.9, 8.0), dx = s1[0] - s0[0], dz = s1[1] - s0[1], L = Math.hypot(dx, dz);
    const g = new T.BoxGeometry(1.3, 0.25, Math.hypot(L, LIFT));
    g.rotateX(-Math.atan2(LIFT, L)); g.rotateY(Math.atan2(dx, dz));
    g.translate((s0[0] + s1[0]) / 2, LIFT / 2 + 0.15, (s0[1] + s1[1]) / 2);
    b.add(g, 'red');
  }
  acc.flush();
}

/** A horizontal triangle wound to face up (`up`) or down, whatever order its corners come in. */
function facing(acc: Acc, c: C, a: number[], b: number[], d: number[], up: boolean) {
  const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
  if ((ny > 0) === up) acc.tri(c, a, b, d); else acc.tri(c, a, d, b);
}

/** A diamond window on the edge a->c at t (metres from the viewer's left end), centre height y: white square turned
 * 45 deg 6 cm proud of the brick, glass 12 cm proud. */
function diamond(acc: Acc, a: PlanPoint, c: PlanPoint, t: number, y: number) {
  const L = len(a, c), tx = (a[0] - c[0]) / L, tz = (a[1] - c[1]) / L, n = edgeNormal(a, c);
  const W = (dt: number, dy: number, o: number) => [c[0] + tx * (t + dt) + n[0] * o, y + dy, c[1] + tz * (t + dt) + n[1] * o];
  // white surround from inside the brick to 7 cm out, glass from inside the surround to 13 cm out: front and four sides each
  for (const [r, o0, o1, col] of [[0.62, -0.02, 0.07, 'white'], [0.46, 0.0, 0.13, 'glass']] as [number, number, number, C][]) {
    const k = [[0, -r], [r, 0], [0, r], [-r, 0]];
    acc.tri(col, W(0, -r, o1), W(r, 0, o1), W(0, r, o1));
    acc.tri(col, W(0, -r, o1), W(0, r, o1), W(-r, 0, o1));
    for (let i = 0; i < 4; i++) {
      const p = k[i], q = k[(i + 1) % 4];
      acc.tri(col, W(p[0], p[1], o0), W(q[0], q[1], o0), W(q[0], q[1], o1));
      acc.tri(col, W(p[0], p[1], o0), W(q[0], q[1], o1), W(p[0], p[1], o1));
    }
  }
}

