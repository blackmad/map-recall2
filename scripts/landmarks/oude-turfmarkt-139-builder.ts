import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, poly, slab} from './nearbar-kit';
import {neckGable} from './neck-gable';
import {roofPrism} from './roof-prism-kit';
import {capRoofsUnderFronts, clipHalf, frontCoords, type FrontZone, type Ring3} from '../../src/canalRecall/landmarks/frontZones';
import {chordLength, frameAt, makeFrontKit, type Chord, type Col, type FrontKit, type Sec} from './street-front-kit';
import source from './oude-turfmarkt-139-footprints.json';

/**
 * The Oude Turfmarkt range of the Binnengasthuis terrain, BAG pand 0363100012168172 (bouwjaar 1643, CC0): one cadastral
 * building from the Turfdraagsterpad to the Grimburgwal side, addresses Oude Turfmarkt 127, 129, 139-149 and
 * Binnengasthuisstraat 46 (BAG verblijfsobjecten). The lane brief called it the "Oude Turfmarkt 139 range"; the BAG and the
 * panoramas show it carries, north to south along the Rokin water:
 *  - the former De Nederlandsche Bank head office (rijksmonument 5780, W.A. Froger 1865-69), the Allard Pierson museum:
 *    sandstone front with end pavilions, side wings of four axes and the pedimented centre risaliet;
 *  - three 1642 Vingboons houses joined under one straight cornice (rijksmonument 5781), the University of Amsterdam front
 *    with its name on the frieze and the row of arched cellar lights;
 *  - the former Gesticht St. Bernardus (rijksmonument 5782, P.F. Laarman 1882-84), banded red and white brick with the
 *    1732 "T GASTHVISHOF" gate at its north end and the Bijzondere Collecties carriage entrance at its south end;
 *  - five canal houses: a warehouse under a bell gable (5783), a neck gable (5784), Vingboons' pilaster neck gable (5785),
 *    the 1884 neo-renaissance banded step gable (5786) and the house under a straight cornice with consoles (5787).
 * The installed `allard-pierson` model stands on the next pand north (0363100012165686, Oude Turfmarkt 125 and the
 * Turfdraagsterpad wing); it covers none of this ground.
 *
 * Native frame of oude-turfmarkt-139-footprints.json (x east, z south, y up from the 0.39 m NAP street). Rear and courtyard
 * massing: a closed prism under every 3DBAG LoD2.2 roof piece (CC BY 4.0), capped under the measured fronts. Street fronts:
 * walls 0.3 m outside the BAG chords with cut openings, measured on the rectified Gemeente Amsterdam panorama crops
 * (CC BY 4.0, artifacts/landmark-briefs/oude-turfmarkt-139/, 50 px per metre) listed per wall in the inventory.
 */
type P2 = [number, number];
const OFF = 0.3;
const ch = (a: P2, b: P2): Chord => ({a, b});
// Oude Turfmarkt, north to south (faces WSW). The DNB pavilions stand 0.6 m and the centre 1 m forward of the wings.
const PAV_N = ch([-36.273, -31.254], [-33.442, -24.068]);
const WING_N = ch([-32.861, -23.858], [-28.303, -12.553]);
const CENTRE = ch([-29.182, -12.076], [-23.525, -1.202]);
const WING_S = ch([-22.628, -1.669], [-16.183, 8.726]);
const PAV_S = ch([-16.356, 9.311], [-12.303, 15.835]);
const UVA = ch([-11.699, 15.942], [0.636, 33.777]);
const BERN = ch([0.635, 33.86], [17.095, 55.958]);
const HOUSES = ch([17.455, 56.65], [36.598, 81.397]);
// Binnengasthuisstraat side of the courtyard wing (faces E) and the dark brick north end on the Turfdraagsterpad side.
const COURT = ch([45.964, 1.979], [46.742, -31.486]);
const NORTH = ch([-7.106, -36.005], [-21.679, -34.582]);
const NORTH2 = ch([-21.679, -34.582], [-27.702, -36.088]);
const TEAL = ch([55.775, 59.34], [47.233, 48.071]);

// ---- massing: 3DBAG roof pieces, capped under the measured fronts --------------------------------------------------------
const ZONES: FrontZone[] = [
  {chord: PAV_N, s0: 0, s1: chordLength(PAV_N), depth: 3.0, cap: 18.2},
  {chord: WING_N, s0: 0, s1: chordLength(WING_N), depth: 3.0, cap: 18.2},
  {chord: CENTRE, s0: 0, s1: chordLength(CENTRE), depth: 3.0, cap: 18.2},
  {chord: WING_S, s0: 0, s1: chordLength(WING_S), depth: 3.0, cap: 18.2},
  {chord: PAV_S, s0: 0, s1: chordLength(PAV_S), depth: 3.0, cap: 18.2},
  {chord: UVA, s0: 0, s1: chordLength(UVA), depth: 9.0, cap: 17.6},
  {chord: BERN, s0: 0, s1: chordLength(BERN), depth: 6.0, cap: 13.8},
  // no zone over the five houses: their gables and the corniced front stand in front of the 3DBAG roofs, which rise behind
  // them as the photos show (a zone cut through these concave pieces left 3DBAG walls overlapping by 2 cm, a z-fight)
];
/**
 * Cuts every roof ring back to `d` behind each measured front over that front's length, so a 3DBAG wall that bulges up to
 * 0.28 m outside the BAG chord (the St. Bernardus front) never stands within centimetres of the front wall or an opening's
 * back. Outside a front's length the ring is kept as it is.
 */
