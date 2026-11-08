// The landing page for a returning player (G2, #272): Today's ride, Continue
// (names due) and Free Ride, with the place streak and passport count above.
//
// Everything here is read from localStorage the ride already writes; nothing
// is fetched. A first-time visitor (no ride opened, no history, no names) and
// `?landing=0` keep the static landing as it was.

import { CANAL_CITIES } from '../game/cities';
import {
  dailyRideBoard,
  dailyRideDateKey,
  dailyRidePair,
  type DailyRideDay,
  type DailyRidePair,
} from '../game/dailyRide';
import type { RoutePoi } from '../game/surprisePick';
import { stampCount } from '../stampAlbum';
import { readPlaceStreak } from '../game/placeStreak';
import { loadKnowledgeReview } from '../knowledgeReview';
import { loadRouteHistory } from '../routeHistory';
import { RETURNING_PLAYER_KEY } from '../../siteLinks';

/** Only read; the type matches the stores' own readers. */
type ReadStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Ride link query for each card (read by game-route.js `_checkShareLink`). */
export const LANDING_RIDE_QUERY = {
  daily: '?ride=daily',
  review: '?ride=review',
  free: '?ride=free',
} as const;
export type LandingCardId = keyof typeof LANDING_RIDE_QUERY;

/** Minutes a review ride takes per due name: a question every half minute or
 *  so, the ride between them, and the route to string them on. 7 → 12 min. */
export const DUE_MINUTES_PER_NAME = 1.7;
export const DUE_MINUTES_MIN = 5;
export const DUE_MINUTES_MAX = 30;

/** The curated landmarks today's ride is drawn from: static, so the same everywhere. */
export function dailyRideCandidates(cityId = 'amsterdam'): RoutePoi[] {
  const city = CANAL_CITIES[cityId as keyof typeof CANAL_CITIES] ?? CANAL_CITIES.amsterdam;
  return city.curatedPois.map(poi => ({ ...poi }));
}

/** Whether `?landing=0` asks for the static landing. */
export function landingCardsEnabled(search: string): boolean {
  return new URLSearchParams(search).get('landing') !== '0';
}

function safeGet(storage: ReadStore, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

export function dueMinutes(names: number): number {
  if (names <= 0) return 0;
  return Math.min(DUE_MINUTES_MAX, Math.max(DUE_MINUTES_MIN, Math.round(names * DUE_MINUTES_PER_NAME)));
}

export interface LandingModel {
  /** False: show the static landing unchanged. */
  returning: boolean;
  header: { streakDays: number; stamps: number };
  daily: {
    pair: DailyRidePair | null;
    /** Today's fastest ride of today's route, if ridden. */
    today: DailyRideDay | null;
    /** Past days, newest first, today excluded. */
    board: DailyRideDay[];
  };
  due: {
    names: number;
    minutes: number;
    /** Days until the next name falls due, when nothing is due now. */
    nextDueDays: number | null;
  };
}

/** A returning player has opened the ride, finished a ride or named something. */
export function isReturningPlayer(storage: ReadStore): boolean {
  if (safeGet(storage, RETURNING_PLAYER_KEY) === '1') return true;
  if (loadRouteHistory(storage).length) return true;
  return loadKnowledgeReview(storage).tracked > 0;
}

export function buildLandingModel(storage: ReadStore, now = Date.now(), cityId = 'amsterdam'): LandingModel {
  const candidates = dailyRideCandidates(cityId);
  const date = dailyRideDateKey(now);
  const pair = dailyRidePair(date, candidates);
  const history = loadRouteHistory(storage).filter(ride => ride.cityId === cityId);
  const days = dailyRideBoard(history, candidates, { limit: 6 });
  const today = days.find(day => day.date === date) ?? null;
  const board = days.filter(day => day.date !== date).slice(0, 5);

  const knowledge = loadKnowledgeReview(storage, now);
  const inCity = knowledge.items.filter(item => item.cityId === cityId && item.type !== 'stop');
  const due = inCity.filter(item => item.status === 'due').length;
  const upcoming = inCity.filter(item => item.status !== 'due').map(item => item.dueAt).filter(Number.isFinite);
  const nextDueAt = upcoming.length ? Math.min(...upcoming) : null;

  return {
    returning: isReturningPlayer(storage),
    header: { streakDays: readPlaceStreak(storage, now).current, stamps: stampCount(storage).earned },
    daily: { pair, today, board },
    due: {
      names: due,
      minutes: dueMinutes(due),
      nextDueDays: due === 0 && nextDueAt !== null ? Math.max(1, Math.ceil((nextDueAt - now) / 86_400_000)) : null,
    },
  };
}
