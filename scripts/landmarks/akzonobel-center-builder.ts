import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {letters, type Frame} from './nearbar-kit';
import {Acc, fin, strip, wallQuad, type C} from './tier-kit';
import {edgeNormal, type PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';

/**
 * AkzoNobel Center, Christian Neefestraat 2, Zuidas (BAG pand 0363100012240149, bouwjaar 2017; Group A, Rotterdam,
 * built by Dura Vermeer 2016-17; head office of AkzoNobel; nl.wikipedia "Christian Neefestraat").
 *
 * Native frame of the BAG pand's vertex average (x east, z south, y up, metres; ground NAP 0.85). Read from the
 * PDOK orthophoto, 3DBAG (roof planes 45.2 NAP over the south-west wedge, 41.8-42.7 over the rest) and the photos:
 *  - two volumes on one two-storey plinth: the taller west wedge (W face 17 m to Beethovenstraat, SE face 19 m to the
 *    entrance square, its south-west nose rounded) carrying the blue AkzoNobel wordmark on its crown (Commons
 *    "Akzo Nobel Headquarters (4)/(5)"), and the lower east volume that wraps north of it and runs east along the A10;
 *  - between them, over the entrance, a leaning plane of blue glass that rises from the plinth top at the square to
 *    the roof 5.5 m further back, its side edge a white diagonal on the east volume's south front (Commons (1)/(2),
 *    panorama w02-147; the gridded patch on the orthophoto);
 *  - curtain walls of pale fritted glass with clear windows staggered floor by floor between deep silver mullions
 *    (Commons (4)/(5), w01/w02/w03); rounded corners on the nose, the east end and the north tip;
 *  - the plinth: glass behind white mullions, a white floor band, timber-brown fins on the first floor, the word
 *    EARTH repeated in white letters round the west wedge's first floor (w02, w03), broad steps up to the entrance.
 */

type Tag = 'wall' | 'shared' | 'none';
type Ring = {pts: PlanPoint[]; tags: Tag[]};
type V3 = [number, number, number];

const PLINTH = 8.6, STOREY = 3.5, FLOORS = 9;
const TOP_E = 41.2, TOP_W = 44.3, LEAN = 5.5, MOD = 1.35;
const OFFICE_TOP = PLINTH + FLOORS * STOREY;   // 40.1: the crown frit starts here

// key plan points (BAG ring, simplified)
const P1: PlanPoint = [-16.8, 1.7];          // inner corner: the west wedge's SE face meets the entrance front
const F3: PlanPoint = [-4.7, 14.4];          // the entrance front meets the east volume's south front
const SW_IN: PlanPoint = [-33.0, 12.4];      // west wedge SE face, near the nose
const NOSE: PlanPoint = [-35.0, 11.6];
const W_IN: PlanPoint = [-35.6, 10.7];
const WNW: PlanPoint = [-30.4, -7.3];         // west wedge NW corner
const NE_LINE_E: PlanPoint = [-4.0, -6.2];    // 3DBAG plane edge between the 45 m wedge and the 42 m north part

const sub2 = (a: PlanPoint, b: PlanPoint): PlanPoint => [a[0] - b[0], a[1] - b[1]];
const len2 = (a: PlanPoint) => Math.hypot(a[0], a[1]);
const lerp2 = (a: PlanPoint, b: PlanPoint, t: number): PlanPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const cross2 = (a: PlanPoint, b: PlanPoint) => a[0] * b[1] - a[1] * b[0];
/** Intersection of lines p+s*u and q+t*v. */
function meet(p: PlanPoint, u: PlanPoint, q: PlanPoint, v: PlanPoint): PlanPoint {
  const s = cross2(sub2(q, p), v) / cross2(u, v);
  return [p[0] + u[0] * s, p[1] + u[1] * s];
}
/** Rounded corner: replace corner q (between p and r) by an arc of radius rad, `seg` segments. */
function fillet(p: PlanPoint, q: PlanPoint, r: PlanPoint, rad: number, seg = 4): PlanPoint[] {
  const a = sub2(p, q), b = sub2(r, q), la = len2(a), lb = len2(b);
  const ua: PlanPoint = [a[0] / la, a[1] / la], ub: PlanPoint = [b[0] / lb, b[1] / lb];
  const half = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]))) / 2;
  const d = Math.min(rad / Math.tan(half), la * 0.45, lb * 0.45);
  const s0: PlanPoint = [q[0] + ua[0] * d, q[1] + ua[1] * d], s1: PlanPoint = [q[0] + ub[0] * d, q[1] + ub[1] * d];
  const out: PlanPoint[] = [];
  // quadratic Bezier through the corner: a close stand-in for the circular arc at these radii
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, m = 1 - t;
    out.push([m * m * s0[0] + 2 * m * t * q[0] + t * t * s1[0], m * m * s0[1] + 2 * m * t * q[1] + t * t * s1[1]]);
  }
  return out;
}
/** Make the ring counter-clockwise in (x, z) (edgeNormal then points out), keeping each edge's tag. */
function ccwRing(r: Ring): Ring {
  const a = r.pts.reduce((s, p, i) => { const q = r.pts[(i + 1) % r.pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (a > 0) return r;
  const n = r.pts.length, pts = [...r.pts].reverse(), tags: Tag[] = [];
  for (let i = 0; i < n; i++) tags.push(r.tags[(n - 2 - i + n) % n]);
  return {pts, tags};
}
/** Ring builder: push points with the tag of the edge that LEAVES them. */
function ring(parts: [PlanPoint[], Tag][]): Ring {
  const pts: PlanPoint[] = [], tags: Tag[] = [];
  for (const [ps, tag] of parts) for (let i = 0; i < ps.length; i++) { pts.push(ps[i]); tags.push(i < ps.length - 1 ? 'wall' : tag); }
  return {pts, tags};
}

// ---- plan ---------------------------------------------------------------------------------------------------------
const uA = sub2(P1, SW_IN);   // direction of the west wedge's SE face, continued past the inner corner
const WNE = meet(P1, uA, WNW, sub2(NE_LINE_E, WNW));
const uF = sub2(F3, P1), LF = len2(uF), uFn: PlanPoint = [uF[0] / LF, uF[1] / LF];
const nIn: PlanPoint = [uFn[1], -uFn[0]];   // from the entrance front into the building (north-east)
const dF = (p: PlanPoint) => (p[0] - P1[0]) * nIn[0] + (p[1] - P1[1]) * nIn[1];
/** Where the top line of the leaning glass meets the wedge's SE line (a ring vertex of both roofs). */
const Sa = lerp2(P1, WNE, LEAN / dF(WNE));

/** West wedge: nose filleted, NW corner, the 3DBAG plane edge, back down the SE face line to the inner corner. */
function westWedge(): Ring {
  const nose = fillet(SW_IN, NOSE, W_IN, 3.2, 4);
  return ring([[[P1], 'wall'], [nose, 'wall'], [[WNW], 'shared'], [[WNE], 'shared'], [[Sa], 'shared']]);
}
// east volume chain from the entrance corner round the east end and the north tip back to the wedge's NW corner
const S_FRONT: PlanPoint = [-2.4, 15.3];
const EAST: PlanPoint[] = [[35.8, 13.6], [52.1, 11.9]];
const E_TIP: PlanPoint = [53.6, 10.0], E_N: PlanPoint = [45.9, -2.0];
const NORTH: PlanPoint[] = [[20.6, -0.8], [9.6, -9.4], [1.1, -17.2]];
const N_TIP: PlanPoint = [-7.1, -22.9];
function eastVolume(): Ring {
  const corner = fillet(F3, S_FRONT, EAST[0], 1.6, 2);
  const eEnd = fillet(EAST[1], E_TIP, E_N, 3.5, 4);
  const nTip = fillet(NORTH[2], N_TIP, WNW, 3.0, 3);
  return ring([[[P1, F3], 'wall'], [corner, 'wall'], [EAST, 'wall'], [eEnd, 'wall'], [[E_N, ...NORTH], 'wall'], [nTip, 'wall'], [[WNW], 'shared'], [[WNE], 'shared']]);
}

// ---- helpers ------------------------------------------------------------------------------------------------------
const triUp = (acc: Acc, c: C, a: V3, b: V3, d: V3, n: V3) => {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ad: V3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const cr: V3 = [ab[1] * ad[2] - ab[2] * ad[1], ab[2] * ad[0] - ab[0] * ad[2], ab[0] * ad[1] - ab[1] * ad[0]];
  if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) acc.tri(c, a, b, d); else acc.tri(c, a, d, b);
};
function roofPoly(b: BuildingTools, pts: PlanPoint[], y: number, c: C) {
  b.add(upwardRoofPlane(new T.Shape(pts.map(([x, z]) => new T.Vector2(x, z))), y), c);
}
/** Closed bar between two 3D points, `w` x `w` square, its sides along `side`. */
function bar(acc: Acc, c: C, p: V3, q: V3, side: V3, w: number) {
  const d: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L = Math.hypot(...d), u: V3 = [d[0] / L, d[1] / L, d[2] / L];
  const s0 = side, sl = Math.hypot(...s0), s: V3 = [s0[0] / sl, s0[1] / sl, s0[2] / sl];
  const t: V3 = [u[1] * s[2] - u[2] * s[1], u[2] * s[0] - u[0] * s[2], u[0] * s[1] - u[1] * s[0]];
  const h = w / 2, C0 = (k: V3, a: number, bb: number): V3 => [k[0] + s[0] * a + t[0] * bb, k[1] + s[1] * a + t[1] * bb, k[2] + s[2] * a + t[2] * bb];
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (let i = 0; i < 4; i++) {
    const [a0, b0] = corners[i], [a1, b1] = corners[(i + 1) % 4];
    const mid: V3 = [(a0 + a1) / 2 * s[0] + (b0 + b1) / 2 * t[0], (a0 + a1) / 2 * s[1] + (b0 + b1) / 2 * t[1], (a0 + a1) / 2 * s[2] + (b0 + b1) / 2 * t[2]];
    triUp(acc, c, C0(p, a0, b0), C0(p, a1, b1), C0(q, a1, b1), mid);
    triUp(acc, c, C0(p, a0, b0), C0(q, a1, b1), C0(q, a0, b0), mid);
  }
  triUp(acc, c, C0(p, -h, -h), C0(p, h, -h), C0(p, h, h), [-u[0], -u[1], -u[2]]);
  triUp(acc, c, C0(p, -h, -h), C0(p, h, h), C0(p, -h, h), [-u[0], -u[1], -u[2]]);
  triUp(acc, c, C0(q, -h, -h), C0(q, h, -h), C0(q, h, h), u);
  triUp(acc, c, C0(q, -h, -h), C0(q, h, h), C0(q, -h, h), u);
}

/**
 * Curtain wall on one plan edge, `skin`:
 *  - 'frit' (the west wedge, Commons (4)/(5), w02, w03): pale fritted glass to `top` with clear windows (glass boxes
 *    9 cm proud) in two modules of three, stacked floor over floor, silver mullions 24 cm deep every
 *    module and a floor line at every storey;
 *  - 'skin' (the east volume, w01, w04, Commons (2)): the pale outer glass skin full height, thin mullions every
 *    1.8 m, a 0.3 m perforated-metal strip on every second joint and thin floor lines.
 * `m0` carries the module count along a ring so the patterns run on round the corners. `yTopAt(t)` (optional) lowers
 * the wall's top along the edge (the leaning glass cuts it).
 */
type Skin = 'frit' | 'skin';
function curtain(acc: Acc, a: PlanPoint, c: PlanPoint, y0: number, top: number, m0: number, skin: Skin, yTopAt?: (t: number) => number): number {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (L < 0.05) return m0;
  const mod = skin === 'frit' ? MOD : 1.8, base: C = skin === 'frit' ? 'white' : 'glass';
  // frit: 3k + 2 modules, so every edge ends on a whole pair of windows; skin: twice the plinth's bays, so the
  // metal strips stand over the plinth mullions
  const n = skin === 'frit' ? (L >= 4 ? 3 * Math.max(1, Math.round((L / mod - 2) / 3)) + 2 : Math.max(1, Math.round(L / mod))) : 2 * Math.max(1, Math.round(L / 3.6));
  const p = L / n;
  if (!yTopAt) wallQuad(acc, base, a, c, y0, top);
  else {
    const u: PlanPoint = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], nn = edgeNormal(a, c), out: V3 = [nn[0], 0, nn[1]];
    const P = (t: number, y: number): V3 => [a[0] + u[0] * t, y, a[1] + u[1] * t];
    for (let i = 0; i < n; i++) {
      const t0 = i * p, t1 = (i + 1) * p;
      triUp(acc, base, P(t0, y0), P(t1, y0), P(t1, yTopAt(t1)), out);
      triUp(acc, base, P(t0, y0), P(t1, yTopAt(t1)), P(t0, yTopAt(t0)), out);
    }
  }
  const lim = (t: number) => Math.min(top, yTopAt ? yTopAt(t) : top);
  if (L < 1.0) return m0 + 1;   // a facet of a tight curve: wall only
  if (skin === 'frit') for (let i = 0; i < n; i++) {
    const t0 = i * p + 0.06, t1 = (i + 1) * p - 0.06, m = L >= 4 ? i : m0 + i;
    for (let k = 0; k < FLOORS; k++) {
      const y = PLINTH + k * STOREY;
      if (y < y0 - 0.01) continue;
      if (m % 3 === 2) continue;   // a frit column (w03: the windows stand in vertical stacks)
      const ya = y + 0.75, yb = y + STOREY - 0.35;
      if (yb > Math.min(lim(t0), lim(t1)) - 0.3) continue;
      strip(acc, 'glass', a, c, t0, t1, ya, yb, 0.09, -0.02);
    }
  }
  for (let i = 0; i <= n; i++) {
    const t = Math.min(L - 0.05, Math.max(0.05, i * p)), yt = lim(t) - 0.15;
    if (yt <= y0 + 0.5) continue;
    if (skin === 'frit') fin(acc, 'frame', a, c, t, 0.08, y0, yt, 0.24);
    else if (i % 2 === 0 && i > 0 && i < n) fin(acc, 'stone', a, c, t, 0.3, y0, yt, 0.14);
    else fin(acc, 'frame', a, c, t, 0.05, y0, yt, 0.1);
  }
  for (let k = 1; k < FLOORS + 1; k++) {
    const y = PLINTH + k * STOREY - (skin === 'frit' ? 0.12 : 0.06);
    if (y < y0 || y > top - 0.3) continue;
    // trim the floor line to where the wall still stands at that height
    let t0 = 0.05, t1 = L - 0.05;
    if (yTopAt) { while (t0 < t1 && yTopAt(t0) < y + 0.4) t0 += 0.1; while (t1 > t0 && yTopAt(t1) < y + 0.4) t1 -= 0.1; }
    if (t1 - t0 > 0.3) strip(acc, 'frame', a, c, t0, t1, y, y + (skin === 'frit' ? 0.12 : 0.06), skin === 'frit' ? 0.13 : 0.08, -0.02);
  }
  return m0 + n;
}

/**
 * The two-storey plinth on one edge (w01, w02): glass on a dark base, white mullions every ~3.6 m, a white band at
 * the first floor, a band of white louvres under the plinth top; on the east volume a timber-brown fin midway between
 * the mullions, full height.
 */
function plinth(acc: Acc, a: PlanPoint, c: PlanPoint, fins: boolean) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (L < 0.05) return;
  wallQuad(acc, 'glass', a, c, 0, PLINTH);
  if (L < 1.0) return;   // a facet of a tight curve: the trims of its neighbours read across it
  // bands and mullions stop short of the edge ends, so a curve's facets never chain them round a corner
  strip(acc, 'slate', a, c, 0.25, L - 0.25, 0, 0.35, 0.1);
  strip(acc, 'white', a, c, 0.25, L - 0.25, 4.3, 4.9, 0.14);
  strip(acc, 'white', a, c, 0.25, L - 0.25, PLINTH - 1.5, PLINTH, 0.14, 0);
  const n = Math.max(1, Math.round(L / 3.6)), p = L / n;
  for (let i = 1; i < n; i++) fin(acc, 'white', a, c, i * p, 0.32, 0.35, PLINTH - 1.5, 0.25);
  if (fins && L > 2.4) for (let i = 0; i < n; i++) fin(acc, 'bronze', a, c, (i + 0.5) * p, 0.08, 0.35, PLINTH - 1.5, 0.22);
}

