import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, poly, ringSlab, setSink, slab} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import source from './club-raum-footprints.json' with {type: 'json'};

/**
 * Club RAUM, Humberweg 3 on the corner of the Basisweg, Westpoort (BAG pand 0363100012134632, bouwjaar 1969): a
 * former bookbinding works found by the SPIELRAUM collective in 2023 and opened as a queer club in 2024
 * (amsterdamnow.com, Mixmag: "a '60s former industrial building close to Sloterdijk Station"). One BAG pand holds three
 * parts the panoramas show plainly:
 *  - on the corner, a two-storey office block of dark red brick with two white-framed ribbon windows on both streets,
 *    grey concrete ledges over each ribbon, a chimney stack at its Humberweg end and a painted-out company name;
 *  - along the Humberweg, the long single-storey brick hall with two loading doors in grey panel surrounds, a row of
 *    small vents under the coping, and the white side door with a black cross-in-circle mark (2025 only);
 *  - along the Basisweg, a single-storey unit clad in light grey panels with a darker band, a ribbon of windows, a white
 *    roller door and a tall yellow door with a black ring-and-tree mark.
 *
 * Read from the Gemeente Amsterdam panoramas (CC BY 4.0) via face-crops.ts (40 px/m): Basisweg
 * recording_2025-06-17_04-45-19_01650, recording_2024-09-09_12-47-19_01064 and TMX7316060226-000506_pano_0000_007804
 * (2020); Humberweg recording_2025-07-01_10-32-54_00235 and TMX7316010203-002080_pano_0000_001160 (2021). The yard
 * and east faces have no panorama and are plain brick (inferred). Every item and its plan is in club-raum-inventory.json.
 *
 * Native frame of club-raum-footprints.json (x east, z south, y up from the 0.986 m NAP pavement). Massing: one prism
 * under each 3DBAG LoD2.2 roof piece (office block 6.9-7.2 m, hall 5.15-5.5 m; the small piece at the chimney becomes
 * the chimney stack), the two street fronts set OFF in front of them with parapets just over the roofs.
 */
type C = 'brick' | 'concrete' | 'stone' | 'frame' | 'white' | 'glass' | 'dark' | 'gold' | 'bronze' | 'slate';
type XZ = [number, number];
const SRC = source as unknown as {nativeRing: XZ[]; roofs: Record<string, number[][][]>};
const RING = SRC.nativeRing;
const ROOFS = SRC.roofs['0363100012134632'];
const OFF = 0.22;

const N: Chord = {a: RING[3], b: RING[4]};   // Basisweg, 49.18 m, s from the east end
const W: Chord = {a: RING[4], b: RING[0]};   // Humberweg, 50.0 m, s from the Basisweg corner
const len = (ch: Chord) => Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]);
const LN = len(N), LW = len(W);

// ---- measured heights and runs (m above the pavement; s along the chord) -----------------------------------------------
const BASE = -0.3;
const OFFICE_TOP = 7.25, HALL_TOP = 5.55;            // parapets just over the 3DBAG roofs (7.17 and 5.15-5.5)
const OFFICE_N0 = 23.92;                             // office block from here to the corner on the Basisweg (3DBAG piece 0 edge)
const OFFICE_W1 = 17.0;                              // office block on the Humberweg, to the chimney
const CHIMNEY: [number, number] = [16.6, 18.5];
const CHIMNEY_TOP = 7.95;
const LOW: [number, number] = [0.9, 2.2], UP: [number, number] = [3.95, 4.6];   // the two ribbons
const BAND = [3.9, 4.6];                             // dark band on the grey cladding

