import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, getSink, poly, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {frameCoords, reshapeShell} from './shell-gable-fit';
import {rowFront, storeysUnder} from './row-front';
import {ZoneMesh, bagFrame, type Cut, type Zone} from './zone-wall-kit';
import source from './spiegelhof-footprints.json';

/**
 * SPIEGELHOF, Nieuwe Spiegelstraat 3-17 / Keizersgracht 555 (BAG pand 0363100012167897, BAG 1905; rijksmonument 518340
 * for the 1917-1919 Keizersgracht office). One pand, two buildings:
 *  - the long red-brick Spiegelhof shop wing on the Nieuwe Spiegelstraat (ring edges 3 and 4, 56.7 m): a ground arcade
 *    of grey stone columns before square piers with the shops 2.2 m back, a light stone entablature, two storeys of
 *    white-framed windows, a stone cornice under the roof terrace, a central pavilion with a three-arched loggia under a
 *    pediment, and a south end pavilion with an arched loggia and pediment;
 *  - the Keizersgracht office at the corner (edges 8-16): a rusticated grey granite base of two storeys (shallow-arched
 *    barred cellar lights, tall ground windows), brick upper storeys between stone pilasters with fluted feet and
 *    capitals, a stone attic storey, frieze and mutule cornice, pedimented risalits on the Nieuwe Spiegelstraat (edge 10)
 *    and Keizersgracht (edge 16) fronts, a balustrade with urns over the lower Nieuwe Spiegelstraat bays (edge 8), the
 *    chamfered corner (edges 12-14), and the projecting stone entrance portico with its pediment and ball finials (edge 6).
 * Massing: the 3DBAG LoD2.2 shell (spiegelhof-footprints.json, bag-shell-prepare.ts). The wing's street wall and the
 * portico are rebuilt as holed walls (zone-wall-kit) so the arcade, passage, loggias and windows are real recesses. Read
 * from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per item in spiegelhof-inventory.json; t is metres along each
 * ring edge from the viewer's left. The wing crops (36 px/m) read about 10 % tall against the 3DBAG terrace (12.2 m) and
 * pediment (17.8 m), the office crops (50 px/m) about 8 % against its 20.0 m eaves: heights below are scaled to the shell.
 */
type Src = {facadeRing: number[][]; nativeRing: number[][]; surfaces: Surface[]};
type P = [number, number];
type Col = Parameters<BuildingTools['add']>[1];
const src = source as unknown as Src;
const ring = src.facadeRing;
const RING = ring.map(p => [p[0], p[1]] as P);

const E3 = ringFrame(ring, 3), E4 = ringFrame(ring, 4), E6 = ringFrame(ring, 6), E7 = ringFrame(ring, 7), E8 = ringFrame(ring, 8);
// edge 16's shell wall stands up to 9 cm proud of the facade ring (t 5.6-10.5) and edge 14 0.2 m behind edge 16's plane:
// their fronts are drawn on frames moved out so every part stands on the most forward wall
const E10 = ringFrame(ring, 10), E16 = ringFrame(ring, 16, 0.1);
const loc = (e: {f: Frame}, x: number, z: number) => frameCoords(e.f, x, z);

