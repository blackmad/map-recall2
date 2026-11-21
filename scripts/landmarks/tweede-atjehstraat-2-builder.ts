import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {roofHeightAt, slab, type Frame} from './nearbar-kit';
import {balcony, band, face, flushFaces, opening, resetFaces, strut, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './tweede-atjehstraat-2-footprints.json';

/**
 * TWEEDE ATJEHSTRAAT 2-10 (+ Atjehstraat and the corner; BAG pand 0363100012243154, 2015-16): a perimeter block of housing
 * over a glazed corner plinth, built as several fronts in different bricks (lane hand-blocks-b-20261121, after
 * valkenburgerstraat-69-builder.ts). Massing: the 3DBAG LoD2.2 shell (tweede-atjehstraat-2-footprints.json,
 * bag-shell-prepare.ts); every vertical rectangular wall is rebuilt as a holed face (modern-front-kit.ts). Fronts are measured
 * off the rectified Gemeente Amsterdam panoramas (CC BY 4.0) in tweede-atjehstraat-2-inventory.json, in native metres (x east,
 * z south from the BAG ring's vertex average), `s` along the wall from the viewer's left, heights over the 3DBAG ground:
 *  - south (w01-181, 2022, 33 px/m): buff speckled brick, 3.8 m bays of three-light white windows, stacks of brick-parapet
 *    balconies, a ground storey of paired louvre front doors and windows;
 *  - north (w02-340, 2024, 46 px/m): a red brick strip with deep windows, a brown-mix brick front with hung steel balconies
 *    and two raised bays, a taller salmon brick block with white-framed windows and a timber garage gate;
 *  - west and its south-west corner (w04-250, w08-160, 2025, 50 px/m): a 6.4 m glazed plinth between round concrete columns
 *    under buff brick with wide five-light windows;
 *  - the mews (w03-1, 2022, ground storey only): alternating red and buff house fronts with louvre doors (rhythm inferred).
 * Courtyard and short faces get a buff window grid (inferred).
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// palette names; materialOverrides in the spec give the measured colours
const BUFF: Col = 'sandstone', RED: Col = 'red', BROWN: Col = 'brick', SALMON: Col = 'ochre', LEDGE: Col = 'concrete';
const DARK: Col = 'dark', METAL: Col = 'bronze', LOUVRE: Col = 'greyBrick', TIMBER: Col = 'copper', ZINC: Col = 'blue';

type P2 = [number, number];
type Win = {s: number; w: number; y: [number, number]; o?: OpenOpts};
type Seg = {s: [number, number]; bands: [number, Col][]; wins: Win[]};
type Front = {tag: string; a: P2; b: P2; n: P2; segs: Seg[]; extra?: (b: BuildingTools, F: FR) => void};

const rows = (s: number, w: number, ys: [number, number][], o?: OpenOpts): Win[] => ys.map(y => ({s, w, y, o}));
const door = (s: number, w: number, back: Col, h = 2.5, o: OpenOpts = {}): Win => ({s, w, y: [0.05, h], o: {depth: 0.25, back, frame: 'frame', ...o}});
const louvre = (s: number, w = 0.9, h = 2.6): Win => door(s, w, LOUVRE, h, {bars: [0.5, 0.85, 1.2, 1.55, 1.9]});
const WHITE: OpenOpts = {sill: LEDGE};
const pitch = (y0: number, h: number, n: number, p = 3.05): [number, number][] => Array.from({length: n}, (_, k) => [y0 + p * k, y0 + p * k + h]);
/** Outward normal of a wall line a→b given with the viewer's left first: the viewer stands on the right-hand side. */
const mk = (tag: string, a: P2, b: P2, segs: Seg[], extra?: Front['extra']): Front => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return {tag, a, b, n: [-u[1], u[0]], segs, extra};
};
/** Roof height a little inside front F at s (balconies only where the wall reaches). */
const roofAt = (F: FR, s: number) => roofHeightAt(src.surfaces, F.f.origin[0] + F.f.tangent[0] * s - F.f.n[0] * 0.8, F.f.origin[1] + F.f.tangent[1] * s - F.f.n[1] * 0.8) ?? 0;

