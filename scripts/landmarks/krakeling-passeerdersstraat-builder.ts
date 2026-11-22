import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, facePanel, getSink, ledgeStrip, poly, put, ringFrame, roofHeightAt, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import {speklagen, type BandOpening} from '../../src/canalRecall/landmarks/speklagen';
import source from './krakeling-passeerdersstraat-footprints.json';

/**
 * FORMER TURNZAAL (gymnasium) of the Maatschappij voor Turngebouwen, Nieuwe Passeerdersstraat 1 / Marnixstraat 344-346 /
 * Leidsekade 49-51 (BAG pand 0363100012174374, BAG 1887; rijksmonument 518465). Register: a U-shaped complex of red brick in
 * Neo-Hollandse Renaissance by J. Ingenohl and K. Muller, 1886-87 (opened 19 November 1887): the turnzaal with side rooms set
 * back on the Nieuwe Passeerdersstraat (eight window axes, the two middle ones under a stepped gable, buttresses), and the
 * dwelling wings on the Marnixstraat and the Leidsekade (five axes with corner risalits, gables and dormers; a portico in
 * the Leidsekade's middle axis); paired, round- and trefoil-arched windows and cross windows; pantiled saddle roofs. Home of
 * the children's theatre De Krakeling from April 1978 until July 2020 (the theatre now plays in the Westergastheater); the
 * red "De Krakeling" letters still stand on the cornice of the Marnixstraat corner.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (hall eaves 7.8 m behind a 3.4-4.1 m annex along the street, the stepped gable
 * crown 13.1 m, the wings' eaves 13.5-13.8 m, ridges 16-18 m). Fronts read from rectified Gemeente Amsterdam panoramas
 * (CC BY 4.0) at 50 px/m, t in metres along each facade-ring edge from the viewer's left (ringFrame), y up from the 3DBAG
 * ground: the street front (edge 5, w01-335, TMX7316010203-001178_pano_0001_003680 2019 and
 * TMX7316010203-001047_pano_0000_001548 2018), the Marnixstraat corner (edge 3, w04-333, ..._003686 2019; edge 2, w07-64,
 * TMX7316010203-002550_pano_0000_001599 2022), the Marnixstraat wing (edge 0, w03-71, b_20241216_0911_Track04_Sphere_00032
 * 2024), the Leidsekade wing (edge 8, w06-245, TMX7316010203-002994_pano_0002_000530 2023; edge 10, w05-237,
 * TMX7316010203-002978_pano_0004_000262 2023). The hall wall stands 3.5 m behind the annex front, so its features were
 * placed from the 3DBAG gable (t 15.3-23.7) and the hall wall's run (t 4.2-34.5) and the photo's bay rhythm (8 equal bays).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

type Wall = {f: Frame; len: number; ops: BandOpening[]};
const wall = (i: number, off = 0): Wall => { const {f, len} = ringFrame(ring, i, off); return {f, len, ops: []}; };

let B: BuildingTools;

export function buildKrakelingPasseerdersstraat(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: s => s.type === 'WallSurface' && onHallWall(s)});
  const sink0 = getSink();
  setSink(0.12, true);
  annex(wall(5, 0.13));
  hall();
  pavilions(wall(5));
  marnixCorner(wall(3), wall(2));
  marnixFront(wall(0));
  leidseGable(wall(8));
  leidseFront(wall(10));
  westWingNorth(wall(7));
  setSink(sink0);
}

/**
 * The scanned hall wall below the eaves (edge 5 frame: 3.45-3.6 m behind the annex front, t 4-35 m, top under 8 m) comes in
 * five coplanar pieces split at t 12.67, 15.17, 23.92 and 34.46; a window across a split has no host wall in the openings
 * gate. Those pieces are drawn as two brick panels instead (hallPanels), either side of the gable.
 */
function onHallWall(s: Surface) {
  const {f} = ringFrame(ring, 5);
  return s.rings[0].every(p => {
    const dx = p[0] - f.origin[0], dz = p[2] - f.origin[1], t = dx * f.tangent[0] + dz * f.tangent[1], d = dx * f.n[0] + dz * f.n[1];
    return d > -3.65 && d < -3.38 && t > 4 && t < 15.35 && p[1] < 8;
  });
}

// ---- kit -------------------------------------------------------------------------------------------------------------

