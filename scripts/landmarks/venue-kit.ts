import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {geomOf} from './cut-face';
import {slab, poly, type Frame} from './nearbar-kit';
import type {Surface} from './worship-shell';
import {glyphRuns, MIXED_CASE_GLYPHS} from './mixed-case-glyphs';

/**
 * Shared parts of the centre-venues lane (2026-11-14: Arti et Amicitiae, Industrieele Groote Club, Splendor, De Uitkijk,
 * Escape, Bitterzoet). Each of those BAG panden holds more than the venue (Arti's pand runs through the block to the
 * Kalverstraat), so the builders keep the 3DBAG LoD2.2 shell for the parts they do not draw and lay measured fronts on
 * the street faces. What the existing kits did not have:
 *
 *  - `clipRingByLine`: a planar 3DBAG roof piece cut by a vertical plane, so the part of a roof outside a hand-drawn
 *    block survives (a skipped piece that straddles the block's back wall otherwise leaves a hole);
 *  - `profileAlong`: a moulding profile (o out of the wall, y up) extruded along a wall frame: cornices, belts, consoles;
 *  - `pedimentSolid`: a triangular pediment with raking and base cornices standing proud of its tympanum;
 *  - `modillions`: evenly spaced blocks under a cornice soffit;
 *  - `verticalLettering`: glyph runs turned 90 degrees (text reading bottom to top) on a banner or a vertical sign.
 *
 * Frames follow nearbar-kit: t along the wall to the viewer's right, y up, out of the wall along n. Every solid's back
 * face sits at `out` (sunk by nearbar-kit's SINK when the builder sets one); fronts stand >= 5 cm proud.
 */
export type XZ = [number, number];
export type Col = Parameters<BuildingTools['add']>[1];

/** Plan centroid (x, z) of a 3DBAG surface's outer ring. */
export function centroidXZ(s: Surface): XZ {
  const r = s.rings[0];
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];
}
/** Even-odd point in polygon (plan x, z). */
export function insidePoly(p: XZ, ring: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/** Distance in plan from p to segment a-b, and the position along it (0..1). */
export function segDist(p: XZ, a: XZ, b: XZ): {d: number; u: number} {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
  const u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2, c = Math.max(0, Math.min(1, u));
  return {d: Math.hypot(p[0] - a[0] - c * dx, p[1] - a[1] - c * dz), u};
}
/** A wall surface lying on the plan segment a-b: every vertex within `tol` of the line and between its ends. */
export function wallOnSegment(s: Surface, a: XZ, b: XZ, tol = 0.35): boolean {
  if (s.type !== 'WallSurface') return false;
  return s.rings[0].every(p => { const q = segDist([p[0], p[2]], a, b); return q.d <= tol && q.u >= -0.02 && q.u <= 1.02; });
}
/**
 * Clip a 3D ring (points [x, y, z]) by the vertical plane through plan points a-b, keeping the side where the cross
 * product (b - a) x (p - a) has the sign of `keep` (+1 left of a->b in plan x/z, -1 right). Planar rings stay planar.
 */
export function clipRingByLine(ring: number[][], a: XZ, b: XZ, keep: 1 | -1): number[][] {
  const side = (p: number[]) => keep * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push(p.map((v, k) => v + (q[k] - v) * t)); }
  }
  return out.length >= 3 ? out : [];
}

/** Triangle sink grouped by colour, with each triangle wound to face `want` (morgan-mees-builder's Mesh). */
export class TriSink {
  tris = new Map<Col, number[]>();
  tri(c: Col, a: number[], b: number[], d: number[], want: number[]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-10) return;
    const arr = this.tris.get(c) ?? [];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) arr.push(...a, ...b, ...d); else arr.push(...a, ...d, ...b);
    this.tris.set(c, arr);
  }
  quad(c: Col, a: number[], b: number[], d: number[], e: number[], want: number[]) { this.tri(c, a, b, d, want); this.tri(c, a, d, e, want); }
  /** Convex or simple planar polygon fan from its first vertex. */
  fan(c: Col, pts: number[][], want: number[]) { for (let i = 1; i + 1 < pts.length; i++) this.tri(c, pts[0], pts[i], pts[i + 1], want); }
  flush(b: BuildingTools) {
    for (const [c, pos] of this.tris) if (pos.length) b.add(geomOf(pos), c);
    this.tris.clear();
  }
}

