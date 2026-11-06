import type {BuildingTools} from './cultural-builders';
import {P, balcony, face, flushFaces, ledgeStrip, opening, planFrame, resetFaces, slab, strut, sub, wall, type Face, type FR, type P2} from './modern-front-kit';

/**
 * Winkelcentrum Plein '40-'45, Slotermeer: BAG pand 0363100012112179 (bouwjaar 2000, 174 verblijfsobjecten at Jan de
 * Jonghkade 5-79, Joop van Weezelhof 1-50, Willem Kraanstraat 2-80, Burgemeester De Vlugtlaan 143-159 and Plein '40-'45
 * 3-10; BAG, CC0): the covered shopping centre with its parking garage beside the square (nl.wikipedia "Plein '40-'45":
 * built in the 1990s), housing and offices above. "winkelcentrum 40-45" lettering on the 2019-2024 panoramas. Architect not
 * named by the BAG or nl.wikipedia; unconfirmed.
 *
 * Plan frame (winkelcentrum-plein-40-45-footprints.json, native x east, z south, y up from the -0.64 m NAP street): u along
 * the Burgemeester De Vlugtlaan (south) front from the south-west corner (-65.3, 98.7) eastwards, v into the block (north).
 * Volumes from the 3DBAG roof parts (CC BY 4.0): the seven-storey south block (24.7 m) with staggered balconies and the
 * mall entrance under it; the brick parking garage on the east (10.8 m roof, 11.3 m parapet) over the Kwik-Fit shops and
 * the garage entrance; the brick housing bar on the north (17 m) over a shop plinth; the grey office bar on the west
 * (17 m) over shops under a pergola of raked beams; the mall between them under a 4.2 m roof with a glass street.
 *
 * Fronts measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of winkelcentrum-plein-40-45-brief.md:
 * w02-195 (south, 2024, the lower 12 m; the upper floors from its aimed view), w01-105 (east, 2022), w03-15 / w04-15
 * (north, 2024 / 2025), w05-285 / w06-285 (west, 2020), w07/w08/w09 (the service yard), w12-15 (the office bar's north end).
 * The inner faces over the mall roof are INFERRED.
 */
const O: P2 = [-65.3, 98.7], U: P2 = [0.9667, 0.256], V: P2 = [0.256, -0.9667];
const {fr, capUp, prism} = planFrame(O, U, V);

const MALL = 4.2;

type Row = [number, number];
const punch = (b: BuildingTools, F: Face, t: number, row: Row, w: number, o: Parameters<typeof opening>[6] = {}) =>
  opening(b, F, t, row[0], w, row[1] - row[0], {depth: 0.15, sill: false, ...o});
const range = (t0: number, t1: number, step: number) => { const out: number[] = []; for (let t = t0; t <= t1 + 1e-6; t += step) out.push(t); return out; };

