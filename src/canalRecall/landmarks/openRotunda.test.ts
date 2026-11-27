import test from 'node:test';
import assert from 'node:assert/strict';
import {openRotunda} from './openRotunda';

test('piers are evenly spaced and openings sit between them', () => {
  const r = openRotunda({radius: 2, piers: 8, pierWidth: 0.5});
  assert.equal(r.pierAngles.length, 8);
  assert.equal(r.openings.length, 8);
  const step = Math.PI / 4;
  r.pierAngles.forEach((a, i) => assert.ok(Math.abs(a - i * step) < 1e-12));
  for (const [i, op] of r.openings.entries()) {
    assert.ok(op.a0 > r.pierAngles[i] && op.a1 < r.pierAngles[i] + step, 'opening inside its bay');
    assert.ok(Math.abs(op.arc - (2 * Math.PI * 2 / 8 - 0.5)) < 1e-9, 'clear arc = bay arc minus a pier');
    assert.ok(op.chord < op.arc && op.chord > 0);
  }
});

test('balusters fill each opening evenly and never touch a pier', () => {
  const r = openRotunda({radius: 2, piers: 8, pierWidth: 0.5, startAngle: 0.3, balusterPitch: 0.2});
  for (const op of r.openings) {
    const k = op.balusters.length;
    assert.equal(k, Math.round(op.arc / 0.2));
    const s = (op.a1 - op.a0) / k;
    assert.ok(Math.abs(op.balusters[0] - op.a0 - s / 2) < 1e-12);
    assert.ok(Math.abs(op.a1 - op.balusters[k - 1] - s / 2) < 1e-12);
  }
});

test('no balusters unless a pitch is asked for; bad input throws', () => {
  assert.equal(openRotunda({radius: 1, piers: 4, pierWidth: 0.2}).openings[0].balusters.length, 0);
  assert.throws(() => openRotunda({radius: 1, piers: 2, pierWidth: 0.2}));
  assert.throws(() => openRotunda({radius: 0.2, piers: 8, pierWidth: 0.3}));
  assert.throws(() => openRotunda({radius: 1, piers: 6, pierWidth: 0.2, balusterPitch: 0}));
});