// ---- south: Atjehstraat (w01-181, TMX7316010203-002593_pano_0000_003276, 2022-06-13) --------------------------------
const S_COLS = [5.2, 8.8, 16.6, 20.3, 24.1, 27.9, 31.7, 35.6, 39.3, 43.2, 47.0, 50.8, 54.4, 58.3, 61.9, 65.6, 69.4, 73.2, 76.3];
const S_FLOORS = [3.6, 6.65, 9.7, 12.75, 15.8, 18.85, 21.9];
const S_BAL: [number, number][] = [[3.0, 5.0], [11.0, 4.5], [18.9, 6.0], [27.1, 5.2], [44.4, 6.0], [59.3, 5.6], [67.4, 6.6]];
const S: Front = mk('w01-181', [-24.204, 12.704], [53.945, 14.654], [{s: [0, 78.2], bands: [[99, BUFF]], wins: [
  ...S_COLS.flatMap(s => rows(s, 2.4, pitch(4.6, 1.6, 7), {cols: 3, bars: [1.15], ...WHITE})),
  ...S_COLS.flatMap((s, k) => s === 35.6 ? [door(s, 1.6, DARK, 2.7)] : k % 2 ? [louvre(s - 0.55), louvre(s + 0.55)] : [{s, w: 2.4, y: [0.6, 2.9] as [number, number], o: {cols: 3, bars: [1.7]}}]),
]}], (b, F) => {
  for (const [c, w] of S_BAL) for (const y of S_FLOORS.slice(1)) if (roofAt(F, c) > y + 2.4) balcony(b, F, c - w / 2, w, 1.6, y, {slab: LEDGE, parapet: BUFF, railH: 1.1});
  band(b, F, 0.1, 78.1, 3.35, 3.55, 0.06, LEDGE);
});

// ---- north: Tweede Atjehstraat (w02-340, recording_2024-12-20_09-04-31_07582) ------------------------------------------
// s scaled to the 3DBAG seams: red strip 0-3.5, brown front 3.5-29.6 (44.4 px/m), salmon block 29.6-41.3 (44.8 px/m).
// The shell's brown wall runs to 16.2 m all along; only the two raised bays (7.6-14.0, 17.9-24.7) are brick up there, the
// rest is the set-back zinc storey over a coping at 12.8 m, drawn here as a zinc band on the wall plane.
const N_UP: [number, number][] = [[4.4, 5.9], [7.2, 8.75], [10.1, 11.5]];
const N_MID = [4.06, 5.64, 7.17, 9.24, 10.93, 12.4, 14.54, 16.11, 17.69, 19.78, 21.4, 22.94, 25.01, 26.7, 28.39];
const N_BAL = [5.08, 10.6, 16.18, 21.74, 27.37];
const N_BAYS: [number, number][] = [[7.62, 14.0], [17.9, 24.7]];
const inBay = (s: number) => N_BAYS.some(([a, c]) => s > a + 0.3 && s < c - 0.3);
const S_ROWS: [number, number][] = [[4.5, 6.1], [7.3, 9.0], [10.3, 11.8], [13.2, 14.7]];
const WF: OpenOpts = {edge: 0.12, depth: 0.16, sill: LEDGE};
const midWins: Win[] = [
  louvre(12.4), louvre(14.42), louvre(17.35), louvre(19.72), {s: 22.53, w: 1.25, y: [0.6, 2.9], o: {cols: 2}}, louvre(25.01),
  {s: 27.52, w: 1.9, y: [0.05, 2.7], o: {depth: 0.7, back: DARK, edge: 0}},
  ...N_BAL.flatMap(s => rows(s, 0.85, [[6.3, 8.75], [9.3, 11.5]])),
  ...N_MID.flatMap(s => rows(s, 0.85, N_UP)),
  ...N_MID.filter(inBay).flatMap(s => rows(s, 0.85, [[12.9, 14.2]])),
  ...N_MID.filter(s => !inBay(s)).flatMap(s => rows(s, 1.1, [[13.3, 15.0]], {frame: DARK, depth: 0.25})),
];
const midSeg = (s0: number, s1: number, bay: boolean): Seg => ({s: [s0, s1], bands: bay ? [[99, BROWN]] : [[12.8, BROWN], [99, ZINC]], wins: midWins});
const N: Front = mk('w02-340', [-6.876, -29.522], [-44.152, -15.597], [
  {s: [0, 3.5], bands: [[99, RED]], wins: [
    ...[0.94, 2.3].flatMap(s => rows(s, 0.85, [[4.4, 6.1], [7.3, 9.1], [10.3, 12.0], [13.2, 15.0]], {depth: 0.45})),
    door(1.6, 1.1, DARK, 2.5),
  ]},
  midSeg(3.5, 7.62, false), midSeg(7.62, 14.0, true), midSeg(14.0, 17.9, false), midSeg(17.9, 24.7, true), midSeg(24.7, 29.6, false),
  {s: [29.6, 42.0], bands: [[99, SALMON]], wins: [
    ...rows(32.59, 3.97, S_ROWS, {cols: 5, ...WF}), ...[31.36, 33.73].flatMap(s => rows(s, 1.52, [[16.3, 17.6]], {cols: 2, ...WF})),
    ...[36.18, 38.53].flatMap(s => rows(s, 1.56, [...S_ROWS, [16.3, 17.6]], {cols: 2, ...WF})),
    {s: 32.59, w: 3.97, y: [0.05, 2.5], o: {depth: 0.2, back: TIMBER, edge: 0.06, colsAt: [0.6, 1.2, 1.8, 2.4, 3.0, 3.6]}}, door(35.85, 0.95, DARK, 2.4),
  ]},
], (b, F) => {
  for (const c of N_BAL) for (const y of [6.3, 9.3]) balcony(b, F, c - 0.85, 1.7, 0.8, y, {rail: METAL, slab: METAL, sides: true});
  slab(b, F.f, 32.59, 2.6, 4.4, 0.18, 0.9, LEDGE);
  // copings of the brown front under the zinc storey
  for (const [a, c] of [[3.5, 7.62], [14.0, 17.9], [24.7, 29.6]]) band(b, F, a, c, 12.65, 12.85, 0.12, LEDGE);
});

