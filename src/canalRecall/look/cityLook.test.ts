// node --import tsx --test src/canalRecall/look/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MATERIAL_SLOTS, cityTint, hexToRgb, PHOTO_WALL_CELL_MEAN } from './palette.ts';
import { SLOT_LAYERS, SLOT_LAYER_COUNT, cityLookEnabled, createCityLook, slotLayerOf, slotLayerBytes, slotParams, slotTintBytes, variantDefines, variantKey, type CityVariant } from './cityLook.ts';
import { INFERRED_SLOT_SOURCE, inferMaterialSlot, inferredSlotExtras, linearToSrgbHex, materialWord, slotFromColour } from './materialSlotInference.ts';

test('flag: only ?cityLook=1 turns the city look on', () => {
  assert.equal(cityLookEnabled('?cityLook=1'), true);
  assert.equal(cityLookEnabled('?cityLook=0'), false);
  assert.equal(cityLookEnabled('?sharedFrame=1'), false);
  assert.equal(cityLookEnabled(''), false);
});

test('slot table: every material slot samples a layer; frame and paint read plain white; glass panes clamp', () => {
  for (const slot of MATERIAL_SLOTS) {
    const layer = slotLayerOf(slot);
    assert.ok(Number.isInteger(layer) && layer >= 0 && layer < SLOT_LAYER_COUNT, slot);
  }
  assert.equal(slotLayerOf('frame'), slotLayerOf('paint'));
  assert.equal(SLOT_LAYERS[slotLayerOf('paint')].cell, 'white');
  assert.equal(slotLayerOf('brick'), slotLayerOf('accent'), 'accent courses are brick');
  assert.equal(SLOT_LAYERS[slotLayerOf('glass')].clampUv, true);
  assert.equal(SLOT_LAYERS.filter(l => l.clampUv).length, 1, 'only glass clamps');
  // The brick cell is lifted to the bay cells' mean; lit, it shows its tint (look/palette.ts litWallGain).
  assert.ok(Math.abs(SLOT_LAYERS[slotLayerOf('brick')].litGain * PHOTO_WALL_CELL_MEAN - 255) < 1e-9);
  const params = slotParams();
  assert.equal(params.length, SLOT_LAYER_COUNT);
  assert.ok(Math.abs(params[slotLayerOf('brick')][0] - 1 / 3.36) < 1e-12, 'brick repeats every 3.36 m');
  // Append-only ordering: the ordinal is written into slot meshes.
  assert.deepEqual(SLOT_LAYERS.map(l => l.cell), ['brick', 'stucco', 'stone', 'white', 'door', 'glass', 'tile', 'slate', 'flat']);
  // 9 layers of 256² RGBA + RG with mipmaps: the cost of the slot table in the shared array.
  assert.equal(slotLayerBytes(256), Math.round(9 * 65536 * 6 * 4 / 3));
});

test('slot tints are the city palette mapping (one rule for recipe houses and landmarks)', () => {
  assert.deepEqual(slotTintBytes('brick', '#808080'), [...hexToRgb(cityTint('brick', '#808080')), 255]);
  assert.deepEqual(slotTintBytes('glass', '#123456'), [255, 255, 255, 255]);
  assert.deepEqual(slotTintBytes('paint', '#D9B24C'), [0xd9, 0xb2, 0x4c, 255], 'paint keeps the authored colour');
});

test('variants: one program per (lit, kind, uv, highlight); side does not split the program', () => {
  const all: CityVariant[] = [];
  for (const lit of [false, true]) for (const highlight of [false, true]) {
    all.push({ lit, kind: 'chunk', highlight });
    for (const uv of ['uv', 'box'] as const) all.push({ lit, kind: 'slot', uv, highlight });
  }
  assert.equal(new Set(all.map(variantKey)).size, all.length);
  assert.deepEqual(Object.keys(variantDefines({ lit: true, kind: 'slot', uv: 'box', highlight: true })).sort(), ['CITY_BOX_UV', 'CITY_HIGHLIGHT', 'CITY_SLOT', 'CITY_SLOT_COUNT']);
  assert.deepEqual(Object.keys(variantDefines({ lit: false, kind: 'chunk' })), ['CITY_SLOT_COUNT']);
});

