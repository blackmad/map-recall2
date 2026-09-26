import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { createCityAppearanceThreeAdapter, triangulateAppearanceSurface, type BlockAppearanceGeometry } from '../src/canalRecall/cityAppearanceThree.js';
import { contextualBuildingPalette } from '../src/canalRecall/cityAppearancePalette.js';
import { compileBlockAppearance } from './city-appearance/compile-block-tiles.js';
import type { AppearanceTile } from '../src/canalRecall/cityAppearanceTiles.js';

const area = (triangles: number[]) => {
  let sum = 0;
  for (let i = 0; i < triangles.length; i += 9) {
    const a = new THREE.Vector3(...triangles.slice(i, i + 3));
    const b = new THREE.Vector3(...triangles.slice(i + 3, i + 6));
    const c = new THREE.Vector3(...triangles.slice(i + 6, i + 9));
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
};
const wall: BlockAppearanceGeometry['building']['surfaces'][number] = { type: 'wall', rings: [
  [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]],
  [[4, 4, 0], [4, 6, 0], [6, 6, 0], [6, 4, 0]],
] };
assert.deepEqual(contextualBuildingPalette('stable-building',1900),contextualBuildingPalette('stable-building',1900));
assert.notEqual(contextualBuildingPalette('stable-building',1900).wall,contextualBuildingPalette('stable-building',2000).wall,'construction era can change the shared display prior');
const roof: BlockAppearanceGeometry['building']['surfaces'][number] = { type: 'roof', rings: [[
  [0, 10, 0], [0, 10, 10], [10, 12, 10], [10, 12, 0],
]] };
const wallTriangles = triangulateAppearanceSurface(wall.rings);
assert.ok(Math.abs(area(wallTriangles) - 96) < 1e-8, 'wall hole subtracts area');
for (let i = 0; i < wallTriangles.length; i += 9) {
  const [a, b, c] = [0, 3, 6].map(offset => new THREE.Vector3(...wallTriangles.slice(i + offset, i + offset + 3)));
  assert.ok(b.sub(a).cross(c.sub(a)).z > 0, 'source wall winding preserved');
}
const reversed = triangulateAppearanceSurface(wall.rings.map(ring => [...ring].reverse()));
assert.ok(Math.abs(area(reversed) - 96) < 1e-8);
for (let i = 0; i < reversed.length; i += 9) {
  const [a, b, c] = [0, 3, 6].map(offset => new THREE.Vector3(...reversed.slice(i + offset, i + offset + 3)));
  assert.ok(b.sub(a).cross(c.sub(a)).z < 0, 'reversed source winding preserved');
}
const concave = triangulateAppearanceSurface([[[0, 0, 0], [4, 0, 0], [4, 2, 0], [2, 2, 0], [2, 4, 0], [0, 4, 0]]]);
assert.ok(Math.abs(area(concave) - 12) < 1e-8, 'concavity preserved');

