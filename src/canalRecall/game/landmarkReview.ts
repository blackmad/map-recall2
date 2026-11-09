// Spaced review of landmarks (#300): a landmark you named comes back on a
// schedule instead of never.
//
// One sentence for the player: "A landmark you named right comes back after
// 1 day, then 3, then 7, then every 21; one you missed comes back on your next
// ride." That is the whole model, deliberately smaller than the street
// scheduler (src/spacedRepetition.ts, SM-2-like with ease): a landmark is a
// four-choice question met a few times a month, so a fixed ladder is enough
// and can be explained on the knowledge screen.
//
// Vocabulary follows the street model: `dueAt` (epoch ms), a missed answer
// parks the landmark for the exposure model's first interval (it "clears the
// ride", recallExposure.ts), and the question budget sees a due landmark as a
// `due-review` and a never-asked one as `new-unlearned` (questionBudget.ts
// decides the pace; nothing here changes it). The within-ride rule ("not twice
// in one ride") stays with the runtime's `_landmarkAsked` set.
//
// State in, state out; the storage is injected (progressStore.ts conventions:
// tolerant reads, capped, evicted oldest-first like personal bests).

import { EXPOSURE_FIRST_INTERVAL_MS } from '../recallExposure.ts';
import type { KeyValueStore } from './progressStore.ts';
import type { NameEventKind } from './questionBudget.ts';
import type { Sightings } from './landmarkQuestion.ts';

export const LANDMARK_REVIEW_STORAGE_KEY = 'canalRecall.landmarkReview.v1';
/** Days until a landmark named right comes back, by how many times in a row it was named. The last rung repeats. */
export const LANDMARK_REVIEW_DAYS: readonly number[] = [1, 3, 7, 21];
/** A missed landmark (wrong or "no idea") is parked this long: past this ride, back on the next. */
export const LANDMARK_MISSED_INTERVAL_MS = EXPOSURE_FIRST_INTERVAL_MS;
/** Stored states are capped and the least recently asked evicted first. */
export const LANDMARK_REVIEW_MAX_ENTRIES = 200;

const DAY_MS = 86_400_000;

export type LandmarkOutcome = 'right' | 'wrong' | 'no-idea';

export interface LandmarkReviewState {
  /** Right answers in a row: 0 after a miss, else the rung of LANDMARK_REVIEW_DAYS just used. */
  step: number;
  /** Epoch ms from which the landmark may be asked again. */
  dueAt: number;
  /** Epoch ms of the last answer; the eviction order. */
  lastAskedAt: number;
  rights: number;
  misses: number;
}

/** By landmark id. */
export type LandmarkReviews = Record<string, LandmarkReviewState>;

/** Interval after `step` right answers in a row (step ≥ 1). */
export function reviewIntervalMs(step: number): number {
  const days = LANDMARK_REVIEW_DAYS[Math.min(LANDMARK_REVIEW_DAYS.length, Math.max(1, step)) - 1]!;
  return days * DAY_MS;
}

/** The state after one answer. Pure. */
export function nextDue(state: LandmarkReviewState | undefined, outcome: LandmarkOutcome, now: number): LandmarkReviewState {
  const rights = state?.rights ?? 0;
  const misses = state?.misses ?? 0;
  if (outcome === 'right') {
    const step = (state?.step ?? 0) + 1;
    return { step, dueAt: now + reviewIntervalMs(step), lastAskedAt: now, rights: rights + 1, misses };
  }
  return { step: 0, dueAt: now + LANDMARK_MISSED_INTERVAL_MS, lastAskedAt: now, rights, misses: misses + 1 };
}

/** Asked before and its interval has elapsed. A never-asked landmark is new, not due. */
export function isDue(state: LandmarkReviewState | undefined, now: number): boolean {
  return !!state && now >= state.dueAt;
}

/** What a landmark is to the question budget now: due, new, or waiting (`known`, not asked). */
export function reviewKind(state: LandmarkReviewState | undefined, now: number): NameEventKind {
  if (!state) return 'new-unlearned';
  return isDue(state, now) ? 'due-review' : 'known';
}

export interface AskableCandidate { id: string; distance?: number }
export interface AskablePick<T> { candidate: T; kind: 'due-review' | 'new-unlearned' }

