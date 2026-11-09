import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRideablePathAdmission } from './bikeAccess.ts';
import { classifyDeadEnd, deadEndNodes, type LatLon, type OsmWay } from './deadEnds.ts';
import { admitRideableWays, type RoutingFeatureOut } from './rideablePaths.ts';

test('the rideable allowlist: footway/path with bikes allowed, nothing else', () => {
  assert.ok(isRideablePathAdmission({ highway: 'footway', bicycle: 'yes' }));
  assert.ok(isRideablePathAdmission({ highway: 'path', bicycle: 'designated' }));
  assert.ok(!isRideablePathAdmission({ highway: 'footway' }), 'no bicycle tag: a sidewalk');
  assert.ok(!isRideablePathAdmission({ highway: 'footway', bicycle: 'no' }));
  assert.ok(!isRideablePathAdmission({ highway: 'steps', bicycle: 'yes' }), 'steps never');
  assert.ok(!isRideablePathAdmission({ highway: 'footway', bicycle: 'yes', area: 'yes' }));
  assert.ok(!isRideablePathAdmission({ highway: 'footway', bicycle: 'yes', indoor: 'yes' }));
  assert.ok(!isRideablePathAdmission({ highway: 'footway', bicycle: 'yes', level: '1' }));
  assert.ok(!isRideablePathAdmission({ highway: 'cycleway', bicycle: 'yes' }), 'cycleways are admitted elsewhere');
});

const way = (id: string, tags: Record<string, string>, line: LatLon[]): OsmWay => ({ id, tags, line });

test('dead ends are classed by the dropped ways that meet them, rideable first', () => {
  const end: LatLon[] = [[52.36, 4.94], [52.36, 4.9401]];
  assert.equal(classifyDeadEnd([way('w1', { highway: 'steps' }, end), way('w2', { highway: 'footway', bicycle: 'yes' }, end)]).klass, 'rideable');
  assert.equal(classifyDeadEnd([way('w1', { highway: 'steps' }, end), way('w3', { highway: 'footway' }, end)]).klass, 'steps');
  assert.equal(classifyDeadEnd([way('w4', { highway: 'service', service: 'parking_aisle' }, end)]).klass, 'service-aisle');
  assert.equal(classifyDeadEnd([way('w5', { highway: 'service', access: 'private' }, end)]).klass, 'other-highway');
  assert.equal(classifyDeadEnd([]).klass, 'none');
});

// A street running east, a cul-de-sac stub north off it, and OSM's bike path
// from the stub's end on to a second street: admitting the path removes the
// dead end. A second bike path that leads only to a foot-only path is pruned.
const street = (id: string, path: LatLon[]): RoutingFeatureOut => ({
  id, name: '', type: 'street', cityId: 'amsterdam', center: path[0], highway: 'residential', path,
});
const A: LatLon = [52.36, 4.94], B: LatLon = [52.36, 4.9420];
const stubEnd: LatLon = [52.3610, 4.9410];
const far: LatLon = [52.3630, 4.9410];
const routing = [
  street('routing_0', [A, [52.36, 4.9410], B]),
  street('routing_1', [[52.36, 4.9410], stubEnd]),
  street('routing_2', [[52.3630, 4.9400], far, [52.3630, 4.9420]]),
];

test('admitting a rideable path joins a cul-de-sac to the next street', () => {
  const before = deadEndNodes(routing).length;
  const result = admitRideableWays(routing, [
    way('w10', { highway: 'footway', bicycle: 'yes' }, [stubEnd, [52.3620, 4.9410], far]),
    way('w11', { highway: 'footway', bicycle: 'yes' }, [[52.36, 4.9400], [52.3590, 4.9400]]),
    way('w12', { highway: 'footway' }, [[52.3590, 4.9400], [52.3580, 4.9400]]),
    way('w13', { highway: 'footway', bicycle: 'yes' }, [[52.3700, 4.9500], [52.3710, 4.9500]]),
  ]);
  assert.deepEqual(result.added.map((entry) => entry.osm), ['w10'], 'w11 is a stub to a foot-only path; w13 is not connected');
  assert.equal(result.pruned, 1);
  assert.equal(result.unconnected.rideable, 1);
  assert.equal(result.added[0].id, 'routing_3', 'ids continue the compact numbering');
  assert.ok(deadEndNodes(result.features).length < before, `${deadEndNodes(result.features).length} < ${before}`);
  // routing_2 passes `far` between its vertices only in OSM terms: the junction
  // is already a vertex there, so nothing is spliced.
  assert.equal(result.splices, 0);
});

test('a junction the published way simplified away is spliced back in', () => {
  const top: LatLon[] = [[52.3620, 4.9400], [52.3620, 4.9410], [52.3620, 4.9420]];
  const simplified = [street('routing_0', [A, B]), street('routing_1', top)];
  const mid: LatLon = [52.36, 4.9410];
  const result = admitRideableWays(simplified, [
    way('w20', { highway: 'residential' }, [A, mid, B]),
    way('w21', { highway: 'path', bicycle: 'yes' }, [mid, [52.3610, 4.9410], [52.3620, 4.9410]]),
    way('w22', { highway: 'residential' }, top),
  ]);
  assert.equal(result.splices, 1);
  assert.deepEqual(result.features[0].path, [A, mid, B]);
});
