import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {roofHeightAt, type Frame} from './nearbar-kit';
import {addPolys, band, face, flushFaces, opening, resetFaces, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';

/**
 * Shared machinery for hand-modelled multi-front housing blocks on a 3DBAG LoD2.2 shell (lane hand-blocks-a-20261121),
 * lifted from valkenburgerstraat-69-builder.ts (which keeps its own copy, unchanged): every vertical rectangular wall of the
 * shell is rebuilt as a holed face; a wall on a measured front (`Front`: the crop's wall line from hand-block-walls.ts, in
 * native metres) gets that front's colour bands and openings, `s` metres from the viewer's left of the rectified crop;
 * every other wall (courtyards, walls without a panorama, set-back storeys) gets an inferred window grid. The rest of the
 * shell (roofs, non-rectangular walls) is drawn as it is.
 */
export type P2 = [number, number];
export type Win = {s: number; w: number; y: [number, number]; o?: OpenOpts};
export type Seg = {s: [number, number]; bands: [number, Col][]; wins: Win[]};
export type Front = {tag: string; a: P2; b: P2; n: P2; segs: Seg[]; extra?: (b: BuildingTools, F: FR) => void};
export type Src = {surfaces: Surface[]; nativeRing: number[][]};

export const rows = (s: number, w: number, ys: [number, number][], o?: OpenOpts): Win[] => ys.map(y => ({s, w, y, o}));
/** Openings at each of `ss` (centres), one per row in `ys`. */
export const grid = (ss: number[], w: number, ys: [number, number][], o?: OpenOpts): Win[] => ss.flatMap(s => rows(s, w, ys, o));
/** Storey rows: n rows from sill y0, pitch p, each h tall. */
export const storeys = (y0: number, p: number, n: number, h: number): [number, number][] => Array.from({length: n}, (_, k) => [y0 + k * p, y0 + k * p + h]);
/** A ribbon from s0 to s1 cut into pieces of at most three panes each (pane about `pane` metres). */
export const ribbon = (s0: number, s1: number, y: [number, number], pane = 1.3, o?: OpenOpts): Win[] => {
  const panes = Math.max(1, Math.round((s1 - s0) / pane)), pieces = Math.ceil(panes / 3), w = (s1 - s0) / pieces;
  return Array.from({length: pieces}, (_, k) => {
    const n = Math.round(panes * (k + 1) / pieces) - Math.round(panes * k / pieces);
    return {s: s0 + w * (k + 0.5), w: w - 0.16, y, o: {cols: n, ...o}};
  });
};
export const shop = (s: number, w: number, y: [number, number] = [0.15, 2.95], frame: Col = 'dark'): Win =>
  ({s, w, y, o: {depth: 0.3, cols: Math.min(3, Math.max(1, Math.round(w / 1.6))), frame, edge: 0.08}});
export const door = (s: number, w: number, back: Col, h = 2.4): Win => ({s, w, y: [0.05, h], o: {depth: 0.25, back, frame: 'frame'}});

export type BlockOpts = {
  src: Src; fronts: Front[];
  /** shell colour of unmeasured walls and the grid walls */ wall: Col; roof: Col; ledge: Col;
  /** walls whose foot is above this height (m) are set-back storeys: glazed grid in `setbackColour` */ setbackAbove: number;
  setbackColour?: Col;
  /** inferred grid: storey pitch, first upper sill, window width */ storey?: number; firstSill?: number; gridWin?: number;
  /** opening defaults for measured fronts */ defaults?: OpenOpts;
  /** opening defaults for the inferred grid (absent: the opening's own defaults, a 6 cm frame) */ gridDefaults?: OpenOpts;
  /** walls left plain (no inferred grid): party walls against a neighbour, blank ends. `n` the outward normal (x, z). */
  plain?: (w: {n: P2; cx: number; cz: number; len: number; yb: number; yt: number}) => boolean;
};

type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; rect: boolean; stepTop?: number; stepped?: boolean};
function wallInfo(src: Src, s: Surface, i: number): WallInfo | null {
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
  // a stepped or sloped top over a flat foot spanning the whole wall: the rectangle up to the lowest top vertex is rebuilt,
  // the rest of the ring above it is drawn as shell (the Valkenburgerstraat fix, generalised)
  let stepTop: number | undefined;
  if (!rect && r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08)) {
    const foot = r.map((p, k) => (p[1] < yb + 0.05 ? ts[k] : null)).filter((t): t is number => t !== null);
    const tops = r.filter(p => p[1] >= yb + 0.05).map(p => p[1]);
    if (foot.length >= 2 && Math.min(...foot) < t0 + 0.05 && Math.max(...foot) > t1 - 0.05 && tops.length && Math.min(...tops) - yb > 2.5
      && risesAtBothEnds(r.map((p, k): P2 => [ts[k], p[1]]), t0, t1, yb)) stepTop = Math.min(...tops);
  }
  return {i, f, len, yb, yt, cx, cz, rect, stepTop};
}

