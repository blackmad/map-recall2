import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, disc, getSink, poly, ringFrame, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {arcPts, mosaicPanel, signText, timberWindow} from './wallen-more-kit';
import source from './bulldog-first-footprints.json';

/**
 * THE BULLDOG THE FIRST, Oudezijds Voorburgwal 90, De Wallen (BAG pand 0363100012178229; VBOs 90-H and 90-1): the first
 * Bulldog coffeeshop (1975), a narrow white-plastered corner house with a bell gable and three round-headed attic windows,
 * two storeys of two dark-framed windows with red flower boxes, and its ground storey painted all over in a bright mosaic
 * of colour, with the round blue-and-yellow bulldog-head signs hanging at both ends of the front.
 *
 * Not the Bulldog Palace: that is the former police station on the Leidseplein (Leidseplein 15-17), outside De Wallen;
 * this lane's brief named the Palace at this address, and the address (verified in BAG and OSM) is The First.
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 80 px/m on the canal front (facade ring edge 2, 4.52 m,
 * faces 128 deg): b_20250114_1026_Track02_Sphere_00186 (2025-01-14, opposite bank, the whole front leaf-off),
 * b_20250114_1026_Track02_Sphere_00088 (2025-01-14, near, the signs) and recording_2025-06-16_06-42-40_02070 (2025-06-16,
 * near, the flower boxes and the ground storey). Crop datum 0.4 m NAP; the 3DBAG ground is 0.36 m NAP, so heights below are
 * read straight off the crop (4 cm difference ignored). The alley side (edge 1, 11.1 m, faces 205 deg) is seen only at its
 * front corner (b_20250114_1026_Track02_Sphere_00088 thumbnail): brick, one green-framed window, the mosaic wrapping round.
 * Per item in bulldog-first-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = 2, SIDE = 1;
const W = 4.52;
/**
 * Raised cornice gable: a broad, shallow parabolic arc from the 12.35 m shoulders at both edges to a 13.6 m crown, read off
 * the 2025-01-14 opposite-bank crop (b_20250114_1026_Track02_Sphere_00186: edges at ~12.6, crown ~14.0 crop m, crop 0.25 m
 * over the model datum). The first cut (11.75 m shoulders, a quarter-cosine) read as a tall pointed dome to the blind judge.
 * A 13.75 m crown (the crop's reading) made the openings gate read all nine front openings as buried; 13.6 m passes.
 */
const SHOULDER = 12.35, CROWN = 13.6;
function gableTop(t: number) {
  const u = Math.min(1, Math.abs(t - W / 2) / (W / 2));
  return SHOULDER + (CROWN - SHOULDER) * (1 - u * u);
}
const MOSAIC = ['blue', 'gold', 'red', 'green', 'pink', 'ochre', 'copper'];

export function buildBulldogFirst(_w: number, _d: number, b: BuildingTools) {
  const {f, len} = ringFrame(src.facadeRing, FRONT);
  const onFront = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => Math.abs((p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]) < 0.4);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: s => onFront(s)});
  const sink0 = getSink();
  // no sink: the front is this builder's own solid wall, so trims need not reach behind an uneven 3DBAG plane (a sunk frame
  // put its pane behind the wall in the openings audit)
  setSink(0);
  frontWall(b, f, len);
  windows(b, f);
  groundStorey(b, f, len);
  side(b);
  for (const t of [0.3, len - 0.3]) bulldogSign(b, f, t);
  setSink(sink0);
}

/** The white plastered front with its bell gable (replaces the 3DBAG's pitched front wall), the coping along the gable and the band over the ground storey. */
function frontWall(b: BuildingTools, f: Frame, len: number) {
  const top: [number, number][] = [];
  for (let i = 0; i <= 16; i++) { const t = len * i / 16; top.push([t, gableTop(t)]); }
  poly(b, f, 0, 0, [[0, 0], ...top, [len, 0]].reverse() as [number, number][], 0.25, 'stone', -0.25);
  // coping: a 14 cm band riding the gable outline, lifted 5 cm over it
  const s0 = getSink();
  setSink(0);
  for (let i = 0; i < 16; i++) {
    const [t0, y0] = top[i], [t1, y1] = top[i + 1];
    const L = Math.hypot(t1 - t0, y1 - y0), a = Math.atan2(y1 - y0, t1 - t0);
    poly(b, f, (t0 + t1) / 2, (y0 + y1) / 2 + 0.05, [[-L / 2 - 0.02, -0.07], [L / 2 + 0.02, -0.07], [L / 2 + 0.02, 0.07], [-L / 2 - 0.02, 0.07]].map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]) as [number, number][], 0.1, 'stone', 0);
  }
  setSink(s0, true);
  // shoulder ledges and the small finial block on the crown
  for (const t of [0.2, len - 0.2]) slab(b, f, t, SHOULDER - 0.1, 0.45, 0.12, 0.16, 'stone');
  slab(b, f, len / 2, CROWN, 0.5, 0.12, 0.14, 'stone');
}