/**
 * The landmark to ask among candidates already in view and not asked this
 * ride: due reviews before never-asked ones, nearer first within each, ties
 * broken by `rng`. Waiting landmarks (named, interval not yet over) are never
 * picked. Whether the pick is actually asked is the budget's call.
 */
export function pickAskable<T extends AskableCandidate>(
  candidates: readonly T[],
  states: LandmarkReviews,
  now: number,
  rng: () => number = Math.random,
): AskablePick<T> | null {
  let best: { candidate: T; kind: 'due-review' | 'new-unlearned'; rank: number; distance: number; tie: number } | null = null;
  for (const candidate of candidates) {
    const kind = reviewKind(states[candidate.id], now);
    if (kind === 'known') continue;
    const rank = kind === 'due-review' ? 0 : 1;
    const distance = candidate.distance ?? 0;
    const tie = rng();
    if (!best || rank < best.rank || (rank === best.rank && (distance < best.distance || (distance === best.distance && tie < best.tie)))) {
      best = { candidate, kind, rank, distance, tie };
    }
  }
  return best && { candidate: best.candidate, kind: best.kind };
}

/** Landmarks due now among the stored states: the knowledge screen's count. */
export function dueCount(states: LandmarkReviews, now: number): number {
  return Object.values(states).filter(state => isDue(state, now)).length;
}

/**
 * Landmarks named before the schedule existed (a `named` sighting, no review
 * state) start on the first rung from the day they were named, so they come
 * back once instead of never. Pure; returns `states` when nothing is added.
 */
export function seedFromSightings(states: LandmarkReviews, sightings: Sightings): LandmarkReviews {
  let out = states;
  for (const [id, sighting] of Object.entries(sightings)) {
    if (sighting.how !== 'named' || out[id]) continue;
    if (out === states) out = { ...states };
    const at = sighting.at || 0;
    out[id] = { step: 1, dueAt: at + reviewIntervalMs(1), lastAskedAt: at, rights: 1, misses: 0 };
  }
  return out;
}

/** Keep the `max` most recently asked. Pure. */
export function capReviews(states: LandmarkReviews, max = LANDMARK_REVIEW_MAX_ENTRIES): LandmarkReviews {
  const ids = Object.keys(states);
  if (ids.length <= max) return states;
  ids.sort((a, b) => states[b]!.lastAskedAt - states[a]!.lastAskedAt || a.localeCompare(b));
  const out: LandmarkReviews = {};
  for (const id of ids.slice(0, max)) out[id] = states[id]!;
  return out;
}

/** Tolerates absent or corrupt JSON and drops malformed rows. */
export function readLandmarkReviews(store: KeyValueStore | null | undefined): LandmarkReviews {
  try {
    const raw = store?.getItem(LANDMARK_REVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<LandmarkReviewState>> | null;
    const out: LandmarkReviews = {};
    for (const [id, value] of Object.entries(parsed || {})) {
      if (!value || !Number.isFinite(value.dueAt)) continue;
      out[id] = {
        step: Math.max(0, Math.floor(Number(value.step) || 0)),
        dueAt: Number(value.dueAt),
        lastAskedAt: Number(value.lastAskedAt) || 0,
        rights: Math.max(0, Number(value.rights) || 0),
        misses: Math.max(0, Number(value.misses) || 0),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLandmarkReviews(store: KeyValueStore | null | undefined, states: LandmarkReviews): void {
  try { store?.setItem(LANDMARK_REVIEW_STORAGE_KEY, JSON.stringify(capReviews(states))); } catch { /* private mode */ }
}

/** Record one answer: the new states (capped), already persisted. */
export function recordLandmarkOutcome(
  store: KeyValueStore | null | undefined,
  states: LandmarkReviews,
  id: string,
  outcome: LandmarkOutcome,
  now: number,
): LandmarkReviews {
  const next = capReviews({ ...states, [id]: nextDue(states[id], outcome, now) });
  saveLandmarkReviews(store, next);
  return next;
}

/** Wipe the landmark schedule ("Clear all data"). */
export function clearLandmarkReviews(store: KeyValueStore): void {
  try {
    if (store.removeItem) store.removeItem(LANDMARK_REVIEW_STORAGE_KEY);
    else store.setItem(LANDMARK_REVIEW_STORAGE_KEY, '');
  } catch { /* private mode */ }
}
