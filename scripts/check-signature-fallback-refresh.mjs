import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

// Exercise the actual host composer and browser classes without a GPU. The
// resident chunk uses the same hidden vertex attribute as the runtime shader.
const context = vm.createContext({
  window: {
    CanalRecallThree: { THREE },
    CanalRecallSignatureLandmarks: { SIGNATURE_MODELS: [] },
  },
  console,
});
for (const file of ['building-style.bundle.js', 'three-buildings.bundle.js', 'signature-landmarks.bundle.js']) {
  vm.runInContext(fs.readFileSync(`public/canal-drive/js/${file}`, 'utf8'), context, { filename: file });
}
context.window.CanalRecallBuildings = context.CanalRecallBuildings;
context.window.CanalRecallThreeBuildings = context.CanalRecallThreeBuildings;
vm.runInContext(fs.readFileSync('public/canal-drive/js/vector-map.js', 'utf8'), context, { filename: 'vector-map.js' });
const VectorBasemap = vm.runInContext('VectorBasemap', context);

const target = 'NL.IMBAG.Pand.0363100012178460';
const targetOsm = 'w5678';
const neighbor = 'NL.IMBAG.Pand.neighbor';
const loaded = { spec: { id: 'replacement-fixture', suppressOsmIds: [target, targetOsm], spatialSuppression: false } };
const coloredLayers = ['osm-colored-building-ground-floors', 'osm-colored-buildings', 'osm-colored-building-facades', 'osm-colored-building-roofs'];

function fixture({ tiles, style = true, sidecar = [] }) {
  const filters = new Map();
  const writes = [];
  const base = ['==', ['get', 'extrude'], true];
  const map = {
    getStyle: () => style ? {} : null,
    getLayer: id => style && (id === 'building-3d' || coloredLayers.includes(id)),
    getFilter: id => filters.get(id) ?? base,
    setFilter: (id, filter) => { filters.set(id, filter); writes.push(id); },
    addLayer() {},
    triggerRepaint() {},
  };
  const buildings = new context.CanalRecallThreeBuildings.ThreeBuildings(map, {});
  const hidden = new THREE.BufferAttribute(new Uint8Array(4), 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('hidden', hidden);
  buildings.chunks.set('resident', {
    mesh: { geometry, userData: {} },
    ranges: new Map([[target, { start: 0, count: 2 }], [neighbor, { start: 2, count: 2 }]]),
  });
  const signature = new context.CanalRecallSignature3D.SignatureLandmarks(map, {}, { models: [], manageBasemapFilter: false });
  signature._entries = [loaded];
  const host = Object.assign(Object.create(VectorBasemap.prototype), {
    map,
    _threeBuildings: buildings,
    _signatureLandmarks: signature,
    _buildingsFromTiles: tiles,
    _buildings3dEnabled: false,
    _measuredColoursOnly: false,
    _appearanceFeatures: [],
    _appearanceOsmIds: ['w1234'],
    _preencodedBasemapHideIds: sidecar,
    _basemapProximityHideIds: [987],
  });
  return { host, buildings, signature, hidden, filters, writes, base };
}

function assertMask(f, replaced, message) {
  assert.equal(f.buildings.hidden.has(target), replaced, message);
  assert.equal(f.buildings.hiddenBy.get('signature').has(target), replaced, message);
  assert.deepEqual([...f.hidden.array], [Number(replaced), Number(replaced), 0, 0], `${message}: actual vertex mask preserves neighbor`);
  assert.equal(f.buildings.hidden.has(neighbor), false, `${message}: adjacent building remains visible`);
}

for (const options of [{ tiles: true }, { tiles: false, style: false }]) {
  const f = fixture(options);
  f.host._refreshBuildingSuppression();
  assertMask(f, true, 'loaded replacement hides resident fallback');
  f.signature._entries = [];
  f.host._refreshBuildingSuppression();
  assertMask(f, false, 'unavailable replacement restores resident fallback');
  f.signature._entries = [loaded];
  f.host._refreshBuildingSuppression();
  assertMask(f, true, 'reloaded replacement hides fallback again');
  f.signature.enabled = false;
  f.host._refreshBuildingSuppression();
  assertMask(f, false, 'disabled replacements restore fallback');
  assert.equal(f.writes.includes('building-3d'), false, 'tile/no-style path leaves basemap filter untouched');
}

// Preserve both established basemap compositions on the static-extract path.
for (const sidecar of [[], [321]]) {
  const f = fixture({ tiles: false, sidecar });
  f.host._refreshBuildingSuppression();
  assertMask(f, true, 'static extract also refreshes replacement mask');
  assert.equal(f.host._baseBuildingFilter, f.base, 'capture the original basemap filter');
  const expected = context.CanalRecallBuildings.basemapBuildingFilter(
    sidecar.length ? [target, targetOsm] : ['w1234', target, targetOsm], f.base,
    sidecar.length ? [321, 987] : [987],
  );
  assert.deepEqual(f.filters.get('building-3d'), expected, 'preserve extract/sidecar and proximity suppression');
  f.signature._entries = [];
  f.host._refreshBuildingSuppression();
  assertMask(f, false, 'static fallback restores after unload');
  assert.deepEqual(f.filters.get('building-3d'), context.CanalRecallBuildings.basemapBuildingFilter(
    sidecar.length ? [] : ['w1234'], f.base, sidecar.length ? [321, 987] : [987],
  ), 'remove only replacement suppression from basemap composition');
}

console.log('Signature fallback refresh passed: streamed/static/no-style masks, unload/reload, neighbors, and basemap composition.');
