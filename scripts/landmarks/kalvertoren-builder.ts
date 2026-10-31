/**
 * Kalvertoren (since 2017 Kalverpassage), Singel 451-463 / Kalverstraat 218-222 / Heiligeweg passage (BAG pand
 * 0363100012165086, 1997; Pi de Bruijn with George de Jong, 1995-97, Wikipedia nl:Kalverpassage, CC BY-SA 4.0).
 * Every part below comes from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed in
 * scripts/landmarks/kalvertoren-inventory.json and scripts/landmarks/kalvertoren-brief.md, or from the cited text;
 * nothing is described from memory.
 *
 *  - Singel, w04 + w01 (48.6 m): a red-brick neo-Renaissance range of three storeys over a grey stone plinth, white
 *    bands at sill, mid-light and head height, segmental relieving arches with white keystones, a cornice of white
 *    blocks at 13.2-13.9 m; two identical stepped gables (lower storey with three arched lights and a balcony, scroll
 *    claws, neck with one window, segmental top, gilt balls); three portals (the Amsterdam arms over a round-arched
 *    door, the wide segmental passage arch, a pedimented door); a concrete colonnade on the roof behind the cornice
 *    with glass sawtooth gables behind it. Storey lines on w01-192L (2021, street level, 41.6 px/m).
 *  - Singel, w03 (26.8 m): the pale natural-stone block, three bays in three groups, large first-floor windows in deep
 *    reveals, French windows with glass balustrades on storeys 2 and 3, projecting string courses, a stone cornice at
 *    17.4 m, and on its roof the semicircular glazed attic with a dark shallow cap (the "crown" seen from the Singel
 *    and the Munt: w03-190, crown-singel-265, crown-munt-310). The block's tall Singel entrance under its east group.
 *  - Kalverstraat, w06 + w02: two grey-brown brick blocks (19 m and 16 m) with deep-set paired windows, balconies with
 *    glass parapets, a two-storey passage portal between them on two stone-clad columns with the illuminated lattice
 *    ceiling and the vertical KALVERPASSAGE sign (Wikipedia: "De gevels aan de twee hoofdingangen werden hoger").
 *  - Kalverstraat, w05 (10 m): the narrow dark glass curtain front with grey spandrels over a dark stone shop storey.
 *  - Heiligeweg, w07: the passage mouth behind the Rasphuispoort (a separate additive model on this pand) under the
 *    diamond-lattice glass canopy; the mouth stays open below 6.4 m.
 *  - The glass tower in the middle of the block (Wikipedia: "de 30 meter hoge glazen toren in het midden van het
 *    centrum", with a cafe at the top): 3DBAG roofs 29-31 m, a 9.2 m radius circle; no panorama sees its shaft, so
 *    the shaft is inferred from the text; its dark cap is seen over the stone block from the Munt side.
 *  - The rest (courtyard walls, atrium roof at 10 m, sawtooth glass and tile roofs, rear party walls) is the 3DBAG
 *    LoD2.2 shell (CC BY 4.0), classed per surface in scripts/landmarks/kalvertoren-prepare.ts.
 *
 * Frame: x east, z south, y up from the 3DBAG ground (0.40 m NAP), origin = the BAG ring vertex average.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {planarPolygon} from './worship-shell';
import {setSink, slab, put, type Frame} from './nearbar-kit';
import plan from './kalvertoren-footprints.json';

type V = [number, number];
type C = string;
type Face = {P: V; d: V; n: V; len: number};
let b: BuildingTools;
const F = plan.faces as Record<'singelW' | 'singelE' | 'stone' | 'kalverS' | 'kalver' | 'kalverN' | 'heilige', Face>;

/** A wall frame whose t runs along the face from its first BAG vertex (mirrored when the tangent opposes d). */
type W = {fr: Frame; s: number; f: Face};
function wall(f: Face): W {
  const tangent: V = [f.n[1], -f.n[0]], s = Math.sign(tangent[0] * f.d[0] + tangent[1] * f.d[1]);
  return {fr: {origin: f.P, tangent, n: f.n}, s, f};
}
const sl = (w: W, t: number, y: number, wd: number, h: number, d: number, c: C, out = 0) => slab(b, w.fr, w.s * t, y, wd, h, d, c as never, out);
/** Ledge strips are front + top only; split long ones into <= 12 m pieces so their open outline stays short (audit: holes). */
function ls(w: W, t: number, y: number, wd: number, h: number, d: number, c: C, out = 0) {
  const n = Math.max(1, Math.ceil(wd / 12)), pw = wd / n;
  for (let i = 0; i < n; i++) slab(b, w.fr, w.s * (t - wd / 2 + pw * (i + 0.5)), y, pw - 0.01, h, d, c as never, out);
}
const pt = (w: W, g: T.BufferGeometry, t: number, y: number, out: number, c: C) => put(b, w.fr, g, w.s * t, y, out, c as never);
const at = (f: Face, t: number, v: number): V => [f.P[0] + f.d[0] * t + f.n[0] * v, f.P[1] + f.d[1] * t + f.n[1] * v];

