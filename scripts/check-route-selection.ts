// Where a route starts and ends, and whether its drawn line still describes
// the trip. These decide what geography the player is sent to learn, so they
// are asserted directly rather than observed by generating routes until one
// looks wrong.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANAL_CITIES } from '../src/canalRecall/game/cities.ts';

import {
  advanceLiveRoute,
  capWeightShares,
  HOME_MAX_SHARE,
  mergeManualPoiFeatures,
  pickReviewRoute,
  readRecentDestinations,
  recentDestinationFactor,
  recentDestinationsKey,
  recordRecentDestination,
  rememberDestination,
  recentRankNear,
  resolveRecentPois,
  HOME_NEXT_MIN_KM,
  HOME_RADIUS_OVERSHOOT,
  type DuePlace,
  GPS_ORIGIN_ID,
  GpsOriginError,
  HOME_RADIUS_KNOWN_TO_EXPAND,
  HOME_RADIUS_MAX_KM,
  HOME_RADIUS_MIN_KM,
  homeLearningRadiusKm,
  isTeachableRouteDestination,
  kmBetween,
  LIVE_ROUTE_OFF_ROUTE_DIST,
  LIVE_ROUTE_REROUTE_INTERVAL,
  nearestRouteIndex,
  nearestSnappableDestination,
  pickDestinationNear,
  pickHomeDestination,
  pointInGeocodeViewbox,
  rankRetargetCandidates,
  resolveGpsOrigin,
  browserGpsReader,
  routeAhead,
  ROUTE_POI_MAX_PAIR_KM,
  scoreHomeDestination,
  type LiveRouteState,
  type MasterySample,
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

check('route destinations have something to teach on arrival', () => {
  assert.equal(isTeachableRouteDestination({
    funFact: '',
    wikipediaExtract: '',
    wikipediaImageUrl: '',
    wikipediaUrl: '',
  }), false, 'UvA PC Hoofthuis-style bare OSM features are not destination rewards');
  assert.equal(isTeachableRouteDestination({
    wikipediaExtract: 'The building was designed by Theo Bosch and Aldo van Eyck.',
  }), true, 'an encyclopedia description makes the destination teachable');
  assert.equal(isTeachableRouteDestination({
    wikipediaImageUrl: 'https://example.invalid/place.jpg',
  }), true, 'a photograph gives the arrival card something to show');
  assert.equal(isTeachableRouteDestination({
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Example',
  }), true, 'an article can be fetched and opened even before its extract is cached');
});

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

// ---- Home expanding radius ----

const HOME = { id: 'home', lat: 52.373258, lng: 4.8918222 }; // near the Palace

check('a fresh home ring starts at the minimum radius', () => {
  assert.equal(homeLearningRadiusKm(HOME, []), HOME_RADIUS_MIN_KM);
});

check('practised nearby places expand the home ring', () => {
  const samples: MasterySample[] = [];
  for (let i = 0; i < HOME_RADIUS_KNOWN_TO_EXPAND; i++) {
    samples.push({
      lat: HOME.lat + 0.002 * (i + 1), // ~0.2 km steps north
      lng: HOME.lng,
      mastery: 0.8,
    });
  }
  const radius = homeLearningRadiusKm(HOME, samples);
  assert.ok(radius > HOME_RADIUS_MIN_KM,
    `expected expansion beyond ${HOME_RADIUS_MIN_KM}, got ${radius}`);
  assert.ok(radius <= HOME_RADIUS_MAX_KM);
});

check('a fresh home pick stays inside the learning ring (not Weesp)', () => {
  const picks = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const chosen = pickHomeDestination(POIS, HOME, [], () => (i + 0.5) / 12);
    assert.ok(chosen, 'home must still produce a destination');
    picks.add(chosen.poi.id);
    assert.notEqual(chosen.poi.id, 'weesp', 'Weesp is outside a fresh 1 km ring');
    assert.equal(chosen.radiusKm, HOME_RADIUS_MIN_KM);
  }
  assert.ok(picks.has('palace') || picks.has('central') || picks.has('rijks'));
});

check('home scoring prefers a closer novel landmark over a familiar far one', () => {
  // Palace is ~0 km from HOME; Rijks ~1.6 km. With high familiarity at Rijks,
  // palace should score higher inside the min ring... Palace is too close to
  // HOME (< HOME_MIN_TRIP). Use Central (~0.7 km) vs a mid-ring familiar POI.
  const nearNovel = scoreHomeDestination(CENTRAL, HOME, HOME_RADIUS_MIN_KM, []);
  const nearFamiliar = scoreHomeDestination(CENTRAL, HOME, HOME_RADIUS_MIN_KM, [
    { lat: CENTRAL.lat, lng: CENTRAL.lng, mastery: 1 },
  ]);
  assert.ok(nearNovel > nearFamiliar,
    `novel corridor should beat a mastered one (${nearNovel} vs ${nearFamiliar})`);
});

