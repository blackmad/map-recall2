import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { activeSetHash, analysisKey, normalizeProviderProposal, sha256, validateProposal, validateRunManifest } from './extraction-contract.mjs';
import { materializeFacadeDescriptions } from './materialize.mjs';
import { phaseBudget } from './phase-budget.mjs';

const hash = character => character.repeat(64);
const registration = () => ({ status: 'registered', surfaceIndex: 4, uncertaintyM: 0.1, imageToWall: [1, 0, 0, 0, 1, 0, 0, 0, 1], wallDirection: [1, 0], sourceDatum: 'NAP', canonicalDatum: 'surface-base', pixelConvention: 'pixel-edge', cropMarginsPx: { left: 0, top: 0, right: 0, bottom: 0 }, alignment: { wallIdentity: 'verified', boundaryEvidence: true, rooflineEvidence: true, cameraHeightResolved: true, orientationVerified: true } });
const source = extra => ({ path: 'crop.jpg', cropSha256: hash('a'), captureDate: '2025-01-02T00:00:00Z', width: 100, height: 80, registration: registration(), ...extra });
const item = sourceValue => ({ id: 'observation-1', observationId: 'observation-1', buildingId: 'building-1', geometryRevision: 'geometry-1', evidenceKey: hash('b'), frontage: [[0, 0], [4, 0]], surfaceIndices: [4], sources: { ground: sourceValue } });
const manifest = sourceValue => {
  const value = { version: 2, releaseId: 'release-1', phase: 'development', activeDevelopmentSet: { id: 'replacement-1', sha256: '', status: 'validated', kind: 'replacement-development', originalTwelveOutstanding: true }, cases: [item(sourceValue)] };
  value.activeDevelopmentSet.sha256 = activeSetHash(value);
  return value;
};
const baseline = { releaseId: 'release-1' };
const execFileAsync = promisify(execFile);
const readJson = file => fs.readFile(file, 'utf8').then(JSON.parse);

test('analysis cache identity ignores output path, registration and observation binding', () => {
  const first = source();
  const second = source({ path: 'moved/crop.jpg', registration: { ...registration(), imageToWall: [2, 0, 1, 0, 2, 3, 0, 0, 1] } });
  assert.equal(analysisKey(first), analysisKey(second));
});

test('proposal validation rejects invalid enums, fractions and bounds', () => {
  const valid = { openingsComplete: true, features: [{ id: 'door-1', kind: 'door', bounds: [0, 0, 20, 40], head: 'rounded', transom: 0.2, mullions: [0.25, 0.75] }] };
  assert.equal(validateProposal(valid, { width: 100, height: 80 }), valid);
  assert.throws(() => validateProposal({ ...valid, features: [{ ...valid.features[0], kind: 'guess' }] }, { width: 100, height: 80 }), /kind/);
  assert.throws(() => validateProposal({ ...valid, features: [{ ...valid.features[0], transom: 1 }] }, { width: 100, height: 80 }), /transom/);
  assert.throws(() => validateProposal({ ...valid, features: [{ ...valid.features[0], mullions: [0.7, 0.2] }] }, { width: 100, height: 80 }), /mullion/);
  assert.throws(() => validateProposal({ ...valid, features: [{ ...valid.features[0], bounds: [0, 0, 101, 40] }] }, { width: 100, height: 80 }), /Out-of-image/);
});

test('permille bounds normalize deterministically and curve semantics stay distinct', () => {
  const proposal = normalizeProviderProposal({ coordinateSpace: 'permille', openingsComplete: true, features: [
    { id: 'glass-arch', kind: 'window', bounds: [100, 200, 600, 800], head: 'segmental', archRise: 0.12 },
    { id: 'curved-lintel', kind: 'door', bounds: [650, 200, 900, 800], head: 'rectangular', lintelHead: 'rounded', lintelRise: 0.08, topCornerRadius: 0.05 },
  ] }, { width: 200, height: 100 });
  assert.deepEqual(proposal.features[0].bounds, [20, 20, 120, 80]);
  assert.equal(validateProposal(proposal, { width: 200, height: 100 }), proposal);
  assert.throws(() => normalizeProviderProposal({ coordinateSpace: 'permille', openingsComplete: true, features: [{ id: 'mixed', kind: 'window', bounds: [0.1, 200, 600, 800] }] }, { width: 200, height: 100 }), /permille/);
  assert.throws(() => validateProposal({ openingsComplete: true, features: [{ id: 'bad-corner', kind: 'window', bounds: [0, 0, 20, 20], head: 'segmental', topCornerRadius: 0.1 }] }, { width: 100, height: 100 }), /corner/);
  const partial = normalizeProviderProposal({ coordinateSpace: 'permille', openingsComplete: true, features: [{ id: 'door', kind: 'door', bounds: [0, 0, 500, 1000] }, { id: 'unlocated-material', kind: 'material', material: 'brick' }] }, { width: 200, height: 100 });
  assert.deepEqual(partial.rejectedFeatures, [{ id: 'unlocated-material', kind: 'material', reason: 'missing-valid-bounds' }]);
  assert.deepEqual(partial.features.map(feature => feature.id), ['door']);
});

