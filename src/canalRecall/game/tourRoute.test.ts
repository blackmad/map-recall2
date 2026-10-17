// node --import tsx --test src/canalRecall/game/tourRoute.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TOUR_LEG_KM,
  advanceOnArrival,
  chooseTourStart,
  TOUR_HUBS,
  isComplete,
  legKm,
  legsOverCap,
  nextLeg,
  startTour,
  stopAsRoutePoi,
  tourLegs,
  tourProgressLabel,
  withinLegCap,
  stopNameSpoils,
  tourDestination,
  tourArrival,
  tourCheckedLabel,
  tourFromSearch,
  persistablePrefs,
  tourPrefsOverride,
  type Tour,
} from './tourRoute.ts';
import { readFileSync } from 'node:fs';

const stop = (name: string, lng: number, lat: number, landmarkId?: string) => ({
  name, lngLat: [lng, lat] as [number, number], why: `${name}.`, source: 'https://example.org', ...(landmarkId ? { landmarkId } : {}),
});

const tour: Tour = {
  id: 't', title: 'Test tour', theme: 'x', blurb: 'b',
  stops: [stop('A', 4.89, 52.37, 'lm1'), stop('B', 4.90, 52.37), stop('C', 4.90, 52.36)],
};

test('a tour starts at its first stop and rides one leg at a time', () => {
  let state = startTour(tour);
  assert.deepEqual(state, { tourId: 't', legIndex: 0, completedStops: [0] });
  assert.equal(isComplete(state, tour), false);
  const leg = nextLeg(state, tour)!;
  assert.equal(leg.from.name, 'A');
  assert.equal(leg.to.name, 'B');
  assert.equal(tourProgressLabel(state, tour), 'Test tour: stop 2 of 3');

  let step = advanceOnArrival(state, tour);
  assert.equal(step.completed, false);
  assert.equal(step.reached?.name, 'B');
  state = step.state;
  assert.deepEqual(state, { tourId: 't', legIndex: 1, completedStops: [0, 1] });
  assert.equal(nextLeg(state, tour)?.to.name, 'C');

  step = advanceOnArrival(state, tour);
  assert.equal(step.completed, true);
  assert.equal(isComplete(step.state, tour), true);
  assert.equal(nextLeg(step.state, tour), null);
  assert.equal(tourProgressLabel(step.state, tour), 'Test tour: complete');

  const after = advanceOnArrival(step.state, tour);
  assert.equal(after.completed, false, 'completion fires once');
  assert.equal(after.state, step.state);
});

test('a state for another tour never advances', () => {
  const foreign = { tourId: 'other', legIndex: 0, completedStops: [0] };
  assert.equal(nextLeg(foreign, tour), null);
  assert.equal(advanceOnArrival(foreign, tour).state, foreign);
});

test('leg length and the detour cap', () => {
  assert.ok(Math.abs(legKm([4.89, 52.37], [4.90, 52.37]) - 0.68) < 0.01);
  assert.ok(Math.abs(legKm([4.9, 52.37], [4.9, 52.36]) - 1.113) < 0.01);
  assert.equal(withinLegCap({ km: MAX_TOUR_LEG_KM }), true);
  assert.equal(withinLegCap({ km: MAX_TOUR_LEG_KM + 0.01 }), false);
  assert.equal(tourLegs(tour).length, 2);
  assert.deepEqual(legsOverCap(tour), []);
  const far: Tour = { ...tour, stops: [tour.stops[0], stop('Far', 4.95, 52.37)] };
  assert.equal(legsOverCap(far).length, 1);
});

test('stops become route POIs; landmark stops reuse the extract id', () => {
  assert.deepEqual(stopAsRoutePoi(tour, 0), { id: 'lm-lm1', name: 'A', lat: 52.37, lng: 4.89, landmarkId: 'lm1' });
  assert.deepEqual(stopAsRoutePoi(tour, 1), { id: 'tour-t-1', name: 'B', lat: 52.37, lng: 4.90 });
  assert.equal(stopAsRoutePoi(tour, 9), null);
});

test('stop names that answer a street question stay hidden until arrival', () => {
  const data = JSON.parse(readFileSync('public/data/extracts/amsterdam/tours.json', 'utf8')) as { tours: Tour[] };
  const byName = new Map(data.tours.flatMap(t => t.stops.map((s, i) => [s.name, { t, i }] as const)));
  for (const name of ['Golden Bend', 'Jodenbreestraat', 'Magere Brug', 'Albert Cuypmarkt', 'Waterlooplein', 'Noordermarkt', 'Bloemenmarkt', 'Dappermarkt']) {
    const hit = byName.get(name);
    assert.ok(hit, `${name} is a stop`);
    assert.equal(stopNameSpoils(hit.t.stops[hit.i]), true, `${name} is hidden`);
    const dest = tourDestination(hit.t, hit.i)!;
    assert.equal(dest.tourRevealName, name);
    assert.ok(!dest.name.includes(name), `${name} not in "${dest.name}"`);
    assert.match(dest.name, new RegExp(`^${hit.t.title}, stop ${hit.i + 1} of ${hit.t.stops.length}$`));
  }
  for (const name of ['Rijksmuseum', 'Westerkerk', 'Schreierstoren', 'Café Hoppe']) {
    const hit = byName.get(name)!;
    const dest = tourDestination(hit.t, hit.i)!;
    assert.equal(dest.name, name);
    assert.equal(dest.tourRevealName, undefined);
    assert.equal(dest.tourStop, true);
  }
});

