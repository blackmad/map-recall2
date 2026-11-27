import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archBand, archSlab, getSink, letters, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {timberWindow} from './wallen-more-kit';
import {cantedBayOn} from './canted-bay-kit';
import {facetFrame} from './corner-turret-kit';
import {turretFacets} from '../../src/canalRecall/landmarks/cornerTurret';
import source from './raadhuisstraat-52-footprints.json';

/**
 * RAADHUISSTRAAT 52 (BAG pand 0363100012172357, BAG year 1902, rijksmonument 518499; the municipal register carries no
 * description text): the corner house on the Raadhuisstraat and the canal, in orange-red brick with light stone lintels,
 * sills and bands, a round corner oriel through three storeys with a balcony on its flat top, a tall front gable with a
 * stepped stone edge and three round-arched lights over the east section, a canted second-storey oriel on a corbel, two
 * round-arched ground-storey openings framed in green glazed brick, and a shopfront under a dark lettered fascia.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). Its front gable (feet 21.5 / 20.9 m, apex
 * 24.2 m over t 12.0) matches the rectified 2019 crop: the rakes leave the stone consoles at about 21.3 m and meet above
 * the frame's top edge, so the gable is drawn on the shell wall, with its coping, stepped stone toothing and consoles.
 *
 * Fronts (nearbar-kit ringFrame, t from the viewer's left):
 *  - Raadhuisstraat (south) front, ring edges 7, 8, 10, 12 (8.99 + 3.91 + 2.13 + 0.6 m, a slight bend at the section
 *    joint), global t from the canal corner: TMX7316010203-001540_pano_0000_000870 (2019, w01-198.alt.jpg) and
 *    TMX7316010203-002045_pano_0001_003044 (2021, w01-198.jpg). The crop's axes fit the shell's joints (the section
 *    pipe on the ring vertex at 8.99 m, the gable centre over the 3DBAG ridge at 12.3 m) with t = x / 54 + 1.6; heights
 *    h = (1190 - y) / 50 (pavement at y 1190).
 *  - Canal (west) front, ring edge 6 (9.81 m), t from the north end: TMX7316010203-000355_pano_0000_000942 (2017,
 *    w02-274.jpg), t = x / 50, h = (1060 - y) / 50 (rows matched to the south front's; the 3DBAG 20.2 m eaves).
 *  - The corner oriel from both crops and both aimed views: 3.8-15.4 m, its flat top the 3DBAG 15.44 m roof at the corner.
 */
