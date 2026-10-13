import assert from 'node:assert/strict';
import {
  cleanDescription,
  stripCountClauses,
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

// The first sentence is kept, but its count clause goes; later statistic sentences are dropped.
{
  const text = 'Overschie is a district of Rotterdam, with 19,745 inhabitants on 1 January 2023. Residents were moved out in 1950. The population was 300 in 1795.';
  const cleaned = cleanDescription(text);
  assert.equal(cleaned.text, 'Overschie is a district of Rotterdam. Residents were moved out in 1950.');
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

// First sentences: the count or area clause goes, the sentence stays grammatical.
{
  assert.equal(
    stripCountClauses("Zuid is one of Utrecht's ten districts (wijken), with 28,754 inhabitants (2025)."),
    "Zuid is one of Utrecht's ten districts (wijken).",
  );
  assert.equal(
    stripCountClauses('Overschie is a wijk and district of Rotterdam, with 19,745 inhabitants on 1 January 2023 and an area of 15.8 km².'),
    'Overschie is a wijk and district of Rotterdam.',
  );
  assert.equal(
    stripCountClauses('Lunetten is a neighbourhood in the southeastern part of the city of Utrecht, which has approximately 12,000 inhabitants.'),
    'Lunetten is a neighbourhood in the southeastern part of the city of Utrecht.',
  );
  // A mid-sentence clause keeps the comma that follows it.
  assert.equal(
    stripCountClauses('Spangen is a neighbourhood in the west of Rotterdam with about 10,000 inhabitants, reached from the centre over the Mathenesserbrug.'),
    'Spangen is a neighbourhood in the west of Rotterdam, reached from the centre over the Mathenesserbrug.',
  );
  assert.equal(
    stripCountClauses('Amsterdam-Noord (English: North Amsterdam) is a borough of Amsterdam, Netherlands with a population of about 90,000.'),
    'Amsterdam-Noord (English: North Amsterdam) is a borough of Amsterdam, Netherlands.',
  );
  assert.equal(
    stripCountClauses('Hillegersberg-Schiebroek is a borough in northern Rotterdam with 40,846 inhabitants (January 2008).'),
    'Hillegersberg-Schiebroek is a borough in northern Rotterdam.',
  );
  assert.equal(stripCountClauses('Overschie is a district (population 300) of Rotterdam.'), 'Overschie is a district of Rotterdam.');
  assert.equal(stripCountClauses('The Rivium is a 31.7-hectare wijk in Capelle aan den IJssel.'), 'The Rivium is a wijk in Capelle aan den IJssel.');
  // Whole predicates are never emptied: a count that is the verb phrase stays.
  assert.equal(stripCountClauses('The district has 10,000 inhabitants.'), 'The district has 10,000 inhabitants.');
  assert.equal(stripCountClauses('The district, with 10,000 inhabitants.'), 'The district, with 10,000 inhabitants.');
  // A list ("Terwijde-West, with 4,943 residents, and ...") and a count followed by more predicate are left alone.
  const list = 'Terwijde is split into Terwijde-West, with 4,943 residents, and Terwijde-Oost, with 3,665, on 1 January 2018.';
  assert.equal(stripCountClauses(list), list);
  const predicate = "Vleuten-De Meern is one of Utrecht's ten districts, made up of Vleuten; with over 51,200 inhabitants in 2024 it is the most populous.";
  assert.equal(stripCountClauses(predicate), predicate);
  // A sentence without a clause is returned byte-identical, even with odd spacing.
  assert.equal(stripCountClauses('Jordaan  is a neighbourhood of Amsterdam  .'), 'Jordaan  is a neighbourhood of Amsterdam  .');
  assert.equal(stripCountClauses('Bergpolder is a neighbourhood in Rotterdam-Noord with 8,205 inhabitants  (2021).'), 'Bergpolder is a neighbourhood in Rotterdam-Noord.');
  // cleanDescription applies it to the first sentence, also when the text is a single sentence.
  assert.equal(cleanDescription("Zuid is one of Utrecht's ten districts (wijken), with 28,754 inhabitants (2025).").countStripped?.after, "Zuid is one of Utrecht's ten districts (wijken).");
  assert.deepEqual(cleanDescription('The district has 10,000 inhabitants.'), { text: 'The district has 10,000 inhabitants.', dropped: [] });
  const second = cleanDescription('Zuid is a district. It had 28,754 inhabitants in 2025.');
  assert.equal(second.text, 'Zuid is a district.');
  assert.equal(second.dropped.length, 1);
}

console.log('Neighborhood text cleanup: statistics, count clauses, artefacts, borrowed histories, abbreviations and no-op passes checked.');
