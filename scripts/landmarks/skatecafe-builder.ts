import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {getSink, poly, setSink, slab, type Frame} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type Sec} from './street-front-kit';
import {TriSink, type XZ} from './venue-kit';
import {graffitiBand, graffitiLayout, sawtoothHall, scallopedRake, type Decal} from './hall-kit';
import source from './skatecafe-footprints.json' with {type: 'json'};

/**
 * SKATECAFE, Gedempt Hamerkanaal 42, Amsterdam-Noord (BAG pand 0363100012122913, bouwjaar 1917; OSM node 9789622796).
 * One long 1917 works shed along the yard off the Gedempt Hamerkanaal, its 40.5 m south-east front measured on rectified
 * Gemeente Amsterdam panoramas (CC BY 4.0, 50 px/m): recording_2024-10-22_09-10-27_02646 (2024, the current state),
 * TMX7316010203-001729_pano_0000_002199 (2020) and TMX7316060226-000495_pano_0000_000590 (2019, overcast, for tone).
 * From the south-west end (s along the front from BAG ring vertex 5):
 *  - s 0-22: six north-light (saw-tooth) bays, valleys at 4.3, 7.84, ... 22.0 m, apexes 9.2 m, eaves 7.95 m, the long
 *    slope solid and the short north-east slope glazed; one two-light window per bay at 5.5-6.4 m on both gable fronts,
 *    downpipes in the valleys, a warehouse door in the third bay, the lower storey covered in graffiti and tag pieces;
 *  - s 22-24.6: a flat brick link (6.8 m) under ivy that climbs to 9 m;
 *  - s 24.6-29.4: the cafe front, a chalet: black vertical boards in a gable under white scalloped bargeboards with a
 *    finial, a four-pane gable window, a half-timbered storey with blue shutters, a yellow balcony band with blue
 *    X balusters, and a glazed entrance under a dark beam;
 *  - s 29.4-40.5: a flat-roofed brick wing (6.9 m) with four white-framed upper windows; Garage Noord's Sichuan Territory
 *    glasshouse (garage-noord) stands in front of its north-east end.
 * Heights from 3DBAG LoD2.2 (CC BY 4.0) for the levels, shapes from the photos (the saw-tooth crown is the photo's, not
 * 3DBAG's smoothed bands). Native frame of skatecafe-footprints.json: x east, z south, y up from the 3DBAG ground.
 */
type Shell = {nativeRing: XZ[]};
const R = (source as unknown as Shell).nativeRing;
const FR: Chord = {a: R[5], b: R[0]};
const F: Frame = (({origin, tangent, n}) => ({origin, tangent, n}))(frameAt(FR, 0, 0));
const P3 = (s: number, y: number, o: number) => [F.origin[0] + F.tangent[0] * s + F.n[0] * o, y, F.origin[1] + F.tangent[1] * s + F.n[1] * o];
const P2 = (s: number, o: number): XZ => [F.origin[0] + F.tangent[0] * s + F.n[0] * o, F.origin[1] + F.tangent[1] * s + F.n[1] * o];
const D = (s: number, y: number, o: number) => [F.tangent[0] * s + F.n[0] * o, y, F.tangent[1] * s + F.n[1] * o];

const VALLEYS = [0, 4.3, 7.84, 11.38, 14.92, 18.46, 22.0];
const APEXES = [3.3, 6.9, 10.44, 13.98, 17.52, 21.06];
const EAVES = 7.95, APEX = 9.2, SAW_DEPTH = 9.2;
const DEEP = 12.42, LINK_TOP = 6.8, WING_TOP = 6.9;
const CH0 = 24.61, CH1 = 29.43, CH_EAVES = 6.9, CH_RIDGE = 8.35, CHM = (CH0 + CH1) / 2;
const WIN_S = [2.45, 5.93, 9.47, 13.01, 16.55, 20.09];

