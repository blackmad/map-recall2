import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, ledgeStrip, put, ringFrame, ringSlab, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './jungle-swindenstraat-footprints.json';

/**
 * JUNGLE AMSTERDAM, Tweede van Swindenstraat 26, Dapperbuurt (BAG pand 0363100012112062, BAG 1985): the former
 * Muiderpoorttheater and the De Dapper school, one 1985 complex. A theatre block on the street corner: an upper storey of
 * pale panel cladding carried on a concrete beam over the street front, projecting fin piers and steel tube frames with X
 * bracing in front of the panels and over the roof, a taller panel-clad box (the hall) cantilevered over a brick ground
 * floor on the east side; behind it the school's classroom wings, a sawtooth of 4.5-4.9 m faces of pale buff-grey brick
 * with light-grey concrete bands at the floor lines and grey edge strips, one face of each step carrying a stepped window
 * group in red or blue frames per storey, the next face blank with a round porthole per storey.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (front block flat at 13.2 m with its edges scanned as slopes down to 10.7 m;
 * west wing 12.2 m; south and east wings 10.4 m; the low glazed link 6.5 m), except the undercroft at the north-east
 * corner, where the shell's walls are rebuilt so the hall box and the street front's upper storey stand on their beam over a
 * set-back ground floor. Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 50 px/m, t in metres along
 * each facade-ring edge from the viewer's left (ringFrame), y up from the 3DBAG ground; per wall in the inventory:
 *  - street front (edge 6, w01-340, TMX7316010203-001475_pano_0000_000184, 2019; ground at 660 px);
 *  - hall box over the brick base (edge 5, w02-70, TMX7316010203-002593_pano_0000_000838, 2022);
 *  - the front's west end and the low glazed link (edges 10 and 12, w03-338, recording_2024-09-17_08-20-13_00870, 2024);
 *  - classroom wings (w04-w28, 2016-2025 panoramas); the roof frames from the PDOK orthophoto (Actueel_orthoHR).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
type Col = string;
type Wall = {f: Frame; len: number};
const edge = (i: number): Wall => ringFrame(ring, i);
const offset = (f: Frame, out: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * out, f.origin[1] + f.n[1] * out]});

let B: BuildingTools;

/** Palette names (measured tints in the spec): wing brick, the front's buff brick, concrete bands, panel cladding, hall
 * panels, white render, red and blue window frames, awning canvas, yellow posts, green shelves, dark frames, silver frames. */
const BRICK: Col = 'brick', FRONT_BRICK: Col = 'sandstone', BAND: Col = 'stone', PANEL: Col = 'concrete', HALL: Col = 'greyBrick';
const RENDER: Col = 'pink', RED: Col = 'red', BLUE: Col = 'blue', AWNING: Col = 'copper', YELLOW: Col = 'gold', GREEN: Col = 'green';
const WHITEFRAME: Col = 'white', DARKFRAME: Col = 'bronze', SILVER: Col = 'frame', STEEL: Col = 'stone', GLASS: Col = 'glass', DARK: Col = 'dark', ROOF: Col = 'slate';

/** 3DBAG wall surfaces rebuilt by hand: the hall box's east wall over the undercroft (46, 58) and the street front's
 *  east end over the open corner (59). */
const REBUILT = new Set([46, 58, 59, 47, 61, 7, 9, 35, 36]);
const UNDERCROFT = 2.4, BEAM = 5.8, HALL_BEAM = 6.0;

export function buildJungleSwindenstraat(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: BRICK, roof: ROOF, skip: (_s, i) => REBUILT.has(i), wallFor: (s, i) => shellColour(s, i)});
  const sink0 = getSink();
  setSink(0.12, true);
  hallBox(edge(5));
  streetFront(edge(6));
  frontWestEnd(edge(10));
  glazedLink(edge(12));
  for (const [i, spec] of Object.entries(WINGS)) wingFace(edge(Number(i)), spec);
  roofFrames();
  setSink(sink0);
}

/** Shell walls: the front block's walls are panel cladding (its ground floor is dressed over), the hall box's upper walls
 *  the silver hall panels, the rest the wing brick. */
