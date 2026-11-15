import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, setSink, slab} from './nearbar-kit';
import {makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {balustradeRun, cutFrontWalls, lettering, profileAlong, type XZ} from './venue-kit';
import source from './cristofori-footprints.json' with {type: 'json'};

/**
 * Cristofori, Prinsengracht 581-583 (BAG pand 0363100012253896, BAG year 1905): two warehouses rebuilt in the first
 * decade of the 20th century to a design by A.M.A. Gulden for the Adler cycle wholesaler, with the flattened roof and a
 * three-storey front in natural stone, timber and glass; piano dealer Cristofori later built its showroom and concert
 * salon in it, and its name still stands in large letters on the front (nl.wikipedia.org/wiki/Prinsengracht_581-583).
 *
 * The 11.5 m canal front (ring 7 -> 0, s from the north end) is drawn from rectified Gemeente Amsterdam panoramas across
 * the Prinsengracht (CC BY 4.0, venue-face-crops.ts at 50 px/m): TMX7316010203-000205_pano_0000_001106 (2017-03-13,
 * 19 m, the clearest), TMX7316010203-001974_pano_0000_000921 (2021-01-22) and TMX7316010203-003007_pano_0007_000009
 * (2023-03-20, the parapet). Crop pavement at py 950, 1 px = 2 cm, so y = (950 - py) / 50.
 *
 * Grey stone over the ground and first floors: two wide arched openings with cream surrounds (doors, a signboard band and
 * a railed fanlight in each), CRISTOFORI in gold letters between them and the first-floor windows, a small emblem on the
 * middle pier, and six first-floor windows; above a stone string course, dark brown brick in two mirrored halves (the two
 * former warehouses), each storey a wide round-arched French window on a balcony between two narrow round-arched windows,
 * under a corbelled brick parapet with stepped blocks. Roof and the other walls keep the 3DBAG LoD2.2 shell (CC BY 4.0);
 * the back wall has no panorama and stays plain (inferred).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const F: Chord = {a: R[7], b: R[0]};
const L = Math.hypot(R[0][0] - R[7][0], R[0][1] - R[7][1]);
const Y = (py: number) => Math.round((950 - py) / 50 * 100) / 100;
const STONE_TOP = Y(545), TOP = 19.25, PARAPET = 19.95;
const HALF = L / 2;
/** Upper-floor columns per half (crop x / 50): narrow, wide (French window on a balcony), narrow. */
const COLS = (o: number): Array<[number, number, boolean]> => [[o + 0.86, 0.62, false], [o + 2.6, 1.6, true], [o + 4.2, 0.62, false]];

type Ctx = {K: FrontKit; b: BuildingTools};

function shell(c: Ctx) {
  const cut = cutFrontWalls(SRC.surfaces, [R[7], R[8], R[0]], F, [[-0.6, L + 0.6, PARAPET]]);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'slate'});
}

const win = {frame: 'white' as const, back: 'glass' as const, depth: 0.2, edge: 0.07};

