import test from 'node:test';
import assert from 'node:assert/strict';
import { worldV1Enabled } from './worldCells.ts';

test('world-v1 is the default world; ?world=live asks for the live tile path', () => {
  assert.equal(worldV1Enabled(''), true);
  assert.equal(worldV1Enabled('?engine=own'), true);
  assert.equal(worldV1Enabled('?world=v1'), true);
  for (const off of ['live', '0', 'off', 'tiles']) assert.equal(worldV1Enabled(`?world=${off}&roads=bin`), false, off);
});

test('worldV1Enabled: ?rowFront=1 draws from the live tiles (its records decorate live tiles only); ?world=v1 still forces the cells', () => {
  assert.equal(worldV1Enabled('?rowFront=1'), false);
  assert.equal(worldV1Enabled('?rowFront=1&world=v1'), true);
  assert.equal(worldV1Enabled('?rowFront=0'), true);
});
