/**
 * Publish gate: every card-facing extract must be English (or empty).
 *
 * `wikipediaExtractLang` is only set for non-English blurbs. A leftover `nl`
 * means refresh skipped `enrich:english`, or a rename refusal kept Dutch with
 * no Wikidata description floor. Either way the game would show an NL badge.
 *
 * Usage: tsx scripts/check-extract-english.ts [extract-directory]
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ENCYCLOPEDIA_CARD_FILES } from './lib/encyclopedia-extract-files.ts';

const directory = path.resolve(process.argv[2] || 'public/data/extracts/amsterdam');

type Feature = {
  name?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
};

const offenders: string[] = [];
for (const file of ENCYCLOPEDIA_CARD_FILES) {
  let features: Feature[];
  try {
    features = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Feature[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
    throw error;
  }
  if (!Array.isArray(features)) continue;
  for (const feature of features) {
    const lang = feature.wikipediaExtractLang;
    if (!lang || lang === 'en') continue;
    offenders.push(`${feature.name || '(unnamed)'} [${file}] — ${lang}`);
  }
}

assert.equal(
  offenders.length,
  0,
  `non-English encyclopedia blurbs remain (run npm run enrich:english):\n  ${offenders.join('\n  ')}`,
);

process.stdout.write(`Encyclopedia English check passed for ${directory}\n`);
