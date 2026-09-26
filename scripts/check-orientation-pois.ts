import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  basemapOrientationPoiLayerIds,
  basemapSpoilerFilter,
  buildSpoilerIndex,
  DEFAULT_CELL_METRES,
  poiNameSpoils,
  thinOrientationPois,
} from '../src/canalRecall/orientationPois';

const poi = (id: string, lat: number, lng: number, orientationScore = 0, kind = 'local-food') =>
  ({ id, name: id, kind, center: [lat, lng] as [number, number], orientationScore });

// Two venues in the same cell: the better cue survives, the other goes.
const crowded = thinOrientationPois([
  poi('weak', 52.3684, 4.8932, 4),
  poi('strong', 52.36845, 4.89325, 9),
]);
assert.equal(crowded.length, 1);
assert.equal(crowded[0].id, 'strong');

// Far apart, both are useful, both stay.
assert.equal(thinOrientationPois([
  poi('centre', 52.3684, 4.8932, 4),
  poi('west', 52.3684, 4.8600, 4),
]).length, 2);

// Equal cues resolve on id, so the same extract always draws the same map.
const tied = [poi('b', 52.3684, 4.8932, 6), poi('a', 52.36842, 4.89322, 6)];
assert.equal(thinOrientationPois(tied)[0].id, 'a');
assert.equal(thinOrientationPois([...tied].reverse())[0].id, 'a', 'input order must not change the result');

// Only the named kinds are thinned. Albert Heijn is a wayfinding chain drawn
// on its own layer and must not be culled by a restaurant standing nearer.
const mixed = thinOrientationPois([
  poi('shop', 52.3684, 4.8932, 0, 'albert-heijn'),
  poi('food-a', 52.36841, 4.89321, 3),
  poi('food-b', 52.36842, 4.89322, 8),
]);
assert.equal(mixed.length, 2);
assert.deepEqual(mixed.map(item => item.id).sort(), ['food-b', 'shop']);

assert.deepEqual(thinOrientationPois([]), []);

assert.deepEqual(basemapOrientationPoiLayerIds([
  { id: 'road-label', type: 'symbol', 'source-layer': 'transportation_name' },
  { id: 'poi_r1', type: 'symbol', 'source-layer': 'poi' },
  { id: 'poi_r7', type: 'symbol', 'source-layer': 'poi' },
  { id: 'poi-fill', type: 'fill', 'source-layer': 'poi' },
  { id: 'custom-pois', type: 'symbol' },
]), ['poi_r1', 'poi_r7'], 'only the basemap OSM POI symbols become orientation cues');

// The real extract: the point of the exercise is the count on screen.
const extract = JSON.parse(readFileSync(
  path.join(process.cwd(), 'public/data/extracts/amsterdam/branded-pois.json'), 'utf8',
));
const all = Array.isArray(extract) ? extract : extract.features || extract.pois;
const thinned = thinOrientationPois(all);
const food = (list: Array<{ kind: string }>) => list.filter(item => item.kind === 'local-food').length;
assert.ok(food(all) > 1500, `expected a crowded extract, saw ${food(all)}`);

// The number that matters is not the city-wide total but how many compete for
// one screen. This is the Grimburgwal viewport from the report that prompted
// the change: 78 named venues, of which MapLibre drew whichever dozen won the
// collision pass.
const inView = (list: Array<{ kind: string; center: [number, number] }>) => list.filter(item =>
  item.kind === 'local-food'
  && item.center[0] > 52.3655 && item.center[0] < 52.3715
  && item.center[1] > 4.888 && item.center[1] < 4.900).length;
assert.ok(inView(all) > 60, `expected a crowded viewport, saw ${inView(all)}`);
assert.ok(inView(thinned) <= 10,
  `the Grimburgwal viewport should keep a handful of cues, kept ${inView(thinned)}`);
assert.ok(inView(thinned) >= 4,
  `thinning must leave enough to orient by, kept ${inView(thinned)}`);
assert.equal(
  thinned.filter(item => item.kind === 'albert-heijn').length,
  all.filter((item: { kind: string }) => item.kind === 'albert-heijn').length,
  'branded wayfinding stores are never thinned',
);

// --- Answer spoilers --------------------------------------------------------
// Named regressions (UI review 2026-09-26): a "Nassaukade" tram stop at the
// corner of Nassaukade, and a "Majoor Bosshardt" label beside the
// Majoor Bosshardtbrug, both named the answer before the question.
{
  const index = buildSpoilerIndex([
    'Nassaukade', 'Prinsengracht', 'Majoor Bosshardtbrug', 'Leidsegracht',
    'Sint-Jacobsstraat', 'Kerkstraat', 'Dam',
  ]);
  assert.ok(poiNameSpoils('Nassaukade', index), 'a stop named exactly after the street spoils it');
  assert.ok(poiNameSpoils('Café de Prinsengracht', index), 'a venue containing the canal name spoils it');
  assert.ok(poiNameSpoils('Majoor Bosshardt', index), 'the person a bridge is named after spoils the bridge');
  assert.ok(poiNameSpoils('Sint Jacobsstraat 12', index), 'punctuation and house numbers do not hide a match');
  assert.ok(!poiNameSpoils('Leidseplein', index), 'Leidseplein is not Leidsegracht');
  assert.ok(!poiNameSpoils('Westerkerk', index), 'an unrelated landmark stays');
  assert.ok(!poiNameSpoils('Dampkring', index), 'names shorter than 5 letters are not indexed, so Dam spoils nothing');
  assert.ok(!poiNameSpoils('Kerk', index), 'a bare stem shorter than 5 letters is not a spoiler');
  const filter = basemapSpoilerFilter(['==', ['get', 'class'], 'bus'], index) as unknown[];
  assert.equal(filter[0], 'all', 'the basemap layer keeps its own filter');
  const literal = JSON.stringify(filter);
  assert.ok(literal.includes('"sint-jacobsstraat"'), 'raw lower-cased names reach the basemap filter');
  assert.ok(literal.includes('"nassaukade"'));
}

process.stdout.write(
  `Orientation POI checks passed (${food(all)} → ${food(thinned)} city-wide, `
  + `${inView(all)} → ${inView(thinned)} in the Grimburgwal viewport, at ${DEFAULT_CELL_METRES} m cells).\n`,
);
