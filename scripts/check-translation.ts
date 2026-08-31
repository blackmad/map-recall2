/**
 * The English-translation pass's decisions, checked without a translator
 * installed. `translate` and `trn` both need macOS 26, so CI and most
 * development machines cannot run the real thing — which is exactly why the
 * rules they do not enforce themselves live in a testable module.
 */
import assert from 'node:assert/strict';
import {
  cleanTranslatorOutput,
  droppedProperNames,
  MAX_EXTRACT_CHARS,
  translatorArgs,
  trimToSentence,
} from './lib/translation.ts';

let checks = 0;
const check = (label: string, run: () => void) => { run(); checks++; void label; };

// --- Both tools are driven the same way ------------------------------------
check('the language pair is passed the same way to either tool', () => {
  assert.deepEqual(translatorArgs('translate', 'nl'), ['--from', 'nl', '--to', 'en']);
  assert.deepEqual(translatorArgs('trn', 'nl'), ['--from', 'nl', '--to', 'en', '--quality', 'high']);
  // A source language other than Dutch is passed through, not assumed away.
  assert.deepEqual(translatorArgs('translate', 'de'), ['--from', 'de', '--to', 'en']);
});

// --- stdout is prose, not a transcript -------------------------------------
check('output is collapsed to one line and unquoted', () => {
  assert.equal(cleanTranslatorOutput('  The Old Church is the oldest building.  '),
    'The Old Church is the oldest building.');
  assert.equal(cleanTranslatorOutput('The Old Church\nis the oldest\nbuilding.'),
    'The Old Church is the oldest building.');
  assert.equal(cleanTranslatorOutput('"The Old Church is the oldest building."'),
    'The Old Church is the oldest building.');
  assert.equal(cleanTranslatorOutput(''), '');
  // A quote that is part of the sentence is not a wrapper and stays.
  assert.equal(cleanTranslatorOutput('The bridge known as "Skinny Bridge" is old.'),
    'The bridge known as "Skinny Bridge" is old.');
});

// --- A lede is cut at a sentence, not mid-clause ---------------------------
check('a short lede is untouched', () => {
  const short = 'The Oude Kerk is the oldest building in Amsterdam.';
  assert.equal(trimToSentence(short), short);
});

check('a long lede is cut at the last sentence that fits', () => {
  const text = 'The Oude Kerk is the oldest building in Amsterdam. '
    + 'It was founded in 1213 and consecrated in 1306 by the bishop of Utrecht. '
    + 'It stands on the Oudekerksplein in the middle of De Wallen. '
    + 'Since 2015 it has doubled as a venue for contemporary art, and its wooden vault '
    + 'is the largest medieval wooden vault in Europe by a considerable margin, which '
    + 'is the kind of detail that pushes a lede past the length a card can hold.';
  const trimmed = trimToSentence(text);
  assert.ok(trimmed.length <= MAX_EXTRACT_CHARS, `${trimmed.length} chars`);
  assert.ok(trimmed.endsWith('.'), `did not end at a sentence: ${JSON.stringify(trimmed.slice(-40))}`);
  assert.ok(text.startsWith(trimmed), 'the cut is a prefix of the source');
  assert.ok(trimmed.includes('De Wallen'), 'it keeps every sentence that fits');
  assert.ok(!trimmed.includes('contemporary art'), 'and drops the one that does not');
});

check('an abbreviation mid-sentence is not mistaken for the end', () => {
  // "St." is followed by a space, so a naive rule would cut here. The cut is
  // still allowed to land on it only if nothing better fits; what matters is
  // that a later real boundary wins.
  const text = `${'The bridge is named for St. Anthony and carries traffic over the canal. '.repeat(3)}It was rebuilt in 1968.`;
  const trimmed = trimToSentence(text, 200);
  assert.ok(trimmed.length <= 200);
  assert.ok(trimmed.endsWith('canal.'), `cut landed badly: ${JSON.stringify(trimmed.slice(-30))}`);
});

check('prose with no sentence boundary at all falls back to a word cut', () => {
  const runOn = 'a'.repeat(50) + ' ' + 'b'.repeat(50) + ' ' + 'c'.repeat(50);
  const trimmed = trimToSentence(runOn, 80);
  assert.ok(trimmed.length <= 81, `${trimmed.length} chars`);
  assert.ok(trimmed.endsWith('…'), 'a word cut is marked as one');
  assert.ok(!trimmed.includes('  '), 'and does not keep the trailing space');
});

