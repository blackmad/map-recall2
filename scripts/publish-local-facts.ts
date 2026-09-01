/**
 * Publish reviewed facts from staging into the shipped city extract.
 *
 * Generation is cheap and repeatable; publication is not, because a wrong date
 * on a card is the failure the work board puts above everything else. So this
 * step is deliberately dull: it reads the staged batch, reads what a person
 * said about it in `scripts/facts-review.json`, and writes only what those two
 * agree on. Everything else is reported and left behind.
 *
 * It fails closed. An unreviewed feature does not publish, a review written
 * against an older generator does not publish, and `--force` does not exist —
 * the way to publish more facts is to read more of the review sheet.
 *
 * Usage: npm run facts:publish [-- --directory=… --dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  selectReviewedFacts,
  summariseRejections,
  type FactReviewFile,
} from '../src/canalRecall/facts/factReview.ts';
import type { FactsFile } from '../src/canalRecall/facts/factTypes.ts';

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const reviewPath = path.resolve(argument('review') || 'scripts/facts-review.json');
const dryRun = process.argv.includes('--dry-run');
const stagedPath = path.join(directory, 'staging', 'facts.json');
const publishedPath = path.join(directory, 'facts.json');

const staged = JSON.parse(await readFile(stagedPath, 'utf8')) as FactsFile;

let review: FactReviewFile = {};
try {
  review = JSON.parse(await readFile(reviewPath, 'utf8')) as FactReviewFile;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  process.stdout.write(`No review file at ${path.relative(process.cwd(), reviewPath)} — nothing can publish.\n`);
}

const { published, rejected } = selectReviewedFacts(staged.features, review, staged.generatorVersion);
const stagedFacts = staged.features.reduce((sum, feature) => sum + feature.facts.length, 0);
const publishedFacts = published.reduce((sum, feature) => sum + feature.facts.length, 0);

process.stdout.write(`Staged: ${staged.features.length} features, ${stagedFacts} facts `
  + `(generator ${staged.generatorVersion}, ${staged.generatedAt})\n`);
process.stdout.write(`Publishable: ${published.length} features, ${publishedFacts} facts\n`);
for (const [reason, count] of [...summariseRejections(rejected)].sort((a, b) => b[1] - a[1])) {
  process.stdout.write(`  ${String(count).padStart(5)}  ${reason}\n`);
}

if (!published.length) {
  process.stdout.write('\nNothing to publish. Review features in scripts/facts-review.json first.\n');
  process.exit(0);
}

const output: FactsFile = { ...staged, features: published };
if (dryRun) {
  process.stdout.write(`\nDry run — would write ${path.relative(process.cwd(), publishedPath)}\n`);
} else {
  // Minified: this file is fetched by the game at route load, next to extracts
  // that are already megabytes. The reviewable copy is the staged one.
  await writeFile(publishedPath, JSON.stringify(output));
  process.stdout.write(`\nWrote ${path.relative(process.cwd(), publishedPath)}\n`);
}
