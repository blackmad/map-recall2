import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, leanSlab, facePanel, ledgeStrip, put, poly, disc, ringSlab, ringFrame, roofHeightAt, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {raisedLettering, clockHands} from './ornament-kit';
import {buildFigure, POSES, type Pose} from './figure-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {layoutRelief, type ReliefSlot} from '../../src/canalRecall/landmarks/pedimentRelief';
import source from './effectenbeurs-footprints.json';

/**
 * Effectenbeurs, Beursplein 5 (BAG pand 0363100012165051, bouwjaar 1913; Rijksmonument 518417: built 1911-1913 to the
 * design of Jos Th.J. Cuypers in an 'Um 1800' style for the Vereeniging voor den Effectenhandel, tympanum group by
 * C.A. Smout 1924, Beursstraat extension by Gebr. van Gendt 1928-1930; today Euronext Amsterdam).
 * Native east/south metres from the BAG vertex average, y above the 3DBAG ground (1.14 m NAP).
 *
 * Massing: one closed prism per 3DBAG LoD2.2 roof plane (CC BY 4.0, effectenbeurs-footprints.json via bag-shell-prepare.ts),
 * except the planes of the central tower and the four roof turrets, which are authored. The Beursplein front is the
 * facade-ring edges 41-57 (bearing 309-314), s measured from the north corner (11.7, -56.1) towards the west corner:
 *   s  0-12.0   Beursstraat extension (1928-30): pale ashlar, four axes, balcony rail on the top storey   (edge 41, w05-312)
 *   s 12.0-25.4 north-east pavilion: narrow axes either side of a five-light group                     (edge 43, w01-309)
 *   s 25.4-38.4 left wing, three axes                                                                  (edge 45, w02-314)
 *   s 38.5-53.6 frontispiece: banded pilasters (edges 47, 51), central bay (edge 49): three portals,
 *               BEURSPLEIN 5, balcony on elephant-head consoles, nine attic lights, pediment with relief (w06-314)
 *   s 53.6-66.1 right wing, three axes                                                                 (edge 53, w04-314)
 *   s 66.1-70.8 clock bay: portal, clock, two three-light windows, attic loggia                        (edge 55, w12-314)
 *   s 70.8-83.4 south-west pavilion, three axes, Mercury in a niche on the corner pilaster             (edge 57, w03-314)
 * Proportions read from the frontal Commons photograph by Chabe01 (2024, CC BY-SA 4.0; 24-29 px/m across the front) and
 * the Gemeente Amsterdam panoramas (CC BY 4.0); heights: granite storey 0-4.4 m, first-floor windows 5.0-8.9,
 * second-floor 10.5-14.3, stone attic 15.0-20.0 with windows 16.1-19.1, cornice 20.0-21.0, pediment apex 25.9 (3DBAG).
 * Every item is listed with its photo in effectenbeurs-inventory.json.
 */
type C = Parameters<BuildingTools['add']>[1];
type Surface = {type: string; rings: number[][][]};
const src = source as unknown as {surfaces: Surface[]; facadeRing: number[][]};
const RING = src.facadeRing;

// 3DBAG planes replaced by authored parts: the central tower and the four roof turrets.
const TOWER_PLANES = new Set([786, 781, 726, 763, 731, 725]);
const TURRET_PLANES = new Set([722, 718, 773, 788, 816, 712, 710, 709, 790]);
// The glazed trading-hall roof (the pale long gable on the PDOK orthophoto).
const HALL_PLANES = new Set([797, 784]);

const SK = 0.3;          // facade skin face, out of the BAG wall line
const GLASS = 0.15;      // opening depth behind the skin face (glass 0.15 m out from the wall line, clear of the 3DBAG prism walls)
const PIL = 0.22;        // pilasters stand this far proud of the skin face
const G_TOP = 4.4, ATTIC = 15.0, CORNICE = 20.0;

let b: BuildingTools;

/** Triangles per colour, handed to BuildingTools once per colour. */
const acc = new Map<C, number[]>();
function quad(f: Frame, q: WallQuad, c: C, out = 0) {
  const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * t + f.n[0] * (o + out), y, f.origin[1] + f.tangent[1] * t + f.n[1] * (o + out)]);
  const a = acc.get(c) ?? [];
  a.push(...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
  acc.set(c, a);
}
function flush() {
  for (const [c, pos] of acc) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    b.add(g, c);
  }
  acc.clear();
}

type Bars = 'cross' | 'attic' | 'door' | 'barred' | 'transom' | 'none';
type Win = {t: number; w: number; y0: number; y1: number; back?: C; bars?: Bars; surround?: boolean; sill?: boolean};
type Band = {y0: number; y1: number; c: C};
const edge = (i: number) => ringFrame(RING, i);

/** Skin bands with the openings cut through them, then the window furniture. */
/** `covered`: [start, end] ends whose return is hidden inside a pilaster (its side face would z-fight the return). */
function skin(i: number, bands: Band[], wins: Win[], ta = 0, tb?: number, covered: [boolean, boolean] = [false, false]) {
  const {f, len} = edge(i), z = tb ?? len;
  const g: Frame = {...f, origin: [f.origin[0] + f.tangent[0] * ta, f.origin[1] + f.tangent[1] * ta]};
  const L = z - ta;
  for (const band of bands) {
    const cuts: (HoledOpening & {back: C})[] = wins
      .filter(w => w.y1 > band.y0 + 1e-6 && w.y0 < band.y1 - 1e-6)
      .map(w => ({t0: w.t - ta - w.w / 2, t1: w.t - ta + w.w / 2, y0: w.y0, y1: w.y1, depth: GLASS, back: w.back ?? 'glass'}));
    const hw = holedWall(L, band.y0, band.y1, cuts);
    for (const q of hw.face) quad(g, q, band.c, SK);
    hw.reveals.forEach(qs => qs.forEach(q => quad(g, q, band.c, SK)));
    hw.backs.forEach((q, k) => quad(g, q, cuts[k].back, SK));
  }
  // returns at both ends: close the gap between the BAG wall line and the skin face
  const y0 = bands[0].y0, y1 = bands[bands.length - 1].y1;
  if (!covered[0]) quad(g, {pts: [[0, y0, 0], [0, y0, SK], [0, y1, SK], [0, y1, 0]], normal: [-1, 0, 0]}, bands[0].c);
  if (!covered[1]) quad(g, {pts: [[L, y0, SK], [L, y0, 0], [L, y1, 0], [L, y1, SK]], normal: [1, 0, 0]}, bands[0].c);
  for (const w of wins) furniture(f, w);
  return f;
}

