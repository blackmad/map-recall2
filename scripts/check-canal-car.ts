import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constrainCarToRoad, trackEdgeStall, type CarKinematics, type RoadContact } from '../src/canalRecall/carRoadGuard';
import { ROUTE_QUIZ_SETTLE_METRES, routePlaqueName } from '../src/canalRecall/game/recallRules';
import { bridgeNameAskable } from '../src/canalRecall/game/notableBridges';
import { coveringBuilding, initialCoverState, updateCoverState } from '../src/canalRecall/coveredPassage';
import { buildRoadSpatialIndex, contactsAt, pickGuardContact, roadsNear, type RoadPoint } from '../src/canalRecall/routing/roadSurface';
import { buildPlazaIndex, plazaAt, plazaGuardContact, type PlazaFeature, type PlazaIndex } from '../src/canalRecall/routing/pedestrianAreas';
import { buildRoadSegments, projectToWorld, PIXELS_PER_METER, type OsmWay } from '../src/canalRecall/osm/roadProjection';
import { bridgeWayNetwork, carriedStreetName, isBridgeWayName, routeQuestionRoadName } from '../src/canalRecall/game/bridgeStreetName';
import { afterFerryMove, beginFerryFrame, leadingEdge, nearestWater, type FerryGame } from '../src/canalRecall/ferry/travel';
import type { Terminal } from '../src/canalRecall/ferry/network';
import { ijFerryWorld, ijWaterTest, sail, toLatLon as ijToLatLon, toWorld as ijToWorld } from './lib/ferryIjWorld';

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
  // this pins the geometry that makes the time settle too long. Since
  // 2026-10-16 the deck itself is transparent to the street question (see the
  // Niek Engelschmanbrug regression below) and the Herenstraat is asked
  // instead, on the same distance settle.
  const ways = routing.filter(street => street.name === 'Noordsche Compagniebrug');
  assert.ok(ways.some(street => street.bridge), 'Noordsche Compagniebrug is a routed bridge way');
  const length = ways.flatMap(street => street.paths ?? (street.path ? [street.path] : []))
    .reduce((sum, path) => sum + path.slice(1).reduce((m, point, i) => m + metersBetween(path[i], point), 0), 0);
  assert.ok(length > 30 && length < 50, `the bridge way is ~40 m (${length.toFixed(1)} m)`);
  assert.ok(ROUTE_QUIZ_SETTLE_METRES * 3 < length,
    'the distance settle asks in the first third of the bridge, not at its end');
}

