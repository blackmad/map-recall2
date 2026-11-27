import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, disc, getSink, letters, poly, put, ringSlab, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {neckGable} from './neck-gable';
import {stripedAwningOn} from './striped-awning-kit';
import source from './hajenius-rokin-footprints.json';

/**
 * ROKIN 92-96 (BAG pand 0363100012168350, BAG year 1914): the sandstone Hajenius tobacco house with its red awnings, and
 * the two narrow houses that share its pand on the Rokin, the cream art-nouveau house with the bell gable and striped
 * markiezen on the lane corner and the black neck-gable house between them.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). The cream house's front walls are cut at its
 * bell gable's foot (18.6 m; the 3DBAG draws a flat 22 m box) and the gable is drawn here; the black house's 14.3 m front
 * gets its neck gable on top; the Hajenius front stands on one stone wall plane 5 cm before the shell's most proud front
 * wall (the shell steps 0.3-0.65 m back at the shop bays).
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0): one whole-face rectified crop of the 27.3 m Rokin front (BAG ring
 * vertex 18 to vertex 7) out of recording_2025-06-16_06-42-40_01743 (2025, 36 px/m, h = (905 - y) / 36; the Hajenius
 * cornice lands on the 3DBAG's 70th-percentile roof, 20.1 m) and the same face out of TMX7316010203-000709_pano_0000_001134
 * (2018, sunlit) for colours and the awnings. t runs from the lane corner (south, the viewer's left) along the front:
 * the cream house 0-5.42 m, the black house 5.42-10.63 m, Hajenius 10.63-27.33 m (photo px / 36).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const R = src.facadeRing;
type V2 = [number, number];
type Col = 'stone' | 'sandstone' | 'slate' | 'concrete' | 'greyBrick' | 'glass' | 'frame' | 'dark' | 'red' | 'white' | 'bronze' | 'ochre' | 'copper';
const S = (c: Col) => c as never;

const V = (i: number, at: V2): V2 => {
  const p = R[i];
  if (!p || Math.hypot(p[0] - at[0], p[1] - at[1]) > 0.05) throw new Error(`hajenius: facade ring vertex ${i} moved (${p})`);
  return [p[0], p[1]];
};
const A = V(18, [3.644, 15.454]), C = V(7, [10.018, -11.116]);
const RK: Frame = (() => {
  const l = Math.hypot(C[0] - A[0], C[1] - A[1]), u: V2 = [(C[0] - A[0]) / l, (C[1] - A[1]) / l];
  return {origin: A, tangent: u, n: [-u[1], u[0]]};
})();
/** The two narrow houses' own front line (BAG edge 18, 10.63 m; 0.6 deg off the whole front's line). */
const EF: Frame = (() => {
  const c = V(19, [6.229, 5.144]), l = Math.hypot(c[0] - A[0], c[1] - A[1]), u: V2 = [(c[0] - A[0]) / l, (c[1] - A[1]) / l];
  return {origin: A, tangent: u, n: [-u[1], u[0]]};
})();
const off = (x: number, z: number) => (x - A[0]) * RK.n[0] + (z - A[1]) * RK.n[1];
const along = (x: number, z: number) => (x - A[0]) * RK.tangent[0] + (z - A[1]) * RK.tangent[1];

/** House lines along the Rokin front (t). */
const CREAM: V2 = [0, 5.42], BLACK: V2 = [5.42, 10.63], HJ0 = 10.63, HJ1 = 27.33;
/** Hajenius: t of the crop's features from its south edge, (photo px - 383) / 36. */
const hj = (u: number) => HJ0 + u;
const BELL_FOOT = 18.6;

