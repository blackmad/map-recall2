// No two drawn models stand on the same ground (modelOverlap.ts).
//   node --import tsx --test src/canalRecall/landmarks/modelOverlap.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describeCollision, modelCollisions} from './modelOverlap.ts';
import {SIGNATURE_MODELS} from './signatureModels.ts';
import {GAME_BUILDING_MODELS} from './browser.ts';
import {SHADOWED_BY_LANDMARK} from './ordinaryModels.ts';
import {ALL_MANUAL_LANDMARKS} from './manualModels.ts';

const drawn = [...SIGNATURE_MODELS, ...GAME_BUILDING_MODELS];
const drawnIds = new Set(drawn.map(m => m.id));

test('modelCollisions: shared landmark and shared suppressed ids pair up; duplicate specs and empty ids do not', () => {
  const got = modelCollisions([
    {id: 'a', landmarkId: 'L1', suppressOsmIds: ['w1', 'w2']},
    {id: 'b', landmarkId: 'L1', suppressOsmIds: ['w2']},
    {id: 'c', landmarkId: '', suppressOsmIds: ['w3']},
    {id: 'd', landmarkId: '', suppressOsmIds: ['w3', 'w3']},
    {id: 'a', landmarkId: 'L1', suppressOsmIds: ['w1']},
    {id: 'e', landmarkId: 'L2', suppressOsmIds: []},
  ]);
  assert.deepEqual(got, [
    {ids: ['a', 'b'], landmarkId: 'L1', suppressed: ['w2']},
    {ids: ['c', 'd'], suppressed: ['w3']},
  ]);
});

test('no two drawn models share a landmark or a suppressed OSM way / BAG pand', () => {
  const hits = modelCollisions(drawn);
  assert.deepEqual(hits.map(describeCollision), [], 'hold the superseded manual model (status "held") or add the ordinary install to SHADOWED_BY_LANDMARK');
});

test('named regression: the Wereldmuseum KIT complex draws once, as the measured Tropenmuseum (user report 2026-10-16)', () => {
  assert.ok(drawnIds.has('tropenmuseum'));
  assert.ok(!drawnIds.has('wereldmuseum-amsterdam'));
  const old = ALL_MANUAL_LANDMARKS.find(m => m.id === 'wereldmuseum-amsterdam') as {status?: string} | undefined;
  assert.equal(old?.status, 'held', 'the 2026-10-04 massing stays catalogued (GLB in git) but held');
  assert.ok(SIGNATURE_MODELS.some(m => m.landmarkId === 'extract_landmarks_754896207'), 'the museum keeps its landmark identity');
});

test('named regression: Brandweerkazerne Nico draws once; the IJ-tunnel police install on its pand is shadowed', () => {
  assert.ok(drawnIds.has('fire-station-nico'));
  assert.ok(!drawnIds.has('ordinary-0363100012165618'));
});

test('every SHADOWED_BY_LANDMARK pair is real: the install is catalogued, its landmark is drawn and suppresses its pand', () => {
  const catalogue = JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8')).models as {id: string; buildingId: string}[];
  for (const [ordinary, landmark] of Object.entries(SHADOWED_BY_LANDMARK)) {
    const entry = catalogue.find(m => m.id === ordinary);
    assert.ok(entry, `${ordinary} is no longer catalogued: drop it from SHADOWED_BY_LANDMARK`);
    const owner = drawn.find(m => m.id === landmark);
    assert.ok(owner, `${landmark} is not drawn: the install should draw again`);
    assert.ok(owner.suppressOsmIds.includes(entry.buildingId), `${landmark} no longer suppresses ${entry.buildingId}`);
  }
});