function shellColour(s: Surface, i: number): Col {
  if (i === 45) return HALL;
  if (onEdge(s, 6) || onEdge(s, 10) || onEdge(s, 7) || onEdge(s, 8) || onEdge(s, 9)) return PANEL;
  const r = s.rings[0], ys = r.map(p => p[1]);
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  if (Math.min(...ys) > 9.5 && Math.max(...ys) > 12.8 && cx > -4 && cz < 2) return HALL;
  return BRICK;
}
function onEdge(s: Surface, i: number) {
  const w = edge(i);
  return s.rings[0].every(p => {
    const dx = p[0] - w.f.origin[0], dz = p[2] - w.f.origin[1], t = dx * w.f.tangent[0] + dz * w.f.tangent[1];
    return Math.abs(dx * w.f.n[0] + dz * w.f.n[1]) < 0.3 && t > -0.5 && t < w.len + 0.5;
  });
}
const topOf = (w: Wall, t = w.len / 2) => {
  const x = w.f.origin[0] + w.f.tangent[0] * t - w.f.n[0] * 0.6, z = w.f.origin[1] + w.f.tangent[1] * t - w.f.n[1] * 0.6;
  return roofHeightAt(src.surfaces, x, z) ?? 10.4;
};

// ---- small kit -------------------------------------------------------------------------------------------------------

/** A rebuilt wall panel: 0.3 m deep with its face on the facade-ring plane (replaces a 3DBAG wall surface, so the dressing
 *  never sits a few centimetres off a scanned plane). */
function face(f: Frame, t0: number, t1: number, y0: number, y1: number, c: Col) {
  slab(B, f, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.3, c, -0.3);
}
/** A thin bar standing proud of the glazing (no sink, so stacked bars keep their fronts). */
function bar(f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(B, f, t, y, w, h, d, c, out);
  setSink(s0, true);
}
/** Tube between two points of a wall's (t, y) plane, `out` in front of it. */
function tube(f: Frame, t0: number, y0: number, t1: number, y1: number, out: number, r = 0.05, c: Col = STEEL) {
  const len = Math.hypot(t1 - t0, y1 - y0);
  const g = new T.BoxGeometry(len, r * 2, r * 2).rotateZ(Math.atan2(y1 - y0, t1 - t0)).translate(0, 0, r);
  put(B, f, g, (t0 + t1) / 2, (y0 + y1) / 2, out, c);
}
/** Glazed panel: a frame-coloured back, the glass inset by the frame width, mullions at `cols` and transoms at `rows`
 *  (fractions across), each with its own list of column spans it crosses (default all). */
function glazing(f: Frame, t0: number, t1: number, y0: number, y1: number, frame: Col, cols: number[] = [], rows: number[] = [], fw = 0.07) {
  const w = t1 - t0, h = y1 - y0, t = (t0 + t1) / 2;
  slab(B, f, t, y0, w, h, 0.06, frame);
  slab(B, f, t, y0 + fw, w - 2 * fw, h - 2 * fw, 0.04, GLASS, 0.06);
  for (const c of cols) bar(f, t0 + w * c, y0, fw, h, 0.1, frame, 0.06);
  for (const r of rows) bar(f, t, y0 + h * r - fw / 2, w, fw, 0.1, frame, 0.06);
}
/** Coloured panel with a round porthole (the red and blue window groups' solid cells; the blank faces' portholes). */
function porthole(f: Frame, t: number, y: number, r: number, ringCol: Col, out = 0) {
  ringSlab(B, f, t, y, r, r + 0.07, 0.13, ringCol, out - 0.03, 14);
  disc(B, f, t, y, r + 0.01, 0.1, GLASS, out - 0.03);
}
/** Canvas awning: a sloped sheet from the wall at `y` out `proj` and down `drop`, with a valance. */
function awning(f: Frame, t: number, y: number, w: number, proj: number, drop: number) {
  const s = new T.Shape();
  s.moveTo(0, 0); s.lineTo(proj, -drop); s.lineTo(proj, -drop - 0.22); s.lineTo(proj - 0.04, -drop - 0.22); s.lineTo(proj - 0.04, -drop + 0.01); s.lineTo(0, -0.05); s.lineTo(0, 0);
  const g = new T.ExtrudeGeometry(s, {depth: w, bevelEnabled: false}).rotateY(-Math.PI / 2).translate(w / 2, 0, 0);
  put(B, f, g, t, y, 0, AWNING);
}

// ---- classroom wings ------------------------------------------------------------------------------------------------

