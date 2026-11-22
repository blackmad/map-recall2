import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './uva-binnengasthuisstraat-9-footprints.json';

/**
 * BINNENGASTHUISSTRAAT 9, UvA (BAG pand 0363100012180195, BAG year 1914; register 518310). The brown-yellow brick block
 * on the canal side of the Binnengasthuis terrain, today the UvA Service & Informatiecentrum.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts): a 16.3 m front block under a hipped tile roof
 * with a raised brick attic in its middle, side wings 1 m back behind angled corners, the round hall behind.
 *
 * Front read from the rectified Gemeente Amsterdam panorama TMX7316010203-002629_pano_0001_000602 (2022, frontal at
 * 24 m, w01-0.jpg at 50 px/m), CC BY 4.0. The crop is isotropic; its pavement lies below the frame, fitted by putting
 * the eave line (y 100) at the 3DBAG's 16.2 m: h = (910 - y) / 50. Across, t = x / 50 - 0.55 (the window grid's axis of
 * symmetry stands at x 8.70 m, the 3DBAG front's middle at t 8.15). The angled corners from w06-341 and w07-19 (2025).
 *
 *  - seven window axes at a 2.08 m pitch, three storeys of cream-framed windows with dark green sashes (ground 1.84-4.7,
 *    first 6.7-9.12, second 11.34-14.2 m; the second storey's upper sashes in six small lights), stone sills;
 *  - shallow brick pilaster strips between the axes from the plinth to the string course at 14.25 m;
 *  - between the storeys, three small stone blocks stacked on each axis; small stone lintel blocks and brackets on the
 *    strips under the second storey;
 *  - the attic band to the eave (16.2 m) with stone crosses over the outer two axes each side; the raised middle attic
 *    (to 17.74 m, 3DBAG) carries a standing stone figure on a corbel; two small dormers in the roof over the second
 *    and sixth axes;
 *  - the angled corners' stair-landing windows and the glass roof boxes behind them; the west entrance (see west()).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;

function frameOf(i: number, j: number) {
  const A = src.facadeRing[i], B = src.facadeRing[j];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const tan: [number, number] = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const n: [number, number] = [-tan[1], tan[0]];
  return {f: {origin: [A[0], A[1]], tangent: tan, n} as Frame, len};
}
const FRONT = frameOf(4, 5);
const F = FRONT.f, L = FRONT.len;
const MID = L / 2;
const PITCH = 2.08;
const AXES = Array.from({length: 7}, (_, k) => MID + (k - 3) * PITCH);
const WIN_W = 1.26;

/** [bottom, top, transom] per storey; upper and lower light grids (cols x rows). */
const STOREYS: {y: [number, number]; transom: number; upper: [number, number]; lower: [number, number]}[] = [
  {y: [1.84, 4.7], transom: 3.28, upper: [2, 1], lower: [2, 1]},
  {y: [6.7, 9.12], transom: 8.08, upper: [2, 1], lower: [2, 1]},
  {y: [11.34, 14.2], transom: 12.78, upper: [2, 3], lower: [1, 1]},
];
const STRING = [14.25, 14.42];
const EAVE = 16.2;
const RAISED: [number, number] = [5.35, 10.95];
const RAISED_TOP = 17.74;

export function buildUvaBinnengasthuisstraat9(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);
  front(b);
  for (const [i, j] of [[2, 3], [6, 7]] as [number, number][]) corner(b, frameOf(i, j));
  west(b);
  setSink(0);
  dormers(b);
  setSink(sink0);
}

/** Cream-framed window: surround, glass, dark green sashes split at the transom, a stone sill. */
function windowAt(b: BuildingTools, f: Frame, c: number, s: (typeof STOREYS)[number]) {
  const [y0, y1] = s.y, h = y1 - y0;
  slab(b, f, c, y0 - 0.06, WIN_W + 0.12, h + 0.12, 0.08, 'white');
  slab(b, f, c, y0, WIN_W - 0.12, h, 0.13, 'glass');
  const sink = getSink();
  setSink(0);
  // transom (cream) and the sash grids (dark green bars)
  slab(b, f, c, s.transom - 0.05, WIN_W - 0.12, 0.1, 0.05, 'white', 0.13);
  const grid = (ya: number, yb: number, [cols, rows]: [number, number]) => {
    for (let i = 1; i < cols; i++) slab(b, f, c - (WIN_W - 0.12) / 2 + (WIN_W - 0.12) * i / cols, ya, 0.07, yb - ya, 0.05, 'white', 0.13);
    for (let j = 1; j < rows; j++) slab(b, f, c, ya + (yb - ya) * j / rows - 0.02, WIN_W - 0.12, 0.04, 0.04, 'frame', 0.13);
  };
  grid(s.transom + 0.05, y1, s.upper);
  grid(y0, s.transom - 0.05, s.lower);
  setSink(sink, true);
  slab(b, f, c, y0 - 0.16, WIN_W + 0.2, 0.1, 0.14, 'stone');
}

