/**
 * POI renames: a recorded rename applies only to its old OSM name at its spot,
 * and the published Amsterdam POIs carry it.
 *
 *   npx tsx scripts/check-poi-renames.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { POI_RENAMES, poiRenameFor, type PoiRename } from '../src/canalRecall/poiRenames.ts';

const sample: PoiRename[] = [{ osm: 'node/1', from: 'Old Name', to: 'New Name', lng: 4.9, lat: 52.37, reported: 'test' }];
assert.equal(poiRenameFor('Old Name', 4.9, 52.37, sample)?.to, 'New Name', 'the old OSM name at its spot is renamed');
assert.equal(poiRenameFor(' old name ', 4.9002, 52.3701, sample)?.to, 'New Name', 'case, spacing and a nudged node still match');
assert.equal(poiRenameFor('Old Name', 4.91, 52.37, sample), undefined, 'a namesake across town is left alone');
assert.equal(poiRenameFor('New Name', 4.9, 52.37, sample), undefined, 'once OSM carries the new name, the entry matches nothing');

// Published extract: every rename shows its new name and not its old one at that spot.
const dir = 'public/data/extracts/amsterdam';
const branded = JSON.parse(fs.readFileSync(`${dir}/branded-pois.json`, 'utf8')) as Array<{ name: string; center: [number, number] }>;
const orientation = JSON.parse(fs.readFileSync(`${dir}/orientation-pois.json`, 'utf8')) as { pois: Array<[string, number, number]> };
const named = [
  ...branded.map(p => ({ name: p.name, lng: p.center[1], lat: p.center[0], file: 'branded-pois' })),
  ...orientation.pois.map(p => ({ name: p[0], lng: p[1], lat: p[2], file: 'orientation-pois' })),
];
for (const rename of POI_RENAMES) {
  const stale = named.filter(p => poiRenameFor(p.name, p.lng, p.lat, [rename]));
  assert.deepEqual(stale.map(p => p.file), [], `${rename.from} (${rename.osm}) still shows its old name; run scripts/apply-poi-renames.ts`);
  const near = named.filter(p => p.name === rename.to && Math.hypot((p.lng - rename.lng) * 68_000, (p.lat - rename.lat) * 110_540) < 40);
  assert.ok(near.length > 0, `${rename.to} is on the map at ${rename.osm}`);
}
console.log(`POI renames: rules hold; ${POI_RENAMES.length} rename(s) published`);
