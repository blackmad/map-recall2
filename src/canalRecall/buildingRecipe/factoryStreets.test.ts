import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nearbyStreets, routingStreetsRD, type RoutingStreet} from './factoryStreets.ts';
import {lngLatToRd} from '../facade/rdNew.ts';
import {draftLargeIntent} from './draftLarge.ts';

const streetsFile = 'public/data/extracts/amsterdam/streets-routing.json';
const line = (lng0: number, lat0: number, lng1: number, lat1: number): [number, number][] => [lngLatToRd([lng0, lat0]), lngLatToRd([lng1, lat1])].map(r => [r.x, r.y] as [number, number]);

test('nearbyStreets: names within 30 m only, nearest first, at most three', () => {
  const ring: [number, number][] = [[100, 100], [120, 100], [120, 120], [100, 120]];
  const streets: RoutingStreet[] = [
    {name: 'Far', pathsRD: [[[100, 200], [120, 200]]]},
    {name: 'Near', pathsRD: [[[90, 125], [130, 125]]]},          // 5 m off the north edge
    {name: 'Edge', pathsRD: [[[60, 100], [90, 100]]]},          // 10 m off the west edge
    {name: 'Second', pathsRD: [[[155, 60], [155, 140]]]},       // 35 m east of the ring: rejected by the 30 m bound
    {name: 'Third', pathsRD: [[[100, 90], [120, 90]]]},         // 10 m off the south edge
  ];
  assert.deepEqual(nearbyStreets(ring, streets), ['Near', 'Edge', 'Third']);
  assert.deepEqual(nearbyStreets(ring, streets, 30, 1), ['Near']);
});

test('routingStreetsRD: [lat, lng] rows become RD paths, unnamed rows are dropped', () => {
  const [a, b] = [[52.37, 4.89], [52.371, 4.891]];
  const out = routingStreetsRD([{name: 'Test', path: [a, b]}, {name: null, path: [a, b]}, {name: 'Two', paths: [[a], [b]]}]);
  assert.deepEqual(out.map(s => s.name), ['Test', 'Two']);
  const r = lngLatToRd([4.89, 52.37]);
  assert.deepEqual(out[0].pathsRD[0][0].map(v => Math.round(v * 100)), [Math.round(r.x * 100), Math.round(r.y * 100)]);
});

test('factory smoke: a committed draft keeps its street names and the real routing network names them', () => {
  // facts.json is the cached fixture (the facts stage needs the 3DBAG API, so the test starts from its output)
  const house = 'scripts/building-recipes/houses/leidsestraat-67-large';
  const facts = JSON.parse(fs.readFileSync(`${house}/facts.json`, 'utf8'));
  const streetFronts = facts.fronts.filter((f: any) => f.street).map((f: any) => f.street as string);
  assert.ok(streetFronts.includes('Leidsestraat'), 'fixture has a Leidsestraat front');
  // the factory's rule: routing streets within 30 m of the BAG footprint name the fronts (pass two of facts)
  const streets = routingStreetsRD(JSON.parse(fs.readFileSync(streetsFile, 'utf8')));
  assert.ok(nearbyStreets(facts.bagFootprintRD.flat(), streets).includes('Leidsestraat'), 'routing network names the street within 30 m');
  // the draft's street-facing groups carry those names (draftLargeIntent with no crops: geometry and names only)
  const {groups} = draftLargeIntent(facts, {id: 'factory-smoke', pandId: facts.pandId, crops: []});
  const onStreet = groups.filter((g: any) => g.street);
  assert.ok(onStreet.length > 0, 'at least one street-facing group');
  for (const g of onStreet) assert.ok(streetFronts.includes(g.street), `group street ${g.street} is a named front`);
});