/* ===================================================================================== Singel brick range (w04, w01) */
/** Storey lines on w01-192L (street level, 2021): plinth, window rows, bands, cornice. */
export const BR = {
  plinth: 1.1, g: [1.6, 4.6], f1: [6.3, 9.2], f2: [10.7, 12.85], cornice: [13.2, 13.9],
  bands: [1.48, 3.1, 4.62, 6.18, 7.8, 9.22, 10.58, 11.75, 12.86],
} as const;
const WIN_W = 1.45;
/** Bay centres measured on w04-192 and w01-192L (pitch 2.8 m). */
const BAYS_W = [1.6, 4.4, 7.2, 10.0, 12.8];
const BAYS_E = [0.77, 3.65, 6.6, 9.5, 12.3, 15.0, 17.8, 20.8, 23.4, 25.95, 28.6, 31.2];

function sash(w: W, t: number, y0: number, y1: number) {
  sl(w, t, y0, WIN_W - 0.08, y1 - y0, 0.05, 'glass');   // glass 4 cm behind the white band fronts (audit: zfight)
  sl(w, t, y0 + (y1 - y0) * 0.68, WIN_W, 0.07, 0.12, 'frame');       // transom
  sl(w, t, y0, 0.07, y1 - y0, 0.12, 'frame');                          // centre bar
  for (const sd of [-1, 1]) sl(w, t + sd * (WIN_W / 2 - 0.04), y0, 0.08, y1 - y0, 0.12, 'frame');
}
/** Segmental relieving arch over a window: a brick arch band with a white keystone (w01-192L). */
function relieving(w: W, t: number, y: number) {
  pt(w, segmentBand(WIN_W + 0.5, 0.55, 0.22, 0.06), t, y, 0, 'brick');
  sl(w, t, y + 0.3, 0.26, 0.42, 0.1, 'white');
}
/** Segmental arch band (chord `wd`, rise `rise`, ring `th`), extruded `d` out of the wall. */
function segmentBand(wd: number, rise: number, th: number, d: number) {
  const r = (wd * wd / 4 + rise * rise) / (2 * rise), cy = rise - r, a = Math.asin(wd / 2 / r), s = new T.Shape();
  s.absarc(0, cy, r, Math.PI / 2 + a, Math.PI / 2 - a, true);
  s.absarc(0, cy, r - th, Math.PI / 2 - a, Math.PI / 2 + a, false);
  return new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 6});
}
function segmentSlab(wd: number, rise: number, d: number) {
  const r = (wd * wd / 4 + rise * rise) / (2 * rise), cy = rise - r, a = Math.asin(wd / 2 / r), s = new T.Shape();
  s.moveTo(-wd / 2, 0); s.absarc(0, cy, r, Math.PI / 2 + a, Math.PI / 2 - a, true); s.lineTo(wd / 2, 0); s.lineTo(-wd / 2, 0);
  return new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 8});
}
/** A scroll claw beside a gable step: a quarter-round white stone piece, `side` -1 left / +1 right of the step. */
function claw(w: W, t: number, y: number, wd: number, h: number, side: number) {
  const s = new T.Shape(), x0 = 0, x1 = side * wd;
  s.moveTo(x0, 0); s.lineTo(x1, 0); s.quadraticCurveTo(x1 * 0.15, h * 0.15, x0, h); s.lineTo(x0, 0);
  const g = new T.ExtrudeGeometry(s, {depth: 0.45, bevelEnabled: false, curveSegments: 5});
  if (side < 0) flipWinding(g);
  pt(w, g, t, y, -0.25, 'stone');
  // the curl at the foot
  pt(w, new T.CylinderGeometry(0.16, 0.16, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.22), t + side * (wd - 0.12), y + 0.16, -0.25, 'stone');
}
function flipWinding(g: T.BufferGeometry) {
  const ni = g.index ? g.toNonIndexed() : g, p = ni.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) for (const k of [0, 1, 2]) { const tmp = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, tmp); }
  if (g.index) { g.setIndex(null); g.setAttribute('position', p); }
  g.computeVertexNormals();
}
const ball = (w: W, t: number, y: number, r = 0.2, out = 0.1) => pt(w, new T.SphereGeometry(r, 8, 6), t, y + r, out, 'gold');