/** Wing sections in wing metres (edge 3 t, then edge 4 t + its 28.0 m): A, central pavilion C, B, south pavilion S. */
const L3 = E3.len;
type Sec = 'A' | 'C' | 'B' | 'S';
const SEC: Record<Sec, P> = {A: [0.5, 21.4], C: [21.4, 31.5], B: [31.5, 51.9], S: [51.9, L3 + E4.len]};
const BAYS: Record<Sec, number> = {A: 8, C: 3, B: 8, S: 2};
const WING = {terrace: 12.25, arcade: 3.75, entab: 4.55, pav: 15.8, south: 16.0};
/** Wing metre -> the edge frame under it and t on that edge. */
const at = (wt: number) => (wt < L3 ? {f: E3.f, t: wt} : {f: E4.f, t: wt - L3});
const bayCentres = (s: Sec) => {
  const [a, c] = SEC[s], n = BAYS[s], w = (c - a) / n;
  return Array.from({length: n}, (_, i) => a + w * (i + 0.5));
};
const inPavilionC = (x: number, z: number) => {
  const a = loc(E3, x, z);
  return a.t > SEC.C[0] - 0.05 && a.t < SEC.C[1] + 0.05 && a.d > -0.3 && a.d < 12.5;
};
const inPavilionS = (x: number, z: number) => { const a = loc(E4, x, z); return a.t > 23.6 && a.d > -0.3 && a.d < 12.5; };
/** The portico in edge 8's frame: t -3.3..0, in front of the office's Nieuwe Spiegelstraat plane. */
const inPortico = (x: number, z: number) => { const a = loc(E8, x, z); return a.t > -3.35 && a.t < 0.05 && a.d < -0.05 && a.d > -2.15; };
/** The 1 m notch the scan leaves at the north end of the edge 10 risalit (11.7-12.4 m): filled to the eaves. */
const inNotch10 = (x: number, z: number) => { const a = loc(E10, x, z); return a.t > -0.05 && a.t < 2.9 && a.d > -0.1 && a.d < 1.1; };
/** The 0.3 m ledge at 8.1-8.4 m on the corner facet (edge 12): its wall is brought forward to the eaves. */
/** Edge 8's base ledge (the scan's 7.4-9.0 m strip in front of the upper wall): one level at 7.9 m. */
const inLedge8 = (x: number, z: number) => { const a = loc(E8, x, z); return a.t > -0.1 && a.t < 9.6 && a.d > 0.5 && a.d < 1.3; };
const inLedge12 = (x: number, z: number) => { const a = loc(ringFrame(ring, 12), x, z); return a.t > 0.2 && a.t < 2.1 && a.d > -0.1 && a.d < 0.45; };
/** Office part of the pand: south of the portico's north line in edge 8's frame, or south of z 5. */
const inOffice = (x: number, z: number) => loc(E8, x, z).t > -3.4 || z > 5.0;
/** Walls of the wing's street face (edges 3 and 4 planes), rebuilt as holed walls. */
const onWingFace = (s: Surface) => s.type === 'WallSurface' && [E3, E4].some((e, k) => s.rings[0].every(p => {
  const a = loc(e, p[0], p[2]);
  return Math.abs(a.d) < 0.2 && a.t > (k === 0 ? SEC.A[0] - 0.05 : -0.3) && a.t < e.len + 0.3;
}));
/** Portico walls on its front (edge 6, t 1.2-4.3) and south side (edge 7), rebuilt as holed walls. */
const onPorticoFace = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => {
  const a = loc(E6, p[0], p[2]), q = loc(E7, p[0], p[2]);
  return (Math.abs(a.d) < 0.15 && a.t > 1.1 && a.t < 4.4) || (Math.abs(q.d) < 0.15 && q.t > -0.1 && q.t < 2.1 && p[1] < 7.0);
});
const centroid = (s: Surface) => { const r = s.rings[0]; return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length]; };

export function buildSpiegelhof(_w: number, _d: number, b: BuildingTools) {
  const surfaces = reshapeShell(src.surfaces, {
    snap: [
      {inside: inNotch10, lo: 11.6, hi: 12.5, to: 20.0},
      {inside: inLedge12, lo: 8.0, hi: 8.5, to: 20.6},
      {inside: inLedge8, lo: 8.0, hi: 9.1, to: 7.9},
      {inside: inPortico, lo: 6.6, hi: 7.7, to: 6.6},
    ],
    // central pavilion: one flat top at its cornice (the scan's lumpy 15.5-17.8 m gable); the pediment and roof are drawn
    compress: [{inside: inPavilionC, y0: WING.pav, s: 0}],
  });
  addShell(b, {...src, surfaces} as never, {
    wall: 'brick', roof: 'slate',
    skip: s => onWingFace(s) || onPorticoFace(s),
    wallFor: s => {
      const [cx, cz] = centroid(s), ys = s.rings[0].map(p => p[1]);
      if (inOffice(cx, cz)) return Math.max(...ys) <= 8.0 ? 'concrete' : 'ochre';
      // the wing's set-back attic walls over the terrace read as its grey roof (w01-298)
      if (Math.min(...ys) >= 12.0 && !inPavilionC(cx, cz) && !inPavilionS(cx, cz)) return 'slate';
      return 'brick';
    },
  });
  const s0 = getSink();
  setSink(0.1, true);
  wingFront(b);
  pediment(b, at(26.45).f, at(26.45).t, SEC.C[1] - SEC.C[0] + 0.5, WING.pav, 17.8, 'stone', 'stone', 11.0, true);
  pediment(b, at(54.3).f, at(54.3).t, SEC.S[1] - SEC.S[0] + 0.4, WING.south, 17.4, 'stone', 'stone', 6.0, false);
  portico(b);
  officeFronts(b);
  backs(b);
  setSink(s0);
}

// ---------------------------------------------------------------- wing
/** Window rows of the wing (w01-298 2018/2020 crops x 0.9): 5.4-7.25 m and 8.7-10.45 m, 1.3 m wide. */
const WROWS: P[] = [[5.4, 7.25], [8.7, 10.45]];
const WW = 1.3;
const ARC_DEPTH = 2.2;

/**
 * Wing street wall (w01-298, 2020 and 2018; thumb for depth): holed walls per edge from the ground to the section tops.
 * The arcade is one cut per bay between the supports (2.2 m deep, glazed shopfronts at the back), the windows 0.18 m
 * deep with white reveals, the loggias 1.2-1.5 m deep with round heads.
 */
