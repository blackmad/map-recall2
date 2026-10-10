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
});
