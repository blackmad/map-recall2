// The non-blocking ("riding") route question.
//
// A route question used to stop the vehicle: speed was zeroed and the frame
// loop returned early until it was answered. In the centre that was a stop
// every block. A riding question leaves the vehicle moving. The options sit in
// the bottom band, keys 1-4 or a tap answer while moving, and the question
// ends one of three ways:
//
//   answered   graded as usual (right / wrong / no idea);
//   expired    12 s with no answer: graded `passed`. The street name stays
//              hidden, because the rider is still on the street in question;
//   left       the rider rode off the street (for a short while, so a
//              junction wobble does not count): graded `passed` and the name
//              is shown in a one-line reveal.
//
// The reveal never comes before the rider has left the street. That is the
// geographic-learning rule: the street under question must never be revealed
// by the HUD or the map before the answer.
//
// Pure: it sees time and the road name under the vehicle, nothing else.

/** Seconds a riding question waits for an answer. */
export const RIDING_PROMPT_TIMEOUT_SECONDS = 12;
/** Seconds the vehicle must be off the street, unbroken, to have left it. A
 *  junction crossing or a bridge-end wobble is shorter than this. */
export const RIDING_LEAVE_STREET_SECONDS = 1.2;

export interface RidingPromptState {
  /** The street being asked about. */
  name: string;
  /** Seconds since it opened. */
  elapsed: number;
  /** Unbroken seconds the vehicle has been on some other road (or none). */
  offStreetSeconds: number;
  /** The 12 s are up: graded `passed`, card hidden, name still withheld. */
  expired: boolean;
}

export type RidingPromptEvent =
  | 'none'
  /** Timed out while still on the street: hide the card, grade `passed`,
   *  keep the name hidden. */
  | 'expire'
  /** The street was left: reveal the name in one line and close the question. */
  | 'leave';

export function openRidingPrompt(name: string): RidingPromptState {
  return { name, elapsed: 0, offStreetSeconds: 0, expired: false };
}

export function advanceRidingPrompt(
  state: RidingPromptState,
  input: { dt: number; roadName: string },
): { state: RidingPromptState; event: RidingPromptEvent } {
  const elapsed = state.elapsed + input.dt;
  const offStreetSeconds = input.roadName === state.name ? 0 : state.offStreetSeconds + input.dt;
  // Leaving wins over timing out: the rider has gone, so the name may be shown.
  if (offStreetSeconds >= RIDING_LEAVE_STREET_SECONDS) {
    return { state: { ...state, elapsed, offStreetSeconds }, event: 'leave' };
  }
  if (!state.expired && elapsed >= RIDING_PROMPT_TIMEOUT_SECONDS) {
    return { state: { ...state, elapsed, offStreetSeconds, expired: true }, event: 'expire' };
  }
  return { state: { ...state, elapsed, offStreetSeconds }, event: 'none' };
}

export type PromptMode = 'blocking' | 'riding';

export interface PromptModeInput {
  /** The page's `game.js` honours riding mode (see `_quizFreezesRide`). */
  hookInstalled: boolean;
  /** The rider's setting; undefined means on. */
  enabled?: boolean;
  answerMode: 'multiple' | 'typed' | string;
  kind: string;
  transit: boolean;
}

/**
 * Which mode a question opens in. Only multiple-choice route questions ride:
 * typed answers need the keyboard, and bridge-arrival and water-crossing
 * questions are about the place the vehicle is passing right now, so they keep
 * the freeze.
 */
export function promptModeFor(input: PromptModeInput): PromptMode {
  if (!input.hookInstalled || input.enabled === false) return 'blocking';
  if (input.answerMode !== 'multiple' || input.kind !== 'route' || input.transit) return 'blocking';
  return 'riding';
}

/** Whether the frame loop must hold the vehicle for the open question. */
export function questionFreezesRide(open: boolean, mode: PromptMode): boolean {
  return open && mode !== 'riding';
}
