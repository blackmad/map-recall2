import assert from 'node:assert/strict';
import test from 'node:test';
import type { RoofFact } from '../../src/canalRecall/roofs/roofSlots.ts';
import { compareRoofFacts, confBin, driftCause, type PandInput } from './compareRoofFacts.ts';

const fact = (o: Partial<RoofFact> = {}): RoofFact => ({ slot: 'slate', rgb: [99, 99, 107], confidence: 1, solarShare: 0, terrace: false, furniture: [], ...o });
const input = (o: Partial<PandInput> = {}): PandInput => ({ tile: '8414/5385', roof: 3, outline: 'a', ...o });

test('confBin rounds to tenths', () => {
  assert.equal(confBin(0.2), '0.20');
  assert.equal(confBin(0.35), '0.40');
  assert.equal(confBin(1), '1.00');
});

test('driftCause names what changed in the pand input', () => {
  const before = new Map([['1', input()], ['2', input()], ['3', input()], ['4', input()], ['5', input()]]);
  const after = new Map([['1', input()], ['3', input({ outline: 'b' })], ['4', input({ roof: 1 })], ['5', input({ tile: '8414/5386' })], ['6', input()]]);
  assert.equal(driftCause('1', before, after), 'input-unchanged');
  assert.equal(driftCause('2', before, after), 'pand-removed');
  assert.equal(driftCause('3', before, after), 'outline-changed');
  assert.equal(driftCause('4', before, after), 'roof-type-changed');
  assert.equal(driftCause('5', before, after), 'tile-moved');
  assert.equal(driftCause('6', before, after), 'pand-added');
  assert.equal(driftCause('1', undefined, after), 'unknown');
});

test('compareRoofFacts counts gains, losses and shared-row drift', () => {
  const published = new Map<string, RoofFact>([
    ['a', fact({ dormer: true })],
    ['b', fact({ slot: 'glass', confidence: 0.9 })],
    ['gone', fact({ confidence: 0.5 })],
    ['furn', fact({ slot: 'gravel', furniture: [{ kind: 'hvac', e: 1, n: 1, w: 1, l: 1, yawDeg: 0 }] })],
  ]);
  const staged = new Map<string, RoofFact>([
    ['a', fact({ dormer: false })],
    ['b', fact({ slot: 'gravel', confidence: 0.9, rgb: [99 + 255 / 31, 99, 107] })],
    ['furn', fact({ slot: 'gravel' })],
    ['low', fact({ confidence: 0.2, slot: 'bitumen-dark' })],
    ['new', fact({ confidence: 1, slot: 'sedum' })],
  ]);
  const before = new Map([['a', input()], ['b', input()], ['gone', input()], ['furn', input()], ['low', input()]]);
  const after = new Map([['a', input()], ['b', input()], ['furn', input()], ['low', input()], ['new', input()]]);
  const r = compareRoofFacts(published, staged, { inputsBefore: before, inputsAfter: after });
  assert.equal(r.sharedRows, 3);
  assert.equal(r.roofsGainingFact, 2);
  assert.equal(r.roofsLosingFact, 1);
  assert.deepEqual(r.gainedByConfidence, { '0.20': 1, '1.00': 1 });
  assert.deepEqual(r.lostByConfidence, { '0.50': 1 });
  assert.equal(r.gainedAboveFloor, 1);
  assert.deepEqual(r.gainedAboveFloorCause, { 'pand-added': 1 });
  assert.deepEqual(r.lostAboveFloorCause, { 'pand-removed': 1 });
  assert.deepEqual(r.gainedAboveFloorIds.get('pand-added'), ['new']);
  assert.equal(r.slotChanged, 1);
  assert.deepEqual(r.topSlotChanges, [['glass->gravel', 1]]);
  assert.equal(r.dormerFlagChanged, 1);
  assert.equal(r.furnitureChanged, 1);
  assert.equal(r.confidenceChanged, 0);
  assert.equal(r.meanAbsRgbDelta5bit, Number((1 / 3 / 3).toFixed(4)));
  assert.equal(r.publishedDormers, 1);
  assert.equal(r.stagedDormers, 0);
  assert.deepEqual(r.publishedFurniture, { hvac: 1 });
  assert.equal(r.stagedBelowFurnitureFloor, 1);
  assert.equal(r.stagedBelowFurnitureFloorWithFurniture, 0);
});
