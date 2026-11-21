import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, poly, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {arcPts, frameRing, onFramePlane, ownFront, signText, tube} from './wallen-more-kit';
import source from './banana-bar-footprints.json';

/**
 * BANANENBAR (Banana Bar), Oudezijds Achterburgwal 37, De Wallen (BAG pand 0363100012177954, BAG 1664; rijksmonument 8):
 * a neck-gabled canal house painted near-black, its gable shoulders carrying white scroll claw pieces, every window opening
 * filled with a painted panel, the long black BANANENBAR board with a yellow banana over the roller shutter, the stoop to
 * the raised door with a small BANANENBAR board over it.
 *
 * Tasteful brief (coordinator, 2026-11-21): the painted window panels show figures; they are drawn as plain pale panels.
 *
 * Read from the rectified Gemeente Amsterdam panoramas recording_2025-06-30_05-16-46_01565 and _01566 (2025-06-30) and
 * b_20250114_1026_Track06_Sphere_00020 (2025-01-14) at 100 px/m on the canal front (facade ring edge 0, 6.32 m, faces 301
 * deg). Crop datum 0.4 m NAP, 3DBAG ground 0.56 m NAP: heights read off the crop minus 0.16 m. Per item in
 * banana-bar-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = 0;
const G = 0.16;
const h = (y: number) => +(y - G).toFixed(3);
const NECK0 = 1.4, NECK1 = 3.75, SHOULDER = h(12.0), NECK_TOP = h(14.05);
const gableTop = (t: number) => (t >= NECK0 && t <= NECK1 ? NECK_TOP : SHOULDER);

export function buildBananaBar(_w: number, _d: number, b: BuildingTools) {
  const {f, len} = ringFrame(src.facadeRing, FRONT);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: onFramePlane(f)});
  const sink0 = getSink();
  setSink(0);
  ownFront(b, f, len, gableTop, src.surfaces, 'brick', {coping: 'stone', copingW: 0.12, n: 40});
  claws(b, f);
  panels(b, f);
  ground(b, f, len);
  setSink(sink0);
}

/** White scroll claw pieces on both shoulders (t 0.15-1.4 and 3.75-5.0 m, 12.0-13.5 m crop): a curved band with a volute disc at its foot, and a cap on the neck. */
function claws(b: BuildingTools, f: Frame) {
  for (const [neck, out] of [[NECK0, -1], [NECK1, 1]] as [number, number][]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push([neck + out * 1.2 * (1 - Math.sin(a)), SHOULDER + 0.12 + 1.35 * (1 - Math.cos(a))]); }
    // the band and the solid web between it and the neck
    poly(b, f, 0, 0, [...pts, [neck, SHOULDER + 0.12]], 0.06, 'brick', 0);
    tube(b, f, pts, 0.14, 0.12, 'stone', 0.02);
    disc(b, f, neck + out * 1.08, SHOULDER + 0.33, 0.2, 0.1, 'stone', 0.02);
    disc(b, f, neck + out * 0.12, SHOULDER + 1.4, 0.12, 0.1, 'stone', 0.02);
  }
  slab(b, f, (NECK0 + NECK1) / 2, NECK_TOP - 0.05, NECK1 - NECK0 + 0.2, 0.18, 0.18, 'stone');
}

/**
 * The window openings, each a dark frame round a plain painted panel (the figures left out): neck (t 2.0-2.9, 12.55-13.6),
 * the top storey (t 0.4-1.1, 1.9-3.0, 3.85-4.45, 5.05-5.75; 10.0-11.4), the middle storey (t 0.55-2.0, 2.65-4.2, 5.0-5.85;
 * 7.2-9.1) and the bel-etage (t 0.5-1.3, 1.45-2.25, 5.0-5.8; 3.9-5.9), the light over the door (t 3.5-4.3, 5.3-5.9).
 */
