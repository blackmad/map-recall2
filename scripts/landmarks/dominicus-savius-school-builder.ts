import type {BuildingTools} from './cultural-builders';
import {Acc, roof, tube, type C} from './tier-kit';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {bar, edges, glazing, outline, pl, quad, rect, shape, wall, face, type Face, type Op, type V3} from './face-kit';

/**
 * Former RK Technische School Dominicus Savius, now Vliegbasis De Huygens, Jan Evertsenstraat 717-781 (BAG pand
 * 0363100012113136; gemeentelijk monument 200564). L. van Steenhardt Carre and K.P. Tholens, opened 1968; partly demolished
 * and renovated 2005-2007 into a business centre (the BAG year 2006 is the renovation). Register text (monument 200564,
 * data.amsterdam.nl, CC0): the remaining four-storey hook-shaped block with a flat roof; in the angle of the hook a two-storey
 * block with seven shed roofs (the old workshops) with a glazed front; the street front of four tall window strips, one per
 * storey, between concrete parapets, fourteen bays on the column grid; the entrance block at the end projecting the full
 * height over two bays, clad in yellow panels with 21 windows in a random pattern; the same yellow on the roof edge; the
 * emergency stair at the end with a glass front and concrete balconies; the rear front like the street front.
 *
 * Native east/south metres from the BAG ring vertex average (dominicus-savius-school-footprints.json), y above the 3DBAG
 * ground -0.46 m NAP; plans from the 3DBAG LoD2.2 roof parts (the hook at 17.2 m, the stair at 15.8 m, the sheds' crests 8.6 m
 * and gutters 4.8 m).
 *
 * Evidence (dominicus-savius-school-inventory.json): recording_2025-06-18_10-57-50_01495 (street front, w02, rectified
 * 40.9 px/m): ground storey glazed between dark columns, three window bands between pebble-concrete parapets at 5.4-8.2,
 * 9.7-12.5 and 13.8-16.6 m, fourteen bays of 4.08 m, the olive-yellow roof edge; recording_2025-06-18_10-57-50_01488 (entrance
 * block, w05, 50.2 px/m): the yellow panels, the scattered windows, the canopy on two posts and the sign; 2025_10_01_11_11_11_00106
 * (the workshops' glazed south front, w01, 39.9 px/m): seven sheds, each a steep curved glazed rise on its west side
 * curving over into a long fall to the gutter, light metal rims, posts at the gutters; TMX7316010203-000154_pano_0000_004009
 * (2016, the workshops' glazed west end), recording_2025-06-18_10-57-50_01739 (the glazed stair with its balconies),
 * TMX7316010203-002513_pano_0000_000501 (2022, the blank pebble-concrete south end of the east wing with yellow edges).
 */

// ---- plans -------------------------------------------------------------------------------------------------------------
/** The hook (3DBAG 17.2 m part, its pilaster notches on the east wing's west face kept). */
const HOOK: PlanPoint[] = [[-16.7, -13.1], [21.4, -3.9], [22.05, -0.5], [24.3, -0.0], [20.2, 18.6], [20.0, 18.8], [19.9, 19.2], [20.3, 19.3], [19.7, 22.1], [19.4, 22.0], [19.3, 22.5], [19.6, 22.5], [18.9, 25.3], [18.4, 25.2], [18.3, 25.6], [18.8, 25.7], [18.1, 28.5], [17.7, 28.4], [17.5, 28.9], [18.0, 29.0], [16.9, 33.6], [16.4, 33.5], [16.322, 33.924], [28.555, 36.927], [40.526, -12.358], [28.266, -15.304], [28.153, -14.835], [-24.3, -27.4], [-27.741, -28.261], [-27.627, -28.727], [-28.083, -28.838], [-28.3, -28.1], [-29.0, -25.5], [-30.9, -17.0], [-30.5, -16.9], [-30.6, -16.4], [-26.2, -15.3], [-17.8, -13.3]];
/** The emergency stair at the west end (3DBAG 15.8 m). */
const STAIR: PlanPoint[] = [[-32.9, -26.1], [-34.785, -18.193], [-35.263, -17.999], [-30.6, -16.9], [-29.0, -25.5], [-29.922, -25.807], [-33.199, -26.594]];
/** Low link roofs between the stair, the hook and the workshops (3DBAG 6.5 m and 4.8 m). */
const LINK65: PlanPoint[] = [[-26.2, -15.3], [-17.8, -13.3], [-17.5, -11.6], [-18.2, -10.9], [-21.4, -11.4], [-26.7, -12.1]];
const LINK48: PlanPoint[] = [[-30.6, -16.4], [-26.2, -15.3], [-26.7, -12.1], [-27.8, -12.2], [-31.461, -12.72], [-30.469, -16.847]];
const H = {hook: 17.2, stair: 15.8, link65: 6.5, link48: 4.8, gutter: 4.8};

