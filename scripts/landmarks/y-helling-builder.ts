import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {Acc, ccw, edgeBox, fin, tube, type C} from './tier-kit';
import {edgeNormal, type PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {blocksAlong, frustumBlock, rampHeight, type Ramp, type UV} from '../../src/canalRecall/landmarks/slipwayDeck';

/**
 * Y-Helling, the eastern slipway of the former NDSM wharf at NDSM-plein 82-92 (BAG pand 0363100012238702, bouwjaar 2006
 * for the studios built under the deck; 35 verblijfsobjecten, industriefunctie). Rijksmonument 528255 (2007) covers
 * both NDSM slipways: "Boven op bebouwing is een schuin aflopend dek aangebracht, uitkomend in het water"; the eastern
 * Grote Hellingbaan was formed in the 1950s from slipways II and III (c. 1920, G.J. Langhout, altered under J.D.
 * Postma). nl.wikipedia NDSM-terrein: "twee in onbruik geraakte hellingbanen met daaronder ateliers en werkruimtes".
 *
 * Frame: u along the slipway axis turned to 12.3 deg (uphill, away from the IJ), v across it (east positive), metres
 * from the BAG vertex average (y-helling-footprints.json). The model's own origin (the catalogue anchor) is moved 36 m
 * down the slope onto the open apron at u = -36: the game bases a landmark on the lowest ground in a 6 m square round
 * its anchor, and the ground field under the deck reads -0.35 m NAP while the apron and the streets round it read
 * 0.9-1.4 m (ground-height-v1). y = 0 is therefore the apron's lowest reading there, 0.93 m NAP.
 * Deck: 3DBAG LoD2.2 roof plane, one slope of 1:20 from 0.99 m NAP at the foot (u -31.07) to 5.51 m at the head
 * (u 59.2), level across. Walls from the Gemeente Amsterdam panoramas (w03 north head, w06/w07 west, w04/w08 east):
 * concrete, a brick middle on the head, red-framed doors and windows of the studios, grey roller doors, red steel stair
 * and railings; keel-block rows and the dark patch from the PDOK 2025 orthophoto.
 */
const B = 12.3 * Math.PI / 180;
const U: PlanPoint = [Math.sin(B), -Math.cos(B)], V: PlanPoint = [Math.cos(B), Math.sin(B)];
const ORIGIN_U = -36;
const P = (u: number, v: number): PlanPoint => [(u - ORIGIN_U) * U[0] + v * V[0], (u - ORIGIN_U) * U[1] + v * V[1]];
const toUV = (p: PlanPoint): UV => { const x = p[0], z = p[1]; return [x * U[0] + z * U[1] + ORIGIN_U, x * V[0] + z * V[1]]; };
const RAMP: Ramp = {u0: -31.07, h0: 0.063, slope: 0.05, min: 0.1};
const h = (u: number) => rampHeight(RAMP, u);
/** Visible street level along the raised walls (1.35 m NAP) above the model's base. */
const STREET = 0.42;

/** BAG ring in (u, v). */
const RING: UV[] = [[-31.33, -26.32], [-31.2, 27.3], [-25.64, 27.27], [-25.16, 26.57], [-19.72, 26.49], [-16.75, 26.45], [0.83, 26.19],
  [4.66, 24.06], [22.52, 24.14], [28.4, 21.03], [59.07, 21.07], [58.97, -20.91], [37.63, -21], [37.59, -26.43], [19.19, -25.95],
  [-17.18, -25.79], [-20.16, -25.77], [-25.16, -25.75], [-25.26, -26.37]];

type Op = HoledOpening & {kind: 'door' | 'glass' | 'roller'; transom?: number};
type Face = {name: string; test: (m: UV) => boolean; brick?: [number, number][]; ops: Op[]; piers?: number[]; canopy?: [number, number, number]};
const door = (t0: number, t1: number, y1: number, transom = 0): Op => ({t0, t1, y0: STREET, y1, depth: 0.12, kind: 'door', transom});
const win = (t0: number, t1: number, y0: number, y1: number): Op => ({t0, t1, y0, y1, depth: 0.15, kind: 'glass'});
/** Openings per face, t in metres from the viewer's left end, read off the rectified crops (about 50 px/m). */
const FACES: Face[] = [
  // w03 head (north, 42 m): concrete ends with red doors, the middle 17 m brick with red-framed doors and windows under a red canopy
  {name: 'head', test: m => m[0] > 58, brick: [[12.3, 29.6]], canopy: [12.4, 15.4, 3.9], ops: [
    door(4.1, 5.6, 3.2, 0.5), door(7.7, 8.8, 3.2, 0.5), door(9.8, 12.2, 3.4, 0.5),
    win(13.1, 14.9, STREET, 3.63), door(15.8, 18.2, 3.63, 0.76), win(18.8, 20.5, 1.88, 3.63), win(21.4, 23.4, 1.88, 3.63),
    door(24.3, 26.1, 3.63, 0.76), door(27.2, 28.9, 3.63, 0.76)]},
  // w06 west face of the head block (21.3 m, t from the north end): red double door, three windows, red door; the stair fills the south end
  {name: 'west-head', test: m => m[0] > 37.7 && m[1] < -20 && m[1] > -22, ops: [
    door(0.4, 3.0, 2.8), win(4.1, 5.8, 1.47, 2.67), win(7.1, 8.7, 1.47, 2.67), win(10.2, 11.8, 1.47, 2.67), door(12.7, 15.2, 2.67)]},
  // w07 west wing (18.4 m, t from the north end): glazed red door, three grey roller doors between concrete piers
  {name: 'west-wing', test: m => m[0] > 19 && m[0] < 37.6 && m[1] < -26, piers: [4.45, 8.2, 11.85, 15.45], ops: [
    {...win(1.6, 4.0, STREET, 2.75), kind: 'glass'}, {...win(5.0, 7.9, STREET, 2.6), kind: 'roller'}, {...win(8.5, 11.6, STREET, 2.5), kind: 'roller'},
    {...win(12.1, 15.1, STREET, 2.35), kind: 'roller'}]},
  // w04 east face of the head block (30.7 m, t from the south end): red-framed windows and a red door behind the willows
  {name: 'east-head', test: m => m[0] > 28.4 && m[1] > 20.5 && m[1] < 21.5, ops: [
    win(9.7, 10.9, 1.5, 2.6), win(12.8, 14.0, 1.5, 2.6), win(15.3, 17.7, 1.5, 2.6), door(18.5, 20.6, 2.8)]},
];

type Tri = {pts: [number, number, number][]; normal: [number, number, number]};
const splitQuad = (q: WallQuad): Tri[] => [{pts: [q.pts[0], q.pts[1], q.pts[2]], normal: q.normal}, {pts: [q.pts[0], q.pts[2], q.pts[3]], normal: q.normal}];
const len = (a: PlanPoint, b: PlanPoint) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a: PlanPoint, b: PlanPoint, t: number): PlanPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Wall-local (t, y, o) triangles onto the plan edge a->b: t runs from b towards a (viewer's left to right from outside). */
function putTris(acc: Acc, c: C, a: PlanPoint, b: PlanPoint, tris: Tri[]) {
  const L = len(a, b), tx = (a[0] - b[0]) / L, tz = (a[1] - b[1]) / L, n = edgeNormal(a, b);
  const W = (p: [number, number, number]) => [b[0] + tx * p[0] + n[0] * p[2], p[1], b[1] + tz * p[0] + n[1] * p[2]];
  for (const t of tris) acc.tri(c, W(t.pts[0]), W(t.pts[1]), W(t.pts[2]));
}
/** A horizontal-ish triangle wound to face up. */
function up(acc: Acc, c: C, a: number[], b: number[], d: number[]) {
  const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
  if (ny > 0) acc.tri(c, a, b, d); else acc.tri(c, a, d, b);
}
const W3 = (u: number, v: number, y: number) => { const p = P(u, v); return [p[0], y, p[1]]; };

export function buildYHelling(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  const ring = ccw(RING.map(([u, v]) => P(u, v)));

  // ---- deck: one plane at 1:20 over the BAG ring ----
  {
    // the dark resurfaced strip down the middle of the deck (orthophoto) is cut out of the deck and laid in it, so the two
    // share their edges at one height
    const patch: UV[] = [[-3.6, -1.9], [0, -5.3], [20, -5.3], [23.9, -8.3], [32.1, -8.3], [32.1, 8.6], [23.9, 8.6], [20, 5.5], [0, 5.5], [-3.6, 2.0]];
    const v2 = (r: UV[]) => r.map(([u, v]) => new T.Vector2(u, v));
    const lay = (c: C, pts: UV[], tris: number[][]) => {
      for (const [i, j, k] of tris) up(acc, c, ...([i, j, k].map(n => W3(pts[n][0], pts[n][1], h(pts[n][0]))) as [number[], number[], number[]]));
    };
    lay('stone', [...RING, ...patch], T.ShapeUtils.triangulateShape(v2(RING), [v2(patch)]));
    lay('dark', patch, T.ShapeUtils.triangulateShape(v2(patch), []));
  }

  // ---- walls: concrete from the base to the deck edge, openings where the panoramas show them ----
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = len(a, c);
    if (L < 0.05) continue;
    const ua = toUV(a), uc = toUV(c), ha = h(ua[0]), hc = h(uc[0]), mid = toUV(lerp(a, c, 0.5));
    const face = FACES.find(f => f.test(mid));
    // t = 0 at c (viewer's left); the deck edge height along t
    const top = (t: number) => hc + (ha - hc) * t / L;
    // segments of material along t
    const cuts: [number, number, C][] = [];
    let t0 = 0;
    for (const [s0, s1] of face?.brick ?? []) { if (s0 > t0) cuts.push([t0, s0, 'concrete']); cuts.push([s0, s1, 'brick']); t0 = s1; }
    cuts.push([t0, L, 'concrete']);
    for (const [s0, s1, mat] of cuts) {
      const ops = (face?.ops ?? []).filter(o => o.t0 >= s0 && o.t1 <= s1).map(o => ({...o, t0: o.t0 - s0, t1: o.t1 - s0}));
      const yFlat = Math.min(top(s0), top(s1)), sl = s1 - s0;
      const hw = holedWall(sl, 0, yFlat, ops);
      const shift = (q: Tri): Tri => ({pts: q.pts.map(p => [p[0] + s0, p[1], p[2]]) as Tri['pts'], normal: q.normal});
      putTris(acc, mat, a, c, hw.face.flatMap(splitQuad).map(shift));
      putTris(acc, 'red', a, c, hw.reveals.flat().flatMap(splitQuad).map(shift));
      hw.backs.forEach((q, k) => {
        const o = ops[k];
        if (o.transom) {
          // red door leaves under a glazed transom (w03); the back split at the transom's foot
          const yT = o.y1 - o.transom, d = -o.depth, rect = (y0: number, y1: number): Tri[] => splitQuad({pts: [[o.t1, y0, d], [o.t0, y0, d], [o.t0, y1, d], [o.t1, y1, d]], normal: q.normal});
          const ref = splitQuad(q)[0], test = rect(o.y0, yT)[0];
          const flip = (ts: Tri[]) => ts.map(t => ({pts: [t.pts[0], t.pts[2], t.pts[1]] as Tri['pts'], normal: t.normal}));
          const same = (ref.pts[1][0] - ref.pts[0][0]) * (ref.pts[2][1] - ref.pts[0][1]) - (ref.pts[1][1] - ref.pts[0][1]) * (ref.pts[2][0] - ref.pts[0][0]);
          const mine = (test.pts[1][0] - test.pts[0][0]) * (test.pts[2][1] - test.pts[0][1]) - (test.pts[1][1] - test.pts[0][1]) * (test.pts[2][0] - test.pts[0][0]);
          const fix = (ts: Tri[]) => Math.sign(same) === Math.sign(mine) ? ts : flip(ts);
          putTris(acc, 'red', a, c, fix(rect(o.y0, yT)).map(shift));
          putTris(acc, 'glass', a, c, fix(rect(yT, o.y1)).map(shift));
        } else putTris(acc, o.kind === 'glass' ? 'glass' : o.kind === 'roller' ? 'frame' : 'red', a, c, splitQuad(q).map(shift));
      });
      // the sloping strip above the level part, up to the deck edge
      const y0 = top(s0), y1 = top(s1);
      if (Math.abs(y1 - y0) > 1e-3) {
        const tri: Tri = {pts: y1 > y0 ? [[s0, yFlat, 0], [s1, yFlat, 0], [s1, y1, 0]] : [[s0, yFlat, 0], [s1, yFlat, 0], [s0, y0, 0]], normal: [0, 0, 1]};
        putTris(acc, mat, a, c, [tri]);
      }
    }
    // the deck edge seen from outside closes against the deck plane; piers between the roller doors (w07)
    for (const t of face?.piers ?? []) fin(acc, 'concrete', a, c, L - t, 0.45, 0, top(t) - 0.05, 0.12);
    if (face?.canopy) { const [c0, c1, y] = face.canopy; edgeBox(b, 'red', a, c, L - c1, L - c0, y, y + 0.15, 0, 1.0); }
  }

  // ---- keel and bilge blocks: rows of truncated concrete pyramids in the outline of the last hull (orthophoto) ----
  const rows: UV[][] = [
    [[-30.5, -24.6], [-21, -24.6]], [[-16.8, -24.6], [10, -24.4], [24.8, -22.4]], [[36.8, -19.4], [58, -13.5]],
    [[56.3, -11.5], [56.3, 12]],
    [[-30.5, 23.0], [0.6, 22.8], [20, 21], [40, 17.4], [58, 13.5]],
    [[-9, 0], [36.3, 0]], [[42.9, 0], [54.5, 0]],
  ];
  for (const row of rows) for (const s of blocksAlong(row, 1.5)) {
    for (const t of frustumBlock(s, h(s.u) - 0.06, [1.0, 1.3], [0.6, 0.9], 1.16)) acc.tri('slate', ...(t.map(([u, y, v]) => W3(u, v, y)) as [number[], number[], number[]]));
  }

  // ---- red steel railing round the raised deck: posts about 2 m apart, top and middle rails (w02, w06, w07, w08) ----
  for (let i = 0; i < ring.length; i++) {
    const A0 = ring[i], C0 = ring[(i + 1) % ring.length], L = len(A0, C0), n0 = edgeNormal(A0, C0);
    const ua = toUV(A0)[0], uc = toUV(C0)[0];
    if (L < 0.5 || Math.max(h(ua), h(uc)) < 1.2) continue;
    if (Math.abs(ua - 37.6) < 0.1 && Math.abs(uc - 37.6) < 0.1) continue;   // where the stair lands (w11)
    // 0.1 m in from the deck edge
    const a: PlanPoint = [A0[0] - n0[0] * 0.1, A0[1] - n0[1] * 0.1], c: PlanPoint = [C0[0] - n0[0] * 0.1, C0[1] - n0[1] * 0.1];
    const hy = (p: PlanPoint) => h(toUV(p)[0]);
    for (const y of [1.1, 0.55]) b.add(tube(a, hy(a) + y, c, hy(c) + y, 0.03, 4), 'red');
    const n = Math.max(1, Math.round(L / 2));
    for (let k = 0; k <= n; k++) { const p = lerp(a, c, k / n); b.add(tube(p, hy(p) - 0.02, p, hy(p) + 1.12, 0.03, 4), 'red'); }
  }

  // ---- red steel stair up the west notch to the wing deck (w06, w07, w11; orthophoto u 38.9-44.3) ----
  {
    const u0 = 44.6, u1 = 37.7, y0 = STREET, y1 = h(37.7), vA = -25.0, vB = -22.6, n = Math.ceil((y1 - y0) / 0.19);
    for (const v of [vA, vB]) {
      b.add(tube(P(u0, v), y0, P(u1, v), y1, 0.1, 4), 'red');
      b.add(tube(P(u0, v), y0 + 1.0, P(u1, v), y1 + 1.0, 0.03, 4), 'red');
      for (const f of [0, 0.5, 1]) { const u = u0 + (u1 - u0) * f, y = y0 + (y1 - y0) * f; b.add(tube(P(u, v), y, P(u, v), y + 1.0, 0.03, 4), 'red'); }
    }
    for (let k = 1; k <= n; k++) {
      const f = k / n, u = u0 + (u1 - u0) * f, y = y0 + (y1 - y0) * f, m = P(u, (vA + vB) / 2);
      const g = new T.BoxGeometry(0.28, 0.04, vB - vA);
      g.rotateY(-Math.atan2(U[1], U[0]));
      g.translate(m[0], y - 0.02, m[1]);
      b.add(g, 'red');
    }
  }
  // red utility cabinets against the east wall (w08)
  for (const u of [19.6, 21.0]) {
    const g = new T.BoxGeometry(0.8, 1.6, 0.45), m = P(u, 24.12 + 0.22);
    g.rotateY(-Math.atan2(U[1], U[0]));
    g.translate(m[0], STREET + 0.8, m[1]);
    b.add(g, 'red');
  }
  acc.flush();
}
