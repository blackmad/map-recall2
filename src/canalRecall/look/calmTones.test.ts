import test from 'node:test';
import assert from 'node:assert/strict';
import { calmFoliage, nearestRoofFamily, roofFamilies, snapRoofFamily, treeCalmFlag, roofFamilyFlag } from './calmTones';
import { hexToRgb, rgbToHsl } from './palette';

test('both flags are off by default', () => { assert.equal(treeCalmFlag(), false); assert.equal(roofFamilyFlag(), false); });

test('calm foliage: 15-20 % less saturation, same hue and lightness', () => {
  const [h0, s0, l0] = rgbToHsl(hexToRgb('#5c9a4f')), [h1, s1, l1] = rgbToHsl(hexToRgb(calmFoliage('#5c9a4f')));
  assert.ok(Math.abs(h1 - h0) < 2 && Math.abs(l1 - l0) < 0.01);
  const drop = 1 - s1 / s0;
  assert.ok(drop > 0.15 && drop < 0.21, `drop ${drop}`);
});

test('a roof near a family snaps toward it; a strongly different roof is kept', () => {
  const near = '#b85a3e';
  const snapped = snapRoofFamily(near);
  const d = (a: string, b: string) => Math.hypot(...hexToRgb(a).map((v, i) => v - hexToRgb(b)[i]));
  assert.ok(d(snapped, roofFamilies()[0]) < d(near, roofFamilies()[0]));
  assert.equal(snapRoofFamily('#2e8f5c'), '#2e8f5c', 'a green roof measures strongly different');
  assert.equal(nearestRoofFamily('#2e8f5c'), null);
});

test('snapping is idempotent-ish: a family tone maps to itself', () => {
  for (const f of roofFamilies()) assert.equal(snapRoofFamily(f), f);
});
