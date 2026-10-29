/**
 * Named routing streets within reach of a footprint, for the landmark factory's `facts --street` pass (factory.ts).
 * Pure: the caller loads public/data/extracts/amsterdam/streets-routing.json and passes its rows in.
 */
import {lngLatToRd} from '../facade/rdNew.ts';

export interface RoutingStreet { name: string; pathsRD: [number, number][][] }
type RoutingRow = {name?: string | null; path?: number[][]; paths?: number[][][]};

/** Routing rows (paths are [lat, lng]) converted to RD metres, named rows only. */
export function routingStreetsRD(rows: RoutingRow[]): RoutingStreet[] {
  return rows.filter(s => s.name).map(s => ({
    name: s.name!,
    pathsRD: (s.paths ?? [s.path!]).map(p => p.map(q => { const r = lngLatToRd([q[1], q[0]]); return [r.x, r.y] as [number, number]; })),
  }));
}

/** Named streets whose routing path passes within `maxM` of the ring, nearest first (at most `limit`). */
export function nearbyStreets(ringRD: [number, number][], streets: RoutingStreet[], maxM = 30, limit = 3): string[] {
  const xs = ringRD.map(p => p[0]), ys = ringRD.map(p => p[1]);
  const box = {w: Math.min(...xs) - 40, e: Math.max(...xs) + 40, s: Math.min(...ys) - 40, n: Math.max(...ys) + 40};
  const segDist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const best = new Map<string, number>();
  for (const s of streets) for (const path of s.pathsRD) {
    if (!path.some(q => q[0] > box.w && q[0] < box.e && q[1] > box.s && q[1] < box.n)) continue;
    let d = Infinity;
    for (const v of ringRD) for (let i = 1; i < path.length; i++) d = Math.min(d, segDist(v, path[i - 1], path[i]));
    if (d <= maxM && d < (best.get(s.name) ?? Infinity)) best.set(s.name, d);
  }
  return [...best.entries()].sort((a, b) => a[1] - b[1]).slice(0, limit).map(e => e[0]);
}
