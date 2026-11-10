import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthFadeColour, depthFadeDetail, depthFadeFlag, depthFadeFogFragment, depthFadeRange, depthFadeStrength, distanceHazeOn, installDepthFade, setDistanceHaze, DEPTH_FADE_DEFAULT, DEPTH_FADE_DETAIL_GLSL, DEPTH_FADE_MIN_NEAR_M } from './depthFade.ts';

test('depthFadeFlag: on by default, ?depthFade=0 off', () => {
  const gl = globalThis as { __canalRecallDepthFade?: unknown };
  assert.equal(depthFadeFlag(), DEPTH_FADE_DEFAULT);
  gl.__canalRecallDepthFade = '1'; assert.equal(depthFadeFlag(), true);
  gl.__canalRecallDepthFade = '0'; assert.equal(depthFadeFlag(), false);
  delete gl.__canalRecallDepthFade;
});

test('the range scales with the eye-to-centre distance and never starts inside 200 m', () => {
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
  assert.deepEqual(depthFadeColour(brick, haze, 199, r), brick, 'nothing fades inside 200 m');
  const fb = depthFadeColour(brick, haze, r.far, r), fp = depthFadeColour(pane, haze, r.far, r);
  const chroma = (c: number[]) => Math.max(...c) - Math.min(...c);
  assert.ok(chroma(fb) < chroma(brick) * 0.6, 'saturation fades');
  assert.ok(Math.abs(fb[1] - fp[1]) < Math.abs(brick[1] - pane[1]) * 0.8, 'contrast compresses');
  assert.ok(Math.abs(fb[1] - fp[1]) > Math.abs(brick[1] - pane[1]) * 0.6, 'gently (2026-11-05): most of the contrast survives');
  assert.notDeepEqual(fb.map(x => x.toFixed(2)), haze.map(x => x.toFixed(2)), 'not a fog to one colour');
  assert.equal(depthFadeDetail(249, r), 0);
  assert.equal(depthFadeDetail(600, r), 1);
  const high = depthFadeRange(600);
  assert.equal(depthFadeDetail(450, high), 0, 'a high camera keeps detail up to its fade start');
});

test('?fadeStrength scales the desaturation, the haze and the detail blend together; 0 is no fade', () => {
  const g = globalThis as { __canalRecallFadeStrength?: unknown };
  assert.equal(depthFadeStrength(), 1);
  g.__canalRecallFadeStrength = '0.5'; assert.equal(depthFadeStrength(), 0.5);
  g.__canalRecallFadeStrength = '7'; assert.equal(depthFadeStrength(), 2);
  g.__canalRecallFadeStrength = 'x'; assert.equal(depthFadeStrength(), 1);
  delete g.__canalRecallFadeStrength;
  const haze: [number, number, number] = [0.63, 0.78, 0.9], brick: [number, number, number] = [0.6, 0.3, 0.2];
  const r = depthFadeRange(40);
  assert.deepEqual(depthFadeColour(brick, haze, r.far, r, 0), brick);
  const half = depthFadeColour(brick, haze, r.far, r, 0.5), full = depthFadeColour(brick, haze, r.far, r, 1);
  assert.ok(Math.abs(half[0] - brick[0]) < Math.abs(full[0] - brick[0]));
  assert.equal(depthFadeDetail(600, r, 0.5), 0.5);
  assert.match(depthFadeFogFragment(0.5), /fogFactor \* 0\.25 \)/);
  assert.match(depthFadeFogFragment(0.5), /fogFactor \* 0\.19 \)/);
  assert.match(DEPTH_FADE_DETAIL_GLSL('d', 1.5), /^1\.0 \* smoothstep/, 'the detail blend never passes the mean tint');
  assert.match(DEPTH_FADE_DETAIL_GLSL('d', 0.5), /^0\.5 \* smoothstep/);
});

