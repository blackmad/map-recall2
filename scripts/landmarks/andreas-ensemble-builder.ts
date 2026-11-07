import type {BuildingTools} from './cultural-builders';
import {glyphRuns} from './mixed-case-glyphs';
import {balcony, face, flushFaces, ledgeStrip, opening, planFrame, resetFaces, slab, sub, wall, type Col, type Face, type FR, type P2} from './modern-front-kit';

/**
 * Andreas Ensemble block, Nieuw-West: BAG pand 0363100012111082 (bouwjaar 2009, 140 verblijfsobjecten: 136 woon, 1 logies,
 * 3 overig, at Titus van Rijnstraat 201-300, Andreasplein 47-88 and Hendrikje Stoffelsstraat 1-2; BAG, CC0). "Andreas
 * Ensemble" is the name of the 2006-2011 redevelopment of the former Andreas hospital site (nl.wikipedia "Andreas Ensemble":
 * urban plan Geurst & Schulze, nine residential buildings); this pand is its western perimeter block on the Cornelis
 * Lelylaan with the WestCord Fashion Hotel in its north-west tower. The report's "Andreas Bonnstraat" is not a street here.
 * Architects per building not confirmed from open sources.
 *
 * Plan frame (andreas-ensemble-footprints.json, native x east, z south, y up from the -0.65 m NAP street): u along the
 * Cornelis Lelylaan (north) front from the north-east corner (67.75, -43.52) westwards, v into the block (south). Masses
 * from the 3DBAG LoD2.2 roof parts of all three building parts (CC BY 4.0): the 16 m deep north bar in five steps (32.9,
 * 34.9, 35.8, 28.6 and 30.0 m), the hotel tower on the north-west corner (41 m), the west wing on the Titus van Rijnstraat
 * (27.6 m), two grey-brick pavilions on the south street (17.2 m, a set-back top storey), the raised garden deck between
 * them over the parking garage.
 *
 * Fronts measured on rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of andreas-ensemble-brief.md and the
 * full-height rectifications in artifacts/landmark-briefs/andreas-ensemble/tall/: w01-360 (north, 2025 at 12 m for the
 * plinth and lower storeys; 2020 and 2024 for the upper storeys and the silhouette), w02-270 (west, 2021), w04-180 /
 * w03-180 (the pavilions' south fronts, 2021), w05-180 and w07-180 (the deck and the court faces seen across it),
 * w06/w08/w09-w13 (the ends). Rectified heights disagree with the 3DBAG roofs by a steady factor (0.86 on the north
 * crops, 1.12 on the west one); the roof heights are the 3DBAG ones and every measured height on a front is scaled by
 * that front's factor, so storey counts and proportions are the photo's. Court faces over the deck are INFERRED.
 */
const O: P2 = [67.747, -43.515], U: P2 = [-0.99997, 0.00802], V: P2 = [0.00802, 0.99997];
const {fr, capUp, prism} = planFrame(O, U, V);

type Row = [number, number];
const range = (t0: number, t1: number, step: number) => { const out: number[] = []; for (let t = t0; t <= t1 + 1e-6; t += step) out.push(t); return out; };
/** Window with French-balcony rail: a frame-coloured bar across the lower 0.95 m, outside the glass. */
function french(b: BuildingTools, F: Face, t: number, y: number, w: number, h: number, o: Parameters<typeof opening>[6] = {}) {
  opening(b, F, t, y, w, h, {depth: 0.25, sill: false, ...o});
  ledgeStrip(b, F.f, t, y + 0.9, w, 0.06, 0.04, 'frame', -0.1);
  ledgeStrip(b, F.f, t, y + 0.12, w, 0.04, 0.04, 'frame', -0.1);
}
/** Pixel lettering on face frame F from t0, baseline y. */
function lettering(b: BuildingTools, F: FR, s: string, t0: number, y: number, px: number, c: Col, out = 0.05) {
  [...s].forEach((ch, i) => {
    if (ch === ' ') return;
    for (const r of glyphRuns(ch, px).runs) ledgeStrip(b, F.f, t0 + i * 6 * px + (r.t0 + r.t1) / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, 0.05, c, out);
  });
}
const textW = (s: string, px: number) => ([...s].length * 6 - 1) * px;

