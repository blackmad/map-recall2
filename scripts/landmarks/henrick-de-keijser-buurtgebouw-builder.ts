import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, letters, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {addPolys, face, flushFaces, opening, resetFaces, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './henrick-de-keijser-buurtgebouw-footprints.json';

/**
 * BUURTGEBOUW HENRICK DE KEIJSER, Henrick de Keijserplein 45, De Pijp (BAG pand 0363100012068612; BAG year 1900): a
 * timber hall in the Zaan style on the square, its ground storey clad in dark green overlapping weatherboards, the
 * walls above and the gables in white boarding, under an orange-red pantiled saddle roof with a cross wing to the east;
 * a later low annex in blue panels and red brick on its east side, joined by a light-blue glazed entrance.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (eaves 3.9-4.2 m, ridges 9.2-9.3 m; the annex's mono-pitch 2.9-5.3 m; the
 * entrance link flat at 2.9 m). Rectangular walls and the lower part of every gable are rebuilt as holed faces
 * (modern-front-kit.ts) so the doors and windows sit in reveals; the gable tops are the shell's polygon above the eaves.
 * Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 50 px/m, t from the viewer's left (ringFrame):
 *  - W front on the square (edge 7, w01-258, TMX7316010203-001793_pano_0000_005619, 2020): boards to 2.75 m, white frieze
 *    with two vents, the entrance (t 4.97-8.6) of a two-light window, the red double door and a single light under the
 *    white name board with HENRICK DE KEIJSER in black;
 *  - S gable (edge 8, w05-168, 2019): two three-light windows, two small four-pane windows high in the white gable with
 *    hanging white ornaments, horizontal boarding at the apex, white bargeboards;
 *  - N gable (edge 6, w06-348, 2025): a red-shuttered window and a red door (the gable top hidden by a tree);
 *  - S entrance link (edge 10, w07-167, 2021): the light-blue glazed entrance and its name board;
 *  - annex: red brick SE wall with four narrow windows (edge 12, w04-147, 2019); blue panels with a yellow-green panel
 *    and a grey door, a glazed band under the sloping roof (edge 0, w03-326, 2019/2021).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

const BOARDS: Col = 'green', WHITE: Col = 'concrete', TILE: Col = 'red', BRICK: Col = 'brick', PANEL: Col = 'blue', YELLOW: Col = 'ochre';
const LIGHTBLUE: Col = 'stone', FRAME: Col = 'frame', DOOR: Col = 'pink', INK: Col = 'bronze', GUTTER: Col = 'greyBrick';
const BOARD_TOP = 2.78;

type P2 = [number, number];
type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; rect: boolean; outside: number; tv: P2[]};
/** Wall plane of a 3DBAG wall surface, oriented outward (the lower-roof side); `tv` its outline in (t, y). After albatrospad-1. */
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
  const planar = r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08);
  const rect = Math.abs(area / 2) > 0.985 * len * (yt - yb) && planar;
  return {i, f, len, yb, yt, cx, cz, rect, outside, tv: planar ? r.map((p, k): P2 => [ts[k] - t0, p[1]]) : []};
}

type Line = {f: Frame; len: number};
const edge = (i: number): Line => ringFrame(ring, i);
function lineOf(w: WallInfo) {
  for (let i = 0; i < ring.length; i++) {
    const L = edge(i);
    if (w.f.n[0] * L.f.n[0] + w.f.n[1] * L.f.n[1] < 0.97) continue;
    if (Math.abs((w.cx - L.f.origin[0]) * L.f.n[0] + (w.cz - L.f.origin[1]) * L.f.n[1]) > 0.4) continue;
    const s0 = (w.f.origin[0] - L.f.origin[0]) * L.f.tangent[0] + (w.f.origin[1] - L.f.origin[1]) * L.f.tangent[1];
    if (s0 < -0.5 || s0 + w.len > L.len + 0.5) continue;
    return {edge: i, s0};
  }
  return null;
}

type Opening = {t: number; w: number; y: [number, number]; o?: OpenOpts; door?: boolean};
const span = (t0: number, t1: number, y: [number, number], o: OpenOpts = {}, door = false): Opening => ({t: (t0 + t1) / 2, w: t1 - t0, y, o, door});