/** Glazing bar: one quad 4 cm in front of the pane. */
function bar(f: Frame, t: number, y: number, w: number, h: number, out: number) {
  facePanel(B, f, t, y, w, h, 'frame', out + 0.04);
}
type WinOpts = {cols?: number; rows?: number; transomRow?: number; mullions?: number; out?: number; reveal?: boolean; sill?: boolean};
/** A white cross window (frame, pane, paneGrid glazing) in a brick reveal with a stone sill; registers its opening for the bands. */
function win(w: Wall, t: number, y0: number, y1: number, width: number, o: WinOpts = {}) {
  const out = o.out ?? 0, h = y1 - y0, cols = o.cols ?? 2, rows = o.rows ?? 4;
  slab(B, w.f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.08, 'frame', out);
  slab(B, w.f, t, y0 + 0.05, width - 0.1, h - 0.1, 0.04, 'glass', out + 0.08);
  const grid = paneGrid({width: width - 0.1, height: h - 0.1, cols, rows, bar: 0.05, frame: 0, transomRows: [o.transomRow ?? Math.floor(rows / 2)], transom: 0.1});
  for (const m of grid) bar(w.f, t + m.x, y0 + 0.05 + m.y, m.w, m.h, out + 0.12);
  const n = o.mullions ?? 0;
  for (let j = 1; j <= n; j++) bar(w.f, t - width / 2 + width * j / (n + 1), y0 + 0.05, 0.12, h - 0.1, out + 0.12);
  if (o.reveal !== false) for (const s of [-1, 1]) slab(B, w.f, t + s * (width / 2 + 0.1), y0 - 0.06, 0.12, h + 0.12, 0.28, 'brick', out);
  if (o.sill !== false) slab(B, w.f, t, y0 - 0.16, width + 0.3, 0.1, 0.32, 'stone', out);
  w.ops.push({t0: t - width / 2 - 0.2, t1: t + width / 2 + 0.2, y0: y0 - 0.18, y1: y1 + 0.08});
}
/** A round-headed souterrain window with an iron grille in front (bars 11 cm apart) under a brick arch. */
function archWin(w: Wall, t: number, y0: number, y1: number, width: number, grille = true) {
  archSlab(B, w.f, t, y0 - 0.06, width + 0.14, y1 - y0 + 0.12, 0.08, 'frame');
  archSlab(B, w.f, t, y0 + 0.04, width - 0.1, y1 - y0 - 0.08, 0.04, 'glass', 0.08);
  slab(B, w.f, t, y0 + (y1 - y0 - width / 2) * 0.55, width - 0.1, 0.06, 0.04, 'frame', 0.12);
  if (grille) for (let x = -width / 2 + 0.12; x < width / 2 - 0.05; x += 0.11) ledgeStrip(B, w.f, t + x, y0 + 0.04, 0.025, y1 - y0 - width / 2 - 0.04, 0.03, 'dark', 0.2);
  archBand(B, w.f, t, y0, width + 0.5, y1 - y0 + 0.25, 0.22, 0.12, 'brick', 0, 10);
  slab(B, w.f, t, y0 - 0.14, width + 0.3, 0.1, 0.3, 'stone');
  w.ops.push({t0: t - width / 2 - 0.3, t1: t + width / 2 + 0.3, y0: y0 - 0.16, y1: y1 + 0.3});
}
/** Segmental arch over a window: a stone-and-brick voussoir band (alternate stone blocks drawn as one light band with a key). */
function segHead(w: Wall, t: number, y: number, width: number, rise = 0.28) {
  segBand(B, w.f, t, y + rise + 0.1, width + 0.5, rise, 0.22, 0.1, 'stone');
  slab(B, w.f, t, y + rise - 0.06, 0.22, 0.36, 0.14, 'stone');
  w.ops.push({t0: t - width / 2 - 0.3, t1: t + width / 2 + 0.3, y0: y, y1: y + rise + 0.35});
}
/** Round relieving arch over a window: a brick rowlock with stone blocks, the tympanum brick. */
function roundHead(w: Wall, t: number, y: number, width: number) {
  const r = width / 2 + 0.15;
  archBand(B, w.f, t, y - r, 2 * r + 0.3, 2 * r + 0.15, 0.24, 0.1, 'stone', 0, 10);
  w.ops.push({t0: t - r - 0.2, t1: t + r + 0.2, y0: y, y1: y + r + 0.2});
}
/** Speklagen: stone courses across [t0, t1], broken at every registered opening. */
function bands(w: Wall, ys: number[], t0 = 0.05, t1 = w.len - 0.05, h = 0.09) {
  const runs = speklagen({t0, t1, bands: ys.map(y => ({y, h})), openings: w.ops, gap: 0.02});
  for (const r of runs) {
    const n = Math.ceil((r.t1 - r.t0) / 12), L = (r.t1 - r.t0) / n;
    for (let j = 0; j < n; j++) ledgeStrip(B, w.f, r.t0 + L * (j + 0.5), r.y, L - 0.02, r.h, 0.05, 'stone');
  }
}
/** Wrought-iron wall anchor: a T (a bar and a cross piece), dark. */
function anchor(w: Wall, t: number, y: number) {
  flat(() => {
    slab(B, w.f, t, y, 0.05, 0.42, 0.07, 'bronze');
    slab(B, w.f, t, y + 0.36, 0.24, 0.05, 0.07, 'bronze');
  });
}
/** Thin iron and leaves stand on the wall plane unsunk: sunk, most of their depth would sit behind the wall (openings gate `buried`). */
function flat(draw: () => void) {
  const s0 = getSink();
  setSink(0);
  draw();
  setSink(s0, true);
}
/** Fleur-de-lis anchor (the Leidsekade fronts): a centre petal and two curled side petals over a band, iron. */
function fleur(w: Wall, t: number, y: number) {
  flat(() => {
    poly(B, w.f, t, y, [[-0.05, 0], [0.05, 0], [0.05, 0.22], [0, 0.42], [-0.05, 0.22]], 0.07, 'bronze');
    for (const s of [-1, 1]) poly(B, w.f, t, y, [[0, 0.12], [s * 0.2, 0.16], [s * 0.2, 0.32], [s * 0.1, 0.22]], 0.07, 'bronze');
    slab(B, w.f, t, y + 0.1, 0.26, 0.04, 0.12, 'bronze');
  });
}
/** Mixed-case lettering as pixel runs (mixed-case-glyphs), centred at t with its baseline at y. */
function lettering(f: Frame, text: string, t: number, y: number, px: number, d: number, colour: string, out: number) {
  const {runs, width} = glyphRuns(text, px);
  for (const r of runs) slab(B, f, t - width / 2 + (r.t0 + r.t1) / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, d, colour, out);
}
/** Arched door with its leaves (red), a cream frame and a brick arch with stone blocks. */
function door(w: Wall, t: number, y0: number, y1: number, width: number, colour = 'red') {
  flat(() => {
    archSlab(B, w.f, t, y0, width + 0.1, y1 - y0 + 0.05, 0.1, colour);
    slab(B, w.f, t, y0 + 0.05, 0.05, (y1 - y0) * 0.75, 0.05, 'dark', 0.1);
  });
  archBand(B, w.f, t, y0, width + 0.62, y1 - y0 + 0.3, 0.26, 0.14, 'stone', 0, 10);
  w.ops.push({t0: t - width / 2 - 0.35, t1: t + width / 2 + 0.35, y0, y1: y1 + 0.35});
}
/** A stepped gable outline (steps as [half-width, height] pairs from the bottom) of brick, with stone copings on every tread. */
function steppedGable(f: Frame, t: number, y: number, steps: [number, number][], d: number, out = 0) {
  const right: [number, number][] = [];
  steps.forEach(([hw, h], i) => { right.push([hw, i === 0 ? 0 : steps[i - 1][1]], [hw, h]); });
  const left = right.map(([x, yy]) => [-x, yy] as [number, number]).reverse();
  poly(B, f, t, y, [...right, ...left], d, 'brick', out);
  steps.forEach(([hw, h], i) => {
    const inner = i + 1 < steps.length ? steps[i + 1][0] : 0;
    if (inner === 0) { slab(B, f, t, y + h, hw * 2 + 0.12, 0.12, d + 0.1, 'stone', out - 0.05); return; }
    const w0 = hw - inner + 0.12;
    for (const s of [-1, 1]) slab(B, f, t + s * (inner + (hw - inner) / 2), y + h, w0, 0.12, d + 0.1, 'stone', out - 0.05);
  });
}
const off = (f: Frame, o: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * o, f.origin[1] + f.n[1] * o]});

