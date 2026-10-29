import assert from 'node:assert/strict';
import test from 'node:test';
import { compileWithinBudget, precompileBudget, precompileStepDue, PRECOMPILE_STEP_MS, TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME } from './compileBudget.ts';

/** A fake renderer: each item names the program it needs; a program is linked the first time it is seen. */
function fakeRenderer() {
  const programs = new Set<string>();
  return { compile: (key: string) => { programs.add(key); }, programs: () => programs.size };
}

test('the warm-up links at most the budget per frame, and skips cached programs for free', () => {
  // The ground's shape: several layers share a program (same material key), others are new.
  const items = ['land', 'land', 'cut', 'land', 'fade', 'fadeCut', 'cut', 'water', 'quay', 'quay'];
  const r = fakeRenderer();
  const frames: number[] = [];
  let next = 0;
  while (next < items.length) {
    const before = r.programs();
    next = compileWithinBudget(items, next, 2, r.compile, r.programs);
    frames.push(r.programs() - before);
  }
  assert.deepEqual(frames, [2, 2, 2, 0], 'six programs in three frames of two (the last, cached, item costs a frame with no link)');
  assert.equal(r.programs(), 6);
});

test('an infinite budget compiles everything in one call (the desktop single burst)', () => {
  const r = fakeRenderer();
  assert.equal(compileWithinBudget(['a', 'b', 'c', 'd'], 0, Infinity, r.compile, r.programs), 4);
  assert.equal(r.programs(), 4);
});

test('each call makes progress even when every item is already cached', () => {
  const r = fakeRenderer();
  r.compile('a');
  assert.equal(compileWithinBudget(['a', 'a', 'a'], 0, 1, r.compile, r.programs), 3);
});

test('budget: touch devices warm up in small steps, desktop in one, ?precompile overrides', () => {
  // Firefox Mobile on Android matches `(pointer: coarse)` like every phone browser: the Sentry -N device
  // (517×967 drawing buffer for 414×774 CSS px at DPR 2.6) already had the 1.25 touch pixel-ratio cap.
  assert.equal(precompileBudget({ coarse: true }), TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME);
  assert.equal(precompileBudget({ coarse: false }), Infinity);
  assert.equal(precompileBudget({ coarse: true, asked: 'all' }), Infinity);
  assert.equal(precompileBudget({ coarse: true, asked: '0' }), Infinity);
  assert.equal(precompileBudget({ coarse: false, asked: '3' }), 3);
  assert.equal(precompileBudget({ coarse: true, asked: 'junk' }), TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME);
  assert.ok(TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME <= 4, 'a phone warm-up step stays small');
});

test('warm-up steps are spaced in time, not only by frame', () => {
  assert.equal(precompileStepDue(1000, null), true, 'the first step runs at once');
  assert.equal(precompileStepDue(1016, 1000), false, 'the next 60 fps frame waits');
  assert.equal(precompileStepDue(1000 + PRECOMPILE_STEP_MS, 1000), true);
  // ~21 ground programs (measured 2026-10-29) at 2 per step: about half a second, never one task.
  const steps = Math.ceil(21 / TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME);
  assert.ok(steps * PRECOMPILE_STEP_MS >= 400 && steps * PRECOMPILE_STEP_MS <= 1000);
});
