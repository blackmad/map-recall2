// The editorial gate and the rotation order, which between them decide what a
// player is told about a place and how often they are told it again.
//
// Every rejection case below is a sentence a local model actually produced
// while this pipeline was being built, kept verbatim so a later prompt change
// cannot quietly re-admit it.

import assert from 'node:assert/strict';

import {
  countSentences,
  judgeFact,
  namesSubject,
  normaliseDigitGroups,
  similarity,
  tidyFact,
  trimFillerClause,
  ungroundedNumbers,
} from '../src/canalRecall/facts/factQuality';
import {
  chooseFact,
  emptyRotationState,
  expandedFacts,
  factKey,
  pruneHistory,
  recordShown,
} from '../src/canalRecall/facts/factRotation';
import { selectReviewedFacts, summariseRejections } from '../src/canalRecall/facts/factReview';
import {
  buildFactIndex,
  commitShownFact,
  factCardText,
  loadRotationState,
  ROTATION_STORAGE_KEY,
} from '../src/canalRecall/facts/factStore';
import type { Fact, FactKind, FeatureFacts } from '../src/canalRecall/facts/factTypes';
import {
  selectSourcePassages,
  sectionInterest,
  splitArticleSections,
  truncateAtSentence,
} from '../src/canalRecall/facts/articleSections';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

const MAGERE_SOURCE = 'The Magere Brug is a bridge over the river Amstel in Amsterdam. '
  + 'The present bridge dates from 1934 and replaced a wooden bridge first built in 1691. '
  + 'It is a double swing bridge, opened by hand by a bridge keeper, and is lit by 1,200 lights at night.';

const accept = (text: string, name = 'Magere Brug', source = MAGERE_SOURCE) =>
  judgeFact(text, { name, source });

// ---- The editorial gate ----

check('a grounded, self-contained fact is accepted', () => {
  const verdict = accept('The Magere Brug is opened by hand by a bridge keeper, one of the last in Amsterdam.');
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
});

check('a year the source never states is rejected', () => {
  // The failure the board's top rule is about: a plausible year is
  // indistinguishable from a real one on a card.
  const verdict = accept('The Magere Brug was rebuilt in stone in 1871 after a fire destroyed the wooden span.');
  assert.deepEqual(verdict, { ok: false, reason: 'ungrounded-number' });
});

check('a digit-group separator is removed, an ordinary space is not', () => {
  // Stripping separators everywhere is the obvious implementation and breaks
  // every word boundary the century check depends on.
  assert.equal(normaliseDigitGroups('lit by 1,200 lights in 1934'), 'lit by 1200 lights in 1934');
  assert.equal(normaliseDigitGroups('built in 1691. It is'), 'built in 1691. It is');
  assert.equal(normaliseDigitGroups('a span of 1 200 metres'), 'a span of 1200 metres');
});

check('a year the source does state survives grouping and punctuation', () => {
  assert.equal(accept('The Magere Brug in its present form dates from 1934, replacing a wooden crossing.').ok, true);
  assert.equal(
    accept('The Magere Brug carries 1200 lights that are lit after dark along its length.').ok,
    true,
    'the source writes it as 1,200 — a fact writing it as 1200 is the same number',
  );
});

check('a century is grounded by a year inside it, or by being named', () => {
  assert.deepEqual(ungroundedNumbers('built in the 17th century', MAGERE_SOURCE), [],
    '1691 is in the 17th century');
  assert.deepEqual(ungroundedNumbers('built in the 19th century', MAGERE_SOURCE), ['19th century']);
  assert.deepEqual(ungroundedNumbers('built in the 19th century', 'a 19th-century warehouse'), []);
});

check('a dangling reference is rejected', () => {
  // The card appears alone beside a canal. There is no previous sentence.
  assert.deepEqual(accept('It was widened in 1934 to let larger boats through.'),
    { ok: false, reason: 'dangling-reference' });
  assert.deepEqual(accept('This bridge is opened by hand every evening by its keeper.'),
    { ok: false, reason: 'dangling-reference' });
});

