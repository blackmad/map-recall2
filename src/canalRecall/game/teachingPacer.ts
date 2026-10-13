// One timeline for everything that talks to the rider while they ride.
//
// Pacing used to be five separate systems with five clocks: the gap between
// drive-by cards (`driveByTrigger`), postcard pacing (`postcardPacing`), the
// bridge question cooldown (`BRIDGE_QUIZ_COOLDOWN` in constants.js), four
// transit question cooldowns (`transit/browser`), and nothing at all for the
// plaque feedback line, which never timed out and so, through the one-card
// rule, blocked cards until the next question.
//
// This module is the single home for those numbers and for the one rule they
// share: a time is a `raceTime` second, and a time later than now belongs to
// an earlier ride (the clock restarts at 0), so it never blocks anything.
// Values are unchanged from the modules they came from; only their home moved.
// `driveByTrigger`, `postcardPacing` and `transit/browser` re-export them so
// existing imports and their regression checks keep working.

// ---- Drive-by cards ---------------------------------------------------------

/** Seconds a street or drive-by card keeps the slot before a landmark about to
 *  be passed may take it. */
export const PREEMPT_AFTER_SECONDS = 6;
/** Seconds a card the player clicked open keeps the slot before a landmark
 *  being driven past may take it. Cards no longer time out (user request
 *  2026-10-03, "until I x them out or something else replaces them"), so a
 *  clicked card left up would otherwise stop every drive-by card for the rest
 *  of the ride; it gets longer than a card that opened by itself. */
export const CLICK_PREEMPT_AFTER_SECONDS = 20;
/** Seconds between drive-by cards. In the canal belt a landmark stands every
 *  few houses, and cards replacing each other every few seconds left no time
 *  to read one or to watch the road (user report 2026-10-01, "pace the rate
 *  at which we pop up those cards"). */
export const DRIVE_BY_MIN_GAP_SECONDS = 15;

// ---- Neighbourhood postcards ------------------------------------------------

/** Entries to a neighbourhood that always get the postcard. */
export const POSTCARD_FIRST_VISITS = 3;
/** Seconds without a new trivia card for a familiar neighbourhood's entry to
 *  get the postcard anyway. */
export const POSTCARD_QUIET_SECONDS = 45;
/** Seconds between postcards that are not first visits. */
export const POSTCARD_MIN_GAP_SECONDS = 120;
/** Seconds of riding inside one neighbourhood with no trivia card before its
 *  postcard comes back. */
export const POSTCARD_LULL_SECONDS = 90;
/** Seconds between lull postcards. */
export const POSTCARD_LULL_GAP_SECONDS = 180;

// ---- Questions --------------------------------------------------------------

/** Seconds between bridge questions. Amsterdam has a bridge every hundred
 *  metres; asking about each one buries the street recall the route is there
 *  to teach, so crossings stay an occasional highlight. (Was
 *  `BRIDGE_QUIZ_COOLDOWN` in constants.js.) */
export const BRIDGE_QUIZ_COOLDOWN_SECONDS = 90;
/** Minimum seconds between stop quizzes on the same route. */
export const TRANSIT_STOP_QUIZ_COOLDOWN_S = 18;
/** After answering a line question, wait this long before asking again. */
export const TRANSIT_LINE_QUIZ_COOLDOWN_S = 45;
/** Minimum seconds between corridor street quizzes. */
export const TRANSIT_STREET_QUIZ_COOLDOWN_S = 22;
/** Minimum seconds between transfer-hub line quizzes. */
export const TRANSIT_TRANSFER_QUIZ_COOLDOWN_S = 40;
/** A street question may not open this soon after a stop question, as a
 *  fraction of the stop cooldown. */
export const TRANSIT_STREET_AFTER_STOP_FRACTION = 0.5;

// ---- Feedback and card lifetime ---------------------------------------------

/** Seconds the plaque feedback line ("Correct — …", "Passed — that was …")
 *  stays up with no question open. It used to stay until the next question,
 *  and the one-card rule meant no card or postcard could show meanwhile. */
export const FEEDBACK_TIMEOUT_SECONDS = 6;
/** Seconds a card that opened by itself shows its full text before it folds
 *  to a title line. Presentation only: a card the rider clicked stays open. */
export const CARD_COLLAPSE_AFTER_SECONDS = 8;

// ---- The timeline -----------------------------------------------------------

/** Everything the pacer rate-limits by "how long since it last happened". */
export type PacedKind =
  | 'drive-by'
  | 'postcard'
  | 'bridge-quiz'
  | 'transit-line-quiz'
  | 'transit-stop-quiz'
  | 'transit-street-quiz'
  | 'transit-transfer-quiz';

