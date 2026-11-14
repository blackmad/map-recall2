import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit} from './street-front-kit';
import {centroidXZ, cutFrontWalls, insidePoly, lettering, profileAlong, tiledFront, TriSink, verticalLettering, wallFacingXZ, type XZ} from './venue-kit';
import source from './crea-footprints.json' with {type: 'json'};

/**
 * CREA, Nieuwe Achtergracht 170 (BAG pand 0363100012164972): the UvA/HvA student cultural centre in the former works of
 * the Diamantslijperij Maatschappij on the Roeterseiland (municipal monument 200530; nl.wikipedia.org/wiki/Stichting_CREA).
 * The 59.5 m canal front (ring 29 -> 31) is drawn from a rectified Gemeente Amsterdam panorama across the Nieuwe
 * Achtergracht (CC BY 4.0, venue-face-crops.ts at 38 px/m): TMX7316010203-001975_pano_0000_000883 (2021-01-22,
 * 9 deg oblique). Crop to model: s = crop x - 0.8 (the 3DBAG roof break between the two blocks sits at s 29.2), and
 * y = (crop y - 2.0) x 1.035 (pavement at crop 2.0, the east parapet at crop 19.4 against the 3DBAG roof of 18.0 m).
 *
 * Three parts on the canal: an east block of five storeys under a flat parapet (16 window columns, segmental heads, a
 * through passage in the ground floor), the four-storey middle block with stone string courses, brick relieving arches,
 * a white cornice and a set-back glass storey on its roof, and the arched stone entrance lettered DIAMANTSLIJPERIJ with
 * the vertical CREA sign; at the west end a taller red-brick bay. The white-rendered south block (ring 38 -> 2) is drawn
 * from TMX7316010203-001908_pano_0000_004240 (2020-09-07, 32 deg oblique; its ground floor is hidden by a bicycle shed
 * and hedge and is inferred from the storey rhythm). Every other wall and all roofs keep the 3DBAG LoD2.2 shell (CC BY
 * 4.0); the shell's south-block walls are coloured white. The ring's bicycle court (vertices 2-11) has no 3DBAG roof and
 * no building in the panoramas, so nothing stands there.
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const N: Chord = {a: R[29], b: R[31]};
const LN = Math.hypot(R[31][0] - R[29][0], R[31][1] - R[29][1]);
const S: Chord = {a: R[38], b: R[2]};
const LS = Math.hypot(R[2][0] - R[38][0], R[2][1] - R[38][1]);
const X0 = 0.8;
const sx = (cropX: number) => Math.round((cropX - X0) * 100) / 100;
const Y = (crop: number) => Math.round((crop - 2.0) * 1.035 * 100) / 100;
const E_TOP = 18.1, M_TOP = Y(16.25), M_CORNICE = Y(17.3), W_TOP = 19.6;
const S1 = sx(15.3), S2 = sx(29.9), S3 = sx(53.5);          // downspouts between the parts
/** The white south block, for the shell's wall colour: corners 12, 11 and 10, the east hip end (3DBAG roof corner
 *  23.7, 3.6, padded 0.5 m) and 38 padded 0.8 m west, so the end walls and the sliver of the south wall west of 38 left by
 *  the front cut are white too. */
const WHITE_BLOCK: XZ[] = [R[12], R[11], R[10], [24.2, 3.6], [-2.6, 11.9]];
const WHITE_REF: XZ = [(R[12][0] + R[11][0] + R[2][0] + R[38][0]) / 4, (R[12][1] + R[11][1] + R[2][1] + R[38][1]) / 4];

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

