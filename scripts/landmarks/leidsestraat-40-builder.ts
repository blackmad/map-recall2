import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, getSink, patternPanel, poly, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {cornerTurretOn} from './corner-turret-kit';
import source from './leidsestraat-40-footprints.json';

/**
 * LEIDSESTRAAT 40 (BAG pand 0363100012176402, 1881, rijksmonument; municipal register 2628 has no description text): the
 * Dutch neo-renaissance corner house on the Leidsestraat and the Keizersgracht, in orange-red brick with light stone bands
 * and dressings, a stepped dormer gable, a cream stone ground storey with white shop joinery and a round-arched shop window under a sculpted
 * frieze, and on the canted corner a corbelled oxblood timber oriel turret through two storeys, carried past the eaves as
 * a glazed tower stage under a tall zinc spire, with a bust and carved consoles under its corbel.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). Fronts (nearbar-kit ringFrame, t from the
 * viewer's left): the Leidsestraat front ring edge 2 (7.58 m), the canted corner edge 3 (2.0 m), the Keizersgracht return
 * edge 4 (3.74 m). Read from the rectified 2016 crop TMX7316060226-000022_pano_0000_000825 (w01-140.jpg, 49.7 px/m along
 * the wall), heights h = (768 - y) / 50.5 so the dormer gable lands on the 3DBAG 15.2 m wall top; the turret and the
 * Keizersgracht return from pitched looks out of b_20241203_0939_Track09_Sphere_00353 (2024) and
 * b_20250120_0926_Track25_Sphere_00003 (2025), Gemeente Amsterdam panoramas, CC BY 4.0.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const EF = ringFrame(src.facadeRing, 2), EC = ringFrame(src.facadeRing, 3), EK = ringFrame(src.facadeRing, 4);
const FF = EF.f, FC = EC.f, FK = EK.f;
type Col = 'brick' | 'stone' | 'greyBrick' | 'concrete' | 'red' | 'pink' | 'frame' | 'glass' | 'slate' | 'copper' | 'gold' | 'sandstone' | 'bronze';

const tX = (x: number) => +(x / 49.7).toFixed(3);
const hY = (y: number) => +((768 - y) / 50.5).toFixed(3);
export const L40 = {
  shop: hY(605), // 3.23: top of the white shopfront
  mezz: [hY(600), hY(515)] as [number, number], // 3.33-5.01: the low windows over the shop
  relief: [hY(520), hY(492)] as [number, number], // 4.91-5.47: the sculpted frieze over the arch
  string1: [hY(492), hY(475)] as [number, number], // 5.47-5.80
  win1: [hY(465), hY(368)] as [number, number], // 6.00-7.92
  hood: [hY(365), hY(325)] as [number, number], // 7.98-8.77
  win2: [hY(318), hY(222)] as [number, number], // 8.91-10.81
  cornice: [hY(195), hY(165)] as [number, number], // 11.35-11.94
  axesL: [tX(58), tX(138)], // 1.17, 2.78
  pair: tX(290), // 5.84: the figure mullion of the right axis
  arch: [tX(235), tX(350)] as [number, number], // 4.73-7.04
  archTop: hY(555), // 4.22
};

export function buildLeidsestraat40(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04);
  leidsestraatFront(b);
  keizersgrachtReturn(b);
  corner(b);
  setSink(sink0);
}

/** Light stone bands through the brick (every 0.55 m, the speklagen of the photo), stopped at the window openings. */
function bands(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number, gaps: [number, number][]) {
  for (let y = y0; y < y1 - 0.1; y += 0.55) {
    let at = t0;
    for (const [a, c] of [...gaps.sort((p, q) => p[0] - q[0]), [t1, t1] as [number, number]]) {
      if (a - at > 0.12) slab(b, F, (at + a) / 2, y, a - at, 0.1, 0.05, 'stone');
      at = Math.max(at, c);
    }
  }
}

/** A cross window with red frames: stone surround, glass, the cross bars, a stone sill. */
function crossWindow(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number) {
  slab(b, F, t, y0 - 0.08, w + 0.24, y1 - y0 + 0.16, 0.05, 'stone');
  slab(b, F, t, y0, w, y1 - y0, 0.1, 'frame');
  slab(b, F, t, y0 + 0.07, w - 0.14, y1 - y0 - 0.14, 0.16, 'glass');
  slab(b, F, t, y0 + (y1 - y0) * 0.66, w - 0.14, 0.07, 0.21, 'frame');
  slab(b, F, t, y0 - 0.2, w + 0.4, 0.12, 0.26, 'stone');
}

