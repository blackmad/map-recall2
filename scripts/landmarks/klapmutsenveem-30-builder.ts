import type {BuildingTools} from './cultural-builders';
import {archSlab, ledgeStrip, slab} from './nearbar-kit';
import type {Col, FR} from './modern-front-kit';
import {boxBand, buildHandBlock, longBand, type Front, type Seg, type Src, type Win} from './hand-block-kit';
import source from './klapmutsenveem-30-footprints.json';

/**
 * KLAPMUTSENVEEM 30-62 (Oostelijke Handelskade; BAG pand 0363100012239388, 2012): a 192 m quay block in warehouse
 * pastiche, two designs along one wall (lane hand-blocks-c-20261122, block-sized triage rank 20). Massing: the 3DBAG
 * LoD2.2 shell over all three of its BuildingParts (bag-shell-prepare.ts now reads every part; the part -0 shell covered
 * 87 of the 192 m), rebuilt wall by wall by hand-block-kit.ts. Front read off the rectified Gemeente Amsterdam panorama
 * TMX7315120208-000052_pano_0000_000864 (2016, 19.3 px/m, CC BY 4.0), `s` metres from the crop's left (west) end; heights
 * scaled 0.93-0.95 from the crop onto the 3DBAG 23.7 m roof line:
 *  - two arcade warehouses (s 12-48 and 58-97): red-brown brick in three tiers of giant round arches (four storeys, two,
 *    two) with steel-framed glazing and floor transoms, white stone imposts and keystones, two white cornices; narrow
 *    single-window bays at the ends and in the middle; a dark entrance bay;
 *  - two pilaster blocks (s 107-144 and 154-192): a two-storey ground arcade of small round-headed windows, a white band,
 *    two storeys of white-blocked windows, a cornice, three storeys of tall windows in recessed strips with grey spandrel
 *    panels and Juliet rails between brick piers, white blocks at the springings, an attic of small arches (w03-106, 2024); each with two dark glazed oriel stacks from the third storey to the roof; a passage;
 *  - two low two-storey links (6-7 m) at s 50-58 and 144-154 with a garage door each.
 * Walls without a panorama (the slots and party-wall sides) take the inferred grid.
 */
const src = source as unknown as Src;

const PANEL: Col = 'blue', FRAME: Col = 'frame', BRICK: Col = 'brick', WHITE: Col = 'stone', DARK: Col = 'dark', ORIEL: Col = 'bronze', GLASS: Col = 'glass', LEDGE: Col = 'concrete';
const L = 192.59;

