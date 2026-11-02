import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, put, ringFrame, wallProbe, type Frame} from './nearbar-kit';
import {addShell, planarPolygon} from './worship-shell';
import source from './atlanta-stadhouderskade-footprints.json';

/**
 * Atlanta, Stadhouderskade 5-6 (BAG pand 0363100012080492, BAG year 1929; office building by F.A. Warners, designed 1925,
 * built 1927-28 for the AMEE; setback storey added 1955; gemeentelijk monument 224005; nl.wikipedia "Stadhouderskade 5",
 * CC BY-SA 4.0). Amsterdam School red handmade brick: a basement of shop floor and first floor, five office storeys framed by
 * two half-round oriels, a setback attic of vertical brick strips under the 1955 glazed storey, and the main entrance at the
 * left party wall marked by a tower turned a quarter from the front.
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) in the native frame of scripts/landmarks/atlanta-stadhouderskade-footprints.json
 * (scripts/landmarks/atlanta-stadhouderskade-prepare.ts): front parapet 25.6 m, corner masses 28 m, the attic plane 2.05 m behind
 * the front to 34.4 m, the tower 42.9 m. The front is read from the rectified Gemeente Amsterdam panorama crop w01-52 (CC BY 4.0,
 * 42.2 px/m, t = 0 at the SE end) and the register text (monument 224005):
 *  - shop floor 0-2.5 m in steel and glass under the stub of the lost canopy; a louvred fascia 2.65-3.4 m; the breastwork of
 *    decorative brick under the first floor;
 *  - first floor 4.85-7.05 m: 18 narrow windows at 1.125 m between piers carrying ceramic reliefs (L.S.W. van der Noordaa),
 *    a shallow oriel on a console at either end;
 *  - five office storeys (window bases 8.72 + 3.36 k m): 8 windows of 1.8 m at 2.28 m, the transom light boxed out from the wall
 *    over a flush lower light; the half-round oriels at t 6.05 and 28.8 run from 8.45 m to their stone caps at 25.4 m;
 *  - a bracket course under the parapet coping, corner blocks with a small window, railings on their roofs;
 *  - the attic plane: vertical brick ribs to 31.2 m, then the 1955 glass storey under a white slab roof edge;
 *  - the entrance bay (t 0-4.06): a granite portal round a tall glazed screen over the doors, paired narrow windows above;
 *  - the tower's narrow street face (w01-52, Commons "Amsterdam Stadhouderskade 5.jpg"): one tall glazed slit.
 * The two short rear walls on the side street (w02-154, w03-232): granite ground storey with a shop window and a door under a
 * stone cornice, white-framed windows above.
 *
 * Frame: x east, z south, y up from the 3DBAG ground (0.64 m NAP), origin = the BAG ring vertex average.
 */
type Src = {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
const src = source as unknown as Src;
const RING = src.nativeRing;
let b: BuildingTools;
let probe: ReturnType<typeof wallProbe>;

/** Depth of the attic plane behind the front (3DBAG wall (18.2,-1.2)-(3.9,-19.5)). */
const SET = 2.05;
/** Office storey window bases (w01-52, 42.2 px/m). */
export const FLOORS = [8.72, 12.08, 15.44, 18.8, 22.16];
/** Office window axes along the front, from the SE end. */
export const OFFICE_T = [...Array(8)].map((_, k) => 9.48 + 2.28 * k);
/** First-floor window axes. */
export const FIRST_T = [...Array(18)].map((_, k) => 7.84 + 1.125 * k);
/** Oriel axes (both orders). */
export const ORIEL_T = [6.05, 28.8];

const sl = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => slab(b, f, t, y, w, h, d, c, out);
/** Box without the sink: bars and mullions that must read as facing out of the wall (their sides stay smaller than their face). */
const bar = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => put(b, f, new T.BoxGeometry(w, h, d).translate(0, h / 2, d / 2), t, y, out, c);
const shift = (f: Frame, off: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]});
function onWall(f: Frame, t: number, y: number): Frame {
  const o = probe.offset(f, t, y);
  return o === null ? f : shift(f, o);
}

