import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, ledgeStrip, type Frame} from './nearbar-kit';
import {quad} from './big-facade';
import {upwardRoofPlane} from './house-geometry';
import source from './autopon-footprints.json';

/**
 * Autopon, Overtoom 527-557 / Zocherstraat 42-50 (BAG pand 0363100012236735, bouwjaar 1961; Rijksmonument 532201,
 * "Garage 'Autopon' met showroom en galerijflat"). Built 1955-1961 for Pon Automobielen to a design by Ben Ingwersen in the
 * office of Commer de Geus (nl.wikipedia Zocherstraat (Amsterdam), Ben Ingwersen, Beschermingsprogramma Wederopbouw 1959-1965).
 *
 * Native frame of scripts/landmarks/autopon-footprints.json (x east, z south, y up from the 3DBAG ground 0.58 m NAP; origin =
 * vertex average of the BAG ring in RD, written by citroen-zuid-prepare.ts --id=autopon). Evidence per wall is in
 * scripts/landmarks/autopon-inventory.json; heights from rectified Gemeente Amsterdam panorama crops (CC BY 4.0, 48-50 px/m)
 * checked against the 3DBAG LoD2.2 roof parts (CC BY 4.0):
 *  - the Overtoom front is a circular arc: the nine BAG front vertices fit R 166.45 m about (91.12, 110.62) within 3 cm,
 *    from bearing -51.05 deg (south-west end, a radial end wall) to -24.6 deg (north-east party wall);
 *  - galerijflat slab: 3DBAG roof parts reach back to r 151.4-152.6, so the slab is about 14.5 m deep; five loggia storeys
 *    (w01-330/w07-314: floors 8.6 m + 3.06 m, top 23.9 m; 3DBAG front strip 23.7 m); loggia grid of 1.72 m sub-bays with a
 *    thick pier every third (w01-330 at 48 px/m: thick piers 240-255 px apart, thin fins about 83 px); slatted balustrades;
 *    a set-back top storey to 26.7 m over the south-west part (3DBAG 26.7 part, r 151-163, bearing -50.3..-37.6; the
 *    Commons photo Autopon.jpg shows its window band, small canopies and chimney pots), the white box (3DBAG 30.3 m) on the
 *    north-east part, the south-west penthouse with its cantilevered balcony and roof (Autopon.jpg, w12-215; 3DBAG 30.8 m);
 *  - showroom: two-tier glazing set back under a deep soffit (8.0 m) behind tapered pilotis on a 3.3 deg (9.6 m) pitch whose
 *    positions w01-330 gives at 9.8 / 19.4 / 28.5 m from the north-east end (w07-314 confirms -41.2 and -44.3 deg);
 *  - north-east head: stone-clad base, red-framed curtain wall, the blade to 32.4 m and the lift box (3DBAG 30.1 m);
 *  - the annex pavilion in front (BAG notch, w04-337/w03-321/w12-215): dark base, glazed upper box with yellow posts, 6.6 m
 *    (3DBAG puts 23 m on it, which every photo contradicts);
 *  - Zocherstraat back (w02-158, w10-158, w11-158, w15-158, w08-158, Commons Zocherstraat 42 (5).jpg): closed ground floor,
 *    the "floating vitrine" glass band with mullions every 0.87 m, three balcony storeys to 18.5 m (3DBAG), the white
 *    external stair and the red-framed glazed stair tower (3DBAG 20.8 m) at the west end;
 *  - the garage hall between them: sawtooth roof 9.4-11.4 m with ridges running front to back (orthophoto, 3DBAG strips).
 */
type Src = {nativeRing: number[][]; facadeRing: number[][]};
const src = source as unknown as Src;
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];

const CX = 91.12, CZ = 110.62, D2R = Math.PI / 180;
const R_F = 166.45; // grid front (BAG front arc)
const R_W = 164.6; // loggia back wall
const R_P = 162.6; // piloti axis
const R_G = 161.8; // showroom glass
const R_B = 152.0; // slab back
const TH_SW = -51.05, TH_HEAD = -26.1, TH_NE = -24.6, TH_NE_BACK = -25.5;
const N_SUB = 42, D_TH = (TH_HEAD - TH_SW) / N_SUB; // 0.594 deg = 1.726 m at R_F
const Y_SOFFIT = 8.0, FLOORS = [8.6, 11.66, 14.72, 17.78, 20.84], Y_TOP = 23.9;