/** Openings per facade-ring edge, t from the viewer's left. */
const OPEN: Record<number, Opening[]> = {
  // W front (w01-258): two-light window, red double door with its two tall lights, single light
  7: [span(4.98, 6.46, [0.92, 2.25], {cols: 2}), span(6.48, 7.85, [0.0, 2.25], {cols: 2, back: DOOR, edge: 0.05}, true), span(7.87, 8.6, [0.92, 2.25])],
  // S gable (w05-168): two three-light windows
  // t measured on the crop + 0.64 m: the crop starts 0.64 m in from the SW corner (the windows and gable windows are symmetric about the apex at t 3.67)
  8: [span(1.28, 3.1, [1.08, 2.4], {cols: 3}), span(4.22, 6.08, [1.08, 2.4], {cols: 3})],
  // N gable (w06-348): the window behind closed red shutters, the red door
  6: [span(1.24, 3.06, [1.04, 2.38], {cols: 2, back: DOOR, edge: 0.05}), span(4.56, 5.52, [0.0, 2.38], {back: DOOR, edge: 0.05}, true)],
  // S entrance link (w07-167): the small window in the boards, the glazed entrance in its light-blue frame
  10: [span(0.5, 0.9, [1.3, 2.0]), span(1.7, 2.4, [0.3, 2.45], {frame: LIGHTBLUE, back: 'glass', bars: [1.2]}),
    span(2.5, 4.3, [0.05, 2.45], {cols: 2, frame: LIGHTBLUE, back: LIGHTBLUE, edge: 0.08}, true), span(4.35, 5.05, [0.3, 2.45], {frame: LIGHTBLUE, bars: [1.2]})],
  // annex SE (w04-147): four narrow windows in the brick
  12: [1.65, 2.65, 3.65, 7.57].map(t => ({t, w: 0.32, y: [0.9, 1.9] as [number, number]})),
  // annex NW (w03-326): the window at the left, the grey door in the yellow-green panel
  0: [span(0.75, 2.2, [0.6, 1.6], {cols: 2}), span(4.4, 6.1, [0.0, 2.1], {cols: 2, back: GUTTER, edge: 0.05}, true)],
};

function cut(b: BuildingTools, F: Face, o: Opening, s0: number) {
  const t = o.t - s0, w = o.w;
  if (o.y[0] < F.y0 - 1e-6 || o.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return false;
  opening(b, F, t, o.y[0], w, o.y[1] - o.y[0], {depth: o.door ? 0.2 : 0.12, frame: FRAME, edge: 0.07, sill: o.door ? false : FRAME, ...o.o});
  if (o.door && (o.o?.back === DOOR || o.o?.back === LIGHTBLUE) && w > 1.1) for (const s of [-1, 1]) slab(b, F.f, t + s * w / 4, o.y[0] + 0.85, 0.36, 1.15, 0.02, 'glass', -0.2 + 0.02);
  return true;
}

/** Overlapping weatherboards: a shadowed lap every 0.2 m (w01-258, w05-168: about 13 laps to 2.75 m). */
function laps(b: BuildingTools, F: FR, y0: number, y1: number, holes: Face['holes']) {
  for (let y = y0 + 0.2; y < y1 - 0.05; y += 0.2) {
    const gaps = holes.filter(h => h.y0 - 0.04 < y && y < h.y1 + 0.04).map(h => [h.t0 - 0.05, h.t1 + 0.05]).sort((p, q) => p[0] - q[0]);
    let a = 0;
    for (const [g0, g1] of [...gaps, [F.len, F.len]]) { if (g0 - a > 0.1) ledgeStrip(b, F.f, (a + g0) / 2, y - 0.03, g0 - a, 0.03, 0.035, BOARDS); a = Math.max(a, g1); }
  }
}

/** The part of a (t, y) polygon at or above y = c (one half-plane clip). */
function above(poly: P2[], c: number): P2[] {
  const out: P2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], pin = p[1] >= c, qin = q[1] >= c;
    if (pin) out.push(p);
    if (pin !== qin) { const u = (c - p[1]) / (q[1] - p[1]); out.push([p[0] + u * (q[0] - p[0]), c]); }
  }
  return out;
}