/** Wrought-iron wall anchor: a bar with a scroll each side (simplified as a flat iron cross with discs). */
function anchor(b: BuildingTools, F: Frame, t: number, y: number) {
  slab(b, F, t, y - 0.25, 0.05, 0.5, 0.1, 'bronze');
  slab(b, F, t, y - 0.03, 0.34, 0.05, 0.1, 'bronze');
  for (const s of [-1, 1]) slab(b, F, t + s * 0.14, y + 0.05, 0.08, 0.12, 0.1, 'bronze');
}

/** The right axis: a pair of lights on either side of a carved figure mullion. */
function pairedWindow(b: BuildingTools, F: Frame, m: number, y0: number, y1: number) {
  for (const s of [-1, 1]) crossWindow(b, F, m + s * 0.56, 0.82, y0, y1);
  slab(b, F, m, y0 - 0.1, 0.3, y1 - y0 + 0.2, 0.2, 'stone');
  slab(b, F, m, y0 + 0.25, 0.18, (y1 - y0) * 0.6, 0.3, 'sandstone'); // the figure
  slab(b, F, m, y0 + 0.12, 0.26, 0.13, 0.28, 'stone'); // its console
}

/** Round-arched shop window in grey stone: glass, a stained-glass fanlight, the archivolt and a cartouche keystone. */
function archWindow(b: BuildingTools, F: Frame, t0: number, t1: number, top: number) {
  const tc = (t0 + t1) / 2, w = t1 - t0, spring = top - w / 2;
  archSlab(b, F, tc, 0.35, w + 0.5, top + 0.3 - 0.35, 0.1, 'stone');
  archSlab(b, F, tc, 0.42, w, top - 0.42, 0.16, 'glass');
  // stained fanlight over the transom
  const s = new T.Shape(); s.moveTo(-w / 2 + 0.08, 0); s.lineTo(w / 2 - 0.08, 0); s.absarc(0, 0, w / 2 - 0.08, 0, Math.PI, false);
  put(b, F, new T.ExtrudeGeometry(s, {depth: 0.2, bevelEnabled: false, curveSegments: 8}), tc, spring + 0.02, 0, 'gold');
  // white-painted shop joinery (2016 crop: the frames read as white as the stone, x 235 and 350): jamb stiles, the
  // transom under the fanlight, the white stallriser panel, thin in depth so they stay frame members
  slab(b, F, tc, spring - 0.06, w, 0.1, 0.12, 'concrete', 0.12);
  for (const s of [-1, 1]) slab(b, F, tc + s * (w / 2 - 0.02), 0.4, 0.12, spring - 0.46, 0.07, 'concrete', 0.13);
  slab(b, F, tc, 0.4, w - 0.22, 0.57, 0.07, 'concrete', 0.13);
  slab(b, F, tc, 0.97, w - 0.22, 0.09, 0.07, 'concrete', 0.13);
  archBand(b, F, tc, spring, w + 0.56, w / 2 + 0.28, 0.28, 0.26, 'stone', 0, 10);
  slab(b, F, tc, top - 0.05, 0.42, 0.55, 0.34, 'sandstone');
  slab(b, F, tc, 0, w + 0.5, 0.35, 0.3, 'stone');
}

/** Sculpted frieze panel: a stone ground with relief figure blocks in two depths. */
function reliefPanel(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number) {
  const tc = (t0 + t1) / 2, w = t1 - t0;
  slab(b, F, tc, y0 - 0.04, w + 0.12, y1 - y0 + 0.08, 0.12, 'stone');
  patternPanel(b, F, tc, y0 + 0.05, w - 0.1, y1 - y0 - 0.1, ['0110110011011001101100', '1111111111111111111111', '0110011001100110011001'], 'stone', 'sandstone', 0.07, 0.05, 0.12);
}