/** Glazing bars inside the reveal, iron bars, stone surround and sill on the skin face. */
function furniture(f: Frame, w: Win) {
  const h = w.y1 - w.y0, g0 = SK - GLASS, bo = g0 + 0.06, bd = 0.06; // bars 6 cm in front of the glass
  // glazing bars are front-facing quads (their sides are never seen inside the reveal): 2 triangles each
  const bar = (t: number, y: number, bw: number, bh: number, c: C = 'frame', o = bo, d = bd) => facePanel(b, f, t, y, bw, bh, c, o + d);
  switch (w.bars ?? 'cross') {
    case 'cross':
      bar(w.t, w.y0, 0.09, h);
      bar(w.t, w.y0 + h * 0.7, w.w, 0.1);
      bar(w.t, w.y0 + h * 0.35, w.w, 0.05);
      for (const s of [-0.25, 0.25]) bar(w.t + s * w.w, w.y0 + h * 0.7, 0.05, h * 0.3);
      break;
    case 'attic':
      bar(w.t, w.y0 + h * 0.68, w.w, 0.08);
      bar(w.t, w.y0, 0.05, h * 0.68);
      break;
    case 'transom':
      bar(w.t, w.y0 + h * 0.72, w.w, 0.1);
      for (const s of [-1 / 6, 1 / 6]) bar(w.t + s * w.w, w.y0, 0.06, h);
      break;
    case 'door':
      bar(w.t, w.y0 + Math.min(2.6, h * 0.62), w.w, 0.12);
      bar(w.t, w.y0, 0.1, Math.min(2.6, h * 0.62));
      break;
    case 'barred': {
      bar(w.t, w.y0 + h * 0.5, w.w, 0.06);
      const n = Math.max(2, Math.round(w.w / 0.16));
      for (let k = 1; k < n; k++) bar(w.t - w.w / 2 + (w.w * k) / n, w.y0, 0.035, h, 'white', g0 + 0.15, 0.04);
      break;
    }
    case 'none': break;
  }
  if (w.surround) {
    const s = 0.2, d = 0.08;
    leanSlab(b, f, w.t - w.w / 2 - s / 2, w.y0, s, h + s, d, 'stone', SK);
    leanSlab(b, f, w.t + w.w / 2 + s / 2, w.y0, s, h + s, d, 'stone', SK);
    leanSlab(b, f, w.t, w.y1, w.w, s, d, 'stone', SK);
  }
  if (w.sill ?? w.surround) slab(b, f, w.t, w.y0 - 0.14, w.w + 0.5, 0.14, 0.16, 'stone', SK);
}

/** Two-tone banded stone pilaster (pale and grey courses), granite below the first floor. */
function pilaster(f: Frame, t0: number, t1: number, y1 = CORNICE, out = SK + PIL, base: C = 'concrete') {
  const w = t1 - t0, t = (t0 + t1) / 2;
  slab(b, f, t, 0, w, G_TOP, out, base);
  const n = Math.round((y1 - G_TOP) / 0.5);
  for (let k = 0; k < n; k++) {
    const y = G_TOP + ((y1 - G_TOP) * k) / n, h = (y1 - G_TOP) / n;
    leanSlab(b, f, t, y, w, h, out + (k % 2 ? 0 : 0.03), k % 2 ? 'greyBrick' : 'stone');
  }
}

/** Free t-intervals of [a, z] at height y between openings (for courses and rustication). */
function free(a: number, z: number, y0: number, y1: number, wins: Win[], pad = 0.0): [number, number][] {
  const cuts = wins.filter(w => w.y1 > y0 && w.y0 < y1).map(w => [w.t - w.w / 2 - pad, w.t + w.w / 2 + pad]).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let s = a;
  for (const [c0, c1] of cuts) { if (c0 > s + 0.05) out.push([s, Math.min(c0, z)]); s = Math.max(s, c1); }
  if (z > s + 0.05) out.push([s, z]);
  return out;
}
/** A projecting course along the skin, broken at openings. */
function course(f: Frame, a: number, z: number, y: number, h: number, d: number, c: C, wins: Win[], strip = false) {
  for (const [s0, s1] of free(a, z, y, y + h, wins, 0.22)) (strip ? ledgeStrip : slab)(b, f, (s0 + s1) / 2, y, s1 - s0, h, d, c, SK);
}
/** Rusticated granite: projecting courses every 0.55 m. */
function rustication(f: Frame, a: number, z: number, wins: Win[], y1 = G_TOP) {
  for (let y = 0.5; y < y1 - 0.2; y += 0.55) course(f, a, z, y, 0.07, 0.06, 'concrete', wins, true);
}
/** Main cornice: architrave band, deep corona, blocking course (covers the 3DBAG eave). */
function cornice(f: Frame, a: number, z: number, y = CORNICE, extra = 0) {
  slab(b, f, (a + z) / 2, y, z - a, 0.35, SK + 0.25 + extra, 'stone');
  slab(b, f, (a + z) / 2, y + 0.35, z - a + 0.3, 0.3, SK + 0.75 + extra, 'stone');
  slab(b, f, (a + z) / 2, y + 0.65, z - a + 0.2, 0.35, SK + 0.55 + extra, 'stone');
}

