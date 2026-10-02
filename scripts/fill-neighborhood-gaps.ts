/**
 * Fill missing neighbourhood trivia (description, history, name origin, photo)
 * from every source we can name, into a staging file for review.
 *
 *   npx tsx scripts/fill-neighborhood-gaps.ts audit
 *   npx tsx scripts/fill-neighborhood-gaps.ts offline            no network
 *   npx tsx scripts/fill-neighborhood-gaps.ts online [--only "Name"]   needs the network
 *   npx tsx scripts/fill-neighborhood-gaps.ts publish [--accept offline]
 *
 * Stages, cheapest and safest first:
 *   1. alias       the same place under two outlines ("Nieuwmarkt/Lastage" and
 *                  "Nieuwmarktbuurt"): copy what the sibling has.
 *   2. street-name the area is named like a street inside or beside it
 *                  ("Van Galenbuurt", "Jan van Galenstraat"): use the street-name
 *                  register's explanation, worded as a match, not a fact.
 *   3. street-theme most streets inside share a reason in the register
 *                  ("named after sportspeople", Baltic ports, rivers).
 *   4. inside      a description composed from what lies inside the outline:
 *                  district, size, streets, landmarks, squares, parks, bridges.
 *   5. wikidata    (online) a Wikidata match by name, then its articles.
 *   6. mention     (online) sentences about the area in OTHER nl/en articles,
 *                  and its section inside the district article.
 *   7. commons     (online) a free photo from the area's Commons category, or
 *                  geotagged files near its centre.
 *
 * Nothing is written to the published extracts except by `publish`, which is
 * additive (never replaces a field that exists) and takes only candidates that
 * are English and either need no review or were approved in
 * `scripts/data/neighborhood-gap-review.json`. Dutch candidates wait for the
 * translation pass, as with `fetch-neighborhood-history.ts`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { historyText, isDisambiguation, mentions, nameSentences, sections, tidy, upToChars } from './fetch-neighborhood-history';
import {
  FIELDS, aliasCandidates, aliasOf, auditCoverage, commonsAttribution, flat, missingFields, offlineCandidates,
  rankCommonsFiles, sentencesAbout, stemOf, wikidataLooksRight, centroidOf, compareCandidates, mergeCandidates, replaceableBy, ONLINE_METHODS,
  type Boundary, type Candidate, type CommonsFile, type Field, type StreetOrigin, type StreetSegment,
} from '../src/mapRecall/neighborhoodGaps';

const directory = path.resolve('public/data/extracts/amsterdam');
const stagingDir = path.join(directory, 'staging/gap-fill');
const reviewPath = path.resolve('scripts/data/neighborhood-gap-review.json');
const headers = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, 'utf8'));

interface Enriched { name: string; wikidataId?: string; imageUrl?: string; imageAttribution?: string; wikipediaExtract?: string; [k: string]: unknown }
interface PublishedText { en: string; sourceUrl: string; lang: 'en' | 'nl'; original?: string; sourceLabel?: string; kind?: string }
interface HistoryEntry { name: string; description?: PublishedText; history?: PublishedText; nameOrigin?: PublishedText }

async function load() {
  const boundaries = (await readJson<Boundary[]>(path.join(directory, 'boundaries.json'))).filter(b => b.kind !== 'municipality');
  const enriched = await readJson<Enriched[]>(path.join(directory, 'neighborhoods-enriched.json'));
  const historyFile = await readJson<{ version: number; generatedAt: string; neighborhoods: HistoryEntry[] }>(path.join(directory, 'neighborhood-history.json'));
  const origins = (await readJson<{ origins: StreetOrigin[] }>(path.join(directory, 'street-name-origins.json'))).origins;
  const routing = await readJson<Array<{ name: string; center: [number, number] }>>(path.join(directory, 'streets-routing.json'));
  const segments: StreetSegment[] = routing.filter(s => s.name).map(s => ({ name: s.name, center: s.center }));
  const places: Array<{ name: string; type: string; center: [number, number] }> = [];
  for (const file of ['landmarks.json', 'squares.json', 'parks.json', 'bridges.json']) {
    for (const item of await readJson<Array<{ name: string; type: string; center: [number, number] }>>(path.join(directory, file))) places.push({ name: item.name, type: item.type, center: item.center });
  }
  return { boundaries, enriched, historyFile, origins, segments, places };
}

type Data = Awaited<ReturnType<typeof load>>;

function coverageOf(data: Data) {
  const history = new Map(data.historyFile.neighborhoods.map(e => [e.name, e]));
  const photos = new Map(data.enriched.map(e => [e.name, e]));
  return { history, photos, rows: auditCoverage(data.boundaries, history, photos) };
}

function table(rows: ReturnType<typeof auditCoverage>): string {
  const mark = (b: boolean) => (b ? 'yes' : '-');
  const lines = ['| Area | Kind | Description | History | Name origin | Photo |', '| --- | --- | --- | --- | --- | --- |'];
  for (const r of rows) lines.push(`| ${r.name} | ${r.kind} | ${mark(r.description)} | ${mark(r.history)} | ${mark(r.nameOrigin)} | ${mark(r.photo)} |`);
  return lines.join('\n');
}

function summary(rows: ReturnType<typeof auditCoverage>): string {
  return FIELDS.map(f => `${f} ${rows.filter(r => r[f]).length}/${rows.length}`).join(', ');
}

async function writeReport(data: Data, candidates: Candidate[], title: string) {
  const { rows } = coverageOf(data);
  const byKey = new Map<string, Candidate[]>();
  for (const c of candidates) byKey.set(`${c.name}|${c.field}`, [...(byKey.get(`${c.name}|${c.field}`) ?? []), c]);
  const filled = rows.map(r => ({ ...r }));
  for (const r of filled) for (const f of FIELDS) if (!r[f] && byKey.has(`${r.name}|${f}`)) r[f] = true;
  const out = [`# ${title}`, '', `Before: ${summary(rows)}`, `With candidates: ${summary(filled)}`, '', '## Candidates', '',
    '| Area | Field | Method | Confidence | Review | Lang | Text or image |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const c of candidates) out.push(`| ${c.name} | ${c.field} | ${c.method} | ${c.confidence} | ${c.needsReview ? 'yes' : 'no'} | ${c.lang ?? ''} | ${(c.text ?? c.imageUrl ?? '').replace(/\|/g, '/').slice(0, 160)} |`);
  const stillMissing = rows.flatMap(r => missingFields(r).filter(f => !byKey.has(`${r.name}|${f}`)).map(f => `${r.name} (${f})`));
  out.push('', `## Still missing after this run (${stillMissing.length})`, '', stillMissing.join(', ') || 'none', '', '## Coverage by area', '', table(rows));
  await mkdir(stagingDir, { recursive: true });
  await writeFile(path.join(stagingDir, 'report.md'), `${out.join('\n')}\n`);
}

// ---------------------------------------------------------------------------
// Offline

export function runOffline(data: Data): Candidate[] {
  const { history, photos, rows } = coverageOf(data);
  const names = data.boundaries.map(b => b.name);
  const candidates: Candidate[] = [];
  for (const hood of data.boundaries) {
    const row = rows.find(r => r.name === hood.name)!;
    let missing = missingFields(row);
    if (!missing.length) continue;
    const alias = aliasOf(hood.name, names);
    if (alias) {
      const donor = history.get(alias);
      const donorPhoto = photos.get(alias);
      const fromAlias = aliasCandidates(hood.name, alias, {
        description: donor?.description ? { text: donor.description.en, lang: 'en', sourceUrl: donor.description.sourceUrl } : undefined,
        history: donor?.history ? { text: donor.history.en, lang: 'en', sourceUrl: donor.history.sourceUrl } : undefined,
        nameOrigin: donor?.nameOrigin ? { text: donor.nameOrigin.en, lang: 'en', sourceUrl: donor.nameOrigin.sourceUrl } : undefined,
        photo: donorPhoto?.imageUrl ? { imageUrl: donorPhoto.imageUrl, imageAttribution: donorPhoto.imageAttribution } : undefined,
      }, missing);
      candidates.push(...fromAlias);
      const got = new Set(fromAlias.map(c => c.field));
      missing = missing.filter(f => !got.has(f));
    }
    candidates.push(...offlineCandidates({ hood, all: data.boundaries, origins: data.origins, segments: data.segments, places: data.places, missing }));
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Online

/** One request at a time, a second apart, honouring Retry-After: Wikimedia rate-limits shared egress IPs hard. */
let lastRequest = 0;
async function fetchJson(url: URL): Promise<any> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const gap = Date.now() - lastRequest;
    if (gap < 1000) await wait(1000 - gap);
    lastRequest = Date.now();
    const response = await fetch(url, { headers });
    if (response.ok) {
      const body = await response.text();
      try { return JSON.parse(body); } catch { throw new Error(`not JSON from ${url.hostname}: ${body.slice(0, 80)}`); }
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status} ${url.hostname}`);
    const retryAfter = Number(response.headers.get('retry-after')) || 0;
    await wait(Math.max(retryAfter * 1000, 2000 * 2 ** Math.min(attempt, 4)));
  }
  throw new Error(`gave up on ${url.hostname}`);
}
const api = (host: string, params: Record<string, string>) => { const u = new URL(`https://${host}/w/api.php`); u.search = new URLSearchParams({ format: 'json', origin: '*', ...params }).toString(); return u; };

