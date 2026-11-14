// Lane N1 (#323): Dutch sentences for landmark fact sets that have none, taken
// verbatim from the place's nl.wikipedia article. Writes to staging only.
//   npx tsx scripts/stage-dutch-landmark-facts.ts [--fetch]
// Never invents text: a fact gets textNl only when one sentence of the nl article
// shares its evidence (same year/number tokens AND enough shared name tokens).
import fs from 'node:fs';
import { matchFact, splitSentences } from '../src/canalRecall/facts/dutchSentenceMatch.ts';

const DIR = 'public/data/extracts/amsterdam';
const CACHE = '.cache/n1/articles.json';
const noDutch: Array<{ id: string; name: string; buurt: string; wikipedia: string; wikipediaUrl: string }> =
  JSON.parse(fs.readFileSync(process.argv.find(a => a.startsWith('--ids='))?.slice(6) ?? '.cache/n1/before.json', 'utf8')).noDutch;
const UA = { 'user-agent': 'CanalRecall/1.0 (Dutch trivia sources; +https://github.com/blackmad/map-recall2)' };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Article = { title: string; url: string; text: string; lede: string } | null;
let cache: Record<string, Article> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};

async function api(host: string, params: Record<string, string>): Promise<any> {
  const u = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: '2', redirects: '1', ...params })) u.searchParams.set(k, v);
  for (let a = 0; a < 5; a++) {
    const r = await fetch(u, { headers: UA });
    if (r.status === 429) { await sleep(3000 * (a + 1)); continue; }
    return r.json();
  }
  return null;
}
async function nlTitleFor(row: (typeof noDutch)[number]): Promise<string | null> {
  if (row.wikipedia.startsWith('nl:')) return row.wikipedia.slice(3);
  const en = decodeURIComponent(row.wikipediaUrl.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  if (!en) return null;
  const j = await api('en.wikipedia.org', { prop: 'langlinks', lllang: 'nl', titles: en });
  return j?.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
}
async function fetchArticle(title: string): Promise<Article> {
  const full = await api('nl.wikipedia.org', { prop: 'extracts|info', inprop: 'url', explaintext: '1', titles: title });
  const page = full?.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  const intro = await api('nl.wikipedia.org', { prop: 'extracts', explaintext: '1', exintro: '1', titles: title });
  return { title: page.title, url: `https://nl.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, text: page.extract, lede: intro?.query?.pages?.[0]?.extract ?? '' };
}
if (process.argv.includes('--fetch')) {
  for (const row of noDutch) {
    if (row.id in cache) continue;
    const title = await nlTitleFor(row);
    cache[row.id] = title ? await fetchArticle(title) : null;
    await sleep(250);
    fs.writeFileSync(CACHE, JSON.stringify(cache));
  }
}

const facts = JSON.parse(fs.readFileSync(`${DIR}/facts.json`, 'utf8'));
const byId = new Map<string, any>(facts.features.map((f: any) => [f.id, f]));
const rows: any[] = [], report: any[] = [];
// Hand review of the matcher's proposals (precision over yield): only accepted pairs are applied.
const review = new Map<string, string>((JSON.parse(fs.readFileSync(`${DIR}/staging/facts.dutch-20261109.review.json`, 'utf8')).accepted as Array<{ featureId: string; en: string; nl: string }>).map(a => [`${a.featureId}|${a.en}`, a.nl]));
const flat = (s: string) => s.replace(/\s+/g, ' ');
const WRITER = 'n1-lane:nl-wikipedia-sentence-match-2026-11-09';
for (const row of noDutch) {
  const set = byId.get(row.id);
  const art = cache[row.id];
  const rep = { id: row.id, name: row.name, buurt: row.buurt, status: '', nlUrl: art?.url ?? '', facts: set.facts.length, filled: 0, opening: false };
  if (!art) { rep.status = 'no nl article'; report.push(rep); continue; }
  const sentences = splitSentences(art.text);
  const used = new Set<string>();
  for (const fact of set.facts) {
    const m = matchFact(`${fact.text} ${fact.sourceQuoteEnglish ?? fact.sourceQuote ?? ''}`, sentences, used);
    const reviewed = review.get(`${row.id}|${fact.text}`);
    if (!m || !reviewed || !flat(art.text).includes(reviewed)) continue;
    m.sentence = reviewed;
    used.add(m.sentence);
    fact.textNl = m.sentence; fact.textNlEvidence = m.sentence; fact.textNlSourceUrl = art.url;
    fact.textNlWriter = WRITER; fact.textNlVerification = 'grounded';
    rows.push({ featureId: row.id, en: fact.text, nl: m.sentence, evidence: m.sentence, nlUrl: art.url, verdict: 'grounded', score: m.score });
    rep.filled++;
  }
  const lede = splitSentences(art.lede)[0];
  if (rep.filled > 0 && lede && lede.length >= 30) { set.openingNl = lede.length > 200 ? undefined : lede; rep.opening = !!set.openingNl; }
  rep.status = rep.filled ? 'filled' : 'article silent on the facts';
  report.push(rep);
}
fs.mkdirSync(`${DIR}/staging`, { recursive: true });
fs.writeFileSync(`${DIR}/staging/facts.dutch-20261109.json`, JSON.stringify(facts) + '\n');
fs.writeFileSync(`${DIR}/staging/facts.dutch-20261109.rows.json`, JSON.stringify(rows, null, 1) + '\n');
fs.writeFileSync(`${DIR}/staging/facts.dutch-20261109.report.json`, JSON.stringify(report, null, 1) + '\n');
const by: Record<string, Record<string, number>> = {};
for (const r of report) { const b = (by[r.buurt] ??= { filled: 0, silent: 0, none: 0 }); b[r.status === 'filled' ? 'filled' : r.status === 'no nl article' ? 'none' : 'silent']++; }
console.table(by);
console.log(`facts filled ${rows.length}; sets filled ${report.filter(r => r.status === 'filled').length}/${report.length}`);
