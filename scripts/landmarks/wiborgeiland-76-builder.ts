import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, ledgeStrip, roofHeightAt, slab, type Frame} from './nearbar-kit';
import {addPolys, balcony, band, face, flushFaces, opening, resetFaces, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './wiborgeiland-76-footprints.json';

/**
 * WIBORGEILAND 76-171 (BAG pand 0363100012249707, 2020-21, Houthavens): one BAG pand whose 147 m north-west street wall is a
 * row of separately designed fronts (lane hand-blocks-b-20261121). Massing: the 3DBAG LoD2.2 shell
 * (wiborgeiland-76-footprints.json, bag-shell-prepare.ts); every vertical rectangular wall is rebuilt as a holed face
 * (modern-front-kit.ts), the rest of the shell drawn as it is. The shell carries the spout gables as 19/20 m steps under a
 * flat 20 m roof; the front draws each gable's real outline in brick and the rest of the shell wall above it as roof slate
 * (or, over the flat-topped fronts, as a pale set-back storey), so the row reads as gables against roofs from the street.
 * Fronts are read off the rectified Gemeente Amsterdam panoramas (CC BY 4.0) of wall w01-320: TMX7316010203-002854_pano_0023_000056
 * (2022-12-14, warehouses and everything south-west of them, 25.45 px/m, s = px / 25.45 - 3.74) and
 * TMX7316010203-002057_pano_0000_000536 (2021, the north-east half, where the 2022 crop is smeared; positions pinned to the
 * shell's gable peaks at 23.35, 28.75, 34.15, 39.85 m and the warehouse corner at 64.2 m). `s` is metres along the wall from
 * its north-east corner (the viewer's left), heights over the 3DBAG ground, y = (468 - row px) / 25.45 - 1.0:
 *  - a brown brick block with a balcony column and a glazed top storey (-4.5..20.6, smeared in both crops: simplified);
 *  - four red brick spout-gabled houses with stone sills and one window column each (20.6..40.9);
 *  - a buff brick house with mauve shutters, white Juliet panels and a neck gable with an oculus (40.9..48.45);
 *  - dark brick houses with three white framed bay columns, glass balconies and a white rendered ground storey (48.45..64.2);
 *  - two warehouse fronts of mixed brown brick: round-arched windows, loggia columns with black balconies, "STAD AMSTERDAM"
 *    and "WIBORG" bands, the arched gateway and the "ANNO 2018" stone, a slate mansard over the cornice (64.2..90.9);
 *  - three red-brown spout-gabled houses with glass balconies over a dark ground storey (90.9..107.6);
 *  - red brick with two white bay columns over a white ground storey (107.6..116.6);
 *  - a dark brick spout-gabled pair (116.6..125.1);
 *  - buff brick with brick pilasters to the south-west corner (125.1..146.8; w05-231 2021 confirms the corner).
 * The south-east side (w02-140) only has a 2019 capture of the building site, and the end walls only distant captures:
 * they get the inferred red brick window grid.
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// palette names; materialOverrides in the spec give the measured colours (material-slot-tags.ts says what each is)
const BROWN: Col = 'ochre', RED: Col = 'red', REDB: Col = 'copper', DARKB: Col = 'greyBrick', BEIGE: Col = 'sandstone', BUFF: Col = 'gold';
const GROUND: Col = 'blue', WARE: Col = 'brick', STONE: Col = 'stone', SLATE: Col = 'slate', SETBACK: Col = 'concrete', DARK: Col = 'dark', SHUTTER: Col = 'pink';

type P2 = [number, number];
type Win = {s: number; w: number; y: [number, number]; o?: OpenOpts};
type Seg = {s: [number, number]; bands: [number, Col][]; wins: Win[]; top?: P2[]; fill?: Col; extra?: (b: BuildingTools, F: FR, at: (s: number) => FR) => void};

const rows = (s: number, w: number, ys: [number, number][], o?: OpenOpts): Win[] => ys.map(y => ({s, w, y, o}));
const door = (s: number, w: number, back: Col = DARK, h = 2.6): Win => ({s, w, y: [0.05, h], o: {depth: 0.25, back, frame: DARK}});

// ---- the gable outlines ----------------------------------------------------------------------------------------------
/** A spout gable: eaves at the party walls, a short flat top at the peak. */
const gable = (s0: number, s1: number, peak: number, eaves: number, top = 19.9): P2[] =>
  [[s0, Math.max(eaves, top - Math.abs(peak - 0.4 - s0) * (top - eaves) / 2.3)], [peak - 0.4, top], [peak + 0.4, top], [s1, Math.max(eaves, top - Math.abs(s1 - peak - 0.4) * (top - eaves) / 2.3)]];
const flat = (s0: number, s1: number, y: number): P2[] => [[s0, y], [s1, y]];

/** Stone coping along the sloped edges of a top outline, 8 cm proud. */
function coping(b: BuildingTools, F: FR, top: P2[]) {
  const q: {pts: [number, number, number][]}[] = [];
  for (let i = 0; i + 1 < top.length; i++) {
    const [s0, y0] = top[i], [s1, y1] = top[i + 1];
    if (Math.abs(y1 - y0) < 0.05) continue;
    q.push({pts: [[s0, y0 - 0.22, 0.08], [s1, y1 - 0.22, 0.08], [s1, y1 + 0.02, 0.08], [s0, y0 + 0.02, 0.08]]});
  }
  addPolys(b, F.f, q, STONE);
}

// ---- NE brown block (smeared in both crops: simplified) --------------------------------------------------------------
const NE_ROWS: [number, number][] = [[4.0, 6.0], [6.9, 8.9], [9.8, 11.8], [12.7, 14.7]];
const NE_SEG: Seg = {s: [-5, 20.6], bands: [[99, BROWN]], wins: [
  ...[-3.4, -0.8, 1.8, 4.4, 7.0, 13.6, 16.2, 18.8].flatMap(s => [...rows(s, 1.5, NE_ROWS), {s, w: 1.8, y: [0.5, 3.0] as [number, number], o: {cols: 2}}]),
  ...[-2.1, 3.1, 8.3, 14.9].map(s => ({s, w: 2.4, y: [16.0, 19.2] as [number, number], o: {cols: 2, depth: 0.12}})),
  ...rows(10.5, 2.4, [[3.9, 6.2], [6.8, 9.1], [9.7, 12.0], [12.6, 14.9]], {depth: 0.9, back: BROWN, cols: 2}),
  door(10.5, 1.4),
], extra: (b, F) => {
  for (const y of [3.9, 6.8, 9.7, 12.6]) balcony(b, F, 8.9, 3.2, 1.2, y, {rail: DARK, slab: SETBACK, sides: true});
  band(b, F, -4.4, 20.5, 15.45, 15.7, 0.08, STONE);
}};

// ---- four red spout-gabled houses -------------------------------------------------------------------------------------
const RED_ROWS: [number, number][] = [[4.0, 6.0], [7.0, 8.9], [9.9, 11.9]];
const redHouse = (s0: number, s1: number, peak: number, c: number): Seg => ({
  s: [s0, s1], bands: [[99, RED]], top: gable(s0, s1, peak, 15.1), fill: SLATE,
  wins: [...rows(c, 1.8, RED_ROWS, {cols: 2, sill: STONE}), ...rows(c, 1.1, [[13.1, 15.0]], {sill: STONE}),
    door(c - 1.3, 1.1), {s: c + 0.8, w: 1.8, y: [0.6, 3.0], o: {cols: 2}}],
  extra: (b, F) => coping(b, F, gable(s0, s1, peak, 15.1)),
});

// ---- buff house with shutters --------------------------------------------------------------------------------------
const BEIGE_TOP: P2[] = [[39.3, 15.2], [40.0, 19.7], [47.75, 19.7], [48.45, 15.2]];
const BEIGE_ROWS: [number, number][] = [[3.8, 6.1], [6.9, 9.1], [9.7, 11.9], [12.9, 14.9]];
const BEIGE_SEG: Seg = {s: [39.3, 48.45], bands: [[99, BEIGE]], top: BEIGE_TOP, fill: SLATE, wins: [
  ...[42.6, 46.25].flatMap(s => [...rows(s, 1.4, BEIGE_ROWS, {frame: 'white', cols: 2}), {s, w: 2.0, y: [0.5, 3.0] as [number, number], o: {cols: 2, frame: 'white'}}]),
], extra: (b, F) => {
  coping(b, F, BEIGE_TOP);
  disc(b, F.f, 43.9, 18.6, 0.35, 0.1, STONE);
  for (const s of [42.6, 46.25]) {
    for (const [y0, y1] of BEIGE_ROWS) for (const d of [-1, 1]) slab(b, F.f, s + d * 1.05, y0, 0.66, y1 - y0, 0.08, SHUTTER);
    for (const [y0] of BEIGE_ROWS.slice(0, 3)) slab(b, F.f, s, y0 + 0.05, 1.5, 0.5, 0.08, STONE, 0.02);
  }
}};

// ---- dark brick with white bay columns (also the red front further south-west) -------------------------------------
const BAY_ROWS: [number, number][] = [[4.0, 6.4], [6.9, 9.1], [9.8, 11.9], [12.4, 14.2]];
const SMALL_ROWS: [number, number][] = [[4.7, 5.4], [7.6, 8.3], [10.5, 11.2], [13.0, 13.6]];
function bayFront(s0: number, s1: number, brick: Col, parapet: number, bays: number[], smalls: number[], ground: number[], doors: number[], bw = 2.4): Seg {
  return {s: [s0, s1], bands: [[3.6, STONE], [99, brick]], top: flat(s0, s1, parapet), fill: SETBACK, wins: [
    ...bays.flatMap(s => rows(s, 1.5, BAY_ROWS, {frame: 'white', cols: 2})),
    ...smalls.flatMap(s => rows(s, 0.6, SMALL_ROWS, {frame: 'white'})),
    ...ground.map(s => ({s, w: 1.5, y: [0.4, 3.3] as [number, number], o: {cols: 2, rows: 2, frame: DARK}})),
    ...doors.map(s => door(s, 1.1, DARK, 2.8)),
  ], extra: (b, F) => {
    for (const c of bays) {
      // the white frame: jambs proud of the brick from the plinth to above the parapet, a head and a lintel per storey
      for (const d of [-1, 1]) slab(b, F.f, c + d * (bw / 2 - 0.15), 3.6, 0.3, 17.0 - 3.6, 0.25, STONE);
      slab(b, F.f, c, 16.75, bw, 0.3, 0.25, STONE);
      for (const y of [6.55, 9.35, 12.1, 14.4]) slab(b, F.f, c, y, bw - 0.6, 0.25, 0.25, STONE);
      slab(b, F.f, c, 14.8, 1.5, 1.7, 0.04, 'glass', 0.02);
      balcony(b, F, c - 1.4, 2.8, 1.0, 6.75, {rail: 'glass', slab: STONE, sides: true});
    }
    band(b, F, s0 + 0.05, s1 - 0.05, 3.5, 3.7, 0.08, STONE);
    band(b, F, s0 + 0.05, s1 - 0.05, parapet - 0.25, parapet, 0.1, STONE);
  }};
}

// ---- the two warehouse fronts ----------------------------------------------------------------------------------------
const WH_ROWS: [number, number][] = [[4.0, 6.2], [7.1, 9.1], [10.1, 12.3], [13.3, 15.2]];
const LOG_ROWS: [number, number][] = [[4.0, 6.6], [7.1, 9.6], [10.1, 12.6]];
/** Round-arched window drawn over the brick: dark frame, glass, a mullion and a transom (thin bars shallower than wide). */
function arched(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number) {
  const h = y1 - y0;
  archSlab(b, f, t, y0 - 0.04, w + 0.16, h + 0.08, 0.05, DARK);
  archSlab(b, f, t, y0, w, h, 0.11, 'glass');
  ledgeStrip(b, f, t, y0, 0.06, h - w / 2, 0.04, DARK, 0.12);
  ledgeStrip(b, f, t, y0 + (h - w / 2) * 0.6, w, 0.06, 0.04, DARK, 0.12);
}
function warehouse(s0: number, s1: number, cols: number[], loggias: number[], groundArches: number[], doors: number[], sign: [number, number], portal?: number): Seg {
  return {s: [s0, s1], bands: [[99, WARE]], top: flat(s0, s1, 16.75), fill: SLATE, wins: [
    ...loggias.flatMap(c => rows(c, 3.5, LOG_ROWS, {depth: 1.2, back: BROWN, edge: 0})),
    ...doors.map(s => door(s, 1.0, DARK, 2.7)),
    ...(portal ? [{s: portal, w: 3.4, y: [0, 3.0] as [number, number], o: {depth: 2.5, back: DARK, edge: 0}}] : []),
  ], extra: (b, F) => {
    for (const c of cols) for (const [y0, y1] of WH_ROWS) arched(b, F.f, c, y0, y1, 1.4);
    for (const c of loggias) {
      for (const d of [-0.9, 0.9]) arched(b, F.f, c + d, 13.3, 15.2, 1.2);
      for (const y of [7.1, 10.1]) balcony(b, F, c - 1.8, 3.6, 0.7, y, {rail: DARK, slab: DARK, sides: true, slabT: 0.15});
    }
    for (const c of groundArches) arched(b, F.f, c, 0.3, 3.1, 1.4);
    band(b, F, sign[0], sign[1], 3.3, 3.8, 0.08, STONE);
    band(b, F, s0 + 0.05, s1 - 0.05, 16.45, 16.75, 0.15, STONE);
    if (portal) {
      archBand(b, F.f, portal, 0, 3.9, 4.1, 0.25, 0.08, STONE, 0);
      archSlab(b, F.f, portal, 2.95, 3.4, 1.0, 0.08, DARKB, 0);  // the arch head over the gateway, in shadow
      slab(b, F.f, portal, 15.55, 4.6, 0.85, 0.1, STONE);  // the "ANNO 2018" stone
    }
  }};
}

// ---- three red-brown spout gables over a dark ground storey; the dark pair --------------------------------------------
const B_ROWS: [number, number][] = [[3.9, 5.9], [6.6, 8.7], [9.5, 11.8]];
const gabledB = (s0: number, s1: number, peak: number, brick: Col, glassBalcony: boolean, darkGround: boolean): Seg => ({
  s: [s0, s1], bands: darkGround ? [[3.4, GROUND], [99, brick]] : [[99, brick]], top: gable(s0, s1, peak, 14.2), fill: SLATE,
  wins: [...rows(peak, 1.6, B_ROWS, {cols: 2, sill: STONE}), ...rows(peak, 1.0, [[12.5, 14.1]], {sill: STONE}),
    door(peak - 1.3, 1.1, DARK, 2.6), {s: peak + 0.95, w: 1.8, y: [0.4, 3.0], o: {cols: 2}}],
  extra: (b, F) => {
    coping(b, F, gable(s0, s1, peak, 14.2));
    if (glassBalcony) balcony(b, F, peak - 1.4, 2.8, 0.9, 6.6, {rail: 'glass', slab: STONE, sides: true});
    if (darkGround) band(b, F, s0 + 0.02, s1 - 0.02, 3.4, 3.6, 0.08, STONE);
  },
});

/** The dark gabled pair (w01-320 2022, pose wib-sw): a close grid of narrow white-framed windows, a red front door. */
const darkPair = (s0: number, s1: number, peak: number, redDoor: boolean): Seg => {
  const cols = [peak - 1.6, peak, peak + 1.6];
  return {s: [s0, s1], bands: [[99, DARKB]], top: gable(s0, s1, peak, 14.2), fill: SLATE, wins: [
    ...cols.flatMap(c => rows(c, 1.0, B_ROWS, {frame: 'white', bars: [1.4], sill: STONE})), ...rows(peak, 1.0, [[12.5, 14.1]], {frame: 'white', sill: STONE}),
    door(peak - 1.6, 1.1, redDoor ? RED : DARK, 2.6), ...[peak, peak + 1.6].map(c => ({s: c, w: 1.0, y: [0.4, 2.7] as [number, number], o: {frame: 'white', bars: [1.6]}})),
  ], extra: (b, F) => coping(b, F, gable(s0, s1, peak, 14.2))};
};

// ---- buff pilaster block to the corner ------------------------------------------------------------------------------
const BUFF_COLS = Array.from({length: 8}, (_, k) => 126.5 + 2.7 * k);
const BUFF_SEG: Seg = {s: [125.1, 148], bands: [[99, BUFF]], wins: [
  ...BUFF_COLS.flatMap(s => [...rows(s, 1.3, [[4.0, 6.2], [6.9, 9.1], [9.8, 12.0], [12.7, 14.9], [15.6, 17.8]], {cols: 2, sill: STONE}),
    {s, w: 1.6, y: [0.6, 3.0] as [number, number], o: {cols: 2}}]),
], extra: (b, _F, at) => {
  // the block's 3DBAG strips step 13 cm in and out: each pilaster and cornice piece stands on its own strip
  for (let k = 0; k <= 8; k++) slab(b, at(125.15 + 2.7 * k).f, 125.15 + 2.7 * k, 0.2, 0.5, 18.3, 0.12, BUFF);
  for (let k = 0; k < 8; k++) { const m = 125.4 + 2.7 * k + 1.1; band(b, at(m), m - 1.1, m + 1.1, 18.5, 19.1, 0.2, BUFF); }
}};

const SEGS: Seg[] = [
  NE_SEG,
  redHouse(20.6, 26.05, 23.35, 23.35), redHouse(26.05, 31.45, 28.75, 28.75), redHouse(31.45, 36.9, 34.15, 34.15), redHouse(36.9, 39.3, 38.1, 38.1),
  BEIGE_SEG,
  bayFront(48.45, 64.2, DARKB, 14.6, [51.05, 56.45, 61.65], [49.15, 53.2, 54.3, 58.6, 59.5, 63.5], [49.3, 53.0, 54.9, 58.3, 60.0, 63.4], [51.05, 56.45, 61.65]),
  warehouse(64.2, 80.1, [71.0, 73.4], [67.65, 78.3], [65.6, 67.5, 69.4, 71.2, 73.0, 74.8], [75.8], [70.0, 75.6], 78.3),
  warehouse(80.1, 90.9, [82.3, 84.4], [88.65], [82.3, 84.3, 86.3], [], [81.5, 85.5]),
  gabledB(90.9, 96.65, 93.9, REDB, true, true), gabledB(96.65, 102.05, 99.35, REDB, true, true), gabledB(102.05, 107.6, 104.7, REDB, true, true),
  bayFront(107.6, 116.6, RED, 15.8, [108.6, 114.1], [110.6, 111.6, 112.5], [110.6, 112.4, 115.8], [108.6, 114.1], 2.2),
  darkPair(116.6, 120.85, 118.7, false), darkPair(120.85, 125.1, 123.0, true),
  BUFF_SEG,
];
type Front = {tag: string; a: P2; b: P2; n: P2};
const NW: Front = {tag: 'w01-320', a: [63.57, -60.95], b: [-49.07, 33.21], n: [-0.64136, -0.76724]};
const U: P2 = [(NW.b[0] - NW.a[0]) / Math.hypot(NW.b[0] - NW.a[0], NW.b[1] - NW.a[1]), (NW.b[1] - NW.a[1]) / Math.hypot(NW.b[0] - NW.a[0], NW.b[1] - NW.a[1])];

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

/** A wall on the street front: facing the same way (within ~14 deg), its plane within 1.2 m of the crop's wall line. */
function frontS0(w: WallInfo): number | null {
  // a few front strips read the roof test backwards (a canopy or balcony roof in the shell): face them out again
  const onLine = Math.abs((w.cx - NW.a[0]) * NW.n[0] + (w.cz - NW.a[1]) * NW.n[1]) <= 1.2;
  if (!onLine) return null;
  if (w.f.n[0] * NW.n[0] + w.f.n[1] * NW.n[1] < -0.97) {
    const {origin: o, tangent: t, n} = w.f;
    w.f = {origin: [o[0] + t[0] * w.len, o[1] + t[1] * w.len], tangent: [-t[0], -t[1]], n: [-n[0], -n[1]]};
  }
  if (w.f.n[0] * NW.n[0] + w.f.n[1] * NW.n[1] < 0.97) return null;
  if (Math.abs((w.cx - NW.a[0]) * NW.n[0] + (w.cz - NW.a[1]) * NW.n[1]) > 1.2) return null;
  return (w.f.origin[0] - NW.a[0]) * U[0] + (w.f.origin[1] - NW.a[1]) * U[1];
}

const frOf = (w: WallInfo): FR => ({f: w.f, len: w.len});
/** Faces of one wall piece (t0..t1, up to yt) split into colour bands; returns the face covering y. */
function bandFaces(w: WallInfo, t0: number, t1: number, cuts: [number, Col][], yt = w.yt): (y: number) => Face {
  const F = sub(frOf(w), t0, t1 - t0), faces: Face[] = [];
  let y = w.yb;
  for (const [top, c] of cuts) {
    const y1 = Math.min(top, yt);
    if (y1 - y > 0.02) faces.push(face(F, y, y1, c));
    y = Math.max(y, y1);
    if (y >= yt - 1e-6) break;
  }
  if (yt - y > 0.02) faces.push(face(F, y, yt, cuts[cuts.length - 1][1]));
  return yy => faces.find(f => yy >= f.y0 - 1e-6 && yy < f.y1 - 1e-6) ?? faces[faces.length - 1];
}
/** An opening at front position s cut into whichever band face holds its sill, when it fits the piece. */
function cut(b: BuildingTools, faceAt: (y: number) => Face, t: number, win: Win) {
  const F = faceAt(win.y[0] + 0.01), w = win.w;
  if (win.y[0] < F.y0 - 1e-6 || win.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.18, frame: 'frame', sill: false, ...win.o});
}
/** Height of a top outline at s (linear between its points, flat beyond its ends). */
function topAt(top: P2[], s: number): number {
  if (s <= top[0][0]) return top[0][1];
  for (let i = 0; i + 1 < top.length; i++) if (s <= top[i + 1][0]) { const [a, ya] = top[i], [c, yc] = top[i + 1]; return c - a < 1e-6 ? yc : ya + (yc - ya) * (s - a) / (c - a); }
  return top[top.length - 1][1];
}