/** Minimum seconds between two events of a kind. `postcard` is judged by
 *  `postcardOnEntry` / `postcardForLull`, which have richer rules, so it has
 *  no flat gap here. */
export const MIN_GAP_SECONDS: Record<Exclude<PacedKind, 'postcard'>, number> = {
  'drive-by': DRIVE_BY_MIN_GAP_SECONDS,
  'bridge-quiz': BRIDGE_QUIZ_COOLDOWN_SECONDS,
  'transit-line-quiz': TRANSIT_LINE_QUIZ_COOLDOWN_S,
  'transit-stop-quiz': TRANSIT_STOP_QUIZ_COOLDOWN_S,
  'transit-street-quiz': TRANSIT_STREET_QUIZ_COOLDOWN_S,
  'transit-transfer-quiz': TRANSIT_TRANSFER_QUIZ_COOLDOWN_S,
};

/** Seconds since `at`, or Infinity when it never happened or is from an
 *  earlier ride (`raceTime` restarts at 0). */
export function sinceEvent(now: number, at: number | null | undefined): number {
  return at == null || at > now ? Infinity : now - at;
}

/** Whether enough time has passed since the last event of `kind` for another.
 *  `override` is a gap supplied by the page (the transit module may tune its
 *  own cooldowns); it falls back to the table. */
export function gapElapsed(
  kind: Exclude<PacedKind, 'postcard'>,
  lastAt: number | null | undefined,
  now: number,
  override?: number,
): boolean {
  return sinceEvent(now, lastAt) >= (override ?? MIN_GAP_SECONDS[kind]);
}

/** Whether a street question may open this soon after a stop question. */
export function streetClearOfStop(lastStopAt: number | null | undefined, now: number, stopCooldown = TRANSIT_STOP_QUIZ_COOLDOWN_S): boolean {
  return sinceEvent(now, lastStopAt) >= stopCooldown * TRANSIT_STREET_AFTER_STOP_FRACTION;
}

// ---- Postcards --------------------------------------------------------------

export interface PostcardPacingInput {
  /** `raceTime`. */
  now: number;
  /** Entries to this neighbourhood before the current one, across rides. */
  priorEntries: number;
  /** `raceTime` when a trivia (landmark/street) card last opened. */
  lastTriviaAt: number | null;
  /** `raceTime` when a postcard last opened. */
  lastPostcardAt: number | null;
}

/** Whether an entry to a neighbourhood is worth its postcard. */
export function postcardOnEntry(input: PostcardPacingInput): boolean {
  if (input.priorEntries < POSTCARD_FIRST_VISITS) return true;
  return sinceEvent(input.now, input.lastTriviaAt) >= POSTCARD_QUIET_SECONDS
    && sinceEvent(input.now, input.lastPostcardAt) >= POSTCARD_MIN_GAP_SECONDS;
}

/** Whether a quiet stretch inside the current neighbourhood brings its postcard back. */
export function postcardForLull(input: Omit<PostcardPacingInput, 'priorEntries'> & { enteredAt: number }): boolean {
  const trivia = input.lastTriviaAt != null && input.lastTriviaAt <= input.now ? input.lastTriviaAt : -Infinity;
  return sinceEvent(input.now, Math.max(input.enteredAt, trivia)) >= POSTCARD_LULL_SECONDS
    && sinceEvent(input.now, input.lastPostcardAt) >= POSTCARD_LULL_GAP_SECONDS;
}

// ---- Feedback and card collapse ---------------------------------------------

/** Whether the plaque feedback line has been up long enough. `shownAt` is the
 *  `raceTime` it appeared; null means it is not being timed (a question is
 *  open, which owns the band). */
export function feedbackExpired(shownAt: number | null | undefined, now: number): boolean {
  return shownAt != null && sinceEvent(now, shownAt) >= FEEDBACK_TIMEOUT_SECONDS;
}

/** Why a card is up; mirrors `driveByTrigger.NoticeSource`. */
export type CardSource = 'click' | 'street' | 'drive-by' | 'arrival';

/** Whether a card folds to its title line. Only cards that opened by
 *  themselves do: a building the rider clicked, and the finish-screen arrival
 *  card, stay full. */
export function cardCollapsed(source: CardSource | null | undefined, elapsed: number): boolean {
  if (source !== 'street' && source !== 'drive-by') return false;
  return elapsed >= CARD_COLLAPSE_AFTER_SECONDS;
}
