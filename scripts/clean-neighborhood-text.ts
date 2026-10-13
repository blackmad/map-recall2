/**
 * Cleans the English prose of `public/data/extracts/<city>/neighborhood-history.json`
 * (see src/mapRecall/neighborhoodTextCleanup.ts for the rules).
 *
 *   node --import tsx scripts/clean-neighborhood-text.ts --city amsterdam --check
 *   node --import tsx scripts/clean-neighborhood-text.ts --city all --write
 *
 * --check lists every pending change and exits 1 when there are any.
 * --write applies them in place, keeping key order and the file's 1-space JSON
 * layout, and prints a summary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanEntry, type EntryChange } from '../src/mapRecall/neighborhoodTextCleanup.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CITIES = ['amsterdam', 'utrecht', 'rotterdam', 'den-haag'];

function usage(message?: string): never {
  if (message) console.error(message);
  console.error('usage: clean-neighborhood-text.ts --city <amsterdam|utrecht|rotterdam|den-haag|all> (--check | --write)');
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const cityArg = flag('--city');
const write = args.includes('--write');
const check = args.includes('--check');
if (!cityArg || write === check) usage('pick one mode: --check or --write, and a --city');

const cities = cityArg === 'all' ? CITIES.filter(city => existsSync(pathFor(city))) : [cityArg];
for (const city of cities) {
  if (!CITIES.includes(city)) usage(`unknown city: ${city}`);
  if (!existsSync(pathFor(city))) usage(`no neighborhood-history.json for ${city}`);
}

function pathFor(city: string): string {
  return join(ROOT, 'public', 'data', 'extracts', city, 'neighborhood-history.json');
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
let pendingTotal = 0;

for (const city of cities) {
  const path = pathFor(city);
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw) as { neighborhoods: Array<{ name: string }> & unknown[] };
  const touched: string[] = [];
  const droppedByReason = new Map<string, number>();
  let artefacts = 0;
  const relabelled: string[] = [];
  let pending = 0;

  data.neighborhoods = data.neighborhoods.map((entry: any) => {
    const result = cleanEntry(entry);
    if (result.changes.length) {
      touched.push(entry.name);
      for (const change of result.changes) {
        pending++;
        if (change.kind === 'artefact') artefacts++;
        if (change.kind === 'borrowed') relabelled.push(`${entry.name} -> ${change.borrowedFrom}`);
        for (const reason of change.droppedReasons ?? []) droppedByReason.set(reason, (droppedByReason.get(reason) ?? 0) + 1);
        if (check) printChange(city, entry.name, change);
      }
    }
    return result.entry;
  });
  pendingTotal += pending;

  const droppedSummary = [...droppedByReason].map(([reason, n]) => `${reason} ${n}`).join(', ') || 'none';
  console.log(`${city}: ${touched.length} entries touched, ${pending} changes; sentences dropped: ${droppedSummary}; artefacts fixed: ${artefacts}; histories relabelled: ${relabelled.length}`);
  if (write && pending) {
    writeFileSync(path, `${JSON.stringify(data, null, 1)}\n`);
    console.log(`  wrote ${path}`);
  }
  for (const line of relabelled) console.log(`  borrowedFrom: ${line}`);
}

if (check && pendingTotal) {
  console.error(`${pendingTotal} pending change(s); run with --write to apply.`);
  process.exit(1);
}

function printChange(city: string, name: string, change: EntryChange) {
  console.log(`${city} | ${name} | ${change.field} | ${change.reason}`);
  console.log(`  before: ${oneLine(change.before)}`);
  console.log(`  after:  ${oneLine(change.after)}`);
}
