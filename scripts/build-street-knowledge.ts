/**
 * Build `street-knowledge.json` from the streets and water partitions that
 * already carry an encyclopedia blurb or URL.
 *
 * The curated sidecar used to drift from `streets.json` / `water.json` (and
 * once taught the wrong place). The game index prefers the partition extracts
 * anyway; this file stays as a compact legacy list generated in the same
 * refresh as those extracts so nothing ships a second, hand-edited truth.
 *
 * Usage: tsx scripts/build-street-knowledge.ts [extract-directory]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'public/data/extracts/amsterdam');

type Feature = {
  id?: string;
  name: string;
  type?: string;
  wikidata?: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  wikipediaExtractSource?: string;
  wikipediaExtractOriginal?: string;
  wikipediaExtractOriginalLang?: string;
};

const eligible = (feature: Feature) => !!(feature.wikipediaUrl || feature.wikipediaExtract);

const toEntry = (feature: Feature, type: 'street' | 'water') => {
  const entry: Feature & { type: 'street' | 'water' } = {
    id: feature.id,
    name: feature.name,
    type,
  };
  if (feature.wikidata) entry.wikidata = feature.wikidata;
  if (feature.wikipedia) entry.wikipedia = feature.wikipedia;
  if (feature.wikipediaUrl) entry.wikipediaUrl = feature.wikipediaUrl;
  if (feature.wikipediaExtract) entry.wikipediaExtract = feature.wikipediaExtract;
  if (feature.wikipediaExtractLang) entry.wikipediaExtractLang = feature.wikipediaExtractLang;
  if (feature.wikipediaExtractSource) entry.wikipediaExtractSource = feature.wikipediaExtractSource;
  if (feature.wikipediaExtractOriginal) entry.wikipediaExtractOriginal = feature.wikipediaExtractOriginal;
  if (feature.wikipediaExtractOriginalLang) {
    entry.wikipediaExtractOriginalLang = feature.wikipediaExtractOriginalLang;
  }
  return entry;
};

const streets = JSON.parse(await readFile(path.join(directory, 'streets.json'), 'utf8')) as Feature[];
const waters = JSON.parse(await readFile(path.join(directory, 'water.json'), 'utf8')) as Feature[];

const entries = [
  ...streets.filter(eligible).map((feature) => toEntry(feature, 'street')),
  ...waters.filter(eligible).map((feature) => toEntry(feature, 'water')),
].sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));

const output = path.join(directory, 'street-knowledge.json');
await writeFile(output, `${JSON.stringify(entries)}\n`);
process.stdout.write(
  `Wrote ${entries.length} street-knowledge entries `
  + `(${streets.filter(eligible).length} streets + ${waters.filter(eligible).length} water) to ${output}\n`,
);