// ---------------------------------------------------------------- north bar (Cornelis Lelylaan)
/** North-crop scale: 3DBAG roof / rectified roof line (32.9 / 28.9, 35.8 / 31.9, 30.0 / 26.1). */
const KN = 1.15;
const PL = 6.6 * KN; // stone plinth top (two storeys of shops)
const SN = 2.95 * KN; // storey pitch above the plinth
const NB_D = 15.6; // bar depth; balconies on the court side reach 17.1
/** Steps of the bar: u range, roof, storeys above the plinth (rows counted on the 2020/2024 crops). */
const SEGS: {u0: number; u1: number; top: number; rows: number}[] = [
  {u0: 0, u1: 32.9, top: 32.9, rows: 7},
  {u0: 32.9, u1: 43.6, top: 34.9, rows: 8},
  {u0: 43.6, u1: 65.3, top: 35.8, rows: 8},
  {u0: 65.3, u1: 76.1, top: 28.6, rows: 6},
  {u0: 76.1, u1: 97.3, top: 30.0, rows: 6},
];
/** Window centres on the north front (w01-360 2025, measured): groups of five without ledges, then five with a stone ledge per floor. */
const NWIN: [number, number][] = [
  [1.9, 1.45], [4.27, 1.45], [7.43, 1.45], [9.8, 1.45], [12.17, 1.45],
  [21.1, 0.66], [23.1, 1.45], [25.5, 1.45], [28.6, 1.45], [30.9, 1.45],
  [34.7, 1.45], [37.1, 1.45], [40.2, 1.45], [42.5, 1.45], [44.8, 1.45],
  [53.7, 0.66], [55.6, 1.45], [57.9, 1.45], [60.9, 1.45], [63.3, 1.45],
  [67.0, 1.45], [69.3, 1.45], [72.4, 1.45], [74.7, 1.45], [76.6, 0.66],
  [85.3, 1.45], [87.6, 1.45], [89.9, 1.45], [92.9, 1.45], [95.2, 1.45],
];
const LEDGED: Row[] = [[15.8, 31.9], [48.6, 64.1], [80.8, 96.1]];
const segAt = (u: number) => SEGS.find(s => u >= s.u0 && u < s.u1)!;

