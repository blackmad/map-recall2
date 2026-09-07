import type { ReviewEvent, ReviewState } from '../spacedRepetition.ts';

export const REVIEW_STATES_KEY = 'mapRecall_reviewStates_v1';
export const REVIEW_EVENTS_KEY = 'mapRecall_reviewEvents_v1';

export type KnowledgeStatus = 'due' | 'learning' | 'known' | 'mastered';

export interface KnowledgeItem {
  key: string;
  name: string;
  type: string;
  cityId: string;
  status: KnowledgeStatus;
  mastery: number;
  dueAt: number;
  lastReviewedAt: number;
  repetitions: number;
  lapses: number;
  places: number;
}

export interface KnowledgeCitySummary {
  cityId: string;
  tracked: number;
  due: number;
  mastered: number;
}

export interface KnowledgeActivityDay {
  day: string;
  label: string;
  reviews: number;
}

export interface KnowledgeReview {
  items: KnowledgeItem[];
  cities: KnowledgeCitySummary[];
  activity: KnowledgeActivityDay[];
  tracked: number;
  due: number;
  learning: number;
  known: number;
  mastered: number;
  reviews: number;
  correctReviews: number;
  accuracy: number | null;
}

const normalize = (value: string): string => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const dayKey = (time: number): string => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function statusFor(mastery: number, due: boolean): KnowledgeStatus {
  if (due) return 'due';
  if (mastery >= 0.75) return 'mastered';
  if (mastery >= 0.45) return 'known';
  return 'learning';
}

/**
 * Collapse place-local SRS chunks into the named things a person recognizes.
 * A name is due when any practised place carrying it is due; mastery follows
 * the strongest chunk, matching the city overview and route-selection rule.
 */
export function buildKnowledgeReview(
  states: readonly ReviewState[],
  events: readonly ReviewEvent[],
  now = Date.now(),
): KnowledgeReview {
  const groups = new Map<string, ReviewState[]>();
  for (const state of states) {
    if (state.mode !== 'guess_name' || !state.featureSnapshot?.name) continue;
    const feature = state.featureSnapshot;
    const key = `${feature.cityId}|${feature.type}|${normalize(feature.name)}`;
    const group = groups.get(key);
    if (group) group.push(state);
    else groups.set(key, [state]);
  }

  const items = [...groups.entries()].map(([key, group]): KnowledgeItem => {
    const first = group[0].featureSnapshot;
    let mastery = 0;
    let due = false;
    for (const state of group) {
      const practiced = Math.min(1, state.repetitions / 3);
      mastery = Math.max(mastery, state.dueAt > now ? practiced : practiced * 0.5);
      if (state.dueAt <= now) due = true;
    }
    return {
      key,
      name: first.name,
      type: first.type,
      cityId: first.cityId,
      status: statusFor(mastery, due),
      mastery,
      dueAt: Math.min(...group.map(state => state.dueAt)),
      lastReviewedAt: Math.max(...group.map(state => state.lastReviewedAt)),
      repetitions: group.reduce((sum, state) => sum + state.repetitions, 0),
      lapses: group.reduce((sum, state) => sum + state.lapses, 0),
      places: group.length,
    };
  }).sort((a, b) => {
    if (a.status === 'due' && b.status !== 'due') return -1;
    if (a.status !== 'due' && b.status === 'due') return 1;
    if (a.status === 'due') return a.dueAt - b.dueAt;
    if (a.mastery !== b.mastery) return a.mastery - b.mastery;
    return b.lastReviewedAt - a.lastReviewedAt;
  });

  const cityMap = new Map<string, KnowledgeCitySummary>();
  for (const item of items) {
    const city = cityMap.get(item.cityId) || { cityId: item.cityId, tracked: 0, due: 0, mastered: 0 };
    city.tracked += 1;
    if (item.status === 'due') city.due += 1;
    if (item.status === 'mastered') city.mastered += 1;
    cityMap.set(item.cityId, city);
  }
  const cities = [...cityMap.values()].sort((a, b) => b.tracked - a.tracked);

  const activity: KnowledgeActivityDay[] = [];
  const activityByDay = new Map<string, KnowledgeActivityDay>();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const time = start.getTime() - offset * 86_400_000;
    const day = dayKey(time);
    const entry = {
      day,
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(time).slice(0, 2),
      reviews: 0,
    };
    activity.push(entry);
    activityByDay.set(day, entry);
  }

  let reviews = 0;
  let correctReviews = 0;
  for (const event of events) {
    if (event.mode !== 'guess_name') continue;
    reviews += 1;
    if (event.rating !== 'again') correctReviews += 1;
    const day = activityByDay.get(dayKey(event.reviewedAt));
    if (day) day.reviews += 1;
  }

  return {
    items,
    cities,
    activity,
    tracked: items.length,
    due: items.filter(item => item.status === 'due').length,
    learning: items.filter(item => item.status === 'learning').length,
    known: items.filter(item => item.status === 'known').length,
    mastered: items.filter(item => item.status === 'mastered').length,
    reviews,
    correctReviews,
    accuracy: reviews ? correctReviews / reviews : null,
  };
}

function readValues<T>(storage: Pick<Storage, 'getItem'>, key: string): T[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '{}') as unknown;
    return Array.isArray(parsed) ? parsed as T[] : Object.values(parsed as Record<string, T>);
  } catch {
    return [];
  }
}

export function loadKnowledgeReview(
  storage: Pick<Storage, 'getItem'>,
  now = Date.now(),
): KnowledgeReview {
  return buildKnowledgeReview(
    readValues<ReviewState>(storage, REVIEW_STATES_KEY),
    readValues<ReviewEvent>(storage, REVIEW_EVENTS_KEY),
    now,
  );
}
