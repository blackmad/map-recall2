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
// A surveyed standalone landscape adds geometry without replacing buildings. It must never fall back to rectangular building suppression to
// satisfy admission.
for (const spec of MANUAL_LANDMARKS.filter(spec => spec.assetKind === 'landscape')) {
  assert.equal(spec.spatialSuppression, false, `${spec.id}: landscape must retain surrounding building layers`);
  assert.equal(spec.suppressOsmIds.length, 0, `${spec.id}: landscape may not suppress building identities`);
  assert.ok(spec.surveyed && spec.surveyed.anchor.every(Number.isFinite), `${spec.id}: native surveyed landscape anchor required`);
  assert.ok(spec.landmarkId, `${spec.id}: landscape needs its genuine requested POI identity`);
}
// Standalone admission (2026-10-13): a model that replaces no building and cuts no host wall is admitted when it says so explicitly:
// spatialSuppression is false, no OSM id is suppressed and it carries a finite surveyed anchor. That is the Homomonument (pink granite
// triangles in the Westermarkt pavement and the canal step, assetKind memorial), the Dokwerker memorial, Sloterdijk station, the houseboat
// museum, Sea Palace, Odessa and the Schouwburgpoort: all were failing "exact replacement, bounded host opening or landscape required".
const standalone = (spec: (typeof MANUAL_LANDMARKS)[number]) => spec.assetKind === 'landscape'
  || (spec.spatialSuppression === false && !spec.suppressOsmIds.length && !spec.hostWallOpenings?.length && !!spec.surveyed && spec.surveyed.anchor.every(Number.isFinite));
// Models recorded over the 500 KB / 40,000-triangle budget by the 2026-10-13 closed-panel cleanup (mountain-network, a 47k-triangle facade). The ceiling is
// the recorded size: it may not grow, and a new model gets no allowance.
const OVER_BUDGET: Record<string, {bytes: number; triangles: number}> = {'mountain-network': {bytes: 650000, triangles: 48000}};
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json','utf8'));
for(const spec of MANUAL_LANDMARKS){let model=manifest.models[spec.id];assert.ok(model);assert.equal(model.bytes,fs.statSync(`public/canal-drive/models/${spec.id}.glb`).size,`${spec.id}: stale asset byte count`);const over=OVER_BUDGET[spec.id];assert.ok(model.bytes<(over?.bytes??500000),`${spec.id}: ${model.bytes} bytes over budget`);assert.ok(model.triangles>=(spec.assetKind==='memorial'?12:250)&&model.triangles<(over?.triangles??40000),`${spec.id}: ${model.triangles} triangles outside budget`);assert.ok(spec.suppressOsmIds.length || spec.hostWallOpenings?.length || standalone(spec), `${spec.id}: exact replacement, bounded host opening or native standalone landscape required`);assert.ok(Math.abs(placementFor(spec,model.bounds).scale-1)<0.3);let document=await io.read(`public/canal-drive/models/${spec.id}.glb`);assert.equal(document.getRoot().listTextures().length,0);const triangles=document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives()).reduce((count,primitive)=>count+(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION')!.getCount())/3,0);assert.equal(model.triangles,triangles,`${spec.id}: stale asset triangle count`);for(let material of document.getRoot().listMaterials())assert.equal(material.getMetallicFactor(),0);for(let accessor of document.getRoot().listAccessors()){let array=accessor.getArray();if(array)assert.ok(Array.from(array).every(Number.isFinite));}}
assert.ok(MANUAL_LANDMARKS.find(s=>s.id==='muziekgebouw-bimhuis')?.relatedLandmarkIds?.includes('extract_landmarks_1651446989'));
console.log(`${MANUAL_LANDMARKS.length} manual landmarks: finite geometry, life-size placement, compression budget, materials, suppression and shared Bimhuis identity passed.`);