type WingSpec = {kind: 'red' | 'blue' | 'blank' | 'porthole' | 'strips'; step?: 'L' | 'R'; awnings?: boolean; groundBand?: boolean; ground?: 'dapper' | 'gate'};
/** Facade-ring edge -> what the face shows (inventory per tag; tree-hidden faces take the wing pattern, said so there). */
const WINGS: Record<number, WingSpec> = {
  // west wing (12.2 m)
  15: {kind: 'blank'}, 16: {kind: 'red', step: 'L'}, 17: {kind: 'red', step: 'R'}, 18: {kind: 'blank'}, 19: {kind: 'blank'},
  20: {kind: 'red', step: 'L'}, 21: {kind: 'porthole'}, 22: {kind: 'red', step: 'L', awnings: true}, 23: {kind: 'porthole'},
  24: {kind: 'red', step: 'R', awnings: true}, 25: {kind: 'blank'}, 26: {kind: 'porthole'}, 27: {kind: 'blue', ground: 'dapper'},
  // south and east wings (10.4 m)
  28: {kind: 'porthole'}, 29: {kind: 'blue'}, 30: {kind: 'blue', awnings: true, ground: 'gate'}, 31: {kind: 'blank'},
  32: {kind: 'blue', groundBand: true}, 33: {kind: 'blue', groundBand: true}, 34: {kind: 'blue', groundBand: true},
  35: {kind: 'blue', groundBand: true}, 36: {kind: 'blue', groundBand: true}, 37: {kind: 'porthole'}, 38: {kind: 'blank'},
  39: {kind: 'blue', groundBand: true}, 40: {kind: 'strips'}, 41: {kind: 'blank'}, 42: {kind: 'blank'}, 43: {kind: 'blank'},
  44: {kind: 'blank'}, 45: {kind: 'blank'}, 0: {kind: 'porthole'}, 1: {kind: 'blue', groundBand: true}, 2: {kind: 'porthole'},
  3: {kind: 'strips'}, 4: {kind: 'blank'}, 13: {kind: 'blank'}, 14: {kind: 'blank'},
};

/** Storey layout. The 12.2 m west wing (w07, w08, w19 at 50 px/m): floor bands at 1.1, 4.6 and 8.2 m, windows 2.3-2.4 m
 *  tall 0.3 m under the band above. The 10.4 m wings (w06, w18): bands at 2.6 and 6.2 m, a short ground storey. */
function storeys(H: number) {
  if (H > 11.5) return {bands: [1.0, 4.55, 8.15], win: [[1.9, 4.25], [5.5, 7.85], [9.1, H - 0.85]] as [number, number][]};
  if (H > 9) return {bands: [0, 2.6, 6.15], win: [[0.85, 2.45], [3.75, 5.95], [7.3, H - 0.7]] as [number, number][]};
  return {bands: [0], win: [] as [number, number][]};
}

function wingFace(w: Wall, s: WingSpec) {
  const H = topOf(w), L = w.len, st = storeys(H);
  // bands, coping and the grey edge strips
  for (const y of st.bands) slab(B, w.f, L / 2, y, L - 0.08, 0.25, 0.08, BAND);
  slab(B, w.f, L / 2, H - 0.45, L - 0.08, 0.53, 0.12, BAND);
  if (L > 1.2) for (const t of [0.14, L - 0.14]) slab(B, w.f, t, 0, 0.2, H - 0.45, 0.06, BAND);
  if (L < 3) return;
  const a = Math.max(0.1 * L, 0.3), c = L - 0.3;
  st.win.forEach(([y0, y1], k) => {
    if (s.kind === 'red' && !(k === 0 && s.ground)) redGroup(w, a, c, y0, y1, s.step ?? 'L');
    else if (s.kind === 'blue' && !(k === 0 && (s.ground || s.groundBand))) blueGroup(w, a, c, y0, y1);
    else if (s.kind === 'blue' && k === 0 && s.groundBand) glazing(w.f, a, c, y0, y1, BLUE, [0.25, 0.5, 0.75]);
    else if (s.kind === 'porthole') porthole(w.f, L / 2, (y0 + y1) / 2 + 0.2, 0.3, BAND);
    else if (s.kind === 'strips' && k < 2) glazing(w.f, 0.1 * L, 0.9 * L, y1 - 0.85, y1 - 0.05, WHITEFRAME, [0.25, 0.5, 0.75]);
    if (s.awnings && k > 0 && (s.kind === 'red' || s.kind === 'blue')) awning(w.f, (a + c) / 2, y1 + 0.3, c - a + 0.1, 0.9, 0.75);
  });
  if (s.ground === 'dapper') dapperEntrance(w, st.win[0]);
  if (s.ground === 'gate') {
    slab(B, w.f, L / 2, 0, 0.8 * L, st.win[0][1] + 0.1, 0.05, DARK);
    for (let t = 0.15 * L; t < 0.9 * L; t += 0.3) bar(w.f, t, 0, 0.03, st.win[0][1] + 0.1, 0.03, DARKFRAME, 0.05);
    disc(B, w.f, 0.6 * L, 0.9, 0.3, 0.05, 'ochre', 0.05);
  }
}

