/**
 * One main-thread budget per frame for the own ground's sliced work (lane E2, #215).
 *
 * The ground store ends its task every few milliseconds (groundStore.ts `yieldToFrame` / `pacer`, #129), but several
 * cells prepare at once and `scheduler.yield` continuations run ahead of other tasks: on the 60 s iPhone ride at 4x,
 * 2-4 slices of 8-24 ms landed in one frame (LoAF `Scheduler.yield.then @ own-ground-game`), the largest stall owner
 * (1139 ms of stalled samples). Every yield now reports the work it ends; once a frame's slices add up to `budgetMs`,
 * the next yield waits for the following frame to paint instead of continuing in this one.
 *
 * On by default (lane E5). `?groundFrameBudget=0` turns it off (each yield is a plain `scheduler.yield` again); `?groundFrameBudget=<ms>` sets
 * the budget. Pure state with injected clock and frame source, unit-tested in frameBudget.test.ts.
 */

export const GROUND_FRAME_BUDGET_MS = 8;
/** Frames a resumed slice waits at most for a budget other slices spent (the gate never starves a slice). */
export const MAX_REGATES = 4;

export interface FrameBudgetDeps {
  now(): number;
  /** Resolves after the next frame has painted (requestAnimationFrame, then a task). */
  nextFrame(): Promise<void>;
  /** Ends the current task without waiting for a frame (scheduler.yield or a zero timeout). */
  yieldTask(): Promise<void>;
}

export class FrameBudget {
  /** Work reported since the current frame began, ms. */
  spent = 0;
  /** Waits for a later frame that this budget caused (diagnostics). */
  deferrals = 0;
  private frame = 0;
  private spentFrame = -1;
  private resumedAt: number;

  /** Resumes that found this frame's budget already spent by another slice and waited again (diagnostics). */
  regated = 0;

  /**
   * `gate` (lane E6, #219): a slice resuming from a deferral re-checks the budget before it runs. Every deferred slice
   * resumes in its own task right after the same paint, so without the gate K cells in flight each ran one slice in
   * that gap: on the desktop cold start, frames of 67-100 ms made of four to six 6-20 ms `setTimeout` continuations of
   * own-ground slices. With it, the first resumed slice spends the frame's budget and the rest wait for the next frame
   * (at most MAX_REGATES times, so no slice starves).
   */
  constructor(private readonly deps: FrameBudgetDeps, readonly budgetMs = GROUND_FRAME_BUDGET_MS, readonly gate = false) {
    this.resumedAt = deps.now();
  }

  private spentThisFrame(): boolean { return this.spentFrame === this.frame && this.spent >= this.budgetMs; }

  /** A frame began (the page's rAF tick). */
  onFrame(): void { this.frame++; }

  /**
   * End the current slice of work. `since` is when this slice began (default: the last resume of any slice, which
   * over-counts idle time between slices, so it can only defer more, never less).
   */
  async yield(since?: number): Promise<void> {
    const t = this.deps.now();
    if (this.spentFrame !== this.frame) { this.spentFrame = this.frame; this.spent = 0; }
    this.spent += Math.max(0, t - (since ?? this.resumedAt));
    if (this.spent >= this.budgetMs) {
      this.deferrals++;
      await this.deps.nextFrame();
      for (let n = 0; this.gate && n < MAX_REGATES && this.spentThisFrame(); n++) { this.regated++; await this.deps.nextFrame(); }
    } else {
      await this.deps.yieldTask();
    }
    this.resumedAt = this.deps.now();
  }
}

/** `?groundFrameBudget=`: null when off, else the budget in ms. */
export function groundFrameBudgetMs(search: string): number | null {
  const m = /[?&]groundFrameBudget=([^&#]*)/.exec(search);
  // On by default since lane E5 (#218): opt-in after E2 because its one-run motion A/B was inside the noise, but at ride
  // start, where the slices pile up, three A/B pairs (desktop 1512x982@2 and the iPhone profile at 4x, 8 starts each)
  // read iPhone >100 ms frames 84 -> 39 and >200 ms 1 -> 0, desktop cold start 6 -> 2 over 100 ms. `?groundFrameBudget=0`
  // or `=off` turns it off; `=1`/`=on` takes GROUND_FRAME_BUDGET_MS; `=<ms>` sets it.
  if (!m) return GROUND_FRAME_BUDGET_MS;
  if (m[1] === '1' || m[1] === 'on') return GROUND_FRAME_BUDGET_MS;
  const v = Number(m[1]);
  return m[1] === '0' || m[1] === 'off' || !Number.isFinite(v) || v <= 0 ? null : v;
}

/** `?groundBudgetGate=0`: deferred slices resume without re-checking the frame's budget (lane E5's behaviour). */
export function groundBudgetGate(search: string): boolean {
  return !/[?&]groundBudgetGate=(0|off)(&|#|$)/.test(search);
}

const KEY = '__canalRecallGroundFrameBudget';
/** The page's budget (shared by every bundle through globalThis), null in a worker or when off. */
export function pageFrameBudget(): FrameBudget | null {
  const g = globalThis as unknown as Record<string, unknown> & {
    document?: unknown; location?: { search?: string }; requestAnimationFrame?: (cb: () => void) => number;
    scheduler?: { yield?: () => Promise<void> };
  };
  if (g[KEY] !== undefined) return g[KEY] as FrameBudget | null;
  const ms = g.document && g.requestAnimationFrame ? groundFrameBudgetMs(g.location?.search ?? '') : null;
  if (ms == null) { g[KEY] = null; return null; }
  const raf = g.requestAnimationFrame!.bind(globalThis);
  // The frame counter ticks only while someone waits or yields recently: no rAF loop on an idle page.
  let ticking = false, lastUse = 0;
  const tick = () => {
    budget.onFrame();
    if (performance.now() - lastUse < 1000) raf(tick); else ticking = false;
  };
  const touch = () => { lastUse = performance.now(); if (!ticking) { ticking = true; raf(tick); } };
  const budget: FrameBudget = new FrameBudget({
    now: () => { touch(); return performance.now(); },
    nextFrame: () => new Promise<void>(resolve => raf(() => setTimeout(resolve, 0))),
    yieldTask: () => (g.scheduler?.yield ? g.scheduler.yield() : new Promise<void>(resolve => setTimeout(resolve, 0))),
  }, ms, groundBudgetGate(g.location?.search ?? ''));
  g[KEY] = budget;
  return budget;
}
