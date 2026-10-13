import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const file=process.argv[2]??'public/canal-drive/models/fire-station-hendrik.glb';
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file);
let upward=0,downward=0,vertical=0,tiny=0,triangles=0;const failures:any[]=[];
for(const mesh of doc.getRoot().listMeshes())for(const prim of mesh.listPrimitives()){
 const p=prim.getAttribute('POSITION')!,ix=prim.getIndices(),count=ix?.getCount()??p.getCount();triangles+=count/3;if(prim.getMaterial()?.getName()!=='slate')continue;
 for(let i=0;i<count;i+=3){const a=p.getElement(ix?ix.getScalar(i):i,[]),b=p.getElement(ix?ix.getScalar(i+1):i+1,[]),c=p.getElement(ix?ix.getScalar(i+2):i+2,[]),crossY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(Math.abs(crossY)<1e-6){tiny++;continue;}if(crossY<0){downward++;failures.push({a,b,c,crossY});}else upward++;}
}
const bytes=fs.readFileSync(file),report={file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,triangles,textures:doc.getRoot().listTextures().length,upwardRoofTriangles:upward,downwardRoofTriangles:downward,tinyOrVerticalProjectedTriangles:tiny,failures};fs.writeFileSync('docs/references/fire-station-hendrik/compressed-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,failures:failures.length}));assert.equal(downward,0);assert.equal(report.textures,0);assert(report.bytes<500000&&triangles<40000);
