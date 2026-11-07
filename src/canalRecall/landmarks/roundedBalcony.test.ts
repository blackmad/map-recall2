import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundedBalcony} from './roundedBalcony';

const area = (r: [number, number][]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const runLen = (pts: [number, number][]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

test('square balcony: the slab is the rectangle and the rail runs the three open edges', () => {
  const b = roundedBalcony(4, 1.5);
  assert.equal(area(b.outline), 6);
  assert.equal(b.runs.length, 1);
  assert.ok(Math.abs(runLen(b.runs[0].pts) - (1.5 + 4 + 1.5)) < 1e-9);
  assert.ok(!b.runs[0].pts.slice(1, -1).some(([, o]) => Math.abs(o) < 1e-9), 'no rail along the wall');
});

test('rounded front corners: smaller slab, shorter rail, nothing outside the box, symmetric', () => {
  const b = roundedBalcony(4, 1.5, {rLeft: 1, rRight: 1, steps: 32});
  const expected = 6 - 2 * (1 - Math.PI / 4);
  assert.ok(Math.abs(area(b.outline) - expected) < 0.01);
  assert.ok(b.outline.every(([t, o]) => t >= -1e-9 && t <= 4 + 1e-9 && o >= -1e-9 && o <= 1.5 + 1e-9));
  assert.ok(runLen(b.runs[0].pts) < 7);
  const ts = b.bars.map(x => x.at[0]).sort((a, c) => a - c), mirrored = b.bars.map(x => 4 - x.at[0]).sort((a, c) => a - c);
  ts.forEach((t, i) => assert.ok(Math.abs(t - mirrored[i]) < 1e-6));
});

test('bars: at most barSpacing apart, at both run ends, tangents unit length', () => {
  const b = roundedBalcony(5, 2, {rRight: 1.5, barSpacing: 0.25});
  const run = b.runs[0].pts;
  assert.deepEqual(b.bars[0].at, run[0]);
  const last = b.bars.at(-1)!.at; assert.ok(Math.hypot(last[0] - run.at(-1)![0], last[1] - run.at(-1)![1]) < 1e-9);
  for (let i = 1; i < b.bars.length; i++) assert.ok(Math.hypot(b.bars[i].at[0] - b.bars[i - 1].at[0], b.bars[i].at[1] - b.bars[i - 1].at[1]) <= 0.25 + 1e-9);
  b.bars.forEach(x => assert.ok(Math.abs(Math.hypot(...x.tangent) - 1) < 1e-9));
});

test('sides: false keeps the rail off the straight side legs', () => {
  const b = roundedBalcony(4, 1.5, {rLeft: 1.5, rRight: 1.5, sides: false});
  assert.ok(b.runs[0].pts.every(([, o]) => o > 0.75 - 1e-9));
});

test('rejects an empty balcony', () => {
  assert.throws(() => roundedBalcony(0, 1));
});
