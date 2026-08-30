// Where a route starts and ends, and whether its drawn line still describes
// the trip. These decide what geography the player is sent to learn, so they
// are asserted directly rather than observed by generating routes until one
// looks wrong.

import assert from 'node:assert/strict';

import {
  advanceLiveRoute,
  kmBetween,
  LIVE_ROUTE_OFF_ROUTE_DIST,
  LIVE_ROUTE_REROUTE_INTERVAL,
  nearestRouteIndex,
  nearestSnappableDestination,
  pickDestinationNear,
  rankRetargetCandidates,
  routeAhead,
  ROUTE_POI_MAX_PAIR_KM,
  type LiveRouteState,
  type RoutePoi,
} from '../src/canalRecall/game/routeSelection';
import type { WorldPoint } from '../src/canalRecall/game/worldTypes';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

// Real Amsterdam POIs, plus a fort out in Weesp that must never be paired with
// anything in the centre.
const CENTRAL: RoutePoi = { id: 'central', name: 'Central Station', lat: 52.3784943, lng: 4.899843 };
const PALACE: RoutePoi = { id: 'palace', name: 'Royal Palace', lat: 52.373258, lng: 4.8918222 };
const RIJKS: RoutePoi = { id: 'rijks', name: 'Rijksmuseum', lat: 52.3598672, lng: 4.8864162 };
const WEESP: RoutePoi = { id: 'weesp', name: 'Weesp Fort', lat: 52.3080, lng: 5.0410 };
const POIS = [CENTRAL, PALACE, RIJKS, WEESP];

check('kmBetween is right at city scale', () => {
  assert.equal(kmBetween(CENTRAL, CENTRAL), 0);
  const centralToRijks = kmBetween(CENTRAL, RIJKS);
  assert.ok(centralToRijks > 2 && centralToRijks < 2.5,
    `Central to the Rijksmuseum should be about 2.1 km, got ${centralToRijks.toFixed(2)}`);
  assert.ok(kmBetween(CENTRAL, WEESP) > ROUTE_POI_MAX_PAIR_KM,
    'Weesp is outside pairing range of the centre, which is the whole point of the cap');
});

check('a destination is picked from within pairing range', () => {
  // Both ends have to fit in one fetched OSM window.
  const picks = new Set<string>();
  for (let i = 0; i < POIS.length; i++) {
    const chosen = pickDestinationNear(POIS, CENTRAL, () => i % 3);
    if (chosen) picks.add(chosen.id);
  }
  assert.ok(!picks.has('weesp'), 'a Weesp fort must not be paired with the centre');
  assert.ok(!picks.has('central'), 'a route may not start and end in the same place');
  assert.ok(picks.size > 0);
});

check('an isolated start still gets a trip', () => {
  // Nothing is within range of Weesp, so the whole pool is the fallback rather
  // than returning nothing and leaving the player on the setup screen.
  const chosen = pickDestinationNear(POIS, WEESP, () => 0);
  assert.ok(chosen, 'a start with no near neighbour must still produce a destination');
  assert.notEqual(chosen.id, 'weesp');
});

check('a pool with nothing in it produces nothing, not a crash', () => {
  assert.equal(pickDestinationNear([], CENTRAL, () => 0), null);
  assert.equal(pickDestinationNear([CENTRAL], CENTRAL, () => 0), null,
    'the only POI being the start is an empty pool');
});

check('an excluded destination is not offered', () => {
  for (let i = 0; i < 6; i++) {
    const chosen = pickDestinationNear(POIS, CENTRAL, () => i % 3, 'palace');
    assert.notEqual(chosen?.id, 'palace');
  }
});

check('the nearest snappable destination skips ones that do not snap', () => {
  const snapped: string[] = [];
  const result = nearestSnappableDestination(POIS, PALACE, poi => {
    snapped.push(poi.id);
    // The two nearest are off-network; the third snaps.
    return poi.id === 'rijks' ? { x: 10, y: 20 } : null;
  });
  assert.equal(result?.poi.id, 'rijks');
  assert.deepEqual(result?.point, { x: 10, y: 20 });
  assert.ok(snapped.indexOf('palace') < snapped.indexOf('rijks'),
    'candidates are tried nearest-first');
});

