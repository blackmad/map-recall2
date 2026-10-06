import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SIGNATURE_MODELS as MANUAL_LANDMARKS } from '../src/canalRecall/landmarks/signatureModels';
import { mergeManualPoiFeatures } from '../src/canalRecall/game/manualPoiCatalog';
import { buildLandmarks, isWorthACard } from '../src/canalRecall/game/landmarkData';
import { isTeachableRouteDestination } from '../src/canalRecall/game/routeSelection';
import type { LandmarkFeature } from '../src/canalRecall/game/extracts';
import { createOverlayStore } from '../src/canalRecall/overlay/store';
import { defaultPreferences } from '../src/canalRecall/game/preferences';

const raw = JSON.parse(readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8')) as LandmarkFeature[];
const features = mergeManualPoiFeatures(raw);
const landmarks = buildLandmarks(features, (lat, lng) => ({ x: lng, y: lat }));
assert.equal(new Set(features.map(feature => feature.id)).size, features.length, 'POI IDs are unique');
for (const model of MANUAL_LANDMARKS) {
  const destinations = features.filter(feature => feature.modelId === model.id);
  assert.equal(destinations.length, model.destinationLandmarkIds?.length ?? (model.id === 'muziekgebouw-bimhuis' ? 2 : 1), `${model.id}: genuine destinations, no facade alias duplicates`);
  for (const poi of destinations) {
    assert.ok(poi.center?.every(Number.isFinite), `${model.id}: geographic pin`);
    assert.ok(poi.manualPoi && (poi.prominenceScore ?? 0) >= 220, `${model.id}: pin/label eligibility`);
    assert.ok(isTeachableRouteDestination(poi), `${model.id}: selectable route with arrival information`);
    assert.ok(poi.funFact || poi.wikipediaExtract, `${model.id}: descriptive information, not just a model name`);
    assert.match(poi.wikipediaUrl || poi.sourceUrl || '', /^https:\/\//, `${model.id}: research link`);
    const card = landmarks.find(landmark => landmark.id === poi.id)!;
    assert.ok(isWorthACard(card) && card.detail, `${model.id}: card payload`);
    assert.deepEqual(card.buildingIds, poi.buildingIds, `${model.id}: exact building identity survives projection`);
    if (poi.routeCenter) {
      assert.ok(poi.routeCenter.every(Number.isFinite), `${model.id}: sourced route arrival`);
      assert.deepEqual(card.lngLat, [poi.center![1], poi.center![0]], `${model.id}: public arrival must not move the artwork card/pin`);
    }
    const original = raw.find(feature => feature.id === poi.id);
    if (original?.funFact) assert.equal(poi.funFact, original.funFact, `${model.id}: existing static trivia preserved`);
    if (original?.wikipediaExtract) assert.equal(poi.wikipediaExtract, original.wikipediaExtract, `${model.id}: existing description preserved`);
  }
}
assert.deepEqual(mergeManualPoiFeatures(raw, 'utrecht'), raw, 'other cities untouched');
const singelkerk = features.find(feature => feature.id === 'extract_landmarks_760984505');
assert.deepEqual(singelkerk?.center, [52.36770787, 4.88862596], 'Singelkerk pin uses sourced Singel452 address rather than neighboring454');
assert.notDeepEqual(singelkerk?.center, raw.find(feature => feature.id === singelkerk?.id)?.center, 'explicit correction supersedes the mistaken extract pin');
const boomkerk = features.find(feature => feature.id === 'extract_landmarks_746878126');
assert.deepEqual(boomkerk?.center, [52.3830729, 4.8505888], 'Boomkerk uses the documented public southwest entrance outside its surveyed portal');
for (const feature of features.filter(feature => feature.manualPoi && feature.id !== singelkerk?.id && feature.id !== boomkerk?.id)) {
  const original = raw.find(item => item.id === feature.id);
  if (original?.center) assert.deepEqual(feature.center, original.center, 'uncorrected existing destinations retain their coordinates');
}
const beestVenue = features.find(feature => feature.id === 'n8805218642');
const padelVenue = features.find(feature => feature.id === 'n3974788355');
assert.equal(beestVenue?.modelId, 'beest-boulders');
assert.equal(padelVenue?.modelId, 'beest-boulders');
assert.match(padelVenue?.name ?? '', /Padel NEXT/);
assert.match(padelVenue?.funFact ?? '', /Americano/);
assert.notDeepEqual(padelVenue?.center, beestVenue?.center, 'shared host preserves separate venue pins');
assert.notEqual(padelVenue?.sourceUrl, beestVenue?.sourceUrl, 'shared host preserves independent cards');
const kesbekeFact = JSON.parse(readFileSync('src/canalRecall/game/manual-poi-data.json', 'utf8')).find((fact: {modelId:string}) => fact.modelId === 'kesbeke');
const kesbekeVenue = features.find(feature => feature.modelId === 'kesbeke');
assert.deepEqual(kesbekeVenue?.routeCenter, kesbekeFact.routeDestination.center, 'factory destination uses its sourced public entrance');
const store = createOverlayStore(defaultPreferences({ min: 0.2, max: 1.5, defaultZoom: 0.5 }));
assert.equal(store.getState().destinationId, '', 'Surprise remains the default');
const choice = { id: 'lm-frascati', name: 'Frascati', lat: 52.37, lng: 4.89 };
store.setRoutePois([choice]); store.setDestinationId(choice.id);
store.setRoutePois([choice]);
assert.equal(store.getState().destinationId, choice.id, 'catalogue refresh preserves selected POI');
store.setRoutePois([]);
assert.equal(store.getState().destinationId, '', 'changing city or travel pool clears unavailable choice');
console.log(`Manual POI contract passed: ${MANUAL_LANDMARKS.length} models, ${features.filter(feature => feature.manualPoi).length} independent destinations; route/card/pin/source/identity all covered.`);