type Ctx = {K: FrontKit; b: BuildingTools};
const ff = (c: Ctx, S: Sec, proud = 0) => c.K.faceFrame(S, proud);
/** Segments of [s0, s1] clear of the given intervals. */
function clear(s0: number, s1: number, holes: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let cur = s0;
  for (const [a, b] of [...holes].sort((x, y) => x[0] - y[0])) { if (a > cur + 0.02) out.push([cur, a]); cur = Math.max(cur, b); }
  if (s1 > cur + 0.02) out.push([cur, s1]);
  return out;
}
// Long ledges are closed slabs: an open 25 m ledgeStrip is one 52 m boundary loop, which the holes gate fails.
/** Parapet over a front: a solid strip from the face plane back into the roof, with a light metal coping. */
function parapet(c: Ctx, S: Sec, ch: Chord, s0: number, s1: number, y0: number, top: number, col: C, copingH = 0.06) {
  c.K.along(ch, s0, s1, [[OFF, y0], [OFF, top], [-0.3, top], [-0.3, y0]], col);
  c.K.coping(S, top, copingH, 0.04, 'frame', s0, s1, 0.3);
}
/** A ribbon of windows from s0 to s1 split into lights of about `pitch` metres by white piers. */
function ribbon(c: Ctx, S: Sec, s0: number, s1: number, y: [number, number], pitch: number, pier = 0.3) {
  const n = Math.max(1, Math.round((s1 - s0 + pier) / (pitch + pier))), w = (s1 - s0 - (n - 1) * pier) / n;
  for (let k = 0; k < n; k++) {
    const a = s0 + k * (w + pier);
    c.K.opening(S, a + w / 2, y[0], w, y[1] - y[0], {cols: Math.max(1, Math.round(w / 1.4)), frame: 'frame', depth: 0.14, edge: 0.06});
    if (k + 1 < n) ledgeStrip(c.b, ff(c, S), a + w + pier / 2, y[0] - 0.02, pier, y[1] - y[0] + 0.04, 0.05, 'white');   // front and top only: no side faces beside the reveals
  }
}

// ---- Basisweg ------------------------------------------------------------------------------------------------------------
function basisweg(c: Ctx) {
  const {K} = c;
  // grey clad unit
  {
    const S = K.sec(N, 0, OFFICE_N0, BASE, 5.1, 'concrete'), f = ff(c, S);
    // tall yellow door in a white surround with its black ring-and-tree mark
    K.opening(S, 3.1, 0, 3.2, 4.45, {back: 'gold', frame: 'frame', edge: 0.15, depth: 0.12});
    const g = ff(c, S, -0.12);
    ringSlab(c.b, g, 3.1, 2.5, 1.06, 1.2, 0.05, 'bronze', 0, 32);
    slab(c.b, g, 3.1, 1.3, 0.14, 2.75, 0.05, 'bronze');
    for (const [apex, hw] of [[4.15, 0.62], [3.55, 0.8], [2.95, 0.95]] as const) {
      const t = 0.14, h = 0.55;
      poly(c.b, g, 3.1, apex - h, [[-hw, 0], [-hw + t, 0], [0, h - t * 1.2], [hw - t, 0], [hw, 0], [0, h]], 0.05, 'bronze');
    }
    // ribbon of windows and the side door, the white roller door
    ribbon(c, S, 5.85, 16.85, LOW, 1.3, 0.12);
    K.opening(S, 17.8, 0, 1.5, 2.3, {back: 'dark', frame: 'frame', edge: 0.06, depth: 0.1});
    K.opening(S, 21.7, 0, 3.6, 4.6, {back: 'frame', frame: 'frame', edge: 0.1, depth: 0.1, rows: 10, barW: 0.025});
    for (const [a, b] of clear(0, OFFICE_N0, [[1.35, 4.85], [19.75, 23.65]])) slab(c.b, f, (a + b) / 2, BAND[0], b - a, BAND[1] - BAND[0], 0.05, 'stone');
    parapet(c, S, N, 0, OFFICE_N0, 5.1, HALL_TOP, 'concrete');
    K.endCap(N, 0.1, BASE, HALL_TOP, 'concrete', -1, -0.5);
  }
  // brick office block to the corner
  {
    const s1 = LN + OFF, S = K.sec(N, OFFICE_N0, s1, BASE, 6.8, 'brick'), f = ff(c, S);
    K.opening(S, 26.7, 0, 3.4, 2.3, {cols: 2, back: 'dark', frame: 'frame', edge: 0.06, depth: 0.1});
    ribbon(c, S, 28.5, 40.9, LOW, 1.6);
    K.opening(S, 41.45, 0, 0.9, 2.25, {cols: 1, frame: 'frame', edge: 0.07, depth: 0.14});
    ledgeStrip(c.b, f, 42.25, LOW[0] - 0.02, 0.6, LOW[1] - LOW[0] + 0.04, 0.05, 'white');
    ribbon(c, S, 42.6, 49.0, LOW, 1.6);
    ribbon(c, S, 24.3, 49.0, UP, 2.8);
    slab(c.b, f, (OFFICE_N0 + s1) / 2, LOW[1] + 0.06, s1 - OFFICE_N0, 0.12, 0.1, 'stone');
    slab(c.b, f, (OFFICE_N0 + s1) / 2, UP[1] + 0.04, s1 - OFFICE_N0, 0.12, 0.1, 'stone');
    parapet(c, S, N, OFFICE_N0, s1, 6.8, OFFICE_TOP, 'brick');
    K.endCap(N, OFFICE_N0 + 0.1, HALL_TOP, OFFICE_TOP, 'brick', -1, -0.5);
  }
}

