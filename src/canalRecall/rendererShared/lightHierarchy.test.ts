import test from 'node:test';
import assert from 'node:assert/strict';
import { SUNNY_LIGHT_RIG, activeLightRig } from './lightRig';
import { LIGHT_HIER_SHADOW, lightHierarchyFlag, withLightHierarchy } from './lightHierarchy';

test('quieter fill and deeper shadow; the key is untouched', () => {
  const calm = withLightHierarchy(SUNNY_LIGHT_RIG);
  assert.ok(calm.skyIntensity < SUNNY_LIGHT_RIG.skyIntensity);
  assert.equal(calm.shadowIntensity, LIGHT_HIER_SHADOW);
  assert.equal(calm.sunIntensity, SUNNY_LIGHT_RIG.sunIntensity);
  assert.equal(calm.sunColour, SUNNY_LIGHT_RIG.sunColour);
  assert.equal(calm.sunElevationDeg, SUNNY_LIGHT_RIG.sunElevationDeg);
});

test('off by default and by an unrelated query; the active rig is the sunny rig then', () => {
  assert.equal(lightHierarchyFlag(''), false);
  assert.equal(lightHierarchyFlag('?lightHier=1'), true);
  assert.deepEqual(activeLightRig(''), SUNNY_LIGHT_RIG);
});
