import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, ledgeStrip, poly, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {placeFigure, POSES} from './figure-kit';
import {border} from './cut-face';
import {centroidXZ, clipRingByLine, corniceSection, insidePoly, modillions, pedimentSolid, profileAlong, segDist, TriSink, verticalLettering, type Col, type XZ} from './venue-kit';
import source from './arti-et-amicitiae-footprints.json' with {type: 'json'};

/**
 * Arti et Amicitiae, Rokin 112 at the Spui (BAG pand 0363100012165109, bouwjaar 1894 in BAG). The artists' society
 * (1839) merged two older buildings behind one white neo-classical front (en.wikipedia "Arti et Amicitiae": "The
 * complex was merged from two separate buildings and given a white neo-classical facade"). The BAG pand is the whole
 * block through to the houses at the Kalverstraat/Spui corner, so the model keeps the 3DBAG LoD2.2 shell (CC BY 4.0)
 * for those houses and for the exhibition hall behind, and draws the Rokin block and the hall's Spui wall by hand.
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m; ids in
 * arti-et-amicitiae-inventory.json):
 *  - Rokin front (21.2 m, TMX7316010203-002857_pano_0002_000077 2022-12-14, recording_2025-06-16_06-42-40_01729): cream
 *    plaster, symmetric about the middle bay, seven window axes. Ground floor of rusticated piers with square-headed
 *    openings (shutters on the south three, shop glass on the north three, the entrance recessed 0.5 m in the middle,
 *    BAG ring), a belt cornice, wreath medallions under the first-floor windows, tall two-light first-floor windows
 *    with transoms in eared surrounds, triangular pediments over axes 2, 4 and 6 and flat hoods over 1, 3, 5 and 7,
 *    plain piers that rise to acanthus consoles carrying four bronze figures (verdigris) at the corners and either side
 *    of the middle bay, a squat second floor of two-light windows between pilaster strips, a frieze with round oculi
 *    on the axes, a modillion cornice and a pediment over the middle bay with the society's painted arms in scrollwork.
 *    The blue ARTI ET AMICITIAE banner hangs from the first floor on the south side (2022 and 2025 captures).
 *  - Spui end of the Rokin block (6.1 m, TMX7316060226-000019_pano_0000_003548 2016 and 2018): rusticated and blind,
 *    one doorway with a stone surround, the second-floor belt, an attic of three blind panels, the frieze and a
 *    pedimented gable over the full width.
 *  - Hall wall on the Spui (13.3 m, TMX7316010203-001050_pano_0001_000027 2019): rusticated, blind above shop windows
 *    between piers (the ring's 0.17 m pilasters), topped by a cornice at the second-floor belt; skylight roof behind.
 * Heights scaled to the Rokin crop (cornice top 15.3 m) and the 3DBAG roofs (front-range ridge 17.2 m at 3.07 m).
 *
 * Native frame of arti-et-amicitiae-footprints.json (x east, z south, y up from the 0.60 m NAP pavement).
 */