function trimBehindFronts(rings: Ring3[], chords: Chord[], d: number): Ring3[] {
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
/** The massing rings after the trims and caps (exported for the geometry check). */
export const massingRings = (lifted: Ring3[]) => capRoofsUnderFronts(trimBehindFronts(lifted, [PAV_N, WING_N, CENTRE, WING_S, PAV_S, UVA, BERN], 0.08), ZONES);
export const liftedRoofs = () => source.roofs.filter(r => r.length === 1).map(r => r[0] as Ring3).filter(r => Math.max(...r.map(p => p[1])) > 1.0).map(r => r.map(p => [p[0], Math.max(0.1, p[1]), p[2]] as [number, number, number]));
function massing(b: BuildingTools) {
  const outer = source.roofs.filter(r => r.length === 1).map(r => r[0] as Ring3);
  // holed pieces: the 17.4 m roof behind St. Bernardus; the sloped -1.95..6.0 m service-ramp piece by the Binnengasthuisstraat
  // entrance is ground, not roof, and is dropped
  const holed = source.roofs.filter(r => r.length > 1 && Math.min(...r[0].map(p => p[1])) > 0.5);
  const wallFor = (r: Ring3): string => {
    const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[2] / r.length], [0, 0]);
    if (c[1] < 16 && c[0] < 0) return 'stone';                   // the DNB block
    if (c[0] > 30 && c[1] < 10) return 'concrete';               // white courtyard housing
    return frontCoords(BERN, c[0], c[1]).s > -2 && frontCoords(BERN, c[0], c[1]).s < 28 && frontCoords(BERN, c[0], c[1]).o > -16 ? 'red' : 'brick';
  };
  const flat = (r: Ring3) => Math.max(...r.map(p => p[1])) - Math.min(...r.map(p => p[1])) < 0.3;
  // 3DBAG pieces at or under the street (the sunken service yard, -1.95 m) are ground, not roof: drop them; lift any other
  // vertex under 0.1 m so no prism reaches below the street datum
  const lifted = outer.filter(r => Math.max(...r.map(p => p[1])) > 1.0).map(r => r.map(p => [p[0], Math.max(0.1, p[1]), p[2]] as [number, number, number]));
  for (const r of massingRings(lifted)) roofPrism(b, [r], wallFor(r), flat(r) ? 'concrete' : 'slate');
  for (const r of holed) roofPrism(b, r as number[][][], 'brick', 'concrete');
}

