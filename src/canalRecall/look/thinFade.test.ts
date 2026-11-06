// Thin-element fade (lane R3-A, #230): the cross-section, the ramp, the shader patch on the real city-look and lit
// facade shaders, the off switch, and the chunk attribute buildChunk writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { THIN_CLASS, THIN_OWNER_CLASSES, installThinFade, patchThinShaders, thinCm, thinFadeCoverage, thinFocalPx } from './thinFade.ts';
import { createCityLookMaterial, createCityUniforms } from './cityLook.ts';
import { createLitFacadeMaterial } from '../rendererShared/litFacadeMaterial.ts';
import { buildFeatureChunk, ORIGIN } from '../threeBuildingFeatures.ts';

test('thinCm: the shortest altitude, in cm; wide faces are not thin', () => {
  // Half of a 0.1 m × 10 m strip (a string course): ~10 cm.
  assert.equal(thinCm([0, 0, 0], [10, 0, 0], [10, 0, 0.1]), 10);
  // A 0.04 m railing bar 1 m tall: 4 cm.
  assert.equal(thinCm([0, 0, 0], [0.04, 0, 0], [0.04, 0, 1]), 4);
  // A 6 m × 5 m face is not a thin element (its 3.8 m altitude is past THIN_MAX_CM).
  assert.equal(thinCm([0, 0, 0], [6, 0, 0], [6, 0, 5]), 0);
  // Degenerate triangles still read as thin (1 cm), never 0 (= solid).
  assert.equal(thinCm([0, 0, 0], [1, 0, 0], [2, 0, 0]), 1);
});

test('the ramp: gone under 1 px, solid from 2 px; the focal length from the projection', () => {
  assert.equal(thinFadeCoverage(0.5), 0);
  assert.equal(thinFadeCoverage(1), 0);
  assert.equal(thinFadeCoverage(1.5), 0.5);
  assert.equal(thinFadeCoverage(2.5), 1);
  // 36.87° vertical field of view, a 1314 px drawing buffer (the user's S3 window at DPR 2): 1971 px per metre at 1 m.
  const p11 = 1 / Math.tan((36.86989764584402 / 2) * Math.PI / 180);
  assert.ok(Math.abs(thinFocalPx(p11, 1314) - 1971) < 1);
  // A 0.16 m coping at the slab's 150 m is 2.1 px there: drawn. At 400 m it is 0.8 px: faded out.
  assert.ok(0.16 * thinFocalPx(p11, 1314) / 150 > 2 && 0.16 * thinFocalPx(p11, 1314) / 400 < 1);
});

test('owner classes: one colour per class, far apart (the bucket tolerance is L1 < 90)', () => {
  assert.equal(new Set(THIN_OWNER_CLASSES.map(c => c.id)).size, Object.keys(THIN_CLASS).length);
  for (const [i, a] of THIN_OWNER_CLASSES.entries()) for (const b of THIN_OWNER_CLASSES.slice(i + 1)) {
    assert.ok(a.rgb.reduce((s: number, v: number, k: number) => s + Math.abs(v - b.rgb[k]), 0) >= 254, `${a.name} vs ${b.name}`);
  }
});

const chunkMaterial = (lit: boolean) => createCityLookMaterial(THREE, { lit, kind: 'chunk', side: THREE.FrontSide }, createCityUniforms(THREE));
/** The lit material's final shader strings: three's Lambert source through the material's onBeforeCompile. */
function compiled(material: any) {
  const shader = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader, uniforms: {} as Record<string, any> };
  material.onBeforeCompile(shader, null);
  return shader;
}

