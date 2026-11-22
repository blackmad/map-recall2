import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, letters, put, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {addPolys, face, flushFaces, opening, resetFaces, type Col, type Face, type OpenOpts} from './modern-front-kit';
import source from './archipel-makassarplein-footprints.json';

/**
 * BUURTHUIS ARCHIPEL, Makassarplein (Indische Buurt; BAG pand 0363100012161696, BAG year 1926): a U of low flat-roofed
 * red-brick pavilions round a black-boarded hall. The north range on the square has two brick wings with round porthole
 * windows either side of a dark-framed glazed entrance, and over it the hall's grey roof with a fan lunette; the hall's
 * west side carries the name ARCHIPEL in lime letters over a recessed glazed entrance with a yellow porch wall.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (pavilions 3.2-4.3 m; the hall roof one plane rising from about 3.8 m at the
 * north to 7.5 m at its south-west corner). Rectangular walls and the lower part of the sloped-top hall walls are rebuilt
 * as holed faces (modern-front-kit.ts). Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 50 px/m,
 * t from the viewer's left (ringFrame):
 *  - N range (edges 1, 3, 5; w01-359, TMX7316010203-001693_pano_0000_001763, 2020): window and porthole per wing, the
 *    entrance's six glazed bays and door, the fan lunette over it;
 *  - W wing end (edge 6, w02-284, TMX7316010203-002140_pano_0001_001104, 2021): three windows and a glazed door unit;
 *  - E wing end (edge 12, w03-74, 2022): a glazed double door (the rest hidden by the substation in front);
 *  - E wing S end (edge 11, w08-179, 2021): a door and light;
 *  - hall W side (edge 8, w04-254, TMX7316010203-002140_pano_0001_001107, 2021): the recessed porch, ARCHIPEL;
 *  - hall E side (edge 10, w05-104, recording_2025-09-26_07-29-39_00374, 2025): a wood-framed three-light glazed unit.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

const BRICK: Col = 'brick', HALL: Col = 'bronze', FASCIA: Col = 'concrete', FRAME: Col = 'frame', WOOD: Col = 'white';
const YELLOW: Col = 'ochre', LIME: Col = 'green', HALL_ROOF: Col = 'stone', FLAT_ROOF: Col = 'slate';
const HALL_EDGES = new Set([8, 9, 10]);

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

function lineOf(w: WallInfo) {
  for (let i = 0; i < ring.length; i++) {
    const L = ringFrame(ring, i);
    if (w.f.n[0] * L.f.n[0] + w.f.n[1] * L.f.n[1] < 0.97) continue;
    if (Math.abs((w.cx - L.f.origin[0]) * L.f.n[0] + (w.cz - L.f.origin[1]) * L.f.n[1]) > 0.4) continue;
    const s0 = (w.f.origin[0] - L.f.origin[0]) * L.f.tangent[0] + (w.f.origin[1] - L.f.origin[1]) * L.f.tangent[1];
    if (s0 < -0.5 || s0 + w.len > L.len + 1.2) continue; // the E end's 3DBAG wall runs on over the short edge 0
    return {edge: i, s0};
  }
  return null;
}

/** The part of a (t, y) polygon at or below y = c. */
function below(poly: P2[], c: number): P2[] {
  const out: P2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], pin = p[1] <= c, qin = q[1] <= c;
    if (pin) out.push(p);
    if (pin !== qin) { const u = (c - p[1]) / (q[1] - p[1]); out.push([p[0] + u * (q[0] - p[0]), c]); }
  }
  return out;
}
function above(poly: P2[], c: number): P2[] {
  return below(poly.map(([t, y]) => [t, -y]), -c).map(([t, y]) => [t, -y]);
}

type Opening = {t: number; w: number; y: [number, number]; o?: OpenOpts; door?: boolean};
const span = (t0: number, t1: number, y: [number, number], o: OpenOpts = {}, door = false): Opening => ({t: (t0 + t1) / 2, w: t1 - t0, y, o, door});
const W = (t0: number, t1: number, y: [number, number], o: OpenOpts = {}) => span(t0, t1, y, o);
const D = (t0: number, t1: number, y: [number, number], o: OpenOpts = {}) => span(t0, t1, y, o, true);

