import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, letters, poly, ringFrame, segBand, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './de-jaren-footprints.json';

/**
 * GRAND CAFE DE JAREN, Nieuwe Doelenstraat 20-22 (BAG pand 0363100012180413): the former bank building on the Amstel whose
 * ground floor is the cafe De Jaren (nl.wikipedia De Jaren, CC BY-SA 4.0). Massing: the 3DBAG LoD2.2 shell (flat roof at
 * 14.9 m, de-jaren-footprints.json). The street front (ring edge 1, 17.3 m) is read from the rectified Gemeente Amsterdam
 * panorama TMX7316010203-002356_pano_0005_000346 (2021, CC BY 4.0, 50 px/m, heights scaled to the 3DBAG roof):
 *  - the entrance bay (t 0.5-4.7): a stone round-arched doorway over steps, three-light windows, the arched gold mosaic
 *    panel lettered O&B and a pointed gable over the roofline;
 *  - four window columns on two floors with segmental heads and stone keystones, two triple-arched ground-floor window groups
 *    between stone piers, a stone plinth, the slit-baluster parapet and the cafe's blade sign.
 */
export function buildDeJaren(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  const ring = src.facadeRing;
  addShell(b, src as never, {wall: 'brick', roof: 'dark'});
  const sink0 = getSink();
  setSink(0.05);
  const {f, len} = ringFrame(ring, 1);
  // layers 4 cm apart: dressings 0.05, frames 0.09, glass 0.13, bars 0.17
  const win = (fr: Frame, t: number, y0: number, y1: number, w: number, lights: number) => {
    slab(b, fr, t, y0 - 0.04, w + 0.1, y1 - y0 + 0.08, 0.09, 'white');
    slab(b, fr, t, y0, w - 0.06, y1 - y0, 0.13, 'glass');
    for (let k = 1; k < lights; k++) slab(b, fr, t - w / 2 + (w * k) / lights, y0, 0.07, y1 - y0, 0.17, 'white');
    slab(b, fr, t, y0 + (y1 - y0) * 0.62, w - 0.06, 0.07, 0.17, 'white');
    slab(b, fr, t, y0 - 0.17, w + 0.25, 0.13, 0.12, 'stone');
  };
  // plinth and courses
  // plinth, broken by the doorway (the door reveal sits within 1 cm of it otherwise)
  slab(b, f, 0.5, 0, 0.9, 1.5, 0.1, 'stone');
  slab(b, f, (4.25 + len - 0.05) / 2, 0, len - 0.05 - 4.25, 1.5, 0.1, 'stone');
  slab(b, f, 11.0, 5.55, 12.4, 0.2, 0.08, 'stone');
  slab(b, f, len / 2, 12.95, len - 0.1, 0.25, 0.1, 'stone');
  slab(b, f, len / 2, 14.75, len - 0.1, 0.2, 0.12, 'stone');

  // ---------- entrance bay ----------
  for (const t of [0.6, 4.6]) slab(b, f, t, 0, 0.45, 14.6, 0.18, 'stone');
  archBand(b, f, 2.6, 0.75, 3.3, 4.5, 0.35, 0.05, 'stone');
  archSlab(b, f, 2.6, 0.75, 2.4, 4.15, 0.09, 'dark');
  slab(b, f, 2.6, 0.75, 1.5, 3.3, 0.13, 'glass');
  slab(b, f, 2.6, 0.75, 0.07, 3.3, 0.17, 'dark');
  for (let k = 0; k < 3; k++) slab(b, f, 2.6, 0.25 * k, 3.0 - 0.3 * k, 0.25, 0.9 - 0.3 * k, 'stone');
  win(f, 2.6, 6.3, 8.5, 2.7, 3);
  segBand(b, f, 2.6, 8.55, 3.0, 0.3, 0.3, 0.05, 'stone');
  win(f, 2.6, 9.8, 11.85, 2.7, 3);
  // O&B mosaic arch and the pointed gable over the roofline
  archBand(b, f, 2.6, 13.25, 3.1, 1.9, 0.18, 0.05, 'stone');
  archSlab(b, f, 2.6, 13.3, 2.75, 1.8, 0.07, 'gold');
  letters(b, f, 'O&B', 2.6, 13.75, 0.07, 0.1, 0.04, 'blue', 0.09);
  poly(b, f, 2.6, 14.85, [[-2.2, 0], [2.2, 0], [2.2, 0.25], [0, 1.6], [-2.2, 0.25]], 0.35, 'brick', -0.2);
  poly(b, f, 2.6, 15.05, [[-2.0, 0], [-1.75, 0], [0, 1.15], [1.75, 0], [2.0, 0], [0, 1.4]], 0.08, 'stone', 0.15);

  // ---------- window columns, segmental heads with keystones ----------
  for (const t of [6.2, 9.1, 12.1, 15.1]) {
    win(f, t, 6.3, 8.5, 1.5, 2);
    segBand(b, f, t, 8.55, 1.9, 0.25, 0.28, 0.05, 'greyBrick');
    win(f, t, 9.8, 11.9, 1.5, 2);
    segBand(b, f, t, 11.95, 1.9, 0.25, 0.28, 0.05, 'greyBrick');
    for (const y of [8.5, 11.9]) for (const s of [-1, 1]) slab(b, f, t + s * 1.0, y, 0.3, 0.3, 0.1, 'stone');
    // parapet: four slit balusters over each column
    for (let k = 0; k < 4; k++) slab(b, f, t - 0.6 + 0.4 * k, 13.35, 0.14, 1.15, 0.06, 'greyBrick');
  }
  // ---------- ground floor: two triple-arched window groups between stone piers ----------
  for (const [a, c] of [[5.4, 10.0], [12.2, 16.1]] as [number, number][]) {
    const w = (c - a) / 3;
    for (let k = 0; k <= 3; k++) slab(b, f, a + w * k, 1.45, 0.3, 4.0, 0.14, 'stone');
    for (let k = 0; k < 3; k++) {
      const t = a + w * (k + 0.5);
      segBand(b, f, t, 5.15, w, 0.25, 0.22, 0.05, 'greyBrick');
      win(f, t, 1.65, 5.1, w - 0.32, 1);
    }
  }
  // cafe blade sign (perpendicular to the front) on its bracket
  slab(b, f, 11.7, 3.6, 0.1, 5.5, 0.62, 'bronze', 0.12);
  slab(b, f, 11.7, 9.0, 0.06, 0.06, 0.75, 'bronze');
  slab(b, f, 11.7, 3.75, 0.12, 0.06, 0.75, 'bronze');
  // ---------- Amstel side: the cafe's glass conservatory (ring edge 5) with its roof-terrace balustrade ----------
  {
    const {f: g, len: L} = ringFrame(ring, 5);
    // the conservatory's 3DBAG wall spans t 0.4-13.8 (the strip before it is the 13.7 m block)
    const a = 1.0, c = L - 0.5, m = (a + c) / 2;
    slab(b, g, m, 0, c - a, 0.45, 0.1, 'stone');
    slab(b, g, m, 0.45, c - a, 5.3, 0.09, 'white');
    slab(b, g, m, 0.5, c - a - 0.1, 5.2, 0.13, 'glass');
    const n = Math.round((c - a) / 1.05);
    for (let k = 0; k <= n; k++) slab(b, g, a + 0.05 + ((c - a - 0.1) * k) / n, 0.5, 0.08, 5.2, 0.17, 'white');
    slab(b, g, m, 3.9, c - a - 0.1, 0.08, 0.17, 'white');
    slab(b, g, L / 2, 5.8, L - 0.1, 0.25, 0.25, 'concrete');
    // balustrade along the roof terrace edge
    slab(b, g, L / 2, 7.35, L - 0.1, 0.1, 0.18, 'concrete', -0.2);
    for (let u = 0.2; u < L - 0.1; u += 0.3) slab(b, g, u, 6.45, 0.1, 0.9, 0.1, 'concrete', -0.15);
  }
  // ---------- Amstel side: the banded brick bay (ring edge 3) ----------
  {
    const {f: g, len: L} = ringFrame(ring, 3);
    for (let y = 0.6; y < 6.4; y += 0.7) slab(b, g, L / 2, y, L - 0.1, 0.22, 0.05, 'concrete');
    for (const [y0, y1] of [[7.0, 9.2], [10.2, 12.2]] as [number, number][]) win(g, L / 2, y0, y1, 2.6, 3);
  }
  setSink(sink0);
}
