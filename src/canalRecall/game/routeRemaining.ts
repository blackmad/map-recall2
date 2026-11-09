/**
 * How far is left to ride (R2-10, #302). The destination readout used the
 * straight line to the finish, so Today's ride said "about 1.5 km" on the
 * landing (the route) and "1.1 km" at the start (the crow). This measures the
 * planned route instead: the rider's offset onto the nearest point of the
 * path, plus the path from there to its end, plus the end's gap to the
 * finish. With no path it is the straight line, as before. By the triangle
 * inequality the answer is never shorter than the straight line.
 *
 * World units in, world units out (the HUD divides by PIXELS_PER_METER).
 */
export interface XY { x: number; y: number }

export interface RemainingCache {
  path: readonly XY[];
  /** suffix[i]: path length from point i to the last point. */
  suffix: Float64Array;
}

export function routeSuffixLengths(path: readonly XY[]): Float64Array {
  const suffix = new Float64Array(path.length);
  for (let i = path.length - 2; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  }
  return suffix;
}

export function remainingRouteDistance(
  path: readonly XY[] | null | undefined,
  player: XY,
  finish: XY,
  cache?: RemainingCache | null,
): { distance: number; cache: RemainingCache | null } {
  const straight = Math.hypot(finish.x - player.x, finish.y - player.y);
  if (!path || path.length < 2 || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return { distance: straight, cache: null };
  const memo = cache && cache.path === path ? cache : { path, suffix: routeSuffixLengths(path) };
  let best = Infinity;
  let bestRemaining = straight;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / len2)) : 0;
    const px = a.x + dx * t, py = a.y + dy * t;
    const offset = Math.hypot(player.x - px, player.y - py);
    if (offset < best) {
      best = offset;
      bestRemaining = offset + Math.sqrt(len2) * (1 - t) + memo.suffix[i + 1];
    }
  }
  const last = path[path.length - 1];
  const distance = bestRemaining + Math.hypot(finish.x - last.x, finish.y - last.y);
  return { distance: Math.max(straight, distance), cache: memo };
}