// ---------------------------------------------------------------- south block
const SB_TOP = 24.7, SB_L = (k: number) => 4.6 + 2.9 * (k - 1); // floor k = 1..7
const BAL_A: Row[] = [[3.6, 12.0], [12.1, 20.2], [24.5, 34.2], [37.0, 41.7], [44.5, 50.2], [55.3, 67.0], [69.6, 79.5]];
const BAL_B: Row[] = [[7.9, 20.2], [20.4, 27.3], [32.6, 37.9], [40.9, 45.7], [48.0, 58.7], [62.6, 71.0], [71.2, 79.5]];
function southBlock(b: BuildingTools) {
  const ring: P2[] = [[39.3, 3.4], [119, 3.4], [119, 18.6], [40, 19.2], [35.3, 15.8], [35.4, 9.7], [39.3, 9.7]];
  prism(b, ring, 0, SB_TOP, 'brick', 'slate', [0, 1, 2]);
  const S = fr(ring[0], ring[1]);
  const F = face(S, 0, SB_TOP, 'brick');
  // the mall entrance: an undercroft through the block to the glass street, under the first balconies (w02, left)
  const UND = 30.1, UND_H = 6.8;
  // the hall runs on under the block to the mall's glass fronts (10 m in; declared as a through passage in the spec), on four square piers just inside the face
  F.holes.push({t0: 0.3, t1: UND, y0: 0, y1: UND_H, depth: 10.0, back: 'glass'});
  for (const t of [9.3, 15.0, 20.6, 26.3]) slab(b, S.f, t, 0, 1.0, UND_H, 1.0, 'brick', -1.2);
  // yellow-framed windows in groups of a pair and a single every 7.05 m (w02 storey 1, measured); floor 1 east of the undercroft
  const groupTs: number[] = [];
  for (let k = -5; k <= 6; k++) for (const d of [0, 1.55, 3.5]) groupTs.push(35.0 + 7.05 * k + d);
  for (let k = 1; k <= 7; k++) {
    const y = SB_L(k) + 0.9;
    for (const t of groupTs) if (t > (k === 1 ? 30.9 : 0.8) && t < S.len - 0.7) punch(b, F, t, [y, y + 1.7], 1.15, {frame: 'ochre'});
  }
  // ground: tall narrow blue-framed windows and doors at their measured places (w02)
  const GROUND: [number, number][] = [[31.57, 0.4], [32.74, 0.9], [35.25, 0.9], [36.47, 0.5], [43.25, 1.4], [45.65, 1.1], [50.63, 0.5], [56.69, 1.0],
    [59.71, 1.0], [61.15, 0.5], [65.6, 0.6], [70.9, 1.0], [72.07, 0.5], [73.64, 0.5], [75.07, 0.5], [77.87, 0.9], [78.86, 0.3]];
  for (const [t, w] of GROUND) punch(b, F, t, [0.1, 3.45], w, {frame: 'frame', depth: 0.2});
  // the staggered blue balconies, two alternating plans
  for (let k = 2; k <= 7; k++) for (const [a, c] of (k % 2 ? BAL_B : BAL_A)) {
    const c1 = Math.min(c, S.len - 0.1);
    balcony(b, S, a, c1 - a, 1.8, SB_L(k), {parapet: 'blue', railH: 1.1, slabT: 0.25});
  }
  // east end (w01, left; blurred): windows on every floor, INFERRED balconies left out
  const E = face(fr(ring[1], ring[2]), 0, SB_TOP, 'brick');
  for (let k = 1; k <= 7; k++) for (const t of range(1.5, E.len - 1.0, 2.45)) punch(b, E, t, [SB_L(k) + 0.9, SB_L(k) + 2.6], 1.0, {frame: 'ochre'});
  // north side over the mall (INFERRED): windows above the mall roof
  const N = face(fr(ring[2], ring[3]), 0, SB_TOP, 'brick');
  // (floor 2 only west of the low brick part, which stands against this face to 9 m for u 74-119)
  for (let k = 2; k <= 7; k++) for (const t of range(1.5, N.len - 1.0, 4.9)) if (k > 2 || t > 46) punch(b, N, t, [SB_L(k) + 0.9, SB_L(k) + 2.6], 2.2, {edge: 0});
}

