/**
 * What My progress shows, computed from the stores both apps already write:
 * ride history (canalRecall/routeHistory.ts) and spaced-review states
 * (`mapRecall_reviewStates_v1`, read through canalRecall/knowledgeReview.ts so
 * "mastered" means exactly what the ride's knowledge screen says it means).
 * Pure: callers pass storage-derived arrays and `now`.
 */
import type { ReviewEvent, ReviewState } from '../spacedRepetition';
import { buildKnowledgeReview, type KnowledgeItem } from '../canalRecall/knowledgeReview';
import { dayStreak, summarizeRides, type RideRecord } from '../canalRecall/routeHistory';

export const WATER_TYPES = new Set(['canal', 'water']);
export const STREET_TYPES = new Set(['street', 'boulevard', 'avenue', 'square', 'bridge']);

export interface ProgressView {
  rides: number;
  /** Names answered right at least once since their last lapse (ride and quiz). */
  namesLearned: number;
  streak: number;
  canals: KnowledgeItem[];
  streets: KnowledgeItem[];
  /** Street/canal names practised but not yet mastered. */
  learning: number;
  /** Of those, due for review now. */
  due: number;
  empty: boolean;
}

const byName = (a: KnowledgeItem, b: KnowledgeItem) => a.name.localeCompare(b.name, 'nl');

export function progressView(
  rides: readonly RideRecord[],
  states: readonly ReviewState[],
  events: readonly ReviewEvent[],
  now = Date.now(),
): ProgressView {
  const review = buildKnowledgeReview(states, events, now);
  const place = review.items.filter(item => WATER_TYPES.has(item.type) || STREET_TYPES.has(item.type));
  const mastered = place.filter(item => item.status === 'mastered');
  const activity = [
    ...rides.map(r => r.endedAt),
    ...events.map(e => e.reviewedAt),
    ...states.map(s => s.lastReviewedAt),
  ];
  const namesLearned = new Set(
    states.filter(s => s.repetitions >= 1 && s.featureSnapshot?.name)
      .map(s => `${s.featureSnapshot.cityId}|${s.featureSnapshot.name.trim().toLowerCase()}`),
  ).size;
  const summary = summarizeRides(rides);
  return {
    rides: summary.rides,
    namesLearned,
    streak: dayStreak(activity, now),
    canals: mastered.filter(item => WATER_TYPES.has(item.type)).sort(byName),
    streets: mastered.filter(item => STREET_TYPES.has(item.type)).sort(byName),
    learning: place.length - mastered.length,
    due: place.filter(item => item.status === 'due').length,
    empty: rides.length === 0 && states.length === 0,
  };
}

/** "1 ride", "3 rides". */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Today, 14:05", "Yesterday, 09:12", "Thu 9 Oct". */
export function rideWhen(endedAt: number, now = Date.now()): string {
  const day = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((day(now) - day(endedAt)) / 86_400_000);
  if (diff <= 0) return `Today, ${TIME.format(endedAt)}`;
  if (diff === 1) return `Yesterday, ${TIME.format(endedAt)}`;
  return DATE.format(endedAt);
}

// ---- Landmark stamps (src/canalRecall/collection/poiCollection.ts, another lane) ----

export interface StampEntry { id: string; name: string; firstEarnedAt: number; how: string; count: number }
export interface StampCollection {
  progress(): { earned: number; total: number };
  all(): StampEntry[];
}

export function isStampCollection(value: unknown): value is StampCollection {
  const v = value as StampCollection | null;
  return !!v && typeof v.progress === 'function' && typeof v.all === 'function';
}

/** The first export shaped like a collection: a named global, a default export, or the module itself. */
export function pickStampCollection(mod: unknown): StampCollection | null {
  const m = mod as Record<string, unknown> | null;
  if (!m) return null;
  for (const candidate of [m.CanalCollection, m.collection, m.poiCollection, m.default, m]) {
    if (isStampCollection(candidate)) return candidate;
  }
  return null;
}
