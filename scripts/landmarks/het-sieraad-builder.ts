import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, leanSlab, facePanel, ledgeStrip, put, poly, ringFrame, roofHeightAt, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {raisedLettering} from './ornament-kit';
import {buildFigure, POSES, type Pose} from './figure-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './het-sieraad-footprints.json';

/**
 * Het Sieraad, Postjesweg 1 (BAG pand 0363100012154874, bouwjaar 1924; Rijksmonument 527153: built 1921-1923 as the
 * Vierde Ambachtsschool to the design of A.J. Westerman (Publieke Werken) in the Amsterdamse School style, engineer
 * A.J. Hulshoff; sculpture by Hildo Krop for the trades taught there; restored 2005-2007 with a glass roof over the court).
 * Native east/south metres from the BAG vertex average, y above the 3DBAG ground (0.73 m NAP).
 *
 * Massing: one closed prism per 3DBAG LoD2.2 roof plane (CC BY 4.0, het-sieraad-footprints.json via bag-shell-prepare.ts);
 * the court's glass roof (plane 371) is glazed. The fronts are skins on the BAG ring edges (ringFrame, t = viewer's left):
 *   edge 12          Postjesweg school wing (N, 45.8 m): eight axes of wide cream multi-pane windows on three floors over
 *                    basement lights, corbelled stone coping at 15.7 m, a bay window on consoles at each end      (w02-354)
 *   edges 42, 0      Kostverlorenvaart school wing (SE): the same order, side door and Krop relief at the south end (w01-118)
 *   edges 1-8        the concave entrance front (NE) of the taller block (18.9 m): Krop's two sculpted piers either side
 *                    of the door, HET SIERAAD, a five-axis two-storey window group with dark spandrels, triangle-hooded
 *                    attic lights and a toothed coping                                                         (w07, w09, w10)
 *   edges 20-33      the water fronts (W, SW) on the Admiralengracht / Postjeswetering: three brick storeys, stone cornice,
 *                    slate mansard with a continuous dormer band; brick towers with triangle-headed windows and three-sided
 *                    oriels at both ends; sculptures on consoles                                               (w03-w06)
 * Proportions from the rectified panorama crops (Gemeente Amsterdam, CC BY 4.0; 47-50 px/m) and Wikimedia Commons
 * photographs; every item is listed with its photo in het-sieraad-inventory.json.
 */
type C = Parameters<BuildingTools['add']>[1];
type Surface = {type: string; rings: number[][][]};
const src = source as unknown as {surfaces: Surface[]; facadeRing: number[][]};
const RING = src.facadeRing;
const ROOFS = src.surfaces.filter(s => s.type === 'RoofSurface');
const CANOPY_PLANES = new Set([371]);

const SK = 0.32;         // skin face out of the BAG wall line
const GLASS = 0.15;      // opening depth: glass 17 cm out from the wall line, clear of the 3DBAG prism walls
const COPING = 15.7;     // school wings: corbelled stone coping at the 3DBAG flat roof

let b: BuildingTools;
const acc = new Map<C, number[]>();
function quad(f: Frame, q: WallQuad, c: C, out = 0) {
  const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * t + f.n[0] * (o + out), y, f.origin[1] + f.tangent[1] * t + f.n[1] * (o + out)]);
  const a = acc.get(c) ?? [];
  a.push(...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
  acc.set(c, a);
}
function flush() {
  for (const [c, pos] of acc) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    b.add(g, c);
  }
  acc.clear();
}

/** A window: centre t, clear width, sill and head; panes cols x rows; heavy transom over the bottom row when `lowRow`. */
type Win = {t: number; w: number; y0: number; y1: number; cols?: number; rows?: number; lowRow?: boolean; back?: C; frame?: C; sill?: boolean; plain?: boolean};
type Band = {y0: number; y1: number; c: C};
const edge = (i: number) => ringFrame(RING, i);
const KEPT = ROOFS;
const roofAtXZ = (x: number, z: number) => roofHeightAt(KEPT as never, x, z) ?? 15.7;
const at = (f: Frame, t: number, o: number): [number, number] => [f.origin[0] + f.tangent[0] * t - f.n[0] * o, f.origin[1] + f.tangent[1] * t - f.n[1] * o];

