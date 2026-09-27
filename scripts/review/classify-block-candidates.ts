/** Bounded, ID-only visual adjudication. No geometry coordinates or publication. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import {globalBudget} from '../da-costa-block/global-budget.mjs';

const ROOT = path.resolve('.cache/facade-assessment/block-assemblies-v1');
const MODEL = 'z-ai/glm-5.3-flash';
const RESERVE_USD = 0.2;
const MAX_CALLS = 2;
const OLD_UNKNOWN = 'request:068099f48543ee8fad1e83e3db344e72d3c28aeec9c35cb0f3e2410e38121068';
const ROLES = new Set(['door', 'shopfront', 'window', 'awning', 'balcony', 'railing', 'wall', 'roof', 'occluder', 'other', 'unknown']);
const VISIBILITIES = new Set(['visible', 'partly-visible', 'not-visible', 'unknown']);
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export interface Classification {
  id: string;
  role: string;
  visibility: string;
  confidence: number;
  evidence: string;
  reason: string;
}

export function candidateIds(data: unknown): string[] {
  if (!data || typeof data !== 'object') throw Error('Invalid candidate file');
  const list = (data as {candidates?: unknown; features?: unknown}).candidates ?? (data as {features?: unknown}).features;
  if (!Array.isArray(list) || list.length < 1 || list.length > 100) throw Error('Expected 1–100 candidates or features');
  const ids = list.map(item => item?.id);
  if (ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(id)) || new Set(ids).size !== ids.length)
    throw Error('Missing, invalid, or duplicate candidate ID');
  return ids;
}

export function validateClassification(output: unknown, expectedIds: readonly string[]): Classification[] {
  if (!output || typeof output !== 'object' || Array.isArray(output) ||
      !Array.isArray((output as {classifications?: unknown}).classifications)) throw Error('Expected classifications array');
  const rows = (output as {classifications: unknown[]}).classifications;
  if (rows.length !== expectedIds.length) throw Error('Incomplete or extra classification rows');
  const expected = new Set(expectedIds), seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error('Invalid classification row');
    const value = row as Record<string, unknown>;
    if (Object.keys(value).sort().join(',') !== 'confidence,evidence,id,reason,role,visibility') throw Error('Unexpected row fields; coordinates are forbidden');
    if (typeof value.id !== 'string' || !expected.has(value.id) || seen.has(value.id)) throw Error('Unknown or duplicate classification ID');
    seen.add(value.id);
    if (!ROLES.has(value.role) || !VISIBILITIES.has(value.visibility) || typeof value.confidence !== 'number' ||
        !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1 ||
        typeof value.evidence !== 'string' || value.evidence.length > 240 ||
        typeof value.reason !== 'string' || value.reason.length > 240) throw Error(`Invalid fields for ${value.id}`);
    if (value.visibility === 'not-visible' && value.role !== 'unknown') throw Error('Not-visible candidate cannot receive an observed role');
  }
  return rows as Classification[];
}

export function abstentions(ids: readonly string[], reason: string): Classification[] {
  return ids.map(id => ({id, role: 'unknown', visibility: 'unknown', confidence: 0, evidence: '', reason}));
}

const prompt = `Classify ONLY the printed candidate IDs in the supplied overlay against both images. Image 1 is the original street photograph; image 2 is an aligned candidate-ID overlay on a generated architectural drawing. The drawing may invent or shift details. The original photograph is stronger evidence, but perspective/occlusion may leave a candidate unknown. Never create coordinates, boxes, polygons, new IDs, missing IDs, or 3D dimensions. Do not infer hidden openings as observed. For each ID exactly once, choose role from door|shopfront|window|awning|balcony|railing|wall|roof|occluder|other|unknown and visibility from visible|partly-visible|not-visible|unknown. Confidence is a cautious 0..1 judgment, not calibrated. Evidence is a brief concrete visual cue; reason explains uncertainty or a false positive. If unsure, use unknown. Return only JSON: {"classifications":[{"id":"...","role":"...","visibility":"...","confidence":0.0,"evidence":"...","reason":"..."}]}. Candidate IDs: `;

async function save(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const temp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temp, file);
}

function arg(name: string): string {
  const value = process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw Error(`Missing --${name}=...`);
  return value;
}

async function modelCatalog(): Promise<{modelSha256: string; pricing: unknown}> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(`Model catalog HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const models = JSON.parse(bytes.toString()).data;
  const model = models?.find((entry: {id?: string}) => entry.id === MODEL);
  if (!model?.architecture?.input_modalities?.includes('image') || !model.architecture?.output_modalities?.includes('text'))
    throw Error('Selected GLM endpoint no longer supports image-to-text');
  const promptCost = Number(model.pricing?.prompt), completionCost = Number(model.pricing?.completion);
  if (!Number.isFinite(promptCost) || !Number.isFinite(completionCost) || promptCost > 0.0000005 || completionCost > 0.000002)
    throw Error('Selected GLM pricing exceeds pinned cheap-model cap');
  return {modelSha256: sha(JSON.stringify(model)), pricing: model.pricing};
}

async function main(): Promise<void> {
  const candidatesPath = path.resolve(arg('candidates'));
  const overlayPath = path.resolve(arg('overlay'));
  const sourcePath = path.resolve(arg('source'));
  const out = path.resolve(arg('out'));
  const caseId = path.basename(out, '.json');
  if (out !== path.join(ROOT, 'classification', `${caseId}.json`) || !['strip1', 'awning'].includes(caseId))
    throw Error('Output must be block-assemblies-v1/classification/strip1.json or awning.json');
  const [candidateBytes, overlayBytes, sourceBytes, authBytes] = await Promise.all([
    fs.readFile(candidatesPath), fs.readFile(overlayPath), fs.readFile(sourcePath), fs.readFile(ROOT + '/authorization.json'),
  ]);
  if (candidateBytes.length > 10_000_000 || overlayBytes.length > 20_000_000 || sourceBytes.length > 20_000_000)
    throw Error('Input exceeds bounded request size');
  if (overlayBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || sourceBytes.subarray(0, 3).toString('hex') !== 'ffd8ff')
    throw Error('Expected overlay PNG and source JPEG');
  const ids = candidateIds(JSON.parse(candidateBytes.toString()));
  const authorization = JSON.parse(authBytes.toString());
  if (authorization.scopedContinuation?.id !== 'whole-block-assemblies-v1' || authorization.scopedContinuation?.maxNewReservationsUsd !== 2 ||
      !authorization.scopedContinuation?.acknowledgedUnknownIds?.includes(OLD_UNKNOWN)) throw Error('Authorization scope changed');
  const text = prompt + JSON.stringify(ids);
  const inputs = {candidates: {path: candidatesPath, sha256: sha(candidateBytes)}, overlay: {path: overlayPath, sha256: sha(overlayBytes)},
    source: {path: sourcePath, sha256: sha(sourceBytes)}};
  const key = sha(JSON.stringify({version: 1, model: MODEL, caseId, inputs, prompt: text, maxTokens: 2048, reasoning: 'low'}));
  const responsePath = out.replace(/\.json$/, '.response.json');
  let old: any;
  try {old = JSON.parse(await fs.readFile(out, 'utf8'));}
  catch (error: any) {if (error.code !== 'ENOENT') throw error;}
  if (old) {
    if (old.key !== key) throw Error('Cached receipt inputs or prompt changed; choose a new authorized experiment');
    if (!['ok', 'abstained'].includes(old.status) || !old.settlement || !old.responseSha256)
      throw Error('Unresolved receipt; reconcile before new request');
    if (sha(await fs.readFile(responsePath)) !== old.responseSha256) throw Error('Cached response hash mismatch');
    validateClassification({classifications: old.classifications}, ids);
    console.log(JSON.stringify({status: 'reuse', caseId, out, key, classifications: old.classifications.length}));
    return;
  }
  if (!process.argv.includes('--run')) {
    console.log(JSON.stringify({status: 'dry-run', caseId, out, model: MODEL, candidateCount: ids.length, key, inputHashes: inputs,
      reservationUsd: RESERVE_USD, maximumCalls: MAX_CALLS}));
    return;
  }
  dotenv.config({path: '.cache/facade-rebuild/openrouter-private.env', quiet: true});
  if (!process.env.OPENROUTER_API_KEY) throw Error('Missing OpenRouter credential');
  const catalog = await modelCatalog();
  const budget = globalBudget({ceiling: authorization.maxCeilingUsd, authorization, acknowledgedUnknownIds: [OLD_UNKNOWN]});
  const snapshot = await budget.snapshot();
  const previous = snapshot.entries.filter((entry: {experiment?: string}) => entry.experiment === 'block-id-classification-v1');
  if (previous.length >= MAX_CALLS || previous.some((entry: {caseId?: string}) => entry.caseId === caseId))
    throw Error('Classification call cap or case reservation already used');
  const lock = out + '.lock';
  await fs.mkdir(path.dirname(out), {recursive: true});
  await fs.mkdir(lock); // Preserve a crash lock until its reservation is reconciled.
  let reservation: string | undefined;
  const receipt: any = {version: 1, kind: 'block-candidate-id-classification', status: 'requesting', key, caseId, model: MODEL,
    catalog, inputs, candidateIds: ids, promptSha256: sha(text), reservationUsd: RESERVE_USD, startedAt: new Date().toISOString()};
  try {
    reservation = await budget.reserve({key, sourceLedger: out, reservedUsd: RESERVE_USD,
      metadata: {experiment: 'block-id-classification-v1', model: MODEL, caseId}});
    receipt.reservation = reservation;
    await save(out, receipt);
    const body = JSON.stringify({model: MODEL, temperature: 0, max_tokens: 2048, reasoning: {effort: 'low'},
      provider: {sort: 'price', max_price: {prompt: 0.5, completion: 2, image: 0.01, request: 0}},
      response_format: {type: 'json_object'}, messages: [{role: 'user', content: [
        {type: 'text', text},
        {type: 'image_url', image_url: {url: `data:image/jpeg;base64,${sourceBytes.toString('base64')}`}},
        {type: 'image_url', image_url: {url: `data:image/png;base64,${overlayBytes.toString('base64')}`}},
      ]}]});
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {method: 'POST',
      headers: {'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)), authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`},
      signal: AbortSignal.timeout(180000), body});
    const responseBytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(responsePath, responseBytes);
    receipt.responseSha256 = sha(responseBytes);
    receipt.httpStatus = response.status;
    let raw: any;
    try {raw = JSON.parse(responseBytes.toString());} catch {raw = null;}
    receipt.generationId = raw?.id;
    receipt.usage = raw?.usage;
    await save(out, receipt);
    let cost = raw?.usage?.cost;
    if (!Number.isFinite(cost) && raw?.id) {
      try {
        const lookup = await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(raw.id)}`,
          {headers: {authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`}, signal: AbortSignal.timeout(20000)});
        const info = await lookup.json();
        receipt.generationLookup = info;
        cost = info?.data?.total_cost;
      } catch (error) {receipt.generationLookupError = String(error);}
    }
    receipt.settlement = await budget.settle(reservation, Number.isFinite(cost) ? cost : undefined, {generationId: raw?.id});
    receipt.actualCostUsd = Number.isFinite(cost) ? cost : undefined;
    await save(out, receipt);
    if (!Number.isFinite(cost) || cost > RESERVE_USD || receipt.settlement.exceededCeiling || receipt.settlement.exceededContinuation)
      throw Error('Charge unresolved or exceeds bound');
    if (!response.ok || raw?.error) throw Error(`Provider HTTP ${response.status}`);
    const content = raw?.choices?.[0]?.message?.content;
    if (raw?.choices?.[0]?.finish_reason === 'length' || typeof content !== 'string') throw Error('Missing or truncated classification');
    try {
      receipt.classifications = validateClassification(JSON.parse(content), ids);
      receipt.status = 'ok';
    } catch (error) {
      receipt.status = 'abstained';
      receipt.error = `Invalid model output: ${String(error)}`;
      receipt.classifications = abstentions(ids, 'invalid-model-output');
    }
  } catch (error) {
    receipt.status = 'abstained';
    receipt.error = String(error);
    receipt.classifications = abstentions(ids, 'request-or-charge-failed');
    if (reservation && !receipt.settlement) receipt.settlement = await budget.settle(reservation, undefined, {generationId: receipt.generationId});
  }
  await save(out, receipt);
  // Keep the lock for unknown charges; a known, saved settlement permits read-only resume.
  if (receipt.settlement && Number.isFinite(receipt.actualCostUsd)) await fs.rmdir(lock);
  console.log(JSON.stringify({caseId, status: receipt.status, count: receipt.classifications.length,
    cost: receipt.actualCostUsd ?? null, error: receipt.error ?? null, out}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error(String(error)); process.exitCode = 1;});
}
