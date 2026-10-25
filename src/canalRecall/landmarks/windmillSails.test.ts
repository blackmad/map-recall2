import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sailPoint, sailTips, sweepClearance} from './windmillSails';

const cross = {hub: [0, 25, 5] as const, radius: 13, rotationDeg: 0, lean: 0.24};

test('stock tips lie one radius from the hub in the leaning sail plane', () => {
  for (let k = 0; k < 4; k++) {
    const [x, y, z] = sailPoint(cross, k, cross.radius);
    const yv = y - cross.hub[1];
    assert.ok(Math.abs(Math.hypot(x - cross.hub[0], yv) - cross.radius) < 1e-9);
    assert.ok(Math.abs(z - (cross.hub[2] - yv * cross.lean)) < 1e-9);
  }
});

test('rotation 0 puts sail 0 straight up and sail 2 straight down', () => {
  assert.deepEqual(sailPoint(cross, 0, 13).map(v => +v.toFixed(9)), [0, 38, +(5 - 13 * 0.24).toFixed(9)]);
  assert.deepEqual(sailPoint(cross, 2, 13).map(v => +v.toFixed(9)), [0, 12, +(5 + 13 * 0.24).toFixed(9)]);
});

test('the lattice sits on the trailing side, perpendicular to the stock', () => {
  const tip = sailPoint(cross, 0, 13), lat = sailPoint(cross, 0, 13, 1.5);
  assert.ok(Math.abs(lat[0] - tip[0] - 1.5) < 1e-9 && Math.abs(lat[1] - tip[1]) < 1e-9);
  assert.equal(sailTips(cross, 1.5).length, 8);
});

test('sweep clearance: lowest point and how far forward of the axis it passes', () => {
  const c = sweepClearance(cross);
  assert.equal(c.lowest, 12);
  assert.ok(Math.abs(c.forward - (5 + 13 * 0.24)) < 1e-9);
});