/** Pantile courses on a pitched roof plane: a strip along the contour every 0.33 m down the slope, standing 4 cm proud. */
function courses(b: BuildingTools, s: Surface) {
  const r = s.rings[0].map(p => new T.Vector3(p[0], p[1], p[2]));
  const n = new T.Vector3();
  for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; n.x += (a.y - c.y) * (a.z + c.z); n.y += (a.z - c.z) * (a.x + c.x); n.z += (a.x - c.x) * (a.y + c.y); }
  n.normalize();
  if (n.y < 0) n.negate();
  if (n.y > 0.95 || n.y < 0.3) return; // flat or near-vertical
  const ys = r.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), sinA = Math.sqrt(1 - n.y * n.y), step = 0.33 * sinA;
  for (let y = lo + step; y < hi - step * 0.5; y += step) {
    const pts: T.Vector3[] = [];
    for (let k = 0; k < r.length; k++) { const p = r[k], q = r[(k + 1) % r.length]; if ((p.y < y) !== (q.y < y)) pts.push(p.clone().lerp(q, (y - p.y) / (q.y - p.y))); }
    if (pts.length < 2) continue;
    const dir = pts[1].clone().sub(pts[0]);
    pts.sort((p, q) => p.clone().sub(pts[0]).dot(dir) - q.clone().sub(pts[0]).dot(dir));
    for (let k = 0; k + 1 < pts.length; k += 2) {
      const a = pts[k], c = pts[k + 1], L = a.distanceTo(c);
      if (L < 0.4) continue;
      const g = new T.BoxGeometry(L - 0.1, 0.07, 0.1);
      const x = c.clone().sub(a).normalize(), down = new T.Vector3().crossVectors(n, x).normalize();
      const m = new T.Matrix4().makeBasis(x, down, n).setPosition(a.clone().add(c).multiplyScalar(0.5).addScaledVector(n, 0.02));
      g.applyMatrix4(m);
      b.add(g, TILE);
    }
  }
}

export function buildHenrickDeKeijserBuurtgebouw(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const hidden = new Set(infos.filter((w): w is WallInfo => !!w && w.outside >= w.yt - 0.3).map(w => w.i));
  for (const w of infos) if (w && !hidden.has(w.i) && w.outside > w.yb + 0.3) w.yb = w.outside;
  // rebuilt: rectangles, and planar walls with a peaked or sloped top (gables, the annex's mono-pitch side) from the ground
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && !hidden.has(w.i) && w.len > 0.3 && (w.rect || (w.tv.length > 0 && w.yb < 0.3))).map(w => w.i));
  addShell(b, src as never, {wall: BOARDS, roof: TILE, roofFor: s => (isFlat(s) ? 'slate' : TILE), skip: (_s, i) => rebuilt.has(i)});
  resetFaces();
  const sink0 = getSink();
  setSink(0.1, true);
  const gables: Record<number, GableWall[]> = {};
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const hit = lineOf(w), annex = w.cx > -1.4;
    if (process.env.HK_DEBUG) console.log('wall', w.i, hit?.edge, hit?.s0.toFixed(2), w.len.toFixed(2), w.yb.toFixed(2), w.yt.toFixed(2), w.rect, annex);
    // the eaves: the lowest top vertex of a peaked wall
    const tops = w.tv.filter(p => p[1] > w.yb + 0.5).map(p => p[1]);
    const ye = w.rect ? w.yt : Math.min(...tops);
    const link = hit?.edge === 10 && w.yt < 3.3 && (hit.s0 > 0.5);
    const timber = !annex && !link;
    // the boards reach higher on the gables (w05-168: to about 3.4 m) than on the long W front (2.75 m)
    const lowTop = timber ? Math.min(ye, hit && (hit.edge === 6 || hit.edge === 8) ? 3.4 : BOARD_TOP) : ye;
    const base: Col = timber ? BOARDS : link ? LIGHTBLUE : hit?.edge === 0 ? PANEL : BRICK;
    const F = face({f: w.f, len: w.len}, w.yb, lowTop, base);
    if (hit) for (const o of OPEN[hit.edge] ?? []) cut(b, F, o, hit.s0);
    if (timber) {
      laps(b, F, w.yb, lowTop, F.holes);
      if (ye > lowTop + 0.05) {
        const U = face({f: w.f, len: w.len}, lowTop, ye, WHITE);
        void U;
      }
    }
    // above the eaves: the gable or mono-pitch top in the wall's colour (white on the timber hall)
    if (!w.rect && w.tv.length) {
      const top = above(w.tv, ye);
      if (top.length >= 3) addPolys(b, w.f, [{pts: top.map(([t, y]) => [t, y, 0] as [number, number, number])}], timber ? WHITE : base);
      if (timber) { bargeboards(b, w, ye); if (hit && (hit.edge === 6 || hit.edge === 8)) (gables[hit.edge] ??= []).push({w, s0: hit.s0, ye}); }
      if (hit?.edge === 0) clerestory(b, w);
    }
    if (timber && hit?.edge === 7) westFront(b, w.f, hit.s0, w.len);
    if (timber && w.yt - ye < 0.6) slab(b, w.f, w.len / 2, ye - 0.26, w.len + 0.02, 0.26, 0.06, WHITE); // the eaves board
    if (hit?.edge === 0 && hit.s0 < 3) yellowPanel(b, w.f, hit.s0);
    if (link) { slab(b, w.f, 3.35 - hit!.s0, 2.5, 3.6, 0.32, 0.08, WHITE); letters(b, w.f, 'HENRICK DE KEIJSER', 3.35 - hit!.s0, 2.56, 0.08, 0.016, 0.02, INK, 0.03); }
  }
  for (const e of [6, 8]) gableFace(b, e, gables[e] ?? []);
  flushFaces(b);
  for (const s of src.surfaces) if (s.type === 'RoofSurface' && !isFlat(s) && Math.max(...s.rings[0].map(p => p[1])) > 8) courses(b, s);
  setSink(sink0);
}

