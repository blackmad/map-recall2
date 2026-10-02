import assert from 'node:assert/strict';
import { START_HEADING_LOOKAHEAD_PX, startHeading } from '../src/canalRecall/game/routeSelection';

const start = { x: 0, y: 0 };
const east = { x: 1, y: 0 };
const route = (...points: Array<[number, number]>) => points.map(([x, y]) => ({ x, y }));
const same = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-9;

// The route heads east: a road angle of east is kept, west is turned around.
const eastward = route([40, 0], [100, 0], [200, 0], [400, 0]);
assert.ok(same(startHeading(0, start, eastward, east), 0), 'already facing the route');
assert.ok(same(startHeading(Math.PI, start, eastward, east), 0), 'a road angle pointing away is turned around');
// Screen-style y-down: a route going down-screen (+y) from a road drawn the other way.
assert.ok(same(startHeading(-Math.PI / 2, start, route([0, 80], [0, 300]), { x: 0, y: 900 }), Math.PI / 2));
// It looks a lookahead out, so a first nudge the wrong way does not decide it.
const wiggle = route([-10, 0], [60, 0], [300, 0]);
assert.ok(START_HEADING_LOOKAHEAD_PX > 70);
assert.ok(same(startHeading(Math.PI, start, wiggle, east), 0));
// No route yet: toward the finish; neither: the road's own angle.
assert.ok(same(startHeading(Math.PI, start, null, { x: 500, y: 0 }), 0));
assert.equal(startHeading(2.2, start, [], null), 2.2);
// A route that ends close to the start still gives a direction through the finish.
assert.ok(same(startHeading(Math.PI, start, route([5, 0]), { x: 300, y: 0 }), 0));
// Square across the road, or the target right on the start: leave the road's angle.
assert.equal(startHeading(0, start, route([0, 400]), null), 0);
assert.equal(startHeading(1, start, route([3, 3]), { x: 4, y: 4 }), 1);
console.log('Start heading checks passed.');
