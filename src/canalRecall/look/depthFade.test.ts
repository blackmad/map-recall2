import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthFadeColour, depthFadeDetail, depthFadeFlag, depthFadeRange, installDepthFade, DEPTH_FADE_DEFAULT, DEPTH_FADE_MIN_NEAR_M } from './depthFade.ts';

test('depthFadeFlag: ?depthFade=1 on, 0 off, default until the look review', () => {
  const gl = globalThis as { __canalRecallDepthFade?: unknown };
  assert.equal(depthFadeFlag(), DEPTH_FADE_DEFAULT);
  gl.__canalRecallDepthFade = '1'; assert.equal(depthFadeFlag(), true);
  gl.__canalRecallDepthFade = '0'; assert.equal(depthFadeFlag(), false);
  delete gl.__canalRecallDepthFade;
});

test('the range scales with the eye-to-centre distance and never starts inside 80 m', () => {
  const chase = depthFadeRange(40);
  assert.ok(chase.near >= DEPTH_FADE_MIN_NEAR_M && chase.far >= chase.near * 2);
  assert.ok(depthFadeRange(3000).near >= 2400, 'the fade starts past the view centre');
  assert.equal(depthFadeRange(5).near, DEPTH_FADE_MIN_NEAR_M);
  assert.deepEqual(depthFadeRange(Number.NaN), { near: DEPTH_FADE_MIN_NEAR_M, far: DEPTH_FADE_MIN_NEAR_M * 2 });
});

test('the near field is unchanged; far colour loses saturation and contrast but is not the haze', () => {
  const haze: [number, number, number] = [0.63, 0.78, 0.9];
  const brick: [number, number, number] = [0.6, 0.3, 0.2], pane: [number, number, number] = [0.1, 0.1, 0.12];
  const r = depthFadeRange(40);
  assert.deepEqual(depthFadeColour(brick, haze, 79, r), brick);
  const fb = depthFadeColour(brick, haze, r.far, r), fp = depthFadeColour(pane, haze, r.far, r);
  const chroma = (c: number[]) => Math.max(...c) - Math.min(...c);
  assert.ok(chroma(fb) < chroma(brick) * 0.6, 'saturation fades');
  assert.ok(Math.abs(fb[1] - fp[1]) < Math.abs(brick[1] - pane[1]) * 0.6, 'contrast compresses');
  assert.notDeepEqual(fb.map(x => x.toFixed(2)), haze.map(x => x.toFixed(2)), 'not a fog to one colour');
  assert.equal(depthFadeDetail(149, r), 0);
  assert.equal(depthFadeDetail(400, r), 1);
  const high = depthFadeRange(600);
  assert.equal(depthFadeDetail(450, high), 0, 'a high camera keeps detail up to its fade start');
});

test('installDepthFade swaps both fog chunks, once', () => {
  const THREE = { ShaderChunk: { fog_vertex: 'a', fog_fragment: 'b' } as Record<string, string> };
  installDepthFade(THREE);
  assert.match(THREE.ShaderChunk.fog_vertex, /length\( mvPosition\.xyz \)/);
  assert.match(THREE.ShaderChunk.fog_fragment, /fadeLuma/);
  THREE.ShaderChunk.fog_vertex = 'x';
  installDepthFade(THREE);
  assert.equal(THREE.ShaderChunk.fog_vertex, 'x');
});
