// node --import tsx --test src/canalRecall/look/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunlitMeasuredWall } from './sunny.ts';
import * as THREE from 'three';
import { MATERIAL_SLOTS, cityMeasuredGlassTint, cityTint, hexToRgb, rgbToHsl, PHOTO_WALL_CELL_MEAN, BRICK_CELL_MEAN, rgbToHex } from './palette.ts';
import { BRICK20_FROM, CITY_LIT_LEVEL, cityLookTint, SLOT_LAYERS, SLOT_LAYER_COUNT, cityLookEnabled, createCityLook, slotLayerOf, slotLayerBytes, slotParams, slotForMaterial, slotTintBytes, variantDefines, variantKey, type CityVariant } from './cityLook.ts';
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
  assert.deepEqual(SLOT_LAYERS.filter(l => l.clampUv).map(l => l.cell), ['glass', 'glassTint'], 'only the glass panes clamp');
  // The brick cell is lifted to the bay cells' mean; lit, it shows its tint (look/palette.ts litWallGain).
  // Lit, the city look's level (CITY_LIT_LEVEL) brings the reference brick into docs/LOOK.md's band.
  assert.ok(Math.abs(SLOT_LAYERS[slotLayerOf('brick')].litGain * PHOTO_WALL_CELL_MEAN - 255 * CITY_LIT_LEVEL) < 1e-9);
  // Roof slots follow the chunk roofs (which take the photo wall gain and the level too): no darker slate on landmarks.
  for (const roof of ['roofTile', 'slate', 'bitumen'] as const) assert.equal(SLOT_LAYERS[slotLayerOf(roof)].litGain, SLOT_LAYERS[slotLayerOf('brick')].litGain, roof);
  const params = slotParams();
  assert.equal(params.length, SLOT_LAYER_COUNT);
  assert.ok(Math.abs(params[slotLayerOf('brick')][0] - 1 / 3.36) < 1e-12, 'brick repeats every 3.36 m');
  // Append-only ordering: the ordinal is written into slot meshes.
  assert.deepEqual(SLOT_LAYERS.map(l => l.cell), ['brick', 'stucco', 'stone', 'white', 'door', 'glass', 'tile', 'slate', 'flat', 'brick20', 'whiteStucco', 'glassTint']);
  // 12 layers of 256² RGBA + RG with mipmaps: the cost of the slot table in the shared array.
  assert.equal(slotLayerBytes(256), Math.round(12 * 65536 * 6 * 4 / 3));
});

test('slot tints are the city palette mapping (one rule for recipe houses and landmarks)', () => {
  assert.deepEqual(slotTintBytes('brick', '#9a5240'), [...hexToRgb(cityTint('brick', '#9a5240')), 255]);
  assert.deepEqual(slotTintBytes('brick', '#808080'), [...hexToRgb(cityLookTint('brick', '#808080')), 255], 'the city look mapping (grey brick stays grey)');
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
  // HL_* defines follow the page's highlight style (look/highlight.ts; default a adds HL_KEEP), not the variant.
  const own = (v: CityVariant) => Object.keys(variantDefines(v)).filter(k => !k.startsWith('HL_')).sort();
  assert.deepEqual(own({ lit: true, kind: 'slot', uv: 'box', highlight: true }), ['CITY_BOX_UV', 'CITY_HIGHLIGHT', 'CITY_SLOT', 'CITY_SLOT_COUNT']);
  assert.deepEqual(own({ lit: false, kind: 'chunk' }), ['CITY_SLOT_COUNT']);
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
  assert.deepEqual(wall.userData.citySlot, { slot: 'brick', tint: '#9a5240', inferred: true, from: 'brick', layer: slotLayerOf('brick') });
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

test('variants: 20th-century brick by BAG year, smooth white render for white-named materials', () => {
  assert.equal(BRICK20_FROM, 1915, 'docs/LOOK.md era scheme: Amsterdamse School and later');
  assert.equal(slotLayerOf('brick', { year: 1914 }), slotLayerOf('brick'));
  assert.equal(SLOT_LAYERS[slotLayerOf('brick', { year: 1915 })].cell, 'brick20');
  assert.equal(SLOT_LAYERS[slotLayerOf('accent', { year: 1960 })].cell, 'brick20');
  assert.equal(slotLayerOf('brick', { year: null }), slotLayerOf('brick'), 'no year: canal brick, as before');
  assert.equal(slotLayerOf('stucco', { year: 1990 }), slotLayerOf('stucco'), 'the year only picks brick');
  assert.equal(SLOT_LAYERS[slotLayerOf('stucco', { white: true })].cell, 'whiteStucco');
  assert.equal(slotLayerOf('frame', { white: true }), slotLayerOf('frame'));
  const city = createCityLook(THREE, { brick: null });
  const g = new THREE.BoxGeometry(4, 6, 3); g.deleteAttribute('uv');
  const root = new THREE.Group();
  const wall = new THREE.Mesh(g, Object.assign(new THREE.MeshStandardMaterial({ color: '#9a5240' }), { name: 'brick' }));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.3), Object.assign(new THREE.MeshStandardMaterial({ color: '#f4f0e6' }), { name: 'white_3' }));
  const render = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.3), Object.assign(new THREE.MeshStandardMaterial({ color: '#e8e2d4' }), { name: 'stucco' }));
  root.add(wall, trim, render);
  city.dress(root, { lit: true, infer: true, year: 1928 });
  assert.equal(SLOT_LAYERS[wall.geometry.getAttribute('layer').getX(0)].cell, 'brick20');
  assert.equal(SLOT_LAYERS[trim.geometry.getAttribute('layer').getX(0)].cell, 'whiteStucco');
  assert.equal(SLOT_LAYERS[render.geometry.getAttribute('layer').getX(0)].cell, 'stucco', 'a stucco name keeps the grained stucco');
});

