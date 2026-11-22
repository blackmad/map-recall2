import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, facePanel, getSink, ledgeStrip, poly, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import source from './muziekschool-jacob-van-campen-footprints.json';

/**
 * FORMER OPENBARE MUZIEKSCHOOL (the Jacob van Campenschool), Eerste Jacob van Campenstraat 59 / Ferdinand Bolstraat,
 * De Pijp (BAG pand 0363100012228680, BAG year 1900; gemeentelijk monument). Register: built 1882 by the Dienst der
 * Publieke Werken as a third-class boys' school; an L-plan corner building of two storeys under a mansard roof of
 * dark-grey tiles; the front (S, seven axes) and the side (E, seven axes) in red and yellow brick on a red brick plinth,
 * bluestone string courses at the floors, a classical dentil cornice under the projecting eaves; four colossal
 * yellow-brick lisenen per front: at the corners and flanking the entrance on the front, marking the classrooms on the
 * side; a round-arched entrance with a pediment (fronton) in the eaves line over the middle axis and a natural-stone
 * balustrade over the entrance under the first-floor window; rectangular windows with glazing bars (a 2x3 hopper over the
 * transom, 3x3 below); on the first floor only, the windows stand in round arches with stuccoed blind tympana carrying a
 * plant-motif relief and a keystone; on the side a dormer in the middle under a pediment with two volutes.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (walls to 11.4-11.8 m, the mansard to 14.9 m, the side dormer to 14.8 m).
 * The "curved corner" of the aimed panorama crops is lens bowing: BAG and 3DBAG have a square corner. Fronts read from the
 * rectified Gemeente Amsterdam panoramas (CC BY 4.0); t is metres along each facade-ring edge from the viewer's left
 * (ringFrame):
 *  - the front (edge 10, 20.0 m, faces S): w02-185.alt (TMX7316010203-002455_pano_0001_000826, 2022), 50 px/m across,
 *    51.5 px/m up from the pavement (the plinth band agrees with the side), checked against w02-185 (2021);
 *  - the side (edge 11, 22.6 m, faces E): w01-96 (recording_2024-09-04_05-35-54_04499, 2024), 48 px/m.
 * The rear walls (edges 0-9) stand in the block's courtyard and against the neighbours: plain shell brick.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;

/** Storey heights (m above the pavement), shared by both fronts (w02-185.alt and w01-96 agree within 0.1 m). */
const H = {
  base: 0.6, plinthBand: 1.4, g0: 1.6, g1: 4.52, frieze: 4.56, friezeTop: 4.95, course: 5.09, courseTop: 5.44,
  panel: 5.63, panelTop: 6.21, sill: 6.28, f0: 6.4, f1: 9.17, impost: 9.5, archTop: 10.68, consoles: 10.78,
  dentils: 11.15, crown: 11.55, top: 12.0,
};
const WIN = 1.25;

export function buildMuziekschoolJacobVanCampen(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    // the side dormer's walls (above the eaves) are painted white like its pediment
    wallFor: s => (minY(s) > 11.6 ? 'stone' : 'brick'),
  });
  const sink0 = getSink();
  setSink(0.12, true);
  front();
  side();
  setSink(sink0);
}

function minY(s: Surface) { return Math.min(...s.rings[0].map(p => p[1])); }

// ---- kit -------------------------------------------------------------------------------------------------------------

/** White timber window: frame, pane and glazing bars (3 x 5 panes, transom over the third row: 3x3 sashes, 2x3 hopper). */
function win(f: Frame, t: number, y0: number, y1: number, width: number, o: {cols?: number; rows?: number; transomRow?: number; sill?: boolean} = {}) {
  const h = y1 - y0;
  slab(B, f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.08, 'frame');
  slab(B, f, t, y0 + 0.05, width - 0.1, h - 0.1, 0.04, 'glass', 0.08);
  const grid = paneGrid({width: width - 0.1, height: h - 0.1, cols: o.cols ?? 3, rows: o.rows ?? 5, bar: 0.045, frame: 0, transomRows: [o.transomRow ?? 3], transom: 0.1});
  for (const m of grid) facePanel(B, f, t + m.x, y0 + 0.05 + m.y, m.w, m.h, 'frame', 0.16);
  // the stone sill
  if (o.sill ?? true) slab(B, f, t, y0 - 0.14, width + 0.3, 0.1, 0.16, 'stone');
}

