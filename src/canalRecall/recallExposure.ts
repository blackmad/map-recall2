/**
 * Exposure: a name the rider was shown but not asked.
 *
 * A riding question that timed out, or that the rider left behind, reveals the
 * name without a graded answer (the `passed` grade). Before 2026-10-13 that
 * left no trace in the store, so the same street was simply asked again at the
 * next opportunity, often seconds later on a neighbouring chunk of the same
 * street. Exposure writes a state of its own:
 *
 * - it is not recall: `repetitions`, `lapses` and `ease` are untouched, no
 *   review event is logged, and the state never counts as known or due;
 * - it parks the name for a short first interval (`EXPOSURE_FIRST_INTERVAL_MS`)
 *   so the same ride does not ask it again straight away (the store treats any
 *   state still inside its interval as "answered near here recently");
 * - once the interval has elapsed the name is an ordinary unlearned name again
 *   and earns a question when the budget has room;
 * - repeated exposures space out (doubling, capped at a day), so a street the
 *   rider keeps riding past without engaging is not pushed at them every ride.
 *
 * A name the rider already knows (`repetitions > 0`) is left alone: seeing it
 * again is not new information and must not move its review date.
 */
import type { ReviewState } from '../spacedRepetition.ts';

/** The first interval after a name is only shown: long enough to clear the ride. */
export const EXPOSURE_FIRST_INTERVAL_MS = 30 * 60 * 1000;
/** Exposures stop spacing out at this interval. */
export const EXPOSURE_MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 86_400_000;

/** Seconds-free spacing: 30 min, 1 h, 2 h, ... capped at a day. */
export function exposureIntervalMs(priorExposures: number): number {
  return Math.min(EXPOSURE_MAX_INTERVAL_MS, EXPOSURE_FIRST_INTERVAL_MS * 2 ** Math.max(0, priorExposures));
}

export interface ExposureInput {
  featureKey: string;
  snapshot: ReviewState['featureSnapshot'];
}

/**
 * The state after one exposure, or `previous` itself when nothing should
 * change (a name the rider already knows).
 */
export function scheduleExposure(input: ExposureInput, previous: ReviewState | undefined, now = Date.now()): ReviewState {
  if (previous && previous.repetitions > 0) return previous;
  const exposures = (previous?.exposures ?? 0) + 1;
  const dueAt = Math.max(previous?.dueAt ?? 0, now + exposureIntervalMs(exposures - 1));
  return {
    featureKey: input.featureKey,
    mode: 'guess_name',
    dueAt,
    intervalDays: (dueAt - now) / DAY_MS,
    ease: previous?.ease ?? 2.3,
    repetitions: 0,
    lapses: previous?.lapses ?? 0,
    lastReviewedAt: previous?.lastReviewedAt ?? 0,
    lastEventId: previous?.lastEventId ?? '',
    schedulerVersion: 1,
    exposures,
    lastExposedAt: now,
    featureSnapshot: input.snapshot,
  };
}

/** A state made only by exposure: never graded, so not knowledge to list. */
export function isExposureOnly(state: Pick<ReviewState, 'repetitions' | 'lapses' | 'lastEventId' | 'exposures'>): boolean {
  return (state.exposures ?? 0) > 0 && state.repetitions === 0 && state.lapses === 0 && !state.lastEventId;
}
