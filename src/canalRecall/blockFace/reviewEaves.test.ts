import assert from 'node:assert/strict';
import test from 'node:test';
import {applyEavesPins, eavesPinProblems} from './reviewEaves.ts';

const strip = {height: 800, pixelsPerMetre: 40};
const pin = {pandId: '0363100012066626', eavesM: 10.65, reason: 'one eaves line across the row'};

test('pins are validated', () => {
  assert.deepEqual(eavesPinProblems([pin]), []);
  assert.equal(eavesPinProblems([{...pin, eavesM: 1}]).length, 1);
  assert.equal(eavesPinProblems([{...pin, reason: ''}]).length, 1);
  assert.equal(eavesPinProblems([pin, pin]).length, 1);
});

test('no pin for the run returns the list as it came', () => {
  const m = [{pand: 'a', stripRow: 1, evidence: 'x'}];
  assert.equal(applyEavesPins(m, [pin], ['0363100012000001'], () => 10, strip), m);
  assert.equal(applyEavesPins(undefined, [], ['0363100012066626'], () => 10, strip), undefined);
});

test('a pin replaces the pand entry at the strip row of its line; a line under 3DBAG re-pitches the roof', () => {
  const m = [{pand: '0363100012066626', stripRow: 3, evidence: 'old'}, {pand: 'b', stripRow: 4, evidence: 'keep'}];
  const out = applyEavesPins(m, [pin], ['0363100012066626', 'b'], () => 10.15, strip)!;
  assert.equal(out.length, 2);
  assert.equal(out.find(x => x.pand === 'b')!.stripRow, 4);
  const mine = out.find(x => x.pand === '0363100012066626')!;
  assert.equal(mine.stripRow, 800 - 426);
  assert.equal(mine.frontRoof, undefined);
  const low = applyEavesPins(undefined, [{...pin, eavesM: 10.1}], ['0363100012066626'], () => 10.94, strip)!;
  assert.deepEqual(low[0].frontRoof, {});
});
