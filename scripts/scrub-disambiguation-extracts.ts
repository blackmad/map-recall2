/**
 * Strip disambiguation Wikipedia ledes from published extracts.
 *
 * Keeps `wikipediaExtractOriginal` so a later enrich can retry with a better
 * title. Rebuilds `street-knowledge.json` when streets/water change.
 *
 * Usage: tsx scripts/scrub-disambiguation-extracts.ts [city-id ...]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ENCYCLOPEDIA_PARTITION_FILES } from './lib/encyclopedia-extract-files.ts';
import { isDisambiguationExtract } from '../src/canalRecall/game/encyclopediaDisambiguation.ts';

const cities = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['amsterdam', 'utrecht', 'rotterdam', 'den-haag'];

type Feature = {
  name?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  wikipediaExtractSource?: string;
  wikipediaExtractOriginal?: string;
  wikipediaExtractOriginalLang?: string;
  wikipediaSourceText?: string;
};

for (const cityId of cities) {
  const directory = path.resolve(`public/data/extracts/${cityId}`);
  let cleared = 0;
  const touched = new Set<string>();
  for (const file of [...ENCYCLOPEDIA_PARTITION_FILES, 'street-knowledge.json']) {
    const filePath = path.join(directory, file);
    let features: Feature[];
    try {
      features = JSON.parse(await readFile(filePath, 'utf8')) as Feature[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (!Array.isArray(features)) continue;
    let dirty = false;
    for (const feature of features) {
      if (!isDisambiguationExtract(feature.wikipediaExtract)
        && !isDisambiguationExtract(feature.wikipediaExtractOriginal)
        && !isDisambiguationExtract(feature.wikipediaSourceText)) {
        continue;
      }
      // Drop the blurb entirely — do not preserve a disambiguation "original"
      // for a later translate pass; that would just republish the list page.
      delete feature.wikipediaExtract;
      delete feature.wikipediaExtractLang;
      delete feature.wikipediaExtractSource;
      delete feature.wikipediaExtractOriginal;
      delete feature.wikipediaExtractOriginalLang;
      if (isDisambiguationExtract(feature.wikipediaSourceText)) {
        delete feature.wikipediaSourceText;
      }
      cleared++;
      dirty = true;
    }
    if (dirty) {
      await writeFile(filePath, JSON.stringify(features));
      touched.add(file);
    }
  }
  process.stdout.write(`${cityId}: cleared ${cleared} disambiguation blurb(s)`
    + `${touched.size ? ` in ${[...touched].join(', ')}` : ''}\n`);
}
