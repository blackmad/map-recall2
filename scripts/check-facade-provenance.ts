import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const published = JSON.parse(await readFile(
  'public/data/building-enrichment/amsterdam/machine-panorama-labels.json', 'utf8',
)) as { labels: Array<{ acceptedForNow?: boolean }> };
const manifest = JSON.parse(await readFile(
  'public/data/building-enrichment/amsterdam/manifest.json', 'utf8',
)) as { status?: string };
const generators = await Promise.all([
  readFile('scripts/build-panorama-facade-review.ts', 'utf8'),
  readFile('scripts/reclassify-facade-grammar.ts', 'utf8'),
]);

assert.ok(published.labels.length > 0, 'the check covers the published research proposals');
assert.ok(published.labels.every((label) => label.acceptedForNow === false),
  'no raw model proposal is accepted as production evidence');
assert.match(manifest.status || '', /not-production-evidence/);
for (const source of generators) {
  assert.doesNotMatch(source, /acceptedForNow:\s*true/,
    'a generator cannot silently promote its own model output');
  assert.match(source, /reviewStatus:\s*'machine-proposal'/,
    'machine provenance is explicit in newly generated labels');
}

process.stdout.write(`Façade provenance checks passed (${published.labels.length} proposals remain unaccepted).\n`);
