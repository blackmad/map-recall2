// Display-rate agreement (lane E, brief lane-driving-feel-20261029.md step 2):
// the same scripted inputs at 30, 60, 120 and 144 Hz must drive the same path.
// Tolerances follow slop-newyork's tests/controllers.test.cjs:382 in metres
// (3 px per metre): 10 cm of position, 0.01 rad of heading, 0.05 m/s of speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advance, bicycleYawLimit, bikeLean, BIKE, BIKE_TRUE_SCALE, initialSteerState, LEGACY_BASE, legacyYawLimit, step,
  STEP_MAX, type SteerInput, type SteerParams, type SteerState,
} from './steerModel.ts';

const PX_PER_M = 3;
const POSITION_TOLERANCE = 0.1 * PX_PER_M;
const HEADING_TOLERANCE = 0.01;
const SPEED_TOLERANCE = 0.05 * PX_PER_M;
const RATES = [30, 60, 120, 144];

type Script = (t: number) => Partial<SteerInput>;
const input = (partial: Partial<SteerInput>): SteerInput => ({
  throttle: 0, brake: 0, steer: 0, handbrake: false, surfaceGrip: 1, surfaceDrag: 0, ...partial,
});

/** Inputs change on 1/6 s boundaries, which every tested rate's frames hit,
 *  so the rates differ only in how the model integrates, not in when the
 *  game sampled the keys. */
const scripts: Record<string, { seconds: number; script: Script; start?: Partial<SteerState> }> = {
  straight: { seconds: 4, script: () => ({ throttle: 1 }) },
  'corner 90°': {
    seconds: 4,
    script: t => (t < 1.5 ? { throttle: 1 } : t < 2.5 ? { throttle: 0.6, steer: 1 } : { throttle: 1 }),
  },
  'brake into a corner': {
    seconds: 3.5,
    start: { speed: 330, vx: 330 },
    script: t => (t < 0.5 ? { throttle: 1 } : t < 1.5 ? { brake: 1, steer: -1 } : { throttle: 0.7, steer: -0.4 }),
  },
  'pivot from rest': { seconds: 2, script: t => (t < 1 ? { steer: 1 } : { steer: 1, throttle: 1 }) },
  'lift off and weave': {
    seconds: 4,
    script: t => (t < 1 ? { throttle: 1 } : t < 2 ? { steer: Math.floor(t * 6) % 2 ? 1 : -1 } : { throttle: 1, steer: 0.5 }),
  },
};

function ride(params: SteerParams, rate: number, seconds: number, script: Script, start: Partial<SteerState> = {}) {
  const state = Object.assign(initialSteerState(), start);
  const frames = Math.round(seconds * rate);
  for (let i = 0; i < frames; i++) advance(state, input(script(i / rate)), 1 / rate, params);
  return state;
}

for (const [name, params] of [['bike', BIKE], ['boat', { ...LEGACY_BASE, turnRate: LEGACY_BASE.turnRate * 1.18, reverseTurnMult: 1.18 }]] as const) {
  for (const [label, { seconds, script, start }] of Object.entries(scripts)) {
    test(`${name}: ${label} agrees at ${RATES.join('/')} Hz`, () => {
      const runs = RATES.map(rate => ride(params, rate, seconds, script, start));
      const ref = runs[RATES.indexOf(120)];
      for (let i = 0; i < RATES.length; i++) {
        const run = runs[i];
        const dp = Math.hypot(run.x - ref.x, run.y - ref.y);
        const da = Math.abs(Math.atan2(Math.sin(run.angle - ref.angle), Math.cos(run.angle - ref.angle)));
        const dv = Math.abs(run.speed - ref.speed);
        if (process.env.STEER_REPORT) {
          console.log(`${name} ${label} ${RATES[i]} Hz: Δpos ${(dp / PX_PER_M * 100).toFixed(2)} cm, Δheading ${da.toFixed(5)} rad, Δspeed ${(dv / PX_PER_M).toFixed(4)} m/s`);
        }
        assert.ok(dp <= POSITION_TOLERANCE, `${RATES[i]} Hz position off by ${(dp / PX_PER_M * 100).toFixed(1)} cm`);
        assert.ok(da <= HEADING_TOLERANCE, `${RATES[i]} Hz heading off by ${da.toFixed(4)} rad`);
        assert.ok(dv <= SPEED_TOLERANCE, `${RATES[i]} Hz speed off by ${(dv / PX_PER_M).toFixed(3)} m/s`);
      }
    });
  }
}

