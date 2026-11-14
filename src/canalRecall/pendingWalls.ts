/**
 * Per-area hand-over from MapLibre's building layers to the three.js facades (lane LS, 2026-11-14; `?wallsPerArea=1`).
 *
 * Under the three.js look, vector-map.js ghosts MapLibre's walls (opacity 0) and hides its roofs and ground floors as
 * soon as the facade layer is on, before that layer has drawn anything: districts the facades have not built yet
 * showed bare ground, or a pyramidal roof standing alone (state 2 of the load review). With the flag, a copy of each
 * of those layers stays drawn for the buildings whose z14 tile (`t14`, buildingTilesBrowser.ts stampTile) the facade
 * layer does not draw yet (ThreeBuildings.drawnTiles), and goes once every resident tile is drawn or after a cap.
 */

/** The MapLibre layers that stand in until the facades draw an area (ground floors, walls, flat-roof lids). */
export const PENDING_SOURCE_LAYERS = ['osm-colored-building-ground-floors', 'osm-colored-buildings', 'osm-colored-building-roofs'] as const;
export const PENDING_SUFFIX = '-pending';
/** The stand-ins go this long after they first showed, drawn or not (a tile the facades never build must not keep them). */
export const PENDING_CAP_MS = 30_000;

type LayerSpec = { id: string; type: string; source?: unknown; 'source-layer'?: string; minzoom?: number; maxzoom?: number; filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> };

/** `filter` restricted to buildings outside the drawn tiles (a building with no `t14` counts as not drawn). */
export function pendingFilter(base: unknown, drawn: readonly string[]): unknown {
  const notDrawn = ['!', ['in', ['coalesce', ['get', 't14'], ''], ['literal', [...drawn]]]];
  return base ? ['all', base, notDrawn] : notDrawn;
}

/** The stand-in copy of one building layer: same source, paint and filter, drawn at `opacity`, only where not drawn. */
export function pendingLayer(spec: LayerSpec, drawn: readonly string[], opacity: unknown): LayerSpec {
  const out: LayerSpec = { id: spec.id + PENDING_SUFFIX, type: spec.type, source: spec.source, filter: pendingFilter(spec.filter, drawn), layout: { visibility: 'visible' }, paint: { ...(spec.paint ?? {}) } };
  if (spec['source-layer']) out['source-layer'] = spec['source-layer'];
  if (spec.minzoom !== undefined) out.minzoom = spec.minzoom;
  if (spec.maxzoom !== undefined) out.maxzoom = spec.maxzoom;
  if (out.paint && 'fill-extrusion-opacity' in out.paint) out.paint['fill-extrusion-opacity'] = opacity;
  return out;
}

/** Whether the stand-ins are done: every resident tile drawn, or the cap passed since they first showed. */
export function pendingDone(drawn: number, resident: number, shownAt: number | null, now: number, capMs = PENDING_CAP_MS): boolean {
  if (resident > 0 && drawn >= resident) return true;
  return shownAt !== null && now - shownAt > capMs;
}

/** `?wallsPerArea=1` turns the per-area hand-over on (`window.__canalRecallWallsPerArea` overrides). */
export function wallsPerAreaEnabled(search?: string): boolean {
  try {
    const g = globalThis as { __canalRecallWallsPerArea?: boolean; location?: { search?: string } };
    if (typeof g.__canalRecallWallsPerArea === 'boolean') return g.__canalRecallWallsPerArea;
    return new URLSearchParams(search ?? g.location?.search ?? '').get('wallsPerArea') === '1';
  } catch { return false; }
}