check('home pick excludes the previous destination on the next outbound leg', () => {
  for (let i = 0; i < 8; i++) {
    const chosen = pickHomeDestination(POIS, HOME, [], () => (i + 0.5) / 8, 'palace');
    assert.notEqual(chosen?.poi.id, 'palace');
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

check('nearestRouteIndex finds the segment the player is on and the distance to the line', () => {
  assert.deepEqual(nearestRouteIndex(ROUTE, { x: 205, y: 10 }), { index: 2, distance: 10 });
});

check('riding down a long straight is on the route (Marnixstraat)', () => {
  // Named regression (user report 2026-09-29, "while I'm on it, it jumps to
  // another street"): measured to vertices, mid-block on a 2 km straight was
  // 1 km "off route", so the line replanned every two seconds.
  const straight: WorldPoint[] = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 500 }];
  const decision = advanceLiveRoute(fresh, straight, { x: 1000, y: 12 }, 1 / 60);
  assert.equal(decision.shouldReroute, false);
  assert.equal(decision.offBy, 12);
  assert.equal(decision.nearestIndex, 0, 'the stretch being ridden stays drawn');
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

const AMSTERDAM_BOX = CANAL_CITIES.amsterdam.geocodeViewbox;

check('GPS origin stays inside the city viewbox', () => {
  assert.equal(pointInGeocodeViewbox(52.373, 4.892, AMSTERDAM_BOX), true);
  assert.equal(pointInGeocodeViewbox(40.71, -74.01, AMSTERDAM_BOX), false);
});

const gpsOrigin = await resolveGpsOrigin({
  cityName: 'Amsterdam',
  viewbox: AMSTERDAM_BOX,
  readFix: async () => ({ lat: 52.373, lng: 4.892 }),
});
assert.equal(gpsOrigin.id, GPS_ORIGIN_ID);
assert.equal(gpsOrigin.name, 'Here');
assert.equal(gpsOrigin.lat, 52.373);
checks.push('resolveGpsOrigin uses a live fix as Here, not a geocoded home');

const weespOrigin = await resolveGpsOrigin({
  cityName: 'Amsterdam',
  viewbox: AMSTERDAM_BOX,
  readFix: async () => ({ lat: 52.299583, lng: 5.044159 }),
});
assert.deepEqual(weespOrigin, { id: GPS_ORIGIN_ID, name: 'Here', lat: 52.299583, lng: 5.044159 });
checks.push('Amsterdam admits a fixed Weesp GPS origin without moving it');

await assert.rejects(
  () => resolveGpsOrigin({
    cityName: 'Amsterdam',
    viewbox: AMSTERDAM_BOX,
    readFix: async () => ({ lat: 52.09, lng: 5.12 }),
  }),
  (error: unknown) => error instanceof GpsOriginError && error.code === 'outside-city',
);
checks.push('resolveGpsOrigin refuses a fix outside the chosen city');

await assert.rejects(
  () => browserGpsReader(undefined, false)(),
  (error: unknown) => error instanceof GpsOriginError && error.code === 'unsupported',
);
checks.push('GPS start needs a secure context');

// ---------------------------------------------------------------------------
// Home destination variety (2026-10-09): the prod game kept picking De Dolphijn
// from Da Costakade 13. Real Amsterdam POI pool, same filter as game-route.js.
// ---------------------------------------------------------------------------
const AMS = CANAL_CITIES.amsterdam;
const AMS_FEATURES = mergeManualPoiFeatures(
  JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8')), 'amsterdam') as any[];
const AMS_POIS: RoutePoi[] = AMS.curatedPois.map(poi => ({ ...poi }));
{
  const seen = new Set(AMS_POIS.map(poi => poi.name.toLowerCase()));
  for (const feature of AMS_FEATURES) {
    const centre = feature.routeCenter || feature.center;
    if (!centre || !feature.name || !isTeachableRouteDestination(feature)) continue;
    if (seen.has(feature.name.toLowerCase())) continue;
    const poi = { id: `lm-${feature.id}`, name: feature.name, lat: centre[0], lng: centre[1] };
    if (!feature.manualPoi && kmBetween(poi, AMS.center) > 4) continue;
    seen.add(feature.name.toLowerCase());
    AMS_POIS.push(poi);
  }
}
const DA_COSTAKADE = { lat: 52.3728, lng: 4.8737 };

check('recentDestinationFactor: last ride never, older ones climb back', () => {
  assert.equal(recentDestinationFactor(-1), 1);
  assert.equal(recentDestinationFactor(0), 0);
  assert.ok(recentDestinationFactor(1) < recentDestinationFactor(4));
  assert.ok(recentDestinationFactor(7) < 0.5, 'still strongly down-weighted');
  assert.equal(recentDestinationFactor(8), 1);
});

check('capWeightShares: a favourite cannot exceed the share cap', () => {
  const weights = [100, ...Array.from({ length: 29 }, () => 1)];
  const capped = capWeightShares(weights);
  const total = capped.reduce((sum, weight) => sum + weight, 0);
  assert.ok(capped[0] / total <= HOME_MAX_SHARE + 1e-3, `share ${capped[0] / total}`);
  assert.deepEqual(capWeightShares([5, 1]), [5, 1], 'too few candidates to cap');
  assert.deepEqual(capWeightShares([0, 0]), [0, 0]);
});

check('rememberDestination keeps most-recent-first, deduplicated and bounded', () => {
  let recent: string[] = [];
  for (const id of ['a', 'b', 'c', 'a']) recent = rememberDestination(recent, id, 3);
  assert.deepEqual(recent, ['a', 'c', 'b']);
  recent = rememberDestination(recent, 'd', 3);
  assert.deepEqual(recent, ['d', 'a', 'c']);
});

check('recent destinations persist per city and home address', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  const home = recentDestinationsKey('amsterdam', '  Da Costakade 13-3 ');
  assert.equal(home, recentDestinationsKey('amsterdam', 'da costakade 13-3'));
  assert.deepEqual(readRecentDestinations(storage, home), []);
  recordRecentDestination(storage, home, 'x');
  recordRecentDestination(storage, home, 'y');
  recordRecentDestination(storage, recentDestinationsKey('amsterdam', 'Elsewhere 1'), 'z');
  assert.deepEqual(readRecentDestinations(storage, home), ['y', 'x']);
  data.set('canalRecall.recentDestinations.v1', '{not json');
  assert.deepEqual(readRecentDestinations(storage, home), [], 'corrupt storage reads as empty');
  assert.deepEqual(readRecentDestinations(null, home), []);
});

check('home picks never repeat the previous destination and exclude recent ones', () => {
  const recent = AMS_POIS.slice(0, 7).map(poi => poi.id);
  for (let i = 0; i < 300; i += 1) {
    const pick = pickHomeDestination(AMS_POIS, DA_COSTAKADE, [], undefined, null, [recent[0]]);
    assert.notEqual(pick?.poi.id, recent[0]);
  }
});

check('regression: 20 consecutive home picks from Da Costakade 13 are varied (empty and practised history)', () => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const practised: MasterySample[] = [];
  for (let i = 0; i < 400; i += 1) {
    const angle = rnd() * Math.PI * 2, radius = Math.sqrt(rnd()) * 2.2;
    practised.push({
      lat: DA_COSTAKADE.lat + (radius * Math.sin(angle)) / 111,
      lng: DA_COSTAKADE.lng + (radius * Math.cos(angle)) / 68,
      mastery: rnd() < 0.6 ? 1 : 0.33,
    });
  }
  for (const [label, samples] of [['empty', []], ['practised', practised]] as const) {
    for (let trial = 0; trial < 25; trial += 1) {
      let recent: string[] = [];
      const ids: string[] = [];
      for (let i = 0; i < 20; i += 1) {
        const pick = pickHomeDestination(AMS_POIS, DA_COSTAKADE, samples, undefined, null, recent);
        assert.ok(pick, 'a destination exists');
        assert.notEqual(pick.poi.id, ids[ids.length - 1], `${label}: repeated ${pick.poi.name}`);
        ids.push(pick.poi.id);
        recent = rememberDestination(recent, pick.poi.id);
      }
      assert.ok(new Set(ids).size >= 8, `${label}: only ${new Set(ids).size} distinct in 20`);
    }
  }
});

check('regression: no landmark takes more than ~2x the share cap of independent home picks', () => {
  const tally = new Map<string, number>();
  const picks = 4000;
  for (let i = 0; i < picks; i += 1) {
    const pick = pickHomeDestination(AMS_POIS, DA_COSTAKADE, [])!;
    tally.set(pick.poi.id, (tally.get(pick.poi.id) ?? 0) + 1);
  }
  const top = Math.max(...tally.values()) / picks;
  assert.ok(top < HOME_MAX_SHARE + 0.02, `top share ${top}`);
});

check('review rides from home skip recently ridden destinations', () => {
  const home: RoutePoi = { id: 'home', name: 'Home', ...DA_COSTAKADE };
  const near = AMS_POIS.filter(poi => kmBetween(poi, home) >= 0.9 && kmBetween(poi, home) <= 2.5);
  const due = near.slice(0, 20).map(poi => ({ name: `Street by ${poi.name}`, center: [poi.lat, poi.lng] as [number, number] }));
  const first = pickReviewRoute({ pois: [home, ...near], due, from: home, maxKm: 3, chooseIndex: () => 0 });
  assert.ok(first, 'a review ride exists');
  const again = pickReviewRoute({ pois: [home, ...near], due, from: home, maxKm: 3, chooseIndex: () => 0, recentIds: [first.to.id] });
  assert.ok(again);
  assert.notEqual(again.to.id, first.to.id, 'same due set must not replay the same destination');
});

// User report 2026-10-10: still "always" De Dolphijn from Da Costakade 13
// with Plan review on. The review picker took only the top-count pair, so the
// due names (a real signed-in snapshot) pointed at the same Torensluis corner
// every launch, and skipping the exact id moved one door along (Multatuli,
// Magna Plaza, Huis Bartolotti are all within 200 m).
const HOME_DUE: DuePlace[] = JSON.parse(fs.readFileSync('scripts/fixtures/home-review-due-da-costakade.json', 'utf8'));
const HOME_POI: RoutePoi = { id: 'home', name: 'Home', ...DA_COSTAKADE };
const DOLPHIJN = AMS_POIS.find(poi => poi.name === 'De Dolphijn')!;

check('regression: Multatuli and Magna Plaza count as near a recent De Dolphijn', () => {
  assert.ok(DOLPHIJN, 'De Dolphijn is in the pool');
  const recent = resolveRecentPois(AMS_POIS, [DOLPHIJN.id]);
  for (const name of ['Multatuli', 'Magna Plaza', 'Huis Bartolotti']) {
    const poi = AMS_POIS.find(entry => entry.name === name)!;
    assert.equal(recentRankNear(poi, recent), 0, name);
  }
  assert.equal(recentRankNear(AMS_POIS.find(poi => poi.name === 'Noorderkerk')!, recent), -1);
});

check('regression: home review rides from Da Costakade are not one corner (real due set)', () => {
  const tally = new Map<string, number>();
  const picks = 1000;
  for (let i = 0; i < picks; i += 1) {
    const pick = pickReviewRoute({ pois: AMS_POIS, due: HOME_DUE, from: HOME_POI, maxKm: 1.15 })!;
    tally.set(pick.to.id, (tally.get(pick.to.id) ?? 0) + 1);
  }
  const top = Math.max(...tally.values()) / picks;
  assert.ok(tally.size >= 8, `only ${tally.size} destinations on a fresh device`);
  assert.ok(top < 0.2, `top share ${top}`);
  assert.ok((tally.get(DOLPHIJN.id) ?? 0) / picks < 0.15, 'De Dolphijn no longer dominates');
  for (let trial = 0; trial < 20; trial += 1) {
    let recent: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const pick = pickReviewRoute({ pois: AMS_POIS, due: HOME_DUE, from: HOME_POI, maxKm: 1.15, recentIds: recent })!;
      const near = resolveRecentPois(AMS_POIS, recent.slice(0, 3));
      assert.equal(recentRankNear(pick.to, near), -1, `ride ${i} returned to a recent corner: ${pick.to.name}`);
      for (const alt of pick.alternatives ?? []) {
        if (!alt.stop) assert.equal(recentRankNear(alt.to, near), -1, `runner-up ${alt.to.name} is a recent corner`);
      }
      recent = rememberDestination(recent, pick.to.id);
    }
  }
});

check('next home ride starts at the arrival, leaves it, and stays in the home ring', () => {
  const arrival = DOLPHIJN;
  const radiusKm = homeLearningRadiusKm(DA_COSTAKADE, []);
  for (let i = 0; i < 300; i += 1) {
    const pick = pickHomeDestination(AMS_POIS, DA_COSTAKADE, [], undefined, arrival.id, [arrival.id], arrival)!;
    assert.ok(pick, 'a next destination exists');
    assert.ok(kmBetween(pick.poi, arrival) >= HOME_NEXT_MIN_KM, `${pick.poi.name} is next door`);
    assert.ok(kmBetween(pick.poi, DA_COSTAKADE) <= radiusKm * HOME_RADIUS_OVERSHOOT + 1e-9, `${pick.poi.name} left the ring`);
  }
});

console.log(`Route selection OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
