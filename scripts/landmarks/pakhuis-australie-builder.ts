import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, ringFrame, setSink, slab, poly as wallPoly, segBand, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {raisedLettering} from './ornament-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import source from './pakhuis-australie-footprints.json';

/**
 * Pakhuis Australie and the Boston block, Purperhoedenveem / Piet Heinkade (one BAG pand, 0363100012139498, BAG year 2006).
 * The 1893-95 Blauwhoedenveem warehouse "Australie" (H. Moen, probably with G. van Arkel) burnt out in 2002 during its
 * conversion and was rebuilt to DKV architecten's design: the brick front and the cast-iron frame reconstructed, two dark
 * red brick end wings added, and the U-shaped Boston housing block (on the Piet Heinkade) bridging over the warehouse as a
 * four-storey bar that "floats" above it (Betonprijs 2005). Facts: nl.wikipedia "Pakhuis Australie" (CC BY-SA 4.0).
 *
 * Native frame of scripts/landmarks/pakhuis-australie-footprints.json (x east, z south, y up from the 3DBAG ground 1.43 m NAP).
 * Volumes (3DBAG LoD2.2 roof planes, CC BY 4.0, snapped to the BAG ring):
 *  - BLK  ring 1-2-3-10-11-0: warehouse (50.9 m) between two 9.4 m brick wings, roof 17.85 m, 22.4 m deep, on the IJhaven quay.
 *  - BAR  the 34.0 m roof north of the line 3-10: the bar over the warehouse, set back 7 m from the quay front, oversailing
 *         the wings by 2.5-3 m; soffit at 20.4 m over a recessed glass storey (2007 Commons photograph, scaled to 3DBAG).
 *  - WA/EA the arms of the U (34.0 m, 3.4 m shop storey + ten storeys) down to the Piet Heinkade.
 *  - COURT the courtyard between the arms: a garden deck at 4.0 m on the shop storey (PDOK 2023 orthophoto), glass screen and
 *         frame to 7.4 m on the street (w02-196).
 * Openings read from the rectified panorama crops of scripts/landmarks/landmark-brief.ts (Gemeente Amsterdam, CC BY 4.0) and
 * Wikimedia Commons "Pakhuis Australie Amsterdam 2007 gezien vanaf het Java-eiland.jpg" (KuifjeNL, public domain); see
 * pakhuis-australie-inventory.json.
 */
type V2 = [number, number];
type C = 'pink' | 'brick' | 'red' | 'ochre' | 'concrete' | 'stone' | 'glass' | 'canopyGlass' | 'frame' | 'bronze' | 'white' | 'slate' | 'green' | 'dark' | 'greyBrick';
const R = (source as {nativeRing: number[][]}).nativeRing.map(p => [p[0], p[1]] as V2);
let b: BuildingTools;

/* ------------------------------------------------------------------ plan */
const N = R; // BAG ring vertices 0-11
const H_WH = 17.85, SOFFIT = 20.4, H_TOP = 34.0, DECK = 4.0, FRAME_TOP = 7.4;
const lineAt = (a: V2, c: V2, u: number): V2 => {
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
  return [a[0] + (c[0] - a[0]) * u / l, a[1] + (c[1] - a[1]) * u / l];
};
/** Foot of the perpendicular from p onto the line a-c. */
const project = (p: V2, a: V2, c: V2): V2 => {
  const dx = c[0] - a[0], dz = c[1] - a[1], s = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz);
  return [a[0] + dx * s, a[1] + dz * s];
};
// courtyard corners: the 34 m roof's hole edge (3DBAG) on the line 3-10 (north) and on the south front (6-7)
const C0 = project([-8.622, -5.857], N[3], N[10]), C1 = project([10.666, -0.219], N[3], N[10]);
const C2 = project([2.94, 26.963], N[6], N[7]), C3 = project([-16.656, 21.262], N[6], N[7]);
// the bar's outline from the 34 m roof ring: NW and NE corners, west and east ends on the wings' south-face line
const B0: V2 = [-21.405, -25.677], B1: V2 = [32.813, -10.114];
const B2 = project([28.209, 4.742], N[10], N[11]), B5 = project([-25.964, -10.928], N[2], N[3]);
const BLK: V2[] = [N[1], N[2], N[3], N[10], N[11], N[0]];
/**
 * The arms' courtyard walls stand 3.8 m behind the 3DBAG roof edge: w02-196 shows 14.8 m of grid on each arm's street
 * face (two 7.4 m bays) where the roof is 18.6 m wide; the rest is the depth of the stacked courtyard balconies, under
 * the roof's overhang.
 */
