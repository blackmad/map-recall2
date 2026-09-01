/**
 * Generate rotating trivia for a city's features with a local LLM.
 *
 * Replaces `enrich-local-facts.ts`, which asked one 4B model for "three
 * interesting facts" from a feature's intro paragraph and wrote the answer
 * straight into the published extract as `funFact`. Three things are different
 * here, and all three are the same idea — a small local model is a cheap
 * writer and a poor editor, so the pipeline supplies the editing:
 *
 *   1. It reads whole articles, section by section, so the facts are drawn
 *      from == Geschiedenis == rather than from the sentence the card already
 *      shows (see `fetch-article-bodies.ts`).
 *   2. Everything the model writes goes through `factQuality.ts`, which
 *      rejects with a reason. The rejection histogram this prints is the only
 *      feedback the prompt gets.
 *   3. Nothing is published. Output lands in the gitignored staging directory
 *      beside a Markdown review sheet, and `publish-local-facts.ts` moves it
 *      only for features a human has marked reviewed. A wrong date on a card
 *      is the exact failure the work board puts above everything else.
 *
 * Requires Ollama running locally: `ollama serve`, `ollama pull gemma3:4b`.
 *
 * Usage: npm run facts:build [-- --limit=50 --model=gemma3:4b --collection=bridges]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  selectSourcePassages,
  splitArticleSections,
  type SourcePassage,
} from '../src/canalRecall/facts/articleSections.ts';
import {
  isSourceQuotation,
  judgeFact,
  similarity,
  type RejectionReason,
} from '../src/canalRecall/facts/factQuality.ts';
import {
  FACT_KINDS,
  type Fact,
  type FactKind,
  type FactsFile,
  type FeatureFacts,
} from '../src/canalRecall/facts/factTypes.ts';
import { articleReference, readCachedArticle } from './fetch-article-bodies.ts';
import {
  evidenceFromSentences,
  sourceSentences,
  stripEvidenceMarkers,
} from '../src/canalRecall/facts/groundedSummary.ts';
import { translateDutchPassage } from './lib/factTranslation.ts';

interface Feature {
  id: string;
  name: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
}

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const cityId = argument('city') || path.basename(directory);
const model = argument('model') || process.env.OLLAMA_MODEL || 'gemma3:4b';
const endpoint = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const limit = Number(argument('limit') || Infinity);
const onlyCollection = argument('collection');
const cacheDirectory = path.resolve('.cache/local-facts');
const stagingDirectory = path.join(directory, 'staging');

/**
 * Bump when the prompt or the editorial gate changes what comes out. It is
 * part of the cache key, so a bump regenerates rather than silently serving
 * sentences written under the old rules — and it is written into the output,
 * so a review sheet can be traced to the rules that produced it.
 */
const GENERATOR_VERSION = 'facts-v8-trn-then-grounded-summary';
/** Prompt/cache version stays stable when only deterministic publication gates
 * change, so a stricter rerun does not spend another local model inference. */
const PROMPT_VERSION = 'facts-v8-english-grounded-summary';
const VERIFIER_VERSION = 'english-entailment-batch-v2';

/** Licence of every source this generator reads. Carried per statement. */
const WIKIPEDIA_LICENSE = 'CC BY-SA 4.0';

/** Extract files worth mining, and the collection name facts are keyed under. */
const COLLECTIONS = ['landmarks', 'bridges', 'squares', 'parks'];

/** Facts per feature. Beyond this the tail is padding, and a player who sees
 *  a feature six times has learned it. */
const MAX_FACTS_PER_FEATURE = 6;
/** Passages to prompt per feature. Each is one model call, so this is also the
 *  run's cost knob. */
const MAX_PASSAGES_PER_FEATURE = 2;

const KIND_GUIDE = `naming — where the name comes from and what it means
history — an event, a date, a change of use
people — who built it, lived there, or it is named after
design — architecture, engineering, dimensions, materials
culture — films, books, customs, festivals, local habits
surprise — something genuinely unexpected`;

