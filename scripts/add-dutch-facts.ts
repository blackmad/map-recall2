/**
 * Give the published facts a Dutch column.
 *
 * The facts catalog was built for an English interface: `text` is a written
 * English sentence whose exact Dutch or English evidence travels alongside it
 * (`sourceQuote`). Dutch mode must not print a machine translation of that
 * summary — the pipeline's rule is that Dutch comes from Dutch sources.
 *
 * So the Dutch column is the article's **own sentence**, taken from the Dutch
 * evidence that already backs the fact: same article, same section, same claim,
 * cited to the same URL. It is not a summary, and the card says so through its
 * source line ("Wikipedia (Nederlands)").
 *
 * `openingNl` is the Dutch article's first lede sentence, fetched once per
 * article and cached under the city's ignored `staging/` directory. A feature
 * with a Dutch fact but no Dutch opening gets no opening in Dutch mode: half a
 * card in each language reads worse than a card without the framing line.
 *
 * Usage: npm run add:dutch-facts [-- --check]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { openingSentence } from '../src/canalRecall/facts/factStore.ts';

interface Fact {
  text: string;
  textNl?: string;
  sourceQuote?: string;
  sourceUrl?: string;
  sourceLanguage?: 'en' | 'nl';
  sourceUrlNl?: string;
}
interface FeatureFacts { id: string; name: string; opening?: string; openingNl?: string; facts: Fact[] }
interface FactsFile { cityId: string; features: FeatureFacts[] }

const directory = path.resolve('public/data/extracts/amsterdam');
const factsFile = path.join(directory, 'facts.json');
const cacheFile = path.join(directory, 'staging', 'dutch-fact-openings.json');
const check = process.argv.includes('--check');

const file = JSON.parse(await readFile(factsFile, 'utf8')) as FactsFile;

/** A quote that begins mid-sentence cannot stand on its own on a card. */
function startsCleanly(quote: string): boolean {
  const first = quote.trim().match(/\p{L}/u);
  if (!first) return false;
  return first[0] === first[0].toLocaleUpperCase();
}

/** The article's own sentence(s), capped like any other card text. */
function dutchSentence(quote: string): string | undefined {
  const cleaned = quote.replace(/\s+/g, ' ').trim();
  if (!cleaned || !startsCleanly(cleaned)) return undefined;
  // Stone inscriptions and bare lists of street names quote badly on a card.
  const letters = cleaned.replace(/[^\p{L}]/gu, '');
  if (letters && letters === letters.toLocaleUpperCase()) return undefined;
  if ((cleaned.match(/ - /g) || []).length >= 3) return undefined;
  let sentence = openingSentence(cleaned, 240);
  if (sentence.length < 30) return undefined;
  // The quote may end on a word or a closing quotation mark rather than a stop.
  if (!/[.!?…]$/.test(sentence)) sentence = `${sentence.replace(/["'”’)\]]+$/, '')}.`;
  return sentence;
}

let withDutch = 0;
let withoutDutch = 0;
for (const feature of file.features) {
  for (const fact of feature.facts) {
    // A reviewed, agent-written Dutch sentence outranks the quote cut: it has
    // its own evidence, writer and verdict, and this script must not wipe it.
    const reviewed = fact.textNl && fact.textNlEvidence && fact.textNlWriter && fact.textNlVerification === 'grounded';
    const usable = fact.sourceLanguage === 'nl' && fact.sourceQuote ? dutchSentence(fact.sourceQuote) : undefined;
    if (reviewed) {
      withDutch += 1;
      continue;
    }
    if (usable) {
      fact.textNl = usable;
      withDutch += 1;
    } else {
      delete fact.textNl;
      withoutDutch += 1;
    }
  }
}

// --- Dutch ledes, one request per article, cached ---------------------------------
const urlFor = (feature: FeatureFacts): string | undefined =>
  feature.facts.find((fact) => fact.textNl && fact.sourceUrl)?.sourceUrl;

let cache: Record<string, string> = {};
try {
  cache = JSON.parse(await readFile(cacheFile, 'utf8')) as Record<string, string>;
} catch { /* first run */ }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ledes for many articles in a few requests.
 *
 * One REST request per article earned HTTP 429 after thirty: the API's limit is
 * on requests, not articles, so the action API takes twenty titles at a time.
 * A throttled batch waits and retries instead of caching the failure as "no
 * Dutch lede" — a transient limit is not evidence about the article.
 */