type XYZ = number[];
const SRC = source as unknown as {nativeRing: XZ[]; surfaces: Surface[]};
const R = SRC.nativeRing;
const meet = (a1: XZ, a2: XZ, b1: XZ, b2: XZ): XZ => {
  const d1 = [a2[0] - a1[0], a2[1] - a1[1]], d2 = [b2[0] - b1[0], b2[1] - b1[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
  const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den;
  return [a1[0] + d1[0] * t, a1[1] + d1[1] * t];
};
const add = (p: XZ, v: XZ, k = 1): XZ => [p[0] + v[0] * k, p[1] + v[1] * k];

// ---- chords (outward normal n = (-tz, tx), s from a) --------------------------------------------------------------------
const RK: Chord = {a: R[51], b: R[0]};                  // Rokin front, s from the south party wall (21.21 m)
const NF: Chord = {a: R[0], b: R[1]};                   // Spui end of the Rokin block, s from the Rokin corner (6.14 m)
const HN: Chord = {a: R[2], b: R[15]};                  // hall wall on the Spui, recessed plane between the pilasters
const RK_LEN = 21.21, NF_LEN = 6.14, HN_LEN = Math.hypot(R[15][0] - R[2][0], R[15][1] - R[2][1]);
const rkF = frameAt(RK, 0, 0);
const IN: XZ = [-rkF.n[0], -rkF.n[1]];                    // into the block from the Rokin
// front range plan: A south front, B north front, C north back (ring vertex 1), D south back on the party wall
const A = R[51], B = R[0], C = R[1];
const D = meet(C, add(C, rkF.tangent as XZ), R[50], R[51]);
const DEPTH = (C[0] - B[0]) * IN[0] + (C[1] - B[1]) * IN[1];   // 6.0 m (NF meets the front at 81 deg)
/** Side of C->D the hall lies on (clipRingByLine's `keep`). */
const BEHIND: 1 | -1 = ((D[0] - C[0]) * (IN[1] * 3) - (D[1] - C[1]) * (IN[0] * 3)) >= 0 ? 1 : -1;
const Rs: XZ = [(A[0] + D[0]) / 2, (A[1] + D[1]) / 2], Rn: XZ = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];

// ---- measured heights (m above the pavement, Rokin crop 2022 at 50 px/m) --------------------------------------------------
const BASE = -0.3;
const MID = 10.6;            // symmetry axis on the Rokin (chord s)
const AXES = [-8.2, -5.7, -3.2, 0, 3.2, 5.7, 8.2].map(v => MID + v);
const PIERS = [0.62, 8.71, 12.49, 20.55];  // statue piers (BAG pilasters at 8.38-9.04, 12.16-12.82, 20.17-20.83; mirrored)
const GF_TOP = 4.05, BELT = [4.45, 5.15] as const;
const W1 = [5.9, 9.2] as const, W2 = [11.25, 12.65] as const;
const CONSOLE = [10.3, 11.4] as const;
const FRIEZE = [13.25, 14.1] as const;
const EAVE = 15.3;           // cornice top: the roof starts here
const RIDGE = 17.2;          // 3DBAG front-range ridge (piece 46/32), 3.07 m behind the front
const GABLE_APEX = 17.4;     // Spui gable pediment, raking cornice over the roof edge
const HALL_TOP = 11.0;       // hall parapet on the Spui = the Rokin block's second-floor belt (spui crop 2019)

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};
const P3 = (p: XZ, y: number): XYZ => [p[0], y, p[1]];
const ff = (c: Ctx, S: Sec, proud = 0) => c.K.faceFrame(S, proud);

/** Rustication: joint lines every `pitch` m from y0 to y1 as 5 cm proud strips in the joint colour, broken round the
 *  openings and surrounds (`gaps`: [s0, s1, y0, y1]). */
function rustication(c: Ctx, f: Frame, t0: number, t1: number, y0: number, y1: number, gaps: number[][] = [], pitch = 0.55) {
  for (let y = y0 + pitch; y < y1 - 0.1; y += pitch) {
    const cut = gaps.filter(g => y > g[2] - 0.05 && y < g[3] + 0.05).sort((p, q) => p[0] - q[0]);
    let a = t0;
    for (const g of [...cut, [t1, t1]]) {
      const e = Math.min(g[0], t1);
      if (e - a > 0.08) ledgeStrip(c.b, f, (a + e) / 2, y, e - a, 0.035, 0.05, 'sandstone');
      a = Math.max(a, g[1]);
    }
  }
}
/** Two-light window with a transom in the reveal and an eared white architrave 9 cm proud. */
function window2(c: Ctx, S: Sec, s: number, y0: number, y1: number, w: number, o: {transom?: number; ears?: boolean} = {}) {
  c.K.opening(S, s, y0, w, y1 - y0, {cols: 2, frame: 'frame', depth: 0.22, edge: 0.07, ...(o.transom ? {bars: [o.transom]} : {})});
  const f = ff(c, S), aw = 0.14;
  for (const sg of [-1, 1]) slab(c.b, f, s + sg * (w / 2 + aw / 2 + 0.05), y0 - 0.02, aw, y1 - y0 + 0.02, 0.09, 'white');   // 5 cm off the reveal plane
  slab(c.b, f, s, y1, w + 2 * aw + (o.ears ? 0.16 : 0), 0.16, 0.09, 'white');
  if (o.ears) for (const sg of [-1, 1]) slab(c.b, f, s + sg * (w / 2 + aw + 0.04), y1 - 0.18, 0.08, 0.18, 0.09, 'white');
  slab(c.b, f, s, y0 - 0.16, w + 0.42, 0.11, 0.16, 'white');     // sill, 5 cm under the reveal floor
}