function wingFront(b: BuildingTools) {
  const zm = new ZoneMesh(b);
  for (const {e, off} of [{e: 3, off: 0}, {e: 4, off: L3}]) {
    const {f: zf, len} = bagFrame(RING, e);
    for (const s of ['A', 'C', 'B', 'S'] as Sec[]) {
      const [a0, a1] = SEC[s];
      const t0 = Math.max(0, a0 - off), t1 = Math.min(len, a1 - off);
      if (t1 - t0 < 0.05) continue;
      const top = s === 'C' ? WING.pav : s === 'S' ? WING.south : WING.terrace;
      const cuts: Cut[] = [];
      const cs = bayCentres(s), w = (a1 - a0) / BAYS[s];
      // the arcade: one opening per section between the brick end piers; the columns stand in it
      // (under the pavilions, whose sections cross the ring's bend, one opening per bay: the openings audit finds no host for
      // one glass sheet over the bend)
      if (s === 'A' || s === 'B') cuts.push({t0: a0 + 0.55 - off, t1: a1 - 0.55 - off, y0: 0, y1: WING.arcade, depth: ARC_DEPTH, back: 'glass', reveal: 'stone'});
      else cs.forEach((c, i) => cuts.push({t0: c - w / 2 + (i === 0 ? 0.55 : 0.33) - off, t1: c + w / 2 - (i === cs.length - 1 ? 0.55 : 0.33) - off, y0: 0, y1: WING.arcade, depth: ARC_DEPTH, back: 'glass', reveal: 'stone'}));
      for (const c of cs) for (const [y0, y1] of WROWS) cuts.push({t0: c - WW / 2 - off, t1: c + WW / 2 - off, y0, y1, depth: 0.18, back: 'glass', reveal: 'frame'});
      void w;
      // loggias: three round-arched openings in C's top storey (12.9-15.05 m), one wide arch in S (12.9-15.25 m)
      if (s === 'C') for (const c of cs) cuts.push({t0: c - 1.05 - off, t1: c + 1.05 - off, y0: 12.9, y1: 15.05, depth: 1.5, back: 'brick', reveal: 'brick'});
      if (s === 'S') cuts.push({t0: cs[0] - 0.2 - off, t1: cs[1] + 0.2 - off, y0: 12.9, y1: 15.25, depth: 0.3, back: 'glass', reveal: 'brick'});
      zm.emitZone(zf, {t0, t1, y0: 0, y1: top, face: 'brick', cuts} as Zone, t0, t1, 0, top);
    }
  }
  zm.flush();
  for (const s of ['A', 'C', 'B', 'S'] as Sec[]) {
    const [a0, a1] = SEC[s], cs = bayCentres(s), w = (a1 - a0) / BAYS[s], mid = at((a0 + a1) / 2);
    // round grey stone columns before square piers on the inner bay lines (w01-298 thumb: column 0.55 m, pier 0.6 m)
    for (let i = 1; i < cs.length; i++) {
      const {f, t} = at(cs[i] - w / 2);
      if (s === 'C' || s === 'S') {
        // under the pavilions the bays are separate openings: the column stands before the brick pier between them
        column(b, f, t, 0.26, 0.4, WING.arcade - 0.3, 0.27, 'concrete');
        slab(b, f, t, 0, 0.56, 0.4, 0.6, 'concrete');
        slab(b, f, t, WING.arcade - 0.3, 0.56, 0.3, 0.62, 'concrete');
        continue;
      }
      slab(b, f, t, 0, 0.62, WING.arcade, 0.65, 'concrete', -1.2); // square pier
      column(b, f, t, -0.33, 0.4, WING.arcade - 0.3, 0.27, 'concrete');
      slab(b, f, t, 0, 0.66, 0.4, 0.62, 'concrete', -0.64); // base block
      slab(b, f, t, WING.arcade - 0.3, 0.68, 0.3, 0.64, 'concrete', -0.66); // capital block
    }
    // shopfront mullions on the glazing at the back of the arcade
    if (s === 'A' || s === 'B') for (let wt = a0 + 2.0; wt < a1 - 1.0; wt += 1.3) { const {f, t} = at(wt); slab(b, f, t, 0, 0.12, WING.arcade, 0.1, 'dark', -ARC_DEPTH + 0.01); }
    if (s === 'A' || s === 'B') { const {f, t} = at((a0 + a1) / 2); slab(b, f, t, 2.75, a1 - a0 - 1.2, 0.12, 0.1, 'dark', -ARC_DEPTH + 0.01); }
    // entablature over the arcade (light stone, 3.75-4.55 m) and its crown
    slab(b, mid.f, mid.t, WING.arcade, a1 - a0 - 0.02, WING.entab - WING.arcade, 0.12, 'stone');
    slab(b, mid.f, mid.t, WING.entab - 0.12, a1 - a0 + 0.06, 0.14, 0.2, 'stone');
    for (const c of cs) {
      const {f, t} = at(c);
      for (const [y0, y1] of WROWS) {
        // white casement frames: border, transom and mullion (w01-298 thumb)
        bar(b, f, t, y0, WW, 0.09, -0.17);
        bar(b, f, t, y1 - 0.09, WW, 0.09, -0.17);
        for (const k of [-1, 1]) bar(b, f, t + k * (WW / 2 - 0.045), y0, 0.09, y1 - y0, -0.17);
        bar(b, f, t, y0 + (y1 - y0) * 0.72, WW, 0.08, -0.17); // transom
        bar(b, f, t, y0, 0.08, (y1 - y0) * 0.72, -0.17); // mullion
        slab(b, f, t, y0 - 0.16, WW + 0.2, 0.1, 0.1, 'stone'); // sill
      }
    }
    if (s === 'A' || s === 'B') {
      // cornice under the terrace (11.55-12.25 m): fascia and a projecting stone crown
      slab(b, mid.f, mid.t, 11.55, a1 - a0, 0.35, 0.12, 'stone');
      slab(b, mid.f, mid.t, 11.9, a1 - a0 + 0.1, 0.25, 0.45, 'stone'); // top 6-10 cm under the terrace roof
    } else {
      // pavilions: the cornice runs on as a band, and a crown at the pavilion top
      slab(b, mid.f, mid.t, 11.55, a1 - a0 + 0.3, 0.35, 0.18, 'stone');
      slab(b, mid.f, mid.t, 11.9, a1 - a0 + 0.4, 0.35, 0.5, 'stone');
      slab(b, mid.f, mid.t, (s === 'C' ? WING.pav : WING.south) - 0.45, a1 - a0 + 0.3, 0.45, 0.4, 'stone');
    }
  }
  // square brick piers at the pavilion lines, proud through the arcade (w01-298 thumb)
  for (const wt of [SEC.C[0], SEC.C[1], SEC.S[0]]) { const {f, t} = at(wt); slab(b, f, t, 0, 1.0, WING.arcade, 0.1, 'brick'); }
  // loggias: round heads, a white column in each of C's arches, the balustrade panel behind (w01-298)
  for (const c of bayCentres('C')) {
    const {f, t} = at(c);
    spandrels(b, f, t, 15.05, 2.1, 1.5);
    column(b, f, t, -0.35, 12.9, 14.0, 0.13, 'stone');
    slab(b, f, t, 12.75, 2.4, 0.2, 0.12, 'stone');
    slab(b, f, t, 12.9, 2.0, 0.9, 0.05, 'stone', -0.6);
  }
  // S: one round-arched window in white frames over both bays (w10-298 aimed view, w06-297 top left)
  {
    const cs = bayCentres('S'), c = (cs[0] + cs[1]) / 2, w = cs[1] - cs[0] + 0.4, {f, t} = at(c);
    spandrels(b, f, t, 15.25, w, 0.3);
    const s0 = getSink();
    setSink(0);
    archBand(b, f, t, 12.9, w - 0.02, 15.25 - 12.9 - 0.01, 0.1, 0.05, 'frame', -0.28);
    setSink(s0, true);
    for (const k of [-1, 1]) bar(b, f, t + (k * w) / 6, 12.9, 0.08, 15.25 - 12.9 - w / 2 + 0.3, -0.27);
    bar(b, f, t, 12.9 + (15.25 - 12.9 - w / 2), w, 0.08, -0.27);
    slab(b, f, t, 12.75, w + 0.3, 0.2, 0.12, 'stone');
  }
}

