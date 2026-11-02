import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, ledgeStrip, put, ringFrame, roofHeightAt, wallProbe, type Frame} from './nearbar-kit';
import {addShell, planarPolygon} from './worship-shell';
import {raisedLettering} from './ornament-kit';
import source from './loods-6-footprints.json';

/**
 * Loods 6, KNSM-laan 143-311 / Surinamekade 6-33 / Messinastraat 1-3 on the KNSM-eiland (BAG pand 0363100012142095, BAG
 * year 1924; KNSM warehouse and emigrant terminal by J.G. and A.D. van Gendt, partly rebuilt as the first-class passenger
 * terminal with the Kompaszaal in 1956 by Johan van Tienhoven, converted 1994-1997 by Villanova Architecten; gemeentelijk
 * monument 200635; nl.wikipedia "Loods 6", CC BY-SA 4.0). 180 m long, three storeys over a souterrain, the concrete fronts
 * behind a coat of light grey render since the restoration; the north side has no top storey (a wide terrace), the west
 * head carries a glazed serre under a louvred canopy.
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) of the pand in the native frame of scripts/landmarks/loods-6-footprints.json
 * (scripts/landmarks/loods-6-prepare.ts): main block 15.9 m, north terrace storey 10.9 m, north quay storey 6.3 m, the
 * serre block 14.6 m at the NW corner, the east annex 5.3 m and the row of roof lights at 16.3 m. Everything on the fronts is
 * read from the rectified Gemeente Amsterdam panorama crops (CC BY 4.0, 50 px/m) and the Commons photographs listed in
 * scripts/landmarks/loods-6-inventory.json:
 *  - KNSM-laan (south): a 6.24 m bay grid of flat pilasters; per bay a 5.5 m steel-gridded shop front, a centred first-floor
 *    window, a dark steel ribbon window across the bay at 8.8-10.3 m and two white-framed second-floor windows; four
 *    entrance risalits (1 m proud, 4.3 m) with wooden four-leaf doors under a concrete lintel (w22-185, w20-185); the
 *    arcade with steps at the west end (w02-185); the 1956 Kompaszaal bays with tall brown-framed windows, the entrance
 *    canopy and its stair (w03-185); a cornice at 15.7-16.4 m (w11-185).
 *  - SW chamfer (w04-216): three rows of steel ribbon windows under the second-floor pairs, a loggia bay at the KNSM-laan end.
 *  - West head (w08-275, w13-337): three rows of steel windows, the corrugated-metal drum at the NW corner, the serre glazing
 *    and the louvred canopy over it.
 *  - Surinamekade (north, w01-5, w06-6): a raised loading platform, 3.9 m bays of steel glazing, roller shutters and doors
 *    under a thin canopy band, the railing of the terrace, tall steel windows on the terrace storey, the standing letters
 *    LOODS 6 on the terrace parapet (w01-5 at 0.44 of the front from the east end; Commons "2023 Amsterdam, KNSM-eiland, Loods 6 (13)").
 *  - Messinastraat (east, w05-87): the buff-brick annex with red doors, slit windows and a dark brick fascia.
 *
 * Frame: x east, z south, y up from the 3DBAG ground (1.57 m NAP), origin = the BAG ring vertex average.
 */
type Src = {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
const src = source as unknown as Src;
const RING = src.nativeRing;
let b: BuildingTools;
let probe: ReturnType<typeof wallProbe>;

/** South-front storey lines, metres above the pavement, measured on w11-185 and w22-185 (50 px/m). */
export const Y = {
  shop: [0.1, 5.5], band: [5.5, 6.0], l1: [6.25, 8.5], ribbon: [8.8, 10.3], l2: [11.45, 14.4], cornice: [15.2, 15.8],
} as const;
const BAY = 6.24;

const sl = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => slab(b, f, t, y, w, h, d, c, out);
const shift = (f: Frame, off: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]});
/** Frame moved onto the shell wall at (t, y); the frame unchanged when no wall is within 2 m. */
function onWall(f: Frame, t: number, y: number): Frame {
  const o = probe.offset(f, t, y);
  return o === null ? f : shift(f, o);
}