// ---- shell -----------------------------------------------------------------------------------------------------------------
/** The 3DBAG shell without what this builder draws: walls on the Rokin, the Spui end and the hall's Spui wall, and the
 *  front range's roof pieces (cut at the range's back wall, so the strip behind it stays roofed). */
function shell(c: Ctx) {
  const FR: XZ[] = [add(A, rkF.n as XZ, 0.3), add(B, rkF.n as XZ, 0.3), add(C, IN, 0.3), add(D, IN, 0.3)];
  const path: XZ[] = [R[51], ...R.slice(52), R[0], R[1], R[2], ...R.slice(3, 19)];
  const onPath = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => path.some((q, i) => i + 1 < path.length && segDist([p[0], p[2]], q, path[i + 1]).d <= 0.5));
  const surfaces = SRC.surfaces.map(s => {
    if (s.type === 'GroundSurface') return s;
    if (onPath(s)) return {...s, type: 'GroundSurface'};
    const inFR = insidePoly(centroidXZ(s), FR);
    if (inFR && s.type === 'WallSurface') return {...s, type: 'GroundSurface'};
    if (s.type === 'RoofSurface' && s.rings[0].some(p => insidePoly([p[0], p[2]], FR))) {
      const r = clipRingByLine(s.rings[0], C, D, BEHIND);   // keep the part behind the back wall C-D
      const back = r.filter(p => !insidePoly([p[0], p[2]], FR)).length;
      return r.length && back ? {...s, rings: [r]} : {...s, type: 'GroundSurface'};
    }
    return s;
  }) as Surface[];
  const west = (s: Surface) => centroidXZ(s)[0] < R[18][0] + 0.5;      // Spui-west and Kalverstraat houses (brick)
  addShell(c.b, {surfaces, nativeRing: R}, {wall: 'concrete', roof: 'slate', skip: s => s.type === 'WallSurface' && west(s)});
  addShell(c.b, {surfaces, nativeRing: R}, {wall: 'brick', roof: 'slate', skip: s => s.type !== 'WallSurface' || !west(s)});
}

// ---- Rokin block massing -----------------------------------------------------------------------------------------------------
function frontRange(c: Ctx) {
  const {M} = c;
  const up = [0, 1, 0], vIn = [IN[0], 0, IN[1]], vOut = [-IN[0], 0, -IN[1]];
  const tn = [rkF.tangent[0], 0, rkF.tangent[1]], ts = [-rkF.tangent[0], 0, -rkF.tangent[1]];
  // roof: front and back slopes from the cornice top to the ridge 3.07 m in
  M.quad('slate', P3(A, EAVE), P3(B, EAVE), P3(Rn, RIDGE), P3(Rs, RIDGE), [vOut[0], 1, vOut[2]]);
  M.quad('slate', P3(Rs, RIDGE), P3(Rn, RIDGE), P3(C, EAVE), P3(D, EAVE), [vIn[0], 1, vIn[2]]);
  // back wall (eaves side) and the south party wall with its gable
  M.quad('concrete', P3(D, BASE), P3(C, BASE), P3(C, EAVE), P3(D, EAVE), vIn);
  M.quad('concrete', P3(A, BASE), P3(D, BASE), P3(D, EAVE), P3(A, EAVE), ts);
  M.tri('concrete', P3(A, EAVE), P3(D, EAVE), P3(Rs, RIDGE), ts);
  M.quad('slate', P3(A, EAVE - 0.02), P3(B, EAVE - 0.02), P3(C, EAVE - 0.02), P3(D, EAVE - 0.02), [0, -1, 0]);
  void up; void tn;
}