function northBar(b: BuildingTools) {
  for (const s of SEGS) prism(b, [[s.u0, 0], [s.u1, 0], [s.u1, NB_D], [s.u0, NB_D]], 0, s.top, 'brick', 'slate', s.u0 === 0 ? [0, 2, 3] : [0, 2]);
  // street face per step; plinth face over the whole bar
  const Fs = SEGS.map(s => face(fr([s.u0, 0], [s.u1, 0]), PL, s.top, 'brick'));
  const PF = face(fr([0, 0], [97.3, 0]), 0, PL, 'stone');
  slab(b, PF.f, 97.3 / 2, PL - 0.05, 97.3, 0.3, 0.25, 'stone'); // the plinth's top band
  for (const [u, w] of NWIN) {
    const s = segAt(u), k = SEGS.indexOf(s), F = Fs[k];
    for (let r = 0; r < s.rows; r++) french(b, F, u - s.u0, PL + r * SN + 0.31, w, 2.37, {edge: r < 2 ? 0.06 : 0});
  }
  // stone ledges at every floor over the second group of each module
  for (const [a, c] of LEDGED) for (let r = 1; r <= 8; r++) {
    const y = PL + r * SN - 0.1, s = segAt((a + c) / 2);
    if (y < s.top - 1.0) slab(b, PF.f, (a + c) / 2, y, c - a, 0.12, 0.18, 'stone');
  }
  // plinth: stone piers every 5.42 m (w01 2025), two-level bays of shop glazing, glass-block bays, two brick-lined entrances
  const piers = [...range(5.45, 92.2, 5.42), 96.6];
  const edges = [0.3, ...piers.flatMap(c => [c - 0.45, c + 0.45]), 97.0];
  for (let k = 0; k + 1 < edges.length; k += 2) {
    const a = edges[k], c = edges[k + 1], m = (a + c) / 2, w = c - a;
    if (w < 1) continue;
    const entrance = (m > 38.5 && m < 43.3) || (m > 86.9 && m < 92.0), block = (m > 43.4 && m < 54.2) || (m > 75.9 && m < 86.7);
    if (entrance) { opening(b, PF, m, 0.05, w - 0.4, PL - 0.9, {depth: 1.0, cols: 2, rows: 3, frame: 'frame'}); continue; }
    const back: Col = block ? 'canopyGlass' : 'glass';
    opening(b, PF, m, 0.05, w, 3.75, {depth: 0.2, cols: block ? 5 : 2, rows: block ? 4 : 1, frame: 'frame', sill: false});
    // the second bay from the east end is closed above by a dark panel (w01 2025)
    if (m > 5.9 && m < 10.4) { slab(b, PF.f, m, 4.95, w, 2.3, 0.05, 'frame'); continue; }
    opening(b, PF, m, 4.95, w, 2.3, {depth: 0.2, cols: block ? 5 : 2, rows: block ? 3 : 1, frame: 'frame', back, sill: false});
  }
  // the hotel's ground-floor rooms: FASHION / MEETING / LOUNGE over three bays (w01 2025)
  const bayMid = (k: number) => (piers[k] + piers[k + 1]) / 2;
  [['FASHION', 9], ['MEETING', 10], ['LOUNGE', 11]].forEach(([s, k]) => {
    const px = 0.05, m = bayMid(k as number);
    lettering(b, PF, s as string, m - textW(s as string, px) / 2, 3.95, px, 'pink');
  });
  // east end (w06-90, 2019): plinth glazing and three window stacks
  const E = fr([0, NB_D], [0, 0]), EF = face(E, PL, 32.9, 'brick'), EL = face(E, 0, PL, 'stone');
  for (const v of [2.6, 7.4, 12.6]) {
    opening(b, EL, NB_D - v, 0.05, 2.6, 3.7, {depth: 0.2, frame: 'frame', sill: false});
    for (let r = 0; r < 7; r++) french(b, EF, NB_D - v, PL + r * SN + 0.31, 1.45, 2.37, {edge: 0});
  }
  slab(b, E.f, NB_D / 2, PL - 0.05, NB_D, 0.3, 0.25, 'stone');
  // court side (INFERRED from w05/w07 across the deck): windows on the street rhythm, balcony stacks where the 3DBAG shows them
  for (const s of SEGS) {
    const C = face(fr([s.u1, NB_D], [s.u0, NB_D]), 0, s.top, 'brick');
    for (const [u, w] of NWIN) if (u > s.u0 + 0.8 && u < s.u1 - 0.8) for (let r = 0; r < s.rows; r++) {
      opening(b, C, s.u1 - u, PL + r * SN + 0.31, w, 2.37, {depth: 0.2, edge: 0, sill: false});
    }
    for (let r = 0; r < 2; r++) for (const u of range(s.u0 + 2.5, s.u1 - 2.5, 5.42)) opening(b, C, s.u1 - u, 2.0 + r * 2.7, 3.2, 2.2, {depth: 0.2, edge: 0, sill: false});
  }
  const STACKS: [number, number, number][] = [[0.1, 6.3, 30.0], [10.7, 21.5, 30.0], [26.4, 36.4, 30.0], [43.2, 54.6, 32.9], [59.0, 66.3, 33.0], [66.3, 70.7, 27.0], [75.6, 87.5, 26.9]];
  for (const [a, c, top] of STACKS) {
    const B = fr([c, NB_D], [a, NB_D]);
    for (let y = PL; y < top - 2.0; y += SN) {
      slab(b, B.f, (c - a) / 2, y - 0.25, c - a, 0.25, 1.5, 'concrete');
      slab(b, B.f, (c - a) / 2, y, c - a, 1.0, 0.06, 'frame', 1.44);
    }
  }
}

