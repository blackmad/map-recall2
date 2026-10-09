/** Isolated CPU LOD pilot from immutable reviewed GLBs. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';import * as THREE from 'three';
import {simplifyReviewedDocument} from './buildingLibraryLod';
const base='public/canal-drive/models/building-library',output='artifacts/building-lod/cpu-pilot-v2',full=JSON.parse(fs.readFileSync(base+'/manifest.json','utf8')),io=new NodeIO();
const ids=['rozengracht-158','lauriergracht-67-69','derde-goudsbloemdwarsstraat-31-39','brouwersgracht-907-925','derde-looiersdwarsstraat-61-73'];
const levels={facade:{ratio:.60,maxErrorM:.005,normalWeight:.1},massing:{ratio:.25,maxErrorM:.015,normalWeight:.02}};
const sha=(b:Uint8Array)=>crypto.createHash('sha256').update(b).digest('hex');
function bounds(doc:any){const b=new THREE.Box3();for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const m=new THREE.Matrix4().fromArray(node.getWorldMatrix());for(const p of mesh.listPrimitives()){const pos=p.getAttribute('POSITION').getArray(),index=p.getIndices().getArray();for(const i of index)b.expandByPoint(new THREE.Vector3(pos[i*3],pos[i*3+1],pos[i*3+2]).applyMatrix4(m));}}return b;}
const reports=[];for(const [level,limits]of Object.entries(levels)){const dir=output+'/'+level+'/assets';fs.mkdirSync(dir,{recursive:true});const manifest={...full,models:[],gallery:undefined};
 for(const id of ids){const model=full.models.find((m:any)=>m.id===id);assert.ok(model);const input=fs.readFileSync(base+'/'+id+'.glb'),recipeBytes=fs.readFileSync(base+'/'+id+'.recipe.json'),recipe=JSON.parse(recipeBytes.toString()),doc=await io.readBinary(input),before=bounds(doc);
  const report=await simplifyReviewedDocument(doc,recipe,limits);const after=bounds(doc);assert.ok(before.min.distanceTo(after.min)<1e-5&&before.max.distanceTo(after.max)<1e-5,'Protected full envelope changed');
  const result=await io.writeBinary(doc);fs.writeFileSync(dir+'/'+id+'.glb',result);fs.writeFileSync(dir+'/'+id+'.recipe.json',recipeBytes);
  const derived={...model,lodLevel:level,lodOriginalModelSHA256:sha(input),triangles:report.triangles,approxTriangles:report.triangles,bytes:result.byteLength,lodApproximation:{method:'Index-only mesh simplification with protected native vertices and original normals/attributes',maxAllowedErrorM:limits.maxErrorM,maxReportedErrorM:report.maxReportedErrorM,originalAssetsUnchanged:true},status:'isolated-lod-candidate-pending-independent-surface-and-visual-review'};
  (manifest.models as any[]).push(derived);reports.push({id,level,...report,originalModelSHA256:sha(input),candidateSHA256:sha(result),originalRecipeSHA256:sha(recipeBytes),bytes:result.byteLength,sourceBytes:input.byteLength,boundsPreserved:true});
  assert.equal(sha(fs.readFileSync(base+'/'+id+'.glb')),sha(input));console.log(JSON.stringify({id,level,originalTriangles:report.originalTriangles,triangles:report.triangles,errorM:report.maxReportedErrorM,bytes:result.byteLength}));
 }
 fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
}
fs.writeFileSync(output+'/report.json',JSON.stringify(reports,null,2)+'\n');
