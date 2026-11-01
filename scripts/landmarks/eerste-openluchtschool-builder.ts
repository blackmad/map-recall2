import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import source from './eerste-openluchtschool-footprints.json';

/**
 * Eerste Openluchtschool voor het Gezonde Kind, Cliostraat 40 (J. Duiker 1929-30; Rijksmonument 46504): the school inside the
 * block (BAG pand 0363100012090993) and the gatehouse on the Cliostraat (BAG pand 0363100012098627). Native east/south metres
 * from the school pand's vertex average, y above the 3DBAG ground; the gate is shifted into this frame
 * (scripts/landmarks/eerste-openluchtschool-footprints.json, eerste-openluchtschool-prepare.ts).
 *
 * Read from the register text (Rijksmonument 46504, CC0), the PDOK orthophoto (plan), the RCE and Flickr/Commons photographs
 * and the Gemeente Amsterdam panorama TMX7316010203-002918_pano_0007_000016 (gate front, CC BY 4.0) listed in
 * scripts/landmarks/eerste-openluchtschool-inventory.json:
 *  - the main block is a diamond (W, S, E corners of the 3DBAG roof at 15.5 m; the north corner cut back by the low rear wing)
 *    divided in quadrants: a glazed classroom wing round the west and the east corner, the open-air loggias in the south
 *    (playground) quadrant, the recessed glazed stair hall at the back rising to 18 m;
 *  - white rendered concrete: a continuous floor-slab band round every storey, square columns, the corners free of columns;
 *    full-height blue steel windows (eight axes on each long classroom side, register), grey tubular railings on the loggia
 *    slab edges and round the roof;
 *  - the low gymnasium to the south-east (3DBAG 4.8 m) glazed in blue frames with orange panels; the low rear wing (3.6 m);
 *  - the gatehouse on the Cliostraat: three storeys of white render, a ground floor with two framed windows, two storeys of
 *    ribbon glazing behind full-width balconies with railings, a thin projecting roof slab (panorama crop, 50 px/m).
 * INFERRED: the low wings' window bands, the gate's side and rear walls (plain render), the stair-hall glazing's mullion pitch.
 */
type Pt = [number, number];
type Rings = number[][][];
const src = source as unknown as {schoolRoofs: Record<string, Rings>; gateRoofs: Record<string, Rings>};

// main block corners (3DBAG roof plane 57, simplified)
const W: Pt = [-13.5, 2.5], S: Pt = [-1.6, 13.0], E: Pt = [9.1, 2.0], NE: Pt = [3.5, -3.2], NW: Pt = [-8.4, -3.7];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const C: Pt = mid(W, E), MWS = mid(W, S), MSE = mid(S, E);
const QW: Pt[] = [W, MWS, C, NW], QE: Pt[] = [E, NE, C, MSE], REAR: Pt[] = [NW, C, NE];
const OUTLINE: Pt[] = [W, S, E, NE, NW];
const LEVELS = [0, 3.85, 7.7, 11.55], ROOF = 15.4;

/** Frame on segment a-b facing away from `inside`; t runs along the frame tangent from its origin, length returned. */
function edge(a: Pt, b: Pt, inside: Pt): {f: Frame; len: number} {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
  let n: Pt = [-tz, tx];
  const m = mid(a, b);
  if ((inside[0] - m[0]) * n[0] + (inside[1] - m[1]) * n[1] > 0) n = [tz, -tx];
  const tangent: Pt = [n[1], -n[0]];
  const origin = tangent[0] * tx + tangent[1] * tz > 0 ? a : b;
  return {f: {origin, tangent, n}, len};
}
const centroid = (q: Pt[]): Pt => [q.reduce((s, p) => s + p[0], 0) / q.length, q.reduce((s, p) => s + p[1], 0) / q.length];
/** Polygon offset outward by d (convex-ish rings: each vertex moved along its bisector). */
function grow(q: Pt[], d: number): Pt[] {
  const c = centroid(q);
  return q.map((p, i) => {
    const a = q[(i + q.length - 1) % q.length], b = q[(i + 1) % q.length];
    const n1 = edge(a, p, c).f.n, n2 = edge(p, b, c).f.n, bx = n1[0] + n2[0], bz = n1[1] + n2[1];
    const k = d / Math.max(0.3, (bx * n1[0] + bz * n1[1]));
    return [p[0] + bx * k, p[1] + bz * k] as Pt;
  });
}
/** Horizontal slab over polygon q from y0 to y1. */
function band(b: BuildingTools, q: Pt[], y0: number, y1: number, colour: string) {
  const g = new T.ExtrudeGeometry(new T.Shape(q.map(p => new T.Vector2(p[0], p[1]))), {depth: y1 - y0, bevelEnabled: false});
  g.rotateX(Math.PI / 2); g.translate(0, y1, 0);
  b.add(g, colour as never);
}
const flat = (q: Pt[], y: number): Rings => [q.map(p => [p[0], y, p[1]])];

