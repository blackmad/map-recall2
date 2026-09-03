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
  protectNames,
  translatorInvocation,
  trimToSentence,
} from './lib/translation.ts';

let checks = 0;
const check = (label: string, run: () => void) => { run(); checks++; void label; };

// --- Each tool is driven the way that tool actually works -------------------
check('the language pair is passed the same way to either tool', () => {
  assert.deepEqual(translatorInvocation('translate', 'nl', 'Een brug.').args,
    ['--from', 'nl', '--to', 'en']);
  // A source language other than Dutch is passed through, not assumed away.
  assert.deepEqual(translatorInvocation('translate', 'de', 'Eine Brücke.').args,
    ['--from', 'de', '--to', 'en']);
});

check('translate reads stdin; trn is given the text as an argument', () => {
  // `translate` reads stdin normally. `trn` 0.2.0 decides whether it has stdin
  // before a pipe from child_process has anything in it, so under Node the
  // text has to ride in the argv or the run exits 1.
  assert.equal(translatorInvocation('translate', 'nl', 'Een brug.').stdin, 'Een brug.');
  const trn = translatorInvocation('trn', 'nl', 'Een brug.');
  assert.equal(trn.stdin, null, 'trn must not be handed the text on stdin');
  assert.deepEqual(trn.args, ['--from', 'nl', '--to', 'en', '--quality', 'high', 'Een brug.']);
});

