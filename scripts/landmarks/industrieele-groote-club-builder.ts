import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, poly, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {arcLettering, clipRingByLine, clipRingByY, roundedTowerCap, segDist, TriSink, type Col, type XZ} from './venue-kit';
import source from './industrieele-groote-club-footprints.json' with {type: 'json'};

/**
 * Koninklijke Industrieele Groote Club, Dam 27 (BAG pand 0363100012165129, bouwjaar 1916; the club building of
 * 1913-1916). The BAG pand also holds the house at Dam 21 (Ripley's on the ground floor), the Gassan arcade at the
 * Rokin end and the Kalverstraat backs, so the model keeps the 3DBAG LoD2.2 shell (CC BY 4.0) for the roofs, the gable
 * and gable top and the backs, and draws the Dam front's storeys with cut openings below them.
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts, 40.5 px/m over the 34.4 m Dam chord;
 * ids in industrieele-groote-club-inventory.json): TMX7316010203-002031_pano_0001_001692 (2021-03-08, bare trees) for
 * the details, recording_2025-06-16_06-42-40_02285 for the right half; positions held to the 3DBAG walls (the tower
 * cap peaks at chord s 24.1, the passage wing runs 8.61-12.62).
 *  - Dam 21 house (s 0-8.6): stone ground floor with a wide arched shop window and a side door, a three-sided oriel of
 *    four round-arched lights under a balcony, cross windows in stone surrounds, a stone cornice at 16.5 m and a
 *    pointed gable (3DBAG) with one window.
 *  - Passage wing (8.6-12.6): a round-arched carriage passage in the stone ground floor, two storeys of two-light cross
 *    windows, an arched corbel table under the 14.3 m eaves.
 *  - Club front (12.6-21.7): a stone frontispiece over the ground and first floors (two segmental shop arches under
 *    hood mouldings on carved consoles, five cross windows, a pierced tracery balustrade on top), then three brick
 *    storeys of five two-tier cross windows between stone bands, a row of round-headed attic lights, white stone
 *    corbel blocks at the gable foot (24.4 m) and a round window in the gable.
 *  - Tower (21.7-26.5): the club entrance, a round arch under the carved arc DE INDUSTRIEELE GROOTE CLUB and a crown,
 *    three-light windows on five storeys; over the shaft a lantern stage with tall louvred lights, a drum and a tall
 *    rounded slate dome with a gilt ball (drawn: 3DBAG reads the top as a pyramid to 42.6 m).
 *  - Gassan arcade (28.6-34.4): stone, round-arched shop windows, 5.3 m terrace roof; the set-back east wing above.
 *
 * Native frame of industrieele-groote-club-footprints.json (x east, z south, y up from the 1.29 m NAP pavement).
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const DM: Chord = {a: R[7], b: R[14]};        // Dam front, s from the Dam 21 party wall westward (34.37 m)
const DM_LEN = Math.hypot(R[14][0] - R[7][0], R[14][1] - R[7][1]);
const dmF = frameAt(DM, 0, 0);
const BASE = -0.3;

// ---- parts along the Dam chord (s) and the tops the drawn sections stop at (the 3DBAG shell goes on above) -----------------
const LH = [0, 8.61] as const, LINK = [8.61, 12.62] as const, GB = [12.62, 21.7] as const, TW = [21.7, 28.55] as const, AR = [28.55, DM_LEN] as const;
const TW_E = 26.5;                      // tower shaft east edge; the strip to 28.55 fronts the east wing
const TOP = {lh: 16.5, link: 14.3, gb: 24.4, tw: 28.0, strip: 24.4, ar: 5.3};
const GABLE_APEX = 30.6;               // gable apex over the club front (3DBAG wall 93 top, photo 30.2)
const GF = 5.95;                       // stone ground floor top (frontispiece and arcade band)
const GB_MID = 16.95, TW_MID = 23.9;   // gable axis, tower axis (3DBAG cap apex 24.1)

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};

/** Plan point at chord s, `o` metres out of the front. */
const at = (s: number, o = 0): XZ => [dmF.origin[0] + dmF.tangent[0] * s + dmF.n[0] * o, dmF.origin[1] + dmF.tangent[1] * s + dmF.n[1] * o];

