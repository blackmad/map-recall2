// Parser golden (#316): per-field precision and recall against hand-checked records (fixtures/registerFacts.golden.json).
// Gate from the brief: >= 0.9 for date, type, gable, finish; >= 0.8 for elements and style. Every disagreement is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreGolden } from '../../../scripts/register-facts/golden-score.ts';
import { parseDate, parseRegisterFacts } from './registerFacts.ts';

test('dates: Roman quarters, ca., written centuries, parts', () => {
  assert.deepEqual([parseDate('XVIIIa')?.from, parseDate('XVIIIa')?.to], [1700, 1724]);
  assert.deepEqual([parseDate('XVIIc/d')?.from, parseDate('XVIIc/d')?.to], [1650, 1699]);
  assert.deepEqual([parseDate('XIX B')?.from, parseDate('XIX B')?.to], [1825, 1849]);
  assert.equal(parseDate('ca. 1680')?.confidence, 'approx');
  assert.deepEqual([parseDate('laat 19e eeuwse')?.from, parseDate('laat 19e eeuwse')?.to], [1875, 1899]);
  assert.deepEqual([parseDate('eind XVIII/begin XIX')?.from, parseDate('eind XVIII/begin XIX')?.to], [1775, 1824]);
  assert.deepEqual([parseDate('1921-1922')?.from, parseDate('1921-1922')?.to], [1921, 1922]);
});

test('never invents: an empty text has no facts', () => {
  const f = parseRegisterFacts('0', 'Pand.');
  assert.deepEqual([f.facadeDate, f.coreDate, f.gable, f.finish, f.style, f.storeys, f.basement, f.altered, f.elements.length], [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0]);
});

test('golden: per-field precision and recall', () => {
  const { records, pr, misses } = scoreGolden(parseRegisterFacts);
  console.log(JSON.stringify({ records, pr: Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, `P ${v.p} R ${v.r} n ${v.n}`])) }), '\n' + misses.join('\n'));
  for (const k of ['date', 'type', 'gable', 'finish']) { assert.ok(pr[k].p >= 0.9 && pr[k].r >= 0.9, `${k} ${JSON.stringify(pr[k])}`); }
  for (const k of ['elements', 'style']) { assert.ok(pr[k].p >= 0.8 && pr[k].r >= 0.8, `${k} ${JSON.stringify(pr[k])}`); }
});

test('finish: a long description names plastered details on a brick front; only a plastered front counts (review 2026-11-10)', () => {
  const pad = ' Omschrijving. Het pand telt vier bouwlagen onder een zadeldak met de nok evenwijdig aan de gracht.'.repeat(10);
  // Keizersgracht 169116 / 101927 shapes: brick masonry with a plastered lintel or interior, read as plaster before.
  assert.notEqual(parseRegisterFacts('1', 'Grachtenhuis gebouwd in 1617.' + pad + ' De voorgevel is opgemetseld in staand verband. De gepleisterde latei heeft een reliëf.').finish, 'plaster');
  assert.equal(parseRegisterFacts('2', 'Pand.' + pad + ' De voorgevel is gepleisterd en witgeschilderd.').finish, 'plaster');
  assert.equal(parseRegisterFacts('3', 'Pand.' + pad + ' Gepleisterde gevels onder een kroonlijst.').finish, 'plaster');
  // A short entry's bare "gepleisterd" is about the front.
  assert.equal(parseRegisterFacts('4', 'Pand met klokgevel (XVII B) gepleisterd en van ornament ontdaan XIX.').finish, 'plaster');
  // A hardstone gable stone is not a stone front (168578, a brick Delft School office).
  assert.equal(parseRegisterFacts('5', 'Pand met de hardstenen gevelsteen van het hofje.').finish, undefined);
  assert.equal(parseRegisterFacts('6', 'Pand met zandstenen gevel onder rechte lijst.').finish, 'stone');
});
