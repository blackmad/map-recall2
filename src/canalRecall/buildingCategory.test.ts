// Taxonomy regression (docs/buildings-pipeline.md "Building categories"):
// ordinary buildings and street surveys are drawn, but never landmarks.
//   node --import tsx --test src/canalRecall/buildingCategory.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isBuildingCategory, ordinaryEntryCategory} from './buildingCategory.ts';
import {SIGNATURE_MODELS} from './landmarks/signatureModels.ts';
import {MANUAL_LANDMARKS, MANUAL_ORDINARY_BUILDINGS} from './landmarks/manualModels.ts';
import {ORDINARY_BUILDINGS, ORDINARY_CATEGORY_BUILDINGS, STREET_SURVEY_HOUSES} from './landmarks/ordinaryModels.ts';
import {GAME_BUILDING_MODELS} from './landmarks/browser.ts';
import {chunkSpecFor} from './landmarks/ordinaryChunks.ts';
import {mergeManualPoiFeatures, manualPoiModelIds} from './game/manualPoiCatalog.ts';

const DATA = 'public/canal-drive/ordinary-buildings-data';
const catalogue = JSON.parse(fs.readFileSync(`${DATA}/catalogue.json`, 'utf8'));
const chunks = JSON.parse(fs.readFileSync(`${DATA}/chunks.json`, 'utf8'));

test('every ordinary-buildings catalogue entry records its category; recipe houses are street surveys', () => {
  for (const m of catalogue.models) {
    assert.ok(isBuildingCategory(m.category) && m.category !== 'landmark', `${m.id}: ${m.category}`);
    if (m.source === 'building-recipes') assert.equal(m.category, 'street-survey', m.id);
    assert.equal(ordinaryEntryCategory(m), m.category);
  }
  assert.ok(STREET_SURVEY_HOUSES.length >= 19 && ORDINARY_CATEGORY_BUILDINGS.length >= 38);
  assert.equal(STREET_SURVEY_HOUSES.length + ORDINARY_CATEGORY_BUILDINGS.length, ORDINARY_BUILDINGS.length);
});

test('every street chunk is street-survey work', () => {
  for (const c of chunks.chunks) {
    assert.equal(c.category, 'street-survey', c.id);
    assert.equal(chunkSpecFor(c).buildingCategory, 'street-survey');
  }
});

test('the landmark list holds only landmarks: no Bilderdijkstraat houses, chunks or Haparandaweg blocks', () => {
  for (const m of SIGNATURE_MODELS) {
    assert.notEqual(m.assetKind, 'ordinary-building', m.id);
    assert.equal(m.buildingCategory ?? 'landmark', 'landmark', m.id);
    assert.ok(!/^ordinary-|^chunk-/.test(m.id), m.id);
    assert.ok(!/Bilderdijkstraat/.test(m.name), m.name);
  }
  const ids = new Set(SIGNATURE_MODELS.map(m => m.id));
  assert.ok(!ids.has('ordinary-0363100012156287'), 'the stale 1903 orange-brick per-house model is not a landmark');
  assert.ok(ids.has('haparandaweg-2-4'), 'Het 4e Gymnasium keeps its POI identity');
  for (const id of ['haparandaweg-8-338', 'haparandaweg-9', 'haparandaweg-902-950', 'haparandaweg-870-900']) assert.ok(!ids.has(id), id);
  assert.ok(ids.has('westerkerk') && ids.has('rijksmuseum'));
});

test('ordinary and street-survey models are still drawn by the game', () => {
  const drawn = new Set(GAME_BUILDING_MODELS.map(m => m.id));
  for (const m of catalogue.models) assert.ok(drawn.has(m.id), m.id);
  for (const m of MANUAL_ORDINARY_BUILDINGS) assert.ok(drawn.has(m.id), m.id);
  assert.ok(MANUAL_ORDINARY_BUILDINGS.some(m => m.id === 'haparandaweg-902-950'));
  for (const m of MANUAL_ORDINARY_BUILDINGS) assert.ok(MANUAL_LANDMARKS.includes(m));
});

test('no destination, card or route candidate comes from a non-landmark model', () => {
  const nonLandmark = new Set([...ORDINARY_BUILDINGS, ...MANUAL_ORDINARY_BUILDINGS].map(m => m.id));
  for (const id of manualPoiModelIds()) assert.ok(!nonLandmark.has(id), id);
  for (const f of mergeManualPoiFeatures([])) assert.ok(!nonLandmark.has(String((f as {modelId?: string}).modelId)), f.id);
});
