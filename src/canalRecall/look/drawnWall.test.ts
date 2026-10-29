import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnWallLuma, drawnWallTint, isMeasuredWall } from './drawnWall.ts';
import { BRICK_CELL_MEAN, cityTint, hexToRgb } from './palette.ts';

const luma = (h: string) => { const [r, g, b] = hexToRgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

test('an unmeasured brick wall is drawn through the city brick range, as before', () => {
  assert.equal(drawnWallTint({brick: '#766449'}), cityTint('brick', '#766449'));
  assert.ok(Math.abs(drawnWallLuma({brick: '#766449'}) - luma(cityTint('brick', '#766449')) * BRICK_CELL_MEAN) < 1e-9);
});

test('a measured wall is drawn as measured: its head-on luma is its own (Kinkerstraat 45, pale sunlit brick)', () => {
  const p = {brick: '#b29277', wallTint: 'measured'};
  assert.ok(isMeasuredWall(p) && isMeasuredWall({brick: '#282b24', wallMaterial: 'painted-brick'}));
  // The clamped path pulls the pale brick darker; the measured path keeps it within a couple of luma steps.
  assert.ok(Math.abs(drawnWallLuma(p) - luma('#b29277')) < 3, `measured ${drawnWallLuma(p)} vs ${luma('#b29277')}`);
  assert.ok(drawnWallLuma({brick: '#b29277'}) < luma('#b29277') - 10);
});
