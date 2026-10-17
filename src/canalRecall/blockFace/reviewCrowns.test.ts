/**
 * Reviewer crown pins (reviewCrowns.ts): Niasstraat 3-13's overhang vs Molukkenstraat 7-29's parapet, both "no crown"
 * to the skyline.
 *   node --import tsx --test src/canalRecall/blockFace/reviewCrowns.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyCrownPins, applyMirrorPins, crownPinProblems, mirrorPinProblems, typePinProblems, typesForFace, type CrownPin, type MirrorPin, type TypePin} from './reviewCrowns.ts';
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

test('type pins: a pinned face gets only its types (library order); other faces the whole library; problems', () => {
  const lib = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
  const pins: TypePin[] = [{face: 'molukken-35-67', types: ['c', 'a'], reason: 'strip'}];
  assert.deepEqual(typesForFace('molukken-35-67', lib, pins).map(t => t.id), ['a', 'c']);
  assert.equal(typesForFace('nias-1-13', lib, pins), lib);
  assert.deepEqual(typePinProblems(pins, lib), []);
  assert.match(typePinProblems([{face: 'x', types: ['z'], reason: 'r'}], lib)[0], /unknown type z/);
  assert.match(typePinProblems([{face: 'x', types: [], reason: 'r'}], lib)[0], /at least one type/);
  assert.match(typePinProblems([{face: 'x', types: ['a'], reason: ''}], lib)[0], /reason required/);
  assert.match(typePinProblems([{face: 'x', types: ['a'], reason: 'r'}, {face: 'x', types: ['b'], reason: 'r'}], lib)[0], /pinned twice/);
});

test('mirror pins: set or clear the mirror on the pinned type only, mark the side known; problems', () => {
  const pins: MirrorPin[] = [{pandId: 'p1', type: TYPE.id, mirror: true, reason: 'pair on the left'}, {pandId: 'p2', type: TYPE.id, mirror: false, reason: 'pair on the right'}];
  const ds = [placed('p1'), placed('p2'), placed('p3', 'other')];
  (ds[1] as Extract<Decision, {kind: 'placed'}>).house.type!.mirror = true;
  (ds[1] as Extract<Decision, {kind: 'placed'}>).notes.push('door left: mirrored');
  assert.deepEqual(applyMirrorPins(ds, pins), ['p1', 'p2']);
  const [a, b, c] = ds as Extract<Decision, {kind: 'placed'}>[];
  assert.equal(a.house.type!.mirror, true);
  assert.equal('mirror' in b.house.type!, false);
  assert.ok(b.notes.some(n => /^door reviewer pin: as drawn \(pair on the right\)/.test(n)) && !b.notes.includes('door left: mirrored'));
  assert.equal(c.house.type!.mirror, undefined);
  assert.deepEqual(mirrorPinProblems(pins, [TYPE]), []);
  assert.match(mirrorPinProblems([{...pins[0], type: 'x'}], [TYPE])[0], /unknown type x/);
  assert.match(mirrorPinProblems([pins[0], pins[0]], [TYPE])[0], /pinned twice/);
  assert.match(mirrorPinProblems([{...pins[0], reason: ''}], [TYPE])[0], /reason required/);
});

test('the Makassarpleinbuurt pins files are valid against the library', () => {
  const types = fs.readdirSync('scripts/block-face/types/indische-buurt').map(f => JSON.parse(fs.readFileSync(`scripts/block-face/types/indische-buurt/${f}`, 'utf8')));
  const doc = JSON.parse(fs.readFileSync('scripts/block-face/buurten/makassarpleinbuurt-review-types.json', 'utf8'));
  assert.deepEqual(typePinProblems(doc.pins as TypePin[], types), []);
  assert.deepEqual(mirrorPinProblems(doc.mirrors as MirrorPin[], types), []);
});

test('the Makassarpleinbuurt pins file is valid against the library', () => {
  const pins = JSON.parse(fs.readFileSync('scripts/block-face/buurten/makassarpleinbuurt-review-crowns.json', 'utf8')).pins as CrownPin[];
  const types = fs.readdirSync('scripts/block-face/types/indische-buurt').map(f => JSON.parse(fs.readFileSync(`scripts/block-face/types/indische-buurt/${f}`, 'utf8')));
  assert.deepEqual(crownPinProblems(pins, types), []);
});
