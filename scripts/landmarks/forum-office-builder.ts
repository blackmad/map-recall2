import type {BuildingTools} from './cultural-builders';
import {Acc, roof, type C} from './tier-kit';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {bar, edges, glazing, rect, shape, wall, type Face, type Op} from './face-kit';

/**
 * EDGE Stadium, the former Forum office building, Fred. Roeskestraat 100 (BAG pand 0363100012125840; BAG year 2001).
 * Atelier PRO (Hans Kalkhoven, Leon Thier) for Amstelland Vastgoed, designed 1996, completed 2001, MIPIM award 2002;
 * renovated and extended by Atelier PRO in 2022 (the S-shaped entrance block enclosed in a rectangular glass serre) and
 * renamed EDGE Stadium (architectuur.org, Wikidata Q125679074; the 2020 site hoarding reads EDGE / STADIUM).
 * Two office wings shifted against each other, a tall atrium between them closed towards the Fred. Roeskestraat by the
 * glazed serre; the long sides climate windows between panels clad in tinted glass; the wings' short ends sandstone with
 * scattered slit windows.
 *
 * Native east/south metres from the BAG ring vertex average (forum-office-footprints.json), y above the 3DBAG ground
 * -0.33 m NAP; heights from the 3DBAG LoD2.2 parts (the wings 26.3 m, the atrium and serre 30.1 m, the north deck 3.1 m).
 *
 * Evidence (forum-office-inventory.json): b_20241105_0934_Track15_Sphere_00028 and recording_2025-07-30_06-59-28_00051 (the
 * serre's south front, w04, 50 px/m: six bays of dark frames, a 4.8 m ground storey and six storeys over it, the revolving
 * door in the fifth bay from the west); recording_2024-09-02_06-51-56_00427 (the west wing's sandstone south end, w05, 49.9 px/m:
 * six rows of slits); b_20241105_0934_Track15_Sphere_00032 (the east wing's end, w06: five rows of slits over a recessed
 * ribbed green-glass ground storey); recording_2024-09-02_06-51-56_00440 (w07: the wing's side, a grid of windows and
 * tinted-glass panels, the sandstone end cantilevered over the dark ground storey); recording_2024-09-02_05-55-18_01011
 * (w02, the Amstelveenseweg side behind the trees: the same grid, seven storeys).
 */

// ---- plans -------------------------------------------------------------------------------------------------------------
/** The west wing (3DBAG 26.3 m): its inner edge straightened along the atrium. */
const WW: PlanPoint[] = [[-36.3, -57.8], [-18.2, -58.7], [-15.7, 27.3], [-31.6, 28.1]];
/** The east wing (3DBAG 26.3 m), shifted 5 m south against the west wing. */
const EW: PlanPoint[] = [[10.9, -53.6], [24.1, -54.3], [28.95, 32.6], [14.1, 33.4], [13.7, 26.1], [13.5, 26.1]];
/** The atrium between the wings and the serre on its south end (3DBAG 30.1 m), overlapping both wings by 0.4 m. */
const CORE: PlanPoint[] = [[-18.6, -55.2], [11.3, -56.3], [13.9, 26.1], [9.5, 26.3], [9.7, 30.2], [-12.2, 31.35], [-12.5, 26.6], [-16.1, 26.8]];
/** The low deck along the north side (3DBAG 3.1 m). */
const DECK: PlanPoint[] = [[-36.6, -62.4], [21.6, -65.65], [23.56, -65.7], [23.9, -53.6], [10.0, -53.0], [-19.0, -54.5], [-36.0, -57.3]];
const H = {wing: 26.3, core: 30.1, deck: 3.1};
const GROUND = 4.4, STOREY = (H.wing - GROUND - 0.9) / 6;