/** Red stepped window group (w07, w08, w10): a solid red cell with a porthole beside the top row, then a three-column grid
 *  whose first top cell is again a red porthole panel and whose last column is one tall pane over a low light. */
function redGroup(w: Wall, a: number, c: number, y0: number, y1: number, step: 'L' | 'R') {
  const h = y1 - y0, r = h / 3, s = 0.21 * (c - a);
  const mir = (t: number) => (step === 'L' ? t : a + c - t);
  const span = (p: number, q: number): [number, number] => [Math.min(mir(p), mir(q)), Math.max(mir(p), mir(q))];
  // step cell: red panel + porthole
  const [p0, p1] = span(a, a + s);
  slab(B, w.f, (p0 + p1) / 2, y1 - r, p1 - p0, r, 0.08, RED);
  porthole(w.f, (p0 + p1) / 2, y1 - r / 2, Math.min(0.2, r * 0.3), BAND, 0.08);
  // main grid
  const m0 = a + s, cw = (c - m0) * 0.27;
  const [g0, g1] = span(m0, c);
  glazing(w.f, g0, g1, y0, y1, RED, step === 'L' ? [0.27, 0.54] : [0.46, 0.73]);
  // transoms: the first two columns in thirds, the big column only its low light
  const [l0, l1] = span(m0, m0 + 2 * cw);
  for (const fr of [1 / 3, 2 / 3]) bar(w.f, (l0 + l1) / 2, y0 + h * fr - 0.035, l1 - l0, 0.07, 0.1, RED, 0.06);
  const [b0, b1] = span(m0 + 2 * cw, c);
  bar(w.f, (b0 + b1) / 2, y0 + h / 3 - 0.035, b1 - b0, 0.07, 0.1, RED, 0.06);
  // red porthole panel in the grid's first top cell
  const [q0, q1] = span(m0, m0 + cw);
  slab(B, w.f, (q0 + q1) / 2, y1 - r, q1 - q0, r - 0.02, 0.18, RED);
  porthole(w.f, (q0 + q1) / 2, y1 - r / 2, Math.min(0.2, r * 0.3), BAND, 0.18);
}

/** Blue window group (w06, w12, w18, w20): a full rectangle in three columns, the narrow first column a blue porthole panel
 *  over two lights, the others three rows with the wide last column one tall pane over a low light. */
function blueGroup(w: Wall, a: number, c: number, y0: number, y1: number) {
  const h = y1 - y0, wd = c - a, r = h / 3;
  glazing(w.f, a, c, y0, y1, BLUE, [0.22, 0.55]);
  bar(w.f, a + wd * 0.385, y0 + h / 3 - 0.035, wd * 0.33, 0.07, 0.1, BLUE, 0.06);
  bar(w.f, a + wd * 0.385, y0 + 2 * h / 3 - 0.035, wd * 0.33, 0.07, 0.1, BLUE, 0.06);
  bar(w.f, a + wd * 0.11, y0 + h / 3 - 0.035, wd * 0.22, 0.07, 0.1, BLUE, 0.06);
  bar(w.f, a + wd * 0.775, y0 + h / 3 - 0.035, wd * 0.45, 0.07, 0.1, BLUE, 0.06);
  slab(B, w.f, a + wd * 0.11, y1 - r, wd * 0.22, r - 0.02, 0.18, BLUE);
  porthole(w.f, a + wd * 0.11, y1 - r / 2, Math.min(0.2, r * 0.3), BAND, 0.18);
}

/** De Dapper school entrance (w27-160, 2025): the red-framed ground-floor window, the dark entrance and the school's red
 *  "de Dapper" letters with its clown emblem over it. */
