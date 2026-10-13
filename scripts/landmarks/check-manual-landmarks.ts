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
// A surveyed standalone landscape adds geometry without replacing buildings.
// It must never fall back to rectangular building suppression to satisfy admission.
for (const spec of MANUAL_LANDMARKS.filter(spec => spec.assetKind === 'landscape')) {
  assert.equal(spec.spatialSuppression, false, `${spec.id}: landscape must retain surrounding building layers`);
  assert.equal(spec.suppressOsmIds.length, 0, `${spec.id}: landscape may not suppress building identities`);
  assert.ok(spec.surveyed && spec.surveyed.anchor.every(Number.isFinite), `${spec.id}: native surveyed landscape anchor required`);
  assert.ok(spec.landmarkId, `${spec.id}: landscape needs its genuine requested POI identity`);
}
// Models that replace no BAG pand: landscapes, memorials and gates stand on squares and quays; the three vessels float.
// Two legacy models over the 500 KB / 40k budget (on the board); new exports must stay inside it.
const OVERSIZE_IDS=new Set(['mountain-network','royal-palace']);
const FREE_STANDING_KINDS=new Set(['landscape','memorial','standalone-structure']);
const FREE_STANDING_IDS=new Set(['houseboat-museum','sea-palace','odessa','sloterdijk-station']); // check:osm-under-models proves nothing lies under them
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json','utf8'));
for(const spec of MANUAL_LANDMARKS){let model=manifest.models[spec.id];assert.ok(model);assert.equal(model.bytes,fs.statSync(`public/canal-drive/models/${spec.id}.glb`).size,`${spec.id}: stale asset byte count`);assert.ok(model.bytes<(OVERSIZE_IDS.has(spec.id)?700000:500000),`${spec.id}: ${model.bytes} bytes over the 500 KB budget`);assert.ok(model.triangles>=(spec.assetKind==='memorial'?12:250)&&model.triangles<(OVERSIZE_IDS.has(spec.id)?50000:40000),`${spec.id}: ${model.triangles} triangles outside 250..40k`);assert.ok(spec.suppressOsmIds.length || spec.hostWallOpenings?.length || FREE_STANDING_KINDS.has(spec.assetKind ?? '') || FREE_STANDING_IDS.has(spec.id), `${spec.id}: exact replacement, bounded host opening or a free-standing kind (landscape, memorial, standalone structure, moored vessel) required`);assert.ok(Math.abs(placementFor(spec,model.bounds).scale-1)<0.3);let document=await io.read(`public/canal-drive/models/${spec.id}.glb`);assert.equal(document.getRoot().listTextures().length,0);const triangles=document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives()).reduce((count,primitive)=>count+(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION')!.getCount())/3,0);assert.equal(model.triangles,triangles,`${spec.id}: stale asset triangle count`);for(let material of document.getRoot().listMaterials())assert.equal(material.getMetallicFactor(),0);for(let accessor of document.getRoot().listAccessors()){let array=accessor.getArray();if(array)assert.ok(Array.from(array).every(Number.isFinite));}}
assert.ok(MANUAL_LANDMARKS.find(s=>s.id==='muziekgebouw-bimhuis')?.relatedLandmarkIds?.includes('extract_landmarks_1651446989'));
console.log(`${MANUAL_LANDMARKS.length} manual landmarks: finite geometry, life-size placement, compression budget, materials, suppression and shared Bimhuis identity passed.`);
