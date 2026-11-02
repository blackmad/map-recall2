/**
 * Plan outline of a band that wraps a run of walls at a fixed depth with rounded outside corners: the cantilevered
 * balcony slabs and canopies that sweep round the set-back corner bays of the former telephone exchange at
 * Spuistraat 175 (J. Crouwel 1924; register 207033: "the parapets over the first, second and third storeys do not step back
 * at the corner bays, so they run on there as balcony balustrades"), and any other corner balcony or canopy that follows a
 * wall run and rounds its outer corners.
 *
 * Why a component: the kit's slabs are rectangles on one wall frame, so a band round a corner was two boxes meeting in a
 * mitre, or a box sticking out past the corner. The photos (Gemeente Amsterdam panoramas, w06-4, w09-278, w11-85) show one
 * continuous slab with a rounded nose.
 *
 * Pure plan geometry in (x, z), no three.js. `path` is an open polyline along the wall faces; each segment's outward side
 * is (-tz, tx) * side, where (tx, tz) is the unit direction a -> b. The outline is the path offset outward by `depth`,
 * with a circular arc round every convex vertex and the offset lines' intersection at every concave one, closed back
 * along the path itself. Returned counter-clockwise or clockwise as the path runs; callers extrude it (ExtrudeGeometry
 * accepts either winding).
 */
export type XZ = [number, number];

export interface WrapBandOptions {
  /** Outward offset of the band face from the wall path, metres (> 0). */
  depth: number;
  /** +1 when the outward side of segment a -> b is (-tz, tx), -1 for the other side. */
  side?: 1 | -1;
  /** Arc segments per quarter turn at a convex vertex (default 6). */
  arcSegmentsPerQuarter?: number;
}

const sub = (a: XZ, b: XZ): XZ => [a[0] - b[0], a[1] - b[1]];
const len = (a: XZ) => Math.hypot(a[0], a[1]);

/** Outer face of the band (the offset path with arcs), from the first segment's start to the last segment's end. */
export function wrapBandFace(path: XZ[], o: WrapBandOptions): XZ[] {
  const side = o.side ?? 1, D = o.depth, per = o.arcSegmentsPerQuarter ?? 6;
  if (!(D > 0)) throw new Error('wrapBand: depth must be > 0');
  const pts = path.filter((p, i) => i === 0 || len(sub(p, path[i - 1])) > 1e-6);
  if (pts.length < 2) throw new Error('wrapBand: path needs two distinct points');
  const dirs: XZ[] = [], norms: XZ[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = sub(pts[i + 1], pts[i]), l = len(d), t: XZ = [d[0] / l, d[1] / l];
    dirs.push(t); norms.push([-t[1] * side, t[0] * side]);
  }
  const off = (p: XZ, n: XZ): XZ => [p[0] + n[0] * D, p[1] + n[1] * D];
  const out: XZ[] = [off(pts[0], norms[0])];
  for (let i = 1; i + 1 < pts.length; i++) {
    const p = pts[i], n0 = norms[i - 1], n1 = norms[i], t1 = dirs[i];
    // the next segment heads away from the outward side of this one: an outside (convex) corner, so the offsets part
    const convex = n0[0] * t1[0] + n0[1] * t1[1] < -1e-9;
    if (convex) {
      const a0 = Math.atan2(n0[1], n0[0]);
      let da = Math.atan2(n1[1], n1[0]) - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const k = Math.max(1, Math.ceil(Math.abs(da) / (Math.PI / 2) * per));
      for (let j = 0; j <= k; j++) {
        const a = a0 + da * j / k;
        out.push([p[0] + Math.cos(a) * D, p[1] + Math.sin(a) * D]);
      }
    } else {
      // inside corner: meet the two offset lines; near-parallel segments just take the shared offset point
      const A = off(p, n0), B = off(p, n1), t0 = dirs[i - 1];
      const den = t0[0] * t1[1] - t0[1] * t1[0];
      if (Math.abs(den) < 1e-6) out.push(A);
      else {
        const s = ((B[0] - A[0]) * t1[1] - (B[1] - A[1]) * t1[0]) / den;
        out.push([A[0] + t0[0] * s, A[1] + t0[1] * s]);
      }
    }
  }
  out.push(off(pts[pts.length - 1], norms[norms.length - 1]));
  return out;
}

/** Closed plan outline of the band: the outer face, then back along the wall path. */
export function wrapBandOutline(path: XZ[], o: WrapBandOptions): XZ[] {
  return [...wrapBandFace(path, o), ...[...path].reverse()];
}

/** Shoelace area of a closed outline (absolute). */
export function outlineArea(ring: XZ[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}

/** Douglas-Peucker on an open path: drops the small jogs of a BAG outline before the band is wrapped round it. */
export function simplifyPath(path: XZ[], tol: number): XZ[] {
  if (path.length < 3) return path.slice();
  const keep = new Array(path.length).fill(false);
  keep[0] = keep[path.length - 1] = true;
  const dist = (p: XZ, a: XZ, b: XZ) => {
    const d = sub(b, a), l = len(d);
    return l < 1e-9 ? len(sub(p, a)) : Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / l;
  };
  const rec = (i: number, j: number) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) { const d = dist(path[k], path[i], path[j]); if (d > best) { best = d; bi = k; } }
    if (best > tol) { keep[bi] = true; rec(i, bi); rec(bi, j); }
  };
  rec(0, path.length - 1);
  return path.filter((_, k) => keep[k]);
}
