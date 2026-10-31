import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fadeClone, groundProgram, OPAQUE_FADE, type ShaderSource } from './groundMaterial.js';

/** Run a material's `onBeforeCompile` on the standard shader, as three.js does before linking. */
function compiled(m: any): ShaderSource {
  const lib = THREE.ShaderLib.standard;
  const shader: ShaderSource = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms) };
  m.onBeforeCompile(shader, null);
  return shader;
}

const blend = { blend: { value: 1 }, presence: { value: 1 } };

test('a dissolving clone shares its source program: same key, same source, own ownFade uniform', () => {
  for (const flat of [[0.5, 0.5, 0.5], 'vertex'] as const) {
    const base = new THREE.MeshStandardMaterial();
    groundProgram(base, { ...blend, flat });
    const fade = { value: 0.25 };
    const clone = fadeClone(base, fade);
    assert.equal(clone.customProgramCacheKey(), base.customProgramCacheKey());
    const a = compiled(base), b = compiled(clone);
    assert.equal(b.vertexShader, a.vertexShader);
    assert.equal(b.fragmentShader, a.fragmentShader);
    assert.equal(a.uniforms.ownFade, OPAQUE_FADE);
    assert.equal(b.uniforms.ownFade, fade);
    assert.match(a.fragmentShader, /ownFade < 1\.0/);
  }
});

test('the dissolve is compiled in without the overview blend too', () => {
  const base = new THREE.MeshStandardMaterial();
  groundProgram(base, null);
  const clone = fadeClone(base, { value: 0 });
  assert.equal(clone.customProgramCacheKey(), base.customProgramCacheKey());
  assert.equal(compiled(clone).fragmentShader, compiled(base).fragmentShader);
  assert.doesNotMatch(compiled(base).fragmentShader, /ownBlend/);
});

test('the same kind on two layers shares one key', () => {
  const a = new THREE.MeshStandardMaterial({ color: 'red' }), b = new THREE.MeshStandardMaterial({ color: 'blue' });
  groundProgram(a, { ...blend, flat: [1, 0, 0] });
  groundProgram(b, { ...blend, flat: [0, 0, 1] });
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
  assert.equal(compiled(a).fragmentShader, compiled(b).fragmentShader);
});