// ---------------------------------------------------------------- garage and its low brick front
/** Garage ventilation slot: a dark opening with three horizontal louvres. */
const vent = (b: BuildingTools, F: Face, t: number, row: Row, w: number) => punch(b, F, t, row, w, {back: 'bronze', rows: 3, frame: 'frame'});
const V1: Row = [8.4, 9.7], V2: Row = [5.7, 7.0];
/** The garage's alternating rhythm (w01): a single wide slot, then a pair of square ones, every 7.6 m; the lower row offset. */
function ventRows(b: BuildingTools, F: Face, t0: number, t1: number, rows: Row[], phase = 0) {
  rows.forEach((row, j) => {
    for (let s = t0 + phase + (j ? 0.4 : 0); s <= t1; s += 7.6) {
      const single = j ? s + 3.8 : s, pair = j ? s : s + 3.8;
      if (single + 0.8 <= t1) vent(b, F, single, row, 1.6);
      if (pair + 1.3 <= t1) { vent(b, F, pair - 0.65, row, 1.0); vent(b, F, pair + 0.65, row, 1.0); }
    }
  });
}
const narrow = (b: BuildingTools, F: Face, t: number, w = 0.55, h = 3.6) => punch(b, F, t, [0.2, 0.2 + h], w, {frame: 'frame', back: 'glass', depth: 0.2});
function garage(b: BuildingTools) {
  const LB_TOP = 9.0, G_TOP = 11.3;
  // low brick part between the south block and the garage (3DBAG 8.2 m roof)
  const lb: P2[] = [[74.1, 18.9], [119, 18.6], [119, 40.5], [74.1, 40.5]];
  prism(b, lb, 0, LB_TOP, 'brick', 'slate', [1]);
  const E1 = face(fr(lb[1], lb[2]), 0, LB_TOP, 'brick');
  ventRows(b, E1, 4.3, E1.len - 0.5, [V2], 0);
  for (const t of [7.6, 8.6, 10.4, 17.4, 18.4]) narrow(b, E1, t);
  for (const t of [12.6, 19.6]) narrow(b, E1, t, 0.9, 2.4);
  // the garage
  const g: P2[] = [[70, 40.5], [119, 40.5], [119, 131.3], [70, 131.3]];
  prism(b, g, 0, G_TOP, 'brick', 'concrete', [1, 3]);
  const E = face(fr(g[1], g[2]), 0, G_TOP, 'brick');
  ventRows(b, E, 1.5, E.len - 1.0, [V1, V2]);
  for (const t of [0.8, 4.0, 8.5, 9.5, 11.2]) narrow(b, E, t);
  narrow(b, E, 6.2, 1.1, 2.4);
  // the garage entrance: open, dark, three orange round columns (w01)
  E.holes.push({t0: 15.8, t1: 43.9, y0: 0, y1: 4.0, depth: 1.4, back: 'bronze'});
  for (const t of [22.7, 29.9, 37.0]) strut(b, P(E.f, [t, 0, -0.4]) as [number, number, number], P(E.f, [t, 4.0, -0.4]) as [number, number, number], 0.3, 'red', 10);
  // the Kwik-Fit shops between grey columns, a dark fascia
  const cols = [43.9, 51.0, 58.1, 65.1, 72.2, 79.3];
  cols.slice(0, -1).forEach((a, i) => E.holes.push({t0: a + 0.4, t1: cols[i + 1] - 0.4, y0: 0.1, y1: 3.1, depth: 0.6, back: 'glass'}));
  slab(b, E.f, (43.9 + 79.3) / 2, 3.1, 79.3 - 43.9, 0.8, 0.08, 'frame', 0.02);
  for (const t of range(81.5, E.len - 1, 2.6)) narrow(b, E, t, 1.4, 2.8);
  // west side over the glass street (INFERRED): the same slots
  const W = face(fr(g[3], g[0]), MALL, G_TOP, 'brick');
  ventRows(b, W, 1.5, W.len - 1.0, [V1]);
}

/** The centre's entrance portal: an orange frame (two posts and a deep lintel) proud of the plinth (w19, w22). */
function portal(b: BuildingTools, F: FR, t0: number, t1: number, h: number) {
  for (const t of [t0, t1]) slab(b, F.f, t, 0, 0.7, h, 0.5, 'red', 0);
  slab(b, F.f, (t0 + t1) / 2, h - 1.2, t1 - t0 + 0.7, 1.2, 0.5, 'red', 0);
}

