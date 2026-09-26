import assert from 'node:assert/strict';
import {
  CANAL_CITIES,
  CANAL_CITY_IDS,
  DEFAULT_CITY_ID,
  cityById,
  extractPath,
  extractUrl,
  parseCityId,
  playableCities,
} from '../src/canalRecall/game/cities.ts';

assert.equal(DEFAULT_CITY_ID, 'amsterdam');
assert.equal(parseCityId('utrecht'), 'utrecht');
assert.equal(parseCityId('nope'), 'amsterdam');
assert.equal(cityById('rotterdam').name, 'Rotterdam');
assert.equal(cityById('den-haag').geocodeSuffix, ', Den Haag');
assert.equal(extractPath('utrecht'), '../data/extracts/utrecht');
assert.ok(extractUrl('amsterdam', 'water.json').includes('/amsterdam/water.json'));
assert.deepEqual(playableCities().map(city => city.id).sort(), [...CANAL_CITY_IDS].sort());
for (const id of CANAL_CITY_IDS) {
  assert.equal(CANAL_CITIES[id].id, id);
  assert.ok(Number.isFinite(CANAL_CITIES[id].center.lat));
  assert.ok(Number.isFinite(CANAL_CITIES[id].center.lng));
  assert.equal(CANAL_CITIES[id].geocodeViewbox.length, 4);
  assert.ok(CANAL_CITIES[id].curatedPois.length >= 5, `${id} needs curated route anchors`);
}

console.log('canal cities: checks passed');
