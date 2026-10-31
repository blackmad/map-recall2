/** Exercise the real browser adapter with controllably out-of-order texture and worker completions. */
import assert from 'node:assert/strict';

class Matrix { makeTranslation() { return this; } scale() { return this; } }
class Material {
  uniforms: any;
  constructor(v: any) { this.uniforms = v.uniforms; }
  clone() { return new Material({ uniforms: Object.fromEntries(Object.entries(this.uniforms).map(([k, v]: any) => [k, { ...v }])) }); }
  dispose() {}
}
class Attribute { constructor(public array: any, public itemSize: number) {} onUpload() {} }
class Geometry {
  attributes: any = {}; setAttribute(k: string, a: any) { this.attributes[k] = a; }
  getAttribute(k: string) { return this.attributes[k]; }
  setIndex() {} computeBoundingSphere() {} dispose() {}
}
class Scene { children: any[] = []; add(m: any) { this.children.push(m); } remove(m: any) { this.children = this.children.filter(x => x !== m); } }
/** Every stubbed worker, in start order: chunk builds now go to the page's worker pool (engine/workerPool.ts). */
const stubs: WorkerStub[] = [];
class WorkerStub {
  onmessage: any; onerror: any; messages: any[] = [];
  constructor(_url: string) { stubs.push(this); } postMessage(message: any) { this.messages.push(message); } terminate() {}
  reply(message: any) {
    const chunk = { positions: new Float32Array(9), uvs: new Float32Array(6), layers: new Float32Array(3), tints: new Uint8Array(12), accents: new Uint8Array(12), indices: new Uint16Array([0, 1, 2]), vertexCount: 3, buildingCount: 1, wallCount: 1, quadCount: 0, ranges: [{ id: message.features[0].properties.id, start: 0, count: 3 }] };
    this.onmessage({ data: { key: message.key, gen: message.gen, appearanceRevision: message.appearanceRevision, surveyedEnvelopeRevision: message.surveyedEnvelopeRevision, hostOpeningRevision: message.hostOpeningRevision, boundParentIds: [], chunk, ms: 1 } });
  }
}
const THREE = { Camera: class {}, Scene, WebGLRenderer: class {}, RawShaderMaterial: Material, Matrix4: Matrix, Vector3: class { constructor(..._xyz: number[]) {} }, Vector4: class { constructor(..._xyzw: number[]) {} }, Matrix3: class {}, ShaderMaterial: Material, FrontSide: 0, Sphere: class { constructor(public center: any, public radius: number) {} }, BufferGeometry: Geometry, BufferAttribute: Attribute, Mesh: class { constructor(public geometry: any, public material: any) {} } };
(globalThis as any).window = { CanalRecallThree: { THREE } };
(globalThis as any).document = { currentScript: { src: 'https://test.local/three-buildings.bundle.js' } };
(globalThis as any).Worker = WorkerStub;
const { ThreeBuildings } = await import('../src/canalRecall/threeBuildingsBrowser.ts');
// The stub document only supplies the bundle URL at import. Without it, the city look (default since #137) takes its
// node path: materials and uniforms, no brick photo or atlas painting.
delete (globalThis as any).document;
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const textures = (name: string) => ({ colour: { name, userData: { bytes: 1 } }, mask: { name, userData: { bytes: 1 } } });
const map = { getCanvas: () => ({ addEventListener() {} }), triggerRepaint() {}, getZoom: () => 18 };
const ml = { MercatorCoordinate: { fromLngLat: () => ({ x: 0, y: 0, z: 0, meterInMercatorCoordinateUnits: () => 1 }) } };
const initial = deferred(), photo = deferred();
const t: any = new ThreeBuildings(map as any, ml as any, 'procedural');
t.pump = () => {}; // Run queued adapter jobs explicitly, keeping the production queue and worker handler.
// Worker replies stage and install on later frames (6370811e7); drain the real staging queue as those frames would.
t.scheduleStage = () => {};
// The pool sends a build to its first idle worker; this check has at most one build in flight, so that is worker 0.
// Its replies reach the layer through the pool's own message handler.
const poolWorker = (): WorkerStub => { assert.ok(stubs.length, 'chunk builds started the worker pool'); return stubs[0]; };
const deliver = (message: any) => { poolWorker().reply(message); while (t.staged.length) t.drainStaged(); };
t.texturesFor = (look: string) => look === 'procedural' ? initial.promise : photo.promise;
// What the shared frame's onAttach does (the facades' own layer went with L1 step 6).
t.THREE = THREE; t.setup(map, new THREE.WebGLRenderer(), new THREE.Camera(), new THREE.Scene());
const firstSwitch = t.setLook('photo'); photo.resolve(textures('photo')); await firstSwitch;
initial.resolve(textures('procedural')); await Promise.resolve();
assert.equal(t.getLook(), 'photo');
assert.equal(t.material.uniforms.cells.value.name, 'photo', 'late initial atlas cannot overwrite a completed PHOTO switch');
assert.equal(t.ready, true, 'newest mode can become ready without waiting for obsolete initialization');
const f = { type: 'Feature', properties: { id: 'w100', height: 12 }, geometry: { type: 'Polygon', coordinates: [[[4.89, 52.37], [4.8901, 52.37], [4.8901, 52.3701], [4.89, 52.3701], [4.89, 52.37]]] } };
t.setFeatures([f]); while (t.pending.length) t.pending.shift()();
const worker: WorkerStub = poolWorker(), first = worker.messages.at(-1); deliver(first);
const firstMesh = t.chunks.get(first.key).mesh;
assert.equal(firstMesh.material.uniforms.cells.value.name, 'photo');
// An old PHOTO job is in flight when CARTOON is requested.
t.rebuild(first.key, [f]); const obsolete = worker.messages.at(-1);
const cartoon = deferred(); t.texturesFor = (look: string) => look === 'cartoon' ? cartoon.promise : Promise.resolve(textures(look));
const pendingCartoon = t.setLook('cartoon');
deliver(obsolete);
assert.equal(t.chunks.get(first.key).mesh, firstMesh, 'request synchronously invalidates old worker replies before textures resolve');
assert.equal(firstMesh.material.uniforms.cells.value.name, 'photo', 'resident geometry retains its matching old atlas while a new one loads');
cartoon.resolve(textures('cartoon')); await pendingCartoon;
assert.equal(firstMesh.material.uniforms.cells.value.name, 'photo', 'activating CARTOON does not recolor old PHOTO geometry through a shared material');
while (t.pending.length) t.pending.shift()(); const cartoonJob = worker.messages.at(-1); deliver(cartoonJob);
const cartoonMesh = t.chunks.get(first.key).mesh;
assert.notEqual(cartoonMesh, firstMesh);
assert.equal(cartoonMesh.material.uniforms.cells.value.name, 'cartoon', 'new geometry and its palette/atlas install together');
assert.equal(cartoonMesh.material.uniforms.bands.value, 3);
// Return to the original mode while a different texture request is still unresolved.
const slowProcedural = deferred(); t.texturesFor = (look: string) => look === 'procedural' ? slowProcedural.promise : Promise.resolve(textures(look));
const older = t.setLook('procedural'), latest = t.setLook('photo'); await latest;
slowProcedural.resolve(textures('procedural')); await older;
assert.equal(t.getLook(), 'photo'); assert.equal(t.material.uniforms.cells.value.name, 'photo', 'the most recent request wins even if old textures resolve last');
deliver(cartoonJob);
assert.equal(t.chunks.get(first.key).mesh, cartoonMesh, 'a previous mode cannot replace geometry after the next mode is ready');
while (t.pending.length) t.pending.shift()(); deliver(worker.messages.at(-1));
assert.equal(t.chunks.get(first.key).mesh.material.uniforms.cells.value.name, 'photo');
// A cached older feature list must not overwrite a tile that changed while awaiting its reply.
t.rebuild(first.key, [f]); const staleFeatureJob = worker.messages.at(-1);
const updated = { ...f, properties: { ...f.properties, height: 17 } }; t.setFeatures([updated]);
deliver(staleFeatureJob);
assert.notEqual(t.chunks.get(first.key).source[0], updated, 'obsolete reply is ignored until fresh geometry arrives');
while (t.pending.length) t.pending.shift()(); deliver(worker.messages.at(-1));
assert.equal(t.chunks.get(first.key).source[0], updated, 'latest source survives mode switching and out-of-order feature work');
const originalStreets = new Float32Array([1, 2, 3, 4]);
t.streetsFor = () => originalStreets; t.rebuild(first.key, [updated]);
const streetJob = worker.messages.at(-1); t.streetsFor = () => new Float32Array([8, 9, 10, 11]);
deliver(streetJob);
assert.equal(t.chunks.get(first.key).mesh.userData.installedStreets, originalStreets, 'picking stores streets actually used by the worker, rather than later mutable streets');
assert.equal(t.chunks.get(first.key).mesh.userData.installedLook, 'photo');
assert.equal(t.pending.length, 0); assert.equal(t.inflight.size, 0);
// Evicting a dispatched tile also releases the captured street snapshot.
t.rebuild(first.key, [updated]); const evictedJob = worker.messages.at(-1);
assert.equal(t.inflightOptions.size, 1); t.setFeatures([]);
assert.equal(t.inflightOptions.size, 0, 'evicted tiles release captured build inputs');
deliver(evictedJob);
assert.equal(t.chunks.size, 0, 'late evicted tile cannot reinstall geometry');
console.log('Building mode transition regressions passed: delayed initialization, stale workers, atomic chunk materials, rapid cycles and newer tile sources.');
