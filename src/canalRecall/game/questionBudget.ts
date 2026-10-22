// How many route questions a ride may ask, and which names earn one.
//
// The ride is the lesson; the question is the check. Without a budget every
// new unlearned name asked on the spot, and in the centre that is a question
// per block. This module is pure: it sees a ride clock and one candidate name
// event and says what to do with it.
//
//   ask               open the question now;
//   reveal-after-pass the name is new but the budget is spent: let the rider
//                     pass it, then show the name once they have left the
//                     street (never before: the geographic-learning rule);
//   skip              ask nothing (a known name, or a review that will simply
//                     stay due and be asked on a later street).
//
// Priority is due-review > new teaching-street name > everything else. It is
// enforced by reserving a slot, not by sorting: the last slot of the minute is
// only spent on a higher-priority name, so a stray unlearned side street
// cannot use up the question a due review needed.

/** What the candidate name is to this rider right now. */
export type NameEventKind =
  /** The spaced-repetition schedule says this name is due. */
  | 'due-review'
  /** Never answered correctly here. */
  | 'new-unlearned'
  /** Already known and not due. */
  | 'known';

export interface NameEvent {
  name: string;
  kind: NameEventKind;
  /** The street is one the ride is meant to teach (on the route to the
   *  destination, or a corridor the rider was steered onto). Only meaningful
   *  for `new-unlearned`. */
  teachingStreet?: boolean;
}

export interface QuestionBudgetSettings {
  /** Asks per rolling minute. 0 turns route questions off; Infinity restores
   *  the old ask-everything behaviour. */
  maxAsksPerMinute: number;
}

export const DEFAULT_MAX_ASKS_PER_MINUTE = 3;
export const BUDGET_WINDOW_SECONDS = 60;

export interface QuestionBudgetState {
  /** Ride-clock seconds of the asks inside the window, oldest first. */
  asks: readonly number[];
}

export const EMPTY_BUDGET: QuestionBudgetState = { asks: [] };

export type AskPriority = 'review' | 'teaching' | 'rest';

export type BudgetDecision =
  | { action: 'ask'; priority: AskPriority }
  | { action: 'reveal-after-pass'; reason: 'budget' | 'spacing' | 'reserved' }
  | { action: 'skip'; reason: 'known' | 'budget' | 'spacing' | 'off' };

export function resolveSettings(settings?: Partial<QuestionBudgetSettings>): QuestionBudgetSettings {
  const raw = settings?.maxAsksPerMinute;
  return { maxAsksPerMinute: raw == null || Number.isNaN(raw) ? DEFAULT_MAX_ASKS_PER_MINUTE : Math.max(0, raw) };
}

/** Asks still inside the window at `now`. A time later than `now` belongs to
 *  an earlier ride (the ride clock restarts at 0) and no longer counts. */
export function recentAsks(state: QuestionBudgetState, now: number): number[] {
  return state.asks.filter(at => at <= now && now - at < BUDGET_WINDOW_SECONDS);
}

/** Minimum spacing between two asks: half the even spacing, so two asks a
 *  minute can cluster a little but never land back to back. */
export function minGapSeconds(settings: QuestionBudgetSettings): number {
  const max = settings.maxAsksPerMinute;
  if (!(max > 0) || !Number.isFinite(max)) return 0;
  return BUDGET_WINDOW_SECONDS / max / 2;
}

function priorityOf(event: NameEvent): AskPriority {
  if (event.kind === 'due-review') return 'review';
  return event.teachingStreet ? 'teaching' : 'rest';
}

export function decideQuestion(
  state: QuestionBudgetState,
  event: NameEvent,
  now: number,
  settingsInput?: Partial<QuestionBudgetSettings>,
): BudgetDecision {
  const settings = resolveSettings(settingsInput);
  if (event.kind === 'known') return { action: 'skip', reason: 'known' };
  const unlearned = event.kind === 'new-unlearned';
  const declined = (reason: 'budget' | 'spacing'): BudgetDecision =>
    unlearned ? { action: 'reveal-after-pass', reason } : { action: 'skip', reason };

  const max = settings.maxAsksPerMinute;
  if (max === 0) return unlearned ? { action: 'reveal-after-pass', reason: 'budget' } : { action: 'skip', reason: 'off' };
  const priority = priorityOf(event);
  if (!Number.isFinite(max)) return { action: 'ask', priority };

  const recent = recentAsks(state, now);
  const remaining = max - recent.length;
  if (remaining < 1) return declined('budget');
  const last = recent.length ? recent[recent.length - 1] : -Infinity;
  if (now - last < minGapSeconds(settings)) return declined('spacing');
  // The last slot belongs to a higher priority than "rest".
  if (priority === 'rest' && remaining < 2) return { action: 'reveal-after-pass', reason: 'reserved' };
  return { action: 'ask', priority };
}

/** Record an ask the game actually opened. Returns a new state. */
export function recordAsk(state: QuestionBudgetState, now: number): QuestionBudgetState {
  return { asks: [...recentAsks(state, now), now] };
}
