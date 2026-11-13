/**
 * A smooth curved street front through the bay junctions of a faceted BAG outline, with an arc-length frame and a
 * profile sweep along it.
 *
 * Why (2026-11-12, Raadhuisstraat gallery lane): the Winkelgalerij on the Raadhuisstraat (Rijksmonument 46505,
 * A.L. van Gendt for the life insurer "Utrecht", 1898) follows the S-bend of the 1894 street break-through: "in boogvormig
 * gebouwde reeks winkelwoningen" under a roof "evenwijdig met de gebogen rooilijn". BAG draws that curve as one 5.8 m
 * chord per house with 0.1-0.3 m jogs at every pier. The kit only places straight slabs on wall frames, so a long front
 * came out as a row of facets with kinks in every cornice, balcony rail and gallery roof. This component fits a
 * centripetal Catmull-Rom curve through the chord junctions (it passes through every junction, so it stays on the BAG
 * line; between junctions it bows out by the arc's sagitta, a few centimetres), gives a position, tangent and outward
 * normal at any arc length, and sweeps a 2D profile (out, up) along it so horizontal members bend with the street.
 *
 * Pure plan geometry in native metres (x east, z south), no three.js.
 */
export type XZ = [number, number];
export type FrontPoint = {p: XZ; t: XZ; n: XZ};

export interface CurvedFrontOptions {
  /** Outward side of travel: +1 when the outward normal is (tz, -tx) (street to the left of travel in x-east/z-south), -1 for the other side. */
  side?: 1 | -1;
  /** Dense sampling step along the curve, metres (default 0.1). */
  step?: number;
}

export interface CurvedFront {
  length: number;
  /** Position, unit tangent (direction of increasing s) and unit outward normal at arc length s (clamped to 0..length). */
  at(s: number): FrontPoint;
  /** Arc lengths from s0 to s1 (inclusive) at most `maxStep` apart, always including both ends and every `breaks` value in between. */
  stations(s0: number, s1: number, maxStep: number, breaks?: number[]): number[];
  /** Arc length of the curve point nearest to p. */
  project(p: XZ): number;
  /** Arc length of each junction the curve was fitted through. */
  junctionS: number[];
}

/**
 * Bay junctions of a faceted front: `polyline` is the BAG outline's run along the street, `minChord` the shortest
 * segment that counts as a facade chord. The vertices between two chords (a pier jog of a few short segments, spanning
 * less than `maxJog`) collapse to their mean; longer runs of short segments are real geometry and are kept, as are
 * the vertices before the first chord and after the last.
 */
export function chordJunctions(polyline: XZ[], minChord = 3, maxJog = 1): XZ[] {
  if (polyline.length < 2) throw Error('chordJunctions: need at least two points');
  const len = (i: number) => Math.hypot(polyline[i + 1][0] - polyline[i][0], polyline[i + 1][1] - polyline[i][1]);
  const longs: number[] = [];
  for (let i = 0; i + 1 < polyline.length; i++) if (len(i) >= minChord) longs.push(i);
  if (!longs.length) return polyline.slice();
  const out: XZ[] = polyline.slice(0, longs[0] + 1);
  for (let k = 0; k < longs.length; k++) {
    const end = longs[k] + 1, next = k + 1 < longs.length ? longs[k + 1] : polyline.length - 1;
    const gap = polyline.slice(end, next + 1);
    const ext = Math.hypot(gap[gap.length - 1][0] - gap[0][0], gap[gap.length - 1][1] - gap[0][1]);
    if (k + 1 < longs.length && ext < maxJog) out.push([gap.reduce((s, q) => s + q[0], 0) / gap.length, gap.reduce((s, q) => s + q[1], 0) / gap.length]);
    else out.push(...gap);
  }
  return out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 0.01);
}

