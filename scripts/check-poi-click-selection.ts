import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';

(globalThis as any).window = { CanalRecallGameModules: [] };
const { GameLandmarkRuntime } = await import('../src/canalRecall/game/landmarkRuntime');
const { ThreeBuildings } = await import('../src/canalRecall/threeBuildingsBrowser');
const { buildFeatureChunk } = await import('../src/canalRecall/threeBuildingFeatures');
const { manualPoiBuildingIds, mergeManualPoiFeatures } = await import('../src/canalRecall/game/manualPoiCatalog');
const { buildLandmarks } = await import('../src/canalRecall/game/landmarkData');
const { ClickPoiIndex } = await import('../src/canalRecall/clickPoiInfo');
const poi = { id: 'museum', name: 'Real museum', detail: 'A museum with a researched collection.',
  buildingIds: ['own'], lngLat: [4.9, 52.37], x: 0, y: 0 };
let shown: any = null, active: any = null;
const host: any = { raceTime: 37, player: {}, landmarks: [poi], quizFeedback: 'Follow your route', _prompt: { style: { display: 'block' } }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
  _landmarkNotice: poi, _buildingFacts: { lookup: () => [1895, -1, 0] },
  vectorMap: { inspectBuilding: () => ({ id: 'neighbor', lngLat: [4.900001, 52.370001], featureTarget: null }), setActiveLandmark: (value: any) => { active = value; } },
  _cardForClickedBuilding: GameLandmarkRuntime.prototype._cardForClickedBuilding,
  _showLandmarkNotice: (value: any) => { shown = value; } };
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
// Every drawn building answers a click (user report 2026-10-10): the
// neighbouring house opens its own register card, never the museum's.
assert.equal(shown?.name, 'Built 1895', 'an ordinary neighbouring house tells its own year');
assert.equal(shown?.id, 'clicked-neighbor');
assert.equal(active?.id, 'clicked-neighbor', 'the highlight moves to the clicked house');
host.vectorMap.inspectBuilding = () => null;
shown = null;
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown, null, 'a click on open ground opens nothing');
assert.equal(active, null, 'open-ground click clears stale highlight');
assert.equal(host._lastDriveByAt, host.raceTime, 'deliberate deselection defers unrelated automatic cards');
// An address-named street-chunk pand must not print the street it stands on.
host.vectorMap._spoils = (name: string) => /Prinsengracht/.test(name);
host.vectorMap.inspectBuilding = () => ({ id: 'pand', name: 'Prinsengracht 263', lngLat: [4.88, 52.37], featureTarget: null });
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown?.name, 'Built 1895', 'a spoiling address is not the title');
assert.doesNotMatch(`${shown?.name} ${shown?.detail}`, /Prinsengracht/);
delete host.vectorMap._spoils;
host.vectorMap.inspectBuilding = () => ({ id: 'own', lngLat: [4.9, 52.37], featureTarget: null });
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown.id, 'museum', 'exact POI owner gets its researched card');
assert.equal(active.id, 'museum', 'card and highlight are one eligible transaction');
assert.equal(host.quizFeedback, '', 'explicit card request clears lingering feedback that would hide it');
assert.equal(host._prompt.style.display, 'none', 'post-answer prompt cannot cover the requested card');
const otherVenue = { ...poi, id: 'second-venue', name: 'Another venue in the same building' };
host.landmarks = [poi, otherVenue];
host.vectorMap.inspectBuilding = () => ({ id: 'own', landmarkId: otherVenue.id, lngLat: [4.9, 52.37], featureTarget: null });
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown.id, otherVenue.id, 'explicit venue/pin identity wins over a shared building owner');

