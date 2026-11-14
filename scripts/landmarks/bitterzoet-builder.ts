import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {poly, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {border} from './cut-face';
import {cutFrontWalls, lettering, type XZ} from './venue-kit';
import source from './bitterzoet-footprints.json' with {type: 'json'};

/**
 * Bitterzoet, Spuistraat 2 (BAG pand 0363100012171035, bouwjaar 1905; the venue's verblijfsobject 0363010000816880,
 * "Spuistraat 2", bijeenkomstfunctie 836 m2, lies in this pand; the locatieserver's first hit "Spuistraat 1C-2" was
 * the free-text match only). A corner building at the head of the Spuistraat. Read from rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m):
 *  - Spuistraat front (ring vertex 3 to 4, 11.6 m): TMX7316010203-002537_pano_0001_001204 (2022) and
 *    TMX7316010203-000716_pano_0000_000933 (2018): a cream rendered ground floor with two windows and two glazed
 *    double doors on four axes, the canopy lettered BITTERZOET over the doors, the black logo plaque between them;
 *    two storeys of red brick banded with cream speklagen, four windows each under segmental relieving arches with
 *    chequered tympana and cream voussoirs, a cartouche, cream corner pilasters, the cornice and a central attic;
 *  - the long north-east side (vertex 5 to 0, 24.4 m): recording_2025-06-16_03-46-32_01091 and
 *    TMX7316010203-002355_pano_0000_000050 (2021): purple-brown brick, two windows per storey on the corner wing,
 *    four on the main wing over three ground-floor windows and the cream doorcase, four dormers in the roof.
 * Roofs, the chimney and the alley and back walls keep the 3DBAG LoD2.2 shell (CC BY 4.0).
 *
 * Native frame of bitterzoet-footprints.json (x east, z south, y up from the pavement).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const FR: Chord = {a: R[3], b: R[4]};
const NE: Chord = {a: R[5], b: R[0]};
const len = (c: Chord) => Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]);
const L = len(FR), MIDF = L / 2;
const GF = 4.6, TOPF = 14.76, EAVES = 13.85;
const AXES = [-3.495, -1.165, 1.165, 3.495].map(d => MIDF + d);
const WIN1 = [5.4, 7.9] as const, WIN2 = [9.2, 11.7] as const, WIN_W = 1.44;

type Ctx = {K: FrontKit; b: BuildingTools};

function shell(c: Ctx) {
  let cut = cutFrontWalls(SRC.surfaces, [R[3], R[4], R[5]], FR, [[-1, L + 1, TOPF + 0.05]]);
  cut = cutFrontWalls(cut, [R[5], R[6], R[7], R[0]], NE, [[-2, len(NE) + 1, EAVES]]);
  // 3DBAG reads the first dormer of the main wing as a 16.7 m block on the eaves (roof 96 and its walls); the photos show
  // a dormer like the other three, so the block goes and the drawn dormer stands there
  const W3: Chord = {a: R[7], b: R[0]}, f3 = frameAt(W3, 0, 0);
  const so = (p: number[]) => [(p[0] - f3.origin[0]) * f3.tangent[0] + (p[2] - f3.origin[1]) * f3.tangent[1], (p[0] - f3.origin[0]) * f3.n[0] + (p[2] - f3.origin[1]) * f3.n[1]];
  cut = cut.filter(x => !x.rings[0].every(p => { const [u, o] = so(p); return u > 0.3 && u < 2.8 && o > -1.8 && p[1] >= EAVES - 0.1; }));
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'slate'});
}

// ---- the Spuistraat front ---------------------------------------------------------------------------------------------------
function front(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(FR, 0, L, -0.3, GF, 'ochre', 0);
  const U = K.sec(FR, 0, L, GF, TOPF, 'pink', 0);
  const f = K.faceFrame(G, 0);
  // ground floor: windows on the outer axes, glazed double doors on the inner ones
  for (const s of [AXES[0], AXES[3]]) K.opening(G, s, 1.0, WIN_W, 2.25, {frame: 'green', back: 'glass', depth: 0.2, edge: 0.07, cols: 3, bars: [1.55]});
  for (const s of [AXES[1], AXES[2]]) K.opening(G, s, 0, WIN_W, 3.25, {frame: 'green', back: 'glass', depth: 0.25, edge: 0.08, cols: 2, bars: [2.45]});
  const cuts = [0, AXES[0] - 0.8, AXES[0] + 0.8, AXES[1] - 0.8, AXES[1] + 0.8, AXES[2] - 0.8, AXES[2] + 0.8, AXES[3] - 0.8, AXES[3] + 0.8, L];
  for (let i = 0; i + 1 < cuts.length; i += 2) slab(b, f, (cuts[i] + cuts[i + 1]) / 2, -0.3, cuts[i + 1] - cuts[i] - 0.04, 0.6, 0.04, 'concrete');
  // the logo plaque between the doors, the canopy and its lettering, two floodlights
  slab(b, f, MIDF, 2.3, 0.42, 0.48, 0.05, 'bronze');
  slab(b, f, MIDF + 0.06, 2.4, 0.08, 0.28, 0.03, 'ochre', 0.05);
  slab(b, f, MIDF - 0.08, 2.4, 0.08, 0.28, 0.03, 'ochre', 0.05);
  slab(b, f, MIDF, 3.42, 5.2, 0.12, 1.0, 'bronze');
  lettering(b, f, 'BITTERZOET', MIDF, 3.58, 0.037, 0.04, 'bronze', 0.9);
  for (const s of [MIDF - 2.5, MIDF + 2.5]) slab(b, f, s, 4.75, 0.28, 0.18, 0.3, 'bronze');
  // the street name plate at the corner
  slab(b, f, L - 1.2, 4.85, 0.55, 0.16, 0.03, 'blue');
  // ground-floor entablature
  slab(b, f, MIDF, GF - 0.3, L, 0.32, 0.14, 'sandstone');
  // upper storeys: windows under segmental relieving arches with chequered tympana
  for (const [y0, y1] of [WIN1, WIN2]) for (const s of AXES) {
    K.opening(U, s, y0, WIN_W, y1 - y0, {frame: 'green', back: 'glass', depth: 0.2, edge: 0.07, cols: 3, rows: 1, bars: [(y1 - y0) * 0.66]});
    K.archHead(U, s, y1 + 0.05, WIN_W + 0.2, 0.55, 0.14, 0.06, 'sandstone', 'red');
    slab(b, f, s, y0 - 0.16, WIN_W + 0.2, 0.1, 0.1, 'sandstone');
  }
  // cream speklagen: full bands between the window zones, pier bands beside the windows
  const zones = [[WIN1[0], WIN1[1] + 0.65], [WIN2[0], WIN2[1] + 0.65]];
  const piers: [number, number][] = [[0.5, AXES[0] - 0.82]];
  for (let k = 0; k < 3; k++) piers.push([AXES[k] + 0.82, AXES[k + 1] - 0.82]);
  piers.push([AXES[3] + 0.82, L - 0.5]);
  for (let y = GF + 0.4; y < 13.0; y += 0.6) {
    const inZone = zones.some(([a, z]) => y + 0.1 > a - 0.13 && y < z);
    if (!inZone) slab(b, f, MIDF, y, L - 1.0, 0.1, 0.05, 'sandstone');
    else for (const [a, z] of piers) slab(b, f, (a + z) / 2, y, z - a, 0.1, 0.05, 'sandstone');
  }
  // cartouche between the middle first-floor windows
  slab(b, f, MIDF, 6.35, 0.5, 0.6, 0.1, 'sandstone');
  slab(b, f, MIDF, 6.95, 0.62, 0.1, 0.14, 'sandstone');
  // cream corner pilasters, architrave, cornice and the attic block
  for (const s of [0.25, L - 0.27]) slab(b, f, s, GF, s < 1 ? 0.5 : 0.46, TOPF - GF, 0.08, 'sandstone');
  slab(b, f, MIDF, 13.3, L, 0.15, 0.1, 'sandstone');
  slab(b, f, MIDF, 14.2, L, 0.56, 0.3, 'sandstone');
  K.coping(U, TOPF, 0.14, 0.42, 'sandstone', -0.02, L + 0.02, 0.6);
  slab(b, f, MIDF, TOPF + 0.14, 2.9, 0.48, 0.3, 'sandstone', -0.6);
  // the corner chamfer (vertex 4 to 5) carries the pilaster round
  const C = K.sec({a: R[4], b: R[5]}, 0, len({a: R[4], b: R[5]}), -0.3, TOPF, 'sandstone', 0);
  void C;
}

// ---- the north-east side ----------------------------------------------------------------------------------------------------
function side(c: Ctx) {
  const {K, b} = c;
  const W1: Chord = {a: R[5], b: R[6]}, W2: Chord = {a: R[6], b: R[7]}, W3: Chord = {a: R[7], b: R[0]};
  const S1 = K.sec(W1, 0, len(W1), -0.3, EAVES, 'brick', 0);
  K.sec(W2, 0, len(W2), -0.3, EAVES, 'brick', 0);
  const S3 = K.sec(W3, 0, len(W3), -0.3, EAVES, 'brick', 0);
  const win = (S: Sec, s: number, y0: number, h: number) => K.opening(S, s, y0, 1.45, h, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07, cols: 2, rows: 1, bars: [h * 0.6]});
  // corner wing: the cinema poster case on the ground floor, then two windows a storey
  const f1 = K.faceFrame(S1, 0);
  slab(b, f1, 0.9, 0.5, 1.4, 2.8, 0.06, 'bronze');
  slab(b, f1, 0.9, 0.6, 1.25, 2.6, 0.04, 'red', 0.06);
  win(S1, 3.0, 0.9, 2.7);
  for (const y of [5.2, 9.2]) { win(S1, 0.9, y, 2.7); win(S1, 3.0, y, 2.7); }
  // main wing: three ground-floor windows and the doorcase, four windows a storey, four dormers
  const f3 = K.faceFrame(S3, 0);
  for (const s of [1.5, 4.6, 7.7]) win(S3, s, 0.9, 2.7);
  K.opening(S3, 10.65, 0, 1.3, 3.25, {frame: 'green', back: 'glass', depth: 0.22, edge: 0.07, cols: 2, bars: [2.5]});
  slab(b, f3, 9.95, 0, 0.35, 3.9, 0.12, 'sandstone');
  slab(b, f3, 11.35, 0, 0.35, 3.9, 0.12, 'sandstone');
  slab(b, f3, 10.65, 3.9, 2.4, 0.35, 0.2, 'sandstone');
  for (const y of [5.2, 9.2]) for (const s of [1.5, 4.6, 7.7, 10.65]) win(S3, s, y, 2.7);
  for (const s of [1.5, 4.6, 7.7, 10.65]) {
    const df = frameAt(W3, 0, 0);
    slab(b, df, s, EAVES, 1.7, 1.75, 2.4, 'sandstone', -3.1);
    slab(b, df, s, EAVES + 0.3, 1.05, 1.1, 0.06, 'glass', -0.7);
    border(b, frameAt(W3, 0, -0.7), s, EAVES + 0.3, 1.05, 1.1, 0.08, 0.1, 'white');
    slab(b, df, s, EAVES + 1.75, 1.9, 0.14, 2.6, 'slate', -3.2);
  }
  // eaves gutter along both wings
  K.coping(S1, EAVES, 0.16, 0.2, 'slate', -0.02, len(W1) + 0.02, 0.4);
  K.coping(S3, EAVES, 0.16, 0.2, 'slate', -0.02, len(W3) + 0.02, 0.4);
}

export function buildBitterzoet(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b};
    shell(c);
    front(c);
    side(c);
    K.flush();
  } finally {
    setSink(0);
  }
}
void poly;