const GALLERY = 3.8;
const WA0: V2[] = [N[3], N[4], N[5], N[6], C3, C0];
const EA0: V2[] = [C1, C2, N[7], N[8], N[9], N[10]];
const WA: V2[] = inset(WA0, [0, 0, 0, 0, GALLERY, 0]);
const EA: V2[] = inset(EA0, [GALLERY, 0, 0, 0, 0, 0]);
const K0 = WA[5], K1 = EA[0], K2 = EA[1], K3 = WA[4];                                                       // courtyard at the walls
const BAR: V2[] = [B0, B1, B2, N[10], K1, K0, N[3], B5];
const COURT: V2[] = [K0, K1, K2, K3];

/* ------------------------------------------------------------------ geometry helpers (as marnixbad-builder.ts) */
function inset(polygon: V2[], off: number[]): V2[] {
  const n = polygon.length, lines = polygon.map((a, i) => {
    const c = polygon[(i + 1) % n], {f} = ringFrame(polygon, i);
    return {p: [a[0] - f.n[0] * off[i], a[1] - f.n[1] * off[i]] as V2, d: [c[0] - a[0], c[1] - a[1]] as V2};
  });
  return polygon.map((_, i) => meet(lines[(i + n - 1) % n], lines[i]));
}
function meet(l1: {p: V2; d: V2}, l2: {p: V2; d: V2}): V2 {
  const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
  if (Math.abs(den) < 0.01 * Math.hypot(...l1.d) * Math.hypot(...l2.d)) return l2.p;
  const s = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
  return [l1.p[0] + l1.d[0] * s, l1.p[1] + l1.d[1] * s];
}
const along = (f: Frame, p: V2) => (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];

/** Collects triangles per colour and hands each colour to BuildingTools once. */
class Mesh {
  private tris = new Map<C, number[]>();
  quad(f: Frame, q: WallQuad, c: C) {
    const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o]);
    const a = this.tris.get(c) ?? [];
    a.push(...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
    this.tris.set(c, a);
  }
  /** Front-facing rectangle at offset o (out of the wall), t0..t1 along, y0..y1 up. */
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: C) {
    this.quad(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], normal: [0, 0, 1]}, c);
  }
  flush() {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c);
    }
    this.tris.clear();
  }
}
let m: Mesh;
type Cut = HoledOpening & {back: C; reveal?: C};
/** Wall on polygon edge i from y0 to y1, optionally only t in [ta, tb], openings relative to ta. */
function wall(polygon: V2[], i: number, y0: number, y1: number, c: C, cuts: Cut[] = [], ta?: number, tb?: number): {f: Frame; len: number} {
  const {f, len} = ringFrame(polygon, i), a = ta ?? 0, z = tb ?? len;
  const g: Frame = {...f, origin: [f.origin[0] + f.tangent[0] * a, f.origin[1] + f.tangent[1] * a]};
  const hw = holedWall(z - a, y0, y1, cuts);
  for (const q of hw.face) m.quad(g, q, c);
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(g, q, cuts[k].reveal ?? c)));
  hw.backs.forEach((q, k) => m.quad(g, q, cuts[k].back));
  return {f: g, len: z - a};
}
/** Box on a wall frame: t centre, y bottom, from o0 to o1 out of the wall. */
function bar(f: Frame, t: number, y: number, w: number, h: number, o0: number, o1: number, c: C) {
  put(b, f, new T.BoxGeometry(w, h, o1 - o0).translate(0, h / 2, (o1 - o0) / 2), t, y, o0, c);
}
function roof(polygon: V2[], h: number, c: C) {
  b.add(upwardRoofPlane(new T.Shape(polygon.map(p => new T.Vector2(p[0], p[1]))), h), c);
}
function soffit(polygon: V2[], h: number, c: C) {
  b.add(new T.ShapeGeometry(new T.Shape(polygon.map(p => new T.Vector2(p[0], p[1])))).rotateX(Math.PI / 2).translate(0, h, 0), c);
}
/** Coping on the listed top edges of a polygon: 10 cm proud, 15 cm over the roof. */
function coping(polygon: V2[], h: number, edges: number[], c: C = 'stone') {
  for (const i of edges) {
    const {f, len} = ringFrame(polygon, i);
    bar(f, len / 2, h - 0.18, len + 0.2, 0.33, -0.3, 0.1, c);
  }
}
/** Round head of an arched opening: the two brick horns between the semicircle and its square, flush in the cut hole. */
function archHorns(f: Frame, t: number, spring: number, r: number, c: C) {
  const s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, r); s.lineTo(r, r); s.lineTo(r, 0); s.absarc(0, 0, r, 0, Math.PI, false);
  put(b, f, new T.ShapeGeometry(s, 6), t, spring, 0, c);
}
const hash = (k: number) => ((k * 2654435761) >>> 0) % 100;