function shell(c: Ctx) {
  let cut = cutFrontWalls(SRC.surfaces, R.slice(29, 32), N, [[-0.6, LN + 0.6, 99]]);
  cut = cutFrontWalls(cut, [R[38], R[0], R[1], R[2]], S, [[-0.6, LS + 0.6, 99]]);
  const white = (s: Surface) => {
    const n = wallFacingXZ(s, WHITE_REF), [cx, cz] = centroidXZ(s);
    return n[1] > -0.5 && insidePoly([cx - n[0] * 0.4, cz - n[1] * 0.4], WHITE_BLOCK);
  };
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'brick', roof: 'slate', wallFor: s => (white(s) ? 'sandstone' : 'brick')});
}

const win = {frame: 'frame' as const, back: 'glass' as const, depth: 0.2, edge: 0.07};

/** East block: five storeys, 16 columns, a through passage under columns 6-8. */
function eastBlock(c: Ctx) {
  const {K, b} = c;
  const yc = [4.1, 7.6, 11.0, 14.5];
  const A = tiledFront(K, b, N, 0, S1 - 0.01, 0, E_TOP, 'brick', [6.25], yc), B = tiledFront(K, b, N, S1 + 0.01, S2 - 0.01, 0, E_TOP, 'brick', [21.45], yc);
  const at = (s: number, y: number) => (s < S1 ? A : B).at(s, y);
  const f = frameAt(N, 0, 0);
  const cols = [2.4, 4.5, 6.2, 7.9, 9.6, 11.3, 12.9, 14.6, 16.4, 18.05, 19.7, 21.4, 23.1, 24.8, 26.5, 28.3].map(sx);
  const rows: Array<[number, number]> = [[Y(3.15), Y(5.15)], [Y(6.8), Y(8.6)], [Y(10.2), Y(11.9)], [Y(13.5), Y(15.2)], [Y(16.9), Y(18.6)]];
  const passage = [sx(11.0), S1 - 0.3];
  K.opening(at(passage[0] + 1, 1), (passage[0] + passage[1]) / 2, 0.05, passage[1] - passage[0], Y(5.5), {frame: 'dark', back: 'dark', depth: 1.2, edge: 0, rise: 0.35});
  for (const [k, s] of cols.entries()) {
    rows.forEach(([y0, y1], r) => {
      if (r === 0 && s > passage[0] - 0.6 && s < passage[1] + 0.6) return;
      const w = k === 0 && r >= 1 && r <= 3 ? 0.5 : 0.95;
      K.opening(at(s, y0), s, y0, w, y1 - y0, {...win, cols: 2, rows: 2, rise: 0.16});
      slab(b, f, s, y0 - 0.135, w + 0.14, 0.1, 0.1, 'concrete');
    });
  }
  slab(b, f, (S1 + S2) / 2, 0, S2 - S1 - 0.2, Y(2.95), 0.05, 'concrete');                  // grey plinth
  profileAlong(b, f, 0.02, S2 - 0.02, [[-0.4, E_TOP - 0.3], [0.12, E_TOP - 0.3], [0.12, E_TOP], [-0.4, E_TOP]], 'concrete');
}

