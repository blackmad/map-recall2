import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, disc, getSink, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {onFramePlane, ownFront, signText, timberWindow, tube} from './wallen-more-kit';
import source from './erotic-museum-footprints.json';

/**
 * EROTIC MUSEUM, Oudezijds Achterburgwal 54, De Wallen (BAG pand 0363100012172007, BAG 1737; rijksmonument 87, a warehouse
 * dated 1685 in the register): a brick warehouse with a spout gable (tuitgevel), a centre column of tall loading windows,
 * small round-headed side windows, every opening framed in white block quoins, two oculi in the gable, the ANNO stone, the
 * red neon script "Erotic Museum" on a black arched board over the entrance arch, and three arches in the ground storey.
 *
 * Read from the rectified Gemeente Amsterdam panoramas b_20250114_1026_Track06_Sphere_00148 (2025-01-14, the whole front
 * leaf-off, the neon lit), b_20250114_1026_Track06_Sphere_00149 (2025-01-14) and recording_2025-06-30_05-16-46_01529
 * (2025-06-30, the ground storey) at 100 px/m on the canal front (facade ring edge 3, 6.17 m, faces 124 deg). Crop datum
 * 0.4 m NAP, the 3DBAG ground 0.50 m NAP: heights are read off the crop minus 0.1 m. The right 0.8 m of the front is
 * behind a tree trunk in every 2025 view; the gable is drawn symmetric. Per item in erotic-museum-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = 3;
const G = 0.1;
const h = (y: number) => +(y - G).toFixed(3);
/** Spout gable: the spout 2.3-3.2 m wide at the top (14.4-15.0 m crop), the rakes falling 1.4 m per metre to 10.9 m shoulders. */
const SPOUT0 = 2.3, SPOUT1 = 3.2;
function gableTop(t: number) {
  if (t >= SPOUT0 && t <= SPOUT1) return h(15.0);
  const d = t < SPOUT0 ? SPOUT0 - t : t - SPOUT1;
  return Math.max(h(10.9), h(14.4) - 1.4 * d);
}

export function buildEroticMuseum(_w: number, _d: number, b: BuildingTools) {
  const {f, len} = ringFrame(src.facadeRing, FRONT);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: onFramePlane(f)});
  const sink0 = getSink();
  setSink(0);
  ownFront(b, f, len, gableTop, src.surfaces, 'brick', {coping: 'stone', copingW: 0.12});
  gable(b, f);
  centreColumn(b, f);
  sideWindows(b, f);
  ground(b, f);
  sign(b, f);
  setSink(sink0);
}

/** White block quoins either side of an opening t +- w/2 from y0 to y1: alternating long (0.3 m) and short (0.18 m) blocks, 0.2 m tall every 0.4 m. */
function quoins(b: BuildingTools, f: Frame, t: number, w: number, y0: number, y1: number) {
  let k = 0;
  for (let y = y0 + 0.05; y + 0.2 <= y1 + 0.01; y += 0.4, k++) {
    const L = k % 2 ? 0.18 : 0.3;
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + L / 2 - 0.04), y, L, 0.2, 0.05, 'stone');
  }
}

/** The two oculi (t 0.75, 4.75 m at 11.2 m crop), the small attic hatch (t 2.7, 12.4-13.3 m) and the spout's white bands. */
function gable(b: BuildingTools, f: Frame) {
  for (const t of [0.75, 4.95]) {
    disc(b, f, t, h(11.2), 0.24, 0.04, 'stone');
    disc(b, f, t, h(11.2), 0.16, 0.03, 'glass', 0.04);
  }
  timberWindow(b, f, 2.75, h(12.4), 0.62, 0.95, {cols: 1, rows: 2, arch: true, frame: 'frame', sill: 'stone'});
  quoins(b, f, 2.75, 0.62, h(12.4), h(13.2));
  slab(b, f, 2.75, h(14.3), SPOUT1 - SPOUT0 + 0.1, 0.12, 0.08, 'stone');
}

