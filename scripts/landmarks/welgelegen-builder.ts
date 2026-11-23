import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, letters, poly, put, ringFrame, ringSlab, setSink, slab} from './nearbar-kit';
import {scrollDormer} from '../../src/canalRecall/landmarks/scrollDormer';
import source from './welgelegen-footprints.json';

/**
 * WELGELEGEN, Plantage Middenlaan 49 (BAG pand 0363100012181157, BAG 1802; rijksmonument 4107, a dwarshuis with glazing
 * bars), one of the two small garden houses on the Artis side of the Plantage Middenlaan; its neighbour on the left is
 * Weltevreden (no. 47).
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts): the 14.45 m front block with a hipped roof
 * (eaves 4.3-4.6 m, ridge 8.1 m) and the flat-roofed rear wing on the west.
 *
 * Front (facade ring edge 1, w01-210) read from the rectified Gemeente Amsterdam panorama
 * TMX7316010203-002047_pano_0000_001809 (2021-03-18, frontal; w01-210.alt.jpg, CC BY 4.0). The brief's 2024 panorama shows
 * the house wrapped in scaffolding sheeting. Heights h = (452 - y) / 50 (50 px/m: the 4.5 m eaves at y 225); along the
 * front t = x / 47.5 from the west end (the cornice runs x 0-680 for the 3DBAG's 14.45 m):
 *  - dark brown brick, two rows of white-framed 2 x 2 sash windows: two bays left of the entrance, three right; the low
 *    lower row (h 0.18-1.48) has iron bars;
 *  - the white stone door surround from the pavement to the cornice, the black panelled double door, the tall transom
 *    light with its wrought-iron oval, the name WELGELEGEN on the frieze, two wall lanterns;
 *  - the white wooden cornice and gutter board;
 *  - the tall white dormer on the cornice over the entrance: a two-light window between carved C-scroll cheeks that flare
 *    out at the foot (kit scrollDormer), under an arched hood with the hoist-beam knob at its apex;
 *  - two brick chimneys (by the dormer, and near the east hip), a roof light in the west slope;
 *  - the tall black cast-iron front-garden railing with its gate.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = ringFrame(src.facadeRing, 1);
const F = FRONT.f, L = FRONT.len;
const END = ringFrame(src.facadeRing, 2).f; // south-east end under the hip

const t = (x: number) => +(x / 47.5).toFixed(3);
const h = (y: number) => +((452 - y) / 50).toFixed(3);
const EAVES = 4.6;
const PITCH = Math.atan2(8.0 - EAVES, 2.6); // front slope: eaves to the ridge 2.6 m back
const roofY = (depth: number) => EAVES + Math.tan(PITCH) * depth;
const BAYS = [[35, 97], [125, 187], [424, 486], [512, 573], [600, 660]].map(([a, c]) => [t(a), t(c)] as const);
const LOW = [h(443), h(378)] as const;
const UP = [h(337), h(245)] as const;
const SURR = [t(240), t(372)] as const; // white door surround
const OPEN = [t(265), t(347)] as const; // door opening
const MID = (SURR[0] + SURR[1]) / 2;

export function buildWelgelegen(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04);
  front(b);
  setSink(sink0);
  // the cornice returns round the south-east end under the hip
  slab(b, END, ringFrame(src.facadeRing, 2).len / 2, h(238), ringFrame(src.facadeRing, 2).len - 0.05, 0.34, 0.28, 'sandstone');
  chimney(b, t(371), 0.9, 9.0, 0.66, 0.6);
  chimney(b, t(535), 2.4, 8.75, 0.6, 0.5);
  roofPanel(b, t(130), 1.0, 0.85, 0.7, 'glass');
}

function front(b: BuildingTools) {
  for (const [a, c] of BAYS) {
    sash(b, a, c, LOW[0], LOW[1], true);
    sash(b, a, c, UP[0], UP[1], false);
  }
  // cornice and gutter board (y 222-238), standing over the door surround
  slab(b, F, L / 2, h(238), L - 0.04, 0.2, 0.22, 'sandstone');
  slab(b, F, L / 2, h(238) + 0.2, L - 0.04, EAVES - h(238) - 0.2 + 0.04, 0.34, 'sandstone');
  entrance(b);
  dormer(b);
  // wall lanterns (x 210 and 395, y 333-350)
  for (const x of [210, 395]) {
    slab(b, F, t(x), h(350) + 0.1, 0.05, 0.05, 0.2, 'bronze');
    slab(b, F, t(x), h(350), 0.2, h(333) - h(350) + 0.06, 0.2, 'bronze', 0.16);
    slab(b, F, t(x), h(350) + 0.06, 0.13, h(333) - h(350) - 0.06, 0.2, 'concrete', 0.195);
  }
  fence(b);
}

/** White-framed sash with one glazing bar each way, a stone-white sill; the low row behind iron bars. */
function sash(b: BuildingTools, a: number, c: number, y0: number, y1: number, barred: boolean) {
  const w = c - a, m = (a + c) / 2, B = 0.1;
  slab(b, F, m, y0, w, y1 - y0, 0.015, 'glass', 0.02);
  for (const s of [-1, 1]) slab(b, F, m + s * (w / 2 - B / 2), y0, B, y1 - y0, 0.1, 'frame');
  slab(b, F, m, y0, w, B, 0.1, 'frame');
  slab(b, F, m, y1 - B, w, B, 0.1, 'frame');
  slab(b, F, m, y0 + (y1 - y0) / 2 - 0.04, w, 0.08, 0.09, 'frame');
  slab(b, F, m, y0, 0.05, y1 - y0, 0.085, 'frame');
  slab(b, F, m, y0 - 0.07, w + 0.1, 0.07, 0.12, 'sandstone');
  if (barred) for (let k = 1; k < 6; k++) slab(b, F, a + k * w / 6, y0 + 0.05, 0.025, y1 - y0 - 0.1, 0.025, 'bronze', 0.11);
}

