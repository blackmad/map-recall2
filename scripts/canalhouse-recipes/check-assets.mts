/** Decode actual preview exports without WebGL; browser/game acceptance remains separate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
const manifestArg=process.argv.find(a=>a.startsWith('--manifest='))?.split('=')[1];
if(!manifestArg)throw Error('Use --manifest=public/canal-drive/models/<pack>/pilot.json');
const manifest=JSON.parse(await fs.readFile(manifestArg,'utf8'));
assert(manifest.entries.length>0,'Empty preview catalogue');
const root=path.resolve('public/canal-drive'),loader=new GLTFLoader(),results=[];
for(const entry of manifest.entries){
 const url=new URL(entry.modelUrl,'http://local/canal-drive/');
 const file=path.resolve(root,url.pathname.replace(/^\/canal-drive\//,''));
 assert(file.startsWith(root+path.sep),'Asset path escapes public game root');
 const bytes=await fs.readFile(file),fingerprint=createHash('sha256').update(bytes).digest('hex').slice(0,16);
 assert.equal(url.searchParams.get('asset'),fingerprint,'Stale asset URL');assert.equal(entry.fingerprint,fingerprint);
 const start=performance.now(),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const gltf=await new Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>>((resolve,reject)=>loader.parse(buffer,'',resolve,reject));
 let meshes=0,triangles=0,textureSlots=0,roofUvMeshes=0;
 gltf.scene.traverse(object=>{if(!(object instanceof T.Mesh))return;meshes++;const geometry=object.geometry;triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;
  if(entry.roofMaterial&&(Array.isArray(object.material)?object.material:[object.material]).some(m=>m.userData.canalhouseSurface==='roof')){const uv=geometry.getAttribute('uv');assert(uv,'Shared roof material requires retained export UVs');assert.equal(uv.count,geometry.getAttribute('position').count);assert(Array.from(uv.array).every(Number.isFinite));roofUvMeshes++;}
  for(const material of Array.isArray(object.material)?object.material:[object.material])for(const value of Object.values(material))if(value instanceof T.Texture)textureSlots++;
 });
 const bounds=new T.Box3().setFromObject(gltf.scene);
 if(entry.roofMaterial)assert(roofUvMeshes>0,'Missing material-addressable roof');
 assert(meshes>0&&triangles>0&&!bounds.isEmpty());assert.equal(triangles,entry.triangles);assert.equal(textureSlots,0,'Recipe assets must retain texture-free style');
 const recipeUrl=new URL(entry.recipeUrl,'http://local/canal-drive/'),recipeFile=path.resolve(root,recipeUrl.pathname.replace(/^\/canal-drive\//,''));
 assert(recipeFile.startsWith(root+path.sep),'Recipe path escapes public game root');
 const recipe=JSON.parse(await fs.readFile(recipeFile,'utf8'));
 const expected=new T.Box3().setFromObject(compileCanalHouseRecipe(recipe).group);
 // Compare the actual asset to its source-compiled bounds, including measured
 // surfaces below the street datum. Do not assume every native minimum is zero.
 for(const side of ['min','max'] as const)for(const axis of ['x','y','z'] as const)
  assert(Math.abs(bounds[side][axis]-expected[side][axis])<.001,`Source-compiled ${side}.${axis} moved`);
 results.push({id:entry.id,meshes,triangles,bytes:bytes.length,...(entry.roofMaterial?{roofUvMeshes,sharedRoofMaterialPreset:entry.roofMaterial.preset}:{}),decodeMs:Math.round((performance.now()-start)*100)/100});
}
const report={status:'actual-glb-decode-pass',generatedAt:new Date().toISOString(),manifest:manifestArg,threeRevision:T.REVISION,scope:'CPU decode/fingerprint/ground/material checks; no browser/GPU/game acceptance',entries:results};
const output=process.argv.find(a=>a.startsWith('--output='))?.slice('--output='.length);
if(output)await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