/** A thin glazing bar: no sink, shallower than it is wide (the openings audit reads its face, not its sides). */
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number, colour: Col = 'frame') {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, Math.min(0.045, Math.min(w, h) * 0.6), colour, out);
  setSink(s0, true);
}
/** Free-standing round column, its axis `out` off the wall plane (negative: inside an opening). */
function column(b: BuildingTools, f: Frame, t: number, out: number, y0: number, y1: number, r: number, colour: Col) {
  put(b, f, new T.CylinderGeometry(r * 0.9, r, y1 - y0, 10).translate(0, (y1 - y0) / 2, 0), t, y0, out, colour);
}
/** Round head of an opening cut square: the two brick spandrels filling its top corners, through its depth. */
function spandrels(b: BuildingTools, f: Frame, t: number, y1: number, w: number, depth: number) {
  const r = w / 2, n = 8;
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [[s * r, 0], [s * r, -r]];
    for (let k = 1; k <= n; k++) {
      const a = (Math.PI / 2) * (k / n);
      pts.push([s * r * Math.cos(a), -r + r * Math.sin(a)]);
    }
    const s0 = getSink();
    setSink(0);
    poly(b, f, t, y1, pts, depth - 0.02, 'brick', -depth + 0.01);
    setSink(s0, true);
  }
}

/**
 * Classical pediment centred at t: horizontal cornice, tympanum, raking cornices, and a slate gable roof `depth` back.
 * The tympanum stands proud of the roof's front gable so they share no plane.
 */
