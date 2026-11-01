import assert from 'node:assert/strict';
import test from 'node:test';
import { frameBusyness } from './busyness';

test('busyness: a flat frame is 0; a striped top third is busier than a flat bottom', () => {
  const w = 30, h = 30, flat = new Uint8Array(w * h * 3).fill(120);
  const b0 = frameBusyness(flat, w, h, 3);
  assert.equal(b0.near.edge, 0); assert.equal(b0.far.variance, 0);
  const busy = flat.slice();
  for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) if (x % 4 < 2) busy.fill(250, (y * w + x) * 3, (y * w + x) * 3 + 3);
  const b1 = frameBusyness(busy, w, h, 3);
  assert.ok(b1.far.edge > 10 && b1.far.variance > 1000 && b1.near.edge === 0);
});
