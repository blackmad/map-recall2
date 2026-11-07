/**
 * One instance rebuild per frame for the street extras (inventory trees, street furniture), off the game frame
 * (lane E6, #219).
 *
 * The legacy layers rebuild every instanced mesh they hold whenever an input changes: a tree tile arrives, the own
 * ground is hooked (`setGroundBase`), new relief arrives (`refreshGroundBases`). At the cold ride start these came
 * together: the ride's first frame re-based every tree inside the game frame (`sync: ground update: consumers`
 * 34-40 ms on the iPhone profile at 4x, 40 ms desktop), the next frame did it again for the relief that had landed
 * (`extras bases` 18 ms), and each of the up to twelve tree tiles that arrived in the first second rebuilt the whole
 * set once more in its own fetch continuation.
 *
 * `request()` marks the layer dirty; the rebuild runs once, in its own task after the next frame has painted
 * (requestAnimationFrame, then a zero timeout), and not sooner than `minGapMs` after the last one. So a burst of
 * requests costs one rebuild, and none of them lands inside the game's frame. `flush()` runs a due rebuild now
 * (synchronous readers: tests, debug probes), `cancel()` drops it (the layer cleared or left the frame).
 *
 * `?extrasRebuild=sync` (or `=0`) restores the synchronous rebuild. Pure state with injected scheduling, unit-tested
 * in rebuildCoalescer.test.ts. The flag reader tolerates a non-browser global (the structure gate loads bundles in
 * Node without `location` or `URLSearchParams`).
 */

/** Least time between two coalesced rebuilds, ms: tile arrivals a few frames apart share one rebuild. */
export const REBUILD_MIN_GAP_MS = 120;

export interface RebuildCoalescerDeps {
  now(): number;
  /** Run `cb` in its own task after the next frame has painted. Returns a cancel function. */
  afterFrame(cb: () => void): () => void;
  /** Run `cb` in its own task after `ms`. Returns a cancel function. */
  after(ms: number, cb: () => void): () => void;
}

export class RebuildCoalescer {
  /** Rebuilds requested and rebuilds run (diagnostics: requests - runs were coalesced away). */
  readonly stats = { requests: 0, runs: 0 };
  private dirty = false;
  private cancelPending: (() => void) | null = null;
  private lastRun = -Infinity;

  /**
   * `run` does the rebuild; it is called only while dirty. `sync`: every request runs at once (the flag's off state).
   */
  /** `minGapMs` may be a function read at each schedule (`?arrivalPace=trees`: a longer gap from the air, engine/arrivalPace.ts). */
  constructor(private readonly run: () => void, private readonly deps: RebuildCoalescerDeps = browserDeps(), readonly sync = false, readonly minGapMs: number | (() => number) = REBUILD_MIN_GAP_MS) {}

  /** Is a rebuild waiting? */
  get pending(): boolean { return this.dirty; }

  request(): void {
    this.stats.requests++;
    if (this.sync) { this.stats.runs++; this.run(); return; }
    this.dirty = true;
    if (!this.cancelPending) this.schedule();
  }

  /** Run a waiting rebuild now. */
  flush(): void {
    if (!this.dirty) return;
    this.cancelPending?.();
    this.cancelPending = null;
    this.fire();
  }

  /** Drop a waiting rebuild. */
  cancel(): void {
    this.dirty = false;
    this.cancelPending?.();
    this.cancelPending = null;
  }

  private schedule(): void {
    this.cancelPending = this.deps.afterFrame(() => {
      this.cancelPending = null;
      const wait = this.lastRun + (typeof this.minGapMs === 'function' ? this.minGapMs() : this.minGapMs) - this.deps.now();
      if (wait > 0) { this.cancelPending = this.deps.after(wait, () => { this.cancelPending = null; this.fire(); }); return; }
      this.fire();
    });
  }

  private fire(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.lastRun = this.deps.now();
    this.stats.runs++;
    this.run();
  }
}

/** rAF then a zero timeout (a task after the paint); plain timeouts where there is no rAF (Node, a worker). */
export function browserDeps(): RebuildCoalescerDeps {
  const g = globalThis as { requestAnimationFrame?: (cb: () => void) => number; cancelAnimationFrame?: (id: number) => void; performance?: { now(): number } };
  const now = () => (g.performance ? g.performance.now() : Date.now());
  const after = (ms: number, cb: () => void) => { const id = setTimeout(cb, ms); return () => clearTimeout(id); };
  return {
    now,
    after,
    afterFrame(cb) {
      if (!g.requestAnimationFrame) return after(0, cb);
      let timer: ReturnType<typeof setTimeout> | null = null;
      const raf = g.requestAnimationFrame(() => { timer = setTimeout(cb, 0); });
      return () => { g.cancelAnimationFrame?.(raf); if (timer) clearTimeout(timer); };
    },
  };
}

/**
 * `?extrasRebuild=sync|0`: rebuild at once, as before. Default on the page: coalesced. Without a document (the
 * headless Node checks that drive a layer by hand, scripts/check-inventory-tree-streaming.mjs): at once.
 */
export function extrasRebuildSync(search?: string): boolean {
  let s = search;
  if (s == null) {
    const g = globalThis as { document?: unknown; location?: { search?: string } };
    if (!g.document) return true;
    try { s = g.location?.search ?? ''; } catch { s = ''; }
  }
  const m = /[?&]extrasRebuild=([^&#]*)/.exec(s);
  return !!m && (m[1] === 'sync' || m[1] === '0' || m[1] === 'off');
}