/* ------------------------------------------------------------------ curved oriels */
/** Plan prism of an arc of chord W and rise P (centre behind the wall), between radii R+r0 and R+r1 and angles a0..a1, height h. */
function arcPrism(f: Frame, t: number, y: number, h: number, W: number, P: number, r0: number, r1: number, a0: number, a1: number, c: string, back = 0) {
  const R = (W * W / 4 + P * P) / (2 * P), cz = P - R, n = 10, pts: T.Vector2[] = [];
  const at = (r: number, a: number) => new T.Vector2(r * Math.sin(a), -(cz + r * Math.cos(a)));
  for (let i = 0; i <= n; i++) pts.push(at(R + r1, a0 + ((a1 - a0) * i) / n));
  if (back > 0) { pts.push(new T.Vector2(pts[n].x, back)); pts.push(new T.Vector2(pts[0].x, back)); }
  else for (let i = n; i >= 0; i--) pts.push(at(R + r0, a0 + ((a1 - a0) * i) / n));
  const g = new T.ExtrudeGeometry(new T.Shape(pts), {depth: h, bevelEnabled: false}).rotateX(-Math.PI / 2);
  put(b, f, g, t, y, 0, c);
}
/** Frame on the arc at angle a, radius R+r (facing out of the curve). */
function arcFrame(f: Frame, t: number, W: number, P: number, r: number, a: number): Frame {
  const R = (W * W / 4 + P * P) / (2 * P), cz = P - R, x = (R + r) * Math.sin(a), z = cz + (R + r) * Math.cos(a);
  const c = Math.cos(a), s = Math.sin(a);
  const n: [number, number] = [f.n[0] * c + f.tangent[0] * s, f.n[1] * c + f.tangent[1] * s];
  const tangent: [number, number] = [f.tangent[0] * c - f.n[0] * s, f.tangent[1] * c - f.n[1] * s];
  return {origin: [f.origin[0] + f.tangent[0] * (t + x) + f.n[0] * z, f.origin[1] + f.tangent[1] * (t + x) + f.n[1] * z], tangent, n};
}
/** One oriel: brick bow from y0 to y1 with a stone base and cap, `lights` curved lights per window band, each in its own white frame. */
function oriel(f: Frame, t: number, W: number, P: number, y0: number, y1: number, bands: [number, number][], lights: number) {
  const R = (W * W / 4 + P * P) / (2 * P), A = Math.asin(W / 2 / R), a = A * 0.86, gap = 0.05 / R;
  arcPrism(f, t, y0, y1 - y0, W, P, 0, 0, -A, A, 'brick', 0.25);
  arcPrism(f, t, y0 - 0.2, 0.2, W + 0.1, P + 0.08, 0, 0, -A, A, 'stone', 0.25);                         // stone base
  arcPrism(f, t, y1, 0.22, W + 0.1, P + 0.1, 0, 0, -A, A, 'stone', 0.25);                               // stone cap
  const step = (2 * a) / lights, sw = 0.07 / R;
  for (const [b0, b1] of bands) for (let k = 0; k < lights; k++) {
    const l0 = -a + step * k + gap, l1 = -a + step * (k + 1) - gap;
    arcPrism(f, t, b0 + 0.03, b1 - b0 - 0.06, W, P, 0.0, 0.06, l0 + sw * 0.5, l1 - sw * 0.5, 'glass');
    arcPrism(f, t, b1 - 0.08, 0.08, W, P, -0.05, 0.1, l0, l1, 'white');                                   // head
    arcPrism(f, t, b0, 0.08, W, P, -0.05, 0.1, l0, l1, 'white');                                          // bottom rail
    arcPrism(f, t, b0 - 0.08, 0.08, W, P, -0.05, 0.18, l0 - gap, l1 + gap, 'stone');                      // sill
    for (const e of [l0 + sw / 2, l1 - sw / 2]) bar(arcFrame(f, t, W, P, 0.03, e), 0, b0 + 0.08, 0.09, b1 - b0 - 0.16, 0.07, 'white');
    if (b1 - b0 > 1.6) arcPrism(f, t, b0 + (b1 - b0) * 0.62, 0.06, W, P, 0.0, 0.09, l0 + sw, l1 - sw, 'white'); // transom
  }
}

/* ------------------------------------------------------------------ windows */
/**
 * Picture frame: rails run the full width, stiles and mullions stand between them, the glass edges tuck inside the frame, so
 * no two visible faces share a plane.
 */
