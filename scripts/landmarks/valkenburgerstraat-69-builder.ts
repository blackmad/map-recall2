import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, roofHeightAt, slab, type Frame} from './nearbar-kit';
import {balcony, band, face, flushFaces, opening, resetFaces, strut, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './valkenburgerstraat-69-footprints.json';

/**
 * VALKENBURGERSTRAAT 69-165 (+ Rapenburgerstraat, Koerierstersplein; BAG pand 0363100012185504, 1998): a courtyard block of
 * housing over shops built as a row of fronts in different hands (experiment lane kit-vs-hand-valkenburger-20261120, the
 * hand route against the large-recipe kit route on the same pand). Massing: the 3DBAG LoD2.2 shell
 * (valkenburgerstraat-69-footprints.json, bag-shell-prepare.ts); every vertical rectangular wall is rebuilt as a holed face
 * (modern-front-kit.ts), the rest of the shell drawn as it is. Fronts are measured off the rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0) listed per wall in valkenburgerstraat-69-inventory.json; each front below is the crop's wall line in
 * native metres (x east, z south from the BAG ring's vertex average), `s` metres along it from the viewer's left, heights
 * over the 3DBAG ground read from the crop's street line:
 *  - Valkenburgerstraat (w02-329, 2021 crop at 45.5 px/m): dark grey brick with two storeys of windows over grey glass-block
 *    panels and three ribbon storeys, a white glazed bay stack, a red brick strip, two mauve-grey brick fronts with wide,
 *    narrow and stair windows, shopfronts along the ground;
 *  - its west end (w04-328 2021, 50 px/m): red-brown brick, a stack of mesh balconies, wide white windows with a dark loggia
 *    slot between pale string courses, the open concrete balcony stack on a column at the corner, shopfronts under a grey fascia;
 *  - Koerierstersplein (w03-57 2018): a white rendered upper block with tall windows, letterbox slots and a two-level loggia
 *    over a two-storey brown brick base of maisonette doors (red, green, navy) and French windows;
 *  - Rapenburgerstraat (w05/w06/w07/w08-149): red-brown brick fronts with a white and a maroon rendered panel each holding
 *    two tall grid windows, the white rendered balcony corner, a cornice slab at the eaves.
 * The SW front (w01-237) has no panorama within 35 m; it and the courtyard faces get the brick window grid (inferred).
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// palette names; materialOverrides in the spec give the measured colours
const BRICK: Col = 'brick', MAROON: Col = 'red', GREY: Col = 'greyBrick', MAUVE: Col = 'sandstone', RENDER: Col = 'stone';
const BROWN: Col = 'ochre', LEDGE: Col = 'concrete', DARK: Col = 'dark', BLOCKS: Col = 'copper', METAL: Col = 'bronze', NEFRAME: Col = 'blue';

type P2 = [number, number];
type Win = {s: number; w: number; y: [number, number]; o?: OpenOpts};
type Seg = {s: [number, number]; bands: [number, Col][]; wins: Win[]};
/** A string course along the front: centre s, width w, bottom y, height h, depth d. Drawn per rebuilt wall piece in that
 *  piece's own plane (frontWall), not on the front's averaged plane: the crop line and the 3DBAG strips differ by ~0.6 deg, so a
 *  strip on the averaged plane sank into one piece and z-fought with it along the rest (2026-11-21 audit). */
type Ledge = {s: number; w: number; y: number; h: number; d: number; c: Col};
type Front = {tag: string; a: P2; b: P2; n: P2; segs: Seg[]; ledges?: Ledge[]; extra?: (b: BuildingTools, F: FR) => void};

const rows = (s: number, w: number, ys: [number, number][], o?: OpenOpts): Win[] => ys.map(y => ({s, w, y, o}));
const shop = (s: number, w: number, y: [number, number] = [0.15, 2.95]): Win => ({s, w, y, o: {depth: 0.3, cols: Math.max(1, Math.round(w / 1.6)), frame: DARK, edge: 0.08}});
const door = (s: number, w: number, back: Col, h = 2.4): Win => ({s, w, y: [0.05, h], o: {depth: 0.25, back, frame: 'frame'}});

// ---- Valkenburgerstraat (w02-329L 2021-03-08) ----------------------------------------------------------------------
const NW_ROWS: [number, number][] = [[4.5, 5.9], [7.2, 8.6], [9.9, 11.25], [12.6, 14.0], [15.35, 16.6]];
const NW: Front = {
  tag: 'w02-329', a: [14.70, -37.99], b: [-19.68, -17.06], n: [-0.5201, -0.8541],
  segs: [
    {s: [0, 11.3], bands: [[99, GREY]], wins: [
      shop(0.85, 1.5), door(4.75, 1.1, DARK, 2.6), shop(8.2, 4.0),
      ...[1.15, 3.2, 5.25, 7.3, 9.3].flatMap(s => rows(s, 1.95, [[4.5, 5.94], [7.26, 8.69]], {depth: 0.16})),
      ...rows(5.2, 10.1, [[10.0, 11.3], [12.76, 13.97], [15.4, 16.7]], {depth: 0.16, cols: 5}),
    ]},
    {s: [11.3, 15.0], bands: [[99, GREY]], wins: []},
    {s: [15.0, 17.6], bands: [[99, MAROON]], wins: [...rows(16.5, 1.6, NW_ROWS)]},
    {s: [17.6, 30.0], bands: [[99, MAUVE]], wins: [
      door(19.4, 1.0, DARK, 2.5), ...rows(19.4, 1.0, NW_ROWS),
      shop(24.05, 5.7), {s: 24.05, w: 5.7, y: [3.6, 5.3], o: {cols: 4}}, ...rows(24.35, 3.6, [[7.2, 8.6], [9.9, 11.25], [12.6, 14.0]], {cols: 3}),
      {s: 24.05, w: 5.7, y: [15.4, 16.5], o: {cols: 4}},
      door(28.75, 1.1, DARK, 2.6), {s: 28.75, w: 1.15, y: [3.6, 17.0], o: {bars: [2.75, 5.5, 8.25, 11.0]}},
    ]},
    {s: [30.0, 40.3], bands: [[99, MAUVE]], wins: [
      shop(33.45, 4.7), door(37.2, 1.4, DARK, 2.7), {s: 34.25, w: 6.5, y: [3.9, 5.7], o: {cols: 5}},
      ...rows(33.75, 3.5, [[7.2, 8.6], [9.9, 11.25], [12.6, 14.0]], {cols: 3}), {s: 33.8, w: 6.2, y: [15.4, 16.6], o: {cols: 4}},
      ...rows(37.35, 0.6, NW_ROWS),
    ]},
  ],
  extra: (b, F) => {
    // grey glass-block panels under the dark front's lower windows
    for (const [y0, y1] of [[3.52, 4.5], [6.27, 7.26]]) slab(b, F.f, 5.2, y0, 10.1, y1 - y0, 0.06, BLOCKS);
    // the white glazed bay stack: a box 0.7 m proud with a glass pane per storey and a rail on top
    band(b, F, 11.35, 14.95, 3.55, 14.55, 0.7, 'frame');
    for (const [y0, y1] of [[3.7, 5.8], [6.4, 8.7], [9.0, 11.5], [11.8, 14.2]]) {
      slab(b, F.f, 13.15, y0, 3.3, y1 - y0, 0.03, 'glass', 0.7);
      ledgeStrip(b, F.f, 13.15, y0 + (y1 - y0) * 0.55, 3.3, 0.06, 0.05, 'frame', 0.73);
    }
    for (let k = 0; k <= 3; k++) ledgeStrip(b, F.f, 11.6 + k * 1.1, 14.6, 0.05, 1.0, 0.05, METAL, 0.65);
    ledgeStrip(b, F.f, 13.15, 15.55, 3.6, 0.06, 0.06, METAL, 0.65);
    // a thin sign fascia over the shops
    band(b, F, 0.2, 39.9, 2.98, 3.35, 0.12, DARK);
  },
};

// ---- the west end of the Valkenburgerstraat front (w04-328 2021-03-18) --------------------------------------------
const W_ROWS: [number, number][] = [[4.5, 5.8], [7.2, 8.5], [9.9, 11.2], [12.6, 13.9], [15.3, 16.6]];
const NW2: Front = {
  tag: 'w04-328', a: [-22.76, -15.17], b: [-41.45, -3.54], n: [-0.5287, -0.8488],
  segs: [
    {s: [0, 8.7], bands: [[99, BRICK]], wins: [
      shop(5.5, 5.4), ...rows(0.8, 1.5, W_ROWS), ...rows(7.4, 1.6, W_ROWS),
      ...[3.7, 6.4, 9.1, 11.8, 14.5].map(f => ({s: 3.95, w: 2.2, y: [f + 0.05, f + 2.25] as [number, number], o: {cols: 2}})),
    ]},
    {s: [8.7, 17.4], bands: [[99, BRICK]], wins: [
      shop(11.6, 4.8), shop(16.9, 5.0),
      ...rows(12.5, 3.8, [[4.5, 6.0], [7.2, 8.7], [10.0, 11.5], [12.7, 14.2], [15.4, 16.9]], {cols: 2}),
      ...rows(15.0, 1.2, [[4.5, 6.0], [7.2, 8.7], [10.0, 11.5], [12.7, 14.2], [15.4, 16.9]], {depth: 0.9, back: DARK, edge: 0}),
    ]},
    {s: [17.4, 22.1], bands: [[99, LEDGE]], wins: [
      ...[3.5, 6.2, 8.9, 11.6, 14.3].map(f => ({s: 19.6, w: 3.6, y: [f + 0.1, f + 2.4] as [number, number], o: {depth: 0.3, cols: 3}})),
    ]},
  ],
  ledges: [6.1, 8.9, 11.6, 14.3].map(y => ({s: 13.05, w: 8.6, y, h: 0.08, d: 0.05, c: LEDGE})),
  extra: (b, F) => {
    for (const y of [3.7, 6.4, 9.1, 11.8, 14.5]) balcony(b, F, 2.2, 3.5, 1.0, y, {rail: METAL, slab: LEDGE, sides: true});
    slab(b, F.f, 3.95, 17.1, 3.8, 0.25, 1.3, LEDGE);
    for (const y of [3.5, 6.2, 8.9, 11.6, 14.3, 17.0]) balcony(b, F, 17.4, 4.6, 1.3, y, {rail: METAL, slab: LEDGE, sides: true});
    strut(b, at(F, 21.0, 1.15, 0), at(F, 21.0, 1.15, 17.0), 0.18, LEDGE, 8);
    band(b, F, 0.2, 19.6, 2.95, 3.35, 0.12, LEDGE);
  },
};

// ---- Koerierstersplein (w03-57 2018-05-08) -------------------------------------------------------------------------
const NE_ROWS: [number, number][] = [[6.36, 7.86], [9.16, 10.66], [11.96, 13.46]];
const slotRows = (s: number, hi: boolean): Win[] => (hi ? [[7.52, 7.86], [10.32, 10.66], [13.12, 13.46]] : [[6.66, 7.06], [9.46, 9.86], [12.26, 12.66]])
  .map(y => ({s, w: 1.3, y: y as [number, number], o: {frame: NEFRAME, depth: 0.12}}));
const NE: Front = {
  tag: 'w03-57', a: [35.38, -4.61], b: [20.99, -26.95], n: [0.8407, -0.5415],
  segs: [{s: [0, 26.6], bands: [[5.16, BROWN], [99, RENDER]], wins: [
    ...[1.2, 9.1, 17.8, 25.6].flatMap(s => rows(s, 1.4, NE_ROWS, {frame: NEFRAME})),
    ...slotRows(3.75, true), ...slotRows(6.65, false), ...slotRows(20.25, false), ...slotRows(23.05, true),
    {s: 13.4, w: 5.2, y: [9.3, 13.6], o: {depth: 1.5, back: BROWN, edge: 0}}, {s: 13.4, w: 5.2, y: [6.4, 8.2], o: {depth: 1.5, back: BROWN, edge: 0}},
    door(4.0, 2.0, MAROON), door(6.1, 2.0, DARK), door(11.8, 2.0, NEFRAME), door(20.4, 2.0, MAROON),
    ...[[1.3, 1.8], [8.95, 1.5], [14.6, 1.6], [17.35, 1.9]].map(([s, w]) => ({s, w, y: [0.5, 2.4] as [number, number], o: {cols: 2}})),
    ...[[1.3, 1.8], [8.75, 1.9], [14.5, 1.8], [17.75, 1.9]].map(([s, w]) => ({s, w, y: [2.9, 5.0] as [number, number], o: {cols: 2, bars: [1.1]}})),
    ...[3.8, 6.2, 12.0, 20.2].map(s => ({s, w: 0.4, y: [4.0, 4.8] as [number, number]})),
    {s: 24.2, w: 4.2, y: [0.05, 2.6], o: {depth: 1.2, back: DARK, edge: 0}}, {s: 24.2, w: 4.2, y: [2.9, 5.0], o: {cols: 3}},
  ]}],
  extra: (b, F) => {
    band(b, F, 0.1, 26.5, 2.56, 2.7, 0.06, LEDGE);
    for (const [s, w] of [[1.3, 1.8], [8.75, 1.9], [14.5, 1.8], [17.75, 1.9], [24.2, 4.2]]) ledgeStrip(b, F.f, s, 3.85, w, 0.05, 0.05, METAL, 0.05);
    for (const y of [6.4, 9.3]) ledgeStrip(b, F.f, 13.4, y + 1.0, 5.2, 0.05, 0.05, METAL, -0.15);
  },
};

// ---- Rapenburgerstraat (w05-w08, bearing 149) ----------------------------------------------------------------------
const SE_ROWS: [number, number][] = [[3.7, 5.2], [6.3, 7.7], [8.8, 10.2], [11.4, 12.8]];
const tallGrid = (s: number, w: number, y: [number, number]): Win => ({s, w, y, o: {cols: 2, rows: 5, depth: 0.12}});
const SE: Front[] = [
  {tag: 'w08-153', a: [-12.30, 39.51], b: [-2.22, 34.41], n: [0.4512, 0.8924], segs: [{s: [0, 11.3], bands: [[2.7, BRICK], [12.4, RENDER], [99, BRICK]], wins: [
    ...rows(0.75, 1.5, [[3.2, 4.4], [6.4, 7.4], [9.4, 10.4]]), ...rows(9.5, 1.0, [[4.1, 5.1], [6.8, 7.8], [9.5, 10.5]]),
    ...rows(5.7, 4.4, [[3.2, 5.5], [6.15, 8.6], [9.35, 11.4]], {cols: 3, depth: 0.6}),
    {s: 3.2, w: 4.0, y: [0.3, 2.6], o: {cols: 3}}, {s: 6.65, w: 0.9, y: [1.3, 2.2]}, door(9.6, 2.6, DARK),
    ...rows(5.6, 1.6, [[12.9, 14.2]]), ...rows(7.9, 1.6, [[12.9, 14.2]]),
  ]}], extra: (b, F) => { for (const y of [6.1, 9.3]) balcony(b, F, 2.9, 5.6, 1.4, y, {rail: METAL, slab: LEDGE, sides: true, rLeft: 0.5, rRight: 0.5}); }},
  {tag: 'w05-149', a: [-2.48, 34.01], b: [11.93, 25.30], n: [0.5172, 0.8559], segs: [
    {s: [0, 2.4], bands: [[99, BRICK]], wins: [...rows(1.45, 1.9, [[0.9, 2.6], [4.0, 5.4], [6.6, 8.0], [9.2, 10.6], [11.8, 13.0]])]},
    {s: [2.4, 13.4], bands: [[2.95, BRICK], [12.2, RENDER], [99, BRICK]], wins: [
      tallGrid(6.05, 3.5, [4.1, 11.1]), tallGrid(10.1, 3.4, [4.1, 11.1]), ...[4.3, 6.9, 9.35, 11.8].flatMap(s => rows(s, 1.9, [[12.4, 13.4]])),
      {s: 6.25, w: 3.3, y: [0.6, 2.8], o: {cols: 3}}, {s: 10.0, w: 3.2, y: [0.6, 2.8], o: {cols: 3}},
    ]},
    {s: [13.4, 16.8], bands: [[99, BRICK]], wins: [...rows(14.55, 1.7, [[3.9, 5.2], [6.4, 7.7], [8.9, 10.2], [11.4, 12.7]]), door(14.85, 2.5, DARK, 2.3)]},
  ]},
  {tag: 'w07-149', a: [11.60, 24.84], b: [23.69, 17.62], n: [0.5127, 0.8586], segs: [
    {s: [0, 11.1], bands: [[99, MAROON]], wins: [
      tallGrid(3.15, 3.7, [4.2, 11.6]), tallGrid(7.65, 3.7, [4.2, 11.6]), ...[1.35, 3.95, 6.95, 9.5].flatMap(s => rows(s, 1.9, [[12.9, 13.9]])),
      {s: 3.35, w: 3.3, y: [0.6, 2.9], o: {cols: 3}}, {s: 7.6, w: 3.4, y: [0.6, 2.9], o: {cols: 3}},
    ]},
    {s: [11.1, 14.1], bands: [[99, BRICK]], wins: [...rows(12.4, 1.8, [[4.0, 5.4], [6.7, 8.1], [9.4, 10.8], [12.0, 13.4]]), door(13.3, 1.6, DARK, 2.6)]},
  ]},
  {tag: 'w06-149', a: [23.41, 17.19], b: [35.99, 9.64], n: [0.5145, 0.8575], segs: [
    {s: [0, 11.6], bands: [[99, BRICK]], wins: [...[2.25, 4.75, 7.2, 9.6].flatMap(s => rows(s, 1.85, [[0.6, 2.6], ...SE_ROWS], {bars: [0.45]}))]},
    {s: [11.6, 14.7], bands: [[99, MAROON]], wins: [...rows(13.4, 1.0, [[3.9, 4.9], [6.5, 7.5], [9.0, 10.0]]), door(13.3, 2.4, DARK, 2.6)]},
  ]},
];
const FRONTS: Front[] = [NW, NW2, NE, ...SE];

// ---- the shell's walls ---------------------------------------------------------------------------------------------
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

/** The front a wall belongs to: facing the same way (within ~14 deg), its plane within 1.2 m of the crop's wall line. */
function frontOf(w: WallInfo): {F: Front; s0: number} | null {
  for (const F of FRONTS) {
    if (w.f.n[0] * F.n[0] + w.f.n[1] * F.n[1] < 0.97) continue;
    const L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]), u: P2 = [(F.b[0] - F.a[0]) / L, (F.b[1] - F.a[1]) / L];
    const d = (w.cx - F.a[0]) * F.n[0] + (w.cz - F.a[1]) * F.n[1];
    if (Math.abs(d) > 1.2) continue;
    const s0 = (w.f.origin[0] - F.a[0]) * u[0] + (w.f.origin[1] - F.a[1]) * u[1];
    if (s0 + w.len < 0.3 || s0 > L - 0.3) continue;
    return {F, s0};
  }
  return null;
}
/** Native point at s along front F's frame, `o` out of it, height y. */
const at = (F: FR, s: number, o: number, y: number): [number, number, number] =>
  [F.f.origin[0] + F.f.tangent[0] * s + F.f.n[0] * o, y, F.f.origin[1] + F.f.tangent[1] * s + F.f.n[1] * o];

