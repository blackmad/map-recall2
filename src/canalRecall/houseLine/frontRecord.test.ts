// Front records (lane 2 of the Haarlemmerdijk plan): the committed table validates, is up to date with its reads, and
// pins the five spots the user named.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {frontRecordProblems, frontTableProblems, type FrontRecord, type FrontRecordTable} from './frontRecord.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const table: FrontRecordTable = JSON.parse(readFileSync(path.join(ROOT, 'data/front-records/haarlemmerdijk-block.json'), 'utf8'));
const rec = (pandId: string) => table.records.find(r => r.pandId === pandId)!;

test('the committed table validates', () => {
  assert.deepEqual(frontTableProblems(table), []);
  assert.ok(table.records.length >= 60);
});

test('the committed table is what the builder makes from the reads', () => {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/front-records/build-haarlemmerdijk-block.ts', '--check'], {cwd: ROOT, stdio: 'pipe'});
});

test('every low or unmeasured record falls back to the row line, and only those', () => {
  for (const r of table.records) assert.equal(r.fallback === 'row-line', r.confidence === 'low' || r.frontTopM === null, r.pandId);
});

test('named spots (user rejection of the belt-20261113 sheet)', () => {
  // Haarlemmerdijk 123: three storeys under a white cornice at 10.35 m with a box dormer; the hand spec drew four storeys on 12.9 m.
  const h123 = rec('0363100012165073');
  assert.equal(h123.storeys, 3); assert.equal(h123.frontTopM, 10.35); assert.equal(h123.crown.family, 'straight-cornice'); assert.equal(h123.bays, 2);
  assert.ok(h123.conflicts.some(c => c.field === 'storeys' && c.other.value === 4));
  // Haarlemmerdijk 143: two storeys under a wide bell gable from 8.7 m.
  const h143 = rec('0363100012169539');
  assert.equal(h143.storeys, 2); assert.equal(h143.crown.family, 'bell'); assert.equal(h143.frontTopM, 8.7);
  // Haarlemmerdijk 16: flat cornice at 11.6 m, read twice.
  const h16 = rec('0363100012167816');
  assert.equal(h16.crown.family, 'straight-cornice'); assert.equal(h16.frontTopM, 11.6); assert.equal(h16.confidence, 'high');
  // Haarlemmerdijk 20: neck gable from 10.2 m, 1.55 m neck.
  const h20 = rec('0363100012167818');
  assert.equal(h20.crown.family, 'neck'); assert.equal(h20.frontTopM, 10.2); assert.equal(h20.crown.neckWidthM, 1.55);
  // Haarlemmerstraat 54: neck gable from 12.85 m with a hoist door, four storeys.
  const h54 = rec('0363100012171144');
  assert.equal(h54.crown.family, 'neck'); assert.equal(h54.storeys, 4); assert.equal(h54.crown.hoist, true); assert.equal(h54.confidence, 'high');
});

test('the validator rejects what the renderer cannot use', () => {
  const base: FrontRecord = structuredClone(rec('0363100012167816'));
  assert.deepEqual(frontRecordProblems(base), []);
  const bad = (f: (r: FrontRecord) => void) => { const r = structuredClone(base); f(r); return frontRecordProblems(r); };
  assert.ok(bad(r => { r.confidence = 'low'; }).some(p => p.includes('fallback')));
  assert.ok(bad(r => { r.rows[0].headM = r.rows[0].sillM - 1; }).some(p => p.includes('head must be above sill')));
  assert.ok(bad(r => { r.storeys = 4; }).some(p => p.includes('rows for 4 storeys')));
  assert.ok(bad(r => { r.crown.family = 'gothic' as never; }).some(p => p.includes('crown.family')));
  assert.ok(bad(r => { r.frontTopKind = null; }).some(p => p.includes('both be set')));
  assert.ok(bad(r => { r.sources = r.sources.filter(s => s.field !== 'frontTopM'); }).some(p => p.includes('no source')));
});
