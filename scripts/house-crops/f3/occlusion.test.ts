import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occlusionMask, trunkColumns } from './occlusion.ts';

const W = 300, H = 500;
function img(fill: [number, number, number]) { const d = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { d[i * 4] = fill[0]; d[i * 4 + 1] = fill[1]; d[i * 4 + 2] = fill[2]; d[i * 4 + 3] = 255; } return { d, a: new Uint8Array(W * H).fill(255) }; }
const never = () => false;
const paint = (d: Uint8ClampedArray, x0: number, x1: number, y0: number, y1: number, c: [number, number, number]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } };

test('a plain brick wall has no occlusion', () => {
  const { d, a } = img([160, 90, 70]);
  const s = occlusionMask(d, a, W, H, never);
  assert.equal(s.maskedShare, 0);
});
test('a bare trunk (0.3 m wide, dark, grey-brown) is found, a uniformly dark facade is not', () => {
  const { d, a } = img([170, 150, 130]);
  paint(d, 100, 115, 150, 480, [50, 45, 40]);
  const s = occlusionMask(d, a, W, H, never);
  assert.ok(s.trunkShare > 0.03 && s.trunkShare < 0.1, String(s.trunkShare));
  const dark = img([40, 38, 36]);
  assert.equal(occlusionMask(dark.d, dark.a, W, H, never).trunkShare, 0);
});
test('leaf colour is masked', () => {
  const { d, a } = img([170, 150, 130]);
  paint(d, 0, 150, 0, H, [40, 140, 40]);
  const s = occlusionMask(d, a, W, H, (r, g, b) => g > r + 30 && g > b + 30);
  assert.ok(Math.abs(s.leafShare - 0.5) < 0.03);
});
test('a dark lower-third blob is masked as a vehicle', () => {
  const { d, a } = img([170, 150, 130]);
  paint(d, 40, 200, 380, 480, [20, 20, 25]);
  const s = occlusionMask(d, a, W, H, never);
  assert.ok(s.vehicleShare > 0.05, String(s.vehicleShare));
});
test('trunkColumns ignores a window-width dark band', () => {
  const { d, a } = img([170, 150, 130]);
  paint(d, 60, 160, 150, 480, [30, 30, 30]); // 2 m wide: a dark opening, not a trunk
  assert.deepEqual(trunkColumns(d, a, W, H, 50), []);
});
