/**
 * Attach same-article opening sentences to a published (or staged) facts.json.
 *
 * Openings are the first sentence of each feature's published encyclopedia
 * extract — already English-gated offline — so a rotated trivia punchline can
 * show "who / what" context from the same Wikipedia article without waiting
 * for a full facts:build regen. Does not change fact texts or review status.
 *
 * Usage: npm run facts:attach-openings [-- --directory=…] [-- --file=…] [-- --force]
 *
 * By default only fills missing openings. `--force` rewrites every opening from
 * the current encyclopedia extract (use after fixing openingSentence).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { openingSentence } from '../src/canalRecall/facts/factStore.ts';
import type { FactsFile } from '../src/canalRecall/facts/factTypes.ts';
import { ENCYCLOPEDIA_PARTITION_FILES } from './lib/encyclopedia-extract-files.ts';

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const targetArg = argument('file');
const factsPath = path.resolve(
  targetArg || path.join(directory, 'facts.json'),
);
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

interface ExtractFeature {
  id?: string;
  name?: string;
  wikipediaExtract?: string;
}

async function loadExtractIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  for (const file of ENCYCLOPEDIA_PARTITION_FILES) {
    const filePath = path.join(directory, file);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    const list = Array.isArray(raw)
      ? raw as ExtractFeature[]
      : Array.isArray((raw as { features?: ExtractFeature[] })?.features)
        ? (raw as { features: ExtractFeature[] }).features
        : [];
    for (const feature of list) {
      if (!feature?.id || !feature.wikipediaExtract) continue;
      index.set(feature.id, feature.wikipediaExtract);
    }
  }
  return index;
}

const facts = JSON.parse(await readFile(factsPath, 'utf8')) as FactsFile;
const extracts = await loadExtractIndex();
let attached = 0;
let kept = 0;
let rewritten = 0;
let missing = 0;

for (const feature of facts.features || []) {
  const next = openingSentence(extracts.get(feature.id));
  if (!next) {
    missing++;
    continue;
  }
  if (!force && feature.opening?.trim()) {
    kept++;
    continue;
  }
  if (force && feature.opening?.trim() === next) {
    kept++;
    continue;
  }
  if (force && feature.opening?.trim()) rewritten++;
  else attached++;
  feature.opening = next;
}

process.stdout.write(
  `openings: attached ${attached}, rewritten ${rewritten}, unchanged ${kept}, no extract ${missing}`
  + `${force ? ' (--force)' : ''}\n`
  + `  ${path.relative(process.cwd(), factsPath)}\n`,
);

if (!dryRun && (attached || rewritten)) {
  await writeFile(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
}
