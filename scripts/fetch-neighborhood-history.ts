/**
 * Neighbourhood history and name origins from the English and Dutch
 * Wikipedia articles, for the Map Recall answer card (user request
 * 2026-10-01: "both name trivia and neighborhood history/description").
 *
 * For every neighbourhood in `neighborhoods-enriched.json` this reads the
 * Wikidata sitelinks, fetches both articles as plain text and keeps three
 * things, each with the article it came from:
 *
 *   description  the English lede (Dutch when there is no English article)
 *   history      the opening of the History / Geschiedenis section
 *   nameOrigin   the sentences that explain the name ("named after",
 *                "genoemd naar", "lit." …), English first, then Dutch
 *
 * Dutch text is kept verbatim with `lang: 'nl'`; a translation pass fills
 * `en` next to it, so the original and its provenance survive. Nothing is
 * invented: a field with no sourced sentence stays absent.
 *
 * Writes to `staging/neighborhood-history.json` and prints coverage; publish
 * with `--publish` after review, which copies it into the extract.
 *
 *   npx tsx scripts/fetch-neighborhood-history.ts [--city=amsterdam|utrecht|rotterdam|den-haag] [--publish]
 *
 * Per-city settings (search name, "(City)" title qualifiers, review file) live
 * in scripts/lib/neighborhoodCities.ts; Amsterdam is the default and its
 * output is unchanged by the generalisation.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { neighborhoodCityFromArgs, type NeighborhoodCity } from './lib/neighborhoodCities';

const city: NeighborhoodCity = neighborhoodCityFromArgs();
const directory = path.resolve(city.directory);
const stagingPath = path.join(directory, 'staging/neighborhood-history.json');
const publishedPath = path.join(directory, 'neighborhood-history.json');
const headers = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SourcedText {
  text: string;
  lang: 'en' | 'nl';
  /** English translation of a Dutch `text`, filled by a later pass. */
  en?: string;
  sourceUrl: string;
}

export interface NeighborhoodHistory {
  name: string;
  wikidataId?: string;
  description?: SourcedText;
  history?: SourcedText;
  nameOrigin?: SourcedText;
}

