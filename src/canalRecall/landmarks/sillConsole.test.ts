import test from 'node:test';
import assert from 'node:assert/strict';
import {outlineArea, sillConsoleOutline} from './sillConsole.ts';

test('sill console: closed counter-clockwise outline inside its box, flat top, pendant at the depth', () => {
  const p = sillConsoleOutline({width: 1.1, depth: 0.22});
  assert.ok(p.length >= 10);
  assert.ok(outlineArea(p) > 0, 'counter-clockwise');
  for (const [x, y] of p) { assert.ok(Math.abs(x) <= 0.55 + 1e-9); assert.ok(y <= 1e-9 && y >= -0.22 - 1e-9); }
  assert.deepEqual(p[0], [-0.55, 0]);
  assert.deepEqual(p.at(-1), [0.55, 0]);
  assert.equal(Math.min(...p.map(q => q[1])), -0.22);
  // less than the full box: the scallops cut it
  assert.ok(outlineArea(p) < 1.1 * 0.22 * 0.8);
});

test('sill console: mirror symmetric and with no repeated consecutive points', () => {
  const p = sillConsoleOutline({width: 0.9, depth: 0.2, steps: 6});
  const key = (q: number[]) => `${q[0].toFixed(6)},${q[1].toFixed(6)}`;
  const set = new Set(p.map(key));
  for (const [x, y] of p) assert.ok(set.has(key([-x || 0, y])), `mirror of ${x},${y}`);
  for (let i = 1; i < p.length; i++) assert.notDeepEqual(p[i], p[i - 1]);
});

test('sill console: degenerate sizes give no outline', () => {
  assert.deepEqual(sillConsoleOutline({width: 0, depth: 0.2}), []);
  assert.deepEqual(sillConsoleOutline({width: 1, depth: 0}), []);
});
