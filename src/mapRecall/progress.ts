/**
 * What the player has learned, read from the spaced-repetition store
 * (src/spacedRepetition.ts) for the start rail and the end-of-session screen.
 *
 * The store (localStorage `mapRecall_reviewStates_v1`) is shared with Canal
 * Recall, so "known" places and earned neighbourhood postcards carry across
 * both apps. Everything here is pure; callers pass `now` for determinism.
 */
import type { GameMode, RoundResult, StreetFeature } from '../types';
import { rateRound, scheduleReview, type ReviewRating, type ReviewState } from '../spacedRepetition';
import { getFeatureKey } from '../utils/featureIdentity';

const stateKey = (featureKey: string, mode: GameMode) => `${featureKey}_${mode}`;

const indexStates = (states: readonly ReviewState[]) =>
  new Map(states.map((state) => [stateKey(state.featureKey, state.mode), state]));

const inCity = (state: ReviewState, cityId?: string) => !cityId || !state.featureSnapshot?.cityId || state.featureSnapshot.cityId === cityId;

/** Reviews in `mode` whose due time has passed (optionally for one city). */
export function dueCount(states: readonly ReviewState[], mode: GameMode, now = Date.now(), cityId?: string): number {
  return states.filter((state) => state.mode === mode && state.dueAt <= now && inCity(state, cityId)).length;
}

/** Places answered well at least once since their last lapse in `mode` (repetitions >= 1). */
export function knownCount(states: readonly ReviewState[], mode: GameMode, cityId?: string): number {
  return states.filter((state) => state.mode === mode && state.repetitions >= 1 && inCity(state, cityId)).length;
}

/** The start rail's one-line summary. */
export function progressLine(states: readonly ReviewState[], mode: GameMode, now = Date.now(), cityId?: string): string {
  const due = dueCount(states, mode, now, cityId);
  const known = knownCount(states, mode, cityId);
  if (!due && !known) return 'Nothing due · 0 known yet — start with canals';
  return `${due ? `Due today ${due}` : 'Nothing due'} · Known ${known}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** "today", "tomorrow" or "Thu 16 Oct", in local time. */
export function formatReviewDay(dueAt: number, now = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(dueAt);
  if (day <= today) return 'today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (day === tomorrow.getTime()) return 'tomorrow';
  const date = new Date(dueAt);
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export interface SessionItem {
  featureKey: string;
  name: string;
  type: StreetFeature['type'];
  rating: ReviewRating;
  nextReviewAt: number;
  /** "today" / "tomorrow" / "Thu 16 Oct". */
  nextReview: string;
  result: RoundResult;
}

export interface SessionGroups {
  /** Answered well and already known before this session. */
  known: SessionItem[];
  /** Rated again or hard. */
  shaky: SessionItem[];
  /** Answered well and not known before: first sight, or relearned after a lapse. */
  fresh: SessionItem[];
}

const isWell = (rating: ReviewRating) => rating === 'good' || rating === 'easy';

/**
 * Sorts a session's answers into Known / Still shaky / New. The next review comes
 * from `statesAfter` (what recordReview wrote); a result missing there is
 * rescheduled from `statesBefore` so the screen never shows a blank date.
 */
export function sessionGroups(
  results: readonly RoundResult[],
  statesBefore: readonly ReviewState[],
  statesAfter: readonly ReviewState[],
  now = Date.now(),
): SessionGroups {
  const before = indexStates(statesBefore);
  const after = indexStates(statesAfter);
  const groups: SessionGroups = { known: [], shaky: [], fresh: [] };
  for (const result of results) {
    const featureKey = getFeatureKey(result.feature);
    const key = stateKey(featureKey, result.gameMode);
    const previous = before.get(key);
    const rating = rateRound(result);
    const next = after.get(key) ?? scheduleReview(result, previous, now).state;
    const item: SessionItem = {
      featureKey,
      name: result.feature.name,
      type: result.feature.type,
      rating,
      nextReviewAt: next.dueAt,
      nextReview: formatReviewDay(next.dueAt, now),
      result,
    };
    if (!isWell(rating)) groups.shaky.push(item);
    else if ((previous?.repetitions ?? 0) >= 1) groups.known.push(item);
    else groups.fresh.push(item);
  }
  return groups;
}

export interface EarnedArea {
  featureKey: string;
  name: string;
  cityId?: string;
  /** Latest review that counted; the rack shows the newest first. */
  earnedAt: number;
}

const nameKey = (cityId: string | undefined, name: string) => `${cityId ?? ''}|${name.trim().toLowerCase()}`;

/**
 * Neighbourhoods with a postcard: any mode's review state of a neighbourhood
 * with repetitions >= 1. Deduplicated by key and by city+name (the same area
 * reviewed in two modes, or keyed from slightly different centres), newest first.
 */
export function earnedAreas(states: readonly ReviewState[], cityId?: string): EarnedArea[] {
  const byName = new Map<string, EarnedArea>();
  for (const state of states) {
    const snapshot = state.featureSnapshot;
    if (!snapshot || snapshot.type !== 'neighborhood' || state.repetitions < 1) continue;
    if (cityId && snapshot.cityId && snapshot.cityId !== cityId) continue;
    const key = nameKey(snapshot.cityId, snapshot.name);
    const existing = byName.get(key);
    if (!existing || state.lastReviewedAt > existing.earnedAt) {
      byName.set(key, { featureKey: state.featureKey, name: snapshot.name, cityId: snapshot.cityId, earnedAt: state.lastReviewedAt });
    }
  }
  return [...byName.values()].sort((a, b) => b.earnedAt - a.earnedAt);
}

/** Featurekeys and city+name keys of the earned set, for matching extract features. */
export function earnedAreaKeys(states: readonly ReviewState[], cityId?: string): Set<string> {
  const keys = new Set<string>();
  for (const area of earnedAreas(states, cityId)) {
    keys.add(area.featureKey);
    keys.add(nameKey(area.cityId, area.name));
  }
  return keys;
}

/** Whether `feature` is in an `earnedAreaKeys` set. */
export const isEarned = (keys: ReadonlySet<string>, feature: Pick<StreetFeature, 'cityId' | 'name'> & Partial<StreetFeature>): boolean =>
  keys.has(nameKey(feature.cityId, feature.name)) || (!!feature.center && keys.has(getFeatureKey(feature as StreetFeature)));

/**
 * Neighbourhood postcards this session earned: answered well and not earned
 * before it. Best answer first (highest points), one per area.
 */
export function newlyEarned(results: readonly RoundResult[], statesBefore: readonly ReviewState[]): RoundResult[] {
  const had = earnedAreaKeys(statesBefore);
  const seen = new Set<string>();
  return results
    .filter((result) => result.feature.type === 'neighborhood' && isWell(rateRound(result)) && !isEarned(had, result.feature))
    .sort((a, b) => b.pointsEarned - a.pointsEarned)
    .filter((result) => {
      const key = nameKey(result.feature.cityId, result.feature.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
