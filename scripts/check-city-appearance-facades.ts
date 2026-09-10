import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { contextualFacadePatches, facadeRecipeRecords, facadeRecipePatches } from '../src/canalRecall/cityAppearanceFacadeRecipes.js';
import { facadeBatchOpacity, facadeBatchVisible, facadeDisplayLod, FACADE_JOINERY_MIN_ZOOM, FACADE_SILHOUETTE_MIN_ZOOM } from '../src/canalRecall/cityAppearanceFacadeLod.js';
import { createCityAppearanceThreeAdapter, type BlockAppearanceGeometry } from '../src/canalRecall/cityAppearanceThree.js';
import { compileBlockAppearance } from './city-appearance/compile-block-tiles.js';
import type { AppearanceTile } from '../src/canalRecall/cityAppearanceTiles.js';

type Owner = AppearanceTile<BlockAppearanceGeometry, any>['owners'][number];
assert.equal(facadeDisplayLod(FACADE_SILHOUETTE_MIN_ZOOM-.01),'hidden');
assert.equal(facadeDisplayLod(FACADE_SILHOUETTE_MIN_ZOOM),'openings');
assert.equal(facadeDisplayLod(FACADE_JOINERY_MIN_ZOOM),'joinery');
assert.equal(facadeDisplayLod(Number.NaN),'hidden');
assert.equal(facadeBatchVisible('windowGlassWarm',FACADE_SILHOUETTE_MIN_ZOOM),true,'opening silhouette survives intermediate LOD');
assert.equal(facadeBatchVisible('windowFrame',FACADE_SILHOUETTE_MIN_ZOOM),false,'joinery waits for street scale');
assert.equal(facadeBatchVisible('facadeTrimLight',FACADE_JOINERY_MIN_ZOOM),true,'all joinery returns at street scale');
assert.equal(facadeBatchOpacity('windowGlass',FACADE_SILHOUETTE_MIN_ZOOM),.58,'overview openings are subordinate to building massing');
assert.equal(facadeBatchOpacity('windowGlass',FACADE_JOINERY_MIN_ZOOM),1,'close openings regain full material weight');
assert.equal(facadeBatchOpacity('windowFrame',FACADE_SILHOUETTE_MIN_ZOOM),0,'hidden joinery contributes no transparent overdraw');
const image = { file: 'photo.jpg', sha256: 'a'.repeat(64), panoramaSha256: 'b'.repeat(64) };
const record = (id: string, left: number, right: number, shop = 'no') => ({
  id, buildingId: 'fixture', renderBuildingId: 'fixture', renderSurfaceIndices: [0], localStart: [left, 0], localEnd: [right, 0], derivationKey: `derivation-${id}`, evidenceKey: `evidence-${id}`,
  images: { full: image, ground: image }, effectiveProposal: { wholeUsable: 'yes', groundUsable: 'yes', shopfront: shop, awning: 'yes', wallColour: 'red' }, review: null as any,
  visualReview: null as any, proposalSources: {} as any,
});
const owner: Owner = {
  id: 'fixture', geometryRevision: 'geometry-fixture', footprint: { type: 'Polygon', coordinates: [[[4.8, 52.3], [4.8001, 52.3], [4.8001, 52.3001], [4.8, 52.3001], [4.8, 52.3]]] },
  geometry: { frame: { originRD: { x: 120000, y: 480000 }, axes: 'x=east,y=up,z=south', heightDatum: 'legacy-block-NAP-minus-0.65m' },
    building: { id: 'fixture', year: 1900, height: 12, surfaces: [{ type: 'wall', rings: [[[0, 0, 0], [12, 0, 0], [12, 12, 0], [0, 12, 0]]] }, { type: 'wall', rings: [[[0, 0, 8], [12, 0, 8], [12, 12, 8], [0, 12, 8]]] }],
      footprint: { type: 'Polygon', coordinates: [[[0, 0], [12, 0], [12, 8], [0, 8], [0, 0]]] } } }, observations: [],
};
const bind = (source: Owner, records: any[]) => ({ ...structuredClone(source), observations: records.map(payload => ({ id: payload.id, buildingId: source.id, geometryRevision: source.geometryRevision, evidenceKey: payload.evidenceKey, payload })) });
const recipes = (source: Owner, awnings = false, neighbours: Owner[] = [source]) => facadeRecipePatches(source, source.geometry.building.surfaces[0], 0, facadeRecipeRecords([source]), neighbours, awnings);
const kinds = (patches: ReturnType<typeof recipes>, kind: string) => patches.filter(patch => patch.featureKind === kind);
const contextual=contextualFacadePatches(owner,owner.geometry.building.surfaces[0],0,[owner]);assert.ok(contextual.length>20);assert.ok(contextual.every(patch=>patch.observationId===null));assert.equal(new Set(contextual.filter(patch=>patch.featureKind==='contextual-door-prior').map(patch=>patch.featureId)).size,1,'one entrance prior replaces a ground window on the primary exterior wall');
const contextualWindows=contextual.filter(patch=>patch.featureKind==='contextual-window-prior'),contextualWindowIds=new Set(contextualWindows.map(patch=>patch.featureId));assert.equal(contextualWindows.length,contextualWindowIds.size*5,'each historic contextual window has surround, recessed glass, transom, mullion and sill relief');
assert.equal(new Set(contextual.filter(patch=>patch.featureKind==='contextual-trim-prior').map(patch=>patch.featureId)).size,2,'historic facades receive a source-contained street datum and facade-top band');
assert.deepEqual(contextualFacadePatches(owner,owner.geometry.building.surfaces[0],0,[owner]),contextual,'contextual opening style is stable for a source building identity');
const modern=structuredClone(owner);modern.id='modern-fixture';modern.geometry.building.id=modern.id;modern.geometry.building.year=2001;const modernPatches=contextualFacadePatches(modern,modern.geometry.building.surfaces[0],0,[modern]);assert.ok(modernPatches.some(patch=>patch.colour==='windowFrameDark'),'modern construction prior uses dark opening frames');const modernWindows=modernPatches.filter(patch=>patch.featureKind==='contextual-window-prior'),modernWindowIds=new Set(modernWindows.map(patch=>patch.featureId));assert.equal(modernWindows.length,modernWindowIds.size*4,'modern windows keep the simpler unmullioned prior');
const glassTones=new Set(['tone-a','tone-b','tone-c','tone-d','tone-e','tone-f'].flatMap(id=>{const variant=structuredClone(owner);variant.id=id;variant.geometry.building.id=id;return contextualFacadePatches(variant,variant.geometry.building.surfaces[0],0,[variant]).filter(patch=>patch.colour.startsWith('windowGlass')).map(patch=>patch.colour);}));assert.equal(glassTones.size,3,'stable identity palette exposes all three restrained glass tones');
const normal = bind(owner, [record('home', 0, 5), record('shop', 7, 12, 'yes')]);
const sourceSnapshot = JSON.stringify(normal);
const generated = recipes(normal);
assert.ok(kinds(generated, 'window-prior').length > 0);
assert.ok(kinds(generated, 'shopfront-prior').length > 0);
assert.equal(kinds(generated, 'reviewed-awning-prior').length, 0, 'no canopy from unreviewed yes label');
for (const patch of generated) {
  assert.equal(patch.styleSource, 'procedural-prior-not-measured');
  const xs = patch.triangles.filter((_, index) => index % 3 === 0);
  assert.ok(xs.every(x => patch.observationId === 'home' ? x >= 0 && x <= 5 : x >= 7 && x <= 12), 'details never cross interval bounds or fill uncovered gap');
  const zs = patch.triangles.filter((_, index) => index % 3 === 2);
  assert.ok(zs.every(z => z < 0), 'details face outwards, not into building');
}
assert.deepEqual(facadeRecipePatches(normal, normal.geometry.building.surfaces[1], 1, facadeRecipeRecords([normal]), [normal]), [], 'unobserved party/rear wall receives no recipe');
const unknown = record('unknown', 0, 12, 'unknown');
assert.equal(kinds(recipes(bind(owner, [unknown])), 'shopfront-prior').length, 0, 'unknown shop never becomes glazing');
const groundOnly = record('ground-only', 0, 12, 'yes'); groundOnly.effectiveProposal.wholeUsable = 'unknown';
const grounded = recipes(bind(owner, [groundOnly]));
assert.ok(kinds(grounded, 'shopfront-prior').length > 0);
assert.equal(kinds(grounded, 'window-prior').length, 0, 'ground-only recovery does not invent upper-window evidence');
groundOnly.effectiveProposal.wholeUsable = 'no';
assert.ok(kinds(recipes(bind(owner, [groundOnly])), 'shopfront-prior').length > 0, 'independent usable ground survives bad full crop');
const elevated = bind(owner, [record('elevated', 0, 12, 'yes')]);
elevated.geometry.building.groundNAP = .65;
elevated.geometry.building.surfaces[0].rings = [[[0, 4, 0], [12, 4, 0], [12, 12, 0], [0, 12, 0]]];
assert.equal(kinds(recipes(elevated), 'shopfront-prior').length, 0, 'upper wall component never gets an elevated storefront');
assert.ok(kinds(recipes(elevated), 'window-prior').length > 0);
const upperOnly = record('upper-only', 0, 12, 'unknown'); upperOnly.effectiveProposal.groundUsable = 'no';
const independent = recipes(bind(owner, [upperOnly, groundOnly]));
assert.ok(kinds(independent, 'window-prior').length > 0 && kinds(independent, 'shopfront-prior').length > 0, 'upper and ground candidates partition independently');
const obscured = record('obscured', 0, 12, 'yes'); obscured.effectiveProposal.groundUsable = 'no';
assert.equal(kinds(recipes(bind(owner, [obscured])), 'shopfront-prior').length, 0, 'positive class alone does not establish usable ground');
obscured.visualReview = { fieldEligibility: { shopfront: true } };
assert.ok(kinds(recipes(bind(owner, [obscured])), 'shopfront-prior').length > 0, 'specific recovered ground field can supersede baseline usability');
obscured.visualReview.fieldEligibility.shopfront = false;
assert.equal(kinds(recipes(bind(owner, [obscured])), 'shopfront-prior').length, 0);
obscured.review = { placement: 'accepted', targetId: 'obscured', shopfront: 'yes' }; obscured.proposalSources.shopfront = 'human-review';
assert.ok(kinds(recipes(bind(owner, [obscured])), 'shopfront-prior').length > 0, 'explicit human ground judgment supersedes earlier machine field gate');
for (const placement of ['crop-repair', 'uncertain', 'rejected']) {
  const invalid = record('invalid', 0, 12, 'yes'); invalid.review = { placement };
  assert.deepEqual(recipes(bind(owner, [invalid])), [], `placement ${placement} suppresses decorations`);
}
const stale = bind(owner, [record('stale', 0, 12, 'yes')]); stale.observations[0].geometryRevision = 'different';
assert.deepEqual(recipes(stale), [], 'stale geometry cannot receive details');
stale.observations[0].geometryRevision = owner.geometryRevision; stale.observations[0].evidenceKey = 'different';
assert.deepEqual(recipes(stale), [], 'stale evidence cannot receive details');
const competing = bind(owner, [record('one', 0, 12, 'yes'), record('two', 0, 12, 'no')]);
assert.deepEqual(recipes(competing), [], 'overlapping unresolved evidence produces no recipe');
competing.observations[0].payload.review = { placement: 'accepted', targetId: 'one' };
assert.ok(recipes(competing).every(patch => patch.observationId === 'one'), 'accepted placement only wins its own interval');

