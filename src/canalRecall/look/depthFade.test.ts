import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthFadeColour, depthFadeDetail, depthFadeFlag, depthFadeRange, installDepthFade, DEPTH_FADE_DEFAULT, DEPTH_FADE_MIN_NEAR_M } from './depthFade.ts';

test('depthFadeFlag: on by default, ?depthFade=0 off', () => {
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

test('a landmark fragment at the full fade range keeps its unfaded colour', async () => {
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
  assert.equal(crisp.fog, false);
  assert.equal(crisp.userData.cityVariant.noFade, true, 'highlighted()/dimmed() rebuild from the variant, keeping noFade');
});
