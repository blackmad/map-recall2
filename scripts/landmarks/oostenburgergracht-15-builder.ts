import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, poly, put, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {relievingArchRow} from './relieving-arch-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './oostenburgergracht-15-footprints.json';

/**
 * OOSTENBURGERGRACHT 15-17, Oostelijke Eilanden (BAG pand 0363100012180539, BAG 1919; gemeentelijk monument 206026): the
 * former St. Willibrordusschool, a double Catholic school designed by P.J. Bekkers in 1915 and built after the war by
 * Jac. Duncker (1919). Register: "zeer sober en rationeel ... geheel gedomineerd door de grote ramen van de klaslokalen in een
 * vrijwel ongedecoreerd muurvlak", two wings either side of a middle risalit "die nauwelijks risaleert", a high plinth of
 * Bavarian granite that also frames the two porticoes, red-brown brick in stacked bond, the sandstone springers of the
 * three shallow relieving arches over each big window opening (split in three by two brick piers), cross windows with
 * four-pane fanlights over six-pane lower lights, stone sills, the very flat spout gable with a cross over the risalit, a
 * statue of St. Willibrord on the middle axis between the porticoes, and the two tile tableaux "St. Canisius" and
 * "St. Vincentius". The chapel wing reaches back to the Wittenburgervaart.
 *
 * Massing: the 3DBAG LoD2.2 shell (oostenburgergracht-15-footprints.json, bag-shell-prepare.ts) as scanned: the 17.2 m
 * school block on the street, the 15.5-16 m stair and corridor block behind it and the 12.3 m chapel wing to the water.
 * Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0), per item in oostenburgergracht-15-inventory.json; positions are
 * metres along each facade-ring edge from the viewer's left (ringFrame):
 *  - Oostenburgergracht front (edge 0, w02-210): recording_2025-06-19_07-14-50_01399 (2025) and
 *    TMX7316010203-002048_pano_0001_000860 (2021, leaf-off), rectified at 50 px/m; the building spans 0-1028 px, so
 *    t = x * 21.19 / 1028; heights from the pavement (y 897 px) to the 3DBAG parapet 17.2 m (y 83 px);
 *  - the chapel bay on the Wittenburgervaart (edges 12-13, w04-31): TMX7316010203-001982_pano_0000_000811 (2021) and
 *    TMX7316010203-000353_pano_0002_000430 (2017), rectified at 50 px/m;
 *  - the rear of the stair block (edges 2-7): TMX7316010203-001982_pano_0000_000812 (2021, a pitched view from the water).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
const S = src.surfaces;

/** Street-front storey rows (window sill to head), w02-210 2021. */
const ROW_G: [number, number] = [1.84, 5.11];
const ROW_1: [number, number] = [6.91, 10.18];
const ROW_2: [number, number] = [11.98, 15.25];
/** Window width and the three-light groups: wings and risalit at a 1.9 m pitch, symmetric about the statue (10.57 m). */
const WIN = 1.54;
const AXIS = 10.57;
const group = (c: number) => [c - 1.9, c, c + 1.9];
const LEFT = group(AXIS - 6.91), MID = group(AXIS), RIGHT = group(AXIS + 6.91);
/** The risalit: 7.5 m wide, 0.1 m proud ("nauwelijks"), its spout gable rising from 17.98 m at the sides to 18.89 m. */
const RIS = {c: AXIS, w: 7.5, out: 0.1};
const PARAPET = 17.2;

const edge = (i: number) => ringFrame(ring, i);
const pt = (f: Frame, t: number, d: number): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * d, f.origin[1] + f.tangent[1] * t + f.n[1] * d];
const roofAt = (f: Frame, t: number, d: number) => { const [x, z] = pt(f, t, d); return roofHeightAt(S, x, z); };

export function buildOostenburgergracht15(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'dark'});
  const sink0 = getSink();
  setSink(0.12, true);
  streetFront(b);
  chapelBay(b);
  stairBlockRear(b);
  setSink(sink0);
}

