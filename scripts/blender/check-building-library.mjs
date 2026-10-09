import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
const base='public/canal-drive/models/building-library/',manifest=JSON.parse(await fs.readFile(base+'manifest.json','utf8')),io=new NodeIO(),results=[];
assert(manifest.models.length>=8);assert.equal(new Set(manifest.models.map(m=>m.id)).size,manifest.models.length);
for(const model of [...manifest.models,...(manifest.gallery?[manifest.gallery]:[])]){
 const bytes=await fs.readFile(base+model.id+'.glb');assert.equal(bytes.length,model.bytes);
 const doc=await io.readBinary(bytes);let triangles=0,primitives=0;const materials=new Set();
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  primitives++;const pos=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),uv=primitive.getAttribute('TEXCOORD_0'),indices=primitive.getIndices();
  assert(pos?.getCount()>0);assert(indices&&indices.getCount()%3===0);
  for(const v of pos.getArray())assert(Number.isFinite(v),model.id+' nonfinite position');
  for(const i of indices.getArray())assert(i<pos.getCount(),model.id+' invalid index');
  for(const v of normal?.getArray()||[])assert(Number.isFinite(v),model.id+' nonfinite normal');
  for(const v of uv?.getArray()||[])assert(Number.isFinite(v),model.id+' nonfinite UV');
  triangles+=indices.getCount()/3;assert(primitive.getMaterial());materials.add(primitive.getMaterial());
 }
 for(const material of materials)if(material.getBaseColorTexture())assert.deepEqual(material.getBaseColorFactor(),[1,1,1,1],model.id+' colour map multiplied by a second tint');
 for(const node of doc.getRoot().listNodes())assert(!node.getExtras().sourceOnly&&!node.getName().startsWith('SOURCE /'),model.id+' exported source overlay');
 assert.equal(triangles,model.triangles,model.id+' triangle accounting');assert.equal(primitives,model.drawCalls,model.id+' draw accounting');
 if(model.id!=='material-gallery'){assert(triangles<=15000,model.id+' triangle budget');assert(primitives<=20,model.id+' draw budget');}
 let embeddedBytes=0;for(const t of doc.getRoot().listTextures()){assert(t.getImage()?.length);embeddedBytes+=t.getImage().length;}
 if(!model.synthetic){const b=JSON.parse(await fs.readFile(base+'evidence/'+model.id+'.json','utf8'));assert.equal(b.ownerId,model.buildingId);assert.equal(b.geometryRevision,model.geometryRevision);assert(model.evidenceBundleHash);}
 results.push({id:model.id,triangles,drawCalls:primitives,bytes:bytes.length,embeddedTextureBytes:embeddedBytes,textureCount:doc.getRoot().listTextures().length,buildSeconds:model.buildSeconds});
}
await fs.writeFile('artifacts/building-library/glb-checks.json',JSON.stringify({passed:true,models:results},null,2)+'\n');console.table(results);