/** Wall frame for lettering: origin at the edge end on the viewer's left, tangent to the viewer's right, n outward. */
const frameOn = (a: PlanPoint, c: PlanPoint): Frame => {
  const n = edgeNormal(a, c), tangent: [number, number] = [n[1], -n[0]];
  const along = (c[0] - a[0]) * tangent[0] + (c[1] - a[1]) * tangent[1];
  return {origin: [...(along >= 0 ? a : c)] as [number, number], tangent, n: [n[0], n[1]]};
};

// ---- builder ------------------------------------------------------------------------------------------------------
export function buildAkzoNobelCenter(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  const W = ccwRing(westWedge()), E = ccwRing(eastVolume());

  // ---- the leaning glass between the volumes ----
  // core of the east volume: drop the strip in front of the slope's top line (dF < LEAN, east of the wedge's SE line)
  const inStrip = (p: PlanPoint) => dF(p) < LEAN - 1e-6 && cross2(uA, sub2(p, P1)) >= -1e-6;
  // where the south front leaves the strip: the ring edge from a strip vertex to a non-strip vertex other than WNE
  let Sb: PlanPoint = F3;
  for (let i = 0; i < E.pts.length; i++) {
    const p = E.pts[i], q = E.pts[(i + 1) % E.pts.length];
    for (const [x, y] of [[p, q], [q, p]] as [PlanPoint, PlanPoint][]) {
      if (inStrip(x) && !inStrip(y) && len2(sub2(y, WNE)) > 1e-6) Sb = lerp2(x, y, (LEAN - dF(x)) / (dF(y) - dF(x)));
    }
  }
  const slopeY = (p: PlanPoint) => PLINTH + (TOP_E - PLINTH) * Math.max(0, Math.min(1, dF(p) / LEAN));
  const coreRing: PlanPoint[] = [];
  {
    let inserted = false;
    for (const p of E.pts) {
      if (inStrip(p)) {
        if (!inserted) {
          const prev = coreRing[coreRing.length - 1];
          const near = (q: PlanPoint) => len2(sub2(q, prev));
          coreRing.push(...(near(Sa) < near(Sb) ? [Sa, Sb] : [Sb, Sa]));
          inserted = true;
        }
        continue;
      }
      coreRing.push(p);
    }
  }
  const along = (p: PlanPoint) => (p[0] - P1[0]) * uFn[0] + (p[1] - P1[1]) * uFn[1];
  const stripRing: PlanPoint[] = [Sa, P1, ...E.pts.filter(p => inStrip(p) && len2(sub2(p, P1)) > 1e-6).sort((p, q) => along(p) - along(q)), Sb];

  // ---- plinth all round both volumes (the entrance front included) ----
  for (const R of [W, E]) for (let i = 0; i < R.pts.length; i++) {
    if (R.tags[i] !== 'wall') continue;
    const a = R.pts[i], c = R.pts[(i + 1) % R.pts.length];
    plinth(acc, a, c, R === E);
  }

  // ---- curtain walls ----
  let m = 0;
  for (let i = 0; i < W.pts.length; i++) {
    if (W.tags[i] !== 'wall') continue;
    const a = W.pts[i], c = W.pts[(i + 1) % W.pts.length];
    m = curtain(acc, a, c, PLINTH, TOP_W, m, 'frit');
  }
  // the wedge's faces that stand clear above the east volume: the north line (above the east roof) and the SE line
  // past the inner corner (above the leaning glass up to Sa, above the east roof beyond). Each is one quad whose
  // bottom edge is exactly the roof or slope edge it stands on, so the shells weld.
  for (let i = 0; i < W.pts.length; i++) {
    if (W.tags[i] !== 'shared') continue;
    const a = W.pts[i], c = W.pts[(i + 1) % W.pts.length];
    const base = (q: PlanPoint) => (dF(q) < LEAN - 1e-6 && Math.abs(cross2(uA, sub2(q, P1))) < 0.5 ? slopeY(q) : TOP_E);
    const yA = base(a), yC = base(c);
    const nOut = edgeNormal(a, c), out: V3 = [nOut[0], 0, nOut[1]];
    triUp(acc, 'white', [a[0], yA, a[1]], [c[0], yC, c[1]], [c[0], TOP_W, c[1]], out);
    triUp(acc, 'white', [a[0], yA, a[1]], [c[0], TOP_W, c[1]], [a[0], TOP_W, a[1]], out);
    const L = len2(sub2(c, a)), u: PlanPoint = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
    const yAt = (t: number) => yA + (yC - yA) * t / L;
    // over the leaning glass the wedge face stays frit (windows and mullions there read as part of the slope)
    if (Math.min(yA, yC) < TOP_E - 0.01) continue;
    const steps = Math.max(1, Math.round(L / MOD));
    for (let k = 0; k < steps; k++) {
      const t0 = L * k / steps, t1 = L * (k + 1) / steps;
      // clear windows in the storeys that stand clear of the slope and the east roof, mullions on the module joints
      for (let f = 0; f < FLOORS; f++) {
        const y = PLINTH + f * STOREY, ya = y + 0.75, yb = y + STOREY - 0.35;
        if (ya < Math.max(yAt(t0), yAt(t1)) + 1.2 || (m + k) % 3 === 2) continue;
        strip(acc, 'glass', a, c, t0 + 0.06, t1 - 0.06, ya, yb, 0.09, -0.02);
      }
      const tf = Math.max(0.05, t0), yf = Math.max(yAt(t0), yAt(t1)) + 1.2;
      if (TOP_W - 0.15 > yf + 0.5 && k > 0) fin(acc, 'frame', a, c, tf, 0.08, yf, TOP_W - 0.15, 0.24);
    }
    void u;
  }
  for (let i = 0; i < E.pts.length; i++) {
    if (E.tags[i] !== 'wall') continue;
    const a = E.pts[i], c = E.pts[(i + 1) % E.pts.length];
    if (inStrip(a) && inStrip(c) && Math.abs(dF(a)) < 0.05 && Math.abs(dF(c)) < 0.05) continue;   // the entrance front: slope above
    if (inStrip(a) || inStrip(c)) {
      // south front under the slope's side: the wall top follows the slope (the white diagonal edge)
      const L = len2(sub2(c, a)), u: PlanPoint = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
      m = curtain(acc, a, c, PLINTH, TOP_E, m, 'skin', t => slopeY([a[0] + u[0] * t, a[1] + u[1] * t]));
      continue;
    }
    m = curtain(acc, a, c, PLINTH, TOP_E, m, 'skin');
  }

  // ---- the leaning glass plane, its frame grid and its white side edges ----
  {
    const lift = (p: PlanPoint): V3 => [p[0], slopeY(p), p[1]];
    const up: V3 = [-nIn[0] * (TOP_E - PLINTH), LEAN, -nIn[1] * (TOP_E - PLINTH)];
    for (let i = 1; i + 1 < stripRing.length; i++) triUp(acc, 'canopyGlass', lift(stripRing[0]), lift(stripRing[i]), lift(stripRing[i + 1]), up);
    // glazing bars: transoms at each storey line (level lines across the plane) and mullions every 3 m down the slope
    const side: V3 = [nIn[0], 0, nIn[1]];
    const lineAt = (y: number): [PlanPoint, PlanPoint] => {
      const dd = LEAN * (y - PLINTH) / (TOP_E - PLINTH);
      const q: PlanPoint = [P1[0] + nIn[0] * dd, P1[1] + nIn[1] * dd];
      const lo = meet(q, uFn, P1, uA), hi = meet(q, uFn, Sb, sub2(F3, Sb));
      return [lo, hi];
    };
    const nrm = Math.hypot(up[0], up[1], up[2]), o = 0.07;
    const off = (p: V3): V3 => [p[0] + up[0] / nrm * o, p[1] + up[1] / nrm * o, p[2] + up[2] / nrm * o];
    for (let k = 1; k < FLOORS; k++) {
      const y = PLINTH + k * STOREY;
      const [lo, hi] = lineAt(y);
      bar(acc, 'frame', off([lo[0], y, lo[1]]), off([hi[0], y, hi[1]]), side, 0.12);
    }
    const [b0, b1] = lineAt(PLINTH), [t0, t1] = lineAt(TOP_E);
    const Lb = len2(sub2(b1, b0));
    for (let s = 3; s < Lb - 0.5; s += 3) {
      const p = lerp2(b0, b1, s / Lb), q = lerp2(t0, t1, s / Lb);
      bar(acc, 'frame', off([p[0], PLINTH, p[1]]), off([q[0], TOP_E, q[1]]), [uFn[0], 0, uFn[1]], 0.12);
    }
    // white rims: the diagonal side edges and the foot
    bar(acc, 'white', off([b1[0], PLINTH, b1[1]]), off([t1[0], TOP_E, t1[1]]), [uFn[0], 0, uFn[1]], 0.3);
    bar(acc, 'white', off([b0[0], PLINTH, b0[1]]), off([t0[0], TOP_E, t0[1]]), [uFn[0], 0, uFn[1]], 0.3);
    bar(acc, 'white', off([b0[0], PLINTH + 0.1, b0[1]]), off([b1[0], PLINTH + 0.1, b1[1]]), side, 0.3);
  }

  // ---- roofs and crowns ----
  roofPoly(b, coreRing, TOP_E, 'slate');
  roofPoly(b, W.pts, TOP_W, 'slate');
  // crown band line: a silver coping round both roofs
  for (const [R, y] of [[W, TOP_W], [E, TOP_E]] as [Ring, number][]) for (let i = 0; i < R.pts.length; i++) {
    if (R.tags[i] !== 'wall') continue;
    const a = R.pts[i], c = R.pts[(i + 1) % R.pts.length], L = len2(sub2(c, a));
    if (R === E && (inStrip(a) || inStrip(c))) continue;
    if (L > 0.3) strip(acc, 'frame', a, c, 0.02, L - 0.02, y - 0.35, y, 0.3, 0);
  }

  // ---- entrance: broad steps up from the square in front of the slope's foot (w02) ----
  {
    const out: PlanPoint = [-nIn[0], -nIn[1]];
    for (let k = 0; k < 4; k++) {
      const d0 = 0.35 * (4 - k), y1 = 0.16 * (k + 1);
      const a: PlanPoint = [P1[0] + uFn[0] * 2.5 + out[0] * d0, P1[1] + uFn[1] * 2.5 + out[1] * d0];
      const c: PlanPoint = [P1[0] + uFn[0] * 11 + out[0] * d0, P1[1] + uFn[1] * 11 + out[1] * d0];
      const g = new T.BoxGeometry(8.5, y1, d0 + 0.05);
      g.rotateY(-Math.atan2(uFn[1], uFn[0]));
      g.translate((a[0] + c[0]) / 2 - out[0] * (d0 + 0.05) / 2 + out[0] * 0.025, y1 / 2, (a[1] + c[1]) / 2 - out[1] * (d0 + 0.05) / 2 + out[1] * 0.025);
      b.add(g, 'concrete');
    }
  }

  // ---- lettering ----
  // AkzoNobel in blue on the wedge's crown, on the W face toward the nose (Commons (4), (5), (1))
  {
    let best = -1, bl = 0;
    for (let i = 0; i < W.pts.length; i++) {
      if (W.tags[i] !== 'wall') continue;
      const a = W.pts[i], c = W.pts[(i + 1) % W.pts.length], n = edgeNormal(a, c), L = len2(sub2(c, a));
      if (n[0] < -0.8 && L > bl) { best = i; bl = L; }
    }
    const a = W.pts[best], c = W.pts[(best + 1) % W.pts.length], f = frameOn(a, c), px = 0.17;
    letters(b, f, 'AkzoNobel', bl * 0.62, OFFICE_TOP + 1.6, 0, px, 0.3, 'blue');
  }
  // and on the wedge's SE face crown toward the nose, over the entrance square (w02-147)
  {
    let best = -1, bl = 0;
    for (let i = 0; i < W.pts.length; i++) {
      if (W.tags[i] !== 'wall') continue;
      const a = W.pts[i], c = W.pts[(i + 1) % W.pts.length], n = edgeNormal(a, c), L = len2(sub2(c, a));
      if (n[0] > 0.3 && n[1] > 0.5 && L > bl) { best = i; bl = L; }
    }
    if (best >= 0) {
      const a = W.pts[best], c = W.pts[(best + 1) % W.pts.length];
      letters(b, frameOn(a, c), 'AkzoNobel', bl * 0.36, OFFICE_TOP + 1.6, 0, 0.17, 0.3, 'blue');
    }
  }
  // EARTH, white, round the wedge's first floor (w02-147, w03-286): once per long plinth edge
  for (let i = 0; i < W.pts.length; i++) {
    if (W.tags[i] !== 'wall') continue;
    const a = W.pts[i], c = W.pts[(i + 1) % W.pts.length], L = len2(sub2(c, a));
    if (L < 8) continue;
    const f = frameOn(a, c), k = Math.max(1, Math.floor(L / 8));
    for (let j = 0; j < k; j++) letters(b, f, 'EARTH', L * (j + 0.5) / k, 5.75, 0, 0.2, 0.06, 'white');
  }
  acc.flush();
}
