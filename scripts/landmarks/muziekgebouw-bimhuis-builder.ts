import type {BuildingTools} from './cultural-builders';
import * as T from 'three';
import {addShell, type Surface} from './worship-shell';
import {poly, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {centroidXZ, clipRingByLine, clipRingByY, cutFrontWalls, lettering, pathLedge, pathSkin, segDist, strutBetween, TriSink, type XZ} from './venue-kit';
import {arcStations, frameAtArc} from '../../src/canalRecall/landmarks/pathBand';
import source from './muziekgebouw-bimhuis-footprints.json' with {type: 'json'};

/**
 * Muziekgebouw aan 't IJ and the Bimhuis, Piet Heinkade 1-3 (BAG pand 0363100012118833, 2005; 3xN). It replaces the
 * 2026-10-03 primitive box model of the same id (music() in build-manual-landmarks.ts) and keeps its scope: the pand also
 * holds the Mövenpick hotel podium and tower at its east end, which the city layer keeps drawing (landmarkFiller.ts pins
 * it), so the model is cut at the foyer box's east side. Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 25 px/m):
 *   north (IJ) face TMX7316010203-002532_pano_0000_002541 (2022); south (Piet Heinkade) recording_2025-06-16_09-52-43_02257
 *   (2025); the Bimhuis box w04-106 / w05-286 / bimS (TMX7316010203-001668_pano_0000_000103 2020, _000089 2020); the west
 *   glass wall face-west (2020).
 *  - the main hall: a red-brown tile podium (white panel base 0-2.8 m, ribbon windows) that ramps down towards the IJ in two
 *    slopes; a glass hall over it to 18.4 m; the dark underside of the roof slab and its pale-green fascia (22.4-25.3 m);
 *  - the pale-green foyer box with three rows of paired window bands at the east end of both long faces, the
 *    "Muziekgebouw" lettering on the south fascia;
 *  - the Bimhuis: a dark-grey box (8-20 m) cantilevered over the quay south of the hall, lettered BIMHUIS in white on its
 *    two long faces, a glazed band with truss diagonals, a frosted-glass south face, standing on two concrete columns
 *    with V struts.
 *
 * Native frame of muziekgebouw-bimhuis-footprints.json (x east, z south, y up from the 3DBAG ground).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const lerp = (a: XZ, b: XZ, u: number): XZ => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const len = (a: XZ, b: XZ) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** North (IJ) face: ring 5 -> 6; the hotel holds its first 25.4 m. */
const N: Chord = {a: R[5], b: R[6]};
const NL = len(R[5], R[6]), N_HALL = 25.4, N_BOX1 = 38.6;
const nAt = (s: number) => lerp(R[5], R[6], s / NL);
/** South (Piet Heinkade) face: ring 15 -> 16 -> 17 is one straight line; the hall runs 46.8 m to the hotel podium. */
const S_LEN = 46.8;
const S: Chord = {a: R[15], b: lerp(R[15], R[17], S_LEN / len(R[15], R[17]))};
const S_BOX0 = 31.8;
const ROOF = 25.0, TOP = 25.3, FASCIA = 22.4, GLASS_TOP = 18.4;
/** Bimhuis box: ring 12 -> 13 -> 14 -> 15. */
const BOX_LO = 8.0, BOX_HI = 20.0;

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};
const onPath = (s: Surface, path: XZ[], tol = 0.6) => s.type === 'WallSurface' && s.rings[0].every(p => path.some((q, i) => i + 1 < path.length && segDist([p[0], p[2]], q, path[i + 1]).d <= tol));

