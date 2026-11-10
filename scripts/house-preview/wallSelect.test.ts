import test from 'node:test';
import assert from 'node:assert/strict';
import { pickWall, edgeNormal, openRing, type LngLat } from './wallSelect.ts';

// A 10 m x 6 m rectangle near Amsterdam, counter-clockwise in lng/lat (east, then north, then west, then south).
const [lng0, lat0] = [4.9, 52.37];
const dLng = 10 / (111_320 * Math.cos(52.37 * Math.PI / 180)), dLat = 6 / 110_540;
const CCW: LngLat[] = [[lng0, lat0], [lng0 + dLng, lat0], [lng0 + dLng, lat0 + dLat], [lng0, lat0 + dLat], [lng0, lat0]];
const CW: LngLat[] = [...CCW].reverse();

test('openRing drops the closing point only', () => {
  assert.equal(openRing(CCW).length, 4);
  assert.equal(openRing(openRing(CCW)).length, 4);
});

test('edge index follows the ring: edge 0 runs east along the south side, its outward normal points south (180 deg)', () => {
  const p = pickWall(CCW, '0');
  assert.deepEqual(p.a, CCW[0]);
  assert.deepEqual(p.b, CCW[1]);
  assert.ok(Math.abs(p.lengthM - 10) < 0.05, `length ${p.lengthM}`);
  assert.ok(Math.abs(p.bearingDeg - 180) < 0.5, `bearing ${p.bearingDeg}`);
});

test('a clockwise ring has its outward normals flipped, so the same edge faces north', () => {
  // The south side of the CW ring is the reversed north side of the CCW ring: its normal points south too.
  const bearings = [0, 1, 2, 3].map(i => Math.round(edgeNormal(openRing(CW), i).bearingDeg));
  assert.deepEqual([...bearings].sort((a, b) => a - b), [0, 90, 180, 270], `outward bearings ${bearings}`);
});

test('a bearing picks the edge whose outward normal is nearest', () => {
  for (const [spec, want] of [['0deg', 'north'], ['90deg', 'east'], ['180deg', 'south'], ['270deg', 'west']] as const) {
    const p = pickWall(CCW, spec);
    const b = edgeNormal(openRing(CCW), p.edge).bearingDeg;
    const expect = { north: 0, east: 90, south: 180, west: 270 }[want];
    assert.ok(Math.min(Math.abs(b - expect), 360 - Math.abs(b - expect)) < 0.5, `${spec} picked edge ${p.edge} bearing ${b}`);
  }
});

test('bad specs are refused with the reason', () => {
  assert.throws(() => pickWall(CCW, '9'), /0 to 3/);
  assert.throws(() => pickWall(CCW, 'north'), /edge index or a bearing/);
});