/** Skin bands with openings cut (openings are clipped to [0, L] so a window may straddle a facet joint), then the window furniture. */
function skin(f: Frame, L: number, bands: Band[], wins: Win[], returns: [boolean, boolean] = [true, true]) {
  for (const band of bands) {
    const cuts: (HoledOpening & {back: C})[] = wins
      .filter(w => w.y1 > band.y0 + 1e-6 && w.y0 < band.y1 - 1e-6 && w.t + w.w / 2 > 0.02 && w.t - w.w / 2 < L - 0.02)
      .map(w => ({t0: Math.max(0, w.t - w.w / 2), t1: Math.min(L, w.t + w.w / 2), y0: w.y0, y1: w.y1, depth: GLASS, back: w.back ?? 'glass'}));
    const hw = holedWall(L, band.y0, band.y1, cuts);
    for (const q of hw.face) quad(f, q, band.c, SK);
    hw.reveals.forEach(qs => qs.forEach(q => quad(f, q, band.c, SK)));
    hw.backs.forEach((q, k) => quad(f, q, cuts[k].back, SK));
  }
  const y0 = bands[0].y0, y1 = bands[bands.length - 1].y1;
  if (returns[0]) quad(f, {pts: [[0, y0, 0], [0, y0, SK], [0, y1, SK], [0, y1, 0]], normal: [-1, 0, 0]}, bands[0].c);
  if (returns[1]) quad(f, {pts: [[L, y0, SK], [L, y0, 0], [L, y1, 0], [L, y1, SK]], normal: [1, 0, 0]}, bands[0].c);
  quad(f, {pts: [[0, y1, SK], [L, y1, SK], [L, y1, 0], [0, y1, 0]], normal: [0, 1, 0]}, bands[bands.length - 1].c);   // top cap
  // back and bottom close the skin into a solid (the open boundary audit), hidden against the 3DBAG wall
  quad(f, {pts: [[L, y0, 0], [0, y0, 0], [0, y1, 0], [L, y1, 0]], normal: [0, 0, -1]}, bands[0].c);
  quad(f, {pts: [[0, y0, 0], [L, y0, 0], [L, y0, SK], [0, y0, SK]], normal: [0, -1, 0]}, bands[0].c);
  for (const w of wins) furniture(f, L, w);
}

/** Cream multi-pane frame (paneGrid kit) 4 cm in front of the glass, members clipped to this facet, and a stone sill. */
function furniture(f: Frame, L: number, w: Win) {
  const h = w.y1 - w.y0, o = SK - GLASS + 0.04;
  if (!w.plain) {
    const rows = w.rows ?? 3;
    const grid = paneGrid({width: w.w, height: h, cols: w.cols ?? 5, rows, bar: 0.05, frame: 0.09, transomRows: w.lowRow ? [1] : [], transom: 0.13, rowWeights: w.lowRow ? [0.8, ...Array(rows - 1).fill(1)] : undefined});
    for (const m of grid) {
      const a = Math.max(0, w.t + m.x - m.w / 2), z = Math.min(L, w.t + m.x + m.w / 2);
      if (z - a > 0.01) facePanel(b, f, (a + z) / 2, w.y0 + m.y, z - a, m.h, w.frame ?? 'white', o);
    }
  }
  if (w.sill) {
    const a = Math.max(0, w.t - w.w / 2 - 0.12), z = Math.min(L, w.t + w.w / 2 + 0.12);
    if (z - a > 0.2) slab(b, f, (a + z) / 2, w.y0 - 0.12, z - a, 0.12, 0.12, 'stone', SK);
  }
}

/** Free t-intervals of [a, z] at height [y0, y1] between openings. */
function free(a: number, z: number, y0: number, y1: number, wins: Win[], pad = 0.05): [number, number][] {
  const cuts = wins.filter(w => w.y1 > y0 && w.y0 < y1).map(w => [w.t - w.w / 2 - pad, w.t + w.w / 2 + pad]).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let s = a;
  for (const [c0, c1] of cuts) { if (c0 > s + 0.05) out.push([s, Math.min(c0, z)]); s = Math.max(s, c1); }
  if (z > s + 0.05) out.push([s, z]);
  return out;
}
/** Stone string course broken at the openings. */
function course(f: Frame, a: number, z: number, y: number, h: number, d: number, wins: Win[], c: C = 'stone') {
  for (const [s0, s1] of free(a, z, y, y + h, wins)) if (s1 - s0 > 0.08) slab(b, f, (s0 + s1) / 2, y, s1 - s0, h, d, c, SK);
}
/** Corbelled stone coping: blocks every `pitch` under a projecting coping slab, top at `top`. */
function coping(f: Frame, a: number, z: number, top: number, pitch = 2.05) {
  slab(b, f, (a + z) / 2, top - 0.42, z - a, 0.42, 0.3, 'stone', SK);
  const n = Math.max(1, Math.round((z - a) / pitch));
  for (let k = 0; k < n; k++) slab(b, f, a + ((z - a) * (k + 0.5)) / n, top - 0.85, 0.32, 0.36, 0.12, 'stone', SK);
}