// ---- Nieuwe Passeerdersstraat (edge 5, t from the east end) -----------------------------------------------------------

/**
 * The single-storey annex along the street (3DBAG front t 4.2-34.8, 3.4 m): brick piers between barred windows, the red
 * fascia band, the red double door (w01-335 alt: 635-690 px, t = px/50 + 3.4). Window groups from the 2018 crop.
 */
function annex(w: Wall) {
  slab(B, w.f, 19.5, 0, 30.6, 0.55, 0.08, 'brick');
  for (const [a, c] of [[4.5, 5.7], [6.7, 10.0], [11.1, 14.3], [15.2, 16.0], [17.3, 18.3], [19.3, 22.6], [23.4, 26.7], [27.4, 30.7], [31.5, 34.4]]) {
    const t = (a + c) / 2, wd = c - a, h0 = 0.6, h1 = 2.4;
    slab(B, w.f, t, h0 - 0.05, wd + 0.1, h1 - h0 + 0.1, 0.08, 'frame');
    slab(B, w.f, t, h0, wd - 0.08, h1 - h0, 0.04, 'glass', 0.08);
    const lights = Math.max(1, Math.round(wd / 0.9));
    for (let j = 1; j < lights; j++) bar(w.f, a + wd * j / lights, h0, 0.08, h1 - h0, 0.12);
    for (let x = a + 0.1; x < c - 0.05; x += 0.14) ledgeStrip(B, w.f, x, h0, 0.025, h1 - h0, 0.03, 'dark', 0.22);
    slab(B, w.f, t, h1 - 0.02, wd, 0.06, 0.05, 'dark', 0.22);
  }
  // the red double door at t 16.1-17.2
  slab(B, w.f, 16.65, 0, 1.1, 2.4, 0.06, 'red', 0.06);
  slab(B, w.f, 16.65, 2.4, 1.24, 0.1, 0.16, 'red');
  // red fascia over the whole annex and its grey roof edge
  slab(B, w.f, 19.5, 2.55, 30.8, 0.32, 0.2, 'red');
  slab(B, w.f, 19.5, 2.87, 31.0, 0.12, 0.34, 'slate');
}