// ---- the DNB front (Allard Pierson) ---------------------------------------------------------------------------------------
/** Rusticated base, string course, cornice and attic band shared by every DNB section. */
function dnbSection(K: FrontKit, b: BuildingTools, c: Chord, top: number, s0 = 0, s1 = chordLength(c)): Sec {
  const S = K.sec(c, s0, s1, 0, top, 'stone');
  const f = K.faceFrame(S);
  const mid = (s0 + s1) / 2, w = s1 - s0;
  for (const y of [0.55, 2.6]) ledgeStrip(b, f, mid, y, w - 0.02, 0.06, 0.06, 'stone');           // rustication joints clear of the cellar lights
  slab(b, f, mid, 3.1, w, 0.3, 0.14, 'stone');                                                       // string course
  slab(b, f, mid, 8.2, w, 0.5, 0.12, 'stone');                                                       // band under the upper storey
  slab(b, f, mid, 13.6, w, 0.3, 0.1, 'stone');                                                       // architrave
  return S;
}
function dnbCornice(K: FrontKit, S: Sec) {
  K.coping(S, 17.3, 0.35, 0.35, 'stone');
  K.coping(S, 17.65, 0.55, 0.7, 'stone');
}
function wing(K: FrontKit, b: BuildingTools, c: Chord) {
  const L = chordLength(c), S = dnbSection(K, b, c, 17.3), f = K.faceFrame(S);
  const AX = [0.125, 0.375, 0.625, 0.875].map(k => k * L);
  for (const s of AX) {
    for (const sd of [-0.45, 0.45]) K.opening(S, s + sd, 1.25, 0.62, 1.05, {frame: 'dark', back: 'dark', cols: 3, depth: 0.14});   // barred cellar lights
    K.opening(S, s, 3.7, 1.5, 3.3, {frame: 'bronze', cols: 2, rows: 3, depth: 0.2, barW: 0.1});
    slab(b, f, s, 7.05, 2.0, 0.28, 0.22, 'stone');                                 // window cornice on consoles
    for (const sd of [-0.9, 0.9]) slab(b, f, s + sd, 6.6, 0.18, 0.45, 0.18, 'stone');
    K.opening(S, s, 9.4, 1.5, 3.2, {frame: 'bronze', cols: 2, rows: 3, depth: 0.2, barW: 0.1});
    slab(b, f, s, 12.65, 2.0, 0.32, 0.2, 'stone');                                 // hood
    for (const sd of [-0.95, 0.95]) slab(b, f, s + sd, 9.3, 0.22, 3.4, 0.08, 'stone');   // architrave strips beside the window
    K.opening(S, s, 14.45, 1.6, 0.55, {frame: 'bronze', cols: 3, depth: 0.12, edge: 0.05});   // attic lights in the frieze
  }
  dnbCornice(K, S);
  slopeBehind(K, c);
  return S;
}
function pavilion(K: FrontKit, b: BuildingTools, c: Chord, door: boolean) {
  const L = chordLength(c), mid = L / 2;
  const low = K.sec(c, 0, L, 0, 7.6, 'gold');                                    // the museum's painted lower storeys
  const up = K.sec(c, 0, L, 7.6, 17.3, 'stone');
  const f = K.faceFrame(low);
  if (door) {
    K.opening(low, mid, 0.45, 1.7, 3.1, {back: 'green', frame: 'gold', rows: 4, cols: 2, depth: 0.22});
    for (const sd of [-0.5, 0.5]) K.opening(low, mid + sd, 4.3, 0.85, 1.0, {frame: 'bronze', depth: 0.14});
    slab(b, f, mid, 3.75, 3.4, 0.25, 0.25, 'gold');
  } else {
    for (const s of [mid - 1.6, mid + 1.6]) K.opening(low, s, 1.3, 1.3, 2.4, {frame: 'bronze', cols: 2, rows: 2, depth: 0.18});
    K.opening(low, mid, 4.2, 1.4, 2.4, {frame: 'bronze', cols: 2, rows: 2, depth: 0.18});
  }
  if (door) slab(b, f, mid, 0, 2.6, 0.4, 0.9, 'stone');                              // step to the museum door
  const fu = K.faceFrame(up);
  slab(b, fu, mid, 7.6, L, 0.5, 0.14, 'stone');
  for (const s of [0.95, L - 0.95]) slab(b, fu, s, 8.6, 1.3, 4.6, 0.1, 'stone');   // the blind panels either side
  K.opening(up, mid, 9.5, 1.6, 3.5, {frame: 'bronze', cols: 2, rows: 3, depth: 0.2, barW: 0.1});
  for (const sd of [-1, 1]) slab(b, fu, mid + sd * 1.05, 9.3, 0.3, 4.1, 0.2, 'stone');   // pilasters of the aedicule
  // pediment hood on the aedicule, balusters under the window
  poly(b, fu, mid, 13.4, [[-1.35, 0], [1.35, 0], [0, 0.85]], 0.3, 'stone');
  for (let k = 0; k < 5; k++) slab(b, fu, mid - 0.6 + k * 0.3, 8.35, 0.12, 0.85, 0.16, 'stone');
  slab(b, fu, mid, 13.6, L, 0.3, 0.1, 'stone');
  dnbCornice(K, up);
  slopeBehind(K, c);
}
/** Slate slope behind a DNB cornice up to the 3DBAG roof 3 m back (the roof the photos show over the cornice). */
function slopeBehind(K: FrontKit, c: Chord) {
  K.along(c, 0.02, chordLength(c) - 0.02, [[OFF + 0.2, 18.2], [-3.0, 19.6], [-3.0, 18.1], [OFF + 0.2, 18.1]], 'slate');
}
function centre(K: FrontKit, b: BuildingTools) {
  const L = chordLength(CENTRE), S = dnbSection(K, b, CENTRE, 17.3), f = K.faceFrame(S), mid = L / 2;
  const AX = [mid - 2.75, mid, mid + 2.75];
  for (const s of AX) {
    K.opening(S, s, 0.9, 0.8, 1.2, {frame: 'dark', back: 'dark', cols: 3, depth: 0.14});
    K.opening(S, s, 3.8, 1.6, 3.5, {frame: 'bronze', cols: 2, rows: 3, depth: 0.2, barW: 0.1});
    slab(b, f, s, 7.4, 2.1, 0.3, 0.22, 'stone');
    K.opening(S, s, 9.5, 1.6, 3.7, {frame: 'bronze', cols: 2, rows: 3, depth: 0.2, barW: 0.1});
    poly(b, f, s, 13.4, [[-1.1, 0], [1.1, 0], [0, 0.6]], 0.25, 'stone');                 // small pediments over the upper windows
    for (let k = 0; k < 5; k++) slab(b, f, s - 0.6 + k * 0.3, 8.45, 0.12, 0.75, 0.2, 'stone');   // balustrade
    slab(b, f, s, 9.2, 1.9, 0.12, 0.24, 'stone');
  }
  // fluted pilasters of the upper storey: pairs at each end, single ones between the axes
  for (const s of [0.45, 1.35, mid - 1.38, mid + 1.38, L - 1.35, L - 0.45]) {
    slab(b, f, s, 9.0, 0.5, 4.6, 0.22, 'stone');
    for (const d of [-0.12, 0, 0.12]) ledgeStrip(b, f, s + d, 9.15, 0.04, 4.3, 0.26, 'stone');
  }
  dnbCornice(K, S);
  slopeBehind(K, CENTRE);
  // pediment over the risaliet: tympanum from the cornice, raking cornice, relief group, acroteria
  const fp = K.faceFrame(S, -0.2);
  poly(b, fp, mid, 18.2, [[-L / 2 + 0.3, 0], [L / 2 - 0.3, 0], [0, 2.45]], 1.2, 'stone');
  poly(b, K.faceFrame(S, 0.75), mid, 18.2, [[-L / 2 + 0.1, 0], [-L / 2 + 0.6, 0], [0, 2.3], [L / 2 - 0.6, 0], [L / 2 - 0.1, 0], [0, 2.75]], 0.35, 'stone');
  // relief: seated and reclining figures as low blocks inside the field (simplified; sculpture track for the figures)
  const fr = K.faceFrame(S, 0.95);
  for (const [x, w, h] of [[0, 0.9, 1.5], [-1.3, 0.8, 1.05], [1.3, 0.8, 1.05], [-2.7, 1.2, 0.55], [2.7, 1.2, 0.55]] as const) slab(b, fr, mid + x, 18.3, w, h, 0.17, 'stone');
  // acroteria: figure group on the apex, urns on the corners (blocks; sculpture track)
  slab(b, fp, mid, 20.6, 0.9, 1.1, 0.9, 'stone');
  for (const sd of [-1, 1]) slab(b, fp, mid + sd * (L / 2 - 0.7), 18.2, 0.6, 0.9, 0.6, 'stone');
}
function dnb(K: FrontKit, b: BuildingTools) {
  pavilion(K, b, PAV_N, true);
  wing(K, b, WING_N);
  centre(K, b);
  wing(K, b, WING_S);
  pavilion(K, b, PAV_S, false);
  // returns where the pavilions and the centre stand forward of the wings
  K.endCap(PAV_N, chordLength(PAV_N), 0, 18.2, 'stone', 1, -0.4);
  K.endCap(CENTRE, 0, 0, 18.2, 'stone', -1, -0.8);
  K.endCap(CENTRE, chordLength(CENTRE), 0, 18.2, 'stone', 1, -0.8);
  K.endCap(PAV_S, 0, 0, 18.2, 'stone', -1, -0.4);
  K.endCap(PAV_N, 0, 0, 18.2, 'stone', -1, 0);
}

