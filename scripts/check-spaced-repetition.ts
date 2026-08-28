import assert from 'node:assert/strict';
import { rateRound, scheduleReview, selectReviewFeatures } from '../src/spacedRepetition';
import { RoundResult, StreetFeature } from '../src/types';
import { getFeatureKey } from '../src/utils/featureIdentity';

const feature: StreetFeature = {
  id: 'extract_streets_42',
  name: 'Prinsengracht',
  type: 'canal',
  cityId: 'amsterdam',
  center: [52.374, 4.883],
  funFact: '', clues: [], distractors: [], difficulty: 'medium',
};
const result: RoundResult = {
  roundNumber: 1, feature, gameMode: 'guess_name', userSelectedName: feature.name,
  isCorrect: true, pointsEarned: 5000, timeSpentMs: 3000,
};

assert.equal(getFeatureKey(feature), getFeatureKey({ ...feature, id: 'osm_999' }), 'source IDs must not affect identity');
assert.equal(rateRound(result), 'easy');
const first = scheduleReview(result, undefined, 1_000_000);
assert.equal(first.state.intervalDays, 4);
const missed = scheduleReview({ ...result, isCorrect: false, pointsEarned: 0 }, first.state, 2_000_000);
assert.equal(missed.event.rating, 'again');
assert.ok(missed.state.dueAt < 2_000_000 + 11 * 60 * 1000);
assert.deepEqual(selectReviewFeatures([feature], [{ ...first.state, dueAt: 0 }], 'guess_name', 1), [feature]);

console.log('Spaced-repetition checks passed.');