// ---- shell ---------------------------------------------------------------------------------------------------------------
function shell(c: Ctx) {
  const west = [nAt(N_HALL), ...R.slice(6, 13)];
  const bim = R.slice(12, 16);
  let surfaces = cutFrontWalls(SRC.surfaces, [R[5], R[6]], N, [[-1, N_HALL, -100], [N_HALL, NL + 1, TOP]]);
  surfaces = surfaces.flatMap(s => {
    if (onPath(s, bim)) return [];                                      // the Bimhuis box is drawn
    if (s.type === 'RoofSurface') {
      const ys = s.rings[0].map(p => p[1]), [x, z] = centroidXZ(s);
      // the Bimhuis roof (20.0 m) and the sloped 13-21 m piece along its west face
      if (Math.min(...ys) > 12.9 && Math.max(...ys) < 21.2 && x < -45 && z > -17) return [];
      return [s];
    }
    if (onPath(s, west) || onPath(s, [S.a, S.b])) { const r = clipRingByY(s.rings[0], TOP, 1); return r.length ? [{...s, rings: [r]}] : []; }
    return [s];
  });
  // the hotel (podium, wing and tower) stays with the city layer, as it did under the earlier model: everything east of
  // the cross-section from the foyer box's north end to the hall's south end is cut away and the cut is closed
  const [ca, cb] = [nAt(N_HALL), S.b];
  const keep = 1 as 1 | -1;   // west of ca -> cb (the side where (b - a) x (p - a) > 0)
  const kept: Surface[] = [];
  for (const sf of surfaces) {
    let r = clipRingByLine(sf.rings[0], ca, cb, keep);
    if (!r.length) continue;
    // the hall's roof is one flat slab behind the fascia (photos; 3DBAG splits it into 24.7-25.9 m steps): the 3DBAG roofs
    // above 22 m and the step walls between them go, and walls reaching up there are stretched to the slab
    const ys = r.map(q => q[1]);
    if (sf.type === 'RoofSurface' && Math.min(...ys) > 22) continue;
    if (sf.type === 'WallSurface') {
      if (Math.min(...ys) > 20) continue;
      // 3DBAG's hall face 1 m behind the IJ front (hidden by the podium and the glass, its ends open) and thin slivers
      if (r.every(q => segDist([q[0], q[2]], N.a, N.b).d < 1.5)) continue;
      const xs = r.map(q => q[0]), zs = r.map(q => q[2]);
      if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) < 0.6) continue;
      if (Math.max(...ys) > 22) { r = clipRingByY(r, ROOF, -1).map(q => q[1] > 22 ? [q[0], ROOF, q[2]] : q); if (!r.length) continue; }
    }
    // lower 3DBAG roofs on the cut (the hotel podium strip, 10.3 m) stay under the slab; the cut face below closes them
    if (sf.type === 'RoofSurface' && r.some(q => segDist([q[0], q[2]], ca, cb).d < 1e-3) && Math.max(...r.map(q => q[1])) > ROOF - 0.05) continue;
    kept.push({...sf, rings: [r]});
  }
  addShell(c.b, {surfaces: kept, nativeRing: R}, {wall: 'brick', roof: 'slate'});
  // the flat slab over the whole outline, and the cut against the hotel closed from the ground to it
  const outline: XZ[] = [nAt(N_HALL), ...R.slice(6, 13), R[15], S.b];
  for (const [i, j, k] of T.ShapeUtils.triangulateShape(outline.map(p => new T.Vector2(p[0], p[1])), [])) {
    c.M.tri('slate', [outline[i][0], ROOF, outline[i][1]], [outline[j][0], ROOF, outline[j][1]], [outline[k][0], ROOF, outline[k][1]], [0, 1, 0]);
  }
  c.M.quad('green', [cb[0], 0, cb[1]], [ca[0], 0, ca[1]], [ca[0], ROOF, ca[1]], [cb[0], ROOF, cb[1]], [cb[1] - ca[1], 0, ca[0] - cb[0]]);
}

