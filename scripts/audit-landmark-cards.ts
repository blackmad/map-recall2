/**
 * Audit every landmark card for bare definitions and leftover Dutch, and stage
 * the curated replacements in `src/canalRecall/facts/landmark-card-overrides.json`.
 *
 * The card text is reproduced exactly as the game builds it (manual-POI merge,
 * then `splitDetail(funFact || wikipediaExtract)`), so the counts are what a
 * rider would read on an arrival or clicked card. The drive-by card's fact
 * opening (`facts.json` `opening`) is audited alongside.
 *
 *   npx tsx scripts/audit-landmark-cards.ts             report only
 *   npx tsx scripts/audit-landmark-cards.ts --stage     also write staging/landmark-cards/
 *                                                       {landmarks,facts}.json with the
 *                                                       overrides applied, and a diff report
 *   npx tsx scripts/audit-landmark-cards.ts --publish   apply the overrides to the published
 *                                                       landmarks.json and facts.json in place
 *                                                       (integrator only; idempotent, so it is
 *                                                       safe after any extract regeneration)
 *   --json=<path>      write the full flagged list as JSON
 *   --articles=<dirs>  comma-separated caches of Wikipedia articles in the `facts:articles`
 *                      format (default .cache/wikipedia-articles); each override's
 *                      sourceQuote must occur verbatim in its cached article
 *
 * The overrides go into `funFact`, which `buildLandmarks` already prefers over
 * the extract, so the encyclopedia lede and its original Dutch stay intact for
 * the next translation pass. Re-run `--stage` after any extract regeneration.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import {
  applyOverrides,
  auditCard,
  dutchTokens,
  overrideOpening,
  validateOverride,
  type CardAudit,
  type CardOverride,
} from '../src/canalRecall/facts/landmarkCardAudit.ts';
import { mergeManualPoiFeatures } from '../src/canalRecall/game/manualPoiCatalog.ts';
import type { LandmarkFeature } from '../src/canalRecall/game/extracts.ts';
import type { FactsFile } from '../src/canalRecall/facts/factTypes.ts';

const argument = (name: string) =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
// Its own subdirectory: `staging/facts.json` belongs to `facts:build`/`facts:publish`.
const stagingDirectory = path.join(directory, 'staging', 'landmark-cards');
const overridesPath = path.resolve('src/canalRecall/facts/landmark-card-overrides.json');
const articleDirectories = (argument('articles') || '.cache/wikipedia-articles').split(',').map(directory => path.resolve(directory));
const stage = process.argv.includes('--stage');
const publish = process.argv.includes('--publish');

type Feature = LandmarkFeature & { wikipediaExtractLang?: string; wikipediaExtractSource?: string; wikipediaPageviews60d?: number };

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const raw = readJson<Feature[]>(path.join(directory, 'landmarks.json'));
const factsFile = readJson<FactsFile>(path.join(directory, 'facts.json'));
const overrides = readJson<{ overrides: CardOverride[] }>(overridesPath).overrides;

// ---- Validate the overrides themselves ----
let failures = 0;
const uncached: string[] = [];
for (const override of overrides) {
  const problems = validateOverride(override).map(problem => problem.problem);
  const cached = articleDirectories
    .flatMap(directory => [encodeURIComponent(override.articleTitle), encodeURIComponent(override.articleTitle).replace(/\(/g, '%28').replace(/\)/g, '%29')]
      .map(name => path.join(directory, `${override.sourceLanguage}.${name}.json`)))
    .find(file => existsSync(file));
  if (cached) {
    const article = readJson<{ text: string }>(cached).text.replace(/\s+/g, ' ');
    for (const quote of override.sourceQuote.split(/\s+\|\s+/)) {
      if (!article.includes(quote.replace(/\s+/g, ' ').trim())) problems.push(`sourceQuote not verbatim in cached article: "${quote.slice(0, 60)}…"`);
    }
  } else {
    uncached.push(override.id);
  }
  if (!raw.some(feature => feature.id === override.id)) problems.push('no such landmark id');
  for (const problem of problems) {
    failures++;
    console.log(`OVERRIDE ${override.id} (${override.name}): ${problem}`);
  }
}

// ---- Audit before and after ----
const cityId = path.basename(directory);
/** The game's own ranking first, page views to break ties. */
const prominence = (feature: Feature) => (feature.prominenceScore ?? 0) * 1e6 + (feature.wikipediaPageviews60d ?? 0);
const factById = new Map(factsFile.features.map(feature => [feature.id, feature]));