export function buildHajeniusRokin(_w: number, _d: number, b: BuildingTools) {
  // shell walls on the Hajenius front: the most proud decides the stone plane
  let proud = -1;
  for (const s of src.surfaces) {
    if (s.type !== 'WallSurface') continue;
    const p = s.rings[0], o = p.map(q => off(q[0], q[2])), t = p.map(q => along(q[0], q[2]));
    if (Math.min(...t) > HJ0 - 0.1 && Math.max(...o) - Math.min(...o) < 0.05 && Math.min(...o) > -1) proud = Math.max(proud, ...o);
  }
  if (proud < 0 || proud > 0.3) throw new Error(`hajenius: unexpected proud front wall ${proud}`);
  // the cream house's front walls end at its bell gable's foot
  const creamFront = (s: Surface) => {
    if (s.type !== 'WallSurface') return false;
    const p = s.rings[0], o = p.map(q => off(q[0], q[2])), t = p.map(q => along(q[0], q[2]));
    return Math.max(...o) < 0.05 && Math.min(...o) > -0.05 && Math.max(...t) < CREAM[1] - 0.2 && Math.max(...p.map(q => q[1])) > 20;
  };
  let cut = 0;
  const surfaces = src.surfaces.map(s => creamFront(s) && ++cut ? {...s, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], BELL_FOOT), p[2]]))} : s);
  if (cut !== 3) throw new Error(`hajenius: expected three cream front walls, cut ${cut}`);
  addShell(b, {...src, surfaces} as never, {wall: 'stone', roof: 'slate', wallFor: s => wallColour(s)});
  const sink0 = getSink();
  setSink(0.06, true);
  cream(b);
  black(b);
  hajenius(b, proud + 0.05);
  setSink(sink0);
}

/** Shell wall colour by the house strip it stands in (centroid along the front). */
function wallColour(s: Surface): string {
  const p = s.rings[0], t = p.reduce((a, q) => a + along(q[0], q[2]), 0) / p.length;
  if (t < CREAM[1]) return 'concrete';
  if (t >= BLACK[1]) return 'stone';
  // in the black strip, walls rising past its 14.4 m roof are its neighbours' flanks: the cream house's and Hajenius's
  return Math.max(...p.map(q => q[1])) > 14.6 ? (t < (BLACK[0] + BLACK[1]) / 2 ? 'concrete' : 'stone') : 'greyBrick';
}

