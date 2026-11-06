import type {BuildingTools} from './cultural-builders';
import {poly} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import {P, face, flushFaces, ledgeStrip, opening, planFrame, resetFaces, slab, strut, sub, wall, type Col, type Face, type FR, type P2} from './modern-front-kit';

/**
 * Quarter Plaza, Transformatorweg 38-104 (Westpoort / Sloterdijk). The catalogue called this pand "Ibis Amsterdam City
 * West", but BAG pand 0363100012063603 (bouwjaar 2003) holds 34 kantoor and one winkel verblijfsobject at Transformatorweg
 * 38-104 and its south front carries the "quarter plaza" name (2025 panoramas); the Ibis hotel (logiesfunctie,
 * Transformatorweg 36) is the neighbouring pand 0363100012068830 to the east. The model keeps the catalogue id
 * `ibis-city-west` and is named Quarter Plaza. Architect not named by BAG or nl.wikipedia; unconfirmed.
 *
 * Plan frame (ibis-city-west-footprints.json, native x east, z south, y up from the 0.524 m NAP street): u along the
 * south ring edge from its west corner (-64.193, 34.271) eastwards, v into the block (north). Volumes from the 3DBAG
 * roof parts (CC BY 4.0): a dark brown brick office slab at the north (31.8 m) on a cantilever at its west end over a tall
 * glazed lobby; a white-panelled office bar along the south-east (24.5 m) on round pilotis; a dark glass bridge between
 * them (21 m); a raised garden deck with stepped edges to the south-west and a parking deck to the north-east.
 *
 * Fronts measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of ibis-city-west-brief.md:
 * w04-179 / w07-179 (brick slab south front over the deck, 2025-07-01 / 2024-09-09), w02-179 (the white bar, 2024-09-09),
 * w03-269 / w06-269 (the deck's west steps, the cantilever's columns and lobby, 2025-07-01), w05-89 (the east end,
 * 2019-11-06). The north faces (w01, w08, w09) are INFERRED: same ribbons as the south.
 */
const O: P2 = [-64.193, 34.271], U: P2 = [0.99983, -0.0185], V: P2 = [-0.0185, -0.99983];
const {A, fr, capUp, capDown, prism} = planFrame(O, U, V);

const DECK = 1.9, STEP_H = DECK / 6, STEP_D = 0.45, INSET = 6 * STEP_D;
const GDECK = 1.4;
// brick slab
const TOPB = 31.8, SOFFIT = 11.28, CANT_U = 24.16;
const SV0 = 37.24, SV1 = 46.45, SU1 = 86.7, NV = 59.7;
const vS = (u: number) => SV0 + (SV1 - SV0) * u / SU1;
const S_LEN = Math.hypot(SU1, SV1 - SV0), S_K = S_LEN / SU1; // face metres per plan u along the slanted south front
const BRIDGE_T = 71.95 * S_K, CANT_T = CANT_U * S_K;
// ribbon rows (bottom, top), measured on w04-179 and scaled to the 3DBAG parapet (x 1.016)
const R: Record<string, [number, number]> = {R1: [27.74, 29.26], R2: [23.98, 25.5], R3: [20.42, 21.95], R4: [16.76, 18.29], R5: [13.11, 14.63], R6: [9.45, 10.97], R7: [5.79, 7.32]};
// white bar
const BAR = 24.5, COL_TOP = 5.18, BAR_ROWS: [number, number][] = [[6.94, 8.56], [10.33, 11.95], [13.71, 15.33], [17.1, 18.72], [20.6, 22.22]];
const WIN_W = 1.1, WIN_PITCH = 2.096;
const BU0 = 68.65, BU1 = 163.16;

const ribbon = (b: BuildingTools, F: Face, t0: number, t1: number, row: [number, number], depth = 0.12) =>
  opening(b, F, (t0 + t1) / 2, row[0], t1 - t0, row[1] - row[0], {depth, cols: Math.max(1, Math.round((t1 - t0) / 1.35)), sill: false});