/** Thin glazing bar: no sink and shallower than it is wide (the openings audit reads its face, not its sides). */
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, 0.04, 'frame', out);
  setSink(s0, true);
}

/**
 * A cream timber window: the frame, the pane and its glazing from paneGrid (src/canalRecall/landmarks/paneGrid.ts). The
 * classroom windows are kruiskozijnen (register): a heavy mullion and transom, the four-pane fanlight over six-pane lower
 * lights, i.e. 4 x 5 panes with the heavy transom over the third row (w02-210 2021 at 2.5x: the fanlight is 0.4 of the
 * height).
 */
function win(b: BuildingTools, f: Frame, t: number, [y0, y1]: [number, number], w: number, o: {cols?: number; rows?: number; transomRow?: number; weights?: number[]; out?: number; cross?: boolean} = {}) {
  const out = o.out ?? 0, h = y1 - y0, cols = o.cols ?? 2, rows = o.rows ?? 2;
  slab(b, f, t, y0 - 0.06, w + 0.12, h + 0.12, 0.08, 'frame', out);
  slab(b, f, t, y0 + 0.05, w - 0.1, h - 0.1, 0.04, 'glass', out + 0.08);
  const grid = paneGrid({width: w - 0.1, height: h - 0.1, cols, rows, bar: 0.04, frame: 0, ...(o.transomRow ? {transomRows: [o.transomRow], transom: 0.1} : {}), ...(o.weights ? {rowWeights: o.weights} : {})});
  for (const m of grid) bar(b, f, t + m.x, y0 + 0.05 + m.y, m.w, m.h, out + 0.12);
  if (o.cross) bar(b, f, t, y0 + 0.05, 0.1, h - 0.1, out + 0.12);
}
/** The classroom cross window: 4 x 5 panes, heavy transom over the third row, heavy mullion. */
const kruis = (b: BuildingTools, f: Frame, t: number, row: [number, number], out = 0) =>
  win(b, f, t, row, WIN, {cols: 4, rows: 5, transomRow: 3, weights: [1, 1, 1, 0.95, 0.95], out, cross: true});

/** One three-light group: windows, relieving arches on sandstone springers, and the stone sill under the group. */
function lightGroup(b: BuildingTools, f: Frame, ts: number[], row: [number, number], o: {out?: number; sill?: boolean} = {}) {
  const out = o.out ?? 0;
  for (const t of ts) kruis(b, f, t, row, out);
  relievingArchRow(b, f, {centres: ts, width: WIN, springY: row[1] + 0.06, rise: 0.13, thickness: 0.26, springer: {width: 0.33, height: 0.3, peak: 0.1, drop: 0.08}, arch: 'red', stone: 'ochre', d: 0.05, springerD: 0.08, out});
  if (o.sill !== false) {
    const c = (ts[0] + ts[ts.length - 1]) / 2, w = ts[ts.length - 1] - ts[0] + WIN + 0.3;
    slab(b, f, c, row[0] - 0.2, w, 0.14, 0.14, 'concrete', out);
  }
}

/**
 * Oostenburgergracht front (edge 0, w02-210). Plinth of grey granite to the ground-floor sills with basement grilles; the
 * risalit 0.1 m proud with its spout gable and cross; three storeys of three-light groups (the ground floor of the risalit
 * holds the porticoes instead); the copper-green parapet coping; the two lettered tableaux between the ground and first
 * floor of the wings.
 */
