/**
 * Which drawn landmark models to give back when too many are resident.
 *
 * Until 2026-10-23 the landmark layer loaded every model that came into view
 * and never dropped one, so residency grew with the length of the ride. A
 * Safari/Mac session lost its WebGL context after 30 landmark GLBs landed in
 * 30 s (Sentry CANAL-RECALL-5: `createShader` returned null mid-frame), and
 * phones that ride across the centre crash after a while.
 *
 * Policy: never evict a model in view (or one that cannot be rebuilt cheaply);
 * above the budget, drop the off-view ones furthest from the camera first, and
 * drop down to `budget - slack` so the next frames do not evict one at a time.
 * A dropped model's extrusion comes back and the model reloads (from the HTTP
 * cache) when it is in view again.
 */

export interface ResidentModel {
  id: string;
  /** Squared distance from the camera centre (any consistent unit). */
  distanceSq: number;
  /** In (or touching) the current view. */
  inView: boolean;
  /** False for models that must stay (being swapped, highlighted, procedural). */
  evictable: boolean;
}

export interface ResidencyBudget {
  budget: number;
  /** Evict this far below the budget once eviction starts. */
  slack?: number;
}

export function pickEvictions(models: readonly ResidentModel[], { budget, slack = 4 }: ResidencyBudget): string[] {
  if (models.length <= budget) return [];
  const target = Math.max(0, budget - slack);
  const candidates = models
    .filter(model => model.evictable && !model.inView)
    .sort((a, b) => b.distanceSq - a.distanceSq);
  const excess = models.length - target;
  return candidates.slice(0, excess).map(model => model.id);
}

/**
 * Resident landmark budget: 24 on touch devices, 72 on desktop. `?landmarkBudget=N`
 * overrides it for before/after measurement.
 */
export function landmarkResidencyBudget(search: string, coarsePointer: boolean): number {
  // A regex, not URLSearchParams: the bundle also runs in check sandboxes without it.
  const asked = Number(/[?&]landmarkBudget=(\d+)/.exec(search)?.[1]);
  if (Number.isFinite(asked) && asked >= 4) return Math.min(asked, 1000);
  return coarsePointer ? 24 : 72;
}

/**
 * Landmark reach (lane R1-C, #225): metres from the view centre within which a landmark model loads and counts as
 * "in view" for residency. A pitched view's bounds reach the horizon (mapCamera.ts visibleBounds clamps at 20 km), so
 * from the air "in view" was every landmark in Amsterdam: the 3-minute aerial pan held up to 627 models resident
 * against a budget of 72 (none could be evicted while in view) and re-uploaded ~12 GB of GPU data as they cycled
 * (scripts/aerial-pan.mjs, 2026-11-06). Beyond the reach a model is never requested and, once over budget, is given
 * back to its extrusion furthest-first like an off-view one. 2000 m on desktop (the 12 resident z14 building tiles reach
 * about as far), 1000 m on touch. `?landmarkReach=0` turns it off (the horizon-deep reach before); `?landmarkReach=N`
 * sets it.
 */
export function landmarkReachM(search: string, coarsePointer: boolean): number {
  const m = /[?&]landmarkReach=(\d+)/.exec(search);
  if (m) { const v = Number(m[1]); return v === 0 ? Infinity : Math.max(200, v); }
  return coarsePointer ? 1000 : 2000;
}

/** Ground metres between an anchor and the view centre ([lng, lat] each), the equirectangular approximation. */
export function anchorDistanceM(anchor: readonly [number, number], centre: { lng: number; lat: number }): number {
  const cos = Math.cos((centre.lat * Math.PI) / 180);
  return Math.hypot((anchor[0] - centre.lng) * cos, anchor[1] - centre.lat) * 111_320;
}

/** Is the anchor within reach of the centre (always, with the reach off)? `radiusM` is the model's half-diagonal. */
export function withinReach(anchor: readonly [number, number] | null | undefined, centre: { lng: number; lat: number }, reachM: number, radiusM = 0): boolean {
  if (!anchor || !Number.isFinite(reachM)) return true;
  return anchorDistanceM(anchor, centre) - radiusM <= reachM;
}