function isFlat(s: Surface) {
  const ys = s.rings[0].map(p => p[1]);
  return Math.max(...ys) - Math.min(...ys) < 0.6;
}

/** White bargeboards under every sloped top edge of a gable wall (a 3DBAG gable may come as two half-walls). */
function bargeboards(b: BuildingTools, w: WallInfo, ye: number) {
  const top = above(w.tv, ye);
  for (let k = 0; k < top.length; k++) {
    const p = top[k], q = top[(k + 1) % top.length], dx = q[0] - p[0], dy = q[1] - p[1];
    if (Math.abs(dy) < 0.3 || Math.abs(dx) < 0.2 || Math.min(p[1], q[1]) < ye - 0.01) continue;
    const off = 0.28 * Math.hypot(dx, dy) / Math.abs(dx); // vertical drop of a 0.28 m board measured square to the slope
    const [a, c] = dx > 0 ? [p, q] : [q, p];
    addPolys(b, w.f, [{pts: [[a[0], a[1] - off, 0.08], [c[0], c[1] - off, 0.08], [c[0], c[1], 0.08], [a[0], a[1], 0.08]]}], WHITE);
    addPolys(b, w.f, [{pts: [[a[0], a[1] - off, 0.0], [c[0], c[1] - off, 0.0], [c[0], c[1] - off, 0.08], [a[0], a[1] - off, 0.08]]}], WHITE);
  }
}

