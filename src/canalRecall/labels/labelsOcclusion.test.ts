import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SightlineIndex } from './sightlineOcclusion.ts';
import { dedupeLabelCandidates, similarNames } from './labelDedupe.ts';
import type { LabelCandidate } from './labelPlan.ts';

// User 2026-10-25, chase view on the Oudezijds Voorburgwal at the Oude Doelenstraat:
// the alleys behind the canal row were named across its roofs. A 15 m row between the
// camera (behind and above the rider) and an alley hides the alley's name; the open
// canal street ahead stays named.
const box = (w: number, s: number, e: number, n: number, height: number) => ({
  geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  properties: { height },
});

test('street label behind a canal-side row is hidden, the open street ahead is not', () => {
  const index = new SightlineIndex();
  // Canal row east of the Oudezijds Voorburgwal (~4.8962), 15 m tall.
  index.refresh([box(4.8966, 52.3712, 4.8970, 52.3722, 15)], 1000);
  const camera = { lng: 4.8962, lat: 52.3710, altM: 20 };
  assert.equal(index.blocked(camera, { lng: 4.8974, lat: 52.3718, altM: 1 }), true, 'alley behind the row (Stoofsteeg-like)');
  assert.equal(index.blocked(camera, { lng: 4.8962, lat: 52.3722, altM: 1 }), false, 'canal street ahead');
  // From high above the row clears.
  assert.equal(index.blocked({ ...camera, altM: 400 }, { lng: 4.8974, lat: 52.3718, altM: 1 }), false);
});

const c = (id: string, name: string, lng: number, lat: number, cls: LabelCandidate['cls'], rank: number): LabelCandidate =>
  ({ id, name, lng, lat, heightM: 0, cls, rank });

test('Berlage area: one label per POI', () => {
  // Landmark (English Wikipedia) and OSM POI (Dutch) for the Beurs, 10 m apart; Bistro Berlage is its own venue.
  const foot = new Map<string, unknown>([['beurs', { type: 'Polygon', coordinates: [[[4.8955, 52.3746], [4.8968, 52.3746], [4.8968, 52.3759], [4.8955, 52.3759], [4.8955, 52.3746]]] }]]);
  const { kept, dropped } = dedupeLabelCandidates([
    c('own:Beurs van Berlage', 'Beurs van Berlage', 4.896231, 52.37532, 'culture', 30),
    c('beurs', "Berlage's Stock Market", 4.896104, 52.375265, 'landmark', 167),
    c('own:Bistro Berlage', 'Bistro Berlage', 4.895597, 52.37457, 'venue', 24),
  ], foot);
  assert.deepEqual(kept.map(k => k.name).sort(), ["Berlage's Stock Market", 'Bistro Berlage']);
  assert.equal(dropped[0].reason, 'similar-name');
});

// The two OSM 'Centraal Station' nodes lie 250-470 m off the building: they merge into one, but stay apart from the landmark.
test('Central Station: Centraal Station twice merges, the Cuypersgebouw inside the station goes', () => {
  const station = { type: 'Polygon', coordinates: [[[4.8975, 52.3778], [4.9020, 52.3778], [4.9020, 52.3792], [4.8975, 52.3792], [4.8975, 52.3778]]] };
  const cuypers = { type: 'Polygon', coordinates: [[[4.8990, 52.3783], [4.9002, 52.3783], [4.9002, 52.3789], [4.8990, 52.3789], [4.8990, 52.3783]]] };
  const { kept } = dedupeLabelCandidates([
    c('own:cs1', 'Centraal Station', 4.899396, 52.380689, 'civic', 53),
    c('own:cs2', 'Centraal Station', 4.905849, 52.378622, 'civic', 53),
    c('cs', 'Central Station', 4.8998, 52.37846, 'landmark', 184),
    c('cuy', 'Cuypersgebouw', 4.899603, 52.378577, 'landmark', 56),
  ], new Map<string, unknown>([['cs', station], ['cuy', cuypers]]));
  assert.deepEqual(kept.map(k => k.name).sort(), ['Central Station', 'Centraal Station'].sort());
  assert.equal(similarNames('Museum Weesp', 'Stadsloket Weesp'), false);
});
