import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constrainCarToRoad, trackDeadEnd, trackEdgeStall, type CarKinematics, type RoadContact, type RoadGuardResult } from '../src/canalRecall/carRoadGuard';
import { turnAroundHeading } from '../src/canalRecall/touchControls';
import { ROUTE_QUIZ_SETTLE_METRES, routePlaqueName } from '../src/canalRecall/game/recallRules';
import { bridgeNameAskable } from '../src/canalRecall/game/notableBridges';
import { coveringBuilding, initialCoverState, updateCoverState } from '../src/canalRecall/coveredPassage';
import { buildRoadSpatialIndex, classifySurface, contactsAt, pickGuardContact, roadsNear, type RoadPoint } from '../src/canalRecall/routing/roadSurface';
import { buildPlazaIndex, plazaAt, plazaGuardContact, plazaSurface, type PlazaFeature, type PlazaIndex } from '../src/canalRecall/routing/pedestrianAreas';
import { BGT_PLAZAS_EXTRACT, type BgtPlazaExtract } from '../src/canalRecall/routing/bgtPlazas';
import { buildRoadSegments, projectToWorld, PIXELS_PER_METER, type OsmWay } from '../src/canalRecall/osm/roadProjection';
import { bridgeWayNetwork, carriedStreetName, isBridgeWayName, routeQuestionRoadName } from '../src/canalRecall/game/bridgeStreetName';
import { afterFerryMove, beginFerryFrame, leadingEdge, nearestWater, type FerryGame } from '../src/canalRecall/ferry/travel';
import type { Terminal } from '../src/canalRecall/ferry/network';
import { helm, ijFerryWorld, ijWaterTest, nearestRoadOf, sail, toLatLon as ijToLatLon, toWorld as ijToWorld } from './lib/ferryIjWorld';
import { loadRoutingFeatures, routingSource } from './lib/routingFeatures';

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
const routing = await loadRoutingFeatures<RoutingStreet>();
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
// BGT paved plazas (bgtPlazas.ts, `?bgtPlazas=1`): the published extract, ridden on top of the squares.
const bgtPlazas = (JSON.parse(await readFile(`public/data/extracts/amsterdam/${BGT_PLAZAS_EXTRACT}`, 'utf8')) as BgtPlazaExtract).features;
const plazaWorld = (centre: [number, number], radiusMetres = 700, skipStreet?: (streetIndex: number) => boolean) => {
  const ways: OsmWay[] = [];
  routing.forEach((street, streetIndex) => (street.paths ?? (street.path ? [street.path] : [])).forEach((p, pathIndex) => {
    if (p.length < 2 || skipStreet?.(streetIndex)) return;
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
  const nearCentre = (f: PlazaFeature) => (f.polygons ?? []).some(polygon => polygon[0].some(q => metersBetween(q, centre) < radiusMetres));
  const bgt = buildPlazaIndex([...squares, ...bgtPlazas.filter(nearCentre)], toWorld, PIXELS_PER_METER);
  const guard = (x: number, y: number, withPlazas: PlazaIndex | null, preferredAngle: number | null = null) => {
    let best = pickGuardContact(contactsAt(roadsNear(index, x, y, 2), x, y), preferredAngle, { x, y });
    if (withPlazas) {
      if (!best && plazaAt(withPlazas, x, y)) best = pickGuardContact(contactsAt(roadsNear(index, x, y, 4), x, y), preferredAngle, { x, y });
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
  // The surface the car physics reads (road-network.js getSurface), without
  // its corner fillet: the nearest corridor's class, then squares as paving.
  const surface = (x: number, y: number, withPlazas: PlazaIndex | null) => {
    let nearest: { dist: number; width: number } | null = null;
    for (const c of contactsAt(roadsNear(index, x, y), x, y)) if (!nearest || c.dist < nearest.dist) nearest = c;
    const corridor = nearest ? classifySurface(nearest.dist, nearest.width) : 'grass';
    return plazaSurface(corridor, withPlazas, x, y);
  };
  /** Metres of a 1 m flood over rideable ground from `from` until `to` is reached (null: not within `box` m). */
  const reachable = (from: [number, number], to: [number, number], withPlazas: PlazaIndex | null, box = 150) => {
    const a = toWorld(...from), b = toWorld(...to);
    const n = 2 * box + 1, step = PIXELS_PER_METER;
    const ox = (a.x + b.x) / 2 - box * step, oy = (a.y + b.y) / 2 - box * step;
    const cellOf = (x: number, y: number) => Math.round((y - oy) / step) * n + Math.round((x - ox) / step);
    const seen = new Int32Array(n * n).fill(-1);
    const start = cellOf(a.x, a.y), goal = cellOf(b.x, b.y);
    seen[start] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head];
      if (c === goal) return seen[c];
      const i = c % n, j = (c - i) / n;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const k = nj * n + ni;
        if (seen[k] >= 0 || blocked(ox + ni * step, oy + nj * step, withPlazas)) continue;
        seen[k] = seen[c] + 1;
        queue.push(k);
      }
    }
    return null;
  };
  return { plazas, bgt, toWorld, blocked, ride, reachable, surface, guard };
};
let plazaSummary = '';
let bgtSummary = '';
const WATERLOO_PLEIN: [number, number] = [52.368690, 4.900812];
const MUSEUMPLEIN_LAWN: [number, number] = [52.35770, 4.88150];
const frederiksLawn = (): [number, number] => {
  const ring = (squares.find(square => square.name === 'Frederiksplein')!.paths ?? [squares.find(square => square.name === 'Frederiksplein')!.path!])[0];
  return [ring.reduce((t, q) => t + q[0], 0) / ring.length, ring.reduce((t, q) => t + q[1], 0) / ring.length];
};
/** The point of a polygon (outer + holes, [lat, lon]) farthest from its edges, on a 2 m grid. */
const deepestPoint = (polygon: Array<Array<[number, number]>>): [number, number] => {
  const ky = 111_320, kx = 111_320 * Math.cos(polygon[0][0][0] * Math.PI / 180);
  const xy = polygon.map(ring => ring.map(([lat, lon]) => [lon * kx, lat * ky] as [number, number]));
  const inside = (x: number, y: number) => xy.reduce((n, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < (ring[j][0] - ring[i][0]) * (y - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c;
    return n + (c ? 1 : 0);
  }, 0) % 2 === 1;
  const edge = (x: number, y: number) => Math.min(...xy.flatMap(ring => ring.slice(1).map((b, i) => {
    const a = ring[i], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / l2)) : 0;
    return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy);
  })));
  const xs = xy[0].map(p => p[0]), ys = xy[0].map(p => p[1]);
  let best: [number, number] = [0, 0], bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
    if (!inside(x, y)) continue;
    const d = edge(x, y);
    if (d > bestD) { bestD = d; best = [y / ky, x / kx]; }
  }
  return best;
};
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
  // Named regression (user report 2026-10-30, "bike can't go forward here
  // only backwards"): on the Nieuwmarkt south of the Waag, among the trees.
  // The guard allowed the paving but the physics read it as grass, whose drag
  // beats the bike's thrust at grass grip from a standstill; reverse is not
  // scaled by grip. Squares must read as paving to the surface check too.
  const nieuwmarktReport: [number, number] = [52.37235, 4.90030];
  const nm = plazaWorld(nieuwmarktReport);
  const nmOffCorridor: Array<[number, number]> = [];
  for (let dy = -20; dy <= 20; dy += 2) for (let dx = -20; dx <= 20; dx += 2) {
    const q: [number, number] = [nieuwmarktReport[0] + dy / 111_320, nieuwmarktReport[1] + dx / (111_320 * Math.cos(nieuwmarktReport[0] * Math.PI / 180))];
    const w = nm.toWorld(...q);
    if (plazaAt(nm.plazas, w.x, w.y) && nm.surface(w.x, w.y, null) === 'grass') nmOffCorridor.push(q);
  }
  assert.ok(nmOffCorridor.length > 20, `Nieuwmarkt paving near the report reads as grass without the squares (${nmOffCorridor.length} points)`);
  for (const q of nmOffCorridor) {
    const w = nm.toWorld(...q);
    assert.equal(nm.surface(w.x, w.y, nm.plazas), 'asphalt', `Nieuwmarkt (2026-10-30): the paving at ${q.map(v => v.toFixed(6)).join(',')} is asphalt to the physics`);
    assert.equal(nm.blocked(w.x, w.y, nm.plazas), false, `Nieuwmarkt (2026-10-30): the paving at ${q.map(v => v.toFixed(6)).join(',')} is rideable`);
  }
  // The Frederiksplein lawn stays grass (park square, not paving).
  const lawn = squares.find(square => square.name === 'Frederiksplein')!;
  const lawnRing = (lawn.paths ?? [lawn.path!])[0];
  const lawnAt: [number, number] = [lawnRing.reduce((t, q) => t + q[0], 0) / lawnRing.length, lawnRing.reduce((t, q) => t + q[1], 0) / lawnRing.length];
  const lw = plazaWorld(lawnAt);
  const lp = lw.toWorld(...lawnAt);
  assert.equal(lw.surface(lp.x, lp.y, lw.plazas), 'grass', 'the Frederiksplein lawn still reads as grass');
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
  // Feedback triage 2026-11-10 (build 6a901ba, desktop Free Ride; scripts/feedback/*, docs/reports/feedback-triage-20261110.md).
  // The report positions are the notes' context.player minus the camera offset applied to mapCenter.
  // 6d9d7ddd "I should probably be able to bike through here": the Oosterpark path east of the Tropenmuseum
  // (bicycle=yes footways w376383016 and neighbours). The extract dropped it until D2 (graphRevision 2, #322) appended
  // 273 features (index >= 47259 in streets-routing); without them the whole path is off every corridor.
  const D2_FIRST_FEATURE = 47_259;
  const tropenReport: [number, number] = [52.362209, 4.922503];
  const tropenPath: Array<[number, number]> = [[52.362326, 4.922363], [52.362275, 4.922058], [52.362201, 4.921765], [52.361954, 4.921029]];
  const rideAlong = (world: ReturnType<typeof plazaWorld>, from: [number, number], via: Array<[number, number]>) => {
    let steps = 0, stops = 0, at = from;
    for (const next of via) { const leg = world.ride(at, next, world.plazas); steps += leg.steps; stops += leg.stops; at = next; }
    return { steps, stops };
  };
  const tropenBefore = rideAlong(plazaWorld(tropenReport, 700, index => index >= D2_FIRST_FEATURE), tropenReport, tropenPath);
  const tropenAfter = rideAlong(plazaWorld(tropenReport), tropenReport, tropenPath);
  assert.ok(tropenBefore.stops > 20, `Oosterpark path: without the D2 footways the path is off every corridor (${tropenBefore.stops}/${tropenBefore.steps} m blocked)`);
  assert.equal(tropenAfter.stops, 0, `Oosterpark path by the Tropenmuseum (6d9d7ddd): rideable from the report position west along the path (${tropenAfter.stops}/${tropenAfter.steps} m blocked)`);
  // 637f346b "should be able to ride here" (ASC SDW forecourt, Heathrowstraat) and 4f47f105 (the Radarweg office
  // courtyard off Barajasweg): the bike stands on the corridor edge and open paving lies beside it. OSM has no rideable way
  // there (only unmarked paving_stones footways w1444682609, w1425820505-7: foot access, not bicycle=yes) and no pedestrian
  // area, so this stays off-road BY DESIGN until a paved link or a look that tells rideable paving from walking space
  // lands. The pin keeps the gap measured (the BGT plaza exceptions below ride them with the flag on).
  for (const [label, at] of [['ASC SDW forecourt (637f346b)', [52.385970, 4.832498]], ['Radarweg office courtyard (4f47f105)', [52.387448, 4.833459]]] as const) {
    const world = plazaWorld(at);
    const w = world.toWorld(at[0], at[1]);
    assert.equal(world.blocked(w.x, w.y, world.plazas), false, `${label}: the reported bike position is on a corridor`);
    let beyond = 0;
    for (let angle = 0; angle < 360; angle += 15) {
      const probe = world.toWorld(at[0] + Math.sin(angle * Math.PI / 180) * 12 / 111_320, at[1] + Math.cos(angle * Math.PI / 180) * 12 / (111_320 * Math.cos(at[0] * Math.PI / 180)));
      if (world.blocked(probe.x, probe.y, world.plazas)) beyond++;
    }
    assert.ok(beyond >= 8, `${label}: open paving within 12 m is off every corridor (${beyond}/24 directions blocked)`);
    // The BGT plazas leave erf blocked by rule (docs/reports/bgt-plazas-20261110.md); these two polygons are named,
    // reviewed exceptions (ERF_EXCEPTIONS, docs/reports/erf-exceptions-20261110.md): the forecourt and the office
    // apron are open paving on the ortho. With the BGT plazas on, the paving beside the reported position rides.
    let beyondBgt = 0;
    for (let angle = 0; angle < 360; angle += 15) {
      const probe = world.toWorld(at[0] + Math.sin(angle * Math.PI / 180) * 12 / 111_320, at[1] + Math.cos(angle * Math.PI / 180) * 12 / (111_320 * Math.cos(at[0] * Math.PI / 180)));
      if (world.blocked(probe.x, probe.y, world.bgt)) beyondBgt++;
    }
    console.log(`  erf exception ${label}: ${beyondBgt}/24 blocked at 12 m with the BGT plazas (${beyond}/24 without)`);
  }
  // Pinned points on the exception paving: blocked without the BGT plazas, ride with them, and are reached from the
  // reported corridor position: the ASC forecourt west of it, the Radarweg apron at the dead end of the service road
  // (about 90 m² opened there; the apron's west leg was already corridor).
  for (const [label, from, to, reachMax] of [
    ['ASC SDW forecourt (637f346b)', [52.385970, 4.832498], [52.385988, 4.832281], 40],
    ['Radarweg office apron (4f47f105)', [52.387448, 4.833459], [52.387450, 4.833547], 40],
  ] as const) {
    const world = plazaWorld(to as [number, number]);
    const w = world.toWorld(to[0], to[1]);
    assert.ok(world.blocked(w.x, w.y, world.plazas), `${label}: the exception paving is off-road without the BGT plazas`);
    assert.equal(world.blocked(w.x, w.y, world.bgt), false, `${label}: the exception paving rides with the BGT plazas`);
    assert.ok(plazaAt(world.bgt, w.x, w.y), `${label}: the point is inside a BGT plaza piece`);
    const steps = world.reachable(from as [number, number], to as [number, number], world.bgt);
    assert.ok(steps !== null && steps < reachMax, `${label}: reached from the reported position over the exception paving (${steps} m flood path)`);
    assert.equal(world.reachable(from as [number, number], to as [number, number], world.plazas), null, `${label}: not reachable without the BGT plazas`);
  }
  // BGT paved plazas (lane bgt-plazas-20261110; bgtPlazas.ts, flag `?bgtPlazas=1`, extract bgt-plazas-v1.json): BGT
  // pedestrian paving at least 8 m across (voetgangersgebied, plein, woonerf, voetpad) that a corridor reaches.
  // Centrum plein: the Waterlooplein paving north of the Stopera, which neither a corridor nor squares.json covers.
  const waterloo: [number, number] = WATERLOO_PLEIN;
  const wlw = plazaWorld(waterloo);
  const wp = wlw.toWorld(...waterloo);
  assert.ok(wlw.blocked(wp.x, wp.y, wlw.plazas), 'Waterlooplein: without the BGT plazas the paving is off every corridor and square');
  assert.equal(wlw.blocked(wp.x, wp.y, wlw.bgt), false, 'Waterlooplein: with the BGT plazas the paving rides');
  // From the Waterlooplein street corridor (north-east) the bike gets there over rideable ground; without the BGT
  // plazas it cannot.
  const wlStreet: [number, number] = [52.368798, 4.901371];
  const wsw = wlw.toWorld(...wlStreet);
  assert.equal(wlw.blocked(wsw.x, wsw.y, null), false, 'Waterlooplein: the start is on the street corridor');
  const wlRide = { steps: wlw.reachable(wlStreet, waterloo, wlw.bgt) };
  assert.ok(wlRide.steps !== null && wlRide.steps < 120, `Waterlooplein: reached from the street over the plein (${wlRide.steps} m flood path)`);
  assert.equal(wlw.reachable(wlStreet, waterloo, wlw.plazas), null, 'Waterlooplein: not reachable without the BGT plazas');
  const wlSurface = wlw.surface(wp.x, wp.y, wlw.bgt);
  assert.equal(wlSurface, 'asphalt', 'Waterlooplein: the BGT plaza reads as paving to the physics');
  // Negatives that must stay blocked with the BGT plazas on: a lawn (Museumplein's centre, BGT begroeid), the
  // Frederiksplein lawn, and a private courtyard (the Radarweg office's own inner court, BGT erf, 4f47f105).
  for (const [label, at] of [
    ['the Museumplein lawn', MUSEUMPLEIN_LAWN],
    ['the Frederiksplein lawn', frederiksLawn()],
    ['the Radarweg office inner courtyard (erf)', [52.387592, 4.833165]],
  ] as const) {
    const world = plazaWorld(at as [number, number]);
    const w = world.toWorld(at[0], at[1]);
    assert.equal(plazaAt(world.bgt, w.x, w.y), null, `${label} is not a BGT plaza`);
    assert.ok(world.blocked(w.x, w.y, world.bgt), `${label} stays off-road with the BGT plazas`);
  }
  // The largest shipped pieces ride at their deepest point: the guard's plaza branch finds a corridor contact
  // within roadsNear(…, 4) of every plaza point.
  for (const feature of [...bgtPlazas].sort((a, b) => b.plazaArea - a.plazaArea).slice(0, 3)) {
    const at = deepestPoint(feature.polygons[0]);
    const world = plazaWorld(at, 400);
    const w = world.toWorld(...at);
    assert.equal(world.blocked(w.x, w.y, world.bgt), false, `${feature.id} (${feature.plazaArea} m²): its deepest point ${at.map(v => v.toFixed(6)).join(',')} rides`);
  }
  bgtSummary = `; BGT plazas: ${bgtPlazas.length} pieces, Waterlooplein reached in ${wlRide.steps} m, lawns and the Radarweg inner courtyard blocked, 2 reviewed erf exceptions ride`;
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

