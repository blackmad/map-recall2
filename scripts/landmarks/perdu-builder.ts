import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {cutFrontWalls, lettering, profileAlong, TriSink, type XZ} from './venue-kit';
import source from './perdu-footprints.json' with {type: 'json'};

/**
 * Perdu, Kloveniersburgwal 86 (BAG pand 0363100012169332): the poetry theatre, publisher and bookshop in the former
 * kitchen building and sisters' house of the Binnengasthuis (nl.wikipedia.org/wiki/Perdu). The 24.4 m canal front
 * (ring 8 -> 0) is drawn from rectified Gemeente Amsterdam panoramas across the Kloveniersburgwal (CC BY 4.0,
 * venue-face-crops.ts at 40 px/m): TMX7316010203-001975_pano_0000_001186 (2021-01-22, square-on, a site fence on the
 * quay hides the ground-floor sills), TMX7316010203-000354_pano_0001_001493 (2017-07-06) and
 * b_20250108_1041_Track19_Sphere_00047 (2025-01-08, sunlit, with the roof and its dormers). Crop heights: the building
 * foot is at crop 1.2 m and the brick cornice tops out at crop 14.4 m against the 3DBAG eaves of 12.24 m, so model
 * y = (crop - 1.2) x 0.93.
 *
 * Light-brown brick in two wings either side of a narrower middle bay, separated by brick lesenes that run up into the
 * corbelled cornice: round-arched ground-floor windows, tall first-floor windows, a brick panel band, round-arched
 * second-floor windows under light stone arch rings, brick corbel brackets under the cornice, and a tiled roof with
 * three dormers (box dormers over the wings, a pointed one over the middle). The middle bay has the entrance with the
 * white Perdu sign board, narrow side lights and a stone tablet over it. Roofs and the other walls keep the 3DBAG
 * LoD2.2 shell (CC BY 4.0); the walls to the Binnengasthuis grounds have no usable panorama and stay plain (inferred).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const F: Chord = {a: R[8], b: R[0]};
const L = Math.hypot(R[0][0] - R[8][0], R[0][1] - R[8][1]);
const Y = (crop: number) => Math.round((crop - 1.2) * 0.93 * 100) / 100;
const EAVES = 12.24;
/** Window columns: [centre, width]; the middle bay's three are narrow-wide-narrow. */
const WINGS: Array<[number, number]> = [[1.65, 1.3], [4.1, 1.3], [6.65, 1.3], [14.75, 1.3], [17.25, 1.3], [20.25, 1.3], [22.75, 1.3]];
const MID: Array<[number, number]> = [[9.2, 0.55], [10.65, 1.3], [12.1, 0.55]];
const PIERS: Array<[number, number]> = [[0.25, 0.3], [7.95, 0.42], [13.45, 0.42], [L - 0.25, 0.3]];   // end ones 10 cm off the party-wall planes

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

function shell(c: Ctx) {
  const cut = cutFrontWalls(SRC.surfaces, [R[8], R[0]], F, [[-0.6, L + 0.6, 99]]);
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'red'});
}

