// Lane R1-B (#224): the facade tier's uniform follows the pixel ratio after the materials exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThreeBuildings } from '../threeBuildingsBrowser.ts';
import { facadeTierUniform, FACADE_TIER_OFF } from '../roofTier.ts';

function fake(ratio: number) {
  let repaints = 0;
  const map = { triggerRepaint() { repaints++; }, getZoom: () => 17, getCanvas: () => ({}), getPixelRatio: () => ratio };
  const b = new ThreeBuildings(map as never, {} as never) as any;
  // A material per look plus the base one; a fade clone shares the source's uniform objects (fadeClone spreads them).
  const uniform = () => ({ cellTier: { value: facadeTierUniform(ratio) } });
  b.material = { uniforms: uniform() };
  const city = { uniforms: uniform() }, off = { uniforms: { cellTier: { value: FACADE_TIER_OFF } } };
  b.materials.set('photo', b.material); b.materials.set('city', city); b.materials.set('off', off);
  const clone = { uniforms: { ...city.uniforms } };
  return { b, city, off, clone, repaints: () => repaints };
}

test('setCellTierPixelRatio moves every live material (and its fade clones) to the new ratio', () => {
  const { b, city, off, clone, repaints } = fake(2);
  assert.equal(b.setCellTierPixelRatio(1.5), 2);
  assert.deepEqual(b.material.uniforms.cellTier.value, facadeTierUniform(1.5));
  assert.deepEqual(city.uniforms.cellTier.value, facadeTierUniform(1.5));
  assert.deepEqual(clone.uniforms.cellTier.value, facadeTierUniform(1.5), 'the fade clone shares the uniform');
  assert.deepEqual(off.uniforms.cellTier.value, FACADE_TIER_OFF, 'a material with the tier off stays off');
  assert.equal(repaints(), 1);
  assert.equal(b.setCellTierPixelRatio(1.5), 0, 'no change, no repaint');
  assert.equal(repaints(), 1);
  assert.equal(b.setCellTierPixelRatio(Number.NaN), 0);
  // New materials take the set ratio too.
  assert.deepEqual(b.cellTierValue(), facadeTierUniform(1.5));
});

test('the governor floor (0.75x) reads as ratio 1, as at creation', () => {
  const { b } = fake(2);
  b.setCellTierPixelRatio(0.75);
  assert.deepEqual(b.material.uniforms.cellTier.value, facadeTierUniform(1));
});

test('desktop high (?cellPx=512 A/B) scales the tier with the cell size; the pinned 256 px default does not', () => {
  const g = globalThis as { __canalPerf?: unknown; __canalRecallCellPx?: unknown };
  g.__canalPerf = { tier: 'high' };
  try {
    const { b } = fake(2);
    b.renderer = { capabilities: { getMaxAnisotropy: () => 16 } };
    b.setCellTierPixelRatio(2);
    assert.deepEqual(b.material.uniforms.cellTier.value, facadeTierUniform(2, 1), 'HIGH_CELL_PX pinned to 256 at integration');
    g.__canalRecallCellPx = 512;
    const { b: big } = fake(2);
    big.renderer = { capabilities: { getMaxAnisotropy: () => 16 } };
    big.setCellTierPixelRatio(2);
    assert.deepEqual(big.material.uniforms.cellTier.value, facadeTierUniform(2, 2));
  } finally { delete g.__canalPerf; delete g.__canalRecallCellPx; }
});
