// Water opened under moored houseboats (pure).
//
// User 2026-10-14 ("ground is running into houseboats", Westelijke Eilanden /
// Westerkanaal): the own ground's water is the OpenFreeMap z14 water snapshot
// (elevation-v1), generalised by a metre or more and often drawn to the hull
// line, while the houseboats are OSM `building=houseboat` footprints mapped on
// the aerial. With the land raised 1.77 m above the water, every boat whose
// hull reaches past the generalised shore sat half under the quay: the land,
// its coping cap and the street bands along it ran over the boat.
//
// Rule: a boat that is partly in the water (some sample inside its hull lies
// in a water polygon, some does not), or wholly in it with a shore line (a
// quay wall) running through its berth, gets its berth opened: its minimum-area
// rectangle grown by MOORING_MARGIN_M becomes a water polygon at the level of
// the water it floats in, the shore pieces inside it are dropped and the
// berth's edges that lie on land become shores (quay walls), so the land
// follows the boat's water edge with the wall on the land side. Boats wholly
// on land (boathouses in yards, hauled-out hulls) and wholly in the water are
// left alone. A boat belongs to the cell holding its centroid; the berth is
// not clipped (neighbour cells cut their land with it through `waterAround`).

import type { Vec2 } from './surface.js';
import type { WaterGeometry } from './water.js';

/** Clearance around the hull, metres: the berth's quay wall stands this far off the boat. */
export const MOORING_MARGIN_M = 0.4;
/** Larger footprints are not boats to berth (a floating pavilion is its own water polygon in OSM). */
export const MOORING_MAX_AREA_M2 = 600;

export interface Boat { id: string; ring: readonly Vec2[] }

const inPolygon = (poly: readonly (readonly Vec2[])[], x: number, y: number) => {
  let c = false;
  for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
  return c;
};

const openRing = (ring: readonly Vec2[]): Vec2[] => (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : [...ring]);

function convexHull(points: readonly Vec2[]): Vec2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [], upper: Vec2[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Minimum-area enclosing rectangle of a ring (one hull edge lies on a side), grown by `margin`; counter-clockwise. */
export function berthRect(ring: readonly Vec2[], margin: number): { rect: Vec2[]; area: number } | null {
  const hull = convexHull(openRing(ring));
  if (hull.length < 3) return null;
  let best: { area: number; u: Vec2; v: Vec2; lo: Vec2; hi: Vec2 } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const u: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], v: Vec2 = [-u[1], u[0]];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of hull) { const pu = q[0] * u[0] + q[1] * u[1], pv = q[0] * v[0] + q[1] * v[1]; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, u, v, lo: [u0, v0], hi: [u1, v1] };
  }
  if (!best) return null;
  const { u, v } = best, [u0, v0] = [best.lo[0] - margin, best.lo[1] - margin], [u1, v1] = [best.hi[0] + margin, best.hi[1] + margin];
  const at = (pu: number, pv: number): Vec2 => [u[0] * pu + v[0] * pv, u[1] * pu + v[1] * pv];
  // u, v right-handed (v = u rotated +90°): (u0,v0) → (u1,v0) → (u1,v1) → (u0,v1) runs counter-clockwise.
  return { rect: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], area: best.area };
}

/** Centroid plus each vertex pulled `inset` of the way toward it. */
export function hullSamples(ring: readonly Vec2[], inset = 0.15): Vec2[] {
  const pts = openRing(ring);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [[cx, cy], ...pts.map(p => [p[0] + (cx - p[0]) * inset, p[1] + (cy - p[1]) * inset] as Vec2)];
}

/**
 * Open the berths of the boats whose centroid lies in `rect` and that float
 * partly outside the cell's water. Returns the new geometry and the boat ids.
 */
