import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {awning, disc, ringSlab, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit} from './street-front-kit';
import {border} from './cut-face';
import {clipRingByLine, clipRingByY, cutFrontWalls, lettering, pathLedge, pathSkin, segDist, TriSink, type XZ} from './venue-kit';
import {arcStations, frameAtArc} from '../../src/canalRecall/landmarks/pathBand';
import source from './theater-bellevue-footprints.json' with {type: 'json'};

/**
 * Theater Bellevue, Leidsekade 90 (BAG pand 0363100012169852, bouwjaar 1894 for the pand; the theatre front is the
 * yellow-brick building of the 1930s-era rebuild). The pand holds the whole block corner: the yellow-brick drum round the
 * corner on to the Leidsekade, the cream two-storey café wing (Theatercafé De Smoeshaan), the five-storey brick canal
 * house at its east end, the brown-brick wing on the west side street and the fly tower behind. Read from rectified
 * Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m):
 *   TMX7316010203-001968_pano_0000_000114 (2021-01-18) and TMX7316010203-000355_pano_0000_000073 (2017), Leidsekade front;
 *   TMX7316010203-000199_pano_0002_000287 (2017-03-10) and TMX7316010203-001968_pano_0000_000115 (2021), café wing and house;
 *   TMX7316010203-002857_pano_0005_000164 (2022-12-14) and TMX7316010203-003011_pano_0006_000027 (2023), the corner drum.
 *  - the drum and the Leidsekade front: dark-brown glazed tile plinth (0-2.45 m) with framed posters, a ribbon of
 *    windows in dark frames (2.45-4.25 m) under a dark fascia, yellow brick to 8.0 m and a dark coping to 8.5 m, all
 *    running unbroken round the corner (pathBand.ts);
 *  - the two-tone sign (olive "Theater", red "Bellevue") at 5.85-7.15 m, the round window in its grey square frame and
 *    the grey stage-door surround with its red door on the short east segment;
 *  - the cream café wing: glazed ground floor with two port-hole windows, the long canopy with white letters "Theater
 *    Bellevue" standing on it (2021), a wide first-floor window under an awning;
 *  - the canal house: cream-rendered ground floor and mezzanine with four small windows under awnings, red-brown brick
 *    above with white sill bands, white surrounds, a white bay window on the first floor and a balcony on the second.
 * The fly tower, the west wing's walls and every roof keep the 3DBAG LoD2.2 shell (CC BY 4.0).
 *
 * Native frame of theater-bellevue-footprints.json (x east, z south, y up from the pavement).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
/** The drum and the long Leidsekade front: ring vertices 10 (where the west wing ends) to 130. */
const DRUM: XZ[] = R.slice(10, 131);   // the 3DBAG west-wing wall runs on to vertex 10 (z -1.44)
const DRUM_LEN = arcStations(DRUM).at(-1)!;
const STRAIGHT0 = DRUM_LEN - Math.hypot(R[130][0] - R[129][0], R[130][1] - R[129][1]);   // arc length at vertex 129
/** The short east segment (ring 131-132) with the round window and the stage door. */
const EAST: Chord = {a: R[131], b: R[132]};
/** Café wing and canal house (ring 133-134). */
const CAFE: Chord = {a: R[133], b: R[134]};
const CAFE_L = Math.hypot(R[134][0] - R[133][0], R[134][1] - R[133][1]);
const HOUSE0 = 6.9;               // the canal house starts 6.9 m along the café chord
const HOUSE_D = 1.4;
const PLINTH = 2.45, RIB = 4.25, BRICK_TOP = 8.0, COPING = 8.5, CAFE_TOP = 8.0, HOUSE_CORNICE = 16.95;

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

