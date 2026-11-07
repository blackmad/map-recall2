import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {frameFromBearing} from './modern-kit';
import {letters, setSink} from './nearbar-kit';

/**
 * Sint-Nicolaaslyceum, Beethovenplein 2 (Prinses Irenestraat), Amsterdam-Zuid: DP6 architectenbureau (Delft), delivered
 * 5 October 2012, in use 29 October 2012 (nl.wikipedia "Sint-Nicolaaslyceum"); BAG pand 0363100012239853 (bouwjaar 2013).
 * Native east/south metres from the vertex average of the BAG ring (scripts/landmarks/sint-nicolaaslyceum-footprints.json),
 * y above local ground (0.4 m NAP).
 *
 * Read from the Gemeente Amsterdam panoramas in scripts/landmarks/sint-nicolaaslyceum-brief.md (CC BY 4.0) and the 3DBAG
 * roof planes (CC BY 4.0):
 *  - storeys drawn as stacked rough pale-grey concrete parapet bands (1.85 m) with rounded corners over recessed ribbon
 *    glazing (1.6 m); bands on a 3.47 m pitch from 3.05 m, the top band to 22.3 m (3DBAG parapet 22.3, deck 21.6 m);
 *  - cream sun fins set at an angle between the bands on the east, south and west, slim pale mullions on the north;
 *  - the south edge of the main block runs on the diagonal the 3DBAG roof shows; the three lower storeys stop 12 m short of
 *    it and the upper storeys cantilever over the deck on a sloping soffit (the aula's tribune) and slim columns (w04, w03);
 *  - an extra storey over the east part to 25.5 m, a pale plant-room box at the north-west to 25.3 m, and the atrium between
 *    them under a glass roof that rises eastwards from 22.6 to 25.8 m, glazed full height in the north front (w02);
 *  - the sports-hall wing at the south-east to 15.3 m, cantilevered over recessed ground-floor glazing;
 *  - the raised schoolyard deck (3.4 m) in dark stone with a white tube cage round the basketball court (w03, w06);
 *  - ST. NICOLAASLYCEUM in red letters on the fourth band of the west front (w04).
 */
type P2 = [number, number];
const B = (k: number) => 3.05 + 3.47 * k;                    // band bottoms
const BT = (k: number) => (k === 5 ? 22.3 : B(k) + 1.85);    // band tops
const GLASS_IN = 0.5;

// ---- plan lines ----
/** The diagonal south edge of the main block (3DBAG 22.3 m roof edge): A west, LB east. */
const LA: P2 = [-15.5, 22.6], LB: P2 = [36.9, 5.8];
const LN: P2 = (() => { const dx = LB[0] - LA[0], dz = LB[1] - LA[1], l = Math.hypot(dx, dz); return [-dz / l, dx / l]; })(); // points south
const sdL = (p: P2) => (p[0] - LA[0]) * LN[0] + (p[1] - LA[1]) * LN[1];
const onL = (x: number): P2 => [x, LA[1] + (x - LA[0]) * (LB[1] - LA[1]) / (LB[0] - LA[0])];
/** The west front (BAG): a point and its eastward normal. */
const WA: P2 = [-19.2, -7.9], WN: P2 = (() => { const dx = 1.6, dz = 27.8, l = Math.hypot(dx, dz); return [dz / l, -dx / l]; })();
const sdW = (p: P2) => (p[0] - WA[0]) * WN[0] + (p[1] - WA[1]) * WN[1];
/** The lower storeys stop this far north of the diagonal west of the hall (w04: their rounded end 23 m along the 34.6 m west front). */
const SETBACK = 12, JOINT_X = 14.5;

