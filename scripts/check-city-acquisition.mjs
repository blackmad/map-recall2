/** Replay legacy acquisition offline; a custom four-corner query must reject its incompatible cache. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { AREA_PRESETS, loadAreaConfig } from './da-costa-block/area-config.mjs';
import { atomicJson, digest, readJson } from './da-costa-block/pipeline-state.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'city-acquisition-test-'));
const sourceRoot = '.cache/da-costa-block', cacheRoot = path.join(root, '.cache/da-costa-block');
const original = await readJson(path.join(sourceRoot, 'acquisition.json'));
const spendBefore = digest(await fs.readFile('.cache/da-costa-neighbourhood/spend.json'));
await fs.mkdir(cacheRoot, { recursive: true });
await fs.copyFile(path.join(sourceRoot, 'acquisition.json'), path.join(cacheRoot, 'acquisition.json'));
for (const source of original.sources) await fs.copyFile(path.join(sourceRoot, `${source.name}.json`), path.join(cacheRoot, `${source.name}.json`));
const script = path.resolve('scripts/da-costa-block/acquire.mjs');
const command = () => spawnSync(process.execPath, [script, '--inventory-only', '--offline'], { cwd: root, encoding: 'utf8', timeout: 60000 });
let result = command();
assert.equal(result.status, 0, result.stderr);
const inventory = await readJson(path.join(cacheRoot, 'acquisition.json'));
assert.equal(inventory.areaId, 'da-costa-block');
assert.equal(inventory.areaConfigHash, (await loadAreaConfig([])).configHash);
assert.equal(inventory.rdBoundsMethod, 'legacy-diagonal');
assert.equal(inventory.sources.length, original.sources.length);
assert.ok(inventory.sources.every(source => source.retrievedAt === null && source.retrievalTimeKnown === false), 'legacy source timestamps are not invented');
for (const [name, completeness] of Object.entries(inventory.completeness)) assert.equal(completeness.received, (await readJson(path.join(sourceRoot, `${name}.json`))).length, name);
const firstState = await readJson(path.join(cacheRoot, 'acquisition-jobs.json'));
result = command(); assert.equal(result.status, 0, result.stderr);
const secondState = await readJson(path.join(cacheRoot, 'acquisition-jobs.json'));
assert.deepEqual(firstState, secondState, 'resume reuses validated cached stages without starting new attempts');
await assert.rejects(fs.readFile(path.join(cacheRoot, 'reference-views.json')), { code: 'ENOENT' });
const completeManifest = digest(await fs.readFile(path.join(cacheRoot, 'acquisition.json')));
await fs.writeFile(path.join(cacheRoot, 'bag-0.json'), '{}');
result = command(); assert.notEqual(result.status, 0); assert.match(result.stderr, /provenance mismatch/);
assert.equal(digest(await fs.readFile(path.join(cacheRoot, 'acquisition.json'))), completeManifest, 'failure preserves the last complete inventory');

// Reusing these bytes as a newly projected custom area would falsely certify the
// slightly wider RD rectangle. Verify refusal, rather than relabeling cached URLs.
const customCache = path.join(root, 'custom-raw'), configFile = path.join(root, 'area.json');
await fs.mkdir(customCache);
await fs.copyFile(path.join(sourceRoot, 'acquisition.json'), path.join(customCache, 'acquisition.json'));
for (const source of original.sources) await fs.copyFile(path.join(sourceRoot, `${source.name}.json`), path.join(customCache, `${source.name}.json`));
await atomicJson(configFile, { ...AREA_PRESETS['da-costa-block'], id: 'custom-projection-test', cacheRoot: customCache, outputRoot: path.join(root, 'output') });
const custom = spawnSync(process.execPath, [script, `--area-config=${configFile}`, '--inventory-only', '--offline'], { cwd: root, encoding: 'utf8', timeout: 60000 });
assert.notEqual(custom.status, 0); assert.match(custom.stderr, /Cache provenance mismatch for 3dbag-0/);
assert.equal(digest(await fs.readFile(path.join(customCache, 'acquisition.json'))), digest(await fs.readFile(path.join(sourceRoot, 'acquisition.json'))), 'incompatible query cannot certify a completed custom inventory');
const dryRun = spawnSync(process.execPath, [script, `--area-config=${configFile}`, '--dry-run', '--inventory-only'], { cwd: root, encoding: 'utf8' });
assert.equal(dryRun.status, 0, dryRun.stderr); assert.equal(JSON.parse(dryRun.stdout).rdBoundsMethod, 'four-corners');
assert.equal(digest(await fs.readFile('.cache/da-costa-neighbourhood/spend.json')), spendBefore);
console.log(`Passed: isolated offline legacy replay of ${inventory.sources.length} cached source pages, exact counts, resumable cache reuse, honest provenance, corrupted-source refusal, and rejection of legacy bytes for the wider custom-area projection. Original cache/ledger untouched.`);
