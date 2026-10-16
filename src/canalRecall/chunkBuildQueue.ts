/**
 * Tile bursts keep only each chunk's newest build. Without a rank, builds run in first-request order; with one
 * (`setRank`), the lowest-ranked chunk builds next (ties in request order): the facade layer ranks chunks by
 * how far ahead of the rider they lie (streamingLookAhead.ts aheadRank), so a tile flush no longer builds the
 * block behind the rider before the one it is riding into (docs/perf-pop-in-20261016.md).
 */
export class ChunkBuildQueue {
  private readonly jobs = new Map<string, () => void>();
  private rank: ((key: string) => number) | null = null;
  get length(): number { return this.jobs.size; }
  push(key: string, job: () => void): void { this.jobs.set(key, job); }
  /** Rank evaluated when the next job is taken (the rider moves between builds); null restores request order. */
  setRank(rank: ((key: string) => number) | null): void { this.rank = rank; }
  shift(): (() => void) | undefined {
    let pick: string | undefined;
    if (this.rank && this.jobs.size > 1) {
      let best = Infinity;
      for (const key of this.jobs.keys()) {
        const r = this.rank(key);
        if (r < best) { best = r; pick = key; }
      }
    }
    if (pick === undefined) {
      const first = this.jobs.keys().next();
      if (first.done) return undefined;
      pick = first.value;
    }
    const job = this.jobs.get(pick)!;
    this.jobs.delete(pick);
    return job;
  }
  clear(): void { this.jobs.clear(); }
}
