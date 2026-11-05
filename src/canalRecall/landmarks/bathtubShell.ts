/**
 * A "bathtub" shell: an open-topped hull lofted from a small rounded-rectangle bottom to a large rounded-rectangle rim,
 * its sides flaring outward through a rounded bilge, its flat bottom free to tilt along its length (the bottom height is
 * a function of u). The rim is left open for the lid (a roof slab) the caller lays on it.
 *
 * Why (Stedelijk Museum lane #221, 2026-11-05): Benthem Crouwel's 2012 wing is a white composite tub cantilevered over a
 * glazed ground storey, widest under its flat roof and narrowing to a rounded bottom about 4.4 m above the street at the
 * Van Baerlestraat end; along the Museumplein face the bottom rises in a long diagonal crease towards the east end, where
 * it hangs about 10.5 m up over a two-storey glass wall (Gemeente Amsterdam panoramas recording_2025-07-30_11-08-35_00330,
 * TMX7316010203-001154_pano_0001_000249, TMX7316010203-001154_pano_0001_000200). The kit's boxes, prisms and slabs cannot
 * draw a flaring hull, and the earlier stand-in stacked straight-sided rings with a level bottom. Pure geometry in a local
 * frame (u along the tub, v across it, y up), no three.js; every triangle is listed counter-clockwise seen from outside.
 */
export type TubPoint = [number, number, number];   // [u, v, y]
export type TubRect = {u0: number; u1: number; v0: number; v1: number; radius: number};
export interface BathtubSpec {
  /** The bottom outline (the smallest ring). */
  bottom: TubRect;
  /** The rim outline at `top` (the largest ring); it must contain `bottom`. */
  rim: TubRect;
  /** Rim height. */
  top: number;
  /** Height of the flat bottom at u (must stay below `top`). */
  bottomAt: (u: number) => number;
  /**
   * The hull's section from the bottom to the rim as [plan fraction, height fraction] pairs, both rising from 0 to 1
   * (first [0, 0], last [1, 1]); a plan fraction that grows faster than the height fraction rounds the bilge.
   */
  section?: [number, number][];
  /** Arc segments per rounded corner (default 4). */
  corner?: number;
  /** Extra u stations where the bottom's slope changes, so the bottom follows a piecewise bottomAt exactly. */
  breaks?: number[];
}
export type TubTri = [TubPoint, TubPoint, TubPoint];
export interface Bathtub {sides: TubTri[]; bottom: TubTri[]; rimRing: [number, number][]}

export const DEFAULT_SECTION: [number, number][] = [[0, 0], [0.45, 0.06], [0.72, 0.18], [0.9, 0.42], [1, 1]];

/** A rounded rectangle as a counter-clockwise ring in (u, v), `n` arc segments per corner, starting at the +u side. */
export function roundedRect(r: TubRect, n: number): [number, number][] {
  const rad = Math.max(0, Math.min(r.radius, (r.u1 - r.u0) / 2, (r.v1 - r.v0) / 2));
  const cs: [number, number, number][] = [[r.u1 - rad, r.v0 + rad, -Math.PI / 2], [r.u1 - rad, r.v1 - rad, 0], [r.u0 + rad, r.v1 - rad, Math.PI / 2], [r.u0 + rad, r.v0 + rad, Math.PI]];
  const out: [number, number][] = [];
  for (const [cu, cv, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; out.push([cu + rad * Math.cos(a), cv + rad * Math.sin(a)]); }
  return out;
}

/**
 * Insert u stations into the straight long edges (constant v) of a ring, so every ring carries a vertex wherever the
 * bottom's slope changes: the hull's lowest ring then follows a piecewise bottomAt exactly and meets the bottom strips
 * edge for edge (no T-junction, no sliver gap; the GLB audit's open-boundary check found both in the first export).
 */
export function insertStations(ring: [number, number][], us: number[]): [number, number][] {
  if (!us.length) return ring;
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    out.push(p);
    if (Math.abs(p[1] - q[1]) > 1e-9 || Math.abs(p[0] - q[0]) < 1e-9) continue;
    const inside = us.filter(u => (u - p[0]) * (u - q[0]) < -1e-12).sort((a, b) => (q[0] > p[0] ? a - b : b - a));
    for (const u of inside) out.push([u, p[1]]);
  }
  return out;
}

const sub = (a: TubPoint, b: TubPoint): TubPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: TubPoint, b: TubPoint): TubPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Normal of a triangle in (u, v, y): the frame is left-handed as listed, so the geometric normal is negated into (u, v, y) right-handed terms. */
export function tubNormal(t: TubTri): TubPoint {
  // Map (u, v, y) to a right-handed (x = u, y = y, z = -v) frame, take the cross product, map back.
  const m = (p: TubPoint): TubPoint => [p[0], p[2], -p[1]];
  const a = m(t[0]), b = m(t[1]), c = m(t[2]);
  const n = cross(sub(b, a), sub(c, a));
  const L = Math.hypot(...n) || 1;
  return [n[0] / L, -n[2] / L, n[1] / L];
}