function entrance(b: BuildingTools) {
  const ow = OPEN[1] - OPEN[0];
  // white stone surround: two jambs and the frieze up to the cornice, standing 12 cm proud
  for (const [a, c] of [[SURR[0], OPEN[0]], [OPEN[1], SURR[1]]]) slab(b, F, (a + c) / 2, 0, c - a, h(238) - 0.02, 0.14, 'sandstone');
  slab(b, F, MID, h(250), SURR[1] - SURR[0], h(238) - h(250) - 0.02, 0.14, 'sandstone');
  // inner moulding round the opening
  for (const s of [-1, 1]) slab(b, F, MID + s * (ow / 2 + 0.03), 0, 0.07, h(250), 0.18, 'sandstone');
  // the name WELGELEGEN (x 275-332, y 236-246), dark capitals on the frieze
  letters(b, F, 'WELGELEGEN', MID, h(247) - 0.02, 0.14, 0.02, 0.015, 'bronze', 0.024);
  // the transom light (y 250-318) with its wrought-iron oval, the transom bar, the black double door (y 322-450)
  const tr0 = h(318), tr1 = h(252);
  slab(b, F, MID, tr0, ow, tr1 - tr0, 0.02, 'glass', 0.02);
  slab(b, F, MID, h(322), ow, h(318) - h(322) + 0.04, 0.08, 'sandstone');
  const yc = (tr0 + tr1) / 2;
  const oval = new T.TorusGeometry(0.5, 0.025, 4, 22).scale(1, 0.5, 1);
  put(b, F, oval, MID, yc, 0.06, 'bronze');
  for (const s of [-1, 1]) {
    // scroll ends either side of the oval
    ringSlab(b, F, MID + s * 0.62, yc, 0.07, 0.11, 0.03, 'bronze', 0.05, 10);
    slab(b, F, MID + s * 0.3, yc - 0.01, 0.6, 0.025, 0.025, 'bronze', 0.05);
  }
  slab(b, F, MID, yc + 0.24, 0.2, 0.2, 0.04, 'bronze', 0.05); // the crown over the oval
  slab(b, F, MID, tr0, 0.04, tr1 - tr0, 0.04, 'bronze', 0.05);
  slab(b, F, MID, 0, ow, h(322), 0.04, 'dark', 0.02);
  for (const s of [-1, 1]) for (const [y0, y1] of [[0.25, 1.15], [1.35, h(322) - 0.18]]) slab(b, F, MID + s * ow / 4, y0, ow / 2 - 0.24, y1 - y0, 0.03, 'dark', 0.06);
  slab(b, F, MID, 0, 0.04, h(322), 0.04, 'bronze', 0.06);
  // a stone step
  slab(b, F, MID, 0, SURR[1] - SURR[0], 0.12, 0.4, 'concrete');
}

/**
 * The dormer: a body 2.1 m wide (x 255-355) on the cornice, extruded 2 m back into the roof, with an arched top (spring
 * h 6.94, crown h 7.14), the white front plate with the flared scroll cheeks (kit scrollDormer, feet at x 240 and 372), the
 * two-light window (x 268-342, y 115-192), the arched hood and the hoist-beam knob at the apex (x 300, y 62-100).
 */