check('snap attempts are capped, because each one searches every segment', () => {
  let tried = 0;
  const many: RoutePoi[] = [];
  for (let i = 0; i < 200; i++) many.push({ id: `p${i}`, name: `P${i}`, lat: 52 + i * 1e-4, lng: 4.9 });
  const result = nearestSnappableDestination(many, CENTRAL, () => { tried++; return null; }, null, 25);
  assert.equal(result, null);
  assert.equal(tried, 25, `expected the cap to hold, tried ${tried}`);
});

check('retarget candidates are ranked by nearness to the original destination', () => {
  const start: WorldPoint = { x: 0, y: 0 };
  const originalFinish: WorldPoint = { x: 1000, y: 0 };
  const points: Record<string, WorldPoint> = {
    central: { x: 900, y: 0 },   // closest to the original destination
    palace: { x: 400, y: 0 },
    rijks: { x: 1400, y: 0 },
    weesp: { x: 50, y: 0 },      // too close to the start
  };
  const ranked = rankRetargetCandidates(
    POIS, start, originalFinish, poi => points[poi.id] ?? null, 200);
  assert.deepEqual(ranked.map(entry => entry.poi.id), ['central', 'rijks', 'palace'],
    'sorted by gap from the destination the player was actually given');
  assert.ok(!ranked.some(entry => entry.poi.id === 'weesp'),
    'a stand-in 50 px from the start would make the trip trivial');
});

check('unsnappable candidates never reach the shortlist', () => {
  const ranked = rankRetargetCandidates(
    POIS, { x: 0, y: 0 }, { x: 1000, y: 0 }, () => null, 200);
  assert.deepEqual(ranked, []);
});

// ---- The live route line ----

const ROUTE: WorldPoint[] = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 0 },
];
const FINISH: WorldPoint = { x: 400, y: 0 };
const fresh: LiveRouteState = { index: 0, rerouteTimer: 0 };

check('nearestRouteIndex finds the vertex the player is beside', () => {
  assert.deepEqual(nearestRouteIndex(ROUTE, { x: 205, y: 10 }), { index: 2, distance: Math.hypot(5, 10) });
});

check('staying on the route never triggers a reroute', () => {
  const decision = advanceLiveRoute(fresh, ROUTE, { x: 210, y: 20 }, 1 / 60);
  assert.equal(decision.shouldReroute, false);
  assert.equal(decision.nearestIndex, 2);
});

check('straying far enough replans, once', () => {
  const strayed = { x: 200, y: LIVE_ROUTE_OFF_ROUTE_DIST + 10 };
  const first = advanceLiveRoute(fresh, ROUTE, strayed, 1 / 60);
  assert.equal(first.shouldReroute, true);
  assert.equal(first.state.rerouteTimer, LIVE_ROUTE_REROUTE_INTERVAL);

  // Still off-route on the very next frame, but rationed: one Dijkstra per
  // interval, not one per frame.
  const second = advanceLiveRoute(first.state, ROUTE, strayed, 1 / 60);
  assert.equal(second.shouldReroute, false, 'a player cutting a corner must not replan every frame');

  const later = advanceLiveRoute(second.state, ROUTE, strayed, LIVE_ROUTE_REROUTE_INTERVAL);
  assert.equal(later.shouldReroute, true, 'but it does try again once the interval has passed');
});

check('drifting just inside the threshold is tolerated', () => {
  const decision = advanceLiveRoute(fresh, ROUTE, { x: 200, y: LIVE_ROUTE_OFF_ROUTE_DIST - 1 }, 1 / 60);
  assert.equal(decision.shouldReroute, false);
});

check('routeAhead trims passed vertices and never returns a stub', () => {
  assert.deepEqual(routeAhead(ROUTE, 2, FINISH), [{ x: 200, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 0 }]);
  // At the last vertex there is nothing "ahead"; the line must still have two
  // points or it cannot be drawn at all.
  assert.deepEqual(routeAhead(ROUTE, ROUTE.length - 1, FINISH), [{ x: 400, y: 0 }, FINISH]);
  assert.deepEqual(routeAhead([], 0, FINISH), [FINISH]);
});

console.log(`Route selection OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
