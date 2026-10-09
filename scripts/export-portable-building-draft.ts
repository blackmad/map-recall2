/** Isolated portable draft export. Reviewed public assets are never a destination. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';import * as THREE from 'three';
const option=(name:string)=>{const i=process.argv.indexOf(name);assert.ok(i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing '+name);return process.argv[i+1];};
const input=option('--input'),recipePath=option('--recipe'),output=path.resolve(option('--output-root'));
assert.ok(output.startsWith(path.resolve('artifacts')+path.sep),'Portable draft output must be isolated under artifacts');
const bytes=fs.readFileSync(input),source=JSON.parse(bytes.toString()),recipeBytes=fs.readFileSync(recipePath),recipe=JSON.parse(recipeBytes.toString());
const sha=(b:Uint8Array)=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(source.recipeSHA256,sha(recipeBytes));assert.equal(source.buildingId,recipe.buildingId);
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),mesh=doc.createMesh(recipe.id),groups=new Map<string,any>(),bounds=new THREE.Box3();let triangles=0;
for(const object of source.objects){
 assert.match(object.material,/^#[a-fA-F0-9]{6}$/);const key=object.material;
 const group=groups.get(key)??{position:[],normal:[],uv:[],indices:[],roles:[]};groups.set(key,group);const first=group.indices.length/3;
 for(const face of object.faces){
  const points=face.map((i:number)=>new THREE.Vector3(...object.vertices[i])),normal=new THREE.Vector3();
  for(let i=0;i<points.length;i++)normal.add(new THREE.Vector3().crossVectors(points[i],points[(i+1)%points.length]));assert.ok(normal.length()>1e-10,'Degenerate draft face');normal.normalize();
  const axis=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)].indexOf(Math.max(Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)));
  const projected=points.map((p:THREE.Vector3)=>axis===0?new THREE.Vector2(p.y,p.z):axis===1?new THREE.Vector2(p.x,p.z):new THREE.Vector2(p.x,p.y));
  const faces=THREE.ShapeUtils.triangulateShape(projected,[]);assert.equal(faces.length,points.length-2);
  for(const tri of faces){
   if(new THREE.Vector3().crossVectors(points[tri[1]].clone().sub(points[tri[0]]),points[tri[2]].clone().sub(points[tri[0]])).dot(normal)<0)[tri[1],tri[2]]=[tri[2],tri[1]];
   for(const index of tri){const p=points[index],vertex=group.position.length/3;group.position.push(p.x,p.z,-p.y);group.normal.push(normal.x,normal.z,-normal.y);
    const uv=Math.abs(normal.z)>.6?[p.x,p.y]:Math.abs(normal.y)>Math.abs(normal.x)?[p.x,p.z]:[p.y,p.z];group.uv.push(...uv);group.indices.push(vertex);bounds.expandByPoint(new THREE.Vector3(p.x,p.z,-p.y));}
   triangles++;
  }
 }
 group.roles.push({name:object.name,featureId:object.featureId??null,componentId:object.componentId??null,componentKind:object.componentKind??null,frontageId:object.frontageId??null,sourceDerived:!!object.sourceDerived,lodRole:object.lodRole??null,lodFacade:object.lodFacade??null,lodMassing:object.lodMassing??null,firstTriangle:first,triangleCount:group.indices.length/3-first});
}
for(const [hex,group]of groups){
 const color=new THREE.Color(hex),material=doc.createMaterial(hex).setBaseColorFactor([color.r,color.g,color.b,1]).setRoughnessFactor(.86).setMetallicFactor(hex==='#9f8851'?.5:0);
 const attribute=(type:any,array:Float32Array)=>doc.createAccessor().setBuffer(buffer).setType(type).setArray(array);
 const primitive=doc.createPrimitive().setAttribute('POSITION',attribute('VEC3',Float32Array.from(group.position))).setAttribute('NORMAL',attribute('VEC3',Float32Array.from(group.normal))).setAttribute('TEXCOORD_0',attribute('VEC2',Float32Array.from(group.uv)))
  .setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(group.position.length/3<=65535?Uint16Array.from(group.indices):Uint32Array.from(group.indices))).setMaterial(material).setExtras({portableDraftRoleRanges:group.roles});mesh.addPrimitive(primitive);
}
scene.addChild(doc.createNode(recipe.id).setMesh(mesh));doc.getRoot().setDefaultScene(scene);doc.getRoot().setExtras({status:'isolated portable draft; not promoted',sourceMeshSHA256:sha(bytes),recipeSHA256:sha(recipeBytes)});
const io=new NodeIO(),binary=await io.writeBinary(doc),roundtrip=await io.readBinary(binary);let actual=0;for(const m of roundtrip.getRoot().listMeshes())for(const p of m.listPrimitives()){actual+=p.getIndices()!.getCount()/3;const normals=p.getAttribute('NORMAL')!.getArray()!;for(let i=0;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(normals[i],normals[i+1],normals[i+2])-1)<1e-6);}
assert.equal(actual,triangles);const native=recipe.sourceShell.surfaces.flatMap((s:any)=>s.rings.flat());
const appearance=recipe.massing?.appearanceRoof;
if(appearance){assert.equal(source.sourceAudit.sourceGeometryMode,'inferred-appearance-replaced');assert.equal(source.sourceAudit.nativePeakPreserved,false);assert.ok(bounds.max.y<=appearance.peak+1e-6,'Inferred appearance exceeds selected peak');assert.ok(Math.abs(bounds.max.y-appearance.peak)<1e-6,'Inferred appearance does not reach selected peak');}
else assert.ok(Math.abs(bounds.max.y-Math.max(...native.map((p:number[])=>p[2])))<1e-6,'Native owner peak changed');
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/'+recipe.id+'.glb',binary);fs.writeFileSync(output+'/'+recipe.id+'.recipe.json',recipeBytes);
const model={id:recipe.id,name:recipe.name,address:recipe.address,buildingId:recipe.buildingId,synthetic:false,geometryRevision:recipe.geometryRevision,sourceRDFrame:recipe.placement.sourceRDFrame,anchor:recipe.placement.anchor,xAxisBearingDegrees:recipe.placement.xAxisBearingDegrees,triangles,approxTriangles:triangles,drawCalls:groups.size,bytes:binary.length,boundsGLTFMetres:bounds.toJSON(),status:'isolated portable draft; not reviewed or promoted',modelUrl:'./'+recipe.id+'.glb',recipeUrl:'./'+recipe.id+'.recipe.json'};
fs.writeFileSync(output+'/manifest.json',JSON.stringify({version:1,scope:'Isolated portable geometry study',models:[model]},null,2)+'\n');
fs.writeFileSync(output+'/export-checks.json',JSON.stringify({...model,roundtripTrianglesVerified:true,unitNormalsVerified:true,nativePeakPreserved:!appearance,appearanceRoof:appearance??null,originalRecipeUnchanged:sha(fs.readFileSync(recipePath))===sha(recipeBytes),sourceMeshSHA256:sha(bytes),recipeSHA256:sha(recipeBytes),candidateSHA256:sha(binary),remaining:source.remaining},null,2)+'\n');
console.log(JSON.stringify({id:recipe.id,triangles,drawCalls:groups.size,bytes:binary.length,status:model.status}));