const P = (r: number, th: number): P2 => [CX + r * Math.sin(th * D2R), CZ - r * Math.cos(th * D2R)];
const polar = (p: number[]): [number, number] => [Math.hypot(p[0] - CX, p[1] - CZ), Math.atan2(p[0] - CX, -(p[1] - CZ)) / D2R];
/** Frame on the arc at bearing th: n outward, tangent toward decreasing bearing (the viewer's right). */
function arcFrame(r: number, th: number): Frame {
  const s = Math.sin(th * D2R), c = Math.cos(th * D2R);
  return {origin: P(r, th), tangent: [-c, -s], n: [s, -c]};
}
/** Wall frame from a (viewer's left) to b; n = outward when the solid lies to the left of a->b seen from above with z south. */
function lineFrame(a: P2, b: P2): {f: Frame; len: number} {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
  return {f: {origin: a, tangent: [tx, tz], n: [-tz, tx]}, len};
}
/** Chord of the arc at radius r from bearing thA (higher, viewer's left) to thB. */
const chord = (r: number, thA: number, thB: number) => lineFrame(P(r, thA), P(r, thB));
const thetas = (a: number, b: number, step: number): number[] => {
  const n = Math.max(1, Math.round(Math.abs(b - a) / step)), out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(a + (b - a) * k / n);
  return out;
};
/** Annular sector outline: outer arc at r1 over ths, inner arc at r0 back. */
const sector = (r0: number, r1: number, ths: number[]): P2[] => [...ths.map(t => P(r1, t)), ...[...ths].reverse().map(t => P(r0, t))];

// ---- solids from plan outlines -------------------------------------------------------------------------------------
/** Pane, slit or joint: a 5 cm strip standing on the surface at `base` (front and top faces; the top runs back into it). */
const pane = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, c: Col, base: number) => ledgeStrip(b, f, t, y, w, h, 0.05, c, base);
const shapeOf = (pts: P2[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
/** Side walls only (no caps) of an outline extruded from y0 to y1. */
function walls(b: BuildingTools, pts: P2[], y0: number, y1: number, c: Col) {
  const ex = new T.ExtrudeGeometry(shapeOf(pts), {depth: y1 - y0, bevelEnabled: false});
  ex.rotateX(Math.PI / 2); ex.translate(0, y1, 0);
  const flat = ex.index ? ex.toNonIndexed() : ex;
  const p = flat.getAttribute('position'), n = flat.getAttribute('normal'), v: number[] = [];
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].every(j => Math.abs(n.getY(i + j)) > 0.9)) continue;
    for (let j = 0; j < 3; j++) v.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  b.add(g, c);
}
const capUp = (b: BuildingTools, pts: P2[], y: number, c: Col) => b.add(upwardRoofPlane(shapeOf(pts), y), c);
function capDown(b: BuildingTools, pts: P2[], y: number, c: Col) {
  const g = new T.ShapeGeometry(shapeOf(pts)); g.rotateX(Math.PI / 2); g.computeVertexNormals(); g.translate(0, y, 0); b.add(g, c);
}
function block(b: BuildingTools, pts: P2[], y0: number, y1: number, c: Col, top: Col | null = 'slate', bottom: Col | null = null) {
  walls(b, pts, y0, y1, c);
  if (top) capUp(b, pts, y1, top);
  if (bottom) capDown(b, pts, y0, bottom);
}

// ---- the galerijflat slab and the showroom ----------------------------------------------------------------------------
const SUB = Array.from({length: N_SUB + 1}, (_, j) => TH_HEAD - j * D_TH); // from the head (high bearing) to the SW end
const isThick = (j: number) => j % 3 === 0;
/** Loggia cell j (SUB[j]..SUB[j+1]) on storey k is enclosed: the 2nd and 4th storeys, either side of every other thick pier. */
const enclosed = (j: number, k: number) => (k === 1 || k === 3) && (j % 6 === 0 || (j + 1) % 6 === 0);

function slabBody(b: BuildingTools) {
  // main body r R_B..R_W from the soffit to the roof; its front vertices are the sub-bay boundaries so the loggia
  // windows sit exactly on its chords; it runs 0.1 deg into the head block.
  const ths = [TH_HEAD + 0.1, ...SUB];
  const body = [...ths.map(t => P(R_W, t)), ...[...ths].reverse().map(t => P(R_B, t))];
  block(b, body, Y_SOFFIT, Y_TOP, 'concrete', 'slate', 'concrete');
  // loggia-zone soffit strip under the first loggia floor (front 5 cm behind the fins), 6 cm above the body soffit
  const strip = sector(R_W - 0.2, R_F - 0.05, ths);
  block(b, strip, Y_SOFFIT + 0.1, FLOORS[0], 'concrete', 'concrete', 'concrete');
  // ground-floor showroom volume behind the glass (overlaps the hall by 0.5 m)
  const gths = thetas(TH_HEAD + 0.1, TH_SW + 0.25, D_TH * 2);
  block(b, sector(R_B - 0.5, R_G, gths), 0, Y_SOFFIT - 0.05, 'dark', 'dark');
  // south-west end core: closes the ground floor at the radial end wall (Autopon.jpg: solid end with ribbon windows)
  block(b, sector(R_B - 0.5, R_F - 0.05, [TH_SW + 0.25, TH_SW]), 0, Y_SOFFIT - 0.05, 'concrete', 'concrete');
}