// ---------------------------------------------------------------- north housing bar
const NB_TOP = 17.0, NB_S = [5.2, 7.95, 10.7, 13.45];
function northBar(b: BuildingTools) {
  const ring: P2[] = [[0, 153.3], [119, 153.3], [119, 162.9], [0, 162.8]];
  prism(b, ring, 0, NB_TOP, 'brick', 'slate', [0, 1, 2, 3]);
  const N = fr(ring[2], ring[3]);
  // plinth: shopfronts between dark columns, the white band, a glass canopy (east part, w04) or a dark fascia (w03)
  const pl = face(sub(N, 0, N.len), 0, 4.95, 'bronze');
  // shop bays between dark columns: measured on w04 east of the entrance, 6.9 m runs on w03 west of it; the entrance glazed
  const shops: [number, number][] = [[1.5, 8.9], [9.1, 16.3], [16.5, 19.9], [20.1, 23.6], [23.8, 28.4], [28.6, 30.8], [31.0, 35.6], [35.8, 39.3], [39.5, 47.9]];
  for (const a of range(55.85, N.len - 7.0, 6.9)) shops.push([a + 0.25, a + 6.65]);
  // (dark columns about 0.5 m wide between the bays)
  for (const [a, c] of shops) pl.holes.push({t0: a + 0.15, t1: c - 0.15, y0: 0.2, y1: 3.4, depth: 0.3, back: 'glass'});
  pl.holes.push({t0: 49.9, t1: 54.5, y0: 0.05, y1: 3.4, depth: 0.8, back: 'glass'});
  slab(b, N.f, N.len / 2, 4.3, N.len, 0.65, 0.15, 'stone', 0);
  // (the canopy reads about 2.5 m deep on w04; drawn 1.6 m so the street-ray audit reads it as a canopy, not a gap)
  slab(b, N.f, 24.3, 3.5, 48.6, 0.1, 1.6, 'canopyGlass', 0.05);
  for (const t of range(0.5, 48.1, 2.3)) ledgeStrip(b, N.f, t, 3.42, 0.08, 0.1, 1.6, 'frame', 0.05);
  slab(b, N.f, (48.6 + N.len) / 2, 3.45, N.len - 48.6, 0.75, 0.1, 'frame', 0.02);
  // the north entrance (w22, at the plinth recess u 63.4-70.3) and its orange frame
  portal(b, N, 49.2, 55.2, 4.6);
  // housing: white bays at their measured places (w04 east of the north entrance, w03 west of it; t from the east end):
  // D = wide bay with two big windows, F = French window with a railing, S = one wide window; brick piers between them
  // with pairs of small square openings
  const BAYS: [string, number, number][] = [['D', 1.5, 8.1], ['F', 12.8, 14.4], ['D', 17.1, 24.1], ['F', 26.8, 28.4], ['F', 32.1, 33.8], ['D', 36.4, 43.4],
    ['F', 46.0, 47.6], ['F', 51.7, 53.3], ['D', 56.85, 64.05], ['F', 66.65, 68.35], ['F', 72.15, 73.75], ['D', 76.45, 83.45], ['F', 86.05, 87.75],
    ['F', 91.35, 93.15], ['S', 95.85, 99.05], ['F', 105.55, 107.15], ['F', 110.85, 112.45]];
  const bay = (kind: string, t0: number, w: number) => {
    if (kind === 'b') {
      const Fb = face(sub(N, t0, w), 4.95, NB_TOP, 'brick');
      if (w >= 2.5) for (const y of NB_S) for (const dy of [0.7, 2.0]) for (const f of [1 / 3, 2 / 3]) Fb.holes.push({t0: w * f - 0.18, t1: w * f + 0.18, y0: y + dy, y1: y + dy + 0.36, depth: 0.12, back: 'bronze'});
      return;
    }
    const Fs = face(sub(N, t0, w), 4.95, NB_TOP - 0.6, 'stone');
    wall(b, sub(N, t0, w), NB_TOP - 0.6, NB_TOP, 'brick');
    for (const y of NB_S) {
      if (kind === 'D') { for (const c of [w / 4, 3 * w / 4]) punch(b, Fs, c, [y + 0.3, y + 2.3], w / 2 - 0.5, {cols: 2, frame: 'frame'}); }
      else if (kind === 'S') punch(b, Fs, w / 2, [y + 0.3, y + 2.3], w - 0.6, {cols: 2, frame: 'frame'});
      else {
        punch(b, Fs, w / 2, [y + 0.15, y + 2.45], w - 0.4, {cols: 2, frame: 'pink'});
        ledgeStrip(b, sub(N, t0, w).f, w / 2, y + 1.0, w - 0.3, 0.05, 0.04, 'bronze', 0.05);
        ledgeStrip(b, sub(N, t0, w).f, w / 2, y + 0.2, w - 0.3, 0.05, 0.04, 'bronze', 0.05);
      }
    }
  };
  let t = 0;
  for (const [k, a, c] of BAYS) { if (a - t > 0.05) bay('b', t, a - t); bay(k, a, c - a); t = c; }
  bay('b', t, N.len - t);
  // ends and the south side over the mall (INFERRED from w07: light panels with windows)
  for (const F of [fr(ring[1], ring[2]), fr(ring[3], ring[0])]) {
    const E = face(F, 0, NB_TOP, 'brick');
    for (const y of NB_S) punch(b, E, F.len / 2, [y + 0.15, y + 2.45], 1.2, {cols: 2, frame: 'pink'});
  }
  const S = face(fr(ring[0], ring[1]), 0, NB_TOP, 'stone');
  for (const y of NB_S) for (const tt of range(1.6, S.len - 1.0, 4.8)) punch(b, S, tt, [y + 0.6, y + 2.1], 2.4, {edge: 0});
}

