// Analytic windows and the tier probe (lane R2-A #228): flags, defines, program keys, and that the flag-off programs
// are exactly what they were (no define, no key suffix, no uniform the shader reads).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cityProgramKey, createCityLookMaterial, createCityUniforms, variantDefines, type CityVariant } from './cityLook.ts';
import { createLitFacadeMaterial } from '../rendererShared/litFacadeMaterial.ts';
import { CELL_DEBUG_CLASSES, WINDOW_SDF_GLSL, cellDebugClass, cellDebugHistogram, cellDebugMode, windowSdfEnabled, WINDOW_SDF_DESKTOP_DEFAULT, WINDOW_SDF_TOUCH_DEFAULT } from './windowSdf.ts';
import { createWindowTableTexture } from './windowTable.ts';

const withGlobal = <T>(key: string, value: unknown, fn: () => T): T => {
  const g = globalThis as Record<string, unknown>, had = key in g, prev = g[key];
  g[key] = value;
  try { return fn(); } finally { if (had) g[key] = prev; else delete g[key]; }
};

test('flags: analytic windows follow the tier defaults unless asked; ?windowSdf=0 off, =1 on; cellDebug off by default', () => {
  assert.equal(windowSdfEnabled(false), WINDOW_SDF_DESKTOP_DEFAULT);
  assert.equal(windowSdfEnabled(true), WINDOW_SDF_TOUCH_DEFAULT);
  assert.equal(withGlobal('__canalRecallWindowSdf', false, () => windowSdfEnabled(false)), false);
  assert.equal(withGlobal('__canalRecallWindowSdf', true, () => windowSdfEnabled(true)), true);
  assert.equal(withGlobal('location', { search: '?windowSdf=0' }, () => windowSdfEnabled(false)), false);
  assert.equal(withGlobal('location', { search: '?windowSdf=1' }, () => windowSdfEnabled(true)), true);
  assert.equal(cellDebugMode(), null);
  assert.equal(withGlobal('location', { search: '?cellDebug=rho' }, () => cellDebugMode()), 'rho');
});

test('defines and program keys: only the windows / debug variants carry the probe; the default keys are unchanged', () => {
  const plain: CityVariant = { lit: true, kind: 'chunk', swap: true };
  assert.equal(cityProgramKey(plain), 'city-look-v4|lit|chunk|swap');
  assert.equal(cityProgramKey({ ...plain, windows: true }), 'city-look-v4|lit|chunk|swap|wsdf1');
  assert.equal(cityProgramKey({ ...plain, cellDebug: 'rho' }), 'city-look-v4|lit|chunk|swap|dbg-rho');
  const d = (v: CityVariant) => Object.keys(variantDefines(v)).filter(k => !k.startsWith('HL_')).sort();
  assert.deepEqual(d(plain), ['CITY_SLOT_COUNT', 'CITY_SWAP', 'CITY_VARIANT_UNIFORMS']);
  assert.deepEqual(d({ ...plain, windows: true }), ['CELL_TIER_PROBE', 'CITY_SLOT_COUNT', 'CITY_SWAP', 'CITY_VARIANT_UNIFORMS', 'CITY_WINDOW_SDF']);
  // Slot meshes never take the facade windows (they have no window table rows).
  assert.ok(!('CITY_WINDOW_SDF' in variantDefines({ lit: true, kind: 'slot', windows: true })));
});

const compiled = (m: any) => {
  const lib = THREE.ShaderLib.lambert;
  const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms) };
  m.onBeforeCompile(shader, null);
  return shader;
};

test('city look chunk material: the window call is compiled in only under its define, and reads the shared table', () => {
  const table = createWindowTableTexture(THREE, 'photo');
  const uniforms = createCityUniforms(THREE, { windowTable: { value: table } });
  const on = createCityLookMaterial(THREE, { lit: true, kind: 'chunk', windows: true }, uniforms);
  const off = createCityLookMaterial(THREE, { lit: true, kind: 'chunk' }, createCityUniforms(THREE));
  const s = compiled(on);
  assert.match(s.fragmentShader, /#ifdef CITY_WINDOW_SDF\nwindowSdf\(cityUv, vLayer, 1\.0 - cellFar, cityC, cityM\);/);
  assert.equal(s.uniforms.windowTable.value, table);
  assert.equal(s.uniforms.windowSdfMix.value, 1);
  assert.ok('CITY_WINDOW_SDF' in on.defines && !('CITY_WINDOW_SDF' in off.defines));
  assert.notEqual(on.customProgramCacheKey(), off.customProgramCacheKey());
  // GLSL ES reserves `half`, `input`, `output`, `filter`, `sample`: none may name a variable in the injected code.
  for (const word of ['half', 'input', 'output', 'filter', 'sample', 'active']) assert.ok(!new RegExp(`\\b${word}\\b`).test(WINDOW_SDF_GLSL), word);
});

test('lit facade material (cityLook=0): same window injection under the same define, key suffixed; off is v7 exactly', () => {
  const table = createWindowTableTexture(THREE, 'photo');
  const off = createLitFacadeMaterial(THREE), on = createLitFacadeMaterial(THREE, undefined, { windowTable: table });
  assert.equal(off.customProgramCacheKey(), 'shared-frame-facade-v7');
  assert.equal(on.customProgramCacheKey(), 'shared-frame-facade-v7-wsdf1');
  assert.ok(!('CITY_WINDOW_SDF' in off.defines) && 'CITY_WINDOW_SDF' in on.defines);
  const s = compiled(on);
  assert.match(s.fragmentShader, /windowSdf\(vFacUv, vLayer, 1\.0 - cellFar, fc, fm\);/);
  assert.equal(s.uniforms.windowTable.value, table);
  assert.equal(compiled(off).uniforms.windowTable, undefined);
});

test('table texture: nearest, no mips, float RGBA, under 64 KB', () => {
  const t = createWindowTableTexture(THREE, 'photo');
  assert.equal(t.minFilter, THREE.NearestFilter); assert.equal(t.generateMipmaps, false); assert.equal(t.type, THREE.FloatType);
  assert.ok(t.userData.bytes < 64 * 1024);
});

test('rho debug classes: exact colours classify to themselves, a slot-mesh brick is none', () => {
  CELL_DEBUG_CLASSES.forEach((c, i) => assert.equal(cellDebugClass(c.rgb[0], c.rgb[1], c.rgb[2]), i));
  assert.equal(cellDebugClass(150, 80, 60), -1, 'a brick wall (a slot mesh, not a chunk) is not a debug pixel');
  const px = new Uint8Array([255, 0, 0, 0, 255, 0, 128, 128, 128, 20, 30, 40]);
  const h = cellDebugHistogram(px, 4, 1, 3);
  assert.equal(h.facade, 2); assert.equal(h.counts[8], 1); assert.equal(h.share[0], 0.5);
});