// ---------------------------------------------------------------------------------------------------------------------
const S1: [number, number] = [5.0, 8.9], S2: [number, number] = [10.5, 14.3], AT: [number, number] = [16.1, 19.1];
const STD_BANDS: Band[] = [{y0: 0, y1: G_TOP, c: 'concrete'}, {y0: G_TOP, y1: ATTIC, c: 'brick'}, {y0: ATTIC, y1: CORNICE, c: 'stone'}];
const cross = (t: number, w: number, [y0, y1]: [number, number]): Win => ({t, w, y0, y1, bars: 'cross', surround: true});
const lights = (t: number, n: number, lw: number, pier: number, [y0, y1]: [number, number], bars: Bars = 'attic'): Win[] =>
  Array.from({length: n}, (_, k) => ({t: t + (k - (n - 1) / 2) * (lw + pier), w: lw, y0, y1, bars}));

/** Common storey dressing of a brick run: courses at the granite top and the attic, rustication, cornice. */
function dress(f: Frame, a: number, z: number, wins: Win[]) {
  rustication(f, a, z, wins);
  course(f, a, z, G_TOP - 0.05, 0.32, 0.14, 'stone', wins);
  course(f, a, z, ATTIC - 0.1, 0.25, 0.12, 'stone', wins);
  course(f, a, z, AT[0] - 0.25, 0.15, 0.1, 'stone', wins);
  cornice(f, a, z);
}

/** Red-and-cream patterned brick panels between the attic groups. */
function atticPanels(f: Frame, ts: number[]) {
  for (const t of ts) {
    slab(b, f, t, 16.2, 0.42, 2.6, 0.05, 'red', SK);
    for (const y of [16.8, 17.5, 18.2]) poly(b, f, t, y, [[0, 0], [0.12, 0.18], [0, 0.36], [-0.12, 0.18]], 0.04, 'stone', SK + 0.05);
  }
}

/** Beursstraat extension (1928-30), edge 41: pale ashlar, four axes, rail on the top storey. */
function annex() {
  const i = 41, {len} = edge(i), axes = [1.8, 4.6, 7.4, 10.2];
  const wins: Win[] = [];
  for (const t of axes) {
    wins.push({t, w: 1.3, y0: 0.9, y1: 3.3, bars: 'barred'});
    wins.push({t, w: 1.3, y0: 5.2, y1: 8.6, bars: 'cross'});
    wins.push({t, w: 1.3, y0: 9.8, y1: 13.2, bars: 'cross'});
    wins.push({t, w: 1.1, y0: 14.9, y1: 17.8, bars: 'transom'});
  }
  const f = skin(i, [{y0: 0, y1: G_TOP, c: 'concrete'}, {y0: G_TOP, y1: 19.2, c: 'stone'}], wins);
  // stepped granite surrounds round the ground windows, flat stone pilasters between the axes, panels under the second floor
  for (const t of axes) {
    slab(b, f, t - 0.8, 0.6, 0.3, 3.2, 0.08, 'concrete', SK);
    slab(b, f, t + 0.8, 0.6, 0.3, 3.2, 0.08, 'concrete', SK);
    slab(b, f, t, 3.3, 1.9, 0.35, 0.08, 'concrete', SK);
    slab(b, f, t, 3.65, 1.2, 0.3, 0.08, 'concrete', SK);
    slab(b, f, t, 8.85, 1.1, 0.7, 0.06, 'greyBrick', SK);
  }
  for (const t of [0.4, 3.2, 6.0, 8.8, 11.6]) slab(b, f, t, G_TOP, 0.5, 19.2 - G_TOP, 0.1, 'stone', SK);
  course(f, 0, len, G_TOP - 0.1, 0.3, 0.12, 'stone', wins);
  // balcony on the top storey: slab and iron rail
  slab(b, f, len / 2, 14.3, len - 0.4, 0.22, 0.75, 'stone', SK);
  rail(f, 0.4, len - 0.4, 14.52, SK + 0.62, 0.95);
  cornice(f, 0, len, 19.2, -0.15);
}

/** Iron railing: top rail, bottom rail, posts. */
function rail(f: Frame, a: number, z: number, y: number, out: number, h: number, c: C = 'bronze') {
  slab(b, f, (a + z) / 2, y + h - 0.06, z - a, 0.06, 0.06, c, out - 0.06);
  slab(b, f, (a + z) / 2, y + 0.08, z - a, 0.05, 0.05, c, out - 0.05);
  const n = Math.max(2, Math.round((z - a) / 0.3));
  for (let k = 0; k <= n; k++) slab(b, f, a + ((z - a) * k) / n, y, 0.035, h, 0.035, c, out - 0.035);
}