function dapperEntrance(w: Wall, [y0, y1]: [number, number]) {
  const L = w.len;
  glazing(w.f, 0.1 * L, 0.45 * L, y0, y1, RED, [0.5], [0.3]);
  slab(B, w.f, 0.72 * L, 0, 0.42 * L, y1 - 0.4, 0.15, DARK);
  slab(B, w.f, 0.72 * L, y1 - 0.4, 0.46 * L, 0.2, 0.1, BAND);
  disc(B, w.f, 0.72 * L, y1 + 0.75, 0.32, 0.05, RED, 0.02);
  slab(B, w.f, 0.72 * L, y1 + 0.05, 1.5, 0.3, 0.04, RED, 0.02);
}

// ---- the front block -------------------------------------------------------------------------------------------------

/** Projecting fin pier of the street front (w01-340, at 35-60, 285-310, 525-550, 755-795, 985-1035 px): a concrete fin on a
 *  corbel under the beam, flaring out at the top where the tube frames meet it. */
function fin(f: Frame, t: number, w: number) {
  const s = new T.Shape();
  s.moveTo(0, BEAM - 0.3); s.lineTo(0.45, BEAM - 0.3); s.lineTo(0.45, 10.4); s.lineTo(0.95, 11.45); s.lineTo(0, 11.5); s.lineTo(0, BEAM - 0.3);
  const g = new T.ExtrudeGeometry(s, {depth: w, bevelEnabled: false}).rotateY(-Math.PI / 2).translate(w / 2, 0, -0.1);
  put(B, f, g, t, 0, 0, BAND);
}
/** Vertical panel joints of the cladding, every `step` m between t0 and t1, skipping `gaps`. */
function joints(f: Frame, t0: number, t1: number, y0: number, y1: number, step: number, mid?: number) {
  for (let t = t0 + step; t < t1 - 0.1; t += step) ledgeStrip(B, f, t, y0, 0.035, y1 - y0, 0.085, BAND);
  if (mid !== undefined) ledgeStrip(B, f, (t0 + t1) / 2, mid, t1 - t0, 0.035, 0.085, BAND);
}

/**
 * Street front (edge 6, 21.1 m; w01-340 at 50 px/m, ground 660 px): over the beam (5.8-6.3 m) the cladding storey to 10.5 m
 * with two small square windows, five fin piers, two tube rails at 10.6 and 11.1 m and the X-braced bay; the taller clad box
 * behind (570-665 px); below, the open corner on its column, the buff brick over white render with the yellow and green
 * strips, the recessed glazed entrance with the green JUNGLE panel and the knitted post, and the two-level shop window with
 * dark frames, yellow posts, green planter shelves and planters.
 */