function loggiaGrid(b: BuildingTools) {
  const depth = R_F - R_W;
  for (let j = 0; j <= N_SUB; j++) {
    const w = isThick(j) ? 0.36 : 0.18;
    slab(b, arcFrame(R_F, SUB[j]), 0, FLOORS[0] - 0.02, w, Y_TOP + 0.17 - FLOORS[0], depth + 0.3, 'concrete', -(depth + 0.3));
  }
  for (let j = 0; j < N_SUB; j++) {
    const {f, len} = chord(R_F, SUB[j], SUB[j + 1]);
    const wl = isThick(j) ? 0.18 : 0.09, wr = isThick(j + 1) ? 0.18 : 0.09;
    const t0 = wl - 0.02, t1 = len - wr + 0.02, c = (t0 + t1) / 2, w = t1 - t0;
    const {f: back, len: blen} = chord(R_W, SUB[j], SUB[j + 1]);
    for (let k = 0; k < FLOORS.length; k++) {
      const y = FLOORS[k], next = k + 1 < FLOORS.length ? FLOORS[k + 1] : Y_TOP;
      if (k > 0) slab(b, f, c, y - 0.3, w, 0.3, depth, 'concrete', -depth - 0.05);
      if (enclosed(j, k)) {
        // room pulled forward into the loggia zone (w01-330: the cells either side of every other thick pier on the
        // 2nd and 4th loggia storeys): a front wall 0.6 m behind the fins with one red-framed window, no balustrade
        const F = -0.65, fy = y + 1.02, fh = next - 0.42 - fy;
        slab(b, f, c, y - 0.1, w, next - 0.2 - y + 0.1, depth + F, 'concrete', -depth - 0.05);
        slab(b, f, c, fy - 0.07, w - 0.3, fh + 0.14, 0.045, 'red', F);
        pane(b, f, c, fy, w - 0.44, fh, 'glass', F + 0.045);
        slab(b, f, c, fy, 0.06, fh, 0.1, 'red', F + 0.045);
        continue;
      }
      // slatted balustrade, 0.95 m, front 10 cm behind the fins; four dark slits
      slab(b, f, c, y - 0.02, w, 0.97, 0.14, 'concrete', -0.24);
      for (let s = 0; s < 4; s++) pane(b, f, t0 + w * (s + 0.5) / 4, y + 0.12, 0.08, 0.72, 'bronze', -0.10);
      // the loggia reads as a dark recess (w01-330, Autopon.jpg) from its depth; at its back the red-framed
      // window above the balustrade (the lower part of the loggia doors is hidden behind it from the street)
      const ww = blen - 0.62, wy0 = y + 1.02, wh = next - 0.42 - wy0;
      slab(b, back, blen / 2, wy0 - 0.07, ww + 0.14, wh + 0.14, 0.045, 'red', 0.05);
      pane(b, back, blen / 2, wy0, ww, wh, 'glass', 0.095);
      slab(b, back, blen / 2, wy0, 0.06, wh, 0.1, 'red', 0.095);
    }
    // roof edge over the loggia zone, 10 cm above the body roof
    slab(b, f, c, Y_TOP - 0.3, w, 0.4, depth + 0.3, 'concrete', -depth - 0.35);
  }
}

/** Tapered piloti: about 0.7 m at the foot, 1.8 m at 6.6 m, flaring to 2.6 m into the soffit; 0.8 m deep. */
function piloti(b: BuildingTools, th: number) {
  const s = new T.Shape([[-0.35, 0], [0.35, 0], [0.9, 6.6], [1.3, Y_SOFFIT + 0.02], [-1.3, Y_SOFFIT + 0.02], [-0.9, 6.6]].map(([x, y]) => new T.Vector2(x, y)));
  const g = new T.ExtrudeGeometry(s, {depth: 0.8, bevelEnabled: false});
  g.translate(0, 0, -0.4);
  const f = arcFrame(R_P, th);
  g.rotateY(Math.atan2(f.n[0], f.n[1]));
  g.translate(f.origin[0], 0, f.origin[1]);
  b.add(g, 'concrete');
}