/* ------------------------------------------------------------------ openings */
/** Glazed opening: glass 0.12 m proud, `cols` x `rows` lights in bars 5 cm proud of the glass, optional surround. */
function glazed(f: Frame, t: number, y0: number, y1: number, w: number, o: {cols?: number; rows?: number; bar?: string; surround?: string; transom?: number; out?: number} = {}) {
  const cols = o.cols ?? 2, rows = o.rows ?? 2, bar = o.bar ?? 'frame', out = o.out ?? 0, h = y1 - y0;
  if (o.surround) {
    for (const s of [-1, 1]) sl(f, t + s * (w / 2 + 0.04), y0, 0.1, h, 0.2, o.surround, out);
    sl(f, t, y1 + 0.06, w + 0.18, 0.1, 0.2, o.surround, out);
  }
  sl(f, t, y0, w, h, 0.12, 'glass', out);
  for (let k = 1; k < cols; k++) sl(f, t - w / 2 + (w * k) / cols, y0, 0.07, h, 0.17, bar, out);
  const ys = o.transom !== undefined ? [o.transom] : [...Array(rows - 1)].map((_, k) => y0 + (h * (k + 1)) / rows);
  for (const y of ys) sl(f, t, y - 0.035, w, 0.07, 0.17, bar, out);
  sl(f, t, y0 - 0.06, w + 0.12, 0.06, 0.2, bar, out);                                                    // bottom rail
  sl(f, t, y1, w + 0.12, 0.06, 0.2, bar, out);                                                           // head rail
}
/** White-framed second-floor window (w11-185): two lights over a transom light, a sill 0.25 m proud. */
function l2Window(f: Frame, t: number, w = 2.1, plain = false) {
  const [y0, y1] = Y.l2;
  glazed(f, t, y0, y1, w, {cols: 2, rows: 1, bar: 'white', surround: plain ? undefined : 'white', transom: y0 + (y1 - y0) * 0.6});
  if (!plain) sl(f, t, y0 - 0.12, w + 0.16, 0.06, 0.25, 'white');
}
/** Dark steel ribbon window across a bay (w11-185): thick black frame, three lights over two rows. */
function ribbon(f: Frame, t: number, w: number, y0: number = Y.ribbon[0], y1: number = Y.ribbon[1], cols = 3) {
  glazed(f, t, y0, y1, w, {cols, rows: 2});
  sl(f, t, y1 + 0.06, w + 0.2, 0.1, 0.24, 'frame');                                                     // the dark lintel frame, over the head rail
  sl(f, t, y0 - 0.16, w + 0.2, 0.1, 0.24, 'frame');                                                     // and the sill frame under the bottom rail
}
/** Steel-gridded shop front (w11-185): three lights over three rows per 6 m. */
function shopFront(f: Frame, t: number, w: number, y0: number = Y.shop[0], y1: number = Y.shop[1]) {
  glazed(f, t, y0, y1, w, {cols: Math.max(1, Math.round(w / 1.95)), rows: 3});
}
/** One south panel between pilasters (or a pilaster and a risalit): shop front, L1 window, ribbon, second-floor windows. */
function southPanel(f: Frame, t0: number, t1: number, o: {arcade?: boolean; pilasterAt?: 'start' | 'end'} = {}) {
  const w = t1 - t0, c = (t0 + t1) / 2;
  // a half bay beside a risalit keeps its single upper window 1.6 m from the pilaster (w11-185), clear of the risalit side
  const single = o.pilasterAt === 'start' ? t0 + 1.6 : o.pilasterAt === 'end' ? t1 - 1.6 : c;
  if (w < 1.2) return;
  shopFront(f, c, w - 0.4, o.arcade ? 1.85 : Y.shop[0]);
  if (w > 2.4) glazed(f, c, Y.l1[0], Y.l1[1], 1.85, {cols: 2, rows: 1, transom: Y.l1[0] + 1.0});
  if (o.arcade && w > 2.4) sl(f, c, Y.l1[0] + 0.95, 1.85, 0.05, 0.3, 'frame');                       // balconette rail (w02-185 alt)
  ribbon(f, c, w - 0.4);
  if (w > 5) for (const s of [-1, 1]) l2Window(f, c + s * 1.42);
  else if (w > 3.8) { l2Window(f, t0 + 0.8, 1.05); l2Window(f, t1 - 1.2, 1.95); }                         // the 4 m arcade bay: a narrow and a full window (w02-185)
  else if (w > 2.6) l2Window(f, single, 1.95);
}
/** Flat pilaster from the floor band to the cornice, 8 cm proud (w11-185). */
function pilaster(f: Frame, t: number) {
  sl(f, t, Y.band[1], 0.28, Y.cornice[0] - Y.band[1], 0.1, 'sandstone');
}
/** Floor band and cornice along a run of the south and chamfer fronts. */
function bands(f: Frame, len: number, band = true, wrap = 0) {
  if (band) sl(f, len / 2, Y.band[0], len - 0.04 + 2 * wrap, Y.band[1] - Y.band[0], 0.1, 'sandstone');
  sl(f, len / 2, Y.cornice[0], len - 0.04 + 2 * wrap, Y.cornice[1] - Y.cornice[0], 0.16, 'sandstone');
}

