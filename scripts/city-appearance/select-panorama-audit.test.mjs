import assert from 'node:assert/strict';
import { chooseAuditRecords } from './select-panorama-audit.mjs';

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
console.log('panorama audit selection checks passed');