type Owner = AppearanceTile<BlockAppearanceGeometry, any>['owners'][number];
const record = (id: string, lo: number, hi: number, colour: string) => ({
  id, buildingId: 'fixture', renderBuildingId: 'fixture', renderSurfaceIndices: [0], localStart: [lo, 0], localEnd: [hi, 0], evidenceKey: `evidence-${id}`,
  effectiveProposal: { wholeUsable: 'yes', wallColour: colour }, review: null,
});
const owner: Owner = {
  id: 'fixture', geometryRevision: 'revision-fixture',
  footprint: { type: 'Polygon', coordinates: [[[4.8, 52.3], [4.8001, 52.3], [4.8001, 52.3001], [4.8, 52.3001], [4.8, 52.3]]] },
  geometry: {
    frame: { originRD: { x: 120000, y: 480000 }, axes: 'x=east,y=up,z=south', heightDatum: 'legacy-block-NAP-minus-0.65m' },
    building: { id: 'fixture', height: 12, surfaces: [wall, roof], footprint: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] } },
  },
  observations: [record('left', 0, 5, 'red'), record('right', 5, 10, 'grey')].map(payload => ({ id: payload.id, buildingId: 'fixture', geometryRevision: 'revision-fixture', evidenceKey: payload.evidenceKey, payload })),
};
const original = JSON.stringify(owner), parent = new THREE.Group();
const make = createCityAppearanceThreeAdapter({ parent, targetOriginRD: { x: 120020, y: 480030 } });
const neutral = make([owner]);
assert.equal(parent.children.length, 1);
assert.equal(neutral.stats.meshes, 2, 'source walls/roofs batched by palette');
const sourceArea = 96 + area(triangulateAppearanceSurface(roof.rings));
const resourceArea = (resource: ReturnType<typeof make>) => resource.group.children.reduce((sum: number, mesh: any) => sum + area(Array.from(mesh.geometry.getAttribute('position').array)), 0);
assert.ok(Math.abs(resourceArea(neutral) - sourceArea) < 1e-4, 'source geometry retains roof slope and wall opening');
const wallMesh = neutral.group.children.find((mesh: any) => mesh.name === 'city-appearance-wall');
assert.ok(Math.abs(wallMesh.geometry.boundingBox.min.x + 20) < 1e-6);
assert.ok(Math.abs(wallMesh.geometry.boundingBox.min.y - .65) < 1e-6, 'NAP conversion is explicit');
assert.equal(wallMesh.geometry.boundingBox.min.z, 30, 'northing converts into south-pointing scene z');
assert.equal(neutral.pick(wallMesh, 0)?.buildingId, 'fixture');
assert.equal(neutral.pick(wallMesh, 0)?.sourceSurfaceIndex, 0);
assert.equal(neutral.pick(wallMesh, 0)?.observationId, null, 'neutral defaults never promote proposed colour');
neutral.setSelected('fixture');
const selection=neutral.group.children.find((mesh:any)=>mesh.name==='city-appearance-selection');
assert.ok(selection,'selected source building gets one runtime review cue');
assert.equal(selection.userData.triangleIdentities,undefined,'selection cue carries no evidence identity');
assert.equal(neutral.pick(selection,0),null,'selection cue cannot intercept source picking');
assert.equal(neutral.stats.meshes,2,'selection cue is excluded from source render statistics');
neutral.setSelected(null);assert.ok(!neutral.group.children.some((mesh:any)=>mesh.name==='city-appearance-selection'),'selection cue is reversible');
neutral.setLod('fixture', 'detail'); neutral.flush();
assert.deepEqual(neutral.group.children.map((mesh: any) => mesh.name).sort(), ['city-appearance-roof', 'city-appearance-wall']);

const experimental = createCityAppearanceThreeAdapter({ parent, targetOriginRD: owner.geometry.frame.originRD, targetOffsetNAP: .65, experimentalWallColours: true })([owner]);
assert.ok(experimental.group.children.some((mesh: any) => mesh.name === 'city-appearance-red'), 'explicitly enabled material evidence persists at facade LOD');
experimental.setLod('fixture', 'detail'); experimental.flush();
assert.ok(Math.abs(resourceArea(experimental) - sourceArea) < 1e-4, 'interval clipping preserves source area and holes');
for (const [colour, id, min, max] of [['red', 'left', 0, 5], ['grey', 'right', 5, 10]] as const) {
  const mesh = experimental.group.children.find((candidate: any) => candidate.name === `city-appearance-${colour}`);
  assert.ok(mesh);
  assert.equal(mesh.geometry.boundingBox.min.x, min); assert.equal(mesh.geometry.boundingBox.max.x, max);
  assert.equal(experimental.pick(mesh, 0)?.observationId, id);
  assert.equal(experimental.pick(mesh, 0)?.sourceSurfaceIndex, 0);
}
const stale = structuredClone(owner); stale.observations[0].geometryRevision = 'stale';
const suppressed = createCityAppearanceThreeAdapter({ parent, targetOriginRD: owner.geometry.frame.originRD, experimentalWallColours: true })([stale]);
suppressed.setLod('fixture', 'detail'); suppressed.flush();
assert.ok(!suppressed.group.children.some((mesh: any) => mesh.name === 'city-appearance-red'), 'stale geometry binding cannot paint');
const collision = structuredClone(owner); collision.observations[1].payload.localStart = [0, 0];
const conflict = createCityAppearanceThreeAdapter({ parent, targetOriginRD: owner.geometry.frame.originRD, experimentalWallColours: true })([collision]);
conflict.setLod('fixture', 'detail'); conflict.flush();
assert.ok(!conflict.group.children.some((mesh: any) => mesh.name === 'city-appearance-red'), 'overlapping machine evidence is withheld');
const auditOwner=structuredClone(owner);auditOwner.observations.forEach((observation:any,index:number)=>{observation.payload.effectiveProposal.wallColour='unknown';observation.payload.agentSourceAudit={disposition:index?'partial':'usable'};});
const auditOverlay=createCityAppearanceThreeAdapter({parent,targetOriginRD:owner.geometry.frame.originRD,auditCoverage:true})([auditOwner]);
assert.ok(auditOverlay.group.children.some((mesh:any)=>mesh.name==='city-appearance-auditedUsable'));
assert.ok(auditOverlay.group.children.some((mesh:any)=>mesh.name==='city-appearance-auditedPartial'));
assert.equal(auditOverlay.pick(auditOverlay.group.children.find((mesh:any)=>mesh.name==='city-appearance-auditedUsable'),0)?.observationId,'left','audit overlay retains source-wall picking identity');
const contextual=createCityAppearanceThreeAdapter({parent,targetOriginRD:owner.geometry.frame.originRD,contextualPalette:true})([owner]);
assert.ok(contextual.group.children.some((mesh:any)=>mesh.name.startsWith('city-appearance-prior')),'explicit contextual mode replaces neutral massing with labelled palette priors');
assert.ok(contextual.group.children.every((mesh:any)=>mesh.userData.triangleIdentities.every((identity:any)=>identity.observationId===null)),'palette priors never acquire evidence identity');
const noShadows=createCityAppearanceThreeAdapter({parent,targetOriginRD:owner.geometry.frame.originRD,castShadows:false})([owner]);assert.ok(noShadows.group.children.every((mesh:any)=>mesh.castShadow===false),'large-area mode can avoid an extra city geometry shadow pass');