// ---------------------------------------------------------------- hotel tower (WestCord Fashion Hotel)
const HU0 = 97.3, HU1 = 130.6, HV = 16.9, HW = 13.3, HN = 126.6; // the tower is 13.3 m deep on the west front (w02), 16.9 behind it
const KH = 1.1, HG = 4.0 * KH, SH = 2.9 * KH, HROWS = 10, HCROWN = HG + HROWS * SH, HTOP = 41.0;
function hotel(b: BuildingTools) {
  prism(b, [[HU0, 0], [HU1, 0], [HU1, HW], [HN, HW], [HN, HV], [HU0, HV]], 0, HTOP, 'sandstone', 'slate', [0, 1, 4]);
  const N = fr([HU0, 0], [HU1, 0]), UC = 117.6 - HU0, UH = 6.8 * KH;
  // stone ground storey and brick above, east of the corner undercroft; the brick over the undercroft in one face
  const NL = face(sub(N, 0, UC), 0, HG - 0.35, 'stone'), NF = face(sub(N, 0, UC), HG - 0.35, HTOP, 'sandstone'), NU = face(sub(N, UC, HU1 - HU0 - UC), 0, HTOP, 'sandstone');
  // the corner undercroft to the hotel entrance (w01 2025, right): a lower glazed front 4.5 m in
  NU.holes.push({t0: 0.3, t1: NU.len - 0.3, y0: 0, y1: UH, depth: 4.5, back: 'glass'});
  slab(b, N.f, UC + NU.len / 2, UH - 0.5, NU.len, 0.5, 0.1, 'stone');
  for (const u of [99.15, 103.15, 107.0, 111.0, 115.0]) opening(b, NL, u - HU0, 1.2, 2.3, 2.4, {depth: 0.25, cols: 2, frame: 'frame', sill: false});
  // stone bands on every floor, single windows with a white panel under the glass, the stack of bronze bay windows
  for (let j = 0; j <= HROWS; j++) {
    const y = HG + j * SH - 0.35;
    slab(b, N.f, UC / 2, y, UC, 0.7, 0.1, 'stone');
    if (y > UH) slab(b, N.f, UC + NU.len / 2, y, NU.len, 0.7, 0.1, 'stone');
  }
  for (let j = 0; j < HROWS; j++) {
    const y = HG + j * SH + 0.4;
    for (const u of [99.3, 103.3, 107.2, 111.1, 115.1]) {
      opening(b, NF, u - HU0, y, 1.37, 2.25, {depth: 0.25, edge: j < 2 ? 0.06 : 0, sill: false});
      slab(b, N.f, u - HU0, y, 1.33, 0.5, 0.03, 'white', -0.235);
    }
    if (y > 6.8 * KH) {
      const m = (117.9 + 121.6) / 2 - HU0; // on NU
      slab(b, N.f, m, y - 0.15, 3.7, 0.25, 0.65, 'bronze');
      slab(b, N.f, m, y + 0.1, 3.5, 1.95, 0.55, 'glass');
      slab(b, N.f, m, y + 2.05, 3.7, 0.25, 0.65, 'bronze');
    }
  }
  // the crown: a storey of close vertical fins (2024 crop)
  for (const t of range(0.6, HU1 - HU0 - 0.6, 0.9)) slab(b, N.f, t, HCROWN + 0.4, 0.18, HTOP - HCROWN - 0.9, 0.3, 'stone');
  for (const F of [NF, NU]) opening(b, F, F.len / 2, HCROWN + 0.4, F.len - 0.6, HTOP - HCROWN - 0.9, {depth: 0.6, edge: 0, back: 'dark', sill: false});
  // WestCord Fashion Hotel sign and its round mark (w01 2025, right)
  const sx = 122.0 - HU0;
  lettering(b, N, 'WestCord', sx, 19.4, 0.145, 'blue', 0.1);
  lettering(b, N, 'FASHION', sx + 0.5, 16.3, 0.1, 'pink', 0.1);
  lettering(b, N, 'HOTEL', sx + 0.1, 12.4, 0.23, 'pink', 0.1);
  for (const [w, h] of [[1.0, 2.0], [1.6, 1.6], [2.0, 1.0]] as const) slab(b, N.f, 125.3 - HU0, 23.4 - h / 2, w, h, 0.12, 'blue', 0.05);
  // west side (w02, left): the glazed two-storey lobby, windows on the hotel's floors, the sign high up
  const W = fr([HU1, 0], [HU1, HW]), WF = face(W, HG - 0.35, HTOP, 'sandstone'), WL = face(W, 0, HG - 0.35, 'stone');
  opening(b, WF, 5.95, 7.3, 11.5, 6.5, {depth: 0.2, cols: 8, rows: 2, frame: 'bronze', sill: false});
  for (const t of [2.0, 6.2]) opening(b, WL, t, 0.05, 3.2, 2.75, {depth: 0.2, cols: 2, frame: 'frame', sill: false});
  // bands on every floor; the two over the lobby glass stop at its edge
  for (let j = 0; j <= HROWS; j++) {
    const y = HG + j * SH - 0.35, lobby = y > 7.0 && y < 13.9;
    if (y < 35.0) slab(b, W.f, lobby ? (11.8 + HW) / 2 : HW / 2, y, lobby ? HW - 11.8 : HW, 0.7, 0.1, 'stone');
  }
  for (let j = 3; j <= 7; j++) for (const t of [1.0, 5.3, 10.0]) {
    const y = HG + j * SH + 0.4;
    opening(b, WF, t, y, 1.37, 2.25, {depth: 0.25, edge: 0, sill: false});
    slab(b, W.f, t, y, 1.33, 0.5, 0.03, 'white', -0.235);
  }
  slab(b, W.f, 3.2, 0.05, 4.8, 0.55, 0.06, 'blue', 0.1);
  lettering(b, W, 'FASHION HOTEL', 3.2 - textW('FASHION HOTEL', 0.05) / 2, 3.18, 0.05, 'pink', 0.17);
  // the sign stands in plain brick at the top of the west front (w02: no fins on this side)
  lettering(b, W, 'WestCord', 2.9, 38.9, 0.15, 'blue', 0.1);
  lettering(b, W, 'FASHION', 2.9, 37.7, 0.11, 'pink', 0.1);
  lettering(b, W, 'HOTEL', 2.9, 35.7, 0.25, 'pink', 0.1);
  // court side (INFERRED): the same windows over the low wing roof
  const S = fr([HU1, HV], [HU0, HV]), SF = face(S, 0, HTOP, 'sandstone');
  for (let j = 0; j < HROWS; j++) for (const t of range(1.5, 31.5, 3.95)) {
    const y = HG + j * SH + 0.4;
    if (y > 28.4 || t > 18.6) opening(b, SF, t, y, 1.37, 2.25, {depth: 0.2, edge: 0, sill: false});
  }
  prism(b, [[98.2, HV], [112.7, HV], [112.7, 20.0], [98.2, 20.0]], 0, 6.0, 'stone', 'slate', [0]);
}

