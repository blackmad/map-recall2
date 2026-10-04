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
  assert.equal(destinations.length, model.id === 'muziekgebouw-bimhuis' ? 2 : 1, `${model.id}: genuine destinations, no facade alias duplicates`);
  for (const poi of destinations) {
    assert.ok(poi.center?.every(Number.isFinite), `${model.id}: geographic pin`);
    assert.ok(poi.manualPoi && (poi.prominenceScore ?? 0) >= 220, `${model.id}: pin/label eligibility`);
    assert.ok(isTeachableRouteDestination(poi), `${model.id}: selectable route with arrival information`);
    assert.ok(poi.funFact || poi.wikipediaExtract, `${model.id}: descriptive information, not just a model name`);
    assert.match(poi.wikipediaUrl || poi.sourceUrl || '', /^https:\/\//, `${model.id}: research link`);
    const card = landmarks.find(landmark => landmark.id === poi.id)!;
    assert.ok(isWorthACard(card) && card.detail, `${model.id}: card payload`);
    assert.deepEqual(card.buildingIds, poi.buildingIds, `${model.id}: exact building identity survives projection`);
    const original = raw.find(feature => feature.id === poi.id);
    if (original?.funFact) assert.equal(poi.funFact, original.funFact, `${model.id}: existing static trivia preserved`);
    if (original?.wikipediaExtract) assert.equal(poi.wikipediaExtract, original.wikipediaExtract, `${model.id}: existing description preserved`);
  }
}
assert.deepEqual(mergeManualPoiFeatures(raw, 'utrecht'), raw, 'other cities untouched');
const store = createOverlayStore(defaultPreferences({ min: 0.2, max: 1.5, defaultZoom: 0.5 }));
assert.equal(store.getState().destinationId, '', 'Surprise remains the default');
const choice = { id: 'lm-frascati', name: 'Frascati', lat: 52.37, lng: 4.89 };
store.setRoutePois([choice]); store.setDestinationId(choice.id);
store.setRoutePois([choice]);
assert.equal(store.getState().destinationId, choice.id, 'catalogue refresh preserves selected POI');
store.setRoutePois([]);
assert.equal(store.getState().destinationId, '', 'changing city or travel pool clears unavailable choice');
console.log(`Manual POI contract passed: ${MANUAL_LANDMARKS.length} models, ${features.filter(feature => feature.manualPoi).length} independent destinations; route/card/pin/source/identity all covered.`);
