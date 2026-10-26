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
  plazaSummary = `; squares: Dam crossing ${after.steps} m, Leidseplein ${offCorridor.length} m² opened, 4 exits, Frederiksplein and Piet Heinkade ring blocked`;
}

process.stdout.write(`Canal Recall car checks passed (6 simulations, including Keizersgracht canal edge; 4 Da Costakade approaches, Stirumstraat roundabout, ${bridgeSegments.length} bridge segments, routing-class coverage${bridgeWaySummary}${plazaSummary}).\n`);