// ------------------------------------------------------------------------------------------------------------------
// School wings (Postjesweg, Kostverlorenvaart). Heights from w02-354 (47.7 px/m), scaled to the 3DBAG flat roof at 15.7:
// basement lights 1.75-2.5, ground 2.9-4.8 (5x3 panes), course 5.0, first floor 6.5-9.6 (5x4), second 11.1-13.2 (5x3).
const BASE: [number, number] = [1.75, 2.5], GRND: [number, number] = [2.9, 4.8], FL1: [number, number] = [6.5, 9.6], FL2: [number, number] = [11.1, 13.2];
function schoolAxis(t: number, w = 3.0, noTop = false): Win[] {
  const out: Win[] = [
    {t, w: w - 0.9, y0: BASE[0], y1: BASE[1], cols: 4, rows: 1, sill: true},
    {t, w, y0: GRND[0], y1: GRND[1], cols: 5, rows: 3, sill: true},
    {t, w, y0: FL1[0], y1: FL1[1], cols: 5, rows: 4, sill: true},
  ];
  if (!noTop) out.push({t, w, y0: FL2[0], y1: FL2[1], cols: 5, rows: 3, sill: true});   // a bay window stands in front of it otherwise
  return out;
}
function schoolWing(i: number, a: number, z: number, axes: number[], extra: Win[] = [], returns: [boolean, boolean] = [true, true]) {
  const {f} = edge(i);
  const g: Frame = {...f, origin: at(f, a, 0)};
  const L = z - a;
  const wins = [...axes.flatMap(t => schoolAxis(t - a)), ...extra.map(w => ({...w, t: w.t - a}))];
  skin(g, L, [{y0: 0, y1: COPING - 0.42, c: 'brick'}], wins, returns);
  course(g, 0, L, GRND[1] + 0.2, 0.25, 0.08, wins);
  course(g, 0, L, 1.3, 0.12, 0.06, wins);
  coping(g, 0, L, COPING);
  return g;
}
/**
 * A bay on a polygonal plan (local x across the wall, z out of the skin face; vertices from the wall at the left round to
 * the wall at the right): every facet is a holed skin with real openings, stone cap and console slabs close the plan.
 */
function polyBay(f: Frame, t: number, verts: [number, number][], y0: number, y1: number, winsFor: (len: number, k: number) => Win[], c: C = 'brick') {
  const W = (x: number, z: number): [number, number] => [f.origin[0] + f.tangent[0] * (t + x) + f.n[0] * (SK + z), f.origin[1] + f.tangent[1] * (t + x) + f.n[1] * (SK + z)];
  for (let k = 0; k + 1 < verts.length; k++) {
    const [x0, z0] = verts[k], [x1, z1] = verts[k + 1], len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) continue;
    const lx = (x1 - x0) / len, lz = (z1 - z0) / len;            // facet direction (local)
    const nx = lz, nz = -lx;                                      // outward for a plan running left to right round the front
    const tw: [number, number] = [f.tangent[0] * lx + f.n[0] * lz, f.tangent[1] * lx + f.n[1] * lz];
    const nw: [number, number] = [f.tangent[0] * nx + f.n[0] * nz, f.tangent[1] * nx + f.n[1] * nz];
    const o = W(x0, z0);
    const g: Frame = {origin: [o[0] - nw[0] * SK, o[1] - nw[1] * SK], tangent: tw, n: nw};
    skin(g, len, [{y0, y1, c}], winsFor(len, k), [false, false]);
  }
  const shape = new T.Shape(verts.map(([x, z]) => new T.Vector2(x, z)));
  for (const [y, h] of [[y0 - 0.3, 0.35], [y1 - 0.05, 0.3]] as const) {
    const g = new T.ExtrudeGeometry(shape, {depth: h, bevelEnabled: false}).rotateX(Math.PI / 2).translate(0, h, 0).scale(1.06, 1, 1.08);
    put(b, f, g, t, y, SK, 'stone');
  }
}
/** Rectangular bay window (erker) on a stone console at the second floor (s09, s10; w01, w02 ends). */
function erker(f: Frame, t: number, w = 3.0, d = 0.75) {
  const y0 = 10.6, y1 = 13.6;
  polyBay(f, t, [[-w / 2, 0], [-w / 2, d], [w / 2, d], [w / 2, 0]], y0, y1, (len, k) => k === 1 ? [{t: len / 2, w: len - 0.45, y0: y0 + 0.35, y1: y1 - 0.4, cols: 5, rows: 3}] : []);
  for (const s of [-1, 1]) poly(b, f, t + s * (w / 2 - 0.25), y0 - 1.45, [[-0.18, 1.15], [0.18, 1.15], [0.08, 0], [-0.08, 0]], 0.5, 'stone', SK);
}