/** Hall bay centres: 8 equal bays of 3.8 m centred on the stepped gable's axis (3DBAG crown t 19.1-23.6, gable wall 15.3-23.7). */
const HALL_C = 19.35, HALL_BAY = 3.8;
/** The third bay's window is drawn 0.27 m east of the rhythm so it stands on one 3DBAG wall polygon (the scan splits the hall wall at t 12.67). */
const HALL = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map(k => HALL_C + k * HALL_BAY + (k === -1.5 ? 0.27 : 0));
function hall() {
  const w = wall(5, -3.5), g = wall(5, -3.68);
  slab(B, w.f, 9.72, 3.92, 11.1, 3.85, 0.3, 'brick', -0.3);
  for (const t of HALL) {
    const f = Math.abs(t - HALL_C) < 2 ? g : w;
    latticeWindow(f, t, 4.55, 6.9, 2.15);
    if (f === w) for (const k of [-1, 0, 1]) archBand(B, w.f, t + k * 0.72, 6.98, 0.68, 0.42, 0.1, 0.08, 'brick', 0, 6);
  }
  // buttresses with gabled caps between the bays; the two at the gable are the gable's piers
  for (let k = 0; k < 7; k++) {
    const t = HALL_C + (k - 3) * HALL_BAY, gp = k === 2 || k === 4;
    const f = gp ? g.f : w.f;
    slab(B, f, t, 4.0, 0.55, (gp ? 9.4 : 8.3) - 4.0, 0.4, 'brick');
    poly(B, f, t, gp ? 9.4 : 8.3, [[-0.32, 0], [0.32, 0], [0, 0.6]], 0.5, 'slate', -0.05);
    slab(B, f, t, gp ? 9.3 : 8.2, 0.66, 0.1, 0.5, 'stone', -0.05);
  }
  // eaves: a brick corbel course and the gutter board
  for (const [a, c] of [[4.2, 15.6], [23.1, 34.5]]) {
    slab(B, w.f, (a + c) / 2, 7.45, c - a, 0.14, 0.14, 'brick');
    slab(B, w.f, (a + c) / 2, 7.6, c - a, 0.2, 0.32, 'bronze');
  }
  // the stepped gable (two bays, 7.6 m): three steps and the top block with its pinecone finial
  steppedGable(g.f, HALL_C, 7.8, [[3.8, 1.3], [2.75, 2.6], [1.6, 4.7]], 0.32);
  slab(B, g.f, HALL_C, 12.6, 0.5, 0.45, 0.5, 'stone', -0.05);
  put(B, g.f, new T.ConeGeometry(0.22, 0.75, 6).translate(0, 0.38, 0.22), HALL_C, 13.05, -0.05, 'stone');
  // the gable's two big round relieving arches over its windows, the shields between them, the stone plaque and the top pair
  for (const k of [-0.5, 0.5]) archBand(B, g.f, HALL_C + k * HALL_BAY, 6.9, 2.75, 1.4, 0.24, 0.42, 'brick', 0, 10);
  for (const k of [-0.5, 0.5]) poly(B, g.f, HALL_C + k * 1.5, 8.6, [[-0.28, 0.5], [0.28, 0.5], [0.28, 0.15], [0, -0.15], [-0.28, 0.15]], 0.42, 'stone');
  slab(B, g.f, HALL_C, 9.05, 1.0, 0.3, 0.42, 'stone');
  const top = {f: off(g.f, 0.32), len: 0, ops: []};
  for (const k of [-0.32, 0.32]) win(top, HALL_C + k, 10.3, 11.4, 0.56, {cols: 1, rows: 2, reveal: false});
}
/**
 * The hall window: three lights, the upper third a diamond lattice of leaded glass over a transom (w01-335: 'trefoil'
 * heads read as the small round arches over each light), white frame. Diamonds are glass lozenges on a white ground.
 */
