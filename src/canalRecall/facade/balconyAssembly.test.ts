import assert from 'node:assert/strict';
import test from 'node:test';
import {applyBalconyAssemblies} from './balconyAssembly';
import type {MeshData} from './componentGeometry';

const wall = (): MeshData => ({id: 'front', kind: 'wall', textured: true,
  positions: [0, 0, 0, 4, 0, 0, 4, 4, 0, 0, 4, 0],
  indices: [0, 1, 2, 0, 2, 3], uvs: [0, 0, 1, 0, 1, 1, 0, 1]});

test('linked balcony cuts a full-height opening and rebuilds all exposed rail sides', () => {
  const result = applyBalconyAssemblies([wall()],
    [{id: 'b', bbox: [0.3, 0.42, 0.7, 0.6], wallColour: '#765544'}],
    [{id: 'w', kind: 'window', bbox: [0.35, 0.2, 0.65, 0.45]}]);
  assert.deepEqual(result.stats.acceptedBalconies, ['b']);
  assert.deepEqual(result.paintRemovalMasks, [{id: 'b', bbox: [0.3, 0.42, 0.7, 0.6], colour: '#765544', linkedOpeningId: 'w'}]);
  assert.deepEqual(result.stats.inferredCompletions[0].completedBBox, [0.35, 0.2, 0.65, 0.596]);
  const inset = result.meshes.filter(mesh => mesh.id.includes(':component:w:inset'));
  assert.ok(inset.length > 0);
  assert.ok(inset.every(mesh => !mesh.textured && mesh.colour === '#536267'));
  assert.ok(Math.min(...inset.flatMap(mesh => mesh.uvs!.filter((_, index) => index % 2 === 1))) < 0.41,
    'neutral glazing must continue behind the original painted railing');
  assert.ok(result.meshes.some(mesh => mesh.id === 'balcony-assembly:w:mullion'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'balcony-assembly:w:transom'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'component:b:slab'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'balcony-assembly:b:left-rail'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'balcony-assembly:b:right-rail'));
  assert.equal(result.meshes.some(mesh => mesh.indices.some(i => i * 3 >= mesh.positions.length)), false);
});

test('linked pair is atomic when balcony exceeds wall, restoring the observed window', () => {
  const half = wall();
  half.positions = [0, 0, 0, 2.4, 0, 0, 2.4, 4, 0, 0, 4, 0];
  half.uvs = [0, 0, 0.6, 0, 0.6, 1, 0, 1];
  const result = applyBalconyAssemblies([half],
    [{id: 'b', bbox: [0.25, 0.42, 0.8, 0.6]}],
    [{id: 'w', kind: 'window', bbox: [0.32, 0.2, 0.52, 0.45]}]);
  assert.deepEqual(result.stats.acceptedBalconies, []);
  assert.deepEqual(result.paintRemovalMasks, []);
  assert.deepEqual(result.stats.inferredCompletions, []);
  assert.deepEqual(result.stats.rebuiltOpenings, ['w']);
  const inset = result.meshes.filter(mesh => mesh.id.includes(':component:w:inset'));
  assert.ok(inset.length);
  assert.ok(Math.min(...inset.flatMap(mesh => mesh.uvs!.filter((_, index) => index % 2 === 1))) > 0.54,
    'rejected balcony must not leave an inferred opening below observed window');
});

test('ambiguous balcony link adds neither slab nor cleanup mask', () => {
  const result = applyBalconyAssemblies([wall()],
    [{id: 'b', bbox: [0.3, 0.4, 0.7, 0.6]}],
    [{id: 'w1', kind: 'window', bbox: [0.3, 0.2, 0.55, 0.42]},
      {id: 'w2', kind: 'window', bbox: [0.45, 0.2, 0.7, 0.42]}]);
  assert.deepEqual(result.stats.acceptedBalconies, []);
  assert.deepEqual(result.paintRemovalMasks, []);
  assert.equal(result.stats.skippedBalconies[0].reason, 'ambiguous-linked-window');
  assert.equal(result.meshes.some(mesh => mesh.id === 'component:b:slab'), false);
});

test('an anomalous slab match cannot stretch an opening through the storefront', () => {
  const openings = [0,1,2,3].map(i=>({id:`w${i}`,kind:'window' as const,bbox:[.05+i*.24,.2,.15+i*.24,.4] as const}));
  const balconies = openings.map((w,i)=>({id:`b${i}`,bbox:[w.bbox[0]-.01,.38,w.bbox[2]+.01,i===3?.68:.5] as const}));
  const result=applyBalconyAssemblies([wall()],balconies,openings);
  assert.equal(result.stats.skippedBalconies.find(b=>b.id==='b3')?.reason,'occluded-height-outlier');
  assert.equal(result.stats.inferredCompletions.some(c=>c.openingId==='w3'),false);
  assert.equal(result.paintRemovalMasks.some(m=>m.id==='b3'),false);
  assert.equal(result.meshes.some(m=>m.id.includes(':component:w3:')||m.id==='component:b3:slab'),false);
});