/** Pixel lettering on face frame f, starting at t0, baseline y, `colour(i)` per character index. */
function lettering(b: BuildingTools, F: FR, s: string, t0: number, y: number, px: number, colour: (i: number) => Col) {
  [...s].forEach((ch, i) => {
    if (ch === ' ') return;
    for (const r of glyphRuns(ch, px).runs) ledgeStrip(b, F.f, t0 + i * 6 * px + (r.t0 + r.t1) / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, 0.06, colour(i), 0.05);
  });
}

/** Glass box cantilevered from face F: t0..t1, y0..y1, `proj` out, a frame grid of `cols` x `rows`, a soffit band. */
function glassBox(b: BuildingTools, F: FR, t0: number, t1: number, y0: number, y1: number, proj: number, cols: number, rows: number, grid: Col, soffit: Col) {
  const w = t1 - t0, tm = (t0 + t1) / 2;
  slab(b, F.f, tm, y0, w, y1 - y0, proj, 'glass');
  slab(b, F.f, tm, y0 - 0.5, w + 0.06, 0.5, proj + 0.06, soffit);
  slab(b, F.f, tm, y1, w + 0.06, 0.25, proj + 0.06, grid);
  for (let k = 0; k <= cols; k++) ledgeStrip(b, F.f, t0 + 0.05 + (w - 0.1) * k / cols, y0, 0.1, y1 - y0, 0.05, grid, proj);
  for (let k = 1; k < rows; k++) ledgeStrip(b, F.f, tm, y0 + (y1 - y0) * k / rows - 0.06, w, 0.12, 0.05, grid, proj);
}

