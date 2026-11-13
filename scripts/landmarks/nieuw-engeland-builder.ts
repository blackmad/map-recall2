import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, poly, setSink, slab, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {archRingOutline, frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import source from './nieuw-engeland-footprints.json' with {type: 'json'};

/**
 * Nieuw Engeland, Koningsplein 2-6 / Singel 466-468 (Rijksmonument 518360; A. Jacot and W. Oldewelt, opened
 * 23 September 1899 as the clothing store "Nieuw Engeland"; extended along the Koningsplein and the Singel in 1914 by
 * Jacot and A. Zinsmeister; nl.wikipedia "Nieuw Engeland (Amsterdam)", CC BY-SA 4.0). BAG pand 0363100012165080 also
 * holds Singel 466, the early-18th-century neck-gabled house next to it (Rijksmonument 5409), so that front is drawn
 * here too.
 *
 * Read from the Gemeente Amsterdam panoramas (CC BY 4.0; nieuw-engeland-inventory.json names each one) and the two
 * whole-face rectified crops (nieuw-engeland-crops.ts, 40 px/m; heights scaled by 1.04 so the 1899 mansard meets the
 * 3DBAG 21.0-21.9 m roofs behind it):
 *  - 1899 part (three 2.77 m bays on the Koningsplein, a 6.5 m and a 2.77 m bay on the Singel, the round corner):
 *    sandstone over a grey hardstone plinth; shop windows with sage-green iron frames and whiplash arcs; a cream frieze;
 *    first-floor windows with green fretwork transoms; round-arched second-floor windows (one great segmental arch of
 *    three lights in the wide Singel bay) with cream archivolts and iron rails; white art-nouveau cartouches on the
 *    piers; a third storey under the main cornice; a slate mansard with round-headed dormers. The narrow Singel bay
 *    rises as a square pavilion to the 24.3 m roof behind it.
 *  - the corner: BAG rounds it with a 2.3 m radius; three curved windows per storey and a deep round-arched entrance;
 *    over the cornice a drum with arched windows, a slate dome with lucarnes, an open lantern with a cast-iron
 *    balustrade, a small cupola and a finial (Wikipedia: "bekroond met een opengewerkte lantaarn en een gietijzeren
 *    balustrade").
 *  - 1914 parts: flat sandstone fronts with pilasters, relief panels under the windows, green-framed sashes, oriels
 *    (Koningsplein 11.6-15.8 m, Singel 19.8-23.8 m) and on the Koningsplein two raised end pavilions with attic windows.
 *  - Singel 466: dark painted brick, white sashes, white fascia over the shop, neck gable with white scrolls.
 *
 * Native frame of nieuw-engeland-footprints.json (x east, z south, y up from the 1.412 m NAP pavement). Massing: one
 * closed prism under every 3DBAG LoD2.2 roof piece (CC BY 4.0), except that the 1899 roofs are cut back to the main
 * cornice along the two fronts, where the mansard is swept along the front instead (roofs from the front, not 3DBAG).
 */
type C = 'stone' | 'ochre' | 'green' | 'glass' | 'slate' | 'concrete' | 'brick' | 'frame' | 'dark' | 'bronze';
type XZ = [number, number];
const SRC = source as unknown as {nativeRing: XZ[]; roofs: Record<string, number[][][]>};
const RING = SRC.nativeRing;
const ROOFS = SRC.roofs['0363100012165080'];
const OFF = 0.3;

// ---- the two street chords (ring vertices; outward normal n = (-tz, tx)) -------------------------------------------
const KP: Chord = {a: RING[7], b: RING[20]};    // Koningsplein, 25.72 m, s from the west party wall
const SG: Chord = {a: RING[29], b: RING[58]};   // Singel, 28.72 m, s from the corner
const len = (ch: Chord) => Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]);
const tan = (ch: Chord): XZ => [(ch.b[0] - ch.a[0]) / len(ch), (ch.b[1] - ch.a[1]) / len(ch)];
const nrm = (ch: Chord): XZ => { const t = tan(ch); return [-t[1], t[0]]; };
const at = (ch: Chord, s: number, o = 0): XZ => { const t = tan(ch), n = nrm(ch); return [ch.a[0] + t[0] * s + n[0] * o, ch.a[1] + t[1] * s + n[1] * o]; };
const proj = (ch: Chord, p: XZ) => { const t = tan(ch); return (p[0] - ch.a[0]) * t[0] + (p[1] - ch.a[1]) * t[1]; };
const dist = (ch: Chord, p: XZ) => { const n = nrm(ch); return -((p[0] - ch.a[0]) * n[0] + (p[1] - ch.a[1]) * n[1]); };

// ---- the round corner: circle fitted to BAG ring vertices 21-28 (centre 10.47, 5.11, radius 2.29) ----------------------
const ARC_C: XZ = [10.47, 5.11];
const ARC_D = (dist(KP, ARC_C) + dist(SG, ARC_C)) / 2;           // centre's distance behind both chords
const RC = ARC_D + OFF;                                         // curved front radius, flush with the chord fronts
const angOf = (v: XZ) => Math.atan2(v[1], v[0]);
const TH_K = angOf(nrm(KP)), TH_S = angOf(nrm(SG));            // the curved front runs from the Singel normal to the Koningsplein normal
const S_TK = proj(KP, ARC_C), S_TS = proj(SG, ARC_C);           // tangent points on the two chords
// drum over the cornice: radius 3.0, tangent to both fronts (centre on the corner bisector)
const DRUM_R = 3.0;
const BIS: XZ = (() => { const a = nrm(KP), b = nrm(SG), m: XZ = [a[0] + b[0], a[1] + b[1]], l = Math.hypot(...m); return [m[0] / l, m[1] / l]; })();
// the mansards stop where the drum takes over: 0.9 m short of its tangent point, where its face is 0.14 m behind the front
const DRUM_C: XZ = (() => { const k = (DRUM_R - OFF) - ARC_D; const cosHalf = BIS[0] * nrm(KP)[0] + BIS[1] * nrm(KP)[1]; return [ARC_C[0] - BIS[0] * k / cosHalf, ARC_C[1] - BIS[1] * k / cosHalf]; })();

