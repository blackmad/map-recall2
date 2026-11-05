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

test('landmark reach: 2000 m desktop, 1000 m touch, ?landmarkReach=0 is off, N sets it (floor 200)', async () => {
  const { landmarkReachM } = await import('./landmarkResidency');
  assert.equal(landmarkReachM('', false), 2000);
  assert.equal(landmarkReachM('?ride=free', true), 1000);
  assert.equal(landmarkReachM('?landmarkReach=0', false), Infinity);
  assert.equal(landmarkReachM('?engine=own&landmarkReach=1500', true), 1500);
  assert.equal(landmarkReachM('?landmarkReach=50', false), 200);
});

test('within reach: metres from the view centre, less the model radius; off reaches everything', async () => {
  const { withinReach, anchorDistanceM } = await import('./landmarkResidency');
  const dam = { lng: 4.8926, lat: 52.3731 };
  // The Rijksmuseum is ~1.9 km from the Dam, the Zuidas rails ~4 km.
  const rijks: [number, number] = [4.8852, 52.3600], zuidas: [number, number] = [4.8775, 52.3385];
  assert.ok(Math.abs(anchorDistanceM(rijks, dam) - 1530) < 120, String(anchorDistanceM(rijks, dam)));
  assert.equal(withinReach(rijks, dam, 2000), true);
  assert.equal(withinReach(zuidas, dam, 2000), false);
  assert.equal(withinReach(zuidas, dam, Infinity), true);
  assert.equal(withinReach(null, dam, 2000), true, 'an anchorless model is not the reach\'s to drop');
  assert.equal(withinReach(rijks, dam, 1500, 100), true, 'the radius counts toward reach');
});
