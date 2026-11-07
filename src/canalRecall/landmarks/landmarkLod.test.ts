import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LOD1_BUILD_VERSION, LOD_DOWNGRADE_RADIUS_PX, LOD_UPGRADE_RADIUS_PX,
  chooseLevel, footprintRadiusPixels, initialLevel, lod1IsCurrent, lod1Url, metresPerPixel,
} from './landmarkLod';

test('lod1Url keeps the query string', () => {
  assert.equal(lod1Url('./models/a.glb'), './models/a.lod1.glb');
  assert.equal(lod1Url('http://x/models/a.glb?asset=1'), 'http://x/models/a.lod1.glb?asset=1');
});

test('metres per pixel halves per zoom level', () => {
  assert.ok(Math.abs(metresPerPixel(15, 52) / metresPerPixel(16, 52) - 2) < 1e-9);
  assert.ok(Math.abs(metresPerPixel(14.8, 52.37) - 1.68) < 0.05);
});

test('hysteresis keeps the current level between thresholds', () => {
  const mid = (LOD_UPGRADE_RADIUS_PX + LOD_DOWNGRADE_RADIUS_PX) / 2;
  assert.equal(chooseLevel('lod1', mid), 'lod1');
  assert.equal(chooseLevel('full', mid), 'full');
  assert.equal(chooseLevel('lod1', LOD_UPGRADE_RADIUS_PX + 1), 'full');
  assert.equal(chooseLevel('full', LOD_DOWNGRADE_RADIUS_PX - 1), 'lod1');
  assert.equal(initialLevel(5), 'lod1');
  assert.equal(initialLevel(100), 'full');
});

test('overview is lod1, street is full for a 40 m radius', () => {
  assert.equal(initialLevel(footprintRadiusPixels(40, 11.2, 52.37)), 'lod1');
  assert.equal(initialLevel(footprintRadiusPixels(40, 17.6, 52.37)), 'full');
});

test('lod1IsCurrent requires matching hash and build version', () => {
  const rec = { sourceHash: 'a', buildVersion: LOD1_BUILD_VERSION, bytes: 1, triangles: 1 };
  assert.ok(lod1IsCurrent(rec, 'a'));
  assert.ok(!lod1IsCurrent(rec, 'b'));
  assert.ok(!lod1IsCurrent({ ...rec, buildVersion: 0 }, 'a'));
  assert.ok(!lod1IsCurrent(undefined, 'a'));
  assert.ok(!lod1IsCurrent(rec, undefined));
});

test('a GLB rebuilt after its lod1 (new asset version) is stale, so full is drawn', () => {
  const lods = { palace: { sourceHash: 'old', buildVersion: LOD1_BUILD_VERSION, bytes: 1, triangles: 1 } };
  const versions: Record<string, string> = { palace: 'new' };
  assert.ok(!lod1IsCurrent(lods.palace, versions.palace));
  versions.palace = 'old';
  assert.ok(lod1IsCurrent(lods.palace, versions.palace));
});

test('lod1 error: Centraal keeps its east-wing storey bands (0.43 m on a 430 m site); others keep the default', async () => {
  const {lod1SimplifyOptions, LOD1_MAX_ERROR, LOD1_TRIANGLE_RATIO} = await import('./landmarkLod');
  assert.deepEqual(lod1SimplifyOptions('centraal-station'), {ratio: LOD1_TRIANGLE_RATIO, error: 0.001});
  assert.deepEqual(lod1SimplifyOptions('nassaukerk'), {ratio: LOD1_TRIANGLE_RATIO, error: LOD1_MAX_ERROR});
});

test('lod2: url, freshness and extent-relative error with tower overrides', async () => {
  const { lod2Url, lod2IsCurrent, lod2SimplifyOptions, LOD2_BUILD_VERSION, LOD2_MAX_ERROR_M, LOD2_TRIANGLE_RATIO } = await import('./landmarkLod');
  assert.equal(lod2Url('./models/a.glb?asset=1'), './models/a.lod2.glb?asset=1');
  const rec = { sourceHash: 'a', buildVersion: LOD2_BUILD_VERSION, bytes: 1, triangles: 1 };
  assert.ok(lod2IsCurrent(rec, 'a'));
  assert.ok(!lod2IsCurrent({ ...rec, buildVersion: 0 }, 'a'));
  assert.ok(!lod2IsCurrent(undefined, 'a'));
  assert.deepEqual(lod2SimplifyOptions('nassaukerk', 50), { ratio: LOD2_TRIANGLE_RATIO, error: LOD2_MAX_ERROR_M / 50 });
  assert.ok(lod2SimplifyOptions('westerkerk', 87).error < LOD2_MAX_ERROR_M / 87, 'spire keeps a tighter bound');
});