/** Three small stone blocks stacked on an axis between two storeys. */
function triplet(b: BuildingTools, f: Frame, c: number, y0: number, y1: number) {
  const bh = (y1 - y0) / 4.2;
  for (let i = 0; i < 3; i++) slab(b, f, c, y0 + i * bh * 1.6, 0.18, bh, 0.08, 'stone');
}

/** A stone cross of small blocks in the attic band. */
function cross(b: BuildingTools, f: Frame, c: number, y0: number, y1: number) {
  slab(b, f, c, y0, 0.1, y1 - y0, 0.06, 'stone');
  slab(b, f, c, (y0 + y1) / 2 - 0.05, 0.57, 0.1, 0.06, 'stone');
}

function front(b: BuildingTools) {
  // grey hardstone plinth
  slab(b, F, MID, 0, L - 0.1, 1.0, 0.06, 'stone');
  // pilaster strips between the axes and at both ends of the grid
  const strips = [AXES[0] - 0.92, ...AXES.slice(0, 6).map(c => c + PITCH / 2), AXES[6] + 0.92];
  for (const t of strips) slab(b, F, t, 1.0, 0.16, STRING[0] - 1.0, 0.05, 'brick');
  for (const c of AXES) for (const s of STOREYS) windowAt(b, F, c, s);
  for (const c of AXES) {
    triplet(b, F, c, 5.12, 5.98);
    triplet(b, F, c, 9.48, 10.42);
  }
  // small stone lintel blocks and brackets on the strips under the second storey (proud of the strips)
  for (const t of strips.slice(1, -1)) {
    slab(b, F, t, 10.42, 0.45, 0.2, 0.1, 'stone');
    slab(b, F, t, 11.28, 0.15, 0.2, 0.1, 'stone');
  }
  // string course over the second storey, the eave moulding, the raised attic's coping
  slab(b, F, MID, STRING[0], L - 0.1, STRING[1] - STRING[0], 0.12, 'stone');
  for (const [t0, t1] of [[0.05, RAISED[0]], [RAISED[1], L - 0.05]] as [number, number][]) slab(b, F, (t0 + t1) / 2, EAVE - 0.18, t1 - t0, 0.14, 0.18, 'stone');
  slab(b, F, MID, RAISED_TOP - 0.16, RAISED[1] - RAISED[0], 0.16, 0.14, 'stone');
  // stone crosses in the attic over the two outer axes each side
  for (const k of [0, 1, 5, 6]) cross(b, F, AXES[k], 14.9, 15.84);
  // the standing figure on its corbel in the middle of the raised attic
  slab(b, F, MID, 14.62, 0.4, 0.2, 0.26, 'stone');
  slab(b, F, MID, 14.82, 0.62, 0.28, 0.3, 'stone');
  slab(b, F, MID, 15.1, 1.1, 2.1, 0.08, 'sandstone');
  slab(b, F, MID, 15.15, 0.62, 0.8, 0.26, 'sandstone');
  slab(b, F, MID, 15.95, 0.52, 0.85, 0.3, 'sandstone');
  slab(b, F, MID, 16.8, 0.28, 0.32, 0.26, 'sandstone');
}

/**
 * The angled corner walls (w06-341, w07-19, 2025): stair-landing windows half a storey off the front's floors, read from
 * the crops at 50 px/m below the 3DBAG parapet (13.6 m): the lower window 3.8-6.7 m, three stacked blocks, the upper
 * window 8.7-11.2 m, a cross at 12.0-12.9 m. Behind, on the wing roof, the dark-framed glass box (3DBAG mass to 15.7 m)
 * is glazed where the probe finds its face.
 */