// ---------------------------------------------------------------- west wing (Titus van Rijnstraat)
const WU0 = 112.7, WV0 = HV, WV1 = 67.6, WTOP = 27.6;
const KW = 27.6 / 30.9; // west-crop scale (3DBAG roof / rectified parapet)
const WB = [9.93, 12.96, 16.0, 19.03, 22.07]; // stone bands (tops) on the brick storeys, scaled
function westWing(b: BuildingTools) {
  prism(b, [[WU0, WV0], [HN, WV0], [HN, HW], [HU1, HW], [HU1, WV1], [WU0, WV1]], 0, WTOP, 'brick', 'slate', [0, 1, 2, 3, 4, 5]);
  const W = fr([HU1, HW], [HU1, WV1]), L = WV1 - HW, F = face(W, 6.54, WTOP, 'brick'), FL = face(W, 0, 6.54, 'stone');
  const v = (vv: number) => vv - HW;
  // stone plinth (two storeys), the glazed hotel storey along the north half, stone bands, French windows every 4.5 m
  slab(b, W.f, L / 2, 6.3, L, 0.3, 0.2, 'stone');
  opening(b, F, v(48.6) / 2, 6.7, v(48.6) - 0.2, 2.85, {depth: 0.25, cols: 16, frame: 'bronze', sill: false});
  for (const y of WB) slab(b, W.f, L / 2, y - 0.35, L, 0.35, 0.1, 'stone');
  const COLS = [14.8, 19.4, 23.9, 28.5, 33.1, 37.6, 42.1, 46.6, 51.0, 55.5, 59.9, 64.3];
  for (const c of COLS) {
    for (const y of [...WB.slice(0, 4), ...(c > 48.6 ? [6.54] : [])]) french(b, F, v(c), y + 0.45, 1.6, 1.95, {edge: 0});
    if (c > 15) french(b, FL, v(c), 3.55, 1.4, 2.0, {edge: 0});
  }
  // ground: shop windows, the hotel garage entrance with its sign, three garage doors (w02, 2021)
  for (const c of [14.8, 19.6, 24.0, 28.6, 33.0, 37.6]) opening(b, FL, v(c), 0.05, 3.2, 2.75, {depth: 0.2, cols: 2, frame: 'frame', sill: false});
  opening(b, FL, v(44.3), 0.05, 7.8, 2.7, {depth: 3.0, back: 'dark', edge: 0, sill: false});
  for (const c of [50.9, 55.3, 59.7]) opening(b, FL, v(c), 0.05, 3.0, 2.6, {depth: 0.12, back: 'dark', rows: 4, frame: 'frame', sill: false});
  for (const c of [63.8, 66.5]) opening(b, FL, v(c), 0.05, 1.8, 2.75, {depth: 0.2, frame: 'frame', sill: false});
  slab(b, W.f, v(44.4), 2.8, 5.6, 0.5, 0.06, 'blue', 0.08);
  lettering(b, W, 'PARKING FASHION HOTEL', v(44.4) - textW('PARKING FASHION HOTEL', 0.045) / 2, 2.92, 0.045, 'pink', 0.15);
  // the top two storeys: stone-framed loggias between pilasters every 4.4 m, railings
  for (const p of range(13.6, 66.0, 4.4)) slab(b, W.f, v(p), WB[4], 0.55, WTOP - WB[4], 0.12, 'stone');
  for (const [y0, y1] of [[22.4, 24.75], [25.05, 27.0]] as const) {
    slab(b, W.f, L / 2, y1, L, 0.3, 0.12, 'stone');
    for (const p of range(13.6, 61.6, 4.4)) {
      const m = v(p + 2.2);
      opening(b, F, m, y0, 3.7, y1 - y0, {depth: 1.2, cols: 3, frame: 'frame', sill: false});
      ledgeStrip(b, W.f, m, y0 + 1.0, 3.7, 0.06, 0.04, 'frame', -0.15);
    }
  }
  // south end (w08-180 2022, w13-180 2017): brick over the stone plinth, windows, stacked stone balconies at the court corner
  const S = fr([HU1, WV1], [WU0, WV1]), SF = face(S, 6.54, WTOP, 'brick');
  face(S, 0, 6.54, 'stone');
  for (const y of WB) slab(b, S.f, S.len / 2, y - 0.35, S.len, 0.35, 0.1, 'stone');
  for (const t of [2.4, 6.4]) for (const y of [6.54, ...WB.slice(0, 4)]) french(b, SF, t, y + 0.45, 1.4, 1.95, {edge: 0});
  for (const y of [6.54, ...WB.slice(0, 5), 25.05]) {
    slab(b, S.f, 14.6, y - 0.3, 6.4, 0.3, 1.9, 'stone');
    slab(b, S.f, 14.6, y, 6.4, 0.9, 0.08, 'stone', 1.82);
  }
  // the court face (u = 112.7; INFERRED above the deck from w05, w12-90 on the south street): stone bands and windows
  const C = fr([WU0, WV1], [WU0, WV0]), CF = face(C, 0, WTOP, 'brick');
  for (const y of WB) slab(b, C.f, C.len / 2, y - 0.35, C.len, 0.35, 0.1, 'stone');
  slab(b, C.f, (WV1 - 54.1) / 2, 0, WV1 - 54.1, 3.3, 0.08, 'stone');
  for (const c of range(19.4, 64.3, 4.5)) for (const y of [6.54, ...WB.slice(0, 4)]) if (y > 9 || c > 50.5) opening(b, CF, WV1 - c, y + 0.45, 1.6, 1.95, {depth: 0.2, edge: 0, sill: false});
  for (const y of [9.93, ...WB.slice(1, 5)]) {
    slab(b, C.f, 3.0, y - 0.3, 5.0, 0.3, 1.6, 'stone');
    slab(b, C.f, 3.0, y, 5.0, 0.9, 0.08, 'stone', 1.52);
  }
  // the glazed hall at deck level along the court face
  prism(b, [[109.5, 20.0], [WU0, 20.0], [WU0, 49.8], [109.5, 49.8]], 0, 9.4, 'glass', 'slate', [1]);
  for (const t of range(0.4, 29.4, 1.6)) slab(b, fr([109.5, 49.8], [109.5, 20.0]).f, t, 1.5, 0.12, 8.4, 0.08, 'bronze');
}

