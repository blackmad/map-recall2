import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrayTextureBytes, legacyTextureParams, pageTextureParams, texturePolicy, texturePolicyFlag, BASE_CELL_PX, HIGH_CELL_PX, MAX_CELL_PX, type TextureKind } from './texturePolicy.ts';
import { CELL_MEAN_LOD, facadeTierUniform, FACADE_TIER_FROM_TEXELS, FACADE_TIER_TO_TEXELS, FACADE_TIER_GLSL, ROOF_TIER_GLSL } from '../roofTier.ts';

const kinds: TextureKind[] = ['facadeCells', 'slotCells', 'ground'];

test('legacy values are the ones every texture had before the policy', () => {
  assert.deepEqual(legacyTextureParams('facadeCells', { coarse: false, gpuMaxAnisotropy: 16 }), { minFilter: 'LinearMipmapLinear', magFilter: 'Linear', generateMipmaps: true, cellPx: 256, anisotropy: 16, tierScale: 1 });
  assert.equal(legacyTextureParams('facadeCells', { coarse: true, gpuMaxAnisotropy: 16 }).cellPx, 128);
  assert.equal(legacyTextureParams('facadeCells', { coarse: true, gpuMaxAnisotropy: 16 }).anisotropy, 4);
  assert.equal(legacyTextureParams('facadeCells', { coarse: false, gpuMaxAnisotropy: 8 }).anisotropy, 8, 'clamped to the GPU');
  assert.equal(legacyTextureParams('ground', { coarse: false, gpuMaxAnisotropy: 16 }).anisotropy, 4);
  assert.equal(legacyTextureParams('slotCells', { coarse: false, gpuMaxAnisotropy: 16 }).anisotropy, 4);
});

test('desktop high: HIGH_CELL_PX cells (pinned 256), anisotropy min(gpu, 16) on every kind, tier rates follow the side', () => {
  for (const kind of kinds) {
    const p = texturePolicy(kind, { tier: 'high', coarse: false, gpuMaxAnisotropy: 16, enabled: true });
    assert.equal(p.cellPx, HIGH_CELL_PX); assert.equal(p.anisotropy, 16); assert.equal(p.tierScale, HIGH_CELL_PX / BASE_CELL_PX);
    assert.equal(HIGH_CELL_PX, 256, 'pinned at integration: 512 measured no sharpness gain for +260 MB');
    assert.equal(p.minFilter, 'LinearMipmapLinear'); assert.equal(p.generateMipmaps, true);
    assert.equal(texturePolicy(kind, { tier: 'high', coarse: false, gpuMaxAnisotropy: 8, enabled: true }).anisotropy, 8);
    assert.equal(texturePolicy(kind, { tier: 'high', coarse: false, gpuMaxAnisotropy: 64, enabled: true }).anisotropy, 16);
  }
});

test('mid, low, touch, no tier and ?texturePolicy=0 keep the legacy values exactly', () => {
  for (const kind of kinds) for (const coarse of [false, true]) {
    const legacy = legacyTextureParams(kind, { coarse, gpuMaxAnisotropy: 16 });
    for (const tier of ['mid', 'low', null, undefined] as const) assert.deepEqual(texturePolicy(kind, { tier, coarse, gpuMaxAnisotropy: 16, enabled: true }), legacy);
    assert.deepEqual(texturePolicy(kind, { tier: 'high', coarse, gpuMaxAnisotropy: 16, enabled: false }), legacy, 'flag off');
    if (coarse) assert.deepEqual(texturePolicy(kind, { tier: 'high', coarse, gpuMaxAnisotropy: 16, enabled: true }), legacy, 'touch keeps the iPhone budget');
  }
});

test('the page reads __canalPerf.tier and the ?texturePolicy flag', () => {
  const g = globalThis as { __canalPerf?: unknown; __canalRecallTexturePolicy?: unknown };
  assert.equal(texturePolicyFlag(), true);
  assert.equal(pageTextureParams('facadeCells', 16).cellPx, BASE_CELL_PX, 'no tier: legacy');
  g.__canalPerf = { tier: 'high' };
  assert.equal(pageTextureParams('facadeCells', 16).cellPx, HIGH_CELL_PX);
  assert.equal(pageTextureParams('facadeCells', 16).anisotropy, 16, 'high tier still gets 16x');
  g.__canalRecallTexturePolicy = '0';
  assert.equal(texturePolicyFlag(), false);
  assert.equal(pageTextureParams('facadeCells', 16).cellPx, BASE_CELL_PX);
  delete g.__canalPerf; delete g.__canalRecallTexturePolicy;
});

test('the facade tier flattens at the same screen size with 512 px cells; legacy uniform unchanged', () => {
  assert.deepEqual(facadeTierUniform(2), [FACADE_TIER_FROM_TEXELS * 2, FACADE_TIER_TO_TEXELS * 2]);
  assert.deepEqual(facadeTierUniform(2, 1), facadeTierUniform(2));
  assert.deepEqual(facadeTierUniform(2, 2), [FACADE_TIER_FROM_TEXELS * 4, FACADE_TIER_TO_TEXELS * 4]);
  assert.deepEqual(facadeTierUniform(0.75, 2), [FACADE_TIER_FROM_TEXELS * 2, FACADE_TIER_TO_TEXELS * 2], 'ratio under 1 counts as 1');
});

test('the mean-colour sample reaches the 1x1 mip of a 512 px cell (GL clamps the level to the last mip)', () => {
  assert.ok(CELL_MEAN_LOD >= Math.log2(MAX_CELL_PX));
  assert.ok(!/textureLod\([^)]*8\.0\)/.test(FACADE_TIER_GLSL + ROOF_TIER_GLSL), 'no fixed 8.0 level left');
  assert.equal((FACADE_TIER_GLSL + ROOF_TIER_GLSL).match(/textureLod\([^;]*12\.0\)/g)?.length, 3);
});

test('texture bytes: the 512 px array is 4x the 256 px one (budget row desktopTextureMB)', () => {
  const b256 = arrayTextureBytes(256, 208, 5), b512 = arrayTextureBytes(512, 208, 5);
  assert.ok(Math.abs(b512 / b256 - 4) < 0.01);
  assert.equal(arrayTextureBytes(1, 1, 4), 4);
  assert.equal(arrayTextureBytes(2, 1, 1), 5);
});

test('?cellPx= picks another desktop-high side (multiples of 32 in 288..512), never below 256 or on touch', () => {
  const high = (cellPx: number) => texturePolicy('facadeCells', { tier: 'high', coarse: false, gpuMaxAnisotropy: 16, enabled: true, cellPx });
  assert.equal(high(384).cellPx, 384); assert.equal(high(384).tierScale, 1.5);
  assert.equal(high(128).cellPx, HIGH_CELL_PX); assert.equal(high(1024).cellPx, HIGH_CELL_PX); assert.equal(high(300).cellPx, HIGH_CELL_PX);
  assert.equal(high(512).cellPx, MAX_CELL_PX); assert.equal(high(512).tierScale, 2);
  assert.equal(texturePolicy('facadeCells', { tier: 'high', coarse: true, gpuMaxAnisotropy: 16, enabled: true, cellPx: 384 }).cellPx, 128);
});