async function fetchJson(url: URL): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers });
    if (response.ok) { await wait(150); return response.json(); }
    if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status} ${url}`);
    await wait(1500 * (attempt + 1));
  }
  throw new Error(`gave up on ${url}`);
}

async function sitelinks(qids: string[]): Promise<Map<string, { en?: string; nl?: string }>> {
  const out = new Map<string, { en?: string; nl?: string }>();
  for (let i = 0; i < qids.length; i += 50) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ action: 'wbgetentities', ids: qids.slice(i, i + 50).join('|'), props: 'sitelinks', sitefilter: 'enwiki|nlwiki', format: 'json' }).toString();
    const data = await fetchJson(url);
    for (const [qid, entity] of Object.entries<any>(data.entities || {})) {
      out.set(qid, { en: entity.sitelinks?.enwiki?.title, nl: entity.sitelinks?.nlwiki?.title });
    }
  }
  return out;
}

async function plainText(lang: 'en' | 'nl', title: string): Promise<string | null> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1', titles: title, format: 'json' }).toString();
  const data = await fetchJson(url);
  const page = Object.values<any>(data.query?.pages || {})[0];
  return page && !('missing' in page) ? page.extract || null : null;
}

/** Titles the Dutch Wikipedia search offers for "<name> <city>". */
async function searchTitles(name: string): Promise<string[]> {
  const url = new URL('https://nl.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: `${name} ${city.name}`, srlimit: '5', format: 'json' }).toString();
  const data = await fetchJson(url);
  return (data.query?.search || []).map((hit: { title: string }) => hit.title);
}

/** "Nieuwmarkt/Lastage", "Hoofdweg e.o." → the words a matching title must share. */
export function coreName(name: string): string {
  return name.replace(/\s+e\.o\.$/i, '').split('/')[0].toLowerCase().replace(/[-\s]+/g, '');
}

export const isDisambiguation = (text: string) => /\b(kan verwijzen naar|may refer to|can refer to)\b/i.test(text.slice(0, 400));
const aboutCity = (text: string) => city.aboutPattern.test(text.slice(0, 1500));
/** Whether a lede names the neighbourhood (ignoring case, spaces and hyphens). */
export function mentions(lede: string, name: string): boolean {
  const flat = lede.toLowerCase().replace(/[-\s]+/g, '');
  return flat.includes(coreName(name));
}

const articleUrl = (lang: 'en' | 'nl', title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/** Lede and `== Section ==` bodies of a plain-text extract. */
export function sections(text: string): { lede: string; byHeading: Map<string, string> } {
  const parts = text.split(/\n(={2,})\s*(.+?)\s*\1\n/);
  const byHeading = new Map<string, string>();
  for (let i = 1; i + 2 < parts.length + 1; i += 3) {
    const heading = (parts[i + 1] || '').trim().toLowerCase();
    const body = (parts[i + 2] || '').trim();
    if (heading && body && !byHeading.has(heading)) byHeading.set(heading, body);
  }
  return { lede: parts[0].trim(), byHeading };
}

/** Sentences, split conservatively (no break after "St." or initials). */
export function sentencesOf(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim()
    // No break after an abbreviation: "lit. 'Neighborhood…'", "ca. 1900", "o.a.".
    .split(/(?<![\s(](?:lit|St|ca|c|o\.a|bijv|resp|nr|Mr|Dr|jr|sr)\.)(?<=[.!?])\s+(?=[A-Z"“'(])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 1);
}

/** The first `max` characters, ended at a sentence. */
export function upToChars(text: string, max: number): string {
  let out = '';
  for (const sentence of sentencesOf(text)) {
    if (out && out.length + sentence.length + 1 > max) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  return out;
}

/** Strip pronunciation brackets: "(pronounced [ˈstaːts…])". */
export function tidy(text: string): string {
  return text
    .replace(/\s*={2,}[^=\n]+={2,}\s*/g, ' ')
    // IPA first (it can hold its own parentheses), then the empty
    // "(pronounced ; lit. …)" shell, keeping a gloss if there is one.
    .replace(/\s*\[[^\]]*[ˈːˌ][^\]]*\]/g, '')
    .replace(/\((?:Dutch )?(?:pronounced|pronunciation|uitspraak):?\s*;?\s*/gi, '(')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const NAME_PATTERNS: Record<'en' | 'nl', RegExp> = {
  en: /\b(named (?:after|for)|name (?:comes|derives|refers|is derived|was derived|originates)|lit(?:erally|\.)|takes its name|owes its name|its name|the name\b)/i,
  nl: /\b(genoemd naar|vernoemd naar|dankt (?:zijn|haar) naam|naam (?:komt|is afgeleid|verwijst|ontleent)|ontleent (?:zijn|haar) naam|de naam\b)/i,
};

/** The sentences that explain the name, from a naming section if there is one. */
export function nameSentences(text: string, lang: 'en' | 'nl'): string | undefined {
  const { lede, byHeading } = sections(text);
  const namingHeading = [...byHeading.keys()].find((heading) => /^(name|etymology|naam|naamgeving|etymologie)\b/.test(heading));
  if (namingHeading) return upToChars(tidy(byHeading.get(namingHeading)!), 420) || undefined;
  const pool = [lede, ...byHeading.values()].join('\n');
  const hits = sentencesOf(tidy(pool)).filter((sentence) => NAME_PATTERNS[lang].test(sentence));
  if (!hits.length) return undefined;
  return upToChars(hits.slice(0, 2).join(' '), 420);
}

const HISTORY_HEADINGS = /^(history|geschiedenis|historie|ontstaan|ontstaansgeschiedenis|bouwgeschiedenis)\b/;

export function historyText(text: string): string | undefined {
  const { byHeading } = sections(text);
  const heading = [...byHeading.keys()].find((h) => HISTORY_HEADINGS.test(h));
  if (!heading) return undefined;
  // Subsections inside History come through as "=== … ===" lines; keep the
  // prose that opens the section.
  const body = byHeading.get(heading)!.split(/\n={3,}[^=]+={3,}\n/)[0];
  return upToChars(tidy(body), 600) || undefined;
}

type Field = 'description' | 'history' | 'nameOrigin';
const FIELDS: Field[] = ['description', 'history', 'nameOrigin'];
const reviewPath = path.resolve(city.reviewPath);
type ReviewEntry = { en: string; from?: string; sourceField?: Field } | null;
type Review = Record<string, Partial<Record<Field, ReviewEntry>> | string>;

/** What the game shows: English text, its source article, and the original when translated. */
export interface PublishedText { en: string; sourceUrl: string; lang: 'en' | 'nl'; original?: string }
export interface PublishedNeighborhood { name: string; description?: PublishedText; history?: PublishedText; nameOrigin?: PublishedText }

/**
 * Staged text plus the reviewed English. English sources pass through unless
 * reviewed; Dutch ones need a review entry (no machine text ships unread). A
 * review written against different source text is reported, not applied.
 */
export function applyReview(staged: NeighborhoodHistory[], review: Review): { published: PublishedNeighborhood[]; problems: string[] } {
  const problems: string[] = [];
  const published = staged.map((entry) => {
    const out: PublishedNeighborhood = { name: entry.name };
    const reviewed = typeof review[entry.name] === 'object' ? review[entry.name] as Partial<Record<Field, ReviewEntry>> : {};
    for (const field of FIELDS) {
      const source = entry[field];
      const decision = reviewed[field];
      if (decision === null) continue;
      if (decision) {
        const basis = decision.sourceField ? entry[decision.sourceField] : source;
        if (!basis) { problems.push(`${entry.name}.${field}: reviewed, but no source text`); continue; }
        if (decision.from && !basis.text.startsWith(decision.from)) { problems.push(`${entry.name}.${field}: source changed since review (expected "${decision.from}…")`); continue; }
        out[field] = { en: decision.en, sourceUrl: basis.sourceUrl, lang: basis.lang, ...(basis.lang === 'nl' ? { original: basis.text } : {}) };
        continue;
      }
      if (!source) continue;
      if (source.lang === 'en') out[field] = { en: source.text, sourceUrl: source.sourceUrl, lang: 'en' };
      else problems.push(`${entry.name}.${field}: Dutch, not yet reviewed`);
    }
    return out;
  });
  return { published, problems };
}

async function main() {
  const enriched: Array<{ name: string; wikidataId?: string }> = JSON.parse(await readFile(path.join(directory, 'neighborhoods-enriched.json'), 'utf8'));
  if (process.argv.includes('--publish')) {
    const staged: NeighborhoodHistory[] = JSON.parse(await readFile(stagingPath, 'utf8'));
    const review: Review = JSON.parse(await readFile(reviewPath, 'utf8'));
    const { published, problems } = applyReview(staged, review);
    for (const problem of problems) console.log(`  ! ${problem}`);
    // An unchanged publish keeps its timestamp, so re-running is a no-op diff.
    let generatedAt = new Date().toISOString();
    try {
      const previous = JSON.parse(await readFile(publishedPath, 'utf8'));
      if (JSON.stringify(previous.neighborhoods) === JSON.stringify(published)) generatedAt = previous.generatedAt;
    } catch { /* first publish */ }
    await writeFile(publishedPath, `${JSON.stringify({ version: 1, generatedAt, neighborhoods: published }, null, 1)}\n`);
    const count = (field: Field) => published.filter((entry) => entry[field]).length;
    console.log(`published ${published.length} → ${publishedPath}: description ${count('description')}, history ${count('history')}, nameOrigin ${count('nameOrigin')}`);
    return;
  }
  const links = await sitelinks(enriched.map((hood) => hood.wikidataId).filter((qid): qid is string => !!qid));
  const out: NeighborhoodHistory[] = [];
  for (const hood of enriched) {
    const entry: NeighborhoodHistory = { name: hood.name, wikidataId: hood.wikidataId };
    const titles = hood.wikidataId ? links.get(hood.wikidataId) || {} : {};
    // No Wikidata match: the Dutch article usually exists under the name or
    // "Name (<City>)".
    const enText = titles.en ? await plainText('en', titles.en) : null;
    // The Wikidata title first, then "<name> (<City>)" and the bare name,
    // then search hits that carry the name itself (a search for an obscure
    // buurt otherwise returns the borough it is in). Disambiguation pages
    // and namesakes elsewhere are skipped.
    const candidates = [titles.nl, ...city.titleQualifiers.map((qualifier) => `${hood.name} (${qualifier})`), hood.name].filter((t): t is string => !!t);
    let nlText: string | null = null, nlTitle = '', searched = false;
    for (let i = 0; i < candidates.length; i++) {
      const text = await plainText('nl', candidates[i]);
      if (text && !isDisambiguation(text) && aboutCity(text) && mentions(sections(text).lede, hood.name)) { nlText = text; nlTitle = candidates[i]; break; }
      if (i === candidates.length - 1 && !searched) {
        searched = true;
        for (const title of await searchTitles(hood.name)) {
          if (title.toLowerCase().replace(/[-\s]+/g, '').includes(coreName(hood.name)) && !candidates.includes(title)) candidates.push(title);
        }
      }
    }
    // An English article whose lede never names the neighbourhood is about
    // something else (Helmersbuurt's Wikidata item leads to Overtoombuurt).
    const en = enText && titles.en && mentions(sections(enText).lede, hood.name) ? { text: enText, url: articleUrl('en', titles.en) } : null;
    const nl = nlText ? { text: nlText, url: articleUrl('nl', nlTitle) } : null;

    const enLede = en && upToChars(tidy(sections(en.text).lede), 420);
    const nlLede = nl && upToChars(tidy(sections(nl.text).lede), 420);
    if (enLede) entry.description = { text: enLede, lang: 'en', sourceUrl: en!.url };
    else if (nlLede) entry.description = { text: nlLede, lang: 'nl', sourceUrl: nl!.url };

    const enHistory = en && historyText(en.text);
    const nlHistory = nl && historyText(nl.text);
    if (enHistory) entry.history = { text: enHistory, lang: 'en', sourceUrl: en!.url };
    else if (nlHistory) entry.history = { text: nlHistory, lang: 'nl', sourceUrl: nl!.url };

    const enName = en && nameSentences(en.text, 'en');
    const nlName = nl && nameSentences(nl.text, 'nl');
    if (enName) entry.nameOrigin = { text: enName, lang: 'en', sourceUrl: en!.url };
    else if (nlName) entry.nameOrigin = { text: nlName, lang: 'nl', sourceUrl: nl!.url };

    out.push(entry);
    process.stdout.write('.');
  }
  // Keep translations already made for unchanged Dutch text.
  try {
    const previous: NeighborhoodHistory[] = JSON.parse(await readFile(stagingPath, 'utf8'));
    const byName = new Map(previous.map((entry) => [entry.name, entry]));
    for (const entry of out) {
      for (const field of ['description', 'history', 'nameOrigin'] as const) {
        const before = byName.get(entry.name)?.[field];
        const now = entry[field];
        if (now && before?.en && before.text === now.text) now.en = before.en;
      }
    }
  } catch { /* first run */ }
  await mkdir(path.dirname(stagingPath), { recursive: true });
  await writeFile(stagingPath, `${JSON.stringify(out, null, 1)}\n`);
  const count = (field: 'description' | 'history' | 'nameOrigin', lang?: string) => out.filter((entry) => entry[field] && (!lang || entry[field]!.lang === lang)).length;
  console.log(`\n${out.length} neighbourhoods → ${stagingPath}`);
  for (const field of ['description', 'history', 'nameOrigin'] as const) {
    console.log(`  ${field}: ${count(field)} (${count(field, 'en')} en, ${count(field, 'nl')} nl)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