function latticeWindow(w: Wall, t: number, y0: number, y1: number, width: number) {
  const h = y1 - y0, lw = width / 3, tr = y0 + h * 0.62;
  slab(B, w.f, t, y0 - 0.06, width + 0.12, h + 0.12, 0.08, 'frame');
  slab(B, w.f, t, y0 + 0.05, width - 0.1, tr - y0 - 0.1, 0.04, 'glass', 0.08);
  for (let k = 0; k < 3; k++) {
    const c = t - width / 2 + lw * (k + 0.5);
    if (k > 0) bar(w.f, t - width / 2 + lw * k, y0 + 0.05, 0.1, h - 0.1, 0.12);
    bar(w.f, c, y0 + (tr - y0) * 0.5, lw - 0.1, 0.05, 0.12);
    // lattice: 2 x 3 lozenges per light
    const dw = (lw - 0.14) / 2, dh = (y1 - tr - 0.12) / 3;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const x = c - lw / 2 + 0.07 + dw * (i + 0.5), y = tr + 0.06 + dh * j;
      poly(B, w.f, x, y, [[0, 0.01], [dw / 2 - 0.02, dh / 2], [0, dh - 0.01], [-dw / 2 + 0.02, dh / 2]], 0.04, 'glass', 0.08);
    }
  }
  bar(w.f, t, tr - 0.05, width - 0.1, 0.1, 0.12);
  for (const s of [-1, 1]) slab(B, w.f, t + s * (width / 2 + 0.1), y0 - 0.06, 0.12, h + 0.12, 0.28, 'brick');
  slab(B, w.f, t, y0 - 0.16, width + 0.3, 0.1, 0.32, 'stone');
}

/** The two hipped pavilions flanking the annex (3DBAG fronts t 0-4.1 and 34.9-39.1, eaves 7.9): a red door under a slated hood, a window over it. */
function pavilions(w: Wall) {
  for (const [c, dt] of [[2.6, 2.8], [36.2, 36.4]]) {
    door(w, c, 0.3, 2.7, 1.1);
    slab(B, w.f, c, 0, 1.5, 0.3, 0.6, 'stone');
    // the hood: stone posts, a frieze and a slated hip roof
    for (const s of [-1, 1]) slab(B, w.f, c + s * 0.95, 0.3, 0.3, 2.9, 0.3, 'stone');
    slab(B, w.f, c, 3.2, 2.4, 0.4, 0.5, 'stone');
    put(B, w.f, new T.CylinderGeometry(0.1, 1.55, 0.7, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.45).translate(0, 0.35, 0.35), c, 3.6, 0, 'slate');
    win(w, dt, 4.6, 6.6, 0.75, {cols: 2, rows: 4});
    segHead(w, dt, 6.6, 0.75);
    slab(B, w.f, c, 7.6, 4.2, 0.18, 0.3, 'stone');
    bands(w, [1.0, 2.0, 5.4], c - 2.0, c + 2.0);
  }
}

// ---- the Marnixstraat corner and wing -----------------------------------------------------------------------------------

/** Wing storey lines on the Marnixstraat (w03-71 and w07-64, 50 px/m, ground 700 px; eaves 13.6 from 3DBAG). */
const M = {gf: [0.2, 1.6], f1: [2.75, 4.65], cornice: 4.85, f2: [5.8, 7.9], f3: [9.0, 11.4], eaves: 13.6} as const;

/**
 * The corner block: north face (edge 3, w04-333, t = px/50 - 0.6) with the red "De Krakeling" letters on the white cornice
 * over the first floor, the paired first-floor windows, the stone figure on its console, the souterrain arched window; the
 * east face (edge 2, w07-64) with its single, paired and triple windows in the tall bay.
 */
