import type {BuildingTools} from './cultural-builders';
import {
  balcony, band, face, flushFaces, ledgeStrip, opening, pipe, planFrame, resetFaces, slab, sub, wall,
  type Col, type Face, type FR, type P2,
} from './modern-front-kit';

/**
 * Kinkerstraat 89-105 / Tollensstraat 101-191 / Bilderdijkkade 542-574: BAG pand 0363100012092013, bouwjaar 1987,
 * 69 verblijfsobjecten (62 woon-, 7 winkelfunctie; BAG, CC0). Architect not named by the BAG, nl.wikipedia (Kinkerstraat,
 * Kinkerbuurt) or a monument record (none); unconfirmed.
 *
 * Plan frame (scripts/landmarks/kinkerstraat-89-footprints.json, native x east, z south, y up from the 0.62 m NAP street):
 * u along the Kinkerstraat front from the Tollensstraat corner (BAG vertex (23.123, -29.15)) towards the west corner,
 * v into the block. Volumes from the 3DBAG LoD2.2 roof parts (CC BY 4.0): the Kinkerstraat bar (v 0-9.4) and the
 * Tollensstraat (east, u 0-12.5) and west (u 57.9-66) wings under one parapet at 15.6 m; a rear terrace one storey lower
 * (v 9.4-12.5, 12.6 m); the shop deck at 4.0 m behind, cut by the open light slot (u 19.4-56.5, v 20-22.7, not in the
 * pand) and lower (3.2 m) on its south side.
 *
 * Fronts measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of kinkerstraat-89-brief.md:
 * w01-337 (Kinkerstraat, 2020 and 2021), w02-67 (Tollensstraat, 2019) and w04-248 (west side street, 2019). Heights are
 * the crops' scaled to the 3DBAG parapet (w01/w04 x 0.966, w02 x 0.89). The Kinkerstraat front is four 16 m bays between
 * the BAG's 0.96 m joints (downpipes), mirrored about u 32.5: in each a brick frame round a loggia zone of white-panelled
 * glazed wings and a deep slot with a yellow back wall, stacks of round-ended cantilevered balconies with white bar
 * railings, a solid brick balustrade band over the shop arcade, and nine windows in threes in the brick top storey.
 * Courtyard faces and the deck walls carry no photograph and are INFERRED (plain brick, the street rows of windows).
 */
const O: P2 = [23.123, -29.15], U: P2 = [-0.917972, 0.396679], V: P2 = [0.396679, 0.917972];
const {fr, capUp, prism} = planFrame(O, U, V);

// ---- levels (y above the street) ----------------------------------------------------------------------------------
const PARAPET = 15.6, TERRACE = 12.6, DECK = 4.0, DECK_S = 3.2;
const ARCADE = 3.6, BEAM: [number, number] = [3.6, 4.0], BAND_TOP = 5.1, FRAME_TOP = 12.3;
/** Punched-window rows of the brick fronts (w04, w02 plain section): sill, head. */
const ROWS: [number, number][] = [[5.1, 6.85], [7.9, 9.5], [10.5, 12.2]], TOP: [number, number] = [13.4, 15.0];
/** Loggia wing glazing per storey (w01 bay 2): glass bands and the white panels between them. */
const WING_GLASS: [number, number][] = [[5.15, 6.65], [7.8, 9.3], [10.5, 11.75]];
const SLAB_EDGE: [number, number][] = [[6.75, 7.0], [9.4, 9.65]];
/** Balcony slab tops, 6 cm over the wing slab edges so no top face is shared. */
const BALC_Y = [7.06, 9.72];

