/**
 * Builds public/data/extracts/amsterdam/neighborhood-stories.json from
 * reviewed picks (scripts/data/neighborhood-stories-picks.json).
 *
 * Every pick names the sourced record it rests on and quotes the evidence
 * sentence verbatim. The build refuses (exit 1, listed) any pick whose quote
 * is not in that record, whose numbers/years are not in the quote, whose
 * landmark lies outside the area outline, that is too long, or that touches
 * the card content rules (statistics, crime, planning boilerplate).
 *
 * Sources a pick may cite:
 *   neighborhood-history  key = area name, field = description|history|nameOrigin|localFact;
 *                          the quote must occur in the field's `original` or `en`.
 *   area-fact-review       key = area name (approved picks only); the quote must
 *                          occur in one of the cited sentences.
 *   facts                  key = facts.json feature id; the quote must occur in a
 *                          fact's sourceQuote or sourceQuoteEnglish; the
 *                          feature's centre must lie inside the area polygon and
 *                          the pick text must name it (`from.as` or its name).
 *
 * Entries from the legacy import (they carry `importId`) are kept unchanged
 * unless the picks file has the same area. Usage:
 *   node --import tsx scripts/build-neighborhood-stories.ts          # write JSON + report
 *   node --import tsx scripts/build-neighborhood-stories.ts --check  # exit 1 when stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { excludedBy } from '../src/mapRecall/areaFacts';
import { attachNeighborhoodStories, type NeighborhoodStoriesFile, type NeighborhoodStory, type NeighborhoodStoryFact } from '../src/mapRecall/neighborhoodStories';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const OUT = path.join(EXTRACT, 'neighborhood-stories.json');
const REPORT = path.join(EXTRACT, 'staging/neighborhood-stories-report.md');
const PICKS = path.join(ROOT, 'scripts/data/neighborhood-stories-picks.json');
const MAX_LEN = 160;
const QUIZ_KINDS = ['neighborhood', 'neighbourhood', 'quarter'];

type HistoryField = 'description' | 'history' | 'nameOrigin' | 'localFact';
interface PickSource { file: 'neighborhood-history' | 'facts' | 'area-fact-review'; key?: string; field?: HistoryField; quote: string; as?: string }
interface Pick { text: string; from: PickSource }
interface AreaPicks { topFacts: Pick[]; rotatingFacts?: Pick[]; note?: string }
interface PicksFile { reviewedAt: string; areas: Record<string, AreaPicks>; unsupported?: Record<string, string>; spotChecks?: Array<{ area: string; startsWith: string; note: string }> }
interface SourcedText { en: string; sourceUrl: string; lang?: string; original?: string; sourceLabel?: string; kind?: string }
interface HistoryEntry { name: string; description?: SourcedText; history?: SourcedText; nameOrigin?: SourcedText; localFact?: SourcedText }
interface ReviewCite { from: string; lang: 'en' | 'nl'; sourceUrl: string; text: string }
interface ReviewEntry { en: string; cites: ReviewCite[]; approve?: boolean }
interface FactRecord { text: string; sourceQuote?: string; sourceQuoteEnglish?: string; sourceUrl: string; sourceLanguage?: string }
interface FactFeature { id: string; name: string; collection: string; facts: FactRecord[] }
type LatLng = [number, number];
type Polygon = LatLng[][];
interface Boundary { name: string; kind: string; geometry: Polygon[] }

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const numbersIn = (s: string) => s.match(/\b\d{2,}\b/g) ?? [];

function labelFor(url: string, explicit?: string, lang?: string): string {
  if (explicit) return explicit;
  const host = new URL(url).host;
  if (host === 'nl.wikipedia.org') return 'Wikipedia (translated from Dutch)';
  if (host.endsWith('wikipedia.org')) return 'Wikipedia';
  if (host === 'api.data.amsterdam.nl') return 'Gemeente Amsterdam street-name register';
  return lang === 'nl' ? `${host} (translated from Dutch)` : host;
}

function inRing(p: LatLng, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inGeometry = (p: LatLng, geometry: Polygon[]) => geometry.some(poly => inRing(p, poly[0]) && !poly.slice(1).some(hole => inRing(p, hole)));

// ---- load sources -------------------------------------------------------
const history = new Map(readJson<{ neighborhoods: HistoryEntry[] }>(path.join(EXTRACT, 'neighborhood-history.json')).neighborhoods.map(h => [h.name, h]));
const review = readJson<Record<string, ReviewEntry | string | null>>(path.join(ROOT, 'scripts/data/area-fact-review.json'));
const factFeatures = new Map(readJson<{ features: FactFeature[] }>(path.join(EXTRACT, 'facts.json')).features.map(f => [f.id, f]));
const centers = new Map<string, LatLng>();
for (const collection of ['bridges', 'parks', 'squares', 'streets', 'water', 'landmarks']) {
  const data = readJson<Array<{ id: string; center: LatLng }> | { features: Array<{ id: string; center: LatLng }> }>(path.join(EXTRACT, `${collection}.json`));
  for (const item of Array.isArray(data) ? data : data.features) if (item.center) centers.set(item.id, item.center);
}
const boundaries = readJson<Boundary[]>(path.join(EXTRACT, 'boundaries.json')).filter(b => QUIZ_KINDS.includes(b.kind));
const quizAreas = [...new Set(boundaries.map(b => b.name))];
const picksFile = readJson<PicksFile>(PICKS);
const existingText = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const existing: NeighborhoodStoriesFile = existingText ? JSON.parse(existingText) : { version: 1, cityId: 'amsterdam', entries: [] };
const legacy = existing.entries.filter(e => 'importId' in e);

// ---- resolve picks ------------------------------------------------------
interface Rejection { area: string; text: string; reason: string }
const rejected: Rejection[] = [];
const sourceTally: Record<string, number> = {};

function resolve(area: string, pick: Pick): NeighborhoodStoryFact | null {
  const reject = (reason: string) => { rejected.push({ area, text: pick.text, reason }); return null; };
  const { from } = pick;
  const text = squash(pick.text ?? '');
  const quote = squash(from?.quote ?? '');
  if (!text) return reject('empty text');
  if (!quote) return reject('no evidence quote');
  if (text.length > MAX_LEN) return reject(`text is ${text.length} characters (max ${MAX_LEN})`);
  const rule = excludedBy(text);
  if (rule) return reject(`content rule: ${rule}`);
  const key = from.key ?? area;
  let sourceUrl = '', sourceLabel = '';
  if (from.file === 'neighborhood-history') {
    const entry = history.get(key);
    if (!entry) return reject(`no neighborhood-history entry "${key}"`);
    if (!from.field) return reject('neighborhood-history pick needs a field');
    const field = entry[from.field];
    if (!field) return reject(`neighborhood-history "${key}" has no ${from.field}`);
    if (![field.original, field.en].some(t => t && squash(t).includes(quote))) return reject(`quote not found verbatim in neighborhood-history "${key}".${from.field}`);
    sourceUrl = field.sourceUrl;
    sourceLabel = labelFor(field.sourceUrl, field.sourceLabel, field.lang);
  } else if (from.file === 'area-fact-review') {
    const entry = review[key];
    if (!entry || typeof entry !== 'object') return reject(`no area-fact-review entry "${key}"`);
    if (!entry.approve) return reject(`area-fact-review "${key}" is not approved`);
    const cite = entry.cites.find(c => squash(c.text).includes(quote));
    if (!cite) return reject(`quote not found verbatim in the cites of area-fact-review "${key}"`);
    sourceUrl = cite.sourceUrl;
    sourceLabel = labelFor(cite.sourceUrl, undefined, cite.lang);
  } else if (from.file === 'facts') {
    const feature = factFeatures.get(key);
    if (!feature) return reject(`no facts.json feature "${key}"`);
    // The fact's own `text` is a model paraphrase; only the quoted source sentence is evidence.
    const fact = feature.facts.find(f => [f.sourceQuote, f.sourceQuoteEnglish].some(t => t && squash(t).includes(quote)));
    if (!fact) return reject(`quote not found verbatim in a source quote of facts.json "${key}" (${feature.name})`);
    const center = centers.get(key);
    if (!center) return reject(`no centre for ${key} (${feature.name})`);
    const outlines = boundaries.filter(b => b.name === area);
    if (!outlines.some(b => inGeometry(center, b.geometry))) return reject(`${feature.name} (${key}) lies outside the ${area} outline`);
    const shown = from.as ?? feature.name;
    if (!text.toLowerCase().includes(shown.toLowerCase())) return reject(`text does not name the landmark "${shown}"`);
    sourceUrl = fact.sourceUrl;
    sourceLabel = labelFor(fact.sourceUrl, undefined, fact.sourceLanguage);
  } else {
    return reject(`unknown source file "${(from as PickSource).file}"`);
  }
  if (!/^https:\/\//.test(sourceUrl)) return reject(`source URL is not https: ${sourceUrl}`);
  const missing = numbersIn(text).filter(n => !quote.includes(n));
  if (missing.length) return reject(`numbers not in the evidence: ${missing.join(', ')}`);
  sourceTally[from.file] = (sourceTally[from.file] ?? 0) + 1;
  return { text, sourceUrl, sourceLabel, evidence: quote, verification: 'grounded', reviewedAt: picksFile.reviewedAt };
}

const pickedAreas = Object.keys(picksFile.areas);
for (const area of pickedAreas) if (!quizAreas.includes(area) && !legacy.some(e => e.areaName === area)) rejected.push({ area, text: '(whole area)', reason: 'not a quiz area' });
const built: NeighborhoodStory[] = [];
for (const [areaName, picks] of Object.entries(picksFile.areas)) {
  const topFacts = picks.topFacts.map(p => resolve(areaName, p)).filter((f): f is NeighborhoodStoryFact => !!f);
  const rotatingFacts = (picks.rotatingFacts ?? []).map(p => resolve(areaName, p)).filter((f): f is NeighborhoodStoryFact => !!f);
  const seen = new Set<string>();
  for (const fact of [...topFacts, ...rotatingFacts]) {
    const k = fact.text.toLowerCase();
    if (seen.has(k)) rejected.push({ area: areaName, text: fact.text, reason: 'duplicate text within the area' });
    seen.add(k);
  }
  if (topFacts.length > 2) rejected.push({ area: areaName, text: '(topFacts)', reason: `${topFacts.length} top facts; at most 2 are shown` });
  built.push({ areaName, topFacts, rotatingFacts });
}

const entries = [...legacy.filter(e => !picksFile.areas[e.areaName]), ...built];
const order = (name: string) => { const i = quizAreas.indexOf(name); return i < 0 ? quizAreas.length : i; };
entries.sort((a, b) => order(a.areaName) - order(b.areaName) || a.areaName.localeCompare(b.areaName));
const output: NeighborhoodStoriesFile = { version: 1, cityId: 'amsterdam', entries };
const outputText = JSON.stringify(output, null, 2) + '\n';

// ---- coverage -----------------------------------------------------------
const features = quizAreas.map(name => ({ name, type: 'neighborhood' as const, cityId: 'amsterdam' }));
function coverage(file: NeighborhoodStoriesFile) {
  const attached = attachNeighborhoodStories(features, file);
  const per = new Map(attached.map(f => [f.name, { top: f.neighborhoodTopFacts?.length ?? 0, rotating: f.neighborhoodRotatingFacts?.length ?? 0 }]));
  const withStory = [...per.values()].filter(v => v.top > 0).length;
  const top = [...per.values()].reduce((s, v) => s + v.top, 0);
  const rotating = [...per.values()].reduce((s, v) => s + v.rotating, 0);
  return { per, withStory, top, rotating };
}
const before = coverage({ version: 1, cityId: 'amsterdam', entries: legacy });
const after = coverage(output);

const lines: string[] = [];
lines.push('# Neighbourhood stories build report', '');
lines.push('Generated by `scripts/build-neighborhood-stories.ts` from `scripts/data/neighborhood-stories-picks.json`.');
lines.push(`Picks reviewed ${picksFile.reviewedAt}. Quiz areas: ${quizAreas.length} distinct names (${boundaries.length} outlines of kind ${QUIZ_KINDS.join('/')}).`, '');
lines.push('## Coverage (through `attachNeighborhoodStories`)', '');
lines.push('| | areas with a story | top facts shown | rotating facts | rotating per covered area |', '|---|---|---|---|---|');
for (const [label, c] of [['Before (legacy import only)', before], ['After', after]] as const) lines.push(`| ${label} | ${c.withStory} / ${quizAreas.length} | ${c.top} | ${c.rotating} | ${(c.rotating / Math.max(1, c.withStory)).toFixed(1)} |`);
lines.push('', `Evidence sources used by the picks: ${Object.entries(sourceTally).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
lines.push('## Per area', '', '| area | before top/rotating | after top/rotating | origin |', '|---|---|---|---|');
for (const name of quizAreas) {
  const b = before.per.get(name)!, a = after.per.get(name)!;
  const origin = picksFile.areas[name] ? 'picks' : legacy.some(e => e.areaName === name) ? 'legacy' : '—';
  lines.push(`| ${name} | ${b.top}/${b.rotating} | ${a.top}/${a.rotating} | ${origin} |`);
}
const without = quizAreas.filter(n => !after.per.get(n)!.top);
lines.push('', '## Areas still without a story', '');
if (!without.length) lines.push('None.');
for (const name of without) lines.push(`- ${name}: ${picksFile.unsupported?.[name] ?? 'no reviewed pick'}`);
lines.push('', '## Rejected picks', '');
if (!rejected.length) lines.push('None: every pick resolved to a verbatim evidence quote with its numbers, outline and content checks passing.');
for (const r of rejected) lines.push(`- **${r.area}**: "${r.text}" — ${r.reason}`);
lines.push('', '## Spot checks', '');
lines.push('Each pick below was re-read against the stored source text (the verbatim evidence quote in the record named by the pick) to confirm the line keeps the claim and adds nothing.', '');
for (const check of picksFile.spotChecks ?? []) {
  const entry = entries.find(e => e.areaName === check.area);
  const fact = entry && [...entry.topFacts, ...entry.rotatingFacts].find(f => f.text.startsWith(check.startsWith));
  if (!fact) { rejected.push({ area: check.area, text: check.startsWith, reason: 'spot check names a pick that does not exist' }); continue; }
  lines.push(`- **${check.area}** — “${fact.text}”`, `  - evidence: “${fact.evidence}”`, `  - source: ${fact.sourceUrl} (${fact.sourceLabel})`, `  - check: ${check.note}`);
}
lines.push('');
const reportText = lines.join('\n');

if (process.argv.includes('--check')) {
  const stale = outputText !== existingText;
  if (rejected.length) console.error(`${rejected.length} rejected pick(s):\n${rejected.map(r => `  ${r.area}: ${r.reason} — "${r.text}"`).join('\n')}`);
  if (stale) console.error('neighborhood-stories.json is stale; run node --import tsx scripts/build-neighborhood-stories.ts');
  if (!stale && !rejected.length) console.log(`neighborhood-stories.json is current: ${after.withStory}/${quizAreas.length} areas, ${after.top} top and ${after.rotating} rotating facts.`);
  process.exit(stale || rejected.length ? 1 : 0);
}
if (rejected.length) {
  console.error(`Refusing to write: ${rejected.length} rejected pick(s):\n${rejected.map(r => `  ${r.area}: ${r.reason} — "${r.text}"`).join('\n')}`);
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, reportText);
  process.exit(1);
}
fs.writeFileSync(OUT, outputText);
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, reportText);
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${before.withStory} -> ${after.withStory} of ${quizAreas.length} areas; top ${before.top} -> ${after.top}; rotating ${before.rotating} -> ${after.rotating}. Report: ${path.relative(ROOT, REPORT)}`);
