import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {facePanel, getSink, letters, ledgeStrip, poly, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import {speklagen, type BandOpening} from '../../src/canalRecall/landmarks/speklagen';
import source from './kweekschool-machinisten-footprints.json';

/**
 * FORMER KWEEKSCHOOL VOOR MACHINISTEN, Plantage Muidergracht 14, Plantage (BAG pand 0363100012164973, BAG year 1880;
 * gemeentelijk monument 204058). Register: the school block by A. Salm, 1886-87, eclectic, red-brown brick in cross bond on
 * a low natural-stone plinth, enlivened with sandstone quoins, neggeblokken, sills, keystones and a carved cornice, the
 * horizontal articulation stressed by sandstone speklagen; segmental arches with brick-mosaic tympana over every window;
 * two storeys over the ground floor under a hipped roof of black glazed tiles; two transverse side wings; slightly
 * projecting risalits either side of the three middle axes (the original entrance), with the gable stones 1878 (left) and
 * 1887 (right); the right (NW) wing was the director's house with a rich stone balcony on consoles and two sandstone men's
 * heads; the left (SE) wing was rebuilt with three axes and a deep portico in 1934. Against the left wing stands B.J.
 * Ouendag's 1926 Amsterdam School block (five axes round an arched door and the stair strip, three-light classroom windows,
 * a strip of small windows on the top floor) with its two-axis link raised to the eaves; at the SE end the 1934 block of
 * W.B. Ouendag (strips of coupled transoms and sashes). The former playground on the canal was built over with the
 * three-storey wing and the two stair towers on the water side.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (hipped Salm roofs 13.5-16.7 m, the 14.5 m canal wing, the 16.1 m Ouendag
 * block, the 10.4 m 1934 block). The fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per item in
 * kweekschool-machinisten-inventory.json; t is metres along each facade-ring edge from the viewer's left (ringFrame):
 *  - street front of the Salm block (edge 1, w04-30 + w03-30, 2022-23 overcast): measured at 50 px/m on w04, laid out
 *    symmetrically about the middle axis and scaled to the 50.1 m edge (x 0.947), heights x KS to the 3DBAG eaves;
 *  - the director's wing (edge 3, w10-30 2024), the wing returns (edges 0 and 2, w11-299 / w12-119 2021);
 *  - edge 19 (w02-30 2023): the SE wing, the link and the Ouendag block; the left 10.8 m is occluded in the photo by the
 *    building across the street and is mirrored about the door axis (register: symmetric, five axes);
 *  - the 1934 front (edges 13-17, w08-28 2021), its canal side (edge 9, w07-210 2017) and SE end (edge 10, inferred from
 *    the register and the partial view in w06-120 2025);
 *  - the canal front (edge 5, w01-210 2021 and the 2017 view TMX7316010203-000354_pano_0002_000101, 34.5 px/m), and the
 *    low lab bay (edge 7, w09-210 2017).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

/** Photo metres (w04, 50 px/m, cornice top 12.9 m) to model metres (3DBAG eaves 13.5 m). */
const KS = 1.045;
const k = (y: number) => y * KS;

type Wall = {f: Frame; len: number; ops: BandOpening[]};
const wall = (i: number): Wall => { const {f, len} = ringFrame(ring, i); return {f, len, ops: []}; };

let B: BuildingTools;

export function buildKweekschoolMachinisten(_w: number, _d: number, b: BuildingTools) {
  B = b;
  // Salm's block and the canal wing in the red-brown brick; the Ouendag and 1934 blocks (x > 12 m) in their browner brick
  addShell(b, src as never, {
    wall: 'brick', roof: 'dark',
    wallFor: s => (centroidX(s) > 12 ? 'greyBrick' : 'brick'),
    roofFor: s => (slopeOf(s) > 0.15 ? 'slate' : 'dark'),
  });
  const sink0 = getSink();
  setSink(0.12, true);
  salmFront();
  directorWing();
  wingReturns();
  salmSide();
  edge19();
  front1934();
  canalFront();
  labBay();
  canal1934();
  end1934();
  setSink(sink0);
}

function centroidX(s: Surface) { const r = s.rings[0]; return r.reduce((a, p) => a + p[0], 0) / r.length; }
function slopeOf(s: Surface) {
  const r = s.rings[0];
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
  return Math.hypot(nx, nz) / (Math.abs(ny) || 1e-9);
}

// ---- kit -------------------------------------------------------------------------------------------------------------

/** Thin glazing bar: a single quad 4 cm in front of the pane (front face only; 2 triangles instead of 12). */
function bar(f: Frame, t: number, y: number, w: number, h: number, out: number) {
  facePanel(B, f, t, y, w, h, 'frame', out + 0.04);
}
type WinOpts = {cols?: number; rows?: number; transomRow?: number; mullions?: number; out?: number; frame?: string; glass?: string};
/** A cream timber window (frame, pane, paneGrid glazing); registers its opening so the speklagen stop at it. */
function win(w: Wall, t: number, y0: number, y1: number, width: number, o: WinOpts = {}) {
  const out = o.out ?? 0, h = y1 - y0, cols = o.cols ?? 2, rows = o.rows ?? 2;
  slab(B, w.f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.08, o.frame ?? 'frame', out);
  slab(B, w.f, t, y0 + 0.05, width - 0.1, h - 0.1, 0.04, o.glass ?? 'glass', out + 0.08);
  if (cols > 1 || rows > 1) {
    const grid = paneGrid({width: width - 0.1, height: h - 0.1, cols, rows, bar: 0.04, frame: 0, ...(o.transomRow ? {transomRows: [o.transomRow], transom: 0.09} : {})});
    for (const m of grid) bar(w.f, t + m.x, y0 + 0.05 + m.y, m.w, m.h, out + 0.12);
  }
  // heavy mullions dividing a multi-light window (driedelig / tweedelig)
  const n = o.mullions ?? 0;
  for (let j = 1; j <= n; j++) bar(w.f, t - width / 2 + width * j / (n + 1), y0 + 0.05, 0.1, h - 0.1, out + 0.12);
  w.ops.push({t0: t - width / 2 - 0.08, t1: t + width / 2 + 0.08, y0: y0 - 0.08, y1: y1 + 0.08});
}
/** Flat-bottomed segment (arc top) of chord W and rise r, bottom at y. */
function segment(f: Frame, t: number, y: number, W: number, r: number, d: number, colour: string, out = 0) {
  const R = (W * W / 4 + r * r) / (2 * r), n = 10, pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const x = -W / 2 + W * i / n; pts.push([x, r - R + Math.sqrt(R * R - x * x)]); }
  poly(B, f, t, y, pts, d, colour, out);
}
/**
 * The Salm window head: a segmental arch of dark brick (rowlock) over a brick-mosaic tympanum and a sandstone keystone
 * (register: "alle vensters zijn overtoogd door segmentbogen; de boogvelden zijn voorzien van metselmozaieken").
 */
