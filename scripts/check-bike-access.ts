import assert from 'node:assert/strict';
import { CAR_ROUTING_HIGHWAYS, isBikeRoutingHighway } from '../src/canalRecall/routing/bikeAccess.ts';

assert.equal(isBikeRoutingHighway({ highway: 'residential' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'service' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'cycleway' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'cycleway', bicycle: 'no' }), false);

// Zeedijk: pedestrian with explicit bicycle=yes.
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian', bicycle: 'yes' }), true);
// Untagged pedestrian streets are bikeable in Amsterdam unless denied.
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian' }), true);
// Kalverstraat: pedestrian with bicycle=no.
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian', bicycle: 'no' }), false);
assert.equal(isBikeRoutingHighway({ highway: 'pedestrian', bicycle: 'dismount' }), false);

// Sidewalks need an explicit bicycle tag.
assert.equal(isBikeRoutingHighway({ highway: 'footway' }), false);
assert.equal(isBikeRoutingHighway({ highway: 'footway', bicycle: 'yes' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'path', bicycle: 'designated' }), true);
assert.equal(isBikeRoutingHighway({ highway: 'path' }), false);

assert.ok(CAR_ROUTING_HIGHWAYS.has('busway'));
assert.equal(isBikeRoutingHighway({}), false);

process.stdout.write('Bike access checks passed.\n');