/**
 * A stepped wall's rectangle (foot to lowest top vertex) lies inside its ring only when the ring rises at both ends: a
 * top vertex within 5 cm of each end of the foot. A wall that rises from one end only (a 3DBAG triangle under a roof
 * sloping down to its foot: Westerdok 4's court tower, wall 163, 9.93 m foot, 20.78 m apex at one end) is no step: the
 * rectangle drawn to its apex stood clear of the sloped roof edge and left a 42 m open loop. Such a wall stays shell.
 * `pts` are (t along the wall, y) per ring vertex. Every stepped wall of the other hand-block models rises at both ends.
 */
export function risesAtBothEnds(pts: P2[], t0: number, t1: number, yb: number): boolean {
  const up = pts.filter(([, y]) => y >= yb + 0.05).map(([t]) => t);
  return up.some(t => t < t0 + 0.05) && up.some(t => t > t1 - 0.05);
}

/** The front a wall belongs to: facing the same way (within ~14 deg), its plane within 1.2 m of the crop's wall line. */
function frontOf(fronts: Front[], w: WallInfo): {F: Front; s0: number} | null {
  for (const F of fronts) {
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
export const at = (F: FR, s: number, o: number, y: number): [number, number, number] =>
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
function cut(b: BuildingTools, faceAt: (y: number) => Face, t: number, win: Win, defaults: OpenOpts) {
  const F = faceAt(win.y[0] + 0.01), w = win.w;
  if (win.y[0] < F.y0 + 0.05 - 1e-6 || win.y[1] > F.y1 - 0.05 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  // the first opening listed wins where two would touch
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.18, frame: 'frame', sill: false, ...defaults, ...win.o});
}
/** `band` closed at the back too (a box), so it leaves no open boundary loop for the GLB audit. */
export function boxBand(b: BuildingTools, F: FR, t0: number, t1: number, y0: number, y1: number, proj: number, c: Col) {
  band(b, F, t0, t1, y0, y1, proj, c);
  addPolys(b, F.f, [{pts: [[t1, y0, 0], [t0, y0, 0], [t0, y1, 0], [t1, y1, 0]]}], c);
}
/** `boxBand` cut into pieces of at most 12 m (long projecting bands: eaves, fascias, copings). */
export function longBand(b: BuildingTools, F: FR, t0: number, t1: number, y0: number, y1: number, proj: number, c: Col) {
  const n = Math.max(1, Math.ceil((t1 - t0) / 12)), step = (t1 - t0) / n;
  for (let k = 0; k < n; k++) boxBand(b, F, t0 + k * step, t0 + (k + 1) * step, y0, y1, proj, c);
}
/** Proud-panel edges: side and top/bottom returns `proj` out in the panel colour, so a flush colour field reads as a panel. */
export function panelEdges(b: BuildingTools, F: FR, s0: number, s1: number, y0: number, y1: number, c: Col, proj = 0.3) {
  boxBand(b, F, s0, s0 + 0.18, y0 + 0.12, y1 - 0.12, proj, c);
  boxBand(b, F, s1 - 0.18, s1, y0 + 0.12, y1 - 0.12, proj, c);
  longBand(b, F, s0, s1, y1 - 0.12, y1, proj, c);
  longBand(b, F, s0, s1, y0, y0 + 0.12, proj, c);
}
/** Coping band on a rebuilt wall: its top lifted 5 cm over the 3DBAG roof line so it never z-fights the roof. */
const coping = (b: BuildingTools, w: WallInfo, c: Col) => { if (!w.stepped && w.yt - w.yb > 2) longBand(b, frOf(w), 0, w.len, w.yt - 0.2, w.yt + 0.05, 0.08, c); };

function frontWall(b: BuildingTools, w: WallInfo, F: Front, s0: number, o: BlockOpts) {
  for (const seg of F.segs) {
    const p0 = Math.max(0, seg.s[0] - s0), p1 = Math.min(w.len, seg.s[1] - s0);
    if (p1 - p0 < 0.05) continue;
    const faceAt = bandFaces(w, p0, p1, seg.bands);
    const lo = s0 + p0 + 0.08, hi = s0 + p1 - 0.08;
    for (const win of seg.wins) {
      const a = Math.max(lo, win.s - win.w / 2), c = Math.min(hi, win.s + win.w / 2);
      if (c - a < Math.min(0.45, win.w * 0.6)) continue;
      const share = (c - a) / win.w, cols = win.o?.cols ? Math.max(1, Math.round(win.o.cols * share)) : undefined;
      cut(b, faceAt, (a + c) / 2 - s0 - p0, {...win, s: (a + c) / 2, w: c - a, o: {...win.o, ...(cols ? {cols} : {})}}, o.defaults ?? {});
    }
  }
  const L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]);
  if (s0 < 0) bandFaces(w, 0, Math.min(w.len, -s0), F.segs[0].bands);
  if (s0 + w.len > L) bandFaces(w, Math.max(0, L - s0), w.len, F.segs[F.segs.length - 1].bands);
  coping(b, w, o.ledge);
}

