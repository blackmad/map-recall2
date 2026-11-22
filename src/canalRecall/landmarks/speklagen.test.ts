import assert from 'node:assert/strict';
import test from 'node:test';
import {speklagen} from './speklagen';

test('a band at window height stops at each window; a band above the windows runs through', () => {
  const r = speklagen({t0: 0, t1: 10, bands: [{y: 2, h: 0.15}, {y: 5, h: 0.15}], openings: [{t0: 2, t1: 3, y0: 1, y1: 4}, {t0: 6, t1: 7.5, y0: 1, y1: 4}]});
  assert.deepEqual(r.filter(x => x.y === 2).map(x => [x.t0, x.t1]), [[0, 2], [3, 6], [7.5, 10]]);
  assert.deepEqual(r.filter(x => x.y === 5).map(x => [x.t0, x.t1]), [[0, 10]]);
});

test('touching edges do not cut; the gap widens the cut; overlapping openings merge', () => {
  assert.equal(speklagen({t0: 0, t1: 4, bands: [{y: 4, h: 0.2}], openings: [{t0: 1, t1: 2, y0: 1, y1: 4}]}).length, 1);
  const r = speklagen({t0: 0, t1: 6, bands: [{y: 2, h: 0.2}], openings: [{t0: 1, t1: 3, y0: 0, y1: 5}, {t0: 2.5, t1: 4, y0: 0, y1: 5}], gap: 0.1});
  assert.deepEqual(r.map(x => [x.t0, +x.t1.toFixed(6)]), [[0, 0.9], [4.1, 6]]);
});

test('slivers under minRun are dropped and openings past the wall end are clipped', () => {
  const r = speklagen({t0: 0, t1: 5, bands: [{y: 1, h: 0.1}], openings: [{t0: 0.05, t1: 1, y0: 0, y1: 2}, {t0: 4.5, t1: 9, y0: 0, y1: 2}]});
  assert.deepEqual(r.map(x => [x.t0, x.t1]), [[1, 4.5]]);
  assert.throws(() => speklagen({t0: 1, t1: 1, bands: [], openings: []}));
});