function streetFront(w: Wall) {
  const f = w.f, L = w.len;
  // over the open corner (shell wall 59 rebuilt): the cladding on the beam, the set-back ground wall, the soffit, the return
  face(f, 0.06, 3.45, BEAM, 10.7, PANEL);
  face(f, 3.45, L - 0.06, BEAM, 10.7, PANEL);
  slab(B, f, 2.95, 0, 1.0, BEAM, 0.25, BRICK, -UNDERCROFT - 0.25);
  slab(B, f, 1.7, BEAM - 0.25, 3.5, 0.25, UNDERCROFT + 0.05, BAND, -UNDERCROFT);
  slab(B, offset(f, -UNDERCROFT), 3.35, 0, 0.2, BEAM, UNDERCROFT, RENDER);
  column(f, 1.5, -0.4, BEAM);
  // beam, cladding joints, small windows
  slab(B, f, L / 2, BEAM, L + 0.1, 0.5, 0.35, BAND);
  joints(f, 0, L, BEAM + 0.5, 10.5, 1.2, 8.4);
  for (const t of [11.45, 14.45]) glazing(f, t - 0.25, t + 0.25, 9.3, 9.85, DARKFRAME);
  for (const [t, wd] of [[0.95, 0.5], [5.95, 0.5], [10.75, 0.5], [15.5, 0.8], [20.2, 0.9]]) fin(f, t, wd);
  for (const y of [10.6, 11.1]) tube(f, -0.1, y, L + 0.1, y, 0.55);
  tube(f, 1.2, 10.55, 5.7, 6.5, 0.3, 0.06); tube(f, 1.2, 6.5, 5.7, 10.55, 0.3, 0.06);
  disc(B, f, 3.45, 8.5, 0.15, 0.1, STEEL, 0.36);
  // the taller clad box behind the front
  slab(B, offset(f, -0.8), 12.35, 10.4, 1.9, 3.3, 2.6, PANEL, -2.6);
  // downpipes
  for (const t of [6.5, 19.25]) bar(f, t, 0, 0.1, 10.5, 0.1, STEEL, 0.05);
  // ground: brick over render with the yellow and green strips, the corner block t 3.6-8.3
  face(f, 3.45, 8.2, 3.1, BEAM, FRONT_BRICK);
  // below the brick band: white render t 3.6-6.6, brick with the small window t 6.6-8.2, a white pilaster t 8.6-9.1
  face(f, 3.45, 6.6, 0, 3.1, RENDER);
  face(f, 6.6, 8.2, 0, 3.1, FRONT_BRICK);
  face(f, 8.6, 9.1, 0, BEAM, RENDER);
  face(f, 8.2, 8.6, 2.85, BEAM, RENDER);
  slab(B, f, 3.75, 0, 0.3, 2.85, 0.1, YELLOW);
  face(f, 8.2, 8.6, 0, 2.85, GREEN);
  glazing(f, 7.45, 8.15, 5.2, 5.7, DARKFRAME, [0.5]);
  glazing(f, 7.45, 8.15, 2.4, 3.0, DARKFRAME, [0.5]);
  slab(B, f, 4.5, 3.25, 1.1, 0.3, 0.04, BLUE, 0.05);
  // recessed glazed entrance t 9.1-11.5: glazing over the door, the JUNGLE panel, the knitted post
  face(f, 9.1, 11.5, 0, BEAM, RENDER);
  glazing(f, 9.15, 11.5, 2.6, 5.3, DARKFRAME, [0.5], [0.5]);
  glazing(f, 9.15, 11.5, 0, 2.6, DARKFRAME, [0.15, 0.55]);
  slab(B, f, 9.78, 2.75, 1.05, 1.1, 0.1, GREEN, 0.1);
  disc(B, f, 9.75, 3.35, 0.3, 0.05, YELLOW, 0.2);
  const knit = [RED, YELLOW, GREEN, BLUE, 'ochre'];
  for (let k = 0; k < 8; k++) slab(B, f, 10.62, k * 0.7, 0.22, 0.7, 0.24, knit[k % knit.length], 0.1);
  // shop and ribbon windows t 11.6-21.1
  face(f, 11.5, L - 0.06, 0, BEAM, RENDER);
  // the lower shop band (display 1.25-1.8 m under windows 2.1-3.1 m), split by the yellow post at t 14.9-15.3
  for (const [t0, t1, n] of [[11.65, 14.9, 3], [15.3, 21.0, 6]] as const) glazing(f, t0, t1, 1.2, 3.1, DARKFRAME, Array.from({length: n - 1}, (_, k) => (k + 1) / n), [0.33]);
  for (const [y, d] of [[1.2, 0.35], [1.85, 0.3], [3.05, 0.5]] as const) slab(B, f, 16.35, y, 9.5, 0.1, d, GREEN, 0.06);
  for (const [t0, t1, n] of [[11.7, 14.9, 3], [15.3, 21.0, 5]] as const) glazing(f, t0, t1, 3.9, 5.6, DARKFRAME, Array.from({length: n - 1}, (_, k) => (k + 1) / n), [0.35]);
  for (const [t, wd] of [[15.1, 0.36], [19.55, 0.2]]) slab(B, f, t, 0.4, wd, BEAM - 0.4, 0.15, YELLOW, 0.04);
  for (const t of [12.3, 15.3, 18.0, 20.4]) slab(B, f, t, 3.15, 0.9, 0.35, 0.4, YELLOW, 0.12);
}

function column(f: Frame, t: number, out: number, h: number) {
  put(B, f, new T.CylinderGeometry(0.22, 0.22, h, 10).translate(0, h / 2, 0), t, 0, out, BAND);
}

/**
 * West end of the street front (edge 10, 4.06 m; w03-338 t 0-4.6 at 50 px/m, ground 670 px): the cladding storey with its
 * X-braced bay and a fin, the glazed stair column with the yellow post, white render below with the green canopy over the
 * side door, two small windows under the beam and the JUNGLE flag.
 */