function dormer(b: BuildingTools) {
  const y0 = h(218), spring = h(108), crown = h(88), bw = t(355) - t(255);
  const arc = (half: number, rise: number, n = 8): [number, number][] => {
    const r = (half * half + rise * rise) / (2 * rise), a0 = Math.asin(half / r), pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) { const a = -a0 + 2 * a0 * k / n; pts.push([r * Math.sin(-a) * -1, rise - r + r * Math.cos(a)]); }
    return pts;
  };
  const body: [number, number][] = [[-bw / 2, 0], [bw / 2, 0], ...arc(bw / 2, crown - spring).map(([x, y]) => [x, spring - y0 + y] as [number, number]).reverse()];
  poly(b, F, MID, y0, body, 2.1, 'sandstone', -2.0);
  // front plate with the cheeks flaring out to the cornice ends of the surround
  const {outline} = scrollDormer({t: 0, width: bw, flare: (SURR[1] - SURR[0] - bw) / 2, y0: 0, coveH: h(140) - y0, y1: spring - y0});
  poly(b, F, MID, y0, outline, 0.16, 'sandstone');
  // base ledge (y 200-218)
  slab(b, F, MID, y0, SURR[1] - SURR[0] + 0.1, h(200) - y0, 0.26, 'sandstone');
  // the carved C-scrolls on the cheeks (x 252 and 360, y 160-190)
  for (const s of [-1, 1]) {
    const tc = MID + s * (bw / 2 + 0.05);
    ringSlab(b, F, tc, h(178), 0.07, 0.15, 0.06, 'sandstone', 0.16, 12);
    slab(b, F, tc, h(178), 0.07, h(135) - h(178), 0.06, 'sandstone', 0.16);
  }
  // window: dark glass, white frame, a mullion: two tall lights (2021 crop shows no transom)
  const w0 = t(268), w1 = t(342), wy0 = h(192), wy1 = h(115), wm = (w0 + w1) / 2, ww = w1 - w0;
  slab(b, F, wm, wy0, ww, wy1 - wy0, 0.05, 'glass', 0.16);
  for (const s of [-1, 1]) slab(b, F, wm + s * (ww / 2 - 0.05), wy0, 0.1, wy1 - wy0, 0.12, 'frame', 0.16);
  slab(b, F, wm, wy0, ww, 0.1, 0.12, 'frame', 0.16);
  slab(b, F, wm, wy1 - 0.1, ww, 0.1, 0.12, 'frame', 0.16);
  slab(b, F, wm, wy0, 0.06, wy1 - wy0, 0.1, 'frame', 0.16);
  // arched hood: a moulded band 0.14 m over the arch, standing 0.3 m proud
  const outer = arc(bw / 2 + 0.12, crown - spring + 0.04), inner = arc(bw / 2 + 0.12, crown - spring - 0.02);
  const band: [number, number][] = [...outer.map(([x, y]) => [x, y + 0.12] as [number, number]), ...inner.reverse().map(([x, y]) => [x, y - 0.02] as [number, number])];
  poly(b, F, MID, spring, band, 0.32, 'sandstone', -0.02);
  // hoist-beam knob at the apex
  slab(b, F, t(300), crown - 0.06, 0.2, h(62) - crown + 0.06, 0.55, 'sandstone');
}

/** Brick stack at `depth` behind the front, from inside the roof to `top`. */
function chimney(b: BuildingTools, at: number, depth: number, top: number, w: number, d: number) {
  const y0 = roofY(depth - d / 2) - 0.1;
  slab(b, F, at, y0, w, top - y0, d, 'brick', -depth - d / 2);
  slab(b, F, at, top - 0.12, w + 0.1, 0.12, d + 0.1, 'brick', -depth - d / 2 - 0.05);
}

/** A flat panel lying 3 cm over the front roof slope, centred `depth` behind the front. */
function roofPanel(b: BuildingTools, at: number, depth: number, w: number, len: number, colour: string) {
  const g = new T.BoxGeometry(w, len, 0.05).rotateX(PITCH - Math.PI / 2);
  const off = 0.06;
  put(b, F, g, at, roofY(depth) + off * Math.cos(PITCH), -depth + off * Math.sin(PITCH), colour);
}

/** The tall black cast-iron front railing 1.0 m out, with taller posts and the gate before the door (y 365-452). */
function fence(b: BuildingTools) {
  const out = 1.0, H = 1.45;
  const posts = [0.15, t(240) - 0.1, t(372) + 0.1, L - 0.15, 2.2, 10.5, 12.6];
  slab(b, F, L / 2, 0.12, L - 0.3, 0.04, 0.04, 'bronze', out);
  slab(b, F, L / 2, H - 0.15, L - 0.3, 0.04, 0.04, 'bronze', out);
  const n = Math.round((L - 0.3) / 0.2);
  for (let k = 0; k <= n; k++) slab(b, F, 0.15 + k * (L - 0.3) / n, 0, 0.018, H, 0.018, 'bronze', out + 0.01);
  for (const p of posts) {
    slab(b, F, p, 0, 0.07, H + 0.2, 0.07, 'bronze', out - 0.015);
    put(b, F, new T.SphereGeometry(0.06, 6, 4), p, H + 0.26, out + 0.02, 'bronze');
  }
}