/**
 * The prompt.
 *
 * Two of these instructions are load-bearing and were added after reading real
 * output. "Never translate the name itself" is the rule item 11c's translation
 * pass learned the hard way — "The Blue Bridge is a bascule bridge" teaches
 * the wrong name for the Blauwbrug. "Skip a category rather than pad it" is
 * what stops a model asked for six facts from inventing the sixth; the
 * editorial gate would catch most of those, but not asking for them is
 * cheaper and produces better first choices.
 */
function buildPrompt(name: string, passage: SourcePassage, sourceLines: readonly string[]): string {
  const numberedSource = sourceLines
    .map((sentence, index) => `[${index + 1}] ${sentence}`)
    .join('\n');
  return `You write concise trivia for a geography game played while exploring ${cityId}.

SUBJECT: ${name}
SOURCE (the "${passage.section || 'introduction'}" section of its Wikipedia article):
${numberedSource}

Write up to 4 standalone facts about ${name} that a player would enjoy learning.

Rules:
- Paraphrase and compress the source into clear natural English.
- Each fact must be ONE complete English sentence of 45 to 180 characters.
- For each fact, cite the IDs of the shortest consecutive source sentences that fully support it.
- Put sentence IDs only in evidenceIds; never add [1], [2], or any citation marker to text.
- Never combine details unless the evidence explicitly states their relationship.
- Never select a sentence beginning with "It", "This", "The bridge" or "The building".
- Do not restate what ${name} is and where it is. The player's card already says that.
- Prefer the concrete and the surprising over the general.
- Say nothing about what is planned, proposed or under way; this text is read years from now.
- End the sentence when the fact ends. Do not append an evaluative clause such as "a striking feature" or "marking a significant milestone".
- Skip a category rather than pad it.

Classify each fact as exactly one of:
${KIND_GUIDE}

Return JSON: {"facts":[{"kind":"...","text":"concise paraphrase","evidenceIds":[2]}]}`;
}

interface GeneratedFact { kind: string; text: string; evidenceIds: number[] }
interface Verification { supported: boolean; reason: string }
interface VerificationCandidate { id: number; fact: string; evidence: string; sourceEvidence: string }

/** One cached model response, keyed by prompt content so a prompt change
 *  regenerates and a rerun costs nothing. */
interface CachedGeneration { key: string; model: string; generated: GeneratedFact[] }

async function hashKey(text: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

async function generate(prompt: string): Promise<GeneratedFact[]> {
  const key = await hashKey(`${PROMPT_VERSION}\0${model}\0${prompt}`);
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as CachedGeneration;
    if (cached.key === key) return cached.generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model, prompt, stream: false, format: 'json',
      options: { temperature: 0.3, num_predict: 700 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json() as { response?: string };
  let generated: GeneratedFact[] = [];
  try {
    const parsed = JSON.parse(payload.response || '{}');
    const list = Array.isArray(parsed) ? parsed : parsed.facts;
    // Only the requested shape is accepted. Older abstractive cache shapes
    // must never become eligible for publication.
    generated = (Array.isArray(list) ? list : [])
      .map((entry: unknown) => ({
        kind: String((entry as GeneratedFact)?.kind || ''),
        text: stripEvidenceMarkers(String((entry as GeneratedFact)?.text || '')),
        evidenceIds: Array.isArray((entry as GeneratedFact)?.evidenceIds)
          ? (entry as GeneratedFact).evidenceIds.map(Number)
          : [],
      }))
      .filter((entry) => entry.text && entry.evidenceIds.length);
  } catch {
    generated = [];
  }
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ key, model, generated } satisfies CachedGeneration));
  return generated;
}

