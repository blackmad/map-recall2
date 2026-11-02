import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {faceWall} from './modern-kit';
import {setSink, slab} from './nearbar-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import type {Wall} from './worship-walls';

/**
 * Andaz Amsterdam Prinsengracht, Prinsengracht 587 (BAG pand 0363100012253957, BAG year 1974; municipal monument 200611):
 * the former Centrale Openbare Bibliotheek (1977-2007), designed 1973 by Rob Nord at the office of G. de Klerk with
 * Gerrit de Klerk, a hotel since 2012 (interior Marcel Wanders). Register text (monument 200611): the broad front is
 * four brick planes about the width of a canal house, of different heights, separated by recessed narrow strips of
 * wood and glass; each plane ends in a crisp concrete coping; the window sizes vary from storey to storey to hide the
 * repeated office floors; the ground-floor openings are framed by a band of dark grey natural stone (the puilijst) so
 * the brick planes stand on it.
 *
 * Native east/south metres from the BAG vertex average (scripts/landmarks/andaz-prinsengracht-footprints.json,
 * bag-shell-prepare.ts), y above the 3DBAG ground (0.2 m NAP). The ring is turned 3.67 deg anticlockwise from the RD grid;
 * the builder works in the building frame (u east into the block, v south along the Prinsengracht front at u = -23.1)
 * and turns everything by THETA. Heights from the 3DBAG LoD2.2 roof planes: planes A and C and the main block 21.2 m
 * (roof 138), B and D 17.7-18.1 m (128/129, 146), the set-back top storey 23.7 m (131), the south wing 15.0 m (142), the
 * rear wing on the Klaverbladsgang 4.6 m (145).
 * Front measured on the rectified panorama crop w01-273 (TMX7316010203-001974_pano_0000_000924, 48.8 px/m): `t` is metres
 * along the front from the north end of that crop (v = -24.6), storeys from the pavement.
 */