// ---- three Vingboons houses under one cornice: the University of Amsterdam front -------------------------------------------
function uva(K: FrontKit, b: BuildingTools) {
  const L = chordLength(UVA), P = K.sec(UVA, 0, L, 0, 2.15, 'gold'), S = K.sec(UVA, 0, L, 2.15, 15.3, 'brick'), f = K.faceFrame(S);
  const AX = [1.5, 3.7, 5.86, 8.76, 10.96, 13.16, 16.1, 18.3, 20.5].map(s => s * L / 21.7);
  for (const s of AX) {
    for (const sd of [-0.4, 0.4]) K.opening(P, s + sd, 0.75, 0.42, 0.95, {rise: 0.21, frame: 'white', back: 'dark', depth: 0.14, edge: 0.05});
    K.opening(S, s, 2.3, 1.3, 4.0, {cols: 2, rows: 4, frame: 'white', depth: 0.16});
    K.opening(S, s, 7.0, 1.3, 2.8, {cols: 2, rows: 3, frame: 'white', depth: 0.16});
    K.opening(S, s, 10.7, 1.3, 1.95, {cols: 2, rows: 2, frame: 'white', depth: 0.16});
    K.opening(S, s, 13.0, 1.3, 1.9, {cols: 2, rows: 2, frame: 'white', depth: 0.16});
    for (const y of [6.5, 10.2, 12.75]) slab(b, f, s, y, 1.5, 0.12, 0.08, 'gold');   // sills
  }
  for (const s of [7.3, 14.65].map(v => v * L / 21.7)) slab(b, f, s, 2.1, 0.22, 13.2, 0.06, 'brick');   // joints of the three houses
  // white entablature with the frieze and the straight cornice (the UNIVERSITEIT VAN AMSTERDAM letters are skipped: too small)
  K.coping(S, 15.3, 1.5, 0.12, 'gold', 0.05, L);
  K.coping(S, 16.8, 0.8, 0.5, 'gold', 0.05, L);
  K.endCap(UVA, 0, 0, 17.6, 'brick', -1, 0);
  K.along(UVA, 0.05, L - 0.05, [[OFF + 0.4, 17.6], [-9.0, 19.8], [-9.0, 17.5], [OFF + 0.4, 17.5]], 'slate');   // the slate slope over the cornice
}

