// The WorldCamera (worldViewApi.ts) a participant reads instead of the MapLibre-shaped `map` it is handed (P5 step B6,
// docs/handoffs/flip-inventory-20261031.md). Under `?engine=own` the map is the CameraMap shim and its `api` is the
// engine's camera; under MapLibre it is a `maplibregl.Map`, read through the same five members. A participant that
// takes this instead of calling `map.getBounds()`/`getZoom()`/`on('moveend')` no longer needs the shim, and at P5
// only the MapLibre branch here goes.
import type { LngLatLike, ViewBounds, WorldCamera } from './worldViewApi';

type MapLibreLike = {
  getBounds(): { getWest(): number; getEast(): number; getSouth(): number; getNorth(): number } | null;
  getZoom(): number; getPitch(): number; getBearing(): number;
  getCenter(): { lng: number; lat: number };
  project(p: LngLatLike): { x: number; y: number };
  unproject(p: unknown): { lng: number; lat: number } | null;
  on(type: string, f: () => void): unknown; off(type: string, f: () => void): unknown; once(type: string, f: () => void): unknown;
  triggerRepaint?(): void;
};

/** `map.api` when `map` is the engine's CameraMap, else a WorldCamera over a MapLibre map's own getters. */
export function worldCameraOf(map: unknown): WorldCamera {
  const api = (map as { api?: Partial<WorldCamera> } | null)?.api;
  if (api && typeof api.bounds === 'function' && typeof api.onFrame === 'function') return api as WorldCamera;
  const m = map as MapLibreLike;
  return {
    project: p => m.project(p),
    unproject: p => m.unproject(p),
    center: () => m.getCenter(),
    zoom: () => m.getZoom(),
    bounds: () => { const b = m.getBounds(); return b ? Object.assign(b, { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() }) : null; },
    pitch: () => m.getPitch(),
    bearing: () => m.getBearing(),
    onFrame(cb) { const f = () => cb(); m.on('render', f); return () => { m.off('render', f); }; },
    // MapLibre's `idle` fires after a frame that leaves nothing to do: an edge, not a state. A map already idle draws
    // no further frame on its own (render on demand), so a bare once('idle') waited for ever (world-v1-ab, #129
    // 2026-11-02). Asking for one frame makes the next idle come, now or after the work in flight.
    whenIdle: () => new Promise<void>(resolve => { m.once('idle', () => resolve()); m.triggerRepaint?.(); }),
  };
}

/** Whether `lngLat` ([lng, lat] or {lng, lat}) lies in `b` (MapLibre's LngLatBounds.contains, no antimeridian). */
export function boundsContain(b: ViewBounds | null, lngLat: LngLatLike): boolean {
  if (!b) return false;
  const p = lngLat as { lng?: number; lat?: number } & ArrayLike<number>;
  const lng = Array.isArray(lngLat) ? p[0] : p.lng ?? NaN, lat = Array.isArray(lngLat) ? p[1] : p.lat ?? NaN;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

/**
 * How often a participant's moveend work may run while the view moves (lane cell-hidden-skip 2026-11-27): 10 a second.
 * Riding, the view changes every frame, so the landmarks' evict/request/levels walk, the streamer's re-plan and the
 * animals' update ran 60–120 times a second (15–19 ms/s of main thread, docs/perf/desktop-power-20261127.md). None of
 * it draws on that frame: each asks for loads or levels that arrive later anyway. `?viewChangeHz=0` (or
 * `window.__canalRecallViewChangeHz = 0`): every changed frame, as before; `?viewChangeHz=<n>` another rate.
 */
export const VIEW_CHANGE_HZ = 10;
export function viewChangeHz(search: string = typeof location !== 'undefined' ? location.search : '', w: any = globalThis): number {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('viewChangeHz'); } catch { /* no location */ }
  if (v === null && w.__canalRecallViewChangeHz !== undefined) v = String(w.__canalRecallViewChangeHz);
  if (v === null) return VIEW_CHANGE_HZ;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : VIEW_CHANGE_HZ;
}

/**
 * Call `onMove` after a rendered frame whose view (zoom and bounds) differs from the last one: `on('moveend')` for a
 * participant on WorldCamera. A frame that only redraws (an animation, a fade) does not call it, so an `onMove` that
 * asks for a repaint never loops. At most `hz` a second (viewChangeHz; 0: every changed frame): the first change runs
 * at once, later ones wait out the interval, and the last change always runs (on the next frame past the interval, or
 * from a timer when the view has stopped and no frame comes). Returns the unsubscribe.
 */
export function onViewChange(camera: WorldCamera, onMove: () => void, options: { hz?: number; now?: () => number; setTimer?: (f: () => void, ms: number) => unknown; clearTimer?: (t: unknown) => void } = {}): () => void {
  // The rate: `options.hz`, else a live `window.__canalRecallViewChangeHz` number (in-page A/B), else the query's.
  const base = options.hz ?? viewChangeHz(), g = globalThis as { __canalRecallViewChangeHz?: unknown };
  const intervalNow = () => { const live = options.hz === undefined ? g.__canalRecallViewChangeHz : undefined; const hz = typeof live === 'number' && live >= 0 ? live : base; return hz > 0 ? 1000 / hz : 0; };
  const now = options.now ?? (() => performance.now());
  const setTimer = options.setTimer ?? ((f: () => void, ms: number) => setTimeout(f, ms));
  const clearTimer = options.clearTimer ?? ((t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>));
  // The last view seen, as numbers (no key string a frame); `none`: no bounds (the start, as the old '' key).
  let z = 0, w = 0, s = 0, e = 0, n = 0, none = true;
  let lastRun = -Infinity, pending = false, timer: unknown = null, live = true;
  const run = () => {
    if (timer !== null) { clearTimer(timer); timer = null; }
    pending = false; lastRun = now();
    onMove();
  };
  const off = camera.onFrame(() => {
    const b = camera.bounds();
    let changed: boolean;
    if (!b) { changed = !none; none = true; }
    else {
      const zoom = camera.zoom();
      changed = none || zoom !== z || b.west !== w || b.south !== s || b.east !== e || b.north !== n;
      if (changed) { none = false; z = zoom; w = b.west; s = b.south; e = b.east; n = b.north; }
    }
    if (!changed && !pending) return;
    const interval = intervalNow();
    if (!interval) { run(); return; }
    const wait = lastRun + interval - now();
    if (wait <= 0) { run(); return; }
    pending = true;
    if (timer === null) timer = setTimer(() => { timer = null; if (live && pending) run(); }, wait);
  });
  return () => { live = false; if (timer !== null) { clearTimer(timer); timer = null; } off(); };
}
