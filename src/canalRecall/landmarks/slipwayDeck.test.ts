import assert from 'node:assert/strict';
import test from 'node:test';
import {blocksAlong, blockTriNormal, frustumBlock, rampHeight} from './slipwayDeck';

test('rampHeight rises at the slope and clamps at the minimum', () => {
  const r = {u0: -31, h0: 0, slope: 0.05, min: 0.1};
  assert.equal(rampHeight(r, -31), 0.1);
  assert.ok(Math.abs(rampHeight(r, 59) - 4.5) < 1e-9);
  assert.equal(rampHeight({u0: 0, h0: 1, slope: 0.05}, -100), 0);
});

test('blocksAlong spaces spots evenly, half a pitch in from both ends, round corners', () => {
  const s = blocksAlong([[0, 0], [10, 0]], 1.5);
  assert.equal(s.length, 7);
  assert.ok(Math.abs(s[0].u - 10 / 14) < 1e-9 && Math.abs(s[6].u - (10 - 10 / 14)) < 1e-9);
  const bent = blocksAlong([[0, 0], [3, 0], [3, 3]], 1);
  assert.equal(bent.length, 6);
  assert.ok(Math.abs(bent[4].u - 3) < 1e-9 && Math.abs(bent[4].v - 1.5) < 1e-9 && Math.abs(bent[4].angle - Math.PI / 2) < 1e-9);
  assert.deepEqual(blocksAlong([[0, 0]], 1), []);
});

test('frustumBlock is closed above the deck with every face pointing out', () => {
  const spot = {u: 5, v: -2, angle: 0.4};
  const tris = frustumBlock(spot, 1, [1.1, 1.3], [0.7, 0.9], 1.2);
  assert.equal(tris.length, 10);
  for (const t of tris) {
    const n = blockTriNormal(t), m = [0, 1, 2].map(k => (t[0][k] + t[1][k] + t[2][k]) / 3);
    const out = [m[0] - spot.u, m[1] - 1.6, m[2] - spot.v];
    assert.ok(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] > 0, 'face points out');
  }
  const top = tris.slice(8).map(blockTriNormal);
  for (const n of top) assert.ok(n[1] > 0.999);
});