// ---- the hall's glass, the dark roof underside and the fascia round the whole outline ------------------------------------
function hallRing(c: Ctx) {
  const {b, M} = c;
  const glassPath: XZ[] = [nAt(N_BOX1), ...R.slice(6, 13)];
  pathSkin(M, glassPath, 0, GLASS_TOP, 0, 'glass');
  // curtain-wall grid: mullions every ~3.3 m, transoms every 1.75 m
  const at = arcStations(glassPath), GL = at.at(-1)!, n = Math.round(GL / 3.3);
  // no mullion within 0.3 m of a corner: its side face would sit a few cm off the next face's glass
  for (let k = 0; k <= n; k++) if (k === 0 || k === n || at.every(v => Math.abs(v - k * GL / n) > 0.3)) slab(b, frameAtArc(glassPath, Math.min(GL - 0.05, Math.max(0.05, k * GL / n)), 0), 0, 0, 0.1, GLASS_TOP, 0.12, 'frame');
  for (let y = 1.75; y < GLASS_TOP - 0.3; y += 1.75) pathLedge(M, glassPath, y, 0.06, 0, 0.08, 'frame');
  // south: glass recessed 0.6 m over the podium, west of the foyer box
  const sGlass: XZ[] = [S.a, lerp(S.a, S.b, S_BOX0 / S_LEN)];
  pathSkin(M, sGlass, 10.75, GLASS_TOP, -0.6, 'glass');
  const sl = len(sGlass[0], sGlass[1]), sn = Math.round(sl / 3.3);
  for (let k = 0; k <= sn; k++) slab(b, frameAtArc(sGlass, Math.min(sl - 0.05, Math.max(0.05, k * sl / sn)), -0.6), 0, 10.75, 0.1, GLASS_TOP - 10.75, 0.12, 'frame');
  // the roof slab's dark underside band, recessed, over the glass
  const dark1: XZ[] = [nAt(N_BOX1), ...R.slice(6, 13)];
  // the roof slab's dark edge under the fascia (a closed band: front flush with the glass, back skin inside)
  const band = (path: XZ[], y0: number, y1: number, back: number, front: number) => { pathLedge(M, path, y0, y1 - y0, back, front, 'dark'); pathSkin(M, [...path].reverse(), y0, y1, -back, 'dark'); };
  band(dark1, GLASS_TOP, FASCIA, -0.5, 0);
  band(sGlass, GLASS_TOP, FASCIA, -0.6, 0);
  // over the Bimhuis box, the hall's own face (ring 12 -> 15) shows from the box roof to the fascia
  band([R[12], R[15]], BOX_HI, FASCIA - 0.02, -0.7, 0.1);
  // the pale-green fascia round the whole hall
  const fascia: XZ[] = [nAt(N_HALL), ...R.slice(6, 13), R[15], S.b];
  // its back on the outline: the 3DBAG roof edges (24.7-25.1 m) meet it there, so the fascia reads as a parapet
  pathLedge(M, fascia, FASCIA, TOP - FASCIA, 0, 0.22, 'green');
  pathSkin(M, [...fascia].reverse(), FASCIA, TOP, 0, 'green');
  // lettering on the south fascia: dark "Muziekgebouw" (face-south, 13 m wide, 18-31 m from ring 15)
  lettering(b, frameAt(S, 0, 0.22), 'Muziekgebouw', 24.5, 23.05, 0.18, 0.05, 'dark');
}

