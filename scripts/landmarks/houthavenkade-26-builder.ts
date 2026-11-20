import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './houthavenkade-26-footprints.json';

/**
 * HOUTHAVENKADE 26 BLOCK (BAG pand 0363100012247232, BAG year 2018, nine storeys): one pand holding a whole Houthavens
 * perimeter block of separately designed buildings. Massing: the 3DBAG LoD2.2 shell (houthavenkade-26-footprints.json,
 * bag-shell-prepare.ts). Fronts, t measured from the viewer's left seen from outside (ringFrame), read from the rectified
 * Gemeente Amsterdam panoramas of the brief (CC BY 4.0; scripts/landmarks/houthavenkade-26-brief.md):
 *  - Haparandaweg (edge 25, w01-2, 2025_09_29_07_54_42_00183, 32.9 px/m): t 0.8-30.7 an orange brick nine-storey block,
 *    four full-height glazed erker stacks between runs of narrow windows; t 30.7-61.1 a dark purple-brown brick block
 *    with three glazed erker stacks, wide and narrow windows, a glazed set-back top storey and a glazed shop plinth.
 *  - The west front (edge 30, w03-272, recording_2024-10-22_07-40-29_00769, 38.3 px/m): the dark brick tower (t 0-6.5),
 *    a three-storey blue-grey brick range with white floor bands and zinc-grey erkers (t 6.5-20.2), and a five-storey red
 *    brick block with a grey shop fascia and French windows behind rails (t 20.4-44.9).
 *  - Houthavenkade (edge 31, w02-182, TMX7316010203-001596_pano_0001_000109, 33.3 px/m): the red brick block with stacked
 *    deep grey balcony slabs (t 0-21.9), four grey brick townhouses with full-width windows and open sawtooth brick
 *    roof frames over glass-railed roof terraces (t 22-45), three dark brick townhouses with white-framed windows (t 45-59.4).
 *  - The gate building over the passage (edges 1-24, w06-320 and w07-140): white floor slabs, glass and grey louvre panels
 *    over a two-storey open passage on round grey columns.
 * The south-east front (edge 32) was a building site in every capture (2016-2017): inferred as the townhouse row. The
 * courtyard walls carry no panorama.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
type C = Parameters<BuildingTools['add']>[1];
const c = (s: string) => s as unknown as C;

export function buildHouthavenkade26(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.facadeRing;
  const pts = (s: Surface) => s.rings[0] as number[][];
  const centre = (s: Surface) => { const p = pts(s); return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[2], 0) / p.length]; };
  // zones in native x (east) / z (south), from the edges above
  const zone = (x: number, z: number, y1: number): string => {
    if (x > 9 && z < 10) return 'concrete'; // the gate building
    if (x > 9) return y1 > 20 ? 'brick' : 'red'; // north-east corner (w05-50: dark brick tower, red low range)
    if (z < 0) return x > -22.2 ? 'ochre' : 'brick'; // Haparandaweg: orange east, dark west
    if (x < -40) { // the west side
      if (z < 8.6) return 'brick';
      if (z < 22.3) return 'greyBrick';
      return 'red';
    }
    if (z > 38) { // Houthavenkade
      if (x < -32.3) return 'red';
      if (x < -9.2) return 'greyBrick';
      return 'stone';
    }
    if (z > 20 && x > 0) return 'stone'; // south-east townhouses (inferred)
    return y1 > 20 ? 'brick' : 'red';
  };
  addShell(b, src as never, {
    wall: 'brick', roof: 'concrete',
    wallFor: s => { const [x, z] = centre(s); return zone(x, z, Math.max(...pts(s).map(p => p[1]))); },
  });
  const sink0 = getSink();
  setSink(0.05, true);
  const E = (i: number) => ringFrame(ring, i);
  /** A grid of windows: columns [t0, t1], rows as sill heights, window height h. */
  const grid = (f: Frame, cols: [number, number][], rows: number[], h: number, frame: C = c('frame'), d = 0.06) => {
    for (const y of rows) for (const [a, z] of cols) {
      slab(b, f, (a + z) / 2, y, z - a, h, d, c('glass'));
      slab(b, f, (a + z) / 2, y - 0.06, z - a + 0.1, 0.08, d + 0.05, frame);
    }
  };
  /** A full-height glazed erker stack: a box `d` deep, frame bands at each floor. */
  const erker = (f: Frame, a: number, z: number, y0: number, y1: number, floors: number[], d: number, frame: C) => {
    // pale: the erker glass reads sky-lit against the brick (w01-2), inside the stiles so no side faces are shared
    slab(b, f, (a + z) / 2, y0, z - a - 0.16, y1 - y0, d, c('canopyGlass'));
    slab(b, f, (a + z) / 2, y0, 0.07, y1 - y0, d + 0.04, frame);
    for (const y of floors) slab(b, f, (a + z) / 2, y, z - a + 0.08, 0.22, d + 0.05, frame);
    for (const t of [a + 0.04, z - 0.04]) slab(b, f, t, y0, 0.08, y1 - y0, d + 0.05, frame);
    slab(b, f, (a + z) / 2, y1, z - a + 0.08, 0.3, d + 0.05, frame);
  };
  const range = (y0: number, step: number, n: number) => Array.from({length: n}, (_, k) => y0 + k * step);

  // ================= Haparandaweg (edge 25) =================
  {
    const {f} = E(25);
    // orange block: seven upper floors at 2.95 m over a 3.6 m ground floor, the parapet at 26.4 m
    const FL = range(3.6, 2.95, 8);
    for (const [a, z] of [[2.0, 5.2], [11.1, 14.0], [17.2, 19.9], [26.3, 28.8]] as [number, number][]) erker(f, a, z, 3.3, 24.9, FL.slice(0, 7), 0.55, c('frame'));
    const narrow: [number, number][] = [6.1, 7.6, 9.1, 10.5, 14.9, 16.3, 20.7, 22.2, 23.7, 25.1, 29.5].map(t => [t - 0.33, t + 0.33]);
    grid(f, narrow, FL.slice(0, 7).map(y => y + 0.75), 1.55);
    // ground floor: doors and windows between brick piers; a dark ledge over it
    grid(f, [[1.9, 3.4], [6.0, 6.9], [10.6, 11.6], [17.9, 19.6], [20.6, 21.4], [26.6, 28.4], [29.2, 29.9]], [0.15], 2.9);
    slab(b, f, 15.75, 3.3, 29.9, 0.15, 0.18, c('stone'));
    slab(b, f, 15.75, 25.0, 29.9, 0.5, 0.2, c('stone')); // the orange block's coping (3DBAG wall top 25.6 m)
    // dark block: glazed shop plinth on a grey stone band, seven floors of tall windows, glazed top storey
    slab(b, f, 45.9, 0, 30.4, 0.45, 0.08, c('stone'));
    grid(f, [[31.0, 33.6], [34.0, 36.4], [37.0, 39.6], [40.0, 43.0], [43.5, 46.0], [46.5, 49.0], [49.4, 52.2], [52.7, 55.2], [55.6, 58.1], [58.5, 60.6]], [0.45], 2.75, c('stone'));
    slab(b, f, 45.9, 3.25, 30.4, 0.55, 0.12, c('stone'));
    const DF = range(4.0, 2.95, 7);
    for (const [a, z] of [[33.9, 36.3], [41.3, 44.1], [48.8, 51.7]] as [number, number][]) erker(f, a, z, 3.85, 24.9, DF, 0.4, c('frame'));
    grid(f, [[31.3, 33.2], [38.8, 40.5], [46.2, 47.7], [53.6, 55.2], [36.9, 37.6], [44.5, 45.1], [52.0, 52.6], [57.2, 58.6], [59.3, 59.9]], DF.map(y => y + 0.3), 2.1, c('stone'));
    // the glazed top storey with brick piers (26.3-28.6 m)
    // (the 3DBAG sets the top storey back ~0.6 m over t 42.5-52.6)
    for (const [a, z, o] of [[30.9, 42.5, 0], [42.5, 52.6, -0.6], [52.6, 60.5, 0]] as [number, number, number][]) {
      slab(b, f, (a + z) / 2, 26.3, z - a, 2.25, 0.05, c('glass'), o);
      for (let t = a + 0.75; t < z - 0.3; t += 1.5) slab(b, f, t, 26.3, 0.06, 2.25, 0.09, c('frame'), o);
    }
    for (const t of [31.2, 38.0, 56.6, 60.3]) slab(b, f, t, 26.3, 0.75, 2.4, 0.12, c('brick'));
  }

  // ================= the west front (edge 30) =================
  {
    const {f} = E(30);
    // the dark tower: three narrow window columns, 3.5 m to 26 m
    grid(f, [[0.9, 1.5], [2.8, 3.4], [4.6, 5.2]], range(3.6, 2.95, 8), 1.7);
    // blue-grey range: white floor bands, zinc erkers on the two upper floors, a glass roof rail
    for (const y of [4.5, 7.6, 10.7]) slab(b, f, 13.35, y, 13.7, 0.3, 0.12, c('sandstone'));
    for (const y of [4.8, 7.9]) {
      for (const [a, z] of [[7.9, 10.0], [12.3, 14.4]] as [number, number][]) {
        slab(b, f, (a + z) / 2, y + 0.15, z - a, 2.4, 0.55, c('glass'));
        slab(b, f, (a + z) / 2, y + 0.05, z - a + 0.1, 0.18, 0.65, c('concrete'));
        slab(b, f, (a + z) / 2, y + 2.5, z - a + 0.1, 0.2, 0.65, c('concrete'));
        for (const t of [a, z]) slab(b, f, t, y + 0.05, 0.12, 2.65, 0.65, c('concrete'));
      }
    }
    grid(f, [[11.0, 11.7], [15.6, 16.6], [18.2, 19.2]], [5.0, 8.1], 2.2);
    grid(f, [[7.6, 8.4], [11.0, 11.7], [15.6, 16.6], [18.2, 19.2]], [0.3], 3.8);
    // red block: grey shop fascia over glazing, four floors of French windows with rails, the loggia column at the end
    slab(b, f, 32.6, 2.9, 24.4, 1.1, 0.1, c('concrete'));
    grid(f, [[21.1, 22.0], [22.6, 24.6], [25.6, 26.6], [27.6, 28.6], [30.0, 32.0], [33.2, 37.3], [37.8, 40.3], [40.8, 42.7]], [0.2], 2.7, c('concrete'));
    const RF = [4.8, 7.8, 10.8, 13.8];
    grid(f, [[21.1, 22.0]], RF, 2.2);
    grid(f, [[30.2, 31.2], [33.2, 34.7], [36.3, 37.3], [39.3, 40.3]], RF, 2.2, c('frame'));
    for (const y of RF) for (const [a, z] of [[30.2, 31.2], [33.2, 34.7], [36.3, 37.3], [39.3, 40.3]] as [number, number][]) slab(b, f, (a + z) / 2, y, z - a - 0.08, 0.95, 0.04, c('frame'), 0.1);
    slab(b, f, 43.7, 4.4, 1.8, 12.5, 0.05, c('dark'), -0.6);
    for (const y of [4.5, 7.5, 10.5, 13.5]) slab(b, f, 32.6, y, 24.4, 0.12, 0.05, c('red'));
  }

  // the tower's set-back north-west face (edge 28, no frontal capture): its window columns carried round (inferred from w03-272)
  for (const i of [28]) {
    const {f, len} = E(i);
    const cols: [number, number][] = [];
    for (let t = 1.2; t < len - 0.8; t += 1.85) cols.push([t - 0.3, t + 0.3]);
    grid(f, cols, range(3.6, 2.95, 8), 1.7);
  }

  // ================= Houthavenkade (edge 31) =================
  {
    const {f} = E(31);
    // red block: stacked deep balcony slabs with grey mesh rails over a glazed ground floor with a grey fascia
    grid(f, [[0.4, 3.8], [4.4, 7.8], [8.4, 11.8], [12.0, 13.8]], [0.2], 2.8, c('concrete'));
    slab(b, f, 7.0, 3.0, 14.0, 1.4, 0.1, c('concrete'));
    for (const y of [4.6, 7.8, 11.1, 14.4]) {
      if (y < 14) slab(b, f, 7.0, y + 0.2, 13.4, 2.5, 0.05, c('glass'));
      slab(b, f, 7.0, y - 0.25, 14.0, 0.25, 1.6, c('concrete'));
      slab(b, f, 7.0, y, 14.0, 1.0, 0.06, c('frame'), 1.55);
    }
    // t 14-21.9: the shell steps back into loggias here; its own walls show
    // grey townhouses: four bays of 5.75 m, full-width windows, glass rails on the roof, open sawtooth brick frames
    for (let k = 0; k < 4; k++) {
      const a = 22.0 + k * 5.75, z = a + 5.75, m = (a + z) / 2;
      slab(b, f, a + 0.25, 0, 0.5, 11.2, 0.15, c('greyBrick'));
      grid(f, [[a + 0.7, z - 0.7]], [0.25], 3.6, c('dark'));
      grid(f, [[a + 0.7, z - 0.7]], [4.8, 7.9], 2.2, c('dark'));
      // dark mullions: three lights per window, a transom on the ground floor (w02-182)
      for (const [y, h] of [[0.25, 3.6], [4.8, 2.2], [7.9, 2.2]]) for (const t of [a + 0.7 + (z - a - 1.4) / 3, a + 0.7 + (2 * (z - a - 1.4)) / 3]) slab(b, f, t, y, 0.07, h, 0.1, c('dark'));
      slab(b, f, m, 2.9, z - a - 1.5, 0.07, 0.1, c('dark'));
      // the frame: a post at the left, a beam down to the right roof edge
      slab(b, f, a + 0.35, 11.2, 0.6, 4.5, 0.5, c('greyBrick'), -0.5);
      poly(b, f, 0, 0, [[a + 0.65, 15.7], [a + 0.65, 15.05], [z - 0.4, 11.2], [z, 11.2], [z, 11.6]], 0.5, c('greyBrick'), -0.5);
    }
    // dark townhouses: three bays, white multi-pane windows, a rooftop frame
    for (let k = 0; k < 3; k++) {
      const a = 45.0 + k * 4.8, z = a + 4.8;
      for (const y of [0.3, 4.9, 7.9]) {
        const h = y < 1 ? 3.4 : 2.2;
        slab(b, f, (a + z) / 2, y, z - a - 1.2, h, 0.06, c('glass'));
        for (const t of [a + 0.6, a + 0.6 + (z - a - 1.2) / 3, a + 0.6 + 2 * (z - a - 1.2) / 3, z - 0.6]) slab(b, f, t, y, 0.08, h, 0.1, c('white'));
        for (const yy of [y, y + h * 0.66, y + h]) slab(b, f, (a + z) / 2, yy - 0.04, z - a - 1.1, 0.08, 0.1, c('white'));
      }
    }
    slab(b, f, 57.0, 10.6, 0.5, 3.6, 0.5, c('stone'), -0.6);
    slab(b, f, 54.5, 13.9, 5.5, 0.4, 0.5, c('stone'), -0.6);
  }

  // ================= the gate building over the passage (edges 1-24) =================
  for (let i = 1; i <= 24; i++) {
    const {f, len} = E(i);
    if (len < 2.5) continue;
    const m = len / 2;
    const facing = ((Math.atan2(f.n[0], -f.n[1]) * 180) / Math.PI + 360) % 360;
    if (Math.abs(facing - 320) > 20 && Math.abs(facing - 140) > 20) continue; // the 1.5 m and end steps stay plain shell
    if (i !== 5 && i !== 19) { grid(f, [[0.3, len - 0.3]], [0.3, 3.8], 2.6, c('concrete')); }
    // the open passage (edges 5 and 19, w06-320 / w07-140): a dark void behind round grey columns, two storeys
    else slab(b, f, m, 0, len - 0.1, 7.0, 0.05, c('dark'));
    if (i === 5 || i === 19) for (const t of [0.5, len - 0.5]) b.add(new T.CylinderGeometry(0.3, 0.3, 7.0, 10).translate(f.origin[0] + f.tangent[0] * t + f.n[0] * 0.5, 3.5, f.origin[1] + f.tangent[1] * t + f.n[1] * 0.5), c('concrete'));
    for (let y = 7.0; y < 25.0; y += 3.05) {
      slab(b, f, m, y, len + 0.2, 0.35, 0.5, c('sandstone'));
      if (y + 3.05 > 25.9) break;
      // grey louvre panels at both ends and the middle (w06-320), glass only between them
      const louv = len > 6 ? [0.8, m, len - 0.8] : [0.75];
      for (const t of louv) slab(b, f, t, y + 0.35, 1.3, 2.7, 0.12, c('concrete'), 0.25);
      const cuts = [0.1, ...louv.flatMap(t => [t - 0.65, t + 0.65]), len - 0.1].map(v => Math.min(len - 0.1, Math.max(0.1, v)));
      for (let k = 0; k + 1 < cuts.length; k += 2) if (cuts[k + 1] - cuts[k] > 0.3) slab(b, f, (cuts[k] + cuts[k + 1]) / 2, y + 0.35, cuts[k + 1] - cuts[k], 2.7, 0.05, c('glass'), 0.25);
    }
    slab(b, f, m, 25.3, len + 0.2, 0.4, 0.5, c('sandstone')); // tops out under the 25.8 m roof plane
  }
  setSink(sink0);
}