function marnixCorner(n: Wall, e: Wall) {
  archWin(n, 3.55, 0.25, 1.9, 1.25);
  win(n, 2.85, 3.1, 5.2, 0.95, {rows: 4});
  win(n, 4.2, 3.1, 5.2, 0.95, {rows: 4});
  win(n, 3.37, 6.7, 9.0, 1.3, {rows: 4});
  segHead(n, 3.37, 9.0, 1.3);
  win(n, 3.37, 10.5, 12.9, 1.3, {rows: 4});
  roundHead(n, 3.37, 12.9, 1.3);
  // the white cornice on consoles and the letters standing on it
  slab(B, n.f, 3.95, 5.45, 7.8, 0.4, 0.34, 'concrete');
  for (let t = 0.5; t < 7.6; t += 0.85) slab(B, n.f, t, 5.15, 0.16, 0.3, 0.26, 'concrete');
  n.ops.push({t0: -0.4, t1: 8.3, y0: 5.1, y1: 5.9});
  lettering(n.f, 'De Krakeling', 3.1, 5.98, 0.098, 0.1, 'red', 0.16);
  // the stone figure on its console (w04: x 340-372 px, y 550-640 px): simplified as a block statue
  slab(B, n.f, 6.45, 2.85, 0.42, 0.22, 0.32, 'stone');
  slab(B, n.f, 6.45, 3.07, 0.3, 0.95, 0.2, 'sandstone', 0.05);
  slab(B, n.f, 6.45, 4.02, 0.16, 0.2, 0.16, 'sandstone', 0.07);
  for (const s of [-1, 1]) slab(B, n.f, 6.45 + s * 0.2, 3.55, 0.08, 0.42, 0.12, 'sandstone', 0.07);
  for (const t of [0.4, 6.3]) { anchor(n, t, 7.8); anchor(n, t, 11.6); }
  bands(n, [0.0, 2.6, 6.3, 7.2, 8.2, 9.8, 10.9, 12.0, 13.3]);
  // the dormer gable with four blind arches and the small window (w04 thumb)
  steppedGable(n.f, 3.37, 13.65, [[1.8, 1.2], [1.1, 2.5]], 0.3);
  for (let k = 0; k < 4; k++) archSlab(B, n.f, 3.37 - 1.2 + k * 0.8, 13.85, 0.55, 0.75, 0.06, 'stone', 0.3, 4);
  win({f: off(n.f, 0.3), len: 0, ops: []}, 3.37, 14.9, 15.8, 0.6, {cols: 1, rows: 2, reveal: false, sill: false});

  // east face of the corner bay (edge 2, 4.2 m)
  archWin(e, 1.88, 0.6, 1.65, 0.95);
  win(e, 1.9, 2.8, 4.7, 1.0, {rows: 4});
  segHead(e, 1.9, 4.7, 1.0, 0.2);
  slab(B, e.f, 2.1, 5.0, 4.3, 0.4, 0.2, 'stone');
  win(e, 1.2, 5.8, 8.2, 0.8, {rows: 4});
  win(e, 2.55, 5.8, 8.2, 0.9, {rows: 4});
  for (const t of [1.2, 2.55]) roundHead(e, t, 8.2, 0.85);
  win(e, 1.92, 9.0, 11.5, 2.25, {cols: 6, rows: 4, mullions: 2});
  for (const k of [-1, 0, 1]) archBand(B, e.f, 1.92 + k * 0.75, 11.15, 0.78, 0.55, 0.12, 0.26, 'stone', 0, 6);
  win(e, 1.92, 12.6, 13.8, 0.85, {cols: 2, rows: 2});
  for (const t of [0.6, 3.3]) { anchor(e, t, 6.6); anchor(e, t, 9.8); }
  bands(e, [2.6, 6.9, 8.9, 12.2, 14.4]);
}

