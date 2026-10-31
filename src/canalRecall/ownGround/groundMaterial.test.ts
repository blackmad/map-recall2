import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cutClone, fadeClone, groundProgram, MASK_CHANNEL, NO_CUT, OPAQUE_FADE, type ShaderSource } from './groundMaterial.js';

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

test('cut clones (either channel) share the base program; the base never samples its mask', () => {
  const base = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  groundProgram(base, { ...blend, flat: [0.2, 0.3, 0.4] });
  const mask = { waterMask: { value: new THREE.Texture() }, maskOrigin: { value: new THREE.Vector2(10, 20) }, maskSize: { value: new THREE.Vector2(400, 400) } };
  const r = cutClone(base, mask, 'r'), g = cutClone(base, mask, 'g');
  const faded = fadeClone(r, { value: 0.5 });
  const src = compiled(base);
  for (const m of [r, g, faded]) {
    assert.equal(m.customProgramCacheKey(), base.customProgramCacheKey());
    const c = compiled(m);
    assert.equal(c.vertexShader, src.vertexShader);
    assert.equal(c.fragmentShader, src.fragmentShader);
    assert.equal(c.uniforms.waterMask, mask.waterMask);
  }
  assert.deepEqual(compiled(r).uniforms.maskChannel.value, MASK_CHANNEL.r);
  assert.deepEqual(compiled(g).uniforms.maskChannel.value, MASK_CHANNEL.g);
  assert.equal(compiled(faded).uniforms.ownFade.value, 0.5);
  // Not cut: the extent is far outside any scene coordinate (±15 km), so the bounds test fails before the fetch.
  assert.equal(src.uniforms.waterMask, NO_CUT.waterMask);
  assert.ok((src.uniforms.maskOrigin.value as number[])[0] > 1e6);
  assert.match(src.fragmentShader, /dot\(texture2D\(waterMask, vMaskUV\), maskChannel\) < 0\.5\) discard;/);
});

test('the flat tone and the vertex tone are one program; the choice is ownFlatFromVertex', () => {
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true }), vc = new THREE.MeshStandardMaterial({ vertexColors: true });
  groundProgram(flat, { ...blend, flat: [0.1, 0.2, 0.3] });
  groundProgram(vc, { ...blend, flat: 'vertex' });
  assert.equal(flat.customProgramCacheKey(), vc.customProgramCacheKey());
  const a = compiled(flat), b = compiled(vc);
  assert.equal(a.fragmentShader, b.fragmentShader);
  assert.equal(a.uniforms.ownFlatFromVertex.value, 0);
  assert.equal(b.uniforms.ownFlatFromVertex.value, 1);
  assert.deepEqual(a.uniforms.ownFlat.value, [0.1, 0.2, 0.3]);
});