/** Profile (o out of the wall, y up) extruded along the wall from t0 to t1; closed at both ends. */
export function profileAlong(b: BuildingTools, f: Frame, t0: number, t1: number, sect: [number, number][], c: Col, out = 0) {
  b.add(profileGeometry(f, t0, t1, sect, out), c);
}
/** The geometry of `profileAlong` in model coordinates (swapping shape x and extrusion z mirrors it: windings are flipped back). */
export function profileGeometry(f: Frame, t0: number, t1: number, sect: [number, number][], out = 0): T.BufferGeometry {
  const shape = new T.Shape(sect.map(([o, y]) => new T.Vector2(o, y)));
  const g = new T.ExtrudeGeometry(shape, {depth: t1 - t0, bevelEnabled: false, curveSegments: 4});
  const src = (g.index ? g.toNonIndexed() : g).getAttribute('position'), pos: number[] = [];
  const P = (i: number) => { const o = src.getX(i) + out, y = src.getY(i), t = t0 + src.getZ(i); return [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o]; };
  for (let i = 0; i < src.count; i += 3) pos.push(...P(i), ...P(i + 2), ...P(i + 1));
  return geomOf(pos);
}

/** Classical cornice profile: frieze fascia, bed moulding, corona and cymatium, `proj` metres proud at the top. */
export function corniceSection(y: number, h: number, proj: number, back = 0.3): [number, number][] {
  return [[-back, y], [proj * 0.25, y], [proj * 0.25, y + h * 0.3], [proj * 0.55, y + h * 0.42], [proj * 0.55, y + h * 0.5],
    [proj * 0.92, y + h * 0.55], [proj * 0.92, y + h * 0.82], [proj, y + h * 0.9], [proj, y + h], [-back, y + h]];
}

/** Modillion blocks under a cornice soffit, `n` evenly spaced over t0..t1 (centres), each w wide, h tall, d deep. */
export function modillionCentres(t0: number, t1: number, pitch: number): number[] {
  const n = Math.max(1, Math.floor((t1 - t0) / pitch + 1e-9));
  const step = (t1 - t0) / n, out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(t0 + k * step);
  return out;
}
export function modillions(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, o: {pitch: number; w: number; h: number; d: number; c: Col; out?: number}) {
  for (const t of modillionCentres(t0, t1, o.pitch)) slab(b, f, t, y, o.w, o.h, o.d, o.c, o.out ?? 0);
}

/**
 * Triangular pediment over a base of width w at y (centred at t), apex h above: a recessed tympanum plate, raking
 * cornices `rake` wide standing `d` proud, and a horizontal base cornice. Returns the tympanum's inner triangle
 * (t, y offsets about the base centre) for relief layout.
 */
export function pedimentOutline(w: number, h: number, inset = 0): [number, number][] {
  const k = h / (w / 2), x = w / 2 - inset * Math.sqrt(1 + k * k) / k, y0 = inset, apex = h - inset * Math.sqrt(1 + k * k);
  return [[-x + inset / k, y0], [x - inset / k, y0], [0, apex]];
}
export function pedimentSolid(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o: {d: number; rake: number; tymp: Col; trim: Col; out?: number}) {
  const out = o.out ?? 0;
  // raking cornices: outer triangle band minus the inner, as two sloping bars and the base bar; the tympanum fills the
  // inner triangle only, so none of its faces lies in a bar's plane (coplanar faces z-fight)
  const outer = pedimentOutline(w, h), inner = pedimentOutline(w, h, o.rake);
  poly(b, f, t, y, inner, o.d * 0.4, o.tymp, out);
  poly(b, f, t, y, [outer[0], outer[2], inner[2], inner[0]], o.d, o.trim, out);
  poly(b, f, t, y, [inner[2], outer[2], outer[1], inner[1]], o.d, o.trim, out);
  slab(b, f, t, y, w, o.rake, o.d, o.trim, out);
  return inner;
}

/** Glyph runs set vertically (reading bottom to top) on a wall frame: the text's baseline runs up the wall at t. */
export function verticalLettering(b: BuildingTools, f: Frame, text: string, t: number, y0: number, px: number, d: number, c: Col, out = 0) {
  const {runs, width} = glyphRuns(text, px, MIXED_CASE_GLYPHS);
  // text x -> up the wall, text y (0..7px) -> to the left of t (letters' tops face -t)
  for (const r of runs) slab(b, f, t - (r.y0 + r.y1) / 2 + 3.5 * px, y0 + r.t0, r.y1 - r.y0, r.t1 - r.t0, d, c, out);
  return width;
}