// ---- shell -------------------------------------------------------------------------------------------------------------
function shell(c: Ctx) {
  const onPath = (s: Surface, path: XZ[], tol: number) => s.type === 'WallSurface' && s.rings[0].every(p => path.some((q, i) => i + 1 < path.length && segDist([p[0], p[2]], q, path[i + 1]).d <= tol));
  const front = R.slice(10, 134);
  let surfaces: Surface[] = [];
  for (const s of SRC.surfaces) {
    if (onPath(s, front, 0.5)) {
      // the drawn drum, front and east segment stand to the coping; 3DBAG keeps only what rises above it
      const r = clipRingByY(s.rings[0], COPING, 1);
      if (r.length) surfaces.push({...s, rings: [r]});
      continue;
    }
    surfaces.push(s);
  }
  surfaces = cutFrontWalls(surfaces, [R[133], R[134]], CAFE, [[-1, HOUSE0, CAFE_TOP], [HOUSE0, CAFE_L + 1, HOUSE_CORNICE]]);
  // The canal house's 3DBAG roof starts at 15.6 m on the front line, under the cornice the photos show at ~17.2 m (its top
  // storey's windows reach 16.6 m): the first HOUSE_D metres behind the front become a flat roof at the cornice, the rest of
  // the 3DBAG roof stays, and a wall closes the step between them.
  const cf = frameAt(CAFE, 0, 0);
  const sO = (p: number[]) => (p[0] - cf.origin[0]) * cf.tangent[0] + (p[2] - cf.origin[1]) * cf.tangent[1];
  const oO = (p: number[]) => (p[0] - cf.origin[0]) * cf.n[0] + (p[2] - cf.origin[1]) * cf.n[1];
  const P3 = (sv: number, y: number, o: number) => [cf.origin[0] + cf.tangent[0] * sv + cf.n[0] * o, y, cf.origin[1] + cf.tangent[1] * sv + cf.n[1] * o];
  const a = P3(0, 0, -HOUSE_D), bb = P3(1, 0, -HOUSE_D);
  const behind = (-1) as 1 | -1;   // n = (-tz, tx) is the left of a -> b; behind the front is its right
  const flatS: number[] = [];
  surfaces = surfaces.flatMap(sf => {
    const r0 = sf.rings[0];
    // only the slope that starts on the front line below the cornice (s 10.9-13.9, 15.6 m); the dormer roofs stay
    if (sf.type !== 'RoofSurface' || Math.max(...r0.map(oO)) < -0.1 || Math.min(...r0.map(p => p[1])) > HOUSE_CORNICE - 0.3 || Math.max(...r0.map(sO)) < HOUSE0 + 0.2) return [sf];
    flatS.push(Math.min(...r0.map(sO)), Math.max(...r0.map(sO)));
    const r = clipRingByLine(r0, [a[0], a[2]], [bb[0], bb[2]], behind);
    const on = r.filter(p => Math.abs(oO(p) + HOUSE_D) < 1e-3).sort((p, q) => sO(p) - sO(q));
    for (let i = 0; i + 1 < on.length; i++) {
      const [p, q] = [on[i], on[i + 1]];
      if (sO(q) - sO(p) > 0.02) c.M.quad('brick', [p[0], HOUSE_CORNICE, p[2]], [q[0], HOUSE_CORNICE, q[2]], [q[0], q[1], q[2]], [p[0], p[1], p[2]], [cf.n[0], 0, cf.n[1]]);
    }
    return r.length ? [{...sf, rings: [r]}] : [];
  });
  if (flatS.length) { const s0 = Math.max(HOUSE0, Math.min(...flatS)), s1 = Math.min(CAFE_L, Math.max(...flatS)); c.M.quad('slate', P3(s0, HOUSE_CORNICE, 0), P3(s1, HOUSE_CORNICE, 0), P3(s1, HOUSE_CORNICE, -HOUSE_D), P3(s0, HOUSE_CORNICE, -HOUSE_D), [0, 1, 0]); }
  // the west wing (ring 0-2) is brown brick; the fly tower and the canal-house flanks are red-brown brick
  const west = [R[0], R[1], R[2]];
  addShell(c.b, {surfaces, nativeRing: R}, {wall: 'brick', roof: 'slate', skip: s => s.type === 'WallSurface' && onPath(s, west, 0.5)});
  addShell(c.b, {surfaces: surfaces.filter(s => onPath(s, west, 0.5)), nativeRing: R}, {wall: 'greyBrick', roof: 'slate'});
  // the fly tower's white pilaster strips, seen over the drum from the Leidsekade (face-front crops, s 0-7 m): every
  // 3DBAG wall above 16 m facing the canal gets strips at a ~2.1 m pitch from the drum's coping up
  const fn = frameAt({a: R[129], b: R[130]}, 0, 0).n;
  for (const sf of surfaces) {
    if (sf.type !== 'WallSurface') continue;
    const r = sf.rings[0], top = Math.max(...r.map(p => p[1]));
    if (top < 16) continue;
    const lo = r.filter(p => p[1] < Math.min(...r.map(q => q[1])) + 0.05);
    if (lo.length < 2) continue;
    const [p, q] = [lo[0], lo[lo.length - 1]], L = Math.hypot(q[0] - p[0], q[2] - p[2]);
    if (L < 4) continue;
    const t: XZ = [(q[0] - p[0]) / L, (q[2] - p[2]) / L];
    if (Math.abs(t[0] * fn[1] - t[1] * fn[0]) < 0.9) continue;   // the wall must run along the front
    const sgn = -t[1] * fn[0] + t[0] * fn[1] > 0 ? 1 : -1;
    const fr = {origin: [p[0], p[2]] as XZ, tangent: t, n: [-t[1] * sgn, t[0] * sgn] as XZ};
    const n = Math.max(2, Math.round(L / 2.1));
    const base = Math.max(COPING, lo[0][1]) + 0.1;
    for (let k = 0; k <= n; k++) slab(c.b, fr, Math.min(L - 0.2, Math.max(0.2, k * L / n)), base, 0.32, top - base - 0.25, 0.06, 'white');
  }
  // west wing: white cornice ledge over the ground storey and the white coping (face-curve crops, w03-283)
  const wf = frameAt({a: R[1], b: R[2]}, 0, 0), WL = Math.hypot(R[2][0] - R[1][0], R[2][1] - R[1][1]);
  slab(c.b, wf, WL / 2 - 0.3, 4.55, WL - 0.6, 0.2, 0.3, 'white');
  slab(c.b, wf, WL / 2, 8.15, WL, 0.18, 0.12, 'white');
  // the louvred panel high on the wing and the service door
  slab(c.b, wf, 1.3, 5.6, 1.6, 2.0, 0.06, 'dark');
  for (let k = 0; k < 9; k++) slab(c.b, wf, 1.3, 5.7 + k * 0.2, 1.5, 0.05, 0.1, 'greyBrick', 0.04);
  slab(c.b, wf, 4.6, 0, 1.0, 2.2, 0.06, 'dark');
}

