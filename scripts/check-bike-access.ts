/**
 * Named pins for bikeable highway selection.
 */
import assert from 'node:assert/strict';
import {
  CAR_ROUTING_HIGHWAYS,
  bicycleRestrictionNotice,
  isBicycleRestricted,
  isBikeRoutingHighway,
} from '../src/canalRecall/routing/bikeAccess.ts';

assert.equal(isBikeRoutingHighway({ highway: 'residential' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'service' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'cycleway' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'cycleway', bicycle: 'no' }), false);

// Zeedijk: pedestrian with explicit bicycle=yes.
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian', bicycle: 'yes' }), true);
assert.equal(isBicycleRestricted({ highway: 'pedestrian', bicycle: 'yes' }), false);
// Untagged pedestrian streets are bikeable in Amsterdam.
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian' }), true);
// Kalverstraat: pedestrian with bicycle=no — still playable, flagged restricted.
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian', bicycle: 'no' }), true);
assert.equal(isBicycleRestricted({ highway: 'pedestrian', bicycle: 'no' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian', bicycle: 'dismount' }), true);
assert.equal(isBicycleRestricted({ highway: 'pedestrian', bicycle: 'dismount' }), true);

assert.equal(bicycleRestrictionNotice({ bicycle: 'no' }), 'No cycling in real life');
assert.equal(bicycleRestrictionNotice({ bicycleRestricted: 'yes' }), 'No cycling in real life');
assert.equal(bicycleRestrictionNotice({ bicycle: 'dismount' }), 'Walk bikes in real life');
assert.equal(bicycleRestrictionNotice({ bicycle: 'private' }), 'Private — no public cycling');
assert.equal(bicycleRestrictionNotice({ bicycle: 'yes' }), null);
assert.equal(bicycleRestrictionNotice({}), null);

// Sidewalks need an explicit bicycle tag.
assert.equal(isBikeRoutingHighway({ highway: 'footway' }), false);
assert.equal(isBikeRoutingHighway({ highway: 'footway', bicycle: 'yes' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'path', bicycle: 'designated' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'path' }), false);

assert.ok(CAR_ROUTING_HIGHWAYS.has('primary'));
assert.equal(isBikeRoutingHighway({}), false);

console.log('bike-access checks passed');