check('the lede in different words is rejected', () => {
  // True, and exactly what the card already says above the fact.
  assert.deepEqual(accept('The Magere Brug is a bridge over the river Amstel in Amsterdam.'),
    { ok: false, reason: 'restates-the-lede' });
  assert.deepEqual(
    judgeFact('Vondelpark is a public park in the Oud-Zuid district of Amsterdam.',
      { name: 'Vondelpark', source: 'Vondelpark is a public urban park in Amsterdam.' }),
    { ok: false, reason: 'restates-the-lede' },
  );
  assert.deepEqual(
    judgeFact('Artis Bibliotheek is a nineteenth-century library situated at Plantage Middenlaan 45.',
      { name: 'Artis Bibliotheek', source: 'Artis Bibliotheek is a nineteenth-century library at Plantage Middenlaan 45.' }),
    { ok: false, reason: 'restates-the-lede' },
  );
  // The same restatement in its other common form. The card is already pinned
  // to a point on the map the player is looking at.
  assert.deepEqual(
    judgeFact('The Basiliek van Sint Nicolaas is located in the Old Centre, close to the main station.',
      { name: 'Basiliek van Sint Nicolaas', source: 'The basilica is in the Old Centre near the main station.' }),
    { ok: false, reason: 'restates-the-lede' },
  );
});

check('a fact that adds something to the category sentence survives', () => {
  const verdict = judgeFact(
    'Vondelpark was laid out as a private park funded by wealthy residents before the city took it over.',
    { name: 'Vondelpark', source: 'Vondelpark was laid out as a private park funded by wealthy residents.' },
  );
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
});

check('a section about what has not happened yet is never mined', () => {
  // An article's == Toekomst == describes a bridge planned for 2032; the
  // extract it would land in ships for years.
  assert.equal(sectionInterest('Toekomst'), 0);
  assert.equal(sectionInterest('Future'), 0);
  assert.equal(sectionInterest('Plannen'), 0);
});

check('a spelling the article uses still names the subject', () => {
  // OSM calls it Amsterdamschebrug; nl.wikipedia calls it Amsterdamsebrug.
  assert.equal(namesSubject('The Amsterdamsebrug carries the Zuiderzeeweg.', 'Amsterdamschebrug'), false);
  assert.equal(
    namesSubject('The Amsterdamsebrug carries the Zuiderzeeweg.', 'Amsterdamschebrug', ['Amsterdamsebrug']),
    true,
    'the title of the article the fact was drawn from counts as naming it',
  );
});

check('a fact that goes stale is rejected', () => {
  assert.deepEqual(accept('The Magere Brug is currently undergoing a full restoration by the city.'),
    { ok: false, reason: 'temporally-fragile' });
  assert.deepEqual(accept('The Magere Brug will reopen to cyclists once the works beside it finish.'),
    { ok: false, reason: 'temporally-fragile' });
  assert.deepEqual(accept('The Magere Brug is planned to be replaced by a wider crossing for cyclists.'),
    { ok: false, reason: 'temporally-fragile' });
});

check('a model describing its own prompt is rejected', () => {
  assert.deepEqual(accept('According to the source, the Magere Brug is opened by hand each evening.'),
    { ok: false, reason: 'talks-about-the-source' });
});

check('markup, bullets and footnote markers are rejected', () => {
  assert.deepEqual(accept('1. The Magere Brug is opened by hand by its keeper every evening at dusk.'),
    { ok: false, reason: 'markup' });
  assert.deepEqual(accept('The **Magere Brug** is opened by hand by its keeper every single evening.'),
    { ok: false, reason: 'markup' });
  assert.deepEqual(accept('The Magere Brug is opened by hand by its keeper each evening.[3]'),
    { ok: false, reason: 'markup' });
});

