import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, put, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {face, flushFaces, opening, resetFaces, sub, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './witte-boei-wittenburg-footprints.json';

/**
 * DE WITTE BOEI, Kleine Wittenburgerstraat 201, Wittenburg (BAG pand 0363100012180557, BAG 1989): the neighbourhood centre
 * of the Wittenburg renewal, a freestanding two-storey block in white glazed brick with ochre-yellow brick bands and thin
 * grey courses, cream-framed two-light windows, two glazed corner "lanterns" on its south-west corners, and a hall in the
 * middle whose clerestory is clad in green vertical panels under a dark fascia.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (two-storey parts 7.1 m, the hall and the two corner towers 8.7 m, the
 * one-storey SW wing 3.7 m, the entrance link 3.45 m, the NW annex 5.7 m). Every rectangular shell wall is rebuilt as a
 * holed face (modern-front-kit.ts) so windows and doors sit in real reveals. Fronts read from rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0) at 50 px/m, t in metres along each facade-ring edge from the viewer's left (ringFrame), y up from
 * the 3DBAG ground (witte-boei-wittenburg-inventory.json has the wall-by-wall evidence):
 *  - NE front (w01-45, b_20250130_0915_Track20_Sphere_00005, 2025): ring edges 16 (t 0-9.0) and 0 (t 9.0-23.1); the green
 *    clerestory spans t 4.75-18.25 from 6.2 to 8.05 m under the dark fascia; eleven ground openings, nine upper windows;
 *  - NW (w03-315 edge 5, w05-315 edge 3, w07-316 edge 1, 2022-2025), SE (w04-135 edge 15, w06-135 edge 12, 2016),
 *    SW one-storey wing (w02-225 edge 6, 2019 + 2016): its left half in grey-mottled brick, three French-door pairs on
 *    the right. The SW upper storey stands 6.2 m back from the wing; its window positions are parallax-blurred in both
 *    SW panoramas and are drawn in the photo's order and spacing (inventory: inferred positions).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

const BRICK: Col = 'brick', BAND: Col = 'ochre', LINE: Col = 'greyBrick', FRAME: Col = 'frame', SILL: Col = 'stone';
const CLAD: Col = 'green', FASCIA: Col = 'bronze', COPE: Col = 'concrete';

type P2 = [number, number];
type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; rect: boolean; outside: number};
/** Wall plane of a 3DBAG wall surface, oriented outward (the side with the lower roof), copied from albatrospad-1-builder.ts. */
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
  const rect = Math.abs(area / 2) > 0.985 * len * (yt - yb) && r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08);
  return {i, f, len, yb, yt, cx, cz, rect, outside};
}

// ---- the measured lines ------------------------------------------------------------------------------------------------

/** A wall line: frame with t from the viewer's left. Facade-ring edges come from ringFrame; the SW upper line is the shell's. */
type Line = {f: Frame; len: number};
const edge = (i: number): Line => ringFrame(ring, i);
/** The SW upper storey (6.2 m behind the wing): from the NW tower corner (-11.0, -6.24) to (0.68, 5.47), facing SW. */
const SW_UPPER: Line = (() => {
  const a: P2 = [-11.0, -6.24], c: P2 = [0.68, 5.47], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const tg: P2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  // facing SW: outward normal (tz, -tx) points to +x+z... pick the one pointing away from the hall centre (2, -3)
  let n: P2 = [-tg[1], tg[0]];
  if ((a[0] - 2) * n[0] + (a[1] + 3) * n[1] < 0) n = [-n[0], -n[1]];
  // viewer's left when facing the wall from outside is where the tangent (n rotated) starts
  const right: P2 = [n[1], -n[0]];
  return right[0] * tg[0] + right[1] * tg[1] > 0 ? {f: {origin: a, tangent: tg, n}, len} : {f: {origin: c, tangent: [-tg[0], -tg[1]], n}, len};
})();