/** Postjesweg, edge 12 (t 0 at the east end; the taller entrance block covers t 0-3). */
function postjesweg() {
  const axes = Array.from({length: 8}, (_, k) => 8.4 + 4.13 * k);
  const g = schoolWing(12, 3.0, 39.6, axes, schoolAxis(4.4, 2.6, true), [true, false]);
  erker(g, 1.4);
  // west end block (t 39.6-45.8): brick a metre above the wing coping, one axis with a bay, a triangle-hooded light
  const {f} = edge(12);
  const h: Frame = {...f, origin: at(f, 39.6, 0)};
  const wins = [...schoolAxis(1.9, 2.6, true), hoodLight(2.0, 15.0)];
  skin(h, 6.2, [{y0: 0, y1: 16.4, c: 'brick'}], wins, [false, true]);
  course(h, 0, 6.2, GRND[1] + 0.2, 0.25, 0.08, wins);
  course(h, 0, 6.2, 1.3, 0.12, 0.06, wins);
  triangleHood(h, 2.0, 15.0);
  slab(b, h, 3.1, 16.4, 6.2, 0.25, 0.3, 'stone', SK);
  erker(h, 1.9, 2.8);
}

/** Kostverlorenvaart, edges 42 and 0 (t 0 at the south-west end): side door, Krop relief, bay, nine axes. */
function kostverlorenvaart() {
  const axes = Array.from({length: 8}, (_, k) => 11.3 + 4.13 * k);
  const door: Win = {t: 1.6, w: 1.9, y0: 0.4, y1: 3.1, cols: 2, rows: 2, frame: 'white', back: 'glass'};
  const g = schoolWing(42, 0, 41.3, axes, [door, ...schoolAxis(7.2, 2.4, true)], [true, false]);
  slab(b, g, 1.6, 3.1, 2.6, 0.3, 0.45, 'stone', SK);          // door hood
  erker(g, 7.2, 2.8);
  kropRelief(g, 4.6, 4.3);
  // edge 0: the last school axis and its bay (t 0-4.8), then the entrance block's side (t 4.8-12.1)
  const {f} = edge(0);
  const g0 = schoolWing(0, 0, 4.8, [], schoolAxis(3.0, 3.0, true), [false, false]);
  erker(g0, 3.0, 2.8);
  const h: Frame = {...f, origin: at(f, 4.8, 0)};
  blockSide(h, 7.3, [2.7, 5.6]);
  void f;
}

/** A side of the taller entrance block: brick to 18.9 with toothed coping, windows per column, a half-round bay. */
function blockSide(f: Frame, L: number, cols: number[], bayAt?: number) {
  const wins: Win[] = cols.flatMap(t => [
    {t, w: 1.5, y0: GRND[0], y1: GRND[1], cols: 3, rows: 3, sill: true},
    {t, w: 1.5, y0: 7.4, y1: 9.9, cols: 3, rows: 4, sill: true},
    {t, w: 1.5, y0: 11.2, y1: 14.0, cols: 3, rows: 4, sill: true},
    hoodLight(t, 15.8),
  ]);
  skin(f, L, [{y0: 0, y1: 18.9, c: 'brick'}], wins, [false, true]);
  course(f, 0, L, 3.3, 0.2, 0.08, wins);
  course(f, 0, L, 14.3, 0.4, 0.12, wins);
  for (const t of cols) triangleHood(f, t, 15.8);
  teeth(f, 0, L, 18.9);
  if (bayAt !== undefined) roundBay(f, bayAt);
}

/** White stone triangular hood round a small square attic light (w10, s07, w05). */
function triangleHood(f: Frame, t: number, y: number) {
  // an outline: sill and two raking members meeting over the light (the light itself is a cut opening, `hoodLight`)
  slab(b, f, t, y - 0.14, 1.0, 0.14, 0.08, 'stone', SK);
  const rise = 0.95, half = 0.5, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const s of [-1, 1]) put(b, f, new T.BoxGeometry(len, 0.13, 0.08).translate(0, 0, 0.04).rotateZ(s * -ang + (s > 0 ? Math.PI : 0)), t + (s * half) / 2, y - 0.14 + rise / 2, SK, 'stone');
}
const hoodLight = (t: number, y: number): Win => ({t, w: 0.45, y0: y, y1: y + 0.45, cols: 2, rows: 2});
/** Toothed (crenellated) stone coping on the entrance block: a coping course with blocks at 0.7 m pitch. */
function teeth(f: Frame, a: number, z: number, top: number) {
  slab(b, f, (a + z) / 2, top - 0.2, z - a, 0.26, 0.28, 'stone', SK - 0.06);
  const n = Math.max(1, Math.floor((z - a) / 0.7));
  for (let k = 0; k < n; k++) slab(b, f, a + (z - a) * (k + 0.5) / n, top + 0.06, 0.34, 0.34, 0.5, 'stone', SK - 0.28);
}
/** Half-round brick bay over two storeys on a carved console (register: 'halfronde gemetselde erkers op gebeeldhouwde consoles'), as five facets. */
function roundBay(f: Frame, t: number, r = 1.3) {
  const y0 = 9.2, y1 = 13.9;
  const verts = Array.from({length: 6}, (_, k) => { const a = -Math.PI / 2 + (Math.PI * k) / 5; return [r * Math.sin(a), r * Math.cos(a)] as [number, number]; });
  polyBay(f, t, verts, y0, y1, len => [{t: len / 2, w: len - 0.3, y0: 9.7, y1: 11.3, cols: 2, rows: 2}, {t: len / 2, w: len - 0.3, y0: 12.0, y1: 13.6, cols: 2, rows: 2}]);
  put(b, f, new T.CylinderGeometry(r + 0.1, 0.25, 1.4, 10, 1, false, -Math.PI / 2, Math.PI).translate(0, -0.7, 0), t, y0 - 0.3, SK, 'stone');
}

