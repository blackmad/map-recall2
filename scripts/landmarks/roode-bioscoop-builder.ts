import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {poly, setSink, slab} from './nearbar-kit';
import {makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {balustradeRun, cutFrontWalls, lettering, profileAlong, segDist, type XZ} from './venue-kit';
import {archFillOutline, archRingOutline} from './street-front-kit';
import source from './roode-bioscoop-footprints.json' with {type: 'json'};

/**
 * De Roode Bioscoop, Haarlemmerplein 7 (BAG pand 0363100012169536, BAG year 2006): the music theatre in the former
 * cinema Ons Genoegen / Westerbioscoop of 1913 (nl.wikipedia.org/wiki/De_Roode_Bioscoop). The pand holds the narrow
 * house on the Haarlemmerplein (ring 0 -> 2, 5.75 m), the low hall behind it and a 2006 housing block on the side street
 * (ring 8 -> 9, 10.15 m). Both street fronts are drawn from rectified Gemeente Amsterdam panoramas (CC BY 4.0,
 * venue-face-crops.ts at 50 px/m): TMX7316010203-000188_pano_0000_002611 (2016-11-22) and
 * TMX7316010203-000704_pano_0001_000120 (2018-05-03) square-on across the plein, b_20241216_0911_Track48_Sphere_00035
 * (2024-12-16) for the side block. Crop foot = pavement, 1 px = 2 cm, so crop metres are model metres.
 *
 * The plein house: yellow-ochre brick, three storeys of white-cased windows with red sashes either side of red French
 * doors on balconies with iron railings, a ground floor with a wide segment-arched red entrance between two red side
 * doors, ROODE BIOSCOOP lettered across the fascia, a cornice with corner pinnacles, and a neck gable with a round-arched
 * window and a segmental crown rising out of the dark mansard roof. Roofs, the hall and the party walls keep the 3DBAG
 * LoD2.2 shell (CC BY 4.0); the shell's front wall is kept above the cornice so the mansard's end closes on the plein.
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const P: Chord = {a: R[0], b: R[2]};
const LP = Math.hypot(R[2][0] - R[0][0], R[2][1] - R[0][1]);
const W: Chord = {a: R[8], b: R[9]};
const LW = Math.hypot(R[9][0] - R[8][0], R[9][1] - R[8][1]);
const MID = LP / 2;
const CORNICE = 13.25;           // top of the brick front under the cornice (crop py 185 of 850 at 50 px/m)
const SIDE_TOP = 12.45;          // side block wall top (3DBAG roof50 12.5)
const NECK_HALF = 1.05;          // neck shaft half-width (crop 82-188 px)

type Ctx = {K: FrontKit; b: BuildingTools};

function shell(c: Ctx) {
  let cut = cutFrontWalls(SRC.surfaces, [R[0], R[1], R[2]], P, [[-0.6, MID - NECK_HALF, CORNICE], [MID + NECK_HALF, LP + 0.6, CORNICE]]);
  cut = cutFrontWalls(cut, [R[8], R[9]], W, [[-0.6, LW + 0.6, SIDE_TOP]]);
  // the shell's front wall kept above the cornice is the end of the mansard: slate, as the photos show either side of the neck
  const mansardEnd = (s: Surface) => s.type === 'WallSurface' && Math.min(...s.rings[0].map(p => p[1])) >= CORNICE - 0.05 &&
    s.rings[0].every(p => segDist([p[0], p[2]], R[0], R[2]).d < 0.7);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'slate', wallFor: s => (mansardEnd(s) ? 'slate' : 'brick')});
}

const sash = {frame: 'white' as const, sash: 'red' as const, back: 'glass' as const, depth: 0.2, edge: 0.07};

function plein(c: Ctx) {
  const {K, b} = c;
  const S: Sec = K.sec(P, 0, LP, 0, CORNICE, 'brick', 0);
  const f = K.faceFrame(S, 0);
  // ground floor: red side doors with transoms, the wide segment-arched entrance with its glazed fanlight
  for (const s of [MID - 2.05, MID + 2.05]) K.opening(S, s, 0.05, 0.86, 2.95, {frame: 'red', back: 'red', depth: 0.22, edge: 0.08, bars: [2.25]});
  K.opening(S, MID, 0.05, 2.2, 3.6, {frame: 'red', back: 'red', depth: 0.28, edge: 0.1, cols: 2, bars: [2.55], rise: 0.6});
  K.archHead(S, MID, 3.05, 2.2, 0.6, 0.18, 0.08, 'brick');
  slab(b, f, MID, 2.62, 2.0, 0.85, 0.06, 'glass', -0.2);                 // fanlight glazing behind the red tracery
  // the fascia: a darker brick band with ROODE BIOSCOOP in white letters either side of the balcony console
  slab(b, f, MID, 3.85, LP - 0.64, 0.62, 0.12, 'red');
  lettering(b, f, 'ROODE', 1.02, 4.0, 0.04, 0.025, 'stone', 0.12);
  lettering(b, f, 'BIOSCOOP', LP - 1.4, 4.0, 0.036, 0.025, 'stone', 0.12);
  // three storeys: windows either side, French doors in the middle on balconies
  const floors: Array<[number, number]> = [[5.0, 6.9], [7.8, 9.64], [10.5, 12.36]];
  const doorFoot = [4.6, 7.3, 10.06];
  floors.forEach(([y0, y1], i) => {
    for (const s of [MID - 1.85, MID + 1.85]) {
      K.opening(S, s, y0, 1.12, y1 - y0, {...sash, bars: [(y1 - y0) * 0.68]});
      slab(b, f, s, y0 - 0.16, 1.3, 0.12, 0.1, 'stone');                    // stone sill
    }
    K.opening(S, MID, doorFoot[i], 1.08, y1 - doorFoot[i], {...sash, cols: 2, bars: [y1 - doorFoot[i] - 0.5]});
    // balcony: stone slab on two consoles, iron railing round its front
    const yb = doorFoot[i] - 0.2;
    slab(b, f, MID, yb, 2.05, 0.16, 0.62, 'stone');
    for (const s of [MID - 0.8, MID + 0.8]) slab(b, f, s, yb - 0.38, 0.16, 0.38, 0.45, 'stone');
    balustradeRun(b, f, MID - 1.0, MID + 1.0, yb + 0.16, {h: 0.9, d: 0.04, pitch: 0.14, c: 'bronze', out: 0.55});
  });
  // brick piers framing the front up into the corner pinnacles; cornice moulding between them
  for (const s of [0.16, LP - 0.16]) {
    slab(b, f, s, 0, 0.3, CORNICE + 0.7, 0.08, 'brick');
    slab(b, f, s, CORNICE + 0.7, 0.34, 0.12, 0.12, 'stone');
    poly(b, f, s, CORNICE + 0.82, [[-0.15, 0], [0.15, 0], [0, 0.32]], 0.1, 'stone');
  }
  profileAlong(b, f, 0.32, LP - 0.32, [[-0.3, CORNICE - 0.25], [0.12, CORNICE - 0.25], [0.12, CORNICE - 0.1], [0.24, CORNICE], [0.24, CORNICE + 0.14], [-0.3, CORNICE + 0.14]], 'stone');
  neck(c, f);
}

/** The neck gable over the middle bay: shaft with a round-arched window, shoulder scrolls, cornice and segmental crown. */
function neck(c: Ctx, f: ReturnType<FrontKit['faceFrame']>) {
  const {K, b} = c;
  const y0 = CORNICE + 0.14, yc = 15.62, half = NECK_HALF, back = -1.6, face = 0.08;
  // shaft face (cut window) 8 cm before the plein front; its body runs back into the mansard behind the reveal
  const N = K.sec(P, MID - half, MID + half, y0, yc, 'brick', face);
  K.opening(N, MID, y0 + 0.2, 0.8, 1.6, {...sash, depth: 0.18, rise: 0.4, bars: [1.0]});
  K.archHead(N, MID, y0 + 1.4, 0.8, 0.4, 0.12, 0.07, 'stone');
  slab(b, f, MID, y0, 2 * half, yc - y0, -0.16 - back, 'brick', back);
  K.endCap(P, MID - half, y0, yc, 'brick', -1, -0.16, face);
  K.endCap(P, MID + half, y0, yc, 'brick', 1, -0.16, face);
  // shoulder scrolls at the shaft foot, leaning on its sides
  poly(b, f, MID - half - 0.18, y0, [[-0.18, 0], [0.18, 0], [0.18, 0.55]], 0.12, 'stone');
  poly(b, f, MID + half + 0.18, y0, [[-0.18, 0], [0.18, 0], [-0.18, 0.55]], 0.12, 'stone');
  // crowning cornice and the segmental crown with a stone rim
  slab(b, f, MID, yc, 2 * half + 0.24, 0.16, face + 0.14 - back, 'stone', back);
  poly(b, f, MID, yc + 0.16, archFillOutline(2 * half, 0.78, 8), face - back, 'brick', back);
  poly(b, f, MID, yc + 0.16, archRingOutline(2 * half, 0.78, 0.1, 8), 0.07, 'stone', face);
}

/** The 2006 side block on the side street: white-rendered shop floor under a concrete band, three brick storeys. */
function side(c: Ctx) {
  const {K, b} = c;
  const S0 = K.sec(W, 0, LW, 0, 3.6, 'concrete', 0);
  const S1 = K.sec(W, 0, LW, 3.62, SIDE_TOP, 'greyBrick', 0);
  const f = K.faceFrame(S0, 0);
  for (const [s, w] of [[0.7, 0.8], [2.9, 2.3], [5.95, 0.85], [7.25, 0.85]] as Array<[number, number]>) K.opening(S0, s, 0.05, w, 2.6, {frame: 'dark', back: 'dark', depth: 0.18, edge: 0.06, bars: [2.1]});
  K.opening(S0, 8.85, 0.45, 1.9, 2.3, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07, cols: 2, bars: [1.8]});
  slab(b, f, LW / 2, 3.1, LW - 0.04, 0.5, 0.12, 'concrete');                    // concrete band over the shop floor
  const cols = [1.2, 3.2, 5.75, 7.45, 9.1];
  for (const [y0, y1] of [[4.0, 6.0], [7.1, 9.0], [10.3, 11.95]] as Array<[number, number]>) {
    for (const s of cols) {
      K.opening(S1, s, y0, 1.3, y1 - y0, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07, cols: 2});
      if (y0 < 10) balustradeRun(b, f, s - 0.62, s + 0.62, y0 + 0.05, {h: 0.85, d: 0.03, pitch: 0.16, c: 'bronze', out: 0.06});
      slab(b, f, s, y0 - 0.14, 1.42, 0.1, 0.08, 'concrete');
    }
  }
  slab(b, f, LW / 2, SIDE_TOP - 0.02, LW, 0.14, 0.1, 'concrete');               // coping
}

export function buildRoodeBioscoop(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b};
    shell(c);
    plein(c);
    side(c);
    K.flush();
  } finally {
    setSink(0);
  }
}
