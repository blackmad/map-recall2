/**
 * Does the tile loader fetch the right tiles, and stop fetching?
 *
 * Both failure modes are the kind that look fine in a screenshot and wrong in
 * motion: too few tiles leaves a fringe of missing buildings at the edge of the
 * screen as the camera crosses a boundary, and thrashing refetches the tile
 * behind the car every few seconds while the player drives along an edge.
 */

import assert from 'node:assert/strict';
import { buildingForLandmark,
  BuildingTileCache, BUILDING_TILE_ZOOM, DEFAULT_BUDGET, planSourceDiff, planTiles, tileUrl
} from '../src/canalRecall/buildingTileSource.js';
import { BuildingTileStreamer, decorateBuildingFeature, loadVerifiedAppearanceCatalog, loadVerifiedAppearancePriors, loadVerifiedAppearanceRelease } from '../src/canalRecall/buildingTilesBrowser.js';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles.js';
import { separateNestedBuildings } from '../src/canalRecall/buildingNesting.js';

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
const priors=await loadVerifiedAppearancePriors('/current.json',fetcher);assert.equal(priors.size,1);const release=await loadVerifiedAppearanceRelease('/current.json',fetcher);assert.equal(release.studyRoute.from.name,'Hugo de Grootkade');assert.equal(release.studyRoute.to.name,'Rozengracht');const raw={type:'Feature' as const,properties:{id:'NL.IMBAG.Pand.0363100012085345',height:12},geometry:null},decorated=decorateBuildingFeature(raw,priors);assert.equal(decorated.properties.sideColour,'#806451');assert.equal(decorated.properties.groundColour,'#806451','an unreviewed base must continue the wall, not invent a contrasting storey');assert.equal(decorated.properties.groundFloorHeightM,3.6);assert.equal(decorated.properties.roofShape,'source-slanted');assert.equal(decorated.properties.roofEavesHeightM,9.5);assert.equal(decorated.properties.appearanceStyleSource,'procedural-prior-not-measured');assert.equal((raw.properties as any).sideColour,undefined,'game decoration never mutates cached complete-city geometry');assert.equal(decorateBuildingFeature({type:'Feature',properties:{id:'outside'},geometry:null},priors).properties.sideColour,undefined,'outside-area buildings retain neutral fallback');
const citywide={type:'Feature' as const,properties:{id:'NL.IMBAG.Pand.0363100099999999',height:11},geometry:null};const citywideDecorated=decorateBuildingFeature(citywide,priors);assert.match(String(citywideDecorated.properties.sideColour),/^#[a-f0-9]{6}$/i);assert.match(String(citywideDecorated.properties.groundColour),/^#[a-f0-9]{6}$/i);assert.match(String(citywideDecorated.properties.roofColour),/^#[a-f0-9]{6}$/i);assert.equal(citywideDecorated.properties.groundFloorHeightM,3.2);assert.equal(citywideDecorated.properties.appearanceStyleSource,'citywide-identity-palette-v2-not-measured');assert.equal(citywideDecorated.properties.groundAppearanceStyleSource,'wall-inherited-not-independently-measured');assert.equal(citywideDecorated.properties.roofAppearanceStyleSource,'citywide-flat-cap-palette-v2-not-measured');assert.equal(decorateBuildingFeature(citywide,priors).properties.sideColour,citywideDecorated.properties.sideColour,'citywide wall palette is stable by BAG identity');assert.equal(decorateBuildingFeature(citywide,priors).properties.groundColour,citywideDecorated.properties.groundColour,'citywide ground palette is stable by BAG identity');assert.equal(decorateBuildingFeature(citywide,priors).properties.roofColour,citywideDecorated.properties.roofColour,'citywide roof palette is stable by BAG identity');assert.equal((citywide.properties as any).sideColour,undefined,'citywide decoration does not mutate cached geometry');assert.equal(citywideDecorated.properties.groundColour,citywideDecorated.properties.sideColour,'unobserved citywide bases inherit the wall');const observed={...citywide,properties:{...citywide.properties,colour:'#123456',roofColour:'#654321'}};assert.equal(decorateBuildingFeature(observed,priors),observed,'observed tile colours outrank all citywide display priors');const gabled=decorateBuildingFeature({...citywide,properties:{...citywide.properties,roofShape:'gabled'}},priors);assert.equal(gabled.properties.roofColour,undefined,'unsupported shaped roofs do not receive an invented cap colour');
const corrupt=(async(input:RequestInfo|URL)=>new Response(String(input).includes('appearance.json')?'{}':JSON.stringify(pointer)))as typeof fetch;await assert.rejects(loadVerifiedAppearancePriors('/current.json',corrupt),/hash mismatch/);
const crossAreaPointer={...pointer,areaId:'jordaan-study'},crossArea=(async(input:RequestInfo|URL)=>new Response(String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(crossAreaPointer)))as typeof fetch;await assert.rejects(loadVerifiedAppearanceRelease('/current.json',crossArea),/release binding mismatch/,'an immutable artifact cannot be mounted into a different study area');
const catalog={version:1,areas:[{id:'da-costa-study',name:'Da Costa study',pointerUrl:'/current.json',lesson:true,priority:100}]},catalogFetcher=(async(input:RequestInfo|URL)=>new Response(String(input)==='/areas.json'?JSON.stringify(catalog):String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(pointer)))as typeof fetch,catalogRelease=await loadVerifiedAppearanceCatalog('/areas.json',catalogFetcher);assert.equal(catalogRelease.entries[0].studyRoute.from.name,'Hugo de Grootkade');assert.equal(catalogRelease.priors.size,1);assert.equal(catalogRelease.entries[0].pointerUrl,'/current.json');
const partialCatalog={...catalog,areas:[...catalog.areas,{...catalog.areas[0],id:'second-study',name:'Second study',pointerUrl:'/second.json',priority:90}]},partialFetcher=(async(input:RequestInfo|URL)=>new Response(String(input)==='/areas.json'?JSON.stringify(partialCatalog):String(input).includes('appearance.json')?appearanceBytes:JSON.stringify(String(input)==='/second.json'?{...pointer,areaId:'second-study'}:pointer)))as typeof fetch,partial=await loadVerifiedAppearanceCatalog('/areas.json',partialFetcher);assert.equal(partial.entries.length,1,'one corrupt district does not erase independently verified areas');assert.deepEqual(partial.failures.map(item=>item.id),['second-study']);

// Da Costa startup: probe succeeds while the appearance catalog is still
// loading. A game camera tick must not populate the soon-to-be-replaced source.
const originalFetch = globalThis.fetch;
let tileFetches = 0, writes = 0, announced = 0;
let written: any;
const fakeMap = {
  getSource: () => ({ setData: (data: unknown) => { writes++; written = data; } }),
  getCenter: () => ({ lng: 4.871752, lat: 52.372835 }),
  getZoom: () => 19.55,
  getBounds: () => ({ getWest: () => 4.8717, getEast: () => 4.8718, getSouth: () => 52.3728, getNorth: () => 52.3729 }),
  on: () => {},
};
const streamer = new BuildingTileStreamer(fakeMap, 'buildings', '/test');
try {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('index-z')) return Response.json({ zoom: 14, tileList: ['test'] });
    tileFetches++;
    return Response.json({ type: 'FeatureCollection', features: [raw] });
  }) as typeof fetch;
  assert.equal(await streamer.probe(), true);
  streamer.followCamera();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(tileFetches, 0, 'Da Costa camera ticks before source attachment cannot fetch into the old source');
  assert.equal(writes, 0);
  streamer.attach(() => { announced++; });
  streamer.followCamera();
  for (let turn = 0; turn < 30 && !writes; turn++) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(tileFetches, 1, 'the unchanged camera loads after the replacement source is attached');
  assert.equal(written?.features.length, 1, 'the replacement source receives the resident building');
  assert.equal(announced, 1, 'the visible-building callback runs against the attached source');
} finally {
  streamer.dispose();
  globalThis.fetch = originalFetch;
}

