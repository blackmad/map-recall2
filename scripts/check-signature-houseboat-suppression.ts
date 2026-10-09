/** Real adapter/chunk geometry and visibility attributes; no GPU, asset load,
 * visual acceptance or native performance claim. Native cached OSM footprints. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { houseboatsByTile, type Houseboat } from '../src/canalRecall/houseboats';
import type { Feature } from '../src/canalRecall/threeBuildingFeatures';
import source from './landmarks/sea-palace-footprints.json';

(globalThis as any).document = { currentScript: { src: 'https://example.test/three-buildings.bundle.js' } };
(globalThis as any).window = { matchMedia: () => ({ matches: false }) };
const { ThreeBuildings } = await import('../src/canalRecall/threeBuildingsBrowser');
let repaints = 0;
const map = { triggerRepaint() { repaints++; }, getZoom: () => 18 };
const adapter: any = new ThreeBuildings(map as any, {} as any, 'photo');
adapter.THREE = THREE; adapter.scene = new THREE.Scene(); adapter.ready = true;
adapter.material = new THREE.ShaderMaterial({ uniforms: {
  cells: { value: null }, masks: { value: null }, bands: { value: 0 }, flatColour: { value: 0 },
} });
adapter.worker = null;
const flush = () => { while (adapter.pending.length) adapter.pending.shift()(); };
adapter.pump = flush;
const { boats }: { boats: Houseboat[] } = JSON.parse(readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const target = boats.find(b => b.id === 'w454006714')!;
assert(target);
assert.deepEqual(target.ring, source.houseboatRepresentation.ring);
const grouped = houseboatsByTile(boats);
const tile = [...grouped].find(([, list]) => list.some(b => b.id === target.id))![0];
const selected = grouped.get(tile)!;
assert(selected.length > 1, 'real same-tile boat neighbors exercise exact suppression');
const ordinary: Feature[] = JSON.parse(gunzipSync(readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${tile}.geojson.gz`)).toString()).features.slice(0, 2);
const targetFeature = { ...source.nativeFootprint, properties: { ...source.nativeFootprint.properties, id: target.id } } as Feature;
const features = [...ordinary, targetFeature];
// Signature availability may arrive before the independent boat extract.
adapter.setHidden('signature', [target.id]);
adapter.setFeatures(features);
adapter.setHouseboats(selected);
const key = `boats:${tile}`;
const entry = () => adapter.chunks.get(key);
assert(entry()?.ranges.has(target.id), 'native boat geometry retains its real extract identity');
const flag = (id: string) => {
  const e = entry(), range = e.ranges.get(id);
  assert(range, `expected actual boat vertex range ${id}`);
  return Array.from(e.mesh.geometry.getAttribute('hidden').array.slice(range.start, range.start + range.count));
};
const expectHidden = (value: number) => assert(flag(target.id).every(v => v === value));
expectHidden(1);
for (const boat of selected) if (boat.id !== target.id) assert(flag(boat.id).every(v => v === 0), 'nearby boats remain visible');
assert.equal(adapter.boatForLandmark(source.identity.poiCoordinateLonLat, 'restaurant'), target.id, 'card lookup keeps full source boats');
assert(adapter.boatIds.has(target.id));
for (const [chunkKey, e] of adapter.chunks) if (!chunkKey.startsWith('boats:')) assert(!e.ranges.has(target.id), 'ordinary duplicate remains excluded');
const original = new Map(adapter.chunks);
const pos = Array.from(entry().mesh.geometry.getAttribute('position').array);
// Runtime visibility setter updates existing attributes, without rebuilding any
// boat or ordinary geometry on model availability callbacks.
adapter.setHidden('signature', []); expectHidden(0);
adapter.setHidden('signature', [target.id]); expectHidden(1);
for (const [k, e] of original) assert.equal(adapter.chunks.get(k), e);
assert.deepEqual(Array.from(entry().mesh.geometry.getAttribute('position').array), pos);
const priorRepaints = repaints;
adapter.setHidden('signature', [target.id, target.id]);
assert.equal(repaints, priorRepaints, 'unchanged IDs no-op');
adapter.setHidden('signature', ['w454006714-alias']); expectHidden(0);
adapter.setHidden('signature', [target.id]); expectHidden(1);
adapter.setHidden('other-reason', [target.id]);
adapter.setHidden('signature', []); expectHidden(1);
adapter.setHidden('other-reason', []); expectHidden(0);
// An install queued before an availability change applies the latest hidden set.
adapter.pump = () => {};
adapter.setFeatures([]);
adapter.setFeatures(features);
adapter.setHidden('signature', [target.id]);
flush(); expectHidden(1);
adapter.pump = flush;
// Actual look transition, with textures supplied without canvas/GPU allocation.
adapter.textureSets.set('procedural', Promise.resolve({ colour: { userData: { bytes: 0 } }, mask: { userData: { bytes: 0 } } }));
await adapter.setLook('procedural'); expectHidden(1);
assert.equal(entry().mesh.userData.installedLook, 'procedural');
adapter.setFeatures([]);
adapter.setHidden('signature', []);
adapter.setFeatures(features); expectHidden(0);
adapter.setHidden('signature', [target.id]);
adapter.setHouseboats(selected); expectHidden(1);
adapter.setHidden('signature', []); expectHidden(0);
console.log(JSON.stringify({ ok: true, target: target.id, retainedNativeBoatNeighbors: selected.length - 1,
  checks: ['exact-identity', 'late-extract', 'late-install', 'unavailable-disabled-restoration', 'no-rebuild', 'same-ids-no-op', 'card-lookup', 'ordinary-duplicate-exclusion', 'multiple-hide-reasons', 'look-transition', 'stream-return'], gpu: false, nativePerformance: false }));
