import assert from 'node:assert/strict';
import test from 'node:test';
import { rateRound } from './spacedRepetition';
import { RoundResult, StreetFeature } from './types';

const feature = {
  id: 'f1', name: 'Prinsengracht', type: 'canal', cityId: 'amsterdam', center: [52.37, 4.88],
  funFact: '', clues: [], distractors: [], difficulty: 'medium',
} as StreetFeature;
const bullseye: RoundResult = {
  roundNumber: 1, feature, gameMode: 'pinpoint', userCoordinates: [52.37, 4.88],
  distanceErrorMeters: 10, accuracyPercentage: 100, pointsEarned: 5000, timeSpentMs: 4000,
};

test('unhinted fast bullseye is easy', () => {
  assert.equal(rateRound(bullseye), 'easy');
  assert.equal(rateRound({ ...bullseye, hintsUsed: 0 }), 'easy');
});

test('one hint rates at most good', () => {
  assert.equal(rateRound({ ...bullseye, hintsUsed: 1 }), 'good');
  assert.equal(rateRound({ ...bullseye, hintsUsed: 1, accuracyPercentage: 40 }), 'hard');
});

test('two or more hints rate at most hard; misses stay again', () => {
  assert.equal(rateRound({ ...bullseye, hintsUsed: 2 }), 'hard');
  assert.equal(rateRound({ ...bullseye, hintsUsed: 3, accuracyPercentage: 10 }), 'again');
});
