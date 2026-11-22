import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, letters, patternPanel, roofHeightAt, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import source from './sarphatistraat-47-footprints.json';

/**
 * SARPHATISTRAAT 47-55 (BAG pand 0363100012170759; gemeentelijk monument 210049, wikidata Q118390882). Register: the
 * Amsterdamsche Bank's office of 1928 by C.B. Posthumus Meyjes, on the plots of Sarphatistraat 47-55; a granite ground
 * zone, storeys in brick and a high closing roof, the front dominated by projecting, profiled brick piers (penanten).
 * Today the citizenM hotel.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts) as scanned: the 37 m front on one straight
 * line (facade-ring edge 5, t = 0 at the west end), the main wall to 17.3 m with the attic, the two end bays to 16 m
 * under their hips and the tiled hipped roof to 23.9 m.
 *
 * Front read from the big-rectify.ts rectification of Gemeente Amsterdam panorama 20241203_0939_Track10-1_Sphere_00298
 * (2024-12-03, camera 21 m, 40 px/m, whole front in one frame; t = x / 40 - 0.3, matching the 37 m edge end to end) and
 * TMX7316010203-002541_pano_0004_000379 (2022, overcast: the measured colours) and TMX7316010203-001675_pano_0000_006016
 * (2020, sunlit), CC BY 4.0. Heights from the 2024 rectification with the pavement at y 950 and the attic top fitted to
 * the 3DBAG wall (17.2 m): h = (950 - y) * 0.0261. The front is symmetric about t 18.49 above the ground storey:
 * the west half is measured and mirrored.
 *
 *  - ground zone: granite to 3.0 m under a granite band (r15: was 2.75; the 2020 alt crop puts the wing granite's top at
 *    2.9-3.1 m over the low windows); in the middle eight bays the granite rises to 5.3 m as piers
 *    between eight tall windows whose upper lights (2.9-4.95 m) carry colourful painted art panels today;
 *  - storeys: grid-paned white windows at 3.2-6.25 (wings), 5.45-6.25 (middle mezzanine), 7.65-9.95 and 11.35-13.7 m,
 *    patterned brick panels between them, the piers rising through the cornice (15.05-15.5 m) to the attic (to 17.2 m);
 *  - end bays: narrow slit windows between clustered piers; three flat-topped dormers in the roof, a chimney at the
 *    west end.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = ringFrame(src.facadeRing, 5);
const F = FRONT.f, L = FRONT.len;
const E0 = 0.08, E1 = L - 0.08;
/** Mirror about the front's axis (symmetric above the ground storey). */
const MID = 18.49;
const m = (t: number) => 2 * MID - t;
const both = (t: number) => [t, m(t)];

/** Window rows (m). */
const R1: [number, number] = [3.2, 6.25];
const R2: [number, number] = [7.65, 9.95];
const R3: [number, number] = [11.35, 13.7];
const MEZZ: [number, number] = [5.45, 6.25];
const GRANITE = 3.0, CENTRE_GRANITE = 5.3;
const CORNICE: [number, number] = [15.05, 15.5];
const ATTIC_TOP = 17.2;
/** Wing bay axes (west half), middle bay axes. */
const WING = [5.6, 7.48, 9.34];
const MIDDLE = Array.from({length: 8}, (_, k) => 11.96 + 1.865 * k);
const MID_T0 = 11.07, MID_T1 = m(11.07);
/** The main wall (3DBAG wall to 17.26 m) between the end bays. */
const MAIN_T0 = 4.2, MAIN_T1 = 33.6;
const WIN_W = 1.2;
/** End-bay slit axes and ribs (2024 rectification). */
const SLITS_W = [2.09, 2.71, 3.33], SLITS_E = [33.9, 34.5, 35.1];
const RIBS_W = [0.4, 1.0, 1.5, 2.4, 3.02], RIBS_E = [34.2, 34.8, 35.7, 36.2, 36.65];

export function buildSarphatistraat47(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);
  ground(b);
  storeys(b);
  piers(b);
  cornice(b);
  setSink(0);
  dormers(b);
  chimney(b);
  setSink(sink0);
}

/**
 * Grid-paned window: white frame, glass, glazing bars (`cols` x `rows` lights) and a stone sill (2024 rectification at
 * 2x: three lights across, four or five down). `base`: the out of the surface it sits on.
 */
