import fs from 'node:fs/promises';import {NodeIO} from '@gltf-transform/core';import assert from 'node:assert/strict';
import {EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const data=process.env.ORDINARY_DATA_ROOT||'public/canal-drive/ordinary-buildings-data',output=process.env.ORDINARY_OUTPUT_ROOT||'public/canal-drive/models/ordinary-buildings';
const manifest=JSON.parse(await fs.readFile(`${data}/catalogue.json`,'utf8'));let totalBytes=0;
for(const m of manifest.models){const doc=await io.read(`${output}/${m.buildingId.split('.').at(-1)}.glb`);assert.equal(doc.getRoot().listMeshes().length,1);for(const mat of doc.getRoot().listMaterials())assert.equal(mat.getMetallicFactor(),0,`${m.id}: diffuse house-style material must not default to metallic`);let count=0;for(const prim of doc.getRoot().listMeshes()[0].listPrimitives()){const p=prim.getAttribute('POSITION')!,normal=prim.getAttribute('NORMAL')!,uv=prim.getAttribute('TEXCOORD_0');for(const v of p.getArray()!)assert(Number.isFinite(v));for(const v of normal.getArray()!)assert(Number.isFinite(v));if(uv)for(const v of uv.getArray()!)assert(v>=0&&v<=1,`${m.id}: UV ${v}`);const indices=prim.getIndices(),vertexReferences=indices?.getCount()??p.getCount();assert.equal(vertexReferences%3,0,`${m.id}: incomplete triangle`);if(indices)for(const v of indices.getArray()!)assert(Number.isInteger(v)&&v>=0&&v<p.getCount(),`${m.id}: invalid vertex index ${v}`);count+=vertexReferences/3; // roof horizontals must face upwards
 const roofRanges=prim.getMaterial()?.getName()==='roof'?[{startTriangle:0,triangleCount:vertexReferences/3}]:(prim.getExtras().semanticTriangleRanges as any[]||[]).filter(range=>range.name==='roof');for(const range of roofRanges)for(let i=range.startTriangle*3;i<(range.startTriangle+range.triangleCount)*3;i++){assert(i>=0&&i<vertexReferences,`${m.id}: roof semantic range outside primitive`);const vertex=indices?indices.getArray()![i]:i;assert(vertex<normal.getCount(),`${m.id}: roof normal index outside attribute`);const ny=normal.getArray()![vertex*3+1];assert(ny>=-1e-5,`${m.id}: downward roof normal ${ny}`);}const color=prim.getAttribute('COLOR_0');if(color)for(const v of color.getArray()!){const maximum=color.getNormalized()?(color.getArray() instanceof Uint8Array?255:65535):1;assert(Number.isFinite(v)&&v>=0&&v<=maximum,`${m.id}: invalid flat vertex color ${v}`);}}
assert.equal(count,m.triangles);assert(m.materials<=3);assert.equal(m.buildingId,`NL.IMBAG.Pand.${m.id.slice(9)}`);assert(m.referenceImages.length>0);if(m.official3D?.annexHeightMetres){const roof=doc.getRoot().listMeshes()[0].listPrimitives().find(p=>p.getMaterial()?.getName()==='roof')!.getAttribute('POSITION')!.getArray()!;const elevations=[];for(let i=1;i<roof.length;i+=3)elevations.push(roof[i]);assert(Math.min(...elevations)<m.official3D.annexHeightMetres+.2,`${m.id}: low annex lost`);assert(m.bounds.max[1]<32,`${m.id}: equipment maximum became occupied envelope`);}totalBytes+=m.bytes;console.log(`${m.id}: finite geometry, bounded UVs, upward roofs, ${count} triangles / ${m.materials} materials`);}
const recipes=JSON.parse(await fs.readFile(`${data}/recipes.json`,'utf8')).recipes;
const registeredIds=new Set(manifest.models.map((m:any)=>m.buildingId));
for(const recipe of recipes)assert(registeredIds.has(recipe.id),`Unregistered recipe: ${recipe.id}`);
for(const model of manifest.models){
 if(recipes.some((r:any)=>r.id===model.buildingId))continue;
 assert(model.builderSpec&&model.builderStage,`${model.id}: missing native builder registration`);
 const spec=JSON.parse(await fs.readFile(model.builderSpec,'utf8'));
 assert.equal(spec.id,model.buildingId);assert.deepEqual(spec.suppress,[model.buildingId]);
 assert.deepEqual(spec.footprint,model.footprint,`${model.id}: native footprint differs from registered spec`);
 await fs.access(model.builderStage);
}
console.log(`${manifest.models.length} models total ${totalBytes} bytes; structural and recipe/native-builder registration checks pass; visual decisions live in the fidelity ledger.`);
