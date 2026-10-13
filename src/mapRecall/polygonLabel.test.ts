import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {pointInMultiPolygon, polygonLabelPoint, type LatLon, type MultiPolygon} from './polygonLabel';

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);

test('a square labels at its centre', () => {
  // Square in metres: the longitude span is stretched by 1/cos(lat).
  const dLon = 0.01 / Math.cos((52.005 * Math.PI) / 180);
  const square: MultiPolygon = [[[[52, 4], [52, 4 + dLon], [52.01, 4 + dLon], [52.01, 4], [52, 4]]]];
  const point = polygonLabelPoint(square)!;
  near(point[0], 52.005, 2e-5);
  near(point[1], 4 + dLon / 2, 3e-5);
});

test('a U shape labels inside an arm, not in the gap', () => {
  // A U opening north: left arm, right arm, a base along the south.
  const u: MultiPolygon = [[[
    [52.000, 4.000], [52.000, 4.030], [52.030, 4.030], [52.030, 4.020],
    [52.008, 4.020], [52.008, 4.010], [52.030, 4.010], [52.030, 4.000], [52.000, 4.000],
  ]]];
  const point = polygonLabelPoint(u)!;
  assert.ok(pointInMultiPolygon(point, u));
  const inGap = point[1] > 4.010 && point[1] < 4.020 && point[0] > 52.008;
  assert.ok(!inGap, `label ${point} sits in the gap of the U`);
});

test('a ring with a hole labels in the ring, not the hole', () => {
  const ring: MultiPolygon = [[
    [[52, 4], [52, 4.03], [52.02, 4.03], [52.02, 4], [52, 4]],
    [[52.004, 4.006], [52.004, 4.024], [52.016, 4.024], [52.016, 4.006], [52.004, 4.006]],
  ]];
  const point = polygonLabelPoint(ring)!;
  assert.ok(pointInMultiPolygon(point, ring), `label ${point} is not inside the ring`);
  assert.ok(!pointInMultiPolygon(point, [[ring[0][1]]]), 'label is inside the hole');
});

test('the Grachtengordel horseshoe labels inside the belt, away from the Dam', () => {
  const boundaries = JSON.parse(readFileSync(new URL('../../public/data/extracts/amsterdam/boundaries.json', import.meta.url), 'utf8')) as Array<{name: string; geometry: MultiPolygon}>;
  const belt = boundaries.find((area) => area.name === 'Grachtengordel');
  assert.ok(belt, 'Grachtengordel is in boundaries.json');
  const point = polygonLabelPoint(belt.geometry)!;
  assert.ok(pointInMultiPolygon(point, belt.geometry), `label ${point} is outside the Grachtengordel`);

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const polygon of belt.geometry) for (const [lat, lon] of polygon[0]) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
  }
  const bboxCentre: LatLon = [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
  assert.ok(!pointInMultiPolygon(bboxCentre, belt.geometry), 'the bbox centre is in the horseshoe gap (premise)');
  // The gap is the old centre around the Dam: the label must be well clear of it.
  const metres = Math.hypot((point[0] - bboxCentre[0]) * 111_320, (point[1] - bboxCentre[1]) * 111_320 * Math.cos((bboxCentre[0] * Math.PI) / 180));
  assert.ok(metres > 300, `label is only ${Math.round(metres)} m from the bbox centre`);
});
