/**
 * Reviewer crown pins (reviewCrowns.ts): Niasstraat 3-13's overhang vs Molukkenstraat 7-29's parapet, both "no crown"
 * to the skyline.
 *   node --import tsx --test src/canalRecall/blockFace/reviewCrowns.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyCrownPins, crownPinProblems, type CrownPin} from './reviewCrowns.ts';
import type {Decision} from './autoPlace.ts';

const TYPE = {id: 'indisch-1926-attic-lights', crowns: {parapet: {gable: 'flat' as const}, overhang: {gable: 'flat' as const}}};
const placed = (pandId: string, typeId = TYPE.id, crown?: string): Decision => ({kind: 'placed', pandId, typeId, score: 1, notes: ['crown parapet (type default)'],
  house: {pandId, slug: `nias-${pandId.slice(-6)}`, address: 'Niasstraat', type: {type: typeId, ...(crown ? {crown} : {})}} as never});

test('problems: one of face/pandId, a reason, a known type and crown', () => {
  assert.deepEqual(crownPinProblems([{face: 'nias-1-13', type: TYPE.id, crown: 'overhang', reason: 'strip'}], [TYPE]), []);
  assert.match(crownPinProblems([{face: 'a', pandId: 'b', type: TYPE.id, crown: 'overhang', reason: 'x'}], [TYPE])[0], /exactly one of face or pandId/);
  assert.match(crownPinProblems([{face: 'a', type: TYPE.id, crown: 'overhang', reason: ''}], [TYPE])[0], /reason required/);
  assert.match(crownPinProblems([{face: 'a', type: 'nope', crown: 'overhang', reason: 'x'}], [TYPE])[0], /unknown type/);
  assert.match(crownPinProblems([{face: 'a', type: TYPE.id, crown: 'tower', reason: 'x'}], [TYPE])[0], /has no crown "tower"/);
});

test('a face pin sets the crown on that face only and on that type only; a pand pin wins; the default crown is removed', () => {
  const pins: CrownPin[] = [
    {face: 'nias-1-13', type: TYPE.id, crown: 'overhang', reason: 'white fascia over the row'},
    {pandId: 'p3', type: TYPE.id, crown: 'parapet', reason: 'this one has a parapet'},
  ];
  const ds = [placed('p1'), placed('p2', 'other-type'), placed('p3', TYPE.id, 'overhang'), {kind: 'held', pandId: 'p4', address: '', stage: 'match', reason: ''} as Decision];
  assert.deepEqual(applyCrownPins('nias-1-13', ds, pins, [TYPE]), ['p1', 'p3']);
  const [a, b, c] = ds as Extract<Decision, {kind: 'placed'}>[];
  assert.equal(a.house.type!.crown, 'overhang');
  assert.ok(a.notes.some(n => /reviewer pin \(white fascia/.test(n)) && !a.notes.includes('crown parapet (type default)'));
  assert.equal(b.house.type!.crown, undefined);
  assert.equal('crown' in c.house.type!, false, 'the first crown is the default: no crown key');
  const other = [placed('p1')];
  assert.deepEqual(applyCrownPins('molukken-7-29', other, pins, [TYPE]), []);
  assert.equal((other[0] as Extract<Decision, {kind: 'placed'}>).house.type!.crown, undefined);
});

test('the Makassarpleinbuurt pins file is valid against the library', () => {
  const pins = JSON.parse(fs.readFileSync('scripts/block-face/buurten/makassarpleinbuurt-review-crowns.json', 'utf8')).pins as CrownPin[];
  const types = fs.readdirSync('scripts/block-face/types/indische-buurt').map(f => JSON.parse(fs.readFileSync(`scripts/block-face/types/indische-buurt/${f}`, 'utf8')));
  assert.deepEqual(crownPinProblems(pins, types), []);
});
