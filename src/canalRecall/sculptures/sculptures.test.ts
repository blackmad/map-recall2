import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { admitLicence } from './licences.js';
import { covariances, decodeSplats, encodeSplats, SPLAT_BYTES_PER, SPLAT_HEADER_BYTES, type SplatCloud } from './splatFormat.js';
import { SplatSorter } from './splatSort.js';
import { SculptureLod } from './lod.js';
import { azimuths, estimateFocus, estimateUp, poseFromColmap, sectorCoverage, type Pose, type V3 } from './coverage.js';
import { eyeOf } from './splatMesh.js';
import { Sculptures, eyeDistanceM, sculptureMercatorFromLocal, type SculptureManifest, type SculptureReconstruction } from './sculptureLayer.js';
import { cameraAzimuthDeg, pickViews, type ImpostorMeta } from './impostor.js';
import { frameMatrices, mercatorOfLngLat, multiply } from '../rendererShared/frameMath.js';

function cloud(n: number): SplatCloud {
  const positions = new Float32Array(n * 3), scales = new Float32Array(n * 3), rotations = new Float32Array(n * 4), colors = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    positions.set([Math.sin(i) * 0.6, Math.cos(i * 1.3) * 0.5, (i / n) * 4.2], i * 3);
    scales.set([0.01 + (i % 7) * 0.004, 0.02, 0.005 + (i % 3) * 0.01], i * 3);
    const q = [1, (i % 5) * 0.1, -0.2, 0.05 * (i % 3)], l = Math.hypot(...q);
    rotations.set(q.map(v => v / l), i * 4);
    colors.set([i % 256, 40, 200, 255 - (i % 100)], i * 4);
  }
  return { count: n, positions, scales, rotations, colors };
}

test('licences: open only', () => {
  for (const ok of ['CC0', 'Public domain', 'CC BY-SA 4.0', 'CC BY 2.5 nl', 'CC BY-SA 3.0 nl', 'CC BY 3.0']) assert.equal(admitLicence(ok).admitted, true, ok);
  for (const bad of ['CC BY-NC 4.0', 'CC BY-ND 2.0', 'CC BY-NC-SA 3.0', 'Fair use', '', 'All rights reserved', 'GFDL']) assert.equal(admitLicence(bad).admitted, false, bad);
});

test('splat format round-trips within quantisation', () => {
  const c = cloud(500);
  const bytes = encodeSplats(c);
  assert.equal(bytes.length, SPLAT_HEADER_BYTES + 500 * SPLAT_BYTES_PER);
  const d = decodeSplats(bytes);
  assert.equal(d.count, 500);
  for (let i = 0; i < 1500; i++) assert.ok(Math.abs(d.positions[i] - c.positions[i]) < 1e-4 * 5, `pos ${i}`);
  for (let i = 0; i < 1500; i++) assert.ok(Math.abs(Math.log(d.scales[i]) - Math.log(c.scales[i])) < 0.02, `scale ${i}`);
  assert.deepEqual(Array.from(d.colors), Array.from(c.colors));
  // Same rotation (q ~ -q): compare covariance instead of raw quaternions.
  const ca = covariances(c), cb = covariances(d);
  for (let i = 0; i < ca.length; i++) assert.ok(Math.abs(ca[i] - cb[i]) < 2e-5 + Math.abs(ca[i]) * 0.06, `cov ${i}`);
});

test('splat format rejects junk', () => {
  assert.throws(() => decodeSplats(new Uint8Array(10)));
  const b = encodeSplats(cloud(3));
  b[0] = 0;
  assert.throws(() => decodeSplats(b), /MRSPLAT1/);
  assert.throws(() => decodeSplats(encodeSplats(cloud(3)).slice(0, 60)), /truncated/);
  assert.equal(decodeSplats(encodeSplats(cloud(0))).count, 0);
});