function pediment(b: BuildingTools, f: Frame, t: number, w: number, foot: number, apex: number, tymp: Col, trim: Col, depth: number, oculus: boolean) {
  const half = w / 2, rise = apex - foot;
  const sh = new T.Shape([new T.Vector2(-half + 0.2, 0), new T.Vector2(half - 0.2, 0), new T.Vector2(0, rise - 0.15)]);
  put(b, f, new T.ExtrudeGeometry(sh, {depth, bevelEnabled: false}).translate(0, 0.02, -depth), t, foot, -0.15, 'slate');
  const s0 = getSink();
  setSink(0);
  poly(b, f, t, foot, [[-half + 0.3, 0], [half - 0.3, 0], [0, rise - 0.25]], 0.25, tymp, -0.1);
  slab(b, f, t, foot - 0.05, w + 0.3, 0.32, 0.5, trim, -0.15);
  const L = Math.hypot(half, rise), a = Math.atan2(rise, half);
  for (const s of [-1, 1] as const) {
    const cg = new T.BoxGeometry(L + 0.25, 0.3, 0.55).translate(0, 0, 0.55 / 2);
    cg.rotateZ(s < 0 ? a : -a);
    put(b, f, cg, t + (s * half) / 2, foot + rise / 2 + 0.05, -0.15, trim);
  }
  if (oculus) slab(b, f, t, foot + rise * 0.3, 0.7, 0.7, 0.06, trim, 0.15);
  setSink(s0, true);
}

// ---------------------------------------------------------------- portico
/**
 * Entrance portico (edge 6 t 1.2-4.3 and its south side, edge 7; w10-298 2021 and its aimed view): an open passage
 * between two square stone piers with capitals to the office doors 2 m back, an entablature at 3.6-4.3 m, a stone upper
 * storey with paired windows, a cornice at 5.9-6.25 m and a pediment to 7.5 m with ball finials on its corners and apex.
 */
function portico(b: BuildingTools) {
  const zm = new ZoneMesh(b);
  const top = 6.6;
  zm.emitZone(bagFrame(RING, 6).f, {t0: 1.2, t1: 4.3, y0: 0, y1: top, face: 'concrete', cuts: [
    {t0: 1.75, t1: 3.75, y0: 0, y1: 3.55, depth: 1.95, back: 'dark', reveal: 'concrete'},
    {t0: 1.95, t1: 2.65, y0: 4.45, y1: 5.65, depth: 0.15, back: 'glass', reveal: 'frame'},
    {t0: 2.85, t1: 3.55, y0: 4.45, y1: 5.65, depth: 0.15, back: 'glass', reveal: 'frame'},
  ]}, 1.2, 4.3, 0, top);
  const {f: z7, len: l7} = bagFrame(RING, 7);
  zm.emitZone(z7, {t0: 0, t1: l7, y0: 0, y1: top, face: 'concrete', cuts: [
    {t0: 0.45, t1: l7 - 0.35, y0: 0.3, y1: 3.3, depth: 0.25, back: 'dark', reveal: 'concrete'},
    {t0: 0.65, t1: 1.35, y0: 4.45, y1: 5.65, depth: 0.15, back: 'glass', reveal: 'frame'},
  ]}, 0, l7, 0, top);
  zm.flush();
  const {f} = E6, tc = 2.75;
  for (const t of [1.475, 4.025]) {
    slab(b, f, t, 0, 0.55, 3.3, 0.1, 'concrete');
    slab(b, f, t, 3.3, 0.7, 0.28, 0.18, 'concrete');
  }
  slab(b, f, tc, 3.6, 3.2, 0.7, 0.1, 'concrete');
  slab(b, f, tc, 4.3, 3.25, 0.12, 0.16, 'concrete');
  for (const t of [2.3, 3.2]) { bar(b, f, t, 5.2, 0.7, 0.06, -0.14); bar(b, f, t, 4.45, 0.06, 1.2, -0.14); }
  slab(b, f, tc, 5.9, 3.4, 0.35, 0.35, 'concrete');
  pediment(b, f, tc, 3.3, top, 7.5, 'concrete', 'concrete', 2.0, false);
  for (const t of [1.3, 4.2]) {
    slab(b, f, t, top, 0.4, 0.3, 0.4, 'concrete');
    put(b, f, new T.SphereGeometry(0.22, 8, 6).translate(0, 0.22, 0.2), t, top + 0.3, 0, 'concrete');
  }
  put(b, f, new T.SphereGeometry(0.2, 8, 6).translate(0, 0.2, 0.2), tc, 7.45, 0, 'concrete');
  slab(b, f, tc, 0, 1.6, 2.7, 0.06, 'glass', -1.95); // the doors at the back of the passage
}

