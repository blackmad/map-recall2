import type {BuildingTools} from './cultural-builders';
import {Acc, roof, type C} from './tier-kit';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {bar, face, glazing, shape, wall, type Face, type Op} from './face-kit';

/**
 * Valerius, Valeriusplein 9 / Lassusstraat (BAG pand 0363100012251533, BAG year 2023): 26 dwellings, care and meeting
 * spaces built 2017-2023 by De Jong Groep on the site of the former Valeriuskliniek (nl.wikipedia "Valeriuskliniek":
 * the clinic closed in 2013; "op de plek werd van 2017 tot 2023 gebouwd aan gebouw Valerius"). Architect not found in
 * an open source. A U of dark glazed brick round a garden open to the west behind a fence of brick piers and railings:
 * the long block on the Lassusstraat with its two end blocks and central tower, pergola-topped sections between them
 * with projecting balconies; the two lower wings with a recessed top storey under a steel pergola; the courtyard side
 * of the long block stepping down in planted terraces.
 *
 * Native east/south metres from the BAG ring vertex average (de-valerius-footprints.json), y above the 3DBAG ground
 * +0.5 m NAP. The whole plan is laid out in the long block's own frame: s along the Lassusstraat front from its north
 * corner, o out of that front (the BAG ring's corners fall on whole (s, o) lines within 0.2 m). Heights from the 3DBAG
 * LoD2.2 parts (the long block 19.3 m, its front strips 15.3 m, the wings 15.5 m, the terraces 15.3 / 11.6 / 7.8 m, the
 * garden room 5.4 m); the 3DBAG survey caught the building while it was finished on the street fronts, so the storey
 * lines come from the panoramas.
 *
 * Evidence (de-valerius-inventory.json): b_20241106_1111_Track21_Sphere_00007 (2024, the Lassusstraat front, w01, 34.7 px/m:
 * ground storey of dark recessed glazing between brick piers under a dark band, end blocks and tower with four storeys of
 * white-framed windows and French balconies, the pergola sections with three storeys, projecting balconies and a slotted
 * parapet); recording_2025-07-30_08-35-53_00141 (2025, the south wing's west end, w10, 50 px/m: three storeys of tall
 * windows with French balconies, the slotted parapet, the recessed storey and the pergola on top, the fence);
 * recording_2025-07-30_08-35-53_00150 (2025, w07: the garden behind the fence and the terraces stepping down with their
 * planters); b_20241112_0936_Track25_Sphere_00020 (2024, w11) and recording_2025-07-30_08-35-53_00144 (2025, w14).
 */

// ---- the (s, o) frame ----------------------------------------------------------------------------------------------------
const A: PlanPoint = [5.209, -53.067], U: PlanPoint = [0.39877, 0.91707], N: PlanPoint = [0.91707, -0.39877];
const P = (s: number, o: number): PlanPoint => [A[0] + U[0] * s + N[0] * o, A[1] + U[1] * s + N[1] * o];
const R = (s0: number, s1: number, o0: number, o1: number): PlanPoint[] => [P(s0, o0), P(s1, o0), P(s1, o1), P(s0, o1)];
/** The face on the line p -> q, seen from the `out` side (+1: towards +s or +o, -1: away). */
function F(s0: number, o0: number, s1: number, o1: number, out: PlanPoint): Face {
  const f = face(P(s0, o0), P(s1, o1)), a = f.P(0, 0, 0), b = f.P(0, 0, 1);
  return (b[0] - a[0]) * out[0] + (b[2] - a[2]) * out[1] > 0 ? f : face(P(s1, o1), P(s0, o0));
}
const NEG = (v: PlanPoint): PlanPoint => [-v[0], -v[1]];
const ANGLE = Math.atan2(-U[1], U[0]);   // box rotation that runs a box's width along s

