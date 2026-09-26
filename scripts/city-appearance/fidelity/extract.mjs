/** Paid facade-photo analysis runner. Registration and materialization are
 * outside analysis identity so a cached response can be fitted again free.
 * Default operation is a read-only dry run.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';
import { globalBudget } from '../../da-costa-block/global-budget.mjs';
import { lockedJson } from '../../da-costa-block/pipeline-state.mjs';
import { verifyEvaluationArtifact } from './evaluation.ts';
import { EXTRACTION_VERSION, MAX_TOKENS, MODEL, PHASE_LIMITS, RESERVED_USD, analysisPrompt, normalizeProviderProposal, schema, sha256, validateProposal, validateRunManifest } from './extraction-contract.mjs';
import { phaseBudget } from './phase-budget.mjs';
import { runBoundedPaidWorkers } from './bounded-paid-workers.mjs';

const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const manifestPath = flag('manifest');
const concurrency = Number(flag('concurrency') ?? 1);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw Error('--concurrency must be an integer from 1 to 3');
const fetchModule=flag('fetch-module');
const providerFetch=fetchModule?(await import(pathToFileURL(path.resolve(fetchModule)).href)).default:globalThis.fetch;
if(typeof providerFetch!=='function')throw Error('Provider fetch implementation must be a function');
if (!manifestPath) throw Error('A frozen --manifest=<file> is required');
const absoluteManifestPath = path.resolve(manifestPath);
const manifest = JSON.parse(await fs.readFile(absoluteManifestPath, 'utf8'));
const previewBatch=manifest.phase==='neighbourhood-1000-preview';
const baseline = JSON.parse(await fs.readFile(new URL('./baseline.json', import.meta.url), 'utf8'));
const root = path.resolve(flag('cache-root') ?? '.cache/city-appearance/fidelity-extraction');
const reportPath = path.join(root, 'analysis-results.json');
const phaseLedgerPath = path.join(root, 'phase-budget.json');
const reportTransaction = change => lockedJson(reportPath, { version: 2, extractionVersion: EXTRACTION_VERSION, results: [] }, state => {
  if (state.version !== 2 || state.extractionVersion !== EXTRACTION_VERSION || !Array.isArray(state.results)) throw Error('Unsupported analysis result cache');
  if (new Set(state.results.map(value => value.key)).size !== state.results.length) throw Error('Duplicate cached analysis identity');
  return change(state);
});
const readReport = () => reportTransaction(state => structuredClone(state));

if (!Number.isFinite(baseline.inferenceBaselineUsd) || baseline.inferenceBaselineUsd < 0) throw Error('Missing reconciled baseline cost');
let batchAuthorization=null;
if(manifest.phase==='neighbourhood-1000-preview'){
  const authPath=path.resolve(path.dirname(absoluteManifestPath),manifest.batchAuthorization?.path??''),bytes=await fs.readFile(authPath);if(sha256(bytes)!==manifest.batchAuthorization?.sha256)throw Error('Changed batch authorization');
  batchAuthorization=JSON.parse(bytes);const expectedBaseline=1.8065436344999992;
  if(batchAuthorization?.version!==1||batchAuthorization.id!=='neighbourhood-1000-preview-2026-09-13'||batchAuthorization.requestedBuildings!==1000||batchAuthorization.maxAdditionalUsd!==10||batchAuthorization.baselineGlobalUsd!==expectedBaseline||batchAuthorization.cumulativeCeilingUsd!==expectedBaseline+10)throw Error('Invalid 1,000-building budget authorization');
}
const cumulativeCeiling = batchAuthorization?.cumulativeCeilingUsd??Math.min(baseline.cumulativeLimitUsd ?? 5, baseline.inferenceBaselineUsd + (baseline.additionalLimitUsd ?? 3));
const budget = globalBudget({ file: flag('budget-ledger'), ceiling: cumulativeCeiling, legacyLedgers: flag('budget-ledger') ? [] : undefined, authorization:batchAuthorization?{id:batchAuthorization.id,maxCeilingUsd:batchAuthorization.cumulativeCeilingUsd}:null });
const phases = phaseBudget({ file: phaseLedgerPath, limits: PHASE_LIMITS });

async function saveProviderResponse(key, providerResponse) {
  await reportTransaction(state => {
    const result = state.results.find(value => value.key === key);
    if (!result || !['reserved', 'requesting', 'response-saved'].includes(result.status)) throw Error('Analysis cache state changed while request was in flight');
    result.providerResponse = providerResponse;
    result.status = 'response-saved';
    result.responseSavedAt = new Date().toISOString();
  });
}

async function finishSavedResponse(result, source = result.source) {
  const saved = result.providerResponse;
  if (!saved) throw Error('Interrupted request has no saved response; charge is unresolved and it must not be resent');
  let proposal, error;
  try {
    if (!saved.ok) throw Error(`Inference HTTP ${saved.httpStatus}`);
    proposal = validateProposal(normalizeProviderProposal(JSON.parse(saved.content), source), source);
  } catch (caught) { error = String(caught); }
  await reportTransaction(state => {
    const current = state.results.find(value => value.key === result.key);
    current.generationId = saved.generationId;
    current.usage = saved.usage;
    current.proposal = proposal;
    current.error = error;
    current.status = error ? 'error' : 'complete';
    current.completedAt = new Date().toISOString();
  });
  const rejectedBeforeGeneration = saved.ok === false && saved.httpStatus === 400 && !saved.generationId && String(saved.providerError?.metadata?.raw ?? saved.providerError?.message ?? '').includes('INVALID_ARGUMENT');
  const actualUsd = saved.usage?.cost ?? (rejectedBeforeGeneration ? 0 : undefined);
  const settlement = await budget.settle(result.globalReservation, actualUsd, { generationId: saved.generationId });
  const phaseSettlement = Number.isFinite(actualUsd) ? await phases.settle(result.phaseReservation, actualUsd) : null;
  if (error || !Number.isFinite(actualUsd) || settlement.exceededCeiling || phaseSettlement?.exceededCeiling) throw Error('Extraction stopped after saving and settling the provider response; inspect the cached result or exceeded budget');
  return actualUsd;
}

const run = process.argv.includes('--run');
if (run) {
  // Recover provider responses and settlements before checking unresolved
  // reservations or current geometry. Analysis recovery depends only on the
  // cached pixels/dimensions saved before the request.
  for (const result of (await readReport()).results) {
    if (result.status === 'response-saved') {try{await finishSavedResponse(result);}catch(error){const saved=(await readReport()).results.find(value=>value.key===result.key);if(!(previewBatch&&saved?.status==='error'&&Number.isFinite(saved.usage?.cost)))throw error;console.log(JSON.stringify({key:result.key,recoveredSettledOmission:true,error:saved.error,costUsd:saved.usage.cost}));}}
    else if (['complete', 'error'].includes(result.status)) {
      const rejectedBeforeGeneration = result.providerResponse?.ok === false && result.providerResponse?.httpStatus === 400 && !result.providerResponse?.generationId && String(result.providerResponse?.providerError?.metadata?.raw ?? '').includes('INVALID_ARGUMENT');
      const actualUsd = result.usage?.cost ?? (rejectedBeforeGeneration ? 0 : undefined);
      if (!Number.isFinite(actualUsd)) continue;
      if (result.globalReservation) await budget.settle(result.globalReservation, actualUsd, { generationId: result.generationId });
      if (result.phaseReservation) {
        const settlement = await phases.settle(result.phaseReservation, actualUsd);
        if (settlement.exceededCeiling) throw Error(`Recovered ${result.phase} settlement exceeds its phase ceiling`);
      }
    }
  }
}

const validated = await validateRunManifest(manifest, absoluteManifestPath, baseline);
if (manifest.phase === 'expansion') {
  if (!manifest.evaluationArtifact || !manifest.candidateBinding) throw Error('Expansion requires a computed evaluation artifact and exact candidate binding');
  await verifyEvaluationArtifact(path.resolve(path.dirname(absoluteManifestPath), manifest.evaluationArtifact), manifest.candidateBinding);
}
const uniqueRequests = [...new Map(validated.requests.map(request => [request.key, request])).values()];
if (run && uniqueRequests.length > 0 && validated.activeSet.status !== 'validated') throw Error('Paid extraction requires a fully validated active development-set identity');
const globalSnapshot = await budget.snapshot();
const unresolved = globalSnapshot.entries.filter(entry => entry.status !== 'settled');
const observedUsd = globalSnapshot.entries.reduce((sum, entry) => sum + (Number.isFinite(entry.actualUsd) ? entry.actualUsd : entry.reservedUsd), 0);
const additionalSpentUsd = Math.max(0, observedUsd - baseline.inferenceBaselineUsd);
const report = await readReport();
const terminal=result=>result.status==='complete'||(previewBatch&&result.status==='error'&&Number.isFinite(result.usage?.cost));
const cached = uniqueRequests.filter(request => report.results.some(result => result.key === request.key && terminal(result))).length;
const payable = uniqueRequests.filter(request => !report.results.some(result => result.key === request.key && terminal(result))).length;
const requestedReservationUsd = payable * RESERVED_USD;
const phaseSnapshot = await phases.snapshot(), phaseObservedOrReservedUsd = phaseSnapshot.totals[validated.phase] ?? 0;
const reconciliation = { phase: validated.phase, activeSetId: validated.activeSet.id, sourceTiers: validated.requests.length, uniqueAnalyses: uniqueRequests.length, cached, payable, requestedReservationUsd, phaseObservedOrReservedUsd, registrationAbstentions: validated.abstentions.length, phaseLimitUsd: validated.phaseLimitUsd, additionalAuthorizedUsd: batchAuthorization?.maxAdditionalUsd??baseline.additionalLimitUsd??3, additionalSpentUsd:batchAuthorization?Math.max(0,observedUsd-batchAuthorization.baselineGlobalUsd):additionalSpentUsd, additionalAvailableUsd:batchAuthorization?Math.max(0,batchAuthorization.cumulativeCeilingUsd-observedUsd):Math.max(0,(baseline.additionalLimitUsd??3)-additionalSpentUsd), cumulativeCeilingUsd:cumulativeCeiling, cumulativeObservedOrReservedUsd:observedUsd, cumulativeAvailableUsd:Math.max(0,cumulativeCeiling-observedUsd), unresolvedCharges: unresolved.length, paidRequests: 0 };
if (!run) { console.log(JSON.stringify(reconciliation)); process.exit(0); }
if (unresolved.length) throw Error('Unresolved global charge; reconcile before inference');
if (phaseObservedOrReservedUsd + requestedReservationUsd > validated.phaseLimitUsd + 1e-12) throw Error('Complete payable batch cannot be reserved inside its phase ceiling');
if (observedUsd + requestedReservationUsd > cumulativeCeiling + 1e-12) throw Error('Complete payable batch cannot be reserved inside the cumulative ceiling');
dotenv.config({ path: '.cache/facade-rebuild/openrouter-private.env', quiet: true });
if (uniqueRequests.some(request => !report.results.some(result => result.key === request.key && result.status === 'complete')) && !process.env.OPENROUTER_API_KEY) throw Error('Missing inference credential');
await fs.mkdir(root, { recursive: true });

async function processRequest(request,_index,stopLaunching) {
  let current = (await readReport()).results.find(result => result.key === request.key);
  if (current?.status === 'complete') {
    const actualUsd = current.usage?.cost;
    if (current.globalReservation) await budget.settle(current.globalReservation, actualUsd, { generationId: current.generationId });
    if (current.phaseReservation) await phases.settle(current.phaseReservation, actualUsd);
    return;
  }
  if(previewBatch&&current?.status==='error'&&Number.isFinite(current.usage?.cost)){
    if(current.globalReservation)await budget.settle(current.globalReservation,current.usage.cost,{generationId:current.generationId});
    if(current.phaseReservation)await phases.settle(current.phaseReservation,current.usage.cost);
    console.log(JSON.stringify({key:request.key,cachedSettledOmission:true,error:current.error,costUsd:current.usage.cost,neverRetry:current.neverRetry===true}));return;
  }
  if (current) {
    if (current.status === 'response-saved') {
      const actualUsd = await finishSavedResponse(current, request.source);
      console.log(JSON.stringify({ key: request.key, recovered: true, costUsd: actualUsd }));
      return;
    }
    if (current.status === 'error' && current.providerResponse) {
      try{const actualUsd = await finishSavedResponse(current, request.source);console.log(JSON.stringify({ key: request.key, revalidated: true, costUsd: actualUsd }));}
      catch(error){const saved=(await readReport()).results.find(result=>result.key===request.key);if(!(previewBatch&&saved?.status==='error'&&Number.isFinite(saved.usage?.cost)))throw error;console.log(JSON.stringify({key:request.key,settledOmission:true,error:saved.error,costUsd:saved.usage.cost}));}
      return;
    }
    throw Error(`Analysis ${request.key} is ${current.status}; never resend a request whose charge is unresolved`);
  }

  const phaseReservation = await phases.reserve({ phase: validated.phase, key: request.key, reservedUsd: RESERVED_USD });
  let globalReservation;
  try {
    globalReservation = await budget.reserve({ key: request.key, sourceLedger: reportPath, reservedUsd: RESERVED_USD, metadata: { fidelityPhase: validated.phase, stage: EXTRACTION_VERSION, model: MODEL, sourceSha256: request.source.cropSha256 } });
  } catch (error) {
    await phases.void(phaseReservation);
    throw error;
  }
  await reportTransaction(state => { state.results.push({ key: request.key, status: 'reserved', phase: validated.phase, phaseReservation, globalReservation, source: { cropSha256: request.source.cropSha256, width: request.source.width, height: request.source.height }, reservedAt: new Date().toISOString() }); });
  await reportTransaction(state => { const result = state.results.find(value => value.key === request.key); result.status = 'requesting'; result.requestStartedAt = new Date().toISOString(); });
  let providerResponse;
  try {
    const response = await providerFetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(90_000), headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }, body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: MAX_TOKENS, reasoning: { enabled: false }, provider: { require_parameters: true, sort: 'price' }, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: `${analysisPrompt(request.source)}\nThe required JSON schema is: ${JSON.stringify(schema)}` }, { type: 'image_url', image_url: { url: `data:${request.mime};base64,${request.bytes.toString('base64')}` } }] }] }) });
    const body = await response.json();
    providerResponse = { ok: response.ok, httpStatus: response.status, generationId: body.id, usage: body.usage, content: body.choices?.[0]?.message?.content, providerError: body.error };
  } catch (error) {
    // An accepted request may already be charged. Automatic retry could pay twice.
    stopLaunching();
    await reportTransaction(state => { const result = state.results.find(value => value.key === request.key); result.transportError = String(error); result.status = 'charge-unresolved'; });
    throw Error('Provider response was not recoverably saved; reconcile the charge before any retry');
  }
  await saveProviderResponse(request.key, providerResponse);
  current = (await readReport()).results.find(result => result.key === request.key);
  try{const actualUsd = await finishSavedResponse(current, request.source);console.log(JSON.stringify({ observationId: request.observationId, tier: request.tier, key: request.key, costUsd: actualUsd }));}
  catch(error){const saved=(await readReport()).results.find(result=>result.key===request.key);if(!(previewBatch&&saved?.status==='error'&&Number.isFinite(saved.usage?.cost)))throw error;console.log(JSON.stringify({observationId:request.observationId,tier:request.tier,key:request.key,settledOmission:true,error:saved.error,costUsd:saved.usage.cost}));}
}
await runBoundedPaidWorkers(uniqueRequests,{concurrency,handle:processRequest});