check('a first sentence longer than the cap is cut on a word, not kept whole', () => {
  const text = `${'word '.repeat(200)}. Short one.`;
  const trimmed = trimToSentence(text);
  assert.ok(trimmed.length <= MAX_EXTRACT_CHARS + 1, `${trimmed.length} chars`);
});

// --- A translated street name teaches the wrong name -----------------------
check('a preserved name is not reported', () => {
  assert.deepEqual(
    droppedProperNames(
      'De Blauwbrug is een brug over de Amstel in Amsterdam.',
      'The Blauwbrug is a bridge over the Amstel in Amsterdam.',
      ['Blauwbrug']),
    []);
});

check('a name the translator rendered into English is reported', () => {
  assert.deepEqual(
    droppedProperNames(
      'De Blauwbrug is een brug over de Amstel in Amsterdam.',
      'The Blue Bridge is a bridge over the Amstel in Amsterdam.',
      ['Blauwbrug']),
    ['Blauwbrug']);
});

check('a multi-word name is checked whole and by its significant parts', () => {
  assert.deepEqual(
    droppedProperNames(
      'De Kerk van de Heilige Familie staat aan het Oudekerksplein.',
      'The Church of the Holy Family stands on the Oudekerksplein.',
      ['Kerk van de Heilige Familie']),
    ['Familie', 'Heilige', 'Kerk', 'Kerk van de Heilige Familie'].sort());
  // The lowercase function words are not what identifies the place, so their
  // disappearance is not reported.
  assert.ok(!droppedProperNames(
    'De Kerk van de Heilige Familie staat er.',
    'The Church of the Holy Family stands there.',
    ['Kerk van de Heilige Familie']).includes('van'));
});

check('a name the source never had cannot have been dropped', () => {
  assert.deepEqual(
    droppedProperNames(
      'Een brug in het centrum van Amsterdam.',
      'A bridge in the centre of Amsterdam.',
      ['Blauwbrug']),
    []);
});

check('the check is case-insensitive, so casing alone is not a failure', () => {
  assert.deepEqual(
    droppedProperNames('Het Oudekerksplein is een plein.', 'The oudekerksplein is a square.',
      ['Oudekerksplein']),
    []);
});

// --- What the guard actually covers, measured on the real extract ----------
// The guard only fires when the feature's own name appears in its own lede, so
// it is worth knowing how often that is true rather than assuming. Where it is
// not — "Amsterdamschebrug" whose Dutch lede spells it "Amsterdamsebrug", or
// "Hoge Sluis" written "Hogesluis" — nothing is refused, which is the right
// bias: a false refusal costs a translation, a false accept teaches a wrong
// name, and this only ever refuses on an exact whole-word disappearance.
{
  const { readFile } = await import('node:fs/promises');
  const files = ['water.json', 'streets.json', 'bridges.json', 'squares.json', 'parks.json', 'landmarks.json', 'all.json'];
  const seen = new Set<string>();
  let pending = 0;
  let guarded = 0;
  for (const file of files) {
    const rows = JSON.parse(await readFile(`public/data/extracts/amsterdam/${file}`, 'utf8')) as
      { name: string; wikipediaExtract?: string; wikipediaExtractLang?: string; wikipediaExtractOriginal?: string }[];
    for (const feature of rows) {
      const lang = feature.wikipediaExtractLang;
      if (!lang || lang === 'en' || !feature.wikipediaExtract) continue;
      const source = feature.wikipediaExtractOriginal || feature.wikipediaExtract;
      const key = `${feature.name}\u0000${source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pending++;
      // An empty translation drops every name the source had, so this reports
      // whether the guard has anything to check for this feature at all.
      if (droppedProperNames(source, '', [feature.name]).length) guarded++;
    }
  }
  checks++;
  assert.ok(pending > 400, `expected the Dutch backlog to still be there, found ${pending}`);
  assert.ok(guarded / pending > 0.85,
    `the rename guard covers only ${guarded} of ${pending} pending ledes`);
  process.stdout.write(
    `  rename guard covers ${guarded} of ${pending} pending Dutch ledes `
    + `(${Math.round((guarded / pending) * 100)}%)\n`);
}

process.stdout.write(`Translation pass checks passed (${checks} checks).\n`);
