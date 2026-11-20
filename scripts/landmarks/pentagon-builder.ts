import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon, type Surface} from './worship-shell';
import {facePanel, getSink, put, ringFrame, roofHeightAt, setSink, slab, wallProbe, type Frame} from './nearbar-kit';
import source from './pentagon-footprints.json';

/**
 * HET PENTAGON (Theo Bosch with Aldo van Eyck, 1975-1983; BAG panden 0363100012171628 and 0363100012178153, gemeentelijk
 * monument 200980): the five-sided social-housing block round a semi-public courtyard between the Sint Antoniesbreestraat,
 * the Zwanenburgwal, the Raamgracht and the Moddermolenstraat. The register names its character: "de plasticiteit van de
 * gevels met de in zicht gelaten betonkolommen", the arcade with shops, the materials and colours.
 * Massing: the 3DBAG LoD2.2 shells of both panden (pentagon-footprints.json, pentagon-prepare.ts), each on its own ground.
 * Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per item in pentagon-inventory.json:
 *  - every exposed wall: the exposed concrete frame (light grey-beige columns at every bay and slab edges at every floor),
 *    white-framed glazing over pale blue-grey spandrel panels (pale green on the Moddermolenstraat side), a pale brick
 *    plinth, a concrete coping (w08-318, w09-336, w04-220, w06-221, w13-135, w17-135);
 *  - the Sint Antoniesbreestraat arcade (w01-71, w11-77, w14-0, w16-12): a tall shop storey under the first floor with the
 *    white raking struts that read as a row of gables over the shop windows, glazed clerestories, round concrete columns
 *    and red shop frames;
 *  - the balconies: the stacked half-round balconies on round columns at the corners of the stepped plan (w08-318,
 *    w09-336, w13-135, w15-134) and, on the main Sint Antoniesbreestraat front (w01-71, 2024 view), the two wide curved
 *    balconies on the first and third floors, the small round balconies between them, the corner balconies and the
 *    railed roof terrace over the middle bay.
 */
type Src = {surfacePand: number[]; nativeRings: number[][][]; exposed: boolean[][]; facadeRings: number[][][]; facadeExposed: boolean[][]; surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;
type Col = Parameters<BuildingTools['add']>[1];

/** Storey height of the housing floors (w01-71 2024 rectified: slab edges at 4.7, 7.45, 10.2, 12.95 m). */
const STOREY = 2.75;
/** Coping band at the top of every wall. */
const COPING = 0.4;
/** Bay between concrete columns (w01-71 2024 rectified: columns at 0.3, 5.0, 9.3, 13.4, 18.1 m). */
const BAY = 4.5;
/** Glass and spandrel panels stand PANEL_OUT proud of the shell wall, the white bars FRAME_OUT, crossing bars TRANSOM_OUT (5-6 cm apart: no z-fight). */
const PANEL_OUT = 0.05, FRAME_OUT = 0.1, TRANSOM_OUT = 0.16;
const bearingOf = (f: Frame) => (Math.atan2(f.n[0], -f.n[1]) * 180 / Math.PI + 360) % 360;
const P = (f: Frame, t: number, o = 0): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];

/** Eaves height over a stretch of a wall: the lowest roof just inside it. */
function topOver(f: Frame, t0: number, t1: number): number | null {
  const ys: number[] = [];
  for (const u of [0.15, 0.5, 0.85]) {
    const [x, z] = P(f, t0 + (t1 - t0) * u, -0.4);
    const y = roofHeightAt(src.surfaces, x, z);
    if (y !== null) ys.push(y);
  }
  return ys.length ? Math.min(...ys) : null;
}
/** The 3DBAG walls as a ray target: glazing goes only where a shell wall really stands in the ring edge's plane. */
const probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
/** True when the shell wall lies within 6 cm of frame f over the whole rectangle (corners, edge midpoints and centre). */
function walled(f: Frame, t0: number, t1: number, y0: number, y1: number): boolean {
  for (const t of [t0, (t0 + t1) / 2, t1]) for (const y of [y0, (y0 + y1) / 2, y1]) {
    const o = probe.offset(f, t, y);
    if (o === null || Math.abs(o) > 0.06) return false;
  }
  return true;
}
/** Housing floors under a wall top: their count and the height of the first floor (the rest of the height is the ground storey). */
function grid(top: number, arcade: boolean) {
  const usable = top - COPING;
  let n = Math.max(0, Math.floor((usable - (arcade ? 4.4 : 2.9)) / STOREY));
  let g = usable - n * STOREY;
  if (n > 0 && g > 5.2) { n++; g -= STOREY; }
  return {n, g};
}

