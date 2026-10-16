import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRoadSpatialIndex, type RoadPoint } from '../routing/roadSurface.ts';
import {
  bridgeWayNetwork,
  carriedStreetName,
  isBridgeWayName,
  routeQuestionRoadName,
  UNSUFFIXED_DECK_NAMES,
} from './bridgeStreetName.ts';
import { hudWithholdsRouteName } from './recallRules.ts';
import {
  bridgeFeatureId, bridgeSpellingKey, decideAskable, routedDeckGroups, supplementBridges, type RoutingWay,
} from '../askableBridges.ts';

const EXTRACT = new URL('../../../public/data/extracts/amsterdam/', import.meta.url);
const readExtract = <T>(file: string): T => JSON.parse(readFileSync(new URL(file, EXTRACT), 'utf8')) as T;

type Way = { name: string; points: RoadPoint[]; width: number };
const way = (name: string, ...points: Array<[number, number]>): Way =>
  ({ name, width: 20, points: points.map(([x, y]) => ({ x, y })) });
const networkOf = (ways: Way[]) => bridgeWayNetwork(ways, buildRoadSpatialIndex(ways, 100));
const OPTIONS = { touchRadius: 9 };

test('bridge names are recognised; street names that merely contain "brug" are not', () => {
  for (const name of ['Niek Engelschmanbrug', 'Magere Brug', 'Torensluis', 'Hoge Sluis', 'Brug 117', 'Oesjesduiker']) {
    assert.equal(isBridgeWayName(name), true, name);
  }
  for (const name of ['Raadhuisstraat', 'Oudebrugsteeg', 'Brugstraat', 'Raampoort', '']) {
    assert.equal(isBridgeWayName(name), false, name);
  }
});

test('a deck between two pieces of the same street carries that street', () => {
  // West – deck – east, with the canal quays meeting the deck ends at 90°.
  const ways = [
    way('Torontobrug', [0, 0], [60, 0]),
    way('Raadhuisstraat', [-200, 0], [0, 0]),
    way('Raadhuisstraat', [60, 0], [260, 0]),
    way('Herengracht', [0, -150], [0, 150]),
    way('Herengracht', [60, -150], [60, 150]),
  ];
  assert.equal(carriedStreetName(networkOf(ways), 0, OPTIONS), 'Raadhuisstraat');
});

test('a quay along the canal on both banks is not what the deck carries', () => {
  // Named regression (user report 2026-10-16): the Niek Engelschmanbrug runs
  // from the Westermarkt onto the Raadhuisstraat. The Keizersgracht quays meet
  // both ends across the deck's line; neither street continues on both sides.
  const ways = [
    way('Niek Engelschmanbrug', [0, 0], [70, 0]),
    way('Westermarkt', [-120, 10], [0, 0]),
    way('Raadhuisstraat', [70, 0], [300, -40]),
    way('Keizersgracht', [0, -200], [0, 200]),
    way('Keizersgracht', [70, -200], [70, 200]),
  ];
  const network = networkOf(ways);
  assert.equal(carriedStreetName(network, 0, OPTIONS), '');
  assert.equal(routeQuestionRoadName({
    rawName: 'Niek Engelschmanbrug',
    deliberateBridge: false,
    carriedStreet: () => carriedStreetName(network, 0, OPTIONS),
  }), '', 'the deck is transparent: no street question names the bridge');
});

test('a deck split mid-span is followed to its far end', () => {
  const ways = [
    way('Noordsche Compagniebrug', [0, 0], [30, 0]),
    way('Noordsche Compagniebrug', [30, 0], [60, 2]),
    way('Herenstraat', [-200, 0], [0, 0]),
    way('Herenstraat', [60, 2], [260, 6]),
  ];
  assert.equal(carriedStreetName(networkOf(ways), 0, OPTIONS), 'Herenstraat');
  assert.equal(carriedStreetName(networkOf(ways), 1, OPTIONS), 'Herenstraat');
});

test('a dead-end deck and a street-named way carry nothing', () => {
  const ways = [
    way('Melkwegbrug', [0, 0], [50, 0]),
    way('Lijnbaansgracht', [-150, 0], [0, 0]),
    way('Raadhuisstraat', [500, 0], [600, 0]),
  ];
  assert.equal(carriedStreetName(networkOf(ways), 0, OPTIONS), '');
  assert.equal(carriedStreetName(networkOf(ways), 2, OPTIONS), '');
});

