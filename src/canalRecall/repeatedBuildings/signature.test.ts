import assert from 'node:assert/strict';
import test from 'node:test';
import {complexity, shapeDistance, signature, simplifyCollinear, type P} from './signature.ts';

const L_SHAPE: P[] = [[0, 0], [20, 0], [20, 8], [8, 8], [8, 14], [0, 14], [0, 0]];
const move = (r: P[], ang: number, dx: number, dy: number): P[] => r.map(([x, y]) => [x * Math.cos(ang) - y * Math.sin(ang) + dx, x * Math.sin(ang) + y * Math.cos(ang) + dy]);

test('a footprint matches itself turned and moved', () => {
  const a = signature(L_SHAPE)!, b = signature(move(L_SHAPE, 1.1, 120_000, 487_000))!;
  assert.ok(Math.abs(a.area - 208) < 1e-6);
  assert.ok(shapeDistance(a, b).d < 0.2);
});

test('a mirrored copy matches and says so', () => {
  const mirrored = L_SHAPE.map(([x, y]) => [-x, y] as P);
  const r = shapeDistance(signature(L_SHAPE)!, signature(move(mirrored, 0.4, 5, 5))!);
  assert.ok(r.d < 0.2);
  assert.equal(r.mirrored, true);
});

test('a different arm is metres away', () => {
  const other: P[] = [[0, 0], [20, 0], [20, 8], [12, 8], [12, 14], [0, 14]];
  assert.ok(shapeDistance(signature(L_SHAPE)!, signature(other)!).d > 2);
});

test('collinear digitising noise is dropped; a rectangle is plain, an L is not', () => {
  const noisy: P[] = [[0, 0], [5, 0.05], [10, 0], [10, 6], [0, 6]];
  assert.equal(simplifyCollinear(noisy).length, 4);
  const rect = signature(noisy)!;
  assert.equal(rect.reflex, 0);
  assert.equal(complexity(rect), 0);
  const l = signature(L_SHAPE)!;
  assert.equal(l.reflex, 1);
  assert.ok(complexity(l) > 0.2);
});
