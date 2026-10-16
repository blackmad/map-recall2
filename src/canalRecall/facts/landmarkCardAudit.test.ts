import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  applyOverrides,
  auditCard,
  cardBodyText,
  dutchTokens,
  isDefinitionalOnly,
  overrideOpening,
  validateOverride,
  type CardOverride,
} from './landmarkCardAudit';

const overrides = (JSON.parse(readFileSync(new URL('./landmark-card-overrides.json', import.meta.url), 'utf8')) as {
  overrides: CardOverride[];
}).overrides;

const BARTOLOTTI_ID = 'extract_landmarks_1450151185';
/** What the arrival card said on 2026-10-16 (user report). */
const BARTOLOTTI_REPORTED = 'Het Huis Bartolotti (also Het Bonte Huis) is a canal house at Herengracht 170-172 in Amsterdam.';

test('regression: Huis Bartolotti (Herengracht 170-172), the reported card, is flagged as both defects', () => {
  const card = auditCard({
    id: BARTOLOTTI_ID,
    name: 'Huis Bartolotti',
    // The published extract: the bare lede, then a 260-character second
    // sentence that `splitDetail` drops for overflowing the 280 cap.
    wikipediaExtract: `${BARTOLOTTI_REPORTED} It was built around 1617 for Willem van den Heuvel tot Beichlingen, one of the richest Amsterdamers of that time, who had inherited a lot of money from a childless married uncle, Giovanni Battista Bartolotti, a merchant from Bologna. In the will of this uncle`,
    wikipediaExtractLang: 'en',
    wikipediaExtractSource: 'translated',
  });
  assert.equal(card.text, BARTOLOTTI_REPORTED);
  assert.deepEqual(card.issues, ['definitional', 'dutch']);
  assert.deepEqual(card.dutchTokens, ['Het']);
});

test('regression: Huis Bartolotti has a sourced English override that passes the audit', () => {
  const override = overrides.find(entry => entry.id === BARTOLOTTI_ID);
  assert.ok(override, 'Huis Bartolotti override is missing');
  assert.deepEqual(validateOverride(override), []);
  assert.equal(override.sourceUrl, 'https://nl.wikipedia.org/wiki/Huis_Bartolotti');
  assert.equal(override.sourceLanguage, 'nl');
  assert.equal(override.replaces, BARTOLOTTI_REPORTED);
  // The facts the user asked for: the date, the patron and his name, the
  // architect, and the bend in the facade.
  for (const needle of ['1617', 'Willem van den Heuvel', 'Bartolotti', 'Hendrick de Keyser', 'curve of the Herengracht']) {
    assert.ok(override.text.includes(needle), `override lacks "${needle}"`);
  }
  // The Dutch original travels with it, so a translation pass can resume.
  assert.match(override.sourceQuote, /Het is circa 1617 gebouwd voor Willem van den Heuvel/);
  assert.equal(cardBodyText({ funFact: override.text }), override.text);
  assert.ok(!/\bHet\b/.test(override.text));
});

test('regression: Huis Bartolotti in the published extract is clean once overrides apply', () => {
  const landmarks = JSON.parse(readFileSync(new URL('../../../public/data/extracts/amsterdam/landmarks.json', import.meta.url), 'utf8')) as Array<{
    id: string; name: string; funFact?: string; wikipediaExtract?: string; wikipediaExtractLang?: string; wikipediaExtractSource?: string;
  }>;
  const { features, missing } = applyOverrides(landmarks, overrides);
  assert.deepEqual(missing, []);
  const bartolotti = features.find(feature => feature.id === BARTOLOTTI_ID)!;
  assert.deepEqual(auditCard(bartolotti).issues, []);
  // Idempotent: applying twice changes nothing.
  assert.deepEqual(applyOverrides(features, overrides).features, features);
});

test('every curated override fits the card, carries a source and passes the audit', () => {
  assert.ok(overrides.length >= 20);
  const ids = new Set<string>();
  for (const override of overrides) {
    assert.ok(!ids.has(override.id), `duplicate override ${override.id}`);
    ids.add(override.id);
    assert.deepEqual(validateOverride(override), [], override.name);
    assert.ok(override.replaces, `${override.name}: replaces is empty`);
    assert.ok(overrideOpening(override).length <= 150);
  }
});

