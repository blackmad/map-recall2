import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constrainCarToRoad, trackEdgeStall, type CarKinematics, type RoadContact } from '../src/canalRecall/carRoadGuard';
import { ROUTE_QUIZ_SETTLE_METRES } from '../src/canalRecall/game/recallRules';
import { coveringBuilding, initialCoverState, updateCoverState } from '../src/canalRecall/coveredPassage';

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
  // A typical Amsterdam residential centreline is about 10 m from the canal
  // edge. The live six-metre half-width plus ~1.3 m tolerance must reject a
  // bike four metres into that water instead of treating it as road shoulder.
  const subject = car({ x: 30, y: 0, vx: 0, vy: 90 });
  const result = constrainCarToRoad(
    subject,
    { x: 21, y: 0 },
    road({ x: 0, dist: 30, width: 18, angle: Math.PI / 2 }),
    road({ x: 0, dist: 21, width: 18, angle: Math.PI / 2 }),
    { edgeTolerance: 4 },
  );
  assert.equal(result, 'rolled-back', 'Keizersgracht-style canal intrusion is rejected');
  assert.equal(subject.x, 21, 'canal-edge rollback restores the last street position');
}

{
  const subject = car({ x: 3, y: 0, angle: Math.PI / 2, vx: 0, vy: 120 });
  const result = constrainCarToRoad(subject, { x: 2, y: 0 }, road({ dist: 3, angle: Math.PI / 2 }), road({ angle: Math.PI / 2 }), options);
  assert.equal(result, 'on-road', 'a bridge-centre contact remains drivable even above rendered water');
}

{
  // Named regression (bridge sweep, 2026-10-01, Bosch van Drakesteinpad): a
  // service road ends 3 m from a cycle path. On the road's shoulder, a step
  // toward the path is outward from the road's end, but it brings the bike
  // nearer the whole surface, so the guard must keep it.
  const serviceEnd = road({ x: 0, y: 0, dist: 13.1, width: 13, angle: 0 });
  const pathEdge = (_x: number, y: number) => Math.abs(y + 22) - 9; // a path along y = -22
  const excessAt = (x: number, y: number) => Math.min(Math.hypot(x, y) - 13, pathEdge(x, y));
  const subject = car({ x: 0, y: -13.6, angle: -Math.PI / 2, vx: 0, vy: -60, speed: 60 });
  const result = constrainCarToRoad(subject, { x: 0, y: -13.1 }, serviceEnd, serviceEnd, { edgeTolerance: 4, excessAt });
  assert.equal(result, 'soft-edge');
  assert.ok(subject.y < -13.1, `the step onto the path is kept (y ${subject.y.toFixed(2)})`);
  const away = car({ x: 13.6, y: 0, vx: 60, vy: 0, speed: 60 });
  constrainCarToRoad(away, { x: 13.1, y: 0 }, road({ dist: 13.1, width: 13 }), road({ dist: 13.1, width: 13 }), { edgeTolerance: 4, excessAt });
  assert.ok(away.x <= 13.1, 'a step further off every road is still taken back');
}

