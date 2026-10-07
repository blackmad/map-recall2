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
  assert.equal(destinations.length, model.destinationLandmarkIds?.length ?? (model.landmarkId ? (model.id === 'muziekgebouw-bimhuis' ? 2 : 1) : 0), `${model.id}: genuine destinations, no facade alias duplicates`);
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
const oba = features.find(feature => feature.id === 'extract_landmarks_751632752')!;
assert.match(oba.funFact || '', /Jo Coenen.*7 July 2007/, 'OBA card uses researched building history instead of generic address text');
assert.equal(oba.wikipediaExtract, raw.find(feature => feature.id === oba.id)?.wikipediaExtract, 'OBA retains original encyclopedia information');
assert.equal(oba.sourceUrl, 'https://arcam.nl/architectuur-gids/openbare-bibliotheek-amsterdam/', 'OBA supplemental research has its supporting link');
const existingObaFact = 'Existing researched fact retained';
assert.equal(mergeManualPoiFeatures([{...oba, funFact: existingObaFact}]).find(feature => feature.id === oba.id)?.funFact, existingObaFact, 'curated supplements preserve existing researched trivia');

const singelkerk = features.find(feature => feature.id === 'extract_landmarks_760984505');
assert.deepEqual(singelkerk?.center, [52.36770787, 4.88862596], 'Singelkerk pin uses sourced Singel452 address rather than neighboring454');
assert.notDeepEqual(singelkerk?.center, raw.find(feature => feature.id === singelkerk?.id)?.center, 'explicit correction supersedes the mistaken extract pin');
const boomkerk = features.find(feature => feature.id === 'extract_landmarks_746878126');
assert.deepEqual(boomkerk?.center, [52.3830729, 4.8505888], 'Boomkerk uses the documented public southwest entrance outside its surveyed portal');
// Explicit sourced entrance corrections are supported by the runtime. Preserve
// every original pin unless its own supplemental record authorizes a correction.
const correctionFacts = JSON.parse(readFileSync('src/canalRecall/game/manual-poi-data.json', 'utf8')) as {
  modelId: string; destinationOverride?: { center: number[] };
  destinations?: { landmarkId: string; destinationOverride?: { center: number[] } }[];
}[];
const correctionsByModel = new Map(correctionFacts.map(fact => [fact.modelId, fact]));
for (const feature of features.filter(feature => feature.manualPoi)) {
  const original = raw.find(item => item.id === feature.id);
  const fact = correctionsByModel.get(feature.modelId!);
  const correction = fact?.destinations?.find(item => item.landmarkId === feature.id)?.destinationOverride?.center ?? fact?.destinationOverride?.center;
  if (original?.center) assert.deepEqual(feature.center, correction ?? original.center, 'original pin retained unless its own sourced record explicitly corrects it');
}
const elTawheed = features.find(feature => feature.id === 'extract_landmarks_1862244163');
assert.deepEqual(elTawheed?.center, [52.36763342532987, 4.8640231890577725], 'El Tawheed pin uses the source-observed Jan Hanzenstraat114 entrance');
assert.deepEqual(elTawheed?.routeCenter, elTawheed?.center, 'chosen arrival is the same public entrance');
assert.equal(features.filter(feature => feature.modelId === 'el-tawheed').length, 1, 'El Tawheed reuses its genuine extract identity');
const beestVenue = features.find(feature => feature.id === 'n8805218642');
const padelVenue = features.find(feature => feature.id === 'n3974788355');
assert.equal(beestVenue?.modelId, 'beest-boulders');
assert.equal(padelVenue?.modelId, 'beest-boulders');
assert.match(padelVenue?.name ?? '', /Padel NEXT/);
assert.match(padelVenue?.funFact ?? '', /Americano/);
assert.notDeepEqual(padelVenue?.center, beestVenue?.center, 'shared host preserves separate venue pins');
assert.notEqual(padelVenue?.sourceUrl, beestVenue?.sourceUrl, 'shared host preserves independent cards');
const store = createOverlayStore(defaultPreferences({ min: 0.2, max: 1.5, defaultZoom: 0.5 }));
assert.equal(store.getState().destinationId, '', 'Surprise remains the default');
const choice = { id: 'lm-frascati', name: 'Frascati', lat: 52.37, lng: 4.89 };
store.setRoutePois([choice]); store.setDestinationId(choice.id);
store.setRoutePois([choice]);
assert.equal(store.getState().destinationId, choice.id, 'catalogue refresh preserves selected POI');
store.setRoutePois([]);
assert.equal(store.getState().destinationId, '', 'changing city or travel pool clears unavailable choice');
console.log(`Manual POI contract passed: ${MANUAL_LANDMARKS.length} models, ${features.filter(feature => feature.manualPoi).length} independent destinations; route/card/pin/source/identity all covered.`);