// ---------------------------------------------------------------- the cream house (bell gable, striped markiezen)
function cream(b: BuildingTools) {
  const F = RK, [t0, t1] = CREAM, tc = (t0 + t1) / 2, o = 0; // the cream front follows the whole front's line, the black one its own edge
  const lights = [1.25, 2.7, 4.25]; // the three light axes (crop x 25-65, 75-120, 130-175)
  // bell gable over the cut front: vertical flanks, a concave waist, a convex shoulder and a curled top (crop 0, x 0-195)
  const half = (t1 - t0) / 2;
  // widths off the 2025 crop: vertical to 19.6 m, a concave waist to half 1.6 m at 20.9 m, convex to half 1.1 m at 22.4 m, the dome to 23.2 m
  const bell: V2[] = [[-half, 0], [-half, 1.0], [-half + 0.3, 1.6], [-1.95, 2.0], [-1.65, 2.3], [-1.55, 2.8], [-1.42, 3.4], [-1.12, 3.85], [-0.75, 4.25], [-0.38, 4.5], [0, 4.6],
    [0.38, 4.5], [0.75, 4.25], [1.12, 3.85], [1.42, 3.4], [1.55, 2.8], [1.65, 2.3], [1.95, 2.0], [half - 0.3, 1.6], [half, 1.0], [half, 0]];
  poly(b, F, tc, BELL_FOOT, bell, 0.55, S('concrete'), o - 0.5);
  // the moulded rim round the bell (a strip proud of it) and the top curl
  for (let i = 1; i < bell.length - 2; i++) {
    const [p, q] = [bell[i], bell[i + 1]], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const m = new T.BoxGeometry(L + 0.04, 0.12, 0.12).translate(0, -0.06, 0.06).rotateZ(Math.atan2(q[1] - p[1], q[0] - p[0]));
    put(b, F, m, tc + (p[0] + q[0]) / 2, BELL_FOOT + (p[1] + q[1]) / 2, o + 0.05, S('concrete'));
  }
  disc(b, F, tc, BELL_FOOT + 4.5, 0.22, 0.2, S('concrete'), o + 0.05);
  // gable window pair (17.1-18.4 m) under a domed striped hood (18.3-19.4 m)
  for (const s of [-1, 1]) creamWindow(b, F, tc + s * 0.62, 0.8, 17.1, 18.4, o);
  stripedAwningOn(b, F, {head: [[tc - 1.25, o], [tc + 1.25, o]], yHead: 19.4, drop: 0.9, proj: 0.7, stripe: 0.22, valance: 0.12, scallop: 0.08, cheeks: true, dome: 4, colours: ['ochre', 'concrete']});
  // fourth storey: three round-headed lights (13.75-15.55) under one deep half-round markies (16.0-16.9), a balcony on the middle light
  for (const t of lights) {
    roundHead(b, F, t, 13.75, 1.05, 1.8, 0.03, S('white'), o);
    roundHead(b, F, t, 13.8, 0.95, 1.72, 0.1, S('glass'), o);
  }
  stripedAwningOn(b, F, {head: [[t0 + 0.3, o], [t1 - 0.3, o]], yHead: 16.95, drop: 1.0, proj: 0.95, stripe: 0.24, valance: 0.15, scallop: 0.1, cheeks: true, dome: 4, colours: ['ochre', 'concrete']});
  balcony(b, F, lights[1], 13.5, 1.3, o);
  // third storey (11.25-12.6) with small hoods, the full-width balcony under it (10.4-11.4)
  for (const t of lights) {
    creamWindow(b, F, t, 1.0, 11.25, 12.6, o);
    stripedAwningOn(b, F, {head: [[t - 0.6, o], [t + 0.6, o]], yHead: 13.05, drop: 0.35, proj: 0.4, stripe: 0.2, valance: 0.1, scallop: 0.06, cheeks: true, colours: ['ochre', 'concrete']});
  }
  balcony(b, F, tc, 10.4, t1 - t0 - 0.3, o);
  // second storey (7.4-9.7)
  for (const t of lights) creamWindow(b, F, t, 1.05, 7.4, 9.7, o);
  slab(b, F, tc, 7.15, t1 - t0 - 0.2, 0.16, 0.2, S('concrete'), o);
  // ground storey: transom lights (4.3-5.0) under the wide straight striped markies (5.0-6.5), the sign board, the shop glass
  for (const t of lights) creamWindow(b, F, t, 1.1, 4.3, 5.0, o);
  stripedAwningOn(b, F, {head: [[t0 + 0.15, o], [t1 - 0.15, o]], yHead: 6.5, drop: 1.25, proj: 0.9, stripe: 0.25, valance: 0.22, scallop: 0.12, cheeks: true, colours: ['ochre', 'concrete']});
  slab(b, F, tc, 3.1, t1 - t0 - 0.3, 0.75, 0.12, S('concrete'), o);
  slab(b, F, tc, 3.3, 2.6, 0.32, 0.06, S('dark'), o + 0.12);
  slab(b, F, tc, 0.25, t1 - t0 - 1.1, 2.7, 0.08, S('glass'), o);
  for (const t of [t0 + 0.3, t1 - 0.3]) slab(b, F, t, 0, 0.45, 3.1, 0.2, S('concrete'), o);
}
function creamWindow(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, o: number) {
  pane(b, F, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.04, S('white'), o);
  pane(b, F, t, y0, w, y1 - y0, 0.1, S('glass'), o);
  put(b, F, new T.BoxGeometry(w, 0.07, 0.04).translate(0, 0.035, 0.02), t, y0 + (y1 - y0) * 0.55, o + 0.1, S('white'));
}
/** A box standing on the wall plane at `o` (no sink): window parts, so the openings audit sees them on the wall, not in it. */
function pane(b: BuildingTools, F: Frame, t: number, y: number, w: number, h: number, d: number, c: never, o: number) {
  put(b, F, new T.BoxGeometry(w, h, d).translate(0, h / 2, d / 2), t, y, o, c);
}
/** A round-headed slab (no sink: it stands on its wall). */
function roundHead(b: BuildingTools, F: Frame, t: number, y: number, w: number, h: number, d: number, c: never, o: number) {
  const r = w / 2, s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  put(b, F, new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 8}), t, y, o, c);
}
/** A balcony: stone floor slab, a dark rail on bar balusters. */
function balcony(b: BuildingTools, F: Frame, t: number, y: number, w: number, o: number) {
  slab(b, F, t, y, w, 0.16, 0.6, S('concrete'), o);
  slab(b, F, t, y + 0.95, w, 0.05, 0.05, S('bronze'), o + 0.55);
  const n = Math.max(3, Math.round(w / 0.25));
  for (let k = 0; k <= n; k++) slab(b, F, t - w / 2 + 0.03 + k * (w - 0.06) / n, y + 0.16, 0.03, 0.8, 0.03, S('bronze'), o + 0.55);
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 - 0.02), y + 0.16, 0.04, 0.84, 0.55, S('bronze'), o);
}

