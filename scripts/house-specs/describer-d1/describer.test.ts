import test from 'node:test';
import assert from 'node:assert/strict';
import { answerProblems, groundKindOf, rowProblems, toSpecPart, upperHead, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { compare, confusion, readingOf, tabulate, windowFamily, wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { specProblems } from '../../../src/canalRecall/houseSpec/spec.ts';
import { benchmarkReading, doorPosition, handSetReading, handSpecReading } from './truth.ts';
import { columnOf, pooledTruth } from './score.ts';
import { inheritFromTwin, stageOne, twinGuard } from './stage.ts';

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

test('toSpecPart: a valid partial HouseSpec at vision-judge; stone, pitched-eaves and pointed/mixed heads are stored as read', () => {
  const s = toSpecPart(answer({ crown: 'mansard', finish: 'stone' }));
  assert.deepEqual(specProblems(s), []);
  assert.equal((s.design.fronts![0] as any).roofFront, 'mansard');
  assert.equal(s.design.palette!.wallMaterial, 'stone');
  assert.equal(s.schemaLimits, undefined);
  assert.equal(s.provenance['fronts/0/storeys'].source, 'vision-judge');
  const e = toSpecPart(answer({ crown: 'pitched-eaves', heads: ['flat', 'pointed', 'pointed', 'pointed'], gaps: [{ component: 'crown', what: 'a dormer' }] }));
  assert.deepEqual(specProblems(e), []);
  assert.equal(e.design.fronts![0].gable, 'pitched-eaves');
  assert.deepEqual(e.design.fronts![0].windowHead, { kind: 'pointed' });
  assert.deepEqual(e.schemaLimits, [{ component: 'crown', what: 'a dormer' }]);
  assert.deepEqual(toSpecPart(answer({ heads: ['flat', 'round', 'segmental', 'segmental'] })).design.fronts![0].windowHead, { kind: 'mixed' });
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

test('twins v2: face verdicts, door mirror, PR1 label verdicts and similarity, null sides unscored, spread pick', async () => {
  const { faceVerdict, faceMirrored, spreadPick, isPositive, isNegative } = await import('./twins-v2.ts');
  const { labelVerdict, similar, sharedM, upperColumns } = await import('./partyPairs.ts');
  const { scoreTwins } = await import('./twins.ts');
  const front = (o: Record<string, unknown> = {}) => ({ storeys: 4, bays: 3, gable: 'cornice', windows: 'cross', doorBay: 2, ...o });
  const h = (o: Record<string, unknown> = {}, module: string | null = 'type:a', widthM = 6) => ({ module, multi: false, front: front(o), widthM });
  assert.equal(faceVerdict(h(), h({ doorBay: 0 })).twin, true, 'one module, mirrored door: still twins');
  assert.equal(faceVerdict(h(), h({ storeys: 5 })).twin, false, 'storeys differ: clearly different');
  assert.equal(faceVerdict(h(), h({ bays: [2, 4, 4] })).twin, false, 'upper bays differ');
  assert.equal(faceVerdict(h(), h({}, 'type:b')).twin, null, 'other module, same core: not scored');
  assert.equal(faceVerdict(h(), h({}, 'type:a', 7)).twin, null, 'widths differ > 0.5 m: not scored');
  assert.equal(faceVerdict(h(), { ...h(), multi: true }).twin, null);
  assert.equal(faceVerdict(h(), h({ cornice: 'heavy' })).twin, null, 'same module, resolved fronts differ');
  assert.equal(faceMirrored(front(), front({ doorBay: 0 })), true);
  assert.equal(faceMirrored(front(), front()), false);
  assert.equal(faceMirrored(front({ doorBay: 1 }), front({ doorBay: 1 })), null, 'centred door: copy and mirror look alike');
  assert.equal(faceMirrored(front({ doorBay: undefined }), front()), null);

  const r = (o = {}) => ({ pandId: 'x', source: 'benchmark' as const, storeys: 4, columns: 3, crown: 'neck', windowKind: 'sash', ...o });
  assert.equal(labelVerdict(r(), r()), 'same');
  assert.equal(labelVerdict(r(), r({ storeys: 5 })), 'different');
  assert.equal(labelVerdict(r(), r({ windowKind: 'casement' })), null, 'a non-core field differs: not a twin, not clearly different');
  assert.equal(labelVerdict(r(), r({ crown: undefined })), null, 'a core field unread');
  assert.equal(labelVerdict(r(), { ...r(), source: 'spec' }), null, 'vocabularies differ across sources');
  assert.equal(upperColumns([2, 3, 3, 4]), 3);
  const p = (year: number, runM: number, exposedM: number) => ({ pandId: 'p', year, drawn: { runM, exposedM } });
  assert.equal(similar(p(1890, 6, 15), p(1893, 6.25, 15.7)), true);
  assert.equal(similar(p(1890, 6, 15), p(1894, 6, 15)), false);
  assert.equal(similar(p(1890, 6, 15), p(1890, 6.4, 15)), false);
  // two 5 m squares sharing one 5 m wall (lng/lat around Amsterdam)
  const dx = 5 / (111_320 * Math.cos(52.37 * Math.PI / 180)), dy = 5 / 110_540, o: [number, number] = [4.89, 52.37];
  const sq = (x: number) => [[o[0] + x, o[1]], [o[0] + x + dx, o[1]], [o[0] + x + dx, o[1] + dy], [o[0] + x, o[1] + dy], [o[0] + x, o[1]]];
  const sh = sharedM(sq(0), sq(dx), o);
  assert.ok(sh > 5 && sh < 5.8, `the shared wall plus 0.35 m of each meeting edge: ${sh}`);
  assert.equal(sharedM(sq(0), sq(3 * dx), o), 0);

  const rows = [
    { pandId: 'a', left: { id: 'b', twin: true }, right: { id: 'c', twin: null }, mirrored: true, image: '' },
    { pandId: 'd', left: { id: 'e', twin: false }, right: null, mirrored: null, image: '' },
  ];
  assert.ok(isPositive(rows[0]) && isNegative(rows[1]) && !isNegative(rows[0]));
  const s = scoreTwins(rows, new Map([['a', { readable: true, sameAs: 'both' as const, mirrored: true }], ['d', { readable: true, sameAs: 'left' as const, mirrored: false }]]));
  assert.deepEqual([s.sides, s.tp, s.fp, s.fn, s.mirrored.k, s.mirrored.n], [2, 1, 1, 0, 1, 1], 'the null side is not scored');
  const picked = spreadPick([{ g: 'x', i: 1 }, { g: 'x', i: 2 }, { g: 'y', i: 3 }, { g: 'x', i: 4 }], r2 => r2.g, 3, 2);
  assert.deepEqual(picked.map(x => x.i), [1, 3, 2]);
});

test('stageOne: vision-judge fields plus the measured wall colour; an unreadable answer stages an empty spec', () => {
  const s = stageOne(answer(), '#7A4A3A', '2026-11-13');
  assert.deepEqual(specProblems(s), []);
  assert.equal(s.design.palette?.brick, '#7a4a3a');
  assert.equal(s.provenance['palette/brick']?.source, 'streetlevel-measured');
  assert.equal(s.provenance['fronts/0/storeys']?.source, 'vision-judge');
  assert.equal(stageOne(answer(), 'brown', null).design.palette?.brick, undefined);
  const empty = stageOne(answer({ readable: false }), '#7a4a3a', null);
  assert.deepEqual(empty.provenance, {});
});

test('enum gaps: block dressings, attic frieze, an off-centre door and bays 0 are valid; low names answer keys only', () => {
  assert.deepEqual(answerProblems(answer({ windowSurround: 'block-dressings', cornice: 'attic-frieze', doorBay: 'off-centre', low: ['storeyParts.roof', 'crown'] })), []);
  assert.deepEqual(answerProblems(answer({ bays: 0 })), []);
  assert.equal(toSpecPart(answer({ bays: 0 })).design.fronts?.[0]?.bays, undefined, 'bays 0 is never staged');
  const s = toSpecPart(answer({ windowSurround: 'block-dressings', cornice: 'attic-frieze' }));
  assert.deepEqual(specProblems(s), []);
  assert.equal(s.design.fronts![0].windowSurround, 'block-dressings');
  assert.ok(answerProblems(answer({ low: ['roof'] })).some(p => p.startsWith('low')));
  assert.ok(answerProblems(answer({ bays: -1 })).some(p => p.startsWith('bays')));
});

test('stageOne stages only the ruled fields and classes; inheritFromTwin copies hidden fields only when the twin guard holds', () => {
  const s = stageOne(answer({ crown: 'neck', cornice: 'simple', windowSurround: 'keystone', heads: ['flat', 'round', 'round', 'round'] }), null, null);
  const f = s.design.fronts![0] as any;
  assert.equal(f.storeys, 4); assert.equal(f.bays, 3); assert.equal(f.bands, 'speklagen');
  assert.equal(f.gable, 'neck', 'a neck crown stages as a curved gable'); assert.equal(f.cornice, undefined); assert.equal(f.windowSurround, undefined);
  assert.equal(f.windowHead, undefined, 'round head is prior-only'); assert.equal(f.windows, undefined, 'window family is prior-only');
  assert.equal(f.basement, 'none', 'basement from a crop');
  assert.equal(stageOne(answer({ image: { ref: 'cut.jpg', kind: 'pose-photo' } }), null, null).design.fronts![0].basement, undefined, 'no basement from a cut');
  assert.equal(stageOne(answer({ crown: 'step' }), null, null).design.fronts![0].gable, 'step');
  assert.equal(stageOne(answer({ crown: 'mansard' }), null, null).design.fronts![0].gable, undefined, 'mansard (drawn as cornice) is prior-only');
  assert.equal(stageOne(answer({ crown: 'bell' }), null, null).design.fronts![0].gable, 'neck', 'a curved gable without a register answer stages neck');
  assert.equal(stageOne(answer({ crown: 'neck' }), null, null, 'bell').design.fronts![0].gable, 'bell', 'the register picks bell');
  assert.equal(stageOne(answer({ crown: 'bell' }), null, null, 'cornice').design.fronts![0].gable, 'neck');
  const hidden = stageOne(answer({ storeys: 'not-visible', crown: 'not-visible', heads: [], sameAs: 'left' }), null, null);
  const twin = stageOne(answer({ pandId: '0363100012176273', crown: 'cornice' }), null, null);
  assert.deepEqual(inheritFromTwin(structuredClone(hidden), answer({ sameAs: 'left' }), [{ side: 'left', id: 'x', spec: twin, guard: false }]), []);
  assert.deepEqual(inheritFromTwin(structuredClone(hidden), answer({ sameAs: 'right' }), [{ side: 'left', id: 'x', spec: twin, guard: true }]), []);
  const got = structuredClone(hidden);
  assert.deepEqual(inheritFromTwin(got, answer({ sameAs: 'left' }), [{ side: 'left', id: 'x', spec: twin, guard: true }]), ['fronts/0/storeys', 'fronts/0/gable']);
  assert.equal(got.provenance['fronts/0/storeys'].ref, 'twin:x');
  assert.deepEqual(specProblems(got), []);
});

test('row convention: storeys are rows below the crown with the ground row; groundKind and the souterrain flag are stated', () => {
  assert.equal(groundKindOf(answer()), 'dwelling');
  assert.equal(groundKindOf(answer({ ground: 'shopfront' })), 'shop');
  assert.equal(groundKindOf(answer({ ground: 'warehouse' })), 'warehouse');
  assert.equal(groundKindOf(answer({ groundBays: 1, doorIndex: 0 })), 'door-only');
  assert.equal(groundKindOf(answer({ groundBays: undefined, columns: [1, 3, 3, 3], doorIndex: undefined })), 'door-only');
  assert.equal(groundKindOf(answer({ groundBays: 1, doorIndex: null, doorBay: 'none' })), 'dwelling', 'one ground window and no door');
  assert.equal(groundKindOf(answer({ ground: 'not-visible' })), 'not-visible');
  // a count that leaves the ground row out of storeys while columns lists it is refused
  assert.deepEqual(rowProblems(answer({ columns: [3, 3, 3, 3] })), []);
  assert.equal(rowProblems(answer({ storeys: 3, columns: [3, 3, 3, 3] })).length, 1);
  assert.deepEqual(rowProblems(answer({ storeys: 'not-visible', columns: [3, 3] })), []);
  assert.deepEqual(answerProblems(answer({ storeys: 3, heads: ['flat', 'flat', 'flat'], columns: [3, 3] })), [], 'stored reads still load');
  // 168043: a door-only-free dwelling ground + two upper rows under a cornice, cellar windows below, dormer above = 3 rows
  const v4 = answer({ storeys: 3, heads: ['flat', 'flat', 'flat'], columns: [3, 3, 3], basement: 'windows', storeyParts: { full: 3, roof: 'dormers', souterrain: false } });
  const s = stageOne(v4, null, null);
  assert.equal(s.design.fronts![0].storeys, 3);
  assert.equal(s.design.fronts![0].souterrain, false, 'a read no is stated');
  assert.equal(s.facts?.groundKind, 'dwelling');
  assert.deepEqual(specProblems(s), []);
  const shop = stageOne(answer({ ground: 'shopfront', storeyParts: { full: 4, roof: 'none', souterrain: true }, souterrain: true }), null, null);
  assert.equal(shop.facts?.groundKind, 'shop'); assert.equal(shop.design.fronts![0].souterrain, true); assert.equal(shop.design.fronts![0].storeys, 4);
  assert.equal(stageOne(answer(), null, null).design.fronts![0].souterrain, undefined, 'pre-v4 answers state no souterrain no');
  assert.equal(stageOne(answer({ storeys: 'not-visible', heads: [] }), null, null).facts?.groundKind, undefined, 'no ground row without a count');
  assert.ok(specProblems({ ...s, facts: { groundKind: 'basement' } }).some(p => p.startsWith('facts/groundKind')));
  // a low storeyParts.full halves the storeys receipt
  assert.equal(toSpecPart(answer({ low: ['storeyParts.full'] })).provenance['fronts/0/storeys'].confidence, 0.35);
  assert.equal(toSpecPart(answer({ low: ['storeyParts'] })).provenance['fronts/0/storeys'].confidence, 0.35);
  assert.equal(toSpecPart(answer({ low: ['crown'] })).provenance['fronts/0/storeys'].confidence, 0.7);
});

test('twin guard: mutual sameAs + width + year passes the 168043 / 168096 mirrored pair that PR1 similar split on height', async () => {
  const { similar, similarWidthYear } = await import('./partyPairs.ts');
  const { guardSays, tally, stat } = await import('./twin-guard.ts');
  const p = (year: number | null, runM: number, exposedM: number) => ({ pandId: 'x', year, drawn: { runM, exposedM } });
  const a43 = p(1883, 6.2, 13.9), a96 = p(1883, 6.3, 16.6);
  assert.equal(similar(a43, a96), false, 'PR1: exposed height 2.7 m apart');
  assert.equal(similarWidthYear(a43, a96), true);
  assert.equal(similarWidthYear(p(1883, 6.2, 14), p(1887, 6.2, 14)), false, 'year 4 apart');
  assert.equal(similarWidthYear(p(1883, 6.2, 14), p(1883, 6.6, 14)), false, 'width 0.4 m apart');
  assert.equal(similarWidthYear(p(null, 6.2, 14), p(1883, 6.2, 14)), false);
  // 168096 sits right of 168043: 168043 names right, 168096 names left
  const x = { side: 'right' as const, back: 'left' as const, a: { sameAs: 'right' }, b: { sameAs: 'left' }, pa: a43, pb: a96 };
  assert.equal(twinGuard('mutual', x), true);
  assert.equal(twinGuard('pr1', x), false, 'the old guard stays reachable');
  assert.equal(twinGuard('mutual', { ...x, b: { sameAs: 'none' } }), false, 'one-sided sameAs');
  assert.equal(twinGuard('mutual', { ...x, b: { sameAs: 'both' } }), true);
  assert.equal(twinGuard('mutual', { ...x, b: null }), false, 'an unread neighbour never copies');
  assert.equal(twinGuard('mutual', { ...x, a: { sameAs: 'left' } }), false, 'names the other side');
  assert.equal(twinGuard('mutual', { ...x, pb: undefined }), false, 'no probe, no copy');
  const sides = [
    { truth: true, side: 'right' as const, a: { sameAs: 'right' }, b: { sameAs: 'left' }, pa: a43, pb: a96 },
    { truth: false, side: 'left' as const, a: { sameAs: 'left' }, b: { sameAs: 'none' }, pa: a43, pb: a43 },
    { truth: true, side: 'left' as const, a: { sameAs: 'none' }, b: { sameAs: 'right' }, pa: a43, pb: a43 },
  ];
  assert.deepEqual(sides.map(s => guardSays('plain', s)), [true, true, false]);
  assert.deepEqual(sides.map(s => guardSays('mutual', s)), [true, false, false]);
  assert.deepEqual(sides.map(s => guardSays('mutual-sameAs', s)), [true, false, false]);
  const t = stat(tally(sides, 'mutual'));
  assert.equal(t.tp, 1); assert.equal(t.fp, 0); assert.equal(t.fn, 1); assert.equal(t.precision, 1); assert.equal(t.recall, 0.5);
});

test('rows: rowStat exact / within one with Wilson intervals; unreadNeighbours lists each unread truth neighbour once', async () => {
  const { rowStat } = await import('./rows.ts');
  const r = rowStat([{ truth: 3, read: 3 }, { truth: 4, read: 3 }, { truth: 3, read: 5 }, { truth: 3, read: undefined }]);
  assert.equal(r.n, 3); assert.equal(r.exact, 0.333); assert.equal(r.within1, 0.667); assert.equal(r.under, 1); assert.equal(r.over, 1);
  const { unreadNeighbours } = await import('./twins-v2.ts');
  const row = (pandId: string, l: string | null, lt: boolean | null, rr: string | null, rt: boolean | null) => ({ pandId, source: 'block-face' as const, mirrored: null, image: '',
    left: l ? { id: l, twin: lt, why: '' } : null, right: rr ? { id: rr, twin: rt, why: '' } : null });
  const m = unreadNeighbours([row('a', 'b', true, 'c', null), row('d', 'b', false, 'a', true)], new Set(['a', 'd']));
  assert.deepEqual([...m.keys()], ['b'], 'c has no verdict, a is read');
});

test('per-row heads: 171218 flat, flat, round stages the round top row as archedStoreys (route C only); uniform rows stay byte-identical', async () => {
  const { rowHeads, ROUTE_C_ONLY } = await import('./stage.ts');
  assert.deepEqual(rowHeads(['flat', 'flat', 'flat'], 3), { windowHead: { kind: 'flat' } });
  assert.deepEqual(rowHeads(['flat', 'segmental', 'not-visible'], 3), { windowHead: { kind: 'segmental' } }, 'as upperHead: unknown rows ignored');
  assert.deepEqual(rowHeads(['flat', 'flat', 'round'], 3), { archedStoreys: [2] });
  assert.deepEqual(rowHeads(['flat', 'segmental', 'segmental', 'round'], 4), { windowHead: { kind: 'segmental', storeys: [1, 2] }, archedStoreys: [3] });
  assert.deepEqual(rowHeads(['flat', 'round', 'round'], 3), { archedStoreys: [1, 2] });
  assert.deepEqual(rowHeads(['flat', 'relieving', 'flat'], 3), {}, 'relieving rows stage nothing');
  assert.deepEqual(rowHeads(['flat', 'round'], 3), {}, 'a list that is not one per row');
  assert.deepEqual(rowHeads([], 3), {});
  assert.deepEqual(rowHeads(['flat', 'flat', 'round'], 'not-visible'), {}, 'rows without a count cannot be placed');
  const s171218 = stageOne(answer({ storeys: 3, heads: ['flat', 'flat', 'round'], storeyWindows: { 2: 'arched' } }), null, null);
  const f = s171218.design.fronts![0] as any;
  assert.deepEqual(f.archedStoreys, [2]); assert.equal(f.windowHead, undefined);
  assert.equal(s171218.provenance['fronts/0/archedStoreys'].source, 'vision-judge');
  assert.deepEqual(specProblems(s171218), []);
  assert.ok(ROUTE_C_ONLY.has('fronts/0/archedStoreys'));
  // uniform rows: the same windowHead and receipt as the one-word head (byte-identical to the step-1c staging)
  const flat = stageOne(answer({ heads: ['flat', 'flat', 'flat', 'flat'] }), null, null);
  assert.deepEqual(flat.design.fronts![0].windowHead, { kind: 'flat' });
  assert.equal(flat.design.fronts![0].archedStoreys, undefined);
  assert.equal(stageOne(answer({ heads: ['flat', 'segmental', 'segmental', 'segmental'], low: ['heads'] }), null, null).provenance['fronts/0/windowHead'].confidence, 0.35, 'a low heads read halves the head receipt');
  assert.ok(specProblems({ ...flat, design: { fronts: [{ archedStoreys: [] }] } }).some(p => p.includes('archedStoreys')));
});

test('per-row heads reach the recipe route and nothing else: the intent accepts disjoint windowHead + archedStoreys, fit draws a semicircle there, the generic view and F1 record ignore them', async () => {
  const fs = await import('node:fs');
  const { validateIntent } = await import('../../../src/canalRecall/buildingRecipe/intent.ts');
  const { fitIntent } = await import('../../../src/canalRecall/buildingRecipe/fit.ts');
  const D = new URL('../../building-recipes/houses/bilder-080336/', import.meta.url).pathname;
  const base = JSON.parse(fs.readFileSync(`${D}intent.json`, 'utf8')), facts = JSON.parse(fs.readFileSync(`${D}facts.json`, 'utf8'));
  const n = base.fronts[0].storeys as number, top = n - 1;
  const mk = (over: Record<string, unknown>) => { const i = structuredClone(base); Object.assign(i.fronts[0], over); return i; };
  assert.doesNotThrow(() => validateIntent(mk({ archedStoreys: [top], windowHead: { kind: 'segmental', storeys: [1] } })));
  assert.throws(() => validateIntent(mk({ archedStoreys: [top], windowHead: { kind: 'segmental' } })), /archedStoreys/);
  assert.throws(() => validateIntent(mk({ archedStoreys: [top], windowHead: { kind: 'segmental', storeys: [top] } })), /archedStoreys/);
  const ops = (i: any) => fitIntent(validateIntent(i), facts).recipe.elevations[0].openings!.value as any[];
  const before = ops(base), after = ops(mk({ archedStoreys: [top] }));
  const row = (o: any[], s: number) => o.filter(x => new RegExp(`^s${s}-`).test(x.id));
  assert.ok(row(after, top).length && row(after, top).every(o => o.head === 'segmental' && Math.abs(o.headRiseM - o.widthM / 2) < 0.002), 'semicircle on the top row');
  assert.deepEqual(row(after, 1), row(before, 1), 'the other rows unchanged');
  // generic view and F1 record: identical with and without the round rows
  const { specView } = await import('../../../src/canalRecall/houseSpec/view.ts');
  const { facadeRecordFor } = await import('../../../src/canalRecall/look/facadeRecord.ts');
  const plain = stageOne(answer({ storeys: 3, heads: ['flat', 'flat', 'flat'] }), '#6a4a36', null);
  const arched = structuredClone(plain);
  arched.design.fronts![0].archedStoreys = [2]; arched.provenance['fronts/0/archedStoreys'] = { source: 'vision-judge', confidence: 0.7, ref: 'x', at: null };
  assert.deepEqual(specView(arched), specView(plain));
  const rec = (spec: any) => facadeRecordFor({ id: spec.pandId, style: 'canal', wallHex: '#6a4a36', heightM: 14, eavesM: 12, spec });
  assert.deepEqual(rec(arched), rec(plain));
});