// ---- measured heights (m above the pavement) ---------------------------------------------------------------------------
const BASE = -0.3;            // fronts start under the pavement datum (BAG ground varies a few cm)
const PLINTH = 0.6;
const SHOP = [PLINTH, 4.45];     // 1899 shop windows
const FRIEZE = [4.6, 5.6];       // cream frieze band
const F1 = [6.1, 9.3];           // first floor, green fretwork transoms
const F2 = [10.6, 14.0];         // round-arched second floor
const ENT = [14.25, 15.6];       // entablature over the arches
const F3 = [16.0, 18.0];         // third storey
const TOP99 = 18.6;              // wall top under the main cornice
const CORN = 0.5;                // main cornice height
const CLAMP = 18.75;             // 1899 roof pieces cut to this under the mansard (inside the cornice)
const MANS_TOP = 21.6;
const DRUM = [18.68, 22.3], DOME = [22.7, 25.7], LANTERN = [25.9, 27.3];

// ---- triangle sink -----------------------------------------------------------------------------------------------------
class Mesh {
  tris = new Map<C, number[]>();
  tri(c: C, a: number[], b: number[], d: number[], want: number[]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-10) return;
    const arr = this.tris.get(c) ?? [];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) arr.push(...a, ...b, ...d); else arr.push(...a, ...d, ...b);
    this.tris.set(c, arr);
  }
  quad(c: C, a: number[], b: number[], d: number[], e: number[], want: number[]) { this.tri(c, a, b, d, want); this.tri(c, a, d, e, want); }
  flush(b: BuildingTools) {
    for (const [c, pos] of this.tris) {
      if (!pos.length) continue;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c);
    }
    this.tris.clear();
  }
}
let M: Mesh;

/** Closed annular sector about centre c: radii r0..r1, angles a0..a1 (radians, x east / z south), heights y0..y1. */
function sector(c: C, ctr: XZ, r0: number, r1: number, a0: number, a1: number, y0: number, y1: number, maxStep = Math.PI / 24) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / maxStep));
  const P = (r: number, a: number, y: number) => [ctr[0] + r * Math.cos(a), y, ctr[1] + r * Math.sin(a)];
  for (let k = 0; k < n; k++) {
    const a = a0 + (a1 - a0) * k / n, b = a0 + (a1 - a0) * (k + 1) / n, m = (a + b) / 2, out = [Math.cos(m), 0, Math.sin(m)];
    M.quad(c, P(r1, a, y0), P(r1, b, y0), P(r1, b, y1), P(r1, a, y1), out);
    if (r0 > 1e-3) M.quad(c, P(r0, a, y0), P(r0, b, y0), P(r0, b, y1), P(r0, a, y1), [-out[0], 0, -out[2]]);
    M.quad(c, P(r0, a, y1), P(r1, a, y1), P(r1, b, y1), P(r0, b, y1), [0, 1, 0]);
    M.quad(c, P(r0, a, y0), P(r1, a, y0), P(r1, b, y0), P(r0, b, y0), [0, -1, 0]);
  }
  const full = Math.abs(Math.abs(a1 - a0) - 2 * Math.PI) < 1e-6;
  if (!full) for (const [a, sg] of [[a0, -1], [a1, 1]] as const) {
    const dir = Math.sign(a1 - a0) * sg, want = [-Math.sin(a) * dir, 0, Math.cos(a) * dir];
    M.quad(c, P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1), want);
  }
}
/** Closed lathe about ctr from a profile [r, y] whose first and last points lie on the axis. */
function lathe(c: C, ctr: XZ, prof: [number, number][], seg = 24) {
  for (let k = 0; k < seg; k++) {
    const a = 2 * Math.PI * k / seg, b = 2 * Math.PI * (k + 1) / seg, m = (a + b) / 2;
    const P = (r: number, y: number, t: number) => [ctr[0] + r * Math.cos(t), y, ctr[1] + r * Math.sin(t)];
    for (let i = 0; i + 1 < prof.length; i++) {
      const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
      // outward normal of the profile edge (dr, dy) is (dy, -dr) in (r, y)
      const want = [(y1 - y0) * Math.cos(m), -(r1 - r0), (y1 - y0) * Math.sin(m)];
      if (r0 < 1e-6) M.tri(c, P(0, y0, a), P(r1, y1, a), P(r1, y1, b), want);
      else if (r1 < 1e-6) M.tri(c, P(r0, y0, a), P(r0, y0, b), P(0, y1, a), want);
      else M.quad(c, P(r0, y0, a), P(r0, y0, b), P(r1, y1, b), P(r1, y1, a), want);
    }
  }
}
/** Closed prism over a convex plan polygon given in a wall frame as (t, o) pairs (o out of the wall). */
function planPrism(c: C, f: Frame, pts: [number, number][], y0: number, y1: number) {
  const W = (t: number, o: number): XZ => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
  const q = pts.map(([t, o]) => W(t, o)), cx = q.reduce((s, p) => s + p[0], 0) / q.length, cz = q.reduce((s, p) => s + p[1], 0) / q.length;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], r = q[(i + 1) % q.length], mx = (p[0] + r[0]) / 2 - cx, mz = (p[1] + r[1]) / 2 - cz;
    M.quad(c, [p[0], y0, p[1]], [r[0], y0, r[1]], [r[0], y1, r[1]], [p[0], y1, p[1]], [mx, 0, mz]);
    M.tri(c, [cx, y1, cz], [p[0], y1, p[1]], [r[0], y1, r[1]], [0, 1, 0]);
    M.tri(c, [cx, y0, cz], [p[0], y0, p[1]], [r[0], y0, r[1]], [0, -1, 0]);
  }
}
/** Round-headed outline (rectangle plus half-disc) of width w and total height h, bottom centre at (0, 0). */
const roundTop = (w: number, h: number, steps = 8): [number, number][] => {
  const r = w / 2, pts: [number, number][] = [[-r, 0], [r, 0]];
  for (let k = 0; k <= steps; k++) { const a = Math.PI * k / steps; pts.push([r * Math.cos(a), h - r + r * Math.sin(a)]); }
  return pts;
};