// ---------------------------------------------------------------- the black neck-gable house
function black(b: BuildingTools) {
  const F = EF, [t0, t1] = BLACK, tc = (t0 + t1) / 2, o = -0.015, shoulder = 14.3;
  neckGable(b, F, {x0: t0 + 0.05, x1: t1 - 0.05, axis: tc, neckHalf: 1.45, shoulderY: shoulder, clawTopY: 16.6, corniceY: 16.85, corniceH: 0.25,
    corniceHalf: 1.75, apexY: 17.9, thick: 0.5, crown: 'segment', footScroll: false}, {wall: 'greyBrick', trim: 'concrete'});
  // pale scroll claws either side of the neck (the crop's carved volutes at 14.3-15.3 m) and the crown shell
  for (const s of [-1, 1]) {
    disc(b, F, tc + s * 1.8, shoulder + 0.45, 0.34, 0.16, S('concrete'), o - 0.1);
    disc(b, F, tc + s * 2.25, shoulder + 0.25, 0.2, 0.18, S('concrete'), o - 0.1);
  }
  disc(b, F, tc, 17.35, 0.3, 0.14, S('concrete'), o + 0.1);
  // the hoisting window in the neck (14.0-15.0 m in the crop; raised to 14.45 m to clear the shell's 14.4 m roof edge)
  slab(b, F, tc, 14.45, 0.85, 0.9, 0.1, S('white'), o);
  // two white-framed sash windows per storey, a sill and a low guard rail each
  for (const t of [tc - 1.1, tc + 1.1]) {
    for (const [y0, y1] of [[4.5, 7.2], [8.3, 10.55], [11.6, 13.4]] as V2[]) {
      pane(b, F, t, y0 - 0.06, 1.56, y1 - y0 + 0.12, 0.04, S('white'), o);
      pane(b, F, t, y0, 1.44, y1 - y0, 0.1, S('glass'), o);
      put(b, F, new T.BoxGeometry(1.44, 0.07, 0.04).translate(0, 0.035, 0.02), t, y0 + (y1 - y0) * 0.5, o + 0.1, S('white'));
      slab(b, F, t, y0 + 0.3, 1.4, 0.04, 0.04, S('bronze'), o + 0.16);
      slab(b, F, t, y0 - 0.18, 1.66, 0.1, 0.2, S('concrete'), o);
    }
  }
  // the red shop fascia (3.6-4.25 m) and the shop glass under it
  slab(b, F, tc, 3.6, t1 - t0 - 0.1, 0.65, 0.16, S('red'), o);
  slab(b, F, tc, 0.3, t1 - t0 - 1.0, 3.1, 0.08, S('glass'), o);
  for (const t of [t0 + 0.25, t1 - 0.25]) slab(b, F, t, 0, 0.4, 3.6, 0.16, S('greyBrick'), o);
}

