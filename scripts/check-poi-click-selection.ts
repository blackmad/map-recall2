import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';

(globalThis as any).window = { CanalRecallGameModules: [] };
const { GameLandmarkRuntime } = await import('../src/canalRecall/game/landmarkRuntime');
const { ThreeBuildings } = await import('../src/canalRecall/threeBuildingsBrowser');
const { buildFeatureChunk } = await import('../src/canalRecall/threeBuildingFeatures');
const poi = { id: 'museum', name: 'Real museum', detail: 'A museum with a researched collection.',
  buildingIds: ['own'], lngLat: [4.9, 52.37], x: 0, y: 0 };
let shown: any = null, active: any = null;
const host: any = { raceTime: 37, player: {}, landmarks: [poi], quizFeedback: 'Follow your route', _prompt: { style: { display: 'block' } }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
  _landmarkNotice: poi, _buildingFacts: { lookup: () => [1895, -1, 0] },
  vectorMap: { inspectBuilding: () => ({ id: 'neighbor', lngLat: [4.900001, 52.370001], featureTarget: null }), setActiveLandmark: (value: any) => { active = value; } },
  _cardForClickedBuilding: GameLandmarkRuntime.prototype._cardForClickedBuilding,
  _showLandmarkNotice: (value: any) => { shown = value; } };
GameLandmarkRuntime.prototype._inspectBuildingAt.call(host, 400, 300);
assert.equal(shown, null, 'an ordinary neighboring house with only a built year gets no card');
assert.equal(active, null, 'ordinary click clears stale highlight');
assert.equal(host._lastDriveByAt, host.raceTime, 'deliberate deselection defers unrelated automatic cards');
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

// Real pitched projection: intersect an upper facade whose ground centroid
// is elsewhere on screen. Hidden replacement geometry cannot swallow it.
const camera = new THREE.PerspectiveCamera(55, 800 / 600, 1, 1000);
camera.position.set(45, 50, 70); camera.lookAt(0, 10, 0); camera.updateMatrixWorld();
const projection = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
const geometry = new THREE.BoxGeometry(16, 28, 12).toNonIndexed();
geometry.translate(0, 14, 0);
geometry.setAttribute('hidden', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
const feature = { properties: { id: 'own', name: 'Museum' }, geometry: { type: 'Polygon', coordinates: [] } };
const picker: any = Object.create(ThreeBuildings.prototype);
Object.assign(picker, { visible: true, ready: true, camera: { projectionMatrix: projection }, THREE,
  hidden: new Set(), map: { unproject: () => ({ lng: 4.9, lat: 52.37 }) },
  chunks: new Map([['one', { mesh, source: [feature], ranges: new Map([['own', { start: 0, count: geometry.getAttribute('position').count }]]) }]]) });
const point = new THREE.Vector3(0, 23, 6).applyMatrix4(projection);
const x = (point.x + 1) / 2 * 800, y = (1 - point.y) / 2 * 600;
assert.equal(picker.inspectAtScreen(x, y, 800, 600)?.id, 'own', 'pitched upper facade picks actual mesh owner');
geometry.getAttribute('hidden').array.fill(1);
assert.equal(picker.inspectAtScreen(x, y, 800, 600), null, 'shader-hidden original does not pick');

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
Object.assign(picker, { look: 'photo', camera: { projectionMatrix: rootProjection },
  chunks: new Map([['wall', { mesh: live, source: [installed], ranges: new Map(built.ranges.map(r => [r.id, { start: r.start, count: r.count }])) }]]) });
(uploaded.getAttribute('position') as any).array = null;
(uploaded.index as any).array = null;
assert.equal(picker.inspectAtScreen(px, py, 800, 600)?.id, 'released', 'GPU-freed positions/indices rebuild with installed look, not requested photo look');
assert.equal(uploaded.getAttribute('position').array, null, 'picking retains original CPU-buffer release');

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
console.log('POI click selection passed: researched owner/card/highlight, generic-year rejection, pitched facade raycast, hidden-mesh and empty-click regressions.');
