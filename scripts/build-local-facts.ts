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
import { config as loadEnv } from 'dotenv';

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
import { openingSentence } from '../src/canalRecall/facts/factStore.ts';
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

loadEnv({ path: process.env.FACT_ENV_FILE || '.env.local', override: false, quiet: true });

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const cityId = argument('city') || path.basename(directory);
const provider = argument('provider') || process.env.FACT_PROVIDER || 'ollama';
const model = argument('model') || (provider === 'openrouter'
  ? process.env.OPENROUTER_MODEL || 'qwen/qwen3.5-flash-02-23'
  : process.env.OLLAMA_MODEL || 'gemma3:4b');
const endpoint = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
const limit = Number(argument('limit') || Infinity);
const onlyCollection = argument('collection');
const cacheDirectory = path.resolve('.cache/local-facts');
const stagingDirectory = path.join(directory, 'staging');

if (!['ollama', 'openrouter'].includes(provider)) {
  throw new Error(`Unknown fact provider: ${provider}`);
}
if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is required for --provider=openrouter');
}

/**
 * Bump when the prompt or the editorial gate changes what comes out. It is
 * part of the cache key, so a bump regenerates rather than silently serving
 * sentences written under the old rules — and it is written into the output,
 * so a review sheet can be traced to the rules that produced it.
 */
const GENERATOR_VERSION = 'facts-v11-opening-then-trivia';
/** Prompt/cache version stays stable when only deterministic publication gates
 * change, so a stricter rerun does not spend another local model inference. */
const PROMPT_VERSION = 'facts-v10-opening-then-trivia';
const VERIFIER_VERSION = 'english-entailment-batch-v3';
const OPENROUTER_ADAPTER_VERSION = 'openrouter-json-nonthinking-v2';
const runVersion = `${GENERATOR_VERSION}:${provider}:${model}`;
let openRouterSpentUsd = 0;

/** Licence of every source this generator reads. Carried per statement. */
const WIKIPEDIA_LICENSE = 'CC BY-SA 4.0';

/** Extract files worth mining, and the collection name facts are keyed under. */
const COLLECTIONS = ['landmarks', 'bridges', 'squares', 'parks', 'streets', 'water'];

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
The player's card already shows a one-sentence opening from this article's lede
(who / what ${name} is). Your facts are the *second* beat from the same article —
a naming story, a person detail, a date, an oddity — so they should add something
the opening did not already say.

Rules:
- Paraphrase and compress the source into clear natural English.
- Preserve the native proper name ${name}. If its meaning is interesting and explicitly supported,
  give both forms together, for example: ${name} ("English meaning") ... Never replace the native name.
- Each fact must be ONE complete English sentence of 45 to 180 characters.
- For each fact, cite the IDs of the shortest consecutive source sentences that fully support it.
- Put sentence IDs only in evidenceIds; never add [1], [2], or any citation marker to text.
- Never combine details unless the evidence explicitly states their relationship.
- Never select a sentence beginning with "It", "This", "The bridge" or "The building".
- Do not restate what ${name} is and where it is; that is the opening sentence.
  Prefer a second detail from the same article (a namesake's fate, a rebuild year,
  an odd nickname) that makes sense *after* that opening.
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

const VERIFIER_RULES = `Judge whether the fact is a faithful plain-language restatement of the evidence.
Accept compression, ordinary emphasis, number words in place of digits, and direct common-sense
implications that do not change the proposition. For example, "newly formed" may be summarized as
"early", and an audience of 40 may be described as "only forty". A number explicitly stated in the
evidence is supported; do not invent uncertainty about it.
Reject only a materially changed relationship, subject, object, cause, date, quantity, superlative,
or a conclusion that needs outside knowledge. Check correspondence, not whether Wikipedia is trustworthy.`;

/** One cached model response, keyed by prompt content so a prompt change
 *  regenerates and a rerun costs nothing. */
interface CachedGeneration { key: string; model: string; generated: GeneratedFact[] }

async function hashKey(text: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function modelResponse(prompt: string, numPredict: number, label: string): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(provider === 'openrouter' ? openRouterEndpoint : endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(provider === 'openrouter' ? {
            authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
            'HTTP-Referer': 'https://github.com/blackmad/map-recall2',
            'X-Title': 'Map Recall local fact pipeline',
          } : {}),
        },
        body: JSON.stringify(provider === 'openrouter' ? {
          model,
          messages: [{ role: 'user', content: prompt }],
          reasoning: { enabled: false },
          response_format: { type: 'json_object' },
          temperature: attempt ? 0 : 0.3,
          max_tokens: numPredict,
        } : {
          model, prompt, stream: false, format: 'json',
          options: { temperature: attempt ? 0 : 0.3, num_predict: numPredict },
        }),
      });
      if (response.ok) {
        const payload = await response.json() as {
          response?: string;
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { cost?: number };
        };
        if (provider === 'openrouter') openRouterSpentUsd += Number(payload.usage?.cost || 0);
        return provider === 'openrouter'
          ? payload.choices?.[0]?.message?.content || ''
          : payload.response || '';
      }
      const detail = await response.text();
      lastError = new Error(`${label} HTTP ${response.status}: ${detail}`);
      if (response.status < 500 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error as Error;
    }
    await wait(750 * (attempt + 1));
  }
  throw lastError || new Error(`${label} failed without a response`);
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned || '{}');
}

