import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {poly, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {cutFrontWalls, lettering, profileAlong, TriSink, verticalLettering, type XZ} from './venue-kit';
import source from './zaal-100-footprints.json' with {type: 'json'};

/**
 * Zaal 100, De Wittenstraat 100 (BAG pand 0363100012158161, BAG year 1892): the 'podium voor ongehoord geluid' (amateur
 * theatre, odd concerts, poetry, an improvised-jazz night; zaal100.nl/over-zaal-100) in a building of 1892 (BAG) whose
 * 38 m street front runs along the De Wittenstraat (ring 17 -> 18, s from the south-west end).
 *
 * Drawn from the rectified Gemeente Amsterdam panorama TMX7316010203-002554_pano_0000_006569 (2022-05-02, 9 m, 12 deg;
 * CC BY 4.0, venue-face-crops.ts at 30 px/m), cross-checked on recording_2024-09-11_11-32-11_00854 (2024-09-11). The crop
 * foot sits below the pavement: the ground-floor sills and door feet put the pavement at crop py 558, so y = (558 - py) / 30.
 *
 * Light salmon-buff brick in five bays between brick lesenes, each storey a triplet of tall segment-headed windows (a wide
 * one between two narrow ones) under red-brick arch rings, light stone string courses at the sills, a light
 * cornice with white consoles at the lesenes, four dormers with flared white hoods in the roof, and in the middle bay a
 * crested gable over the cornice with a small round-headed window. The south-west bay holds the venue: three black
 * ground-floor windows painted 1 0 0, a ZAAL 100 sign band and a ZAAL 100 banner on the lesene reading top-down. Roofs and the side and
 * back walls keep the 3DBAG LoD2.2 shell (CC BY 4.0); the side walls adjoin the neighbours.
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const F: Chord = {a: R[17], b: R[18]};
const L = Math.hypot(R[18][0] - R[17][0], R[18][1] - R[17][1]);
const Y = (py: number) => Math.round((558 - py) / 30 * 100) / 100;
const CORNICE = Y(118), EAVES = Y(100);
const LESENES = [7.73, 15.17, 23.0, 30.5];
const BAYS: Array<[number, number]> = [[0, 7.73], [7.73, 15.17], [15.17, 23.0], [23.0, 30.5], [30.5, L]];
const GABLE: [number, number] = [15.65, 22.6];
const TRIPLET = (b0: number, b1: number): Array<[number, number]> => {
  const m = (b0 + b1) / 2;
  return [[m - 2.05, 1.25], [m, 2.0], [m + 2.05, 1.25]];
};

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

function shell(c: Ctx) {
  const cut = cutFrontWalls(SRC.surfaces, [R[17], R[18], R[0]], F, [[-0.6, GABLE[0], EAVES], [GABLE[1], L + 0.6, EAVES]]);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'slate'});
}

const win = {frame: 'white' as const, back: 'glass' as const, depth: 0.2, edge: 0.07};

function front(c: Ctx) {
  const {K, b} = c;
  const S: Sec[] = BAYS.map(([s0, s1], i) => K.sec(F, s0 + (i ? 0.01 : 0), s1 - (i < BAYS.length - 1 ? 0.01 : 0), 0, CORNICE, 'brick', 0));
  const at = (s: number) => S.find(q => s > q.s0 && s < q.s1)!;
  const f = K.faceFrame(S[0], 0);
  const floors: Array<[number, number]> = [[Y(300), Y(410)], [Y(158), Y(268)]];        // [top, foot] of the upper storeys
  // upper storeys: segment-headed triplets under red-brick arch rings (the photo's rings are orange-red brick, not stone), stone sill courses
  for (const [s0, s1] of BAYS) for (const [top, foot] of floors) for (const [s, w] of TRIPLET(s0, s1)) {
    K.opening(at(s), s, foot, w, top - foot, {...win, cols: w > 1.5 ? 3 : 2, rows: 3, rise: 0.28});
    K.archHead(at(s), s, top - 0.28, w, 0.28, 0.2, 0.07, 'red');
  }
  for (const [, foot] of floors) slab(b, f, L / 2, foot - 0.3, L - 0.1, 0.22, 0.08, 'stone');
  slab(b, f, L / 2, Y(300) + 0.35, L - 0.1, 0.16, 0.08, 'stone');                    // band over the first floor
  // ground floor: bays C-E triplets as above; bay B the round-headed entrance and a window; bay A the 1 0 0 windows
  const gTop = Y(445), gFoot = Y(535);
  for (const [s0, s1] of BAYS.slice(2)) for (const [s, w] of TRIPLET(s0, s1)) {
    K.opening(at(s), s, gFoot, w, gTop - gFoot, {...win, cols: w > 1.5 ? 3 : 2, rows: 2, rise: 0.25});
    K.archHead(at(s), s, gTop - 0.25, w, 0.25, 0.2, 0.07, 'red');
  }
  K.opening(at(10.0), 10.0, 0.05, 1.9, Y(458) - 0.05, {frame: 'white', back: 'blue', depth: 0.3, edge: 0.09, cols: 2, bars: [2.4], rise: 0.95});
  K.archHead(at(10.0), 10.0, Y(458) - 0.95, 1.9, 0.95, 0.22, 0.08, 'red');
  K.opening(at(13.15), 13.15, gFoot, 1.9, gTop - gFoot, {...win, cols: 3, rows: 2, rise: 0.25});
  K.archHead(at(13.15), 13.15, gTop - 0.25, 1.9, 0.25, 0.2, 0.07, 'red');
  const nums = [[2.0, '1'], [4.1, '0'], [6.1, '0']] as const;
  for (const [s, ch] of nums) {
    K.opening(at(s), s, Y(535), s === 4.1 ? 2.0 : 1.3, Y(450) - Y(535), {frame: 'dark', back: 'dark', depth: 0.22, edge: 0.08});
    lettering(b, f, ch, s, Y(520), 0.2, 0.03, 'concrete', -0.17);                // the white numerals painted on the glass
  }
  slab(b, f, 4.1, Y(445), 6.0, Y(418) - Y(445), 0.12, 'ochre');                       // the ZAAL 100 sign band
  lettering(b, f, 'ZAAL 100', 4.1, Y(442), 0.06, 0.03, 'dark', 0.12);
  // the ZAAL 100 banner on the first lesene: a dark banner hung 0.25 m off the wall from a bracket arm, its lettering
  // reading top-down (small gold ZAAL over a large white 100), crop x 185-215, py 385-470
  const bTop = Y(385), bFoot = Y(470), bOut = 0.25;
  slab(b, f, 7.73, bFoot, 0.85, bTop - bFoot, 0.05, 'dark', bOut);
  slab(b, f, 7.73, bTop, 1.0, 0.06, bOut + 0.12, 'dark');                           // bracket arm
  const zw = verticalLettering(b, f, 'ZAAL', 7.73 - 0.12, bTop - 0.12, 0.045, 0.03, 'ochre', bOut + 0.05, 'down');
  verticalLettering(b, f, '100', 7.73 - 0.02, bTop - 0.12 - zw - 0.18, 0.085, 0.03, 'concrete', bOut + 0.05, 'down');
  // lesenes up into consoles under the cornice; plinth course
  for (const s of [0.2, ...LESENES, L - 0.2]) {
    const w = s < 1 || s > L - 1 ? 0.38 : 0.5;
    slab(b, f, s, 0, w, CORNICE - 0.1, 0.14, 'brick');
    slab(b, f, s, CORNICE - 0.55, w + 0.12, 0.5, 0.3, 'white');
  }
  slab(b, f, L / 2, 0, L - 0.02, 0.5, 0.05, 'stone', 0.0);
  profileAlong(b, f, 0.02, L - 0.02, [[-0.3, CORNICE - 0.05], [0.32, CORNICE - 0.05], [0.42, CORNICE + 0.12], [0.42, EAVES + 0.08], [-0.3, EAVES + 0.08]], 'white');
  gable(c, f);
  dormers(c);
}

/** The crested gable over the middle bay: brick triangle with stepped stone coping, a small round-headed window, white crest. */
function gable(c: Ctx, f: ReturnType<FrontKit['faceFrame']>) {
  const {b} = c;
  const [g0, g1] = GABLE, m = (g0 + g1) / 2, half = (g1 - g0) / 2, y0 = EAVES + 0.08, apex = 19.2, back = -2.4;   // apex to the 3DBAG cross-gable ridge (19.3 m; crop py 5 reads 18.4)
  poly(b, f, m, y0, [[-half, 0], [half, 0], [0, apex - y0]], -back, 'brick', back);
  // the small round-headed window: glass panel and white frame standing on the gable face
  const wy = y0 + 0.4, wh = 1.1;
  slab(b, f, m, wy, 0.62, wh - 0.31, 0.06, 'glass');
  poly(b, f, m, wy + wh - 0.31, [[0.31, 0], [0.22, 0.22], [0, 0.31], [-0.22, 0.22], [-0.31, 0]], 0.06, 'glass');
  for (const sd of [-1, 1]) slab(b, f, m + sd * 0.35, wy, 0.08, wh - 0.31, 0.1, 'white');
  slab(b, f, m, wy - 0.08, 0.8, 0.08, 0.12, 'stone');
  // stepped stone coping along the rakes, a pinnacle at the apex and the white crest pieces under it
  for (let k = 0; k < 6; k++) {
    const u = (k + 0.5) / 6, h = (apex - y0) * u;
    for (const sd of [-1, 1]) slab(b, f, m + sd * half * (1 - u), y0 + h - 0.25, 0.55, 0.3, 0.12, 'stone', -0.4);
  }
  slab(b, f, m, apex - 0.15, 0.5, 0.9, 0.14, 'stone', -0.4);
  for (const sd of [-1, 1]) slab(b, f, m + sd * 0.9, Y(75), 0.3, 0.5, 0.1, 'white');
}

/** Four dormers with flared white hoods in the front roof slope (crop x 95-175, 320-380, 750-825, 955-1050; the fourth
 *  stands in the raised north-east roof piece of the 3DBAG shell). */
function dormers(c: Ctx) {
  const {b} = c;
  for (const [s, w] of [[4.5, 2.4], [11.67, 2.0], [26.25, 2.4], [33.8, 2.4]] as Array<[number, number]>) {
    const fr = frameAt(F, 0, -0.6), y0 = EAVES - 0.1, y1 = EAVES + 1.5;
    slab(b, fr, s, y0, w, y1 - y0, 1.6, 'brick', -1.6);
    slab(b, fr, s, y0 + 0.65, w - 0.4, y1 - y0 - 0.85, 0.06, 'glass', 0.0);
    poly(b, fr, s, y1, [[-w / 2 - 0.35, 0], [w / 2 + 0.35, 0], [w / 2 - 0.1, 0.45], [-w / 2 + 0.1, 0.45]], 1.9, 'white', -1.7);
  }
}

export function buildZaal100(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    front(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