/* ------------------------------------------------------------------ the warehouse front and wings (BLK) */
/** Warehouse storeys (w01-16 at 28.4 px/m, base on the quay): twin round-headed windows. */
const WH_ROWS: [number, number][] = [[1.27, 3.25], [4.8, 6.65], [7.75, 9.7], [10.85, 12.8], [13.6, 15.35]];
const WIN_W = 0.81, PAIR = 0.57;
/** Wing storeys (w01-16, Commons 2007): tall ground windows, four storeys aligned with the warehouse. */
const WING_ROWS: [number, number][] = [[0.3, 3.0], [4.7, 6.8], [7.65, 9.75], [10.75, 12.85], [13.5, 15.6]];
const SLOT_W = 2.3, SLOT_Y = 4.6, SLOT_SPRING = 14.55, SLOT_D = 1.2;
/** Loggia floors (balcony trays), w01-16: at the sills of storeys 1-4. */
const FLOORS = [4.75, 7.7, 10.8, 13.55];

/** Window cuts of a wing face (columns `cols` from the wall's t = 0), balcony columns listed. */
function wingCuts(cols: number[]): Cut[] {
  const cuts: Cut[] = [];
  for (const u of cols) for (const [y0, y1] of WING_ROWS) cuts.push({t0: u - 0.65, t1: u + 0.65, y0, y1, depth: 0.2, back: 'glass'});
  return cuts;
}
function wingDetails(f: Frame, cols: number[], balconyCols: number[]) {
  for (const u of cols) for (const [y0, y1] of WING_ROWS) {
    m.rect(f, u - 0.02, u + 0.02, y0, y1, -0.14, 'frame');                                             // mullion
    if (y1 - y0 > 2.3) m.rect(f, u - 0.65, u + 0.65, y0 + 2.0, y0 + 2.05, -0.14, 'frame');           // transom
    slab(b, f, u, y0 - 0.2, 1.4, 0.1, 0.07, 'stone');                                                   // sill
  }
  for (const u of balconyCols) for (const [y0] of WING_ROWS.slice(1)) balcony(f, u, y0 - 0.05, 2.3, 1.1);
}
/** Steel balcony tray (w01-16, w07-196): slab, front and side rails, balusters as thin panels. */
function balcony(f: Frame, t: number, y: number, w: number, d: number, back = 0) {
  bar(f, t, y - 0.16, w, 0.16, back, d, 'bronze');
  bar(f, t, y + 0.95, w, 0.05, d - 0.05, d, 'bronze');
  for (const s of [-1, 1]) bar(f, t + s * (w / 2 - 0.025), y, 0.05, 1.0, 0.02, d, 'bronze');
  for (let u = -w / 2 + 0.45; u < w / 2 - 0.2; u += 0.45) m.rect(f, t + u - 0.01, t + u + 0.01, y, y + 0.95, d - 0.02, 'bronze');
  m.rect(f, t - w / 2, t + w / 2, y, y + 0.12, d - 0.02, 'bronze');
}