test('covariance of an axis-aligned splat is diag(σ²)', () => {
  const c: SplatCloud = { count: 1, positions: new Float32Array(3), scales: new Float32Array([1, 2, 3]), rotations: new Float32Array([1, 0, 0, 0]), colors: new Uint8Array(4) };
  assert.deepEqual(Array.from(covariances(c)), [1, 0, 0, 4, 0, 9]);
});

test('sorter orders far to near and skips small view changes', () => {
  const positions = new Float32Array([0, 0, 1, 0, 0, 5, 0, 0, 3, 0, 0, -2]);
  const s = new SplatSorter(positions);
  // clip w = z (looking up +z from the origin)
  const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0];
  assert.deepEqual(Array.from(s.sort(m)), [1, 2, 0, 3]);
  assert.equal(s.needsSort([0, 0, 0], [0, 0, 1]), true);
  assert.equal(s.needsSort([0.01, 0, 0], [0, 0, 1]), false);
  assert.equal(s.needsSort([0.2, 0, 0], [0, 0, 1]), true);
  assert.equal(s.needsSort([0.2, 0, 0], [0, Math.sin(0.1), Math.cos(0.1)]), true);
});

test('sorter handles 150k splats quickly', () => {
  const n = 150_000, p = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) p[i] = Math.random() * 4;
  const s = new SplatSorter(p);
  const m = [1, 0, 0, 0.3, 0, 1, 0, 0.5, 0, 0, 1, 0.8, 0, 0, 0, 10];
  const t0 = performance.now();
  const order = s.sort(m);
  const ms = performance.now() - t0;
  let prev = Infinity;
  for (const i of order) { const w = 0.3 * p[i * 3] + 0.5 * p[i * 3 + 1] + 0.8 * p[i * 3 + 2] + 10; assert.ok(w <= prev + 1e-3); prev = w; }
  assert.ok(ms < 60, `sort took ${ms.toFixed(1)} ms`);
});

test('LOD: near within 50 m, back to far only past the hysteresis band', () => {
  const lod = new SculptureLod();
  assert.equal(lod.update(80), 'far');
  assert.equal(lod.update(49), 'near');
  assert.equal(lod.update(53), 'near');
  assert.equal(lod.update(56), 'far');
  assert.equal(lod.update(52), 'far');
  assert.equal(lod.update(NaN), 'far');
  assert.equal(lod.switches, 2);
});

test('eye of a perspective clip matrix', () => {
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 1000);
  cam.position.set(3, -7, 2);
  cam.lookAt(0, 0, 1);
  cam.updateMatrixWorld();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const out = [0, 0, 0];
  eyeOf(m.elements, out);
  assert.ok(Math.hypot(out[0] - 3, out[1] + 7, out[2] - 2) < 1e-6, out.join(','));
});

test('coverage: focus, up and sectors of a ring of cameras', () => {
  const poses: Pose[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const centre: V3 = [10 * Math.cos(a), 1.5, 10 * Math.sin(a)];
    const f: V3 = [-Math.cos(a), 0.1, -Math.sin(a)];
    const l = Math.hypot(...f);
    poses.push({ name: String(k), centre, forward: f.map(v => v / l) as V3, up: [0, 1, 0] });
  }
  const up = estimateUp(poses);
  assert.ok(up[1] > 0.999);
  const focus = estimateFocus(poses);
  assert.ok(Math.hypot(focus[0], focus[2]) < 1e-6);
  const az = azimuths(poses, focus, up, [1, 0, 0]);
  const cov = sectorCoverage(az, 30);
  assert.deepEqual(cov.bins, new Array(12).fill(1));
  assert.ok(Math.abs(cov.widestGapDeg - 30) < 1e-6);
  // COLMAP convention: identity rotation looks down +z, centre = -t.
  const p = poseFromColmap('x', [1, 0, 0, 0], [1, 2, 3]);
  assert.deepEqual(p.centre, [-1, -2, -3]);
  assert.deepEqual(p.forward, [0, 0, 1]);
});

