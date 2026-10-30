import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyWall, cityTrimLevel, paintedWall, trimGain, TRIM_REF } from './paintClass.ts';

const CITY = 165; // the thumbnails' median light trim (L* ~67)

test('a white front with no lighter trim is paint at the city white point', () => {
  // A dull capture: white render reading L* ~58 with nothing paler in the crop.
  const r = classifyWall([140, 141, 139], null, CITY);
  assert.equal(r.via, 'city');
  assert.ok(r.gain > 1.2);
  assert.equal(r.painted, true);
});

test('cream and buff fronts are paint, not salmon brick; sunlit red brick stays brick', () => {
  assert.equal(paintedWall([228, 214, 186]), true); // cream render, C* ~16 h ~80 (was brick -> #e3a280)
  assert.equal(paintedWall([214, 190, 150]), true); // pale buff/sandstone
  assert.equal(paintedWall([200, 120, 100]), false); // sunlit red brick, hue ~35
});

test('brick with real white trim is not lifted into paint', () => {
  // Brick L* ~50 next to white frames (L* ~95): gain < 1, brick.
  const r = classifyWall([128, 116, 110], [240, 240, 238], CITY);
  assert.equal(r.via, 'trim');
  assert.ok(r.gain < 1);
  assert.equal(r.painted, false);
});

test('dark brick in a dull crop stays brick', () => {
  assert.equal(classifyWall([75, 73, 73], [165, 167, 171], CITY).painted, false); // Saenredamstraat strip wall
  assert.equal(classifyWall([90, 80, 74], null, CITY).painted, false);
});

test('a lift never pushes a light wall past the white point', () => {
  const r = classifyWall([225, 226, 224], null, CITY);
  assert.equal(r.painted, true);
  assert.deepEqual(r.normalised, [225, 226, 224]);
  assert.ok(Math.max(...classifyWall([180, 180, 178], null, CITY).normalised) <= 216);
});

test('gain is clamped and the city level is a median', () => {
  assert.equal(trimGain([10, 10, 10], [80, 80, 80], CITY).gain, 1.45);
  assert.equal(cityTrimLevel([[100, 100, 100], null, [200, 200, 200], [150, 150, 150]]), 150);
  assert.equal(cityTrimLevel([]), TRIM_REF);
});
