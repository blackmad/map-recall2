/**
 * Academie van Bouwkunst, Waterlooplein 211-213 (BAG 0363100012171994): the Oudezijds Huiszittenhuis and the
 * Stadsturfpakhuizen of 1610 (Rijksmonument 268: "een dubbel pakhuis geflankeerd door twee enkele, ... met trapezium-
 * en puntgevels aan voor- en achterzijde, versierd met grote boog- en strekblokken") around one courtyard. Every part
 * below comes from the register text quoted in scripts/landmarks/academie-van-bouwkunst-brief.md or from the rectified
 * Gemeente Amsterdam panoramas (CC BY 4.0) listed in scripts/landmarks/academie-van-bouwkunst-inventory.json; nothing
 * is described from memory.
 *
 *  - Turfpakhuizen front (w02-308, 50 px/m): three point gables 6.6 / 12.4 / 6.7 m wide, the double one in the middle
 *    truncated under a small balustrade (3DBAG flat 15.3 m), white stone bands at 4.2 / 6.8 / 9.15 m, four basket
 *    arches with white block rings and an oval medallion over each, small round-headed windows between, then
 *    storeys of narrow and wide windows under white block heads, the wide ones with red shutters, brick roundels and
 *    stone finials in the gables. The gable roofs run back to the skewed rear line (3DBAG ridges 14.4 / 15.3 / 14.3 m).
 *  - Huiszittenhuis front (w06-307, w07-307): three bays of three axes, the middle one a 0.25 m risalit (BAG facets)
 *    under a pediment with an oculus; souterrain, bel-etage with corniced windows, upper storey, white cornice at
 *    10 m, ACADEMIE VAN BOUWKUNST in gilt letters over the risalit, the double perron with iron railings, dormers.
 *  - Huiszittenhuis NE end (w01-44): two axes, a gable stone, a small arched window, a low glazed strip.
 *  - Everything else (the hipped roofs, the courtyard ranges, the walled courtyard gallery, the SE annex) is the
 *    3DBAG LoD2.2 shell (CC BY 4.0), with simplified windows where the panoramas show them.
 *
 * Frame: x east, z south, y up from the 3DBAG ground (0.46 m NAP), origin = vertex average of the BAG outer ring (RD)
 * (scripts/landmarks/academie-van-bouwkunst-prepare.ts writes academie-van-bouwkunst-footprints.json).
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {planarPolygon} from './worship-shell';
import {setSink, slab, ledgeStrip, archSlab, archBand, put, poly, ringSlab, roofHeightAt, type Frame} from './nearbar-kit';
import plan from './academie-van-bouwkunst-footprints.json';

type V = [number, number];
let b: BuildingTools;

const add = (p: V, d: V, s: number): V => [p[0] + d[0] * s, p[1] + d[1] * s];
const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]];
const dot = (p: V, q: V) => p[0] * q[0] + p[1] * q[1];
const unit = (p: V): V => { const l = Math.hypot(p[0], p[1]); return [p[0] / l, p[1] / l]; };
/** Frame on a facade line: origin at the viewer's left end, n outward; the tangent is derived from n as nearbar-kit expects. */
const frame = (origin: V, n: V): Frame => ({origin, n, tangent: [n[1], -n[0]]});
const ring = plan.ring as V[];

/** A flat wall piece in a frame: polygon (t, y) on the frame plane (out = 0), facing outward. */
function wall(fr: Frame, pts: V[], colour = 'brick', out = 0) {
  const g = new T.ShapeGeometry(new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y))));
  put(b, fr, g, 0, 0, out, colour);
}
/** Strip of constant thickness `th` along a sloped line (t0,y0)-(t1,y1), e.g. a gable coping. */
function rake(fr: Frame, t0: number, y0: number, t1: number, y1: number, th: number, d: number, colour: string, out = 0) {
  poly(b, fr, 0, 0, [[t0, y0], [t1, y1], [t1, y1 + th], [t0, y0 + th]], d, colour, out);
}

// ---------------------------------------------------------------------------------------------------- windows
type Win = {t: number; y: number; w: number; h: number; cols?: number; rows?: number; arch?: boolean};
/** White-framed small-paned window: frame 8 cm, glass 13 cm, bars 18 cm proud (sunk backs), stone sill 20 cm. */
function sash(fr: Frame, o: Win, sill = true, out = 0) {
  const {t, y, w, h} = o, cols = o.cols ?? 2, rows = o.rows ?? 3;
  if (o.arch) {
    archSlab(b, fr, t, y - 0.06, w + 0.14, h + 0.1, 0.08, 'white', out, 6);
    archSlab(b, fr, t, y, w - 0.06, h - 0.04, 0.13, 'glass', out, 6);
  } else {
    slab(b, fr, t, y - 0.06, w + 0.14, h + 0.12, 0.08, 'white', out);
    slab(b, fr, t, y, w - 0.06, h, 0.13, 'glass', out);
  }
  const top = o.arch ? h - w / 2 : h;
  for (let c = 1; c < cols; c++) ledgeStrip(b, fr, t - w / 2 + w * c / cols, y, 0.05, top, 0.18, 'white', out);
  for (let r = 1; r < rows; r++) ledgeStrip(b, fr, t, y + top * r / rows, w - 0.06, 0.05, 0.18, 'white', out);
  if (sill) slab(b, fr, t, y - 0.16, w + 0.3, 0.1, 0.2, 'stone', out);
}
/** "Strekblokken": the flat head over a warehouse window, white stone blocks alternating with brick, and the white
 * block at mid-height of each jamb (w02-308). */
