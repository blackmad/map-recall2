/**
 * Make every blurb the game shows English.
 *
 * `enrich-amsterdam-wikipedia-extracts.ts` already takes the English article
 * wherever one exists. What is left are the features English Wikipedia has
 * never written about — 403 of them, nearly all bridges — which kept their
 * Dutch lede tagged `wikipediaExtractLang: "nl"`. This pass converts those.
 *
 * Three routes, best first:
 *
 *   cache           a reviewed translation already committed to
 *                   `scripts/english-translations.json`, keyed by the hash of
 *                   the exact source text so a refreshed extract invalidates a
 *                   stale entry instead of silently keeping it.
 *   translate       the Dutch lede, when an API key is configured. This is the
 *                   other route that keeps the actual content: the year it was
 *                   built, who it is named after, what it replaced. Anything it
 *                   produces is written back into the cache, so a translation
 *                   is paid for once and then reviewed in a diff like any text.
 *   describe        Wikidata's English description. Always available, and
 *                   almost always "bascule bridge in Amsterdam, Netherlands" —
 *                   true, English, and thin. It is the floor, not the goal.
 *
 * The original text is never thrown away: it moves to `wikipediaExtractSource`
 * / `wikipediaExtractOriginal` so a later run with a key can improve on a
 * description without re-fetching anything.
 *
 * Configure a key with GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local, and
 * optionally TRANSLATE_MODEL. Without one the pass still runs on the cache and
 * reports how many blurbs are waiting for a translation it could not do.
 *
 * Usage: npm run enrich:english [-- --dry-run] [-- --limit=50]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';

for (const file of ['.env.local', '.env']) loadEnv({ path: file, override: false, quiet: true });

interface Feature {
  name: string;
  wikidata?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  /** 'translated' | 'wikidata-description' — how the English text was produced. */
  wikipediaExtractSource?: string;
  /** The non-English text this replaced, kept so a later pass can do better. */
  wikipediaExtractOriginal?: string;
  wikipediaExtractOriginalLang?: string;
}

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const cacheFile = path.resolve('scripts/english-translations.json');
const files = ['water.json', 'streets.json', 'bridges.json', 'squares.json', 'parks.json', 'landmarks.json', 'all.json'];
const dryRun = process.argv.includes('--dry-run');
const limit = Number(process.argv.find(value => value.startsWith('--limit='))?.split('=')[1] || Infinity);
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const model = process.env.TRANSLATE_MODEL || 'gemini-2.0-flash';
const useOllama = process.argv.includes('--ollama') || Boolean(process.env.OLLAMA_MODEL);
const ollamaModel = argument('model') || process.env.OLLAMA_MODEL || 'translategemma:12b';
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const hasTranslator = useOllama || Boolean(apiKey);
const headers = { 'User-Agent': 'MapRecallExtractTranslator/1.0 (https://github.com/blackmad/map-recall2)' };

const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
/** Pins a translation to the exact source text it was made from. */
const sourceHash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

/** One reviewed translation, committed alongside the code that applies it. */
interface CachedTranslation {
  /** Carried for review only; the hash is what decides a match. */
  name: string;
  lang: string;
  hash: string;
  en: string;
}
const groupKey = (group: Feature[]) => {
  const feature = group[0];
  return `${feature.name}\u0000${feature.wikipediaExtractOriginalLang || feature.wikipediaExtractLang}\u0000${feature.wikipediaExtractOriginal || feature.wikipediaExtract}`;
};

const partitions = new Map<string, Feature[]>();
for (const file of files) partitions.set(file, JSON.parse(await readFile(path.join(directory, file), 'utf8')));