test('definitional: a what-and-where sentence with no date, person or event', () => {
  assert.equal(isDefinitionalOnly('Rialto is a cinema at Ceintuurbaan in the De Pijp neighborhood in Amsterdam.', 'Rialto'), true);
  assert.equal(isDefinitionalOnly('The Sloterkerk is a Protestant church in Sloten, North Holland.', 'Sloterkerk'), true);
  assert.equal(isDefinitionalOnly('The Monument voor Anton de Kom is an artwork in Amsterdam-Zuidoost.', 'Anton de Kom'), true);
  // A date, a person or an event each lift it out.
  assert.equal(isDefinitionalOnly('The Westerkerk is a church built between 1620 and 1631.', 'Westerkerk'), false);
  assert.equal(isDefinitionalOnly('The Van Gogh Museum is a Dutch art museum dedicated to the works of Vincent van Gogh.', 'Van Gogh Museum'), false);
  assert.equal(isDefinitionalOnly('Brakke Grond is a Flemish cultural center. The current building is a design by architect Arthur Staal.', 'Brakke Grond'), false);
  // A curated reason ("so") is more than a definition.
  assert.equal(isDefinitionalOnly('The building is the head of its block, so its garden side stands free.', 'Da Costakade 13'), false);
  // Not a definition at all.
  assert.equal(isDefinitionalOnly('Rembrandt bought this house in 1639.', 'Rembrandt House'), false);
});

test('dutch: leftover function words and articles, not names or glosses', () => {
  assert.deepEqual(dutchTokens('Amsterdam dankt zijn Canadezen is a monument in the Canadezenplantsoen.', 'Amsterdam Memorial'), ['zijn']);
  assert.deepEqual(dutchTokens('The museum is gelegen aan the canal.'), ['gelegen', 'aan']);
  // Glosses and quotations may be Dutch.
  assert.deepEqual(dutchTokens('The Royal Concertgebouw (Dutch: het Koninklijk Concertgebouw, pronounced [ət]) is a concert hall.'), []);
  assert.deepEqual(dutchTokens('Insiders nicknamed it "het grijze monument van de richtige heffing" (the grey monument).'), []);
  // A Dutch word inside a proper name is part of the name.
  assert.deepEqual(dutchTokens('The Huis aan de Drie Grachten is a canal house.'), []);
  assert.deepEqual(dutchTokens('Muziekgebouw aan \'t IJ is a concert hall.'), []);
  // English words that happen to be Dutch too.
  assert.deepEqual(dutchTokens('People enter through a small side door, where the officials met.'), []);
  // A Dutch article in front of the feature's own name is a translator
  // artefact only in machine-translated text.
  assert.deepEqual(dutchTokens(BARTOLOTTI_REPORTED, 'Huis Bartolotti', true), ['Het']);
  assert.deepEqual(dutchTokens(BARTOLOTTI_REPORTED, 'Huis Bartolotti', false), []);
  assert.deepEqual(dutchTokens('Het Ketelhuis is a film theatre.', 'Het Ketelhuis', true), []);
});

test('validateOverride rejects text that would be cut, unsourced or still Dutch', () => {
  const base: CardOverride = {
    id: 'x', name: 'Example', text: 'Built in 1620 by Hendrick de Keyser.', sourceUrl: 'https://en.wikipedia.org/wiki/Example',
    articleTitle: 'Example', sourceLanguage: 'en', sourceQuote: 'Built in 1620.', license: 'CC BY-SA 4.0', retrievedAt: '2026-10-16',
    translator: 'test', replaces: 'Example is a house in Amsterdam.',
  };
  assert.deepEqual(validateOverride(base), []);
  assert.ok(validateOverride({ ...base, text: `${'Built in 1620 by a merchant whose name was long. '.repeat(6)}` }).length);
  assert.ok(validateOverride({ ...base, sourceUrl: 'https://example.com/' }).some(p => /Wikipedia/.test(p.problem)));
  assert.ok(validateOverride({ ...base, sourceQuote: '' }).some(p => /sourceQuote/.test(p.problem)));
  assert.ok(validateOverride({ ...base, text: 'Example is a house in Amsterdam.' }).some(p => /definitional/.test(p.problem)));
  assert.ok(validateOverride({ ...base, text: 'Built in 1620 aan the canal.' }).some(p => /dutch/.test(p.problem)));
});

test('cardBodyText reproduces the card: funFact first, whole sentences up to 280 characters', () => {
  assert.equal(cardBodyText({ funFact: 'A. B.', wikipediaExtract: 'C.' }), 'A. B.');
  assert.equal(cardBodyText({ wikipediaExtract: 'Short. Second.' }), 'Short. Second.');
  assert.equal(cardBodyText({}), '');
  assert.equal(auditCard({ id: 'e', name: 'E' }).issues[0], 'empty');
});
