// Hand set v1 (lane H5h, #351): the schema, the validator, the committed readings, and the scoring arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HEX_DARK_L, READING_CONVENTION, STOREYS_DEFINITION, UNKNOWN, hexTone, toneOf, validateGableRows, validateHandSet, type HandSet } from './handSet.ts';
import { GATE_MARGIN, MIN_N, gateFor, verdict, wilson } from '../../../scripts/house-specs/agreement.ts';
import { multiSpec } from '../../../scripts/house-specs/hand-set/build.ts';
import { specProblems } from './spec.ts';
import { parseRow } from '../../../scripts/house-specs/hand-set/build.ts';
import { agree, handValues, table } from '../../../scripts/house-specs/hand-set/score.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const load = (f: string): HandSet => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line', f), 'utf8'));
const SHA = 'a'.repeat(64), REF = 'source-data://pand-crops/0363100012174187/front.jpg';
const pand = (over: Record<string, unknown> = {}) => ({
  pandId: '0363100012174187', group: 'ab07', images: [{ ref: REF, sha256: SHA }], readable: true, extent: 'single',
  fields: { axes: { value: 3, confidence: 'med', ref: REF }, storeys: { value: 5, confidence: 'high', ref: REF }, gable: { value: 'cornice', confidence: 'high', ref: REF }, finish: { value: 'brick', confidence: 'high', ref: REF }, wall: { value: 'brown', confidence: 'med', ref: REF } },
  ...over,
});
const set = (pands: unknown[]) => ({ version: 1, reader: 't', date: '2026-11-10', convention: READING_CONVENTION, pands });

test('the committed hand set and the second reader validate', () => {
  const a = load('hand-set-v1.json'), b = load('hand-set-v1.reader-b.json'), c = load('hand-set-v1.reader-c.json');
  assert.deepEqual(validateHandSet(a), []); assert.deepEqual(validateHandSet(b), []); assert.deepEqual(validateHandSet(c), []);
  assert.deepEqual(c.pands.map(p => p.pandId).sort(), b.pands.map(p => p.pandId).sort());
  // the round-2 ruling: the multi-front crops and the 170031 crown are not scored; 182857 has 5 axes
  const byId = (id: string) => a.pands.find(p => p.pandId === '0363100012' + id)!;
  for (const id of ['168085', '174923']) assert.equal(byId(id).extent, 'multi', id);
  assert.equal(byId('170031').fields.gable.value, UNKNOWN);
  assert.equal(byId('182857').fields.axes.value, 5);
  assert.equal(byId('164843').fields.finish.value, 'painted-brick'); assert.equal(byId('164843').fields.wall.value, 'dark');
  assert.equal(a.pands.length, 80);
  const groups = a.pands.reduce((m: Record<string, number>, p) => ((m[p.group] = (m[p.group] ?? 0) + 1), m), {});
  assert.deepEqual(groups, { ab07: 60, easy: 13, nassau: 7 });
  assert.equal(b.pands.length, 30);
  for (const p of b.pands) assert.ok(a.pands.some(x => x.pandId === p.pandId), `${p.pandId} is in the hand set`);
  // every field ref is one of the pand's archived images, each with a sha256
  for (const p of a.pands) for (const k of ['axes', 'storeys', 'gable', 'finish', 'wall'] as const) assert.ok(p.images.some(i => i.ref === p.fields[k].ref));
});