type Box = {u0: number; u1: number; v0: number; v1: number};
export const THETA = -Math.atan2(2.2, 34.3);
function local(b: BuildingTools): BuildingTools {
  return {...b, add(g, c, x = 0, y = 0, z = 0, angle = 0) { g.rotateY(angle); g.translate(x, y, z); g.rotateY(THETA); b.add(g, c); }};
}
const shape = (pts: [number, number][]) => new T.Shape(pts.map(([u, v]) => new T.Vector2(u, v)));
const rect = (r: Box): [number, number][] => [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
/** A prism with a profile in the (v, y) plane, run along u from u0 to u1 (walls and top in one colour). */
function profileVol(b: BuildingTools, u0: number, u1: number, prof: [number, number][], colour: string) {
  const g = new T.ExtrudeGeometry(new T.Shape(prof.map(([vv, y]) => new T.Vector2(vv, y))), {depth: u1 - u0, bevelEnabled: false});
  g.rotateY(-Math.PI / 2); g.translate(u1, 0, 0);
  b.add(g, colour as never);
}
function vol(b: BuildingTools, pts: [number, number][], y0: number, y1: number, wall: string, roof: string) {
  b.add(openTopPrism(shape(pts), y0, y1), wall as never);
  b.add(upwardRoofPlane(shape(pts), y1), roof as never);
}

const FRONT_U = -23.1, T0 = -24.6;          // front plane; v of t = 0
const v = (t: number) => T0 + t;
const BACK = -13.5, MAIN_TOP = 21.2;         // front volumes run back to the main block (3DBAG 146: D is 10 m deep)
/** The four brick planes and three recessed glazed strips, t along the front (w01-273). */
const PLANES = {
  A: {t0: -1.2, t1: 6.15, top: 21.3},
  B: {t0: 8.0, t1: 14.85, top: 18.0},
  C: {t0: 17.42, t1: 24.08, top: 21.3},
  D: {t0: 25.82, t1: 33.3, top: 17.7},
};
const STRIPS = [
  {t0: 6.15, t1: 8.0, top: 19.3, lights: 2},
  {t0: 14.85, t1: 17.42, top: 18.0, lights: 3},
  {t0: 24.08, t1: 25.82, top: 16.2, lights: 2},
];
const STRIP_SET = 0.5;                       // the strips stand back from the brick planes
const BAND: [number, number] = [2.9, 3.8];   // dark grey stone puilijst
const ROWS = {ground: [0.3, 2.75], first: [3.8, 6.25], r1: [6.97, 9.45], r2: [10.12, 12.6], r3: [13.3, 15.8], r4: [16.47, 18.97]} as const;
type Row = keyof typeof ROWS;
/** Windows per plane per storey, [t0, t1] in metres along the front (w01-273 at 48.8 px/m); two-light windows have a centre mullion. */
const WINDOWS: Record<keyof typeof PLANES, Partial<Record<Row, [number, number][]>>> = {
  A: {r1: [[0.6, 2.4], [3.45, 4.3]], r2: [[0.6, 2.4], [3.45, 4.3]], r3: [[0.6, 2.4], [3.45, 4.3]], r4: [[1.5, 2.3], [3.4, 5.1]]},
  B: {ground: [[9.1, 10.75], [12.0, 13.6]], first: [[10.0, 10.85], [11.9, 13.7]], r1: [[9.1, 10.85], [11.9, 12.7]], r2: [[9.1, 10.85], [11.9, 12.7]], r3: [[9.1, 10.85], [11.9, 13.7]]},
  C: {ground: [[18.5, 20.2], [21.3, 23.0]], first: [[18.44, 20.25], [21.27, 23.05]], r1: [[19.36, 20.25], [21.27, 23.05]], r2: [[19.36, 20.25], [21.27, 23.05]], r3: [[19.36, 20.25], [21.27, 23.05]], r4: [[18.44, 20.25], [21.27, 23.05]]},
  D: {ground: [[27.0, 28.65], [29.7, 31.5]], first: [[27.8, 28.65], [29.7, 31.5]], r1: [[27.8, 28.65], [29.7, 31.5]], r2: [[27.8, 28.65], [29.7, 31.5]], r3: [[26.9, 28.65], [29.7, 30.57]]},
};

/** One window: dark glass, a light frame round it and its bars (centre mullion on a two-light, a transom at 70 %), a stone sill. */
function windowAt(b: BuildingTools, w: Wall, t0: number, t1: number, y0: number, y1: number) {
  const wd = t1 - t0, c = (t0 + t1) / 2, h = y1 - y0;
  slab(b, w, c, y0 + 0.04, wd - 0.1, h - 0.08, 0.06, 'glass');             // glass edges tucked under the frame bars
  for (const t of [t0 + 0.04, t1 - 0.04]) slab(b, w, t, y0 + 0.08, 0.08, h - 0.16, 0.12, 'frame'); // jambs between head and sill bars
  for (const y of [y0, y1 - 0.08]) slab(b, w, c, y, wd, 0.08, 0.12, 'frame');
  slab(b, w, c, y0 + h * 0.7, wd - 0.16, 0.07, 0.12, 'frame');                                     // transom
  if (wd > 1.2) slab(b, w, c, y0 + 0.08, 0.08, h - 0.16, 0.1, 'frame');                           // centre mullion, 2 cm behind the transom
  if (y0 > BAND[1] + 0.05 || y0 < BAND[0]) slab(b, w, c, y0 - 0.11, wd + 0.1, 0.1, 0.16, 'concrete'); // sill (the first floor sits on the stone band)
}

/** Courtyard fronts (register: brick narrowed to strips, large wooden glazed frames): a glass ribbon per 3.17 m storey, brick strips in front running past the ribbons. */
function courtyardGrid(b: BuildingTools, w: Wall, y0: number, top: number, pitch: number) {
  const L = w.length;
  let yHi = y0;
  for (let y = y0 + 0.45; y + 2.4 < top - 0.6; y += 3.17) { slab(b, w, L / 2, y, L - 1.6, 2.4, 0.06, 'glass'); yHi = y + 2.4; }
  for (let t = 0.8; t <= L - 0.8 + 1e-6; t += (L - 1.6) / Math.max(1, Math.round((L - 1.6) / pitch))) slab(b, w, t, y0, 0.9, Math.min(top - 0.4, yHi + 0.5) - y0, 0.12, 'brick');
}

export function buildAndazPrinsengracht(_w: number, _d: number, b0: BuildingTools & {mark?: (n: string) => void}) {
  const b = local(b0);
  // ---- massing ----
  const MAIN: [number, number][] = [[BACK, -25.7], [3.8, -25.7], [3.8, 8.7], [BACK, 8.7]];
  vol(b, MAIN, 0, MAIN_TOP, 'brick', 'slate');
  vol(b, rect({u0: -13.0, u1: -4.0, v0: -20.0, v1: -12.0}), MAIN_TOP - 0.05, 23.7, 'brick', 'slate');   // set-back top storey (3DBAG 131)
  vol(b, rect({u0: -6.2, u1: 2.7, v0: 8.6, v1: 19.1}), 0, 15.0, 'brick', 'slate');                        // south wing behind the canal houses
  vol(b, rect({u0: 3.7, u1: 25.5, v0: -6.5, v1: -1.8}), 0, 4.6, 'brick', 'slate');                        // rear wing on the Klaverbladsgang
  for (const [k, p] of Object.entries(PLANES)) {
    if (k === 'D') continue;
    vol(b, rect({u0: FRONT_U, u1: BACK + 0.3, v0: v(p.t0), v1: v(p.t1)}), 0, p.top, 'brick', 'slate');
  }
  // plane D with its sloped shoulder at the south corner (ref-front-2021, w01-273: 1.0 m across, 1.6 m down)
  profileVol(b, FRONT_U, BACK + 0.3, [[v(PLANES.D.t0), 0], [v(PLANES.D.t1), 0], [v(PLANES.D.t1), PLANES.D.top - 1.6], [v(PLANES.D.t1) - 1.0, PLANES.D.top], [v(PLANES.D.t0), PLANES.D.top]], 'brick');
  for (const s of STRIPS) vol(b, rect({u0: FRONT_U + STRIP_SET, u1: BACK + 0.3, v0: v(s.t0) + 0.02, v1: v(s.t1) - 0.02}), 0, s.top, 'bronze', 'canopyGlass');
  b0.mark?.('shell');

  setSink(0.05, true);
  const front = (t0: number, t1: number, y1: number, set = 0) => faceWall([FRONT_U + set, v(t0)], 270, t1 - t0, 0, y1);
  // ---- brick planes: windows, copings, the stone band ----
  for (const [k, p] of Object.entries(PLANES) as [keyof typeof PLANES, typeof PLANES.A][]) {
    const w = front(p.t0, p.t1, p.top);
    for (const [row, list] of Object.entries(WINDOWS[k]) as [Row, [number, number][]][]) {
      const [y0, y1] = ROWS[row];
      for (const [a, c] of list) windowAt(b, w, a - p.t0, c - p.t0, y0, y1);
    }
    const cw = k === 'D' ? p.t1 - p.t0 - 1.12 : p.t1 - p.t0 - 0.12;              // 6 cm in from the plane sides; D's stops at its shoulder
    slab(b, w, k === 'D' ? cw / 2 + 0.06 : (p.t1 - p.t0) / 2, p.top - 0.35, cw, 0.38, 0.12, 'concrete'); // concrete coping
  }
  // the puilijst: one continuous dark stone band across the planes, filled back to the recessed strips
  {
    const all = front(PLANES.A.t0, PLANES.D.t1, MAIN_TOP), L = PLANES.D.t1 - PLANES.A.t0;
    slab(b, all, L / 2, BAND[0], L - 0.16, BAND[1] - BAND[0], 0.16, 'stone');
  }
  // plane A: the glazed first floor running into strip 1, the dark stone band over it, the open loggia at the ground
  {
    const w = front(PLANES.A.t0, PLANES.A.t1, PLANES.A.top), o = -PLANES.A.t0;
    slab(b, w, o + 3.18, ROWS.first[0] + 0.04, 5.04, ROWS.first[1] - ROWS.first[0] - 0.08, 0.06, 'glass');
    for (let t = 0.6; t <= 5.8; t += 0.86) slab(b, w, o + t, ROWS.first[0], 0.08, ROWS.first[1] - ROWS.first[0], 0.12, 'frame');
    slab(b, w, o + 2.95, 6.25, PLANES.A.t1 - PLANES.A.t0 - 0.1 - 0, 0.6, 0.14, 'stone');
    slab(b, w, o + 3.3, 0, 5.4, BAND[0] - 0.05, 0.06, 'dark');   // the dark open loggia under plane A (w01-273)
  }
  // ---- glazed strips: storey-high wood-and-glass with dark spandrels, the hotel entrance in strip 3 ----
  STRIPS.forEach((s, i) => {
    const w = front(s.t0, s.t1, s.top, STRIP_SET), L = s.t1 - s.t0;
    for (const [y, y1r] of [[0.3, 2.75], [3.9, 6.25], [6.82, 9.6], [9.97, 12.75], [13.15, 15.95], [16.32, 99]] as [number, number][]) { // one pane per storey, ~0.4 m bronze spandrels between (w01-273)
      const y1 = Math.min(y1r, s.top - 0.35);
      if (y1 - y < 1) continue;
      if (i === 2 && y < 1) continue;                                           // the entrance doors take the ground storey of strip 3
      slab(b, w, L / 2, y, L - 0.24, y1 - y, 0.06, 'glass');
    }
    for (let k = 1; k < s.lights; k++) slab(b, w, k * L / s.lights, 0.3, 0.08, s.top - 0.65, 0.12, 'frame');
    for (const t of [0.06, L - 0.06]) slab(b, w, t, 0.3, 0.1, s.top - 0.65, 0.12, 'frame');
    slab(b, w, L / 2, BAND[0] + 0.02, L - 0.04, BAND[1] - BAND[0] - 0.04, STRIP_SET - 0.02, 'stone'); // band filler back to the strip
    if (i === 2) slab(b, w, L / 2, 0, L - 0.3, 2.6, 0.08, 'dark');                // hotel entrance doors
  });
  // ---- courtyard (east) front of the main block: brick strips with large wooden glazed frames (register text) ----
  courtyardGrid(b, faceWall([3.8, 8.7], 90, 34.4, 4.7, MAIN_TOP), 6.32, MAIN_TOP, 2.9);
  const wingWest = faceWall([-6.2, 8.6], 270, 10.5, 0, 15.0);                   // faces the gardens behind the canal houses (inferred)
  courtyardGrid(b, wingWest, 0.3, 15.0, 2.6);
  const wing = faceWall([2.7, 19.1], 90, 10.5, 0, 15.0);
  courtyardGrid(b, wing, 0.3, 15.0, 2.6);
  setSink(0);
}