function panels(b: BuildingTools, f: Frame) {
  const P: [number, number, number, number, string][] = [
    [2.0, 2.9, 12.55, 13.6, 'sandstone'],
    [0.4, 1.1, 10.0, 11.4, 'sandstone'], [1.9, 3.0, 10.0, 11.4, 'sandstone'], [3.85, 4.45, 10.0, 11.4, 'sandstone'], [5.05, 5.75, 10.0, 11.4, 'sandstone'],
    [0.55, 2.0, 7.2, 9.1, 'copper'], [2.65, 4.2, 7.2, 9.1, 'copper'], [5.0, 5.85, 7.2, 9.1, 'sandstone'],
    [0.5, 1.3, 3.9, 5.9, 'sandstone'], [1.45, 2.25, 3.9, 5.9, 'sandstone'], [5.0, 5.8, 3.9, 5.9, 'sandstone'], [3.5, 4.3, 5.3, 5.9, 'sandstone'],
  ];
  for (const [t0, t1, y0, y1, c] of P) {
    frameRing(b, f, (t0 + t1) / 2, h(y0), t1 - t0, y1 - y0, 0.08, 0.08, 'frame');
    slab(b, f, (t0 + t1) / 2, h(y0), t1 - t0, y1 - y0, 0.04, c, 0.02);
    slab(b, f, (t0 + t1) / 2, h(y0) - 0.14, t1 - t0 + 0.2, 0.06, 0.1, 'frame');
  }
}

/**
 * Ground storey: the BANANENBAR board (t 0.1-2.75, 3.0-3.75 m crop: black, a yellow banana, red capitals), the roller shutter
 * (t 0.35-1.35, 0.4-2.6 m) to the souterrain, the raised door (t 3.4-4.4, 2.1-5.2 m) with its small red-lettered board, the
 * stone landing and the steps down to the left with their iron rail.
 */
function ground(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, 0, len, h(0.6), 0.08, 'greyBrick');
  // main board
  const by0 = h(3.0), by1 = h(3.78);
  slab(b, f, 1.42, by0, 2.65, by1 - by0, 0.08, 'bronze');
  slab(b, f, 1.42, by0 + 0.04, 2.57, by1 - by0 - 0.08, 0.03, 'gold', 0.08);
  slab(b, f, 1.42, by0 + 0.09, 2.47, by1 - by0 - 0.18, 0.03, 'bronze', 0.11);
  // the banana: a crescent across the board
  const outer = arcPts(1.42, by0 - 1.6, 2.0, Math.PI * 0.3, Math.PI * 0.7, 12), inner = arcPts(1.42, by0 - 1.8, 2.0, Math.PI * 0.7, Math.PI * 0.3, 12);
  poly(b, f, 0, 0, [...outer, ...inner].map(([t, y]) => [t, Math.max(by0 + 0.1, Math.min(y, by1 - 0.12))]) as [number, number][], 0.03, 'gold', 0.14);
  signText(b, f, 'BANANENBAR', 1.42, by0 + 0.2, 0.17, {width: 2.3, height: 0.34, d: 0.03, colour: 'red'});
  // shutter
  slab(b, f, 0.85, h(0.4), 1.0, 2.2, 0.12, 'concrete');
  for (let y = h(0.5); y < h(2.6); y += 0.12) slab(b, f, 0.85, y, 0.98, 0.02, 0.03, 'greyBrick', 0.12);
  // raised door, its glazed panel and the small board
  frameRing(b, f, 3.9, h(2.15), 0.96, h(5.2) - h(2.15) - 0.06, 0.08, 0.1, 'frame');
  slab(b, f, 3.9, h(2.15), 0.96, h(5.0) - h(2.15) - 0.03, 0.05, 'dark', 0.02);
  slab(b, f, 3.9, h(5.0) - 0.02, 0.95, 0.24, 0.06, 'bronze', 0.1);
  signText(b, f, 'BANANENBAR', 3.9, h(5.0) + 0.03, 0.16, {width: 0.85, height: 0.14, d: 0.02, colour: 'red'});
  // landing and steps
  const top = h(2.1);
  slab(b, f, 3.95, 0, 1.5, top, 1.3, 'greyBrick');
  const n = 6;
  for (let k = 0; k < n; k++) slab(b, f, 3.2 - 0.18 * (k + 0.5), 0, 0.2, top * (n - k) / (n + 1), 1.1, 'greyBrick');
  tube(b, f, [[4.7, top + 0.95], [3.2, top + 0.95], [2.1, top / (n + 1) + 0.95]], 0.04, 0.04, 'bronze', 1.2);
  for (const [t, y] of [[4.68, top], [3.2, top], [2.15, top / (n + 1)]] as [number, number][]) tube(b, f, [[t, y], [t, y + 0.95]], 0.04, 0.04, 'bronze', 1.2);
}