// ---- facade systems -------------------------------------------------------------------------------------------------------
/** The long sides (w02, w07): a grid of climate windows and panels clad in tinted glass, alternating bay by bay and storey by storey. */
function glassGrid(acc: Acc, f: Face, y0: number, top: number, ground: boolean) {
  const bays = Math.max(1, Math.round(f.L / 1.8)), bw = f.L / bays, ops: Op[] = [];
  if (ground && y0 === 0) for (let i = 0; i < bays; i++) if (!inDeck(f.P(i * bw, 0, -0.3)) && !inDeck(f.P((i + 1) * bw, 0, -0.3))) ops.push({t0: i * bw + 0.08, t1: (i + 1) * bw - 0.08, y0: 0.05, y1: GROUND - 0.3, depth: 0.5, back: 'glass', rev: 'bronze'});
  for (let k = 0; k < 6; k++) {
    const yb = GROUND + k * STOREY;
    if (yb < y0 - 0.01 || yb + STOREY > top) continue;
    for (let i = 0; i < bays; i++) ops.push({t0: i * bw + 0.09, t1: (i + 1) * bw - 0.09, y0: yb + 0.12, y1: yb + STOREY - 0.12, depth: 0.12, back: (i + k) % 2 ? 'dark' : 'glass', rev: 'bronze'});
  }
  wall(acc, f, y0, top, 'bronze', ops);
}
/** The sandstone ends with scattered slits: [t0, t1, y0, y1] px in a 49.9 px/m crop, ground at g px, t from the viewer's left. */
type Slit = [number, number, number, number];
const PX = 49.9;
const W_END: {g: number; slits: Slit[]} = {g: 1560, slits: [
  [92, 118, 335, 465], [190, 218, 335, 465], [348, 374, 335, 465], [469, 495, 335, 465], [628, 654, 335, 465],
  [112, 138, 548, 695], [433, 460, 548, 695], [674, 700, 548, 695],
  [131, 157, 727, 873], [232, 259, 727, 873], [393, 419, 727, 873], [634, 660, 727, 873],
  [192, 218, 905, 1052], [353, 379, 905, 1052], [595, 621, 905, 1052],
  [151, 177, 1082, 1230], [393, 419, 1082, 1230], [553, 579, 1082, 1230], [654, 680, 1082, 1230],
  [85, 111, 1260, 1408], [251, 277, 1260, 1408], [448, 474, 1260, 1408], [573, 599, 1260, 1408],
]};
const E_END: {g: number; slits: Slit[]} = {g: 1490, slits: [
  [45, 62, 335, 462], [145, 162, 335, 462], [308, 326, 335, 462], [488, 505, 335, 462], [596, 613, 335, 462],
  [63, 79, 550, 695], [235, 252, 550, 695], [470, 487, 550, 695], [632, 649, 550, 695],
  [103, 120, 735, 877], [288, 305, 735, 877], [592, 608, 735, 877],
  [43, 60, 915, 1058], [266, 283, 915, 1058], [389, 405, 915, 1058], [612, 628, 915, 1058],
  [84, 101, 1095, 1240], [186, 203, 1095, 1240], [425, 442, 1095, 1240], [550, 567, 1095, 1240],
]};
function stoneEnd(acc: Acc, f: Face, top: number, spec: {g: number; slits: Slit[]}, recessed: number, scale = 1) {
  const s = (f.L / ((spec.slits.reduce((m, x) => Math.max(m, x[1]), 0) + 60) / PX)) * scale;
  const ops: Op[] = spec.slits.map(([a, b, c, d]) => ({t0: Math.max(0.3, a / PX * s), t1: Math.min(f.L - 0.3, b / PX * s), y0: (spec.g - d) / PX, y1: (spec.g - c) / PX, depth: 0.25, back: 'glass', rev: 'ochre'}))
    .filter(o => o.y0 > recessed + 0.3 && o.t1 > o.t0 + 0.2);
  if (recessed > 0) ops.push({t0: 0.35, t1: f.L - 0.35, y0: 0, y1: recessed, depth: 1.4, back: 'pink', rev: 'ochre'});
  wall(acc, f, 0, top, 'ochre', ops);
  if (recessed > 0) {
    const o = ops[ops.length - 1];
    for (let t = 1.4; t < f.L - 0.8; t += 1.15) rect(acc, 'bronze', f, t - 0.04, t + 0.04, 0, recessed, -o.depth + 0.08);   // the ribbed green glass (w06)
  }
}
/** The serre's south front (w04, 2025): six bays of deep dark frames, a 4.8 m ground storey and six storeys over it. */
function serreFront(acc: Acc, f: Face, top: number) {
  const bays = Math.max(1, Math.round(f.L / 3.67)), bw = f.L / bays, ops: Op[] = [];
  const rows: [number, number][] = [[0.05, 4.7]];
  const st = (top - 1.5 - 4.85) / 6;
  for (let k = 0; k < 6; k++) rows.push([4.85 + k * st + 0.12, 4.85 + (k + 1) * st - 0.12]);
  for (const [y0, y1] of rows) for (let i = 0; i < bays; i++) ops.push({t0: i * bw + 0.2, t1: (i + 1) * bw - 0.2, y0, y1, depth: 0.45, back: 'glass', rev: 'bronze'});
  wall(acc, f, 0, top, 'bronze', ops);
  for (const o of ops) glazing(acc, f, o, 'bronze', 2, 1);
  for (let k = 1; k < rows.length; k++) bar(acc, 'bronze', f, 0, f.L, rows[k][0] - 0.3, rows[k][0] - 0.12, 0, 0.18);   // the deep floor-edge sills
}

