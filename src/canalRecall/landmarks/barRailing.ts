/**
 * See-through bar railing along a balcony edge: a top rail, a thin bottom rail lifted off the slab, and square vertical
 * bars at a fixed pitch, following any open polyline in plan (straight runs, arcs given as polylines). Made for the
 * rounded 1981 balconies of the OBA Spaarndammerbuurt block (Spaarndammerstraat 490; Gemeente Amsterdam panoramas 2019 and
 * 2022 show white slabs with light bar railings), and for any curved or straight balcony whose railing must read as open
 * bars rather than a solid band.
 *
 * Why a component: the kit had only solid boxes, so a rounded balcony's railing was a 1 m solid band that read as a heavy
 * black ribbon at gallery and street size.
 *
 * Pure geometry, no three.js: plan coordinates (x, z), y up from the slab top (y = 0). Returns flat-shaded triangle
 * soup (four vertices per quad) with outward winding, for the caller to wrap in a BufferGeometry and computeVertexNormals.
 * Rails are 4-sided tubes per path segment (top, bottom, both faces; open ends hidden at joints and walls); bars are
 * 4-sided posts with open ends (hidden inside the rails).
 */
export type XZ = [number, number];

export interface BarRailingOptions {
  /** Height of the top of the top rail above the slab, metres. */
  height?: number;
  /** Top rail section: width (horizontal, across the path) and height, metres. */
  topRail?: [number, number];
  /** Bottom rail section [width, height] and its lift off the slab (bottom of the rail), metres. */
  bottomRail?: [number, number];
  bottomLift?: number;
  /** Bar pitch along the path and square bar size, metres. */
  barPitch?: number;
  barSize?: number;
}

export interface RailingMesh {
  positions: number[];
  indices: number[];
  /** Count of vertical bars placed. */
  bars: number;
}

const DEF = {height: 1.0, topRail: [0.05, 0.05] as [number, number], bottomRail: [0.03, 0.03] as [number, number], bottomLift: 0.08, barPitch: 0.13, barSize: 0.022};

/** Signed shoelace area in (x, z). */
export function signedArea(p: XZ[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a / 2;
}

/**
 * Side faces (and optional caps) of a vertical prism over a convex plan polygon, from y0 to y1, faces outward. The
 * polygon is reordered to negative shoelace area, for which edge e = (ex, ez) has outward normal (-ez, ex) and the
 * quad (p_i y0, p_i+1 y0, p_i+1 y1, p_i y1) winds outward.
 */
function prism(out: RailingMesh, poly: XZ[], y0: number, y1: number, caps: boolean) {
  const p = signedArea(poly) > 0 ? [...poly].reverse() : poly;
  const P = out.positions, I = out.indices;
  const quad = (v: number[][]) => {
    const b = P.length / 3;
    for (const x of v) P.push(x[0], x[1], x[2]);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length];
    quad([[a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]]]);
  }
  if (caps && p.length === 4) {
    quad(p.map(q => [q[0], y1, q[1]]));                                           // top: +y for this winding
    quad([...p].reverse().map(q => [q[0], y0, q[1]]));                            // bottom: -y
  }
}

/** A rail of section w x h along segment a -> b, centred on the segment, bottom at y. */
function rail(out: RailingMesh, a: XZ, b: XZ, w: number, y: number, h: number, extend: number) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  if (L < 1e-6) return;
  const t: XZ = [dx / L, dz / L], n: XZ = [-t[1] * w / 2, t[0] * w / 2];
  const s: XZ = [a[0] - t[0] * extend, a[1] - t[1] * extend], e: XZ = [b[0] + t[0] * extend, b[1] + t[1] * extend];
  prism(out, [[s[0] + n[0], s[1] + n[1]], [e[0] + n[0], e[1] + n[1]], [e[0] - n[0], e[1] - n[1]], [s[0] - n[0], s[1] - n[1]]], y, y + h, true);
}

/** Bar railing along an open plan polyline. */
export function barRailing(path: XZ[], o: BarRailingOptions = {}): RailingMesh {
  const H = o.height ?? DEF.height, [tw, th] = o.topRail ?? DEF.topRail, [bw, bh] = o.bottomRail ?? DEF.bottomRail;
  const lift = o.bottomLift ?? DEF.bottomLift, pitch = o.barPitch ?? DEF.barPitch, bs = o.barSize ?? DEF.barSize;
  if (!(H > th + lift + bh) || !(pitch > bs)) throw new Error('barRailing: height must clear both rails, pitch must exceed the bar size');
  const pts = path.filter((p, i) => i === 0 || Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) > 1e-6);
  if (pts.length < 2) throw new Error('barRailing: path needs two distinct points');
  const out: RailingMesh = {positions: [], indices: [], bars: 0};
  // rails: per segment, overlapping half a section at the joints so arcs read continuous
  for (let i = 0; i + 1 < pts.length; i++) {
    rail(out, pts[i], pts[i + 1], tw, H - th, th, i > 0 ? tw / 2 : 0);
    rail(out, pts[i], pts[i + 1], bw, lift, bh, i > 0 ? bw / 2 : 0);
  }
  // bars: by arc length, the first and last half a pitch in from the ends
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = segLen.reduce((a, b) => a + b, 0), n = Math.max(1, Math.round(total / pitch)), step = total / n;
  for (let k = 0; k < n; k++) {
    let s = (k + 0.5) * step, i = 0;
    while (i < segLen.length - 1 && s > segLen[i]) s -= segLen[i++];
    const a = pts[i], b = pts[i + 1], u = s / segLen[i], c: XZ = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], h = bs / 2;
    prism(out, [[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]], lift + bh, H - th, false);
    out.bars++;
  }
  return out;
}

/**
 * The open front edge of a slab with rounded front corners, in plan: from the wall at (t0, z0) out to the nose, across,
 * and back to the wall at (t1, z0). x runs along the wall, z outward; the front is at z = depth with corners of radius r.
 */
export function roundedFrontPath(t0: number, t1: number, z0: number, depth: number, r: number, perQuarter = 4): XZ[] {
  const rr = Math.min(r, (t1 - t0) / 2, depth - z0), out: XZ[] = [[t0, z0], [t0, depth - rr]];
  for (let k = 1; k < perQuarter; k++) { const a = Math.PI - (Math.PI / 2) * (k / perQuarter); out.push([t0 + rr + rr * Math.cos(a), depth - rr + rr * Math.sin(a)]); }
  out.push([t0 + rr, depth], [t1 - rr, depth]);
  for (let k = 1; k < perQuarter; k++) { const a = Math.PI / 2 - (Math.PI / 2) * (k / perQuarter); out.push([t1 - rr + rr * Math.cos(a), depth - rr + rr * Math.sin(a)]); }
  out.push([t1, depth - rr], [t1, z0]);
  return out;
}
