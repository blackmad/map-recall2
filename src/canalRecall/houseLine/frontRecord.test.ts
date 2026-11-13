// Front records (lane 2 of the Haarlemmerdijk plan): the committed table validates, is up to date with its reads, and
// pins the five spots the user named.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {frontIoU, rowScore, tracedFronts} from './windowCorrespondence.ts';
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

test('the 2-58 traces: one opening row per storey, HD14 has its oriel and 4 storeys, every trace has an outline', () => {
  const traced = tracedFronts(table, 'haarlemmerdijk-2-58');
  assert.ok(traced.length >= 14, `${traced.length} traced fronts`);
  const traced117 = tracedFronts(table, 'haarlemmerdijk-117-143');
  assert.ok(traced117.length >= 13, `${traced117.length} traced fronts on 117-143`);
  const traced13 = tracedFronts(table, 'haarlemmerdijk-13-45');
  assert.ok(traced13.length >= 13, `${traced13.length} traced fronts on 13-45`);
  for (const t of [...traced, ...traced117, ...traced13]) {
    assert.equal(t.front.trace!.storeys.length, t.front.storeys, t.key);
    assert.ok(t.front.trace!.outline.length >= 3, t.key);
    assert.ok(t.openings.every(o => o.w > 0 && o.h > 0 && o.x >= -0.2 && o.x + o.w <= t.box.x1 + 0.2), t.key);
  }
  const hd14 = rec('0363100012176104');
  assert.equal(hd14.storeys, 4);
  assert.ok(hd14.trace!.storeys.slice(1).flat().some(o => o.kind === 'oriel'));
  assert.ok(hd14.trace!.fascia?.hex?.startsWith('#'));
  // a broken trace is caught: wrong storey count and a negative width
  const bad = structuredClone(hd14); bad.trace!.storeys.pop(); bad.trace!.storeys[0][0].w = -1;
  const p = frontRecordProblems(bad);
  assert.ok(p.some(x => x.includes('trace')), p.join('; '));
});

test('the 2-58 registration drift: spans 0-3 are registered at 0 and traced in x from the 2022-06-22 capture; no misplaced mission', async () => {
  const {STRIP_SPAN_SHIFT_M, shiftFor} = await import('../../../scripts/front-records/strip-shift.ts');
  // Lane 3 (2026-11-13): mission TMX7316010203-001900 (2020-08-31) is misplaced (recorded 9.4 m from the even-side fronts,
  // taken from about 5.7 m). No strip behind these records may use it.
  for (const face of new Set(table.records.map(r => r.face))) {
    const strip = JSON.parse(readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8'));
    for (const sp of strip.spans) for (const p of sp.panoramas) assert.ok(!p.panoId.startsWith('TMX7316010203-001900'), `${face} ${sp.pandId} uses ${p.panoId}`);
  }
  // The 2022-12-15 strip (mission 002859) ghosts HD58/56, 54, 52 and 50 and stands them at 0, not the face's +0.6 m; the
  // 2022-06-22 capture (mission 002620, its strip geometry kept as evidence) puts them on their BAG spans at 0.
  const recapture = JSON.parse(readFileSync(path.join(ROOT, 'data/front-records/evidence/haarlemmerdijk-2-58-20220622.strip.json'), 'utf8'));
  assert.equal(recapture.date, '2022-06-22');
  assert.ok(recapture.spans.every((sp: {panoramas: {panoId: string}[]}) => sp.panoramas.every(p => /^TMX7316010203-00(2619|2620)_/.test(p.panoId))));
  const drift = ['0363100012177585', '0363100012177584', '0363100012177590', '0363100012176280'];
  for (const id of drift) assert.equal(shiftFor('haarlemmerdijk-2-58', id), 0, id);
  assert.equal(shiftFor('haarlemmerdijk-2-58', '0363100012167819'), 0.6);
  assert.equal(Object.keys(STRIP_SPAN_SHIFT_M['haarlemmerdijk-2-58']).length, drift.length);
  const keys = ['0363100012177585#0', '0363100012177585#1', '0363100012177584', '0363100012177590', '0363100012176280'];
  for (const t of tracedFronts(table, 'haarlemmerdijk-2-58').filter(t => keys.includes(t.key))) assert.match(t.front.trace!.source.ref ?? '', /2022-06-22/, t.key);
  // HD58/HD56 split where the re-capture shows it; HD54/52/50 have three single windows per storey, not ghosted doubles.
  const hd56 = rec('0363100012177585');
  assert.equal(hd56.fronts![0].to, 4.7);
  for (const id of ['0363100012177584', '0363100012177590', '0363100012176280']) assert.equal(rec(id).trace!.storeys[1].length, 3, id);
});

test('window IoU: identical boxes score 1, disjoint 0, half-shifted 1/3; the row aggregate is sum of intersections over sum of unions', () => {
  const box = {x0: 0, x1: 4, y0: 0, y1: 4}, a = [{x: 1, w: 1, y: 1, h: 2}];
  assert.equal(frontIoU(a, a, box).iou, 1);
  assert.equal(frontIoU(a, [{x: 3, w: 1, y: 1, h: 2}], box).iou, 0);
  assert.ok(Math.abs(frontIoU(a, [{x: 1.5, w: 1, y: 1, h: 2}], box).iou - 1 / 3) < 0.01);
  const fronts = tracedFronts(table, 'haarlemmerdijk-2-58');
  const exact = rowScore(table, 'haarlemmerdijk-2-58', key => fronts.find(t => t.key === key)!.openings);
  assert.ok(exact.frontsScored >= 14 && Math.abs(exact.aggregate - 1) < 1e-9, `${exact.aggregate}`);
  assert.equal(rowScore(table, 'haarlemmerdijk-2-58', () => []).aggregate, 0);
});