// ---- blocks ----------------------------------------------------------------------------------------------------------------
function nearRing(x: number, z: number, ...rings: PlanPoint[][]) {
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if (Math.hypot(a[0] + dx * k - x, a[1] + dz * k - z) < 0.6) return true;
  }
  return false;
}
function inside(x: number, z: number, r: PlanPoint[]) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}
const inDeck = (p: [number, number, number]) => inside(p[0], p[2], DECK);
function wing(acc: Acc, b: BuildingTools, ring: PlanPoint[], end: {g: number; slits: Slit[]}, recessed: number) {
  for (const {f, n, a, b: e} of edges(ring)) {
    const xm = (a[0] + e[0]) / 2, zm = (a[1] + e[1]) / 2;
    if (f.L < 1) { wall(acc, f, 0, H.wing, 'ochre', []); continue; }
    if (nearRing(xm, zm, CORE) && Math.abs(n[0]) > 0.9) { wall(acc, f, 0, H.wing, 'bronze', []); continue; }          // inside the atrium's edge
    const south = n[1] > 0.9, north = n[1] < -0.9;
    if (south) stoneEnd(acc, f, H.wing, end, recessed);
    else if (north) { wall(acc, f, 0, H.deck, 'ochre', []); stoneEndFrom(acc, f, H.deck, H.wing, end); }
    else glassGrid(acc, f, 0, H.wing, true);
  }
  roof(b, shape(ring), H.wing, 'slate');
}
/** The north ends over the deck: the same sandstone and slits (inferred from the south ends; w03 is a 2019 view behind a tree). */
function stoneEndFrom(acc: Acc, f: Face, y0: number, top: number, spec: {g: number; slits: Slit[]}) {
  const s = f.L / ((spec.slits.reduce((m, x) => Math.max(m, x[1]), 0) + 60) / PX);
  const ops: Op[] = spec.slits.map(([a, b2, c, d]) => ({t0: a / PX * s, t1: b2 / PX * s, y0: (spec.g - d) / PX, y1: (spec.g - c) / PX, depth: 0.25, back: 'glass' as C, rev: 'ochre' as C})).filter(o => o.y0 > y0 + 0.4 && o.t1 > o.t0 + 0.2 && o.t0 > 0.3 && o.t1 < f.L - 0.3);
  wall(acc, f, y0, top, 'ochre', ops);
}
function core(acc: Acc, b: BuildingTools) {
  for (const {f, n, a, b: e} of edges(CORE)) {
    const xm = (a[0] + e[0]) / 2, zm = (a[1] + e[1]) / 2;
    const overWing = inside(xm - n[0] * 0.7, zm - n[1] * 0.7, WW) || inside(xm - n[0] * 0.7, zm - n[1] * 0.7, EW) || inside(xm + n[0] * 0.3, zm + n[1] * 0.3, WW) || inside(xm + n[0] * 0.3, zm + n[1] * 0.3, EW);
    const y0 = overWing ? H.wing - 0.3 : n[1] < -0.9 ? H.deck : 0;
    if (n[1] > 0.9 && f.L > 15) serreFront(acc, f, H.core);
    else if (y0 >= H.wing - 0.5) wall(acc, f, y0, H.core, 'bronze', f.L > 3 ? [{t0: 0.3, t1: f.L - 0.3, y0: y0 + 0.6, y1: H.core - 0.5, depth: 0.2, back: 'glass', rev: 'bronze'}] : []);   // the atrium's glazed top over the wings
    else if (n[1] < -0.9) glassGrid(acc, f, y0, H.core, false);
    else wall(acc, f, y0, H.core, 'bronze', f.L > 1.5 ? [{t0: 0.25, t1: f.L - 0.25, y0: y0 + 0.2, y1: H.core - 0.6, depth: 0.3, back: 'glass', rev: 'bronze'}] : []);   // the serre's glazed sides
  }
  roof(b, shape(CORE), H.core, 'slate');
}
function deck(acc: Acc, b: BuildingTools) {
  for (const {f, n, a, b: e} of edges(DECK)) {
    const xm = (a[0] + e[0]) / 2, zm = (a[1] + e[1]) / 2;
    wall(acc, f, 0, H.deck, 'concrete', []);
    if (n[1] > 0.5 && [WW, EW, CORE].some(r => inside(xm, zm, r))) continue;   // under the wings and the atrium: no parapet
    bar(acc, 'concrete', f, 0, f.L, H.deck, H.deck + 1.0, -0.1, 0.0, true);   // the deck's parapet
  }
  roof(b, shape(DECK), H.deck, 'slate');
}

export function buildForumOffice(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  wing(acc, b, WW, W_END, 0);
  wing(acc, b, EW, E_END, 3.7);
  core(acc, b);
  deck(acc, b);
  acc.flush();
}
