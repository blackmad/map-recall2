import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, put, setSink, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import source from './batavia-prins-hendrikkade-footprints.json';

/**
 * GEBOUW BATAVIA, Prins Hendrikkade (BAG pand 0363100012171926, BAG year 1703, rijksmonument 518460): the narrow
 * Amsterdam School office front of very dark purple-brown brick on the Prins Hendrikkade.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). Its front ring runs 8.2 m from the east end
 * (ring 0) westward to ring 6; the 2.43 m entrance bay (t 1.61-4.04) is set back 0.48 m in the BAG footprint, which in the
 * photo is only the ground-storey porch: above the entrance hood the front is filled flush here.
 *
 * Read from the rectified 2025 crops (recording_2025-06-17_08-04-10_03815, CC BY 4.0): w04-341.jpg (east part, t 0-4.04)
 * and w03-348.jpg (west part, t 4.05-8.2), 50 px/m; heights h = 1.04 (1124 - y) / 50 (the 3DBAG roof 21.5 m against the
 * crop's 20.6 m, a 4 % camera-distance error), with the aimed view and the 2024 alt crops. The other two photographed
 * walls show neighbouring buildings in front of this pand's rear and side (inventory notes).
 */
type Src = {nativeRing: number[][]; facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const R = src.nativeRing;
type Col = 'brick' | 'red' | 'sandstone' | 'gold' | 'ochre' | 'glass' | 'frame' | 'dark' | 'slate';

/** Front frame: along ring 0 -> 6 (westward), its normal outward (north). */
const F: Frame = (() => {
  const a = R[0], q = R[6], dx = q[0] - a[0], dz = q[1] - a[1], L = Math.hypot(dx, dz), tx = dx / L, tz = dz / L;
  return {origin: [a[0], a[1]], tangent: [tx, tz], n: [-tz, tx]};
})();

// storey lines (w04-341.jpg / w03-348.jpg, metres above ground)
const ROWS: [number, number][] = [[5.3, 7.3], [9.1, 11.2], [12.9, 15.1], [16.8, 18.7]];
const AXES = [1.33, 2.18, 3.04, 3.91, 4.76];
const PITCH = 0.8575;
const WIN = 0.56; // glass; with its frame ring 0.66 m (crop 0.58-0.6 m windows, which read wider in the aimed view)
const PORCH = {t0: 1.61, t1: 4.04, depth: 0.48, top: 3.35};
const HOOD = {t0: 0.6, t1: 4.6, y0: 3.4, y1: 5.1, d: 0.35};
const SHAFT = {t: 6.95, r: 0.45, proud: 0.25, lights: [[5.3, 7.4], [9.2, 11.5], [13.4, 15.6], [16.9, 19.1]] as [number, number][]};

export function buildBataviaPrinsHendrikkade(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04, true);
  porchAndHood(b);
  windowGrid(b);
  bands(b);
  stairShaft(b);
  setSink(sink0);
}

/** A glazed window set into the wall: frame ring, glass, a transom at 62 %. */
function windowAt(b: BuildingTools, t: number, w: number, y0: number, y1: number, out: number) {
  slab(b, F, t, y0 - 0.05, w + 0.1, y1 - y0 + 0.1, 0.04, 'frame', out);
  slab(b, F, t, y0, w, y1 - y0, 0.1, 'glass', out);
  slab(b, F, t, y0 + (y1 - y0) * 0.62, w, 0.06, 0.15, 'frame', out);
}

function porchAndHood(b: BuildingTools) {
  const {t0, t1, depth} = PORCH, tc = (t0 + t1) / 2;
  // above the porch the front is flush: fill the BAG set-back from the hood to the parapet
  slab(b, F, tc, PORCH.top, t1 - t0 - 0.004, 21.5 - PORCH.top, depth, 'brick', -depth);
  // the pale oak double door in the porch: two leaves glazed in small panes above a solid lower panel
  const dt = 2.85, dw = 1.9, dout = -depth + 0.02;
  slab(b, F, dt, 0, dw, 2.75, 0.06, 'ochre', dout);
  for (const s of [-1, 1]) {
    slab(b, F, dt + s * dw / 4, 1.2, 0.62, 1.35, 0.12, 'glass', dout);
    for (const yy of [1.65, 2.1]) slab(b, F, dt + s * dw / 4, yy, 0.62, 0.04, 0.16, 'ochre', dout);
    slab(b, F, dt + s * dw / 4, 1.2, 0.04, 1.35, 0.16, 'ochre', dout);
  }
  slab(b, F, dt, 2.75, dw + 0.1, 0.3, 0.1, 'ochre', dout); // the head of the door frame (no fanlight in the photo)
  // the brick hood with its corbelled lower edge, a coping, and the gilt GEBOUW / BATAVIA in two lines
  const hc = (HOOD.t0 + HOOD.t1) / 2, hw = HOOD.t1 - HOOD.t0;
  slab(b, F, hc, HOOD.y0, hw, HOOD.y1 - HOOD.y0, HOOD.d, 'brick', 0);
  slab(b, F, hc, HOOD.y0 - 0.12, hw - 0.3, 0.12, HOOD.d - 0.12, 'brick', 0);
  slab(b, F, hc, HOOD.y1, hw + 0.1, 0.12, HOOD.d + 0.06, 'red', 0);
  text(b, 'GEBOUW', dt, 4.4, 0.05, 0.045, HOOD.d);
  text(b, 'BATAVIA', dt, 3.7, 0.05, 0.045, HOOD.d);
}