// ---- massing -------------------------------------------------------------------------------------------------------------
type Poly = [number, number][][];
const strip = (ch: Chord, s0: number, s1: number, oOut: number, oIn: number): Poly => [[at(ch, s0, oOut), at(ch, s1, oOut), at(ch, s1, oIn), at(ch, s0, oIn), at(ch, s0, oOut)]];
const circle = (c: XZ, r: number, n = 32): Poly => [[...Array.from({length: n}, (_, k) => [c[0] + r * Math.cos(2 * Math.PI * k / n), c[1] + r * Math.sin(2 * Math.PI * k / n)] as XZ), [c[0] + r, c[1]]]];
/** Plane through a roof piece (Newell normal), evaluated at (x, z). */
function planeY(piece: number[][]) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < piece.length; i++) { const p = piece[i], q = piece[(i + 1) % piece.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
  const c = piece.reduce((s, p) => [s[0] + p[0] / piece.length, s[1] + p[1] / piece.length, s[2] + p[2] / piece.length], [0, 0, 0]);
  return (x: number, z: number) => (Math.abs(ny) < 1e-9 ? c[1] : c[1] - (nx * (x - c[0]) + nz * (z - c[2])) / ny);
}
/** 1899 roof pieces: the Singel and Koningsplein flat roofs and the pieces of the corner (ids from the 3DBAG item order). */
const ORIG = new Set([2, 14, 15, 16, 17, 27, 28]);
const SINGEL466 = new Set([4, 6]);
function massing(b: BuildingTools) {
  const cut = polygonClipping.union(
    strip(KP, 15.79, S_TK + 4, 2, -2.8),
    strip(SG, S_TS - 4, 10.9, 2, -2.8),
    circle(DRUM_C, DRUM_R + 0.2),
  );
  ROOFS.forEach((piece, i) => {
    const ys = piece.map(p => p[1]);
    const roofCol = Math.max(...ys) - Math.min(...ys) > 0.6 ? 'slate' : 'concrete';
    const wall = SINGEL466.has(i) ? 'brick' : 'stone';
    if (!ORIG.has(i)) { roofPrism(b, [piece], wall, roofCol); return; }
    const ring: Poly = [[...piece.map(p => [p[0], p[2]] as XZ), [piece[0][0], piece[0][2]]]];
    const yOf = planeY(piece), corner = i !== 2 && i !== 14;
    const lift = (mp: ReturnType<typeof polygonClipping.union>, y: (x: number, z: number) => number) => {
      for (const pg of mp) roofPrism(b, pg.map(r => r.slice(0, -1).map(([x, z]) => [x, y(x, z), z])), wall, 'concrete');
    };
    lift(polygonClipping.intersection(ring, cut), () => CLAMP);
    lift(polygonClipping.difference(ring, cut), corner ? () => 21.3 : yOf);
  });
}

// ---- front helpers -------------------------------------------------------------------------------------------------------
type Ctx = {K: FrontKit; b: BuildingTools};
const ff = (c: Ctx, S: Sec, proud = 0) => c.K.faceFrame(S, proud);
/** Horizontal band (ledge) along a section: front and top faces, sunk into the wall. */
const band = (c: Ctx, S: Sec, y: number, h: number, d: number, col: C = 'stone', s0 = S.s0, s1 = S.s1) => ledgeStrip(c.b, ff(c, S), (s0 + s1) / 2, y, s1 - s0, h, d, col);
/** Solid box behind a raised front, from the chord back `depth`, so the raised part has a building behind it. */
/** Solid behind a raised front; its ends stand 5 cm inside the section ends so they never share a plane with an end cap. */
const backing = (c: Ctx, ch: Chord, s0: number, s1: number, y0: number, y1: number, depth = 3) => c.K.along(ch, s0 + 0.05, s1 - 0.05, [[-0.03, y0], [-0.03, y1], [-depth, y1], [-depth, y0]], 'stone');
/** Sage-green fretwork in the top band of an opening (vertical bars between the frame and the transom). */
function fret(c: Ctx, S: Sec, s: number, y: number, w: number, depth: number, n: number) {
  const f = ff(c, S);
  for (let k = 1; k < n; k++) ledgeStrip(c.b, f, s - w / 2 + w * k / n, y, 0.035, 0.75, 0.05, 'green', -depth + 0.06);
}
/** White art-nouveau cartouche on a pier: a tablet with a drop under it. */
function cartouche(c: Ctx, S: Sec, s: number, y: number) {
  const f = ff(c, S);
  slab(c.b, f, s, y, 0.42, 1.0, 0.1, 'ochre');
  slab(c.b, f, s, y - 0.55, 0.22, 0.55, 0.07, 'ochre');
}
/** Three-sided oriel standing on the wall plane (chord o = OFF), plan trapezoid of width w at the wall and `p` out. */
function oriel(c: Ctx, S: Sec, s: number, y0: number, y1: number, w: number, p: number, storeys: number) {
  const f = ff(c, S, -0.04), cut = p * 0.7, H = (y1 - y0) / storeys;
  planPrism('stone', f, [[s - w / 2, 0], [s + w / 2, 0], [s + w / 2 - cut, p], [s - w / 2 + cut, p]], y0, y1);
  // console under, cap over
  planPrism('stone', f, [[s - w / 2 + 0.2, 0], [s + w / 2 - 0.2, 0], [s + w / 2 - 0.2 - cut, p - 0.15], [s - w / 2 + 0.2 + cut, p - 0.15]], y0 - 0.55, y0 + 0.01);
  planPrism('slate', f, [[s - w / 2 - 0.08, 0], [s + w / 2 + 0.08, 0], [s + w / 2 + 0.08 - cut, p + 0.12], [s - w / 2 - 0.08 + cut, p + 0.12]], y1 - 0.01, y1 + 0.3);
  // glass on the three faces of every storey, 7 cm proud of each face
  const faces: [XZ, XZ][] = [[[s - w / 2, 0], [s - w / 2 + cut, p]], [[s - w / 2 + cut, p], [s + w / 2 - cut, p]], [[s + w / 2 - cut, p], [s + w / 2, 0]]];
  const W = (t: number, o: number): XZ => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
  const ctr = W(s, p / 2);
  for (let k = 0; k < storeys; k++) {
    const ya = y0 + k * H + 0.75, yb = y0 + (k + 1) * H - 0.3;
    for (const [A, B] of faces) {
      const a = W(A[0], A[1]), bb = W(B[0], B[1]), L = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
      const tt: XZ = [(bb[0] - a[0]) / L, (bb[1] - a[1]) / L];
      let n: XZ = [tt[1], -tt[0]];
      const mid: XZ = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2];
      if (n[0] * (mid[0] - ctr[0]) + n[1] * (mid[1] - ctr[1]) < 0) n = [-n[0], -n[1]];
      const fr: Frame = {origin: a, tangent: tt, n};
      // side panes stand 0.25 m clear of the wall and of the front corner, the front pane 0.14 m in from both corners
      const side = Math.abs(A[1] - B[1]) > 1e-6, i0 = side ? 0.25 : 0.14, i1 = i0;
      if (L - i0 - i1 < 0.3) continue;
      const tm = (i0 + L - i1) / 2, pw = L - i0 - i1;
      // side panes sit on their face (their ends would otherwise show inside the slanted stone), front panes 4 cm into it
      const o = side ? 0.02 : -0.04;
      slab(c.b, fr, tm, ya, pw, yb - ya, 0.11, 'glass', o);
      ledgeStrip(c.b, fr, tm, (ya + yb) / 2 + 0.25, pw, 0.06, 0.17, 'green', o);  // transom 6 cm proud of the glass
    }
  }
}
/** Round-headed dormer standing on the cornice, front at chord o = oFront. */
function dormer(c: Ctx, ch: Chord, s: number, y: number, oFront: number, w = 1.15, h = 1.9, depth = 1.7) {
  const f = frameAt(ch, 0, oFront);
  poly(c.b, f, s, y, roundTop(w, h), depth, 'ochre', -depth);
  poly(c.b, f, s, y + 0.25, roundTop(w - 0.4, h - 0.45), 0.13, 'glass', -0.06);
  poly(c.b, f, s, y + h - w / 2, archRingOutline(w + 0.1, w / 2 + 0.05, 0.12), depth + 0.08, 'slate', -depth);
}

