import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRideDistance } from './rideDistance';

test('routed lengths print bare, one decimal under 10 km', () => {
  assert.equal(formatRideDistance(3.14, { routed: true }), '3.1 km');
  assert.equal(formatRideDistance(0.95, { routed: true }), '1.0 km');
  assert.equal(formatRideDistance(0.04, { routed: true }), '0.0 km');
  assert.equal(formatRideDistance(9.94, { routed: true }), '9.9 km');
});
test('from 10 km whole kilometres, rounding before choosing precision', () => {
  assert.equal(formatRideDistance(9.96, { routed: true }), '10 km');
  assert.equal(formatRideDistance(12.4, { routed: true }), '12 km');
  assert.equal(formatRideDistance(12.6, { routed: true }), '13 km');
});
test('estimates get the about word, localisable', () => {
  assert.equal(formatRideDistance(2.1), 'about 2.1 km');
  assert.equal(formatRideDistance(2.1, { aboutWord: 'ongeveer' }), 'ongeveer 2.1 km');
});
test('bad input never prints NaN', () => {
  assert.equal(formatRideDistance(NaN, { routed: true }), '0.0 km');
  assert.equal(formatRideDistance(-3, { routed: true }), '0.0 km');
});
