import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  applyManualPoiOverrides,
  applyOverrides,
  auditCard,
  cardBodyText,
  cardOpens,
  dutchTokens,
  hollowCardsThatOpen,
  isDefinitionalOnly,
  overrideOpening,
  validateOverride,
  type CardAllowance,
  type CardOpenInput,
  type CardOverride,
} from './landmarkCardAudit';
import { mergeManualPoiFeatures } from '../game/manualPoiCatalog';
import type { LandmarkFeature } from '../game/extracts';

const overridesFile = JSON.parse(readFileSync(new URL('./landmark-card-overrides.json', import.meta.url), 'utf8')) as {
  overrides: CardOverride[];
  allowHollow: CardAllowance[];
};
const overrides = overridesFile.overrides;

type PublishedFeature = CardOpenInput & { sourceUrl?: string; manualPoi?: boolean };
const published = JSON.parse(readFileSync(new URL('../../../public/data/extracts/amsterdam/landmarks.json', import.meta.url), 'utf8')) as PublishedFeature[];
const publishedIds = new Set(published.map(feature => feature.id));

/** What the game builds once `audit:landmark-cards --publish` has run: the
 *  overrides in landmarks.json, the manual POI merge, and the kit-only POIs'
 *  overrides in manual-poi-data.json (applied here after the merge, which is
 *  where that file's funFact lands at runtime). */
function cardsAfterPublish(): PublishedFeature[] {
  const extract = applyOverrides(published, overrides).features;
  const merged = mergeManualPoiFeatures(extract as unknown as LandmarkFeature[], 'amsterdam') as unknown as PublishedFeature[];
  return applyOverrides(merged, overrides.filter(override => !publishedIds.has(override.id))).features;
}

const MULTATULI_ID = 'extract_landmarks_1627709377';
/** The only text the Multatuli bust's card had on 2026-10-16: the Wikidata
 *  description, which the card shows open and drops entirely once a drive-by
 *  card folds to its title line ("LANDMARK · W SOURCE · MULTATULI"). */
const MULTATULI_REPORTED = 'Public sculpture in Amsterdam, the Netherlands.';

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
  const { features, missing } = applyOverrides(published, overrides);
  // Only kit POIs absent from the extract miss it; they go through manual-poi-data.json.
  const merged = new Set(mergeManualPoiFeatures(published as unknown as LandmarkFeature[], 'amsterdam').map(feature => feature.id));
  for (const id of missing) assert.ok(merged.has(id), `override ${id} matches no landmark`);
  const bartolotti = features.find(feature => feature.id === BARTOLOTTI_ID)!;
  assert.deepEqual(auditCard(bartolotti).issues, []);
  // Idempotent: applying twice changes nothing.
  assert.deepEqual(applyOverrides(features, overrides).features, features);
});

test('regression: the Multatuli bust (Torensluis) opened a card with nothing worth reading', () => {
  // The card as reported, before `--publish` wrote the override's funFact into the extract (the test holds either way).
  const { funFact: _f, funFactSourceUrl: _u, ...reported } = published.find(feature => feature.id === MULTATULI_ID)! as PublishedFeature & { funFact?: string; funFactSourceUrl?: string };
  void _f; void _u;
  assert.equal(reported.name, 'Multatuli');
  // A photo makes the card open; the text is only the Wikidata one-liner.
  assert.equal(cardBodyText(reported), MULTATULI_REPORTED);
  assert.ok(cardOpens(reported));
  assert.ok(auditCard(reported).issues.includes('stub'));
  assert.deepEqual(hollowCardsThatOpen([reported]).map(card => card.issue), ['stub']);
});

test('regression: the Multatuli bust has a sourced English card that reaches the game', () => {
  const override = overrides.find(entry => entry.id === MULTATULI_ID);
  assert.ok(override, 'Multatuli override is missing');
  assert.deepEqual(validateOverride(override), []);
  assert.equal(override.replaces, MULTATULI_REPORTED);
  // The sculptor, the year, the writer behind the pen name, and the book.
  for (const needle of ['Hans Bayens', '1987', 'Eduard Douwes Dekker', 'Max Havelaar', 'I have suffered much']) {
    assert.ok(override.text.includes(needle), `override lacks "${needle}"`);
  }
  // Each fact rests on a verbatim source: the bridge article for the bust,
  // the writer's article for the name and the novel.
  assert.equal(override.sourceUrl, 'https://nl.wikipedia.org/wiki/Torensluis');
  assert.match(override.sourceQuote, /sinds 1987 een bronzen borstbeeld van Multatuli \(Eduard Douwes Dekker\), gemaakt door Hans Bayens/);
  assert.equal(override.extraSources?.[0]?.sourceUrl, 'https://en.wikipedia.org/wiki/Multatuli');
  assert.match(override.extraSources![0].sourceQuote, /Max Havelaar \(1860\), which denounced the abuses of colonialism/);
  // The bridge can be a crossing question: the card must not name it.
  assert.ok(!override.text.includes('Torensluis'));

  const card = cardsAfterPublish().find(feature => feature.id === MULTATULI_ID)!;
  assert.equal(cardBodyText(card), override.text);
  assert.ok(cardOpens(card));
  assert.deepEqual(auditCard(card).issues, []);
  assert.equal(isDefinitionalOnly(cardBodyText(card), card.name), false);
  // "W SOURCE" now opens the article the text came from, not a Commons photo category.
  assert.equal(card.sourceUrl, 'https://nl.wikipedia.org/wiki/Torensluis');
});

