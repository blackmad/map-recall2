import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_TALLEST_M, DROP_LOD, RESTORE_LOD, TRIGGER_DEFAULTS, atlasAerialEnabled, chunkLodEstimate, eyeAhead, facadeLodFloor, focalPxOf, layerBands, mipLevels, runSlice, settle, stepTrigger, type TriggerState } from './atlasAerial.ts';

test('atlasAerial is off unless asked', () => {
  assert.equal(atlasAerialEnabled(''), false);
  assert.equal(atlasAerialEnabled('?atlasAerial=1'), true);
  assert.equal(atlasAerialEnabled('?atlasAerial=0'), false);
  assert.equal(atlasAerialEnabled('?atlasAerial=measure'), true);
});

test('the floor is -Infinity at or under the tallest building and rises one level per doubling of distance', () => {
  const base = { focalPx: 2700, cellPx: 256 };
  assert.equal(facadeLodFloor({ ...base, eyeM: ATLAS_TALLEST_M }), -Infinity);
  assert.equal(facadeLodFloor({ ...base, eyeM: 74 }), -Infinity); // the user's S2 Da Costakade eye
  const a = facadeLodFloor({ ...base, eyeM: ATLAS_TALLEST_M + 1000 }), b = facadeLodFloor({ ...base, eyeM: ATLAS_TALLEST_M + 2000 });
  assert.ok(Math.abs(b - a - 1) < 1e-9);
  // The SDF's negative bias lowers it; a positive bias never raises it.
  assert.ok(Math.abs(facadeLodFloor({ ...base, eyeM: 1175, lodBias: -0.6 }) - (a - 0.6)) < 1e-9);
  assert.equal(facadeLodFloor({ ...base, eyeM: 1175, lodBias: 2 }), a);
  // Half the cell size: one level lower.
  assert.ok(Math.abs(facadeLodFloor({ ...base, cellPx: 128, eyeM: 1175 }) - (a - 1)) < 1e-9);
});

test('the chunk estimate matches the floor at the same distance', () => {
  assert.ok(Math.abs(chunkLodEstimate(1000, 2700, 256, -0.6) - facadeLodFloor({ eyeM: 1000 + ATLAS_TALLEST_M, focalPx: 2700, cellPx: 256, lodBias: -0.6 })) < 1e-9);
  assert.equal(chunkLodEstimate(0, 2700, 256), -Infinity);
});

test('focal length from a perspective clip matrix', () => {
  // fovY 0.6435 rad (tan(fov/2) = 1/3): P11 = 3; an identity view. Column-major.
  const f = 3, m = [f / 1.6, 0, 0, 0, 0, f, 0, 0, 0, 0, -1.0002, -1, 0, 0, -0.2, 0];
  assert.ok(Math.abs(focalPxOf(m, 1800) - 2700) < 1e-6);
  // A rotated view (90° about x) keeps the row norms.
  const r = [f / 1.6, 0, 0, 0, 0, 0, -1.0002, -1, 0, -f, 0, 0, 0, 0, -0.2, 0];
  assert.ok(Math.abs(focalPxOf(r, 1800) - 2700) < 1e-6);
});

test('eyeAhead extrapolates descents only', () => {
  assert.equal(eyeAhead(1000, null, 16), 1000);
  assert.equal(eyeAhead(1000, 990, 16), 1000); // climbing
  assert.equal(eyeAhead(1000, 1016, 16, 1000), 0); // 1 m/ms down for 1 s
});

test('trigger: drops after calm frames, cancels a drop and restores under the restore level, with hysteresis', () => {
  const cfg = { ...TRIGGER_DEFAULTS, calmFrames: 3 };
  let s: TriggerState = { mode: 'full', calm: 0 };
  const step = (floor: number, ahead = floor) => { const r = stepTrigger(s, floor, ahead, cfg); s = r.state; return r.action; };
  assert.equal(step(DROP_LOD), null);
  assert.equal(step(DROP_LOD), null);
  assert.equal(step(DROP_LOD - 0.01), null); // resets the count
  assert.equal(s.calm, 0);
  step(DROP_LOD + 1); step(DROP_LOD + 1);
  assert.equal(step(DROP_LOD + 1), 'drop');
  assert.equal(s.mode, 'dropping');
  // Between the two levels nothing happens.
  assert.equal(step((DROP_LOD + RESTORE_LOD) / 2), null);
  assert.equal(step(RESTORE_LOD - 0.01), 'cancel-drop');
  assert.equal(s.mode, 'full');
  for (let i = 0; i < 3; i++) step(9);
  s = settle(s);
  assert.equal(s.mode, 'half');
  assert.equal(step((DROP_LOD + RESTORE_LOD) / 2), null);
  // A fast descent: the floor is fine now, the lead says it will not be.
  assert.equal(step(9, RESTORE_LOD - 0.5), 'restore');
  assert.equal(s.mode, 'restoring');
  assert.equal(step(-Infinity), null); // restoring runs to completion
  s = settle(s);
  assert.equal(s.mode, 'full');
  assert.equal(s.calm, 0);
});

test('a street pose never drops', () => {
  let s: TriggerState = { mode: 'full', calm: 0 };
  for (let i = 0; i < 1000; i++) {
    const floor = facadeLodFloor({ eyeM: 145, focalPx: 2700, cellPx: 256, lodBias: -0.6 }); // S4 eye
    s = stepTrigger(s, floor, floor).state;
  }
  assert.equal(s.mode, 'full');
});

test('layer bands cover every layer once', () => {
  assert.deepEqual(layerBands(10, 4), [[0, 4], [4, 4], [8, 2]]);
  assert.deepEqual(layerBands(3, 0), [[0, 1], [1, 1], [2, 1]]);
  const bands = layerBands(208, 8);
  assert.equal(bands.reduce((a, [, n]) => a + n, 0), 208);
  assert.equal(mipLevels(256), 9);
  assert.equal(mipLevels(128), 8);
});

test('runSlice stops at the budget and always advances', () => {
  let t = 0;
  const now = () => t;
  const done: number[] = [];
  const q = Array.from({ length: 10 }, (_, i) => () => { done.push(i); t += 1.5; });
  assert.deepEqual(runSlice(q, 4, now), { ran: 3, ms: 4.5 });
  assert.equal(q.length, 7);
  const slow = [() => { t += 50; }, () => { t += 1; }];
  assert.equal(runSlice(slow, 4, now).ran, 1);
  assert.equal(slow.length, 1);
  assert.equal(runSlice([], 4, now).ran, 0);
});
