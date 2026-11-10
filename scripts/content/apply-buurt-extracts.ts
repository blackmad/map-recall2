/**
 * Merge a staged set of buurt extracts (#289) into neighborhoods-enriched.json.
 *
 * Staging rows hold `name`, `wikipediaExtract`, `sources` (URLs read) and, for
 * facts taken from Dutch pages, `original` (the Dutch sentences). The merge is
 * idempotent and never overwrites a non-blank `wikipediaExtract` unless the row sets `replace: true`; a name with
 * no entry yet is appended.
 *
 * Usage: node --import tsx scripts/content/apply-buurt-extracts.ts <staging.json> [--check]
 *   --check prints the diff and writes nothing.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Hood {
  name: string;
  wikipediaExtract?: string;
  sources?: string[];
  original?: string[];
  /** Staging only: overwrite a non-blank extract with this row. */
  replace?: boolean;
  [key: string]: unknown;
}

export interface MergeResult {
  merged: Hood[];
  filled: string[];
  added: string[];
  skipped: string[];
}

const blank = (text: unknown) => typeof text !== 'string' || !text.trim();

export function mergeBuurtExtracts(published: readonly Hood[], staged: readonly Hood[]): MergeResult {
  const merged = published.map(hood => ({ ...hood }));
  const filled: string[] = [];
  const added: string[] = [];
  const skipped: string[] = [];
  for (const row of staged) {
    if (blank(row.wikipediaExtract) || !row.sources?.length) { skipped.push(row.name); continue; }
    const targets = merged.filter(hood => hood.name === row.name);
    if (!targets.length) {
      const { replace: _replace, ...fresh } = row;
      merged.push(fresh);
      added.push(row.name);
      continue;
    }
    let touched = false;
    for (const hood of targets) {
      if (!blank(hood.wikipediaExtract) && !row.replace) continue;
      if (hood.wikipediaExtract === row.wikipediaExtract) continue;
      hood.wikipediaExtract = row.wikipediaExtract;
      hood.sources = row.sources;
      if (row.original) hood.original = row.original;
      touched = true;
    }
    if (touched) filled.push(row.name);
  }
  return { merged, filled, added, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const stagingPath = args.find(arg => !arg.startsWith('--'));
  if (!stagingPath) throw new Error('usage: apply-buurt-extracts.ts <staging.json> [--check]');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const target = path.join(root, 'public/data/extracts/amsterdam/neighborhoods-enriched.json');
  const published = JSON.parse(await readFile(target, 'utf8')) as Hood[];
  const staged = JSON.parse(await readFile(path.resolve(stagingPath), 'utf8')) as Hood[];
  const result = mergeBuurtExtracts(published, staged);
  for (const name of result.filled) console.log(`fill   ${name}: ${result.merged.find(h => h.name === name)?.wikipediaExtract?.split(/\s+/).length} words`);
  for (const name of result.added) console.log(`add    ${name}`);
  for (const name of result.skipped) console.log(`skip   ${name} (blank extract or no sources)`);
  if (!result.filled.length && !result.added.length) console.log('nothing to change');
  if (check) return;
  await writeFile(target, JSON.stringify(result.merged, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
