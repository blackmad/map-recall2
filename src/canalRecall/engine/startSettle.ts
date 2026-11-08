// The cold start holds the loading screen until the world at the start pose has landed, or until a cap (R5-B, #261).
// Pure: the own world view reads its tiers and passes them in (ownWorldView.ts startSettleBusy); the game asks the
// cap through ownWorldView.startSettleCapMs(). `?startSettle=0` restores today's hold (settleChecks, a 4 s cap).
//
// Why these tiers (#261 measurements, 2026-11-08): on iPhone the 4 s cap was the usual exit with facades pending, and
// far and baked landed 0.7-1.0 s after racing; on desktop the hold settled but buildings and baked still landed
// 0.3-1.2 s after racing. The ground gates only the camera's cell (the ground's ring keeps building for longer and
// was never settled inside 8 s); the far ring and baked coarse tiers gate too because they are the pop-in the user saw.

/** Cap on a desktop (pointer: fine) cold start, ms. */
export const START_SETTLE_CAP_DESKTOP_MS = 6000;
/** Cap on a touch device (pointer: coarse), ms: never longer than today's 4 s hold on the phone. */
export const START_SETTLE_CAP_TOUCH_MS = 4000;
/** What today's cold-start hold waits for at most (game-route.js `_waitForMapSettle(4000)`). */
export const START_SETTLE_LEGACY_CAP_MS = 4000;

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
