import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_DWELL_MS, levelDwellMs, levelSwapDue } from './levelDwell';

test('upgrades go at once; downgrades wait for the dwell', () => {
  assert.equal(levelSwapDue('lod1', 'full', 1000, 1001), true);
  assert.equal(levelSwapDue('lod2', 'lod1', 1000, 1001), true);
  assert.equal(levelSwapDue('full', 'lod1', 1000, 1000 + LEVEL_DWELL_MS - 1), false);
  assert.equal(levelSwapDue('full', 'lod1', 1000, 1000 + LEVEL_DWELL_MS), true);
  assert.equal(levelSwapDue('lod1', 'lod2', 1000, 1500, 0), true, 'dwell 0: off');
  assert.equal(levelSwapDue('full', 'lod2', undefined, 5), true, 'never swapped: no wait');
  assert.equal(levelSwapDue('full', 'full', 0, 1e9), false);
});

test('levelDwellMs: default, off, tuned', () => {
  assert.equal(levelDwellMs('', undefined), LEVEL_DWELL_MS);
  assert.equal(levelDwellMs('?levelDwell=0', undefined), 0);
  assert.equal(levelDwellMs('', false), 0);
  assert.equal(levelDwellMs('?a=1&levelDwellMs=1500', undefined), 1500);
});
