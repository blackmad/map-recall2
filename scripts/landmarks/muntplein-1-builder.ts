import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, letters, patternPanel, poly, put, ringFrame, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {scrollDormer} from '../../src/canalRecall/landmarks/scrollDormer';
import {speklagen, type BandOpening} from '../../src/canalRecall/landmarks/speklagen';
import {cornerTurretOn} from './corner-turret-kit';
import source from './muntplein-1-footprints.json';

/**
 * MUNTPLEIN 1 / AMSTEL 2 (BAG pand 0363100012179461, rijksmonument 518344): office building with a cafe for the
 * Maatschappij "Volharding", A.L. van Gendt, 1892, neo-renaissance; opposite the Munttoren on the corner of the Muntplein
 * and the Amstel. The turret on Reguliersbreestraat 1 next door (BAG 0363100012179460, 1890) is another pand.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). The shell's front block rises sheer to 15.4 m
 * over most of the Amstel front where the photo shows a slate mansard above a 12.6 m cornice; a slate skin leans from the
 * cornice back to the shell wall's top there.
 *
 * Read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0), 50.2 px/m:
 *  - Amstel front (ring edge 0, 9.37 m, t from the east end): TMX7316010203-002543_pano_0000_000105 (2022, w01-16.alt.jpg),
 *    heights h = (872 - y) / 50.2 from the pavement; the cornice crown lands at 12.6 m, the 3DBAG wall top beside it.
 *  - Muntplein front (ring edge 4, 4.99 m, t from the north end): recording_2025-06-19_03-28-47_01473 (2025, w02-305.jpg),
 *    h = (900 - y) / 50.2; its cornice crown lands at 12.9 m, the 3DBAG 12.85 m wall top.
 *  - The corner turret on the 2.0 m canted corner (ring edge 2) from both aimed views (w01-16.thumb, w02-305.thumb).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const EN = ringFrame(src.facadeRing, 0), EC = ringFrame(src.facadeRing, 2), EW = ringFrame(src.facadeRing, 4);
const FN = EN.f, FC = EC.f, FW = EW.f;
type Col = 'brick' | 'stone' | 'sandstone' | 'greyBrick' | 'slate' | 'glass' | 'frame' | 'ochre' | 'blue' | 'white' | 'concrete' | 'dark' | 'bronze';

// ---- Amstel front (2022 crop: x px / 50.2 from the east end; heights (872 - y) / 50.2) ----
const tN = (x: number) => +(x / 50.2).toFixed(3);
const hN = (y: number) => +((872 - y) / 50.2).toFixed(3);
const N = {
  plinth: hN(845), // 0.54
  impost: hN(720), // 3.03: shop-window arches spring
  string1: hN(648), frieze1: [hN(645), hN(627)] as [number, number], string2: hN(622),
  win1: [hN(615), hN(505)] as [number, number], // first storey glass 5.12-7.31
  frieze2: [hN(468), hN(435)] as [number, number],
  win2: [hN(432), hN(330)] as [number, number], // second storey glass 8.76-10.80, round heads
  cornice: [hN(295), 12.6] as [number, number],
  axes: [tN(127.5), tN(260), tN(395)],
  arches: [tN(177.5), tN(286.5), tN(395)],
  piers: [[tN(107), tN(140)], [tN(212), tN(250)], [tN(321), tN(357)], [tN(430), 9.32]] as [number, number][],
};
const ARCH_W = 1.35, WIN_W = 1.15;
// ---- Muntplein front (2025 crop: x px / 50.2 from the north end; heights (900 - y) / 50.2) ----
const hW = (y: number) => +((900 - y) / 50.2).toFixed(3);
const W = {
  sign: [hW(695), hW(652)] as [number, number], // 4.08-4.94
  win1: [hW(637), hW(527)] as [number, number], // 5.24-7.43
  relief: [hW(484), hW(454)] as [number, number],
  win2: [hW(452), hW(341)] as [number, number], // 8.92-11.14
  cornice: [hW(300), 12.9] as [number, number],
  mullion: 2.52,
};

export function buildMuntplein1(_w: number, _d: number, b: BuildingTools) {
  // shell walls standing wholly above the 12.6 m cornice are the 3DBAG's steps in the slate mansard, not brick
  addShell(b, src as never, {wall: 'brick', roof: 'slate', wallFor: s => (Math.min(...s.rings[0].map(p => p[1])) > 12.4 ? 'slate' : 'brick')});
  const sink0 = getSink();
  setSink(0.04, true);
  amstelFront(b);
  muntpleinFront(b);
  corner(b);
  setSink(sink0);
}

/** Rusticated light stone between t0 and t1: a darker joint ground and blocks with 4 cm joints. */
function rustic(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number, out = 0, course = 0.42) {
  slab(b, F, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.12, 'sandstone', out);
  for (let y = y0; y < y1 - 0.08; y += course) slab(b, F, (t0 + t1) / 2, y + 0.02, t1 - t0 - 0.12, Math.min(course - 0.04, y1 - y - 0.02), 0.08, 'stone', out + 0.12);
}