// ---- Rokin front ---------------------------------------------------------------------------------------------------------------
function rokin(c: Ctx) {
  const {K, b} = c;
  const S = K.sec(RK, 0, RK_LEN, BASE, EAVE, 'concrete', 0);
  const f = ff(c, S);
  // plinth and ground floor: rusticated piers between square-headed openings
  slab(b, f, MID + 0.03, BASE, RK_LEN - 0.06, 0.75, 0.12, 'stone');
  rustication(c, f, 0, RK_LEN, 0.45, BELT[0], AXES.map((a, i) => { const w = (i === 3 ? 1.85 : 1.42) / 2 + 0.18; return [a - w, a + w, 0, GF_TOP + 0.3]; }));
  for (let i = 0; i < AXES.length; i++) {
    const s = AXES[i];
    if (i === 3) {
      // middle bay: the entrance, recessed 0.5 m (BAG ring 9.70-11.55), double door under a transom
      K.opening(S, s, 0.0, 1.85, 3.95, {cols: 2, frame: 'frame', back: 'dark', depth: 0.5, edge: 0.08, bars: [2.9]});
    } else {
      // shop glass and doors (roller shutters closed in the 2022 capture are open in 2023 and 2025)
      K.opening(S, s, 0.5, 1.42, GF_TOP - 0.5, {cols: 1, frame: 'frame', back: 'glass', depth: 0.2, edge: 0.08, bars: [2.75]});
    }
    const w = i === 3 ? 1.85 : 1.42;
    for (const sg of [-1, 1]) slab(b, f, s + sg * (w / 2 + 0.13), 0.45, 0.16, GF_TOP - 0.45 + 0.12, 0.09, 'white');
    slab(b, f, s, GF_TOP + 0.08, w + 0.5, 0.2, 0.14, 'white');      // small cornice over each opening
  }
  // belt: architrave, frieze and cornice over the ground floor
  slab(b, f, MID + 0.03, BELT[0], RK_LEN - 0.06, 0.35, 0.1, 'white');
  profileAlong(b, f, 0.06, RK_LEN, [[-0.2, BELT[0] + 0.35], [0.22, BELT[0] + 0.35], [0.22, BELT[0] + 0.5], [0.3, BELT[0] + 0.58], [0.3, BELT[1]], [-0.2, BELT[1]]], 'white');
  // first floor: tall two-light windows with transoms, eared architraves, medallions under, pediments / hoods over
  for (let i = 0; i < AXES.length; i++) {
    const s = AXES[i];
    window2(c, S, s, W1[0], W1[1], 1.4, {transom: 2.45, ears: true});
    slab(b, f, s, W1[1] + 0.16, 1.96, 0.24, 0.07, 'white');                           // frieze over the architrave
    profileAlong(b, f, s - 1.08, s + 1.08, [[-0.1, W1[1] + 0.4], [0.18, W1[1] + 0.4], [0.24, W1[1] + 0.5], [0.24, W1[1] + 0.56], [-0.1, W1[1] + 0.56]], 'white');
    if (i % 2 === 1) pedimentSolid(b, f, s, W1[1] + 0.56, 2.16, 0.55, {d: 0.2, rake: 0.1, tymp: 'concrete', trim: 'white'});
    if (i === 3) {
      slab(b, f, s, 5.2, 1.5, 0.55, 0.08, 'white');                                    // balustrade panel under the middle window
      for (let k = 0; k < 5; k++) slab(b, f, s - 0.56 + k * 0.28, 5.27, 0.09, 0.41, 0.14, 'white');
    } else {
      ringSlab(b, f, s, 5.47, 0.2, 0.32, 0.13, 'copper', 0, 14);                        // bronze wreath medallion (verdigris, 2025)
      disc(b, f, s, 5.47, 0.2, 0.09, 'copper');
      slab(b, f, s, 5.2, 0.7, 0.1, 0.1, 'white');                                       // ribbon under it
    }
  }
  // piers with consoles and the four bronze figures
  for (const s of PIERS) {
    slab(b, f, s, BELT[1], 0.66, CONSOLE[0] - BELT[1], 0.1, 'white');
    profileAlong(b, ff(c, S), s - 0.4, s + 0.4, [[-0.2, CONSOLE[0]], [0.16, CONSOLE[0]], [0.26, CONSOLE[0] + 0.5], [0.48, CONSOLE[1] - 0.18], [0.48, CONSOLE[1]], [-0.2, CONSOLE[1]]], 'white');
    slab(b, f, s, CONSOLE[1], 0.62, 0.14, 0.42, 'stone');
    const o = frameAt(RK, s, 0.25), yaw = Math.atan2(o.n[0], o.n[1]);
    const pose = {...POSES.standing(), height: 2.2, skirt: {len: 1.1, flare: 1.55}, stout: 1.35, chest: 1.15, arms: {l: {pitch: 0.5, roll: 0.15, bend: 1.4}, r: {pitch: 0.1, roll: 0.12, bend: 0.3}}};
    placeFigure(b, pose, {x: o.origin[0], y: CONSOLE[1] + 0.14, z: o.origin[1], yaw}, 'copper');
  }
  // second floor: belt, squat two-light windows between pilaster strips
  slab(b, f, MID + 0.03, 10.95, RK_LEN - 0.06, 0.2, 0.14, 'white');
  for (const s of AXES) {
    window2(c, S, s, W2[0], W2[1], 1.05);
    for (const sg of [-1, 1]) slab(b, f, s + sg * 0.86, 11.15, 0.24, FRIEZE[0] - 11.15, 0.06, 'white');
  }
  // frieze with oculi on the axes, modillion cornice
  slab(b, f, MID + 0.03, FRIEZE[0] - 0.12, RK_LEN - 0.06, 0.12, 0.12, 'white');
  for (const s of AXES) { ringSlab(b, f, s, 13.68, 0.12, 0.2, 0.1, 'white', 0, 12); disc(b, f, s, 13.68, 0.12, 0.05, 'dark'); }
  profileAlong(b, f, 0.06, RK_LEN, corniceSection(FRIEZE[1], EAVE - FRIEZE[1], 0.62), 'white');
  modillions(b, f, 1.25, RK_LEN - 1.7, FRIEZE[1] + 0.02, {pitch: 0.55, w: 0.13, h: 0.3, d: 0.5, c: 'white'});
  // middle pediment over the two inner piers, the arms in its tympanum, acroteria at the corners
  const inner = pedimentSolid(b, f, MID, EAVE, 4.7, 1.3, {d: 0.42, rake: 0.18, tymp: 'concrete', trim: 'white', out: -0.05});
  void inner;
  arms(c, f, MID, EAVE + 0.22);
  // the society's banner (blue, white lettering reading upward) hung from a rod at the first-floor hood, axis 2 south side
  {
    const s = AXES[1] - 1.05, fb = ff(c, S, 0.45);
    slab(b, ff(c, S), s, 10.25, 0.05, 0.05, 0.6, 'frame');
    slab(b, fb, s, 5.65, 0.56, 4.6, 0.04, 'blue');
    verticalLettering(b, fb, 'ARTI ET AMICITIAE', s, 5.85, 0.041, 0.05, 'white', 0.02);
  }
}

