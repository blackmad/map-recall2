// What a clicked building that is no landmark says for itself. Named
// regression: the card read "No building details — This building has no name
// in the map data." for nearly every building in the city.
import assert from 'node:assert/strict';
import {
  architectDisplay, monumentHeritage, BUILDING_TYPES, BuildingFactStore, describeBuilding, factTileOf, heritageLevel, periodOf,
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

// The monument register (municipal data API), joined by BAG pand id.
assert.equal(architectDisplay('Gendt, A.L. van'), 'A.L. van Gendt');
assert.equal(architectDisplay('Zietsma, J. en Lammers, Th.J.'), 'J. Zietsma and Th.J. Lammers');
assert.equal(architectDisplay('Leliman, J.H.W. (Willem)'), 'J.H.W. Leliman');
assert.equal(architectDisplay('Dienst der Publieke Werken'), 'Dienst der Publieke Werken');
assert.equal(monumentHeritage('Rijksmonument'), 2);
assert.equal(monumentHeritage('Gemeentelijk monument'), 3);
assert.equal(monumentHeritage('In procedure Gemeentelijk Monument'), 0, 'a listing in progress is not a listing');
assert.deepEqual(describeBuilding([1933, -1, 3, { n: 'Apollohal', a: 'A. Boeken', y: '1933–1935', f: 6 }], 12), {
  name: 'Apollohal',
  detail: 'Built in 1933–1935, in the early twentieth century, designed by A. Boeken. A municipal monument. '
    + 'Originally built for hospitality, sport and recreation. About 12 m tall, some 4 storeys.',
});
assert.equal(describeBuilding([1690, -1, 2, { f: 0 }], null).detail,
  'Built in 1690, in the late seventeenth century. A national monument (rijksmonument).', 'housing goes without saying');
assert.equal(describeBuilding([1880, -1, 2, { y: '1665' }], null).detail.startsWith('Built in 1665'),
  true, 'the register\'s construction year beats the BAG year');

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
// Wait for the async gunzip to land rather than a fixed 20 ms, which failed
// 3 in 5 runs on a loaded machine (2026-10-09).
for (const deadline = Date.now() + 2000; !store.lookup('NL.IMBAG.Pand.0363100012061542') && Date.now() < deadline;) {
  await new Promise(resolve => setTimeout(resolve, 10));
}
assert.equal(requested.length, 9, 'nine tiles, once, however often the rider moves inside one');
assert.deepEqual(store.lookup('NL.IMBAG.Pand.0363100012061542'), [1665, -1, 0]);
assert.equal(store.lookup('w1'), null);
process.stdout.write('Building fact checks passed\n');
