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
 * Call `onMove` after a rendered frame whose view (zoom and bounds) differs from the last one: `on('moveend')` for a
 * participant on WorldCamera. A frame that only redraws (an animation, a fade) does not call it, so an `onMove` that
 * asks for a repaint never loops. Returns the unsubscribe.
 */
export function onViewChange(camera: WorldCamera, onMove: () => void): () => void {
  let last = '';
  return camera.onFrame(() => {
    const b = camera.bounds(), key = b ? `${camera.zoom()},${b.west},${b.south},${b.east},${b.north}` : '';
    if (key === last) return;
    last = key;
    onMove();
  });
}
