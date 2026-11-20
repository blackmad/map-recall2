import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseRowBoundaries } from './compare.ts';

it('photo-row.json boundaries: object or array form, bad entries dropped, sorted by x0', () => {
  assert.deepEqual(parseRowBoundaries({ pands: [{ pandId: 'b', x0: 200, x1: 300, address: 'Rustenburgerstraat 2' }, { pandId: 'a', x0: 0, x1: 200 }, { x0: 5, x1: 5 }, { x0: 'x' }] }),
    [{ x0: 0, x1: 200, pandId: 'a' }, { x0: 200, x1: 300, pandId: 'b', address: 'Rustenburgerstraat 2' }]);
  assert.deepEqual(parseRowBoundaries([{ x0: 1, x1: 2, label: 'L' }]), [{ x0: 1, x1: 2, address: 'L' }]);
  assert.deepEqual(parseRowBoundaries(null), []);
});
