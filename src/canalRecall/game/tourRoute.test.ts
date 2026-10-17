// node --import tsx --test src/canalRecall/game/tourRoute.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TOUR_LEG_KM,
  advanceOnArrival,
  isComplete,
  legKm,
  legsOverCap,
  nextLeg,
  startTour,
  stopAsRoutePoi,
  tourLegs,
  tourProgressLabel,
  withinLegCap,
  type Tour,
} from './tourRoute.ts';

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