test('the deliberate bridge question keeps its name; streets pass through', () => {
  let looked = false;
  const carried = () => { looked = true; return 'Kerkstraat'; };
  assert.equal(routeQuestionRoadName({ rawName: 'Magere Brug', deliberateBridge: true, carriedStreet: carried }), 'Magere Brug');
  assert.equal(looked, false, 'no network work for the deliberate bridge question');
  assert.equal(routeQuestionRoadName({ rawName: 'Raadhuisstraat', deliberateBridge: false, carriedStreet: carried }), 'Raadhuisstraat');
  assert.equal(routeQuestionRoadName({ rawName: 'Magere Brug', deliberateBridge: false, carriedStreet: carried }), 'Kerkstraat');
});

test('decks without a bridge suffix are decks: Bullebak, Kanaalpost', () => {
  for (const name of ['Bullebak', 'Kanaalpost', 'Postje van Gerrit Vreling']) {
    assert.equal(isBridgeWayName(name), true, name);
  }
  // A Bullebak deck between two differently named streets is transparent,
  // like any other bridge-named way, instead of being asked as a street.
  const ways = [
    way('Bullebak', [0, 0], [40, 0]),
    way('Haarlemmer Houttuinen', [-200, 0], [0, 0]),
    way('Korte Prinsengracht', [40, 0], [240, 0]),
  ];
  const network = networkOf(ways);
  assert.equal(routeQuestionRoadName({
    rawName: 'Bullebak', deliberateBridge: false, carriedStreet: () => carriedStreetName(network, 0, OPTIONS),
  }), '');
  assert.equal(routeQuestionRoadName({
    rawName: 'Bullebak', deliberateBridge: true, carriedStreet: () => '',
  }), 'Bullebak', 'askable as a bridge where bridges.json has it');
});

test('the unsuffixed deck list is what the register and the routing graph say', () => {
  // A name in the municipal register, without a bridge suffix, whose every
  // routed way is a bridge. A refreshed extract that adds one fails here.
  const register = JSON.parse(readFileSync(new URL('../../../scripts/data/amsterdam-bridge-register.json', import.meta.url), 'utf8')) as
    { bridges: Array<[string, string, ...unknown[]]> };
  const routing = readExtract<Array<{ name: string; bridge?: boolean }>>('streets-routing.json');
  const ways = new Map<string, { all: number; bridges: number }>();
  for (const street of routing) {
    const entry = ways.get(street.name) || { all: 0, bridges: 0 };
    entry.all++;
    if (street.bridge) entry.bridges++;
    ways.set(street.name, entry);
  }
  const derived = new Set<string>();
  for (const [, rawName] of register.bridges) {
    const name = (rawName || '').trim();
    const entry = ways.get(name);
    if (!name || !entry || entry.bridges !== entry.all) continue;
    if (UNSUFFIXED_DECK_NAMES.has(name) || !isBridgeWayName(name)) derived.add(name);
  }
  assert.deepEqual([...derived].sort(), [...UNSUFFIXED_DECK_NAMES].sort());
  assert.equal(isBridgeWayName('Raampoort'), false, 'Raampoort is a street as well as a bridge');
});

test('the plaque on a deck shows the carried street only once it is the settled corridor', () => {
  // Named regression (TODO "Bridge decks after the carried-street fix"): the
  // plaque read the raw way name, so on a deck OSM names after the bridge it
  // was withheld for the whole span. It now reads the name the route question
  // settles on, under the ordinary withholding rule.
  const ways = [
    way('Torontobrug', [0, 0], [60, 0]),
    way('Raadhuisstraat', [-200, 0], [0, 0]),
    way('Raadhuisstraat', [60, 0], [260, 0]),
  ];
  const network = networkOf(ways);
  const plaqueName = (settled: { currentName: string; candidateName?: string; promptName?: string; learned?: boolean }) => {
    const roadName = routeQuestionRoadName({
      rawName: 'Torontobrug', deliberateBridge: false, carriedStreet: () => carriedStreetName(network, 0, OPTIONS),
    });
    const hidden = hudWithholdsRouteName({
      roadName, currentName: settled.currentName, promptName: settled.promptName || '',
      candidateName: settled.candidateName || '', revealed: false, learned: !!settled.learned,
    });
    return hidden ? '' : roadName;
  };
  assert.equal(plaqueName({ currentName: 'Raadhuisstraat' }), 'Raadhuisstraat', 'riding on along the street');
  assert.equal(plaqueName({ currentName: 'Westermarkt', candidateName: 'Raadhuisstraat' }), '',
    'withheld while the carried street is settling into a question');
  assert.equal(plaqueName({ currentName: 'Raadhuisstraat', promptName: 'Raadhuisstraat' }), '', 'withheld while asked');
  assert.equal(plaqueName({ currentName: 'Westermarkt' }), '', 'an unasked carried street is not revealed');
  assert.equal(plaqueName({ currentName: 'Westermarkt', learned: true }), 'Raadhuisstraat', 'a known street shows');
});

