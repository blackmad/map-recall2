import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capRoofsUnderFronts, clipHalf, frontCoords, type Ring3} from './frontZones';

// A front along x from (0,0) to (10,0); its outward normal is (-tz, tx) = (0, 1): the street is at +z, the building at -z.
const chord = {a: [0, 0] as [number, number], b: [10, 0] as [number, number]};
const area = (r: Ring3) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0)) / 2;
const block = (x0: number, x1: number, z0: number, z1: number, y: number): Ring3 => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];

test('front coordinates: s along the chord, o out of it', () => {
  assert.deepEqual(frontCoords(chord, 3, 2), {s: 3, o: 2});
  assert.deepEqual(frontCoords(chord, 3, -4), {s: 3, o: -4});
});

test('a roof touching no zone comes back unchanged (same object)', () => {
  const r = block(20, 30, -10, 0, 18);
  const out = capRoofsUnderFronts([r], [{chord, s0: 2, s1: 8, depth: 4, cap: 14}]);
  assert.equal(out.length, 1);
  assert.equal(out[0], r);
});

test('the part inside the zone is capped, the rest keeps its height, and the area is conserved', () => {
  const r = block(0, 10, -10, 0, 18.5);
  const out = capRoofsUnderFronts([r], [{chord, s0: 2, s1: 8, depth: 4, cap: 14.5}]);
  assert.equal(out.length, 4, 'inside + before + after + behind');
  const capped = out.filter(p => p.every(q => q[1] === 14.5));
  assert.equal(capped.length, 1);
  assert.ok(Math.abs(area(capped[0]) - 24) < 1e-9, 'zone 6 m x 4 m');
  assert.ok(Math.abs(out.reduce((a, p) => a + area(p), 0) - 100) < 1e-9);
  assert.ok(out.filter(p => p !== capped[0]).every(p => p.every(q => q[1] === 18.5)));
});

test('a sloped roof keeps its plane along the cut and is only lowered, never raised', () => {
  // rises from 10 m at the front (z = 0) to 20 m at z = -10
  const r: Ring3 = [[0, 10, 0], [10, 10, 0], [10, 20, -10], [0, 20, -10]];
  const out = capRoofsUnderFronts([r], [{chord, s0: 0, s1: 10, depth: 5, cap: 12}]);
  const inside = out.find(p => p.some(q => q[1] === 12))!;
  assert.ok(inside.every(q => q[1] <= 12));
  assert.ok(inside.some(q => q[1] === 10), 'points below the cap keep their height');
  const behind = out.find(p => p !== inside)!;
  assert.ok(behind.every(q => Math.abs(q[1] - (10 - q[2])) < 1e-9), 'cut vertices interpolate on the plane');
});

test('half-plane clip keeps the kept side only', () => {
  const r = block(0, 4, 0, 4, 1);
  const c = clipHalf(r, {nx: 1, nz: 0, c: 1});
  assert.ok(c.every(p => p[0] >= 1 - 1e-12));
  assert.ok(Math.abs(area(c) - 12) < 1e-9);
});
