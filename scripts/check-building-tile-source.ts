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
import { decorateBuildingFeature, loadVerifiedAppearanceCatalog, loadVerifiedAppearancePriors, loadVerifiedAppearanceRelease } from '../src/canalRecall/buildingTilesBrowser.js';
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
assert.ok(fresh.wanted.includes(tileKey(centre)), 'wanted includes the camera tile');
assert.equal(fresh.wanted.length, fresh.load.length, 'a cold cache wants exactly what it loads');

// Second ring is strictly further than the centre — streamers that honour
// this order with bounded concurrency fill the spawn tile before corners.
assert.ok(
  fresh.load.every((tile, index) => {
    if (index === 0) return true;
    const prev = fresh.load[index - 1];
    const prevDist = (prev.x - centre.x) ** 2 + (prev.y - centre.y) ** 2;
    const dist = (tile.x - centre.x) ** 2 + (tile.y - centre.y) ** 2;
    return dist >= prevDist;
  }),
  'load order is non-decreasing distance from the camera tile'
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

// --- immutable appearance bridge into the game ------------------------------
const appearance={version:1,releaseId:'release-a',areaId:'da-costa-study',sourceBlockSha256:'b'.repeat(64),styleSource:'procedural-prior-not-measured',studyRoute:{id:'study',distanceM:790.93,source:'guided-route-source-graph',from:{id:'from',name:'Hugo de Grootkade',lat:52.37,lng:4.87},to:{id:'to',name:'Rozengracht',lat:52.375,lng:4.88}},buildings:[{id:'NL.IMBAG.Pand.0363100012085345',sourceId:'0363100012085345',geometryRevision:'a'.repeat(64),constructionYear:1900,sideColour:'#806451',roofColour:'#756b66',groundColour:'#9a624c',groundFloorHeightM:3.6,roofShape:'source-slanted',roofEavesHeightM:9.5,roofGeometrySource:'3dbag-lod22-roof-surfaces'}]},appearanceBytes=new TextEncoder().encode(JSON.stringify(appearance)),appearanceHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',appearanceBytes))].map(value=>value.toString(16).padStart(2,'0')).join(''),pointer={version:1,releaseId:'release-a',areaId:'da-costa-study',sourceHashes:{block:'b'.repeat(64)},maplibreAppearance:{url:'/appearance.json',sha256:appearanceHash,buildings:1}},fetcher=(async(input:RequestInfo|URL)=>new Response(String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(pointer)))as typeof fetch;
const priors=await loadVerifiedAppearancePriors('/current.json',fetcher);assert.equal(priors.size,1);const release=await loadVerifiedAppearanceRelease('/current.json',fetcher);assert.equal(release.studyRoute.from.name,'Hugo de Grootkade');assert.equal(release.studyRoute.to.name,'Rozengracht');const raw={type:'Feature' as const,properties:{id:'NL.IMBAG.Pand.0363100012085345',height:12},geometry:null},decorated=decorateBuildingFeature(raw,priors);assert.equal(decorated.properties.sideColour,'#806451');assert.equal(decorated.properties.groundColour,'#9a624c');assert.equal(decorated.properties.groundFloorHeightM,3.6);assert.equal(decorated.properties.roofShape,'source-slanted');assert.equal(decorated.properties.roofEavesHeightM,9.5);assert.equal(decorated.properties.appearanceStyleSource,'procedural-prior-not-measured');assert.equal((raw.properties as any).sideColour,undefined,'game decoration never mutates cached complete-city geometry');assert.equal(decorateBuildingFeature({type:'Feature',properties:{id:'outside'},geometry:null},priors).properties.sideColour,undefined,'outside-area buildings retain neutral fallback');
const citywide={type:'Feature' as const,properties:{id:'NL.IMBAG.Pand.0363100099999999',height:11},geometry:null};const citywideDecorated=decorateBuildingFeature(citywide,priors);assert.match(String(citywideDecorated.properties.sideColour),/^#[a-f0-9]{6}$/i);assert.match(String(citywideDecorated.properties.groundColour),/^#[a-f0-9]{6}$/i);assert.match(String(citywideDecorated.properties.roofColour),/^#[a-f0-9]{6}$/i);assert.equal(citywideDecorated.properties.groundFloorHeightM,3.2);assert.equal(citywideDecorated.properties.appearanceStyleSource,'citywide-identity-palette-v2-not-measured');assert.equal(citywideDecorated.properties.groundAppearanceStyleSource,'citywide-ground-storey-palette-v1-not-measured');assert.equal(citywideDecorated.properties.roofAppearanceStyleSource,'citywide-flat-cap-palette-v2-not-measured');assert.equal(decorateBuildingFeature(citywide,priors).properties.sideColour,citywideDecorated.properties.sideColour,'citywide wall palette is stable by BAG identity');assert.equal(decorateBuildingFeature(citywide,priors).properties.groundColour,citywideDecorated.properties.groundColour,'citywide ground palette is stable by BAG identity');assert.equal(decorateBuildingFeature(citywide,priors).properties.roofColour,citywideDecorated.properties.roofColour,'citywide roof palette is stable by BAG identity');assert.equal((citywide.properties as any).sideColour,undefined,'citywide decoration does not mutate cached geometry');const observed={...citywide,properties:{...citywide.properties,colour:'#123456',roofColour:'#654321'}};assert.equal(decorateBuildingFeature(observed,priors),observed,'observed tile colours outrank all citywide display priors');const gabled=decorateBuildingFeature({...citywide,properties:{...citywide.properties,roofShape:'gabled'}},priors);assert.equal(gabled.properties.roofColour,undefined,'unsupported shaped roofs do not receive an invented cap colour');
const corrupt=(async(input:RequestInfo|URL)=>new Response(String(input).includes('appearance.json')?'{}':JSON.stringify(pointer)))as typeof fetch;await assert.rejects(loadVerifiedAppearancePriors('/current.json',corrupt),/hash mismatch/);
const crossAreaPointer={...pointer,areaId:'jordaan-study'},crossArea=(async(input:RequestInfo|URL)=>new Response(String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(crossAreaPointer)))as typeof fetch;await assert.rejects(loadVerifiedAppearanceRelease('/current.json',crossArea),/release binding mismatch/,'an immutable artifact cannot be mounted into a different study area');
const catalog={version:1,areas:[{id:'da-costa-study',name:'Da Costa study',pointerUrl:'/current.json',lesson:true,priority:100}]},catalogFetcher=(async(input:RequestInfo|URL)=>new Response(String(input)==='/areas.json'?JSON.stringify(catalog):String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(pointer)))as typeof fetch,catalogRelease=await loadVerifiedAppearanceCatalog('/areas.json',catalogFetcher);assert.equal(catalogRelease.entries[0].studyRoute.from.name,'Hugo de Grootkade');assert.equal(catalogRelease.priors.size,1);assert.equal(catalogRelease.entries[0].pointerUrl,'/current.json');
const partialCatalog={...catalog,areas:[...catalog.areas,{...catalog.areas[0],id:'second-study',name:'Second study',pointerUrl:'/second.json',priority:90}]},partialFetcher=(async(input:RequestInfo|URL)=>new Response(String(input)==='/areas.json'?JSON.stringify(partialCatalog):String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(String(input)==='/second.json'?{...pointer,areaId:'second-study'}:pointer)))as typeof fetch,partial=await loadVerifiedAppearanceCatalog('/areas.json',partialFetcher);assert.equal(partial.entries.length,1,'one corrupt district does not erase independently verified areas');assert.deepEqual(partial.failures.map(item=>item.id),['second-study']);

process.stdout.write(`Building tile source checks passed (z${BUILDING_TILE_ZOOM}, ${fresh.load.length} tiles for a viewport, budget ${DEFAULT_BUDGET})\n`);