type Src = {facadeRing: number[][]; surfaces: unknown[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
const E7 = ringFrame(ring, 7), E8 = ringFrame(ring, 8), E10 = ringFrame(ring, 10), E12 = ringFrame(ring, 12), EW = ringFrame(ring, 6);
/** The south front's edges with their global t start. */
const SOUTH = [{e: E7, t0: 0}, {e: E8, t0: 8.99}, {e: E10, t0: 12.9}, {e: E12, t0: 15.03}];
const S_LEN = 15.63;

/** Storey rows (both fronts) and other heights, h = (1190 - y) / 50 on the 2019 south crop. */
export const H = {
  rows: [[4.4, 7.2], [8.2, 11.0], [12.1, 14.9], [15.9, 18.7]] as [number, number][],
  fascia: [3.8, 4.2] as [number, number], // dark fascia (2021 y 980-1000)
  spring: 2.8, // ground arches spring (y 1050)
  apex: [12.04, 24.23] as [number, number], // the shell's apex vertex
  oriel: [3.8, 15.4] as [number, number],
};

export function buildRaadhuisstraat52(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04, true);
  southWest(b);
  southGable(b);
  canalFront(b);
  cornerOriel(b);
  setSink(sink0);
}

/** Global south t to the edge frame and its local t. */
function sAt(t: number) {
  let k = 0;
  for (let i = 0; i < SOUTH.length; i++) if (t >= SOUTH[i].t0 - 1e-6) k = i;
  return {F: SOUTH[k].e.f, t: t - SOUTH[k].t0};
}
/** A horizontal slab across a global south span, split at the edge joints so each piece lies on its own wall. */
function sSlab(b: BuildingTools, t0: number, t1: number, y: number, h: number, d: number, c: string, out = 0) {
  for (const {e, t0: s0} of SOUTH) {
    const a = Math.max(t0, s0), z = Math.min(t1, s0 + e.len);
    if (z - a > 0.02) slab(b, e.f, (a + z) / 2 - s0, y, z - a, h, d, c, out);
  }
}

/** The gable outline: the shell's wall-top vertices on ring edges 8-12 (global south t, height). */
const SHELL_GABLE: [number, number][] = [[8.99, 21.5], [12.04, 24.23], [12.35, 23.94], [12.9, 23.43], [15.04, 21.41], [15.64, 20.89]];
const shellTop = (t: number) => {
  for (let i = 0; i + 1 < SHELL_GABLE.length; i++) {
    const [a, ya] = SHELL_GABLE[i], [c, yc] = SHELL_GABLE[i + 1];
    if (t >= a && t <= c) return ya + (yc - ya) * (t - a) / (c - a);
  }
  return t < 9 ? 21.5 : 20.89;
};

/** Tall sash window: stone shouldered lintel, small-paned upper sash (3 x 2), plain lower sash, white frames, stone sill. */
function sash(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, out = 0) {
  const split = y0 + (y1 - y0) * 0.58;
  timberWindow(b, F, t, y0, w, split - y0, {cols: 1, rows: 1, frame: 'frame', glass: 'glass', sill: null, out});
  timberWindow(b, F, t, split, w, y1 - split, {cols: 3, rows: 2, frame: 'frame', glass: 'glass', sill: null, out});
  // lintel: a stone block with ears, and the sill
  slab(b, F, t, y1 + 0.02, w + 0.36, 0.36, 0.1, 'stone', out);
  slab(b, F, t, y1 + 0.38, w + 0.56, 0.12, 0.14, 'stone', out);
  slab(b, F, t, y0 - 0.16, w + 0.34, 0.16, 0.14, 'stone', out);
}

/** The shell's west-section wall stands a few cm proud of ring edge 7, more towards the gable section (3DBAG walls). */
const O7: [number, number][] = [[0, 0], [0.77, 0.001], [2.62, 0.023], [4.35, 0.044], [7.14, 0.078], [8.48, 0.095], [8.98, 0.131]];
function o7(t: number) {
  for (let i = 0; i + 1 < O7.length; i++) if (t <= O7[i + 1][0]) return O7[i][1] + (O7[i + 1][1] - O7[i][1]) * (t - O7[i][0]) / (O7[i + 1][0] - O7[i][0]);
  return 0.131;
}

/** A 4 cm course on ring edge 7, split where the shell's wall steps so each piece stands proud of the wall behind it. */
function course7(b: BuildingTools, F: Frame, a: number, c: number, y: number, h: number, colour: string) {
  const cuts = [a, ...O7.map(p => p[0]).filter(t => t > a && t < c), c];
  for (let i = 0; i + 1 < cuts.length; i++) slab(b, F, (cuts[i] + cuts[i + 1]) / 2, y, cuts[i + 1] - cuts[i], h, 0.04, colour, Math.max(o7(cuts[i]), o7(cuts[i + 1])));
}

/** West (canal-corner) section of the south front, global t 0-8.99 on ring edge 7. */
function southWest(b: BuildingTools) {
  const F = E7.f;
  // three window axes (2019 x 50-100, 180-235, 310-360) on four storeys, the corner gable's attic light
  for (const t of [2.99, 5.44, 7.8]) for (const [y0, y1] of H.rows) sash(b, F, t, t === 2.99 ? 0.92 : 1.0, y0, y1, o7(t));
  sash(b, F, 3.0, 0.62, 19.8, 21.6, o7(3.0));
  // stone edging down the corner gable's rake (shell: 2.62 m / 23.73 down to 4.35 m / 19.87) and its pinnacle console
  for (let k = 0; k < 7; k++) {
    const t = 2.7 + k * 0.25, y = 23.6 - (23.6 - 19.95) * (t - 2.62) / (4.35 - 2.62);
    slab(b, F, t, y - 0.3, 0.26, 0.38, 0.12, 'stone');
  }
  pinnacle(b, F, 4.35, 18.85); // its cap stays under the eaves cornice
  // the eaves cornice of the middle part (white boarded, on small brackets) and its dormer
  slab(b, F, 6.7, 19.62, 4.7, 0.26, 0.42, 'concrete');
  slab(b, F, 6.7, 19.88, 4.9, 0.12, 0.55, 'concrete');
  for (let t = 4.6; t < 8.9; t += 0.55) slab(b, F, t, 19.35, 0.1, 0.27, 0.3, 'concrete');
  dormer(b, F, 6.8);
  // ground storey: the two round-arched openings in green glazed brick bands (2019 x 15-145, 180-310)
  for (const t of [3.08, 6.14]) groundArch(b, F, t, 2.35, o7(t + 1.2));
  // green glazed courses through the ground storey brick, stopped at the arches, and at the storey floors
  for (const y of [0.95, 1.75]) for (const [a, c] of [[0.3, 1.5], [7.7, 8.95]] as [number, number][]) course7(b, F, a, c, y, 0.09, 'green');
  for (const y of [8.0, 11.9, 15.65]) course7(b, F, 0.3, 8.95, y, 0.1, 'green');
  slab(b, F, 4.5, 0, 9.0, 0.32, 0.08, 'stone');
}

/** Round ground-storey opening: a red arch ring between two green glazed rings, a white frame and glass. */
function groundArch(b: BuildingTools, F: Frame, t: number, w: number, o = 0) {
  const top = H.spring + w / 2;
  archSlab(b, F, t, 0.32, w, top - 0.32, 0.04, 'frame', o);
  archSlab(b, F, t, 0.4, w - 0.16, top - 0.48, 0.03, 'glass', o + 0.05);
  slab(b, F, t, H.spring - 0.08, w - 0.1, 0.1, 0.08, 'frame', o + 0.04);
  archBand(b, F, t, H.spring, w + 0.24, w / 2 + 0.12, 0.12, 0.1, 'green', o, 12);
  archBand(b, F, t, H.spring, w + 0.48, w / 2 + 0.24, 0.12, 0.05, 'brick', o, 12);
  archBand(b, F, t, H.spring, w + 0.72, w / 2 + 0.36, 0.12, 0.1, 'green', o, 12);
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 + 0.25), H.spring - 0.25, 0.4, 0.25, 0.12, 'stone'); // imposts
}

