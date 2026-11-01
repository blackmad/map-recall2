import test from 'node:test';
import assert from 'node:assert/strict';
import { worldV1Enabled } from './worldCells.ts';

test('world-v1 is the default world; ?world=live asks for the live tile path', () => {
  assert.equal(worldV1Enabled(''), true);
  assert.equal(worldV1Enabled('?engine=own'), true);
  assert.equal(worldV1Enabled('?world=v1'), true);
  for (const off of ['live', '0', 'off', 'tiles']) assert.equal(worldV1Enabled(`?world=${off}&roads=bin`), false, off);
});