function strek(fr: Frame, t: number, y: number, w: number, h: number) {
  const n = w > 1 ? 5 : 3, bw = (w + 0.5) / (2 * n - 1);
  for (let i = 0; i < n; i++) slab(b, fr, t - (w + 0.5) / 2 + bw * (2 * i + 0.5), y + h + 0.07, bw, i % 2 ? 0.3 : 0.4, 0.15, 'stone');
  for (const s of [-1, 1]) slab(b, fr, t + s * (w / 2 + 0.21), y + h * 0.45, 0.24, 0.26, 0.15, 'stone');
}
/** Round head of white blocks over an arched warehouse window (boogblokken), keystone and springers. */
function boog(fr: Frame, t: number, y: number, w: number, h: number) {
  archBand(b, fr, t, y, w + 0.6, h + 0.3, 0.22, 0.15, 'stone', 0, 6);
  slab(b, fr, t, y + h + 0.02, 0.26, 0.3, 0.21, 'stone');
  for (const s of [-1, 1]) slab(b, fr, t + s * (w / 2 + 0.08), y + h - w / 2 - 0.12, 0.26, 0.22, 0.21, 'stone');
}
function shutters(fr: Frame, t: number, y: number, w: number, h: number) {
  for (const s of [-1, 1]) slab(b, fr, t + s * (w / 2 + 0.3), y, 0.36, h - 0.1, 0.1, 'red');
}

// ---------------------------------------------------------------------------------------------------- Turfpakhuizen
const A = ring[6], B = ring[7], C = ring[8];          // front NE end, front SW end, rear SW end
const TU = unit(sub(B, A));                           // along the front, viewer's left to right
const TV: V = [-TU[1], TU[0]].map(v => -v) as V;      // into the block (towards the rear)
const FW = Math.hypot(...sub(B, A));                  // 25.72 m
/** Section of the three gable roofs (u from the NE end, height): w02-308 + 3DBAG ridges, eaves 9.2 m. */
const EAVE = 9.2;
const PROFILE: V[] = [[0, EAVE], [3.3, 14.4], [6.6, EAVE], [10.5, 15.3], [15.15, 15.3], [19.05, EAVE], [22.38, 14.4], [FW, EAVE]];
const profileAt = (u: number) => { for (let i = 0; i + 1 < PROFILE.length; i++) { const [u0, h0] = PROFILE[i], [u1, h1] = PROFILE[i + 1]; if (u <= u1 + 1e-9) return h0 + (h1 - h0) * (u - u0) / (u1 - u0); } return EAVE; };
const uv = (p: V): V => [dot(sub(p, A), TU), dot(sub(p, A), TV)];
const P = (u: number, v: number): V => add(add(A, TU, u), TV, v);
/** Rear line C-D (ring vertices 8, 9). The long sides A-D and B-C both run 3 deg off the front normal (3DBAG wall
 * 166 follows A-D), so the rear gables are the front profile spread proportionally along D-C. */
const D = ring[9] as V;                               // rear NE end: the block is A-B-C-D, both long sides splay 3 deg
const rearAt = (u: number): V => add(D, sub(C, D), u / FW);
const BLOCK: V[] = [A, B, C, D];
/** The NE long side as 3DBAG draws it against the courtyard (wall surfaces 160, 156, 155, 166), A to D. */
const NE_LINE: V[] = [A, [-13.35, -0.24], [-12.1, 0.53], [-10.98, 1.25], [-10.59, 1.85], [6.8, 17.23], D];
/** Height of the NE slope over a plan point: eaves 9.2 m on the line A-D, rising at the gable pitch towards the ridge. */
function eaveH(q: V) {
  const AD = unit(sub(D, A)), inward: V = dot([AD[1], -AD[0]], TU) > 0 ? [AD[1], -AD[0]] : [-AD[1], AD[0]];
  return EAVE + dot(sub(q, A), inward) * (14.4 - EAVE) / 3.3;
}
function inBlock(p: V, margin: number) {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const a = BLOCK[i], c = BLOCK[j];
    if ((a[1] > p[1]) !== (c[1] > p[1]) && p[0] < (c[0] - a[0]) * (p[1] - a[1]) / (c[1] - a[1]) + a[0]) inside = !inside;
  }
  if (inside) return true;
  for (let i = 0; i < 4; i++) {
    const a = BLOCK[i], c = BLOCK[(i + 1) % 4], d = sub(c, a), l = Math.hypot(...d), t = Math.max(0, Math.min(l, dot(sub(p, a), d) / l));
    if (Math.hypot(...sub(p, add(a, d, t / l))) < margin) return true;
  }
  return false;
}