function streetFront(b: BuildingTools) {
  const {f, len} = edge(0);
  // granite plinth (w02-210 2021: light grey, to the ground-floor sills at 1.84 m) and the basement grilles under the wings
  // (the portico zone is the granite frame's own: the plinth stops at it, so the doors stand in an open recess)
  // its ends stop 0.25 m short of the party-wall corners (an end face on a side wall's plane z-fights) and run 0.15 m into
  // the portico frame
  // the 3DBAG shell carries the risalit's 0.1 m projection from the ground, so the plinth steps out with it
  const r0 = RIS.c - RIS.w / 2, r1 = RIS.c + RIS.w / 2;
  for (const [a, c, o] of [[0.25, r0, 0], [r0, AXIS - 3.09, RIS.out], [AXIS + 3.09, r1, RIS.out], [r1, len - 0.25, 0]]) slab(b, f, (a + c) / 2, 0, c - a, ROW_G[0], 0.12, 'stone', o);
  for (const t of [...LEFT, ...RIGHT]) slab(b, f, t, 0.12, 0.9, 0.42, 0.04, 'dark', 0.12);
  // the risalit: brick 0.1 m proud from the plinth to the parapet, the spout gable over it
  slab(b, f, RIS.c, ROW_G[0], RIS.w, PARAPET - ROW_G[0] + 0.78, RIS.out, 'brick');
  const hw = RIS.w / 2;
  poly(b, f, RIS.c, PARAPET + 0.78, [[-hw, 0], [hw, 0], [0, 0.91]], 0.5, 'brick', RIS.out - 0.4);
  // the gable's copper coping along both slopes and the stone cross on the apex (seen from the water in w04 r812)
  const slope = Math.atan2(0.91, hw), L = Math.hypot(hw, 0.91);
  for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(L + 0.1, 0.12, 0.62).translate(0, 0.06, 0.31 - 0.4 + RIS.out);
    g.rotateZ(-s * slope);
    g.translate(s * hw / 2, PARAPET + 0.78 + 0.455, 0);
    put(b, f, g, RIS.c, 0, 0, 'copper');
  }
  slab(b, f, RIS.c, PARAPET + 1.66, 0.14, 1.05, 0.14, 'concrete', RIS.out - 0.2);
  slab(b, f, RIS.c, PARAPET + 2.3, 0.6, 0.14, 0.14, 'concrete', RIS.out - 0.2);
  // parapet coping of the wings (copper patina, sampled #7f9191 on the 2021 view) and the risalit's shoulders
  // its top 5 cm under the lowest 3DBAG roof point (17.1 m), so the band never shares a plane with the roof
  for (const [a, c] of [[0, RIS.c - hw], [RIS.c + hw, len]]) slab(b, f, (a + c) / 2, PARAPET - 0.4, c - a, 0.35, 0.16, 'copper');
  for (const s of [-1, 1]) slab(b, f, RIS.c + s * (hw - 0.3), PARAPET + 0.66, 0.6, 0.14, 0.24, 'copper', RIS.out);
  // wings: three storeys of three-light groups; risalit: the two upper storeys
  for (const ts of [LEFT, RIGHT]) for (const row of [ROW_G, ROW_1, ROW_2]) lightGroup(b, f, ts, row, {sill: row !== ROW_G});
  for (const row of [ROW_1, ROW_2]) lightGroup(b, f, MID, row, {out: RIS.out});
  // the tableaux (register: tegeltableaus of the firm Distel, "St. Canisius" left, "St. Vincentius" right): light panels with
  // their single line of capitals, 3.9 x 0.53 m at 5.96 m (w02-210 2021)
  for (const t of [3.6, 17.52]) {
    slab(b, f, t, 5.96, 3.9, 0.53, 0.05, 'white');
    slab(b, f, t, 6.12, 3.5, 0.2, 0.09, 'bronze', 0.05);
  }
  porticoes(b, f);
}

/**
 * The risalit ground floor (w02-210 2021 at 3x; the left portico is mirrored about the statue axis, the tree hides it): the
 * granite frame round both porticoes to 3.46 m, the recessed doors on their steps, the fanlights over the doors under their
 * relieving arches, the low three-light window between the porticoes, the two narrow lights and the sandstone lintel band
 * flanking the statue, and St. Willibrord on his console under a pointed canopy.
 */