type GableWall = {w: WallInfo; s0: number; ye: number};
/** Per gable (edges 6 and 8): horizontal boarding at the apex; on the S gable the two small windows and their ornaments. */
function gableFace(b: BuildingTools, e: number, parts: GableWall[]) {
  if (!parts.length) return;
  const pts = parts.flatMap(g => g.w.tv.map(([t, y]): P2 => [t + g.s0, y]));
  const apex = pts.reduce((p, q) => (q[1] > p[1] ? q : p)), ye = Math.min(...parts.map(g => g.ye));
  const t0 = Math.min(...pts.map(p => p[0])), t1 = Math.max(...pts.map(p => p[0]));
  const host = parts.reduce((p, q) => (q.w.len > p.w.len ? q : p)), f = host.w.f, L = (t: number) => t - host.s0;
  const H = apex[1] - ye;
  if (H < 2) return;
  // apex boarding: horizontal laps over the top 0.4 of the gable (w05-168: from 5.84 m to the apex)
  for (let y = Math.max(5.84, ye + 0.4); y < apex[1] - 0.35; y += 0.22) {
    const u = (apex[1] - y) / H, l = apex[0] - u * (apex[0] - t0) + 0.35, r = apex[0] + u * (t1 - apex[0]) - 0.35;
    if (r - l > 0.4) ledgeStrip(b, f, L((l + r) / 2), y, r - l, 0.035, 0.04, WHITE);
  }
  if (e !== 8) return;
  // the two small four-pane windows (w05-168: t 1.4-2.5 and 3.56-4.66 at 5.3-5.6 m over a 3.25 m eaves; scaled to the shell)
  const yw = 5.3;
  for (const t of [2.59, 4.75]) {
    slab(b, f, L(t), yw - 0.05, 1.12, 0.42, 0.06, FRAME);
    for (const dt of [-0.39, -0.13, 0.13, 0.39]) slab(b, f, L(t + dt), yw + 0.02, 0.2, 0.28, 0.03, 'glass', 0.06);
    // the hanging ornament: a short white bar with a drop (w05-168)
    slab(b, f, L(t), yw - 0.18, 0.9, 0.08, 0.05, FRAME, 0.02);
    slab(b, f, L(t), yw - 0.6, 0.08, 0.42, 0.05, FRAME, 0.02);
  }
}

/** W front details: the name board with its lettering, two frieze vents, the gutter and the downpipes. */
function westFront(b: BuildingTools, f: Frame, s0: number, len: number) {
  const at = (t: number) => t - s0;
  if (at(6.78) < 0 || at(6.78) > len) return;
  slab(b, f, at(6.78), 2.45, 3.62, 0.52, 0.06, WHITE);
  letters(b, f, 'HENRICK DE KEIJSER', at(6.78), 2.56, 0.06, 0.0185, 0.02, INK, 0.036);
  for (const t of [7.6, 10.1]) slab(b, f, at(t), 3.05, 0.5, 0.32, 0.04, FRAME);
  for (const t of [0.8, 10.4]) slab(b, f, at(t), 0.0, 0.09, 3.6, 0.09, GUTTER, 0.02);
}

/** The annex NW side's glazed band under its sloping roof (w03-326): a 0.55 m strip of glass 0.65 m under the roof edge. */
function clerestory(b: BuildingTools, w: WallInfo) {
  const top = above(w.tv, 0).filter(p => p[1] > w.yb + 0.5).sort((p, q) => p[0] - q[0]);
  if (top.length < 2) return;
  const p = top[0], q = top[top.length - 1];
  // each strip is a shallow box on the wall: its front `out` proud, its top and bottom faces running back into the wall
  const band = (d0: number, d1: number, out: number, c: Col) => {
    const a = p[0] + 0.15, z = q[0] - 0.15, k = -0.06;
    addPolys(b, w.f, [
      {pts: [[a, p[1] - d1, out], [z, q[1] - d1, out], [z, q[1] - d0, out], [a, p[1] - d0, out]]},
      {pts: [[a, p[1] - d0, out], [z, q[1] - d0, out], [z, q[1] - d0, k], [a, p[1] - d0, k]]},
      {pts: [[a, p[1] - d1, k], [z, q[1] - d1, k], [z, q[1] - d1, out], [a, p[1] - d1, out]]},
    ], c);
  };
  band(0.2, 0.75, 0.05, 'glass');
  band(0.75, 0.82, 0.07, FRAME);
  band(0.13, 0.2, 0.07, FRAME);
}

/** The yellow-green trapezoid panel around the annex door (w03-326.alt: its left edge slanted, t 3.6-7.1). */
function yellowPanel(b: BuildingTools, f: Frame, s0: number) {
  const t = (x: number) => x - s0;
  // around the door (t 4.4-6.1, to 2.1 m): the slanted left strip, the right strip and the part over the door
  const q = (pts: [number, number][]) => addPolys(b, f, [{pts: pts.map(([x, y]) => [t(x), y, 0.05] as [number, number, number])}], YELLOW);
  q([[3.9, 0.05], [4.3, 0.05], [4.3, 2.2], [3.62, 2.2]]);
  q([[6.2, 0.05], [7.1, 0.05], [7.1, 2.2], [6.2, 2.2]]);
  q([[3.62, 2.2], [7.1, 2.2], [7.1, 3.1], [3.5, 3.1]]);
}
