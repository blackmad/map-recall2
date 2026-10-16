import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampToRim, nearestRouteIndex, RADAR_RADIUS_M, radarLocal, radarOffset, radarRadiusForSpeed, tileRange } from './radar.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('radius opens with speed inside its range', () => {
  const r = RADAR_RADIUS_M.desktop;
  assert.equal(radarRadiusForSpeed(0, r), r[0]);
  assert.equal(radarRadiusForSpeed(1, r), r[1]);
  assert.equal(radarRadiusForSpeed(5, r), r[1]);
  assert.equal(radarRadiusForSpeed(Number.NaN, r), r[0]);
  const mid = radarRadiusForSpeed(0.5, r);
  assert.ok(mid > r[0] && mid < r[1]);
});

test('heading-up: what lies ahead of the rider is drawn above the centre', () => {
  // Riding east (game angle 0) under a heading-up camera: rotation = angle + pi/2.
  const rotation = Math.PI / 2;
  const ahead = radarOffset([100, 0], rotation, 1); // 100 m east
  close(ahead[0], 0); close(ahead[1], -100);
  const left = radarOffset([0, 100], rotation, 1); // north is on the rider's left
  close(left[0], -100); close(left[1], 0);
  // North-up camera: north is up, east is right.
  const n = radarOffset([0, 50], 0, 2);
  close(n[0], 0); close(n[1], -100);
  const e = radarOffset([50, 0], 0, 2);
  close(e[0], 100); close(e[1], 0);
});

test('an off-radar destination clamps to the rim, keeping its bearing', () => {
  const inside = clampToRim([10, -20], 80);
  assert.equal(inside.clamped, false);
  assert.deepEqual(inside.at, [10, -20]);
  const out = clampToRim([300, 400], 80);
  assert.equal(out.clamped, true);
  close(Math.hypot(out.at[0], out.at[1]), 80);
  close(out.at[0] / out.at[1], 300 / 400);
});

test('tile range covers the square around the rider', () => {
  assert.deepEqual(tileRange([0, 0], 100, 160), { x0: -1, y0: -1, x1: 0, y1: 0 });
  assert.deepEqual(tileRange([500, -10], 320, 160), { x0: 1, y0: -3, x1: 5, y1: 1 });
});

test('local frame: the origin and north/east directions', () => {
  const o = radarLocal(4.9, 52.37);
  close(o[0], 0); close(o[1], 0);
  const ne = radarLocal(4.91, 52.38);
  assert.ok(ne[0] > 600 && ne[0] < 700, `east ${ne[0]}`);
  assert.ok(ne[1] > 1100 && ne[1] < 1110, `north ${ne[1]}`);
});

test('nearest route index follows the rider and recovers from a jump', () => {
  const route = new Float32Array([0, 0, 10, 0, 20, 0, 30, 0, 1000, 0, 2000, 0]);
  assert.equal(nearestRouteIndex(route, [19, 1], 0), 2);
  assert.equal(nearestRouteIndex(route, [1990, 0], 2), 5);
  assert.equal(nearestRouteIndex(new Float32Array(0), [0, 0], 0), 0);
});
