// Analytic windows and the tier probe (lane R2-A #228): flags, defines, program keys, and that the flag-off programs
// are exactly what they were (no define, no key suffix, no uniform the shader reads).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cityProgramKey, createCityLookMaterial, createCityUniforms, variantDefines, type CityVariant } from './cityLook.ts';
import { createLitFacadeMaterial } from '../rendererShared/litFacadeMaterial.ts';
import { CELL_DEBUG_CLASSES, CELL_UNDER_CLASS_NAMES, WINDOW_SDF_GLSL, coverTent, cellDebugClass, cellDebugHistogram, cellDebugMode, windowSdfEnabled, WINDOW_SDF_DESKTOP_DEFAULT, WINDOW_SDF_TOUCH_DEFAULT, WINDOW_SDF_BAND, barFade, bandFrameSpan, bandFrameWeight, coverBox, windowSdfBandEnabled, windowSdfBandUniforms, windowSdfBandValues } from './windowSdf.ts';
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
  assert.equal(cityProgramKey({ ...plain, windows: true }), 'city-look-v4|lit|chunk|swap|wsdf2');
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
  assert.equal(on.customProgramCacheKey(), 'shared-frame-facade-v7-wsdf2');
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
  assert.equal(h.facade, 2); assert.equal(h.counts[CELL_DEBUG_CLASSES.length - 1], 1); assert.equal(h.share[0], 0.5);
});

test('anisotropy-aware tier (lane R3-D #233): its define, uniforms and key suffix; ?cellDebug=under; the debug classes', () => {
  const v = { lit: true, kind: 'chunk' as const, swap: true };
  assert.equal(cityProgramKey({ ...v, aniso: true }), 'city-look-v4|lit|chunk|swap|aniso');
  assert.equal(cityProgramKey({ ...v, windows: true, lodBias: true, aniso: true }), 'city-look-v4|lit|chunk|swap|wsdf2|lodb|aniso');
  assert.ok('CELL_TIER_ANISO' in variantDefines({ ...v, aniso: true }));
  assert.ok(!('CELL_TIER_ANISO' in variantDefines(v)), 'absent without the flag: the major-axis rule');
  assert.ok(!('CELL_TIER_ANISO' in variantDefines({ ...v, kind: 'slot', aniso: true })), 'slot meshes never take the facade tier');
  const u = createCityUniforms(THREE);
  assert.equal(u.cellAniso.value, 16); assert.deepEqual(u.cellAnisoRule.value, [1, 1, 1, 2]);
  assert.equal(withGlobal('location', { search: '?cellDebug=under' }, () => cellDebugMode()), 'under');
  const d = variantDefines({ ...v, aniso: true, cellDebug: 'under' });
  assert.ok('CELL_DEBUG_UNDER' in d && 'CELL_DEBUG_RHO' in d && 'CELL_TIER_PROBE' in d);
  assert.equal(CELL_UNDER_CLASS_NAMES.length, CELL_DEBUG_CLASSES.length);
  assert.equal(CELL_DEBUG_CLASSES[CELL_DEBUG_CLASSES.length - 1].name, 'roof layer');
  // The lit facade material: its own define, uniforms and key suffix only when asked.
  const plain = createLitFacadeMaterial(THREE), aniso = createLitFacadeMaterial(THREE, {}, { aniso: 4 });
  assert.equal(plain.customProgramCacheKey(), 'shared-frame-facade-v7');
  assert.equal(aniso.customProgramCacheKey(), 'shared-frame-facade-v7-aniso');
  assert.ok(!('CELL_TIER_ANISO' in plain.defines) && 'CELL_TIER_ANISO' in aniso.defines);
  assert.equal(aniso.uniforms.cellAniso.value, 4); assert.equal(plain.uniforms.cellAniso, undefined);
});

// Band-limited windows (lane R3-B #231): the CPU twins of the shader's coverage and the band flags.
test('band twin: a 0.5 px frame drawn at the 1 px minimum integrates to 0.5 x its tone at any phase', () => {
  const fw = 10; // canvas px per screen px
  for (const phase of [0, 0.13, 0.37, 0.5, 0.81]) {
    const a = 100 + phase * fw;
    let sum = 0;
    for (let x = 80.5; x < 140; x += fw) sum += bandFrameWeight(x, a, 0.5 * fw, fw, 1.0, 1.0);
    assert.ok(Math.abs(sum - 0.5) < 1e-9, `phase ${phase}: ${sum}`);
    // Without the widening (frame min 0) the box alone integrates it too.
    let plain = 0;
    for (let x = 80.5; x < 140; x += fw) plain += bandFrameWeight(x, a, 0.5 * fw, fw, 0, 1.0);
    assert.ok(Math.abs(plain - 0.5) < 1e-9, `phase ${phase} plain: ${plain}`);
  }
  assert.deepEqual(bandFrameSpan(12, 10, 1), { drawn: 12, k: 1 });
  assert.deepEqual(bandFrameSpan(5, 10, 1), { drawn: 10, k: 0.5 });
  assert.equal(coverBox(0, -1, 1, 1), 1);
});

test('band twin: glazing bars fade out between the bar px and their area goes to the glass', () => {
  assert.deepEqual(WINDOW_SDF_BAND.barPx, [0, 0], 'the default never fades bars');
  assert.equal(barFade(4, 400, 0, 0), 1);
  const [from, to] = [1.5, 3];
  assert.equal(barFade(4, 4 / (from - 0.01), from, to), 0);
  assert.equal(barFade(4, 4 / (to + 0.01), from, to), 1);
  const mid = barFade(4, 4 / ((from + to) / 2), from, to);
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('band flags and uniforms: on by default, ?windowSdfBand=0 is round two; query knobs reach the uniform values', () => {
  assert.equal(windowSdfBandEnabled(), true);
  assert.equal(withGlobal('location', { search: '?windowSdfBand=0' }, () => windowSdfBandEnabled()), false);
  const b = WINDOW_SDF_BAND;
  assert.deepEqual(windowSdfBandValues(), { band: [1, b.footprint, b.fadePx[0], b.fadePx[1]], shape: [b.frameMinPx, b.barPx[0], b.barPx[1], b.tent ? 1 : 0] });
  assert.deepEqual(withGlobal('location', { search: '?windowSdfBand=0&windowSdfFoot=1.5&windowSdfFade=1,2&windowSdfFrameMin=0&windowSdfBar=2,4&windowSdfTent=1' }, () => windowSdfBandValues()), { band: [0, 1.5, 1, 2], shape: [0, 2, 4, 1] });
  const u1 = windowSdfBandUniforms(), u2 = windowSdfBandUniforms();
  assert.notEqual(u1.windowSdfBand, u2.windowSdfBand, 'each material its own uniform objects');
  // Round two's constants stay compiled in for band = 0.
  assert.match(WINDOW_SDF_GLSL, /band \? windowSdfBand\.y : 1\.25/);
  assert.match(WINDOW_SDF_GLSL, /vec2\(2\.5, 5\.0\)/);
});

test('band twin: the tent is a partition of unity at the pixel pitch (a thin bar sums to its width and keeps its peak)', () => {
  const fw = 8;
  for (const phase of [0, 0.2, 0.5, 0.9]) {
    const a = 100 + phase * fw, w = 0.3 * fw;
    let sum = 0;
    for (let x = 60.5; x < 150; x += fw) sum += coverTent(x, a, a + w, fw);
    assert.ok(Math.abs(sum - 0.3) < 1e-9, `phase ${phase}: ${sum}`);
  }
  assert.equal(coverTent(0, -100, 100, 1), 1);
});