function leidsestraatFront(b: BuildingTools) {
  const F = FF, L = EF.len;
  // ground: the white-painted shopfront on the left, cream stone round the arch on the right (2016 crop: the ground
  // storey reads as light as the white joinery; the 2024 dusk look is too dark to measure)
  slab(b, F, 2.17, 0, 4.26, L40.shop, 0.12, 'concrete');
  for (const [a, c] of [[0.4, 1.3], [2.5, 3.62]]) slab(b, F, (a + c) / 2, 0.45, c - a, 1.95, 0.16, 'glass');
  slab(b, F, 1.9, 0.05, 0.9, 2.3, 0.16, 'glass'); // the glazed shop door
  slab(b, F, 2.15, 2.62, 4.0, 0.5, 0.16, 'concrete');
  // white shop joinery over the glass: stiles, head and sill rails per window, the door's stiles and head rail
  // (no glazing bars across the glass: the openings audit would count each light as a window) (2016 crop x 20-65, 70-120, 125-180); thin in depth (0.06) so they read as frames, not walls
  for (const [a, c] of [[0.4, 1.3], [2.5, 3.62]]) {
    for (const t of [a - 0.005, c + 0.005]) slab(b, F, t, 0.43, 0.09, 1.99, 0.06, 'concrete', 0.15);
    for (const [y, hh] of [[0.43, 0.1], [2.32, 0.1]]) slab(b, F, (a + c) / 2, y, c - a - 0.08, hh, 0.06, 'concrete', 0.15);
    slab(b, F, (a + c) / 2, 0.4, c - a + 0.12, 0.08, 0.12, 'stone', 0.12); // the sill
  }
  for (const t of [1.40, 2.40]) slab(b, F, t, 0.03, 0.1, 2.34, 0.06, 'concrete', 0.15);
  slab(b, F, 1.9, 2.22, 0.84, 0.08, 0.06, 'concrete', 0.15);
  slab(b, F, (4.3 + L) / 2, 0, L - 4.3, L40.relief[0] - 0.05, 0.06, 'stone');
  archWindow(b, F, L40.arch[0], L40.arch[1], L40.archTop);
  reliefPanel(b, F, tX(222), tX(358), L40.relief[0], L40.relief[1]);
  // the low windows over the shop and the stone string course
  for (const t of L40.axesL) crossWindow(b, F, t, 0.92, L40.mezz[0] + 0.05, L40.mezz[1] - 0.05);
  slab(b, F, L / 2, L40.string1[0], L, L40.string1[1] - L40.string1[0], 0.22, 'stone');
  // first and second storeys: cross windows on the left axes, the paired right axis
  for (const [y0, y1] of [L40.win1, L40.win2]) {
    for (const t of L40.axesL) crossWindow(b, F, t, 1.0, y0, y1);
    pairedWindow(b, F, L40.pair, y0, y1);
  }
  // hoods: straight cornices on consoles over the left windows, a broken segmental pediment over the pair
  for (const t of L40.axesL) {
    slab(b, F, t, L40.hood[0], 1.3, 0.22, 0.2, 'stone');
    slab(b, F, t, L40.hood[0] + 0.22, 1.42, 0.12, 0.3, 'stone');
    for (const s of [-1, 1]) slab(b, F, t + s * 0.62, L40.hood[0] - 0.3, 0.14, 0.3, 0.24, 'stone');
  }
  slab(b, F, L40.pair, L40.hood[0], 2.4, 0.16, 0.3, 'stone');
  for (const s of [-1, 1]) segBand(b, F, L40.pair + s * 0.68, L40.hood[0] + 0.16, 1.05, 0.32, 0.14, 0.26, 'stone');
  slab(b, F, L40.pair, L40.hood[0] + 0.16, 0.34, 0.6, 0.32, 'sandstone'); // the pier rising into the broken pediment
  // brick bands and quoins
  const gaps: [number, number][] = [...L40.axesL.map(t => [t - 0.62, t + 0.62] as [number, number]), [L40.pair - 1.15, L40.pair + 1.15]];
  bands(b, F, 0.05, L - 0.05, L40.win1[0] + 0.2, L40.hood[0] - 0.05, gaps);
  bands(b, F, 0.05, L - 0.05, L40.win2[0] + 0.2, L40.cornice[0] - 0.05, gaps);
  for (let y = L40.mezz[0], k = 0; y < L40.cornice[0] - 0.2; y += 0.3, k++) slab(b, F, k % 2 ? 0.14 : 0.24, y, k % 2 ? 0.28 : 0.48, 0.24, 0.06, 'stone');
  // the eaves cornice
  slab(b, F, L / 2, L40.cornice[0], L, 0.2, 0.2, 'stone');
  slab(b, F, L / 2, L40.cornice[0] + 0.2, L + 0.04, L40.cornice[1] - L40.cornice[0] - 0.2, 0.42, 'stone');
  // wrought-iron anchors (2016 crop: x 10, 95, 175 at y 205; x 15, 95, 175, 225, 360 at y 345)
  for (const x of [10, 95, 175, 290]) anchor(b, F, tX(x), hY(205));
  for (const x of [15, 95, 175, 225, 360]) anchor(b, F, tX(x), hY(345));
  setSink(0.04, true);
  dormerGable(b, F);
  setSink(0.04);
  // the chimney stack at t 3.7-4.4 and the small red dormer on the roof behind the eaves
  slab(b, F, 4.05, L40.cornice[1] - 0.6, 0.7, 13.85 - L40.cornice[1] + 0.6, 0.6, 'brick', -0.8);
  slab(b, F, 4.05, 13.85, 0.8, 0.14, 0.7, 'stone', -0.85);
  slab(b, F, 5.15, 11.9, 1.0, 1.0, 0.7, 'red', -1.5);
  slab(b, F, 5.15, 12.1, 0.6, 0.6, 0.73, 'glass', -1.5);
  put(b, F, new T.ConeGeometry(0.72, 0.5, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.55).translate(0, 0.25, 0), 5.15, 12.9, -1.1, 'red');
}