// ---- one loggia bay ------------------------------------------------------------------------------------------------
type Balc = {t0: number; t1: number; rL?: number; rR?: number};
type Bay = {f0: number; f1: number; s0: number; s1: number; yellow: [number, number]; balc: Balc[]; doors: number[]};
const WING_D = 0.35, SLOT_D = 2.2, BAL_OUT = 0.6;
/** Loggia zone of one bay cut into face F (holes: left wing, slot, right wing) and its contents. */
function loggiaBay(b: BuildingTools, F: Face, B: Bay) {
  const y0 = BAND_TOP, y1 = FRAME_TOP;
  F.holes.push({t0: B.f0, t1: B.s0, y0, y1, depth: WING_D, back: null});
  F.holes.push({t0: B.s0, t1: B.s1, y0, y1, depth: SLOT_D, back: null});
  F.holes.push({t0: B.s1, t1: B.f1, y0, y1, depth: WING_D, back: null});
  // the glazed wings: white panels, three glass bands of four lights with a top light, slab edges
  for (const [a, c] of [[B.f0, B.s0], [B.s1, B.f1]]) {
    const W = face(sub(F, a, c - a, -WING_D), y0, y1, 'white');
    for (const [g0, g1] of WING_GLASS) opening(b, W, (c - a) / 2, g0, c - a - 0.16, g1 - g0, {depth: 0.12, cols: 4, bars: [g1 - g0 - 0.38], edge: 0.05});
    for (const [e0, e1] of SLAB_EDGE) ledgeStrip(b, sub(F, a, c - a, -WING_D).f, (c - a) / 2, e0, c - a, e1 - e0, 0.06, 'concrete');
  }
  // the slot's back: yellow stair panel, white-framed balcony doors and side lights
  const S = sub(F, B.s0, B.s1 - B.s0, -SLOT_D), ys0 = B.yellow[0] - B.s0, ys1 = B.yellow[1] - B.s0;
  const back = face(S, y0, y1, 'white');
  back.holes.push({t0: ys0, t1: ys1, y0, y1, depth: 0.08, back: 'ochre'});
  for (const t of B.doors) for (const [g0] of WING_GLASS) { const h = Math.min(2.1, y1 - 0.2 - g0); opening(b, back, t - B.s0, g0 - 0.05, 0.9, h, {depth: 0.1, bars: [h - 0.55], edge: 0.05}); }
  // balconies: slab tops on the storey floors, from the slot's back to 0.6 m proud of the front
  for (const y of BALC_Y) for (const k of B.balc) balcony(b, F, k.t0, k.t1 - k.t0, SLOT_D + BAL_OUT, y, {o0: -SLOT_D, rLeft: k.rL, rRight: k.rR, slabT: 0.22, railH: 1.0});
}
/** Brick top storey windows, three per group on a 1.42 m pitch. */
function topRow(b: BuildingTools, F: Face, groups: number[], n = 3, pitch = 1.42) {
  for (const g of groups) for (let k = 0; k < n; k++) opening(b, F, g + (k - (n - 1) / 2) * pitch, TOP[0], 0.95, TOP[1] - TOP[0], {depth: 0.18, bars: [1.15], sill: 'concrete'});
}
const punched = (b: BuildingTools, F: Face, t: number, w: number, rows = ROWS) => { for (const [s, h] of rows) opening(b, F, t, s, w, h - s, {depth: 0.18, cols: w > 1.2 ? 2 : 1, bars: [h - s - 0.4], sill: 'concrete'}); };

// ---- the Kinkerstraat front (w01-337) ------------------------------------------------------------------------------
/** Bays 1 and 2 as measured; bays 3 and 4 mirror them about u 32.5 (w01 2020: the top-storey groups pair about 32.1-32.6). */
const MID = 32.5;
const BAY1: Bay = {f0: 0.65, f1: 14.9, s0: 5.4, s1: 10.95, yellow: [9.7, 10.8], balc: [{t0: 2.1, t1: 8.55, rL: 0.9}, {t0: 8.65, t1: 12.1, rR: 0.9}], doors: [6.4, 8.2]};
const BAY2: Bay = {f0: 17.7, f1: 31.5, s0: 21.9, s1: 27.6, yellow: [24.4, 26.9], balc: [{t0: 20.1, t1: 24.3, rL: 0.9}, {t0: 25.9, t1: 28.55, rR: 0.9}], doors: [23.2]};
const mirrorBay = (B: Bay): Bay => ({
  f0: 2 * MID - B.f1, f1: 2 * MID - B.f0, s0: 2 * MID - B.s1, s1: 2 * MID - B.s0, yellow: [2 * MID - B.yellow[1], 2 * MID - B.yellow[0]],
  balc: B.balc.map(k => ({t0: 2 * MID - k.t1, t1: 2 * MID - k.t0, rL: k.rR, rR: k.rL})), doors: B.doors.map(t => 2 * MID - t),
});
const BAYS = [BAY1, BAY2, mirrorBay(BAY2), mirrorBay(BAY1)];
const TOP_GROUPS = [[2.8, 7.9, 13.0], [19.6, 24.5, 29.5], [35.7, 40.6, 45.5], [52.1, 56.8, 61.5]];
/** BAG joints between the bays (0.96 m), downpipes on them. */
const JOINTS: [number, number][] = [[16.0, 17.0], [32.4, 33.3], [48.7, 49.6]];
const ARCADE_SPANS: [number, number][] = [[0.8, 16.0], [17.0, 32.4], [33.3, 48.7], [49.6, 64.8]];
const COLUMNS = [5.6, 11.2, 22.3, 27.6, 2 * MID - 27.6, 2 * MID - 22.3, 2 * MID - 11.2, 2 * MID - 5.6];

