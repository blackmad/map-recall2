import test from 'node:test';
import assert from 'node:assert/strict';
import { readSkyline } from './skyline.ts';

// A 40 px/m strip, 600 px tall: sky over a 10 m cornice front (span 0-100) and a gable front (span 100-200) whose
// middle 40 % rises to 13 m from a 9 m foot.
test('skyline: cornice top, gable foot and peak', () => {
  const W = 200, H = 600, ppm = 40, rgb = new Uint8Array(W * H * 3);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const top = x < 100 ? 10 : (x >= 130 && x < 170 ? 13 : 9), wall = (H - y) / ppm <= top, i = (y * W + x) * 3;
    rgb.set(wall ? [70, 55, 50] : [190, 205, 220], i);
  }
  const [a, b] = readSkyline(rgb, W, H, ppm, [{ pandId: 'a', px: [0, 100] }, { pandId: 'b', px: [100, 200] }]);
  assert.ok(Math.abs(a.frontTopM! - 10) < 0.05 && a.crownShare === 0, JSON.stringify(a));
  assert.ok(Math.abs(b.footM! - 9) < 0.05 && Math.abs(b.peakM! - 13) < 0.05 && b.crownShare > 0.3, JSON.stringify(b));
});
