import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  attachNameOrigins, attachNeighborhoodTrivia, descriptionWithoutOrigin, nearestAreaNames, originKindFor,
  notablePlacesIn, placeCandidates, placeCluesEnabled, type NeighborhoodHistoryEntry, type StreetNameOrigin,
} from '../src/mapRecall/trivia';
import { excludedBy, publishableFact, sentenceCandidates } from '../src/mapRecall/areaFacts';
import { applyReview, isDisambiguation, mentions, sentencesOf, tidy } from './fetch-neighborhood-history';

// Place clues are an easy/medium aid.
assert.equal(placeCluesEnabled('easy'), true);
assert.equal(placeCluesEnabled('medium'), true);
assert.equal(placeCluesEnabled('hard'), false);

// Kinds: a canal never takes a street's origin.
assert.equal(originKindFor('canal'), 'water');
assert.equal(originKindFor('square'), 'street');
assert.equal(originKindFor('neighborhood'), null);
const origins: StreetNameOrigin[] = [
  { name: 'Amstel', kind: 'water', en: 'The river.', bagId: '1' },
  { name: 'Amstel', kind: 'street', en: 'The street along the river.', bagId: '2' },
];
const [street, river, landmark] = attachNameOrigins([
  { name: 'Amstel', type: 'street' as const },
  { name: 'Amstel', type: 'canal' as const },
  { name: 'Amstel', type: 'landmark' as const },
], origins);
assert.equal(street.nameOrigin?.text, 'The street along the river.');
assert.match(street.nameOrigin!.sourceUrl, /openbareruimtes\/2\/$/);
assert.equal(river.nameOrigin?.text, 'The river.');
assert.equal(landmark.nameOrigin, undefined, 'landmarks are not in the street register');

// Neighbourhoods: description, photo, history and origin by exact name; the
// translated label says so.
const history: NeighborhoodHistoryEntry[] = [{
  name: 'Kattenburg',
  description: { en: 'Kattenburg is the westernmost island.', sourceUrl: 'https://nl.wikipedia.org/wiki/Kattenburg', lang: 'nl', original: 'x' },
  nameOrigin: { en: 'A kat was a defensive work.', sourceUrl: 'https://nl.wikipedia.org/wiki/Kattenburg', lang: 'nl', original: 'y' },
}];
const [hood, other] = attachNeighborhoodTrivia([
  { name: 'Kattenburg', type: 'neighborhood' as const },
  { name: 'Kattenburg', type: 'street' as const },
], history, [{ name: 'Kattenburg', imageUrl: 'https://upload.wikimedia.org/k.jpg' }]);
assert.equal(hood.wikipediaExtract, 'Kattenburg is the westernmost island.');
assert.equal(hood.wikipediaImageUrl, 'https://upload.wikimedia.org/k.jpg');
assert.equal(hood.nameOrigin?.sourceLabel, 'Wikipedia (translated from Dutch)');
assert.equal(other.nameOrigin, undefined, 'only neighbourhood features take neighbourhood trivia');

// A Wikipedia description links to its article and says so; the line never names Wikipedia for composed text.
const [article] = attachNeighborhoodTrivia([{ name: 'Kattenburg', type: 'neighborhood' as const }], history, []);
assert.equal(article.wikipediaUrl, 'https://nl.wikipedia.org/wiki/Kattenburg', 'links to the article');
assert.deepEqual(article.wikipediaExtractSource, { sourceUrl: 'https://nl.wikipedia.org/wiki/Kattenburg', sourceLabel: 'Wikipedia (translated from Dutch)' });
const [composed] = attachNeighborhoodTrivia([{ name: 'VU-kwartier', type: 'neighborhood' as const }], [{
  name: 'VU-kwartier',
  description: { en: 'VU-kwartier is a neighbourhood in Zuidas and Zuid, about 0.5 km².', sourceUrl: 'https://www.openstreetmap.org/copyright', lang: 'en', sourceLabel: 'OpenStreetMap and Gemeente Amsterdam data', kind: 'derived' },
}], []);
assert.equal(composed.wikipediaUrl, undefined, 'composed text has no Wikipedia page to link');
assert.deepEqual(composed.wikipediaExtractSource, { sourceUrl: 'https://www.openstreetmap.org/copyright', sourceLabel: 'OpenStreetMap and Gemeente Amsterdam data' });