function showroom(b: BuildingTools) {
  const gths = thetas(TH_HEAD + 0.1, TH_SW + 0.25, D_TH * 2);
  const [a0, a1] = annexBearings();
  for (let k = 0; k + 1 < gths.length; k++) {
    const mid = (gths[k] + gths[k + 1]) / 2;
    if (mid < a0 + 0.3 && mid > a1 - 0.3) continue; // hidden behind the annex
    const {f, len} = chord(R_G, gths[k], gths[k + 1]), c = len / 2;
    pane(b, f, c, 0.05, len - 0.1, 3.35, 'glass', 0);
    slab(b, f, c, 3.4, len, 0.35, 0.12, 'dark');
    pane(b, f, c, 3.8, len - 0.1, 2.8, 'glass', 0);
    slab(b, f, c, 6.6, len + 0.02, 0.12, 0.08, 'frame');
    for (const t of [0.05, len / 2]) { pane(b, f, t + 0.06, 0.05, 0.07, 3.35, 'frame', 0.05); pane(b, f, t + 0.06, 3.8, 0.07, 2.8, 'frame', 0.05); }
  }
  for (let k = 0; k < 7; k++) piloti(b, -27.97 - 3.3 * k);
}

/** North-east head: stone-clad base, red-framed curtain wall, roof band; the blade and the lift box above. */
function headBlock(b: BuildingTools) {
  const ths = thetas(TH_NE, TH_HEAD, 0.75);
  const pts: P2[] = [...ths.map(t => P(R_F, t)), P(R_B, TH_HEAD), P(R_B, TH_NE_BACK)];
  block(b, pts, 0, 27.2, 'concrete', 'slate');
  for (let k = 0; k + 1 < ths.length; k++) {
    const {f, len} = chord(R_F, ths[k], ths[k + 1]), c = len / 2;
    slab(b, f, c, 0, len - 0.2, 8.3, 0.08, 'stone');
    for (let y = 1.4; y < 8.3; y += 1.4) pane(b, f, c, y, len - 0.3, 0.025, 'frame', 0.08);
    for (let y = 8.57; y < 26.4; y += 1.53) pane(b, f, c, y, len - 0.3, Math.min(1.41, 26.4 - y), 'glass', 0);
    for (let y = 8.45; y < 26.5; y += 1.53) slab(b, f, c, y, len - 0.2, 0.12, 0.16, 'red');
    for (let t = 0.15; t < len; t += 1.08) slab(b, f, Math.min(t, len - 0.15), 8.5, 0.08, 17.9, 0.2, 'red');
    slab(b, f, c, 26.45, len - 0.2, 0.7, 0.06, 'concrete');
  }
  // blade (3DBAG 32.4 m part, r 160.2-162.2) and the lift box (3DBAG 30.1 m)
  block(b, sector(160.2, 162.2, [-25.5, -26.4]).map(p => p), 27.0, 32.4, 'concrete', 'concrete');
  block(b, sector(158.1, 161.8, thetas(-25.3, -27.1, 0.6)), Y_TOP, 30.1, 'concrete', 'slate');
}

/** Roof: set-back top storey (south-west), white box and machine room (north-east), south-west penthouse and lift tower. */
function roofTop(b: BuildingTools) {
  const sb = thetas(-37.6, TH_SW + 0.05, D_TH * 2);
  block(b, sector(R_B, 163.0, sb), Y_TOP, 26.7, 'concrete', 'slate');
  for (let k = 0; k + 1 < sb.length; k++) {
    const {f, len} = chord(163.0, sb[k], sb[k + 1]), c = len / 2;
    pane(b, f, c, 24.4, len - 0.5, 1.5, 'glass', 0);
    slab(b, f, c, 26.0, len, 0.12, 0.7, 'white');
  }
  // brick chimney pots on the set-back roof (Autopon.jpg)
  for (const th of [-49.0, -46.0, -43.0, -40.5, -38.5]) block(b, sector(156.5, 157.1, [th, th - 0.22]), 26.7, 27.6, 'brick', 'dark');
  // white box (3DBAG 30.3 m part, bearing -35.2..-31.7) and the machine room (26.4 m, -31.2..-26.1)
  block(b, sector(153.0, R_W - 0.2, thetas(-31.7, -35.2, 0.6)), Y_TOP, 30.3, 'white', 'slate');
  block(b, sector(157.0, 163.0, thetas(-26.2, -31.2, 0.8)), Y_TOP, 26.4, 'concrete', 'slate');
  // south-west penthouse on the set-back storey, its cantilevered balcony with rail, and the overhanging roof slab
  const ph = thetas(-47.6, -49.8, 0.55);
  block(b, sector(154.0, 161.5, ph), 26.7, 29.85, 'white', 'white');
  block(b, sector(153.6, 163.6, ph.map(t => t)), 29.9, 30.3, 'concrete', 'slate', 'concrete');
  block(b, sector(161.4, 164.3, ph), 26.75, 27.0, 'concrete', 'concrete', 'concrete');
  for (let k = 0; k + 1 < ph.length; k++) {
    const {f, len} = chord(164.3, ph[k], ph[k + 1]);
    slab(b, f, len / 2, 27.9, len, 0.06, 0.06, 'dark', -0.08);
    for (const t of [0.05, len / 2]) slab(b, f, t + 0.03, 27.0, 0.05, 0.92, 0.05, 'dark', -0.08);
    const g = chord(161.5, ph[k], ph[k + 1]);
    pane(b, g.f, g.len / 2, 27.1, g.len - 0.3, 2.3, 'glass', 0);
  }
  // white lift tower at the south-west end (3DBAG 30.8 m)
  block(b, sector(155.0, 158.5, [-50.1, -50.9]), 26.7, 30.8, 'white', 'slate');
  // light rooftop rail along the slab front (w03-321 aimed view, Autopon.jpg)
  for (let k = 0; k < N_SUB; k += 2) {
    const {f, len} = chord(R_F - 0.3, SUB[k], SUB[k + 2]);
    slab(b, f, len / 2, Y_TOP + 1.0, len, 0.08, 0.08, 'concrete', -0.15);
    slab(b, f, 0.06, Y_TOP + 0.1, 0.08, 0.9, 0.08, 'concrete', -0.15);
  }
}

