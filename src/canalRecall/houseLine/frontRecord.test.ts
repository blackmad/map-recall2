// Front records (lane 2 of the Haarlemmerdijk plan): the committed table validates, is up to date with its reads, and
// pins the five spots the user named.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {frontRecordProblems, frontTableProblems, heightAbovePandGround, heightAboveStreet, type FrontRecord, type FrontRecordTable} from './frontRecord.ts';

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

test('datum: heights are above the street; the helper moves them to the pand ground and back', () => {
  for (const r of table.records) assert.equal(r.datum, 'street');
  const h131 = rec('0363100012173479'); // pand ground 1.57 m NAP on a 1.04 m street
  assert.equal(heightAbovePandGround(h131, h131.frontTopM!), 9.37);
  assert.equal(heightAboveStreet(h131, heightAbovePandGround(h131, 9.9)), 9.9);
});

test('walls: measured on the strip, reviewed where a read agrees (reviewer pins 2026-11-13)', () => {
  const h10 = rec('0363100012176102'), h8 = rec('0363100012176101'), h16 = rec('0363100012167816');
  assert.equal(h10.wall.finish, 'plaster'); assert.equal(h10.wall.source, 'reviewed');
  assert.ok(h10.wall.hex && parseInt(h10.wall.hex.slice(1, 3), 16) > 0x90, 'Haarlemmerdijk 10 reads pale (cream stucco)');
  assert.equal(h8.wall.finish, 'plaster');
  assert.equal(h16.wall.finish, 'brick');
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h16.wall.hex!.slice(i, i + 2), 16));
  assert.ok(r > g && r > b && r < 0x70, 'Haarlemmerdijk 16 is dark red brick');
  assert.ok(table.records.filter(x => x.wall.hex).length >= 100);
});

test('multi-front pands: Haarlemmerdijk 22/24 is two fronts (David, four-way strip 2026-11-13)', () => {
  const h22 = rec('0363100012167819');
  assert.equal(h22.fronts?.length, 2);
  const [left, right] = h22.fronts!;
  // Party wall 3.95 m along the span from its left end. 24 (left): cornice, ornate raised top, shop in a grey render
  // surround. 22 (right): crowned dormer over a white cornice, white arched shopfront.
  assert.equal(left.to, 3.95); assert.equal(right.from, 3.95);
  assert.equal(left.crown.family, 'other'); assert.equal(left.frontTopM, 12.3); assert.ok(left.crown.topM! >= 14);
  assert.equal(right.crown.family, 'straight-cornice'); assert.equal(right.crown.dormer?.kind, 'crowned'); assert.equal(right.frontTopM, 13.25);
  assert.deepEqual(left.addresses, ['Haarlemmerdijk 24']); assert.deepEqual(right.addresses, ['Haarlemmerdijk 22']);
  for (const f of h22.fronts!) assert.ok(f.wall.hex, 'each front has its own measured wall');
  // Every split pand: sub-fronts tile the span, each with its own confidence.
  const split = table.records.filter(r => r.fronts);
  assert.ok(split.length >= 15);
  for (const r of split) assert.ok(r.fronts!.every(f => ['high', 'medium', 'low'].includes(f.confidence)));
  // The validator catches a gap between sub-fronts.
  const bad = structuredClone(h22); bad.fronts![1].from = 4.5;
  assert.ok(frontRecordProblems(bad).some(p => p.includes('does not meet')));
});
