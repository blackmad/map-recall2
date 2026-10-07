/** No GPU: real adapter rebuild/install methods plus real worker job code.
 * This proves availability/residency bookkeeping, not gameplay or performance.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import * as THREE from 'three';
import { ORIGIN, buildFeatureChunk, type Feature } from '../src/canalRecall/threeBuildingFeatures';
import type { ChunkHostOpeningConfig } from '../src/canalRecall/hostWallOpenings';
import source from './landmarks/rasphuispoort-footprints.json';

const jobs: any[] = [];
const workerCode = (await build({ entryPoints: ['src/canalRecall/threeBuildingsWorker.ts'], bundle: true, write: false, format: 'iife' })).outputFiles[0].text;
class MockWorker {
  onmessage: any; onerror: any;
  postMessage(job: any) { jobs.push({ worker: this, job: structuredClone(job) }); }
  terminate() {}
  reply(item: any) {
    const scope: any = { postMessage: (reply: any) => this.onmessage({ data: reply }) };
    runInNewContext(workerCode, { self: scope, performance });
    scope.onmessage({ data: item.job });
  }
}
(globalThis as any).Worker = MockWorker;
(globalThis as any).document = { currentScript: { src: 'https://example.test/three-buildings.bundle.js' } };
(globalThis as any).window = { matchMedia: () => ({ matches: false }), CanalRecallThree: { THREE }, CanalRecallSignatureLandmarks: {} };
const { ThreeBuildings } = await import('../src/canalRecall/threeBuildingsBrowser');
const { SignatureLandmarks } = await import('../public/canal-drive/js/signature-landmarks-source.js');
const map = { triggerRepaint() {}, getZoom: () => 18, getCanvas: () => ({}), addLayer() {} };
const adapter: any = new ThreeBuildings(map as any, {} as any, 'photo');
adapter.THREE = THREE; adapter.scene = new THREE.Scene(); adapter.ready = true;
adapter.material = new THREE.MeshBasicMaterial();
// Control task scheduling; the actual source grouping, rebuild, worker reply,
// install and hidden/detail ownership methods all execute unchanged.
adapter.pump = () => { while (adapter.pending.length) adapter.pending.shift()(); };
const tile: Feature[] = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString()).features;
const features = tile.filter(f => source.preserveIds.includes(String(f.properties.id)));
const featuresSnapshot = JSON.stringify(features);
const host = features.find(f => String(f.properties.id) === source.hostIdentity)!;
const ring = (host.geometry as any).coordinates[0];
const east = (source.anchor[0] - ORIGIN.lng) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const north = (source.anchor[1] - ORIGIN.lat) * 110540;
const local = ([lng, lat]: number[]): [number, number] => [(lng - ORIGIN.lng) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180) - east, north - (lat - ORIGIN.lat) * 110540];
const config: ChunkHostOpeningConfig = { hostIdentity: source.hostIdentity, enabled: true, additiveModelAvailable: true,
  anchorLngLat: source.anchor as [number, number], wallEdge: [local(ring[18]), local(ring[19])], authorAngleRadians: source.authorAngleRadians,
  halfWidth: 1.07, springHeight: 2.63, crownHeight: 3.70, portalDepth: .94, revealLayer: 0 };
const signature: any = new SignatureLandmarks(map, {}, { models: [] });
const spec = { id: 'test-additive', hostWallOpenings: [config] };
const vectorScope: any = {};
runInNewContext(readFileSync('public/canal-drive/js/vector-map.js', 'utf8') + '\nglobalThis.VectorBasemap = VectorBasemap;', vectorScope);
const vector: any = Object.create(vectorScope.VectorBasemap.prototype);
vector._threeBuildings = adapter; vector._signatureLandmarks = signature;
vector._buildingsFromTiles = true;
vector._buildings3dEnabled = true; vector.theme = 'clean'; vector._facadesLib = () => ({});
signature.canShowModel = (spec: any) => !spec.hostWallOpenings?.length || (vector._hostOpeningRendererActive() && adapter.hostWallOpeningsVisible(spec.hostWallOpenings));
const sync = () => vector._syncHostWallOpenings();
signature.onHostWallOpeningsChanged = sync;
adapter.setDetailCentre(...source.anchor);
adapter.setFeatures(features);
const flush = () => { while (jobs.length) { const item = jobs.shift(); item.worker.reply(item); } };
flush();
const before = new Map(adapter.chunks);
assert(before.size >= 3, 'resident coarse/detail/extras groups exist');
const fingerprint = (entry: any) => entry.mesh ? Array.from(entry.mesh.geometry.getAttribute('position').array) : [];
const original = new Map([...before].map(([key, entry]) => [key, fingerprint(entry)]));
// Pending/failed asset metadata alone cannot create a host opening.
signature._pending.set(spec.id, 1); signature._failed.add(spec.id);
sync(); assert.equal(jobs.length, 0);
assert.deepEqual(signature.shownHostWallOpenings(), []);
// Delayed successful load exposes only a shown entry.
signature._pending.clear(); signature._failed.clear(); signature._entries.push({ spec, group: new THREE.Group() });
sync(); assert.equal(jobs.length, 0, 'inserted but not shown metadata is unavailable');
signature.shown.add(spec.id); signature._applySuppression();
const affected = [...before.keys()].filter(key => !String(key).startsWith('extras:') && before.get(key).ranges.has(source.hostIdentity));
assert.deepEqual(jobs.map(item => item.job.key).sort(), affected.sort());
assert.equal(signature.canShowModel(spec), false, 'gate withheld until exact clip installed');
const oldJobs = jobs.splice(0);
assert(oldJobs.every(item => item.job.hostOpenings.length === 1 && typeof item.job.hostOpeningRevision === 'string'));
assert(oldJobs.every(item => item.job.hostOpenings[0].revealLayer === adapter.kitLayers().flat), 'runtime owns the current atlas flat layer');
// Availability changes invalidate delayed old replies before replacements post.
signature.setEnabled(false);
const fallbackJobs = jobs.splice(0);
for (const item of oldJobs) item.worker.reply(item);
for (const [key, entry] of before) assert.equal(adapter.chunks.get(key), entry, 'stale active reply never installs');
for (const item of fallbackJobs) item.worker.reply(item);
for (const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)), original.get(key), 'disabled host returns exact full shell');
const extras = [...before.keys()].filter(key => String(key).startsWith('extras:'));
for (const key of extras) assert.equal(adapter.chunks.get(key), before.get(key), 'relief extras untouched');
signature.setEnabled(true); flush();
assert.equal(signature.canShowModel(spec), true, 'gate visible only after loaded exact cuts install');
for (const key of affected) assert.notDeepEqual(fingerprint(adapter.chunks.get(key)), original.get(key), 'wall and coarse host cut only after availability');
for (const key of affected) {
  const old = before.get(key), entry = adapter.chunks.get(key);
  for (const [id, range] of old.ranges) {
    if (id === source.hostIdentity) continue;
    const next = entry.ranges.get(id);
    assert.equal(next.count, range.count);
    for (const [attribute, width] of [['position', 3], ['uv', 2], ['layer', 1], ['tint', 4], ['accent', 4]] as const) {
      assert.deepEqual(Array.from(entry.mesh.geometry.getAttribute(attribute).array.slice(next.start * width, (next.start + next.count) * width)),
        Array.from(old.mesh.geometry.getAttribute(attribute).array.slice(range.start * width, (range.start + range.count) * width)), 'neighbor facade attributes retained exactly');
    }
  }
}
// Existing filter callback must sync availability even on the streamed-tile
// early return; measured mode returns full fallback without touching roofs.
vector._measuredColoursOnly = true; vector._refreshBuildingSuppression(); flush();
for (const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)), original.get(key));
vector._measuredColoursOnly = false; vector._refreshColoredBuildingFilter(); flush();
for (const key of affected) assert.notDeepEqual(fingerprint(adapter.chunks.get(key)), original.get(key));
const shownSnapshot = signature.shownHostWallOpenings();
adapter.setHostWallOpenings(shownSnapshot); assert.equal(jobs.length, 0, 'same config does not rebuild');

// Per-model render/pick eligibility restores the host in every non-clipping mode.
for (const [flag,value] of [['_buildings3dEnabled',false],['_measuredColoursOnly',true],['_facadesHiddenByDetail',true],['_facadesOutOfZoom',true]] as const) {
  const previous = vector[flag]; vector[flag] = value; sync();
  assert.equal(signature.canShowModel(spec),false, `${flag}: additive gate withheld immediately`);
  flush();
  for(const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)),original.get(key),`${flag}: full host restored`);
  vector[flag] = previous; sync();
  assert.equal(signature.canShowModel(spec),false,'pending reinstatement withheld'); flush();
  assert.equal(signature.canShowModel(spec),true,'active clipping reinstates gate');
}
adapter.setVisible(false); assert.equal(signature.canShowModel(spec),false,'invisible Three never exposes gate');
adapter.setVisible(true); assert.equal(signature.canShowModel(spec),true);
adapter.ready=false; assert.equal(signature.canShowModel(spec),false,'unready/context lost gate withheld');
adapter.ready=true;
const renderer=vector._threeBuildings; vector._threeBuildings=null;
assert.equal(signature.canShowModel(spec),false,'absent Three fallback withholds gate'); vector._threeBuildings=renderer;
// Drifted installed source plane safely keeps ordinary fallback and gate hidden.
adapter.setHostWallOpenings([{...config,wallEdge:config.wallEdge.map(p=>[p[0]+.1,p[1]+.1])}]); flush();
assert.equal(adapter.hostWallOpeningsVisible([config]),false,'validation failure never exposes blocked gate');
for(const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)),original.get(key));
sync(); flush(); assert.equal(signature.canShowModel(spec),true);

// Cached/source groups restore ordinary geometry on removal/unavailability.
signature._entries = []; signature.shown.clear(); signature._applySuppression(); flush();
for (const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)), original.get(key));
// Group isolation: a separate resident/cache-only neighbor job stays valid.
const neighbor = features.find(f => String(f.properties.id) !== source.hostIdentity)!;
const separateKey = 'near:independent-neighbor';
adapter.sourceGroups.set(separateKey, [neighbor]); adapter.rebuild(separateKey, [neighbor]);
const neighborJob = jobs.shift();
adapter.setHostWallOpenings([config]);
assert(!jobs.some(item => item.job.key === separateKey));
neighborJob.worker.reply(neighborJob); assert(adapter.chunks.has(separateKey)); flush();
const neighborEntry = adapter.chunks.get(separateKey);
adapter.setHostWallOpenings([{ ...config, additiveModelAvailable: false }]); flush();
assert.equal(adapter.chunks.get(separateKey), neighborEntry);
for (const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)), original.get(key));
// A changed shape cannot accept earlier availability jobs, even when the host
// remains available. Profile and look changes retain their existing guards.
adapter.setHostWallOpenings([config]);
const oldShapeJobs = jobs.splice(0);
adapter.setHostWallOpenings([{ ...config, halfWidth: 1.02 }]);
const newShapeJobs = jobs.splice(0);
const heldBeforeShape = new Map(adapter.chunks);
for (const item of oldShapeJobs) item.worker.reply(item);
for (const key of affected) assert.equal(adapter.chunks.get(key), heldBeforeShape.get(key));
for (const item of newShapeJobs) item.worker.reply(item);
adapter.setHostWallOpenings([config]);
const oldProfileJobs = jobs.splice(0);
const heldBeforeProfile = new Map(adapter.chunks);
adapter.appearanceRevision = 'new-profile-test';
for (const item of oldProfileJobs) item.worker.reply(item);
for (const key of affected) assert.equal(adapter.chunks.get(key), heldBeforeProfile.get(key), 'stale profile results rejected');
adapter.appearanceRevision = '';
for (const key of affected) adapter.rebuild(key, adapter.sourceGroups.get(key));
const oldLookJobs = jobs.splice(0);
const heldBeforeLook = new Map(adapter.chunks);
adapter.look = adapter.requestedLook = 'procedural';
for (const item of oldLookJobs) item.worker.reply(item);
for (const key of affected) assert.equal(adapter.chunks.get(key), heldBeforeLook.get(key), 'stale look results rejected');
for (const key of affected) adapter.rebuild(key, adapter.sourceGroups.get(key));
assert(jobs.every(item => item.job.hostOpenings[0].revealLayer === adapter.kitLayers().flat));
assert.notEqual(adapter.kitLayers().flat, oldLookJobs[0].job.hostOpenings[0].revealLayer, 'look switch selects the correct atlas');
flush();
adapter.look = adapter.requestedLook = 'photo';
adapter.setHostWallOpenings(); flush();
// Worker absence uses the same config/revision path and source cache.
adapter.worker = null; adapter.setHostWallOpenings([config]);
for (const key of affected) assert.notDeepEqual(fingerprint(adapter.chunks.get(key)), original.get(key));
adapter.setHostWallOpenings();
for (const key of affected) assert.deepEqual(fingerprint(adapter.chunks.get(key)), original.get(key));
// Source immutability and exact neighbor/extras retention also have an array-level
// checker in check-host-opening-chunks.ts; compare the worker to its real builder.
assert.equal(JSON.stringify(features), featuresSnapshot, 'source features remain immutable');
assert.equal(buildFeatureChunk([neighbor], 'photo', 'walls', undefined, [], [], [config]).vertexCount,
  buildFeatureChunk([neighbor], 'photo').vertexCount);
console.log(JSON.stringify({ ok: true, checks: ['delayed-load', 'disabled', 'unavailable', 'stale-job-config-look-profile', 'current-atlas-flat-reveals', 'vector-filter-callbacks', 'resident-coarse-detail', 'extras-retained', 'neighbor-job-retained', 'cached-source', 'inline-fallback', 'gate-installed-cut-predicate', 'three-disabled-absent-unready', 'measured-detailed-outofzoom-fallback', 'invalid-plane-gate-withheld'], gpu: false, nativePerformance: false }));
