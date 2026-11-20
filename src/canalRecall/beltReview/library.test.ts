// Belt review lane C: the stage 2 description (description.ts) and the structured kit gaps (kitGaps.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptySpec, type HouseSpec } from '../houseSpec/spec.ts';
import {
  candidatesFromBeltLook, candidatesFromRead, candidatesFromRegister, candidatesFromSpec, candidatesFromSurvey, countFields, descSourceOfSpec, pickFields,
  type FieldCandidate,
} from './description.ts';
import { gapField, harvestedGapId, kitCannotDraw, kitGapProblems, mergeKitGaps, parseKitGaps, type KitGap } from './kitGaps.ts';

const P = '0363100012179752', Q = '0363100012179753';

test('spec sources map onto the description ladder', () => {
  assert.equal(descSourceOfSpec('author'), 'reviewed');
  assert.equal(descSourceOfSpec('streetlevel-measured'), 'face-intent');
  assert.equal(descSourceOfSpec('vision-judge'), 'own-read');
  assert.equal(descSourceOfSpec('monument-text'), 'register');
  assert.equal(descSourceOfSpec('based-on'), 'based-on');
  assert.equal(descSourceOfSpec('3dbag'), 'survey');
  assert.equal(descSourceOfSpec('default'), 'period-default');
});

test('candidatesFromSpec reads the street front, palette and facts with each receipt', () => {
  const s: HouseSpec = { ...emptySpec(P), design: { fronts: [{ gable: 'neck', storeys: 4, bays: [2, 3, 3], windowHead: { kind: 'segmental' }, basement: 'stoop' }], palette: { wallMaterial: 'brick', brick: '#6a3a2a', frame: '#f4f1ea' } }, facts: { facadeYear: 1720 } };
  s.provenance['fronts/0'] = { source: 'streetlevel-measured', confidence: 0.85, ref: 'faces/x/strip.json', at: '2023-01-01' };
  s.provenance['palette'] = { source: 'reviewed', confidence: 0.9, ref: 'review', at: null };
  s.provenance['facts/facadeYear'] = { source: 'monument-text', confidence: 0.8, ref: 'rce:1', at: null };
  const by = Object.fromEntries(candidatesFromSpec(s).map(c => [c.field, c]));
  assert.equal(by.crown.value, 'neck'); assert.equal(by.crown.source, 'face-intent');
  assert.equal(by.bays.value, 3, 'bays above the ground storey');
  assert.equal(by.heads.value, 'segmental');
  assert.equal(by.stoop.value, 'stoop');
  assert.equal(by.whiteFrames.value, true); assert.equal(by.whiteFrames.source, 'reviewed');
  assert.equal(by.facadeYear.source, 'register');
});

test('D1 reads: not-visible is skipped, low fields lose confidence, an unreadable read says nothing', () => {
  const a = { readable: true, storeys: 3, bays: 'not-visible', crown: 'cornice', cornice: 'frieze', heads: ['flat', 'segmental', 'segmental'], finish: 'brick', whiteFrames: false, ground: 'dwelling', basement: 'not-visible', low: ['cornice'] } as any;
  const c = candidatesFromRead(a, 'D1');
  const by = Object.fromEntries(c.map(x => [x.field, x]));
  assert.equal(by.bays, undefined); assert.equal(by.stoop, undefined);
  assert.equal(by.cornice.confidence, 0.4); assert.equal(by.storeys.confidence, 0.6);
  assert.equal(by.heads.value, 'segmental', 'the upper rows decide the head');
  assert.deepEqual(candidatesFromRead({ ...a, readable: false }, 'D1'), []);
});

test('pickFields: strongest source wins, agreements and disagreements are kept; counts split library and new read', () => {
  const c: FieldCandidate[] = [
    { field: 'crown', value: 'neck', source: 'register', confidence: 0.55, ref: 'rce' },
    { field: 'crown', value: 'bell', source: 'own-read', confidence: 0.6, ref: 'D1' },
    { field: 'crown', value: 'bell', source: 'donor', confidence: 0.35, ref: 'look' },
    { field: 'storeys', value: 4, source: 'donor', confidence: 0.35, ref: 'look' },
    { field: 'eavesM', value: 12.1, source: 'survey', confidence: 0.75, ref: 'ahn' },
    { field: 'eavesM', value: 11.0, source: 'period-default', confidence: 0.2, ref: 'look' },
  ];
  const f = pickFields(c);
  assert.equal(f.crown!.value, 'bell'); assert.equal(f.crown!.source, 'own-read');
  assert.deepEqual(f.crown!.agree, ['donor']);
  assert.deepEqual(f.crown!.others, [{ value: 'neck', source: 'register', ref: 'rce' }]);
  assert.equal(f.eavesM!.source, 'survey');
  const n = countFields([f]);
  assert.equal(n.fields, 17);
  assert.equal(n.library, 2, 'crown and eaves');
  assert.equal(n.newRead, 15, 'storeys from a donor and 14 absent fields');
  assert.equal(n.bySource.donor, 1);
});