function frontWestEnd(w: Wall) {
  const f = w.f;
  slab(B, f, w.len / 2, BEAM, w.len + 0.1, 0.5, 0.35, BAND);
  joints(f, 0, 2.6, BEAM + 0.5, 10.5, 1.2, 8.4);
  tube(f, 0, 10.55, 2.5, 6.5, 0.3, 0.06); tube(f, 0, 6.5, 2.5, 10.55, 0.3, 0.06);
  for (const y of [10.6, 11.1]) tube(f, -0.1, y, w.len, y, 0.55);
  fin(f, 2.85, 0.55);
  glazing(f, 3.3, 3.95, 6.4, 10.6, DARKFRAME, [], [0.25, 0.5, 0.75]);
  glazing(f, 3.4, 3.94, 2.3, 5.9, DARKFRAME, [], [0.33, 0.66]);
  face(f, 3.0, 3.4, 0, BEAM, YELLOW);
  face(f, 0.06, 3.0, 0, BEAM, RENDER);
  face(f, 3.4, w.len - 0.06, 0, BEAM, RENDER);
  face(f, 0.06, w.len - 0.06, BEAM, 10.7, PANEL);
  glazing(f, 0.12, 0.65, 5.15, 5.7, DARKFRAME);
  slab(B, f, 1.75, 5.15, 0.85, 0.55, 0.05, STEEL, 0.04);
  glazing(f, 2.35, 3.0, 5.15, 5.7, DARKFRAME);
  slab(B, f, 0.8, 3.2, 1.7, 0.12, 0.85, GREEN);
  slab(B, f, 0.8, 0, 1.3, 2.3, 0.06, DARK);
  slab(B, f, 2.7, 3.5, 0.6, 0.9, 0.03, GREEN, 0.3);
}

/**
 * The low glazed link (edge 12, 11.67 m, 6.5 m roof; w03-338 t 4.4-16.1, ground 670 px): a brick plinth to 1.5 m, a storey
 * of glazing in silver frames (1.5-2.9 m, starting 1.9 m in), the grey floor band, a taller upper glazed storey (3.3-5.7 m)
 * with pale blinds and the grey roof fascia; downpipes at t 3.6 and 8.2.
 */
function glazedLink(w: Wall) {
  const f = w.f, L = w.len;
  const mull = [0.26, 1.1, 2.5, 3.6, 4.6, 5.5, 6.4, 7.2, 8.3, 9.3, 10.2, 11.1];
  // one framed bay between each pair of mullions (the frames abut, so the glazing still reads as one run)
  const bays = (fr: Frame, t0: number, t1: number, y0: number, y1: number) => {
    const cuts = [t0, ...mull.filter(m => m > t0 + 0.2 && m < t1 - 0.2), t1];
    for (let k = 0; k + 1 < cuts.length; k++) glazing(fr, cuts[k] + 0.015, cuts[k + 1] - 0.015, y0, y1, SILVER);
  };
  bays(f, 1.9, L - 0.1, 1.5, 2.9);
  slab(B, f, L / 2, 2.9, L, 0.4, 0.1, BAND);
  bays(f, 0.15, L - 0.1, 3.3, 5.7);
  for (const [t0, t1] of [[2.5, 3.6], [5.5, 6.4], [8.3, 9.3], [10.2, 11.1]]) slab(B, f, (t0 + t1) / 2, 5.15, t1 - t0 - 0.1, 0.5, 0.04, RENDER, 0.11);
  slab(B, f, L / 2, 5.7, L - 0.08, 0.86, 0.15, BAND);
  for (const t of [3.6, 8.2]) bar(f, t, 0, 0.1, 5.7, 0.1, STEEL, 0.12);
}

/**
 * The hall box (edge 5, 18.7 m; w02-70 at 50 px/m, ground 670 px): silver panel cladding 6.0-13.2 m with five vertical tube
 * fins, on a grey beam, cantilevered 2.4 m over a set-back brick ground floor with two rows of white-framed strip windows and
 * a white band, on a column near the north corner. Shell walls 46 and 58 are rebuilt here; 45 (t 0-2.2) stays.
 */
