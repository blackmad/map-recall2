/**
 * Hand-off for translating street-name origins in a Claude Code session
 * instead of through OpenRouter: the same cache and checks as
 * `translate-street-name-origins-llm.ts`, with the model call replaced by
 * whoever reads `next` and writes `ingest`.
 *
 *   npx tsx scripts/origin-translation-batch.ts next [--count=40]
 *     prints the next distinct Dutch texts still missing, as JSON lines
 *     {"id","name","nl"}
 *   npx tsx scripts/origin-translation-batch.ts ingest <file.json> [--source=…]
 *     reads [{"id","en"}] and adds every name that shares that Dutch
 *   npx tsx scripts/origin-translation-batch.ts status
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const sourceFile = path.resolve('scripts/street-name-origin-translations.json');
const cacheFile = path.resolve('scripts/street-name-origin-translations-llm.json');
const sha = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

interface SourceEntry { name: string; hash: string; nl?: string }
interface LlmEntry { name: string; hash: string; nlHash: string; en: string; source: string }

const source = JSON.parse(await readFile(sourceFile, 'utf8')) as SourceEntry[];
let cache: LlmEntry[] = [];
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')) as LlmEntry[]; } catch { /* none yet */ }
const doneNl = new Set(cache.map(entry => entry.nlHash));

const groups = new Map<string, { id: string; name: string; nl: string; entries: SourceEntry[] }>();
for (const entry of source) {
  if (!entry.nl) continue;
  const id = sha(entry.nl);
  const group = groups.get(id) ?? { id, name: entry.name, nl: entry.nl, entries: [] };
  group.entries.push(entry);
  groups.set(id, group);
}
const pending = [...groups.values()].filter(group => !doneNl.has(group.id));

/** Every three- or four-digit number (years) of the Dutch is in the English. */
const keepsNumbers = (nl: string, en: string) => {
  const english = new Set(en.match(/\d{3,4}/g) ?? []);
  return (nl.match(/\d{3,4}/g) ?? []).every(value => english.has(value));
};

const command = process.argv[2];
if (command === 'next') {
  const count = Number(argument('count') || 40);
  for (const { id, name, nl } of pending.slice(0, count)) process.stdout.write(`${JSON.stringify({ id, name, nl: nl.trim() })}\n`);
} else if (command === 'ingest') {
  const file = process.argv[3];
  const sourceTag = argument('source') || 'claude-code-opus-5.5';
  const results = JSON.parse(await readFile(file, 'utf8')) as Array<{ id: string; en: string }>;
  let added = 0;
  const problems: string[] = [];
  for (const { id, en } of results) {
    const group = groups.get(id);
    if (!group) { problems.push(`unknown id ${id}`); continue; }
    if (doneNl.has(id)) continue;
    if (!en?.trim() || !keepsNumbers(group.nl, en)) { problems.push(`${group.name}: missing text or a year`); continue; }
    for (const entry of group.entries) cache.push({ name: entry.name, hash: entry.hash, nlHash: id, en: en.trim(), source: sourceTag });
    doneNl.add(id);
    added++;
  }
  await writeFile(cacheFile, `${JSON.stringify(cache.sort((a, b) => a.name.localeCompare(b.name, 'nl')), null, 1)}\n`);
  process.stdout.write(`ingested ${added}; ${pending.length - added} distinct texts left${problems.length ? `\n${problems.join('\n')}` : ''}\n`);
} else {
  process.stdout.write(`${groups.size - pending.length} of ${groups.size} distinct Dutch texts translated; ${pending.length} left\n`);
}