// ---------------------------------------------------------------- the two grey-brick pavilions on the south street
/** Pavilion-crop scale (3DBAG 17.2 / rectified parapet 16.2). */
const KP = 17.2 / 16.2, PG = 3.7 * KP, SP = 3.0 * KP, PTOP = 17.2, PTOP2 = 20.9;
function pavilion(b: BuildingTools, u0: number, u1: number) {
  const v0 = 48.6, v1 = 65.6;
  prism(b, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 0, PTOP, 'greyBrick', 'slate', [0, 1, 2, 3]);
  prism(b, [[u0 + 2.2, v0 + 1.3], [u1 - 2.2, v0 + 1.3], [u1 - 2.2, v1 - 2.5], [u0 + 2.2, v1 - 2.5]], PTOP, PTOP2, 'concrete', 'slate', [2]);
  const lv = (k: number) => PG + (k - 1) * SP; // floor k = 1..4 base
  // south front (w04-180 2021): five wide windows with khaki spandrel panels, stacked corner balconies on the west corner
  const S = fr([u1, v1], [u0, v1]), SF = face(S, 0, PTOP, 'greyBrick');
  for (const t of [8.4, 13.7, 19.1, 24.4, 29.8]) for (let k = 1; k <= 4; k++) {
    opening(b, SF, t, lv(k) + 0.85, 3.6, 1.8, {depth: 0.2, cols: 2, frame: 'ochre', edge: k === 1 ? 0.06 : 0, sill: false});
    slab(b, S.f, t, lv(k) + 0.2, 3.6, 0.62, 0.04, 'ochre');
  }
  for (const t of [5.0, 19.1, 24.4, 29.8]) opening(b, SF, t, 0.05, 3.2, 3.2, {depth: 0.2, cols: 2, frame: 'ochre', sill: false});
  opening(b, SF, 13.7, 0.05, 3.4, 3.4, {depth: 0.6, cols: 2, frame: 'frame', sill: false});
  balcony(b, S, 11.5, 4.4, 1.2, lv(1), {parapet: 'frame', railH: 1.0, slabT: 0.25});
  for (let k = 2; k <= 4; k++) balcony(b, S, 0, 5.0, 1.6, lv(k), {parapet: 'frame', railH: 1.0, slabT: 0.3});
  // the set-back top storey: a concrete frame round four wide windows
  const T2 = fr([u1 - 2.2, v1 - 2.5], [u0 + 2.2, v1 - 2.5]), TF = face(T2, PTOP, PTOP2, 'concrete');
  for (const t of range(3.5, T2.len - 3.5, (T2.len - 7) / 3)) opening(b, TF, t, PTOP + 0.3, 5.0, PTOP2 - PTOP - 0.9, {depth: 0.3, cols: 3, edge: 0, sill: false});
  slab(b, S.f, S.len / 2, PTOP - 0.1, S.len, 1.0, 0.1, 'frame');
  // the sides (w09-269, w10-90, w11-270): two windows a floor, balconies on the south corner
  for (const [p, q] of [[[u1, v0], [u1, v1]], [[u0, v1], [u0, v0]]] as [P2, P2][]) {
    const F = fr(p, q), FF = face(F, 0, PTOP, 'greyBrick'), west = p[0] === u1;
    for (const t of west ? [4.5, 10.0] : [4.0, 9.0]) for (let k = 0; k <= 4; k++) {
      const y = k ? lv(k) + 0.85 : 0.3;
      opening(b, FF, t, y, 2.6, k ? 1.8 : 2.6, {depth: 0.2, cols: 2, frame: 'ochre', edge: 0, sill: false});
    }
    for (let k = 2; k <= 4; k++) balcony(b, F, west ? F.len - 4.4 : 0.2, 4.2, 1.6, lv(k), {parapet: 'frame', railH: 1.0, slabT: 0.3});
  }
  // the court side over the deck (INFERRED): the south front's windows
  const N = fr([u0, v0], [u1, v0]), NF = face(N, 0, PTOP, 'greyBrick');
  for (const t of [3.3, 8.7, 14.0, 19.4, 24.7, 30.0]) for (let k = 1; k <= 4; k++) opening(b, NF, t, lv(k) + 0.85, 3.6, 1.8, {depth: 0.2, edge: 0, sill: false});
}