/** North-east pavilion, edge 43. */
function nePavilion() {
  const i = 43, {len} = edge(i);
  const wins: Win[] = [
    {t: 2.0, w: 1.1, y0: 0.25, y1: 3.0, back: 'dark', bars: 'none'},
    {t: 5.25, w: 1.3, y0: 0.6, y1: 3.2, back: 'dark', bars: 'door'},
    {t: 8.0, w: 1.3, y0: 0.6, y1: 3.2, bars: 'transom'}, // c05: shop window 1.3 m, the narrow one 0.8 m
    {t: 11.2, w: 0.8, y0: 1.0, y1: 3.0, bars: 'barred'},
    {t: 2.0, w: 1.0, y0: 4.7, y1: 6.2, bars: 'attic', surround: true},
    {t: 2.0, w: 0.9, y0: 7.1, y1: 8.5, bars: 'attic', surround: true},
    cross(5.45, 1.75, S1), cross(8.05, 1.6, S1), {...cross(11.4, 1.0, S1), bars: 'attic'},
    {...cross(2.0, 1.0, S2), bars: 'attic'}, ...lights(6.8, 5, 0.58, 0.44, S2, 'transom').map(w => ({...w, bars: 'attic' as Bars})), {...cross(11.4, 1.0, S2), bars: 'attic'},
    ...lights(2.0, 2, 0.55, 0.44, AT), ...lights(6.8, 5, 0.58, 0.44, AT), ...lights(11.4, 2, 0.55, 0.44, AT),
  ];
  const f = skin(i, STD_BANDS, wins, 0, undefined, [true, true]);
  dress(f, 0, len, wins);
  // stone frame of the five-light group, entrance hood over the left door
  slab(b, f, 6.8, S2[0] - 0.2, 4.95, 0.2, 0.1, 'stone', SK);
  slab(b, f, 6.8, S2[1], 4.95, 0.25, 0.1, 'stone', SK);
  slab(b, f, 2.0, 3.0, 1.7, 0.3, 0.35, 'stone', SK);
  atticPanels(f, [3.6, 9.9]);
  pilaster(f, 0, 1.1);
  pilaster(f, 12.3, len);
}

/** A three-axis wing (edges 45 and 53). */
function wing(i: number, axes: number[], pilasters: [number, number][]) {
  const {len} = edge(i), wins: Win[] = [];
  for (const t of axes) {
    wins.push({t: t - 0.5, w: 0.6, y0: 1.0, y1: 2.6, bars: 'barred'}, {t: t + 0.5, w: 0.6, y0: 1.0, y1: 2.6, bars: 'barred'});
    wins.push(cross(t, 1.6, [5.3, 8.8]), cross(t, 1.6, S2), ...lights(t, 3, 0.58, 0.44, AT));
  }
  const f = skin(i, STD_BANDS, wins);
  dress(f, 0, len, wins);
  const mids = [axes[0] - 2.25, (axes[0] + axes[1]) / 2, (axes[1] + axes[2]) / 2, axes[2] + 2.25].filter(t => t > 0.4 && t < len - 0.4);
  atticPanels(f, mids);
  for (const [a, z] of pilasters) pilaster(f, a, z);
}

/** Frontispiece: banded pilaster edges 47 and 51, central bay edge 49, attic, pediment with the Smout relief. */
function frontispiece() {
  for (const i of [47, 51]) {
    const {f, len} = edge(i);
    pilaster(f, 0, len, CORNICE, SK + 0.12);
    // carved scroll panel at attic level
    slab(b, f, len / 2, 16.5, 1.2, 2.3, 0.08, 'stone', SK + 0.12);
    for (const y of [17.1, 18.2]) ringSlab(b, f, len / 2, y, 0.22, 0.38, 0.06, 'stone', SK + 0.2, 10);
    cornice(f, 0, len, CORNICE, 0.1);
  }
  const i = 49, {len} = edge(i), C = len / 2;
  const portals = [C - 3.45, C, C + 3.45];
  const wins: Win[] = [
    ...portals.map(t => ({t, w: 2.5, y0: 0, y1: 4.0, bars: 'door' as Bars})),
    ...portals.map(t => cross(t, 1.8, [5.3, 8.8])),
    ...portals.map(t => ({...cross(t, 1.8, [10.65, 14.3]), surround: true})),
    ...[C - 3.6, C, C + 3.6].flatMap(t => lights(t, 3, 0.62, 0.44, [16.0, 19.3])),
  ];
  const f = skin(i, [{y0: 0, y1: 4.8, c: 'concrete'}, {y0: 4.8, y1: ATTIC, c: 'brick'}, {y0: ATTIC, y1: CORNICE, c: 'stone'}], wins);
  // stone dressing of the central bay: banded margins either side of the windows, entablature over the portals
  for (const t of [0.35, len - 0.35]) for (let k = 0; k < 20; k++) slab(b, f, t, 4.8 + k * 0.51, 0.7, 0.51, k % 2 ? 0.06 : 0.09, k % 2 ? 'greyBrick' : 'stone', SK);
  slab(b, f, C, 4.0, len, 0.8, 0.2, 'concrete', SK);
  slab(b, f, C, 4.8, len, 0.22, 0.3, 'stone', SK);
  // portal piers: granite blocks with a carved roundel on each pier head
  for (const t of [C - 5.15, C - 1.725, C + 1.725, C + 5.15]) {
    slab(b, f, t, 0, 0.85, 4.0, 0.18, 'concrete', SK);
    ringSlab(b, f, t, 4.4, 0.18, 0.32, 0.06, 'stone', SK + 0.2, 10);
    disc(b, f, t, 4.4, 0.17, 0.1, 'stone', SK + 0.2);
  }
  // ticker boards across the portal heads (black board, green figures strip)
  for (const t of portals) {
    slab(b, f, t, 3.25, 2.3, 0.55, 0.06, 'bronze', SK - GLASS + 0.12);
    slab(b, f, t, 3.4, 1.9, 0.18, 0.04, 'green', SK - GLASS + 0.18);
  }
  // BEURSPLEIN 5 in gilt capitals on the entablature over the middle portal
  {
    const L = raisedLettering({text: 'BEURSPLEIN 5', heightM: 0.36, maxWidthM: 3.6, depthM: 0.04});
    put(b, f, L.geometry, C, 4.4, SK + 0.2, 'gold');
  }
  // balcony on four carved (elephant-head) consoles
  for (const t of [0.5, C - 1.75, C + 1.75, len - 0.5]) {
    slab(b, f, t, 9.0, 0.55, 1.3, 0.45, 'stone', SK);
    slab(b, f, t, 9.6, 0.65, 0.7, 0.75, 'stone', SK);
    put(b, f, new T.CylinderGeometry(0.11, 0.07, 0.8, 6).translate(0, 0.4, 0), t, 8.6, SK + 0.3, 'stone');
    put(b, f, new T.SphereGeometry(0.28, 6, 4).scale(1, 0.9, 0.7), t, 9.55, SK + 0.42, 'stone');
  }
  slab(b, f, C, 10.3, len - 0.2, 0.28, 1.05, 'stone', SK);
  balustrade(f, 0.2, len - 0.2, 10.58, SK + 0.9);
  // attic: frieze of carved rosettes over the nine lights
  slab(b, f, C, 19.35, len - 1.2, 0.6, 0.08, 'stone', SK);
  for (let k = 0; k < 15; k++) disc(b, f, 1.0 + ((len - 2.0) * k) / 14, 19.65, 0.15, 0.06, 'stone', SK + 0.08);
  course(f, 0, len, 15.85, 0.15, 0.1, 'stone', wins);
  cornice(f, 0, len, CORNICE, 0.0);
  rustication(f, 0, len, wins.filter(w => w.y0 < 4.0), 4.0);
  pediment();
}