// ---- 1899 storeys on a flat bay ------------------------------------------------------------------------------------------
type Bay = {s0: number; s1: number; kind: 'bay' | 'wide' | 'flank'};
function bay99(c: Ctx, S: Sec, bay: Bay, f3 = true) {
  const {K} = c, s = (bay.s0 + bay.s1) / 2, w = bay.s1 - bay.s0 - 0.16;
  // shop window with the green whiplash arc in its transom
  K.opening(S, s, SHOP[0], w, SHOP[1] - SHOP[0], {cols: bay.kind === 'wide' ? 4 : 2, frame: 'green', depth: 0.2, bars: [2.75], edge: 0.08});
  poly(c.b, ff(c, S, -0.2), s, SHOP[0] + 2.79, archRingOutline(w - 0.3, Math.min(0.95, (w - 0.3) / 2), 0.07, 10), 0.05, 'green');
  // first floor: tall lights under a green fretwork transom
  K.opening(S, s, F1[0], w - 0.1, F1[1] - F1[0], {cols: bay.kind === 'wide' ? 3 : 2, frame: 'green', depth: 0.2, bars: [2.35], edge: 0.08});
  fret(c, S, s, F1[0] + 2.4, w - 0.1, 0.22, bay.kind === 'wide' ? 12 : 6);
  // second floor: round arch (segmental over the wide Singel bay) with an archivolt and an iron rail across the sill
  if (bay.kind === 'wide') {
    const ww = w - 0.4, rise = 0.95;
    K.opening(S, s, F2[0], ww, F2[1] - F2[0], {cols: 3, frame: 'green', depth: 0.2, rise, bars: [1.7], edge: 0.08});
    K.archHead(S, s, F2[1] - rise, ww, rise, 0.32, 0.12, 'ochre');
    ledgeStrip(c.b, ff(c, S), s, F2[0] + 0.85, ww, 0.07, 0.07, 'green', -0.03);
  } else {
    const ww = Math.min(w - 0.25, 2.3);
    K.opening(S, s, F2[0], ww, F2[1] - F2[0], {cols: 2, frame: 'green', depth: 0.2, rise: ww / 2, bars: [1.55], edge: 0.08});
    K.archHead(S, s, F2[1] - ww / 2, ww, ww / 2, 0.3, 0.12, 'ochre');
    ledgeStrip(c.b, ff(c, S), s, F2[0] + 0.85, ww, 0.07, 0.07, 'green', -0.03);
  }
  if (!f3) return;
  // third storey: wide transomed windows; the tower's flank bays carry a pair of round-headed lights
  if (bay.kind === 'flank') {
    for (const d of [-0.55, 0.55]) K.opening(S, s + d, F3[0], 0.85, F3[1] - F3[0] + 0.2, {cols: 1, rows: 2, frame: 'green', depth: 0.2, rise: 0.425, edge: 0.07});
    K.archHead(S, s, F3[1] + 0.2 - 1.1, 2.2, 1.1, 0.22, 0.1, 'ochre');
  } else if (bay.kind === 'wide') {
    for (const d of [-2.0, 0, 2.0]) K.opening(S, s + d, F3[0], 1.55, F3[1] - F3[0], {cols: 2, rows: 2, frame: 'green', depth: 0.2, edge: 0.07});
  } else {
    K.opening(S, s, F3[0], w - 0.45, F3[1] - F3[0], {cols: 3, rows: 2, frame: 'green', depth: 0.2, edge: 0.07});
  }
}
/** Bands, plinth and pier ornaments shared by every 1899 section. */
function bands99(c: Ctx, S: Sec, piers: number[]) {
  slab(c.b, ff(c, S), (S.s0 + S.s1) / 2, BASE, S.s1 - S.s0, PLINTH - 0.04 - BASE, 0.08, 'concrete');
  band(c, S, SHOP[1] + 0.02, 0.13, 0.14);
  slab(c.b, ff(c, S), (S.s0 + S.s1) / 2, FRIEZE[0], S.s1 - S.s0, FRIEZE[1] - FRIEZE[0], 0.08, 'ochre');
  band(c, S, F1[1] + 0.05, 0.16, 0.16);
  slab(c.b, ff(c, S), (S.s0 + S.s1) / 2, ENT[0], S.s1 - S.s0, ENT[1] - ENT[0], 0.07, 'stone');
  band(c, S, ENT[1], 0.22, 0.3);
  for (const p of piers) cartouche(c, S, p, F1[1] + 0.3);
}

