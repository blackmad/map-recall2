import {test} from 'node:test';
import assert from 'node:assert/strict';
import {steppedGable} from './steppedGable';

test('steppedGable: Utrechtsestraat gable, four treads a side, unequal runs', () => {
  const g = steppedGable({width: 6.7, y0: 17.0, stepsPerSide: 4, rise: [0.9, 1.0, 1.0, 1.0, 1.1], run: [0.4, 0.5, 0.5, 0.5]});
  assert.equal(g.tiers.length, 5);
  assert.equal(g.copings.length, 9); // four treads on each side plus the top
  // tiers stack without gaps, each centred and narrower by its run on both sides
  for (let k = 1; k < g.tiers.length; k++) {
    assert.ok(Math.abs(g.tiers[k].y0 - g.tiers[k - 1].y1) < 1e-9);
    assert.ok(Math.abs(g.tiers[k].t0 + g.tiers[k].t1) < 1e-9);
  }
  assert.ok(Math.abs(g.tiers[1].t1 - (3.35 - 0.4)) < 1e-9);
  assert.ok(Math.abs(g.tiers[4].t1 - (3.35 - 1.9)) < 1e-9);
  assert.ok(Math.abs(g.tiers[4].y1 - 22.0) < 1e-9);
  assert.ok(Math.abs(g.top - 22.12) < 1e-9);
  // each tread coping sits on its tier and reaches from the next tier's face past this one's
  const [l0, r0] = g.copings;
  assert.ok(Math.abs(l0.y - 17.9) < 1e-9 && Math.abs(r0.y - 17.9) < 1e-9);
  assert.ok(Math.abs(r0.t0 - 2.95) < 1e-9 && Math.abs(r0.t1 - 3.41) < 1e-9);
  assert.ok(Math.abs(l0.t0 + r0.t1) < 1e-9 && Math.abs(l0.t1 + r0.t0) < 1e-9);
});

test('steppedGable: scalar rise and run, custom coping', () => {
  const g = steppedGable({width: 2.4, y0: 0, stepsPerSide: 2, rise: 0.8, run: 0.4, coping: 0.1, overhang: 0});
  assert.deepEqual(g.tiers.map(t => +t.t1.toFixed(6)), [1.2, 0.8, 0.4]);
  assert.ok(Math.abs(g.top - 2.5) < 1e-9);
  const top = g.copings.at(-1)!;
  assert.ok(Math.abs(top.t0 + 0.4) < 1e-9 && Math.abs(top.t1 - 0.4) < 1e-9);
});

test('steppedGable: rejects bad input', () => {
  assert.throws(() => steppedGable({width: 1, y0: 0, stepsPerSide: 2, rise: 1, run: 0.3}), /no top tier/);
  assert.throws(() => steppedGable({width: 4, y0: 0, stepsPerSide: 2, rise: [1, 1], run: 0.3}), /rise needs 3/);
  assert.throws(() => steppedGable({width: 4, y0: 0, stepsPerSide: 0, rise: 1, run: 0.3}), /positive integer/);
  assert.throws(() => steppedGable({width: 4, y0: 0, stepsPerSide: 1, rise: 1, run: -0.3}), /run must be positive/);
});