/** Steel window wall on one face: mullions on `axes` equal axes and a transom per storey, from storey sill to the slab above. */
function windowWall(b: BuildingTools, f: Frame, len: number, axes: number, t0 = 0, t1 = len) {
  for (const L of LEVELS) {
    const y0 = L + 0.5, top = (L === 11.55 ? ROOF : L + 3.85) - 0.3, h = top - y0;
    for (let k = 0; k <= axes; k++) slab(b, f, t0 + (t1 - t0) * k / axes, y0, 0.08, h, 0.1, 'blue');
    slab(b, f, (t0 + t1) / 2, y0 + h * 0.62, t1 - t0, 0.07, 0.1, 'blue');
    if (L === 0) slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 0.5, 0.06, 'blue');
  }
}

/** Tubular railing on a slab edge: posts every ~1.5 m, top, middle and bottom rails (frame `f` sits on the slab edge). */
function railing(b: BuildingTools, f: Frame, len: number, y: number, h = 1.05) {
  const n = Math.max(1, Math.round(len / 1.5));
  for (let k = 0; k <= n; k++) slab(b, f, 0.1 + (len - 0.2) * k / n, y, 0.06, h, 0.06, 'concrete', -0.12);
  for (const r of [h - 0.05, h * 0.5, 0.12]) slab(b, f, len / 2, y + r, len - 0.2, 0.05, 0.05, 'concrete', -0.12);
}

function column(b: BuildingTools, p: Pt, top: number) {
  b.add(new T.BoxGeometry(0.42, top - 1.0, 0.42).translate(p[0], 1.0 + (top - 1.0) / 2, p[1]), 'white' as never);
  b.add(new T.BoxGeometry(0.46, 1.0, 0.46).translate(p[0], 0.5, p[1]), 'blue' as never);
}

function school(b: BuildingTools & {mark?: (n: string) => void}) {
  // classroom wings: closed glass prisms under the roof slab; the rear stair hall white; the loggia quadrant left open
  roofPrism(b, flat(QW, ROOF), 'glass', 'white');
  roofPrism(b, flat(QE, ROOF), 'glass', 'white');
  roofPrism(b, flat(REAR, ROOF), 'white', 'white');
  // stair hall rising to 18 m (3DBAG 54) in glass, with the rooftop frames (52, 56) and the low wings (58 rear, 53 gymnasium)
  roofPrism(b, src.schoolRoofs['54'], 'glass', 'white');
  roofPrism(b, src.schoolRoofs['52'], 'white', 'white');
  roofPrism(b, src.schoolRoofs['56'], 'white', 'white');
  roofPrism(b, src.schoolRoofs['58'], 'white', 'slate');
  roofPrism(b, src.schoolRoofs['53'], 'white', 'slate');
  b.mark?.('shell');

  // slab bands: 0.35 m beyond the glass, from 0.3 m under each floor to its 0.5 m sill; the roof band; the ground plinth
  const out = grow(OUTLINE, 0.35);
  for (const L of LEVELS.slice(1)) band(b, out, L - 0.3, L + 0.5, 'white');
  band(b, out, ROOF - 0.45, ROOF + 0.15, 'white');

  setSink(0.05);
  // glass walls: the outer sides of both wings (eight axes, register), the wing sides facing the loggias, the stair-hall front
  const cW = centroid(QW), cE = centroid(QE);
  for (const [a, c, inside] of [[W, MWS, cW], [NW, W, cW], [E, NE, cE], [MSE, E, cE], [MWS, C, cW], [C, MSE, cE]] as [Pt, Pt, Pt][]) {
    const {f, len} = edge(a, c, inside);
    windowWall(b, f, len, len > 7 ? 8 : 6);
  }
  // rear: the recessed glazed stair hall in the middle of the back between white wall ends
  {
    const {f, len} = edge(NW, NE, C);
    slab(b, f, len / 2, 0.3, 4.6, ROOF - 0.6, 0.08, 'glass');
    for (let k = 0; k <= 6; k++) slab(b, f, len / 2 - 2.3 + 4.6 * k / 6, 0.3, 0.08, ROOF - 0.6, 0.14, 'blue');
    for (const L of LEVELS.slice(1)) slab(b, f, len / 2, L - 0.1, 4.6, 0.1, 0.14, 'blue');
  }
  setSink(0);

  // loggias: railings on the slab edges of the south quadrant at every upper floor; railings round the roof
  for (const L of LEVELS.slice(1)) for (const [a, c] of [[mid(out[0], out[1]), out[1]], [out[1], mid(out[1], out[2])]] as [Pt, Pt][]) {
    const {f, len} = edge(a, c, C);
    railing(b, f, len, L + 0.5);
  }
  for (let i = 0; i < out.length; i++) {
    const {f, len} = edge(out[i], out[(i + 1) % out.length], C);
    railing(b, f, len, ROOF + 0.15);
  }
  // ground floor under the loggias: a white enclosure 1.8 m behind the slab edge with the glazed entrance (Commons 8157211576)
  {
    const towards0 = (p: Pt, q: Pt, d: number): Pt => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) * d / L, p[1] + (q[1] - p[1]) * d / L]; };
    const g: Pt[] = [towards0(S, C, 1.8 * Math.SQRT2), towards0(MSE, C, 1.8), C, towards0(MWS, C, 1.8)];
    roofPrism(b, flat(g, LEVELS[1] - 0.25), 'white', 'white');
    setSink(0.05);
    for (const [a, c] of [[g[3], g[0]], [g[0], g[1]]] as [Pt, Pt][]) {
      const {f, len} = edge(a, c, C);
      slab(b, f, len - 1.6, 0, 2.2, 2.6, 0.08, 'glass');
      for (const t of [len - 2.7, len - 1.6, len - 0.5]) slab(b, f, t, 0, 0.08, 2.6, 0.14, 'blue');
      slab(b, f, len - 1.6, 2.55, 2.2, 0.08, 0.14, 'blue');
      slab(b, f, (len - 2.75) / 2, 0, len - 2.75, 0.5, 0.06, 'blue');
    }
    setSink(0);
  }
  // columns: where the loggia meets each wing (set in 0.8 m) and in the middle of the loggia, dark blue at the foot
  const towards = (p: Pt, q: Pt, d: number): Pt => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) * d / L, p[1] + (q[1] - p[1]) * d / L]; };
  for (const p of [towards(MWS, C, 0.8), towards(MSE, C, 0.8), mid(S, C)]) column(b, p, ROOF - 0.45);

  // gymnasium (3DBAG 53): blue-framed glazing on its three free sides, orange panels in the end bays, white fascia
  const gym = src.schoolRoofs['53'][0].map(p => [p[0], p[2]] as Pt), gc = centroid(gym);
  setSink(0.05);
  for (let i = 0; i < gym.length; i++) {
    const a = gym[i], c = gym[(i + 1) % gym.length];
    if (i === gym.length - 1) continue;   // the side against the main block (9.1, 2) -> (4, 7.6)
    const {f, len} = edge(a, c, gc);
    if (len < 3) continue;
    const bays = Math.round(len / 1.2);
    slab(b, f, len / 2, 0.5, len - 0.4, 3.4, 0.08, 'glass');
    for (let k = 0; k <= bays; k++) slab(b, f, 0.2 + (len - 0.4) * k / bays, 0.5, 0.08, 3.4, 0.18, 'blue');
    for (const k of [bays - 2, bays - 1]) slab(b, f, 0.2 + (len - 0.4) * (k + 0.5) / bays, 0.6, (len - 0.4) / bays - 0.14, 3.2, 0.13, 'red');
    slab(b, f, len / 2, 0, len, 0.5, 0.1, 'blue');
  }
  setSink(0);
}