function front(c: Ctx) {
  const {K, b} = c;
  // one section per wing and the middle bay, 2 cm apart behind the lesenes (short boundary loops for the audit)
  const S: Sec[] = [K.sec(F, 0, 7.94, 0, EAVES, 'brick', 0), K.sec(F, 7.96, 13.44, 0, EAVES, 'brick', 0), K.sec(F, 13.46, L, 0, EAVES, 'brick', 0)];
  const at = (s: number) => S.find(q => s > q.s0 && s < q.s1)!;
  const f = K.faceFrame(S[0], 0);
  const win = {frame: 'white' as const, back: 'glass' as const, depth: 0.18, edge: 0.08};
  const yG = Y(3.3), hG = Y(6.35) - yG, y1 = Y(7.3), h1 = Y(10.3) - y1, y2 = Y(11.4), h2 = Y(13.4) - y2;
  for (const [s, w] of WINGS) {
    K.opening(at(s), s, yG, w, hG, {...win, cols: 2, rows: 2, rise: w / 2});
    K.archHead(at(s), s, yG + hG - w / 2, w, w / 2, 0.16, 0.08, 'sandstone');
    K.opening(at(s), s, y1, w, h1, {...win, cols: 2, rows: 2});
    K.opening(at(s), s, y2, w, h2, {...win, cols: 2, rows: 2, rise: w / 2});
    K.archHead(at(s), s, y2 + h2 - w / 2, w, w / 2, 0.16, 0.08, 'sandstone');
  }
  for (const [s, w] of MID) {
    K.opening(at(s), s, y1, w, h1, {...win, cols: w > 1 ? 2 : 1, rows: 2});
    K.opening(at(s), s, y2, w, h2, {...win, cols: w > 1 ? 2 : 1, rows: 2, rise: w / 2});
    K.archHead(at(s), s, y2 + h2 - w / 2, w, w / 2, 0.14, 0.08, 'sandstone');
  }
  // the entrance: door with a transom, narrow arched side lights, the white Perdu sign board and the stone tablet
  K.opening(at(11.15), 11.15, 0.05, 1.15, 2.75, {frame: 'white', back: 'dark', depth: 0.25, edge: 0.08, cols: 2, bars: [2.2]});
  for (const s of [9.2, 12.55]) K.opening(at(s), s, 0.9, 0.55, 2.3, {...win, rise: 0.27});
  slab(b, f, 10.95, Y(5.35), 1.5, 0.6, 0.12, 'white');
  lettering(b, f, 'Perdu', 10.95, Y(5.35) + 0.16, 0.045, 0.025, 'dark', 0.12, 0.02);
  slab(b, f, 11.0, Y(6.5), 1.5, 0.62, 0.07, 'sandstone');
  lettering(b, f, 'ANNO 1908', 11.0, Y(6.5) + 0.22, 0.024, 0.02, 'red', 0.07, 0.01);   // the tile frieze (rijksmonument 518309)
  // sills (light stone) under the first-floor windows, a stone plinth course
  for (const [s, w] of [...WINGS, ...MID]) slab(b, f, s, y1 - 0.17, w + 0.2, 0.12, 0.12, 'sandstone');   // the band's stone strip is the second-floor sill
  for (const [a, z] of [[0, 9.2 - 0.33], [9.2 + 0.33, 11.15 - 0.62], [11.15 + 0.62, 12.55 - 0.33], [12.55 + 0.33, L]]) slab(b, f, (a + z) / 2, 0, z - a, 0.45, 0.06, 'stone');
  // the brick panel band between the first- and second-floor windows: a darker brick panel framed by stone strips
  for (const [s, w] of [...WINGS, [10.65, 4.0] as [number, number]]) {
    slab(b, f, s, Y(10.55), w + 0.25, Y(11.25) - Y(10.55), 0.05, 'red');
    slab(b, f, s, Y(11.25), w + 0.35, 0.09, 0.1, 'sandstone');
  }
  // lesenes up into the cornice
  for (const [s, w] of PIERS) slab(b, f, s, 0, w, EAVES - 0.4, 0.13, 'brick');
  // corbelled cornice: stepped brick brackets between the windows, a light stone course, and the eaves moulding
  const brackets = [2.88, 5.38, 7.95, 13.45, 16.0, 18.75, 21.5];
  for (const s of brackets) {
    slab(b, f, s, Y(13.2), 0.4, EAVES - 0.45 - Y(13.2), 0.22, 'brick');           // up to the moulding's soffit
    slab(b, f, s, Y(13.75), 0.62, EAVES - 0.5 - Y(13.75), 0.36, 'brick');
    slab(b, f, s, Y(13.75) - 0.08, 0.66, 0.08, 0.4, 'sandstone');
  }
  slab(b, f, L / 2, Y(13.25), L - 0.4, 0.1, 0.1, 'sandstone');
  profileAlong(b, f, 0.08, L - 0.08, [[-0.3, EAVES - 0.45], [0.36, EAVES - 0.45], [0.36, EAVES - 0.3], [0.48, EAVES - 0.18], [0.48, EAVES + 0.02], [-0.3, EAVES + 0.02]], 'sandstone');
}

/** Dormers in the front roof slope (3DBAG plane from the 12.1 m eaves rising inward): box dormers and a pointed one. */
function dormers(c: Ctx) {
  const {b, M} = c;
  const P3 = (s: number, y: number, o: number) => { const fr = frameAt(F, s, o); return [fr.origin[0], y, fr.origin[1]]; };
  const out = [frameAt(F, 0, 0).n[0], 0, frameAt(F, 0, 0).n[1]];
  for (const [s, w, pointed] of [[6.8, 1.6, false], [10.75, 1.4, true], [14.75, 1.6, false]] as const) {
    const o0 = -0.9, o1 = -2.6, y0 = EAVES + 0.25, y1 = y0 + 1.35, f = frameAt(F, 0, o0);
    slab(b, f, s, y0, w, y1 - y0, o1 - o0 < 0 ? o0 - o1 : 1.7, 'brick', -(o0 - o1));
    slab(b, f, s, y0 + 0.2, w - 0.35, y1 - y0 - 0.4, 0.06, 'white');
    slab(b, f, s, y0 + 0.28, w - 0.5, y1 - y0 - 0.56, 0.04, 'glass', 0.06);
    if (pointed) {
      const apex = y1 + 0.8;
      M.tri('brick', P3(s - w / 2, y1, o0), P3(s + w / 2, y1, o0), P3(s, apex, o0), out);
      for (const sd of [-1, 1]) M.quad('red', P3(s + sd * (w / 2 + 0.1), y1 - 0.05, o0 + 0.1), P3(s, apex + 0.05, o0 + 0.1), P3(s, apex + 0.05, o1), P3(s + sd * (w / 2 + 0.1), y1 - 0.05, o1), [sd * f.tangent[0] * 0.7, 0.7, sd * f.tangent[1] * 0.7]);
    } else slab(b, f, s, y1, w + 0.2, 0.12, o0 - o1 + 0.2, 'red', -(o0 - o1));
  }
}

export function buildPerdu(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    front(c);
    dormers(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