type Opening = {t: number; w: number; y: [number, number]; o?: OpenOpts; door?: boolean; panel?: number};
const W2 = (t0: number, t1: number, y: [number, number], o: OpenOpts = {}): Opening => ({t: (t0 + t1) / 2, w: t1 - t0, y, o: {cols: 2, ...o}});
const G: [number, number] = [0.85, 2.95]; // ground-floor window, NE front
const U: [number, number] = [4.75, 6.1]; // first-floor window
const TALL: [number, number] = [4.65, 7.95]; // two-storey tower window

/** NE front positions (w01-45, 50 px/m from the SE end), on FRONT_LINE. */
const FRONT: Opening[] = [
  W2(2.45, 3.3, G), W2(5.45, 6.3, G), W2(6.85, 7.7, G),
  {t: 10.0, w: 0.5, y: G, o: {bars: [1.25]}},
  {t: 11.52, w: 1.85, y: [0.85, 3.0], o: {cols: 4, bars: [1.15]}},
  {t: 13.05, w: 0.5, y: G, o: {bars: [1.25]}},
  W2(14.05, 14.9, G), W2(15.45, 16.3, G), W2(16.85, 17.7, G),
  {t: 18.85, w: 0.8, y: [2.1, 2.95], o: {back: 'frame', edge: 0.05}},
  W2(19.85, 20.7, G),
  W2(5.45, 6.3, U), W2(6.85, 7.7, U), W2(9.75, 10.65, U), W2(11.05, 11.95, U), W2(12.35, 13.25, U),
  W2(14.35, 15.25, U), W2(15.75, 16.65, U), W2(18.75, 19.7, U), W2(20.2, 21.1, U),
];

/** The glazed corner lantern: three lights, transoms at 4.6 and 6.0, the cream panel row on top (w03-315, w06-135). */
const lantern = (t0: number, t1: number): Opening => ({t: (t0 + t1) / 2, w: t1 - t0, y: [4.3, 8.45], panel: 0.7, o: {cols: (t1 - t0) > 0.9 ? 3 : 2, bars: [0.3, 1.7, 3.45], edge: 0.09}});

