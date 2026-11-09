import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_RIDE_ON_LANDING,
  FREE_RIDE_COLLECTION_DEFAULT,
  FREE_RIDE_LANDMARK_QUIZ_DEFAULT,
  freeRideCollectionEnabled,
  freeRideLandmarkQuizEnabled,
  queryFlag,
} from './featureFlags';

test('F1 (user 2026-11-09): no daily ride, no gameplay in Free Ride, by default', () => {
  assert.equal(DAILY_RIDE_ON_LANDING, false);
  assert.equal(FREE_RIDE_COLLECTION_DEFAULT, false);
  assert.equal(FREE_RIDE_LANDMARK_QUIZ_DEFAULT, false);
  assert.equal(freeRideCollectionEnabled('?ride=free'), false);
  assert.equal(freeRideLandmarkQuizEnabled('?ride=free'), false);
});

test('opt-ins and opt-outs read from the query', () => {
  assert.equal(freeRideCollectionEnabled('?ride=free&collection=1'), true);
  assert.equal(freeRideCollectionEnabled('?collection=0'), false);
  assert.equal(freeRideLandmarkQuizEnabled('?freeRideQuiz=true'), true);
  assert.equal(queryFlag('?x=on', 'x', false), true);
  assert.equal(queryFlag('?x=off', 'x', true), false);
  assert.equal(queryFlag('?x=maybe', 'x', true), true);
  assert.equal(queryFlag('?xy=1', 'x', false), false);
  assert.equal(queryFlag('', 'x', false), false);
});
