/** Fully isolated contract tests: no municipal or paid network requests. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { validateAreaConfig, loadAreaConfig } from './da-costa-block/area-config.mjs';
import { createSourceCache, acquirePages } from './da-costa-block/source-acquisition.mjs';
import { runPipeline } from './da-costa-block/pipeline-runner.mjs';
import { globalBudget } from './da-costa-block/global-budget.mjs';
import { atomicJson, digest, readJson } from './da-costa-block/pipeline-state.mjs';
import { projectedBounds } from './da-costa-block/projected-bounds.mjs';
import { lngLatToRd } from '../src/canalRecall/facade/rdNew.ts';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'city-pipeline-test-'));
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const preset = await loadAreaConfig([]);
assert.equal(preset.cacheRoot, '.cache/da-costa-block');
assert.deepEqual(preset.origin, [4.87355, 52.3723]);
assert.equal((await loadAreaConfig(['--elandsgracht'])).referencePreset, 'elandsgracht');
const area = validateAreaConfig({ version: 1, id: 'test-area', bbox: [4.87, 52.37, 4.88, 52.38] });
assert.equal(area.cacheRoot, '.cache/city-appearance/areas/test-area/raw');
assert.ok(area.panorama.radiusM > 600);
assert.throws(() => validateAreaConfig({ ...area, bbox: [4.88, 52.37, 4.87, 52.38] }), /bbox/);
assert.throws(() => validateAreaConfig({ ...area, cacheRoot: '/' }), /roots/);
for (const box of [preset.bbox, [4.7, 52.28, 5.02, 52.44]]) {
  const envelope = projectedBounds(box), diagonal = projectedBounds(box, { legacyDiagonal: true });
  const corners = [[box[0], box[1]], [box[0], box[3]], [box[2], box[1]], [box[2], box[3]]].map(lngLatToRd);
  assert.ok(corners.every(point => point.x >= envelope[0] && point.x <= envelope[2] && point.y >= envelope[1] && point.y <= envelope[3]), 'all projected WGS84 corners must be inside acquisition bbox');
  assert.ok(corners.some(point => point.x < diagonal[0] || point.x > diagonal[2] || point.y < diagonal[1] || point.y > diagonal[3]), 'regression fixture exposes diagonal-only undercoverage');
}

const fake = data => ({ data, source: { sha256: digest(data) }, artifacts: [] });
let offsets = [];
const wfs = await acquirePages({ name: 'trees', url: 'https://example.invalid/wfs?COUNT=2', wfs: true, get: async (_, url) => {
  const offset = Number(new URL(url).searchParams.get('STARTINDEX') ?? 0); offsets.push(offset);
  return fake({ features: [0, 1, 2, 3].slice(offset, offset + 2).map(id => ({ id })), numberMatched: null });
} });
assert.deepEqual(offsets, [0, 2, 4]);
assert.equal(wfs.features.length, 4);
assert.equal(wfs.completeness.method, 'exhausted-wfs-pages');
await assert.rejects(acquirePages({ name: 'bag', url: 'https://example.invalid/', get: async () => fake({ features: [{ id: 1 }], numberMatched: 2 }) }), /incomplete/);
await assert.rejects(acquirePages({ name: 'trees', url: 'https://example.invalid/?COUNT=1', wfs: true, get: async () => fake({ features: [{ id: 1 }], numberMatched: 2 }) }), /duplicate/);
await assert.rejects(acquirePages({ name: 'bag', url: 'https://example.invalid/', get: async () => fake({ features: [{ id: 1 }], links: [{ rel: 'next', href: 'https://example.invalid/' }] }) }), /cycle/);
await assert.rejects(acquirePages({ name: 'panoramas', url: 'https://example.invalid/', embedded: true, get: async () => fake({ count: 2, _embedded: { panoramas: [{ pano_id: 'a' }] } }) }), /incomplete/);
await assert.rejects(acquirePages({ name: 'bag', url: 'https://example.invalid/', get: async () => fake({ features: [], numberReturned: 3 }) }), /returned count/);
const cityObjects = await acquirePages({ name: '3dbag', url: 'https://example.invalid/', countUnit: 'cityobjects', get: async () => fake({ features: [{ id: 'building', CityObjects: { building: { type: 'Building' }, part: { type: 'BuildingPart' } } }], numberReturned: 2, numberMatched: 2 }) });
assert.equal(cityObjects.completeness.receivedUnits,2);
const cityEnvelopeOverflow = await acquirePages({ name: '3dbag', url: 'https://example.invalid/', countUnit: 'cityobjects', get: async () => fake({ features: [{ id: 'a', CityObjects: { a: {}, ap: {} } }, { id: 'b', CityObjects: { b: {}, bp: {} } }], numberReturned: 3, numberMatched: 4 }) });
assert.equal(cityEnvelopeOverflow.completeness.receivedUnits,4,'complete CityJSON envelopes may cross the provider page cursor while the final advertised total remains exact');
assert.equal(cityEnvelopeOverflow.completeness.method,'advertised-count');assert.equal(cityEnvelopeOverflow.completeness.advertisedOverflow,0);
const boundedOverflow=await acquirePages({name:'3dbag',url:'https://example.invalid/',countUnit:'cityobjects',get:async()=>fake({features:[{id:'a',CityObjects:{a:{},ap:{}}},{id:'b',CityObjects:{b:{},bp:{}}}],numberReturned:3,numberMatched:3})});assert.equal(boundedOverflow.completeness.advertisedOverflow,1);
await assert.rejects(acquirePages({name:'3dbag',url:'https://example.invalid/',countUnit:'cityobjects',get:async()=>fake({features:[{id:'a',CityObjects:{a:{},ap:{}}},{id:'b',CityObjects:{b:{},bp:{}}}],numberReturned:1,numberMatched:1})}),/incomplete result/,'provider discrepancy larger than one complete envelope remains a hard failure');
assert.equal(cityObjects.completeness.received, 1); assert.equal(cityObjects.completeness.receivedUnits, 2);

const cacheRoot = path.join(root, 'sources');
let fetches = 0;
const sourceGet = await createSourceCache({ root: cacheRoot, fetchImpl: async () => { fetches++; return new Response(JSON.stringify({ features: [{ id: 'a' }] })); } });
const fetched = await sourceGet('bag-0', 'https://example.invalid/bag');
assert.equal(fetched.source.retrievalTimeKnown, true);
await sourceGet('bag-0', 'https://example.invalid/bag');
assert.equal(fetches, 1);
const offlineGet = await createSourceCache({ root: cacheRoot, offline: true });
await offlineGet('bag-0', 'https://example.invalid/bag');
await assert.rejects(offlineGet('bag-0', 'https://example.invalid/other'), /provenance mismatch/);
await assert.rejects(offlineGet('bag-1', 'https://example.invalid/bag'), /Offline source missing/);
await fs.writeFile(path.join(cacheRoot, 'bag-0.json'), '{}');
await assert.rejects(offlineGet('bag-0', 'https://example.invalid/bag'), /provenance mismatch/);
const legacyRoot = path.join(root, 'legacy-source');
await atomicJson(path.join(legacyRoot, 'bag-0.json'), { features: [] });
await atomicJson(path.join(legacyRoot, 'acquisition.json'), { sources: [{ name: 'bag-0', url: 'https://example.invalid/bag', sha256: digest(await fs.readFile(path.join(legacyRoot, 'bag-0.json'))) }] });
const legacyGet = await createSourceCache({ root: legacyRoot, offline: true });
const legacySource = await legacyGet('bag-0', 'https://example.invalid/bag');
assert.equal(legacySource.source.retrievedAt, null);
assert.equal(legacySource.source.retrievalTimeKnown, false);

const statePath = path.join(root, 'jobs.json'), artifactPath = path.join(root, 'artifact.json');
let active = 0, maximum = 0, failB = true;
const calls = { a: 0, b: 0, c: 0 };
const stage = (id, run, extras = {}) => ({ id, version: 1, ...extras, run: async context => { calls[id]++; active++; maximum = Math.max(maximum, active); try { await wait(60); return await run(context); } finally { active--; } } });
const jobs = [
  stage('a', async () => { await atomicJson(artifactPath, { answer: 7 }); return { output: 7, artifacts: [artifactPath] }; }),
  stage('b', async () => { if (failB) throw Error('simulated interruption'); return { output: 3 }; }),
  stage('c', async ({ dependencies }) => ({ output: dependencies.a + dependencies.b }), { dependsOn: ['a', 'b'] }),
];
await assert.rejects(runPipeline({ file: statePath, areaId: area.id, jobs, concurrency: 2 }), /simulated interruption/);
assert.equal(calls.c, 0); assert.equal(maximum, 2);
failB = false;
const resumed = await runPipeline({ file: statePath, areaId: area.id, jobs, concurrency: 2 });
assert.equal(resumed.a.cached, true); assert.equal(resumed.c.output, 10);
assert.deepEqual(calls, { a: 1, b: 2, c: 1 });
const uninterrupted = await runPipeline({ file: path.join(root, 'uninterrupted.json'), areaId: area.id, jobs, concurrency: 2 });
assert.deepEqual(Object.fromEntries(Object.entries(resumed).map(([id, value]) => [id, value.outputKey])), Object.fromEntries(Object.entries(uninterrupted).map(([id, value]) => [id, value.outputKey])));
const beforeTamper = calls.a;
await fs.writeFile(artifactPath, 'changed');
await runPipeline({ file: statePath, areaId: area.id, jobs, concurrency: 2 });
assert.equal(calls.a, beforeTamper + 1, 'changed output artifact invalidates stage cache');
const changedInput = await runPipeline({ file: statePath, areaId: area.id, jobs: jobs.map(job => job.id === 'b' ? { ...job, input: { revision: 2 }, run: async () => ({ output: 4 }) } : job), concurrency: 2 });
assert.equal(changedInput.c.output, 11, 'dependency output changes invalidate downstream jobs');
await assert.rejects(runPipeline({ file: statePath, areaId: 'another-area', jobs }), /different area/);
await assert.rejects(runPipeline({ file: statePath, areaId: area.id, jobs: [{ id: 'x', version: 1, dependsOn: ['x'], run: async () => ({}) }] }), /cycle/);
const abandonedPath = path.join(root, 'abandoned.json');
await atomicJson(abandonedPath, { version: 1, areaId: area.id, jobs: { x: { status: 'running', owner: { pid: 2147483647, hostname: os.hostname() }, attempt: 1 } } });
const abandoned = await runPipeline({ file: abandonedPath, areaId: area.id, jobs: [{ id: 'x', version: 1, run: async () => ({ output: 'recovered' }) }] });
assert.equal(abandoned.x.output, 'recovered');
assert.equal((await readJson(abandonedPath)).jobs.x.attempt, 2);

const ledgerPath = path.join(root, 'global-spend.json'), legacyLedger = path.join(root, 'local-spend.json');
await atomicJson(legacyLedger, { results: [{ key: 'already-paid', reservedUsd: .05, usage: { cost: .04 }, status: 'ok' }] });
const budget = globalBudget({ file: ledgerPath, ceiling: .1, legacyLedgers: [legacyLedger] });
assert.equal(await budget.assertReady(), .04);
const moduleUrl = pathToFileURL(path.resolve('scripts/da-costa-block/global-budget.mjs')).href;
const child = index => new Promise((resolve, reject) => {
  const script = `import {globalBudget} from ${JSON.stringify(moduleUrl)}; const b=globalBudget(${JSON.stringify({ file: ledgerPath, ceiling: .1, legacyLedgers: [legacyLedger] })}); try { const id=await b.reserve({key:${JSON.stringify(`job-${index}`)},sourceLedger:${JSON.stringify(path.join(root, `area-${index}`, 'spend.json'))},reservedUsd:.03}); await b.settle(id,.03); console.log('reserved'); } catch(error) { if(!/reservation exceeds ceiling/.test(String(error))) throw error; console.log('denied'); }`;
  const process = spawn(globalThis.process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; process.stdout.on('data', bytes => stdout += bytes); process.stderr.on('data', bytes => stderr += bytes);
  process.on('error', reject); process.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(Error(stderr)));
});
const reservations = await Promise.all(Array.from({ length: 8 }, (_, index) => child(index)));
assert.equal(reservations.filter(value => value === 'reserved').length, 2, 'global cap shared atomically by independent area processes');
const snapshot = await budget.snapshot();
assert.ok(Math.abs(snapshot.observedOrReservedCostUsd - .1) < 1e-10);
assert.equal(snapshot.entries.filter(entry => entry.id.startsWith('legacy:')).length, 1, 'legacy charges imported exactly once');

const unknown = globalBudget({ file: path.join(root, 'unknown-spend.json'), ceiling: .1, legacyLedgers: [] });
const unknownId = await unknown.reserve({ key: 'unknown', sourceLedger: legacyLedger, reservedUsd: .02 });
await unknown.settle(unknownId, undefined);
await assert.rejects(unknown.reserve({ key: 'later', sourceLedger: legacyLedger, reservedUsd: .01 }), /Unresolved previous charge/);
const crashed = globalBudget({ file: path.join(root, 'crash-spend.json'), ceiling: .1, legacyLedgers: [] });
await crashed.reserve({ key: 'crash', sourceLedger: legacyLedger, reservedUsd: .02 });
const crashedState = await readJson(crashed.file); crashedState.entries[0].owner.pid = 2147483647; await atomicJson(crashed.file, crashedState);
await assert.rejects(crashed.assertReady(), /Unresolved previous charge/);
console.log('Passed: area config, OGC/HAL/WFS completeness, source hash/URL/time provenance, bounded DAG concurrency, interrupted resume equivalence, artifact invalidation, abandoned-job recovery, cross-process cumulative budget import/cap, unknown-charge stop. No external requests or real charges.');