function audit(features: readonly Feature[], openings: Map<string, string | undefined>): CardAudit[] {
  return mergeManualPoiFeatures(features as LandmarkFeature[], cityId).map(feature => {
    const card = auditCard(feature as Feature);
    // The drive-by card leads with the fact opening; a bare or Dutch opening
    // is the same defect on the other card.
    const opening = openings.get(feature.id);
    if (opening) {
      const tokens = dutchTokens(opening, feature.name, !(feature as Feature).funFact && (feature as Feature).wikipediaExtractSource === 'translated');
      if (tokens.length && !card.issues.includes('dutch')) {
        card.issues.push('dutch');
        card.dutchTokens = tokens;
      }
    }
    return card;
  });
}

const openingsBefore = new Map(factsFile.features.map(feature => [feature.id, feature.opening]));
const before = audit(raw, openingsBefore);
const { features: patched, applied, missing } = applyOverrides(raw, overrides);
const overrideById = new Map(overrides.map(override => [override.id, override]));
const openingsAfter = new Map(factsFile.features.map(feature => [
  feature.id, overrideById.has(feature.id) ? overrideOpening(overrideById.get(feature.id)!) : feature.opening,
]));
const after = audit(patched, openingsAfter);

const count = (audits: CardAudit[]) => {
  const flagged = audits.filter(card => card.issues.length);
  const by = (issue: string) => audits.filter(card => card.issues.includes(issue as never)).length;
  return { cards: audits.length, flagged: flagged.length, definitional: by('definitional'), dutch: by('dutch'), untranslated: by('untranslated'), empty: by('empty') };
};
console.log('before', JSON.stringify(count(before)));
console.log('after ', JSON.stringify(count(after)));
console.log(`overrides: ${overrides.length} (${applied.length} applied${missing.length ? `, missing ${missing.join(', ')}` : ''}; `
  + `${overrides.length - uncached.length} quotes checked against cached articles${uncached.length ? `, ${uncached.length} uncached: ${uncached.join(', ')}` : ''})`);

const featureById = new Map(raw.map(feature => [feature.id, feature]));
const remaining = after.filter(card => card.issues.length)
  .sort((a, b) => prominence(featureById.get(b.id) ?? ({} as Feature)) - prominence(featureById.get(a.id) ?? ({} as Feature)));
console.log(`\nremaining flagged, most prominent first (${remaining.length}; columns: prominenceScore, 60-day page views):`);
for (const card of remaining) {
  const feature = featureById.get(card.id);
  console.log(`  ${String(feature?.prominenceScore ?? 0).padStart(4)} ${String(feature?.wikipediaPageviews60d ?? 0).padStart(6)}  ${card.issues.join('+').padEnd(22)} ${card.name} — ${card.text.slice(0, 110)}${card.dutchTokens.length ? `  [${card.dutchTokens.join(',')}]` : ''}`);
}

const jsonOut = argument('json');
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ before: count(before), after: count(after), remaining }, null, 1)}\n`);

if (failures && (stage || publish)) {
  console.log(`\n${failures} override problem(s); nothing written`);
  process.exit(1);
}

if (stage || publish) {
  const target = publish ? directory : stagingDirectory;
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, 'landmarks.json'), JSON.stringify(patched));
  const stagedFacts: FactsFile = {
    ...factsFile,
    features: factsFile.features.map(feature => {
      const override = overrideById.get(feature.id);
      return override ? { ...feature, opening: overrideOpening(override) } : feature;
    }),
  };
  writeFileSync(path.join(target, 'facts.json'), JSON.stringify(stagedFacts));
  const diff = overrides.map(override => [
    `## ${override.name} (${override.id})`,
    `- before: ${override.replaces}`,
    `- after:  ${override.text}`,
    `- opening: ${factById.get(override.id)?.opening ?? '(no facts entry)'} -> ${factById.has(override.id) ? overrideOpening(override) : '(unchanged)'}`,
    `- source: ${override.sourceUrl}`,
    '',
  ].join('\n')).join('\n');
  mkdirSync(stagingDirectory, { recursive: true });
  writeFileSync(path.join(stagingDirectory, 'landmark-card-overrides.md'), `# Landmark card overrides\n\n${diff}`);
  console.log(`\n${publish ? 'published' : 'staged'} ${path.relative(process.cwd(), target)}/{landmarks.json,facts.json}; diff in ${path.relative(process.cwd(), stagingDirectory)}/landmark-card-overrides.md`);
}

if (failures) {
  console.log(`\n${failures} override problem(s)`);
  process.exit(1);
}
