// The aerial predicate (lane R2-B, #229): ride views stay ride views; the user's S1 and S4 poses are aerial.
// Run: node --import tsx --test src/canalRecall/rendererShared/aerialView.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { eyeHeightM, farReachM, isAerialView, AERIAL_EYE_MIN_M } from './aerialView.js';
import { horizonReachM } from '../ownGround/farRing.js';

const LAT = 52.37;
test('ride views (cockpit z18.5-19 p84, chase z17-18 p60) are not aerial; S1 and S4 are', () => {
  for (const [z, p] of [[19, 84], [18.5, 84], [18, 84], [18, 60], [17, 60]]) assert.equal(isAerialView(z, p, LAT), false, `z${z} p${p}`);
  assert.equal(isAerialView(17.6, 70, LAT), true);
  assert.equal(isAerialView(16.9, 74, LAT), true);
});
test('the cockpit eye is under the floor, so its horizon never asks for the far ring', () => {
  assert.ok(eyeHeightM(19, 84, LAT) < AERIAL_EYE_MIN_M);
  assert.ok(farReachM(18.5, 84, LAT) > 1400); // it would, without the floor
  assert.equal(horizonReachM(300, 18.5, 84, LAT), 300);
  assert.ok(horizonReachM(300, 17.6, 70, LAT) > 3000);
  // A top edge under 86°: the reach is the plain view reach (the old ring).
  assert.equal(horizonReachM(388, 18, 60, LAT), Math.max(388, farReachM(18, 60, LAT)));
});
