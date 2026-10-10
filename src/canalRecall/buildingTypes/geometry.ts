/**
 * Plan geometry for building types. Everything is in a local frame of metres,
 * x = east, z = south (the frame of the game's GLBs, so +y up is right-handed:
 * x cross y = z). Pure and dependency free.
 */
export type Pt = [number, number];

export interface Anchor { lng: number; lat: number }

const M_PER_DEG_LAT = 110574;
const mPerDegLng = (lat: number) => 111320 * Math.cos(lat * Math.PI / 180);

/** WGS84 to local east/south metres around an anchor (equirectangular: sub-cm over the 3 km of a pilot area). */
export function lngLatToLocal(anchor: Anchor, lng: number, lat: number): Pt {
  return [(lng - anchor.lng) * mPerDegLng(anchor.lat), -(lat - anchor.lat) * M_PER_DEG_LAT];
}

export function localToLngLat(anchor: Anchor, p: Pt): [number, number] {
  return [anchor.lng + p[0] / mPerDegLng(anchor.lat), anchor.lat - p[1] / M_PER_DEG_LAT];
}

/** Compass bearing in degrees (0 = north, 90 = east) of a local east/south vector. */
export const bearingDeg = (dx: number, dz: number) => (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;

export const signedArea = (ring: Pt[]) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** Drop a repeated closing vertex. */
export const openRing = (ring: Pt[]): Pt[] => ring.length > 1 && Math.hypot(ring[0][0] - ring.at(-1)![0], ring[0][1] - ring.at(-1)![1]) < 1e-9 ? ring.slice(0, -1) : ring;

export function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop(); lower.push(q); }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export interface Rect {
  center: Pt;
  /** Unit vector along the long side. */
  long: Pt;
  /** Unit vector along the short side (long rotated +90 degrees in the x/z plane). */
  short: Pt;
  length: number;
  width: number;
  /** Counter-clockwise (in x/z with z down this is the visual order) corners: (-L,-W), (+L,-W), (+L,+W), (-L,+W) in (long, short) coordinates. */
  corners: [Pt, Pt, Pt, Pt];
}

/** Minimum-area rotated rectangle by rotating calipers over the convex hull; length >= width by construction. */
export function minimumRotatedRectangle(ring: Pt[]): Rect {
  const hull = convexHull(openRing(ring));
  if (hull.length < 3) throw new Error('footprint needs at least 3 distinct vertices');
  let best: {area: number; ang: number; x0: number; x1: number; y0: number; y1: number} | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of hull) { const x = q[0] * c + q[1] * s, y = -q[0] * s + q[1] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const area = (x1 - x0) * (y1 - y0);
    if (!best || area < best.area - 1e-9) best = {area, ang, x0, x1, y0, y1};
  }
  const b = best!;
  let ang = b.ang, dx = b.x1 - b.x0, dy = b.y1 - b.y0, xa = b.x0, xb = b.x1, ya = b.y0, yb = b.y1;
  if (dy > dx) { // long axis is the rotated y axis
    ang += Math.PI / 2; [dx, dy] = [dy, dx];
    [xa, xb, ya, yb] = [ya, yb, -xb, -xa]; // new x' = old y, new y' = -old x
  }
  // Normalise to a direction in [0, pi) so the result does not depend on ring winding or start vertex.
  let c = Math.cos(ang), s = Math.sin(ang);
  if (c < -1e-12 || (Math.abs(c) <= 1e-12 && s < 0)) { c = -c; s = -s; [xa, xb] = [-xb, -xa]; [ya, yb] = [-yb, -ya]; }
  const long: Pt = [c, s], short: Pt = [-s, c];
  const cl = (xa + xb) / 2, cs = (ya + yb) / 2;
  const center: Pt = [long[0] * cl + short[0] * cs, long[1] * cl + short[1] * cs];
  const corner = (a: number, b2: number): Pt => [center[0] + long[0] * a + short[0] * b2, center[1] + long[1] * a + short[1] * b2];
  const L = dx / 2, W = dy / 2;
  return {center, long, short, length: dx, width: dy, corners: [corner(-L, -W), corner(L, -W), corner(L, W), corner(-L, W)]};
}

/** Area of a (possibly concave) polygon clipped by a convex polygon (Sutherland-Hodgman, subject = polygon, clip = convex). */
export function clippedArea(subject: Pt[], convex: Pt[]): number {
  let out = openRing(subject);
  const clip = signedArea(convex) < 0 ? [...convex].reverse() : convex;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const cut = (p: Pt, q: Pt): Pt => {
      const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
      const t = d1 / (d1 - d2);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const next: Pt[] = [];
    for (let k = 0; k < out.length; k++) {
      const p = out[k], q = out[(k + 1) % out.length];
      if (inside(q)) { if (!inside(p)) next.push(cut(p, q)); next.push(q); } else if (inside(p)) next.push(cut(p, q));
    }
    out = next;
  }
  return Math.abs(signedArea(out));
}

/** Intersection over union of a footprint ring and a rectangle. */
export function rectIoU(ring: Pt[], rect: Rect): number {
  const a = Math.abs(signedArea(openRing(ring))), b = rect.length * rect.width, i = clippedArea(ring, rect.corners);
  return i / (a + b - i);
}

/** Distance from p to segment ab and the closest point. */
export function nearestOnSegment(p: Pt, a: Pt, b: Pt): {d: number; q: Pt} {
  const dx = b[0] - a[0], dz = b[1] - a[1], den = dx * dx + dz * dz;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / den)) : 0;
  const q: Pt = [a[0] + dx * t, a[1] + dz * t];
  return {d: Math.hypot(p[0] - q[0], p[1] - q[1]), q};
}