// ---- shell: the 3DBAG walls on the Dam front are cut at the drawn sections' tops ---------------------------------------------
function shell(c: Ctx) {
  const path = R.slice(7, 15);
  const onFront = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => path.some((q, i) => i + 1 < path.length && segDist([p[0], p[2]], q, path[i + 1]).d <= 0.7));
  // the club front's gable is drawn by hand (3DBAG reads it as a slope rising into the tower), so nothing is kept there
  const cuts: Array<[number, number, number]> = [[LH[0] - 1, LH[1], TOP.lh], [LINK[0], LINK[1], TOP.link], [TW[0], TW_E, TOP.tw], [TW_E, TW[1], TOP.strip], [AR[0], AR[1] + 1, TOP.ar]];
  const out: Surface[] = [];
  // 3DBAG's notch roofs just behind the gable front (a 21.5 m flat at the gable axis) sit inside the drawn section
  const notch = (s: Surface) => s.type === 'RoofSurface' && s.rings[0].every(p => {
    const q = segDist([p[0], p[2]], DM.a, DM.b);
    return q.d <= 0.6 && q.u * DM_LEN >= GB[0] && q.u * DM_LEN <= TW[1] && p[1] <= TOP.gb + 0.1;
  });
  for (const s of SRC.surfaces) {
    if (notch(s)) continue;
    if (!onFront(s)) { out.push(s); continue; }
    if (facesIn(s)) { out.push({...s, rings: [[...s.rings[0]].reverse()]}); continue; }   // wall 44 (terrace sliver) is wound inwards: turn it to face the Dam
    for (const [s0, s1, top] of cuts) {
      // the vertical planes at s0 and s1 (across the chord), then the horizontal plane at the section top
      let r = clipRingByLine(s.rings[0], at(s0), at(s0, 1), keepSide(at(s0), at(s0, 1), at(s0 + 1)));
      if (r.length) r = clipRingByLine(r, at(s1), at(s1, 1), keepSide(at(s1), at(s1, 1), at(s1 - 1)));
      if (r.length) r = clipRingByY(r, top, 1);
      if (r.length) out.push({...s, rings: [r]});
    }
  }
  // the tower top above the shaft: 3DBAG reads the lantern stage and dome as one pyramid to 42.6 m. Drop every piece
  // whose centroid stands in the tower plan above the shaft (and the strip's front above its cornice, which with the
  // pyramid gone would stand alone); towerTop() draws the stage, drum and dome from the photo.
  const kept: Surface[] = [];
  for (const s of out) {
    const t = inTowerTop(s);
    if (t === 'drop') continue;
    if (t === 'clip') { const r = clipRingByY(s.rings[0], TOP.tw, -1); if (r.length) kept.push({...s, rings: [r]}); continue; }
    kept.push(s);
  }
  addShell(c.b, {surfaces: kept, nativeRing: R}, {wall: 'brick', roof: 'slate'});
}
/** Chord s and outward offset o of a plan point. */
function chordSO(x: number, z: number): [number, number] {
  const dx = x - dmF.origin[0], dz = z - dmF.origin[1];
  return [dx * dmF.tangent[0] + dz * dmF.tangent[1], dx * dmF.n[0] + dz * dmF.n[1]];
}
/**
 * A 3DBAG piece of the tower top, by its centroid in the tower plan (s 21.0-28.6, up to 6.3 m back): 'drop' when it
 * starts at or above the strip cornice and reaches over the shaft top, 'clip' (keep the part under the shaft top) when
 * it starts lower, 'keep' otherwise.
 */
function inTowerTop(s: Surface): 'drop' | 'clip' | 'keep' {
  const r = s.rings[0], n = r.length;
  const cx = r.reduce((a, p) => a + p[0], 0) / n, cz = r.reduce((a, p) => a + p[2], 0) / n;
  const [cs, co] = chordSO(cx, cz), ys = r.map(p => p[1]);
  if (!(cs > 21.0 && cs < 28.6 && co > -6.3 && co < 0.3) || Math.max(...ys) <= TOP.tw + 0.3) return 'keep';
  return Math.min(...ys) >= TOP.strip - 0.05 ? 'drop' : 'clip';
}
/** Newell normal of a wall ring pointing into the block (away from the Dam). */
function facesIn(s: Surface): boolean {
  const r = s.rings[0];
  let nx = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
  return nx * dmF.n[0] + nz * dmF.n[1] < 0;
}
/** clipRingByLine's `keep` sign for the side of a->b that holds `inside`. */
function keepSide(a: XZ, b: XZ, inside: XZ): 1 | -1 {
  return (b[0] - a[0]) * (inside[1] - a[1]) - (b[1] - a[1]) * (inside[0] - a[0]) >= 0 ? 1 : -1;
}

