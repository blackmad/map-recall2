import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownWorldViewOrNull } from './ownWorldViewOrNull';

// Named regression (webgl-refused.spec.ts under the own-engine default): a refused WebGL context made the Game
// constructor throw and the ride never opened.
test('a world view that cannot be built is null and reported, not thrown', () => {
  const reported: unknown[] = [];
  const orig = console.error; console.error = () => {};
  try {
    const view = ownWorldViewOrNull(null, () => { throw new Error('Error creating WebGL context.'); }, (_c, e) => reported.push(e));
    assert.equal(view, null);
    assert.equal(reported.length, 1);
  } finally { console.error = orig; }
});

test('a world view that builds is returned as is', () => {
  const made = {} as never;
  assert.equal(ownWorldViewOrNull(null, () => made, () => assert.fail('no report')), made);
});