export function buildPentagon(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'concrete', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.06, true);
  const corners: Corner[] = [];
  src.facadeRings.forEach((ring, k) => corners.push(...convexCorners(ring, src.facadeExposed[k])));
  shellWalls(b);
  for (const c of corners) cornerBalconies(b, c);
  mainFront(b);
  setSink(sink0);
}

/** One exposed wall: bays of about 3.6 m between concrete columns, each with its own top (stepped heights). */
function front(b: BuildingTools, f: Frame, len: number, o: {arcade: boolean; spandrel: Col}) {
  const nb = Math.max(1, Math.round(len / BAY)), bw = len / nb;
  for (let j = 0; j < nb; j++) {
    const t0 = j * bw, t1 = t0 + bw, tc = (t0 + t1) / 2;
    const top = topOver(f, t0, t1);
    if (top === null || top < 2.5) continue;
    const {n, g} = grid(top, o.arcade);
    // coping
    // its top 8 cm over the highest roof within 0.25 m of the wall, so a sloped roof never meets it in one plane
    let rim = top;
    for (const u of [0.05, 0.3, 0.5, 0.7, 0.95]) for (const d of [-0.05, -0.25]) {
      const [x, z] = P(f, t0 + bw * u, d), y = roofHeightAt(src.surfaces, x, z);
      if (y !== null && y < top + 1.2) rim = Math.max(rim, y);
    }
    slab(b, f, tc, rim + 0.08 - COPING, bw + 0.02, COPING, 0.12, 'concrete');
    // column at the bay's left edge (and the wall's right end)
    const colH = top - COPING + 0.05;
    if (len >= 1.6) {
      slab(b, f, t0 + 0.16, 0, 0.32, colH, 0.16, 'concrete');
      if (j === nb - 1) slab(b, f, t1 - 0.16, 0, 0.32, colH, 0.16, 'concrete');
    }
    const c0 = len >= 1.6 ? t0 + 0.32 : t0 + 0.05, c1 = len >= 1.6 ? (j === nb - 1 ? t1 - 0.32 : t1) : t1 - 0.05;
    const w = c1 - c0, cm = (c0 + c1) / 2;
    // jogs under 1.6 m stay plain concrete (the 3DBAG wall planes of a short jog are not the BAG edge's)
    if (len < 1.6 || w < 0.5) continue;
    // ground storey
    if (!walled(f, c0 + 0.05, c1 - 0.05, 0.4, g - 0.3)) { /* a gateway or a jog the shell does not close: no glazing */ }
    else if (o.arcade) arcadeBay(b, f, cm, w, g, j);
    else groundBay(b, f, cm, w, g);
    // housing floors: slab edge, spandrel panel, white-framed glazing
    for (let s = 0; s < n; s++) {
      const y0 = g + s * STOREY;
      if (!walled(f, c0 + 0.05, c1 - 0.05, y0 + 0.2, y0 + STOREY - 0.15)) continue;
      slab(b, f, cm, y0 - 0.12, w, 0.3, 0.1, 'concrete');
      facePanel(b, f, cm, y0 + 0.18, w, 0.82, o.spandrel, PANEL_OUT);
      facePanel(b, f, cm, y0 + 1.0, w, STOREY - 1.12, 'glass', PANEL_OUT);
      glazingBars(b, f, cm, w, y0 + 0.18, y0 + STOREY - 0.12, y0 + 1.0);
    }
    // the roof-line slab edge under the coping
    slab(b, f, cm, g + n * STOREY - 0.12, w, 0.3, 0.1, 'concrete');
  }
}