// ---- St. Bernardus (Bijzondere Collecties) ------------------------------------------------------------------------------
function bernardus(K: FrontKit, b: BuildingTools) {
  const L = chordLength(BERN);
  // the T GASTHVISHOF gate bay: white stone portal, arched door, window with pediment over it
  const G = K.sec(BERN, 0, 3.2, 0, 13.8, 'red'), fg = K.faceFrame(G);
  K.opening(G, 1.6, 0.05, 1.5, 3.0, {rise: 0.75, back: 'dark', frame: 'bronze', depth: 0.3, rows: 3});
  for (const sd of [-1, 1]) slab(b, fg, 1.6 + sd * 1.05, 0, 0.55, 3.9, 0.12, 'gold');   // portal jambs
  K.archHead(G, 1.6, 2.3, 1.5, 0.75, 0.3, 0.1, 'gold');
  poly(b, fg, 1.6, 3.9, [[-1.35, 0], [1.35, 0], [1.35, 1.4], [0, 1.9], [-1.35, 1.4]], 0.12, 'gold');   // tablet with the 1732 inscription
  K.opening(G, 1.6, 6.0, 1.1, 1.8, {cols: 2, rows: 2, frame: 'white'});
  poly(b, fg, 1.6, 7.9, [[-0.8, 0], [0.8, 0], [0, 0.5]], 0.15, 'gold');
  K.opening(G, 1.6, 9.6, 1.1, 2.3, {cols: 2, rows: 2, frame: 'white'});
  // the main front: ten axes
  const S = K.sec(BERN, 3.2, L, 0, 13.8, 'red'), f = K.faceFrame(S);
  const AX = Array.from({length: 10}, (_, k) => 4.5 + 2.4 * k);
  const DOOR = 18.9, GATE = 24.9;
  for (const s of AX) {
    if (Math.abs(s - DOOR) < 0.1) {
      K.opening(S, s, 0.05, 1.7, 3.9, {rise: 0.85, back: 'dark', frame: 'bronze', depth: 0.3, bars: [3.0]});
      K.archHead(S, s, 3.05, 1.7, 0.85, 0.3, 0.08, 'gold');
    } else if (Math.abs(s - GATE) > 1.6) {
      K.opening(S, s, 1.3, 1.15, 3.1, {cols: 2, rows: 3, frame: 'white', rise: 0.2});
    }
    K.opening(S, s, 6.0, 1.15, 2.5, {cols: 2, rows: 3, frame: 'white', rise: 0.25});
    K.archHead(S, s, 8.25, 1.15, 0.25, 0.32, 0.07, 'gold');                           // alternating voussoirs read as one pale ring
    for (const sd of [-0.31, 0.31]) K.opening(S, s + sd, 10.0, 0.46, 2.2, {rise: 0.23, frame: 'white', depth: 0.14, edge: 0.05});
    K.blindArch(S, s, 10.0, 1.45, 2.55, 0.16, 0.06, 'gold');
    if (s < AX[AX.length - 1]) poly(b, f, s + 1.2, 9.3, [[0, 0], [0.25, 0.3], [0, 0.6], [-0.25, 0.3]], 0.06, 'bronze');   // iron cross anchors
  }
  // Bijzondere Collecties carriage entrance with its white surround
  K.opening(S, GATE, 0.05, 3.3, 4.2, {back: 'dark', frame: 'white', depth: 0.6, edge: 0.12});
  slab(b, f, GATE, 4.35, 3.9, 0.45, 0.1, 'gold');
  // white speklagen on the brick piers between the openings
  for (let y = 0.65; y < 13.2; y += 0.6) for (const [a, c] of stripsAround(S, 3.2, L, y, 0.13)) ledgeStrip(b, f, (a + c) / 2, y, c - a, 0.13, 0.05, 'gold');
  for (const y of [5.1, 9.5]) slab(b, f, (3.2 + L) / 2, y, L - 3.2, 0.3, 0.1, 'gold');
  K.coping(G, 13.8, 0.35, 0.3, 'gold');
  K.coping(S, 13.8, 0.35, 0.3, 'gold');
  K.along(BERN, 0.05, L - 0.05, [[OFF + 0.2, 14.05], [-6.0, 17.1], [-6.0, 13.75], [OFF + 0.2, 13.75]], 'slate');
  K.endCap(BERN, L, 0, 13.8, 'red', 1, -0.6);
}

/** Brick runs of a band at height y..y+h between the section's cut openings (each opening widened by `gap`). */
function stripsAround(S: Sec, from: number, to: number, y: number, h: number, gap = 0.1): [number, number][] {
  const block = S.F.holes.filter(o => o.y0 - 0.05 < y + h && y < o.y1 + 0.3).map(o => [S.s0 + o.t0 - gap, S.s0 + o.t1 + gap] as [number, number]).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = from + 0.02;
  for (const [a, c] of block) { if (a > cur + 0.15) out.push([cur, a]); cur = Math.max(cur, c); }
  if (to - 0.02 > cur + 0.15) out.push([cur, to - 0.02]);
  return out;
}