/** Stone console at a gable foot. */
function pinnacle(b: BuildingTools, F: Frame, t: number, y0: number) {
  // a corbelled stone console under a rake foot (2019 rectified: a drop, a block and a cap, about 1 m tall)
  slab(b, F, t, y0, 0.16, 0.3, 0.14, 'stone');
  slab(b, F, t, y0 + 0.3, 0.34, 0.55, 0.22, 'stone');
  slab(b, F, t, y0 + 0.85, 0.46, 0.16, 0.3, 'stone');
}

/** The white dormer on the middle part's roof: a box with two lights. */
function dormer(b: BuildingTools, F: Frame, t: number) {
  const o = o7(t);
  roofBox(b, F, t, 1.6, 19.6, 21.4, 'concrete', o, 'concrete');
  for (const s of [-1, 1]) timberWindow(b, F, t + s * 0.3, 20.3, 0.56, 0.85, {cols: 2, rows: 2, frame: 'frame', glass: 'glass', sill: null, out: o});
}

/**
 * A dormer front standing on the wall head, flush with the wall below (front 3 cm behind `o`), its cheeks and cap running
 * back 1.2 m into the roof: the front carries the wall's silhouette up so the dormer's lights stand on a wall, not a roof.
 */
function roofBox(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, colour: string, o: number, cap = 'slate') {
  slab(b, F, t, y0, w, y1 - y0, 0.37, colour, o - 0.4);
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 - 0.06), y0, 0.12, y1 - y0, 1.2, colour, o - 1.25);
  slab(b, F, t, y1, w + 0.2, 0.14, 1.35, cap, o - 1.25);
}

