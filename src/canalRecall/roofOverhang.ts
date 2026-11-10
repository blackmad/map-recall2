// How far a roof drawn over a footprint stands past it, seen from above (lane S3, #315).
import type { RoofTri } from './roofMesh.js';

type Pt = readonly number[];

/** Footprint ring (lng/lat) in the roof mesh's metre frame (roofTrianglesForOutline: x east, y north from origin). */
export function ringMetres(outer: readonly Pt[], origin: { lng: number; lat: number }, kx: number, ky = 110_540): Array<[number, number]> {
  const ring = outer.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * ky] as [number, number]);
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  return ring;
}

export function insideRing(ring: readonly Pt[], x: number, y: number): boolean {
  let r = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) if ((ring[a][1] > y) !== (ring[b][1] > y) && x < (ring[b][0] - ring[a][0]) * (y - ring[a][1]) / (ring[b][1] - ring[a][1]) + ring[a][0]) r = !r;
  return r;
}

export function distanceToRing(ring: readonly Pt[], x: number, y: number): number {
  let d = Infinity;
  for (let a = 0; a < ring.length; a++) {
    const p = ring[a], q = ring[(a + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1];
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy));
  }
  return d;
}

/** A triangle with no area draws nothing, wherever its vertices stand. */
export function zeroArea(t: RoofTri): boolean {
  const [a, b, c] = t.p, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) < 1e-6;
}

/** The farthest any vertex of `tris` (mesh metres) stands outside the footprint `outer` (lng/lat), metres; 0 inside. */
export function footprintHangM(outer: readonly Pt[], tris: readonly RoofTri[], origin: { lng: number; lat: number }, kx: number): number {
  const ring = ringMetres(outer, origin, kx);
  let hang = 0;
  for (const t of tris) if (!zeroArea(t)) for (const [x, y] of t.p) if (!insideRing(ring, x, y)) hang = Math.max(hang, distanceToRing(ring, x, y));
  return hang;
}