/** Ornamental cast balustrade: plinth, top rail, posts, pierced panels between them. */
function balustrade(f: Frame, a: number, z: number, y: number, out: number) {
  slab(b, f, (a + z) / 2, y, z - a, 0.12, 0.12, 'white', out - 0.12);
  slab(b, f, (a + z) / 2, y + 0.88, z - a, 0.08, 0.1, 'white', out - 0.1);
  const n = Math.round((z - a) / 1.4);
  for (let k = 0; k <= n; k++) slab(b, f, a + ((z - a) * k) / n, y, 0.12, 0.96, 0.12, 'white', out - 0.12);
  for (let k = 0; k < n; k++) {
    const t = a + ((z - a) * (k + 0.5)) / n, w = (z - a) / n - 0.2;
    ringSlab(b, f, t, y + 0.5, 0.2, 0.26, 0.03, 'white', out - 0.04, 8);
    for (const s of [-1, 1]) slab(b, f, t + (s * w) / 2.9, y + 0.12, 0.03, 0.76, 0.03, 'white', out - 0.04);
    slab(b, f, t, y + 0.45, w, 0.03, 0.03, 'white', out - 0.04);
  }
}

/** Pediment over the frontispiece (s 38.5-53.6): raking cornices, recessed tympanum, the C.A. Smout group (1924). */
function pediment() {
  const {f: f49, len: l49} = edge(49);
  // The pediment spans the pilasters either side of the central bay: from 1.8 m left to 1.8 m right of edge 49.
  const W = l49 + 3.6 + 0.4, C = l49 / 2, base = CORNICE + 1.0, apex = 25.9, out = SK + 0.25;
  const rise = apex - base;
  // tympanum backing (greyer stone) and the raking cornice
  poly(b, f49, C, base, [[-W / 2, 0], [W / 2, 0], [0, rise]], 0.25, 'greyBrick', out - 0.25);
  const slope = Math.atan2(rise, W / 2), Lr = Math.hypot(W / 2, rise);
  for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(Lr + 0.5, 0.55, 0.74).translate(0, 0.28, 0.37).rotateZ(s * -slope);
    put(b, f49, g, C + (s * W) / 4, base + rise / 2 - 0.2, out - 0.19, 'stone'); // back 6 cm off the tympanum back
    // dentil course under the rake
    const d = new T.BoxGeometry(Lr - 0.6, 0.18, 0.5).translate(0, -0.12, 0.25).rotateZ(s * -slope);
    put(b, f49, d, C + (s * W) / 4, base + rise / 2 - 0.2, out - 0.19, 'stone');
  }
  // the figure group: layout under the rake (pedimentRelief.ts), figures from figure-kit flattened to relief
  // read left to right from the Commons close-up (Brbbl 2011): reclining figure in the left corner, a seated figure with a
  // globe, four standing figures, Mercury with the caduceus at the axis, an enthroned figure beside him, standing and
  // seated figures to the right, a reclining figure in the right corner
  const slots: ReliefSlot[] = [
    {kind: 'reclining', u: -0.86}, {kind: 'seated', u: -0.66}, {kind: 'standing', u: -0.5}, {kind: 'standing', u: -0.37},
    {kind: 'standing', u: -0.24}, {kind: 'standing', u: -0.11}, {kind: 'standing', u: 0.0, facing: 0}, {kind: 'seated', u: 0.13, facing: 0},
    {kind: 'standing', u: 0.27}, {kind: 'standing', u: 0.4}, {kind: 'seated', u: 0.53}, {kind: 'seated', u: 0.68}, {kind: 'reclining', u: 0.86},
  ];
  // the two river gods lie either side of the shield along the base; the shield sits at the axis below the throne
  const field = {halfWidth: W / 2 - 0.35, rise: rise - 0.45, margin: 0.15, maxHeight: 3.0};
  const placed = layoutRelief(field, slots);
  placed.forEach((p, k) => relief(f49, C + p.x, base + 0.1, out, p.width, p.height, p.kind, p.facing, k));
  // river gods and shield at the bottom centre
  for (const s of [-1, 1]) relief(f49, C + s * 1.45, base + 0.1, out + 0.12, 2.3, 0.95, 'reclining', (-s) as -1 | 1, 20 + s);
  poly(b, f49, C, base + 0.1, [[-0.55, 0.35], [0.55, 0.35], [0.55, 1.3], [0, 1.5], [-0.55, 1.3], [-0.45, 0.15], [0, 0], [0.45, 0.15]].map(([x, y]) => [x, y] as [number, number]), 0.14, 'stone', out + 0.02);
  ringSlab(b, f49, C, base + 0.85, 0.32, 0.4, 0.05, 'stone', out + 0.16, 10);
}

