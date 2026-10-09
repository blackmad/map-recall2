/** Isolated draft LOD assets; evidence holds and source acceptance persist. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {omitPortableRoles} from './buildingLibraryPortableLod';
import {verifySemanticLod} from './buildingLibraryLodVerification';
const option=(name:string)=>{const i=process.argv.indexOf(name);assert.ok(i>=0&&process.argv[i+1]);return path.resolve(process.argv[i+1]);};
const base=option('--source-root'), output=option('--output-root'), io=new NodeIO();
assert.ok(output.startsWith(path.resolve('artifacts')+path.sep)&&output!==base);
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
const hash=(b:Uint8Array)=>crypto.createHash('sha256').update(b).digest('hex');
const reports:any[]=[], models:Record<string,any[]>={detail:[],facade:[],massing:[]};
for(const model of manifest.models) {
 const modelPath=path.resolve(base,model.modelUrl),recipePath=path.resolve(base,model.recipeUrl);
 const bytes=fs.readFileSync(modelPath),recipeBytes=fs.readFileSync(recipePath),recipe=JSON.parse(recipeBytes.toString());
 const original=await io.readBinary(bytes);
 assert.equal(original.getRoot().getExtras().recipeSHA256,hash(recipeBytes),'Stale draft export');
 for(const level of ['detail','facade','massing'] as const) {
  const directory=path.join(output,level,'assets');fs.mkdirSync(directory,{recursive:true});
  let binary:Uint8Array=bytes, report:any;
  if(level!=='detail') {
   const candidate=await io.readBinary(bytes),selection=omitPortableRoles(candidate,level);
   binary=await io.writeBinary(candidate);
   const roundtrip=await io.readBinary(binary),proof=verifySemanticLod(original,roundtrip,recipe);
   assert.equal(selection.triangles,proof.triangles);
   assert.equal(roundtrip.getRoot().getExtras().recipeSHA256,hash(recipeBytes));
   assert.equal(roundtrip.getRoot().getExtras().sourceMeshSHA256,original.getRoot().getExtras().sourceMeshSHA256);
   report={id:model.id,level,...selection,...proof,bytes:binary.length,originalBytes:bytes.length,
    drawCalls:roundtrip.getRoot().listMeshes().reduce((sum,m)=>sum+m.listPrimitives().length,0),
    originalModelSHA256:hash(bytes),candidateSHA256:hash(binary),recipeSHA256:hash(recipeBytes),
    visualReview:'pending',promoted:false};
   reports.push(report);
  }
  fs.writeFileSync(path.join(directory,model.id+'.glb'),binary);
  fs.writeFileSync(path.join(directory,model.id+'.recipe.json'),recipeBytes);
  models[level].push({...model,modelUrl:'./'+model.id+'.glb',recipeUrl:'./'+model.id+'.recipe.json',
   ...(report?{triangles:report.triangles,approxTriangles:report.triangles,bytes:report.bytes,drawCalls:report.drawCalls}:{}),
   lodLevel:level,lodOriginalModelSHA256:hash(bytes)});
 }
 assert.equal(hash(fs.readFileSync(modelPath)),hash(bytes));assert.equal(hash(fs.readFileSync(recipePath)),hash(recipeBytes));
}
for(const level of Object.keys(models))fs.writeFileSync(path.join(output,level,'assets/manifest.json'),JSON.stringify({...manifest,
 scope:'Isolated portable construction-role LOD study; source acceptance unchanged',sourceScope:manifest.scope,models:models[level]},null,2)+'\n');
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({models:manifest.models.length,reports,visualReview:'pending',promoted:false},null,2)+'\n');
console.log(JSON.stringify({models:manifest.models.length,variants:reports.length,originalTriangles:reports.filter(r=>r.level==='facade').reduce((s,r)=>s+r.originalTriangles,0),
 facadeTriangles:reports.filter(r=>r.level==='facade').reduce((s,r)=>s+r.triangles,0),massingTriangles:reports.filter(r=>r.level==='massing').reduce((s,r)=>s+r.triangles,0)}));