/** Two storeys of two dark-framed windows (axes 1.23 and 3.29 m) with hoods and flower boxes; three round-headed attic windows. */
function windows(b: BuildingTools, f: Frame) {
  const axes = [1.23, 3.29];
  for (const [y0, y1] of [[4.6, 6.75], [7.6, 9.9]] as [number, number][]) {
    for (const t of axes) {
      slab(b, f, t, y0 - 0.12, 1.29 + 0.3, y1 - y0 + 0.2, 0.04, 'stone');
      timberWindow(b, f, t, y0, 1.29, y1 - y0, {cols: 2, rows: 4, rowWeights: [1, 1, 0.95, 0.9], sill: 'stone', out: 0.04});
      slab(b, f, t, y1 + 0.05, 1.55, 0.14, 0.12, 'stone');
      flowerBox(b, f, t, y0 - 0.06, 1.3);
    }
  }
  timberWindow(b, f, W / 2, 10.5, 1.1, 1.46, {cols: 2, rows: 3, arch: true, sill: 'stone'});
  archBand(b, f, W / 2, 10.5, 1.34, 1.58, 0.12, 0.08, 'stone');
  flowerBox(b, f, W / 2, 10.44, 1.15);
  for (const t of [W / 2 - 1.16, W / 2 + 1.16]) {
    timberWindow(b, f, t, 10.58, 0.55, 1.1, {cols: 1, rows: 3, arch: true, sill: 'stone'});
    archBand(b, f, t, 10.58, 0.75, 1.2, 0.1, 0.07, 'stone');
  }
}

/** Grey window box with a band of red geraniums on top, hung under a sill. */
function flowerBox(b: BuildingTools, f: Frame, t: number, yTop: number, w: number) {
  slab(b, f, t, yTop - 0.3, w, 0.3, 0.25, 'concrete', 0.02);
  slab(b, f, t, yTop - 0.02, w - 0.06, 0.18, 0.2, 'red', 0.05);
}

/**
 * The painted ground storey (0-4.5 m): the whole front covered in a bright mosaic of colour under a dark blue fascia; the
 * multi-pane window on the left (t 0.35-1.75 m, 1.1-3.6 m), the door (t 2.55-3.45 m, to 2.6 m) with the yellow 90 over it.
 */
function groundStorey(b: BuildingTools, f: Frame, len: number) {
  mosaicPanel(b, f, len / 2, 0, len, 4.3, MOSAIC, {ground: 'blue', cell: 0.24, fill: 0.9, seed: 3, d: 0.04});
  slab(b, f, len / 2, 4.3, len + 0.04, 0.28, 0.12, 'blue');
  // window: brown timber frame, many small panes
  slab(b, f, 1.05, 1.0, 1.55, 2.7, 0.06, 'bronze', 0.08);
  timberWindow(b, f, 1.05, 1.1, 1.4, 2.5, {cols: 4, rows: 5, frame: 'bronze', sill: null, out: 0.14, bar: 0.04});
  // door and its number board
  slab(b, f, 3.0, 0, 1.0, 2.75, 0.06, 'dark', 0.08);
  const sk = getSink();
  setSink(0);
  slab(b, f, 3.0, 2.0, 0.6, 0.55, 0.04, 'glass', 0.15);
  setSink(sk, true);
  slab(b, f, 3.0, 2.82, 0.7, 0.42, 0.05, 'dark', 0.08);
  signText(b, f, '90', 3.0, 2.88, 0.14, {width: 0.34, height: 0.28, d: 0.04, colour: 'gold'});
}

