/**
 * Rideable-corridor check for market stalls (lane market-stalls-20261120). Pure.
 *
 * The rider follows the routing graph (public/data/extracts/amsterdam/streets-routing.json: one record per street with
 * `path` / `paths` as [lat, lng] polylines). A stall must leave every routed line clear by ROUTE_CLEAR_M, its roof
 * overhang included (stallFootprint): a rider on the line never meets canvas, a frame or a van.
 */
import { stallFootprint, type LngLat, type MarketInstance } from './placer.js';
import { VAN } from './stallKit.js';

/** Minimum distance (m) from any routed line to a stall footprint (the Albert Cuyp regression's floor). */
export const ROUTE_CLEAR_M = 1.0;

export type RoutingStreet = { id: string; name?: string; highway?: string; path?: [number, number][]; paths?: [number, number][][] };
export type RouteHit = { stall: string; street: string; name: string; highway: string; distM: number };

const RAD = Math.PI / 180, KY = 110540;

/** Every routed polyline (lng, lat) with a point inside `box` [w, s, e, n] grown by `padM`. */
export function routedLinesNear(streets: readonly RoutingStreet[], box: readonly [number, number, number, number], padM = 30): { id: string; name: string; highway: string; line: LngLat[] }[] {
  const kx = 111320 * Math.cos(((box[1] + box[3]) / 2) * RAD), dx = padM / kx, dy = padM / KY, out: { id: string; name: string; highway: string; line: LngLat[] }[] = [];
  for (const s of streets) for (const p of s.paths ?? (s.path ? [s.path] : [])) {
    const line = p.map(([lat, lng]) => [lng, lat] as LngLat);
    if (line.some(([x, y]) => x >= box[0] - dx && x <= box[2] + dx && y >= box[1] - dy && y <= box[3] + dy)) out.push({ id: s.id, name: s.name ?? '', highway: s.highway ?? '', line });
  }
  return out;
}

/** Metres from a point to a polyline (local equirectangular about the point). */
export function distToLine(p: LngLat, line: readonly LngLat[]): number {
  const kx = 111320 * Math.cos(p[1] * RAD);
  let best = Infinity;
  for (let k = 1; k < line.length; k++) {
    const ax = (line[k - 1][0] - p[0]) * kx, ay = (line[k - 1][1] - p[1]) * KY, bx = (line[k][0] - p[0]) * kx, by = (line[k][1] - p[1]) * KY;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Polygon (lng, lat) contains a point. */
const inside = (p: LngLat, poly: readonly LngLat[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/**
 * Stalls (frames, tables, bare frames) and vans closer than `clearM` to a routed line: the footprint's edges are sampled
 * every ~0.25 m, a line vertex inside the footprint counts as 0. Empty = the corridor is clear.
 */
export function routeConflicts(instances: readonly MarketInstance[], lines: readonly { id: string; name: string; highway: string; line: LngLat[] }[], clearM = ROUTE_CLEAR_M): RouteHit[] {
  const hits: RouteHit[] = [];
  for (const i of instances) {
    const isVan = i.part === 'van';
    if (!isVan && i.part !== 'stall-frame' && i.part !== 'stall-table' && i.part !== 'stall-bare') continue;
    const poly = isVan ? vanFootprint(i) : stallFootprint(i), samples: LngLat[] = [];
    for (let k = 0; k < 4; k++) {
      const a = poly[k], b = poly[(k + 1) % 4], n = 20;
      for (let t = 0; t < n; t++) samples.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]);
    }
    let worst: RouteHit | null = null;
    for (const l of lines) {
      const d = l.line.some(p => inside(p, poly)) ? 0 : Math.min(...samples.map(p => distToLine(p, l.line)));
      if (d < clearM && (!worst || d < worst.distM)) worst = { stall: i.stall, street: l.id, name: l.name, highway: l.highway, distM: +d.toFixed(2) };
    }
    if (worst) hits.push(worst);
  }
  return hits;
}

/** A van's footprint (lng, lat corners): its body centred on the instance, long axis along the row. */
export function vanFootprint(i: Pick<MarketInstance, 'lng' | 'lat' | 'yaw'>): LngLat[] {
  const kx = 111320 * Math.cos(i.lat * RAD), c = Math.cos(i.yaw), s = Math.sin(i.yaw), l = VAN.length / 2, w = VAN.width / 2 + 0.6;
  return ([[-l, -w], [l, -w], [l, w], [-l, w]] as [number, number][]).map(([x, y]) => [i.lng + (x * c - y * s) / kx, i.lat + (x * s + y * c) / KY]);
}
