/**
 * Measure what the cross-model façade grammar gate can actually pass.
 *
 * "0 of 6 auto-eligible" is not a result: it does not say whether the models
 * disagree about brick versus stone, or only about whether a facade has four
 * bays or five. This re-derives consensus from the stored labels through the
 * current normalizer and reports agreement field by field, so the next run can
 * gate the fields that hold and abstain on the fields that do not.
 *
 * It spends nothing: every label is read from the cached proposal file.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  exactConsensus, FACADE_GRAMMAR_COUNT_FIELDS, FACADE_GRAMMAR_FIELDS, FACADE_GRAMMAR_VALIDATION_ENUMS,
  isAbstention, normalizeFacadeGrammarLabel, type FacadeGrammarLabel,
} from '../src/canalRecall/building/facadeGrammarInference.ts';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/facade-review');
const gateFields = (arg('gate') || 'visibleStoreys,bayCount,windowPattern,groundFloorType,roofline').split(',').filter(Boolean);
const minimumConfidence = Number(arg('min-confidence') || 0.8);

type Proposal = { model: string; label?: unknown; error?: string };
type Result = { osmId: string; proposals: Proposal[]; consensus: Record<string, unknown>; autoEligible: boolean };
const source = path.join(root, 'facade-grammar-proposals.json');
const inference = JSON.parse(await readFile(source, 'utf8')) as { generatedAt: string; models: string[]; results: Result[] };

/** Stored labels predate later normalizer fixes, so re-normalize before comparing anything. */
const renormalized = inference.results.map(result => {
  const labels: FacadeGrammarLabel[] = [];
  const invalid: Array<{ model: string; reason: string }> = [];
  for (const proposal of result.proposals) {
    if (!proposal.label) { invalid.push({ model: proposal.model, reason: proposal.error || 'no-label' }); continue; }
    try { labels.push(normalizeFacadeGrammarLabel(proposal.label, FACADE_GRAMMAR_VALIDATION_ENUMS, FACADE_GRAMMAR_FIELDS)); }
    catch (error) { invalid.push({ model: proposal.model, reason: String(error) }); }
  }
  return { osmId: result.osmId, labels, invalid, storedConsensus: result.consensus, storedAutoEligible: result.autoEligible };
});

const comparable = renormalized.filter(result => result.labels.length >= 2);
const measurable = FACADE_GRAMMAR_FIELDS.filter(field => field !== 'rationale' && field !== 'visibilityConfidence');
const withinOne = (values: unknown[]) => values.every(value => typeof value === 'number')
  && Math.max(...values.map(Number)) - Math.min(...values.map(Number)) <= 1;

const fields = measurable.map(field => {
  let exact = 0, abstained = 0, disputed = 0, tolerant = 0;
  for (const result of comparable) {
    const values = result.labels.map(label => label[field]);
    const agrees = values.every(value => JSON.stringify(value) === JSON.stringify(values[0]));
    if (agrees) { exact += 1; if (values.every(isAbstention)) abstained += 1; }
    else if (FACADE_GRAMMAR_COUNT_FIELDS.includes(field as never) && withinOne(values)) { tolerant += 1; disputed += 1; }
    else disputed += 1;
  }
  return {
    field, comparableBuildings: comparable.length, exactAgreement: exact,
    // Agreeing that nothing is visible is agreement, but it is not information.
    informativeAgreement: exact - abstained, bothAbstained: abstained,
    disagreement: disputed, withinOneAgreement: FACADE_GRAMMAR_COUNT_FIELDS.includes(field as never) ? tolerant : null,
  };
});

const gateOutcome = (countTolerance: boolean) => comparable.filter(result => {
  if (!result.labels.every(label => label.targetVisible && label.visibilityConfidence >= minimumConfidence)) return false;
  const agreed = exactConsensus(result.labels, FACADE_GRAMMAR_FIELDS);
  return gateFields.every(field => field in agreed
    || (countTolerance && FACADE_GRAMMAR_COUNT_FIELDS.includes(field as never) && withinOne(result.labels.map(label => label[field]))));
}).length;

const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), source, measuredRun: inference.generatedAt,
  models: inference.models,
  sample: { buildings: renormalized.length, comparableBuildings: comparable.length, invalidLabels: renormalized.flatMap(result => result.invalid) },
  policy: { gateFields, minimumVisibilityConfidence: minimumConfidence, note: 'Measurement only. No label here is accepted evidence.' },
  gate: {
    storedAutoEligible: renormalized.filter(result => result.storedAutoEligible).length,
    exactConsensusAutoEligible: gateOutcome(false),
    countToleranceAutoEligible: gateOutcome(true),
  },
  fields,
  perBuilding: comparable.map(result => ({
    osmId: result.osmId,
    visibilityConfidence: result.labels.map(label => label.visibilityConfidence),
    exactAgreedFields: Object.keys(exactConsensus(result.labels, FACADE_GRAMMAR_FIELDS)).length,
    storedAgreedFields: Object.keys(result.storedConsensus).length,
    disputedFields: measurable.filter(field => !result.labels.every(label => JSON.stringify(label[field]) === JSON.stringify(result.labels[0][field]))),
  })),
  reviewStatus: 'machine-proposal', acceptedForNow: false,
};

const output = path.join(root, 'facade-grammar-agreement.json');
await writeFile(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
await rename(`${output}.tmp`, output);

const pad = (value: string | number, width: number) => String(value).padEnd(width);
process.stdout.write(`\n${comparable.length} of ${renormalized.length} buildings have two comparable labels (${inference.models.join(' vs ')}).\n\n`);
process.stdout.write(`${pad('field', 22)}${pad('agree', 7)}${pad('informative', 13)}${pad('both-abstain', 14)}${pad('disagree', 10)}within±1\n`);
for (const field of [...fields].sort((a, b) => b.informativeAgreement - a.informativeAgreement)) {
  process.stdout.write(`${pad(field.field, 22)}${pad(`${field.exactAgreement}/${field.comparableBuildings}`, 7)}${pad(field.informativeAgreement, 13)}${pad(field.bothAbstained, 14)}${pad(field.disagreement, 10)}${field.withinOneAgreement ?? ''}\n`);
}
process.stdout.write(`\nAuto-eligible under the ${gateFields.length}-field gate: stored ${report.gate.storedAutoEligible}, re-derived exact ${report.gate.exactConsensusAutoEligible}, counts within ±1 ${report.gate.countToleranceAutoEligible}.\n`);