// ---- arcade warehouse --------------------------------------------------------------------------------------------
/** Tiers of the giant arches: rectangular glazing [y0, springing], floor transoms, arch radius (bay width / 2). */
// tier heights re-read 2026-11-23 (lane hand-blocks-d) off the same crop: the springings stand at 9.8, 15.95 and 21.2 m
// (were 9.0, 15.05 and 20.6 m: the blind judge's "short arcade blocks")
const TIERS: {y: [number, number]; bars: number[]}[] = [{y: [0.15, 9.8], bars: [2.85, 3.05, 5.85, 6.05, 8.75]}, {y: [13.45, 15.95], bars: [14.7]}, {y: [19.5, 21.2], bars: []}];
const ARCH_W = 4.3, NARROW_SILLS = [0.5, 3.4, 6.3, 13.4, 19.5], NARROW_ARCH = [9.25, 15.4, 20.9];
type Bays = {big: number[]; narrow: number[]};
/** Narrow bays at both ends and the middle, three giant bays in each half. */
function arcadeBays(s0: number, s1: number): Bays {
  const n0 = s0 + 1.05, n2 = s1 - 1.05, n1 = (n0 + n2) / 2, half = (n1 - n0 - 1.3) / 3;
  const big = [0, 1, 2].flatMap(k => [n0 + 0.65 + half * (k + 0.5), n1 + 0.65 + half * (k + 0.5)]).sort((a, b) => a - b);
  return {big, narrow: [n0, n1, n2]};
}
function arcadeSeg(s0: number, s1: number, entrance: number): {seg: Seg; bays: Bays} {
  const bays = arcadeBays(s0, s1), wins: Win[] = [];
  bays.big.forEach((s, k) => {
    for (const [i, T] of TIERS.entries()) {
      if (i === 0 && k === entrance) wins.push({s, w: ARCH_W, y: [0.1, 5.85], o: {depth: 1.6, back: DARK, edge: 0}}, {s, w: ARCH_W, y: [6.05, T.y[1]], o: {depth: 0.3, cols: 3, frame: 'frame', edge: 0.08}});
      else wins.push({s, w: ARCH_W, y: T.y, o: {depth: 0.3, cols: 3, frame: 'frame', edge: 0.08, bars: T.bars.map(b => b - T.y[0])}});
    }
  });
  for (const s of bays.narrow) for (const y of NARROW_SILLS) wins.push({s, w: 0.8, y: [y, y + 1.6], o: {depth: 0.2, frame: 'frame', edge: 0.06, sill: WHITE}});
  for (const s of bays.narrow) for (const y of NARROW_ARCH) wins.push({s, w: 0.8, y: [y, y + 1.1], o: {depth: 0.2, frame: 'frame', edge: 0.06}});
  return {seg: {s: [s0, s1], bands: [[99, BRICK]], wins}, bays};
}
function arcadeExtra(b: BuildingTools, F: FR, s0: number, s1: number, bays: Bays) {
  for (const s of bays.big) for (const T of TIERS) {
    const y = T.y[1];
    archSlab(b, F.f, s, y, ARCH_W, ARCH_W / 2, 0.09, GLASS, 0, 7);
    // white impost blocks at the springing and a keystone
    for (const d of [-1, 1]) slab(b, F.f, s + d * (ARCH_W / 2 + 0.2), y - 0.2, 0.45, 0.32, 0.08, WHITE);
    slab(b, F.f, s, y + ARCH_W / 2 + 0.02, 0.42, 0.4, 0.1, WHITE);
  }
  for (const s of bays.narrow) for (const y of NARROW_ARCH) { archSlab(b, F.f, s, y + 1.1, 0.8, 0.4, 0.09, GLASS, 0, 4); slab(b, F.f, s, y + 1.45, 0.3, 0.3, 0.08, WHITE); }
  // two white cornices and the coping
  longBand(b, F, s0, s1, 12.75, 13.25, 0.28, WHITE);
  longBand(b, F, s0, s1, 18.55, 19.15, 0.34, WHITE);
}