/** A window: frame ring, glass, a mullion and transom; round-headed when `arched`. */
function windowAt(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, arched: boolean, out = 0, transom = 0.62) {
  if (arched) {
    archSlab(b, F, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.08, 'frame', out);
    archSlab(b, F, t, y0, w, y1 - y0, 0.13, 'glass', out);
    slab(b, F, t, y0, 0.07, y1 - y0 - w / 2, 0.18, 'frame', out);
    slab(b, F, t, y1 - w / 2 - 0.04, w, 0.07, 0.18, 'frame', out);
  } else {
    slab(b, F, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.08, 'frame', out);
    slab(b, F, t, y0, w, y1 - y0, 0.13, 'glass', out);
    slab(b, F, t, y0, 0.07, (y1 - y0) * transom, 0.18, 'frame', out);
    slab(b, F, t, y0 + (y1 - y0) * transom, w, 0.07, 0.18, 'frame', out);
  }
}

/** Light stone surround of alternating long and short blocks with colonnettes, a hood and a sill (the Amstel windows). */
function blockSurround(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, arched: boolean, out = 0) {
  const half = w / 2 + 0.08;
  for (let y = y0 - 0.1, k = 0; y < y1 - 0.05; y += 0.3, k++) {
    const bw = k % 2 ? 0.2 : 0.36, h = Math.min(0.24, y1 - y);
    for (const s of [-1, 1]) slab(b, F, t + s * (half + bw / 2), y, bw, h, 0.24, 'stone', out);
  }
  // colonnettes in the jambs
  for (const s of [-1, 1]) slab(b, F, t + s * (half + 0.11), y0, 0.1, y1 - y0, 0.3, 'sandstone', out);
  if (arched) archBand(b, F, t, y1 - w / 2, w + 0.52, (w + 0.52) / 2, 0.18, 0.36, 'stone', out, 10); // the head ring only: the jamb blocks carry the sides
  // hood: entablature over the window, a cornice strip on top
  slab(b, F, t, y1 + 0.1, w + 0.95, 0.3, 0.26, 'stone', out);
  slab(b, F, t, y1 + 0.4, w + 1.1, 0.12, 0.36, 'stone', out);
  slab(b, F, t, y0 - 0.2, w + 0.9, 0.14, 0.3, 'stone', out);
}

/** Frieze of patterned brick panels (pale diaper in red) between stone dies. */
const DIAPER = ['1000100010001000100010001', '0101010101010101010101010', '0010001000100010001000100'];
function frieze(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number, dies: number[], out = 0) {
  const cuts = [t0, ...dies.flatMap(d => [d - 0.18, d + 0.18]), t1];
  for (let i = 0; i + 1 < cuts.length; i += 2) {
    const a = cuts[i], c = cuts[i + 1];
    if (c - a > 0.2) patternPanel(b, F, (a + c) / 2, y0, c - a, y1 - y0, DIAPER, 'brick', 'ochre', 0.04, 0.05, out);
  }
  for (const d of dies) slab(b, F, d, y0 - 0.02, 0.36, y1 - y0 + 0.04, 0.16, 'stone', out);
  slab(b, F, (t0 + t1) / 2, y0 - 0.1, t1 - t0, 0.1, 0.18, 'stone', out);
  slab(b, F, (t0 + t1) / 2, y1, t1 - t0, 0.1, 0.18, 'stone', out);
}