function frameBox(f: Frame, t: number, y0: number, y1: number, w: number, d: number, glassD: number, o: {cols?: number; transom?: number; rail?: number; colour?: string} = {}) {
  const r = o.rail ?? 0.07, c = o.colour ?? 'white', cols = o.cols ?? 1;
  sl(f, t, y0 + r * 0.5, w - 2 * r * 0.6, y1 - y0 - r, glassD, 'glass');
  sl(f, t, y0, w, r, d, c);
  sl(f, t, y1 - r, w, r, d, c);
  for (const k of [0, cols]) sl(f, t - w / 2 + r / 2 + ((w - r) * k) / cols, y0 + r, r, y1 - y0 - 2 * r, d, c);
  for (let k = 1; k < cols; k++) bar(f, t - w / 2 + r / 2 + ((w - r) * k) / cols, y0 + r, 0.1, y1 - y0 - 2 * r, d - glassD, c, glassD);
  if (o.transom !== undefined) for (let k = 0; k < cols; k++) {
    const a = t - w / 2 + r + ((w - r) * k) / cols, bw = (w - r) / cols - r;
    bar(f, a + bw / 2, o.transom, bw, 0.05, d - glassD - 0.02, c, glassD);
  }
}
/** Office window (register: the transom frames lie proud of the wall, the lower light lies back): a flush lower light under a boxed transom light. */
function officeWindow(f: Frame, t: number, fb: number) {
  const w = 1.8, u0 = fb + 0.95, u1 = fb + 1.9;
  sl(f, t, fb - 0.08, w + 0.1, 0.08, 0.2, 'stone');                                                      // sill
  frameBox(f, t, fb, u0, w, 0.13, 0.04, {cols: 2});
  frameBox(f, t, u0, u1, w, 0.3, 0.2, {cols: 2, rail: 0.08});
}
/** Plain white-framed window with optional transom and mullion. */
function plainWindow(f: Frame, t: number, y0: number, y1: number, w: number, o: {transom?: number; mullion?: boolean; sill?: string} = {}) {
  frameBox(f, t, y0, y1, w, 0.13, 0.04, {cols: o.mullion ? 2 : 1, transom: o.transom});
  if (o.sill) sl(f, t, y0 - 0.08, w + 0.12, 0.08, 0.19, o.sill);
}

