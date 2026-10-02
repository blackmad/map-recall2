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

import { readSharedHome, scopeToHome } from '../src/mapRecall/homeScope';
const mk = (id: string, name: string, lat: number): StreetFeature => ({ ...feature, id, name, center: [lat, 4.9] });
const near = [0, 1, 2, 3].map(i => mk(`n${i}`, `Near ${i}`, 52.37 + i * 0.001));
const far = [0, 1, 2].map(i => mk(`f${i}`, `Far ${i}`, 52.37 + 0.02 + i * 0.001));
const home = { lat: 52.37, lng: 4.9 };
assert.equal(scopeToHome([...near, ...far], home, new Set(), 3).features.length, 4, 'unfamiliar ring stays tight');
const known = new Set(near.map(getFeatureKey));
assert.ok(scopeToHome([...near, ...far], home, known, 3).features.length > 4, 'ring widens once the near ones are learned');
assert.equal(readSharedHome({ getItem: k => k === 'canalRecall.preferences.v1' ? '{"homeAddress":"A 1"}' : '{"x|a 1":{"address":"A 1","lat":52.3,"lng":4.9}}' })?.lat, 52.3);
assert.equal(readSharedHome({ getItem: () => null }), null);
console.log('Home scope checks passed.');