const OPEN: Record<string, Opening[]> = {
  // NW: edge 5 (w03-315): the tower (t 0-4.3) with its tall window and lantern, then the one-storey wing
  e5: [W2(1.75, 2.65, TALL, {bars: [1.75]}), lantern(3.2, 4.15), W2(1.8, 2.75, [0.65, 3.0]), W2(3.2, 4.15, [0.65, 3.0]),
    {t: 7.25, w: 1.5, y: [0.65, 3.0], o: {cols: 3}}, {t: 9.45, w: 1.5, y: [0.65, 3.0], o: {cols: 3}}],
  // edge 3 (w05-315): the service door, the meter cupboard and a narrow window
  e3: [{t: 4.25, w: 1.0, y: [0.0, 2.35], door: true, o: {back: 'frame', edge: 0.06}}, {t: 2.85, w: 1.05, y: [1.9, 2.55], o: {back: 'frame', edge: 0.04}},
    {t: 4.45, w: 0.4, y: [3.25, 5.0]}],
  // edge 1 (w07-316): the five-light window with the door in its middle, two louvres high up
  e1: [{t: 2.05, w: 2.4, y: [0.7, 2.95], o: {cols: 5, bars: [1.6]}}, {t: 1.25, w: 1.0, y: [6.35, 6.65], o: {back: 'dark', cols: 1, rows: 3, edge: 0.04}},
    {t: 3.45, w: 1.0, y: [6.35, 6.65], o: {back: 'dark', cols: 1, rows: 3, edge: 0.04}}],
  // SW wing (edge 6, w02-225): narrow pair, two three-light windows, three French-door pairs with transom lights
  e6: [{t: 0.7, w: 0.5, y: [0.7, 2.9]}, {t: 1.6, w: 0.5, y: [0.7, 2.9]},
    {t: 3.75, w: 1.5, y: [0.7, 2.95], o: {cols: 3}}, {t: 6.1, w: 1.5, y: [0.7, 2.95], o: {cols: 3}},
    ...[11.35, 13.4, 15.47].map(t => ({t, w: 1.25, y: [0.05, 2.95] as [number, number], door: true, o: {cols: 2, bars: [2.3], back: 'glass' as Col}}))],
  // SW upper storey (inferred positions, see header)
  swu: [lantern(0.1, 1.05), W2(2.4, 3.1, TALL, {bars: [1.75]}), W2(5.6, 6.35, U), W2(7.6, 8.35, U), {t: 10.3, w: 1.2, y: U, o: {cols: 3}}, W2(12.1, 12.85, U), W2(14.3, 15.05, U)],
  // SE: edge 12 (w06-135): lantern at the SW corner, the tall window, two ground windows; edge 11 (the lantern's return)
  e12: [lantern(0.1, 1.45), W2(1.95, 2.9, TALL, {bars: [1.75]}), W2(0.45, 1.4, [0.75, 2.95]), W2(1.95, 2.9, [0.75, 2.95])],
  e11: [lantern(1.8, 3.15)],
  // entrance (edge 13, w06-135 contact: the glazed door right of the flag)
  e13: [{t: 0.85, w: 1.0, y: [0.0, 2.6], door: true, o: {bars: [2.15], edge: 0.07}}],
  // edge 15 (w04-135): the side door, a narrow window, the wide four-light window, three upper windows
  e15: [{t: 0.82, w: 0.85, y: [0.0, 2.4], door: true, o: {back: 'frame', edge: 0.05}}, {t: 2.17, w: 0.5, y: [0.75, 2.95], o: {bars: [1.1]}},
    {t: 4.57, w: 2.25, y: [0.75, 3.0], o: {colsAt: [0.6, 1.15, 1.6], bars: [1.25]}},
    W2(0.25, 1.05, U), W2(2.05, 2.85, U), W2(4.85, 5.65, U)],
};
/** The grey-mottled brick of the SW wing's left half (w02-225: t 2.1-8.9, sampled against the white above it). */
const GREY_PANEL: {key: string; t: [number, number]; y: [number, number]}[] = [{key: 'e6', t: [2.1, 8.9], y: [0.0, 3.2]}];

/** Yellow bands and grey courses (w01-45, w03-315, w06-135): heights over the 3DBAG ground. */
const BANDS: {y0: number; y1: number; c: Col}[] = [
  {y0: 0.6, y1: 0.75, c: BAND}, {y0: 2.95, y1: 3.02, c: LINE}, {y0: 4.5, y1: 4.65, c: BAND}, {y0: 6.3, y1: 6.36, c: LINE}, {y0: 7.8, y1: 7.95, c: BAND},
];

// ---- matching rebuilt walls to lines ----------------------------------------------------------------------------------

/** The NE front: ring edges 16 and 0 are collinear (9.0 + 14.1 m); t from the SE end as in w01-45. */
const FRONT_LINE: Line = {f: edge(16).f, len: 23.1};
function lines(): {key: string; L: Line}[] {
  const out = ring.map((_, i) => ({key: `e${i}`, L: edge(i)})).filter(l => l.key !== 'e16' && l.key !== 'e0');
  out.push({key: 'front', L: FRONT_LINE}, {key: 'swu', L: SW_UPPER});
  return out;
}
/** The hall's roof outline (3DBAG 8.7 m roof between the two-storey parts): S, E, N and W corners. */
const HALL: P2[] = [[5.3, 3.79], [11.59, -3.45], [2.54, -12.45], [-4.29, -6.05]];
function onHall(w: WallInfo) {
  const mx = w.cx, mz = w.cz;
  return HALL.some((p, k) => {
    const q = HALL[(k + 1) % HALL.length], dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz;
    const u = Math.max(0, Math.min(1, ((mx - p[0]) * dx + (mz - p[1]) * dz) / L2));
    return Math.hypot(p[0] + u * dx - mx, p[1] + u * dz - mz) < 0.6;
  });
}
/** Line a wall lies on (same outward normal, plane within 0.4 m) and the wall's t offset along it. */
function lineOf(w: WallInfo, ls: {key: string; L: Line}[]) {
  for (const {key, L} of ls) {
    if (w.f.n[0] * L.f.n[0] + w.f.n[1] * L.f.n[1] < 0.97) continue;
    const dPlane = (w.cx - L.f.origin[0]) * L.f.n[0] + (w.cz - L.f.origin[1]) * L.f.n[1];
    if (Math.abs(dPlane) > 0.4) continue;
    const s0 = (w.f.origin[0] - L.f.origin[0]) * L.f.tangent[0] + (w.f.origin[1] - L.f.origin[1]) * L.f.tangent[1];
    if (s0 < -0.5 || s0 + w.len > L.len + 0.5) continue;
    return {key, s0};
  }
  return null;
}