type Piece = {s0: number; s1: number; yt: number; d: number};
/** Faces of one front run (0..len of F, ground to yt) split into colour bands; returns the face covering y. */
function runFaces(F: FR, yt: number, cuts: [number, Col][]): (y: number) => Face {
  const faces: Face[] = [];
  let y = 0;
  for (const [top, c] of cuts) {
    const y1 = Math.min(top, yt);
    if (y1 - y > 0.02) faces.push(face(F, y, y1, c));
    y = Math.max(y, y1);
    if (y >= yt - 1e-6) break;
  }
  if (yt - y > 0.02) faces.push(face(F, y, yt, cuts[cuts.length - 1][1]));
  return yy => faces.find(f => yy >= f.y0 - 1e-6 && yy < f.y1 - 1e-6) ?? faces[faces.length - 1];
}

/**
 * One front segment over the shell's front strips it covers. Neighbouring strips whose planes agree within 2.5 cm are drawn
 * as one face (a window that crosses a 3DBAG seam stays whole); a strip set further out or back gets its own face on its own
 * plane, so every edge still meets the shell's roofs and returns. Above the outline's lowest point the brick follows the
 * outline; above the outline the strip's 3DBAG height is filled in the segment's fill colour.
 */
function frontSegment(b: BuildingTools, seg: Seg, pieces: Piece[]) {
  const over = pieces.filter(p => Math.min(seg.s[1], p.s1) - Math.max(seg.s[0], p.s0) > 0.05).sort((x, y) => x.s0 - y.s0);
  if (!over.length) return;
  const runs: Piece[][] = [];
  for (const p of over) { const r = runs[runs.length - 1]; if (r && Math.abs(r[0].d - p.d) <= 0.025 && p.s0 - r[r.length - 1].s1 < 0.05) r.push(p); else runs.push([p]); }
  let sum = 0, area = 0;
  const prof = (s: number) => (seg.top ? topAt(seg.top, s) : 99);
  for (const run of runs) {
    const a = Math.max(seg.s[0], run[0].s0), c = Math.min(seg.s[1], run[run.length - 1].s1);
    if (c - a < 0.05) continue;
    const off = run.reduce((m, p) => m + p.d * (p.s1 - p.s0), 0) / run.reduce((m, p) => m + p.s1 - p.s0, 0);
    sum += off * (c - a); area += c - a;
    const FS: FR = {f: {origin: [NW.a[0] + NW.n[0] * off, NW.a[1] + NW.n[1] * off], tangent: U, n: NW.n}, len: 147};
    const ytAt = (s: number) => (run.find(p => s >= p.s0 - 1e-6 && s <= p.s1 + 1e-6) ?? run[0]).yt;
    const cuts = [a, c, ...run.flatMap(p => [p.s0, p.s1]), ...(seg.top ?? []).map(p => p[0])].filter(t => t >= a - 1e-6 && t <= c + 1e-6).sort((x, y) => x - y)
      .filter((t, i, all) => i === 0 || t - all[i - 1] > 1e-3);
    let rectTop = 99;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const yt = ytAt((cuts[i] + cuts[i + 1]) / 2);
      rectTop = Math.min(rectTop, Math.min(yt, prof(cuts[i] + 1e-4)), Math.min(yt, prof(cuts[i + 1] - 1e-4)));
    }
    const F = sub(FS, a, c - a), faceAt = runFaces(F, rectTop, seg.bands);
    const brick = seg.bands[seg.bands.length - 1][1], q: {pts: [number, number, number][]}[] = [], fq: typeof q = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const t0 = cuts[i], t1 = cuts[i + 1], yt = ytAt((t0 + t1) / 2), y0 = Math.min(yt, prof(t0 + 1e-4)), y1 = Math.min(yt, prof(t1 - 1e-4));
      if (y0 - rectTop > 0.01 || y1 - rectTop > 0.01) q.push({pts: [[t0 - a, rectTop, 0], [t1 - a, rectTop, 0], [t1 - a, y1, 0], [t0 - a, y0, 0]]});
      if (yt - y0 > 0.01 || yt - y1 > 0.01) fq.push({pts: [[t0 - a, y0, 0], [t1 - a, y1, 0], [t1 - a, yt, 0], [t0 - a, yt, 0]]});
    }
    addPolys(b, F.f, q, brick);
    addPolys(b, F.f, fq, seg.fill ?? SLATE);
    for (const win of seg.wins) {
      const lo = Math.max(a + 0.08, win.s - win.w / 2), hi = Math.min(c - 0.08, win.s + win.w / 2);
      if (hi - lo < Math.min(0.45, win.w * 0.6)) continue;
      const share = (hi - lo) / win.w, cols = win.o?.cols ? Math.max(1, Math.round(win.o.cols * share)) : undefined;
      cut(b, faceAt, (lo + hi) / 2 - a, {...win, s: (lo + hi) / 2, w: hi - lo, o: {...win.o, ...(cols ? {cols} : {})}});
    }
  }
  if (!area) return;
  const fr = (o: number): FR => ({f: {origin: [NW.a[0] + NW.n[0] * o, NW.a[1] + NW.n[1] * o], tangent: U, n: NW.n}, len: 147});
  const runOff = (x: number) => { const r = runs.find(q => x >= q[0].s0 - 0.05 && x <= q[q.length - 1].s1 + 0.05) ?? runs[0]; return r.reduce((m, p) => m + p.d * (p.s1 - p.s0), 0) / r.reduce((m, p) => m + p.s1 - p.s0, 0); };
  seg.extra?.(b, fr(sum / area), x => fr(runOff(x)));
}

