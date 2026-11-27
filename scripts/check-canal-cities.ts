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
assert.equal(parseCityId('nope'), 'amsterdam');
// Amsterdam only (David, 2026-11-27): a stored or linked Utrecht, Rotterdam or Den Haag rides Amsterdam, and no loader
// can reach their extracts through the catalogue. Their entries (and extracts) stay for a later own-engine return.
for (const id of ['utrecht', 'rotterdam', 'den-haag'] as const) {
  assert.equal(parseCityId(id), 'amsterdam', `${id} is not playable`);
  assert.equal(cityById(id).id, 'amsterdam', `${id} resolves to Amsterdam`);
  assert.equal(extractPath(id), '../data/extracts/amsterdam', `${id} cannot reach its extract`);
  assert.ok(!extractUrl(id, 'water.json').includes(`/${id}/`), `${id} extract URL`);
  assert.equal(CANAL_CITIES[id].playable, false);
}
assert.equal(CANAL_CITIES.rotterdam.name, 'Rotterdam', 'the catalogue entry is kept');
assert.ok(extractUrl('amsterdam', 'water.json').includes('/amsterdam/water.json'));
assert.deepEqual(playableCities().map(city => city.id), ['amsterdam']);
for (const id of CANAL_CITY_IDS) {
  assert.equal(CANAL_CITIES[id].id, id);
  assert.ok(Number.isFinite(CANAL_CITIES[id].center.lat));
  assert.ok(Number.isFinite(CANAL_CITIES[id].center.lng));
  assert.equal(CANAL_CITIES[id].geocodeViewbox.length, 4);
  assert.ok(CANAL_CITIES[id].curatedPois.length >= 5, `${id} needs curated route anchors`);
}

console.log('canal cities: checks passed');
