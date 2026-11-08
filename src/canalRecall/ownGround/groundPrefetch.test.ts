import assert from 'node:assert/strict';
import test from 'node:test';
import { groundPrefetchFlag, prefetchStep } from './groundPrefetch';

const v = (zoom: number) => ({ lngLat: [4.9, 52.37] as [number, number], zoom, pitch: 60 });

test('groundPrefetchFlag: on unless ?groundPrefetch=0', () => {
  assert.equal(groundPrefetchFlag(''), true);
  assert.equal(groundPrefetchFlag('?groundPrefetch=0'), false);
  assert.equal(groundPrefetchFlag('?groundPrefetch=1'), true);
});

test('prefetchStep uses a pose once its cell held for two polls', () => {
  assert.deepEqual(prefetchStep(v(17), '0_0', null, 15), { use: false, nextKey: '0_0' });
  assert.deepEqual(prefetchStep(v(17), '0_0', '0_0', 15), { use: true, nextKey: '0_0' });
  assert.deepEqual(prefetchStep(v(17), '1_0', '0_0', 15), { use: false, nextKey: '1_0' });
});

test('prefetchStep ignores no pose, no cell, and zooms the ground does not draw at', () => {
  assert.deepEqual(prefetchStep(null, '0_0', '0_0', 15), { use: false, nextKey: null });
  assert.deepEqual(prefetchStep(v(17), null, '0_0', 15), { use: false, nextKey: null });
  assert.deepEqual(prefetchStep(v(12), '0_0', '0_0', 15), { use: false, nextKey: null });
  assert.deepEqual(prefetchStep(v(NaN), '0_0', '0_0', 15), { use: false, nextKey: null });
});