check('a paragraph is rejected rather than truncated into half a claim', () => {
  assert.deepEqual(
    accept('The Magere Brug is opened by hand by a bridge keeper. The present span dates from 1934.'),
    { ok: false, reason: 'not-one-sentence' },
  );
});

check('an abbreviation is not a sentence end', () => {
  assert.equal(countSentences('The bridge was designed by Mr. Piet Kramer for the city.'), 1);
  assert.equal(countSentences('Built in 1934. Rebuilt later.'), 2);
});

check('only a naming fact has to contain the name', () => {
  // The card shows the name as its heading, so a fact that does not repeat it
  // still reads. Requiring it everywhere threw away 18% of a good run.
  const concert = 'The inaugural concert on 11 April 1888 featured 120 musicians and 500 singers.';
  const source = 'The inaugural concert on 11 April 1888 featured 120 musicians and 500 singers.';
  assert.equal(judgeFact(concert, { name: 'Concertgebouw', source, kind: 'history' }).ok, true);
  // A naming fact without the name has translated the name away, which is the
  // failure item 11c's translator guard exists for.
  assert.deepEqual(
    judgeFact('The Lean Bridge takes its name from how narrow the original crossing was.',
      { name: 'Magere Brug', source: 'De Magere Brug dankt zijn naam aan de smalle oorspronkelijke overspanning.', kind: 'naming' }),
    { ok: false, reason: 'does-not-name-subject' },
  );
});

check('digits inside the feature\u2019s own name are grounded', () => {
  // "OT301 was originally the Dutch film academy" was rejected for the 301 in
  // the building's name.
  assert.deepEqual(ungroundedNumbers('OT301 was originally the Dutch film academy.', 'a former film academy'), ['301']);
  assert.deepEqual(ungroundedNumbers('OT301 was originally the Dutch film academy.', 'a former film academy', 'OT301'), []);
});

check('an initial is not a sentence end', () => {
  assert.equal(countSentences('Andrew S. Tanenbaum created MINIX at the Vrije Universiteit.'), 1);
});

check('a fact about something else is rejected', () => {
  assert.equal(namesSubject('The Amstel freezes over in hard winters.', 'Magere Brug'), false);
  assert.equal(namesSubject('The Amstelsluizen were built to flush the canals.', 'Amstel'), true,
    'Dutch compounds still name their subject');
  assert.equal(namesSubject('A quiet corner of the city.', 'Amsterdam Oost'), true,
    'a name made only of weak words cannot prove itself, so it is not held against the fact');
});

check('the same fact rephrased is rejected as a duplicate', () => {
  const first = 'The Magere Brug is opened by hand by a bridge keeper each evening.';
  const second = 'Each evening a bridge keeper opens the Magere Brug by hand.';
  assert.ok(similarity(first, second) >= 0.7, `similarity was ${similarity(first, second)}`);
  assert.deepEqual(judgeFact(second, { name: 'Magere Brug', source: MAGERE_SOURCE, accepted: [first] }),
    { ok: false, reason: 'duplicate' });
});

check('an evaluative clause is trimmed, an informative one is kept', () => {
  // The tell that a sentence was generated, and it eats the card's character
  // budget. The clause is always trailing, so removing it leaves a sentence.
  assert.equal(
    trimFillerClause('The roof rises 130 feet above the Damrak, a striking architectural feature.'),
    'The roof rises 130 feet above the Damrak.');
  assert.equal(
    trimFillerClause('Amsterdam celebrated its 400th birthday in 2013, marking a significant milestone.'),
    'Amsterdam celebrated its 400th birthday in 2013.');
  assert.equal(
    trimFillerClause('Kanye West ordered a €10,000 all-white carpet, which he never used.'),
    'Kanye West ordered a €10,000 all-white carpet, which he never used.',
    'a clause that says something is not filler');
  assert.equal(
    trimFillerClause('The bridge was built in 1883, replacing a 17th-century crossing.'),
    'The bridge was built in 1883, replacing a 17th-century crossing.');
});