// ---- the workshops: seven sheds in their own frame ----------------------------------------------------------------------
/** u east along the glazed south front from its west corner, v north into the building. */
const O: PlanPoint = [-38.884, 4.481], E: PlanPoint = [0.9716, 0.2367], NN: PlanPoint = [0.2367, -0.9716];
const W = (u: number, v: number): PlanPoint => [O[0] + E[0] * u + NN[0] * v, O[1] + E[1] * u + NN[1] * v];
const U_END = 60.85, V_N = 22.65, V_WEST = 18.5, U_NOTCH = 3.1;
/** Crest (top of the steep west rise) of each shed, u metres from the west corner (3DBAG crest lines; the first by the pitch). */
const PITCH = 8.24, CRESTS = [4.1, 12.3, 20.1, 28.8, 37.0, 45.4, 53.5];
/** One shed's section from its crest: the steep curved rise (s < 0, glazed), the crown, the long fall, the gutter. */
const RISE: [number, number][] = [[-0.55, 4.8], [-0.45, 6.3], [-0.3, 7.3], [-0.12, 8.1], [0, 8.35]];
const FALL: [number, number][] = [[0.6, 8.6], [1.5, 8.62], [2.7, 8.45], [4.0, 8.05], [5.0, 7.45], [5.8, 6.6], [6.4, 5.6], [6.85, 4.8]];
/** Roof height at u (the section repeated, clipped to the hall). */
function profile(): {u: number; y: number; glass: boolean}[] {
  const pts: {u: number; y: number; glass: boolean}[] = [];
  const first = CRESTS[0] - PITCH;
  for (const c of [first, ...CRESTS]) {
    for (const [s, y] of RISE) pts.push({u: c + s, y, glass: true});
    for (const [s, y] of FALL) pts.push({u: c + s, y, glass: false});
  }
  pts.sort((a, b) => a.u - b.u);
  // clip to [0, U_END] by interpolation
  const at = (u: number) => { for (let i = 0; i + 1 < pts.length; i++) if (pts[i].u <= u && pts[i + 1].u >= u) { const k = (u - pts[i].u) / (pts[i + 1].u - pts[i].u || 1); return pts[i].y + (pts[i + 1].y - pts[i].y) * k; } return H.gutter; };
  const out = pts.filter(p => p.u > 0 && p.u < U_END);
  out.unshift({u: 0, y: at(0), glass: false});
  out.push({u: U_END, y: at(U_END), glass: false});
  if (!out.some(p => Math.abs(p.u - U_NOTCH) < 1e-6)) { out.push({u: U_NOTCH, y: at(U_NOTCH), glass: false}); out.sort((a, b) => a.u - b.u); }
  // a gutter point where a gap between FALL's end and the next RISE is flat
  return out;
}
const v3 = (u: number, y: number, v: number): V3 => { const p = W(u, v); return [p[0], y, p[1]]; };