function kinkerstraat(b: BuildingTools) {
  const S = fr([0, 0], [65.7, 0]);
  const F = face(S, 0, PARAPET, 'brick');
  // the shop arcade: shopfronts 2.5 m back behind square concrete columns, a concrete beam and the brick balustrade band
  for (const [a, c] of ARCADE_SPANS) F.holes.push({t0: a, t1: c, y0: 0, y1: ARCADE, depth: 2.5, back: null});
  for (const [a, c] of ARCADE_SPANS) {
    const shop = face(sub(S, a, c - a, -2.5), 0, ARCADE, 'frame');
    const seg = (c - a - 0.6) / 4;
    for (let k = 0; k < 4; k++) opening(b, shop, 0.3 + (k + 0.5) * seg, 0.15, seg - 0.25, 2.9, {depth: 0.08, cols: 2, bars: [2.3], edge: 0.04});
  }
  for (const t of COLUMNS) slab(b, S.f, t, 0, 0.6, ARCADE, 0.6, 'concrete', -0.9);
  band(b, S, 0, S.len, BEAM[0], BEAM[1], 0.12, 'concrete');
  BAYS.forEach((B, i) => { loggiaBay(b, F, B); topRow(b, F, TOP_GROUPS[i]); });
  for (const [a, c] of JOINTS) pipe(b, S, (a + c) / 2, 0, PARAPET - 0.1);
  band(b, S, -0.1, S.len + 0.1, PARAPET - 0.25, PARAPET, 0.1, 'stone');
}

