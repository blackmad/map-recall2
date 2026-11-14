import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {awning, poly, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit} from './street-front-kit';
import {cutFrontWalls, lettering, type XZ} from './venue-kit';
import source from './escape-rembrandtplein-footprints.json' with {type: 'json'};

/**
 * Escape, Rembrandtplein 11 (BAG pand 0363100012171128): the nightclub in the former Rembrandtpleintheater. The square
 * front is a white-rendered box 15.7 m wide and 17.3 m tall (3DBAG) beside a narrow strip whose upper house is set
 * back 1.2 m. Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m over the
 * 18.4 m chord, ring vertex 23 to 26): b_20241211_0954_Track19_Sphere_00100 (2024), TMX7316010203-001900_pano_0005_000766
 * (2020, screen off) and TMX7316010203-002537_pano_0000_000552 (2022):
 *  - ground floor: dark glazed fronts under a glass canopy at 3.5 m, the café's red awning on the east half, the club
 *    entrance with its "Club" fascia in the narrow strip;
 *  - two ribbon windows of six lights (4.3-5.4 m, 7.2-8.6 m) either side of the sign band reading "Bavaria", the
 *    spaced capitals E S C A P E and "Heineken" with its red star;
 *  - the LED screen (14.6 x 7 m, 9.3-16.3 m) in a black frame over a white ledge, a white parapet band to 17.3 m.
 * The rest keeps the 3DBAG LoD2.2 shell (CC BY 4.0): the set-back strip house, the hall behind and its roofs.
 *
 * Native frame of escape-rembrandtplein-footprints.json (x east, z south, y up from the pavement).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const ST: Chord = {a: R[23], b: R[26]};
const L = Math.hypot(R[26][0] - R[23][0], R[26][1] - R[23][1]);
const BOX = [2.69, L] as const, MID = (BOX[0] + BOX[1]) / 2, TOP = 17.3, STRIP_TOP = 4.9;

type Ctx = {K: FrontKit; b: BuildingTools};

function shell(c: Ctx) {
  const cut = cutFrontWalls(SRC.surfaces, [R[23], R[26]], ST, [[-1, BOX[0], STRIP_TOP + 0.05], [BOX[0], L + 1, TOP + 0.1]]);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'stone', roof: 'concrete'});
}

function box(c: Ctx) {
  const {K, b} = c;
  const S = K.sec(ST, BOX[0], BOX[1], -0.3, TOP, 'stone', 0);
  const f = K.faceFrame(S, 0);
  const W = BOX[1] - BOX[0];
  // ground floor: glazed fronts, a door in the third bay
  const bays = (n: number, margin: number, pier: number, f: (s: number, w: number) => void) => {
    const pitch = (W - 2 * margin) / n;
    for (let k = 0; k < n; k++) f(BOX[0] + margin + pitch * (k + 0.5), pitch - pier);
  };
  // ground floor: six glazed bays under the ribbon axes
  bays(6, 0.4, 0.26, (s, w) => K.opening(S, s, 0, w, 3.3, {frame: 'frame', back: 'glass', depth: 0.25, edge: 0.08, bars: [2.5]}));
  // ribbon windows of six lights in white frames either side of the sign band
  bays(6, 0.4, 0.26, (s, w) => K.opening(S, s, 4.3, w, 1.1, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07}));
  bays(6, 0.4, 0.26, (s, w) => K.opening(S, s, 7.2, w, 1.4, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07}));
  // the sign band: Bavaria (shield and name), the spaced club name, Heineken and its star
  poly(b, f, 4.35, 5.9, [[-0.22, 0.6], [0.22, 0.6], [0.22, 0.2], [0, 0], [-0.22, 0.2]], 0.05, 'blue', 0);
  lettering(b, f, 'Bavaria', 5.95, 5.95, 0.066, 0.04, 'blue');
  lettering(b, f, 'ESCAPE', MID, 5.95, 0.075, 0.05, 'bronze', 0, 0.5);
  lettering(b, f, 'Heineken', 15.7, 5.95, 0.058, 0.04, 'green');
  const star: [number, number][] = [];
  for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.1 : 0.24; star.push([r * Math.cos(a), r * Math.sin(a)]); }
  poly(b, f, 15.7, 6.65, star, 0.05, 'red', 0);
  // white ledge under the screen, the LED screen in its black frame, the parapet band
  slab(b, f, MID, 9.0, W, 0.22, 0.35, 'stone');
  slab(b, f, MID, 9.3, W - 1.1, 7.0, 0.16, 'concrete');
  slab(b, f, MID, 9.45, W - 1.4, 6.7, 0.06, 'slate', 0.16);
  slab(b, f, MID, TOP - 0.35, W, 0.35, 0.12, 'stone');
}

function ground(c: Ctx) {
  const {K, b} = c;
  // the narrow strip's club entrance, its fascia lettered "Club"
  const S = K.sec(ST, 0, BOX[0], -0.3, STRIP_TOP, 'concrete', 0);
  const f = K.faceFrame(S, 0);
  K.opening(S, 1.35, 0, 1.7, 2.7, {frame: 'frame', back: 'dark', depth: 0.3, edge: 0.08});
  lettering(b, f, 'Club', 1.35, 3.95, 0.055, 0.04, 'stone');
  // glass canopy over the whole front, its dark fascia
  const fb = frameAt(ST, 0, 0);
  slab(b, fb, L / 2, 3.52, L - 0.3, 0.1, 2.2, 'canopyGlass');
  slab(b, fb, L / 2, 3.45, L - 0.3, 0.3, 0.12, 'concrete', 2.2);
  // the café's red awning on the east half, under the canopy
  awning(b, fb, 13.3, 2.55, 9.4, 0.7, 1.5, 'red');
}

export function buildEscapeRembrandtplein(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b};
    shell(c);
    box(c);
    ground(c);
    K.flush();
  } finally {
    setSink(0);
  }
}