async function generate(prompt: string): Promise<GeneratedFact[]> {
  const key = await hashKey(`${PROMPT_VERSION}\0${provider}\0${model}\0${provider === 'openrouter' ? OPENROUTER_ADAPTER_VERSION : ''}\0${prompt}`);
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as CachedGeneration;
    if (cached.key === key) return cached.generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const responseText = await modelResponse(prompt, 700, `${provider} writer`);
  let generated: GeneratedFact[] = [];
  try {
    const parsed = parseJsonResponse(responseText);
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

${VERIFIER_RULES}
Return exactly one result per candidate as JSON only:
{"results":[{"id":1,"supported":true|false,"reason":"brief explanation"}]}`;
  const key = await hashKey(`${VERIFIER_VERSION}\0${provider}\0${model}\0${provider === 'openrouter' ? OPENROUTER_ADAPTER_VERSION : ''}\0${prompt}`);
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
    const responseText = await modelResponse(prompt, 500, `${provider} batch verifier`);
    results = [];
    try {
      const parsed = parseJsonResponse(responseText) as { results?: Array<Partial<Verification> & { id?: number }> };
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

${VERIFIER_RULES}
Return JSON only: {"supported":true|false,"reason":"brief explanation"}`;
  const key = await hashKey(`${VERIFIER_VERSION}\0single\0${provider}\0${model}\0${provider === 'openrouter' ? OPENROUTER_ADAPTER_VERSION : ''}\0${prompt}`);
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as Verification & { key?: string };
    if (cached.key === key) return { supported: cached.supported === true, reason: String(cached.reason || '') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const responseText = await modelResponse(prompt, 180, `${provider} verifier`);
  let verdict: Verification = { supported: false, reason: 'invalid verifier response' };
  try {
    const parsed = parseJsonResponse(responseText) as Partial<Verification>;
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
interface LoggedRejection {
  featureId: string;
  featureName: string;
  collection: string;
  section: string;
  reason: RejectionReason;
  text: string;
  detail?: string;
  sourceUrl: string;
  sourceLanguage: string;
  sourceQuote?: string;
  sourceQuoteEnglish?: string;
}
const rejectionLog: LoggedRejection[] = [];
function recordRejection(
  reason: RejectionReason,
  text: string,
  context?: Omit<LoggedRejection, 'reason' | 'text'>,
): void {
  rejections.set(reason, (rejections.get(reason) || 0) + 1);
  const samples = rejectionSamples.get(reason) || [];
  if (samples.length < 3) { samples.push(text); rejectionSamples.set(reason, samples); }
  if (context) rejectionLog.push({ ...context, reason, text });
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
  const sections = splitArticleSections(article.text);
  const ledeSection = sections.find((section) => section.depth === 0 && section.text.trim())
    || sections[0];
  let opening = openingSentence(feature.wikipediaExtract);
  if (ledeSection?.text) {
    const ledeLines = article.lang === 'nl'
      ? (await translateDutchPassage(ledeSection.text, [feature.name, article.title])).english
      : sourceSentences(ledeSection.text);
    opening = openingSentence(ledeLines[0] || '') || opening;
  }
  const passages = selectSourcePassages(sections)
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
    const rejectionContext = {
      featureId: feature.id,
      featureName: feature.name,
      collection,
      section: passage.section,
      sourceUrl: article.url,
      sourceLanguage: article.lang,
    };
    const candidates: Array<VerificationCandidate & { kind: FactKind }> = [];
    for (const [index, entry] of generated.entries()) {
      const kind = normaliseKind(entry.kind);
      const evidence = evidenceFromSentences(entry.evidenceIds, sourceLines);
      const sourceEvidence = evidenceFromSentences(entry.evidenceIds, originalLines);
      if (!evidence || !sourceEvidence || !isSourceQuotation(sourceEvidence, passage.text)) {
        recordRejection('not-a-source-quotation', entry.text, rejectionContext);
        continue;
      }
      const verdict = judgeFact(entry.text, {
        name: feature.name,
        kind,
        aliases: [article.title],
        source: evidence,
        accepted: accepted.map((fact) => fact.text),
      });
      if (!verdict.ok) {
        recordRejection(verdict.reason, entry.text, {
          ...rejectionContext, sourceQuote: sourceEvidence, sourceQuoteEnglish: evidence,
        });
        continue;
      }
      candidates.push({ id: index + 1, fact: verdict.text, evidence, sourceEvidence, kind });
    }
    const verifications = await verifyEntailments(feature.name, candidates);
    for (const candidate of candidates) {
      const verification = verifications.get(candidate.id)
        || { supported: false, reason: 'verifier omitted candidate' };
      if (!verification.supported) {
        recordRejection('not-entailed', candidate.fact, {
          ...rejectionContext,
          detail: verification.reason,
          sourceQuote: candidate.sourceEvidence,
          sourceQuoteEnglish: candidate.evidence,
        });
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
        model: `${provider}:${model}`,
        verifierModel: `${provider}:${model}`,
        verification: 'grounded',
      });
    }
  }
  const facts = preferSpecific(accepted).slice(0, MAX_FACTS_PER_FEATURE);
  if (!facts.length) return null;
  return {
    id: feature.id,
    name: feature.name,
    collection,
    ...(opening ? { opening } : {}),
    facts,
  };
}

// ---- Run ----

await mkdir(stagingDirectory, { recursive: true });
const features: FeatureFacts[] = [];
let considered = 0;
let withoutArticle = 0;
let withoutPassages = 0;
let withoutSurvivors = 0;
const started = Date.now();

type RunStatus = 'running' | 'complete';

async function writeStagingSnapshot(status: RunStatus): Promise<FactsFile> {
  const generatedAt = new Date().toISOString().slice(0, 10);
  const output: FactsFile = {
    cityId,
    generatorVersion: runVersion,
    generatedAt,
    features: [...features].sort((a, b) => a.id.localeCompare(b.id)),
  };
  const totalFacts = features.reduce((sum, feature) => sum + feature.facts.length, 0);
  const rejected = [...rejections.values()].reduce((sum, count) => sum + count, 0);
  await Promise.all([
    writeFile(path.join(stagingDirectory, 'facts.json'), `${JSON.stringify(output, null, 2)}\n`),
    writeFile(path.join(stagingDirectory, 'fact-rejections.json'), `${JSON.stringify({
      cityId, generatorVersion: runVersion, generatedAt, rejections: rejectionLog,
    }, null, 2)}\n`),
    writeFile(path.join(stagingDirectory, 'fact-progress.json'), `${JSON.stringify({
      cityId,
      generatorVersion: runVersion,
      status,
      updatedAt: new Date().toISOString(),
      considered,
      featuresWithFacts: features.length,
      totalFacts,
      rejected,
      withoutArticle,
      withoutPassages,
      withoutSurvivors,
      openRouterSpentUsd: Number(openRouterSpentUsd.toFixed(6)),
    }, null, 2)}\n`),
  ]);
  return output;
}

await writeStagingSnapshot('running');

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
    if (!result) withoutSurvivors++;
    else features.push(result);
    if (considered % 10 === 0) await writeStagingSnapshot('running');
    if (!result) continue;
    if (features.length % 25 === 0) {
      const rate = (Date.now() - started) / 1000 / considered;
      process.stdout.write(`  ${features.length} features, ${considered} tried, ${rate.toFixed(1)}s each\n`);
    }
  }
}

