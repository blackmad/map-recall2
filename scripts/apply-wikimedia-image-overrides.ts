import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'public/data/extracts/amsterdam');
const overrides = JSON.parse(await readFile(path.resolve('scripts/wikimedia-image-overrides.json'), 'utf8')) as Record<string, string>;
let updated = 0;
for (const file of ['landmarks.json', 'bridges.json', 'all.json']) {
  const filename = path.join(directory, file);
  const features = JSON.parse(await readFile(filename, 'utf8')) as { wikidata?: string; wikipediaImageUrl?: string }[];
  let changed = false;
  for (const feature of features) {
    const image = feature.wikidata && overrides[feature.wikidata];
    if (!image || feature.wikipediaImageUrl === image) continue;
    feature.wikipediaImageUrl = image;
    changed = true;
    updated++;
  }
  if (changed) await writeFile(filename, JSON.stringify(features));
}
process.stdout.write(`Applied ${updated} curated Wikimedia image overrides in ${directory}\n`);
