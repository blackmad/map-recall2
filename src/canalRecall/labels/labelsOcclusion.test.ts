import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SightlineIndex } from './sightlineOcclusion.ts';
import { dedupeLabelCandidates, screenDuplicateIds, similarNames, spellingVariants } from './labelDedupe.ts';
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

// The two OSM 'Centraal Station' nodes lie 250-470 m off the building: they merge into one, but stay apart from the landmark
// as an entrance label (IJ side, Oostertoegang). They never share a screen with it: screenDuplicateIds below.
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

// Free Ride, feedback d85ba0ac / 3702bcd7 replayed 2026-10-28 (tests/e2e/centre-feedback.spec.ts): the
// overlay drew "Berlage's Stock Market" beside the marker pill of the same name, and "Central Station"
// beside its pill; the OSM "Centraal Station" entrance label could share a wide view with the landmark.
test('screen duplicates: a marked place and its other spelling are left out', () => {
  const onScreen = [
    c('extract_landmarks_1104215352', "Berlage's Stock Market", 4.896104, 52.375265, 'landmark', 167),
    c('own:Beurs', 'Beurs van Berlage', 4.896231, 52.37532, 'culture', 30),
    c('own:Bistro Berlage', 'Bistro Berlage', 4.895597, 52.37457, 'venue', 24),
    c('cs', 'Central Station', 4.8998, 52.37846, 'landmark', 184),
    c('own:cs1', 'Centraal Station', 4.899396, 52.380689, 'civic', 53),
    c('nm', 'National Monument', 4.893429, 52.37287, 'landmark', 136),
    c('own:dam', 'Monument voor Damslachtoffers 7 mei 1945', 4.8932, 52.3731, 'landmark', 60),
    c('own:ah1', 'Albert Heijn', 4.8960, 52.3760, 'venue', 10),
    c('own:ah2', 'Albert Heijn', 4.8990, 52.3775, 'venue', 10),
  ];
  // Quiz modes: no markers. Only the station's other spelling goes.
  assert.deepEqual([...screenDuplicateIds(onScreen)], ['own:cs1']);
  // Free Ride with the Beurs marked by its landmark id (marker on the Damrak, 40 m off the centre):
  // its label goes, and so does the Dutch name beside it; Bistro Berlage is a venue of its own.
  const marked = [{ id: 'extract_landmarks_1104215352', name: "Berlage's Stock Market", lng: 4.8955, lat: 52.3752 }];
  assert.deepEqual([...screenDuplicateIds(onScreen, marked)].sort(), ['extract_landmarks_1104215352', 'own:Beurs', 'own:cs1'].sort());
  // A marker known only by name still hides its spelling variant.
  assert.ok(screenDuplicateIds(onScreen, [{ id: 'x', name: 'Centraal Station', lng: 4.8998, lat: 52.3785 }]).has('cs'));
  // Shared words are not one name across a screen.
  assert.equal(spellingVariants('National Monument', 'Monument voor Damslachtoffers 7 mei 1945'), false);
  assert.equal(similarNames('Monument voor Damslachtoffers 7 mei 1945', 'Plaquette 7 mei 1945'), false);
  // Destinations always stay.
  assert.equal(screenDuplicateIds([c('destination', 'Central Station', 4.8998, 52.37846, 'destination', 999)], [{ id: 'cs', name: 'Central Station' }]).size, 0);
});
