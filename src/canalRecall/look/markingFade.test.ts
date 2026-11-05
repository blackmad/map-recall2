import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKING_FADE_DEFAULT, MARKING_FADE_FROM_M, MARKING_FADE_STRENGTH, markingFadeFlag, markingFadeRange, markingFadeUniforms, markingFadeWeight } from './markingFade.ts';
import { groundProgram } from '../ownGround/groundMaterial.ts';
import { DEPTH_FADE_MIN_NEAR_M } from './depthFade.ts';

test('markingFadeFlag: on by default, ?markingFade=0 off', () => {
  const g = globalThis as { __canalRecallMarkingFade?: unknown };
  assert.equal(markingFadeFlag(), MARKING_FADE_DEFAULT);
  g.__canalRecallMarkingFade = '1'; assert.equal(markingFadeFlag(), true);
  g.__canalRecallMarkingFade = '0'; assert.equal(markingFadeFlag(), false);
  delete g.__canalRecallMarkingFade;
});

test('the near field keeps its markings; far paint becomes the asphalt, far cycle red keeps a hint', () => {
  const chase = markingFadeRange(40);
  // The later of 120 m and the depth fade's start: since the gentler depth fade (2026-11-05) a chase camera's
  // markings fade from 200 m, with the haze.
  assert.equal(chase.from, Math.max(MARKING_FADE_FROM_M, DEPTH_FADE_MIN_NEAR_M), 'a chase camera fades with the depth fade');
  assert.ok(markingFadeRange(350).from > 250, 'a high camera starts with the depth fade, not inside its near frame');
  assert.equal(markingFadeWeight(chase.from - 1, chase, MARKING_FADE_STRENGTH.paint), 0);
  assert.equal(markingFadeWeight(chase.to, chase, MARKING_FADE_STRENGTH.paint), 1);
  assert.equal(markingFadeWeight(chase.to + 500, chase, MARKING_FADE_STRENGTH.cycle), 0.7);
});

const shaderOf = (marking: { tone: number[]; strength: number } | null) => {
  const m = { type: 'MeshStandardMaterial', onBeforeCompile: (_s: unknown, _r: unknown) => {}, customProgramCacheKey: () => '', clone() { return this; } };
  groundProgram(m, null, marking);
  const shader = { vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>', fragmentShader: '#include <common>\n#include <clipping_planes_fragment>\n#include <color_fragment>', uniforms: {} as Record<string, { value: unknown }> };
  m.onBeforeCompile(shader, null);
  return { shader, key: m.customProgramCacheKey() };
};

test('flag off: the ground programs are exactly as before; on: one shared edit, strength per layer', () => {
  const g = globalThis as { __canalRecallMarkingFade?: unknown };
  g.__canalRecallMarkingFade = false;
  const off = shaderOf({ tone: [0.2, 0.2, 0.2], strength: 1 });
  assert.doesNotMatch(off.shader.fragmentShader + off.shader.vertexShader, /ownMark|vOwnEyeDist/);
  assert.equal(off.shader.uniforms.ownMarkStrength, undefined);
  g.__canalRecallMarkingFade = true;
  try {
    const paint = shaderOf({ tone: [0.2, 0.2, 0.2], strength: 1 }), asphalt = shaderOf(null);
    assert.equal(paint.shader.fragmentShader, asphalt.shader.fragmentShader, 'one program source for every kind');
    assert.equal(paint.key, asphalt.key);
    assert.equal(paint.key, off.key, 'same program key as before');
    assert.equal(paint.shader.uniforms.ownMarkStrength.value, 1);
    assert.equal(asphalt.shader.uniforms.ownMarkStrength.value, 0);
    assert.equal(paint.shader.uniforms.ownMarkFrom, markingFadeUniforms().ownMarkFrom, 'the range is shared');
    assert.match(paint.shader.vertexShader, /vOwnEyeDist = length\(mvPosition\.xyz\)/);
  } finally { delete g.__canalRecallMarkingFade; }
});
