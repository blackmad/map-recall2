import assert from 'node:assert/strict';
import test from 'node:test';
import { facadeNudge, FACADE_NUDGE_PX } from './freeRideWater';

const box = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

test('a point outside every footprint stays', () => {
  const r = facadeNudge({ x: 0, y: 0 }, null, box(10, 10, 20, 20));
  assert.deepEqual(r, { point: { x: 0, y: 0 }, inside: false, moved: false });
});

test('a point inside a small footprint moves to open ground within 15 m', () => {
  const r = facadeNudge({ x: 15, y: 15 }, null, box(10, 10, 20, 20));
  assert.equal(r.inside, true);
  assert.equal(r.moved, true);
  assert.ok(Math.hypot(r.point.x - 15, r.point.y - 15) <= FACADE_NUDGE_PX);
  assert.equal(box(10, 10, 20, 20)(r.point.x, r.point.y), false);
});

test('a point in the middle of a building larger than the reach stays', () => {
  const r = facadeNudge({ x: 0, y: 0 }, null, box(-500, -500, 500, 500));
  assert.deepEqual(r, { point: { x: 0, y: 0 }, inside: true, moved: false });
});

test('the nudge never lands in water', () => {
  const water = (x: number) => x > 20;
  const r = facadeNudge({ x: 15, y: 15 }, water, box(10, 10, 20, 20));
  assert.equal(r.moved, true);
  assert.ok(r.point.x <= 20 - 9);
});
