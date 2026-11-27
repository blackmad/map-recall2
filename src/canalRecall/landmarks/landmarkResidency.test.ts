import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { coolingDown, LANDMARK_COOLDOWN_MS, landmarkCooldownMs, landmarkResidencyBudget, pickEvictions, sphereOnScreen, type ResidentModel } from './landmarkResidency';

const model = (id: string, distanceSq: number, inView = false, evictable = true): ResidentModel => ({ id, distanceSq, inView, evictable });

test('nothing goes while within budget', () => {
  assert.deepEqual(pickEvictions([model('a', 9), model('b', 4)], { budget: 2 }), []);
});

test('furthest off-view models go first, down to budget minus slack', () => {
  const models = [model('near', 1), model('far', 100), model('mid', 50), model('farther', 200), model('view', 999, true)];
  assert.deepEqual(pickEvictions(models, { budget: 4, slack: 1 }), ['farther', 'far']);
});

test('in-view and pinned models are never evicted, even over budget', () => {
  const models = [model('v1', 500, true), model('v2', 400, true), model('pinned', 900, false, false), model('x', 1)];
  assert.deepEqual(pickEvictions(models, { budget: 1, slack: 0 }), ['x']);
});

test('budget: touch 24, desktop 72, query override with a floor', () => {
  assert.equal(landmarkResidencyBudget('', true), 24);
  assert.equal(landmarkResidencyBudget('', false), 72);
  assert.equal(landmarkResidencyBudget('?landmarkBudget=10', true), 10);
  assert.equal(landmarkResidencyBudget('?landmarkBudget=2', false), 72);
});

test('landmark reach: 2000 m desktop, 1000 m touch, ?landmarkReach=0 is off, N sets it (floor 200)', async () => {
  const { landmarkReachM } = await import('./landmarkResidency');
  assert.equal(landmarkReachM('', false), 2000);
  assert.equal(landmarkReachM('?ride=free', true), 1000);
  assert.equal(landmarkReachM('?landmarkReach=0', false), Infinity);
  assert.equal(landmarkReachM('?engine=own&landmarkReach=1500', true), 1500);
  assert.equal(landmarkReachM('?landmarkReach=50', false), 200);
});

test('within reach: metres from the view centre, less the model radius; off reaches everything', async () => {
  const { withinReach, anchorDistanceM } = await import('./landmarkResidency');
  const dam = { lng: 4.8926, lat: 52.3731 };
  // The Rijksmuseum is ~1.9 km from the Dam, the Zuidas rails ~4 km.
  const rijks: [number, number] = [4.8852, 52.3600], zuidas: [number, number] = [4.8775, 52.3385];
  assert.ok(Math.abs(anchorDistanceM(rijks, dam) - 1530) < 120, String(anchorDistanceM(rijks, dam)));
  assert.equal(withinReach(rijks, dam, 2000), true);
  assert.equal(withinReach(zuidas, dam, 2000), false);
  assert.equal(withinReach(zuidas, dam, Infinity), true);
  assert.equal(withinReach(null, dam, 2000), true, 'an anchorless model is not the reach\'s to drop');
  assert.equal(withinReach(rijks, dam, 1500, 100), true, 'the radius counts toward reach');
});

test('evictions go behind the heading first, then furthest first (desktop-perf 2026-11-27)', () => {
  const m = (id: string, d: number, behind?: boolean) => ({ id, distanceSq: d, inView: false, evictable: true, behind });
  const ids = pickEvictions([m('aheadFar', 900), m('behindNear', 10, true), m('behindFar', 400, true), m('aheadNear', 5), m('x', 1), m('y', 1)], { budget: 4, slack: 1 });
  assert.deepEqual(ids, ['behindFar', 'behindNear', 'aheadFar']);
  // Without `behind` the old order.
  assert.deepEqual(pickEvictions([m('a', 1), m('b', 9), m('c', 4)], { budget: 2, slack: 0 }), ['b']);
});

test('a model given back cools down unless it is on screen; the switch and the tuning', () => {
  assert.equal(coolingDown(1000, 1000 + LANDMARK_COOLDOWN_MS - 1, LANDMARK_COOLDOWN_MS, false), true);
  assert.equal(coolingDown(1000, 1000 + LANDMARK_COOLDOWN_MS, LANDMARK_COOLDOWN_MS, false), false);
  assert.equal(coolingDown(1000, 1001, LANDMARK_COOLDOWN_MS, true), false, 'on screen: loads at once');
  assert.equal(coolingDown(undefined, 5, LANDMARK_COOLDOWN_MS, false), false, 'never given back');
  assert.equal(coolingDown(1000, 1001, 0, false), false, 'off');
  assert.equal(landmarkCooldownMs('', undefined), LANDMARK_COOLDOWN_MS);
  assert.equal(landmarkCooldownMs('?landmarkCooldown=0', undefined), 0);
  assert.equal(landmarkCooldownMs('', false), 0);
  assert.equal(landmarkCooldownMs('?landmarkCooldownS=12', undefined), 12000);
});

