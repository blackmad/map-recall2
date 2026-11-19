import test from 'node:test';
import assert from 'node:assert/strict';
import {installAliases, towerFeatureId} from './installAliases.ts';

// fixture: the tile ids around a tower-podium pand (094874) and a plain pand (066028)
const tiles = ['NL.IMBAG.Pand.0363100012094874', 'tower:NL.IMBAG.Pand.0363100012094874', 'NL.IMBAG.Pand.0363100012066028', 'w57860150', 'tower:NL.IMBAG.Pand.0363100012999999'];

test('a pand with a tower feature in the tiles aliases it', () => {
  assert.deepEqual(installAliases('0363100012094874', [], tiles), ['tower:NL.IMBAG.Pand.0363100012094874']);
  assert.equal(towerFeatureId('0363100012094874'), 'tower:NL.IMBAG.Pand.0363100012094874');
});

test('no tower feature: the linked OSM outlines only, unchanged (byte-identical entries)', () => {
  assert.deepEqual(installAliases('0363100012066028', [], tiles), []);
  assert.deepEqual(installAliases('0363100012066028', ['w57860150'], tiles), ['w57860150']);
});

test('OSM outlines first, then the tower; never twice', () => {
  assert.deepEqual(installAliases('0363100012094874', ['w1'], tiles), ['w1', 'tower:NL.IMBAG.Pand.0363100012094874']);
  assert.deepEqual(installAliases('0363100012094874', ['tower:NL.IMBAG.Pand.0363100012094874'], tiles), ['tower:NL.IMBAG.Pand.0363100012094874']);
});

test('declared osmAliases (a pand missing from the tiles): appended last, once, and only when the tiles draw them', () => {
  const narva = ['w725476475', 'w936343679', 'NL.IMBAG.Pand.0363100012250155'];
  assert.deepEqual(installAliases('0363100012252366', [], narva, ['w725476475', 'w936343679']), ['w725476475', 'w936343679']);
  assert.deepEqual(installAliases('0363100012252366', ['w725476475'], narva, ['w725476475', 'w936343679']), ['w725476475', 'w936343679']);
  assert.throws(() => installAliases('0363100012252366', [], narva, ['w1']), /osmAliases: w1 is not a building-tile feature/);
  // absent: byte-identical
  assert.deepEqual(installAliases('0363100012094874', ['w1'], tiles, []), installAliases('0363100012094874', ['w1'], tiles));
});
