/** Bootstrap review-only procedural facade labels from cached municipal panorama crops. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import { exactConsensus, FACADE_GRAMMAR_ENUMS, FACADE_GRAMMAR_VALIDATION_ENUMS, normalizeFacadeGrammarLabel, type FacadeGrammarLabel } from '../src/canalRecall/building/facadeGrammarInference.ts';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/facade-review');
const modelIds = (arg('models') || 'google/gemini-3.1-pro-preview,anthropic/claude-sonnet-4.6').split(',').filter(Boolean);
const limit = Math.max(1, Number(arg('limit') || 6));
const ceiling = Math.min(10, Math.max(0.01, Number(process.env.OPENROUTER_SPEND_LIMIT_USD || 10)));
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required (load it from an ignored environment file).');

const enums = FACADE_GRAMMAR_ENUMS;
const nullableInteger = { anyOf: [{ type: 'integer', minimum: 1, maximum: 30 }, { type: 'null' }] };
const properties: Record<string, unknown> = { targetVisible: { type: 'boolean' }, visibilityConfidence: { type: 'number', minimum: 0, maximum: 1 }, visibleStoreys: nullableInteger, bayCount: nullableInteger };
for (const [key, values] of Object.entries(enums)) properties[key] = { type: 'string', enum: values };
Object.assign(properties, { groundFloorDistinct: { anyOf: [{ type: 'boolean' }, { type: 'null' }] }, windowFrameColour: { type: 'string', enum: [...enums.facadeColour, 'natural-wood'] }, rationale: { type: 'string', maxLength: 500 } });
const schema = { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
const validationEnums = FACADE_GRAMMAR_VALIDATION_ENUMS;
type Label = FacadeGrammarLabel;
type Manifest = { items: Array<{ osmId: string; image: string; panoId: string; centre: number[]; evidenceQuality?: string; reviewedAt?: string }> };

async function classify(model: string, imageFile: string): Promise<{ label: Label; cost: number }> {
  const image = (await readFile(imageFile)).toString('base64');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://github.com/map-recall', 'X-Title': 'Map Recall facade grammar pilot' }, body: JSON.stringify({
    model, temperature: 0, max_tokens: 2500, reasoning: { effort: 'low' },
    provider: { require_parameters: true },
    response_format: { type: 'json_schema', json_schema: { name: 'facade_grammar', strict: true, schema } },
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Describe only the intended central Amsterdam building facade. Do not count neighbouring buildings. Unknown is correct when trees, vehicles, perspective, or cropping obscure a field. Extract a restrained procedural facade grammar, not a photographic description. Return the required schema.' },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
    ] }],
  }) });
  const body = await response.json() as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }>; usage?: { cost?: number } };
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${body.error?.message || ''}`);
  const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}') as unknown;
  return { label: normalizeFacadeGrammarLabel(parsed, validationEnums, Object.keys(properties)), cost: Number(body.usage?.cost || 0) };
}

const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) as Manifest;
// FACADE_ENRICHMENT_DESIGN.md requires a human-selected panorama per building, but that
// view-review machinery was reverted in 24c8beb and is not back yet. Nearest-camera crops
// are still worth classifying; they must never be recorded as if a reviewer had chosen them.
const panoramaSelection = manifest.items.every(item => item.evidenceQuality && item.reviewedAt)
  ? 'human-reviewed' : 'nearest-camera-unreviewed';
if (panoramaSelection !== 'human-reviewed') process.stdout.write('Input crops are nearest-camera and unreviewed; output is a weaker proposal than the design contract.\n');
const results: unknown[] = []; let spent = 0;
for (const item of manifest.items.slice(0, limit)) {
  const proposals: Array<{ model: string; label?: Label; cost?: number; error?: string }> = [];
  for (const model of modelIds) {
    if (spent >= ceiling) throw new Error(`Local $${ceiling.toFixed(2)} spend ceiling reached.`);
    try { const result = await classify(model, path.join(root, item.image)); spent += result.cost; proposals.push({ model, ...result }); }
    catch (error) { proposals.push({ model, error: String(error) }); }
  }
  const labels = proposals.flatMap(value => value.label ? [value.label] : []);
  const agreed = exactConsensus(labels, Object.keys(properties));
  const autoEligible = labels.length >= 2 && labels.every(value => value.targetVisible && value.visibilityConfidence >= .8) && ['visibleStoreys', 'bayCount', 'windowPattern', 'groundFloorType', 'roofline'].every(key => key in agreed);
  results.push({ osmId: item.osmId, panoId: item.panoId, centre: item.centre, proposals, consensus: agreed, autoEligible, reviewStatus: 'machine-proposal', acceptedForNow: false });
  process.stdout.write(`${item.osmId}: ${labels.length}/${modelIds.length} models · ${Object.keys(agreed).length} agreed fields · $${spent.toFixed(4)} total\n`);
}
const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceManifest: path.join(root, 'manifest.json'), models: modelIds, budget: { ceilingUsd: ceiling, observedCostUsd: spent }, policy: { minimumVisibilityConfidence: .8, humanReviewOptional: true, autoEligibleDoesNotMeanAccepted: true, panoramaSelection }, results };
await writeFile(path.join(root, 'facade-grammar-proposals.json'), `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`Wrote ${results.length} machine proposals; observed OpenRouter cost $${spent.toFixed(4)}.\n`);
