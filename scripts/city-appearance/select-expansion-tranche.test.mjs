import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAreaConfig } from '../da-costa-block/area-config.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';
import { selectExpansionTranche } from './select-expansion-tranche.mjs';

const root = await fs.mkdtemp(path.resolve('.cache/check-expansion-tranche-'));
const parent = { ...validateAreaConfig({ version: 1, id: 'parent', bbox: [4, 52, 5, 53], cacheRoot: `${root}/parent/raw`, outputRoot: `${root}/parent/out` }), referencePreset: null };
parent.configHash = digest(parent);
const tranche = { ...validateAreaConfig({ version: 1, id: 'tranche', bbox: [4.2, 52.2, 4.8, 52.8], cacheRoot: `${root}/tranche/raw`, outputRoot: `${root}/tranche/out` }), referencePreset: null };
tranche.configHash = digest(tranche);
const inventoryHash = 'a'.repeat(64), directory = path.join(root, 'parent', 'inventory', inventoryHash);
const report = { complete: true, areaConfigHash: parent.configHash, inventoryHash };
const collection = { type: 'FeatureCollection', areaId: parent.id, inventoryHash, features: [
  { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[4.3, 52.3], [4.4, 52.3], [4.4, 52.4], [4.3, 52.3]]] }, properties: { buildingId: 'inside' } },
  { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[4.9, 52.9], [4.95, 52.9], [4.95, 52.95], [4.9, 52.9]]] }, properties: { buildingId: 'outside' } },
] };
await atomicJson(path.join(directory, 'inventory.json'), report);
await atomicJson(path.join(directory, 'candidate-footprints.geojson'), collection);
const first = await selectExpansionTranche(parent, tranche), second = await selectExpansionTranche(parent, tranche);
assert.equal(first.report.buildings, 1); assert.deepEqual(first.report, second.report); assert.equal(first.report.paidCalls, 0);
const selected = JSON.parse(await fs.readFile(path.join(first.destination, 'candidate-footprints.geojson')));
assert.equal(selected.features[0].properties.buildingId, 'inside');
await assert.rejects(() => selectExpansionTranche(parent, { ...tranche, bbox: [3, 52, 4.5, 52.5] }), /contained/);
console.log('expansion tranche selection checks passed');
