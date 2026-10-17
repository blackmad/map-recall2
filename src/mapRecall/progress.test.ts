import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoundResult, StreetFeature } from '../types';
import { scheduleReview, type ReviewEvent, type ReviewState } from '../spacedRepetition';
import { getFeatureKey } from '../utils/featureIdentity';
import {
  dueCount, earnedAreas, earnedAreaKeys, eventsAsOf, formatReviewDay, knownCount, newlyEarned, postcardProgress, progressLine, sessionGroups,
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

// ---- Postcards: a store built by the real scheduler, as Map Quest and the ride write it ----

const HOUR = 3_600_000;
const MIN = 60_000;

/** A review store fed through scheduleReview, like progressRepository.recordReview / recallStore.record. */
function store() {
  const states = new Map<string, ReviewState>();
  const events: ReviewEvent[] = [];
  const answer = (result: RoundResult, at: number) => {
    const key = `${getFeatureKey(result.feature)}_${result.gameMode}`;
    const scheduled = scheduleReview(result, states.get(key), at);
    states.set(key, scheduled.state);
    events.push(scheduled.event);
    return result;
  };
  return {
    answer,
    /** A Pinpoint `distance` metres from the area (0 = inside). */
    pin: (f: StreetFeature, at: number, distance = 0, hintsUsed = 0) => answer({
      roundNumber: 1, feature: f, gameMode: 'pinpoint', userCoordinates: f.center, distanceErrorMeters: distance,
      accuracyPercentage: distance <= 30 ? 100 : Math.round(100 * Math.exp(-distance / 1500)),
      pointsEarned: 4000, timeSpentMs: 15_000, hintsUsed,
    }, at),
    /** A four-choice Guess Name answer. */
    name: (f: StreetFeature, at: number, correct = true) => answer({
      roundNumber: 1, feature: f, gameMode: 'guess_name', userSelectedName: correct ? f.name : 'Elsewhere', isCorrect: correct,
      pointsEarned: correct ? 1000 : 0, timeSpentMs: 8_000,
    }, at),
    get states() { return [...states.values()]; },
    get events() { return [...events]; },
  };
}

const DAY1 = new Date(2026, 9, 13, 19, 0).getTime();
const DAY2 = new Date(2026, 9, 14, 19, 0).getTime();
const DAY3 = new Date(2026, 9, 16, 19, 0).getTime();
const earnedNames = (s: { states: ReviewState[]; events: ReviewEvent[] }) => earnedAreas(s.states, s.events).map((a) => a.name);

test('postcards: one good first session earns none, the next day earns the areas recalled again', () => {
  const hoods = Array.from({ length: 20 }, (_, i) => feature(`Buurt ${i}`, 'neighborhood', [52.3 + i * 0.01, 4.9]));
  const s = store();
  // The old rule handed out a card per correct answer: 10 in this one sitting.
  hoods.slice(0, 10).forEach((h, i) => s.pin(h, DAY1 + i * MIN, i % 2 ? 0 : 180));
  assert.deepEqual(earnedNames(s), []);
  assert.equal(postcardProgress(s.states, s.events).length, 10, 'all ten are on the way');
  // Play again straight away: ten new areas, still nothing.
  hoods.slice(10, 20).forEach((h, i) => s.pin(h, DAY1 + 15 * MIN + i * MIN, 0));
  assert.deepEqual(earnedNames(s), []);
  // Next day: the three due areas come back and are recalled.
  [0, 1, 2].forEach((i) => s.pin(hoods[i], DAY2 + i * MIN, 100));
  assert.deepEqual(earnedNames(s).sort(), ['Buurt 0', 'Buurt 1', 'Buurt 2']);
});

test('postcards: a precise pin and a recall in a later session earn the same day; the same session does not', () => {
  const a = feature('Jordaan'); const b = feature('De Pijp', 'neighborhood', [52.35, 4.89]);
  const s = store();
  s.pin(a, DAY1, 0); // inside the area
  s.name(a, DAY1 + 5 * MIN); // same sitting: too soon
  assert.deepEqual(earnedNames(s), []);
  s.name(a, DAY1 + 45 * MIN);
  assert.deepEqual(earnedNames(s), ['Jordaan']);
  assert.equal(earnedAreas(s.states, s.events)[0].earnedAt, DAY1 + 45 * MIN);
  // A loose pin (180 m out) is a recall but not precise: it needs another day.
  s.pin(b, DAY1, 180);
  s.pin(b, DAY1 + 2 * HOUR, 180);
  assert.deepEqual(earnedNames(s), ['Jordaan']);
  const pijp = postcardProgress(s.states, s.events).find((area) => area.name === 'De Pijp')!;
  assert.equal(pijp.earned, false);
  assert.equal(pijp.hint, '1 of 2 days');
});

test('postcards: multiple choice alone needs three days, or a pin on a second day', () => {
  const a = feature('Plantage'); const b = feature('Oud-Zuid', 'neighborhood', [52.35, 4.87]);
  const s = store();
  s.name(a, DAY1); s.name(b, DAY1);
  assert.equal(postcardProgress(s.states, s.events).find((x) => x.name === 'Plantage')!.hint, '1 of 2 days · pin it once');
  s.name(a, DAY2);
  assert.deepEqual(earnedNames(s), []);
  assert.equal(postcardProgress(s.states, s.events).find((x) => x.name === 'Plantage')!.hint, '2 of 3 days · or pin it');
  s.name(a, DAY3);
  s.pin(b, DAY2, 40);
  assert.deepEqual(earnedNames(s).sort(), ['Oud-Zuid', 'Plantage']);
});

test('postcards: misses, skips, far pins and two-hint pins are not recalls; a later miss keeps the card', () => {
  const a = feature('Betondorp'); const far = feature('Overhoeks', 'neighborhood', [52.38, 4.9]); const hinted = feature('Westerpark', 'neighborhood', [52.38, 4.87]);
  const s = store();
  s.name(a, DAY1, false);
  s.answer({ roundNumber: 1, feature: a, gameMode: 'pinpoint', pointsEarned: 0, timeSpentMs: 3_000 }, DAY1 + MIN); // skipped
  assert.equal(postcardProgress(s.states, s.events).length, 0);
  s.pin(far, DAY1, 450); s.pin(far, DAY2, 450); // "good" by accuracy, but 450 m outside the area
  s.pin(hinted, DAY1, 0, 2); s.pin(hinted, DAY2, 0, 2); // two hints: rated hard
  assert.deepEqual(earnedNames(s), []);
  s.pin(a, DAY1 + 2 * MIN, 0); s.pin(a, DAY2, 0);
  assert.deepEqual(earnedNames(s), ['Betondorp']);
  s.pin(a, DAY3, 3000); // lapse
  assert.deepEqual(earnedNames(s), ['Betondorp']);
});

test('postcards: ride states count only for a correct answer about the neighbourhood, never for passing through', () => {
  const hood = feature('Kinkerbuurt'); const street = feature('Kinkerstraat', 'street');
  const s = store();
  // A riding name that was shown but not asked: recallExposure writes a state with no event and no repetition.
  const exposed: ReviewState = {
    ...state(hood, { mode: 'guess_name', repetitions: 0, lapses: 0, intervalDays: 0.01 }), exposures: 3, lastExposedAt: DAY1,
  };
  // Every street ridden and answered in the buurt: not the buurt.
  s.name(street, DAY1); s.name(street, DAY2); s.name(street, DAY3);
  assert.equal(postcardProgress([exposed, ...s.states], s.events).length, 0);
  // A correct answer about the buurt itself (recallStore.record: guess_name, 4-choice) is weak evidence.
  s.name(hood, DAY1); s.name(hood, DAY2);
  assert.deepEqual(earnedNames(s), []);
  s.name(hood, DAY3);
  assert.deepEqual(earnedNames(s), ['Kinkerbuurt']);
});

test('postcards: states without their event log (another device) need three good answers in a row', () => {
  const a = feature('Jordaan'); const b = feature('Dapperbuurt', 'neighborhood', [52.36, 4.93]); const c = feature('Lost', 'neighborhood', [52.4, 4.8]);
  const states = [
    state(a, { repetitions: 3, lastReviewedAt: NOW - 2 * DAY }),
    state(a, { mode: 'guess_name', repetitions: 1, lastReviewedAt: NOW - DAY }),
    state(b, { repetitions: 2, lastReviewedAt: NOW - DAY }),
    state(c, { repetitions: 0, lapses: 1 }),
    state(feature('Damrak', 'street'), { repetitions: 5 }),
  ];
  const all = postcardProgress(states, []);
  assert.deepEqual(all.map((x) => [x.name, x.earned]), [['Jordaan', true], ['Dapperbuurt', false]]);
  assert.equal(all[0].earnedAt, NOW - 2 * DAY);
  assert.equal(earnedAreas(states, [], 'utrecht').length, 0);
  assert.ok(earnedAreaKeys(states, []).has(getFeatureKey(a)));
});

test('newlyEarned fires only for areas this session completed, matched by name, best first', () => {
  const old = feature('Old'); const a = feature('A', 'neighborhood', [52.31, 4.9]); const b = feature('B', 'neighborhood', [52.32, 4.9]);
  const first = feature('First', 'neighborhood', [52.33, 4.9]); const street = feature('Street', 'street');
  const s = store();
  s.pin(old, DAY1); s.pin(old, DAY2 - 3 * HOUR);
  s.pin(a, DAY1, 100); s.pin(b, DAY1, 0);
  const before = s.states;
  const results = [
    s.pin(old, DAY2), s.pin(a, DAY2 + MIN, 100), s.pin(b, DAY2 + 2 * MIN, 0), s.pin(first, DAY2 + 3 * MIN, 0), s.pin(street, DAY2 + 4 * MIN, 0),
  ];
  results[2] = { ...results[2], pointsEarned: 4900 };
  // Old was earned before; First is only on its way; Street is not an area.
  assert.deepEqual(newlyEarned(results, before, s.states, s.events).map((r) => r.feature.name), ['B', 'A']);
  // The same area keyed from another centre is still the one card.
  const moved = { ...old, center: [52.0, 4.0] } as StreetFeature;
  assert.deepEqual(newlyEarned([{ ...results[0], feature: moved }], before, s.states, s.events), []);
  assert.deepEqual(eventsAsOf(s.events, before).length, 4);
});

test('formatDaysAgo counts calendar days', async () => {
  const { formatDaysAgo } = await import('./progress');
  assert.equal(formatDaysAgo(NOW - 60_000, NOW), 'today');
  assert.equal(formatDaysAgo(new Date(2026, 9, 12, 23, 50).getTime(), new Date(2026, 9, 13, 0, 10).getTime()), 'yesterday');
  assert.equal(formatDaysAgo(NOW - 3 * DAY, NOW), '3 days ago');
  assert.equal(formatDaysAgo(NOW - 21 * DAY, NOW), '3 weeks ago');
  assert.equal(formatDaysAgo(NOW - 90 * DAY, NOW), '3 months ago');
  assert.equal(formatDaysAgo(NOW - 400 * DAY, NOW), 'a year ago');
});

test('seenBeforeLabel: missed before, known after two reviews, nothing for a first sight', async () => {
  const { seenBeforeLabel } = await import('./progress');
  const a = feature('Jordaan');
  assert.equal(seenBeforeLabel([], a, 'pinpoint', NOW), null);
  assert.equal(seenBeforeLabel([state(a, { lastReviewedAt: NOW - 3 * DAY, lapses: 1, repetitions: 0 })], a, 'pinpoint', NOW), 'Seen 3 days ago · missed before');
  assert.equal(seenBeforeLabel([state(a, { lastReviewedAt: NOW - 3 * DAY, repetitions: 2 })], a, 'pinpoint', NOW), 'Seen 3 days ago · known · 2 reviews');
  assert.equal(seenBeforeLabel([state(a, { lastReviewedAt: NOW - DAY })], a, 'pinpoint', NOW), 'Seen yesterday');
  // Other mode does not count.
  assert.equal(seenBeforeLabel([state(a)], a, 'guess_name', NOW), null);
});
