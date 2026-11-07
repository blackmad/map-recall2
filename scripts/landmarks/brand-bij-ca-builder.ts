import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, poly, slab} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {pieceFacadeBands} from './ring-height-runs';
import {clipHalf, frontCoords, type Ring3} from '../../src/canalRecall/landmarks/frontZones';
import {chordLength, frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import source from './brand-bij-ca-footprints.json';

/**
 * Damrak 70-79 / Beurspassage, BAG pand 0363100012165746 (bouwjaar 1893 in the BAG, CC0; addresses Damrak 77, 79 and
 * Beurspassage 12). The catalogue id keeps the brief's name "Brand bij C&A": the C&A store here burned on 16 February 1963
 * and was rebuilt; in 2016 the block got new fronts on its concrete frame by Robert A.M. Stern Architects with Rijnboutt for
 * Bouwinvest, with the Beurspassage and its "Amsterdamse Oersoep" vault (Arno Coenen, Iris Roskam) through it (nl.wikipedia:
 * Beurspassage; Damrak). What the Gemeente Amsterdam panoramas show (CC BY 4.0, artifacts/landmark-briefs/brand-bij-ca/):
 *  - Damrak (faces SE): red brick with white stone speklagen, five bays, each a double-height white-framed shopfront under a
 *    pair of white stone oriels rising four storeys on corbels to pointed crowns; the Beurspassage under a round arch of red
 *    and white voussoirs at the south end, three window rows over it and the brick corner tower;
 *  - Nieuwendijk (faces NW): six 6.1 m bays between banded piers, curved glass shop bays at the ground and first floor,
 *    banded brick storeys above.
 *
 * Native frame of brand-bij-ca-footprints.json (x east, z south, y up from the 1.27 m NAP street). Massing: a closed prism
 * under every 3DBAG LoD2.2 roof piece (CC BY 4.0), trimmed behind the fronts. Fronts: walls 0.3 m outside the BAG chords
 * with cut openings; the oriels are their own cut faces standing 0.6 m out.
 */
const OFF = 0.3;
const ch = (a: [number, number], b: [number, number]): Chord => ({a, b});
// Damrak line, north-east to south-west along the street (s from the Damrak 70 party wall)
const DAMRAK = ch([14.263, 23.362], [45.933, -16.053]);
// Nieuwendijk bays (6.1 m) and the piers between them (1.9 m), north-east to south-west
const NW_BAYS = [ch([-6.099, -31.572], [-10.179, -27.022]), ch([-11.449, -25.592], [-15.549, -21.022]), ch([-16.759, -19.582], [-20.639, -14.852]), ch([-21.839, -13.402], [-25.389, -8.412]), ch([-26.489, -6.882], [-30.039, -1.892])];
const NW_PIERS = [ch([-10.038, -26.895], [-11.308, -25.465]), ch([-15.408, -20.895], [-16.612, -19.461]), ch([-20.492, -14.731], [-21.684, -13.292]), ch([-25.234, -8.302], [-26.334, -6.772])];
const NW_END = [ch([0.593, -37.510], [-4.729, -32.751]), ch([-4.729, -32.751], [-5.958, -31.445])];

// Damrak heights (w01-128, 45.9 px/m; the 3DBAG roofs just behind: 24.6 m to s 14.5, 27.9 m to s 46.5, the tower 36.8 m)
const LOW_END = 16.5, ARCH0 = 41.6, TOWER0 = 46.5;   // the low part ends on the pier after the second bay (3DBAG step at 14.5-15)
const BAYS = [5.0, 12.7, 20.4, 28.3, 36.2];
const SHOP_TOP = 8.7, ORIEL_FOOT = 10.4;
const ORIEL_ROWS: [number, number][] = [[10.6, 3.0], [15.2, 3.0], [19.8, 3.1], [24.4, 2.8]];

function trimBehind(rings: Ring3[], chords: Chord[], d: number): Ring3[] {
  let out = rings;
  for (const c of chords) {
    const L = chordLength(c), tx = (c.b[0] - c.a[0]) / L, tz = (c.b[1] - c.a[1]) / L, k = tx * c.a[0] + tz * c.a[1];
    const before = {nx: -tx, nz: -tz, c: -k}, after = {nx: tx, nz: tz, c: k + L};
    const behind = {nx: tz, nz: -tx, c: d + tz * c.a[0] - tx * c.a[1]};
    const within = (r: Ring3) => clipHalf(clipHalf(r, {nx: tx, nz: tz, c: k}), {nx: -tx, nz: -tz, c: -(k + L)});
    out = out.flatMap(r => {
      const xs = r.map(p => frontCoords(c, p[0], p[2]));
      if (xs.every(q => q.o <= -d) || xs.every(q => q.s <= 0) || xs.every(q => q.s >= L)) return [r];
      return [clipHalf(r, before), clipHalf(r, after), clipHalf(within(r), behind)].filter(q => q.length >= 3 && Math.abs(area(q)) > 0.01);
    });
  }
  return out;
}
const area = (r: Ring3) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0) / 2;