test('dress: a legacy landmark mesh (no UVs, untagged "brick") takes the brick slot, box UVs and attributes', () => {
  const city = createCityLook(THREE, { brick: null });
  const g = new THREE.BoxGeometry(4, 6, 3);
  g.deleteAttribute('uv');
  const wall = new THREE.Mesh(g, Object.assign(new THREE.MeshStandardMaterial({ color: '#9a5240' }), { name: 'brick' }));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), Object.assign(new THREE.MeshStandardMaterial({ color: '#527787' }), { name: 'glass_2' }));
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const root = new THREE.Group(); root.add(wall, glass, decal);
  assert.equal(city.dress(root, { lit: true }), 0, 'without inference only tagged materials change');
  assert.equal(city.dress(root, { lit: true, infer: true }), 2, 'the unlit decal is left alone');
  assert.equal(wall.material.userData.cityLook, true);
  assert.deepEqual(wall.material.userData.cityVariant, { lit: true, kind: 'slot', uv: 'box', side: THREE.FrontSide });
  assert.equal(wall.geometry.getAttribute('layer').getX(0), slotLayerOf('brick'));
  assert.equal(Math.round(wall.geometry.getAttribute('tint').getX(0) * 255), hexToRgb(cityTint('brick', '#9a5240'))[0]);
  assert.deepEqual(wall.userData.citySlot, { slot: 'brick', tint: '#9a5240', inferred: true, from: 'brick' });
  assert.equal(glass.geometry.getAttribute('layer').getX(0), slotLayerOf('glass'));
  assert.equal(glass.material.userData.cityVariant.uv, 'uv', 'authored UVs are kept');
  assert.equal(decal.material.isMeshBasicMaterial, true);
  // Shared: one material per variant for every building.
  const other = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Object.assign(new THREE.MeshStandardMaterial({ color: '#cfc2a6' }), { userData: { materialSlot: 'stone', tint: '#cfc2a6' } }));
  other.geometry.deleteAttribute('uv');
  city.dress(other, { lit: true });
  assert.equal(other.material, wall.material);
  // Highlight is a variant swap, not a mutation of the shared material.
  const lit = city.highlighted(wall.material, true);
  assert.notEqual(lit, wall.material);
  assert.equal(lit.userData.cityVariant.highlight, true);
  assert.equal(city.highlighted(lit, false), wall.material);
});

test('dress: a geometry shared by two slots gets its own copy instead of conflicting attributes', () => {
  const city = createCityLook(THREE, { brick: null });
  const g = new THREE.BoxGeometry(1, 1, 1);
  const a = new THREE.Mesh(g, Object.assign(new THREE.MeshStandardMaterial({ color: '#9a5240' }), { name: 'brick' }));
  const b = new THREE.Mesh(g, Object.assign(new THREE.MeshStandardMaterial({ color: '#4a525d' }), { name: 'slate' }));
  const root = new THREE.Group(); root.add(a, b);
  city.dress(root, { lit: false, infer: true });
  assert.notEqual(a.geometry, b.geometry);
  assert.equal(a.geometry.getAttribute('layer').getX(0), slotLayerOf('brick'));
  assert.equal(b.geometry.getAttribute('layer').getX(0), slotLayerOf('slate'));
});

test('inference: the landmark palette names map to slots (survey of 310 GLBs, 2026-10-13)', () => {
  const cases: [string, string, string][] = [
    ['glass', '#527787', 'glass'], ['glassrail', '#527787', 'glass'], ['dark', '#303b43', 'frame'], ['slate', '#4a525d', 'slate'],
    ['stone', '#cfc2a6', 'stone'], ['sandstone', '#a09580', 'stone'], ['white', '#efe9db', 'stucco'], ['frame', '#9daaa8', 'frame'],
    ['greyframe', '#9daaa8', 'frame'], ['brick', '#9a5240', 'brick'], ['greyBrick', '#7d7871', 'brick'], ['gold', '#d9b24c', 'paint'],
    ['red', '#ac624e', 'brick'], ['concrete', '#d4d5d0', 'stucco'], ['bronze', '#3d5148', 'paint'], ['ochre', '#9f825c', 'brick'],
    ['blue', '#3f5f9a', 'paint'], ['green', '#718b58', 'paint'], ['copper', '#43888b', 'paint'], ['pink', '#be9295', 'stucco'],
    ['roof', '#b5543a', 'roofTile'], ['roof', '#4a525d', 'slate'], ['wall', '#9a5240', 'brick'], ['wall', '#e4ddcd', 'stucco'],
    ['door', '#2b2d2c', 'door'], ['doorB', '#2b2d2c', 'door'], ['slab', '#d4d5d0', 'stucco'], ['terracotta', '#c0603f', 'brick'],
    ['column', '#cfc2a6', 'stone'], ['render', '#e4ddcd', 'stucco'], ['louvre', '#9daaa8', 'frame'], ['decal-2ff4d7-unlit', '#2ff4d7', 'paint'],
    ['brick.001', '#9a5240', 'brick'], ['Material_7', '#9a5240', 'brick'],
  ];
  for (const [name, hex, slot] of cases) assert.equal(inferMaterialSlot(name, hex).slot, slot, `${name} ${hex}`);
  assert.equal(inferMaterialSlot('brick', '#9a5240').confidence, 'name');
  assert.equal(inferMaterialSlot('white', '#efe9db').confidence, 'colour-word');
  assert.equal(inferMaterialSlot('Material_7', '#9a5240').confidence, 'colour');
  assert.equal(materialWord('Brick_12'), 'brick');
  assert.equal(slotFromColour('#111111').slot, 'frame');
  assert.deepEqual(inferredSlotExtras('slate', '#4A525D'), { materialSlot: 'slate', tint: '#4a525d', materialSlotSource: INFERRED_SLOT_SOURCE });
  assert.equal(linearToSrgbHex(1, 0, 0.2158605), '#ff0080');
});