test('impostor: camera azimuth about the statue and view choice', () => {
  // Facing north: a camera to the west stands at the figure's left (+90).
  assert.ok(Math.abs(cameraAzimuthDeg(-10, 0, 0) - 90) < 1e-9);
  assert.ok(Math.abs(cameraAzimuthDeg(10, 0, 0) + 90) < 1e-9);
  assert.ok(Math.abs(cameraAzimuthDeg(0, 10, 0)) < 1e-9);
  assert.ok(Math.abs(Math.abs(cameraAzimuthDeg(0, -10, 0)) - 180) < 1e-9);
  // Facing WSW (250): a camera due west of the statue is 20° to its right (−20).
  assert.ok(Math.abs(cameraAzimuthDeg(-10, 0, 250) + 20) < 1e-9);
  const views = [0, 45, 90, 135, 180, -90, -45].map((azimuthDeg, tile) => ({ azimuthDeg, tile }));
  assert.deepEqual(pickViews(views, 10), { a: 0, b: 1, t: 0 });
  assert.deepEqual(pickViews(views, 40), { a: 0, b: 1, t: 1 });
  const mid = pickViews(views, 22.5);
  assert.equal(mid.a, 0); assert.equal(mid.b, 1); assert.ok(Math.abs(mid.t - 0.5) < 1e-9);
  // Uneven gap −90 → 180 (no behind-right photo): −135 is the midpoint.
  const back = pickViews(views, -135);
  assert.equal(back.a, 4); assert.equal(back.b, 5); assert.ok(Math.abs(back.t - 0.5) < 1e-9);
  assert.deepEqual(pickViews(views, -100), { a: 4, b: 5, t: 1 });
  assert.deepEqual(pickViews(views, 179), { a: 3, b: 4, t: 1 });
  assert.deepEqual(pickViews(views, -179), { a: 4, b: 5, t: 0 });
  assert.deepEqual(pickViews(views, 50, 0), { a: 1, b: 2, t: 0 });
});

const anchor: [number, number] = [4.9050146, 52.3671957];
/** A camera `southM` south (and `eastM` east) of the statue, 1.7 m up, looking at it, as a shared-frame context. */
function ctxAt(southM: number, eastM = 0) {
  const m = sculptureMercatorFromLocal(anchor);
  const cam = new THREE.PerspectiveCamera(60, 1.6, 0.5, 5000);
  cam.position.set(eastM, -southM, 1.7); cam.up.set(0, 0, 1); cam.lookAt(0, 0, 2); cam.updateMatrixWorld();
  const clipFromLocal = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const localFromMercator = new THREE.Matrix4().fromArray(m).invert();
  const fm = frameMatrices(multiply(clipFromLocal.elements, localFromMercator.elements))!;
  return { pass: 'main' as const, frame: fm, worldFromMercator: new THREE.Matrix4().fromArray(fm.worldFromMercator), clipFromWorld: new THREE.Matrix4().fromArray(fm.clipFromWorld), zoom: 19, bounds: () => ({ west: 0, east: 0, south: 0, north: 0 }) as any };
}
function manifestWith(reconstruction: SculptureReconstruction): SculptureManifest {
  return { version: 1, sculptures: [{ id: 'dok', name: 'De Dokwerker', landmarkId: 'extract_1', handModelId: 'de-dokwerker', anchor, facingDeg: 0,
    reconstruction, plinth: { widthM: 1.2, depthM: 1.2, heightM: 1.6, color: '#555' } }] };
}

