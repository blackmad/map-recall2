import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, poly, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {arcPts, signText, timberWindow, tube} from './wallen-more-kit';
import source from './condomerie-footprints.json';

/**
 * CONDOMERIE, Warmoesstraat 141, De Wallen (BAG pand 0363100012171794; gemeentelijk monument 328916, a nineteenth-century
 * front under a cornice with consoles): the world's first condom shop (1987) in the ground storey of a five-storey brick
 * house: a cream shopfront of four pilasters with the shop name in big letters each painted a different colour along the
 * fascia, two shop windows and a glazed door; above, three axes of tall white sash windows under segmental brick arches,
 * the middle axis with little iron balconies, iron railings across the top two storeys, and a deep white cornice and attic.
 *
 * Read from the rectified Gemeente Amsterdam panoramas b_20250108_1349_Track26_Sphere_00039 (2025-01-08),
 * recording_2025-07-03_03-29-47_02680 and _02679 (2025-07-03) at 100 px/m on the Warmoesstraat front (facade ring edge 0,
 * 5.91 m, faces 314 deg). The crops are datumed on an assumed 0.4 m NAP with the camera 2.44 m over its street, so their
 * 0 is the pavement (2.05 m NAP here); heights below are over the pavement. Per item in condomerie-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = 0;
const AXES = [1.15, 2.95, 4.75];
const WIN = 1.12;
/** Fascia letter colours left to right (2025-07-03 crop): red, yellow, green, blue, orange, purple, pink, light blue, green, red. */
const LETTERS = ['red', 'gold', 'green', 'blue', 'ochre', 'pink', 'red', 'copper', 'green', 'gold'];

export function buildCondomerie(_w: number, _d: number, b: BuildingTools) {
  const {f, len} = ringFrame(src.facadeRing, FRONT);
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0);
  shopfront(b, f, len);
  upper(b, f);
  cornice(b, f, len);
  setSink(sink0);
}

/**
 * The shopfront 0-5.05 m: grey plinth to 0.8 m, cream pilasters (t 0.2-0.6, 2.38-2.62, 3.88-4.12, 5.3-5.7), the two shop
 * windows (t 0.65-2.3 and 4.15-5.4, 0.85-4.4 m), the glazed door (t 2.7-3.8, to 3.0 m) under its transom light, the fascia
 * 4.6-5.05 m with CONDOMERIE in multicoloured capitals and a capping moulding.
 */
function shopfront(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, 0, len, 4.6, 0.06, 'sandstone');
  for (const [t0, t1] of [[0, 2.58], [3.92, len]]) slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 0.8, 0.08, 'greyBrick', 0.06);
  for (const [t0, t1] of [[0.2, 0.6], [2.38, 2.62], [3.88, 4.12], [5.3, 5.7]]) slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 4.6, 0.12, 'sandstone', 0.06);
  for (const [t0, t1] of [[0.65, 2.3], [4.15, 5.25]]) {
    slab(b, f, (t0 + t1) / 2, 0.85, t1 - t0, 3.55, 0.04, 'frame', 0.06);
    slab(b, f, (t0 + t1) / 2, 0.92, t1 - t0 - 0.12, 3.41, 0.04, 'glass', 0.1);
  }
  timberWindow(b, f, 3.25, 0.05, 1.05, 2.95, {cols: 1, rows: 2, rowWeights: [1, 1.4], sill: null, out: 0.06});
  timberWindow(b, f, 3.25, 3.1, 1.05, 1.3, {cols: 2, rows: 1, sill: null, out: 0.06});
  slab(b, f, len / 2, 4.6, len, 0.45, 0.16, 'sandstone', 0.06);
  slab(b, f, len / 2, 5.05, len + 0.1, 0.12, 0.26, 'sandstone', 0.06);
  signText(b, f, 'CONDOMERIE', len / 2, 4.66, 0.22, {width: 5.0, height: 0.34, d: 0.04, colour: 'red', colours: LETTERS});
}

/** Four storeys of three white sash windows under segmental brick arches; little balconies on the middle axis of the second and third floors, a low railing on its first-floor window, and railings across every window of the top two storeys (2025 crops). */
function upper(b: BuildingTools, f: Frame) {
  const rows: [number, number, boolean][] = [[5.95, 8.4, false], [9.0, 11.4, false], [12.0, 14.0, true], [15.0, 16.8, true]];
  rows.forEach(([y0, y1, rail], k) => {
    for (const t of AXES) {
      timberWindow(b, f, t, y0, WIN, y1 - y0, {cols: 2, rows: 2, rowWeights: [1, 0.9], frame: 'frame', sill: 'stone'});
      // segmental head: a white frame segment (0.15 m rise) over the sash, under the brick relieving arch
      const R = ((WIN * WIN) / 4 + 0.0225) / 0.3, a = Math.asin(WIN / 2 / R);
      poly(b, f, 0, 0, arcPts(t, y1 + 0.15 - R, R, Math.PI / 2 - a, Math.PI / 2 + a, 8), 0.06, 'frame', 0);
      segBand(b, f, t, y1 + 0.17, WIN + 0.3, 0.18, 0.22, 0.04, 'greyBrick');
      const middle = t === AXES[1];
      const balcony = middle && (k === 1 || k === 2);
      if (balcony) railing(b, f, t, y0, WIN + 0.2, 0.95, 0.35);
      else if (rail || (middle && k === 0)) railing(b, f, t, y0 + 0.15, WIN + 0.05, 0.6, 0.08);
    }
  });
}

/** An iron railing (top rail, bottom rail, bars every 12 cm) `w` wide, `h` tall from y, standing `out` off the wall (a balcony when out > 0.2, with its slab). */
function railing(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number) {
  if (out > 0.2) slab(b, f, t, y - 0.08, w, 0.08, out + 0.05, 'stone');
  tube(b, f, [[t - w / 2, y + h], [t + w / 2, y + h]], 0.04, 0.04, 'bronze', out);
  tube(b, f, [[t - w / 2, y + 0.06], [t + w / 2, y + 0.06]], 0.03, 0.03, 'bronze', out);
  const n = Math.round(w / 0.12);
  for (let i = 0; i <= n; i++) tube(b, f, [[t - w / 2 + w * i / n, y], [t - w / 2 + w * i / n, y + h]], 0.025, 0.025, 'bronze', out);
}

/** The white entablature 17.0-19.0 m: a frieze, six consoles under the cornice and the attic band to the roof. */
function cornice(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, 17.0, len, 2.0, 0.08, 'stone');
  slab(b, f, len / 2, 17.0, len, 0.18, 0.16, 'stone', 0.08);
  slab(b, f, len / 2, 17.7, len, 0.6, 0.04, 'greyBrick', 0.08);
  for (let i = 0; i < 6; i++) slab(b, f, 0.35 + i * (len - 0.7) / 5, 17.7, 0.3, 0.6, 0.36, 'stone', 0.08);
  slab(b, f, len / 2, 18.55, len + 0.1, 0.45, 0.12, 'stone', 0.08);
  slab(b, f, len / 2, 18.3, len + 0.1, 0.25, 0.55, 'stone', 0.08);
}