// ---------------------------------------------------------------- the garden deck over the parking garage
const DECK = 1.5;
function deck(b: BuildingTools) {
  capUp(b, [[0.01, NB_D], [109.5, NB_D], [109.5, 54.04], [81.72, 54.04], [81.72, 48.6], [48.6, 48.6], [48.6, 54.05], [33.1, 54.05], [33.1, 48.6], [0.01, 48.6]], DECK, 'green');
  wall(b, fr([0.01, 48.6], [0.01, NB_D]), 0, DECK, 'stone'); // against the neighbour block
  // the deck edges on the south street (w05-180 hedge and fence; w07-180 the gate and the stairs up)
  for (const [a, c] of [[33.1, 48.6], [81.72, 109.5]] as const) {
    const F = fr([c, 54.04], [a, 54.04]);
    slab(b, F.f, F.len / 2, 0, F.len, DECK, 0.02, 'stone', -0.02);
    slab(b, F.f, F.len / 2, DECK, F.len, 0.9, 0.7, 'green', -0.8);
    for (const t of range(1.0, F.len - 1.0, 3.2)) slab(b, F.f, t, DECK, 0.12, 1.1, 0.12, 'frame', -0.3);
  }
  // the terraced garden in the middle of the court (w05): three planted steps
  for (const [k, ins] of [[1, 0], [2, 3], [3, 6]] as const) {
    const ring: P2[] = [[46 + ins, 24 + ins], [86 - ins, 24 + ins], [86 - ins, 44 - ins], [46 + ins, 44 - ins]];
    prism(b, ring, DECK, DECK + 0.45 * k, 'green', 'green');
  }
}

export function buildAndreasEnsemble(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  resetFaces();
  northBar(b); hotel(b); westWing(b); pavilion(b, 48.6, 81.72); pavilion(b, 0.01, 33.1); deck(b);
  flushFaces(b);
}
