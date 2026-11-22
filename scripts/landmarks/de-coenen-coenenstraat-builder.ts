import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, letters, poly, put, ringFrame, ringSlab, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './de-coenen-coenenstraat-footprints.json';

/**
 * DE COENEN, Johannes M. Coenenstraat 4, Nieuw-Zuid (BAG pand 0363100012085712, BAG 1923): a former municipal school,
 * now the buurtkamer De Coenen. Three storeys of buff brick under a steep tiled roof with flat roof lights; wide white
 * small-paned school windows in two tall storeys and a continuous band of seven windows between brick piers under the deep
 * white eaves; a dark blue-grey glazed-brick plinth; the entrance at the north-east end under a wrought-iron ornament, and
 * the recessed north-east bay with the "DE COENEN" letters and a dormer on the roof.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (street eaves 14.2 m, ridge 20.4 m with the flat top at 17.9 m; low rear wing
 * 2-3.6 m). Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 50 px/m, t in metres along each
 * facade-ring edge from the viewer's left (ringFrame), y up from the 3DBAG ground (the pavement at 930 px in the 2021 crop):
 *  - the street front (edge 22, w01-146): TMX7316010203-002118_pano_0000_000477 (2021, the sharpest, partly behind a tree)
 *    and TMX7316010203-002800_pano_0012_000005 (2022, washed out but unobstructed: roof lights and the top-floor piers);
 *  - the recessed north-east bay (edge 24, w07-146): TMX7316010203-002800_pano_0012_000008 (2022) and
 *    recording_2025-09-29_08-09-56_00231 (2025, the letters);
 *  - the south-west side (edge 21, w03-235, TMX7316010203-002118_pano_0000_000479 2021): the street end of the side wall;
 *  - the rear wing (edge 26, w05-326, TMX7316010203-002457_pano_0000_001842 2022): window group under the white canopy edge.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;
type Wall = {f: Frame; len: number};
const wall = (i: number): Wall => ringFrame(ring, i);

/** Storey lines on the street front (2021 crop, ground at 930 px): ground-floor windows 1.0-3.9 m, first floor 5.4-8.5 m,
 * the ledge at 10.1 m, the top-floor band 10.3-12.6 m, the white cornice 12.9 m, the eaves soffit 13.7 m. */
const GF: [number, number] = [1.0, 3.9], F1: [number, number] = [5.4, 8.5], F2: [number, number] = [10.3, 12.6];
const PLINTH = 0.9, EAVES = 13.75;
/** The street front is pale cream render over the brick (w01-146: 2021 and 2022 crops), the sides and the north-east bay buff
 *  brick (w03-235, w07-146): `sandstone` is the render's palette name (tagged stucco, material-slot-tags.ts). */
const RENDER = 'sandstone';
let reveal = 'brick';

export function buildDeCoenenCoenenstraat(_w: number, _d: number, b: BuildingTools) {
  B = b;
  const front = wall(22);
  addShell(b, src as never, {wall: 'brick', roof: 'red', roofFor: s => (isFlat(s) ? 'slate' : 'red'), wallFor: s => (onFront(s, front) ? RENDER : 'brick')});
  const sink0 = getSink();
  setSink(0.12, true);
  streetFront(wall(22));
  northEastBay(wall(24));
  southWestSide(wall(21));
  rearWing(wall(26));
  northEastSide(wall(25));
  rearBay(wall(18));
  roofLights(wall(22));
  setSink(sink0);
}

/** A 3DBAG wall surface standing in the street front's plane (within 0.35 m of edge 22's line, inside its length). */
function onFront(s: Surface, w: Wall) {
  return s.rings[0].every(p => {
    const dx = p[0] - w.f.origin[0], dz = p[2] - w.f.origin[1], t = dx * w.f.tangent[0] + dz * w.f.tangent[1];
    return Math.abs(dx * w.f.n[0] + dz * w.f.n[1]) < 0.35 && t > -0.4 && t < w.len + 0.4;
  });
}
function isFlat(s: Surface) {
  const ys = s.rings[0].map(p => p[1]);
  return Math.max(...ys) - Math.min(...ys) < 0.6;
}

