import test from 'node:test';
import assert from 'node:assert/strict';
import { describeStaged, makeStaged, parseStaged, verdictOf, type Receipt } from './staged.ts';

const spec = { schemaVersion: 1, pandId: '0363100012164843', design: { fronts: [{ gable: 'bell' }] }, provenance: { 'fronts/0/gable': { source: 'author', confidence: 0.9, ref: 'photo', at: '2026-11-10' } } };
const preview: Receipt = { kind: 'preview', measure: { verdict: 'PASS' }, measurePath: 'artifacts/house-preview/0363100012164843/measure.json', comparePath: 'artifacts/house-preview/0363100012164843/compare.png', verdict: 'PASS', measureSha256: 'a', compareSha256: 'b' };

test('makeStaged validates the spec and round-trips through parseStaged', () => {
  const s = makeStaged({ spec, by: 'lane-x', note: 'n', receipt: preview, now: new Date('2026-11-10T12:00:00Z') });
  assert.equal(s.pandId, '0363100012164843');
  assert.deepEqual(parseStaged(JSON.parse(JSON.stringify(s))), s);
  assert.match(describeStaged(s), /receipt PASS/);
});

test('an invalid spec or an empty no-receipt reason is refused', () => {
  assert.throws(() => makeStaged({ spec: { ...spec, pandId: 'nope' }, by: 'x', receipt: preview }));
  assert.throws(() => makeStaged({ spec, by: 'x', receipt: { kind: 'none', reason: ' ' } }), /needs a reason/);
  assert.equal(makeStaged({ spec, by: 'x', receipt: { kind: 'none', reason: 'preview not merged yet' } }).receipt.kind, 'none');
});

test('parseStaged refuses a file without a receipt, a mismatched pand, a bad date', () => {
  const s = JSON.parse(JSON.stringify(makeStaged({ spec, by: 'x', receipt: preview })));
  assert.throws(() => parseStaged({ ...s, receipt: undefined }), /no receipt/);
  assert.throws(() => parseStaged({ ...s, pandId: '0363100012000000' }), /does not match/);
  assert.throws(() => parseStaged({ ...s, stagedAt: 'yesterday' }), /not a date/);
  assert.throws(() => parseStaged({ ...s, receipt: { ...preview, comparePath: '' } }), /incomplete/);
});

test('verdictOf reads either spelling', () => {
  assert.equal(verdictOf({ verdict: 'WARN' }), 'WARN');
  assert.equal(verdictOf({ likeness: { verdict: 'FAIL' } }), 'FAIL');
  assert.equal(verdictOf({}), null);
});