// ---- shared pieces --------------------------------------------------------------------------------------------------------------
const ff = (c: Ctx, S: Sec, proud = 0): Frame => c.K.faceFrame(S, proud);
/** Cross window: white frame, a transom at `tr` (absolute y), stone sill and lintel 6 cm proud. */
function cross(c: Ctx, S: Sec, s: number, y0: number, y1: number, w: number, tr: number | null, o: {cols?: number; dress?: Col | null} = {}) {
  c.K.opening(S, s, y0, w, y1 - y0, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07, cols: o.cols ?? 1, ...(tr !== null ? {bars: [tr - y0]} : {})});
  const f = ff(c, S), dress = o.dress === undefined ? 'stone' : o.dress;
  if (dress) {
    // sill and lintel clear the reveal floor and head by 5 cm (sunk solids would share their planes)
    slab(c.b, f, s, y0 - 0.19, w + 0.2, 0.14, 0.08, dress);
    slab(c.b, f, s, y1 + 0.05, w + 0.12, 0.18, 0.06, dress);
  }
}
/** Round-headed light with a stone arch ring. */
function arched(c: Ctx, S: Sec, s: number, y0: number, y1: number, w: number, back: Col = 'glass', depth = 0.18, ring: Col | null = 'stone', th = 0.12) {
  c.K.opening(S, s, y0, w, y1 - y0, {frame: back === 'glass' ? 'white' : 'stone', back, depth, edge: back === 'glass' ? 0.06 : 0, rise: w / 2});
  if (ring) c.K.archHead(S, s, y1 - w / 2, w, w / 2, th, 0.07, ring);
}
const band = (c: Ctx, S: Sec, s0: number, s1: number, y: number, h: number, d: number, col: Col = 'stone') => slab(c.b, ff(c, S), (s0 + s1) / 2, y, s1 - s0, h, d, col);

// ---- Dam 21 house ----------------------------------------------------------------------------------------------------------------
function leftHouse(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(DM, LH[0], LH[1], BASE, GF, 'stone', 0);
  // the wide arched shop window (photo 1.3-5.2 m, crown 5.0 m) and the house door
  K.opening(G, 3.4, 0.2, 3.9, 4.75, {frame: 'white', back: 'glass', depth: 0.25, edge: 0.08, cols: 3, bars: [3.35], rise: 0.9});
  K.archHead(G, 3.4, 4.95 - 0.9, 3.9, 0.9, 0.25, 0.08, 'stone');
  K.opening(G, 7.15, 0, 1.15, 3.2, {frame: 'white', back: 'dark', depth: 0.2, edge: 0.07, bars: [2.55]});
  const W = K.sec(DM, LH[0], LH[1], GF, TOP.lh, 'brick', 0);
  // oriel: a three-sided bay of four round-arched lights on a stone corbel, balcony on top
  const f = ff(c, W);
  slab(b, f, 2.95, GF - 0.35, 4.9, 0.35, 0.55, 'stone');
  slab(b, f, 2.95, GF, 4.8, 3.6, 0.6, 'brick');
  for (const t of [1.15, 2.35, 3.55, 4.75]) {
    archSlab(b, f, t, GF + 0.62, 0.7, 2.26, 0.06, 'glass', 0.6);
    archBand(b, f, t, GF + 0.55, 0.86, 2.4, 0.09, 0.12, 'stone', 0.6);
  }
  slab(b, f, 2.95, GF + 3.6, 5.0, 0.18, 0.7, 'stone');                    // balcony floor
  for (let k = 0; k <= 12; k++) slab(b, f, 0.55 + k * 0.4, GF + 3.78, 0.1, 0.42, 0.08, 'stone', 0.58);
  slab(b, f, 2.95, GF + 4.2, 5.0, 0.12, 0.7, 'stone');                    // rail
  // side column and the upper floors (two-light middle windows between single ones)
  cross(c, W, 7.15, 6.5, 8.6, 1.15, 7.7, {cols: 2});
  for (const [y0, y1] of [[10.4, 12.6], [13.8, 15.9]] as const) {
    cross(c, W, 1.7, y0, y1, 0.75, y0 + 1.4);
    cross(c, W, 3.2, y0, y1, 1.25, y0 + 1.4, {cols: 2});
    cross(c, W, 4.75, y0, y1, 0.75, y0 + 1.4);
    cross(c, W, 7.15, y0, y1, 1.15, y0 + 1.4, {cols: 2});
  }
  band(c, W, LH[0] + 0.04, LH[1] - 0.04, GF, 0.2, 0.08);
  band(c, W, LH[0] + 0.04, LH[1] - 0.04, 9.95, 0.15, 0.06);
  K.coping(W, TOP.lh - 0.2, 0.3, 0.3, 'stone', LH[0] + 0.04, LH[1] - 0.04, 0.4);
}

