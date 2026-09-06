/**
 * Calendar streak of days the player named something *new* (exploration gain),
 * not consecutive correct answers.
 */

import type { KeyValueStore } from './progressStore';

export const PLACE_STREAK_STORAGE_KEY = 'canalRecall.placeStreak.v1';

export interface PlaceStreak {
  /** UTC calendar days `YYYY-MM-DD` with new names, newest last. */
  days: string[];
  /** Current consecutive-day streak ending today (or yesterday if not yet today). */
  current: number;
  best: number;
}

export function emptyPlaceStreak(): PlaceStreak {
  return { days: [], current: 0, best: 0 };
}

export function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function dayOffset(key: string, delta: number): string {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function recompute(days: string[]): PlaceStreak {
  const unique = [...new Set(days)].sort();
  if (unique.length === 0) return emptyPlaceStreak();
  const today = utcDayKey();
  const yesterday = dayOffset(today, -1);
  let current = 0;
  let cursor = unique.includes(today) ? today : unique.includes(yesterday) ? yesterday : '';
  while (cursor && unique.includes(cursor)) {
    current += 1;
    cursor = dayOffset(cursor, -1);
  }
  let best = current;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === dayOffset(unique[i - 1]!, 1)) run += 1;
    else run = 1;
    if (run > best) best = run;
  }
  return { days: unique.slice(-90), current, best: Math.max(best, current) };
}

export function readPlaceStreak(store: KeyValueStore): PlaceStreak {
  try {
    const raw = store.getItem(PLACE_STREAK_STORAGE_KEY);
    if (!raw) return emptyPlaceStreak();
    const parsed = JSON.parse(raw) as Partial<PlaceStreak>;
    return recompute(Array.isArray(parsed.days) ? parsed.days.map(String) : []);
  } catch {
    return emptyPlaceStreak();
  }
}

/** Record a day where the player added at least one new name to the collection. */
export function notePlaceDay(store: KeyValueStore, now = Date.now()): PlaceStreak {
  const day = utcDayKey(now);
  const prior = readPlaceStreak(store);
  if (prior.days.includes(day)) return prior;
  const next = recompute([...prior.days, day]);
  try {
    store.setItem(PLACE_STREAK_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function clearPlaceStreak(store: KeyValueStore): void {
  try {
    if (store.removeItem) store.removeItem(PLACE_STREAK_STORAGE_KEY);
    else store.setItem(PLACE_STREAK_STORAGE_KEY, '');
  } catch {
    /* ignore */
  }
}

export function placeStreakLabel(streak: PlaceStreak): string | null {
  if (streak.current <= 0) return null;
  if (streak.current === 1) return 'First new place today';
  return `${streak.current}-day place streak`;
}