// ---------------------------------------------------------------- west office bar and its pergola
const WB_TOP = 17.0, WB_ROWS: Row[] = [[6.0, 8.0], [9.0, 11.0], [12.0, 14.0], [15.0, 16.4]];
function pergola(b: BuildingTools, F: FR, t0: number, t1: number, d = 3.0) {
  const tip = 4.9 + 1.4 * d / 3.0;
  for (const t of range(t0 + 0.3, t1 - 0.3, 1.0)) strut(b, P(F.f, [t, 4.9, 0.05]) as [number, number, number], P(F.f, [t, tip, d]) as [number, number, number], 0.09, 'bronze', 4);
  strut(b, P(F.f, [t0, tip, d]) as [number, number, number], P(F.f, [t1, tip, d]) as [number, number, number], 0.12, 'bronze', 4);
  slab(b, F.f, (t0 + t1) / 2, 5.45, t1 - t0, 0.04, d - 0.1, 'canopyGlass', 0.05);
}
function westBar(b: BuildingTools) {
  const ring: P2[] = [[2.5, 10.5], [21.4, 10.9], [21.6, 124.4], [2.5, 124.3]];
  prism(b, ring, 0, WB_TOP, 'stone', 'slate', [0, 1, 2, 3]);
  const W = fr(ring[3], ring[0]);
  // shops: glass fronts in mullioned runs under a dark fascia (w05, w06)
  const pl = face(sub(W, 0, W.len), 0, 4.9, 'bronze');
  for (const a of range(0.5, W.len - 11.5, 11.4)) {
    pl.holes.push({t0: a, t1: a + 11.0, y0: 0.25, y1: 3.8, depth: 0.3, back: 'glass'});
    for (const k of [1, 2, 3]) ledgeStrip(b, W.f, a + 2.75 * k, 0.25, 0.2, 3.55, 0.2, 'bronze', -0.3);
  }
  pergola(b, W, 0, W.len);
  // the main entrance from the square (w19, at the recess v 91.9-100.9): the orange frame, two orange WINKELCENTRUM banners
  // on the panels above (their lettering is not drawn)
  portal(b, W, 24.2, 31.8, 4.9);
  for (const t of [21.6, 36.3]) slab(b, W.f, t, 7.5, 0.8, 6.0, 0.12, 'red', 0.4);
  // grey office panels: 5.9 m windows of four lights at 7.4 m; green glass stair towers at the lift heads
  const U = face(sub(W, 0, W.len), 4.9, WB_TOP, 'stone');
  const towers = [5.0, 52.0, 108.0];
  for (const t of range(3.0, W.len - 3.0, 7.4)) {
    if (towers.some(s => Math.abs(s - t) < 6.0)) continue;
    for (const row of WB_ROWS) punch(b, U, t, row, 5.9, {cols: 4, bars: [1.4], frame: 'bronze'});
  }
  for (const s of towers) {
    slab(b, W.f, s, 4.9, 5.1, WB_TOP + 0.4 - 4.9, 0.35, 'green');
    for (const k of range(0, 5, 1)) ledgeStrip(b, W.f, s - 2.5 + k, 4.9, 0.08, WB_TOP + 0.4 - 4.9, 0.04, 'frame', 0.35);
    for (const y of range(5.9, WB_TOP, 1.5)) ledgeStrip(b, W.f, s, y, 5.1, 0.08, 0.04, 'frame', 0.35);
  }
  // south end over the low corner part, east side over the mall (INFERRED): the same windows
  for (const [F, y0] of [[fr(ring[0], ring[1]), 4.9], [fr(ring[1], ring[2]), 6.2]] as [FR, number][]) {
    const G = face(F, y0, WB_TOP, 'stone');
    for (const t of range(3.0, F.len - 3.0, 7.4)) for (const row of WB_ROWS) if (row[0] > y0 + 0.3) punch(b, G, t, row, 5.9, {edge: 0});
    if (y0 > 4.9) wall(b, F, 0, y0, 'brick');
    else wall(b, F, 0, y0, 'stone');
  }
  // north end on the service yard (w12): a blank light wall with two long slits near the top, a brick base with a door
  const NE = fr(ring[2], ring[3]);
  const Nu = face(NE, MALL, WB_TOP, 'stone');
  for (const row of [[13.3, 13.9], [15.2, 15.8]] as Row[]) punch(b, Nu, NE.len / 2, row, 13.0, {frame: 'bronze'});
  const Nb = face(NE, 0, MALL, 'brick');
  punch(b, Nb, NE.len * 0.7, [0.05, 2.4], 1.1, {back: 'frame'});
  // lift heads on the roof
  for (const [a, c] of [[12.6, 20.3], [68.3, 75.3], [115.6, 122.8]]) prism(b, [[9.9, a], [14.0, a], [14.0, c], [9.9, c]], WB_TOP, 20.1, 'stone', 'slate');
}