/** Middle block: four storeys between stone string courses, the entrance, the white cornice and the glass storey. */
function middleBlock(c: Ctx) {
  const {K, b, M} = c;
  const belts = [Y(6.7), Y(10.05), Y(13.75)];
  // one section per storey; the string courses cover the 2 cm seams
  const ys = [0, belts[0], belts[1], belts[2], M_TOP];
  const T = tiledFront(K, b, N, S2 + 0.01, S3 - 0.01, 0, M_TOP, 'brick', [36.81, 43.67], ys.slice(1, -1));
  const f = frameAt(N, 0, 0);
  const col = (k: number) => sx(31.6 + k * 1.715);
  const rows: Array<[number, number]> = [[Y(3.1), Y(5.0)], [Y(6.95), Y(8.55)], [Y(10.2), Y(11.85)], [Y(13.85), Y(15.45)]];
  for (let k = 0; k <= 12; k++) {
    const s = col(k);
    rows.forEach(([y0, y1], r) => {
      if (r === 0 && k < 2) return;                                                          // the entrance
      K.opening(T.at(s, y0), s, y0, 1.05, y1 - y0, {...win, cols: 2, rows: 2, rise: 0.14});
      K.archHead(T.at(s, y0), s, y1 - 0.14, 1.05, 0.14, 0.24, 0.05, 'red');                          // relieving arch
    });
  }
  for (const y of belts) slab(b, f, (S2 + S3) / 2, y - 0.06, S3 - S2 - 0.1, 0.12, 0.09, 'concrete');
  slab(b, f, (sx(34.6) + S3) / 2, 0, S3 - sx(34.6) - 0.12, Y(3.0), 0.06, 'concrete');          // plinth
  // the entrance: a light stone surround with the round-arched doorway, the DIAMANTSLIJPERIJ lettering, the CREA sign
  const e0 = sx(30.0), e1 = sx(34.6), ec = sx(31.85), ew = 2.4, eTop = Y(5.55);
  const eL = ec - ew / 2 - 0.06, eR = ec + ew / 2 + 0.06, eH = Y(6.2);
  slab(b, f, (e0 + eL) / 2, 0, eL - e0, eH, 0.1, 'stone');                                        // piers either side
  slab(b, f, (eR + e1) / 2, 0, e1 - eR, eH, 0.1, 'stone');
  slab(b, f, ec, eTop + 0.2, eR - eL, eH - eTop - 0.2, 0.1, 'stone');                            // the lettered band
  K.opening(T.at(ec, 1), ec, 0.05, ew, eTop - 0.05, {frame: 'red', back: 'dark', depth: 0.45, edge: 0.1, cols: 2, bars: [eTop - ew / 2 - 0.05], rise: ew / 2});
  K.archHead(T.at(ec, 1), ec, eTop - ew / 2, ew, ew / 2, 0.22, 0.13, 'stone');
  lettering(b, f, 'DIAMANTSLIJPERIJ', (e0 + e1) / 2, eTop + 0.3, 0.036, 0.025, 'dark', 0.1, 0.01);
  slab(b, f, e0 - 0.25, Y(4.0), 0.36, 1.5, 0.08, 'dark', 0.16);
  verticalLettering(b, f, 'CREA', e0 - 0.25, Y(4.0) + 0.2, 0.04, 0.02, 'white', 0.24);
  // white cornice band at the top of the brick
  profileAlong(b, f, S2 + 0.04, S3 - 0.04, [[-0.6, M_TOP], [0.1, M_TOP], [0.1, M_TOP + 0.55], [0.22, M_TOP + 0.7], [0.22, M_CORNICE], [-0.6, M_CORNICE]], 'white');
  // the set-back glass storey on the 3DBAG roof line (o -3.2 at s 29.2 to o -1.7 at s 53.0), with mullions
  const gy0 = 15.78, gy1 = 19.3;
  const P = (s: number, o: number, y: number) => { const fr = frameAt(N, s, o); return [fr.origin[0], y, fr.origin[1]]; };
  const off = (s: number) => -3.23 + (s - 29.2) * (1.57 / 23.8) + 0.06;
  const nrm = [frameAt(N, 0, 0).n[0], 0, frameAt(N, 0, 0).n[1]];
  const g0 = 30.6, g1 = 52.5, nb = 12, bay = (g1 - g0) / nb;              // clear of the east block's roof and the west bay
  for (let k = 0; k < nb; k++) {
    const a = g0 + k * bay + 0.005, z = g0 + (k + 1) * bay - 0.005;
    M.quad('canopyGlass', P(a, off(a), gy0), P(z, off(z), gy0), P(z, off(z), gy1), P(a, off(a), gy1), nrm);
  }
  for (let s = g0 + bay; s <= g1 - 0.03; s += bay) {
    const fr = frameAt(N, 0, off(s) + 0.03);
    slab(b, fr, s, gy0, 0.08, gy1 - gy0, 0.06, 'frame');
  }
  slab(b, frameAt(N, 0, off((g0 + g1) / 2) + 0.03), (g0 + g1) / 2, (gy0 + gy1) / 2 + 0.3, g1 - g0, 0.08, 0.06, 'frame');
}