// Text composed from data says where it came from, not "Wikipedia".
const [derived] = attachNeighborhoodTrivia([{ name: 'Sportheldenbuurt', type: 'neighborhood' as const }], [{
  name: 'Sportheldenbuurt',
  nameOrigin: { en: 'Many streets here are named after sportspeople.', sourceUrl: 'https://api.data.amsterdam.nl/v1/bag/openbareruimtes/', lang: 'en', sourceLabel: 'Gemeente Amsterdam street-name register', kind: 'derived' },
}], []);
assert.equal(derived.nameOrigin?.sourceLabel, 'Gemeente Amsterdam street-name register');

// No duplicate sentence when the lede already explains the name.
assert.equal(
  descriptionWithoutOrigin('Borneo-eiland is a peninsula. It takes its name from the Borneokade, named in 1917 after the island of Borneo.', 'Named after the Borneokade, which in 1917 was named after the island of Borneo.'),
  'Borneo-eiland is a peninsula.',
);
assert.equal(
  descriptionWithoutOrigin("The Staatsliedenbuurt (lit. 'Neighborhood of the Statesmen') is a neighborhood in Amsterdam borough of West. It lies south of the Haarlemmertrekvaart.", "Staatsliedenbuurt means 'Neighbourhood of the Statesmen': its streets were named after Dutch statesmen."),
  'It lies south of the Haarlemmertrekvaart.',
  'the shared gloss is not printed twice',
);
assert.equal(descriptionWithoutOrigin('A short one.', 'Named after something else entirely here.'), 'A short one.');

assert.deepEqual(nearestAreaNames([
  { name: 'Far', center: [52.40, 4.90] }, { name: 'Near', center: [52.371, 4.90] }, { name: 'Self', center: [52.37, 4.90] },
], { name: 'Self', center: [52.37, 4.90] }, 2), ['Near', 'Far']);

// Clue places: inside the area, best first, one shop or hotel of a kind, and never
// one naming an offered answer (it would give the question away).
const square: [number, number][][][] = [[[[52.0, 4.0], [52.0, 4.1], [52.1, 4.1], [52.1, 4.0], [52.0, 4.0]]]];
const candidates = placeCandidates(
  [{ name: 'Waag', center: [52.05, 4.05], type: 'landmark', prominenceScore: 10 }, { name: 'Canal Ring Area', center: [52.05, 4.05] }],
  { categories: ['lodging', 'food'], pois: [
    ['Hotel A', 4.05, 52.05, 0, 90], ['Hotel B', 4.05, 52.05, 0, 80], ['Hotel C', 4.05, 52.05, 0, 70],
    ['Jordaan Café', 4.05, 52.05, 1, 95], ['Outside', 4.5, 52.5, 1, 99], ['Bakery', 4.06, 52.06, 1, 10],
  ] },
);
assert.deepEqual(notablePlacesIn(square, candidates, ['Kattenburg', 'Jordaan']).map((place) => place.name), ['Waag', 'Hotel A', 'Bakery']);
assert.deepEqual(notablePlacesIn(undefined, candidates, []), []);

// Fetcher text handling: IPA and "lit." survive as one sentence.
const lede = tidy("The Staatsliedenbuurt (pronounced [ˈstaːtslidə(m)ˌbyːrt]; lit. 'Neighborhood of the Statesmen')\nis a neighborhood. == References ==");
assert.equal(sentencesOf(lede)[0], "The Staatsliedenbuurt (lit. 'Neighborhood of the Statesmen') is a neighborhood.");
assert.equal(isDisambiguation('Buitenveldert kan verwijzen naar: …'), true);
assert.equal(mentions('Overtoombuurt is a neighborhood of Amsterdam.', 'Helmersbuurt'), false, 'Helmersbuurt\'s Wikidata article is about Overtoombuurt');
assert.equal(mentions('De Prinses Irenebuurt is een buurt.', 'Prinses Irenebuurt e.o.'), true);

