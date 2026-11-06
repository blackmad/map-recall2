import type {BuildingTools} from './cultural-builders';
import {disc, ledgeStrip, letters, poly, slab} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {capRoofsUnderFronts, clipHalf, frontCoords, type FrontZone, type Ring3} from '../../src/canalRecall/landmarks/frontZones';
import {chordLength, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import source from './barlaeus-gymnasium-footprints.json';

/**
 * Barlaeus Gymnasium, Weteringschans 29, BAG pand 0363100012169565 (bouwjaar 1885, one verblijfsobject, onderwijs): the
 * 1885 sandstone block of the Stedelijk Gymnasium on the Weteringschans, with the GYMNASIUM attic, ANNO 1885 and its
 * sculpture group over the entrance risaliet, and the brick back on the Lijnbaansgracht. The 1866 building next to it (pand
 * 0363100012169564) is the ordinary large recipe `barlaeus` and is not drawn here.
 *
 * Native frame of barlaeus-gymnasium-footprints.json (x east, z south, y up from the 0.39 m NAP street). Massing: a closed
 * prism under every 3DBAG LoD2.2 roof piece (CC BY 4.0), capped under the measured fronts. Fronts: walls 0.3 m outside the
 * BAG chords with cut openings, measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0, 50 px per metre,
 * artifacts/landmark-briefs/barlaeus-gymnasium/) listed per wall in the inventory. The Weteringschans front runs north-west
 * to south-east: pavilion, wing, entrance risaliet, wing, pavilion; the pavilions and the risaliet stand 1.5 m forward.
 */
const OFF = 0.3;
const ch = (a: [number, number], b: [number, number]): Chord => ({a, b});
const PAV_W = ch([-25.174, -10.001], [-17.154, -3.578]);
const WING_W = ch([-16.215, -4.749], [-8.254, 1.628]);
const CENTRE = ch([-9.192, 2.799], [-3.105, 7.675]);
const WING_E = ch([-2.167, 6.504], [5.794, 12.880]);
const PAV_E = ch([4.856, 14.051], [12.875, 20.479]);
// risaliet returns (1.5 m, facing along the front)
const RET = [ch([-17.154, -3.578], [-16.215, -4.749]), ch([-8.254, 1.628], [-9.192, 2.799]), ch([-3.105, 7.675], [-2.167, 6.504]), ch([5.794, 12.880], [4.856, 14.051])];
// Lijnbaansgracht side (faces NE), south-east to north-west
const NE = [ch([24.435, 6.019], [16.456, -0.387]), ch([16.118, 0.034], [13.528, -2.044]), ch([13.397, -1.881], [-3.450, -15.398]), ch([-3.319, -15.561], [-5.909, -17.639]), ch([-5.572, -18.059], [-13.555, -24.461])];

// storey lines shared by the whole Weteringschans front (w03-219, w05-219, w08-219)
const RUST = 4.9, CORNICE = 17.6, APEX = 21.6;
const ZONES: FrontZone[] = [PAV_W, WING_W, CENTRE, WING_E, PAV_E].map(c => ({chord: c, s0: 0, s1: chordLength(c), depth: 6, cap: CORNICE + 0.4}));

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
function massing(b: BuildingTools) {
  const rings = source.roofs.map(r => r[0] as Ring3);
  for (const r of capRoofsUnderFronts(trimBehindFronts(rings, [PAV_W, WING_W, CENTRE, WING_E, PAV_E, ...NE], 0.08), ZONES)) {
    const ys = r.map(p => p[1]);
    roofPrism(b, [r], 'brick', Math.max(...ys) - Math.min(...ys) > 0.6 ? 'slate' : 'concrete');
  }
}

/** Rusticated sandstone ground storey with its windows, the first-floor sill band, the stone storey bands and cornice. */
function base(K: FrontKit, b: BuildingTools, S: Sec, axes: number[], w: number, x0 = 0, x1 = 0) {
  const f = K.faceFrame(S), L = S.s1 - S.s0, mid = (S.s0 + S.s1) / 2;
  for (const s of axes) K.opening(S, s, 1.3, w, 3.0, {cols: 2, rows: 2, frame: 'white', depth: 0.22, barW: 0.08});
  for (let y = 0.55; y < RUST - 0.3; y += 0.62) ledgeStrip(b, f, mid, y, L - 0.02, 0.05, 0.05, 'stone');   // rustication joints
  slab(b, f, mid, RUST, L, 0.35, 0.16, 'stone');                                                            // plinth cornice
  slab(b, f, mid, 9.9, L, 0.3, 0.12, 'stone');                                                              // storey band
  slab(b, f, mid, 14.7, L, 0.9, 0.08, 'stone');                                                             // frieze
  // at the building's corners the copings run 6 cm past the side wall, so their ends never lie on its plane
  K.coping(S, 16.4, 0.5, 0.25, 'stone', S.s0 - x0, S.s1 + x1);                                              // dentil course
  K.coping(S, 16.9, 0.7, 0.55, 'stone', S.s0 - x0, S.s1 + x1);                                              // cornice
}

function wing(K: FrontKit, b: BuildingTools, c: Chord) {
  const L = chordLength(c), AX = [1.7, 5.0, 8.3].map(s => (s * L) / 10.2);
  // rusticated stone ground, red brick upper storeys behind stone window surrounds, stone frieze and cornice (w05-219)
  const G = K.sec(c, 0, L, 0, RUST + 0.35, 'stone'), U = K.sec(c, 0, L, RUST + 0.35, 14.7, 'brick'), T = K.sec(c, 0, L, 14.7, CORNICE, 'stone');
  const f = K.faceFrame(G), mid = L / 2;
  for (const s of AX) K.opening(G, s, 1.3, 1.7, 3.0, {cols: 2, rows: 2, frame: 'white', depth: 0.22, barW: 0.08});
  for (let y = 0.55; y < RUST - 0.3; y += 0.62) ledgeStrip(b, f, mid, y, L - 0.02, 0.05, 0.05, 'stone');
  slab(b, f, mid, RUST, L, 0.35, 0.16, 'stone');
  slab(b, f, mid, 9.9, L, 0.3, 0.12, 'stone');
  slab(b, f, mid, 14.7, L, 0.9, 0.08, 'stone');
  // the wings meet the forward pavilion and risaliet sides: copings stop 6 cm short of those walls' planes
  K.coping(T, 16.4, 0.5, 0.25, 'stone', 0.06, L - 0.06);
  K.coping(T, 16.9, 0.7, 0.55, 'stone', 0.06, L - 0.06);
  for (const s of AX) {
    for (const [y, h] of [[6.4, 3.0], [11.5, 2.9]] as const) {
      K.opening(U, s, y, 1.7, h, {cols: 2, rows: 3, frame: 'white', depth: 0.24, barW: 0.08});
      for (const sd of [-1, 1]) slab(b, f, s + sd * 1.0, y - 0.1, 0.3, h + 0.2, 0.08, 'stone');            // stone jambs
      slab(b, f, s, y + h + 0.1, 2.3, 0.3, 0.12, 'stone');                                                // lintel cornice
    }
    slab(b, f, s, 5.45, 2.3, 0.8, 0.06, 'stone');                                                           // panel under the sill
  }
  // the slate roof rising behind the cornice to the 3DBAG roof 6 m back (the step the cap leaves is hidden under it)
  K.along(c, 0.08, L - 0.08, [[OFF + 0.2, CORNICE + 0.05], [-6.2, 20.6], [-6.2, CORNICE], [OFF + 0.2, CORNICE]], 'slate');
}

function pavilion(K: FrontKit, b: BuildingTools, c: Chord, x0 = 0, x1 = 0) {
  const L = chordLength(c), S = K.sec(c, 0, L, 0, CORNICE, 'stone'), f = K.faceFrame(S), mid = L / 2;
  const AX = [2.6, 5.1, 7.6].map(s => (s * L) / 10.2);
  base(K, b, S, AX, 1.7, x0, x1);
  for (const s of AX) {
    K.opening(S, s, 6.6, 1.6, 2.9, {cols: 2, rows: 3, frame: 'white', depth: 0.24, barW: 0.08});
    K.opening(S, s, 11.5, 1.6, 2.7, {cols: 2, rows: 3, frame: 'white', depth: 0.24, barW: 0.08});
    for (let k = 0; k < 6; k++) slab(b, f, s - 0.7 + k * 0.28, 5.6, 0.12, 0.8, 0.16, 'stone');           // balustrade under the window
    slab(b, f, s, 5.45, 2.0, 0.15, 0.22, 'stone');
    slab(b, f, s, 6.4, 2.0, 0.15, 0.22, 'stone');
  }
  // half columns between the windows on both upper storeys, mask keystones over them
  for (const s of [(AX[0] + AX[1]) / 2, (AX[1] + AX[2]) / 2, 1.35, L - 1.35]) {
    slab(b, f, s, 6.3, 0.5, 3.6, 0.26, 'stone');
    slab(b, f, s, 11.3, 0.5, 3.4, 0.26, 'stone');
    slab(b, f, s, 9.75, 0.7, 0.3, 0.3, 'stone');
    slab(b, f, s, 14.6, 0.7, 0.3, 0.3, 'stone');
  }
  // corner piers with their trophies and tondi (relief blocks)
  for (const s of [0.6, L - 0.6]) {
    slab(b, f, s, 11.6, 0.9, 2.8, 0.1, 'stone');
    disc(b, f, s, 8.0, 0.5, 0.12, 'stone');
    slab(b, f, s, 6.9, 0.5, 0.5, 0.1, 'stone');
  }
  for (const s of [mid - 3.2, mid, mid + 3.2]) slab(b, f, s, 15.0, 1.4, 0.35, 0.12, 'stone');               // festoons in the frieze
  // triangular pediment with raking cornice and the tondo with a head in the tympanum (w03-219)
  const fp = K.faceFrame(S, -0.1), rise = APEX - CORNICE - 0.55;
  poly(b, fp, mid, CORNICE, [[-L / 2 + 0.25, 0], [L / 2 - 0.25, 0], [0, rise]], 0.9, 'stone');
  poly(b, K.faceFrame(S, 0.8), mid, CORNICE, [[-L / 2 - 0.1, 0], [-L / 2 + 0.5, 0], [0, rise - 0.15], [L / 2 - 0.5, 0], [L / 2 + 0.1, 0], [0, rise + 0.4]], 0.35, 'stone');
  disc(b, K.faceFrame(S, 0.8), mid, CORNICE + 1.35, 0.85, 0.15, 'stone');
  for (const sd of [-1, 1]) slab(b, K.faceFrame(S, 0.8), mid + sd * 2.2, CORNICE + 0.3, 2.0, 0.8, 0.1, 'stone');   // scroll reliefs
  K.along(c, 0.05, L - 0.05, [[OFF + 0.2, CORNICE + 0.05], [-5.5, APEX - 0.2], [-5.5, CORNICE], [OFF + 0.2, CORNICE]], 'slate');
}

function centre(K: FrontKit, b: BuildingTools) {
  const L = chordLength(CENTRE), mid = L / 2, S = K.sec(CENTRE, 0, L, 0, CORNICE + 0.6, 'stone'), f = K.faceFrame(S);
  for (let y = 0.55; y < RUST - 0.3; y += 0.62) for (const [a, w] of [[0.55, 1.0], [L - 0.55, 1.0]] as const) ledgeStrip(b, f, a, y, w, 0.05, 0.05, 'stone');
  // entrance: round-headed door with fanlight between two columns under a pediment (w08-219)
  K.opening(S, mid, 0.2, 1.9, 4.4, {rise: 0.95, back: 'dark', frame: 'bronze', depth: 0.3, bars: [3.6], edge: 0.1});
  for (const sd of [-1, 1]) {
    slab(b, f, mid + sd * 1.85, 0, 0.75, 0.6, 0.85, 'stone');                                             // column bases
    slab(b, f, mid + sd * 1.85, 0.6, 0.55, 5.0, 0.65, 'stone');                                           // columns
    K.opening(S, mid + sd * 3.0, 2.4, 0.7, 1.8, {cols: 1, rows: 2, frame: 'white', depth: 0.2});
  }
  slab(b, f, mid, 5.6, 4.9, 0.5, 0.9, 'stone');                                                             // entablature
  poly(b, f, mid, 6.1, [[-2.45, 0], [2.45, 0], [0, 1.4]], 0.85, 'stone');                                   // pediment
  slab(b, f, mid, RUST, L, 0.35, 0.16, 'stone');
  slab(b, f, mid, 9.9, L, 0.3, 0.12, 'stone');
  for (const s of [mid - 1.25, mid + 1.25]) {
    K.opening(S, s, 7.6, 1.6, 2.7, {cols: 2, rows: 3, frame: 'white', depth: 0.24, barW: 0.08});
    K.opening(S, s, 12.6, 1.6, 2.7, {cols: 2, rows: 3, frame: 'white', depth: 0.24, barW: 0.08});
  }
  slab(b, f, mid, 12.3, 0.5, 3.4, 0.3, 'stone');                                                            // atlas figure between the upper windows
  for (const s of [0.75, L - 0.75]) {                                                                       // corner piers with the relief panels
    slab(b, f, s, 7.2, 0.9, 2.6, 0.1, 'stone');
    slab(b, f, s, 12.2, 0.9, 3.0, 0.1, 'stone');
  }
  K.coping(S, 16.6, 0.5, 0.3, 'stone', 0.06, L - 0.06);
  K.coping(S, 17.1, 0.6, 0.6, 'stone', 0.06, L - 0.06);
  // attic: ANNO | GYMNASIUM | 1885 with the corner pedestals, finials and the sculpture group (three standing figures)
  const A = K.sec(CENTRE, 0, L, CORNICE + 0.6, CORNICE + 2.0, 'stone'), fa = K.faceFrame(A);
  letters(b, fa, 'GYMNASIUM', mid, CORNICE + 0.85, 0, 0.075, 0.04, 'gold', 0.1);
  for (const s of [0.65, L - 0.65]) {
    slab(b, fa, s, CORNICE + 0.6, 1.3, 1.6, 0.2, 'stone');
    letters(b, K.faceFrame(A, 0.2), s < mid ? 'ANNO' : '1885', s, CORNICE + 1.0, 0, 0.045, 0.03, 'gold', 0.06);
    slab(b, fa, s, CORNICE + 2.2, 0.5, 1.0, 0.5, 'stone', -0.25);
  }
  K.coping(A, CORNICE + 2.0, 0.25, 0.15, 'stone');
  K.along(CENTRE, 0.08, L - 0.08, [[-0.3, CORNICE + 2.0], [-6.2, 21.4], [-6.2, CORNICE + 1.9], [-0.3, CORNICE + 1.9]], 'slate');
  slab(b, fa, mid, CORNICE + 2.25, 2.6, 0.5, 1.2, 'stone', -1.0);                                           // plinth of the group
  for (const [x, h] of [[-0.95, 2.1], [0, 2.8], [0.95, 2.1]] as const) slab(b, fa, mid + x, CORNICE + 2.75, 0.55, h, 0.5, 'stone', -0.6);
  slab(b, fa, mid + 0.35, CORNICE + 4.0, 1.2, 1.0, 0.15, 'stone', -0.45);                                    // the angel's wings
}

/** The 1.5 m sides of the pavilions and the risaliet: rusticated stone with the storey bands. */
function returns(K: FrontKit, b: BuildingTools) {
  RET.forEach(c => {
    const L = chordLength(c), S = K.sec(c, 0.3, L - 0.3, 0, CORNICE, 'stone'), f = K.faceFrame(S);
    slab(b, f, L / 2, RUST, L - 0.6, 0.35, 0.16, 'stone');
    K.coping(S, 16.8, 0.7, 0.55, 'stone');           // 10 cm under the front cornice it runs into
  });
}

/** Lijnbaansgracht side (w01-39, w04-39, w06-39): brick with stone bands, plain windows on four rows. */
function canalSide(K: FrontKit, b: BuildingTools) {
  for (const c of NE) {
    const L = chordLength(c), S = K.sec(c, 0, L, 0, 17.6, 'greyBrick'), f = K.faceFrame(S);
    const n = Math.max(1, Math.round(L / 3.0)), p = L / n;
    for (let k = 0; k < n; k++) {
      const s = p * (k + 0.5);
      for (const [y, h] of [[1.2, 2.6], [5.6, 2.9], [10.0, 2.7], [14.0, 2.4]] as const) K.opening(S, s, y, 1.5, h, {cols: 2, rows: 3, frame: 'white', depth: 0.2});
    }
    for (const y of [4.9, 9.4, 13.4]) slab(b, f, L / 2, y, L, 0.3, 0.08, 'stone');
    for (let y = 5.6; y < 16.6; y += 0.9) for (const [a, e] of bandRuns(S, y, 0.18)) ledgeStrip(b, f, (a + e) / 2, y, e - a, 0.18, 0.05, 'stone');
    K.coping(S, 17.6, 0.45, 0.35, 'stone', -0.06, L + 0.06);
    K.endCap(c, 0, 0, 17.6, 'greyBrick', -1, 0);
    K.endCap(c, L, 0, 17.6, 'greyBrick', 1, 0);
  }
}

/** Runs of a stone band at y..y+h that stay clear of the section's openings. */
function bandRuns(S: Sec, y: number, h: number): [number, number][] {
  const block = S.F.holes.filter(o => o.y0 - 0.05 < y + h && y < o.y1 + 0.05).map(o => [S.s0 + o.t0 - 0.06, S.s0 + o.t1 + 0.06]).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = S.s0 + 0.02;
  for (const [a, e] of block) { if (a - cur > 0.1) out.push([cur, a]); cur = Math.max(cur, e); }
  if (S.s1 - 0.02 - cur > 0.1) out.push([cur, S.s1 - 0.02]);
  return out;
}

export function buildBarlaeusGymnasium(_w: number, _d: number, b: BuildingTools) {
  massing(b);
  const K = makeFrontKit(b, OFF);
  pavilion(K, b, PAV_W, 0.06, -0.06);   // corner end runs past the side wall, return end stops short of it
  wing(K, b, WING_W);
  centre(K, b);
  wing(K, b, WING_E);
  pavilion(K, b, PAV_E, -0.06, 0.06);
  returns(K, b);
  canalSide(K, b);
  K.endCap(PAV_W, 0, 0, CORNICE, 'stone', -1, 0);
  K.endCap(PAV_E, chordLength(PAV_E), 0, CORNICE, 'stone', 1, 0);
  K.flush();
}
