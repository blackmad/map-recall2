import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {placementFor} from '../../src/canalRecall/landmarks/signaturePlacement';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json','utf8'));
for(const spec of MANUAL_LANDMARKS){let model=manifest.models[spec.id];assert.ok(model);assert.ok(model.bytes<500000);assert.ok(model.triangles>=250&&model.triangles<40000);assert.ok(spec.suppressOsmIds.length);assert.ok(Math.abs(placementFor(spec,model.bounds).scale-1)<0.3);let document=await io.read(`public/canal-drive/models/${spec.id}.glb`);assert.equal(document.getRoot().listTextures().length,0);for(let material of document.getRoot().listMaterials())assert.equal(material.getMetallicFactor(),0);for(let accessor of document.getRoot().listAccessors()){let array=accessor.getArray();if(array)assert.ok(Array.from(array).every(Number.isFinite));}}
assert.ok(MANUAL_LANDMARKS.find(s=>s.id==='muziekgebouw-bimhuis')?.relatedLandmarkIds?.includes('extract_landmarks_1651446989'));
console.log(`${MANUAL_LANDMARKS.length} manual landmarks: finite geometry, life-size placement, compression budget, materials, suppression and shared Bimhuis identity passed.`);
