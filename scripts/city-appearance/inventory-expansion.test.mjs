import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inventoryExpansion, metadataSources } from './inventory-expansion.mjs';
import { validateAreaConfig } from '../da-costa-block/area-config.mjs';
import { digest } from '../da-costa-block/pipeline-state.mjs';

const fixture = await fs.mkdtemp(path.resolve('.cache/check-expansion-inventory-'));
const baselineRoot = path.join(fixture, 'baseline');
await fs.mkdir(path.join(baselineRoot, 'images'), { recursive: true });
await fs.mkdir(path.join(baselineRoot, 'panoramas'));
await fs.writeFile(path.join(baselineRoot, 'images', 'crop.jpg'), 'fixture crop');
await fs.writeFile(path.join(baselineRoot, 'panoramas', 'pano.jpg'), 'fixture panorama');
await fs.writeFile(path.join(baselineRoot, 'manifest.json'), JSON.stringify({ records: [{ id: 'frontage', buildingId: 'building', images: { full: { file: 'crop.jpg', panoramaId: 'pano' }, roof: { file: 'crop.jpg', panoramaId: 'pano' } } }] }));
const config = validateAreaConfig({ version: 1, id: 'inventory-fixture', bbox: [4.87, 52.37, 4.88, 52.38], cacheRoot: path.join(fixture, 'raw'), outputRoot: path.join(fixture, 'staging') });
const area = { ...config, configHash: digest(config) };
let fetches = 0;
const fetchImpl = async url => {
  fetches++;
  assert.ok(!url.includes('.jpg'), 'metadata runner must not request images');
  let data;
  if (url.includes('/panorama/')) data = { count: 3, _embedded: { panoramas: [
    { pano_id: 'a', geometry: { coordinates: [4.875, 52.375] }, timestamp: '2025-01-01', surface_type: 'L' },
    { pano_id: 'b', geometry: { coordinates: [4.875, 52.375] }, timestamp: '2024-01-01', surface_type: 'W' },
    { pano_id: 'c', geometry: { coordinates: [4.89, 52.375] }, timestamp: '2023-01-01', surface_type: 'L' },
  ] } };
  else if (url.includes('/pand/')) data = { numberMatched: 2, features: [
    { id: 'b1', properties: { identificatie: 'stable-1', status: 'Pand in gebruik' } },
    { id: 'b2', properties: { identificatie: 'stable-2', status: 'Pand gesloopt' } },
  ] };
  else if (url.includes('/verblijfsobject/')) data = { numberMatched: 2, features: [
    { id: 'a1', properties: { hoofdadres_status: 'Naamgeving uitgegeven', status: 'Verblijfsobject in gebruik', openbare_ruimte_naam: 'Da Costakade' } },
    { id: 'a2', properties: { hoofdadres_status: 'Naamgeving ingetrokken', status: 'Verblijfsobject ingetrokken', openbare_ruimte_naam: 'Old address' } },
  ] };
  else data = { numberMatched: 0, features: [] };
  return new Response(JSON.stringify(data));
};
const first = await inventoryExpansion(area, { fetchImpl, baselineRoot });
assert.equal(fetches, 4); assert.equal(first.report.complete, true);
assert.equal(first.report.summary.buildings.features, 2);
assert.equal(first.report.summary.buildings.operational, 1);
assert.deepEqual(first.report.summary.addresses.streets, { 'Da Costakade': 1 });
assert.equal(first.report.summary.panoramas.insideBbox, 2);
assert.equal(first.report.summary.panoramas.landInsideBbox, 1);
assert.equal(first.report.storage.baseline.panoramaCount, 1, 'unique source images, not repeated fields');
assert.equal(first.report.storage.baseline.cropCount, 1);
assert.equal(first.report.storage.inferenceCostForecastUsd, null);
const replay = await inventoryExpansion(area, { offline: true, baselineRoot, fetchImpl: () => { throw Error('network forbidden'); } });
assert.deepEqual(replay, first, 'offline replay preserves report content and identity');
const changedArea = { ...area, id: 'other-stable-area-id' };
assert.notEqual((await inventoryExpansion(changedArea, { offline: true, baselineRoot })).report.inventoryHash, first.report.inventoryHash, 'area identity is pinned');
await fs.writeFile(path.join(baselineRoot, 'images', 'crop.jpg'), 'changed source bytes');
assert.notEqual((await inventoryExpansion(area, { offline: true, baselineRoot })).report.inventoryHash, first.report.inventoryHash, 'baseline bytes are pinned');
await fs.appendFile(path.join(area.cacheRoot, 'metadata-inventory-v1', 'bag-0.json'), ' ');
const corrupted = await inventoryExpansion(area, { offline: true, baselineRoot });
assert.equal(corrupted.report.complete, false);
assert.equal(corrupted.report.errors[0].source, 'bag');
assert.match(corrupted.report.errors[0].message, /provenance mismatch/);
assert.equal(corrupted.report.imageryDownloads, 0); assert.equal(corrupted.report.paidCalls, 0);
assert.equal(metadataSources(area).length, 4);
console.log('Expansion inventory: bounded metadata only, stable area/source/code identity, deterministic offline replay, corrupt-source rejection, unique-image storage scenarios and partial availability passed.');