test('the Distance haze switch: on unless the game turned it off', () => {
  assert.equal(distanceHazeOn(), true);
  setDistanceHaze(false); assert.equal(distanceHazeOn(), false);
  setDistanceHaze(true); assert.equal(distanceHazeOn(), true);
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

test('a landmark fragment at the full fade range keeps its unfaded colour', async () => {
  // The fog-free path (`?landmarkHaze=0`; the limit-only haze of lane P3 is pinned in engine/levelDissolve.test.ts).
  (globalThis as { __canalRecallLandmarkHaze?: boolean }).__canalRecallLandmarkHaze = false;
  try {
  const THREE = await import('three');
  const { depthFadeOptOut, DEPTH_FADE_OPT_OUT, DEPTH_FADE_FAR, depthFadeColour: fade } = await import('./depthFade.ts');
  const hook = () => {};
  const wall = new THREE.MeshLambertMaterial({ color: '#8a3b2a' });
  wall.onBeforeCompile = hook;
  wall.defines = { CITY_LOOK: '' };
  const city = new THREE.Mesh(new THREE.BufferGeometry(), wall);
  const tower = new THREE.Group(), spire = new THREE.Mesh(new THREE.BufferGeometry(), wall), nave = new THREE.Mesh(new THREE.BufferGeometry(), [wall, wall]);
  tower.add(spire, nave);
  assert.equal(depthFadeOptOut(tower), 2);
  const twin = spire.material as InstanceType<typeof THREE.MeshLambertMaterial>;
  assert.notEqual(twin, wall, 'the landmark draws a twin; the city material keeps fading');
  assert.equal(city.material.fog, true);
  assert.equal(twin.fog, false, 'three compiles a fog:false material without USE_FOG: no fade, no detail blend');
  assert.equal(twin.onBeforeCompile, hook);
  assert.equal(twin.defines, wall.defines);
  assert.equal(twin.userData[DEPTH_FADE_OPT_OUT], true);
  assert.equal((nave.material as unknown[])[0], twin, 'landmarks sharing a material share its twin');
  assert.equal(depthFadeOptOut(tower), 0, 'idempotent');
  // The colour a fragment gets at 3.5x the eye-to-centre distance: faded for the city, untouched for the landmark.
  const range = depthFadeRange(200), dist = 200 * DEPTH_FADE_FAR, rgb: [number, number, number] = [0.54, 0.23, 0.16], haze: [number, number, number] = [0.63, 0.78, 0.9];
  const drawn = (m: { fog?: boolean }) => (m.fog === false ? rgb : fade(rgb, haze, dist, range));
  assert.deepEqual(drawn(twin), rgb);
  assert.notDeepEqual(drawn(wall), rgb);
  } finally { delete (globalThis as { __canalRecallLandmarkHaze?: boolean }).__canalRecallLandmarkHaze; }
});

test('with the draw limit on, a landmark twin keeps fog for the limit ramp only (lane P3, `?landmarkHaze`)', async () => {
  const THREE = await import('three');
  const { depthFadeOptOut, DEPTH_FADE_OPT_OUT } = await import('./depthFade.ts');
  const { DEPTH_FADE_LIMIT_ONLY } = await import('../engine/drawLimit.ts');
  const wall = new THREE.MeshLambertMaterial();
  wall.defines = { CITY_LOOK: '' };
  const spire = new THREE.Mesh(new THREE.BufferGeometry(), wall), tower = new THREE.Group();
  tower.add(spire);
  assert.equal(depthFadeOptOut(tower), 1);
  const twin = spire.material as InstanceType<typeof THREE.MeshLambertMaterial>;
  assert.equal(twin.fog, true);
  assert.deepEqual(twin.defines, { CITY_LOOK: '', [DEPTH_FADE_LIMIT_ONLY]: '' });
  assert.deepEqual(wall.defines, { CITY_LOOK: '' }, 'the source keeps its defines');
  assert.equal(twin.userData[DEPTH_FADE_OPT_OUT], true);
  assert.equal(depthFadeOptOut(tower), 0, 'idempotent');
});

test('city-look landmark materials move to their noFade variant, which the highlight swaps keep', async () => {
  const THREE = await import('three');
  const { createCityLookMaterial, createCityUniforms, variantKey } = await import('./cityLook.ts');
  const { depthFadeOptOut } = await import('./depthFade.ts');
  const shared = new THREE.MeshLambertMaterial();
  shared.userData = { cityLook: true, cityVariant: { lit: true, kind: 'slot', uv: 'box' } };
  const noFade = new THREE.MeshLambertMaterial({ fog: false });
  const seen: unknown[] = [];
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), shared), root = new THREE.Group();
  root.add(mesh);
  assert.equal(depthFadeOptOut(root, m => { seen.push({ ...m.userData.cityVariant, noFade: true }); return noFade; }), 1);
  assert.equal(mesh.material, noFade);
  assert.deepEqual(seen, [{ lit: true, kind: 'slot', uv: 'box', noFade: true }]);
  const v = { lit: true, kind: 'slot', uv: 'box' } as const;
  assert.equal(variantKey(v), 'lit|slot|box|-|0', 'keys without noFade are unchanged');
  const uniforms = createCityUniforms(THREE);
  assert.equal(createCityLookMaterial(THREE, v, uniforms).fog, true);
  const crisp = createCityLookMaterial(THREE, { ...v, noFade: true }, uniforms);
  // Lane P3 (#328): with the draw limit on, noFade keeps fog for the limit's ramp only (`?landmarkHaze=0`: fog off).
  assert.equal(crisp.fog, true);
  assert.equal(crisp.defines?.DEPTH_FADE_LIMIT_ONLY, '');
  (globalThis as { __canalRecallLandmarkHaze?: boolean }).__canalRecallLandmarkHaze = false;
  try { assert.equal(createCityLookMaterial(THREE, { ...v, noFade: true, side: 1 }, uniforms).fog, false); }
  finally { delete (globalThis as { __canalRecallLandmarkHaze?: boolean }).__canalRecallLandmarkHaze; }
  assert.equal(crisp.userData.cityVariant.noFade, true, 'highlighted()/dimmed() rebuild from the variant, keeping noFade');
});