// ---- polygon helpers (x, z) ----
function clip(poly: P2[], keep: (p: P2) => number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = keep(a), fb = keep(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return dedupe(out);
}
function dedupe(p: P2[]): P2[] {
  const o: P2[] = [];
  for (const q of p) if (!o.length || Math.hypot(q[0] - o[o.length - 1][0], q[1] - o[o.length - 1][1]) > 0.05) o.push(q);
  while (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) <= 0.05) o.pop();
  return o;
}
const area = (p: P2[]) => p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;
/** Round corners turning more than 25 degrees with radius r (limited by the edges), except where `keepSharp` says. */
function fillet(p: P2[], r: number, keepSharp: (v: P2) => boolean = () => false, seg = 6): P2[] {
  const o: P2[] = [];
  for (let i = 0; i < p.length; i++) {
    const v = p[i], a = p[(i + p.length - 1) % p.length], c = p[(i + 1) % p.length];
    const ua: P2 = [a[0] - v[0], a[1] - v[1]], uc: P2 = [c[0] - v[0], c[1] - v[1]], la = Math.hypot(...ua), lc = Math.hypot(...uc);
    const cos = (ua[0] * uc[0] + ua[1] * uc[1]) / (la * lc), ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (keepSharp(v) || Math.PI - ang < 25 * Math.PI / 180 || la < 0.5 || lc < 0.5) { o.push(v); continue; }
    const tl = Math.min(r / Math.tan(ang / 2), la * 0.45, lc * 0.45);
    const p0: P2 = [v[0] + ua[0] / la * tl, v[1] + ua[1] / la * tl], p1: P2 = [v[0] + uc[0] / lc * tl, v[1] + uc[1] / lc * tl];
    for (let k = 0; k <= seg; k++) { // quadratic Bezier through the corner: close to the arc at these radii
      const t = k / seg, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t;
      o.push([w0 * p0[0] + w1 * v[0] + w2 * p1[0], w0 * p0[1] + w1 * v[1] + w2 * p1[1]]);
    }
  }
  return dedupe(o);
}
/** Offset every edge inward by `d(edge midpoint, edge)` (0 keeps it on the line), joining neighbours by line intersection. */
function inset(p: P2[], d: (m: P2, i: number) => number): P2[] {
  const s = Math.sign(area(p)) || 1, n = p.length;
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const inn: P2 = [-dz / l * s, dx / l * s]; // inward normal for this orientation
    const off = d([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], i);
    return {a: [a[0] + inn[0] * off, a[1] + inn[1] * off] as P2, dir: [dx / l, dz / l] as P2, inn, off};
  });
  return p.map((_, i) => {
    const L1 = lines[(i + n - 1) % n], L2 = lines[i];
    const v = p[i], d1 = lines[(i + n - 1) % n].off, d2 = L2.off;
    // the vertex moved onto each offset line; where they nearly agree in direction (fillet arcs, a step in offset) or the
    // intersection runs away, take their mean instead of the miter point
    const o1: P2 = [v[0] + L1.inn[0] * d1, v[1] + L1.inn[1] * d1], o2: P2 = [v[0] + L2.inn[0] * d2, v[1] + L2.inn[1] * d2];
    const mean: P2 = [(o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2];
    const den = L1.dir[0] * L2.dir[1] - L1.dir[1] * L2.dir[0];
    if (Math.abs(den) < 0.05) return mean;
    const t = ((L2.a[0] - L1.a[0]) * L2.dir[1] - (L2.a[1] - L1.a[1]) * L2.dir[0]) / den;
    const q: P2 = [L1.a[0] + L1.dir[0] * t, L1.a[1] + L1.dir[1] * t];
    return Math.hypot(q[0] - v[0], q[1] - v[1]) > 2.5 * Math.max(d1, d2, 0.05) ? mean : q;
  });
}
/** Outward unit normal of edge i. */
function outward(p: P2[], i: number): P2 {
  const s = Math.sign(area(p)) || 1, a = p[i], b = p[(i + 1) % p.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[1] - a[1]) / l * s, -(b[0] - a[0]) / l * s];
}

// ---- geometry ----
function prismGeo(poly: P2[], y0: number, y1: number, top?: (p: P2) => number, bottom?: (p: P2) => number): T.BufferGeometry {
  const shape = new T.Shape(poly.map(([x, z]) => new T.Vector2(x, -z)));
  const g = new T.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false, steps: 1}).rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), up = pos.getY(i) > 0.5;
    pos.setY(i, up ? (top ? top([x, z]) : y1) : (bottom ? bottom([x, z]) : y0));
  }
  g.clearGroups();
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  return ng;
}
const prism = (b: BuildingTools, poly: P2[], y0: number, y1: number, c: string, top?: (p: P2) => number, bottom?: (p: P2) => number) =>
  b.add(prismGeo(poly, y0, y1, top, bottom), c as never);
function boxAt(b: BuildingTools, p: P2, y0: number, y1: number, w: number, d: number, angle: number, c: string) {
  const g = new T.BoxGeometry(w, y1 - y0, d).rotateY(angle);
  b.add(g, c as never, p[0], (y0 + y1) / 2, p[1]);
}
function column(b: BuildingTools, p: P2, y0: number, y1: number, r = 0.3) {
  b.add(new T.CylinderGeometry(r, r, y1 - y0, 10), 'concrete' as never, p[0], (y0 + y1) / 2, p[1]);
}