test('sculpture layer: anchors, distance and LOD swap hide the hand model only once the splat is ready', async () => {
  const m = sculptureMercatorFromLocal(anchor);
  const [mx, my] = mercatorOfLngLat(anchor[0], anchor[1]);
  assert.ok(Math.abs(m[12] - mx) < 1e-15 && Math.abs(m[13] - my) < 1e-15);
  assert.ok(m[5] < 0, 'north is −Mercator y');
  const bytes = encodeSplats(cloud(64));
  const fetched: string[] = [];
  (globalThis as any).fetch = async (url: string) => { fetched.push(url); return new Response(bytes); };
  let hiddenFrames = 0;
  const s = new Sculptures(THREE, manifestWith({ kind: 'splat', url: 'dok.mrsplat' }), { baseUrl: 'http://x/sculptures/manifest.json', host: { setHandModelHidden: (id, h) => { assert.equal(id, 'de-dokwerker'); assert.equal(h, true); hiddenFrames++; } } });
  const far = ctxAt(200);
  assert.ok(Math.abs(eyeDistanceM(far.frame, anchor) - Math.hypot(200, 1.7)) < 0.05);
  assert.equal(s.beforeRender(far), false);
  assert.deepEqual(fetched, []);
  const near = ctxAt(30);
  assert.equal(s.beforeRender(near), false, 'first near frame: still loading, hand model stays');
  assert.equal(hiddenFrames, 0);
  assert.deepEqual(fetched, ['http://x/sculptures/dok.mrsplat']);
  await s.entries[0].loading;
  assert.equal(s.beforeRender(near), true);
  assert.equal(hiddenFrames, 1);
  assert.equal(s.stats.near, 1);
  assert.equal(s.beforeRender({ ...near, pass: 'overlay' } as any), false, 'main pass only');
  // Picking at the statue returns the landmark id; empty sky does not.
  assert.equal(s.pick(0, 0.05, near.clipFromWorld.elements, near.worldFromMercator.elements), 'extract_1');
  assert.equal(s.pick(0.95, 0.95, near.clipFromWorld.elements, near.worldFromMercator.elements), null);
  assert.equal(s.beforeRender(ctxAt(120)), false);
  assert.equal(hiddenFrames, 1, 'far again: hand model left alone');
  s.dispose();
});

test('sculpture layer: impostor turns to the eye and picks the view for its azimuth', async () => {
  const meta: ImpostorMeta = { version: 1, id: 'dok', cols: 4, rows: 2, tilePx: [256, 512], figureHeightM: 2.6, tileHeightM: 2.766, tileWidthM: 1.383, feetFromBottom: 0.015,
    views: [0, 45, 90, 135, 180, -90, -45].map((azimuthDeg, tile) => ({ azimuthDeg, tile })) };
  (globalThis as any).fetch = async () => new Response(JSON.stringify(meta));
  const s = new Sculptures(THREE, manifestWith({ kind: 'impostor', atlasUrl: 'a.webp', metaUrl: 'a.json' }), { baseUrl: 'http://x/sculptures/manifest.json', loadTexture: async () => new THREE.Texture() });
  s.beforeRender(ctxAt(20));
  await s.entries[0].loading;
  // Figure faces north; the camera is south of it: behind (180).
  assert.equal(s.beforeRender(ctxAt(20)), true);
  assert.ok(Math.abs(Math.abs(s.entries[0].azimuthDeg!) - 180) < 0.5);
  const mesh = s.entries[0].near!.mesh;
  const shown = () => { const u = mesh.material.uniforms; return u.mixB.value < 0.5 ? u.tileA.value : u.tileB.value; };
  assert.equal(shown(), 4);
  // Feet on the plinth top.
  mesh.geometry.computeBoundingBox();
  assert.ok(Math.abs(mesh.position.z + mesh.geometry.boundingBox.min.z + 0.015 * 2.766 - 1.6) < 1e-6);
  // Camera to the east (the figure's right): −90, quad normal pointing east.
  s.beforeRender(ctxAt(0.001, 20));
  assert.ok(Math.abs(s.entries[0].azimuthDeg! + 90) < 0.5);
  assert.equal(shown(), 5);
  assert.ok(Math.abs(Math.cos(mesh.rotation.z - Math.PI / 2)) > 0.999);
  s.dispose();
});