test('validateHandSet rejects what the schema forbids', () => {
  assert.deepEqual(validateHandSet(set([pand()])), []);
  assert.match(validateHandSet(set([pand({ pandId: '123' })])).join(), /16 digits/);
  assert.match(validateHandSet(set([pand(), pand()])).join(), /duplicate/);
  const bad = (fields: Record<string, unknown>) => validateHandSet(set([pand({ fields: { ...pand().fields, ...fields } })])).join();
  assert.match(bad({ gable: { value: 'dome', confidence: 'high', ref: REF } }), /fields.gable/);
  assert.match(bad({ axes: { value: 0, confidence: 'high', ref: REF } }), /fields.axes/);
  assert.match(bad({ wall: { value: 'brown', confidence: 'sure', ref: REF } }), /fields.wall/);
  assert.match(bad({ finish: { value: 'brick', confidence: 'high', ref: 'source-data://elsewhere.jpg' } }), /not one of the pand's images/);
  assert.match(validateHandSet(set([pand({ images: [{ ref: '/tmp/x.jpg', sha256: SHA }] })])).join(), /source-data refs/);
  assert.match(validateHandSet(set([pand({ readable: false })])).join(), /unreadable pand states axes/);
  assert.match(bad({ gable: { value: null, confidence: 'low', ref: REF } }), /is null: a field the crop cannot show is "unknown"/);
  assert.deepEqual(bad({ gable: { value: UNKNOWN, confidence: 'high', ref: REF } }), '');
  assert.match(validateHandSet(set([pand({ extent: undefined })])).join(), /extent single \| multi/);
  assert.deepEqual(validateHandSet(set([pand({ extent: 'multi' })])), []);
});

test('the convention names every rule the readers were given', () => {
  assert.ok(READING_CONVENTION.includes(STOREYS_DEFINITION));
  assert.match(STOREYS_DEFINITION, /neither a souterrain nor an attic in the crown/);
  for (const w of ['unknown', 'extent', 'souterrain', 'entresol', 'atticInCrown', 'bel-etage', 'erker', 'gable foot', 'mullion', 'axesPerStorey']) assert.ok(READING_CONVENTION.includes(w), w);
});

test('tones: brown and dark read dark; a hex is dark under HEX_DARK_L', () => {
  assert.equal(toneOf('dark'), 'dark'); assert.equal(toneOf('brown'), 'dark'); assert.equal(toneOf('red-brown'), 'light'); assert.equal(toneOf(null), null);
  assert.equal(HEX_DARK_L, 0.38);
  assert.equal(hexTone('#36302c'), 'dark'); assert.equal(hexTone('#947b65'), 'light'); assert.equal(hexTone('nope'), null);
});

test('parseRow reads the reading log, flags and unreadable rows', () => {
  const imgs = [{ ref: 'source-data://a/A.jpg', sha256: SHA }, { ref: 'source-data://a/B.jpg', sha256: SHA }];
  const r = parseRow(['0363100012169981', 'B', '3:med', '3:high', 'atticInCrown,aps=2-3', 'cornice:high', 'brick:high', 'dark:med', 'shop:high', 'note'].join('\t'), imgs);
  assert.equal(r.fields.axes.value, 3); assert.equal(r.fields.axes.ref, 'source-data://a/B.jpg'); assert.deepEqual(r.fields.axesPerStorey, [2, 3]);
  assert.equal(r.fields.atticInCrown, true); assert.equal(r.fields.souterrain, undefined); assert.equal(r.fields.pui!.value, 'shop');
  const n = parseRow(['0363100012174180', 'A', '-:low', '-:low', '-', 'step:med', 'brick:med', 'red-brown:med', 'shop:low', ''].join('\t'), imgs);
  assert.equal(n.fields.axes.value, UNKNOWN); assert.equal(n.fields.gable.value, 'step');
  const u = parseRow(['0363100012169088', 'A', 'UNREADABLE', '-', '-', '-', '-', '-', '-', 'why'].join('\t'), imgs);
  assert.equal(u.readable, false); assert.equal(u.fields.gable.value, UNKNOWN); assert.equal(u.extent, 'single');
});

test('scoring: exact and within-one agreement, precision over stated, recall over hand', () => {
  assert.ok(agree('bays', 3, 3)); assert.ok(!agree('bays', 3, 4)); assert.ok(agree('bays±1', 3, 4)); assert.ok(!agree('storeys±1', 3, 5));
  const h = handValues(pand() as any), lowOnly = handValues(pand() as any, 'high');
  assert.equal(h.bays, 3); assert.equal(lowOnly.bays, undefined); assert.equal(h.wallTone, 'dark');
  const t = table([{ hand: h, got: { ...h, bays: 4, 'bays±1': 4 } }, { hand: h, got: { ...h, bays: undefined, 'bays±1': undefined } }]);
  assert.deepEqual(t.bays, { hand: 2, stated: 1, agree: 0, precision: 0, recall: 0, ci: [0, 0.793] });
  assert.deepEqual(t['bays±1'], { hand: 2, stated: 1, agree: 1, precision: 1, recall: 0.5, ci: [0.207, 1] });
});

test('unknown and multi-front pands are never scored', () => {
  const unk = handValues(pand({ fields: { ...pand().fields, gable: { value: UNKNOWN, confidence: 'high', ref: REF } } }) as any);
  assert.equal(unk.gable, undefined); assert.equal(unk.bays, 3);
  const multi = handValues(pand({ extent: 'multi' }) as any);
  for (const v of Object.values(multi)) assert.equal(v, undefined);
  // the scorer may take reader A's extent for a second reader's row
  assert.equal(handValues(pand() as any, 'low', 'multi').bays, undefined);
});

test('gates: the blind ceiling - 0.1; a writer fails only when its Wilson top is under the gate; gable needs n >= 60', () => {
  assert.equal(GATE_MARGIN, 0.1); assert.deepEqual(MIN_N, { gable: 60 });
  assert.equal(gateFor(0.84), 0.74); assert.equal(gateFor(0.923), 0.823); assert.equal(gateFor(1), 0.9);
  assert.equal(verdict(17, 28, 0.74, 60).verdict, 'open'); assert.equal(verdict(36, 60, 0.76, 60).verdict, 'fail');
  const [lo, hi] = wilson(25, 30); assert.ok(Math.abs(lo - 0.664) < 0.005 && Math.abs(hi - 0.927) < 0.005, `${lo} ${hi}`);
  assert.deepEqual(wilson(0, 0), [0, 1]);
  assert.equal(verdict(25, 30, 0.9).verdict, 'open'); assert.equal(verdict(17, 28, 0.86).verdict, 'fail'); assert.equal(verdict(23, 23, 0.83).verdict, 'pass'); assert.equal(verdict(0, 0, 0.9).verdict, 'n/a');
});

test('round 3: crowns, multi-front fronts[], gable-only rows', () => {
  const a = load('hand-set-v1.json'); const byId = (id: string) => a.pands.find(p => p.pandId === '0363100012' + id)!;
  assert.equal(byId('182857').extent, 'single'); assert.equal(byId('182857').fields.crowns, 2); assert.equal(byId('182857').fields.gable.value, 'step');
  const multi = a.pands.filter(p => p.extent === 'multi'); assert.equal(multi.length, 7);
  assert.deepEqual(multi.filter(p => p.fronts).map(p => p.pandId.slice(-6)).sort(), ['116526', '168085', '169899', '174080', '174696', '174923']);
  for (const p of multi) if (p.fronts) assert.ok(Math.abs(p.fronts.reduce((x, f) => x + f.share, 0) - 1) <= 0.02, p.pandId);
  // validator: fronts only on multi, two or more, shares sum to 1, crowns 2..5
  const m = { ...pand({ extent: 'multi' }), fronts: [{ share: 0.5, ...pand().fields }, { share: 0.5, ...pand().fields }] };
  assert.deepEqual(validateHandSet(set([m])), []);
  assert.match(validateHandSet(set([{ ...m, extent: 'single' }])).join(), /fronts only on an extent multi/);
  assert.match(validateHandSet(set([{ ...m, fronts: [m.fronts[0]] }])).join(), /two or more/);
  assert.match(validateHandSet(set([{ ...m, fronts: [m.fronts[0], { ...m.fronts[1], share: 0.3 }] }])).join(), /sum to 0.80/);
  assert.match(validateHandSet(set([pand({ fields: { ...pand().fields, crowns: 1 } })])).join(), /crowns is 2..5/);
  // the multi fronts as HouseSpecs validate, and the spec validator checks share per facade
  const specs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.multi-specs.json'), 'utf8'));
  assert.equal(specs.length, 6); for (const s of specs) assert.deepEqual(specProblems(s), [], s.pandId);
  assert.deepEqual(multiSpec(byId('168085'), '2026-11-10').design.fronts!.map((f: any) => f.share), [0.33, 0.34, 0.33]);
  const two = (shares: unknown[], streets: (string | undefined)[] = []) => specProblems({ schemaVersion: 1, pandId: '0363100012168085', design: { fronts: shares.map((share, i) => ({ ...(share === undefined ? {} : { share }), ...(streets[i] ? { street: streets[i] } : {}) })) }, provenance: { '': { source: 'author', confidence: 1, ref: 't', at: null } } } as any).join();
  assert.equal(two([0.5, 0.5]), ''); assert.match(two([0.5, 0.3]), /sum to 0.80/); assert.match(two([0.5, undefined]), /each state share/);
  assert.equal(two([undefined, undefined], ['Bloemgracht', 'Tweede Leliedwarsstraat']), ''); assert.match(two([1.5]), /share of the wall/);
  // gable rows: two blind readers on the same 40 crown crops
  const b2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.gable-b2.json'), 'utf8')), c2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.gable-c2.json'), 'utf8'));
  assert.deepEqual(validateGableRows(b2), []); assert.deepEqual(validateGableRows(c2), []); assert.equal(b2.rows.length, 40);
  assert.deepEqual(b2.rows.map((r: any) => r.pandId).sort(), c2.rows.map((r: any) => r.pandId).sort());
  for (const r of b2.rows) assert.ok(!a.pands.some(p => p.pandId === r.pandId), `${r.pandId} is new`);
  assert.match(validateGableRows({ ...b2, rows: [{ ...b2.rows[0], gable: { ...b2.rows[0].gable, value: null } }] }).join(), /say "unknown"/);
});

test('Jev storeys question: off as a writer, parsed strictly, cached per prompt version', async () => {
  const { JEV_WRITES_STOREYS, JEV_STOREYS, parseStoreys, storeysHash, storeysRequestBody } = await import('./writers/jevStoreys.ts');
  assert.equal(JEV_WRITES_STOREYS, false);
  assert.ok(JEV_STOREYS.questions.storeys.instructions.includes('souterrain') && JEV_STOREYS.questions.storeys.instructions.includes('set-back attic'));
  const r = parseStoreys({ answers: { storeys: { type: 'choice', choice: 'four', probabilities: { four: 0.7, three: 0.3 } } }, usage: { input_tokens: 10, output_tokens: 2 } });
  assert.deepEqual([r.answer.value, r.answer.p, r.tokens], [4, 0.7, 12]);
  assert.throws(() => parseStoreys({ answers: {} }), /no storeys answer/);
  assert.notEqual(storeysHash(Buffer.from('x')), storeysHash(Buffer.from('y')));
  assert.ok(!JSON.stringify(storeysRequestBody('i')).includes('Bearer'));
});