/** Courtyard, south-east (2019 building site only), end and set-back faces: inferred red brick window grid. */
function gridWall(b: BuildingTools, w: WallInfo) {
  const faceAt = bandFaces(w, 0, w.len, [[99, RED]]);
  if (w.len < 2.2) return;
  const n = Math.max(1, Math.floor(w.len / 2.7)), pitch = w.len / n;
  const floors = Array.from({length: 7}, (_, k) => 0.6 + 2.7 * k);
  for (const f of floors) {
    const y0 = f + (f < 1 ? 0.2 : 0.9), y1 = f + (f < 1 ? 2.6 : 2.3);
    if (y0 < w.yb + 0.3 || y1 > w.yt - 0.4) continue;
    for (let k = 0; k < n; k++) cut(b, faceAt, (k + 0.5) * pitch, {s: 0, w: Math.min(1.6, pitch - 0.6), y: [y0, y1], o: {cols: 1}});
  }
  // coping lifted 5 cm over the 3DBAG roof line
  if (w.yt - w.yb > 2) slab(b, w.f, w.len / 2, w.yt - 0.2, w.len, 0.25, 0.08, STONE);
}

export function buildWiborgeiland76(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  // every wall on the street plane is redrawn by the front segments (rectangular or not); other rectangular walls get the grid
  const front = new Map<number, number>();
  for (const w of infos) { if (!w) continue; const s0 = frontS0(w); if (s0 !== null) front.set(w.i, s0); }
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && (front.has(w.i) || (w.rect && w.len > 0.3))).map(w => w.i));
  addShell(b, src as never, {wall: RED, roof: SLATE, skip: (_s, i) => rebuilt.has(i)});
  resetFaces();
  const pieces: Piece[] = [];
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const s0 = front.get(w.i);
    if (s0 === undefined) { gridWall(b, w); continue; }
    if (w.yb > 1) continue;
    pieces.push({s0, s1: s0 + w.len, yt: w.yt, d: (w.cx - NW.a[0]) * NW.n[0] + (w.cz - NW.a[1]) * NW.n[1]});
  }
  const extras: (() => void)[] = [];
  for (const seg of SEGS) frontSegment(b, {...seg, extra: seg.extra && ((bb, F, at) => extras.push(() => seg.extra!(bb, F, at)))}, pieces);
  flushFaces(b);
  for (const e of extras) e();
}