export function buildSkatecafe(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}, decal?: Decal) {
  const sink0 = getSink();
  setSink(0.12, true);
  const K = makeFrontKit(b, 0);
  const M = new TriSink();

  // ---- massing --------------------------------------------------------------------------------------------------------
  sawtoothHall(b, F, {valleys: VALLEYS, apexes: APEXES, eaves: EAVES, apex: APEX, depth: SAW_DEPTH, wall: 'brick', roof: 'slate', glass: 'glass', front: false, back: false});
  const up = [0, 1, 0], out = D(0, 0, 1), back = D(0, 0, -1);
  // link (flat), chalet (pitched, ridge running back from the front), wing (flat): roofs, back wall, end walls
  M.quad('slate', P3(22, LINK_TOP, 0), P3(CH0, LINK_TOP, 0), P3(CH0, LINK_TOP, -DEEP), P3(22, LINK_TOP, -DEEP), up);
  M.quad('slate', P3(CH1, WING_TOP, 0), P3(40.5, WING_TOP, 0), P3(40.5, WING_TOP, -DEEP), P3(CH1, WING_TOP, -DEEP), up);
  M.quad('slate', P3(CH0 - 0.15, CH_EAVES - 0.09, 0.3), P3(CHM, CH_RIDGE + 0.05, 0.3), P3(CHM, CH_RIDGE + 0.05, -DEEP), P3(CH0 - 0.15, CH_EAVES - 0.09, -DEEP), D(-(CH_RIDGE - CH_EAVES), CHM - CH0, 0));
  M.quad('slate', P3(CHM, CH_RIDGE + 0.05, 0.3), P3(CH1 + 0.15, CH_EAVES - 0.09, 0.3), P3(CH1 + 0.15, CH_EAVES - 0.09, -DEEP), P3(CHM, CH_RIDGE + 0.05, -DEEP), D(CH_RIDGE - CH_EAVES, CH1 - CHM, 0));
  // the chalet's back gable is clad in pale profiled metal (2016 capture TMX7316060226-000022_pano_0008_004267), with a flue
  M.tri('concrete', P3(CH0, CH_EAVES, -DEEP), P3(CHM, CH_RIDGE, -DEEP), P3(CH1, CH_EAVES, -DEEP), back);
  M.quad('brick', P3(22, 0, -DEEP), P3(40.5, 0, -DEEP), P3(40.5, LINK_TOP, -DEEP), P3(22, LINK_TOP, -DEEP), back);
  M.quad('brick', P3(CH0, LINK_TOP, -DEEP), P3(40.5, LINK_TOP, -DEEP), P3(40.5, WING_TOP, -DEEP), P3(CH0, WING_TOP, -DEEP), back);
  // the 3.2 m jog behind the saw-tooth bays (BAG vertices 2-3) and the party wall with Garage Noord
  M.quad('brick', P3(22, 0, -SAW_DEPTH), P3(22, 0, -DEEP), P3(22, LINK_TOP, -DEEP), P3(22, LINK_TOP, -SAW_DEPTH), D(-1, 0, 0));
  M.quad('brick', P3(40.5, 0, 0), P3(40.5, 0, -DEEP), P3(40.5, WING_TOP, -DEEP), P3(40.5, WING_TOP, 0), D(1, 0, 0));
  // chalet side walls over the link and the wing roofs
  M.quad('brick', P3(CH0, LINK_TOP, 0), P3(CH0, LINK_TOP, -DEEP), P3(CH0, CH_EAVES, -DEEP), P3(CH0, CH_EAVES, 0), D(-1, 0, 0));
  b.add(new T.CylinderGeometry(0.16, 0.16, 2.6, 8).translate(0, 1.3, 0), 'concrete', ...((p: number[]) => [p[0], CH_EAVES + 0.4, p[2]])(P3(CH1 + 1.6, 0, -DEEP + 1.0)) as [number, number, number]);
  b.mark?.('massing');

  // ---- the saw-tooth front: one window per bay, warehouse door, blue door, downpipes ----------------------------------
  const A: Sec = K.sec(FR, 0, 22, 0, EAVES, 'brick', 0);
  for (const s of WIN_S) {
    K.opening(A, s, 5.5, 1.85, 0.9, {frame: 'white', cols: 2, depth: 0.16});
    slab(b, frameAt(FR, 0, 0), s, 6.5, 2.0, 0.12, 0.06, 'concrete');
    slab(b, frameAt(FR, 0, 0), s, 5.28, 2.0, 0.12, 0.08, 'concrete');
  }
  K.opening(A, 9.2, 0.05, 2.4, 2.9, {frame: 'dark', back: 'dark', depth: 0.35, edge: 0.08});
  slab(b, frameAt(FR, 0, 0), 9.2, 3.05, 2.7, 0.18, 0.06, 'concrete');
  K.opening(A, 6.3, 0.05, 1.0, 2.4, {frame: 'dark', back: 'blue', depth: 0.1, edge: 0.05});
  for (const v of VALLEYS.slice(1, -1)) {
    slab(b, frameAt(FR, 0, 0), v, 0, 0.11, EAVES - 0.4, 0.11, 'dark', 0.2);
    slab(b, frameAt(FR, 0, 0), v, EAVES - 0.62, 0.3, 0.26, 0.2, 'dark', 0.16);
  }
  // the back (north-west) gable fronts: one window per bay, mirrored
  const BK: Chord = {a: P2(22, -SAW_DEPTH), b: P2(0, -SAW_DEPTH)};
  const AB: Sec = K.sec(BK, 0, 22, 0, EAVES, 'brick', 0);
  for (const s of WIN_S) K.opening(AB, 22 - s, 5.5, 1.85, 0.9, {frame: 'white', cols: 2, depth: 0.16});
  K.opening(AB, 22 - 9.2, 0.05, 1.6, 2.4, {frame: 'dark', back: 'dark', depth: 0.2, edge: 0.06});
  b.mark?.('sawtooth front');

  // ---- link under ivy -------------------------------------------------------------------------------------------------
  K.sec(FR, 22, CH0, 0, LINK_TOP, 'brick', 0);
  // the ivy mass: a lumpy green sheet over the link and the last bay's corner, climbing above the roofs
  const ivy: [number, number][] = [[-2.0, 0], [2.4, 0], [2.4, 2.6], [2.25, 5.4], [1.6, 7.1], [0.8, 7.0], [0.1, 8.1], [-0.6, 8.9], [-1.3, 8.6], [-1.6, 7.6], [-2.0, 7.2], [-2.3, 5.0], [-2.2, 2.0]];
  poly(b, F, 22.0, 0, ivy, 0.3, 'green', 0.02);
  b.mark?.('link');

  // ---- the chalet front ----------------------------------------------------------------------------------------------
  // painted timber and plaster take stucco-slot names ('pink' = the black paint, 'ochre' = white plaster): 'dark' and
  // 'white' are opening materials to the openings gate, which would judge the whole front as one window
  const C0 = K.sec(FR, CH0, CH1, 0, 4.0, 'pink', 0);
  K.opening(C0, 26.2, 0.45, 2.6, 2.55, {frame: 'dark', cols: 3, bars: [2.0], depth: 0.2});
  K.opening(C0, 28.4, 0.45, 1.3, 2.55, {frame: 'dark', cols: 1, depth: 0.2});
  slab(b, F, (CH0 + CH1) / 2, 0, CH1 - CH0, 0.35, 0.1, 'blue');
  slab(b, F, CHM, 3.0, CH1 - CH0 + 0.5, 0.2, 0.4, 'pink');
  // yellow balcony band with blue X balusters
  slab(b, F, 27.05, 3.2, 4.3, 0.8, 0.3, 'gold');
  slab(b, F, 27.05, 3.98, 4.4, 0.08, 0.36, 'pink');
  for (let k = 0; k < 7; k++) {
    const t = 25.25 + k * 0.6;
    for (const sg of [1, -1]) poly(b, F, t, 3.6, [[-0.27, -0.33], [-0.19, -0.33], [0.27, 0.33], [0.19, 0.33]].map(([x, y]) => [x * sg, y]) as [number, number][], 0.03, 'blue', 0.3 + (sg > 0 ? 0 : 0.03));
  }
  // half-timbered storey: white plaster, three windows with blue shutters, black posts and head beam
  const C1 = K.sec(FR, CH0, CH1, 4.0, 5.45, 'ochre', 0);
  for (const s of [25.5, 26.9, 28.5]) {
    K.opening(C1, s, 4.15, 0.62, 1.0, {frame: 'white', cols: 2, rows: 3, depth: 0.12});
    for (const sg of [-1, 1]) slab(b, F, s + sg * 0.5, 4.12, 0.34, 1.06, 0.06, 'blue');
  }
  for (const s of [CH0 + 0.06, 26.2, 27.7, CH1 - 0.06]) slab(b, F, s, 4.05, 0.12, 1.35, 0.06, 'pink');
  slab(b, F, CHM, 5.35, CH1 - CH0, 0.14, 0.12, 'pink');
  // the boarded gable: black vertical boards from the beam up under the roof's front overhang, weathered battens
  K.sec(FR, CH0, CH1, 5.45, CH_EAVES, 'pink', 0);
  M.tri('pink', P3(CH0, CH_EAVES, 0), P3(CHM, CH_RIDGE, 0), P3(CH1, CH_EAVES, 0), out);
  const RE0 = CH0 - 0.15, RE1 = CH1 + 0.15, RY0 = CH_EAVES - 0.09, RY1 = CH_RIDGE + 0.05;
  const roofY = (s: number) => RY0 + (RY1 - RY0) * (1 - Math.abs(s - CHM) / (CHM - RE0));
  const BOARD0 = RE0 + 0.04, BOARD1 = RE1 - 0.04, top = (s: number) => roofY(s) - 0.07;
  poly(b, F, 0, 0, [[BOARD0, 5.45], [BOARD1, 5.45], [BOARD1, top(BOARD1)], [CHM, top(CHM)], [BOARD0, top(BOARD0)]], 0.06, 'pink', 0.02);
  for (let s = BOARD0 + 0.3; s < BOARD1 - 0.1; s += 0.36) slab(b, F, s, 5.5, 0.06, top(s) - 5.58, 0.03, 'bronze', 0.08);
  // white scalloped bargeboards in front of the roof's front edge (o 0.3), their top on the roof line; no sink, so they
  // stay clear of the roof slopes behind
  setSink(0);
  const rk = {w: 0.4, n: 7, d: 0.06, c: 'ochre' as const, out: 0.31};
  scallopedRake(b, F, RE0 - 0.12, roofY(RE0) - 0.07, CHM, RY1 + 0.08, rk);
  scallopedRake(b, F, CHM, RY1 + 0.08, RE1 + 0.12, roofY(RE1) - 0.07, rk);
  slab(b, F, CHM, RY1 + 0.08, 0.08, 0.7, 0.08, 'pink', 0.3);
  slab(b, F, CHM, RY1 + 0.62, 0.18, 0.18, 0.18, 'gold', 0.25);
  setSink(0.12, true);
  // gable window: dark surround, white frame, four panes
  slab(b, F, CHM, 6.62, 1.15, 1.2, 0.05, 'bronze', 0.08);
  slab(b, F, CHM, 6.75, 0.9, 0.92, 0.04, 'white', 0.13);
  slab(b, F, CHM, 6.82, 0.72, 0.78, 0.03, 'glass', 0.17);
  slab(b, F, CHM, 6.82, 0.06, 0.78, 0.03, 'white', 0.2);
  slab(b, F, CHM, 7.18, 0.72, 0.06, 0.03, 'white', 0.2);
  b.mark?.('chalet');

  // ---- the wing: four white-framed upper windows, ground doors and windows, coping ----------------------------------
  const W: Sec = K.sec(FR, CH1, 40.5, 0, WING_TOP, 'brick', 0);
  for (const s of [32.7, 34.7, 37.2, 39.2]) {
    K.opening(W, s, 4.85, 1.8, 0.85, {frame: 'white', cols: 2, depth: 0.14});
    slab(b, F, s, 4.63, 1.95, 0.12, 0.08, 'concrete');
  }
  K.opening(W, 30.55, 0.05, 0.8, 2.2, {frame: 'dark', back: 'red', depth: 0.12, edge: 0.05});
  for (const s of [32.65, 34.7]) K.opening(W, s, 0.25, 1.7, 2.15, {frame: 'dark', back: 'green', depth: 0.12, edge: 0.06, cols: 2});
  for (const s of [37.2, 39.2]) K.opening(W, s, 0.75, 1.8, 1.5, {frame: 'blue', cols: 3, depth: 0.14});
  slab(b, F, 38.2, 0, 4.4, 0.62, 0.1, 'blue');
  K.coping(W, WING_TOP, 0.1, 0.06, 'concrete', CH1, 40.5, 0.3);
  K.coping({F: W.F, s0: 22, s1: CH0, ch: FR, off: 0}, LINK_TOP, 0.1, 0.06, 'concrete', 22, CH0, 0.3);
  b.mark?.('wing');

  K.flush();
  M.flush(b);

  // ---- graffiti: tag pieces over the saw-tooth bays' lower storey and the big silver piece over the poster wall ----------
  if (decal) {
    const fills = ['#dcdcd8', '#d8579d', '#4fb3a8', '#e6c63a', '#8ec5e8', '#e2e2de'];
    graffitiBand(decal, F, graffitiLayout(0.3, 5.7, 0.35, 2.9, 42, fills), 0.05);
    graffitiBand(decal, F, graffitiLayout(10.6, 19.6, 0.35, 3.1, 7, fills), 0.05);
    graffitiBand(decal, F, [{t: 5.3, y: 3.2, rx: 2.2, ry: 1.05, fill: '#dcdcd8', outline: '#1d1d22', letters: 5}], 0.05);
    // the north-west side carries the same coat
    const BF: Frame = (({origin, tangent, n}) => ({origin, tangent, n}))(frameAt(BK, 0, 0));
    graffitiBand(decal, BF, graffitiLayout(0.5, 21.5, 0.35, 2.6, 19, fills), 0.05);
  }
  setSink(sink0);
}
