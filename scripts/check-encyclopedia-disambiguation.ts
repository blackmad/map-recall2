/**
 * Publish gate: no card-facing extract may be a Wikipedia disambiguation page.
 *
 * Usage:
 *   tsx scripts/check-encyclopedia-disambiguation.ts
 *   tsx scripts/check-encyclopedia-disambiguation.ts public/data/extracts/utrecht
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ENCYCLOPEDIA_CARD_FILES } from './lib/encyclopedia-extract-files.ts';
import { isDisambiguationExtract } from '../src/canalRecall/game/encyclopediaDisambiguation.ts';

const directories = process.argv.slice(2).length
  ? process.argv.slice(2).map(dir => path.resolve(dir))
  : ['amsterdam', 'utrecht', 'rotterdam', 'den-haag']
    .map(id => path.resolve(`public/data/extracts/${id}`));

type Feature = { name?: string; wikipediaExtract?: string };

for (const directory of directories) {
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
      if (!isDisambiguationExtract(feature.wikipediaExtract)) continue;
      offenders.push(`${feature.name || '(unnamed)'} [${file}]`);
    }
  }

  assert.equal(
    offenders.length,
    0,
    `disambiguation encyclopedia blurbs remain in ${directory}:\n  ${offenders.join('\n  ')}`,
  );

  process.stdout.write(`Encyclopedia disambiguation check passed for ${directory}\n`);
}