function front(c: Ctx) {
  const {K, b} = c;
  const G: Sec = K.sec(F, 0, L, 0, STONE_TOP, 'stone', 0);
  const U: Sec = K.sec(F, 0, L, STONE_TOP + 0.02, TOP, 'brick', 0);
  const f = K.faceFrame(G, 0);
  // ground floor: two wide round-arched openings; doors under a cream signboard band, a railed fanlight above
  for (const s of [2.37, 8.2]) {
    const w = 3.75, y0 = 0.05, top = Y(715), rise = 0.95;
    K.opening(G, s, y0, w, top - y0, {frame: 'white', back: 'glass', depth: 0.3, edge: 0.1, cols: 4, bars: [2.0, 2.8], rise});
    K.archHead(G, s, top - rise, w, rise, 0.22, 0.08, 'white');
    slab(b, f, s, 2.0, w - 0.2, 0.8, 0.04, 'white', -0.26);                // signboard band inside the reveal
    balustradeRun(b, f, s - w / 2 + 0.15, s + w / 2 - 0.15, 2.82, {h: 0.62, d: 0.03, pitch: 0.18, c: 'bronze', out: -0.2});
    for (const sd of [-1, 1]) slab(b, f, s + sd * (w / 2 + 0.15), 0, 0.22, top - rise, 0.08, 'white');   // cream jambs
  }
  disc(b, f, 5.3, Y(805), 0.32, 0.06, 'bronze');                                          // the emblem on the middle pier
  // CRISTOFORI in gold letters between the arches and the first floor
  lettering(b, f, 'CRISTOFORI', L / 2 - 0.1, Y(712), 0.056, 0.06, 'gold', 0, 0.2);
  // first floor (stone): six windows in two mirrored groups, ornamental balconettes under the wide ones
  const y1 = Y(640), h1 = Y(560) - y1;
  for (const [s, w] of [[0.83, 1.06], [2.53, 1.55], [4.1, 0.8], [6.48, 1.04], [8.2, 1.6], [9.92, 1.04]] as Array<[number, number]>) {
    K.opening(G, s, y1, w, h1, {...win, cols: w > 1.2 ? 3 : 2, bars: [h1 * 0.72]});
    slab(b, f, s, y1 - 0.16, w + 0.16, 0.12, 0.1, 'white');
  }
  for (const s of [2.53, 8.2]) {
    slab(b, f, s, y1 - 0.75, 1.3, 0.55, 0.05, 'white');                                   // carved panel under the balconette
    balustradeRun(b, f, s - 0.75, s + 0.75, y1 - 0.04, {h: 0.55, d: 0.03, pitch: 0.16, c: 'bronze', out: 0.12});
  }
  profileAlong(b, f, 0.02, L - 0.02, [[-0.2, STONE_TOP - 0.18], [0.14, STONE_TOP - 0.18], [0.2, STONE_TOP - 0.06], [0.2, STONE_TOP + 0.1], [-0.2, STONE_TOP + 0.1]], 'stone');
  // brick storeys: per half a narrow arched window, a wide arched French window on a railed balcony, a narrow one
  const floors: Array<[number, number]> = [[Y(480), Y(410)], [Y(330), Y(260)], [Y(180), Y(75)]];
  for (const [y0, y1t] of floors) {
    for (const o of [0, HALF]) {
      for (const [s, w, wide] of COLS(o)) {
        const foot = wide ? y0 - 0.55 : y0;
        K.opening(U, s, foot, w, y1t - foot, {...win, cols: wide ? 2 : 1, rise: w / 2, bars: wide ? [y1t - foot - w / 2 - 0.1] : []});
        if (wide) {
          slab(b, f, s, foot - 0.2, w + 0.3, 0.16, 0.5, 'stone');
          balustradeRun(b, f, s - w / 2 - 0.1, s + w / 2 + 0.1, foot - 0.04, {h: 0.85, d: 0.03, pitch: 0.12, c: 'bronze', out: 0.44});
        } else slab(b, f, s, foot - 0.16, w + 0.14, 0.12, 0.1, 'stone');
      }
    }
  }
  // corbelled brick parapet: dentil course, solid band, stepped blocks along the top
  profileAlong(b, f, 0.02, L - 0.02, [[-0.2, TOP - 0.45], [0.1, TOP - 0.45], [0.1, TOP - 0.3], [0.18, TOP - 0.22], [0.18, TOP], [-0.2, TOP]], 'brick');
  slab(b, f, L / 2, TOP, L - 0.02, PARAPET - TOP, 0.6, 'brick', -0.42);
  for (let s = 0.45; s < L - 0.2; s += 1.9) slab(b, f, s, PARAPET, 0.7, 0.3, 0.42, 'brick', -0.24);
  slab(b, f, L / 2, PARAPET, L - 0.02, 0.06, 0.32, 'stone', -0.24);
}

export function buildCristofori(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b};
    shell(c);
    front(c);
    K.flush();
  } finally {
    setSink(0);
  }
}