function salmArch(w: Wall, t: number, y: number, W: number, rise: number, out = 0, key = true) {
  segment(w.f, t, y, W + 0.36, rise + 0.22, 0.05, 'red', out);
  segment(w.f, t, y, W - 0.04, rise, 0.1, 'bronze', out);
  if (key) slab(B, w.f, t, y + rise - 0.02, 0.26, 0.3, 0.14, 'ochre', out);
  w.ops.push({t0: t - W / 2 - 0.2, t1: t + W / 2 + 0.2, y0: y, y1: y + rise + 0.25});
}
/** Speklagen: sandstone courses across [t0, t1] broken at every opening the wall registered (speklagen.ts). */
function bands(w: Wall, ys: number[], o: {t0?: number; t1?: number; h?: number; out?: number; colour?: string} = {}) {
  const runs = speklagen({t0: o.t0 ?? 0.2, t1: o.t1 ?? w.len - 0.2, bands: ys.map(y => ({y, h: o.h ?? 0.15})), openings: w.ops, gap: 0.02});
  // runs in pieces of at most 12 m: a ledge strip is open at its ends and back, and a long open loop fails the holes gate
  for (const r of runs) {
    const n = Math.ceil((r.t1 - r.t0) / 12), L = (r.t1 - r.t0) / n;
    for (let j = 0; j < n; j++) ledgeStrip(B, w.f, r.t0 + L * (j + 0.5), r.y, L - 0.02, r.h, 0.06, o.colour ?? 'ochre', o.out ?? 0);
  }
}
/** Sandstone quoins: long and short blocks alternating up a corner at t (side -1: block reaches left, +1: right). */
function quoins(w: Wall, t: number, side: number, y0: number, y1: number, out = 0) {
  let long = true;
  for (let y = y0; y + 0.3 <= y1; y += 0.62) {
    const bw = long ? 0.62 : 0.36;
    slab(B, w.f, t + side * bw / 2, y, bw, 0.3, 0.07, 'ochre', out);
    long = !long;
  }
}
/** The carved sandstone cornice: frieze band, a row of consoles (optional) and the projecting crown, top at y. */
function cornice(w: Wall, t0: number, t1: number, y: number, o: {consoles?: number; out?: number; deep?: number} = {}) {
  const out = o.out ?? 0, c = (t0 + t1) / 2, L = t1 - t0;
  slab(B, w.f, c, y - 0.95, L, 0.38, 0.1, 'ochre', out);
  slab(B, w.f, c, y - 0.32, L + 0.2, 0.32, o.deep ?? 0.42, 'ochre', out);
  if (o.consoles) for (let x = t0 + 0.3; x <= t1 - 0.2; x += o.consoles) slab(B, w.f, x, y - 0.57, 0.14, 0.25, 0.26, 'ochre', out);
}
/**
 * Red sun blind over a window whose head is at y + 0.6 (w01-210 2021, 2017): drawn rolled up, as its red cassette with the
 * cloth's hem over the head. How far each blind is let down changes by the hour (2017 and 2021 differ), so the cloth over
 * the glass is not drawn.
 */
function blind(w: Wall, t: number, y: number, width: number) {
  slab(B, w.f, t, y + 0.68, width + 0.3, 0.26, 0.26, 'pink', 0.04);
}

// ---- the Salm block ---------------------------------------------------------------------------------------------------

/** Street front layout (edge 1, from the SE wing): four side axes, a risalit, three middle axes, a risalit, four side axes. */
const E1 = 50.1, MID = E1 / 2;
const SIDE = [1.42, 5.11, 8.81, 12.4];
/** The risalits: 3DBAG scans them 0.11 m proud at t 15.2-19.8 and 30.3-34.9; drawn 0.1 m wider so no side face lies on a scanned one. */
const RIS_W = 4.8, RIS_L = 17.5, RIS_OUT = 0.3;
const CENTRE = [MID - 3.45, MID, MID + 3.45];
const mirror = (t: number) => E1 - t;

