import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landmarkResidencyBudget, pickEvictions, type ResidentModel } from './landmarkResidency';

const model = (id: string, distanceSq: number, inView = false, evictable = true): ResidentModel => ({ id, distanceSq, inView, evictable });

test('nothing goes while within budget', () => {
  assert.deepEqual(pickEvictions([model('a', 9), model('b', 4)], { budget: 2 }), []);
});

test('furthest off-view models go first, down to budget minus slack', () => {
  const models = [model('near', 1), model('far', 100), model('mid', 50), model('farther', 200), model('view', 999, true)];
  assert.deepEqual(pickEvictions(models, { budget: 4, slack: 1 }), ['farther', 'far']);
});

test('in-view and pinned models are never evicted, even over budget', () => {
  const models = [model('v1', 500, true), model('v2', 400, true), model('pinned', 900, false, false), model('x', 1)];
  assert.deepEqual(pickEvictions(models, { budget: 1, slack: 0 }), ['x']);
});

test('budget: touch 24, desktop 72, query override with a floor', () => {
  assert.equal(landmarkResidencyBudget('', true), 24);
  assert.equal(landmarkResidencyBudget('', false), 72);
  assert.equal(landmarkResidencyBudget('?landmarkBudget=10', true), 10);
  assert.equal(landmarkResidencyBudget('?landmarkBudget=2', false), 72);
});