function warehouseFront() {
  const edge = 5, {f: f0, len} = ringFrame(BLK, edge);
  const westAt0 = f0.tangent[0] > 0;                                                                     // t runs west -> east
  const T_ = (u: number) => (westAt0 ? u : len - u);                                                     // u: metres from the west end
  const WING = 9.4, mid = (WING + len - WING) / 2, step = 10.45 / 2;
  const pairs = [-2, -1, 0, 1, 2].map(k => mid + k * 2 * step);
  const slots = [-1.5, -0.5, 0.5, 1.5].map(k => mid + k * 2 * step);
  const cuts: Cut[] = [];
  for (const c of pairs) for (const [y0, y1] of WH_ROWS) for (const s of [-1, 1])
    cuts.push({t0: T_(c + s * PAIR) - WIN_W / 2, t1: T_(c + s * PAIR) + WIN_W / 2, y0, y1, depth: 0.25, back: 'glass'});
  for (const c of slots) {
    // one cut per storey: the 0.3 m of wall left between them sits behind the balcony tray, so the loggia reads as one slot
    FLOORS.forEach((y, k) => cuts.push({t0: T_(c) - SLOT_W / 2, t1: T_(c) + SLOT_W / 2, y0: k ? y : SLOT_Y, y1: k < 3 ? FLOORS[k + 1] - 0.3 : SLOT_SPRING + SLOT_W / 2, depth: SLOT_D, back: 'glass', reveal: 'brick'}));
    cuts.push({t0: T_(c) - 1.25, t1: T_(c) + 1.25, y0: 0.15, y1: 3.0, depth: 0.4, back: 'glass'});
  }
  const wingW = [2.9, 6.4], wingE = [len - 6.4, len - 2.9];
  const wingCols = [...wingW, ...wingE].map(T_);
  cuts.push(...wingCuts(wingCols));
  // walls: wings in dark red brick, the warehouse in its brown brick (one holed wall per material run)
  const runs: [number, number, C][] = [[0, WING, 'red'], [WING, len - WING, 'brick'], [len - WING, len, 'red']];
  for (const [u0, u1, c] of runs) {
    const ta = Math.min(T_(u0), T_(u1)), tb = Math.max(T_(u0), T_(u1));
    const mine = cuts.filter(k => k.t0 >= ta - 1e-6 && k.t1 <= tb + 1e-6).map(k => ({...k, t0: k.t0 - ta, t1: k.t1 - ta}));
    wall(BLK, edge, 0, H_WH, c, mine, ta, tb);
  }
  const f = f0;
  // twin windows: round heads, a white-grey frame bar between the lights' glazing bars
  for (const c of pairs) for (const [y0, y1] of WH_ROWS) for (const s of [-1, 1]) {
    const t = T_(c + s * PAIR);
    archHorns(f, t, y1 - WIN_W / 2, WIN_W / 2, 'brick');
    m.rect(f, t - 0.02, t + 0.02, y0, y1 - 0.3, -0.12, 'frame');
    m.rect(f, t - WIN_W / 2, t + WIN_W / 2, y0 + (y1 - y0) * 0.55, y0 + (y1 - y0) * 0.55 + 0.04, -0.12, 'frame');
  }
  // loading-door slots turned loggias: round head, glazed doors per storey at the back, balconies (w01-16 thumb)
  for (const c of slots) {
    const t = T_(c);
    archHorns(f, t, SLOT_SPRING, SLOT_W / 2, 'brick');
    for (const y of FLOORS) {
      m.rect(f, t - 0.02, t + 0.02, y, y + 2.2, -SLOT_D + 0.14, 'frame');
      balcony(f, t, y, SLOT_W + 0.3, 1.3);
    }
    archHorns(f, t, 3.0 - 1.25, 1.25, 'brick');
    m.rect(f, t - 0.02, t + 0.02, 0.15, 1.75, -0.3, 'frame');
  }
  wingDetails(f, wingCols, [T_(6.4), T_(len - 6.4)]);
  // buff bands: sill and head courses of every storey, broken at the slots and ground doors (w01-16)
  const gaps = slots.map(c => [c - 1.3, c + 1.3] as [number, number]);
  const runsBetween = (u0: number, u1: number, withGround: boolean) => {
    const cutsU = withGround ? gaps : [];
    const out: [number, number][] = []; let a = u0;
    for (const [g0, g1] of cutsU) { if (g0 > a) out.push([a, g0]); a = g1; }
    if (u1 > a) out.push([a, u1]);
    return out;
  };
  for (const [k, [y0, y1]] of WH_ROWS.entries()) {
    for (const y of [y0 - 0.2, y1 + 0.12]) {
      const inSlot = y > SLOT_Y - 0.05 || y < 3.05;
      for (const [u0, u1] of runsBetween(WING, len - WING, inSlot)) slab(b, f, (T_(u0) + T_(u1)) / 2, y, u1 - u0, 0.12, 0.06, 'ochre');
    }
    if (k === 4) for (const c of pairs) segBand(b, f, T_(c), y1 + 0.3, 2.9, 0.45, 0.22, 0.07, 'ochre');
  }
  // shallow pilasters flanking each window pair, up to the frieze
  for (const c of pairs) for (const s of [-1, 1]) slab(b, f, T_(c + s * 1.45), 0.3, 0.3, 15.8, 0.07, 'brick');
  // cornice: buff course, corbel table, projecting cap (w01-16 frieze 16.1-17.2 m)
  const wl = len - 2 * WING, wc = T_(mid);
  slab(b, f, wc, 16.05, wl, 0.14, 0.08, 'ochre');
  for (let u = WING + 0.3; u < len - WING - 0.2; u += 0.55) slab(b, f, T_(u), 16.3, 0.24, 0.32, 0.16, 'ochre');
  slab(b, f, wc, 16.9, wl, 0.35, 0.12, 'brick');
  slab(b, f, wc, 17.4, wl + 0.3, 0.6, 0.35, 'stone');
  for (const c of [...pairs.map(c => c - 1.45), ...pairs.map(c => c + 1.45)]) slab(b, f, T_(c), 16.25, 0.4, 0.9, 0.22, 'ochre');  // consoles
  for (const [u0, u1] of [[0, WING], [len - WING, len]]) slab(b, f, (T_(u0) + T_(u1)) / 2, 17.65, u1 - u0, 0.35, 0.1, 'stone');
  // cast-iron wall anchors between the window pairs and the loggias, four rows (w01-16)
  const anchor: [number, number][] = [[-0.06, 0], [0.06, 0], [0.06, 0.38], [0.24, 0.38], [0.24, 0.5], [0.06, 0.5], [0.06, 0.9], [-0.06, 0.9], [-0.06, 0.5], [-0.24, 0.5], [-0.24, 0.38], [-0.06, 0.38]];
  for (const c of slots) for (const s of [-1, 1])                                                       // either side of each loggia
    for (const y of [3.45, 6.55, 9.65, 12.65]) wallPoly(b, f, T_(c + s * step / 2), y, anchor, 0.06, 'bronze');
  // AUSTRALIE: white enamel name board, black letters, between a loggia and the centre pair at the fourth storey (w01-16)
  const su = mid - step / 2 - 0.05, st = T_(su);
  slab(b, f, st, 11.05, 2.4, 0.72, 0.08, 'pink');                                                      // white enamel (tint)
  const txt = raisedLettering({text: 'AUSTRALIE', heightM: 0.42, maxWidthM: 2.1, depthM: 0.03});
  put(b, f, txt.geometry, st - txt.widthM / 2, 11.2, 0.08, 'bronze');
}

