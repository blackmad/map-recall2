// node --import tsx --test src/canalRecall/look/gridReveal.test.ts
// Window reveal depth on the shader grid (`?gridReveal=1`, lane large-buildings-20261120 round 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cityProgramKey, createCityLookMaterial, createCityUniforms, gridRevealOn, variantDefines, variantKey } from './cityLook.ts';
import { GRID_REVEAL_PARAM, gridRevealEnabled } from './windowGridGlsl.ts';

const compiled = (m: any) => {
  const lib = THREE.ShaderLib.lambert;
  const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms) };
  m.onBeforeCompile(shader, null);
  return shader;
};

test('flag: off by default; ?gridReveal=1 turns it on', () => {
  assert.equal(GRID_REVEAL_PARAM, 'gridReveal');
  assert.equal(gridRevealEnabled(''), false);
  assert.equal(gridRevealEnabled('?gridReveal=0'), false);
  assert.equal(gridRevealEnabled('?cityLook=1&gridReveal=1'), true);
});

test('flag off: keys, defines and shader text are what they were', () => {
  const uniforms = createCityUniforms(THREE);
  assert.equal(cityProgramKey({ lit: true, kind: 'slot' }), 'city-look-v4|lit|slot');
  assert.equal(variantKey({ lit: true, kind: 'slot', uv: 'uv' }), 'lit|slot|uv|-|0');
  const src = compiled(createCityLookMaterial(THREE, { lit: true, kind: 'slot', uv: 'uv' }, uniforms)).fragmentShader;
  assert.match(src, /if \(vGrid > 0\.5\) cityWindowGrid\(vFacUv \/ vSlot\.x, cityC, cityM\);/);
  assert.doesNotMatch(src, /cityWindowGridReveal|cityGridBox/);
  assert.doesNotMatch(JSON.stringify(variantDefines({ lit: true, kind: 'slot' })), /REVEAL/);
});

test('flag on: lit slot meshes take the inset grid; unlit and chunk variants ignore it', () => {
  const uniforms = createCityUniforms(THREE);
  const on = { lit: true, kind: 'slot' as const, uv: 'uv' as const, gridReveal: true };
  assert.equal(gridRevealOn(on), true);
  assert.equal(gridRevealOn({ ...on, lit: false }), false);
  assert.equal(gridRevealOn({ ...on, kind: 'chunk' }), false);
  assert.equal(cityProgramKey(on), 'city-look-v4|lit|slot|grev');
  assert.equal(variantKey(on), 'lit|slot|uv|-|0|grev');
  assert.equal(variantDefines(on).CITY_GRID_REVEAL, '');
  const src = compiled(createCityLookMaterial(THREE, on, uniforms)).fragmentShader;
  assert.match(src, /if \(vGrid > 0\.5\) cityWindowGridReveal\(vFacUv \/ vSlot\.x, -vViewPosition, cityC, cityM\);/);
  assert.match(src, /void cityWindowGridReveal\(vec2 m, vec3 p, inout vec3 c, inout vec2 mk\)/);
  // Lambert declares the view position the inset reads (lights_lambert_pars_fragment, before main)
  assert.match(THREE.ShaderChunk.lights_lambert_pars_fragment, /varying vec3 vViewPosition;/);
  assert.ok(src.indexOf('#include <lights_lambert_pars_fragment>') < src.indexOf('cityWindowGridReveal(vFacUv'));
});
