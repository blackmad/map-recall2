import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBuurtPages, buildHoods, FactDeduper, kitLabel, rideUrl, slugify, splitModelName, viewpoint, type BoundaryInput, type LatLng } from './data';
import { renderBuurtIndex, renderBuurtPage } from './template';

// Two nested squares: a quarter (~1.1 km across) holding a neighbourhood, plus a duplicate relation.
const square = (lat: number, lng: number, d: number): LatLng[][][] => [[[[lat, lng], [lat + d, lng], [lat + d, lng + d], [lat, lng + d], [lat, lng]]]];
const boundaries: BoundaryInput[] = [
  { name: 'Oud-Test', kind: 'quarter', geometry: square(52.36, 4.88, 0.01) },
  { name: 'Chassébuurt', kind: 'neighbourhood', geometry: square(52.362, 4.882, 0.002) },
  { name: 'Chassébuurt', kind: 'neighbourhood', geometry: square(52.366, 4.886, 0.001) },
  { name: 'Amsterdam', kind: 'municipality', geometry: square(52.2, 4.7, 0.4) },
  { name: 'No outline', kind: 'quarter', geometry: null },
];

test('postcard areas: one per name, municipality and outline-less areas dropped, slugs ASCII', () => {
  const hoods = buildHoods(boundaries);
  assert.deepEqual(hoods.map(h => h.slug), ['chassebuurt', 'oud-test']);
  assert.equal(hoods[0].polygons.length, 2);
  assert.equal(slugify('Nieuwmarkt/Lastage'), 'nieuwmarkt-lastage');
  assert.equal(slugify('Prinses Irenebuurt e.o.'), 'prinses-irenebuurt-e-o');
});

test('a building lands in every area that holds it; parent and photo fall back to the enclosing quarter', () => {
  const pages = buildBuurtPages({
    boundaries,
    enrichments: [{ name: 'Oud-Test', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Canal.jpg/500px-Canal.jpg', imageAttribution: 'Wikimedia Commons: Canal.jpg (Someone, CC BY-SA 4.0)' },
      { name: 'Chassébuurt', imageUrl: 'https://upload.wikimedia.org/x/Map_NL_Amsterdam.png' }],
    stories: [{ areaName: 'Chassébuurt', topFacts: [{ text: 'Named after General Chassé.' }, { text: 'Named after general Chassé!' }] }],
    history: [], areaPhotos: {},
    buildings: [{ id: 'kerk', name: 'Chassékerk', kind: 'landmark', lat: 52.363, lng: 4.883, sizeM: 40 }, { id: 'beeld', name: 'Statue', kind: 'landmark', lat: 52.3635, lng: 4.8835, sizeM: 2 }],
    kitInstances: [], subjects: [],
    names: [{ name: 'Chassestraat', kind: 'street', points: [[52.3625, 4.8825]], origin: 'After the general.' }],
    streetPoints: [[52.3634, 4.8830], [52.3626, 4.8821]],
  });
  const [chasse, quarter] = pages;
  assert.equal(chasse.parent?.slug, 'oud-test');
  assert.deepEqual(quarter.children.map(c => c.slug), ['chassebuurt']);
  assert.equal(chasse.postcard?.borrowedFrom, 'Oud-Test', 'a locator map is not a postcard: borrow the quarter\'s');
  assert.equal(chasse.postcard?.sourceUrl, 'https://commons.wikimedia.org/wiki/File:Canal.jpg');
  assert.deepEqual(chasse.buildings.map(b => b.id), ['kerk', 'beeld']);
  assert.deepEqual(quarter.buildings.map(b => b.id), ['kerk', 'beeld']);
  assert.equal(chasse.stories.length, 1, 'a reworded duplicate fact is dropped');
  assert.equal(chasse.streets[0].origin, 'After the general.');
  assert.ok(!chasse.shotPlan.some(s => s.label === 'Statue'), 'a 2 m statue is not framed from the street');
  assert.equal(chasse.shotPlan.at(-1)?.view, 'aerial');

  const html = renderBuurtPage(chasse, [], pages);
  assert.match(html, /<h1>Chassébuurt<\/h1>/);
  assert.match(html, /Photo of Oud-Test/);
  assert.match(html, /href="oud-test\.html"/);
  const empty = renderBuurtPage(quarter, [], pages.map(p => ({ ...p, buildings: [] })));
  assert.match(empty, /No frames captured here yet/);
  assert.match(renderBuurtIndex(pages, { shots: {} }), /2 neighbourhoods/);
});

test('an area with nothing modelled says so instead of an empty grid', () => {
  const [page] = buildBuurtPages({ boundaries: [boundaries[0]], enrichments: [], stories: [], history: [], areaPhotos: {}, buildings: [], kitInstances: [], subjects: [], names: [], streetPoints: [] });
  const html = renderBuurtPage(page, [], [page]);
  assert.match(html, /Nothing here is individually modelled yet/);
  assert.match(html, /No photo on file/);
  assert.equal(page.shotPlan.length, 0, 'no street in reach: no frame planned');
});

test('helpers', () => {
  assert.equal(rideUrl(4.88, 52.37), '../index.html?travel=car#race=52.3700,4.8800,52.3700,4.8800,52.3740,4.8800');
  assert.deepEqual(splitModelName('Apollolaan 4 / Stadionweg 5 (Apollohal), Amsterdam-Zuid: 1934 sports hall of brick with a tall glazed upper hall'),
    { name: 'Apollolaan 4 / Stadionweg 5 (Apollohal), Amsterdam-Zuid', description: '1934 sports hall of brick with a tall glazed upper hall' });
  assert.deepEqual(splitModelName('Westerkerk'), { name: 'Westerkerk' });
  assert.equal(kitLabel('Nieuw-West type 1: four/five-storey brick portiekflat, pitched roof, five-bay front (14.4 x 10.5 m)', 'x'), 'Four/five-storey brick portiekflat, pitched roof');
  const d = new FactDeduper();
  assert.equal(d.add('The island was built in 2014 on the Houthaven.'), true);
  assert.equal(d.add('Built in 2014, the island lies in the Houthaven.'), false);
  const at = viewpoint([52.37, 4.88], [[52.3705, 4.88], [52.38, 4.88]]);
  assert.ok(at && Math.abs(at[2] - 180) < 1, 'stands on the street south-facing toward the target');
});