test('city look, unlit and lit: patched behind CITY_THIN_FADE with its own program key, the hook anchors present', () => {
  const g = globalThis as Record<string, unknown>;
  try {
    g.__canalRecallThinFade = false;
    const offUnlit = chunkMaterial(false), offLit = chunkMaterial(true);
    assert.ok(!('CITY_THIN_FADE' in (offUnlit.defines ?? {})) && !offUnlit.vertexShader.includes('vThinM'), 'off: unlit shader untouched');
    assert.ok(!('CITY_THIN_FADE' in offLit.defines) && !compiled(offLit).fragmentShader.includes('thinFocalPx'), 'off: lit defines and shader untouched');
    g.__canalRecallThinFade = undefined;
    const unlit = chunkMaterial(false), lit = chunkMaterial(true);
    assert.ok('CITY_THIN_FADE' in unlit.defines && unlit.vertexShader.includes('vThinM = thin.x * 0.01') && unlit.fragmentShader.includes('thinFocalPx'), 'on: unlit patched');
    assert.equal(unlit.uniforms.thinFocalPx.value > 0, true);
    assert.deepEqual(unlit.defaultAttributeValues.thin, [0, 0], 'a mesh without the attribute is never thin');
    assert.ok('CITY_THIN_FADE' in lit.defines && lit.customProgramCacheKey() === offLit.customProgramCacheKey(), 'on: lit define (three hashes defines into the key); the registry key is unchanged');
    const s = compiled(lit);
    assert.ok(s.vertexShader.includes('vThinM = thin.x * 0.01') && s.fragmentShader.includes('thinCover') && s.uniforms.thinFocalPx, 'on: lit shader patched');
    // Slot meshes (landmarks, recipe houses) carry no attribute and are left alone.
    const slot = createCityLookMaterial(THREE, { lit: true, kind: 'slot', side: THREE.FrontSide }, createCityUniforms(THREE));
    assert.ok(!('CITY_THIN_FADE' in slot.defines));
    // The owner view: its own key and define.
    g.__canalRecallThinDebug = 'owner';
    const owner = chunkMaterial(true);
    assert.ok('CITY_THIN_OWNER' in owner.defines && compiled(owner).fragmentShader.includes('thinOwnerColour(vThinClass)'));
  } finally { delete g.__canalRecallThinFade; delete g.__canalRecallThinDebug; }
});

test('lit facade material: patched the same way; the focal length follows the drawing buffer', () => {
  const m = createLitFacadeMaterial(THREE, {});
  assert.ok('CITY_THIN_FADE' in m.defines && m.customProgramCacheKey() === 'shared-frame-facade-v7');
  const s = compiled(m);
  assert.ok(s.vertexShader.includes('vThinM') && s.fragmentShader.includes('thinCover'));
  const camera = new THREE.PerspectiveCamera(36.86989764584402, 1448 / 657, 1, 1000);
  m.onBeforeRender({ getDrawingBufferSize: (v: any) => v.set(2896, 1314).floor() }, null, camera);
  assert.ok(Math.abs(s.uniforms.thinFocalPx.value - 1971) < 1);
});

test('patchThinShaders: a missing anchor leaves the material alone', () => {
  assert.equal(patchThinShaders('void main() {}', 'void main() {}', false), null);
  assert.equal(installThinFade({ vertexShader: 'void main() {}', fragmentShader: 'void main() {}', uniforms: {} }, false, { fade: true }).uniforms.thinFocalPx, undefined);
});

test('buildChunk: two bytes a vertex; walls and lids are never thin, extras strips are', () => {
  const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
  const ll = (x: number, y: number) => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
  const feature = { type: 'Feature' as const, properties: { id: 'thin-fade-house', height: 14, minHeight: 0, facade: 'c19-priorBrickRed', facadeStyle: 'c19', constructionYear: 1890 }, geometry: { type: 'Polygon', coordinates: [[ll(0, 0), ll(7, 0), ll(7, 12), ll(0, 12), ll(0, 0)]] } };
  const streets = new Float32Array([-20, -4, 20, -4]);
  for (const mode of ['walls', 'extras'] as const) {
    const chunk = buildFeatureChunk([feature] as any, 'photo', mode, streets);
    assert.ok(chunk.thin && chunk.thin.length === chunk.vertexCount * 2, `${mode}: thin attribute sized`);
    const classes = new Map<number, number[]>();
    for (let v = 0; v < chunk.vertexCount; v++) { const c = chunk.thin![v * 2 + 1]; (classes.get(c) ?? classes.set(c, []).get(c)!).push(chunk.thin![v * 2]); }
    for (const c of [THIN_CLASS.wall, THIN_CLASS.lid, THIN_CLASS.roof]) assert.ok((classes.get(c) ?? []).every(t => t === 0), `${mode}: class ${c} never fades`);
    if (mode === 'walls') assert.ok(classes.has(THIN_CLASS.wall), 'walls: wall quads');
    else {
      const strips = classes.get(THIN_CLASS.extrasStrip) ?? [];
      assert.ok(strips.length && strips.every(t => t > 0 && t <= 254), 'extras: strips carry their cross-section');
      assert.ok(![...classes.keys()].includes(THIN_CLASS.wall), 'extras: no wall quads');
    }
  }
});
