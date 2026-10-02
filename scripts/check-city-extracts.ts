import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXTRACT_CITIES, cityNamePattern, extractCityById, extractCityFor } from '../src/mapRecall/cityExtracts';

assert.equal(extractCityFor('amsterdam')?.id, 'amsterdam');
assert.equal(extractCityFor('my_location', [52.3702, 4.8952])?.id, 'amsterdam');
assert.equal(extractCityFor('my_location', [52.0907, 5.1214])?.id, 'utrecht');
assert.equal(extractCityFor('my_location', [51.9225, 4.4792])?.id, 'rotterdam');
assert.equal(extractCityFor('my_location', [52.0705, 4.3007])?.id, 'den-haag');
assert.equal(extractCityFor('my_location', [48.8566, 2.3522]), undefined, 'Paris has no extract');
assert.equal(extractCityFor('my_location'), undefined, 'a place with no coordinates has none');
assert.equal(extractCityFor('london', [51.5, -0.12]), undefined);
assert.match("Het Binnenhof ligt in 's-Gravenhage", new RegExp(cityNamePattern(extractCityById('den-haag')!)));

// Each city's box must hold its extract's own centre and its municipality, and boxes must not overlap.
for (const city of EXTRACT_CITIES) {
  const manifest = JSON.parse(readFileSync(`public/data/extracts/${city.id}/manifest.json`, 'utf8'));
  const [lat, lng] = manifest.center;
  assert.equal(extractCityFor('my_location', [lat, lng])?.id, city.id, `${city.id} contains its own centre`);
  const municipality = JSON.parse(readFileSync(`public/data/extracts/${city.id}/boundaries.json`, 'utf8')).find((b: { kind: string }) => b.kind === 'municipality');
  const b = municipality.bounds;
  assert.ok(b.minlat >= city.bbox.minLat - 0.01 && b.maxlat <= city.bbox.maxLat + 0.01 && b.minlon >= city.bbox.minLng - 0.01 && b.maxlon <= city.bbox.maxLng + 0.01, `${city.id} box covers its municipality`);
}
for (const a of EXTRACT_CITIES) for (const b of EXTRACT_CITIES) {
  if (a === b) continue;
  const overlap = a.bbox.minLat < b.bbox.maxLat && a.bbox.maxLat > b.bbox.minLat && a.bbox.minLng < b.bbox.maxLng && a.bbox.maxLng > b.bbox.minLng;
  assert.ok(!overlap, `${a.id} and ${b.id} boxes do not overlap`);
}
console.log('City extract checks passed.');
