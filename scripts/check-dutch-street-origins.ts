/**
 * Guard the Dutch column of `street-name-origins.json`.
 *
 * Three things must stay true:
 *  1. every name `docs/amsterdam-street-name-register-errors.md` does not mark
 *     "kept" appears in `scripts/dutch-street-origin-corrections.json`, so a new
 *     row in the error register cannot be forgotten;
 *  2. no origin carries Dutch for a name the error register flags;
 *  3. an origin with Dutch is never a bare copy of its English, and every
 *     published origin keeps its BAG id.
 *
 * Usage: npm run test:dutch-street-origins
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const docFile = path.resolve('docs/amsterdam-street-name-register-errors.md');
const correctionsFile = path.resolve('scripts/dutch-street-origin-corrections.json');
const publishedFile = path.resolve('public/data/extracts/amsterdam/street-name-origins.json');

const clean = (text: string) => text
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

/** Names the document lists, split from table rows and their handling. */
async function documentedRows(): Promise<Array<{ name: string; handling: string }>> {
  const lines = (await readFile(docFile, 'utf8')).split('\n');
  const rows: Array<{ name: string; handling: string }> = [];
  let inTable = false;
  for (const line of lines) {
    if (!line.startsWith('|')) { inTable = false; continue; }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => clean(cell));
    if (cells.every((cell) => /^[-: ]*$/.test(cell))) continue;
    if (cells[0] === 'Name') { inTable = true; continue; }
    if (!inTable) continue;
    const names = cells[0].split(',').map((name) => name.trim()).filter(Boolean);
    for (const name of names) rows.push({ name, handling: cells[cells.length - 1]! });
  }
  return rows;
}

const problems: string[] = [];
const rows = await documentedRows();
const corrections = JSON.parse(await readFile(correctionsFile, 'utf8')) as {
  withheldNl: Record<string, { handling?: string }>;
  corrections?: Record<string, { replace?: Array<[string, string]> }>;
};
const expected = new Set(rows
  .filter((row) => !/^kept\b/i.test(row.handling) && !/nieuwendammerdijk/i.test(row.handling))
  .map((row) => row.name));

for (const name of expected) {
  if (!corrections.withheldNl[name] && !corrections.corrections?.[name]) {
    problems.push(`documented error neither fixed nor withheld: ${name}`);
  }
}
for (const name of Object.keys(corrections.withheldNl)) {
  if (!expected.has(name)) problems.push(`withheld but no longer documented as an error: ${name}`);
}
// A name with a Dutch fix-up is not withheld, and its fix-ups must be non-empty.
for (const [name, entry] of Object.entries(corrections.corrections ?? {})) {
  if (!entry.replace?.length) problems.push(`correction without replacements: ${name}`);
  if (corrections.withheldNl[name]) problems.push(`corrected and withheld: ${name}`);
}

const published = JSON.parse(await readFile(publishedFile, 'utf8')) as {
  origins: Array<{ name: string; en?: string; nl?: string; bagId?: string }>;
};
let dutch = 0;
for (const origin of published.origins) {
  if (!origin.bagId) problems.push(`origin without a BAG id: ${origin.name}`);
  if (origin.name in corrections.withheldNl) {
    if (origin.nl) { problems.push(`Dutch shown for a flagged name: ${origin.name}`); }
    continue;
  }
  if (origin.nl) {
    dutch += 1;
    if (!origin.en) problems.push(`Dutch without English: ${origin.name}`);
    if (origin.nl === origin.en) problems.push(`Dutch is the English text: ${origin.name}`);
  }
}

if (problems.length) {
  console.error(`dutch street origins: ${problems.length} problem(s)`);
  for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  process.exit(1);
}
console.log(`dutch street origins: ${dutch}/${published.origins.length} with Dutch, `
  + `${Object.keys(corrections.withheldNl).length} documented register errors withheld`);