// The gate is an additive facade asset on a much larger mall Pand. Recreate
// the stale published containment join and the delayed-extract merge, then
// click each physical identity through the real card/highlight transaction.
const gateId = 'extract_landmarks_953524097', hostId = 'NL.IMBAG.Pand.0363100012165086';
const joins = JSON.parse(readFileSync('public/data/extracts/amsterdam/landmark-buildings.json', 'utf8')).buildings;
assert(joins[gateId].includes(hostId), 'regression includes the real problematic containment join');
const merged = mergeManualPoiFeatures([{ id: gateId, name: 'Rasphuispoort', center: [52.3677408, 4.8910535], buildingIds: [hostId] }]);
const gate = buildLandmarks(merged, (lat, lng) => ({ x: lng, y: lat })).find(row => row.id === gateId)!;
assert.deepEqual(gate.buildingIds, [], 'initial manual merge cannot claim the additive host');
gate.buildingIds = manualPoiBuildingIds(gate.id, [...gate.buildingIds!, ...joins[gate.id]]);
assert.deepEqual(gate.buildingIds, [], 'late published join cannot reclaim the additive host');
const footprint: any = { type: 'Polygon', coordinates: [[[4.891,52.367],[4.892,52.367],[4.892,52.368],[4.891,52.368],[4.891,52.367]]] };
const tile = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString());
const installedHost = tile.features.find((feature: any) => feature.properties.id === hostId);
const mappedIndex = new ClickPoiIndex(JSON.parse(readFileSync('public/data/extracts/amsterdam/click-poi-info.json', 'utf8')));
assert(mappedIndex.contained(installedHost.geometry).some(row => row[0] === 'w266908024'), 'real mapped mall lies in the actual installed footprint');
assert.match(mappedIndex.card({id:hostId,footprint:installedHost.geometry,lngLat:[0,0],featureTarget:null})!.name, /^Kalverpassage/, 'real footprint names the complex before its tenants');
host.landmarks = [gate];
host._clickPoiInfo = new ClickPoiIndex({version: 1, source: 'OSM', points: [
  ['n1','Tenant shop',4.8915,52.3675,'shop','a shop','','https://example.com',''],
  ['w266908024','Kalverpassage',4.891631866666667,52.3674059,'shop','a mall','Singel 457','https://www.kalverpassage.nl/',''],
]});
host.vectorMap.inspectBuilding = () => ({ id: hostId, footprint, lngLat: [4.8916,52.3674], featureTarget: {source:'osm-building-appearance',id:hostId} });
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown.name, 'Kalverpassage + 1 mapped places', 'host roof receives mall information, with tenant retained');
assert.equal(active.featureTarget.id, hostId, 'mall card highlight belongs to the clicked host');
assert.notEqual(shown.id, gateId, 'host roof cannot substitute the contained gate');
host.vectorMap.inspectBuilding = () => ({ id: 'rasphuispoort', landmarkId: gateId, lngLat: gate.lngLat, featureTarget: null });
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown.id, gateId, 'exact additive gate mesh and pin retain the researched gate card');
assert.deepEqual(active.buildingIds, [], 'selected gate never highlights the entire host');

// Deliberate information requests are opaque on their first frame; automatic
// proximity cards still use their existing fade.
const noticeHost: any = { raceTime: 37, _withRotatedFact: (value: any) => value,
  _ensureLandmarkImage: () => {}, vectorMap: { setActiveLandmark: () => {} } };
GameLandmarkRuntime.prototype._showLandmarkNotice.call(noticeHost, poi, { kind: 'sticky' }, 'click');
assert.equal(noticeHost._landmarkNoticeAlpha, 1, 'clicked card is immediately readable');
const { advanceNotice, DEFAULT_NOTICE_CONFIG } = await import('../src/canalRecall/game/landmarkNotice');
assert.equal(noticeHost._landmarkNoticeState.elapsed, DEFAULT_NOTICE_CONFIG.fadeSeconds);
assert.equal(advanceNotice(noticeHost._landmarkNoticeState, { kind: 'sticky' }, null, .01).alpha, 1);
GameLandmarkRuntime.prototype._showLandmarkNotice.call(noticeHost, poi, { kind: 'sticky' }, 'drive-by');
assert.equal(noticeHost._landmarkNoticeAlpha, 0, 'automatic card keeps its fade-in');
assert.equal(noticeHost._landmarkNoticeState.elapsed, 0);

// Real pitched projection on an installed chunk whose CPU buffers were
// released after upload: intersect an upper facade whose ground centroid is
// elsewhere on screen. The click resolves through the footprint prism index
// (`prismPick.ts`) without rebuilding the chunk (that cost ~2 s per click,
// 2026-10-10), and hidden replacement geometry cannot swallow it.
const installed: any = { properties: { id: 'released', height: 20, minHeight: 0, building: 'yes' },
  geometry: { type: 'Polygon', coordinates: [[[4.8999, 52.3699], [4.9001, 52.3699], [4.9001, 52.3701], [4.8999, 52.3701], [4.8999, 52.3699]]] } };