function gridWin(b: BuildingTools, f: Frame, c: number, [y0, y1]: [number, number], w: number, cols: number, rows: number, o: {base?: number; sill?: boolean} = {}) {
  const base = o.base ?? 0, h = y1 - y0;
  slab(b, f, c, y0 - 0.08, w + 0.16, h + 0.16, 0.08, 'white', base);
  slab(b, f, c, y0, w, h, 0.13, 'glass', base);
  // glazing bars rest on the glass unsunk: a sunk bar is deeper than it is wide, and the openings gate then reads its
  // side faces as its face and judges it against a side wall (the mezzanine bars, first export)
  const sink = getSink();
  setSink(0);
  for (let i = 1; i < cols; i++) slab(b, f, c - w / 2 + w * i / cols, y0, 0.05, h, 0.05, 'white', base + 0.13);
  for (let j = 1; j < rows; j++) slab(b, f, c, y0 + h * j / rows - 0.025, w, 0.05, 0.05, 'white', base + 0.13);
  setSink(sink, true);
  if (o.sill !== false) slab(b, f, c, y0 - 0.16, w + 0.2, 0.08, 0.2, 'stone', base);
}

/** Granite ground zone, the eight tall windows with their art panels, the doors and the low windows of the wings. */
function ground(b: BuildingTools) {
  // granite cladding: to 3.0 m across the front, to 5.3 m over the middle eight bays; a projecting band on top
  // (stopped 8 cm short of the front's ends, where the side faces would lie in the party walls' planes)
  slab(b, F, (E0 + MID_T0) / 2, 0, MID_T0 - E0, GRANITE, 0.06, 'sandstone');
  slab(b, F, (MID_T1 + E1) / 2, 0, E1 - MID_T1, GRANITE, 0.06, 'sandstone');
  // (the middle zone has no cladding plane: its granite piers and the window frames fill it; a cladding plane 6 cm out
  // was taken as the host wall of the mezzanine windows above it)
  slab(b, F, (E0 + MID_T0) / 2, GRANITE - 0.12, MID_T0 - E0, 0.2, 0.16, 'sandstone');
  slab(b, F, (MID_T1 + E1) / 2, GRANITE - 0.12, E1 - MID_T1, 0.2, 0.16, 'sandstone');
  slab(b, F, MID, CENTRE_GRANITE - 0.3, MID_T1 - MID_T0 + 0.2, 0.3, 0.2, 'sandstone');
  // granite piers between the tall windows (0.45 m) and at the ends of the middle zone (0.9 m)
  for (let k = 0; k <= 8; k++) {
    const t = MIDDLE[0] - 1.865 / 2 + 1.865 * k, w = k === 0 || k === 8 ? 0.9 : 0.45;
    slab(b, F, k === 0 ? t - 0.2 : k === 8 ? t + 0.2 : t, 0, w, CENTRE_GRANITE - 0.3, 0.26, 'sandstone');
  }
  // the tall windows: glazed below a white transom (0.25-2.35 m), the upper lights filled with the art panels
  const art: [string, number, number, number, number][][] = [
    [['pink', -0.25, 3.3, 0.5, 0.9], ['blue', 0.2, 4.1, 0.4, 0.6]],
    [['ochre', 0.15, 4.2, 0.45, 0.5], ['pink', -0.1, 3.1, 0.6, 0.8]],
    [['red', 0.05, 3.6, 0.5, 1.0], ['blue', -0.3, 3.1, 0.3, 0.5]],
    [['ochre', -0.2, 4.1, 0.5, 0.6], ['pink', 0.15, 3.0, 0.45, 1.0]],
    [['blue', -0.15, 3.9, 0.55, 0.7], ['ochre', 0.2, 3.1, 0.35, 0.7]],
    [['green', 0.1, 3.2, 0.55, 0.6], ['blue', -0.2, 4.1, 0.5, 0.6]],
    [['pink', -0.05, 3.2, 0.6, 0.7], ['red', 0.25, 4.15, 0.3, 0.5]],
    [['ochre', 0.2, 4.2, 0.4, 0.55], ['pink', -0.15, 3.1, 0.55, 0.9]],
  ];
  MIDDLE.forEach((c, k) => {
    const base = 0, w = 1.25;
    slab(b, F, c, 0.18, w + 0.16, 4.85, 0.08, 'white', base);
    slab(b, F, c, 0.26, w, 2.09, 0.13, 'glass', base);
    slab(b, F, c, 0.26, 0.05, 2.09, 0.05, 'white', base + 0.13);
    slab(b, F, c, 2.87, w, 2.0, 0.13, 'concrete', base);
    for (const [col, dx, y, sw, sh] of art[k]) slab(b, F, c + dx, y, sw, sh, 0.05, col, base + 0.13);
  });
  // west end bay: the red-brown timber door; west wing: low window, dark door, low window
  // (r15: the doors were drawn too small; the west door fills the end bay to 2.75 m, the wing door 1.15 x 2.5 m)
  door(b, 2.83, 2.0, 2.75, 'copper');
  gridWin(b, F, WING[0], [0.45, 1.9], 1.0, 2, 2, {base: 0.06, sill: false});
  door(b, WING[1], 1.15, 2.5, 'dark');
  gridWin(b, F, WING[2], [0.45, 1.9], 1.0, 2, 2, {base: 0.06, sill: false});
  // east wing: three low windows (2022); east end bay: a door under the citizenM sign (behind the tram shelter and the
  // bus in both photos: inferred as the west end's door)
  for (const t of WING) gridWin(b, F, m(t), [0.45, 1.9], 1.0, 2, 2, {base: 0.06, sill: false});
  door(b, m(2.83), 1.9, 2.35, 'copper');
  // citizenM: red lower-case word and the M in a red box on the granite over that door (2022), drawn as capitals
  letters(b, F, 'CITIZEN', 33.85, 2.55, 0.06, 0.045, 0.05, 'red', 0.05);
  slab(b, F, 35.4, 2.45, 0.4, 0.4, 0.05, 'red', 0.06);
  letters(b, F, 'M', 35.4, 2.5, 0.11, 0.055, 0.05, 'white', 0.045);
  // the bronze plaque by the east end of the middle zone (2024: 0.8 x 0.5 m at 2.5 m)
  slab(b, F, 26.6, 2.5, 0.75, 0.5, 0.05, 'bronze', 0.06);
}