const hole = bind(owner, [record('house-with-hole', 0, 12)]);
hole.geometry.building.surfaces[0].rings.push([[4.1, 3, 0], [4.1, 10, 0], [5.4, 10, 0], [5.4, 3, 0]]);
const holeRecipes = recipes(hole);
assert.ok(holeRecipes.length < recipes(bind(owner, [record('house-with-hole', 0, 12)])).length);
for (const patch of holeRecipes) {
  const xs = patch.triangles.filter((_, i) => i % 3 === 0), ys = patch.triangles.filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...xs) <= 4.1 || Math.min(...xs) >= 5.4 || Math.max(...ys) <= 3 || Math.min(...ys) >= 10, 'opening rectangle never crosses source hole');
}
const neighbour = structuredClone(owner); neighbour.id = 'neighbour'; neighbour.geometry.building.id = 'neighbour';
neighbour.geometry.building.footprint = { type: 'Polygon', coordinates: [[[0, -3], [12, -3], [12, -.05], [0, -.05], [0, -3]]] };
assert.deepEqual(recipes(normal, false, [normal, neighbour]), [], 'geometry context rejects neighbour-covered wall');
neighbour.geometry.building.footprint = { type: 'Polygon', coordinates: [[[0, -3], [4.9, -3], [4.9, -.01], [0, -.01], [0, -3]]] };
const partial = recipes(normal, false, [normal, neighbour]);
assert.ok(partial.length > 0 && partial.every(patch => patch.observationId === 'shop'), 'partial neighbouring building suppresses only covered opening recipes');

