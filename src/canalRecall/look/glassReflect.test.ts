// node --import tsx --test src/canalRecall/look/glassReflect.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cityProgramKey, createCityLook, createCityLookMaterial, createCityUniforms, slotForMaterial, variantDefines, variantKey, type CityVariant } from './cityLook.ts';
import { GLASS_ENV_LINEAR, GLASS_REFLECT, GLASS_REFLECT_GLSL, cloudCover, glassEnvInto, glassReflectEnabled, glassReflectInto } from './glassReflect.ts';
import { slotPickFor } from '../nodeFrame/slotMaterial.ts';
import { glassFinishExtras, glassFinishTagFor, GLASS_FINISH_TAGS } from '../../../scripts/landmarks/glass-finish-tags.ts';

const compiled = (m: any) => {
  const lib = THREE.ShaderLib.lambert;
  const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms) };
  m.onBeforeCompile(shader, null);
  return shader;
};
/** A GLTFLoader-shaped material with the given extras. */
const gltfMaterial = (name: string, extras: Record<string, unknown>) => {
  const m = new THREE.MeshStandardMaterial({ color: 0xa7b9bf });
  m.name = name; m.userData = { ...extras };
  return m;
};
const aitanaGlass = { materialSlot: 'paint', tint: '#a7b9bf', materialSlotSource: 'inferred', materialSlotTag: 'builder' };

test('flag: on by default since round t; ?glassReflect=0 turns it off', () => {
  assert.equal(glassReflectEnabled(''), true);
  assert.equal(glassReflectEnabled('?glassReflect=0'), false);
  assert.equal(glassReflectEnabled('?cityLook=1&glassReflect=1'), true);
});

test('flag off: every variant, define, program key and shader text is what it was (reflect never set)', () => {
  const uniforms = createCityUniforms(THREE);
  // Pins of the shipped keys: the reflect field is absent from every key without it.
  assert.equal(cityProgramKey({ lit: true, kind: 'slot' }), 'city-look-v4|lit|slot');
  assert.equal(variantKey({ lit: true, kind: 'slot', uv: 'box' }), 'lit|slot|box|-|0');
  for (const kind of ['slot', 'chunk'] as const) {
    const plain = createCityLookMaterial(THREE, { lit: true, kind, uv: 'box' }, uniforms);
    const src = compiled(plain);
    assert.doesNotMatch(src.fragmentShader, /cityGlass/, `${kind}: no reflection code in the plain program`);
    assert.doesNotMatch(JSON.stringify(variantDefines({ lit: true, kind })), /GLASS/);
  }
  // `reflect` only applies to lit slot meshes: on a chunk or the unlit path it changes nothing at all.
  for (const v of [{ lit: true, kind: 'chunk' }, { lit: false, kind: 'slot', uv: 'box' }] as CityVariant[]) {
    assert.equal(cityProgramKey({ ...v, reflect: true }), cityProgramKey(v));
    assert.deepEqual(variantDefines({ ...v, reflect: true }), variantDefines(v));
  }
});

test('reflect variant: its own program key, define and shader; the plain slot program is untouched', () => {
  const uniforms = createCityUniforms(THREE);
  const plain = createCityLookMaterial(THREE, { lit: true, kind: 'slot', uv: 'box' }, uniforms);
  const glass = createCityLookMaterial(THREE, { lit: true, kind: 'slot', uv: 'box', reflect: true }, uniforms);
  assert.equal(glass.customProgramCacheKey(), 'city-look-v4|lit|slot|grefl');
  assert.equal(plain.customProgramCacheKey(), 'city-look-v4|lit|slot');
  assert.ok('CITY_GLASS_REFLECT' in glass.defines && !('CITY_GLASS_REFLECT' in plain.defines));
  const a = compiled(plain), b = compiled(glass);
  assert.equal(a.vertexShader, b.vertexShader, 'the vertex stage is shared');
  assert.match(b.fragmentShader, /cityGlassReflect\(cityGN, cityGV, diffuseColor\.rgb, cityGKeep\)/);
  assert.doesNotMatch(b.fragmentShader, /totalEmissiveRadiance \+= vec3\(0\.035, 0\.05, 0\.07\) \* vSlot\.w/, 'the constant sky tint is replaced');
  assert.match(a.fragmentShader, /totalEmissiveRadiance \+= vec3\(0\.035, 0\.05, 0\.07\) \* vSlot\.w/);
  // Box/uv and highlight stay uniforms: one reflect program per kind.
  const hl = createCityLookMaterial(THREE, { lit: true, kind: 'slot', uv: 'uv', reflect: true, highlight: true }, uniforms);
  assert.equal(hl.customProgramCacheKey(), glass.customProgramCacheKey());
  assert.equal(compiled(hl).fragmentShader, b.fragmentShader);
});

test('slotForMaterial: the glassFinish tag is read only under the flag, and makes the material glass', () => {
  const tagged = gltfMaterial('glass', { ...aitanaGlass, glassFinish: 'reflective' });
  const untagged = gltfMaterial('glass', aitanaGlass);
  assert.deepEqual(slotForMaterial(tagged, true, false), slotForMaterial(untagged, true, false), 'flag off: the tag is invisible (Aitana keeps its pale panel)');
  assert.equal(slotForMaterial(tagged, true, false)!.slot, 'paint');
  const on = slotForMaterial(tagged, true, true)!;
  assert.equal(on.slot, 'glass');
  assert.equal(on.glassFinish, 'reflective');
  assert.deepEqual(slotForMaterial(untagged, true, true), slotForMaterial(untagged, true, false), 'flag on: an untagged material is unchanged');
  assert.equal(slotForMaterial(gltfMaterial('glass', { ...aitanaGlass, glassFinish: 'chrome' }), true, true)!.slot, 'paint', 'an unknown finish is ignored');
});