/** One of the two identical stepped gables (w04 centre t 7.15, w01 t 26.05): measured on w04-192 and w01-192L. */
function gable(w: W, tc: number) {
  const lw = 9.4, nw = 3.8, y0 = BR.cornice[1], yL = 17.4, yN = 20.6;
  // lower storey: brick mass 1.0 m deep, white bands, three arched lights, balcony
  sl(w, tc, y0, lw, yL - y0, 1.0, 'brick', -1.0);
  ls(w, tc, y0 + 0.08, lw + 0.1, 0.16, 0.08, 'white');
  ls(w, tc, 16.25, lw + 0.1, 0.14, 0.07, 'white');
  sl(w, tc, yL - 0.18, lw + 0.4, 0.34, 1.15, 'stone', -0.95);                 // gable storey cornice 17.2-17.55
  pt(w, archGlass(1.5, 2.6), tc, 14.05, 0, 'glass');
  pt(w, new T.ExtrudeGeometry(archRing(1.5, 2.6, 0.18), {depth: 0.09, bevelEnabled: false, curveSegments: 8}), tc, 14.05, 0, 'white');
  sl(w, tc, 14.05, 1.7, 0.08, 0.32, 'dark'); sl(w, tc, 14.75, 1.7, 0.06, 0.32, 'dark');   // balcony rails
  for (let k = 0; k <= 6; k++) sl(w, tc - 0.8 + k * 0.267, 14.1, 0.03, 0.66, 0.03, 'dark', 0.28);
  for (const sd of [-1, 1]) {
    pt(w, archGlass(0.65, 1.25), tc + sd * 2.35, 14.9, 0, 'glass');
    pt(w, new T.ExtrudeGeometry(archRing(0.65, 1.25, 0.12), {depth: 0.08, bevelEnabled: false, curveSegments: 6}), tc + sd * 2.35, 14.9, 0, 'white');
    // the lower scroll claws on the main cornice, outside the gable storey, and gilt balls on the storey corners
    claw(w, tc + sd * lw / 2, y0, 1.25, 1.65, sd * w.s);
    ball(w, tc + sd * (lw / 2 - 0.2), yL + 0.16, 0.22);
  }
  // neck
  sl(w, tc, yL + 0.16, nw, yN - yL - 0.16, 1.0, 'brick', -1.0);
  ls(w, tc, 19.45, nw + 0.06, 0.15, 0.07, 'white');
  sl(w, tc, 17.95, 0.95, 1.35, 0.05, 'glass');
  sl(w, tc, 17.85, 1.15, 0.1, 0.12, 'white'); sl(w, tc, 19.3, 1.15, 0.12, 0.12, 'white');
  for (const sd of [-1, 1]) sl(w, tc + sd * 0.53, 17.95, 0.1, 1.35, 0.1, 'white');
  pt(w, segmentBand(2.4, 0.45, 0.16, 0.06), tc, 19.65, 0, 'brick');            // blind relieving arch in the neck
  for (const sd of [-1, 1]) claw(w, tc + sd * nw / 2, yL + 0.16, 1.0, 1.55, sd * w.s);
  sl(w, tc, yN, nw + 0.5, 0.38, 1.15, 'stone', -0.95);                        // neck cornice 20.6-21.0
  // segmental top with a round oculus boss, pedestal and gilt finial; gilt balls on the neck corners
  pt(w, segmentSlab(3.0, 0.85, 0.5), tc, yN + 0.38, -0.3, 'stone');
  sl(w, tc, yN + 0.38 + 0.82, 0.42, 0.3, 0.42, 'stone', -0.1);
  ball(w, tc, yN + 0.38 + 1.12, 0.2);
  for (const sd of [-1, 1]) ball(w, tc + sd * (nw / 2 + 0.05), yN + 0.38, 0.18);
}
function archGlass(wd: number, h: number) {
  const s = new T.Shape(), r = wd / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return new T.ExtrudeGeometry(s, {depth: 0.05, bevelEnabled: false, curveSegments: 8});
}
function archRing(wd: number, h: number, th: number) {
  const r = wd / 2 + th, ri = wd / 2, s = new T.Shape();
  s.moveTo(-r, h - ri); s.absarc(0, h - ri, r, Math.PI, 0, true); s.lineTo(ri, h - ri); s.absarc(0, h - ri, ri, 0, Math.PI, false); s.lineTo(-r, h - ri);
  return s;
}

/** The brick front of one Singel face: wall, plinth, bands, windows, arches and the white-block cornice. */
function brickFront(w: W, bays: number[], skip: {g: number[]; f1: number[]; f2: number[]}) {
  const L = w.f.len;
  sl(w, L / 2, 0, L, BR.cornice[1], 0.5, 'brick', -0.5);
  sl(w, L / 2, 0, L + 0.02, BR.plinth, 0.12, 'sandstone');
  for (const y of BR.bands) ls(w, L / 2, y, L, 0.14, 0.09, 'white');
  for (const t of bays) {
    if (!skip.g.includes(t)) { sash(w, t, BR.g[0], BR.g[1]); relieving(w, t, BR.g[1] + 0.12); }
    if (!skip.f1.includes(t)) { sash(w, t, BR.f1[0], BR.f1[1]); relieving(w, t, BR.f1[1] + 0.12); }
    if (!skip.f2.includes(t)) sash(w, t, BR.f2[0], BR.f2[1]);
  }
  // cornice: brick frieze with white blocks every 0.7 m (w01-192L 13.2-13.65), white coping
  for (let t = 0.35; t < L - 0.2; t += 0.7) sl(w, t, BR.cornice[0] + 0.05, 0.34, 0.42, 0.1, 'white');
  sl(w, L / 2, BR.cornice[1] - 0.22, L, 0.24, 0.24, 'white');
}