type Piece = {plan: P2[]; glassIn: (m: P2, i: number) => number; finSkip?: (m: P2, n: P2, y1: number) => boolean};
/** One storey band (solid concrete, rounded plan) or one glazing zone (glass set back, fins / mullions in front). */
function band(b: BuildingTools, pc: Piece, y0: number, y1: number) { prism(b, pc.plan, y0, y1, 'concrete'); }
function glazing(b: BuildingTools, pc: Piece, y0: number, y1: number, fins = true) {
  prism(b, inset(pc.plan, pc.glassIn), y0, y1, 'glass');
  if (!fins) return;
  const p = pc.plan;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 2.5) continue; // rounded corners stay smooth
    const m: P2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], n = outward(p, i);
    if (pc.glassIn(m, i) < 0.2 || pc.finSkip?.(m, n, y1)) continue; // joints and walls against another volume
    const dir: P2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len], ang = Math.atan2(n[0], n[1]);
    const north = n[1] < -0.7;
    // north: slim pale mullions on a 2.0 m pitch (w02); elsewhere angled sun fins in pairs, 1.3 m then 2.6 m (w01, w04)
    const pitches = north ? [2.0] : [1.3, 2.6];
    for (let t = 0.9, k = 0; t < len - 0.9; t += pitches[k++ % pitches.length]) {
      const q: P2 = [a[0] + dir[0] * t - n[0] * (GLASS_IN / 2 + 0.02), a[1] + dir[1] * t - n[1] * (GLASS_IN / 2 + 0.02)];
      if (north) boxAt(b, q, y0, y1, 0.12, GLASS_IN - 0.08, ang, 'sandstone');
      else boxAt(b, q, y0, y1, 0.06, GLASS_IN - 0.1, ang + 0.5, 'sandstone');
    }
  }
}