/** Marnixstraat front (edge 0, 13.2 m, w03-71 at t = px/50; anchors read "A 1 8 8 7" and a ring). */
function marnixFront(w: Wall) {
  // souterrain: two arched doors at the left, four arched barred windows
  door(w, 0.7, 0, 2.1, 0.8, 'dark');
  door(w, 1.93, 0, 2.1, 0.86, 'dark');
  for (const t of [4.1, 6.4, 8.76, 11.1]) archWin(w, t, 0.25, 1.6, 1.15);
  // first floor: paired narrow windows at both ends, single ones between
  for (const [t, wd] of [[0.65, 0.9], [1.87, 0.86], [4.07, 1.14], [6.4, 1.2], [8.73, 1.14], [10.9, 0.92], [12.13, 0.86]]) win(w, t, M.f1[0], M.f1[1], wd, {rows: 4});
  // the white cornice over the first floor with its dentil course
  slab(B, w.f, w.len / 2, M.cornice, w.len - 0.2, 0.24, 0.32, 'concrete');
  for (let t = 0.55; t < w.len - 0.5; t += 0.42) slab(B, w.f, t, M.cornice - 0.14, 0.12, 0.14, 0.22, 'concrete');
  w.ops.push({t0: 0, t1: w.len, y0: M.cornice - 0.2, y1: M.cornice + 0.3});
  const cols = [1.64, 4.04, 6.4, 8.78, 11.1];
  for (const t of cols) {
    win(w, t, M.f2[0], M.f2[1], 1.2, {rows: 4});
    segHead(w, t, M.f2[1], 1.2);
    win(w, t, M.f3[0], M.f3[1], 1.25, {rows: 4});
    segHead(w, t, M.f3[1], 1.25, 0.38);
  }
  // the date anchors between the second-floor windows
  const date = ['A', '1', '8', '8', '7'];
  flat(() => [0.44, 2.84, 5.22, 7.58, 9.94].forEach((t, i) => lettering(w.f, date[i], t, 8.15, 0.07, 0.07, 'bronze', 0)));
  put(B, w.f, new T.TorusGeometry(0.15, 0.03, 4, 10).scale(1, 1.4, 1).translate(0, 0, 0.04), 12.3, 8.45, 0, 'bronze');
  for (const t of [0.44, 2.84, 5.22, 7.58, 9.94, 12.3]) anchor(w, t, 10.4);
  // a ledge under the second and third floors, stone courses
  for (const y of [5.45, 8.6]) slab(B, w.f, w.len / 2, y, w.len - 0.2, 0.12, 0.14, 'greyBrick');
  w.ops.push({t0: 0, t1: w.len, y0: 5.4, y1: 5.6}, {t0: 0, t1: w.len, y0: 8.55, y1: 8.75});
  bands(w, [0.0, 2.2, 4.2, 6.6, 7.3, 9.7, 10.5, 12.0, 13.0]);
  // the eaves board stops at the middle risalit, whose brick runs up through it into the gable
  eavesBoard(w, 0, 4.85);
  eavesBoard(w, 7.95, w.len);
  // The middle dormer gable (w03 thumb at 54 px/m: 3.1 m wide, shoulders 0.85 m over the eaves, apex 2.1 m over the
  // eaves with a small finial; pointed, not stepped). Four white blind arches under the eaves line, a small window
  // just over it. Its apex (15.7 m) stays under the 3DBAG ridge (16.6 m, 3.5 m back): it rises over the roof only in
  // perspective. The two white side dormers.
  const gy = M.eaves - 0.35;
  poly(B, w.f, 6.4, gy, [[1.55, 0], [1.55, 1.2], [1.2, 1.2], [0, 2.45], [-1.2, 1.2], [-1.55, 1.2], [-1.55, 0]], 0.42, 'brick', 0);
  poly(B, w.f, 6.4, gy, [[1.36, 1.05], [0, 2.58], [-1.36, 1.05]], 0.3, 'stone', 0);
  for (const s of [-1, 1]) slab(B, w.f, 6.4 + s * 1.38, gy + 1.26, 0.42, 0.14, 0.52, 'stone', 0);
  slab(B, w.f, 6.4, gy + 2.62, 0.16, 0.5, 0.28, 'stone', 0);
  for (let k = 0; k < 4; k++) archSlab(B, w.f, 5.2 + k * 0.8, 12.85, 0.58, 0.72, 0.06, 'concrete', 0.42, 4);
  win({f: off(w.f, 0.42), len: 0, ops: []}, 6.4, 13.8, 14.5, 0.55, {cols: 1, rows: 2, reveal: false, sill: false});
  for (const t of [2.85, 9.95]) whiteDormer(w, t);
}
function eavesBoard(w: Wall, t0: number, t1: number) {
  slab(B, w.f, (t0 + t1) / 2, M.eaves - 0.35, t1 - t0, 0.35, 0.4, 'concrete');
}
/** A white-painted dormer on the eaves line (w03 thumb, b_20241216_0911_Track04_Sphere_00032): a closed white box under a slated cap; no glazing shows from the street. */
function whiteDormer(w: Wall, t: number) {
  const f = off(w.f, 0.5), x = w.f.origin[0] + w.f.tangent[0] * t - w.f.n[0] * 0.9, z = w.f.origin[1] + w.f.tangent[1] * t - w.f.n[1] * 0.9;
  const roofY = roofHeightAt(src.surfaces, x, z) ?? M.eaves + 0.8;
  slab(B, f, t, M.eaves - 0.2, 1.7, Math.max(1.6, roofY - M.eaves + 0.9), 1.6, 'concrete', -1.6);
  slab(B, f, t, M.eaves + 1.4, 1.9, 0.14, 1.9, 'slate', -1.75);
}

// ---- the Leidsekade wing -------------------------------------------------------------------------------------------