/** White frame bars: mullions about every 1.1 m from spandrel to head, one transom over the spandrel. */
function glazingBars(b: BuildingTools, f: Frame, cm: number, w: number, y0: number, y1: number, ytr: number) {
  // mullions 5 cm over the glass, transom and head a further 6 cm out, so crossing bars never share a plane
  const panes = Math.max(1, Math.round(w / 1.1));
  for (let q = 1; q < panes; q++) facePanel(b, f, cm - w / 2 + (q * w) / panes, y0, 0.07, y1 - y0, 'frame', FRAME_OUT);
  const out = panes > 1 ? TRANSOM_OUT : FRAME_OUT; // nothing to cross on a single pane: keep it on the mullion plane
  facePanel(b, f, cm, ytr - 0.04, w, 0.08, 'frame', out);
  facePanel(b, f, cm, y1 - 0.08, w, 0.08, 'frame', out);
}

/** Ground storey of the residential fronts: pale brick plinth, glazing with a door-height transom (w08-318, w04-220). */
function groundBay(b: BuildingTools, f: Frame, cm: number, w: number, g: number) {
  slab(b, f, cm, 0, w, 0.55, 0.06, 'greyBrick');
  if (g < 2.6) return;
  facePanel(b, f, cm, 0.55, w, g - 0.75, 'glass', PANEL_OUT);
  glazingBars(b, f, cm, w, 0.55, g - 0.2, Math.min(2.6, g - 0.5));
}

/**
 * Arcade bay (w01-71 2024 view, w11-77, w14-0): shop glazing in a red or white frame up to the raking white struts, a
 * glazed clerestory with close white bars above them, the struts rising from 2.2 m at the columns to 3.3 m mid-bay, and a
 * round concrete column at the bay edge.
 */
function arcadeBay(b: BuildingTools, f: Frame, cm: number, w: number, g: number, j: number) {
  slab(b, f, cm, 0, w, 0.3, 0.06, 'greyBrick');
  facePanel(b, f, cm, 0.3, w, g - 0.5, 'glass', PANEL_OUT);
  // shop frames: red on alternate bays (w01-71: the red shopfronts of the middle and right bays)
  const fr: Col = j % 2 === 1 ? 'red' : 'frame';
  for (const s of [-1, 1]) facePanel(b, f, cm + s * (w / 2 - 0.05), 0.3, 0.1, 2.0, fr, FRAME_OUT);
  facePanel(b, f, cm, 0.3, 0.1, 2.2, fr, FRAME_OUT);
  // clerestory bars about every 0.55 m above the struts
  const bars = Math.max(2, Math.round(w / 0.55));
  for (let q = 1; q < bars; q++) {
    const t = -w / 2 + (q * w) / bars, ys = 2.2 + 0.8 * (1 - Math.abs(t) / (w / 2));
    facePanel(b, f, cm + t, ys, 0.05, g - 0.2 - ys, 'frame', FRAME_OUT);
  }
  facePanel(b, f, cm, g - 0.28, w, 0.08, 'frame', TRANSOM_OUT);
  // the raking struts: two white bars meeting mid-bay
  const half = w / 2, rise = 1.1, L = Math.hypot(half, rise), a = Math.atan2(rise, half);
  for (const s of [-1, 1]) {
    const g2 = new T.BoxGeometry(L, 0.12, 0.08).translate(0, 0, 0.04).rotateZ(s * a);
    put(b, f, g2, cm - s * half / 2, 2.2 + rise / 2, 0.16 + (s > 0 ? 0 : 0.03), 'stone');
  }
  // round column at the bay's left edge, standing clear of the glazing
  column(b, f, cm - w / 2 - 0.16, 0.45, 0, g, 0.2);
}

/** Round concrete column at (t, out) on frame f, from y0 to y1. */
function column(b: BuildingTools, f: Frame, t: number, out: number, y0: number, y1: number, r = 0.18) {
  put(b, f, new T.CylinderGeometry(r, r, y1 - y0, 10).translate(0, (y1 - y0) / 2, 0), t, y0, out, 'concrete');
}

