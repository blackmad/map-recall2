// The silent pass: a new street name the question budget declined.
//
// Questions block the ride (user decision 2026-10-13: a question you can ride
// away from teaches less than one you have to answer). What keeps the centre
// from stopping the bike every block is the budget (`questionBudget.ts`), not
// a moving card. A name the budget declines is ridden past silently: the HUD
// withholds it while the rider is on the street, and once they have left it
// the name is said in one line and counted as exposure for spaced repetition.
//
// The reveal never comes before the rider has left the street. That is the
// geographic-learning rule: the street under question must never be revealed
// by the HUD or the map before the answer.
//
// Pure: it sees time and the road name under the vehicle, nothing else.

/** Seconds the vehicle must be off the street, unbroken, to have left it. A
 *  junction crossing or a bridge-end wobble is shorter than this. */
export const LEAVE_STREET_SECONDS = 1.2;

export interface SilentPassState {
  /** The street being withheld. */
  name: string;
  /** Unbroken seconds the vehicle has been on some other road (or none). */
  offStreetSeconds: number;
}

export function beginSilentPass(name: string): SilentPassState {
  return { name, offStreetSeconds: 0 };
}

/** One frame: `left` once the street has been left for LEAVE_STREET_SECONDS. */
export function advanceSilentPass(
  state: SilentPassState,
  input: { dt: number; roadName: string },
): { state: SilentPassState; left: boolean } {
  const offStreetSeconds = input.roadName === state.name ? 0 : state.offStreetSeconds + input.dt;
  return { state: { ...state, offStreetSeconds }, left: offStreetSeconds >= LEAVE_STREET_SECONDS };
}

/** Whether the frame loop must hold the vehicle: every open question does; a
 *  silent pass is a withheld name with no question behind it. */
export function questionFreezesRide(open: boolean, silent: boolean): boolean {
  return open && !silent;
}

/** Whether an answer's hold may close its card. Not when another question has
 *  opened since (its card is the one on screen); a silent pass is not one, as
 *  it has no card. Treating it as one kept the answered card up until the
 *  rider left the street (keyboard-ride.spec.ts, Melkwegbrug, 2026-10-29). */
export function answerHoldMayHide(holdIsCurrent: boolean, questionOpen: boolean, silent: boolean): boolean {
  return holdIsCurrent && !questionFreezesRide(questionOpen, silent);
}