// ---------------------------------------------------------------- office
/** Office storeys (w04-299 2022 crop x 0.92 to the shell's 20.0 m eaves). */
const OF = {cellar: [0.9, 2.85] as P, ground: [3.7, 6.25] as P, base: 7.05, r1: [7.45, 10.0] as P, r2: [10.95, 13.15] as P, cap: 13.4, band: 14.35, attic: [14.85, 16.5] as P};
type Bay = {t: number; w: number};
/**
 * One office front on a frame: a granite skin with rusticated courses split round the openings, segment-arched barred
 * cellar lights and tall ground windows, a base cornice, two brick storeys of 18-pane sashes between stone pilasters with
 * fluted feet and capitals, and (when `attic`) a stone band, an attic storey with relief panels on the pilaster stubs, a
 * frieze and a mutule cornice to `eaves`. `upperOut` moves the upper storeys' plane (edge 8 stands 1 m back above its base).
 */
function officeFront(b: BuildingTools, f: Frame, o: {t0: number; t1: number; bays: Bay[]; pil: number[]; quoins?: number[]; attic: boolean; eaves: number; baseTop?: number; upperOut?: number; r1?: P}) {
  const {t0, t1, bays, pil} = o, mid = (t0 + t1) / 2, len = t1 - t0, base = o.baseTop ?? OF.base;
  slab(b, f, mid, 0, len - 0.1, base - 0.55, 0.04, 'concrete'); // granite skin (the joints)
  const holes = bays.flatMap(bb => [[bb.t - bb.w / 2 - 0.12, bb.t + bb.w / 2 + 0.12, OF.cellar[0] - 0.1, OF.cellar[1] + 0.4], [bb.t - bb.w / 2 - 0.12, bb.t + bb.w / 2 + 0.12, OF.ground[0] - 0.12, OF.ground[1] + 0.12]]);
  for (let y = 0.35; y < base - 0.6; y += 0.56) {
    const yh = Math.min(0.47, base - 0.6 - y);
    if (yh < 0.1) break;
    let runs: P[] = [[t0 + 0.05, t1 - 0.05]];
    for (const [a, c, y0, y1] of holes) {
      if (y + yh <= y0 || y >= y1) continue;
      runs = runs.flatMap(([p, q]) => (c <= p || a >= q ? [[p, q] as P] : ([[p, a], [c, q]] as P[]).filter(([u, v]) => v - u > 0.08)));
    }
    for (const [p, q] of runs) slab(b, f, (p + q) / 2, y, q - p, yh, 0.1, 'concrete');
  }
  slab(b, f, mid, 0, len - 0.1, 0.35, 0.2, 'concrete'); // plinth
  slab(b, f, mid, base - 0.55, len + 0.05, 0.3, 0.24, 'concrete'); // base cornice
  slab(b, f, mid, base - 0.25, len + 0.15, 0.25, 0.34, 'concrete');
  for (const bb of bays) {
    // segment-arched cellar light: dark glazing, bars, and the voussoir band
    const s0 = getSink();
    setSink(0.03);
    slab(b, f, bb.t, OF.cellar[0], bb.w, OF.cellar[1] - OF.cellar[0] - 0.25, 0.17, 'glass');
    poly(b, f, bb.t, OF.cellar[1] - 0.25, segPts(bb.w, 0.3), 0.17, 'glass');
    setSink(s0, true);
    segBand(b, f, bb.t, OF.cellar[1] + 0.05, bb.w + 0.02, 0.3, 0.3, 0.2, 'concrete'); // voussoirs on the glass's arc
    for (let k = -2; k <= 2; k++) bar(b, f, bb.t + (k * bb.w) / 5.5, OF.cellar[0], 0.04, OF.cellar[1] - OF.cellar[0] - 0.05, 0.17, 'bronze');
    bar(b, f, bb.t, OF.cellar[0] + 0.7, bb.w, 0.04, 0.17, 'bronze');
    // ground windows: dark steel frames (w06-297, w04-299)
    sash(b, f, bb.t, OF.ground[0], OF.ground[1], bb.w, 0.04, 4, 'bronze'); // on the granite skin
  }
  const uf: Frame = o.upperOut ? {origin: [f.origin[0] + f.n[0] * o.upperOut, f.origin[1] + f.n[1] * o.upperOut], tangent: f.tangent, n: f.n} : f;
  const top2 = o.attic ? OF.band : o.eaves - 0.95;
  for (const bb of bays) for (const r of [o.r1 ?? OF.r1, OF.r2]) {
    sash(b, uf, bb.t, r[0], r[1], bb.w - 0.1, 0, 3);
    slab(b, uf, bb.t, r[0] - 0.16, bb.w + 0.25, 0.12, 0.16, 'sandstone');
    slab(b, uf, bb.t, r[1] + 0.06, bb.w + 0.1, 0.2, 0.08, 'sandstone');
  }
  for (const t of pil) {
    slab(b, uf, t, base, 0.72, OF.cap - base, 0.2, 'sandstone');
    for (let k = -2; k <= 2; k++) bar(b, uf, t + k * 0.12, base + 0.2, 0.08, 2.3, 0.2, 'stone'); // fluted foot
    slab(b, uf, t, OF.cap, 0.9, 0.35, 0.3, 'sandstone'); // capital
    slab(b, uf, t, OF.cap + 0.35, 1.0, top2 - OF.cap - 0.35, 0.36, 'sandstone');
  }
  for (const t of o.quoins ?? []) for (let y = base, k = 0; y < top2 - 0.3; y += 0.6, k++) slab(b, uf, t, y, k % 2 ? 0.7 : 0.95, 0.5, 0.12, 'sandstone');
  if (!o.attic) return;
  slab(b, uf, mid, OF.band, len + 0.1, 0.4, 0.3, 'sandstone');
  slab(b, uf, mid, OF.band + 0.4, len - 0.1, o.eaves - OF.band - 0.4, 0.06, 'sandstone'); // stone attic facing (5 cm short of each end: the scan's corner returns)
  for (const bb of bays) {
    sash(b, uf, bb.t, OF.attic[0], Math.min(OF.attic[1], o.eaves - 2.65), bb.w - 0.1, 0.06, 2);
    slab(b, uf, bb.t, OF.attic[0] - 0.14, bb.w + 0.2, 0.1, 0.2, 'sandstone');
  }
  for (const t of pil) {
    slab(b, uf, t, OF.band + 0.45, 0.72, o.eaves - 2.6 - OF.band - 0.45, 0.2, 'sandstone'); // pilaster stub
    slab(b, uf, t, OF.band + 0.75, 0.42, o.eaves - 3.15 - OF.band - 0.45, 0.26, 'stone'); // relief panel
  }
  const fr = o.eaves - 2.5;
  slab(b, uf, mid, fr, len + 0.1, 0.65, 0.16, 'stone'); // frieze
  slab(b, uf, mid, fr + 0.65, len + 0.2, 0.35, 0.3, 'sandstone');
  for (let t = t0 + 0.3; t < t1 - 0.2; t += 0.62) slab(b, uf, t, fr + 1.0, 0.3, 0.35, 0.75, 'sandstone'); // mutules
  slab(b, uf, mid, fr + 1.35, len + 0.6, 0.5, 1.0, 'sandstone'); // corona
  slab(b, uf, mid, fr + 1.85, len + 0.7, 0.3, 1.05, 'sandstone');
}
/** Segmental head (chord w, rise) as a closed outline over y = 0. */
const segPts = (w: number, rise: number): [number, number][] => {
  const R = (w * w / 4 + rise * rise) / (2 * rise), pts: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 7; i >= 1; i--) { const x = -w / 2 + (w * i) / 8; pts.push([x, rise - R + Math.sqrt(R * R - x * x)]); }
  return pts;
};
/** Sash window: white frame, glass, meeting rail, `cols`-1 vertical bars and two horizontal bars per sash. */
function sash(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, out: number, cols: number, frame: Col = 'frame') {
  const s0 = getSink();
  setSink(0.03);
  // glass 6 cm proud, the frame a border 12 cm proud round it: no face of the one lies within 2-3 cm of the other's
  slab(b, f, t, y0, w - 0.04, y1 - y0, 0.06, 'glass', out);
  slab(b, f, t, y0 - 0.06, w + 0.12, 0.1, 0.12, frame, out);
  slab(b, f, t, y1 - 0.04, w + 0.12, 0.1, 0.12, frame, out);
  for (const k of [-1, 1]) slab(b, f, t + k * (w / 2 + 0.01), y0 + 0.04, 0.1, y1 - y0 - 0.08, 0.12, frame, out);
  setSink(s0, true);
  const ym = (y0 + y1) / 2;
  bar(b, f, t, ym - 0.035, w - 0.04, 0.07, out + 0.06, frame);
  // glazing bars 4 cm wide, 3.5 cm deep: shallower than wide, and 3.5 cm off the glass
  const s1 = getSink();
  setSink(0);
  for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + (w * k) / cols, y0, 0.04, y1 - y0, 0.035, frame, out + 0.06);
  for (const yy of [y0 + (ym - y0) / 3, y0 + (2 * (ym - y0)) / 3, ym + (y1 - ym) / 3, ym + (2 * (y1 - ym)) / 3]) slab(b, f, t, yy, w - 0.04, 0.04, 0.035, frame, out + 0.06);
  setSink(s1, true);
}

