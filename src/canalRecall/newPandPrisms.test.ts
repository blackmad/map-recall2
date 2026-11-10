import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewPandGap, newPandFeature, newPandHeight } from './newPandPrisms';
import type { BagGap } from './bagGaps';

const gap = (o: Partial<BagGap> = {}): BagGap => ({ id: 'NL.IMBAG.Pand.1', status: 'Pand in gebruik', year: 2023, areaM2: 300, tileCover: 0, centre: [4.87, 52.4], ...o });

test('neighbour median is clamped; too few neighbours or a shed fall back and say so', () => {
  assert.deepEqual(newPandHeight(300, [12, 14, 16]), { height: 14, source: 'neighbour-median', neighbours: 3 });
  assert.equal(newPandHeight(300, [2, 3, 4]).height, 6);
  assert.equal(newPandHeight(300, [60, 70, 80]).height, 30);
  assert.deepEqual(newPandHeight(300, [12, 14]), { height: 9, source: 'area-default', neighbours: 2 });
  assert.equal(newPandHeight(25, [12, 14, 16]).height, 3);
});

test('only post-2019 undrawn pands qualify', () => {
  assert.ok(isNewPandGap(gap()));
  assert.ok(!isNewPandGap(gap({ year: 2018 })));
  assert.ok(!isNewPandGap(gap({ areaM2: 5 })));
  assert.ok(!isNewPandGap(gap({ tileCover: 0.4 })));
});

test('feature carries the height source', () => {
  const f = newPandFeature(gap(), [[[4.87, 52.4], [4.8701, 52.4], [4.8701, 52.4001], [4.87, 52.4]]], newPandHeight(300, []));
  assert.equal(f.properties.heightSource, 'area-default');
  assert.equal(f.geometry.type, 'Polygon');
});