/** Plan outline of a balcony: half an ellipse of width w along the wall and depth d out of it (x along, y out). */
function balconyOutline(w: number, d: number, seg = 10): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) { const a = Math.PI - (i / seg) * Math.PI; pts.push([Math.cos(a) * w / 2, Math.sin(a) * d]); }
  return pts;
}
/** Balcony slab (curved front, its back in the wall) and its railing, floor at y. */
function balcony(b: BuildingTools, f: Frame, tc: number, y: number, w: number, d: number, out = 0) {
  const outline = balconyOutline(w, d);
  const s = new T.Shape(outline.map(([x, z]) => new T.Vector2(x, z)));
  // slab: extruded 0.24 m downward from the floor line, sunk 0.1 m into the wall
  const g = new T.ExtrudeGeometry(s, {depth: 0.24, bevelEnabled: false, curveSegments: 1}).rotateX(Math.PI / 2).translate(0, 0.24, -0.1);
  put(b, f, g, tc, y - 0.24, out, 'concrete');
  railing(b, f, tc, y, outline, out);
}
/** Light metal railing along a balcony outline: top rail band and thin balusters (front-facing quads). */
function railing(b: BuildingTools, f: Frame, tc: number, y: number, outline: [number, number][], out = 0) {
  const pos: number[] = [];
  const quad = (a: number[], c: number[], h0: number, h1: number) => {
    // two-sided band between plan points a and c, from h0 to h1
    const v = [[a[0], h0, a[1]], [c[0], h0, c[1]], [c[0], h1, c[1]], [a[0], h1, a[1]]];
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]) pos.push(...v[i], ...v[j], ...v[k]);
  };
  const inset = outline.map(([x, z]) => [x * 0.985, Math.max(0, z - 0.04)]);
  for (let i = 0; i + 1 < inset.length; i++) {
    quad(inset[i], inset[i + 1], 0.94, 1.0);
    quad(inset[i], inset[i + 1], 0.02, 0.1);
    // balusters: three per outline segment
    for (const u of [0.2, 0.5, 0.8]) {
      const p = [inset[i][0] + (inset[i + 1][0] - inset[i][0]) * u, inset[i][1] + (inset[i + 1][1] - inset[i][1]) * u];
      const dx = inset[i + 1][0] - inset[i][0], dz = inset[i + 1][1] - inset[i][1], l = Math.hypot(dx, dz) || 1;
      const h = 0.018;
      quad([p[0] - dx / l * h, p[1] - dz / l * h], [p[0] + dx / l * h, p[1] + dz / l * h], 0.1, 0.94);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  put(b, f, g, tc, y, out, 'bronze');
}

/** Exposure of the BAG ring edge nearest a plan point (within 0.6 m), or null when no ring edge is that close. */
function edgeExposed(x: number, z: number): boolean | null {
  let best = 0.6, out: boolean | null = null;
  src.nativeRings.forEach((ring, k) => ring.forEach((a, i) => {
    const c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), d = Math.hypot(a[0] + dx * u - x, a[1] + dz * u - z);
    if (d < best) { best = d; out = src.exposed[k][i]; }
  }));
  return out;
}
/**
 * Every 3DBAG wall polygon, framed on its own plane (the BAG ring's curved courtyard runs are many sub-metre edges under one
 * 3DBAG plane, so the facade follows the shell, not the ring):
 *  - walls standing on the ground with nothing in front and on an exposed BAG edge: the street and courtyard fronts (front());
 *  - walls rising from a lower roof (bottom above 2 m, or the party wall between the two panden above the lower one's roof):
 *    the set-back top floors and roof terraces (w04-220: four floors at the left, five and six at the right; w01-71 the
 *    set-back middle bay), the same frame with floors counted up from the foot, facing the side with the lower roof;
 *  - walls over a gateway (bottom above 2 m, nothing in front): the same, the passage itself left open.
 */