/** The Amsterdam arms over the west portal of w01 (gold lions, red shield with the black pale and three white saltires, gold crown; w01-192, 2017). */
function arms(w: W, t: number) {
  const y0 = 5.45;
  sl(w, t, y0, 0.8, 1.0, 0.16, 'pink', 0.12);
  sl(w, t, y0, 0.26, 1.0, 0.04, 'dark', 0.28);
  for (const k of [0, 1, 2]) for (const a of [Math.PI / 4, -Math.PI / 4]) pt(w, new T.BoxGeometry(0.22, 0.05, 0.03).rotateZ(a).translate(0, 0.0, 0.015), t, y0 + 0.2 + k * 0.3, 0.32, 'white');
  for (const sd of [-1, 1]) {
    pt(w, new T.CylinderGeometry(0.2, 0.24, 1.15, 6).translate(0, 0.58, 0), t + sd * 0.62, y0 - 0.05, 0.22, 'gold');
    pt(w, new T.SphereGeometry(0.17, 6, 5), t + sd * 0.55, y0 + 1.2, 0.24, 'gold');
  }
  sl(w, t, y0 + 1.05, 0.75, 0.22, 0.22, 'gold', 0.1);
  for (const k of [-1, 0, 1]) pt(w, new T.SphereGeometry(0.07, 6, 4), t + k * 0.28, y0 + 1.33, 0.2, 'gold');
}
function cartouche(w: W, t: number, y: number, wd: number, h: number) {
  sl(w, t, y, wd, h, 0.1, 'white');
  sl(w, t, y + h * 0.25, wd * 0.7, h * 0.5, 0.04, 'white', 0.1);
}

function singel() {
  const ww = wall(F.singelW), we = wall(F.singelE);
  // w04: the garage/bicycle opening under the gable (t 4.3-10.7, 0-4.6) replaces three ground bays
  brickFront(ww, BAYS_W, {g: [4.4, 7.2, 10.0], f1: [], f2: []});
  sl(ww, 7.5, 0, 6.4, 4.55, 0.2, 'dark');
  sl(ww, 7.5, 4.55, 6.7, 0.22, 0.16, 'white');
  for (const sd of [-1, 1]) sl(ww, 7.5 + sd * 3.3, 1.1, 0.3, 3.45, 0.14, 'white');
  cartouche(ww, 7.15, 5.0, 2.0, 0.9);
  pt(ww, segmentSlab(1.6, 0.35, 0.12), 7.15, 5.9, 0, 'white');
  gable(ww, 7.15);
  // w01: three portals; plaques in place of the storey-2 windows at t 20.8 and 31.2
  brickFront(we, BAYS_E, {g: [6.6, 15.0, 17.8, 25.95], f1: [], f2: [20.8, 31.2]});
  for (const t of [20.8, 31.2]) cartouche(we, t, 12.1, 1.2, 0.55);
  // west portal with the arms (t 5.2-7.9)
  sl(we, 6.55, 0, 2.7, 5.2, 0.16, 'white');
  pt(we, archGlass(1.1, 4.3).scale(1, 1, 1.6), 6.55, 0, 0.16, 'dark');
  sl(we, 6.55, 5.05, 3.0, 0.2, 0.3, 'white');
  arms(we, 6.55);
  // the passage arch (t 14.6-18.1): white voussoirs on a segmental opening
  pt(we, segmentSlab(3.5, 1.0, 0.2), 16.35, 3.2, 0, 'dark');
  sl(we, 16.35, 0, 3.5, 3.2, 0.2, 'dark');
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.18 + 0.64 * k / 6), r = 2.3;
    pt(we, new T.BoxGeometry(0.34, 0.55, 0.12).rotateZ(a - Math.PI / 2).translate(0, 0, 0.06), 16.35 + Math.cos(a) * r, 2.6 + Math.sin(a) * r - 0.1, 0, 'white');
  }
  for (const sd of [-1, 1]) sl(we, 16.35 + sd * 1.85, 0, 0.32, 3.4, 0.16, 'white');
  cartouche(we, 16.25, 5.55, 1.5, 0.55);
  // east portal (t 24.3-27.3): white surround, scrolled pediment, round-arched door
  sl(we, 25.8, 0, 3.0, 5.4, 0.16, 'white');
  pt(we, archGlass(1.2, 3.9).scale(1, 1, 1.6), 25.8, 0, 0.16, 'dark');
  pt(we, segmentSlab(3.2, 0.5, 0.3), 25.8, 5.4, 0, 'white');
  cartouche(we, 25.8, 5.6, 0.8, 0.5);
  gable(we, 26.05);
  colonnade(we);
}

/** The roof colonnade behind the cornice (w01-192 / w01-192L; pitch 2.85 m and 0.5 m set back from the two-camera parallax). */
function colonnade(w: W) {
  const y0 = BR.cornice[1], yb = 16.3, back = -0.5 - 0.3;
  for (let k = -5; k <= 2; k++) pt(w, new T.CylinderGeometry(0.27, 0.3, yb - y0, 10, 1, true).translate(0, (yb - y0) / 2, 0), 13.68 + 2.85 * k, y0, back, 'concrete');
  sl(w, 9.2, yb - 0.05, 24.4, 0.9, 0.6, 'concrete', back - 0.3);
}