const frOf = (w: WallInfo): FR => ({f: w.f, len: w.len});
/** Faces of one wall piece (t0..t1) split into colour bands; returns the face covering y. */
function bandFaces(w: WallInfo, t0: number, t1: number, cuts: [number, Col][]): (y: number) => Face {
  const F = sub(frOf(w), t0, t1 - t0), faces: Face[] = [];
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
/** An opening at front position s cut into whichever band face holds its sill, when it fits the piece. */
function cut(b: BuildingTools, faceAt: (y: number) => Face, t: number, win: Win) {
  const F = faceAt(win.y[0] + 0.01), w = win.w;
  if (win.y[0] < F.y0 - 1e-6 || win.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  // the first opening listed wins where two measured ones would touch (a door under a shopfront, a ribbon over a row)
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.18, frame: 'frame', sill: false, ...win.o});
}

/** The coping band under a wall's top, its upper face 4 cm below the roof edge: flush with it, the band top z-fought the
 *  slate where the 3DBAG roof ring runs a few cm past the wall line (2026-11-21 audit); raised 4 cm over it instead, the band
 *  left a 51 m open slot behind its top (holes gate). */
const eavesBand = (b: BuildingTools, w: WallInfo) => band(b, frOf(w), 0, w.len, w.yt - 0.2, w.yt - 0.04, 0.08, LEDGE, [false, false]);