function shellWalls(b: BuildingTools) {
  src.surfaces.forEach((s, si) => {
    if (s.type !== 'WallSurface') return;
    const r = s.rings[0], ys = r.map(p => p[1]), yt = Math.max(...ys);
    let yb = Math.min(...ys);
    // horizontal normal (Newell) and the run along the wall
    let nx = 0, nz = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    const nl = Math.hypot(nx, nz);
    if (nl < 1e-6) return;
    let n: [number, number] = [nx / nl, nz / nl];
    const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
    const front0 = roofHeightAt(src.surfaces, cx + n[0] * 0.5, cz + n[1] * 0.5), back0 = roofHeightAt(src.surfaces, cx - n[0] * 0.5, cz - n[1] * 0.5);
    const swap = (front0 ?? -1) > (back0 ?? -1);
    if (swap) n = [-n[0], -n[1]];
    const lower = swap ? back0 : front0;
    const tangent: [number, number] = [n[1], -n[0]];
    const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts), len = Math.max(...ts) - t0;
    if (len < 1.6) return;
    const off = cx * n[0] + cz * n[1];
    const f: Frame = {origin: [tangent[0] * t0 + n[0] * off, tangent[1] * t0 + n[1] * off], tangent, n};
    if (yb < 2 && lower === null) {
      if (edgeExposed(cx, cz) !== true) return;
      const k = src.surfacePand[si], mid = P(f, len / 2), brg = bearingOf(f);
      // the arcade: the first pand's Sint Antoniesbreestraat front and its north corner (north-east quadrant, facing N to E)
      const arcade = k === 0 && mid[0] > 2 && mid[1] < 0 && (brg < 100 || brg > 330);
      // Moddermolenstraat side of the second pand: pale green spandrels (w07-306, w08-318 right edge)
      const spandrel: Col = k === 1 && brg > 270 ? 'green' : 'blue';
      front(b, f, len, {arcade, spandrel});
      return;
    }
    if (yb < 2) yb = lower! + 0.05;
    if (yt - yb < 2.4) return;
    const nb = Math.max(1, Math.round(len / BAY)), bw = len / nb;
    for (let j = 0; j < nb; j++) {
      const c0 = j * bw + 0.3, c1 = (j + 1) * bw - (j === nb - 1 ? 0.3 : 0), w = c1 - c0, cm = (c0 + c1) / 2;
      // set-back slivers under 1.6 m of glass stay plain concrete
      for (let k = 0; w >= 1.6 && yb + 0.1 + (k + 1) * STOREY <= yt + 0.05; k++) {
        const y0 = yb + 0.1 + k * STOREY;
        if (!walled(f, c0 + 0.05, c1 - 0.05, y0 + 0.2, y0 + STOREY - 0.15)) continue;
        // slab edge over every storey (the white head bar rests on it)
        slab(b, f, cm, y0 + STOREY - 0.15, w, 0.25, 0.1, 'concrete');
        facePanel(b, f, cm, y0 + 0.18, w, 0.82, 'blue', PANEL_OUT);
        facePanel(b, f, cm, y0 + 1.0, w, STOREY - 1.12, 'glass', PANEL_OUT);
        glazingBars(b, f, cm, w, y0 + 0.18, y0 + STOREY - 0.12, y0 + 1.0);
      }
      if (walled(f, j * bw + 0.1, j * bw + 0.3, yb + 0.2, yt - 0.3)) slab(b, f, j * bw + 0.16, yb, 0.32, yt - yb - 0.12, 0.16, 'concrete'); // stops under the upper roof, not in its plane
    }
  });
}

type Corner = {f: Frame; top: number; arcade: boolean};
/**
 * Convex corners of the stepped plan where both walls are exposed and at least 1.4 m long and the plan turns 14-110 deg:
 * the stacked half-round balconies on round columns (w08-318, w09-336, w13-135, w15-134). The balcony faces the bisector.
 */
