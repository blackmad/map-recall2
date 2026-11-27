import test from 'node:test';
import assert from 'node:assert/strict';
import {voussoirFan} from './voussoirFan';

test('voussoirFan: symmetric rays radiating from the centre, long and short alternating from a long keystone', () => {
  const rays = voussoirFan({cy: 5, r0: 1, r1: 1.8, count: 7, halfAngle: 0.9, width: 0.12});
  assert.equal(rays.length, 7);
  assert.deepEqual(rays.map(r => r.long), [false, true, false, true, false, true, false]);
  const key = rays[3];
  assert.ok(Math.abs(key.t) < 1e-9 && Math.abs(key.angle) < 1e-9);
  assert.ok(Math.abs(key.y - (5 + 1.4)) < 1e-9, 'long ray centred half way between r0 and r1');
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(rays[i].t + rays[6 - i].t) < 1e-9, 'mirror in t');
    assert.ok(Math.abs(rays[i].y - rays[6 - i].y) < 1e-9, 'mirror in y');
  }
  // every ray points at the centre: its centre lies on the line from (0, cy) at its angle
  for (const r of rays) assert.ok(Math.abs(Math.atan2(r.t, r.y - 5) - r.angle) < 1e-9);
  assert.ok(Math.abs(rays[2].length - 0.8 * 0.6) < 1e-9);
});

test('voussoirFan: even counts keep the two middle rays long; bad input throws', () => {
  const rays = voussoirFan({cy: 0, r0: 0.5, r1: 1, count: 6, halfAngle: 0.7, width: 0.1});
  assert.equal(rays[2].long, true);
  assert.equal(rays[3].long, true);
  assert.throws(() => voussoirFan({cy: 0, r0: 1, r1: 1, count: 5, halfAngle: 0.5, width: 0.1}));
  assert.throws(() => voussoirFan({cy: 0, r0: 0, r1: 1, count: 1, halfAngle: 0.5, width: 0.1}));
});
