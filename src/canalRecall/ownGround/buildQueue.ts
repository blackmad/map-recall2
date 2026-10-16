// The ground worker's build queue.
//
// The worker used to chain every request in arrival order: a cell asked for when the rider was elsewhere was
// still built (250-400 ms each, more on a loaded machine) after the rider had left it behind, a cell asked at LOD 1
// and then at LOD 0 was built twice, and the cell the rider was riding into waited behind all of them. Ground
// cells then landed seconds late, in view (docs/perf-pop-in-20261016.md). Now a request replaces the earlier one
// for the same cell, the main thread's residency pass sends its wanted order (nearest ahead first), cells it no
// longer wants are dropped unbuilt, and the next build is always the best-ranked one. Far blocks come after
// cells. Without an `order` message the queue keeps arrival order, as before.

export type CellJob = { kind: 'cell'; key: string; lod: 0 | 1; gen: number };
export type FarJob = { kind: 'far'; key: string; gen: number };
export type GroundJob = CellJob | FarJob;

export class GroundBuildQueue {
  private readonly cells = new Map<string, CellJob>();
  private readonly far = new Map<string, FarJob>();
  private rank: Map<string, number> | null = null;

  /** Ask for a cell; replaces a queued request for the same cell (a newer LOD or generation). */
  build(key: string, lod: 0 | 1, gen: number): void {
    this.cells.delete(key); // re-inserted at the back: arrival order for unranked cells
    this.cells.set(key, { kind: 'cell', key, lod, gen });
  }

  requestFar(key: string, gen: number): void {
    this.far.set(key, { kind: 'far', key, gen });
  }

  /**
   * The main thread's wanted cells, best first. Queued cells not in it are dropped (the rider left them);
   * the rest build in this order.
   */
  order(keys: readonly string[]): void {
    this.rank = new Map(keys.map((k, i) => [k, i]));
    for (const key of [...this.cells.keys()]) if (!this.rank.has(key)) this.cells.delete(key);
  }

  /** Drop far-block requests outside `keep`. */
  keepFar(keep: ReadonlySet<string>): void {
    for (const key of [...this.far.keys()]) if (!keep.has(key)) this.far.delete(key);
  }

  get size(): number { return this.cells.size + this.far.size; }

  /** The next job: the best-ranked cell (arrival order without a rank), then far blocks in arrival order. */
  next(): GroundJob | null {
    let pick: CellJob | null = null, best = Infinity;
    for (const job of this.cells.values()) {
      const r = this.rank?.get(job.key) ?? Infinity;
      if (!pick || r < best) { pick = job; best = r; }
      if (!this.rank) break;
    }
    if (pick) { this.cells.delete(pick.key); return pick; }
    const far = this.far.values().next();
    if (far.done) return null;
    this.far.delete(far.value.key);
    return far.value;
  }
}