function convexCorners(ring: number[][], exposed: boolean[]): Corner[] {
  const out: Corner[] = [];
  const n = ring.length;
  const area = ring.reduce((a, p, i) => { const q = ring[(i + 1) % n]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  for (let i = 0; i < n; i++) {
    const ip = (i - 1 + n) % n;
    if (!exposed[ip] || !exposed[i]) continue;
    const a = ring[ip], v = ring[i], c = ring[(i + 1) % n];
    const l1 = Math.hypot(v[0] - a[0], v[1] - a[1]), l2 = Math.hypot(c[0] - v[0], c[1] - v[1]);
    if (l1 < 1.4 || l2 < 1.4) continue;
    const e1 = [(v[0] - a[0]) / l1, (v[1] - a[1]) / l1], e2 = [(c[0] - v[0]) / l2, (c[1] - v[1]) / l2];
    const cross = e1[0] * e2[1] - e1[1] * e2[0], turn = Math.acos(Math.max(-1, Math.min(1, e1[0] * e2[0] + e1[1] * e2[1]))) * 180 / Math.PI;
    // convex when the turn has the ring's own winding sense
    if (Math.sign(cross) !== Math.sign(area) || turn < 14 || turn > 110) continue;
    // outward bisector: average of the two outward normals
    const n1 = ringFrame(ring, ip).f.n, n2 = ringFrame(ring, i).f.n;
    let bx = n1[0] + n2[0], bz = n1[1] + n2[1];
    const bl = Math.hypot(bx, bz); bx /= bl; bz /= bl;
    const f: Frame = {origin: [v[0], v[1]], n: [bx, bz], tangent: [-bz, bx]};
    const top = topOver({origin: [v[0] - bz * 0.0, v[1]], n: [bx, bz], tangent: [-bz, bx]}, -0.6, 0.6);
    if (top === null || top < 8) continue;
    out.push({f, top, arcade: false});
  }
  return out;
}
function cornerBalconies(b: BuildingTools, c: Corner) {
  if (Math.hypot(c.f.origin[0] - MAIN.x, c.f.origin[1] - MAIN.z) < 12) return; // the main front has its own
  const {n, g} = grid(c.top, false);
  const r = 1.15;
  for (let s = 1; s < n; s++) balcony(b, c.f, 0, g + s * STOREY, 2 * r, r + 0.35, 0.0);
  column(b, c.f, 0, r + 0.2, 0, g + (n - 1) * STOREY - 0.24, 0.16);
}

/**
 * Main Sint Antoniesbreestraat front (ring 0 edge 150, 19.4 m, w01-71; read from the 2024 view
 * b_20250108_1349_Track02_Sphere_00036 rectified at 50 px/m, metres from the viewer's left): wide curved balconies
 * 1.5-7.9 m and 11.4-17.8 m on the first (4.7 m) and third (10.2 m) floors, small round balconies at 6.9 and 12.4 m on
 * the second floor, round balconies at 2.4 and 16.9 m on the second and fourth floors, round columns at 4.8 and 14.5 m
 * carrying the third-floor balconies and a slender column mid-front to the roof, the railed roof terrace over the middle.
 */
const MAIN_EDGE = 150;
const MAIN = (() => {
  const ring = src.nativeRings[0], a = ring[MAIN_EDGE], c = ring[(MAIN_EDGE + 1) % ring.length];
  return {x: (a[0] + c[0]) / 2, z: (a[1] + c[1]) / 2};
})();
function mainFront(b: BuildingTools) {
  const {f, len} = ringFrame(src.nativeRings[0], MAIN_EDGE);
  const top = topOver(f, 0, len) ?? 15.6;
  const {g} = grid(top, true);
  const lv = (k: number) => g + k * STOREY;
  const mirror = (t: number) => len - t;
  for (const t of [4.7, mirror(4.7)]) {
    balcony(b, f, t, lv(0), 6.4, 1.7, 0.1);
    balcony(b, f, t, lv(2), 6.4, 1.7, 0.1);
  }
  for (const t of [6.9, mirror(6.9)]) balcony(b, f, t, lv(1), 1.7, 1.0, 0.1);
  for (const t of [2.4, mirror(2.4)]) for (const k of [1, 3]) balcony(b, f, t, lv(k), 2.5, 1.3, 0.1);
  for (const t of [4.8, mirror(4.8)]) column(b, f, t, 1.35, 0, lv(2) - 0.24, 0.2);
  column(b, f, len / 2, 0.35, 0, top - COPING, 0.15);
  // roof terrace railing over the middle bay (the top storey is set back there)
  const half = 2.3, pts: [number, number][] = [[-half, 0.05], [-half, 0.6], [half, 0.6], [half, 0.05]];
  railing(b, f, len / 2, top - 0.02, pts, 0);
}
