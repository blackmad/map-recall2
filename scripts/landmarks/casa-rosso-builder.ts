import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, poly, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {cross, mapPts, ringTube, signText, tube} from './wallen-theatres-kit';
import source from './casa-rosso-footprints.json';

/**
 * CASA ROSSO, Oudezijds Achterburgwal 106-108, De Wallen (BAG pand 0363100012178727, one pand for both numbers, VBO
 * 0363010003761628 "bijeenkomstfunctie"; BAG year 1005 = unknown; no monument record). The theatre's canal front is a flat
 * black-painted screen standing over the low hall behind it (3DBAG: the roof behind the front is 6.6 m, the screen's
 * coping 10.6 m in the panoramas), its signs the whole of its identity:
 *  - the big cut-out elephant (black body, pink neon outline, the XXX tie, a rose in its raised trunk) on a pale grey
 *    T-shaped panel, between two vertical planted walls (2025);
 *  - the marquee: a black fascia 1 m deep with the gilt serif letters THEATRE CASA ROSSO, a gabled canopy (pediment)
 *    over it with a round medallion of the pink elephant, two pink pig figures on its ends, the posts with gilt inverted
 *    triangles either side of the entrance, and the roller shutter with the pink elephant painted on it.
 *
 * Read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) b_20250114_1026_Track06_Sphere_00114 (2025-01-14) and
 * recording_2025-06-30_05-16-46_01495 (2025-06-30) at 120 px/m on the BAG front line (edge 3, 8.8 m), heights from the
 * pavement (0.4 m NAP; the 3DBAG ground is 0.43 m), the depth of the marquee and pediment from the oblique views
 * b_20250114_1026_Track06_Sphere_00056 and recording_2025-06-30_05-16-46_01599/_01602. Positions are metres along the
 * front from the viewer's left (t) and above the ground (y). Per item in casa-rosso-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;

/** Symmetry axis of the front (pediment apex, the letters, the planted walls), t from the viewer's left. */
const AX = 4.2;
/** The screen: its face 0.35 m proud of the BAG line, its coping top at 10.62 m. */
const SCREEN = 0.35, COPING = 10.4;
/** The marquee: fascia 2.5-3.45 m, 1.05 m deep in front of the screen. */
const FASCIA: [number, number] = [2.5, 3.45], MARQUEE = 1.05;

/**
 * The elephant's outline (t, y) traced on the 2025-01 rectified crop at 120 px/m: left ear top, over the head and the right
 * ear, the trunk raised to the right with the rose at its tip, down the right arm and side, the feet, the left side and the
 * hanging left arm, back up the left ear. 2.75 m wide, 4.15 m tall.
 */
export const ELEPHANT: [number, number][] = [
  [3.15, 9.45], [3.35, 9.55], [3.55, 9.5], [3.68, 9.33], [3.95, 9.3], [4.3, 9.28], [4.6, 9.32], [4.78, 9.42], [4.98, 9.38],
  [5.08, 9.22], [5.3, 9.22], [5.42, 9.3], [5.62, 9.33], [5.7, 9.2], [5.55, 9.1], [5.3, 9.05], [5.17, 8.95], [5.1, 8.7],
  [5.07, 8.45], [5.05, 8.2], [4.95, 8.02], [5.12, 7.88], [5.33, 7.68], [5.36, 7.42], [5.25, 7.2], [5.05, 7.15], [5.0, 6.9],
  [4.95, 6.6], [4.9, 6.3], [4.95, 6.0], [4.97, 5.72], [5.05, 5.57], [4.95, 5.45], [4.6, 5.45], [4.45, 5.52], [4.33, 5.65],
  [4.2, 5.55], [3.9, 5.45], [3.62, 5.5], [3.56, 5.66], [3.6, 6.0], [3.55, 6.3], [3.45, 6.6], [3.35, 6.85], [3.05, 7.0],
  [2.95, 7.3], [3.05, 7.6], [3.12, 7.9], [3.2, 8.1], [3.1, 8.3], [3.02, 8.6], [3.05, 8.9], [3.1, 9.2],
];
/** The pink neon lines inside the outline: ears, trunk, mouth, the left hand, the leg split (same crop). */
const ELEPHANT_LINES: [number, number][][] = [
  [[3.35, 9.25], [3.25, 9.0], [3.3, 8.6], [3.2, 8.35]],
  [[4.85, 9.15], [4.95, 8.8], [4.9, 8.4], [4.75, 8.15]],
  [[4.75, 8.4], [4.95, 8.7], [5.1, 9.0], [5.3, 9.15]],
  [[3.9, 8.25], [4.05, 8.0], [4.25, 8.2]],
  [[4.3, 8.1], [4.55, 8.05], [4.75, 8.2]],
  [[4.22, 5.62], [4.25, 6.15]],
];
/** The finger rings of the left hand and the toes (same crop). */
const RINGS: [number, number, number][] = [[3.66, 7.42, 0.07], [3.68, 7.22, 0.07], [3.7, 7.03, 0.065], [3.85, 5.58, 0.06], [4.02, 5.56, 0.06], [4.62, 5.56, 0.06], [4.8, 5.58, 0.06]];
const TIE: [number, number][] = [[4.45, 7.85], [4.75, 7.75], [4.8, 7.3], [4.72, 6.95], [4.5, 6.85], [4.4, 7.2]];

