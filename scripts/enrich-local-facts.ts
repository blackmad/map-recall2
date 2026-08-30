import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface Feature {
  name: string;
  wikipediaExtract?: string;
  wikipediaSourceText?: string;
  wikipediaUrl?: string;
  funFact?: string;
  clues?: string[];
}

interface CachedFacts { sourceHash: string; model: string; facts: string[] }

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const model = argument('model') || process.env.OLLAMA_MODEL || 'gemma3:4b';
const endpoint = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const limit = Number(argument('limit') || Infinity);
const files = ['landmarks.json', 'bridges.json'];
const cacheDirectory = path.resolve('.cache/local-facts');
const promptVersion = 'facts-v1';
const sourceHash = (feature: Feature) => createHash('sha256')
  .update(`${promptVersion}\0${model}\0${feature.name}\0${feature.wikipediaSourceText || feature.wikipediaExtract || ''}`)
  .digest('hex');

async function factsFor(feature: Feature): Promise<string[]> {
  const hash = sourceHash(feature);
  const cacheFile = path.join(cacheDirectory, `${hash}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as CachedFacts;
    if (cached.sourceHash === hash && cached.model === model) return cached.facts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const prompt = `Using only the source text below, write exactly three distinct, interesting facts about ${feature.name}. `
    + 'Each fact must be one concise English sentence, independently understandable, and contain no markdown. '
    + 'Return only a JSON array of three strings. Do not infer or invent facts.\n\nSOURCE:\n'
    + (feature.wikipediaSourceText || feature.wikipediaExtract);
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0.2 } }),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json() as { response?: string };
  const parsed = JSON.parse(payload.response || '[]');
  const facts = (Array.isArray(parsed) ? parsed : parsed.facts || [])
    .filter((fact: unknown): fact is string => typeof fact === 'string' && fact.trim().length > 10)
    .map((fact: string) => fact.trim()).slice(0, 3);
  if (facts.length !== 3) throw new Error(`Ollama returned ${facts.length} valid facts for ${feature.name}`);
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ sourceHash: hash, model, facts } satisfies CachedFacts));
  return facts;
}

let enriched = 0;
for (const file of files) {
  const filename = path.join(directory, file);
  const features = JSON.parse(await readFile(filename, 'utf8')) as Feature[];
  for (const feature of features) {
    if (enriched >= limit || !(feature.wikipediaSourceText || feature.wikipediaExtract)) continue;
    const facts = await factsFor(feature);
    feature.funFact = facts[0];
    feature.clues = facts.slice(1);
    enriched++;
    process.stdout.write(`  ${feature.name}: ${facts.length} facts\n`);
  }
  await writeFile(filename, JSON.stringify(features));
}
process.stdout.write(`Enriched ${enriched} features with cached local facts using ${model}\n`);