const output = await writeStagingSnapshot('complete');

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
if (provider === 'openrouter') {
  process.stdout.write(`  OpenRouter cost this run: $${openRouterSpentUsd.toFixed(4)}\n`);
}
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
  `Generator \`${runVersion}\`, ${output.generatedAt}.`,
  `${features.length} features, ${totalFacts} facts, ${rejected} rejected before this sheet.`,
  '',
  'Every sentence below was locally summarized from the Wikipedia evidence',
  'shown beneath it, then checked by a separate local entailment pass and the',
  'deterministic editorial gate. Human approval is still required.',
  '',
  `Mark a feature in \`${cityId === 'amsterdam'
    ? 'scripts/facts-review.json'
    : `scripts/facts-review-${cityId}.json`}\`.`,
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

const rejectionReview = [
  `# Rejected facts for ${cityId}`,
  '',
  `Generator \`${runVersion}\`, ${output.generatedAt}. ${rejectionLog.length} rejected candidates.`,
  '',
  ...rejectionLog.flatMap((entry) => [
    `## ${entry.featureName}`,
    `\`${entry.featureId}\` · ${entry.collection} · ${entry.section || 'lede'} · **${entry.reason}** · [source](${entry.sourceUrl})`,
    '',
    `- Proposed: ${entry.text}`,
    ...(entry.detail ? [`- Why: ${entry.detail}`] : []),
    ...(entry.sourceQuote ? [`- Evidence (${entry.sourceLanguage}): “${entry.sourceQuote}”`] : []),
    ...(entry.sourceLanguage === 'nl' && entry.sourceQuoteEnglish
      ? [`- Local trn translation: “${entry.sourceQuoteEnglish}”`]
      : []),
    '',
  ]),
].join('\n');
await writeFile(path.join(stagingDirectory, 'fact-rejections.md'), `${rejectionReview}\n`);

process.stdout.write(`\nStaged ${path.relative(process.cwd(), path.join(stagingDirectory, 'facts.json'))}, `
  + 'facts-review.md and full rejection logs. Nothing published.\n');