function salmFront() {
  const w = wall(1);
  const left = SIDE, right = SIDE.map(mirror);
  // storeys (w04-30 at 50 px/m from the pavement): ground 1.2-3.8 m (three-light left of the old entrance, two-light right,
  // the arches equally wide), first 5.8-8.6 m, the attic pairs 10.5-11.6 m
  const G: [number, number] = [k(1.2), k(3.8)], F: [number, number] = [k(5.8), k(8.6)], A: [number, number] = [k(10.5), k(11.6)];
  for (const t of [...left, ...CENTRE, ...right]) {
    const threeLight = t < MID;
    if (threeLight) win(w, t, G[0], G[1], 2.6, {cols: 6, rows: 5, transomRow: 4, mullions: 2});
    else win(w, t, G[0], G[1], 1.95, {cols: 4, rows: 5, transomRow: 4, mullions: 1});
    salmArch(w, t, G[1] + 0.1, 2.6, 0.3);
    win(w, t, F[0], F[1], 1.9, {cols: 4, rows: 5, transomRow: 3, mullions: 1});
    salmArch(w, t, F[1] + 0.1, 1.9, 0.32);
    slab(B, w.f, t, F[0] - 0.2, 2.2, 0.14, 0.16, 'ochre');
    for (const s of [-0.6, 0.6]) { win(w, t + s, A[0], A[1], 0.78, {cols: 2, rows: 2}); salmArch(w, t + s, A[1] + 0.06, 0.78, 0.2, 0, false); }
    // the attic sill: a corbelled brick ledge with the diagonal brick mosaic under it
    slab(B, w.f, t, A[0] - 0.32, 2.1, 0.2, 0.14, 'red');
    slab(B, w.f, t, A[0] - 0.62, 1.9, 0.28, 0.05, 'bronze');
    w.ops.push({t0: t - 1.1, t1: t + 1.1, y0: A[0] - 0.65, y1: A[0]});
  }
  // the two risalits, 0.3 m proud, rising over the eaves to their own cornice (the tent roofs were taken off: flat)
  for (const [c, year] of [[RIS_L, '1878'], [mirror(RIS_L), '1887']] as [number, string][]) risalit(w, c, year, G, F, A);
  // low natural-stone plinth and the brick base under the ground-floor sills
  for (const [a, c] of [[0.15, RIS_L - RIS_W / 2], [RIS_L + RIS_W / 2, mirror(RIS_L) - RIS_W / 2], [mirror(RIS_L) + RIS_W / 2, E1 - 0.15]]) slab(B, w.f, (a + c) / 2, 0, c - a, 0.38, 0.18, 'stone');
  bands(w, [k(2.0), k(2.95), k(4.85), k(5.86), k(6.8), k(7.8), k(9.7)]);
  cornice(w, 0.1, E1 - 0.1, k(12.9));
}

function risalit(w: Wall, c: number, year: string, G: [number, number], F: [number, number], A: [number, number]) {
  const o = RIS_OUT, top = k(14.5);
  // brick face from the plinth to the risalit cornice, and its block back into the roof (the roof rises 0.43 per metre)
  slab(B, w.f, c, 0.38, RIS_W, k(12.4) - 0.38, o, 'brick');
  slab(B, w.f, c, 0, RIS_W + 0.1, 0.38, o + 0.08, 'stone');
  slab(B, w.f, c, k(12.4) - 0.6, RIS_W, top - k(12.4) + 0.2, o + 3.4, 'brick', -3.4);
  // its flat top (the tent roof was removed) in bitumen, behind the cornice crown
  slab(B, w.f, c, top - 0.4, RIS_W - 0.3, 0.06, 3.0, 'dark', -3.25);
  const rw: Wall = {f: w.f, len: w.len, ops: []};
  win(rw, c, G[0], G[1], 1.8, {cols: 4, rows: 5, transomRow: 4, mullions: 1, out: o});
  salmArch(rw, c, G[1] + 0.1, 2.0, 0.3, o);
  win(rw, c, F[0], F[1], 1.8, {cols: 4, rows: 5, transomRow: 3, mullions: 1, out: o});
  salmArch(rw, c, F[1] + 0.1, 2.0, 0.32, o);
  slab(B, w.f, c, F[0] - 0.2, 2.2, 0.14, 0.16, 'ochre', o);
  // the attic pair under one common arch
  for (const s of [-0.5, 0.5]) win(rw, c + s, A[0], A[1] + 0.15, 0.72, {cols: 2, rows: 2, out: o});
  salmArch(rw, c, A[1] + 0.3, 2.0, 0.35, o);
  slab(B, w.f, c, A[0] - 0.3, 2.3, 0.18, 0.16, 'red', o);
  // the dated gable stone under the first-floor window
  slab(B, w.f, c, k(4.95), 1.25, 0.46, 0.06, 'stone', o);
  letters(B, w.f, year, c, k(4.95) + 0.06, o + 0.06, 0.05, 0.04, 'ochre', 0.045);
  rw.ops.push({t0: c - 0.68, t1: c + 0.68, y0: k(4.95) - 0.02, y1: k(4.95) + 0.48});
  bands(rw, [k(2.0), k(2.95), k(4.85), k(5.86), k(6.8), k(7.8), k(9.7), k(10.3)], {t0: c - RIS_W / 2 + 0.05, t1: c + RIS_W / 2 - 0.05, out: o});
  // the risalit entablature: frieze with consoles under the crown, the crown 0.5 m proud, its top over the eaves
  cornice(w, c - RIS_W / 2 - 0.05, c + RIS_W / 2 + 0.05, top, {consoles: 0.45, out: o, deep: 0.5});
  w.ops.push({t0: c - RIS_W / 2 - 0.1, t1: c + RIS_W / 2 + 0.1, y0: -1, y1: 99});
}