/* ------------------------------------------------------------------ south (KNSM-laan) */
/** Pilaster positions in a 13.8 m run between two risalits: a 3.7 m half bay either side of one full bay (w11-185). */
const BETWEEN = [3.7, 3.7 + BAY];
type RunOpts = {arcade?: boolean; kompas?: boolean; between?: boolean; tallLast?: boolean; columns?: number[]};
function southRun(edge: number, pil: number[], o: RunOpts = {}) {
  const {f: f0, len} = ringFrame(RING, edge);
  run(onWall(f0, len / 2, 8), len, pil, o);
}
/** The arcade front from ring vertex 45 to 0 (three nearly collinear BAG edges, 41.9 m, w02-185) as one straight run. */
function arcadeRun() {
  const a = RING[45], c = RING[0], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const tangent: [number, number] = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  const f0: Frame = {origin: [a[0], a[1]], tangent, n: [-tangent[1], tangent[0]]};
  // w02-185 (2019, 47.7 px/m): the upper order keeps the 6 m grid with axes 2.3 m + 6 k from the west end; an extra pier at
  // 25.1 m frames a narrow ribbon bay; the east bay carries one tall steel window over both upper bands; columns stand on
  // the pilaster lines only
  run(onWall(f0, len / 2, 8), len, [5.3, 11.3, 17.3, 23.3, 25.1, 29.3, 35.3], {arcade: true, tallLast: true, columns: [0.5, 5.3, 11.3, 17.3, 23.3, 25.1, 29.3, 35.3, len - 0.5]});
}
function run(f: Frame, len: number, pil: number[], o: RunOpts) {
  bands(f, len, !o.arcade);
  const cuts = [0, ...pil.filter(t => t > 0.3 && t < len - 0.3), len];
  pil.forEach(t => { if (t > 0.3 && t < len - 0.3) pilaster(f, t); });
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i] + 0.14, t1 = cuts[i + 1] - 0.14;
    if (o.kompas && t0 > 9.5) kompasPanel(f, t0, t1, i === 3);
    else if (o.tallLast && i === cuts.length - 2) {
      shopFront(f, (t0 + t1) / 2, t1 - t0 - 0.4);
      glazed(f, (t0 + t1) / 2, 6.3, 10.3, t1 - t0 - 0.5, {cols: 6, rows: 2});
      for (const s of [-1, 1]) l2Window(f, (t0 + t1) / 2 + s * 1.42);
    }
    else southPanel(f, t0, t1, {...o, pilasterAt: o.between && cuts.length > 2 ? (i === 0 ? 'end' : i === cuts.length - 2 ? 'start' : undefined) : undefined});
  }
  if (o.arcade) arcade(f, len, o.columns ?? cuts);
}
/** West end of the KNSM-laan front (w02-185): square columns before the shop fronts, the floor band on them, a broad stair. */
function arcade(f: Frame, len: number, cols: number[]) {
  for (const t of cols) sl(f, t, 1.8, 0.9, Y.band[0] - 1.8, 0.7, 'sandstone');
  sl(f, len / 2, Y.band[0], len - 0.04, Y.band[1] - Y.band[0], 0.75, 'sandstone');
  for (let k = 0; k < 6; k++) sl(f, len / 2, k * 0.3, len - 0.1, 0.3, 2.85 - k * 0.35, 'stone');   // six steps up to the arcade floor (w02-185)
}
/** Kompaszaal bays (w03-185, 1956): brown-framed glazing over a stone base and tall brown-framed first-floor windows. */
function kompasPanel(f: Frame, t0: number, t1: number, entrance: boolean) {
  const w = t1 - t0, c = (t0 + t1) / 2;
  glazed(f, c, 6.5, 10.4, w - 0.5, {cols: 6, rows: 1, bar: 'bronze', surround: 'stone', transom: 9.2});
  for (const s of [-1, 1]) l2Window(f, c + s * 1.42);
  if (!entrance) {
    sl(f, c, 0, w - 0.3, 1.5, 0.12, 'stone');
    glazed(f, c, 1.5, 5.3, w - 0.5, {cols: 6, rows: 1, bar: 'bronze', surround: 'stone', transom: 4.4});
    return;
  }
  // entrance: recessed doors behind a stair, a flat canopy 8 m wide on the floor line (w03-185)
  sl(f, c, 1.5, 4.2, 3.6, 0.05, 'dark');
  glazed(f, c, 1.6, 4.4, 3.6, {cols: 4, rows: 1, bar: 'bronze'});
  for (let k = 0; k < 5; k++) sl(f, c, k * 0.3, 5.2 - k * 0.3, 0.3, 3.0 - k * 0.5, 'stone');
  for (const s of [-1, 1]) sl(f, c + s * 2.75, 0, 0.5, 1.5, 3.0, 'stone');                               // stair cheeks
  sl(f, c + 0.6, 6.1, 8.0, 0.2, 2.6, 'frame');
}
/** Entrance risalit front (w22-185, w20-185): four-leaf wooden doors, concrete lintel, glazing, ribbon pair, window pair. */
function risalit(edge: number) {
  const {f: f0, len} = ringFrame(RING, edge);
  const f = onWall(f0, len / 2, 8), c = len / 2;
  bands(f, len, false, 0.16);                                                                            // the cornice returns round the risalit corners
  sl(f, c, 0, 3.9, 2.6, 0.1, 'bronze');
  for (const u of [-0.98, 0, 0.98]) sl(f, c + u, 0, 0.06, 2.6, 0.15, 'frame');
  sl(f, c, 2.6, len - 0.2, 0.22, 0.3, 'concrete');
  for (const s of [-1, 1]) glazed(f, c + s * 1.0, 2.95, 5.4, 1.8, {cols: 2, rows: 2});
  sl(f, c, Y.band[0], len + 0.28, Y.band[1] - Y.band[0], 0.1, 'sandstone');
  glazed(f, c + 1.4, 6.3, 8.3, 0.9, {cols: 1, rows: 2});
  for (const s of [-1, 1]) ribbon(f, c + s * 1.0, 1.8, 8.5, 9.9, 2);
  for (const s of [-1, 1]) l2Window(f, c + s * 1.0, 1.5, true);                                     // narrow front: frames only
}