/** End and south faces of the wings (w03-286, w04-106, w07-196, w08-196): brick, window columns, a balcony column. */
function wingFaces() {
  for (const edge of [0, 4]) {                                                                           // west and east ends, 22.4 m
    const {f, len} = ringFrame(BLK, edge);
    const nAt0 = Math.abs(along(f, edge === 0 ? N[1] : N[0])) < 1;                                      // t = 0 at the quay end?
    const U = (u: number) => (nAt0 ? u : len - u);
    const cols = [2.6, 8.1, 13.6, 19.1].map(U);
    wall(BLK, edge, 0, H_WH, 'red', wingCuts(cols));
    wingDetails(f, cols, [U(2.6), U(13.6)]);
    slab(b, f, len / 2, 17.65, len, 0.35, 0.1, 'stone');
  }
  for (const edge of [1, 3]) {                                                                           // south faces beside the arms, 9.4 m
    const {f, len} = ringFrame(BLK, edge);
    const armEnd = edge === 1 ? N[3] : N[10];
    const fromArm = along(f, armEnd) < len / 2;
    const U = (u: number) => (fromArm ? u : len - u);
    const cols = [1.6, 3.7].map(U);
    wall(BLK, edge, 0, H_WH, 'red', wingCuts(cols));
    wingDetails(f, cols, []);
    for (const [y0] of WING_ROWS.slice(1)) balcony(f, U(2.65), y0 - 0.05, 4.2, 1.2);
    slab(b, f, len / 2, 17.65, len, 0.35, 0.1, 'stone');
  }
}