async function verifyEntailments(
  name: string,
  candidates: readonly VerificationCandidate[],
): Promise<Map<number, Verification>> {
  if (!candidates.length) return new Map();
  const prompt = `Act as a strict fact checker. For each numbered candidate, decide independently
whether its EVIDENCE alone entails every claim in its FACT.

SUBJECT: ${name}
CANDIDATES:
${candidates.map((candidate) => `[${candidate.id}] EVIDENCE: """${candidate.evidence}"""\n[${candidate.id}] FACT: """${candidate.fact}"""`).join('\n')}

Reject changed relationships, swapped subjects or objects, added causes, dates, quantities,
superlatives, implications, or outside knowledge. Paraphrasing and compression are allowed.
Return exactly one result per candidate as JSON only:
{"results":[{"id":1,"supported":true|false,"reason":"brief explanation"}]}`;
  const key = await hashKey(`${VERIFIER_VERSION}\0${model}\0${prompt}`);
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  let results: Array<Verification & { id: number }> | null = null;
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as {
      key?: string; results?: Array<Verification & { id: number }>;
    };
    if (cached.key === key) results = (cached.results || []).map((item) => ({
      id: Number(item.id), supported: item.supported === true, reason: String(item.reason || ''),
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!results) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0, num_predict: 500 } }),
    });
    if (!response.ok) throw new Error(`Ollama verifier HTTP ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: string };
    results = [];
    try {
      const parsed = JSON.parse(payload.response || '{}') as { results?: Array<Partial<Verification> & { id?: number }> };
      results = (Array.isArray(parsed.results) ? parsed.results : []).map((item) => ({
        id: Number(item.id), supported: item.supported === true, reason: String(item.reason || ''),
      })).filter((item) => Number.isInteger(item.id));
    } catch { /* fail closed */ }
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(cacheFile, JSON.stringify({ key, results }));
  }
  const verdicts = new Map(results.map((item) => [item.id, {
    supported: item.supported, reason: item.reason,
  }]));
  // Small models sometimes omit an item from an otherwise valid JSON list.
  // Retry only those items alone; omission must never turn into approval.
  for (const candidate of candidates) {
    if (!verdicts.has(candidate.id)) {
      verdicts.set(candidate.id, await verifyOneEntailment(
        name, candidate.fact, candidate.evidence,
      ));
    }
  }
  return verdicts;
}

async function verifyOneEntailment(
  name: string, fact: string, evidence: string,
): Promise<Verification> {
  const prompt = `Act as a strict fact checker. Decide whether EVIDENCE alone entails every claim in FACT.

SUBJECT: ${name}
EVIDENCE: """${evidence}"""
FACT: """${fact}"""

Reject changed relationships, swapped subjects or objects, added causes, dates, quantities,
superlatives, implications, or outside knowledge. Paraphrasing and compression are allowed.
Return JSON only: {"supported":true|false,"reason":"brief explanation"}`;
  const key = await hashKey(`${VERIFIER_VERSION}\0single\0${model}\0${prompt}`);
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as Verification & { key?: string };
    if (cached.key === key) return { supported: cached.supported === true, reason: String(cached.reason || '') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0, num_predict: 180 } }),
  });
  if (!response.ok) throw new Error(`Ollama verifier HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json() as { response?: string };
  let verdict: Verification = { supported: false, reason: 'invalid verifier response' };
  try {
    const parsed = JSON.parse(payload.response || '{}') as Partial<Verification>;
    verdict = { supported: parsed.supported === true, reason: String(parsed.reason || '') };
  } catch { /* fail closed */ }
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ key, ...verdict }));
  return verdict;
}

/** A model classifies loosely; anything unrecognised becomes `surprise`
 *  rather than being thrown away, since the sentence is what matters. */
function normaliseKind(kind: string): FactKind {
  const lower = kind.trim().toLowerCase();
  return (FACT_KINDS as readonly string[]).includes(lower) ? lower as FactKind : 'surprise';
}

const rejections = new Map<RejectionReason, number>();
const rejectionSamples = new Map<RejectionReason, string[]>();
function recordRejection(reason: RejectionReason, text: string): void {
  rejections.set(reason, (rejections.get(reason) || 0) + 1);
  const samples = rejectionSamples.get(reason) || [];
  if (samples.length < 3) { samples.push(text); rejectionSamples.set(reason, samples); }
}

/**
 * A fact drawn from one section that repeats a fact drawn from another is
 * common — the lede summarises == Geschiedenis ==. `judgeFact` already
 * rejects those against the accepted list; this keeps the *better* of two
 * near-duplicates when the second is longer and more specific.
 */
