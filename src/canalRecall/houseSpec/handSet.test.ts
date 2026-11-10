// Hand set v1 (lane H5h, #351): the schema, the validator, the committed readings, and the scoring arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HEX_DARK_L, READING_CONVENTION, hexTone, toneOf, validateHandSet, type HandSet } from './handSet.ts';
import { parseRow } from '../../../scripts/house-specs/hand-set/build.ts';
import { agree, handValues, table } from '../../../scripts/house-specs/hand-set/score.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const load = (f: string): HandSet => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line', f), 'utf8'));
const SHA = 'a'.repeat(64), REF = 'source-data://pand-crops/0363100012174187/front.jpg';
const pand = (over: Record<string, unknown> = {}) => ({
  pandId: '0363100012174187', group: 'ab07', images: [{ ref: REF, sha256: SHA }], readable: true,
  fields: { axes: { value: 3, confidence: 'med', ref: REF }, storeys: { value: 5, confidence: 'high', ref: REF }, gable: { value: 'cornice', confidence: 'high', ref: REF }, finish: { value: 'brick', confidence: 'high', ref: REF }, wall: { value: 'brown', confidence: 'med', ref: REF } },
  ...over,
});
const set = (pands: unknown[]) => ({ version: 1, reader: 't', date: '2026-11-10', convention: READING_CONVENTION, pands });

test('the committed hand set and the second reader validate', () => {
  const a = load('hand-set-v1.json'), b = load('hand-set-v1.reader-b.json');
  assert.deepEqual(validateHandSet(a), []); assert.deepEqual(validateHandSet(b), []);
  assert.equal(a.pands.length, 80);
  const groups = a.pands.reduce((m: Record<string, number>, p) => ((m[p.group] = (m[p.group] ?? 0) + 1), m), {});
  assert.deepEqual(groups, { ab07: 60, easy: 13, nassau: 7 });
  assert.equal(b.pands.length, 30);
  for (const p of b.pands) assert.ok(a.pands.some(x => x.pandId === p.pandId), `${p.pandId} is in the hand set`);
  // every field ref is one of the pand's archived images, each with a sha256
  for (const p of a.pands) for (const k of ['axes', 'storeys', 'gable', 'finish', 'wall'] as const) assert.ok(p.images.some(i => i.ref === p.fields[k].ref));
});

test('validateHandSet rejects what the schema forbids', () => {
  assert.deepEqual(validateHandSet(set([pand()])), []);
  assert.match(validateHandSet(set([pand({ pandId: '123' })])).join(), /16 digits/);
  assert.match(validateHandSet(set([pand(), pand()])).join(), /duplicate/);
  const bad = (fields: Record<string, unknown>) => validateHandSet(set([pand({ fields: { ...pand().fields, ...fields } })])).join();
  assert.match(bad({ gable: { value: 'dome', confidence: 'high', ref: REF } }), /fields.gable/);
  assert.match(bad({ axes: { value: 0, confidence: 'high', ref: REF } }), /fields.axes/);
  assert.match(bad({ wall: { value: 'brown', confidence: 'sure', ref: REF } }), /fields.wall/);
  assert.match(bad({ finish: { value: 'brick', confidence: 'high', ref: 'source-data://elsewhere.jpg' } }), /not one of the pand's images/);
  assert.match(validateHandSet(set([pand({ images: [{ ref: '/tmp/x.jpg', sha256: SHA }] })])).join(), /source-data refs/);
  assert.match(validateHandSet(set([pand({ readable: false })])).join(), /unreadable pand states axes/);
});

test('the convention names every rule the readers were given', () => {
  for (const w of ['souterrain', 'entresol', 'atticInCrown', 'bel-etage', 'erker', 'gable foot', 'mullion', 'axesPerStorey']) assert.ok(READING_CONVENTION.includes(w), w);
});

test('tones: brown and dark read dark; a hex is dark under HEX_DARK_L', () => {
  assert.equal(toneOf('dark'), 'dark'); assert.equal(toneOf('brown'), 'dark'); assert.equal(toneOf('red-brown'), 'light'); assert.equal(toneOf(null), null);
  assert.equal(HEX_DARK_L, 0.38);
  assert.equal(hexTone('#36302c'), 'dark'); assert.equal(hexTone('#947b65'), 'light'); assert.equal(hexTone('nope'), null);
});

test('parseRow reads the reading log, flags and unreadable rows', () => {
  const imgs = [{ ref: 'source-data://a/A.jpg', sha256: SHA }, { ref: 'source-data://a/B.jpg', sha256: SHA }];
  const r = parseRow(['0363100012169981', 'B', '3:med', '3:high', 'atticInCrown,aps=2-3', 'cornice:high', 'brick:high', 'dark:med', 'shop:high', 'note'].join('\t'), imgs);
  assert.equal(r.fields.axes.value, 3); assert.equal(r.fields.axes.ref, 'source-data://a/B.jpg'); assert.deepEqual(r.fields.axesPerStorey, [2, 3]);
  assert.equal(r.fields.atticInCrown, true); assert.equal(r.fields.souterrain, undefined); assert.equal(r.fields.pui!.value, 'shop');
  const n = parseRow(['0363100012174180', 'A', '-:low', '-:low', '-', 'step:med', 'brick:med', 'red-brown:med', 'shop:low', ''].join('\t'), imgs);
  assert.equal(n.fields.axes.value, null); assert.equal(n.fields.gable.value, 'step');
  const u = parseRow(['0363100012169088', 'A', 'UNREADABLE', '-', '-', '-', '-', '-', '-', 'why'].join('\t'), imgs);
  assert.equal(u.readable, false); assert.equal(u.fields.gable.value, null);
});

test('scoring: exact and within-one agreement, precision over stated, recall over hand', () => {
  assert.ok(agree('bays', 3, 3)); assert.ok(!agree('bays', 3, 4)); assert.ok(agree('bays±1', 3, 4)); assert.ok(!agree('storeys±1', 3, 5));
  const h = handValues(pand() as any), lowOnly = handValues(pand() as any, 'high');
  assert.equal(h.bays, 3); assert.equal(lowOnly.bays, undefined); assert.equal(h.wallTone, 'dark');
  const t = table([{ hand: h, got: { ...h, bays: 4, 'bays±1': 4 } }, { hand: h, got: { ...h, bays: undefined, 'bays±1': undefined } }]);
  assert.deepEqual(t.bays, { hand: 2, stated: 1, agree: 0, precision: 0, recall: 0 });
  assert.deepEqual(t['bays±1'], { hand: 2, stated: 1, agree: 1, precision: 1, recall: 0.5 });
});