function frontWall(b: BuildingTools, w: WallInfo, F: Front, s0: number) {
  for (const seg of F.segs) {
    const p0 = Math.max(0, seg.s[0] - s0), p1 = Math.min(w.len, seg.s[1] - s0);
    if (p1 - p0 < 0.05) continue;
    const faceAt = bandFaces(w, p0, p1, seg.bands);
    // a measured opening that crosses a 3DBAG seam is cut in each piece it reaches (the crop line and the shell's
    // strips differ by a few decimetres), keeping its share of the lights
    const lo = s0 + p0 + 0.08, hi = s0 + p1 - 0.08;
    for (const win of seg.wins) {
      const a = Math.max(lo, win.s - win.w / 2), c = Math.min(hi, win.s + win.w / 2);
      if (c - a < Math.min(0.45, win.w * 0.6)) continue;
      const share = (c - a) / win.w, cols = win.o?.cols ? Math.max(1, Math.round(win.o.cols * share)) : undefined;
      cut(b, faceAt, (a + c) / 2 - s0 - p0, {...win, s: (a + c) / 2, w: c - a, o: {...win.o, ...(cols ? {cols} : {})}});
    }
  }
  for (const l of F.ledges ?? []) {
    const a = Math.max(0, l.s - l.w / 2 - s0), c = Math.min(w.len, l.s + l.w / 2 - s0);
    if (c - a > 0.05) ledgeStrip(b, w.f, (a + c) / 2, l.y, c - a, l.h, l.d, l.c);
  }
  // wall beyond the measured segments (corners): plain in the nearest segment's colour, starting where the segments stop
  // (the front's crop line ends a few cm short of the last segment; filling from the line end doubled that sliver)
  const S0 = F.segs[0].s[0], S1 = F.segs[F.segs.length - 1].s[1];
  if (s0 < S0) bandFaces(w, 0, Math.min(w.len, S0 - s0), F.segs[0].bands);
  if (s0 + w.len > S1) bandFaces(w, Math.max(0, S1 - s0), w.len, F.segs[F.segs.length - 1].bands);
  if (w.yt - w.yb > 2) eavesBand(b, w);
}

