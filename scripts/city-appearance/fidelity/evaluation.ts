/** Release gates are recomputed from hash-checked evidence, never caller gate flags. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { openingAccuracy, type OpeningAssertion } from './gates.js';
export const digest = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
export const jsonDigest = (value: unknown) => digest(JSON.stringify(value));
export type EvidenceFile = { path: string; sha256: string };
export type CandidateBinding = { releaseId: string; compilerHash: string; recordsSha256: string; artifactsSha256: string };
type Case = { id: string; buildingId: string; district: string; role: 'development' | 'named' | 'held-out'; sources: Record<string, {path: string; cropSha256: string; captureDate: string}> };
type Reference = { caseId: string; tier: string; cropSha256: string; captureDate: string; disposition: 'agent-inspected' | 'human-reviewed'; inspectedBeforePrediction: string; openings: OpeningAssertion[]; assertions: {id: string; expected: unknown}[] };
type Prediction = { caseId: string; tier: string; cropSha256: string; captureDate: string; generatedAt: string; registration: {status: string; uncertaintyM: number}; openings: OpeningAssertion[]; assertions: {id: string; actual: unknown}[] };
export type EvaluationIndex = { version: 1; candidate: CandidateBinding; evidence: Record<'run'|'references'|'predictions'|'compiled'|'captures'|'contacts'|'runtime'|'ledger', EvidenceFile> };
const hashPattern = /^[a-f0-9]{64}$/;
const validHash = (value: unknown) => typeof value === 'string' && hashPattern.test(value);
async function readEvidence(root: string, ref: EvidenceFile) {
  if (!ref || !validHash(ref.sha256) || typeof ref.path !== 'string') throw Error('Missing hashed evidence');
  const bytes = await fs.readFile(path.resolve(root, ref.path));
  if (digest(bytes) !== ref.sha256) throw Error(`Stale/corrupt evidence: ${ref.path}`);
  return bytes;
}
const validOpening = (o: OpeningAssertion) => o && typeof o.id === 'string' && ['door','window'].includes(o.kind) && ['rectangular','segmental','rounded','unknown'].includes(o.head) && typeof o.visible === 'boolean' && Array.isArray(o.bounds) && o.bounds.length === 4 && o.bounds.every(Number.isFinite) && o.bounds[2] > o.bounds[0] && o.bounds[3] > o.bounds[1];
const key = (o: {caseId:string;tier:string}) => `${o.caseId}/${o.tier}`;
const unique = (values: string[]) => new Set(values).size === values.length;
export async function computeEvaluation(indexPath: string, expectedCandidate?: CandidateBinding) {
  const indexBytes = await fs.readFile(indexPath), index: EvaluationIndex = JSON.parse(indexBytes.toString()), root = path.dirname(indexPath);
  if (index.version !== 1 || !index.candidate || Object.values(index.candidate).length !== 4 || !Object.values(index.candidate).every(validHash)) throw Error('Invalid candidate binding');
  if (expectedCandidate && jsonDigest(index.candidate) !== jsonDigest(expectedCandidate)) throw Error('Evaluation belongs to a different candidate');
  const names = ['run','references','predictions','compiled','captures','contacts','runtime','ledger'] as const;
  const documents = await Promise.all(names.map(async name => [name, JSON.parse((await readEvidence(root,index.evidence[name])).toString())]));
  const {run,references,predictions,compiled,captures,contacts,runtime,ledger} = Object.fromEntries(documents);
  const failures: string[] = [], fail = (condition: unknown, message: string) => {if (!condition) failures.push(message);};
  fail(jsonDigest(compiled.candidate) === jsonDigest(index.candidate), 'compiled-candidate-binding');
  fail(Array.isArray(compiled.artifacts) && compiled.artifacts.length>0 && jsonDigest(compiled.artifacts) === index.candidate.artifactsSha256, 'compiled-artifact-inventory');
  fail(Array.isArray(compiled.compilerInputs) && compiled.compilerInputs.length>0 && jsonDigest(compiled.compilerInputs.map((ref:EvidenceFile)=>ref.sha256))===index.candidate.compilerHash, 'compiler-input-inventory');
  for(const ref of compiled.compilerInputs ?? []) await readEvidence(path.resolve(root,compiled.compilerRoot ?? compiled.root ?? '.'),ref);
  await readEvidence(path.resolve(root,compiled.root ?? '.'),compiled.manifest);
  for (const ref of compiled.artifacts ?? []) await readEvidence(path.resolve(root,compiled.root ?? '.'),ref);
  fail(run.version === 1 && validHash(run.activeDevelopmentSetId) && validHash(run.heldOutSetId) && typeof run.extractionVersion === 'string', 'run-manifest-identity');
  fail(run.compilerHash === index.candidate.compilerHash, 'frozen-compiler');
  fail(run.heldOutRetired !== true && !run.heldOutUsedForRepairs, 'held-out-contamination');
  const cases: Case[] = run.cases ?? [], dev = cases.filter(c=>c.role==='development'), named = cases.filter(c=>c.role==='named'), held = cases.filter(c=>c.role==='held-out');
  fail(unique(cases.map(c=>c.id)), 'duplicate-case');
  fail(run.activeDevelopmentSetId===jsonDigest(dev) && run.heldOutSetId===jsonDigest(held), 'set-content-identity');
  fail(dev.length === 12, 'development-set-incomplete');
  fail(['Fuoco Vivo','Engels Verf'].every(name=>run.namedCases?.[name]?.length && run.namedCases[name].every((id:string)=>named.some(c=>c.id===id))), 'named-shops-incomplete');
  const excluded = new Set([...dev,...named].map(c=>c.buildingId).concat(run.earlierFixtureBuildingIds ?? []));
  const districts = [...new Set(held.map(c=>c.district))];
  fail(held.length === 30 && unique(held.map(c=>c.buildingId)) && held.every(c=>!excluded.has(c.buildingId)) && districts.length === 2 && districts.every(d=>held.filter(c=>c.district===d).length===15), 'held-out-exclusions-or-counts');
  const refs: Reference[] = references.entries ?? [], preds: Prediction[] = predictions.entries ?? [];
  fail(references.disposition === 'independent-source-annotations' && unique(refs.map(key)), 'independent-reference-identity');
  fail(predictions.compilerHash === index.candidate.compilerHash && predictions.recordsSha256 === index.candidate.recordsSha256 && predictions.extractionVersion === run.extractionVersion && unique(preds.map(key)), 'prediction-binding');
  fail(preds.every(p=>cases.some(c=>c.id===p.caseId && c.sources[p.tier])), 'unexpected-predictions');
  let registrationFailures = 0, abstentions = 0;
  const byCase: any[] = [];
  for (const c of cases) {
    const reference: OpeningAssertion[] = [], predicted: OpeningAssertion[] = [];
    fail(Object.keys(c.sources ?? {}).length > 0, `missing-source:${c.id}`);
    for (const [tier,source] of Object.entries(c.sources ?? {})) {
      await readEvidence(path.resolve(root,run.sourceRoot ?? '.'),{path:source.path,sha256:source.cropSha256});
      fail(['full','ground'].includes(tier) && Number.isFinite(Date.parse(source.captureDate)), `invalid-source-tier-or-date:${c.id}/${tier}`);
      const ref = refs.find(r=>r.caseId===c.id && r.tier===tier), pred = preds.find(p=>p.caseId===c.id && p.tier===tier);
      fail(ref && ref.cropSha256===source.cropSha256 && ref.captureDate===source.captureDate && ['agent-inspected','human-reviewed'].includes(ref.disposition), `missing-or-stale-reference:${c.id}/${tier}`);
      if (!ref) continue;
      fail(Array.isArray(ref.openings) && ref.openings.every(validOpening) && unique(ref.openings.map(o=>o.id)), `invalid-reference-openings:${c.id}/${tier}`);
      if (!Array.isArray(ref.openings) || !ref.openings.every(validOpening)) continue;
      // Match per crop. This keeps neighbours and dates from cross-matching.
      const good = pred && pred.cropSha256===source.cropSha256 && pred.captureDate===source.captureDate && Array.isArray(pred.openings) && pred.openings.every(validOpening);
      fail(!pred || good, `invalid-or-stale-prediction:${c.id}/${tier}`);
      fail(!pred || (Number.isFinite(Date.parse(ref.inspectedBeforePrediction)) && Date.parse(ref.inspectedBeforePrediction)<Date.parse(pred.generatedAt)), `reference-leakage:${c.id}/${tier}`);
      const registered = good && pred.registration?.status==='registered' && Number.isFinite(pred.registration.uncertaintyM) && pred.registration.uncertaintyM>=0 && pred.registration.uncertaintyM<=.15;
      if (!registered) { registrationFailures++; abstentions++; }
      const visible = ref.openings.filter(o=>o.visible), output = registered ? pred.openings : [];
      const accuracy = openingAccuracy(visible,output);
      byCase.push({caseId:c.id,tier,district:c.district,role:c.role,accuracy,door:openingAccuracy(visible.filter(o=>o.kind==='door'),output.filter(o=>o.kind==='door')),window:openingAccuracy(visible.filter(o=>o.kind==='window'),output.filter(o=>o.kind==='window'))});
      reference.push(...visible); predicted.push(...output);
      fail(['awnings','materials','physicalSigns'].every(id=>ref.assertions?.some(a=>a.id===id)), `missing-architectural-reference:${c.id}/${tier}`);
      if (c.role!=='held-out') {
        fail(accuracy.fn===0 && accuracy.fp===0 && visible.length>0, `development-openings:${c.id}/${tier}`);
        fail(ref.assertions?.length>0 && ref.assertions.every(a=>pred?.assertions?.some(p=>p.id===a.id && jsonDigest(p.actual)===jsonDigest(a.expected))), `architecture:${c.id}/${tier}`);
      }
      if (c.role==='held-out') fail(ref.assertions?.every(a=>pred?.assertions?.some(p=>p.id===a.id && jsonDigest(p.actual)===jsonDigest(a.expected))), `held-out-architecture:${c.id}/${tier}`);
    }
    if (c.role==='held-out') {
      const stratum = references.primaryStrata?.[c.id];
      fail(typeof stratum==='string' && stratum.length>0, `missing-source-strata:${c.id}`);
    }
  }
  const quotas: Record<string,number> = {'residential-entrances':3,'curved-openings':2,'shop-assemblies':3,'extended-awning':1,'retracted-awning':1,'contrasting-finishes-or-accents':2,'obscured-or-unknown':3};
  for (const d of districts) for (const [stratum,min] of Object.entries(quotas)) fail(held.filter(c=>c.district===d && references.primaryStrata?.[c.id]===stratum).length>=min, `held-out-quota:${d}/${stratum}`);
  const aggregate = (rows:any[], field:string) => {
    const totals = rows.reduce((t,r)=>({tp:t.tp+r[field].tp,fp:t.fp+r[field].fp,fn:t.fn+r[field].fn}),{tp:0,fp:0,fn:0});
    return {...totals,precision:totals.tp+totals.fp ? totals.tp/(totals.tp+totals.fp):null,recall:totals.tp+totals.fn ? totals.tp/(totals.tp+totals.fn):null};
  };
  const heldRows=byCase.filter(r=>r.role==='held-out'), accuracy=Object.fromEntries(['accuracy','door','window'].map(field=>[field,aggregate(heldRows,field)]));
  for(const [kind,score] of Object.entries(accuracy)) fail(score.precision!==null && score.precision>=.9 && score.recall!==null && score.recall>=.9, `held-out-accuracy:${kind}`);
  const districtAccuracy=Object.fromEntries(districts.map(d=>[d,Object.fromEntries(['accuracy','door','window'].map(field=>[field,aggregate(heldRows.filter(r=>r.district===d),field)]))]));
  const targets = [...dev,...named];
  for (const c of targets) {
    const contact=contacts.entries?.filter((m:any)=>m.caseId===c.id && m.kind==='pavement-base') ?? [];
    fail(contact.length>0, `missing-contact:${c.id}`);
    for(const m of contact) {
      const src=m.tier==='ground' && c.sources.ground?.cropSha256===m.cropSha256 && c.sources.ground?.captureDate===m.captureDate;
      fail(src && Number.isFinite(m.gapM) && m.gapM>=0 && Number.isFinite(m.uncertaintyM) && m.uncertaintyM>=0 && (m.gapM+m.uncertaintyM<=.05 || (m.exception?.reason && m.exception?.evidence?.sha256===m.cropSha256 && m.exception?.captureDate===m.captureDate)), `ground-contact:${c.id}`);
      if(m.exception?.evidence) await readEvidence(root,m.exception.evidence);
    }
    for (const viewer of ['appearance','game']) for (const view of viewer==='appearance'?['tight-ground-floor','full-facade']:['oblique-game']) {
      const capture=captures.entries?.find((v:any)=>v.caseId===c.id && v.viewer===viewer && v.view===view);
      fail(capture && capture.releaseId===index.candidate.releaseId && capture.inspection?.disposition==='agent-inspected' && capture.inspection?.findings?.length>0 && capture.targetHighlighted===true && capture.unrelatedLabels===0 && capture.inspectorVisible===false && capture.inspection.referenceSha256===index.evidence.references.sha256 && capture.inspection.predictionsSha256===index.evidence.predictions.sha256 && capture.inspection.mismatches?.length===0, `visual:${c.id}/${viewer}/${view}`);
      if(capture) {await readEvidence(root,capture.image); await readEvidence(root,capture.sourceImage); fail(Object.values(c.sources).some(s=>s.cropSha256===capture.sourceImage.sha256),`capture-source:${c.id}`);}
    }
  }
  const checks=runtime.checkpoints ?? [];
  fail(runtime.releaseId===index.candidate.releaseId && runtime.artifactsSha256===index.candidate.artifactsSha256 && runtime.compilerHash===index.candidate.compilerHash, 'runtime-candidate-binding');
  fail(checks.length===28 && unique(checks.map((c:any)=>`${c.cameraId}/${c.layout}`)) && ['desktop','phone'].every(layout=>checks.filter((c:any)=>c.layout===layout).length===14) && unique(run.runtimeCameraIds ?? []) && run.runtimeCameraIds?.length===14 && checks.every((c:any)=>run.runtimeCameraIds.includes(c.cameraId)), 'runtime-camera-coverage');
  for (const c of checks) {
    fail(Number.isFinite(c.geometryBytes) && c.geometryBytes>=0 && Number.isFinite(c.textureBytes) && c.textureBytes>=0 && c.geometryBytes+c.textureBytes<=11_000_000 && c.cameraBlocked===false && c.sightlineBlocked===false && c.ready===true, `runtime:${c.cameraId}/${c.layout}`);
    await readEvidence(root,c.capture);
  }
  fail(runtime.disposal?.residentAfter===0 && runtime.disposal?.rehydratedBytes>0 && runtime.disposal?.rehydratedBytes<=11_000_000 && validHash(runtime.compileFirstSha256) && runtime.compileFirstSha256===runtime.compileRepeatSha256, 'runtime-disposal-determinism');
  const entries=ledger.entries ?? [];
  fail(entries.length>0 && unique(entries.map((e:any)=>e.id ?? e.key)) && entries.every((e:any)=>e.status==='settled' && Number.isFinite(e.actualUsd) && e.actualUsd>=0), 'unresolved-cost-ledger');
  const total=entries.reduce((s:number,e:any)=>s+(Number.isFinite(e.actualUsd)?e.actualUsd:0),0);
  fail(Number.isFinite(ledger.baselineUsd) && total<=5 && total-ledger.baselineUsd<=3, 'cost-ceiling');
  for(const [phase,limit] of Object.entries({development:1,unseen:.5,expansion:1.5})) fail(entries.filter((e:any)=>e.fidelityPhase===phase).reduce((s:number,e:any)=>s+e.actualUsd,0)<=limit,`phase-cost:${phase}`);
  return {version:1,candidate:index.candidate,indexSha256:digest(indexBytes),evidenceHashes:Object.fromEntries(names.map(n=>[n,index.evidence[n].sha256])),pass:failures.length===0,failures:[...new Set(failures)],accuracy,districtAccuracy,byCase,registrationFailures,abstentions,cumulativeUsd:total,originalTwelveExamples:'outstanding; replacement cases do not reproduce supplied examples'};
}
export async function verifyEvaluationArtifact(indexPath:string,candidate:CandidateBinding) {
  const result=await computeEvaluation(indexPath,candidate);
  if(!result.pass) throw Error(`Facade fidelity gates failed: ${result.failures.join(', ')}`);
  return result;
}