// ---- the Tollensstraat side (w02-67, t from the south end v 51.2) --------------------------------------------------
function tollensstraat(b: BuildingTools) {
  const S = fr([0.7, 51.2], [0, 0]);
  const F = face(S, 0, PARAPET, 'brick');
  // two loggia bays over the supermarket (bay A like the front's corner bays, bay B like its middle bays)
  const A: Bay = {f0: 1.1, f1: 15.8, s0: 5.7, s1: 11.6, yellow: [9.0, 11.2], balc: [{t0: 3.1, t1: 8.8, rL: 0.9}, {t0: 9.5, t1: 12.8, rR: 0.9}], doors: [6.8]};
  const Bb: Bay = {f0: 18.4, f1: 32.6, s0: 22.6, s1: 28.3, yellow: [23.7, 25.3], balc: [{t0: 21.5, t1: 24.3, rL: 0.9}, {t0: 26.0, t1: 30.3, rR: 0.9}], doors: [26.8]};
  loggiaBay(b, F, A); loggiaBay(b, F, Bb);
  topRow(b, F, [3.4, 8.4, 13.4]); topRow(b, F, [20.6, 25.5, 30.4]);
  // the supermarket's closed ground: dark blue tile panels with light blue courses between concrete piers, two service doors
  const PIERS = [1.1, 6.0, 11.6, 17.1, 22.65, 28.05, 33.6];
  for (let k = 0; k + 1 < PIERS.length; k++) {
    const a = PIERS[k] + 0.3, c = PIERS[k + 1] - 0.3;
    F.holes.push({t0: a, t1: c, y0: 0, y1: ARCADE, depth: 0.15, back: 'blue'});
    for (const y of [0.9, 1.6, 2.3, 3.0]) ledgeStrip(b, S.f, (a + c) / 2, y, c - a, 0.07, 0.07, 'green', -0.15);
  }
  for (const t of [3.6, 9.0]) slab(b, S.f, t, 0, 1.1, 2.4, 0.06, 'dark', 0.0);
  for (const g of [8.7, 25.35]) for (let k = 0; k < 4; k++) slab(b, S.f, g + (k - 1.5) * 0.36, 3.7, 0.24, 0.24, 0.06, 'dark', 0.12);
  band(b, S, 0, 34.3, BEAM[0], BEAM[1], 0.12, 'concrete', [true, false]);
  // the plain corner section (t 34.3-48.6): four axes of 1.4 m windows, the top row in threes and fours, three shops
  for (const t of [35.9, 38.4, 42.1, 46.0]) punched(b, F, t, 1.4);
  for (const t of [35.7, 37.2, 38.6, 42.1, 43.5, 44.9, 46.4, 49.3, 50.7]) opening(b, F, t, TOP[0], 0.95, TOP[1] - TOP[0], {depth: 0.18, bars: [1.15], sill: 'concrete'});
  for (const [a, c] of [[34.7, 39.7], [40.6, 43.9], [44.6, 47.9]]) {
    opening(b, F, (a + c) / 2, 0.05, c - a, 3.3, {depth: 0.25, cols: 3, edge: 0.06});
    band(b, S, a - 0.1, c + 0.1, 3.4, 3.85, 0.45, 'concrete');
  }
  // the corner loggia stack at the Kinkerstraat end: glass balustrades under dark frames, recessed 1.2 m
  for (const [s, h] of ROWS) {
    opening(b, F, 49.9, s - 0.3, 2.4, h - s + 0.5, {depth: 1.2, back: 'glass', frame: 'dark', edge: 0.08, bars: [1.0]});
  }
  for (const t of [17.0, 33.6]) pipe(b, S, t, 0, PARAPET - 0.1);
  band(b, S, -0.1, S.len, PARAPET - 0.25, PARAPET, 0.1, 'stone');
}