async function fetchLedes(urls: string[]): Promise<void> {
  const pending = urls.filter((url) => cache[url] === undefined);
  for (let start = 0; start < pending.length; start += 20) {
    const batch = pending.slice(start, start + 20);
    const titles = batch.map((url) => decodeURIComponent((url.split('/wiki/')[1] || '')).replace(/_/g, ' '));
    const api = new URL('https://nl.wikipedia.org/w/api.php');
    api.searchParams.set('action', 'query');
    api.searchParams.set('prop', 'extracts');
    api.searchParams.set('exintro', '1');
    api.searchParams.set('explaintext', '1');
    api.searchParams.set('redirects', '1');
    api.searchParams.set('format', 'json');
    api.searchParams.set('formatversion', '2');
    api.searchParams.set('titles', titles.join('|'));
    let attempt = 0;
    for (;;) {
      try {
        const response = await fetch(api, { headers: { 'user-agent': 'CanalRecall/1.0 (Dutch trivia sources)' } });
        if (response.status === 429 && attempt < 5) {
          attempt += 1;
          await sleep(3000 * attempt);
          continue;
        }
        if (!response.ok) break; // leave uncached: a later run retries
        const body = await response.json() as { query?: { pages?: Array<{ title?: string; extract?: string; missing?: boolean }> } };
        for (const page of body.query?.pages || []) {
          if (!page.title) continue;
          cache[`https://nl.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`] = page.missing ? '' : (page.extract || '');
        }
        break;
      } catch {
        attempt += 1;
        if (attempt > 4) break;
        await sleep(2000 * attempt);
      }
    }
    await sleep(400);
  }
}

if (!check) {
  const urls = [...new Set(file.features.map(urlFor).filter((url): url is string => !!url && url.includes('nl.wikipedia.org/wiki/')))];
  await fetchLedes(urls);
  let fetched = 0;
  for (const feature of file.features) {
    const url = urlFor(feature);
    const extract = url ? cache[url] : undefined;
    if (extract) {
      feature.openingNl = openingSentence(extract, 200);
      fetched += 1;
    } else {
      delete feature.openingNl;
    }
  }
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 1)}\n`);
  await writeFile(factsFile, `${JSON.stringify({ ...file, generatedAt: new Date().toISOString().slice(0, 10) })}\n`);
  console.log(`dutch facts: ${withDutch} facts with a Dutch sentence, ${withoutDutch} English only; `
    + `${file.features.filter((feature) => feature.openingNl).length} Dutch openings (${fetched} from ${Object.keys(cache).length} cached articles)`);
} else {
  const problems: string[] = [];
  for (const feature of file.features) {
    for (const fact of feature.facts) {
      if (!fact.textNl) continue;
      if (!fact.textNl.trim()) problems.push(`empty Dutch: ${feature.name}`);
      if (fact.textNl === fact.text) problems.push(`Dutch equals English: ${feature.name}`);
      if (!/[.!?…]$/.test(fact.textNl.trim())) problems.push(`Dutch does not end a sentence: ${feature.name}`);
      if (!fact.sourceLanguage || fact.sourceLanguage !== 'nl') {
        // A written Dutch sentence is Dutch evidence too when it records the
        // exact evidence, its article, its writer and a grounded verdict.
        if (!(fact.textNlEvidence?.trim()
          && /^https:\/\/nl\.wikipedia\.org\//.test(fact.textNlSourceUrl || '')
          && fact.textNlWriter
          && fact.textNlVerification === 'grounded')) {
          problems.push(`Dutch without Dutch evidence: ${feature.name}`);
        }
      }
    }
    if (feature.openingNl && feature.openingNl === feature.opening) problems.push(`opening is English: ${feature.name}`);
  }
  if (problems.length) {
    console.error(`dutch facts: ${problems.length} problem(s)`);
    for (const problem of problems.slice(0, 15)) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`dutch facts: ${withDutch}/${withDutch + withoutDutch} facts carry Dutch, `
    + `${file.features.filter((feature) => feature.openingNl).length} Dutch openings — OK`);
}