/** Centripetal Catmull-Rom curve through `junctions` (at least two). */
export function curvedFront(junctions: XZ[], opts: CurvedFrontOptions = {}): CurvedFront {
  if (junctions.length < 2) throw Error('curvedFront: need at least two junctions');
  const side = opts.side ?? 1, step = opts.step ?? 0.1;
  const P = junctions;
  const ext = (a: XZ, b: XZ): XZ => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  const pts: XZ[] = [ext(P[0], P[1]), ...P, ext(P[P.length - 1], P[P.length - 2])];
  const dense: XZ[] = [];
  const jIdx: number[] = [];
  for (let i = 1; i + 2 < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const tj = (a: XZ, b: XZ) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    if (i === 1) { jIdx.push(0); dense.push(p1); }
    for (let k = 1; k <= n; k++) {
      const t = t1 + (t2 - t1) * k / n;
      const L = (a: XZ, b: XZ, ta: number, tb: number): XZ => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      dense.push(k === n ? p2 : L(B1, B2, t1, t2));
    }
    jIdx.push(dense.length - 1);
  }
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const length = cum[cum.length - 1];
  const seg = (s: number) => {
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    return lo;
  };
  const tangentAt = (i: number): XZ => {
    const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  };
  const at = (sIn: number): FrontPoint => {
    const s = Math.max(0, Math.min(length, sIn)), i = seg(s), j = Math.min(i + 1, dense.length - 1);
    const u = cum[j] > cum[i] ? (s - cum[i]) / (cum[j] - cum[i]) : 0;
    const p: XZ = [dense[i][0] + (dense[j][0] - dense[i][0]) * u, dense[i][1] + (dense[j][1] - dense[i][1]) * u];
    const ta = tangentAt(i), tb = tangentAt(j);
    let tx = ta[0] + (tb[0] - ta[0]) * u, tz = ta[1] + (tb[1] - ta[1]) * u;
    const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    return {p, t: [tx, tz], n: [side * tz, -side * tx]};
  };
  const stations = (s0: number, s1: number, maxStep: number, breaks: number[] = []) => {
    const a = Math.min(s0, s1), b = Math.max(s0, s1);
    const n = Math.max(1, Math.ceil((b - a) / maxStep));
    const out = new Set<number>();
    for (let k = 0; k <= n; k++) out.add(+(a + (b - a) * k / n).toFixed(6));
    for (const x of breaks) if (x > a && x < b) out.add(+x.toFixed(6));
    const arr = [...out].sort((x, y) => x - y);
    return s0 <= s1 ? arr : arr.reverse();
  };
  const project = (p: XZ) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i + 1 < dense.length; i++) {
      const a = dense[i], b = dense[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
      const d = Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dz);
      if (d < bd) { bd = d; best = cum[i] + u * (cum[i + 1] - cum[i]); }
    }
    return best;
  };
  return {length, at, stations, project, junctionS: jIdx.map(i => cum[i])};
}

/** A point of a swept profile: `o` out of the front (metres, + = the outward normal's side), `y` up. */
export type ProfilePoint = [number, number];

/**
 * Triangles (flat xyz list, three vertices per triangle) of `profile` swept along the front from s0 to s1.
 * Each profile edge q[k] -> q[k+1] becomes a strip of quads facing the edge's right-hand side in (o, y) (o to the right,
 * y up), so a profile listed counter-clockwise is an outward-facing tube whatever the curve's direction or `side`.
 * `closed` joins the last point back to the first; `caps` closes both ends with fans (convex profiles only).
 */
export function sweepProfile(front: CurvedFront, s0: number, s1: number, profile: ProfilePoint[], o: {maxStep?: number; closed?: boolean; caps?: boolean; breaks?: number[]} = {}): number[] {
  if (profile.length < 2) throw Error('sweepProfile: profile needs two points');
  const a0 = Math.min(s0, s1), a1 = Math.max(s0, s1);
  const st = front.stations(a0, a1, o.maxStep ?? 1, o.breaks);
  const frames = st.map(s => front.at(s));
  const ring = frames.map(f => profile.map(([oo, y]) => [f.p[0] + f.n[0] * oo, y, f.p[1] + f.n[1] * oo]));
  const out: number[] = [];
  const cross = (a: number[], b: number[], c: number[]) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  };
  /** Triangle a, b, c, flipped if needed so its normal points along `want`. */
  const tri = (a: number[], b: number[], c: number[], want: number[]) => {
    const nr = cross(a, b, c);
    if (nr[0] * want[0] + nr[1] * want[1] + nr[2] * want[2] < 0) out.push(...a, ...c, ...b); else out.push(...a, ...b, ...c);
  };
  const edges = profile.length - (o.closed ? 0 : 1);
  for (let i = 0; i + 1 < ring.length; i++) {
    const A = ring[i], B = ring[i + 1], f = frames[i];
    for (let k = 0; k < edges; k++) {
      const k2 = (k + 1) % profile.length, dO = profile[k2][0] - profile[k][0], dY = profile[k2][1] - profile[k][1];
      // right of the edge direction (dO, dY) in (o, y) is (dY, -dO): world n * dY + up * -dO
      const want = [f.n[0] * dY, -dO, f.n[1] * dY];
      tri(A[k], A[k2], B[k2], want); tri(A[k], B[k2], B[k], want);
    }
  }
  if (o.caps && profile.length >= 3) {
    const a = ring[0], b = ring[ring.length - 1], ta = frames[0].t, tb = frames[frames.length - 1].t;
    for (let k = 1; k + 1 < profile.length; k++) { tri(a[0], a[k], a[k + 1], [-ta[0], 0, -ta[1]]); tri(b[0], b[k], b[k + 1], [tb[0], 0, tb[1]]); }
  }
  return out;
}
