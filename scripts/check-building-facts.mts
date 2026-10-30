// What a clicked building that is no landmark says for itself. Named
// regression: the card read "No building details — This building has no name
// in the map data." for nearly every building in the city.
import assert from 'node:assert/strict';
import {
  architectDisplay, monumentHeritage, BUILDING_TYPES, BuildingFactStore, describeBuilding, factTileOf, heritageLevel, periodOf,
  plausibleYear, shortBuildingId, storeysFor, yearFromStartDate,
} from '../src/canalRecall/buildingFacts';
import { gzipSync } from 'node:zlib';
import {
  articleCard, clipExtract, isBuildingClass, parseWikipediaTag, pickArticle, registerLineUnderArticle,
} from '../src/canalRecall/buildingArticles';

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
assert.equal(requested.filter(url => url.includes('/building-facts/')).length, 9, 'nine tiles, once, however often the rider moves inside one');
assert.equal(requested.filter(url => url.includes('/building-articles/')).length, 1, 'with no article index answering, no article tile is ever asked for');
assert.deepEqual(store.lookup('NL.IMBAG.Pand.0363100012061542'), [1665, -1, 0]);
assert.equal(store.lookup('w1'), null);
// Wikipedia articles about ordinary buildings (buildingArticles.ts). Named
// regression: Emerald Empire on KNSM-eiland, an apartment ring with an OSM
// wikipedia tag, opened a card that said only "Built 1995" (user 2026-10-30).
assert.equal(isBuildingClass(['building']), true);
assert.equal(isBuildingClass(['apartment building', 'architectural structure']), true);
assert.equal(isBuildingClass(['street']), false, 'a street\'s coordinates fall in no building of its own');
assert.equal(isBuildingClass(['church building', 'destroyed building or structure']), false, 'a demolished church is not the block now there');
assert.equal(isBuildingClass(['Olympic sporting event']), false);
assert.deepEqual(parseWikipediaTag('nl:Emerald Empire'), { lang: 'nl', title: 'Emerald Empire' });
assert.deepEqual(parseWikipediaTag('en:Rembrandt_Tower'), { lang: 'en', title: 'Rembrandt Tower' });
assert.equal(parseWikipediaTag('Emerald Empire'), null, 'a tag without a language is not an article');
const tag = { how: 'osm-tag' as const, sitelinks: 2, hasEnglish: false, q: 'Q1' };
const famous = { how: 'point' as const, sitelinks: 30, hasEnglish: true, q: 'Q2' };
assert.equal(pickArticle([famous, tag])?.q, 'Q1', 'the mapper\'s own tag beats a point that merely lands inside');
assert.equal(pickArticle([{ ...famous, how: 'point' }, { how: 'point', sitelinks: 3, hasEnglish: false, q: 'Q3' }])?.q, 'Q2');
assert.equal(pickArticle([]), null);
const lede = 'Emerald Empire, also called Venetiëhof, is an apartment complex on KNSM-eiland in Amsterdam-Oost. It is a round residential building surrounded by a ring of water villas, built in 1996–97 to a design by Jo Coenen. The building has a special position on the axis of the KNSM-laan, surrounded on three sides by water, and is regarded as an exclusive residential location.';
const clipped = clipExtract(lede);
assert.ok(clipped.length <= 360 && clipped.endsWith('Jo Coenen.'), `clips at the sentence end before 360 characters, got: ${clipped}`);
assert.equal(clipExtract('Short.'), 'Short.');
assert.equal(clipExtract('St. Nicolaaskerk is a church. '.repeat(30)).includes('St. Nicolaaskerk'), true);
assert.ok(!/St\.$/.test(clipExtract(`${'word '.repeat(60)}the St. ${'x'.repeat(300)}`)), 'an abbreviation is not a sentence end');
assert.equal(registerLineUnderArticle('This building has no name or date in the map data.'), '', 'the nothing-known fallback is not a register line');
const emerald = { t: 'Emerald Empire', u: 'https://nl.wikipedia.org/wiki/Emerald_Empire', e: clipped, i: 'https://upload.wikimedia.org/x.jpg', q: 'Q66764687' };
const built = describeBuilding([1995, -1, 0], 27);
assert.deepEqual(articleCard(emerald, built), {
  name: 'Emerald Empire', detail: clipped, longDetail: `${clipped}\n\n${built.detail}`,
  wikipediaUrl: emerald.u, imageUrl: emerald.i, extractLang: 'en', wikidata: 'Q66764687',
});
assert.equal(articleCard(emerald, built, true).name, 'Built 1995', 'a title that spoils a question yields to the register title');
assert.equal(articleCard({ ...emerald, l: 'nl' }, { name: 'x', detail: 'This building has no name or date in the map data.' }).longDetail, clipped);
assert.equal(articleCard({ ...emerald, l: 'nl' }, built).extractLang, 'nl', 'an untranslated lede is badged');

// The store reads the article tile beside the fact tile, only where the index says one exists.
const articleRequests: string[] = [];
const articleStore = new BuildingFactStore('/data/amsterdam', async (url) => {
  const target = String(url);
  articleRequests.push(target);
  if (target.endsWith('/building-articles/14/index.json')) return new Response(JSON.stringify({ version: 1, tiles: [`${x}/${y}`] }));
  if (target.endsWith(`/building-articles/14/${x}/${y}.json.gz`)) {
    return new Response(gzipSync(JSON.stringify({ version: 1, buildings: { P0363100012102098: emerald } })));
  }
  if (target.endsWith(`/building-facts/14/${x}/${y}.json.gz`)) {
    return new Response(gzipSync(JSON.stringify({ version: 1, buildings: { P0363100012102098: [1995, -1, 0] } })));
  }
  return new Response('missing', { status: 404 });
});
await articleStore.ensureAt(4.8835, 52.3745);
await articleStore.ensureAt(4.8835 + 360 / 2 ** 14 * 1.5, 52.3745);
assert.deepEqual(articleStore.article('NL.IMBAG.Pand.0363100012102098'), emerald);
assert.deepEqual(articleStore.lookup('NL.IMBAG.Pand.0363100012102098'), [1995, -1, 0]);
assert.equal(articleRequests.filter(u => u.includes('/building-articles/14/index.json')).length, 1, 'the index is read once');
assert.equal(articleRequests.filter(u => u.includes('/building-articles/14/') && u.endsWith('.json.gz')).length, 1,
  'a tile the index does not list is never requested');

process.stdout.write('Building fact checks passed\n');