function preferSpecific(facts: Fact[]): Fact[] {
  const kept: Fact[] = [];
  for (const fact of facts) {
    const duplicate = kept.findIndex((existing) => similarity(existing.text, fact.text) >= 0.7);
    if (duplicate < 0) { kept.push(fact); continue; }
    if (fact.text.length > kept[duplicate].text.length) kept[duplicate] = fact;
  }
  return kept;
}

async function factsForFeature(feature: Feature, collection: string): Promise<FeatureFacts | null> {
  const reference = articleReference(feature);
  if (!reference) return null;
  const article = await readCachedArticle(reference);
  if (!article) return null;
  const passages = selectSourcePassages(splitArticleSections(article.text))
    .slice(0, MAX_PASSAGES_PER_FEATURE);
  if (!passages.length) return null;

  const accepted: Fact[] = [];
  for (const passage of passages) {
    if (accepted.length >= MAX_FACTS_PER_FEATURE) break;
    const originalLines = sourceSentences(passage.text);
    const sourceLines = article.lang === 'nl'
      ? (await translateDutchPassage(passage.text, [feature.name, article.title])).english
      : originalLines;
    const generated = await generate(buildPrompt(feature.name, passage, sourceLines));
    const candidates: Array<VerificationCandidate & { kind: FactKind }> = [];
    for (const [index, entry] of generated.entries()) {
      const kind = normaliseKind(entry.kind);
      const evidence = evidenceFromSentences(entry.evidenceIds, sourceLines);
      const sourceEvidence = evidenceFromSentences(entry.evidenceIds, originalLines);
      if (!evidence || !sourceEvidence || !isSourceQuotation(sourceEvidence, passage.text)) {
        recordRejection('not-a-source-quotation', entry.text);
        continue;
      }
      const verdict = judgeFact(entry.text, {
        name: feature.name,
        kind,
        aliases: [article.title],
        source: evidence,
        accepted: accepted.map((fact) => fact.text),
      });
      if (!verdict.ok) { recordRejection(verdict.reason, entry.text); continue; }
      candidates.push({ id: index + 1, fact: verdict.text, evidence, sourceEvidence, kind });
    }
    const verifications = await verifyEntailments(feature.name, candidates);
    for (const candidate of candidates) {
      const verification = verifications.get(candidate.id)
        || { supported: false, reason: 'verifier omitted candidate' };
      if (!verification.supported) {
        recordRejection('not-entailed', `${candidate.fact} (${verification.reason})`);
        continue;
      }
      accepted.push({
        text: candidate.fact,
        kind: candidate.kind,
        section: passage.section,
        sourceQuote: candidate.sourceEvidence,
        sourceQuoteEnglish: candidate.evidence,
        sourceUrl: article.url,
        license: WIKIPEDIA_LICENSE,
        retrievedAt: article.retrievedAt,
        sourceLanguage: article.lang === 'nl' ? 'nl' : 'en',
        translator: article.lang === 'nl' ? 'trn:0.2.0:quality-high' : undefined,
        model: `ollama:${model}`,
        verifierModel: `ollama:${model}`,
        verification: 'grounded',
      });
    }
  }
  const facts = preferSpecific(accepted).slice(0, MAX_FACTS_PER_FEATURE);
  return facts.length ? { id: feature.id, name: feature.name, collection, facts } : null;
}

// ---- Run ----

await mkdir(stagingDirectory, { recursive: true });
const features: FeatureFacts[] = [];
let considered = 0;
let withoutArticle = 0;
let withoutPassages = 0;
let withoutSurvivors = 0;
const started = Date.now();