/**
 * The director's wing front (edge 3, w10-30 2024 at 50 px/m, centred): blind souterrain window, the raised ground-floor
 * window between the two big consoles, the stone balcony on them (register: "rijk gedecoreerd natuurstenen balkon ... forse
 * met mannenkoppen gedecoreerde consoles"), the balcony door, the two men's heads in roundels beside it, the attic pair
 * and the cornice on a dentil frieze.
 */
function directorWing() {
  const w = wall(3), c = w.len / 2;
  slab(B, w.f, c, 0, w.len - 0.2, 0.4, 0.16, 'stone');
  win(w, c, k(0.4), k(1.35), 1.9, {cols: 2, rows: 1, glass: 'dark'});
  win(w, c, k(2.7), k(5.3), 1.9, {cols: 2, rows: 3, transomRow: 2, mullions: 1});
  salmArch(w, c, k(5.3) + 0.08, 1.9, 0.25);
  // consoles: tapered stone brackets either side of the window, the men's heads at their foot
  for (const s of [-1, 1]) {
    const t = c + s * 1.55;
    poly(B, w.f, t, k(3.6), [[-0.22, 0], [0.22, 0], [0.22, k(2.0)], [-0.22, k(2.0)]], 0.3, 'ochre');
    poly(B, w.f, t, k(4.6), [[-0.2, 0], [0.2, 0], [0.2, k(1.0)], [-0.2, k(1.0)]], 0.45, 'ochre', 0.3);
    put(B, w.f, new T.SphereGeometry(0.2, 8, 6).scale(1, 1.2, 0.8), t, k(3.85), 0.45, 'ochre');
    w.ops.push({t0: t - 0.25, t1: t + 0.25, y0: k(3.6), y1: k(5.6)});
  }
  // the balcony: slab, closed stone balustrade with a moulded rail
  slab(B, w.f, c, k(5.6), 3.7, 0.3, 0.95, 'ochre');
  slab(B, w.f, c, k(5.6) + 0.3, 3.5, 0.75, 0.12, 'ochre', 0.75);
  for (const s of [-1, 1]) slab(B, w.f, c + s * 1.69, k(5.6) + 0.3, 0.12, 0.75, 0.75, 'ochre');
  slab(B, w.f, c, k(5.6) + 1.05, 3.65, 0.1, 0.95, 'ochre');
  w.ops.push({t0: c - 1.9, t1: c + 1.9, y0: k(5.6), y1: k(5.6) + 1.2});
  win(w, c, k(6.8), k(8.8), 1.9, {cols: 2, rows: 3, transomRow: 2, mullions: 1});
  salmArch(w, c, k(8.8) + 0.08, 1.9, 0.28);
  // the sandstone men's heads in their roundels beside the balcony door
  for (const s of [-2.2, 2.3]) {
    put(B, w.f, new T.CylinderGeometry(0.36, 0.36, 0.08, 14).rotateX(Math.PI / 2).translate(0, 0, 0.04), c + s, k(8.1), 0, 'ochre');
    put(B, w.f, new T.SphereGeometry(0.2, 8, 6).scale(0.85, 1.15, 0.7).translate(0, 0, 0.1), c + s, k(8.1), 0.08, 'ochre');
    w.ops.push({t0: c + s - 0.4, t1: c + s + 0.4, y0: k(8.1) - 0.4, y1: k(8.1) + 0.4});
  }
  for (const s of [-1.9, 1.9]) { win(w, c + s, k(10.0), k(11.3), 0.85, {cols: 2, rows: 2}); salmArch(w, c + s, k(11.3) + 0.06, 0.85, 0.2, 0, false); }
  bands(w, [k(1.8), k(2.4), k(6.2), k(7.3), k(9.4), k(10.3)]);
  for (const t of [0.05, w.len - 0.05]) quoins(w, t, t < 1 ? 1 : -1, 0.45, k(12.0));
  cornice(w, 0, w.len, k(12.9), {consoles: 0.42});
}

/** The inner returns of both wings (edges 0 and 2, w11-299 / w12-119 2021): one first-floor window, a blind arch above. */
function wingReturns() {
  for (const i of [0, 2]) {
    const w = wall(i), c = w.len / 2;
    win(w, c, k(5.8), k(8.6), 1.3, {cols: 2, rows: 4, transomRow: 3});
    salmArch(w, c, k(8.6) + 0.1, 1.3, 0.28);
    // the bricked-up attic opening under its arch
    slab(B, w.f, c, k(10.0), 1.1, k(1.6), 0.05, 'red');
    salmArch(w, c, k(10.0) + k(1.6), 1.1, 0.25, 0, false);
    w.ops.push({t0: c - 0.6, t1: c + 0.6, y0: k(10.0), y1: k(11.6)});
    slab(B, w.f, c, 0, w.len - 0.2, 0.38, 0.1, 'stone');
    bands(w, [k(2.0), k(2.95), k(4.85), k(5.86), k(6.8), k(7.8), k(9.7)]);
    cornice(w, 0, w.len, k(12.9), {consoles: 0.45});
  }
}

