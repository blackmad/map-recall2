// Route-ahead prefetch for the detailed facade tiles (lane E4, #217).
//
// The detailed block (detailRing.ts) is 2×2 z16 tiles (z17 on a touch device) led along the heading, so a tile the
// route enters next turned detailed only when the block reached it: sometimes ~100 m ahead, in full view, and its
// coarse shells swapped to detailed walls, roofs and extras on screen. These helpers name the tiles the route
// crosses over the next `aheadM` metres from the rider (the planned route when there is one, else the heading), so
// they can join the detailed set early enough to be built and installed before they are near.
//
// Pure maths on lng/lat (no DOM, no three.js).

import type { LngLat } from '../streamingLookAhead.js';

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

/** Metres of route ahead whose tiles turn detailed early: desktop (z16 tiles, ~380 m) and touch (z17, ~190 m). */
export const ROUTE_AHEAD_M = { 16: 320, 17: 260 } as Record<number, number>;
/** At most this many tiles beyond the detailed block. */
export const ROUTE_AHEAD_MAX_TILES = { 16: 2, 17: 3 } as Record<number, number>;
/** A rider further than this from the route is off it (a detour): the heading leads instead. */
export const ROUTE_OFF_M = 80;
/** Sampling step along the route, metres (well under a z17 tile's ~190 m side). */
const STEP_M = 15;

export function tileKeyAt(lng: number, lat: number, zoom: number): string {
  const n = 2 ** zoom, rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${x}/${y}`;
}

/** Where along the route the rider is: the segment index and the fraction along it, and how far off it (metres). */
export type RouteFix = { index: number; f: number; offM: number };

/** The nearest point of `route` to `at`; searches near `hint` first (a riding cursor), the whole route if that is far. */
export function nearestOnRoute(route: readonly LngLat[], at: LngLat, hint = -1): RouteFix | null {
  if (route.length < 2) return null;
  const kx = mPerDegLng(at[1]);
  const search = (from: number, to: number): RouteFix | null => {
    let best: RouteFix | null = null;
    for (let i = Math.max(0, from); i < Math.min(route.length - 1, to); i++) {
      const a = route[i], b = route[i + 1];
      const ax = (a[0] - at[0]) * kx, ay = (a[1] - at[1]) * M_PER_DEG_LAT, bx = (b[0] - at[0]) * kx, by = (b[1] - at[1]) * M_PER_DEG_LAT;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const f = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      const d = Math.hypot(ax + dx * f, ay + dy * f);
      if (!best || d < best.offM) best = { index: i, f, offM: d };
    }
    return best;
  };
  if (hint >= 0) {
    const near = search(hint - 20, hint + 200);
    if (near && near.offM <= ROUTE_OFF_M) return near;
  }
  return search(0, route.length - 1);
}

/** Tile keys at `zoom` along `points` (lng/lat, metres apart ≤ STEP_M), in order, without repeats. */
function tilesAlong(points: Iterable<LngLat>, zoom: number): string[] {
  const out: string[] = [];
  for (const p of points) { const k = tileKeyAt(p[0], p[1], zoom); if (!out.includes(k)) out.push(k); }
  return out;
}

/** Points every STEP_M metres along the route from `fix` for `aheadM` metres. */
function* walkRoute(route: readonly LngLat[], fix: RouteFix, aheadM: number): Generator<LngLat> {
  let left = aheadM, i = fix.index, f = fix.f, carry = 0;
  while (i < route.length - 1 && left > 0) {
    const a = route[i], b = route[i + 1], kx = mPerDegLng(a[1]);
    const len = Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * M_PER_DEG_LAT);
    let s = f * len + carry;
    while (s <= len && left > 0) {
      const t = len > 0 ? s / len : 0;
      yield [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      s += STEP_M; left -= STEP_M;
    }
    carry = s - len; i++; f = 0;
  }
  if (left > 0 && route.length) yield route[route.length - 1];
}

/**
 * The tiles the route crosses over the next `aheadM` metres from the rider, in route order (the rider's own tile
 * first). Null when there is no route or the rider is off it (ROUTE_OFF_M). `cursor` carries the segment found last
 * time so a ride searches a short window.
 */
export function routeAheadTiles(route: readonly LngLat[] | null, rider: LngLat, zoom: number, aheadM: number, cursor?: { index: number }): string[] | null {
  if (!route || route.length < 2) return null;
  const fix = nearestOnRoute(route, rider, cursor?.index ?? -1);
  if (!fix || fix.offM > ROUTE_OFF_M) return null;
  if (cursor) cursor.index = fix.index;
  return tilesAlong(walkRoute(route, fix, aheadM), zoom);
}

/** The tiles a straight line from the rider along `direction` (east/north unit vector) crosses over `aheadM` metres. */
export function headingAheadTiles(rider: LngLat, direction: readonly [number, number], zoom: number, aheadM: number): string[] {
  const points: LngLat[] = [];
  for (let s = 0; s <= aheadM; s += STEP_M) points.push([rider[0] + (direction[0] * s) / mPerDegLng(rider[1]), rider[1] + (direction[1] * s) / M_PER_DEG_LAT]);
  return tilesAlong(points, zoom);
}

/** The detailed tiles: the block's, then up to `max` route-ahead tiles that are not in it, in route order. */
export function withAhead(block: readonly string[], ahead: readonly string[] | null, max: number): string[] {
  const out = [...block];
  let added = 0;
  for (const k of ahead ?? []) {
    if (added >= max) break;
    if (out.includes(k)) continue;
    out.push(k); added++;
  }
  return out;
}

/** `?routeAhead=0` (or `window.__canalRecallRouteAhead = false`): no route-ahead prefetch (A/B). */
export function routeAheadEnabled(): boolean {
  try {
    const g = globalThis as { __canalRecallRouteAhead?: boolean; location?: { search?: string } };
    if (g.__canalRecallRouteAhead === false) return false;
    return new URLSearchParams(g.location?.search ?? '').get('routeAhead') !== '0';
  } catch { return true; }
}