/**
 * The office fronts. Bays and pilasters per crop (50 px/m): edge 8 w06-297 (2024), edge 10 w04-299 (2022), edge 16
 * w05-193 (2021) and w03-193 (2022). Edge 8 has no attic: its cornice and the balustrade with urns over the pilaster dies
 * stand at the shell's 14.4-14.9 m, its upper storeys on the scan's upper wall 1 m back.
 */
function officeFronts(b: BuildingTools) {
  const e8 = E8.f;
  officeFront(b, e8, {t0: 0, t1: E8.len, bays: [{t: 1.15, w: 1.4}, {t: 4.15, w: 1.4}, {t: 7.3, w: 1.4}], pil: [2.65, 5.75], quoins: [9.05], attic: false, eaves: 14.9, baseTop: 7.9, upperOut: -0.97, r1: [8.2, 10.25]});
  const u8: Frame = {origin: [e8.origin[0] - e8.n[0], e8.origin[1] - e8.n[1]], tangent: e8.tangent, n: e8.n};
  slab(b, u8, E8.len / 2, 13.95, E8.len, 0.45, 0.4, 'sandstone');
  slab(b, u8, E8.len / 2, 14.4, E8.len + 0.2, 0.25, 0.55, 'sandstone');
  balustrade(b, u8, 0.2, E8.len - 0.1, 14.65, [0.45, 2.65, 5.75, E8.len - 0.35]);
  for (const t of [2.65, 5.75]) urn(b, u8, t, 15.7);
  // edge 10, the pedimented risalit: three bays, quoins at both ends
  officeFront(b, E10.f, {t0: 0, t1: E10.len, bays: [{t: 2.1, w: 1.45}, {t: 5.3, w: 1.45}, {t: 8.45, w: 1.45}], pil: [3.75, 6.9], quoins: [0.4, E10.len - 0.4], attic: true, eaves: 20.0});
  pediment(b, E10.f, E10.len / 2, E10.len + 0.5, 20.05, 22.7, 'sandstone', 'sandstone', 6.0, false);
  // edges 12-14: the chamfered corner, one bay per facet
  for (const e of [12, 13, 14]) {
    const {f, len} = ringFrame(ring, e, e === 14 ? 0.22 : 0);
    officeFront(b, f, {t0: 0, t1: len, bays: [{t: len / 2, w: Math.min(1.3, len - 1.2)}], pil: [], attic: true, eaves: 20.0});
  }
  // edge 16: the Keizersgracht risalit (t 0-10.5, pediment) and the four bays to the east (eaves 19.0)
  officeFront(b, E16.f, {t0: 0, t1: 10.5, bays: [{t: 2.1, w: 1.45}, {t: 5.5, w: 1.45}, {t: 8.9, w: 1.45}], pil: [3.75, 7.25], quoins: [0.42, 10.08], attic: true, eaves: 20.0});
  pediment(b, E16.f, 5.25, 10.6, 20.05, 22.6, 'sandstone', 'sandstone', 6.0, false);
  officeFront(b, E16.f, {t0: 10.5, t1: E16.len, bays: [12.2, 15.5, 18.75, 22.0].map(t => ({t, w: 1.45})), pil: [13.85, 17.1, 20.4], quoins: [E16.len - 0.55], attic: true, eaves: 19.0});
}
/** Balustrade: plinth, balusters, rail, and dies at `dies`. */
function balustrade(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, dies: number[]) {
  slab(b, f, (t0 + t1) / 2, y, t1 - t0, 0.15, 0.4, 'sandstone');
  for (let t = t0 + 0.2; t < t1 - 0.1; t += 0.3) if (!dies.some(d => Math.abs(d - t) < 0.4)) slab(b, f, t, y + 0.15, 0.13, 0.6, 0.14, 'sandstone', 0.13);
  slab(b, f, (t0 + t1) / 2, y + 0.75, t1 - t0, 0.16, 0.4, 'sandstone');
  for (const d of dies) slab(b, f, d, y, 0.5, 1.05, 0.5, 'sandstone');
}
/** Urn on a die: foot, body, lid. */
function urn(b: BuildingTools, f: Frame, t: number, y: number) {
  put(b, f, new T.CylinderGeometry(0.12, 0.17, 0.2, 8).translate(0, 0.1, 0.25), t, y, 0, 'sandstone');
  put(b, f, new T.SphereGeometry(0.24, 8, 6).scale(1, 1.15, 1).translate(0, 0.45, 0.25), t, y, 0, 'sandstone');
  put(b, f, new T.ConeGeometry(0.12, 0.3, 8).translate(0, 0.85, 0.25), t, y, 0, 'sandstone');
}

// ---------------------------------------------------------------- backs
/** The wing's courtyard back (edge 28), unphotographed (inferred): a plain grid of windows under the shell's wall tops. */
function backs(b: BuildingTools) {
  const {f, len} = ringFrame(ring, 28);
  for (const [t0, t1, top] of [[0.6, 9.9, 15.4], [9.9, 16.6, 15.4], [16.7, 36.4, 12.3], [36.4, len - 0.4, 15.3]] as [number, number, number][]) {
    rowFront(b, f, {t0, t1, top, bays: Math.max(1, Math.round((t1 - t0) / 2.6)), storeys: storeysUnder(top, {ground: 0.2, floor: 3.6, winH: 1.8, attic: 0.8}), margin: 0.4, winW: 1.2, frame: 'frame', glass: 'glass', sill: 'stone'});
  }
}