// ---- the red tile podium -----------------------------------------------------------------------------------------------------
function northPodium(c: Ctx) {
  const {K, b} = c;
  const f = frameAt(N, 0, 0);
  // white panel base with service doors (0-2.8 m)
  const base = K.sec(N, N_HALL, 88, -0.3, 2.8, 'white', 0.3);
  for (const s of [42.6, 61.2, 79.9]) K.opening(base, s, 0, 2.0, 2.6, {frame: 'white', back: 'concrete', depth: 0.12, edge: 0.05, cols: 2});
  for (const s of [34.5, 55.6, 66.9, 85.0]) K.opening(base, s, 0.6, 2.0, 1.4, {frame: 'frame', back: 'glass', depth: 0.12, edge: 0.06});
  // red podium: 10.4 m to s 62.4, a ramp down to 5.8 m at 68.8, level to 88, a second ramp to 1 m at 102.4
  const red = K.sec(N, N_HALL, 62.4, 2.8, 10.4, 'brick', 0.3);
  // ribbon window with white glazing bars (a frame ring inside so long a reveal would reach back past the glass)
  K.opening(red, 44, 6.6, 34.6, 0.8, {frame: 'white', back: 'glass', depth: 0.14, edge: 0, cols: 22});
  poly(b, f, 0, 0, [[62.4, 2.8], [88, 2.8], [88, 5.8], [68.8, 5.8], [62.4, 10.4]], 0.34, 'brick', -0.04);
  poly(b, f, 0, 0, [[88, 0], [102.4, 0], [102.4, 1.0], [88, 5.8]], 0.34, 'brick', -0.04);
  // copings on the podium top and down the ramps
  slab(b, f, (N_HALL + 62.4) / 2, 10.4, 62.4 - N_HALL, 0.12, 0.42, 'concrete', -0.04);
  slab(b, f, 78.4, 5.8, 19.2, 0.12, 0.42, 'concrete', -0.04);
  // the foyer box (pale green) over the podium: three rows of paired window bands
  const box = K.sec(N, N_HALL, N_BOX1, 12.2, TOP, 'green', 0.15);
  for (const y of [13.8, 17.0, 20.2]) for (const [s, w] of [[28.5, 4.2], [35.2, 5.2]] as const) K.opening(box, s, y, w, 1.1, {frame: 'frame', back: 'glass', depth: 0.14, edge: 0.05, cols: Math.round(w / 1.1)});
  // dark recess between the podium top and the box
  slab(b, f, (N_HALL + N_BOX1) / 2, 10.52, N_BOX1 - N_HALL, 1.53, 0.05, 'dark', -0.1);
  slab(b, f, (N_HALL + N_BOX1) / 2, 12.05, N_BOX1 - N_HALL, 0.15, 0.3, 'green', -0.1);
}

function southPodium(c: Ctx) {
  const {K, b} = c;
  const f = frameAt(S, 0, 0);
  // white base: glazed entrances and the stage loading doors (5.2 m) in white panels
  const base = K.sec(S, 0, S_LEN, -0.3, 3.4, 'white', 0);
  for (const s of [6.4, 11.9, 17.0]) K.opening(base, s, 0.4, 3.6, 2.6, {frame: 'frame', back: 'glass', depth: 0.14, edge: 0.06, cols: 2});
  K.opening(base, 38.6, 0, 12.6, 3.3, {frame: 'white', back: 'concrete', depth: 0.12, edge: 0.06, cols: 6});
  const red = K.sec(S, 0, S_LEN, 3.4, 10.6, 'brick', 0);
  K.opening(red, 35.2, 7.8, 22.4, 0.7, {frame: 'white', back: 'glass', depth: 0.14, edge: 0, cols: 12});
  slab(b, f, 38.6, 3.4, 12.6, 1.8, 0.05, 'white');   // the loading doors run on above the base band
  // coping on the podium top, reaching back under the recessed glass
  slab(b, f, S_LEN / 2, 10.6, S_LEN, 0.15, 0.75, 'concrete', -0.65);
  // the foyer box (pale green) at the east end: three rows of paired window bands; dark recess under it
  const box = K.sec(S, S_BOX0, S_LEN, 13.8, TOP, 'green', 0);
  for (const y of [15.8, 19.5, 23.0]) for (const [s, w] of [[35.4, 4.9], [42.2, 5.3]] as const) K.opening(box, s, y, w, 1.15, {frame: 'frame', back: 'glass', depth: 0.14, edge: 0.05, cols: Math.round(w / 1.2)});
  slab(b, f, (S_BOX0 + S_LEN) / 2, 10.75, S_LEN - S_BOX0, 3.05, 0.05, 'dark', -0.6);
  slab(b, f, (S_BOX0 + S_LEN) / 2, 13.65, S_LEN - S_BOX0, 0.15, 0.6, 'green', -0.6);
}