// ---- heights ------------------------------------------------------------------------------------------------------------
const S_END = 76.7, S1 = 13.5, S2 = 31.8, S3 = 44.8, S4 = 63.3, O_BACK = -16.5, O_STRIP = -2.5, O_WING = -42.5;
const H = {tall: 19.3, core: 17.6, strip: 14.3, recess: 17.3, wing: 13.1, wingTop: 15.0, pergola: 15.4, ground: 3.9};
const TERRACES: {o0: number; o1: number; h: number; from: number}[] = [
  {o0: -18.0, o1: O_BACK, h: 15.3, from: 11.6}, {o0: -19.5, o1: -18.0, h: 11.6, from: 7.8},
  {o0: -21.0, o1: -19.5, h: 7.8, from: 4.2}, {o0: -22.5, o1: -21.0, h: 4.2, from: 0},
];

// ---- facade parts --------------------------------------------------------------------------------------------------------
/** A row of white-framed windows with French balcony rails, centred at the t values given. */
function windows(cols: number[], y0: number, y1: number, w: number, depth = 0.25): Op[] {
  return cols.map(t => ({t0: t - w / 2, t1: t + w / 2, y0, y1, depth, back: 'glass' as C, rev: 'white' as C}));
}
function rails(acc: Acc, f: Face, ops: Op[]) {
  for (const o of ops) if (o.y1 - o.y0 > 1.8 && o.y0 > 1) bar(acc, 'blue', f, o.t0 + 0.05, o.t1 - 0.05, o.y0 + 0.9, o.y0 + 1.0, 0, 0.08);
}
const even = (L: number, n: number, margin: number) => Array.from({length: n}, (_, i) => margin + (L - 2 * margin) * (i + 0.5) / n);
/** The dark ground storey (w01): recessed glazing between brick piers under a dark band. */
function groundStorey(acc: Acc, f: Face, pier = 3.6, hidden?: (t: number, y: number) => boolean) {
  const n = Math.max(1, Math.round(f.L / pier)), bw = f.L / n, ops: Op[] = [];
  for (let i = 0; i < n; i++) if (!hidden?.(i * bw, 1) && !hidden?.((i + 1) * bw, 1)) ops.push({t0: i * bw + 0.35, t1: (i + 1) * bw - 0.35, y0: 0.05, y1: 3.2, depth: 0.6, back: 'glass', rev: 'blue'});
  wall(acc, f, 0, 3.3, 'brick', ops);
  for (const o of ops) glazing(acc, f, o, 'blue', 2, 1);
  wall(acc, f, 3.3, H.ground, 'blue', []);
}
const ROWS4: [number, number][] = [[4.6, 7.1], [8.2, 10.7], [11.8, 14.3], [15.4, 17.9]];
/** End blocks and the tower: four storeys of deep-set windows over the ground storey. */
function tallFront(acc: Acc, f: Face, cols: number[], topCols: number[], street: boolean, hidden?: (t: number, y: number) => boolean) {
  if (street) groundStorey(acc, f, 3.6, hidden); else wall(acc, f, 0, H.ground, 'brick', windows(cols, 0.4, 3.3, 1.5));
  const ops: Op[] = [];
  ROWS4.forEach(([y0, y1], k) => ops.push(...windows(k === 3 ? topCols : cols, y0, y1, 1.45, 0.4).filter(o => !hidden?.(o.t0 - 0.2, y1) && !hidden?.(o.t1 + 0.2, y1))));
  wall(acc, f, H.ground, H.tall, 'brick', ops);
  rails(acc, f, ops);
  bar(acc, 'brick', f, -0.05, f.L + 0.05, H.tall - 0.25, H.tall + 0.25, -0.02, 0.06, true);   // the coping
}
/** The pergola sections' front (w01): three storeys with projecting balconies, the slotted parapet. */
function stripFront(acc: Acc, f: Face) {
  groundStorey(acc, f);
  const cols = even(f.L, Math.max(2, Math.round(f.L / 2.45)), 0.4), ops: Op[] = [];
  ROWS4.slice(0, 3).forEach(([y0, y1]) => ops.push(...windows(cols, y0, Math.min(y1, 13.0), 1.5)));
  const slots = even(f.L, Math.max(2, Math.round(f.L / 2.45)), 0.4).map(t => ({t0: t - 0.7, t1: t + 0.7, y0: 13.4, y1: 13.9, depth: 0.3, back: 'dark' as C, rev: 'brick' as C}));
  wall(acc, f, H.ground, H.strip, 'brick', [...ops, ...slots]);
  rails(acc, f, ops);
  // two projecting balconies per storey, swapping sides storey by storey (w01)
  for (let k = 0; k < 3; k++) for (const i of k % 2 ? [1, cols.length - 2] : [0, cols.length - 3]) {
    if (i < 0 || i >= cols.length) continue;
    const t = cols[i], y = ROWS4[k][0] - 0.05;
    bar(acc, 'concrete', f, t - 1.4, t + 1.4, y - 0.25, y, 0, 1.4);
    bar(acc, 'stone', f, t - 1.4, t + 1.4, y, y + 1.0, 1.25, 1.4);
    bar(acc, 'stone', f, t - 1.4, t - 1.3, y, y + 1.0, 0, 1.25); bar(acc, 'stone', f, t + 1.3, t + 1.4, y, y + 1.0, 0, 1.25);
  }
}
/** A recessed glazed storey (behind the pergola sections, the wings' top storey, the terraces' faces). */
function glazedStorey(acc: Acc, f: Face, y0: number, y1: number, pitch = 2.4) {
  const n = Math.max(1, Math.round(f.L / pitch)), bw = f.L / n, ops: Op[] = [];
  for (let i = 0; i < n; i++) ops.push({t0: i * bw + 0.25, t1: (i + 1) * bw - 0.25, y0: y0 + 0.15, y1: y1 - 0.3, depth: 0.2, back: 'glass', rev: 'white'});
  wall(acc, f, y0, y1, 'brick', ops);
}
/** The wings' fronts (w10): three storeys of tall windows with French balconies, the slotted parapet. */
function wingFront(acc: Acc, f: Face, street: boolean) {
  const n = Math.max(1, Math.round(f.L / 3.3)), cols = even(f.L, n, 0.3);
  const rows: [number, number][] = [[0.3, 3.6], [4.3, 7.3], [8.1, 11.1]];
  const ops: Op[] = rows.flatMap(([y0, y1], k) => windows(cols, y0, y1, 1.95, k === 0 && street ? 0.3 : 0.25));
  const slots = cols.map(t => ({t0: t - 0.9, t1: t + 0.9, y0: 12.3, y1: 12.9, depth: 0.3, back: 'dark' as C, rev: 'brick' as C}));
  wall(acc, f, 0, H.wing, 'brick', [...ops, ...slots]);
  rails(acc, f, ops);
  // the brick pilaster grid (w10): proud piers between the windows
  for (let i = 0; i <= n; i++) { const t = i === 0 ? 0.15 : i === n ? f.L - 0.15 : (cols[i - 1] + cols[i]) / 2; bar(acc, 'brick', f, t - 0.15, t + 0.15, 0, 11.6, 0, 0.1); }
}