function massing(b: BuildingTools) {
  const rings = source.roofs.map(r => r[0] as Ring3);
  for (const r of trimBehind(rings, [DAMRAK, ...NW_BAYS, ...NW_PIERS, ...NW_END], 0.08)) {
    const ys = r.map(p => p[1]);
    roofPrism(b, [r], 'brick', Math.max(...ys) - Math.min(...ys) > 0.6 ? 'slate' : 'concrete');
  }
}

/** A pair of three-sided white stone oriels over a bay: front and chamfer faces cut with the windows, closed top and foot. */
function orielPair(K: FrontKit, b: BuildingTools, c: Chord, mid: number, top: number) {
  const L = chordLength(c), t = [(c.b[0] - c.a[0]) / L, (c.b[1] - c.a[1]) / L], n = [-t[1], t[0]];
  const P = (s: number, o: number): [number, number] => [c.a[0] + t[0] * s + n[0] * o, c.a[1] + t[1] * s + n[1] * o];
  const D = 0.6, W = 2.2, F = 1.3;                 // projection, width at the wall, width of the front face
  for (const sd of [-1.2, 1.2]) {
    const s = mid + sd, s0 = s - W / 2, s1 = s + W / 2, f0 = s - F / 2, f1 = s + F / 2;
    const front = ch(P(f0, OFF + D), P(f1, OFF + D)), left = ch(P(s0, OFF), P(f0, OFF + D)), right = ch(P(f1, OFF + D), P(s1, OFF));
    const Fr = K.sec(front, 0, F, ORIEL_FOOT, top, 'gold', 0);
    // the 0.75 m chamfers are too narrow for a cut face's opening; their side lights are left solid
    K.sec(left, 0, chordLength(left), ORIEL_FOOT, top, 'gold', 0); K.sec(right, 0, chordLength(right), ORIEL_FOOT, top, 'gold', 0);
    for (const [y, h] of ORIEL_ROWS) {
      if (y + h > top - 0.35) continue;
      K.opening(Fr, F / 2, y, 1.0, h, {cols: 2, frame: 'white', depth: 0.12, bars: [h - 0.55], edge: 0.06});
    }
    // foot: the corbelled base slab and two corbel steps; top: the cap and the pointed crown
    const fw = frameAt(c, 0, OFF);
    slab(b, fw, s, ORIEL_FOOT - 0.35, W + 0.2, 0.35, D + 0.15, 'gold');
    slab(b, fw, s, ORIEL_FOOT - 1.0, 1.2, 0.65, D * 0.6, 'gold');
    slab(b, fw, s, ORIEL_FOOT - 1.6, 0.6, 0.6, D * 0.35, 'gold');
    slab(b, fw, s, top, W + 0.1, 0.25, D + 0.08, 'gold');
    poly(b, frameAt(front, 0, 0), F / 2, top + 0.25, [[-F / 2, 0], [F / 2, 0], [0, 0.45]], 0.2, 'gold', -0.1);
  }
}

