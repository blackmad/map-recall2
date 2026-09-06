/**
 * Named pins for transit corridor adaptation, Phase D surface, and Phase E transfers.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { TransitNetwork } from '../src/canalRecall/transit/network.ts';
import {
  TRANSIT_DRIVEABLE_MODES,
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
import {
  otherLinesAtStop,
  planTransitConnection,
  preferSiblingDistractors,
  resolveActiveLine,
  siblingLineNames,
  transferTargetLines,
  pickTeachableTransitPair,
  lineQuizDistractorsAtHub,
  currentTransitLeg,
  canAdvanceTransitLeg,
  advanceTransitLeg,
  type TransitTransfers,
} from '../src/canalRecall/transit/transfers.ts';
import { buildRoadSegments } from '../src/canalRecall/osm/roadProjection.ts';
import { buildRoadGraph, findRoadRoute } from '../src/canalRecall/routing/roadGraph.ts';

const extractPath = path.resolve('public/data/extracts/amsterdam/transit-network.json');
assert.ok(existsSync(extractPath), `missing ${extractPath}`);

const network = JSON.parse(readFileSync(extractPath, 'utf8')) as TransitNetwork;

// Phase C pin: tram 2 thin slice still adapts and routes.
const thin = adaptTransitNetwork(network, { playableRefs: TRANSIT_THIN_SLICE_REFS });
assert.equal(thin.ways.length, 1, 'thin slice exposes one tram corridor');
assert.equal(thin.ways[0].tags.name, 'Tram 2');
assert.ok(thin.stops.length >= 15, `tram 2 has enough stops (got ${thin.stops.length})`);
assert.ok(thin.stops.some((s) => s.name === 'Dam'), 'Dam stop display name');
assert.equal(displayStopName('Amsterdam, Dam'), 'Dam');
assert.equal(lineDisplayName('tram', '2'), 'Tram 2');

// Phase D: all tram + metro corridors (ferries excluded).
const load = adaptTransitNetwork(network, {
  playableRefs: [],
  playableModes: TRANSIT_DRIVEABLE_MODES,
});
assert.ok(load.ways.length > 1, `Phase D exposes many corridors (got ${load.ways.length})`);
assert.ok(load.ways.some((w) => w.tags.name === 'Tram 2'), 'tram 2 still present in Phase D');
assert.ok(load.ways.some((w) => w.tags.name.startsWith('Metro ')), 'metro corridors unlocked');
assert.ok(!load.ways.some((w) => w.tags.name.startsWith('Ferry ')), 'ferries stay out of Phase D drive');
assert.ok(load.stops.some((s) => s.name === 'Dam'), 'Dam stop display name');

const dam = load.stops.find((s) => s.name === 'Dam');
assert.ok(dam, 'Dam on tram 2');
assert.ok(dam.center, 'Dam has extract centre');

const anchors = transitRouteAnchors(load);
assert.ok(anchors.some((a) => a.name === 'Centraal Station'), 'Centraal anchor');
assert.ok(anchors.some((a) => a.name === 'Dam'), 'Dam anchor');
assert.ok(anchors.some((a) => a.name === 'Noord'), 'Noord terminus anchor');
assert.ok(anchors.some((a) => a.name === 'Isolatorweg'), 'metro 50 terminus in pool');
assert.ok(anchors.length >= 12, `enough termini + hubs (got ${anchors.length})`);

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

// Destination-scoped intermediate stops: Centraal → Museumplein (tram 2 line).
{
  const line = thin.lines[0];
  assert.ok(line, 'thin slice tram 2 line');
  const centraal = thin.stops.find((s) => s.name === 'Centraal Station');
  const museum = thin.stops.find((s) => s.name === 'Museumplein');
  const damThin = thin.stops.find((s) => s.name === 'Dam');
  assert.ok(centraal && museum && damThin, 'Centraal and Museumplein on tram 2');
  const fromId = resolveRouteStopId(thin.stops, { id: `stop-${centraal.stopId}`, name: centraal.name });
  const toId = resolveRouteStopId(thin.stops, { id: `stop-${museum.stopId}`, name: museum.name });
  assert.equal(fromId, centraal.stopId);
  assert.equal(toId, museum.stopId);
  const travel = stopIdsInTravelOrder(line.stopIds, fromId!, toId!);
  assert.equal(travel[0], centraal.stopId);
  assert.equal(travel[travel.length - 1], museum.stopId);
  const intermediate = intermediateStopIds(line.stopIds, fromId!, toId!);
  assert.ok(intermediate.includes(damThin.stopId), 'Dam is intermediate Centraal→Museumplein');
  assert.ok(!intermediate.includes(centraal.stopId), 'origin excluded from intermediate set');
  assert.ok(intermediate.includes(museum.stopId), 'destination included');
  assert.ok(isStopAheadTowardFinish(500, 200), 'closer-to-finish stop is ahead');
  assert.ok(!isStopAheadTowardFinish(100, 400), 'farther-from-finish stop is behind');
}

// Active line resolution must not default to lines[0] under Phase D.
{
  const metro = load.lines.find((l) => l.name === 'Metro 52');
  assert.ok(metro, 'Metro 52 in Phase D load');
  const fromId = metro.stopIds[0]!;
  const toId = metro.stopIds[metro.stopIds.length - 1]!;
  const resolved = resolveActiveLine(load.lines, 'Metro 52', fromId, toId);
  assert.equal(resolved?.name, 'Metro 52');
  const covering = resolveActiveLine(load.lines, null, fromId, toId);
  assert.equal(covering?.name, 'Metro 52', 'covering line preferred over lines[0]');
  assert.notEqual(load.lines[0]?.name, 'Metro 52');
}

// Sibling distractors prefer corridors that share stops.
{
  const siblings = siblingLineNames(load, 'Tram 2');
  assert.ok(siblings.length >= 1, 'tram 2 shares stops with other lines');
  const picked = preferSiblingDistractors(
    'Tram 2',
    siblings,
    load.lineDistractors,
    3,
    (items) => items,
  );
  assert.ok(picked.length >= 2);
  assert.ok(picked.every((name) => name !== 'Tram 2'));
  assert.ok(siblings.includes(picked[0]!), 'first distractor is a sibling when available');
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

  const secondLegClear = transitPlaqueRouteName({
    activeLine: '',
    roadName: 'Metro 50',
    quizPromptName: '',
    quizPromptSubject: '',
    quizCandidateName: '',
    quizCurrentName: '',
    transitLegIndex: 1,
  });
  assert.equal(secondLegClear.routeName, '', 'second leg clears plaque until new line is answered');
  assert.equal(secondLegClear.answerHidden, true);
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

function assertCorridorReachable(
  label: string,
  playableRefs: readonly string[],
  highway: string,
): void {
  const slice = adaptTransitNetwork(network, { playableRefs });
  assert.equal(slice.ways.length, 1, `${label} exposes one corridor`);
  const centre = { lat: 52.372851, lon: 4.8936 };
  const { segments } = buildRoadSegments(slice.ways, centre, {
    simplificationToleranceDegrees: 0.00003,
    roadWidths: { tram: 38, metro: 40 },
    defaultRoadWidth: 38,
  });
  assert.ok(segments.length >= 1, `${label} builds segments`);
  assert.equal(segments[0].name, label);

  const graph = buildRoadGraph(segments.map((segment, index) => ({
    points: segment.points,
    width: segment.width,
    metadata: { name: segment.name, segmentIndex: index },
  })), { mergeSize: 18 });

  const startPt = segments[0].points[0];
  const endPt = segments[0].points[segments[0].points.length - 1];
  const path = findRoadRoute(graph, startPt, endPt);
  assert.ok(path && path.length >= 2, `${label} corridor reachable end-to-end (${highway})`);
}

assertCorridorReachable('Tram 2', TRANSIT_THIN_SLICE_REFS, 'tram');
assertCorridorReachable('Metro 52', ['52'], 'metro');

// Metro 52 named stop pin: Noord ↔ Centraal on the thin corridor.
{
  const metro = adaptTransitNetwork(network, { playableRefs: ['52'] });
  assert.ok(metro.stops.some((s) => s.name === 'Noord'), 'metro 52 stops at Noord');
  assert.ok(metro.stops.some((s) => /Centraal/i.test(s.name)), 'metro 52 stops at Centraal');
}

// Phase E transfers + two-leg connection plan.
const transfersPath = path.resolve('public/data/extracts/amsterdam/transit-transfers.json');
assert.ok(existsSync(transfersPath), `missing ${transfersPath} — run npm run build:amsterdam-transit-transfers`);
const transfers = JSON.parse(readFileSync(transfersPath, 'utf8')) as TransitTransfers;
assert.ok(transfers.counts.transfers >= 50, `enough transfer edges (got ${transfers.counts.transfers})`);

{
  const centraal = load.stops.find((s) => s.name === 'Centraal Station');
  assert.ok(centraal, 'Centraal for transfer quiz pool');
  const others = otherLinesAtStop(load, centraal.stopId, 'Tram 2');
  assert.ok(others.length >= 1, 'Centraal offers other lines besides Tram 2');
  const targets = transferTargetLines(load, transfers, centraal.stopId, 'Tram 2');
  assert.ok(targets.length >= others.length, 'transfer targets include co-located lines');
  const hubDistractors = lineQuizDistractorsAtHub(
    load, transfers, 'Tram 2', centraal.stopId, 3, (items) => items,
  );
  assert.ok(hubDistractors.length >= 2, 'hub line quiz has wrong-line distractors');
  assert.ok(hubDistractors.every((name) => name !== 'Tram 2'));

  // Named two-leg pin: Noord (metro 52) → Isolatorweg (metro 50) must change.
  const noord = load.stops.find((s) => s.name === 'Noord');
  const isolator = load.stops.find((s) => s.name === 'Isolatorweg');
  assert.ok(noord && isolator, 'cross-line termini for two-leg plan');
  const plan = planTransitConnection(load, transfers, noord.stopId, isolator.stopId);
  assert.ok(plan, 'Noord → Isolatorweg finds a connection');
  assert.equal(plan!.legs.length, 2, 'Noord → Isolatorweg is a teachable two-leg hop');
  assert.ok(plan!.transferStopId, 'transfer hub set');
  assert.ok(plan!.nextLineName, 'next line named for hub quiz');
  assert.ok(canAdvanceTransitLeg(plan, 0), 'leg 0 can advance at hub');
  assert.ok(!canAdvanceTransitLeg(plan, 1), 'leg 1 is the last ride');
  const advanced = advanceTransitLeg(plan!, 0);
  assert.equal(advanced?.legIndex, 1);
  assert.equal(advanced?.lineName, plan!.nextLineName);
  assert.equal(currentTransitLeg(plan, 1)?.lineName, plan!.nextLineName);

  const pair = pickTeachableTransitPair(load, transfers, anchors, {
    preferTransfer: 1,
    chooseIndex: () => 0,
    transferRoll: () => 0,
    maxAttempts: 60,
  });
  assert.ok(pair, 'teachable pair picker finds a route');
  assert.equal(pair!.plan.legs.length, 2, 'preferTransfer=1 returns a two-leg hop when available');
}

console.log(
  `Transit routing OK: Phase D ${load.ways.length} corridors / ${load.stops.length} stops / `
  + `${anchors.length} anchors; Phase E ${transfers.counts.transfers} transfers; `
  + `tram 2 + metro 52 end-to-end, Dam, sibling distractors, sticky plaque.`,
);