// ------------------------------------------------------------------------------------------------------------------
// The concave entrance front, edges 1-8 as one arc of 29.4 m from the south-east end (s) towards the north end.
const ARC = [1, 2, 3, 4, 5, 6, 7, 8];
function arcEdges() {
  let s = 0;
  return ARC.map(i => { const {f, len} = edge(i); const r = {i, f, len, s0: s}; s += len; return r; });
}
function entranceFront() {
  const E = arcEdges(), C = 14.7, P = 1.86;
  const wins: Win[] = [];
  for (let k = -2; k <= 2; k++) {
    const s = C + k * P;
    wins.push({t: s, w: 1.4, y0: 6.7, y1: 9.9, cols: 3, rows: 4, lowRow: true, sill: true});
    wins.push({t: s, w: 1.4, y0: 11.2, y1: 14.0, cols: 3, rows: 4});
    wins.push({t: s, w: 1.4, y0: 10.0, y1: 11.1, back: 'bronze', plain: true});   // dark spandrel panel, recessed
  }
  wins.push({t: C, w: 3.0, y0: 0, y1: 3.0, cols: 4, rows: 2, frame: 'green', back: 'glass'});
  for (const s of [-1, 1]) {
    wins.push({t: C + s * 3.9, w: 2.4, y0: 1.4, y1: 3.1, cols: 5, rows: 3, sill: true});
    wins.push({t: C + s * 5.95, w: 1.0, y0: 6.7, y1: 8.9, cols: 2, rows: 3});       // balcony door
    wins.push({t: C + s * 5.95, w: 1.0, y0: 11.3, y1: 12.8, cols: 2, rows: 2, sill: true});
    for (const y of [[7.6, 9.2], [11.3, 12.8]] as const) wins.push({t: C + s * 8.65, w: 1.6, y0: y[0], y1: y[1], cols: 3, rows: 2, sill: true});
    wins.push({t: C + s * 8.65, w: 1.2, y0: 1.4, y1: 3.0, cols: 3, rows: 2, sill: true});
  }
  for (const e of E) {
    const inside = (s: number, m: number) => s - e.s0 > m && s - e.s0 < e.len - m;
    const hoods = [-2, -1, 0, 1, 2].map(k => C + k * 2.3).filter(s => inside(s, 0.55));
    const local = [...wins, ...hoods.map(s => hoodLight(s, 15.8))].map(w => ({...w, t: w.t - e.s0})).filter(w => w.t + w.w / 2 > 0 && w.t - w.w / 2 < e.len);
    skin(e.f, e.len, [{y0: 0, y1: 18.9, c: 'brick'}], local, [e.i === 1, e.i === 8]);
    course(e.f, 0, e.len, 3.3, 0.2, 0.1, local);
    slab(b, e.f, e.len / 2, 14.3, e.len + 0.02, 0.4, 0.14, 'stone', SK);
    teeth(e.f, 0, e.len, 18.9);
    // stone sill band with corbel blocks under the window group, the triangle hoods in the attic
    const here = (s: number, m = 0.2) => s - e.s0 > m && s - e.s0 < e.len - m;
    for (const s of hoods) triangleHood(e.f, s - e.s0, 15.8);
    // stone sill band under the window group on corbels at the piers between the windows
    const a = Math.max(0, C - 2.5 * P - 0.15 - e.s0), z = Math.min(e.len, C + 2.5 * P + 0.15 - e.s0);
    if (z - a > 0.1) slab(b, e.f, (a + z) / 2, 6.25, z - a, 0.3, 0.18, 'stone', SK);
    for (let k = -3; k <= 2; k++) { const s = C + (k + 0.5) * P; if (here(s)) slab(b, e.f, s - e.s0, 5.85, 0.3, 0.4, 0.14, 'stone', SK); }
    for (const s of [-1, 1]) if (here(C + s * 5.95, 0.85)) balcony(e.f, C + s * 5.95 - e.s0);
  }
  // Krop's sculpted piers either side of the door, HET SIERAAD over it (the door's facet: arc 14.7 lies on edge 4)
  const d = E.find(e => C >= e.s0 && C < e.s0 + e.len)!;
  for (const s of [-1, 1]) kropPier(d.f, C - d.s0 + s * 2.0, s);
  const L = raisedLettering({text: 'HET SIERAAD', heightM: 0.32, maxWidthM: 2.4, depthM: 0.04});
  put(b, d.f, L.geometry, C - d.s0, 3.55, SK, 'bronze');
  slab(b, d.f, C - d.s0, 3.05, 3.4, 0.25, 0.2, 'stone', SK);
}