function door(b: BuildingTools, c: number, w: number, h: number, colour: string) {
  slab(b, F, c, 0, w + 0.2, h + 0.1, 0.08, 'sandstone', 0.06);
  slab(b, F, c, 0, w, h, 0.06, colour, 0.14);
  slab(b, F, c, h * 0.55, w - 0.2, 0.06, 0.04, 'dark', 0.2);
}

/** The window grid over the ground zone and the patterned brick panels between the rows. */
function storeys(b: BuildingTools) {
  // meander-like brick pattern of the spandrels (2020 sunlit crop at 3x: raised headers in a key pattern)
  // (a plain margin round the pattern: raised courses flush with the panel's edges shared its side planes)
  const key = ['0000000000000', '0111111111110', '0100001000010', '0101101011010', '0101000010010', '0111111111110', '0000000000000'];
  const panel = (c: number, y0: number, y1: number, w: number) => patternPanel(b, F, c, y0 + 0.12, w, y1 - y0 - 0.32, key, 'greyBrick', 'brick', 0.06, 0.05);
  for (const s of [1, -1]) {
    const T = (t: number) => (s > 0 ? t : m(t));
    for (const t of WING) {
      gridWin(b, F, T(t), R1, WIN_W, 3, 5);
      gridWin(b, F, T(t), R2, WIN_W, 3, 4);
      gridWin(b, F, T(t), R3, WIN_W, 3, 4);
      panel(T(t), R1[1], R2[0], WIN_W);
      panel(T(t), R2[1], R3[0], WIN_W);
      // attic: one small opening over each wing bay (2024: 0.45 x 0.65 m)
      slab(b, F, T(t), 15.65, 0.45, 0.65, 0.06, 'dark');
    }
  }
  // end bays: three slit windows per storey between the clustered ribs; the end bays are not alike (3DBAG: west 4.2 m,
  // east 3.4 m), so both are measured (2024 rectification), not mirrored
  for (const t of [...SLITS_W, ...SLITS_E]) for (const r of [R1, R2, R3]) {
    slab(b, F, t, r[0] - 0.06, 0.4, r[1] - r[0] + 0.12, 0.08, 'white');
    slab(b, F, t, r[0], 0.3, r[1] - r[0], 0.13, 'glass');
    slab(b, F, t, (r[0] + r[1]) / 2, 0.3, 0.05, 0.05, 'white', 0.13);
  }
  for (const c of MIDDLE) {
    // mezzanine (r15: read weak): nearly bay-wide, four lights under a row of small top lights, bold white frame
    // (2020 sunlit crop: 1.3 m of the 1.37 m between the piers)
    gridWin(b, F, c, MEZZ, 1.3, 4, 2, {sill: false});
    gridWin(b, F, c, R2, WIN_W, 3, 4);
    gridWin(b, F, c, R3, WIN_W, 3, 4);
    panel(c, MEZZ[1], R2[0], WIN_W);
    panel(c, R2[1], R3[0], WIN_W);
    // attic lights between the pier heads (2024: 15.6-16.15 m)
    slab(b, F, c, 15.6, 1.1, 0.55, 0.06, 'dark');
  }
}