function text(b: BuildingTools, s: string, t: number, y: number, px: number, pxY: number, out: number) {
  const total = ([...s].length * 6 - 1) * px;
  [...s].forEach((ch, i) => {
    for (const r of glyphRuns(ch, px).runs) slab(b, F, t - total / 2 + i * 6 * px + (r.t0 + r.t1) / 2, y + (r.y0 / px) * pxY, r.t1 - r.t0, pxY, 0.04, 'gold', out);
  });
}

/** Five windows per storey between slender brick mullion-piers standing proud of the glass. */
function windowGrid(b: BuildingTools) {
  for (const [y0, y1] of ROWS) {
    for (const t of AXES) windowAt(b, t, WIN, y0, y1, 0.0);
    // the piers between and either side of the windows, 0.14 m proud
    for (let k = 0; k <= AXES.length; k++) slab(b, F, AXES[0] - PITCH / 2 + k * PITCH, y0 - 0.1, PITCH - WIN - 0.12, y1 - y0 + 0.2, 0.14, 'brick', 0);
    // a brick sill course under each storey
    slab(b, F, AXES[2], y0 - 0.16, 5 * PITCH + 0.2, 0.06, 0.16, 'red', 0);
  }
}

/** Spandrel reliefs, patterned panels, the corbelled bands, the parapet arch row and the coping. */
function bands(b: BuildingTools) {
  for (const t of AXES) {
    // second-storey reliefs (11.4-12.7 m): a raised panel with a carved head block and a rounded boss
    slab(b, F, t, 11.45, 0.66, 1.2, 0.08, 'sandstone', 0);
    slab(b, F, t, 12.1, 0.3, 0.42, 0.16, 'sandstone', 0);
    put(b, F, new T.CylinderGeometry(0.12, 0.12, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.05), t, 11.75, 0.08, 'sandstone');
    // first-storey patterned panels (7.5-8.8 m): three vertical ribs
    slab(b, F, t, 7.55, 0.66, 1.2, 0.05, 'brick', 0);
    for (const s of [-1, 0, 1]) slab(b, F, t + s * 0.2, 7.65, 0.07, 1.0, 0.1, 'red', 0);
    // a corbel bracket over each second-storey window (15.2-15.6 m)
    slab(b, F, t, 15.2, 0.4, 0.4, 0.22, 'brick', 0);
    // under the parapet: the shadowed arch recess over each axis between two brackets (19.3-20.3 m)
    slab(b, F, t, 19.45, 0.62, 0.7, 0.04, 'dark', 0);
  }
  for (let k = 0; k <= AXES.length; k++) slab(b, F, AXES[0] - PITCH / 2 + k * PITCH, 19.3, 0.16, 1.0, 0.24, 'brick', 0);
  // the projecting band over the brackets and the reddish-brown coping band to the parapet top
  slab(b, F, AXES[2], 15.6, 5 * PITCH + 0.2, 0.14, 0.3, 'red', 0);
  slab(b, F, 3.6, 20.3, 7.0, 0.12, 0.3, 'red', 0);
  slab(b, F, 3.6, 20.42, 7.0, 1.18, 0.1, 'red', 0); // its top 10 cm over the flat roof at 21.5 m
  // the east corner pier rising above the parapet with a cap
  slab(b, F, 0.45, 21.6, 0.9, 0.35, 0.4, 'brick', -0.3);
  slab(b, F, 0.45, 21.95, 0.7, 0.2, 0.3, 'red', -0.25);
}

/** The stair shaft on the west: a shallow half-round of banded brick with four tall slot lights and a small top light. */
function stairShaft(b: BuildingTools) {
  const {t, r, proud} = SHAFT;
  // a half cylinder squashed to `proud`, flat side on the wall (three.js theta from +z, the frame's outward normal)
  const half = (rad: number, h: number, depth: number) => new T.CylinderGeometry(rad, rad, h, 14, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, depth / rad);
  put(b, F, half(r, 20.2 - 3.0, proud).translate(0, (20.2 + 3.0) / 2, 0), t, 0, -0.02, 'brick');
  // banded courses every 0.5 m on the round, stopped at the lights
  for (let y = 3.3; y < 20.0; y += 0.5) {
    if (SHAFT.lights.some(([a, c]) => y > a - 0.15 && y < c + 0.15)) continue;
    put(b, F, half(r + 0.03, 0.06, proud + 0.03).translate(0, y, 0), t, 0, -0.02, 'red');
  }
  for (const [y0, y1] of SHAFT.lights) {
    windowAt(b, t, 0.5, y0, y1, proud - 0.02);
  }
  windowAt(b, t, 0.45, 19.55, 20.05, proud - 0.02);
  // the black iron gate at its foot
  slab(b, F, t, 0, 1.1, 2.6, 0.06, 'dark' satisfies Col, 0);
}