/** Yellow-brick lisene (colossal pilaster), rusticated: blocks with red joints from y0 to y1, a capital block on top. */
function lisene(f: Frame, t: number, y0: number, y1: number, w = 0.75, o: {phase?: number; cap?: boolean} = {}) {
  for (let y = y0 + (o.phase ?? 0); y + 0.3 <= y1 - 0.15; y += 0.52) slab(B, f, t, y, w, Math.min(0.46, y1 - 0.15 - y), 0.12, 'ochre');
  if (o.cap ?? true) slab(B, f, t, y1 - 0.12, w + 0.12, 0.16, 0.2, 'ochre');
}

/**
 * First-floor window head (register: "in rondbogen met gepleisterde blindvelden, voorzien van reliefs met plantmotieven
 * en een sluitsteen"): a yellow-brick round arch springing from the impost band, the stuccoed tympanum over the window
 * head, its relief (a rosette here) and the keystone.
 */
function blindArch(f: Frame, t: number, width: number) {
  const outer = width + 0.5, th = 0.22;
  archBand(B, f, t, H.impost + 0.15, outer, H.archTop - H.impost - 0.15, th, 0.08, 'ochre', 0, 12);
  const inner = outer - 2 * th;
  archSlab(B, f, t, H.f1 + 0.08, inner, H.archTop - th - H.f1 - 0.08, 0.05, 'concrete', 0, 12);
  disc(B, f, t, H.f1 + 0.08 + (H.archTop - th - H.f1) * 0.55, 0.2, 0.05, 'stone', 0.05);
  slab(B, f, t, H.archTop - 0.3, 0.26, 0.45, 0.14, 'ochre');
}

/** Framed panel under a first-floor window: a yellow-brick frame round a red brick field. */
function sillPanel(f: Frame, t: number, width: number) {
  // the frame as four strips: the field between them is the wall's own brick
  const h = H.panelTop - H.panel, fw = 0.09;
  slab(B, f, t, H.panel, width + 0.1, fw, 0.05, 'ochre');
  slab(B, f, t, H.panelTop - fw, width + 0.1, fw, 0.05, 'ochre');
  for (const s of [-1, 1]) slab(B, f, t + s * (width / 2 + 0.05 - fw / 2), H.panel + fw, fw, h - 2 * fw, 0.05, 'ochre');
}

/** The bands that run across a whole front: painted base, plinth band, yellow frieze, bluestone course, sill band, impost. */
function bands(f: Frame, t0: number, t1: number, gaps: [number, number][], arches: [number, number][]) {
  const runs = (a: number, c: number, gs: [number, number][]) => {
    const out: [number, number][] = [];
    let s = a;
    for (const [g0, g1] of [...gs].sort((x, y) => x[0] - y[0])) { if (g0 > s) out.push([s, Math.min(g0, c)]); s = Math.max(s, g1); }
    if (s < c) out.push([s, c]);
    return out;
  };
  for (const [a, c] of runs(t0, t1, gaps)) {
    slab(B, f, (a + c) / 2, 0, c - a, H.base, 0.06, 'greyBrick');
    ledge(f, a, c, H.plinthBand, 0.12, 0.17);
  }
  const L = t1 - t0, c = (t0 + t1) / 2;
  slab(B, f, c, H.frieze, L, H.friezeTop - H.frieze, 0.05, 'ochre');
  ledge(f, t0, t1, H.course, H.courseTop - H.course, 0.2);
  ledge(f, t0, t1, H.sill - 0.04, 0.1, 0.07);
  // the impost band stops at each tympanum (it would cross the stucco field)
  for (const [a, e] of runs(t0, t1, arches)) slab(B, f, (a + e) / 2, H.impost, e - a, 0.15, 0.05, 'ochre');
}
/** A stone ledge (front and top faces) in pieces of at most 10 m: a long open strip fails the holes gate. */
function ledge(f: Frame, a: number, c: number, y: number, h: number, d: number) {
  const n = Math.ceil((c - a) / 10), L = (c - a) / n;
  for (let j = 0; j < n; j++) ledgeStrip(B, f, a + L * (j + 0.5), y, L - 0.02, h, d, 'stone');
}
const archGaps = (ts: number[], widths: (t: number) => number): [number, number][] => ts.map(t => [t - (widths(t) + 0.5) / 2 + 0.22, t + (widths(t) + 0.5) / 2 - 0.22]);