/**
 * The NW side of the director's wing (edge 4): behind the 2010s university block, seen only at its corner in w05-300
 * (2018, 2024): speklagen, quoins and the cornice; the windows are inferred from the register ("functionele
 * gevelcompositie") as four axes at the wing's floor levels.
 */
function salmSide() {
  const w = wall(4);
  for (const t of [2.4, 6.6, 12.4, 16.6]) {
    win(w, t, k(2.7), k(5.3), 1.5, {cols: 2, rows: 3, transomRow: 2, out: 0.15});
    salmArch(w, t, k(5.3) + 0.08, 1.5, 0.25, 0.15);
    win(w, t, k(6.8), k(8.8), 1.5, {cols: 2, rows: 3, transomRow: 2, out: 0.15});
    salmArch(w, t, k(8.8) + 0.08, 1.5, 0.25, 0.15);
    win(w, t, k(10.0), k(11.3), 0.85, {cols: 2, rows: 2, out: 0.15});
  }
  // the scanned wall stands 0.11 m proud over t 10.4-13.8: every course and the plinth stand 0.12 m out to clear it
  bands(w, [k(1.8), k(2.4), k(6.2), k(7.3), k(9.4), k(10.3)], {out: 0.12});
  for (const t of [0.05, w.len - 0.05]) quoins(w, t, t < 1 ? 1 : -1, 0.45, k(12.0), 0.12);
  slab(B, w.f, w.len / 2, 0, w.len - 0.2, 0.4, 0.1, 'stone', 0.12);
  cornice(w, 0, w.len, k(12.9), {out: 0.12});
}

// ---- edge 19: the 1934 SE wing, the link and B.J. Ouendag's 1926 block (w02-30 2023) --------------------------------

function edge19() {
  const w = wall(19);
  // the Salm SE wing (t 29.7-37.2): three axes of coupled windows (1934), the deep portico with the stone steps and the
  // strip of transoms over it at the NW end (w11-299 shows the recess at the corner)
  const c = 33.45;
  for (const t of [c - 1.8, c, c + 1.8]) {
    win(w, t, k(5.8), k(8.6), 1.3, {cols: 2, rows: 4, transomRow: 3});
    salmArch(w, t, k(8.6) + 0.1, 1.3, 0.25);
    win(w, t, k(10.3), k(11.6), 1.2, {cols: 2, rows: 2});
  }
  // portico: a dark recess with the two pairs of varnished doors, the concrete lintel and the transom strip over it
  // the recess reads dark round the doors; the leaves stand in it (no dark sheet behind them, which the audit reads as buried)
  for (const [a, c] of [[31.9, 32.35], [33.85, 34.55], [36.05, 36.5]]) slab(B, w.f, (a + c) / 2, 0.3, c - a, k(2.6) - 0.3, 0.06, 'dark', 0.1);
  slab(B, w.f, 34.2, k(2.3), 4.6, k(2.6) - k(2.3), 0.06, 'dark', 0.1);
  for (const t of [33.1, 35.3]) slab(B, w.f, t, 0.3, 1.5, k(2.3) - 0.3, 0.06, 'bronze', 0.1);
  slab(B, w.f, 34.2, 0, 5.0, 0.3, 0.6, 'stone');
  slab(B, w.f, 34.2, k(2.6), 5.0, 0.28, 0.2, 'concrete');
  for (let j = 0; j < 4; j++) win(w, 32.5 + j * 1.15, k(3.0), k(3.8), 0.95, {cols: 2, rows: 1});
  w.ops.push({t0: 31.6, t1: 36.8, y0: 0, y1: k(2.6) + 0.3});
  bands(w, [k(2.95), k(4.85), k(5.86), k(6.8), k(7.8), k(9.7)], {t0: 29.9, t1: 37.0});
  quoins(w, 29.75, 1, 0.4, k(12.2));
  slab(B, w.f, 31.5, 0, 3.4, 0.38, 0.1, 'stone');
  cornice(w, 29.6, 37.2, k(12.9), {consoles: 0.45});

  // Ouendag (t 0-29.7; door axis 11.5, axes every 4.0 m): natural-stone plinth, three-light sash windows on two floors, the
  // strip of small sashes on the top floor, the arched door with the stair strip over it, the dark brick cornice band
  const DOOR = 11.5, axes = [3.4, 7.45, 15.55, 19.55, 23.55, 27.45];
  for (const [a, c] of [[0.2, DOOR - 1.2], [DOOR + 1.2, 29.6]]) slab(B, w.f, (a + c) / 2, 0, c - a, 1.0, 0.18, 'stone');
  for (const t of axes) {
    win(w, t, 2.6, 5.6, 2.7, {cols: 9, rows: 5, transomRow: 4, mullions: 2});
    win(w, t, 8.3, 11.2, 2.7, {cols: 9, rows: 5, transomRow: 4, mullions: 2});
    slab(B, w.f, t, 2.45, 2.9, 0.12, 0.14, 'concrete');
    slab(B, w.f, t, 8.15, 2.9, 0.12, 0.14, 'concrete');
  }
  // top-floor strip: eleven small sashes over the link and the right half, mirrored on the occluded left half
  for (let j = 0; j < 11; j++) win(w, 15.1 + j * 1.32, 12.8, 14.5, 0.95, {cols: 2, rows: 3, transomRow: 2});
  for (let j = 0; j < 6; j++) win(w, 1.2 + j * 1.32, 12.8, 14.5, 0.95, {cols: 2, rows: 3, transomRow: 2});
  slab(B, w.f, 15.1 + 6.6, 12.62, 14.9, 0.12, 0.12, 'concrete');
  // the stair axis: the tall arched door between brick lisenen, the stair strips over it
  // register: a varnished double door with glazing bars, under a fanlight in the arch
  slab(B, w.f, DOOR, 0.3, 2.0, 3.1, 0.14, 'bronze');
  segment(w.f, DOOR, 3.4, 2.2, 0.55, 0.08, 'glass');
  slab(B, w.f, DOOR, 0, 2.4, 0.3, 0.5, 'stone');
  segment(w.f, DOOR, 3.4, 2.5, 0.65, 0.12, 'greyBrick');
  for (const s of [-1.45, 1.45]) slab(B, w.f, DOOR + s, 1.0, 0.35, 14.0, 0.12, 'greyBrick');
  for (const [y0, y1] of [[6.4, 8.4], [9.9, 11.9], [13.2, 14.4]]) for (const s of [-0.3, 0.3]) win(w, DOOR + s, y0, y1, 0.45, {cols: 1, rows: 3});
  slab(B, w.f, 14.8, 15.0, 29.5, 0.6, 0.12, 'red');
}

