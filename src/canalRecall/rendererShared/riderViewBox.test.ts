import test from 'node:test';
import assert from 'node:assert/strict';
import { metresBetween, radiusCentre, riderViewBox } from './riderViewBox';

// Feedback 4d7706de (2026-11-13): the Kwakersstraat bridge, rider and its 22 m-led chase view centre.
const RIDER: [number, number] = [4.869391, 52.368522];

test('the radius is drawn round the rider, not the view centre', () => {
  assert.deepEqual(radiusCentre(RIDER, { lng: 4.869086, lat: 52.368465 }), RIDER);
  assert.deepEqual(radiusCentre(null, { lng: 4.869086, lat: 52.368465 }), [4.869086, 52.368465]);
  assert.deepEqual(radiusCentre([NaN, 52], { lng: 1, lat: 2 }), [1, 2]);
});

test('box: 220 m round the centre, clipped to the view bounds', () => {
  const box = riderViewBox(null, RIDER, 220)!;
  assert.ok(Math.abs(metresBetween([box.west, RIDER[1]], RIDER) - 220) < 0.5);
  assert.ok(Math.abs(metresBetween([RIDER[0], box.north], RIDER) - 220) < 0.5);
  const clipped = riderViewBox({ west: 4.8690, east: 4.8800, south: 52.3680, north: 52.3720 }, RIDER, 220)!;
  assert.equal(clipped.west, 4.8690);
  assert.ok(clipped.east < 4.8800 && clipped.north < 52.3720 && clipped.south === 52.3680);
});

test('a centre 300 m ahead of the rider used to drop the bins beside it; the rider box keeps them', () => {
  const bins: [number, number] = [4.86904, 52.36847]; // afval-111577, 25 m from the rider
  const ahead: [number, number] = [RIDER[0] - 300 / (111_320 * Math.cos(RIDER[1] * Math.PI / 180)), RIDER[1]];
  const inside = (b: { west: number; east: number; south: number; north: number } | null, p: [number, number]) => !!b && p[0] >= b.west && p[0] <= b.east && p[1] >= b.south && p[1] <= b.north;
  assert.equal(inside(riderViewBox(null, ahead, 220), bins), false);
  assert.equal(inside(riderViewBox(null, RIDER, 220), bins), true);
});

test('bounds that miss the radius: null, not an inverted box', () => {
  assert.equal(riderViewBox({ west: 5, east: 5.1, south: 52, north: 52.1 }, RIDER, 220), null);
});