const built = buildFeatureChunk([installed], 'untextured', 'walls');
const uploaded = new THREE.BufferGeometry();
uploaded.setAttribute('position', new THREE.BufferAttribute(built.positions, 3));
uploaded.setAttribute('hidden', new THREE.Uint8BufferAttribute(new Uint8Array(built.vertexCount), 1));
uploaded.setIndex(new THREE.BufferAttribute(built.indices, 1)); uploaded.computeBoundingSphere();
const live = new THREE.Mesh(uploaded, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
live.userData.installedLook = 'untextured';
const rootCamera = new THREE.PerspectiveCamera(55, 800 / 600, 1, 1000);
rootCamera.up.set(0, 0, 1); rootCamera.position.set(45, -50, 60); rootCamera.lookAt(0, 0, 10); rootCamera.updateMatrixWorld();
const rootProjection = rootCamera.projectionMatrix.clone().multiply(rootCamera.matrixWorldInverse);
const facade = new THREE.Vector3(0, -11, 12).applyMatrix4(rootProjection);
const px = (facade.x + 1) * 400, py = (1 - facade.y) * 300;
const picker: any = Object.create(ThreeBuildings.prototype);
Object.assign(picker, { visible: true, ready: true, THREE, look: 'photo', hidden: new Set(), pickIndex: new WeakMap(),
  map: { unproject: () => ({ lng: 4.9, lat: 52.37 }) }, camera: { projectionMatrix: rootProjection },
  chunks: new Map([['wall', { mesh: live, source: [installed], ranges: new Map(built.ranges.map(r => [r.id, { start: r.start, count: r.count }])) }]]) });
(uploaded.getAttribute('position') as any).array = null;
(uploaded.index as any).array = null;
assert.equal(picker.inspectAtScreen(px, py, 800, 600)?.id, 'released', 'pitched upper facade picks its building with GPU-freed buffers');
assert.equal(uploaded.getAttribute('position').array, null, 'picking retains original CPU-buffer release');
const centre = new THREE.Vector3(0, 0, 0).applyMatrix4(rootProjection);
assert.equal(picker.inspectAtScreen((centre.x + 1) * 400 + 300, (1 - centre.y) * 300, 800, 600), null, 'open ground beside it picks nothing');
(uploaded.getAttribute('hidden').array as Uint8Array).fill(1);
assert.equal(picker.inspectAtScreen(px, py, 800, 600), null, 'shader-hidden original does not pick');
(uploaded.getAttribute('hidden').array as Uint8Array).fill(2);
assert.equal(picker.inspectAtScreen(px, py, 800, 600)?.id, 'released', 'the highlighted (yellow) building stays clickable');

// Execute the shipped JS adapter, including setRoute: misplaced picker
// guards previously referenced poiResult from an unrelated method.
const sandbox: any = { window: {}, console, Set, Map };
runInNewContext(readFileSync('public/canal-drive/js/vector-map.js', 'utf8') + '\nthis.VectorBasemap = VectorBasemap;', sandbox);
const v: any = Object.create(sandbox.VectorBasemap.prototype);
Object.assign(v, { _completeCityHasBuildings: true, _threeBuildings: { ready: true }, map: {
  getSource: () => ({ setData() {} }), getLayer: () => null, getCanvas: () => ({ clientWidth: 800, clientHeight: 600 }),
  getStyle: () => ({ layers: [] }), unproject: () => ({ lng: 4.9, lat: 52.37 }) }, ready: true });
assert.doesNotThrow(() => v.setRoute(null, {}, false), 'route updates cannot reference picker-local variables');
assert.equal(v.inspectBuilding(400, 300, { width: 800, height: 600 }), null, 'empty complete-city click has no arbitrary fallback');
console.log('POI click selection passed: researched owner/card/highlight, own-year card for every building, spoiler-safe addresses, pitched facade prism pick, hidden-mesh and empty-click regressions.');