const watchedGeometry = neutral.group.children.map((mesh: any) => mesh.geometry);
let retired = 0;
for (const geometry of watchedGeometry) geometry.addEventListener('dispose', () => retired++);
neutral.setLod('fixture', 'massing'); await Promise.resolve();
assert.equal(retired, watchedGeometry.length, 'LOD buffer replacements dispose old resources');
for (const mesh of neutral.group.children) assert.ok(neutral.pick(mesh, 0)?.approximateMassing, 'proxy picking explicitly labels approximation');
const roofProxy = neutral.group.children.find((mesh: any) => mesh.name === 'city-appearance-roof');
const roofNormals = roofProxy.geometry.getAttribute('normal');
assert.ok(Array.from({ length: roofNormals.count }, (_, index) => roofNormals.getY(index)).every(value => value > .99), 'generated roof proxy faces upwards');
let geometryDisposed = 0, materialDisposed = 0;
for (const mesh of neutral.group.children) {
  mesh.geometry.addEventListener('dispose', () => geometryDisposed++);
  mesh.material.addEventListener('dispose', () => materialDisposed++);
}
const meshCount = neutral.stats.meshes;
neutral.dispose(); neutral.dispose();
assert.equal(geometryDisposed, meshCount); assert.equal(materialDisposed, meshCount);
assert.equal(neutral.stats.meshes, 0); assert.equal(neutral.pick(wallMesh, 0), null);
experimental.dispose(); suppressed.dispose(); conflict.dispose(); auditOverlay.dispose(); contextual.dispose(); noShadows.dispose();
assert.equal(parent.children.length, 0);
assert.equal(JSON.stringify(owner), original, 'canonical data never mutated');
await Promise.resolve(); assert.equal(parent.children.length, 0, 'pending LOD microtasks cannot resurrect disposed tiles');

const block = JSON.parse(await fs.readFile('public/data/da-costa-block/block.json', 'utf8'));
const evidence = JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json', 'utf8'));
const compiled = compileBlockAppearance(block, evidence);
const realOwners = compiled.tiles.flatMap(tile => tile.owners) as Owner[];
const real = createCityAppearanceThreeAdapter({ parent, targetOriginRD: block.origin, targetOffsetNAP: .65 })(realOwners);
assert.equal(real.stats.buildings, 171);
assert.ok(real.stats.triangles > 1000); assert.equal(real.stats.meshes, 2, 'real block batched into two neutral palette meshes');
const visibleIds = new Set(real.group.children.flatMap((mesh: any) => mesh.userData.triangleIdentities.map((identity: any) => identity.buildingId)));
assert.equal(visibleIds.size, 171, 'stable picking covers every owner, including fallback geometry');
real.dispose(); assert.equal(parent.children.length, 0);
console.log('City appearance Three adapter: exact roofs/holes/winding, interval colour gates, RD/NAP transformation, palette batching, stable picking, LOD and disposal passed (171 real buildings).');