/* ===================================================================================== Singel stone block (w03) */
/** Storey lines on w03-190L (2021) scaled to the 3DBAG cornice (x1.055). */
export const SB = {cornice: 17.4, g: [0.3, 3.55], f1: [4.85, 8.4], s1: 9.5, f2: [10.1, 13.1], s2: 13.45, f3: [13.95, 16.8]} as const;
const SB_BAYS = [2.0, 4.4, 6.8, 10.1, 12.5, 14.9, 19.2, 21.6, 24.0];
function stoneBlock() {
  const w = wall(F.stone), L = w.f.len;
  sl(w, L / 2, 0, L, SB.cornice, 0.6, 'stone', -0.6);
  // ground: two shopfronts and the tall Singel entrance with a small door
  for (const [t0, t1] of [[1.0, 7.6], [9.2, 15.8]]) {
    sl(w, (t0 + t1) / 2, SB.g[0], t1 - t0, SB.g[1] - SB.g[0], 0.05, 'glass');
    sl(w, (t0 + t1) / 2, 2.55, t1 - t0, 0.22, 0.12, 'dark');
    for (let t = t0; t <= t1 + 0.01; t += (t1 - t0) / 6) sl(w, t, SB.g[0], 0.08, SB.g[1] - SB.g[0], 0.1, 'dark');
    sl(w, (t0 + t1) / 2, SB.g[1], t1 - t0 + 0.4, 0.16, 0.3, 'stone');
  }
  sl(w, 20.4, 0, 3.9, 4.6, 0.05, 'dark');
  for (let k = 0; k <= 8; k++) sl(w, 18.45 + k * 3.9 / 8, 0, 0.04, 4.6, 0.04, 'frame', 0.06);
  sl(w, 24.3, 0, 1.0, 2.6, 0.06, 'dark');
  ls(w, L / 2, 3.75, L, 0.15, 0.1, 'stone');
  // first floor: large windows in deep reveals (jambs and head proud of the glass)
  for (const t of SB_BAYS) {
    sl(w, t, SB.f1[0], 1.8, SB.f1[1] - SB.f1[0], 0.04, 'glass');
    sl(w, t, SB.f1[0], 0.08, SB.f1[1] - SB.f1[0], 0.1, 'dark');
    for (const sd of [-1, 1]) sl(w, t + sd * 1.05, SB.f1[0] - 0.1, 0.3, SB.f1[1] - SB.f1[0] + 0.2, 0.32, 'stone');
    sl(w, t, SB.f1[1], 2.4, 0.22, 0.32, 'stone');
  }
  ls(w, L / 2, SB.s1, L, 0.35, 0.22, 'stone');
  ls(w, L / 2, SB.s2, L, 0.32, 0.16, 'stone');
  // storeys 2-3: French windows with glass balustrades on a dark rail
  for (const [y0, y1] of [SB.f2, SB.f3]) for (const t of SB_BAYS) {
    sl(w, t, y0, 1.5, y1 - y0, 0.04, 'glass');
    sl(w, t, y0, 0.07, y1 - y0, 0.09, 'dark');
    for (const sd of [-1, 1]) sl(w, t + sd * 0.78, y0, 0.08, y1 - y0, 0.09, 'dark');
    sl(w, t, y0 + 0.02, 1.62, 0.95, 0.03, 'concrete', 0.26);
    sl(w, t, y0 + 0.97, 1.66, 0.06, 0.08, 'dark', 0.22);
    sl(w, t, y1, 1.7, 0.18, 0.2, 'stone');
  }
  sl(w, L / 2, SB.cornice - 0.45, L + 0.3, 0.45, 0.42, 'stone');
  attic(w);
}
/** The semicircular glazed attic on the stone block with its dark shallow cap (w03-190: glazed band under a dark cap whose
 * eaves read as an arc from below; 3DBAG flat top 20.7-21.1 m, back chord near BAG y 716). */
