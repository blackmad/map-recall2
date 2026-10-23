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
