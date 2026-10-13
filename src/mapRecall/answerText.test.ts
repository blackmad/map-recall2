import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstSentence, historyHeading, ledeHeading, nameStem, nameSubject, placeKindTier, splitBorrowedHistory, tidyLede, withNamedSubject } from './answerText';
import { captionDistrict, postcardCaption, whereItIs } from './answerPlace';
import { answerTeaser } from './answerSummary';
import { attachNeighborhoodTrivia, descriptionWithoutOrigin, notablePlacesIn, placeCandidates } from './trivia';
import type { LocateHint } from './locateHints';
import type { TriviaText } from '../types';

const prinsengracht = "After 'the princely title', meaning that of the Princes of Orange. The canal is one of the three main canals, and the plainest in the character of its buildings. It was dug in the expansion of 1612.";
const janVeth = 'Painter and draughtsman (1864-1925), and also an art historian, who campaigned to preserve the beauty of Amsterdam.';
const mozes = 'After the two Old Testament figures Moses, leader of the exodus from Egypt, and Aaron, head of the priesthood. The street runs between the former city hall and the Nieuwe Kerk.';

test('first sentence keeps abbreviations, initials and parentheses together', () => {
  assert.equal(firstSentence(prinsengracht), "After 'the princely title', meaning that of the Princes of Orange.");
  assert.equal(firstSentence('Named after St. Nicholas, patron of sailors. Later a market.'), 'Named after St. Nicholas, patron of sailors.');
  assert.equal(firstSentence('Built ca. 1600 by the city. Rebuilt later.'), 'Built ca. 1600 by the city.');
  assert.equal(firstSentence('Dug c. 1650 as a moat. Filled in 1870.'), 'Dug c. 1650 as a moat.');
  assert.equal(firstSentence("The Grachtengordel (lit. 'canal belt') is a neighbourhood. It is old."), "The Grachtengordel (lit. 'canal belt') is a neighbourhood.");
  assert.equal(firstSentence('After A.J. Ernst, an engineer. He built dikes.'), 'After A.J. Ernst, an engineer.');
  assert.equal(firstSentence('After Jan P. Heije (1809-1876), poet. He wrote songs.'), 'After Jan P. Heije (1809-1876), poet.');
  assert.equal(firstSentence('Named after the Dutch East India Company (the V.O.C. Company). Then more.'), 'Named after the Dutch East India Company (the V.O.C. Company).');
  assert.equal(firstSentence('Maarten Jansz. Koster (1300s), a hermit. More.'), 'Maarten Jansz. Koster (1300s), a hermit.');
  assert.equal(firstSentence('One sentence only'), 'One sentence only');
  assert.equal(firstSentence("After 'the prince.' Then more."), "After 'the prince.'");
});

test('register prose without a subject is given one', () => {
  assert.equal(nameStem('Jan Vethstraat'), 'Jan Veth');
  assert.equal(nameStem('Mozes en Aäronstraat'), 'Mozes en Aäron');
  assert.equal(nameStem('Eerste Weteringdwarsstraat'), 'Eerste Wetering');
  assert.equal(nameStem('Damrak'), undefined);
  assert.equal(nameSubject('Korte Geuzenstraat'), 'Geuzen');
  assert.equal(nameSubject('Oude Nieuwstraat'), undefined);
  assert.equal(withNamedSubject('Benno Stokvisstraat', 'Benno Jules Stokvis (1901-1977), lawyer.'), 'Benno Jules Stokvis (1901-1977), lawyer.');
  assert.equal(withNamedSubject('Oude Nieuwstraat', 'By a council resolution of 1550 a new street was laid out.'), 'By a council resolution of 1550 a new street was laid out.');
  assert.equal(withNamedSubject('Nieuwe Oostenburgerstraat', 'Oostenburg was the easternmost of the three islands.'), 'Oostenburg was the easternmost of the three islands.');
  assert.equal(withNamedSubject('Stuurmankade', 'Someone who steers a vessel.'), 'Stuurman: Someone who steers a vessel.');
  assert.equal(withNamedSubject('Jan Vethstraat', janVeth), `Jan Veth: ${janVeth}`);
  assert.equal(withNamedSubject('Prinsengracht', prinsengracht), prinsengracht);
  assert.equal(withNamedSubject('Mozes en Aäronstraat', mozes), mozes);
  // Already names its subject.
  const baerle = 'Caspar van Baerle or Barlaeus (1584-1648), Remonstrant minister.';
  assert.equal(withNamedSubject('Van Baerlestraat', baerle), baerle);
  assert.equal(withNamedSubject('Sint Nicolaasstraat', 'Probably named after a small statue of the saint.'), 'Probably named after a small statue of the saint.');
  assert.equal(withNamedSubject('Hoofddorppleinbuurt', 'Its streets are named after painters.'), 'Its streets are named after painters.');
  assert.equal(withNamedSubject('Damrak', 'Painter.'), 'Painter.');
  assert.equal(withNamedSubject(undefined, janVeth), janVeth);
});

