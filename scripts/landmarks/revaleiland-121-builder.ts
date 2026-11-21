import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, roofHeightAt, slab, type Frame} from './nearbar-kit';
import {balcony, band, face, flushFaces, opening, resetFaces, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './revaleiland-121-footprints.json';

/**
 * REVALEILAND 121-286 (Houthavens; BAG pand 0363100012253889, 2023): a perimeter housing block whose 83 m south-east quay
 * wall is three fronts in one buff brick family, and whose north-east wall is a grey brick gallery block between two
 * punched towers (lane hand-blocks-b-20261121; the triage routed it to hand because one wall carries three window systems).
 * Massing: the 3DBAG LoD2.2 shell (revaleiland-121-footprints.json, bag-shell-prepare.ts); every vertical rectangular wall
 * is rebuilt as a holed face (modern-front-kit.ts), the rest of the shell drawn as it is. Fronts are measured off the
 * rectified Gemeente Amsterdam panoramas (CC BY 4.0) of 2024-2025 (the brief's own 2016-2021 crops show the building
 * site): each front below is the crop's wall line in native metres (x east, z south from the BAG ring's vertex average),
 * `s` metres along it from the viewer's left, heights over the 3DBAG ground read from the crop's street line:
 *  - SE quay (2025_09_29_07_54_42_00066 2025-09-29, 82.7 m at 34.6 px/m; segments _00060.._00074): the banded west block
 *    (s 0-19.3: framed window groups of a slatted dark-brick panel beside a window, between proud brick bands), the bay
 *    front (s 19.3-63.4: six proud buff bays with one window per storey, recesses between them with cantilevered
 *    brick-parapet balconies, a pale-columned shop colonnade under it), and the taller pinkish east block (s 63.4-80.3:
 *    small punched windows, a balcony stack, a covered gateway in the ground storey);
 *  - NE (recording_2024-10-16_06-25-31_02863/02868/02872, 59 m at 50 px/m): two grey brick towers with punched windows
 *    either side of a three-storey grey brick base under two open gallery storeys, pale concrete fins in front.
 * The W and NW walls have no post-completion panorama within reach (the 2016-2020 captures show the site): they and the
 * courtyard faces get an inferred buff window grid.
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// palette names; materialOverrides in the spec give the measured colours
const BUFF: Col = 'brick', BUFF_A: Col = 'sandstone', PINK: Col = 'red', GREY: Col = 'greyBrick', STONE: Col = 'stone';
const CONC: Col = 'concrete', DARK: Col = 'dark', PANEL: Col = 'ochre', DARKBRICK: Col = 'bronze';

type P2 = [number, number];
type Win = {s: number; w: number; y: [number, number]; o?: OpenOpts};
type Seg = {s: [number, number]; bands: [number, Col][]; wins: Win[]};
type Front = {tag: string; a: P2; b: P2; n: P2; segs: Seg[]; extra?: (b: BuildingTools, F: FR) => void};

const rows = (s: number, w: number, ys: [number, number][], o?: OpenOpts): Win[] => ys.map(y => ({s, w, y, o}));
const shop = (s: number, w: number, y: [number, number] = [0.1, 3.2]): Win => ({s, w, y, o: {depth: 0.45, cols: Math.max(1, Math.round(w / 1.5)), frame: DARK, edge: 0.07}});
const door = (s: number, w: number, back: Col, h = 2.5): Win => ({s, w, y: [0.05, h], o: {depth: 0.3, back, frame: 'frame'}});

// ---- SE quay wall (w01-140, 2025-09-29) -------------------------------------------------------------------------------
const A_ROWS: [number, number][] = [[4.75, 6.4], [7.85, 9.5], [10.9, 12.5], [13.9, 15.5]];
const B_ROWS: [number, number][] = [[4.9, 6.4], [7.9, 9.45], [10.9, 12.4]];
const C_ROWS: [number, number][] = [[5.2, 6.5], [8.3, 9.6], [11.5, 12.8], [14.5, 15.8]];
const BAYS = [19.3, 27.0, 34.7, 42.5, 50.4, 58.4];          // proud bays 4.8 m wide; recesses between
const RECESS: [number, number][] = [[24.1, 27.0], [31.8, 34.7], [39.5, 42.5], [47.3, 50.4], [55.2, 58.4]];
const COLS = [21.3, 24.4, 27.9, 31.8, 35.3, 39.2, 43.0, 46.9, 50.7, 54.6, 58.4, 62.3, 65.5];
const SLABS = [3.6, 6.8, 10.0];
/** One framed window group of the banded block: a dark slatted brick panel beside a two-light window. */
const group = (c: number, w: number): Win[] => A_ROWS.flatMap(y => [
  {s: c - w / 2 + w * 0.19, w: w * 0.38 - 0.08, y, o: {depth: 0.12, back: PANEL, edge: 0}},
  {s: c + w * 0.19, w: w * 0.62 - 0.08, y, o: {depth: 0.2, cols: 2}},
]);
const SE: Front = {
  tag: 'w01-140', a: [-13.85, 53.71], b: [49.55, 0.64], n: [0.6419, 0.7668],
  segs: [
    {s: [0, 19.3], bands: [[99, BUFF_A]], wins: [
      shop(4.3, 6.4), shop(10.5, 5.0), shop(16.2, 5.6),
      ...group(2.4, 2.6), ...group(6.3, 3.0), ...group(10.0, 3.0), ...group(14.0, 3.0), ...group(17.5, 3.0),
    ]},
    {s: [19.3, 63.4], bands: [[99, BUFF]], wins: [
      ...COLS.slice(0, -1).map((c, k) => shop((c + COLS[k + 1]) / 2, COLS[k + 1] - c - 0.5)).filter(w => w.s < 63),
      ...rows(21.75, 1.8, B_ROWS, {cols: 2}),
      ...BAYS.slice(1).flatMap(t => rows(t + 2.5, 1.8, B_ROWS, {cols: 2})),
      // the recesses between the bays: shadowed loggia backs with the balcony doors
      ...RECESS.map(([t0, t1]) => ({s: (t0 + t1) / 2, w: t1 - t0, y: [3.45, 13.0] as [number, number], o: {depth: 0.8, back: DARKBRICK, edge: 0}})),
    ]},
    {s: [63.4, 80.3], bands: [[99, PINK]], wins: [
      door(68.45, 1.7, DARK, 2.6), {s: 73.2, w: 6.2, y: [0.05, 2.8], o: {depth: 2.0, back: DARK, edge: 0}}, door(77.8, 1.6, DARK, 2.6),
      ...[68.1, 71.9, 73.8, 75.9, 77.8].flatMap(s => rows(s, 1.0, C_ROWS)),
      ...rows(65.9, 1.8, B_ROWS.map(([y0, y1]) => [y0 - 1.0, y1] as [number, number]), {cols: 2}),
    ]},
    {s: [80.3, 82.7], bands: [[99, GREY]], wins: []},
  ],
  extra: (b, F) => {
    // proud brick bands of the banded block, in two pieces (strips stay under 15 m)
    for (const y of [3.35, 6.6, 9.65, 12.65, 15.6]) for (const [t0, t1] of [[0.4, 9.8], [9.8, 19.2]]) ledgeStrip(b, F.f, (t0 + t1) / 2, y, t1 - t0, 0.28, 0.08, BUFF_A);
    // the six proud bays: buff boxes 0.35 m out, from the colonnade beam to their crown
    for (const t of BAYS) {
      band(b, F, t + 0.05, t + 0.55, 3.45, 14.1, 0.35, BUFF);
      band(b, F, t + 4.25, t + 4.75, 3.45, 14.1, 0.35, BUFF);
      band(b, F, t + 0.55, t + 4.25, 13.45, 14.1, 0.35, BUFF, [false, false]);
    }
    // cantilevered balconies with solid brick parapets in each recess and at the east block
    for (const [t0, t1] of RECESS) for (const y of SLABS) balcony(b, F, t0 - 0.3, t1 - t0 + 0.6, 1.5, y, {slab: CONC, parapet: BUFF, railH: 1.1});
    for (const y of SLABS) balcony(b, F, 63.6, 4.8, 1.5, y, {slab: CONC, parapet: PINK, railH: 1.1});
    // pale stone colonnade: columns and the beam over the shops
    for (const c of COLS) slab(b, F.f, c, 0, 0.45, 3.35, 0.35, STONE);
    for (const [t0, t1] of [[21.0, 31.6], [31.6, 42.2], [42.2, 52.8], [52.8, 63.4]]) slab(b, F.f, (t0 + t1) / 2, 3.2, t1 - t0 - 0.03, 0.25, 0.36, STONE);
  },
};

// ---- NE wall (w03-50, 2024-10-16) -------------------------------------------------------------------------------------
const T_ROWS: [number, number][] = [[4.4, 6.0], [7.7, 9.1], [10.6, 11.9], [13.6, 14.9]];
const NE: Front = {
  tag: 'w03-50', a: [49.55, 0.64], b: [11.68, -44.58], n: [0.7666, -0.6421],
  segs: [
    {s: [0, 14.7], bands: [[99, GREY]], wins: [
      ...[2.25, 4.05, 7.9, 9.75, 11.55].flatMap(s => rows(s, 0.9, T_ROWS)),
      {s: 4.6, w: 1.8, y: [0.9, 3.1], o: {cols: 2}}, {s: 8.55, w: 1.7, y: [0.9, 3.1], o: {cols: 2}},
    ]},
    {s: [14.7, 49.6], bands: [[99, GREY]], wins: [
      ...Array.from({length: 19}, (_, k) => ({s: 15.4 + k * 1.83, w: 0.85, y: [4.4, 6.0] as [number, number]})),
      // the two open gallery storeys behind the parapets
      ...[[18.3, 28.7], [28.7, 39.0], [39.0, 49.5]].flatMap(([t0, t1]) => [[7.5, 9.4], [10.5, 12.2]].map(y => ({s: (t0 + t1) / 2, w: t1 - t0 - 0.3, y: y as [number, number], o: {depth: 1.8, back: DARK, edge: 0}}))),
      door(17.5, 1.8, DARK, 2.7), {s: 25.3, w: 4.0, y: [0.05, 2.9], o: {depth: 2.0, back: DARK, edge: 0}}, door(32.2, 1.8, DARK, 2.7),
      {s: 35.8, w: 1.9, y: [0.9, 3.0], o: {cols: 2}}, {s: 41.5, w: 1.8, y: [0.9, 3.0], o: {cols: 2}}, door(44.8, 1.2, DARK, 2.7),
    ]},
    {s: [49.6, 59.0], bands: [[99, GREY]], wins: [
      ...[54.85, 56.65].flatMap(s => rows(s, 0.9, T_ROWS)), door(50.0, 2.1, DARK, 2.8), {s: 55.6, w: 1.8, y: [0.9, 3.0], o: {cols: 2}},
    ]},
  ],
  extra: (b, F) => {
    // pale concrete fins standing in front of the galleries, up past the parapet
    for (const s of [18.7, 22.7, 26.7, 30.4, 34.2, 37.9, 42.5, 46.3]) slab(b, F.f, s, 6.5, 0.45, 9.0, 1.0, CONC, -0.5);
  },
};
const FRONTS: Front[] = [SE, NE];

// ---- the shell's walls (machinery from valkenburgerstraat-69-builder.ts) --------------------------------------------
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
  // the first opening listed wins where two measured ones would touch (a door under a shopfront, a window in a recess)
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.18, frame: 'frame', sill: false, ...win.o});
}
/** Coping at the wall head, lifted 5 cm over the 3DBAG roof line so it never z-fights the roof edge. */
const coping = (b: BuildingTools, w: WallInfo, c: Col) => {
  if (w.yt - w.yb <= 2) return;
  // in separate pieces of at most 10 m (3 cm apart, end-capped), so no open band edge chains along a long wall
  const n = Math.ceil(w.len / 10), step = w.len / n;
  for (let k = 0; k < n; k++) band(b, frOf(w), k * step + 0.015, (k + 1) * step - 0.015, w.yt - 0.15, w.yt + 0.05, 0.08, c);
};