/** East (gable) section of the south front, global t 8.99-15.63. */
function southGable(b: BuildingTools) {
  // storey windows: row 1 two wide windows, row 2 the oriel between two narrow lights, rows 3-4 three axes
  for (const [t, w] of [[11.25, 1.3], [13.3, 1.2]] as const) { const p = sAt(t); sash(b, p.F, p.t, w, H.rows[0][0], H.rows[0][1]); }
  for (const [t, w] of [[10.75, 0.62], [13.75, 0.56]] as const) { const p = sAt(t); sash(b, p.F, p.t, w, H.rows[1][0], H.rows[1][1]); }
  for (const r of [2, 3]) for (const t of [10.5, 12.15, 13.87]) { const p = sAt(t); sash(b, p.F, p.t, 1.08, H.rows[r][0], H.rows[r][1]); }
  // the canted oriel at the second storey, on a rounded corbel (2019 x 515-635, y 600-810)
  const o = sAt(12.25);
  cantedBayOn(b, o.F, {
    plan: {t: o.t, base: 2.3, front: 1.2, out: 0.6}, body: [H.rows[1][0] - 0.25, H.rows[1][1] + 0.55],
    // tall lower lights under a row of small upper panes, one window per facet (2019 rectified y 610-790)
    windows: [{y0: H.rows[1][0] + 0.05, y1: H.rows[1][1] + 0.35, cols: 1, rows: 2, rowWeights: [2.4, 1], margin: 0.1, sideCols: 1}],
    bands: [{y: H.rows[1][0] - 0.35, h: 0.12, d: 0.06}, {y: H.rows[1][1] + 0.55, h: 0.3, d: 0.08}],
    corbel: {y0: H.rows[1][0] - 0.85, foot: 0.3}, // the small rounded corbel (2019 rectified y 785-830)
    colours: {wall: 'stone', trim: 'stone', glass: 'glass', frame: 'frame'},
  });
  // stone band at the gable foot
  sSlab(b, 9.05, S_LEN, H.rows[3][1] + 0.52, 0.14, 0.08, 'stone');
  // gable: three round-arched lights under stone arches on a shared sill (2019 x 515-640, y 105-200)
  const g = sAt(12.29);
  sSlab(b, 10.84, 13.74, 19.62, 0.16, 0.14, 'stone');
  for (const dt of [-0.84, 0, 0.84]) {
    const q = {F: g.F, t: g.t + dt}; // all three in ring edge 8's plane (the right one overhangs the 0.16 m jog at 12.9 m)
    archSlab(b, q.F, q.t, 19.78, 0.86, 2.0, 0.08, 'stone');
    archBand(b, q.F, q.t, 19.85, 0.74, 1.8, 0.07, 0.05, 'frame', 0.08, 10); // the white frame ring round the glass
    archSlab(b, q.F, q.t, 19.88, 0.66, 1.74, 0.02, 'glass', 0.15); // the piers between the lights are about 0.2 m (2019)
    slab(b, q.F, q.t, 21.0, 0.66, 0.05, 0.05, 'frame', 0.17);
  }
  // the rakes: a stone coping on the shell's gable edge and, inside it, stepped stone toothing (large and small blocks
  // alternating, 2019 rectified crop), the apex block, the consoles under the feet and the iron hoist bars from the apex
  for (let t = 9.05; t < S_LEN - 0.05; t += 0.22) {
    const p = sAt(t), y = shellTop(t);
    slab(b, p.F, p.t, y - 0.3, 0.26, 0.28, 0.1, 'stone');
  }
  for (let k = 0, t = 9.3; t < S_LEN - 0.2; k++, t += 0.55) {
    if (Math.abs(t - H.apex[0]) < 0.5) continue;
    const p = sAt(t), y = shellTop(t), big = k % 2 === 0;
    slab(b, p.F, p.t, y - (big ? 0.95 : 0.7), big ? 0.5 : 0.36, big ? 0.65 : 0.4, 0.05, 'stone');
  }
  const ap = sAt(H.apex[0]);
  slab(b, ap.F, ap.t, H.apex[1] - 0.55, 0.5, 0.5, 0.12, 'stone');
  for (const t of [9.25, 15.4]) { const p = sAt(t); pinnacle(b, p.F, p.t, 19.4); }
  for (const dt of [-0.35, 0, 0.35]) {
    const g2 = new T.CylinderGeometry(0.025, 0.025, 1.9, 4).rotateZ(dt * 0.5).translate(0, 0.95, 0);
    put(b, ap.F, g2, ap.t + dt * 0.5, H.apex[1] - 2.3, 0.12, 'bronze');
  }
  // white downpipes at the section joints
  for (const t of [4.29, 9.06, 15.4]) { const p = sAt(t); slab(b, p.F, p.t, 0.3, 0.1, 19.0, 0.1, 'concrete', 0.02); }
  shopfront(b);
}

