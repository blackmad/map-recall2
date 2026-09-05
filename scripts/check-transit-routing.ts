/**
 * Named pins for transit corridor adaptation and tram 2 reachability.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { TransitNetwork } from '../src/canalRecall/transit/network.ts';
import {
  TRANSIT_THIN_SLICE_REFS,
  adaptTransitNetwork,
  displayStopName,
  lineDisplayName,
  transitRouteAnchors,
} from '../src/canalRecall/transit/segments.ts';
import {
  getTransitLineKey,
  getTransitStopKey,
} from '../src/canalRecall/transit/identity.ts';
import {
  intermediateStopIds,
  isStopAheadTowardFinish,
  resolveRouteStopId,
  stopIdsInTravelOrder,
} from '../src/canalRecall/transit/routeStops.ts';
import { transitPlaqueRouteName } from '../src/canalRecall/transit/plaque.ts';
import {
  buildCorridorStreetIndex,
  nearestCorridorStreet,
} from '../src/canalRecall/transit/corridorStreets.ts';
import { buildRoadSegments } from '../src/canalRecall/osm/roadProjection.ts';
import { buildRoadGraph, findRoadRoute } from '../src/canalRecall/routing/roadGraph.ts';

const extractPath = path.resolve('public/data/extracts/amsterdam/transit-network.json');
assert.ok(existsSync(extractPath), `missing ${extractPath}`);

const network = JSON.parse(readFileSync(extractPath, 'utf8')) as TransitNetwork;
const load = adaptTransitNetwork(network, { playableRefs: TRANSIT_THIN_SLICE_REFS });

assert.equal(load.ways.length, 1, 'thin slice exposes one tram corridor');
assert.equal(load.ways[0].tags.name, 'Tram 2');
assert.ok(load.stops.length >= 15, `tram 2 has enough stops (got ${load.stops.length})`);
assert.ok(load.stops.some((s) => s.name === 'Dam'), 'Dam stop display name');
assert.equal(displayStopName('Amsterdam, Dam'), 'Dam');
assert.equal(lineDisplayName('tram', '2'), 'Tram 2');

const dam = load.stops.find((s) => s.name === 'Dam');
assert.ok(dam, 'Dam on tram 2');
assert.ok(dam.center, 'Dam has extract centre');

const anchors = transitRouteAnchors(load);
assert.ok(anchors.some((a) => a.name === 'Centraal Station'), 'Centraal anchor');
assert.ok(anchors.some((a) => a.name === 'Dam'), 'Dam anchor');
assert.ok(anchors.length >= 4, 'enough retarget anchors');

{
  const lineKeyA = getTransitLineKey({
    cityId: 'amsterdam', mode: 'tram', ref: '2', name: 'Tram 2',
    center: [52.37, 4.89],
  });
  const lineKeyB = getTransitLineKey({
    cityId: 'amsterdam', mode: 'tram', ref: '2', name: 'Tram 2',
    center: [52.38, 4.90],
  });
  assert.equal(lineKeyA, lineKeyB, 'line key ignores ask-point drift');
  const stopKey = getTransitStopKey({
    cityId: 'amsterdam', name: 'Dam', center: dam.center,
  });
  assert.match(stopKey, /^v1_amsterdam_/);
}

// Destination-scoped intermediate stops: Centraal → Museumplein.
{
  const line = load.lines[0];
  assert.ok(line, 'thin slice line');
  const centraal = load.stops.find((s) => s.name === 'Centraal Station');
  const museum = load.stops.find((s) => s.name === 'Museumplein');
  assert.ok(centraal && museum, 'Centraal and Museumplein on tram 2');
  const fromId = resolveRouteStopId(load.stops, { id: `stop-${centraal.stopId}`, name: centraal.name });
  const toId = resolveRouteStopId(load.stops, { id: `stop-${museum.stopId}`, name: museum.name });
  assert.equal(fromId, centraal.stopId);
  assert.equal(toId, museum.stopId);
  const travel = stopIdsInTravelOrder(line.stopIds, fromId!, toId!);
  assert.equal(travel[0], centraal.stopId);
  assert.equal(travel[travel.length - 1], museum.stopId);
  const intermediate = intermediateStopIds(line.stopIds, fromId!, toId!);
  assert.ok(intermediate.includes(dam.stopId), 'Dam is intermediate Centraal→Museumplein');
  assert.ok(!intermediate.includes(centraal.stopId), 'origin excluded from intermediate set');
  assert.ok(intermediate.includes(museum.stopId), 'destination included');
  assert.ok(isStopAheadTowardFinish(500, 200), 'closer-to-finish stop is ahead');
  assert.ok(!isStopAheadTowardFinish(100, 400), 'farther-from-finish stop is behind');
}

// Sticky line plaque: stop/street prompts keep Tram 2 visible.
{
  const sticky = transitPlaqueRouteName({
    activeLine: 'Tram 2',
    roadName: 'Tram 2',
    quizPromptName: 'Dam',
    quizPromptSubject: 'stop',
    quizCandidateName: '',
    quizCurrentName: 'Tram 2',
  });
  assert.equal(sticky.routeName, 'Tram 2');
  assert.equal(sticky.answerHidden, false);

  const hiding = transitPlaqueRouteName({
    activeLine: '',
    roadName: 'Tram 2',
    quizPromptName: '',
    quizPromptSubject: '',
    quizCandidateName: 'Tram 2',
    quizCurrentName: '',
  });
  assert.equal(hiding.routeName, '');
  assert.equal(hiding.answerHidden, true);

  const lineAsk = transitPlaqueRouteName({
    activeLine: 'Tram 2',
    roadName: 'Tram 2',
    quizPromptName: 'Tram 2',
    quizPromptSubject: 'line',
    quizCandidateName: '',
    quizCurrentName: 'Tram 2',
  });
  assert.equal(lineAsk.answerHidden, true);
}

// Curated streets index can name a corridor-adjacent street (world-space stub).
{
  const index = buildCorridorStreetIndex([
    {
      name: 'Stadhouderskade',
      paths: [[[52.36, 4.88], [52.361, 4.881], [52.362, 4.882]]],
    },
    {
      name: 'Amstelveenseweg',
      paths: [[[52.35, 4.85], [52.351, 4.851]]],
    },
  ], (lat, lng) => ({ x: lng * 1000, y: lat * 1000 }));
  const hit = nearestCorridorStreet(index, 4.881 * 1000, 52.361 * 1000, 50);
  assert.ok(hit, 'nearest corridor street finds Stadhouderskade');
  assert.equal(hit!.name, 'Stadhouderskade');
}

// Tram 2 corridor reachable end-to-end on the adapted graph.
{
  const centre = { lat: 52.372851, lon: 4.8936 };
  const { segments } = buildRoadSegments(load.ways, centre, {
    simplificationToleranceDegrees: 0.00003,
    roadWidths: { tram: 38 },
    defaultRoadWidth: 38,
  });
  assert.ok(segments.length >= 1, 'tram 2 builds segments');
  assert.equal(segments[0].name, 'Tram 2');

  const graph = buildRoadGraph(segments.map((segment, index) => ({
    points: segment.points,
    width: segment.width,
    metadata: { name: segment.name, segmentIndex: index },
  })), { mergeSize: 18 });

  const startPt = segments[0].points[0];
  const endPt = segments[0].points[segments[0].points.length - 1];
  const path = findRoadRoute(graph, startPt, endPt);
  assert.ok(path && path.length >= 2, 'tram 2 corridor reachable end-to-end');
}

console.log(
  `Transit routing OK: Tram 2 (${load.stops.length} stops, ${load.ways[0].nodes.length} shape pts), `
  + `Dam pin, dest-scoped stops, sticky plaque, corridor streets, line/stop keys stable.`,
);
