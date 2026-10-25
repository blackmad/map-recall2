import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freeRideTallyKey,
  freeRideTravelMode,
  isFreeRidePattern,
  layoutMarkers,
  markerAt,
  markerLabel,
  MARKER_STEM,
  nearbyPlaces,
  nearestPoint,
  tapNamesWay,
  type FreeRidePlace,
} from './freeRide.ts';
import { parseMode, ROUTE_PATTERNS } from './modes.ts';

const place = (key: string, name: string, x: number, y: number, kind: FreeRidePlace['kind'] = 'landmark'): FreeRidePlace =>
  ({ key, name, x, y, kind });

test('free is a route pattern a saved preference may hold', () => {
  assert.equal(parseMode(ROUTE_PATTERNS, 'free', 'surprise'), 'free');
  assert.ok(isFreeRidePattern('free'));
  assert.ok(!isFreeRidePattern('surprise'));
  assert.ok(!isFreeRidePattern(undefined));
});

test('free ride rides the bike when transit was picked, and keeps bike and boat', () => {
  assert.equal(freeRideTravelMode('transit'), 'car');
  assert.equal(freeRideTravelMode('car'), 'car');
  assert.equal(freeRideTravelMode('boat'), 'boat');
});

test('nearby places: nearest first, inside the radius, one marker per name', () => {
  const rider = { x: 0, y: 0 };
  const picked = nearbyPlaces(rider, [
    place('far', 'Far away', 2000, 0),
    place('b', 'Westerkerk', 300, 0),
    place('a', 'Anne Frank Huis', 100, 0),
    place('a2', 'anne frank huis', 120, 0),
    place('nameless', '', 10, 0),
  ], { radiusPx: 1000 });
  assert.deepEqual(picked.map(p => p.key), ['a', 'b']);
  assert.equal(picked[0].distance, 100);
});

test('nearby places: bridges have their own radius and cap, landmarks fill the rest', () => {
  const rider = { x: 0, y: 0 };
  const places = [
    place('br1', 'Brug 1', 10, 0, 'bridge'),
    place('br2', 'Brug 2', 20, 0, 'bridge'),
    place('br3', 'Brug 3', 30, 0, 'bridge'),
    place('br-far', 'Brug far', 600, 0, 'bridge'),
    place('l1', 'Landmark 1', 700, 0),
    place('l2', 'Landmark 2', 800, 0),
  ];
  const picked = nearbyPlaces(rider, places, { radiusPx: 1000, bridgeRadiusPx: 400, max: 4, maxBridges: 2 });
  assert.deepEqual(picked.map(p => p.key), ['br1', 'br2', 'l1', 'l2']);
});

test('nearest point picks the crossing nearest the rider', () => {
  assert.deepEqual(nearestPoint({ x: 0, y: 0 }, [{ x: 50, y: 0 }, { x: -5, y: 5 }]), { x: -5, y: 5 });
  assert.equal(nearestPoint({ x: 0, y: 0 }, []), null);
});

test('marker layout keeps labels on screen, off HUD cards and off nearer markers', () => {
  const screen = { width: 800, height: 600 };
  const placed = layoutMarkers([
    { key: 'near', anchorX: 400, anchorY: 300, width: 100, height: 24 },
    { key: 'overlap', anchorX: 420, anchorY: 305, width: 100, height: 24 },
    { key: 'offscreen', anchorX: 10, anchorY: 300, width: 100, height: 24 },
    { key: 'under-card', anchorX: 400, anchorY: 560, width: 100, height: 24 },
    { key: 'clear', anchorX: 650, anchorY: 200, width: 100, height: 24 },
  ], screen, [{ x: 0, y: 500, w: 800, h: 100 }]);
  assert.deepEqual(placed.map(p => p.key), ['near', 'clear']);
  const near = placed[0];
  assert.equal(near.box.y + near.box.h + MARKER_STEM, near.anchorY);
});

test('a tap hits the marker label or its stem', () => {
  const placed = layoutMarkers([{ key: 'm', anchorX: 400, anchorY: 300, width: 100, height: 24 }], { width: 800, height: 600 });
  assert.equal(markerAt(placed, 400, 300 - MARKER_STEM - 12)?.key, 'm');
  assert.equal(markerAt(placed, 400, 299)?.key, 'm');
  assert.equal(markerAt(placed, 600, 300), null);
});

test('marker labels cut long names on a word', () => {
  assert.equal(markerLabel('Westerkerk'), 'Westerkerk');
  const cut = markerLabel('Nationaal Monument op de Dam en het Koninklijk Paleis');
  assert.ok(cut.length <= 26, cut);
  assert.ok(cut.endsWith('…'));
  assert.ok(!cut.includes(' …'));
});

test('the plaque tally says how many places were opened', () => {
  assert.deepEqual(freeRideTallyKey(0), { key: 'freeRide.tallyNone', count: 0 });
  assert.deepEqual(freeRideTallyKey(1), { key: 'freeRide.tallyOne', count: 1 });
  assert.deepEqual(freeRideTallyKey(5), { key: 'freeRide.tallyMany', count: 5 });
});

test('a tap names a way only on or right beside it', () => {
  assert.ok(tapNamesWay({ dist: 10, width: 12 }, 6));
  assert.ok(tapNamesWay({ dist: 16, width: 12 }, 6));
  assert.ok(!tapNamesWay({ dist: 40, width: 12 }, 6));
  assert.ok(!tapNamesWay(null, 6));
  assert.ok(!tapNamesWay({ width: 12 }, 6));
});
