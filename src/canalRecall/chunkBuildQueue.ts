/** Tile bursts keep only each chunk's newest build, in first-request order. */
export class ChunkBuildQueue {
  private readonly jobs = new Map<string, () => void>();
  get length(): number { return this.jobs.size; }
  push(key: string, job: () => void): void { this.jobs.set(key, job); }
  shift(): (() => void) | undefined {
    const first = this.jobs.entries().next();
    if (first.done) return undefined;
    this.jobs.delete(first.value[0]);
    return first.value[1];
  }
  clear(): void { this.jobs.clear(); }
}