// ---- passage wing --------------------------------------------------------------------------------------------------------------
function link(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(DM, LINK[0], LINK[1], BASE, GF, 'stone', 0);
  arched(c, G, 10.6, 0, 4.6, 3.5, 'dark', 0.8, 'stone', 0.3);
  const W = K.sec(DM, LINK[0], LINK[1], GF, TOP.link, 'brick', 0);
  for (const [y0, y1, tr] of [[6.4, 8.9, 7.7], [10.3, 12.4, 11.5]] as const) cross(c, W, 10.7, y0, y1, 1.9, tr, {cols: 2});
  const f = ff(c, W);
  band(c, W, LINK[0] + 0.04, LINK[1] - 0.04, GF, 0.2, 0.08);
  // arched corbel table under the eaves: small stone corbels carrying a brick band
  for (let t = 8.95; t < 12.4; t += 0.42) slab(b, f, t, 13.25, 0.12, 0.35, 0.16, 'stone');
  slab(b, f, (LINK[0] + LINK[1]) / 2, 13.6, LINK[1] - LINK[0] - 0.08, 0.45, 0.2, 'brick');
  K.coping(W, TOP.link - 0.25, 0.25, 0.3, 'stone', LINK[0] + 0.04, LINK[1] - 0.04, 0.4);
}