/** Cornice: a brick frieze with paired brackets, a moulded bed and the corona. */
function cornice(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number, brackets: number[]) {
  slab(b, F, (t0 + t1) / 2, y0, t1 - t0, 0.1, 0.14, 'stone');
  for (const x of brackets) slab(b, F, x, y0 + 0.1, 0.16, y1 - y0 - 0.45, 0.32, 'stone');
  slab(b, F, (t0 + t1) / 2, y1 - 0.35, t1 - t0, 0.12, 0.36, 'stone');
  slab(b, F, (t0 + t1) / 2, y1 - 0.23, t1 - t0, 0.23, 0.52, 'stone');
}

/** Slate mansard skin leaning from the cornice crown (o = out0, y0) back to the shell wall (o = 0.02, y1). */
function mansardSkin(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number, out0: number) {
  const s = new T.Shape([new T.Vector2(0, 0), new T.Vector2(out0, 0), new T.Vector2(0.02, y1 - y0), new T.Vector2(-0.1, y1 - y0), new T.Vector2(-0.1, 0)]);
  // profile in (o, y), extruded along t
  const g = new T.ExtrudeGeometry(s, {depth: t1 - t0, bevelEnabled: false});
  g.rotateY(-Math.PI / 2).translate(t1, 0, 0);
  // after rotation: shape x (o) -> -z? rotateY(-pi/2) maps (x, y, z) -> (-z, y, x): shape x becomes +z (out), depth z becomes -x
  put(b, F, g, 0, y0, 0, 'slate');
}

/** Stone dormer gable with scrolled cheeks (scrollDormer.ts outline), an arched window, a stepped crown, pinnacles and a spike. */
function scrollGable(b: BuildingTools, F: Frame, t: number, o: {width: number; flare: number; y0: number; coveH: number; y1: number; win: [number, number, number]; crown: number; spike: number; pinnacles: number[]; out: number}) {
  const d = scrollDormer({t, width: o.width, flare: o.flare, y0: o.y0, coveH: o.coveH, y1: o.y1});
  poly(b, F, 0, 0, d.outline, 0.3, 'stone', o.out);
  // scrolls: a disc volute at each foot
  for (const s of [-1, 1]) {
    disc(b, F, t + s * (o.width / 2 + o.flare * 0.55), o.y0 + o.coveH * 0.5, o.coveH * 0.42, 0.12, 'stone', o.out + 0.28);
    ringSlab(b, F, t + s * (o.width / 2 + o.flare * 0.55), o.y0 + o.coveH * 0.5, o.coveH * 0.2, o.coveH * 0.3, 0.05, 'sandstone', o.out + 0.4);
  }
  // arched window
  const [ww, wy0, wy1] = o.win;
  archSlab(b, F, t, wy0 - 0.06, ww + 0.14, wy1 - wy0 + 0.13, 0.05, 'frame', o.out + 0.3);
  archSlab(b, F, t, wy0, ww, wy1 - wy0, 0.11, 'glass', o.out + 0.3);
  // pilaster strips either side of the window
  for (const s of [-1, 1]) slab(b, F, t + s * (o.width / 2 - 0.16), o.y0 + o.coveH, 0.16, o.y1 - o.y0 - o.coveH, 0.1, 'sandstone', o.out + 0.3);
  // stepped crown: cap, a narrower step and a pedestal for the spike
  slab(b, F, t, o.y1, o.width + 0.2, 0.14, 0.44, 'stone', o.out);
  poly(b, F, t, o.y1 + 0.14, [[-o.width / 2 + 0.05, 0], [o.width / 2 - 0.05, 0], [o.width / 4, o.crown - o.y1 - 0.14], [-o.width / 4, o.crown - o.y1 - 0.14]], 0.3, 'stone', o.out);
  slab(b, F, t, o.crown, o.width * 0.5 + 0.1, 0.12, 0.36, 'stone', o.out);
  put(b, F, new T.ConeGeometry(0.14, o.spike - o.crown - 0.12, 4).rotateY(Math.PI / 4).translate(0, (o.spike - o.crown - 0.12) / 2, 0), t, o.crown + 0.12, o.out + 0.18, 'stone');
  for (const p of o.pinnacles) {
    slab(b, F, t + p, o.y1 + 0.14, 0.2, 0.3, 0.36, 'stone', o.out + 0.04);
    put(b, F, new T.ConeGeometry(0.1, 0.42, 4).rotateY(Math.PI / 4).translate(0, 0.21, 0), t + p, o.y1 + 0.44, o.out + 0.16, 'stone');
  }
}