// ---- west + south-west corner: the glazed plinth (w04-250, w08-160, 2025) ---------------------------------------------
const PLINTH = (s: number, w: number): Win => ({s, w, y: [0.05, 6.25], o: {depth: 0.6, cols: Math.max(2, Math.round(w / 1.1)), rows: 3, frame: DARK, edge: 0.08}});
const UPW: [number, number][] = pitch(8.1, 1.4, 6, 3.08);
const W: Front = mk('w04-250', [-46.552, -12.626], [-36.344, 15.187], [{s: [0, 29.7], bands: [[99, BUFF]], wins: [
  PLINTH(5.8, 4.2), PLINTH(10.85, 4.5), PLINTH(16.1, 4.6), PLINTH(21.4, 4.6), PLINTH(26.9, 4.4),
  ...rows(1.05, 1.7, UPW, {cols: 2, ...WF}), ...[5.3, 10.7, 16.1, 21.5, 26.9].flatMap(s => rows(s, 4.0, UPW, {cols: 5, ...WF})),
]}], (b, F) => {
  for (const s of [8.25, 13.45, 18.75, 24.05]) strut(b, at(F, s, 0.1, 0), at(F, s, 0.1, 6.4), 0.36, LEDGE, 10);
  band(b, F, 0.1, 29.6, 6.4, 6.65, 0.08, LEDGE);
});
const SW: Front = mk('w08-160', [-33.174, 16.014], [-24.204, 12.704], [{s: [0, 9.6], bands: [[99, BUFF]], wins: [
  PLINTH(2.4, 4.2), PLINTH(7.2, 4.2), ...[2.4, 7.2].flatMap(s => rows(s, 4.0, UPW, {cols: 5, ...WF})),
]}], (b, F) => {
  strut(b, at(F, F.len / 2, 0.1, 0), at(F, F.len / 2, 0.1, 6.4), 0.36, LEDGE, 10);
  band(b, F, 0.1, 9.5, 6.4, 6.65, 0.08, LEDGE);
});

// ---- the mews (w03-1 + its inferred east part w05-1): alternating red and buff houses ----------------------------------
function mews(tag: string, a: P2, b: P2, first: number): Front {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 5.4)), w = L / n;
  return mk(tag, a, b, Array.from({length: n}, (_, k) => {
    const s0 = k * w, c = s0 + w / 2;
    return {s: [s0, s0 + w] as [number, number], bands: [[99, (k + first) % 2 ? RED : BUFF]] as [number, Col][], wins: [
      louvre(c - w / 4), {s: c + w / 5, w: 1.5, y: [0.6, 2.8] as [number, number], o: {cols: 2}},
      ...[c - w / 4, c + w / 5].flatMap(s => rows(s, 1.1, pitch(4.2, 1.6, 4), {sill: LEDGE})),
    ]};
  }));
}
const MEWS = [mews('w03-1', [9.815, -0.099], [-28.423, -1.021], 0), mews('w05-1', [47.538, 0.766], [18.217, 0.059], 1), mews('w09-1', [18.258, -1.628], [9.857, -1.831], 0)];
const FRONTS: Front[] = [S, N, W, SW, ...MEWS];