check('a padded fact is judged on what is left after the padding', () => {
  const verdict = judgeFact(
    'The Magere Brug is opened by hand by its keeper each evening, a beloved local sight.',
    { name: 'Magere Brug', source: MAGERE_SOURCE });
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal((verdict as { ok: true; text: string }).text,
    'The Magere Brug is opened by hand by its keeper each evening.');
});

check('quotes the model wrapped around a sentence are trimmed, not rejected', () => {
  assert.equal(tidyFact('  "The Magere Brug is lit by 1,200 lights."  '),
    'The Magere Brug is lit by 1,200 lights.');
});

check('a fragment and a paragraph-length fact are both rejected', () => {
  assert.deepEqual(accept('A swing bridge.'), { ok: false, reason: 'too-short' });
  assert.deepEqual(accept(`The Magere Brug ${'is a very notable crossing indeed '.repeat(8)}.`),
    { ok: false, reason: 'too-long' });
});

// ---- Choosing the source passage ----

const ARTICLE = [
  'Vondelpark is a public urban park in Amsterdam.',
  '',
  '== Etymology ==',
  `The park is named after the poet Joost van den Vondel. ${'Its earlier name was Nieuwe Park. '.repeat(6)}`,
  '',
  '== History ==',
  `Laid out in 1865 by Jan David Zocher. ${'The park was privately funded at first. '.repeat(6)}`,
  '',
  '== References ==',
  `${'Smith, J. Parks of Amsterdam. '.repeat(10)}`,
  '',
  '== External links ==',
  'Official website',
].join('\n');

check('an article splits into its lede and headed sections', () => {
  const sections = splitArticleSections(ARTICLE);
  assert.deepEqual(sections.map((section) => section.title),
    ['', 'Etymology', 'History', 'References', 'External links']);
  assert.equal(sections[0].depth, 0);
  assert.equal(sections[1].depth, 1);
  assert.ok(sections[1].text.startsWith('The park is named after'));
});

check('citation apparatus is never mined for facts', () => {
  assert.equal(sectionInterest('References'), 0);
  assert.equal(sectionInterest('See also'), 0);
  assert.equal(sectionInterest('External links'), 0);
  assert.ok(sectionInterest('Etymology') > sectionInterest('History'));
  assert.ok(sectionInterest('History') > sectionInterest('Description'));
});

check('Dutch headings rank the same as their English equivalents', () => {
  // Only 18 of Amsterdam's 300 mapped bridges have an English article, so an
  // unrecognised "Externe links" would be mined as ordinary prose.
  assert.equal(sectionInterest('Externe links'), 0);
  assert.equal(sectionInterest('Zie ook'), 0);
  assert.equal(sectionInterest('Bronnen, noten en/of referenties'), 0);
  assert.equal(sectionInterest('Geschiedenis'), sectionInterest('History'));
  assert.equal(sectionInterest('Naamgeving'), sectionInterest('Etymology'));
  assert.equal(sectionInterest('Beschrijving'), sectionInterest('Description'));
});

check('the memorable sections are offered to the model first', () => {
  const passages = selectSourcePassages(splitArticleSections(ARTICLE));
  assert.deepEqual(passages.map((passage) => passage.section), ['Etymology', 'History'],
    'the lede is too short to mine here, and the apparatus is dropped entirely');
});

check('a short section is not offered, because a model asked to mine it invents', () => {
  const thin = splitArticleSections('== History ==\nOpened in 1865.');
  assert.deepEqual(selectSourcePassages(thin), []);
});

check('a long passage is cut at a sentence end', () => {
  const text = `${'First sentence here. '.repeat(20)}And a trailing clause that runs on`;
  const cut = truncateAtSentence(text, 100);
  assert.ok(cut.endsWith('.'), cut);
  assert.ok(cut.length <= 100);
});

// ---- Rotation ----

