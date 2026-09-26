import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { chooseAuditRecords, chooseCoverageRecords, chooseDistrictCoverageRecords, districtCoverageBatch, DEFAULT_AREA, selectPanoramaAudit } from './select-panorama-audit.mjs';

const buildings = [
  { id: 'old', year: 1880 }, { id: 'a', year: 1890 }, { id: 'b', year: 1910 },
  { id: 'c', year: 1970 }, { id: 'd', year: 2005 }, { id: 'e', year: 2010 },
];
const records = [
  ['old-1', 'old', 'A', 8], ['a-1', 'a', 'A', 4], ['a-2', 'a', 'A', 10],
  ['b-1', 'b', 'B', 6], ['c-1', 'c', 'C', 12], ['d-1', 'd', 'D', 9], ['e-1', 'e', 'D', 14],
].map(([id, buildingId, street, wallWidthM]) => ({ id, buildingId, street, wallWidthM, fullPanorama: `${id}-f`, groundPanorama: `${id}-g` }));
const first = chooseAuditRecords(records, buildings, new Set(['old']), 5), second = chooseAuditRecords(records, buildings, new Set(['old']), 5);
assert.deepEqual(first, second); assert.equal(first.length, 5); assert(!first.some(record => record.buildingId === 'old'));
assert.deepEqual(new Set(first.map(record => record.street)), new Set(['A', 'B', 'C', 'D']));
assert(first.some(record => record.era === '1945-1989')); assert(first.some(record => record.era === '1990+'));
assert.throws(() => chooseAuditRecords(records, buildings, new Set(), 49), /1–48/);
const coverageOptions = { streets: ['D', 'A'], excludeBuildingIds: new Set(['old']), cap: 1000 };
const coverageFirst = chooseCoverageRecords(records, buildings, coverageOptions);
const coverageSecond = chooseCoverageRecords([...records].reverse(), [...buildings].reverse(), coverageOptions);
assert.deepEqual(coverageFirst, coverageSecond);
assert.deepEqual(coverageFirst.map(record => record.id), ['a-1', 'a-2', 'd-1', 'e-1']);
assert(!coverageFirst.some(record => record.buildingId === 'old'));
assert(coverageFirst.every(record => ['A', 'D'].includes(record.street)));
assert.throws(() => chooseCoverageRecords(records, buildings, { cap: 1001 }), /1–1000/);

const districtOwners = new Set(['a', 'b', 'c', 'd', 'e']);
const districtRecords = chooseDistrictCoverageRecords(records, buildings, districtOwners);
assert.deepEqual(districtRecords.map(record => record.id), ['a-1', 'a-2', 'b-1', 'c-1', 'd-1', 'e-1']);
assert.deepEqual(districtRecords, chooseDistrictCoverageRecords([...records].reverse(), [...buildings].reverse(), districtOwners));
const parts = [0, 1, 2].map(index => districtCoverageBatch(districtRecords, 2, index));
assert(parts.every(part => part.batches === 3));
assert.deepEqual(parts.flatMap(part => part.records), districtRecords, 'batches must cover every eligible frontage exactly once');
assert.throws(() => districtCoverageBatch(districtRecords, 2, 3), /outside/);
assert.throws(() => districtCoverageBatch(districtRecords, 251, 0), /1–250/);
assert.throws(() => chooseDistrictCoverageRecords([...records, records[0]], buildings, districtOwners), /Duplicate district frontage/);

try {
  await fs.access(path.resolve('.cache/city-appearance/areas/da-costa-tranche-400m-v1/runs'));
  const area = await loadAreaConfig([`--area-config=${path.resolve(DEFAULT_AREA)}`]);
  const selected = await selectPanoramaAudit(area, { cap: 24 });
  assert.equal(selected.report.selectionHash, 'be950e97c54cab9950c80fa33846ca8bbc2a2477fe4284977d91dc481128f783');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('panorama audit selection checks passed');