test('manifest validation checks bytes, dimensions, active set and registration orientation', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-extraction-contract-'));
  const bytes = Buffer.from('fixture-image');
  await fs.writeFile(path.join(directory, 'crop.jpg'), bytes);
  const goodSource = source({ cropSha256: sha256(bytes) });
  const file = path.join(directory, 'manifest.json');
  const valid = await validateRunManifest(manifest(goodSource), file, baseline, { imageMetadata: async () => ({ width: 100, height: 80, format: 'jpeg' }) });
  assert.equal(valid.requests.length, 1);
  assert.equal(valid.abstentions.length, 0);
  await assert.rejects(validateRunManifest(manifest({ ...goodSource, cropSha256: hash('d') }), file, baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) }), /Changed source crop/);
  await assert.rejects(validateRunManifest(manifest({ ...goodSource, width: 101 }), file, baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) }), /dimensions/);
  await assert.rejects(validateRunManifest(manifest({ ...goodSource, registration: { ...registration(), alignment: { ...registration().alignment, orientationVerified: false } } }), file, baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) }), /alignment/);
  const mirrored = manifest({ ...goodSource, registration: { ...registration(), imageToWall: [-1, 0, 100, 0, 1, 0, 0, 0, 1] } });
  await assert.rejects(validateRunManifest(mirrored, file, baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) }), /Mirrored image-to-wall/);
  await assert.rejects(validateRunManifest({ ...manifest(goodSource), activeDevelopmentSet: { ...manifest(goodSource).activeDevelopmentSet, status: 'draft' } }, file, baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) }), /active-set/);
  const staleIdentity = manifest(goodSource); staleIdentity.cases[0].buildingId = 'changed-building';
  await assert.rejects(validateRunManifest(staleIdentity, file, baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) }), /Active-set hash/);
});

test('non-registered tier is an explicit abstention and missing sibling tier stays omitted', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-extraction-abstention-'));
  const bytes = Buffer.from('fixture-image');
  await fs.writeFile(path.join(directory, 'crop.jpg'), bytes);
  const failed = source({ cropSha256: sha256(bytes), registration: { status: 'failed' }, registrationAbstention: 'camera height unresolved' });
  const valid = await validateRunManifest(manifest(failed), path.join(directory, 'manifest.json'), baseline, { imageMetadata: async () => ({ width: 100, height: 80 }) });
  assert.equal(valid.requests.length, 0);
  assert.deepEqual(valid.abstentions.map(value => value.tier), ['ground']);
});

test('phase check and reservation are atomic under concurrency', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-phase-budget-'));
  const budget = phaseBudget({ file: path.join(directory, 'phase.json'), limits: { development: 0.04 } });
  const outcomes = await Promise.allSettled([
    budget.reserve({ phase: 'development', key: 'one', reservedUsd: 0.04 }),
    budget.reserve({ phase: 'development', key: 'two', reservedUsd: 0.04 }),
  ]);
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(value => value.status === 'rejected').length, 1);
  assert.match(outcomes.find(value => value.status === 'rejected').reason.message, /Phase budget exhausted/);
});