/** Openings per facade-ring edge, t from the viewer's left. */
const OPEN: Record<number, Opening[]> = {
  // N range, E wing (w01-359 t 0-8.3): a tall window
  1: [W(2.7, 3.95, [0.8, 2.5], {cols: 1, bars: [1.2]})],
  // N range, entrance (w01-359 t 8.6-14.4): six glazed bays and the double door in dark frames
  3: [W(0.35, 1.15, [0.7, 2.1]), W(1.2, 1.9, [0.7, 2.1]), D(2.05, 3.35, [0, 2.1], {cols: 2}), W(3.9, 4.6, [0.4, 2.1]), W(4.6, 5.3, [0.7, 2.1])],
  // N range, W wing (w01-359 t 14.3-22.6)
  5: [W(4.8, 6.4, [0.8, 2.5], {cols: 1, bars: [1.2]})],
  // W wing end (w02-284): three windows, the glazed door unit (side light, door, door and panel)
  6: [W(0.72, 1.56, [1.06, 2.7]), W(1.96, 2.82, [1.06, 2.7]), W(3.2, 4.0, [1.06, 2.7]), D(4.72, 7.56, [0, 2.7], {cols: 3, edge: 0.07})],
  // E wing S end (w08-179): the door and its light
  11: [D(3.7, 5.4, [0, 2.5], {cols: 2})],
  // E wing E end (w03-74): the glazed double door
  12: [D(5.8, 7.3, [0, 2.45], {cols: 2})],
  // hall W side (w04-254): the yellow porch wall, then the glazed porch front in wood frames
  8: [D(0.8, 1.8, [0, 2.6], {back: YELLOW, frame: WOOD, edge: 0.08}), D(1.85, 6.3, [0, 2.6], {cols: 4, frame: WOOD, edge: 0.08, depth: 0.6})],
  // hall E side (w05-104): the three-light glazed unit in wood frames
  10: [D(1.8, 4.8, [0, 2.45], {cols: 3, frame: WOOD, edge: 0.08})],
};
/** Round porthole windows (w01-359): centre t on the edge, centre height, diameter. */
const PORTHOLES: Record<number, [number, number, number][]> = {1: [[6.3, 1.74, 1.1]], 5: [[2.46, 1.74, 1.1]]};

