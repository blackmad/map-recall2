import assert from 'node:assert/strict';
import test from 'node:test';
import {paneGrid} from './paneGrid';

test('member count: four frame members, cols-1 mullions, rows-1 transoms', () => {
  assert.equal(paneGrid({width: 3, height: 2, cols: 5, rows: 4, bar: 0.04, frame: 0.1}).length, 4 + 4 + 3);
  assert.equal(paneGrid({width: 1, height: 1, cols: 1, rows: 1, bar: 0.04, frame: 0}).length, 0);
});

test('every member stays inside the opening and the grid is symmetric about the centre line', () => {
  const r = paneGrid({width: 3, height: 2.5, cols: 5, rows: 3, bar: 0.05, frame: 0.1, transomRows: [1], transom: 0.12});
  for (const m of r) {
    assert.ok(m.x - m.w / 2 >= -1.5 - 1e-9 && m.x + m.w / 2 <= 1.5 + 1e-9, 'inside across');
    assert.ok(m.y >= -1e-9 && m.y + m.h <= 2.5 + 1e-9, 'inside up');
  }
  const xs = r.filter(m => m.h > 1).map(m => +m.x.toFixed(9)).sort((a, b) => a - b);
  assert.deepEqual(xs, xs.map(x => -x).sort((a, b) => a - b));
});

test('panes are equal across; a heavy transom is wider; row weights move the bars', () => {
  const r = paneGrid({width: 2.2, height: 2, cols: 4, rows: 2, bar: 0.04, frame: 0.1, transomRows: [1], transom: 0.12});
  const mull = r.slice(4, 7).map(m => m.x);
  assert.ok(Math.abs(mull[1] - mull[0] - (mull[2] - mull[1])) < 1e-9);
  assert.equal(r[7].h, 0.12);
  const w = paneGrid({width: 1, height: 3.1, cols: 1, rows: 2, bar: 0.04, frame: 0.05, rowWeights: [1, 2]});
  assert.ok(Math.abs(w[4].y + 0.02 - (0.05 + 3 / 3)) < 1e-9);
});

test('bad input throws', () => {
  assert.throws(() => paneGrid({width: 0, height: 1, cols: 1, rows: 1, bar: 0.04, frame: 0}));
  assert.throws(() => paneGrid({width: 1, height: 1, cols: 2.5, rows: 1, bar: 0.04, frame: 0}));
  assert.throws(() => paneGrid({width: 1, height: 1, cols: 1, rows: 2, bar: 0.04, frame: 0, rowWeights: [1]}));
});