// ---------------------------------------------------------------- Hajenius
/** Pilasters (t from the house's south edge), (crop px - 383) / 36. */
const PIL: V2[] = [[0.08, 1.17], [4.39, 5.22], [7.42, 8.25], [11.42, 12.39], [16.17, 16.62]];
const BAYS = [{c: 2.75, kind: 'triple'}, {c: 6.32, kind: 'single'}, {c: 9.84, kind: 'triple'}, {c: 14.28, kind: 'end'}] as const;
const ROWS: V2[] = [[9.2, 11.5], [12.45, 14.9], [15.75, 18.2]];
const CORNICE: V2 = [19.6, 20.1], STRING: V2 = [8.75, 9.1];

function hajenius(b: BuildingTools, o: number) {
  const F = RK, t0 = HJ0 + 0.07, t1 = HJ1, tm = (t0 + t1) / 2;
  // the stone wall plane over the stepped shell, from the pavement to the cornice
  slab(b, F, tm, 0, t1 - t0, CORNICE[0], 0.95, S('stone'), o - 0.95);
  // pilasters through the upper storeys with a recessed panel and a capital; plain piers in the ground zone
  for (const [a, c] of PIL) {
    const t = hj((a + c) / 2), w = c - a;
    slab(b, F, t, 0, w, STRING[0], 0.12, S('stone'), o);
    // flush with the window glass: a pilaster face proud of the glass reads to the openings audit as wall the glass is buried in
    slab(b, F, t, STRING[1], w, 17.97 - STRING[1], 0.1, S('stone'), o);
    slab(b, F, t, STRING[1] + 0.4, w - 0.36, 17.4 - STRING[1] - 0.4, 0.05, S('sandstone'), o + 0.1);
    slab(b, F, t, 17.97, w + 0.12, 0.63, 0.24, S('sandstone'), o);
    for (const s of [-1, 1]) disc(b, F, t + s * (w / 2 - 0.08), 18.35, 0.11, 0.08, S('stone'), o + 0.24);
  }
  // string course over the ground zone, frieze, cornice with modillions
  slab(b, F, tm, STRING[0], t1 - t0, STRING[1] - STRING[0], 0.3, S('stone'), o);
  slab(b, F, tm, 18.75, t1 - t0, CORNICE[0] - 18.75, 0.1, S('stone'), o);
  slab(b, F, tm, CORNICE[0], t1 - t0 + 0.1, 0.18, 0.4, S('stone'), o);
  slab(b, F, tm, CORNICE[0] + 0.18, t1 - t0 + 0.2, CORNICE[1] - CORNICE[0] - 0.18, 0.62, S('stone'), o);
  for (let t = t0 + 0.25; t < t1 - 0.1; t += 0.5) slab(b, F, t, CORNICE[0] - 0.22, 0.14, 0.22, 0.34, S('sandstone'), o);
  // upper storeys
  for (const bay of BAYS) {
    const t = hj(bay.c);
    for (const [k, [y0, y1]] of ROWS.entries()) {
      if (bay.kind === 'triple') tripleWindow(b, F, t, y0, y1, o);
      else hjWindow(b, F, t, bay.kind === 'single' ? 1.9 : 1.5, y0, y1, o, true);
      // paterae in the spandrel over each window (not over the top row); carved panels in the end bay
      if (k < 2) {
        const ys = y1 + (ROWS[k + 1][0] - y1) / 2;
        if (bay.kind === 'end') slab(b, F, t, ys - 0.27, 1.4, 0.55, 0.1, S('sandstone'), o);
        else {
          const n = bay.kind === 'triple' ? 6 : 4, w = bay.kind === 'triple' ? 2.7 : 1.6;
          for (let i = 0; i < n; i++) disc(b, F, t - w / 2 + (i + 0.5) * w / n, ys, 0.1, 0.07, S('sandstone'), o);
        }
      }
      slab(b, F, t, y0 - 0.22, bay.kind === 'triple' ? 3.1 : bay.kind === 'single' ? 2.1 : 1.7, 0.14, 0.22, S('stone'), o);
    }
  }
  // ground zone: the window row at 5.3-7.8 m (wide lights over low red-framed sashes) on a sill
  for (const bay of BAYS) {
    const t = hj(bay.c), w = bay.kind === 'triple' ? 2.95 : 1.9;
    hjWindow(b, F, t, w, 5.3, 7.8, o, true, 0.28);
    slab(b, F, t, 5.08, w + 0.3, 0.16, 0.22, S('stone'), o);
  }
  // shop windows behind the red awnings in the outer bays
  for (const c of [BAYS[0].c, BAYS[2].c]) {
    const t = hj(c);
    slab(b, F, t, 0.45, 3.0, 3.25, 0.04, S('red'), o);
    slab(b, F, t, 0.55, 2.8, 3.05, 0.1, S('glass'), o);
    stripedAwningOn(b, F, {head: [[t - 1.6, o], [t + 1.6, o]], yHead: 4.25, drop: 1.0, proj: 1.1, stripe: 0.4, valance: 0.3, scallop: 0, cheeks: true, colours: ['red', 'red']});
    letters(b, F, 'P.G.C. HAJENIUS', t, 3.0, o + 1.12, 0.025, 0.02, S('concrete'), 0.025);
  }
  // middle bay: the red shutter door in a stone reveal under the carved cartouche
  {
    const t = hj(BAYS[1].c);
    slab(b, F, t, 0, 2.2, 3.05, 0.04, S('stone'), o);
    slab(b, F, t, 0.05, 1.9, 2.95, 0.1, S('red'), o);
    for (let y = 0.35; y < 2.9; y += 0.3) slab(b, F, t, y, 1.9, 0.04, 0.04, S('red'), o + 0.1);
    archBand(b, F, t, 3.05, 3.3, 1.8, 0.18, 0.3, S('sandstone'), o);
    slab(b, F, t, 3.05, 3.0, 0.34, 0.24, S('stone'), o);
    letters(b, F, 'P.G.C. HAJENIUS', t, 3.13, o + 0.24, 0.028, 0.02, S('sandstone'), 0.028);
    slab(b, F, t, 3.5, 2.4, 1.05, 0.12, S('stone'), o);
    poly(b, F, t, 3.6, [[-0.45, 0], [0.45, 0], [0.45, 0.6], [0, 0.9], [-0.45, 0.6]], 0.14, S('sandstone'), o + 0.12);
    disc(b, F, t, 3.95, 0.18, 0.08, S('stone'), o + 0.26);
  }
  // end bay: wooden door, three small lights over it, the carved name over its first window
  {
    const t = hj(BAYS[3].c);
    slab(b, F, t, 0, 1.75, 2.5, 0.04, S('stone'), o);
    slab(b, F, t, 0.05, 1.5, 2.35, 0.1, S('copper'), o);
    for (const y of [0.35, 1.35]) slab(b, F, t, y, 1.2, 0.8, 0.04, S('copper'), o + 0.1);
    for (const k of [-1, 0, 1]) hjWindow(b, F, t + k * 0.72, 0.55, 3.2, 4.4, o, false);
    letters(b, F, 'DE RIJNSTROOM', t, 8.38, o + 0.3, 0.032, 0.03, S('sandstone'), 0.04);
  }
  endGable(b, F, o);
  dormers(b, F, o);
}