function cut(b: BuildingTools, F: Face, o: Opening, s0: number) {
  const t = o.t - s0, w = o.w;
  if (o.y[0] < F.y0 - 1e-6 || o.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return false;
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < o.y[1] + 0.05 && o.y[0] - 0.05 < h.y1)) return false;
  const depth = o.door ? 0.22 : 0.12;
  opening(b, F, t, o.y[0], w, o.y[1] - o.y[0], {depth, frame: FRAME, edge: 0.09, sill: o.door || o.y[0] < 0.3 ? false : SILL, ...o.o});
  if (o.panel) slab(b, F.f, t, o.y[1] - o.panel, w - 0.12, o.panel - 0.06, 0.02, FRAME, -depth + 0.025); // the lantern's cream top panels
  if (o.door && o.o?.back === 'frame' && w < 1.1) slab(b, F.f, t, o.y[0] + 0.5, 0.12, o.y[1] - o.y[0] - 0.9, 0.03, 'glass', -depth); // the door's narrow light
  return true;
}

/** Bands over a face, broken where an opening's reveal crosses them. */
function bands(b: BuildingTools, F: Face, clad?: [number, number]) {
  for (const B of BANDS) {
    if (B.y0 < F.y0 + 0.05 || B.y1 > F.y1 - 0.15) continue;
    const gaps = F.holes.filter(h => h.y0 < B.y1 + 0.08 && B.y0 - 0.08 < h.y1).map(h => [h.t0 - 0.06, h.t1 + 0.06]);
    // no brick band behind the clerestory's cladding
    if (clad && B.y0 > 6.1 && clad[1] > clad[0]) gaps.push([clad[0], clad[1]]);
    gaps.sort((p, q) => p[0] - q[0]);
    let a = 0;
    for (const [g0, g1] of [...gaps, [F.len, F.len]]) {
      if (g0 - a > 0.08) ledgeStrip(b, F.f, (a + g0) / 2, B.y0, g0 - a, B.y1 - B.y0, 0.05, B.c);
      a = Math.max(a, g1);
    }
  }
}

/** The hall's clerestory on the NE front: green panels with standing seams at 0.5 m, the dark fascia, the coping under it. */
function clerestory(b: BuildingTools, F: Face, s0: number) {
  const a = Math.max(4.75, s0) - s0, c = Math.min(18.25, s0 + F.len) - s0;
  if (c - a < 0.3 || F.y1 < 8.0) return;
  slab(b, F.f, (a + c) / 2, 6.2, c - a, 1.85, 0.06, CLAD);
  for (let x = Math.ceil((s0 + a) / 0.5) * 0.5; x < s0 + c - 0.1; x += 0.5) ledgeStrip(b, F.f, x - s0, 6.25, 0.06, 1.75, 0.05, FASCIA, 0.06);
  ledgeStrip(b, F.f, (a + c) / 2, 6.12, c - a, 0.1, 0.1, COPE);
  slab(b, F.f, (a + c) / 2, 8.05, c - a, F.y1 - 8.05 + 0.06, 0.12, FASCIA);
}

