/** Isolated semantic LOD study. Never writes reviewed/public source assets. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO, type Document} from '@gltf-transform/core';
import * as THREE from 'three';
import {omitReviewedRoles} from './buildingLibrarySemanticLod';
import {verifySemanticLod} from './buildingLibraryLodVerification';
const option=(name:string,fallback:string)=>{const i=process.argv.indexOf(name);if(i<0)return fallback;assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing '+name);return process.argv[i+1];};
const base='public/canal-drive/models/building-library',output=option('--output-root','artifacts/building-lod/semantic-pilot'),sceneRoot=option('--scene-root','artifacts/building-lod/scene-topology'),io=new NodeIO();
const originalManifest=JSON.parse(fs.readFileSync(base+'/manifest.json','utf8'));
const ids:string[]=process.argv.includes('--all-real')?originalManifest.models.filter((m:any)=>!m.synthetic).map((m:any)=>m.id):['rozengracht-158','lauriergracht-67-69','derde-goudsbloemdwarsstraat-31-39','brouwersgracht-907-925','derde-looiersdwarsstraat-61-73'];
const hash=(data:Uint8Array)=>crypto.createHash('sha256').update(data).digest('hex');


const reports=[];
for(const id of ids){
 const bytes=fs.readFileSync(base+'/'+id+'.glb'),recipeBytes=fs.readFileSync(base+'/'+id+'.recipe.json'),recipe=JSON.parse(recipeBytes.toString());
 const scene=JSON.parse(fs.readFileSync(sceneRoot+'/'+id+'.json','utf8'));
 assert.equal(hash(fs.readFileSync(scene.source)),scene.sha256,'Scene changed since topology recovery');
 const original=await io.readBinary(bytes);
 for(const level of ['facade','massing']as const){
  const candidate=await io.readBinary(bytes),selection=omitReviewedRoles(candidate,scene,level),result=await io.writeBinary(candidate);
  const roundtrip=await io.readBinary(result),proof=verifySemanticLod(original,roundtrip,recipe);assert.equal(proof.triangles,selection.triangles);
  const drawCalls=roundtrip.getRoot().listMeshes().reduce((sum,mesh)=>sum+mesh.listPrimitives().length,0);
  const directory=output+'/'+level+'/assets';fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/'+id+'.glb',result);
  fs.writeFileSync(directory+'/'+id+'.recipe.json',recipeBytes);
  reports.push({id,level,...selection,...proof,drawCalls,originalBytes:bytes.length,bytes:result.length,originalModelSHA256:hash(bytes),originalRecipeSHA256:hash(recipeBytes),candidateSHA256:hash(result),sceneSHA256:scene.sha256,visualReview:'pending',promoted:false});
  console.log(id,level,proof.triangles,'triangles',result.length,'bytes');
 }
 assert.equal(hash(fs.readFileSync(base+'/'+id+'.glb')),hash(bytes));assert.equal(hash(fs.readFileSync(base+'/'+id+'.recipe.json')),hash(recipeBytes));
}
for(const level of ['detail','facade','massing']){
 const directory=output+'/'+level+'/assets';fs.mkdirSync(directory,{recursive:true});
 const models=originalManifest.models.filter((m:any)=>ids.includes(m.id)).map((model:any)=>{
  if(level==='detail')for(const suffix of ['.glb','.recipe.json'])fs.copyFileSync(base+'/'+model.id+suffix,directory+'/'+model.id+suffix);
  const report=reports.find(r=>r.id===model.id&&r.level===level);
  return report?{...model,modelUrl:'./'+model.id+'.glb',recipeUrl:'./'+model.id+'.recipe.json',triangles:report.triangles,approxTriangles:report.triangles,drawCalls:report.drawCalls,bytes:report.bytes,lodLevel:level,lodOriginalModelSHA256:report.originalModelSHA256,status:'isolated-semantic-lod-candidate; not promoted'}:model;
 });
 fs.writeFileSync(directory+'/manifest.json',JSON.stringify({...originalManifest,scope:`Isolated ${ids.length}-owner semantic LOD delivery study; not promoted`,gallery:undefined,models},null,2)+'\n');
}
fs.writeFileSync(output+'/report.json',JSON.stringify(reports,null,2)+'\n');