// ---- club front: stone frontispiece, brick storeys, gable foot -----------------------------------------------------------------
function clubFront(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(DM, GB[0], GB[1], BASE, GF, 'stone', 0);
  for (const t of [GB_MID - 2.1, GB_MID + 2.1]) {
    K.opening(G, t, 0.1, 3.2, 4.25, {frame: 'frame', back: 'glass', depth: 0.3, edge: 0.08, bars: [2.9], rise: 0.55});
    K.archHead(G, t, 4.35 - 0.55, 3.2, 0.55, 0.22, 0.1, 'stone');          // hood moulding
  }
  const fg = ff(c, G);
  for (const t of [GB[0] + 0.35, GB_MID, GB[1] - 0.35]) slab(b, fg, t, 3.95, 0.45, 0.75, 0.22, 'stone');   // carved consoles
  // first floor of the frontispiece: five cross windows, tracery balustrade
  const P = K.sec(DM, GB[0], GB[1], GF, 10.45, 'stone', 0);
  const axes = [-2.9, -1.45, 0, 1.45, 2.9].map(v => GB_MID + v);
  for (const t of axes) cross(c, P, t, 6.3, 9.0, 0.9, 7.75, {dress: null});
  const fp = ff(c, P);
  slab(b, fp, GB_MID, GF, GB[1] - GB[0] - 0.08, 0.25, 0.1, 'stone');
  slab(b, fp, GB_MID, 9.35, GB[1] - GB[0] - 0.08, 0.18, 0.1, 'stone');
  for (const t of axes) {
    slab(b, fp, t, 9.6, 1.25, 0.75, 0.06, 'frame');                       // pierced panel (shadow behind the tracery)
    for (const dt of [-0.3, 0.3]) ringSlab(b, fp, t + dt, 9.97, 0.15, 0.24, 0.12, 'stone', 0.06, 12);
    ringSlab(b, fp, t, 9.97, 0.07, 0.12, 0.12, 'stone', 0.06, 10);
  }
  for (const t of [...axes.slice(0, 4).map(v => v + 0.725), GB[0] + 0.12, GB[1] - 0.12]) slab(b, fp, t, 9.53, 0.2, 0.92, 0.14, 'stone');
  slab(b, fp, GB_MID, 10.3, GB[1] - GB[0] - 0.08, 0.15, 0.16, 'stone');   // balustrade coping
  // brick storeys: five cross windows, stone bands, round-headed attic lights
  const W = K.sec(DM, GB[0], GB[1], 10.45, TOP.gb, 'brick', 0);
  const cols = [-2.6, -1.3, 0, 1.3, 2.6].map(v => GB_MID + v);
  for (const [y0, y1, tr] of [[10.6, 12.9, 11.75], [14.0, 16.3, 15.3], [17.3, 19.6, 18.7]] as const)
    for (const t of cols) cross(c, W, t, y0, y1, 0.8, tr);
  for (const t of cols) arched(c, W, t, 21.3, 22.7, 0.62);
  band(c, W, GB[0] + 0.04, GB[1] - 0.04, 20.2, 0.28, 0.1);
  // gable foot: stone consoles and white corbel blocks under the 24.4 m cornice
  const fw = ff(c, W);
  for (let t = GB[0] + 0.5; t < GB[1] - 0.3; t += 0.75) {
    slab(b, fw, t, 22.95, 0.22, 0.45, 0.1, 'stone');
    slab(b, fw, t, 23.95, 0.3, 0.35, 0.18, 'white');
  }
  K.coping(W, TOP.gb - 0.12, 0.25, 0.25, 'stone', GB[0] + 0.04, GB[1] - 0.04, 0.4);
  // the gable: brick triangle from the cornice to the apex, stone coping on the rakes, the round window
  const gf = frameAt(DM, 0, 0), half = GB_MID - GB[0], slope = (GABLE_APEX - TOP.gb) / half;
  const G3 = (t: number, y: number, o: number) => [gf.origin[0] + gf.tangent[0] * t + gf.n[0] * o, y, gf.origin[1] + gf.tangent[1] * t + gf.n[1] * o];
  const out3 = [gf.n[0], 0, gf.n[1]], in3 = [-gf.n[0], 0, -gf.n[1]];
  c.M.tri('brick', G3(GB[0], TOP.gb, 0), G3(GB[0] + 2 * half, TOP.gb, 0), G3(GB_MID, GABLE_APEX, 0), out3);
  c.M.tri('brick', G3(GB[0], TOP.gb, -0.45), G3(GB[0] + 2 * half, TOP.gb, -0.45), G3(GB_MID, GABLE_APEX, -0.45), in3);
  const yAt = (t: number) => (t <= GB_MID ? TOP.gb + (t - GB[0]) * slope : GABLE_APEX - (t - GB_MID) * slope);
  const dy = 0.32 * Math.hypot(1, slope);
  const rake = (t0: number, t1: number) => poly(b, gf, 0, 0, [[t0, yAt(t0) - 0.02], [t1, yAt(t1) - 0.02], [t1, yAt(t1) + dy], [t0, yAt(t0) + dy]], 0.62, 'stone', -0.45);
  rake(GB[0] - 0.1, GB_MID);
  rake(GB_MID, GB[0] + 2 * half + 0.1);
  ringSlab(b, gf, GB_MID, 25.6, 0.5, 0.66, 0.1, 'stone', 0, 20);
  disc(b, gf, GB_MID, 25.6, 0.52, 0.05, 'glass', 0);
}

