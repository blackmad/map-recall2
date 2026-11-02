import assert from 'node:assert/strict';
import test from 'node:test';
import {layoutRelief, rakeHeight, reliefOverlaps, RELIEF_ASPECT, type PedimentField, type ReliefSlot} from './pedimentRelief';

const field: PedimentField = {halfWidth: 7.5, rise: 4.6, margin: 0.2};

test('rakeHeight is the clear field under the raking cornice', () => {
  assert.ok(Math.abs(rakeHeight(field, 0) - 4.4) < 1e-9);
  assert.ok(Math.abs(rakeHeight(field, 3.75) - 2.1) < 1e-9);
  assert.equal(rakeHeight(field, 7.5), 0);
  assert.equal(rakeHeight(field, 9), 0);
});

test('every figure stays under the rake at its outer top corner and inside the field', () => {
  const kinds = ['standing', 'seated', 'kneeling', 'reclining', 'shield'] as const;
  for (const kind of kinds) for (let u = -1; u <= 1.0001; u += 0.125) {
    const [p] = layoutRelief(field, [{kind, u: Math.max(-1, Math.min(1, u))}]);
    const outer = Math.abs(p.x) + p.width / 2;
    assert.ok(outer <= field.halfWidth - field.margin + 1e-9, `${kind} at ${u} crosses the side`);
    assert.ok(p.height <= rakeHeight(field, outer) + 1e-9, `${kind} at ${u}: ${p.height} over the rake ${rakeHeight(field, outer)}`);
    assert.ok(Math.abs(p.width - RELIEF_ASPECT[kind] * p.height) < 1e-9);
  }
});

test('the envelope is as large as the rake allows (touches it), unless capped', () => {
  const [p] = layoutRelief(field, [{kind: 'standing', u: 0.4}]);
  assert.ok(Math.abs(p.height - rakeHeight(field, Math.abs(p.x) + p.width / 2)) < 1e-9);
  const [c] = layoutRelief({...field, maxHeight: 2.5}, [{kind: 'standing', u: 0}]);
  assert.equal(c.height, 2.5);
});

test('mirrored slots give a mirrored group facing the axis; explicit facing wins', () => {
  const slots: ReliefSlot[] = [{kind: 'reclining', u: -0.85}, {kind: 'seated', u: -0.45}, {kind: 'standing', u: -0.15}, {kind: 'standing', u: 0.15}, {kind: 'seated', u: 0.45}, {kind: 'reclining', u: 0.85}];
  const p = layoutRelief(field, slots);
  for (let i = 0; i < 3; i++) {
    const a = p[i], b = p[5 - i];
    assert.ok(Math.abs(a.x + b.x) < 1e-9 && Math.abs(a.height - b.height) < 1e-9);
    assert.equal(a.facing, 1); assert.equal(b.facing, -1);
  }
  assert.equal(layoutRelief(field, [{kind: 'standing', u: 0}])[0].facing, 0);
  assert.equal(layoutRelief(field, [{kind: 'standing', u: -0.3, facing: -1}])[0].facing, -1);
  assert.deepEqual(reliefOverlaps(p), []);
});

test('reliefOverlaps reports merged envelopes and bad input throws', () => {
  const p = layoutRelief(field, [{kind: 'reclining', u: -0.5}, {kind: 'reclining', u: -0.4}]);
  assert.deepEqual(reliefOverlaps(p), [[0, 1]]);
  assert.throws(() => layoutRelief(field, [{kind: 'standing', u: 1.2}]));
  assert.throws(() => layoutRelief({halfWidth: 0, rise: 1, margin: 0}, []));
});