/** The stepped dormer gable over the left axes: brick with stone bands, the round-arched window, step cappings. */
function dormerGable(b: BuildingTools, F: Frame) {
  const t0 = tX(20), t1 = tX(160), tc = (t0 + t1) / 2, y0 = L40.cornice[1], top = 15.15;
  const w = t1 - t0, s1 = hY(62);
  poly(b, F, tc, y0, [[-w / 2, 0], [w / 2, 0], [w / 2, s1 - y0], [w / 2 - 0.42, s1 - y0], [w / 2 - 0.42, top - 0.35 - y0], [-w / 2 + 0.42, top - 0.35 - y0], [-w / 2 + 0.42, s1 - y0], [-w / 2, s1 - y0]], 0.25, 'brick');
  for (const [a, c, y] of [[-w / 2, -w / 2 + 0.5, s1], [w / 2 - 0.5, w / 2, s1], [-w / 2 + 0.38, w / 2 - 0.38, top - 0.35]] as [number, number, number][]) slab(b, F, tc + (a + c) / 2, y, c - a + 0.08, 0.14, 0.34, 'stone');
  slab(b, F, tc, top - 0.21, 0.7, 0.24, 0.3, 'stone');
  for (let y = y0 + 0.4; y < top - 0.5; y += 0.55) slab(b, F, tc, y, y < s1 ? w - 0.02 : w - 0.86, 0.1, 0.29, 'stone');
  const ww = tX(125) - tX(65), tw = tc + 0.12; // the window sits on the 3DBAG gable's centre line (t 2.0)
  archSlab(b, F, tw, hY(160) - 0.08, ww + 0.26, hY(85) - hY(160) + 0.1, 0.3, 'stone');
  archSlab(b, F, tw, hY(160), ww, hY(85) - hY(160) - 0.06, 0.34, 'frame');
  archSlab(b, F, tw, hY(160) + 0.07, ww - 0.14, hY(85) - hY(160) - 0.2, 0.4, 'glass');
  slab(b, F, tw, hY(160) + 0.5, ww - 0.14, 0.06, 0.4, 'frame');
  // stone scroll shoulders at the first step
  for (const s of [-1, 1]) slab(b, F, tc + s * (w / 2 - 0.05), y0, 0.3, 0.5, 0.35, 'stone');
}

