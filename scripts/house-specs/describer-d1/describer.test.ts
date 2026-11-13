import test from 'node:test';
import assert from 'node:assert/strict';
import { answerProblems, toSpecPart, upperHead, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { compare, confusion, readingOf, tabulate, windowFamily, wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { specProblems } from '../../../src/canalRecall/houseSpec/spec.ts';
import { benchmarkReading, doorPosition, handSetReading, handSpecReading } from './truth.ts';
import { columnOf, pooledTruth } from './score.ts';

const answer = (over: Partial<DescriberAnswer> = {}): DescriberAnswer => ({
  v: 1, pandId: '0363100012176272', image: { ref: 'source-data://pand-crops/0363100012176272/front.jpg', kind: 'crop', tier: 'good', year: 2023, gate: 'pass' },
  reader: 'test', readable: true, extent: 'single', storeys: 4, bays: 3, windows: 'sash-6-over-6', heads: ['flat', 'segmental', 'segmental', 'segmental'],
  bands: 'speklagen', windowSurround: 'none', sills: 'stone', doorBay: 'left', doorIndex: 0, groundBays: 3, ground: 'dwelling', basement: 'none',
  crown: 'neck', cornice: 'none', wallFamily: 'red-brown', finish: 'brick', gaps: [], ...over,
});

test('answerProblems: a full answer is valid; not-visible is allowed everywhere; bad enums and head lengths are named', () => {
  assert.deepEqual(answerProblems(answer()), []);
  assert.deepEqual(answerProblems(answer({ storeys: 'not-visible', crown: 'not-visible', heads: [] })), []);
  const p = answerProblems({ ...answer(), crown: 'dome', heads: ['flat'], gaps: ['x'] });
  assert.ok(p.some(x => x.startsWith('crown')) && p.some(x => x.startsWith('heads')) && p.some(x => x.startsWith('gaps')), p.join('\n'));
  assert.ok(answerProblems({ ...answer(), storeys: 'unknown' }).some(x => x.startsWith('storeys')), 'the word is not-visible, not unknown');
});

test('upperHead and windowFamily', () => {
  assert.equal(upperHead(['flat', 'segmental', 'segmental']), 'segmental');
  assert.equal(upperHead(['flat', 'round', 'segmental']), 'mixed');
  assert.equal(upperHead(['flat', 'not-visible']), 'not-visible');
  assert.equal(windowFamily('sash-6-over-6'), 'sash');
  assert.equal(windowFamily('t-window'), 'T-window');
  assert.equal(windowFamily('casement-toplight'), 'T-window');
  assert.equal(windowFamily('casement-pair'), 'casement');
  assert.equal(windowFamily('plain'), 'large-pane');
});

test('compare: exact enums, counts exact and within one, a list of acceptable values, not-visible never scored', () => {
  const a = readingOf(answer({ storeys: 5, wallFamily: 'brown', crown: 'not-visible' }));
  const t = { pandId: 'x', storeys: 4, bays: 3, wallFamily: ['brown', 'dark'], crown: 'neck', head: 'segmental' };
  const cells = compare(a, t);
  const get = (f: string) => cells.find(c => c.field === f);
  assert.equal(get('storeys')!.ok, false);
  assert.equal(get('storeys±1')!.ok, true);
  assert.equal(get('bays')!.ok, true);
  assert.equal(get('wallFamily')!.ok, true);
  assert.equal(get('head')!.ok, true);
  assert.equal(get('crown'), undefined);
  const tab = tabulate(cells).find(r => r.field === 'storeys±1')!;
  assert.equal(tab.acc, 1); assert.equal(tab.n, 1);
  assert.deepEqual(confusion(cells, 'storeys'), { 4: { 5: 1 } });
});

test('compare works answer vs answer (photo vs game): symmetric agreement', () => {
  const a = readingOf(answer()), b = readingOf(answer({ bays: 4, finish: 'stucco' }));
  const ab = compare(a, b), ba = compare(b, a);
  assert.equal(ab.length, ba.length);
  assert.deepEqual(ab.map(c => c.ok), ba.map(c => c.ok));
  assert.equal(ab.find(c => c.field === 'bays')!.ok, false);
  assert.equal(ab.find(c => c.field === 'bays±1')!.ok, true);
});

test('wilson matches the agreement.ts interval', () => {
  assert.deepEqual(wilson(8, 10), [0.49, 0.943]);
  assert.deepEqual(wilson(0, 0), [0, 1]);
});

test('truth readers: benchmark, hand set, hand spec', () => {
  const b = benchmarkReading({ pandId: 'p', readable: true, labels: { storeys: 4, columns: [2, 3, 3, 2], windowKind: 'T-window', windowHead: 'flat', whiteAccents: { bands: false, surrounds: false, keystones: true }, doorBay: 'unknown', shopfront: true, crown: 'cornice', cornice: 'timber', finish: 'render', wallTone: { family: 'orange-red' } } });
  assert.equal(b.bays, 3); assert.equal(b.surrounds, true); assert.equal(b.doorBay, undefined); assert.equal(b.finish, 'stucco');
  assert.deepEqual(b.wallFamily, ['orange', 'red']); assert.deepEqual(b.cornice, ['simple', 'bracketed', 'heavy', 'frieze']);
  const h = handSetReading({ pandId: 'p', readable: true, extent: 'single', fields: { axes: { value: 3 }, gable: { value: 'unknown' }, pui: { value: 'shop' } } });
  assert.equal(h.bays, 3); assert.equal(h.crown, undefined); assert.equal(h.shop, true);
  const prov = { source: 'author' as const, confidence: 1, ref: 'x', at: null };
  const s = handSpecReading({ schemaVersion: 1, pandId: '0363100012176272', design: { fronts: [{ storeys: 4, bays: [3, 3, 3, 3], gable: 'neck', windows: 'sash', doorBay: 2, basement: 'none', windowSurround: 'sill', cornice: 'none' }] }, provenance: { 'fronts/0': prov } } as any);
  assert.equal(s.bays, 3); assert.equal(s.doorBay, 'right'); assert.equal(s.bands, false); assert.equal(s.shop, false); assert.equal(s.surrounds, false); assert.deepEqual(s.sills, ['stone', 'consoles']);
  const measured = handSpecReading({ schemaVersion: 1, pandId: '0363100012176272', design: { fronts: [{ storeys: 4 }] }, provenance: { 'fronts/0/storeys': { ...prov, source: 'streetlevel-measured' } } } as any);
  assert.equal(measured.storeys, undefined, 'a measured field is not hand truth');
});

test('doorPosition', () => {
  assert.equal(doorPosition(0, 3), 'left'); assert.equal(doorPosition(1, 3), 'centre'); assert.equal(doorPosition(2, 3), 'right');
  assert.equal(doorPosition(1, 4), 'left'); assert.equal(doorPosition(null, 3), 'none'); assert.equal(doorPosition(0, 1), 'centre');
  assert.equal(doorPosition(0, 3, true), 'several');
});

test('pooledTruth takes each field from the first set that states it; columnOf splits gate pass/fail', () => {
  const t = pooledTruth(new Map([['hand-spec', { pandId: 'p', storeys: 5, crown: 'bell' }], ['benchmark', { pandId: 'p', storeys: 4 }]]))!;
  assert.equal(t.storeys, 4); assert.equal(t.crown, 'bell');
  assert.equal(pooledTruth(new Map([['hand-set', { pandId: 'p', scorable: false, storeys: 3 }]])), null);
  assert.equal(columnOf(answer()), 'crop-gate-pass');
  assert.equal(columnOf(answer({ image: { ref: 'r', kind: 'crop', gate: 'fail' } })), 'crop-gate-fail');
  assert.equal(columnOf(answer({ image: { ref: 'r', kind: 'render' } })), 'render');
});

test('toSpecPart: a valid partial HouseSpec at vision-judge; stone and pitched-eaves go to schemaLimits', () => {
  const s = toSpecPart(answer({ crown: 'mansard', finish: 'stone' }));
  assert.deepEqual(specProblems(s), []);
  assert.equal((s.design.fronts![0] as any).roofFront, 'mansard');
  assert.ok(s.schemaLimits!.some(l => l.component === 'wallMaterial'));
  assert.equal(s.provenance['fronts/0/storeys'].source, 'vision-judge');
  assert.deepEqual(specProblems(toSpecPart(answer({ crown: 'pitched-eaves', readable: true }))), []);
});

test('twins: side from the wall normal, mirrored door indices, per-side precision/recall', async () => {
  const { sideOf, adjacent, mirroredOf, scoreTwins } = await import('./twins.ts');
  const me = { a: [0, 0] as [number, number], b: [0, 10] as [number, number], normal: [1, 0] as [number, number] }; // faces east: viewer looks west, north is right
  const north = { a: [0, 10] as [number, number], b: [0, 16] as [number, number], normal: [1, 0] as [number, number] };
  assert.equal(sideOf(me, north), 'right');
  assert.equal(adjacent(me, north), true);
  assert.equal(mirroredOf({ doorBay: 0, bays: [3, 3] }, { doorBay: 2, bays: [3, 3] }), true);
  assert.equal(mirroredOf({ doorBay: 0, bays: [3, 3] }, { doorBay: 0, bays: [3, 3] }), false);
  assert.equal(mirroredOf({ doorBay: null, bays: 3 }, { doorBay: 0, bays: 3 }), undefined);
  const rows = [
    { pandId: 'a', left: { id: 'x', twin: true }, right: { id: 'y', twin: false }, mirrored: true, image: '' },
    { pandId: 'b', left: null, right: { id: 'z', twin: false }, mirrored: null, image: '' },
  ];
  const s = scoreTwins(rows, new Map([['a', { readable: true, sameAs: 'left', mirrored: true }], ['b', { readable: true, sameAs: 'right', mirrored: false }]] as any));
  assert.deepEqual([s.sides, s.tp, s.fp, s.fn], [3, 1, 1, 0]);
  assert.equal(s.precision, 0.5); assert.equal(s.recall, 1); assert.equal(s.mirrored.acc, 1);
});
