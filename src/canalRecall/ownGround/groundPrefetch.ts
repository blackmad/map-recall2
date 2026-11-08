// The start neighbourhood built during the hold (lane R5-A #260 step 2; pure).
//
// Measured 2026-11-08 on a quiet machine (3 cold desktop Free Ride starts, workerTrace.ts): the three ground workers
// are ready 1.6–2.6 s before the ride is revealed, but no cell is asked for until ~0.3–0.65 s before the reveal (the
// game does not sync the ground while it loads). The camera already sits at the start pose (zoom 17, pitch 60, the
// same cell as after the reveal) for the whole hold. So, until the game's first ground update, the ground follows the
// camera's pose: the start cell and its neighbours build during the hold instead of after it.
//
// A pose is used once its cell has been the same for two polls (a camera still being placed is not built around), and
// only at zooms the ground draws at. `?groundPrefetch=0` (or `window.__canalRecallGroundPrefetch = false`) waits for
// the game's first update, as before.

export interface StartView { lngLat: [number, number]; zoom: number; pitch: number }

export const PREFETCH_POLL_MS = 200;
/** Stop following the camera this long after the workers are ready, if the game never updates the ground. */
export const PREFETCH_MAX_MS = 30_000;

export function groundPrefetchFlag(search?: string): boolean {
  const g = globalThis as { __canalRecallGroundPrefetch?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallGroundPrefetch === 'boolean') return g.__canalRecallGroundPrefetch;
  return new URLSearchParams(search ?? g.location?.search ?? '').get('groundPrefetch') !== '0';
}

/**
 * One poll of the camera during the hold: `use` when the pose is drawable (zoom ≥ `minZoom`, finite) and its cell
 * `key` equals the previous poll's (`lastKey`). `nextKey` is what to remember for the next poll.
 */
export function prefetchStep(view: StartView | null, key: string | null, lastKey: string | null, minZoom: number): { use: boolean; nextKey: string | null } {
  if (!view || !key || !Number.isFinite(view.zoom) || !Number.isFinite(view.lngLat[0]) || !Number.isFinite(view.lngLat[1]) || view.zoom < minZoom) return { use: false, nextKey: null };
  return { use: key === lastKey, nextKey: key };
}
