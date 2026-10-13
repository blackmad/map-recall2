import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archBand, archSlab, disc, poly, ringSlab, setSink, slab, type Frame} from './nearbar-kit';

/**
 * Old Catholic church Sint-Petrus-en-Paulus with parsonage (Ruysdaelstraat 37/39; J.W.F. Hartkamp jr., 1914).
 *
 * Every volume is authored on the building's own grid, read from the BAG ring and 3DBAG LoD2.2
 * (scripts/landmarks/petrus-en-paulus-kerk-footprints.json): a = metres along bearing 73 (east along the street),
 * f = metres along bearing 343 (out of the street front), y up. The 3DBAG shell itself is not rendered; it supplies
 * the footprint, eaves and ridges only, and the roofs are rebuilt from intent. Facade rhythm spec and measurements:
 * petrus-en-paulus-kerk-research.json.
 */
type Col = Parameters<BuildingTools['add']>[1];
const ANG = Math.atan2(0.2924, 0.9563); // rotates local (a, y, -f) into native east/south metres
const V: [number, number] = [0.9563, -0.2924]; // +a in native x/z
const N: [number, number] = [-0.2924, -0.9563]; // +f in native x/z
const P = (a: number, f: number): [number, number] => [a * V[0] + f * N[0], a * V[1] + f * N[1]];

/** Wall frames (nearbar-kit): t runs to the viewer's right, out along the face normal. */
const north = (f: number): Frame => ({origin: P(0, f), tangent: [-V[0], -V[1]], n: N}); // t = -a
const south = (f: number): Frame => ({origin: P(0, f), tangent: V, n: [-N[0], -N[1]]}); // t = a
const east = (a: number): Frame => ({origin: P(a, 0), tangent: N, n: V}); // t = f
const west = (a: number): Frame => ({origin: P(a, 0), tangent: [-N[0], -N[1]], n: [-V[0], -V[1]]}); // t = -f

const GABLE_F = 6.42; // church gable front (3DBAG walls 9/57)
const RIDGE_A = -3.6, RIDGE_Y = 15.8, NAVE_W = -10.4, NAVE_E = 2.66;
const rakeY = (a: number) => a >= RIDGE_A ? RIDGE_Y - (a - RIDGE_A) * ((RIDGE_Y - 9.54) / (NAVE_E - RIDGE_A)) : RIDGE_Y - (RIDGE_A - a) * ((RIDGE_Y - 9.3) / (RIDGE_A - NAVE_W));
const TURRET: [number, number] = [0.95, 6.19]; // local centre of the round stair turret (3DBAG facet arc), r 1.47

export function buildPetrusEnPaulusKerk(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04);
  try { build(b); } finally { setSink(0); }
}