// ---- the drum and the long front ------------------------------------------------------------------------------------------
function drum(c: Ctx) {
  const {b, M} = c;
  // plinth of dark-brown glazed tiles, its top ledge running under the ribbon windows
  pathSkin(M, DRUM, 0, PLINTH, 0.04, 'dark');
  pathLedge(M, DRUM, PLINTH - 0.08, 0.08, -0.2, 0.08, 'dark');
  // ribbon windows: recessed glass, dark mullions on a ~1.35 m module, a dark fascia over them
  pathSkin(M, DRUM, PLINTH, RIB, -0.14, 'glass');
  const n = Math.round(DRUM_LEN / 1.35);
  for (let k = 0; k <= n; k++) {
    const f = frameAtArc(DRUM, Math.min(DRUM_LEN - 0.06, Math.max(0.06, k * DRUM_LEN / n)), -0.14);
    slab(b, f, 0, PLINTH, 0.11, RIB - PLINTH, 0.1, 'frame');
  }
  pathLedge(M, DRUM, 3.85, 0.05, -0.16, -0.06, 'frame');   // transom of the upper lights
  pathLedge(M, DRUM, RIB, 0.22, -0.2, 0.32, 'dark');
  // yellow brick to the coping, the dark coping that caps the drum
  pathSkin(M, DRUM, RIB + 0.22, BRICK_TOP, 0, 'ochre');
  pathLedge(M, DRUM, BRICK_TOP, COPING - BRICK_TOP, -0.4, 0.14, 'slate');
  // the orange-red panel at the east end of the ribbon (2021)
  slab(b, frameAtArc(DRUM, DRUM_LEN - 0.45, 0), 0, PLINTH, 0.6, RIB - PLINTH, 0.05, 'red');
  // posters in red frames on the plinth (front-1 at s = 1.1, 2.3, 4.6, 6.8, 9.3, 11.5 m from vertex 129)
  for (const s of [1.1, 2.3, 4.6, 6.8, 9.3, 11.5]) {
    const f = frameAtArc(DRUM, STRAIGHT0 + s, 0.04);
    slab(b, f, 0, 0.85, 0.8, 1.3, 0.05, 'red');
    slab(b, f, 0, 0.95, 0.62, 1.1, 0.06, 'white', 0.05);
  }
  // the two-tone sign: olive top lettered Theater, red bottom lettered Bellevue
  const sf = frameAtArc(DRUM, STRAIGHT0 + 5.92, 0);
  slab(b, sf, 0, 6.5, 2.45, 0.65, 0.1, 'bronze');
  slab(b, sf, 0, 5.85, 2.45, 0.65, 0.1, 'red');
  lettering(b, sf, 'Theater', 0, 6.62, 0.05, 0.03, 'white', 0.1);
  lettering(b, sf, 'Bellevue', 0, 5.98, 0.05, 0.03, 'white', 0.1);
}

