import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

// Run the actual browser bundle with real geometry math, without a WebGL context.
const context = vm.createContext({ window: { CanalRecallThree: { THREE } }, console });
vm.runInContext(fs.readFileSync('public/canal-drive/js/pyramidal-roofs.bundle.js', 'utf8'), context);
const map = { getLayer: () => false, addLayer() {}, triggerRepaint() {} };
const maplibregl = { MercatorCoordinate: { fromLngLat: () => ({ x: .5, y: .5, z: 0, meterInMercatorCoordinateUnits: () => .00001 }) } };
const roofs = new context.CanalRecallPyramidalRoofs.PyramidalRoofs(map, maplibregl);
const feature = (osmId, id = osmId) => ({ type: 'Feature', properties: { osmId, id, roofShape: 'pyramidal', height: 25, roofHeight: 1, roofColour: '#b7b1a6' }, geometry: { type: 'Polygon', coordinates: [[[4.879,52.356],[4.87907,52.356],[4.87907,52.35604],[4.879,52.35604],[4.879,52.356]]] } });
const features = [feature('w754269608', 'NL.IMBAG.Pand.concert'), feature('neighbor')];
roofs.setFeatures(features);
assert.equal(roofs._entries.length, 2);
assert.ok(roofs._entries.every(e => e.mesh.visible), 'retain fallback before a signature model actually loads');
roofs.setHidden(['w754269608']);
assert.equal(roofs._entries[0].mesh.visible, false, 'loaded model replaces its separate ordinary roof');
assert.equal(roofs._entries[1].mesh.visible, true, 'adjacent roof remains visible');
roofs.setFeatures([...features, feature('new-neighbor')]);
assert.equal(roofs._entries[0].mesh.visible, false, 'streamed feature refresh retains suppression');
assert.equal(roofs._entries[2].mesh.visible, true);
roofs.setHidden(['NL.IMBAG.Pand.concert']);
assert.equal(roofs._entries[0].mesh.visible, false, 'both source identities identify the same roof');
roofs.setHidden([]);
assert.ok(roofs._entries.every(e => e.mesh.visible), 'restore fallback when replacement is disabled or unavailable');

// Exercise the basemap's actual feature-integration method too.
const source = fs.readFileSync('public/canal-drive/js/vector-map.js', 'utf8');
const start = source.indexOf('  _syncPyramidalRoofs(features) {'), end = source.indexOf('\n  // The basemap keeps', start);
assert.ok(start > 0 && end > start);
context.window.CanalRecallPyramidalRoofs = context.CanalRecallPyramidalRoofs;
context.maplibregl = maplibregl;
const Basemap = vm.runInContext(`(class {${source.slice(start, end)}})`, context);
const basemap = new Basemap(); basemap.map = map; basemap._pyramidalRoofs = roofs;
let loadedIds = [];
basemap._signatureSuppressOsmIds = () => loadedIds;
basemap._syncPyramidalRoofs(features);
assert.ok(roofs._entries.every(e => e.mesh.visible));
loadedIds = ['w754269608'];
basemap._syncPyramidalRoofs(features);
assert.equal(roofs._entries[0].mesh.visible, false);
assert.equal(roofs._entries[1].mesh.visible, true);
console.log('Separate pyramidal roofs respect loaded signature replacements, source aliases, streamed refresh, neighbors and fallback restoration.');
