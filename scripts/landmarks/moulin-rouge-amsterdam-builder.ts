import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import {signText, tube} from './wallen-theatres-kit';
import source from './moulin-rouge-amsterdam-footprints.json';

/**
 * THEATER MOULIN ROUGE, Oudezijds Achterburgwal 5-7, De Wallen (BAG pand 0363100012177983, BAG 1748; VBOs 5, 5-H, 5-1 and
 * 7 all in this one pand). A four-bay canal house of five storeys painted blue-black, cornice-topped, its theatre on the
 * ground floor: the red serif letters MOULIN ROUGE over three black display cases with red neon frames, the black hanging
 * sign with MOULIN Rouge on a bracket by the stoop door, the stoop with its steps and railings, and the souterrain doors
 * under a red-trimmed hood.
 *
 * No windmill sign is on the front in the 2024-2025 panoramas (front, oblique and both faces of the hanging sign rectified):
 * the hanging sign carries a line drawing of a figure over the lettering, which is left out (tasteful brief), and its
 * lettering is drawn.
 *
 * Read from the rectified Gemeente Amsterdam panoramas b_20250114_1026_Track06_Sphere_00006 (2025-01-14) and
 * recording_2025-06-30_05-16-46_01551 (2025-06-30) at 100 px/m on the BAG front line (facade ring edge 1, 7.9 m), the hanging
 * sign on its own plane from b_20250114_1026_Track05_Sphere_00014, recording_2025-07-03_03-29-47_02844 and
 * recording_2025-06-30_05-16-46_01546 (2025), the stoop and hood from the oblique recording_2025-06-30_05-16-46_01543. The
 * crops are datumed on 0.4 m NAP; heights here are over the 3DBAG ground (0.72 m NAP), so 0.32 m lower than the crop reads.
 * Per item in moulin-rouge-amsterdam-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const G = 0.32;
const h = (cropH: number) => +(cropH - G).toFixed(3);

/** Window axes (t from the viewer's left) and the frame width. */
const AXES = [1.4, 3.2, 5.12, 6.97];
const WIN = 1.22;

export function buildMoulinRougeAmsterdam(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const {f, len} = ringFrame(src.facadeRing, 1);
  const sink0 = getSink();
  setSink(0.12, true);
  cornice(b, f, len);
  windows(b, f);
  theatre(b, f);
  stoop(b, f);
  hangingSign(b, f);
  setSink(sink0);
}

/** Cream cornice 14.0-15.0 m (crop): frieze board, the main cornice and its projecting top moulding; the hoist-beam housing. */
function cornice(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, h(14.0), len - 0.1, 0.25, 0.1, 'stone');
  slab(b, f, len / 2, h(14.25), len - 0.1, 0.5, 0.28, 'stone');
  slab(b, f, len / 2, h(14.75), len + 0.1, 0.25, 0.45, 'stone');
  slab(b, f, 4.12, h(14.2), 0.35, 0.85, 0.52, 'brick');
  slab(b, f, 4.12, h(15.05), 0.45, 0.15, 0.6, 'stone');
}

/** A white timber window: frame, dark pane, glazing bars from paneGrid (shallower than wide). */
function win(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, o: {rows: number; weights?: number[]}) {
  const H = y1 - y0;
  slab(b, f, t, y0, WIN, H, 0.06, 'frame');
  slab(b, f, t, y0 + 0.08, WIN - 0.16, H - 0.16, 0.05, 'glass', 0.06);
  const s0 = getSink();
  setSink(0);
  for (const m of paneGrid({width: WIN - 0.16, height: H - 0.16, cols: 2, rows: o.rows, bar: 0.07, frame: 0, ...(o.weights ? {rowWeights: o.weights} : {})}))
    slab(b, f, t + m.x, y0 + 0.08 + m.y, m.w, m.h, 0.04, 'frame', 0.11);
  setSink(s0, true);
  // sill
  slab(b, f, t, y0 - 0.07, WIN + 0.1, 0.07, 0.12, 'frame');
}

/** Three upper storeys of four windows: 1st floor 2 x 2 with low upper lights, 2nd 2 x 3, top 2 x 2 (crop heights). */
function windows(b: BuildingTools, f: Frame) {
  for (const t of AXES) {
    win(b, f, t, h(5.75), h(7.85), {rows: 2, weights: [1.35, 0.75]});
    win(b, f, t, h(8.85), h(10.95), {rows: 3, weights: [0.67, 0.67, 0.75]});
    win(b, f, t, h(12.3), h(13.6), {rows: 2});
  }
}

/**
 * The theatre front: MOULIN ROUGE in red serif capitals (t 3.3-6.85 m, 5.0-5.45 m crop), three black display cases with red
 * neon frames (t 2.5-3.6, 4.47-5.57, 6.35-7.45 m; 2.05-4.55 m crop), the middle one with its neon MOULIN Rouge; the
 * souterrain doors (t 4.4-7.7 m) under a black hood with a red edge.
 */
