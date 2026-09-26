import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCityAppearanceThreeAdapter } from '../../src/canalRecall/cityAppearanceThree.js';

const hash = 'a'.repeat(64);
function render({ enabled = false, revision = 'candidate:fixture', binding = hash, disposition = 'inferred-preview' } = {}) {
  const owner: any = {
    id: 'fixture', geometryRevision: revision,
    geometry: {
      frame: { originRD: { x: 0, y: 0 }, axes: 'x=east,y=up,z=south', heightDatum: 'NAP' },
      building: { id: 'fixture', height: 2, footprint: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] },
        surfaces: [{ type: 'wall', rings: [[[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]]], previewAppearance: { colour: '#12ab34', sourceCropSha256: hash, disposition } }] },
    },
    observations: [{ payload: { facadeDescription: { sources: { full: { cropSha256: binding } } } } }],
  };
  const resource = createCityAppearanceThreeAdapter({ parent: { add() {}, remove() {} }, targetOriginRD: { x: 0, y: 0 },
    observedFacades: false, candidateRegistrationPreview: enabled })([owner]);
  resource.flush();
  const meshes = resource.group.children.filter((child: any) => child.isMesh);
  const coloured = meshes.find((child: any) => child.name === 'city-appearance-#12ab34');
  const result = { coloured: Boolean(coloured), identities: coloured?.userData.triangleIdentities ?? [] };
  resource.dispose();
  return result;
}

test('source component material is ignored outside an explicitly enabled bound candidate', () => {
  assert.equal(render().coloured, false, 'normal renderer ignores preview component material');
  assert.equal(render({ enabled: true, revision: 'release-fixture' }).coloured, false);
  assert.equal(render({ enabled: true, binding: 'b'.repeat(64) }).coloured, false);
  assert.equal(render({ enabled: true, disposition: 'registered' }).coloured, false);
  const accepted = render({ enabled: true });
  assert.equal(accepted.coloured, true);
  assert.ok(accepted.identities.length > 0);
  assert.ok(accepted.identities.every((identity: any) => identity.previewOnly && identity.styleSource === 'inferred-source-component-preview'));
});