const awning = record('awning', 0, 12, 'yes'); awning.review = { placement: 'accepted', targetId: 'awning', awningKind: 'fabric', awningDeployment: 'deployed' };
assert.equal(kinds(recipes(bind(owner, [awning])), 'reviewed-awning-prior').length, 0, 'awning option defaults off');
assert.equal(kinds(recipes(bind(owner, [awning]), true), 'reviewed-awning-prior').length, 1, 'reviewed deployed fabric uses existing gate');
for (const deployment of ['unknown', 'retracted', 'mixed']) {
  awning.review.awningDeployment = deployment;
  assert.equal(kinds(recipes(bind(owner, [awning]), true), 'reviewed-awning-prior').length, 0);
}
assert.equal(JSON.stringify(normal), sourceSnapshot);

const scene = new THREE.Group();
const adapter = createCityAppearanceThreeAdapter({ parent: scene, targetOriginRD: owner.geometry.frame.originRD, proceduralFacades: true });
const resource = adapter([normal]);
assert.equal(resource.stats.windows, 0, 'facade LOD keeps neutral source geometry');
resource.setLod(normal.id, 'detail'); resource.flush();
assert.ok(resource.stats.windows > 0 && resource.stats.storefronts === 1);
assert.ok(resource.stats.meshes <= 5, 'all windows and shops remain palette batched');
for (const mesh of resource.group.children) {
  const index = mesh.userData.triangleIdentities.findIndex((identity: any) => identity.featureKind);
  if (index >= 0) assert.equal(resource.pick(mesh, index)?.styleSource, 'procedural-prior-not-measured');
}
resource.setLod(normal.id, 'massing'); resource.flush();
assert.equal(resource.stats.windows, 0); assert.equal(resource.stats.storefronts, 0);
resource.dispose(); assert.equal(scene.children.length, 0);
const contextResource=createCityAppearanceThreeAdapter({parent:scene,targetOriginRD:owner.geometry.frame.originRD,contextualFacades:true})([owner]);contextResource.setLod(owner.id,'detail');contextResource.flush();assert.ok(contextResource.stats.windows>0);assert.equal(contextResource.stats.doors,1);for(const mesh of contextResource.group.children)for(const identity of mesh.userData.triangleIdentities.filter((item:any)=>item.featureKind?.startsWith('contextual-')))assert.equal(identity.observationId,null);contextResource.dispose();

const block = JSON.parse(await fs.readFile('public/data/da-costa-block/block.json', 'utf8'));
const evidence = JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json', 'utf8'));
const realOwners = compileBlockAppearance(block, evidence).tiles.flatMap(tile => tile.owners) as Owner[];
const real = createCityAppearanceThreeAdapter({ parent: scene, targetOriginRD: block.origin, targetOffsetNAP: .65, proceduralFacades: true, reviewedAwnings: true })(realOwners);
for (const owner of realOwners) real.setLod(owner.id, 'detail'); real.flush();
assert.ok(real.stats.windows > 100 && real.stats.storefronts > 10);
assert.equal(real.stats.awnings, 0, 'no fabricated human awning approvals in current data');
assert.ok(real.stats.meshes <= 5);
console.log(`City facade recipes passed: ${real.stats.windows} synthetic windows, ${real.stats.storefronts} supported storefronts (${real.stats.storefrontPatches} wall patches), ${real.stats.awnings} awnings; ${real.stats.meshes} palette meshes. Opening counts are display priors, not measured.`);
real.dispose(); assert.equal(scene.children.length, 0);
