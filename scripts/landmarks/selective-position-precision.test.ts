import {test}from'node:test';
import assert from'node:assert/strict';
import * as T from'three';
import {Document,NodeIO}from'@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression,KHRMaterialsUnlit}from'@gltf-transform/extensions';
import {MeshoptEncoder,MeshoptDecoder}from'meshoptimizer';
import {weld,dedup,prune,reorder,quantize}from'@gltf-transform/functions';
import {graphicProtectionBounds,splitGraphicSupportGeometry,quantizeOrdinaryMesh}from'./selective-position-precision.ts';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);

test('spatial split protects complete touching support triangles without changing contours or vertex coordinates',()=>{
 const graphic=new T.PlaneGeometry(1,1);graphic.translate(8.123456,3.765432,.004);
 const support=new T.BufferGeometry();const p=new Float32Array([7.9,3.5,0,8.6,3.5,0,8.2,4.1,0, 30,8,0,31,8,0,30,9,0]);support.setAttribute('position',new T.BufferAttribute(p,3));support.computeVertexNormals();
 const split=splitGraphicSupportGeometry(support,graphicProtectionBounds([graphic]));assert(split.precise&&split.ordinary);assert.equal(split.precise.getAttribute('position').count,3);assert.equal(split.ordinary.getAttribute('position').count,3);
 assert.deepEqual(Array.from(split.precise.getAttribute('position').array),Array.from(p.slice(0,9)));assert.deepEqual(Array.from(split.ordinary.getAttribute('position').array),Array.from(p.slice(9)));
 assert.deepEqual(Array.from(support.getAttribute('position').array),Array.from(p));
});

test('actual decoded GLB retains bit-exact graphic and support world positions while ordinary positions quantize separately',async()=>{
 const doc=new Document(),buf=doc.createBuffer(),scene=doc.createScene('fixture'),exact=doc.createMesh('precise'),normal=doc.createMesh('ordinary');doc.getRoot().setDefaultScene(scene);
 const unlit=doc.createExtension(KHRMaterialsUnlit),paint=doc.createMaterial('paint').setExtension('KHR_materials_unlit',unlit.createUnlit()),wall=doc.createMaterial('wall');
 const expected=new Map<string,number[]>();
 for(const [name,z,mesh,mat]of [['graphic',.004,exact,paint],['support',0,exact,wall],['roof',10,normal,wall]]as const){
  const values=new Float32Array([8.123456,3.765432,z,9.234567,3.765432,z,8.123456,4.876543,z]);
  const prim=doc.createPrimitive().setExtras({fixture:name}).setMaterial(mat).setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(values).setBuffer(buf)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,1,0,0,1,0,0,1])).setBuffer(buf));mesh.addPrimitive(prim);if(mesh===exact)expected.set(name,Array.from(values));
 }
 scene.addChild(doc.createNode('precise').setMesh(exact));const node=doc.createNode('ordinary').setMesh(normal);scene.addChild(node);
 await doc.transform(weld(),dedup(),prune(),reorder({encoder:MeshoptEncoder,target:'size'}));await quantizeOrdinaryMesh(doc,normal,node);await doc.transform(quantize({pattern:/^(?!POSITION$).+/}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder}),binary=await io.writeBinary(doc),decoded=await io.readBinary(binary);
 let count=0;for(const n of decoded.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()??[]){count+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3;const name=p.getExtras().fixture as string;if(!expected.has(name))continue;
  const position=p.getAttribute('POSITION')!;assert(position.getArray()instanceof Float32Array);assert.deepEqual(Array.from(n.getMatrix()),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);assert.deepEqual(Array.from(position.getArray()!),expected.get(name));
 }
 assert.equal(count,3);assert(decoded.getRoot().listMaterials().find(m=>m.getName()==='paint')!.getExtension('KHR_materials_unlit'));assert(decoded.getRoot().listExtensionsUsed().some(e=>e.extensionName==='EXT_meshopt_compression'));
});