function workshops(acc: Acc, b: BuildingTools) {
  const pr = profile();
  // roof: a 0.3 m slab of ruled strips between consecutive section points from 0.15 m out of the south front to the hook
  // (v V_N; V_WEST west of the notch), closed by its light rim on the front (w01: the light metal rims), its back and ends
  const TH = 0.3, V0 = -0.15;
  const vmaxOf = (q: {u: number}) => (q.u <= U_NOTCH + 1e-6 ? V_WEST : V_N);
  for (let i = 0; i + 1 < pr.length; i++) {
    const p = pr[i], q = pr[i + 1], vm = vmaxOf(q);
    const c: C = p.glass && q.glass ? 'glass' : 'slate';
    quad(acc, c, v3(p.u, p.y, V0), v3(q.u, q.y, V0), v3(q.u, q.y, vm), v3(p.u, p.y, vm));
    quad(acc, 'slate', v3(p.u, p.y - TH, vm), v3(q.u, q.y - TH, vm), v3(q.u, q.y - TH, V0), v3(p.u, p.y - TH, V0));
    quad(acc, 'pink', v3(p.u, p.y, V0), v3(p.u, p.y - TH, V0), v3(q.u, q.y - TH, V0), v3(q.u, q.y, V0));
    quad(acc, 'slate', v3(q.u, q.y, vm), v3(q.u, q.y - TH, vm), v3(p.u, p.y - TH, vm), v3(p.u, p.y, vm));
  }
  {
    const n = pr.find(p => Math.abs(p.u - U_NOTCH) < 1e-6)!, a = pr[0], z = pr[pr.length - 1];
    quad(acc, 'slate', v3(n.u, n.y, V_WEST), v3(n.u, n.y - TH, V_WEST), v3(n.u, n.y - TH, V_N), v3(n.u, n.y, V_N));
    quad(acc, 'pink', v3(a.u, a.y, V_WEST), v3(a.u, a.y - TH, V_WEST), v3(a.u, a.y - TH, V0), v3(a.u, a.y, V0));
    quad(acc, 'slate', v3(z.u, z.y, V0), v3(z.u, z.y - TH, V0), v3(z.u, z.y - TH, V_N), v3(z.u, z.y, V_N));
  }
  // the south front: one glazed outline under the section, posts at the gutters, a dark plinth
  const S = face(W(U_END, 0), W(0, 0));   // edge a->b with the hall to the north: t from the west corner (b)
  const ring: [number, number][] = [[0, 0.6], [U_END, 0.6], ...[...pr].reverse().map(p => [p.u, p.y - TH] as [number, number])];
  outline(acc, 'glass', S, ring, 0);
  rect(acc, 'blue', S, 0, U_END, 0, 0.6, 0);
  // glazing bars: verticals every 1.05 m up to the rim, transoms every 1.3 m where the glass is tall enough
  const hAt = (u: number) => { for (let i = 0; i + 1 < pr.length; i++) if (pr[i].u <= u && pr[i + 1].u >= u) { const k = (u - pr[i].u) / (pr[i + 1].u - pr[i].u || 1); return pr[i].y + (pr[i + 1].y - pr[i].y) * k; } return H.gutter; };
  for (let u = 0.6; u < U_END - 0.3; u += 1.05) rect(acc, 'pink', S, u - 0.04, u + 0.04, 0.6, hAt(u) - 0.3, 0.08);
  for (let y = 2.0; y < 8.4; y += 1.3) {
    let start = -1;
    for (let u = 0; u <= U_END + 1e-6; u += 0.15) {
      const ok = hAt(u) - 0.3 > y + 0.1 && u < U_END;
      if (ok && start < 0) start = u;
      if (!ok && start >= 0) { if (u - start > 0.3) rect(acc, 'pink', S, start, u - 0.15, y - 0.04, y + 0.04, 0.05); start = -1; }
    }
  }
  // posts at the gutters and the doors (w01: a pair of glazed doors in most sheds)
  for (const c of CRESTS) {
    const g = c - 0.62;
    bar(acc, 'pink', S, g - 0.2, g + 0.2, 0, H.gutter - 0.2, 0, 0.25);
    bar(acc, 'blue', S, c + 1.2, c + 2.9, 0.6, 2.7, 0, 0.12);   // the door pair, its frame standing over the glazing bars
  }
  // the west end: glass to the section, a dark plinth with a door (2016 panorama)
  {
    const Wf = face(W(0, 0), W(0, V_WEST));
    const y0 = hAt(0) - 0.3;
    wall(acc, Wf, 0, 0.6, 'blue', []);
    const ops: Op[] = [{t0: 0.4, t1: V_WEST - 0.4, y0: 0.6, y1: y0 - 0.3, depth: 0.15, back: 'glass', rev: 'pink'}];
    wall(acc, Wf, 0.6, y0, 'pink', ops);
    glazing(acc, Wf, ops[0], 'pink', Math.round(V_WEST / 1.2), 4);
  }
  // the short north end west of the notch (into the service yard)
  {
    const Nf = face(W(0, V_WEST), W(U_NOTCH, V_WEST));
    const ring2: [number, number][] = [[0, 0], [U_NOTCH, 0], ...pr.filter(p => p.u <= U_NOTCH + 1e-6).map(p => [U_NOTCH - p.u, p.y - 0.3] as [number, number])];
    outline(acc, 'blue', Nf, ring2, 0);
  }
  // the east end of the gutter strip where the last fall meets the east wing: closed by the wing
}