check('a lede starting with a dash is not read as an option', () => {
  // trn 0.2.0 has no `--` end-of-options separator, so the text itself has to
  // stop the parse. A single leading space does it, and the translator's
  // output is unaffected.
  const dashed = translatorInvocation('trn', 'nl', '- een brug uit 1957.');
  assert.equal(dashed.args[dashed.args.length - 1], ' - een brug uit 1957.');
  // Text that cannot be mistaken for a flag is passed through untouched.
  assert.equal(translatorInvocation('trn', 'nl', 'Een brug.').args.at(-1), 'Een brug.');
  // stdin-driven tools need no such guard.
  assert.equal(translatorInvocation('translate', 'nl', '- een brug.').stdin, '- een brug.');
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

// --- The name is held out of the translator's reach ------------------------
check('the feature name is substituted and comes back', () => {
  const source = 'De Aluminiumbrug (brug 222) is een ophaalbrug in Amsterdam-Centrum.';
  const held = protectNames(source, ['Aluminiumbrug']);
  assert.deepEqual(held.protectedNames, ['Aluminiumbrug']);
  assert.ok(!held.text.includes('Aluminiumbrug'), 'the translator never sees the name');
  // What a translator does to the placeholder text, measured with trn: the
  // placeholder is carried through untouched and everything else is English.
  assert.equal(
    held.restore('The Zarvix (bridge 222) is a lift bridge in Amsterdam-Centrum.'),
    'The Aluminiumbrug (bridge 222) is a lift bridge in Amsterdam-Centrum.');
});

check('protection is what turns a refusal into a lede', () => {
  // This is the whole point of the pass, stated as one assertion: the same
  // translator behaviour that gets refused unprotected is accepted protected.
  const source = 'De Aluminiumbrug is een ophaalbrug over de Kloveniersburgwal.';
  const renamed = 'The Aluminum Bridge is a lift bridge over the Kloveniersburgwal.';
  assert.deepEqual(droppedProperNames(source, renamed, ['Aluminiumbrug']), ['Aluminiumbrug']);

  const held = protectNames(source, ['Aluminiumbrug']);
  const restored = held.restore('The Zarvix is a lift bridge over the Kloveniersburgwal.');
  assert.deepEqual(droppedProperNames(source, restored, ['Aluminiumbrug']), []);
  assert.ok(restored.includes('lift bridge'), 'and it keeps what the lede actually says');
});

check('only whole words are held, so a name inside a compound is left alone', () => {
  // "brug" is a word of the name "Brug 117" and also the tail of every bridge
  // name in Amsterdam; substituting it inside a compound would corrupt the text
  // the translator reads.
  const held = protectNames('De Aluminiumbrug staat naast brug 222.', ['Brug']);
  assert.ok(held.text.includes('Aluminiumbrug'), `compound was broken: ${held.text}`);
});

check('a lowercase common noun is not held, only the capitalised name', () => {
  // "De Oude Lutherse Kerk ... de kerk werd gebouwd": protecting the second
  // occurrence would restore "Kerk was built" into the English.
  const source = 'De Oude Lutherse Kerk staat aan het Spui. De kerk werd in 1633 gebouwd.';
  const held = protectNames(source, ['Oude Lutherse Kerk']);
  assert.deepEqual(held.protectedNames, ['Oude Lutherse Kerk']);
  assert.ok(held.text.includes('De kerk werd'), `lowercase noun was held: ${held.text}`);
  // And the capitalised occurrence alone satisfies the guard for every token.
  const restored = held.restore('The Zarvix stands on the Spui. The church was built in 1633.');
  assert.deepEqual(droppedProperNames(source, restored, ['Oude Lutherse Kerk']), []);
});

check('a name absent from its own lede protects nothing', () => {
  const held = protectNames('Een vaste brug in Amsterdam-Centrum.', ['Blauwbrug']);
  assert.deepEqual(held.protectedNames, []);
  assert.equal(held.text, 'Een vaste brug in Amsterdam-Centrum.');
  assert.equal(held.restore('A fixed bridge in Amsterdam-Centrum.'),
    'A fixed bridge in Amsterdam-Centrum.');
});

check('a name written only in parts falls back to those parts', () => {
  const source = 'De Heilige Familie is een kerk in Amsterdam-Oost.';
  const held = protectNames(source, ['Kerk van de Heilige Familie']);
  assert.deepEqual(held.protectedNames.sort(), ['Familie', 'Heilige']);
  assert.ok(!held.text.includes('Heilige'), `part was not held: ${held.text}`);
  assert.ok(!held.text.includes('Familie'), `part was not held: ${held.text}`);
  assert.ok(held.text.includes('kerk'), 'the common noun is still there to translate');
});

check('a longer name wins over a name nested inside it', () => {
  const source = 'De Nieuwe Herengracht loopt naast de Herengracht.';
  const held = protectNames(source, ['Nieuwe Herengracht', 'Herengracht']);
  assert.deepEqual(held.protectedNames, ['Nieuwe Herengracht', 'Herengracht']);
  const restored = held.restore('The Zarvix runs beside the Qivron.');
  assert.equal(restored, 'The Nieuwe Herengracht runs beside the Herengracht.');
});

check('a placeholder the translator lowercased still restores', () => {
  const held = protectNames('De Beltbrug is een brug.', ['Beltbrug']);
  assert.equal(held.restore('The zarvix is a bridge.'), 'The Beltbrug is a bridge.');
});

check('a source that already contains a placeholder gets a different one', () => {
  const held = protectNames('De Zarvix ligt naast de Beltbrug.', ['Beltbrug']);
  assert.ok(!held.text.includes('Zarvix is'), 'the real Zarvix is untouched');
  assert.equal(held.restore(held.text), 'De Zarvix ligt naast de Beltbrug.');
});

check('restoring text the translator dropped the placeholder from changes nothing', () => {
  // Then the guard refuses it, exactly as it did before protection existed.
  const source = 'De Beltbrug is een brug in Amsterdam-West.';
  const held = protectNames(source, ['Beltbrug']);
  const restored = held.restore('It is a bridge in Amsterdam-West.');
  assert.deepEqual(droppedProperNames(source, restored, ['Beltbrug']), ['Beltbrug']);
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
    }
  }
  checks++;
  // The backlog this pass existed to clear is gone: 448 non-English ledes went
  // to 4 on 2026-09-01. What is left is held here so a regression in the
  // enrichment pipeline — a refetch that reintroduces Dutch ledes wholesale —
  // fails loudly instead of quietly shipping a Dutch game.
  assert.ok(pending <= 25,
    `${pending} non-English ledes are shipping; the pass had cleared this to 4`);
  process.stdout.write(`  non-English ledes still shipping: ${pending}\n`);

  // The rename guard is what stands between a fluent translation and a card
  // that teaches the wrong name, so its coverage is measured over the texts it
  // actually judged — the cache — not over the handful that are left.
  const cache = JSON.parse(await readFile('scripts/english-translations.json', 'utf8')) as
    { name: string; en: string }[];
  let checkable = 0;
  for (const entry of cache) {
    // An empty translation drops every name the source had, so this asks
    // whether the guard has anything to check for this feature at all.
    if (droppedProperNames(entry.name, '', [entry.name]).length) checkable++;
  }
  checks++;
  assert.ok(cache.length > 300, `expected a populated translation cache, found ${cache.length}`);
  assert.ok(checkable / cache.length > 0.85,
    `the rename guard can only judge ${checkable} of ${cache.length} cached translations`);
  process.stdout.write(
    `  rename guard can judge ${checkable} of ${cache.length} cached translations `
    + `(${Math.round((checkable / cache.length) * 100)}%)\n`);
}

process.stdout.write(`Translation pass checks passed (${checks} checks).\n`);