// ---- kit -------------------------------------------------------------------------------------------------------------

/** Glazing bar: a box 4 cm deep standing on the pane's front face (16 cm proud of the shell). */
function bar(f: Frame, t: number, y: number, w: number, h: number, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(B, f, t, y, w, h, 0.04, 'frame', out);
  setSink(s0, true);
}
/**
 * A white school window of `lights` lights between 12 cm mullions: each light a small-paned upper part (2 x 2 panes over a
 * transom at 62 % of the height) and a 2 x 2 lower sash. The frame (10 cm) and glass (16 cm) sit in a brick reveal (jambs and head 27 cm proud
 * of the shell plane, glazing bars 20 cm), so the window reads set back behind the brick face.
 */
function schoolWindow(w: Wall, t0: number, t1: number, y0: number, y1: number, lights: number, o: {upperRows?: number; lowerRows?: number; reveal?: string} = {}) {
  const width = t1 - t0, h = y1 - y0, t = (t0 + t1) / 2, rv = o.reveal ?? reveal;
  slab(B, w.f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.1, 'frame', 0);
  slab(B, w.f, t, y0 + 0.05, width - 0.1, h - 0.1, 0.06, 'glass', 0.1);
  const lw = (width - 0.1) / lights, ur = o.upperRows ?? 2, lr = o.lowerRows ?? 2;
  for (let k = 0; k < lights; k++) {
    const lt = t0 + 0.05 + lw * (k + 0.5);
    if (k > 0) bar(w.f, t0 + 0.05 + lw * k, y0 + 0.05, 0.12, h - 0.1, 0.16);
    const grid = paneGrid({width: lw - 0.12, height: h - 0.1, cols: 2, rows: ur + lr, bar: 0.065, frame: 0, transomRows: [lr], transom: 0.14, rowWeights: [...Array(lr).fill(0.38 / lr), ...Array(ur).fill(0.62 / ur)]});
    for (const m of grid) bar(w.f, lt + m.x, y0 + 0.05 + m.y, m.w, m.h, 0.16);
  }
  for (const s of [-1, 1]) slab(B, w.f, t + s * (width / 2 + 0.12), y0 - 0.06, 0.12, h + 0.18, 0.27, rv);
  slab(B, w.f, t, y1 + 0.06, width + 0.36, 0.12, 0.27, rv);
  slab(B, w.f, t, y0 - 0.16, width + 0.3, 0.1, 0.3, 'stone');
}
/** The dark blue-grey glazed-brick plinth with its two lighter stripes (w07-146 alt: 880-930 px). */
function plinth(w: Wall, t0: number, t1: number) {
  slab(B, w.f, (t0 + t1) / 2, 0, t1 - t0, PLINTH, 0.1, 'greyBrick');
  for (const y of [0.3, 0.6]) slab(B, w.f, (t0 + t1) / 2, y, t1 - t0, 0.06, 0.16, 'stone');
}
/** Deep white eaves: the soffit board over a white cornice band. */
function eaves(w: Wall, t0: number, t1: number, y = EAVES) {
  slab(B, w.f, (t0 + t1) / 2, y - 0.85, t1 - t0, 0.14, 0.12, 'white');
  slab(B, w.f, (t0 + t1) / 2, y, t1 - t0 + 0.4, 0.45, 0.75, 'white');
}
/** Window band between brick piers on the top storey; the piers stand 6 cm proud. */
function topBand(w: Wall, centres: number[], width: number) {
  for (const c of centres) schoolWindow(w, c - width / 2, c + width / 2, F2[0], F2[1], 2, {upperRows: 1, lowerRows: 1});
  const piers = centres.slice(1).map((c, i) => (c + centres[i]) / 2);
  for (const p of [centres[0] - width / 2 - 0.25, ...piers, centres.at(-1)! + width / 2 + 0.25]) slab(B, w.f, p, F2[0] - 0.2, 0.42, F2[1] - F2[0] + 0.45, 0.1, reveal);
  slab(B, w.f, (centres[0] + centres.at(-1)!) / 2, F2[0] - 0.3, centres.at(-1)! - centres[0] + width + 0.9, 0.12, 0.1, 'stone');
}