test('materialization preserves human/revoked features and refuses mixed dates', () => {
  const sourceValue = source();
  const run = manifest(sourceValue);
  const analysis = { key: analysisKey(sourceValue), status: 'complete', proposal: { openingsComplete: true, features: [{ id: 'door', kind: 'door', bounds: [10, 10, 30, 70] }, { id: 'window', kind: 'window', bounds: [40, 10, 70, 60] }] } };
  const record = { id: 'observation-1', buildingId: 'building-1', geometryRevision: 'geometry-1', evidenceKey: hash('b'), localStart: [0, 0], localEnd: [4, 0], images: { ground: { sha256: hash('a'), date: sourceValue.captureDate, width: 100, height: 80 } }, featureRevocations: { 'ground:window': true }, facadeDescription: { version: 1, extractionVersion: 'old', buildingId: 'building-1', geometryRevision: 'geometry-1', evidenceKey: hash('b'), frontage: [[0, 0], [4, 0]], surfaceIndices: [4], sources: { ground: { cropSha256: hash('a'), captureDate: sourceValue.captureDate, registration: registration(), features: [{ id: 'ground:door', kind: 'door', bounds: [8, 8, 31, 72], disposition: 'human-reviewed' }, { id: 'ground:removed', kind: 'window', bounds: [70, 10, 90, 60], disposition: 'revoked' }] } } } };
  const materialized = materializeFacadeDescriptions({ manifest: run, analyses: [analysis], records: [record] });
  const features = materialized.records[0].facadeDescription.sources.ground.features;
  assert.deepEqual(features.find(value => value.id === 'ground:door').bounds, [8, 8, 31, 72]);
  assert.equal(features.find(value => value.id === 'ground:removed').disposition, 'revoked');
  assert.equal(features.find(value => value.id === 'ground:window').disposition, 'machine-observed-unreviewed');
  assert.deepEqual(materialized.records[0].facadeDescription.sources.ground.imageDimensions, { width: 100, height: 80 });

  const mixed = structuredClone(record);
  mixed.images.ground.date = '2026-01-01T00:00:00Z';
  const refused = materializeFacadeDescriptions({ manifest: run, analyses: [analysis], records: [mixed] });
  assert.equal(refused.records[0].facadeDescription.extractionVersion, 'old');
  assert.match(refused.report.omitted[0].reason, /date-hash/);
});

test('materialization respects whole-observation revocation', () => {
  const sourceValue = source();
  const record = { id: 'observation-1', buildingId: 'building-1', geometryRevision: 'geometry-1', evidenceKey: hash('b'), localStart: [0, 0], localEnd: [4, 0], images: { ground: { sha256: hash('a'), date: sourceValue.captureDate } }, machineRevocation: { revoked: true } };
  const result = materializeFacadeDescriptions({ manifest: manifest(sourceValue), analyses: [{ key: analysisKey(sourceValue), status: 'complete', proposal: { openingsComplete: true, features: [] } }], records: [record] });
  assert.equal(result.records[0].facadeDescription, undefined);
  assert.equal(result.report.omitted[0].reason, 'observation-revoked');
});

test('runner recovers a saved charged response before unresolved-charge checks', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-runner-recovery-'));
  const cacheRoot = path.join(directory, 'cache');
  await fs.mkdir(cacheRoot, { recursive: true });
  const crop = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  await fs.writeFile(path.join(directory, 'crop.jpg'), crop);
  const failedSource = source({ cropSha256: sha256(crop), width: 2, height: 2, registration: { status: 'failed' }, registrationAbstention: 'fixture abstention' });
  const runManifest = manifest(failedSource);
  runManifest.releaseId = JSON.parse(await fs.readFile(new URL('./baseline.json', import.meta.url))).releaseId;
  runManifest.activeDevelopmentSet.sha256 = activeSetHash(runManifest);
  const manifestPath = path.join(directory, 'manifest.json');
  const globalPath = path.join(directory, 'global.json');
  const resultKey = 'saved-analysis';
  await fs.writeFile(manifestPath, JSON.stringify(runManifest));
  await fs.writeFile(globalPath, JSON.stringify({ version: 1, entries: [{ id: 'global-reservation', key: resultKey, sourceLedger: path.join(cacheRoot, 'analysis-results.json'), reservedUsd: 0.04, status: 'pending', owner: { pid: 1, hostname: 'remote-host' } }] }));
  await fs.writeFile(path.join(cacheRoot, 'phase-budget.json'), JSON.stringify({ version: 1, entries: [{ id: 'phase-reservation', phase: 'development', key: resultKey, reservedUsd: 0.04, status: 'reserved' }] }));
  await fs.writeFile(path.join(cacheRoot, 'analysis-results.json'), JSON.stringify({ version: 2, extractionVersion: 'facade-description-v2', results: [{ key: resultKey, status: 'response-saved', phase: 'development', phaseReservation: 'phase-reservation', globalReservation: 'global-reservation', source: { cropSha256: hash('e'), width: 20, height: 20 }, providerResponse: { ok: true, httpStatus: 200, generationId: 'generation-1', usage: { cost: 0.01 }, content: JSON.stringify({ coordinateSpace: 'permille', openingsComplete: true, features: [] }) } }] }));
  await execFileAsync(process.execPath, ['--import', 'tsx', 'scripts/city-appearance/fidelity/extract.mjs', `--manifest=${manifestPath}`, `--cache-root=${cacheRoot}`, `--budget-ledger=${globalPath}`, '--run'], { cwd: process.cwd() });
  const recovered = JSON.parse(await fs.readFile(path.join(cacheRoot, 'analysis-results.json')));
  const global = JSON.parse(await fs.readFile(globalPath));
  const phase = JSON.parse(await fs.readFile(path.join(cacheRoot, 'phase-budget.json')));
  assert.equal(recovered.results[0].status, 'complete');
  assert.equal(global.entries[0].status, 'settled');
  assert.equal(phase.entries[0].status, 'settled');
});