// ---- the west side street (w04-248, t = v from the Kinkerstraat corner) -------------------------------------------
function westSide(b: BuildingTools) {
  const S = fr([65.7, 0], [66.1, 29.9]);
  const F = face(S, 0, PARAPET, 'brick');
  // the corner loggia stack (w04 crop t 0-3.2): glass balustrades, dark frames
  for (const [s, h] of ROWS) opening(b, F, 1.7, s - 0.3, 2.6, h - s + 0.5, {depth: 1.2, back: 'glass', frame: 'dark', edge: 0.08, bars: [1.0]});
  for (const [a, c] of [[0.9, 2.0], [2.2, 3.2], [4.3, 5.2], [5.6, 6.6], [7.0, 8.0], [9.6, 11.0], [12.0, 13.4], [15.0, 16.0], [16.4, 17.4], [17.8, 18.8],
    [20.4, 21.4], [21.7, 22.7], [23.1, 24.1], [25.1, 26.1], [26.5, 27.5], [27.9, 28.9]]) opening(b, F, (a + c) / 2, TOP[0], c - a, TOP[1] - TOP[0], {depth: 0.18, bars: [1.15], sill: 'concrete'});
  for (const [a, c] of [[5.4, 6.8], [9.6, 11.0], [15.0, 16.4], [17.4, 18.8]]) punched(b, F, (a + c) / 2, c - a);
  // the loggia column with its low railings
  for (const [s, h] of ROWS) opening(b, F, 12.7, s, 1.4, h - s, {depth: 1.1, back: 'glass', edge: 0.05, bars: [1.0]});
  // ground: the shop with its red awning, the dark mural door, the double-height passage to the courtyard
  opening(b, F, 6.15, 0.05, 4.3, 3.0, {depth: 0.25, cols: 2, edge: 0.06});
  slab(b, S.f, 6.15, 3.0, 4.6, 0.35, 1.1, 'red', 0);
  opening(b, F, 11.3, 0.02, 4.2, 3.55, {depth: 0.12, back: 'dark', edge: 0});
  const PASS: [number, number] = [19.8, 29.5], PASS_H = 6.5, PASS_D = 6.0;
  F.holes.push({t0: PASS[0], t1: PASS[1], y0: 0, y1: PASS_H, depth: PASS_D, back: 'dark'});
  for (const t of [22.25, 26.2]) slab(b, S.f, t, 0, 0.5, PASS_H, 0.5, 'concrete', -0.55);
  // the entrance pavilion: yellow-framed glazed box under a curved canopy, 1.5-4 m into the passage
  const E = face(sub(S, 20.2, 5.4, -1.6), 0, 3.4, 'ochre');
  for (const k of [0, 1, 2]) opening(b, E, 0.95 + k * 1.75, 0.15, 1.5, 3.05, {depth: 0.14, frame: 'ochre', bars: [2.2], edge: 0.08});
  balcony(b, S, 20.0, 5.8, 4.4, 3.6, {o0: -4.0, rLeft: 1.2, rRight: 1.2, slabT: 0.14, railH: 0.08, slab: 'canopyGlass', rail: 'ochre', sides: false});
  // over the passage: the recessed balcony zone, a round brick-fronted balcony and a round railed balcony above it
  const ZONE0 = PASS_H + 0.05;
  F.holes.push({t0: 20.4, t1: 28.8, y0: ZONE0, y1: 12.3, depth: 1.0, back: null});
  const Z = face(sub(S, 20.4, 8.4, -1.0), ZONE0, 12.3, 'white');
  for (const [g0, g1] of [[7.8, 9.4], [10.5, 12.0]]) { opening(b, Z, 0.8, g0, 1.4, g1 - g0, {depth: 0.12, cols: 2}); opening(b, Z, 7.6, g0, 1.4, g1 - g0, {depth: 0.12, cols: 2}); opening(b, Z, 4.2, g0 - 0.6, 3.6, g1 - g0 + 0.6, {depth: 0.12, cols: 3, bars: [g1 - g0 + 0.2]}); }
  balcony(b, S, 21.7, 5.2, 2.6, 6.97, {o0: -1.0, rLeft: 1.6, rRight: 1.6, slabT: 0.35, railH: 1.3, slab: 'concrete', parapet: 'brick'});
  balcony(b, S, 21.7, 5.2, 2.6, 9.9, {o0: -1.0, rLeft: 1.6, rRight: 1.6, slabT: 0.22, railH: 1.0});
  pipe(b, S, 14.35, 0, PARAPET - 0.1);
  band(b, S, 0, S.len + 0.1, PARAPET - 0.25, PARAPET, 0.1, 'stone');
}

