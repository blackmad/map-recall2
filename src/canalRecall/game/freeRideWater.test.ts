import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeMarkerAnchor, deckPoints } from './freeRideWater.ts';

// A canal running east-west between y = -30 and y = 30 (world px); a bridge way crossing it north-south.
const canal = (x: number, y: number) => Math.abs(y) < 30;
const bridge = [[{ x: 0, y: -45 }, { x: 0, y: 0 }, { x: 0, y: 45 }]];
const crossing = { x: 0, y: 0 };

test('a bridge marker stands on the quay at the end nearer the rider, never mid-canal', () => {
  assert.deepEqual(bridgeMarkerAnchor(bridge, crossing, { x: 10, y: 200 }, canal), { x: 0, y: 45 });
  assert.deepEqual(bridgeMarkerAnchor(bridge, crossing, { x: 10, y: -200 }, canal), { x: 0, y: -45 });
});

test('a bridge way mapped short of the quay finds land past its end', () => {
  const short = [[{ x: 0, y: -27 }, { x: 0, y: 27 }]];
  const anchor = bridgeMarkerAnchor(short, crossing, { x: 0, y: 200 }, canal)!;
  assert.ok(anchor && !canal(anchor.x, anchor.y) && anchor.y > 0, JSON.stringify(anchor));
});

test('a bridge with no deck point on land gets no marker; without a water test the crossing is kept', () => {
  const allWater = () => true;
  assert.equal(bridgeMarkerAnchor(bridge, crossing, { x: 0, y: 200 }, allWater), null);
  assert.deepEqual(bridgeMarkerAnchor(bridge, crossing, { x: 0, y: 200 }, null), crossing);
});

test('deck points ignore other spans of the same bridge far from this crossing', () => {
  const far = [[{ x: 5000, y: 0 }, { x: 5000, y: 50 }]];
  assert.deepEqual(deckPoints(far, crossing), []);
});

test('a landmark point in the canal moves to the nearest quay; on land it stays', async () => {
  const { landAnchor } = await import('./freeRideWater.ts');
  assert.deepEqual(landAnchor({ x: 5, y: 40 }, canal), { x: 5, y: 40 });
  const moved = landAnchor({ x: 0, y: 24 }, canal)!;
  assert.ok(moved && !canal(moved.x, moved.y) && moved.y >= 30 && moved.y < 40, JSON.stringify(moved));
  assert.equal(landAnchor({ x: 0, y: 0 }, () => true), null);
  assert.deepEqual(landAnchor({ x: 0, y: 0 }, null), { x: 0, y: 0 });
});

test('a tap is on open water only when nothing stands over the water point', async () => {
  const { tapOnOpenWater } = await import('./freeRideWater.ts');
  assert.equal(tapOnOpenWater(null, true), true);
  assert.equal(tapOnOpenWater({ id: 'facade' }, true), false);
  assert.equal(tapOnOpenWater(null, false), false);
});

test('a boat names its canal only from a tap on the water; a bike names a street only off it', async () => {
  const { freeRideWayTapAllowed } = await import('./freeRideWater.ts');
  assert.equal(freeRideWayTapAllowed(true, true), true);
  assert.equal(freeRideWayTapAllowed(false, true), false, 'a quay tap does not name the canal beside it');
  assert.equal(freeRideWayTapAllowed(true, false), false, 'a water tap does not name the quay street');
  assert.equal(freeRideWayTapAllowed(false, false), true);
});