/** Warehouse back between the arms, over the garden deck (w02-196 courtyard view): pairs, two tall glazed arches, frieze. */
function warehouseBack() {
  const {f: f0} = ringFrame(BLK, 2);
  const a = along(f0, K0), z = along(f0, K1), ta = Math.min(a, z), tb = Math.max(a, z), w = tb - ta;
  const cuts: Cut[] = [];
  const pairs = [2.0, 10.0, 18.0].map(u => u * w / 20), arches = [6.0, 14.0].map(u => u * w / 20);
  for (const c of pairs) for (const [y0, y1] of WH_ROWS.slice(1)) for (const s of [-1, 1])
    cuts.push({t0: c + s * PAIR - WIN_W / 2, t1: c + s * PAIR + WIN_W / 2, y0, y1, depth: 0.25, back: 'glass'});
  for (const c of arches) for (const [y0, y1] of WH_ROWS.slice(1)) cuts.push({t0: c - 1.0, t1: c + 1.0, y0, y1: y1 + 0.3, depth: 0.3, back: 'glass'});
  const {f} = wall(BLK, 2, DECK, H_WH, 'brick', cuts, ta, tb);
  for (const c of pairs) for (const [, y1] of WH_ROWS.slice(1)) for (const s of [-1, 1]) archHorns(f, c + s * PAIR, y1 - WIN_W / 2, WIN_W / 2, 'brick');
  for (const c of arches) for (const [, y1] of WH_ROWS.slice(1)) { archHorns(f, c, y1 + 0.3 - 1.0, 1.0, 'brick'); m.rect(f, c - 0.02, c + 0.02, y1 - 2.2, y1 - 0.7, -0.2, 'frame'); }
  for (const [y0, y1] of WH_ROWS.slice(1)) for (const y of [y0 - 0.2, y1 + 0.32]) slab(b, f, w / 2, y, w, 0.12, 0.06, 'ochre');
  slab(b, f, w / 2, 16.05, w, 0.14, 0.08, 'ochre');
  for (let u = 0.3; u < w - 0.2; u += 0.55) slab(b, f, u, 16.3, 0.24, 0.32, 0.16, 'ochre');
  slab(b, f, w / 2, 16.9, w, 0.35, 0.12, 'brick');
}

/* ------------------------------------------------------------------ Boston: bar and arms */
/** Arm storeys (w05-106, 50 px/m): shop storey to 3.4 m, ten storeys of 2.0 m ribbon windows on a 2.95 m pitch. */
const ARM_ROWS: [number, number][] = [...Array(10)].map((_, k) => [3.7 + 2.95 * k, 5.7 + 2.95 * k]);
/** Bar storeys (Commons 2007, scaled to the 3DBAG 34.0 m roof): four rows over a 1.6 m bottom slab. */
const BAR_ROWS: [number, number][] = [[22.0, 24.1], [25.0, 27.2], [28.0, 30.15], [31.0, 33.35]];
/** Bay widths of the bar's north face, west to east (Commons 2007 and w01-16.alt: narrower end bays). */
const BAR_NORTH_BAYS = [7.0, 8.6, 8.6, 8.6, 8.6, 8.4, 6.5];

/**
 * Concrete grid face (w05-106, w02-196): piers and spandrels of light precast concrete, one ribbon window per bay and
 * storey, 0.25 m deep, dark mullions every ~1.1 m and a rail across the lower third; about one opening in five closed by a
 * grey sliding screen. `ground`: the shop storey's piers on a 3.6 m pitch with recessed glazing.
 */