// --- incremental source updates ------------------------------------------
// Named regression (2026-09-28): every tile arrival re-sent and deep-cloned the
// whole resident set (~130 ms at 4× throttle). MapLibre now gets diffs; these
// pin the cases a diff could get silently wrong.
{
  const feature = (id: string) => ({ type: 'Feature' as const, properties: { id }, geometry: null });
  const idOf = (f: { properties: Record<string, unknown> }) => String(f.properties.id);
  const a = [feature('a1'), feature('a2')], b = [feature('b1')], c = [feature('c1')];
  const plan = planSourceDiff(new Map([['A', a], ['B', b]]), new Map([['A', a], ['C', c]]), idOf);
  assert.deepEqual(plan.removeIds, ['b1'], 'a tile that left is removed by its ids');
  assert.deepEqual(plan.addTiles, ['C'], 'a tile that arrived is added; an unchanged one is not resent');
  const refetched = [feature('a1'), feature('a2')];
  const again = planSourceDiff(new Map([['A', a]]), new Map([['A', refetched]]), idOf);
  assert.deepEqual([again.removeIds, again.addTiles], [['a1', 'a2'], ['A']],
    'a tile evicted and re-fetched between flushes (new array, same key) is replaced');
  const idle = planSourceDiff(new Map([['A', a]]), new Map([['A', a]]), idOf);
  assert.deepEqual([idle.removeIds, idle.addTiles], [[], []], 'nothing changed, nothing sent');

  // The streamer: first flush sends the whole set, later arrivals only a diff.
  const sent: Array<{ kind: string; add?: number; remove?: number; total?: number }> = [];
  let bounds = { w: 4.8717, e: 4.8718, s: 52.3728, n: 52.3729 };
  let sourceError: ((event: unknown) => void) | null = null;
  const diffSource = {
    setData: (data: any) => { sent.push({ kind: 'set', total: data.features.length }); },
    updateData: (diff: any) => { sent.push({ kind: 'update', add: diff.add?.length ?? 0, remove: diff.remove?.length ?? 0 }); },
    on: (_type: string, listener: (event: unknown) => void) => { sourceError = listener; },
  };
  const diffMap = {
    getSource: () => diffSource,
    getCenter: () => ({ lng: (bounds.w + bounds.e) / 2, lat: (bounds.s + bounds.n) / 2 }),
    getZoom: () => 19.55,
    getBounds: () => ({ getWest: () => bounds.w, getEast: () => bounds.e, getSouth: () => bounds.s, getNorth: () => bounds.n }),
    on: () => {},
  };
  const diffStreamer = new BuildingTileStreamer(diffMap, 'buildings', '/test');
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('index-z')) return Response.json({ zoom: 14, tileList: ['test'] });
      return Response.json({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: `bldg:${url}` }, geometry: null }] });
    }) as typeof fetch;
    assert.equal(await diffStreamer.probe(), true);
    diffStreamer.attach();
    diffStreamer.followCamera();
    for (let turn = 0; turn < 30 && !sent.length; turn++) await new Promise(resolve => setTimeout(resolve, 0));
    // Cross into the neighbouring z14 tile to the east.
    bounds = { w: 4.8925, e: 4.8926, s: 52.3728, n: 52.3729 };
    diffStreamer.followCamera();
    for (let turn = 0; turn < 30 && sent.length < 2; turn++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(sent[0]?.kind, 'set', 'the first flush sends the whole resident set');
    assert.deepEqual(sent[1], { kind: 'update', add: 1, remove: 0 }, 'a later arrival sends only its own tile');
    // MapLibre reports a rejected diff asynchronously as a source error event.
    assert.ok(sourceError, 'the streamer listens for a rejected diff');
    sourceError!({ error: new Error('GeoJSON data is not compatible with updateData') });
    assert.deepEqual(sent[2], { kind: 'set', total: 2 }, 'a rejected diff resends the whole resident set');
  } finally {
    diffStreamer.dispose();
    globalThis.fetch = savedFetch;
  }

  const cache = new BuildingTileCache();
  cache.adopt('A', a);
  const first = cache.collection().features;
  assert.equal(cache.collection().features, first, 'the resident list is reused until the cache changes');
  cache.adopt('B', b);
  assert.equal(cache.collection().features.length, 3, 'and rebuilt after it does');
}