/** Courtyard, SW (no panorama) and set-back faces: inferred window grid, brick below the set-back line, grey glazing over it. */
function gridWall(b: BuildingTools, w: WallInfo) {
  const setback = w.yb > 13.5;
  const faceAt = bandFaces(w, 0, w.len, [[99, setback ? MAUVE : BRICK]]);
  if (w.len < 2.2) return;
  const n = Math.max(1, Math.floor(w.len / 2.7)), pitch = w.len / n;
  const floors = setback ? [w.yb + 0.1] : Array.from({length: 7}, (_, k) => 0.6 + 2.7 * k);
  for (const f of floors) {
    const y0 = setback ? f + 1.2 : f + (f < 1 ? 0.2 : 0.9), y1 = setback ? Math.min(w.yt - 0.3, f + 2.6) : f + (f < 1 ? 2.6 : 2.3);
    if (y1 - y0 < 0.8 || y1 > w.yt - 0.4) continue;
    for (let k = 0; k < n; k++) cut(b, faceAt, (k + 0.5) * pitch, {s: 0, w: Math.min(setback ? 2.0 : 1.6, pitch - 0.6), y: [y0, y1], o: {cols: setback ? 2 : 1}});
  }
  if (w.yt - w.yb > 2) eavesBand(b, w);
}