export function buildSintNicolaaslyceum(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0);
  // BAG ring (sint-nicolaaslyceum-footprints.json), the outline of the whole pand including the deck
  const RING: P2[] = [[29.5, -20.2], [-14.3, -17.8], [-16.7, -17.6], [-17.5, -17.5], [-18.3, -17.0], [-18.9, -16.5], [-19.3, -15.9], [-19.5, -15.4], [-19.6, -14.9], [-19.6, -14.4], [-19.2, -7.9], [-18.6, 2.8], [-18.5, 5.8], [-17.6, 19.9], [-17.4, 20.8], [-17.1, 21.5], [-16.6, 22.0], [-15.9, 22.4], [-15.2, 22.7], [-14.8, 22.8], [-16.2, 30.1], [-17.0, 30.0], [-16.8, 34.7], [24.2, 42.9], [27.0, 42.8], [29.1, 32.1], [43.3, 28.9], [40.4, 16.2], [38.5, 8.3], [32.5, -17.9], [32.3, -18.6], [32.0, -19.0], [31.7, -19.3], [31.1, -19.8], [30.5, -20.1], [30.0, -20.2]];
  // ---- main block plans ----
  const U = fillet(clip(RING, p => -sdL(p)), 3.5);
  const isJoint = (m: P2) => Math.abs(m[0] - JOINT_X) < 0.05;
  const UW = fillet(clip(clip(U, p => JOINT_X - p[0]), p => -(sdL(p) + SETBACK)), 3.5, v => Math.abs(v[0] - JOINT_X) < 0.05);
  const UE = clip(U, p => p[0] - JOINT_X);
  const onLine = (m: P2) => Math.abs(sdL(m)) < 0.3;
  const main = (plan: P2[], alongL: 'face' | 'hall'): Piece => ({
    plan,
    glassIn: m => (isJoint(m) ? 0 : alongL === 'hall' && onLine(m) && m[0] > 15.5 ? 0 : GLASS_IN),
    finSkip: (m, _n, y1) => alongL === 'hall' && onLine(m) && m[0] > 15.5 && y1 <= 15.4,
  });
  const lowW = main(UW, 'face'), lowE = main(UE, 'hall'), up = main(U, 'face');
  for (const pc of [lowW, lowE]) {
    glazing(b, pc, 0, B(0), false);
    for (let k = 0; k <= 2; k++) { band(b, pc, B(k), BT(k)); glazing(b, pc, BT(k), B(k + 1)); }
  }
  for (let k = 3; k <= 5; k++) { band(b, up, B(k), BT(k)); if (k < 5) glazing(b, up, BT(k), B(k + 1)); }
  b.mark?.('main');

  // ---- the sloping soffit under the cantilever (aula tribune), set 3 m back from the west front so its underside shows ----
  const O = clip(clip(clip(U, p => JOINT_X - 0.05 - p[0]), p => sdL(p) + SETBACK - 0.05), p => sdW(p) - 3);
  const soffit = (p: P2) => B(1) + (B(3) - 0.02 - B(1)) * Math.min(1, Math.max(0, (sdL(p) + SETBACK) / SETBACK));
  prism(b, O, 0, B(3) - 0.02, 'concrete', undefined, soffit);
  // columns: a row 1.2 m inside the diagonal on the deck, and two at the west end from the street (w04)
  for (let x = -12; x <= 12.5; x += 6.1) { const q = onL(x); column(b, [q[0] - LN[0] * 1.2, q[1] - LN[1] * 1.2], 3.4, B(3) + 0.2); }
  for (const z of [14.5, 18.6]) { const x = WA[0] + (z - WA[1]) * 1.6 / 27.8; column(b, [x + 1.0, z], 0, B(3) + 0.2); }

  // ---- roof storeys: the east storey to 25.5 m, the plant box at the north-west, the atrium between ----
  const PE = clip(clip(U, p => (p[0] - 16.0) * 0.9505 + (p[1] + 19.4) * 0.3104), p => 2.5 - p[1]);
  const top = main(PE, 'face');
  glazing(b, top, BT(5), 23.87); band(b, top, 23.87, 25.5);
  const PNW = fillet([[-17.6, -14.4], [-6.2, -16.7], [-5.1, -9.0], [-10.2, -3.1], [-8.9, 2.2], [-16.8, 6.4]], 2.0);
  prism(b, PNW, BT(5) - 0.1, 25.3, 'sandstone');
  const ATR: P2[] = [[3.1, -18.95], [16.0, -19.65], [13.2, -10.7], [9.6, 0.2], [8.9, 2.5], [4.0, 2.7], [4.1, -2.3], [3.0, -10.8]];
  prism(b, ATR, B(3) - 0.15, 0, 'canopyGlass', p => 22.6 + (25.8 - 22.6) * Math.min(1, Math.max(0, (p[0] - 3.0) / 13.0)));
  b.mark?.('roof');

  // ---- the sports-hall wing (14.9-15.5 m roof) ----
  const H = fillet([onL(15.9), [37.85, 5.49], [38.5, 8.3], [40.4, 16.2], [41.1, 19.5], [38.4, 19.0], [29.9, 17.2], [14.8, 14.1]], 3.0, v => Math.abs(sdL(v)) < 0.3);
  const deckEdge = (m: P2) => m[0] < 30.5 && m[1] > 13.5 && m[1] < 17.6 && sdL(m) > 0.5 && m[0] > 14.5 && (m[1] - 14.1) - (m[0] - 14.8) * (17.2 - 14.1) / (29.9 - 14.8) < 0.3;
  const hall: Piece = {plan: H, glassIn: m => (onLine(m) ? 0 : GLASS_IN), finSkip: m => onLine(m)};
  const hallGF: Piece = {plan: H, glassIn: m => (onLine(m) || deckEdge(m) ? 0 : 2.0)};
  glazing(b, hallGF, 0, B(0), false);
  for (let k = 0; k <= 3; k++) { band(b, hall, B(k), BT(k)); if (k < 3) glazing(b, hall, BT(k), B(k + 1)); }
  for (const x of [21, 33]) { const z = 14.1 + (x - 14.8) * (17.2 - 14.1) / (29.9 - 14.8) - 1.2; column(b, [x, z], 0, B(0) + 0.1); }
  b.mark?.('hall');

  // ---- the raised schoolyard deck and its cage ----
  const D: P2[] = [onL(-14.6), onL(15.9), [14.8, 14.1], [29.9, 17.2], [31.0, 23.5], [26.8, 41.8], [-16.9, 31.5], [-17.0, 30.0], [-16.2, 30.1], [-14.8, 22.8]];
  prism(b, D, 0, 3.4, 'stone');
  const edges: [P2, P2, number][] = [[[29.9, 17.2], [31.0, 23.5], 1.1], [[31.0, 23.5], [26.8, 41.8], 4.0], [[26.8, 41.8], [-16.9, 31.5], 4.0], [[-16.9, 31.5], [-17.0, 30.0], 1.1], [[-17.0, 30.0], [-16.2, 30.1], 1.1], [[-16.2, 30.1], [-14.8, 22.8], 1.1]];
  for (const [a, c, h] of edges) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), dir: P2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
    const inn: P2 = [-dir[1], dir[0]], ang = Math.atan2(-dir[1], dir[0]);
    const at = (t: number): P2 => [a[0] + dir[0] * t + inn[0] * 0.25, a[1] + dir[1] * t + inn[1] * 0.25];
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= n; k++) boxAt(b, at(len * k / n), 3.4, 3.4 + h, 0.09, 0.09, 0, 'sandstone');
    for (const y of h > 2 ? [3.4 + 1.0, 3.4 + h - 0.09] : [3.4 + h - 0.06]) {
      const mid = at(len / 2);
      boxAt(b, mid, y, y + 0.06, len - 0.1, 0.06, ang, 'sandstone');
    }
  }
  b.mark?.('deck');

  // ---- dark stone block at the west front's north end (storeys 0-1, w04) and the lettering on the fourth band ----
  {
    const z0 = -7.0, z1 = 3.2, x = (z: number) => WA[0] + (z - WA[1]) * 1.6 / 27.8;
    prism(b, [[x(z0) - 0.12, z0], [x(z1) - 0.12, z1], [x(z1) + 0.9, z1], [x(z0) + 0.9, z0]], 0, B(1), 'stone');
    const f = frameFromBearing([x(-14.0), -14.0], 266.7);
    letters(b, f, 'ST. NICOLAASLYCEUM', 5.75, B(4) + 0.3, 0, 0.103, 0.1, 'red', 0.186);
  }
  // dark stone piers in the east ground storey (w01: 29.5-32.8 m and 34.6-37.9 m from the south end of the 48.7 m front)
  {
    const S: P2 = [43.3, 28.9], E: P2 = [32.5, -17.9], l = Math.hypot(E[0] - S[0], E[1] - S[1]), dir: P2 = [(E[0] - S[0]) / l, (E[1] - S[1]) / l];
    const n: P2 = [-dir[1], dir[0]]; // points east (outward) for this direction
    const at = (s: number, o: number): P2 => [S[0] + dir[0] * s + n[0] * o, S[1] + dir[1] * s + n[1] * o];
    for (const [s0, s1] of [[29.5, 32.8], [34.6, 37.9]]) prism(b, [at(s0, 0.1), at(s1, 0.1), at(s1, -0.9), at(s0, -0.9)], 0, B(0), 'stone');
  }
  // seating steps up to the deck in the south-east corner the 3DBAG leaves without a roof (w05)
  {
    const C: P2[] = [[31.0, 23.5], [29.1, 32.1], [43.3, 28.9], [41.1, 19.5], [38.4, 19.0], [29.9, 17.2]];
    const a: P2 = [29.9, 17.2], c: P2 = [31.0, 23.5], l = Math.hypot(c[0] - a[0], c[1] - a[1]), en: P2 = [(c[1] - a[1]) / l, -(c[0] - a[0]) / l]; // east of the deck edge
    const dist = (q: P2) => (q[0] - a[0]) * en[0] + (q[1] - a[1]) * en[1];
    for (let k = 0; k < 6; k++) {
      const band = clip(clip(C, q => dist(q) - k * 1.5), q => (k + 1) * 1.5 - dist(q) + (k === 5 ? 99 : 0));
      if (band.length >= 3) prism(b, band, 0, 3.4 * (6 - k) / 6 - 0.02, 'concrete');
    }
  }
  // the deck's east wall: red lettering (w06); the deck's west wall: the glazed bicycle store (w07)
  {
    const f = frameFromBearing([26.8, 41.8], 102.9);
    letters(b, f, 'ST. NICOLAASLYCEUM', 5.2, 1.2, 0, 0.061, 0.08, 'red', 0.114);
    const a: P2 = [-16.2, 30.1], c: P2 = [-14.8, 22.8], l = Math.hypot(c[0] - a[0], c[1] - a[1]), dir: P2 = [(c[0] - a[0]) / l, (c[1] - a[1]) / l];
    const out: P2 = [dir[1], -dir[0]]; // west
    const at = (t: number, o: number): P2 => [a[0] + dir[0] * t + out[0] * o, a[1] + dir[1] * t + out[1] * o];
    prism(b, [at(0.6, 0.1), at(l - 0.6, 0.1), at(l - 0.6, -0.1), at(0.6, -0.1)], 0.4, 2.6, 'glass');
  }
  b.mark?.('details');
}