// ---- fronts ----------------------------------------------------------------------------------------------------------

/**
 * Street front (edge 22, 25.7 m; 2021 crop at 50 px/m, x px / 50 = t): the blue side door (20-70 px), three ground-floor
 * windows (100-315, 410-630, 730-940 px; the middle one read from the 2022 crop), the entrance porch (1035-1200 px) under the iron ornament, a small window
 * (1230-1255 px); four first-floor windows (100-315, 410-630 of three lights, 730-895, 950-1115 px of two); seven top-floor windows centred
 * 162 ... 1052 px between brick piers (2022 crop).
 */
function streetFront(w: Wall) {
  reveal = RENDER;
  for (const [a, c] of [[0, 0.45], [1.65, 21.3], [23.5, w.len]]) plinth(w, a, c);
  // side door with a transom light (the 2021 crop's 20-70 px, moved 0.15 m in: the 3DBAG corner stands inside the BAG one)
  slab(B, w.f, 1.05, 0, 1.0, 2.3, 0.12, 'blue');
  slab(B, w.f, 1.05, 2.3, 1.2, 0.08, 0.14, 'frame');
  slab(B, w.f, 1.05, 2.38, 1.0, 0.6, 0.1, 'glass');
  for (const [a, c] of [[2.0, 6.3], [8.2, 12.6], [14.6, 18.8]]) schoolWindow(w, a, c, GF[0], GF[1], 3);
  for (const [a, c, n] of [[2.0, 6.3, 3], [8.2, 12.6, 3], [14.6, 17.9, 2], [19.0, 22.3, 2]]) schoolWindow(w, a, c, F1[0], F1[1], n, {upperRows: 3, lowerRows: 2});
  // entrance porch: the recess, the light over it, two notice boxes, the iron ornament
  slab(B, w.f, 22.35, 0, 1.9, 2.55, 0.03, 'dark', 0.1);
  // the porch is a recess: brick jambs 0.3 m deep either side and the white lintel over it
  for (const t of [21.33, 23.37]) slab(B, w.f, t, 0, 0.16, 2.55, 0.42, RENDER);
  slab(B, w.f, 22.4, 2.55, 2.6, 0.14, 0.3, 'white', 0.1);
  schoolWindow(w, 21.45, 23.35, 2.82, 3.3, 3, {upperRows: 1, lowerRows: 1});
  for (const t of [20.95, 23.85]) slab(B, w.f, t, 1.0, 0.55, 0.85, 0.12, 'ochre');
  ironOrnament(w, 22.4, 4.1);
  schoolWindow(w, 24.6, 25.1, 1.2, 2.4, 1, {upperRows: 1, lowerRows: 1});
  // the ledge under the top floor and the top-floor band
  topBand(w, [3.24, 6.2, 9.2, 12.1, 15.1, 18.04, 21.04], 2.45);
  eaves(w, -0.2, w.len + 0.2);
  reveal = 'brick';
}

/** Wrought-iron ornament over the entrance (2021: 1080-1160 px, 705-745 px): a lamp-shaped openwork of bars, simplified. */
function ironOrnament(w: Wall, t: number, y: number) {
  const out = 0.15;
  slab(B, w.f, t, y + 0.38, 1.6, 0.04, 0.04, 'dark', out);
  for (const dt of [-0.6, -0.2, 0.2, 0.6]) slab(B, w.f, t + dt, y, 0.03, 0.4, 0.03, 'dark', out);
  for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(0.85, 0.03, 0.03).rotateZ(s * 0.45).translate(0, 0, out + 0.015);
    put(B, w.f, g, t + s * 0.38, y + 0.2, 0, 'dark');
  }
  slab(B, w.f, t, y - 0.05, 0.5, 0.06, 0.25, 'dark');
  for (const s of [-1, 1]) slab(B, w.f, t + s * 0.8, y - 1.2, 0.04, 1.6, 0.04, 'dark', 0.06);
}

