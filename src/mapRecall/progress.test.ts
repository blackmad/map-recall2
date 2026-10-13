import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoundResult, StreetFeature } from '../types';
import type { ReviewState } from '../spacedRepetition';
import { getFeatureKey } from '../utils/featureIdentity';
import {
  dueCount, earnedAreas, earnedAreaKeys, formatReviewDay, knownCount, newlyEarned, progressLine, sessionGroups,
} from './progress';

const NOW = new Date(2026, 9, 13, 15, 0).getTime(); // Tue 13 Oct 2026, local
const DAY = 86_400_000;

const feature = (name: string, type: StreetFeature['type'] = 'neighborhood', center: [number, number] = [52.37, 4.9]): StreetFeature => ({
  id: name, name, type, cityId: 'amsterdam', center, difficulty: 'medium', clues: [], distractors: [],
} as unknown as StreetFeature);

const state = (f: StreetFeature, over: Partial<ReviewState> = {}): ReviewState => ({
  featureKey: getFeatureKey(f), mode: 'pinpoint', dueAt: NOW + DAY, intervalDays: 1, ease: 2.3, repetitions: 1, lapses: 0,
  lastReviewedAt: NOW - DAY, lastEventId: 'e', schedulerVersion: 1,
  featureSnapshot: { name: f.name, type: f.type, cityId: f.cityId, center: f.center }, ...over,
});

const pin = (f: StreetFeature, accuracy: number, points: number): RoundResult => ({
  roundNumber: 1, feature: f, gameMode: 'pinpoint', userCoordinates: f.center, distanceErrorMeters: 100,
  accuracyPercentage: accuracy, pointsEarned: points, timeSpentMs: 20_000,
});

test('dueCount and knownCount respect mode, due time and repetitions', () => {
  const a = feature('A'); const b = feature('B'); const c = feature('C');
  const states = [
    state(a, { dueAt: NOW - 1 }),
    state(b, { dueAt: NOW + DAY, repetitions: 0 }),
    state(c, { dueAt: NOW - 1, mode: 'guess_name' }),
  ];
  assert.equal(dueCount(states, 'pinpoint', NOW), 1);
  assert.equal(dueCount(states, 'guess_name', NOW), 1);
  assert.equal(knownCount(states, 'pinpoint'), 1);
  assert.equal(knownCount(states, 'guess_name'), 1);
  assert.equal(dueCount(states, 'pinpoint', NOW, 'utrecht'), 0);
  assert.equal(progressLine(states, 'pinpoint', NOW), 'Due today 1 · Known 1');
  assert.equal(progressLine([], 'pinpoint', NOW), 'Nothing due · 0 known yet — start with canals');
});

test('formatReviewDay says today, tomorrow or a short date', () => {
  assert.equal(formatReviewDay(NOW + 10 * 60_000, NOW), 'today');
  assert.equal(formatReviewDay(NOW - DAY, NOW), 'today');
  assert.equal(formatReviewDay(new Date(2026, 9, 14, 9).getTime(), NOW), 'tomorrow');
  assert.equal(formatReviewDay(new Date(2026, 9, 16, 9).getTime(), NOW), 'Fri 16 Oct');
});

test('sessionGroups sorts answers into known, shaky and fresh with next review days', () => {
  const known = feature('Known'); const shaky = feature('Shaky'); const fresh = feature('Fresh'); const lapsed = feature('Lapsed');
  const before = [state(known), state(shaky), state(lapsed, { repetitions: 0, lapses: 1 })];
  const after = [
    state(known, { dueAt: new Date(2026, 9, 16, 9).getTime(), repetitions: 2 }),
    state(shaky, { dueAt: NOW + 600_000, repetitions: 0 }),
    state(fresh, { dueAt: new Date(2026, 9, 14, 15).getTime() }),
  ];
  const groups = sessionGroups([pin(known, 90, 4000), pin(shaky, 10, 100), pin(fresh, 80, 3000), pin(lapsed, 75, 2500)], before, after, NOW);
  assert.deepEqual(groups.known.map((i) => [i.name, i.nextReview]), [['Known', 'Fri 16 Oct']]);
  assert.deepEqual(groups.shaky.map((i) => [i.name, i.rating, i.nextReview]), [['Shaky', 'again', 'today']]);
  // Lapsed is missing from statesAfter: rescheduled from statesBefore ("good" on a 1-day interval: 2.3 days).
  assert.deepEqual(groups.fresh.map((i) => [i.name, i.nextReview]), [['Fresh', 'tomorrow'], ['Lapsed', 'Thu 15 Oct']]);
  assert.equal(groups.fresh[0].type, 'neighborhood');
});

test('earnedAreas keeps neighbourhoods with any mode known, deduplicated, newest first', () => {
  const jordaan = feature('Jordaan'); const pijp = feature('De Pijp'); const street = feature('Damrak', 'street'); const lost = feature('Lost');
  const states = [
    state(jordaan, { lastReviewedAt: NOW - 3 * DAY }),
    state(jordaan, { mode: 'guess_name', lastReviewedAt: NOW - DAY }),
    state(pijp, { lastReviewedAt: NOW - 2 * DAY, mode: 'guess_name' }),
    state(street),
    state(lost, { repetitions: 0 }),
  ];
  assert.deepEqual(earnedAreas(states).map((a) => a.name), ['Jordaan', 'De Pijp']);
  assert.equal(earnedAreas(states, 'utrecht').length, 0);
  const keys = earnedAreaKeys(states);
  assert.ok(keys.has(getFeatureKey(pijp)));
});

test('newlyEarned lists neighbourhoods answered well this session that were not earned before, best first', () => {
  const old = feature('Old'); const a = feature('A'); const b = feature('B'); const miss = feature('Miss'); const street = feature('Street', 'street');
  // Same area keyed from a different centre still counts as earned (matched by name).
  const before = [state({ ...old, center: [52.0, 4.0] } as StreetFeature)];
  const results = [pin(old, 90, 4500), pin(a, 75, 2000), pin(b, 96, 4900), pin(miss, 10, 50), pin(street, 99, 5000), pin(a, 80, 2200)];
  assert.deepEqual(newlyEarned(results, before).map((r) => [r.feature.name, r.pointsEarned]), [['B', 4900], ['A', 2200]]);
});