function eastSegment(c: Ctx) {
  const {K, b} = c;
  // the 0.7 m jog and the 5.4 m segment: yellow brick to the coping
  const jog: Chord = {a: R[130], b: R[131]};
  const SJ = K.sec(jog, 0, Math.hypot(R[131][0] - R[130][0], R[131][1] - R[130][1]), 0, BRICK_TOP, 'ochre', 0);
  void SJ;
  const EL = Math.hypot(R[132][0] - R[131][0], R[132][1] - R[131][1]);
  const S = K.sec(EAST, 0, EL, -0.3, BRICK_TOP, 'ochre', 0);
  const f = K.faceFrame(S, 0);
  // stage door: grey surround, red double door with poster panels
  K.opening(S, 2.25, 0, 1.6, 2.3, {frame: 'slate', back: 'red', depth: 0.16, edge: 0.08, cols: 2});
  border(b, f, 2.25, 0.02, 2.2, 2.48, 0.3, 0.08, 'slate');
  // the round window in its grey square frame
  disc(b, f, 2.4, 6.15, 0.66, 0.02, 'glass', -0.08);
  ringSlab(b, f, 2.4, 6.15, 0.66, 0.8, 0.12, 'white', 0, 24);
  border(b, f, 2.4, 5.3, 1.95, 1.75, 0.12, 0.08, 'slate');
  slab(b, f, 2.4, 6.13, 1.32, 0.05, 0.05, 'white', -0.04);
  // a small lamp box beside the door
  slab(b, f, 0.6, 3.75, 0.4, 0.22, 0.12, 'white');
  // coping over both
  for (const ch of [jog, EAST]) {
    const L = Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]);
    slab(b, frameAt(ch, 0, 0), L / 2, BRICK_TOP, L + 0.28, COPING - BRICK_TOP - 0.05, 0.54, 'slate', -0.4);
  }
  // the jog 132-133 back to the café wing
  const j2: Chord = {a: R[132], b: R[133]};
  K.sec(j2, 0, Math.hypot(R[133][0] - R[132][0], R[133][1] - R[132][1]), 0, CAFE_TOP, 'white', 0);
}

// ---- café wing and canal house ----------------------------------------------------------------------------------------------
function cafe(c: Ctx) {
  const {K, b} = c;
  const S = K.sec(CAFE, 0, HOUSE0, -0.3, CAFE_TOP, 'white', 0);
  const f = K.faceFrame(S, 0);
  // glazed ground floor between two port-holes
  K.opening(S, 3.6, 0, 4.6, 2.75, {frame: 'frame', back: 'glass', depth: 0.3, edge: 0.08, cols: 4, bars: [2.2]});
  disc(b, f, 0.75, 1.75, 0.34, 0.05, 'glass', 0);
  ringSlab(b, f, 0.75, 1.75, 0.3, 0.42, 0.08, 'concrete', 0, 16);
  // first-floor window under its awning
  K.opening(S, 3.45, 4.55, 3.15, 1.85, {frame: 'white', back: 'glass', depth: 0.16, edge: 0.07, cols: 4, bars: [1.2]});
  slab(b, f, 3.45, 4.38, 3.3, 0.1, 0.14, 'white');
  awning(b, f, 3.45, 6.45, 3.3, 0.18, 0.35, 'dark');
  slab(b, f, HOUSE0 / 2, CAFE_TOP - 0.4, HOUSE0 + 0.1, 0.2, 0.14, 'white');
}