test('lod2 level choice: small on screen, and far from the centre only from the air', async () => {
  const { chooseLandmarkLevel, initialLandmarkLevel, LOD2_DOWNGRADE_RADIUS_PX, LOD2_HYSTERESIS, LOD2_AERIAL_M, LOD2_AERIAL_RETURN } = await import('./landmarkLod');
  const base = { radiusPixels: 60, hasLod1: true, hasLod2: true, aerialDistanceM: null };
  // Street view: the aerial rule never applies, whatever the distance; full/lod1 as before.
  assert.equal(chooseLandmarkLevel('full', base), 'full');
  assert.equal(initialLandmarkLevel(base), 'full');
  assert.equal(chooseLandmarkLevel('full', { ...base, radiusPixels: 25 }), 'full');
  assert.equal(chooseLandmarkLevel('full', { ...base, radiusPixels: 15 }), 'lod1');
  // Tiny on screen: lod2, with hysteresis on the way back.
  assert.equal(chooseLandmarkLevel('lod1', { ...base, radiusPixels: LOD2_DOWNGRADE_RADIUS_PX - 1 }), 'lod2');
  assert.equal(chooseLandmarkLevel('lod2', { ...base, radiusPixels: LOD2_DOWNGRADE_RADIUS_PX * LOD2_HYSTERESIS - 1 }), 'lod2');
  assert.equal(chooseLandmarkLevel('lod2', { ...base, radiusPixels: LOD2_DOWNGRADE_RADIUS_PX * LOD2_HYSTERESIS + 1 }), 'lod1');
  assert.equal(chooseLandmarkLevel('lod2', { ...base, radiusPixels: 100 }), 'full');
  // From the air: beyond LOD2_AERIAL_M, lod2 even when large; back below the return share.
  assert.equal(chooseLandmarkLevel('full', { ...base, aerialDistanceM: LOD2_AERIAL_M + 1 }), 'lod2');
  assert.equal(chooseLandmarkLevel('full', { ...base, aerialDistanceM: LOD2_AERIAL_M - 1 }), 'full');
  assert.equal(chooseLandmarkLevel('lod2', { ...base, aerialDistanceM: LOD2_AERIAL_M * LOD2_AERIAL_RETURN + 1 }), 'lod2');
  assert.equal(chooseLandmarkLevel('lod2', { ...base, aerialDistanceM: LOD2_AERIAL_M * LOD2_AERIAL_RETURN - 1 }), 'full');
  assert.equal(initialLandmarkLevel({ ...base, aerialDistanceM: 900 }), 'lod2');
  assert.equal(chooseLandmarkLevel('full', { ...base, aerialDistanceM: 300, lod2AerialM: 250 }), 'lod2');
  // Leaving the air drops the aerial rule at once.
  assert.equal(chooseLandmarkLevel('lod2', { ...base, aerialDistanceM: null }), 'full');
  // The card's landmark and models without a lod2 never take it.
  assert.equal(chooseLandmarkLevel('lod2', { ...base, aerialDistanceM: 900, highlighted: true }), 'full');
  assert.equal(chooseLandmarkLevel('full', { ...base, hasLod2: false, aerialDistanceM: 900 }), 'full');
  // No lod1 (small models): lod2 or full.
  assert.equal(chooseLandmarkLevel('lod2', { ...base, hasLod1: false, radiusPixels: 5, aerialDistanceM: null }), 'lod2');
  assert.equal(chooseLandmarkLevel('lod2', { ...base, hasLod1: false, radiusPixels: 40 }), 'full');
});

test('street chunk lod2 (lane R4-C): current only for this GLB hash and build version; chunkSpecFor carries it only then', async () => {
  const { chunkLod2IsCurrent, CHUNK_LOD2_BUILD_VERSION } = await import('./landmarkLod');
  const { chunkSpecFor } = await import('./ordinaryChunks');
  const sha256 = 'abcdef0123456789' + '0'.repeat(48);
  const record = { sourceHash: 'abcdef0123456789', buildVersion: CHUNK_LOD2_BUILD_VERSION, bytes: 9, triangles: 3 };
  assert.ok(chunkLod2IsCurrent(record, sha256));
  assert.ok(!chunkLod2IsCurrent({ ...record, buildVersion: CHUNK_LOD2_BUILD_VERSION + 1 }, sha256));
  assert.ok(!chunkLod2IsCurrent(record, 'ffff' + sha256.slice(4)));
  assert.ok(!chunkLod2IsCurrent(undefined, sha256));
  const row = { id: 'chunk-x', category: 'street-survey' as const, name: 'x', modelUrl: './x.glb', sha256, bytes: 1, triangles: 1, primitives: 1,
    instance: { anchor: [4.9, 52.37] as [number, number], northOffsetDegrees: 0, mirror: false as const }, bounds: { min: [0, 0, 0], max: [10, 10, 5] }, height: 10,
    suppress: [], replaces: [], footprint: { type: 'MultiPolygon' as const, coordinates: [] }, pands: [] };
  assert.equal(chunkSpecFor(row).chunkLod2, undefined);
  assert.deepEqual(chunkSpecFor({ ...row, lod2: record }).chunkLod2, record);
  assert.equal(chunkSpecFor({ ...row, lod2: { ...record, sourceHash: 'stale' } }).chunkLod2, undefined);
});

test('projectedRadiusPx (lane R4-C): perspective size halves with distance, null behind the camera', async () => {
  const THREE = await import('three');
  const { projectedRadiusPx } = await import('./landmarkLod');
  const camera = new THREE.PerspectiveCamera(60, 1.5, 1, 1e5);
  camera.position.set(0, 0, 0); camera.lookAt(0, 0, -1); camera.updateMatrixWorld(true);
  const clip = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
  const near = projectedRadiusPx(clip, [0, 0, -500], 20, 1500, 1000)!, far = projectedRadiusPx(clip, [0, 0, -1000], 20, 1500, 1000)!;
  // 60° vertical field: 1000 px over 2*tan(30°)*500 m = 577 m, so 20 m at 500 m is ~34.6 px.
  assert.ok(Math.abs(near - 20 * 1000 / (2 * Math.tan(Math.PI / 6) * 500)) < 0.5, `${near}`);
  assert.ok(Math.abs(near / far - 2) < 0.02);
  assert.equal(projectedRadiusPx(clip, [0, 0, 500], 20, 1500, 1000), null);
});
