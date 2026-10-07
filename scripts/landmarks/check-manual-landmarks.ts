import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import versions from '../../src/canalRecall/landmarks/modelAssetVersions.json';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {placementFor} from '../../src/canalRecall/landmarks/signaturePlacement';
await MeshoptDecoder.ready;
for(const spec of MANUAL_LANDMARKS){
  const expected=createHash('sha256').update(fs.readFileSync(`public/canal-drive/models/${spec.id}.glb`)).digest('hex').slice(0,16);
  assert.equal((versions as Record<string,string>)[spec.id],expected,`${spec.id}: stale model cache fingerprint`);
}
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json','utf8'));
for(const spec of MANUAL_LANDMARKS){let model=manifest.models[spec.id];assert.ok(model);assert.equal(model.bytes,fs.statSync(`public/canal-drive/models/${spec.id}.glb`).size,`${spec.id}: stale asset byte count`);assert.ok(model.bytes<500000);assert.ok(model.triangles>=(spec.assetKind==='memorial'?12:250)&&model.triangles<40000);assert.ok(spec.suppressOsmIds.length || spec.hostWallOpenings?.length, `${spec.id}: exact replacement identity or bounded additive host opening required`);assert.ok(Math.abs(placementFor(spec,model.bounds).scale-1)<0.3);let document=await io.read(`public/canal-drive/models/${spec.id}.glb`);assert.equal(document.getRoot().listTextures().length,0);const triangles=document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives()).reduce((count,primitive)=>count+(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION')!.getCount())/3,0);assert.equal(model.triangles,triangles,`${spec.id}: stale asset triangle count`);for(let material of document.getRoot().listMaterials())assert.equal(material.getMetallicFactor(),0);for(let accessor of document.getRoot().listAccessors()){let array=accessor.getArray();if(array)assert.ok(Array.from(array).every(Number.isFinite));}}
assert.ok(MANUAL_LANDMARKS.find(s=>s.id==='muziekgebouw-bimhuis')?.relatedLandmarkIds?.includes('extract_landmarks_1651446989'));
console.log(`${MANUAL_LANDMARKS.length} manual landmarks: finite geometry, life-size placement, compression budget, materials, suppression and shared Bimhuis identity passed.`);