/** The Keizersgracht return (3.74 m): cream stone ground with the second arched window, the frieze, the paired axis. */
function keizersgrachtReturn(b: BuildingTools) {
  // the 3DBAG return wall runs from 0.15 m behind ring edge 4 at the corner end to 0.02 m behind it at t 3.39: hang the
  // return on that wall's own line
  const k = 0.13 / 3.24, nt = Math.hypot(1, k);
  const tg: [number, number] = [(FK.tangent[0] + FK.n[0] * k) / nt, (FK.tangent[1] + FK.n[1] * k) / nt];
  const F: Frame = {origin: [FK.origin[0] - FK.n[0] * 0.12, FK.origin[1] - FK.n[1] * 0.12], tangent: tg, n: [(FK.n[0] - FK.tangent[0] * k) / nt, (FK.n[1] - FK.tangent[1] * k) / nt]};
  const L = EK.len, m = L / 2 + 0.45; // clear of the turret's buried half at the corner end
  slab(b, F, L / 2, 0, L - 0.04, L40.relief[0] - 0.05, 0.06, 'stone');
  archWindow(b, F, m - 1.0, m + 1.0, L40.archTop);
  reliefPanel(b, F, 0.25, L - 0.25, L40.relief[0], L40.relief[1]);
  slab(b, F, L / 2, L40.string1[0], L - 0.04, L40.string1[1] - L40.string1[0], 0.22, 'stone');
  for (const [y0, y1] of [L40.win1, L40.win2]) pairedWindow(b, F, m, y0, y1);
  slab(b, F, m, L40.hood[0], 2.4, 0.16, 0.3, 'stone');
  for (const s of [-1, 1]) segBand(b, F, m + s * 0.68, L40.hood[0] + 0.16, 1.05, 0.32, 0.14, 0.26, 'stone');
  const gaps: [number, number][] = [[m - 1.15, m + 1.15]]; // the pair and its jamb stones
  bands(b, F, 0.05, L - 0.05, L40.win1[0] + 0.2, L40.hood[0] - 0.05, gaps);
  bands(b, F, 0.05, L - 0.05, L40.win2[0] + 0.2, L40.cornice[0] - 0.05, gaps);
  slab(b, F, L / 2, L40.cornice[0], L - 0.04, 0.2, 0.2, 'stone');
  slab(b, F, L / 2, L40.cornice[0] + 0.2, L, L40.cornice[1] - L40.cornice[0] - 0.2, 0.42, 'stone');
  for (const t of [0.35, L - 0.35]) { anchor(b, F, t, hY(205)); anchor(b, F, t, hY(345)); }
}

/** The canted corner: a glazed door between carved consoles, the bust under the corbel, the oriel turret and its spire. */
function corner(b: BuildingTools) {
  const F = FC, L = EC.len, tc = L / 2;
  slab(b, F, tc, 0, L - 0.1, 4.3, 0.12, 'stone');
  slab(b, F, tc, 0.05, 0.95, 2.6, 0.2, 'concrete'); // white door case
  slab(b, F, tc, 0.12, 0.75, 2.4, 0.25, 'glass');
  slab(b, F, tc, 2.7, 0.95, 0.5, 0.25, 'glass'); // transom light
  // carved consoles (atlantes) either side, rising to the corbel
  for (const s of [-1, 1]) {
    slab(b, F, tc + s * 0.68, 0, 0.42, 3.0, 0.3, 'greyBrick');
    slab(b, F, tc + s * 0.68, 3.0, 0.36, 1.3, 0.55, 'sandstone');
    slab(b, F, tc + s * 0.68, 3.55, 0.24, 0.45, 0.7, 'greyBrick'); // the figure's head under the corbel
  }
  // the bust in its niche on the corbel's face
  slab(b, F, tc, 4.35, 0.85, 1.05, 0.42, 'greyBrick');
  put(b, F, new T.SphereGeometry(0.17, 8, 6).translate(0, 0.62, 0), tc, 4.45, 0.78, 'concrete');
  slab(b, F, tc, 4.45, 0.42, 0.42, 0.62, 'concrete');
  setSink(0.04);
  cornerTurretOn(b, F, {
    plan: {sides: 8, apothem: 0.95, centre: [tc, -0.25]},
    stages: {corbel: [4.3, 5.85], body: [5.85, 12.0], drum: [12.0, 14.6], cone: {y: 14.6, rise: 3.6}, finial: 0.7},
    drumApothem: 0.82, coneApothem: 0.92,
    windows: [{y0: 6.25, y1: 8.35, arched: true, width: 0.6}, {y0: 9.05, y1: 11.0, arched: true, width: 0.6}],
    // the facet turned 45 deg towards the Keizersgracht faces the same way as that return, whose wall starts behind the
    // turret: the openings gate reads its lights as past the return's silhouette, so the front and Leidsestraat-side
    // facets carry the window rows
    windowOn: f => f.angle < 0.1,
    drumLights: [12.45, 13.95],
    // only the facets facing the street corner: the side facets stand beside the eaves walls and read as past them
    drumLightOn: f => Math.abs(f.angle) < 0.5,
    bands: [5.95, 8.75, 12.1, 14.3],
    colours: {wall: 'red', trim: 'pink', glass: 'glass', frame: 'pink', roof: 'copper', finial: 'bronze'},
  });
}