// ---- the blocks ----------------------------------------------------------------------------------------------------------
function longBlock(acc: Acc, b: BuildingTools) {
  // the end blocks and the tower, full depth and height
  for (const [s0, s1, cols, topCols] of [
    [0, S1, [2.0, 5.0, 8.3, 11.5], [2.0, 5.0, 8.3, 11.5]],
    [S2, S3, [2.0, 4.9, 8.1, 11.0], [4.9, 8.1]],
    [S4, S_END, [2.0, 5.1, 8.3, 11.4], [2.0, 5.1, 8.3, 11.4]],
  ] as [number, number, number[], number[]][]) {
    const front = F(s0, 0, s1, 0, N), sOf = (t: number) => { const p = front.P(t, 0, 0); return (p[0] - A[0]) * U[0] + (p[2] - A[1]) * U[1]; };
    tallFront(acc, front, cols, topCols, true, (t, y) => sOf(t) > 69.0 && sOf(t) < 76.5 && y < 15.6);   // behind the bay at the south end
    if (s0 === 0) tallFront(acc, F(0, O_BACK, 0, 0, NEG(U)), [3.2, 6.6, 10.0, 13.4], [3.2, 6.6, 10.0, 13.4], true);   // the NW end (w02, inferred)
    if (s1 === S_END) tallFront(acc, F(S_END, O_BACK, S_END, 0, U), [3.2, 6.6, 10.0, 13.4], [3.2, 6.6, 10.0, 13.4], true);   // the SE end (w03, inferred)
    // the courtyard side above the wings / terraces
    const back = F(s0, O_BACK, s1, O_BACK, NEG(N)), from = s0 === S2 ? 15.3 : H.wingTop;
    wall(acc, back, from, H.tall, 'brick', windows(even(back.L, 4, 0.5), 16.0, 18.3, 1.45, 0.3));
    // the side faces above the pergola sections and the core behind them
    if (s0 > 0) { wall(acc, F(s0, O_STRIP, s0, 0, NEG(U)), H.strip, H.tall, 'brick', []); wall(acc, F(s0, O_BACK, s0, O_STRIP, NEG(U)), H.core, H.tall, 'brick', []); }
    if (s1 < S_END) { wall(acc, F(s1, O_STRIP, s1, 0, U), H.strip, H.tall, 'brick', []); wall(acc, F(s1, O_BACK, s1, O_STRIP, U), H.core, H.tall, 'brick', []); }
    roof(b, shape(R(s0, s1, O_BACK, 0)), H.tall, 'slate');
  }
  // the pergola sections: the front to the slotted parapet, the recessed storey, the pergola, the core behind
  for (const [s0, s1] of [[S1, S2], [S3, S4]]) {
    stripFront(acc, F(s0, 0, s1, 0, N));
    roof(b, shape(R(s0, s1, O_STRIP, 0)), H.strip, 'slate');
    bar(acc, 'brick', F(s0, 0, s1, 0, N), 0, F(s0, 0, s1, 0, N).L, H.strip, H.strip + 0.5, -0.3, 0, true);   // the parapet
    glazedStorey(acc, F(s0, O_STRIP, s1, O_STRIP, N), H.strip, H.recess);
    wall(acc, F(s0, O_STRIP, s1, O_STRIP, N), H.recess, H.core, 'brick', []);
    const back = F(s0, O_BACK, s1, O_BACK, NEG(N));
    glazedStorey(acc, back, 15.3, H.core);
    roof(b, shape(R(s0, s1, O_BACK, O_STRIP)), H.core, 'slate');
    // the steel pergola from the recessed storey to the front (w01)
    const L = s1 - s0, n = Math.max(2, Math.round(L / 2.4));
    for (let i = 0; i <= n; i++) { const s = s0 + 0.15 + (L - 0.3) * i / n, p = P(s, -1.25); b.box(p[0], H.recess, p[1], 0.18, 0.3, 2.5, 'blue', ANGLE); }
    { const p = P((s0 + s1) / 2, -0.12); b.box(p[0], H.recess, p[1], L - 0.1, 0.3, 0.2, 'blue', ANGLE); }
    for (const s of [s0 + 0.2, s1 - 0.2, (s0 + s1) / 2]) { const p = P(s, -0.12); b.box(p[0], H.strip + 0.5, p[1], 0.14, H.recess - H.strip - 0.5, 0.14, 'blue', ANGLE); }
  }
  // the terraces stepping down into the garden, planters on their edges (w07)
  for (const t of TERRACES) {
    const f = F(S1, t.o0, S4, t.o0, NEG(N));
    if (t.from === 0) {
      const ops: Op[] = [];
      const n = Math.round(f.L / 3.6), bw = f.L / n;
      for (let i = 0; i < n; i++) {
        const sm = S4 - (i + 0.5) * bw;   // the face runs from S4 at the viewer's left (seen from the garden)
        if (sm > 34.0 && sm < 42.5) continue;   // the garden room stands in front
        ops.push({t0: i * bw + 0.4, t1: (i + 1) * bw - 0.4, y0: 0.05, y1: 3.0, depth: 0.25, back: 'glass', rev: 'white'});
      }
      wall(acc, f, 0, t.h, 'brick', ops);
    } else glazedStorey(acc, f, t.from, t.h, 3.0);
    roof(b, shape(R(S1, S4, t.o0, t.o1)), t.h, 'green');
    bar(acc, 'stone', f, 0, f.L, t.h, t.h + 0.9, -0.45, 0, true);   // the planter parapet
  }
  // the bay at the south end of the front (3DBAG 15.3 m)
  {
    const r = R(69.2, 76.3, 0, 4.7);
    for (const [f, cols] of [[F(69.2, 4.7, 76.3, 4.7, N), [1.7, 5.4]], [F(69.2, 0, 69.2, 4.7, NEG(U)), [2.35]], [F(76.3, 0, 76.3, 4.7, U), [2.35]]] as [Face, number[]][]) {
      wall(acc, f, 0, H.ground, 'brick', windows(cols, 0.3, 3.3, 1.4));
      const ops = ROWS4.slice(0, 3).flatMap(([y0, y1]) => windows(cols, y0, y1, 1.4, 0.3));
      wall(acc, f, H.ground, 15.3, 'brick', ops); rails(acc, f, ops);
    }
    roof(b, shape(r), 15.3, 'slate');
  }
}
function wing(acc: Acc, b: BuildingTools, s0: number, s1: number, courtyardOut: PlanPoint) {
  const IN = 1.6;
  // the outer faces: the street end (o = O_WING) and the long outer side (s0 = 0 for the north wing, S_END for the south)
  const outerS = s0 === 0 ? 0 : s1, courtS = s0 === 0 ? s1 : s0;
  wingFront(acc, F(s0, O_WING, s1, O_WING, NEG(N)), true);
  wingFront(acc, F(outerS, O_WING, outerS, O_BACK, s0 === 0 ? NEG(U) : U), false);
  // the courtyard side: windows in front of the garden, blank behind the terraces
  wingFront(acc, F(courtS, O_WING, courtS, -22.5, courtyardOut), false);
  wall(acc, F(courtS, -22.5, courtS, O_BACK, courtyardOut), 0, H.wing, 'brick', []);
  roof(b, shape(R(s0, s1, O_WING, O_BACK)), H.wing, 'slate');
  // the recessed top storey under the pergola (w10)
  const t0 = s0 === 0 ? IN : s0, t1 = s0 === 0 ? s1 : s1 - IN, oo = O_WING + IN;
  glazedStorey(acc, F(t0, oo, t1, oo, NEG(N)), H.wing, H.wingTop);
  glazedStorey(acc, F(s0 === 0 ? t0 : t1, oo, s0 === 0 ? t0 : t1, O_BACK, s0 === 0 ? NEG(U) : U), H.wing, H.wingTop);
  glazedStorey(acc, F(s0 === 0 ? t1 : t0, oo, s0 === 0 ? t1 : t0, O_BACK, courtyardOut), H.wing, H.wingTop);
  roof(b, shape(R(t0, t1, oo, O_BACK)), H.wingTop, 'slate');
  bar(acc, 'brick', F(s0, O_WING, s1, O_WING, NEG(N)), 0, s1 - s0, H.wing, H.wing + 0.9, -0.25, 0, true);   // the parapet
  // the pergola: a perimeter beam on posts and cross beams at 2.6 m
  const L = s1 - s0, W = O_BACK - O_WING;
  { const p = P((s0 + s1) / 2, O_WING + 0.1); b.box(p[0], H.wingTop, p[1], L, 0.4, 0.2, 'blue', ANGLE); }
  { const p = P(outerS === 0 ? 0.1 : S_END - 0.1, (O_WING + O_BACK) / 2); b.box(p[0], H.wingTop, p[1], 0.2, 0.4, W, 'blue', ANGLE); }
  { const p = P(courtS === s1 ? s1 - 0.1 : s0 + 0.1, (O_WING + O_BACK) / 2); b.box(p[0], H.wingTop, p[1], 0.2, 0.4, W, 'blue', ANGLE); }
  for (let k = 1; k * 2.6 < W - 0.5; k++) { const p = P((s0 + s1) / 2, O_WING + k * 2.6); b.box(p[0], H.wingTop + 0.1, p[1], L - 0.2, 0.25, 0.14, 'blue', ANGLE); }
  for (const [s, o] of [[s0 + 0.1, O_WING + 0.1], [s1 - 0.1, O_WING + 0.1]]) { const p = P(s, o); b.box(p[0], H.wing + 0.9, p[1], 0.14, H.wingTop - H.wing - 0.9, 0.14, 'blue', ANGLE); }
}
/** The garden room in front of the tower (3DBAG 5.4 m). */
function gardenRoom(acc: Acc, b: BuildingTools) {
  const s0 = 34.3, s1 = 42.2, o0 = -28.5, o1 = -22.5;
  glazedStorey(acc, F(s0, o0, s1, o0, NEG(N)), 0, 5.4, 2.6);
  glazedStorey(acc, F(s0, o0, s0, o1, NEG(U)), 0, 5.4, 2.6);
  glazedStorey(acc, F(s1, o0, s1, o1, U), 0, 5.4, 2.6);
  roof(b, shape(R(s0, s1, o0, o1)), 5.4, 'green');
  bar(acc, 'brick', F(s0, o0, s1, o0, NEG(N)), 0, s1 - s0, 5.4, 5.8, -0.25, 0, true);
}
/** The garden fence (w07): a dark plinth, brick piers every 4.3 m, black railings between them. */
function fence(b: BuildingTools) {
  const runs: [number, number, number, number][] = [
    [15.2, -47.4, 34.8, -47.4], [34.8, -47.4, 34.8, -42.2], [34.8, -42.2, 41.9, -42.2], [41.9, -42.2, 41.9, -47.4], [41.9, -47.4, 61.6, -47.4],
    [15.2, -47.4, 15.2, -24.0], [61.6, -47.4, 61.6, -32.6],
  ];
  for (const [sa, oa, sb, ob] of runs) {
    const L = Math.hypot(sb - sa, ob - oa), alongS = Math.abs(sb - sa) > Math.abs(ob - oa);
    const at = (k: number) => P(sa + (sb - sa) * k, oa + (ob - oa) * k);
    const m = at(0.5), w = alongS ? L : 0.3, d = alongS ? 0.3 : L;
    b.box(m[0], 0, m[1], w, 0.45, d, 'blue', ANGLE);
    b.box(m[0], 2.05, m[1], alongS ? L : 0.06, 0.06, alongS ? 0.06 : L, 'blue', ANGLE);
    const piers = Math.max(1, Math.round(L / 4.3));
    for (let i = 0; i <= piers; i++) { const p = at(i / piers); b.box(p[0], 0, p[1], 0.55, 2.35, 0.55, 'brick', ANGLE); }
    const bars = Math.floor(L / 0.32);
    for (let i = 1; i < bars; i++) { const p = at(i / bars); b.box(p[0], 0.45, p[1], 0.04, 1.62, 0.04, 'blue', ANGLE); }
  }
}

export function buildDeValerius(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  longBlock(acc, b);
  wing(acc, b, 0, S1, U);
  wing(acc, b, S4, S_END, NEG(U));
  gardenRoom(acc, b);
  fence(b);
  acc.flush();
}
