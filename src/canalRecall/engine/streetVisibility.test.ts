import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearEye, coverAheadPoints, easePullIn, eyeInsideBuilding, footprintTopM, footprintsNear, nearPlaneReachM, streetCover, PULL_IN_MIN_FRACTION, type Eye } from './streetVisibility';
import type { LngLat } from '../coveredPassage';

// A local frame in metres around Amsterdam; x east, y north.
const LAT0 = 52.37, LNG0 = 4.89, kx = 111_320 * Math.cos(LAT0 * Math.PI / 180), ky = 111_320;
const ll = (x: number, y: number): LngLat => [LNG0 + x / kx, LAT0 + y / ky];
const box = (id: string, x0: number, y0: number, x1: number, y1: number, height = 14, extra: Record<string, unknown> = {}) => ({
  properties: { id, height, ...extra },
  geometry: { type: 'Polygon', coordinates: [[ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]] },
});

// A canal-house row north of the street (y 4..14), the rider bumped 2 m into it at (0, 6), now facing south (the
// street), so the chase camera, behind the rider, is north of them, inside the row.
const row = [box('house-a', -6, 4, 0, 14), box('house-b', 0, 4, 6, 14), box('house-c', 6, 4, 12, 14)];
const rider = ll(1, 2); // on the street, 2 m south of the facade
const chase = (from: LngLat, towardY: number, D = 30) => (pitch: number, f: number): Eye => {
  const r = pitch * Math.PI / 180, h = f * D * Math.sin(r), a = f * D * Math.cos(r);
  const [x, y] = [(from[0] - LNG0) * kx, (from[1] - LAT0) * ky];
  return { lngLat: ll(x, y + towardY * h), altitude: a };
};

test('footprintTopM takes the ridge when known, else eaves, else 5 m', () => {
  assert.equal(footprintTopM({ height: 14, roofEavesHeightM: 11 }), 14);
  assert.equal(footprintTopM({ roofEavesHeightM: 11 }), 11);
  assert.equal(footprintTopM({}), 5);
});

test('eyeInsideBuilding: inside below the top, clear above it or in the street', () => {
  assert.equal(eyeInsideBuilding({ lngLat: ll(2, 9), altitude: 8 }, row, 0.6)?.properties?.id, 'house-b');
  assert.equal(eyeInsideBuilding({ lngLat: ll(2, 9), altitude: 20 }, row, 0.6), null);
  assert.equal(eyeInsideBuilding({ lngLat: ll(2, 0), altitude: 8 }, row, 0.6), null);
  // The near plane's reach: an eye 0.4 m in front of the facade is inside once the reach is 0.6 m.
  assert.equal(eyeInsideBuilding({ lngLat: ll(2, 3.6), altitude: 8 }, row, 0.2), null);
  assert.equal(eyeInsideBuilding({ lngLat: ll(2, 3.6), altitude: 8 }, row, 0.6)?.properties?.id, 'house-b');
});

test('footprintsNear: the grid walk returns the same set as the linear filter', () => {
  const many = Array.from({ length: 2500 }, (_, i) => box(`b${i}`, (i % 50) * 20, Math.floor(i / 50) * 20, (i % 50) * 20 + 8, Math.floor(i / 50) * 20 + 8));
  const p = ll(205, 405);
  const grid = footprintsNear(p, 30, many).map(f => f.properties.id);
  const linear = footprintsNear(p, 30, many, Infinity).map(f => f.properties.id);
  assert.deepEqual(grid, linear);
  assert.ok(grid.includes('b1010') && grid.length < 20);
});

test('clearEye: a clear chase camera is left alone', () => {
  const r = clearEye(60, chase(rider, -1), row, () => 0.6);
  assert.deepEqual(r, { pitch: 60, fraction: 1, insideId: null, stuck: false });
});

test('clearEye: the camera swung into the row after a bump is pulled in, never left inside', () => {
  // Rider faces the street (south); the camera 30 m back at 60° is 26 m north, 15 m up: inside the 14 m row? 26 m
  // north is past the row (y 14), so use a deeper block to put the eye inside.
  const block = [box('block', -20, 4, 20, 40, 18)];
  const eyeAt = chase(rider, +1);
  assert.ok(eyeInsideBuilding(eyeAt(60, 1), block, 0.6), 'precondition: the full-distance eye is inside the block');
  const r = clearEye(60, eyeAt, block, () => 0.6);
  assert.equal(r.insideId, 'block');
  assert.equal(r.stuck, false);
  assert.equal(eyeInsideBuilding(eyeAt(r.pitch, r.fraction), block, 0.6), null);
  assert.ok(r.fraction < 1);
});

test('clearEye: when pulling in is not enough the pitch drops past the clearance cap', () => {
  // A 40 m tower block whose wall is 1 m behind the rider: every pull-in fraction ≥ 0.3 is inside; overhead clears.
  const tower = [box('tower', -30, 3, 30, 60, 40)];
  const eyeAt = chase(rider, +1, 60);
  const r = clearEye(60, eyeAt, tower, () => 0.6);
  assert.equal(r.fraction, PULL_IN_MIN_FRACTION);
  assert.ok(r.pitch < 50, `pitch ${r.pitch}`);
  assert.equal(eyeInsideBuilding(eyeAt(r.pitch, r.fraction), tower, 0.6), null);
});

test('clearEye: a rider deep inside a footprint reports stuck (the caller ghosts it)', () => {
  const deep = [box('deep', -50, -50, 50, 50, 80)];
  const r = clearEye(60, chase(rider, +1), deep, () => 0.6);
  assert.equal(r.stuck, true);
  assert.equal(r.insideId, 'deep');
});

test('easePullIn: in at once, out eased', () => {
  assert.equal(easePullIn(null, 0.6), 0.6);
  assert.equal(easePullIn(1, 0.5), 0.5);
  const out = easePullIn(0.5, 1);
  assert.ok(out > 0.5 && out < 0.6);
  assert.equal(easePullIn(0.999, 1), 1);
});

test('nearPlaneReachM: half-diagonal of the near plane', () => {
  assert.ok(Math.abs(nearPlaneReachM(1, 90, 1) - Math.SQRT2) < 1e-9);
});

test('streetCover: a bump into a house front never covers; a passage on the route does', () => {
  const house = box('house', -5, 4, 5, 14, 14);
  const bumped = ll(0, 6); // 2 m inside the facade
  // Free Ride: no route; the road underfoot runs east-west along the street at y = 0.
  assert.equal(streetCover([house], { rider: bumped, route: null, road: { lngLat: ll(0, 0), angle: 0 }, riderAngle: -Math.PI / 2 }), null);
  // No road known either: nothing ahead, no cover.
  assert.equal(streetCover([house], { rider: bumped, route: null, road: null, riderAngle: null }), null);
  // A passage: the route runs north through the building.
  const route = [ll(0, -10), ll(0, 30)];
  assert.equal(streetCover([house], { rider: ll(0, 9), route, road: null, riderAngle: null })?.properties.id, 'house');
});

test('coverAheadPoints follows the road the way the bike faces', () => {
  const pts = coverAheadPoints({ rider: ll(0, 0), route: null, road: { lngLat: ll(0, 0), angle: 0 }, riderAngle: Math.PI });
  // World angle 0 is east; the bike faces west (π), so the points go west.
  assert.ok(pts.length > 2 && pts[pts.length - 1][0] < pts[0][0]);
});