function hallBox(w: Wall) {
  const f = w.f, L = w.len, top = 13.4;
  slab(B, f, (2.2 + L - 0.06) / 2, HALL_BEAM, L - 2.26, top - HALL_BEAM, 0.25, HALL, -0.25);
  slab(B, f, L / 2, HALL_BEAM - 0.05, L + 0.05, 0.5, 0.2, BAND);
  joints(f, 0, L, HALL_BEAM + 0.45, top, 0.95, 9.7);
  for (const t of [3.1, 6.0, 8.9, 11.8, 14.7]) bar(f, t, HALL_BEAM + 0.45, 0.14, top - HALL_BEAM - 0.5, 0.14, STEEL, 0);
  // the undercroft: soffit, set-back brick base, its return wall at t 2.2, the column
  slab(B, f, (2.2 + L) / 2, HALL_BEAM - 0.25, L - 2.2, 0.25, UNDERCROFT + 0.05, BAND, -UNDERCROFT);
  const g = offset(f, -UNDERCROFT);
  slab(B, g, (2.2 + L - UNDERCROFT) / 2, 0, L - UNDERCROFT - 2.2, HALL_BEAM, 0.25, BRICK, -0.25);
  slab(B, f, 2.3, 0, 0.2, HALL_BEAM, UNDERCROFT, BRICK, -UNDERCROFT);
  column(f, 16.3, -0.45, HALL_BEAM);
  slab(B, g, (2.2 + L - UNDERCROFT) / 2, 2.95, L - UNDERCROFT - 2.2, 0.2, 0.06, RENDER);
  slab(B, g, 11.9, 0, 4.4, 2.2, 0.04, RENDER);
  // strip windows (w02-70): the upper row a ribbon t 2.3-7.7, a small square at 8.2-8.6, then 9.2-12.8 and 13.2-14.5; the
  // lower row 3.0-4.3, 4.7-7.6, 9.2-12.8 and 13.2-14.5
  const strip = (t0: number, t1: number, y0: number, y1: number) => {
    const n = Math.max(1, Math.round((t1 - t0) / 0.65));
    glazing(g, t0, t1, y0, y1, WHITEFRAME, Array.from({length: n - 1}, (_, k) => (k + 1) / n));
  };
  for (const [t0, t1] of [[2.3, 7.7], [9.2, 12.8], [13.2, 14.5]]) strip(t0, t1, 4.65, 5.5);
  strip(8.12, 8.68, 4.6, 5.16);
  for (const [t0, t1] of [[3.0, 4.3], [4.7, 7.6], [9.2, 12.8], [13.2, 14.5]]) strip(t0, t1, 2.25, 2.8);
}

/**
 * The steel tube space frames over the front block's roof (PDOK orthophoto: two frames side by side, each two cells across
 * and three deep, an X in every cell), 0.8 m over the 13.2 m roof, laid in the street front's frame.
 */
function roofFrames() {
  const f = edge(6).f;
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface' && s.rings[0].every(p => p[1] > 13.0 && p[1] < 13.5));
  const pts = roofs.flatMap(s => s.rings[0]);
  const u = pts.map(p => (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1]);
  const v = pts.map(p => -((p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]));
  const u0 = Math.max(Math.min(...u), 0) + 0.6, u1 = Math.min(Math.max(...u), 21) - 0.6, v0 = Math.min(...v) + 0.6, v1 = Math.max(...v) - 0.6;
  const y = 13.25 + 0.8, nu = 4, nv = 3, du = (u1 - u0) / nu, dv = (v1 - v0) / nv;
  // lines along u at each v, and along v at each u, as tubes in horizontal planes: use frames turned to the roof
  const along = (fr: Frame, t0: number, t1: number, depth: number, yy: number) => tube(offset(fr, -depth), t0, yy, t1, yy, -0.05, 0.06);
  for (let j = 0; j <= nv; j++) along(f, u0, u1, v0 + dv * j, y);
  const side: Frame = {origin: [f.origin[0] + f.tangent[0] * 0, f.origin[1] + f.tangent[1] * 0], tangent: [-f.n[0], -f.n[1]], n: [f.tangent[0], f.tangent[1]]};
  for (let i = 0; i <= nu; i++) {
    const g = offset(side, u0 + du * i);
    tube(g, v0, y, v1, y, -0.05, 0.06);
    for (let j = 0; j <= nv; j++) tube(g, v0 + dv * j, 13.2, v0 + dv * j, y, -0.05, 0.05);
  }
  // diagonals: an X in every cell, drawn as horizontal tubes rotated in the roof plane
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    for (const s of [1, -1]) {
      const a0 = u0 + du * i, b0 = v0 + dv * (s > 0 ? j : j + 1), a1 = a0 + du, b1 = v0 + dv * (s > 0 ? j + 1 : j);
      const p0: [number, number] = [f.origin[0] + f.tangent[0] * a0 - f.n[0] * b0, f.origin[1] + f.tangent[1] * a0 - f.n[1] * b0];
      const p1: [number, number] = [f.origin[0] + f.tangent[0] * a1 - f.n[0] * b1, f.origin[1] + f.tangent[1] * a1 - f.n[1] * b1];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const g = new T.BoxGeometry(len, 0.1, 0.1).rotateY(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0])).translate((p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2);
      B.add(g, STEEL as never);
    }
  }
}