/** Leidsekade storey lines (w06-245 at 50 px/m, ground 690 px; eaves 13.5 from 3DBAG). */
const L = {gf: [0.1, 1.2], f1: [2.2, 4.75], f2: [6.0, 8.5], f3: [9.9, 12.3], eaves: 13.5} as const;
function leidseColumn(w: Wall, t: number, wd = 1.3) {
  win(w, t, L.gf[0] + 0.1, L.gf[1], wd, {rows: 2, transomRow: 1});
  segHead(w, t, L.gf[1], wd, 0.22);
  win(w, t, L.f1[0], L.f1[1], wd, {rows: 6, transomRow: 4});
  roundHead(w, t, L.f1[1] + 0.25, wd);
  win(w, t, L.f2[0], L.f2[1], wd, {rows: 4});
  segHead(w, t, L.f2[1], wd);
  win(w, t, L.f3[0], L.f3[1], wd, {rows: 4});
  roundHead(w, t, L.f3[1] + 0.2, wd);
}
/** The corner bay on the Leidsekade (edge 8, 5.5 m, w06-245: two axes at 62-127 and 187-250 px) under its stepped gable. */
function leidseGable(w: Wall) {
  for (const t of [1.89, 4.36]) leidseColumn(w, t);
  fleur(w, 3.12, 5.0);
  for (const t of [0.8, 3.12]) anchor(w, t, 8.9);
  for (const t of [0.8, 3.12]) anchor(w, t, 12.6);
  slab(B, w.f, w.len / 2, 2.0, w.len - 0.1, 0.12, 0.14, 'stone');
  w.ops.push({t0: 0, t1: w.len, y0: 1.95, y1: 2.15});
  bands(w, [0.9, 3.0, 3.85, 5.6, 6.9, 7.7, 9.3, 10.4, 11.4, 13.1]);
  win(w, 3.05, 13.55, 14.2, 1.0, {cols: 3, rows: 1, reveal: false});
}
/** The Leidsekade front (edge 10, 11.8 m, w05-237): two axes, the portico axis (raised red door, loggia with a column), one axis. */
function leidseFront(w: Wall) {
  for (const t of [1.55, 4.1, 9.5]) leidseColumn(w, t);
  // portico: stone steps, the arched red door, the loggia over it with its stone column
  for (let k = 0; k < 4; k++) slab(B, w.f, 6.8, k * 0.25, 1.7, 0.25, 1.1 - k * 0.22, 'stone');
  door(w, 6.8, 1.0, 3.4, 1.05);
  slab(B, w.f, 6.8, 3.75, 1.5, 0.16, 0.45, 'stone');
  slab(B, w.f, 6.8, 3.91, 1.3, 1.6, 0.04, 'dark', 0.06);
  slab(B, w.f, 6.8, 3.91, 0.18, 1.6, 0.25, 'stone', 0.1);
  archBand(B, w.f, 6.8, 3.91, 1.7, 2.1, 0.22, 0.14, 'stone', 0, 10);
  w.ops.push({t0: 5.9, t1: 7.7, y0: 3.7, y1: 6.1});
  win(w, 6.8, L.f2[0] + 0.5, L.f2[1], 1.0, {rows: 4});
  win(w, 6.45, L.f3[0], L.f3[1], 0.6, {cols: 1, rows: 4});
  win(w, 7.15, L.f3[0], L.f3[1], 0.6, {cols: 1, rows: 4});
  for (const t of [2.83, 5.45, 8.15]) fleur(w, t, 5.0);
  for (const t of [0.3, 2.83, 5.45, 8.15, 11.0]) anchor(w, t, 8.9);
  for (const t of [2.83, 5.45, 8.15]) slab(B, w.f, t, 4.7, 0.5, 0.25, 0.3, 'stone');
  slab(B, w.f, w.len / 2, 2.0, w.len - 0.1, 0.12, 0.14, 'stone');
  w.ops.push({t0: 0, t1: w.len, y0: 1.95, y1: 2.15});
  bands(w, [0.9, 3.0, 3.85, 5.6, 6.9, 7.7, 9.3, 10.4, 11.4]);
  slab(B, w.f, w.len / 2, L.eaves - 0.3, w.len, 0.3, 0.35, 'concrete');
  // the dormer gable over the portico axis
  steppedGable(w.f, 6.8, L.eaves, [[1.6, 1.1], [0.95, 2.2]], 0.3);
  for (const k of [-0.3, 0.3]) win({f: off(w.f, 0.3), len: 0, ops: []}, 6.8 + k, 13.75, 14.85, 0.5, {cols: 1, rows: 2, reveal: false, sill: false});
}

/** The west wing's street end (edge 7, 7.9 m; w01-335 alt x 1790-2135 px): one window axis at t 2.5 and the wing's bands. */
function westWingNorth(w: Wall) {
  leidseColumn(w, 2.5, 1.1);
  for (const t of [0.6, 4.4]) { anchor(w, t, 8.9); anchor(w, t, 12.6); }
  bands(w, [0.9, 2.0, 3.0, 3.85, 5.6, 6.9, 7.7, 9.3, 10.4, 11.4], 0.05, Math.min(w.len, 7.8));
}