function frontWall(b: BuildingTools, w: WallInfo, F: Front, s0: number) {
  for (const seg of F.segs) {
    const p0 = Math.max(0, seg.s[0] - s0), p1 = Math.min(w.len, seg.s[1] - s0);
    if (p1 - p0 < 0.05) continue;
    const faceAt = bandFaces(w, p0, p1, seg.bands);
    // a measured opening that crosses a 3DBAG seam is cut in each piece it reaches, keeping its share of the lights
    const lo = s0 + p0 + 0.08, hi = s0 + p1 - 0.08;
    for (const win of seg.wins) {
      const a = Math.max(lo, win.s - win.w / 2), c = Math.min(hi, win.s + win.w / 2);
      if (c - a < Math.min(0.45, win.w * 0.6)) continue;
      const share = (c - a) / win.w, cols = win.o?.cols ? Math.max(1, Math.round(win.o.cols * share)) : undefined;
      cut(b, faceAt, (a + c) / 2 - s0 - p0, {...win, s: (a + c) / 2, w: c - a, o: {...win.o, ...(cols ? {cols} : {})}});
    }
  }
  // wall beyond the measured front (corners): plain in the nearest segment's colour
  const L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]);
  if (s0 < 0) bandFaces(w, 0, Math.min(w.len, -s0), F.segs[0].bands);
  if (s0 + w.len > L) bandFaces(w, Math.max(0, L - s0), w.len, F.segs[F.segs.length - 1].bands);
  coping(b, w, CONC);
}