function amstelFront(b: BuildingTools) {
  const F = FN, L = EN.len;
  // ground storey: dark stone plinth, rusticated piers, three round-arched shop windows, the Amstel 2 doorcase
  slab(b, F, (tN(107) + L - 0.02) / 2, 0, L - 0.02 - tN(107), N.plinth, 0.22, 'greyBrick');
  for (const [a, c] of N.piers) rustic(b, F, a, c, N.plinth, N.impost);
  for (const [a, c] of N.piers) slab(b, F, (a + c) / 2, N.impost, c - a + 0.08, 0.16, 0.28, 'stone'); // impost blocks
  const openings: BandOpening[] = [];
  for (const t of N.arches) {
    const top = N.impost + ARCH_W / 2;
    // sunk stone reveal round the glass, the shop window with its transom at the impost and fanlight bars
    archSlab(b, F, t, N.plinth, ARCH_W + 0.3, top + 0.15 - N.plinth, 0.08, 'sandstone');
    archSlab(b, F, t, N.plinth + 0.1, ARCH_W, top - N.plinth - 0.1, 0.13, 'glass');
    slab(b, F, t, N.impost - 0.04, ARCH_W, 0.08, 0.18, 'frame');
    slab(b, F, t, N.impost + 0.4, ARCH_W, 0.06, 0.18, 'frame');
    for (const s of [-1, 1]) slab(b, F, t + s * 0.3, N.impost + 0.04, 0.05, 0.62, 0.18, 'frame');
    slab(b, F, t, N.plinth + 0.06, ARCH_W, 0.1, 0.18, 'frame');
    // archivolt and the lion-mask keystone
    archBand(b, F, t, N.impost, ARCH_W + 0.56, ARCH_W / 2 + 0.28, 0.24, 0.24, 'stone', 0, 10);
    slab(b, F, t, top + 0.02, 0.36, 0.42, 0.3, 'stone');
    slab(b, F, t, top + 0.1, 0.26, 0.26, 0.4, 'sandstone');
    openings.push({t0: t - ARCH_W / 2 - 0.28, t1: t + ARCH_W / 2 + 0.28, y0: N.impost, y1: top + 0.44});
  }
  // spandrels: yellow brick courses through the red brick, stopped at the archivolts (speklagen)
  const runs = speklagen({t0: tN(107), t1: L - 0.02, bands: [0, 1, 2, 3].map(k => ({y: N.impost + 0.22 + k * 0.32, h: 0.08})), openings, gap: 0.02});
  for (const r of runs) slab(b, F, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'ochre');
  door(b, F);
  // string courses and the first frieze
  frieze(b, F, 0.02, L - 0.02, N.frieze1[0], N.frieze1[1], [tN(107) + 0.3, ...N.piers.slice(1).map(([a, c]) => (a + c) / 2)]);
  // first storey: block surrounds with colonnettes, square heads
  for (const t of N.axes) { blockSurround(b, F, t, WIN_W, N.win1[0], N.win1[1], false); windowAt(b, F, t, WIN_W, N.win1[0], N.win1[1], false); }
  frieze(b, F, 0.02, L - 0.02, N.frieze2[0], N.frieze2[1], [N.axes[0] - 1.05, (N.axes[0] + N.axes[1]) / 2, (N.axes[1] + N.axes[2]) / 2, N.axes[2] + 1.05]);
  // the west axis's stone balcony panel under the second-storey window, standing proud of the frieze
  slab(b, F, N.axes[2], N.frieze2[0] - 0.12, 1.85, N.frieze2[1] - N.frieze2[0] + 0.12, 0.34, 'stone');
  slab(b, F, N.axes[2], N.frieze2[0] + 0.05, 1.3, N.frieze2[1] - N.frieze2[0] - 0.2, 0.42, 'sandstone');
  // second storey: round-headed windows in block surrounds
  for (const t of N.axes) { blockSurround(b, F, t, 1.1, N.win2[0], N.win2[1], true); windowAt(b, F, t, 1.1, N.win2[0], N.win2[1], true); }
  // cornice on paired brackets; the pedestal under the gable dormer breaks forward over the west axis
  const br: number[] = [];
  for (let x = 0.35; x < L - 0.2; x += 0.95) br.push(x);
  cornice(b, F, 0.02, L - 0.02, N.cornice[0], N.cornice[1], br);
  slab(b, F, N.axes[2], N.cornice[0] - 0.3, 1.4, N.cornice[1] - N.cornice[0] + 0.3, 0.62, 'stone');
  // slate mansard skin over the sheer 3DBAG wall (t 2.9 to the corner) and the wide flat dormer of ten lights
  mansardSkin(b, F, 2.9, L - 0.02, N.cornice[1], 15.4, 0.4);
  flatDormer(b, F, 2.95, tN(285), N.cornice[1], 14.6);
  scrollGable(b, F, N.axes[2], {width: 1.25, flare: 0.36, y0: N.cornice[1], coveH: 0.75, y1: 14.35, win: [0.5, 12.95, 13.95], crown: 15.05, spike: 16.2, pinnacles: [-0.62, 0.62], out: 0.42});
}