process.stdout.write(`Building tile source checks passed (z${BUILDING_TILE_ZOOM}, ${fresh.load.length} tiles for a viewport, budget ${DEFAULT_BUDGET})\n`);

{
  // Which building a landmark card is about (user report 2026-09-28).
  const square = (id: string, x: number, y: number, size = 0.0002) => ({
    type: 'Feature' as const,
    properties: { id },
    geometry: { type: 'Polygon', coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] },
  });
  const features = [square('w1', 4.9, 52.37), square('w2', 4.9003, 52.37)];
  const idOf = (feature: { properties: Record<string, unknown> }) => String(feature.properties.id);
  assert.equal(buildingForLandmark(features, { lng: 4.9001, lat: 52.3701 }, idOf), 'w1', 'a node inside a footprint');
  assert.equal(buildingForLandmark(features, { lng: 4.9001, lat: 52.3701, wayId: 'w2' }, idOf), 'w2', 'the landmark\'s own way wins');
  // 0.00005 degrees of latitude past w1's north edge is about 5.6 m: an entrance node.
  assert.equal(buildingForLandmark(features, { lng: 4.9001, lat: 52.37025 }, idOf), 'w1', 'an entrance node on the pavement');
  assert.equal(buildingForLandmark(features, { lng: 4.9001, lat: 52.3705 }, idOf), null, 'nothing within 10 m');
}

