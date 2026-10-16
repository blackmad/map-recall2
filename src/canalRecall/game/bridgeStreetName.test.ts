import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadSpatialIndex, type RoadPoint } from '../routing/roadSurface.ts';
import {
  bridgeWayNetwork,
  carriedStreetName,
  isBridgeWayName,
  routeQuestionRoadName,
} from './bridgeStreetName.ts';

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