// ---- the fronts ------------------------------------------------------------------------------------------------------------
function koningsplein(c: Ctx) {
  const {K} = c;
  // 1914: left pavilion, middle, right pavilion (crop axes 2.26, 4.24, 5.85, 7.5, 9.47 m)
  const parts: [number, number, number][] = [[0, 3.25, 23.1], [3.25, 8.3, 21.8], [8.3, 11.6, 23.1]];
  for (const [s0, s1, top] of parts) {
    const S = K.sec(KP, s0, s1, BASE, top, 'stone');
    const axes = [2.26, 4.24, 5.85, 7.5, 9.47].filter(a => a > s0 && a < s1);
    for (const a of axes) {
      K.opening(S, a, 6.0, 1.35, 2.6, {cols: 2, frame: 'green', depth: 0.2, edge: 0.07});
      ledgeStrip(c.b, ff(c, S), a, 6.45, 1.35, 0.06, 0.07, 'green', -0.03);
      for (const [y0, y1] of [[9.9, 12.5], [13.8, 16.1], [17.4, 19.3]]) {
        K.opening(S, a, y0, 1.13, y1 - y0, {cols: 2, rows: 2, frame: 'green', depth: 0.18, edge: 0.07});
        if (y0 > 12) { slab(c.b, ff(c, S), a, y0 - 0.85, 0.95, 0.55, 0.06, 'stone'); slab(c.b, ff(c, S), a, y0 - 0.73, 0.4, 0.3, 0.11, 'stone'); }
      }
      if (top > 22) K.opening(S, a, 20.8, 0.9, 1.1, {cols: 2, frame: 'green', depth: 0.16, edge: 0.06});
    }
    // ground floor: the door in the left pavilion, shop windows in the others (w01-153 crop)
    if (s0 === 0) K.opening(S, 1.6, 0, 1.9, 3.2, {cols: 2, frame: 'green', back: 'dark', depth: 0.2, bars: [2.4], edge: 0.08});
    else {
      K.opening(S, s0 === 3.25 ? 5.72 : 9.9, 0.5, s0 === 3.25 ? 4.5 : 2.6, 3.9, {cols: s0 === 3.25 ? 4 : 2, frame: 'green', depth: 0.2, bars: [2.9], edge: 0.08});
      slab(c.b, ff(c, S), (s0 + s1) / 2, BASE, s1 - s0, 0.46 - BASE, 0.08, 'concrete');
    }
    band(c, S, 4.55, 0.15, 0.14);
    band(c, S, 9.15, 0.3, 0.22);
    band(c, S, 20.1, 0.22, 0.14);
    K.coping(S, top, 0.35, 0.18, 'stone');
    if (top > 22) backing(c, KP, s0, s1, 19.0, top + 0.1);
  }
  // pilasters between the axes, over the cornice band (on the shared Koningsplein face plane)
  const kf = frameAt(KP, 0, OFF);
  for (const p of [0.3, 3.25, 5.05, 6.68, 8.49, 11.3]) slab(c.b, kf, p, 9.45, 0.42, 10.6, 0.08, 'stone');
  K.endCap(KP, 3.25, 21.8, 23.1, 'stone', -1, -0.02);
  K.endCap(KP, 8.3, 21.8, 23.1, 'stone', 1, -0.02);
  // B: the narrow 1914 bay with its oriel
  {
    const S = K.sec(KP, 11.6, 15.82, BASE, 23.1, 'stone');
    K.opening(S, 13.71, 0, 3.0, 4.2, {cols: 3, frame: 'green', depth: 0.2, bars: [3.1], edge: 0.08});
    K.opening(S, 13.71, 6.3, 2.6, 2.0, {cols: 3, frame: 'green', depth: 0.2, edge: 0.07});
    oriel(c, S, 13.71, 10.6, 16.1, 3.0, 0.7, 2);
    for (const [y0, y1] of [[16.6, 18.4], [19.6, 21.4]]) for (const [d, w] of [[-1.05, 0.55], [0, 1.2], [1.05, 0.55]]) K.opening(S, 13.71 + d, y0, w, y1 - y0, {cols: w > 1 ? 2 : 1, rows: 2, frame: 'green', depth: 0.18, edge: 0.06});
    band(c, S, 9.15, 0.3, 0.22);
    K.coping(S, 23.1, 0.35, 0.18, 'stone');
    backing(c, KP, 11.6, 15.82, 18.0, 23.2);
    K.endCap(KP, 15.82, TOP99, 23.1, 'stone', 1, -0.02);
  }
  // 1899: three bays to the corner (piers at 18.59-19.10, 21.86-22.37, 25.14-)
  {
    const S = K.sec(KP, 15.82, S_TK, BASE, TOP99, 'stone');
    const bays: Bay[] = [{s0: 15.82, s1: 18.59, kind: 'bay'}, {s0: 19.10, s1: 21.86, kind: 'bay'}, {s0: 22.37, s1: 25.14, kind: 'flank'}];
    for (const bb of bays) bay99(c, S, bb);
    bands99(c, S, [18.845, 22.115]);
    K.coping(S, TOP99, CORN, 0.55, 'stone', 15.82, S_TK);
    K.endCap(KP, S_TK, 0, TOP99, 'stone', 1, -0.02);
    K.along(KP, 15.80, proj(KP, DRUM_C) - 0.9, [[0.15, CLAMP - 0.05], [0.15, TOP99 + CORN + 0.12], [-1.45, MANS_TOP], [-2.9, MANS_TOP], [-2.9, CLAMP - 0.05]], 'slate');
    for (const d of [17.2, 20.48]) dormer(c, KP, d, TOP99 + CORN, 0.35);
  }
  // left end of the Koningsplein front against the party wall of Koningsplein 8
  K.endCap(KP, 0.04, 0, 23.1, 'stone', -1, -0.02);  // 4 cm in: the party wall runs 2 degrees off square
}
function singel(c: Ctx) {
  const {K} = c;
  // 1899: flank bay and wide bay under the cornice and mansard
  {
    const S = K.sec(SG, S_TS, 10.6, BASE, TOP99, 'stone');
    bay99(c, S, {s0: 0.58, s1: 3.32, kind: 'flank'});
    bay99(c, S, {s0: 3.83, s1: 10.33, kind: 'wide'});
    bands99(c, S, [3.575, 10.59]);
    K.coping(S, TOP99, CORN, 0.55, 'stone', S_TS, 10.6);
    K.endCap(SG, S_TS, 0, TOP99, 'stone', -1, -0.02);
    K.along(SG, proj(SG, DRUM_C) + 0.9, 10.9, [[0.15, CLAMP - 0.05], [0.15, TOP99 + CORN + 0.12], [-1.45, MANS_TOP], [-2.9, MANS_TOP], [-2.9, CLAMP - 0.05]], 'slate');
    for (const d of [5.55, 8.6]) dormer(c, SG, d, TOP99 + CORN, 0.35);
  }
  // 1899 narrow bay rising as a pavilion to the 24.3 m roof behind it
  {
    const top = 24.5, S = K.sec(SG, 10.6, 13.87, BASE, top, 'stone');
    bay99(c, S, {s0: 10.85, s1: 13.61, kind: 'bay'});
    bands99(c, S, []);
    band(c, S, TOP99, 0.4, 0.4);
    for (const [y0, y1] of [[19.4, 20.9], [21.9, 23.4]]) K.opening(S, 12.23, y0, 1.25, y1 - y0, {cols: 2, rows: 2, frame: 'green', depth: 0.18, edge: 0.06});
    K.coping(S, top, 0.35, 0.2, 'stone');
    backing(c, SG, 10.6, 13.87, 18.0, top + 0.1);
    K.endCap(SG, 10.6, TOP99 + CORN, top, 'stone', -1, -0.02);
    K.endCap(SG, 13.87, 21.3, top, 'stone', 1, -0.02);
  }
  // 1914: middle bay and oriel bay
  {
    const top = 21.3, S = K.sec(SG, 13.87, 24.4, BASE, top, 'stone');
    K.opening(S, 16.37, 0.5, 4.1, 3.6, {cols: 3, frame: 'green', depth: 0.2, bars: [2.8], edge: 0.08});
    K.opening(S, 21.79, 0.5, 3.6, 3.6, {cols: 3, frame: 'green', depth: 0.2, bars: [2.8], edge: 0.08});
    K.opening(S, 16.37, 5.1, 3.6, 3.3, {cols: 3, rows: 2, frame: 'green', depth: 0.2, edge: 0.07});
    K.opening(S, 16.37, 9.4, 3.6, 3.5, {cols: 3, rows: 2, frame: 'green', depth: 0.2, edge: 0.07});
    for (const [y0, y1] of [[14.6, 16.7], [18.2, 20.0]]) {
      for (const d of [-0.95, 0.95]) K.opening(S, 16.37 + d, y0, 1.5, y1 - y0, {cols: 2, rows: 2, frame: 'green', depth: 0.18, edge: 0.06});
      for (const [d, w] of [[-1.15, 0.7], [0, 1.4], [1.15, 0.7]]) K.opening(S, 21.79 + d, y0, w, y1 - y0, {cols: w > 1 ? 2 : 1, rows: 2, frame: 'green', depth: 0.18, edge: 0.06});
      slab(c.b, ff(c, S), 16.37, y0 - 0.8, 3.0, 0.5, 0.06, 'stone');
    }
    oriel(c, S, 21.79, 5.2, 13.9, 3.3, 0.8, 3);
    slab(c.b, ff(c, S), (13.87 + 24.4) / 2, BASE, 24.4 - 13.87, 0.46 - BASE, 0.08, 'concrete');
    band(c, S, 4.35, 0.3, 0.2);
    band(c, S, 14.25, 0.25, 0.16);
    for (const p of [14.12, 19.22, 24.1]) slab(c.b, ff(c, S), p, 4.65, 0.5, top - 4.7, 0.08, 'stone');
    K.coping(S, top, 0.3, 0.18, 'stone');
    K.endCap(SG, 24.4, 12.3, top, 'stone', 1, -0.02);
    for (const d of [16.37, 21.79]) dormer(c, SG, d, top + 0.3, -0.05, 1.2, 1.5, 2.2);
  }
  // Singel 466: dark brick, white sashes, neck gable
  {
    const s0 = 24.4, s1 = len(SG), mid = (24.66 + s1) / 2, body = 12.3, S = K.sec(SG, s0, s1, BASE, body, 'brick');
    K.opening(S, mid, 0.45, 3.3, 2.95, {cols: 3, frame: 'frame', depth: 0.2, edge: 0.08});
    slab(c.b, ff(c, S), mid, 3.45, 3.7, 0.6, 0.1, 'ochre');
    for (const [y0, y1] of [[4.4, 6.9], [7.7, 9.4], [10.5, 11.6]]) for (const d of [-0.9, 0.9]) {
      K.opening(S, mid + d, y0, 1.05, y1 - y0, {cols: 2, rows: 2, frame: 'frame', depth: 0.16, edge: 0.07});
      slab(c.b, ff(c, S), mid + d, y0 - 0.15, 1.2, 0.12, 0.08, 'ochre');  // sill 3 cm under the reveal floor
    }
    slab(c.b, ff(c, S), mid, BASE, s1 - s0, 0.41 - BASE, 0.06, 'concrete');
    K.coping(S, body, 0.25, 0.14, 'ochre');
    K.endCap(SG, s1 - 0.04, 0, body, 'brick', 1, -0.02);  // 4 cm in: the party wall runs 2 degrees off square
    const f = ff(c, S, -0.3), fFace = ff(c, S), y = body + 0.25, nh = 3.2, hw = 1.0;
    poly(c.b, f, mid, y, [[-hw, 0], [hw, 0], [hw, nh], [-hw, nh]], 0.3, 'brick');
    for (const sg of [-1, 1]) poly(c.b, f, mid, y, [[sg * hw, 0], [sg * 1.95, 0], [sg * 1.75, 0.5], [sg * 1.35, 1.1], [sg * hw, 2.0]], 0.42, 'ochre');
    poly(c.b, f, mid, y + nh, [[-hw - 0.15, 0], [hw + 0.15, 0], [hw + 0.15, 0.18], [0, 0.6], [-hw - 0.15, 0.18]], 0.45, 'ochre');
    slab(c.b, fFace, mid, y + 0.65, 1.0, 1.4, 0.07, 'ochre');
    slab(c.b, fFace, mid, y + 0.75, 0.8, 1.2, 0.11, 'glass');
    ledgeStrip(c.b, fFace, mid, y + 1.35, 0.8, 0.05, 0.14, 'frame');
  }
}

