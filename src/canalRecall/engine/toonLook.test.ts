import assert from 'node:assert/strict';
import test from 'node:test';
import { toonLookFlag, toonRemap } from './toonLook';

test('toon flag: ?look=toon or __canalRecallLook; off by default', () => {
  const g = globalThis as any;
  assert.equal(toonLookFlag(), false);
  g.__canalRecallLook = 'toon';
  try { assert.equal(toonLookFlag(), true); } finally { delete g.__canalRecallLook; }
});

test('toon remap: greys stay grey, colours gain chroma, and a capped white is not pushed to 255', () => {
  const [r, g, b] = toonRemap([0.5, 0.5, 0.5]);
  assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9);
  const brick = [0.62, 0.32, 0.24] as const, out = toonRemap(brick);
  assert.ok(out[0] - out[2] > brick[0] - brick[2], 'more chroma');
  // The #179 roof after its cap (luma ~237/255) stays under 255 in every channel.
  for (const v of toonRemap([237 / 255, 237 / 255, 240 / 255])) assert.ok(v * 255 < 250, String(v * 255));
});
