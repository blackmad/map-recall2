import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { coolingDown, LANDMARK_COOLDOWN_MS, landmarkCooldownMs, landmarkResidencyBudget, pickEvictions, sphereOnScreen, type ResidentModel } from './landmarkResidency';

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

test('evictions go behind the heading first, then furthest first (desktop-perf 2026-11-27)', () => {
  const m = (id: string, d: number, behind?: boolean) => ({ id, distanceSq: d, inView: false, evictable: true, behind });
  const ids = pickEvictions([m('aheadFar', 900), m('behindNear', 10, true), m('behindFar', 400, true), m('aheadNear', 5), m('x', 1), m('y', 1)], { budget: 4, slack: 1 });
  assert.deepEqual(ids, ['behindFar', 'behindNear', 'aheadFar']);
  // Without `behind` the old order.
  assert.deepEqual(pickEvictions([m('a', 1), m('b', 9), m('c', 4)], { budget: 2, slack: 0 }), ['b']);
});

test('a model given back cools down unless it is on screen; the switch and the tuning', () => {
  assert.equal(coolingDown(1000, 1000 + LANDMARK_COOLDOWN_MS - 1, LANDMARK_COOLDOWN_MS, false), true);
  assert.equal(coolingDown(1000, 1000 + LANDMARK_COOLDOWN_MS, LANDMARK_COOLDOWN_MS, false), false);
  assert.equal(coolingDown(1000, 1001, LANDMARK_COOLDOWN_MS, true), false, 'on screen: loads at once');
  assert.equal(coolingDown(undefined, 5, LANDMARK_COOLDOWN_MS, false), false, 'never given back');
  assert.equal(coolingDown(1000, 1001, 0, false), false, 'off');
  assert.equal(landmarkCooldownMs('', undefined), LANDMARK_COOLDOWN_MS);
  assert.equal(landmarkCooldownMs('?landmarkCooldown=0', undefined), 0);
  assert.equal(landmarkCooldownMs('', false), 0);
  assert.equal(landmarkCooldownMs('?landmarkCooldownS=12', undefined), 12000);
});

test('sphereOnScreen: in front and inside the view (with its radius), not behind or off to the side', () => {
  const cam = new THREE.PerspectiveCamera(60, 1.5, 1, 5000);
  cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.updateMatrixWorld(true);
  const clip = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
  assert.equal(sphereOnScreen(clip, [0, 0, -100], 5), true);
  assert.equal(sphereOnScreen(clip, [0, 0, 100], 5), false, 'behind');
  assert.equal(sphereOnScreen(clip, [400, 0, -100], 5), false, 'far to the side');
  assert.equal(sphereOnScreen(clip, [105, 0, -100], 30), true, 'its edge reaches into the view');
});
