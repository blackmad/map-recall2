// Lane FD 2026-11-13: housing audit of works/shed tags. Regression: 0363100012091500 (2004 block, 40 homes) tagged works.
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRow, housingClass, summarise, woonShare, type TaggedPand } from './industrialAudit.ts';

const block: TaggedPand = { id: 'NL.IMBAG.Pand.0363100012091500', kind: 'works', stadsdeel: 'Centrum', areaM2: 980, heightM: 15, year: 2004,
  uses: { woonfunctie: 3400, industriefunctie: 106, bijeenkomstfunctie: 36 }, vbos: 43, woonVbos: 40 };
const hall: TaggedPand = { id: 'h', kind: 'shed', stadsdeel: 'Westpoort', areaM2: 3000, heightM: 9, year: 1985, uses: { industriefunctie: 2900 }, vbos: 1, woonVbos: 0 };

test('woon share counts plain woonfunctie floor area', () => {
  assert.ok(woonShare(block.uses) > 0.95);
  assert.equal(woonShare(undefined), 0);
});
test('housing classes', () => {
  assert.equal(housingClass(block.uses), 'mainly-residential');
  assert.equal(housingClass({ woonfunctie: 20, industriefunctie: 180 }), 'mixed-residential');
  assert.equal(housingClass(hall.uses), 'not-residential');
  assert.equal(housingClass(undefined), 'no-vbo-data');
});
test('the apartment block would keep the house grammar once the classifier sees its homes; a hall stays a shed', () => {
  assert.equal(auditRow(block).revisedKind, null);
  assert.equal(auditRow(hall).revisedKind, 'shed');
});
test('summary counts per stadsdeel', () => {
  const s = summarise([auditRow(block), auditRow(hall), auditRow({ ...hall, id: 'n', uses: undefined })]);
  assert.equal(s.tagged, 3); assert.equal(s.mainly, 1); assert.equal(s.noData, 1);
  assert.equal(s.perStadsdeel.Centrum.mainly, 1);
});