export function openUnderHouseboats(geo: WaterGeometry, boats: readonly Boat[], rect: readonly [number, number, number, number], fallbackZ: number): { geo: WaterGeometry; opened: string[] } {
  const polyAt = (x: number, y: number) => geo.polygons.findIndex(p => inPolygon(p, x, y));
  const added: Vec2[][] = [], addedLevels: number[] = [], opened: string[] = [];
  for (const b of boats) {
    const samples = [...hullSamples(b.ring), ...openRing(b.ring)];
    const [cx, cy] = samples[0];
    if (cx < rect[0] || cx >= rect[2] || cy < rect[1] || cy >= rect[3]) continue;
    const where = samples.map(([x, y]) => polyAt(x, y));
    const wet = where.find(k => k >= 0);
    if (wet === undefined) continue;
    const berth = berthRect(b.ring, MOORING_MARGIN_M);
    if (!berth || berth.area > MOORING_MAX_AREA_M2) continue;
    // Wholly in the water polygon still needs a berth when a shore line (its quay wall) runs through the hull.
    if (where.every(k => k >= 0) && !geo.shores.some(line => line.some((a, i) => i > 0 && inPolygon([berth.rect], (a[0] + line[i - 1][0]) / 2, (a[1] + line[i - 1][1]) / 2)))) continue;
    added.push(berth.rect);
    addedLevels.push(geo.levels?.[wet] ?? fallbackZ);
    opened.push(b.id);
  }
  if (!added.length) return { geo, opened };
  const inBerth = (x: number, y: number) => added.some(r => inPolygon([r], x, y));
  const boxes = added.map(r => [Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1])), Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))]);
  const nearBerth = (a: Vec2, b: Vec2) => boxes.some(([x0, y0, x1, y1]) => Math.max(a[0], b[0]) >= x0 && Math.min(a[0], b[0]) <= x1 && Math.max(a[1], b[1]) >= y0 && Math.min(a[1], b[1]) <= y1);
  const shores: Vec2[][] = [], shoreLevels: number[] = [];
  // Existing shores: drop the pieces inside a berth (the quay wall that ran through the boat).
  geo.shores.forEach((line, k) => {
    let cur: Vec2[] = [];
    const flush = () => { if (cur.length >= 2) { shores.push(cur); shoreLevels.push(geo.shoreLevels?.[k] ?? fallbackZ); } cur = []; };
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1];
      // A long shore segment can cross a berth with both ends and its midpoint outside: split it at 0.5 m near berths.
      const n = nearBerth(a, b) ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5)) : 1;
      for (let j = 0; j < n; j++) {
        const p: Vec2 = j ? [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n] : a, q: Vec2 = j + 1 < n ? [a[0] + (b[0] - a[0]) * (j + 1) / n, a[1] + (b[1] - a[1]) * (j + 1) / n] : b;
        if (inBerth((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)) { flush(); continue; }
        if (!cur.length) cur.push(p);
        cur.push(q);
      }
    }
    flush();
  });
  // New shores: each berth edge, in 0.5 m pieces, where it lies on land (not in the old water, not in another berth).
  // A counter-clockwise ring has its inside (the water) on the left, as shores do.
  added.forEach((ring, k) => {
    let cur: Vec2[] = [];
    const flush = () => { if (cur.length >= 2) { shores.push(cur); shoreLevels.push(addedLevels[k]); } cur = []; };
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
      for (let j = 0; j < n; j++) {
        const p: Vec2 = [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n], q: Vec2 = [a[0] + (b[0] - a[0]) * (j + 1) / n, a[1] + (b[1] - a[1]) * (j + 1) / n];
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        const land = polyAt(mx, my) < 0 && !added.some((r, m) => m !== k && inPolygon([r], mx, my));
        if (!land) { flush(); continue; }
        if (!cur.length) cur.push(p);
        cur.push(q);
      }
    }
    flush();
  });
  return {
    geo: { polygons: [...geo.polygons, ...added.map(r => [r])], shores, ...(geo.levels ? { levels: [...geo.levels, ...addedLevels] } : {}), ...(geo.shoreLevels || geo.levels ? { shoreLevels } : {}) },
    opened,
  };
}