/** South-west end wall (radial, bearing 219): ribbon windows on each storey near the front (Autopon.jpg, w05-311). */
function swEnd(b: BuildingTools) {
  const {f} = lineFrame(P(R_F - 0.05, TH_SW), P(R_B, TH_SW)); // n points south-west, t from the front
  setSink(0.05);
  for (const y of FLOORS) {
    slab(b, f, 5.0, y + 0.9, 5.0, 1.5, 0.045, 'dark');
    pane(b, f, 5.0, y + 0.97, 4.86, 1.36, 'glass', 0.045);
  }
  setSink(0.12, true);
}

/** Back (south-east) face of the slab over the hall roof: access galleries (orthophoto: white frames along the back edge). */
function slabBack(b: BuildingTools) {
  for (let k = 0; k + 2 <= N_SUB; k += 2) {
    const {f, len} = lineFrame(P(R_B, SUB[k + 2]), P(R_B, SUB[k])); // viewer on the hall side
    for (const y of [11.66, 14.72, 17.78, 20.84]) {
      slab(b, f, len / 2, y - 0.25, len + 0.02, 0.25, 1.4, 'concrete');
      slab(b, f, len / 2, y, len + 0.02, 0.95, 0.12, 'concrete', 1.28);
      pane(b, f, len / 2, y + 0.2, len - 1.0, 2.2, 'glass', 0);
    }
  }
}

// ---- annex pavilion -------------------------------------------------------------------------------------------------
function annexBearings(): [number, number] {
  const r = src.facadeRing;
  return [polar(r[3])[1], polar(r[6])[1]]; // high (north-east) and low bearing where the annex meets the arc
}
function annex(b: BuildingTools) {
  const r = src.facadeRing;
  const v3 = r[3] as P2, v4 = r[4] as P2, v5 = r[5] as P2, v6 = r[6] as P2;
  const [th3, th6] = annexBearings();
  // runs back under the soffit into the showroom volume (its back face is hidden inside it)
  const back = thetas(th6, th3, 0.5).map(t => P(R_G - 0.3, t));
  const outline: P2[] = [v3, v4, v5, v6, ...back];
  block(b, outline, 0, 4.6, 'dark', 'slate');
  // glazed upper box, its street edges 0.25 m inside the base
  const cen = outline.reduce((a, p) => [a[0] + p[0] / outline.length, a[1] + p[1] / outline.length], [0, 0]);
  const pull = (p: P2): P2 => { const dx = cen[0] - p[0], dz = cen[1] - p[1], k = 0.25 / Math.hypot(dx, dz); return [p[0] + dx * k, p[1] + dz * k]; };
  const up: P2[] = [pull(v3), pull(v4), pull(v5), pull(v6), ...back];
  block(b, up, 4.6, 6.5, 'glass', 'slate');
  // yellow posts and top rail along the street edges, dark fascia (w04-337, w12-215)
  for (const [a, c] of [[v3, v4], [v4, v5], [v5, v6]] as [P2, P2][]) {
    const {f, len} = lineFrame(a, c);
    const n = Math.max(1, Math.round(len / 2.0));
    for (let k = 0; k <= n; k++) slab(b, f, Math.min(Math.max(k * len / n, 0.06), len - 0.06), 4.6, 0.1, 2.1, 0.1, 'gold', 0.02);
    slab(b, f, len / 2, 6.62, len, 0.1, 0.1, 'gold', 0.02);
    slab(b, f, len / 2, 3.7, len - 0.2, 0.85, 0.06, 'dark', 0);
  }
}