/** One relief figure: figure-kit pose, flattened to 35 % depth, scaled into its envelope, standing on the tympanum base. */
function relief(f: Frame, t: number, y: number, out: number, w: number, h: number, kind: string, facing: -1 | 0 | 1, seed: number) {
  const arm = (seed * 37) % 5;
  let pose: Pose;
  if (kind === 'seated') pose = {...POSES.seated(0.5), arms: {l: {pitch: 0.4 + arm * 0.2, bend: 1.0}, r: {pitch: 1.2 - arm * 0.1, bend: 0.6}}, skirt: {len: 0.5, flare: 1.4}};
  else if (kind === 'reclining') pose = {...POSES.standing(), legs: {l: {pitch: 0.3, bend: 0.4}, r: {pitch: 0.1}}, arms: {l: {pitch: 2.6, bend: 0.5}, r: {pitch: 0.6, bend: 1.2}}, skirt: {len: 0.6, flare: 1.3}};
  else pose = {...POSES.standing(), arms: {l: {pitch: 0.2 + arm * 0.35, roll: 0.15, bend: 0.4}, r: {pitch: arm % 2 ? 2.4 : 0.5, roll: 0.1, bend: 0.5}}, skirt: {len: 0.75, flare: 1.25}};
  const {parts} = buildFigure(pose, 'stone');
  const m = new T.Matrix4().makeRotationY(facing * 0.45);
  if (kind === 'reclining') m.premultiply(new T.Matrix4().makeRotationZ(facing >= 0 ? -1.3 : 1.3));
  m.premultiply(new T.Matrix4().makeScale(1, 1, 0.35));
  const gs = parts.map(p => p.g.applyMatrix4(m));
  const box = new T.Box3();
  for (const g of gs) { g.computeBoundingBox(); box.union(g.boundingBox!); }
  const sx = w / (box.max.x - box.min.x), sy = h / (box.max.y - box.min.y), s = Math.min(sx, sy);
  for (const g of gs) {
    g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -box.min.z - 0.03).scale(s, s, s);
    put(b, f, g, t, y, out, 'stone');
  }
}

/** Clock bay, edge 55: pilasters, portal, clock, two three-light windows, attic loggia. */
function clockBay() {
  const i = 55, {len} = edge(i), P0 = 0.85, P1 = 3.42, C = (P0 + P1) / 2;
  const wins: Win[] = [
    {t: C, w: 2.0, y0: 0.15, y1: 5.5, bars: 'door', back: 'glass'},
    ...lights(C, 3, 0.45, 0.32, [9.0, 10.7], 'attic'),
    ...lights(C, 3, 0.45, 0.32, [12.0, 16.4], 'transom'),
    {t: C, w: 2.2, y0: 17.3, y1: 19.6, back: 'dark', bars: 'none'},
  ];
  const f = skin(i, [{y0: 0, y1: 6.3, c: 'stone'}, {y0: 6.3, y1: 16.9, c: 'brick'}, {y0: 16.9, y1: CORNICE, c: 'stone'}], wins, P0, P1, [true, true]);
  // portal: columns, entablature
  for (const s of [-1, 1]) {
    put(b, f, new T.CylinderGeometry(0.16, 0.18, 5.3, 8).translate(0, 2.65, 0), C + s * 1.12, 0.15, SK + 0.2, 'stone');
    slab(b, f, C + s * 1.12, 0, 0.45, 0.2, 0.42, 'stone', SK);
  }
  slab(b, f, C, 5.5, len - 1.4, 0.8, 0.3, 'stone', SK);
  slab(b, f, C, 6.3, len - 1.2, 0.15, 0.4, 'stone', SK);
  // clock: moulded stone ring, pale dial, hour marks, bronze hands
  ringSlab(b, f, C, 7.45, 0.8, 1.0, 0.16, 'stone', SK, 24);
  disc(b, f, C, 7.45, 0.8, 0.08, 'white', SK);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    slab(b, f, C + Math.sin(a) * 0.66, 7.45 + Math.cos(a) * 0.66 - 0.05, 0.05, 0.1, 0.03, 'bronze', SK + 0.08);
  }
  for (const g of clockHands(0.7, 10, 10, 0.04)) put(b, f, g, C, 7.45, SK + 0.1, 'bronze');
  for (const [y0, y1] of [[9.0, 10.7], [12.0, 16.4]]) {
    slab(b, f, C, y0 - 0.15, 2.4, 0.15, 0.14, 'stone', SK);
    slab(b, f, C, y1, 2.3, 0.2, 0.08, 'stone', SK);
  }
  pilaster(f, 0, P0, CORNICE);
  pilaster(f, P1, len, CORNICE);
  rustication(f, 0, P0, [], G_TOP);
  cornice(f, 0, len, CORNICE, 0.05);
}

