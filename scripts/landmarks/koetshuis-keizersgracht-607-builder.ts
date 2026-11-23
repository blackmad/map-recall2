import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {facePanel, getSink, poly, ringSlab, roofHeightAt, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {rusticatedBase} from './gothic-tower-kit';
import source from './koetshuis-keizersgracht-607-footprints.json';

/**
 * KOETSHUIS, KEIZERSGRACHT 607 (BAG pand 0363100012167905; rijksmonument 2389). Register (RCE, kennisregistratie
 * 193098): "Breed koetshuis (XVIII voor 1767) met gevel voorzien van gebosseerde hoeklisenen en rechte lijst waarop drie
 * dakkapellen": a wide coach house, before 1767, its front with rusticated corner lesenes and a straight cornice carrying
 * three dormers. The register's BAG relation is Keizersgracht 607 (postcode 1017DS); the 2026-11-22b target list had
 * mapped the number to the neighbouring 1976 office, pand 0363100012167975 (Keizersgracht 603 / Vijzelstraat 79).
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). The BAG front is jagged (0.23-0.26 m steps
 * between ring vertices 2 and 9); the street front is drawn on the 14.98 m chord between them as a brick face 0.33 m
 * deep, so the steps stay behind it.
 *
 * Front read from the rectified Gemeente Amsterdam panoramas TMX7316010203-001543_pano_0000_002272 (2019, frontal, the
 * whole front lesene to lesene: t = x / 50) and TMX7316010203-002970_pano_0008_000009 (2023, sunlit, oblique: tints and
 * the rustication), CC BY 4.0. The 2019 rectification is isotropic at 50 px/m across, but its cornice would stand at
 * 12.5 m where the 3DBAG wall tops along this front are 10.4-10.8 m (AHN4); heights are fitted to the 3DBAG as in
 * sarphatistraat-47: h = (725 - y) * 0.01712 with the pavement at y 725 and the cornice top at 10.7 m.
 * The 2019 crop also spans only the middle 12.8 m of the 14.98 m front (its corners are cut off), the same 0.856
 * scale error read across: photo metres map to the front as X(x) = L / 2 + (x - 7.27) * 0.856 about the front's centre
 * (the crop's axis of symmetry is x 7.27). The corner lesenes and pilasters, outside the 2019 frame, are from the 2023 crop.
 *
 *  - ground storey to 3.58 m under a white entablature (to 4.0 m): the arched carriage door in the middle (3.08 m wide,
 *    segmental head 2.72-3.44 m in a brick ring), two pairs of white pilasters beside it, a white corner pilaster at each
 *    end, and a panelled double door with a transom light in each outer bay;
 *  - two storeys of three tall window axes (side axes 1.46 m, middle 1.63 m) in white stone surrounds, French railings
 *    across the lower part, a white projecting slab between the storeys and a flat hood over the upper windows;
 *  - two oculi in brick rings between the axes; rusticated brick lesenes at both corners from the entablature to the
 *    cornice;
 *  - a white straight cornice (architrave 9.52-9.79, frieze to 10.27, crown to 10.7 m), three dormers on it: the tall
 *    middle one in white stone to the 3DBAG's 13.46 m, two smaller ones with slate cheeks.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const A = src.facadeRing[2], B = src.facadeRing[9];
const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
const TAN: [number, number] = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
const N: [number, number] = [-TAN[1], TAN[0]];
/** The front plane, 3 cm proud of the chord: the brick face's front. */
const F: Frame = {origin: [A[0] + N[0] * 0.03, A[1] + N[1] * 0.03], tangent: TAN, n: N};
/** Photo metres (2019 crop, x / 50) to front metres: the crop is the same uniform 0.856 too large as its heights, centred on the front. */
const S = 0.856;
const X = (x: number) => L / 2 + (x - 7.27) * S;
const MID = L / 2;
const m = (t: number) => 2 * MID - t;

const PLINTH = 0.48;
const ENT: [number, number] = [3.58, 4.0];
const W1: [number, number] = [4.07, 6.47];
const SLAB: [number, number] = [6.52, 7.17];
const W2: [number, number] = [7.17, 8.61];
const HOOD: [number, number] = [8.61, 9.21];
const CORNICE = {arch: [9.52, 9.79], frieze: [9.79, 10.27], crown: [10.27, 10.7]} as const;
const SIDE_AXIS = X(2.1), SIDE_W = 1.7 * S, MID_W = 1.9 * S;
const DOOR = X(2.22), DOOR_W = 1.75 * S;
const LESENE = 0.94;

export function buildKoetshuisKeizersgracht607(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  // the brick face over the jagged BAG front
  facePanel(b, F, L / 2, 0, L, CORNICE.arch[0], 'brick', -0.005);
  setSink(0);
  ground(b);
  for (const t of [SIDE_AXIS, MID, m(SIDE_AXIS)]) axis(b, t, t === MID ? MID_W : SIDE_W);
  for (const t of [X(4.56), m(X(4.56))]) oculus(b, t);
  lesenes(b);
  cornice(b);
  setSink(0);
  dormers(b);
  setSink(sink0);
}

/** Ground storey: plinth, corner and door pilasters, entablature, carriage arch and the two side doors with lanterns. */
function ground(b: BuildingTools) {
  // grey stone plinth course along the front, stopped at the door surrounds and the carriage arch's ring
  const gaps: [number, number][] = [[DOOR - DOOR_W / 2 - 0.09, DOOR + DOOR_W / 2 + 0.09], [MID - 3.6 * S / 2 - 0.26, MID + 3.6 * S / 2 + 0.26], [m(DOOR) - DOOR_W / 2 - 0.09, m(DOOR) + DOOR_W / 2 + 0.09]];
  let p0 = 0.05;
  for (const [g0, g1] of [...gaps, [L - 0.05, L]]) { if (g0 > p0) slab(b, F, (p0 + g0) / 2, 0, g0 - p0, PLINTH, 0.04, 'stone'); p0 = g1; }
  // white entablature with a projecting moulding on top
  slab(b, F, L / 2, ENT[0], L - 0.1, ENT[1] - ENT[0] - 0.1, 0.12, 'white');
  slab(b, F, L / 2, ENT[1] - 0.1, L - 0.06, 0.1, 0.24, 'white');
  // pilasters: a pair each side of the carriage door, one at each corner (stone feet)
  const pil = (t0: number, t1: number) => {
    slab(b, F, (t0 + t1) / 2, 0, t1 - t0 + 0.08, PLINTH + 0.1, 0.2, 'stone');
    slab(b, F, (t0 + t1) / 2, PLINTH, t1 - t0, ENT[0] - PLINTH, 0.14, 'white');
  };
  for (const [t0, t1] of [[X(4.0), X(4.55)], [X(4.65), X(5.25)], [0.08, 0.72]] as [number, number][]) { pil(t0, t1); pil(m(t1), m(t0)); }
  // carriage door: segmental head, brick voussoir ring, dark timber leaves with glazed upper panels
  const c = MID, W = 3.6 * S, spring = 2.72, rise = 0.72;
  const head: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const x = -W / 2 + W * i / 10, R = (W * W / 4 + rise * rise) / (2 * rise);
    head.push([x, spring + rise - R + Math.sqrt(R * R - x * x)]);
  }
  poly(b, F, c, 0, [[-W / 2, 0], [W / 2, 0], ...head.slice().reverse()], 0.04, 'dark');
  segBand(b, F, c, spring, W + 0.5, rise + 0.08, 0.3, 0.06, 'brick');
  for (const dx of [-1.2, -0.6, 0.6, 1.2].map(v => v * S)) slab(b, F, c + dx, 0.5, 0.06, spring - 0.5, 0.1, 'frame', 0.04);
  slab(b, F, c, 0.05, 0.08, spring + rise - 0.05, 0.1, 'frame', 0.04);
  slab(b, F, c, 1.9, W - 0.05, 0.08, 0.1, 'frame', 0.04);
  for (const dx of [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map(v => v * S)) slab(b, F, c + dx, 0.6, 0.31, spring - 0.75, 0.05, 'glass', 0.04);
  // side doors: stone-white surround, transom light, dark panelled double leaves
  for (const t of [DOOR, m(DOOR)]) {
    slab(b, F, t, 0, DOOR_W + 0.16, 3.22 + 0.1, 0.06, 'white');
    slab(b, F, t, 0.05, DOOR_W - 0.2, 2.36, 0.05, 'dark', 0.06);
    slab(b, F, t, 2.45, DOOR_W - 0.2, 0.72, 0.05, 'glass', 0.06);
    slab(b, F, t, 2.38, DOOR_W - 0.15, 0.07, 0.1, 'white', 0.06);
    slab(b, F, t, 0.05, 0.05, 2.36, 0.1, 'frame', 0.11);
    for (const dx of [-0.34, 0.34]) slab(b, F, t + dx, 0.95, 0.36, 1.3, 0.05, 'glass', 0.11);
    // wall lantern on a scrolled bracket by the door (2019: on the carriage-door side)
    const lt = t < MID ? t + 1.15 * S : t - 1.15 * S;
    slab(b, F, lt, 2.55, 0.06, 0.06, 0.42, 'bronze');
    slab(b, F, lt, 2.25, 0.24, 0.4, 0.24, 'bronze', 0.32);
    slab(b, F, lt, 2.3, 0.18, 0.28, 0.2, 'glass', 0.34);
  }
  // four white iron hooks under each side axis' window, hung on the entablature (2019: U-shaped)
  for (const t of [SIDE_AXIS, m(SIDE_AXIS)]) for (const dx of [-0.66, -0.22, 0.22, 0.66].map(v => v * S)) {
    slab(b, F, t + dx, ENT[0] - 0.22, 0.05, 0.3, 0.05, 'white', 0.12);
    slab(b, F, t + dx, ENT[0] - 0.22, 0.05, 0.05, 0.2, 'white', 0.12);
  }
}

/** One window axis over the two upper storeys: surrounds, sashes, railings, the slab between and the hood. */
function axis(b: BuildingTools, t: number, w: number) {
  const win = ([y0, y1]: [number, number], transom: number | null) => {
    slab(b, F, t, y0, w, y1 - y0, 0.06, 'white');
    slab(b, F, t, y0 + 0.08, w - 0.3, y1 - y0 - 0.16, 0.05, 'glass', 0.06);
    slab(b, F, t, y0 + 0.08, 0.07, y1 - y0 - 0.16, 0.05, 'frame', 0.11);
    if (transom) slab(b, F, t, transom, w - 0.3, 0.07, 0.05, 'frame', 0.11);
    for (const dx of [-1, 1]) slab(b, F, t + dx * (w / 2 - 0.19), y0 + 0.08, 0.07, y1 - y0 - 0.16, 0.05, 'frame', 0.11);
  };
  const railing = (y0: number, h: number) => {
    slab(b, F, t, y0 + h - 0.05, w - 0.12, 0.05, 0.08, 'bronze', 0.2);
    slab(b, F, t, y0 + 0.05, w - 0.12, 0.04, 0.08, 'bronze', 0.2);
    for (let k = 0; k <= 6; k++) slab(b, F, t - (w - 0.2) / 2 + (w - 0.2) * k / 6, y0 + 0.05, 0.025, h - 0.05, 0.03, 'bronze', 0.2);
  };
  win(W1, 5.75);
  railing(W1[0] + 0.06, 0.9);
  // the projecting white slab over the first-storey window, on two brackets
  slab(b, F, t, SLAB[0], w + 0.3, SLAB[1] - SLAB[0], 0.32, 'white');
  for (const dx of [-1, 1]) slab(b, F, t + dx * (w / 2 - 0.1), SLAB[0] - 0.22, 0.12, 0.22, 0.22, 'white');
  win(W2, null);
  railing(W2[0] + 0.02, 0.85);
  // flat hood: frame head, then a projecting cap
  slab(b, F, t, HOOD[0], w, 0.3, 0.06, 'white');
  slab(b, F, t, HOOD[0] + 0.3, w + 0.36, HOOD[1] - HOOD[0] - 0.3, 0.3, 'white');
}

/** Bull's-eye window in a brick ring (2019: 0.7 m opening at 6.69 m). */
function oculus(b: BuildingTools, t: number) {
  const y = 6.69;
  ringSlab(b, F, t, y, 0.36, 0.5, 0.07, 'brick', 0);
  ringSlab(b, F, t, y, 0.3, 0.36, 0.07, 'white', 0);
  slab(b, F, t, y - 0.3, 0.6, 0.6, 0.03, 'glass', 0);
}

/** Rusticated (banded) brick corner lesenes from the entablature to the architrave. */
function lesenes(b: BuildingTools) {
  for (const [t0, t1] of [[0.04, LESENE], [m(LESENE), L - 0.04]] as [number, number][]) {
    rusticatedBase(b, F, {t0, t1, y0: ENT[1], y1: CORNICE.arch[0], course: 0.29, block: 2.5, minBlock: 0.2, depth: 0.07, joint: 0.03, out: 0, sink: 0.05}, 'brick');
  }
}

/** The straight white cornice: architrave, frieze and the projecting crown. */
function cornice(b: BuildingTools) {
  slab(b, F, L / 2, CORNICE.arch[0], L, CORNICE.arch[1] - CORNICE.arch[0], 0.12, 'white');
  slab(b, F, L / 2, CORNICE.frieze[0], L, CORNICE.frieze[1] - CORNICE.frieze[0], 0.06, 'white');
  slab(b, F, L / 2, CORNICE.crown[0], L, 0.15, 0.22, 'white');
  slab(b, F, L / 2, CORNICE.crown[0] + 0.15, L + 0.1, CORNICE.crown[1] - CORNICE.crown[0] - 0.15, 0.48, 'white');
}

/**
 * Dormers on the cornice. The middle one in white stone, flush with the front behind the crown, to the 3DBAG's 13.46 m:
 * a window with a railing and a projecting flat cap. The side ones smaller, white framed with slate cheeks and a cap.
 */
function dormers(b: BuildingTools) {
  const base = CORNICE.crown[1];
  const back = (k: number): Frame => ({origin: [F.origin[0] - N[0] * k, F.origin[1] - N[1] * k], tangent: TAN, n: N});
  // middle dormer
  const fm = back(0);
  slab(b, fm, MID, base - 0.4, 2.5, 12.75 - base + 0.4, 1.6, 'concrete', -1.6);
  slab(b, fm, MID, 12.75, 2.8, 0.2, 1.9, 'concrete', -1.6);
  // triangular pediment over the cap to the 3DBAG dormer top (13.46 m; 2023: a peaked white head)
  poly(b, fm, MID, 12.95, [[-1.35, 0], [1.35, 0], [0, 0.51]], 0.3, 'concrete', -0.12);
  slab(b, fm, MID, base + 0.12, 1.6, 1.85, 0.05, 'glass');
  slab(b, fm, MID, base + 0.12, 0.07, 1.85, 0.05, 'frame', 0.05);
  slab(b, fm, MID, base + 1.45, 1.6, 0.06, 0.05, 'frame', 0.05);
  for (let k = 0; k <= 6; k++) slab(b, fm, MID - 0.75 + 0.25 * k, base + 0.15, 0.025, 0.75, 0.02, 'bronze', 0.12);
  slab(b, fm, MID, base + 0.88, 1.6, 0.05, 0.08, 'bronze', 0.12);

  // side dormers (peaked white heads, 2023): the front 0.36 m behind the facade, under the crown's 0.48 m projection, where the 3DBAG roof begins; the light's sill over the
  // 3DBAG roof at that line, so no part of the opening is under the roof plane. Over the side axes (the 3DBAG west hip,
  // from t 1.6, stays clear of the light)
  for (const t of [X(2.1), m(X(2.1))]) {
    const k = 0.36, fs = back(k);
    const sill = Math.max(base + 0.1, roofAt(t, k + 0.03)) + 0.08;
    const top = sill + 1.25, dep = 2.4;
    slab(b, fs, t, sill - 0.5, 1.3, top - sill + 0.5, dep, 'concrete', -dep);
    slab(b, fs, t, sill + 0.05, 0.9, 1.1, 0.05, 'glass');
    slab(b, fs, t, sill + 0.05, 0.06, 1.1, 0.04, 'frame', 0.05);
    slab(b, fs, t, top, 1.55, 0.15, dep + 0.25, 'concrete', -dep);
    poly(b, fs, t, top + 0.15, [[-0.75, 0], [0.75, 0], [0, 0.42]], 0.3, 'concrete', -0.1);
    // slate cheeks either side of the white front
    for (const dx of [-1, 1]) slab(b, back(k + 0.06), t + dx * 0.7, sill - 0.5, 0.1, top - sill + 0.5, dep - 0.06, 'slate', -(dep - 0.06));
  }
}

/** 3DBAG roof height `k` metres in behind the front at t (0 where no roof plane is found). */
function roofAt(t: number, k: number) {
  const x = F.origin[0] + TAN[0] * t - N[0] * k, z = F.origin[1] + TAN[1] * t - N[1] * k;
  return roofHeightAt(src.surfaces, x, z) ?? 0;
}