test('measured brick/accent: cell x tint lands on the authored hex; every unmeasured path is unchanged', () => {
  const L = (hex: string) => rgbToHsl(hexToRgb(hex))[2];
  const cell = (hex: string) => { const [r, g, b] = hexToRgb(hex).map(v => Math.round(v * BRICK_CELL_MEAN)); return rgbToHex([r, g, b]); };
  for (const slot of ['brick', 'accent'] as const) for (const hex of ['#3a2a28', '#8a3e2e', '#d8d2c4']) {
    assert.equal(cityLookTint(slot, hex), cityLookTint(slot, hex, null), 'no source = unchanged');
    assert.ok(Math.abs(L(cell(cityLookTint(slot, hex, 'measured', 'legacy'))) - L(hex)) <= 0.02, `${slot} ${hex}`);
    // Sunny look (default): it lands on the wall at sunlit exposure (look/sunny.ts), at least as light as the hex.
    assert.ok(Math.abs(L(cell(cityLookTint(slot, hex, 'measured', 'sunny'))) - L(sunlitMeasuredWall(hex))) <= 0.02, `${slot} ${hex} sunny`);
    assert.ok(L(sunlitMeasuredWall(hex)) >= L(hex) - 1e-9);
    assert.deepEqual(slotTintBytes(slot, hex, 'measured'), [...hexToRgb(cityLookTint(slot, hex, 'measured')), 255]);
  }
  assert.ok(L(cityLookTint('brick', '#3a2a28')) >= 0.3 - 1e-9, 'unmeasured dark wall is still clamped');
  assert.equal(cityLookTint('stucco', '#d8d2c4', 'measured'), cityLookTint('stucco', '#d8d2c4'));
  // a measured pitched roof (large recipes' roof.pitchedHex, issue #73) is drawn as is; unmeasured slate keeps the review rule
  assert.equal(cityLookTint('slate', '#8f9698', 'measured'), '#8f9698');
  // slotForMaterial reads the extra; untagged materials are as before.
  const base = { materialSlot: 'brick', tint: '#3a2a28' };
  assert.deepEqual(slotForMaterial({ userData: { ...base, tintSource: 'measured' } }, false), { slot: 'brick', tint: '#3a2a28', inferred: false, source: 'measured' });
  assert.deepEqual(slotForMaterial({ userData: base }, false), { slot: 'brick', tint: '#3a2a28', inferred: false });
  assert.equal(slotForMaterial({ userData: { ...base, tintSource: 'prior' } }, false)!.source, undefined);
  // dress writes the measured tint into the geometry attribute.
  const city = createCityLook(THREE, { brick: null });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 3), new THREE.MeshStandardMaterial({ color: '#3a2a28', userData: { ...base, tintSource: 'measured' } }));
  wall.material.userData = { ...base, tintSource: 'measured' };
  city.dress(wall, { lit: false });
  assert.equal(Math.round(wall.geometry.getAttribute('tint').getX(0) * 255), hexToRgb(cityLookTint('brick', '#3a2a28', 'measured'))[0]);
  assert.equal(wall.userData.citySlot.source, 'measured');
});