// ---- the hook: the banded fronts -----------------------------------------------------------------------------------------
const BANDS: [number, number][] = [[5.4, 8.2], [9.7, 12.5], [13.8, 16.6]];
const FASCIA = 16.6;
/** Street and rear front: dark ground storey glazed bay by bay, three window bands between pebble-concrete parapets. */
function banded(acc: Acc, f: Face, opts: {bays: number; from?: number; ground?: boolean; doors?: number[]; shop?: [number, number]}) {
  const bw = f.L / opts.bays, col = 0.36, from = opts.from ?? 0;
  const spans = (y0: number, y1: number, depth: number, back: C, rev: C): Op[] => Array.from({length: opts.bays}, (_, i) => ({t0: i * bw + col / 2, t1: (i + 1) * bw - col / 2, y0, y1, depth, back, rev}));
  if (opts.ground !== false && from < 4) {
    const g: Op[] = spans(0.35, 3.75, 0.2, 'glass', 'bronze');
    for (const i of opts.doors ?? []) g[i] = {...g[i], y0: 0.05, back: 'dark'};
    wall(acc, f, 0, 4.0, 'bronze', g);
    g.forEach((o, i) => { if (!(opts.doors ?? []).includes(i)) glazing(acc, f, o, 'bronze', 4, 2); });
  } else wall(acc, f, 0, Math.max(from, 0.01), 'concrete', []);
  // parapets and window bands
  let y = 4.0;
  for (const [b0, b1] of BANDS) {
    if (b1 > from) {
      const lo = Math.max(y, from);
      if (b0 > lo) wall(acc, f, lo, b0, 'concrete', []);
      const ops = spans(b0 + 0.12, b1 - 0.12, 0.18, 'glass', 'bronze');
      wall(acc, f, Math.max(b0, from), b1, 'bronze', b0 >= from ? ops : []);
      if (b0 >= from) for (const o of ops) glazing(acc, f, o, 'bronze', 4, 2);
    }
    y = b1;
  }
  wall(acc, f, BANDS[2][1], H.hook, 'concrete', []);
  bar(acc, 'ochre', f, -0.05, f.L + 0.05, FASCIA, H.hook + 0.35, -0.02, 0.12, true);
}

/**
 * The yellow entrance block: the 21 windows read off the rectified leaf-off view b_20241206_0806_Track55_Sphere_00068
 * (2024-12-06, w05 alt crop, 50 px/m, ground at 905 px); the 2025 view agrees where its tree does not hide them.
 */