// Review: Dutch never ships unreviewed; a review against changed text is refused.
const staged = [{ name: 'X', description: { text: 'Een buurt.', lang: 'nl' as const, sourceUrl: 'u' }, history: { text: 'Old.', lang: 'en' as const, sourceUrl: 'h' } }];
assert.deepEqual(applyReview(staged, {}).published[0], { name: 'X', history: { en: 'Old.', sourceUrl: 'h', lang: 'en' } });
assert.equal(applyReview(staged, { X: { description: { from: 'Een buurt', en: 'A neighbourhood.' } } }).published[0].description?.en, 'A neighbourhood.');
assert.match(applyReview(staged, { X: { description: { from: 'Iets anders', en: 'x' } } }).problems[0], /source changed/);

// The published extract: every Dutch field carries its original and a translation.
const published = JSON.parse(readFileSync('public/data/extracts/amsterdam/neighborhood-history.json', 'utf8')).neighborhoods as NeighborhoodHistoryEntry[];
for (const entry of published) {
  for (const field of ['description', 'history', 'nameOrigin'] as const) {
    const text = entry[field];
    if (!text) continue;
    assert.ok(text.en && text.sourceUrl.startsWith('https://'), `${entry.name}.${field} has English and a source`);
    if (text.lang === 'nl') assert.ok(text.original, `${entry.name}.${field} keeps its Dutch original`);
  }
}
assert.match(published.find((entry) => entry.name === 'Staatsliedenbuurt')!.nameOrigin!.en, /Statesmen/);

// Local facts (scripts/mine-area-facts.ts). Named regression: Buitenveldert, Amsterdam's modern Jewish
// quarter, which the lede/History/name pipeline missed (user report 2026-10-02).
const buitenveldertEn = { lang: 'en' as const, title: 'Buitenveldert', url: 'https://en.wikipedia.org/wiki/Buitenveldert',
  text: 'Buitenveldert is a neighborhood of Amsterdam, Netherlands. It is considered the modern Jewish quarter of Amsterdam with its synagogue, Jewish schools, nursing homes, shops and restaurants.\n\n== Demographics ==\nAbout 12% of residents have a Moroccan background.' };
const mined = sentenceCandidates([buitenveldertEn], 'Buitenveldert', (text) => sentencesOf(tidy(text)));
assert.match(mined[0].text, /modern Jewish quarter/, 'the community sentence ranks first');
assert.ok(!mined.some((c) => /Moroccan|12%/.test(c.text)), 'resident statistics never reach the sheet');
assert.equal(excludedBy('In 2010 the police closed three coffeeshops.'), 'crime');
assert.equal(excludedBy('Opperrabbijn Aron Schuster opende in 1965 de eerste synagoge in de nieuwe wijk.'), null);
const cite = { from: 'It is considered', lang: 'en' as const, sourceUrl: buitenveldertEn.url, text: mined[0].text };
const pick = { en: "Buitenveldert is Amsterdam's modern Jewish quarter.", cites: [cite] };
assert.equal(publishableFact(pick, () => buitenveldertEn.text).problem, 'not approved', 'nothing ships unreviewed');
assert.deepEqual(publishableFact({ ...pick, approve: true }, () => buitenveldertEn.text).fact,
  { en: pick.en, sourceUrl: buitenveldertEn.url, lang: 'en', sourceLabel: 'Wikipedia', kind: 'derived' });
assert.match(publishableFact({ ...pick, approve: true }, () => 'The article was rewritten.').problem!, /no longer in/);
assert.match(publishableFact({ ...pick, en: 'Its first synagogue opened in 1965.', approve: true }, () => buitenveldertEn.text).problem!, /1965/, 'no number the sources do not state');
const [withFact] = attachNeighborhoodTrivia([{ name: 'Buitenveldert', type: 'neighborhood' as const }],
  [{ name: 'Buitenveldert', localFact: { ...publishableFact({ ...pick, approve: true }, () => buitenveldertEn.text).fact! } }], []);
assert.deepEqual(withFact.localFact, { text: pick.en, sourceUrl: buitenveldertEn.url, sourceLabel: 'Wikipedia' });

console.log('Map Recall trivia checks passed.');