for (const collection of COLLECTIONS) {
  if (onlyCollection && collection !== onlyCollection) continue;
  let entries: Feature[];
  try {
    entries = JSON.parse(await readFile(path.join(directory, `${collection}.json`), 'utf8')) as Feature[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    continue;
  }
  for (const feature of entries) {
    if (considered >= limit) break;
    if (!articleReference(feature)) { withoutArticle++; continue; }
    considered++;
    const result = await factsForFeature(feature, collection).catch((error) => {
      process.stdout.write(`  ! ${feature.name}: ${(error as Error).message}\n`);
      return null;
    });
    if (!result) { withoutSurvivors++; continue; }
    features.push(result);
    if (features.length % 25 === 0) {
      const rate = (Date.now() - started) / 1000 / considered;
      process.stdout.write(`  ${features.length} features, ${considered} tried, ${rate.toFixed(1)}s each\n`);
    }
  }
}

const output: FactsFile = {
  cityId,
  generatorVersion: GENERATOR_VERSION,
  generatedAt: new Date().toISOString().slice(0, 10),
  features: features.sort((a, b) => a.id.localeCompare(b.id)),
};
await writeFile(path.join(stagingDirectory, 'facts.json'), `${JSON.stringify(output, null, 2)}\n`);

const totalFacts = features.reduce((sum, feature) => sum + feature.facts.length, 0);
const rejected = [...rejections.values()].reduce((sum, count) => sum + count, 0);
const kindCounts = new Map<FactKind, number>();
const langCounts = new Map<string, number>();
for (const feature of features) {
  for (const fact of feature.facts) {
    kindCounts.set(fact.kind, (kindCounts.get(fact.kind) || 0) + 1);
    const lang = /\/\/(\w+)\.wikipedia/.exec(fact.sourceUrl)?.[1] || '?';
    langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
  }
}

process.stdout.write(`\n${features.length} features with facts, ${totalFacts} facts total\n`);
process.stdout.write(`  ${considered} features tried, ${withoutSurvivors} produced nothing usable, `
  + `${withoutArticle} have no article\n`);
process.stdout.write(`  kinds: ${[...kindCounts].sort((a, b) => b[1] - a[1])
  .map(([kind, count]) => `${kind} ${count}`).join(', ')}\n`);
process.stdout.write(`  source language: ${[...langCounts].map(([lang, count]) => `${lang} ${count}`).join(', ')}\n`);
process.stdout.write(`  ${rejected} sentences rejected by the editorial gate:\n`);
for (const [reason, count] of [...rejections].sort((a, b) => b[1] - a[1])) {
  process.stdout.write(`    ${String(count).padStart(5)}  ${reason}\n`);
  for (const sample of rejectionSamples.get(reason) || []) {
    process.stdout.write(`           · ${sample.slice(0, 110)}\n`);
  }
}

// The review sheet. Publication reads a labels file keyed on feature id, so
// this exists to be read next to the game, marked up, and turned into that
// file — the same shape as the façade review sheet.
const review = [
  `# Generated facts for ${cityId} — review sheet`,
  '',
  `Generator \`${GENERATOR_VERSION}\`, model \`${model}\`, ${output.generatedAt}.`,
  `${features.length} features, ${totalFacts} facts, ${rejected} rejected before this sheet.`,
  '',
  'Every sentence below was locally summarized from the Wikipedia evidence',
  'shown beneath it, then checked by a separate local entailment pass and the',
  'deterministic editorial gate. Human approval is still required.',
  '',
  'Mark a feature by adding its id to `scripts/facts-review.json`.',
  '',
  ...features.flatMap((feature) => [
    `## ${feature.name}`,
    `\`${feature.id}\` · ${feature.collection} · [source](${feature.facts[0].sourceUrl})`,
    '',
    ...feature.facts.flatMap((fact) => [
      `- **${fact.kind}** *(${fact.section || 'lede'})* — ${fact.text}`,
      `  - Evidence (${fact.sourceLanguage}): “${fact.sourceQuote}”`,
      ...(fact.sourceLanguage === 'nl'
        ? [`  - Local trn translation: “${fact.sourceQuoteEnglish}”`]
        : []),
    ]),
    '',
  ]),
].join('\n');
await writeFile(path.join(stagingDirectory, 'facts-review.md'), `${review}\n`);

process.stdout.write(`\nStaged ${path.relative(process.cwd(), path.join(stagingDirectory, 'facts.json'))}`
  + ` and facts-review.md. Nothing published.\n`);