function porticoes(b: BuildingTools, f: Frame) {
  const o = RIS.out, top = 3.46, doors = [AXIS - 2.155, AXIS + 2.155], dw = 1.67, fw = 0.3;
  // granite frame: jambs and the middle pier, the lintels over the doors (0.3 m proud of the risalit)
  const x0 = AXIS - 3.24, x1 = AXIS + 3.24;
  const pieces: [number, number][] = [[x0, doors[0] - dw / 2], [doors[0] + dw / 2, doors[1] - dw / 2], [doors[1] + dw / 2, x1]];
  for (const [a, c] of pieces) slab(b, f, (a + c) / 2, 0, c - a, top, fw, 'stone', o);
  for (const t of doors) {
    slab(b, f, t, 3.1, dw, top - 3.1, fw, 'stone', o);
    // the door leaf in the recess, its threshold 0.63 m up three steps
    slab(b, f, t, 0.63, dw - 0.1, 3.1 - 0.63, 0.04, 'dark', o);
    bar(b, f, t, 2.55, dw - 0.1, 0.06, o + 0.04);
    for (const [k, y] of [0.21, 0.42, 0.63].entries()) slab(b, f, t, 0, dw, y, 0.9 - k * 0.3, 'stone', o);
    // fanlight over the door, under its own relieving arch
    win(b, f, t, [3.68, 5.07], 1.55, {cols: 2, rows: 2, out: o});
    relievingArchRow(b, f, {centres: [t], width: 1.55, springY: 5.13, rise: 0.13, thickness: 0.26, springer: {width: 0.33, height: 0.3, peak: 0.1, drop: 0.08}, arch: 'red', stone: 'ochre', d: 0.05, springerD: 0.08, out: o});
  }
  // the low window between the porticoes, in the granite (1.77-3.1 m)
  win(b, f, AXIS, [1.77, 3.1], 1.5, {cols: 3, rows: 2, out: o + fw});
  // the narrow lights either side of the statue and the sandstone lintel band over them
  for (const t of [AXIS - 0.54, AXIS + 0.58]) win(b, f, t, [3.68, 5.07], 0.42, {cols: 1, rows: 2, out: o});
  slab(b, f, AXIS, 5.1, 2.0, 0.4, 0.08, 'ochre', o);
  statue(b, f, AXIS, top, o + 0.05);
}

/**
 * St. Willibrord (register: "een beeld van de Heilige Willibrordus tegen de gevel"; w02-210 2021 at 3x: 0.58 m wide, the
 * console at 3.46 m, the figure to about 5.9 m, the pointed canopy to 6.3 m): a console, a mitred figure in a cope, and the
 * canopy, simplified to lathed stone.
 */
function statue(b: BuildingTools, f: Frame, t: number, y: number, out: number) {
  slab(b, f, t, y, 0.8, 0.22, 0.48, 'stone', out - 0.05);
  slab(b, f, t, y + 0.22, 0.62, 0.12, 0.42, 'stone', out - 0.05);
  const body = new T.LatheGeometry([[0.001, 0], [0.27, 0], [0.24, 0.8], [0.2, 1.5], [0.16, 1.72], [0.11, 1.8], [0.001, 1.82]].map(p => new T.Vector2(p[0], p[1])), 8);
  put(b, f, body.scale(1, 1, 0.75).translate(0, 0, 0.22), t, y + 0.34, out, 'stone');
  const head = new T.SphereGeometry(0.12, 8, 6).translate(0, 0.12, 0.2);
  put(b, f, head, t, y + 2.12, out, 'stone');
  // mitre and crozier
  put(b, f, new T.ConeGeometry(0.1, 0.24, 4).rotateY(Math.PI / 4).translate(0, 0.12, 0.2), t, y + 2.32, out, 'stone');
  slab(b, f, t + 0.3, y + 0.34, 0.05, 2.1, 0.05, 'stone', out + 0.3);
  // the canopy: a back plate and a four-sided pointed hood
  slab(b, f, t, y + 2.5, 0.72, 0.18, 0.5, 'stone', out - 0.05);
  put(b, f, new T.ConeGeometry(0.42, 0.45, 4).rotateY(Math.PI / 4).scale(1, 1, 0.62).translate(0, 0.225, 0.22), t, y + 2.68, out - 0.05, 'stone');
}