/** The recessed north-east bay (edge 24, 6.51 m; w07-146 alt at 50 px/m: windows 40-255 px on every storey). */
function northEastBay(w: Wall) {
  plinth(w, 0, w.len);
  schoolWindow(w, 0.8, 5.1, GF[0], 3.2, 4, {upperRows: 2, lowerRows: 1});
  letters(B, w.f, 'DE COENEN', 2.95, 3.55, 0.06, 0.05, 0.04, 'blue', 0.05);
  schoolWindow(w, 0.8, 5.1, F1[0], F1[1], 3, {upperRows: 3, lowerRows: 2});
  slab(B, w.f, w.len / 2, 10.05, w.len - 0.2, 0.12, 0.1, 'stone');
  schoolWindow(w, 0.8, 5.1, F2[0], F2[1], 3, {upperRows: 1, lowerRows: 1});
  eaves(w, -0.2, w.len + 0.2);
  // the white dormer on the roof over the bay (alt: 65-225 px wide; its window 140-225 px = 14.1-15.8 m): front flush with
  // the wall over the eaves board and reaching 2 m back into the slope (the window clears the 3DBAG roof plane, 14.3 m there)
  const set = -0.05;
  slab(B, w.f, 2.95, EAVES + 0.2, 3.4, 2.15, 1.95, 'concrete', set - 1.95);
  schoolWindow({f: offset(w.f, set), len: w.len}, 1.4, 4.5, EAVES + 0.65, EAVES + 2.0, 3, {upperRows: 1, lowerRows: 1, reveal: 'concrete'});
  slab(B, w.f, 2.95, EAVES + 2.35, 3.7, 0.15, 2.15, 'concrete', set - 2.05);
}
const offset = (f: Frame, out: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * out, f.origin[1] + f.n[1] * out]});

/** The south-west side's exposed street end (edge 21, t 8.9-17.46 m from the north-west; w03-235 2021): two window columns. */
function southWestSide(w: Wall) {
  plinth(w, 9.0, w.len);
  for (const c of [11.3, 14.9]) {
    schoolWindow(w, c - 1.3, c + 1.3, GF[0], GF[1], 2);
    schoolWindow(w, c - 1.3, c + 1.3, F1[0], F1[1], 2, {upperRows: 3, lowerRows: 2});
    schoolWindow(w, c - 1.2, c + 1.2, F2[0], F2[1], 2, {upperRows: 1, lowerRows: 1});
  }
  slab(B, w.f, 13.2, 10.05, 8.4, 0.12, 0.1, 'stone');
  eaves(w, 9.0, w.len + 0.2);
}

/** The low rear wing (edge 26, w05-326 2022): a two-tier window group and the white canopy edge along its roof. */
function rearWing(w: Wall) {
  const top = roofTop(w);
  schoolWindow(w, w.len / 2 - 1.5, w.len / 2 + 1.5, 1.1, Math.min(top - 0.5, 2.9), 3, {upperRows: 1, lowerRows: 2});
  slab(B, w.f, w.len / 2, top - 0.25, w.len + 0.2, 0.3, 0.45, 'concrete');
  plinth(w, 0, w.len);
}
function roofTop(w: Wall) {
  const x = w.f.origin[0] + w.f.tangent[0] * w.len / 2 - w.f.n[0] * 0.4, z = w.f.origin[1] + w.f.tangent[1] * w.len / 2 - w.f.n[1] * 0.4;
  return roofHeightAt(src.surfaces, x, z) ?? 3;
}

/** Eight flat roof lights on the street slope (2022 crop: 145, 285, 430, 570, 640, 778, 925, 1068 px), 1.6 m up the slope. */
function roofLights(w: Wall) {
  for (const t of [2.9, 5.7, 8.6, 11.4, 12.8, 15.6, 18.5, 21.4]) {
    const at = (d: number) => {
      const x = w.f.origin[0] + w.f.tangent[0] * t - w.f.n[0] * d, z = w.f.origin[1] + w.f.tangent[1] * t - w.f.n[1] * d;
      return {x, z, y: roofHeightAt(src.surfaces, x, z)};
    };
    const p0 = at(1.2), p1 = at(2.2);
    if (p0.y === null || p1.y === null) continue;
    const slope = Math.atan2(p1.y - p0.y, 1.0);
    const g = new T.BoxGeometry(1.05, 0.1, 0.95).rotateX(slope).translate(0, 0.06, 0);
    put(B, offset(w.f, -1.7), g, t, (p0.y + p1.y) / 2, 0, 'glass');
  }
}