// ---- Humberweg -----------------------------------------------------------------------------------------------------------
function humberweg(c: Ctx) {
  const {K, b} = c;
  // office block from the corner
  {
    const S = K.sec(W, -OFF, OFFICE_W1, BASE, 6.8, 'brick'), f = ff(c, S);
    ribbon(c, S, 0.4, 16.2, LOW, 1.6);
    ribbon(c, S, 0.4, 16.2, UP, 3.8);
    slab(c.b, f, (OFFICE_W1 - OFF) / 2, LOW[1] + 0.06, OFFICE_W1 + OFF, 0.12, 0.1, 'stone');
    slab(c.b, f, (OFFICE_W1 - OFF) / 2, UP[1] + 0.04, OFFICE_W1 + OFF, 0.12, 0.1, 'stone');
    // the Basisweg parapet's end closes the corner; this one starts behind it
    parapet(c, S, W, 0.3, OFFICE_W1, 6.8, OFFICE_TOP, 'brick', 0.1);   // 4 cm over the Basisweg coping where they cross
  }
  // chimney stack at the end of the office block, 6 cm proud of the wall, and the sloped shoulder down to the hall
  K.along(W, CHIMNEY[0], CHIMNEY[1], [[OFF + 0.06, 5.3], [OFF + 0.06, CHIMNEY_TOP], [-1.0, CHIMNEY_TOP], [-1.0, 5.3]], 'brick');
  slab(b, frameAt(W, 0, OFF + 0.06), (CHIMNEY[0] + CHIMNEY[1]) / 2, CHIMNEY_TOP, CHIMNEY[1] - CHIMNEY[0] + 0.1, 0.1, 0.1, 'stone', -1.2);
  poly(b, frameAt(W, 0, OFF), CHIMNEY[1], HALL_TOP, [[0, 0], [0.7, 0], [0, 1.7]], 1.0, 'brick', -1.0);
  // the hall
  {
    const S = K.sec(W, OFFICE_W1, LW, BASE, 5.1, 'brick'), f = ff(c, S);
    for (const sc of [22.9, 31.1]) {
      K.opening(S, sc, 0, 4.0, 3.5, {back: 'dark', edge: 0, depth: 0.12});
      slab(c.b, f, sc, 0, 3.0, 2.25, 0.06, 'stone', -0.12);
    }
    // the white side door with its mark: a black circle quartered by a white cross
    K.opening(S, 27.15, 0, 1.1, 2.15, {back: 'white', frame: 'frame', edge: 0.05, depth: 0.1});
    const g = ff(c, S, -0.1);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) slab(c.b, g, 27.15 + dx * 0.085, 1.5 + (dy < 0 ? -0.15 : 0.02), 0.13, 0.13, 0.05, 'bronze');
    for (let s = 18.8; s < LW - 0.5; s += 4.18) K.opening(S, s, 4.45, 0.26, 0.22, {back: 'bronze', edge: 0, depth: 0.1});
    parapet(c, S, W, OFFICE_W1, LW, 5.1, HALL_TOP, 'brick');
    K.endCap(W, LW - 0.1, BASE, HALL_TOP, 'brick', 1, -0.5);
  }
}

function massing(b: BuildingTools) {
  roofPrism(b, [ROOFS[0]], 'brick', 'slate');
  roofPrism(b, [ROOFS[2]], 'brick', 'slate');
  roofPrism(b, [ROOFS[1].map(p => [p[0], 5.4, p[2]])], 'brick', 'slate');   // the chimney piece's floor; the stack itself is drawn on the front
}

export function buildClubRaum(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    massing(b);
    const K = makeFrontKit(b, OFF);
    const c: Ctx = {K, b};
    basisweg(c);
    humberweg(c);
    K.flush();
  } finally {
    setSink(0);
  }
}