export function bathtubShell(s: BathtubSpec): Bathtub {
  const n = s.corner ?? 4, section = s.section ?? DEFAULT_SECTION;
  if (section[0][0] !== 0 || section[0][1] !== 0 || section.at(-1)![0] !== 1 || section.at(-1)![1] !== 1) throw Error('bathtubShell: section must run from [0, 0] to [1, 1]');
  const b = s.bottom, r = s.rim;
  if (b.u0 < r.u0 || b.u1 > r.u1 || b.v0 < r.v0 || b.v1 > r.v1) throw Error('bathtubShell: the rim must contain the bottom');
  const lerp = (x: number, y: number, f: number) => x + (y - x) * f;
  const rings = section.map(([f, h]) => {
    const rr: TubRect = {u0: lerp(b.u0, r.u0, f), u1: lerp(b.u1, r.u1, f), v0: lerp(b.v0, r.v0, f), v1: lerp(b.v1, r.v1, f), radius: lerp(b.radius, r.radius, f)};
    return insertStations(roundedRect(rr, n), s.breaks ?? []).map(([u, v]): TubPoint => {
      // the height fraction applies to the local depth below the rim at the bottom station this ring point lies over
      const ub = Math.max(b.u0, Math.min(b.u1, u)), y0 = s.bottomAt(ub);
      if (!(y0 < s.top)) throw Error(`bathtubShell: bottom ${y0} at u=${ub} is not below the rim ${s.top}`);
      return [u, v, lerp(y0, s.top, h)];
    });
  });
  const sides: TubTri[] = [];
  const out = (t: TubTri, centre: TubPoint) => {
    // outward test: the face normal points away from the tub's axis (horizontally) or down at the bilge
    const nrm = tubNormal(t), m: TubPoint = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3];
    const d = (m[0] - centre[0]) * nrm[0] + (m[1] - centre[1]) * nrm[1] + (m[2] - centre[2]) * nrm[2];
    return d >= 0 ? t : [t[0], t[2], t[1]] as TubTri;
  };
  const cu = (r.u0 + r.u1) / 2, cv = (r.v0 + r.v1) / 2, cy = s.top + 0.25 * (r.v1 - r.v0);   // above the rim: every hull face looks away
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      for (const t of [[A[i], A[j], B[j]], [A[i], B[j], B[i]]] as TubTri[]) {
        if (Math.hypot(...cross(sub(t[1], t[0]), sub(t[2], t[0]))) < 1e-9) continue;
        sides.push(out(t, [cu, cv, cy]));
      }
    }
  }
  // Bottom: strips between the ring's two long sides, stationed at every ring vertex u and every break, so a piecewise
  // linear bottomAt is followed exactly.
  const ring0 = rings[0].map(p => [p[0], p[1]] as [number, number]);
  const vAt = (u: number, upper: boolean) => {
    // the ring's v extent at u (convex ring): intersect edges
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < ring0.length; i++) {
      const p = ring0[i], q = ring0[(i + 1) % ring0.length];
      if ((p[0] - u) * (q[0] - u) > 0 || p[0] === q[0]) { if (p[0] === u) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); } continue; }
      const f = (u - p[0]) / (q[0] - p[0]), v = p[1] + f * (q[1] - p[1]);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return upper ? hi : lo;
  };
  const us = [...new Set([...ring0.map(p => p[0]), ...(s.breaks ?? []).filter(u => u > b.u0 && u < b.u1)].map(u => Math.round(u * 1e6) / 1e6))].sort((x, y) => x - y);
  const bottom: TubTri[] = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const u0 = us[i], u1 = us[i + 1];
    // reuse the lowest ring's own vertex where there is one, so hull and bottom share exact positions
    const P = (u: number, upper: boolean): TubPoint => {
      const v = vAt(u, upper), hit = rings[0].find(p => Math.abs(p[0] - u) < 1e-5 && Math.abs(p[1] - v) < 1e-5);
      return hit ? [hit[0], hit[1], hit[2]] : [u, v, s.bottomAt(Math.max(b.u0, Math.min(b.u1, u)))];
    };
    const a = P(u0, false), c = P(u1, false), d = P(u1, true), e = P(u0, true);
    for (const t of [[a, c, d], [a, d, e]] as TubTri[]) {
      if (Math.hypot(...cross(sub(t[1], t[0]), sub(t[2], t[0]))) < 1e-9) continue;
      bottom.push(tubNormal(t)[2] <= 0 ? t : [t[0], t[2], t[1]]);
    }
  }
  return {sides, bottom, rimRing: rings.at(-1)!.map(p => [p[0], p[1]] as [number, number])};
}
