import assert from 'node:assert/strict';
import test from 'node:test';
import { hypot2 } from './hypot2';

test('hypot2 returns Math.hypot\'s bits', () => {
  let s = 12345;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  const pick = (k: number) => {
    switch (k % 5) {
      case 0: return (r() - 0.5) * 2000;
      case 1: return (r() - 0.5) * 1e-3;
      case 2: return (r() - 0.5) * 1e300;
      case 3: u[0] = (r() * 2 ** 32) >>> 0; u[1] = (r() * 2 ** 32) >>> 0; return f[0]; // any bit pattern
      default: return Math.round((r() - 0.5) * 100);
    }
  };
  for (let i = 0; i < 1_000_000; i++) {
    const x = pick(i), y = pick(i >> 2);
    assert.ok(Object.is(hypot2(x, y), Math.hypot(x, y)), `${x}, ${y}`);
  }
  for (const [x, y] of [[0, 0], [-0, 0], [-0, -0], [Infinity, NaN], [NaN, -Infinity], [NaN, 0], [3, 4], [5e-324, 5e-324], [1.7976931348623157e308, 1.7976931348623157e308], [-3, 0], [0, -7]])
    assert.ok(Object.is(hypot2(x, y), Math.hypot(x, y)), `${x}, ${y}`);
});
