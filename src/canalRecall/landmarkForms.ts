// Landmark forms: hand-modelled volumes on a part's own footprint, for the landmarks whose shape
// is not a stack of towers, spires and pitched roofs (museums and cinemas, 2026-10-03).
//
// The Van Gogh Museum's Kurokawa wing is a granite half-ellipse under a tilted titanium brim,
// the Stedelijk's 2012 wing a white "bathtub" over a glass ground floor under a flat canopy, and
// Eye a white wedge whose roof climbs towards the IJ. Each is a few extrusions of the footprint
// OSM or BAG already maps: cut by a line, grown or shrunk at the edges, given a flat or a sloped
// lid, in one flat colour. Heights come from the 3D BAG (LoD 2.2 roof surfaces, AHN), not guesses.

import type { KitTri } from './landmarkKits.js';

type Vec2 = [number, number];
type Vec3 = [number, number, number];

/**
 * One extrusion of the part `on`'s outer ring, from `z0` to `z1` metres, in the flat colour `hex`
 * (`plain` uses the textured plain-wall layer instead, for brick). The lid is flat at `z1` unless
 * `z1High` is set: then it is a plane rising from `z1` on the ring's low side to `z1High` on the
 * side `highBearingDeg` points to (degrees counter-clockwise from east). `outsetM` grows the
 * ring outwards (a brim, a canopy; negative shrinks it, a recessed glass ground floor). `half` keeps
 * only the part of the ring on one side of a line through `through` ([lng, lat]), the side
 * `keepBearingDeg` points to. `lidHex` colours the lid when it differs from the walls.
 */
export type KitForm = {
  on: string; z0: number; z1: number; hex: string;
  z1High?: number; highBearingDeg?: number; outsetM?: number;
  half?: { through: [number, number]; keepBearingDeg: number };
  lidHex?: string; plain?: boolean;
  /** The underside follows the lid's slope (a tilted brim of even thickness) instead of staying level at z0. */
  tiltBottom?: boolean;
};

const closed = (ring: readonly Vec2[]) => ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
const signedArea = (pts: readonly Vec2[]) => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return a / 2; };

/** The open, counter-clockwise ring without repeated or nearly repeated vertices. */
export function cleanRing(ring: readonly Vec2[]): Vec2[] {
  const raw = closed(ring) ? ring.slice(0, -1) : ring.slice();
  const pts: Vec2[] = [];
  for (const p of raw) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.05) pts.push([p[0], p[1]]);
  while (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) <= 0.05) pts.pop();
  return signedArea(pts) < 0 ? pts.reverse() : pts;
}

/** Keep the side of the line through `p` that `dir` (a unit vector) points to (Sutherland-Hodgman). */
export function clipHalf(pts: readonly Vec2[], p: Vec2, dir: Vec2): Vec2[] {
  const side = (q: Vec2) => (q[0] - p[0]) * dir[0] + (q[1] - p[1]) * dir[1];
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

/** Each vertex of a counter-clockwise ring moved `d` metres outwards along its mitred corner (capped at 2.5 d). */
export function offsetRing(pts: readonly Vec2[], d: number): Vec2[] {
  if (!d) return pts.slice();
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const e0 = [p[0] - a[0], p[1] - a[1]], e1 = [b[0] - p[0], b[1] - p[1]];
    const l0 = Math.hypot(e0[0], e0[1]) || 1, l1 = Math.hypot(e1[0], e1[1]) || 1;
    // Outward normals of a counter-clockwise ring point to the right of each edge.
    const n0: Vec2 = [e0[1] / l0, -e0[0] / l0], n1: Vec2 = [e1[1] / l1, -e1[0] / l1];
    const mx = n0[0] + n1[0], my = n0[1] + n1[1], dotN = 1 + n0[0] * n1[0] + n0[1] * n1[1];
    if (dotN < 1e-6) return [p[0] + n0[0] * d, p[1] + n0[1] * d] as Vec2;
    let k = d / dotN;
    const len = Math.hypot(mx * k, my * k);
    if (len > Math.abs(d) * 2.5) k *= (Math.abs(d) * 2.5) / len;
    return [p[0] + mx * k, p[1] + my * k] as Vec2;
  });
}