// ---- the 1934 block -----------------------------------------------------------------------------------------------------

/**
 * Street front (edges 13-17, w08-28 2021; heights scaled to the 10.4 m roof, t as a fraction of the 13.9 m front): the
 * strip of five coupled windows under a concrete hood, the strip of five transoms between brick piers under a concrete
 * ledge, the door under its hood, the green-patinated coping. The 3DBAG front steps back 0.2-0.7 m over its last 4.3 m;
 * the photo reads one flush plane, so that part is faced flush with the first.
 */
function front1934() {
  const w = wall(13), L = 13.9;
  slab(B, w.f, (w.len + L) / 2, 0, L - w.len + 0.1, 10.25, 0.75, 'greyBrick', -0.75);
  const at = (frac: number) => frac * L;
  // the strip must stay on the scanned 9.6 m plane (the openings audit reads the wall silhouette, not the facing): it is
  // drawn 1.4 m left of the photo's position, from t 0.9 to 9.4
  for (let j = 0; j < 5; j++) win(w, 1.6 + j * 1.66, 5.67, 7.6, 1.56, {cols: 2, rows: 2, transomRow: 1, out: 0.05});
  slab(B, w.f, 4.92, 7.7, 8.7, 0.14, 0.3, 'concrete');
  for (let j = 0; j < 5; j++) win(w, at(0.1 + j * 0.163), 3.29, 4.04, 1.75, {cols: 1, rows: 1});
  slab(B, w.f, at(0.47), 4.15, at(0.9), 0.12, 0.3, 'concrete');
  slab(B, w.f, at(0.47), 0.75, 1.8, 1.45, 0.05, 'bronze');
  slab(B, w.f, at(0.47), 0, 2.2, 0.75, 0.5, 'stone');
  slab(B, w.f, at(0.47), 2.3, 2.6, 0.12, 0.35, 'concrete');
  slab(B, w.f, L / 2, 10.0, L, 0.2, 0.14, 'copper');
}

/**
 * The canal side of the 1934 block (edge 9, w07-210 2017 at 50 px/m, heights x 0.937 to the 10.4 m roof): grey plinth on
 * the water, the glazed stair column with its red blind, the concrete frame round the three-window band, the strip of
 * three under it, and the row of six small transoms.
 */
function canal1934() {
  const w = wall(9), s = 0.937;
  slab(B, w.f, w.len / 2, 0, w.len - 0.1, 1.2 * s, 0.1, 'stone');
  // the glazed stair column (t 0.8-3.7)
  win(w, 2.25, 3.1 * s, 8.3 * s, 2.8, {cols: 3, rows: 5});
  blind(w, 2.25, 8.3 * s - 0.6, 2.8);
  // the concrete frame round the upper band
  slab(B, w.f, 9.75, 6.0 * s, 8.7, 0.22, 0.16, 'concrete');
  slab(B, w.f, 9.75, 8.75 * s, 8.7, 0.22, 0.16, 'concrete');
  for (const t of [5.5, 8.42, 11.08, 14.0]) slab(B, w.f, t, 6.0 * s, 0.28, 2.95 * s, 0.16, 'concrete');
  for (const t of [7.0, 9.75, 12.5]) win(w, t, 6.4 * s, 8.6 * s, 2.3, {cols: 3, rows: 2, transomRow: 1});
  for (const t of [7.0, 9.75, 12.5]) win(w, t, 4.3 * s, 5.1 * s, 2.3, {cols: 3, rows: 1});
  for (let j = 0; j < 6; j++) win(w, 6.3 + j * 1.35, 2.0 * s, 2.8 * s, 1.0, {cols: 1, rows: 1});
  slab(B, w.f, 9.75, 1.85 * s, 8.4, 0.1, 0.12, 'concrete');
}