function theatre(b: BuildingTools, f: Frame) {
  signText(b, f, 'MOULIN ROUGE', 5.07, h(5.02), 0, {width: 3.55, d: 0.08, colour: 'red'});
  for (const c of [3.05, 5.02, 6.9]) {
    const w = 1.1, y0 = h(2.05), y1 = h(4.55);
    slab(b, f, c, y0, w, y1 - y0, 0.16, 'bronze');
    slab(b, f, c, y0 + 0.06, w - 0.12, y1 - y0 - 0.12, 0.05, 'dark', 0.16);
    tube(b, f, [[c - w / 2 + 0.15, y0 + 0.15], [c + w / 2 - 0.15, y0 + 0.15], [c + w / 2 - 0.15, y1 - 0.15], [c - w / 2 + 0.15, y1 - 0.15]], 0.035, 0.045, 'pink', 0.21, true);
  }
  signText(b, f, 'MOULIN', 5.02, h(3.05), 0.21, {width: 0.6, d: 0.045, colour: 'pink'});
  signText(b, f, 'Rouge', 5.02, h(2.55), 0.21, {width: 0.5, d: 0.045, colour: 'pink'});
  // souterrain doors and the hood over them
  const d0 = 4.4, d1 = 7.7;
  slab(b, f, (d0 + d1) / 2, 0, d1 - d0, h(1.45), 0.05, 'dark');
  slab(b, f, (d0 + d1) / 2, h(1.45), d1 - d0 + 0.3, 0.17, 0.32, 'bronze');
  slab(b, f, (d0 + d1) / 2, h(1.45), d1 - d0 + 0.3, 0.04, 0.045, 'pink', 0.32);
  // the area railing in front of the basement window between the steps and the doors (t 3.3-4.3)
  tube(b, f, [[3.35, 1.0], [4.3, 1.0]], 0.04, 0.04, 'bronze', 0.9);
  for (let t = 3.4; t <= 4.31; t += 0.3) tube(b, f, [[t, 0], [t, 1.0]], 0.035, 0.035, 'bronze', 0.9);
}

/**
 * The stoop: the white-framed door (t 0.75-1.95 m) with its transom light, the grey stone landing in front of it (to 1.43 m
 * over the ground, 1.4 m deep), five steps down to the right (t 2.1-3.3 m) and the black railings along them.
 */
function stoop(b: BuildingTools, f: Frame) {
  const top = h(1.75), t0 = 0.75, t1 = 1.95, c = (t0 + t1) / 2;
  slab(b, f, c, top, t1 - t0, h(4.65) - top, 0.06, 'frame');
  slab(b, f, c, top, t1 - t0 - 0.2, h(4.15) - top - 0.05, 0.05, 'dark', 0.06);
  slab(b, f, c, h(4.15) + 0.03, t1 - t0 - 0.2, h(4.65) - h(4.15) - 0.13, 0.05, 'glass', 0.06);
  slab(b, f, c, h(4.15) - 0.04, t1 - t0 - 0.1, 0.07, 0.04, 'frame', 0.11);
  slab(b, f, c, h(4.15) + 0.03, 0.06, h(4.65) - h(4.15) - 0.13, 0.04, 'frame', 0.11);
  slab(b, f, 1.08, 0, 2.04, top, 1.4, 'concrete');
  const steps = 5;
  for (let k = 0; k < steps; k++) slab(b, f, 2.1 + 0.24 * (k + 0.5), 0, 0.26, top * (steps - k) / (steps + 1), 1.1, 'concrete');
  const rail = 0.95;
  tube(b, f, [[0.05, top + rail], [2.1, top + rail], [3.3, top / (steps + 1) + rail]], 0.04, 0.04, 'bronze', 1.3);
  for (const [t, y] of [[0.08, top], [2.1, top], [3.25, top / (steps + 1)]] as [number, number][]) tube(b, f, [[t, y], [t, y + rail]], 0.04, 0.04, 'bronze', 1.3);
}

/**
 * The hanging sign by the door (t 0.25 m): a black square board 0.8 x 1.0 m from 0.27 to 1.07 m off the wall, 4.58-5.58 m
 * over the ground, on an iron bracket; MOULIN in red capitals and Rouge in red script on both faces (the figure drawn over
 * them is left out).
 */
function hangingSign(b: BuildingTools, f: Frame) {
  const t = 0.25, y0 = 4.58, y1 = 5.58, s0 = 0.27, s1 = 1.07, th = 0.08;
  const P: [number, number] = [f.origin[0] + f.tangent[0] * t, f.origin[1] + f.tangent[1] * t];
  // bracket: the arm at the top and its wall plate, in the wall frame
  slab(b, f, t, y1 + 0.02, 0.05, 0.05, s1 + 0.08, 'bronze');
  slab(b, f, t, y1 - 0.3, 0.12, 0.42, 0.04, 'bronze');
  const sk = getSink();
  setSink(0);
  for (const side of [1, -1]) {
    // a frame on the board face: its normal along +-wall tangent, its own tangent derived from the normal (put() convention)
    const n: [number, number] = [f.tangent[0] * side, f.tangent[1] * side];
    const tan: [number, number] = [n[1], -n[0]];
    const sf: Frame = {origin: [P[0] + n[0] * th / 2, P[1] + n[1] * th / 2], tangent: tan, n};
    const along = f.n[0] * tan[0] + f.n[1] * tan[1]; // +1 or -1: board t runs out from the wall or toward it
    const st = (s: number) => s * along;
    if (side === 1) slab(b, sf, st((s0 + s1) / 2), y0, s1 - s0, y1 - y0, th, 'bronze', -th);
    for (let k = 0; k < 3; k++) slab(b, sf, st(s0 + 0.15 + k * 0.25), y1, 0.03, 0.04, 0.03, 'bronze', -th / 2 - 0.015);
    signText(b, sf, 'MOULIN', st((s0 + s1) / 2), y1 - 0.67, 0, {width: 0.55, d: 0.04, colour: 'pink'});
    signText(b, sf, 'Rouge', st((s0 + s1) / 2), y1 - 0.9, 0, {width: 0.45, d: 0.04, colour: 'pink'});
  }
  setSink(sk, true);
}