/** The shopfront of the gable section between stone pilasters, under a dark fascia with pale letters. */
function shopfront(b: BuildingTools) {
  const t0 = 9.1, t1 = 15.6;
  for (const t of [t0 + 0.18, t1 - 0.2]) { const p = sAt(t); slab(b, p.F, p.t, 0, 0.4, H.fascia[1] + 0.2, 0.16, 'stone'); }
  sSlab(b, t0, 15.0, H.fascia[0], H.fascia[1] - H.fascia[0], 0.2, 'dark'); // stops at the 0.25 m jog (ring edge 11)
  sSlab(b, 15.0, t1, H.fascia[0], H.fascia[1] - H.fascia[0], 0.2, 'stone');
  sSlab(b, t0, t1, H.fascia[1], 0.14, 0.28, 'stone');
  // the legible words of the fascia (2021): "52" at both ends and "MAGAZIJN"; the illegible words are pale bars
  const L = sAt(9.9), R = sAt(14.7), M = sAt(11.9);
  letters(b, L.F, '52', L.t, H.fascia[0] + 0.07, 0.2, 0.035, 0.03, 'concrete');
  letters(b, R.F, '52', R.t, H.fascia[0] + 0.07, 0.2, 0.035, 0.03, 'concrete');
  letters(b, M.F, 'MAGAZIJN', M.t, H.fascia[0] + 0.07, 0.2, 0.035, 0.03, 'concrete');
  for (const t of [10.85, 13.55]) { const p = sAt(t); slab(b, p.F, p.t, H.fascia[0] + 0.12, t > 12 ? 1.2 : 0.75, 0.2, 0.03, 'concrete', 0.2); }
  // white joinery (2019, 2021): the shop window under its row of transom lights (ring edge 8), and at the east end the
  // white arched door case with the glazed shop door and its fanlight (edge 10)
  const win = sAt(11.18), door = sAt(14.0);
  timberWindow(b, win.F, win.t, 0.45, 3.34, 3.17, {cols: 4, rows: 2, rowWeights: [2.45, 0.72], frame: 'frame', glass: 'glass', sill: null});
  archSlab(b, door.F, door.t, 0.25, 1.8, 3.35, 0.04, 'concrete');
  timberWindow(b, door.F, door.t + 0.3, 0.3, 0.8, 2.9, {cols: 1, rows: 2, rowWeights: [2.3, 0.6], frame: 'frame', glass: 'glass', sill: null, out: 0.04});
  sSlab(b, t0 + 0.4, t1 - 0.4, 0, 0.25, 0.12, 'stone');
}