/** The SE end of the 1934 block (edge 10): inferred from the register (a strip of coupled sashes on the side too) and w06. */
function end1934() {
  const w = wall(10);
  slab(B, w.f, w.len / 2, 0, w.len - 0.1, 1.0, 0.1, 'stone');
  for (let j = 0; j < 5; j++) win(w, 4.4 + j * 2.5, 5.67, 7.6, 2.0, {cols: 2, rows: 2, transomRow: 1});
  slab(B, w.f, 9.4, 7.7, 13.0, 0.14, 0.3, 'concrete');
  for (let j = 0; j < 6; j++) win(w, 3.6 + j * 2.3, 3.29, 4.04, 1.6, {cols: 1, rows: 1});
  slab(B, w.f, 0.4, 0, 0.5, 10.2, 0.14, 'concrete');
}

// ---- the canal front (edge 5, from the NW) ------------------------------------------------------------------------------

/** w01-210: heights y = 14.5 - (zy - 45) / 60.5 in the 1.75x zooms of the 2017 view (wing coping 14.5 m, the quay at 0.4 m). */
function canalFront() {
  const w = wall(5);
  slab(B, w.f, w.len / 2, 0, w.len - 0.2, 0.45, 0.14, 'stone');
  // A: the rear of the director's wing (t 0-6.95): rows at 3.0-5.6, 6.8-9.2, 10.5-11.8, the basement 0.5-1.7, heavy
  // quoins and speklagen, a carved cornice with consoles
  for (const t of [1.6, 4.9]) {
    win(w, t, 0.55, 1.6, 1.2, {cols: 2, rows: 1});
    win(w, t, 3.0, 5.6, 1.25, {cols: 2, rows: 3, transomRow: 2});
    win(w, t, 6.8, 9.2, 1.25, {cols: 2, rows: 3, transomRow: 2});
    win(w, t, 10.5, 11.8, 0.95, {cols: 2, rows: 2});
  }
  slab(B, w.f, 3.45, 2.3, 6.6, 0.22, 0.2, 'ochre');
  bands(w, [1.5, 3.4, 4.5, 6.2, 10.1, 10.8], {t0: 0.1, t1: 6.85});
  quoins(w, 0.05, 1, 0.5, 12.4);
  quoins(w, 6.9, -1, 0.5, 12.4);
  cornice(w, 0, 7.0, 13.8, {consoles: 0.45});
  // B: the rear of the Salm main body (t 6.95-12.2): two axes, plain cornice
  for (const t of [8.4, 11.1]) {
    win(w, t, 1.4, 3.8, 1.3, {cols: 2, rows: 3, transomRow: 2});
    win(w, t, 6.2, 8.9, 1.3, {cols: 2, rows: 3, transomRow: 2});
    win(w, t, 10.7, 12.5, 1.3, {cols: 2, rows: 2});
  }
  blind(w, 8.4, 3.55, 1.3);
  bands(w, [1.4, 5.2, 6.1, 10.0], {t0: 7.05, t1: 12.15});
  slab(B, w.f, 9.6, 13.2, 5.3, 0.25, 0.25, 'ochre');
  // C: the stair tower (t 12.2-18.5): two windows at the top, three rows of three small lights, the concrete canopy over
  // the basement lights at the quay
  for (const t of [13.4, 15.8]) win(w, t, 11.7, 13.0, 0.75, {cols: 2, rows: 2});
  for (const [y0, y1] of [[8.9, 10.3], [5.8, 7.5], [4.1, 5.3]]) for (const t of [13.4, 14.8, 16.2]) win(w, t, y0, y1, 0.65, {cols: 2, rows: 2});
  slab(B, w.f, 15.35, 1.5, 6.2, 1.9, 1.0, 'concrete');
  // D: the three-storey canal wing on the former playground (t 18.7-45.7): seven axes, doors at both ends, speklagen at
  // the sills and over the ground floor, the red sun blinds of 2021
  const D = [20.8, 24.6, 28.4, 32.3, 36.1, 39.9, 43.7];
  for (const t of D) {
    win(w, t, 10.6, 13.5, 1.9, {cols: 4, rows: 5, transomRow: 3, mullions: 1});
    win(w, t, 6.0, 8.7, 1.9, {cols: 4, rows: 5, transomRow: 3, mullions: 1});
    if (t === 20.8 || t === 43.7) door(w, t, 0.45, 3.6, 1.5, t === 20.8);
    else win(w, t, 1.2, 3.9, 1.9, {cols: 4, rows: 5, transomRow: 3, mullions: 1});
  }
  for (const t of [20.8, 28.4, 32.3, 36.1, 43.7]) blind(w, t, 12.9, 1.9);
  for (const t of [20.8, 24.6, 28.4, 32.3, 36.1]) blind(w, t, 8.1, 1.9);
  for (const t of [24.6, 32.3, 36.1, 39.9]) blind(w, t, 3.3, 1.9);
  bands(w, [1.05, 4.95, 5.85, 7.9], {t0: 18.8, t1: 45.6});
  // E: the second stair tower (t 45.7-51.0)
  for (const [y0, y1] of [[11.6, 13.4], [7.2, 9.1], [2.9, 4.7]]) for (const t of [47.3, 48.4, 49.5]) win(w, t, y0, y1, 0.85, {cols: 2, rows: 3});
  slab(B, w.f, 48.35, 1.5, 5.2, 1.8, 1.0, 'concrete');
  // F: two axes with garden doors (t 51.0-56.9)
  for (const t of [52.1, 55.4]) {
    win(w, t, 10.5, 12.4, 1.5, {cols: 2, rows: 3, transomRow: 2});
    win(w, t, 6.0, 8.7, 1.5, {cols: 2, rows: 4, transomRow: 3});
    win(w, t, 0.45, 3.0, 1.5, {cols: 2, rows: 3, mullions: 1});
    blind(w, t, 2.45, 1.5);
  }
  blind(w, 52.1, 11.85, 1.5);
  bands(w, [1.05, 5.1, 5.85, 9.6, 10.25], {t0: 51.05, t1: 56.85});
  // G: the rear of the Salm SE wing (t 56.9-65.3): narrow-wide-narrow windows on two floors, the strip of small basement
  // lights, quoins and the carved cornice on its consoles
  for (const [t, ww] of [[59.1, 0.8], [61.3, 2.0], [63.3, 0.8]] as [number, number][]) {
    win(w, t, 8.6, 11.6, ww, {cols: ww > 1 ? 3 : 1, rows: 4, transomRow: 3});
    win(w, t, 3.8, 7.0, ww, {cols: ww > 1 ? 3 : 1, rows: 4, transomRow: 3});
  }
  for (let j = 0; j < 8; j++) win(w, 58.15 + j * 0.92, 1.4, 2.6, 0.5, {cols: 1, rows: 1});
  bands(w, [1.1, 3.2, 7.6, 12.0], {t0: 57.0, t1: 65.2});
  quoins(w, 57.0, 1, 0.5, 12.6);
  quoins(w, 65.2, -1, 0.5, 12.6);
  cornice(w, 56.9, 65.3, 13.7, {consoles: 0.45});
  // H: the rear of the Ouendag block (t 65.3-85.8): three rows of large sashes, coupled on the top floor, brick lisenen,
  // basement lights at the quay
  const H3 = [67.0, 69.0, 70.9, 75.1, 77.2, 79.2, 83.4], H = [67.0, 70.9, 75.5, 79.0, 83.4];
  for (const t of H3) win(w, t, 11.7, 14.8, 1.6, {cols: 3, rows: 5, transomRow: 3});
  for (const t of H) {
    win(w, t, 6.1, 9.1, 1.8, {cols: 3, rows: 5, transomRow: 3});
    win(w, t, 1.4, 4.5, 1.8, {cols: 3, rows: 5, transomRow: 3});
    win(w, t, 0.5, 0.95, 0.9, {cols: 1, rows: 1, glass: 'dark'});
    slab(B, w.f, t, 1.22, 2.0, 0.12, 0.14, 'concrete');
  }
  for (const t of [67.0, 79.0]) blind(w, t, 3.9, 1.8);
  for (const [a, c] of [[73.2, 74.2], [80.9, 81.5]]) slab(B, w.f, (a + c) / 2, 0.45, c - a, 15.4, 0.14, 'greyBrick');
}