function warehouseFront(fr: Frame) {
  // wall up to the three gable outlines
  wall(fr, [[0, 0], [FW, 0], ...[...PROFILE].reverse()]);
  // white bands across the full front, then the short gable band at 11.6 m in each gable
  for (const y of [4.2, 6.8, 9.15]) slab(b, fr, FW / 2, y - 0.09, FW + 0.06, 0.18, 0.08, 'stone');
  for (const [u0, u1] of [[0, 6.6], [6.6, 19.05], [19.05, FW]]) {
    const inset = (11.6 - EAVE) / ((profileAt(u0 + 1) - EAVE) / 1) + 0.15;
    ledgeStrip(b, fr, (u0 + u1) / 2, 11.51, u1 - u0 - 2 * inset, 0.18, 0.08, 'stone');
  }
  // gable copings, kneelers and finials
  for (let i = 0; i + 1 < PROFILE.length; i++) {
    const [u0, h0] = PROFILE[i], [u1, h1] = PROFILE[i + 1];
    if (h0 === h1) continue;
    rake(fr, u0, h0, u1, h1, 0.28, 0.12, 'stone');
  }
  for (const u of [0.35, 6.6, 19.05, FW - 0.35]) slab(b, fr, u, EAVE - 0.35, 0.7, 0.45, 0.2, 'stone');
  for (const u of [3.3, 22.38]) {
    slab(b, fr, u, 14.2, 0.7, 0.9, 0.35, 'stone', -0.35);
    slab(b, fr, u, 15.1, 0.95, 0.16, 0.5, 'stone', -0.47);
    slab(b, fr, u, 15.26, 0.4, 0.5, 0.2, 'stone', -0.2);
  }
  // middle gable: truncated top under a stone balustrade (contact sheet w02-308)
  {
    const t0 = 10.5, t1 = 15.15, w = t1 - t0, tc = (t0 + t1) / 2;
    slab(b, fr, tc, 15.3, w + 0.3, 0.18, 0.5, 'stone', -0.25);
    for (let k = 0; k <= 8; k++) slab(b, fr, t0 + w * k / 8, 15.48, 0.1, 0.55, 0.1, 'stone', -0.05);
    slab(b, fr, tc, 16.03, w + 0.2, 0.12, 0.25, 'stone', -0.1);
  }
  // ground storey: four basket arches with white block rings and an oval medallion over each, small arched windows
  for (const u of [3.4, 10.25, 15.0, 21.9]) {
    archSlab(b, fr, u, 0, 2.0, 2.95, 0.13, 'glass', 0, 8);
    slab(b, fr, u, 0, 1.8, 2.0, 0.22, 'dark');
    slab(b, fr, u, 2.0, 1.94, 0.08, 0.28, 'white');
    archBand(b, fr, u, 0, 2.8, 3.35, 0.4, 0.07, 'stone', 0, 8);
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (k + 0.5) / 7, r = 1.2;
      const g = new T.BoxGeometry(0.34, 0.62, 0.11).translate(0, 0, 0.055).rotateZ(a - Math.PI / 2);
      put(b, fr, g, u + r * Math.cos(a), 1.95 + r * Math.sin(a), 0, 'stone');
    }
    for (const s of [-1, 1]) slab(b, fr, u + s * 1.25, 0, 0.42, 1.95, 0.11, 'stone');
    const ov = new T.CylinderGeometry(1, 1, 0.1, 18).rotateX(Math.PI / 2).translate(0, 0, 0.05).scale(0.55, 0.32, 1);
    put(b, fr, ov, u, 3.68, 0, 'stone');
    const ov2 = new T.CylinderGeometry(1, 1, 0.1, 18).rotateX(Math.PI / 2).translate(0, 0, 0.05).scale(0.4, 0.2, 1);
    put(b, fr, ov2, u, 3.68, 0.07, 'slate'); // carved, shadowed centre: relief, not an opening
  }
  for (const u of [1.4, 5.45, 7.65, 17.85, 20.05, 24.15]) { sash(fr, {t: u, y: 2.15, w: 0.75, h: 1.45, arch: true, cols: 2, rows: 3}); boog(fr, u, 2.15, 0.75, 1.45); }
  // storeys 1 and 2: narrow (n) and wide (W, arched, with shutters) windows; side gables n W n, middle n n W n n W n n
  const axes: [number, 'a' | 'n' | 'W'][] = [[1.35, 'a'], [3.3, 'W'], [5.25, 'a'], [7.65, 'a'], [9.05, 'n'], [10.45, 'W'], [12.05, 'n'],
    [13.6, 'n'], [15.2, 'W'], [16.75, 'n'], [18.15, 'a'], [20.4, 'a'], [22.38, 'W'], [24.35, 'a']];
  for (const [y, h] of [[4.45, 1.85], [7.0, 1.75]] as V[]) for (const [u, k] of axes) win(fr, u, y, h, k);
  // storey 3 (in the gables): side gables one wide window between brick roundels; middle six windows
  for (const [u, k] of [[3.3, 'W'], [22.38, 'W'], [9.05, 'n'], [10.45, 'W'], [12.05, 'n'], [13.6, 'n'], [15.2, 'W'], [16.75, 'n']] as [number, 'n' | 'W'][]) win(fr, u, 9.4, 1.75, k);
  // storey 4: middle gable two wide windows; side gables one small arched light
  for (const u of [10.45, 15.2]) win(fr, u, 11.85, 1.5, 'W');
  for (const u of [3.3, 22.38]) { sash(fr, {t: u, y: 11.95, w: 0.7, h: 0.9, arch: true, cols: 1, rows: 1}, false); boog(fr, u, 11.95, 0.7, 0.9); }
  // brick roundels (relief discs) in the gables
  for (const [u, y] of [[1.35, 10.25], [5.25, 10.25], [20.4, 10.25], [24.35, 10.25], [8.6, 12.5], [12.82, 12.5], [17.05, 12.5]] as V[]) {
    ringSlab(b, fr, u, y, 0.32, 0.46, 0.1, 'brick', 0, 14);
    put(b, fr, new T.CylinderGeometry(0.3, 0.3, 0.06, 14).rotateX(Math.PI / 2).translate(0, 0, 0.03), u, y, 0, 'brick');
  }
}
function win(fr: Frame, u: number, y: number, h: number, k: 'a' | 'n' | 'W') {
  // w02-308: the shuttered picture windows are ~1.0 m of glass, the narrow arched ones ~0.65-0.7 m (95 px vs 62 px in the zoom); 0.72 so the 0.1 m audit grid reads them alike in both side gables
  if (k === 'W') { sash(fr, {t: u, y, w: 1.0, h, arch: true, cols: 2, rows: 4}); boog(fr, u, y, 1.0, h); shutters(fr, u, y, 1.0, h); }
  else if (k === 'a') { sash(fr, {t: u, y, w: 0.72, h, arch: true, cols: 2, rows: 3}); boog(fr, u, y, 0.72, h); shutters(fr, u, y, 0.72, h); }
  else { sash(fr, {t: u, y, w: 0.7, h, cols: 2, rows: 3}); strek(fr, u, y, 0.7, h); }
}