// ---- tower ---------------------------------------------------------------------------------------------------------------------
function tower(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(DM, TW[0], TW[1], BASE, GF, 'stone', 0);
  arched(c, G, TW_MID, 0, 4.25, 2.7, 'dark', 0.6, 'stone', 0.25);
  const fg = ff(c, G);
  // the club's name carved round the arch, and the crown over it
  arcLettering(b, fg, 'DE INDUSTRIEELE GROOTE CLUB', TW_MID, 1.4, 3.55, 0.025, 0.03, 'dark');
  slab(b, fg, TW_MID, 5.3, 0.36, 0.14, 0.08, 'gold');
  for (const dt of [-0.14, 0, 0.14]) slab(b, fg, TW_MID + dt, 5.44, 0.07, dt === 0 ? 0.3 : 0.22, 0.08, 'gold');
  const W = K.sec(DM, TW[0], TW_E, GF, TOP.tw, 'brick', 0);
  const lights: Array<[number, number]> = [[TW_MID - 1.05, 0.68], [TW_MID, 0.68], [TW_MID + 1.05, 0.68]];
  for (const [y0, y1, tr] of [[6.3, 9.0, 7.75], [10.6, 12.9, 11.75], [14.0, 16.3, 15.3], [17.3, 19.6, 18.7]] as const)
    for (const [t, w] of lights) cross(c, W, t, y0, y1, w, tr, {dress: 'stone'});
  for (const [t, w] of lights) arched(c, W, t, 21.3, 23.0, w);
  for (const dt of [-0.6, 0, 0.6]) arched(c, W, TW_MID + dt, 24.95, 27.0, 0.34, 'dark', 0.3, null);   // tall louvred lights
  band(c, W, TW[0] + 0.04, TW_E - 0.04, 20.2, 0.28, 0.1);
  const fw = ff(c, W);
  slab(b, fw, TW_MID, TOP.gb - 0.05, TW_E - TW[0] - 0.08, 0.35, 0.22, 'stone');                    // corbel course
  K.coping(W, TOP.tw - 0.2, 0.25, 0.22, 'stone', TW[0] + 0.04, TW_E - 0.04, 0.4);
  // the east strip in front of the wing (3DBAG wall to 29 m): one column of narrow lights
  const E = K.sec(DM, TW_E, TW[1], GF, TOP.strip, 'brick', 0);
  for (const y0 of [6.6, 10.4, 13.8, 17.2]) cross(c, E, 27.5, y0, y0 + 1.7, 0.6, null);
  towerTop(c);
}

/**
 * The tower top, read on the rectified Dam-front crops (25 px/m; TMX7316010203-001662_pano_0000_001492, 2020-04-21, and
 * recording_2025-07-03_03-29-47_02632), heights corrected for the set-back with the 3DBAG walls (37.7-38.1 m) and apex
 * (42.6 m): a brick lantern stage 28-34.4 m a little narrower than the shaft with three tall louvred lights a side, a
 * stone cornice, a short drum, and a tall rounded slate dome (base about 4.2 m across) with a gilt ball and spike, where
 * 3DBAG has a pyramid. The east strip's roof behind its 24.4 m cornice slopes back to the wing.
 */
