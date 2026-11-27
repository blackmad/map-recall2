import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, poly, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {onFramePlane, ownFront, sectionAlong, signText, timberWindow, tube} from './wallen-more-kit';
import {clapboards, jettySections, type JettyStorey} from '../../src/canalRecall/landmarks/jettyProfile';
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
 *
 * Rework 2026-11-27 (lane landmarks-r19-e) after two lost blind rounds: the storeys were 0.15-0.42 m slabs, so the front read
 * flat, and every shell wall carried the tar-black 'brick' so the gallery card was a black box. Now the storeys are jetties
 * from src/canalRecall/landmarks/jettyProfile.ts: the tarred storey 0.4 m out on a 0.9 m sloped apron, the blue-grey storey
 * 0.85 m out on a 1.3 m bulging apron (the crop's 9.0-10.5 m boards), the top 1.05 m out, the hood 1.5 m: overhangs estimated
 * from the side-on view b_20250114_1026_Track08_Sphere_00164, where the upper storeys stand well clear of the brick neighbour.
 * The blue-grey storeys are lap boards (clapboards wedges), the tarred storey has four casements in two pairs round a heavy
 * post, the blue storey three casements with transoms on its right two thirds, and the shell walls are brick ('brick'),
 * the tarred timber 'dark'.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const h = (y: number) => +(y - 0.3).toFixed(3);
/** Rise of the pointed timber top over the 14.0 m hood line (to 15.6 m, under the 3DBAG ridge at 15.75 m). */
const PEAK = 1.6;
const RING = [src.facadeRing[0], src.facadeRing[5], src.facadeRing[6], src.facadeRing[7]];
/** The jettied storeys over the shopfront (crop heights through h()): tarred, blue-grey on its bulging apron, the planked top. */
const STOREYS: JettyStorey[] = [
  {y0: 0, y1: h(5.0), out: 0},
  {y0: h(5.0), y1: h(9.0), out: 0.4, apron: 0.9},
  {y0: h(9.0), y1: h(12.4), out: 0.85, apron: 1.3},
  {y0: h(12.4), y1: h(14.0), out: 1.05},
];
const [, TAR, BLUE, TOP] = STOREYS;
const TAR_COL = 'dark', BOARD = 'copper', BOARD_DARK = 'green';

export function buildInTAepjen(_w: number, _d: number, b: BuildingTools) {
  const {f, len} = ringFrame(RING, 0);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: onFramePlane(f, 0.35)});
  const sink0 = getSink();
  setSink(0);
  ownFront(b, f, len, t => h(14.0) + PEAK * (1 - Math.abs(t - len / 2) / (len / 2)), src.surfaces, 'brick', {coping: null, n: 16});
  const secs = jettySections(STOREYS);
  // the storeys stop 4 cm short of the party walls: their ends behind the wall plane would otherwise lie on the shell's side walls
  [TAR_COL, TAR_COL, BOARD, BOARD].forEach((c, i) => { if (i > 0) sectionAlong(b, f, 0.04, len - 0.04, secs[i], c); });
  shopfront(b, f, len);
  jetty1(b, f, len);
  jetty2(b, f, len);
  top(b, f, len);
  setSink(sink0);
}

/** Lap boards across [t0, t1] on a face at `out` between y0 and y1 ('green' is the darker weathered board tone). */
function boards(b: BuildingTools, f: Frame, t0: number, t1: number, out: number, y0: number, y1: number) {
  // weathered boarding: every third board a shade darker (the photo's boards vary in tone)
  clapboards(out, y0, y1, {board: 0.24, lap: 0.05}).forEach((w, i) => sectionAlong(b, f, t0, t1, w, (i * 7) % 3 === 1 ? BOARD_DARK : BOARD));
}