/** The painted arms in the middle pediment: blue shield with a red and gold chief, helm and white scrollwork either side. */
function arms(c: Ctx, f: Frame, s: number, y: number) {
  const {b} = c;
  poly(b, f, s, y, [[-0.32, 0.55], [0.32, 0.55], [0.32, 0.2], [0, -0.05], [-0.32, 0.2]], 0.1, 'blue', 0.05);
  slab(b, f, s, y + 0.42, 0.64, 0.13, 0.13, 'red', 0.05);
  slab(b, f, s, y + 0.62, 0.3, 0.28, 0.14, 'gold', 0.05);
  for (const sg of [-1, 1]) {
    ringSlab(b, f, s + sg * 0.75, y + 0.25, 0.12, 0.22, 0.12, 'white', 0.05, 10);
    ringSlab(b, f, s + sg * 1.25, y + 0.15, 0.08, 0.16, 0.12, 'white', 0.05, 10);
    poly(b, f, s, y, [[sg * 0.35, 0.02], [sg * 1.45, 0.02], [sg * 1.45, 0.1], [sg * 0.35, 0.1]].map(p => p as [number, number]), 0.12, 'white', 0.05);
  }
}

// ---- Spui end of the Rokin block ---------------------------------------------------------------------------------------------
function spuiEnd(c: Ctx) {
  const {K, b, M} = c;
  const S = K.sec(NF, 0, NF_LEN, BASE, EAVE, 'concrete', 0);
  const f = ff(c, S);
  slab(b, f, NF_LEN / 2, BASE, NF_LEN, 0.75, 0.12, 'stone');
  rustication(c, f, 0, NF_LEN, 0.45, 10.9, [[3.3 - 0.95, 3.3 + 0.95, 0, 3.85], [0, 0.72, BELT[0], 11]]);
  // doorway with a stone surround and a cornice (2016/2018 crops)
  K.opening(S, 3.3, 0.1, 1.25, 3.3, {cols: 1, frame: 'frame', back: 'glass', depth: 0.22, edge: 0.07, bars: [2.55]});
  for (const sg of [-1, 1]) slab(b, f, 3.3 + sg * 0.83, 0.1, 0.3, 3.45, 0.1, 'white');
  slab(b, f, 3.3, 3.55, 1.95, 0.25, 0.14, 'white');
  // belt over the ground floor and the second-floor belt continue round the corner
  slab(b, f, NF_LEN / 2, BELT[0], NF_LEN, 0.35, 0.1, 'white');
  profileAlong(b, f, 0, NF_LEN, [[-0.2, BELT[0] + 0.35], [0.22, BELT[0] + 0.35], [0.22, BELT[0] + 0.5], [0.3, BELT[0] + 0.58], [0.3, BELT[1]], [-0.2, BELT[1]]], 'white');
  slab(b, f, NF_LEN / 2, 10.95, NF_LEN, 0.2, 0.14, 'white');
  // corner pier carries the corner figure's console from the Rokin side
  slab(b, f, 0.35, BELT[1], 0.7, CONSOLE[0] - BELT[1], 0.1, 'white');
  // attic of three blind panels, frieze, cornice
  for (const s of [1.55, 3.15, 4.75]) border(b, f, s, W2[0], 1.15, W2[1] - W2[0] + 0.2, 0.12, 0.08, 'white');
  slab(b, f, NF_LEN / 2, FRIEZE[0] - 0.12, NF_LEN, 0.12, 0.12, 'white');
  for (const s of [1.0, 2.1, 3.15, 4.2, 5.3]) slab(b, f, s, 13.55, 0.22, 0.22, 0.08, 'white');
  profileAlong(b, f, 0, NF_LEN, corniceSection(FRIEZE[1], EAVE - FRIEZE[1], 0.62, 0), 'white');
  modillions(b, f, 1.8, NF_LEN - 1.25, FRIEZE[1] + 0.02, {pitch: 0.55, w: 0.13, h: 0.3, d: 0.5, c: 'white'});
  // pedimented gable over the full width: wall triangle, raking cornices over the roof edges
  const vN = [S.F.f.n[0], 0, S.F.f.n[1]];
  M.tri('concrete', P3(B, EAVE), P3(C, EAVE), P3(Rn, GABLE_APEX - 0.25), vN);
  pedimentSolid(b, f, NF_LEN / 2, EAVE, NF_LEN, GABLE_APEX - EAVE, {d: 0.4, rake: 0.2, tymp: 'concrete', trim: 'white', out: -0.05});
}

