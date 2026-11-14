import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {balustradeRun, corniceSection, cutFrontWalls, festoonPanel, lettering, modillions, profileAlong, TriSink, type XZ} from './venue-kit';
import source from './universiteitstheater-footprints.json' with {type: 'json'};

/**
 * Universiteitstheater, Nieuwe Doelenstraat 16 (BAG pand 0363100012180412, University of Amsterdam). Two fronts drawn
 * from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 40 px/m):
 *
 *  - the Amstel front (ring 28 -> 0, 26.1 m; TMX7316010203-000354_pano_0001_001508 2017-07-06 square-on from the water,
 *    TMX7316010203-001975_pano_0000_001282 2021-01-22): orange-red brick, the ground floor banded with white stripes
 *    over a white-painted plinth that carries the painted words UNIVERSITEITS ... THEATER; a dark stone belt; five tall
 *    sash windows between brick pilasters on the first floor, three white voussoir blocks over every window, a festoon
 *    relief panel over each, cream capitals, a two-fascia architrave, a brick frieze, a modillioned cornice and a
 *    balustrade between brick dies. Heights: the crop's ground is the boat camera's, 2.35 m below the 3DBAG ground
 *    (water at NAP -0.4, ground NAP 1.36), so model y = crop y - 2.35; that puts the crop's water line at -1.75 m, the game's
 *    canal water (ownGround WATER_Z -1.77), and the cornice on the 3DBAG roofs (11.3-12.5 m). The first 1.38 m of the chord is the taller
 *    3DBAG corner piece (the neighbour's banded corner in the photo); it keeps its shell.
 *  - the Nieuwe Doelenstraat front (ring 8 -> 27, 25.3 m, jogs <= 0.11 m; TMX7316010203-000717_pano_0000_000477
 *    2018-05-14, TMX7316010203-000224_pano_0000_000733 2017-03-27, TMX7315120208-000073_pano_0003_000692 2016-06-09):
 *    dark purple-brown brick, three storeys of white-framed sash windows over a grey basement with small windows, a
 *    stoop to the door in the second bay, the white stone doorcase and window surround of the entrance bay, and a
 *    white entablature under the 3DBAG roof (skylights stay in the 3DBAG roof plane). Bays placed on the BAG jogs
 *    (2.9, 11.65, 16.25, 20.15 m), which split the front into the old house plots.
 * The NE walls over the De Jaren terrace and the roofs keep the 3DBAG LoD2.2 shell (CC BY 4.0).
 *
 * Native frame of universiteitstheater-footprints.json (x east, z south, y up from the 3DBAG ground).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const SE: Chord = {a: R[28], b: R[0]};
const NW: Chord = {a: R[8], b: R[27]};
const LSE = Math.hypot(R[0][0] - R[28][0], R[0][1] - R[28][1]);
const LNW = Math.hypot(R[27][0] - R[8][0], R[27][1] - R[8][1]);
const Y = (crop: number) => crop - 2.35;            // Amstel crop heights -> model (see the header)
const SE0 = 1.38;                                   // the Amstel front starts here along its chord (corner piece before)
const SE_WIN = [5.35, 9.55, 13.95, 18.35, 22.55];   // window centres (the middle one is the water door below)
const SE_PIL: Array<[number, number]> = [[2.75, 1.7], [7.45, 1.2], [11.75, 1.2], [16.15, 1.2], [20.45, 1.2], [25.15, 1.7]];
const NW_TOP = 13.1, NW_EAVES = 14.4;

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

function shell(c: Ctx) {
  let cut = cutFrontWalls(SRC.surfaces, [R[28], R[0]], SE, [[SE0, LSE + 0.6, 99]]);
  cut = cutFrontWalls(cut, R.slice(8, 28), NW, [[-0.6, LNW + 0.6, NW_EAVES - 0.05]]);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'red', roof: 'slate'});
}

// ---- the Amstel front ------------------------------------------------------------------------------------------------
function amstel(c: Ctx) {
  const {K, b, M} = c;
  const top = Y(14.6);                              // frieze top: the cornice starts here
  // the wall face in one section per bay and floor (each face's outline stays a short boundary loop); the upper sections
  // reach into the corona so the modillions sit on wall
  const cuts = [SE0, 7.45, 11.75, 16.15, 20.45, LSE];
  // sections stand 2 cm apart (the audit links a whole welded front into one boundary loop): the gaps between floors
  // lie behind the stone belt, those between bays behind the pilasters, and a brick backing closes the ground-floor ones
  const secs = (y0: number, y1: number) => cuts.slice(0, -1).map((s0, i) => K.sec(SE, s0 + (i ? 0.01 : 0), cuts[i + 1] - (i < cuts.length - 2 ? 0.01 : 0), y0, y1, 'brick', 0));
  const lower = secs(Y(0.62), Y(6.7)), upper = secs(Y(6.72), Y(15.1));
  const at = (ss: Sec[], s: number) => ss.find(q => s > q.s0 && s < q.s1)!;
  const f = K.faceFrame(lower[0], 0);
  // ground floor: four windows and the water door, white-framed sashes with dark bars
  SE_WIN.forEach((s, i) => {
    if (i === 2) K.opening(at(lower, s), s, Y(1.6), 2.05, 3.9, {frame: 'frame', back: 'glass', depth: 0.2, edge: 0.08, cols: 2, rows: 1, bars: [2.6]});
    else K.opening(at(lower, s), s, Y(2.45), 2.05, 3.0, {frame: 'frame', back: 'glass', depth: 0.2, edge: 0.08, cols: 2, rows: 2});
    // first floor: tall sashes, upper and lower sash of three-by-two panes
    K.opening(at(upper, s), s, Y(7.25), 2.1, 3.9, {frame: 'frame', back: 'glass', depth: 0.22, edge: 0.08, cols: 2, rows: 4});
  });
  // white-painted plinth with the painted words, stone course over it
  const gaps = (y0: number, y1: number) => {   // wall intervals between the openings that cross the band y0..y1
    const holes = SE_WIN.map((s, i) => [s - 1.08, s + 1.08, i === 2 ? Y(1.6) : Y(2.45), Y(5.45)] as const).filter(h => h[2] < y1 && h[3] > y0);
    const out: Array<[number, number]> = []; let s = SE0;
    for (const h of holes) { if (h[0] > s) out.push([s, h[0]]); s = h[1]; }
    if (LSE > s) out.push([s, LSE]);
    return out;
  };
  for (const [a, z] of gaps(Y(0.62), Y(2.2))) slab(b, f, (a + z) / 2, Y(0.62), z - a, 1.58, 0.06, 'concrete');
  for (const [a, z] of gaps(Y(2.2), Y(2.38))) slab(b, f, (a + z) / 2, Y(2.2), z - a, 0.18, 0.12, 'stone');
  slab(b, f, 7.05, Y(1.05), 6.3, 0.95, 0.1, 'white', 0.06);
  slab(b, f, 19.35, Y(1.05), 3.6, 0.95, 0.1, 'white', 0.06);
  lettering(b, f, 'UNIVERSITEITS', 7.05, Y(1.2), 0.062, 0.025, 'dark', 0.16, 0.03);
  lettering(b, f, 'THEATER', 19.35, Y(1.2), 0.062, 0.025, 'dark', 0.16, 0.05);
  // the white stripes of the ground floor, interrupted by the openings
  for (const [y0, y1] of [[2.95, 3.35], [4.1, 4.45], [5.45, 5.8]] as const) for (const [a, z] of gaps(Y(y0), Y(y1))) slab(b, f, (a + z) / 2, Y(y0), z - a, y1 - y0, 0.06, 'white');
  // voussoir blocks over the ground windows (taller than the top stripe) and the first-floor windows
  for (const s of SE_WIN) for (const dt of [-0.85, 0, 0.85]) {
    slab(b, f, s + dt, Y(5.45), 0.45, 0.5, 0.13, 'white');       // 7 cm before the stripe it crosses
    slab(b, f, s + dt, Y(11.15), 0.45, 0.45, 0.08, 'white');
  }
  // sills
  for (const s of SE_WIN) { slab(b, f, s, Y(7.05), 2.4, 0.15, 0.14, 'stone'); }
  for (const s of cuts.slice(1, -1)) slab(b, f, s, Y(0.62), 0.3, Y(6.72) - Y(0.62), 0.04, 'brick', -0.08);
  // dark stone belt over the ground floor
  slab(b, f, (SE0 + LSE) / 2, Y(6.55), LSE - SE0, 0.3, 0.2, 'stone');
  // brick pilasters with cream bases and capitals
  for (const [s, w] of SE_PIL) {
    const w2 = Math.min(w, LSE - s + w / 2 - 0.02, s - SE0 + w / 2);
    slab(b, f, s, Y(6.85), w2, Y(13.0) - Y(6.85), 0.12, 'brick');
    slab(b, f, s, Y(6.85), w2 + 0.16, 0.3, 0.2, 'sandstone');
    slab(b, f, s, Y(13.0), w2 + 0.2, 0.4, 0.22, 'sandstone');
  }
  // festoon relief panels
  for (const s of SE_WIN) festoonPanel(b, f, s, Y(12.0), 2.45, 0.75, {panel: 'sandstone', swag: 'white', d: 0.06, relief: 0.06});
  // architrave: two cream fasciae across the pilaster tops
  slab(b, f, (SE0 + LSE) / 2, Y(13.4), LSE - SE0, 0.18, 0.24, 'sandstone');
  slab(b, f, (SE0 + LSE) / 2, Y(13.65), LSE - SE0, 0.22, 0.27, 'sandstone');
  // cornice with modillions, then the balustrade between brick dies over the pilasters
  const yc = top;
  profileAlong(b, f, SE0 + 0.1, LSE - 0.1, corniceSection(yc, Y(15.4) - yc, 0.62, 0.35), 'sandstone');
  modillions(b, f, SE0 + 0.3, LSE - 0.3, yc + 0.05, {pitch: 0.42, w: 0.14, h: 0.14, d: 0.48, c: 'stone'});   // grey: they read as shadowed blocks under the corona
  balustradeRun(b, f, SE0 + 0.05, LSE - 0.05, Y(15.4), {h: 0.62, d: 0.22, pitch: 0.21, c: 'sandstone', dies: SE_PIL.map(p => Math.min(Math.max(p[0], SE0 + 0.5), LSE - 0.5)), dieW: 0.95, dieH: 0.85, die: 'brick', cap: 'sandstone', out: 0.05});
  // back of the parapet over the roof: brick skin from below the 3DBAG roof up to the cornice top, facing the roof
  const P3 = (s: number, y: number, o: number) => { const fr = frameAt(SE, s, o); return [fr.origin[0], y, fr.origin[1]]; };
  const inward = [-f.n[0], 0, -f.n[1]];
  M.quad('brick', P3(SE0, 11.0, -0.46), P3(LSE, 11.0, -0.46), P3(LSE, Y(15.4), -0.46), P3(SE0, Y(15.4), -0.46), inward);
  // ends of the parapet skin
  for (const [s, sg] of [[SE0, -1], [LSE, 1]] as const) {
    const tn = [f.tangent[0] * sg, 0, f.tangent[1] * sg];
    M.quad('brick', P3(s, 11.0, 0), P3(s, 11.0, -0.46), P3(s, Y(15.4), -0.46), P3(s, Y(15.4), 0), tn);
  }
}

// ---- the Nieuwe Doelenstraat front ---------------------------------------------------------------------------------------
const ROWS: Array<[number, number]> = [[2.0, 3.3], [6.6, 2.3], [10.0, 2.2]];
function doelenstraat(c: Ctx) {
  const {K, b} = c;
  const base = K.sec(NW, 0, LNW, 0, 1.25, 'stone', 0);
  const S = K.sec(NW, 0, LNW, 1.25, NW_TOP, 'red', 0);
  K.sec(NW, 0, LNW, NW_TOP, NW_EAVES, 'red', 0);                 // behind the entablature, up to the kept 3DBAG wall
  const f = K.faceFrame(S, 0);
  const sash = (s: number, y: number, w: number, h: number) => {
    K.opening(S, s, y, w, h, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.1, cols: 2, rows: 2});
    slab(b, f, s, y - 0.16, w + 0.2, 0.12, 0.1, 'stone');
  };
  const column = (s: number, w: number, skipGround = false) => ROWS.forEach(([y, h], i) => { if (!(i === 0 && skipGround)) sash(s, y, w, h); });
  // the narrow house at the north-east end (0-2.9 m) and the four-bay house (2.9-11.65 m)
  column(1.45, 1.15);
  for (const s of [3.65, 8.45, 10.85]) column(s, 1.35);
  column(5.95, 1.35, true);
  // its front door in the second bay, transom light, stoop
  K.opening(S, 5.95, 1.35, 0.95, 2.95, {frame: 'white', back: 'ochre', depth: 0.22, edge: 0.08, cols: 2});
  K.opening(S, 5.95, 4.45, 0.95, 0.85, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07, cols: 3});
  for (let k = 0; k < 4; k++) slab(b, f, 5.95, k * 0.32, 1.5, 0.32, 1.25 - k * 0.3, 'stone');
  // basement windows
  for (const s of [3.65, 8.45, 10.85, 14.4, 23.0]) K.opening(base, s, 0.3, 0.9, 0.65, {frame: 'white', back: 'dark', depth: 0.15, edge: 0.05, cols: 2});
  // the plain house (11.65-16.25 m) with one window column, and the house beyond the entrance (20.15-25.28 m)
  column(14.4, 1.5);
  column(23.0, 1.45);
  // the entrance bay: white doorcase with pilasters and entablature, fanlight, the tall window with its balcony rail
  // and crowned surround, and a smaller top window
  const E = 18.2;
  K.opening(S, E, 1.35, 1.3, 2.95, {frame: 'white', back: 'ochre', depth: 0.25, edge: 0.08, cols: 2});
  K.opening(S, E, 4.45, 1.3, 0.85, {frame: 'white', back: 'glass', depth: 0.2, edge: 0.07, cols: 4});
  for (const sd of [-1, 1]) slab(b, f, E + sd * 1.12, 0.6, 0.38, 4.9, 0.14, 'white');
  slab(b, f, E, 5.5, 2.75, 0.55, 0.22, 'white');
  slab(b, f, E, 6.05, 2.95, 0.12, 0.3, 'white');
  for (let k = 0; k < 3; k++) slab(b, f, E, k * 0.3, 2.2, 0.3, 1.0 - k * 0.3, 'stone');
  K.opening(S, E, 6.6, 1.35, 3.0, {frame: 'white', back: 'glass', depth: 0.2, edge: 0.08, cols: 2, rows: 3});
  slab(b, f, E, 6.6, 1.25, 0.65, 0.12, 'dark', 0.06);                // the balcony rail across its foot
  for (const sd of [-1, 1]) slab(b, f, E + sd * 0.915, 6.45, 0.32, 3.4, 0.1, 'white');   // 8 cm clear of the reveal
  K.archHead(S, E, 9.85, 2.05, 0.45, 0.3, 0.1, 'white');
  K.opening(S, E, 10.75, 1.15, 1.5, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.08, cols: 2, rows: 2});
  // white entablature under the roof: a fascia band and a cornice to the 3DBAG eaves
  slab(b, f, LNW / 2, NW_TOP - 0.25, LNW - 0.2, 0.25, 0.12, 'white');   // ends 10 cm in from the party-wall planes
  const eave = NW_EAVES;
  profileAlong(b, f, 0.1, LNW - 0.1, [[-0.3, NW_TOP], [0.1, NW_TOP], [0.1, NW_TOP + 0.6], [0.3, NW_TOP + 0.8], [0.42, NW_TOP + 0.95], [0.42, eave], [-0.3, eave]], 'white');
}

export function buildUniversiteitstheater(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    amstel(c);
    doelenstraat(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