const fact = (text: string, kind: FactKind): Fact => ({
  text, kind, section: 'History', sourceUrl: 'https://en.wikipedia.org/wiki/Test',
  license: 'CC BY-SA 4.0', retrievedAt: '2026-09-01', model: 'ollama:test',
});

const FACTS: Fact[] = [
  fact('Named after the poet Joost van den Vondel.', 'naming'),
  fact('Laid out in 1865 by Jan David Zocher.', 'history'),
  fact('Its bandstand hosts free summer concerts.', 'culture'),
];

check('every fact is shown once before any is shown twice', () => {
  let state = emptyRotationState();
  const seen: string[] = [];
  for (let visit = 0; visit < 3; visit++) {
    const choice = chooseFact('vondelpark', FACTS, state)!;
    assert.equal(choice.repeat, false, `visit ${visit} repeated before exhausting the facts`);
    seen.push(choice.fact.text);
    state = recordShown(state, choice);
  }
  assert.equal(new Set(seen).size, 3, 'the same fact came round twice');
});

check('once exhausted, the oldest fact comes back first', () => {
  let state = emptyRotationState();
  const order: string[] = [];
  for (let visit = 0; visit < 4; visit++) {
    const choice = chooseFact('vondelpark', FACTS, state)!;
    order.push(choice.fact.text);
    state = recordShown(state, choice);
  }
  assert.equal(order[3], order[0], 'the fourth visit repeats the first fact, not the third');
});

check('the choice is not committed until the card is actually shown', () => {
  // A card can be chosen and then suppressed by a quiz prompt. That must not
  // burn the fact.
  const state = emptyRotationState();
  const first = chooseFact('vondelpark', FACTS, state)!;
  const again = chooseFact('vondelpark', FACTS, state)!;
  assert.equal(again.fact.text, first.fact.text);
  assert.deepEqual(state, emptyRotationState(), 'chooseFact mutated the state it was given');
});

check('a run of one kind is broken up across features', () => {
  // Three construction dates down one canal is four facts that feel like one.
  let state = emptyRotationState();
  const histories = [fact('Alpha bridge opened in 1901.', 'history'), fact('Alpha bridge was widened later.', 'design')];
  const mixed = [fact('Beta bridge is named for a toll house.', 'naming'), fact('Beta bridge opened in 1902.', 'history')];
  state = recordShown(state, chooseFact('alpha', histories, state)!);
  const next = chooseFact('beta', mixed, state)!;
  assert.equal(next.fact.kind, 'naming', 'the second feature repeated the kind just shown');
});

check('a feature with no facts yields nothing rather than an empty card', () => {
  assert.equal(chooseFact('nowhere', [], emptyRotationState()), null);
});

check('a fact keeps its place in history when its neighbours are regenerated', () => {
  const key = factKey('vondelpark', FACTS[0]);
  assert.equal(factKey('vondelpark', { text: '  Named after the poet Joost van den Vondel!  ' }), key,
    'punctuation and spacing changes are not a different fact');
  assert.notEqual(factKey('vondelpark', { text: 'Named after the poet Vondel.' }), key,
    'an edited fact is correctly treated as new');
  assert.notEqual(factKey('other', FACTS[0]), key, 'the same sentence about another feature is separate');
});

check('the expanded card shows other facts, not the one already on screen', () => {
  const expanded = expandedFacts(FACTS, FACTS[1].text);
  assert.equal(expanded.length, 2);
  assert.ok(!expanded.some((entry) => entry.text === FACTS[1].text));
  assert.equal(expanded[0].kind, 'naming', 'the more memorable kind leads');
});

check('saved rotation state cannot grow without bound', () => {
  const history: Record<string, number> = {};
  for (let index = 0; index < 5000; index++) history[`f:${index}`] = index;
  const pruned = pruneHistory({ history, shown: 5000, recentKinds: [] }, 100);
  assert.equal(Object.keys(pruned.history).length, 100);
  assert.ok(pruned.history['f:4999'] !== undefined, 'the most recent entries are the ones kept');
  assert.equal(pruned.history['f:0'], undefined);
});