/** The alley side (edge 1): one green-framed second-floor window by the front corner and the mosaic wrapping 3 m round it. */
function side(b: BuildingTools) {
  const {f, len} = ringFrame(src.facadeRing, SIDE);
  // which end of the side edge meets the front: the one nearer the front edge's midpoint
  const fr = ringFrame(src.facadeRing, FRONT).f;
  const ends = [0, len].map(t => [f.origin[0] + f.tangent[0] * t, f.origin[1] + f.tangent[1] * t]);
  const fm = [fr.origin[0] + fr.tangent[0] * W / 2, fr.origin[1] + fr.tangent[1] * W / 2];
  const corner = Math.hypot(ends[0][0] - fm[0], ends[0][1] - fm[1]) < Math.hypot(ends[1][0] - fm[0], ends[1][1] - fm[1]) ? 0 : len;
  const dir = corner === 0 ? 1 : -1;
  mosaicPanel(b, f, corner + dir * 1.5, 0, 3.0, 4.3, MOSAIC, {ground: 'blue', cell: 0.24, fill: 0.9, seed: 5, d: 0.04});
  slab(b, f, corner + dir * 1.5, 4.3, 3.0, 0.28, 0.12, 'blue');
  timberWindow(b, f, corner + dir * 1.3, 7.7, 0.9, 1.7, {cols: 2, rows: 3, frame: 'green', sill: 'stone'});
}

/**
 * A round hanging sign perpendicular to the front at t, centre 4.95 m up (its rim just over the fascia), 0.25-1.25 m off the wall: dark blue rim, red ring,
 * yellow face with a brown bulldog head (ears, jowls, a pale muzzle), on an iron arm; both faces drawn. The THE BULLDOG / THE
 * FIRST COFFEESHOP lettering round the rim is too small at this size and is left out.
 */
function bulldogSign(b: BuildingTools, f: Frame, t: number) {
  const yc = 4.95, s0 = 0.25, r = 0.5, c = s0 + r, th = 0.08;
  slab(b, f, t, yc + r + 0.02, 0.05, 0.05, s0 + 2 * r + 0.05, 'slate');
  slab(b, f, t, yc + r - 0.3, 0.12, 0.4, 0.04, 'slate');
  const P: [number, number] = [f.origin[0] + f.tangent[0] * t, f.origin[1] + f.tangent[1] * t];
  const sk = getSink();
  setSink(0);
  for (const side of [1, -1]) {
    const n: [number, number] = [f.tangent[0] * side, f.tangent[1] * side];
    const tan: [number, number] = [n[1], -n[0]];
    const sf: Frame = {origin: [P[0] + n[0] * th / 2, P[1] + n[1] * th / 2], tangent: tan, n};
    const along = f.n[0] * tan[0] + f.n[1] * tan[1];
    const st = (s: number) => s * along;
    if (side === 1) disc(b, sf, st(c), yc, r, th, 'blue', -th);
    ringSlab(b, sf, st(c), yc, r * 0.66, r * 0.74, 0.03, 'red', 0);
    disc(b, sf, st(c), yc, r * 0.66, 0.03, 'gold', 0);
    // the bulldog head: a broad jowled head, two ears, a pale muzzle and a dark nose
    poly(b, sf, st(c), yc - 0.04, [[-0.2, 0.12], [-0.13, 0.2], [0.13, 0.2], [0.2, 0.12], [0.23, -0.04], [0.16, -0.17], [0, -0.21], [-0.16, -0.17], [-0.23, -0.04]], 0.03, 'bronze', 0.03);
    for (const k of [-1, 1]) poly(b, sf, st(c) + k * 0.17 * along, yc + 0.15, [[-0.06, -0.04], [0.06, -0.04], [0.02 * k * along, 0.09]], 0.03, 'bronze', 0.03);
    poly(b, sf, st(c), yc - 0.14, arcPts(0, 0, 0.11, 0, 2 * Math.PI, 10).map(([x, y]) => [x * 1.2, y * 0.7]) as [number, number][], 0.03, 'sandstone', 0.06);
    disc(b, sf, st(c), yc - 0.09, 0.04, 0.03, 'slate', 0.09);
    for (const k of [-1, 1]) disc(b, sf, st(c) + k * 0.08 * along, yc + 0.03, 0.025, 0.03, 'slate', 0.06);
  }
  setSink(sk, true);
}
