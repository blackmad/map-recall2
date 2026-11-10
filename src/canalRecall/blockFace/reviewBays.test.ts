import test from 'node:test';
import assert from 'node:assert/strict';
import {applyBaysPins, baysPinProblems, type BaysPin} from './reviewBays.ts';
import type {Decision} from './autoPlace.ts';

const T = 'haarlemmerstraat-sash-cornice';
const placed = (pandId: string, overrides?: Record<string, unknown>, typeId = T): Decision => ({kind: 'placed', pandId, typeId, score: 1, notes: [],
  house: {pandId, slug: `h-${pandId.slice(-6)}`, address: 'Haarlemmerstraat', type: {type: typeId, ...(overrides ? {overrides} : {})}} as never});
const pin = (pandId: string, bays: number): BaysPin => ({pandId, type: T, bays, reason: 'strip axes'});

test('a pin sets overrides.bays, a pin equal to the body drops it, other types and unpinned pands are untouched', () => {
  const ds = [placed('0363100012171148'), placed('0363100012171140', {bays: 3, storeys: 4}), placed('0363100012171141', undefined, 'other'), placed('0363100012171145', {bays: 2})];
  const before = JSON.stringify(ds[3]);
  assert.deepEqual(applyBaysPins(ds, [pin('0363100012171148', 2), pin('0363100012171140', 3), {...pin('0363100012171141', 2)}], () => 3), ['0363100012171148', '0363100012171140']);
  const [a, b, c, d] = ds as Extract<Decision, {kind: 'placed'}>[];
  assert.deepEqual(a.house.type!.overrides, {bays: 2});
  assert.deepEqual(b.house.type!.overrides, {storeys: 4});
  assert.equal(c.house.type!.overrides, undefined);
  assert.equal(JSON.stringify(d), before);
  assert.ok(a.notes.some(n => /^bays 2: reviewer pin/.test(n)));
});

test('no pins leaves the decisions byte-identical', () => {
  const ds = [placed('0363100012171148', {bays: 2})], before = JSON.stringify(ds);
  assert.deepEqual(applyBaysPins(ds, [], () => 3), []);
  assert.equal(JSON.stringify(ds), before);
});

test('problems: pand id, integer 1..6, reason, known type, one pin per pand', () => {
  const types = [{id: T}];
  assert.deepEqual(baysPinProblems([pin('0363100012171148', 3)], types), []);
  assert.match(baysPinProblems([pin('171148', 3)], types)[0], /16-digit/);
  assert.match(baysPinProblems([pin('0363100012171148', 2.5)], types)[0], /integer 1..6/);
  assert.match(baysPinProblems([{...pin('0363100012171148', 2), reason: ''}], types)[0], /reason required/);
  assert.match(baysPinProblems([{...pin('0363100012171148', 2), type: 'x'}], types)[0], /unknown type x/);
  assert.match(baysPinProblems([pin('0363100012171148', 2), pin('0363100012171148', 3)], types)[0], /pinned twice/);
});
