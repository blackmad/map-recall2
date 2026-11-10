import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxPlacement, ribbon, yardFillFlag } from './yardFillLayer';

test('flag is opt-in', () => {
  assert.equal(yardFillFlag(''), false);
  assert.equal(yardFillFlag('?yardFill=1'), true);
  assert.equal(yardFillFlag('?yardFill=0'), false);
});
test('box stands on its base and a compass heading of 90 lies along +x', () => {
  const p = boxPlacement([4.9, 52.37, 90, 5.2, '#fff'], [12.2, 2.44], 1);
  assert.ok(Math.abs(p.x) < 0.01 && Math.abs(p.y) < 0.01);
  assert.equal(p.z, 1 + 2.6);
  assert.ok(Math.abs(p.rotZ) < 1e-9);
});
test('ribbon is two triangles per segment, width wide', () => {
  const r = ribbon([[4.9, 52.37], [4.9001, 52.37]], 4);
  assert.equal(r.length, 18);
  assert.ok(Math.abs(Math.abs(r[1] - r[4]) - 4) < 1e-6);
});