// ---- Zocherstraat block, hall ---------------------------------------------------------------------------------------
// local (u along Zocherstraat, bearing 68; v toward the Overtoom, bearing 338) to native
const U: P2 = [Math.sin(68 * D2R), -Math.cos(68 * D2R)], V: P2 = [Math.sin(338 * D2R), -Math.cos(338 * D2R)];
const L = (u: number, v: number): P2 => [u * U[0] + v * V[0], u * U[1] + v * V[1]];
const toL = (p: number[]): P2 => [p[0] * U[0] + p[1] * U[1], p[0] * V[0] + p[1] * V[1]];
const S_BACK = -14.9, Y_S = {panels: 4.1, band: 4.5, sill: 5.4, head: 8.3, top: 8.7, upper: 9.6, roof: 18.5};
const S_FLOORS = [9.6, 12.6, 15.6];
const RECESS = 1.6;

/** South block outline from the facade line `fl` (local, west -> east; ring vertices 15-26), its west end cut back for the
 * stair tower (overlapping it by 0.2 m so no faces coincide). `ground` recesses the west segment for the external stair. */
function southOutline(fl: P2[], dv: number, ground: boolean): P2[] {
  const f = fl.map(([u, v]) => [u, v + dv] as P2);
  const vAt = (u: number) => f[0][1] + (f[1][1] - f[0][1]) * (u - f[0][0]) / (f[1][0] - f[0][0]);
  const head: P2[] = ground ? [[-20.3, vAt(-20.3)], [-19.9, vAt(-19.9)], [-19.9, -27.4]] : [[-20.3, vAt(-20.3)]];
  const rest = ground ? f.slice(2) : f.slice(1);
  return [...head, ...rest, [20.9, S_BACK], [-23.8, S_BACK], [-23.8, -24.2], [-20.3, -24.2]].map(([u, v]) => L(u, v));
}

function southBlock(b: BuildingTools) {
  const fl = src.facadeRing.slice(15, 27).map(toL);
  block(b, southOutline(fl, 0, true), 0, Y_S.panels - 0.05, 'white', 'white');
  const mid = southOutline(fl, 0, false);
  block(b, mid, Y_S.panels, Y_S.top, 'white', 'concrete', 'white');
  // balcony storeys recessed 1.6 m from the vitrine line; the shadow gap over the vitrine head (8.7-9.35) is this recess
  block(b, southOutline(fl, RECESS, false), Y_S.top, Y_S.roof, 'concrete', 'slate');
  // penthouse on the south block (3DBAG 21.3 m part)
  block(b, [L(-16.3, -22.9), L(2.1, -22.9), L(2.1, -17.1), L(-16.3, -17.1)], Y_S.roof, 21.3, 'concrete', 'slate');
  // facade segments (the long runs facing Zocherstraat)
  for (let i = 0; i + 1 < fl.length; i++) {
    const [ua, va] = fl[i], [ub, vb] = fl[i + 1];
    if (Math.abs(vb - va) > 0.3 || ub - ua < 3) continue;
    const {f, len} = lineFrame(L(ua, va), L(ub, vb));
    southFacade(b, f, len, ua < -23, ua > 10.5, Math.abs(ua + 14.0) < 0.3);
  }
}

