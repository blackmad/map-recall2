/**
 * Does the tile loader fetch the right tiles, and stop fetching?
 *
 * Both failure modes are the kind that look fine in a screenshot and wrong in
 * motion: too few tiles leaves a fringe of missing buildings at the edge of the
 * screen as the camera crosses a boundary, and thrashing refetches the tile
 * behind the car every few seconds while the player drives along an edge.
 */

import assert from 'node:assert/strict';
import {
  BuildingTileCache, BUILDING_TILE_ZOOM, DEFAULT_BUDGET, planTiles, tileUrl
} from '../src/canalRecall/buildingTileSource.js';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles.js';

/** A camera over the Nieuwmarkt, roughly what a driving viewport spans. */
const view = { west: 4.895, south: 52.369, east: 4.906, north: 52.376 };

// --- the margin --------------------------------------------------------------
const fresh = planTiles(view, []);
const centre = tileFor(4.9005, 52.3725, BUILDING_TILE_ZOOM);
assert.ok(fresh.load.length >= 9, `a viewport loads its tile and a ring of neighbours (${fresh.load.length})`);
assert.ok(fresh.load.some(tile => tile.x === centre.x && tile.y === centre.y), 'the tile under the camera is loaded');
for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
  assert.ok(
    fresh.load.some(tile => tile.x === centre.x + dx && tile.y === centre.y + dy),
    `the diagonal neighbour ${dx},${dy} is loaded, because a building near a corner reaches into it`
  );
}
assert.deepEqual(fresh.evict, [], 'nothing is evicted when nothing is held');

// Nearest first: the tile under the camera must arrive before its neighbours,
// or the player drives into a hole while the corners load.
assert.deepEqual(
  { x: fresh.load[0].x, y: fresh.load[0].y }, { x: centre.x, y: centre.y },
  'the tile under the camera is fetched first'
);

// --- holding what is already held --------------------------------------------
const held = fresh.load.map(tileKey);
const again = planTiles(view, held);
assert.deepEqual(again.load, [], 'a stationary camera loads nothing twice');
assert.deepEqual(again.evict, [], 'a stationary camera evicts nothing');

// --- hysteresis --------------------------------------------------------------
// Drive east by about one tile. The tiles behind must survive, or driving along
// a boundary refetches them forever.
const moved = { west: view.west + 0.022, south: view.south, east: view.east + 0.022, north: view.north };
const afterMove = planTiles(moved, held);
assert.ok(afterMove.load.length > 0, 'moving into new ground loads new tiles');
assert.deepEqual(afterMove.evict, [], `nothing is evicted while inside the budget (held ${held.length}, budget ${DEFAULT_BUDGET})`);

// --- the budget --------------------------------------------------------------
// A long drive fills the cache; eviction must then drop the furthest tiles and
// never one the camera still needs.
let cache = [...held];
for (let step = 1; step <= 12; step++) {
  const window = { west: view.west + 0.022 * step, south: view.south, east: view.east + 0.022 * step, north: view.north };
  const plan = planTiles(window, cache);
  const wanted = new Set(planTiles(window, []).load.map(tileKey));
  for (const key of plan.evict) {
    assert.ok(!wanted.has(key), `eviction never drops a tile the camera needs (${key} at step ${step})`);
  }
  cache = cache.filter(key => !plan.evict.includes(key)).concat(plan.load.map(tileKey));
  assert.ok(cache.length <= DEFAULT_BUDGET, `the cache stays inside its budget (${cache.length} at step ${step})`);
}

// A budget smaller than the visible set must not blink visible buildings out.
const tiny = planTiles(view, held, { budget: 2 });
const needed = new Set(planTiles(view, []).load.map(tileKey));
for (const key of tiny.evict) assert.ok(!needed.has(key), 'a too-small budget still never evicts a visible tile');

// --- urls --------------------------------------------------------------------
assert.equal(
  tileUrl({ z: 14, x: 8414, y: 5384 }, '../data/extracts/amsterdam'),
  '../data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz',
  'tile urls match the gzipped layout the build writes'
);
assert.equal(
  tileUrl({ z: 14, x: 8414, y: 5384 }, '../data/extracts/amsterdam/'),
  '../data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz',
  'a trailing slash on the base does not double up'
);

// --- the cache ---------------------------------------------------------------
const cacheStore = new BuildingTileCache();
cacheStore.adopt('14/1/1', [{ type: 'Feature', properties: { id: 'a' }, geometry: null }]);
cacheStore.adopt('14/1/2', [{ type: 'Feature', properties: { id: 'b' }, geometry: null }]);
assert.equal(cacheStore.collection().features.length, 2, 'the source is every held tile at once');
cacheStore.drop('14/1/1');
assert.equal(cacheStore.collection().features.length, 1, 'dropping a tile removes its features');
assert.ok(!cacheStore.has('14/1/1') && cacheStore.has('14/1/2'), 'the cache knows what it holds');

process.stdout.write(`Building tile source checks passed (z${BUILDING_TILE_ZOOM}, ${fresh.load.length} tiles for a viewport, budget ${DEFAULT_BUDGET})\n`);