test('the fold is the first sentence of the name origin, with its subject', () => {
  const origin = (text: string) => ({ text, sourceUrl: 'u', sourceLabel: 'Gemeente Amsterdam street-name register' });
  assert.equal(answerTeaser({ name: 'Prinsengracht', nameOrigin: origin(prinsengracht) }), "After 'the princely title', meaning that of the Princes of Orange.");
  assert.equal(answerTeaser({ name: 'Jan Vethstraat', nameOrigin: origin(janVeth) }), `Jan Veth: ${janVeth}`);
  assert.equal(answerTeaser({ name: 'Mozes en Aäronstraat', nameOrigin: origin(mozes) }), 'After the two Old Testament figures Moses, leader of the exodus from Egypt, and Aaron, head of the priesthood.');
});

test('an IPA removal leaves no "(, " behind', () => {
  assert.equal(tidyLede("The Grachtengordel (, lit. 'canal belt/girdle'), known in English as the Canal District."), "The Grachtengordel (lit. 'canal belt/girdle'), known in English as the Canal District.");
  assert.equal(tidyLede('The Jordaan () is a neighbourhood.'), 'The Jordaan is a neighbourhood.');
  assert.equal(descriptionWithoutOrigin("The Grachtengordel (, lit. 'canal belt') is old.", undefined), "The Grachtengordel (lit. 'canal belt') is old.");
});

test('a borrowed history is headed by whose it is, in either data form', () => {
  const legacy = splitBorrowedHistory('Schinkel (waterway here): A dam blocked the river in 1434.');
  assert.deepEqual(legacy, { text: 'A dam blocked the river in 1434.', borrowedFrom: 'Schinkel (waterway)' });
  assert.deepEqual(splitBorrowedHistory('A dam blocked the river in 1434.', 'Schinkel (waterway)'), legacy);
  assert.deepEqual(splitBorrowedHistory('In 1900 it was built: houses.'), { text: 'In 1900 it was built: houses.', borrowedFrom: undefined });
  assert.equal(historyHeading('Schinkel (waterway)'), 'History of the Schinkel, which runs through here');
  assert.equal(historyHeading('Middenweg (street)'), 'History of Middenweg, which runs through here');
  assert.equal(historyHeading('Han van Zomerenbrug (bridge)'), 'History of the Han van Zomerenbrug, a bridge here');
  assert.equal(historyHeading('Solebayplein (square)'), 'History of Solebayplein, a square here');
  assert.equal(historyHeading('Bilderdijkpark (park)'), 'History of Bilderdijkpark, a park here');
  assert.equal(historyHeading(undefined), 'History');
  const entry = (history: { en: string; borrowedFrom?: string }) => [{ name: 'Hoofddorppleinbuurt', history: { ...history, sourceUrl: 'https://nl.wikipedia.org/wiki/Schinkel_(rivier)', lang: 'en' as const } }];
  for (const data of [entry({ en: 'Schinkel (waterway here): A dam blocked the river in 1434.' }), entry({ en: 'A dam blocked the river in 1434.', borrowedFrom: 'Schinkel (waterway)' })]) {
    const [hood] = attachNeighborhoodTrivia<{ name: string; type: 'neighborhood'; history?: TriviaText }>([{ name: 'Hoofddorppleinbuurt', type: 'neighborhood' }], data, []);
    assert.equal(hood.history?.text, 'A dam blocked the river in 1434.');
    assert.equal(hood.history?.borrowedFrom, 'Schinkel (waterway)');
  }
  const [own] = attachNeighborhoodTrivia<{ name: string; type: 'neighborhood'; history?: TriviaText }>([{ name: 'Jordaan', type: 'neighborhood' }], [{ name: 'Jordaan', history: { en: 'Built in 1612.', sourceUrl: 'https://x', lang: 'en' } }], []);
  assert.equal(own.history?.borrowedFrom, undefined);
});

test('a lede about a place in the area says which place', () => {
  assert.equal(ledeHeading('Orgelpark (landmark)'), 'About the Orgelpark, which is here');
  assert.equal(ledeHeading('Molenaarsweg (street)'), 'About Molenaarsweg, which runs through here');
  assert.equal(ledeHeading('Schinkel (waterway)'), 'About the Schinkel, which runs through here');
  assert.equal(ledeHeading('Gijsbrecht van Aemstelpark (park)'), 'About Gijsbrecht van Aemstelpark, which is here');
  assert.equal(ledeHeading(undefined), undefined);
  const description = (en: string, borrowedFrom?: string) => [{ name: 'Vondelparkbuurt', description: { en, borrowedFrom, sourceUrl: 'https://nl.wikipedia.org/wiki/Orgelpark', lang: 'en' as const } }];
  for (const data of [description('Orgelpark (landmark here): A concert hall in a former church.'), description('A concert hall in a former church.', 'Orgelpark (landmark)')]) {
    const [hood] = attachNeighborhoodTrivia<{ name: string; type: 'neighborhood'; wikipediaExtract?: string; wikipediaExtractSource?: { sourceUrl: string; sourceLabel: string; borrowedFrom?: string } }>([{ name: 'Vondelparkbuurt', type: 'neighborhood' }], data, []);
    assert.equal(hood.wikipediaExtract, 'A concert hall in a former church.');
    assert.equal(hood.wikipediaExtractSource?.borrowedFrom, 'Orgelpark (landmark)');
  }
});

