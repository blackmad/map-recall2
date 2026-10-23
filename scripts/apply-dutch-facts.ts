/**
 * Merge reviewed Dutch fact sentences into the published catalog.
 *
 * Input is a JSON list written by the Dutch pass (writer + independent
 * verifier): `{ featureId, en, nl, evidence, nlUrl, verdict, reason }`. Only
 * `grounded` rows are applied, and each must carry its exact Dutch evidence and
 * the article it came from, so the card can be traced to a sentence rather than
 * to a model's memory.
 *
 * Usage: npm run apply:dutch-facts -- <file.json> [-- --check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface Reviewed {
  featureId: string;
  en: string;
  nl: string;
  evidence: string;
  nlUrl: string;
  verdict: 'grounded' | 'rejected';
  reason?: string;
}
interface Fact {
  text: string;
  textNl?: string;
  textNlEvidence?: string;
  textNlSourceUrl?: string;
  textNlWriter?: string;
  textNlVerification?: 'grounded';
}
interface FactsFile { features: Array<{ id: string; facts: Fact[] }> }

const file = process.argv[2];
if (!file) throw new Error('usage: apply-dutch-facts <reviewed.json>');
const check = process.argv.includes('--check');
const factsFile = path.resolve('public/data/extracts/amsterdam/facts.json');
const facts = JSON.parse(await readFile(factsFile, 'utf8')) as FactsFile;
const reviewed = JSON.parse(await readFile(path.resolve(file), 'utf8')) as Reviewed[];

let applied = 0;
const problems: string[] = [];
for (const row of reviewed) {
  if (row.verdict !== 'grounded') continue;
  if (!row.nl?.trim() || !row.evidence?.trim()) { problems.push(`missing text: ${row.featureId}`); continue; }
  if (!/^https:\/\/nl\.wikipedia\.org\//.test(row.nlUrl || '')) { problems.push(`missing Dutch source: ${row.featureId}`); continue; }
  const feature = facts.features.find((entry) => entry.id === row.featureId);
  if (!feature) { problems.push(`unknown feature: ${row.featureId}`); continue; }
  const fact = feature.facts.find((entry) => entry.text === row.en);
  if (!fact) { problems.push(`fact not found: ${row.featureId} / ${row.en.slice(0, 40)}`); continue; }
  if (check) {
    if (fact.textNl !== row.nl) problems.push(`not applied yet: ${row.featureId}`);
    continue;
  }
  fact.textNl = row.nl;
  fact.textNlEvidence = row.evidence;
  fact.textNlSourceUrl = row.nlUrl;
  fact.textNlWriter = 'agent:dutch-pass-2026-10-23';
  fact.textNlVerification = 'grounded';
  applied += 1;
}

if (problems.length) {
  console.error(`apply dutch facts: ${problems.length} problem(s)`);
  for (const problem of problems.slice(0, 10)) console.error(`  ${problem}`);
  process.exit(1);
}
if (!check) await writeFile(factsFile, `${JSON.stringify(facts)}\n`);
console.log(check ? `apply dutch facts: all ${reviewed.filter((row) => row.verdict === 'grounded').length} rows applied` : `applied ${applied} Dutch facts`);