async function plainText(lang: 'en' | 'nl', title: string): Promise<string | null> {
  const data = await fetchJson(api(`${lang}.wikipedia.org`, { action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1', titles: title }));
  const page = Object.values<any>(data.query?.pages || {})[0];
  return page && !('missing' in page) ? page.extract || null : null;
}
const articleUrl = (lang: 'en' | 'nl', title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/** Dutch articles on new neighbourhoods explain street naming in a "Straten" section. */
export function streetNamingSection(text: string): string | undefined {
  const { byHeading } = sections(text);
  const heading = [...byHeading.keys()].find(h => /^(straten|straatnamen|straatnaam|namen)\b/.test(h));
  if (!heading) return undefined;
  const body = tidy(byHeading.get(heading)!).split(/\n\s*\n/)[0];
  return /(vernoemd|genoemd|naam|namen)/i.test(body) ? upToChars(body.replace(/\s+/g, ' '), 420) : undefined;
}

/** A Wikidata item for the area (Amsterdam, neighbourhood-like), with its wiki titles and image. */
async function wikidataMatch(name: string): Promise<{ qid: string; en?: string; nl?: string; commonsCategory?: string; image?: string } | null> {
  for (const language of ['nl', 'en']) {
    const found = await fetchJson(api('www.wikidata.org', { action: 'wbsearchentities', search: name.split('/')[0], language, limit: '8', type: 'item' }));
    for (const hit of found.search || []) {
      if (!wikidataLooksRight(hit.description, hit.label ?? '', name)) continue;
      const entity = (await fetchJson(api('www.wikidata.org', { action: 'wbgetentities', ids: hit.id, props: 'sitelinks|claims', sitefilter: 'enwiki|nlwiki' }))).entities?.[hit.id];
      const claim = (p: string) => entity?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
      return { qid: hit.id, en: entity?.sitelinks?.enwiki?.title, nl: entity?.sitelinks?.nlwiki?.title, commonsCategory: claim('P373'), image: claim('P18') };
    }
  }
  return null;
}

async function commonsFiles(titles: string[]): Promise<CommonsFile[]> {
  const out: CommonsFile[] = [];
  for (let i = 0; i < titles.length; i += 40) {
    const data = await fetchJson(api('commons.wikimedia.org', { action: 'query', prop: 'imageinfo|categories', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '500', cllimit: '20', titles: titles.slice(i, i + 40).join('|') }));
    for (const page of Object.values<any>(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      out.push({
        title: page.title, url: info.url, thumbUrl: info.thumburl, width: info.width, height: info.height, mime: info.mime,
        license: meta.LicenseShortName?.value, artist: meta.Artist?.value, categories: (page.categories ?? []).map((c: any) => c.title).join(' '),
      });
    }
  }
  return out;
}

async function commonsPhoto(name: string, center: [number, number], category?: string): Promise<{ file: CommonsFile; method: Candidate['method'] } | null> {
  const tryCategory = async (cat: string) => {
    const members = await fetchJson(api('commons.wikimedia.org', { action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: 'file', cmlimit: '40' }));
    const titles = (members.query?.categorymembers ?? []).map((m: any) => m.title as string);
    return titles.length ? rankCommonsFiles(await commonsFiles(titles), name)[0] : undefined;
  };
  const categories = [category && `Category:${category}`, `Category:${name}`, `Category:${name} (Amsterdam)`].filter((c): c is string => !!c);
  for (const cat of categories) { const file = await tryCategory(cat).catch(() => undefined); if (file) return { file, method: 'commons-category' }; }
  const near = await fetchJson(api('commons.wikimedia.org', { action: 'query', list: 'geosearch', gscoord: `${center[0]}|${center[1]}`, gsradius: '400', gsnamespace: '6', gslimit: '40' }));
  const titles = (near.query?.geosearch ?? []).map((g: any) => g.title as string);
  const file = titles.length ? rankCommonsFiles(await commonsFiles(titles), name)[0] : undefined;
  return file ? { file, method: 'commons-geosearch' } : null;
}

export async function runOnline(data: Data, only?: string): Promise<Candidate[]> {
  const { rows } = coverageOf(data);
  const candidates: Candidate[] = [];
  const districtArticles = new Map<string, string | null>();
  for (const hood of data.boundaries) {
    if (only && hood.name !== only) continue;
    const row = rows.find(r => r.name === hood.name)!;
    const missing = missingFields(row);
    if (!missing.length) continue;
    process.stdout.write(`${hood.name}: `);
    const center = centroidOf(hood.geometry);
    const match = await wikidataMatch(hood.name).catch(() => null);
    const add = (c: Omit<Candidate, 'name'>) => { candidates.push({ name: hood.name, ...c }); process.stdout.write(`${c.field} `); };
    const wanted = (f: Field) => missing.includes(f) && !candidates.some(c => c.name === hood.name && c.field === f);

    // The area's own articles: the Wikidata sitelink, then "<name> (Amsterdam)" and the bare name.
    // Disambiguation pages and namesakes elsewhere are skipped.
    const titles: Array<['nl' | 'en', string]> = [];
    for (const t of [match?.nl, `${hood.name} (Amsterdam)`, hood.name]) if (t && !titles.some(([l, x]) => l === 'nl' && x === t)) titles.push(['nl', t]);
    if (match?.en) titles.push(['en', match.en], ['en', `${hood.name}, Amsterdam`]);
    const seen = new Set<string>();
    for (const [lang, title] of titles) {
      if (!wanted('description') && !wanted('history') && !wanted('nameOrigin')) break;
      const text = await plainText(lang, title).catch(() => null);
      if (!text || seen.has(text.slice(0, 80)) || isDisambiguation(text) || !/Amsterdam/.test(text.slice(0, 1500))) continue;
      const lede = sections(text).lede;
      if (!mentions(lede, hood.name)) continue;
      seen.add(text.slice(0, 80));
      const base = { lang, sourceUrl: articleUrl(lang, title), sourceLabel: 'Wikipedia', method: 'wiki-article' as const, confidence: 'high' as const, needsReview: lang === 'nl' };
      const description = upToChars(tidy(lede), 420);
      if (description && wanted('description')) add({ field: 'description', text: description, ...base });
      const history = historyText(text);
      if (history && wanted('history')) add({ field: 'history', text: history, ...base });
      const origin = nameSentences(text, lang) ?? streetNamingSection(text);
      if (origin && wanted('nameOrigin')) add({ field: 'nameOrigin', text: origin, ...base });
    }

    // The Wikidata item for a place that has no article of its own may still name its image.
    // Sentences about the area in other articles, and its section in a district article.
    if (hood.kind !== 'suburb' && (wanted('description') || wanted('history') || wanted('nameOrigin'))) {
      const search = await fetchJson(api('nl.wikipedia.org', { action: 'query', list: 'search', srsearch: `"${hood.name.split('/')[0]}" Amsterdam`, srlimit: '6', srprop: 'snippet' })).catch(() => null);
      for (const hit of (search?.query?.search ?? []) as Array<{ title: string }>) {
        if (!wanted('description') && !wanted('nameOrigin')) break;
        const text = await plainText('nl', hit.title).catch(() => null);
        if (!text) continue;
        const sentence = sentencesAbout(text, hood.name);
        if (sentence && wanted('description')) add({ field: 'description', text: sentence, lang: 'nl', sourceUrl: articleUrl('nl', hit.title), sourceLabel: 'Wikipedia', method: 'wiki-mention', confidence: 'low', needsReview: true, note: `sentence from "${hit.title}"` });
        const named = text.split('\n').filter(l => /genoemd naar|vernoemd naar|dankt (zijn|haar) naam/i.test(l) && flat(l).includes(stemOf(hood.name)));
        if (named[0] && wanted('nameOrigin')) add({ field: 'nameOrigin', text: sentencesAbout(named[0], hood.name) ?? named[0].slice(0, 300), lang: 'nl', sourceUrl: articleUrl('nl', hit.title), sourceLabel: 'Wikipedia', method: 'wiki-mention', confidence: 'low', needsReview: true });
      }
    }

    // The Wikidata item's own image, when it is a usable photograph.
    if (wanted('photo') && match?.image) {
      const [file] = rankCommonsFiles(await commonsFiles([`File:${match.image}`]).catch(() => []), hood.name);
      if (file) add({ field: 'photo', imageUrl: file.thumbUrl ?? file.url, imageAttribution: commonsAttribution(file), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.title.replace(/ /g, '_'))}`, sourceLabel: 'Wikimedia Commons', method: 'wikidata-search', confidence: 'high', needsReview: false });
    }
    if (wanted('photo')) {
      const photo = await commonsPhoto(hood.name, center, match?.commonsCategory).catch(() => null);
      if (photo) add({ field: 'photo', imageUrl: photo.file.thumbUrl ?? photo.file.url, imageAttribution: commonsAttribution(photo.file), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(photo.file.title.replace(/ /g, '_'))}`, sourceLabel: 'Wikimedia Commons', method: photo.method, confidence: photo.method === 'commons-category' ? 'medium' : 'low', needsReview: photo.method === 'commons-geosearch' });
    }
    void districtArticles;
    process.stdout.write('\n');
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Publish

type ReviewFile = Record<string, Partial<Record<Field, { approve?: boolean; en?: string } | null>> | string>;

/** Candidates ready to ship: English text with no review flag or an approval, and photos likewise. */
export function publishable(candidates: readonly Candidate[], review: ReviewFile, acceptOffline: boolean): Array<Candidate & { final: string | undefined }> {
  const out: Array<Candidate & { final: string | undefined }> = [];
  const ok = (c: Candidate): (Candidate & { final: string | undefined }) | null => {
    const decision = typeof review[c.name] === 'object' ? (review[c.name] as Record<string, { approve?: boolean; en?: string } | null | undefined>)[c.field] : undefined;
    if (decision === null) return null; // explicitly dropped
    const offline = c.method === 'alias' || c.method === 'street-name' || c.method === 'street-theme' || c.method === 'inside-boundary';
    const approved = decision?.approve === true || (acceptOffline && offline && c.lang !== 'nl');
    if (c.needsReview && !approved) return null;
    if (c.lang === 'nl' && !decision?.en) return null; // Dutch ships only with a reviewed English
    return { ...c, final: decision?.en ?? c.text };
  };
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) groups.set(`${c.name}|${c.field}`, [...(groups.get(`${c.name}|${c.field}`) ?? []), c]);
  // The best candidate that is actually shippable, per area and field.
  for (const group of groups.values()) {
    for (const c of [...group].sort(compareCandidates)) { const ready = ok(c); if (ready) { out.push(ready); break; } }
  }
  return out;
}

async function publish(data: Data, acceptOffline: boolean) {
  const candidates = await readJson<Candidate[]>(path.join(stagingDir, 'candidates.json'));
  let review: ReviewFile = {};
  try { review = await readJson<ReviewFile>(reviewPath); } catch { /* none yet */ }
  const ready = publishable(candidates, review, acceptOffline);
  const history = new Map(data.historyFile.neighborhoods.map(e => [e.name, e]));
  const enriched = new Map(data.enriched.map(e => [e.name, e]));
  let added = 0, replaced = 0;
  for (const c of ready) {
    if (c.field === 'photo') {
      const entry = enriched.get(c.name) ?? { name: c.name } as Enriched;
      if (entry.imageUrl) continue;
      entry.imageUrl = c.imageUrl; entry.imageAttribution = c.imageAttribution;
      if (!enriched.has(c.name)) { enriched.set(c.name, entry); data.enriched.push(entry); }
      added++;
      continue;
    }
    if (!c.final) continue;
    const entry = history.get(c.name) ?? { name: c.name } as HistoryEntry;
    const existing = entry[c.field];
    // Additive: published text stays, except composed text that an article now beats.
    if (existing && !replaceableBy(existing.kind, c)) continue;
    entry[c.field] = { en: c.final, sourceUrl: c.sourceUrl, lang: c.lang ?? 'en', sourceLabel: c.sourceLabel, kind: c.method === 'wiki-article' || c.method === 'wikidata-search' || c.method === 'wiki-mention' || c.method === 'alias' ? 'wikipedia' : 'derived', ...(c.lang === 'nl' ? { original: c.text } : {}) };
    if (!history.has(c.name)) { history.set(c.name, entry); data.historyFile.neighborhoods.push(entry); }
    if (existing) replaced++; else added++;
  }
  await writeFile(path.join(directory, 'neighborhood-history.json'), `${JSON.stringify({ ...data.historyFile, generatedAt: new Date().toISOString() }, null, 1)}\n`);
  await writeFile(path.join(directory, 'neighborhoods-enriched.json'), `${JSON.stringify(data.enriched, null, 2)}\n`);
  console.log(`published ${added} new fields and replaced ${replaced} composed ones, from ${candidates.length} candidates (${candidates.length - ready.length} not shipped: held for review or outranked)`);
}

async function main() {
  const [command = 'audit'] = process.argv.slice(2);
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;
  const data = await load();
  await mkdir(stagingDir, { recursive: true });
  if (command === 'audit') {
    const { rows } = coverageOf(data);
    await writeReport(data, [], 'Neighbourhood trivia coverage');
    console.log(summary(rows));
    return;
  }
  if (command === 'offline') {
    let previous: Candidate[] = [];
    try { previous = await readJson<Candidate[]>(path.join(stagingDir, 'candidates.json')); } catch { /* none */ }
    // Offline output is rebuilt from scratch; whatever the online stage found stays.
    const kept = previous.filter(c => ONLINE_METHODS.has(c.method));
    const candidates = [...runOffline(data), ...kept];
    await writeFile(path.join(stagingDir, 'candidates.json'), `${JSON.stringify(candidates, null, 1)}\n`);
    await writeReport(data, candidates, 'Gap-fill candidates (offline + online)');
    console.log(`${candidates.length} candidates (${kept.length} online kept) → ${stagingDir}`);
    return;
  }
  if (command === 'online') {
    let previous: Candidate[] = [];
    try { previous = await readJson<Candidate[]>(path.join(stagingDir, 'candidates.json')); } catch { /* none */ }
    const found = await runOnline(data, only);
    const merged = mergeCandidates(previous, found);
    await writeFile(path.join(stagingDir, 'candidates.json'), `${JSON.stringify(merged, null, 1)}\n`);
    await writeReport(data, merged, 'Gap-fill candidates (offline + online)');
    console.log(`${found.length} new candidates → ${stagingDir}`);
    return;
  }
  if (command === 'publish') { await publish(data, process.argv.includes('--accept') && process.argv[process.argv.indexOf('--accept') + 1] === 'offline'); return; }
  console.log('commands: audit | offline | online [--only "Name"] | publish [--accept offline]');
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