test('runner records an explicit zero settlement for a rejected request with no generation', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-runner-rejection-'));
  const cacheRoot = path.join(directory, 'cache');
  await fs.mkdir(cacheRoot, { recursive: true });
  const crop = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  await fs.writeFile(path.join(directory, 'crop.jpg'), crop);
  const failedSource = source({ cropSha256: sha256(crop), width: 2, height: 2, registration: { status: 'failed' }, registrationAbstention: 'fixture abstention' });
  const runManifest = manifest(failedSource);
  runManifest.releaseId = JSON.parse(await fs.readFile(new URL('./baseline.json', import.meta.url))).releaseId;
  runManifest.activeDevelopmentSet.sha256 = activeSetHash(runManifest);
  const manifestPath = path.join(directory, 'manifest.json'), globalPath = path.join(directory, 'global.json'), resultKey = 'rejected-analysis';
  await fs.writeFile(manifestPath, JSON.stringify(runManifest));
  await fs.writeFile(globalPath, JSON.stringify({ version: 1, entries: [{ id: 'global-reservation', key: resultKey, sourceLedger: path.join(cacheRoot, 'analysis-results.json'), reservedUsd: 0.04, status: 'pending', owner: { pid: 1, hostname: 'remote-host' } }] }));
  await fs.writeFile(path.join(cacheRoot, 'phase-budget.json'), JSON.stringify({ version: 1, entries: [{ id: 'phase-reservation', phase: 'development', key: resultKey, reservedUsd: 0.04, status: 'reserved' }] }));
  await fs.writeFile(path.join(cacheRoot, 'analysis-results.json'), JSON.stringify({ version: 2, extractionVersion: 'facade-description-v2', results: [{ key: resultKey, status: 'response-saved', phase: 'development', phaseReservation: 'phase-reservation', globalReservation: 'global-reservation', source: { cropSha256: hash('e'), width: 20, height: 20 }, providerResponse: { ok: false, httpStatus: 400, providerError: { metadata: { raw: '{"error":{"status":"INVALID_ARGUMENT"}}' } } } }] }));
  await assert.rejects(execFileAsync(process.execPath, ['--import', 'tsx', 'scripts/city-appearance/fidelity/extract.mjs', `--manifest=${manifestPath}`, `--cache-root=${cacheRoot}`, `--budget-ledger=${globalPath}`, '--run'], { cwd: process.cwd() }), /Extraction stopped/);
  const [global, phase, analyses] = await Promise.all([fs.readFile(globalPath, 'utf8').then(JSON.parse), fs.readFile(path.join(cacheRoot, 'phase-budget.json'), 'utf8').then(JSON.parse), fs.readFile(path.join(cacheRoot, 'analysis-results.json'), 'utf8').then(JSON.parse)]);
  assert.deepEqual({ status: global.entries[0].status, actualUsd: global.entries[0].actualUsd }, { status: 'settled', actualUsd: 0 });
  assert.deepEqual({ status: phase.entries[0].status, actualUsd: phase.entries[0].actualUsd }, { status: 'settled', actualUsd: 0 });
  assert.equal(analyses.results[0].generationId, undefined);
  assert.match(analyses.results[0].error, /HTTP 400/);
});