// ---- the hall's Spui wall -------------------------------------------------------------------------------------------------------
function hallWall(c: Ctx) {
  const {K, b} = c;
  const S = K.sec(HN, 0, HN_LEN, BASE, HALL_TOP, 'concrete', 0);
  const f = ff(c, S);
  slab(b, f, HN_LEN / 2, BASE, HN_LEN, 0.7, 0.12, 'stone');
  // shop windows between the ring's pilasters (pilaster centres at chord s 2.84+0.22, ... from vertex 2)
  const pil = [3, 7, 11].map(i => { const a = R[i], q = R[i + 3], m: XZ = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2]; return (m[0] - HN.a[0]) * S.F.f.tangent[0] + (m[1] - HN.a[1]) * S.F.f.tangent[1]; });
  const edges = [0, ...pil, HN_LEN];
  for (let k = 0; k + 1 < edges.length; k++) {
    const s0 = edges[k] + (k ? 0.3 : 0.25), s1 = edges[k + 1] - (k + 2 < edges.length ? 0.3 : 0.25);
    K.opening(S, (s0 + s1) / 2, 0.45, s1 - s0, 3.85, {cols: 2, frame: 'frame', back: 'glass', depth: 0.18, edge: 0.07, bars: [3.15]});
  }
  for (const s of pil) slab(b, f, s, 0.45, 0.45, 4.0, 0.17, 'concrete');
  slab(b, f, HN_LEN / 2, 4.3, HN_LEN, 0.55, 0.06, 'frame');                 // shop fascia band (lettering is a tenant's)
  profileAlong(b, f, 0, HN_LEN, [[-0.2, 4.85], [0.18, 4.85], [0.26, 5.05], [0.26, 5.2], [-0.2, 5.2]], 'white');
  rustication(c, f, 0, HN_LEN, 5.2, 10.4);
  profileAlong(b, f, 0, HN_LEN, corniceSection(10.4, HALL_TOP - 10.4, 0.35, 0), 'white');
  // back face of the parapet over the skylight roof
  const fb = frameAt(HN, 0, -0.35), vb = [-S.F.f.n[0], 0, -S.F.f.n[1]];
  const p0 = fb.origin, p1: XZ = [fb.origin[0] + fb.tangent[0] * HN_LEN, fb.origin[1] + fb.tangent[1] * HN_LEN];
  c.M.quad('concrete', P3(p0 as XZ, 9.4), P3(p1, 9.4), P3(p1, HALL_TOP), P3(p0 as XZ, HALL_TOP), vb);
  const q0 = frameAt(HN, 0, 0).origin as XZ, q1: XZ = [q0[0] + fb.tangent[0] * HN_LEN, q0[1] + fb.tangent[1] * HN_LEN];
  c.M.quad('white', P3(q0, HALL_TOP), P3(q1, HALL_TOP), P3(p1, HALL_TOP), P3(p0 as XZ, HALL_TOP), [0, 1, 0]);   // coping
  // the 0.17 m jogs at either end of the recessed plane
  K.endCap(HN, 0, BASE, HALL_TOP, 'concrete', -1, -0.4, 0.2);
}

export function buildArtiEtAmicitiae(_w: number, _d: number, b: BuildingTools) {
  const M = new TriSink();
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0);
    const c: Ctx = {K, b, M};
    shell(c);
    frontRange(c);
    rokin(c);
    spuiEnd(c);
    hallWall(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
export const ARTI_DEPTH = DEPTH;
export type {Col};