test('around here names at most one shop, café or bike shop, after landmarks and schools', () => {
  const area: [number, number][][][] = [[[[52.0, 4.0], [52.0, 4.1], [52.1, 4.1], [52.1, 4.0], [52.0, 4.0]]]];
  // Hoofddorppleinbuurt-like: few encyclopedia landmarks, high-ranked chain stores.
  const candidates = placeCandidates(
    [{ name: 'Zeilbrug', center: [52.05, 4.05], type: 'landmark', prominenceScore: 2 }],
    { categories: ['culture', 'worship', 'education', 'health', 'civic', 'lodging', 'shop', 'bike', 'leisure', 'market', 'food'], pois: [
      ['HEMA', 4.05, 52.05, 6, 99], ['Retort', 4.05, 52.05, 10, 98], ['Daniel Tweewielers', 4.05, 52.05, 7, 97],
      ['Albert Heijn', 4.05, 52.05, 6, 96], ['Joop Westerweelschool', 4.06, 52.06, 2, 20], ['Sint Augustinuskerk', 4.06, 52.06, 1, 15],
      ['Speeltuin', 4.06, 52.06, 8, 12], ['Hotel Zuid', 4.06, 52.06, 5, 60],
    ] },
  );
  const names = notablePlacesIn(area, candidates, ['Hoofddorppleinbuurt']).map((place) => place.name);
  assert.deepEqual(names, ['Zeilbrug', 'Joop Westerweelschool', 'Sint Augustinuskerk', 'Speeltuin', 'Hotel Zuid']);
  const more = notablePlacesIn(area, candidates, ['Hoofddorppleinbuurt'], 7).map((place) => place.name);
  assert.deepEqual(more, [...names, 'HEMA'], 'one shop at most, the best ranked');
  assert.equal(placeKindTier('museum'), 0);
  assert.equal(placeKindTier('lodging'), 1);
  assert.equal(placeKindTier('bike'), 2);
});

const hint = (kind: LocateHint['kind'], reference: string, text: string): LocateHint => ({ kind, reference, text });

test('where it is: district, quarter and the nearest landmark, never the answer', () => {
  assert.equal(whereItIs([
    hint('district', 'Zuid', "It's in the Zuid district."),
    hint('water', 'Amstel', "It's southwest of the Amstel, about 1.4 km from it."),
    hint('part-of', 'Museumkwartier', "It's part of Museumkwartier."),
    hint('near', 'Van Gogh Museum', 'It passes within 200 m of the Van Gogh Museum.'),
  ], 'Van Baerlestraat'), 'Zuid district · part of Museumkwartier · passes within 200 m of the Van Gogh Museum');
  assert.equal(whereItIs([
    hint('district', 'Centrum', "It's in the Centrum district."),
    hint('inside', 'Anne Frank House + Westerkerk', 'It runs right past the Anne Frank House and the Westerkerk.'),
  ], 'Prinsengracht'), 'Centrum district · runs right past the Anne Frank House and the Westerkerk');
  assert.equal(whereItIs([
    hint('district', 'Zuid', "It's in the Zuid district."),
    hint('inside', 'Concertgebouw', 'The Concertgebouw is inside it.'),
  ], 'Museumkwartier'), 'Zuid district · home to the Concertgebouw');
  assert.equal(whereItIs([hint('water', 'Schinkel', 'It lies along the Schinkel.')], 'Hoofddorppleinbuurt'), 'Lies along the Schinkel');
  // A part that only repeats the answer's own name is dropped.
  assert.equal(whereItIs([hint('district', 'Zuid', "It's in the Zuid district."), hint('part-of', 'Museumkwartier', "It's part of Museumkwartier.")], 'Museumkwartier'), 'Zuid district');
  assert.equal(whereItIs([], 'X'), undefined);
});

test('postcard caption names the district when known', () => {
  const hints = [hint('district', 'Zuid', "It's in the Zuid district."), hint('part-of', 'Oud-Zuid', "It's part of Oud-Zuid.")];
  assert.equal(captionDistrict(hints), 'Zuid');
  assert.equal(captionDistrict([hints[1]]), 'Oud-Zuid');
  assert.equal(postcardCaption('Amsterdam', 'Zuid', 'Hoofddorppleinbuurt'), 'Zuid · Amsterdam');
  assert.equal(postcardCaption('Amsterdam', undefined, 'Hoofddorppleinbuurt'), 'Amsterdam');
  assert.equal(postcardCaption('Amsterdam', 'Noord', 'Noord'), 'Amsterdam', 'never repeats the answer');
  assert.equal(postcardCaption(undefined, 'Zuid', 'X'), undefined);
});