test('dress: flag on, a tagged mesh takes the reflect variant (lit only); flag off it takes the plain one', () => {
  const g = globalThis as any;
  const mesh = () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), gltfMaterial('glass', { ...aitanaGlass, glassFinish: 'reflective' })));
    return root;
  };
  try {
    for (const flag of [false, true]) {
      g.__canalRecallGlassReflect = flag;
      const city = createCityLook(THREE, { size: 8 });
      for (const lit of [true, false]) {
        const root = mesh();
        city.dress(root, { lit, infer: true });
        const m = (root.children[0] as any).material;
        assert.equal(!!m.userData.cityVariant.reflect, flag && lit, `flag ${flag}, lit ${lit}`);
        assert.equal((root.children[0] as any).userData.citySlot.slot, flag ? 'glass' : 'paint');
        if (flag) assert.equal(city.highlighted(m, true).userData.cityVariant.reflect, lit || undefined, 'highlight keeps the variant');
      }
    }
  } finally { delete g.__canalRecallGlassReflect; }
});

test('the reflection: Fresnel and the sky bands (TS copy of the GLSL)', () => {
  const env = [0, 0, 0];
  glassEnvInto(0, 0, 1, env);
  const cu = GLASS_REFLECT.clouds * cloudCover(0, 0, 1);
  assert.deepEqual(env.map(v => +v.toFixed(6)), GLASS_ENV_LINEAR.zenith.map((z, k) => +(z + (GLASS_ENV_LINEAR.cloud[k] - z) * cu).toFixed(6)), 'straight up: the zenith under its cloud');
  const covers = Array.from({ length: 64 }, (_, i) => cloudCover(Math.cos(i), Math.sin(i), 0.5));
  assert.ok(Math.min(...covers) < 0.1 && Math.max(...covers) > 0.9, 'the clouds break: clear and covered patches');
  glassEnvInto(0, 1, -1, env);
  assert.deepEqual(env.map(v => +v.toFixed(6)), GLASS_ENV_LINEAR.street.map(v => +v.toFixed(6)), 'down: the street');
  glassEnvInto(1, 0, GLASS_REFLECT.skyline - 0.1, env);
  assert.ok(env[2] < GLASS_ENV_LINEAR.horizon[2] * 0.6, 'below the skyline: the facades opposite, darker than the sky');
  const add = [0, 0, 0], keep = [0, 0, 0], albedo = [0.08, 0.12, 0.15];
  const sunAway = [0, -1, 0];
  // Square on: F = f0 (mixed toward the albedo by metalness); the albedo keeps (1 - F)(1 - metalness).
  glassReflectInto([0, 1, 0], [0, 1, 0], albedo, add, keep, sunAway);
  const f0 = GLASS_REFLECT.f0 + (albedo[0] - GLASS_REFLECT.f0) * GLASS_REFLECT.metalness;
  assert.ok(Math.abs(keep[0] - (1 - f0) * (1 - GLASS_REFLECT.metalness)) < 1e-9);
  const square = add[2];
  // Grazing (a curtain wall seen along the street): far more reflection.
  const v = [0, Math.cos(1.4), Math.sin(1.4)].map((x, _, a) => x / Math.hypot(...a));
  glassReflectInto([0, 1, 0], v, albedo, add, keep, sunAway);
  assert.ok(add[2] > square * 1.5, `grazing ${add[2]} vs square-on ${square}`);
  // GLSL carries the same numbers.
  assert.match(GLASS_REFLECT_GLSL, new RegExp(`vec3\\(${GLASS_REFLECT.f0}\\)`));
  for (const c of GLASS_ENV_LINEAR.zenith) assert.ok(GLASS_REFLECT_GLSL.includes(String(+c.toFixed(6))));
});

test('node frame parity: slotPickFor marks reflect only with the flag and the tag', () => {
  const g = globalThis as any;
  const prim = { colors: null } as any;
  const m = (extras: Record<string, unknown>) => ({ name: 'glass', extras, baseColor: [0.38, 0.48, 0.52, 1], alphaMode: 'OPAQUE', unlit: false } as any);
  try {
    g.__canalRecallGlassReflect = false;
    assert.equal(slotPickFor(m({ ...aitanaGlass, glassFinish: 'reflective' }), prim)!.reflect, undefined);
    g.__canalRecallGlassReflect = true;
    assert.equal(slotPickFor(m({ ...aitanaGlass, glassFinish: 'reflective' }), prim)!.reflect, true);
    assert.equal(slotPickFor(m(aitanaGlass), prim)!.reflect, undefined);
  } finally { delete g.__canalRecallGlassReflect; }
});

test('build tags: an untagged material exports the same extras object; tags name glass of known models', () => {
  const base = { materialSlot: 'glass', tint: '#527787' };
  assert.equal(glassFinishExtras(base, glassFinishTagFor('pontsteiger', 'glass')), base);
  assert.deepEqual(glassFinishExtras(base, glassFinishTagFor('ing-house', 'glass')), { ...base, glassFinish: 'reflective' });
  for (const [id, tags] of Object.entries(GLASS_FINISH_TAGS)) for (const [name, tag] of Object.entries(tags)) assert.ok(tag.why.length > 20, `${id}/${name} cites why`);
});
