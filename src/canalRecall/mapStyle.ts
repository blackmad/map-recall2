/**
 * Does this MapLibre map have a style right now?
 *
 * MapLibre 5 destroys the style on `webglcontextlost` (`map.style = null`) and
 * rebuilds it from a snapshot on `webglcontextrestored` (map.ts `_contextLost`
 * / `_contextRestored`); `remove()` leaves none for good. In between,
 * `getLayer`, `getSource` and `getStyle().layers` throw or answer undefined
 * (Sentry CANAL-RECALL-8/-A/-B, Chrome Mobile on Android 10, frames after the
 * context died). Code that runs from timers, animation frames or awaited
 * fetches checks this first. A test double without a `style` field counts as
 * styled.
 */
export function mapHasStyle(map: unknown): boolean {
  if (!map || typeof map !== 'object') return false;
  return !('style' in map) || (map as { style?: unknown }).style != null;
}

/** `map.remove()` ran: the style is never coming back. */
export function mapRemoved(map: unknown): boolean {
  return !!map && typeof map === 'object' && (map as { _removed?: unknown })._removed === true;
}