{
  // trackDeadEnd (user report 2026-11-09, Javaplantsoen): forward held with no
  // net movement turns the bike round after DEAD_END_TURN_FRAMES, once; a
  // stall that starts on the asphalt, a rider turning the bike, no throttle
  // or a turn-round in progress never do.
  const fresh = () => ({ frames: 0, anchorX: 0, anchorY: 0, anchorAngle: 0 });
  const push = (state: ReturnType<typeof fresh>, frames: number, at: (i: number) => { guard: RoadGuardResult; x: number; y: number; angle: number; wantsForward?: boolean; turning?: boolean }) => {
    let fired = 0;
    for (let i = 0; i < frames; i++) { const f = at(i); if (trackDeadEnd(state, { wantsForward: f.wantsForward ?? true, ...f })) fired++; }
    return fired;
  };
  const shuffle = (i: number) => ({ guard: (i % 3 === 2 ? 'on-road' : 'soft-edge') as RoadGuardResult, x: 100 + (i % 2) * 0.9, y: 50 - (i % 3) * 0.6, angle: 0.1 });
  assert.equal(push(fresh(), 89, shuffle), 0, 'no turn-round before 1.5 s');
  assert.equal(push(fresh(), 90, shuffle), 1, 'stalled at a dead end for 1.5 s, the bike turns round');
  assert.equal(push(fresh(), 179, shuffle), 1, 'it fires once per stall, then starts counting again');
  assert.equal(push(fresh(), 200, i => ({ ...shuffle(i), guard: 'on-road' })), 0, 'never from a stall that never left the asphalt');
  assert.equal(push(fresh(), 200, i => ({ ...shuffle(i), angle: 0.1 + i * 0.02 })), 0, 'a rider turning the bike is handling it');
  assert.equal(push(fresh(), 200, i => ({ ...shuffle(i), wantsForward: false })), 0, 'no throttle, no turn-round');
  assert.equal(push(fresh(), 200, i => ({ ...shuffle(i), turning: true })), 0, 'not while a turn-round is under way');
  assert.equal(push(fresh(), 200, i => ({ ...shuffle(i), x: 100 + i * 2 })), 0, 'a bike that moves is not stalled');
}

