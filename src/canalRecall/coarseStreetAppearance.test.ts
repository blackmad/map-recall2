import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFeatureChunk, meshBuildingFor, ORIGIN, type Feature } from './threeBuildingFeatures.js';
import { BAY_ENTRIES, bayVariant, bayLookFor } from './bayLook.js';
import { extraUsage } from './facadeExtras.js';
import type { StreetAppearanceProfile, ArchitecturalRecipe } from './streetAppearance.js';

const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const ll = (x: number, y: number): [number, number] => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
const recipe: ArchitecturalRecipe = { family: 'punched', period: 'modern', confidence: .8, wallHex: '#ddd8ce', frameHex: '#efece4', sash: 'paired-transom', facadeAssembly: 'stacked-open-balcony', bayScale: 1.1 };
const profile: StreetAppearanceProfile = {
  id: 'coarse-side', streetName: 'Synthetic street', revision: 'v1', segment: [ll(-10, 0), ll(40, 0)], side: 1,
  reachM: 25, confidence: .8, assemblyM: 18, status: 'pilot',
  evidence: [{ id: 'fixture', kind: 'user-reference', sha256: 'a'.repeat(64), inference: 'agent-visual-review', quality: .8, notes: 'Synthetic regression geometry' }],
  recipes: [{ weight: 1, recipe }],
};
const feature: Feature = {
  type: 'Feature', geometry: { type: 'Polygon', coordinates: [[ll(0, 5), ll(12, 5), ll(12, 18), ll(0, 18), ll(0, 5)]] },
  properties: { id: 'bag:coarse-fixture', height: 15, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: 'canal', constructionYear: 1680,
    shopQuiet: true, roofPlanned: true, roofShapeTag: 'gabled', roofEavesHeightM: 11, roofColour: '#594e48' },
};
const streets = new Float32Array([-10, 0, 40, 0]);

test('coarse tiles retain local window grouping and palette without shaped roofs or relief', () => {
  const original = JSON.stringify(feature);
  assert.ok(meshBuildingFor(feature, 'photo')!.roof, 'fixture has a real detailed roof');
  assert.equal(meshBuildingFor(feature, 'photo', true)!.roof, undefined);
  let reliefCalls = 0;
  const previous = extraUsage.record;
  extraUsage.record = () => { reliefCalls++; };
  try {
    for (const look of ['photo', 'storybook', 'cartoon', 'procedural'] as const) {
      const local = buildFeatureChunk([feature], look, 'coarse', streets, [profile]);
      const fallback = buildFeatureChunk([feature], look, 'coarse', streets);
      assert.notDeepEqual(local.tints, fallback.tints, `${look}: local palette reaches coarse walls`);
      assert.notDeepEqual(local.layers, fallback.layers, `${look}: local window grouping reaches coarse cells`);
      if (look === 'photo') {
        const expected = bayLookFor(String(feature.properties.id), 1680, 15, look, 'quiet', recipe);
        assert.ok(local.layers.includes(expected.layers.upper), 'coarse front uses the three-part joint window cell');
        assert.equal(bayVariant(BAY_ENTRIES[expected.layers.upper]).windows, 3);
      }
      assert.equal(Math.max(...Array.from(local.positions).filter((_, i) => i % 3 === 2)), 15, 'simple lid stays at native mapped height');
      assert.equal(local.ranges[0].id, feature.properties.id, 'native identity retained');
      assert.deepEqual(local, buildFeatureChunk([feature], look, 'coarse', streets, [profile]), 'deterministic coarse output');
      const simple = { ...feature, properties: { ...feature.properties, roofPlanned: false, roofEavesHeightM: undefined } };
      assert.deepEqual(local, buildFeatureChunk([simple], look, 'walls', streets, [profile]), 'coarse output contains only ordinary facade cells and simple lid, no crown or balcony relief');
    }
    assert.equal(reliefCalls, 0, 'coarse mode never invokes relief builders');
    assert.equal(JSON.stringify(feature), original, 'input geometry and properties untouched');
  } finally { extraUsage.record = previous; }
});

test('unsupported and untextured coarse surfaces remain unchanged', () => {
  const empty = { ...profile, confidence: .1 };
  for (const look of ['photo', 'untextured'] as const) {
    const noProfiles = buildFeatureChunk([feature], look, 'coarse', streets);
    const candidate = buildFeatureChunk([feature], look, 'coarse', streets, look === 'untextured' ? [profile] : [empty]);
    assert.deepEqual(candidate, noProfiles);
  }
  const kit = { ...feature, properties: { ...feature.properties, kitWall: 'flat', kitWallHex: '#777777' } };
  assert.deepEqual(buildFeatureChunk([kit], 'photo', 'coarse', streets, [profile]), buildFeatureChunk([kit], 'photo', 'coarse', streets));
});