// The same feature appears in several partitions (all.json overlaps the rest),
// so work is deduplicated by name + original text and written back everywhere.
const pending: Feature[] = [];
for (const partition of partitions.values()) {
  for (const feature of partition) {
    const language = feature.wikipediaExtractLang;
    const canUpgradeDescription = hasTranslator
      && feature.wikipediaExtractSource === 'wikidata-description'
      && feature.wikipediaExtractOriginal;
    if ((!language || language === 'en' || !feature.wikipediaExtract) && !canUpgradeDescription) continue;
    pending.push(feature);
  }
}
const byKey = new Map<string, Feature[]>();
for (const feature of pending) {
  const original = feature.wikipediaExtractOriginal || feature.wikipediaExtract;
  const originalLanguage = feature.wikipediaExtractOriginalLang || feature.wikipediaExtractLang;
  const key = `${feature.name}\u0000${originalLanguage}\u0000${original}`;
  (byKey.get(key) || byKey.set(key, []).get(key)!).push(feature);
}
const groups = [...byKey.values()].slice(0, Number.isFinite(limit) ? limit : undefined);
process.stdout.write(`${pending.length} non-English blurbs across ${files.length} files, ${byKey.size} distinct (${groups.length} in this run)\n`);

// ---- Route 1: translations already reviewed and committed ----
const translations = new Map<string, string>();
const cache: CachedTranslation[] = JSON.parse(await readFile(cacheFile, 'utf8').catch(() => '[]'));
const cached = new Map(cache.map(entry => [entry.hash, entry]));
let stale = 0;
for (const group of groups) {
  const original = group[0].wikipediaExtractOriginal || group[0].wikipediaExtract!;
  const entry = cached.get(sourceHash(original));
  if (entry) translations.set(groupKey(group), entry.en);
}
// An entry whose source text appears nowhere in the extracts is a translation
// of a lede Wikipedia has since rewritten. Report it rather than dropping it
// silently. This is measured against every feature, not just this run's
// pending ones, so an already-applied translation does not read as stale.
const live = new Set<string>();
for (const partition of partitions.values()) {
  for (const feature of partition) {
    const text = feature.wikipediaExtractOriginal || feature.wikipediaExtract;
    if (text) live.add(sourceHash(text));
  }
}
for (const entry of cache) if (!live.has(entry.hash)) stale++;
process.stdout.write(`cache: ${translations.size} of ${groups.length} already translated${stale ? `, ${stale} entries no longer match any extract` : ''}\n`);

// ---- Route 2: translate the rest with local Ollama or Gemini ----
const needsTranslation = groups.filter(group => !translations.has(groupKey(group)));
let freshlyTranslated = 0;
if (useOllama && needsTranslation.length) {
  process.stdout.write(`local translation: ${needsTranslation.length} blurbs with ${ollamaModel}\n`);
  for (const group of needsTranslation) {
    const original = group[0].wikipediaExtractOriginal || group[0].wikipediaExtract!;
    const sourceLanguage = group[0].wikipediaExtractOriginalLang || group[0].wikipediaExtractLang || 'nl';
    const prompt = `You are a professional ${sourceLanguage === 'nl' ? 'Dutch (nl)' : sourceLanguage} to English (en) translator. `
      + 'Your goal is to accurately convey the meaning and nuances of the original text while adhering to English grammar, vocabulary, and cultural sensitivities. '
      + 'Keep proper names exactly as written. Do not add facts or commentary. Keep the result under 360 characters and end at a sentence boundary. '
      + `Produce only the English translation, without any additional explanations or commentary. Please translate the following text into English:\n\n${original}`;
    try {
      const response = await fetch(ollamaUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false, options: { temperature: 0 } }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const payload = await response.json() as { response?: string };
      const english = (payload.response || '').trim().slice(0, 360);
      if (!english) throw new Error('empty response');
      translations.set(groupKey(group), english);
      cache.push({ name: group[0].name, lang: sourceLanguage, hash: sourceHash(original), en: english });
      freshlyTranslated++;
      process.stdout.write(`  ${group[0].name}\n`);
    } catch (error) {
      process.stdout.write(`  ${group[0].name}: local translation failed (${(error as Error).message})\n`);
    }
  }
  process.stdout.write(`newly translated locally: ${freshlyTranslated} of ${needsTranslation.length}\n`);
} else if (apiKey && needsTranslation.length) {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey });
  for (const batch of chunks(needsTranslation, 20)) {
    const items = batch.map((group, index) => ({
      id: index,
      text: group[0].wikipediaExtractOriginal || group[0].wikipediaExtract,
    }));
    const prompt = [
      'Translate each Dutch encyclopedia opening into plain English.',
      'Keep proper nouns (street, bridge, canal and building names) exactly as they are — they are what the player is learning.',
      'Do not add, explain or embellish anything that is not in the source.',
      'Keep each translation under 360 characters, ending at a sentence boundary.',
      'Reply with JSON only: [{"id":0,"text":"..."}].',
      JSON.stringify(items),
    ].join('\n');
    try {
      const response = await client.models.generateContent({ model, contents: prompt });
      const body = (response.text || '').replace(/^```(?:json)?|```$/gm, '').trim();
      for (const entry of JSON.parse(body) as { id: number; text: string }[]) {
        const group = batch[entry.id];
        if (!group || !entry.text) continue;
        const english = entry.text.trim().slice(0, 360);
        const original = group[0].wikipediaExtractOriginal || group[0].wikipediaExtract!;
        translations.set(groupKey(group), english);
        cache.push({
          name: group[0].name,
          lang: group[0].wikipediaExtractOriginalLang || group[0].wikipediaExtractLang || 'nl',
          hash: sourceHash(original),
          en: english,
        });
        freshlyTranslated++;
      }
    } catch (error) {
      process.stdout.write(`  translation batch failed (${(error as Error).message}); falling back for those\n`);
    }
    await wait(200);
  }
  process.stdout.write(`newly translated: ${freshlyTranslated} of ${needsTranslation.length}\n`);
} else if (needsTranslation.length) {
  process.stdout.write(`no translator configured — ${needsTranslation.length} uncached blurbs fall back to Wikidata descriptions; use --ollama after installing ${ollamaModel}\n`);
}

