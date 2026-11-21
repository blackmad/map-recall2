import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, roofHeightAt, type Frame} from './nearbar-kit';
import {band, face, flushFaces, opening, resetFaces, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './albatrospad-1-footprints.json';

/**
 * ALBATROSPAD 1-144 (+ the NE street; BAG pand 0363100012150906, 2006): a perimeter block of housing in one dark
 * purple-grey brick (hand-blocks-b-20261121). Massing: the 3DBAG LoD2.2 shell (albatrospad-1-footprints.json,
 * bag-shell-prepare.ts): 11-storey towers (32.7 m) over a 4-storey (12.4 m) street wing and 2-storey courtyard wings.
 * Every vertical rectangular wall is rebuilt as a holed face (modern-front-kit.ts) in the one system the rectified Gemeente
 * Amsterdam panoramas (CC BY 4.0) show on all four sides (albatrospad-1-inventory.json):
 *  - NE (w01-33, 2022 + 2025): a 3.6 m ground storey of timber-framed glazing with lime-green panels and the stair numbers,
 *    red residential doors, and an orange-framed two-storey entrance portal under the left tower;
 *  - upper storeys at 2.9 m: punched French windows in red-brown frames with a low metal rail, singles and pairs in an
 *    irregular rhythm, deep reveals;
 *  - white-framed glazed corner stacks (three storeys) at the top of the towers and a five-storey glazed stack on the long
 *    tower faces (w04-123 2025, w01-33);
 *  - SE (w04-123): the same ground glazing and green panels.
 * The triage row's "pitched dormer row / painted red block / curved-eave pavilion" is the 1920s houses in front of the SW
 * crop (w02-213), not this pand.
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

const BRICK: Col = 'brick', LEDGE: Col = 'concrete', DARK: Col = 'dark', PANEL: Col = 'green', TIMBER: Col = 'ochre';
const PORTAL: Col = 'copper', RAIL: Col = 'bronze', WHITEFRAME: Col = 'stone';

type P2 = [number, number];
type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; rect: boolean; outside: number};
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
  const outside = Math.min(front, back);
  const tangent: P2 = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts), t1 = Math.max(...ts), len = t1 - t0;
  const off = cx * n[0] + cz * n[1];
  const f: Frame = {origin: [tangent[0] * t0 + n[0] * off, tangent[1] * t0 + n[1] * off], tangent, n};
  let area = 0;
  for (let k = 0; k < r.length; k++) { const c = (k + 1) % r.length; area += ts[k] * r[c][1] - ts[c] * r[k][1]; }
  // rectangular up to collinear extra vertices on its edges (3DBAG splits long walls at neighbouring roof seams)
  const rect = Math.abs(area / 2) > 0.985 * len * (yt - yb) && r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08);
  return {i, f, len, yb, yt, cx, cz, rect, outside};
}

const frOf = (w: WallInfo): FR => ({f: w.f, len: w.len});
type Win = {t: number; w: number; y: [number, number]; o?: OpenOpts};
function cut(b: BuildingTools, F: Face, win: Win) {
  const {t, w} = win;
  if (win.y[0] < F.y0 - 1e-6 || win.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.15 || t + w / 2 > F.len - 0.15) return false;
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return false;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.2, frame: 'frame', sill: false, ...win.o});
  return true;
}

// The NE street line (w01-33): SE end (viewer's left) to NW end, outward normal NE. The entrance portal is measured on it.
const NE_A: P2 = [24.0, 0.3], NE_B: P2 = [-64.0, -56.2], NE_N: P2 = [0.540, -0.841];
const NE_U: P2 = [(NE_B[0] - NE_A[0]) / 104.6, (NE_B[1] - NE_A[1]) / 104.6];
/** Position of a wall's local t=0 along the NE line, or null when the wall is not on it. */
function onNE(w: WallInfo): number | null {
  if (w.f.n[0] * NE_N[0] + w.f.n[1] * NE_N[1] < 0.97) return null;
  if (Math.abs((w.cx - NE_A[0]) * NE_N[0] + (w.cz - NE_A[1]) * NE_N[1]) > 1.5) return null;
  return (w.f.origin[0] - NE_A[0]) * NE_U[0] + (w.f.origin[1] - NE_A[1]) * NE_U[1];
}
/** Local t on wall w of the point s metres along the NE line (the frame's tangent may run either way along it). */
const neLocal = (w: WallInfo, s0: number, s: number) => (w.f.tangent[0] * NE_U[0] + w.f.tangent[1] * NE_U[1] > 0 ? s - s0 : s0 - s);

const GROUND = 3.6, STOREY = 2.9;
/** Deterministic pseudo-random per wall and bay (the photos' rhythm of singles and pairs is irregular, not a grid). */
const hash = (a: number, c: number) => { const x = Math.sin(a * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };

function systemWall(b: BuildingTools, w: WallInfo) {
  const F = face(sub(frOf(w), 0, w.len), w.yb, w.yt, BRICK);
  const tall = w.yt > 30, ne = onNE(w);
  // ground storey: glazing in timber frames, lime-green panels, red doors; on the NE street the orange portal
  if (w.yb < 0.5 && w.len > 5) {
    if (ne !== null) {
      const sPortal = neLocal(w, ne, 41.0);
      if (sPortal > 2.5 && sPortal < w.len - 2.5) cut(b, F, {t: sPortal, w: 4.4, y: [0.05, 5.6], o: {depth: 0.9, frame: PORTAL, edge: 0.25, cols: 2, bars: [3.1]}});
    }
    const n = Math.max(1, Math.round(w.len / 3.4)), pitch = w.len / n;
    for (let k = 0; k < n; k++) {
      const h = hash(w.i, k), t = (k + 0.5) * pitch;
      if (h < 0.18) cut(b, F, {t, w: Math.min(1.1, pitch - 0.5), y: [0.05, 2.5], o: {depth: 0.25, back: 'red', frame: 'frame'}});
      else cut(b, F, {t, w: pitch - 0.35, y: [0.15, 3.25], o: {depth: 0.15, frame: TIMBER, cols: 2, ...(h > 0.86 ? {back: PANEL, edge: 0.06} : {})}});
    }
    band(b, frOf(w), 0, w.len, GROUND - 0.05, GROUND + 0.05, 0.04, DARK, [false, false]);
  }
  const floors: number[] = [];
  for (let f = GROUND; f + STOREY <= w.yt + 0.05; f += STOREY) if (f >= w.yb - 0.05) floors.push(f);
  // glazed stacks: the top three storeys at the tower's right end, and a five-storey stack on long tower faces
  if (tall && w.len >= 8.5) {
    const sw = Math.min(4.6, w.len * 0.42), top = floors.slice(-3);
    if (top.length === 3) cut(b, F, {t: w.len - sw / 2 - 0.6, w: sw, y: [top[0] + 0.15, top[2] + STOREY - 0.35], o: {depth: 0.15, frame: WHITEFRAME, cols: 2, rows: 3}});
    if (w.len >= 20) {
      const mid = floors.filter(f => f > GROUND + 2 && f < GROUND + 2 + 5 * STOREY);
      if (mid.length >= 3) cut(b, F, {t: w.len * 0.62, w: 4.6, y: [mid[0] + 0.15, mid[mid.length - 1] + STOREY - 0.35], o: {depth: 0.15, frame: WHITEFRAME, cols: 2, rows: mid.length}});
    }
  }
  // upper storeys: French windows, singles (with a low rail) and pairs, at a 2.5 m bay pitch
  const bays = Math.max(1, Math.floor((w.len - 0.6) / 2.5)), pitch = (w.len - 0.6) / bays;
  for (const f of floors) {
    if (f + 2.6 > w.yt - 0.3) continue;
    for (let k = 0; k < bays; k++) {
      const h = hash(w.i * 7 + Math.round(f), k);
      if (h < 0.2) continue;
      const ww = h > 0.78 ? Math.min(1.7, pitch - 0.45) : 0.95, t = 0.3 + (k + 0.5) * pitch;
      if (ww < 0.6) continue;
      if (cut(b, F, {t, w: ww, y: [f + 0.25, f + 2.4], o: ww > 1.2 ? {cols: 2} : {}}) && ww < 1.2) ledgeStrip(b, F.f, t, f + 1.15, ww, 0.05, 0.03, RAIL, -0.06); // spans the reveal, jamb to jamb
    }
  }
  // coping: a proud strip ending at the roof edge (no top face, so nothing sits on the 3DBAG roof plane)
  if (w.yt - w.yb > 2) band(b, frOf(w), 0, w.len, w.yt - 0.2, w.yt, 0.06, LEDGE, [false, false]);
}

export function buildAlbatrospad1(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  // the shell is two 3DBAG BuildingParts: a wall with the other part's roof at or over its top is a party wall, kept as
  // the plain shell (it closes both parts) and never given windows;
  // one standing over a lower roof of the other part shows only above that roof
  const hidden = new Set(infos.filter((w): w is WallInfo => !!w && w.outside >= w.yt - 0.3).map(w => w.i));
  for (const w of infos) if (w && !hidden.has(w.i) && w.outside > w.yb + 0.3) w.yb = w.outside;
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && !hidden.has(w.i) && w.rect && w.len > 0.3).map(w => w.i));
  addShell(b, src as never, {wall: BRICK, roof: 'slate', skip: (_s, i) => rebuilt.has(i)});
  resetFaces();
  for (const w of infos) if (w && rebuilt.has(w.i)) systemWall(b, w);
  flushFaces(b);
}