function canopy(c: Ctx) {
  const {b} = c;
  // the long canopy over the café and the house's ground floor, white letters standing on it (2021)
  const f = frameAt(CAFE, 0, 0);
  const t0 = 0.6, t1 = CAFE_L - 0.1, mid = (t0 + t1) / 2;
  slab(b, f, mid, 2.9, t1 - t0, 0.25, 1.0, 'white');
  slab(b, f, mid, 2.82, t1 - t0 - 0.1, 0.08, 0.9, 'dark');
  lettering(b, f, 'Theater Bellevue', 3.6, 3.15, 0.085, 0.06, 'white', 0.55);
  lettering(b, f, 'De Smoeshaan', 10.6, 3.15, 0.045, 0.05, 'white', 0.6);
}

function house(c: Ctx) {
  const {K, b} = c;
  const H0 = HOUSE0, W = CAFE_L - H0, mid = H0 + W / 2;
  // cream-rendered ground floor and mezzanine
  const G = K.sec(CAFE, H0, CAFE_L, -0.3, 4.9, 'white', 0);
  const gf = K.faceFrame(G, 0);
  disc(b, gf, H0 + 0.45, 1.75, 0.34, 0.05, 'glass', 0);
  ringSlab(b, gf, H0 + 0.45, 1.75, 0.3, 0.42, 0.08, 'concrete', 0, 16);
  K.opening(G, mid + 0.3, 0, 4.6, 2.7, {frame: 'frame', back: 'glass', depth: 0.3, edge: 0.08, cols: 3});
  for (const s of [H0 + 0.95, H0 + 2.75, H0 + 4.6, H0 + 6.0]) {
    K.opening(G, s, 3.55, 0.85, 0.75, {frame: 'white', back: 'glass', depth: 0.12, edge: 0.06, cols: 2});
    awning(b, gf, s, 4.35, 1.05, 0.15, 0.3, 'dark');
  }
  // brick storeys: three window axes (s = 7.95, 10.35, 12.75), the centre one a bay window then a balcony
  const B = K.sec(CAFE, H0, CAFE_L, 4.9, HOUSE_CORNICE, 'brick', 0);
  const bf = K.faceFrame(B, 0);
  const axes = [H0 + 1.05, H0 + 3.45, H0 + 5.85];
  const storeys: [number, number][] = [[5.85, 1.45], [9.35, 1.55], [12.35, 1.55], [15.2, 1.25]];
  storeys.forEach(([y, h], k) => {
    for (const [i, s] of axes.entries()) {
      if (k === 0 && i === 1) continue;           // the bay window takes the first-floor centre axis
      K.opening(B, s, y, 1.1, h, {frame: 'white', back: 'glass', depth: 0.16, edge: 0.07, cols: 2, bars: [h * 0.62]});
      border(b, bf, s, y - 0.12, 1.42, h + 0.32, 0.14, 0.06, 'white');
    }
    // white sill band under every storey (speklaag)
    slab(b, bf, mid, y - 0.32, W, 0.18, 0.11, 'white');
  });
  // the white bay window on the first floor
  const bay = (y0: number, h: number) => {
    slab(b, bf, axes[1], y0, 2.2, h, 0.62, 'white');
    for (const [dt, w] of [[-0.62, 0.6], [0.0, 0.5], [0.62, 0.6]] as const) slab(b, bf, axes[1] + dt, y0 + 0.75, w, h - 1.1, 0.04, 'glass', 0.62);
    slab(b, bf, axes[1], y0 + h, 2.35, 0.14, 0.7, 'white');
  };
  bay(4.95, 2.35);
  // second-floor balcony over the bay, its railing
  slab(b, bf, axes[1], 9.0, 1.9, 0.12, 0.6, 'white');
  for (let k = 0; k <= 8; k++) slab(b, bf, axes[1] - 0.9 + k * 0.225, 9.12, 0.03, 0.85, 0.03, 'dark', 0.56);
  slab(b, bf, axes[1], 9.95, 1.9, 0.05, 0.6, 'dark');
  // cornice under the attic
  slab(b, bf, mid, HOUSE_CORNICE - 0.18, W + 0.1, 0.25, 0.35, 'white');
  slab(b, bf, mid, HOUSE_CORNICE - 0.5, W, 0.25, 0.12, 'white');
}

export function buildTheaterBellevue(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    drum(c);
    eastSegment(c);
    cafe(c);
    canopy(c);
    house(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