// ---- pilaster block ----------------------------------------------------------------------------------------------
const P_ROWS: [number, number][] = [[7.3, 8.6], [10.2, 11.4]];
/** The recessed strip of the three upper storeys (grey panel back) and the glass in it. */
const STRIP: [number, number] = [13.1, 20.1], STRIP_GLASS: [number, number][] = [[13.2, 14.3], [15.0, 17.2], [17.9, 19.95]];
type Pil = {cols: number[]; pitch: number; oriels: [number, number][]; passage: [number, number] | null};
function pilasterBlock(s0: number, s1: number, oriels: [number, number][], passage: [number, number] | null): {seg: Seg; p: Pil} {
  const n = Math.round((s1 - s0) / 1.85), pitch = (s1 - s0) / n, cols = Array.from({length: n}, (_, k) => s0 + pitch * (k + 0.5));
  const free = (s: number, y: number) => !oriels.some(([a, c]) => y > 9 && s > a - 0.5 && s < c + 0.5) && !(passage && y < 6.2 && s > passage[0] - 0.6 && s < passage[1] + 0.6);
  const wins: Win[] = [];
  if (passage) wins.push({s: (passage[0] + passage[1]) / 2, w: passage[1] - passage[0], y: [0.12, 5.9], o: {depth: 3.0, back: DARK, edge: 0}});
  for (const s of cols) {
    if (free(s, 0)) wins.push({s, w: 1.0, y: [1.35, 3.15], o: {depth: 0.2, edge: 0}}, {s, w: 1.0, y: [3.7, 5.3], o: {depth: 0.2, edge: 0}});
    for (const y of P_ROWS) if (free(s, y[0])) wins.push({s, w: 1.0, y, o: {depth: 0.2, edge: 0}});
    if (free(s, 14)) wins.push({s, w: 0.95, y: STRIP, o: {depth: 0.25, edge: 0}});
    if (free(s, 22)) wins.push({s, w: 0.8, y: [22.0, 22.75], o: {depth: 0.15, edge: 0}});
  }
  return {seg: {s: [s0, s1], bands: [[99, BRICK]], wins}, p: {cols, pitch, oriels, passage}};
}
function pilasterExtra(b: BuildingTools, F: FR, s0: number, s1: number, p: Pil) {
  const free = (s: number, y: number) => !p.oriels.some(([a, c]) => y > 9 && s > a - 0.5 && s < c + 0.5) && !(p.passage && y < 6.2 && s > p.passage[0] - 0.6 && s < p.passage[1] + 0.6);
  for (const s of p.cols) {
    if (free(s, 0)) archSlab(b, F.f, s, 5.3, 1.0, 0.5, 0.09, GLASS, 0, 4);
    // grey spandrel panels standing on the strip's glass back (10 cm proud of it), Juliet rails in front of the glass
    if (free(s, 14)) STRIP_GLASS.forEach(([y0], k) => {
      if (k > 0) slab(b, F.f, s, STRIP_GLASS[k - 1][1], 0.95, y0 - STRIP_GLASS[k - 1][1], 0.1, PANEL, -0.25);
      if (y0 > 14.5) ledgeStrip(b, F.f, s, y0 + 0.95, 0.9, 0.05, 0.04, DARK, -0.12);
    });
    if (free(s, 22)) archSlab(b, F.f, s, 22.75, 0.8, 0.4, 0.09, GLASS, 0, 3);
  }
  // white blocks between the windows of storeys 3-4 and on the piers at the upper springings
  p.cols.slice(0, -1).forEach((s, k) => {
    const m = s + p.pitch / 2;
    if (free(m, 0)) slab(b, F.f, m, 5.15, p.pitch - 1.1, 0.3, 0.08, WHITE);
    for (const y of P_ROWS) if (free(m, y[0])) slab(b, F.f, m, y[1] - 0.3, p.pitch - 1.05, 0.3, 0.06, WHITE);
    if (free(m, 14)) slab(b, F.f, m, 19.85, p.pitch - 0.95, 0.32, 0.06, WHITE);
  });
  longBand(b, F, s0, s1, 6.7, 7.15, 0.2, WHITE);
  longBand(b, F, s0, s1, 12.7, 13.1, 0.25, WHITE);
  longBand(b, F, s0, s1, 21.4, 21.85, 0.32, WHITE);
  // dark glazed oriel stacks: a box 0.7 m proud, glass panes per storey; over the glass a dark frame grid (a mullion
  // between panes, a transom at each storey's spandrel and one a third up the pane) and a brick-faced pilaster strip at
  // each side (2026-11-23: the blind judge read the plain grey box as flat)
  for (const [a, c] of p.oriels) {
    const y0 = 9.2, y1 = 23.3, n = 5, h = (y1 - y0) / n, w = c - a, panes = Math.max(3, Math.round(w / 1.9)), pw = (w - 0.7) / panes;
    boxBand(b, F, a, c, y0, y1, 0.7, ORIEL);
    for (let k = 0; k < n; k++) {
      const yb = y0 + k * h;
      for (let j = 0; j < panes; j++) slab(b, F.f, a + 0.35 + pw * (j + 0.5), yb + 0.45, pw - 0.04, h - 0.75, 0.08, GLASS, 0.7);
      ledgeStrip(b, F.f, (a + c) / 2, yb + 0.45 + (h - 0.75) * 0.68, w - 0.7, 0.08, 0.06, FRAME, 0.78);
      ledgeStrip(b, F.f, (a + c) / 2, yb + 0.37, w - 0.7, 0.1, 0.06, FRAME, 0.78);
    }
    for (let j = 1; j < panes; j++) ledgeStrip(b, F.f, a + 0.35 + pw * j, y0 + 0.3, 0.1, y1 - y0 - 0.6, 0.06, FRAME, 0.78);
    for (const e of [a + 0.175, c - 0.175]) slab(b, F.f, e, y0, 0.35, y1 - y0, 0.12, BRICK, 0.7);
  }
}