/** The classical cornice: frieze with consoles, the dentil course and the projecting crown, from t0 to t1. */
function cornice(f: Frame, t0: number, t1: number, consoles: number[], dy = 0) {
  const L = t1 - t0, c = (t0 + t1) / 2;
  // layers 2 cm apart in height, so no top lies on the bottom of the layer above
  slab(B, f, c, H.consoles + dy, L, H.dentils - H.consoles - 0.02, 0.1, 'stone');
  for (const x of consoles) slab(B, f, x, H.consoles - 0.1 + dy, 0.22, H.dentils - H.consoles + 0.06, 0.3, 'stone');
  slab(B, f, c, H.dentils + dy, L, H.crown - H.dentils - 0.02, 0.22, 'stone');
  for (let x = t0 + 0.12; x <= t1 - 0.1; x += 0.24) slab(B, f, x, H.dentils + 0.06 + dy, 0.11, 0.24, 0.32, 'stone');
  slab(B, f, c, H.crown + dy, L, H.top - H.crown, 0.62, 'stone');
}

// ---- the front (edge 10, faces S) ------------------------------------------------------------------------------------

/** Front axes, symmetric about the entrance (w02-185.alt: 50 px/m; the left corner lisene is cut 0.35 m short, so the door axis at px 491 is t 10.2 and the front is symmetric on its 20.0 m: t 10.0). */
const C = 10.0;
const F_WIN = [-7.9, -5.63, -3.41, 3.41, 5.63, 7.9].map(d => C + d);
/** The corner lisenen are 0.9 m wide, reaching 0.15 m past each corner so no face lies in the side walls' planes. */
const F_LIS = [0.3, C - 1.77, C + 1.77, 19.7];

function front() {
  const {f, len} = ringFrame(ring, 10);
  // the cornice runs past the SE corner over the side's crown; the side's stops short of it
  const DOOR_GAP: [number, number] = [C - 1.3, C + 1.3];
  bands(f, -0.1, len + 0.1, [DOOR_GAP], archGaps([...F_WIN, C], t => (t === C ? 1.56 : WIN)));
  for (const t of F_WIN) {
    win(f, t, H.g0, H.g1, WIN);
    win(f, t, H.f0, H.f1, WIN, {sill: false});
    sillPanel(f, t, WIN);
    blindArch(f, t, WIN);
  }
  // the middle axis: the round-arched entrance, the balustrade, the wider first-floor window under its arch
  entrance(f);
  win(f, C, H.f0, H.f1, 1.56, {cols: 4, sill: false});
  blindArch(f, C, 1.56);
  const bal = balustrade({width: 1.64, height: H.sill - H.courseTop, post: 0.2, plinth: 0.1, rail: 0.12, baluster: 0.16, pitch: 0.26});
  const y0 = H.courseTop;
  slab(B, f, C, y0, bal.plinth.x1 - bal.plinth.x0, bal.plinth.h, 0.24, 'stone');
  slab(B, f, C, y0 + bal.rail.y, bal.rail.x1 - bal.rail.x0, bal.rail.h, 0.26, 'stone');
  for (const p of bal.posts) slab(B, f, C + p.x, y0 + bal.plinth.h, p.w, p.h - bal.plinth.h - bal.rail.h, 0.22, 'stone');
  for (const s of bal.balusters) {
    slab(B, f, C + s.x, y0 + s.y, s.w * 0.55, s.h, 0.16, 'stone', 0.03);
    slab(B, f, C + s.x, y0 + s.y + s.h * 0.2, s.w, s.h * 0.45, 0.2, 'stone', 0.01);
  }
  for (const t of F_LIS) lisene(f, t, H.base, H.archTop, t < 1 || t > 19 ? 0.9 : 0.75);
  cornice(f, -0.1, len + 0.62, [...F_WIN, C, ...F_LIS]);
  // the pediment over the middle axis, in the eaves line (base 5.4 m, apex 13.2 m)
  poly(B, f, C, H.top, [[-2.7, 0], [2.7, 0], [0, 1.2]], 0.9, 'stone', -0.3);
  poly(B, f, C, H.top + 0.18, [[-2.2, 0], [2.2, 0], [0, 0.82]], 0.06, 'concrete', 0.6);
}