/** Small wrought-iron balcony on a stone slab (w10 left of the window group). */
function balcony(f: Frame, t: number) {
  slab(b, f, t, 6.45, 1.6, 0.22, 0.75, 'stone', SK);
  poly(b, f, t, 5.6, [[-0.35, 0.85], [0.35, 0.85], [0.15, 0], [-0.15, 0]], 0.5, 'stone', SK);
  const o = SK + 0.7;
  slab(b, f, t, 7.45, 1.6, 0.05, 0.05, 'bronze', o - 0.05);
  for (let k = 0; k <= 8; k++) slab(b, f, t - 0.8 + k * 0.2, 6.67, 0.03, 0.8, 0.03, 'bronze', o - 0.03);
  for (const s of [-1, 1]) for (let k = 1; k <= 3; k++) slab(b, f, t + s * 0.8, 6.67, 0.03, 0.8, 0.03, 'bronze', o - 0.2 * k);
}

/** Krop pier: a tall cream tufa block that tapers to a point at its foot, a standing worker carved on its face, a capital (s15, s16, w07). */
function kropPier(f: Frame, t: number, s: number) {
  poly(b, f, t, 0.5, [[-0.5, 0.9], [0.5, 0.9], [0.5, 3.4], [-0.5, 3.4]], 0.32, 'stone', SK);
  poly(b, f, t, 0.5, [[-0.5, 0.9], [0, 0], [0.5, 0.9]], 0.32, 'stone', SK);
  slab(b, f, t, 3.9, 1.2, 0.35, 0.42, 'stone', SK);
  slab(b, f, t, 3.6, 0.9, 0.3, 0.36, 'stone', SK);
  const pose: Pose = {...POSES.standing(), height: 2.0, arms: {l: {pitch: s > 0 ? 0.5 : 0.1, roll: 0.1, bend: 1.4}, r: {pitch: s > 0 ? 0.1 : 0.5, roll: 0.1, bend: 1.4}}, skirt: {len: 0.6, flare: 1.1}};
  const {parts} = buildFigure(pose, 'stone');
  for (const p of parts) put(b, f, p.g.scale(0.85, 0.85, 0.3), t, 1.4, SK + 0.32, 'stone');
}