// ---- five canal houses -----------------------------------------------------------------------------------------------------
type House = {s0: number; s1: number; wall: Col};
function houses(K: FrontKit, b: BuildingTools) {
  const fH = frameAt(HOUSES, 0, OFF);
  // 1. warehouse under a bell gable (5783): white ground storey with the museum passage, loading doors on the centre axis
  {
    const h: House = {s0: 0, s1: 5.6, wall: 'ochre'}, m = (h.s0 + h.s1) / 2;
    const low = K.sec(HOUSES, h.s0, h.s1, 0, 3.7, 'gold');
    K.opening(low, m - 0.6, 0.05, 3.4, 3.1, {back: 'dark', frame: 'white', depth: 0.6, edge: 0.1});
    K.opening(low, h.s1 - 0.75, 0.05, 0.8, 2.3, {back: 'dark', frame: 'white', depth: 0.2});
    const S = K.sec(HOUSES, h.s0, h.s1, 3.7, 15.0, h.wall);
    for (const [y, hh] of [[3.85, 2.1], [7.6, 1.45], [10.7, 1.25], [13.4, 1.1]] as const) {
      for (const s of [h.s0 + 1.0, h.s1 - 1.0]) K.opening(S, s, y, 0.8, hh, {cols: 2, rows: 3, frame: 'white'});
      K.opening(S, m, y, 1.5, hh + (y < 4 ? 0 : 0.35), {back: y < 4 ? 'glass' : 'green', frame: 'green', cols: 2, rows: y < 4 ? 3 : 1});
      slab(b, fH, m, y + hh + (y < 4 ? 0 : 0.35) + 0.05, 1.8, 0.3, 0.12, 'gold');
    }
    slab(b, fH, m, 3.55, h.s1 - h.s0, 0.25, 0.1, 'gold');
    bellGable(K, b, h, 15.0, 17.6, h.wall);
  }
  // 2. neck gable, dark brick (5784)
  {
    const h: House = {s0: 5.6, s1: 11.9, wall: 'greyBrick'}, AX = [6.65, 8.75, 10.85];
    const S = K.sec(HOUSES, h.s0, h.s1, 0, 14.4, h.wall);
    for (const s of AX) K.opening(S, s, 0.25, 1.0, 0.85, {back: 'dark', frame: 'white', depth: 0.14});
    K.opening(S, AX[0], 1.7, 1.0, 3.5, {back: 'dark', frame: 'white', bars: [2.55], depth: 0.22});
    for (const s of AX.slice(1)) K.opening(S, s, 1.9, 1.2, 3.4, {cols: 2, rows: 4, frame: 'white', bars: [2.2]});
    for (const s of AX) {
      K.opening(S, s, 6.2, 1.2, 2.4, {cols: 2, rows: 4, frame: 'white'});
      K.opening(S, s, 9.5, 1.2, 1.9, {cols: 2, rows: 3, frame: 'white'});
      K.opening(S, s, 12.5, 1.2, 1.4, {cols: 2, rows: 2, frame: 'white'});
    }
    slab(b, fH, 8.75, 0, 3.6, 1.6, 1.2, 'stone');                                   // stoep with the stair
    neckGable(b, fH, {x0: h.s0 + 0.05, x1: h.s1 - 0.05, axis: 8.75, neckHalf: 1.3, shoulderY: 14.4, clawTopY: 15.5, corniceY: 16.9, corniceH: 0.28,
      corniceHalf: 1.55, apexY: 17.7, thick: 0.45, crown: 'segment', footScroll: false}, {wall: h.wall, trim: 'gold', neck: h.wall});
    slab(b, fH, 8.75, 14.7, 1.15, 1.1, 0.06, 'glass');
    slab(b, fH, (h.s0 + h.s1) / 2, 14.15, h.s1 - h.s0 - 0.1, 0.25, 0.14, 'gold');
  }
  // 3. Vingboons' pilaster neck gable (5785): white cornices on every storey, the ornate white top
  {
    const h: House = {s0: 11.9, s1: 18.3, wall: 'greyBrick'}, AX = [13.0, 15.1, 17.2];
    const S = K.sec(HOUSES, h.s0, h.s1, 0, 13.6, h.wall);
    K.opening(S, AX[2], 1.4, 1.0, 3.1, {back: 'dark', frame: 'white', depth: 0.22});
    for (const s of AX.slice(0, 2)) K.opening(S, s, 1.4, 1.25, 3.2, {cols: 2, rows: 4, frame: 'white'});
    for (const s of AX) {
      K.opening(S, s, 6.2, 1.25, 2.2, {cols: 2, rows: 3, frame: 'white'});
      K.opening(S, s, 9.4, 1.25, 2.0, {cols: 2, rows: 3, frame: 'white'});
    }
    for (const y of [5.2, 8.6, 11.7]) slab(b, fH, (h.s0 + h.s1) / 2, y, h.s1 - h.s0 - 0.1, 0.35, 0.18, 'gold');
    for (const s of [h.s0 + 0.3, 14.05, 16.15, h.s1 - 0.3]) slab(b, fH, s, 5.55, 0.35, 6.1, 0.12, 'gold');   // pilasters
    slab(b, fH, 15.1, 0, 4.5, 1.4, 1.3, 'stone');
    neckGable(b, fH, {x0: h.s0 + 0.05, x1: h.s1 - 0.05, axis: 15.1, neckHalf: 1.7, shoulderY: 13.6, clawTopY: 14.9, corniceY: 16.9, corniceH: 0.35,
      corniceHalf: 2.0, apexY: 17.9, thick: 0.45, crown: 'segment', footScroll: false}, {wall: h.wall, trim: 'gold', neck: h.wall});
    for (const s of [14.4, 15.8]) slab(b, fH, s, 14.1, 0.8, 1.3, 0.06, 'glass');
    slab(b, fH, 15.1, 12.2, 4.8, 1.3, 0.1, 'gold');                                // carved frieze under the neck
  }
  // 4. the 1884 neo-renaissance front (5786): red brick with white bands, sunburst fans, stepped gable
  {
    const h: House = {s0: 18.3, s1: 25.6, wall: 'red'}, AX = [19.55, 21.95, 24.35];
    const S = K.sec(HOUSES, h.s0, h.s1, 0, 14.2, h.wall);
    K.opening(S, AX[0], 0.6, 1.0, 2.6, {back: 'dark', frame: 'white', depth: 0.22});
    K.opening(S, AX[0], 3.35, 1.0, 0.65, {frame: 'white'});
    for (const s of AX.slice(1)) K.opening(S, s, 1.1, 1.15, 3.2, {cols: 1, rows: 2, frame: 'white'});
    for (const s of AX) {
      K.opening(S, s, 5.6, 1.15, 2.2, {cols: 2, rows: 2, frame: 'white'});
      fan(b, fH, s, 7.9, 1.25);
      K.opening(S, s, 9.1, 1.15, 2.0, {cols: 2, rows: 2, frame: 'white'});
      fan(b, fH, s, 11.35, 1.25);
    }
    for (const y of [4.6, 8.9]) slab(b, fH, (h.s0 + h.s1) / 2, y, h.s1 - h.s0 - 0.1, 0.3, 0.14, 'gold');
    for (let y = 0.7; y < 14; y += 0.75) for (const [a, c] of stripsAround(S, h.s0, h.s1, y, 0.14, 0.12)) ledgeStrip(b, fH, (a + c) / 2, y, c - a, 0.14, 0.05, 'gold');
    stepGable(K, b, h, 14.2, 19.6, AX);
  }
  // 5. the house under a straight cornice with consoles (5787): balconettes on the first and second floors
  {
    const L = chordLength(HOUSES), h: House = {s0: 25.6, s1: L, wall: 'pink'}, AX = [26.75, 28.45, 30.15];
    const S = K.sec(HOUSES, h.s0, h.s1, 0, 13.1, h.wall);
    K.opening(S, AX[2], 0.6, 1.1, 2.4, {back: 'dark', frame: 'white', depth: 0.25});
    K.opening(S, AX[2], 3.05, 1.1, 0.6, {frame: 'white', cols: 2});
    for (const s of AX.slice(0, 2)) K.opening(S, s, 0.6, 1.15, 2.6, {cols: 2, rows: 3, frame: 'white'});
    for (const s of AX) {
      K.opening(S, s, 4.0, 1.15, 2.6, {cols: 2, rows: 4, frame: 'white'});
      K.opening(S, s, 7.5, 1.15, 1.9, {cols: 2, rows: 3, frame: 'white'});
      K.opening(S, s, 10.3, 1.15, 1.9, {cols: 2, rows: 3, frame: 'white'});
      for (const y of [4.0, 7.5]) { slab(b, fH, s, y - 0.12, 1.45, 0.1, 0.4, 'gold'); slab(b, fH, s, y, 1.35, 0.6, 0.06, 'bronze', 0.34); }
    }
    slab(b, fH, (h.s0 + h.s1) / 2, 0, h.s1 - h.s0, 0.6, 0.12, 'stone');
    K.coping(S, 13.1, 1.6, 0.15, 'gold', h.s0, h.s1 - 0.06);
    K.coping(S, 14.7, 0.5, 0.55, 'gold', h.s0, h.s1 - 0.06);
    for (const s of [h.s0 + 0.3, 27.6, 29.3, h.s1 - 0.3]) slab(b, fH, s, 13.25, 0.3, 1.25, 0.45, 'gold');   // consoles
    K.endCap(HOUSES, L, 0, 15.2, h.wall, 1, 0);
  }
  K.endCap(HOUSES, 0, 0, 15.0, 'ochre', -1, -0.6);
}
/** White sunburst fan over a window (the 1884 front's 'zonnewaaiers'): rays as thin wedges proud of the brick. */
function fan(b: BuildingTools, f: ReturnType<typeof frameAt>, s: number, y: number, w: number) {
  const r = w / 2;
  for (let k = 0; k < 7; k++) {
    const a0 = Math.PI * (k / 7) + 0.06, a1 = Math.PI * ((k + 1) / 7) - 0.06;
    poly(b, f, s, y, [[0.12 * Math.cos(a0), 0.12 * Math.sin(a0)], [r * Math.cos(a0), r * Math.sin(a0)], [r * Math.cos(a1), r * Math.sin(a1)], [0.12 * Math.cos(a1), 0.12 * Math.sin(a1)]], 0.06, 'gold');
  }
}
/** Bell gable over a warehouse: brick top with a white rim and an arched crown, symmetric about the house axis. */
function bellGable(K: FrontKit, b: BuildingTools, h: House, shoulder: number, apex: number, wall: Col) {
  const f = frameAt(HOUSES, 0, OFF), m = (h.s0 + h.s1) / 2, half = (h.s1 - h.s0) / 2 - 0.05, top = apex - shoulder;
  const pts: [number, number][] = [];
  for (let k = 0; k <= 12; k++) { const u = k / 12, x = -half + 2 * half * u; pts.push([x, top * (0.35 + 0.65 * Math.sin(Math.PI * u)) * (Math.abs(x) < half * 0.6 ? 1 : 1 - (Math.abs(x) - half * 0.6) / (half * 0.4) * 0.65)]); }
  poly(b, f, m, shoulder, [[-half, 0], ...pts.map(([x, y]) => [x, Math.max(0.05, y)] as [number, number]), [half, 0]], 0.45, wall, -0.45);
  poly(b, f, m, apex - 0.6, [[-0.9, 0], [0.9, 0], [0.7, 0.4], [0, 0.65], [-0.7, 0.4]], 0.12, 'gold');
  for (const sd of [-1, 1]) poly(b, f, m + sd * (half - 0.4), shoulder, [[-0.4, 0], [0.4, 0], [0, 0.6]], 0.12, 'gold');
  slab(b, f, m, shoulder + 0.55, 0.8, 0.9, 0.06, 'glass');
  slab(b, f, m, shoulder - 0.25, h.s1 - h.s0 - 0.1, 0.25, 0.14, 'gold');
}
/** Stepped gable, symmetric: three steps each side with white copings, white scrolls in the angles. */
function stepGable(K: FrontKit, b: BuildingTools, h: House, shoulder: number, apex: number, AX: number[]) {
  const f = frameAt(HOUSES, 0, OFF), m = (h.s0 + h.s1) / 2, half = (h.s1 - h.s0) / 2 - 0.05;
  const steps = [half, half * 0.72, half * 0.48, half * 0.26], rise = (apex - shoulder) / steps.length;
  const outline: [number, number][] = [[-half, 0]];
  steps.forEach((w, i) => { outline.push([-w, (i + 1) * rise]); if (i + 1 < steps.length) outline.push([-steps[i + 1], (i + 1) * rise]); });
  const right = outline.slice(1).reverse().map(([x, y]) => [-x, y] as [number, number]);
  poly(b, f, m, shoulder, [...outline, ...right, [half, 0]], 0.45, 'red', -0.45);
  steps.forEach((w, i) => {
    const y = shoulder + (i + 1) * rise - 0.02;
    if (i + 1 < steps.length) for (const sd of [-1, 1]) slab(b, f, m + sd * (w + steps[i + 1]) / 2, y, w - steps[i + 1], 0.16, 0.1, 'gold');
    else slab(b, f, m, y, 2 * w, 0.16, 0.1, 'gold');
  });
  for (const sd of [-1, 1]) poly(b, f, m + sd * (steps[1] + 0.1), shoulder, [[-0.35, 0], [0.35, 0], [0, 0.9]], 0.1, 'gold');
  for (const s of [AX[1] - 0.55, AX[1] + 0.55]) slab(b, f, s, shoulder + 0.6, 0.7, 1.3, 0.06, 'glass');
  slab(b, f, AX[1], shoulder + 2.5, 0.8, 1.0, 0.06, 'glass');
  slab(b, f, m, shoulder - 0.3, h.s1 - h.s0 - 0.1, 0.3, 0.14, 'gold');
}