test('concurrent runner drains saved responses, stops launches, and refuses to resend an unresolved charge', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-runner-concurrent-')),cacheRoot=path.join(directory,'cache');await fs.mkdir(cacheRoot,{recursive:true});
  const baselineValue=JSON.parse(await fs.readFile(new URL('./baseline.json',import.meta.url))),cases=[];
  for(let index=0;index<4;index++){const crop=await sharp({create:{width:2,height:2,channels:3,background:{r:240-index,g:240,b:240}}}).jpeg().toBuffer(),name=`crop-${index}.jpg`;await fs.writeFile(path.join(directory,name),crop);const value=item(source({path:name,cropSha256:sha256(crop),width:2,height:2}));value.id=value.observationId=`observation-${index}`;value.buildingId=`building-${index}`;cases.push(value);}
  const runManifest={version:2,releaseId:baselineValue.releaseId,phase:'development',activeDevelopmentSet:{id:'concurrent-fixture',sha256:'',status:'validated',kind:'replacement-development',originalTwelveOutstanding:true},cases};runManifest.activeDevelopmentSet.sha256=activeSetHash(runManifest);
  const manifestPath=path.join(directory,'manifest.json'),globalPath=path.join(directory,'global.json'),fetchPath=path.join(directory,'mock-fetch.mjs'),logPath=path.join(directory,'calls.log');
  await fs.writeFile(manifestPath,JSON.stringify(runManifest));
  await fs.writeFile(fetchPath,`import fs from 'node:fs';\nexport default async()=>{const p=process.env.MOCK_FETCH_LOG;let n=0;try{n=fs.readFileSync(p,'utf8').trim().split('\\n').filter(Boolean).length}catch{}fs.appendFileSync(p,String(n)+'\\n');if(n===1){await new Promise(r=>setTimeout(r,5));throw Error('synthetic lost response')}await new Promise(r=>setTimeout(r,25));return {ok:true,status:200,json:async()=>({id:'generation-'+n,usage:{cost:0.001},choices:[{message:{content:JSON.stringify({coordinateSpace:'permille',openingsComplete:true,features:[]})}}]})}};\n`);
  const args=['--import','tsx','scripts/city-appearance/fidelity/extract.mjs',`--manifest=${manifestPath}`,`--cache-root=${cacheRoot}`,`--budget-ledger=${globalPath}`,`--fetch-module=${fetchPath}`,'--concurrency=3','--run'],env={...process.env,OPENROUTER_API_KEY:'fixture',MOCK_FETCH_LOG:logPath};
  await assert.rejects(execFileAsync(process.execPath,args,{cwd:process.cwd(),env}),/reconcile the charge/);
  const [analyses,global,phase]=await Promise.all([readJson(path.join(cacheRoot,'analysis-results.json')),readJson(globalPath),readJson(path.join(cacheRoot,'phase-budget.json'))]);
  assert.deepEqual(analyses.results.map(value=>value.status).sort(),['charge-unresolved','complete','complete']);
  assert.deepEqual(global.entries.map(value=>value.status).sort(),['pending','settled','settled']);
  assert.deepEqual(phase.entries.map(value=>value.status).sort(),['reserved','settled','settled']);
  assert.equal((await fs.readFile(logPath,'utf8')).trim().split('\n').length,3,'fourth request did not start');
  await assert.rejects(execFileAsync(process.execPath,args,{cwd:process.cwd(),env}),/Unresolved global charge/);
  assert.equal((await fs.readFile(logPath,'utf8')).trim().split('\n').length,3,'resume did not resend any started key');
});

test('materialization CLI writes an explicit zero-registered omission artifact', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-materialize-cli-'));
  const crop = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  await fs.writeFile(path.join(directory, 'crop.jpg'), crop);
  const failedSource = source({ cropSha256: sha256(crop), width: 2, height: 2, registration: { status: 'ambiguous' }, registrationAbstention: 'wall identity ambiguous' });
  const runManifest = manifest(failedSource);
  runManifest.releaseId = JSON.parse(await fs.readFile(new URL('./baseline.json', import.meta.url))).releaseId;
  runManifest.activeDevelopmentSet.sha256 = activeSetHash(runManifest);
  const records = [{ id: 'observation-1', buildingId: 'building-1', geometryRevision: 'geometry-1', evidenceKey: hash('b'), localStart: [0, 0], localEnd: [4, 0], images: { ground: { sha256: failedSource.cropSha256, date: failedSource.captureDate } } }];
  await Promise.all([
    fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(runManifest)),
    fs.writeFile(path.join(directory, 'analyses.json'), JSON.stringify({ results: [] })),
    fs.writeFile(path.join(directory, 'records.json'), JSON.stringify(records)),
  ]);
  const output = path.join(directory, 'staged.json');
  await execFileAsync(process.execPath, ['scripts/city-appearance/fidelity/materialize-cli.mjs', `--manifest=${path.join(directory, 'manifest.json')}`, `--analyses=${path.join(directory, 'analyses.json')}`, `--records=${path.join(directory, 'records.json')}`, `--out=${output}`], { cwd: process.cwd() });
  const artifact = JSON.parse(await fs.readFile(`${output}.materialization.json`));
  assert.equal(artifact.attached.length, 0);
  assert.deepEqual(artifact.omitted, [{ observationId: 'observation-1', tier: 'ground', reason: 'registration-ambiguous' }]);
});
