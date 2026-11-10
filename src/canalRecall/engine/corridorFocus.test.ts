import test from 'node:test';
import assert from 'node:assert/strict';
import { CORRIDOR_FRAGMENT, CORRIDOR_DIM, corridorFocusFlag, corridorWeight } from './corridorFocus';

test('off by default', () => { assert.equal(corridorFocusFlag(), false); });

test('the street column and the whole bottom edge are untouched', () => {
  for (const v of [0, 0.25, 0.5, 0.75, 1]) assert.equal(corridorWeight(0.5, v), 0);
  for (const u of [0, 0.2, 0.5, 0.8, 1]) assert.equal(corridorWeight(u, 0), 0);
});

test('the band narrows toward the horizon and is symmetric', () => {
  assert.equal(corridorWeight(0.1, 0.9), corridorWeight(0.9, 0.9));
  assert.ok(corridorWeight(0.15, 0.9) > corridorWeight(0.15, 0.3));
  assert.equal(corridorWeight(0, 1), 1);
});

test('the dim is at most 12 %', () => { assert.ok(CORRIDOR_DIM <= 0.12 + 1e-9); });

// `half` is a reserved word in GLSL ES 1.00: the first version named a variable `half`, the shader failed to compile
// on ANGLE and the pass drew nothing (l7 measured 0.00 change, 2026-11-10).
test('the fragment shader uses no GLSL ES reserved words as identifiers', () => {
  for (const word of ['half', 'fixed', 'long', 'short', 'double', 'input', 'output', 'sampler3D', 'hvec2', 'fvec3'])
    assert.ok(!new RegExp(`\\b(float|vec[234]|int)\\s+${word}\\b`).test(CORRIDOR_FRAGMENT), word);
  assert.ok(!/\bhalf\b/.test(CORRIDOR_FRAGMENT));
});