/** Square Krop relief panel (crowns, a ship and two figures, s19) in a stone frame. */
function kropRelief(f: Frame, t: number, y: number) {
  slab(b, f, t, y, 1.6, 1.45, 0.11, 'stone', SK);
  slab(b, f, t, y + 0.1, 1.4, 1.25, 0.04, 'stone', SK + 0.11);
  // the ship's hull and the crown of rays above it
  poly(b, f, t, y + 0.2, [[-0.42, 0.18], [0.42, 0.18], [0.3, 0], [-0.3, 0]], 0.08, 'stone', SK + 0.15);
  for (let k = -3; k <= 3; k++) poly(b, f, t + k * 0.11, y + 0.42, [[-0.05, 0], [0.05, 0], [k * 0.04, 0.55 - Math.abs(k) * 0.06]], 0.06, 'stone', SK + 0.15);
  for (const s of [-1, 1]) {
    const {parts} = buildFigure({...POSES.standing(), height: 1.0, skirt: {len: 0.4, flare: 1.1}}, 'stone');
    for (const p of parts) put(b, f, p.g.scale(1, 1, 0.3), t + s * 0.55, y + 0.15, SK + 0.15, 'stone');
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Water fronts (w04-209 at 50 px/m, eave anchored to the 3DBAG mansard): basement row 2.0-3.3 (5x2), course 3.5,
// low transom row 4.9-5.6 under the first floor 5.75-7.8, courses 8.0 and 9.2, second floor 9.4-12.3, cornice 12.4-13.0,
// lower slate 13.0-13.9, dormer band 13.9-15.7 set 0.6 m back, upper slate to the 3DBAG ridge.
function waterAxis(t: number, w: number): Win[] {
  return [
    {t, w: Math.min(2.5, w - 0.4), y0: 2.0, y1: 3.3, cols: 5, rows: 2, sill: true},
    {t, w, y0: 4.85, y1: 7.8, cols: 5, rows: 4, lowRow: true, sill: true},
    {t, w, y0: 9.45, y1: 12.3, cols: 5, rows: 4, sill: true},
  ];
}
function waterEdge(i: number, a = 0, z?: number, oriel?: number) {
  const {f, len} = edge(i), Z = z ?? len, L = Z - a;
  const g: Frame = {...f, origin: at(f, a, 0)};
  const n = Math.max(1, Math.round(L / 4.32));
  const wins: Win[] = [];
  if (L >= 2.2) for (let k = 0; k < n; k++) {
    const t = (L * (k + 0.5)) / n;
    if (oriel !== undefined && Math.abs(t - (oriel - a)) < 2.4) continue;
    wins.push(...waterAxis(t, Math.min(3.0, L / n - 1.2)));
  }
  skin(g, L, [{y0: 0, y1: 12.4, c: 'brick'}], wins, [false, false]);
  for (const [y, h] of [[3.45, 0.12], [4.7, 0.15], [8.0, 0.12], [9.2, 0.18]] as const) course(g, 0, L, y, h, 0.07, wins);
  slab(b, g, L / 2, 12.4, L + 0.02, 0.6, 0.35, 'stone', SK);     // cornice
  slab(b, g, L / 2, 13.0, L + 0.02, 0.45, 0.3, 'slate', SK - 0.25); // foot of the lower slate slope, up to the 3DBAG eave
  dormerBand(g, L, n);
  if (oriel !== undefined) orielBay(g, oriel - a);
}
/** The mansard's dormer band: a vertical grey-green framed band just behind the wall line, two lights per axis, real openings. */
function dormerBand(f: Frame, L: number, n: number) {
  const o = 0.1, y0 = 13.0, y1 = 15.75, e = 0.12, inset = L > 6 ? 0.45 : 0;   // keep the end lights off the hips
  const g: Frame = {...f, origin: [f.origin[0] + f.n[0] * (o - SK) + f.tangent[0] * e, f.origin[1] + f.n[1] * (o - SK) + f.tangent[1] * e]};
  const Lb = L - 2 * e, m = L < 3.5 ? 1 : Math.max(1, n * 2), lights: Win[] = [];   // one light on each short facet of a bend
  for (let k = 0; k < m; k++) {
    const t = inset + ((Lb - 2 * inset) * (k + 0.5)) / m, w = Math.min(1.6, (Lb - 2 * inset) / m - 0.45);
    if (w < 0.5) continue;
    // the sill stands clear of the 3DBAG lower slope (one plane from the eave to the ridge, steeper on the bends)
    const [x, z] = at(g, t, -SK + 0.15);                      // under the glass, 0.27 m behind the wall line
    const sill = Math.max(14.05, Math.max(roofAtXZ(x, z), ...[-w / 2, w / 2].map(d => roofAtXZ(...at(g, t + d, -SK + 0.15)))) + 0.08);
    if (15.5 - sill < 0.7) continue;
    // on the steep bend facets the 3DBAG slope climbs within 10 cm behind the sill: no light fits there
    if ([-w / 2, 0, w / 2].some(d => { const r = roofAtXZ(...at(g, t + d, -SK + 0.05)); return r > sill - 0.12 && r < 15.6; })) continue;
    lights.push({t, w, y0: sill, y1: 15.5, cols: 3, rows: 2, frame: 'frame'});
  }
  skin(g, Lb, [{y0, y1, c: 'slate'}], lights, [true, true]);
  slab(b, f, L / 2, y1, L, 0.14, 0.25, 'frame', o - 0.2);
  slab(b, g, Lb / 2, y0, Lb - 0.1, y1 - y0 - 0.17, 1.1, 'slate', -1.1);   // body behind the band, into the upper slope
}
/** Three-sided oriel over two storeys at the ends of the water fronts (w05, w06; register: 'driezijdige erker'). */
function orielBay(f: Frame, t: number) {
  const w = 3.4, d = 0.9, y0 = 4.5, y1 = 12.4;
  polyBay(f, t, [[-w / 2, 0], [-w / 2 + d * 0.8, d], [w / 2 - d * 0.8, d], [w / 2, 0]], y0, y1, (len, k) => {
    const cols = k === 1 ? 3 : 1, ww = len - (k === 1 ? 0.3 : 0.35);
    return [{t: len / 2, w: ww, y0: 5.0, y1: 7.8, cols, rows: 4}, {t: len / 2, w: ww, y0: 9.4, y1: 11.9, cols, rows: 4}];
  });
}

/** Iron railing on a flat roof edge, `o` inward of the wall line (w05). */
function roofRail(f: Frame, a: number, z: number, y: number, o: number) {
  slab(b, f, (a + z) / 2, y + 0.95, z - a, 0.05, 0.05, 'bronze', o);
  const n = Math.max(2, Math.round((z - a) / 0.15));
  for (let k = 0; k <= n; k++) slab(b, f, a + ((z - a) * k) / n, y, 0.03, 0.95, 0.03, 'bronze', o + 0.01);
}
/** Small triangular dormer on the upper slate slope (s00, s21): slate cheeks, white frame, dark light. */
function triangleDormer(f: Frame, t: number) {
  const o = 1.9, [x, z] = at(f, t, o), y = roofAtXZ(x, z) - 0.05;
  const g = new T.ExtrudeGeometry(new T.Shape([new T.Vector2(-0.75, 0), new T.Vector2(0.75, 0), new T.Vector2(0, 1.2)]), {depth: 1.6, bevelEnabled: false}).translate(0, 0, -1.6);
  put(b, f, g, t, y, -o, 'slate');
  poly(b, f, t, y + 0.12, [[-0.55, 0], [0.55, 0], [0, 0.88]], 0.04, 'stone', -o);
  poly(b, f, t, y + 0.24, [[-0.36, 0], [0.36, 0], [0, 0.58]], 0.03, 'bronze', -o + 0.09);
}
/** Brick tower on a water front (3DBAG 20.0 m): triangle-headed window high up, a window below, a green door, railing on top. */
function waterTower(i: number, a: number, z: number) {
  const {f} = edge(i), L = z - a;
  const g: Frame = {...f, origin: at(f, a, 0)};
  const C0 = L / 2;
  const wins: Win[] = [
    {t: C0, w: 1.2, y0: 0.4, y1: 2.6, cols: 2, rows: 3, frame: 'green', back: 'green'},
    {t: C0, w: 1.6, y0: 7.2, y1: 9.0, cols: 2, rows: 2, sill: true},
    {t: C0, w: 1.6, y0: 15.6, y1: 17.4, cols: 2, rows: 2, sill: true},
  ];
  skin(g, L, [{y0: 0, y1: 20.0, c: 'brick'}], wins, [true, true]);
  // white triangular head over the top window, a stone cap
  poly(b, g, C0, 17.4, [[-1.15, 0], [1.15, 0], [0, 1.2]], 0.12, 'stone', SK);
  slab(b, g, C0, 19.7, L + 0.2, 0.3, 0.3, 'stone', SK);
}
/** Lower brick block at a water corner (roof 15.7): two windows high up, the Krop figure on a console with a half-round basin (s06, s13). */
function cornerBlock(i: number, a: number, z: number, figureAt: number) {
  const {f} = edge(i), L = z - a;
  const g: Frame = {...f, origin: at(f, a, 0)};
  const wins: Win[] = [
    {t: L / 2, w: 1.5, y0: 9.4, y1: 10.8, cols: 3, rows: 2, sill: true},
    {t: L / 2, w: 1.5, y0: 12.0, y1: 13.4, cols: 3, rows: 2, sill: true},
  ];
  skin(g, L, [{y0: 0, y1: 15.3, c: 'brick'}], wins, [true, true]);
  slab(b, g, L / 2, 15.3, L + 0.1, 0.4, 0.3, 'stone', SK);
  consoleFigure(g, figureAt - a, 4.6);
  roofRail(g, 0.3, L - 0.3, 15.7, -0.3);
}
function consoleFigure(f: Frame, t: number, y: number) {
  slab(b, f, t, y - 1.0, 1.0, 1.0, 0.7, 'stone', SK);                                   // console block
  put(b, f, new T.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0, 0.55), t + 0.7, y - 0.4, SK, 'stone'); // half-round basin
  const {parts} = buildFigure({...POSES.standing(), height: 1.5, arms: {l: {pitch: 0.6, bend: 1.3}, r: {pitch: 0.3, bend: 1.0}}, skirt: {len: 0.5, flare: 1.1}}, 'stone');
  for (const p of parts) put(b, f, p.g.scale(1, 1, 0.6), t, y, SK + 0.35, 'stone');
  slab(b, f, t, y + 1.55, 0.6, 0.2, 0.45, 'stone', SK);                                  // canopy over the figure
}

export function buildHetSieraad(_w: number, _d: number, tools: BuildingTools & {mark?: (n: string) => void}) {
  b = tools;
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'RoofSurface') return;
    const ys = s.rings[0].map(p => p[1]);
    const flat = Math.max(...ys) - Math.min(...ys) < 0.4;
    roofPrism(b, s.rings, 'brick', CANOPY_PLANES.has(i) ? 'canopyGlass' : flat ? 'concrete' : 'slate');
  });
  tools.mark?.('shell');
  setSink(0);
  postjesweg();
  kostverlorenvaart();
  entranceFront();
  // north side of the entrance block (edge 9) with its half-round bay
  { const {f, len} = edge(9); blockSide(f, len, [0.9, 5.4], 3.1); }
  // water fronts, north to south-east: the north corner block, the tower, the oriel and the mansard wings
  cornerBlock(20, 0, 5.6, 1.2);
  waterTower(20, 5.6, 9.0);
  waterEdge(20, 9.0, undefined, 11.0);
  waterEdge(22);
  waterEdge(24);
  for (const i of [25, 26, 27, 28]) waterEdge(i);
  { const {f} = edge(27); triangleDormer(f, 0.2); }
  waterEdge(29);
  waterEdge(31);
  waterEdge(33, 0, 4.3, 2.2);
  waterTower(33, 4.3, 7.6);
  cornerBlock(33, 7.6, 12.9, 11.6);
  flush();
  void roofAtXZ; void leanSlab;
}