// ---- the rest of the block: courtyard faces, terrace, deck (INFERRED) ---------------------------------------------
/** Plain courtyard face with punched windows on the street rows (inferred) between t0 and t1. */
function courtFace(b: BuildingTools, F: FR, y0: number, y1: number, rows: [number, number][], pitch = 2.6) {
  const W = face(F, y0, y1, 'brick');
  const rs = rows.filter(([s, h]) => s > y0 + 0.4 && h < y1 - 0.3);
  if (rs.length) for (let t = 1.6; t < F.len - 1.0; t += pitch) for (const [s, h] of rs) opening(b, W, t, s, 1.2, h - s, {depth: 0.15, sill: 'concrete'});
}
function rest(b: BuildingTools) {
  const R = [...ROWS, TOP] as [number, number][];
  // main roof: the bar and both wings under one parapet (the east wing's inner edge straightened to u 8.9 / 12.3)
  const MAIN: P2[] = [[0, 0], [65.7, 0], [66.1, 29.9], [57.9, 30.0], [57.9, 12.5], [56.3, 12.5], [56.3, 9.4], [8.9, 9.4],
    [8.9, 20.8], [12.3, 20.8], [12.5, 42.0], [14.5, 51.0], [0.7, 51.2]];
  capUp(b, MAIN, PARAPET, 'copper');
  // the rear terrace one storey lower behind the Kinkerstraat bar
  courtFace(b, fr([56.3, 9.4], [8.9, 9.4]), TERRACE, PARAPET, [TOP]);
  capUp(b, [[8.9, 9.4], [56.3, 9.4], [56.3, 12.5], [8.9, 12.5]], TERRACE, 'copper');
  courtFace(b, fr([56.3, 12.5], [8.9, 12.5]), DECK, TERRACE, ROWS);
  wall(b, fr([8.9, 9.4], [8.9, 12.5]), TERRACE, PARAPET, 'brick');
  wall(b, fr([56.3, 12.5], [56.3, 9.4]), TERRACE, PARAPET, 'brick');
  // courtyard faces of the wings over the deck
  courtFace(b, fr([8.9, 12.5], [8.9, 20.8]), DECK, PARAPET, R);
  wall(b, fr([8.9, 20.8], [12.3, 20.8]), DECK, PARAPET, 'brick');
  courtFace(b, fr([12.3, 20.8], [12.5, 42.0]), DECK, PARAPET, R);
  wall(b, fr([12.5, 42.0], [14.5, 51.0]), DECK, PARAPET, 'brick');
  courtFace(b, fr([57.9, 30.0], [57.9, 12.5]), DECK, PARAPET, R);
  wall(b, fr([57.9, 12.5], [56.3, 12.5]), DECK, PARAPET, 'brick');
  // the deck: north of the light slot, beside it, south of it (lower), and the strip to the Bilderdijkkade end
  capUp(b, [[8.9, 12.5], [57.9, 12.5], [57.9, 20.0], [8.9, 20.0]], DECK, 'concrete');
  capUp(b, [[8.9, 20.0], [19.4, 20.0], [19.4, 22.7], [12.4, 22.7], [12.3, 20.8], [8.9, 20.8]], DECK, 'concrete');
  capUp(b, [[56.5, 20.0], [57.9, 20.0], [57.9, 22.7], [56.5, 22.7]], DECK, 'concrete');
  capUp(b, [[12.4, 22.7], [57.9, 22.7], [57.9, 27.7], [12.4, 27.7]], DECK_S, 'concrete');
  capUp(b, [[12.4, 27.7], [23.9, 27.7], [24.3, 50.3], [14.5, 51.0], [12.5, 42.0]], DECK, 'concrete');
  // steps between the deck and its lower south part
  wall(b, fr([19.4, 22.7], [12.4, 22.7]), DECK_S, DECK, 'brick');
  wall(b, fr([57.9, 22.7], [56.5, 22.7]), DECK_S, DECK, 'brick');
  wall(b, fr([12.4, 27.7], [23.9, 27.7]), DECK_S, DECK, 'brick');
  wall(b, fr([12.4, 22.7], [12.4, 27.7]), DECK_S, DECK, 'brick');
  wall(b, fr([57.9, 27.7], [57.9, 22.7]), DECK_S, DECK, 'brick');
  // the light slot's walls, facing into it (open to the sky, not in the pand)
  wall(b, fr([56.5, 20.0], [19.4, 20.0]), 0, DECK, 'brick');
  wall(b, fr([19.4, 22.7], [56.5, 22.7]), 0, DECK_S, 'brick');
  wall(b, fr([19.4, 20.0], [19.4, 22.7]), 0, DECK, 'brick');
  wall(b, fr([56.5, 22.7], [56.5, 20.0]), 0, DECK, 'brick');
  // w03 (south over the Bilderdijkkade yards), w05 and w06 (the low strip's west and south faces), the wings' party ends
  wall(b, fr([57.9, 27.7], [23.9, 27.7]), 0, DECK_S, 'brick');
  wall(b, fr([23.9, 27.7], [24.3, 50.3]), 0, DECK, 'brick');
  wall(b, fr([24.3, 50.3], [14.5, 51.0]), 0, DECK, 'brick');
  wall(b, fr([66.1, 29.9], [57.9, 30.0]), 0, PARAPET, 'brick');
  wall(b, fr([57.9, 30.0], [57.9, 27.7]), 0, DECK, 'brick');
  wall(b, fr([14.5, 51.0], [0.7, 51.2]), 0, PARAPET, 'brick');
}

export function buildKinkerstraat89(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  resetFaces();
  kinkerstraat(b); b.mark?.('kinkerstraat');
  tollensstraat(b); b.mark?.('tollensstraat');
  westSide(b); b.mark?.('west');
  rest(b); b.mark?.('rest');
  flushFaces(b); b.mark?.('faces');
}
export type {Col};