function southFacade(b: BuildingTools, f: Frame, len: number, westEnd: boolean, dark: boolean, entrance: boolean) {
  const t0 = westEnd ? 3.6 : 0; // the stair tower owns the first 3.6 m of the west segment
  const c = (t0 + len) / 2, w = len - t0;
  // ground floor: white panels with joints (dark panels, a garage door and a door at the east end, w10-158)
  if (dark) {
    pane(b, f, c, 0, w - 0.3, Y_S.panels, 'dark', 0);
    slab(b, f, len - 3.2, 0, 3.6, 3.4, 0.06, 'dark', 0.14);
    slab(b, f, len - 6.3, 0, 1.0, 2.3, 0.06, 'dark', 0.14);
  } else if (!westEnd) for (let t = t0 + (entrance ? 2.5 : 0.9); t < len - 0.2; t += 0.9) pane(b, f, t, 0.1, 0.03, Y_S.panels - 0.2, 'frame', 0);
  // glazed entrance at the west end of the w02-158 run (door, side lights, transom)
  if (entrance) {
    pane(b, f, 1.35, 0.1, 1.9, 3.7, 'frame', 0);
    pane(b, f, 1.35, 0.15, 1.8, 3.6, 'glass', 0.05);
    for (const [t, y, w, h] of [[1.1, 0.15, 0.06, 3.6], [1.35, 2.4, 1.8, 0.06]]) slab(b, f, t, y, w, h, 0.05, 'frame', 0.1);
  }
  const wi = w - 0.2;
  slab(b, f, c, Y_S.panels, wi, Y_S.band - Y_S.panels, 0.3, 'concrete');
  // floating vitrine: sill band, glass, mullion fins about every 0.87 m, head band; dark shadow gap above
  slab(b, f, c, Y_S.band, wi, Y_S.sill - Y_S.band, 0.18, 'concrete');
  const n = Math.round(w / 0.87);
  for (let k = 0; k < n; k++) { const a = Math.max(t0 + k * w / n, t0 + 0.2), e = Math.min(t0 + (k + 1) * w / n, len - 0.2); pane(b, f, (a + e) / 2, Y_S.sill, e - a - 0.1, Y_S.head - Y_S.sill, 'glass', 0); }
  for (let k = 0; k <= n; k++) slab(b, f, Math.min(Math.max(t0 + k * w / n, t0 + 0.2), len - 0.2), Y_S.sill, 0.13, Y_S.head - Y_S.sill, 0.22, 'concrete');
  slab(b, f, c, Y_S.head, wi, Y_S.top - Y_S.head, 0.18, 'concrete');
  // balcony storeys: fins every ~1.76 m from the facade line back to the recessed wall, slab edges, slatted balustrades
  const nb = Math.max(1, Math.round(w / 1.76)), bw = w / nb;
  for (let k = 0; k <= nb; k++) slab(b, f, Math.min(Math.max(t0 + k * bw, t0 + 0.2), len - 0.2), Y_S.upper - 0.27, 0.18, Y_S.roof - Y_S.upper + 0.45, RECESS + 0.3, 'concrete', -RECESS - 0.3);
  S_FLOORS.forEach((y, fi) => { for (let k = 0; k < nb; k++) {
    const tc = t0 + (k + 0.5) * bw, ww = Math.min(bw - 0.18 + 0.04, 2 * Math.min(tc - t0 - 0.11, len - 0.11 - tc));
    slab(b, f, tc, y - 0.25, ww, 0.25, RECESS - 0.05, 'concrete', -RECESS);
    slab(b, f, tc, y - 0.02, ww, 0.95, 0.12, 'concrete', -0.2);
    for (let s = 0; s < 4; s++) pane(b, f, tc - ww / 2 + ww * (s + 0.5) / 4, y + 0.12, 0.07, 0.72, 'bronze', -0.08);
    pane(b, f, tc, y + 1.0, ww - 0.5, 1.45, 'glass', -RECESS + 0.05);
  } });
  slab(b, f, c, Y_S.roof - 0.3, wi, 0.42, RECESS + 0.3, 'concrete', -RECESS - 0.35);
}

/** West end of Zocherstraat (w08-158): red-framed glazed stair tower, the white external stair, the dark mesh ground floor. */
function westEnd(b: BuildingTools) {
  const tw = [L(-23.7, -28.95), L(-20.1, -28.95), L(-20.1, -24.0), L(-23.7, -24.0)];
  block(b, tw, 0, 20.8, 'glass', 'slate');
  const {f, len} = lineFrame(tw[0], tw[1]);
  for (let y = 5.4; y < 20.4; y += 1.5) slab(b, f, len / 2, y, len - 0.2, 0.1, 0.12, 'red');
  for (const t of [0.15, 1.2, 2.4, len - 0.15]) slab(b, f, t, 5.4, 0.08, 14.95, 0.16, 'red');
  slab(b, f, len / 2, 0, len - 0.2, 5.4, 0.08, 'dark');
  slab(b, f, len / 2, 20.4, len - 0.2, 0.35, 0.2, 'concrete');
  // dark mesh grille on the recessed ground floor behind the stair (v -27.4)
  const g = lineFrame(L(-20.1, -27.4), L(-14.0, -27.4));
  pane(b, g.f, g.len / 2, 0.05, g.len - 0.3, 3.95, 'dark', 0);
  for (let t = 0.6; t < g.len; t += 1.2) pane(b, g.f, t, 0.05, 0.05, 3.95, 'frame', 0.05);
  // stair (w08-158, Commons Zocherstraat 42 (5).jpg): landing at the vitrine (5.2 m) beside the tower, one flight falling
  // east to the pavement about 10 m on; 1.3 m wide, v -28.75..-27.45 (its inner face 5 cm off the walls behind it)
  const s = lineFrame(L(-23.7, -27.45), L(-8.0, -27.45)).f;
  const rise = 4.0, x0 = 3.6, land = 1.8, run = 7.0, steps = 14;
  slab(b, s, x0 + land / 2, rise - 0.35, land, 0.35, 1.3, 'pink', 0.05);
  for (let k = 0; k < steps; k++) {
    const t = x0 + land + (k + 0.5) * run / steps, y = rise - (k + 1) * rise / steps;
    slab(b, s, t, Math.max(0, y - 0.3), run / steps + 0.02, Math.min(y, 0.3) + rise / steps, 1.3, 'pink', 0.05);
  }
  // solid sloped balustrade on the street side, 1.0 m over the treads
  const o = 1.33, ta = x0, te = x0 + land + run;
  const at = (t: number, y: number) => { const p = s.origin, q: P2 = [p[0] + s.tangent[0] * t + s.n[0] * o, p[1] + s.tangent[1] * t + s.n[1] * o]; return [q[0], y, q[1]]; };
  const yAt = (t: number) => t <= x0 + land ? rise : rise * (1 - (t - x0 - land) / run);
  const pts = [at(ta, rise - 0.35), at(x0 + land, rise - 0.35), at(te, 0), at(te, 1.0), at(x0 + land, rise + 1.0), at(ta, rise + 1.0)];
  const pos: number[] = [];
  for (const tri of [[0, 1, 4], [0, 4, 5], [1, 2, 3], [1, 3, 4]]) { for (const i of tri) pos.push(...pts[i]); for (const i of [tri[0], tri[2], tri[1]]) pos.push(...pts[i]); }
  void yAt;
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.computeVertexNormals();
  b.add(bg, 'pink');
}