/** Projecting, profiled brick piers from the granite to the attic, the clustered ribs of the end bays. */
function piers(b: BuildingTools) {
  const pier = (t: number, w: number, y0: number) => {
    slab(b, F, t, y0, w, ATTIC_TOP - 0.25 - y0, 0.3, 'brick');
    slab(b, F, t, y0, Math.max(0.16, w - 0.3), ATTIC_TOP - 0.25 - y0, 0.42, 'brick');
    slab(b, F, t, ATTIC_TOP - 0.25, w + 0.06, 0.2, 0.48, 'stone');
  };
  const rib = (t: number, y0: number, y1: number) => slab(b, F, t, y0, 0.2, y1 - y0, 0.22, 'brick');
  for (const T of [(t: number) => t, m]) {
    // west half (mirrored): wing piers, the broad pier at the end bay, the pier at the middle zone
    for (const t of [6.54, 8.41]) pier(T(t), 0.5, GRANITE + 0.08);
    pier(T(4.25), 1.0, GRANITE + 0.08);
    pier(T(10.55), 0.7, GRANITE + 0.08);
  }
  // end bays: ribs to the cornice
  for (const t of [...RIBS_W, ...RIBS_E]) rib(t, GRANITE + 0.08, CORNICE[0]);
  // middle zone: piers between the bays above the granite
  for (let k = 0; k < 7; k++) pier(MIDDLE[k] + 1.865 / 2, 0.5, CENTRE_GRANITE);
  // grey cylinder wall lamps on the middle piers just above the mezzanine (2020 sunlit crop: 0.15 x 0.5 m at 6.4 m)
  for (let k = 0; k < 7; k++) slab(b, F, MIDDLE[k] + 1.865 / 2, 6.35, 0.14, 0.5, 0.14, 'concrete', 0.42);
}

/** Stone cornice along the whole front and the coping of the attic. */
function cornice(b: BuildingTools) {
  slab(b, F, L / 2, CORNICE[0] - 0.15, E1 - E0, 0.15, 0.36, 'stone');
  slab(b, F, L / 2, CORNICE[0], E1 - E0, CORNICE[1] - CORNICE[0], 0.52, 'stone');
  slab(b, F, (MAIN_T0 + MAIN_T1) / 2, ATTIC_TOP - 0.18, MAIN_T1 - MAIN_T0, 0.18, 0.14, 'stone');
}

/** Point on the roof `k` metres in behind the front at t. */
function behind(t: number, k: number): [number, number] {
  return [F.origin[0] + F.tangent[0] * t - F.n[0] * k, F.origin[1] + F.tangent[1] * t - F.n[1] * k];
}
function roofAt(t: number, k: number) { const [x, z] = behind(t, k); return roofHeightAt(src.surfaces, x, z) ?? 0; }

/** Three flat-topped dormers over the middle bays 2, 4 and 6 (2024: 1.5 m wide, a cream frame round two lights). */
function dormers(b: BuildingTools) {
  // the roof rises 1.56 m per metre (3DBAG); the dormer fronts stand 0.9 m behind the attic (a dormer front less than
  // 0.8 m behind the wall was taken as part of the facade's host plane), the sill 0.45 m over the roof across the width
  const k = 0.9;
  for (const t of [MIDDLE[1] + 0.3, MID, MIDDLE[6] - 0.3]) {
    const SILL = Math.max(roofAt(t - 0.8, k), roofAt(t, k), roofAt(t + 0.8, k)) + 0.45;
    const f: Frame = {origin: [F.origin[0] - F.n[0] * k, F.origin[1] - F.n[1] * k], tangent: F.tangent, n: F.n};
    const top = SILL + 1.15, dep = 2.4;
    slab(b, f, t, SILL - 0.55, 1.6, top - SILL + 0.55, dep, 'stone', -dep);
    slab(b, f, t, top, 1.8, 0.14, dep + 0.15, 'stone', -dep);
    slab(b, f, t, SILL - 0.05, 1.3, 1.0, 0.06, 'white');
    slab(b, f, t, SILL, 1.2, 0.9, 0.11, 'glass');
    slab(b, f, t, SILL, 0.05, 0.9, 0.05, 'white', 0.11);
  }
}

/** Brick chimney over the west end bay (2024 rectification: x 135-180, against the sky). */
function chimney(b: BuildingTools) {
  const t = 3.65, k = 2.2, base = roofAt(t, k + 0.45) - 0.5;
  const f: Frame = {origin: [F.origin[0] - F.n[0] * (k + 0.9), F.origin[1] - F.n[1] * (k + 0.9)], tangent: F.tangent, n: F.n};
  slab(b, f, t, base, 0.9, 21.4 - base, 0.9, 'brick');
  slab(b, f, t, 21.4, 1.05, 0.15, 1.05, 'stone', -0.075);
}
