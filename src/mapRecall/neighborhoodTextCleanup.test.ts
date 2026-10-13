import assert from 'node:assert/strict';
import {
  cleanDescription,
  cleanEntry,
  extractBorrowedHistory,
  normalizeArtifacts,
  splitSentences,
} from './neighborhoodTextCleanup.ts';

// 1. Statistics: the Hoofddorppleinbuurt lede drops its resident count and keeps the lede.
{
  const text = 'Hoofddorppleinbuurt is a neighborhood of Amsterdam, Netherlands, part of the borough of Amsterdam-Zuid. The district had 10,771 inhabitants as of 1 January 2005. The total area is 96.71 hectares. It is known for its Amsterdam School housing.';
  const cleaned = cleanDescription(text);
  assert.equal(cleaned.text, 'Hoofddorppleinbuurt is a neighborhood of Amsterdam, Netherlands, part of the borough of Amsterdam-Zuid. It is known for its Amsterdam School housing.');
  assert.equal(cleaned.dropped.length, 2);
  assert.match(cleaned.dropped[0], /^statistics: The district had 10,771 inhabitants/);
  assert.match(cleaned.dropped[1], /^area: The total area is 96\.71 hectares/);
}

// 2. Pronunciation artefact: "(, lit." loses its comma and the text reads cleanly.
{
  assert.equal(
    normalizeArtifacts("The Grachtengordel (, lit. 'canal belt/girdle'), known in English as the Canal District, is a neighborhood."),
    "The Grachtengordel (lit. 'canal belt/girdle'), known in English as the Canal District, is a neighborhood.",
  );
  assert.equal(normalizeArtifacts('Name () , known  for things .'), 'Name, known for things.');
  assert.equal(normalizeArtifacts('Name ( ) and more.'), 'Name and more.');
}

// 3. Borrowed history: the landmark prefix moves to borrowedFrom.
{
  const borrowed = extractBorrowedHistory('Schinkel (waterway here): A dam blocked the river in 1434 to stop shipping.');
  assert.equal(borrowed.borrowedFrom, 'Schinkel (waterway)');
  assert.equal(borrowed.text, 'A dam blocked the river in 1434 to stop shipping.');
  assert.deepEqual(extractBorrowedHistory('A dam blocked the river.'), { text: 'A dam blocked the river.' });
}

// Keep the first sentence even when it carries a statistic; drop the rest.
{
  const text = 'Overschie is a district of Rotterdam, with 19,745 inhabitants on 1 January 2023. Residents were moved out in 1950. The population was 300 in 1795.';
  const cleaned = cleanDescription(text);
  assert.equal(cleaned.text, 'Overschie is a district of Rotterdam, with 19,745 inhabitants on 1 January 2023. Residents were moved out in 1950.');
  assert.equal(cleaned.dropped.length, 1);
  const onlyFirst = cleanDescription('Fascinatio is a wijk. It had about 3,000 inhabitants on 1 January 2018.');
  assert.equal(onlyFirst.text, 'Fascinatio is a wijk.');
}

// No change: text without statistics or artefacts is returned byte-identical.
{
  const text = 'Jordaan is a neighbourhood of Amsterdam. The February strike of 1941 started on Noordermarkt. It is known for its canals.';
  assert.deepEqual(cleanDescription(text), { text, dropped: [] });
  assert.equal(normalizeArtifacts(text), text);
  const entry = { name: 'Jordaan', description: { en: text, sourceUrl: 'https://example.org', lang: 'en' } };
  const result = cleanEntry(entry);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.entry, entry);
}

// Abbreviations and initials do not end sentences; the statistic after them is still dropped.
{
  const text = 'The Oude Kerk is a church in Utrecht. St. Jacobuskerk and ca. 1900 buildings stand nearby, e.g. the Dom. J. R. Tolkien lived here. A.J. Smith wrote about the area. It had 5,000 residents in 2010.';
  assert.deepEqual(splitSentences(text), [
    'The Oude Kerk is a church in Utrecht.',
    'St. Jacobuskerk and ca. 1900 buildings stand nearby, e.g. the Dom.',
    'J. R. Tolkien lived here.',
    'A.J. Smith wrote about the area.',
    'It had 5,000 residents in 2010.',
  ]);
  const cleaned = cleanDescription(text);
  assert.equal(cleaned.dropped.length, 1);
  assert.ok(cleaned.text.includes('St. Jacobuskerk'));
}

// Years are not statistics; a percentage without people is not either.
{
  const text = 'Heijplaat is a wijk. Residents financed the footbridge built in 1927. Subsidies covered up to about 20% of the cost of workers homes.';
  assert.deepEqual(cleanDescription(text).dropped, []);
}

// Crime and planning sentences are history, not statistics, and are kept.
{
  const text = 'Weesperbuurt is a neighbourhood. Many of its residents were deported and murdered. The Escamp borough was formed in 1986, after the city council decided to divide The Hague into seven boroughs. Police officers came in 1920.';
  assert.deepEqual(cleanDescription(text), { text, dropped: [] });
}

// A landmark prefix on a description is extracted too, with the same contract.
{
  const entry = {
    name: 'Samen',
    description: { en: 'Samen Spelen Samen Leven (landmark here): The playground was built in 1950.', sourceUrl: 'https://example.org', lang: 'en' as const },
  };
  const result = cleanEntry(entry);
  assert.equal(result.entry.description?.en, 'The playground was built in 1950.');
  assert.equal((result.entry.description as { borrowedFrom?: string } | undefined)?.borrowedFrom, 'Samen Spelen Samen Leven (landmark)');
  assert.deepEqual(result.changes.map(c => c.kind), ['borrowed']);
  assert.deepEqual(cleanEntry(result.entry).changes, []);
}

// Entry-level: all four fields, key order kept, borrowedFrom recorded, re-run is a no-op.
{
  const entry = {
    name: 'Grachtengordel',
    description: { en: 'The Grachtengordel (, lit. \'canal belt\') is a neighborhood. It had 9,000 inhabitants in 2011.', sourceUrl: 'https://en.wikipedia.org/wiki/x', lang: 'en' as const },
    history: { en: 'Schinkel (waterway here): A dam blocked the river in 1434.', sourceUrl: 'https://en.wikipedia.org/wiki/y', lang: 'en' as const, original: 'orig' },
  };
  const first = cleanEntry(entry);
  assert.deepEqual(first.changes.map(c => c.kind), ['artefact', 'drop', 'borrowed']);
  assert.equal(first.entry.description?.en, "The Grachtengordel (lit. 'canal belt') is a neighborhood.");
  assert.deepEqual(Object.keys(first.entry.history ?? {}), ['en', 'sourceUrl', 'lang', 'original', 'borrowedFrom']);
  assert.equal((first.entry.history as { borrowedFrom?: string } | undefined)?.borrowedFrom, 'Schinkel (waterway)');
  assert.equal(first.entry.history?.en, 'A dam blocked the river in 1434.');
  assert.deepEqual(cleanEntry(first.entry).changes, []);
}

console.log('Neighborhood text cleanup: statistics, artefacts, borrowed histories, abbreviations and no-op passes checked.');