function attic(w: W) {
  const R = 13.0, tcen = 13.5, vcen = -13.6, c = at(w.f, tcen, vcen), y0 = SB.cornice, yB = 19.0, yT = 20.9;
  const a0 = Math.atan2(w.f.n[1], w.f.n[0]);              // plan angle of the face normal (x, z)
  const seg = 20;
  // deck at the cornice: the dropped attic roof outlines, flattened
  for (const r of plan.atticDeck) { const g = planarPolygon([r.map(p => [p[0], plan.atticDeckY, p[2]])]); if (g) { upward(g); b.add(g, 'slate' as never); } }
  const arcPt = (k: number, r: number): V => { const a = a0 - Math.PI / 2 + Math.PI * k / seg; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; };
  // glazed band with posts
  for (let k = 0; k < seg; k++) {
    const p = arcPt(k, R), q = arcPt(k + 1, R), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n: V = [((p[0] + q[0]) / 2 - c[0]) / R, ((p[1] + q[1]) / 2 - c[1]) / R];
    const fr: Frame = {origin: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], tangent: [n[1], -n[0]], n};
    slab(b, fr, 0, y0, len + 0.02, yB - y0, 0.06, 'glass' as never, -0.06);
    slab(b, fr, len / 2, y0, 0.12, yB - y0, 0.14, 'dark' as never, -0.04);
  }
  // cap: a shallow cone from R + 0.35 at the eaves to R - 2.6 at the flat top, half round, then the flat half disc
  const pos: number[] = [];
  const P3 = (k: number, r: number, y: number) => { const [x, z] = arcPt(k, r); return [x, y, z]; };
  for (let k = 0; k < seg; k++) {
    const a = P3(k, R + 0.35, yB), bq = P3(k + 1, R + 0.35, yB), cc = P3(k + 1, R - 2.6, yT), d = P3(k, R - 2.6, yT);
    pos.push(...a, ...cc, ...bq, ...a, ...d, ...cc);
    const m = P3(k, 0, yT); const e = P3(k + 1, 0, yT);
    pos.push(...d, ...m, ...cc); void e;
  }
  const cap = new T.BufferGeometry(); cap.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); fixUp(cap); b.add(cap, 'bronze' as never);
  // underside at the eaves (facing down) and the vertical chord face, so the cap is a closed solid
  const under: number[] = [], cB = P3(0, 0, yB);
  for (let k = 0; k < seg; k++) under.push(...cB, ...P3(k, R + 0.35, yB), ...P3(k + 1, R + 0.35, yB));
  const ug = new T.BufferGeometry(); ug.setAttribute('position', new T.Float32BufferAttribute(under, 3)); fixUp(ug);
  { const p = ug.getAttribute('position') as T.BufferAttribute; for (let i = 0; i < p.count; i += 3) for (const k of [0, 1, 2]) { const t = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, t); } ug.computeVertexNormals(); }
  b.add(ug, 'bronze' as never);
  const chord: number[] = [];
  for (const k of [0, seg]) { const e = P3(k, R + 0.35, yB), f2 = P3(k, R - 2.6, yT), m = P3(k, 0, yT); chord.push(...cB, ...e, ...f2, ...cB, ...f2, ...m); }
  const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.Float32BufferAttribute(chord, 3)); cg.computeVertexNormals(); b.add(cg, 'bronze' as never);
  // eaves fascia
  for (let k = 0; k < seg; k++) {
    const p = arcPt(k, R + 0.35), q = arcPt(k + 1, R + 0.35), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n: V = [((p[0] + q[0]) / 2 - c[0]) / (R + 0.35), ((p[1] + q[1]) / 2 - c[1]) / (R + 0.35)];
    slab(b, {origin: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], tangent: [n[1], -n[0]], n}, 0, yB - 0.25, len + 0.04, 0.3, 0.06, 'bronze' as never, -0.06);
  }
  // back chord wall
  const e0 = arcPt(0, R + 0.35), e1 = arcPt(seg, R + 0.35), len = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
  const nb: V = [-w.f.n[0], -w.f.n[1]];
  slab(b, {origin: [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2], tangent: [nb[1], -nb[0]], n: nb}, 0, y0, len, yT - y0 + 0.1, 0.3, 'stone' as never, 0.06);
}
/** Orient every triangle of a non-indexed geometry to face up (+y), or outward for near-vertical faces. */
function fixUp(g: T.BufferGeometry) {
  const p = g.getAttribute('position') as T.BufferAttribute, A = new T.Vector3(), B = new T.Vector3(), C3 = new T.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C3.fromBufferAttribute(p, i + 2);
    if (B.clone().sub(A).cross(C3.clone().sub(A)).y < 0) for (const k of [0, 1, 2]) { const t = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, t); }
  }
  g.computeVertexNormals();
}
function upward(g: T.BufferGeometry) {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  if (!idx) { fixUp(g); return; }
  const A = new T.Vector3(), B = new T.Vector3(), C3 = new T.Vector3();
  for (let k = 0; k < idx.count; k += 3) {
    A.fromBufferAttribute(pos, idx.getX(k)); B.fromBufferAttribute(pos, idx.getX(k + 1)); C3.fromBufferAttribute(pos, idx.getX(k + 2));
    if (B.sub(A).cross(C3.sub(A)).y < 0) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
  }
  g.computeVertexNormals();
}

/* ===================================================================================== the glass tower */
function tower() {
  const {c, r, top} = plan.tower as {c: V; r: number; top: number};
  const y0 = plan.towerBase, yS = 28.4, seg = 28;
  for (const r of plan.towerDeck) { const g = planarPolygon([r]); if (g) { upward(g); b.add(g, 'slate' as never); } }
  b.add(new T.CylinderGeometry(r, r, 25.0 - y0, seg, 1, false), 'glass' as never, c[0], (y0 + 25.0) / 2, c[1]);
  b.add(new T.CylinderGeometry(r - 0.25, r - 0.25, yS - 25.0, seg, 1, false), 'canopyGlass' as never, c[0], (25.0 + yS) / 2, c[1]);   // the cafe storey
  for (const y of [13.6, 17.2, 20.8, 24.6]) b.add(new T.CylinderGeometry(r + 0.08, r + 0.08, 0.32, seg, 1, false), 'frame' as never, c[0], y, c[1]);
  b.add(new T.CylinderGeometry(r + 0.1, r + 0.1, 0.4, seg, 1, false), 'frame' as never, c[0], 25.0, c[1]);
  for (let k = 0; k < seg; k++) {
    const a = (k + 0.5) * Math.PI * 2 / seg, n: V = [Math.cos(a), Math.sin(a)];
    slab(b, {origin: [c[0] + n[0] * r, c[1] + n[1] * r], tangent: [n[1], -n[0]], n}, 0, y0, 0.1, yS - y0, 0.14, 'frame' as never, -0.04);
  }
  // crown: ring cornice and the dark shallow dome cap (3DBAG 29.0 at the rim, 30.9 at the top)
  b.add(new T.CylinderGeometry(r + 0.45, r + 0.45, 0.6, seg, 1, false), 'bronze' as never, c[0], yS + 0.3, c[1]);
  const prof: T.Vector2[] = [new T.Vector2(0.001, 0)]; for (let i = 0; i <= 6; i++) { const u = i / 6; prof.push(new T.Vector2(Math.max(0.001, (r + 0.4) * Math.cos(u * Math.PI / 2)), (top - yS - 0.6) * Math.sin(u * Math.PI / 2))); }
  b.add(new T.LatheGeometry(prof, seg), 'bronze' as never, c[0], yS + 0.6, c[1]);
}

