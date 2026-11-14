/**
 * Unlisted walls of a large recipe (otherWalls.ts, lane blank-walls-20261114; feedback 21dc1e32 Buitenzagerij 45 and
 * 174d2455 Kromhout, Gedempt Hamerkanaal 209): blank only on a cited photo, the shader window grid otherwise, never on
 * a party wall.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveOtherWalls, isPartyPanel, blankWallsProblems} from './otherWalls.ts';

const src = [{id: 'pano-a', kind: 'street-panorama' as const, capturedAt: '2025-09-04'}];

test('uncited blank and absent otherWalls take the window grid; a cited photo keeps blank; systems stay', () => {
  assert.deepEqual(resolveOtherWalls({sources: src}), {system: 'blank', windowGrid: true, why: 'unphotographed'});
  assert.deepEqual(resolveOtherWalls({otherWalls: 'blank', sources: src}), {system: 'blank', windowGrid: true, why: 'unphotographed'});
  assert.deepEqual(resolveOtherWalls({otherWalls: 'blank', blankWalls: {source: 'pano-a'}, sources: src}), {system: 'blank', windowGrid: false, why: 'photo-blank'});
  assert.deepEqual(resolveOtherWalls({otherWalls: 'blank', blankWalls: {source: 'nope'}, sources: src}).windowGrid, true);
  assert.deepEqual(resolveOtherWalls({otherWalls: 'brick-bay-grid', sources: src}), {system: 'brick-bay-grid', windowGrid: false, why: 'stated-system'});
  assert.deepEqual(resolveOtherWalls({otherWalls: 'window-grid', sources: src}), {system: 'blank', windowGrid: true, why: 'stated-grid'});
});

test('blankWalls validates against the intent sources', () => {
  assert.deepEqual(blankWallsProblems({sources: src}), []);
  assert.deepEqual(blankWallsProblems({blankWalls: {source: 'pano-a', note: 'rear wall blind'}, sources: src}), []);
  assert.equal(blankWallsProblems({blankWalls: {source: 'pano-b'}, sources: src}).length, 1);
  assert.equal(blankWallsProblems({blankWalls: {source: 'pano-a', x: 1} as never, sources: src}).length, 1);
});

test('party panels are never gridded', () => {
  assert.equal(isPartyPanel({partyH: 0}), false);
  assert.equal(isPartyPanel({partyH: 0.4}), false);
  assert.equal(isPartyPanel({partyH: 6}), true);
});
