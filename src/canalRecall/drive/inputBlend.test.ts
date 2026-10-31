import test from 'node:test';
import assert from 'node:assert/strict';
import { blendDriveLevers, stickVector, STICK_DEAD_ZONE } from '../touchControls.ts';

test('input maps blend by max: strongest throttle/brake, largest steer keeps its sign', () => {
  const keys = { throttle: 1, brake: 0, steer: -1 };
  const stick = { throttle: 0, brake: 0.4, steer: 0.3 };
  assert.deepEqual(blendDriveLevers(keys, stick), { throttle: 1, brake: 0.4, steer: -1 });
  assert.deepEqual(blendDriveLevers(null, { throttle: 0, brake: 0, steer: 0.5 }), { throttle: 0, brake: 0, steer: 0.5 });
  assert.deepEqual(blendDriveLevers(), { throttle: 0, brake: 0, steer: 0 });
});

test('stick dead zone is radial and rescaled, so analog strength survives', () => {
  const origin = { x: 0, y: 0 };
  assert.equal(stickVector(origin, { x: STICK_DEAD_ZONE * 50 * 0.99, y: 0 }, 50), null);
  const diagonal = stickVector(origin, { x: 30, y: 30 }, 50)!;
  const raw = Math.hypot(30, 30) / 50;
  assert.ok(Math.abs(diagonal.magnitude - (raw - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE)) < 1e-9);
  assert.equal(stickVector(origin, { x: 0, y: -500 }, 50)!.magnitude, 1);
});