/** The canal (west) front, ring edge 6, t from the north end; h = (1060 - y) / 50 on the 2017 crop. */
function canalFront(b: BuildingTools) {
  const F = EW.f;
  // the canal column: wide windows under segmental stone hoods with keystones, fanlights, balconettes (2017 x 55-185)
  const rows: [number, number][] = [[4.25, 7.2], [8.2, 11.1], [12.2, 15.0], [15.9, 18.9]];
  rows.forEach(([y0, y1], i) => {
    const t = 2.4, w = 2.3;
    timberWindow(b, F, t, y0, w, y1 - y0 - 0.55, {cols: 3, rows: 1, frame: 'frame', glass: 'glass', sill: null});
    timberWindow(b, F, t, y1 - 0.5, w, 0.5, {cols: 5, rows: 1, frame: 'frame', glass: 'glass', sill: null}); // fanlight
    segBand(b, F, t, y1 + 0.02, w + 0.3, 0.32, 0.2, 0.12, 'stone');
    slab(b, F, t, y1 + 0.16, 0.26, 0.4, 0.18, 'stone'); // keystone
    slab(b, F, t, y0 - 0.2, w + 0.4, 0.2, 0.14, 'stone');
    for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 + 0.12), y0, 0.18, y1 - y0, 0.1, 'stone'); // jamb blocks
    if (i !== 2) balconette(b, F, t, y0, 1.5);
    else slab(b, F, t, y0 - 0.2, 1.3, 0.55, 0.12, 'stone', 0.02); // the low white panel under the third-storey window
  });
  // narrow windows: one at the top storey (x 235-275), the column by the oriel (x 335-395)
  // the shell's V-shaped 0.33 m notch at t 4.31-5.56 (a 3DBAG artefact; the photo shows a flat front): filled flush in brick
  slab(b, F, 4.94, 0, 1.3, 19.95, 0.33, 'brick', -0.36);
  sash(b, F, 5.1, 0.72, rows[3][0] + 0.1, rows[3][1] - 0.2);
  rows.forEach(([y0, y1], i) => (i < 3 ? sash(b, F, 7.3, 1.05, y0 + 0.1, y1 - 0.2) : sash(b, F, 6.7, 0.85, y0 + 0.1, y1 - 0.2))); // top row clear of the balcony recess (shell t 7.34-9.39 above 15.5 m)
  // the attic light in the corner gable's canal side (2017 x 345-385, y 0-70; the shell wall at t 5.99-7.25 rises to 23.9 m)
  sash(b, F, 6.65, 0.7, 20.1, 21.6);
  // eaves cornice either side of the top balcony door (y 20-40), the door with its railing (x 85-150)
  for (const [a, c] of [[0, 1.6], [3.0, 5.85]] as [number, number][]) {
    slab(b, F, (a + c) / 2, 19.7, c - a, 0.26, 0.42, 'concrete');
    slab(b, F, (a + c) / 2, 19.96, c - a + 0.05, 0.12, 0.55, 'concrete');
  }
  // the top balcony door in its brick dormer on the wall head: the door leaf and its fanlight as two lights on a white transom
  // (its foot is set at the shell's 20.2 m wall head, about 0.5 m above the photo's, so the lights stand on the dormer front)
  roofBox(b, F, 2.35, 1.7, 19.5, 22.0, 'brick', 0.13);
  timberWindow(b, F, 2.35, 20.25, 0.9, 1.6, {cols: 2, rows: 2, rowWeights: [2.2, 1], frame: 'frame', glass: 'glass', sill: null, out: 0.1});
  balconette(b, F, 2.35, 20.25, 1.3);
  // downpipe and the green courses through the brick
  slab(b, F, 5.8, 0.3, 0.1, 19.4, 0.1, 'concrete', 0.02);
  for (const y of [8.0, 11.9, 15.65]) slab(b, F, 4.0, y, 7.6, 0.1, 0.03, 'green');
  slab(b, F, 4.9, 0, 9.8, 0.32, 0.08, 'stone');
}

/** A French balcony: dark iron rail, bottom rail and bars in front of a window foot. */
function balconette(b: BuildingTools, F: Frame, t: number, y: number, w: number) {
  const h = 0.6;
  slab(b, F, t, y + h - 0.04, w, 0.04, 0.05, 'bronze', 0.18);
  slab(b, F, t, y + 0.05, w, 0.04, 0.05, 'bronze', 0.18);
  for (let x = -w / 2 + 0.04; x <= w / 2 - 0.03; x += 0.12) slab(b, F, t + x, y + 0.05, 0.02, h - 0.06, 0.02, 'bronze', 0.2);
}

/**
 * The round corner oriel: an octagonal prism round the square shell corner (apothem 1.7 m, its centre 0.8 m inside both
 * walls, so each facet is 1.41 m and stands 0.9 m proud: the 2017 canal crop shows its west light at t 8.3-9.2, the 2019
 * crop its south-east light ending at t 2.3), from a stone corbel at 2.8-3.8 m to the 15.4 m balcony floor, stone bands at
 * the storeys, a 0.86 m light on every facet that stands clear of both walls, and an iron railing round the balcony.
 */
