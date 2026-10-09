/**
 * Reference-counted cache for assets several placements share (one GLB, many
 * instanced houses). The browser adapter loads a URL once through `acquire`,
 * clones the result per instance, and calls `release` when an instance goes
 * away; `release` reports true for the last user so the caller frees GPU
 * resources exactly once.
 */
export class SharedAssetCache<T> {
  private readonly entries = new Map<string, { promise: Promise<T>; refs: number; value?: T }>();

  /** Load `url` once; concurrent and later callers share the result and each hold a reference. */
  acquire(url: string, load: () => Promise<T>): Promise<T> {
    let entry = this.entries.get(url);
    if (!entry) {
      const created: { promise: Promise<T>; refs: number; value?: T } = { promise: undefined as unknown as Promise<T>, refs: 0 };
      created.promise = load().then(value => { created.value = value; return value; }, error => {
        // A failed load must not poison the URL: later requests retry.
        if (this.entries.get(url) === created) this.entries.delete(url);
        throw error;
      });
      this.entries.set(url, created);
      entry = created;
    }
    entry.refs++;
    return entry.promise;
  }

  /** Drop one reference. Returns the loaded value when this was the last one (caller disposes it), else undefined. */
  release(url: string): T | undefined {
    const entry = this.entries.get(url);
    if (!entry) return undefined;
    entry.refs--;
    if (entry.refs > 0) return undefined;
    this.entries.delete(url);
    return entry.value;
  }

  /** Give back a reference taken by a load that then failed to be used (a failed load already removed the entry). */
  has(url: string): boolean { return this.entries.has(url); }
  refs(url: string): number { return this.entries.get(url)?.refs ?? 0; }
  get size(): number { return this.entries.size; }
  clear(): void { this.entries.clear(); }
}