function damrak(K: FrontKit, b: BuildingTools) {
  const L = chordLength(DAMRAK);
  const LO = K.sec(DAMRAK, 0, LOW_END, 0, 24.6, 'brick'), HI = K.sec(DAMRAK, LOW_END, ARCH0, 0, 27.9, 'brick');
  // the passage bay: the arch storey across the whole south end, the three window rows and the tower above it
  const AL = K.sec(DAMRAK, ARCH0, L, 0, 9.6, 'brick'), AR = K.sec(DAMRAK, ARCH0, TOWER0, 9.6, 27.9, 'brick'), TW = K.sec(DAMRAK, TOWER0, L, 9.6, 36.8, 'brick');
  const f = K.faceFrame(LO), secAt = (s: number) => (s < LOW_END ? LO : HI);
  for (const m of BAYS) {
    const S = secAt(m), top = S === LO ? 25.0 : 28.1;
    // double-height white-framed shopfront: shop glazing and doors, the mezzanine lights over a white transom
    K.opening(S, m, 0.05, 4.9, 4.3, {back: 'glass', frame: 'bronze', cols: 3, depth: 0.3, edge: 0.08});
    K.opening(S, m, 4.75, 4.9, 3.5, {back: 'glass', frame: 'gold', cols: 3, depth: 0.25, edge: 0.1});
    slab(b, f, m, 4.35, 5.4, 0.4, 0.12, 'gold');
    for (const sd of [-2.7, 2.7]) slab(b, f, m + sd, 0, 0.5, SHOP_TOP, 0.14, 'gold');
    slab(b, f, m, SHOP_TOP - 0.35, 5.9, 0.45, 0.16, 'gold');
    orielPair(K, b, DAMRAK, m, top - 0.4);
  }
  // white speklagen: storey bands across the piers and dashed quoins up the piers between the bays
  for (const [S, s0, s1] of [[LO, 0, LOW_END], [HI, LOW_END, ARCH0]] as const) {
    for (const y of [13.9, 18.5, 23.1]) if (y < S.F.y1 - 0.6) for (const [a, e] of free(s0, s1, y, 0.35)) ledgeStrip(b, f, (a + e) / 2, y, e - a, 0.35, 0.05, 'gold');
  }
  for (let k = 0; k <= BAYS.length; k++) {
    const s = k === 0 ? 1.0 : k === BAYS.length ? ARCH0 - 0.9 : (BAYS[k - 1] + BAYS[k]) / 2;
    const top = s < LOW_END ? 24.0 : 27.3;
    for (let y = 9.2; y < top; y += 0.6) if (![13.9, 18.5, 23.1].some(q => Math.abs(q - y) < 0.4)) ledgeStrip(b, f, s, y, 0.45, 0.22, 0.05, 'gold');
  }
  K.coping(LO, 24.6, 0.3, 0.1, 'gold', 0, LOW_END);
  K.coping(HI, 27.9, 0.3, 0.1, 'gold', LOW_END, ARCH0);
  K.endCap(DAMRAK, LOW_END, 24.6, 27.9, 'brick', -1, -0.6);
  // the Beurspassage: round arch of white voussoirs (the red ones are the brick between), three window rows over it, a
  // white recessed top storey
  const ac = (ARCH0 + TOWER0 + 2.6) / 2;
  K.opening(AL, 46.9, 0.05, 5.6, 8.6, {rise: 2.8, back: 'ochre', frame: 'gold', depth: 0.3, edge: 0.12});
  K.archHead(AL, 46.9, 5.85, 5.6, 2.8, 0.85, 0.08, 'gold');
  K.opening(AL, 42.8, 4.4, 1.6, 2.8, {back: 'glass', frame: 'bronze', depth: 0.3});
  void ac;
  for (const s of [42.8, 45.4]) {
    for (const [y, h] of [[10.7, 2.4], [14.4, 3.0], [18.7, 2.9]] as const) K.opening(AR, s, y, 1.8, h, {cols: 2, frame: 'white', depth: 0.2, bars: [h - 0.6]});
  }
  for (const y of [13.9, 18.0, 22.2]) slab(b, K.faceFrame(AR), (ARCH0 + TOWER0) / 2, y, TOWER0 - ARCH0, 0.35, 0.08, 'gold');
  K.opening(AR, 44.1, 23.2, 3.8, 3.4, {cols: 3, back: 'glass', frame: 'white', depth: 0.3});
  K.coping(AR, 27.9, 0.3, 0.1, 'gold');
  // the corner tower over the passage, banded, with its windows to 36.8 m
  for (const [y, h] of [[18.7, 2.9], [23.0, 2.6], [27.0, 2.6], [31.0, 2.6]] as const) K.opening(TW, (TOWER0 + L) / 2 + 0.3, y, 1.4, h, {cols: 2, frame: 'white', depth: 0.2});
  for (const y of [22.2, 26.3, 30.3, 34.4]) slab(b, K.faceFrame(TW), (TOWER0 + L) / 2, y, L - TOWER0, 0.3, 0.08, 'gold');
  K.coping(TW, 36.8, 0.3, 0.12, 'gold', TOWER0, L + 0.06);
  K.endCap(DAMRAK, TOWER0, 27.9, 36.8, 'brick', -1, -0.6);
  K.endCap(DAMRAK, 0, 0, 24.6, 'brick', -1, 0);
  K.endCap(DAMRAK, L, 0, 9.6, 'brick', 1, 0);          // split at the arch storey's top so it meets both faces' edges
  K.endCap(DAMRAK, L, 9.6, 36.8, 'brick', 1, 0);
  slab(b, K.faceFrame(AL), (ARCH0 + L) / 2, 9.4, L - ARCH0, 0.4, 0.1, 'gold');                         // band over the arch storey
}
/** Runs of [s0, s1] at height y..y+h that keep 5 cm clear of the oriels (they stand over the bays from the shopfront up). */
function free(s0: number, s1: number, y: number, h: number): [number, number][] {
  void h; void y;
  const out: [number, number][] = [];
  let cur = s0 + 0.05;
  for (const m of BAYS) for (const sd of [-1.2, 1.2]) {
    const a = m + sd - 1.2, e = m + sd + 1.2;
    if (e < s0 || a > s1) continue;
    if (a - cur > 0.1) out.push([cur, a]);
    cur = Math.max(cur, e);
  }
  if (s1 - 0.05 - cur > 0.1) out.push([cur, s1 - 0.05]);
  return out;
}