test('gate: no card opens empty or with only a Wikidata one-liner unless allowlisted with a reason', () => {
  const cards = cardsAfterPublish();
  const hollow = hollowCardsThatOpen(cards, overridesFile.allowHollow);
  assert.deepEqual(hollow, [], `hollow cards that open:\n${hollow.map(card => `  ${card.id} ${card.name} (${card.issue})`).join('\n')}`);
  // Every allowance is still needed and says why.
  const stillHollow = new Set(hollowCardsThatOpen(cards).map(card => card.id));
  for (const allowance of overridesFile.allowHollow) {
    assert.ok(allowance.reason.trim().length > 20, `${allowance.name}: allowance needs a reason`);
    assert.ok(stillHollow.has(allowance.id), `${allowance.name}: allowance is stale (the card is filled or no longer opens)`);
    assert.ok(!overrides.some(override => override.id === allowance.id), `${allowance.name}: both an override and an allowance`);
  }
});

test('kit POIs absent from the extract get their override through manual-poi-data.json', () => {
  const override = overrides.find(entry => entry.id === 'osm_node_3975877474');
  assert.ok(override, 'Het Lieverdje override is missing');
  const models = [
    { id: 'lieverdje', landmarkId: 'osm_node_3975877474', name: 'Het Lieverdje (Spui)' },
    { id: 'kept', landmarkId: 'osm_kept', name: 'Kept' },
    { id: 'extract-model', landmarkId: MULTATULI_ID, name: 'Multatuli' },
  ];
  const facts = [{ modelId: 'kept', landmarkId: 'osm_kept', name: 'Kept', sourceUrl: 'https://example.org/', description: 'Kept as is.' }];
  const extra: CardOverride = { ...override, id: 'osm_kept', text: 'Opened in 1901.', sourceUrl: 'https://nl.wikipedia.org/wiki/Kept' };
  const multatuli = overrides.find(entry => entry.id === MULTATULI_ID)!;
  const { facts: next, applied } = applyManualPoiOverrides(facts, [override, extra, multatuli], models, publishedIds);
  // Created for a model with no entry; merged into an existing one; an
  // extract landmark is left to applyOverrides.
  assert.deepEqual(applied, ['osm_node_3975877474', 'osm_kept']);
  assert.deepEqual(next.find(fact => fact.modelId === 'lieverdje'), {
    modelId: 'lieverdje', landmarkId: 'osm_node_3975877474', name: 'Het Lieverdje (Spui)', funFact: override.text, sourceUrl: override.sourceUrl,
  });
  assert.deepEqual(next.find(fact => fact.modelId === 'kept'), { ...facts[0], funFact: 'Opened in 1901.', sourceUrl: 'https://nl.wikipedia.org/wiki/Kept' });
  assert.equal(facts[0].sourceUrl, 'https://example.org/', 'input is not mutated');
  // Idempotent.
  assert.deepEqual(applyManualPoiOverrides(next, [override, extra], models, publishedIds).facts, next);
  // And the merge then shows it: Het Lieverdje's card now opens with text.
  const lieverdje = cardsAfterPublish().find(feature => feature.id === 'osm_node_3975877474')!;
  assert.equal(cardBodyText(lieverdje), override.text);
  assert.ok(cardOpens(lieverdje));
});

test('cardOpens: a photo or an article opens a card; nothing does not', () => {
  assert.equal(cardOpens({ id: 'a', name: 'A' }), false);
  assert.equal(cardOpens({ id: 'a', name: 'A', wikipediaImageUrl: 'https://upload.wikimedia.org/x.jpg' }), true);
  assert.equal(cardOpens({ id: 'a', name: 'A', wikipediaUrl: 'https://nl.wikipedia.org/wiki/A' }), true);
  assert.equal(cardOpens({ id: 'a', name: 'A', funFact: 'Built in 1620.' }), true);
  // An empty card that opens is hollow; a stub too; a real text is not.
  assert.deepEqual(hollowCardsThatOpen([
    { id: 'e', name: 'E', wikipediaImageUrl: 'https://upload.wikimedia.org/e.jpg' },
    { id: 's', name: 'S', wikipediaExtract: 'Sculpture in Amsterdam.', wikipediaExtractSource: 'wikidata-description' },
    { id: 'f', name: 'F', funFact: 'Built in 1620.', wikipediaExtract: 'Sculpture in Amsterdam.', wikipediaExtractSource: 'wikidata-description' },
    { id: 'n', name: 'N' },
  ]).map(card => `${card.id}:${card.issue}`), ['e:empty', 's:stub']);
  assert.deepEqual(hollowCardsThatOpen([{ id: 'e', name: 'E', wikipediaUrl: 'https://x' }], [{ id: 'e', name: 'E', reason: 'r' }]), []);
});

test('validateOverride checks every extra source like the primary one', () => {
  const multatuli = overrides.find(entry => entry.id === MULTATULI_ID)!;
  const broken: CardOverride = { ...multatuli, extraSources: [{ sourceUrl: 'https://example.com/', articleTitle: '', sourceLanguage: 'en', sourceQuote: ' ' }] };
  const problems = validateOverride(broken).map(problem => problem.problem);
  assert.ok(problems.includes('extraSources[0] sourceUrl is not a Wikipedia article'));
  assert.ok(problems.includes('extraSources[0] no sourceQuote'));
  assert.ok(problems.includes('extraSources[0] no articleTitle'));
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