// ---- secondary walls ----------------------------------------------------------------------------------------------------
function court(K: FrontKit, b: BuildingTools) {
  // white 1980s housing on the Binnengasthuisstraat side of the courtyard wing (w03-91): four storeys of timber windows,
  // round balconies on its south part, the glass-block stair tower
  const L = chordLength(COURT), S = K.sec(COURT, 0, L, 0, 10.0, 'concrete'), f = K.faceFrame(S);
  for (let k = 0; k < 11; k++) {
    const s = 1.6 + k * 2.9;
    if (Math.abs(s - 21.9) < 1) continue;
    for (const [y, hh] of [[0.9, 1.5], [3.4, 1.4], [5.9, 1.4], [8.3, 1.2]] as const) K.opening(S, s, y, 2.0, hh, {cols: 3, frame: 'ochre', depth: 0.14});
  }
  K.opening(S, 21.9, 0.05, 1.6, 9.4, {rows: 14, cols: 3, frame: 'concrete', back: 'glass', depth: 0.1});
  for (const y of [2.8, 5.3, 7.8]) {                                               // round balconies on the south part
    slab(b, f, 4.5, y, 2.4, 0.15, 1.1, 'concrete');
    slab(b, f, 4.5, y + 0.15, 2.4, 0.9, 0.05, 'concrete', 1.05);
  }
  K.coping(S, 10.0, 0.25, 0.1, 'concrete');
  K.endCap(COURT, 0, 0, 10.0, 'concrete', -1, 0);
  K.endCap(COURT, L, 0, 10.0, 'concrete', 1, 0);
}
function north(K: FrontKit, b: BuildingTools) {
  // dark brick north end of the DNB block (w10-354, w27-14): tall round-headed windows
  for (const c of [NORTH, NORTH2]) {
    const L = chordLength(c), top = c === NORTH ? 7.0 : 19.4, S = K.sec(c, 0, L, 0, top, 'greyBrick');
    const n = Math.max(1, Math.floor(L / 3.2));
    for (let k = 0; k < n; k++) {
      const s = L * (k + 0.5) / n;
      if (top > 10) { K.opening(S, s, 4.0, 1.4, 3.4, {rise: 0.7, cols: 2, rows: 3, frame: 'bronze'}); K.opening(S, s, 9.6, 1.4, 3.2, {rise: 0.7, cols: 2, rows: 3, frame: 'bronze'}); K.opening(S, s, 14.6, 1.4, 2.6, {cols: 2, rows: 2, frame: 'bronze'}); }
      else K.opening(S, s, 3.5, 1.4, 2.4, {rise: 0.7, cols: 2, rows: 2, frame: 'bronze'});
    }
    K.coping(S, top, 0.2, 0.08, 'stone');
    K.endCap(c, 0, 0, top, 'greyBrick', -1, 0);
    K.endCap(c, L, 0, top, 'greyBrick', 1, 0);
    void b;
  }
}
function teal(K: FrontKit, b: BuildingTools) {
  // the glazed entrance with teal frames (w11-53, w28-54)
  const L = chordLength(TEAL), S = K.sec(TEAL, 0, L, 0, 13.4, 'concrete'), f = K.faceFrame(S);
  K.opening(S, 3.0, 0.4, 5.0, 2.8, {cols: 4, frame: 'copper', depth: 0.14});
  K.opening(S, 8.5, 0.4, 2.2, 3.6, {cols: 2, rows: 3, frame: 'copper', back: 'glass', depth: 0.2});
  for (const y of [4.4, 7.4, 10.4]) for (const s of [2.2, 5.6, 9.2, 12.3]) K.opening(S, s, y, 2.2, 1.6, {cols: 2, frame: 'copper'});
  slab(b, f, 8.5, 4.1, 3.6, 0.15, 1.3, 'copper');                                   // canopy over the door
  K.coping(S, 13.4, 0.2, 0.08, 'concrete');
  K.endCap(TEAL, 0, 0, 13.4, 'concrete', -1, 0);
  K.endCap(TEAL, L, 0, 13.4, 'concrete', 1, 0);
}

export function buildOudeTurfmarkt139(_w: number, _d: number, b: BuildingTools) {
  const K = makeFrontKit(b, OFF);
  massing(b);
  {
    dnb(K, b);
    uva(K, b);
    bernardus(K, b);
    houses(K, b);
    court(K, b);
    north(K, b);
    teal(K, b);
  }
  K.flush();
}