test('sphereOnScreen: in front and inside the view (with its radius), not behind or off to the side', () => {
  const cam = new THREE.PerspectiveCamera(60, 1.5, 1, 5000);
  cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.updateMatrixWorld(true);
  const clip = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
  assert.equal(sphereOnScreen(clip, [0, 0, -100], 5), true);
  assert.equal(sphereOnScreen(clip, [0, 0, 100], 5), false, 'behind');
  assert.equal(sphereOnScreen(clip, [400, 0, -100], 5), false, 'far to the side');
  assert.equal(sphereOnScreen(clip, [105, 0, -100], 30), true, 'its edge reaches into the view');
});

// ------------------------------------------------------------------ residency by bytes (lane landmark-residency 2026-11-27)
import { landmarkResidencyPolicy, LANDMARK_BUDGET_MB, LANDMARK_KEEP_M, LANDMARK_MAX_MODELS, pickEvictionsByBytes, residentBytes, type ByteResidentModel } from './landmarkResidency';
import { geometryGpuBytes, levelGpuBytes, objectGpuBytes, textureGpuBytes } from './residentBytes';
import { releaseVertexDataOnUpload } from './releaseVertexData';

const MB = 1024 * 1024;
const bm = (id: string, metres: number, mb: number, extra: Partial<ByteResidentModel> = {}): ByteResidentModel =>
  ({ id, distanceSq: (metres / 111_320) ** 2, inView: false, evictable: true, bytes: mb * MB, ...extra });
const keep = (m: number) => (m / 111_320) ** 2;

test('bytes: nothing goes while the set fits the byte budget, whatever the count', () => {
  const models = Array.from({ length: 200 }, (_, i) => bm(`m${i}`, 1000 + i, 0.5));
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 100 * MB }), []);
});

test('bytes: over budget, beyond the keep radius goes first (furthest first), down to budget minus slack', () => {
  const models = [bm('near', 260, 30), bm('far', 900, 30), bm('farther', 1500, 30), bm('view', 2000, 30, { inView: true })];
  // 120 MB resident, budget 100, slack 5 % -> must free >= 25 MB: one model beyond the keep radius is enough.
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 100 * MB, keepDistanceSq: keep(500) }), ['farther']);
  // 70 MB budget (target 66.5): both beyond the keep radius go (120 -> 60 MB); the near one stays.
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 70 * MB, keepDistanceSq: keep(500) }), ['farther', 'far']);
});

test('bytes: the keep radius holds while anything beyond it can go; within it only as a last resort', () => {
  // The belt case: a model ~260 m to the side and behind is kept, a 1.2 km one ahead goes instead.
  const models = [bm('sideBehind', 260, 10, { behind: true }), bm('aheadFar', 1200, 10), bm('v', 100, 10, { inView: true })];
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 25 * MB, keepDistanceSq: keep(500) }), ['aheadFar']);
  // Without the keep radius the old order (behind first) gives the side model back.
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 25 * MB }), ['sideBehind']);
  // A budget that nothing beyond the radius can meet: the kept one goes too.
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 12 * MB, keepDistanceSq: keep(500) }), ['aheadFar', 'sideBehind']);
});

test('bytes: in view and pinned never go, even over budget', () => {
  const models = [bm('v', 3000, 50, { inView: true }), bm('p', 3000, 50, { evictable: false }), bm('x', 3000, 1)];
  assert.deepEqual(pickEvictionsByBytes(models, { budgetBytes: 10 * MB }), ['x']);
});

test('bytes: a shared master counts once and frees only with its last holder', () => {
  const shared = [bm('a', 1500, 8, { sharedKey: 'u' }), bm('b', 1400, 8, { sharedKey: 'u' }), bm('c', 300, 8)];
  assert.equal(residentBytes(shared), 16 * MB);
  // Must free 16 - 9.5 -> both clones go before the master's bytes come free (c is nearer, so after them).
  assert.deepEqual(pickEvictionsByBytes(shared, { budgetBytes: 10 * MB }), ['a', 'b']);
});

test('bytes: the model ceiling applies under the byte budget too', () => {
  const models = Array.from({ length: 12 }, (_, i) => bm(`m${i}`, 600 + i * 100, 0.1));
  const out = pickEvictionsByBytes(models, { budgetBytes: 1000 * MB, maxModels: 10 });
  assert.deepEqual(out, ['m11', 'm10', 'm9', 'm8', 'm7', 'm6'], 'down to the ceiling minus 4, furthest first');
});

