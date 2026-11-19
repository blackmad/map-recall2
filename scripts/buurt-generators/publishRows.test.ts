import test from 'node:test';
import assert from 'node:assert/strict';
import { recordsOfRows, rowOfRecord } from './publishRows.ts';

const rec = (pandId: string, series?: string) => ({ pandId, ...(series ? { series: { id: series } } : {}) });
const staged = [rec('1', 'legmeerplein-095655:s0'), rec('2', 'legmeerplein-095655:s1'), rec('3', 'aalsmeerweg-073886:s0'), rec('4', 'heemstedestraat-129033:s0'), rec('5')];

test('rowOfRecord: the series id row part; none without a series id', () => {
  assert.equal(rowOfRecord(staged[1]), 'legmeerplein-095655');
  assert.equal(rowOfRecord(staged[4]), null);
});
test('recordsOfRows: only the named rows, in staged order; an unknown row throws', () => {
  assert.deepEqual(recordsOfRows(staged, ['aalsmeerweg-073886', 'legmeerplein-095655']).map(r => r.pandId), ['1', '2', '3']);
  assert.throws(() => recordsOfRows(staged, ['legmeerplein-095655', 'legmeerplein-999999']), /legmeerplein-999999/);
});