/** A garden or quay door (dark green-grey, two leaves), optionally under a segmental arch. */
function door(w: Wall, t: number, y0: number, y1: number, width: number, arched: boolean, out = 0.15) {
  // the leaves in the opening, the cream frame round them (jambs and head, so no frame hides behind the leaves)
  slab(B, w.f, t, y0, width - 0.06, y1 - y0 - 0.05, 0.08, 'dark', out);
  for (const s of [-1, 1]) slab(B, w.f, t + s * (width / 2 - 0.02), y0 - 0.05, 0.1, y1 - y0 + 0.1, 0.12, "frame", out);
  slab(B, w.f, t, y1 - 0.05, width + 0.12, 0.1, 0.12, 'frame', out);
  slab(B, w.f, t, y0, 0.06, y1 - y0 - 0.1, 0.12, "frame", out);
  if (arched) segment(w.f, t, y1 + 0.05, width + 0.3, 0.25, 0.06, 'red');
  w.ops.push({t0: t - width / 2 - 0.12, t1: t + width / 2 + 0.12, y0: y0 - 0.1, y1: y1 + 0.35});
}

/** The low lab bay on the water (edge 7, w09-210 2017, 50 px/m, x 1.04 to the 16.1 m roof). */
function labBay() {
  const w = wall(7), s = 1.04;
  slab(B, w.f, w.len / 2, 0, w.len - 0.1, 1.0, 0.12, 'stone');
  win(w, 3.8, 2.2 * s, 5.9 * s, 6.0, {cols: 6, rows: 3, transomRow: 2});
  slab(B, w.f, 3.8, 2.05 * s, 6.3, 0.12, 0.16, 'concrete');
  slab(B, w.f, w.len / 2, 7.4 * s, w.len - 0.1, 0.16, 0.3, 'concrete');
  for (const t of [2.5, 5.9]) win(w, t, 7.75 * s, 10.2 * s, 2.1, {cols: 4, rows: 4, transomRow: 2});
  blind(w, 5.9, 9.65 * s, 2.1);
  for (const t of [2.2, 4.2, 6.1]) win(w, t, 11.7 * s, 14.6 * s, 1.6, {cols: 3, rows: 5, transomRow: 3});
  blind(w, 6.1, 14.05 * s, 1.6);
}