let deadEndSummary = '';
{
  // Named regression (user report 2026-11-09, build ef73a29, Free Ride by
  // bike, "I'm stuck here"): the east end of the Javaplantsoen promenade
  // (OSM 318344977 + 4726770, routing_28 paths 5 and 0) ends at the steps
  // (172392374) down to Insulindeweg. Its real exits are the steps and the
  // bicycle=yes footways 1178623879 / 4726772, which the routing extract
  // leaves out (unnamed footways), so the end node 52.362966,4.946304 is a
  // cul-de-sac. Pushing forward there, the shoulder guard takes back every
  // step and the bike stands, throttle open. After DEAD_END_TURN_FRAMES of
  // that it turns round on the spot (trackDeadEnd) and rides back west.
  const end: [number, number] = [52.362966, 4.946304];
  const approach: [number, number] = [52.363027, 4.946010]; // 21 m west on the promenade
  const world = plazaWorld(end, 400);
  type Ride = { net: number; lastNet: number; turned: number; result: Record<string, number> };
  const simulate = (from: [number, number], heading: number | null, frames: number, recovery: boolean): Ride => {
    const a = world.toWorld(...from), b = world.toWorld(...end);
    const bike: CarKinematics = { x: a.x, y: a.y, angle: heading ?? Math.atan2(b.y - a.y, b.x - a.x), vx: 0, vy: 0, speed: 0 };
    const stall = { frames: 0, anchorX: 0, anchorY: 0 };
    const dead = { frames: 0, anchorX: 0, anchorY: 0, anchorAngle: 0 };
    let blockedFrames = 0, edgeFrames = 0, uTurn: number | null = null, turned = 0;
    const trail: Array<{ x: number; y: number }> = [];
    const result: Record<string, number> = {};
    const excessAt = (x: number, y: number) => { const c = world.guard(x, y, world.plazas, bike.angle); return c ? c.dist - c.width : Infinity; };
    const dt = 1 / 60;
    for (let i = 0; i < frames; i++) {
      if (uTurn != null) {
        const delta = Math.atan2(Math.sin(uTurn - bike.angle), Math.cos(uTurn - bike.angle));
        bike.angle += Math.sign(delta) * Math.min(Math.abs(delta), 5.5 * dt); // TURN_AROUND_RATE
        bike.speed = 0;
        if (Math.abs(delta) < 1e-3) uTurn = null;
      } else {
        bike.speed = Math.min(260, bike.speed + 120 * dt); // CAR_MAX_SPEED, CAR_ACCEL, throttle held
      }
      bike.vx = Math.cos(bike.angle) * bike.speed;
      bike.vy = Math.sin(bike.angle) * bike.speed;
      const previous = { x: bike.x, y: bike.y };
      bike.x += bike.vx * dt;
      bike.y += bike.vy * dt;
      const guard: RoadGuardResult = constrainCarToRoad(
        bike, previous, world.guard(bike.x, bike.y, world.plazas, bike.angle), world.guard(previous.x, previous.y, world.plazas, bike.angle),
        { edgeTolerance: 4, blockedFrames, excessAt, holdHeading: uTurn != null || edgeFrames > 12 },
      );
      result[guard] = (result[guard] ?? 0) + 1;
      blockedFrames = guard === 'rolled-back' ? blockedFrames + 1 : 0;
      edgeFrames = trackEdgeStall(stall, guard, 0, bike.x, bike.y);
      if (recovery && trackDeadEnd(dead, { wantsForward: true, guard, x: bike.x, y: bike.y, angle: bike.angle, turning: uTurn != null })) {
        const road = world.guard(bike.x, bike.y, world.plazas, bike.angle);
        uTurn = turnAroundHeading(bike.angle, road ? road.angle : null);
        turned++;
      }
      trail.push({ x: bike.x, y: bike.y });
    }
    const first = trail[0], last = trail[trail.length - 1], before = trail[trail.length - 121];
    return {
      net: Math.hypot(last.x - first.x, last.y - first.y) / PIXELS_PER_METER,
      lastNet: Math.hypot(last.x - before.x, last.y - before.y) / PIXELS_PER_METER,
      turned, result,
    };
  };
  const endWorld = world.toWorld(...end);
  const endContact = world.guard(endWorld.x, endWorld.y, world.plazas);
  assert.ok(endContact && endContact.dist <= endContact.width, 'Javaplantsoen: the promenade end is on the corridor');
  // Before: forward held into the end for 5 s, the last 2 s go nowhere.
  const stuck = simulate(approach, null, 300, false);
  assert.ok(stuck.lastNet < 0.5, `Javaplantsoen (2026-11-09): without recovery the bike stands at the end, forward held (${stuck.lastNet.toFixed(2)} m in the last 120 frames)`);
  // A quarter turn either way off the end, forward held, no steering: the
  // shoulder's heading ease swings the bike back along the promenade, so
  // these are measured, not pinned (2026-11-09: north 72.8 m, south 1.9 m).
  const east = Math.atan2(endWorld.y - world.toWorld(...approach).y, endWorld.x - world.toWorld(...approach).x);
  const sideways = [east - Math.PI / 2, east + Math.PI / 2].map(h => simulate(end, h, 180, false).lastNet);
  // The rider's own turn-round (heading reversed) rides back west.
  const back = simulate(end, east + Math.PI, 180, false);
  assert.ok(back.lastNet > 10, `Javaplantsoen: the turn-round rides away from the end (${back.lastNet.toFixed(1)} m)`);
  // After: the recovery turns the bike round once and it rides off.
  const freed = simulate(approach, null, 300, true);
  assert.equal(freed.turned, 1, `Javaplantsoen: the bike turns round by itself once (${freed.turned})`);
  assert.ok(freed.lastNet > 10, `Javaplantsoen (2026-11-09): with recovery the bike rides on (${freed.lastNet.toFixed(1)} m in the last 120 frames)`);
  // Lane D2 (#322): the routing extract now carries the bicycle=yes footway
  // 1178623879 that leaves the promenade 4.6 m short of the end and runs north
  // to the Kramatweg junction. A rider at the end who steers for it rides it
  // to the far end, no turn-round needed. (Against an extract without the
  // footway the shoulder holds the bike on the promenade: published before D2.)
  const kramatweg: [number, number] = [52.3632363, 4.9462146];
  const north = (() => {
    const k = world.toWorld(...kramatweg);
    const a = world.toWorld(...end);
    const heading = Math.atan2(k.y - a.y, k.x - a.x);
    let closest = Infinity;
    const bike: CarKinematics = { x: a.x, y: a.y, angle: heading, vx: 0, vy: 0, speed: 0 };
    let blockedFrames = 0;
    const excessAt = (x: number, y: number) => { const c = world.guard(x, y, world.plazas, bike.angle); return c ? c.dist - c.width : Infinity; };
    for (let i = 0; i < 240; i++) {
      bike.speed = Math.min(260, bike.speed + 120 / 60);
      bike.vx = Math.cos(bike.angle) * bike.speed;
      bike.vy = Math.sin(bike.angle) * bike.speed;
      const previous = { x: bike.x, y: bike.y };
      bike.x += bike.vx / 60;
      bike.y += bike.vy / 60;
      const guard = constrainCarToRoad(bike, previous, world.guard(bike.x, bike.y, world.plazas, bike.angle),
        world.guard(previous.x, previous.y, world.plazas, bike.angle), { edgeTolerance: 4, blockedFrames, excessAt });
      blockedFrames = guard === 'rolled-back' ? blockedFrames + 1 : 0;
      closest = Math.min(closest, Math.hypot(bike.x - k.x, bike.y - k.y) / PIXELS_PER_METER);
    }
    return closest;
  })();
  assert.ok(north < 5, `Javaplantsoen (D2): steering north at the end rides the bike footway to Kramatweg (closest ${north.toFixed(1)} m)`);
  // Riding along the open promenade never triggers it.
  const cruising = simulate([52.363120, 4.944941], 0, 180, true);
  assert.equal(cruising.turned, 0, 'Javaplantsoen: a bike riding freely is never turned round');
  deadEndSummary = `; Javaplantsoen dead end: forward ${stuck.lastNet.toFixed(2)} m before (quarter turns ${sideways.map(m => m.toFixed(1)).join('/')} m), turned round and ${freed.lastNet.toFixed(1)} m after; north footway closest ${north.toFixed(1)} m`;
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

  // Free Ride (#318). User 2026-11-09, build ef73a29, ?ride=free: the vessel
  // on the IJ off De Ruijterkade, 61 m from the Centraal F4 pier, "ferry
  // still getting stuck, should let me free ride and not force me along an
  // invisible path". Held towards the quay, a quiz-ride vessel crawls along
  // it (2.4 m/s, touching every second or two); a Free Ride vessel lands on
  // the quay street. Steering any way for 60 s it never stands still.
  const streets = [...world.segments, ...world.land], road = nearestRoadOf(streets);
  const userPose = ijToWorld(52.381133, 4.898421);
  assert.equal(water(userPose.x, userPose.y), true, '#318: the user pose is afloat');
  assert.ok(Math.abs(Math.hypot(userPose.x - centraalF4.x, userPose.y - centraalF4.y) / 3 - 61) < 1, '#318: 61 m from the Centraal pier, as the banner said');
  const freeVessel = (freeRide: boolean): FerryGame => ({ travelMode: 'car', freeRide,
    track: { segments: streets, getNearestRoad: (x, y) => road(x, y) },
    player: { ...userPose, angle: -3 * Math.PI / 4, speed: 0, vx: 0, vy: 0, maxSpeed: 180, length: 96, width: 27,
      isBoat: true, ferryOrigin: centraalF4, ferryDeparted: true, ferryUnarmed: [] } });
  const towardsQuay = Math.PI / 2;
  const quizRide = helm({ afterFerryMove }, freeVessel(false), water, towardsQuay, 10);
  assert.equal(quizRide.result, 'sailing', '#318: a quiz ride keeps the ferry a transit element (still aboard at the quay)');
  const free = freeVessel(true);
  const freeRide = helm({ afterFerryMove }, free, water, towardsQuay, 10);
  assert.equal(freeRide.result, 'landed', '#318: Free Ride lands on the De Ruijterkade quay');
  assert.ok(freeRide.seconds < 3, `#318: within 3 s (${freeRide.seconds.toFixed(1)} s)`);
  assert.ok(free.player.ferryOrigin === null && !free.player.isBoat, '#318: back on the bike');
  const landedOn = road(free.player.x, free.player.y);
  assert.ok(landedOn && landedOn.dist < 1 && !/^ferry/.test(streets[landedOn.segIdx].type), '#318: on a street, not the ferry access');
  let freeLandings = 0, leastWindow = Infinity;
  for (let k = 0; k < 16; k++) {
    const h = helm({ afterFerryMove }, freeVessel(true), water, k * Math.PI / 8 - Math.PI, 60);
    if (h.result !== 'sailing') freeLandings++;
    leastWindow = Math.min(leastWindow, h.minWindowMetres);
  }
  assert.ok(leastWindow > 1, `#318: steering any way for 60 s, the Free Ride vessel moves > 1 m in every 5 s (least ${leastWindow.toFixed(1)} m)`);
  // The earlier report (2026-10-31, "ferries get stuck ~50 m out"): from
  // every western IJ pier the launch gets 100 m clear within 12 s, in a
  // quiz ride and in Free Ride (where it may also land on the far bank).
  let launches = 0;
  for (const freeRide of [false, true]) for (const t of world.terminals.values()) {
    const g: FerryGame = { travelMode: 'car', freeRide, track: { segments: streets, getNearestRoad: (x, y) => road(x, y) },
      player: { x: t.x, y: t.y, angle: 0, speed: 20, vx: 0, vy: 0, maxSpeed: 260, length: 6, width: 2 } };
    g.player.angle = nearestWater(t, water)?.angle ?? Math.atan2(t.y - t.land.y, t.x - t.land.x);
    assert.equal(beginFerryFrame(g, water), true, `${t.name} ${t.id} boards`);
    const h = helm({ afterFerryMove }, g, water, g.player.angle, 12);
    const clear = Math.hypot(h.end.x - t.x, h.end.y - t.y) / 3;
    assert.ok(clear >= 100, `${freeRide ? 'Free Ride' : 'quiz'}: the ${t.name} ${t.id} launch gets 100 m clear in 12 s (${clear.toFixed(0)} m, ${h.result})`);
    launches++;
  }
  ferrySummary = `, ferry: NDSM quay 24.7 m and Buiksloterweg 15 m reports dock, ${farQuay} NDSM bank touches blocked, f80d47da hull afloat, ${crossings.length} IJ crossings dock, #318 Free Ride lands at De Ruijterkade in ${freeRide.seconds.toFixed(1)} s (${freeLandings}/16 headings land, least 5 s window ${leastWindow.toFixed(1)} m), ${launches} launches clear`;
}

process.stdout.write(`Canal Recall car checks passed (roads: ${routingSource()}; 6 simulations, including Keizersgracht canal edge; 4 Da Costakade approaches, Stirumstraat roundabout, ${bridgeSegments.length} bridge segments, routing-class coverage${bridgeWaySummary}${plazaSummary}${bgtSummary}${deadEndSummary}${ferrySummary}).\n`);
