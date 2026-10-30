/**
 * The world streamer (engine programme P3, lane L4 step 4): one priority queue of `world-v1` cells, one worker
 * pool that reads them, and one per-frame budget for what the main thread takes in.
 *
 *  - Rank. A cell's rank is `aheadRank` (streamingLookAhead.ts) from the rider to the cell centre, along the
 *    rider's `MotionEstimate` direction: ahead is near, behind is far. Cells the planned z14 tiles need come
 *    first, in the plan's own order (view, then look-ahead); the rank orders the rest and breaks ties.
 *  - Residency. Decoded cells stay in the worker that read them; above `budget` the off-plan cells furthest
 *    from the rider go first (`pickEvictions`, the landmark layer's policy, so models and cells leave alike).
 *  - Pool. min(cores - 1, 3) workers (`poolSize`). A cell always goes to the same worker (`affinity`), so its
 *    decode is cached once and the tiles that share it are cut from that one copy.
 *  - Budget. `FrameBudget` meters ms and bytes per animation frame; callers spend before main-thread work and
 *    carry the rest to the next frame.
 *
 * Pure apart from the injected clock and workers; world/worldCells.ts drives it in the browser.
 */
import { aheadRank, type LngLat } from '../streamingLookAhead.js';
import { pickEvictions } from '../landmarks/landmarkResidency.js';
import { cellBounds, parseCellKey } from '../world/cellGrid.js';

/** Workers for cell reads: one core is the main thread's, and three readers saturate the network on desktop. */
export function poolSize(cores: number | undefined = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined): number {
  const n = Number.isFinite(cores) ? Math.floor(cores as number) - 1 : 1;
  return Math.max(1, Math.min(3, n));
}

/** Stable worker for a cell key (FNV-1a), so a cell is decoded and cached in one worker only. */
export function affinity(key: string, workers: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return workers > 0 ? h % workers : 0;
}

export function cellCentre(key: string): LngLat {
  const [i, j] = parseCellKey(key), [w, s, e, n] = cellBounds(i, j);
  return [(w + e) / 2, (s + n) / 2];
}

/**
 * Order cells for reading. `planned` (the cells the planned tiles need, in the plan's priority order) come first in
 * that order; within the plan and after it, `aheadRank` from `rider` along `direction` breaks ties.
 */
export function rankCells(planned: readonly string[], rider: LngLat | null, direction: readonly [number, number] | null): Map<string, number> {
  const out = new Map<string, number>();
  const ahead = (key: string) => rider ? aheadRank(rider, cellCentre(key), direction) : 0;
  planned.forEach((key, i) => { if (!out.has(key)) out.set(key, i * 1e6 + Math.min(ahead(key), 1e6 - 1)); });
  return out;
}

export type CellRead = (key: string) => Promise<void>;

/**
 * The cell queue. `want` replaces the wanted set (key -> rank, lower first); queued cells no longer wanted are
 * dropped, reads in flight finish (their cells stay cached). At most `maxInFlight` reads run at once, lowest rank
 * first. `resident` tracks what was read so `evictions` can name what to give back above the budget.
 */
export class CellQueue {
  private wanted = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private readonly done = new Map<string, number>(); // key -> last time wanted (sequence)
  private seq = 0;
  readonly stats = { reads: 0, failed: 0, dropped: 0, maxQueued: 0 };
  constructor(private readonly read: CellRead, private readonly maxInFlight = 6) {}

  want(ranked: ReadonlyMap<string, number>): void {
    this.seq++;
    for (const key of this.wanted.keys()) if (!ranked.has(key) && !this.inFlight.has(key)) this.stats.dropped++;
    this.wanted = new Map([...ranked].filter(([key]) => !this.inFlight.has(key) && !this.done.has(key)));
    for (const key of ranked.keys()) if (this.done.has(key)) this.done.set(key, this.seq);
    this.stats.maxQueued = Math.max(this.stats.maxQueued, this.wanted.size);
    this.pump();
  }

  /** A cell read elsewhere (a tile request) counts as resident. */
  noteResident(key: string): void { this.done.set(key, this.seq); this.wanted.delete(key); }
  forget(key: string): void { this.done.delete(key); }

  get queued(): number { return this.wanted.size; }
  get running(): number { return this.inFlight.size; }
  get residentKeys(): string[] { return [...this.done.keys()]; }

  private pump(): void {
    while (this.inFlight.size < this.maxInFlight && this.wanted.size) {
      let pick: string | null = null, best = Infinity;
      for (const [key, rank] of this.wanted) if (rank < best) { best = rank; pick = key; }
      if (pick === null) break;
      this.wanted.delete(pick);
      this.inFlight.add(pick);
      this.stats.reads++;
      const key = pick;
      this.read(key).then(() => { this.done.set(key, this.seq); }, () => { this.stats.failed++; })
        .finally(() => { this.inFlight.delete(key); this.pump(); });
    }
  }

  /**
   * Cells to give back: above `budget` resident, the ones not wanted now (`inPlan` false) furthest from `rider`,
   * down to budget - slack. Callers evict them from the worker caches and call `forget`.
   */
  evictions(budget: number, rider: LngLat | null, inPlan: (key: string) => boolean, slack = 4): string[] {
    const models = this.residentKeys.map(id => {
      const c = cellCentre(id), d = rider ? aheadRank(rider, c, null) : 0;
      return { id, distanceSq: d * d, inView: inPlan(id), evictable: true };
    });
    return pickEvictions(models, { budget, slack });
  }
}

/**
 * Main-thread intake per animation frame: `ms` of work and `bytes` of new data. `begin` opens a frame (call it
 * from the frame callback); `take(bytes)` says whether this piece fits, and spends it if so. The first piece of a
 * frame always fits, so a piece larger than the whole budget still goes through, one per frame.
 */
export class FrameBudget {
  private started = 0;
  private spentBytes = 0;
  private pieces = 0;
  constructor(readonly ms: number, readonly bytes: number, private readonly now: () => number = () => performance.now()) {}
  begin(): void { this.started = this.now(); this.spentBytes = 0; this.pieces = 0; }
  take(bytes: number): boolean {
    if (this.pieces > 0 && (this.now() - this.started >= this.ms || this.spentBytes + bytes > this.bytes)) return false;
    this.pieces++; this.spentBytes += bytes;
    return true;
  }
  get spent(): { pieces: number; bytes: number; ms: number } { return { pieces: this.pieces, bytes: this.spentBytes, ms: this.now() - this.started }; }
}
