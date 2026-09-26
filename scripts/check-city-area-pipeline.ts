import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { planAreaPipeline, executeAreaPipeline } from './city-appearance/run-area-pipeline.js';
import { sha256 } from './city-appearance/compile-block-tiles.js';
import { validateAreaConfig } from './da-costa-block/area-config.mjs';
import { digest } from './da-costa-block/pipeline-state.mjs';

const fixture = await fs.mkdtemp(path.resolve('.cache/check-city-area-'));
const raw = path.join(fixture, 'raw'); await fs.mkdir(raw);
const config = validateAreaConfig({
  version: 1, id: path.basename(fixture).toLowerCase(), bbox: [4.87, 52.37, 4.88, 52.38], origin: [4.875, 52.375],
  cacheRoot: raw, outputRoot: path.join(fixture, 'unpublished'),
});
const configFile = path.join(fixture, 'area.json');
await fs.writeFile(configFile, JSON.stringify(config));
const write = (name: string, value: unknown) => fs.writeFile(path.join(raw, `${name}.json`), JSON.stringify(value));
const bag = [{ type: 'Feature', id: 'bag-fixture-api-id', properties: { identificatie: '0363100099999999', status: 'Pand in gebruik', bouwjaar: 1900 }, geometry: {
  type: 'Polygon', coordinates: [[[4.8749, 52.3749], [4.8751, 52.3749], [4.8751, 52.3751], [4.8749, 52.3751], [4.8749, 52.3749]]],
} }];
await write('acquisition', { acquiredAt: '2026-09-09T00:00:00Z', errors: [], sources: [], areaConfigHash: digest(config) });
await write('bag', bag);
for (const name of ['addresses', 'panoramas', 'trees', 'moorings', 'bgt-wegdeel', 'bgt-ondersteunendwegdeel', 'bgt-waterdeel', 'bgt-begroeidterreindeel', 'bgt-onbegroeidterreindeel', 'bgt-overbruggingsdeel', 'bgt-spoor', 'bgt-scheiding_lijn', 'bgt-paal', 'bgt-straatmeubilair']) await write(name, []);
const publishedPaths = ['public/data/da-costa-block/block.json', 'public/data/da-costa-block/neighbourhood.json'];
const before = await Promise.all(publishedPaths.map(async file => sha256(await fs.readFile(file))));
const args = [`--area-config=${configFile}`];
const plan = await planAreaPipeline(args);
assert.equal(plan.evidenceMode, 'geometry-only');
assert.equal(plan.downloads, 0); assert.equal(plan.paidCalls, 0);
await assert.rejects(() => fs.access(plan.runRoot), { code: 'ENOENT' }, 'planning does not create run state');
assert.equal((await planAreaPipeline(args)).runHash, plan.runHash, 'same bytes produce same plan identity');
const abort = new AbortController();
await assert.rejects(() => executeAreaPipeline(plan, { signal: abort.signal, onStage: id => { if (id === 'compile') abort.abort(new Error('simulated interruption')); } }), /simulated interruption/);
const resumed = await executeAreaPipeline(plan);
assert.equal(resumed.compile.cached, true, 'completed compile survives interruption');
assert.equal(resumed.inventory.cached, false);
assert.equal(resumed.tiles.cached, false);
assert.equal(resumed['context-tiles'].cached, false);
assert.equal(resumed.tiles.output.buildings, 1);
assert.equal(resumed.tiles.output.observations, 0, 'missing evidence never fabricates classifications');
const manifest = JSON.parse(await fs.readFile(resumed.tiles.output.indexPath, 'utf8'));
assert.equal(manifest.publication, 'experimental-staging-only');
assert.equal(manifest.evidenceMode, 'geometry-only');
for (const tile of manifest.tiles) {
  const bytes = await fs.readFile(path.join(resumed.tiles.output.directory, `${tile.key}.json.gz`));
  assert.equal(sha256(bytes), tile.sha256);
  const payload = JSON.parse(gunzipSync(bytes).toString());
  for (const owner of payload.owners) assert.deepEqual(owner.observations, []);
}
const cached = await executeAreaPipeline(plan);
assert.ok(Object.values(cached).every((job: any) => job.cached), 'intact second run performs no stages');
await fs.appendFile(resumed.inventory.output.inventoryPath, '\ncorrupted test artifact');
const repaired = await executeAreaPipeline(plan);
assert.equal(repaired.compile.cached, true);
assert.equal(repaired.inventory.cached, false, 'artifact SHA mismatch invalidates cached stage');
assert.equal(repaired.tiles.cached, false, 'dependent artifacts replay after upstream invalidation');
assert.equal(repaired['context-tiles'].cached, true, 'independent context artifacts survive inventory-only corruption');
assert.notEqual(repaired.inventory.output.inventoryPath, resumed.inventory.output.inventoryPath, 'repair does not overwrite earlier run artifacts');
const oldHash = plan.runHash;
bag[0].properties.bouwjaar = 1901; await write('bag', bag);
assert.notEqual((await planAreaPipeline(args)).runHash, oldHash, 'actual source bytes key the run');
await assert.rejects(() => executeAreaPipeline(plan), /Input changed during run/, 'stale plan fails closed');
await assert.rejects(() => planAreaPipeline([...args, `--evidence=${path.join(fixture, 'missing.json')}`]), { code: 'ENOENT' }, 'explicit missing evidence is an error');
assert.deepEqual(await Promise.all(publishedPaths.map(async file => sha256(await fs.readFile(file)))), before, 'public demo data untouched');
console.log('Offline city area pipeline: read-only plan, custom geometry-only compilation, interruption/resume, artifact invalidation, source-byte keys and no publication passed.');