/** A Hajenius light: red-brown frame plate, glass, a cream sun blind over the upper part (in `white`, an opening material: a blind in a host colour reads as wall burying the glass), the sash rail. */
function hjWindow(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, o: number, blind: boolean, sash = 0.32) {
  pane(b, F, t, y0 - 0.07, w + 0.14, y1 - y0 + 0.14, 0.04, S('frame'), o);
  pane(b, F, t, y0, w, y1 - y0, 0.1, S('glass'), o);
  const ys = y0 + sash * (y1 - y0);
  if (blind) put(b, F, new T.BoxGeometry(w - 0.04, y1 - ys - 0.03, 0.06).translate(0, (y1 - ys - 0.03) / 2, 0.03), t, ys, o + 0.1, S('white'));
  put(b, F, new T.BoxGeometry(w, 0.07, 0.05).translate(0, 0.035, 0.025), t, ys - 0.07, o + 0.1, S('frame'));
}
/** The outer bays' three-light window: narrow, wide, narrow between stone mullions. */
function tripleWindow(b: BuildingTools, F: Frame, t: number, y0: number, y1: number, o: number) {
  hjWindow(b, F, t - 1.2, 0.5, y0, y1, o, true);
  hjWindow(b, F, t, 1.45, y0, y1, o, true);
  hjWindow(b, F, t + 1.2, 0.5, y0, y1, o, true);
  for (const s of [-1, 1]) slab(b, F, t + s * 0.88, y0 - 0.07, 0.2, y1 - y0 + 0.14, 0.12, S('stone'), o);
}
/** The end bay's crown: a curved gable with scrolled shoulders and an oculus (20.1-22.0 m). */
function endGable(b: BuildingTools, F: Frame, o: number) {
  const t = hj(14.5), half = 2.08, base = CORNICE[1];
  const prof: V2[] = [[-half, 0], [-half, 0.55], [-half + 0.3, 0.85], [-half + 0.55, 0.85], [-1.2, 1.35], [-0.8, 1.7], [-0.4, 1.86], [0, 1.9], [0.4, 1.86], [0.8, 1.7], [1.2, 1.35], [half - 0.55, 0.85], [half - 0.3, 0.85], [half, 0.55], [half, 0]];
  poly(b, F, t, base, prof, 0.6, S('stone'), o - 0.55);
  for (let i = 3; i < prof.length - 4; i++) {
    const [p, q] = [prof[i], prof[i + 1]], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const m = new T.BoxGeometry(L + 0.05, 0.16, 0.14).translate(0, -0.08, 0.07).rotateZ(Math.atan2(q[1] - p[1], q[0] - p[0]));
    put(b, F, m, t + (p[0] + q[0]) / 2, base + (p[1] + q[1]) / 2, o + 0.05, S('sandstone'));
  }
  for (const s of [-1, 1]) disc(b, F, t + s * (half - 0.35), base + 0.7, 0.22, 0.16, S('sandstone'), o + 0.05);
  ringSlab(b, F, t, base + 0.5, 0.38, 0.6, 0.2, S('sandstone'), o + 0.05, 16);
  disc(b, F, t, base + 0.5, 0.38, 0.12, S('glass'), o + 0.05);
  segBand(b, F, t, base + 1.15, 1.4, 0.3, 0.12, 0.18, S('sandstone'), o + 0.05);
}
/**
 * Three small dormers over the bays in the slate mansard (the 3DBAG's front slope rises about 1.4 m per metre from the
 * 19.6 m eaves, so a face 0.9 m behind the wall plane stands on the slope at 20.4-20.6 m; the sill 0.4 m above it), and the two finials at the ridge ends.
 */
function dormers(b: BuildingTools, F: Frame, o: number) {
  const f0 = o - 0.9, y0 = 20.8;
  for (const c of [BAYS[0].c, BAYS[1].c, BAYS[2].c]) {
    const t = hj(c);
    slab(b, F, t, y0 - 0.4, 1.0, 1.4, 1.2, S('slate'), f0 - 1.2);
    pane(b, F, t, y0, 1.0, 1.0, 0.08, S('white'), f0); // the painted dormer front, one assembly with its light
    pane(b, F, t, y0 + 0.15, 0.6, 0.65, 0.06, S('glass'), f0 + 0.08);
    poly(b, F, t, y0 + 1.0, [[-0.6, 0], [0.6, 0], [0, 0.4]], 0.3, S('stone'), f0 - 0.2);
  }
  for (const c of [3.97, 12.37]) put(b, F, new T.ConeGeometry(0.1, 0.9, 6).translate(0, 0.45, 0), hj(c), 24.85, o - 4.2, S('bronze'));
}
