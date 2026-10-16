/**
 * Row coherence (blockFace/rowCoherence.ts; user, 2026-10-16: "you probably could have guessed that one house here
 * isn't higher than the rest"). The Kinkerstraat 315-359 regression: the lane had hand-measured eight pands whose
 * LoD2.2 eaves read 2.2-2.5 m above the row's cornice (the flat top of the mansard); the row rule reproduces that set
 * from the 3DBAG facts alone, and caps Kinkerstraat 359 (155496), whose 3DBAG roof max stood 0.9 m over the row ridge.
 *   node --import tsx --test src/canalRecall/blockFace/rowCoherence.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {loadGoldenFace} from '../../../scripts/block-face/roof-golden.ts';
import {clampRoofVertices, findRows, rowClampFor, rowLines, type RowMember} from './rowCoherence.ts';

const member = (i: number, eavesM: number, extra: Partial<RowMember> = {}): RowMember => ({i, pandId: `p${i}`, eavesM, ridgeM: 16, roofMaxM: 16, ...extra});

test('findRows: consecutive houses of one type within two years of the modal year, three or more', () => {
  const h = (typeId: string | undefined, builtYear: number | null) => ({pandId: 'x', typeId, builtYear});
  assert.deepEqual(findRows([h('a', 1903), h('a', 1903), h('a', 1904), h('b', 1903), h('a', 1903), h('a', 1903)]), [[0, 1, 2]]);
  assert.deepEqual(findRows([h('a', 1903), h('a', 1987), h('a', 1903), h('a', 1903)]), [[0, 2, 3]]);
  assert.deepEqual(findRows([h('a', 1903), h(undefined, 1903), h('a', 1903), h('a', 1903)]), []);
  assert.deepEqual(findRows([h('a', null), h('a', 1903), h('a', 1903), h('a', 1903)]), [[1, 2, 3]]);
});

test('rowLines: the lower of two comparable eaves groups is the cornice; strip measurements lead only as a majority', () => {
  // Twelve cornice readings spread over 1.8 m, eight flat-top readings within 0.5 m (Kinkerstraat 315-359).
  const low = [12.86, 12.95, 13.23, 13.31, 13.42, 13.49, 13.5, 13.62, 13.63, 13.8, 14.0, 14.62], high = [15.68, 15.71, 15.72, 15.74, 15.94, 15.97, 16.01, 16.01];
  const members = [...low, ...high].map((e, i) => member(i, e));
  const lines = rowLines(members);
  assert.equal(lines.eavesSource, '3dbag');
  assert.ok(Math.abs(lines.eavesM - 13.5) <= 0.1, `row line ${lines.eavesM}`);
  // One strip-measured member of eight (Kinkerstraat 224 with its attic storey) does not set the line.
  const one = [member(0, 14.0), member(1, 14.0), member(2, 13.9), member(3, 14.52, {stripEavesM: 14.52}), member(4, 12.4), member(5, 13.1), member(6, 13.4), member(7, 13.2)];
  assert.equal(rowLines(one).eavesSource, '3dbag');
  assert.ok(rowLines(one).eavesM < 14.3);
  // A measured majority is the line.
  const most = [member(0, 15.9, {stripEavesM: 13.5}), member(1, 15.9, {stripEavesM: 13.5}), member(2, 13.0), member(3, 15.9, {stripEavesM: 13.48})];
  assert.deepEqual([rowLines(most).eavesSource, rowLines(most).eavesM], ['strip', 13.5]);
  // Ridge: the median of the members' 3DBAG ridges.
  assert.equal(rowLines([member(0, 13, {ridgeM: 15.9}), member(1, 13, {ridgeM: 16.1}), member(2, 13, {ridgeM: 17.3})]).ridgeM, 16.1);
});

test('rowLines: three adjacent members agreeing with each other keep their own line (Kinkerstraat 212-220 vs 222-228)', () => {
  // Kinkerstraat 222-228 (three pands) and 212-220 (three pands, the last with three modules), 3DBAG eaves as fitted.
  const members = [member(0, 14.02), member(1, 14.01), member(2, 13.93), member(3, 12.34), member(4, 13.03), member(5, 13.38), member(6, 13.47, {frontEavesM: {m0: 13.47, m1: 13.52, m2: 12.75}})];
  const lines = rowLines(members);
  assert.ok(Math.abs(lines.eavesM - 13.4) <= 0.15, `row line ${lines.eavesM}`);
  assert.deepEqual(lines.subRows?.map(s => s.members), [[0, 1, 2]]);
  for (const m of members.slice(0, 3)) assert.equal(rowClampFor(m, lines, 'r'), null);
  // A pair is not a sub-row (Kinkerstraat 319-321: two adjacent misreads agree too).
  const pair = [member(0, 13.0), member(1, 15.9), member(2, 15.95), member(3, 13.1), member(4, 13.05)];
  assert.equal(rowLines(pair).subRows, undefined);
  assert.ok(rowClampFor(pair[1], rowLines(pair), 'r')?.eavesM);
});

test('rowClampFor: off the line by more than the threshold, unless strip-measured or confirmed by the photo skyline; ridges capped', () => {
  const lines = {eavesM: 13.5, eavesSource: '3dbag' as const, ridgeM: 16.0, cluster: []};
  assert.equal(rowClampFor(member(0, 14.2), lines, 'r'), null);
  assert.deepEqual(rowClampFor(member(0, 14.4), lines, 'r')?.eavesM, {from: 14.4, to: 13.5});
  assert.equal(rowClampFor(member(0, 15.9, {stripEavesM: 15.9}), lines, 'r'), null);
  const confirmed = rowClampFor(member(0, 15.9, {skylineEavesM: 15.7}), lines, 'r');
  assert.equal(confirmed, null);
  assert.deepEqual(rowClampFor(member(0, 15.9, {skylineEavesM: 13.6}), lines, 'r')?.eavesM, {from: 15.9, to: 13.5});
  // Per front: a module of its own reading.
  const multi = rowClampFor(member(0, 13.5, {frontEavesM: {m0: 13.5, m1: 13.49, m2: 15.72}}), lines, 'r');
  assert.deepEqual(Object.keys(multi?.fronts ?? {}), ['m2']);
  // Ridge: 0.2 m over the row ridge is capped at the ridge + 0.1.
  assert.equal(rowClampFor(member(0, 13.5, {roofMaxM: 16.15}), lines, 'r'), null);
  assert.deepEqual(rowClampFor(member(0, 13.5, {roofMaxM: 16.86}), lines, 'r')?.ridgeM, {from: 16.86, to: 16.1});
});

test('clampRoofVertices: survey vertices above the cap take the cap; heights follow; nothing above = the same object', () => {
  const facts = {heights: {groundNAP: 1, roofMaxM: 17, ridgeM: 16.5}, roofsRD: [{vertices: [[0, 0, 11], [1, 0, 18], [0, 1, 11]], ringsRD: [[[0, 0, 11], [1, 0, 18], [0, 1, 11]]], slopeDeg: 70}]} as unknown as BuildingFacts;
  const out = clampRoofVertices(facts, 16.1);
  assert.equal(out.roofsRD[0].vertices[1][2], 17.1);
  assert.equal(out.roofsRD[0].ringsRD[0][1][2], 17.1);
  assert.equal(out.heights.roofMaxM, 16.1);
  assert.equal(out.heights.ridgeM, 16.1);
  assert.equal(clampRoofVertices(facts, 17.5), facts);
});

test('Kinkerstraat 315-359: the row rule reproduces the eight hand measurements, excludes the 1987 infill, caps no. 359', () => {
  const {face, prepared} = loadGoldenFace('kinker-315-359');
  assert.equal(face.continuity.measuredEaves, undefined, 'the hand entries are gone from the intent');
  const clamps = prepared.ground.rowClamps ?? [];
  const eavesClamped = clamps.filter(c => c.eavesM).map(c => c.pandId.slice(-6)).sort();
  assert.deepEqual(eavesClamped, ['153447', '153818', '156907', '159990', '165777', '167386', '236156', '236481', '237373']);
  // Kinkerstraat 327-331 (237373): only its neck-gable module, the two dormer modules read the cornice.
  assert.deepEqual(Object.keys(clamps.find(c => c.pandId.endsWith('237373'))!.fronts!), ['m2']);
  assert.ok(!clamps.some(c => c.pandId.endsWith('080487')), 'the 1987 infill is not a row member');
  const line = clamps.find(c => c.eavesM)!.eavesM!.to;
  assert.ok(Math.abs(line - 13.5) <= 0.1, `row line ${line} vs the hand measurement 13.5`);
  for (const c of clamps) if (c.eavesM) assert.equal(c.eavesM.to, line);
  // No. 343 (153447, the bell gable): its cornice on the row line, its crown level with its neck-gable neighbour at 345 (159990).
  const facts = (id: string) => prepared.ground.facts[face.houses.findIndex(h => h.pandId.endsWith(id))];
  assert.equal(facts('153447').measuredEavesM?.front0, line);
  assert.ok(Math.abs(facts('153447').roofSource!.crownTopM! - facts('159990').roofSource!.crownTopM!) <= 0.1);
  // No. 359 (155496): 3DBAG roof max 16.31 over a row ridge of 15.96, capped at the ridge + 0.1.
  const c359 = clamps.find(c => c.pandId.endsWith('155496'))!;
  assert.ok(c359.ridgeM && c359.ridgeM.to <= 16.06 && facts('155496').heights.roofMaxM <= 16.06 + 1e-6, `no. 359 roof max ${facts('155496').heights.roofMaxM}`);
  for (const c of clamps) assert.ok(c.note.length > 0 && c.row.startsWith('kinker-1902-balcony-axis'));
  // The rule off: no clamps, the survey facts as they were.
  const off = loadGoldenFace('kinker-315-359', raw => { raw.continuity.rowCoherence = false; }).prepared;
  assert.equal(off.ground.rowClamps, undefined);
  assert.ok(off.ground.facts.every(f => !f.rowClamp));
  const f359 = off.ground.facts[face.houses.findIndex(h => h.pandId.endsWith('155496'))];
  assert.ok(f359.heights.roofMaxM > 16.2, `no. 359 keeps its LoD2.2 roof max without the rule (${f359.heights.roofMaxM})`);
});
