import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, poly, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {arcLettering, clipRingByLine, clipRingByY, segDist, TriSink, type Col, type XZ} from './venue-kit';
import source from './industrieele-groote-club-footprints.json' with {type: 'json'};

/**
 * Koninklijke Industrieele Groote Club, Dam 27 (BAG pand 0363100012165129, bouwjaar 1916; the club building of
 * 1913-1916). The BAG pand also holds the house at Dam 21 (Ripley's on the ground floor), the Gassan arcade at the
 * Rokin end and the Kalverstraat backs, so the model keeps the 3DBAG LoD2.2 shell (CC BY 4.0) for the roofs, the gable
 * and tower tops and the backs, and draws the Dam front's storeys with cut openings below them.
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
 *    three-light windows on five storeys, tall louvred lights in the set-back top (3DBAG cap to 42.6 m).
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
  const towerCap = (s: Surface) => s.type === 'RoofSurface' && Math.min(...s.rings[0].map(p => p[1])) > 33;
  addShell(c.b, {surfaces: out, nativeRing: R}, {wall: 'brick', roof: 'slate', roofFor: s => (towerCap(s) ? 'brick' : 'slate')});
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
  // tall lights in the tower top (3DBAG wall above 28 m)
  const tf = frameAt(DM, 0, 0);
  for (const dt of [-0.75, 0, 0.75]) slab(b, tf, TW_MID + dt, 29.0, 0.3, 2.4, 0.03, 'dark');
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