/** South-west pavilion, edge 57: three axes, Mercury in a niche on the corner pilaster. */
function swPavilion() {
  const i = 57, {len} = edge(i), axes = [1.8, 5.1, 8.4];
  const wins: Win[] = [];
  for (const t of axes) wins.push({t, w: 1.5, y0: 0.6, y1: 3.3, bars: 'transom'}, cross(t, 1.5, S1), cross(t, 1.5, S2), ...lights(t, 2, 0.58, 0.44, AT));
  const f = skin(i, STD_BANDS, wins, 0, undefined, [false, true]);
  dress(f, 0, len, wins);
  atticPanels(f, [0.35, 3.45, 6.75, 10.05]);
  pilaster(f, 11.2, len);
  mercury(f, 11.9);
}

/** Mercury (c. 1927) in a shallow niche with pedestal and hood on the corner pilaster, first floor. */
function mercury(f: Frame, t: number) {
  const o = SK + PIL;
  slab(b, f, t, 4.9, 1.25, 3.4, 0.1, 'stone', o);              // niche frame plate
  slab(b, f, t, 5.15, 0.95, 2.95, 0.06, 'greyBrick', o + 0.1); // niche back
  slab(b, f, t, 4.9, 1.1, 0.3, 0.42, 'stone', o + 0.1);        // pedestal
  poly(b, f, t, 8.1, [[-0.65, 0], [0.65, 0], [0.35, 0.3], [-0.35, 0.3]], 0.35, 'stone', o + 0.1); // hood
  const pose: Pose = {...POSES.standing(), height: 2.3, arms: {l: {pitch: 0.15, roll: 0.1, bend: 0.3}, r: {pitch: 0.9, roll: 0.05, bend: 1.6}}, skirt: {len: 0.55, flare: 1.2}, hat: 'cap'};
  const {parts} = buildFigure(pose, 'stone');
  for (const p of parts) put(b, f, p.g.scale(1, 1, 0.6), t, 5.2, o + 0.36, 'stone');
}

/** Papenbrugsteeg side: facets 0-11 (bearing 194-256), granite base, brick, banded corner pilaster, stone attic, iron balcony. */
function papenbrugsteeg() {
  for (const i of [0, 1, 2, 3, 4, 6, 8, 11]) {
    const {len} = edge(i);
    const n = len > 6 ? Math.round(len / 3.4) : 1, wins: Win[] = [];
    for (let k = 0; k < n; k++) {
      const t = (len * (k + 0.5)) / n;
      if (i === 0 && t < 1.4) continue;
      const w = Math.min(1.5, len - 1.0);
      wins.push({t, w, y0: 0.8, y1: 3.2, bars: 'barred'}, cross(t, w, S1), cross(t, w, S2), ...lights(t, 2, Math.min(0.58, w / 2 - 0.25), 0.44, AT));
    }
    const f = skin(i, STD_BANDS, wins, 0, undefined, [i === 0, false]);
    dress(f, 0, len, wins);
    if (i === 0) pilaster(f, 0, 1.2);
    if (i === 8) { slab(b, f, 8.5, 4.6, 13.0, 0.22, 0.95, 'stone', SK); rail(f, 2.0, 15.0, 4.82, SK + 0.9, 0.95); }
  }
}

/** Warmoesstraat entries (edges 33, 21, 25, 17): granite base with large windows, stone-banded brick, windows per storey. */
function warmoesstraat() {
  for (const i of [33, 25, 21, 17]) {
    const {len} = edge(i), n = Math.max(1, Math.round(len / 3.2)), pitch = (len - 1.8) / n, wins: Win[] = [];
    for (let k = 0; k < n; k++) {
      const t = 0.9 + pitch * (k + 0.5), w = Math.min(1.5, pitch - 0.9);
      wins.push({t, w: Math.min(2.0, pitch - 0.6), y0: 0.5, y1: 3.6, bars: 'transom'}, cross(t, w, S1), cross(t, w, S2), ...lights(t, 2, Math.min(0.58, w / 2 - 0.25), 0.44, AT));
    }
    const f = skin(i, STD_BANDS, wins, 0, undefined, [true, true]);
    dress(f, 0, len, wins);
    pilaster(f, 0, 0.7);
    pilaster(f, len - 0.7, len);
  }
}

// ---- roof: tower, turrets, dormers -------------------------------------------------------------------------------------
// Front line (north corner -> west corner) as a frame: t = s along the front, out = -inward depth.
const P0: [number, number] = [11.7, -56.1], P1: [number, number] = [-45.6, 4.5];
const FL = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
// n = (-tz, tx): the outward (north-west) normal, so put() maps local +x to the tangent and local +z to n.
const FRONT: Frame = {origin: P0, tangent: [(P1[0] - P0[0]) / FL, (P1[1] - P0[1]) / FL], n: [-(P1[1] - P0[1]) / FL, (P1[0] - P0[0]) / FL]};
/** Roof height under (s, o) from the planes that stay (tower and turret planes are dropped and authored, so they must not lift a foot). */
const KEPT_ROOFS = src.surfaces.filter((_, i) => !TOWER_PLANES.has(i) && !TURRET_PLANES.has(i));
const roofAt = (s: number, o: number) => roofHeightAt(KEPT_ROOFS, FRONT.origin[0] + FRONT.tangent[0] * s - FRONT.n[0] * o, FRONT.origin[1] + FRONT.tangent[1] * s - FRONT.n[1] * o) ?? 20;
/** Box centred on (s, inward o), bottom y. */
function box(s: number, o: number, y: number, w: number, h: number, d: number, c: C) {
  put(b, FRONT, new T.BoxGeometry(w, h, d).translate(0, h / 2, 0), s, y, -o, c);
}
/** Square-plan lathe (4 sides, aligned with the front): an ogee cap or a dome. */
function lathe(s: number, o: number, y: number, profile: [number, number][], c: C, sides = 4) {
  const g = new T.LatheGeometry(profile.map(([r, h]) => new T.Vector2(r, h)), sides, sides === 4 ? Math.PI / 4 : 0);
  put(b, FRONT, g, s, y, -o, c);
}