function cornerOriel(b: BuildingTools) {
  // a frame at the corner, its normal on the bisector of the two walls' normals
  const P = ring[7], nW = EW.f.n, nS = E7.f.n, bx = nW[0] + nS[0], bz = nW[1] + nS[1], bl = Math.hypot(bx, bz);
  const n: [number, number] = [bx / bl, bz / bl];
  const F: Frame = {origin: [P[0], P[1]], n, tangent: [n[1], -n[0]]};
  // c: the centre's distance to each wall; the walls' normals are 2 x half apart
  const apothem = 1.7, c = 0.8, half = Math.acos(nW[0] * nS[0] + nW[1] * nS[1]) / 2, d = c / Math.cos(half);
  const R = apothem / Math.cos(Math.PI / 8);
  // a facet faces straight along the bisector (facing 0): the cylinder's vertices turned half a facet
  const prism = (r: number, h: number) => new T.CylinderGeometry(r, r, h, 8).rotateY(Math.PI / 8).translate(0, h / 2, 0);
  const at = (g: T.BufferGeometry, y: number, col: string) => put(b, F, g, 0, y, -d, col);
  const [y0, y1] = H.oriel;
  at(new T.CylinderGeometry(R, R * 0.35, 1.0, 8).rotateY(Math.PI / 8).translate(0, 0.5, 0), y0 - 1.0, 'stone');
  at(prism(R, y1 - y0 - 0.1), y0, 'brick');
  for (const y of [y0, H.rows[0][0] - 0.25, H.rows[1][0] - 0.25, H.rows[2][0] - 0.25]) at(prism(R + 0.06, 0.18), y, 'stone');
  for (const y of [7.6, 11.45]) at(prism(R + 0.04, 0.12), y, 'green');
  at(prism(R + 0.12, 0.36), y1 - 0.2, 'stone'); // the balcony floor slab, its top 6 cm over the shell's 15.44 m roof
  const W = (t: number, o: number): [number, number] => [F.origin[0] + F.tangent[0] * t + F.n[0] * o, F.origin[1] + F.tangent[1] * t + F.n[1] * o];
  const exposed = turretFacets({sides: 8, apothem, centre: [0, -d]}).filter(f => {
    // the facet's light spans 0.43 m either side of its centre: both ends must stand outside the shell
    const tv: [number, number] = [f.normal[1], -f.normal[0]];
    return [-0.48, 0, 0.48].every(s => { const [x, z] = W(f.centre[0] + tv[0] * s + f.normal[0] * 0.02, f.centre[1] + tv[1] * s + f.normal[1] * 0.02); return !inRing(x, z); });
  });
  for (const f of exposed) {
    const ff = facetFrame(F, f);
    for (const [r0, r1] of H.rows.slice(0, 3)) {
      timberWindow(b, ff, 0, r0, 0.86, (r1 - r0) * 0.6, {cols: 1, rows: 1, frame: 'frame', glass: 'glass', sill: null});
      timberWindow(b, ff, 0, r0 + (r1 - r0) * 0.6 + 0.04, 0.86, (r1 - r0) * 0.4 - 0.04, {cols: 2, rows: 2, frame: 'frame', glass: 'glass', sill: null});
      slab(b, ff, 0, r1 + 0.02, 1.1, 0.28, 0.08, 'stone');
    }
    // balcony railing on the oriel's flat top
    const rb = y1 + 0.16; // on the balcony floor slab
    slab(b, ff, 0, rb + 0.92, f.width, 0.06, 0.06, 'bronze', 0.05);
    slab(b, ff, 0, rb + 0.08, f.width, 0.05, 0.05, 'bronze', 0.05);
    for (let x = -f.width / 2 + 0.06; x < f.width / 2; x += 0.13) slab(b, ff, x, rb + 0.13, 0.025, 0.79, 0.025, 'bronze', 0.06);
  }
}

function inRing(x: number, z: number) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
