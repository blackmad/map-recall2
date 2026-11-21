import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, poly, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {onFramePlane, ownFront, signText, timberWindow, tube} from './wallen-more-kit';
import source from './in-t-aepjen-footprints.json';

/**
 * IN 'T AEPJEN, Zeedijk 1 (BAG pand 0363100012177880, BAG 1550; rijksmonument 6500): one of the two timber-fronted houses
 * left in Amsterdam, a sixteenth-century cafe. Its Zeedijk front (facing 234 deg) is a cream timber shopfront of slim
 * pilasters with the cafe's name in gold script on the glass and the round Gulpener sign, then two jettied storeys of tarred
 * black timber with continuous window bands, then a pale grey-green planked upper storey and top under a projecting hood.
 *
 * Read from the rectified Gemeente Amsterdam panorama recording_2025-06-30_05-16-46_01845 (2025-06-30, the whole front,
 * oblique) and the aimed views b_20250114_1026_Track08_Sphere_00126 (2025-01-14, the shopfront and its lettering) and
 * recording_2025-06-30_05-16-46_01844/_01846. The crop is datumed 0.3 m under the pavement, so heights are crop minus 0.3 m.
 * The crop's wall is the 5.8 m BAG front, the 3DBAG facade 7.0 m across three staggered pieces (0.2 m steps): bay positions
 * are laid out over the 3DBAG width in the photo's proportions. The roof above the hood is not visible from the narrow Zeedijk
 * in any 2024-25 panorama: the pointed timber top under its hood is drawn to the 3DBAG ridge height (15.75 m) behind it
 * (inferred; the 2025 crop shows the hood's right rake rising at 14.5-15.5 m), the roof itself stays the 3DBAG LoD2.2 massing. Per item in in-t-aepjen-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const h = (y: number) => +(y - 0.3).toFixed(3);
/** The whole Zeedijk front as one straight frame from the first corner of facade edge 0 to the last of edge 4. */
/** Rise of the pointed timber top over the 14.0 m hood line (to 15.6 m, under the 3DBAG ridge at 15.75 m). */
const PEAK = 1.6;
const RING = [src.facadeRing[0], src.facadeRing[5], src.facadeRing[6], src.facadeRing[7]];

export function buildInTAepjen(_w: number, _d: number, b: BuildingTools) {
  const {f, len} = ringFrame(RING, 0);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: onFramePlane(f, 0.35)});
  const sink0 = getSink();
  setSink(0);
  ownFront(b, f, len, t => h(14.0) + PEAK * (1 - Math.abs(t - len / 2) / (len / 2)), src.surfaces, 'brick', {coping: null, n: 16});
  shopfront(b, f, len);
  jetty1(b, f, len);
  jetty2(b, f, len);
  top(b, f, len);
  setSink(sink0);
}

/** Cream shopfront 0-4.7 m: dark green plinth, five slim pilasters, four glazed bays with transom lights, the beam over it, the name and the Gulpener disc. */
function shopfront(b: BuildingTools, f: Frame, len: number) {
  const P = [0.15, 0.3, 0.5, 0.7, 0.88].map(p => p * len);
  slab(b, f, len / 2, 0, len, h(1.0), 0.1, 'green');
  for (let i = 0; i < P.length - 1; i++) {
    const t0 = P[i] + 0.14, t1 = P[i + 1] - 0.14, w = t1 - t0, c = (t0 + t1) / 2;
    timberWindow(b, f, c, h(1.05), w, 2.75, {cols: 1, rows: 1, frame: 'sandstone', sill: null, out: 0.04, fw: 0.06});
    timberWindow(b, f, c, h(3.95), w, 0.85, {cols: 2, rows: 1, frame: 'sandstone', sill: null, out: 0.04, fw: 0.06});
  }
  for (const t of [0.05 * len, ...P]) slab(b, f, t, 0, 0.34, h(4.85), 0.22, 'sandstone');
  slab(b, f, len / 2, h(1.0), len, 0.1, 0.16, 'sandstone');
  slab(b, f, len / 2, h(4.85), len + 0.1, 0.45, 0.32, 'brick', -0.1);
  signText(b, f, "In 't Aepjen", (P[0] + P[1]) / 2 + 0.6, h(1.6), 0.12, {width: 1.6, height: 0.42, d: 0.02, colour: 'gold'});
  // the Gulpener disc on its bracket, perpendicular to the front
  const t = P[3] + 0.4, y = h(4.1);
  const side: Frame = {origin: [f.origin[0] + f.tangent[0] * t + f.n[0] * 0.45, f.origin[1] + f.tangent[1] * t + f.n[1] * 0.45], tangent: [f.n[0], f.n[1]], n: [f.tangent[0], f.tangent[1]]};
  disc(b, side, 0, y, 0.38, 0.12, 'bronze', -0.06);
  disc(b, side, 0, y, 0.32, 0.04, 'stone', 0.06);
  disc(b, side, 0, y, 0.32, 0.04, 'stone', -0.1);
  disc(b, side, 0, y + 0.08, 0.1, 0.04, 'red', 0.1);
  slab(b, f, t, y + 0.42, 0.06, 0.06, 0.8, 'bronze');
}