/* ===================================================================================== Kalverstraat */
/** Storey lines on w02-46 (2021) moved -1.3 m to the 3DBAG roofs (19.0 left block, 16.0 right block). */
const KV = {open: 8.1, bal: [8.7, 9.8], rows: [[9.7, 11.4], [12.7, 14.5], [15.7, 17.4]], left: 19.25, right: 16.25} as const;
function deepWindow(w: W, t: number, y0: number, y1: number) {
  sl(w, t, y0, 1.15, y1 - y0, 0.04, 'glass');
  sl(w, t, y0, 0.07, y1 - y0, 0.09, 'dark');
  for (const sd of [-1, 1]) sl(w, t + sd * 0.72, y0 - 0.15, 0.3, y1 - y0 + 0.3, 0.3, 'greyBrick');
  sl(w, t, y1, 1.75, 0.18, 0.3, 'greyBrick');
  sl(w, t, y0 - 0.12, 1.4, 0.1, 0.12, 'stone');
}
function balcony(w: W, t0: number, t1: number) {
  sl(w, (t0 + t1) / 2, KV.bal[0], t1 - t0, 0.28, 1.0, 'stone');
  sl(w, (t0 + t1) / 2, KV.bal[0] + 0.28, t1 - t0, 0.82, 0.04, 'concrete', 0.95);
  for (const sd of [-1, 1]) sl(w, (t0 + t1) / 2 + sd * (t1 - t0) / 2, KV.bal[0] + 0.28, 0.04, 0.82, 0.95, 'concrete');
}
function kalverstraat() {
  const w = wall(F.kalver), ws = wall(F.kalverS);
  // left block (t 0-12.8) and its south return (w06, 7.5 m)
  sl(w, 3.45, 0, 6.9, KV.left, 0.5, 'greyBrick', -0.5);
  sl(w, 9.85, KV.open, 5.9, KV.left - KV.open, 0.5, 'greyBrick', -0.5);
  sl(ws, ws.f.len / 2, 0, ws.f.len, KV.left, 2.0, 'greyBrick', -2.0);   // a solid 2 m mass: no 3DBAG wall behind this short return
  sl(w, 3.15, 0.3, 4.7, 6.9, 0.05, 'glass'); sl(w, 3.15, 3.6, 4.7, 0.12, 0.1, 'dark'); sl(w, 3.15, 0.3, 0.08, 6.9, 0.1, 'dark');
  sl(ws, 2.9, 0.3, 3.8, 3.3, 0.05, 'glass'); sl(ws, 2.9, 3.4, 4.0, 0.5, 0.12, 'dark');
  for (const t of [1.6, 3.4, 5.2]) sl(ws, t, 4.6, 1.5, 2.8, 0.05, 'glass');
  sl(w, 0, 0, 0.6, KV.left, 0.18, 'stone');                                  // stone corner pier between w06 and w02
  balcony(w, 0.3, 5.6); balcony(w, 6.6, 11.9); balcony(ws, 0.6, 6.4);
  for (const row of KV.rows) {
    for (const t of [1.25, 3.05, 4.85, 7.7, 9.5, 11.25]) deepWindow(w, t, row[0], row[1]);
    for (const t of [1.6, 3.4, 5.2]) { sl(ws, t, row[0], 1.15, row[1] - row[0], 0.04, 'glass'); sl(ws, t, row[0], 0.07, row[1] - row[0], 0.09, 'dark'); sl(ws, t, row[0] - 0.12, 1.4, 0.1, 0.12, 'stone'); }
  }
  for (const y of [12.45, 15.45]) { ls(w, 6.4, y, 12.8, 0.1, 0.06, 'stone'); ls(ws, ws.f.len / 2, y, ws.f.len, 0.1, 0.06, 'stone'); }
  sl(w, 6.4, KV.left - 0.3, 13.0, 0.3, 0.3, 'stone'); sl(ws, ws.f.len / 2, KV.left - 0.3, ws.f.len + 0.2, 0.3, 0.3, 'stone');
  // right block (t 15-26.7)
  sl(w, 18.2, KV.open, 6.4, KV.right - KV.open, 0.5, 'greyBrick', -0.5);
  sl(w, 24.05, 0, 5.3, KV.right, 0.5, 'greyBrick', -0.5);
  balcony(w, 16.4, 21.6); balcony(w, 22.5, 26.0);
  for (const row of KV.rows.slice(0, 2)) for (const t of [17.3, 19.05, 20.8, 23.3, 25.1]) deepWindow(w, t, row[0], row[1]);
  ls(w, 20.8, 12.45, 11.7, 0.1, 0.06, 'stone');
  sl(w, 20.8, KV.right - 0.3, 11.9, 0.3, 0.3, 'stone');
  for (const t of [22.6, 24.6]) sl(w, t, 4.2, 1.1, 3.1, 0.05, 'glass');
  sl(w, 23.9, 0.3, 3.6, 3.3, 0.05, 'glass');
  // the passage portal (t 6.9-21.4, 0-8.1) on two stone-clad columns: recess, soffit with the lattice light ceiling
  const t0 = 6.9, t1 = 21.4, dep = 2.9;
  sl(w, (t0 + t1) / 2, 0, t1 - t0, KV.open, 0.1, 'glass', -dep);
  sl(w, (t0 + t1) / 2, KV.open - 0.25, t1 - t0, 0.25, dep, 'greyBrick', -dep);
  sl(w, (t0 + t1) / 2, KV.open - 1.3, t1 - t0 - 0.2, 0.06, dep - 0.4, 'canopyGlass', -dep + 0.2);
  for (const t of [t0, t1]) sl(w, t, 0, 0.25, KV.open, dep, 'greyBrick', -dep);
  for (const t of [12.1, 15.8]) pt(w, new T.CylinderGeometry(0.55, 0.55, KV.open, 12, 1, true).translate(0, KV.open / 2, 0), t, 0, -0.3, 'stone');
  // the gap between the blocks above the portal: glass link set back
  sl(w, 13.9, KV.open, 2.4, 13.0 - KV.open, 0.3, 'bronze', -0.9);
  sign(w, 14.0);
  kalverNarrow();
}
/** The vertical KALVERPASSAGE board in the gap (w02-46: about 0.75 m wide, 7.0-15.5 m), letters turned 90 degrees. */
function sign(w: W, t: number) {
  const y0 = 7.0, h = 8.5;
  sl(w, t, y0, 0.78, h, 0.22, 'bronze', -0.6);
  const text = 'KALVERPASSAGE', L = raisedLettering({text, heightM: 0.5, maxWidthM: h - 0.6, depthM: 0.04});
  const g = L.geometry; g.translate(-L.widthM / 2, -0.25, 0).rotateZ(-Math.PI / 2 * w.s);
  pt(w, g, t, y0 + h / 2, -0.4, 'stone');
}
/** w05: the narrow dark glass curtain front over a dark stone shop storey; a plain grey panel at its south end. */
function kalverNarrow() {
  const w = wall(F.kalverN), L = w.f.len, top = 17.0;
  sl(w, L / 2, 0, L, top, 0.4, 'dark', -0.4);
  sl(w, 1.1, 4.2, 2.2, top - 4.2, 0.12, 'concrete');
  sl(w, 6.2, 0.3, 6.6, 3.5, 0.05, 'glass');
  for (let y = 4.4; y < top - 0.5; y += 3.15) { sl(w, 6.17, y, 7.9, 1.6, 0.05, 'glass'); sl(w, 6.17, y + 1.6, 7.9, 1.5, 0.08, 'bronze'); }
  for (let t = 2.2; t <= L + 0.01; t += 7.94 / 6) sl(w, t, 4.2, 0.1, top - 4.2, 0.16, 'dark');
}