let bridgeWaySummary = '';
{
  // Named regression (user report 2026-10-16, cycling north-east on the
  // Raadhuisstraat over the Keizersgracht by the Homomonument): "Which street
  // are you on?" accepted "Niek Engelschmanbrug". OSM names that deck after
  // the bridge, and it runs from the Westermarkt onto the Raadhuisstraat. A
  // street question on a bridge-named way now answers with the street the deck
  // carries, or with no name (the street beyond is asked once off the deck);
  // only the deliberate "Which bridge are you on?" keeps a bridge's name.
  // Built the way the game builds it: 3 px a metre, closed rings dropped.
  const PX_PER_M = 3;
  const lat0 = 52.37, lon0 = 4.9, lonScale = Math.cos(lat0 * Math.PI / 180);
  const segments: Array<{ name: string; width: number; points: RoadPoint[] }> = [];
  for (const street of routing) {
    for (const path of street.paths ?? (street.path ? [street.path] : [])) {
      if (path.length < 2) continue;
      const first = path[0], last = path[path.length - 1];
      if (path.length > 3 && first[0] === last[0] && first[1] === last[1]) continue;
      segments.push({ name: street.name, width: 20, points: path.map(([lat, lon]) => ({
        x: (lon - lon0) * 111_320 * lonScale * PX_PER_M,
        y: -(lat - lat0) * 111_320 * PX_PER_M,
      })) });
    }
  }
  const network = bridgeWayNetwork(segments, buildRoadSpatialIndex(segments, 100));
  const options = { touchRadius: 3 * PX_PER_M };
  const answerOn = (index: number) => routeQuestionRoadName({
    rawName: segments[index].name,
    deliberateBridge: false,
    carriedStreet: () => carriedStreetName(network, index, options),
  });
  const indexesOf = (name: string) => segments.flatMap((segment, index) => (segment.name === name ? [index] : []));

  const deck = indexesOf('Niek Engelschmanbrug');
  assert.ok(deck.length >= 2, 'the Niek Engelschmanbrug carriageways are routed ways');
  for (const index of deck) {
    const answer = answerOn(index);
    assert.ok(answer === '' || answer === 'Raadhuisstraat',
      `on the Niek Engelschmanbrug the street question answers "${answer}", not the bridge`);
  }
  // Same shape, the 2026-10-09 timing report: Herenstraat over the
  // Keizersgracht onto the Prinsenstraat.
  for (const index of indexesOf('Noordsche Compagniebrug')) {
    assert.ok(!isBridgeWayName(answerOn(index)), 'the Noordsche Compagniebrug is never a street answer');
  }
  // A quay continuing over a side canal is that quay; a lane continuing over
  // a canal is that lane.
  for (const [bridge, street] of [['Grote Brouwerssluis', 'Prinsengracht'], ['Vingboomsbrug', 'Huidenstraat']]) {
    assert.ok(indexesOf(bridge).some(index => answerOn(index) === street), `${bridge} carries the ${street}`);
  }
  // The radial streets' own bridges are mapped under the street's name, so
  // they are untouched: the Raadhuisstraat over the Herengracht and Singel,
  // the Leidsestraat and the Utrechtsestraat over the canal belt.
  for (const name of ['Raadhuisstraat', 'Leidsestraat', 'Utrechtsestraat']) {
    assert.ok(routing.some(street => street.name === name && street.bridge), `${name} has bridge ways in its own name`);
  }
  // City-wide: no bridge-named way is ever a street answer.
  let bridgeWays = 0, carried = 0;
  for (let index = 0; index < segments.length; index++) {
    if (!isBridgeWayName(segments[index].name)) continue;
    bridgeWays++;
    const answer = answerOn(index);
    assert.ok(!isBridgeWayName(answer), `${segments[index].name} answers a street question with "${answer}"`);
    if (answer) carried++;
  }
  bridgeWaySummary = `, ${bridgeWays} bridge-named ways (${carried} carry a street, ${bridgeWays - carried} transparent)`;

  // Named regression (TODO "Bridge decks after the carried-street fix",
  // 2026-10-16): the plaque read the raw way name, so it was blank for the
  // length of a deck that carries a street. It now reads the name the route
  // question settles on, under the ordinary withholding rule: the street
  // shows once it is the settled corridor (or known), never before.
  const bridgeNames = new Set((JSON.parse(await readFile(
    `${process.env.BRIDGES_EXTRACT_DIR || 'public/data/extracts/amsterdam'}/bridges.json`, 'utf8',
  )) as Array<{ name: string }>).map(bridge => bridge.name));
  const settledName = (index: number, difficulty: 'medium' | 'hard') => routeQuestionRoadName({
    rawName: segments[index].name,
    deliberateBridge: bridgeNames.has(segments[index].name) && bridgeNameAskable(difficulty, segments[index].name),
    carriedStreet: () => carriedStreetName(network, index, options),
  });
  const plaqueOn = (index: number, difficulty: 'medium' | 'hard', currentName: string, candidateName = '') => {
    const roadName = settledName(index, difficulty);
    return routePlaqueName({ roadName, currentName, promptName: '', candidateName, revealed: false, learned: false }).routeName;
  };
  const vingbooms = indexesOf('Vingboomsbrug').find(index => answerOn(index) === 'Huidenstraat')!;
  assert.equal(plaqueOn(vingbooms, 'medium', 'Huidenstraat'), 'Huidenstraat', 'the Vingboomsbrug plaque reads Huidenstraat');
  assert.equal(plaqueOn(vingbooms, 'medium', 'Keizersgracht'), '', 'an unasked Huidenstraat is not revealed on the deck');
  assert.equal(plaqueOn(vingbooms, 'medium', 'Keizersgracht', 'Huidenstraat'), '', 'nor while it settles');
  // Raadhuisstraat over the Keizersgracht: the Niek Engelschmanbrug deck is
  // transparent below hard, so the plaque names neither the bridge nor the
  // Raadhuisstraat until the rider is on the Raadhuisstraat itself.
  for (const index of deck) {
    for (const current of ['Westermarkt', 'Raadhuisstraat']) {
      const shown = plaqueOn(index, 'medium', current);
      assert.ok(shown === '' || (shown === 'Raadhuisstraat' && current === 'Raadhuisstraat'),
        `Niek Engelschmanbrug plaque after ${current}: "${shown}"`);
    }
  }
  // Named regression (same TODO): the bridges.json cut left 124 routed bridge
  // names asked by no question. At hard both reported decks are asked as
  // bridges ("Which bridge are you on?"), and the plaque withholds the name.
  for (const name of ['Noordsche Compagniebrug', 'Niek Engelschmanbrug']) {
    assert.ok(bridgeNames.has(name), `${name} is in bridges.json (askable by the bridge question)`);
    for (const index of indexesOf(name)) {
      assert.equal(settledName(index, 'hard'), name, `at hard the ${name} is asked as a bridge`);
      assert.equal(plaqueOn(index, 'hard', 'Herenstraat'), '', `the ${name} is not revealed before it is asked`);
    }
  }
}

