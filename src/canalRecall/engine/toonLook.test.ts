import assert from 'node:assert/strict';
import test from 'node:test';
import { toonBandsFlag, toonLookFlag, toonRemap } from './toonLook';

const chroma = ([r, g, b]: readonly number[]) => Math.max(r, g, b) - Math.min(r, g, b);
const hue = ([r, g, b]: readonly number[]) => Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);

test('toon flags: ?look=toon / __canalRecallLook, off by default; bands 6/8/10, else 8', () => {
  const g = globalThis as any;
  assert.equal(toonLookFlag(), false);
  g.__canalRecallLook = 'toon';
  try { assert.equal(toonLookFlag(), true); } finally { delete g.__canalRecallLook; }
  assert.equal(toonBandsFlag(), 8);
  for (const [v, want] of [[6, 6], [10, 10], [7, 8]] as const) { g.__canalRecallToonBands = v; try { assert.equal(toonBandsFlag(), want); } finally { delete g.__canalRecallToonBands; } }
});

test('toon remap: greys and near-greys stay grey, brick gets the push with its hue held', () => {
  for (const grey of [[0.5, 0.5, 0.5], [0.62, 0.63, 0.66], [0.8, 0.79, 0.77]] as const) {
    const out = toonRemap(grey);
    assert.ok(chroma(out) <= chroma(grey) + 0.01, `${grey} -> ${out.map(v => v.toFixed(3))}`);
  }
  const brick = [0.62, 0.32, 0.24] as const, out = toonRemap(brick);
  assert.ok(chroma(out) > chroma(brick) * 1.2, 'more chroma');
  assert.ok(Math.abs(hue(out) - hue(brick)) < 0.08, 'hue held');
});

test('toon remap: a capped white roof (#179, ~237/255) is not pushed to 255, at any band count', () => {
  for (const bands of [6, 8, 10]) for (const v of toonRemap([237 / 255, 237 / 255, 240 / 255], bands)) assert.ok(v * 255 < 252, `${bands}: ${v * 255}`);
});