function gridFace(polygon: V2[], edge: number, y0: number, rows: [number, number][], o: {bays?: number[]; ground?: boolean; seed?: number; ta?: number; tb?: number} = {}) {
  const {len: full} = ringFrame(polygon, edge), ta = o.ta ?? 0, tb = o.tb ?? full, len = tb - ta;
  const nb = Math.max(1, Math.round(len / 7.2));
  const widths = o.bays ? o.bays.map(w => w * len / o.bays!.reduce((s, x) => s + x, 0)) : Array(nb).fill(len / nb);
  const cuts: Cut[] = [];
  let t = 0, k = o.seed ?? 0;
  const spans: [number, number][] = [];
  for (const w of widths) { spans.push([t + 0.25, t + w - 0.25]); t += w; }
  for (const [y, y1] of rows) for (const [t0, t1] of spans) {
    if (t1 - t0 < 0.8) continue;
    cuts.push({t0, t1, y0: y, y1, depth: 0.25, back: hash(++k) < 18 ? 'dark' : 'glass', reveal: 'concrete'});
  }
  const shops: [number, number][] = [];
  if (o.ground) {
    const np = Math.max(1, Math.round(len / 3.6)), p = len / np;
    for (let i = 0; i < np; i++) shops.push([i * p + 0.25, (i + 1) * p - 0.25]);
    for (const [t0, t1] of shops) cuts.push({t0, t1, y0: 0.25, y1: 3.0, depth: 0.5, back: hash(++k) < 30 ? 'greyBrick' : 'glass', reveal: 'concrete'});
  }
  const {f} = wall(polygon, edge, y0, H_TOP, 'concrete', cuts, ta, tb);
  for (const c of cuts) {
    if (c.y0 < 3.1) continue;                                                                            // shop fronts: one pane per bay
    if (c.back === 'glass') {
      const n = Math.max(1, Math.round((c.t1 - c.t0) / 1.1));
      for (let i = 1; i < n; i++) { const tm = c.t0 + (c.t1 - c.t0) * i / n; m.rect(f, tm - 0.03, tm + 0.03, c.y0, c.y1, -0.12, 'frame'); }
      m.rect(f, c.t0, c.t1, c.y0 + 0.85, c.y0 + 0.9, -0.1, 'frame');                                 // rail of the French windows
    }
    m.rect(f, c.t0, c.t1, c.y1 - 0.12, c.y1, -0.1, 'frame');                                           // head (screen box)
  }
  return f;
}
/** Continuous balcony or gallery slabs on a courtyard face (w02-196): concrete slab 1.6 m deep, glass balustrade. */
function galleries(polygon: V2[], edge: number, rows: [number, number][], depth = 1.6) {
  const {f, len} = ringFrame(polygon, edge);
  for (const [y0] of rows) {
    bar(f, len / 2, y0 - 0.45, len, 0.25, 0, depth, 'concrete');
    bar(f, len / 2, y0 - 0.2, len - 0.1, 1.0, depth - 0.12, depth - 0.06, 'canopyGlass');
  }
}

function bar_() {
  // recessed glass storey under the bar (Commons 2007: dark glazing behind the soffit)
  const REC = inset(BAR, [3.0, 2.5, 0, 0, 0, 0, 0, 2.5]);
  for (const i of [0, 1, 2, 4, 6, 7]) {
    const {f, len} = wall(REC, i, H_WH, SOFFIT, 'glass');
    for (let t = 1.4; t < len - 0.3; t += 1.4) m.rect(f, t - 0.04, t + 0.04, H_WH, SOFFIT, 0.06, 'frame');
  }
  // the bar: north face with the measured bays, ends and courtyard face on the grid
  gridFace(BAR, 0, SOFFIT, BAR_ROWS, {bays: BAR_NORTH_BAYS, seed: 100});
  for (const i of [1, 7]) gridFace(BAR, i, SOFFIT, BAR_ROWS, {seed: 200 + i});
  for (const i of [2, 6]) wall(BAR, i, SOFFIT, H_TOP, 'concrete');
  gridFace(BAR, 4, SOFFIT, BAR_ROWS, {seed: 300});
  galleries(BAR, 4, BAR_ROWS.slice(1));
  soffit(BAR, SOFFIT, 'concrete');
  roof(BAR, H_TOP, 'slate');
  coping(BAR, H_TOP, [0, 1, 2, 4, 6, 7]);
}