/** The flat dormer on the Amstel mansard: a box with ten lights in two rows between white posts. */
function flatDormer(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number) {
  const tc = (t0 + t1) / 2, w = t1 - t0;
  slab(b, F, tc, y0, w, y1 - y0, 0.55, 'white');
  slab(b, F, tc, y1 - 0.06, w + 0.12, 0.12, 0.62, 'stone');
  const cw = (w - 0.2) / 5;
  for (let k = 0; k < 5; k++) for (const [a, c] of [[y0 + 0.2, y0 + 0.95], [y0 + 1.05, y1 - 0.2]]) slab(b, F, t0 + 0.1 + cw * (k + 0.5), a, cw - 0.12, c - a, 0.6, 'glass');
}

/** The Amstel 2 doorcase: pilasters, the lettered entablature, a half-round pediment over an oculus and a mask. */
function door(b: BuildingTools, F: Frame) {
  const t0 = tN(15), t1 = tN(107), tc = (t0 + t1) / 2, w = t1 - t0;
  slab(b, F, tc, 0, w, N.impost, 0.14, 'stone');
  // door: dark panelled double leaf under a pale lintel block (2022: x 45-88, y 775-872; lintel y 757-772)
  slab(b, F, tc, 0, 0.88, 1.95, 0.2, 'dark');
  for (const s of [-1, 1]) for (const [y0, y1] of [[0.25, 0.95], [1.1, 1.8]]) slab(b, F, tc + s * 0.21, y0, 0.3, y1 - y0, 0.24, 'dark');
  slab(b, F, tc, 1.98, 1.0, 0.3, 0.3, 'frame');
  for (const s of [-1, 1]) slab(b, F, tc + s * 0.62, 0, 0.24, 2.4, 0.26, 'stone'); // pilasters
  slab(b, F, tc, 2.4, w, 0.5, 0.24, 'stone'); // entablature
  letters(b, F, 'VOLHARDING', tc, 2.5, 0.24, 0.021, 0.05, 'sandstone', 0.035);
  slab(b, F, tc, 2.9, w + 0.08, 0.13, 0.32, 'stone');
  // half-round pediment with the oculus
  archBand(b, F, tc, 3.03, w - 0.1, (w - 0.1) / 2, 0.22, 0.28, 'stone', 0, 10);
  slab(b, F, tc, 3.03, w - 0.1, 0.12, 0.3, 'stone');
  ringSlab(b, F, tc, 3.58, 0.28, 0.4, 0.1, 'stone', 0.18);
  disc(b, F, tc, 3.58, 0.26, 0.08, 'glass', 0.22);
  slab(b, F, tc, 3.03 + (w - 0.1) / 2 - 0.05, 0.4, 0.42, 0.38, 'sandstone'); // mask
}