/** Round brick roundel with a white triangle (the school's emblem; w02-56, w10-56): a white ring, a dark disc, a triangle. */
function roundel(w: Wall, t: number, y: number) {
  ringSlab(B, w.f, t, y, 0.26, 0.34, 0.08, 'frame');
  disc(B, w.f, t, y, 0.27, 0.04, 'greyBrick');
  poly(B, w.f, t, y, [[-0.17, -0.12], [0.17, -0.12], [0, 0.18]], 0.06, 'frame');
}

/**
 * The north-east side to the pavement (edge 25, exposed t 0-15.7 m from the street end; w02-56 aimed thumbnail, about 15.7 m
 * over 1000 px, ground at 850 px): low window bands behind brick piers on the ground floor, the round-arched side door, the
 * big two-tier window, the school roundel, and the staggered stair windows at half-landings up the street end. Simplified:
 * the only view is 54 deg oblique and the heights are read from the aimed thumbnail.
 */
function northEastSide(w: Wall) {
  plinth(w, 0, 15.7);
  const band = (t0: number, t1: number, n: number) => {
    const lw = (t1 - t0) / n;
    for (let k = 0; k < n; k++) schoolWindow(w, t0 + lw * k + 0.12, t0 + lw * (k + 1) - 0.12, 1.45, 3.0, 1, {upperRows: 1, lowerRows: 2});
  };
  band(0.15, 1.6, 2); band(4.0, 8.5, 6); band(11.5, 15.6, 5);
  // round-arched side door in a brick arch reveal
  archSlab(B, w.f, 2.75, 0, 1.0, 2.6, 0.04, 'blue', 0);
  archBand(B, w.f, 2.75, 0, 1.3, 2.75, 0.15, 0.2, 'brick', 0);
  roundel(w, 2.7, 6.3);
  schoolWindow(w, 2.3, 3.15, 4.1, 5.3, 1, {upperRows: 2, lowerRows: 1});
  // the big two-tier window: five upper lights over a wide lower light
  schoolWindow(w, 4.0, 8.0, 6.35, 7.8, 5, {upperRows: 1, lowerRows: 1});
  schoolWindow(w, 4.0, 8.0, 4.5, 6.2, 2, {upperRows: 1, lowerRows: 1});
  schoolWindow(w, 11.0, 12.7, 6.9, 7.9, 4, {upperRows: 1, lowerRows: 1});
  // stair and upper windows (thumbnail px -> m)
  for (const [a, c, y0, y1] of [[0.2, 1.4, 4.0, 6.0], [0.2, 1.4, 7.0, 8.8], [0.2, 1.4, 9.4, 11.1], [0.2, 1.4, 11.7, 12.9], [2.3, 3.1, 7.9, 9.6], [2.3, 3.1, 10.6, 12.1],
    [4.0, 5.2, 8.6, 10.4], [4.0, 5.2, 11.5, 13.1], [6.3, 7.7, 9.3, 11.2], [6.3, 7.7, 12.4, 13.6], [9.2, 10.9, 10.0, 12.1]]) {
    schoolWindow(w, a, c, y0, y1, c - a > 1.3 ? 2 : 1, {upperRows: 2, lowerRows: 1});
  }
}

/** The rear's canted bay (edge 18, w08-326 2021): two storeys of white windows in a bay 0.8 m deep under a flat white top. */
function rearBay(w: Wall) {
  const c = w.len / 2;
  slab(B, w.f, c, 0, 3.2, 6.2, 0.8, 'brick');
  for (const [y0, y1] of [[1.0, 2.9], [3.6, 5.6]]) schoolWindow({f: offset(w.f, 0.8), len: w.len}, c - 1.3, c + 1.3, y0, y1, 3, {upperRows: 2, lowerRows: 1});
  slab(B, w.f, c, 6.2, 3.5, 0.2, 1.0, 'white');
}