// ---- Route 3: Wikidata's English description ----
const needsDescription = groups.filter(group => !translations.has(groupKey(group)));
const descriptions = new Map<string, string>();
const qids = [...new Set(needsDescription.flatMap(group => (group[0].wikidata ? [group[0].wikidata] : [])))];
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', props: 'descriptions', languages: 'en',
    ids: batch.join('|'), origin: '*',
  }).toString();
  const data = await cachedJsonFetch<{ entities?: Record<string, { descriptions?: { en?: { value?: string } } }> }>(url, {
    cacheDirectory: '.cache/wikimedia', headers, pauseMs: 200,
  });
  for (const [qid, entity] of Object.entries(data.entities || {})) {
    const value = entity.descriptions?.en?.value;
    if (value) descriptions.set(qid, value.charAt(0).toUpperCase() + value.slice(1) + '.');
  }
}

// ---- Write back ----
let translated = 0, described = 0, stillForeign = 0;
for (const group of groups) {
  const original = group[0].wikipediaExtractOriginal || group[0].wikipediaExtract!;
  const originalLanguage = group[0].wikipediaExtractOriginalLang || group[0].wikipediaExtractLang;
  const english = translations.get(groupKey(group))
    || (group[0].wikidata ? descriptions.get(group[0].wikidata) : undefined);
  if (!english) { stillForeign++; continue; }
  const source = translations.has(groupKey(group)) ? 'translated' : 'wikidata-description';
  for (const feature of group) {
    feature.wikipediaExtractOriginal = original;
    feature.wikipediaExtractOriginalLang = originalLanguage;
    feature.wikipediaExtract = english;
    feature.wikipediaExtractSource = source;
    delete feature.wikipediaExtractLang;
  }
  if (source === 'translated') translated++; else described++;
}

if (!dryRun) {
  for (const [file, partition] of partitions) await writeFile(path.join(directory, file), JSON.stringify(partition));
  // Sorted so the file diffs by feature rather than by the order a run happened
  // to translate things in.
  if (freshlyTranslated) {
    cache.sort((a, b) => a.name.localeCompare(b.name) || a.hash.localeCompare(b.hash));
    await writeFile(cacheFile, `${JSON.stringify(cache, null, 1)}\n`);
  }
}
process.stdout.write(`${dryRun ? 'DRY RUN — nothing written' : `wrote ${files.join(', ')}`}\n`);
process.stdout.write(`  translated ledes: ${translated}\n`);
process.stdout.write(`  Wikidata descriptions: ${described}\n`);
process.stdout.write(`  still not English: ${stillForeign}\n`);
if (!hasTranslator && described > 0) {
  process.stdout.write(`  ${described} of these are one-line descriptions; use --ollama and re-run to translate the real ledes\n`);
}