function muntpleinFront(b: BuildingTools) {
  const F = FW, L = EW.len;
  // ground storey in rusticated stone with the arched shop window and the door under an oculus
  slab(b, F, L / 2, 0, L - 0.04, 0.58, 0.26, 'greyBrick');
  rustic(b, F, 0.02, 0.55, 0.58, W.sign[0]);
  rustic(b, F, 2.72, 3.05, 0.58, W.sign[0]);
  rustic(b, F, 4.3, L - 0.02, 0.58, W.sign[0]);
  rustic(b, F, 0.55, 2.72, 3.98 + 0.05, W.sign[0]);
  rustic(b, F, 3.05, 4.3, 2.8, W.sign[0]);
  const tw = 1.62, ww = 1.85, imp = 3.98 - ww / 2;
  archSlab(b, F, tw, 0.58, ww, 3.98 - 0.58, 0.13, 'glass');
  archBand(b, F, tw, imp, ww + 0.3, ww / 2 + 0.15, 0.16, 0.24, 'stone', 0, 10);
  slab(b, F, tw, imp - 0.04, ww, 0.08, 0.18, 'frame');
  slab(b, F, tw, 0.62, ww, 0.1, 0.18, 'frame');
  for (const s of [-1, 1]) slab(b, F, tw + s * 0.45, imp + 0.04, 0.05, 0.75, 0.18, 'frame');
  slab(b, F, tw, imp + 0.4, ww, 0.05, 0.18, 'frame');
  // the shop door (2025: x 161-208, to y 765) with its transom, and the oculus over it
  slab(b, F, 3.67, 0, 0.95, 2.7, 0.06, 'frame');
  slab(b, F, 3.67, 0.1, 0.7, 2.1, 0.13, 'glass');
  slab(b, F, 3.67, 2.25, 0.7, 0.35, 0.13, 'glass');
  ringSlab(b, F, 3.67, 3.73, 0.3, 0.45, 0.12, 'stone', 0.2);
  disc(b, F, 3.67, 3.73, 0.3, 0.1, 'glass', 0.26);
  // the DIAMOND FACTORY fascia (2021 and 2025)
  slab(b, F, L / 2, W.sign[0], L - 0.15, W.sign[1] - W.sign[0], 0.3, 'blue');
  letters(b, F, 'DIAMOND FACTORY', L / 2, W.sign[0] + 0.38, 0.3, 0.05, 0.05, 'concrete');
  slab(b, F, L / 2, W.sign[0] + 0.14, 2.6, 0.06, 0.36, 'concrete');
  // string course and the paired first-storey window with its figure mullion
  slab(b, F, L / 2, W.sign[1], L - 0.04, 0.14, 0.22, 'stone');
  pairedWindow(b, F, W.win1[0], W.win1[1], false);
  // the carved panel under the second-storey pair, flanked by consoles
  slab(b, F, W.mullion, W.relief[0] - 0.1, 3.3, W.relief[1] - W.relief[0] + 0.2, 0.3, 'stone');
  slab(b, F, W.mullion, W.relief[0] + 0.06, 2.2, W.relief[1] - W.relief[0] - 0.12, 0.4, 'sandstone');
  slab(b, F, L / 2, W.relief[0] - 0.2, L - 0.04, 0.1, 0.18, 'stone');
  pairedWindow(b, F, W.win2[0], W.win2[1], true);
  // brick frieze with a plaque under the cornice, then the cornice
  slab(b, F, W.mullion, 11.55, 1.6, 0.55, 0.16, 'stone');
  const br: number[] = [];
  for (let x = 0.3; x < L - 0.2; x += 0.88) br.push(x);
  cornice(b, F, 0.02, L - 0.02, W.cornice[0], W.cornice[1], br);
  scrollGable(b, F, 2.6, {width: 1.7, flare: 0.55, y0: W.cornice[1], coveH: 0.75, y1: 14.55, win: [0.7, 13.0, 14.1], crown: 15.05, spike: 15.85, pinnacles: [-0.75, 0.75], out: 0.2});
}

