/**
 * Reviewer door pins (reviewDoors.ts): Polanenstraat 240's door behind a hedge, read off the canopy and ladder light.
 *   node --import tsx --test src/canalRecall/blockFace/reviewDoors.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyDoorPins, doorPinProblems, type DoorPin} from './reviewDoors.ts';
import {fillPairs, type Decision} from './autoPlace.ts';

const TYPE = {id: 'spaarndammer-1933-stair-ladder-five', match: {mirrorForDoor: 'right' as const}};
const P = '0363100012066643', Q = '0363100012096276';
const placed = (pandId: string, typeId = TYPE.id): Decision => ({kind: 'placed', pandId, typeId, score: 1, notes: ['door unread', 'crown overhang (type default)'],
  house: {pandId, slug: `polanen-${pandId.slice(-6)}`, address: 'Polanenstraat', type: {type: typeId}} as never});

test('problems: a pand id, a side, a reason, a known type mirrored for its door', () => {
  assert.deepEqual(doorPinProblems([{pandId: P, type: TYPE.id, side: 'left', reason: 'strip'}], [TYPE]), []);
  assert.match(doorPinProblems([{pandId: '66643', type: TYPE.id, side: 'left', reason: 'x'}], [TYPE])[0], /16-digit/);
  assert.match(doorPinProblems([{pandId: P, type: TYPE.id, side: 'middle' as never, reason: 'x'}], [TYPE])[0], /side/);
  assert.match(doorPinProblems([{pandId: P, type: TYPE.id, side: 'left', reason: ''}], [TYPE])[0], /reason required/);
  assert.match(doorPinProblems([{pandId: P, type: 'other', side: 'left', reason: 'x'}], [{id: 'other'}])[0], /no match.mirrorForDoor/);
});

test('a pin mirrors a type drawn with the door on the other side, only for its type; pairing leaves it alone', () => {
  const pins: DoorPin[] = [{pandId: P, type: TYPE.id, side: 'left', reason: 'canopy left of the middle'}];
  const ds = [placed(P), placed(Q, 'spaarndammer-1933-stair-ladder')];
  assert.deepEqual(applyDoorPins(ds, pins, [TYPE]), [P]);
  const [a, b] = ds as Extract<Decision, {kind: 'placed'}>[];
  assert.equal(a.house.type!.mirror, true);
  assert.ok(a.notes.some(n => /^door left: mirrored: reviewer pin/.test(n)) && !a.notes.includes('door unread'));
  assert.equal(b.house.type!.mirror, undefined);
  fillPairs(ds, [TYPE] as never);
  assert.equal(a.house.type!.mirror, true);
  const same = [placed(P)];
  applyDoorPins(same, [{...pins[0], side: 'right'}], [TYPE]);
  assert.equal('mirror' in (same[0] as Extract<Decision, {kind: 'placed'}>).house.type!, false, 'as drawn: no mirror key');
});

test('the Spaarndammerbuurt-Midden pins file is valid against the library', () => {
  const pins = JSON.parse(fs.readFileSync('scripts/block-face/buurten/spaarndammerbuurt-midden-review-doors.json', 'utf8')).pins as DoorPin[];
  const types = fs.readdirSync('scripts/block-face/types/spaarndammerbuurt').map(f => JSON.parse(fs.readFileSync(`scripts/block-face/types/spaarndammerbuurt/${f}`, 'utf8')));
  assert.deepEqual(doorPinProblems(pins, types), []);
});
