/** Real carriers from five gray-block reports must receive windows without changing geometry, height or identity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorateBuildingFeature } from '../src/canalRecall/buildingTilesBrowser.ts';
import { decorateFacade } from '../src/canalRecall/genericFacades.ts';
import { meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { bayLookFor } from '../src/canalRecall/bayLook.ts';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/generic-gray-buildings.json', import.meta.url), 'utf8')).features;
for (const source of fixtures) {
  const before = JSON.stringify(source), styled = decorateFacade(decorateBuildingFeature(source, new Map()));
  const mesh = meshBuildingFor(styled, 'photo');
  assert.ok(mesh && !mesh.bare, `${source.properties.id} has a facade in the actual three.js path`);
  assert.equal(styled.geometry, source.geometry, 'courtyard rings and adjoining footprint edges remain exact');
  for (const key of ['id', 'height', 'minHeight', 'roofShape']) assert.equal(styled.properties[key], source.properties[key], `${key} stays source-defined`);
  assert.equal(styled.properties.appearanceStyleSource, 'citywide-identity-palette-v3-not-measured');
  assert.equal(JSON.stringify(source), before, 'cached delivery feature is not mutated');
  assert.deepEqual(mesh.polygons, source.geometry.type === 'Polygon' ? [source.geometry.coordinates] : source.geometry.coordinates, 'mesh preserves every open courtyard');
}
const sample = fixtures[0], explicit = { ...sample, properties: { ...sample.properties, colour: '#64594e' } };
const tagged = decorateFacade(decorateBuildingFeature(explicit, new Map()));
assert.equal(tagged.properties.facadeMappedColour, '#64594e');
assert.equal(meshBuildingFor(tagged, 'photo')?.wallHex, '#64594e', 'trusted mapped wall survives PHOTO palette selection exactly');
for (const look of ['cartoon', 'storybook'] as const) {
  const expected = bayLookFor(explicit.properties.id, explicit.properties.constructionYear, explicit.properties.height, look, 'quiet');
  assert.equal(meshBuildingFor(tagged, look)?.wallHex, expected.wallHex, `${look} keeps its established palette`);
}
const material = decorateFacade(decorateBuildingFeature({ ...sample, properties: { ...sample.properties, material: 'concrete' } }, new Map()));
assert.equal(material.properties.facadeMappedColour, undefined, 'a material hue is not labeled as a mapped wall color');
assert.equal(material.properties.facadeMaterialColourPrior, '#b9b8b2');
assert.equal(meshBuildingFor(material, 'photo')?.wallHex, '#b9b8b2');
for (const invalid of [{ colour: 'not-a-color' }, { colour: 6 }, { material: [] }, { material: ' ' }, { material: 'unrecognized-value' }, { material: 'constructor' }, { material: 'toString' }, { material: '__proto__' }]) {
  const styled = decorateFacade(decorateBuildingFeature({ ...sample, properties: { ...sample.properties, ...invalid } }, new Map()));
  assert.ok(!meshBuildingFor(styled, 'photo')?.bare, 'malformed appearance metadata does not leave a full building bare');
  assert.equal(styled.properties.facadeMappedColour, undefined, 'invalid values never become trusted source color');
}
const shed = { ...sample, properties: { ...sample.properties, height: 1.5 } };
assert.ok(meshBuildingFor(decorateFacade(decorateBuildingFeature(shed, new Map())), 'photo')?.bare, 'tiny garden sheds do not acquire multistorey windows');
console.log(`Building appearance regressions passed for ${fixtures.length} real OSM carriers, courtyard preservation, mapped PHOTO colors, materials and malformed metadata.`);