test('register and belt look: elements become fields; the look names its donor', () => {
  const r = Object.fromEntries(candidatesFromRegister({ nr: '1701', gable: 'raisedNeck', finish: 'plaster', facadeDate: { from: 1700, to: 1799, confidence: 'period' }, elements: [{ key: 'corniceConsoles' }, { key: 'stoop' }] }).map(c => [c.field, c]));
  assert.equal(r.crown.value, 'raised-neck'); assert.equal(r.wallFinish.value, 'stucco'); assert.equal(r.facadeYear.value, 1750); assert.equal(r.cornice.value, 'bracketed'); assert.equal(r.stoop.value, 'stoop');
  const look = { pandId: P, crown: { family: 'cornice' }, storeys: 3, bays: 3, eavesM: 13.9, sources: { eaves: 'period-default: belt look', wall: `judged brown-brick (period-default: D1 answers: ${Q})` }, series: { id: 's1', cornice: 'simple' }, wall: { hex: '#665448', finish: 'brick' } };
  const l = candidatesFromBeltLook(look);
  assert.ok(l.filter(c => c.field !== 'eavesM').every(c => c.source === 'donor'));
  assert.equal(l.find(c => c.field === 'eavesM')!.source, 'period-default');
  assert.match(l[0].ref, new RegExp(`donor ${Q}`));
  const own = candidatesFromBeltLook({ ...look, sources: { ...look.sources, wall: `D1 answers: ${P}` } });
  assert.equal(own.find(c => c.field === 'crown')!.source, 'own-read');
  const sv = candidatesFromSurvey({ n: 40, p90: 13.2 }, 2.7, 'AHN');
  assert.equal(sv[0].value, 13.2); assert.equal(sv[1].confidence, 0.2, 'a 3DBAG eaves under 4 m is doubtful');
});

const gap = (over: Partial<KitGap> = {}): KitGap => ({ id: 'g1', gap: 'scrolls on the neck gable', component: 'gable ornament', housesBlocked: [P], status: 'open', since: '2026-11-20', ...over });

test('kit gaps: validation, stable harvested ids, merge keeps status and adds houses', () => {
  assert.deepEqual(kitGapProblems({ version: 1, about: '', gaps: [gap()] }), []);
  assert.ok(kitGapProblems({ version: 1, about: '', gaps: [gap({ status: 'closed' })] }).some(p => /fixedBy/.test(p)));
  assert.ok(kitGapProblems({ version: 1, about: '', gaps: [gap(), gap()] }).some(p => /duplicate/.test(p)));
  assert.ok(kitGapProblems({ version: 1, about: '', gaps: [gap({ housesBlocked: ['171144'] })] }).some(p => /16-digit/.test(p)));
  const id = harvestedGapId('gable ornament', 'scrolls');
  assert.equal(id, harvestedGapId('gable ornament', 'scrolls'));
  assert.match(id, /^gable-ornament-[0-9a-f]{8}$/);
  const existing = [gap({ id, status: 'in-progress', fixedBy: 'lane/x', since: '2026-11-01', housesBlocked: [P] })];
  const merged = mergeKitGaps(existing, [
    { component: 'gable ornament', what: 'scrolls', pands: [Q], ref: 'face a', since: '2026-11-20' },
    { component: 'strip registration', what: 'strip 1.5 m right', pands: [P], ref: 'face a', since: '2026-11-20' },
    { component: 'facade', what: 'the arched door heads', pands: [Q], ref: 'face b', since: '2026-11-20' },
  ]);
  assert.equal(merged.length, 2, 'registration notes are not kit gaps');
  const g = merged.find(x => x.id === id)!;
  assert.equal(g.status, 'in-progress'); assert.equal(g.since, '2026-11-01');
  assert.deepEqual(g.housesBlocked, [P, Q]);
  assert.equal(merged.find(x => x.id !== id)!.field, 'door', 'a legacy facade limit is filed by its words');
  assert.equal(gapField('dormer', 'x'), 'roofStorey');
});

test('kitCannotDraw: spec-level reads with a stand-in, held reads, and the open gaps of the pand', () => {
  const f = pickFields([
    { field: 'crown', value: 'pitched-eaves', source: 'own-read', confidence: 0.6, ref: 'D1' },
    { field: 'heads', value: 'pointed', source: 'own-read', confidence: 0.6, ref: 'D1' },
    { field: 'wallFinish', value: 'stone', source: 'register', confidence: 0.7, ref: 'rce' },
    { field: 'dormers', value: { count: 2, kind: 'gabled' }, source: 'own-read', confidence: 0.6, ref: 'D1' },
  ]);
  const out = kitCannotDraw(P, f, [gap(), gap({ id: 'g2', status: 'closed', fixedBy: 'x' }), gap({ id: 'g3', housesBlocked: [Q] })]);
  const fields = out.map(o => o.field).sort();
  assert.deepEqual(fields, ['crown', 'crown', 'dormers', 'heads', 'wallFinish'].sort());
  assert.ok(out.some(o => o.field === 'crown' && o.drawnAs === 'cornice'));
  assert.ok(out.some(o => o.gapId === 'g1'), 'the open gap naming the pand'); assert.ok(!out.some(o => o.gapId === 'g2' || o.gapId === 'g3'));
  assert.deepEqual(kitCannotDraw(P, pickFields([{ field: 'crown', value: 'neck', source: 'own-read', confidence: 0.6, ref: 'D1' }]), []), []);
});

test('the committed kit-gaps.json validates', () => {
  const f = parseKitGaps(JSON.parse(readFileSync('review-data/belt-review/kit-gaps.json', 'utf8')));
  assert.ok(f.gaps.length > 10);
  assert.ok(f.gaps.some(g => g.id === 'stoop-flights' && g.status === 'closed'));
});