/* ------------------------------------------------------------------ SW chamfer and west head */
/** SW chamfer (edge 34, w04-216): three 6.5 m bays of steel ribbon windows in three rows, a loggia bay at the south end. */
function chamfer() {
  const {f: f0, len} = ringFrame(RING, 34);
  const f = onWall(f0, len / 2, 8);
  bands(f, len, false);
  const cuts = [0.3, 6.65, 13.45, 20.25, len];
  for (const t of cuts.slice(1, -1)) sl(f, t, 0.6, 0.3, Y.cornice[0] - 0.6, 0.1, 'sandstone');
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i] + 0.2, t1 = cuts[i + 1] - 0.2, c = (t0 + t1) / 2, w = t1 - t0;
    for (const s of [-1, 1]) l2Window(f, c + s * 1.5);
    if (i < 3) {
      for (const [y0, y1] of [[7.2, 10.3], [3.9, 6.5], [1.2, 3.3]] as const) ribbon(f, c, w - 0.2, y0, y1, 4);
    } else {
      // loggia at the KNSM-laan end: dark recess with glazing, a balcony slab, columns (w04-216 right)
      sl(f, c, 3.9, w - 0.6, 6.4, 0.1, 'dark');
      for (const [y0, y1] of [[7.2, 10.3], [3.9, 6.5]] as const) glazed(f, c, y0, y1, w - 0.8, {cols: 3, rows: 1, out: 0.1});
      sl(f, c, 6.6, w, 0.3, 1.0, 'sandstone');
      for (const s of [-1, 1]) sl(f, c + s * (w / 2 - 0.25), 0.4, 0.45, 10.3 - 0.4, 0.9, 'sandstone');
      ribbon(f, c, w - 0.6, 1.2, 3.3, 3);
    }
  }
  // corner entrance runs (w14-215, w15-215): the south bay order round the corner, with a stair and railing
  for (const e of [38, 42]) {
    const {f: g0, len: l} = ringFrame(RING, e);
    if (l < 3) continue;
    const g = onWall(g0, l / 2, 8);
    bands(g, l);
    southPanel(g, 0.15, l - 0.15);
    for (let k = 0; k < 4; k++) sl(g, l / 2, k * 0.3, l - 0.1, 0.3, 1.8 - k * 0.4, 'stone');
  }
}
/** West face of the serre block (edge 33, w08-275): three rows of steel windows, the serre storey of glass. */
function westHead() {
  const {f: f0, len} = ringFrame(RING, 33);
  const f = onWall(f0, len / 2, 6);
  const cuts = [0, 5.1, 9.75, len];
  for (const t of cuts.slice(1, -1)) sl(f, t, 0.5, 0.35, 10.3, 0.1, 'sandstone');
  for (let i = 0; i + 1 < cuts.length; i++) {
    const c = (cuts[i] + cuts[i + 1]) / 2, w = cuts[i + 1] - cuts[i] - 0.6;
    for (const [y0, y1] of [[7.6, 10.6], [4.2, 7.0], [1.4, 3.6]] as const) ribbon(f, c, w, y0, y1, 4);
  }
  sl(f, len / 2, 10.85, len - 0.04, 0.3, 0.2, 'sandstone');
}
/** North face of the serre block (last 13 m of edge 31, w13-337): the west head's three rows of steel windows. */
function northHead() {
  const {f: f0, len} = ringFrame(RING, 31);
  const f = onWall(f0, len - 6.6, 6);
  for (const c of [len - 9.2, len - 3.4]) for (const [y0, y1] of [[7.6, 10.4], [4.2, 7.0]] as const) ribbon(f, c, 5.0, y0, y1, 4);
  sl(f, len - 6.4, 10.85, 12.4, 0.3, 0.2, 'sandstone');
}
/** Serre: glass storey on the NW block (west and north faces), its railing and the louvred steel canopy over it. */
function serre() {
  const west = ringFrame(RING, 33), north = ringFrame(RING, 31);
  const fw = onWall(west.f, west.len / 2, 13), fn = onWall(north.f, north.len - 6.6, 13);
  glazed(fw, 5.2, 11.3, 14.4, 9.8, {cols: 5, rows: 1, transom: 12.4});
  l2Window(fw, 12.6, 1.6);                                                                               // the tower bay south of the serre (w08-275 alt)
  glazed(fn, north.len - 6.6, 11.3, 14.4, 12.4, {cols: 6, rows: 1, transom: 12.4});
  for (const [f, t, w] of [[fw, 5.2, 10.2], [fn, north.len - 6.6, 12.8]] as const) {
    sl(f, t, 12.25, w, 0.06, 0.06, 'frame', 0.9);                                                      // railing top rail
    for (let u = -w / 2 + 1.0; u < w / 2 - 0.5; u += 2) sl(f, t + u, 11.2, 0.06, 1.05, 0.06, 'frame', 0.9);    // railing posts
    sl(f, t, 11.0, w, 0.2, 1.0, 'sandstone');                                                          // terrace edge
  }
  // louvred canopy (w08-275, w13-337, Commons "2013AmsterdamKNSMisland06"): slats 0.25 m on 0.6 m centres over two steel
  // beams, covering the NW block (22 x 14 m) and reaching 2.5 m past its west and north faces, on four posts
  const C = cornerNW(), sW = west.f.n, nN = north.f.n;
  const dirE: [number, number] = [-sW[0], -sW[1]], dirS: [number, number] = [-nN[0], -nN[1]];
  const y = 15.7, spanW = 24, spanD = 14.5;
  const o: [number, number] = [C[0] + sW[0] * 2.0 + nN[0] * 2.0, C[1] + sW[1] * 2.0 + nN[1] * 2.0];
  const at = (de: number, ds: number): [number, number] => [o[0] + dirE[0] * de + dirS[0] * ds, o[1] + dirE[1] * de + dirS[1] * ds];
  const angS = Math.atan2(dirS[0], dirS[1]), angE = Math.atan2(dirE[0], dirE[1]);
  for (let k = 0; k * 0.6 + 0.3 < spanW; k++) { const p = at(k * 0.6 + 0.3, spanD / 2); b.box(p[0], y, p[1], 0.25, 0.08, spanD, 'frame', angS); }
  for (const ds of [2.0, spanD - 1.5]) { const p = at(spanW / 2, ds); b.box(p[0], y - 0.32, p[1], 0.2, 0.3, spanW, 'frame', angE); }
  for (const [de, ds] of [[3.2, 2.0], [spanW - 1.5, 2.0], [3.2, spanD - 1.5], [spanW - 1.5, spanD - 1.5]] as const) {
    const p = at(de, ds); b.box(p[0], 14.6, p[1], 0.18, y - 0.32 - 14.6, 0.18, 'frame');
  }
}
/** NW corner of the serre block: the west face (edge 33) and the north face (edge 31) lines extended to meet. */
function cornerNW(): [number, number] {
  const a = RING[33], a2 = RING[34], c = RING[31], c2 = RING[32];
  const d1 = [a2[0] - a[0], a2[1] - a[1]], d2 = [c2[0] - c[0], c2[1] - c[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0], t = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den;
  return [a[0] + d1[0] * t, a[1] + d1[1] * t];
}
/** Corrugated-metal drum on the NW chamfer (edge 32, w13-337): horizontal ribs 0.3 m apart up to 6.8 m. */
function nwCore() {
  // 3DBAG has no low walls on the NW chamfer and the serre block's north face (open loops at 0.9-3.3 m): close the block
  // with a prism 0.15 m inside the BAG ring, hidden wherever the shell has its own walls
  const {f, len} = ringFrame(RING, 31);
  const A: [number, number] = [f.origin[0] + f.tangent[0] * (len - 13.4), f.origin[1] + f.tangent[1] * (len - 13.4)];
  const r34 = RING[34];
  const C: [number, number] = [A[0] - f.n[0] * 14.5, A[1] - f.n[1] * 14.5];
  const D: [number, number] = [r34[0] - f.tangent[0] * 0.0, r34[1]];
  const poly: [number, number][] = [A, [RING[32][0], RING[32][1]], [RING[33][0], RING[33][1]], D, C];
  const inset = offsetRing(poly, -0.15);
  const g = new T.ExtrudeGeometry(new T.Shape(inset.map(p => new T.Vector2(p[0], p[1]))), {depth: 14.4, bevelEnabled: false, curveSegments: 1});
  g.rotateX(Math.PI / 2); g.translate(0, 14.4, 0); g.computeVertexNormals(); b.add(g, 'concrete');
}
/** Mitre offset of a simple ring; d > 0 outward (droogbak-builder.ts). */
function offsetRing(r: [number, number][], d: number): [number, number][] {
  const area = r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const sg = Math.sign(area), unit = (v: number[]) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
  return r.map((p, i) => {
    const a = r[(i - 1 + r.length) % r.length], c = r[(i + 1) % r.length];
    const e1 = unit([p[0] - a[0], p[1] - a[1]]), e2 = unit([c[0] - p[0], c[1] - p[1]]);
    const n1 = [sg * e1[1], -sg * e1[0]], n2 = [sg * e2[1], -sg * e2[0]];
    const p1 = [p[0] + n1[0] * d, p[1] + n1[1] * d], p2 = [p[0] + n2[0] * d, p[1] + n2[1] * d], cr = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.abs(cr) < 1e-6) return [p1[0], p1[1]] as [number, number];
    const t = ((p2[0] - p1[0]) * e2[1] - (p2[1] - p1[1]) * e2[0]) / cr;
    return [p1[0] + e1[0] * t, p1[1] + e1[1] * t] as [number, number];
  });
}
function drum() {
  // the drum bulges from the chamfer towards the block's NW corner (w13-337 shows its curve); quadratic arc, 12 segments
  const p0 = RING[32], p1 = RING[33], C = cornerNW(), ctl: [number, number] = [(p0[0] + p1[0]) / 4 + C[0] / 2, (p0[1] + p1[1]) / 4 + C[1] / 2];
  const arc = (k: number): [number, number] => { const u = k / 12, a = (1 - u) * (1 - u), m = 2 * u * (1 - u), z = u * u; return [a * p0[0] + m * ctl[0] + z * p1[0], a * p0[1] + m * ctl[1] + z * p1[1]]; };
  const pts = [...Array(13)].map((_, k) => arc(k));
  const mid: [number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const inner: [number, number] = [mid[0] - (ctl[0] - mid[0]) * 0.6, mid[1] - (ctl[1] - mid[1]) * 0.6];
  const solid = (ring: [number, number][], y0: number, y1: number, c: string) => {
    const g = new T.ExtrudeGeometry(new T.Shape(ring.map(p => new T.Vector2(p[0], p[1]))), {depth: y1 - y0, bevelEnabled: false, curveSegments: 1});
    g.rotateX(Math.PI / 2); g.translate(0, y1, 0); g.computeVertexNormals(); b.add(g, c as never);
  };
  solid([...pts, inner], 0, 6.8, 'greyBrick');
  // corrugation: ribs 0.06 m proud every 0.6 m (the sheet's horizontal folds read as bands at gallery size)
  const out = (k: number, d: number): [number, number] => { const p = arc(k), q = arc(Math.min(12, k + 1)), r = arc(Math.max(0, k - 1)), tx = q[0] - r[0], tz = q[1] - r[1], l = Math.hypot(tx, tz), nx = tz / l, nz = -tx / l, sgn = (p[0] - inner[0]) * nx + (p[1] - inner[1]) * nz > 0 ? 1 : -1; return [p[0] + nx * d * sgn, p[1] + nz * d * sgn]; };
  const rib = [...[...Array(13)].map((_, k) => out(k, 0.08)), ...[...Array(13)].map((_, k) => out(12 - k, -0.1))];
  for (let y = 0.6; y < 6.7; y += 0.6) solid(rib, y, y + 0.1, 'greyBrick');
  solid([...[...Array(13)].map((_, k) => out(k, 0.18)), inner], 6.8, 6.95, 'frame');
}

/* ------------------------------------------------------------------ north (Surinamekade) */
const NORTH_BAY = 3.9;
/** Quay storey (edge 31, w01-5, w06-6): loading platform, 3.9 m bays of steel glazing, shutters and doors, canopy band. */
function northQuay() {
  const {f: f0, len} = ringFrame(RING, 31);
  const f = onWall(f0, len / 2, 3);
  const east = ringFrame(RING, 30), fe = onWall(east.f, east.len / 2, 3);
  for (const [g, l, from, to] of [[f, len, 0.2, len - 13], [fe, east.len, 0.2, east.len - 0.2]] as const) {
    sl(g, (from + to) / 2, 0, to - from, 0.45, 2.6, 'stone');                                           // loading platform
    sl(g, (from + to) / 2, 4.65, to - from, 0.2, 0.7, 'frame');                                         // canopy band over the bays
    sl(g, (from + to) / 2, 6.0, to - from, 0.45, 0.14, 'sandstone');                                    // parapet coping, 0.15 m over the terrace
    for (let k = 0; from + (k + 1) * NORTH_BAY <= to + 0.01; k++) {
      const t = from + (k + 0.5) * NORTH_BAY, w = NORTH_BAY - 0.45;
      sl(g, from + k * NORTH_BAY, 0.45, 0.42, 4.2, 0.12, 'concrete');                                  // pier
      const kind = (k * 7 + Math.round(from)) % 9;
      if (kind === 4) {                                                                                 // roller shutters (w01-5 thumb)
        for (const s of [-1, 1]) sl(g, t + s * w / 4, 0.45, w / 2 - 0.1, 3.4, 0.12, 'dark');
        glazed(g, t, 3.95, 4.6, w, {cols: 2, rows: 1});
      } else if (kind === 7) {                                                                          // steel double door
        sl(g, t - w / 4, 0.45, w / 2 - 0.1, 3.1, 0.1, 'greyBrick');
        glazed(g, t + w / 4, 0.5, 4.6, w / 2 - 0.1, {cols: 1, rows: 3});
        glazed(g, t - w / 4, 3.6, 4.6, w / 2 - 0.1, {cols: 1, rows: 1});
      } else glazed(g, t, 0.5, 4.6, w, {cols: 3, rows: 3});
    }
  }
  // railing along the terrace edge (w06-6): posts every 2 m, a top rail
  const tr = shift(f, -0.35);
  sl(tr, (len - 13) / 2, 7.25, len - 13.5, 0.06, 0.06, 'frame');
  for (let t = 4; t < len - 15; t += 2) sl(tr, t, 6.3, 0.06, 0.95, 0.06, 'frame');
}
/**
 * The 3DBAG boundary between the quay roof (6.3 m) and the terrace roof (10.9 m) is ragged (4.4-5.3 m behind the front), and
 * so is the one under the top storey (13.6-14 m): each setback wall is drawn as one straight rendered wall slab whose front
 * stands at the northernmost reach of the upper roof, so the windows have one plane to sit on.
 */
function setbackWall(depth: number, back: number, y0: number, y1: number, from: number, to: number): Frame {
  const {f: f0} = ringFrame(RING, 31), f = shift(f0, -depth);
  sl(f, (from + to) / 2, y0, to - from, y1 - y0, back, 'concrete', -back);
  return f;
}
/** Terrace storey wall (w01-5; Commons 2023 (47)): tall steel windows between rendered piers, 3.9 m bays. */
function northTerrace() {
  const {len} = ringFrame(RING, 31);
  const from = 1.5, to = len - 13.2;
  const f = setbackWall(4.3, 1.4, 6.15, 11.02, from, to);
  sl(f, (from + to) / 2, 10.5, to - from - 0.3, 0.4, 0.12, 'sandstone');
  for (let k = 0; from + (k + 1) * NORTH_BAY <= to; k++) glazed(f, from + (k + 0.5) * NORTH_BAY, 6.6, 10.2, NORTH_BAY - 0.9, {cols: 3, rows: 2});
  // LOODS 6: standing letters on the terrace parapet, 0.44 of the front from the east end (w01-5, Commons "2023 Amsterdam, KNSM-eiland, Loods 6 (13)")
  const tc = 0.44 * len;
  const txt = raisedLettering({text: 'LOODS 6', heightM: 1.7, maxWidthM: 11, depthM: 0.18});
  put(b, f, txt.geometry, tc - txt.widthM / 2, 11.14, -0.6, 'concrete');
  sl(f, tc, 11.02, txt.widthM + 0.4, 0.12, 0.3, 'frame', -0.75);                                     // the letters' base rail
}
/** Top-storey wall over the terrace (w01-5 far view): white-framed windows on the 3.9 m grid. */
function northTop() {
  const {len} = ringFrame(RING, 31);
  const from = 1.5, to = len - 13.2;
  const f = setbackWall(13.2, 1.2, 10.85, 16.0, from, to);
  for (let k = 0; from + (k + 1) * NORTH_BAY <= to; k++)
    glazed(f, from + (k + 0.5) * NORTH_BAY, 11.6, 14.2, 1.9, {cols: 2, rows: 1, bar: 'white', surround: 'white', transom: 13.2});
}

/* ------------------------------------------------------------------ east (Messinastraat) */
/** East fronts: buff-brick annex with red doors (head < 6 m, w05-87) or the rendered upper wall with windows. */
function east() {
  for (let e = 17; e <= 29; e++) {
    const {f: f0, len} = ringFrame(RING, e);
    if (len < 3) continue;
    const mid = [f0.origin[0] + f0.tangent[0] * len / 2 - f0.n[0] * 0.6, f0.origin[1] + f0.tangent[1] * len / 2 - f0.n[1] * 0.6];
    const head = roofHeightAt(src.surfaces as never, mid[0], mid[1]) ?? 15.9;
    const f = onWall(f0, len / 2, Math.min(3, head - 1));
    if (head < 3.5) continue;
    if (head < 6.5) {
      sl(f, len / 2, 0, len - 0.1, head - 1.4, 0.1, 'ochre');
      sl(f, len / 2, head - 1.4, len - 0.1, 1.52, 0.14, 'greyBrick');
      for (let t = 2.2; t < len - 1.5; t += 4.4) {
        sl(f, t, 0.15, 1.0, 2.3, 0.2, 'red');
        sl(f, t, 2.45, 1.3, 0.15, 0.24, 'sandstone');
        if (t + 2.2 < len - 0.6 && Math.abs(probe.offset(f, t + 2.2, 3) ?? 9) < 0.1) sl(f, t + 2.2, 2.7, 0.22, 0.65, 0.2, 'dark');   // slit window
      }
    } else {
      sl(f, len / 2, head - 0.6, len - 0.04, 0.52, 0.16, 'sandstone');
      for (let t = 1.8; t < len - 1.2; t += 3.4) {
        if (Math.abs(probe.offset(f, t, 12) ?? 9) > 0.1 || Math.abs(probe.offset(f, t, 7.5) ?? 9) > 0.1) continue;
        glazed(f, t, 11.6, 14.2, 1.5, {cols: 2, rows: 1, bar: 'white', surround: 'white', transom: 13.2});
        glazed(f, t, 6.6, 8.6, 1.5, {cols: 2, rows: 1, bar: 'white', surround: 'white'});
      }
    }
  }
}

/* ------------------------------------------------------------------ build */
export function buildLoods6(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  addShell(b, src as never, {wall: 'concrete', roof: 'slate', roofFor: s => (s.rings[0].every(v => v[1] > 16.1) ? 'canopyGlass' : 'slate')});
  probe = wallProbe(src.surfaces.filter(s => s.type !== 'GroundSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  setSink(0.25, true);
  // KNSM-laan: west arcade runs, then the 13.8 m runs between the four risalits, then the Kompaszaal run
  arcadeRun();
  southRun(0, BETWEEN.map(t => t + 1.7), {between: true});
  for (const e of [4, 8, 12]) southRun(e, BETWEEN, {between: true});
  southRun(16, [3.7, 3.7 + BAY, 3.7 + 2 * BAY, 3.7 + 3 * BAY], {kompas: true, between: true});
  for (const e of [2, 6, 10, 14]) risalit(e);
  chamfer();
  westHead();
  nwCore();
  drum();
  serre();
  northHead();
  northQuay();
  northTerrace();
  northTop();
  east();
  setSink(0);
}