function arms() {
  // west arm: 0 N3-N4 (6.7 m, over the passage), 1 the 3 m step, 2 N5-N6 (22 m), 3 south (Piet Heinkade), 4 courtyard
  gridFace(WA, 0, 0, ARM_ROWS, {ground: true, seed: 400});
  wall(WA, 1, 0, H_TOP, 'concrete');
  gridFace(WA, 2, 0, ARM_ROWS, {ground: true, seed: 420});
  gridFace(WA, 3, 0, ARM_ROWS, {ground: true, seed: 440});
  gridFace(WA, 4, DECK, ARM_ROWS.slice(1), {seed: 460});
  galleries(WA, 4, ARM_ROWS.slice(1), GALLERY - 0.1);
  // east arm: 0 courtyard, 1 south, 2 N7-N8 east (w05-106), 3 step, 4 N9-N10
  gridFace(EA, 0, DECK, ARM_ROWS.slice(1), {seed: 500});
  galleries(EA, 0, ARM_ROWS.slice(1), GALLERY - 0.1);
  gridFace(EA, 1, 0, ARM_ROWS, {ground: true, seed: 520});
  gridFace(EA, 2, 0, ARM_ROWS, {ground: true, seed: 540});
  wall(EA, 3, 0, H_TOP, 'concrete');
  gridFace(EA, 4, 0, ARM_ROWS, {ground: true, seed: 560});
  for (const P of [WA0, EA0]) roof(P, H_TOP, 'slate');
  // underside of the roof over the top balconies
  soffit([WA0[4], WA0[5], WA[5], WA[4]], H_TOP - 0.6, 'concrete');
  soffit([EA[0], EA[1], EA0[1], EA0[0]], H_TOP - 0.6, 'concrete');
  for (const [P, e] of [[WA0, 4], [EA0, 0]] as const) { const {f, len} = ringFrame(P, e); bar(f, len / 2, H_TOP - 0.6, len, 0.6, -0.2, 0.05, 'concrete'); }
  coping(WA0, H_TOP, [0, 1, 2, 3, 4]);
  coping(EA0, H_TOP, [0, 1, 2, 3, 4]);
  // rooftop plant rooms and lift heads (3DBAG roofs at 35.5-35.9 m)
  const boxes: [V2[], number][] = [
    [[[16.661, 4.034], [16.024, 5.756], [13.428, 5.118], [14.237, 2.676]], 35.9],
    [[[-14.573, -2.302], [-15.943, -2.826], [-15.316, -5.766], [-13.107, -5.098], [-12.666, -4.074]], 35.8],
    [[[14.869, -1.354], [15.596, -1.172], [16.074, -0.465], [14.891, 0.702], [14.19, -1.13]], 35.6],
    [[[16.925, -0.842], [18.102, -0.481], [17.572, 1.05], [16.422, 0.901]], 35.6],
  ];
  for (const [p, h] of boxes) {                                                                        // walls and a lid, no floor on the roof
    p.forEach((_, i) => wall(p, i, H_TOP, h, 'stone'));
    roof(p, h, 'stone');
  }
}

/** Courtyard on the Piet Heinkade (w02-196, PDOK 2023 orthophoto): shop storey, garden deck, glass screen in a concrete frame. */
function courtyard() {
  const {f, len} = ringFrame(COURT, 2);
  const np = Math.max(1, Math.round(len / 3.9)), p = len / np, cuts: Cut[] = [];                      // seven bays on w02-196
  for (let i = 0; i < np; i++) cuts.push({t0: i * p + 0.25, t1: (i + 1) * p - 0.25, y0: 0.25, y1: 3.0, depth: 0.5, back: i % 3 === 1 ? 'greyBrick' : 'glass', reveal: 'concrete'});
  wall(COURT, 2, 0, DECK, 'concrete', cuts);
  for (let i = 0; i <= np; i++) bar(f, Math.min(len - 0.2, Math.max(0.2, i * p)), DECK, 0.4, FRAME_TOP - DECK, -0.4, 0, 'concrete');
  bar(f, len / 2, FRAME_TOP - 0.4, len, 0.4, -0.4, 0, 'concrete');
  bar(f, len / 2, DECK, len - 0.1, FRAME_TOP - 0.45 - DECK, -0.3, -0.24, 'glass');
  roof(COURT, DECK, 'green');
  // timber deck along the warehouse back and the two round roof lights in the garden (orthophoto); the deck boards stand
  // 0.1 m clear of the garden plane on their joists
  const {f: fn} = ringFrame(COURT, 0);
  const deck: V2[] = [K0, K1, [K1[0] - fn.n[0] * 3.2, K1[1] - fn.n[1] * 3.2], [K0[0] - fn.n[0] * 3.2, K0[1] - fn.n[1] * 3.2]];
  const g = new T.ExtrudeGeometry(new T.Shape(deck.map(q => new T.Vector2(q[0], q[1]))), {depth: 0.15, bevelEnabled: false});
  g.rotateX(Math.PI / 2); g.translate(0, DECK + 0.25, 0); g.computeVertexNormals(); b.add(g, 'ochre');
  const cx = (K0[0] + K1[0] + K2[0] + K3[0]) / 4, cz = (K0[1] + K1[1] + K2[1] + K3[1]) / 4;
  for (const s of [-1, 1]) b.add(new T.CylinderGeometry(0.75, 0.75, 1.0, 14).translate(cx + s * 3.0 * 0.96, DECK + 0.6, cz - 4 + s * 3.0 * 0.28), 'concrete');
}

/* ------------------------------------------------------------------ build */
export function buildPakhuisAustralie(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh();
  setSink(0.15, true);
  warehouseFront();
  wingFaces();
  warehouseBack();
  roof(BLK, H_WH, 'slate');
  bar_();
  arms();
  courtyard();
  m.flush();
  setSink(0);
}