/** A pair of lights in one block surround divided by a carved figure mullion (Muntplein front). */
function pairedWindow(b: BuildingTools, F: Frame, y0: number, y1: number, arched: boolean) {
  const m = W.mullion, lw = arched ? 1.0 : 1.07, off = arched ? 0.62 : 0.66;
  for (const s of [-1, 1]) windowAt(b, F, m + s * off, lw, y0, y1, arched);
  // jamb blocks either side of the pair
  for (let y = y0 - 0.1, k = 0; y < y1 - 0.05; y += 0.3, k++) {
    const bw = k % 2 ? 0.2 : 0.36, h = Math.min(0.24, y1 - y);
    for (const s of [-1, 1]) slab(b, F, m + s * (off + lw / 2 + 0.1 + bw / 2), y, bw, h, 0.24, 'stone');
  }
  // the figure mullion: a pier with a carved figure block on a console
  slab(b, F, m, y0, 0.26, y1 - y0, 0.26, 'stone');
  slab(b, F, m, y0 + (y1 - y0) * 0.3, 0.14, (y1 - y0) * 0.45, 0.36, 'sandstone');
  if (arched) for (const s of [-1, 1]) archBand(b, F, m + s * off, y0, lw + 0.46, y1 - y0 + 0.23, 0.15, 0.32, 'stone', 0, 8);
  slab(b, F, m, y1 + (arched ? 0.15 : 0.1), 2 * off + lw + 0.9, 0.28, 0.26, 'stone');
  slab(b, F, m, y1 + (arched ? 0.43 : 0.38), 2 * off + lw + 1.05, 0.1, 0.34, 'stone');
  slab(b, F, m, y0 - 0.2, 2 * off + lw + 0.8, 0.14, 0.34, 'stone');
}

/** The canted corner: a rusticated ground storey with an arched light, and the turret from the first storey up. */
function corner(b: BuildingTools) {
  const F = FC, L = EC.len, tc = L / 2;
  slab(b, F, tc, 0, L - 0.02, 0.58, 0.26, 'greyBrick');
  rustic(b, F, 0.06, L - 0.06, 0.58, 3.55);
  archSlab(b, F, tc, 0.62, 0.95, 3.2 - 0.62, 0.26, 'glass');
  archBand(b, F, tc, 3.2 - 0.475, 1.2, 0.6, 0.14, 0.32, 'stone', 0, 8);
  // carved consoles (atlantes) under the oriel's corbel, either side of the front facet
  for (const s of [-1, 1]) {
    slab(b, F, tc + s * 0.62, 3.1, 0.34, 1.0, 0.42, 'stone');
    slab(b, F, tc + s * 0.62, 3.35, 0.24, 0.6, 0.55, 'sandstone');
  }
  setSink(0.04);
  cornerTurretOn(b, F, {
    plan: {sides: 8, apothem: 1.15, centre: [tc, -0.85]},
    stages: {corbel: [3.55, 4.45], body: [4.45, 12.6], drum: [12.6, 14.2], cone: {y: 14.2, rise: 3.5}, finial: 0.45},
    drumApothem: 0.92, coneApothem: 1.09,
    windows: [{y0: N.win1[0], y1: N.win1[1], width: 0.41}, {y0: N.win2[0], y1: N.win2[1], arched: true, width: 0.41}],
    drumLights: [12.95, 13.75],
    bands: [4.9, 7.85, 8.6, 13.0, 13.9],
    quoins: true,
    // the facet turned 45 deg towards the Muntplein faces the same way as that front, whose wall stops at 12.85 m: the
    // openings gate reads its drum light as standing past that wall's silhouette, so only the front and Amstel-side
    // facets carry one
    drumLightOn: f => f.angle < 0.01,
    colours: {wall: 'brick', trim: 'stone', glass: 'glass', frame: 'frame', roof: 'slate', finial: 'bronze'},
  });
}