const PX = 50, G0 = 905;
const ENTRY_WINDOWS: [number, number, number, number][] = [
  [45, 98, 115, 167], [145, 258, 110, 145], [323, 437, 108, 143], [486, 599, 107, 162],
  [53, 165, 212, 328], [225, 278, 175, 293], [349, 402, 189, 245], [473, 586, 208, 327],
  [319, 433, 296, 352],
  [82, 194, 383, 438], [255, 369, 405, 524], [441, 494, 391, 448], [573, 604, 379, 498],
  [36, 67, 445, 562], [145, 197, 494, 550], [444, 558, 503, 560],
  [206, 319, 589, 624], [53, 165, 613, 728], [360, 412, 600, 718], [473, 587, 611, 726], [235, 288, 661, 715],
  [36, 87, 788, 898],
];
/** The entrance block's front: the hook's 12.6 m edge where the BAG ring steps 0.48 m out at the east end of the street front. */
function entry(acc: Acc, b: BuildingTools, f: Face) {
  {
    const ops: Op[] = ENTRY_WINDOWS.map(([x0, x1, y0, y1]) => ({t0: x0 / PX, t1: x1 / PX, y0: (G0 - y1) / PX, y1: (G0 - y0) / PX, depth: 0.2, back: 'glass', rev: 'bronze'}));
    ops.push({t0: 198 / PX, t1: 447 / PX, y0: 0.05, y1: (G0 - 785) / PX, depth: 0.5, back: 'glass', rev: 'bronze'});   // the entrance doors
    wall(acc, f, 0, H.hook, 'ochre', ops);
    for (const o of ops) if (o.t1 - o.t0 > 1.6) glazing(acc, f, o, 'bronze', 2, 1);
    // panel joints on the yellow cladding: a shallow horizontal line every 1.15 m
    for (let y = 1.15; y < H.hook - 0.5; y += 1.15) bar(acc, 'ochre', f, 0, f.L, y, y + 0.05, 0, 0.06);
    // the canopy on its two posts and the sign on it
    const c0 = 75 / PX, c1 = 572 / PX, cy = (G0 - 750) / PX, ct = (G0 - 727) / PX;
    const P0 = pl(f, c0, 0), P1 = pl(f, c1, 0), Q1 = pl(f, c1, 2.0), Q0 = pl(f, c0, 2.0);
    roof(b, shape([P0, P1, Q1, Q0]), ct, 'bronze');
    acc.tri('bronze', [P0[0], cy, P0[1]], [Q1[0], cy, Q1[1]], [P1[0], cy, P1[1]]); acc.tri('bronze', [P0[0], cy, P0[1]], [Q0[0], cy, Q0[1]], [Q1[0], cy, Q1[1]]);
    rect(acc, 'bronze', {L: f.L, P: (t, y, o) => f.P(t, y, o + 2.0)}, c0, c1, cy, ct, 0);
    for (const t of [152 / PX, 495 / PX]) b.add(tube(pl(f, t, 1.6), 0, pl(f, t, 1.6), cy, 0.09, 6), 'bronze');
    // the sign: 'deHuygens' white on a pink panel, 'Vliegbasis' in red letters beside it (simplified to their panels and caps)
    bar(acc, 'red', f, 356 / PX, 530 / PX, (G0 - 703) / PX, (G0 - 666) / PX, 1.95, 2.05);
    b.sign('VLIEGBASIS', ...signAt(f, 228 / PX, (G0 - 706) / PX, 2.06), 0.075, 'red', 190 / PX, signAngle(f));
    b.sign('DEHUYGENS', ...signAt(f, 443 / PX, (G0 - 698) / PX, 2.1), 0.045, 'white', 160 / PX, signAngle(f));
  }
}
const signAt = (f: Face, t: number, y: number, o: number): [number, number, number] => { const p = f.P(t, y, o); return [p[0], p[1], p[2]]; };
const signAngle = (f: Face) => { const a = f.P(0, 0, 0), b = f.P(0, 0, 1); return Math.atan2(b[0] - a[0], b[2] - a[2]); };