/* ------------------------------------------------------------------ front (Stadhouderskade) */
function front() {
  const {f: f0, len} = ringFrame(RING, 6);
  const f = onWall(f0, 17, 15);
  // shop floor: steel and glass, the canopy stub, the louvred fascia (w01-52)
  sl(f, 17.4, 0.05, 26.0, 2.4, 0.1, 'glass');
  for (let t = 4.55; t <= 30.0; t += 2.16) sl(f, t, 0.05, 0.1, 2.4, 0.2, 'frame');
  sl(f, 22.75, 0.05, 2.0, 2.4, 0.14, 'dark');                                                             // wooden entrance doors
  sl(f, 22.75, 0.05, 0.08, 2.4, 0.24, 'frame');
  sl(f, 17.4, 2.45, 26.1, 0.17, 0.32, 'frame');                                                          // canopy stub
  sl(f, 17.4, 2.67, 17.6, 0.73, 0.09, 'frame');                                                          // louvre fascia
  for (let y = 2.8; y < 3.35; y += 0.14) sl(f, 17.4, y, 17.5, 0.04, 0.2, 'frame');
  sl(f, 30.65, 0, 0.45, 4.7, 0.12, 'stone');                                                              // granite pier at the NW end
  // breastwork of decorative brick and the first-floor sill course
  sl(f, 17.4, 3.5, 20.2, 1.18, 0.09, 'red');
  for (let y = 3.62; y < 4.6; y += 0.3) sl(f, 17.4, y, 20.1, 0.06, 0.2, 'red');
  sl(f, 17.4, 4.68, 26.0, 0.1, 0.24, 'stone');
  // first floor: narrow windows and the ceramic reliefs on the piers between them
  for (const t of FIRST_T) plainWindow(f, t, 4.85, 7.05, 0.72, {transom: 6.35});
  for (let k = 0; k + 1 < FIRST_T.length; k++) sl(f, (FIRST_T[k] + FIRST_T[k + 1]) / 2, 5.45, 0.28, 0.75, 0.1, 'ochre');
  // first-floor oriels on their consoles
  for (const t of ORIEL_T) {
    oriel(f, t, 2.5, 0.55, 4.82, 7.12, [[4.95, 7.0]], 4);
    sl(f, t, 4.2, 0.55, 0.42, 0.55, 'stone');
  }
  sl(f, 17.4, 8.36, 26.0, 0.12, 0.1, 'red');                                                 // soldier course over the basement
  // office storeys and the tall oriels
  for (const fb of FLOORS) for (const t of OFFICE_T) officeWindow(f, t, fb);
  for (const t of ORIEL_T) oriel(f, t, 3.0, 0.68, 8.5, 25.0, FLOORS.map(fb => [fb - 0.05, fb + 2.3] as [number, number]), 3);
  // parapet: bracket course and coping between the corner blocks
  for (let t = 8.7; t < 26.1; t += 0.42) sl(f, t, 25.0, 0.16, 0.42, 0.15, 'brick');
  sl(f, 17.4, 25.5, 18.0, 0.18, 0.1, 'stone');
  // corner blocks (to the 28 m corner masses) with their small windows and roof railings
  for (const [t0, t1, wt] of [[6.1, 8.5, 6.2], [26.3, 28.2, 28.65]] as const) {
    sl(f, (t0 + t1) / 2, 25.0, t1 - t0, 2.95, SET + 0.1, 'brick', -SET - 0.1);
    sl(f, (t0 + t1) / 2, 27.95, t1 - t0 + 0.06, 0.15, SET + 0.12, 'stone', -SET - 0.1);
  }
  setSink(0);
  for (const t of [6.2, 28.65]) plainWindow(f, t, 25.75, 26.7, 1.3);
  setSink(0.25, true);
  for (const [t0, t1] of [[5.2, 8.4], [26.4, 30.3]] as const) {
    for (let t = t0; t <= t1 + 0.01; t += (t1 - t0) / 4) sl(f, t, 28.1, 0.06, 1.0, 0.06, 'concrete', -0.25);
    sl(f, (t0 + t1) / 2, 29.1, t1 - t0 + 0.06, 0.06, 0.08, 'concrete', -0.27);
  }
  // attic plane: vertical brick ribs, then the 1955 glass storey under its white roof edge
  const fa = shift(f, -SET);
  for (let t = 6.4; t < 29.1; t += 0.42) sl(fa, t, 25.6, 0.14, 5.4, 0.1, 'brick');
  sl(fa, 17.75, 31.0, 22.9, 0.22, 0.16, 'stone');
  sl(fa, 17.75, 31.22, 22.9, 2.78, 0.12, 'glass');
  for (let t = 6.5; t < 29.1; t += 1.45) sl(fa, t, 31.22, 0.09, 2.78, 0.18, 'concrete');
  sl(fa, 17.75, 33.98, 23.1, 0.32, 0.85, 'concrete');
  // entrance bay at the SE party wall: granite portal round a glazed screen, doors and steps; paired windows above
  for (const t of [1.02, 3.22]) sl(f, t, 0, 0.36, 7.35, 0.26, 'stone');
  sl(f, 2.12, 7.0, 2.56, 0.35, 0.26, 'stone');
  sl(f, 2.12, 2.6, 1.84, 4.4, 0.06, 'glass');
  for (const t of [1.66, 2.12, 2.58]) sl(f, t, 2.6, 0.06, 4.4, 0.12, 'frame');
  for (const y of [3.7, 4.8, 5.9]) sl(f, 2.12, y, 1.84, 0.06, 0.12, 'frame');
  sl(f, 2.12, 2.42, 2.3, 0.18, 0.45, 'frame');                                                            // the door canopy
  sl(f, 2.12, 0.15, 1.84, 2.27, 0.06, 'glass');
  sl(f, 2.12, 0.15, 0.08, 2.27, 0.12, 'frame');
  sl(f, 2.12, 0, 2.2, 0.15, 0.6, 'stone');
  sl(f, 2.12, 0, 2.2, 0.3, 0.3, 'stone');
  for (const y of [8.65, 11.4, 14.6, 17.8, 20.9]) for (const t of [2.1, 3.35]) plainWindow(f, t, y, y + (y < 9 ? 1.4 : 1.85), 0.8, {transom: y + 1.0});
  return {f, len};
}