/** W, NW (no post-completion panorama), courtyard and set-back faces: an inferred buff window grid on 3.15 m storeys. */
function gridWall(b: BuildingTools, w: WallInfo) {
  const grey = (w.cx - NE.a[0]) * NE.n[0] + (w.cz - NE.a[1]) * NE.n[1] > -6;
  const faceAt = bandFaces(w, 0, w.len, [[99, grey ? GREY : BUFF]]);
  if (w.len >= 2.2) {
    const n = Math.max(1, Math.floor(w.len / 3.2)), pitch = w.len / n;
    for (const f of [0, 3.45, 6.6, 9.75, 12.9]) {
      const y0 = f < 1 ? 0.6 : f + 1.0, y1 = f < 1 ? 3.0 : f + 2.5;
      if (y0 < w.yb + 0.4 || y1 > w.yt - 0.35) continue;
      for (let k = 0; k < n; k++) cut(b, faceAt, (k + 0.5) * pitch, {s: 0, w: Math.min(1.6, pitch - 0.7), y: [y0, y1], o: {cols: 2}});
    }
  }
  coping(b, w, CONC);
}

export function buildRevaleiland121(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && w.rect && w.len > 0.3).map(w => w.i));
  const owner = new Map<number, {F: Front; s0: number} | null>(infos.filter((w): w is WallInfo => !!w).map(w => [w.i, frontOf(w)]));
  addShell(b, src as never, {
    wall: BUFF, roof: 'slate',
    skip: (_s, i) => rebuilt.has(i),
    wallFor: (_s, i) => (owner.get(i)?.F === NE ? GREY : BUFF),
  });
  resetFaces();
  const planes = new Map<Front, {sum: number; area: number}>();
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const o = owner.get(w.i);
    if (o && w.yb < 1) {
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