// ---- the shell's walls (machinery from valkenburgerstraat-69-builder.ts) --------------------------------------------------
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
function cut(b: BuildingTools, faceAt: (y: number) => Face, t: number, win: Win) {
  const F = faceAt(win.y[0] + 0.01), w = win.w;
  // windows keep 0.35 m of brick under the wall top (the coping sits there)
  if (win.y[0] < F.y0 - 1e-6 || win.y[1] > F.y1 - 0.35 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.18, frame: 'frame', sill: false, ...win.o});
}
/** Coping on a wall top, lifted 5 cm over the 3DBAG roof line: a closed box (an open band's back edge would be a hole loop). */
const coping = (b: BuildingTools, w: WallInfo) => { if (w.yt - w.yb > 2) slab(b, w.f, w.len / 2, w.yt - 0.15, w.len, 0.2, 0.08, LEDGE); };

function frontWall(b: BuildingTools, w: WallInfo, F: Front, s0: number) {
  for (const seg of F.segs) {
    const p0 = Math.max(0, seg.s[0] - s0), p1 = Math.min(w.len, seg.s[1] - s0);
    if (p1 - p0 < 0.05) continue;
    const faceAt = bandFaces(w, p0, p1, seg.bands);
    const lo = s0 + p0 + 0.08, hi = s0 + p1 - 0.08;
    for (const win of seg.wins) {
      const a = Math.max(lo, win.s - win.w / 2), c = Math.min(hi, win.s + win.w / 2);
      // a window split by a 3DBAG seam keeps only pieces of 0.9 m and more (a narrower sliver read as off the wall)
      if (c - a < (c - a < win.w - 0.01 ? Math.min(0.9, win.w * 0.6) : 0.3)) continue;
      const share = (c - a) / win.w, cols = win.o?.cols ? Math.max(1, Math.round(win.o.cols * share)) : undefined;
      const colsAt = win.o?.colsAt && share < 0.999 ? undefined : win.o?.colsAt;
      cut(b, faceAt, (a + c) / 2 - s0 - p0, {...win, s: (a + c) / 2, w: c - a, o: {...win.o, ...(cols ? {cols} : {}), colsAt}});
    }
  }
  const L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]);
  if (s0 < 0) bandFaces(w, 0, Math.min(w.len, -s0), F.segs[0].bands);
  if (s0 + w.len > L) bandFaces(w, Math.max(0, L - s0), w.len, F.segs[F.segs.length - 1].bands);
  coping(b, w);
}

/** Courtyard and short faces: inferred buff window grid. */
function gridWall(b: BuildingTools, w: WallInfo) {
  const faceAt = bandFaces(w, 0, w.len, [[99, BUFF]]);
  coping(b, w);
  if (w.len < 2.2) return;
  const n = Math.max(1, Math.floor(w.len / 2.9)), p = w.len / n;
  for (const f of [0.6, ...S_FLOORS]) {
    const y0 = f < 1 ? 0.6 : f + 1.0, y1 = f < 1 ? 2.8 : f + 2.5;
    for (let k = 0; k < n; k++) cut(b, faceAt, (k + 0.5) * p, {s: 0, w: Math.min(1.5, p - 0.7), y: [y0, y1], o: {cols: 2, sill: LEDGE}});
  }
}

export function buildTweedeAtjehstraat2(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && w.rect && w.len > 0.3).map(w => w.i));
  const owner = new Map<number, {F: Front; s0: number} | null>(infos.filter((w): w is WallInfo => !!w).map(w => [w.i, frontOf(w)]));
  addShell(b, src as never, {
    wall: BUFF, roof: 'slate',
    skip: (_s, i) => rebuilt.has(i),
    wallFor: (_s, i) => { const o = owner.get(i), w = infos[i]; if (!o || !w) return BUFF; const m = o.s0 + w.len / 2; return (o.F.segs.find(g => m >= g.s[0] && m < g.s[1]) ?? o.F.segs[0]).bands[0][1]; },
  });
  resetFaces();
  const planes = new Map<Front, {sum: number; area: number}>();
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const o = owner.get(w.i);
    if (o && w.yb < 3) {
      frontWall(b, w, o.F, o.s0);
      const d = (w.cx - o.F.a[0]) * o.F.n[0] + (w.cz - o.F.a[1]) * o.F.n[1], area = w.len * (w.yt - w.yb), p = planes.get(o.F) ?? {sum: 0, area: 0};
      planes.set(o.F, {sum: p.sum + d * area, area: p.area + area});
    } else gridWall(b, w);
  }
  flushFaces(b);
  for (const F of FRONTS) {
    const p = planes.get(F);
    if (!F.extra || !p) continue;
    const off = p.sum / p.area, L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]), u: P2 = [(F.b[0] - F.a[0]) / L, (F.b[1] - F.a[1]) / L];
    F.extra(b, {f: {origin: [F.a[0] + F.n[0] * off, F.a[1] + F.n[1] * off], tangent: u, n: F.n}, len: L});
  }
}