function gridWall(b: BuildingTools, w: WallInfo, o: BlockOpts) {
  const setback = w.yb > o.setbackAbove, storey = o.storey ?? 2.9, first = o.firstSill ?? 3.9;
  const faceAt = bandFaces(w, 0, w.len, [[99, setback ? (o.setbackColour ?? o.wall) : o.wall]]);
  if (w.len < 2.2) return;
  if (o.plain?.({n: w.f.n, cx: w.cx, cz: w.cz, len: w.len, yb: w.yb, yt: w.yt})) { coping(b, w, o.ledge); return; }
  const n = Math.max(1, Math.floor(w.len / 2.7)), pitch = w.len / n;
  const floors = setback ? [w.yb + 0.1] : [0.6, ...Array.from({length: 12}, (_, k) => first + storey * k)];
  for (const f of floors) {
    const y0 = setback ? f + 1.0 : f < 1 ? 0.6 : f, y1 = setback ? Math.min(w.yt - 0.3, f + 2.5) : f < 1 ? 2.8 : f + 1.5;
    if (y1 - y0 < 0.8 || y1 > w.yt - 0.4 || y0 < w.yb + 0.1) continue;
    for (let k = 0; k < n; k++) cut(b, faceAt, (k + 0.5) * pitch, {s: 0, w: Math.min(setback ? 2.0 : (o.gridWin ?? 1.5), pitch - 0.6), y: [y0, y1], o: {cols: setback ? 2 : 1}}, o.gridDefaults ?? {});
  }
  coping(b, w, o.ledge);
}

/** The part of a vertical ring at or above height y (Sutherland-Hodgman against one horizontal plane). */
function clipAbove(ring: number[][], y: number): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length], pin = p[1] >= y - 1e-9, qin = q[1] >= y - 1e-9;
    if (pin) out.push(p);
    if (pin !== qin) { const t = (y - p[1]) / (q[1] - p[1]); out.push([p[0] + (q[0] - p[0]) * t, y, p[2] + (q[2] - p[2]) * t]); }
  }
  return out;
}

export function buildHandBlock(b: BuildingTools, o: BlockOpts) {
  const {fronts} = o;
  const raw = o.src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(o.src, s, i) : null));
  // stepped walls: the shell keeps only the ring above the lowest top; the rectangle below is rebuilt
  const surfaces = o.src.surfaces.map((s, i) => { const w = raw[i]; return w?.stepTop !== undefined ? {...s, rings: [clipAbove(s.rings[0], w.stepTop)]} : s; });
  const src: Src = {...o.src, surfaces};
  const infos = raw.map(w => (w?.stepTop !== undefined ? {...w, yt: w.stepTop, rect: true, stepped: true} : w));
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && w.rect && w.len > 0.3).map(w => w.i));
  const drawnInShell = (i: number) => rebuilt.has(i) && infos[i]?.stepped !== true;
  const owner = new Map<number, {F: Front; s0: number} | null>(infos.filter((w): w is WallInfo => !!w).map(w => [w.i, frontOf(fronts, w)]));
  addShell(b, src as never, {
    wall: o.wall as string, roof: o.roof as string,
    skip: (_s, i) => drawnInShell(i),
    wallFor: (_s, i) => { const ow = owner.get(i); return (ow ? ow.F.segs[0].bands[ow.F.segs[0].bands.length - 1][1] : o.wall) as string; },
  });
  resetFaces();
  const planes = new Map<Front, {sum: number; area: number}>();
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const ow = owner.get(w.i);
    if (ow && w.yb < o.setbackAbove) {
      frontWall(b, w, ow.F, ow.s0, o);
      const d = (w.cx - ow.F.a[0]) * ow.F.n[0] + (w.cz - ow.F.a[1]) * ow.F.n[1], area = w.len * (w.yt - w.yb), p = planes.get(ow.F) ?? {sum: 0, area: 0};
      planes.set(ow.F, {sum: p.sum + d * area, area: p.area + area});
    } else gridWall(b, w, o);
  }
  flushFaces(b);
  for (const F of fronts) {
    const p = planes.get(F);
    if (!F.extra || !p) continue;
    const off = p.sum / p.area, L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]), u: P2 = [(F.b[0] - F.a[0]) / L, (F.b[1] - F.a[1]) / L];
    F.extra(b, {f: {origin: [F.a[0] + F.n[0] * off, F.a[1] + F.n[1] * off], tangent: u, n: F.n}, len: L});
  }
}