/** Nieuwendijk: glazed shop bays between white banded piers, banded brick storeys with two windows a bay above. */
function nieuwendijk(K: FrontKit, b: BuildingTools) {
  const TOP = 19.6;
  for (const c of NW_BAYS) {
    const L = chordLength(c), S = K.sec(c, 0, L, 0, TOP, 'brick'), f = K.faceFrame(S), m = L / 2;
    K.opening(S, m, 0.05, 5.3, 4.1, {back: 'glass', frame: 'bronze', cols: 3, depth: 0.3, edge: 0.1});      // curved glass shop bay (flat here)
    K.opening(S, m, 4.6, 5.0, 2.9, {back: 'glass', frame: 'gold', cols: 3, depth: 0.25, edge: 0.12});       // first-floor glazed bay
    slab(b, f, m, 4.15, 5.7, 0.45, 0.35, 'gold');
    slab(b, f, m, 7.5, 5.7, 0.4, 0.35, 'gold');
    for (const [y, h] of [[9.0, 2.3], [12.4, 2.3], [15.8, 2.3]] as const) for (const sd of [-1.3, 1.3]) K.opening(S, m + sd, y, 1.5, h, {cols: 2, frame: 'white', depth: 0.2});
    for (const y of [8.5, 11.8, 15.2]) for (const [a, e] of [[0.05, m - 2.1], [m - 0.5, m + 0.5], [m + 2.1, L - 0.05]] as const) ledgeStrip(b, f, (a + e) / 2, y, e - a, 0.3, 0.05, 'gold');
    K.coping(S, TOP, 0.3, 0.1, 'gold');
    // returns over the step back to the recessed piers on either side
    K.endCap(c, 0, 0, TOP, 'brick', -1, -0.2);
    K.endCap(c, L, 0, TOP, 'brick', 1, -0.2);
  }
  for (const c of [...NW_PIERS, ...NW_END]) {
    const L = chordLength(c), S = K.sec(c, 0, L, 0, TOP, 'brick'), f = K.faceFrame(S);
    for (let y = 0.4; y < TOP - 0.5; y += 0.6) ledgeStrip(b, f, L / 2, y, L - 0.1, 0.22, 0.05, 'gold');
    if (L > 4) for (const [y, h] of [[1.0, 3.2], [9.0, 2.3], [12.4, 2.3], [15.8, 2.3]] as const) for (const s of [L * 0.3, L * 0.7]) K.opening(S, s, y, 1.4, h, {cols: 2, frame: 'white', depth: 0.2});
    K.coping(S, TOP, 0.3, 0.1, 'gold');
  }
  K.endCap(NW_END[0], 0, 0, TOP, 'brick', -1, 0);
}

/**
 * The office storeys set back over both fronts (3DBAG pieces to 34-39 m): every exposed wall band starting 12 m or more up
 * carries a grid of white-framed windows (the panoramas show them over the Damrak and Nieuwendijk parapets), so the upper
 * massing never reads as blank brick.
 */
function upperStoreys(K: FrontKit) {
  for (const e of pieceFacadeBands(source.roofs as number[][][], {off: OFF, minBand: 3.0, minRun: 3.0}))
    for (const bd of e.bands) {
      if (bd.bottom < 12 || bd.s1 - bd.s0 < 3) continue;
      const S = K.sec(e.chord, bd.s0 + 0.05, bd.s1 - 0.05, bd.bottom, bd.top, 'brick'), len = S.s1 - S.s0;
      const n = Math.floor((len - 0.6) / 2.6);
      for (let y = bd.bottom + 0.9; y + 2.0 <= bd.top - 0.5; y += 3.6)
        for (let k = 0; k < n; k++) K.opening(S, S.s0 + len / 2 + (k - (n - 1) / 2) * 2.6, y, 1.4, 2.0, {cols: 2, frame: 'white', depth: 0.2});
      K.coping(S, bd.top, 0.25, 0.08, 'gold', S.s0, S.s1, 0.05);
      K.endCap(e.chord, S.s0, bd.bottom, bd.top, 'brick', -1, 0);
      K.endCap(e.chord, S.s1, bd.bottom, bd.top, 'brick', 1, 0);
    }
}

export function buildBrandBijCa(_w: number, _d: number, b: BuildingTools) {
  massing(b);
  const K = makeFrontKit(b, OFF);
  damrak(K, b);
  nieuwendijk(K, b);
  upperStoreys(K);
  K.flush();
}
export type {Sec};