export function buildCasaRosso(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const {f, len} = ringFrame(src.facadeRing, 3);
  const sink0 = getSink();
  setSink(0.12, true);
  screen(b, f, len);
  elephant(b, f);
  marquee(b, f, len);
  entrance(b, f);
  setSink(sink0);
}

/**
 * The black screen with its coping, the pale grey T-panel (the centre panel 2.2-6.0 m from 6.1 m up, the outer panels from
 * 8.1 m), and the two planted walls (1.0-2.2 and 6.0-7.4 m, 3.55-10.25 m; 2025: dense green, darker clumps).
 */
function screen(b: BuildingTools, f: Frame, len: number) {
  // no sink: the back face sits 0.5 m inside, behind the 3DBAG's own inward face of the screen (else the two tie)
  const sk = getSink();
  setSink(0);
  slab(b, f, len / 2, 0, len - 0.04, COPING, SCREEN + 0.5, 'greyBrick', -0.5);
  setSink(sk, true);
  slab(b, f, len / 2, COPING, len, 0.22, SCREEN + 0.1, 'stone');
  const top = 10.25;
  slab(b, f, 4.1, 6.1, 3.8, top - 6.1, 0.05, 'concrete', SCREEN);
  for (const [a, c] of [[0.25, 1.0], [7.4, 8.55]]) slab(b, f, (a + c) / 2, 8.1, c - a, top - 8.1, 0.05, 'concrete', SCREEN);
  for (const [a, c] of [[1.0, 2.2], [6.0, 7.4]]) {
    slab(b, f, (a + c) / 2, 3.55, c - a, top - 3.55, 0.12, 'green', SCREEN);
    // clumps of the planting: a staggered grid of small blocks standing 4-14 cm off the green bed
    const cols = 4, rows = 16, cw = (c - a) / cols, rh = (top - 3.7) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3) % 4 === 0) continue;
      const dd = 0.05 + ((i * 5 + j * 11) % 6) * 0.04;
      slab(b, f, a + (i + 0.5) * cw + (j % 2 ? 0.06 : -0.06), 3.62 + j * rh, cw * 0.8, rh * 0.85, dd, (i + j) % 3 ? 'copper' : 'green', SCREEN + 0.12);
    }
  }
}

/** The cut-out elephant on its stand-offs: black body 8 cm thick 12 cm off the panel, the pink neon outline and lines on it. */
function elephant(b: BuildingTools, f: Frame) {
  const off = SCREEN + 0.05 + 0.12, d = 0.08, face = off + d;
  poly(b, f, 0, 0, ELEPHANT, d, 'bronze', off);
  tube(b, f, ELEPHANT, 0.08, 0.045, 'pink', face, true);
  for (const l of ELEPHANT_LINES) tube(b, f, l, 0.055, 0.045, 'pink', face);
  for (const [t, y, r] of RINGS) ringTube(b, f, t, y, r, 0.04, 0.045, 'pink', face, 6);
  ringTube(b, f, 4.03, 8.72, 0.075, 0.04, 0.045, 'pink', face, 7);
  ringTube(b, f, 4.43, 8.64, 0.065, 0.04, 0.045, 'pink', face, 7);
  // the tie with the three Amsterdam crosses
  tube(b, f, TIE, 0.045, 0.045, 'pink', face, true);
  for (const y of [7.55, 7.35, 7.13]) cross(b, f, 4.6, y, 0.055, 0.035, 0.045, 'pink', face);
  // the rose at the trunk tip
  ringTube(b, f, 5.55, 9.22, 0.08, 0.045, 0.045, 'red', face, 6);
}

/**
 * The marquee: the black fascia box with its pale top edge, the red neon line under it and the gilt letters; the gabled
 * canopy over it (base 3.55 m from t 1.5 to 6.9, apex 4.9 m at the axis) with pale raking mouldings, the medallion
 * (white face in a dark red rim, the pink elephant) and the two pink pigs on the fascia ends.
 */