test('bridge spellings fold case, spaces and doubled letters', () => {
  assert.equal(bridgeSpellingKey('Heiligewegssluis'), bridgeSpellingKey('Heiligewegsluis'));
  assert.equal(bridgeSpellingKey('Katten brug'), bridgeSpellingKey('Kattenbrug'));
  assert.notEqual(bridgeSpellingKey('Blauwbrug'), bridgeSpellingKey('Blauwebrug'));
  assert.equal(bridgeSpellingKey('Vier Heemskinderensluis'), bridgeSpellingKey('Vier Heemskinderenbrug'));
});

test('askable bridges keep the generator\'s ids', () => {
  const bridges = readExtract<Array<{ id: string; name: string }>>('bridges.json');
  for (const bridge of bridges) assert.equal(bridgeFeatureId(bridge.name), bridge.id, bridge.name);
});

test('a routed deck is askable unless it is a register number or too short to settle on', () => {
  // Each piece 10 m east of the last: parallel carriageways, never joined.
  const line = (metres: number, index: number): [number, number][] => {
    const lon = 4.88 + index * 10 / 68_000;
    return [[52.37, lon], [52.37 + metres / 110_540, lon]];
  };
  const group = (name: string, ...lengths: number[]) => routedDeckGroups([{ name, bridge: true, paths: lengths.map(line) }])[0];
  assert.equal(decideAskable(group('Brug 117', 40)).reason, 'register-number');
  assert.equal(decideAskable(group('Spiegelbrug', 6.5)).reason, 'deck-too-short');
  assert.equal(decideAskable(group('Noordsche Compagniebrug', 40)).askable, true);
  // Two pieces of a deck split mid-span add up; parallel carriageways do not.
  const split = routedDeckGroups([{ name: 'Splitbrug', paths: [
    [[52.37, 4.88], [52.37 + 5 / 110_540, 4.88]],
    [[52.37 + 5 / 110_540, 4.88], [52.37 + 10 / 110_540, 4.88]],
  ] }])[0];
  assert.ok(split.longestDeckMetres > 9.9 && split.longestDeckMetres < 10.1, String(split.longestDeckMetres));
  assert.equal(decideAskable(group('Parallelbrug', 5, 5)).reason, 'deck-too-short');
});

test('every routed bridge name is askable as a bridge, or excluded for a reason', () => {
  // Named regression: the Noordsche Compagniebrug (Herenstraat over the
  // Keizersgracht) was asked by no question once its deck stopped answering
  // "which street?". The supplement adds it with a stable id.
  const bridges = readExtract<Array<{ id: string; name: string }>>('bridges.json');
  const routing = readExtract<RoutingWay[]>('streets-routing.json');
  const register = JSON.parse(readFileSync(new URL('../../../scripts/data/amsterdam-bridge-register.json', import.meta.url), 'utf8')) as
    { bridges: Array<[string, string]> };
  const officialNames = new Set(register.bridges.map(row => (row[1] || '').trim()).filter(Boolean));
  const result = supplementBridges(bridges, routing, 'amsterdam', { officialNames });
  const askable = new Set([...bridges.map(bridge => bridge.name), ...result.added.map(feature => feature.name)]);
  assert.ok(askable.has('Noordsche Compagniebrug'), 'the Noordsche Compagniebrug is a bridge question');
  assert.ok(askable.has('Niek Engelschmanbrug'), 'the Niek Engelschmanbrug is a bridge question');
  assert.ok(askable.has('Bullebak'));
  for (const decision of result.excluded) {
    assert.ok(['register-number', 'deck-too-short', 'spelling-variant'].includes(decision.reason!), JSON.stringify(decision));
  }
  // One sluice, two OSM spellings 6 m apart: one question, in the register's
  // spelling, and never each other's distractor.
  assert.ok(askable.has('Heiligewegsluis'));
  assert.equal(result.excluded.find(decision => decision.name === 'Heiligewegssluis')?.reason, 'spelling-variant');
  assert.equal(result.alreadyAskable.length + result.added.length + result.excluded.length, result.routedNames);
});