function hook(acc: Acc, b: BuildingTools) {
  for (const {f, n, a, b: e} of edges(HOOK)) {
    const xm = (a[0] + e[0]) / 2, zm = (a[1] + e[1]) / 2;
    if (f.L < 0.8 && nearRing(xm, zm, STAIR)) { wall(acc, f, H.stair, H.hook, 'concrete', []); continue; }   // over the stair's north face
    if (f.L < 0.8) { wall(acc, f, 0, H.hook, 'ochre', []); continue; }                         // the yellow pilasters (w09)
    if (n[1] < -0.9 && f.L > 50) banded(acc, f, {bays: 14, doors: [3]});                        // the street front (w02)
    else if (n[1] < -0.9 && xm > 27) entry(acc, b, f);                                             // the yellow entrance block (w05)
    else if (nearRing(xm, zm, STAIR)) wall(acc, f, 0, H.hook, 'concrete', []);                    // behind the emergency stair
    else if (n[1] > 0.9 && f.L > 30) banded(acc, f, {bays: 9, from: 8.7});                       // the rear front over the sheds
    else if (n[0] > 0.9 && f.L > 40) banded(acc, f, {bays: 12});                                  // east wing, east face (inferred)
    else if (n[1] > 0.9 && zm > 30) {                                                              // the blank south end (w06)
      wall(acc, f, 0, FASCIA, 'concrete', []);
      wall(acc, f, FASCIA, H.hook, 'concrete', []);
      for (const t of [0.2, f.L - 0.2]) bar(acc, 'ochre', f, t - 0.2, t + 0.2, 0, FASCIA, 0, 0.1);
      bar(acc, 'ochre', f, -0.05, f.L + 0.05, FASCIA, H.hook + 0.35, -0.02, 0.12, true);
    } else if (n[0] < -0.9 && zm > 18) banded(acc, f, {bays: Math.max(1, Math.round(f.L / 3.3))});   // east wing west face, south of the sheds (w09)
    else if (n[0] < -0.9 && zm > -1) banded(acc, f, {bays: Math.max(1, Math.round(f.L / 4.08)), from: 8.7});   // over the sheds
    else if (overSheds(xm, zm)) banded(acc, f, {bays: Math.max(1, Math.round(f.L / 4.08)), from: 8.7});   // the inner corner over the sheds
    else banded(acc, f, {bays: Math.max(1, Math.round(f.L / 4.08)), from: f.L < 6 ? 0 : 6.6, ground: f.L > 6});
  }
  roof(b, shape(HOOK), H.hook, 'slate');
  // the rooftop sign at the street front's roof edge (w02, 2025): 'Vliegbasis' in white capitals (its east half behind the
  // tree), then the pink 'deHuygens' panel 40.1-45.5 m from the east end; standing on the roof 0.5 m behind the fascia
  {
    const front = edges(HOOK).find(x => x.n[1] < -0.9 && x.f.L > 50)!.f;
    bar(acc, 'red', front, 40.1, 45.5, H.hook, H.hook + 1.1, -0.75, -0.55);
    b.sign('DEHUYGENS', ...signAt(front, 42.8, H.hook + 0.3, -0.5), 0.07, 'white', 5.0, signAngle(front));
    b.sign('VLIEGBASIS', ...signAt(front, 35.6, H.hook, -0.6), 0.12, 'white', 8.4, signAngle(front));
  }
}

function stairAndLinks(acc: Acc, b: BuildingTools) {
  for (const {f, n, a, b: e} of edges(STAIR)) {
    if (nearRing((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, HOOK)) continue;                          // against the hook: hidden
    if (n[0] < -0.9 && f.L > 6) {
      // the emergency stair (w07): glass front with a concrete balcony slab at every storey
      const ops: Op[] = [{t0: 0.5, t1: f.L - 0.5, y0: 0.4, y1: H.stair - 0.6, depth: 0.4, back: 'glass', rev: 'bronze'}];
      wall(acc, f, 0, H.stair, 'concrete', ops);
      glazing(acc, f, ops[0], 'bronze', 4, 4, 0.12);
      for (const y of [4.0, 8.2, 12.5]) bar(acc, 'concrete', f, 0.25, f.L - 0.25, y - 0.25, y, 0, 1.3);
    } else wall(acc, f, 0, H.stair, 'concrete', []);
  }
  roof(b, shape(STAIR), H.stair, 'slate');
  for (const {f, a, b: e} of edges(LINK65)) if (!nearRing((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, HOOK, LINK48)) wall(acc, f, 0, H.link65, 'bronze', []);
  roof(b, shape(LINK65), H.link65, 'slate');
  for (const {f, a, b: e} of edges(LINK48)) if (!nearRing((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, HOOK, STAIR)) wall(acc, f, 0, H.link48 + 0.1, 'bronze', []);
  roof(b, shape(LINK48), H.link48 + 0.1, 'slate');   // 10 cm over the sheds' gutter it meets (3DBAG 4.8 both)
}

/** Is (x, z) over the workshops' plan (or within 0.5 m of it)? */
function overSheds(x: number, z: number) {
  const dx = x - O[0], dz = z - O[1], u = dx * E[0] + dz * E[1], v = dx * NN[0] + dz * NN[1];
  return u > -0.5 && u < U_END + 0.5 && v > -0.5 && v < V_N + 0.5;
}
/** Is (x, z) within 0.45 m of an edge of any of the rings (an edge shared with a neighbouring block)? */
function nearRing(x: number, z: number, ...rings: PlanPoint[][]) {
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if (Math.hypot(a[0] + dx * k - x, a[1] + dz * k - z) < 0.45) return true;
  }
  return false;
}

export function buildDominicusSaviusSchool(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  workshops(acc, b);
  hook(acc, b);
  stairAndLinks(acc, b);
  acc.flush();
}