/** The round-arched entrance: yellow jamb piers with stone caps, a heavy yellow arch, keystone, fanlight and double door. */
function entrance(f: Frame) {
  const spring = 3.15, open = 1.4;
  for (const s of [-1, 1]) {
    slab(B, f, C + s * (open / 2 + 0.3), H.base, 0.6, spring - H.base - 0.1, 0.15, 'ochre');
    slab(B, f, C + s * (open / 2 + 0.3), spring - 0.12, 0.72, 0.16, 0.16, 'stone');
    slab(B, f, C + s * (open / 2 + 0.02), 0, 0.1, spring + 0.1, 0.1, 'frame');
  }
  archBand(B, f, C, spring, 2.6, 1.3, 0.55, 0.1, 'ochre', 0, 14);
  slab(B, f, C, 3.9, 0.36, 0.66, 0.2, 'stone');
  // door leaves (varnished dark) and the fanlight with its radiating bars
  // w02-185.alt: varnished leaves glazed in their upper two thirds, a middle stile
  slab(B, f, C, 0, open - 0.1, 1.0, 0.06, 'dark');
  slab(B, f, C, 1.0, open - 0.1, 1.85, 0.04, 'glass', 0.02);
  for (const a of [-0.6, 0, 0.6]) facePanel(B, f, C + a, 1.0, 0.08, 1.85, 'dark', 0.07);
  facePanel(B, f, C, 1.9, open - 0.1, 0.07, 'dark', 0.07);
  slab(B, f, C, 2.85, open, 0.1, 0.1, 'frame');
  archSlab(B, f, C, 2.95, open - 0.1, spring + 0.65 - 2.95, 0.04, 'glass', 0.02, 12);
  for (const a of [-0.35, 0, 0.35]) facePanel(B, f, C + a, 2.95, 0.045, a === 0 ? 0.68 : 0.55, 'frame', 0.07);
}

// ---- the side (edge 11, faces E) ---------------------------------------------------------------------------------------

/** Side axes, symmetric about the dormer (w01-96, 48 px/m): three classrooms between the lisenen. */
const CS = 11.2;
const S_WIN = [-9.0, -6.45, -2.72, 0, 2.72, 6.45, 9.0].map(d => CS + d);
const S_LIS = [CS - 4.83, CS + 4.83, 22.3];

function side() {
  const {f, len} = ringFrame(ring, 11);
  const door = S_WIN[6];
  bands(f, 0.7, len + 0.1, [[door - 0.85, door + 0.85]], archGaps(S_WIN, () => WIN));
  S_WIN.forEach((t, i) => {
    if (i === 6) win(f, t, H.base, H.g1, 1.4, {cols: 2, rows: 6, transomRow: 4});
    else win(f, t, H.g0, H.g1, WIN);
    win(f, t, H.f0, H.f1, WIN, {sill: false});
    sillPanel(f, t, WIN);
    blindArch(f, t, WIN);
  });
  for (const t of S_LIS) lisene(f, t, H.base, H.archTop, t > 22 ? 0.9 : 0.75);
  // the SE corner lisene's side face: blocks staggered against the front's so no block tops are coplanar
  lisene(f, 0.39, H.base, H.archTop, 0.72, {phase: 0.26, cap: false});
  // 4 cm lower than the front's, whose end runs over the corner: no coplanar tops where the two overlap
  cornice(f, 0, len + 0.1, [...S_WIN, ...S_LIS], -0.04);
  dormer(f);
}

/** The side dormer: a white timber front on the facade line with a pediment and two volutes (w01-96: 2.1 m wide). */
function dormer(f: Frame) {
  const y0 = H.top, w = 2.1;
  slab(B, f, CS, y0, w, 2.0, 0.05, 'stone');
  win(f, CS, 12.4, 13.75, 0.95, {cols: 2, rows: 3, transomRow: 2});
  slab(B, f, CS, 14.0, w + 0.3, 0.3, 0.3, 'stone');
  poly(B, f, CS, 14.3, [[-1.15, 0], [1.15, 0], [0, 0.75]], 0.25, 'stone');
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const a = (Math.PI / 2) * i / 8; pts.push([s * (0.45 * Math.cos(a)), 0.95 * Math.sin(a)]); }
    pts.push([0, 0]);
    poly(B, f, CS + s * w / 2, y0, s > 0 ? pts : pts.reverse(), 0.1, 'stone');
  }
}