function marquee(b: BuildingTools, f: Frame, len: number) {
  const [y0, y1] = FASCIA, front = SCREEN + MARQUEE;
  slab(b, f, len / 2, y0, len - 0.3, y1 - y0, MARQUEE, 'greyBrick', SCREEN);
  slab(b, f, len / 2, y1, len - 0.3, 0.1, MARQUEE + 0.04, 'concrete', SCREEN);
  slab(b, f, len / 2, y0 - 0.05, len - 0.3, 0.05, MARQUEE, 'red', SCREEN);
  signText(b, f, 'THEATRE CASA ROSSO', AX - 0.08, 2.75, front, {width: 6.05, d: 0.045, colour: 'gold', curve: 3});
  // pediment canopy: a triangular prism from the screen to the fascia front, on the fascia top
  const base = y1 + 0.1, hw = 2.7, rise = 1.35;
  const shape = new T.Shape([new T.Vector2(-hw, 0), new T.Vector2(hw, 0), new T.Vector2(0, rise)]);
  put(b, f, new T.ExtrudeGeometry(shape, {depth: MARQUEE - 0.05, bevelEnabled: false}), AX, base, SCREEN, 'greyBrick');
  const pf = SCREEN + MARQUEE - 0.05;
  tube(b, f, [[AX - hw + 0.05, base + 0.03], [AX, base + rise - 0.02], [AX + hw - 0.05, base + 0.03]], 0.1, 0.05, 'concrete', pf);
  // the rake copings over the canopy's roof slopes
  const slope = Math.atan2(rise, hw), L = Math.hypot(hw, rise);
  for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(L, 0.06, MARQUEE - 0.05).translate(0, 0.03, (MARQUEE - 0.05) / 2);
    g.rotateZ(-s * slope);
    g.translate(s * hw / 2, rise / 2, 0);
    put(b, f, g, AX, base, SCREEN, 'concrete');
  }
  // medallion (centre 4.02 m): dark red rim, pale face, the pink elephant
  const mc: [number, number] = [AX - 0.05, 4.02];
  put(b, f, new T.CylinderGeometry(0.5, 0.5, 0.05, 20).rotateX(Math.PI / 2).translate(0, 0, 0.025), mc[0], mc[1], pf, 'red');
  put(b, f, new T.CylinderGeometry(0.42, 0.42, 0.05, 20).rotateX(Math.PI / 2).translate(0, 0, 0.075), mc[0], mc[1], pf, 'sandstone');
  poly(b, f, 0, 0, mapPts(ELEPHANT, [4.3, 7.5], 0.15, mc), 0.045, 'pink', pf + 0.1);
  for (const t of [0.65, 7.75]) pig(b, f, t, base, SCREEN + 0.55);
}

/** A pink pig figure (about 0.4 x 0.7 m) sitting on the fascia: body, head, snout and ears, simplified to lathed parts. */
function pig(b: BuildingTools, f: Frame, t: number, y: number, out: number) {
  const body = new T.LatheGeometry([[0.001, 0], [0.17, 0.02], [0.19, 0.18], [0.15, 0.36], [0.09, 0.42], [0.001, 0.43]].map(p => new T.Vector2(p[0], p[1])), 8);
  put(b, f, body, t, y, out, 'pink');
  put(b, f, new T.SphereGeometry(0.14, 8, 6), t, y + 0.53, out, 'pink');
  put(b, f, new T.CylinderGeometry(0.06, 0.06, 0.06, 8).rotateX(Math.PI / 2).translate(0, 0, 0.15), t, y + 0.5, out, 'pink');
  for (const s of [-1, 1]) put(b, f, new T.ConeGeometry(0.05, 0.12, 4).translate(0, 0.06, 0), t + s * 0.08, y + 0.63, out, 'pink');
}

/**
 * The entrance under the marquee: the posts either side (0.25-1.0 and 7.45-8.2 m, the full marquee depth) with two gilt
 * inverted triangles each, the light grey roller shutter between them with its ribs, the pink elephant painted on its left
 * half (1.85-3.1 m, 0.2-2.1 m).
 */
function entrance(b: BuildingTools, f: Frame) {
  const front = SCREEN + MARQUEE;
  for (const c of [0.62, 7.82]) {
    slab(b, f, c, 0, 0.75, FASCIA[0], MARQUEE, 'greyBrick', SCREEN);
    for (const s of [-1, 1]) poly(b, f, c + s * 0.18, 0.7, [[-0.16, 1.75], [0.16, 1.75], [0, 0]], 0.045, 'gold', front);
  }
  const s0 = 1.0, s1 = 7.44, sc = (s0 + s1) / 2, sw = s1 - s0;
  slab(b, f, sc, 0.05, sw, FASCIA[0] - 0.05, 0.04, 'concrete', SCREEN);
  for (let y = 0.25; y < FASCIA[0] - 0.1; y += 0.2) ledgeStrip(b, f, sc, y, sw - 0.02, 0.03, 0.04, 'concrete', SCREEN + 0.04);
  // the painted elephant: the sign's outline at 0.46 scale, feet at 0.2 m
  poly(b, f, 0, 0, mapPts(ELEPHANT, [4.3, 5.45], 0.46, [2.47, 0.2]), 0.045, 'pink', SCREEN + 0.04);
}
