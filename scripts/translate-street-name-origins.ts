/**
 * English for the staged street-name origins, on this machine.
 *
 * Uses the same local route as `translate-extracts-to-english.ts`: Apple's
 * on-device Translation framework through `trn --quality high` (or
 * `translate`), with the helpers in `scripts/lib/translation.ts`. The name
 * being explained is held out of the translator (`protectNames`) and a
 * translation that still renamed it is refused (`droppedProperNames`): a
 * fluent sentence about the wrong name teaches the wrong name.
 *
 * Resumable by construction. Every translation is written to
 * `scripts/street-name-origin-translations.json`, keyed by the hash of the
 * exact Dutch, every 25 texts; a re-run translates only what is missing, and a
 * refreshed register invalidates only the entries whose Dutch changed.
 *
 * Only origins that explain something the game can ask are translated unless
 * `--all` is passed.
 *
 * Usage: npm run translate:street-name-origins [-- --limit=50] [-- --all]
 *                                              [-- --concurrency=4] [-- --translator=trn|translate]
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  CLI_TRANSLATORS, type CliTranslator, cleanTranslatorOutput, droppedProperNames, protectNames,
  translatorInvocation, trimToSentence,
} from './lib/translation.ts';
import { indexOrigins, originFor, type NameOrigin } from './lib/streetNameOrigins.ts';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve('public/data/extracts/amsterdam');
const stagingFile = path.join(directory, 'staging/street-name-origins.json');
const cacheFile = path.resolve('scripts/street-name-origin-translations.json');
const limit = Number(argument('limit') || Infinity);
const concurrency = Math.max(1, Number(argument('concurrency') || 4));
/** Origins run longer than encyclopedia ledes (p90 345 chars); keep them whole. */
const MAX_ORIGIN_CHARS = 700;

const onPath = (binary: string) => promisify(execFile)('/usr/bin/which', [binary]).then(() => true, () => false);
let tool = argument('translator') as CliTranslator | undefined;
if (!tool) for (const candidate of CLI_TRANSLATORS) if (await onPath(candidate)) { tool = candidate; break; }
if (!tool || !await onPath(tool)) {
  throw new Error(`No local translator: install ${CLI_TRANSLATORS.join(' or ')} (macOS 26, Apple Intelligence or the Dutch language pack).`);
}

/** One committed translation. Staging is gitignored, so this file is where
 *  the Dutch original lives next to its English: reviewable as a diff, and
 *  enough to redo a translation without re-fetching the register. */
interface CachedOrigin { name: string; hash: string; nl?: string; en: string; source: string }
const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

const staged = JSON.parse(await readFile(stagingFile, 'utf8')) as { origins: NameOrigin[] };
const cache: CachedOrigin[] = JSON.parse(await readFile(cacheFile, 'utf8').catch(() => '[]'));
const cached = new Map(cache.map(entry => [entry.hash, entry]));

// Which origins the game can use: those matched to a feature it can ask.
let wanted = staged.origins;
if (!process.argv.includes('--all')) {
  const index = indexOrigins(staged.origins);
  const used = new Set<NameOrigin>();
  for (const [file, kind] of [['streets-routing.json', 'street'], ['streets.json', 'street'], ['water.json', 'water'], ['bridges.json', 'bridge']] as const) {
    const data = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    for (const feature of (Array.isArray(data) ? data : data.features) as Array<{ name?: string }>) {
      const origin = feature.name ? originFor(index, feature.name, kind) : null;
      if (origin) used.add(origin);
    }
  }
  wanted = staged.origins.filter(origin => used.has(origin));
}
// One translation per distinct Dutch text and name (the name is protected, so
// it is part of what was translated).
const distinct = new Map<string, NameOrigin>();
for (const origin of wanted) distinct.set(`${origin.name}\u0000${origin.nl}`, origin);
const jobs = [...distinct.values()].filter(origin => !cached.has(hash(`${origin.name}\u0000${origin.nl}`)));
const queue = jobs.slice(0, Number.isFinite(limit) ? limit : undefined);
process.stdout.write(`${wanted.length} origins wanted (${distinct.size} distinct), ${distinct.size - jobs.length} already translated; `
  + `translating ${queue.length} with ${tool} ×${concurrency}\n`);

async function translate(origin: NameOrigin): Promise<string> {
  const held = protectNames(origin.nl, [origin.name]);
  const invocation = translatorInvocation(tool!, 'nl', held.text);
  const child = execFile(tool!, invocation.args);
  if (invocation.stdin === null) child.stdin!.end(); else child.stdin!.end(invocation.stdin);
  const out: string[] = [], err: string[] = [];
  child.stdout!.on('data', (piece: Buffer) => out.push(piece.toString('utf8')));
  child.stderr!.on('data', (piece: Buffer) => err.push(piece.toString('utf8')));
  const code = await new Promise<number>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  if (code !== 0) throw new Error(`exited ${code}: ${err.join('').trim().split('\n')[0]}`);
  const english = trimToSentence(held.restore(cleanTranslatorOutput(out.join(''))), MAX_ORIGIN_CHARS);
  if (!english) throw new Error('empty output');
  const dropped = droppedProperNames(origin.nl, english, [origin.name]);
  if (dropped.length) throw new Error(`refused — renamed ${dropped.join(', ')}`);
  return english;
}

const source = tool === 'trn' ? 'trn-high' : tool;
let done = 0, failed = 0, sinceSave = 0;
const failures: string[] = [];
const dutchByHash = new Map(staged.origins.map(origin => [hash(`${origin.name}\u0000${origin.nl}`), origin.nl]));
const save = async () => {
  for (const entry of cache) if (!entry.nl) entry.nl = dutchByHash.get(entry.hash);
  cache.sort((a, b) => a.name.localeCompare(b.name, 'nl') || a.hash.localeCompare(b.hash));
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 1)}\n`);
};
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < queue.length) {
    const origin = queue[next++];
    try {
      const en = await translate(origin);
      const entry = { name: origin.name, hash: hash(`${origin.name}\u0000${origin.nl}`), nl: origin.nl, en, source };
      cache.push(entry); cached.set(entry.hash, entry);
      done++; sinceSave++;
      if (sinceSave >= 25) { sinceSave = 0; await save(); process.stdout.write(`  ${done + failed}/${queue.length}\n`); }
    } catch (error) {
      failed++;
      failures.push(`${origin.name}: ${(error as Error).message}`);
    }
  }
}));
await save();

// Apply every cached translation to the staging file.
let applied = 0;
for (const origin of staged.origins) {
  const entry = cached.get(hash(`${origin.name}\u0000${origin.nl}`));
  if (entry) { origin.en = entry.en; origin.enSource = entry.source; applied++; }
}
await writeFile(stagingFile, `${JSON.stringify(staged, null, 1)}\n`);
process.stdout.write(`translated ${done}, failed ${failed}; ${applied} of ${staged.origins.length} staged origins now have English\n`);
for (const line of failures.slice(0, 20)) process.stdout.write(`  ${line}\n`);