/** West bay: taller red brick, five storeys of windows under light stone segmental heads. */
function westBlock(c: Ctx) {
  const {K, b} = c;
  const T = tiledFront(K, b, N, S3 + 0.01, LN, 0, W_TOP, 'red', [], [4.2, 7.7, 11.3, 15.2]);
  const sec = (y: number) => T.at(56, y);
  const f = frameAt(N, 0, 0);
  const rows: Array<[number, number]> = [[Y(6.9), Y(8.5)], [Y(10.4), Y(12.0)], [Y(13.9), Y(15.6)], [Y(17.7), Y(19.6)]];
  for (const s of [54.8, 56.6, 58.4].map(sx)) {
    for (const [y0, y1] of rows) {
      K.opening(sec(y0), s, y0, 0.95, y1 - y0, {...win, cols: 2, rows: 2, rise: 0.16});
      K.archHead(sec(y0), s, y1 - 0.16, 0.95, 0.16, 0.18, 0.06, 'stone');
    }
  }
  K.opening(sec(2), sx(54.8), Y(3.7), 0.95, 1.5, {...win, cols: 2, rise: 0.16});
  K.opening(sec(1), sx(57.0), 0.05, 1.3, 2.65, {frame: 'red', back: 'dark', depth: 0.3, edge: 0.08, cols: 2, bars: [2.1]});
  profileAlong(b, f, S3 + 0.03, LN - 0.03, [[-0.4, W_TOP - 0.42], [0.14, W_TOP - 0.42], [0.14, W_TOP], [-0.4, W_TOP]], 'concrete');
}

/** Downspouts over the seams between the parts. */
function downspouts(c: Ctx) {
  const f = frameAt(N, 0, 0);
  for (const [s, top] of [[S1, E_TOP], [S2, E_TOP], [S3, M_CORNICE]] as const) slab(c.b, f, s, 0, 0.14, top - 0.3, 0.14, 'concrete');
}

/** South block: white render, four storeys of segmental-headed windows, the eaves cornice; the hipped roof is 3DBAG. */
function southBlock(c: Ctx) {
  const {K, b} = c;
  const EAVES = 16.0, ys = (crop: number) => Math.round((crop + 0.45) * 100) / 100;
  const T = tiledFront(K, b, S, 0, LS, 0, EAVES, 'sandstone', [8.2, 14.05, 19.85], [4.6, 8.3, 11.9]);
  const f = frameAt(S, 0, 0);
  const cols: Array<[number, number]> = [[2.1, 1.05], [3.5, 0.6], ...[5.3, 7.2, 9.2, 11.1, 13.1, 15.0, 16.9, 18.9, 20.8, 22.8, 24.8].map(x => [x, 1.05] as [number, number])];
  const rows: Array<[number, number]> = [[1.6, 3.3], [5.2, 6.9], [8.9, 10.5], [12.4, 14.0]].map(([a, z]) => [ys(a), ys(z)]);
  for (const [s, w] of cols) {
    for (const [y0, y1] of rows) {
      K.opening(T.at(s, y0), s, y0, w, y1 - y0, {frame: 'frame', back: 'glass', depth: 0.18, edge: 0.07, cols: w > 1 ? 2 : 1, rows: 2, rise: 0.15});
      slab(b, f, s, y0 - 0.115, w + 0.12, 0.08, 0.06, 'stone');
    }
  }
  profileAlong(b, f, 0.02, LS - 0.02, [[-0.4, EAVES - 0.55], [0.1, EAVES - 0.55], [0.1, EAVES - 0.4], [0.3, EAVES - 0.2], [0.3, EAVES], [-0.4, EAVES]], 'white');
}

export function buildCrea(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    eastBlock(c);
    middleBlock(c);
    westBlock(c);
    downspouts(c);
    southBlock(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
