import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingRouteDistance, routeSuffixLengths } from './routeRemaining';

// An L-shaped route: 300 east, then 400 north. The crow says 500; the ride is 700.
const path = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }];
const finish = { x: 300, y: 400 };

test('at the start the readout is the route length, not the straight line (R2-10)', () => {
  const { distance } = remainingRouteDistance(path, { x: 0, y: 0 }, finish);
  assert.equal(distance, 700);
});

test('part way, the rest of the route; off the line, the offset is added', () => {
  assert.equal(remainingRouteDistance(path, { x: 300, y: 100 }, finish).distance, 300);
  assert.equal(remainingRouteDistance(path, { x: 150, y: 20 }, finish).distance, 20 + 150 + 400);
});

test('no path, the straight line as before; never shorter than the straight line', () => {
  assert.equal(remainingRouteDistance(null, { x: 0, y: 0 }, finish).distance, 500);
  assert.equal(remainingRouteDistance([{ x: 0, y: 0 }], { x: 0, y: 0 }, finish).distance, 500);
  // A path whose end stops short of the finish: the gap counts.
  assert.equal(remainingRouteDistance([{ x: 0, y: 0 }, { x: 300, y: 0 }], { x: 0, y: 0 }, finish).distance, 700);
});

test('the suffix sums are cached per path', () => {
  assert.deepEqual([...routeSuffixLengths(path)], [700, 400, 0]);
  const first = remainingRouteDistance(path, { x: 0, y: 0 }, finish);
  const again = remainingRouteDistance(path, { x: 300, y: 0 }, finish, first.cache);
  assert.equal(again.cache, first.cache);
  assert.equal(again.distance, 400);
});