/** Ear-clipping triangulation of a simple counter-clockwise ring: index triples. */
export function earcut(pts: readonly Vec2[]): [number, number, number][] {
  const idx = pts.map((_, i) => i), tris: [number, number, number][] = [];
  const cross = (a: Vec2, b: Vec2, c: Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p: Vec2, a: Vec2, b: Vec2, c: Vec2) => cross(a, b, p) > 1e-9 && cross(b, c, p) > 1e-9 && cross(c, a, p) > 1e-9;
  let guard = pts.length * pts.length + 10;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      const turn = cross(a, b, c);
      if (turn <= 1e-9) { if (Math.abs(turn) <= 1e-9) { idx.splice(k, 1); clipped = true; break; } continue; }
      if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(pts[j], a, b, c))) continue;
      tris.push([i0, i1, i2]); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  // Whatever is left (a degenerate sliver) is fanned so the lid has no hole.
  for (let k = 1; k + 1 < idx.length; k++) tris.push([idx[0], idx[k], idx[k + 1]]);
  return tris;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossV = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function tri(out: KitTri[], a: Vec3, b: Vec3, c: Vec3, ua: Vec2, ub: Vec2, uc: Vec2, layer: KitTri['layer'], hex: string, hint: Vec3) {
  let n = crossV(sub(b, a), sub(c, a)), B = b, C = c, UB = ub, UC = uc;
  if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { B = c; C = b; UB = uc; UC = ub; n = [-n[0], -n[1], -n[2]]; }
  const l = Math.hypot(n[0], n[1], n[2]);
  if (l < 1e-9) return;
  out.push({ p: [a, B, C], uv: [ua, UB, UC], layer, hex, n: [n[0] / l, n[1] / l, n[2] / l] });
}

/**
 * The triangles of one form on a part whose outer ring is `ring` (local metres); `toLocal` turns
 * the form's [lng, lat] anchors into the same metres. Empty when the cut leaves nothing.
 */
export function formTriangles(form: KitForm, ring: readonly Vec2[], toLocal: (lngLat: [number, number]) => Vec2): KitTri[] {
  let pts = cleanRing(ring);
  if (form.half) {
    const b = (form.half.keepBearingDeg * Math.PI) / 180;
    pts = cleanRing(clipHalf(pts, toLocal(form.half.through), [Math.cos(b), Math.sin(b)]));
  }
  if (pts.length < 3 || Math.abs(signedArea(pts)) < 1) return [];
  pts = offsetRing(pts, form.outsetM ?? 0);
  const out: KitTri[] = [], layer: KitTri['layer'] = form.plain ? 'plain' : 'flat';
  // The lid: flat, or a plane rising across the ring's extent towards highBearingDeg.
  let zAt = (_p: Vec2) => form.z1;
  if (form.z1High !== undefined) {
    const hb = ((form.highBearingDeg ?? 0) * Math.PI) / 180, hx = Math.cos(hb), hy = Math.sin(hb);
    const s = pts.map(p => p[0] * hx + p[1] * hy), lo = Math.min(...s), span = Math.max(...s) - lo || 1, zHigh = form.z1High;
    zAt = p => form.z1 + ((zHigh - form.z1) * (p[0] * hx + p[1] * hy - lo)) / span;
  }
  const zLow = (p: Vec2) => (form.tiltBottom ? form.z0 + zAt(p) - form.z1 : form.z0);
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], side = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u0 = run / 5, u1 = (run + side) / 5; run += side;
    const za = zAt(a), zb = zAt(b);
    // Outward is to the right of a counter-clockwise edge.
    const hint: Vec3 = [b[1] - a[1], -(b[0] - a[0]), 0];
    if (!(hint[0] || hint[1])) continue;
    const fa = zLow(a), fb = zLow(b);
    tri(out, [a[0], a[1], fa], [b[0], b[1], fb], [b[0], b[1], zb], [u0, fa / 3.1], [u1, fb / 3.1], [u1, zb / 3.1], layer, form.hex, hint);
    tri(out, [a[0], a[1], fa], [b[0], b[1], zb], [a[0], a[1], za], [u0, fa / 3.1], [u1, zb / 3.1], [u0, za / 3.1], layer, form.hex, hint);
  }
  const lid = form.lidHex ?? form.hex;
  for (const [i, j, k] of earcut(pts)) {
    tri(out, [pts[i][0], pts[i][1], zAt(pts[i])], [pts[j][0], pts[j][1], zAt(pts[j])], [pts[k][0], pts[k][1], zAt(pts[k])], [0, 0], [1, 0], [1, 1], 'flat', lid, [0, 0, 1]);
    // An overhang (a brim, a canopy) is seen from below: give it an underside.
    if (form.z0 > 0.5) tri(out, [pts[i][0], pts[i][1], zLow(pts[i])], [pts[j][0], pts[j][1], zLow(pts[j])], [pts[k][0], pts[k][1], zLow(pts[k])], [0, 0], [1, 0], [1, 1], 'flat', form.hex, [0, 0, -1]);
  }
  return out;
}
