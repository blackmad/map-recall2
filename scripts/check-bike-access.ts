/**
 * Named pins for bikeable highway selection.
 */
import assert from 'node:assert/strict';
import {
  CAR_ROUTING_HIGHWAYS,
  bicycleRestrictionNotice,
  isBicycleRestricted,
  isBikeRoutingHighway,
  isMotorOnlyHighway,
  motorOnlyNames,
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

// The IJ-tunnel (trunk) routed a ride under the IJ into its portal building
// (user report 2026-09-28). Motorways and trunk autowegen are closed to bikes.
for (const highway of ['motorway', 'motorway_link', 'trunk', 'trunk_link']) {
  assert.equal(isMotorOnlyHighway(highway), true, highway);
  assert.equal(isBikeRoutingHighway({ highway }), false, `${highway} is not in the cycling graph`);
}
assert.equal(isMotorOnlyHighway('primary'), false);
assert.equal(isMotorOnlyHighway(undefined), false);
assert.equal(isBikeRoutingHighway({ highway: 'primary' }), true, 'Wibautstraat-class roads stay');

// The IJ-tunnel's approach ramps are `primary`; the name goes as a whole.
const tunnelNames = motorOnlyNames([
  { name: 'IJ-tunnel', highway: 'trunk', path: [[52.3736, 4.9123], [52.3838, 4.9109]] },
  { name: 'IJ-tunnel', highway: 'primary', path: [[52.3704, 4.9092], [52.3708, 4.9099]] },
  { name: 'IJburglaan', highway: 'trunk', path: [[52.35, 4.99], [52.351, 4.99]] },
  { name: 'IJburglaan', highway: 'cycleway', path: [[52.35, 4.99], [52.354, 4.99]] },
]);
assert.deepEqual([...tunnelNames], ['IJ-tunnel'], 'a mostly-cycleable name keeps its cycle track');
