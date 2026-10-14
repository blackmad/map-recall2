/**
 * Block faces on the trusted ground (bag3dCityJson.ts `pandGroundNap`). Named regression Nassaukade 63X
 * (0363100012124441, 3DBAG ground −9.67 NAP under a +5.9 roof) beside its ordinary neighbour 0363100012207164; and the
 * front re-pitch, which measured roof heights from the raw `b3_h_maaiveld` attribute instead of the facts' ground.
 *   node --import tsx --test src/canalRecall/blockFace/groundTrust.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFacts, regroundFacts, type BuildingFacts, type CityJsonItem} from '../buildingRecipe/facts.ts';
import {faceFactsOnTrustedGround, repitchFrontRoof} from './compile.ts';
import {sharedTerrain} from '../../../scripts/lib/terrainField.ts';

const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/bag3d-nassaukade-63x.json', import.meta.url), 'utf8')) as {outlier: CityJsonItem; ordinary: CityJsonItem};
const meta = {threeDBag: 'fixture', fetchedAt: '2026-10-14', streets: 'none'};
const raw = (item: CityJsonItem) => buildFacts(Object.keys(item.feature.CityObjects)[0].slice(-16), item, [], [], () => [0, 0], meta);

test('faceFactsOnTrustedGround: Nassaukade 63X is re-measured from the terrain, its ordinary neighbour is passed through', () => {
  const outlier = raw(fixture.outlier), ordinary = raw(fixture.ordinary);
  const byPand = new Map([[outlier.pandId, outlier], [ordinary.pandId, ordinary]]);
  const face = {houses: [{pandId: outlier.pandId}, {pandId: ordinary.pandId}]} as Parameters<typeof faceFactsOnTrustedGround>[0];
  const [a, b] = faceFactsOnTrustedGround(face, byPand, sharedTerrain());
  assert.ok(Math.abs(a.heights.groundNAP - 0.47) < 0.01 && Math.abs(a.heights.dak70pM - 5.42) < 0.01, `63X ${a.heights.groundNAP} / ${a.heights.dak70pM}`);
  assert.equal(b, ordinary);
  // Without a terrain field the face compiles on the facts as committed.
  assert.deepEqual(faceFactsOnTrustedGround(face, byPand), [outlier, ordinary]);
});

test('repitchFrontRoof measures the shell top from the facts ground, not the raw 3DBAG attribute', () => {
  // Bilderdijkstraat 145 (frontRoof.test.ts) with its ground moved 3 m up, as the terrain rule moves a failed ground.
  const f: BuildingFacts = JSON.parse(fs.readFileSync('scripts/block-face/faces/bilder-236022-167243/pands/0363100012162572/facts.json', 'utf8'));
  const g = f.heights.groundNAP + 3, moved = regroundFacts(f, g, 'terrain');
  assert.notEqual(moved.attributes.b3_h_maaiveld, g);
  const out = repitchFrontRoof(moved, g + 10.7);
  assert.ok(Math.abs(out.heights.roofMinM - 10.7) < 0.01, `shell top ${out.heights.roofMinM} m above the trusted ground`);
  // Unmoved, the ordinary pand is exactly as before (attribute and facts ground agree).
  assert.ok(Math.abs(repitchFrontRoof(f, f.heights.groundNAP + 13.7).heights.roofMinM - 13.7) < 0.01);
});