/* ===================================================================================== Heiligeweg passage mouth */
/** w07-331 (2023): the diamond-lattice glass canopy over the passage behind the Rasphuispoort; open below 6.4 m. */
function heiligeweg() {
  const w = wall(F.heilige), L = w.f.len, y0 = 6.4, y1 = 12.6;
  sl(w, L / 2, y0, L, y1 - y0 - 0.05, 0.04, 'canopyGlass', -0.6);
  sl(w, L / 2, y1 - 0.2, L, 0.2, 0.25, 'frame', -0.63);
  // the passage beyond the gate: side walls and a dark glazed back 3.5 m in (w07: shop windows along the passage)
  sl(w, L / 2, 0, L, y0, 0.1, 'glass', -3.6);
  for (const t of [0.45, L - 0.45]) sl(w, t, 0, 0.24, y1 - 0.06, 3.6, 'greyBrick', -3.6);

  const n = 4, step = L / n;
  for (let k = 0; k < n * 2; k++) for (const s of [-1, 1]) {
    const tc = (k + 0.5) * step / 2, yc = y0 + (y1 - y0) / 2, len = Math.hypot(step, (y1 - y0) / 2) * 1.0;
    if (tc < step / 2 || tc > L - step / 2) continue;
    pt(w, new T.BoxGeometry(0.06, len * 2, 0.05).rotateZ(s * Math.atan2(step, y1 - y0)).translate(0, 0, 0.025), tc, yc, -0.56, 'bronze');
  }
}

/* ===================================================================================== shell */
export function buildKalvertorenShell(tools: BuildingTools) {
  b = tools;
  for (const wl of plan.walls) { const g = planarPolygon([wl.ring]); if (g) b.add(g, wl.c as never); }
  for (const f of plan.partyFill as {a: V; b: V; h: number}[]) { const g = planarPolygon([[[f.a[0], 0, f.a[1]], [f.b[0], 0, f.b[1]], [f.b[0], f.h, f.b[1]], [f.a[0], f.h, f.a[1]]]]); if (g) b.add(g, 'greyBrick' as never); }
  for (const r of plan.roofs) { const g = planarPolygon(r.rings); if (g) { upward(g); b.add(g, r.c as never); } }
}

export function buildKalvertoren(_w: number, _d: number, tools: BuildingTools) {
  // fronts sit on the wall plane (no sink); glass and trim keep >= 3 cm from neighbouring faces instead (audit: zfight)
  b = tools; setSink(0);
  singel();
  stoneBlock();
  tower();
  kalverstraat();
  heiligeweg();
  buildKalvertorenShell(tools);
}