// ---- the round corner and the tower --------------------------------------------------------------------------------------
/**
 * The round corner as five flat facets on the BAG arc (window, pier, portal, pier, window; face widths below), so every
 * window and the portal stand in a plane wall at least 1 m wide that frames them, and every band and the cornice turn
 * with the corner. Travel runs from the Koningsplein (TH_K) to the Singel (TH_S), the outward normal on the left.
 */
const CW = [1.1, 0.38, 1.7, 0.38, 1.1];
const CORNER_ANG = (() => { const tot = CW.reduce((x, y) => x + y, 0), out = [TH_K]; let acc = 0; for (const w of CW) { acc += w; out.push(TH_K + (TH_S - TH_K) * acc / tot); } return out; })();
const onArc = (ctr: XZ, r: number, a: number): XZ => [ctr[0] + r * Math.cos(a), ctr[1] + r * Math.sin(a)];
/** Chord whose face (OFF outside) runs exactly from A to B. */
function faceChord(A: XZ, B: XZ): Chord {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), t: XZ = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n: XZ = [-t[1], t[0]];
  return {a: [A[0] - n[0] * OFF, A[1] - n[1] * OFF], b: [B[0] - n[0] * OFF, B[1] - n[1] * OFF]};
}
function corner(c: Ctx) {
  const {K} = c;
  for (let k = 0; k < CW.length; k++) {
    const ch = faceChord(onArc(ARC_C, RC, CORNER_ANG[k]), onArc(ARC_C, RC, CORNER_ANG[k + 1])), L = len(ch), m = L / 2;
    const S = K.sec(ch, 0, L, BASE, TOP99, 'stone'), win = k % 2 === 0, portal = k === 2, w = L - 0.22;
    if (win) {
      if (portal) {
        K.opening(S, m, 0, w, 4.15, {cols: 2, frame: 'green', depth: 0.15, rise: w / 2, bars: [2.6], edge: 0.08});
        K.archHead(S, m, 4.15 - w / 2, w, w / 2, 0.28, 0.16, 'ochre');
      } else {
        K.opening(S, m, SHOP[0], w, SHOP[1] - SHOP[0], {cols: 1, frame: 'green', depth: 0.15, bars: [2.75], edge: 0.08});
      }
      K.opening(S, m, F1[0], w, F1[1] - F1[0], {cols: 2, frame: 'green', depth: 0.15, bars: [2.35], edge: 0.08});
      fret(c, S, m, F1[0] + 2.4, w, 0.15, 4);
      K.opening(S, m, F2[0], w, F2[1] - F2[0], {cols: 2, frame: 'green', depth: 0.15, rise: w / 2, bars: [1.55], edge: 0.08});
      K.archHead(S, m, F2[1] - w / 2, w, w / 2, 0.24, 0.12, 'ochre');
      ledgeStrip(c.b, ff(c, S), m, F2[0] + 0.85, w, 0.07, 0.07, 'green', -0.03);
      K.opening(S, m, F3[0], w - 0.1, F3[1] - F3[0] + 0.2, {cols: 1, rows: 2, frame: 'green', depth: 0.15, rise: (w - 0.1) / 2, edge: 0.07});
    } else cartouche(c, S, m, F1[1] + 0.3);
    // bands reach 0.25 m past each facet so the convex joints stay closed
    // tops step 4 cm facet to facet (and 4 cm over the straight fronts) so the overlaps at the joints never share a plane
    const lift = k % 2 ? 0.08 : 0.04;
    const ext = (y: number, h: number, d: number, col: C = 'stone') => ledgeStrip(c.b, ff(c, S), m, y, L + 0.5, h + lift, d, col);
    slab(c.b, ff(c, S), m, BASE, L + 0.16, (portal ? -0.02 : PLINTH - 0.04) - BASE, 0.08, 'concrete');
    ext(SHOP[1] + 0.02, 0.13, 0.14);
    if (!portal) slab(c.b, ff(c, S), m, FRIEZE[0], L + 0.12, FRIEZE[1] - FRIEZE[0], 0.08, 'ochre');
    else { slab(c.b, ff(c, S), m, 4.7, L + 0.12, FRIEZE[1] - 4.7, 0.08, 'ochre'); }
    ext(F1[1] + 0.05, 0.16, 0.16);
    slab(c.b, ff(c, S), m, ENT[0], L + 0.12, ENT[1] - ENT[0], 0.07, 'stone');
    ext(ENT[1], 0.22, 0.3);
    K.coping(S, TOP99, CORN + lift, 0.55, 'stone', -0.3, L + 0.3);
  }

  // tower over the cornice: octagonal drum with a round-headed window in every face, cornice ring, dome, lucarnes,
  // open lantern with its balustrade, cupola and finial
  const D = DRUM_C, R = DRUM_R, bis = angOf(BIS), inR = R * Math.cos(Math.PI / 8);
  lathe('stone', D, [[0, DRUM[0]], [inR - OFF - 0.02, DRUM[0]], [inR - OFF - 0.02, DRUM[1] - 0.01], [0, DRUM[1] - 0.01]], 16);
  for (let k = 0; k < 8; k++) {
    const a0 = bis + Math.PI / 8 - k * Math.PI / 4, a1 = a0 - Math.PI / 4;
    const ch = faceChord(onArc(D, R, a0), onArc(D, R, a1)), L = len(ch), S = K.sec(ch, 0, L, DRUM[0], DRUM[1], 'stone');
    ledgeStrip(c.b, ff(c, S), L / 2, 19.3, L + 0.4, 0.14 + (k % 2) * 0.04, 0.16, 'stone');
    // the two faces square to the fronts look straight into the mansards that abut the drum: blind there
    if (k === 2 || k === 6) continue;
    K.opening(S, L / 2, 19.55, 1.0, 1.85, {cols: 2, frame: 'green', depth: 0.15, rise: 0.5, edge: 0.07});
    K.archHead(S, L / 2, 19.55 + 1.85 - 0.5, 1.0, 0.5, 0.2, 0.12, 'ochre');
  }
  lathe('stone', D, [[0, DRUM[0] + 0.33], [R + 0.12, DRUM[0] + 0.33], [R + 0.12, DRUM[0] + 0.56], [0, DRUM[0] + 0.56]], 32);
  lathe('stone', D, [[0, DRUM[1] - 0.02], [R + 0.35, DRUM[1] - 0.02], [R + 0.35, DRUM[1] + 0.22], [R + 0.15, DOME[0]], [0, DOME[0]]], 32);
  const prof: [number, number][] = [[0, DOME[0] - 0.1]];
  for (let k = 0; k <= 8; k++) { const ph = (Math.PI / 2) * k / 8; prof.push([0.95 + (R - 0.05 - 0.95) * Math.cos(ph), DOME[0] + (DOME[1] - DOME[0]) * Math.sin(ph)]); }
  prof.push([0, DOME[1]]);
  lathe('slate', D, prof, 32);
  for (const a of [TH_K, TH_S, bis, bis + Math.PI]) {
    const r = 0.95 + (R - 1.0) * Math.cos(Math.asin(0.35)), fr: Frame = {origin: [D[0] + Math.cos(a) * r, D[1] + Math.sin(a) * r], tangent: [-Math.sin(a), Math.cos(a)], n: [Math.cos(a), Math.sin(a)]};
    poly(c.b, fr, 0, DOME[0] + 0.8, roundTop(0.75, 1.15), 0.95, 'ochre', -0.6);
    poly(c.b, fr, 0, DOME[0] + 1.0, roundTop(0.42, 0.75), 0.11, 'glass', 0.31);
  }
  lathe('stone', D, [[0, DOME[1] - 0.05], [1.1, DOME[1] - 0.05], [1.1, LANTERN[0]], [0, LANTERN[0]]], 16);
  lathe('bronze', D, [[0, LANTERN[0] - 0.01], [0.6, LANTERN[0] - 0.01], [0.6, LANTERN[1] + 0.01], [0, LANTERN[1] + 0.01]], 12);
  for (let k = 0; k < 8; k++) { const a = 2 * Math.PI * k / 8; sector('bronze', D, 0.66, 0.84, a - 0.09, a + 0.09, LANTERN[0] - 0.02, LANTERN[1] + 0.02); }
  for (let k = 0; k < 16; k++) { const a = 2 * Math.PI * k / 16; sector('bronze', D, 1.0, 1.06, a - 0.025, a + 0.025, LANTERN[0] - 0.02, LANTERN[0] + 0.56); }
  sector('bronze', D, 0.97, 1.09, 0, 2 * Math.PI, LANTERN[0] + 0.55, LANTERN[0] + 0.62);
  lathe('bronze', D, [[0, LANTERN[1]], [0.98, LANTERN[1]], [0.98, LANTERN[1] + 0.16], [0, LANTERN[1] + 0.16]], 16);
  lathe('slate', D, [[0, LANTERN[1] + 0.15], [0.78, LANTERN[1] + 0.15], [0.62, LANTERN[1] + 0.5], [0.3, LANTERN[1] + 0.8], [0, LANTERN[1] + 0.92]], 16);
  lathe('bronze', D, [[0, LANTERN[1] + 0.85], [0.07, LANTERN[1] + 0.9], [0.05, LANTERN[1] + 1.35], [0.15, LANTERN[1] + 1.45], [0.04, LANTERN[1] + 1.6], [0.025, LANTERN[1] + 2.0], [0, LANTERN[1] + 2.05]], 8);
}

export function buildNieuwEngeland(_w: number, _d: number, b: BuildingTools) {
  M = new Mesh();
  setSink(0.04, true);
  try {
    massing(b);
    const K = makeFrontKit(b, OFF);
    const c: Ctx = {K, b};
    koningsplein(c);
    singel(c);
    corner(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