test('review corrections: light slate keeps its lightness, mid-grey joinery and dark stone keep their colour (flag on only)', () => {
  // Dark slate: the city tones, as before (parity with chunk roofs and recipe houses).
  assert.equal(cityLookTint('slate', '#4a525d'), cityTint('slate', '#4a525d'));
  // Light slate / zinc: lighter than the lightest city tone, and ordered.
  const l = (hex: string) => rgbToHsl(hexToRgb(hex))[2];
  assert.ok(l(cityLookTint('slate', '#707e86')) > l(cityTint('slate', '#707e86')));
  assert.ok(l(cityLookTint('slate', '#8f9698')) > l(cityLookTint('slate', '#707e86')));
  // The builders' default grey-green frame stays; white frames still take the city cream; dark frames unchanged.
  assert.equal(cityLookTint('frame', '#9daaa8'), '#9daaa8');
  assert.equal(cityLookTint('frame', '#efeadb'), cityTint('frame', '#efeadb'));
  assert.equal(cityLookTint('frame', '#303b43'), cityTint('frame', '#303b43'));
  // Dark stone keeps its colour; pale stone takes the city stone.
  assert.equal(cityLookTint('stone', '#7c7870'), '#7c7870');
  assert.equal(cityLookTint('stone', '#cfc2a6'), cityTint('stone', '#cfc2a6'));
  // Grey brick stays neutral (no hue cast from the saturation floor); brick-coloured brick is the palette mapping.
  assert.ok(rgbToHsl(hexToRgb(cityLookTint('brick', '#696a65')))[1] < 0.12);
  assert.ok(rgbToHsl(hexToRgb(cityTint('brick', '#696a65')))[1] >= 0.119);
  assert.equal(cityLookTint('brick', '#9a5240'), cityTint('brick', '#9a5240'));
  // A red-brown roof named slate takes the pantile tint.
  assert.equal(cityLookTint('slate', '#7d5144'), cityTint('roofTile', '#7d5144'));
  // Every other slot is the palette mapping.
  for (const slot of ['stucco', 'door', 'glass', 'roofTile', 'bitumen', 'paint'] as const) assert.equal(cityLookTint(slot, '#8a7656'), cityTint(slot, '#8a7656'), slot);
});

test('measured glass samples the grey pane with the authored tint; measured brick keeps the canal brick whatever the year', () => {
  const glass = SLOT_LAYERS[slotLayerOf('glass', { source: 'measured' })];
  assert.equal(glass.cell, 'glassTint');
  // Same pane behaviour as the unmeasured glass: per-pane UVs clamped, sky tint when lit, no gain.
  const plain = SLOT_LAYERS[slotLayerOf('glass')];
  assert.equal(plain.cell, 'glass');
  assert.deepEqual([glass.clampUv, glass.skyTint, glass.litGain, glass.tileM], [plain.clampUv, plain.skyTint, plain.litGain, plain.tileM]);
  for (const hex of ['#1e262c', '#8e9ea4']) {
    assert.equal(cityLookTint('glass', hex), '#ffffff', 'unmeasured glass: unchanged');
    assert.equal(cityLookTint('glass', hex, 'measured'), cityMeasuredGlassTint(hex));
  }
  // The 20th-century brick is painted lighter (BRICK20_CELL_MEAN 238 vs 225): a measured tint divides by the canal
  // brick's mean, so a measured wall samples that cell in every era; unmeasured brick keeps the era variant.
  assert.equal(SLOT_LAYERS[slotLayerOf('brick', { year: 2004, source: 'measured' })].cell, 'brick');
  assert.equal(SLOT_LAYERS[slotLayerOf('accent', { year: 1934, source: 'measured' })].cell, 'brick');
  assert.equal(SLOT_LAYERS[slotLayerOf('brick', { year: 2004 })].cell, 'brick20');
  // dress: the glass extra reaches the attributes (Houthavenkade 26's reflective glass, Waagdragerhof's dark glass).
  const city = createCityLook(THREE, { brick: null });
  const pane = (hex: string, source?: string) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), new THREE.MeshStandardMaterial({ color: hex }));
    m.material.userData = { materialSlot: 'glass', tint: hex, ...(source ? { tintSource: source } : {}) };
    return m;
  };
  const dark = pane('#1e262c', 'measured'), pale = pane('#8e9ea4', 'measured'), kit = pane('#8e9ea4');
  for (const m of [dark, pale, kit]) city.dress(m, { lit: false, year: 2018 });
  const tintOf = (m: any) => [0, 1, 2].map(i => Math.round(m.geometry.getAttribute('tint').getComponent(0, i) * 255));
  assert.deepEqual(tintOf(dark), hexToRgb(cityMeasuredGlassTint('#1e262c')));
  assert.deepEqual(tintOf(pale), hexToRgb(cityMeasuredGlassTint('#8e9ea4')));
  assert.deepEqual(tintOf(kit), [255, 255, 255]);
  assert.equal(SLOT_LAYERS[dark.userData.citySlot.layer].cell, 'glassTint');
  assert.equal(SLOT_LAYERS[kit.userData.citySlot.layer].cell, 'glass');
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial());
  wall.material.userData = { materialSlot: 'brick', tint: '#4a302b', tintSource: 'measured' };
  city.dress(wall, { lit: false, year: 2004 });
  assert.equal(SLOT_LAYERS[wall.userData.citySlot.layer].cell, 'brick');
});