function tower() {
  const s = 45.9, o = 6.9;
  box(s, o, 26.5, 4.4, 6.1, 4.4, 'slate');                 // slate-clad base standing on the ridge
  box(s, o, 32.6, 3.2, 3.0, 3.2, 'copper');                // louvred lantern stage
  // three tall louvred openings on each face (dark, 6 cm proud of the copper)
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    for (const k of [-1, 0, 1]) put(b, FRONT, new T.BoxGeometry(0.42, 2.1, 0.08).translate(k * 0.75, 1.05, 1.6 + 0.02).rotateY(a), s, 32.95, -o, 'dark');
  }
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) {
    box(s + dx, o + dz, 32.6, 0.8, 2.4, 0.8, 'copper');
    lathe(s + dx, o + dz, 35.0, [[0.001, 1.25], [0.12, 1.0], [0.42, 0.55], [0.55, 0.2], [0.58, 0]], 'copper');
  }
  box(s, o, 35.6, 3.7, 0.3, 3.7, 'copper');
  // ribbed ogee dome, small lantern, rod, gilt ship vane
  lathe(s, o, 35.9, [[0.001, 2.95], [0.45, 2.85], [0.9, 2.45], [1.35, 1.75], [1.68, 0.9], [1.78, 0.35], [1.72, 0]], 'copper', 8);
  put(b, FRONT, new T.CylinderGeometry(0.34, 0.38, 0.75, 8).translate(0, 0.375, 0), s, 38.8, -o, 'copper');
  put(b, FRONT, new T.ConeGeometry(0.42, 0.45, 8).translate(0, 0.225, 0), s, 39.55, -o, 'copper');
  put(b, FRONT, new T.CylinderGeometry(0.05, 0.05, 1.9, 4).translate(0, 0.95, 0), s, 39.9, -o, 'gold');
  put(b, FRONT, new T.SphereGeometry(0.16, 6, 4), s, 40.5, -o, 'gold');
  // the ship: hull and sail, a thin plate turned with the front
  poly(b, FRONT, s, 41.0, [[-0.5, 0.15], [0.5, 0.15], [0.35, 0], [-0.35, 0]], 0.04, 'gold', -o - 0.02);
  poly(b, FRONT, s, 41.15, [[-0.05, 0], [0.32, 0], [0.05, 0.6], [-0.05, 0.6]], 0.04, 'gold', -o - 0.02);
}

/** Louvred roof turret (dakruiter): slate body, copper louvre panels, copper ogee cap; top at the 3DBAG height. */
function turret(s: number, o: number, top: number, w: number) {
  const capH = 1.35, bodyTop = top - capH - 0.2, foot = roofAt(s, o) - 0.6;
  box(s, o, foot, w, bodyTop - foot, w, 'slate');   // panoramas: slate-grey body under pale copper louvre panels
  const ph = Math.min(1.6, bodyTop - foot - 0.5);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2, g = new T.BoxGeometry(w * 0.72, ph, 0.08).translate(0, ph / 2, w / 2 + 0.04).rotateY(a);
    put(b, FRONT, g, s, bodyTop - ph - 0.15, -o, 'copper');
  }
  box(s, o, bodyTop, w + 0.3, 0.2, w + 0.3, 'copper');
  lathe(s, o, bodyTop + 0.2, [[0.001, capH], [w * 0.12, capH - 0.2], [w * 0.38, capH * 0.55], [w * 0.62, capH * 0.15], [w * 0.68, 0]], 'copper');
  put(b, FRONT, new T.SphereGeometry(0.1, 6, 4), s, top - 0.05, -o, 'copper');
}

/** Small dormer with a dark light and a copper hipped hood, front face at inward depth o. */
function dormer(s: number, o: number) {
  const base = roofAt(s, o + 0.05) - 0.15, w = 1.0, h = 1.15, d = 1.3;
  box(s, o + d / 2, base, w, h, d, 'slate');
  put(b, FRONT, new T.BoxGeometry(0.56, 0.62, 0.06).translate(0, 0.31, 0.03), s, base + 0.28, -o, 'glass');
  put(b, FRONT, new T.BoxGeometry(0.72, 0.08, 0.1).translate(0, 0.04, 0.05), s, base + 0.2, -o, 'copper');
  const hood = new T.ConeGeometry(0.85, 0.65, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.25).translate(0, 0.325, -0.55);
  put(b, FRONT, hood, s, base + h, -o, 'copper');
}

export function buildEffectenbeurs(_w: number, _d: number, tools: BuildingTools & {mark?: (n: string) => void}) {
  b = tools;
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'RoofSurface' || TOWER_PLANES.has(i) || TURRET_PLANES.has(i)) return;
    roofPrism(b, s.rings, 'brick', HALL_PLANES.has(i) ? 'canopyGlass' : 'slate');
  });
  tools.mark?.('shell');
  setSink(0);
  annex();
  nePavilion();
  wing(45, [2.0, 6.5, 11.0], []);
  frontispiece();
  wing(53, [1.5, 6.0, 10.5], []);
  clockBay();
  swPavilion();
  papenbrugsteeg();
  warmoesstraat();
  flush();
  tower();
  turret(15.8, 5.4, 30.4, 1.9);
  turret(31.2, 6.1, 32.8, 1.6);
  turret(60.3, 6.0, 32.9, 1.6);
  turret(76.5, 6.0, 34.2, 2.2);
  for (const s of [16.2, 22.5, 29.0, 34.8, 57.0, 62.8, 74.0, 80.0]) dormer(s, 1.3);
  for (const s of [19.4, 32.6, 59.0, 77.6]) dormer(s, 3.6);
}
