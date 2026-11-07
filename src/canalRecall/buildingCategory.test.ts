// Taxonomy regression (docs/buildings-pipeline.md "Building categories"):
// ordinary buildings and street surveys are drawn, but never landmarks.
//   node --import tsx --test src/canalRecall/buildingCategory.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isBuildingCategory, ordinaryEntryCategory} from './buildingCategory.ts';
import {SIGNATURE_MODELS} from './landmarks/signatureModels.ts';
import {MANUAL_LANDMARKS, MANUAL_ORDINARY_BUILDINGS} from './landmarks/manualModels.ts';
import {ORDINARY_BUILDINGS, ORDINARY_CATEGORY_BUILDINGS, SHADOWED_BY_LANDMARK, STREET_SURVEY_HOUSES} from './landmarks/ordinaryModels.ts';
import {GAME_BUILDING_MODELS} from './landmarks/browser.ts';
import {chunkSpecFor} from './landmarks/ordinaryChunks.ts';
import {FURNITURE_TRI_CAP} from './streetFurniture/models.ts';
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
  // An install a bespoke landmark already draws (SHADOWED_BY_LANDMARK) is the one exception: see modelOverlap.test.ts.
  for (const m of catalogue.models) assert.equal(drawn.has(m.id), !SHADOWED_BY_LANDMARK[m.id], m.id);
  for (const m of MANUAL_ORDINARY_BUILDINGS) assert.ok(drawn.has(m.id), m.id);
  assert.ok(MANUAL_ORDINARY_BUILDINGS.some(m => m.id === 'haparandaweg-902-950'));
  for (const m of MANUAL_ORDINARY_BUILDINGS) assert.ok(MANUAL_LANDMARKS.includes(m));
});

test('no destination, card or route candidate comes from a non-landmark model', () => {
  const nonLandmark = new Set([...ORDINARY_BUILDINGS, ...MANUAL_ORDINARY_BUILDINGS].map(m => m.id));
  for (const id of manualPoiModelIds()) assert.ok(!nonLandmark.has(id), id);
  for (const f of mergeManualPoiFeatures([])) assert.ok(!nonLandmark.has(String((f as {modelId?: string}).modelId)), f.id);
});

test('regression: Da Costakade 13 is drawn as an ordinary hand model, never a landmark', () => {
  const id = 'da-costakade-13';
  const spec = MANUAL_LANDMARKS.find(m => m.id === id);
  assert.equal(spec?.buildingCategory, 'ordinary');
  assert.equal(spec?.landmarkId, undefined, 'no landmark identity survives the demotion');
  assert.ok(GAME_BUILDING_MODELS.some(m => m.id === id), 'the hand-built GLB is still drawn');
  assert.ok(!SIGNATURE_MODELS.some(m => m.id === id), 'no landmark card, pin or route destination');
  assert.ok(!manualPoiModelIds().includes(id));
  assert.ok(!mergeManualPoiFeatures([]).some(f => (f as {modelId?: string}).modelId === id));
});

test('street furniture is its own category: drawn and catalogued, never a landmark, POI, card or route candidate (#170)', async () => {
  const {BUILDING_CATEGORIES, CATEGORY_LABEL, countsAsLandmark} = await import('./buildingCategory.ts');
  assert.ok((BUILDING_CATEGORIES as readonly string[]).includes('street-furniture'));
  assert.equal(CATEGORY_LABEL['street-furniture'], 'Street furniture');
  assert.equal(countsAsLandmark({buildingCategory: 'street-furniture'}), false);
  assert.throws(() => ordinaryEntryCategory({id: 'x', category: 'street-furniture'}), 'never an ordinary-buildings catalogue entry');
  const furniture = JSON.parse(fs.readFileSync('public/canal-drive/street-furniture/catalogue.json', 'utf8'));
  assert.equal(furniture.category, 'street-furniture');
  assert.ok(furniture.models.length >= 6);
  const ids = new Set<string>(furniture.models.map((m: {id: string}) => m.id));
  for (const m of furniture.models) {
    assert.equal(m.category, 'street-furniture', m.id);
    assert.ok(fs.existsSync(`public/canal-drive/${m.modelUrl.replace(/^\.\//, '')}`), m.modelUrl);
    // The per-model cap lives with the models (160 since the 2026-11-07 container re-shape: corner strips, doors,
    // crosses and pictogram the user's photos show; rest 150, glass 140, paper 133). One source, so the two cannot drift.
    assert.ok(m.triangles > 0 && m.triangles <= FURNITURE_TRI_CAP, `${m.id}: ${m.triangles}`);
  }
  // No furniture model is in the game's building draw list, the landmark list or the POI catalogue.
  for (const m of GAME_BUILDING_MODELS) assert.ok(!ids.has(m.id), m.id);
  for (const m of SIGNATURE_MODELS) assert.ok(!ids.has(m.id), m.id);
  for (const id of manualPoiModelIds()) assert.ok(!ids.has(id), id);
  for (const f of mergeManualPoiFeatures([])) assert.ok(!ids.has(String((f as {modelId?: string}).modelId)), f.id);
});