{
  // Named regression (driving harness, 2026-09-29, Solitudobrug end on
  // Weesperzijde): the rollback slide follows the contact's tangent, and past
  // the end of a span that carries straight on off the road. With a probe of
  // the real edge, a slide that ends further out than it started is refused.
  const bridgeEnd = road({ x: 0, y: 0, dist: 20, width: 9, angle: 0 });
  const excessAt = (x: number, y: number) => Math.hypot(x, y) - 9; // round dead end at the origin
  const slid = car({ x: 22, y: 0, vx: 90, vy: 0, speed: 90 });
  constrainCarToRoad(slid, { x: 16, y: 0 }, bridgeEnd, road({ dist: 16, width: 9 }), { edgeTolerance: 4 });
  assert.ok(slid.x > 16, 'without the probe the slide carries on past the end');
  const held = car({ x: 22, y: 0, vx: 90, vy: 0, speed: 90 });
  constrainCarToRoad(held, { x: 16, y: 0 }, bridgeEnd, road({ dist: 16, width: 9 }), { edgeTolerance: 4, excessAt });
  assert.deepEqual({ x: held.x, y: held.y }, { x: 16, y: 0 }, 'with it the bike stays where it was');
  const along = car({ x: 20, y: 25, vx: 0, vy: 90 });
  constrainCarToRoad(along, { x: 10, y: 0 }, road({ x: 0, y: 25, dist: 20, width: 9 }), road({ dist: 10, width: 9 }), { edgeTolerance: 4, excessAt: (x: number, y: number) => Math.abs(y) - 30 });
  assert.equal(along.x, 20, 'a slide that stays on the road is kept');
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
{
  // Named regression (keyboard ride, 2026-10-02, the dead-end south end of
  // the Melkwegbrug): on the shoulder the bike shuffled 0.5-1 px a frame,
  // alternating soft-edge and on-road, and went nowhere. A per-frame
  // "moved < 0.5 px" stall test reset every few frames, so the heading ease
  // kept cancelling the held arrows. Judged on net movement it builds up.
  const state = { frames: 0, anchorX: 0, anchorY: 0 };
  let frames = 0;
  for (let i = 0; i < 30; i++) {
    const x = 100 + (i % 2) * 0.9, y = 50 - (i % 3) * 0.6;
    frames = trackEdgeStall(state, i % 3 === 2 ? 'on-road' : 'soft-edge', 1, x, y);
  }
  assert.ok(frames > 12, `a shuffling bike held at the edge counts as stalled (${frames} frames)`);
  // Gliding along the kerb is not a stall, nor is riding without steering.
  const glide = { frames: 0, anchorX: 0, anchorY: 0 };
  for (let i = 0; i < 30; i++) frames = trackEdgeStall(glide, 'soft-edge', 1, i * 1.5, 0);
  assert.ok(frames <= 3, `a bike sliding along the kerb is not stalled (${frames})`);
  const straight = { frames: 0, anchorX: 0, anchorY: 0 };
  for (let i = 0; i < 30; i++) frames = trackEdgeStall(straight, 'soft-edge', 0, 0, 0);
  assert.equal(frames, 0, 'no steering held, no stall');
}

{
  // Named regression (user report 2026-10-01, the Cuyperspassage under
  // Amsterdam Centraal): a ground-based footprint over the rider hides the
  // corridor, so it must be recognised; one floating above (min height 5 m),
  // or one the rider is only behind, must not.
  const shed = { properties: { id: 'w451533149', minHeight: 0, height: 9 }, geometry: { type: 'Polygon', coordinates: [[[4.8975, 52.3790], [4.9010, 52.3790], [4.9010, 52.3805], [4.8975, 52.3805], [4.8975, 52.3790]]] } };
  const deck = { properties: { minHeight: 5, height: 7 }, geometry: shed.geometry };
  const passage: [number, number] = [4.89862, 52.3797];
  assert.equal(coveringBuilding([shed], passage), shed, 'the train shed covers the rider in the passage');
  assert.equal(coveringBuilding([deck], passage), null, 'a raised deck is drawn floating, not over the rider');
  assert.equal(coveringBuilding([shed], [4.8950, 52.3797]), null, 'a building merely in view does not count');
  let cover = initialCoverState();
  cover = updateCoverState(cover, true, 0);
  assert.equal(cover.covered, false, 'not on the first reading');
  cover = updateCoverState(cover, true, 0.25);
  assert.equal(cover.covered, true, 'covered after the enter hold');
  cover = updateCoverState(cover, false, 0.3);
  cover = updateCoverState(cover, true, 0.4);
  cover = updateCoverState(cover, false, 0.5);
  assert.equal(cover.covered, true, 'a flicker at the footprint edge does not bring the buildings back');
  cover = updateCoverState(cover, false, 1.1);
  assert.equal(cover.covered, false, 'out for the leave hold, they return');
}

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

{
  // Named regression (user report 2026-10-09, "asked me kinda too late"): the
  // Noordsche Compagniebrug carries Herenstraat over the Keizersgracht onto
  // Prinsenstraat, and its routing ways are its own ~40 m street. The route
  // question settled on 0.65 s, which at cruise covered 33 m of it, so it was
  // asked at the far quay. tests/e2e/turn-question-timing.spec.ts drives it;
  // this pins the geometry that makes the time settle too long.
  const ways = routing.filter(street => street.name === 'Noordsche Compagniebrug');
  assert.ok(ways.some(street => street.bridge), 'Noordsche Compagniebrug is a routed bridge way');
  const length = ways.flatMap(street => street.paths ?? (street.path ? [street.path] : []))
    .reduce((sum, path) => sum + path.slice(1).reduce((m, point, i) => m + metersBetween(path[i], point), 0), 0);
  assert.ok(length > 30 && length < 50, `the bridge way is ~40 m (${length.toFixed(1)} m)`);
  assert.ok(ROUTE_QUIZ_SETTLE_METRES * 3 < length,
    'the distance settle asks in the first third of the bridge, not at its end');
}

process.stdout.write(`Canal Recall car checks passed (6 simulations, including Keizersgracht canal edge; 4 Da Costakade approaches, Stirumstraat roundabout, ${bridgeSegments.length} bridge segments, routing-class coverage).\n`);