test('policy: bytes by default with the measured tier budgets; ?landmarkBudgetMB=0 and ?landmarkBudget=N are the count budget before', () => {
  const desk = landmarkResidencyPolicy('', false), touch = landmarkResidencyPolicy('?engine=own', true);
  assert.deepEqual(desk, { mode: 'bytes', models: LANDMARK_MAX_MODELS.desktop, budgetBytes: LANDMARK_BUDGET_MB.desktop * MB, keepM: LANDMARK_KEEP_M, airModels: 72 });
  assert.deepEqual(touch, { mode: 'bytes', models: LANDMARK_MAX_MODELS.touch, budgetBytes: LANDMARK_BUDGET_MB.touch * MB, keepM: LANDMARK_KEEP_M, airModels: 24 });
  assert.ok(LANDMARK_BUDGET_MB.touch < LANDMARK_BUDGET_MB.desktop);
  assert.deepEqual(landmarkResidencyPolicy('?landmarkBudgetMB=0', false), { mode: 'count', models: 72, budgetBytes: Infinity, keepM: 0, airModels: 72 });
  assert.deepEqual(landmarkResidencyPolicy('?landmarkBudgetMB=0', true), { mode: 'count', models: 24, budgetBytes: Infinity, keepM: 0, airModels: 24 });
  assert.deepEqual(landmarkResidencyPolicy('?landmarkBudget=96', false), { mode: 'count', models: 96, budgetBytes: Infinity, keepM: 0, airModels: 96 });
  const mb = landmarkResidencyPolicy('?landmarkBudgetMB=300&landmarkKeepM=0', false);
  assert.equal(mb.mode, 'bytes'); assert.equal(mb.budgetBytes, 300 * MB); assert.equal(mb.keepM, 0);
  assert.equal(landmarkResidencyPolicy('?landmarkBudgetMB=64&landmarkBudget=50', true).models, 50, 'both: bytes with that count ceiling');
  assert.equal(landmarkResidencyPolicy('?landmarkKeepM=800', false).keepM, 800);
});

test('resident bytes: attributes, index, interleaved once, and a released attribute still counts', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(40), 4, true));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(12), 1));
  assert.equal(geometryGpuBytes(g), 120 + 40 + 24);
  const il = new THREE.InterleavedBuffer(new Float32Array(10 * 8), 8);
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.InterleavedBufferAttribute(il, 3, 0));
  g2.setAttribute('uv', new THREE.InterleavedBufferAttribute(il, 2, 3));
  assert.equal(geometryGpuBytes(g2), 320, 'one interleaved buffer');
  // After upload the normal array is an empty Int8Array; the GPU still holds its 40 bytes.
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  releaseVertexDataOnUpload(mesh);
  (g.attributes.normal as unknown as { onUploadCallback: () => void }).onUploadCallback.call(g.attributes.normal);
  assert.equal((g.attributes.normal.array as Int8Array).length, 0);
  assert.equal(geometryGpuBytes(g), 184);
});

test('resident bytes: textures (mipmaps, compressed), a geometry shared by two meshes once, shared look materials left out', () => {
  const tex = new THREE.Texture({ width: 256, height: 128 } as unknown as HTMLImageElement);
  assert.equal(textureGpuBytes(tex), Math.round(256 * 128 * 4 * 4 / 3));
  tex.generateMipmaps = false;
  assert.equal(textureGpuBytes(tex), 256 * 128 * 4);
  const ct = new THREE.CompressedTexture([{ data: new Uint8Array(1000), width: 64, height: 64 }, { data: new Uint8Array(250), width: 32, height: 32 }] as unknown as ImageData[], 64, 64);
  assert.equal(textureGpuBytes(ct), 1250);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
  const lookMat = new THREE.MeshStandardMaterial({ map: ct as unknown as THREE.Texture });
  lookMat.userData.shared = true;
  const root = new THREE.Group();
  root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex })), new THREE.Mesh(g, lookMat));
  assert.deepEqual(objectGpuBytes(root, m => !!m.userData.shared), { geometry: 120, texture: 256 * 128 * 4 });
  assert.equal(objectGpuBytes(root).texture, 256 * 128 * 4 + 1250);
});

test('resident bytes: a level is walked once, its texture bytes read live (the texture cap swaps images)', () => {
  const tex = new THREE.Texture({ width: 512, height: 512 } as unknown as HTMLImageElement);
  tex.generateMipmaps = false;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
  const level = new THREE.Group();
  level.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex })));
  assert.equal(levelGpuBytes(level), 120 + 512 * 512 * 4);
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(30), 3));
  assert.equal(levelGpuBytes(level), 120 + 512 * 512 * 4, 'geometry kept from the first walk');
  tex.image = { width: 128, height: 128 } as unknown as HTMLImageElement;
  assert.equal(levelGpuBytes(level), 120 + 128 * 128 * 4, 'capped image');
  delete level.userData.gpuParts;
  assert.equal(levelGpuBytes(level), 240 + 128 * 128 * 4, 'walked again once invalidated');
  assert.equal(levelGpuBytes(null), 0);
});
