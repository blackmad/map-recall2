import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COVER_MIN_DEPTH_M, coverRouteFlag, coveringBuilding, coveringBuildingOnPath, headingAheadPoints, insideDepthM, routeAheadPoints,
  type LngLat,
} from './coveredPassage.ts';

// A local metre frame around Bloemgracht (Jordaan): x east, y north.
const O: LngLat = [4.8812, 52.3756];
const kx = 111_320 * Math.cos(O[1] * Math.PI / 180), ky = 110_540;
const at = (x: number, y: number): LngLat => [O[0] + x / kx, O[1] + y / ky];
const box = (id: string, x0: number, y0: number, x1: number, y1: number, minHeight = 0) => ({
  properties: { id, min_height: minHeight },
  geometry: { type: 'Polygon', coordinates: [[at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)]] },
});

// A canal house 8 m wide and 15 m deep, its front on y = 0; the street (and the route) runs east along y = -6.
const house = box('house', 0, 0, 8, 15);
const streetRoute = [at(-40, -6), at(60, -6)];
// A covered cycle passage (the Cuyperspassage shape): a 100 m x 40 m shed with the route running through it.
const shed = box('shed', 0, 0, 100, 40);
const passageRoute = [at(-30, 20), at(130, 20)];

test('inside depth: metres to the nearest edge, 0 outside', () => {
  assert.ok(Math.abs(insideDepthM(house.geometry, at(4, 1)) - 1) < 0.01);
  assert.ok(Math.abs(insideDepthM(house.geometry, at(4, 7)) - 4) < 0.01, 'the side walls are nearer than the back');
  assert.equal(insideDepthM(house.geometry, at(4, -1)), 0);
});

test('route ahead: from the rider\'s nearest route point, every 3 m to 15 m; null off the route', () => {
  const pts = routeAheadPoints(streetRoute, at(4, -4))!;
  assert.equal(pts.length, 6);
  const [x0, y0] = [(pts[0][0] - O[0]) * kx, (pts[0][1] - O[1]) * ky];
  assert.ok(Math.abs(x0 - 4) < 0.01 && Math.abs(y0 + 6) < 0.01);
  const last = pts[pts.length - 1];
  assert.ok(Math.abs((last[0] - O[0]) * kx - 19) < 0.01);
  assert.equal(routeAheadPoints(streetRoute, at(4, 30)), null, '36 m off the route');
  assert.equal(routeAheadPoints(null, at(0, 0)), null);
  // Across a vertex: the walk continues on the next segment.
  const bend = routeAheadPoints([at(0, 0), at(5, 0), at(5, 50)], at(0, 0))!;
  assert.ok(Math.abs((bend[2][1] - O[1]) * ky - 1) < 0.01, '6 m along: 1 m up the second segment');
});

// Named regression (user report 2026-11-05, own engine): riding into a Bloemgracht house front made the house vanish.
test('a bump into a house front does not cover the rider (Bloemgracht)', () => {
  const bumped = at(4, 1); // 1 m inside the front: the road corridor's edge on a narrow canal street
  assert.equal(coveringBuilding([house], bumped)?.properties.id, 'house', 'the old rule covered it');
  assert.equal(coveringBuildingOnPath([house], bumped, routeAheadPoints(streetRoute, bumped)!), null, 'too shallow');
  const deeper = at(4, 2.5);
  assert.ok(insideDepthM(house.geometry, deeper) >= COVER_MIN_DEPTH_M);
  assert.equal(coveringBuildingOnPath([house], deeper, routeAheadPoints(streetRoute, deeper)!), null, 'deep enough, but the route runs on outside');
});

// Named regression (user report 2026-10-01): the Cuyperspassage under Centraal's train shed still covers.
test('the passage the route runs through covers the rider (Cuyperspassage)', () => {
  for (const x of [2, 30, 97]) {
    const rider = at(x, 20);
    assert.equal(coveringBuildingOnPath([house, shed], rider, routeAheadPoints(passageRoute, rider)!)?.properties.id, 'shed', `at ${x} m`);
  }
  const raised = box('deck', 0, 0, 100, 40, 5);
  assert.equal(coveringBuildingOnPath([raised], at(30, 20), routeAheadPoints(passageRoute, at(30, 20))!), null, 'a raised deck is open above the rider');
});

test('off the route the way the bike moves answers: along the passage covers, a stop facing a wall does not past the depth gate', () => {
  const rider = at(30, 20);
  assert.equal(coveringBuildingOnPath([shed], rider, headingAheadPoints(rider, Math.PI / 2))?.properties.id, 'shed', 'heading east through the shed');
  const bumped = at(4, 1);
  assert.equal(coveringBuildingOnPath([house], bumped, headingAheadPoints(bumped, 0)), null, 'facing into the house, 1 m in');
});

test('?coverRoute=0 restores the old rule', () => {
  const g = globalThis as { __canalRecallCoverRoute?: unknown };
  assert.equal(coverRouteFlag(), true);
  g.__canalRecallCoverRoute = '0';
  assert.equal(coverRouteFlag(), false);
  delete g.__canalRecallCoverRoute;
});
