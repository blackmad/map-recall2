import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCameraFollow, pullBackZoomScale, stepCameraFollow } from './cameraFollow.ts';
import { CAMERA_FOLLOW_DEFAULTS } from '../game/preferences.ts';
import { CAMERA_YAW_DEFAULT, stepCameraYaw } from '../cameraYaw.ts';

const options = CAMERA_FOLLOW_DEFAULTS;

/** The old camera.js: world position eased 0.07 per 60 fps frame toward bike + lead. */
function legacyCentreTrail(speed: number, rate: number, frames: number): number {
  const dt = 1 / rate;
  let cx = 0, bike = 0;
  for (let i = 0; i < frames; i++) {
    bike += speed * dt;
    cx += (bike + 65 - cx) * (1 - Math.pow(1 - 0.07, dt * 60));
  }
  return cx - bike;
}

test('a bike at speed does not drag the view behind it, at any frame rate', () => {
  for (const rate of [30, 60, 120, 144]) {
    const state = initialCameraFollow();
    const bike = { x: 0, y: 0, angle: 0, speed: 351, maxSpeed: 351 };
    let centre = { x: 0, y: 0 };
    for (let i = 0; i < rate * 6; i++) {
      bike.x += bike.speed / rate;
      centre = stepCameraFollow(state, bike, 65, 0, 1 / rate, options, true);
    }
    const lead = centre.x - bike.x;
    assert.ok(Math.abs(lead - (65 + options.lookahead)) < 0.5, `${rate} Hz: lead ${lead.toFixed(1)} px`);
  }
  // The old follower sat ~80 px further back at top speed, and by a different amount per rate.
  assert.ok(legacyCentreTrail(351, 60, 600) < 65 - 70);
});

test('uneven frame times do not surge the view (the offset is the same after any split)', () => {
  const run = (dts: number[]) => {
    const state = initialCameraFollow();
    const bike = { x: 0, y: 0, angle: 0, speed: 300, maxSpeed: 351 };
    let c = { x: 0, y: 0 };
    for (const dt of dts) { bike.x += 300 * dt; c = stepCameraFollow(state, bike, 65, 0, dt, options, true); }
    return c.x - bike.x;
  };
  const even = run(Array(240).fill(1 / 60));
  const jittery = run(Array.from({ length: 240 }, (_, i) => (i % 3 === 0 ? 2 / 60 : 0.5 / 60)));
  assert.ok(Math.abs(even - jittery) < 0.5, `even ${even.toFixed(2)} vs jittery ${jittery.toFixed(2)}`);
});

test('the lead follows the view yaw, so the follow offset adds no yaw above the 80°/s cap', () => {
  // A 90° corner at 2.1 rad/s: the view turns through cameraYaw.ts and the lead
  // points along the view, so the camera's rotation is exactly the capped yaw.
  const yawState = { following: false };
  const follow = initialCameraFollow();
  let yaw = 0, heading = 0, maxRate = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 180; i++) {
    heading = Math.min(Math.PI / 2, heading + 2.1 * dt);
    const next = stepCameraYaw(yaw, heading, dt, yawState, CAMERA_YAW_DEFAULT);
    maxRate = Math.max(maxRate, Math.abs(next - yaw) / dt);
    yaw = next;
    stepCameraFollow(follow, { x: 0, y: 0, angle: heading, speed: 200, maxSpeed: 351 }, 65, yaw, dt, options, true);
    const forward = Math.atan2(follow.oy, follow.ox);
    assert.ok(Math.abs(forward - yaw) < 1e-9);
  }
  assert.ok(maxRate <= CAMERA_YAW_DEFAULT.maxRate + 1e-9, `${(maxRate * 180 / Math.PI).toFixed(1)}°/s`);
});

test('pull-back: none at rest, up to the option at top speed, eased', () => {
  const state = initialCameraFollow();
  assert.equal(pullBackZoomScale(state), 1);
  for (let i = 0; i < 600; i++) stepCameraFollow(state, { x: 0, y: 0, angle: 0, speed: 351, maxSpeed: 351 }, 65, 0, 1 / 60, options, true);
  assert.ok(Math.abs(pullBackZoomScale(state) - 1 / (1 + options.pullBack)) < 1e-3);
  const reduced = initialCameraFollow();
  for (let i = 0; i < 600; i++) stepCameraFollow(reduced, { x: 0, y: 0, angle: 0, speed: 351, maxSpeed: 351 }, 65, 0, 1 / 60, options, true, true);
  assert.equal(pullBackZoomScale(reduced), 1, 'reduced motion: no pull-back');
});