// Open squares are rideable paving (pedestrianAreas.ts, wired into
// road-network.js getGuardRoad). The world is built as osm-loader.js builds
// it: closed rings dropped, the same widths and simplification.
const PLAZA_ROAD_WIDTHS: Record<string, number> = {
  primary: 30, secondary: 26, tertiary: 21, residential: 18, unclassified: 17, living_street: 16,
  service: 13, busway: 18, cycleway: 9, pedestrian: 14, footway: 7, path: 8,
};
const squares = JSON.parse(await readFile('public/data/extracts/amsterdam/squares.json', 'utf8')) as PlazaFeature[];
const plazaWorld = (centre: [number, number], radiusMetres = 700) => {
  const ways: OsmWay[] = [];
  routing.forEach((street, streetIndex) => (street.paths ?? (street.path ? [street.path] : [])).forEach((p, pathIndex) => {
    if (p.length < 2) return;
    if (p.length > 3 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1]) return;
    if (!p.some(q => metersBetween(q, centre) < radiusMetres)) return;
    const highway = street.highway || 'residential';
    ways.push({ id: `${streetIndex}:${pathIndex}`, nodes: p.map(([lat, lon]) => ({ lat, lon })), tags: { name: street.name, highway }, highway } as unknown as OsmWay);
  }));
  const centreLL = { lat: centre[0], lon: centre[1] };
  const built = buildRoadSegments(ways, centreLL, { simplificationToleranceDegrees: 0.00003, roadWidths: PLAZA_ROAD_WIDTHS, defaultRoadWidth: 32 });
  const toWorld = (lat: number, lon: number) => {
    const p = projectToWorld({ lat, lon }, centreLL);
    return { x: p.x + built.offset.x, y: p.y + built.offset.y };
  };
  const index = buildRoadSpatialIndex(built.segments, 100);
  const plazas = buildPlazaIndex(squares, toWorld, PIXELS_PER_METER);
  const guard = (x: number, y: number, withPlazas: PlazaIndex | null) => {
    let best = pickGuardContact(contactsAt(roadsNear(index, x, y, 2), x, y), null, { x, y });
    if (withPlazas) {
      if (!best && plazaAt(withPlazas, x, y)) best = pickGuardContact(contactsAt(roadsNear(index, x, y, 4), x, y), null, { x, y });
      best = plazaGuardContact(best, withPlazas, x, y);
    }
    return best;
  };
  // What constrainCarToRoad treats as leaving the road (edgeTolerance 4 px).
  const blocked = (x: number, y: number, withPlazas: PlazaIndex | null) => {
    const contact = guard(x, y, withPlazas);
    return !contact || contact.dist > contact.width + 4;
  };
  const ride = (from: [number, number], to: [number, number], withPlazas: PlazaIndex | null) => {
    const a = toWorld(from[0], from[1]), b = toWorld(to[0], to[1]);
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / PIXELS_PER_METER);
    let stops = 0;
    for (let i = 0; i <= steps; i++) if (blocked(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, withPlazas)) stops++;
    return { steps, stops };
  };
  return { plazas, toWorld, blocked, ride };
};
let plazaSummary = '';
{
  // Named regression (feedback 636a57f4, 2026-10-25, "I should be able to bike
  // across this square"): the Dam, from in front of the Royal Palace to the
  // National Monument, is open paving between the corridors.
  const palace: [number, number] = [52.37300, 4.89210];
  const monument: [number, number] = [52.37290, 4.89340];
  const dam = plazaWorld(palace);
  const before = dam.ride(palace, monument, null);
  const after = dam.ride(palace, monument, dam.plazas);
  assert.ok(before.stops > 0, `the Dam crossing leaves every corridor without the squares (${before.stops}/${before.steps} m blocked)`);
  assert.equal(after.stops, 0, `the Dam is rideable from the Royal Palace to the National Monument (${after.stops}/${after.steps} m blocked)`);
  // Named regression (feedback 638590e9, 2026-10-25, "got stuck, would like to
  // move"): the east part of the Leidseplein by Korte Leidsedwarsstraat. The
  // bike stood on the plaza 5.6 m outside the pedestrian corridor.
  // The screenshot position is approximate and itself sits 5.6 m from the
  // corridor, just inside its edge; the plaza paving around it within 25 m
  // must be rideable, and from the nearest paving that was off every
  // corridor the bike must be able to leave in all four directions.
  const reported: [number, number] = [52.36400, 4.88300];
  const leidse = plazaWorld(reported);
  const offCorridor: Array<[number, number]> = [];
  for (let dy = -25; dy <= 25; dy += 1) for (let dx = -25; dx <= 25; dx += 1) {
    const q: [number, number] = [reported[0] + dy / 111_320, reported[1] + dx / (111_320 * Math.cos(reported[0] * Math.PI / 180))];
    const w = leidse.toWorld(...q);
    if (plazaAt(leidse.plazas, w.x, w.y) && leidse.blocked(w.x, w.y, null)) offCorridor.push(q);
  }
  assert.ok(offCorridor.length > 50, `Leidseplein paving near the report is off every corridor without the squares (${offCorridor.length} m²)`);
  const stillBlocked = offCorridor.filter(q => { const w = leidse.toWorld(...q); return leidse.blocked(w.x, w.y, leidse.plazas); });
  assert.equal(stillBlocked.length, 0, `Leidseplein paving within 25 m of the report is rideable (${stillBlocked.length} m² blocked)`);
  const stuck = offCorridor.reduce((a, b) => metersBetween(a, reported) <= metersBetween(b, reported) ? a : b);
  for (const [dLat, dLon] of [[0.00005, 0], [-0.00005, 0], [0, 0.00008], [0, -0.00008]] as const) {
    const away: [number, number] = [stuck[0] + dLat, stuck[1] + dLon];
    const moved = leidse.ride(stuck, away, leidse.plazas);
    assert.equal(moved.stops, 0, `the bike moves ${moved.steps} m off the Leidseplein plaza point ${stuck.map(v => v.toFixed(6)).join(',')} toward ${away.map(v => v.toFixed(6)).join(',')}`);
  }
  // The exact positions decoded from the two reports (camera offset applied
  // to the map centre; game origin 52.355861,4.8995): the bike is free there.
  for (const [label, at, world] of [
    ['Dam (636a57f4)', [52.372813, 4.892422], dam],
    ['Leidseplein (638590e9)', [52.363933, 4.882884], leidse],
  ] as const) {
    const w = world.toWorld(at[0], at[1]);
    assert.equal(world.blocked(w.x, w.y, world.plazas), false, `${label}: the reported bike position is rideable`);
    for (const [dLat, dLon] of [[0.00004, 0], [-0.00004, 0], [0, 0.00006], [0, -0.00006]] as const) {
      const away: [number, number] = [at[0] + dLat, at[1] + dLon];
      assert.equal(world.ride([at[0], at[1]], away, world.plazas).stops, 0, `${label}: the bike leaves the reported position towards ${away.join(',')}`);
    }
  }
  // Named regression (feedback 3e7f0aa4, 2026-10-25, "I should probably be
  // able to bike to this red path but I'm blocked"): on the paving between the
  // Oosterdok busway and the quay at 52.377294,4.903152, the cycle bridge Brug
  // 228 to the Odebrug dead-ends on a 1 m stub 20 m away (pavedLinks.ts).
  const odeReport: [number, number] = [52.377294, 4.903152];
  const ode = plazaWorld(odeReport);
  const brug228: [number, number] = [52.3770640, 4.9034365]; // mid-span, OSM way 1168346867
  const stub: [number, number] = [52.3771270, 4.9032636]; // the landing stub 1168346869
  const viaLanding = (from: [number, number], plazas: PlazaIndex | null) => {
    const legs = [ode.ride(from, stub, plazas), ode.ride(stub, brug228, plazas)];
    return { steps: legs[0].steps + legs[1].steps, stops: legs[0].stops + legs[1].stops };
  };
  const odeBefore = viaLanding(odeReport, null);
  const odeAfter = viaLanding(odeReport, ode.plazas);
  assert.ok(odeBefore.stops > 0, `the bridge is off every corridor from the report without the paved link (${odeBefore.stops}/${odeBefore.steps} m blocked)`);
  assert.equal(odeAfter.stops, 0, `Odebrug (3e7f0aa4): the bike rides from the report onto Brug 228 (${odeAfter.stops}/${odeAfter.steps} m blocked)`);
  const odeBusway: [number, number] = [52.3773674, 4.9032464]; // busway 1071670642
  assert.equal(viaLanding(odeBusway, ode.plazas).stops, 0, 'Odebrug: from the busway onto Brug 228');
  // Brug 228 carries on to the Odebrug and Oostertoegang on corridors alone.
  const brugEast: [number, number] = [52.3770047, 4.9035998], oostertoegang: [number, number] = [52.3769706, 4.9037110];
  assert.equal(ode.ride(brug228, brugEast, null).stops + ode.ride(brugEast, oostertoegang, null).stops, 0, 'Odebrug: Brug 228 leads on to Oostertoegang');
  // The water beside the landing and the bus station west of the wall stay off-road.
  for (const [label, at] of [['the Oosterdok inlet east of the quay', [52.3772494, 4.9037387]], ['below the wall, west of the steps', [52.3771200, 4.9030300]]] as const) {
    const w = ode.toWorld(at[0], at[1]);
    assert.equal(plazaAt(ode.plazas, w.x, w.y), null, `${label} is not paved link`);
  }
  // Negatives: closed rings that stay blocked. Frederiksplein is a park
  // (lawn around the fountain); the Piet Heinkade ring (routing_4258 path 6,
  // 10,159 m², the largest closed street ring in the centre) loops around a
  // block; osm-loader drops it and it is not a square.
  const centroid = (r: [number, number][]): [number, number] => [r.reduce((t, q) => t + q[0], 0) / r.length, r.reduce((t, q) => t + q[1], 0) / r.length];
  const frederiksSquare = squares.find(square => square.name === 'Frederiksplein')!;
  const frederiks = centroid((frederiksSquare.paths ?? [frederiksSquare.path!])[0]);
  const fw = plazaWorld(frederiks);
  const fp = fw.toWorld(...frederiks);
  assert.equal(plazaAt(fw.plazas, fp.x, fp.y), null, 'the Frederiksplein lawn is not a rideable square');
  assert.ok(fw.blocked(fp.x, fp.y, fw.plazas), `the Frederiksplein lawn stays off-road (${frederiks.map(v => v.toFixed(6)).join(',')})`);
  const pietHein = (routing as Array<RoutingStreet & { id?: string }>).find(street => street.id === 'routing_4258')!;
  const ring = (pietHein.paths ?? [pietHein.path!])[6];
  const bw = plazaWorld(centroid(ring));
  const ringWorld = ring.map(([lat, lon]) => bw.toWorld(lat, lon));
  const inRing = (x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = ringWorld.length - 1; i < ringWorld.length; j = i++) {
      const p = ringWorld[i], q = ringWorld[j];
      if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) inside = !inside;
    }
    return inside;
  };
  let interior = 0;
  const xs = ringWorld.map(p => p.x), ys = ringWorld.map(p => p.y);
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += PIXELS_PER_METER * 2) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += PIXELS_PER_METER * 2) {
      if (!inRing(x, y) || !bw.blocked(x, y, null)) continue;
      interior++;
      assert.equal(plazaAt(bw.plazas, x, y), null, 'the Piet Heinkade ring is not a square');
      assert.ok(bw.blocked(x, y, bw.plazas), 'the Piet Heinkade ring interior stays off-road');
    }
  }
  assert.ok(interior > 100, `the Piet Heinkade ring has off-road interior to test (${interior} samples)`);
  plazaSummary = `; squares: Dam crossing ${after.steps} m, Leidseplein ${offCorridor.length} m² opened, 4 exits, both report positions free, Odebrug Brug 228 reached in ${odeAfter.steps} m, Frederiksplein and Piet Heinkade ring blocked`;
}