/** The hall's own face under the Bimhuis box (ring 12 -> 15): red tile with the glazed main entrance. */
function underBox(c: Ctx) {
  const {K} = c;
  const ch: Chord = {a: R[12], b: R[15]}, L = len(R[12], R[15]);
  const sec = K.sec(ch, 0, L, -0.3, BOX_LO - 0.02, 'brick', 0);
  K.opening(sec, L * 0.55, 0, 7.5, 3.2, {frame: 'frame', back: 'glass', depth: 0.25, edge: 0.08, cols: 5});
}

// ---- the Bimhuis ------------------------------------------------------------------------------------------------------------
function bimhuis(c: Ctx) {
  const {K, b, M} = c;
  const W: Chord = {a: R[12], b: R[13]}, Sx: Chord = {a: R[13], b: R[14]}, E: Chord = {a: R[14], b: R[15]};
  const WL = len(R[12], R[13]), SL = len(R[13], R[14]), EL = len(R[14], R[15]);
  // long faces: a glazed band with truss diagonals (10.5-12.1 m), an upper window at the north end, BIMHUIS in white
  for (const [ch, L, upperAt] of [[W, WL, 2.8], [E, EL, EL - 2.8]] as const) {
    const sec: Sec = K.sec(ch, 0, L, BOX_LO, BOX_HI, 'slate', 0);
    K.opening(sec, L / 2, 10.5, L - 1.6, 1.6, {frame: 'frame', back: 'dark', depth: 0.6, edge: 0.06});
    K.opening(sec, upperAt, 15.1, 4.6, 2.7, {frame: 'frame', back: 'dark', depth: 0.6, edge: 0.06});
    const f = K.faceFrame(sec, -0.45);
    const n = Math.round((L - 1.6) / 3.2);
    for (let k = 0; k <= n; k++) {
      const t = 0.8 + k * (L - 1.6) / n;
      slab(b, f, t, 10.5, 0.14, 1.6, 0.12, 'concrete');
      if (k < n) {
        const t1 = 0.8 + (k + 1) * (L - 1.6) / n, up = k % 2 === 0;
        const [y0, y1] = up ? [10.5, 12.1] : [12.1, 10.5];
        poly(b, f, 0, 0, [[t, y0], [t + 0.16, y0], [t1, y1], [t1 - 0.16, y1]], 0.1, 'concrete');
      }
    }
    lettering(b, K.faceFrame(sec, 0), 'BIMHUIS', L / 2 + (ch === W ? 1.4 : -1.4), 15.25, 0.35, 0.06, 'white');
  }
  // south face: frosted glass in a dark frame, mullions ~1.95 m, a transom pair at 13 m
  const ss = K.sec(Sx, 0, SL, BOX_LO, BOX_HI, 'slate', 0);
  K.opening(ss, SL / 2, 9.4, SL - 1.0, 8.2, {frame: 'frame', back: 'canopyGlass', depth: 0.25, edge: 0.08, cols: Math.round((SL - 1) / 1.95), bars: [3.6, 4.2]});
  // underside and roof of the box
  const ring = [R[12], R[13], R[14], R[15]];
  M.fan('slate', ring.map(p => [p[0], BOX_LO, p[1]]), [0, -1, 0]);
  M.fan('slate', ring.map(p => [p[0], BOX_HI, p[1]]), [0, 1, 0]);
  // two concrete columns ~9 m in from the south face with a V of struts between them
  const back = 9.2, fs = frameAt(Sx, 0, -back);
  const P = (s: number, y: number): [number, number, number] => [fs.origin[0] + fs.tangent[0] * s, y, fs.origin[1] + fs.tangent[1] * s];
  for (const s of [2.5, SL - 2.5]) slab(b, fs, s, 0, 0.7, BOX_LO, 1.9, 'concrete', -0.95);
  for (const s of [2.5, SL - 2.5]) strutBetween(b, P(SL / 2, 0.2), P(s, BOX_LO - 0.3), 0.4, 'concrete');
}

export function buildMuziekgebouwBimhuis(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    hallRing(c);
    northPodium(c);
    southPodium(c);
    underBox(c);
    bimhuis(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
