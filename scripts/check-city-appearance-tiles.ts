import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compileAppearanceTiles, appearanceOwner, appearanceOwnerDependencies,
  AppearanceResourceCache, appearanceLod, planAppearanceTiles,
  type AppearanceBuilding, type AppearanceObservation,
} from '../src/canalRecall/cityAppearanceTiles.js';
import { tileFor, tileKey, tileBounds } from '../src/canalRecall/slippyTiles.js';
import { compileBlockAppearance } from './city-appearance/compile-block-tiles.js';

const tile = tileFor(4.87355, 52.3723, 14);
const [west, south, east, north] = tileBounds(tile);
const lat = (south + north) / 2;
const building = (id: string, offset: number): AppearanceBuilding => ({
  id, geometryRevision: `geometry-${id}`,
  footprint: { type: 'Polygon', coordinates: [[
    [east - .0002 + offset, lat - .0001], [east + .0001 + offset, lat - .0001],
    [east + .0001 + offset, lat + .0001], [east - .0002 + offset, lat + .0001], [east - .0002 + offset, lat - .0001],
  ]] }, geometry: { original: 'unclipped source', surfaceIndices: [0, 1, 2] },
});
const a = building('bag-a', 0), b = building('bag-b', .0003);
const observation: AppearanceObservation = { id: 'frontage-stable', buildingId: a.id, geometryRevision: a.geometryRevision, evidenceKey: 'source-packet-a', payload: { roof: 'unknown', review: null } };
const snapshot = JSON.stringify({ a, b, observation });
const first = compileAppearanceTiles([a, b], [observation]);
assert.equal(appearanceOwner(a), tileKey(tile));
assert.notEqual(appearanceOwner(a), appearanceOwner(b));
assert.deepEqual(first, compileAppearanceTiles([b, a], [observation]), 'input order does not change output');
assert.equal(JSON.stringify({ a, b, observation }), snapshot, 'canonical source records remain unchanged');
assert.equal(first.tiles.flatMap(tile => tile.owners).length, 2, 'boundary building has one render owner');
assert.equal(first.tiles.flatMap(tile => tile.owners.flatMap(owner => owner.observations)).length, 1);
const ownerA = first.tiles.find(tile => tile.key === appearanceOwner(a))!;
assert.deepEqual(ownerA.owners[0].geometry, a.geometry);
assert.deepEqual(ownerA.owners[0].footprint, a.footprint, 'ownership never clips footprint');
assert.ok(ownerA.halo.some(ref => ref.buildingId === b.id), 'neighbour available for adjacency');
assert.deepEqual(appearanceOwnerDependencies([ownerA], [ownerA.key]), [appearanceOwner(b)]);
assert.deepEqual(appearanceOwnerDependencies([ownerA], [ownerA.key, appearanceOwner(b)]), []);
const shifted = { ...a, footprint: b.footprint, geometryRevision: 'new-geometry' };
assert.equal(compileAppearanceTiles([shifted], [{ ...observation, geometryRevision: shifted.geometryRevision }]).tiles.flatMap(tile => tile.owners)[0].observations[0].id, observation.id, 'moving owner never renames frontage');
assert.throws(() => compileAppearanceTiles([shifted], [observation]), /Unbound observation/);
assert.throws(() => compileAppearanceTiles([a, a], []), /duplicate building/);
assert.throws(() => compileAppearanceTiles([a], [observation, observation]), /duplicate observation/);
assert.throws(() => compileAppearanceTiles([a], [{ ...observation, buildingId: 'absent' }]), /Unbound observation/);
assert.throws(() => compileAppearanceTiles([a], [{ ...observation, evidenceKey: '' }]), /Unbound observation/);
assert.throws(() => compileAppearanceTiles([a], [], { halo: -1 }), /Invalid tile/);
assert.throws(() => appearanceOwner({ ...a, footprint: { type: 'Polygon', coordinates: [[[120000, 480000], [1, 2], [3, 4], [120000, 480000]]] } }), /Non-geographic/);
const withHole = structuredClone(a);
if (withHole.footprint.type === 'Polygon') withHole.footprint.coordinates.push([
  [east - .0001, lat - .00005], [east - .00005, lat - .00005], [east - .00005, lat + .00005],
  [east - .0001, lat + .00005], [east - .0001, lat - .00005],
]);
assert.deepEqual(compileAppearanceTiles([withHole], []).tiles.flatMap(tile => tile.owners)[0].footprint, withHole.footprint, 'holes preserved');