let ferrySummary = '';
{
  // Ferry docking and hull on the real western IJ: terminals and links from
  // ferrySegments over the transit extract, water from OSM polygons
  // (scripts/fixtures/ferry-water-ij.json). Feedback of 2026-10-25, build
  // 2620cb1; positions decoded from each report's camera and map centre.
  const world = ijFerryWorld(), water = ijWaterTest();
  const terminal = (id: string) => { const t = world.terminals.get(id); assert.ok(t, `ferry terminal ${id}`); return t!; };
  const centraalF4 = terminal('3980457'), centraalF3 = terminal('3980940'), ndsm = terminal('3980786'), buiksloterweg = terminal('3980896');
  const vessel = (lat: number, lon: number, degrees: number, origin: Terminal): FerryGame => ({
    travelMode: 'car', track: { segments: world.segments, getNearestRoad: () => null },
    player: { ...ijToWorld(lat, lon), angle: degrees * Math.PI / 180, speed: 60, vx: 0, vy: 0, maxSpeed: 180, length: 96, width: 27,
      isBoat: true, ferryOrigin: origin, ferryDeparted: true },
  });
  const step = (game: FerryGame, metres = 3) => afterFerryMove(game,
    { x: game.player.x - Math.cos(game.player.angle) * metres * 3, y: game.player.y - Math.sin(game.player.angle) * metres * 3 }, water);
  // 1d632c41 "can't turn back into a bike even at ndsm": the vessel stood on
  // the NDSM-werf quay at 52.401408,4.891088, 24.7 m from the stop, heading
  // in (284 degrees). Build 2620cb1 and the 20.5 m quay radius both blocked it.
  const ndsmReport = vessel(52.401408, 4.891088, 284.4, centraalF4);
  assert.equal(water(ndsmReport.player.x, ndsmReport.player.y), false, 'the NDSM report position is on the quay');
  assert.equal(step(ndsmReport), 'docked', 'NDSM-werf (1d632c41): the vessel on the quay 24.7 m from the stop docks');
  assert.equal(Math.hypot(ndsmReport.player.x - ndsm.land.x, ndsmReport.player.y - ndsm.land.y), 0, 'onto the NDSM-werf land access');
  // 50ea10bf "why isn't it letting me turn back [into a bike] at buikslotweg":
  // an F4 vessel from Centraal afloat by the Buiksloterweg pontoon, 15 m from
  // the F3 stop, heading in. Other lines' piers were refused, and on water
  // docking needed 6 m.
  const buikReport = vessel(52.382217, 4.903187, 310.8, centraalF4);
  assert.equal(water(buikReport.player.x, buikReport.player.y), true, 'the Buiksloterweg report position is afloat');
  assert.equal(step(buikReport), 'docked', 'Buiksloterweg (50ea10bf): an F4 vessel 15 m from the F3 pier docks');
  assert.equal(Math.hypot(buikReport.player.x - buiksloterweg.land.x, buikReport.player.y - buiksloterweg.land.y), 0, 'onto the Buiksloterweg land access');
  // Negative: the NDSM quay past its 37 m pier outline (OSM way 588710849) is
  // an ordinary bank; a vessel nosing into it 55-60 m from the stop is blocked.
  let farQuay = 0;
  for (let k = 0; k < 72; k++) {
    const a = k * Math.PI / 36;
    for (const metres of [55, 60]) {
      const x = ndsm.x + Math.cos(a) * metres * 3, y = ndsm.y + Math.sin(a) * metres * 3;
      if (water(x, y)) continue;
      // Approach from whichever neighbouring point 3 m away is afloat.
      const from = Array.from({ length: 8 }, (_, j) => j * Math.PI / 4)
        .map(d => ({ d, x: x - Math.cos(d) * 9, y: y - Math.sin(d) * 9 })).find(q => water(q.x, q.y));
      if (!from) continue;
      const g = vessel(...ijToLatLon({ x, y }), from.d * 180 / Math.PI, centraalF4);
      assert.equal(afterFerryMove(g, from, water), 'blocked', `the NDSM bank ${metres} m from the stop is not a pier`);
      farQuay++;
    }
  }
  assert.ok(farQuay >= 4, `the NDSM bank beyond the pier is probed (${farQuay} touches)`);
  // f80d47da "boat tears through the ground a bit": the vessel ran along the
  // north shore at 52.392846,4.897173 (OSM IJ edge 0.1 m away) with half its
  // hull over the quay. Holding course into the bank from 80 m out, the hull's
  // centre and bow stay afloat on every frame; build 2620cb1 put them ashore
  // on 143 frames. Riding the bank, the bow glances off instead.
  const shoreStart = ijToWorld(52.392846, 4.897173), shoreHeading = 290.1 * Math.PI / 180;
  const fromSea = { x: shoreStart.x - Math.cos(shoreHeading) * 240, y: shoreStart.y - Math.sin(shoreHeading) * 240 };
  const intoBank = sail({ afterFerryMove, leadingEdge }, world, water, centraalF4, fromSea,
    [{ x: shoreStart.x + Math.cos(shoreHeading) * 180, y: shoreStart.y + Math.sin(shoreHeading) * 180 }]);
  assert.equal(intoBank.aground, 0, `f80d47da: the hull stays afloat heading into the north shore (${intoBank.aground} frames ashore)`);
  assert.equal(intoBank.result, 'stalled', 'f80d47da: the bank stops the vessel');
  // Every GVB crossing in the western IJ, both ways, sails its GTFS line and
  // docks at the far pier without the hull going ashore. Leaving Centraal F4
  // passes its sister stop F3 40 m along the same quay, which must not dock
  // the vessel straight back (REARM_RADIUS hysteresis).
  const crossings: string[] = [];
  for (const link of world.links) {
    if (link.ref === 'F7') continue; // its GTFS shape runs via Distelweg and the Centraal piers; the boat docks at Distelweg
    for (const [from, to, points] of [[link.from, link.to, link.points], [link.to, link.from, [...link.points].reverse()]] as const) {
      const boarding: FerryGame = { travelMode: 'car', track: { segments: world.segments, getNearestRoad: () => null },
        player: { x: from.x, y: from.y, angle: 0, speed: 20, vx: 0, vy: 0, maxSpeed: 260, length: 6, width: 2 } };
      const shore = nearestWater(from, water);
      assert.ok(shore, `${link.ref} ${from.name} has water in boarding reach`);
      boarding.player.angle = shore!.angle ?? Math.atan2(from.y - from.land.y, from.x - from.land.x);
      assert.equal(beginFerryFrame(boarding, water), true, `${link.ref}: boards at ${from.name}`);
      const v = sail({ afterFerryMove, leadingEdge }, world, water, boarding.player.ferryOrigin!, boarding.player, points.slice(1), { maxFrames: 60 * 90 });
      assert.equal(v.result, 'docked', `${link.ref} ${from.name} -> ${to.name} docks (${v.result}, ${v.endMetres.toFixed(1)} m from a pier)`);
      assert.equal(v.dockedAt, to.name, `${link.ref} ${from.name} -> ${to.name} docks at ${to.name}, not ${v.dockedAt}`);
      assert.equal(v.aground, 0, `${link.ref} ${from.name} -> ${to.name}: the hull stays afloat (${v.aground} frames ashore)`);
      crossings.push(`${link.ref}`);
    }
  }
  assert.ok(Math.hypot(centraalF3.x - centraalF4.x, centraalF3.y - centraalF4.y) < 150, 'Centraal F3 and F4 share a quay inside the re-arm radius');
  ferrySummary = `, ferry: NDSM quay 24.7 m and Buiksloterweg 15 m reports dock, ${farQuay} NDSM bank touches blocked, f80d47da hull afloat, ${crossings.length} IJ crossings dock`;
}

process.stdout.write(`Canal Recall car checks passed (6 simulations, including Keizersgracht canal edge; 4 Da Costakade approaches, Stirumstraat roundabout, ${bridgeSegments.length} bridge segments, routing-class coverage${bridgeWaySummary}${plazaSummary}${ferrySummary}).\n`);