/** First jettied storey 5.3-9.0 m: tarred boards projecting 0.15 m, a sill shelf, the window band (5 windows, 6.2-8.25 m) and the jetty beam. */
function jetty1(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, h(5.3), len, h(9.0) - h(5.3), 0.25, 'brick', -0.1);
  slab(b, f, len / 2, h(6.05), len + 0.06, 0.12, 0.4, 'brick', -0.1);
  const n = 5, w = (len - 0.6) / n;
  for (let i = 0; i < n; i++) timberWindow(b, f, 0.3 + w * (i + 0.5), h(6.25), w - 0.18, 2.0, {cols: 2, rows: 3, frame: 'frame', sill: null, out: 0.15, fw: 0.07});
  for (let i = 0; i <= n; i++) slab(b, f, 0.3 + w * i, h(5.3), 0.1, h(8.75) - h(5.3), 0.2, 'greyBrick');
  slab(b, f, len / 2, h(8.75), len + 0.1, 0.25, 0.4, 'brick', -0.1);
}

/** Second storey 9.0-12.7 m: pale grey-green planks projecting 0.3 m with plank seams, solid on the left, a window band on the right (10.6-12.2 m). */
function jetty2(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, h(9.0), len, h(12.7) - h(9.0), 0.3, 'copper');
  for (let y = h(9.25); y < h(10.5); y += 0.3) slab(b, f, len / 2, y, len, 0.03, 0.04, 'greyBrick', 0.3);
  for (let y = h(9.25); y < h(12.6); y += 0.3) slab(b, f, 0.17 * len, y, 0.34 * len, 0.03, 0.04, 'greyBrick', 0.3);
  const t0 = 0.36 * len, n = 4, w = (len - 0.2 - t0) / n;
  for (let i = 0; i < n; i++) timberWindow(b, f, t0 + w * (i + 0.5), h(10.6), w - 0.14, 1.6, {cols: 3, rows: 2, rowWeights: [1.6, 1], frame: 'frame', sill: null, out: 0.3, fw: 0.06});
  slab(b, f, len / 2, h(12.6), len + 0.1, 0.18, 0.46, 'copper');
}

/** The top 12.7-14.0 m planked, projecting 0.42 m; the pointed planked top over it to 15.6 m, and the hood (0.75 m out) along the 14.0 m line and both rakes. */
function top(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, h(12.7), len, h(14.0) - h(12.7), 0.42, 'copper');
  for (let y = h(12.95); y < h(14.0); y += 0.3) slab(b, f, len / 2, y, len, 0.03, 0.04, 'greyBrick', 0.42);
  poly(b, f, 0, h(14.0), [[0, 0], [len, 0], [len / 2, PEAK]], 0.42, 'copper');
  timberWindow(b, f, len / 2, h(14.15), 1.4, 0.55, {cols: 4, rows: 1, frame: 'frame', sill: null, out: 0.42, fw: 0.05});
  slab(b, f, len / 2, h(14.0), len + 0.2, 0.16, 0.75, 'green');
  tube(b, f, [[-0.1, h(14.0) + 0.08], [len / 2, h(14.0) + PEAK + 0.15], [len + 0.1, h(14.0) + 0.08]], 0.22, 0.6, 'green', 0.15);
}
