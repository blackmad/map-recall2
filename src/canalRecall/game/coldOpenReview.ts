/**
 * Cold-open review: one overdue SRS place in the first minute of a ride.
 */

export interface DueReviewPlace {
  name: string;
  type: string;
  cityId: string;
  center: [number, number];
  dueAt: number;
}

export interface ColdOpenPickInput {
  due: readonly DueReviewPlace[];
  cityId: string;
  /** Prefer types matching the travel mode. */
  preferTypes: readonly string[];
  now?: number;
}

/**
 * Pick one overdue review. Prefers mode-matching types, then soonest-due.
 * Returns null when nothing is due — the ride starts quiet.
 */
export function pickColdOpenReview(input: ColdOpenPickInput): DueReviewPlace | null {
  const now = input.now ?? Date.now();
  const city = input.due.filter(
    (place) => place.cityId === input.cityId
      && place.dueAt <= now
      && !!place.name
      && Number.isFinite(place.center[0])
      && Number.isFinite(place.center[1]),
  );
  if (!city.length) return null;
  const preferred = city.filter((place) => input.preferTypes.includes(place.type));
  const pool = preferred.length ? preferred : city;
  pool.sort((a, b) => a.dueAt - b.dueAt);
  return pool[0] || null;
}

export const COLD_OPEN_WINDOW_S = 55;
export const COLD_OPEN_MIN_S = 8;
