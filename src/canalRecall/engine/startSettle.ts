// The cold start holds the loading screen until the world at the ride's first pose has landed, or until a cap (R5-B,
// R5-B2, #261). Pure: the own world view reads its tiers and passes them in (ownWorldView.ts startSettleBusy); the game
// hands over its camera with holdRidePose() and asks the cap through startSettleCapMs(). `?startSettle=0` restores
// today's hold (settleChecks, a 4 s cap, 1 Hz covered frames).
//
// Why (#261 measurements, 2026-11-08): R5-B's check judged the tiers at the pose aimAtWorld left (zoom 17, detail
// block on the rider), while the first racing sync opened the chase view (zoom +1.05 desktop, +0.81 iPhone, detail
// block 22 m ahead), so buildings and baked went pending at the reveal. R5-B2: the check is armed only by
// holdRidePose (an always-armed check was polled by every whenIdle/pendingWork caller from page load and latched done
// before the hold began), the held frames run the view's sync with the game camera, and the covered world renders at
// 10 Hz (4 Hz touch) while armed because the ground installs one cell per rendered frame.

/** Cap on a desktop (pointer: fine) cold start, ms. */
export const START_SETTLE_CAP_DESKTOP_MS = 6000;
/** Cap on a touch device (pointer: coarse), ms: never longer than today's 4 s hold on the phone. */
export const START_SETTLE_CAP_TOUCH_MS = 4000;
/**
 * Least ms between covered world renders while the cold-start hold is armed (FrameHost.coveredFrameMs; 1000 ms
 * otherwise, ownWorldView.ts COVERED_FRAME_MS). The ground installs one cell per rendered frame and the idle checks
 * run on render, so at 1 Hz the hold could not land the start pose's ground inside its cap (R5-B2, #261).
 */
export const START_SETTLE_COVERED_FRAME_MS_DESKTOP = 100;
export const START_SETTLE_COVERED_FRAME_MS_TOUCH = 250;
export function startSettleCoveredFrameMs(touch: boolean): number {
  return touch ? START_SETTLE_COVERED_FRAME_MS_TOUCH : START_SETTLE_COVERED_FRAME_MS_DESKTOP;
}

/** What today's cold-start hold waits for at most (game-route.js `_waitForMapSettle(4000)`). */
export const START_SETTLE_LEGACY_CAP_MS = 4000;

/** The start hold's ground: the cell under the camera centre only (a zero box), not settle.ts's 300 m box. */
export const START_SETTLE_GROUND_RADIUS_M = 0;

/** The tiers the hold waits on, in the order the pending list reports them. */
export const START_SETTLE_TIERS = ['groundCentre', 'buildings', 'far', 'baked'] as const;
export type StartSettleTier = typeof START_SETTLE_TIERS[number];

/** Each tier's state at the start pose: true when that tier has landed for the view. */
export type StartSettleInput = Partial<Record<StartSettleTier, boolean>>;

/** `?startSettle=0` (or `window.__canalRecallStartSettle = false`) is off; anything else, or unasked, is on. */
export function startSettleEnabled(asked: unknown): boolean {
  if (asked === false || asked === 0 || asked === '0' || asked === 'false' || asked === 'off') return false;
  return true;
}

/** The cap for a device: 6 s on a fine pointer, 4 s on a coarse one. `touch` comes from `(pointer: coarse)`. */
export function startSettleCapMs(touch: boolean): number {
  return touch ? START_SETTLE_CAP_TOUCH_MS : START_SETTLE_CAP_DESKTOP_MS;
}

/** The device's pointer kind from a matchMedia-like object (the roofTier.ts cellTapsDefault pattern). */
export function isTouchPointer(w: { matchMedia?: (q: string) => { matches: boolean } } | undefined = globalThis as never): boolean {
  let touch = false;
  try { touch = !!w?.matchMedia?.('(pointer: coarse)')?.matches; } catch { /* no matchMedia: fine pointer */ }
  return touch;
}

/** Tiers still loading: a tier that is not reported as landed counts as pending. Order follows START_SETTLE_TIERS. */
export function startSettlePending(input: StartSettleInput): StartSettleTier[] {
  return START_SETTLE_TIERS.filter(t => input[t] !== true);
}

export interface StartSettleStep {
  /** True once the hold may end (everything landed, or the cap is reached). */
  done: boolean;
  /** 'settled' when nothing is pending; 'cap' when the cap passed with work still pending; 'waiting' otherwise. */
  reason: 'settled' | 'cap' | 'waiting';
  pending: StartSettleTier[];
}

/**
 * One scheduler step: given the time since the hold began, the tiers still pending and the cap, decide whether the
 * hold ends. Settled before the cap ends it at once; at the cap it ends whatever is pending.
 */
export function startSettleStep(elapsedMs: number, input: StartSettleInput, capMs: number): StartSettleStep {
  const pending = startSettlePending(input);
  if (pending.length === 0) return { done: true, reason: 'settled', pending };
  if (elapsedMs >= capMs) return { done: true, reason: 'cap', pending };
  return { done: false, reason: 'waiting', pending };
}

/**
 * The hold's poll loop (R5-B2, #261), pure so it is testable: each poll first advances the world at the pose the
 * ride will use (`advance`: the own view's sync with the game camera once the game has handed it over, else
 * settleTick at the camera as aimed), then judges the tiers there. Latches once done; later polls do nothing.
 */
export class StartSettleHold {
  private start: number | null = null;
  private finished = false;
  last: StartSettleStep | null = null;
  constructor(private readonly capMs: () => number) {}
  get done(): boolean { return this.finished; }
  /** True while the hold should keep the loading screen up. */
  poll(now: number, advance: () => void, judge: () => StartSettleInput): boolean {
    if (this.finished) return false;
    this.start ??= now;
    advance();
    const step = startSettleStep(now - this.start, judge(), this.capMs());
    this.last = step;
    if (step.done) this.finished = true;
    return !step.done;
  }
}