/** The 24.2 m back of the slab's south-west end along the party wall (3DBAG roof part, local outline), on the hall roof. */
function swBackCore(b: BuildingTools) {
  const loc: P2[] = [[-24.3, -4.2], [-23.9, -0.5], [-23.6, 2.5], [-23.2, 3.2], [-25.6, 2.5], [-30.2, -0.3], [-32.3, -1.5], [-30.7, -4.4]];
  block(b, loc.map(([u, v]) => L(u, v)), 9.4, 24.2, 'concrete', 'slate');
}

/** Sutherland-Hodgman clip of a polygon to the half plane keep(p) >= 0 (linear). */
function clipHalf(poly: P2[], keep: (p: P2) => number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], ka = keep(a), kc = keep(c);
    if (ka >= 0) out.push(a);
    if ((ka >= 0) !== (kc >= 0)) { const t = ka / (ka - kc); out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
  }
  return out;
}

function hall(b: BuildingTools) {
  let poly: P2[] = src.nativeRing.map(p => [p[0], p[1]] as P2);
  poly = clipHalf(poly, p => toL(p)[1] - (S_BACK - 0.3));
  // inside the circle r <= R_B + 0.3: clip by the tangent half planes every 2 deg over the slab's bearings
  for (let th = -60; th <= -14; th += 2) { const s = Math.sin(th * D2R), c = -Math.cos(th * D2R); poly = clipHalf(poly, p => (R_B + 0.3) - ((p[0] - CX) * s + (p[1] - CZ) * c)); }
  const high = clipHalf(poly, p => 20.0 - toL(p)[0]), low = clipHalf(poly, p => toL(p)[0] - 19.7);
  block(b, high, 0, 9.4, 'concrete', 'slate');
  if (low.length > 2) block(b, low, 0, 6.0, 'concrete', 'slate');
  // sawtooth: ridges along v every 3.4 m in u, rising 2 m; glazed vertical face toward +u
  const hl = high.map(toL);
  for (let u0 = -22.6; u0 + 3.0 < 20.0; u0 += 3.4) {
    const u1 = u0 + 2.9, vs: number[] = [];
    for (const uu of [u0 + 0.05, u1 - 0.05]) for (let i = 0; i < hl.length; i++) {
      const a = hl[i], c = hl[(i + 1) % hl.length];
      if ((a[0] - uu) * (c[0] - uu) < 0) vs.push(a[1] + (c[1] - a[1]) * (uu - a[0]) / (c[0] - a[0]));
    }
    if (vs.length < 4) continue;
    vs.sort((p, q) => p - q);
    const v0 = Math.max(vs[0], vs[1]) + 0.3, v1 = Math.min(vs[vs.length - 1], vs[vs.length - 2]) - 0.3;
    if (v1 - v0 < 2) continue;
    const q = (u: number, v: number, y: number) => { const p = L(u, v); return [p[0], y, p[1]]; };
    const A = q(u0, v0, 9.4), B = q(u1, v0, 9.4), C = q(u1, v0, 11.4), A2 = q(u0, v1, 9.4), B2 = q(u1, v1, 9.4), C2 = q(u1, v1, 11.4);
    const tri = (pts: number[][], c: Col) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); b.add(g, c); };
    // winding: outward normals (checked by audit:glb)
    tri([A, C, C2, A, C2, A2], 'slate');
    tri([B, B2, C2, B, C2, C], 'glass');
    tri([A, B, C], 'concrete');
    tri([A2, C2, B2], 'concrete');
  }
}

export function buildAutopon(_w: number, _d: number, b: BuildingTools) {
  setSink(0.12, true);
  slabBody(b);
  loggiaGrid(b);
  showroom(b);
  headBlock(b);
  roofTop(b);
  swEnd(b);
  slabBack(b);
  annex(b);
  southBlock(b);
  westEnd(b);
  swBackCore(b);
  hall(b);
}
