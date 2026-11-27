import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthInstanceColorKept, hideInstanceColor, installDepthIgnoresInstanceColor, restoreInstanceColor } from './depthInstanceColor';

// Named regression (GL program budget, 2026-11-27): an instanced mesh with instance colours compiled a second shadow
// depth program (instancingColor) per side; depth never reads colour.
test('the depth draw sees no instance colour; the colour pass gets it back', () => {
  const colour = { array: new Float32Array(3) };
  const mesh = { instanceColor: colour as unknown };
  hideInstanceColor.call(mesh);
  assert.equal(mesh.instanceColor, null);
  restoreInstanceColor.call(mesh);
  assert.equal(mesh.instanceColor, colour);
  const plain = { instanceColor: null as unknown };
  hideInstanceColor.call(plain); restoreInstanceColor.call(plain);
  assert.equal(plain.instanceColor, null);
});

test('installed once on the prototype; ?depthInstanceColor=1 keeps three\'s keying', () => {
  class InstancedMesh { onBeforeShadow() {} onAfterShadow() {} }
  const THREE = { InstancedMesh };
  assert.equal(installDepthIgnoresInstanceColor(THREE, '1'), false);
  assert.equal(installDepthIgnoresInstanceColor(THREE), true);
  assert.equal(installDepthIgnoresInstanceColor(THREE), false);
  assert.equal((InstancedMesh.prototype as any).onBeforeShadow, hideInstanceColor);
  for (const v of [undefined, null, '0', false]) assert.equal(depthInstanceColorKept(v), false);
});
