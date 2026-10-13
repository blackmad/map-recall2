import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store, type RecallFeature } from './recallStore.ts';
import {
  EXPOSURE_FIRST_INTERVAL_MS, EXPOSURE_MAX_INTERVAL_MS, exposureIntervalMs, isExposureOnly,
} from './recallExposure.ts';
import { buildKnowledgeReview } from './knowledgeReview.ts';

const nes: RecallFeature = { name: 'Nes', type: 'street', cityId: 'amsterdam', center: [52.3708, 4.8929] };
const now = 1_800_000_000_000;

test('exposure intervals start short, double and cap at a day', () => {
  assert.equal(exposureIntervalMs(0), EXPOSURE_FIRST_INTERVAL_MS);
  assert.equal(exposureIntervalMs(1), 2 * EXPOSURE_FIRST_INTERVAL_MS);
  assert.equal(exposureIntervalMs(20), EXPOSURE_MAX_INTERVAL_MS);
});

test('an exposed unknown name is parked briefly, as exposure and not recall', () => {
  const state = store.expose(nes, now);
  assert.equal(state.repetitions, 0, 'no recall counted');
  assert.equal(state.lapses, 0, 'and no miss');
  assert.equal(state.exposures, 1);
  assert.equal(state.dueAt, now + EXPOSURE_FIRST_INTERVAL_MS);
  assert.ok(isExposureOnly(state));
  assert.equal(store.isSuppressedHere(nes, now + 60_000), true, 'not asked again straight away');
  assert.equal(store.isKnownHere(nes, now + 60_000), false, 'and not known');
  assert.equal(store.isSuppressedHere(nes, now + EXPOSURE_FIRST_INTERVAL_MS + 1), false, 'asked again once the interval has passed');
  assert.deepEqual(store.dueReviews(now + 10 * EXPOSURE_FIRST_INTERVAL_MS), [], 'never a due review');
});

test('exposing the same name again spaces it out', () => {
  const second = store.expose(nes, now + 2 * EXPOSURE_FIRST_INTERVAL_MS);
  assert.equal(second.exposures, 2);
  assert.equal(second.dueAt, now + 2 * EXPOSURE_FIRST_INTERVAL_MS + 2 * EXPOSURE_FIRST_INTERVAL_MS);
});

test('exposure-only states are not listed as knowledge', () => {
  const states = [store.expose({ ...nes, name: 'Zoutsteeg' }, now)];
  assert.deepEqual(buildKnowledgeReview(states, [], now).items, []);
});

test('a name the rider already knows keeps its schedule', () => {
  const known: RecallFeature = { name: 'Rokin', type: 'street', cityId: 'amsterdam', center: [52.3680, 4.8920] };
  const recorded = store.record(known, true, 3000);
  const after = store.expose(known, Date.now());
  assert.equal(after, recorded, 'the stored state is returned unchanged');
  assert.equal(after.repetitions, 1);
  assert.equal(after.exposures, undefined);
});

test('a lapsed name keeps its lapse count when exposed', () => {
  const missed: RecallFeature = { name: 'Damrak', type: 'street', cityId: 'amsterdam', center: [52.3770, 4.8980] };
  const recorded = store.record(missed, false, 3000);
  assert.equal(recorded.lapses, 1);
  const after = store.expose(missed, Date.now());
  assert.equal(after.lapses, 1);
  assert.equal(after.repetitions, 0);
  assert.equal(after.exposures, 1);
  assert.ok(!isExposureOnly(after), 'it was graded once, so it stays knowledge');
  assert.ok(after.dueAt >= recorded.dueAt, 'exposure never pulls a review date earlier');
});
