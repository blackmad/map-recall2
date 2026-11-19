import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { joinDesignUnits, type NamedStreet } from './join.ts';
import { REGRESSION_ROWS } from './regressionRows.ts';
import { segmentLookup, segmentsOf, splitRuns, SEGMENTS_SCHEMA, type MemberHeights } from './segments.ts';
import type { DesignUnit, OrdekaartObject, UnitPand } from './types.ts';

const dir = path.join(import.meta.dirname, 'fixtures');
const fixture = JSON.parse(fs.readFileSync(path.join(dir, 'regression-rows.json'), 'utf8')) as { pands: UnitPand[]; objects: OrdekaartObject[]; streets: NamedStreet[] };
const ahn = JSON.parse(fs.readFileSync(path.join(dir, 'regression-ahn.json'), 'utf8')).p90 as Record<string, number | null>;
const res = joinDesignUnits({ pands: fixture.pands, objects: fixture.objects, streets: fixture.streets });
const units = new Map(res.units.map(u => [u.id, u]));
const heights = new Map<string, MemberHeights>(fixture.pands.map(p => [p.id, { ahnM: ahn[p.id] ?? null, bagEavesM: p.eavesM }]));
const row = (name: string) => REGRESSION_ROWS.find(r => r.name === name)!;
const segsOfRow = (name: string) => row(name).units.flatMap(u => segmentsOf(units.get(res.unitOf.get(u[0])!)!, heights));

test('Rustenburgerstraat: three segments, one per design (Stork, Oostveen, Vlaanderen)', () => {
  const segs = segsOfRow('Rustenburgerstraat');
  assert.equal(segs.length, 3);
  row('Rustenburgerstraat').units.forEach((u, k) => assert.ok(u.every(p => segs[k].members.includes(p))));
  for (const s of segs) assert.equal(s.eavesSource, 'ahn');
});

test('Van Ostadestraat: four segments; 153176 and 158962 one line on AHN although 3DBAG reads 18.2 against 15.4 m', () => {
  const segs = segsOfRow('Van Ostadestraat');
  assert.equal(segs.length, 4);
  row('Van Ostadestraat').units.forEach((u, k) => assert.ok(u.every(p => segs[k].members.includes(p)), `segment ${k}`));
  const s = segs.find(x => x.members.includes('0363100012153176'))!;
  assert.ok(s.members.includes('0363100012158962'));
  assert.equal(s.exceptions.length, 0);
});

test('Marnixplein (Centrum layer, expectation for when it is switched on): the three photographed fronts are one segment', () => {
  const segs = segsOfRow('Marnixplein');
  const s = segs.find(x => x.members.includes('0363100012168305'))!;
  for (const p of row('Marnixplein').units[0]) assert.ok(s.members.includes(p), p);
  assert.ok(s.eavesM! > 12.5 && s.eavesM! < 13.5, `line ${s.eavesM}`);
});

test('Goudsbloemstraat: the equal-height run is one segment; 172514 (3 m taller in 3DBAG) reads level on AHN and in the photo', () => {
  const segs = segsOfRow('Goudsbloemstraat');
  assert.equal(segs.length, 1);
  assert.ok(segs[0].members.includes('0363100012172514'));
  assert.deepEqual(segs[0].exceptions, []);
});

test('a lone member stepping out under a storey is an exception clamped to the line, not a segment', () => {
  const h = new Map<string, MemberHeights>([['a', 14], ['b', 14.2], ['c', 15.6], ['d', 14.1], ['e', 14]].map(([k, v]) => [k as string, { ahnM: v as number, bagEavesM: null }]));
  assert.deepEqual(splitRuns(['a', 'b', 'c', 'd', 'e'], h), [['a', 'b', 'c', 'd', 'e']]);
  const u: DesignUnit = { id: 'du:ring:1', seed: 'du:ring:1', source: 'ordekaart', members: ['a', 'b', 'c', 'd', 'e'], faces: [{ street: 'S', lengthM: 25, slices: ['a', 'b', 'c', 'd', 'e'].map((p, i) => ({ pandId: p, fromM: i * 5, toM: i * 5 + 5 })) }], unfronted: [], family: { architectNr: null, year: null, moduleM: 5 }, familyKey: '?/?/5', flags: [] };
  const [s] = segmentsOf(u, h);
  assert.equal(s.eavesM, 14.05);
  assert.deepEqual(s.exceptions.map(e => e.pandId), ['c']);
  assert.equal(s.seed, 'du:ring:1');
  // A storey or more off (a low shop wing, a tower): it leaves the segment and draws alone, as today.
  const h2 = new Map(h); h2.set('c', { ahnM: 4.5, bagEavesM: null });
  const segs = segmentsOf(u, h2);
  assert.deepEqual(segs.map(x => [x.id, x.members.join()]), [['du:ring:1#0', 'a,b,d,e'], ['c', 'c']]);
  assert.equal(segs[1].seed, 'c');
  assert.deepEqual(segs[0].exceptions, []);
});

test('a step of a storey that holds on both sides splits the unit; seeds are per segment, a one-pand segment keeps its pand id', () => {
  const h = new Map<string, MemberHeights>([['a', 12], ['b', 12.1], ['c', 15.2], ['d', 15.3], ['e', 9]].map(([k, v]) => [k as string, { ahnM: v as number, bagEavesM: null }]));
  assert.deepEqual(splitRuns(['a', 'b', 'c', 'd', 'e'], h), [['a', 'b'], ['c', 'd', 'e']]);
  const u: DesignUnit = { id: 'du:ring:2', seed: 'du:ring:2', source: 'ordekaart', members: ['a', 'b', 'c', 'd'], faces: [{ street: 'S', lengthM: 20, slices: ['a', 'b', 'c', 'd'].map((p, i) => ({ pandId: p, fromM: i * 5, toM: i * 5 + 5 })) }], unfronted: [], family: { architectNr: null, year: null, moduleM: 5 }, familyKey: '?/?/5', flags: [] };
  const segs = segmentsOf(u, h);
  assert.deepEqual(segs.map(s => [s.id, s.seed, s.members.join()]), [['du:ring:2#0', 'du:ring:2#0', 'a,b'], ['du:ring:2#1', 'du:ring:2#1', 'c,d']]);
  assert.deepEqual(segs[1].slices.map(s => [s.fromM, s.toM]), [[0, 5], [5, 10]], 'slices restart at each segment');
  const one = segmentsOf({ ...u, members: ['a'], faces: [{ street: 'S', lengthM: 5, slices: [{ pandId: 'a', fromM: 0, toM: 5 }] }] }, h);
  assert.equal(one[0].seed, 'a');
  const look = segmentLookup({ schema: SEGMENTS_SCHEMA, layers: ['ring'], generatedAt: '', source: '', segments: segs });
  assert.equal(look.get('c')!.segment.id, 'du:ring:2#1');
});