{
  // Nested footprints z-fight (Oosterdokskade, user report 2026-09-28).
  const box = (id: string, x: number, y: number, size: number, height: number, minHeight = 0) => ({
    type: 'Feature' as const,
    properties: { id, height, minHeight },
    geometry: { type: 'Polygon', coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] },
  });
  const ring = (feature: { geometry: unknown }) => (feature.geometry as { coordinates: number[][][] }).coordinates[0];
  const outer = box('w1', 4.9, 52.37, 0.0004, 36);
  const sharedWall = box('w2', 4.9, 52.37, 0.0002, 48); // a taller part sharing two walls
  const sameRoof = box('w3', 4.9002, 52.3702, 0.0001, 36.1);
  const beside = box('w4', 4.9005, 52.37, 0.0002, 20);
  const stacked = box('w5', 4.90032, 52.37002, 0.00005, 50, 40); // sits above w1's roof
  const input = [outer, sharedWall, sameRoof, beside, stacked];
  const before = JSON.stringify(input);
  const out = separateNestedBuildings(input);
  assert.equal(JSON.stringify(input), before, 'the input is not mutated');
  assert.equal(out[0], outer, 'the outer building is untouched');
  assert.equal(out[3], beside, 'a neighbour is untouched');
  assert.equal(out[4], stacked, 'a part above the outer roof is untouched');
  assert.equal(out[1].properties.nestedInset, true, 'a contained part is inset');
  assert.ok(ring(out[1])[0][0] > 4.9 && ring(out[1])[0][1] > 52.37, 'its shared corner moves inward');
  const movedMetres = (ring(out[1])[0][1] - 52.37) * 111_320;
  assert.ok(movedMetres > 0.15 && movedMetres < 0.4, `by a few tens of centimetres (${movedMetres.toFixed(2)} m)`);
  assert.equal(out[1].properties.height, 48, 'a clearly taller part keeps its height');
  assert.ok(Math.abs((out[2].properties.height as number) - 35.7) < 1e-9, 'a flush roof drops below the outer roof');
  assert.deepEqual(ring(out[1])[0], ring(out[1])[4], 'the ring stays closed');

  // Two copies of one footprint (BAG pand under an OSM way): only one shrinks.
  const twins = separateNestedBuildings([box('NL.IMBAG.Pand.1', 4.9, 52.37, 0.0002, 20), box('w9', 4.9, 52.37, 0.0002, 20)]);
  assert.equal(twins.filter(feature => feature.properties.nestedInset).length, 1, 'exactly one twin is inset');
}