/**
 * The chapel bay on the Wittenburgervaart (edge 13; TMX7316010203-001982_pano_0000_000811 2021, a level cut at 49 px/m on
 * the wall 21.2 m away, the camera 0.35 m over the 3DBAG ground, and the 2017 view TMX7316010203-000353_pano_0002_000430):
 * the 3DBAG wall stands to its 12.3 m coping; the canted bay in front of it is 0.5 m deep and 10.3 m high, from t 0.8 to
 * 6.6 m, with a row of five tall windows (the outer two on the cants) at 3.7-6.5 m, two small squares flanking two tall
 * slits at 7.6-9.7 m, the white coping band at 10.0-10.3 m, and at the quay the dark cantilevered hood over two basement
 * windows and the grey plinth.
 */
function chapelBay(b: BuildingTools) {
  const {f, len} = edge(13);
  slab(b, f, len / 2, 11.8, len - 0.04, 0.3, 0.12, 'white');
  const t0 = 0.8, t1 = 6.6, dep = 0.5, top = 10.0;
  const c = (t0 + t1) / 2, hw = (t1 - t0) / 2;
  const plan: [number, number][] = [[-hw, -0.1], [hw, -0.1], [hw, 0], [hw - dep, dep], [-hw + dep, dep], [-hw, 0]];
  prism(b, f, c, plan, 0, top, 'brick');
  prism(b, f, c, plan.map(([x, z]) => [x * 1.03, z * 1.24] as [number, number]), top, 0.3, 'white');
  prism(b, f, c, plan.map(([x, z]) => [x, z * 1.1] as [number, number]), 0, 0.8, 'concrete');
  // faces of the bay as wall frames: the front and the two cants
  const front = sub(f, c - hw + dep, dep, c + hw - dep, dep), cl = sub(f, c - hw, 0, c - hw + dep, dep), cr = sub(f, c + hw - dep, dep, c + hw, 0);
  const fl = t1 - t0 - 2 * dep, cw = Math.SQRT2 * dep;
  // t on the front face from its left end (bay t 1.3); the windows at wall t 2.2, 3.55, 4.9
  for (const t of [2.2, 3.55, 4.9]) {
    win(b, front, t - (t0 + dep), [3.7, 6.5], 0.82, {cols: 2, rows: 4});
    slab(b, front, t - (t0 + dep), 3.52, 0.95, 0.12, 0.12, 'concrete');
  }
  for (const g of [cl, cr]) win(b, g, cw / 2, [3.7, 6.5], 0.42, {cols: 1, rows: 4});
  for (const t of [2.08, 5.1]) win(b, front, t - (t0 + dep), [8.9, 9.7], 0.5, {cols: 1, rows: 1});
  for (const t of [3.0, 4.0]) win(b, front, t - (t0 + dep), [7.6, 9.7], 0.52, {cols: 1, rows: 2});
  // basement windows under the hood at the quay (2017 view)
  for (const t of [2.85, 4.75]) win(b, front, t - (t0 + dep), [0.85, 1.45], 1.2, {cols: 3, rows: 1});
  slab(b, front, fl / 2, 1.6, fl + 0.6, 0.14, 0.62, 'dark');
  for (const t of [0.4, fl / 2, fl - 0.4]) poly(b, front, t, 0.9, [[-0.06, 0.7], [0.06, 0.7], [0.06, 0.55], [-0.06, 0]], 0.5, 'dark');
}

