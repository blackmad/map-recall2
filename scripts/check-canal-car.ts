import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constrainCarToRoad, type CarKinematics, type RoadContact } from '../src/canalRecall/carRoadGuard';

const options = { edgeTolerance: 12 };
const road = (overrides: Partial<RoadContact> = {}): RoadContact => ({
  x: 0, y: 0, dist: 0, width: 30, angle: 0, ...overrides,
});
const car = (overrides: Partial<CarKinematics> = {}): CarKinematics => ({
  x: 0, y: 0, angle: 0, vx: 180, vy: 0, speed: 180, ...overrides,
});

{
  const subject = car({ x: 70, y: 55, vx: 160, vy: 90 });
  const result = constrainCarToRoad(subject, { x: 38, y: 28 }, road({ dist: 55 }), road({ x: 38, y: 0, dist: 28 }), options);
  assert.equal(result, 'rolled-back');
  // The movement across the corridor is discarded; the part along the street
  // is kept (capped), so clipping a kerb grazes it instead of stopping dead.
  assert.deepEqual({ x: subject.x, y: subject.y }, { x: 50, y: 28 });
  assert.equal(subject.vy, 0, 'rollback removes velocity pointing into a canal/block');
  assert.ok(subject.speed < 180, 'rollback sheds speed');
}

{
  const subject = car({ x: 35, y: 0, speed: 100 });
  const result = constrainCarToRoad(subject, { x: 34, y: 0 }, road({ x: 0, dist: 35 }), road({ dist: 34 }), options);
  assert.equal(result, 'soft-edge');
  assert.ok(subject.x < 35, 'the shoulder guard nudges inward before rollback is needed');
}

{
  const subject = car({ x: 3, y: 0, angle: Math.PI / 2, vx: 0, vy: 120 });
  const result = constrainCarToRoad(subject, { x: 2, y: 0 }, road({ dist: 3, angle: Math.PI / 2 }), road({ angle: Math.PI / 2 }), options);
  assert.equal(result, 'on-road', 'a bridge-centre contact remains drivable even above rendered water');
}

{
  const subject = car({ x: 80, y: 80, vx: 100, vy: 50 });
  constrainCarToRoad(subject, { x: 40, y: 40 }, null, null, options);
  assert.deepEqual({ x: subject.x, y: subject.y }, { x: 40, y: 40 });
  assert.deepEqual({ vx: subject.vx, vy: subject.vy }, { vx: 50, vy: 25 });
}

{
  const subject = car({ x: 50, y: 50, angle: 0, vx: 120, vy: 30 });
  constrainCarToRoad(subject, { x: 30, y: 30 }, road({ dist: 60, angle: Math.PI / 2 }), road({ angle: Math.PI / 2 }), options);
  assert.ok(subject.angle > 0, 'recovery begins aligning toward a sharp new street heading');
  assert.ok(Math.abs(subject.vx) < 0.001, 'recovery projects velocity onto the street tangent');
}

type RoutingStreet = {
  name: string;
  highway?: string;
  bridge?: boolean;
  path?: [number, number][];
  paths?: [number, number][][];
};
const routing = JSON.parse(await readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as RoutingStreet[];
const pointsFor = (name: string): [number, number][] => routing
  .filter(street => street.name === name)
  .flatMap(street => street.paths ?? (street.path ? [street.path] : []))
  .flat();
const metersBetween = (a: [number, number], b: [number, number]): number => {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * latitudeScale, (a[1] - b[1]) * longitudeScale);
};
const daCosta = pointsFor('Da Costakade');
assert.ok(daCosta.length > 0, 'full routing data includes Da Costakade');
for (const crossing of ['De Clercqstraat', 'Potgieterstraat', 'Kinkerstraat', 'Jacob van Lennepstraat']) {
  const crossingPoints = pointsFor(crossing);
  assert.ok(crossingPoints.length > 0, `full routing data includes ${crossing}`);
  const closest = Math.min(...crossingPoints.flatMap(a => daCosta.map(b => metersBetween(a, b))));
  // Quay centerlines stop at the bridge footprint rather than meeting its
  // centerline; their combined rendered half-widths span roughly 20 metres.
  assert.ok(closest < 22, `${crossing} has a continuous bridge approach at Da Costakade (closest ${closest.toFixed(1)}m)`);
}
const bridgeSegments = routing.filter(street => street.bridge);
assert.ok(bridgeSegments.length >= 10, `routing extract retains the city's drivable bridge segments (found ${bridgeSegments.length})`);
for (const bridgeName of ['De Clercqstraat', 'Rozengracht']) {
  const bridge = routing.find(street => street.name === bridgeName && street.bridge);
  assert.ok(bridge, `vehicle bridge segment ${bridgeName} is part of the routing extract`);
}
assert.ok(routing.some(street => !street.name), 'routing extract retains unnamed road connectors');
for (const highway of ['primary', 'secondary', 'tertiary', 'residential', 'living_street']) {
  assert.ok(routing.some(street => street.highway === highway), `routing extract retains ${highway} roads`);
}

const stirumJunction: [number, number] = [52.3832952, 4.8768603];
const junctionArms = routing.filter(street =>
  (street.paths ?? (street.path ? [street.path] : [])).flat()
    .some(point => metersBetween(point, stirumJunction) < 13));
for (const name of ['Van Limburg Stirumstraat', 'De Wittenkade', 'Staatsliedenbrug']) {
  assert.ok(junctionArms.some(street => street.name === name), `${name} remains connected at the Stirumstraat roundabout`);
}

process.stdout.write(`Canal Recall car checks passed (5 simulations, 4 Da Costakade approaches, Stirumstraat roundabout, ${bridgeSegments.length} bridge segments, routing-class coverage).\n`);
