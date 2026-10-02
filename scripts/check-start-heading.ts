import assert from 'node:assert/strict';
import { START_HEADING_LOOKAHEADS_PX, startHeading } from '../src/canalRecall/game/routeSelection';

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
assert.ok(START_HEADING_LOOKAHEADS_PX.every(l => l > 20));
assert.ok(same(startHeading(Math.PI, start, wiggle, east), 0));
// No route yet: toward the finish; neither: the road's own angle.
assert.ok(same(startHeading(Math.PI, start, null, { x: 500, y: 0 }), 0));
assert.equal(startHeading(2.2, start, [], null), 2.2);
// A route that ends close to the start still gives a direction through the finish.
assert.ok(same(startHeading(Math.PI, start, route([5, 0]), { x: 300, y: 0 }), 0));
// Square across the road, or the target right on the start: leave the road's angle.
assert.equal(startHeading(0, start, route([0, 400]), null), 0);
assert.equal(startHeading(1, start, route([3, 3]), { x: 4, y: 4 }), 1);
// A route that turns 90 degrees at the first junction: the near lookahead still says east,
// even though the far ones look south. (Seed 1234abcd of start-heading.spec.ts.)
const turning = route([30, 0], [70, 0], [80, 5], [85, 60], [85, 200], [85, 500]);
assert.ok(same(startHeading(Math.PI, start, turning, { x: 85, y: 900 }), 0), 'the clearest lookahead decides');
assert.ok(same(startHeading(0, start, turning, { x: 85, y: 900 }), 0));
// A route leaving almost sideways to the road (seed 1234abcd: signal about -0.15) still picks the
// slightly better direction rather than the arbitrary one.
const sideways = route([-3, 100], [-6, 300]);
assert.ok(same(startHeading(0, start, sideways, null), Math.PI), 'a weak signal still decides');
// Real routes from start-heading.spec.ts (positions relative to the start, y down).
const deg = (d: number) => (d * Math.PI) / 180;
// Seed 5eed1234: the first leg runs north about 56 px, then bends west toward a far destination.
const northThenWest = route([5, -39], [-13, -56], [-13, -56], [-38, -31], [-49, -13], [-97, -13], [-140, -9], [-210, 55], [-278, 13], [-513, -209], [-6632, -5634]);
assert.ok(same(startHeading(deg(97), start, northThenWest, { x: -6632, y: -5634 }), deg(277)), 'faces north, where the route begins');
assert.ok(same(startHeading(deg(277), start, northThenWest, { x: -6632, y: -5634 }), deg(277)));
// Seed 1234abcd: the first leg runs south about 35 px, then curves east; the road is diagonal.
// A far lookahead (east) must not outvote the first leg.
const southThenEast = route([4, -6], [-14, 23], [-13, 34], [128, 112], [136, 135], [172, 189], [209, 278], [630, 230], [996, 752], [1064, 771]);
assert.ok(same(startHeading(deg(-57), start, southThenEast, { x: 1064, y: 771 }), deg(123)), 'faces down-left, along the first leg');
assert.ok(same(startHeading(deg(123), start, southThenEast, { x: 1064, y: 771 }), deg(123)));
console.log('Start heading checks passed.');
