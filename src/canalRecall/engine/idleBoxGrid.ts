// The rider-cover footprint grid built in idle slices (lane E6, #219).
//
// `featuresAt` (buildingTilesBrowser.ts) indexes the resident buildings (~36,000) in a BoxGrid, rebuilt whenever the
// resident list changes. The first query of a ride came at the ride's first frame, inside the game frame: `sync: rider
// cover` 8 ms desktop and 13-24 ms on the iPhone profile at 4x, the grid build (each footprint's box walked once, then
// bucketed). Every tile arrival while riding paid it again at the next cover query.
//
// Here the grid for a new list is built in slices of a few thousand items in idle time (requestIdleCallback, else a
// timeout), started as soon as the list is seen: `prewarm(list)` from the ride's start-up frames, or the first query.
// Until it is done a query answers from the previous list's grid (a building that just arrived can be covered a few
// hundred milliseconds late; the cover's enter hold is longer), or, with no grid yet, from nothing. `?coverGridIdle=0`
// builds at the query, as before. Pure scheduling injected; unit-tested in idleBoxGrid.test.ts.

import { BoxGrid, type Box } from './boxGrid.js';

/** Items inserted per idle slice (~2-4 ms at 4x CPU throttling for footprints whose boxes are memoised). */
export const IDLE_GRID_STEP = 3000;

export type IdleScheduler = (cb: () => void) => void;

export const idleScheduler: IdleScheduler = cb => {
  const g = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (g.requestIdleCallback) g.requestIdleCallback(cb, { timeout: 200 });
  else setTimeout(cb, 0);
};

export class IdleBoxGrid<T> {
  private ready: { of: readonly T[]; grid: BoxGrid<T> } | null = null;
  private building: { of: readonly T[]; grid: BoxGrid<T>; steps: Generator<void, void, void> } | null = null;
  /** Slices run and grids completed (diagnostics). */
  readonly stats = { slices: 0, grids: 0, staleAnswers: 0 };

  constructor(private readonly boxOf: (item: T) => Box | null, private readonly idle: IdleScheduler = idleScheduler, readonly sync = false, readonly step = IDLE_GRID_STEP) {}

  /** Start (or keep) building the grid for `items` in idle time. */
  prewarm(items: readonly T[]): void {
    if (this.sync || this.ready?.of === items || this.building?.of === items) return;
    const grid = new BoxGrid(items, this.boxOf, true);
    const start = !this.building;
    this.building = { of: items, grid, steps: grid.insertSteps(this.step) };
    if (start) this.idle(() => this.slice());
  }

  /** Items whose box holds (lng, lat), for the list `items` (or, while its grid builds, the last list indexed). */
  at(lng: number, lat: number, items: readonly T[]): T[] {
    if (this.ready?.of === items) return this.ready.grid.at(lng, lat, items);
    if (this.sync) { this.ready = { of: items, grid: new BoxGrid(items, this.boxOf) }; return this.ready.grid.at(lng, lat, items); }
    this.prewarm(items);
    if (!this.ready) return [];
    this.stats.staleAnswers++;
    return this.ready.grid.at(lng, lat, this.ready.of);
  }

  /** Whether the grid for `items` is complete. */
  isReady(items: readonly T[]): boolean { return this.ready?.of === items; }

  private slice(): void {
    const b = this.building;
    if (!b) return;
    this.stats.slices++;
    if (b.steps.next().done) {
      this.ready = { of: b.of, grid: b.grid };
      this.building = null;
      this.stats.grids++;
      return;
    }
    this.idle(() => this.slice());
  }
}

/** `?coverGridIdle=0`: the rider-cover grid is built at the query (as before). Tolerates a non-browser global. */
export function coverGridIdleEnabled(): boolean {
  try {
    const g = globalThis as { document?: unknown; location?: { search?: string } };
    if (!g.document) return false;
    return !/[?&]coverGridIdle=(0|off)(&|#|$)/.test(g.location?.search ?? '');
  } catch { return false; }
}