const STAGE = {s0: 21.9, s1: 26.3, o0: -0.15, o1: -4.85, y0: TOP.tw - 0.02, y1: 34.4};
function towerTop(c: Ctx) {
  const {b} = c;
  const tf = frameAt(DM, 0, 0), sm = (STAGE.s0 + STAGE.s1) / 2, om = (STAGE.o0 + STAGE.o1) / 2;
  const w = STAGE.s1 - STAGE.s0, d = STAGE.o0 - STAGE.o1;
  slab(b, tf, sm, STAGE.y0, w, STAGE.y1 - STAGE.y0, d, 'brick', STAGE.o1);
  // louvred lights on all four faces: three tall arched lights with stone bands, the corner piers proud
  const faces: Array<{f: Frame; len: number}> = [];
  const corner = (s: number, o: number): XZ => at(s, o);
  const quad: XZ[] = [corner(STAGE.s0, STAGE.o0), corner(STAGE.s1, STAGE.o0), corner(STAGE.s1, STAGE.o1), corner(STAGE.s0, STAGE.o1)];
  for (let i = 0; i < 4; i++) {
    const p = quad[i], q = quad[(i + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const tg: XZ = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    faces.push({f: {origin: p, tangent: tg, n: [-tg[1], tg[0]]}, len: L});
  }
  for (const {f, len} of faces) {
    // n = (-tz, tx) points out of a counter-clockwise ring; check against the stage centre and flip if needed
    const mid: XZ = [f.origin[0] + f.tangent[0] * len / 2, f.origin[1] + f.tangent[1] * len / 2], cen = at(sm, om);
    const outward = (mid[0] - cen[0]) * f.n[0] + (mid[1] - cen[1]) * f.n[1] > 0;
    const g: Frame = outward ? f : {origin: [f.origin[0] + f.tangent[0] * len, f.origin[1] + f.tangent[1] * len], tangent: [-f.tangent[0], -f.tangent[1]], n: [-f.n[0], -f.n[1]]};
    for (const dt of [-0.75, 0, 0.75]) {
      archSlab(b, g, len / 2 + dt, 29.0, 0.36, 3.2, 0.04, 'dark', 0);
      archBand(b, g, len / 2 + dt, 28.92, 0.5, 3.36, 0.07, 0.08, 'stone', 0);
    }
    slab(b, g, len / 2, 28.75, len - 0.6, 0.12, 0.1, 'stone');                       // sill band
    for (const sd of [-1, 1]) slab(b, g, len / 2 + sd * (len / 2 - 0.25), STAGE.y0, 0.5, STAGE.y1 - STAGE.y0, 0.12, 'brick');
  }
  // stone cornice over the stage, then the drum, dome, ball and spike
  slab(b, tf, sm, STAGE.y1, w + 0.5, 0.35, d + 0.5, 'stone', STAGE.o1 - 0.25);
  roundedTowerCap(b, tf, sm, om, STAGE.y1 + 0.35, {drumR: 2.0, drumH: 1.1, sides: 8, corniceR: 2.25, corniceH: 0.22, domeR: 2.1, domeH: 4.6, fullness: 0.75, ballR: 0.35, spikeH: 0.6},
    {drum: 'brick', trim: 'stone', dome: 'slate', ball: 'gold'});
  // the east strip's roof: from the 24.4 m cornice back to the wing behind (a slate slope, 3DBAG's front piece dropped)
  const a0 = at(TW_E - 0.01, 0), a1 = at(TW[1] + 0.3, 0), b1 = at(TW[1] + 0.3, -5.0), b0 = at(TW_E - 0.01, -5.0);
  const y0 = TOP.strip, y1 = TOP.strip + 3.6;
  c.M.quad('slate', [a0[0], y0, a0[1]], [a1[0], y0, a1[1]], [b1[0], y1, b1[1]], [b0[0], y1, b0[1]], [dmF.n[0] * 0.8, 0.6, dmF.n[1] * 0.8]);
  c.M.tri('slate', [a1[0], y0, a1[1]], [b1[0], y1, b1[1]], [b1[0], y0, b1[1]], [dmF.tangent[0], 0, dmF.tangent[1]]);
}

// ---- Gassan arcade and the east wing behind its terrace ---------------------------------------------------------------------------
function arcade(c: Ctx) {
  const {K, b} = c;
  const G = K.sec(DM, AR[0], AR[1], BASE, TOP.ar, 'stone', 0);
  for (const t of [30.05, 32.6]) arched(c, G, t, 0.3, 4.05, 1.9, 'glass', 0.25, 'stone', 0.18);
  K.coping(G, TOP.ar - 0.2, 0.3, 0.15, 'stone', AR[0] + 0.04, AR[1] - 0.04, 0.4);
  // wing windows on the 3DBAG walls set back behind the terrace (wall 206: 29.0-33.0 m, 1.6-2.65 m back)
  const a = at(29.01, -1.59), z = at(33.01, -2.65), L = Math.hypot(z[0] - a[0], z[1] - a[1]);
  const tg: XZ = [(z[0] - a[0]) / L, (z[1] - a[1]) / L], f: Frame = {origin: a, tangent: tg, n: [-tg[1], tg[0]]};
  for (const u of [0.7, 2.05, 3.4]) for (const y0 of [7.0, 10.4, 13.8, 17.2]) {
    archSlab(b, f, u, y0, 0.7, 1.7, 0.05, 'glass', 0.0);
    archBand(b, f, u, y0 - 0.08, 0.86, 1.86, 0.08, 0.12, 'stone', 0.0);
  }
}

export function buildIndustrieeleGrooteClub(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    leftHouse(c);
    link(c);
    clubFront(c);
    tower(c);
    arcade(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