export function buildWitteBoeiWittenburg(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const hidden = new Set(infos.filter((w): w is WallInfo => !!w && w.outside >= w.yt - 0.3).map(w => w.i));
  for (const w of infos) if (w && !hidden.has(w.i) && w.outside > w.yb + 0.3) w.yb = w.outside;
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && !hidden.has(w.i) && w.rect && w.len > 0.3).map(w => w.i));
  // walls standing on the 7.1 m roofs (the hall above its neighbours) are its dark zinc upper walls (w02-225.alt)
  addShell(b, src as never, {wall: BRICK, roof: 'slate', skip: (_s, i) => rebuilt.has(i)});
  resetFaces();
  const sink0 = getSink();
  setSink(0.1, true);
  const ls = lines();
  const missed: string[] = [];
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const hit = lineOf(w, ls);
    if (process.env.WB_DEBUG) console.log('face', w.i, hit?.key, hit?.s0.toFixed(2), w.len.toFixed(2), w.yb.toFixed(2), w.yt.toFixed(2), w.f.n.map(v => v.toFixed(2)).join(','));
    const front = hit?.key === 'front';
    const upperHall = w.yb > 6.9 && !front && onHall(w);
    const F = face({f: w.f, len: w.len} as FR, w.yb, w.yt, upperHall ? FASCIA : BRICK);
    if (!upperHall) {
      const list = hit ? (front ? FRONT : OPEN[hit.key] ?? []) : [];
      for (const o of list) if (!cut(b, F, o, hit!.s0) && o.t - hit!.s0 > 0 && o.t - hit!.s0 < w.len && o.y[0] >= w.yb && o.y[1] <= w.yt) missed.push(`${hit!.key}@${o.t}`);
      bands(b, F, front && w.yt > 8 ? [Math.max(4.75 - hit!.s0, 0) - 0.05, Math.min(18.25 - hit!.s0, w.len) + 0.05] : undefined);
    }
    if (w.outside < w.yt - 0.3 && !(front && w.yt > 8)) slab(b, F.f, w.len / 2, w.yt - 0.1, w.len + 0.04, 0.16, 0.06, upperHall ? FASCIA : COPE);
    if (!hit) continue;
    for (const g of GREY_PANEL) if (g.key === hit.key) {
      const a = Math.max(g.t[0] - hit.s0, 0), c = Math.min(g.t[1] - hit.s0, w.len);
      if (c - a > 0.2) {
        // the grey brick between the openings and over the bands' gaps (a thin cladding of the measured tone)
        const gaps = F.holes.map(h => [h.t0 - 0.02, h.t1 + 0.02]).filter(([p, q]) => q > a && p < c).sort((p, q) => p[0] - q[0]);
        let x = a;
        for (const [p, q] of [...gaps, [c, c]]) { if (p - x > 0.05) ledgeStrip(b, F.f, (x + p) / 2, g.y[0] + 0.76, p - x, 2.93 - g.y[0] - 0.76, 0.05, 'greyBrick'); x = Math.max(x, q); }
      }
    }
    if (front) clerestory(b, F, hit.s0);
    // the SW wing's dark fascia (w02-225: the grey band over the wing)
    if (hit.key === 'e6') ledgeStrip(b, F.f, w.len / 2, 3.25, w.len, 0.33, 0.08, LINE);
  }
  flushFaces(b);
  // the vent dome on the hall roof (w01-45: over t 11.5, behind the fascia)
  const fr = FRONT_LINE.f;
  const dome = new T.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  put(b, fr, dome, 11.5, 8.82, -1.6, COPE);
  slab(b, fr, 11.5, 8.62, 0.64, 0.2, 0.64, COPE, -1.92);
  setSink(sink0);
  if (missed.length) console.warn('witte-boei: openings that found no face', missed.join(' '));
}