function turfpakhuizen() {
  const nFront: V = [-TV[0], -TV[1]];
  warehouseFront(frame(A, nFront));
  // rear gables on the skewed rear line (not photographed: the register's "puntgevels aan voor- en achterzijde"),
  // brick with the white bands and a plain window per gable storey.
  {
    const nB = unit([-(D[1] - C[1]), D[0] - C[0]] as V);
    const n: V = dot(nB, TV) > 0 ? nB : [-nB[0], -nB[1]];
    const fr = frame(C as V, n), L = Math.hypot(...sub(D, C as V));
    const tOf = (u: number) => (FW - u) / FW * L;
    wall(fr, [[0, 0], [L, 0], ...PROFILE.map(([u, h]) => [tOf(u), h] as V)]);
    for (const y of [4.2, 6.8, 9.15]) slab(b, fr, L / 2, y - 0.09, L, 0.18, 0.08, 'stone');
    for (let i = 0; i + 1 < PROFILE.length; i++) { const [u0, h0] = PROFILE[i], [u1, h1] = PROFILE[i + 1]; if (h0 !== h1) rake(fr, tOf(u1), h1, tOf(u0), h0, 0.28, 0.12, 'stone'); }
    for (const u of [3.3, 9.05, 12.82, 16.6, 22.38]) for (const y of [4.45, 7.0, 9.4]) if (profileAt(u) > y + 2.3) { sash(fr, {t: tOf(u), y, w: 0.75, h: 1.7}); strek(fr, tOf(u), y, 0.75, 1.7); }
  }
  // SW long side (to the neighbours' yard) and NE long side (courtyard): eaves walls at 9.2 m
  {
    const d = unit(sub(C, B)), n: V = [d[1], -d[0]], fr = frame(B as V, dot(n, TU) > 0 ? n : [-n[0], -n[1]] as V), L = Math.hypot(...sub(C, B));
    wall(fr, [[0, 0], [L, 0], [L, EAVE], [0, EAVE]]);
    for (const y of [4.2, 6.8]) slab(b, fr, L / 2, y - 0.09, L, 0.18, 0.08, 'stone');
    slab(b, fr, L / 2, EAVE - 0.3, L, 0.3, 0.3, 'stone');
  }
  // NE long side on the 3DBAG courtyard wall line (walls 160, 156, 155, 166), rising to the roof slope above it
  for (let i = 0; i + 1 < NE_LINE.length; i++) {
    const p = NE_LINE[i + 1], q = NE_LINE[i], d = unit(sub(q, p)), n0: V = [d[1], -d[0]], n: V = dot(n0, TU) < 0 ? n0 : [-n0[0], -n0[1]];
    const fr = frame(p, n), L = Math.hypot(...sub(q, p)), sg = Math.sign(dot(sub(q, p), fr.tangent as V));
    const h0 = eaveH(p), h1 = eaveH(q);
    wall(fr, sg > 0 ? [[0, 0], [L, 0], [L, h1], [0, h0]] : [[-L, 0], [0, 0], [0, h0], [-L, h1]]);
    if (L > 20) for (let k = 0; 2.5 + k * 3.6 < L - 1; k++) {
      // courtyard side above the gallery roof (w01-44): two storeys of small windows under strekblokken
      const t = sg * (2.5 + k * 3.6);
      for (const y of [5.0, 7.0]) { sash(fr, {t, y, w: 0.7, h: 1.3, cols: 2, rows: 2}); strek(fr, t, y, 0.7, 1.3); }
    }
  }
  // the NE slope: a strip from the courtyard wall line up to the ridge
  {
    const rf = P(3.3, 0), rr = rearAt(3.3), AD = sub(D, A), l2 = dot(AD, AD), pos: number[] = [];
    const ridge = NE_LINE.map(q => add(rf, sub(rr, rf), Math.max(0, Math.min(1, dot(sub(q, A), AD) / l2))));
    for (let i = 0; i + 1 < NE_LINE.length; i++) {
      const q0 = [NE_LINE[i][0], eaveH(NE_LINE[i]), NE_LINE[i][1]], q1 = [NE_LINE[i + 1][0], eaveH(NE_LINE[i + 1]), NE_LINE[i + 1][1]];
      const r0 = [ridge[i][0], 14.4, ridge[i][1]], r1 = [ridge[i + 1][0], 14.4, ridge[i + 1][1]];
      pos.push(...q0, ...q1, ...r1, ...q0, ...r1, ...r0);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const gi = g.toNonIndexed(); gi.setIndex([...Array(pos.length / 3).keys()]); upward(gi); b.add(gi, 'slate' as never);
  }
  // the other gable roof slopes, each a planar quad from the front line to the rear line
  for (let i = 1; i + 1 < PROFILE.length; i++) {
    const [u0, h0] = PROFILE[i], [u1, h1] = PROFILE[i + 1];
    const q = [P(u0, 0), P(u1, 0), rearAt(u1), rearAt(u0)], hs = [h0, h1, h1, h0];
    roof(q.map((p, k) => [p[0], hs[k], p[1]]));
  }
  // arched dormers on the courtyard slope (w01-44)
  for (const v of [15, 23]) {
    const ud = 1.4, y0 = profileAt(ud) + 0.03, p = add(add(A, sub(D, A), v / 40.9), TU, ud), n: V = [-TU[0], -TU[1]], fr = frame(add(p, [n[1], -n[0]], -0.7), n);
    slab(b, fr, 0.7, y0 - 0.4, 1.45, 2.4, 1.4, 'brick', -1.4);
    archSlab(b, fr, 0.7, y0 + 0.2, 1.3, 1.75, 0.06, 'white', 0, 8);
    sash(fr, {t: 0.7, y: y0 + 0.35, w: 0.8, h: 1.25, arch: true, cols: 2, rows: 2}, false, 0.06);
  }
}
function roof(pts: number[][]) {
  const g = planarPolygon([pts]);
  if (!g) return;
  upward(g); b.add(g, 'slate' as never);
}
function upward(g: T.BufferGeometry) {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  if (!idx) return;
  const a = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
  for (let k = 0; k < idx.count; k += 3) {
    a.fromBufferAttribute(pos, idx.getX(k)); c.fromBufferAttribute(pos, idx.getX(k + 1)); d.fromBufferAttribute(pos, idx.getX(k + 2));
    if (c.sub(a).cross(d.sub(a)).y < 0) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
  }
  g.computeVertexNormals();
}

// ---------------------------------------------------------------------------------------------------- Huiszittenhuis
const NC = ring[1] as V;                                  // north corner
const HT = unit(sub(ring[6] as V, NC));                   // along the NW front, NE -> SW
const HN: V = [-HT[1], HT[0]];                            // outward (NW)
const HL = Math.hypot(...sub(ring[6] as V, NC));          // 22.47 m
const R0 = 7.76, R1 = 14.71, ROFF = 0.25;                 // risalit (BAG facets)
const WALL_TOP = 10.45, PED = 12.45;
const surfaces = plan.roofs.map(r => ({type: 'RoofSurface', rings: r.rings}));

/** Top line of a hand wall from t1 back to t0: up to the 3DBAG roof edge just behind it, never below `min(t)`. */
function topLine(fr: Frame, t0: number, t1: number, min: (t: number) => number): V[] {
  const n = Math.max(2, Math.ceil((t1 - t0) / 0.5)), pts: V[] = [];
  for (let i = n; i >= 0; i--) {
    const t = t0 + (t1 - t0) * i / n, p = add(add(fr.origin, fr.tangent, t), fr.n, -0.2);
    pts.push([t, Math.max(min(t), roofHeightAt(surfaces, p[0], p[1]) ?? 0)]);
  }
  return pts;
}
function huisFront() {
  const fr = frame(NC, HN), frR = frame(add(NC, HN, ROFF), HN), flat = () => WALL_TOP;
  const tc = (R0 + R1) / 2, ped = (t: number) => WALL_TOP + (PED - WALL_TOP) * (1 - Math.abs(t - tc) / (tc - R0));
  wall(fr, [[0, 0], [R0, 0], ...topLine(fr, 0, R0, flat)]);
  wall(fr, [[R1, 0], [HL, 0], ...topLine(fr, R1, HL, flat)]);
  wall(frR, [[R0, 0], [R1, 0], ...topLine(frR, R0, R1, ped)]);
  // risalit returns
  for (const [t, s] of [[R0, -1], [R1, 1]] as V[]) {
    const p = add(NC, HT, t), fs = frame(add(p, HT, 0), [HT[0] * s, HT[1] * s] as V);
    wall(fs, s < 0 ? [[0, 0], [ROFF, 0], [ROFF, WALL_TOP], [0, WALL_TOP]] : [[-ROFF, 0], [0, 0], [0, WALL_TOP], [-ROFF, WALL_TOP]]);
  }
  // windows: three axes per bay; risalit narrow - wide - narrow
  const bays: [Frame, number[], number[]][] = [
    [fr, [1.45, 3.88, 6.31], [1.5, 1.5, 1.5]],
    [frR, [8.95, 11.24, 13.52], [0.85, 1.55, 0.85]],
    [fr, [15.92, 18.35, 20.78], [1.5, 1.5, 1.5]],
  ];
  for (const [f, ts, ws] of bays) ts.forEach((t, i) => {
    const w = ws[i], door = f === frR && i === 1;
    if (!door) {
      sash(f, {t, y: 3.3, w, h: 2.55, cols: w > 1 ? 3 : 2, rows: 4});
      slab(b, f, t, 5.95, w + 0.45, 0.18, 0.22, 'white'); slab(b, f, t, 5.9, w + 0.25, 0.08, 0.12, 'white');
    }
    sash(f, {t, y: 7.3, w, h: 1.65, cols: w > 1 ? 3 : 2, rows: 3});
    if (!(f === frR && i === 1)) {
      const arch = f === fr && t === 3.88;
      sash(f, {t, y: 0.6, w: arch ? 1.2 : w, h: 1.2, cols: 2, rows: 2, arch}, false);
    }
  });
  // door, its cornice and the window over it (w07-307)
  {
    const t = 11.24;
    slab(b, frR, t, 2.05, 1.6, 2.2, 0.08, 'white'); slab(b, frR, t, 2.05, 1.25, 2.1, 0.13, 'dark');
    slab(b, frR, t, 4.25, 1.9, 0.2, 0.25, 'white');
    sash(frR, {t, y: 4.6, w: 1.4, h: 1.25, cols: 3, rows: 2}, false);
    slab(b, frR, t, 5.95, 1.9, 0.18, 0.22, 'white');
    slab(b, frR, t, 0, 1.0, 1.8, 0.1, 'dark');            // souterrain door under the landing
    perron(frR, t);
  }
  // white frieze band, main cornice, pediment with oculus
  slab(b, fr, R0 / 2, 9.35, R0, 0.25, 0.08, 'stone'); slab(b, fr, (R1 + HL) / 2, 9.35, HL - R1, 0.25, 0.08, 'stone');
  slab(b, frR, (R0 + R1) / 2, 9.35, R1 - R0 + 0.02, 0.25, 0.08, 'stone');
  cornice(fr, -0.55, R0, 0); cornice(fr, R1, HL, 0); cornice(frR, R0 - 0.02, R1 + 0.02, 0);
  {
    const tc = (R0 + R1) / 2, half = (R1 - R0) / 2 + 0.3;
    rake(frR, tc - half, WALL_TOP + 0.05, tc, PED + 0.1, 0.3, 0.4, 'stone');
    rake(frR, tc, PED + 0.1, tc + half, WALL_TOP + 0.05, 0.3, 0.4, 'stone');
    ringSlab(b, frR, tc, 11.2, 0.36, 0.52, 0.12, 'stone', 0, 18);
    put(b, frR, new T.CylinderGeometry(0.36, 0.36, 0.08, 16).rotateX(Math.PI / 2).translate(0, 0, 0.04), tc, 11.2, 0, 'glass');
    for (const s of [-1, 1]) ledgeStrip(b, frR, tc + s * 0.52, 11.17, 0.06, 0.06, 0.13, 'white');
  }
  // lettering over the risalit, gilt (w06-307, w07-307)
  {
    const L = raisedLettering({text: 'ACADEMIE VAN BOUWKUNST', heightM: 0.26, maxWidthM: 5.4, depthM: 0.04});
    L.geometry.translate(-L.widthM / 2, 0, 0);
    put(b, frR, L.geometry, 11.24, 6.62, 0, 'gold');
  }
  // dormers on the front slope over the side bays (w06-307 / contact w07-307)
  for (const t of [3.88]) dormer(fr, t);
}
/** Main cornice along a run: two projecting steps, white. */
function cornice(fr: Frame, t0: number, t1: number, out: number) {
  const w = t1 - t0, tc = (t0 + t1) / 2;
  slab(b, fr, tc, 9.75, w, 0.3, 0.3, 'stone', out);
  slab(b, fr, tc, 10.05, w + 0.1, 0.42, 0.6, 'stone', out);
}
/** Double perron: landing, two flights along the front, solid cheeks, iron railings (w06-307, w07-307). */
function perron(fr: Frame, t: number) {
  const land = 2.0, dep = 1.5, lw = 2.6;
  slab(b, fr, t, land - 0.25, lw, 0.25, dep, 'stone');
  slab(b, fr, t, land, lw + 0.2, 0.1, dep + 0.1, 'stone');
  for (const s of [-1, 1]) slab(b, fr, t + s * (lw / 2 - 0.2), 0, 0.4, land - 0.25, dep - 0.1, 'stone');
  const steps = 10, run = 0.28, rise = land / steps;
  for (const s of [-1, 1]) {
    for (let k = 0; k < steps; k++) {
      const x0 = t + s * (lw / 2 + k * run + run / 2);
      slab(b, fr, x0, 0, run + 0.01, land - k * rise, 1.25, 'stone');
    }
    // railing: a sloped rail and balusters
    const xa = t + s * lw / 2, xb = t + s * (lw / 2 + steps * run);
    rake(fr, Math.min(xa, xb), s > 0 ? land + 0.9 : 0.9, Math.max(xa, xb), s > 0 ? 0.9 : land + 0.9, 0.05, 0.05, 'bronze', 1.2);
    for (let k = 1; k < steps; k += 2) {
      const x = t + s * (lw / 2 + k * run + run / 2), yb = land - k * rise;
      slab(b, fr, x, yb, 0.04, 0.9, 0.04, 'bronze', 1.2);
    }
  }
  for (let k = 0; k <= 6; k++) slab(b, fr, t - lw / 2 + lw * k / 6, land + 0.1, 0.04, 0.9, 0.04, 'bronze', dep - 0.05);
  slab(b, fr, t, land + 1.0, lw, 0.05, 0.05, 'bronze', dep - 0.05);
}
/** Dormer standing on the roof behind a facade: body, white frame, window, round pediment (w01-44, w06-307). */
function dormer(fr: Frame, t: number, back = 1.1) {
  let yRoof = 0;
  for (const dt of [-0.9, 0, 0.9]) { const p = add(add(fr.origin, fr.tangent, t + dt), fr.n, -back); yRoof = Math.max(yRoof, roofHeightAt(surfaces, p[0], p[1]) ?? 11.5); }
  const fd = frame(add(fr.origin, fr.n, -back), fr.n), y0 = yRoof + 0.03;
  // slate cheeks behind a painted (stone-tinted) front board, the window and a round pediment
  slab(b, fd, t, y0 - 0.4, 1.85, 3.0, 1.6, 'slate', -1.7);
  slab(b, fd, t, y0 - 0.4, 2.0, 2.92, 0.1, 'stone', -0.1);
  slab(b, fd, t, y0 + 0.25, 1.0, 1.4, 0.1, 'glass');
  for (const x of [-0.25, 0.25]) slab(b, fd, t + x, y0 + 0.25, 0.05, 1.4, 0.16, 'stone');
  for (const y of [0.72, 1.18]) slab(b, fd, t, y0 + y, 1.0, 0.05, 0.16, 'stone');
  archSlab(b, fd, t, y0 + 1.85, 1.7, 0.85, 0.14, 'stone', 0, 8);
  archSlab(b, fd, t, y0 + 1.85, 1.3, 0.65, 0.24, 'slate', 0, 8);
}

function huisNE() {
  const O = ring[0] as V, n: V = unit([-(NC[1] - O[1]), NC[0] - O[0]] as V);
  const nOut: V = dot(n, sub(O, [0, 0])) > 0 ? n : [-n[0], -n[1]];
  const fr = frame(O, nOut), L = Math.hypot(...sub(NC, O));
  wall(fr, [[0, 0], [L, 0], ...topLine(fr, 0, L, () => WALL_TOP)]);
  slab(b, fr, L / 2, 9.35, L, 0.25, 0.08, 'stone');
  cornice(fr, 0, L - 0.6, 0);
  for (const t of [3.5, 9.6]) sash(fr, {t, y: 7.3, w: 1.5, h: 1.65, cols: 3, rows: 3});
  // gable stone (w01-44: a carved stone tablet left of the small arched window)
  slab(b, fr, 2.5, 3.1, 1.4, 1.2, 0.1, 'stone'); slab(b, fr, 2.5, 3.25, 1.1, 0.9, 0.16, 'stone');
  put(b, fr, new T.CylinderGeometry(0.28, 0.28, 0.06, 12).rotateX(Math.PI / 2).translate(0, 0, 0.19), 2.5, 3.7, 0, 'stone');
  sash(fr, {t: 5.2, y: 2.6, w: 0.6, h: 0.9, arch: true, cols: 1, rows: 2});
  // low glazed strip at the foot (w01-44)
  slab(b, fr, 9.55, 0, 4.5, 1.55, 0.08, 'white'); slab(b, fr, 9.55, 0.08, 4.3, 1.4, 0.13, 'glass');
  for (let k = 1; k < 6; k++) ledgeStrip(b, fr, 7.4 + 4.3 * k / 6, 0.08, 0.06, 1.4, 0.18, 'white');
  for (const t of [9.6]) dormer(fr, t, 1.8);
  // chimney on the NE end (w01-44)
  {
    const p = add(add(O, fr.tangent, 6.6), nOut, -3.2), y = roofHeightAt(surfaces, p[0], p[1]) ?? 13;
    b.add(new T.BoxGeometry(0.9, 2.2, 0.6), 'brick' as never, p[0], y + 0.6, p[1]);
    b.add(new T.BoxGeometry(1.05, 0.15, 0.75), 'stone' as never, p[0], y + 1.78, p[1]);
  }
}

// ---------------------------------------------------------------------------------------------------- 3DBAG shell
type W3 = {id: string; ring: number[][]; top: number; bottom: number; bearing: number};
/** Distance of a plan point from a facade line (origin, unit tangent, length) if it lies along it, else Infinity. */
function nearLine(p: V, o: V, d: V, len: number, tol = 0.6) {
  const q = sub(p, o), t = dot(q, d), off = Math.abs(q[0] * d[1] - q[1] * d[0]);
  return t > -0.3 && t < len + 0.3 && off < tol;
}
function handWall(w: W3) {
  const xs = w.ring.map(p => [p[0], p[2]] as V), mid: V = [xs.reduce((s, p) => s + p[0], 0) / xs.length, xs.reduce((s, p) => s + p[1], 0) / xs.length];
  if (inBlock(mid, 0.15)) return true;                                                    // Turfpakhuizen block
  for (let i = 0; i + 1 < NE_LINE.length; i++) {
    const a = NE_LINE[i], c = NE_LINE[i + 1];
    if (nearLine(mid, a, unit(sub(c, a)), Math.hypot(...sub(c, a)), 0.1)) return true;
  }
  if (nearLine(mid, NC, HT, HL, 0.6)) return true;                                       // Huiszittenhuis NW front
  const O = ring[0] as V;
  if (nearLine(mid, O, unit(sub(NC, O)), Math.hypot(...sub(NC, O)), 0.6)) return true;   // Huiszittenhuis NE end
  return false;
}
function shell() {
  for (const w of plan.walls as W3[]) {
    if (handWall(w)) continue;
    const g = planarPolygon([w.ring]);
    if (g) b.add(g, 'brick' as never);
  }
  for (const r of plan.roofs) {
    const o = r.rings[0], c: V = [o.reduce((s, p) => s + p[0], 0) / o.length, o.reduce((s, p) => s + p[2], 0) / o.length];
    if (uv(c)[0] > 0.5 && inBlock(c, 0)) continue;                                        // redrawn gable roofs
    const g = planarPolygon(r.rings);
    if (g) { upward(g); b.add(g, 'slate' as never); }
  }
  // garden wall door (w01-44) and white coping on the wall, SE annex windows (w05-143): on the kept 3DBAG walls,
  // trims sunk behind the wall plane.
  {
    const p0 = ring[0] as V, p1 = ring[16] as V, d = unit(sub(p1, p0)), n: V = [-d[1], d[0]];
    const nOut: V = dot(n, p0) > 0 ? n : [-n[0], -n[1]], fr = frame(p0, nOut);
    const sgn = Math.sign(dot(sub(p1, p0), fr.tangent as V));
    slab(b, fr, sgn * 1.36, 0, 1.0, 2.1, 0.08, 'white'); slab(b, fr, sgn * 1.36, 0, 0.85, 2.0, 0.13, 'dark');
  }
  {
    const p0 = ring[11] as V, p1 = ring[12] as V, d = unit(sub(p1, p0)), n: V = [-d[1], d[0]];
    const nOut: V = dot(n, p0) > 0 ? n : [-n[0], -n[1]], fr = frame(p0, nOut), L = Math.hypot(...sub(p1, p0));
    const sgn = Math.sign(dot(sub(p1, p0), fr.tangent as V));
    for (const t of [2.5, 5.7, 8.9, 12.1]) for (const y of [0.9, 4.2]) {
      const tt = sgn * t, q = add(add(p0, fr.tangent as V, tt), nOut, -0.4), top = roofHeightAt(surfaces, q[0], q[1]) ?? 0;
      if (t < L - 1 && y + 2.1 + 1.0 < top) sash(fr, {t: tt, y, w: 1.1, h: 2.0, cols: 2, rows: 4});
    }
  }
}

export function buildAcademieVanBouwkunst(_w: number, _d: number, tools: BuildingTools) {
  b = tools; setSink(0.12, true);
  shell();
  turfpakhuizen();
  huisFront();
  huisNE();
  setSink(0);
}