test('the 90° corner really turns and the straight really goes', () => {
  const straight = ride(BIKE, 60, 4, scripts.straight.script);
  assert.ok(straight.x > 600 && Math.abs(straight.y) < 1e-6, `straight ends at ${straight.x.toFixed(0)}, ${straight.y.toFixed(2)}`);
  const corner = ride(BIKE, 60, 4, scripts['corner 90°'].script);
  assert.ok(corner.angle > 1.2, `the corner turns ${(corner.angle * 180 / Math.PI).toFixed(0)}°`);
});

test('frame-host contract: step(dtFixed) N times equals advance over the frame', () => {
  const a = initialSteerState();
  const b = initialSteerState();
  const held = input({ throttle: 1, steer: 0.5 });
  for (let frame = 0; frame < 60; frame++) {
    advance(a, held, 1 / 30, BIKE);
    for (let k = 0; k < 4; k++) step(b, held, STEP_MAX, BIKE);
  }
  assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.angle - b.angle) < 1e-9);
});

test('bicycle lock: full at a standstill, lateral acceleration capped at speed', () => {
  // Standstill keeps the toy pivot floor (a rider nosed into a kerb turns away).
  assert.equal(bicycleYawLimit(BIKE, 0, 0), BIKE.restYawRate);
  // Parking speed: the 2.1 rad/s cap, as before.
  assert.equal(bicycleYawLimit(BIKE, 80, 0), BIKE.turnRate);
  // At speed, v·ω never exceeds the cornering limit.
  for (const v of [250, 300, 351]) {
    const omega = bicycleYawLimit(BIKE, v, 0);
    assert.ok(v * omega <= BIKE.cornering + 1e-6, `${v} px/s: ${(v * omega).toFixed(0)} px/s²`);
  }
  // Top speed lands near the legacy curve (1.47 rad/s): the envelope is kept.
  const legacyTop = legacyYawLimit({ ...BIKE, steering: 'legacy' }, BIKE.maxSpeed);
  assert.ok(Math.abs(bicycleYawLimit(BIKE, BIKE.maxSpeed, 0) - legacyTop) < 0.1);
  // Braking hard into a corner takes grip from the turn (friction circle).
  assert.ok(bicycleYawLimit(BIKE, 300, -BIKE.brakeForce) < bicycleYawLimit(BIKE, 300, 0));
  // True scale: lateral acceleration 4.5 m/s² at 7.5 m/s.
  const omega = bicycleYawLimit(BIKE_TRUE_SCALE, BIKE_TRUE_SCALE.maxSpeed, 0);
  assert.ok(Math.abs(omega * BIKE_TRUE_SCALE.maxSpeed - 4.5 * PX_PER_M) < 1e-6);
});

test('legacy curve matches car.js before the model (60 fps frame)', () => {
  // The old per-frame code at 60 fps, one frame from 100 px/s with steer 1.
  const params = { ...LEGACY_BASE };
  const old = { speed: 100, angle: 0 };
  const dt = 1 / 60;
  const fwd = params.accel - old.speed * old.speed * params.drag - params.rollingResist;
  old.speed += fwd * dt;
  const speedFactor = Math.min(1, Math.max(params.minSteerFactor, old.speed / params.speedFactorDivisor));
  old.angle += params.turnRate * (1 - old.speed / params.maxSpeed * params.turnReductionAtSpeed) * speedFactor * dt;
  const next = advance(Object.assign(initialSteerState(), { speed: 100, vx: 100 }), input({ throttle: 1, steer: 1 }), dt, params);
  assert.ok(Math.abs(next.speed - old.speed) < 0.05, `${next.speed} vs ${old.speed}`);
  assert.ok(Math.abs(next.angle - old.angle) < 1e-3, `${next.angle} vs ${old.angle}`);
});

test('lean: none at rest, slop\'s 0.34 rad at full steer and speed', () => {
  assert.equal(bikeLean(1, 0), 0);
  assert.equal(bikeLean(-1, 300), -0.34);
  assert.ok(Math.abs(bikeLean(0.5, 13.5) - 0.085) < 1e-9);
});