function gatehouse(b: BuildingTools) {
  // 3DBAG plane 47 (a 1.4 m strip at 12.3-13.2 m along the east edge) is the taller brick neighbour's flank on the panorama, not
  // the white gatehouse; it is left out.
  for (const k of ['49', '46', '48']) roofPrism(b, src.gateRoofs[k], 'white', 'slate');
  // street front (panorama crop w01-177, 50 px/m): t from the west end of the white front
  const a: Pt = [0.6 + 2.73, 12.7 + 37.702], c: Pt = [7.3 + 2.73, 12.3 + 37.702];
  const {f} = edge(a, c, [a[0] + 2, a[1] - 5]);
  setSink(0.05);
  const pane = (t0: number, t1: number, y0: number, y1: number, pitch: number) => {
    slab(b, f, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.08, 'glass');
    const n = Math.max(1, Math.round((t1 - t0) / pitch));
    for (let k = 0; k <= n; k++) slab(b, f, t0 + (t1 - t0) * k / n, y0, 0.07, y1 - y0, 0.13, 'blue');
    slab(b, f, (t0 + t1) / 2, y0, t1 - t0, 0.07, 0.13, 'blue');
    slab(b, f, (t0 + t1) / 2, y1 - 0.07, t1 - t0, 0.07, 0.13, 'blue');
  };
  pane(0.36, 2.24, 1.9, 2.9, 0.95);
  pane(2.56, 6.2, 1.0, 2.9, 0.9);
  pane(0.36, 6.2, 3.65, 5.6, 0.65);
  pane(0.36, 6.2, 6.45, 8.25, 0.65);
  setSink(0);
  for (const [y0, y1] of [[3.15, 3.65], [5.85, 6.45]]) {
    slab(b, f, 3.3, y0, 6.9, y1 - y0, 0.95, 'white', -0.1);
    const rail: Frame = {...f, origin: [f.origin[0] + f.n[0] * 0.85, f.origin[1] + f.n[1] * 0.85]};
    railing(b, rail, 6.6, y1, 0.85);
  }
  slab(b, f, 3.4, 8.45, 7.2, 0.5, 1.35, 'white', -0.25);
}

export function buildEersteOpenluchtschool(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  school(b);
  gatehouse(b);
}
