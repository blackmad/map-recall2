import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { disposeShadowPrimer, PRIMER_NAME, shadowPrimer } from './shadowPrimer';
import { SHADOW_ONLY_LAYER } from './shadowStandIns';

test('shadow primer: one zero-area caster per depth-program variant, shadow layer only', () => {
  const group = shadowPrimer(THREE);
  assert.equal(group.name, PRIMER_NAME);
  const meshes = group.children as any[];
  assert.equal(meshes.length, 6);
  const variants = new Set(meshes.map(m => `${m.material.side}:${!!m.isInstancedMesh}`));
  assert.equal(variants.size, 6, 'front/back/double x plain/instanced');
  const main = new THREE.Layers();
  for (const m of meshes) {
    assert.equal(m.castShadow, true);
    assert.equal(m.frustumCulled, false);
    assert.equal(m.layers.isEnabled(SHADOW_ONLY_LAYER), true);
    assert.equal(m.layers.test(main), false, 'the main camera (layer 0) never draws it');
    const p = m.geometry.getAttribute('position');
    const a = new THREE.Vector3().fromBufferAttribute(p, 0), b = new THREE.Vector3().fromBufferAttribute(p, 1), c = new THREE.Vector3().fromBufferAttribute(p, 2);
    assert.equal(new THREE.Triangle(a, b, c).getArea(), 0, 'rasterises nothing');
  }
  const scene = new THREE.Scene();
  scene.add(group);
  let disposed = 0;
  meshes[0].geometry.addEventListener('dispose', () => disposed++);
  disposeShadowPrimer(group);
  assert.equal(group.parent, null);
  assert.equal(disposed, 1, 'the shared geometry is freed once');
});