function corner(b: BuildingTools, {f, len}: {f: Frame; len: number}) {
  const c = len / 2;
  windowAt(b, f, c, {y: [3.8, 6.7], transom: 5.5, upper: [2, 2], lower: [2, 1]});
  windowAt(b, f, c, {y: [8.7, 11.2], transom: 9.9, upper: [2, 2], lower: [2, 1]});
  triplet(b, f, c, 7.3, 8.3);
  cross(b, f, c, 12.0, 12.9);
  slab(b, f, c, 13.5, len - 0.06, 0.18, 0.12, 'stone');
  // roof box: glass panes 0.5 m wide on the box face, found per step as the first 3DBAG roof at or over 15.2 m
  const sink = getSink();
  setSink(0);
  for (let t = 0.25; t < len - 0.2; t += 0.5) {
    let k = 0.4;
    while (k < 7 && roofOn(f, t, k) < 15.2) k += 0.1;
    // a clean vertical face only: low roof just in front, the box behind across the whole pane
    if (k >= 7 || [-0.22, 0, 0.22].some(dt => roofOn(f, t + dt, k - 0.12) > 14 || roofOn(f, t + dt, k + 0.12) < 15.2 || roofOn(f, t + dt, k + 0.6) < 15.2)) continue;
    const fb: Frame = {origin: [f.origin[0] - f.n[0] * (k - 0.06), f.origin[1] - f.n[1] * (k - 0.06)], tangent: f.tangent, n: f.n};
    slab(b, fb, t, 13.8, 0.44, 1.5, 0.04, 'glass');
    slab(b, fb, t, 15.3, 0.5, 0.12, 0.05, 'frame');
  }
  setSink(sink, true);
}

function roofOn(f: Frame, t: number, k: number) {
  const x = f.origin[0] + f.tangent[0] * t - f.n[0] * k, z = f.origin[1] + f.tangent[1] * t - f.n[1] * k;
  return roofHeightAt(src.surfaces, x, z) ?? 0;
}

/**
 * The west wall (w02-270, 2016, 43 degrees oblique): the entrance in its taller south part, placed by fitting the crop's
 * step between the low (13.6 m) and tall (15.65 m) parts to the 3DBAG's at t 4.5 (t = 4.5 + (x - 3.6) * 0.867, heights
 * (850 - y) / 50 * 0.93): a timber double door on steps under a white glazed bay of six lights and a stone hood; windows
 * over it and in the low part, a tall narrow light beside it.
 */
function west(b: BuildingTools) {
  const {f} = frameOf(7, 8);
  const win = (c: number, w: number, y0: number, y1: number, transom: number | null) => {
    slab(b, f, c, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.08, 'white');
    slab(b, f, c, y0, w - 0.12, y1 - y0, 0.13, 'glass');
    if (transom !== null) slab(b, f, c, transom - 0.05, w - 0.12, 0.1, 0.05, 'white', 0.13);
    if (w > 0.9) slab(b, f, c, y0, 0.07, y1 - y0, 0.05, 'white', 0.13);
    slab(b, f, c, y0 - 0.16, w + 0.2, 0.1, 0.14, 'stone');
  };
  win(2.1, 1.26, 1.4, 4.28, 2.79);
  win(2.1, 1.26, 6.23, 8.74, 7.63);
  win(6.3, 1.14, 6.23, 8.74, 7.63);
  win(4.85, 0.6, 6.7, 8.37, null);
  win(9.15, 0.6, 1.3, 4.28, null);
  // entrance: steps, the timber doors in a stone surround, the white glazed bay and the hood
  slab(b, f, 6.3, 0, 3.4, 0.3, 1.0, 'stone');
  slab(b, f, 6.3, 0.3, 2.8, 0.3, 0.6, 'stone');
  slab(b, f, 6.3, 0.6, 2.0, 2.75, 0.06, 'stone');
  slab(b, f, 6.3, 0.6, 1.74, 2.6, 0.06, 'copper', 0.06);
  slab(b, f, 6.3, 0.62, 0.05, 2.56, 0.04, 'dark', 0.12);
  slab(b, f, 6.3, 3.4, 2.9, 1.15, 0.45, 'white');
  for (let i = 0; i < 6; i++) slab(b, f, 6.3 + (i - 2.5) * 0.46, 3.6, 0.34, 0.75, 0.09, 'glass', 0.41);
  slab(b, f, 6.3, 4.55, 3.3, 0.22, 0.75, 'stone');
}

/** Two small dormers just above the eave over the second and sixth axes; the light over the 3DBAG roof plane. */
function dormers(b: BuildingTools) {
  for (const t of [AXES[1] - 0.9, AXES[5] + 0.9]) {
    const k = 0.5, fs: Frame = {origin: [F.origin[0] - F.n[0] * k, F.origin[1] - F.n[1] * k], tangent: F.tangent, n: F.n};
    const sill = roofAt(t, k + 0.03) + 0.08, dep = 1.6;
    slab(b, fs, t, sill - 0.6, 1.3, 1.1, dep, 'concrete', -dep);
    slab(b, fs, t, sill + 0.05, 0.9, 0.36, 0.04, 'glass');
    slab(b, fs, t, sill + 0.5, 1.5, 0.12, dep + 0.15, 'slate', -dep);
  }
}

function roofAt(t: number, k: number) {
  const x = F.origin[0] + F.tangent[0] * t - F.n[0] * k, z = F.origin[1] + F.tangent[1] * t - F.n[1] * k;
  return roofHeightAt(src.surfaces, x, z) ?? EAVE;
}