/** The centre column of loading windows (t 2.75 m), each white-framed in white quoins, with segmental heads. */
function centreColumn(b: BuildingTools, f: Frame) {
  for (const [y0, y1, rows] of [[10.0, 11.6, 3], [7.6, 9.3, 3], [5.1, 6.9, 3], [3.4, 4.4, 2]] as [number, number, number][]) {
    timberWindow(b, f, 2.75, h(y0), 1.32, y1 - y0, {cols: 2, rows, frame: 'frame', sill: 'stone', arch: y1 - y0 < 1.2});
    quoins(b, f, 2.75, 1.32, h(y0), h(y1));
    if (y1 - y0 >= 1.2) slab(b, f, 2.75, h(y1) + 0.02, 1.7, 0.14, 0.06, 'stone');
  }
}

/** Round-headed side windows 0.6 m wide at t 0.85 and 4.85 m (8.8-9.6, 6.1-6.9, 3.6-4.4 m crop), the right low one a 0.85 m arched window; the ANNO stone. */
function sideWindows(b: BuildingTools, f: Frame) {
  for (const t of [0.85, 4.85]) for (const [y0, y1] of [[8.8, 9.65], [6.05, 6.9]] as [number, number][]) {
    timberWindow(b, f, t, h(y0), 0.6, y1 - y0, {cols: 1, rows: 2, arch: true, frame: 'frame', sill: 'stone'});
    quoins(b, f, t, 0.6, h(y0), h(y1));
  }
  timberWindow(b, f, 0.85, h(3.6), 0.6, 0.85, {cols: 1, rows: 2, arch: true, frame: 'frame', sill: 'stone'});
  quoins(b, f, 0.85, 0.6, h(3.6), h(4.45));
  timberWindow(b, f, 4.85, h(3.25), 0.85, 1.2, {cols: 1, rows: 2, arch: true, frame: 'frame', sill: 'stone'});
  slab(b, f, 0.85, h(4.95), 0.62, 0.32, 0.05, 'stone');
}

/** Ground storey: a dark green arched door left (t 0.45), the wide entrance arch under the sign (t 1.6-3.85, to 2.0 m) and a barred arched window right (t 4.6). */
function ground(b: BuildingTools, f: Frame) {
  archSlab(b, f, 0.5, 0, 1.0, 1.95, 0.04, 'stone');
  archSlab(b, f, 0.5, 0, 0.84, 1.87, 0.05, 'green', 0.04);
  archSlab(b, f, 2.72, 0, 2.4, 2.05, 0.04, 'stone');
  archSlab(b, f, 2.72, 0, 2.22, 1.96, 0.05, 'dark', 0.04);
  archSlab(b, f, 4.65, 0.3, 1.0, 1.75, 0.04, 'stone');
  timberWindow(b, f, 4.65, 0.4, 0.82, 1.55, {cols: 3, rows: 3, arch: true, frame: 'frame', sill: null, out: 0.04});
}

/**
 * The sign over the entrance (t 1.4-4.3 m, 1.95-3.05 m crop): a black board with a rounded top and "Erotic Museum" in red
 * neon script, an underline swash ending in an arrow; the neon hearts are drawn as two small rings.
 */
function sign(b: BuildingTools, f: Frame) {
  const y0 = h(1.98), y1 = h(3.05);
  archSlab(b, f, 2.85, y0, 2.9, y1 - y0 + 0.35, 0.08, 'bronze', 0.02);
  signText(b, f, 'Erotic Museum', 2.85, y0 + 0.4, 0.1, {width: 2.6, height: 0.68, d: 0.03, colour: 'red'});
  tube(b, f, [[1.7, y0 + 0.32], [2.6, y0 + 0.22], [3.6, y0 + 0.24], [4.05, y0 + 0.3]], 0.035, 0.03, 'red', 0.1);
  tube(b, f, [[3.92, y0 + 0.38], [4.07, y0 + 0.3], [3.93, y0 + 0.2]], 0.035, 0.03, 'red', 0.1);
}