/** A frame on the segment (ta, oa) -> (tb, ob) given in the parent frame's (t, out): t runs a -> b, n points away from the parent wall. */
function sub(f: Frame, ta: number, oa: number, tb: number, ob: number): Frame {
  const L = Math.hypot(tb - ta, ob - oa), dt = (tb - ta) / L, dout = (ob - oa) / L;
  const w = (t: number, o: number): [number, number] => [f.tangent[0] * t + f.n[0] * o, f.tangent[1] * t + f.n[1] * o];
  return {origin: pt(f, ta, oa), tangent: w(dt, dout), n: w(-dout, dt)};
}

/** A vertical prism on the wall: `plan` in (t, out) about t = c, from y to y + h. */
function prism(b: BuildingTools, f: Frame, c: number, plan: [number, number][], y: number, h: number, colour: string) {
  const g = new T.ExtrudeGeometry(new T.Shape(plan.map(([x, z]) => new T.Vector2(x, z))), {depth: h, bevelEnabled: false});
  g.rotateX(Math.PI / 2).translate(0, y + h, 0);
  put(b, f, g, c, 0, 0, colour);
}

/**
 * The rear of the stair and corridor block toward the water (edges 2-7; TMX7316010203-001982_pano_0000_000812, 2021): the
 * NE wall with rows of small windows (edge 2), the canted stair tower with one big window per storey (edges 3-6), the
 * recessed bay with the balcony (edge 7), white copings along the tops.
 */
function stairBlockRear(b: BuildingTools) {
  const e2 = edge(2);
  for (const row of [[3.0, 3.8], [7.9, 8.7], [12.6, 13.4]] as [number, number][]) for (const k of [0, 1, 2, 3]) {
    const t = e2.len / 2 + (k - 1.5) * 1.15;
    win(b, e2.f, t, row, 0.5, {cols: 1, rows: 2});
  }
  coping(b, 2);
  // stair tower: the face toward the water (edge 5) has one big window per storey, the short cants (3, 4, 6) are brick
  const e5 = edge(5);
  for (const row of [[7.2, 8.6], [11.4, 12.8]] as [number, number][]) win(b, e5.f, e5.len / 2, row, 1.3, {cols: 3, rows: 3});
  for (const i of [3, 4, 5, 6]) coping(b, i);
  // edge 7: the low (5.1 m) annexe in front of the recess: a window and the white ledge on its top
  const e7 = edge(7);
  win(b, e7.f, 1.2, [1.9, 3.7], 1.3, {cols: 2, rows: 2});
  slab(b, e7.f, 1.2, 4.88, 2.45, 0.3, 0.14, 'white');
  // the recessed bay over it: the 3DBAG wall 5.6 m behind edge 7 (t 5.9-9.5, 10.7-15.5 m, 5.5-5.9 m back; a 12.3 m volume stands in front
  // of it from t 7.8) carries the balcony with its white railing and the glazed doors (r812)
  const fb = sub(e7.f, 5.91, -5.52, 9.49, -5.86);
  const c = 1.7;
  win(b, fb, c, [12.55, 14.7], 1.1, {cols: 2, rows: 3});
  slab(b, fb, c, 12.35, 1.7, 0.16, 0.8, 'white');
  slab(b, fb, c, 13.35, 1.7, 0.06, 0.06, 'white', 0.74);
  for (let k = 0; k <= 6; k++) slab(b, fb, c - 0.78 + k * 0.26, 12.51, 0.04, 0.84, 0.04, 'white', 0.74);
}

/** White painted coping along the top of a ring edge, at the 3DBAG roof just inside the wall. */
function coping(b: BuildingTools, i: number) {
  const {f, len} = edge(i);
  const h = roofAt(f, len / 2, -0.3);
  if (h === null) return;
  slab(b, f, len / 2, h - 0.38, len - 0.04, 0.3, 0.12, 'white');
}
