/**
 * Slipway deck kit: a deck plane that falls at a constant slope towards the water, keel and bilge blocks set out at a
 * pitch along polylines on it, and closed truncated-pyramid blocks.
 *
 * Why (Y-Helling lane, 2026-11-02): the NDSM wharf's eastern slipway (BAG pand 0363100012238702, rijksmonument 528255)
 * is a building whose roof is the slipway deck, falling 1:20 to the IJ (3DBAG LoD2.2: 5.74 m at the head, 1.22 m at the
 * foot over 90 m), with rows of concrete keel blocks (stapelblokken) laid out in the outline of the last hull built on
 * it (PDOK orthophoto 2025) and showing above the wall tops in every side panorama (w02, w06, w08). `roof` lays only
 * flat planes and no kit placed objects at a pitch along a curve. Pure geometry, no three.js:
 * plan points are [u, v] (u along the slope axis, uphill positive), heights y up.
 */
export type UV = [number, number];
export type Ramp = {u0: number; h0: number; slope: number; min?: number};
export type BlockSpot = {u: number; v: number; angle: number};
export type V3 = [number, number, number];

/** Deck height at u: h0 at u0 rising `slope` metres per metre uphill, never below `min` (default 0). */
export const rampHeight = (r: Ramp, u: number) => Math.max(r.min ?? 0, r.h0 + r.slope * (u - r.u0));

/**
 * Spots `pitch` metres apart along a polyline, the first and last half a pitch in from its ends (so a row of n blocks
 * fills its length evenly); `angle` is the heading of the polyline at the spot (radians from +u towards +v).
 */
export function blocksAlong(path: UV[], pitch: number): BlockSpot[] {
  if (path.length < 2 || !(pitch > 0)) return [];
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = seg.reduce((s, l) => s + l, 0), n = Math.max(1, Math.round(total / pitch)), step = total / n;
  const out: BlockSpot[] = [];
  for (let k = 0; k < n; k++) {
    let s = (k + 0.5) * step, i = 0;
    while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
    const a = path[i], b = path[i + 1], f = seg[i] > 0 ? s / seg[i] : 0;
    out.push({u: a[0] + (b[0] - a[0]) * f, v: a[1] + (b[1] - a[1]) * f, angle: Math.atan2(b[1] - a[1], b[0] - a[0])});
  }
  return out;
}

/**
 * A closed truncated pyramid (no bottom face: it stands on, and is sunk a little into, the deck): base `base` [along,
 * across] at y0, top `top` at y0 + h, centred on the spot and turned to its heading. Triangles are wound
 * counter-clockwise seen from outside; corners are returned in the caller's (u, y, v) order.
 */
export function frustumBlock(spot: BlockSpot, y0: number, base: UV, top: UV, h: number): V3[][] {
  const c = Math.cos(spot.angle), s = Math.sin(spot.angle);
  const at = (a: number, b: number, y: number): V3 => [spot.u + a * c - b * s, y, spot.v + a * s + b * c];
  const ring = (w: UV, y: number) => [at(-w[0] / 2, -w[1] / 2, y), at(w[0] / 2, -w[1] / 2, y), at(w[0] / 2, w[1] / 2, y), at(-w[0] / 2, w[1] / 2, y)];
  const lo = ring(base, y0), hi = ring(top, y0 + h), out: V3[][] = [];
  // (u, y, v) is right-handed like three.js (x, y, z), so a ring running +u then +v is clockwise seen from above
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    out.push([lo[i], hi[j], lo[j]], [lo[i], hi[i], hi[j]]);
  }
  out.push([hi[0], hi[2], hi[1]], [hi[0], hi[3], hi[2]]);
  return out;
}

/** Unit normal of a triangle from its winding, (u, y, v) corners. */
export function blockTriNormal(t: V3[]): V3 {
  const [a, b, c] = t;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}
