import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCorniceStep, checkExtras, checkFieldsAccounted, checkNoHashRoof, checkOneDesign, checkRow, runRegressions, type RowCheckMember, type RowCheckRow } from './rowChecks.ts';

const mem = (pandId: string, over: Partial<RowCheckMember> = {}): RowCheckMember => ({
  key: pandId, pandId, numbers: [], series: 'A', design: { storeys: 4, bays: 3, head: 'dentil', wall: 'red-brown', groundUse: 'shop' },
  corniceM: 14.2, roof: { kind: 'mansard', source: 'series', dormers: 1, dormerKind: 'gabled', gable: null }, extras: [], fields: { storeys: { fate: 'drawn' } }, staged: true, ...over });
const row = (members: RowCheckMember[]): RowCheckRow => ({ row: 'fixture', members });

test('one design: per-house fields may differ, others may not', () => {
  const ok = row([mem('1'), mem('2', { design: { storeys: 4, bays: 3, head: 'dentil', wall: 'red-brown', groundUse: 'cafe' } })]);
  assert.deepEqual(checkOneDesign(ok), []);
  const bad = row([mem('1'), mem('2'), mem('3', { design: { storeys: 4, bays: 3, head: 'flat', wall: 'tan', groundUse: 'shop' } })]);
  const f = checkOneDesign(bad);
  assert.deepEqual(f.map(x => x.key), ['3', '3']);
  assert.match(f.map(x => x.message).join(), /head.*wall|wall.*head/);
});

test('cornice step: 0.2 m inside a series, free across a series boundary', () => {
  assert.equal(checkCorniceStep(row([mem('1', { corniceM: 14.2 }), mem('2', { corniceM: 14.39 })])).length, 0);
  assert.equal(checkCorniceStep(row([mem('1', { corniceM: 14.2 }), mem('2', { corniceM: 16.9 })])).length, 1);
  assert.equal(checkCorniceStep(row([mem('1', { corniceM: 14.2 }), mem('2', { corniceM: 16.9, series: 'B' })])).length, 0);
});

test('extras: only the allow-list and what the type states', () => {
  assert.equal(checkExtras(row([mem('1', { extras: ['iron-balconies'] })]), ['cornice']).length, 1);
  assert.equal(checkExtras(row([mem('1', { extras: ['iron-balconies'], statedExtras: ['iron-balconies'] })]), ['cornice']).length, 0);
});

test('hash roof and unaccounted fields are findings', () => {
  assert.equal(checkNoHashRoof(row([mem('1', { roof: { kind: 'pitched', source: 'hash' } })])).length, 1);
  assert.equal(checkFieldsAccounted(row([mem('1', { fields: { dormers: { fate: 'reported' } } })])).length, 1);
  assert.equal(checkFieldsAccounted(row([mem('1', { fields: { dormers: { fate: 'reported', reason: 'no renderer' } } })])).length, 0);
  assert.deepEqual(checkRow(row([mem('1'), mem('2')])), []);
});

test('named regressions: no records, pass and fail', () => {
  assert.ok(runRegressions([]).every(r => r.status === 'no-records'));
  const good = row([
    mem('0363100012236027#0', { pandId: '0363100012236027' }), mem('0363100012236027#1', { pandId: '0363100012236027' }),
    mem('0363100012159635'), mem('0363100012152925'), mem('0363100012160809'),
    mem('0363100012236213', { staged: false, fields: {} }),
    mem('0363100012169016', { series: 'W' }),
  ]);
  assert.deepEqual(runRegressions([good]).map(r => r.status), ['pass', 'pass', 'pass', 'pass']);
  const bad = row([
    mem('0363100012236027'),
    mem('0363100012159635'), mem('0363100012152925', { corniceM: 16.9 }), mem('0363100012160809'),
    mem('0363100012236213'),
    mem('0363100012169016', { roof: { kind: 'pitched', source: 'hash', gable: 'step' } }),
  ]);
  assert.deepEqual(runRegressions([bad]).map(r => r.status), ['fail', 'fail', 'fail', 'fail']);
});