export function buildValkenburgerstraat69(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && w.rect && w.len > 0.3).map(w => w.i));
  const owner = new Map<number, {F: Front; s0: number} | null>(infos.filter((w): w is WallInfo => !!w).map(w => [w.i, frontOf(w)]));
  addShell(b, src as never, {
    wall: BRICK, roof: 'slate',
    skip: (_s, i) => rebuilt.has(i),
    wallFor: (_s, i) => { const o = owner.get(i); return o ? o.F.segs[0].bands[o.F.segs[0].bands.length - 1][1] : BRICK; },
  });
  resetFaces();
  const planes = new Map<Front, {sum: number; area: number}>();
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const o = owner.get(w.i);
    if (o && w.yb < 13.5) {
      frontWall(b, w, o.F, o.s0);
      const d = (w.cx - o.F.a[0]) * o.F.n[0] + (w.cz - o.F.a[1]) * o.F.n[1], area = w.len * (w.yt - w.yb), p = planes.get(o.F) ?? {sum: 0, area: 0};
      planes.set(o.F, {sum: p.sum + d * area, area: p.area + area});
    } else gridWall(b, w);
  }
  flushFaces(b);
  // projecting parts on each front's measured plane (area-weighted offset of its rebuilt walls from the crop line)
  for (const F of FRONTS) {
    const p = planes.get(F);
    if (!F.extra || !p) continue;
    const off = p.sum / p.area, L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]), u: P2 = [(F.b[0] - F.a[0]) / L, (F.b[1] - F.a[1]) / L];
    F.extra(b, {f: {origin: [F.a[0] + F.n[0] * off, F.a[1] + F.n[1] * off], tangent: u, n: F.n}, len: L});
  }
}