function cut(b: BuildingTools, F: Face, o: Opening, s0: number) {
  const t = o.t - s0, w = o.w;
  // a glazed door stands on a 15 cm threshold: glass down to the face foot reads as past the wall silhouette in the openings gate
  if (o.y[0] < 0.01) o = {...o, y: [F.y0 + 0.15, o.y[1]]};
  if (o.y[0] < F.y0 - 1e-6 || o.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return false;
  opening(b, F, t, o.y[0], w, o.y[1] - o.y[0], {depth: o.door ? 0.2 : 0.12, frame: FRAME, edge: 0.06, sill: o.door ? false : FRAME, ...o.o});
  return true;
}

function porthole(b: BuildingTools, f: Frame, t: number, y: number, d: number) {
  const r = d / 2;
  const ringShape = new T.Shape().absarc(0, 0, r + 0.1, 0, Math.PI * 2, false);
  ringShape.holes.push(new T.Path().absarc(0, 0, r - 0.02, 0, Math.PI * 2, true));
  put(b, f, new T.ExtrudeGeometry(ringShape, {depth: 0.13, bevelEnabled: false, curveSegments: 10}).translate(0, 0, -0.02), t, y, 0, FRAME);
  put(b, f, new T.CircleGeometry(r, 20).translate(0, 0, 0.05), t, y, 0, 'glass');
  slab(b, f, t, y - 0.03, d - 0.05, 0.06, 0.04, FRAME, 0.05);
}

/** The fan lunette over the entrance (w01-359): a half-round dormer standing on the hall roof's low north edge, glazed in rays. */
function lunette(b: BuildingTools) {
  const f: Frame = {origin: [-1.2, 2.12], tangent: [-1, 0], n: [0, -1]}, r = 1.75, y0 = 4.3, deep = 1.8;
  const half = new T.Shape().absarc(0, 0, r + 0.12, 0, Math.PI, false);
  // the dormer body in the hall's black boarding (its front the wall the glass sits on), under a grey skin 4 cm larger and set 8 cm back
  put(b, f, new T.ExtrudeGeometry(half, {depth: deep, bevelEnabled: false, curveSegments: 16}).translate(0, 0, -deep), 0, y0, -0.035, HALL);
  put(b, f, new T.ExtrudeGeometry(new T.Shape().absarc(0, 0, r + 0.16, 0, Math.PI, false), {depth: deep - 0.1, bevelEnabled: false, curveSegments: 16}).translate(0, 0, -deep), 0, y0, -0.12, HALL_ROOF);
  // its plinth down to the flat roof (w01-359: the fan stands on a black band over the entrance roof)
  slab(b, f, 0, 3.3, 2 * r + 0.24, y0 - 3.3, deep, HALL, -deep - 0.035);
  put(b, f, new T.CircleGeometry(r, 16, 0, Math.PI).translate(0, 0, 0.0), 0, y0, 0, 'glass');
  const arc = new T.Shape().absarc(0, 0, r + 0.1, 0, Math.PI, false);
  arc.lineTo(-(r - 0.12), 0); arc.absarc(0, 0, r - 0.12, Math.PI, 0, true); arc.lineTo(r + 0.1, 0);
  put(b, f, new T.ExtrudeGeometry(arc, {depth: 0.08, bevelEnabled: false, curveSegments: 16}), 0, y0, -0.03, WOOD);
  const hub = new T.Shape().absarc(0, 0, 0.5, 0, Math.PI, false);
  put(b, f, new T.ExtrudeGeometry(hub, {depth: 0.07, bevelEnabled: false, curveSegments: 8}), 0, y0, -0.03, WOOD);
  for (let k = 1; k < 8; k++) {
    const a = (k * Math.PI) / 8, g = new T.BoxGeometry(r - 0.55, 0.06, 0.07).translate((r + 0.45) / 2, 0, 0.035).rotateZ(a);
    put(b, f, g, 0, y0, -0.03, WOOD);
  }
  slab(b, f, 0, y0 - 0.12, 2 * r + 0.3, 0.14, 0.12, WOOD, -0.05);
}

export function buildArchipelMakassarplein(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const hidden = new Set(infos.filter((w): w is WallInfo => !!w && w.outside >= w.yt - 0.3).map(w => w.i));
  for (const w of infos) if (w && !hidden.has(w.i) && w.outside > w.yb + 0.3) w.yb = w.outside;
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && !hidden.has(w.i) && w.len > 0.3 && (w.rect || (w.tv.length > 0 && w.yb < 0.3))).map(w => w.i));
  const hits = new Map(infos.filter((w): w is WallInfo => !!w).map(w => [w.i, lineOf(w)]));
  const isHall = (w: WallInfo) => { const h = hits.get(w.i); return h ? HALL_EDGES.has(h.edge) : w.yt > 4.5; };
  addShell(b, src as never, {
    wall: BRICK, roof: FLAT_ROOF,
    roofFor: s => (Math.max(...s.rings[0].map(p => p[1])) > 6 ? HALL_ROOF : FLAT_ROOF),
    wallFor: (_s, i) => (infos[i] && isHall(infos[i]!) ? HALL : BRICK),
    skip: (_s, i) => rebuilt.has(i),
  });
  resetFaces();
  const sink0 = getSink();
  setSink(0.1, true);
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const hit = hits.get(w.i) ?? null, hall = isHall(w);
    if (process.env.AR_DEBUG) console.log('wall', w.i, hit?.edge, hit?.s0.toFixed(2), w.len.toFixed(2), w.yb.toFixed(2), w.yt.toFixed(2), w.rect, hall);
    const tops = w.tv.filter(p => p[1] > w.yb + 0.5).map(p => p[1]);
    const ye = w.rect ? w.yt : Math.min(...tops);
    const base: Col = hall ? HALL : BRICK;
    const F = face({f: w.f, len: w.len}, w.yb, ye, base);
    if (hit) for (const o of OPEN[hit.edge] ?? []) if (!cut(b, F, o, hit.s0) && process.env.AR_DEBUG) console.log("  missed", hit.edge, o.t, o.w, o.y, "face", F.y0.toFixed(2), F.y1.toFixed(2), F.len.toFixed(2));
    if (!w.rect && w.tv.length) {
      const top = above(w.tv, ye);
      if (top.length >= 3) addPolys(b, w.f, [{pts: top.map(([t, y]) => [t, y, 0] as [number, number, number])}], base);
    }
    if (hall) {
      // vertical boarding: a batten every 0.45 m, broken at the openings, to the eaves of this wall piece
      for (let t = 0.3; t < w.len - 0.1; t += 0.45) {
        const hole = F.holes.find(h => h.t0 - 0.05 < t && t < h.t1 + 0.05);
        const y0 = hole ? hole.y1 + 0.02 : w.yb;
        if (ye - y0 > 0.3) ledgeStrip(b, w.f, t, y0, 0.05, ye - y0, 0.03, HALL);
      }
    } else if (w.rect && w.yb < 0.3) {
      // the dark fascia under the flat roof (w02-284: 0.55 m), its top 6 cm proud of the roof
      slab(b, w.f, w.len / 2, w.yt - 0.55, w.len + 0.04, 0.61, 0.06, FASCIA);
    }
    if (hit) for (const [t, y, d] of PORTHOLES[hit.edge] ?? []) if (t - hit.s0 > d / 2 && t - hit.s0 < w.len - d / 2) porthole(b, w.f, t - hit.s0, y, d);
  }
  // ARCHIPEL (w04-254: t 4.5-6.4 on edge 8, about 4.4-4.8 m up) on the hall's upper west wall, set back from edge 8 over the
  // west wing's roof edge: find that wall piece and place the letters at edge 8's t 5.4 projected onto it
  const e8 = ringFrame(ring, 8), at: P2 = [e8.f.origin[0] + e8.f.tangent[0] * 5.4, e8.f.origin[1] + e8.f.tangent[1] * 5.4];
  for (const w of infos) {
    if (!w || hidden.has(w.i) || w.yb < 3 || w.yt < 5.2 || w.f.n[0] * e8.f.n[0] + w.f.n[1] * e8.f.n[1] < 0.97) continue;
    const t = (at[0] - w.f.origin[0]) * w.f.tangent[0] + (at[1] - w.f.origin[1]) * w.f.tangent[1];
    if (t < 1 || t > w.len - 1) continue;
    if (process.env.AR_DEBUG) console.log('letters on wall', w.i, t.toFixed(2), w.yb.toFixed(2), w.yt.toFixed(2));
    letters(b, w.f, 'ARCHIPEL', t, 4.35, 0.0, 0.048, 0.04, LIME, 0.07);
    break;
  }
  flushFaces(b);
  lunette(b);
  setSink(sink0);
}