function build(b: BuildingTools) {
  const place = (g: T.BufferGeometry, c: Col) => { g.rotateY(ANG); b.add(g, c); };
  /** Axis-aligned box in local coordinates. */
  const box = (a0: number, a1: number, f0: number, f1: number, y0: number, y1: number, c: Col) =>
    place(new T.BoxGeometry(a1 - a0, y1 - y0, f1 - f0).translate((a0 + a1) / 2, (y0 + y1) / 2, -(f0 + f1) / 2), c);
  /** Polygon in the (a, y) plane extruded from f0 to f1. */
  const prismAF = (pts: [number, number][], f0: number, f1: number, c: Col, holes: [number, number][][] = []) => {
    const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
    for (const h of holes) s.holes.push(new T.Path(h.map(p => new T.Vector2(p[0], p[1]))));
    place(new T.ExtrudeGeometry(s, {depth: f1 - f0, bevelEnabled: false, curveSegments: 12}).translate(0, 0, -f1), c);
  };
  /** Shape in the (a, y) plane extruded from f0 to f1. */
  const shapeAF = (s: T.Shape, f0: number, f1: number, c: Col) =>
    place(new T.ExtrudeGeometry(s, {depth: f1 - f0, bevelEnabled: false, curveSegments: 14}).translate(0, 0, -f1), c);
  /** Planar polygon from local (a, y, f) points (single surface, materials are double-sided). */
  const face = (pts: [number, number, number][], c: Col, up = false) => {
    const g = new T.BufferGeometry();
    const q = pts.map(([a, y, f]) => new T.Vector3(a, y, -f));
    g.setAttribute('position', new T.Float32BufferAttribute(q.flatMap(v => v.toArray()), 3));
    const flip = up && q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0])).y < 0;
    const idx: number[] = [];
    for (let i = 1; i + 1 < pts.length; i++) idx.push(0, flip ? i + 1 : i, flip ? i : i + 1);
    g.setIndex(idx); g.computeVertexNormals();
    place(g, c);
  };
  /** Pitched roof plate (chevron section, ridge along f): eaves at aW/aE (already including overhang), thickness th. */
  const roof = (aW: number, yW: number, aR: number, yR: number, aE: number, yE: number, f0: number, f1: number, th: number, c: Col) => {
    const kW = th / Math.cos(Math.atan2(yR - yW, aR - aW)), kE = th / Math.cos(Math.atan2(yR - yE, aE - aR));
    prismAF([[aW, yW], [aR, yR], [aE, yE], [aE, yE + kE], [aR, yR + Math.max(kW, kE)], [aW, yW + kW]], f0, f1, c);
  };
  /** Coping strip along a rake from (a0,y0) to (a1,y1): th thick above the line, spanning f0..f1. */
  const coping = (a0: number, y0: number, a1: number, y1: number, th: number, f0: number, f1: number, c: Col = 'stone') => {
    const k = th / Math.cos(Math.atan2(y1 - y0, a1 - a0)), d = 0.08;
    prismAF([[a0, y0 - d], [a1, y1 - d], [a1, y1 + k], [a0, y0 + k]], f0, f1, c);
  };

  // ---------------------------------------------------------------- massing
  // Nave: walls to the 9.4 m eaves, rear gable over the low schoolroom block, roof behind the street gable.
  box(NAVE_W, NAVE_E + 0.14, -15.9, 5.6, 0, 9.4, 'brick');
  box(-7.9, NAVE_E + 0.14, 5.25, GABLE_F - 0.5, 0, 9.4, 'brick');
  prismAF([[NAVE_W, 9.3], [RIDGE_A, RIDGE_Y], [NAVE_E + 0.14, 9.4]], -15.9, -15.6, 'brick');
  roof(NAVE_W - 0.35, 9.3 - 0.48, RIDGE_A, RIDGE_Y - 0.13, NAVE_E + 0.45, 9.4 - 0.45, -16.15, GABLE_F - 0.3, 0.2, 'slate');
  // Street gable: one brick plane up to the rakes.
  prismAF([[-8.0, 0], [NAVE_E, 0], [NAVE_E, rakeY(NAVE_E)], [RIDGE_A, RIDGE_Y], [-8.0, rakeY(-8.0)]], GABLE_F - 0.55, GABLE_F, 'brick');
  // Rear schoolroom block, flat roof (3DBAG roof 64).
  box(-10.3, 4.16, -22.7, -15.4, 0, 5.3, 'brick');
  box(-10.45, 4.31, -22.85, -15.25, 5.22, 5.55, 'greyBrick');

  // Parsonage wing: ridge 13.6 along f, hipped at the street end over the link (eave 9.45), gabled at the south.
  const WA0 = 2.47, WA1 = 10.41, WF0 = -5.74, WF1 = 6.24, WR = 6.6, WRE = 2.3, WE = 9.45, WRY = 13.6;
  box(WA0, WA1, WF0, WF1, 0, WE, 'brick');
  prismAF([[WA0, WE], [WR, WRY], [WA1, WE]], WF0, WF0 + 0.3, 'brick');
  {
    const o = 0.3, s = (WRY - WE) / (WR - WA0), dy = o * s, y = WE - dy;
    const w0 = WA0 - o, w1 = WA1 + o, fn = WF1 + o, fs = WF0 - 0.2;
    const lift = 0.16;
    face([[w0, y + lift, fs], [w0, y + lift, fn], [WR, WRY + lift, WRE], [WR, WRY + lift, fs]], 'ochre', true);
    face([[w1, y + lift, fs], [WR, WRY + lift, fs], [WR, WRY + lift, WRE], [w1, y + lift, fn]], 'ochre', true);
    face([[w0, y + lift, fn], [w1, y + lift, fn], [WR, WRY + lift, WRE]], 'ochre', true);
    // close the plate: fascia on the three eaves, verge over the south gable, brick soffit underneath
    for (const [p, q] of [[[w0, fs], [w0, fn]], [[w0, fn], [w1, fn]], [[w1, fn], [w1, fs]]] as [number, number][][])
      face([[p[0], y, p[1]], [q[0], y, q[1]], [q[0], y + lift, q[1]], [p[0], y + lift, p[1]]], 'ochre');
    face([[w0, y, fs], [w0, y + lift, fs], [WR, WRY + lift, fs], [w1, y + lift, fs], [w1, y, fs]], 'brick');
    face([[w0, y, fs], [w1, y, fs], [w1, y, fn], [w0, y, fn]], 'brick');
  }
  // Black flue on the link roof (ref-commons-ruysdaelstraat-37).
  place(new T.CylinderGeometry(0.11, 0.11, 1.3, 10).translate(3.4, 10.5, -5.4), 'bronze');
  place(new T.CylinderGeometry(0.17, 0.17, 0.12, 10).translate(3.4, 11.2, -5.4), 'bronze');

  // Gable house (no. 37): front gable 9.5 / 12.2 projecting to f 7.54; its ridge dies into the wing's hip.
  const GA0 = 4.92, GA1 = 10.41, GF = 7.54, GC = (GA0 + GA1) / 2, GE = 9.5, GAY = 12.2;
  box(GA0, GA1 + 0.05, WF1 - 1.5, GF, 0, GE, 'brick'); // east face 5 cm proud of the wing so the walls are not coplanar
  prismAF([[GA0, GE], [GC, GAY], [GA1, GE]], GF - 0.3, GF, 'brick');
  roof(GA0 - 0.25, GE - 0.25, GC, GAY + 0.02, GA1 + 0.25, GE - 0.25, 2.6, GF - 0.05, 0.16, 'ochre');
  coping(GA0 - 0.1, GE - 0.1, GC, GAY, 0.22, GF - 0.35, GF + 0.08);
  coping(GC, GAY, GA1 + 0.1, GE - 0.1, 0.22, GF - 0.35, GF + 0.08);
  box(GA0 - 0.12, GA0 + 0.4, GF - 0.35, GF + 0.1, GE - 0.35, GE + 0.15, 'stone');
  box(GA1 - 0.4, GA1 + 0.12, GF - 0.35, GF + 0.1, GE - 0.35, GE + 0.15, 'stone');

  // ---------------------------------------------------------------- church gable detail
  const G = north(GABLE_F);
  // Stone coping on both rakes (ending at the east kneeler and in the tower), apex block and cross.
  coping(2.25, rakeY(2.25), RIDGE_A, RIDGE_Y, 0.28, GABLE_F - 0.6, GABLE_F + 0.1);
  coping(RIDGE_A, RIDGE_Y, -8.3, rakeY(-8.3), 0.28, GABLE_F - 0.6, GABLE_F + 0.1);
  box(RIDGE_A - 0.35, RIDGE_A + 0.35, GABLE_F - 0.6, GABLE_F + 0.15, RIDGE_Y - 0.1, RIDGE_Y + 0.65, 'stone');
  box(RIDGE_A - 0.11, RIDGE_A + 0.11, GABLE_F - 0.35, GABLE_F - 0.05, RIDGE_Y + 0.65, RIDGE_Y + 2.0, 'stone');
  box(RIDGE_A - 0.4, RIDGE_A + 0.4, GABLE_F - 0.35, GABLE_F - 0.05, RIDGE_Y + 1.35, RIDGE_Y + 1.57, 'stone');
  // East shoulder: brick pier capped by a stone kneeler; west: shoulder block against the tower.
  box(2.1, 2.95, GABLE_F - 0.6, GABLE_F + 0.18, 9.3, 10.15, 'stone');
  box(2.05, 3.0, GABLE_F - 0.6, GABLE_F + 0.22, 10.15, 10.3, 'stone');
  box(2.15, 2.9, GABLE_F - 0.1, GABLE_F + 0.12, 7.6, 9.3, 'brick');
  box(-7.72, -7.15, GABLE_F - 0.2, GABLE_F + 0.18, rakeY(-7.15) - 0.75, rakeY(-7.15) + 0.2, 'stone');
  // Grey brick plinth with a stone weathering across the gable front.
  slab(b, G, 2.53, 0, 10.38, 0.9, 0.06, 'greyBrick');
  slab(b, G, 2.53, 0.9, 10.38, 0.12, 0.1, 'stone');

  /** Church window: dark frame, glass, centre mullion and transoms, stone sill and block-and-start jambs. */
  const churchWindow = (f: Frame, t: number, y: number, w: number, h: number, rows: number) => {
    slab(b, f, t, y - 0.16, w + 0.42, 0.16, 0.16, 'stone');
    slab(b, f, t, y, w + 0.1, h, 0.04, 'frame');
    slab(b, f, t, y + 0.03, w - 0.06, h - 0.06, 0.07, 'glass');
    slab(b, f, t, y, 0.09, h, 0.11, 'frame');
    for (let k = 1; k < rows; k++) slab(b, f, t, y + (h * k) / rows - 0.045, w, 0.09, 0.11, 'frame');
    for (const s of [-1, 1]) for (const yy of [y, y + h / 2 - 0.15, y + h - 0.3]) slab(b, f, t + s * (w / 2 + 0.12), yy, 0.26 + (yy === y + h - 0.3 ? 0.08 : 0), 0.3, 0.08, 'stone');
    slab(b, f, t, y + h, w + 0.1, 0.2, 0.06, 'greyBrick');
  };
  churchWindow(G, 2.5, 6.3, 1.1, 4.4, 3);  // a -2.5
  churchWindow(G, 4.5, 6.4, 1.1, 4.0, 3);  // a -4.5, over the porch
  // Louvred twin light under the apex.
  for (const dt of [-0.27, 0.27]) {
    slab(b, G, -RIDGE_A + dt, 11.9, 0.36, 1.5, 0.03, 'dark');
    for (let k = 0; k < 6; k++) slab(b, G, -RIDGE_A + dt, 12.0 + k * 0.23, 0.36, 0.05, 0.09, 'frame');
  }
  slab(b, G, -RIDGE_A, 11.72, 1.25, 0.18, 0.14, 'stone');
  for (const dt of [-0.55, 0.55]) slab(b, G, -RIDGE_A + dt, 13.1, 0.24, 0.32, 0.08, 'stone');
  slab(b, G, -RIDGE_A, 13.4, 1.25, 0.16, 0.06, 'greyBrick');
  // Twin tall lights between the turret and the porch (ref-pano-0).
  for (const dt of [-0.22, 0.22]) slab(b, G, 1.15 + dt, 1.8, 0.32, 1.7, 0.06, 'glass');
  slab(b, G, 1.15, 1.8, 0.12, 1.7, 0.1, 'stone');
  slab(b, G, 1.15, 1.58, 1.0, 0.22, 0.18, 'stone');
  slab(b, G, 1.15, 3.5, 1.0, 0.24, 0.1, 'stone');

  // ---------------------------------------------------------------- porch
  {
    const A0 = -6.0, A1 = -1.8, AC = -3.9, EV = 4.4, AP = 6.5, PF = 7.7, r = 1.45, SPR = 3.0;
    const s = new T.Shape();
    s.moveTo(A0, 0); s.lineTo(AC - r, 0); s.lineTo(AC - r, SPR); s.absarc(AC, SPR, r, Math.PI, 0, true); s.lineTo(AC + r, 0); s.lineTo(A1, 0);
    s.lineTo(A1, EV + 0.2); s.lineTo(AC, AP + 0.2); s.lineTo(A0, EV + 0.2); s.lineTo(A0, 0);
    shapeAF(s, GABLE_F - 0.05, PF, 'brick');
    roof(A0 - 0.22, EV - 0.2, AC, AP + 0.02, A1 + 0.22, EV - 0.2, GABLE_F - 0.3, PF - 0.3, 0.14, 'slate');
    // white boxed eave gutters (ref-commons-oud-katholieke-kerk), stone coping on the parapet gable
    box(A0 - 0.3, A0 + 0.02, GABLE_F + 0.02, PF - 0.25, EV - 0.42, EV - 0.15, 'white');
    box(A1 - 0.02, A1 + 0.3, GABLE_F + 0.02, PF - 0.25, EV - 0.42, EV - 0.15, 'white');
    coping(A0 + 0.45, EV + 0.2 + 0.45, AC, AP + 0.2, 0.22, PF - 0.4, PF + 0.08);
    coping(AC, AP + 0.2, A1 - 0.45, EV + 0.2 + 0.45, 0.22, PF - 0.4, PF + 0.08);
    const pf = north(PF);
    for (const a of [A0 + 0.35, A1 - 0.35]) {
      box(a - 0.42, a + 0.42, PF - 0.6, PF + 0.14, EV - 0.5, EV + 0.75, 'stone'); // kneeler block
      slab(b, pf, -a, SPR - 0.35, 0.7, 0.35, 0.08, 'stone');                     // impost
      slab(b, pf, -a, 0, 0.72, 0.55, 0.08, 'stone');                             // pier base
    }
    archBand(b, pf, -AC, 0.55, 2 * r + 0.5, SPR + r + 0.25 - 0.55, 0.25, 0.08, 'stone');
    box(AC - 0.3, AC + 0.3, PF - 0.35, PF + 0.08, AP + 0.25, AP + 0.6, 'stone');
    box(AC - 0.09, AC + 0.09, PF - 0.25, PF - 0.05, AP + 0.6, AP + 1.5, 'stone');
    box(AC - 0.3, AC + 0.3, PF - 0.25, PF - 0.05, AP + 1.1, AP + 1.28, 'stone');
    // Recessed red double door, stone band and fanlight at the church wall.
    slab(b, G, -AC, 0.12, 2.3, 2.62, 0.1, 'red');
    slab(b, G, -AC, 0.12, 0.06, 2.62, 0.09, 'dark');
    slab(b, G, -AC, 2.74, 2.9, 0.26, 0.1, 'stone');
    archSlab(b, G, -AC, SPR, 2 * r - 0.05, r + 0.0, 0.05, 'glass');
    for (const dt of [-0.48, 0.48]) slab(b, G, -AC + dt, SPR, 0.12, r * 0.85, 0.09, 'stone');
    box(AC - r - 0.3, AC + r + 0.3, PF, PF + 0.45, 0, 0.15, 'stone');
    box(AC - r, AC + r, GABLE_F, PF, 0, 0.12, 'stone');
  }

  // ---------------------------------------------------------------- turret
  {
    const [ta, tf] = TURRET, R = 1.47;
    const lathe = (r0: number, r1: number, y0: number, y1: number, seg: number, c: Col, rot = 0) => {
      const g = new T.CylinderGeometry(r1, r0, y1 - y0, seg, 1, false, rot);
      place(g.translate(ta, (y0 + y1) / 2, -tf), c);
    };
    const OCT = Math.PI / 8; // a flat octagon face towards the street (+f)
    lathe(R + 0.12, R + 0.12, 0, 0.7, 24, 'stone');
    lathe(R + 0.12, R + 0.02, 0.7, 0.9, 24, 'stone');
    lathe(R + 0.02, R + 0.02, 0.9, 5.3, 24, 'brick');
    lathe(R + 0.02, 1.6, 5.3, 5.9, 24, 'brick');
    const ap = (apo: number) => apo / Math.cos(Math.PI / 8);
    lathe(ap(1.66), ap(1.66), 5.9, 6.1, 8, 'stone', OCT);
    lathe(ap(1.52), ap(1.52), 6.1, 7.4, 8, 'brick', OCT);
    lathe(ap(1.68), ap(1.68), 7.4, 7.62, 8, 'white', OCT);
    lathe(ap(1.78), 0.05, 7.62, 8.9, 8, 'ochre', OCT);
    /** Frame on the turret facing local direction `deg` (0 = +f, positive towards +a). */
    const at = (deg: number, rad: number): Frame => {
      const r = deg * Math.PI / 180, da = Math.sin(r), df = Math.cos(r);
      const n = [da * V[0] + df * N[0], da * V[1] + df * N[1]] as [number, number];
      return {origin: P(ta + da * rad, tf + df * rad), tangent: [n[1], -n[0]], n};
    };
    const sunk = -0.08;
    for (const d of [-50, 0, 50]) {
      const f = at(d, R + 0.02);
      slab(b, f, 0, 2.4, 0.5, 1.05, 0.1 + 0.08, 'glass', sunk);
      slab(b, f, 0, 3.45, 0.9, 0.3, 0.16 + 0.08, 'stone', sunk);
      slab(b, f, 0, 2.15, 0.9, 0.25, 0.26 + 0.08, 'stone', sunk);
      for (const dt of [-0.37, 0.37]) slab(b, f, dt, 2.4, 0.2, 1.05, 0.12 + 0.08, 'stone', sunk);
    }
    for (const d of [-45, 0, 45]) {
      const f = at(d, 1.52);
      slab(b, f, 0, 6.3, 0.52, 0.85, 0.06, 'glass', -0.02);
      slab(b, f, 0, 7.15, 0.8, 0.18, 0.1, 'stone', -0.02);
      slab(b, f, 0, 6.18, 0.8, 0.14, 0.12, 'stone', -0.02);
    }
    for (const d of [-67.5, -22.5, 22.5, 67.5]) for (const [y, hh] of [[6.12, 0.38], [6.85, 0.38]] as const) {
      slab(b, at(d, ap(1.52) - 0.03), 0, y, 0.3, hh, 0.12, 'stone', -0.05);
    }
  }

  // ---------------------------------------------------------------- parsonage (no. 37) fronts
  const whiteWindow = (f: Frame, t: number, y: number, w: number, h: number, split: number, cols = 2) => {
    slab(b, f, t, y - 0.14, w + 0.35, 0.14, 0.18, 'stone');
    slab(b, f, t, y, w + 0.16, h + 0.08, 0.05, 'white');
    slab(b, f, t, y + 0.06, w - 0.06, h - 0.06, 0.08, 'glass');
    slab(b, f, t, y + split, w, 0.08, 0.11, 'white');
    for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + (w * k) / cols, y, 0.07, h, 0.11, 'white');
    for (let k = 1; k < 3; k++) slab(b, f, t - w / 2 + (w * k) / 3, y + split, 0.04, h - split, 0.1, 'white');
    slab(b, f, t, y + h + 0.1, w + 0.3, 0.22, 0.08, 'greyBrick');
  };
  {
    const gh = north(GF);
    for (const a of [GC - 1.3, GC + 1.3]) {
      whiteWindow(gh, -a, 1.5, 1.3, 2.5, 1.85);
      whiteWindow(gh, -a, 5.2, 1.2, 2.4, 1.75);
    }
    for (const a of [GC - 0.55, GC + 0.55]) whiteWindow(gh, -a, 9.75, 0.55, 1.05, 0.5, 1);
    slab(b, gh, -GC, 0, GA1 - GA0, 0.8, 0.05, 'greyBrick');
    slab(b, gh, -GC, 4.55, GA1 - GA0, 0.14, 0.08, 'stone');
    const lk = north(WF1);
    // Link: door '37' with transom beside the gable house, red-framed light and basement grille by the turret, wide sash above.
    slab(b, lk, -4.3, 0.15, 1.15, 3.6, 0.06, 'red');
    slab(b, lk, -4.3, 2.65, 1.0, 0.85, 0.08, 'glass');
    slab(b, lk, -4.3, 2.55, 1.15, 0.08, 0.1, 'red');
    slab(b, lk, -4.3, 3.75, 1.4, 0.24, 0.1, 'stone');
    slab(b, lk, -3.15, 2.2, 0.62, 0.95, 0.06, 'red');
    slab(b, lk, -3.15, 2.27, 0.48, 0.8, 0.09, 'glass');
    slab(b, lk, -3.15, 3.2, 0.9, 0.22, 0.1, 'stone');
    slab(b, lk, -3.15, 0.15, 0.6, 0.75, 0.06, 'red');
    slab(b, lk, -3.15, 0.2, 0.48, 0.62, 0.08, 'dark');
    whiteWindow(lk, -3.75, 5.0, 1.35, 2.35, 1.6);
    // white timber cornice at the 9.45 m eave
    box(2.95, GA0 - 0.03, WF1 - 0.02, WF1 + 0.32, WE - 0.38, WE - 0.05, 'white');
    box(2.95, GA0 - 0.03, WF1 - 0.02, WF1 + 0.38, WE - 0.05, WE + 0.02, 'white');
  }

  // ---------------------------------------------------------------- tower
  {
    const TA0 = -10.45, TA1 = -7.72, TF0 = 5.3, TF1 = 7.79, TC = (TA0 + TA1) / 2, TFC = (TF0 + TF1) / 2;
    const S0 = 13.4, S1 = 15.4, O = 0.2, CY = 19.3, AY = 20.85; // shaft top, stage base, overhang, cornice, apex
    box(TA0, TA1, TF0, TF1, 0, S1, 'brick');
    box(TA0 - 0.05, TA1 + 0.05, TF0 - 0.05, TF1 + 0.05, 0, 0.9, 'greyBrick');
    box(TA0 - O, TA1 + O, TF0 - O, TF1 + O, S1, CY, 'brick');
    // saddleback roof (ridge along f), brick gables north and south with stone coping
    const ga = TA0 - O, gb = TA1 + O;
    roof(ga - 0.12, CY - 0.1, TC, AY - 0.1, gb + 0.12, CY - 0.1, TF0 - O + 0.1, TF1 + O - 0.1, 0.14, 'bronze');
    for (const [f0, f1] of [[TF1 + O - 0.3, TF1 + O], [TF0 - O, TF0 - O + 0.3]]) {
      prismAF([[ga, CY], [TC, AY], [gb, CY]], f0, f1, 'brick');
      coping(ga - 0.05, CY, TC, AY, 0.2, f0 - 0.06, f1 + 0.06);
      coping(TC, AY, gb + 0.05, CY, 0.2, f0 - 0.06, f1 + 0.06);
    }
    const faces: {f: Frame; w: number; clock: boolean; louvre: boolean; cornice: boolean}[] = [
      {f: north(TF1 + O), w: gb - ga, clock: true, louvre: false, cornice: false},
      {f: south(TF0 - O), w: gb - ga, clock: true, louvre: false, cornice: false},
      {f: east(gb), w: TF1 - TF0 + 2 * O, clock: true, louvre: false, cornice: true},
      {f: west(ga), w: TF1 - TF0 + 2 * O, clock: true, louvre: false, cornice: true},
    ];
    const mid = (f: Frame) => {
      // t of the face centre: project the tower centre onto the frame tangent
      const c = P(TC, TFC);
      return (c[0] - f.origin[0]) * f.tangent[0] + (c[1] - f.origin[1]) * f.tangent[1];
    };
    for (const {f, w, clock, cornice} of faces) {
      const c = mid(f);
      // stone clock stage: frieze under the clock, panel, clock, head band
      slab(b, f, c, S1 + 0.15, w - 0.6, 0.55, 0.07, 'stone');
      slab(b, f, c, S1 + 0.7, w - 0.75, 2.7, 0.05, 'sandstone');
      if (clock) {
        disc(b, f, c, 17.65, 0.66, 0.1, 'white', 0.04);
        ringSlab(b, f, c, 17.65, 0.6, 0.72, 0.08, 'dark', 0.06);
        slab(b, f, c + 0.02, 17.6, 0.07, 0.48, 0.05, 'dark', 0.12);
        slab(b, f, c + 0.03, 17.62, 0.36, 0.07, 0.05, 'dark', 0.12);
        for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 - 0.62), S1 + 0.75, 0.3, 2.6, 0.06, 'stone', 0.04);
      }
      slab(b, f, c, 18.75, w - 0.3, 0.3, 0.1, 'stone');
      if (cornice) slab(b, f, c, CY - 0.3, w + 0.1, 0.32, 0.16, 'stone');
    }
    // stone corner posts with caps
    for (const a of [ga + 0.2, gb - 0.2]) for (const fp of [TF0 - O + 0.2, TF1 + O - 0.2]) {
      box(a - 0.27, a + 0.27, fp - 0.27, fp + 0.27, 18.5, 20.05, 'stone');
      box(a - 0.33, a + 0.33, fp - 0.33, fp + 0.33, 20.05, 20.3, 'stone');
    }
    // stepped brick corbel band with two round-arched niches per face
    const shaft: {f: Frame; w: number}[] = [
      {f: north(TF1), w: TA1 - TA0}, {f: south(TF0), w: TA1 - TA0}, {f: east(TA1), w: TF1 - TF0}, {f: west(TA0), w: TF1 - TF0},
    ];
    for (const {f, w} of shaft) {
      const c = mid(f);
      const teeth = [c - w / 2 + 0.28, c, c + w / 2 - 0.28];
      for (const t of teeth) for (let k = 0; k < 5; k++) slab(b, f, t, S0 + k * 0.3, 0.56, 0.3, 0.04 * (k + 1), 'brick');
      const off = w / 2 - 0.28, nw = off - 0.56;
      for (const t of [c - off / 2, c + off / 2]) {
        slab(b, f, t, S0, nw + 0.04, 1.0, 0.02, 'greyBrick'); // shadowed niche back
        const pts: [number, number][] = [];
        for (let k = 0; k <= 8; k++) { const q = Math.PI - (Math.PI * k) / 8; pts.push([Math.cos(q) * nw / 2, Math.sin(q) * 0.32]); }
        pts.push([nw / 2, 0.6], [-nw / 2, 0.6]);
        poly(b, f, t, S0 + 0.9, pts, O, 'brick');
      }
      slab(b, f, c, S0 + 1.5, w + 2 * O, S1 - S0 - 1.5, O, 'brick');
    }
    // louvred twin openings and a narrow light on the north face; louvres and twin lights on west and south
    const louvres = (f: Frame, c: number) => {
      for (const dt of [-0.33, 0.33]) {
        slab(b, f, c + dt, 11.0, 0.46, 2.0, 0.03, 'dark');
        for (let k = 0; k < 8; k++) slab(b, f, c + dt, 11.12 + k * 0.24, 0.46, 0.05, 0.08, 'frame');
      }
      slab(b, f, c, 10.82, 1.5, 0.18, 0.14, 'stone');
      slab(b, f, c, 11.0, 0.2, 2.0, 0.06, 'stone');
      for (const s of [-1, 1]) for (const y of [11.0, 12.7]) slab(b, f, c + s * 0.68, y, 0.22, 0.3, 0.06, 'stone');
    };
    const nf = north(TF1), wf = west(TA0);
    louvres(nf, mid(nf)); louvres(wf, mid(wf));
    slab(b, nf, mid(nf), 7.9, 0.45, 1.8, 0.05, 'glass');
    slab(b, nf, mid(nf), 7.72, 0.8, 0.18, 0.14, 'stone');
    slab(b, nf, mid(nf), 9.7, 0.8, 0.22, 0.08, 'stone');
    // west face: twin narrow lights low down and a grey brick plinth (ref-pano-4)
    for (const dt of [-0.36, 0.36]) slab(b, wf, mid(wf) + dt, 2.6, 0.5, 1.9, 0.05, 'glass');
    slab(b, wf, mid(wf), 2.6, 0.22, 1.9, 0.09, 'stone');
    slab(b, wf, mid(wf), 2.4, 1.5, 0.2, 0.16, 'stone');
    slab(b, wf, mid(wf), 4.5, 1.5, 0.22, 0.08, 'stone');
  }

  // ---------------------------------------------------------------- side and rear walls
  /** Nave window of three lights with brick mullions and stone transom blocks (ref-pano-2/3). */
  const naveWindow = (f: Frame, t: number, y: number, h: number) => {
    const lw = 0.7, gap = 0.16, w = 3 * lw + 2 * gap;
    slab(b, f, t, y - 0.2, w + 0.3, 0.2, 0.2, 'greyBrick');
    for (let k = -1; k <= 1; k++) {
      const tt = t + k * (lw + gap);
      slab(b, f, tt, y, lw, h, 0.03, 'frame');
      slab(b, f, tt, y + 0.03, lw - 0.06, h - 0.06, 0.06, 'glass');
      for (const r of [1, 2]) slab(b, f, tt, y + (h * r) / 3 - 0.04, lw, 0.08, 0.09, 'frame');
    }
    for (const k of [-0.5, 0.5]) {
      slab(b, f, t + k * (lw + gap), y, gap, h, 0.07, 'brick');
      for (const r of [1, 2]) slab(b, f, t + k * (lw + gap), y + (h * r) / 3 - 0.1, gap + 0.06, 0.2, 0.1, 'stone');
    }
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.08), y - 0.2, 0.22, 0.32, 0.12, 'stone');
  };
  const nw = west(NAVE_W);
  slab(b, nw, 5.3, 0, 21.2, 2.7, 0.05, 'greyBrick');
  slab(b, west(-10.45), -6.55, 0, 2.6, 2.7, 0.05, 'greyBrick');
  for (const f of [1.6, -3.0, -7.6, -12.2]) naveWindow(nw, -f, 2.9, 4.0);
  const ne = east(NAVE_E + 0.14);
  for (const f of [-8.3, -12.9]) naveWindow(ne, f, 2.9, 4.0); // inferred
  // rear nave gable over the schoolroom roof (inferred)
  naveWindow(south(-15.9), RIDGE_A, 6.6, 3.4);
  // parsonage wing east wall and south gable (inferred): two storeys of sashes
  const we = east(WA1);
  for (const f of [-4.3, -1.6, 1.1, 3.8, 6.5]) {
    whiteWindow(we, f, 1.5, 1.0, 2.3, 1.65);
    whiteWindow(we, f, 5.4, 1.0, 2.3, 1.65);
  }
  const ws = south(WF0);
  for (const a of [5.4, 7.9]) { whiteWindow(ws, a, 1.5, 1.0, 2.3, 1.65); whiteWindow(ws, a, 5.4, 1.0, 2.3, 1.65); }
  // schoolroom block (inferred): ground-floor windows on its three free sides
  const rw = west(-10.3), rs = south(-22.7), re = east(4.16);
  for (const f of [-17.6, -20.4]) naveWindow(rw, -f, 1.3, 2.6);
  for (const a of [-7.6, -3.1, 1.4]) naveWindow(rs, a, 1.3, 2.6);
  for (const f of [-17.6, -20.4]) naveWindow(re, f, 1.3, 2.6);
}