// ---- Runtime seam ----

check('a published fact replaces the lede and carries its kind to the card', () => {
  const index = buildFactIndex({
    cityId: 'amsterdam', generatorVersion: 'facts-v2', generatedAt: '2026-09-01',
    features: [{ id: 'bridge:a', name: 'Alpha', collection: 'bridges', facts: FACTS }],
  });
  const chosen = factCardText('bridge:a', index, emptyRotationState());
  assert.ok(chosen);
  assert.equal(chosen.text.detail, chosen.choice.fact.text);
  assert.equal(chosen.text.factKind.length > 0, true);
  assert.equal(chosen.text.factTexts[0], chosen.text.detail);
});

check('a feature absent from the reviewed catalog keeps its lede', () => {
  assert.equal(factCardText('bridge:unreviewed', new Map(), emptyRotationState()), null);
});

check('showing a fact persists its rotation and corrupt storage fails open', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const choice = chooseFact('bridge:a', FACTS, emptyRotationState());
  assert.ok(choice);
  const committed = commitShownFact(storage, emptyRotationState(), choice);
  assert.deepEqual(loadRotationState(storage), committed);
  values.set(ROTATION_STORAGE_KEY, '{broken');
  assert.deepEqual(loadRotationState(storage), emptyRotationState());
});

// ---- What may ship ----

const STAGED: FeatureFacts[] = [
  { id: 'a', name: 'Alpha', collection: 'bridges', facts: [FACTS[0], FACTS[1]] },
  { id: 'b', name: 'Beta', collection: 'bridges', facts: [FACTS[2]] },
];

check('an unreviewed feature does not ship', () => {
  // Silence is not approval. An unreviewed batch publishing itself is how a
  // learning game starts teaching things nobody checked.
  const result = selectReviewedFacts(STAGED, { features: { a: { verdict: 'approved' } } }, 'facts-v2');
  assert.deepEqual(result.published.map((feature) => feature.id), ['a']);
  assert.deepEqual(result.rejected, [{ id: 'b', reason: 'unreviewed' }]);
});

check('a review written about an older generator ships nothing', () => {
  const result = selectReviewedFacts(STAGED, {
    generatorVersion: 'facts-v1',
    features: { a: { verdict: 'approved' }, b: { verdict: 'approved' } },
  }, 'facts-v2');
  assert.deepEqual(result.published, []);
  assert.equal(summariseRejections(result.rejected).get('review-predates-this-generator'), 2);
});

check('a struck sentence is dropped from an approved feature', () => {
  const result = selectReviewedFacts(STAGED, {
    generatorVersion: 'facts-v2',
    features: { a: { verdict: 'approved', drop: [FACTS[1].text] }, b: { verdict: 'approved' } },
  }, 'facts-v2');
  assert.deepEqual(result.published.find((feature) => feature.id === 'a')!.facts.map((f) => f.text),
    [FACTS[0].text]);
  assert.equal(result.rejected[0].reason, 'struck-by-reviewer');
});

check('approving a feature and striking all of it publishes nothing for it', () => {
  // Publishing an empty entry would leave the runtime a feature that opens a
  // card with nothing in it.
  const result = selectReviewedFacts(STAGED, {
    generatorVersion: 'facts-v2',
    features: { a: { verdict: 'approved', drop: [FACTS[0].text, FACTS[1].text] } },
  }, 'facts-v2');
  assert.equal(result.published.length, 0);
  assert.ok(result.rejected.some((entry) => entry.id === 'a' && entry.reason === 'human-rejected'));
});

check('a malformed verdict is not approval', () => {
  const result = selectReviewedFacts(STAGED,
    { generatorVersion: 'facts-v2', features: { a: { verdict: 'looks fine' } as never } }, 'facts-v2');
  assert.equal(result.published.length, 0);
  assert.equal(result.rejected[0].reason, 'invalid-verdict');
});

console.log(`Facts OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
