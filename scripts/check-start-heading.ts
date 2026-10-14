import assert from 'node:assert/strict';
import { START_HEADING_LOOKAHEADS_PX, firstLegBearing, routeAheadOfStart, startHeading } from '../src/canalRecall/game/routeSelection';

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
// Square across the road (a start at a junction, or a canal start whose route turns off at once):
// face the leg itself, not either end of the axis under the vehicle (2026-10-14).
assert.ok(same(startHeading(0, start, route([0, 400]), null), Math.PI / 2), 'faces a leg square to the road');
// The target right on the start gives no direction: leave the road's angle.
assert.equal(startHeading(1, start, route([3, 3]), { x: 4, y: 4 }), 1);
// Within 30 degrees the road's own direction is kept (the corridor the vehicle sits in)...
assert.ok(same(startHeading(0, start, route([100, 50]), null), 0), '27 degrees off the road snaps to it');
// ...beyond it the leg is faced.
assert.ok(same(startHeading(0, start, route([100, 70]), null), Math.atan2(70, 100)), '35 degrees off the road faces the leg');
// A route that turns 90 degrees at the first junction: the near lookahead still says east,
// even though the far ones look south. (Seed 1234abcd of start-heading.spec.ts.)
const turning = route([30, 0], [70, 0], [80, 5], [85, 60], [85, 200], [85, 500]);
assert.ok(same(startHeading(Math.PI, start, turning, { x: 85, y: 900 }), 0), 'the clearest lookahead decides');
assert.ok(same(startHeading(0, start, turning, { x: 85, y: 900 }), 0));
// A route leaving almost sideways to the road faces the leg, not the road's arbitrary direction.
const sideways = route([-3, 100], [-6, 300]);
assert.ok(same(startHeading(0, start, sideways, null), Math.atan2(100, -3)), 'a sideways leg is faced');
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
// The route begins at the graph node the start snapped to, which can lie behind the spawn: the
// leg is read from the start's projection on the route, not from that node (2026-10-14 user
// report, boat at the Hugo de Grootgracht facing away from a route that ran east).
// Boat seed 2468ace0: first vertex 75 px north, then the route runs south past the spawn.
const behindBoat = route([5, -75], [-24, 392], [-26, 423], [-28, 465], [-52, 906]);
assert.ok(same(startHeading(deg(274), start, behindBoat, null), deg(94)), 'boat faces the route, not the snapped node behind it');
assert.ok(same(startHeading(deg(94), start, behindBoat, null), deg(94)));
// Bike seed 1234abcd: first vertex 59 px north, then south past the spawn and west.
const behindBike = route([0, -59], [-1, 70], [-64, 70], [-162, 104]);
assert.ok(same(startHeading(deg(270), start, behindBike, null), deg(90)), 'bike faces the route, not the snapped node behind it');
const ahead = routeAheadOfStart(behindBike, start);
assert.ok(Math.hypot(ahead[0].x, ahead[0].y) < 1 && ahead[1].y === 70, 'the route ahead starts at the projection');
// A doubled-back first leg: from the spawn back 75 px to a node, then forward past the spawn.
const doubledBack = route([0, 0], [-75, 0], [0, 0.5], [300, 1], [600, 0]);
assert.ok(same(startHeading(Math.PI, start, doubledBack, null), 0), 'a doubled-back leg faces where the route goes on');
// A route that loops back past the start much later does not count as its start.
const loop = route([100, 0], [400, 0], [400, 400], [0, 400], [-2, 2], [-2, -300]);
assert.ok(same(firstLegBearing(start, loop, null)!, 0), 'a far later pass is ignored');
assert.equal(firstLegBearing(start, [], null), null);
console.log('Start heading checks passed.');