// ---- links -------------------------------------------------------------------------------------------------------
function linkSeg(s0: number, s1: number, garage: [number, number], top: number): Seg {
  const wins: Win[] = [{s: (garage[0] + garage[1]) / 2, w: garage[1] - garage[0], y: [0.05, 2.6], o: {depth: 0.4, back: DARK, edge: 0.08, frame: 'frame'}}];
  for (let s = s0 + 0.9; s < s1 - 0.6; s += 1.25) wins.push({s, w: 0.75, y: [3.5, Math.min(top - 1.2, 4.9)], o: {depth: 0.18, edge: 0, sill: WHITE}});
  return {s: [s0, s1], bands: [[99, BRICK]], wins};
}

const A1 = arcadeSeg(12.3, 48.35, -1), A2 = arcadeSeg(58.15, 97.3, 3);
const P1 = pilasterBlock(107.45, 143.85, [[115.6, 122.6], [132.3, 140.6]], [121.3, 126.2]);
const P2 = pilasterBlock(154.05, 192.45, [[163.4, 171.0], [183.8, 191.4]], null);
const W: Front = {
  tag: 'w01-196', a: [-90.24, -15.29], b: [94.72, 38.39], n: [-0.2787, 0.9604],
  segs: [
    {s: [-3, 12.3], bands: [[99, BRICK]], wins: [{s: 0.0, w: 1.0, y: [0.6, 2.6], o: {depth: 0.2, edge: 0}}, ...[3.5, 6.4, 9.3, 12.2].map(y => ({s: 0.0, w: 1.0, y: [y, y + 1.6] as [number, number], o: {depth: 0.2, edge: 0, sill: WHITE}}))]},
    A1.seg,
    {s: [48.35, 49.9], bands: [[99, BRICK]], wins: []},
    linkSeg(49.9, 58.15, [54.2, 57.4], 6.1),
    A2.seg,
    {s: [97.3, 107.45], bands: [[99, BRICK]], wins: []},
    P1.seg,
    linkSeg(143.85, 154.05, [145.8, 153.0], 6.9),
    P2.seg,
  ],
  extra: (b, F) => {
    arcadeExtra(b, F, 12.3, 48.35, A1.bays);
    arcadeExtra(b, F, 58.15, 97.3, A2.bays);
    pilasterExtra(b, F, 107.45, 143.85, P1.p);
    pilasterExtra(b, F, 154.05, L - 0.15, P2.p);
    for (const [s0, s1, top] of [[49.9, 58.15, 6.1], [143.85, 154.05, 6.9]]) {
      longBand(b, F, s0, s1, 2.75, 3.0, 0.15, WHITE);
      longBand(b, F, s0, s1, top - 0.45, top, 0.2, WHITE);
    }
  },
};

export function buildKlapmutsenveem30(_w: number, _d: number, b: BuildingTools) {
  // the north side stands against the neighbouring Klapmutsenveem 2-186 block (no exposed wall but w02-16 at the west end)
  const plain = (w: {n: [number, number]; cx: number}) => w.n[0] * 0.2787 - w.n[1] * 0.9604 > 0.9 && w.cx > -64;
  buildHandBlock(b, {src, fronts: [W], wall: BRICK, roof: 'slate', ledge: LEDGE, setbackAbove: 7.5, storey: 2.95, firstSill: 3.6, gridWin: 1.1, defaults: {edge: 0}, gridDefaults: {edge: 0}, plain});
}