// ---------------------------------------------------------------- the low corner, the mall, the service yard
function mall(b: BuildingTools) {
  // south-west corner: low shops under the pergola (3DBAG 4.9 m)
  const sw: P2[] = [[0, 0], [29, 0], [29, 9.7], [35.4, 9.7], [35.3, 15.8], [21.4, 15.8], [21.4, 10.9], [2.5, 10.5], [0, 10.5]];
  prism(b, sw, 0, 4.9, 'bronze', 'slate', [0, 8]);
  for (const F of [fr(sw[0], sw[1]), fr(sw[8], sw[0])]) {
    const G = face(F, 0, 4.9, 'bronze');
    G.holes.push({t0: 0.5, t1: F.len - 0.5, y0: 0.25, y1: 3.8, depth: 0.3, back: 'glass'});
  }
  // the west pergola runs on to the corner (w05); the café front on the south has its own awning (w09), not drawn
  pergola(b, fr(sw[8], sw[0]), 0, 10.5, 1.5);
  // the mall roof, the glass street, the raised roof over the west half
  const m: P2[] = [[21.4, 15.8], [35.3, 15.8], [40, 19.2], [74.1, 18.94], [74.1, 40.5], [70, 40.5], [70, 131.3], [119, 131.3], [119, 153.3],
    [2.4, 153.3], [2.3, 141.5], [36.3, 141.6], [36.4, 146.1], [43.5, 146.1], [43.5, 116.1], [21.6, 115.8]];
  capUp(b, m, MALL, 'slate');
  // walls on the service yard (w07, w08, w09): brown brick with doors and roller shutters
  const yard: [P2, P2][] = [[m[9], m[10]], [m[10], m[11]], [m[11], m[12]], [m[12], m[13]], [m[13], m[14]], [m[14], m[15]]];
  for (const [p, q] of yard) {
    const F = fr(p, q), G = face(F, 0, MALL, 'brick');
    for (const t of range(3.0, F.len - 2.0, 7.0)) punch(b, G, t, [0.05, 2.5], 1.2, {back: 'frame', depth: 0.1});
  }
  wall(b, fr([119, 131.3], [119, 153.3]), 0, MALL, 'brick');
  prism(b, [[62.5, 19.3], [69.9, 19.3], [69.9, 131.3], [61.5, 131.3]], MALL, 7.0, 'glass', 'glass');
  prism(b, [[21.6, 26.8], [44, 25.3], [44, 71.3], [30.2, 71.6], [30.1, 115.8], [21.6, 115.8]], MALL, 6.0, 'brick', 'slate');
}

export function buildWinkelcentrumPlein4045(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  resetFaces();
  southBlock(b); garage(b); northBar(b); westBar(b); mall(b);
  flushFaces(b);
}