/** Cream shopfront 0-4.7 m: dark plinth, five slim pilasters, four glazed bays with transom lights, the beam over it, the name and the Gulpener disc. */
function shopfront(b: BuildingTools, f: Frame, len: number) {
  const P = [0.15, 0.3, 0.5, 0.7, 0.88].map(p => p * len);
  slab(b, f, len / 2, 0, len, h(1.0), 0.1, TAR_COL);
  for (let i = 0; i < P.length - 1; i++) {
    const t0 = P[i] + 0.14, t1 = P[i + 1] - 0.14, w = t1 - t0, c = (t0 + t1) / 2;
    timberWindow(b, f, c, h(1.05), w, 2.75, {cols: 1, rows: 1, frame: 'sandstone', sill: null, out: 0.04, fw: 0.06});
    // dark half-height cafe panels behind the glass (the photo's lower lights read dark)
    timberWindow(b, f, c, h(3.95), w, 0.85, {cols: 2, rows: 1, frame: 'sandstone', sill: null, out: 0.04, fw: 0.06});
  }
  for (const t of [0.05 * len, ...P]) slab(b, f, t, 0, 0.34, h(4.85), 0.22, 'sandstone');
  slab(b, f, len / 2, h(1.0), len, 0.1, 0.16, 'sandstone');
  slab(b, f, len / 2, h(4.75), len + 0.1, h(5.0) - h(4.75) + 0.05, 0.32, TAR_COL, -0.1);
  // tarred backing over the wall plane under the apron (the brick front showed through as a brown patch)
  slab(b, f, len / 2, h(4.75), len - 0.1, h(6.3) - h(4.75), 0.04, TAR_COL, 0);
  signText(b, f, "In 't Aepjen", (P[0] + P[1]) / 2 + 0.6, h(1.7), 0.12, {width: 1.9, height: 0.5, d: 0.02, colour: 'gold'});
  // the Gulpener disc on its bracket, perpendicular to the front, both faces lettered
  const t = P[3] + 0.4, y = h(4.1), r = 0.46;
  const P0: [number, number] = [f.origin[0] + f.tangent[0] * t + f.n[0] * 0.6, f.origin[1] + f.tangent[1] * t + f.n[1] * 0.6];
  disc(b, {origin: P0, tangent: [f.n[0], f.n[1]], n: [f.tangent[0], f.tangent[1]]}, 0, y, r, 0.1, 'bronze', -0.05);
  for (const s of [1, -1]) {
    const n: [number, number] = [f.tangent[0] * s, f.tangent[1] * s];
    const side: Frame = {origin: P0, tangent: [n[1], -n[0]], n};
    disc(b, side, 0, y, r - 0.04, 0.03, 'stone', 0.05);
    disc(b, side, 0, y + 0.2, 0.1, 0.03, 'red', 0.08);
    signText(b, side, 'GULPENER', 0, y - 0.08, 0.08, {width: 0.7, height: 0.14, d: 0.02, colour: 'bronze'});
  }
  slab(b, f, t, y + r + 0.02, 0.06, 0.06, 1.1, 'bronze');
}

/** Tarred storey: sill shelf on the apron, four casements in two pairs round a heavy central post, the jetty beam. */
function jetty1(b: BuildingTools, f: Frame, len: number) {
  const o = TAR.out, y0 = h(6.2), wh = h(8.3) - y0;
  slab(b, f, len / 2, y0 - 0.12, len + 0.06, 0.12, 0.2, TAR_COL, o - 0.05);
  const ww = (len - 1.1) / 4, xs = [0.25 + ww / 2, 0.25 + ww * 1.5, len - 0.25 - ww * 1.5, len - 0.25 - ww / 2];
  for (const x of xs) timberWindow(b, f, x, y0, ww - 0.04, wh, {cols: 3, rows: 4, frame: 'frame', sill: null, out: o, fw: 0.07, bar: 0.035});
  for (const x of [0.12, len / 2, len - 0.12]) slab(b, f, x, y0 - 0.12, x === len / 2 ? 0.45 : 0.24, h(8.75) - y0 + 0.12, 0.16, TAR_COL, o);
  slab(b, f, len / 2, h(8.55), len + 0.1, h(9.0) - h(8.55), 0.3, TAR_COL, o - 0.1);
}

/** Blue-grey storey: lap boards over the apron face, solid on the left third, three casements with transoms on the right (10.5-12.1 m). */
function jetty2(b: BuildingTools, f: Frame, len: number) {
  const o = BLUE.out, wy0 = h(10.5), wy1 = h(12.1), t0 = 0.36 * len;
  boards(b, f, 0, len, o, BLUE.y0 + (BLUE.apron ?? 0), wy0 - 0.1);
  boards(b, f, 0, t0 - 0.1, o, wy0 - 0.1, BLUE.y1 - 0.15);
  slab(b, f, len / 2, wy0 - 0.12, len + 0.04, 0.1, 0.12, 'greyBrick', o);
  const n = 3, w = (len - 0.15 - t0) / n;
  for (let i = 0; i < n; i++) timberWindow(b, f, t0 + w * (i + 0.5), wy0, w - 0.06, wy1 - wy0, {cols: 3, rows: 2, rowWeights: [1.6, 1], frame: 'frame', sill: null, out: o, fw: 0.06, bar: 0.035});
  for (const i of [0, n]) slab(b, f, t0 + w * i, wy0 - 0.02, 0.1, wy1 - wy0 + 0.04, 0.1, 'greyBrick', o);
  slab(b, f, len / 2, BLUE.y1 - 0.15, len + 0.08, 0.18, 0.2, 'greyBrick', o - 0.05);
}

/** The planked top storey, the pointed planked top over it to 15.6 m, and the hood (1.5 m out) along the 14.0 m line and both rakes. */
function top(b: BuildingTools, f: Frame, len: number) {
  const o = TOP.out;
  boards(b, f, 0, len, o, TOP.y0 + 0.05, TOP.y1 - 0.05);
  poly(b, f, 0, h(14.0), [[0, 0], [len, 0], [len / 2, PEAK]], o + 0.1, BOARD, -0.1);
  for (const y of [0.35, 0.7, 1.05]) {
    const half = (len / 2) * (1 - y / PEAK);
    slab(b, f, len / 2, h(14.0) + y - 0.03, 2 * half - 0.1, 0.04, 0.05, 'greyBrick', o);
  }
  slab(b, f, len / 2, h(14.0) - 0.05, len + 0.3, 0.2, 1.6, TAR_COL, -0.1);
  tube(b, f, [[-0.15, h(14.0) + 0.08], [len / 2, h(14.0) + PEAK + 0.18], [len + 0.15, h(14.0) + 0.08]], 0.24, 1.6, TAR_COL, -0.1);
}