/* ------------------------------------------------------------------ tower */
function tower() {
  // narrow face of the quarter-turned tower toward the street (3DBAG corners (21.1,-0.9)-(20.4,-1.7)), one tall glazed slit
  const a = [21.1, -0.9], c = [20.4, -1.7], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const tangent: [number, number] = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
  const f0: Frame = {origin: [a[0], a[1]], tangent, n: [-tangent[1], tangent[0]]};
  const f = onWall(f0, L / 2, 33);
  setSink(0);
  frameBox(f, L / 2, 26.0, 39.45, 0.66, 0.09, 0.04);
  for (let k = 1; k < 14; k++) sl(f, L / 2, 26.0 + (13.45 * k) / 14 - 0.03, 0.52, 0.06, 0.07, 'white');
  setSink(0.25, true);
}

/* ------------------------------------------------------------------ side street (rear) */
function rear() {
  {
    const {f: f0, len} = ringFrame(RING, 3);
    const f = onWall(f0, len / 2, 2);
    sl(f, len / 2, 0, len - 0.1, 3.5, 0.08, 'stone');
    sl(f, len / 2, 3.5, len - 0.05, 0.25, 0.25, 'stone');
    sl(f, 1.5, 0.1, 1.15, 2.3, 0.2, 'blue');
    sl(f, 5.3, 0.45, 4.6, 2.15, 0.2, 'glass');
    sl(f, 5.3, 2.7, 4.6, 0.65, 0.2, 'glass');
    for (let k = 1; k < 6; k++) sl(f, 3.0 + (4.6 * k) / 6, 2.7, 0.05, 0.65, 0.3, 'bronze');
    for (const t of [5.3 - 4.6 / 6, 5.3 + 4.6 / 6]) sl(f, t, 0.45, 0.06, 2.15, 0.3, 'bronze');
    sl(f, 5.3, 2.6, 4.7, 0.1, 0.3, 'bronze');
    for (const t of [1.4, 3.8, 6.2]) plainWindow(f, t, 4.4, 6.5, 1.3, {transom: 5.7, sill: 'stone'});
  }
  {
    const {f: f0, len} = ringFrame(RING, 4);
    const f = onWall(f0, len / 2, 2);
    sl(f, len / 2, 0, len - 0.1, 3.5, 0.08, 'stone');
    sl(f, len / 2, 3.5, len - 0.05, 0.25, 0.25, 'stone');
    sl(f, len / 2, 0.45, len - 1.2, 2.9, 0.2, 'glass');
    for (const fb of FLOORS) plainWindow(f, len / 2, fb, fb + 1.9, 1.6, {transom: fb + 1.2, sill: 'stone'});
    for (const fb of [4.9, 25.6, 29.0]) plainWindow(f, len / 2, fb, fb + 1.9, 1.6, {transom: fb + 1.2, sill: 'stone'});
  }
}

/**
 * The rear front over the low courtyard wing (w02-154 and w03-232 show it rising behind the wing's curved brick parapet:
 * white-framed two-light windows between brick piers on every storey). In the 3DBAG shell it is a straight run of collinear
 * SW-facing facets from (-11.4,-5.2) to (-1.2,7.6) and a short turned run beyond it, from 8.7 m to 34.5 m; the jagged
 * facets where it meets the tall SW end wall (edge 4) carry none.
 */
const REAR_RUNS: [[number, number], [number, number], number][] = [[[-11.4, -5.2], [-1.2, 7.6], 7], [[-0.9, 8.1], [0.2, 10.2], 1]];
function rearCurve() {
  for (const [a, c, cols] of REAR_RUNS) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), tangent: [number, number] = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
    const n: [number, number] = [tangent[1], -tangent[0]];                                                 // the SW side, away from the shell
    const f = onWall({origin: a, tangent, n}, len / 2, 20);
    for (const fb of [...FLOORS, 25.52, 28.88]) {
      if (fb < 9.4) continue;                                                                              // clear of the courtyard wing's roofs
      for (let k = 0; k < cols; k++) plainWindow(f, ((k + 0.5) * len) / cols, fb, fb + 1.9, 1.35, {transom: fb + 1.25, mullion: true, sill: 'stone'});
    }
  }
}

/* ------------------------------------------------------------------ build */
export function buildAtlantaStadhouderskade(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  probe = wallProbe(src.surfaces.filter(s => s.type !== 'GroundSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  setSink(0.25, true);
  front();
  tower();
  rear();
  rearCurve();
  setSink(0);
}