test('the arrival card, the checked date and ?tour= links', () => {
  const food: Tour = { ...tour, volatile: true, checkedAt: '2026-10-17' };
  assert.equal(tourCheckedLabel(food), 'checked 2026-10-17');
  assert.equal(tourCheckedLabel(tour), null);
  const arrival = tourArrival(food, 1, false)!;
  assert.deepEqual(
    { name: arrival.name, why: arrival.why, host: arrival.sourceHost, checked: arrival.checked, of: arrival.stopCount },
    { name: 'B', why: 'B.', host: 'example.org', checked: 'checked 2026-10-17', of: 3 },
  );
  assert.equal(tourArrival(tour, 9, false), null);
  assert.equal(tourFromSearch('?tour=t', [tour])?.id, 't');
  assert.equal(tourFromSearch('?tour=nope', [tour]), null);
  assert.equal(tourFromSearch('', [tour]), null);
});

test('a tour rides by bike without saving that as the player\'s settings', () => {
  const mine = { travelMode: 'boat', cityId: 'amsterdam', routePattern: 'home', difficulty: 'hard' };
  const { patch, restore } = tourPrefsOverride(mine);
  assert.deepEqual(patch, { travelMode: 'car', routePattern: 'surprise' });
  assert.deepEqual(restore, { travelMode: 'boat', routePattern: 'home' });
  // Saved mid-tour: the player's own mode and route, plus any other change.
  const riding = { ...mine, ...patch, difficulty: 'expert' };
  assert.deepEqual(persistablePrefs(riding, restore), { travelMode: 'boat', cityId: 'amsterdam', routePattern: 'home', difficulty: 'expert' });
  assert.equal(persistablePrefs(riding, null), riding);
  // A second tour keeps the first snapshot, not the first tour's overrides.
  const again = tourPrefsOverride(riding, restore);
  assert.deepEqual(again.patch, {});
  assert.deepEqual(again.restore, restore);
  // Already on a bike in Amsterdam on Surprise: nothing to change or undo.
  assert.deepEqual(tourPrefsOverride({ travelMode: 'car', cityId: 'amsterdam', routePattern: 'surprise' }), { patch: {}, restore: {} });
});

test('a tour with a start rides a lead-in to stop 1 first, so stop 1 is reached, not given', () => {
  const start = { name: 'Amsterdam Centraal', lngLat: [4.9003, 52.3791] as [number, number] };
  let state = startTour(tour, start);
  assert.deepEqual(state.completedStops, []);
  assert.equal(tourProgressLabel(state, tour), 'Test tour: stop 1 of 3');
  const lead = nextLeg(state, tour)!;
  assert.equal(lead.fromIndex, -1);
  assert.equal(lead.from.name, 'Amsterdam Centraal');
  assert.equal(lead.to.name, 'A');
  let step = advanceOnArrival(state, tour);
  state = step.state;
  assert.deepEqual(state.completedStops, [0]);
  assert.equal(step.reached!.name, 'A');
  assert.equal(nextLeg(state, tour)!.to.name, 'B');
  step = advanceOnArrival(state, tour);
  step = advanceOnArrival(step.state, tour);
  assert.equal(step.completed, true);
  assert.deepEqual(step.state.start, start);
});

test('chooseTourStart: the rider when a real ride away, else Centraal, else the nearest far-enough hub', () => {
  const here: [number, number] = [4.875, 52.37];
  assert.deepEqual(chooseTourStart(tour, here), { name: 'Here', lngLat: here, private: true });
  assert.equal(chooseTourStart(tour, [4.8901, 52.3701])!.name, 'Amsterdam Centraal');
  assert.equal(chooseTourStart(tour, [5.2, 52.1])!.name, 'Amsterdam Centraal');
  const atCentraal: Tour = { ...tour, stops: [stop('CS', 4.9003, 52.3790), ...tour.stops] };
  const s = chooseTourStart(atCentraal)!;
  assert.notEqual(s.name, 'Amsterdam Centraal');
  assert.ok(legKm(s.lngLat, atCentraal.stops[0].lngLat) >= 0.5);
  assert.equal(chooseTourStart({ ...tour, stops: [] }), null);
  assert.equal(TOUR_HUBS[0].name, 'Amsterdam Centraal');
});

test('every published tour gets a lead-in start between 0.5 and 4 km from its first stop', () => {
  const tours = JSON.parse(readFileSync('public/data/extracts/amsterdam/tours.json', 'utf8'));
  const list: Tour[] = Array.isArray(tours) ? tours : tours.tours;
  for (const t of list) {
    const s = chooseTourStart(t)!;
    const km = legKm(s.lngLat, t.stops[0].lngLat);
    assert.ok(km >= 0.5 && km <= 4, `${t.id}: ${s.name} ${km.toFixed(2)} km`);
  }
});
