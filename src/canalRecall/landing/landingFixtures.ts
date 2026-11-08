// Seeded localStorage for the landing cards (G2, #272): unit tests, Storybook
// and the Playwright spec all draw the same players. Plain data, no DOM.

import { CANAL_CITIES } from '../game/cities';
import { dailyRideDateKey, dailyRidePair } from '../game/dailyRide';
import { PASSPORT_STORAGE_KEY } from '../game/neighborhoodPassport';
import { PLACE_STREAK_STORAGE_KEY } from '../game/placeStreak';
import { REVIEW_STATES_KEY } from '../knowledgeReview';
import { createRideRecord, ROUTE_HISTORY_KEY, type RideRecord } from '../routeHistory';
import { RETURNING_PLAYER_KEY } from '../../siteLinks';

/** 10:00 UTC, 16 Nov 2026 (11:00 in Amsterdam): after the buurt pool's cutover
 *  (DAILY_POOL_CUTOVER, 10 Nov), board days included, so the cards show buurt names. */
export const LANDING_FIXTURE_NOW = Date.UTC(2026, 10, 16, 10, 0, 0);

export type LandingScenario = 'first-time' | 'opened-once' | 'returning' | 'nothing-due' | 'ridden-today';

const DAY = 86_400_000;
/** Jordaan names with their rough centres: a review ride can pass them. */
const STREETS: Array<[string, number, number]> = [
  ['Prinsengracht', 52.3735, 4.8835], ['Bloemgracht', 52.3745, 4.8810], ['Egelantiersgracht', 52.3770, 4.8830],
  ['Lauriergracht', 52.3700, 4.8795], ['Elandsgracht', 52.3690, 4.8810], ['Rozengracht', 52.3735, 4.8790],
  ['Westerstraat', 52.3780, 4.8820], ['Lindengracht', 52.3800, 4.8830], ['Palmgracht', 52.3820, 4.8845],
  ['Brouwersgracht', 52.3810, 4.8880],
];

function reviewState([name, lat, lng]: [string, number, number], dueAt: number, repetitions = 2) {
  return {
    featureKey: `amsterdam|street|${name.toLowerCase()}`,
    mode: 'guess_name',
    dueAt,
    intervalDays: 2,
    ease: 2.3,
    repetitions,
    lapses: 0,
    lastReviewedAt: dueAt - 2 * DAY,
    lastEventId: `event-${name}`,
    schedulerVersion: 1,
    featureSnapshot: { name, type: 'street', cityId: 'amsterdam', center: [lat, lng] as [number, number] },
  };
}

function dailyRide(now: number, daysAgo: number, seconds: number, named: number, asked: number): RideRecord {
  const at = now - daysAgo * DAY;
  const pois = CANAL_CITIES.amsterdam.curatedPois.map(poi => ({ ...poi }));
  const pair = dailyRidePair(dailyRideDateKey(at), pois)!;
  return createRideRecord({
    id: `fixture-daily-${daysAgo}`,
    startedAt: at - seconds * 1000,
    endedAt: at,
    from: pair.from,
    to: pair.to,
    namedCount: named,
    askedCount: asked,
    travelMode: 'car',
  });
}

/** The localStorage entries a scenario's player has. */
export function landingFixtureEntries(scenario: LandingScenario, now = LANDING_FIXTURE_NOW): Record<string, string> {
  if (scenario === 'first-time') return {};
  if (scenario === 'opened-once') return { [RETURNING_PLAYER_KEY]: '1' };
  const today = new Date(now).toISOString().slice(0, 10);
  const daysBack = (n: number) => new Date(now - n * DAY).toISOString().slice(0, 10);
  const dueCount = scenario === 'nothing-due' ? 0 : 7;
  const states: Record<string, unknown> = {};
  STREETS.forEach((street, i) => {
    const dueAt = i < dueCount ? now - (i + 1) * 3_600_000 : now + 2 * DAY - 3_600_000 + i * DAY;
    states[`state-${i}`] = reviewState(street, dueAt);
  });
  const rides: RideRecord[] = [
    dailyRide(now, 1, 612, 4, 5),
    dailyRide(now, 2, 548, 3, 5),
    dailyRide(now, 4, 701, 5, 6),
  ];
  if (scenario === 'ridden-today') rides.unshift(dailyRide(now, 0, 530, 5, 6));
  return {
    [RETURNING_PLAYER_KEY]: '1',
    [REVIEW_STATES_KEY]: JSON.stringify(states),
    [ROUTE_HISTORY_KEY]: JSON.stringify(rides),
    [PLACE_STREAK_STORAGE_KEY]: JSON.stringify({ days: [daysBack(4), daysBack(2), daysBack(1), today], current: 3, best: 3 }),
    [PASSPORT_STORAGE_KEY]: JSON.stringify({
      stamped: ['Jordaan', 'Grachtengordel-West', 'De Pijp', 'Plantage'],
    }),
  };
}

/** A read-only store over a scenario's entries. */
export function landingFixtureStorage(scenario: LandingScenario, now = LANDING_FIXTURE_NOW): Pick<Storage, 'getItem' | 'setItem'> {
  const entries = landingFixtureEntries(scenario, now);
  return {
    getItem: key => (key in entries ? entries[key]! : null),
    setItem: () => {},
  };
}
