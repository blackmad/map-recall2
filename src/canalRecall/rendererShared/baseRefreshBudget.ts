/**
 * Time-sliced ground re-base (lane R3-F #241, `?groundBasesAerial=0` off). From the air the own ground installs a cell or
 * relief tile every few hundred milliseconds, and each install re-lifted every resident building chunk's pands on the
 * frame (`sync: ground update: building bases`, 50-150 ms every 400 ms over 13 tiles of pands), for centimetres no one
 * sees from 60+ m. The world view now holds the re-base while the view is aerial (rendererShared/aerialView.ts) and runs
 * one catch-up when it leaves: this scheduler spreads that catch-up over frames, nearest chunk first, a budget per frame.
 *
 * Pure: the caller hands it keys with distances and a `work(key, deadline)` that lifts one key's pands until the deadline
 * and says whether that key is finished. A key cut at the deadline resumes first on the next run; a revision bump
 * (`start` again) restarts from the nearest.
 */
export interface SliceItem<K> { key: K; distance: number }

export class BaseRefreshSlicer<K> {
  private queue: K[] = [];
  private cursor = 0;
  /** Runs since the last `start` (tests and the perf probe read it). */
  runs = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Keys still to finish (the one cut at the deadline included). */
  get remaining(): number { return this.queue.length - this.cursor; }
  get active(): boolean { return this.cursor < this.queue.length; }
  /** The key the next run works on first, or undefined when done. */
  get next(): K | undefined { return this.active ? this.queue[this.cursor] : undefined; }

  /** (Re)start from the nearest: keys by distance, ties in the order given (deterministic). */
  start(items: Iterable<SliceItem<K>>): void {
    this.queue = orderByDistance(items);
    this.cursor = 0;
    this.runs = 0;
  }

  cancel(): void { this.queue = []; this.cursor = 0; }

  /**
   * Work through the queue for `budgetMs`. The first key always gets a call (a run makes progress even when the
   * budget is already spent); later keys only while time remains. Returns true when the queue is done.
   */
  run(budgetMs: number, work: (key: K, deadline: number) => boolean): boolean {
    if (!this.active) return true;
    this.runs++;
    const deadline = this.now() + budgetMs;
    let first = true;
    while (this.cursor < this.queue.length) {
      if (!first && this.now() >= deadline) break;
      first = false;
      if (!work(this.queue[this.cursor], deadline)) break; // cut at the deadline: resume this key next run
      this.cursor++;
    }
    return !this.active;
  }
}

/** Keys sorted nearest first; equal distances keep their input order. */
export function orderByDistance<K>(items: Iterable<SliceItem<K>>): K[] {
  const list = [...items].map((item, i) => ({ ...item, i, d: Number.isFinite(item.distance) ? item.distance : Infinity }));
  list.sort((a, b) => a.d - b.d || a.i - b.i);
  return list.map(item => item.key);
}

/** Ground distance in metres between two [lng, lat] points (equirectangular; chunk ordering only). */
export function lngLatDistanceM(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111320;
}

/** Per-frame budget of the catch-up re-base, ms. */
export const BASE_REFRESH_BUDGET_MS = 4;
