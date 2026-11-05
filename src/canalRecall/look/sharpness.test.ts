import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameSharpness } from './sharpness.ts';

/** A window grid: dark 6x8 px windows every 12 px on a light wall, optionally box-blurred `blur` px. */
function grid(w: number, h: number, blur = 0): Uint8Array {
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lum[y * w + x] = (x % 12 < 6 && y % 12 < 8) ? 40 : 210;
  let cur = lum;
  for (let r = 0; r < blur; r++) {
    const next = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += cur[yy * w + xx]; k++; } }
      next[y * w + x] = s / k;
    }
    cur = next;
  }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = Math.round(cur[i]); out[i * 4 + 3] = 255; }
  return out;
}

test('a blurred window grid scores lower on every measure', () => {
  const sharp = frameSharpness(grid(96, 96), 96, 96, 4), soft = frameSharpness(grid(96, 96, 2), 96, 96, 4);
  assert.ok(sharp.laplacianVar > soft.laplacianVar * 2, `${sharp.laplacianVar} vs ${soft.laplacianVar}`);
  assert.ok(sharp.edge > soft.edge);
  assert.ok(sharp.acutance > soft.acutance * 1.5, `${sharp.acutance} vs ${soft.acutance}`);
});

test('a flat frame is 0; the rect limits the pixels measured', () => {
  const flat = new Uint8Array(32 * 32 * 3).fill(128);
  assert.deepEqual(frameSharpness(flat, 32, 32, 3), { laplacianVar: 0, edge: 0, acutance: 0, pixels: 900 });
  assert.equal(frameSharpness(flat, 32, 32, 3, { x0: 0, y0: 0, x1: 0.5, y1: 0.5 }).pixels, 15 * 15);
});
