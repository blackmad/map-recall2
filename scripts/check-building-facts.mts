// What a clicked building that is no landmark says for itself. Named
// regression: the card read "No building details — This building has no name
// in the map data." for nearly every building in the city.
import assert from 'node:assert/strict';
import {
  BUILDING_TYPES, BuildingFactStore, describeBuilding, factTileOf, heritageLevel, periodOf,
  plausibleYear, shortBuildingId, storeysFor, yearFromStartDate,
} from '../src/canalRecall/buildingFacts';
import { gzipSync } from 'node:zlib';

assert.equal(yearFromStartDate('1665'), 1665);
assert.equal(yearFromStartDate('1924-05-01'), 1924);
assert.equal(yearFromStartDate('~1890'), 1890);
assert.equal(yearFromStartDate('1005'), null, 'BAG\'s unknown-year placeholder is not a year');
assert.equal(yearFromStartDate('C17'), null);
assert.equal(plausibleYear(2999), false);

assert.equal(periodOf(1665), 'in the Dutch Golden Age');
assert.equal(periodOf(1500), 'before the Dutch Golden Age');
assert.equal(periodOf(1924), 'in the early twentieth century');
assert.equal(periodOf(1943), 'during the Second World War');

assert.equal(heritageLevel({ heritage: '2' }), 2);
assert.equal(heritageLevel({ 'ref:rce': '1482' }), 2, 'a national monument number is a national listing');
assert.equal(heritageLevel({}), 0);
assert.equal(storeysFor(13), 4);
assert.equal(storeysFor(1), null);
assert.equal(shortBuildingId('NL.IMBAG.Pand.0363100012061542'), 'P0363100012061542');

const warehouse = BUILDING_TYPES.indexOf('warehouse');
assert.deepEqual(describeBuilding([1665, -1, 0], 13), {
  name: 'Built 1665', detail: 'Built in 1665, in the Dutch Golden Age. About 13 m tall, some 4 storeys.',
});
assert.deepEqual(describeBuilding([1720, warehouse, 2], null), {
  name: 'Built 1720', detail: 'A warehouse, built in 1720, in the eighteenth century. A national monument (rijksmonument).',
});
assert.equal(describeBuilding([1720, warehouse, 0], null, 'De Zon').name, 'De Zon', 'a mapped name stays the title');
assert.deepEqual(describeBuilding(null, null), { name: 'No building details', detail: 'This building has no name or date in the map data.' },
  'nothing known: no invented name');
assert.equal(describeBuilding([0, warehouse, 0], null).name, 'Warehouse');

// The store loads the tile under a point and answers by tile id.
const { x, y } = factTileOf(4.8835, 52.3745);
const requested: string[] = [];
const store = new BuildingFactStore('/data/amsterdam', async (url) => {
  requested.push(String(url));
  if (String(url).endsWith(`/14/${x}/${y}.json.gz`)) {
    return new Response(gzipSync(JSON.stringify({ version: 1, buildings: { P0363100012061542: [1665, -1, 0] } })));
  }
  return new Response('missing', { status: 404 });
});
store.prefetchAround(4.8835, 52.3745);
store.prefetchAround(4.8836, 52.3745);
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(requested.length, 9, 'nine tiles, once, however often the rider moves inside one');
assert.deepEqual(store.lookup('NL.IMBAG.Pand.0363100012061542'), [1665, -1, 0]);
assert.equal(store.lookup('w1'), null);
process.stdout.write('Building fact checks passed\n');
