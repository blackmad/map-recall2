/**
 * Daily five (wave-2 review, 2026-10-13): five mixed questions near home (or
 * the city centre), the same five all day, with a streak for coming back.
 *
 * The day is the Europe/Amsterdam calendar day, so a player in Amsterdam gets
 * a new five at local midnight wherever the device clock's zone is set.
 * Streak state lives in localStorage `mapRecall.daily.v1`.
 */
import type { StreetFeature } from '../types';
import { calculateHaversineDistanceMeters } from '../utils/geo';
import { getFeatureKey } from '../utils/featureIdentity';

export const DAILY_ROUNDS = 5;
export const DAILY_STORAGE_KEY = 'mapRecall.daily.v1';
/** Start this close to home or the centre; widen until there is enough to choose from. */
export const DAILY_RING_START_M = 1500;
export const DAILY_RING_STEP_M = 750;
export const DAILY_RING_MAX_M = 8000;
/** Candidates the five are drawn from, so the day is varied but stays local. */
export const DAILY_MIN_POOL = 20;

const DAY_MS = 86_400_000;

/** "2026-10-13": today's calendar day in Amsterdam. */
export function amsterdamDay(now = Date.now()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

const dayNumber = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, date) / DAY_MS);
};

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Tue 13 Oct" for a YYYY-MM-DD day. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${date} ${MONTHS[month - 1]}`;
}

export interface DailyRecord {
  /** Last day a daily five was finished. */
  lastDay: string | null;
  streak: number;
  best: number;
}

export const EMPTY_DAILY: DailyRecord = { lastDay: null, streak: 0, best: 0 };

/** Finishing today's five: the same day twice counts once; a missed day restarts at 1. */
export function completeDaily(record: DailyRecord, day: string): DailyRecord {
  if (record.lastDay === day) return record;
  const consecutive = record.lastDay !== null && daysBetween(record.lastDay, day) === 1;
  const streak = consecutive ? record.streak + 1 : 1;
  return { lastDay: day, streak, best: Math.max(record.best, streak) };
}

/** The streak as it stands today: still alive if the last five was today or yesterday. */
export function currentStreak(record: DailyRecord, today: string): number {
  if (!record.lastDay) return 0;
  const gap = daysBetween(record.lastDay, today);
  return gap === 0 || gap === 1 ? record.streak : 0;
}

export const doneToday = (record: DailyRecord, today: string) => record.lastDay === today;

interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function readDaily(store: Store | null): DailyRecord {
  try {
    const parsed = JSON.parse(store?.getItem(DAILY_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY_DAILY;
    return {
      lastDay: typeof parsed.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastDay) ? parsed.lastDay : null,
      streak: Number.isFinite(parsed.streak) ? Math.max(0, Math.trunc(parsed.streak)) : 0,
      best: Number.isFinite(parsed.best) ? Math.max(0, Math.trunc(parsed.best)) : 0,
    };
  } catch {
    return EMPTY_DAILY;
  }
}

export function writeDaily(store: Store | null, record: DailyRecord): void {
  try { store?.setItem(DAILY_STORAGE_KEY, JSON.stringify(record)); } catch { /* storage unavailable */ }
}

/** FNV-1a: a stable 32-bit hash for the day's seed. */
function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

/** Seed for a day: the same everywhere for the same day and origin. */
export const dailySeed = (day: string) => hash(`daily:${day}`);

/**
 * Today's five: features within a ring around `origin` (widened until there
 * are `DAILY_MIN_POOL`), then a prominence-weighted draw seeded by the day,
 * at most two of one feature type so the five stay mixed.
 */
export function selectDailyFive(features: readonly StreetFeature[], origin: [number, number], day: string, rounds = DAILY_ROUNDS): StreetFeature[] {
  const withDistance = features
    .filter((feature) => feature.type !== 'neighborhood')
    .map((feature) => ({ feature, metres: calculateHaversineDistanceMeters(origin, feature.center) }));
  let radius = DAILY_RING_START_M;
  while (radius < DAILY_RING_MAX_M && withDistance.filter((item) => item.metres <= radius).length < DAILY_MIN_POOL) radius += DAILY_RING_STEP_M;
  const pool = withDistance.filter((item) => item.metres <= radius).map((item) => item.feature);
  const seed = dailySeed(day);
  const ranked = pool
    .map((feature) => {
      const random = (hash(`${seed}:${getFeatureKey(feature)}`) + 1) / 4_294_967_297;
      const weight = 1 + Math.max(0, feature.prominenceScore || 0) / 80;
      return { feature, order: -Math.log(random) / weight };
    })
    .sort((a, b) => a.order - b.order)
    .map((item) => item.feature);
  const typeGroup = (feature: StreetFeature) => (['avenue', 'boulevard'].includes(feature.type) ? 'street' : feature.type === 'water' ? 'canal' : feature.type);
  const chosen: StreetFeature[] = [];
  const perType = new Map<string, number>();
  for (const feature of ranked) {
    if (chosen.length >= rounds) break;
    const group = typeGroup(feature);
    if ((perType.get(group) ?? 0) >= 2) continue;
    perType.set(group, (perType.get(group) ?? 0) + 1);
    chosen.push(feature);
  }
  // A thin pool (one kind only) still fills the five.
  for (const feature of ranked) {
    if (chosen.length >= rounds) break;
    if (!chosen.includes(feature)) chosen.push(feature);
  }
  return chosen;
}