const released: string[] = [];
const cache = new AppearanceResourceCache<{ revision: number }>(2, (value, key) => released.push(`${key}:${value.revision}`));
cache.adopt('a', { revision: 1 }); cache.adopt('b', { revision: 1 }); cache.touch('a');
cache.adopt('c', { revision: 1 });
assert.deepEqual(cache.keys, ['a', 'c']);
assert.deepEqual(released, ['b:1'], 'least-recently-used GPU resource released');
assert.equal(cache.canAdopt('d', new Set(['a', 'c'])), false);
assert.equal(cache.adopt('d', { revision: 1 }, new Set(['a', 'c'])), false, 'required resources never silently evicted');
assert.equal(cache.size, 2, 'hard resident cap');
cache.adopt('a', { revision: 2 });
const same = cache.get('a')!;
cache.adopt('a', same);
assert.deepEqual(released, ['b:1', 'a:1'], 'identical re-adoption does not dispose live resource');
cache.clear(); cache.clear();
assert.deepEqual(released, ['b:1', 'a:1', 'c:1', 'a:2'], 'eviction/disposal occurs exactly once');

assert.equal(appearanceLod(20), 'detail');
assert.equal(appearanceLod(90, 'detail'), 'detail');
assert.equal(appearanceLod(100, 'detail'), 'facade');
assert.equal(appearanceLod(70, 'facade'), 'facade');
assert.equal(appearanceLod(60, 'facade'), 'detail');
assert.equal(appearanceLod(260, 'facade'), 'facade');
assert.equal(appearanceLod(270, 'facade'), 'massing');
assert.equal(appearanceLod(240, 'massing'), 'massing');
assert.equal(appearanceLod(230, 'massing'), 'facade');
assert.equal(appearanceLod(1, 'massing'), 'detail', 'teleport bypasses intermediate LOD');
assert.throws(() => appearanceLod(NaN), /Invalid camera/);
const plan = planAppearanceTiles({ west, south, east: east - 1e-9, north: north - 1e-9 }, []);
assert.ok(plan.wanted.includes(tileKey(tile)) && plan.wanted.includes(appearanceOwner(b)), 'existing planner includes ownership halo');

const block = JSON.parse(await readFile('public/data/da-costa-block/block.json', 'utf8'));
const neighbourhood = JSON.parse(await readFile('public/data/da-costa-block/neighbourhood.json', 'utf8'));
const fixture = compileBlockAppearance(block, neighbourhood);
const fineFixture = compileBlockAppearance(block, neighbourhood, { zoom: 16, halo: 1 });
assert.equal(fineFixture.zoom, 16, 'area publishers can use finer owner tiles');
assert.equal(fineFixture.tiles.flatMap(tile => tile.owners).length, block.buildings.length, 'fine tiles preserve exactly one owner per building');
assert.equal(fixture.buildings, block.buildings.length);
assert.equal(fixture.observations, neighbourhood.records.length);
const owners = fixture.tiles.flatMap(tile => tile.owners);
assert.equal(new Set(owners.map(owner => owner.id)).size, owners.length);
const records = owners.flatMap(owner => owner.observations);
assert.equal(new Set(records.map(record => record.id)).size, neighbourhood.records.length);
for (const record of records) {
  assert.deepEqual(record.payload, neighbourhood.records.find((candidate: { id: string }) => candidate.id === record.id), 'staging retains unknowns, provenance and review status');
}
const changed = structuredClone(block);
changed.buildings[0].surfaces[0].rings[0][0][1] += .01;
assert.throws(() => compileBlockAppearance(changed, neighbourhood), /Stale source geometry/, 'never silently rebind old roof diagnostics');
const updated = compileBlockAppearance(changed, { records: [] }).tiles.flatMap(tile => tile.owners);
assert.notEqual(updated.find(owner => owner.id === block.buildings[0].id)!.geometryRevision, owners.find(owner => owner.id === block.buildings[0].id)!.geometryRevision);
assert.equal(updated.find(owner => owner.id === block.buildings[1].id)!.geometryRevision, owners.find(owner => owner.id === block.buildings[1].id)!.geometryRevision, 'unrelated building revision unchanged');
console.log(`City appearance tiles: ownership, halo, source binding, LOD and bounded disposal passed; ${fixture.buildings} buildings / ${fixture.observations} observations / ${fixture.tiles.length} tiles.`);