function brickSlab(b: BuildingTools) {
  // south front over the deck: the cantilevered upper part, the lower part east of the lobby, the part above the bridge
  const S = fr([0, SV0], [SU1, SV1]);
  const up = face(sub(S, 0, BRIDGE_T), SOFFIT, TOPB, 'brick');
  const low = face(sub(S, CANT_T, BRIDGE_T - CANT_T), DECK, SOFFIT, 'brick');
  const east = face(sub(S, BRIDGE_T, S_LEN - BRIDGE_T), 21.0, TOPB, 'brick');
  const segs: Record<string, [number, number][]> = {
    R1: [[0.2, 13.4], [14.9, 48.1], [49.5, 72.0]], R2: [[1.3, 30.8], [32.2, 53.9], [55.4, 68.2]],
    R3: [[0.1, 42.2], [43.7, 68.2]], R4: [[0.1, 30.8], [32.2, 42.2], [43.7, 68.2]], R5: [[1.3, 36.6], [37.9, 68.2]],
    R6: [[24.6, 36.6], [37.9, 68.2]], R7: [[24.6, 42.2], [43.7, 68.2]],
  };
  for (const [k, ss] of Object.entries(segs)) for (const [a, c] of ss) {
    const F = R[k][0] >= SOFFIT ? up : low;
    ribbon(b, F, a - (F === low ? CANT_T : 0), c - (F === low ? CANT_T : 0), R[k]);
  }
  // ground floor glazing behind black posts, deck level to 4.06 m
  opening(b, low, (24.7 + 71.8) / 2 - CANT_T, DECK + 0.05, 71.8 - 24.7, 4.06 - DECK - 0.05, {depth: 0.6, cols: 31, bars: [1.6], sill: false});
  // above the bridge: the two top ribbons run on (INFERRED behind the bridge's glass in w04)
  for (const k of ['R1', 'R2']) ribbon(b, east, 1.0, S_LEN - BRIDGE_T - 1.0, R[k]);
  // the names on the parapet: "tot maandag" (white and green) over the west end, the "quarter plaza" mark to the east
  const L = sub(S, 0, S_LEN);
  lettering(b, L, 'tot maandag', 1.2, 30.2, 0.13, i => (i < 4 ? 'pink' : 'green'));
  lettering(b, L, 'quarter plaza', 51.4, 30.2, 0.14, () => 'pink');
  const hex: [number, number][] = Array.from({length: 6}, (_, k) => [0.62 * Math.cos(Math.PI / 6 + k * Math.PI / 3), 0.62 * Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
  poly(b, L.f, 50.4, 30.66, hex, 0.06, 'pink', 0.05);

  // west end above the cantilever (INFERRED ribbons beyond the corner seen in w06)
  const W = face(fr([0, NV], [0, SV0]), SOFFIT, TOPB, 'brick');
  for (const k of ['R1', 'R2', 'R3', 'R4', 'R5']) ribbon(b, W, 0.9, NV - SV0 - 0.9, R[k]);
  // east end over the parking deck: seven strips of uneven length (w05-89)
  const E = face(fr([SU1, SV1], [SU1, NV]), GDECK, TOPB, 'brick');
  const eSegs: [string, number, number][] = [['R1', 0.3, 10.1], ['R2', 1.7, 13.0], ['R3', 3.3, 13.0], ['R4', 0.3, 13.0], ['R5', 1.7, 13.0], ['R6', 1.7, 11.7], ['R7', 3.3, 13.0]];
  for (const [k, a, c] of eSegs) ribbon(b, E, a, c, R[k]);
  opening(b, E, 6.6, GDECK + 0.3, 12.4, 2.4, {depth: 0.3, cols: 8, sill: false});
  // north front (INFERRED): ribbons in two runs on every row, a ground strip; the lobby corner stays open to u 3
  const N = fr([SU1, NV], [0, NV]);
  const nUp = face(sub(N, 0, SU1), SOFFIT, TOPB, 'brick'), nLow = face(sub(N, 0, SU1 - 3), 0, SOFFIT, 'brick');
  for (const k of Object.keys(R)) {
    const F = R[k][0] >= SOFFIT ? nUp : nLow;
    for (const [a, c] of [[1.3, 42.2], [43.7, F === nUp ? 85.4 : 82.4]]) ribbon(b, F, a, c, R[k]);
  }
  for (const [a, c] of [[1.3, 42.2], [43.7, 82.4]]) opening(b, nLow, (a + c) / 2, 1.0, c - a, 2.8, {depth: 0.3, cols: Math.round((c - a) / 1.5), sill: false});
  // the lobby: tall gridded glass set back 3 m under the cantilever (w06, w07), a brick return at its east end
  const lobbyW = fr([3, NV], [3, vS(3) + 3]), lobbyS = fr([3, vS(3) + 3], [CANT_U, vS(CANT_U) + 3]);
  for (const F of [lobbyW, lobbyS]) {
    wall(b, F, DECK, SOFFIT, 'glass');
    const n = Math.round(F.len / 1.5);
    for (let k = 0; k <= n; k++) ledgeStrip(b, F.f, 0.05 + (F.len - 0.1) * k / n, DECK, 0.1, SOFFIT - DECK, 0.06, 'frame', 0);
    for (let k = 1; k < 8; k++) ledgeStrip(b, F.f, F.len / 2, DECK + (SOFFIT - DECK) * k / 8 - 0.04, F.len, 0.08, 0.06, 'frame', 0);
  }
  wall(b, fr([CANT_U, vS(CANT_U) + 3], [CANT_U, vS(CANT_U)]), DECK, SOFFIT, 'brick');
  // white soffit, the raked V-columns at the south and west edges (w07, w06)
  capDown(b, [[0, SV0], [CANT_U, vS(CANT_U)], [CANT_U, NV], [0, NV]], SOFFIT, 'stone');
  const at = (u: number, v: number, y: number): [number, number, number] => { const p = A(u, v); return [p[0], y, p[1]]; };
  const V2 = (u: number, v: number, du: number, dv: number) => {
    for (const s of [-1, 1]) strut(b, at(u, v, DECK), at(u + s * du, v + s * dv, SOFFIT), 0.2, 'bronze');
  };
  V2(5.3, vS(5.3) + 0.7, 2.8, 0.3);
  V2(14.6, vS(14.6) + 0.7, 2.8, 0.3);
  V2(0.8, 45.0, 0, 3.0);
  V2(0.8, 53.5, 0, 3.0);
  // roof, plant room and the stair/lift heads (3DBAG parts)
  capUp(b, [[0, SV0], [SU1, SV1], [SU1, NV], [0, NV]], TOPB, 'slate');
  prism(b, [[23.96, 49.09], [39.9, 49.09], [39.9, 56.95], [23.96, 56.95]], TOPB, 36.3, 'concrete', 'slate');
  prism(b, [[41.2, 52.3], [43.6, 52.3], [43.6, NV - 0.3], [41.2, NV - 0.3]], TOPB, 32.7, 'concrete', 'slate');
  prism(b, [[41.8, 48.7], [46.5, 48.7], [46.5, 51.2], [41.8, 51.2]], TOPB, 34.0, 'concrete', 'slate');
}

function whiteBar(b: BuildingTools) {
  const S = fr([BU0, 0], [BU1, 0]);
  const F = face(S, 0, BAR, 'stone');
  // the ground floor: glazing 2 m back behind eleven round pilotis at 8.3 m (w02-179)
  F.holes.push({t0: 0.15, t1: S.len - 0.15, y0: 0, y1: COL_TOP, depth: 2.0, back: 'glass'});
  const back = sub(S, 0, S.len, -2.0);
  slab(b, back.f, S.len / 2, 0, S.len - 0.3, 0.6, 0.2, 'brick');
  for (const y of [1.2, 2.2]) ledgeStrip(b, back.f, S.len / 2, y, S.len - 0.3, 0.08, 0.05, 'pink', 0);
  for (let t = 1.0; t < S.len - 0.5; t += 1.55) ledgeStrip(b, back.f, t, 0.6, 0.07, COL_TOP - 0.6, 0.05, 'frame', 0);
  for (let k = 0; k < 11; k++) {
    const t = 74.9 - BU0 + 8.26 * k, c = P(S.f, [t, 0, -0.55]) as [number, number, number], d = P(S.f, [t, COL_TOP, -0.55]) as [number, number, number];
    strut(b, c, d, 0.47, 'bronze', 10);
  }
  // punched windows, 45 per row at 2.096 m; the two glass boxes take their place
  const boxA: [number, number] = [80.0 - BU0, 91.0 - BU0], boxB: [number, number] = [125.7 - BU0, 158.0 - BU0];
  for (let k = 0; k < 45; k++) {
    const t = 69.4 - BU0 + k * WIN_PITCH;
    BAR_ROWS.forEach((row, j) => {
      if (j >= 1 && t > boxA[0] - 0.6 && t < boxA[1] + 0.6) return;
      if (j >= 2 && t > boxB[0] - 0.6 && t < boxB[1] + 0.6) return;
      opening(b, F, t, row[0], WIN_W, row[1] - row[0], {depth: 0.15, sill: false});
    });
  }
  glassBox(b, S, boxA[0], boxA[1], 9.73, 25.1, 0.9, 7, 5, 'bronze', 'bronze');
  glassBox(b, S, boxB[0], boxB[1], 13.19, 22.4, 1.2, 22, 3, 'frame', 'bronze');
  // east end (w05): punched windows, the glazed ground floor
  const E = face(fr([BU1, 0], [163.1, 16.43]), 0, BAR, 'stone');
  E.holes.push({t0: 0.15, t1: E.len - 0.15, y0: 0, y1: COL_TOP, depth: 1.0, back: 'glass'});
  for (let k = 0; k < 8; k++) BAR_ROWS.forEach(row => opening(b, E, 1.1 + 2.1 * k, row[0], WIN_W, row[1] - row[0], {depth: 0.15, sill: false}));
  // west end over the deck (w03: the grey end with a big name sign, the sign itself not drawn)
  const W = face(fr([68.73, 13.44], [BU0, 0]), DECK, BAR, 'stone');
  for (let k = 0; k < 6; k++) BAR_ROWS.forEach(row => opening(b, W, 1.2 + 2.1 * k, row[0], WIN_W, row[1] - row[0], {depth: 0.15, sill: false}));
  opening(b, W, 6.7, DECK + 0.3, 11.4, COL_TOP - DECK - 0.5, {depth: 0.3, cols: 7, sill: false});
  // north face over the parking deck (INFERRED), above the bridge, beside it
  const N = face(fr([163.1, 16.43], [88.2, 14.06]), GDECK, BAR, 'stone');
  for (let k = 0; k < 35; k++) BAR_ROWS.forEach(row => opening(b, N, 1.2 + 2.1 * k, row[0], WIN_W, row[1] - row[0], {depth: 0.15, sill: false}));
  wall(b, fr([88.2, 14.06], [86.78, 14.02]), GDECK, BAR, 'stone');
  wall(b, fr([86.78, 14.02], [71.75, 13.54]), 21.0, BAR, 'stone');
  wall(b, fr([71.75, 13.54], [68.73, 13.44]), DECK, BAR, 'stone');
  capUp(b, [[BU0, 0], [BU1, 0], [163.1, 16.43], [88.2, 14.06], [86.78, 14.02], [71.75, 13.54], [68.73, 13.44]], BAR, 'slate');
  // the set-back top storey over the east end of the glass box (3DBAG parts to 28.9 m)
  prism(b, [[85.0, 3.9], [101.2, 3.9], [101.2, 11.5], [85.0, 11.5]], BAR, 28.9, 'stone', 'slate');
}

function bridge(b: BuildingTools) {
  // dark glass curtain walls on the two open faces (w03 west, w05 east), five storeys of glazing
  for (const [F, y0] of [[fr([71.95, 44.89], [71.75, 13.54]), DECK], [fr([86.78, 14.02], [86.69, 46.45]), GDECK]] as [FR, number][]) {
    const G = face(F, y0, 21.0, 'bronze');
    for (const yb of [2.6, 6.2, 9.8, 13.4, 17.0]) {
      if (yb < y0 + 0.2) continue;
      opening(b, G, F.len / 2, yb, F.len - 1.0, 2.7, {depth: 0.1, cols: Math.round((F.len - 1) / 1.5), sill: false, frame: 'bronze'});
    }
  }
  capUp(b, [[71.75, 13.54], [86.78, 14.02], [86.69, 46.45], [71.95, 44.89]], 21.0, 'slate');
}

function decks(b: BuildingTools) {
  // the garden deck, its stepped south and west edges (six 0.32 m steps, w04 / w07 / w03)
  for (let k = 0; k < 6; k++) {
    const a = k * STEP_D, a2 = a + STEP_D, y0 = k * STEP_H, y1 = y0 + STEP_H;
    wall(b, fr([a, a], [BU0, a]), y0, y1, 'concrete');
    wall(b, fr([a, NV], [a, a]), y0, y1, 'concrete');
    capUp(b, [[a, a], [BU0, a], [BU0, a2], [a, a2]], y1, 'concrete');
    capUp(b, [[a, a2], [a2, a2], [a2, NV], [a, NV]], y1, 'concrete');
    wall(b, fr([a2, NV], [a, NV]), 0, y1, 'concrete');
  }
  capUp(b, [[INSET, INSET], [BU0, INSET], [68.73, 13.44], [71.75, 13.54], [71.95, 44.89], [CANT_U, vS(CANT_U)], [INSET, vS(INSET)]], DECK, 'ochre');
  capUp(b, [[INSET, vS(INSET)], [CANT_U, vS(CANT_U)], [CANT_U, vS(CANT_U) + 3], [3, vS(3) + 3], [3, NV], [INSET, NV]], DECK, 'concrete');
  // the parking deck to the north-east: a concrete edge with the garage slot and a rail (w05)
  const ring: P2[] = [[86.78, 14.02], [88.2, 14.06], [163.1, 16.43], [162.93, NV - 0.15], [SU1, NV], [SU1, SV1]];
  for (const F of [fr([163.1, 16.43], [162.93, NV - 0.15]), fr([162.93, NV - 0.15], [SU1, NV])]) {
    const G = face(F, 0, GDECK, 'concrete');
    G.holes.push({t0: 1.0, t1: F.len - 1.0, y0: 0.3, y1: 1.1, depth: 1.5, back: 'bronze'});
    ledgeStrip(b, F.f, F.len / 2, GDECK + 0.95, F.len, 0.06, 0.05, 'frame', 0.0);
    for (let t = 0.5; t < F.len; t += 2.5) slab(b, F.f, t, GDECK, 0.05, 1.0, 0.05, 'frame', 0.0);
  }
  capUp(b, ring, GDECK, 'ochre');
}

export function buildQuarterPlaza(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  resetFaces();
  brickSlab(b); whiteBar(b); bridge(b); decks(b);
  flushFaces(b);
}
